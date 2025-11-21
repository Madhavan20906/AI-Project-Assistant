import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import "../App.css";

export default function ChatWindow({ sessionId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [listening, setListening] = useState(false);

  const API = "http://127.0.0.1:5000";
  const recognitionRef = useRef(null);

  const chatBoxRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  // 🔥 FIXED SPEECH RECOGNITION SETUP
  useEffect(() => {
    if ("webkitSpeechRecognition" in window) {
      const Speech = window.webkitSpeechRecognition;
      const recog = new Speech();

      recog.continuous = false;
      recog.interimResults = false;
      recog.lang = "en-US";

      recog.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setInput(text);
        setListening(false);
      };

      recog.onerror = () => {
        setListening(false);
      };

      recog.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recog;
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    fetch(`${API}/api/history/${sessionId}`)
      .then((res) => res.json())
      .then((data) =>
        setMessages(
          data.map((m) => ({
            from: m.role === "assistant" ? "ai" : "user",
            text: m.content,
          }))
        )
      );
  }, [sessionId]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setMessages((prev) => [...prev, { from: "user", text: userMessage }]);
    setInput("");
    setIsTyping(true);

    const res = await fetch(`${API}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage, session_id: sessionId }),
    });

    const data = await res.json();
    setIsTyping(false);

    setMessages((prev) => [...prev, { from: "ai", text: data.reply }]);
  };

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();

    setMessages((prev) => [
      ...prev,
      { from: "user", text: `📄 Uploaded file: ${file.name}` },
    ]);

    setIsTyping(true);

    const res = await fetch(`${API}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `User uploaded file: ${file.name}\n\n${text}`,
        session_id: sessionId,
      }),
    });

    const data = await res.json();
    setIsTyping(false);

    setMessages((prev) => [...prev, { from: "ai", text: data.reply }]);
  }

  // 🔥 FIXED TOGGLE MIC
  function toggleMic() {
    const recog = recognitionRef.current;
    if (!recog) {
      alert("Voice not supported on this browser");
      return;
    }

    if (!listening) {
      setListening(true);
      recog.start();
    } else {
      recog.stop();
      setListening(false);
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-header">💬 AI Project Assistant</div>

      <div id="chat-box" className="chat-box" ref={chatBoxRef}>
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.from}`}>
            {m.from === "ai" ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const codeText = String(children).replace(/\n$/, "");

                    const copyToClipboard = () => {
                      navigator.clipboard.writeText(codeText);
                    };

                    if (!inline && match) {
                      return (
                        <div style={{ position: "relative" }}>
                          <button
                            onClick={copyToClipboard}
                            style={{
                              position: "absolute",
                              top: 6,
                              right: 6,
                              background: "#333",
                              color: "white",
                              border: "none",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "12px",
                              zIndex: 10,
                            }}
                          >
                            Copy code
                          </button>

                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {codeText}
                          </SyntaxHighlighter>
                        </div>
                      );
                    }

                    return <code>{children}</code>;
                  },
                }}
              >
                {m.text}
              </ReactMarkdown>
            ) : (
              <span>{m.text}</span>
            )}
          </div>
        ))}

        {isTyping && <div className="typing">🤖 AI is typing…</div>}
      </div>

      <div className="input-area">
        <label style={{ fontSize: "22px", cursor: "pointer" }}>
          +
          <input type="file" style={{ display: "none" }} onChange={handleFileUpload} />
        </label>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />

        <button onClick={toggleMic}>{listening ? "🎙️" : "🎤"}</button>
        <button onClick={sendMessage}>↑</button>
      </div>
    </div>
  );
}

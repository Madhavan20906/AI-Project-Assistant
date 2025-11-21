import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import "../App.css";

export default function ChatWindow({ sessionId: propSessionId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [sessionId, setSessionId] = useState(propSessionId || null);
  const [loading, setLoading] = useState(true);
  const API = "https://ai-project-assistant-backend.onrender.com";
  const recognitionRef = useRef(null);
  const chatBoxRef = useRef(null);

  // --- autoscroll ---
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  // --- microphone setup ---
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
      recog.onerror = () => setListening(false);
      recog.onend = () => setListening(false);

      recognitionRef.current = recog;
    }
  }, []);

  // --- create or load session id ---
  useEffect(() => {
    // priority: propSessionId (passed in) > localStorage > create new
    async function ensureSession() {
      try {
        // if parent passed a sessionId, use it and persist locally
        if (propSessionId) {
          localStorage.setItem("session_id", propSessionId);
          setSessionId(propSessionId);
          return;
        }

        const stored = localStorage.getItem("session_id");
        if (stored) {
          setSessionId(stored);
          return;
        }

        // create new session
        const res = await fetch(`${API}/api/new_session`, {
          method: "POST",
        });
        const json = await res.json();
        if (json.session_id) {
          localStorage.setItem("session_id", json.session_id);
          setSessionId(json.session_id);
        } else {
          console.error("Failed to create session", json);
          alert("Failed to create session. Check backend.");
        }
      } catch (err) {
        console.error("Session creation error:", err);
        alert("Could not create session. Check network or backend.");
      }
    }

    ensureSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propSessionId]);

  // --- load history when sessionId available ---
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`${API}/api/history/${sessionId}`);
        const data = await res.json();

        if (cancelled) return;

        if (Array.isArray(data)) {
          setMessages(
            data.map((m) => ({
              from: m.role === "assistant" ? "ai" : "user",
              text: m.content,
            }))
          );
        } else {
          console.error("Unexpected history response:", data);
        }
      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // --- send message ---
  const sendMessage = async () => {
    if (!input.trim()) return;
    if (!sessionId) {
      alert("Session not ready yet — try again in a moment.");
      return;
    }

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { from: "user", text: userMessage }]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, session_id: sessionId }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { from: "ai", text: data.reply }]);
      } else {
        console.error("Chat API returned error:", data);
        setMessages((prev) => [
          ...prev,
          { from: "ai", text: "Error: " + (data.error || "Unknown error") },
        ]);
      }
    } catch (err) {
      console.error("Chat request failed:", err);
      setMessages((prev) => [
        ...prev,
        { from: "ai", text: "Network error — couldn't reach backend." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // --- file upload handler ---
  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();

    setMessages((prev) => [
      ...prev,
      { from: "user", text: `📄 Uploaded file: ${file.name}` },
    ]);

    setIsTyping(true);

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `User uploaded file: ${file.name}\n\n${text}`,
          session_id: sessionId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { from: "ai", text: data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { from: "ai", text: "Error: " + (data.error || "Unknown error") },
        ]);
      }
    } catch (err) {
      console.error("File upload chat error:", err);
      setMessages((prev) => [
        ...prev,
        { from: "ai", text: "Network error — couldn't reach backend." },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  // --- toggle microphone ---
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
        {loading && <div style={{ padding: 12 }}>Loading chat...</div>}

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

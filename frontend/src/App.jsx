import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import "./App.css";

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const API = "https://ai-project-assistant-backend.onrender.com";

  // ---- load last session instead of creating a new one ----
  async function loadOrCreateSession() {
    let stored = localStorage.getItem("session_id");

    // If a session already exists → use it
    if (stored) {
      setSessionId(stored);
      return;
    }

    // Otherwise create a new one
    const res = await fetch(`${API}/api/new_session`, { method: "POST" });
    const data = await res.json();

    setSessionId(data.session_id);
    localStorage.setItem("session_id", data.session_id);
  }

  useEffect(() => {
    loadOrCreateSession();
  }, []);

  // ---- when clicking + New Chat ----
  async function createSession() {
    const res = await fetch(`${API}/api/new_session`, { method: "POST" });
    const data = await res.json();

    setSessionId(data.session_id);
    localStorage.setItem("session_id", data.session_id); // save new session
  }

  return (
    <div style={{ display: "flex" }}>
      <Sidebar
        sessionId={sessionId}
        onSelect={(id) => {
          setSessionId(id);
          localStorage.setItem("session_id", id); // save selected session
        }}
        onNewChat={createSession}
      />
      <ChatWindow sessionId={sessionId} />
    </div>
  );
}

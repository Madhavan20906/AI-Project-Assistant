import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import "./App.css";

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const API = "https://ai-project-assistant-backend.onrender.com";

  async function createSession() {
    const res = await fetch(`${API}/api/new_session`, { method: "POST" });
    const data = await res.json();
    setSessionId(data.session_id);
  }

  useEffect(() => {
    createSession();
  }, []);

  return (
    <div style={{ display: "flex" }}>
      <Sidebar
        sessionId={sessionId}
        onSelect={(id) => setSessionId(id)}
        onNewChat={createSession}
      />
      <ChatWindow sessionId={sessionId} />
    </div>
  );
}

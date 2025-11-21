import React, { useEffect, useState } from "react";

export default function Sidebar({ sessionId, onSelect, onNewChat }) {
  const [sessions, setSessions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [newTitle, setNewTitle] = useState("");

  const API = "https://ai-project-assistant-backend.onrender.com";


  function loadSessions() {
    fetch(`${API}/api/sessions`)
      .then((res) => res.json())
      .then(setSessions);
  }

  useEffect(() => {
    loadSessions();
  }, []);

  async function renameSession(id) {
    if (!newTitle.trim()) return;

    await fetch(`${API}/api/rename_session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: id, title: newTitle }),
    });

    setEditingId(null);
    setNewTitle("");
    loadSessions();
  }

  async function deleteSession(id) {
    await fetch(`${API}/api/delete_session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: id }),
    });

    loadSessions();
    onNewChat();
  }

  return (
    <div
      style={{
        width: 230,
        background: "#202020",
        color: "white",
        height: "100vh",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        overflowY: "auto",
      }}
    >
      <button
        style={{
          padding: "10px",
          background: "#333",
          borderRadius: "6px",
          border: "none",
          color: "white",
          cursor: "pointer",
        }}
        onClick={onNewChat}
      >
        + New Chat
      </button>

      {sessions.map((s) => (
        <div
          key={s.id}
          style={{
            padding: "10px",
            borderRadius: "6px",
            background: s.id === sessionId ? "#444" : "#2a2a2a",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          onClick={() => editingId === null && onSelect(s.id)}
        >
          {editingId === s.id ? (
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && renameSession(s.id)}
              style={{
                flex: 1,
                marginRight: 8,
                padding: "4px",
                borderRadius: "4px",
                border: "none",
                outline: "none",
              }}
            />
          ) : (
            <span>{s.title}</span>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            {editingId === s.id ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  renameSession(s.id);
                }}
                style={{ cursor: "pointer", color: "#0f0" }}
              >
                ✔
              </span>
            ) : (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(s.id);
                  setNewTitle(s.title);
                }}
                style={{ cursor: "pointer" }}
              >
                🖊️
              </span>
            )}

            <span
              onClick={(e) => {
                e.stopPropagation();
                deleteSession(s.id);
              }}
              style={{ cursor: "pointer", color: "white" }}
            >
              🗑
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

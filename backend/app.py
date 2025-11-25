import os
import sqlite3
import uuid
import datetime
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load .env file
load_dotenv()

import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# -------------------------------------
# CONFIGURE GEMINI
# -------------------------------------
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_KEY:
    print("ERROR: GEMINI_API_KEY not found in backend/.env")
else:
    genai.configure(api_key=GEMINI_KEY)

# -------------------------------------
# DATABASE (SQLite)
# -------------------------------------
DB_FILE = "chat_history.db"


def get_conn():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            title TEXT,
            created_at TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            role TEXT,
            content TEXT,
            timestamp TEXT
        )
    """)

    conn.commit()
    conn.close()


init_db()

# -------------------------------------
# HELPER — Auto Title
# -------------------------------------
def make_crisp_title(text):
    if not text:
        return "New Chat"
    words = text.strip().split()
    short = " ".join(words[:4])
    return short.capitalize()


# -------------------------------------
# Create new session
# -------------------------------------
@app.route("/api/new_session", methods=["POST"])
def new_session():
    session_id = str(uuid.uuid4())
    created_at = datetime.datetime.utcnow().isoformat()

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO sessions (id, title, created_at) VALUES (?, ?, ?)",
        (session_id, "Untitled", created_at),
    )
    conn.commit()
    conn.close()

    return jsonify({"session_id": session_id})


# -------------------------------------
# Get all sessions
# -------------------------------------
@app.route("/api/sessions", methods=["GET"])
def get_sessions():
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT id, title FROM sessions ORDER BY created_at DESC")
        rows = cur.fetchall()
        conn.close()

        return jsonify([{"id": r["id"], "title": r["title"]} for r in rows])

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# -------------------------------------
# Rename session
# -------------------------------------
@app.route("/api/rename_session", methods=["POST"])
def rename_session():
    data = request.json
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        "UPDATE sessions SET title=? WHERE id=?",
        (data["title"], data["session_id"]),
    )

    conn.commit()
    conn.close()

    return jsonify({"ok": True})


# -------------------------------------
# Delete session
# -------------------------------------
@app.route("/api/delete_session", methods=["POST"])
def delete_session():
    data = request.json

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("DELETE FROM messages WHERE session_id=?", (data["session_id"],))
    cur.execute("DELETE FROM sessions WHERE id=?", (data["session_id"],))

    conn.commit()
    conn.close()

    return jsonify({"ok": True})


# -------------------------------------
# Get chat history
# -------------------------------------
@app.route("/api/history/<session_id>", methods=["GET"])
def get_history(session_id):
    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute(
            "SELECT role, content FROM messages WHERE session_id=? ORDER BY id ASC",
            (session_id,),
        )

        rows = cur.fetchall()
        conn.close()

        return jsonify([{"role": r["role"], "content": r["content"]} for r in rows])

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# -------------------------------------
# Chat endpoint (with memory)
# -------------------------------------
@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    session_id = data.get("session_id")
    message = data.get("message")

    if not session_id or not message:
        return jsonify({"error": "session_id and message required"}), 400

    timestamp = datetime.datetime.utcnow().isoformat()

    try:
        # Store user message
        conn = get_conn()
        cur = conn.cursor()

        cur.execute(
            "INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
            (session_id, "user", message, timestamp),
        )
        conn.commit()
        conn.close()

        # Auto-generate crisp title
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("SELECT title FROM sessions WHERE id=?", (session_id,))
        row = cur.fetchone()
        current_title = row["title"] if row else None

        if current_title == "Untitled":
            crisp = make_crisp_title(message)
            cur.execute("UPDATE sessions SET title=? WHERE id=?", (crisp, session_id))
            conn.commit()

        conn.close()

        # Check Gemini key
        if not GEMINI_KEY:
            return jsonify({"error": "Gemini API key missing"}), 500

        # Retrieve conversation for AI memory
        conn = get_conn()
        cur = conn.cursor()

        cur.execute(
            "SELECT role, content FROM messages WHERE session_id=? ORDER BY id ASC",
            (session_id,),
        )

        history_rows = cur.fetchall()
        conn.close()

        conversation = [
            {"role": row["role"], "parts": row["content"]} for row in history_rows
        ]

        # Call Gemini
        model = genai.GenerativeModel("models/gemini-2.5-flash-lite")

        try:
            response = model.generate_content(conversation)
            reply = getattr(response, "text", None)

            if not reply and hasattr(response, "candidates"):
                reply = response.candidates[0].output

            if not reply:
                reply = str(response)

        except Exception as gen_err:
            traceback.print_exc()
            return jsonify({"error": "Gemini failed: " + str(gen_err)}), 500

        # Store assistant reply
        conn = get_conn()
        cur = conn.cursor()

        cur.execute(
            "INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
            (session_id, "assistant", reply, timestamp),
        )

        conn.commit()
        conn.close()

        return jsonify({"reply": reply})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# -------------------------------------
# Root
# -------------------------------------
@app.route("/")
def home():
    return "Backend running (Gemini version)"


if __name__ == "__main__":
    app.run(debug=True)

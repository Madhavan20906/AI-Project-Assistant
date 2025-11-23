import sqlite3

# Create or open chat_history.db
conn = sqlite3.connect("chat_history.db")
cur = conn.cursor()

# Create sessions table
cur.execute("""
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at TEXT
)
""")

# Create messages table
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

print("SQLite database initialized successfully.")

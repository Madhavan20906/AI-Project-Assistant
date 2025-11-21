import sqlite3

DB_FILE = "chat_history.db"
conn = sqlite3.connect(DB_FILE)
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

print("Database created/verified:", DB_FILE)

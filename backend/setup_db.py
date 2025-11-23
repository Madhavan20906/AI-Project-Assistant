"""
One-time DB setup script for Postgres (Neon).
Run this once locally (or on the server) after you set DATABASE_URL in .env:
    python backend/setup_db.py
"""
import os
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:xxxxxx@ep-billowing-mountain-a47dkcpi-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
)

def create_tables():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at TEXT
    );
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        session_id TEXT,
        role TEXT,
        content TEXT,
        timestamp TEXT
    );
    """)
    conn.commit()
    cur.close()
    conn.close()
    print("Tables created or verified.")

if __name__ == "__main__":
    create_tables()

"""SQLite: suhbat tarixi, mijoz arizalari (lead) va kontent qoralamalari."""

import json
import os
import sqlite3
import threading
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(channel, user_id, id);

CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    contact TEXT NOT NULL,
    service TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Storage:
    def __init__(self, path: str):
        if path != ":memory:":
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._conn.executescript(SCHEMA)

    def _exec(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        with self._lock:
            cur = self._conn.execute(sql, params)
            self._conn.commit()
            return cur

    # --- suhbat tarixi ---
    def add_message(self, channel: str, user_id: str, role: str, text: str) -> None:
        self._exec(
            "INSERT INTO messages(channel, user_id, role, text, created_at) VALUES (?,?,?,?,?)",
            (channel, user_id, role, text, _now()),
        )

    def history(self, channel: str, user_id: str, limit: int = 20) -> list[dict]:
        rows = self._exec(
            "SELECT role, text FROM messages WHERE channel=? AND user_id=? ORDER BY id DESC LIMIT ?",
            (channel, user_id, limit),
        ).fetchall()
        history = [{"role": r["role"], "content": r["text"]} for r in reversed(rows)]
        # Claude tarixi "user" xabari bilan boshlanishi kerak
        while history and history[0]["role"] != "user":
            history.pop(0)
        return history

    # --- arizalar ---
    def add_lead(self, channel: str, user_id: str, name: str, contact: str, service: str, details: str) -> int:
        cur = self._exec(
            "INSERT INTO leads(channel, user_id, name, contact, service, details, created_at) VALUES (?,?,?,?,?,?,?)",
            (channel, user_id, name, contact, service, details, _now()),
        )
        return cur.lastrowid

    def recent_leads(self, limit: int = 20) -> list[dict]:
        rows = self._exec("SELECT * FROM leads ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]

    # --- kontent qoralamalari ---
    def add_draft(self, platform: str, title: str, body: str) -> int:
        cur = self._exec(
            "INSERT INTO drafts(platform, title, body, created_at) VALUES (?,?,?,?)",
            (platform, title, body, _now()),
        )
        return cur.lastrowid

    def recent_drafts(self, limit: int = 10) -> list[dict]:
        rows = self._exec("SELECT * FROM drafts ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]

    def stats_json(self) -> str:
        leads = self._exec("SELECT COUNT(*) FROM leads").fetchone()[0]
        drafts = self._exec("SELECT COUNT(*) FROM drafts").fetchone()[0]
        users = self._exec("SELECT COUNT(DISTINCT channel || ':' || user_id) FROM messages").fetchone()[0]
        return json.dumps({"leads": leads, "drafts": drafts, "unique_users": users})

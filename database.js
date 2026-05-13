const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'stardc.db'));

// WAL mode for better concurrent reads
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder TEXT DEFAULT 'General',
    name TEXT NOT NULL,
    client_name TEXT DEFAULT '',
    client_phone TEXT DEFAULT '',
    sale_price TEXT DEFAULT '',
    work_hours TEXT DEFAULT '',
    host TEXT DEFAULT '',
    features TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  INSERT OR IGNORE INTO sync_meta (key, value) VALUES ('last_update', datetime('now'));
`);

module.exports = db;

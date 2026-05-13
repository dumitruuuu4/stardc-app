const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const DB_PATH = path.join(__dirname, 'data', 'stardc.db');
let db;

async function initDB() {
  const SQL = await initSqlJs();

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now')),
      completed_at DATETIME
    )
  `);
  db.run(`
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
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  db.run(`INSERT OR IGNORE INTO sync_meta (key, value) VALUES ('last_update', datetime('now'))`);
  saveDB();
}

function saveDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function touchUpdate() {
  db.run("UPDATE sync_meta SET value = datetime('now') WHERE key = 'last_update'");
  saveDB();
}

function runGet(query, params) {
  const stmt = db.prepare(query);
  if (params) stmt.bind(params);
  if (stmt.step()) return stmt.getAsObject();
  return null;
}

function runAll(query, params) {
  const results = [];
  const stmt = db.prepare(query);
  if (params) stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// ===== GOALS API =====
app.get('/api/goals', (req, res) => {
  const goals = runAll('SELECT * FROM goals ORDER BY completed ASC, created_at DESC');
  res.json(goals);
});

app.post('/api/goals', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  db.run('INSERT INTO goals (text) VALUES (?)', [text]);
  const row = runGet('SELECT last_insert_rowid() as id');
  touchUpdate();
  res.json({ id: row['last_insert_rowid()'] || row.id, text, completed: 0 });
});

app.put('/api/goals/:id', (req, res) => {
  const { completed } = req.body;
  const id = parseInt(req.params.id);
  if (completed) {
    db.run('UPDATE goals SET completed = 1, completed_at = datetime(\'now\') WHERE id = ?', [id]);
  } else {
    db.run('UPDATE goals SET completed = 0, completed_at = NULL WHERE id = ?', [id]);
  }
  touchUpdate();
  res.json({ success: true });
});

app.delete('/api/goals/:id', (req, res) => {
  db.run('DELETE FROM goals WHERE id = ?', [parseInt(req.params.id)]);
  touchUpdate();
  res.json({ success: true });
});

// ===== PROJECTS API =====
app.get('/api/projects', (req, res) => {
  const projects = runAll('SELECT * FROM projects ORDER BY updated_at DESC');
  res.json(projects);
});

app.post('/api/projects', (req, res) => {
  const { folder, name, client_name, client_phone, sale_price, work_hours, host, features } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  db.run(
    'INSERT INTO projects (folder, name, client_name, client_phone, sale_price, work_hours, host, features) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [folder || 'General', name, client_name || '', client_phone || '', sale_price || '', work_hours || '', host || '', features || '']
  );
  touchUpdate();
  res.json({ success: true });
});

app.put('/api/projects/:id', (req, res) => {
  const fields = req.body;
  const allowed = ['folder', 'name', 'client_name', 'client_phone', 'sale_price', 'work_hours', 'host', 'features', 'status'];
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No valid fields' });
  sets.push("updated_at = datetime('now')");
  values.push(parseInt(req.params.id));
  db.run(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, values);
  touchUpdate();
  res.json({ success: true });
});

app.delete('/api/projects/:id', (req, res) => {
  db.run('DELETE FROM projects WHERE id = ?', [parseInt(req.params.id)]);
  touchUpdate();
  res.json({ success: true });
});

// ===== SYNC CHECK =====
app.get('/api/sync', (req, res) => {
  const row = runGet("SELECT value FROM sync_meta WHERE key = 'last_update'");
  res.json({ last_update: row ? row.value : null });
});

// ===== FOLDERS =====
app.get('/api/folders', (req, res) => {
  const folders = runAll('SELECT DISTINCT folder FROM projects ORDER BY folder');
  res.json(folders.map(f => f.folder));
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`StarDC App running on port ${PORT}`);
  });
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});

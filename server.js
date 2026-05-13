const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Touch last update
function touchUpdate() {
  db.prepare("UPDATE sync_meta SET value = datetime('now') WHERE key = 'last_update'").run();
}

// ===== GOALS API =====
app.get('/api/goals', (req, res) => {
  const goals = db.prepare('SELECT * FROM goals ORDER BY completed ASC, created_at DESC').all();
  res.json(goals);
});

app.post('/api/goals', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  const result = db.prepare('INSERT INTO goals (text) VALUES (?)').run(text);
  touchUpdate();
  res.json({ id: result.lastInsertRowid, text, completed: 0 });
});

app.put('/api/goals/:id', (req, res) => {
  const { completed } = req.body;
  const completed_at = completed ? "datetime('now')" : 'NULL';
  db.prepare(`UPDATE goals SET completed = ?, completed_at = ${completed_at} WHERE id = ?`).run(completed ? 1 : 0, req.params.id);
  touchUpdate();
  res.json({ success: true });
});

app.delete('/api/goals/:id', (req, res) => {
  db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id);
  touchUpdate();
  res.json({ success: true });
});

// ===== PROJECTS API =====
app.get('/api/projects', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  res.json(projects);
});

app.post('/api/projects', (req, res) => {
  const { folder, name, client_name, client_phone, sale_price, work_hours, host, features } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare(`
    INSERT INTO projects (folder, name, client_name, client_phone, sale_price, work_hours, host, features)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(folder || 'General', name, client_name || '', client_phone || '', sale_price || '', work_hours || '', host || '', features || '');
  touchUpdate();
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/projects/:id', (req, res) => {
  const fields = req.body;
  const allowed = ['folder', 'name', 'client_name', 'client_phone', 'sale_price', 'work_hours', 'host', 'features', 'status'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields' });
  updates.push("updated_at = datetime('now')");
  values.push(req.params.id);
  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  touchUpdate();
  res.json({ success: true });
});

app.delete('/api/projects/:id', (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  touchUpdate();
  res.json({ success: true });
});

// ===== SYNC CHECK =====
app.get('/api/sync', (req, res) => {
  const row = db.prepare("SELECT value FROM sync_meta WHERE key = 'last_update'").get();
  res.json({ last_update: row?.value });
});

// ===== FOLDERS =====
app.get('/api/folders', (req, res) => {
  const folders = db.prepare('SELECT DISTINCT folder FROM projects ORDER BY folder').all();
  res.json(folders.map(f => f.folder));
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`StarDC App running on port ${PORT}`);
});

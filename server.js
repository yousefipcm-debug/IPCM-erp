require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ipcm_secret_change_in_production_please';

// Data directory (persists the SQLite database)
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Database setup
const db = new Database(path.join(dataDir, 'ipcm.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','finance','hr','technique')),
    display_name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kv_data (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Create default accounts on first run
const count = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
if (count === 0) {
  const seed = [
    { username: 'admin',     password: 'Admin2024!',    role: 'admin',     display_name: 'Administrateur' },
    { username: 'finance',   password: 'Finance2024!',  role: 'finance',   display_name: 'Responsable DFC' },
    { username: 'rh',        password: 'RH2024!',       role: 'hr',        display_name: 'Responsable RH' },
    { username: 'technique', password: 'Tech2024!',     role: 'technique', display_name: 'Responsable Technique' },
  ];
  const insert = db.prepare('INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)');
  for (const u of seed) {
    insert.run(u.username, bcrypt.hashSync(u.password, 10), u.role, u.display_name);
  }
  console.log('=== Comptes par défaut créés ===');
  console.log('admin     / Admin2024!');
  console.log('finance   / Finance2024!');
  console.log('rh        / RH2024!');
  console.log('technique / Tech2024!');
  console.log('================================');
}

// Role → data keys they can read/write
const ROLE_KEYS = {
  finance:   ['transactions','situations','charges','fournisseurs','clientNames','fournisseurNames','projects','simPicks','simCustomAmounts','invoices','ribList','clientDetails'],
  hr:        ['workers','workSites','hrDocuments','hrFolders','adminPointage'],
  technique: ['techWorkSites','workSites'],
  admin:     ['transactions','situations','charges','fournisseurs','clientNames','fournisseurNames','projects','simPicks','simCustomAmounts','invoices','ribList','clientDetails','workers','workSites','hrDocuments','hrFolders','adminPointage','techWorkSites']
};

app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname, { index: 'index.html' }));

// ── Middleware ─────────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès réservé à l\'administrateur' });
  next();
}

// ── Auth ───────────────────────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Identifiants manquants' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, display_name: user.display_name },
    JWT_SECRET,
    { expiresIn: '10h' }
  );

  res.json({
    token,
    role: user.role,
    display_name: user.display_name,
    allowed_keys: ROLE_KEYS[user.role] || []
  });
});

app.post('/api/logout', (req, res) => res.json({ ok: true }));

// ── Data ───────────────────────────────────────────────────────────────────────

// GET all data for this role
app.get('/api/data', requireAuth, (req, res) => {
  const keys = ROLE_KEYS[req.user.role] || [];
  const result = {};
  const stmt = db.prepare('SELECT value FROM kv_data WHERE key = ?');
  for (const k of keys) {
    const row = stmt.get(k);
    try { result[k] = row ? JSON.parse(row.value) : null; }
    catch { result[k] = null; }
  }
  res.json(result);
});

// POST (save) a single key
app.post('/api/data/:key', requireAuth, (req, res) => {
  const { key } = req.params;
  const allowed = ROLE_KEYS[req.user.role] || [];
  if (!allowed.includes(key)) return res.status(403).json({ error: 'Clé non autorisée pour ce rôle' });

  const value = JSON.stringify(req.body.value ?? null);
  db.prepare('INSERT OR REPLACE INTO kv_data (key, value, updated_at) VALUES (?, ?, datetime("now"))').run(key, value);
  res.json({ ok: true });
});

// ── User Management (admin only) ───────────────────────────────────────────────

app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role, display_name, created_at FROM users ORDER BY id').all();
  res.json(users);
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role, display_name } = req.body || {};
  if (!username || !password || !role || !display_name) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }
  if (!ROLE_KEYS[role]) return res.status(400).json({ error: 'Rôle invalide' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (min 6 caractères)' });

  try {
    const r = db.prepare('INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)').run(
      username.trim().toLowerCase(),
      bcrypt.hashSync(password, 10),
      role,
      display_name.trim()
    );
    res.json({ id: r.lastInsertRowid, username, role, display_name });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { password, role, display_name } = req.body || {};

  if (role && !ROLE_KEYS[role]) return res.status(400).json({ error: 'Rôle invalide' });
  if (password && password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court' });

  if (password) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), id);
  if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  if (display_name) db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(display_name.trim(), id);

  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ── Start ──────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`IPCM ERP démarré → http://localhost:${PORT}`);
});

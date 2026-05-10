require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ipcm_secret_change_in_production_please';

// ── Storage: PostgreSQL if available, in-memory otherwise ─────────────────────

let db; // will be set to either pgDB or memDB

// ── In-memory fallback store ──────────────────────────────────────────────────
function buildMemDB() {
  const seed = [
    { id: 1, username: 'admin',     password_hash: bcrypt.hashSync('Admin2024!', 10),    role: 'admin',     display_name: 'Administrateur' },
    { id: 2, username: 'finance',   password_hash: bcrypt.hashSync('Finance2024!', 10),  role: 'finance',   display_name: 'Responsable DFC' },
    { id: 3, username: 'rh',        password_hash: bcrypt.hashSync('RH2024!', 10),       role: 'hr',        display_name: 'Responsable RH' },
    { id: 4, username: 'technique', password_hash: bcrypt.hashSync('Tech2024!', 10),     role: 'technique', display_name: 'Responsable Technique' },
  ];
  let nextId = 5;
  const users = [...seed];
  const kv = {};

  return {
    type: 'memory',
    getUserByUsername: (username) => users.find(u => u.username === username) || null,
    getUserById: (id) => users.find(u => u.id === id) || null,
    getAllUsers: () => users.map(({ password_hash, ...u }) => u),
    createUser: ({ username, password_hash, role, display_name }) => {
      if (users.find(u => u.username === username)) throw new Error('duplicate');
      const user = { id: nextId++, username, password_hash, role, display_name, created_at: new Date().toISOString() };
      users.push(user);
      return user;
    },
    updateUser: (id, fields) => {
      const u = users.find(u => u.id === id);
      if (u) Object.assign(u, fields);
    },
    deleteUser: (id) => { const i = users.findIndex(u => u.id === id); if (i !== -1) users.splice(i, 1); },
    getData: (keys) => {
      const result = {};
      for (const k of keys) result[k] = kv[k] !== undefined ? kv[k] : null;
      return result;
    },
    setData: (key, value) => { kv[key] = value; },
  };
}

// ── PostgreSQL store ───────────────────────────────────────────────────────────
async function buildPgDB() {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','finance','hr','technique')),
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS kv_data (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*) AS n FROM users');
  if (parseInt(rows[0].n) === 0) {
    const seed = [
      { username: 'admin',     password: 'Admin2024!',    role: 'admin',     display_name: 'Administrateur' },
      { username: 'finance',   password: 'Finance2024!',  role: 'finance',   display_name: 'Responsable DFC' },
      { username: 'rh',        password: 'RH2024!',       role: 'hr',        display_name: 'Responsable RH' },
      { username: 'technique', password: 'Tech2024!',     role: 'technique', display_name: 'Responsable Technique' },
    ];
    for (const u of seed) {
      await pool.query(
        'INSERT INTO users (username, password_hash, role, display_name) VALUES ($1, $2, $3, $4)',
        [u.username, bcrypt.hashSync(u.password, 10), u.role, u.display_name]
      );
    }
    console.log('Default accounts created.');
  }

  return {
    type: 'postgres',
    getUserByUsername: async (username) => {
      const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      return rows[0] || null;
    },
    getUserById: async (id) => {
      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return rows[0] || null;
    },
    getAllUsers: async () => {
      const { rows } = await pool.query('SELECT id, username, role, display_name, created_at FROM users ORDER BY id');
      return rows;
    },
    createUser: async ({ username, password_hash, role, display_name }) => {
      try {
        const { rows } = await pool.query(
          'INSERT INTO users (username, password_hash, role, display_name) VALUES ($1, $2, $3, $4) RETURNING id',
          [username, password_hash, role, display_name]
        );
        return { id: rows[0].id, username, role, display_name };
      } catch (e) {
        if (e.message.includes('unique') || e.message.includes('duplicate')) throw new Error('duplicate');
        throw e;
      }
    },
    updateUser: async (id, fields) => {
      if (fields.password_hash) await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [fields.password_hash, id]);
      if (fields.role)          await pool.query('UPDATE users SET role = $1 WHERE id = $2', [fields.role, id]);
      if (fields.display_name)  await pool.query('UPDATE users SET display_name = $1 WHERE id = $2', [fields.display_name.trim(), id]);
    },
    deleteUser: async (id) => { await pool.query('DELETE FROM users WHERE id = $1', [id]); },
    getData: async (keys) => {
      if (keys.length === 0) return {};
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
      const { rows } = await pool.query(`SELECT key, value FROM kv_data WHERE key IN (${placeholders})`, keys);
      const rowMap = {};
      rows.forEach(r => { rowMap[r.key] = r.value; });
      const result = {};
      for (const k of keys) {
        try { result[k] = rowMap[k] ? JSON.parse(rowMap[k]) : null; } catch { result[k] = null; }
      }
      return result;
    },
    setData: async (key, value) => {
      await pool.query(
        'INSERT INTO kv_data (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()',
        [key, JSON.stringify(value)]
      );
    },
  };
}

// ── Role config ────────────────────────────────────────────────────────────────
const ROLE_KEYS = {
  finance:   ['transactions','situations','charges','fournisseurs','clientNames','fournisseurNames','projects','simPicks','simCustomAmounts','invoices','ribList','clientDetails'],
  hr:        ['workers','workSites','hrDocuments','hrFolders','adminPointage'],
  technique: ['techWorkSites','workSites'],
  admin:     ['transactions','situations','charges','fournisseurs','clientNames','fournisseurNames','projects','simPicks','simCustomAmounts','invoices','ribList','clientDetails','workers','workSites','hrDocuments','hrFolders','adminPointage','techWorkSites','adminPtgLegend']
};

app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname, { index: 'index.html' }));

// ── Middleware ─────────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' }); }
}
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: "Accès réservé à l'administrateur" });
  next();
}

// ── Auth ───────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Identifiants manquants' });
  try {
    const user = await db.getUserByUsername(username.trim().toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: "Nom d'utilisateur ou mot de passe incorrect" });
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, display_name: user.display_name },
      JWT_SECRET, { expiresIn: '10h' }
    );
    res.json({ token, role: user.role, display_name: user.display_name, allowed_keys: ROLE_KEYS[user.role] || [] });
  } catch (e) { console.error('Login error:', e); res.status(500).json({ error: 'Erreur serveur' }); }
});

app.post('/api/logout', (req, res) => res.json({ ok: true }));

// ── Data ───────────────────────────────────────────────────────────────────────
app.get('/api/data', requireAuth, async (req, res) => {
  try {
    const keys = ROLE_KEYS[req.user.role] || [];
    res.json(await db.getData(keys));
  } catch (e) { console.error('GET /api/data:', e); res.status(500).json({ error: 'Erreur serveur' }); }
});

app.post('/api/data/:key', requireAuth, async (req, res) => {
  const { key } = req.params;
  const allowed = ROLE_KEYS[req.user.role] || [];
  if (!allowed.includes(key)) return res.status(403).json({ error: 'Clé non autorisée pour ce rôle' });
  try {
    await db.setData(key, req.body.value ?? null);
    res.json({ ok: true });
  } catch (e) { console.error(`POST /api/data/${key}:`, e); res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── Users ──────────────────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try { res.json(await db.getAllUsers()); }
  catch (e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, role, display_name } = req.body || {};
  if (!username || !password || !role || !display_name)
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  if (!ROLE_KEYS[role]) return res.status(400).json({ error: 'Rôle invalide' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (min 6 caractères)' });
  try {
    const user = await db.createUser({ username: username.trim().toLowerCase(), password_hash: bcrypt.hashSync(password, 10), role, display_name: display_name.trim() });
    res.json(user);
  } catch (e) {
    if (e.message === 'duplicate') return res.status(400).json({ error: "Ce nom d'utilisateur existe déjà" });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { password, role, display_name } = req.body || {};
  if (role && !ROLE_KEYS[role]) return res.status(400).json({ error: 'Rôle invalide' });
  if (password && password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court' });
  try {
    const fields = {};
    if (password)     fields.password_hash = bcrypt.hashSync(password, 10);
    if (role)         fields.role = role;
    if (display_name) fields.display_name = display_name;
    await db.updateUser(id, fields);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
  try { await db.deleteUser(id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: db ? db.type : 'starting',
    persistent: db ? db.type === 'postgres' : false,
    database_url_set: !!process.env.DATABASE_URL
  });
});

// ── Boot ───────────────────────────────────────────────────────────────────────
async function start() {
  if (process.env.DATABASE_URL) {
    try {
      console.log('Connecting to PostgreSQL...');
      db = await buildPgDB();
      console.log('PostgreSQL connected — data will persist.');
    } catch (e) {
      console.error('PostgreSQL FAILED:', e.message);
      console.warn('Falling back to in-memory store — DATA WILL BE LOST ON RESTART.');
      db = buildMemDB();
    }
  } else {
    console.error('NO DATABASE_URL SET — using in-memory store. DATA WILL BE LOST ON EVERY DEPLOY.');
    db = buildMemDB();
  }

  app.listen(PORT, () => console.log(`IPCM ERP running on port ${PORT} [${db.type}]`));
}

start();

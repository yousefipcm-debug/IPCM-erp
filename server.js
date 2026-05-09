require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ipcm_secret_change_in_production_please';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
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
    console.log('=== Comptes par défaut créés ===');
    console.log('admin     / Admin2024!');
    console.log('finance   / Finance2024!');
    console.log('rh        / RH2024!');
    console.log('technique / Tech2024!');
    console.log('================================');
  }
}

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
  if (req.user.role !== 'admin') return res.status(403).json({ error: "Accès réservé à l'administrateur" });
  next();
}

// ── Auth ───────────────────────────────────────────────────────────────────────

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Identifiants manquants' });

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim().toLowerCase()]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Nom d'utilisateur ou mot de passe incorrect" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, display_name: user.display_name },
      JWT_SECRET,
      { expiresIn: '10h' }
    );

    res.json({ token, role: user.role, display_name: user.display_name, allowed_keys: ROLE_KEYS[user.role] || [] });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/logout', (req, res) => res.json({ ok: true }));

// ── Data ───────────────────────────────────────────────────────────────────────

app.get('/api/data', requireAuth, async (req, res) => {
  const keys = ROLE_KEYS[req.user.role] || [];
  if (keys.length === 0) return res.json({});

  try {
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const { rows } = await pool.query(`SELECT key, value FROM kv_data WHERE key IN (${placeholders})`, keys);
    const rowMap = {};
    rows.forEach(r => { rowMap[r.key] = r.value; });
    const result = {};
    for (const k of keys) {
      try { result[k] = rowMap[k] ? JSON.parse(rowMap[k]) : null; }
      catch { result[k] = null; }
    }
    res.json(result);
  } catch (e) {
    console.error('GET /api/data error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/data/:key', requireAuth, async (req, res) => {
  const { key } = req.params;
  const allowed = ROLE_KEYS[req.user.role] || [];
  if (!allowed.includes(key)) return res.status(403).json({ error: 'Clé non autorisée pour ce rôle' });

  const value = JSON.stringify(req.body.value ?? null);
  try {
    await pool.query(
      'INSERT INTO kv_data (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()',
      [key, value]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(`POST /api/data/${key} error:`, e);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── User Management (admin only) ───────────────────────────────────────────────

app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, username, role, display_name, created_at FROM users ORDER BY id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, role, display_name } = req.body || {};
  if (!username || !password || !role || !display_name)
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  if (!ROLE_KEYS[role]) return res.status(400).json({ error: 'Rôle invalide' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (min 6 caractères)' });

  try {
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash, role, display_name) VALUES ($1, $2, $3, $4) RETURNING id',
      [username.trim().toLowerCase(), bcrypt.hashSync(password, 10), role, display_name.trim()]
    );
    res.json({ id: rows[0].id, username, role, display_name });
  } catch (e) {
    if (e.message.includes('unique') || e.message.includes('duplicate')) {
      return res.status(400).json({ error: "Ce nom d'utilisateur existe déjà" });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { password, role, display_name } = req.body || {};
  if (role && !ROLE_KEYS[role]) return res.status(400).json({ error: 'Rôle invalide' });
  if (password && password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court' });

  try {
    if (password)      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [bcrypt.hashSync(password, 10), id]);
    if (role)          await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    if (display_name)  await pool.query('UPDATE users SET display_name = $1 WHERE id = $2', [display_name.trim(), id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Start ──────────────────────────────────────────────────────────────────────

initDB()
  .then(() => app.listen(PORT, () => console.log(`IPCM ERP démarré → http://localhost:${PORT}`)))
  .catch(e => { console.error('DB init failed:', e); process.exit(1); });

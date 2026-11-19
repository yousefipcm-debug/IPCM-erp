import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createPgStore, createMemoryStore, ConflictError, NotFoundError } from './db.js';
import { ROLES, canRead, canWrite, readableCollections, project } from './permissions.js';
import { runMigrationIfNeeded } from './migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;

// A secret baked into the code would let anyone who reads it forge a login.
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(48).toString('hex');
  console.warn('[security] JWT_SECRET is not set — using a random one. Everyone will be logged out on each restart. Set JWT_SECRET in Railway → Variables.');
}

let db = null;

// ───────────────────────────── App ─────────────────────────────
const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'connect-src': ["'self'"],
      'worker-src': ["'self'", 'blob:'],
      'font-src': ["'self'", 'data:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: '25mb' }));

const ready = (req, res, next) => (db ? next() : res.status(503).json({ error: 'Le serveur démarre, réessayez dans quelques secondes.' }));
app.use('/api', ready);

// ───────────────────────────── Auth ─────────────────────────────
const sign = (u) => jwt.sign({ id: u.id, username: u.username, role: u.role, name: u.display_name }, JWT_SECRET, { expiresIn: '12h' });

async function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'Non connecté' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserById(payload.id);
    if (!user || user.active === false) return res.status(401).json({ error: 'Compte désactivé' });
    req.user = { id: user.id, username: user.username, role: user.role, name: user.display_name };
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
  }
}
const requireAdmin = (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ error: "Réservé à l'administrateur" }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' } });

const publicUser = (u) => ({ id: u.id, username: u.username, role: u.role, name: u.display_name, mustChangePassword: !!u.must_change_password });

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  const user = await db.getUserByUsername(String(username).trim().toLowerCase());
  if (!user || !bcrypt.compareSync(String(password), user.password_hash))
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  if (user.active === false) return res.status(403).json({ error: 'Ce compte est désactivé' });
  await db.updateUser(user.id, { last_login: new Date() });
  await db.audit({ username: user.username, action: 'login' });
  res.json({ token: sign(user), user: publicUser(user) });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const u = await db.getUserById(req.user.id);
  res.json({ user: publicUser(u) });
});

app.post('/api/auth/password', requireAuth, async (req, res) => {
  const { current, next: nextPwd } = req.body || {};
  const u = await db.getUserById(req.user.id);
  if (!u || !bcrypt.compareSync(String(current || ''), u.password_hash)) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
  if (!nextPwd || String(nextPwd).length < 8) return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères' });
  await db.updateUser(u.id, { password_hash: bcrypt.hashSync(String(nextPwd), 10), must_change_password: false });
  await db.audit({ username: u.username, action: 'password_change' });
  res.json({ ok: true });
});

// ───────────────────────────── Data ─────────────────────────────
const outRecord = (role) => (r) => ({ ...r, data: r.deleted ? null : project(role, r.collection, r.data) });

// Full load + incremental sync use the same endpoint: ?since=<rev>
app.get('/api/sync', requireAuth, async (req, res) => {
  const since = Math.max(0, parseInt(req.query.since, 10) || 0);
  const cols = readableCollections(req.user.role);
  const [records, rev] = await Promise.all([db.listSince(cols, since), db.currentRev()]);
  res.json({ rev, full: since === 0, collections: cols, records: records.map(outRecord(req.user.role)) });
});

function labelOf(data) {
  if (!data) return null;
  return data.name || data.label || data.title || data.number || data.description || data.reference ||
    (data.lastName ? `${data.lastName} ${data.firstName || ''}`.trim() : null) ||
    (data.amount != null ? `${data.amount} DZD` : null);
}

// Atomic batch: [{op:'create'|'update'|'delete', collection, id?, data?, version?}]
app.post('/api/records', requireAuth, async (req, res) => {
  const ops = Array.isArray(req.body?.ops) ? req.body.ops : null;
  if (!ops || !ops.length || ops.length > 500) return res.status(400).json({ error: 'Requête invalide' });
  for (const op of ops) {
    if (!['create', 'update', 'delete'].includes(op.op)) return res.status(400).json({ error: 'Opération invalide' });
    if (!canWrite(req.user.role, op.collection)) return res.status(403).json({ error: `Accès refusé (${op.collection})` });
    if (op.op !== 'delete' && (typeof op.data !== 'object' || op.data === null || Array.isArray(op.data)))
      return res.status(400).json({ error: 'Données invalides' });
    if (op.op !== 'create' && !op.id) return res.status(400).json({ error: 'Identifiant manquant' });
  }
  try {
    const results = await db.apply(ops, req.user.username);
    for (let i = 0; i < ops.length; i++) {
      const r = results[i];
      if (r) db.audit({ username: req.user.username, action: ops[i].op, collection: ops[i].collection, recordId: r.id, label: labelOf(ops[i].data || r.data) });
    }
    res.json({ records: results.filter(Boolean).map(outRecord(req.user.role)) });
  } catch (e) {
    if (e instanceof ConflictError) {
      const cur = e.current;
      return res.status(409).json({ error: 'Cet élément a été modifié par quelqu’un d’autre entre-temps.', current: cur && canRead(req.user.role, cur.collection) ? outRecord(req.user.role)(cur) : null });
    }
    if (e instanceof NotFoundError) return res.status(404).json({ error: 'Cet élément a été supprimé entre-temps.' });
    console.error('[records]', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ───────────────────────────── Users (admin) ─────────────────────────────
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => res.json(await db.listUsers()));

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, role, name } = req.body || {};
  if (!username || !password || !role || !name) return res.status(400).json({ error: 'Tous les champs sont requis' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum' });
  if (!/^[a-z0-9._-]{3,32}$/.test(String(username).trim().toLowerCase())) return res.status(400).json({ error: 'Identifiant : 3 à 32 caractères (lettres, chiffres, . _ -)' });
  try {
    const u = await db.createUser({ username: String(username).trim().toLowerCase(), password_hash: bcrypt.hashSync(String(password), 10), role, display_name: String(name).trim(), must_change_password: true });
    await db.audit({ username: req.user.username, action: 'user_create', label: u.username });
    res.json(u);
  } catch (e) {
    if (e.message === 'duplicate') return res.status(400).json({ error: 'Cet identifiant existe déjà' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.patch('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { password, role, name, active } = req.body || {};
  if (role && !ROLES.includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  if (password && String(password).length < 8) return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum' });
  if (id === req.user.id && (active === false || (role && role !== 'admin')))
    return res.status(400).json({ error: 'Vous ne pouvez pas retirer vos propres droits administrateur' });
  const f = {};
  if (password) { f.password_hash = bcrypt.hashSync(String(password), 10); f.must_change_password = true; }
  if (role) f.role = role;
  if (name) f.display_name = String(name).trim();
  if (typeof active === 'boolean') f.active = active;
  await db.updateUser(id, f);
  await db.audit({ username: req.user.username, action: 'user_update', label: String(id) });
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
  await db.deleteUser(id);
  await db.audit({ username: req.user.username, action: 'user_delete', label: String(id) });
  res.json({ ok: true });
});

app.get('/api/audit', requireAuth, requireAdmin, async (req, res) => res.json(await db.listAudit(300)));

// ───────────────────────────── OCR ─────────────────────────────
const TESSDATA = path.join(__dirname, 'tessdata');
app.post('/api/ocr', requireAuth, async (req, res) => {
  try {
    const image = String(req.body?.image || '').replace(/^data:image\/\w+;base64,/, '');
    const buf = Buffer.from(image, 'base64');
    if (!buf.length) return res.status(400).json({ error: 'Image manquante' });
    if (buf.length > 15 * 1024 * 1024) return res.status(400).json({ error: 'Image trop volumineuse (15 Mo max)' });
    const { default: Tesseract } = await import('tesseract.js');
    const { data } = await Tesseract.recognize(buf, 'fra', { langPath: TESSDATA, cachePath: TESSDATA });
    res.json({ text: data.text || '', confidence: data.confidence || 0 });
  } catch (e) {
    console.error('[ocr]', e.message);
    res.status(500).json({ error: 'Lecture impossible. Réessayez avec une photo plus nette et bien éclairée.' });
  }
});

// ───────────────────────────── Health ─────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: db ? 'ok' : 'starting', storage: db?.type || null, persistent: db?.type === 'postgres' }));

// ───────────────────────────── Front end ─────────────────────────────
const DIST = path.join(ROOT, 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, maxAge: '1y', setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
  app.get(/^(?!\/api\/).*/, (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(DIST, 'index.html')); });
}
app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }));
app.use((err, req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.type === 'entity.too.large' ? 'Fichier trop volumineux' : 'Erreur serveur' });
});

// ───────────────────────────── Boot ─────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  if (!process.env.DATABASE_URL) {
    console.warn('[db] DATABASE_URL not set — using IN-MEMORY storage. Data is lost on restart. Development only.');
    return createMemoryStore();
  }
  const delays = [2000, 4000, 8000, 16000, 30000, 30000];
  for (let i = 0; ; i++) {
    try {
      const s = await createPgStore(process.env.DATABASE_URL);
      console.log('[db] PostgreSQL connected.');
      return s;
    } catch (e) {
      console.error(`[db] connection attempt ${i + 1} failed: ${e.message}`);
      if (i >= delays.length - 1) throw e;
      await sleep(delays[i]);
    }
  }
}

async function ensureFirstAdmin(store) {
  if ((await store.countUsers()) > 0) return;
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  await store.createUser({ username: 'admin', password_hash: bcrypt.hashSync(password, 10), role: 'admin', display_name: 'Administrateur', must_change_password: true });
  console.log('════════════════════════════════════════════════════');
  console.log(' First start: administrator account created');
  console.log('   username: admin');
  console.log(`   password: ${process.env.ADMIN_PASSWORD ? '(value of ADMIN_PASSWORD)' : password}`);
  console.log(' You will be asked to change it at first login.');
  console.log('════════════════════════════════════════════════════');
}

app.listen(PORT, () => console.log(`[ossature] listening on :${PORT}`));
(async () => {
  try {
    const store = await connect();
    await runMigrationIfNeeded(store);
    await ensureFirstAdmin(store);
    if (store.type === 'memory' && process.env.SEED_DEMO === '1') {
      const { seedDemo } = await import('./seed-demo.js');
      await seedDemo(store);
    }
    db = store;
    console.log(`[ossature] ready (${store.type})`);
  } catch (e) {
    console.error('[ossature] fatal: could not start storage', e);
    process.exit(1);
  }
})();

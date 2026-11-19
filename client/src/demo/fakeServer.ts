// In-browser copy of the OSSATURE API for the online demo (no server, no database).
// Same permissions and conflict rules as the real server; data stays in this browser.
// @ts-ignore — plain JS shared with the server
import { canRead, canWrite, readableCollections, project } from '../../../server/permissions.js';
// @ts-ignore
import { convertLegacy } from '../../../server/migrate.js';
import { legacySample } from './seed';

interface R { collection: string; id: string; data: any; version: number; rev: number; deleted: boolean; updatedAt: string; updatedBy: string }
interface DB { rev: number; records: R[]; users: any[]; audit: any[] }
const KEY = 'ossature-demo-db-v2';
export const DEMO_USERS = [
  { id: 1, username: 'admin', password: 'demo', role: 'admin', display_name: 'Youcef Boutema' },
  { id: 2, username: 'finance', password: 'demo', role: 'finance', display_name: 'Hakima' },
  { id: 3, username: 'rh', password: 'demo', role: 'hr', display_name: 'Radia' },
  { id: 4, username: 'cylia', password: 'demo', role: 'secretariat', display_name: 'Cylia' },
];

function fresh(): DB {
  const { records } = convertLegacy(legacySample());
  const now = new Date().toISOString();
  return {
    rev: records.length,
    records: records.map((r: any, i: number) => ({ ...r, version: 1, rev: i + 1, deleted: false, updatedAt: now, updatedBy: 'migration' })),
    users: DEMO_USERS.map((u) => ({ ...u, active: true, last_login: null, created_at: now, must_change_password: false })),
    audit: [{ id: 1, at: now, username: 'system', action: 'migration', label: `${records.length} enregistrements convertis` }],
  };
}
let db: DB = (() => { try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch { /* */ } return fresh(); })();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full or blocked */ } };
export function resetDemo() { db = fresh(); persist(); }

const err = (status: number, error: string, extra: any = {}) => ({ status, body: { error, ...extra } });
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const userOf = (token: string | null) => { const id = Number((token || '').replace('demo:', '')); return db.users.find((u) => u.id === id && u.active) || null; };
const pub = (u: any) => ({ id: u.id, username: u.username, role: u.role, name: u.display_name, mustChangePassword: !!u.must_change_password });
const out = (role: string) => (r: R) => ({ ...r, data: r.deleted ? null : project(role, r.collection, r.data) });
const audit = (username: string, action: string, collection?: string, label?: string) => { db.audit.unshift({ id: db.audit.length + 1, at: new Date().toISOString(), username, action, collection, label }); db.audit.length = Math.min(db.audit.length, 300); };

export async function handle(path: string, method: string, body: any, token: string | null): Promise<{ status: number; body: any }> {
  await new Promise((r) => setTimeout(r, 60));
  const [p, qs] = path.split('?');
  if (p === '/health') return { status: 200, body: { status: 'ok', storage: 'demo', persistent: false } };
  if (p === '/auth/login') {
    const u = db.users.find((x) => x.username === String(body?.username || '').toLowerCase());
    if (!u || u.password !== body?.password) return err(401, 'Identifiant ou mot de passe incorrect');
    if (!u.active) return err(403, 'Ce compte est désactivé');
    u.last_login = new Date().toISOString(); audit(u.username, 'login'); persist();
    return { status: 200, body: { token: 'demo:' + u.id, user: pub(u) } };
  }
  const me = userOf(token);
  if (!me) return err(401, 'Session expirée, veuillez vous reconnecter');
  if (p === '/auth/me') return { status: 200, body: { user: pub(me) } };
  if (p === '/auth/password') {
    if (body?.current !== me.password) return err(400, 'Mot de passe actuel incorrect');
    if (String(body?.next || '').length < 8) return err(400, 'Le nouveau mot de passe doit faire au moins 8 caractères');
    me.password = body.next; me.must_change_password = false; persist(); return { status: 200, body: { ok: true } };
  }
  if (p === '/sync') {
    const since = Number(new URLSearchParams(qs).get('since')) || 0;
    const cols = readableCollections(me.role);
    const recs = db.records.filter((r) => cols.includes(r.collection) && r.rev > since && (since > 0 || !r.deleted)).sort((a, b) => a.rev - b.rev);
    return { status: 200, body: { rev: db.rev, full: since === 0, collections: cols, records: clone(recs).map(out(me.role)) } };
  }
  if (p === '/records') {
    const ops = body?.ops || [];
    for (const op of ops) if (!canWrite(me.role, op.collection)) return err(403, `Accès refusé (${op.collection})`);
    const snapshot = clone(db);
    const results: R[] = [];
    const now = new Date().toISOString();
    for (const op of ops) {
      const cur = db.records.find((r) => r.collection === op.collection && r.id === op.id);
      if (op.op === 'create') {
        const id = op.id || crypto.randomUUID();
        const ex = db.records.find((r) => r.collection === op.collection && r.id === id);
        if (ex && !ex.deleted) { db = snapshot; return err(409, 'Cet élément existe déjà.', { current: out(me.role)(clone(ex)) }); }
        const r: R = { collection: op.collection, id, data: clone(op.data), version: ex ? ex.version + 1 : 1, rev: ++db.rev, deleted: false, updatedAt: now, updatedBy: me.username };
        if (ex) Object.assign(ex, r); else db.records.push(r);
        results.push(r); audit(me.username, 'create', op.collection, op.data?.name || op.data?.label || op.data?.description);
      } else if (op.op === 'update') {
        if (!cur || cur.deleted) { db = snapshot; return err(404, 'Cet élément a été supprimé entre-temps.'); }
        if (op.version != null && cur.version !== op.version) { db = snapshot; return err(409, 'Cet élément a été modifié par quelqu’un d’autre entre-temps.', { current: canRead(me.role, cur.collection) ? out(me.role)(clone(cur)) : null }); }
        Object.assign(cur, { data: clone(op.data), version: cur.version + 1, rev: ++db.rev, updatedAt: now, updatedBy: me.username });
        results.push(cur); audit(me.username, 'update', op.collection, op.data?.name || op.data?.label || op.data?.description);
      } else if (op.op === 'delete') {
        if (cur && !cur.deleted) { Object.assign(cur, { deleted: true, version: cur.version + 1, rev: ++db.rev, updatedAt: now, updatedBy: me.username }); results.push(cur); audit(me.username, 'delete', op.collection, cur.data?.name || cur.data?.label); }
      }
    }
    persist();
    return { status: 200, body: { records: clone(results).map(out(me.role)) } };
  }
  if (p.startsWith('/users') || p === '/audit') {
    if (me.role !== 'admin') return err(403, "Réservé à l'administrateur");
    if (p === '/audit') return { status: 200, body: clone(db.audit) };
    const uid = Number(p.split('/')[2]);
    if (method === 'GET') return { status: 200, body: db.users.map(({ password, ...u }) => u) };
    if (method === 'POST') {
      if (db.users.some((u) => u.username === body.username)) return err(400, 'Cet identifiant existe déjà');
      const u = { id: Math.max(...db.users.map((x) => x.id)) + 1, username: body.username, password: body.password, role: body.role, display_name: body.name, active: true, last_login: null, created_at: new Date().toISOString(), must_change_password: true };
      db.users.push(u); persist(); return { status: 200, body: u };
    }
    const u = db.users.find((x) => x.id === uid);
    if (!u) return err(404, 'Compte introuvable');
    if (method === 'PATCH') {
      if (uid === me.id && (body.active === false || (body.role && body.role !== 'admin'))) return err(400, 'Vous ne pouvez pas retirer vos propres droits administrateur');
      if (body.password) { u.password = body.password; u.must_change_password = true; }
      if (body.role) u.role = body.role; if (body.name) u.display_name = body.name; if (typeof body.active === 'boolean') u.active = body.active;
      persist(); return { status: 200, body: { ok: true } };
    }
    if (method === 'DELETE') { if (uid === me.id) return err(400, 'Impossible de supprimer votre propre compte'); db.users = db.users.filter((x) => x.id !== uid); persist(); return { status: 200, body: { ok: true } }; }
  }
  if (p === '/ocr') return err(503, 'La lecture de documents nécessite le serveur OSSATURE.');
  return err(404, 'Route inconnue');
}

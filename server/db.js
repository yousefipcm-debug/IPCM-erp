// Storage layer.
//
// Every business object is one row in `records` with a permanent id and a
// version number. Writes touch only the record that changed (no more
// "save the whole array and erase everyone else's work"), and an update that
// was based on an outdated version is rejected with a conflict instead of
// silently overwriting a colleague's change.
//
// `rev` comes from a single global sequence: clients ask "what changed since
// rev N?" to stay in sync with other users without reloading everything.

import pg from 'pg';
import crypto from 'node:crypto';

export class ConflictError extends Error {
  constructor(current) {
    super('conflict');
    this.current = current;
  }
}
export class NotFoundError extends Error {}

const newId = () => crypto.randomUUID();

// ───────────────────────────── PostgreSQL ─────────────────────────────
export async function createPgStore(connectionString) {
  const pool = new pg.Pool({
    connectionString,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    max: 10,
  });
  pool.on('error', (err) => console.error('[db] idle client error (recovered):', err.message));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

    CREATE SEQUENCE IF NOT EXISTS records_rev_seq;
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data JSONB NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      rev BIGINT NOT NULL DEFAULT nextval('records_rev_seq'),
      deleted BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT,
      updated_by TEXT,
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS records_rev_idx ON records (rev);

    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      username TEXT,
      action TEXT NOT NULL,
      collection TEXT,
      record_id TEXT,
      label TEXT
    );
    CREATE INDEX IF NOT EXISTS audit_at_idx ON audit_log (at DESC);

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value JSONB,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const rowOut = (r) => r && {
    collection: r.collection, id: r.id, data: r.data, version: r.version,
    rev: Number(r.rev), deleted: r.deleted, updatedAt: r.updated_at, updatedBy: r.updated_by,
  };

  async function withTx(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await fn(client);
      await client.query('COMMIT');
      return res;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  async function applyOp(q, op, user) {
    const { collection } = op;
    if (op.op === 'create') {
      const id = op.id || newId();
      const { rows } = await q.query(
        `INSERT INTO records (collection, id, data, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$4)
         ON CONFLICT (collection, id) DO UPDATE
           SET data = EXCLUDED.data, deleted = FALSE, version = records.version + 1,
               rev = nextval('records_rev_seq'), updated_at = NOW(), updated_by = EXCLUDED.updated_by
           WHERE records.deleted = TRUE
         RETURNING *`,
        [collection, id, op.data, user],
      );
      if (!rows[0]) throw new ConflictError(await getOne(q, collection, id));
      return rowOut(rows[0]);
    }
    if (op.op === 'update') {
      const params = [collection, op.id, op.data, user];
      let versionClause = '';
      if (op.version != null) { params.push(op.version); versionClause = 'AND version = $5'; }
      const { rows } = await q.query(
        `UPDATE records SET data = $3, version = version + 1, rev = nextval('records_rev_seq'),
           updated_at = NOW(), updated_by = $4
         WHERE collection = $1 AND id = $2 AND deleted = FALSE ${versionClause}
         RETURNING *`,
        params,
      );
      if (!rows[0]) {
        const cur = await getOne(q, collection, op.id);
        if (!cur || cur.deleted) throw new NotFoundError();
        throw new ConflictError(cur);
      }
      return rowOut(rows[0]);
    }
    if (op.op === 'delete') {
      const { rows } = await q.query(
        `UPDATE records SET deleted = TRUE, version = version + 1, rev = nextval('records_rev_seq'),
           updated_at = NOW(), updated_by = $3
         WHERE collection = $1 AND id = $2 AND deleted = FALSE
         RETURNING *`,
        [collection, op.id, user],
      );
      return rows[0] ? rowOut(rows[0]) : null;
    }
    throw new Error('unknown op ' + op.op);
  }

  async function getOne(q, collection, id) {
    const { rows } = await q.query('SELECT * FROM records WHERE collection=$1 AND id=$2', [collection, id]);
    return rowOut(rows[0]);
  }

  return {
    type: 'postgres',
    pool,

    // users
    async getUserByUsername(username) {
      const { rows } = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
      return rows[0] || null;
    },
    async getUserById(id) {
      const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
      return rows[0] || null;
    },
    async listUsers() {
      const { rows } = await pool.query(
        'SELECT id, username, role, display_name, active, last_login, created_at, must_change_password FROM users ORDER BY id');
      return rows;
    },
    async countUsers() {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
      return rows[0].n;
    },
    async createUser(u) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO users (username, password_hash, role, display_name, must_change_password)
           VALUES ($1,$2,$3,$4,$5) RETURNING id, username, role, display_name, active, created_at`,
          [u.username, u.password_hash, u.role, u.display_name, !!u.must_change_password]);
        return rows[0];
      } catch (e) {
        if (e.code === '23505') throw new Error('duplicate');
        throw e;
      }
    },
    async updateUser(id, f) {
      const sets = []; const vals = [];
      for (const k of ['password_hash', 'role', 'display_name', 'active', 'must_change_password', 'last_login']) {
        if (f[k] !== undefined) { vals.push(f[k]); sets.push(`${k}=$${vals.length}`); }
      }
      if (!sets.length) return;
      vals.push(id);
      await pool.query(`UPDATE users SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
    },
    async deleteUser(id) { await pool.query('DELETE FROM users WHERE id=$1', [id]); },

    // records
    async listSince(collections, sinceRev) {
      if (!collections.length) return [];
      const { rows } = await pool.query(
        `SELECT * FROM records WHERE collection = ANY($1) AND rev > $2 ${sinceRev > 0 ? '' : 'AND deleted = FALSE'}
         ORDER BY rev`,
        [collections, sinceRev]);
      return rows.map(rowOut);
    },
    async currentRev() {
      const { rows } = await pool.query('SELECT COALESCE(MAX(rev),0)::bigint AS r FROM records');
      return Number(rows[0].r);
    },
    async get(collection, id) { return getOne(pool, collection, id); },
    async apply(ops, user) {
      return withTx(async (client) => {
        const out = [];
        for (const op of ops) out.push(await applyOp(client, op, user));
        return out;
      });
    },
    async bulkInsert(records, user) {
      return withTx(async (client) => {
        for (const r of records) {
          await client.query(
            `INSERT INTO records (collection, id, data, created_by, updated_by) VALUES ($1,$2,$3,$4,$4)
             ON CONFLICT (collection, id) DO NOTHING`,
            [r.collection, r.id, r.data, user]);
        }
      });
    },
    async countRecords() {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM records');
      return rows[0].n;
    },

    // meta
    async getMeta(key) {
      const { rows } = await pool.query('SELECT value FROM app_meta WHERE key=$1', [key]);
      return rows[0] ? rows[0].value : null;
    },
    async setMeta(key, value) {
      await pool.query(
        `INSERT INTO app_meta (key, value, updated_at) VALUES ($1,$2,NOW())
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`, [key, JSON.stringify(value)]);
    },
    async readLegacyKv() {
      const { rows: t } = await pool.query(`SELECT to_regclass('public.kv_data') AS t`);
      if (!t[0].t) return null;
      const { rows } = await pool.query('SELECT key, value FROM kv_data');
      const kv = {};
      for (const r of rows) { try { kv[r.key] = JSON.parse(r.value); } catch { kv[r.key] = null; } }
      return kv;
    },

    // audit
    async audit(entry) {
      await pool.query(
        'INSERT INTO audit_log (username, action, collection, record_id, label) VALUES ($1,$2,$3,$4,$5)',
        [entry.username, entry.action, entry.collection || null, entry.recordId || null, entry.label || null],
      ).catch((e) => console.error('[audit]', e.message));
    },
    async listAudit(limit = 200) {
      const { rows } = await pool.query('SELECT * FROM audit_log ORDER BY at DESC LIMIT $1', [limit]);
      return rows;
    },
  };
}

// ───────────────────────── In-memory (dev only) ─────────────────────────
export function createMemoryStore() {
  let rev = 0;
  let userSeq = 1;
  const users = [];
  const records = new Map(); // key collection:id
  const meta = new Map();
  const audits = [];
  const key = (c, id) => c + '\u0000' + id;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const pub = (r) => r && clone(r);

  function applyOp(op, user) {
    const now = new Date().toISOString();
    if (op.op === 'create') {
      const id = op.id || newId();
      const ex = records.get(key(op.collection, id));
      if (ex && !ex.deleted) throw new ConflictError(pub(ex));
      const r = { collection: op.collection, id, data: clone(op.data), version: ex ? ex.version + 1 : 1, rev: ++rev, deleted: false, updatedAt: now, updatedBy: user };
      records.set(key(op.collection, id), r);
      return pub(r);
    }
    const r = records.get(key(op.collection, op.id));
    if (op.op === 'update') {
      if (!r || r.deleted) throw new NotFoundError();
      if (op.version != null && r.version !== op.version) throw new ConflictError(pub(r));
      Object.assign(r, { data: clone(op.data), version: r.version + 1, rev: ++rev, updatedAt: now, updatedBy: user });
      return pub(r);
    }
    if (op.op === 'delete') {
      if (!r || r.deleted) return null;
      Object.assign(r, { deleted: true, version: r.version + 1, rev: ++rev, updatedAt: now, updatedBy: user });
      return pub(r);
    }
    throw new Error('unknown op');
  }

  return {
    type: 'memory',
    async getUserByUsername(u) { return users.find((x) => x.username === u) || null; },
    async getUserById(id) { return users.find((x) => x.id === id) || null; },
    async listUsers() { return users.map(({ password_hash, ...u }) => u); },
    async countUsers() { return users.length; },
    async createUser(u) {
      if (users.find((x) => x.username === u.username)) throw new Error('duplicate');
      const row = { id: userSeq++, active: true, created_at: new Date().toISOString(), last_login: null, must_change_password: false, ...u };
      users.push(row);
      const { password_hash, ...pubU } = row;
      return pubU;
    },
    async updateUser(id, f) {
      const u = users.find((x) => x.id === id);
      if (u) for (const [k, v] of Object.entries(f)) if (v !== undefined) u[k] = v;
    },
    async deleteUser(id) { const i = users.findIndex((x) => x.id === id); if (i >= 0) users.splice(i, 1); },

    async listSince(collections, sinceRev) {
      return [...records.values()]
        .filter((r) => collections.includes(r.collection) && r.rev > sinceRev && (sinceRev > 0 || !r.deleted))
        .sort((a, b) => a.rev - b.rev).map(pub);
    },
    async currentRev() { return rev; },
    async get(c, id) { return pub(records.get(key(c, id))); },
    async apply(ops, user) {
      // all-or-nothing: work on a snapshot, restore on failure
      const snapshot = new Map([...records].map(([k, v]) => [k, clone(v)]));
      const revBefore = rev;
      try { return ops.map((op) => applyOp(op, user)); }
      catch (e) { records.clear(); snapshot.forEach((v, k) => records.set(k, v)); rev = revBefore; throw e; }
    },
    async bulkInsert(list, user) {
      for (const r of list) if (!records.has(key(r.collection, r.id))) applyOp({ op: 'create', ...r }, user);
    },
    async countRecords() { return records.size; },
    async getMeta(k) { return meta.has(k) ? clone(meta.get(k)) : null; },
    async setMeta(k, v) { meta.set(k, clone(v)); },
    async readLegacyKv() { return null; },
    async audit(e) { audits.unshift({ id: audits.length + 1, at: new Date().toISOString(), ...e, record_id: e.recordId }); if (audits.length > 2000) audits.pop(); },
    async listAudit(limit = 200) { return audits.slice(0, limit); },
  };
}

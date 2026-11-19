// Who can read / write which collection.
// Enforced on the server for every read, write and sync — the UI only mirrors it.

export const ROLES = ['admin', 'finance', 'hr', 'technique', 'commercial', 'secretariat'];

export const ROLE_LABELS = {
  admin: 'Administrateur',
  finance: 'DFC',
  hr: 'Ressources humaines',
  technique: 'Technique',
  commercial: 'Commercial',
  secretariat: 'Secrétariat',
};

// r = read, w = read + write
const MATRIX = {
  // ── Référentiels ──
  clients:          { finance: 'w', commercial: 'w', technique: 'r' },
  suppliers:        { finance: 'w', commercial: 'w', technique: 'r', secretariat: 'r' },
  settings:         { finance: 'r', hr: 'r', technique: 'r', commercial: 'r', secretariat: 'r' },

  // ── DFC ──
  transactions:     { finance: 'w' },
  situations:       { finance: 'w', commercial: 'w' },
  supplierInvoices: { finance: 'w' },
  charges:          { finance: 'w' },
  projects:         { finance: 'w' },
  pettyCash:        { finance: 'w' },
  simulator:        { finance: 'w' },

  // ── Commercial ──
  invoices:         { finance: 'w', commercial: 'w' },
  ribs:             { finance: 'w', commercial: 'w' },

  // ── RH / Technique ──
  workers:          { hr: 'w', technique: 'w' },
  workSites:        { hr: 'w', technique: 'w' },
  attendance:       { hr: 'w', technique: 'w' },
  attendanceLegend: { hr: 'w', technique: 'w' },
  techSitesLegacy:  { technique: 'r' },

  // ── Documents (partagés) ──
  hrDocuments:      { finance: 'w', hr: 'w', technique: 'w', commercial: 'w' },
  hrFolders:        { finance: 'w', hr: 'w', technique: 'w', commercial: 'w' },

  // ── Secrétariat ──
  pendingScans:     { finance: 'w', secretariat: 'w' },
};

export const COLLECTIONS = Object.keys(MATRIX);

// Some roles only get a reduced view of a collection.
// Secretariat sees supplier names only — never their bank details or debts.
const PROJECTIONS = {
  secretariat: { suppliers: ['name'] },
};

export function canRead(role, collection) {
  if (!MATRIX[collection]) return false;
  if (role === 'admin') return true;
  return !!MATRIX[collection][role];
}

export function canWrite(role, collection) {
  if (!MATRIX[collection]) return false;
  if (role === 'admin') return collection !== 'techSitesLegacy';
  return MATRIX[collection][role] === 'w';
}

export function readableCollections(role) {
  return COLLECTIONS.filter((c) => canRead(role, c));
}

export function project(role, collection, data) {
  const fields = PROJECTIONS[role]?.[collection];
  if (!fields || !data) return data;
  const out = {};
  for (const f of fields) if (f in data) out[f] = data[f];
  return out;
}

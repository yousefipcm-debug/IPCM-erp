// One-time conversion of the old ARCIS data (table kv_data: one JSON array per key)
// into the new record model (one row per object, permanent ids).
//
// What it fixes on the way:
//  - workers were referenced by their POSITION in the list (worksites, every
//    pointage cell, salaries). Deleting one worker shifted everyone. → real ids.
//  - transactions referenced projects by position too. → projectId.
//  - clients/suppliers were plain names spread over 4 different lists
//    (clientNames, clientDetails, commercialContacts, situations…). → one
//    client / supplier record each, everything points to its id.
//  - journal payments were copied into situations/fournisseurs/projects
//    ("cascade"). → the transaction now carries its own allocations; balances
//    are computed from it, so the copies can never drift apart again.
//
// The old kv_data table is never modified or deleted.

import crypto from 'node:crypto';

const MIGRATION_KEY = 'migration_v3_done';

const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const str = (v) => (v == null ? '' : String(v)).trim();
const norm = (s) => str(s).toUpperCase().replace(/\s+/g, ' ');

export function convertLegacy(kv) {
  const out = {};
  const used = new Set();
  const push = (collection, data, legacyId) => {
    let id = legacyId != null && legacyId !== '' ? String(legacyId) : crypto.randomUUID();
    while (used.has(collection + ':' + id)) id = id + '-' + crypto.randomBytes(2).toString('hex');
    used.add(collection + ':' + id);
    (out[collection] ||= []).push({ collection, id, data });
    return id;
  };
  const report = { warnings: [] };

  // ───────── Clients ─────────
  const clientIdByName = new Map();
  const clientRec = new Map();
  const ensureClient = (name) => {
    const n = str(name);
    if (!n) return null;
    const k = norm(n);
    if (clientIdByName.has(k)) return clientIdByName.get(k);
    const data = { name: n, legalName: '', address: '', nif: '', nis: '', rc: '', ai: '', tin: '',
      contactPerson: '', phone: '', phone2: '', email: '', paymentTerms: '', rib: '', activity: '', notes: '' };
    const id = push('clients', data);
    clientIdByName.set(k, id);
    clientRec.set(id, data);
    return id;
  };
  arr(kv.clientNames).forEach(ensureClient);
  for (const [name, d] of Object.entries(obj(kv.clientDetails))) {
    const id = ensureClient(name);
    if (!id) continue;
    const c = clientRec.get(id);
    const dd = obj(d);
    c.legalName ||= str(dd.fullname); c.address ||= str(dd.address);
    c.nif ||= str(dd.nif); c.nis ||= str(dd.nis); c.rc ||= str(dd.rc); c.ai ||= str(dd.ai); c.tin ||= str(dd.tin);
  }

  // ───────── Suppliers ─────────
  const supplierIdByName = new Map();
  const supplierRec = new Map();
  const ensureSupplier = (name) => {
    const n = str(name);
    if (!n || n === 'Fournisseur non renseigné') return null;
    const k = norm(n);
    if (supplierIdByName.has(k)) return supplierIdByName.get(k);
    const data = { name: n, legalName: '', address: '', nif: '', nis: '', rc: '', contactPerson: '', phone: '',
      phone2: '', email: '', paymentTerms: '', rib: '', activity: '', notes: '', alertLimit: 0 };
    const id = push('suppliers', data);
    supplierIdByName.set(k, id);
    supplierRec.set(id, data);
    return id;
  };
  arr(kv.fournisseurNames).forEach(ensureSupplier);

  // Commercial contacts enrich clients / suppliers
  for (const c of arr(kv.commercialContacts)) {
    const isSupplier = c?.category === 'fournisseur';
    const id = isSupplier ? ensureSupplier(c?.name) : ensureClient(c?.name);
    if (!id) continue;
    const r = isSupplier ? supplierRec.get(id) : clientRec.get(id);
    r.contactPerson ||= str(c.person); r.activity ||= str(c.type); r.phone ||= str(c.phone);
    r.phone2 ||= str(c.phone2); r.email ||= str(c.email); r.address ||= str(c.address);
    r.nif ||= str(c.nif); r.rc ||= str(c.rc); r.nis ||= str(c.nis); r.paymentTerms ||= str(c.payment);
    r.rib ||= str(c.rib); r.notes ||= str(c.notes);
  }

  // ───────── Projects ─────────
  const projectIdByIndex = [];
  arr(kv.projects).forEach((p, i) => {
    const manualExpenses = arr(p?.expenses).filter((e) => !e?.transId && !e?.fromJournal)
      .map((e) => ({ id: str(e.id) || crypto.randomUUID(), description: str(e.desc), amount: num(e.amount), date: str(e.date) }));
    const manualPayments = arr(p?.payments).filter((e) => !e?.transId && !e?.fromJournal)
      .map((e) => ({ id: str(e.id) || crypto.randomUUID(), reference: str(e.ref), amount: num(e.amount), date: str(e.date) }));
    projectIdByIndex[i] = push('projects', {
      name: str(p?.name) || 'Projet sans nom',
      clientId: ensureClient(p?.client),
      contractValue: num(p?.contractValue),
      startDate: str(p?.startDate),
      status: p?.status === 'terminé' ? 'done' : 'active',
      manualExpenses, manualPayments,
    }, p?.id);
  });

  // ───────── Situations (créances clients) ─────────
  const situationRefs = []; // {id, payments}
  arr(kv.situations).forEach((s) => {
    const payments = arr(s?.payments);
    const id = push('situations', {
      clientId: ensureClient(s?.client),
      project: str(s?.project),
      number: str(s?.number),
      date: str(s?.date),
      amount: num(s?.amount),
      contractType: s?.contractType === 'informel' ? 'informel' : 'formel',
      invoiceId: s?.invoiceId != null ? String(s.invoiceId) : null,
      manualPayments: payments.filter((p) => !p?.transId)
        .map((p) => ({ id: str(p.id) || crypto.randomUUID(), amount: num(p.amount), date: str(p.date), note: '' })),
    }, s?.id);
    situationRefs.push({ id, payments });
  });

  // ───────── Supplier invoices (dettes fournisseurs) ─────────
  const supplierInvRefs = [];
  arr(kv.fournisseurs).forEach((f) => {
    const sid = ensureSupplier(f?.name);
    if (sid && num(f?.limit) > 0) {
      const s = supplierRec.get(sid);
      s.alertLimit = Math.max(s.alertLimit || 0, num(f.limit));
    }
    const payments = arr(f?.payments);
    const id = push('supplierInvoices', {
      supplierId: sid,
      supplierName: sid ? null : str(f?.name),
      reference: str(f?.ref),
      date: str(f?.date),
      amount: num(f?.amount),
      manualPayments: payments.filter((p) => !p?.transId)
        .map((p) => ({ id: str(p.id) || crypto.randomUUID(), amount: num(p.amount), date: str(p.date), note: '' })),
    }, f?.id);
    supplierInvRefs.push({ id, payments });
  });

  // ───────── Transactions (journaux caisse / banque) ─────────
  const missingIds = new Set(arr(kv.missingInvoiceAlerts).map((a) => String(a?.transId)));
  arr(kv.transactions).forEach((t) => {
    const legacyId = t?.id != null ? String(t.id) : null;
    const allocations = [];
    if (legacyId) {
      for (const s of situationRefs) for (const p of s.payments)
        if (String(p?.transId) === legacyId) allocations.push({ type: 'situation', id: s.id, amount: num(p.amount) });
      for (const f of supplierInvRefs) for (const p of f.payments)
        if (String(p?.transId) === legacyId) allocations.push({ type: 'supplierInvoice', id: f.id, amount: num(p.amount) });
    }
    const pIdx = t?.projectIdx != null && t.projectIdx !== '' ? parseInt(t.projectIdx, 10) : null;
    const isOut = t?.type === 'out';
    push('transactions', {
      journal: t?.journal === 'banque' ? 'banque' : 'caisse',
      type: isOut ? 'out' : 'in',
      amount: num(t?.amount),
      description: str(t?.desc),
      date: str(t?.date),
      projectId: pIdx != null && projectIdByIndex[pIdx] ? projectIdByIndex[pIdx] : null,
      clientId: !isOut ? ensureClient(t?.client) : null,
      supplierId: isOut ? ensureSupplier(t?.fournisseur) : null,
      chequeNo: str(t?.cheque),
      invoiceStatus: isOut && (t?.factureStatus === 'missing' || (legacyId && missingIds.has(legacyId) && t?.factureStatus !== 'not-needed'))
        ? 'missing' : 'ok',
      allocations,
    }, legacyId);
  });

  // ───────── Charges ─────────
  arr(kv.charges).forEach((c) => push('charges', { label: str(c?.label), category: str(c?.type), amount: num(c?.amount) }, c?.id));

  // ───────── Caisse Mme Terkmane ─────────
  arr(kv.caisseTerkmane).forEach((m) => push('pettyCash', {
    type: m?.type === 'out' ? 'out' : 'in',
    amount: num(m?.amount),
    date: str(m?.date),
    description: str(m?.type === 'out' ? m?.reason : m?.desc),
    beneficiary: str(m?.beneficiaire),
    supplierId: m?.isFournisseur ? ensureSupplier(m?.beneficiaire) : null,
  }, m?.id));

  // ───────── Facturation ─────────
  arr(kv.ribList).forEach((r) => push('ribs', { bank: str(r?.bank), number: str(r?.number) }));
  arr(kv.invoices).forEach((inv) => push('invoices', {
    type: inv?.type === 'proforma' ? 'proforma' : 'finale',
    number: str(inv?.number), date: str(inv?.date), place: str(inv?.place),
    clientId: ensureClient(inv?.client),
    project: str(inv?.project), work: str(inv?.ouvrage), site: str(inv?.site),
    lines: arr(inv?.lines).map((l) => ({ description: str(l?.desc), qty: num(l?.qty), unitPrice: num(l?.pu) })),
    stampDuty: num(inv?.timbre) > 0,
    totals: { ht: num(inv?.ht), tva: num(inv?.tva), stamp: num(inv?.timbre), ttc: num(inv?.ttc) },
    rib: inv?.rib ? { bank: str(inv.rib.bank), number: str(inv.rib.number) } : null,
    paymentTerms: str(inv?.conditions),
  }, inv?.id));

  // ───────── Workers ─────────
  const workerIdByIndex = [];
  arr(kv.workers).forEach((w, i) => {
    const { _showHistory, ...rest } = obj(w);
    workerIdByIndex[i] = push('workers', {
      lastName: str(rest.name), firstName: str(rest.surname), birthDate: str(rest.birth),
      position: str(rest.function), socialSecurityNo: str(rest.ss), children: parseInt(rest.kids, 10) || 0,
      bloodGroup: str(rest.blood), maritalStatus: str(rest.status), health: str(rest.health),
      contractType: str(rest.contract), entryDate: str(rest.entry), contractEnd: str(rest.contractEnd),
      address: str(rest.address), certificates: str(rest.cert), phone: str(rest.phone),
      idCardNo: str(rest.cin), idCardExpiry: str(rest.cinExp),
      netSalary: num(rest.salary), baseSalary: num(rest.baseSalary), rib: str(rest.rib),
      photo: rest.photo || null,
      contractHistory: arr(rest.history).map((h) => ({ from: str(h?.from), to: str(h?.to), type: str(h?.type) })),
      archived: false,
    });
  });
  const wid = (i) => workerIdByIndex[parseInt(i, 10)];

  // ───────── Work sites ─────────
  const assigned = new Set();
  arr(kv.workSites).forEach((ws) => {
    const workerIds = [];
    for (const i of arr(ws?.workerIds)) {
      const id = wid(i);
      if (id && !assigned.has(id)) { workerIds.push(id); assigned.add(id); }
    }
    push('workSites', {
      name: str(ws?.name) || 'Chantier', description: str(ws?.desc), workerIds,
      dailyLogs: arr(ws?.pointage), reports: arr(ws?.rapports), status: 'active',
    });
  });
  arr(kv.techWorkSites).forEach((ws) => push('techSitesLegacy', obj(ws)));

  // ───────── Pointage (attendance) ─────────
  // old: adminPointage[YYYY-MM].cells["<workerIndex>_<day>_<row>"] = {val,bg}
  // new: one record per worker per month, id "<YYYY-MM>:<workerId>"
  for (const [month, m] of Object.entries(obj(kv.adminPointage))) {
    let cells = obj(m).cells;
    if (!cells) { // very old flat format {wi: {day: val}}
      cells = {};
      for (const [wi, days] of Object.entries(obj(m)))
        for (const [d, v] of Object.entries(obj(days))) if (v) cells[`${wi}_${d}_0`] = { val: String(v), bg: '' };
    }
    const perWorker = {};
    for (const [k, cell] of Object.entries(obj(cells))) {
      const [wi, day, row] = k.split('_');
      const workerId = wid(wi) || `orphan-${wi}`;
      if (!wid(wi)) report.warnings.push(`Pointage ${month}: ligne ${wi} sans employé correspondant (conservée)`);
      (perWorker[workerId] ||= {})[`${day}_${row || 0}`] = { val: str(cell?.val), bg: str(cell?.bg) };
    }
    for (const [workerId, c] of Object.entries(perWorker))
      push('attendance', { month, workerId, cells: c }, `${month}:${workerId}`);
  }
  arr(kv.adminPtgLegend).forEach((l) => push('attendanceLegend', { color: str(l?.bg), label: str(l?.label) }));

  // ───────── Documents ─────────
  arr(kv.hrFolders).forEach((f) => push('hrFolders', { name: str(f) }));
  arr(kv.hrDocuments).forEach((d) => push('hrDocuments', {
    title: str(d?.title), date: str(d?.date), content: d?.content || '', folder: str(d?.folder),
    signerLeft: str(d?.signerLeft), signerRight: str(d?.signerRight), images: arr(d?.images),
  }));

  // ───────── Secrétariat ─────────
  arr(kv.pendingScans).forEach((s) => push('pendingScans', {
    docType: s?.docType || 'unknown', amount: s?.amount ?? null, date: str(s?.date), reference: str(s?.ref),
    supplierGuess: str(s?.fournisseurGuess), rawText: s?.rawText || '', image: s?.imageB64 || null,
    submittedBy: str(s?.submittedBy), submittedAt: s?.submittedAt || null, status: s?.status || 'pending',
  }, s?.id));

  // ───────── Simulateur ─────────
  if (kv.simPicks || kv.simCustomAmounts) {
    const byName = (o) => Object.fromEntries(Object.entries(obj(o))
      .map(([n, v]) => [ensureSupplier(n), v]).filter(([id]) => id));
    push('simulator', { picks: byName(kv.simPicks), amounts: byName(kv.simCustomAmounts) }, 'state');
  }

  const records = Object.values(out).flat();
  report.counts = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length]));
  return { records, report };
}

export async function runMigrationIfNeeded(store) {
  if (store.type !== 'postgres') return null;
  if (await store.getMeta(MIGRATION_KEY)) return null;
  const kv = await store.readLegacyKv();
  if (!kv || !Object.keys(kv).length) {
    await store.setMeta(MIGRATION_KEY, { at: new Date().toISOString(), skipped: 'no legacy data' });
    return null;
  }
  if ((await store.countRecords()) > 0) {
    console.warn('[migration] records already exist — skipping automatic migration to avoid duplicates.');
    await store.setMeta(MIGRATION_KEY, { at: new Date().toISOString(), skipped: 'records already present' });
    return null;
  }
  console.log('[migration] converting legacy ARCIS data…');
  const { records, report } = convertLegacy(kv);
  await store.bulkInsert(records, 'migration');
  await store.setMeta(MIGRATION_KEY, { at: new Date().toISOString(), ...report });
  await store.audit({ username: 'system', action: 'migration', label: `${records.length} enregistrements convertis` });
  console.log('[migration] done:', report.counts, report.warnings.length ? `${report.warnings.length} warning(s)` : '');
  return report;
}

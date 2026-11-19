import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertLegacy } from '../migrate.js';

const legacy = {
  clientNames: ['SAFEX', 'BLOCOTELHA'],
  clientDetails: { SAFEX: { fullname: 'SAFEX SPA', nif: '123' } },
  fournisseurNames: ['Acier Blida', 'Transport Bouzid'],
  commercialContacts: [{ category: 'fournisseur', name: 'acier blida', phone: '0550' }, { category: 'client', name: 'Nouveau Client', email: 'a@b.dz' }],
  projects: [{ name: 'Hangar', client: 'SAFEX', contractValue: 1000000, status: 'active', id: 11,
    expenses: [{ desc: 'manuel', amount: 50, date: '2026-01-02', id: 1 }, { desc: 'j', amount: 70, transId: 900, fromJournal: true }],
    payments: [] }],
  situations: [{ client: 'SAFEX', amount: 500, date: '2026-01-01', id: 21, payments: [{ amount: 100, transId: 900 }, { amount: 50, date: '2026-01-05' }] }],
  fournisseurs: [{ name: 'Acier Blida', amount: 300, date: '2026-01-01', limit: 200, id: 31, payments: [{ amount: 120, transId: 901 }] }],
  transactions: [
    { id: 900, journal: 'banque', type: 'in', amount: 100, client: 'SAFEX', projectIdx: '0', date: '2026-01-03' },
    { id: 901, journal: 'caisse', type: 'out', amount: 120, fournisseur: 'Acier Blida', factureStatus: 'missing', date: '2026-01-04' },
  ],
  missingInvoiceAlerts: [{ transId: 901 }],
  workers: [{ name: 'A', surname: 'a' }, { name: 'B', surname: 'b' }, { name: 'C', surname: 'c' }],
  workSites: [{ name: 'Site 1', workerIds: [2, 0, 2] }, { name: 'Site 2', workerIds: [0, 1] }],
  adminPointage: { '2026-01': { cells: { '0_1_0': { val: 'P', bg: '' }, '2_1_0': { val: 'D', bg: '#fff' }, '2_1_1': { val: '2' }, '7_3_0': { val: 'P' } } } },
  caisseTerkmane: [{ id: 5, type: 'out', amount: 10, beneficiaire: 'Transport Bouzid', isFournisseur: true, reason: 'x' }],
  invoices: [{ id: 77, type: 'finale', number: '01/2026', client: 'BLOCOTELHA', lines: [{ desc: 'L', qty: 2, pu: 10 }], ttc: 23.8 }],
};

test('converts legacy data with stable references', () => {
  const { records, report } = convertLegacy(legacy);
  const by = (c) => records.filter((r) => r.collection === c);
  const clients = by('clients'); const suppliers = by('suppliers');
  assert.equal(clients.length, 3);
  assert.equal(suppliers.length, 2, 'case-insensitive dedupe of suppliers');
  const safex = clients.find((c) => c.data.name === 'SAFEX');
  assert.equal(safex.data.legalName, 'SAFEX SPA');
  const acier = suppliers.find((s) => s.data.name === 'Acier Blida');
  assert.equal(acier.data.phone, '0550'); assert.equal(acier.data.alertLimit, 200);

  const [t900, t901] = by('transactions');
  assert.equal(t900.id, '900');
  assert.equal(t900.data.projectId, '11');
  assert.equal(t900.data.clientId, safex.id);
  assert.deepEqual(t900.data.allocations, [{ type: 'situation', id: '21', amount: 100 }]);
  assert.equal(t901.data.invoiceStatus, 'missing');
  assert.equal(t901.data.allocations[0].id, '31');

  const sit = by('situations')[0];
  assert.equal(sit.data.manualPayments.length, 1, 'journal payment moved to transaction, manual kept');
  const proj = by('projects')[0];
  assert.equal(proj.data.manualExpenses.length, 1);

  const workers = by('workers');
  const [ws1, ws2] = by('workSites');
  assert.deepEqual(ws1.data.workerIds, [workers[2].id, workers[0].id], 'indices → ids, duplicate removed');
  assert.deepEqual(ws2.data.workerIds, [workers[1].id], 'worker already assigned elsewhere is not duplicated');

  const att = by('attendance');
  const a0 = att.find((a) => a.data.workerId === workers[0].id);
  assert.equal(a0.id, `2026-01:${workers[0].id}`);
  assert.equal(a0.data.cells['1_0'].val, 'P');
  const a2 = att.find((a) => a.data.workerId === workers[2].id);
  assert.equal(a2.data.cells['1_1'].val, '2');
  assert.ok(att.find((a) => a.data.workerId === 'orphan-7'), 'orphan pointage preserved');
  assert.ok(report.warnings.length >= 1);

  const pc = by('pettyCash')[0];
  assert.equal(pc.data.supplierId, suppliers.find((s) => s.data.name === 'Transport Bouzid').id);
  assert.equal(by('invoices')[0].data.clientId, clients.find((c) => c.data.name === 'BLOCOTELHA').id);
  const ids = new Set(records.map((r) => r.collection + r.id));
  assert.equal(ids.size, records.length, 'no duplicate ids');
});

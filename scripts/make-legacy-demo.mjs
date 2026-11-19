// Builds a database in the OLD ARCIS format (users + kv_data) with realistic
// data, to test the automatic migration and the new interface end to end.
import pg from 'pg';
import bcrypt from 'bcryptjs';
const url = process.argv[2];
const c = new pg.Client(url); await c.connect();
await c.query(`DROP TABLE IF EXISTS records, audit_log, app_meta, kv_data, users CASCADE; DROP SEQUENCE IF EXISTS records_rev_seq;
CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, display_name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE kv_data (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '[]', updated_at TIMESTAMPTZ DEFAULT NOW());`);
for (const [u, p, r, n] of [['admin', 'Admin2024!', 'admin', 'Youcef Boutema'], ['finance', 'Finance2024!', 'finance', 'Hakima'], ['rh', 'RH2024!', 'hr', 'Radia'], ['cylia', 'Cylia2024!', 'secretariat', 'Cylia']])
  await c.query('INSERT INTO users(username,password_hash,role,display_name) VALUES($1,$2,$3,$4)', [u, bcrypt.hashSync(p, 10), r, n]);

const d = (daysAgo) => { const x = new Date(); x.setDate(x.getDate() - daysAgo); return x.toISOString().slice(0, 10); };
let id = 1700000000000; const nid = () => ++id;
const clients = ['SAFEX', 'BLOCOTELHA Steel', 'Sarl Promo Mitidja', 'EURL Hangars du Centre', 'Cosider Construction'];
const fourn = ['Acier Blida', 'Transport Bouzid', 'Quincaillerie El Amel', 'Tôlerie Mitidja', 'Location Grues Atlas'];
const situations = [
  { client: 'SAFEX', project: 'Hangar SAFEX Oued Smar', number: 'Situation n°1', amount: 8500000, date: d(140), contractType: 'formel', id: nid(), payments: [] },
  { client: 'SAFEX', project: 'Hangar SAFEX Oued Smar', number: 'Situation n°2', amount: 6200000, date: d(75), contractType: 'formel', id: nid(), payments: [] },
  { client: 'BLOCOTELHA Steel', project: 'Couverture SKINZIP', number: 'Situation n°4', amount: 4350000, date: d(48), contractType: 'formel', id: nid(), payments: [] },
  { client: 'Sarl Promo Mitidja', project: 'Charpente bloc B', number: 'Situation n°1', amount: 2900000, date: d(110), contractType: 'informel', id: nid(), payments: [{ amount: 500000, date: d(90), id: nid() }] },
  { client: 'EURL Hangars du Centre', project: 'Hangar stockage', number: 'Facture 07/2026', amount: 3150000, date: d(18), contractType: 'formel', id: nid(), payments: [] },
  { client: 'Cosider Construction', project: 'Centre commercial Blida', number: 'Situation n°3', amount: 11800000, date: d(9), contractType: 'formel', id: nid(), payments: [] },
];
const fournisseurs = [
  { name: 'Acier Blida', ref: 'FA-2026-118', amount: 3800000, date: d(95), id: nid(), payments: [], limit: 5000000 },
  { name: 'Acier Blida', ref: 'FA-2026-162', amount: 2450000, date: d(40), id: nid(), payments: [] },
  { name: 'Transport Bouzid', ref: 'TB-331', amount: 420000, date: d(33), id: nid(), payments: [] },
  { name: 'Tôlerie Mitidja', ref: 'TM-0907', amount: 1680000, date: d(21), id: nid(), payments: [] },
  { name: 'Location Grues Atlas', ref: 'LGA-55', amount: 960000, date: d(12), id: nid(), payments: [] },
];
const transactions = [];
const tx = (o) => { const t = { id: nid(), projectIdx: null, cheque: null, factureStatus: o.type === 'out' ? 'not-needed' : null, ...o }; transactions.push(t); return t; };
tx({ journal: 'banque', type: 'in', amount: 12000000, desc: 'Solde reporté', date: d(170) });
tx({ journal: 'caisse', type: 'in', amount: 900000, desc: 'Alimentation caisse', date: d(165) });
// client payments with cascade (old format: payment copied into situation with transId)
const pay = (sit, amount, daysAgo, journal = 'banque', cheque) => { const t = tx({ journal, type: 'in', amount, desc: `Règlement ${sit.number}`, client: sit.client, date: d(daysAgo), cheque }); sit.payments.push({ amount, date: d(daysAgo), id: t.id, fromJournal: true, transId: t.id }); };
pay(situations[0], 8500000, 100, 'banque', '0045871');
pay(situations[1], 3000000, 30, 'banque', '0046102');
pay(situations[2], 2000000, 20, 'banque', '0046240');
const payF = (f, amount, daysAgo, journal = 'banque') => { const t = tx({ journal, type: 'out', amount, desc: `Paiement ${f.ref}`, fournisseur: f.name, date: d(daysAgo), cheque: String(310000 + amount % 997) }); f.payments.push({ amount, date: d(daysAgo), id: t.id, fromJournal: true, transId: t.id }); };
payF(fournisseurs[0], 3800000, 60);
payF(fournisseurs[1], 1000000, 15);
payF(fournisseurs[2], 420000, 25, 'caisse');
for (let m = 5; m >= 0; m--) {
  tx({ journal: 'banque', type: 'out', amount: 2350000, desc: 'Salaires du mois', date: d(m * 30 + 3) });
  tx({ journal: 'banque', type: 'out', amount: 410000, desc: 'CNAS', date: d(m * 30 + 6) });
  tx({ journal: 'caisse', type: 'out', amount: 85000 + m * 3000, desc: 'Carburant véhicules', date: d(m * 30 + 10) });
}
const missing = tx({ journal: 'caisse', type: 'out', amount: 145000, desc: 'Achat consommables soudure', fournisseur: 'Quincaillerie El Amel', date: d(19), factureStatus: 'missing' });
const missing2 = tx({ journal: 'caisse', type: 'out', amount: 62000, desc: 'Boulonnerie chantier', fournisseur: 'Quincaillerie El Amel', date: d(6), factureStatus: 'missing' });
tx({ journal: 'banque', type: 'out', amount: 380000, desc: 'Location grue chantier Blida', date: d(8), projectIdx: '0' });
tx({ journal: 'banque', type: 'in', amount: 1500000, desc: 'Avance sur travaux', date: d(5), projectIdx: '0' });

const workers = [
  { name: 'BENALI', surname: 'Karim', function: 'Chef de chantier', salary: '85000', contract: 'CDI', entry: '2022-03-01' },
  { name: 'HADJ', surname: 'Mourad', function: 'Soudeur', salary: '60000', contract: 'CDD', entry: '2025-01-10', contractEnd: d(-9) },
  { name: 'KACI', surname: 'Samir', function: 'Monteur', salary: '52000', contract: 'CDD', entry: '2025-06-01', contractEnd: d(-120) },
  { name: 'MEZIANI', surname: 'Hakima', function: 'DFC', salary: '90000', contract: 'CDI' },
];
const ym = new Date().toISOString().slice(0, 7);
const cells = {}; for (let day = 1; day <= 10; day++) { cells[`0_${day}_0`] = { val: 'P', bg: '' }; cells[`1_${day}_0`] = { val: day % 4 ? 'P' : 'A', bg: '' }; cells[`2_${day}_0`] = { val: 'P', bg: '' }; }
const kv = {
  clientNames: clients, fournisseurNames: fourn,
  clientDetails: { SAFEX: { fullname: 'SAFEX SPA', nif: '000216001234567', rc: '16/00-0012345B00', address: 'Pins Maritimes, Alger' } },
  commercialContacts: [{ category: 'fournisseur', name: 'Acier Blida', person: 'M. Rachid', phone: '0550 11 22 33', type: 'Acier' }, { category: 'client', name: 'SAFEX', person: 'Mme Amel', phone: '021 21 00 00', email: 'achats@safex.dz' }],
  situations, fournisseurs, transactions,
  missingInvoiceAlerts: [missing, missing2].map((t) => ({ transId: t.id, fournisseur: t.fournisseur, amount: t.amount, date: t.date, desc: t.desc })),
  charges: [{ label: 'Salaires', type: 'Salaires', amount: 2350000, id: nid() }, { label: 'CNAS', type: 'CNAS', amount: 410000, id: nid() }, { label: 'Loyer bureau Blida', type: 'Loyer', amount: 120000, id: nid() }, { label: 'Carburant', type: 'Carburant', amount: 95000, id: nid() }, { label: 'Téléphone et internet', type: 'Télécom', amount: 18000, id: nid() }],
  projects: [{ name: 'Centre commercial Blida', client: 'Cosider Construction', contractValue: 42000000, startDate: d(120), status: 'active', id: nid(), expenses: [{ desc: 'Achat profilés IPE', amount: 6800000, date: d(100), id: nid() }], payments: [{ amount: 9000000, ref: 'Avance de démarrage', date: d(115), id: nid() }] },
    { name: 'Hangar SAFEX Oued Smar', client: 'SAFEX', contractValue: 18000000, startDate: d(150), status: 'active', id: nid(), expenses: [{ desc: 'Tôles et pannes', amount: 7200000, date: d(130), id: nid() }], payments: [] }],
  caisseTerkmane: [{ id: nid(), type: 'in', amount: 500000, date: d(60), desc: 'Approvisionnement' }, { id: nid(), type: 'out', amount: 35000, date: d(40), beneficiaire: 'SAIDI Ahmed', reason: 'Frais de déplacement chantier' }, { id: nid(), type: 'out', amount: 120000, date: d(12), beneficiaire: 'Transport Bouzid', isFournisseur: true, reason: 'Transport de charpente' }],
  workers, workSites: [{ name: 'Centre commercial Blida', workerIds: [0, 1, 2] }],
  adminPointage: { [ym]: { cells } },
  simPicks: { 'Acier Blida': 1 },
};
for (const [k, v] of Object.entries(kv)) await c.query('INSERT INTO kv_data(key,value) VALUES($1,$2)', [k, JSON.stringify(v)]);
await c.end();
console.log('legacy demo db ready:', Object.keys(kv).length, 'keys,', transactions.length, 'transactions');

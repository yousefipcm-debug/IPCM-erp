// Sample data in the OLD ARCIS format, converted by the real migration code —
// so the demo also shows exactly what happens to existing data.
export function legacySample() {
  const d = (daysAgo: number) => { const x = new Date(); x.setDate(x.getDate() - daysAgo); return x.toISOString().slice(0, 10); };
  let id = 1700000000000; const nid = () => ++id;
  const situations: any[] = [
    { client: 'SAFEX', project: 'Hangar SAFEX Oued Smar', number: 'Situation n°1', amount: 8500000, date: d(140), contractType: 'formel', id: nid(), payments: [] },
    { client: 'SAFEX', project: 'Hangar SAFEX Oued Smar', number: 'Situation n°2', amount: 6200000, date: d(75), contractType: 'formel', id: nid(), payments: [] },
    { client: 'BLOCOTELHA Steel', project: 'Couverture SKINZIP', number: 'Situation n°4', amount: 4350000, date: d(48), contractType: 'formel', id: nid(), payments: [] },
    { client: 'Sarl Promo Mitidja', project: 'Charpente bloc B', number: 'Situation n°1', amount: 2900000, date: d(110), contractType: 'informel', id: nid(), payments: [{ amount: 500000, date: d(90), id: nid() }] },
    { client: 'EURL Hangars du Centre', project: 'Hangar stockage', number: 'Facture 07/2026', amount: 3150000, date: d(18), contractType: 'formel', id: nid(), payments: [] },
    { client: 'Cosider Construction', project: 'Centre commercial Blida', number: 'Situation n°3', amount: 11800000, date: d(9), contractType: 'formel', id: nid(), payments: [] },
  ];
  const fournisseurs: any[] = [
    { name: 'Acier Blida', ref: 'FA-2026-118', amount: 3800000, date: d(95), id: nid(), payments: [], limit: 5000000 },
    { name: 'Acier Blida', ref: 'FA-2026-162', amount: 2450000, date: d(40), id: nid(), payments: [] },
    { name: 'Transport Bouzid', ref: 'TB-331', amount: 420000, date: d(33), id: nid(), payments: [] },
    { name: 'Tôlerie Mitidja', ref: 'TM-0907', amount: 1680000, date: d(21), id: nid(), payments: [] },
    { name: 'Location Grues Atlas', ref: 'LGA-55', amount: 960000, date: d(12), id: nid(), payments: [] },
  ];
  const transactions: any[] = [];
  const tx = (o: any) => { const t = { id: nid(), projectIdx: null, cheque: null, factureStatus: o.type === 'out' ? 'not-needed' : null, ...o }; transactions.push(t); return t; };
  tx({ journal: 'banque', type: 'in', amount: 12000000, desc: 'Solde reporté', date: d(170) });
  tx({ journal: 'caisse', type: 'in', amount: 1200000, desc: 'Alimentation caisse', date: d(165) });
  const pay = (s: any, amount: number, ago: number, cheque: string) => { const t = tx({ journal: 'banque', type: 'in', amount, desc: `Règlement ${s.number}`, client: s.client, date: d(ago), cheque }); s.payments.push({ amount, date: d(ago), transId: t.id, fromJournal: true }); };
  pay(situations[0], 8500000, 100, '0045871'); pay(situations[1], 3000000, 30, '0046102'); pay(situations[2], 2000000, 20, '0046240');
  const payF = (f: any, amount: number, ago: number, journal = 'banque') => { const t = tx({ journal, type: 'out', amount, desc: `Paiement ${f.ref}`, fournisseur: f.name, date: d(ago), cheque: String(310000 + (amount % 997)) }); f.payments.push({ amount, date: d(ago), transId: t.id, fromJournal: true }); };
  payF(fournisseurs[0], 3800000, 60); payF(fournisseurs[1], 1000000, 15); payF(fournisseurs[2], 420000, 25, 'caisse');
  for (let m = 5; m >= 0; m--) {
    tx({ journal: 'banque', type: 'out', amount: 2350000, desc: 'Salaires du mois', date: d(m * 30 + 3) });
    tx({ journal: 'banque', type: 'out', amount: 410000, desc: 'CNAS', date: d(m * 30 + 6) });
    tx({ journal: 'caisse', type: 'out', amount: 85000 + m * 3000, desc: 'Carburant véhicules', date: d(m * 30 + 10) });
  }
  const m1 = tx({ journal: 'caisse', type: 'out', amount: 145000, desc: 'Achat consommables soudure', fournisseur: 'Quincaillerie El Amel', date: d(19), factureStatus: 'missing' });
  const m2 = tx({ journal: 'caisse', type: 'out', amount: 62000, desc: 'Boulonnerie chantier', fournisseur: 'Quincaillerie El Amel', date: d(6), factureStatus: 'missing' });
  tx({ journal: 'banque', type: 'out', amount: 380000, desc: 'Location grue chantier Blida', date: d(8), projectIdx: '0' });
  tx({ journal: 'banque', type: 'in', amount: 1500000, desc: 'Avance sur travaux', date: d(5), projectIdx: '0' });
  return {
    clientNames: ['SAFEX', 'BLOCOTELHA Steel', 'Sarl Promo Mitidja', 'EURL Hangars du Centre', 'Cosider Construction'],
    fournisseurNames: ['Acier Blida', 'Transport Bouzid', 'Quincaillerie El Amel', 'Tôlerie Mitidja', 'Location Grues Atlas'],
    clientDetails: { SAFEX: { fullname: 'SAFEX SPA', nif: '000216001234567', rc: '16/00-0012345B00', address: 'Pins Maritimes, Alger' } },
    commercialContacts: [{ category: 'fournisseur', name: 'Acier Blida', person: 'M. Rachid', phone: '0550 11 22 33', type: 'Acier' }, { category: 'client', name: 'SAFEX', person: 'Mme Amel', phone: '021 21 00 00', email: 'achats@safex.dz' }],
    situations, fournisseurs, transactions,
    missingInvoiceAlerts: [m1, m2].map((t) => ({ transId: t.id })),
    charges: [{ label: 'Salaires', type: 'Salaires', amount: 2350000, id: nid() }, { label: 'CNAS', type: 'CNAS', amount: 410000, id: nid() }, { label: 'Loyer bureau Blida', type: 'Loyer', amount: 120000, id: nid() }, { label: 'Carburant', type: 'Carburant', amount: 95000, id: nid() }, { label: 'Téléphone et internet', type: 'Télécom', amount: 18000, id: nid() }],
    projects: [
      { name: 'Centre commercial Blida', client: 'Cosider Construction', contractValue: 42000000, startDate: d(120), status: 'active', id: nid(), expenses: [{ desc: 'Achat profilés IPE', amount: 6800000, date: d(100), id: nid() }], payments: [{ amount: 9000000, ref: 'Avance de démarrage', date: d(115), id: nid() }] },
      { name: 'Hangar SAFEX Oued Smar', client: 'SAFEX', contractValue: 18000000, startDate: d(150), status: 'active', id: nid(), expenses: [{ desc: 'Tôles et pannes', amount: 7200000, date: d(130), id: nid() }], payments: [] },
    ],
    caisseTerkmane: [{ id: nid(), type: 'in', amount: 500000, date: d(60), desc: 'Approvisionnement' }, { id: nid(), type: 'out', amount: 35000, date: d(40), beneficiaire: 'SAIDI Ahmed', reason: 'Frais de déplacement chantier' }, { id: nid(), type: 'out', amount: 120000, date: d(12), beneficiaire: 'Transport Bouzid', isFournisseur: true, reason: 'Transport de charpente' }],
    workers: [{ name: 'BENALI', surname: 'Karim', function: 'Chef de chantier', salary: '85000' }, { name: 'HADJ', surname: 'Mourad', function: 'Soudeur', salary: '60000' }],
    workSites: [{ name: 'Centre commercial Blida', workerIds: [0, 1] }],
    simPicks: { 'Acier Blida': 1 },
  };
}

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
  const W = (name: string, surname: string, fn: string, salary: number, contract: string, entryAgo: number, endIn: number | null, phone: string, birth: string) =>
    ({ name, surname, function: fn, salary: String(salary), contract, entry: d(entryAgo), contractEnd: endIn === null ? '' : d(-endIn), phone, birth, status: 'Marié(e)', kids: '2', blood: 'O+', ss: '84' + phone.replace(/\D/g, '').slice(-8), history: [] });
  const workers = [
    W('BENALI', 'Karim', 'Chef de chantier', 85000, 'CDI', 900, null, '0550 21 34 11', '1984-03-12'),
    W('HADJ', 'Mourad', 'Soudeur', 60000, 'CDD', 300, 12, '0661 45 20 87', '1990-07-02'),
    W('SAIDI', 'Ahmed', 'Monteur charpente', 55000, 'CDD', 200, 26, '0770 12 98 45', '1993-11-19'),
    W('KACI', 'Yacine', 'Monteur charpente', 52000, 'CDD', 150, 95, '0555 63 71 02', '1996-01-25'),
    W('ZIANI', 'Samir', 'Grutier', 70000, 'CDD', 400, -5, '0662 88 10 54', '1987-05-30'),
    W('MEBARKI', 'Nadir', 'Soudeur', 58000, 'CDD', 120, 160, '0771 30 44 19', '1995-09-08'),
    W('TOUATI', 'Bilal', 'Manœuvre', 40000, 'CDD', 90, 60, '0556 77 21 30', '2000-02-14'),
    W('RAHMANI', 'Radia', 'Responsable RH', 75000, 'CDI', 700, null, '0550 90 12 77', '1991-04-03'),
    W('BELKACEM', 'Hakima', 'Comptable', 72000, 'CDI', 1100, null, '0661 02 55 48', '1988-12-21'),
    W('AMRANI', 'Cylia', 'Secrétaire', 48000, 'CDD', 260, 22, '0770 66 03 92', '1998-06-17'),
  ];
  const workSites = [
    { name: 'Centre commercial Blida', desc: 'Charpente métallique et couverture, lot 2', workerIds: [0, 1, 2, 3, 4] },
    { name: 'Hangar SAFEX Oued Smar', desc: 'Montage hangar de stockage 2 400 m²', workerIds: [5, 6] },
  ];
  // Pointage for last month and the current month up to today (old cell format "<workerIdx>_<day>_<row>")
  function pointage() {
    const out: any = {};
    const now = new Date();
    for (const back of [1, 0]) {
      const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const ym = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`;
      const last = back ? new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate() : now.getDate();
      const cells: any = {};
      workers.forEach((_, wi) => {
        const onSite = wi <= 6;
        for (let day = 1; day <= last; day++) {
          const dow = new Date(first.getFullYear(), first.getMonth(), day).getDay();
          if (dow === 5 || (!onSite && dow === 6)) continue;
          if (!back && day === last && wi >= 5) continue; // today: a few rows left to fill
          const r = (wi * 31 + day * 7 + back * 13) % 23;
          const val = r === 0 ? 'A' : r === 1 ? 'D' : r === 2 && wi === 3 ? 'M' : 'P';
          cells[`${wi}_${day}_0`] = { val, bg: wi === 0 && day === 4 ? '#93C5FD' : '' };
          if (onSite && val === 'P' && r % 5 === 0) cells[`${wi}_${day}_1`] = { val: String(2 + (r % 3)), bg: '' };
        }
      });
      out[ym] = { cells };
    }
    return out;
  }
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
    workers, workSites, adminPointage: pointage(), adminPtgLegend: [{ bg: '#93C5FD', label: 'Mission' }, { bg: '#FCD34D', label: 'Formation' }],
    hrFolders: ['Attestations de travail', 'Notes de service', 'Ordres de mission'],
    hrDocuments: [
      { title: 'Attestations de travail n°001/' + new Date().getFullYear(), date: d(20), folder: 'Attestations de travail', signerLeft: '', signerRight: 'La Direction', images: [],
        content: 'Nous soussignés, SARL IPCM BOUTEMA, attestons que M. BENALI Karim, né le 12/03/1984, est employé au sein de notre entreprise en qualité de Chef de chantier depuis le ' + d(900).split('-').reverse().join('/') + '.\n\nLa présente attestation est délivrée à l’intéressé pour servir et valoir ce que de droit.' },
      { title: 'Notes de service n°001/' + new Date().getFullYear(), date: d(8), folder: 'Notes de service', signerLeft: '', signerRight: 'La Direction', images: [],
        content: 'Il est porté à la connaissance de l’ensemble du personnel que le port des équipements de protection individuelle (casque, harnais, chaussures de sécurité) est obligatoire sur tous les chantiers.\n\nTout manquement sera sanctionné.' },
    ],
    simPicks: { 'Acier Blida': 1 },
  };
}


window.app = (() => {
  const K = {
    transactions: 'ipcm_v2_transactions',
    situations: 'ipcm_v2_situations',
    charges: 'ipcm_v2_charges',
    fournisseurs: 'ipcm_v2_fournisseurs',
    clientNames: 'ipcm_v2_clientNames',
    fournisseurNames: 'ipcm_v2_fournisseurNames',
    projects: 'ipcm_v2_projects',
    simPicks: 'ipcm_v2_simPicks',
    simCustomAmounts: 'ipcm_v2_simCustomAmounts',
    invoices: 'ipcm_v2_invoices',
    ribList: 'ipcm_v2_ribList',
    clientDetails: 'ipcm_v2_clientDetails',
    workers: 'ipcm_v2_workers',
    workSites: 'ipcm_v2_workSites',
    hrDocuments: 'ipcm_v2_hrDocuments',
    hrFolders: 'ipcm_v2_hrFolders',
    techWorkSites: 'ipcm_v2_techWorkSites',
    adminPointage: 'ipcm_v2_adminPointage'
  };

  const state = {
    transactions: [],
    situations: [],
    charges: [],
    fournisseurs: [],
    clientNames: [],
    fournisseurNames: [],
    projects: [],
    currentJournal: null,
    payingIdx: null,
    editingTransIdx: null,
    editingSitIdx: null,
    editingChgIdx: null,
    payingFIdx: null,
    limitIdx: null,
    editingProjectIdx: null,
    workers: [],
    editingWorkerIdx: null,
    workSites: [],
    editingWorkSiteIdx: null,
    hrDocuments: [],
    editingHrDocumentIdx: null,
    hrFolders: [],
    currentHrFolder: 'Tous',
    techWorkSites: [],
    editingTechWorkSiteIdx: null,
    currentTechProjectIdx: null,
    currentTechTab: 'pointage',
    adminPointage: {},
    adminPointageDate: null
  };

  let _invLines = [];

  const PANEL_META = {
    overview: { title: "Vue d'ensemble", sub: "Le pouls de ton entreprise aujourd'hui" },
    alerts: { title: 'Alertes', sub: 'Tout ce qui demande ton attention' },
    projets: { title: 'Projets / Chantiers', sub: 'Suivi par projet â€” contrat, dÃ©penses, paiements' },
    journaux: { title: 'Journaux', sub: 'Caisse, banque, et mouvements' },
    situations: { title: 'Situations', sub: 'Factures et paiements clients' },
    'clients-summary': { title: 'Clients', sub: 'Vue globale par client' },
    aging: { title: 'Balance Ã¢gÃ©e', sub: 'CrÃ©ances par anciennetÃ©' },
    forecast: { title: 'PrÃ©visionnel', sub: 'Cash flow projetÃ©' },
    charges: { title: 'Charges mensuelles', sub: 'Ton burn rate fixe' },
    fournisseurs: { title: 'Fournisseurs', sub: 'Dettes fournisseurs' },
    simulateur: { title: 'Simulateur', sub: 'Planifie tes paiements et vois l\'impact sur ta trÃ©sorerie' },
    facturation: { title: 'Facturation', sub: 'Ã‰mettre et gÃ©rer les factures clients' },
    workers: { title: 'Personnel', sub: 'Gestion des ressources humaines' },
    'work-sites': { title: 'Chantiers (RH)', sub: 'Gestion des chantiers et affectation du personnel' },
    'hr-documents': { title: 'Documents RH', sub: 'RÃ©daction et gestion des documents administratifs' },
    'hr-contracts': { title: 'Suivi Contrat', sub: 'Historique et suivi des contrats du personnel' },
    'hr-notifications': { title: 'Notification', sub: 'Alertes et notifications importantes' },
    'tech-work-sites': { title: 'Chantiers (Tech)', sub: 'Suivi technique des chantiers' },
    'tech-project-detail': { title: 'Projet', sub: 'Pointage et rapports du chantier' },
    'tech-admin-pointage': { title: 'Pointage Admin', sub: 'Feuille de prÃ©sence journaliÃ¨re â€” tous les travailleurs' }
  };

  const fmt = (n) => n === null || n === undefined || isNaN(n) ? 'â€”' : new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' DZD';
  const fmtShort = (n) => {
    if (n === null || n === undefined || isNaN(n)) return 'â€”';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  };
  const fmtDZD = (n) => fmtShort(n) + ' DZD';
  const daysBetween = (d1, d2) => Math.floor((d2 - d1) / 86400000);
  const todayISO = () => new Date().toISOString().slice(0,10);
  const parseD = (s) => s ? new Date(s) : null;

  function load(k, fb) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }
    catch(e) { return fb; }
  }
  function save(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); showToast('âœ“ EnregistrÃ©'); }
    catch(e) { console.error(e); }
  }
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1800);
  }

  function loadAll() {
    state.transactions = load(K.transactions, []);
    state.situations = load(K.situations, []);
    state.charges = load(K.charges, []);
    state.fournisseurs = load(K.fournisseurs, []);
    state.clientNames = load(K.clientNames, []);
    state.fournisseurNames = load(K.fournisseurNames, []);
    state.projects = load(K.projects, []);
    state.simPicks = load(K.simPicks, {});
    state.simCustomAmounts = load(K.simCustomAmounts, {});
    state.invoices = load(K.invoices, []);
    state.ribList = load(K.ribList, []);
    state.clientDetails = load(K.clientDetails, {});
    state.workers = load(K.workers, []);
    state.workSites = load(K.workSites, []);
    state.hrDocuments = load(K.hrDocuments, []);
    state.hrFolders = load(K.hrFolders, []);
    state.techWorkSites = load(K.techWorkSites, []);
    state.adminPointage = load(K.adminPointage, {});
    const _now = new Date();
    state.adminPointageMonth = _now.getMonth();
    state.adminPointageYear  = _now.getFullYear();
    renderAll();
  }

  function journalBalance(journal) {
    return state.transactions
      .filter(t => t.journal === journal)
      .reduce((sum, t) => sum + (t.type === 'in' ? t.amount : -t.amount), 0);
  }

  function sitPaid(s) {
    return (s.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  }
  function sitRemaining(s) {
    return (s.amount || 0) - sitPaid(s);
  }
  function sitIsPaid(s) {
    return sitRemaining(s) <= 0;
  }
  function totalCreances() {
    return state.situations
      .filter(s => !sitIsPaid(s))
      .reduce((sum, s) => sum + sitRemaining(s), 0);
  }

  function fPaid(f) {
    return (f.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  }
  function fRemaining(f) {
    return (f.amount || 0) - fPaid(f);
  }
  function fIsPaid(f) {
    return fRemaining(f) <= 0;
  }
  function totalDettes() {
    return state.fournisseurs.filter(f => !fIsPaid(f)).reduce((sum, f) => sum + fRemaining(f), 0);
  }

  function chgTotal() {
    return state.charges.reduce((s, c) => s + (c.amount || 0), 0);
  }

  function runway() {
    const monthly = chgTotal();
    const tres = journalBalance('caisse') + journalBalance('banque');
    return monthly <= 0 ? Infinity : tres / monthly;
  }

  function fmtRunway(months) {
    if (months === Infinity) return 'âˆž';
    if (months >= 12) {
      const years = Math.floor(months / 12);
      const rem = Math.round(months % 12);
      return rem > 0 ? `${years} an${years > 1 ? 's' : ''} et ${rem} mois` : `${years} an${years > 1 ? 's' : ''}`;
    }
    if (months < 2) {
      return `${months.toFixed(1)} mois`;
    }
    return `${months.toFixed(1)} mois`;
  }

  function agingBuckets() {
    const now = new Date();
    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    state.situations.filter(s => !sitIsPaid(s) && s.date).forEach(s => {
      const days = daysBetween(parseD(s.date), now);
      const rem = sitRemaining(s);
      if (days <= 30) buckets['0-30'] += rem;
      else if (days <= 60) buckets['31-60'] += rem;
      else if (days <= 90) buckets['61-90'] += rem;
      else buckets['90+'] += rem;
    });
    return buckets;
  }

  function forecastBalance() {
    const tres = journalBalance('caisse') + journalBalance('banque');
    const creances = totalCreances();
    const monthlyChg = chgTotal();
    return tres + creances - monthlyChg;
  }

  function computeAlerts() {
    const a = [];
    const tres = journalBalance('caisse') + journalBalance('banque');
    const r = runway();
    const ch = chgTotal();
    const buckets = agingBuckets();
    const informal = state.situations.some(s => s.contractType === 'informel' && !sitIsPaid(s));
    const totalDebts = totalDettes();
    
    if (tres > 0 && totalDebts >= tres * 0.5) {
      const pct = Math.round(100 * totalDebts / tres);
      a.push({ level: pct >= 80 ? 'red' : 'warn', title: `Dettes fournisseurs Ã  ${pct}% de ta trÃ©sorerie`, desc: `Tu dois ${fmtDZD(totalDebts)} et tu as ${fmtDZD(tres)} en banque.` });
    }

    if (informal) a.push({ level: 'red', title: 'Client informel actif', desc: 'CrÃ©ance non sÃ©curisÃ©e juridiquement.' });
    if (ch > 0 && tres < ch) a.push({ level: 'red', title: 'TrÃ©sorerie < 1 mois de charges', desc: `Tu as ${fmtDZD(tres)}, charges ${fmtDZD(ch)}.` });
    else if (r < 4 && ch > 0) a.push({ level: 'red', title: 'Runway critique', desc: `${fmtRunway(r)} restants.` });
    else if (r < 7 && ch > 0) a.push({ level: 'warn', title: 'Runway Ã  surveiller', desc: `${fmtRunway(r)}.` });
    if (buckets['61-90'] > 0) a.push({ level: 'warn', title: '61-90 jours de retard', desc: `${fmtDZD(buckets['61-90'])} Ã  relancer.` });
    if (buckets['90+'] > 0) a.push({ level: 'red', title: '+90 jours de retard', desc: `${fmtDZD(buckets['90+'])} â€” envisager action en justice.` });
    state.fournisseurs.filter(f => !fIsPaid(f) && f.limit > 0).forEach(f => {
      const rem = fRemaining(f);
      if (rem >= f.limit) {
        a.push({ level: 'red', title: `Fournisseur: ${f.name}`, desc: `Dette atteint le seuil d'alerte. Action requise.` });
      }
    });
    if (a.length === 0) a.push({ level: 'ok', title: 'Aucune alerte', desc: 'Tout est sous contrÃ´le.' });
    
    // Contract expiration alerts
    const today = new Date();
    state.workers.forEach(w => {
      if (w.contractEnd) {
        const end = parseD(w.contractEnd);
        if (end) {
          const days = daysBetween(today, end);
          if (days >= 0 && days <= 15) {
            a.push({ level: 'red', title: `Contrat de ${w.name} ${w.surname} expire bientÃ´t`, desc: `Expire le ${w.contractEnd} (${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}).` });
          } else if (days < 0) {
            a.push({ level: 'red', title: `Contrat de ${w.name} ${w.surname} expirÃ©`, desc: `Ã‰tait prÃ©vu pour le ${w.contractEnd}.` });
          }
        }
      }
    });

    return a;
  }

  function renderOverview() {
    const tres = journalBalance('caisse') + journalBalance('banque');
    const cr = totalCreances();
    const ch = chgTotal();
    const r = runway();
    const alerts = computeAlerts();
    const reds = alerts.filter(a => a.level === 'red').length;
    const bankBalance = journalBalance('banque') + journalBalance('caisse');
    const dettes = totalDettes();
    const dettesPct = bankBalance > 0 ? dettes / bankBalance : 0;

    const runwayColor = r >= 7 ? 'ok' : r >= 4 ? 'warn' : 'danger';
    const dettesColor = dettesPct >= 0.5 ? 'danger' : dettes > 0 ? 'warn' : '';

    const tresColor = tres >= 20000000 ? 'ok' : tres >= 15000000 ? 'warn' : 'danger';

    const kpis = [
      { label: 'TrÃ©sorerie', val: fmtDZD(tres), color: tresColor },
      { label: 'CrÃ©ances', val: fmtDZD(cr), color: cr >= 5000000 ? 'danger' : cr > 0 ? 'ok' : '' },
      { label: 'Dettes fournisseurs', val: fmtDZD(dettes), color: dettesColor },
      { label: 'Charges/mois', val: fmtDZD(ch), color: '' },
      { label: 'Runway', val: fmtRunway(r), color: ch > 0 ? runwayColor : '' }
    ];
    document.getElementById('kpi-overview').innerHTML = kpis.map(k => `
      <div class="kpi-card ${k.color === 'danger' ? 'danger flash' : k.color === 'warn' ? 'kpi-warn' : k.color === 'ok' ? 'kpi-ok' : ''}">
        <div class="kpi-top"><p class="kpi-lbl">${k.label}</p></div>
        <p class="kpi-val">${k.val}</p>
      </div>`).join('');

    const journals = [
      { name: 'Caisse', bal: journalBalance('caisse'), count: state.transactions.filter(t => t.journal === 'caisse').length },
      { name: 'Banque', bal: journalBalance('banque'), count: state.transactions.filter(t => t.journal === 'banque').length },
      { name: 'Clients', bal: totalCreances(), count: state.situations.filter(s => !sitIsPaid(s)).length }
    ];
    document.getElementById('journal-summary').innerHTML = journals.map(j => `
      <div class="journal-card">
        <p class="journal-title">${j.name}</p>
        <p class="journal-balance">${fmtDZD(j.bal)}</p>
        <p class="journal-hint">${j.count} entrÃ©e(s)</p>
      </div>`).join('');
  }

  function renderAlerts() {
    const alerts = computeAlerts();
    const colors = { red: 'danger', warn: 'warn', ok: 'ok' };
    document.getElementById('alerts-list').innerHTML = alerts.map(a => `
      <div class="badge b-${colors[a.level]}" style="display:block; margin-bottom:8px; padding:10px 12px; text-align:left;">
        <div style="font-weight:600; margin-bottom:2px;">${a.title}</div>
        <div style="font-size:11px; opacity:0.9;">${a.desc}</div>
      </div>`).join('');
    document.getElementById('nav-alerts').classList.toggle('has-alert', alerts.some(a => a.level === 'red'));
  }

  function renderJournaux() {
    document.getElementById('journal-caisse-bal').textContent = fmtDZD(journalBalance('caisse'));
    document.getElementById('journal-banque-bal').textContent = fmtDZD(journalBalance('banque'));
    document.getElementById('journal-clients-bal').textContent = fmtDZD(totalCreances());

    const cCount = state.transactions.filter(t => t.journal === 'caisse').length;
    const bCount = state.transactions.filter(t => t.journal === 'banque').length;
    const sitCount = state.situations.filter(s => !sitIsPaid(s)).length;
    document.getElementById('journal-caisse-hint').textContent = `${cCount} mouvement(s)`;
    document.getElementById('journal-banque-hint').textContent = `${bCount} mouvement(s)`;
    document.getElementById('journal-clients-hint').textContent = `${sitCount} impayÃ©e(s)`;

    const sorted = state.transactions.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const recent = sorted.slice(0, 20);
    const el = document.getElementById('transactions-recent-table');
    if (recent.length === 0) {
      el.innerHTML = '<div class="empty-state">Aucun mouvement encore.</div>';
    } else {
      el.innerHTML = `<table class="mod">
        <thead><tr><th>Date</th><th>Journal</th><th>Description</th><th style="text-align:right">Montant</th><th></th></tr></thead>
        <tbody>${recent.map(t => {
          const realIdx = state.transactions.indexOf(t);
          return `<tr>
          <td>${t.date}</td>
          <td><span class="badge b-neutral">${t.journal}</span></td>
          <td>${t.desc || 'â€”'}</td>
          <td style="text-align:right; font-weight:600; color:${t.type === 'in' ? 'var(--ok-text)' : 'var(--danger-text)'}">
            ${t.type === 'in' ? '+' : 'âˆ’'}${fmtDZD(t.amount)}
          </td>
          <td style="text-align:right; white-space:nowrap;">
            <button class="ghost-btn" title="Modifier" onclick="app.editTransaction(${realIdx})">&#9998;</button>
            <button class="ghost-btn" title="Supprimer" onclick="app.deleteTransaction(${realIdx})">Ã—</button>
          </td>
        </tr>`;}).join('')}</tbody></table>`;
    }
  }

  function renderSituations() {
    document.getElementById('kpi-creances').textContent = fmtDZD(totalCreances());
    document.getElementById('kpi-situations-unpaid').textContent = state.situations.filter(s => !sitIsPaid(s)).length;

    const el = document.getElementById('situations-table');
    if (state.situations.length === 0) {
      el.innerHTML = '<div class="empty-state">Aucune situation encore.</div>';
      return;
    }
    const now = new Date();
    const sortedIndices = state.situations.map((s, i) => i).sort((a, b) => {
      const da = state.situations[a].date || '';
      const db = state.situations[b].date || '';
      return da.localeCompare(db);
    });
    el.innerHTML = `<table class="mod">
      <thead><tr><th>Client</th><th>Projet</th><th>Situation</th><th style="text-align:right">FacturÃ©</th><th style="text-align:right">PayÃ©</th><th style="text-align:right">Restant</th><th>Statut</th><th></th></tr></thead>
      <tbody>${sortedIndices.map(i => {
        const s = state.situations[i];
        const days = s.date ? daysBetween(parseD(s.date), now) : null;
        const paid = sitPaid(s);
        const rem = sitRemaining(s);
        const isDone = sitIsPaid(s);
        let badge;
        if (isDone) badge = '<span class="badge b-ok"><span class="bd"></span>SoldÃ©e</span>';
        else if (s.contractType === 'informel') badge = '<span class="badge b-danger"><span class="bd"></span>Informel</span>';
        else if (days > 90) badge = `<span class="badge b-danger"><span class="bd"></span>+90j</span>`;
        else if (days > 60) badge = `<span class="badge b-warn"><span class="bd"></span>61-90j</span>`;
        else if (days > 30) badge = `<span class="badge b-warn"><span class="bd"></span>31-60j</span>`;
        else badge = '<span class="badge b-info"><span class="bd"></span>0-30j</span>';

        const paymentsHist = (s.payments || []).length > 0
          ? `<div style="margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
              ${(s.payments || []).map((p, pi) =>
                `<div style="font-size:11px; color:var(--text-secondary); display:flex; justify-content:space-between; align-items:center; padding:3px 0;">
                  <span>${p.date}</span>
                  <span style="display:flex; align-items:center; gap:6px;">
                    <span style="color:var(--ok-text); font-weight:600;">+${fmtDZD(p.amount)}</span>
                    <button onclick="app.deleteSituationPayment(${i},${pi})" style="background:none; border:1px solid var(--danger-text); border-radius:4px; color:var(--danger-text); font-size:11px; padding:1px 5px; cursor:pointer; font-weight:bold; line-height:1;">Ã—</button>
                  </span>
                </div>`
              ).join('')}
            </div>` : '';

        const paidPct = s.amount > 0 ? Math.round(100 * paid / s.amount) : 0;
        const progressBar = !isDone && paid > 0
          ? `<div style="margin-top:6px; height:3px; background:var(--bg-muted); border-radius:2px; overflow:hidden;">
              <div style="height:100%; width:${paidPct}%; background:var(--ok-text); border-radius:2px;"></div>
            </div>` : '';

        return `<tr>
          <td style="font-weight:600">${s.client}</td>
          <td>${s.project || 'â€”'}</td>
          <td>${s.number || 'â€”'}</td>
          <td style="text-align:right">${fmtDZD(s.amount)}</td>
          <td style="text-align:right; color:var(--ok-text); font-weight:600">${paid > 0 ? fmtDZD(paid) : 'â€”'}</td>
          <td style="text-align:right; font-weight:600; color:${isDone ? 'var(--ok-text)' : 'var(--danger-text)'}">${isDone ? '0 DZD' : fmtDZD(rem)}</td>
          <td>
            ${badge}
            ${progressBar}
            ${paymentsHist}
          </td>
          <td style="text-align:right; white-space:nowrap;">
            ${!isDone ? `<button class="btn-secondary" style="font-size:11px; height:26px; padding:0 8px; margin-right:4px;" onclick="app.openPartialPayment(${i})">Paiement</button>` : ''}
            <button class="ghost-btn" title="Modifier" onclick="app.editSituation(${i})">&#9998;</button>
            <button class="ghost-btn" title="Supprimer" onclick="app.deleteSituation(${i})">Ã—</button>
          </td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }

  function renderAging() {
    const buckets = agingBuckets();
    const total = Object.values(buckets).reduce((a, b) => a + b, 0);
    document.getElementById('aging-report').innerHTML = `
      <div class="aging-table">
        <div class="aging-cell header">Tranche</div>
        <div class="aging-cell header">0-30 jours</div>
        <div class="aging-cell header">31-60 jours</div>
        <div class="aging-cell header">61-90 jours</div>
        <div class="aging-cell header">+90 jours</div>
        <div class="aging-cell">Montant</div>
        <div class="aging-cell num">${fmtDZD(buckets['0-30'])}</div>
        <div class="aging-cell num warn">${fmtDZD(buckets['31-60'])}</div>
        <div class="aging-cell num warn">${fmtDZD(buckets['61-90'])}</div>
        <div class="aging-cell num danger">${fmtDZD(buckets['90+'])}</div>
        <div class="aging-cell" style="font-weight:600;">Total</div>
        <div class="aging-cell num" style="font-weight:600;" colspan="4">${fmtDZD(total)}</div>
      </div>`;
  }

  function renderForecast() {
    const proj = forecastBalance();
    const tres = journalBalance('caisse') + journalBalance('banque');
    const delta = proj - tres;
    document.getElementById('kpi-forecast-30').textContent = fmtDZD(proj);
    document.getElementById('kpi-forecast-30-hint').textContent = delta > 0 ? `+${fmtDZD(delta)} vs. aujourd'hui` : `${fmtDZD(delta)} vs. aujourd'hui`;

    const upcoming = [
      { desc: 'CrÃ©ances clients Ã  encaisser', amount: totalCreances(), type: 'in' },
      { desc: 'Charges fixes du mois', amount: chgTotal(), type: 'out' }
    ];
    document.getElementById('forecast-table').innerHTML = `<table class="mod">
      <thead><tr><th>Description</th><th style="text-align:right">Montant</th></tr></thead>
      <tbody>${upcoming.map(u => `<tr>
        <td>${u.desc}</td>
        <td style="text-align:right; font-weight:600; color:${u.type === 'in' ? 'var(--ok-text)' : 'var(--danger-text)'}">
          ${u.type === 'in' ? '+' : 'âˆ’'}${fmtDZD(u.amount)}
        </td>
      </tr>`).join('')}</table>`;
  }

  function renderCharges() {
    document.getElementById('kpi-charges').textContent = fmtDZD(chgTotal());
    const r = runway();
    document.getElementById('kpi-runway').textContent = fmtRunway(r);

    const el = document.getElementById('charges-table');
    if (state.charges.length === 0) {
      el.innerHTML = '<div class="empty-state">Aucune charge encore.</div>';
      return;
    }
    const labels = {};
    el.innerHTML = `<table class="mod">
      <thead><tr><th>LibellÃ©</th><th>Type</th><th style="text-align:right">Montant/mois</th><th></th></tr></thead>
      <tbody>${state.charges.map((c, i) => `<tr>
        <td style="font-weight:600">${c.label}</td>
        <td><span class="badge b-info">${c.type || 'â€”'}</span></td>
        <td style="text-align:right; font-weight:600">${fmtDZD(c.amount)}</td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="ghost-btn" title="Modifier" onclick="app.editCharge(${i})">&#9998;</button>
          <button class="ghost-btn" title="Supprimer" onclick="app.deleteCharge(${i})">Ã—</button>
        </td>
      </tr>`).join('')}</tbody></table>`;
  }

  function renderFournisseurs() {
    document.getElementById('kpi-dettes').textContent = fmtDZD(totalDettes());
    const uniqueSuppliers = [...new Set(state.fournisseurs.filter(f => !fIsPaid(f)).map(f => f.name))];
    document.getElementById('kpi-fournisseurs-count').textContent = uniqueSuppliers.length;

    // Supplier names list
    const namesEl = document.getElementById('fournisseur-names-list');
    if (state.fournisseurNames.length === 0) {
      namesEl.innerHTML = '';
    } else {
      namesEl.innerHTML = `<div style="display:flex; flex-wrap:wrap; gap:6px;">${state.fournisseurNames.map((n, i) =>
        `<span class="badge b-info" style="font-size:12px; padding:5px 10px; gap:8px;">
          ${n}
          <button class="ghost-btn" onclick="app.deleteFournisseurName(${i})" style="font-size:14px; padding:0 2px; min-width:auto; min-height:auto; color:inherit;">Ã—</button>
        </span>`
      ).join('')}</div>`;
    }

    // Populate dropdown
    const fSel = document.getElementById('f-name');
    if (fSel) {
      fSel.innerHTML = '<option value="">â€” SÃ©lectionner â€”</option>' +
        state.fournisseurNames.map(n => `<option value="${n}">${n}</option>`).join('');
    }

    // Situations table sorted by date
    const el = document.getElementById('fournisseurs-table');
    if (state.fournisseurs.length === 0) {
      el.innerHTML = '<div class="empty-state">Aucune situation fournisseur encore.</div>';
    } else {
      const now = new Date();
      const sortedIndices = state.fournisseurs.map((f, i) => i).sort((a, b) => {
        const da = state.fournisseurs[a].date || '';
        const db = state.fournisseurs[b].date || '';
        return da.localeCompare(db);
      });
      el.innerHTML = `<table class="mod">
        <thead><tr><th>Fournisseur</th><th>RÃ©f</th><th style="text-align:right">DÃ»</th><th style="text-align:right">PayÃ©</th><th style="text-align:right">Restant</th><th>Statut</th><th></th></tr></thead>
        <tbody>${sortedIndices.map(i => {
          const f = state.fournisseurs[i];
          const paid = fPaid(f);
          const rem = fRemaining(f);
          const isDone = fIsPaid(f);
          const days = f.date ? daysBetween(parseD(f.date), now) : null;
          const overLimit = f.limit > 0 && rem >= f.limit;
          let badge;
          if (isDone) badge = '<span class="badge b-ok">SoldÃ©e</span>';
          else if (overLimit) badge = '<span class="badge b-danger">Alerte</span>';
          else if (days > 60) badge = '<span class="badge b-warn">+60j</span>';
          else if (days > 30) badge = '<span class="badge b-warn">+30j</span>';
          else badge = '<span class="badge b-info">OK</span>';

          const paidPct = f.amount > 0 ? Math.round(100 * paid / f.amount) : 0;
          const progressBar = !isDone && paid > 0
            ? `<div style="margin-top:4px; height:3px; background:var(--bg-muted); border-radius:2px; overflow:hidden;">
                <div style="height:100%; width:${paidPct}%; background:var(--ok-text); border-radius:2px;"></div>
              </div>` : '';

          return `<tr>
            <td style="font-weight:600">${f.name}</td>
            <td style="color:var(--text-secondary)">${f.ref || 'â€”'}</td>
            <td style="text-align:right">${fmtDZD(f.amount)}</td>
            <td style="text-align:right; color:var(--ok-text); font-weight:600">${paid > 0 ? fmtDZD(paid) : 'â€”'}</td>
            <td style="text-align:right; font-weight:600; color:${isDone ? 'var(--ok-text)' : 'var(--danger-text)'}">${isDone ? '0 DZD' : fmtDZD(rem)}</td>
            <td>
              ${badge}
              ${progressBar}
            </td>
            <td style="text-align:right; white-space:nowrap;">
              ${!isDone ? `<button class="btn-secondary" style="font-size:11px; height:26px; padding:0 8px; margin-right:4px;" onclick="app.openFournisseurPay(${i})">Payer</button>` : ''}
              <button class="ghost-btn" title="Limite" onclick="app.openLimitModal(${i})" style="font-size:14px;">&#9881;</button>
              <button class="ghost-btn" title="Supprimer" onclick="app.deleteFournisseur(${i})">Ã—</button>
            </td>
          </tr>`;
        }).join('')}</table>`;
    }

    // Summary cards per supplier
    const supplierMap = {};
    state.fournisseurs.forEach(f => {
      const name = f.name || 'Inconnu';
      if (!supplierMap[name]) supplierMap[name] = { situations: [], totalDue: 0, totalPaid: 0 };
      supplierMap[name].situations.push(f);
      supplierMap[name].totalDue += (f.amount || 0);
      supplierMap[name].totalPaid += fPaid(f);
    });

    const summaryEl = document.getElementById('fournisseurs-summary-cards');
    const suppliers = Object.entries(supplierMap);
    if (suppliers.length === 0) {
      summaryEl.innerHTML = '';
      return;
    }

    summaryEl.innerHTML = suppliers.map(([name, data]) => {
      const remaining = data.totalDue - data.totalPaid;
      const paidPct = data.totalDue > 0 ? Math.round(100 * data.totalPaid / data.totalDue) : 0;
      const unpaidCount = data.situations.filter(f => !fIsPaid(f)).length;
      const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

      const sitRows = data.situations.slice().sort((a,b) => (a.date||'').localeCompare(b.date||'')).map(f => {
        const rem = fRemaining(f);
        const isDone = fIsPaid(f);
        return `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px;">
          <span>${f.ref || f.date || 'â€”'}</span>
          <span style="display:flex; align-items:center; gap:8px;">
            <span style="color:var(--text-secondary)">${fmtDZD(f.amount)}</span>
            <span style="font-weight:600; color:${isDone ? 'var(--ok-text)' : 'var(--danger-text)'}">${isDone ? 'soldÃ©e' : fmtDZD(rem)}</span>
          </span>
        </div>`;
      }).join('');

      const allPayments = [];
      data.situations.forEach(f => {
        const fIdx = state.fournisseurs.indexOf(f);
        (f.payments || []).forEach((p, pi) => {
          allPayments.push({ date: p.date, amount: p.amount, ref: f.ref || 'â€”', fIdx, payIdx: pi });
        });
      });
      allPayments.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      const payHistHtml = allPayments.length > 0
        ? `<div style="margin-top:14px;">
            <p style="font-size:11px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 8px;">Historique des paiements</p>
            <div style="border:1px solid var(--border); border-radius:8px; overflow:hidden;">
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr 30px; background:var(--bg-muted); padding:8px 12px; font-size:10px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">
                <span>Date</span><span>RÃ©f</span><span style="text-align:right;">Montant</span><span></span>
              </div>
              ${allPayments.map(p =>
                `<div style="display:grid; grid-template-columns:1fr 1fr 1fr 30px; padding:8px 12px; font-size:12px; border-top:1px solid var(--border); align-items:center;">
                  <span style="color:var(--text-secondary);">${p.date}</span>
                  <span style="color:var(--text-secondary);">${p.ref}</span>
                  <span style="text-align:right; font-weight:600; color:var(--ok-text);">âˆ’${fmtDZD(p.amount)}</span>
                  <button onclick="app.deleteFournisseurPayment(${p.fIdx},${p.payIdx})" style="background:none; border:1px solid var(--danger-text); border-radius:4px; color:var(--danger-text); font-size:11px; padding:1px 5px; cursor:pointer; font-weight:bold; line-height:1;">Ã—</button>
                </div>`
              ).join('')}
            </div>
          </div>` : '';

      return `<div class="card fournisseur-card" style="margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
          <div style="width:40px; height:40px; border-radius:10px; background:var(--warn-bg); display:flex; align-items:center; justify-content:center; font-weight:600; font-size:13px; color:var(--warn-text); flex-shrink:0;">${initials}</div>
          <div style="flex:1;">
            <p style="font-weight:600; margin:0; font-size:14px;">${name}</p>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">${data.situations.length} situation(s) Â· ${unpaidCount} impayÃ©e(s)</div>
          </div>
          <button class="print-btn" onclick="app.printFournisseur(this, '${name.replace(/'/g, "\\'")}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Imprimer</button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:14px;">
          <div style="background:var(--bg-muted); border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 4px;">Total dÃ»</p>
            <p style="font-size:16px; font-weight:600; margin:0;">${fmtDZD(data.totalDue)}</p>
          </div>
          <div style="background:var(--bg-muted); border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:var(--ok-text); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 4px;">PayÃ©</p>
            <p style="font-size:16px; font-weight:600; margin:0; color:var(--ok-text);">${fmtDZD(data.totalPaid)}</p>
          </div>
          <div style="background:${remaining > 0 ? 'var(--danger-bg)' : 'var(--ok-bg)'}; border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:${remaining > 0 ? 'var(--danger-text)' : 'var(--ok-text)'}; text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 4px;">Restant</p>
            <p style="font-size:16px; font-weight:600; margin:0; color:${remaining > 0 ? 'var(--danger-text)' : 'var(--ok-text)'};">${fmtDZD(remaining)}</p>
          </div>
        </div>
        <div style="height:4px; background:var(--bg-muted); border-radius:2px; overflow:hidden; margin-bottom:14px;">
          <div style="height:100%; width:${paidPct}%; background:var(--ok-text); border-radius:2px;"></div>
        </div>
        <p style="font-size:11px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 6px;">DÃ©tail des situations</p>
        ${sitRows}
        ${payHistHtml}
      </div>`;
    }).join('');
  }

  function renderTopPills() {
    const r = runway(), ch = chgTotal();
    const reds = computeAlerts().filter(a => a.level === 'red').length;
    let pills = [];
    if (reds > 0) pills.push(`<span class="pill pill-danger"><span class="dot"></span>${reds} alerte(s)</span>`);
    if (ch > 0) {
      if (r < 4) pills.push(`<span class="pill pill-danger">Runway ${fmtRunway(r)}</span>`);
      else if (r < 7) pills.push(`<span class="pill pill-warn">Runway ${fmtRunway(r)}</span>`);
      else pills.push(`<span class="pill pill-ok">Runway ${fmtRunway(r)}</span>`);
    }
    pills.push(`<span class="pill">${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>`);
    document.getElementById('top-pills').innerHTML = pills.join('');
    const mobilePills = document.getElementById('mobile-pills');
    if (mobilePills) mobilePills.innerHTML = pills.slice(0, 2).join('');
    const mobileAlerts = document.getElementById('mobile-nav-alerts');
    if (mobileAlerts) mobileAlerts.classList.toggle('has-alert', reds > 0);
  }

  function renderAll() {
    document.getElementById('foot-date').textContent = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    renderOverview();
    renderAlerts();
    renderProjets();
    renderJournaux();
    renderSimulateur();
    renderSituations();
    renderClientsSummary();
    renderClientNamesList();
    renderAging();
    renderForecast();
    renderCharges();
    renderFournisseurs();
    renderTopPills();
    renderFacturation();
    renderInvoices();
    renderRibs();
    renderWorkers();
    renderWorkSites();
    renderHrDocuments();
    renderHrContracts();
    renderHrNotifications();
    renderTechWorkSites();
    renderAdminPointage();
  }

  function updateTransSitDropdowns() {
    const type = document.getElementById('trans-type').value;
    const clientField = document.getElementById('trans-client-field');
    const fournField = document.getElementById('trans-fourn-field');
    
    if (type === 'in') {
      clientField.style.display = 'flex';
      fournField.style.display = 'none';
      // Group unpaid situations by client
      const clientTotals = {};
      state.situations.forEach(s => {
        if (!sitIsPaid(s) && s.client) {
          if (!clientTotals[s.client]) clientTotals[s.client] = 0;
          clientTotals[s.client] += sitRemaining(s);
        }
      });
      const sel = document.getElementById('trans-client-sit');
      sel.innerHTML = '<option value="">â€” Aucun client â€”</option>' +
        Object.entries(clientTotals).map(([name, total]) =>
          `<option value="${name}">${name} â€” Restant total: ${fmtDZD(total)}</option>`
        ).join('');
    } else {
      clientField.style.display = 'none';
      fournField.style.display = 'flex';
      // Group unpaid situations by fournisseur
      const fournTotals = {};
      state.fournisseurs.forEach(f => {
        if (!fIsPaid(f) && f.name) {
          if (!fournTotals[f.name]) fournTotals[f.name] = 0;
          fournTotals[f.name] += fRemaining(f);
        }
      });
      const sel = document.getElementById('trans-fourn-sit');
      sel.innerHTML = '<option value="">â€” Aucun fournisseur â€”</option>' +
        Object.entries(fournTotals).map(([name, total]) =>
          `<option value="${name}">${name} â€” Restant total: ${fmtDZD(total)}</option>`
        ).join('');
    }
  }

  function openTransactionModal(journal) {
    state.currentJournal = journal;
    state.editingTransIdx = null;
    document.getElementById('transaction-modal-title').textContent = `Nouveau mouvement â€” ${journal.charAt(0).toUpperCase() + journal.slice(1)}`;
    document.getElementById('trans-date').value = todayISO();
    document.getElementById('trans-type').value = 'in';
    const projSel = document.getElementById('trans-project');
    projSel.innerHTML = '<option value="">â€” Aucun projet â€”</option>' +
      state.projects.filter(p => p.status === 'active').map((p, i) => {
        const realIdx = state.projects.indexOf(p);
        return `<option value="${realIdx}">${p.name}</option>`;
      }).join('');
    updateTransSitDropdowns();
    document.getElementById('transaction-modal').classList.add('active');
  }

  function closeTransactionModal() {
    document.getElementById('transaction-modal').classList.remove('active');
    document.getElementById('trans-amount').value = '';
    document.getElementById('trans-desc').value = '';
    document.getElementById('trans-project').value = '';
    document.getElementById('trans-client-sit').value = '';
    document.getElementById('trans-fourn-sit').value = '';
    state.editingTransIdx = null;
  }

  function saveTransaction() {
    const type = document.getElementById('trans-type').value;
    const amount = parseFloat(document.getElementById('trans-amount').value) || 0;
    const desc = document.getElementById('trans-desc').value.trim();
    const date = document.getElementById('trans-date').value || todayISO();
    const projectIdx = document.getElementById('trans-project').value;
    if (amount <= 0) { alert('Montant requis'); return; }
    if (state.editingTransIdx !== null) {
      state.transactions[state.editingTransIdx] = { journal: state.currentJournal, type, amount, desc, date, projectIdx: projectIdx || null, id: state.transactions[state.editingTransIdx].id };
      state.editingTransIdx = null;
    } else {
      const transId = Date.now();
      state.transactions.push({ journal: state.currentJournal, type, amount, desc, date, projectIdx: projectIdx || null, id: transId });
      // Link to project
      if (projectIdx !== '') {
        const pIdx = parseInt(projectIdx);
        if (state.projects[pIdx]) {
          if (type === 'out') {
            state.projects[pIdx].expenses.push({ desc: desc || `${state.currentJournal} sortie`, amount, date, id: transId, fromJournal: true, transId });
          } else if (type === 'in') {
            state.projects[pIdx].payments.push({ amount, ref: desc || `${state.currentJournal} entrÃ©e`, date, id: transId, fromJournal: true, transId });
          }
          save(K.projects, state.projects);
        }
      }
      // Link to client situations (money in) â€” cascade oldest first
      if (type === 'in') {
        const clientName = document.getElementById('trans-client-sit').value;
        if (clientName) {
          let remaining = amount;
          // Get unpaid situations for this client, sorted by date (oldest first)
          const clientSits = state.situations
            .map((s, i) => ({ sit: s, idx: i }))
            .filter(x => x.sit.client === clientName && !sitIsPaid(x.sit))
            .sort((a, b) => (a.sit.date || '').localeCompare(b.sit.date || ''));
          
          for (const { sit, idx } of clientSits) {
            if (remaining <= 0) break;
            const rem = sitRemaining(sit);
            const payAmount = Math.min(remaining, rem);
            if (!state.situations[idx].payments) state.situations[idx].payments = [];
            state.situations[idx].payments.push({ amount: payAmount, date, id: transId, fromJournal: true, transId });
            remaining -= payAmount;
          }
          save(K.situations, state.situations);
        }
      }
      // Link to fournisseur situations (money out) â€” cascade oldest first
      if (type === 'out') {
        const fournName = document.getElementById('trans-fourn-sit').value;
        if (fournName) {
          let remaining = amount;
          const fournSits = state.fournisseurs
            .map((f, i) => ({ four: f, idx: i }))
            .filter(x => x.four.name === fournName && !fIsPaid(x.four))
            .sort((a, b) => (a.four.date || '').localeCompare(b.four.date || ''));
          
          for (const { four, idx } of fournSits) {
            if (remaining <= 0) break;
            const rem = fRemaining(four);
            const payAmount = Math.min(remaining, rem);
            if (!state.fournisseurs[idx].payments) state.fournisseurs[idx].payments = [];
            state.fournisseurs[idx].payments.push({ amount: payAmount, date, id: transId, fromJournal: true, transId });
            remaining -= payAmount;
          }
          save(K.fournisseurs, state.fournisseurs);
        }
      }
    }
    save(K.transactions, state.transactions);
    closeTransactionModal();
    renderAll();
  }

  function openSituationModal() {
    state.editingSitIdx = null;
    populateClientDropdown('');
    document.getElementById('sit-date').value = todayISO();
    document.getElementById('situation-modal').classList.add('active');
  }

  function closeSituationModal() {
    document.getElementById('situation-modal').classList.remove('active');
    ['sit-number','sit-amount'].forEach(id => document.getElementById(id).value = '');
    state.editingSitIdx = null;
  }

  function saveSituation() {
    const client = document.getElementById('sit-client').value;
    const project = document.getElementById('sit-project').value.trim();
    const number = document.getElementById('sit-number').value.trim();
    const amount = parseFloat(document.getElementById('sit-amount').value) || 0;
    const date = document.getElementById('sit-date').value || todayISO();
    const contractType = document.getElementById('sit-contract-type').value;
    if (!client || amount <= 0) { alert('Client et montant requis'); return; }
    if (state.editingSitIdx !== null) {
      const old = state.situations[state.editingSitIdx];
      state.situations[state.editingSitIdx] = { client, project, number, amount, date, contractType, payments: old.payments || [], id: old.id };
      state.editingSitIdx = null;
    } else {
      state.situations.push({ client, project, number, amount, date, contractType, payments: [], id: Date.now() });
    }
    save(K.situations, state.situations);
    closeSituationModal();
    renderAll();
  }

  function openPartialPayment(idx) {
    state.payingIdx = idx;
    const s = state.situations[idx];
    const rem = sitRemaining(s);
    document.getElementById('pp-modal-info').textContent = `${s.client} â€” ${s.number || s.project || 'Situation'} â€” Restant: ${fmtDZD(rem)}`;
    document.getElementById('pp-amount').value = '';
    document.getElementById('pp-amount').max = rem;
    document.getElementById('pp-amount').placeholder = `Max ${Math.round(rem)}`;
    document.getElementById('pp-date').value = todayISO();
    document.getElementById('pp-full-check').checked = false;
    document.getElementById('pp-amount').disabled = false;
    document.getElementById('partial-payment-modal').classList.add('active');
  }

  function closePartialPayment() {
    document.getElementById('partial-payment-modal').classList.remove('active');
    state.payingIdx = null;
  }

  function toggleFullPayment() {
    const checked = document.getElementById('pp-full-check').checked;
    const s = state.situations[state.payingIdx];
    const rem = sitRemaining(s);
    if (checked) {
      document.getElementById('pp-amount').value = Math.round(rem);
      document.getElementById('pp-amount').disabled = true;
    } else {
      document.getElementById('pp-amount').value = '';
      document.getElementById('pp-amount').disabled = false;
    }
  }

  function savePartialPayment() {
    const idx = state.payingIdx;
    if (idx === null || idx === undefined) return;
    const amount = parseFloat(document.getElementById('pp-amount').value) || 0;
    const date = document.getElementById('pp-date').value || todayISO();
    const rem = sitRemaining(state.situations[idx]);
    if (amount <= 0) { alert('Montant requis'); return; }
    const finalAmount = Math.min(amount, rem);
    if (!state.situations[idx].payments) state.situations[idx].payments = [];
    state.situations[idx].payments.push({ amount: finalAmount, date, id: Date.now() });
    save(K.situations, state.situations);
    closePartialPayment();
    renderAll();
  }

  function deleteSituation(idx) {
    if (!confirm('Supprimer cette situation ?')) return;
    state.situations.splice(idx, 1);
    save(K.situations, state.situations);
    renderAll();
  }

  function deleteCharge(idx) {
    if (!confirm('Supprimer cette charge ?')) return;
    state.charges.splice(idx, 1);
    save(K.charges, state.charges);
    renderAll();
  }

  function deleteTransaction(idx) {
    if (!confirm('Supprimer ce mouvement ?')) return;
    const t = state.transactions[idx];
    const transId = t.id;
    
    // Remove linked payments from client situations
    state.situations.forEach(s => {
      if (s.payments) {
        s.payments = s.payments.filter(p => p.transId !== transId);
      }
    });
    save(K.situations, state.situations);
    
    // Remove linked payments from fournisseur situations
    state.fournisseurs.forEach(f => {
      if (f.payments) {
        f.payments = f.payments.filter(p => p.transId !== transId);
      }
    });
    save(K.fournisseurs, state.fournisseurs);
    
    // Remove linked expenses/payments from projects
    state.projects.forEach(p => {
      if (p.expenses) p.expenses = p.expenses.filter(e => e.transId !== transId);
      if (p.payments) p.payments = p.payments.filter(v => v.transId !== transId);
    });
    save(K.projects, state.projects);
    
    state.transactions.splice(idx, 1);
    save(K.transactions, state.transactions);
    renderAll();
  }

  function editTransaction(idx) {
    const t = state.transactions[idx];
    state.editingTransIdx = idx;
    state.currentJournal = t.journal;
    document.getElementById('transaction-modal-title').textContent = `Modifier mouvement â€” ${t.journal.charAt(0).toUpperCase() + t.journal.slice(1)}`;
    document.getElementById('trans-type').value = t.type;
    document.getElementById('trans-amount').value = t.amount;
    document.getElementById('trans-desc').value = t.desc || '';
    document.getElementById('trans-date').value = t.date;
    document.getElementById('transaction-modal').classList.add('active');
  }

  function editSituation(idx) {
    const s = state.situations[idx];
    state.editingSitIdx = idx;
    populateClientDropdown(s.client || '');
    document.getElementById('sit-project').value = s.project || '';
    document.getElementById('sit-number').value = s.number || '';
    document.getElementById('sit-amount').value = s.amount || '';
    document.getElementById('sit-date').value = s.date || '';
    document.getElementById('sit-contract-type').value = s.contractType || 'formel';
    document.getElementById('situation-modal').classList.add('active');
  }

  function editCharge(idx) {
    const c = state.charges[idx];
    state.editingChgIdx = idx;
    document.getElementById('ch-label').value = c.label || '';
    document.getElementById('ch-type').value = c.type || '';
    document.getElementById('ch-amount').value = c.amount || '';
    document.getElementById('btn-add-charge').textContent = 'Modifier';
  }

  function addClientName() {
    const name = document.getElementById('cl-name').value.trim();
    if (!name) { alert('Nom requis'); return; }
    if (state.clientNames.includes(name)) { alert('Ce client existe dÃ©jÃ '); return; }
    state.clientNames.push(name);
    save(K.clientNames, state.clientNames);
    document.getElementById('cl-name').value = '';
    renderAll();
  }

  function deleteClientName(idx) {
    if (!confirm('Supprimer ce client de la liste ?')) return;
    state.clientNames.splice(idx, 1);
    save(K.clientNames, state.clientNames);
    renderAll();
  }

  function populateClientDropdown(selectedValue) {
    const sel = document.getElementById('sit-client');
    sel.innerHTML = '<option value="">â€” SÃ©lectionner un client â€”</option>' +
      state.clientNames.map(n => `<option value="${n}" ${n === selectedValue ? 'selected' : ''}>${n}</option>`).join('');
  }

  function renderClientNamesList() {
    const el = document.getElementById('client-names-list');
    if (state.clientNames.length === 0) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = `<div style="display:flex; flex-wrap:wrap; gap:6px;">${state.clientNames.map((n, i) =>
      `<span class="badge b-info" style="font-size:12px; padding:5px 10px; gap:8px;">
        ${n}
        <button class="ghost-btn" onclick="app.deleteClientName(${i})" style="font-size:14px; padding:0 2px; min-width:auto; min-height:auto; color:inherit;">Ã—</button>
      </span>`
    ).join('')}</div>`;
  }

  function populateProjectClientDropdown() {
    const sel = document.getElementById('pj-client');
    if (!sel) return;
    sel.innerHTML = '<option value="">â€” SÃ©lectionner â€”</option>' +
      state.clientNames.map(n => `<option value="${n}">${n}</option>`).join('');
  }

  function addProject() {
    const name = document.getElementById('pj-name').value.trim();
    const client = document.getElementById('pj-client').value;
    const value = parseFloat(document.getElementById('pj-value').value) || 0;
    const start = document.getElementById('pj-start').value || todayISO();
    if (!name || value <= 0) { alert('Nom et valeur contrat requis'); return; }
    state.projects.push({
      name, client, contractValue: value, startDate: start,
      expenses: [], payments: [], status: 'active', id: Date.now()
    });
    save(K.projects, state.projects);
    ['pj-name','pj-value','pj-start'].forEach(id => document.getElementById(id).value = '');
    renderAll();
  }

  function deleteProject(idx) {
    if (!confirm('Supprimer ce projet et tout son historique ?')) return;
    state.projects.splice(idx, 1);
    save(K.projects, state.projects);
    renderAll();
  }

  function toggleProjectStatus(idx) {
    state.projects[idx].status = state.projects[idx].status === 'active' ? 'terminÃ©' : 'active';
    save(K.projects, state.projects);
    renderAll();
  }

  function openProjectExpense(idx) {
    state.editingProjectIdx = idx;
    const p = state.projects[idx];
    document.getElementById('pe-modal-info').textContent = `DÃ©pense pour : ${p.name}`;
    document.getElementById('pe-date').value = todayISO();
    document.getElementById('pe-desc').value = '';
    document.getElementById('pe-amount').value = '';
    document.getElementById('project-expense-modal').classList.add('active');
  }

  function closeProjectExpense() {
    document.getElementById('project-expense-modal').classList.remove('active');
  }

  function saveProjectExpense() {
    const idx = state.editingProjectIdx;
    const desc = document.getElementById('pe-desc').value.trim();
    const amount = parseFloat(document.getElementById('pe-amount').value) || 0;
    const date = document.getElementById('pe-date').value || todayISO();
    if (amount <= 0) { alert('Montant requis'); return; }
    state.projects[idx].expenses.push({ desc, amount, date, id: Date.now() });
    save(K.projects, state.projects);
    closeProjectExpense();
    renderAll();
  }

  function openProjectPayment(idx) {
    state.editingProjectIdx = idx;
    const p = state.projects[idx];
    const totalReceived = p.payments.reduce((s, v) => s + v.amount, 0);
    const remaining = p.contractValue - totalReceived;
    document.getElementById('pp2-modal-info').textContent = `${p.name} â€” Reste Ã  recevoir: ${fmtDZD(remaining)}`;
    document.getElementById('pp2-date').value = todayISO();
    document.getElementById('pp2-amount').value = '';
    document.getElementById('pp2-ref').value = '';
    document.getElementById('project-payment-modal').classList.add('active');
  }

  function closeProjectPayment() {
    document.getElementById('project-payment-modal').classList.remove('active');
  }

  function saveProjectPayment() {
    const idx = state.editingProjectIdx;
    const amount = parseFloat(document.getElementById('pp2-amount').value) || 0;
    const ref = document.getElementById('pp2-ref').value.trim();
    const date = document.getElementById('pp2-date').value || todayISO();
    if (amount <= 0) { alert('Montant requis'); return; }
    state.projects[idx].payments.push({ amount, ref, date, id: Date.now() });
    save(K.projects, state.projects);
    closeProjectPayment();
    renderAll();
  }

  function deleteProjectExpense(pIdx, eIdx) {
    if (!confirm('Supprimer cette dÃ©pense ?')) return;
    state.projects[pIdx].expenses.splice(eIdx, 1);
    save(K.projects, state.projects);
    renderAll();
  }

  function deleteProjectPayment(pIdx, pPayIdx) {
    if (!confirm('Supprimer ce paiement ?')) return;
    state.projects[pIdx].payments.splice(pPayIdx, 1);
    save(K.projects, state.projects);
    renderAll();
  }

  function renderProjets() {
    const activeProjects = state.projects.filter(p => p.status === 'active');
    const allValue = state.projects.reduce((s, p) => s + (p.contractValue || 0), 0);
    const allReceived = state.projects.reduce((s, p) => s + p.payments.reduce((ss, v) => ss + v.amount, 0), 0);
    const allSpent = state.projects.reduce((s, p) => s + p.expenses.reduce((ss, v) => ss + v.amount, 0), 0);

    document.getElementById('kpi-projets-actifs').textContent = activeProjects.length;
    document.getElementById('kpi-projets-valeur').textContent = fmtDZD(allValue);
    const globalMargin = allValue - allSpent;
    const margeEl = document.getElementById('kpi-projets-marge');
    margeEl.textContent = (globalMargin >= 0 ? '+' : '') + fmtDZD(globalMargin);
    margeEl.style.color = globalMargin >= 0 ? 'var(--ok-text)' : 'var(--danger-text)';

    populateProjectClientDropdown();

    const el = document.getElementById('projets-cards');
    if (state.projects.length === 0) {
      el.innerHTML = '<div class="empty-state">Aucun projet encore. Ajoute ton premier projet au-dessus.</div>';
      return;
    }

    el.innerHTML = state.projects.map((p, i) => {
      const totalReceived = p.payments.reduce((s, v) => s + v.amount, 0);
      const totalSpent = p.expenses.reduce((s, v) => s + v.amount, 0);
      const remaining = p.contractValue - totalReceived;
      const margin = p.contractValue - totalSpent;
      const pctReceived = p.contractValue > 0 ? Math.round(100 * totalReceived / p.contractValue) : 0;
      const pctSpent = p.contractValue > 0 ? Math.round(100 * totalSpent / p.contractValue) : 0;

      let statusBadge, statusColor;
      if (p.status === 'terminÃ©') { statusBadge = '<span class="badge b-neutral">TerminÃ©</span>'; statusColor = ''; }
      else if (margin < 0) { statusBadge = '<span class="badge b-danger">DÃ©ficit</span>'; statusColor = 'var(--danger-text)'; }
      else if (remaining <= 0) { statusBadge = '<span class="badge b-ok">SoldÃ©</span>'; statusColor = 'var(--ok-text)'; }
      else if (totalReceived > totalSpent) { statusBadge = '<span class="badge b-ok">Rentable</span>'; statusColor = 'var(--ok-text)'; }
      else { statusBadge = '<span class="badge b-warn">En cours</span>'; statusColor = 'var(--warn-text)'; }

      const expenseRows = (p.expenses || []).slice().sort((a,b) => (a.date||'').localeCompare(b.date||'')).map((e, ei) =>
        `<div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid var(--border); font-size:12px;">
          <span style="color:var(--text-secondary)">${e.date}</span>
          <span style="flex:1; margin:0 10px;">${e.desc || 'â€”'}</span>
          <span style="font-weight:600; color:var(--danger-text);">âˆ’${fmtDZD(e.amount)}</span>
          <button class="ghost-btn" onclick="app.deleteProjectExpense(${i},${ei})" style="font-size:14px; padding:2px 4px; min-width:auto; min-height:auto;">Ã—</button>
        </div>`
      ).join('');

      const paymentRows = (p.payments || []).slice().sort((a,b) => (a.date||'').localeCompare(b.date||'')).map((v, vi) =>
        `<div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid var(--border); font-size:12px;">
          <span style="color:var(--text-secondary)">${v.date}</span>
          <span style="flex:1; margin:0 10px;">${v.ref || 'â€”'}</span>
          <span style="font-weight:600; color:var(--ok-text);">+${fmtDZD(v.amount)}</span>
          <button class="ghost-btn" onclick="app.deleteProjectPayment(${i},${vi})" style="font-size:14px; padding:2px 4px; min-width:auto; min-height:auto;">Ã—</button>
        </div>`
      ).join('');

      return `<div class="card" style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
          <div>
            <p style="font-weight:700; font-size:16px; margin:0;">${p.name}</p>
            <p style="font-size:12px; color:var(--text-secondary); margin:2px 0 0;">Client: ${p.client || 'â€”'} Â· DÃ©but: ${p.startDate || 'â€”'}</p>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            ${statusBadge}
            <button class="btn-secondary" style="font-size:11px; height:26px; padding:0 8px;" onclick="app.toggleProjectStatus(${i})">${p.status === 'active' ? 'Terminer' : 'RÃ©activer'}</button>
            <button class="ghost-btn" onclick="app.deleteProject(${i})">Ã—</button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px; margin-bottom:14px;">
          <div style="background:var(--bg-muted); border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 4px;">Contrat</p>
            <p style="font-size:16px; font-weight:600; margin:0;">${fmtDZD(p.contractValue)}</p>
          </div>
          <div style="background:var(--bg-muted); border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:var(--ok-text); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 4px;">ReÃ§u (${pctReceived}%)</p>
            <p style="font-size:16px; font-weight:600; margin:0; color:var(--ok-text);">${fmtDZD(totalReceived)}</p>
          </div>
          <div style="background:var(--bg-muted); border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:var(--danger-text); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 4px;">DÃ©pensÃ© (${pctSpent}%)</p>
            <p style="font-size:16px; font-weight:600; margin:0; color:var(--danger-text);">${fmtDZD(totalSpent)}</p>
          </div>
          <div style="background:${margin >= 0 ? 'var(--ok-bg)' : 'var(--danger-bg)'}; border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:${margin >= 0 ? 'var(--ok-text)' : 'var(--danger-text)'}; text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 4px;">Marge</p>
            <p style="font-size:16px; font-weight:600; margin:0; color:${margin >= 0 ? 'var(--ok-text)' : 'var(--danger-text)'};">${margin >= 0 ? '+' : ''}${fmtDZD(margin)}</p>
          </div>
        </div>

        <div style="display:flex; gap:4px; margin-bottom:14px;">
          <div style="flex:${pctReceived}; height:6px; background:var(--ok-text); border-radius:3px 0 0 3px;"></div>
          <div style="flex:${Math.max(0, pctSpent - pctReceived)}; height:6px; background:var(--danger-text);"></div>
          <div style="flex:${Math.max(0, 100 - Math.max(pctReceived, pctSpent))}; height:6px; background:var(--bg-muted); border-radius:0 3px 3px 0;"></div>
        </div>

        <p style="font-size:12px; color:var(--text-secondary); margin:0 0 14px;">
          Reste Ã  recevoir : <strong>${fmtDZD(remaining)}</strong>
        </p>

        <div style="display:flex; gap:6px; margin-bottom:14px;">
          <button class="btn-secondary" onclick="app.openProjectPayment(${i})">+ Paiement reÃ§u</button>
          <button class="btn-secondary" onclick="app.openProjectExpense(${i})">+ DÃ©pense</button>
          <button class="print-btn" onclick="app.printPage(event, 'Projet: ${p.name}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Imprimer</button>
        </div>

        ${paymentRows ? `<div style="margin-bottom:10px;">
          <p style="font-size:11px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 6px;">Paiements reÃ§us</p>
          ${paymentRows || '<div style="font-size:12px; color:var(--text-tertiary); padding:4px 0;">Aucun paiement encore.</div>'}
        </div>` : ''}

        ${expenseRows ? `<div>
          <p style="font-size:11px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 6px;">DÃ©penses</p>
          ${expenseRows || '<div style="font-size:12px; color:var(--text-tertiary); padding:4px 0;">Aucune dÃ©pense encore.</div>'}
        </div>` : ''}
      </div>`;
    }).join('');
  }

  function addFournisseurName() {
    const name = document.getElementById('fn-name').value.trim();
    if (!name) { alert('Nom requis'); return; }
    if (state.fournisseurNames.includes(name)) { alert('Ce fournisseur existe dÃ©jÃ '); return; }
    state.fournisseurNames.push(name);
    save(K.fournisseurNames, state.fournisseurNames);
    document.getElementById('fn-name').value = '';
    renderAll();
  }

  function deleteFournisseurName(idx) {
    if (!confirm('Supprimer ce fournisseur de la liste ?')) return;
    state.fournisseurNames.splice(idx, 1);
    save(K.fournisseurNames, state.fournisseurNames);
    renderAll();
  }

  function addFournisseur() {
    const name = document.getElementById('f-name').value;
    const amount = parseFloat(document.getElementById('f-amount').value) || 0;
    const date = document.getElementById('f-date').value || todayISO();
    const ref = document.getElementById('f-ref').value.trim();
    if (!name || amount <= 0) { alert('Fournisseur et montant requis'); return; }
    state.fournisseurs.push({ name, amount, date, ref, payments: [], limit: 0, id: Date.now() });
    save(K.fournisseurs, state.fournisseurs);
    ['f-amount','f-date','f-ref'].forEach(id => document.getElementById(id).value = '');
    renderAll();
  }

  function deleteFournisseur(idx) {
    if (!confirm('Supprimer ce fournisseur ?')) return;
    state.fournisseurs.splice(idx, 1);
    save(K.fournisseurs, state.fournisseurs);
    renderAll();
  }

  function openFournisseurPay(idx) {
    state.payingFIdx = idx;
    const f = state.fournisseurs[idx];
    const rem = fRemaining(f);
    document.getElementById('fp-modal-info').textContent = `${f.name} â€” Restant: ${fmtDZD(rem)}`;
    document.getElementById('fp-amount').value = '';
    document.getElementById('fp-amount').placeholder = `Max ${Math.round(rem)}`;
    document.getElementById('fp-date').value = todayISO();
    document.getElementById('fp-full-check').checked = false;
    document.getElementById('fp-amount').disabled = false;
    document.getElementById('fournisseur-pay-modal').classList.add('active');
  }

  function closeFournisseurPay() {
    document.getElementById('fournisseur-pay-modal').classList.remove('active');
    state.payingFIdx = null;
  }

  function toggleFournisseurFull() {
    const checked = document.getElementById('fp-full-check').checked;
    const f = state.fournisseurs[state.payingFIdx];
    const rem = fRemaining(f);
    if (checked) {
      document.getElementById('fp-amount').value = Math.round(rem);
      document.getElementById('fp-amount').disabled = true;
    } else {
      document.getElementById('fp-amount').value = '';
      document.getElementById('fp-amount').disabled = false;
    }
  }

  function saveFournisseurPay() {
    const idx = state.payingFIdx;
    if (idx === null || idx === undefined) return;
    const amount = parseFloat(document.getElementById('fp-amount').value) || 0;
    const date = document.getElementById('fp-date').value || todayISO();
    const rem = fRemaining(state.fournisseurs[idx]);
    if (amount <= 0) { alert('Montant requis'); return; }
    const finalAmount = Math.min(amount, rem);
    if (!state.fournisseurs[idx].payments) state.fournisseurs[idx].payments = [];
    state.fournisseurs[idx].payments.push({ amount: finalAmount, date, id: Date.now() });
    save(K.fournisseurs, state.fournisseurs);
    closeFournisseurPay();
    renderAll();
  }

  function openLimitModal(idx) {
    state.limitIdx = idx;
    const f = state.fournisseurs[idx];
    document.getElementById('limit-modal-info').textContent = `DÃ©finir un seuil d'alerte pour: ${f.name}`;
    document.getElementById('limit-amount').value = f.limit || '';
    document.getElementById('limit-modal').classList.add('active');
  }

  function closeLimitModal() {
    document.getElementById('limit-modal').classList.remove('active');
    state.limitIdx = null;
  }

  function saveLimit() {
    const idx = state.limitIdx;
    if (idx === null || idx === undefined) return;
    const amount = parseFloat(document.getElementById('limit-amount').value) || 0;
    state.fournisseurs[idx].limit = amount;
    save(K.fournisseurs, state.fournisseurs);
    closeLimitModal();
    renderAll();
  }

  function clearLimit() {
    const idx = state.limitIdx;
    if (idx === null || idx === undefined) return;
    state.fournisseurs[idx].limit = 0;
    save(K.fournisseurs, state.fournisseurs);
    closeLimitModal();
    renderAll();
  }

  function renderClientsSummary() {
    const clientMap = {};
    state.situations.forEach(s => {
      const name = s.client || 'Inconnu';
      if (!clientMap[name]) clientMap[name] = { situations: [], totalInvoiced: 0, totalPaid: 0, informal: false };
      clientMap[name].situations.push(s);
      clientMap[name].totalInvoiced += (s.amount || 0);
      clientMap[name].totalPaid += sitPaid(s);
      if (s.contractType === 'informel') clientMap[name].informal = true;
    });

    const clients = Object.entries(clientMap);
    document.getElementById('kpi-clients-total').textContent = fmtDZD(totalCreances());
    document.getElementById('kpi-clients-count').textContent = state.clientNames.length;

    if (clients.length === 0) {
      document.getElementById('clients-summary-cards').innerHTML = '<div class="empty-state">Aucun client encore.</div>';
      return;
    }

    const now = new Date();
    document.getElementById('clients-summary-cards').innerHTML = clients.map(([name, data]) => {
      const remaining = data.totalInvoiced - data.totalPaid;
      const paidPct = data.totalInvoiced > 0 ? Math.round(100 * data.totalPaid / data.totalInvoiced) : 0;
      const unpaidCount = data.situations.filter(s => !sitIsPaid(s)).length;
      const paidCount = data.situations.filter(s => sitIsPaid(s)).length;
      const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

      const sitRows = data.situations.map(s => {
        const rem = sitRemaining(s);
        const isDone = sitIsPaid(s);
        const days = s.date ? daysBetween(parseD(s.date), now) : null;
        let statusBadge;
        if (isDone) statusBadge = '<span class="badge b-ok" style="font-size:10px;">SoldÃ©e</span>';
        else if (days > 60) statusBadge = '<span class="badge b-danger" style="font-size:10px;">+60j</span>';
        else if (days > 30) statusBadge = '<span class="badge b-warn" style="font-size:10px;">+30j</span>';
        else statusBadge = '<span class="badge b-info" style="font-size:10px;">OK</span>';

        return `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px;">
          <span>${s.number || s.project || 'â€”'}</span>
          <span style="display:flex; align-items:center; gap:8px;">
            <span style="color:var(--text-secondary)">${fmtDZD(s.amount)}</span>
            <span style="font-weight:600; color:${isDone ? 'var(--ok-text)' : 'var(--danger-text)'}">${isDone ? 'soldÃ©e' : fmtDZD(rem)}</span>
            ${statusBadge}
          </span>
        </div>`;
      }).join('');

      const allPayments = [];
      data.situations.forEach(s => {
        const sitIdx = state.situations.indexOf(s);
        (s.payments || []).forEach((p, pi) => {
          allPayments.push({ date: p.date, amount: p.amount, situation: s.number || s.project || 'â€”', sitIdx, payIdx: pi });
        });
      });
      allPayments.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      const paymentHistoryHtml = allPayments.length > 0
        ? `<div style="margin-top:14px;">
            <p style="font-size:11px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 8px;">Historique des paiements</p>
            <div style="border:1px solid var(--border); border-radius:8px; overflow:hidden;">
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr 30px; background:var(--bg-muted); padding:8px 12px; font-size:10px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">
                <span>Date</span><span>Situation</span><span style="text-align:right;">Montant</span><span></span>
              </div>
              ${allPayments.map(p =>
                `<div style="display:grid; grid-template-columns:1fr 1fr 1fr 30px; padding:8px 12px; font-size:12px; border-top:1px solid var(--border); align-items:center;">
                  <span style="color:var(--text-secondary);">${p.date}</span>
                  <span style="color:var(--text-secondary);">${p.situation}</span>
                  <span style="text-align:right; font-weight:600; color:var(--ok-text);">+${fmtDZD(p.amount)}</span>
                  <button onclick="app.deleteSituationPayment(${p.sitIdx},${p.payIdx})" style="background:none; border:1px solid var(--danger-text); border-radius:4px; color:var(--danger-text); font-size:11px; padding:1px 5px; cursor:pointer; font-weight:bold; line-height:1;">Ã—</button>
                </div>`
              ).join('')}
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr 30px; padding:8px 12px; font-size:12px; border-top:1px solid var(--border); background:var(--bg-muted);">
                <span style="font-weight:600;">Total</span><span></span>
                <span style="text-align:right; font-weight:600; color:var(--ok-text);">+${fmtDZD(allPayments.reduce((s,p) => s + p.amount, 0))}</span>
                <span></span>
              </div>
            </div>
          </div>` : '';

      return `<div class="card" style="margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
          <div style="width:40px; height:40px; border-radius:10px; background:${data.informal ? 'var(--danger-bg)' : 'var(--info-bg)'}; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:13px; color:${data.informal ? 'var(--danger-text)' : 'var(--info-text)'}; flex-shrink:0;">${initials}</div>
          <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <p style="font-weight:600; margin:0; font-size:14px;">${name}</p>
              ${data.informal ? '<span class="badge b-danger" style="font-size:10px;">Informel</span>' : ''}
            </div>
            <div style="display:flex; gap:12px; font-size:12px; color:var(--text-secondary); margin-top:3px;">
              <span>${data.situations.length} situation(s)</span>
              <span>${unpaidCount} impayÃ©e(s)</span>
              <span>${paidCount} soldÃ©e(s)</span>
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:14px;">
          <div style="background:var(--bg-muted); border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 4px;">FacturÃ©</p>
            <p style="font-size:16px; font-weight:600; margin:0;">${fmtDZD(data.totalInvoiced)}</p>
          </div>
          <div style="background:var(--bg-muted); border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 4px;">PayÃ©</p>
            <p style="font-size:16px; font-weight:600; margin:0; color:var(--ok-text);">${fmtDZD(data.totalPaid)}</p>
          </div>
          <div style="background:${remaining > 0 ? 'var(--danger-bg)' : 'var(--ok-bg)'}; border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:${remaining > 0 ? 'var(--danger-text)' : 'var(--ok-text)'}; text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 4px;">Restant</p>
            <p style="font-size:16px; font-weight:600; margin:0; color:${remaining > 0 ? 'var(--danger-text)' : 'var(--ok-text)'};">${fmtDZD(remaining)}</p>
          </div>
        </div>

        <div style="height:4px; background:var(--bg-muted); border-radius:2px; overflow:hidden; margin-bottom:14px;">
          <div style="height:100%; width:${paidPct}%; background:var(--ok-text); border-radius:2px;"></div>
        </div>

        <p style="font-size:11px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 6px;">DÃ©tail des situations</p>
        ${sitRows}
        ${paymentHistoryHtml}
      </div>`;
    }).join('');
  }

  function switchPanel(p) {
    state.currentPanel = p;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === p));
    document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === p));
    document.querySelectorAll('.panel').forEach(pan => pan.classList.toggle('active', pan.dataset.panel === p));
    const meta = PANEL_META[p];
    if (meta) {
      document.getElementById('page-title').textContent = meta.title;
      document.getElementById('page-sub').textContent = meta.sub;
      const mobileTitle = document.getElementById('mobile-page-title');
      if (mobileTitle) mobileTitle.textContent = meta.title;
    }
    if (p === 'tech-admin-pointage') renderAdminPointage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  document.getElementById('btn-add-charge').addEventListener('click', () => {
    const label = document.getElementById('ch-label').value.trim();
    const type = document.getElementById('ch-type').value.trim();
    const amount = parseFloat(document.getElementById('ch-amount').value) || 0;
    if (!label || amount <= 0) { alert('LibellÃ© et montant requis'); return; }
    if (state.editingChgIdx !== null) {
      state.charges[state.editingChgIdx] = { label, type, amount, id: state.charges[state.editingChgIdx].id };
      state.editingChgIdx = null;
      document.getElementById('btn-add-charge').textContent = 'Ajouter';
    } else {
      state.charges.push({ label, type, amount, id: Date.now() });
    }
    save(K.charges, state.charges);
    ['ch-label','ch-type','ch-amount'].forEach(id => document.getElementById(id).value = '');
    renderAll();
  });

  document.getElementById('btn-add-fournisseur').addEventListener('click', () => {
    addFournisseur();
  });

  // Wire up timbre fiscal dropdown to update invoice totals live
  setTimeout(() => {
    const timbre = document.getElementById('inv-timbre');
    if (timbre) timbre.addEventListener('change', () => {
      if (typeof invUpdateTotals === 'function') invUpdateTotals();
    });
    // Auto-load client fiscal details when picking client in fiscal form
    const cdClient = document.getElementById('cd-client');
    if (cdClient) cdClient.addEventListener('change', () => {
      if (cdClient.value) loadClientDetailsToForm(cdClient.value);
    });
  }, 100);

  function switchModule(name) {
    if (name === 'pilotage') return; // always open
    const items = document.getElementById('items-' + name);
    const group = document.getElementById('module-' + name);
    const btn = group ? group.querySelector('.module-btn') : null;
    if (!items) return;
    const isOpen = items.style.display !== 'none';
    items.style.display = isOpen ? 'none' : '';
    if (btn) btn.classList.toggle('active', !isOpen);
  }

  loadAll();

  function renderSimulateur() {
    try {
    const el = document.getElementById('sim-content');
    if (!el) return;

    // Group fournisseur situations by name
    const supplierMap = {};
    const allFourns = [];
    
    state.fournisseurs.forEach((f, i) => {
      const rem = fRemaining(f);
      if (rem < 1) return;
      allFourns.push(f);
      const name = f.name || 'Inconnu';
      if (!supplierMap[name]) supplierMap[name] = { factures: [], totalDebt: 0 };
      supplierMap[name].factures.push({ ref: f.ref || '', date: f.date || '', remaining: rem, idx: i });
      supplierMap[name].totalDebt += rem;
    });

    // Sort factures by date (oldest first) within each supplier
    Object.values(supplierMap).forEach(s => {
      s.factures.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    });

    const suppliers = Object.entries(supplierMap).filter(([, d]) => d.totalDebt >= 1).sort((a, b) => b[1].totalDebt - a[1].totalDebt);

    if (suppliers.length === 0) {
      el.innerHTML = '<div class="empty-state">Aucune dette fournisseur impayÃ©e.</div>';
      return;
    }

    // Init sim pick counts
    if (!state.simPicks) state.simPicks = {};

    let grandTotalToPay = 0;
    const totalAllDebt = allFourns.reduce((s, f) => s + fRemaining(f), 0);

    const cards = suppliers.map(([name, data]) => {
      const pickCount = state.simPicks[name] || 0;
      const customAmount = state.simCustomAmounts && state.simCustomAmounts[name] !== undefined ? state.simCustomAmounts[name] : null;
      const maxFact = data.factures.length;
      
      let toPay = 0;
      let highlightInfo = [];
      
      if (customAmount !== null && customAmount > 0) {
        // Custom amount mode: distribute across factures oldest first
        let remaining = customAmount;
        data.factures.forEach((f, fi) => {
          if (remaining <= 0) { highlightInfo.push({ selected: false, partial: 0 }); return; }
          if (remaining >= f.remaining) {
            highlightInfo.push({ selected: true, partial: 0 });
            remaining -= f.remaining;
            toPay += f.remaining;
          } else {
            highlightInfo.push({ selected: true, partial: remaining });
            toPay += remaining;
            remaining = 0;
          }
        });
      } else if (pickCount > 0) {
        // Pick count mode
        const selected = data.factures.slice(0, pickCount);
        toPay = selected.reduce((s, f) => s + f.remaining, 0);
        data.factures.forEach((f, fi) => {
          highlightInfo.push({ selected: fi < pickCount, partial: 0 });
        });
      } else {
        data.factures.forEach(() => highlightInfo.push({ selected: false, partial: 0 }));
      }
      
      const restAfter = data.totalDebt - toPay;
      grandTotalToPay += toPay;

      const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

      const factureRows = data.factures.map((f, fi) => {
        const info = highlightInfo[fi] || { selected: false, partial: 0 };
        const isSelected = info.selected;
        const isPartial = info.partial > 0;
        return `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; border-bottom:1px solid var(--border); font-size:12px; ${isSelected ? 'background:var(--ok-bg);' : ''}">
          <span style="${isSelected ? 'font-weight:600;' : 'opacity:0.5;'}">${fi + 1}. ${f.ref || 'â€”'}</span>
          <span style="color:var(--text-secondary);">${f.date || 'â€”'}</span>
          <span style="font-weight:600; color:${isSelected ? 'var(--ok-text)' : 'var(--text-tertiary)'};">${isPartial ? fmtDZD(info.partial) + ' / ' : ''}${fmtDZD(f.remaining)}</span>
        </div>`;
      }).join('');

      return `<div style="background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:12px; break-inside:avoid; page-break-inside:avoid;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:40px; height:40px; border-radius:10px; background:var(--warn-bg); display:flex; align-items:center; justify-content:center; font-weight:600; font-size:13px; color:var(--warn-text); flex-shrink:0;">${initials}</div>
            <div>
              <p style="font-weight:700; font-size:14px; margin:0;">${name}</p>
              <p style="font-size:11px; color:var(--text-secondary); margin:2px 0 0;">${maxFact} facture(s) impayÃ©e(s) Â· Total: ${fmtDZD(data.totalDebt)}</p>
            </div>
            <button class="sim-hide" onclick="app.simDeleteSupplier(this.dataset.name)" data-name="${name.replace(/"/g, '&quot;')}" style="background:none; border:1px solid var(--danger-text); border-radius:6px; color:var(--danger-text); font-size:12px; padding:3px 8px; cursor:pointer; font-weight:bold;">Supprimer</button>
          </div>
          <div class="sim-hide" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:4px;">
              <label style="font-size:11px; color:var(--text-secondary); font-weight:600;">Nb factures:</label>
              <input type="number" min="0" max="${maxFact}" value="${pickCount}" 
                onchange="app.simSetPick(this.dataset.name, this.value)"
                
                data-name="${name.replace(/"/g, '&quot;')}"
                style="width:50px; text-align:center; font-size:14px; font-weight:700; padding:5px; border:2px solid var(--border-strong); border-radius:8px; background:var(--bg); color:var(--text-primary); font-family:inherit;"/>
              <span style="font-size:11px; color:var(--text-tertiary);">/ ${maxFact}</span>
            </div>
            <span class="sim-hide" style="font-size:11px; color:var(--text-tertiary);">ou</span>
            <div style="display:flex; align-items:center; gap:4px;">
              <label style="font-size:11px; color:var(--text-secondary); font-weight:600;">Montant:</label>
              <input type="number" min="0" max="${data.totalDebt}" value="${state.simCustomAmounts && state.simCustomAmounts[name] !== undefined ? state.simCustomAmounts[name] : ''}" 
                placeholder="Ex. 500000"
                onchange="app.simSetAmount(this.dataset.name, this.value)"
                data-name="${name.replace(/"/g, '&quot;')}"
                step="1000"
                style="width:140px; text-align:right; font-size:14px; font-weight:700; padding:5px 8px; border:2px solid var(--border-strong); border-radius:8px; background:var(--bg); color:var(--text-primary); font-family:inherit;"/>
              <span style="font-size:11px; color:var(--text-tertiary);">DZD</span>
            </div>
          </div>
        </div>

        ${factureRows}

        ${toPay > 0 ? `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px;">
          <div style="background:var(--warn-bg); border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:var(--warn-text); text-transform:uppercase; font-weight:600; margin:0 0 4px;">Ã€ payer</p>
            <p style="font-size:16px; font-weight:700; margin:0; color:var(--warn-text);">${fmtDZD(toPay)}</p>
          </div>
          <div style="background:var(--bg-muted); border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:var(--text-tertiary); text-transform:uppercase; font-weight:600; margin:0 0 4px;">Reste aprÃ¨s</p>
            <p style="font-size:16px; font-weight:700; margin:0; color:${restAfter > 0 ? 'var(--danger-text)' : 'var(--ok-text)'};">${fmtDZD(restAfter)}</p>
          </div>
        </div>` : ''}
      </div>`;
    }).join('');

    const bankBal = journalBalance('banque') + journalBalance('caisse');
    const bankAfter = bankBal - grandTotalToPay;

    el.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px; margin-bottom:16px;">
        <div style="background:var(--bg-muted); border-radius:8px; padding:10px 12px;">
          <p style="font-size:10px; color:var(--text-tertiary); text-transform:uppercase; font-weight:600; margin:0 0 4px;">TrÃ©sorerie actuelle</p>
          <p style="font-size:16px; font-weight:700; margin:0;">${fmtDZD(bankBal)}</p>
        </div>
        <div style="background:var(--danger-bg); border-radius:8px; padding:10px 12px;">
          <p style="font-size:10px; color:var(--danger-text); text-transform:uppercase; font-weight:600; margin:0 0 4px;">Total dettes fournisseurs</p>
          <p style="font-size:16px; font-weight:700; margin:0; color:var(--danger-text);">${fmtDZD(totalAllDebt)}</p>
        </div>
        <div style="background:${grandTotalToPay > 0 ? 'var(--warn-bg)' : 'var(--bg-muted)'}; border-radius:8px; padding:10px 12px;">
          <p style="font-size:10px; color:${grandTotalToPay > 0 ? 'var(--warn-text)' : 'var(--text-tertiary)'}; text-transform:uppercase; font-weight:600; margin:0 0 4px;">Total Ã  payer</p>
          <p style="font-size:16px; font-weight:700; margin:0; color:${grandTotalToPay > 0 ? 'var(--warn-text)' : 'var(--text-tertiary)'};">${grandTotalToPay > 0 ? 'âˆ’' : ''}${fmtDZD(grandTotalToPay)}</p>
        </div>
        <div style="background:${bankAfter >= 0 ? 'var(--ok-bg)' : 'var(--danger-bg)'}; border-radius:8px; padding:10px 12px;">
          <p style="font-size:10px; color:${bankAfter >= 0 ? 'var(--ok-text)' : 'var(--danger-text)'}; text-transform:uppercase; font-weight:600; margin:0 0 4px;">Reste en banque aprÃ¨s</p>
          <p style="font-size:16px; font-weight:700; margin:0; color:${bankAfter >= 0 ? 'var(--ok-text)' : 'var(--danger-text)'};">${fmtDZD(bankAfter)}</p>
        </div>
      </div>
      ${cards}`;
    } catch(e) { 
      const el = document.getElementById('sim-content');
      if (el) el.innerHTML = '<div style="color:red; padding:12px;">Erreur: ' + e.message + '<br>Fournisseurs: ' + state.fournisseurs.length + '</div>';
      console.error('renderSimulateur error:', e); 
    }
  }

  function simSetPick(name, val) {
    if (!state.simPicks) state.simPicks = {};
    state.simPicks[name] = Math.max(0, parseInt(val) || 0);
    // Clear custom amount when using pick mode
    if (!state.simCustomAmounts) state.simCustomAmounts = {};
    delete state.simCustomAmounts[name];
    save(K.simPicks, state.simPicks);
    save(K.simCustomAmounts, state.simCustomAmounts);
    renderSimulateur();
  }

  function simDeleteSupplier(name) {
    if (!confirm('Supprimer toutes les situations de ' + name + ' ?')) return;
    state.fournisseurs = state.fournisseurs.filter(f => f.name !== name);
    save(K.fournisseurs, state.fournisseurs);
    renderAll();
  }

  function simSetAmount(name, val) {
    if (!state.simCustomAmounts) state.simCustomAmounts = {};
    const amount = Math.max(0, parseFloat(val) || 0);
    if (amount > 0) {
      state.simCustomAmounts[name] = amount;
      if (!state.simPicks) state.simPicks = {};
      state.simPicks[name] = 0;
    } else {
      delete state.simCustomAmounts[name];
    }
    save(K.simPicks, state.simPicks);
    save(K.simCustomAmounts, state.simCustomAmounts);
    renderSimulateur();
  }

  function printSimulator() {
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('print-page-info').textContent = `Simulateur de paiement â€” ${today}`;
    document.querySelectorAll('.card').forEach(c => c.classList.remove('print-target'));
    const card = document.getElementById('sim-content').closest('.card');
    if (card) card.classList.add('print-target');
    const origTitle = document.title;
    document.title = ' ';
    setTimeout(function() {
      window.print();
      setTimeout(function() {
        document.title = origTitle;
        document.querySelectorAll('.card').forEach(c => c.classList.remove('print-target'));
      }, 500);
    }, 300);
  }

  function deleteSituationPayment(sitIdx, payIdx) {
    if (!confirm('Supprimer ce paiement ?')) return;
    state.situations[sitIdx].payments.splice(payIdx, 1);
    save(K.situations, state.situations);
    renderAll();
  }

  function deleteFournisseurPayment(fIdx, payIdx) {
    if (!confirm('Supprimer ce paiement ?')) return;
    state.fournisseurs[fIdx].payments.splice(payIdx, 1);
    save(K.fournisseurs, state.fournisseurs);
    renderAll();
  }

  function exportData() {
    const data = {
      version: 2,
      exportDate: new Date().toISOString(),
      transactions: state.transactions,
      situations: state.situations,
      charges: state.charges,
      fournisseurs: state.fournisseurs,
      clientNames: state.clientNames,
      fournisseurNames: state.fournisseurNames,
      projects: state.projects,
      simPicks: state.simPicks,
      simCustomAmounts: state.simCustomAmounts,
      invoices: state.invoices || [],
      ribList: state.ribList || [],
      clientDetails: state.clientDetails || {},
      workers: state.workers || [],
      workSites: state.workSites || []
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `IPCM_BOUTEMA_backup_${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(input) {
    const file = input.files[0];
    if (!file) return;
    if (!confirm('Importer ces donnÃ©es ? Cela va remplacer toutes vos donnÃ©es actuelles.')) {
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (data.version !== 2) { alert('Format de fichier non reconnu.'); return; }
        state.transactions = data.transactions || [];
        state.situations = data.situations || [];
        state.charges = data.charges || [];
        state.fournisseurs = data.fournisseurs || [];
        state.clientNames = data.clientNames || [];
        state.fournisseurNames = data.fournisseurNames || [];
        state.projects = data.projects || [];
        state.simPicks = data.simPicks || {};
        state.simCustomAmounts = data.simCustomAmounts || {};
        state.invoices = data.invoices || [];
        state.ribList = data.ribList || [];
        state.clientDetails = data.clientDetails || {};
        state.workers = data.workers || [];
        state.workSites = data.workSites || [];
        save(K.transactions, state.transactions);
        save(K.situations, state.situations);
        save(K.charges, state.charges);
        save(K.fournisseurs, state.fournisseurs);
        save(K.clientNames, state.clientNames);
        save(K.fournisseurNames, state.fournisseurNames);
        save(K.projects, state.projects);
        save(K.simPicks, state.simPicks);
        save(K.simCustomAmounts, state.simCustomAmounts);
        save(K.invoices, state.invoices);
        save(K.ribList, state.ribList);
        save(K.clientDetails, state.clientDetails);
        save(K.workers, state.workers);
        save(K.workSites, state.workSites);
        renderAll();
        alert('âœ… DonnÃ©es importÃ©es avec succÃ¨s â€” ' + (data.exportDate ? 'Sauvegarde du ' + new Date(data.exportDate).toLocaleDateString('fr-FR') : ''));
      } catch(err) {
        alert('Erreur lors de l\'importation. VÃ©rifiez que le fichier est correct.');
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  function printPage(event, title) {
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('print-page-info').textContent = `${title} â€” ${today}`;
    document.querySelectorAll('.card').forEach(c => c.classList.remove('print-target'));
    document.querySelectorAll('.fournisseur-card').forEach(c => c.classList.remove('print-target'));
    if (event && event.target) {
      const card = event.target.closest('.card');
      if (card) card.classList.add('print-target');
    } else {
      document.querySelectorAll('.panel.active .card').forEach(c => c.classList.add('print-target'));
    }
    const origTitle = document.title;
    document.title = ' ';
    setTimeout(function() {
      window.print();
      setTimeout(function() {
        document.title = origTitle;
        document.querySelectorAll('.card').forEach(c => c.classList.remove('print-target'));
      }, 500);
    }, 300);
  }

  function printFournisseur(btn, name) {
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('print-page-info').textContent = `Situation fournisseur : ${name} â€” ${today}`;
    document.querySelectorAll('.card').forEach(c => c.classList.remove('print-target'));
    document.querySelectorAll('.fournisseur-card').forEach(c => c.classList.remove('print-target'));
    const card = btn.closest('.fournisseur-card');
    if (card) card.classList.add('print-target');
    const origTitle = document.title;
    document.title = ' ';
    setTimeout(function() {
      window.print();
      setTimeout(function() {
        document.title = origTitle;
        document.querySelectorAll('.card').forEach(c => c.classList.remove('print-target'));
        document.querySelectorAll('.fournisseur-card').forEach(c => c.classList.remove('print-target'));
      }, 500);
    }, 300);
  }

  function showFournisseurReport() {
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const supplierMap = {};
    state.fournisseurs.forEach(f => {
      const name = f.name || 'Inconnu';
      if (!supplierMap[name]) supplierMap[name] = { totalDue: 0, totalPaid: 0, count: 0, unpaid: 0 };
      supplierMap[name].totalDue += (f.amount || 0);
      supplierMap[name].totalPaid += fPaid(f);
      supplierMap[name].count++;
      if (!fIsPaid(f)) supplierMap[name].unpaid++;
    });

    const suppliers = Object.entries(supplierMap).sort((a, b) => (b[1].totalDue - b[1].totalPaid) - (a[1].totalDue - a[1].totalPaid));
    const grandTotalDue = suppliers.reduce((s, [, d]) => s + d.totalDue, 0);
    const grandTotalPaid = suppliers.reduce((s, [, d]) => s + d.totalPaid, 0);
    const grandRemaining = grandTotalDue - grandTotalPaid;
    const totalFactures = suppliers.reduce((s, [, d]) => s + d.count, 0);
    const totalUnpaid = suppliers.reduce((s, [, d]) => s + d.unpaid, 0);

    const el = document.getElementById('fournisseur-report-content');
    el.innerHTML = `
      <div style="margin-bottom:16px;">
        <p style="font-size:12px; color:var(--text-secondary); margin:0 0 12px;">Rapport gÃ©nÃ©rÃ© le ${today}</p>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px; margin-bottom:16px;">
          <div style="background:var(--bg-muted); border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:var(--text-tertiary); text-transform:uppercase; font-weight:600; margin:0 0 4px;">Fournisseurs</p>
            <p style="font-size:18px; font-weight:700; margin:0;">${suppliers.length}</p>
          </div>
          <div style="background:var(--bg-muted); border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:var(--text-tertiary); text-transform:uppercase; font-weight:600; margin:0 0 4px;">Factures</p>
            <p style="font-size:18px; font-weight:700; margin:0;">${totalFactures} <span style="font-size:11px; color:var(--danger-text);">(${totalUnpaid} impayÃ©es)</span></p>
          </div>
          <div style="background:var(--bg-muted); border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:var(--ok-text); text-transform:uppercase; font-weight:600; margin:0 0 4px;">Total payÃ©</p>
            <p style="font-size:18px; font-weight:700; margin:0; color:var(--ok-text);">${fmtDZD(grandTotalPaid)}</p>
          </div>
          <div style="background:var(--danger-bg); border-radius:8px; padding:10px 12px;">
            <p style="font-size:10px; color:var(--danger-text); text-transform:uppercase; font-weight:600; margin:0 0 4px;">Reste Ã  payer</p>
            <p style="font-size:18px; font-weight:700; margin:0; color:var(--danger-text);">${fmtDZD(grandRemaining)}</p>
          </div>
        </div>
      </div>
      <table class="mod">
        <thead><tr>
          <th>Fournisseur</th>
          <th style="text-align:center">Factures</th>
          <th style="text-align:center">ImpayÃ©es</th>
          <th style="text-align:right">Total dÃ»</th>
          <th style="text-align:right">PayÃ©</th>
          <th style="text-align:right">Restant</th>
        </tr></thead>
        <tbody>
          ${suppliers.map(([name, d]) => {
            const rem = d.totalDue - d.totalPaid;
            const pct = d.totalDue > 0 ? Math.round(100 * d.totalPaid / d.totalDue) : 0;
            return `<tr>
              <td style="font-weight:600">${name}</td>
              <td style="text-align:center">${d.count}</td>
              <td style="text-align:center; color:${d.unpaid > 0 ? 'var(--danger-text)' : 'var(--ok-text)'}; font-weight:600;">${d.unpaid}</td>
              <td style="text-align:right">${fmtDZD(d.totalDue)}</td>
              <td style="text-align:right; color:var(--ok-text);">${fmtDZD(d.totalPaid)}</td>
              <td style="text-align:right; font-weight:600; color:${rem > 0 ? 'var(--danger-text)' : 'var(--ok-text)'};">${fmtDZD(rem)}</td>
            </tr>`;
          }).join('')}
          <tr style="background:var(--bg-muted); font-weight:700;">
            <td>TOTAL</td>
            <td style="text-align:center">${totalFactures}</td>
            <td style="text-align:center; color:var(--danger-text);">${totalUnpaid}</td>
            <td style="text-align:right">${fmtDZD(grandTotalDue)}</td>
            <td style="text-align:right; color:var(--ok-text);">${fmtDZD(grandTotalPaid)}</td>
            <td style="text-align:right; color:var(--danger-text);">${fmtDZD(grandRemaining)}</td>
          </tr>
        </tbody>
      </table>`;

    document.getElementById('fournisseur-report-card').style.display = 'block';
    document.getElementById('fournisseur-report-card').scrollIntoView({ behavior: 'smooth' });
  }

  function printFournisseurReport() {
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('print-page-info').textContent = `Rapport global â€” Dettes fournisseurs â€” ${today}`;
    
    document.querySelectorAll('.card').forEach(c => c.classList.remove('print-target'));
    document.querySelectorAll('.fournisseur-card').forEach(c => c.classList.remove('print-target'));
    
    const card = document.getElementById('fournisseur-report-card');
    card.classList.add('print-target');
    
    const origTitle = document.title;
    document.title = ' ';
    setTimeout(function() {
      window.print();
      setTimeout(function() {
        document.title = origTitle;
        document.querySelectorAll('.card').forEach(c => c.classList.remove('print-target'));
      }, 500);
    }, 300);
  }

  // ========== FACTURATION ==========

  function renderFacturation() {
    const sel = document.getElementById('inv-client');
    if (sel) {
      sel.innerHTML = '<option value="">â€” Choisir â€”</option>' + state.clientNames.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    const cdSel = document.getElementById('cd-client');
    if (cdSel) {
      const currentVal = cdSel.value;
      cdSel.innerHTML = '<option value="">â€” Choisir â€”</option>' + state.clientNames.map(c => `<option value="${c}">${c}</option>`).join('');
      if (currentVal) cdSel.value = currentVal;
    }
    const numEl = document.getElementById('inv-number');
    if (numEl && !numEl.value) {
      const year = new Date().getFullYear();
      const yearInvoices = (state.invoices || []).filter(i => (i.number || '').endsWith('/' + year));
      const next = String(yearInvoices.length + 1).padStart(2, '0');
      numEl.placeholder = `${next}/${year}`;
    }
    const dateEl = document.getElementById('inv-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
    const ribSel = document.getElementById('inv-rib');
    if (ribSel) {
      ribSel.innerHTML = '<option value="">â€” Aucun â€”</option>' + (state.ribList || []).map((r, i) => `<option value="${i}">${r.bank} â€” ${r.number}</option>`).join('');
    }
    if (_invLines.length === 0) _invLines = [{ desc: '', unit: 'kg', qty: 1, pu: 0 }];
    const linesEl = document.getElementById('inv-lines');
    if (linesEl) {
      const units = ['kg', 'mÂ²', 'mÂ³', 'ml', 'U', 'ens', 'h'];
      linesEl.innerHTML = _invLines.map((l, i) => {
        const unit = l.unit || 'kg';
        return `
        <div style="display:grid; grid-template-columns:2fr 80px 80px 110px 110px 30px; gap:6px; margin-bottom:6px;">
          <input type="text" placeholder="DÃ©signation" value="${(l.desc||'').replace(/"/g, '&quot;')}" onchange="app.invSetLine(${i},'desc',this.value)"/>
          <select onchange="app.invSetLine(${i},'unit',this.value)">
            ${units.map(u => `<option value="${u}" ${u===unit?'selected':''}>${u}</option>`).join('')}
          </select>
          <input type="number" placeholder="QtÃ©" value="${l.qty}" step="0.0001" onchange="app.invSetLine(${i},'qty',this.value)" class="num-input"/>
          <input type="number" placeholder="P.U." value="${l.pu}" step="0.01" onchange="app.invSetLine(${i},'pu',this.value)" class="num-input"/>
          <input type="text" value="${fmtDZD(l.qty * l.pu)}" disabled style="background:var(--bg-muted); text-align:right; font-variant-numeric:tabular-nums;"/>
          <button class="ghost-btn" onclick="app.invDelLine(${i})">Ã—</button>
        </div>`;
      }).join('');
    }
    renderClientDetailsList();
    invUpdateTotals();
  }

  function invSetLine(i, key, val) {
    if (!_invLines[i]) return;
    if (key === 'qty' || key === 'pu') _invLines[i][key] = parseFloat(val) || 0;
    else _invLines[i][key] = val;
    invUpdateTotals();
    const lineEl = document.getElementById('inv-lines').children[i];
    if (lineEl && lineEl.children[4]) lineEl.children[4].value = fmtDZD(_invLines[i].qty * _invLines[i].pu);
  }
  function invAddLine() { _invLines.push({ desc: '', unit: 'kg', qty: 1, pu: 0 }); renderFacturation(); }
  function invDelLine(i) { _invLines.splice(i, 1); if (_invLines.length === 0) _invLines = [{ desc: '', unit: 'kg', qty: 1, pu: 0 }]; renderFacturation(); }
  function invReset() {
    _invLines = [{ desc: '', unit: 'kg', qty: 1, pu: 0 }];
    ['inv-number','inv-conditions','inv-project','inv-ouvrage','inv-site'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    renderFacturation();
  }

  // Client fiscal details management
  function saveClientDetails() {
    const client = document.getElementById('cd-client').value;
    if (!client) { alert('Choisis un client'); return; }
    const details = {
      fullname: document.getElementById('cd-fullname').value.trim(),
      address: document.getElementById('cd-address').value.trim(),
      tin: document.getElementById('cd-tin').value.trim(),
      nif: document.getElementById('cd-nif').value.trim(),
      nis: document.getElementById('cd-nis').value.trim(),
      rc: document.getElementById('cd-rc').value.trim(),
      ai: document.getElementById('cd-ai').value.trim()
    };
    if (!state.clientDetails) state.clientDetails = {};
    state.clientDetails[client] = details;
    save(K.clientDetails, state.clientDetails);
    ['cd-fullname','cd-address','cd-tin','cd-nif','cd-nis','cd-rc','cd-ai'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('cd-client').value = '';
    renderClientDetailsList();
    alert('âœ… Informations enregistrÃ©es pour ' + client);
  }

  function loadClientDetailsToForm(client) {
    const d = state.clientDetails && state.clientDetails[client];
    if (!d) {
      ['cd-fullname','cd-address','cd-tin','cd-nif','cd-nis'].forEach(id => document.getElementById(id).value = '');
      return;
    }
    document.getElementById('cd-fullname').value = d.fullname || '';
    document.getElementById('cd-address').value = d.address || '';
    document.getElementById('cd-tin').value = d.tin || '';
    document.getElementById('cd-nif').value = d.nif || '';
    document.getElementById('cd-nis').value = d.nis || '';
    document.getElementById('cd-rc').value = d.rc || '';
    document.getElementById('cd-ai').value = d.ai || '';
  }

  function deleteClientDetails(name) {
    if (!confirm('Supprimer les infos fiscales de ' + name + ' ?')) return;
    if (state.clientDetails && state.clientDetails[name]) delete state.clientDetails[name];
    save(K.clientDetails, state.clientDetails);
    renderClientDetailsList();
  }

  function renderClientDetailsList() {
    const el = document.getElementById('client-details-list');
    if (!el) return;
    const entries = Object.entries(state.clientDetails || {});
    if (entries.length === 0) {
      el.innerHTML = '<p style="font-size:12px; color:var(--text-tertiary);">Aucune info fiscale enregistrÃ©e.</p>';
      return;
    }
    el.innerHTML = entries.map(([name, d]) => `
      <div style="padding:10px 12px; background:var(--bg-muted); border-radius:6px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div style="flex:1; font-size:12px;">
          <div style="font-weight:700; margin-bottom:2px;">${name}</div>
          ${d.fullname ? `<div style="color:var(--text-secondary);">${d.fullname}</div>` : ''}
          ${d.address ? `<div style="color:var(--text-tertiary); font-size:11px;">${d.address}</div>` : ''}
          <div style="color:var(--text-tertiary); font-size:11px; margin-top:2px;">
            ${d.tin ? 'TIN: ' + d.tin : ''} ${d.nif ? 'Â· NIF: ' + d.nif : ''} ${d.nis ? 'Â· NIS: ' + d.nis : ''} ${d.rc ? 'Â· RC: ' + d.rc : ''} ${d.ai ? 'Â· AI: ' + d.ai : ''}
          </div>
        </div>
        <div style="display:flex; gap:4px;">
          <button class="btn-secondary" style="font-size:11px;" onclick="document.getElementById('cd-client').value='${name}'; app.loadClientDetailsToForm('${name}');">Modifier</button>
          <button class="ghost-btn" onclick="app.deleteClientDetails('${name.replace(/'/g, '\\\'')}')">Ã—</button>
        </div>
      </div>`).join('');
  }

  function invUpdateTotals() {
    const ht = _invLines.reduce((s, l) => s + l.qty * l.pu, 0);
    const tva = ht * 0.19;
    const timbre = (document.getElementById('inv-timbre')?.value === '1') ? Math.round(ht * 0.02) : 0;
    const ttc = ht + tva + timbre;
    const el = document.getElementById('inv-totals');
    if (el) {
      el.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:13px;"><span style="color:var(--text-secondary);">Total HT</span><span style="font-weight:600;">${fmtDZD(ht)}</span></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:13px;"><span style="color:var(--text-secondary);">TVA 19%</span><span style="font-weight:600;">${fmtDZD(tva)}</span></div>
        ${timbre > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:13px;"><span style="color:var(--text-secondary);">Timbre fiscal 2%</span><span style="font-weight:600;">${fmtDZD(timbre)}</span></div>` : ''}
        <div style="display:flex; justify-content:space-between; padding-top:6px; border-top:1px solid var(--border); font-size:15px;"><span style="font-weight:700;">Total TTC</span><span style="font-weight:700; color:var(--accent);">${fmtDZD(ttc)}</span></div>`;
    }
  }

  function saveInvoice() {
    const type = document.getElementById('inv-type').value;
    let number = document.getElementById('inv-number').value.trim();
    if (!number) {
      const year = new Date().getFullYear();
      const yearInvoices = (state.invoices || []).filter(i => (i.number || '').endsWith('/' + year));
      number = String(yearInvoices.length + 1).padStart(2, '0') + '/' + year;
    }
    const date = document.getElementById('inv-date').value;
    const place = document.getElementById('inv-place').value.trim() || 'Blida';
    const client = document.getElementById('inv-client').value;
    const project = document.getElementById('inv-project').value;
    const ouvrage = document.getElementById('inv-ouvrage').value;
    const site = document.getElementById('inv-site').value;
    const timbreOn = document.getElementById('inv-timbre').value === '1';
    const ribIdx = document.getElementById('inv-rib').value;
    const conditions = document.getElementById('inv-conditions').value;

    if (!client) { alert('Choisis un client'); return; }
    const validLines = _invLines.filter(l => l.desc && l.qty > 0 && l.pu >= 0);
    if (validLines.length === 0) { alert('Ajoute au moins une ligne valide'); return; }

    const ht = validLines.reduce((s, l) => s + l.qty * l.pu, 0);
    const tva = ht * 0.19;
    const timbre = timbreOn ? Math.round(ht * 0.02) : 0;
    const ttc = ht + tva + timbre;
    const rib = ribIdx !== '' ? state.ribList[parseInt(ribIdx)] : null;
    const clientDetails = (state.clientDetails && state.clientDetails[client]) || null;

    const invoice = { id: Date.now(), type, number, date, place, client, clientDetails, project, ouvrage, site, lines: validLines, ht, tva, timbre, ttc, rib, conditions };
    if (!state.invoices) state.invoices = [];
    state.invoices.push(invoice);
    save(K.invoices, state.invoices);

    if (type !== 'proforma') {
      state.situations.push({
        id: Date.now() + 1,
        client,
        project: project || '',
        number,
        date,
        amount: ttc,
        payments: [],
        contractType: 'formel',
        invoiceId: invoice.id
      });
      save(K.situations, state.situations);
    }

    invReset();
    renderAll();
    alert(`âœ… Facture ${number} enregistrÃ©e${type !== 'proforma' ? ' et situation client crÃ©Ã©e' : ''}`);
  }

  function deleteInvoice(idx) {
    if (!confirm('Supprimer cette facture ?')) return;
    const inv = state.invoices[idx];
    if (inv && inv.id) {
      state.situations = state.situations.filter(s => s.invoiceId !== inv.id);
      save(K.situations, state.situations);
    }
    state.invoices.splice(idx, 1);
    save(K.invoices, state.invoices);
    renderAll();
  }

  function renderInvoices() {
    const el = document.getElementById('invoices-table');
    if (!el) return;
    if (!state.invoices || state.invoices.length === 0) {
      el.innerHTML = '<div class="empty-state">Aucune facture Ã©mise.</div>';
      return;
    }
    const sorted = state.invoices.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    el.innerHTML = `<table class="mod">
      <thead><tr><th>NÂ°</th><th>Date</th><th>Type</th><th>Client</th><th style="text-align:right">TTC</th><th></th></tr></thead>
      <tbody>${sorted.map(inv => {
        const realIdx = state.invoices.indexOf(inv);
        return `<tr>
          <td style="font-weight:600;">${inv.number}</td>
          <td style="color:var(--text-secondary);">${inv.date}</td>
          <td><span class="badge ${inv.type === 'proforma' ? 'b-info' : 'b-ok'}">${inv.type === 'proforma' ? 'Proforma' : 'Facture'}</span></td>
          <td>${inv.client}</td>
          <td style="text-align:right; font-weight:600;">${fmtDZD(inv.ttc)}</td>
          <td style="text-align:right; white-space:nowrap;">
            <button class="btn-secondary" style="font-size:11px;" onclick="app.printInvoice(${realIdx})">Imprimer</button>
            <button class="ghost-btn" onclick="app.deleteInvoice(${realIdx})">Ã—</button>
          </td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }

  function addRib() {
    const bank = document.getElementById('rib-bank').value.trim();
    const number = document.getElementById('rib-number').value.trim();
    if (!bank || !number) { alert('Remplir banque et RIB'); return; }
    if (!state.ribList) state.ribList = [];
    state.ribList.push({ bank, number });
    save(K.ribList, state.ribList);
    document.getElementById('rib-bank').value = '';
    document.getElementById('rib-number').value = '';
    renderRibs();
    renderFacturation();
  }

  function deleteRib(idx) {
    if (!confirm('Supprimer ce RIB ?')) return;
    state.ribList.splice(idx, 1);
    save(K.ribList, state.ribList);
    renderRibs();
    renderFacturation();
  }

  function renderRibs() {
    const el = document.getElementById('rib-list');
    if (!el) return;
    if (!state.ribList || state.ribList.length === 0) {
      el.innerHTML = '<p style="font-size:12px; color:var(--text-tertiary);">Aucun RIB enregistrÃ©.</p>';
      return;
    }
    el.innerHTML = state.ribList.map((r, i) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-muted); border-radius:6px; margin-bottom:4px;">
        <div><strong>${r.bank}</strong> <span style="font-family:monospace; color:var(--text-secondary);">${r.number}</span></div>
        <button class="ghost-btn" onclick="app.deleteRib(${i})">Ã—</button>
      </div>`).join('');
  }

  // Convert number to French words (for "ArrÃªte la prÃ©sente facture Ã  la somme de...")
  function numberToFrenchWords(n) {
    const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
    function below1000(num) {
      if (num === 0) return '';
      let str = '';
      const h = Math.floor(num / 100);
      const r = num % 100;
      if (h === 1) str += 'cent';
      else if (h > 1) str += ones[h] + ' cent' + (r === 0 ? 's' : '');
      if (r === 0) return str.trim();
      if (str) str += ' ';
      if (r < 20) str += ones[r];
      else {
        const t = Math.floor(r / 10);
        const u = r % 10;
        if (t === 7 || t === 9) {
          str += tens[t] + (u === 1 && t === 7 ? ' et ' : '-') + ones[10 + u];
        } else {
          str += tens[t];
          if (u === 1 && t < 8) str += ' et un';
          else if (u > 0) str += '-' + ones[u];
          else if (t === 8) str += 's';
        }
      }
      return str.trim();
    }
    if (n === 0) return 'zÃ©ro';
    n = Math.floor(Math.abs(n));
    let result = '';
    const millions = Math.floor(n / 1000000);
    const thousands = Math.floor((n % 1000000) / 1000);
    const rest = n % 1000;
    if (millions > 0) result += (millions === 1 ? 'un million' : below1000(millions) + ' millions') + ' ';
    if (thousands > 0) result += (thousands === 1 ? 'mille' : below1000(thousands) + ' mille') + ' ';
    if (rest > 0) result += below1000(rest);
    return result.trim();
  }

  function printInvoice(idx) {
    const inv = state.invoices[idx];
    if (!inv) return;
    const typeLabel = { proforma: 'FACTURE PROFORMA', finale: 'FACTURE' }[inv.type] || 'FACTURE';
    const w = window.open('', '_blank');
    if (!w) {
      alert('âš  Le navigateur a bloquÃ© la nouvelle fenÃªtre. Autorise les pop-ups pour ce site et rÃ©essaie.');
      return;
    }
    // Fallback for fiscal details if they were updated after invoice creation
    const currentCD = state.clientDetails && state.clientDetails[inv.client];
    const cd = inv.clientDetails || currentCD || {};
    const dateFmt = inv.date ? new Date(inv.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const place = inv.place || 'Blida';
    const totalWords = numberToFrenchWords(Math.round(inv.ttc)) + ' dinars algÃ©riens';

    // Get the EXACT header HTML used by the rest of the app (with real logo embedded)
    const headerEl = document.querySelector('.print-header');
    let headerHtml = '';
    if (headerEl) {
      const clone = headerEl.cloneNode(true);
      // Update title
      const pageInfo = clone.querySelector('#print-page-info');
      if (pageInfo) pageInfo.textContent = `${typeLabel} NÂ° ${inv.number} â€” ${place}, le ${dateFmt}`;
      headerHtml = clone.outerHTML;
    }

    const linesHtml = inv.lines.map((l, i) => `
      <tr>
        <td style="padding:9px 10px; border-bottom:1px solid #E5E7EB; font-size:12px; color:#4B5563; text-align:center;">${String(i + 1).padStart(2, '0')}</td>
        <td style="padding:9px 10px; border-bottom:1px solid #E5E7EB; font-size:12px;">${l.desc}</td>
        <td style="padding:9px 10px; border-bottom:1px solid #E5E7EB; font-size:12px; text-align:center; color:#4B5563;">${l.unit || ''}</td>
        <td style="padding:9px 10px; border-bottom:1px solid #E5E7EB; font-size:12px; text-align:right; font-variant-numeric:tabular-nums;">${l.qty}</td>
        <td style="padding:9px 10px; border-bottom:1px solid #E5E7EB; font-size:12px; text-align:right; font-variant-numeric:tabular-nums;">${fmtDZD(l.pu)}</td>
        <td style="padding:9px 10px; border-bottom:1px solid #E5E7EB; font-size:12px; text-align:right; font-variant-numeric:tabular-nums; font-weight:600;">${fmtDZD(l.qty * l.pu)}</td>
      </tr>`).join('');

    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title> </title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111827; padding: 0; margin: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table { border-collapse: collapse; width: 100%; }
  @page { margin: 10mm 10mm 18mm 10mm; size: A4; }
  @page :first { margin-top: 8mm; }
  .print-header { display: block !important; text-align: left; margin-bottom: 8px; }
</style></head><body>

  <!-- IPCM BOUTEMA Header (real logo, same as other prints) -->
  ${headerHtml}

  <!-- Two-column meta block -->
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:18px; margin-bottom:18px;">
    <div>
      <p style="font-size:10px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.07em; font-weight:700; margin:0 0 6px;">Ã‰metteur</p>
      <p style="margin:0; font-weight:700; font-size:13px;">IPCM Boutema</p>
      ${inv.project ? `<p style="margin:6px 0 0; font-size:12px; color:#4B5563;"><strong>Projet :</strong> ${inv.project}</p>` : ''}
      ${inv.ouvrage ? `<p style="margin:2px 0 0; font-size:12px; color:#4B5563;"><strong>Ouvrage :</strong> ${inv.ouvrage}</p>` : ''}
      ${inv.site ? `<p style="margin:2px 0 0; font-size:12px; color:#4B5563;"><strong>Site :</strong> ${inv.site}</p>` : ''}
    </div>
    <div style="background:#F0F2F7; padding:12px 14px; border-radius:8px;">
      <p style="font-size:10px; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.07em; font-weight:700; margin:0 0 6px;">Client</p>
      <p style="margin:0; font-weight:700; font-size:13px;">${inv.client}</p>
      ${cd.fullname ? `<p style="margin:4px 0 0; font-size:11px; color:#4B5563;">${cd.fullname}</p>` : ''}
      ${cd.address ? `<p style="margin:4px 0 0; font-size:10.5px; color:#6B7280;">${cd.address}</p>` : ''}
      ${(cd.tin || cd.nif || cd.nis || cd.rc || cd.ai) ? `<div style="margin-top:6px; font-size:11px; color:#6B7280; line-height:1.5; display:grid; grid-template-columns:1fr 1fr; gap:0 12px;">
        ${cd.tin ? `<div><strong>TIN :</strong> ${cd.tin}</div>` : ''}
        ${cd.nif ? `<div><strong>NIF :</strong> ${cd.nif}</div>` : ''}
        ${cd.nis ? `<div><strong>NIS :</strong> ${cd.nis}</div>` : ''}
        ${cd.rc ? `<div><strong>RC :</strong> ${cd.rc}</div>` : ''}
        ${cd.ai ? `<div><strong>AI :</strong> ${cd.ai}</div>` : ''}
      </div>` : ''}
    </div>
  </div>

  <!-- Lines table -->
  <table style="margin-top:8px; border-radius:8px; overflow:hidden;">
    <thead>
      <tr style="background:#F0F2F7;">
        <th style="padding:10px; text-align:center; font-size:10.5px; text-transform:uppercase; letter-spacing:0.07em; color:#4B5563; font-weight:700; border-bottom:2px solid #E5E7EB;">NÂ°</th>
        <th style="padding:10px; text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:0.07em; color:#4B5563; font-weight:700; border-bottom:2px solid #E5E7EB;">DÃ©signation</th>
        <th style="padding:10px; text-align:center; font-size:10.5px; text-transform:uppercase; letter-spacing:0.07em; color:#4B5563; font-weight:700; border-bottom:2px solid #E5E7EB;">U</th>
        <th style="padding:10px; text-align:right; font-size:10.5px; text-transform:uppercase; letter-spacing:0.07em; color:#4B5563; font-weight:700; border-bottom:2px solid #E5E7EB;">QuantitÃ©</th>
        <th style="padding:10px; text-align:right; font-size:10.5px; text-transform:uppercase; letter-spacing:0.07em; color:#4B5563; font-weight:700; border-bottom:2px solid #E5E7EB;">Prix unitaire</th>
        <th style="padding:10px; text-align:right; font-size:10.5px; text-transform:uppercase; letter-spacing:0.07em; color:#4B5563; font-weight:700; border-bottom:2px solid #E5E7EB;">Montant</th>
      </tr>
    </thead>
    <tbody>${linesHtml}</tbody>
  </table>

  <!-- Totals box -->
  <div style="display:flex; justify-content:flex-end; margin-top:14px;">
    <table style="width:300px; font-size:12px;">
      <tr>
        <td style="padding:8px 12px; color:#4B5563; border-bottom:1px solid #E5E7EB;">Montant HT</td>
        <td style="padding:8px 12px; text-align:right; font-weight:600; border-bottom:1px solid #E5E7EB; font-variant-numeric:tabular-nums;">${fmtDZD(inv.ht)}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px; color:#4B5563; border-bottom:1px solid #E5E7EB;">TVA 19%</td>
        <td style="padding:8px 12px; text-align:right; font-weight:600; border-bottom:1px solid #E5E7EB; font-variant-numeric:tabular-nums;">${fmtDZD(inv.tva)}</td>
      </tr>
      ${inv.timbre > 0 ? `<tr>
        <td style="padding:8px 12px; color:#4B5563; border-bottom:1px solid #E5E7EB;">Timbre fiscal 2%</td>
        <td style="padding:8px 12px; text-align:right; font-weight:600; border-bottom:1px solid #E5E7EB; font-variant-numeric:tabular-nums;">${fmtDZD(inv.timbre)}</td>
      </tr>` : ''}
      <tr style="background:#EFF6FF;">
        <td style="padding:10px 12px; font-weight:700; font-size:13px; color:#1F2937;">Montant TTC</td>
        <td style="padding:10px 12px; text-align:right; font-weight:700; font-size:14px; color:#2563EB; font-variant-numeric:tabular-nums;">${fmtDZD(inv.ttc)}</td>
      </tr>
    </table>
  </div>

  <!-- Total in words BELOW the totals box -->
  <div style="margin-top:14px; padding:12px 14px; background:#F0F2F7; border-radius:8px; font-size:12px; font-style:italic; color:#1F2937;">
    <strong style="font-style:normal;">ArrÃªtÃ©e la prÃ©sente ${typeLabel.toLowerCase()} Ã  la somme de :</strong><br>
    ${totalWords}.
  </div>

  ${inv.conditions ? `<div style="margin-top:18px; padding:10px 14px; background:#FFFBEB; border-radius:6px; font-size:12px; border-left:3px solid #D97706;"><strong>Conditions de paiement :</strong> ${inv.conditions}</div>` : ''}
  ${inv.rib ? `<div style="margin-top:8px; padding:10px 14px; background:#EFF6FF; border-radius:6px; font-size:12px; border-left:3px solid #2563EB;"><strong>${inv.rib.bank}</strong> â€” RIB : <span style="font-family:monospace;">${inv.rib.number}</span></div>` : ''}

  <!-- Signature -->
  <div style="margin-top:50px; display:flex; justify-content:flex-end;">
    <div style="text-align:center; min-width:200px;">
      <p style="margin:0 0 4px; font-size:12px; color:#4B5563; font-weight:600;">Le GÃ©rant</p>
      <div style="border-bottom:1px solid #333; margin-top:50px;"></div>
    </div>
  </div>

</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  }
  // ========== END FACTURATION ==========

  // ========== RH MODULE ==========

  function calculateAge(birthDate) {
    if (!birthDate) return 'â€”';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  function renderWorkers() {
    const el = document.getElementById('workers-table');
    if (!el) return;
    if (!state.workers || state.workers.length === 0) {
      el.innerHTML = '<div class="empty-state">Aucun employÃ© enregistrÃ©.</div>';
      return;
    }

    el.innerHTML = `<table class="mod">
      <thead><tr>
        <th>Nom & PrÃ©nom</th>
        <th>Ã‚ge</th>
        <th>Fonction</th>
        <th>EntrÃ©e</th>
        <th>Contrat</th>
        <th>Ã‰tat Civil</th>
        <th>NÂ° Assurance</th>
        <th></th>
      </tr></thead>
      <tbody>${state.workers.map((w, i) => `
        <tr>
          <td style="font-weight:600;">${w.name} ${w.surname}</td>
          <td>${calculateAge(w.birth)} ans</td>
          <td>${w.function || 'â€”'}</td>
          <td>${w.entry || 'â€”'}</td>
          <td><span class="badge b-info">${w.contract || 'â€”'}</span></td>
          <td>${w.status || 'â€”'}</td>
          <td style="font-family:monospace;">${w.ss || 'â€”'}</td>
          <td style="text-align:right; white-space:nowrap;">
            <button class="ghost-btn" title="Modifier" onclick="app.editWorker(${i})">&#9998;</button>
            <button class="ghost-btn" title="Supprimer" onclick="app.deleteWorker(${i})">Ã—</button>
          </td>
        </tr>`).join('')}</tbody></table>`;
  }

  function renderHrContracts() {
    const el = document.getElementById('hr-contracts-table');
    if (!el) return;
    
    const today = new Date();
    if (!state.workers || state.workers.length === 0) {
      el.innerHTML = '<div class="empty-state">Aucun employÃ© pour le suivi.</div>';
      return;
    }

    const tableHtml = `
      <table class="mod">
        <thead><tr>
          <th>EmployÃ©</th>
          <th>Type</th>
          <th>DÃ©but</th>
          <th>Fin</th>
          <th>Actions</th>
        </tr></thead>
        <tbody>${state.workers.map((w, i) => {
          const days = w.contractEnd ? daysBetween(today, parseD(w.contractEnd)) : null;
          const statusClass = days !== null && days <= 15 ? 'color:var(--danger-text); font-weight:700;' : '';
          
          return `
          <tr>
            <td><strong>${w.name} ${w.surname}</strong><br><small style="color:var(--text-tertiary)">${w.function}</small></td>
            <td><span class="badge b-info" style="font-size:11px;">${w.contract || 'â€”'}</span></td>
            <td style="font-size:12px;">${w.entry || 'â€”'}</td>
            <td style="font-size:12px; ${statusClass}">${w.contractEnd || 'â€”'}</td>
            <td style="text-align:right; white-space:nowrap;">
              <button class="ghost-btn" title="Archiver (Fin de contrat)" onclick="app.archiveOnly(${i})" style="color:var(--text-secondary); font-size:18px;">ðŸ“¥</button>
              <button class="ghost-btn" title="Renouveler" onclick="app.archiveAndRenew(${i})" style="color:var(--accent); font-size:18px;">ðŸ”„</button>
              ${w.history && w.history.length > 0 ? 
                `<button class="ghost-btn" title="Historique" onclick="app.toggleWorkerHistory(${i})" style="color:var(--text-tertiary); font-size:18px;">ðŸ“‹</button>` : ''}
            </td>
          </tr>
          <tr id="history-${i}" style="display:none; background:var(--bg-muted);">
            <td colspan="5" style="padding:15px;">
              <p style="font-size:11px; color:var(--text-tertiary); text-transform:uppercase; font-weight:700; margin:0 0 10px;">Historique des anciens contrats</p>
              <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px;">
                ${(w.history || []).map(h => `
                  <div style="background:white; border:1px solid var(--border); border-radius:8px; padding:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                      <span class="badge b-neutral" style="font-size:10px;">${h.type}</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary);">
                      <strong>${h.start}</strong> au <strong>${h.end}</strong>
                    </div>
                  </div>
                `).join('')}
              </div>
            </td>
          </tr>`;
        }).join('')}</tbody></table>`;
    
    el.innerHTML = tableHtml;
  }

  function renderHrNotifications() {
    const el = document.getElementById('hr-notifications-list');
    if (!el) return;

    const today = new Date();
    const alerts = state.workers.filter(w => {
      if (!w.contractEnd) return false;
      const days = daysBetween(today, parseD(w.contractEnd));
      return days <= 15;
    }).sort((a, b) => (a.contractEnd || '').localeCompare(b.contractEnd || ''));

    // Update Sidebar Dot
    const navBtn = document.getElementById('nav-hr-notifications');
    if (navBtn) {
      navBtn.classList.toggle('has-alert', alerts.length > 0);
    }

    if (alerts.length === 0) {
      el.innerHTML = '<div class="empty-state">Aucune notification pour le moment.</div>';
      return;
    }

    el.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:15px;">
        ${alerts.map(w => {
          const days = daysBetween(today, parseD(w.contractEnd));
          return `
            <div style="background:white; border:1px solid var(--border); border-radius:12px; padding:15px; border-left:5px solid var(--danger-text);">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <div>
                  <p style="margin:0; font-weight:700; font-size:15px;">${w.name} ${w.surname}</p>
                  <p style="margin:2px 0 0; font-size:12px; color:var(--text-secondary);">${w.function}</p>
                </div>
                <span class="badge ${days < 0 ? 'b-danger' : 'b-warn'}">${days < 0 ? 'ExpirÃ©' : 'Ã‰chÃ©ance'}</span>
              </div>
              <p style="margin:0 0 15px; font-size:13px; color:var(--text-primary);">
                ${days < 0 ? `Le contrat a expirÃ© il y a <strong>${Math.abs(days)} jours</strong>.` : `Le contrat expire dans <strong>${days} jours</strong> (${w.contractEnd}).`}
              </p>
              <div style="display:flex; gap:8px;">
                <button class="btn-primary" style="flex:1; height:32px; font-size:12px;" onclick="app.viewInSuivi(${state.workers.indexOf(w)})">Voir dans Suivi Contrat</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function viewInSuivi(idx) {
    app.switchModule('rh');
    const panelBtn = document.querySelector('.nav-btn[data-panel="hr-contracts"]');
    if (panelBtn) panelBtn.click();
    
    // Smooth scroll and highlight
    setTimeout(() => {
      const rows = document.querySelectorAll('#hr-contracts-table tr');
      const w = state.workers[idx];
      rows.forEach(row => {
        if (row.innerText.includes(w.name) && row.innerText.includes(w.surname)) {
          row.style.background = '#FEF3C7'; 
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => { 
            row.style.transition = 'background 1s'; 
            row.style.background = 'transparent'; 
          }, 3000);
        }
      });
    }, 150);
  }

  function toggleWorkerHistory(idx) {
    const el = document.getElementById(`history-${idx}`);
    if (el) {
      el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
    }
  }

  function archiveOnly(idx) {
    const w = state.workers[idx];
    if (!w.contract || !w.contractEnd) {
      alert("DonnÃ©es de contrat incomplÃ¨tes.");
      return;
    }
    if (!confirm(`Archiver le contrat actuel de ${w.name} ?`)) return;

    if (!w.history) w.history = [];
    w.history.push({ type: w.contract, start: w.entry || '?', end: w.contractEnd });

    w.contract = '';
    w.entry = '';
    w.contractEnd = '';

    save(K.workers, state.workers);
    renderAll();
  }

  function archiveAndRenew(idx) {
    const w = state.workers[idx];
    if (!w.contract || !w.contractEnd) {
      alert("Le contrat actuel n'est pas complet.");
      return;
    }
    if (!confirm(`Archiver et prÃ©parer le renouvellement pour ${w.name} ?`)) return;

    if (!w.history) w.history = [];
    w.history.push({ type: w.contract, start: w.entry || '?', end: w.contractEnd });

    const oldEnd = parseD(w.contractEnd);
    if (oldEnd) {
      const nextDay = new Date(oldEnd);
      nextDay.setDate(nextDay.getDate() + 1);
      w.entry = nextDay.toISOString().split('T')[0];
    }
    w.contractEnd = ''; 

    save(K.workers, state.workers);
    app.editWorker(idx);
    renderAll();
  }

  function archiveCurrentContract(idx) {
    archiveAndRenew(idx);
  }

  function openWorkerModal() {
    state.editingWorkerIdx = null;
    document.getElementById('worker-modal-title').textContent = 'Nouvel employÃ©';
    ['wk-name','wk-surname','wk-birth','wk-function','wk-entry','wk-contract-end','wk-contract','wk-status','wk-ss'].forEach(id => {
      const e = document.getElementById(id);
      if (e) e.value = (id === 'wk-contract' ? 'CDI' : id === 'wk-status' ? 'CÃ©libataire' : '');
    });
    document.getElementById('worker-modal').classList.add('active');
  }

  function closeWorkerModal() {
    document.getElementById('worker-modal').classList.remove('active');
    state.editingWorkerIdx = null;
  }

  function saveWorker() {
    const worker = {
      name: document.getElementById('wk-name').value.trim().toUpperCase(),
      surname: document.getElementById('wk-surname').value.trim(),
      birth: document.getElementById('wk-birth').value,
      function: document.getElementById('wk-function').value.trim(),
      entry: document.getElementById('wk-entry').value,
      contractEnd: document.getElementById('wk-contract-end').value,
      contract: document.getElementById('wk-contract').value,
      status: document.getElementById('wk-status').value,
      ss: document.getElementById('wk-ss').value.trim(),
      history: (state.editingWorkerIdx !== null ? state.workers[state.editingWorkerIdx].history || [] : [])
    };

    if (!worker.name || !worker.surname) { alert('Nom et prÃ©nom requis'); return; }

    if (state.editingWorkerIdx !== null) {
      state.workers[state.editingWorkerIdx] = worker;
    } else {
      state.workers.push(worker);
    }

    save(K.workers, state.workers);
    closeWorkerModal();
    renderAll();
  }

  function editWorker(idx) {
    const w = state.workers[idx];
    state.editingWorkerIdx = idx;
    document.getElementById('worker-modal-title').textContent = 'Modifier employÃ©';
    document.getElementById('wk-name').value = w.name;
    document.getElementById('wk-surname').value = w.surname;
    document.getElementById('wk-birth').value = w.birth;
    document.getElementById('wk-function').value = w.function;
    document.getElementById('wk-entry').value = w.entry || '';
    document.getElementById('wk-contract-end').value = w.contractEnd || '';
    document.getElementById('wk-contract').value = w.contract;
    document.getElementById('wk-status').value = w.status;
    document.getElementById('wk-ss').value = w.ss;
    document.getElementById('worker-modal').classList.add('active');
  }

  function deleteWorker(idx) {
    if (!confirm('Supprimer cet employÃ© ?')) return;
    state.workers.splice(idx, 1);
    save(K.workers, state.workers);
    renderAll();
  }

  function printWorkers() {
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('print-page-info').textContent = `Liste du personnel â€” ${today}`;
    
    document.querySelectorAll('.card').forEach(c => c.classList.remove('print-target'));
    document.querySelectorAll('.fournisseur-card').forEach(c => c.classList.remove('print-target'));
    const card = document.getElementById('workers-table').closest('.card');
    if (card) card.classList.add('print-target');
    
    const origTitle = document.title;
    document.title = ' ';
    setTimeout(function() {
      window.print();
      setTimeout(function() {
        document.title = origTitle;
        document.querySelectorAll('.card').forEach(c => c.classList.remove('print-target'));
      }, 500);
    }, 300);
  }

  function importWorkers(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const rows = e.target.result.split('\n').filter(r => r.trim());
        const headers = rows[0].toLowerCase().split(/[;,]/);
        const newWorkers = rows.slice(1).map(row => {
          const cells = row.split(/[;,]/);
          const w = {};
          headers.forEach((h, i) => {
            const val = (cells[i] || '').trim();
            if (h.includes('nom')) w.name = val.toUpperCase();
            else if (h.includes('prÃ©nom')) w.surname = val;
            else if (h.includes('naiss')) w.birth = val;
            else if (h.includes('fonct')) w.function = val;
            else if (h.includes('entr')) w.entry = val;
            else if (h.includes('contrat')) w.contract = val;
            else if (h.includes('Ã©tat') || h.includes('civil')) w.status = val;
            else if (h.includes('assur') || h.includes('ss')) w.ss = val;
          });
          return w;
        }).filter(w => w.name && w.surname);
        
        if (newWorkers.length > 0) {
          state.workers = [...state.workers, ...newWorkers];
          save(K.workers, state.workers);
          renderAll();
          alert(`âœ… ${newWorkers.length} employÃ©(s) importÃ©(s)`);
        } else {
          alert('Aucun employÃ© valide trouvÃ© dans le fichier.');
        }
      } catch(err) {
        alert('Erreur lors de l\'importation. Format attendu: Nom, PrÃ©nom, Date naissance, etc.');
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  // ========== WORK SITES MODULE ==========

  function renderWorkSites() {
    const el = document.getElementById('work-sites-list');
    if (!el) return;
    if (!state.workSites || state.workSites.length === 0) {
      el.innerHTML = '<div class="empty-state">Aucun chantier enregistrÃ©.</div>';
      return;
    }

    el.innerHTML = state.workSites.map((ws, i) => {
      const assignedWorkers = (ws.workerIds || []).map(id => state.workers[id]).filter(w => w);

      const workerTable = assignedWorkers.length > 0 
        ? `<div style="overflow-x:auto; margin-top:10px;">
            <table class="mod" style="font-size:11px; min-width:600px;">
              <thead>
                <tr>
                  <th>Nom & PrÃ©nom</th>
                  <th>Ã‚ge</th>
                  <th>Fonction</th>
                  <th>EntrÃ©e</th>
                  <th>Contrat</th>
                  <th>Ã‰tat Civil</th>
                  <th>NÂ° Assurance</th>
                </tr>
              </thead>
              <tbody>
                ${assignedWorkers.map(w => `
                  <tr>
                    <td style="font-weight:600;">${w.name} ${w.surname}</td>
                    <td>${calculateAge(w.birth)} ans</td>
                    <td>${w.function || 'â€”'}</td>
                    <td>${w.entry || 'â€”'}</td>
                    <td><span class="badge b-info">${w.contract || 'â€”'}</span></td>
                    <td>${w.status || 'â€”'}</td>
                    <td style="font-family:monospace;">${w.ss || 'â€”'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`
        : '<div class="empty-state" style="padding:10px; font-size:12px;">Aucun personnel affectÃ©</div>';

      return `
        <div class="card" style="margin-bottom:12px; grid-column: 1 / -1;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <p style="font-weight:700; font-size:16px; margin:0;">${ws.name}</p>
              <p style="font-size:12px; color:var(--text-secondary); margin:4px 0 0;">${ws.desc || 'Pas de description'}</p>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="ghost-btn" title="Modifier" onclick="app.editWorkSite(${i})">&#9998;</button>
              <button class="ghost-btn" title="Supprimer" onclick="app.deleteWorkSite(${i})">Ã—</button>
            </div>
          </div>
          <div>
            <p style="font-size:11px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin:0 0 8px;">Personnel AffectÃ© (${assignedWorkers.length})</p>
            ${workerTable}
          </div>
        </div>`;
    }).join('');
  }

  function openWorkSiteModal() {
    state.editingWorkSiteIdx = null;
    document.getElementById('work-site-modal-title').textContent = 'Nouveau chantier';
    document.getElementById('ws-name').value = '';
    document.getElementById('ws-desc').value = '';
    
    // Render worker selection list
    const selectEl = document.getElementById('ws-workers-select');
    if (state.workers.length === 0) {
      selectEl.innerHTML = '<div style="font-size:12px; color:var(--text-tertiary); text-align:center; padding:10px;">Ajoutez d\'abord du personnel dans l\'onglet Personnel.</div>';
    } else {
      selectEl.innerHTML = state.workers.map((w, i) => `
        <label style="display:flex; align-items:center; gap:8px; padding:6px; border-bottom:1px solid var(--border); cursor:pointer;">
          <input type="checkbox" name="ws-workers" value="${i}" style="width:16px; height:16px;"/>
          <span style="font-size:13px;">${w.name} ${w.surname} <small style="color:var(--text-tertiary);">(${w.function || 'â€”'})</small></span>
        </label>
      `).join('');
    }
    
    document.getElementById('work-site-modal').classList.add('active');
  }

  function closeWorkSiteModal() {
    document.getElementById('work-site-modal').classList.remove('active');
    state.editingWorkSiteIdx = null;
  }

  function saveWorkSite() {
    const name = document.getElementById('ws-name').value.trim();
    const desc = document.getElementById('ws-desc').value.trim();
    const workerCheckboxes = document.querySelectorAll('input[name="ws-workers"]:checked');
    const workerIds = Array.from(workerCheckboxes).map(cb => parseInt(cb.value));

    if (!name) { alert('Nom du chantier requis'); return; }

    const existing = state.editingWorkSiteIdx !== null ? state.workSites[state.editingWorkSiteIdx] : {};
    const workSite = {
      name, desc, workerIds,
      pointage: existing.pointage || [],
      rapports: existing.rapports || []
    };

    if (state.editingWorkSiteIdx !== null) {
      state.workSites[state.editingWorkSiteIdx] = workSite;
    } else {
      state.workSites.push(workSite);
    }

    save(K.workSites, state.workSites);
    closeWorkSiteModal();
    renderAll();
  }

  function editWorkSite(idx) {
    const ws = state.workSites[idx];
    state.editingWorkSiteIdx = idx;
    document.getElementById('work-site-modal-title').textContent = 'Modifier chantier';
    document.getElementById('ws-name').value = ws.name;
    document.getElementById('ws-desc').value = ws.desc || '';
    
    // Render worker selection list with current selections
    const selectEl = document.getElementById('ws-workers-select');
    selectEl.innerHTML = state.workers.map((w, i) => `
      <label style="display:flex; align-items:center; gap:8px; padding:6px; border-bottom:1px solid var(--border); cursor:pointer;">
        <input type="checkbox" name="ws-workers" value="${i}" ${ws.workerIds.includes(i) ? 'checked' : ''} style="width:16px; height:16px;"/>
        <span style="font-size:13px;">${w.name} ${w.surname} <small style="color:var(--text-tertiary);">(${w.function || 'â€”'})</small></span>
      </label>
    `).join('');
    
    document.getElementById('work-site-modal').classList.add('active');
  }

  function deleteWorkSite(idx) {
    if (!confirm('Supprimer ce chantier ?')) return;
    state.workSites.splice(idx, 1);
    save(K.workSites, state.workSites);
    renderAll();
  }

  function printWorkSites() {
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const title = "Affectation du Personnel par Chantier";
    const infoEl = document.getElementById('print-page-info');
    if (infoEl) infoEl.innerHTML = `<strong>${title}</strong> &nbsp;â€”&nbsp; ${today}`;
    
    document.querySelectorAll('.print-target').forEach(c => c.classList.remove('print-target'));
    
    // Force show the chantiers panel and its cards
    const panel = document.querySelector('.panel[data-panel="work-sites"]');
    if (panel) {
      panel.classList.add('active'); // Ensure it's active
      panel.querySelectorAll('.card').forEach(c => c.classList.add('print-target'));
    }
    
    const origTitle = document.title;
    document.title = ' ';
    setTimeout(function() {
      window.print();
      setTimeout(function() {
        document.title = origTitle;
        document.querySelectorAll('.print-target').forEach(c => c.classList.remove('print-target'));
      }, 500);
    }, 600);
  }

  // ========== HR DOCUMENTS MODULE ==========

  function renderHrDocuments() {
    const titleEl = document.getElementById('hr-documents-title');
    const backBtn = document.getElementById('hr-back-btn');
    const listEl = document.getElementById('hr-documents-list');
    if (!listEl) return;

    // Render Folder Pills
    const folderFilterEl = document.getElementById('hr-folders-filter');
    if (folderFilterEl) {
      const folders = ['Tous', ...state.hrFolders];
      folderFilterEl.innerHTML = folders.map(f => `
        <span class="pill ${state.currentHrFolder === f ? 'pill-primary active' : ''}" 
              onclick="app.selectHrFolder('${f}')" 
              style="cursor:pointer; display:flex; align-items:center; gap:6px; ${state.currentHrFolder === f ? 'background:var(--accent); color:white; border-color:var(--accent);' : ''}">
          ${f}
          ${f !== 'Tous' ? `<button onclick="event.stopPropagation(); app.deleteHrFolder('${f}')" style="background:none; border:none; color:inherit; font-weight:bold; padding:0 2px; cursor:pointer; font-size:14px; line-height:1; margin-left:4px;">Ã—</button>` : ''}
        </span>
      `).join('');
    }

    if (state.currentHrFolder === 'Tous') {
      titleEl.textContent = 'Documents RH â€” Dossiers';
      backBtn.style.display = 'none';
      
      // Calculate counts
      const counts = {};
      state.hrDocuments.forEach(d => {
        const f = d.folder || 'Non classÃ©s';
        counts[f] = (counts[f] || 0) + 1;
      });
      state.hrFolders.forEach(f => { if (!counts[f]) counts[f] = 0; });

      const folderList = [...state.hrFolders];
      if (counts['Non classÃ©s']) folderList.push('Non classÃ©s');

      if (folderList.length === 0 && !counts['Non classÃ©s']) {
        listEl.innerHTML = '<div class="empty-state">Aucun dossier crÃ©Ã©. Utilisez le champ ci-dessus pour organiser vos documents.</div>';
        return;
      }

      listEl.innerHTML = folderList.map(f => `
        <div class="card" onclick="app.selectHrFolder('${f}')" style="cursor:pointer; display:flex; align-items:center; gap:16px; padding:20px; transition:all 0.2s; border:1px solid var(--border);" onmouseover="this.style.borderColor='var(--accent)'; this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.borderColor='var(--border)'; this.style.transform='none'; this.style.boxShadow='var(--shadow-sm)'">
          <div style="width:48px; height:48px; border-radius:12px; background:var(--accent-bg); display:flex; align-items:center; justify-content:center; color:var(--accent); flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <div style="flex:1; min-width:0;">
            <p style="font-weight:700; font-size:15px; margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f}</p>
            <p style="font-size:12px; color:var(--text-tertiary); margin-top:2px;">${counts[f] || 0} document(s)</p>
          </div>
          <div style="color:var(--text-tertiary);">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
      `).join('');
      return;
    }

    // Inside a folder
    titleEl.textContent = `Documents RH : ${state.currentHrFolder}`;
    backBtn.style.display = 'inline-flex';

    const filteredDocs = state.currentHrFolder === 'Non classÃ©s'
      ? state.hrDocuments.filter(d => !d.folder || d.folder === '')
      : state.hrDocuments.filter(d => d.folder === state.currentHrFolder);

    if (filteredDocs.length === 0) {
      listEl.innerHTML = '<div class="empty-state">Aucun document dans ce dossier.</div>';
      return;
    }

    listEl.innerHTML = filteredDocs.map(doc => {
      const realIdx = state.hrDocuments.indexOf(doc);
      return `
        <div class="card" style="margin-bottom:0; display:flex; flex-direction:column; border:1px solid var(--border); transition:all 0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div style="min-width:0; flex:1;">
              <p style="font-weight:700; font-size:15px; margin:0; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${doc.title}</p>
              <p style="font-size:11px; color:var(--text-tertiary); margin:4px 0 0;">${doc.date || 'Pas de date'}</p>
            </div>
            <div style="display:flex; gap:4px;">
              <button class="ghost-btn" title="Imprimer" onclick="app.printHrDocument(${realIdx})" style="font-size:14px; padding:6px;">ðŸ–¨ï¸</button>
              <button class="ghost-btn" title="Modifier" onclick="app.editHrDocument(${realIdx})" style="font-size:14px; padding:6px;">âœŽ</button>
              <button class="ghost-btn" title="Supprimer" onclick="app.deleteHrDocument(${realIdx})" style="font-size:14px; padding:6px;">Ã—</button>
            </div>
          </div>
          <div style="font-size:12px; color:var(--text-secondary); white-space: pre-wrap; max-height: 80px; overflow: hidden; position: relative; line-height:1.5;">
            ${doc.content}
            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 30px; background: linear-gradient(transparent, white);"></div>
          </div>
        </div>`;
    }).join('');
  }

  function addHrFolder() {
    const name = document.getElementById('new-hr-folder-name').value.trim();
    if (!name) return;
    if (state.hrFolders.includes(name)) { alert('Ce dossier existe dÃ©jÃ '); return; }
    state.hrFolders.push(name);
    save(K.hrFolders, state.hrFolders);
    document.getElementById('new-hr-folder-name').value = '';
    renderHrDocuments();
  }

  function deleteHrFolder(name) {
    if (!confirm(`Supprimer le dossier "${name}" ? Les documents resteront mais ne seront plus classÃ©s.`)) return;
    state.hrFolders = state.hrFolders.filter(f => f !== name);
    state.hrDocuments.forEach(d => { if (d.folder === name) delete d.folder; });
    if (state.currentHrFolder === name) state.currentHrFolder = 'Tous';
    save(K.hrFolders, state.hrFolders);
    save(K.hrDocuments, state.hrDocuments);
    renderHrDocuments();
  }

  function selectHrFolder(name) {
    state.currentHrFolder = name;
    renderHrDocuments();
  }

  function openHrDocumentModal() {
    state.editingHrDocumentIdx = null;
    document.getElementById('hr-document-modal-title').textContent = 'Nouveau Document';
    document.getElementById('doc-title').value = '';
    document.getElementById('doc-date').value = todayISO();
    
    // Populate folder dropdown
    const folderSel = document.getElementById('doc-folder');
    if (folderSel) {
      folderSel.innerHTML = '<option value="">(Aucun)</option>' + 
        state.hrFolders.map(f => `<option value="${f}">${f}</option>`).join('');
      folderSel.value = state.currentHrFolder !== 'Tous' ? state.currentHrFolder : '';
    }

    document.getElementById('doc-signer-left').value = "L'IntÃ©ressÃ©";
    document.getElementById('doc-signer-right').value = "La Direction";
    document.getElementById('doc-content').value = '';
    document.getElementById('hr-document-modal').classList.add('active');
  }

  function closeHrDocumentModal() {
    document.getElementById('hr-document-modal').classList.remove('active');
    state.editingHrDocumentIdx = null;
  }

  function saveHrDocument() {
    const title = document.getElementById('doc-title').value.trim();
    const date = document.getElementById('doc-date').value;
    const folder = document.getElementById('doc-folder').value;
    const signerLeft = document.getElementById('doc-signer-left').value.trim();
    const signerRight = document.getElementById('doc-signer-right').value.trim();
    const content = document.getElementById('doc-content').value.trim();

    if (!title) { alert('Titre du document requis'); return; }

    const doc = { title, date, content, signerLeft, signerRight, folder };

    if (state.editingHrDocumentIdx !== null) {
      state.hrDocuments[state.editingHrDocumentIdx] = doc;
    } else {
      state.hrDocuments.push(doc);
    }

    save(K.hrDocuments, state.hrDocuments);
    closeHrDocumentModal();
    renderAll();
  }

  function editHrDocument(idx) {
    const doc = state.hrDocuments[idx];
    state.editingHrDocumentIdx = idx;
    document.getElementById('hr-document-modal-title').textContent = 'Modifier Document';
    document.getElementById('doc-title').value = doc.title;
    document.getElementById('doc-date').value = doc.date || '';
    
    const folderSel = document.getElementById('doc-folder');
    if (folderSel) {
      folderSel.innerHTML = '<option value="">(Aucun)</option>' + 
        state.hrFolders.map(f => `<option value="${f}">${f}</option>`).join('');
      folderSel.value = doc.folder || '';
    }

    document.getElementById('doc-signer-left').value = doc.signerLeft || '';
    document.getElementById('doc-signer-right').value = doc.signerRight || '';
    document.getElementById('doc-content').value = doc.content || '';
    document.getElementById('hr-document-modal').classList.add('active');
  }

  function deleteHrDocument(idx) {
    if (!confirm('Supprimer ce document ?')) return;
    state.hrDocuments.splice(idx, 1);
    save(K.hrDocuments, state.hrDocuments);
    renderAll();
  }

  function printHrDocument(idx) {
    const doc = state.hrDocuments[idx];
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // Create a specialized print container for the document
    const printContainer = document.createElement('div');
    printContainer.id = 'temp-print-container';
    printContainer.className = 'card print-target';
    printContainer.style.display = 'none';
    
    printContainer.innerHTML = `
      <div style="text-align:center; margin-bottom: 30px;">
        <h2 style="font-size:24px; text-decoration:underline; margin-bottom: 10px;">${doc.title.toUpperCase()}</h2>
        <p style="font-size:14px; text-align:right;">Fait Ã  Blida, le ${doc.date ? new Date(doc.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : today}</p>
      </div>
      <div style="font-size:16px; line-height:1.6; white-space: pre-wrap; margin-top: 20px;">
        ${doc.content}
      </div>
      <div class="print-signature" style="margin-top: 60px;">
        <div class="print-signature-row">
          ${doc.signerLeft ? `
          <div class="print-signature-box">
            <div class="print-signature-label">${doc.signerLeft}</div>
            <div class="print-signature-line"></div>
          </div>` : '<div></div>'}
          ${doc.signerRight ? `
          <div class="print-signature-box">
            <div class="print-signature-label">${doc.signerRight}</div>
            <div class="print-signature-line"></div>
          </div>` : '<div></div>'}
        </div>
      </div>
    `;
    
    document.body.appendChild(printContainer);
    
    document.getElementById('print-page-info').textContent = '';
    
    document.querySelectorAll('.card').forEach(c => c.classList.remove('print-target'));
    printContainer.classList.add('print-target');
    
    const origTitle = document.title;
    document.title = doc.title;
    
    setTimeout(function() {
      window.print();
      setTimeout(function() {
        document.title = origTitle;
        document.body.removeChild(printContainer);
        document.querySelectorAll('.card').forEach(c => c.classList.remove('print-target'));
      }, 500);
    }, 300);
  }

  // ========== END HR DOCUMENTS MODULE ==========

  // ========== TECHNIQUE MODULE ==========
  function renderTechWorkSites() {
    const el = document.getElementById('tech-work-sites-list');
    if (!el) return;

    // Update Sidebar List from RH work sites
    const sidebarEl = document.getElementById('items-technique');
    if (sidebarEl) {
      const chantiersList = state.workSites.map((ws, i) => `
        <li>
          <button class="nav-btn ${state.currentTechProjectIdx === i && state.currentPanel === 'tech-project-detail' ? 'active' : ''}" onclick="app.openTechProject(${i})">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity:0.6;">
              <path d="M3 21h18M3 7v14M13 3v18M13 7h8M7 11h2M7 15h2M17 11h2M17 15h2"/>
            </svg>
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ws.name}</span>
          </button>
        </li>
      `).join('');

      sidebarEl.innerHTML = `
        <li>
          <button class="nav-btn" data-panel="tech-work-sites" onclick="app.switchPanel('tech-work-sites')">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <strong>Tous les chantiers</strong>
          </button>
        </li>
        ${chantiersList}
      `;
    }

    if (!state.workSites || state.workSites.length === 0) {
      el.innerHTML = `
        <div class="empty-state" style="padding:32px; text-align:center;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5" style="margin-bottom:10px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <p style="font-size:13px; color:var(--text-secondary); font-weight:600; margin:0 0 6px;">Aucun chantier disponible</p>
          <p style="font-size:12px; color:var(--text-tertiary); margin:0;">Ajoutez des chantiers dans le module <strong>RH â†’ Chantiers</strong> pour les voir apparaÃ®tre ici.</p>
        </div>`;
      return;
    }

    el.innerHTML = state.workSites.map((ws, i) => {
      const assigned = (ws.workerIds || []).map(id => state.workers[id]).filter(Boolean);
      const ptgCount = (ws.pointage || []).length;
      const rptCount = (ws.rapports || []).length;
      return `
        <div class="card" id="tws-card-${i}" style="cursor:pointer;" onclick="app.openTechProject(${i})">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <p style="font-weight:700; font-size:15px; margin:0; display:flex; align-items:center; gap:8px;">
                ${ws.name}
                <span style="font-size:11px; font-weight:500; color:var(--accent); background:var(--accent-bg); padding:2px 8px; border-radius:999px;">Ouvrir â†’</span>
              </p>
              <p style="font-size:12px; color:var(--text-secondary); margin:4px 0 8px;">${ws.desc || 'Pas de description'}</p>
            </div>
          </div>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <span style="font-size:11px; color:var(--text-tertiary); font-weight:500;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:3px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              ${assigned.length} travailleur(s)
            </span>
            <span style="font-size:11px; color:var(--text-tertiary); font-weight:500;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:3px;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${ptgCount} pointage(s)
            </span>
            <span style="font-size:11px; color:var(--text-tertiary); font-weight:500;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:3px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              ${rptCount} rapport(s)
            </span>
          </div>
        </div>`;
    }).join('');
  }

  function openTechWorkSiteModal() {
    state.editingTechWorkSiteIdx = null;
    document.getElementById('tech-work-site-modal-title').textContent = 'Nouveau Chantier (Technique)';
    document.getElementById('tws-name').value = '';
    document.getElementById('tws-desc').value = '';
    document.getElementById('tech-work-site-modal').classList.add('active');
  }

  function closeTechWorkSiteModal() {
    document.getElementById('tech-work-site-modal').classList.remove('active');
    state.editingTechWorkSiteIdx = null;
  }

  function saveTechWorkSite() {
    const name = document.getElementById('tws-name').value.trim();
    const desc = document.getElementById('tws-desc').value.trim();
    if (!name) { alert('Nom du chantier requis'); return; }

    const existing = state.editingTechWorkSiteIdx !== null ? state.techWorkSites[state.editingTechWorkSiteIdx] : {};
    const workSite = {
      name, desc,
      pointage: existing.pointage || [],
      rapports: existing.rapports || []
    };
    if (state.editingTechWorkSiteIdx !== null) {
      state.techWorkSites[state.editingTechWorkSiteIdx] = workSite;
    } else {
      state.techWorkSites.push(workSite);
    }

    save(K.techWorkSites, state.techWorkSites);
    closeTechWorkSiteModal();
    renderAll();
  }

  function editTechWorkSite(idx) {
    const ws = state.techWorkSites[idx];
    state.editingTechWorkSiteIdx = idx;
    document.getElementById('tech-work-site-modal-title').textContent = 'Modifier Chantier (Technique)';
    document.getElementById('tws-name').value = ws.name;
    document.getElementById('tws-desc').value = ws.desc || '';
    document.getElementById('tech-work-site-modal').classList.add('active');
  }

  function deleteTechWorkSite(idx) {
    if (!confirm('Supprimer ce chantier technique ?')) return;
    state.techWorkSites.splice(idx, 1);
    save(K.techWorkSites, state.techWorkSites);
    renderAll();
  }

  // ========== ADMIN POINTAGE â€” MONTHLY GRID ==========

  const MONTH_NAMES = ['Janvier','FÃ©vrier','Mars','Avril','Mai','Juin','Juillet','AoÃ»t','Septembre','Octobre','Novembre','DÃ©cembre'];
  const DAY_SHORT   = ['Di','Lu','Ma','Me','Je','Ve','Sa'];

  function adminPtgKey() {
    const d = new Date(state.adminPointageYear, state.adminPointageMonth, 1);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
  }

  function renderAdminPointage() {
    const root = document.getElementById('admin-ptg-root');
    if (!root) return;

    // Init month/year if needed
    if (state.adminPointageMonth === undefined || state.adminPointageMonth === null) {
      const now = new Date();
      state.adminPointageMonth = now.getMonth();
      state.adminPointageYear  = now.getFullYear();
    }

    const year  = state.adminPointageYear;
    const month = state.adminPointageMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthKey = adminPtgKey();
    const saved = state.adminPointage[monthKey] || {};

    // Work-site lookup: workerIdx â†’ name
    const workerSite = {};
    state.workSites.forEach(ws => {
      (ws.workerIds || []).forEach(id => {
        if (!workerSite[id]) workerSite[id] = ws.name;
        else workerSite[id] += ', ' + ws.name;
      });
    });

    if (!state.workers || state.workers.length === 0) {
      root.innerHTML = `<div class="ptg-card" style="padding:40px; text-align:center;">
        <p style="font-size:13px; color:var(--text-secondary); font-weight:600; margin:0 0 6px;">Aucun travailleur enregistrÃ©</p>
        <p style="font-size:12px; color:var(--text-tertiary); margin:0;">Ajoutez du personnel dans <strong>RH â†’ Personnel</strong>.</p>
      </div>`;
      return;
    }

    // Build day headers
    let dayHeaders = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay(); // 0=Sun,6=Sat
      const isWE = dow === 0 || dow === 5 || dow === 6; // Fri,Sat,Sun weekend (adjust as needed)
      dayHeaders += `<th class="ptg-th-day${isWE ? ' weekend' : ''}"><div class="dnum">${d}</div><div class="dname">${DAY_SHORT[dow]}</div></th>`;
    }
    // Inactive day fillers up to 31 for print alignment
    for (let d = daysInMonth + 1; d <= 31; d++) {
      dayHeaders += `<th class="ptg-th-day off" style="background:#F9FAFB;"><div class="dnum" style="color:#D1D5DB;">${d}</div><div class="dname" style="color:#D1D5DB;">â€”</div></th>`;
    }

    // Build rows
    let rowsHtml = '';
    state.workers.forEach((w, wi) => {
      const wData = saved[wi] || {};
      let daysCells = '';
      let totalFilled = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const val = wData[d] || '';
        const dow = new Date(year, month, d).getDay();
        const isWE = dow === 0 || dow === 5 || dow === 6;
        const colorClass = val === '' ? '' : /^[pP]$/.test(val) ? 'val-p' : /^[aA]$/.test(val) ? 'val-a' : /^[cC]$/.test(val) ? 'val-c' : 'val-num';
        if (val !== '') totalFilled++;
        daysCells += `<td class="ptg-cell${isWE ? ' weekend' : ''}"><input class="ptg-input ${colorClass}" data-wi="${wi}" data-day="${d}" maxlength="4" value="${val.toString().replace(/"/g,'&quot;')}" oninput="app.onPtgCellInput(this)" /></td>`;
      }
      // Inactive fillers
      for (let d = daysInMonth + 1; d <= 31; d++) {
        daysCells += `<td class="ptg-cell off"><input class="ptg-input" style="color:#D1D5DB; cursor:not-allowed;" disabled value="" /></td>`;
      }
      rowsHtml += `<tr>
        <td class="ptg-td-name">${w.name} ${w.surname}<small>${w.function || 'â€”'}</small></td>
        <td class="ptg-td-site">${workerSite[wi] || 'â€”'}</td>
        ${daysCells}
        <td class="ptg-td-total" id="ptg-total-${wi}">${totalFilled}</td>
      </tr>`;
    });

    root.innerHTML = `
      <div class="ptg-card">
        <div class="ptg-toolbar">
          <div class="ptg-month-nav">
            <button onclick="app.adminPtgPrevMonth()" title="Mois prÃ©cÃ©dent">â€¹</button>
            <span class="ptg-month-label">${MONTH_NAMES[month]} ${year}</span>
            <button onclick="app.adminPtgNextMonth()" title="Mois suivant">â€º</button>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <span style="font-size:11px; color:var(--text-tertiary); font-weight:500;">P = PrÃ©sent &nbsp;|&nbsp; A = Absent &nbsp;|&nbsp; C = CongÃ© &nbsp;|&nbsp; 8 = heures</span>
            <button class="btn-secondary" onclick="app.printAdminPointage()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimer
            </button>
          </div>
        </div>
        <div class="ptg-scroll">
          <table class="ptg-table">
            <thead>
              <tr>
                <th class="ptg-th-name">Travailleur</th>
                <th class="ptg-th-site">Chantier</th>
                ${dayHeaders}
                <th class="ptg-th-total">Jours</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>`;
  }

  function onPtgCellInput(input) {
    const wi  = parseInt(input.dataset.wi);
    const day = parseInt(input.dataset.day);
    const val = input.value.trim();
    const monthKey = adminPtgKey();
    if (!state.adminPointage[monthKey]) state.adminPointage[monthKey] = {};
    if (!state.adminPointage[monthKey][wi]) state.adminPointage[monthKey][wi] = {};
    if (val === '') {
      delete state.adminPointage[monthKey][wi][day];
    } else {
      state.adminPointage[monthKey][wi][day] = val;
    }
    // Update color class
    input.className = 'ptg-input ' + (/^[pP]$/.test(val) ? 'val-p' : /^[aA]$/.test(val) ? 'val-a' : /^[cC]$/.test(val) ? 'val-c' : val ? 'val-num' : '');
    // Update total for this row
    const wData = state.adminPointage[monthKey][wi] || {};
    const totalFilled = Object.values(wData).filter(v => v !== '').length;
    const totalEl = document.getElementById('ptg-total-' + wi);
    if (totalEl) totalEl.textContent = totalFilled;
    // Auto-save (debounced)
    clearTimeout(onPtgCellInput._t);
    onPtgCellInput._t = setTimeout(() => {
      try { localStorage.setItem(K.adminPointage, JSON.stringify(state.adminPointage)); } catch(e){}
    }, 600);
  }

  function adminPtgPrevMonth() {
    if (state.adminPointageMonth === 0) { state.adminPointageMonth = 11; state.adminPointageYear--; }
    else state.adminPointageMonth--;
    renderAdminPointage();
  }

  function adminPtgNextMonth() {
    if (state.adminPointageMonth === 11) { state.adminPointageMonth = 0; state.adminPointageYear++; }
    else state.adminPointageMonth++;
    renderAdminPointage();
  }

  // Legacy stubs kept so nothing breaks
  function onAdminDateChange() {}
  function onAttStatusChange() {}
  function saveAdminAttendance() {}

  function printAdminPointage() {
    const year  = state.adminPointageYear;
    const month = state.adminPointageMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthKey = adminPtgKey();
    const saved = state.adminPointage[monthKey] || {};
    const workerSite = {};
    state.workSites.forEach(ws => {
      (ws.workerIds || []).forEach(id => {
        if (!workerSite[id]) workerSite[id] = ws.name;
        else workerSite[id] += ', ' + ws.name;
      });
    });

    // Day headers
    let thDays = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay();
      const isWE = dow === 0 || dow === 5 || dow === 6;
      thDays += `<th style="width:22px;font-size:9px;padding:4px 2px;text-align:center;background:${isWE?'#FEF3C7':'#F3F4F6'};color:${isWE?'#B45309':'#374151'}">${d}</th>`;
    }

    // Rows
    let tbRows = '';
    state.workers.forEach((w, wi) => {
      const wData = saved[wi] || {};
      let cells = '';
      let total = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const val = wData[d] || '';
        const dow = new Date(year, month, d).getDay();
        const isWE = dow === 0 || dow === 5 || dow === 6;
        const color = /^[pP]$/.test(val) ? '#16A34A' : /^[aA]$/.test(val) ? '#DC2626' : /^[cC]$/.test(val) ? '#2563EB' : '#111827';
        if (val) total++;
        cells += `<td style="width:22px;text-align:center;padding:3px 1px;font-weight:700;font-size:10px;color:${color};background:${isWE?'#FFFBEB':'#fff'}">${val}</td>`;
      }
      tbRows += `<tr>
        <td style="padding:5px 8px;font-weight:600;font-size:11px;white-space:nowrap;border-right:1px solid #E5E7EB;">${wi+1}. ${w.name} ${w.surname}</td>
        <td style="padding:5px 8px;font-size:10px;color:#6B7280;white-space:nowrap;border-right:1px solid #E5E7EB;">${w.function||'â€”'}</td>
        <td style="padding:5px 8px;font-size:10px;color:#6B7280;white-space:nowrap;border-right:1px solid #E5E7EB;">${workerSite[wi]||'â€”'}</td>
        ${cells}
        <td style="padding:5px 6px;font-weight:800;font-size:11px;text-align:center;background:#F3F4F6;">${total}</td>
      </tr>`;
    });

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
      <title>Pointage â€” ${MONTH_NAMES[month]} ${year}</title>
      <style>
        *{box-sizing:border-box;} body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111827;margin:0;padding:16px;}
        h1{font-size:16px;font-weight:800;margin:0 0 2px;} .sub{font-size:11px;color:#6B7280;margin:0 0 14px;}
        table{border-collapse:collapse;} td,th{border:1px solid #E5E7EB;}
        .sig{margin-top:32px;display:flex;justify-content:space-around;}
        .sig-box{text-align:center;width:160px;}
        .sig-line{border-top:1px solid #D1D5DB;margin-top:28px;padding-top:4px;font-size:10px;color:#6B7280;}
        @page{size:A4 landscape;margin:10mm;} @media print{body{padding:0;}}
      </style>
    </head><body>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <div><h1>IPCM BOUTEMA</h1><p class="sub">Feuille de Pointage â€” ${MONTH_NAMES[month]} ${year}</p></div>
        <div style="text-align:right;font-size:10px;color:#6B7280;">ImprimÃ© le ${new Date().toLocaleDateString('fr-FR')}</div>
      </div>
      <table style="width:100%;">
        <thead><tr>
          <th style="padding:5px 8px;text-align:left;font-size:10px;">#. Nom & PrÃ©nom</th>
          <th style="padding:5px 8px;text-align:left;font-size:10px;">Fonction</th>
          <th style="padding:5px 8px;text-align:left;font-size:10px;">Chantier</th>
          ${thDays}
          <th style="width:28px;font-size:9px;padding:4px 2px;text-align:center;background:#F3F4F6;">Jrs</th>
        </tr></thead>
        <tbody>${tbRows}</tbody>
      </table>
      <div class="sig">
        <div class="sig-box"><div class="sig-line">Chef de Chantier</div></div>
        <div class="sig-box"><div class="sig-line">Responsable RH</div></div>
        <div class="sig-box"><div class="sig-line">Directeur</div></div>
      </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  }

  // ========== END ADMIN POINTAGE ==========

  // ========== TECH PROJECT DETAIL ==========

  function openTechProject(idx) {
    state.currentTechProjectIdx = idx;
    state.currentTechTab = 'pointage';
    switchPanel('tech-project-detail');
    const ws = state.workSites[idx];
    const meta = PANEL_META['tech-project-detail'];
    document.getElementById('page-title').textContent = ws ? ws.name : meta.title;
    document.getElementById('page-sub').textContent = ws ? (ws.desc || meta.sub) : meta.sub;
    renderTechProject();
    renderTechWorkSites(); // refresh sidebar active state
  }

  function switchTechTab(tab) {
    state.currentTechTab = tab;
    renderTechProject();
  }

  function renderTechProject() {
    const el = document.getElementById('tech-project-content');
    if (!el) return;
    const idx = state.currentTechProjectIdx;
    if (idx === null || idx === undefined || !state.workSites[idx]) {
      el.innerHTML = '<div class="empty-state">Aucun projet sÃ©lectionnÃ©.</div>';
      return;
    }
    const ws = state.workSites[idx];
    if (!ws.pointage) ws.pointage = [];
    if (!ws.rapports) ws.rapports = [];
    const tab = state.currentTechTab || 'pointage';

    // Pointage table
    let pointageHtml = '';
    if (ws.pointage.length === 0) {
      pointageHtml = '<div class="empty-state" style="padding:24px;">Aucune entrÃ©e de pointage. Cliquez sur "+ Pointage" pour commencer.</div>';
    } else {
      const rows = ws.pointage.map((p, i) => `
        <div class="pointage-row">
          <span>${p.date || 'â€”'}</span>
          <span>${p.worker || 'â€”'}</span>
          <span style="text-align:right; font-variant-numeric:tabular-nums;">${p.hours || 0}h</span>
          <span>${p.task || 'â€”'}</span>
          <button class="ghost-btn" title="Supprimer" onclick="app.deletePointage(${i})">Ã—</button>
        </div>`).join('');
      const totalH = ws.pointage.reduce((s, p) => s + (parseFloat(p.hours) || 0), 0);
      pointageHtml = `
        <div style="border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden;">
          <div class="pointage-row header">
            <span>Date</span><span>Travailleur</span><span style="text-align:right;">Heures</span><span>TÃ¢che</span><span></span>
          </div>
          ${rows}
          <div class="pointage-row" style="background:var(--bg-muted); font-weight:700;">
            <span style="grid-column:1/3;">Total</span>
            <span style="text-align:right; font-variant-numeric:tabular-nums;">${totalH}h</span>
            <span></span><span></span>
          </div>
        </div>`;
    }

    // Rapports list
    let rapportsHtml = '';
    if (ws.rapports.length === 0) {
      rapportsHtml = '<div class="empty-state" style="padding:24px;">Aucun rapport. Cliquez sur "+ Rapport" pour en crÃ©er un.</div>';
    } else {
      rapportsHtml = ws.rapports.map((r, i) => `
        <div class="rapport-card">
          <div class="rapport-card-head">
            <div>
              <p class="rapport-title">${r.title || 'Sans titre'}</p>
              <p class="rapport-meta">${r.date || 'â€”'} ${r.author ? 'Â· ' + r.author : ''}</p>
            </div>
            <button class="ghost-btn" title="Supprimer" onclick="app.deleteRapport(${i})">Ã—</button>
          </div>
          <p class="rapport-body">${r.content || ''}</p>
        </div>`).join('');
    }

    // Build assigned workers list for display
    const assignedWorkers = (ws.workerIds || []).map(id => state.workers[id]).filter(Boolean);
    const workerPills = assignedWorkers.length > 0
      ? assignedWorkers.map(w => `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--accent-bg);color:var(--accent);font-size:11px;font-weight:600;padding:2px 9px;border-radius:999px;">${w.name} ${w.surname}</span>`).join('')
      : `<span style="font-size:12px;color:var(--text-tertiary);">Aucun travailleur affectÃ© â€” <button onclick="app.switchModule('rh');app.switchPanel('work-sites');" style="background:none;border:none;cursor:pointer;color:var(--accent);font-size:12px;font-weight:600;padding:0;">GÃ©rer dans RH</button></span>`;

    el.innerHTML = `
      <button class="proj-back-btn" onclick="app.switchPanel('tech-work-sites')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Tous les chantiers
      </button>

      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
        <div>
          <h2 style="margin:0; font-size:20px; font-weight:800;">${ws.name}</h2>
          ${ws.desc ? `<p style="margin:2px 0 0; font-size:13px; color:var(--text-secondary);">${ws.desc}</p>` : ''}
          <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:5px; align-items:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            ${workerPills}
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          ${tab === 'pointage'
            ? `<button class="btn-primary" onclick="app.openPointageModal()">+ Pointage</button>`
            : `<button class="btn-primary" onclick="app.openRapportModal()">+ Rapport</button>`
          }
        </div>
      </div>

      <div class="proj-tabs">
        <button class="proj-tab ${tab === 'pointage' ? 'active' : ''}" onclick="app.switchTechTab('pointage')">
          <svg style="width:14px;height:14px;vertical-align:middle;margin-right:5px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Pointage
        </button>
        <button class="proj-tab ${tab === 'rapports' ? 'active' : ''}" onclick="app.switchTechTab('rapports')">
          <svg style="width:14px;height:14px;vertical-align:middle;margin-right:5px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Rapports
        </button>
      </div>

      <div id="tech-tab-content">
        ${tab === 'pointage' ? pointageHtml : rapportsHtml}
      </div>`;
  }

  function openPointageModal() {
    state.editingPointageIdx = null;
    document.getElementById('pointage-modal-title').textContent = 'Nouvelle EntrÃ©e Pointage';
    document.getElementById('ptg-date').value = todayISO();
    document.getElementById('ptg-hours').value = '';
    document.getElementById('ptg-task').value = '';
    document.getElementById('ptg-notes').value = '';

    // Populate worker dropdown from assigned RH workers for this chantier
    const sel = document.getElementById('ptg-worker');
    const ws = state.workSites[state.currentTechProjectIdx];
    const assignedWorkers = ws ? (ws.workerIds || []).map(id => state.workers[id]).filter(Boolean) : [];

    if (assignedWorkers.length > 0) {
      sel.innerHTML = '<option value="">â€” SÃ©lectionner un travailleur â€”</option>' +
        assignedWorkers.map(w => `<option value="${w.name} ${w.surname}">${w.name} ${w.surname}${w.function ? ' (' + w.function + ')' : ''}</option>`).join('');
    } else {
      // Fallback: show all workers if none specifically assigned
      const allWorkers = state.workers;
      if (allWorkers.length > 0) {
        sel.innerHTML = '<option value="">â€” SÃ©lectionner un travailleur â€”</option>' +
          allWorkers.map(w => `<option value="${w.name} ${w.surname}">${w.name} ${w.surname}${w.function ? ' (' + w.function + ')' : ''}</option>`).join('') +
          '<option value="" disabled>â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€</option>' +
          '<option value="__note__" disabled style="font-size:10px;color:var(--text-tertiary);">Aucun travailleur affectÃ© Ã  ce chantier â€” gÃ©rer dans RH</option>';
      } else {
        sel.innerHTML = '<option value="">Aucun travailleur dans RH</option>';
      }
    }

    document.getElementById('pointage-modal').classList.add('active');
  }

  function closePointageModal() {
    document.getElementById('pointage-modal').classList.remove('active');
  }

  function savePointage() {
    const idx = state.currentTechProjectIdx;
    if (idx === null || idx === undefined) return;
    const ws = state.workSites[idx];
    if (!ws.pointage) ws.pointage = [];
    const workerSel = document.getElementById('ptg-worker');
    const workerVal = workerSel.value.trim();
    const entry = {
      date: document.getElementById('ptg-date').value,
      worker: workerVal,
      hours: parseFloat(document.getElementById('ptg-hours').value) || 0,
      task: document.getElementById('ptg-task').value.trim(),
      notes: document.getElementById('ptg-notes').value.trim()
    };
    if (!entry.date || !entry.worker) { alert('Date et travailleur requis'); return; }
    ws.pointage.push(entry);
    save(K.workSites, state.workSites);
    closePointageModal();
    renderTechProject();
  }

  function deletePointage(pIdx) {
    if (!confirm('Supprimer cette entrÃ©e ?')) return;
    const ws = state.workSites[state.currentTechProjectIdx];
    ws.pointage.splice(pIdx, 1);
    save(K.workSites, state.workSites);
    renderTechProject();
  }

  function openRapportModal() {
    state.editingRapportIdx = null;
    document.getElementById('rapport-modal-title').textContent = 'Nouveau Rapport';
    document.getElementById('rpt-date').value = todayISO();
    document.getElementById('rpt-author').value = '';
    document.getElementById('rpt-title').value = '';
    document.getElementById('rpt-content').value = '';
    document.getElementById('rapport-modal').classList.add('active');
  }

  function closeRapportModal() {
    document.getElementById('rapport-modal').classList.remove('active');
  }

  function saveRapport() {
    const idx = state.currentTechProjectIdx;
    if (idx === null || idx === undefined) return;
    const ws = state.workSites[idx];
    if (!ws.rapports) ws.rapports = [];
    const entry = {
      date: document.getElementById('rpt-date').value,
      author: document.getElementById('rpt-author').value.trim(),
      title: document.getElementById('rpt-title').value.trim(),
      content: document.getElementById('rpt-content').value.trim()
    };
    if (!entry.title) { alert('Titre requis'); return; }
    ws.rapports.push(entry);
    save(K.workSites, state.workSites);
    closeRapportModal();
    renderTechProject();
  }

  function deleteRapport(rIdx) {
    if (!confirm('Supprimer ce rapport ?')) return;
    const ws = state.workSites[state.currentTechProjectIdx];
    ws.rapports.splice(rIdx, 1);
    save(K.workSites, state.workSites);
    renderTechProject();
  }

  // ========== END TECH PROJECT DETAIL ==========

  return {
    openTransactionModal,
    closeTransactionModal,
    updateTransSitDropdowns,
    switchPanel,
    switchModule,
    saveTransaction,
    editTransaction,
    deleteTransaction,
    openSituationModal,
    closeSituationModal,
    saveSituation,
    editSituation,
    openPartialPayment,
    closePartialPayment,
    toggleFullPayment,
    savePartialPayment,
    deleteSituation,
    editCharge,
    deleteCharge,
    addClientName,
    deleteClientName,
    addFournisseur,
    addFournisseurName,
    deleteFournisseurName,
    deleteFournisseur,
    openFournisseurPay,
    closeFournisseurPay,
    toggleFournisseurFull,
    saveFournisseurPay,
    openLimitModal,
    closeLimitModal,
    saveLimit,
    clearLimit,
    printPage,
    printFournisseur,
    exportData,
    importData,
    showFournisseurReport,
    printFournisseurReport,
    simSetPick,
    simDeleteSupplier,
    simSetAmount,
    printSimulator,
    invSetLine,
    invAddLine,
    invDelLine,
    invReset,
    saveInvoice,
    deleteInvoice,
    printInvoice,
    addRib,
    deleteRib,
    saveClientDetails,
    loadClientDetailsToForm,
    deleteClientDetails,
    deleteSituationPayment,
    deleteFournisseurPayment,
    addProject,
    deleteProject,
    toggleProjectStatus,
    openProjectExpense,
    closeProjectExpense,
    saveProjectExpense,
    openProjectPayment,
    closeProjectPayment,
    saveProjectPayment,
    deleteProjectExpense,
    deleteProjectPayment,
    openWorkerModal,
    closeWorkerModal,
    saveWorker,
    editWorker,
    deleteWorker,
    printWorkers,
    importWorkers,
    openWorkSiteModal,
    closeWorkSiteModal,
    saveWorkSite,
    editWorkSite,
    deleteWorkSite,
    printWorkSites,
    openHrDocumentModal,
    closeHrDocumentModal,
    saveHrDocument,
    editHrDocument,
    deleteHrDocument,
    printHrDocument,
    addHrFolder,
    deleteHrFolder,
    selectHrFolder,
    archiveCurrentContract,
    archiveOnly,
    archiveAndRenew,
    toggleWorkerHistory,
    viewInSuivi,
    renderTechWorkSites,
    openTechWorkSiteModal,
    closeTechWorkSiteModal,
    saveTechWorkSite,
    editTechWorkSite,
    deleteTechWorkSite,
    switchModule,
    renderAdminPointage,
    onAdminDateChange,
    onAttStatusChange,
    saveAdminAttendance,
    printAdminPointage,
    onPtgCellInput,
    adminPtgPrevMonth,
    adminPtgNextMonth,
    openTechProject,
    switchTechTab,
    renderTechProject,
    openPointageModal,
    closePointageModal,
    savePointage,
    deletePointage,
    openRapportModal,
    closeRapportModal,
    saveRapport,
    deleteRapport
  };
})();
</script>
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}


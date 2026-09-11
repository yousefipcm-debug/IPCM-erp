/* ARCIS — native-style iPhone app layer
   On phones (or with window.ARCIS_MOBILE = true) this replaces the desktop
   layout entirely with a real iOS app: tab bar, large titles, grouped inset
   lists, drill-down detail screens, bottom sheets and toasts.
   It reads and writes the SAME localStorage data as the desktop app, then
   calls window.app.loadAll() so both views stay in sync.
   Turn off with window.ARCIS_MOBILE = false. */
(function () {
  'use strict';

  var MQ = window.matchMedia('(max-width: 900px)');
  var K = {
    transactions: 'ipcm_v2_transactions',
    situations: 'ipcm_v2_situations',
    workers: 'ipcm_v2_workers',
    workSites: 'ipcm_v2_workSites',
    clientNames: 'ipcm_v2_clientNames'
  };
  var RED = '#ec3013';

  var S = { tab: 'home', detail: null, q: '', filter: 'all', sit: 'late', ws: 0,
            sheet: null, kind: 'out', toast: null, root: null };

  /* ── data ─────────────────────────────────────────────── */
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    if (window.app && typeof window.app.loadAll === 'function') { try { window.app.loadAll(); } catch (e) {} }
  }
  function fmt(n) { return Math.round(n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' '); }
  function shortM(n) { return (Math.abs(n) >= 1e6) ? (n / 1e6).toFixed(1).replace('.', ',') + ' M' : fmt(n); }
  function paid(s) { return (s.payments || []).reduce(function (a, p) { return a + (p.amount || 0); }, 0); }
  function remain(s) { return Math.round(((s.amount || 0) - paid(s)) * 100) / 100; }
  function parseD(d) {
    if (!d) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(d);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    var t = new Date(d); return isNaN(t) ? null : t;
  }
  function daysLate(s) {
    var d = parseD(s.date); if (!d) return 0;
    return Math.max(0, Math.round((Date.now() - d.getTime()) / 864e5));
  }
  function frDate(d) {
    var t = parseD(d); if (!t) return '—';
    return t.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function dayMonth(d) {
    var t = parseD(d); if (!t) return '';
    return t.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }
  function balance() {
    return read(K.transactions).reduce(function (a, t) {
      return a + (t.type === 'in' ? (t.amount || 0) : -(t.amount || 0));
    }, 0);
  }
  function journalBalance(j) {
    return read(K.transactions).filter(function (t) { return !j || t.journal === j; })
      .reduce(function (a, t) { return a + (t.type === 'in' ? (t.amount || 0) : -(t.amount || 0)); }, 0);
  }
  function sitGroups() {
    var late = [], soon = [], done = [];
    read(K.situations).forEach(function (s, i) {
      var r = remain(s); s._i = i; s._rem = r; s._late = daysLate(s);
      if (r <= 0) done.push(s); else if (s._late > 0) late.push(s); else soon.push(s);
    });
    late.sort(function (a, b) { return b._late - a._late; });
    return { late: late, soon: soon, paid: done };
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function role() { return (sessionStorage.getItem('ipcm_role') || localStorage.getItem('ipcm_role') || ''); }
  function uname() { return (sessionStorage.getItem('ipcm_dname') || localStorage.getItem('ipcm_dname') || 'Utilisateur'); }
  function initials(n) {
    return String(n || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  }

  /* ── chrome ───────────────────────────────────────────── */
  var SEP = '.33px solid rgba(60,60,67,.29)';
  function seg(opts, active, onName) {
    return '<div class="ai-seg">' + opts.map(function (o) {
      var on = o.v === active;
      return '<button data-act="' + onName + '" data-v="' + o.v + '" class="ai-seg-o' + (on ? ' on' : '') + '">' + esc(o.l) + '</button>';
    }).join('') + '</div>';
  }
  function chev() {
    return '<svg class="ai-chev" width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="#C7C7CC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l6 6-6 6"/></svg>';
  }
  function groupHead(t, extra) {
    return '<div class="ai-ghead"><span>' + esc(t) + '</span>' + (extra ? '<span class="ai-ghead-x">' + extra + '</span>' : '') + '</div>';
  }
  function empty(t) { return '<div class="ai-empty">' + esc(t) + '</div>'; }

  /* ── screens ──────────────────────────────────────────── */
  function scrHome() {
    var g = sitGroups();
    var creances = g.late.concat(g.soon).reduce(function (a, s) { return a + s._rem; }, 0);
    var bal = balance();
    var lates = g.late.slice(0, 3);
    var h = '';
    h += '<div class="ai-hero"><div class="ai-hero-l">Trésorerie disponible</div>' +
         '<div class="ai-hero-v">' + fmt(bal) + '</div><div class="ai-hero-s">DA · tous journaux</div>' +
         '<div class="ai-hero-row">' +
           '<div class="ai-hero-c"><span>Caisse</span><b>' + fmt(journalBalance('caisse')) + '</b></div>' +
           '<div class="ai-hero-c"><span>Banque</span><b>' + fmt(journalBalance('banque')) + '</b></div>' +
         '</div></div>';
    h += '<div class="ai-duo">' +
      '<div class="ai-tile"><span>Créances</span><b>' + shortM(creances) + '</b><i style="color:' + RED + '">' + (g.late.length + g.soon.length) + ' en cours</i></div>' +
      '<div class="ai-tile"><span>En retard</span><b>' + shortM(g.late.reduce(function (a, s) { return a + s._rem; }, 0)) + '</b><i>' + g.late.length + ' situations</i></div>' +
      '</div>';
    h += '<div class="ai-trio">' +
      '<button data-act="new-in" class="ai-quick"><span class="ai-qi red"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="' + RED + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg></span>Encaisser</button>' +
      '<button data-act="new-out" class="ai-quick"><span class="ai-qi"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></span>Dépense</button>' +
      '<button data-act="tab" data-v="ptg" class="ai-quick"><span class="ai-qi"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>Pointer</button>' +
      '</div>';
    h += groupHead('À traiter', lates.length ? lates.length + ' éléments' : '');
    h += '<div class="ai-list">';
    if (!lates.length) h += empty('Aucune situation en retard.');
    lates.forEach(function (s, i) {
      h += '<button data-act="sit" data-v="' + s._i + '" class="ai-cell"><span class="ai-dot" style="background:' + RED + '"></span>' +
        '<span class="ai-cell-b" style="border-bottom:' + (i === lates.length - 1 ? 'none' : SEP) + '">' +
        '<span class="ai-t">' + esc(s.client || 'Client') + ' · retard ' + s._late + ' j</span>' +
        '<span class="ai-s">' + fmt(s._rem) + ' DA · ' + esc(s.number || s.project || '—') + '</span></span>' + chev() + '</button>';
    });
    h += '</div>';
    return h;
  }

  function scrCash() {
    var q = S.q.trim().toLowerCase();
    var rows = read(K.transactions).slice().reverse().filter(function (t) {
      if (S.filter === 'in' && t.type !== 'in') return false;
      if (S.filter === 'out' && t.type !== 'out') return false;
      if (!q) return true;
      return ((t.desc || '') + ' ' + (t.client || '') + ' ' + (t.fournisseur || '')).toLowerCase().indexOf(q) > -1;
    });
    var h = '';
    h += '<div class="ai-sticky">' +
      '<div class="ai-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.3-4.3"/></svg>' +
      '<input id="ai-q" placeholder="Rechercher" value="' + esc(S.q) + '" />' +
      (S.q ? '<button data-act="clearq" class="ai-clear">✕</button>' : '') + '</div>' +
      seg([{ v: 'all', l: 'Tout' }, { v: 'in', l: 'Entrées' }, { v: 'out', l: 'Sorties' }], S.filter, 'filter') +
      '</div>';
    h += groupHead('Solde', '<b class="ai-num">' + fmt(balance()) + '</b>');
    h += '<div class="ai-list">';
    if (!rows.length) h += empty(S.q ? 'Aucun résultat pour « ' + esc(S.q) + ' ».' : 'Aucune écriture enregistrée.');
    rows.slice(0, 60).forEach(function (t, i, arr) {
      var inn = t.type === 'in';
      h += '<div class="ai-cell"><span class="ai-chip' + (inn ? ' red' : '') + '">' + (inn ? '↓' : '↑') + '</span>' +
        '<span class="ai-cell-b" style="border-bottom:' + (i === Math.min(arr.length, 60) - 1 ? 'none' : SEP) + '">' +
        '<span class="ai-cb-main"><span class="ai-t">' + esc(t.desc || (inn ? 'Encaissement' : 'Dépense')) + '</span>' +
        '<span class="ai-s">' + esc(t.client || t.fournisseur || (t.journal || '—')) + ' · ' + dayMonth(t.date) + '</span></span>' +
        '<span class="ai-num' + (inn ? ' red' : '') + '">' + (inn ? '+' : '−') + fmt(t.amount) + '</span></span></div>';
    });
    h += '</div>';
    h += '<div class="ai-foot">' + rows.length + (rows.length > 1 ? ' écritures' : ' écriture') + '</div>';
    return h;
  }

  function scrSit() {
    var g = sitGroups();
    var list = g[S.sit] || [];
    var total = list.reduce(function (a, s) { return a + (S.sit === 'paid' ? paid(s) : s._rem); }, 0);
    var h = '';
    h += '<div class="ai-sticky">' + seg([{ v: 'late', l: 'En retard' }, { v: 'soon', l: 'À échoir' }, { v: 'paid', l: 'Payées' }], S.sit, 'sit') + '</div>';
    h += groupHead(S.sit === 'paid' ? 'Encaissé' : 'Total dû', '<b class="ai-num">' + fmt(total) + '</b>');
    h += '<div class="ai-list">';
    if (!list.length) h += empty('Aucune situation dans cette catégorie.');
    list.forEach(function (s, i) {
      var tag = S.sit === 'paid' ? 'Payée' : (s._late > 0 ? 'Retard ' + s._late + ' j' : 'Échéance ' + frDate(s.date));
      var cls = S.sit === 'paid' ? 'n' : (s._late > 30 ? 'r' : 't');
      h += '<button data-act="sit" data-v="' + s._i + '" class="ai-cell tall">' +
        '<span class="ai-cell-b" style="border-bottom:' + (i === list.length - 1 ? 'none' : SEP) + '">' +
        '<span class="ai-cb-main"><span class="ai-t b">' + esc(s.client || 'Client') + '</span>' +
        '<span class="ai-s">' + esc(s.number || '—') + (s.project ? ' · ' + esc(s.project) : '') + '</span>' +
        '<span class="ai-tag ' + cls + '">' + esc(tag) + '</span></span>' +
        '<span class="ai-amt"><b>' + fmt(S.sit === 'paid' ? paid(s) : s._rem) + '</b><i>DA</i></span>' + chev() + '</span></button>';
    });
    h += '</div>';
    return h;
  }

  function scrDetail() {
    var all = read(K.situations);
    var s = all[S.detail]; if (!s) { S.detail = null; return scrSit(); }
    var rem = remain(s), pd = paid(s), late = rem > 0 ? daysLate(s) : 0;
    var h = '<div class="ai-push">';
    h += '<div class="ai-dhead"><h2>' + esc(s.client || 'Client') + '</h2><p>' + esc(s.project || s.number || '') + '</p></div>';
    h += '<div class="ai-hero small"><div class="ai-hero-l">' + (rem > 0 ? 'Montant dû' : 'Situation soldée') + '</div>' +
         '<div class="ai-hero-v">' + fmt(rem > 0 ? rem : (s.amount || 0)) + '</div><div class="ai-hero-s">DA</div></div>';
    h += '<div class="ai-list plain">' +
      row('Montant total', fmt(s.amount) + ' DA') +
      row('Déjà payé', fmt(pd) + ' DA') +
      row('Restant', fmt(rem) + ' DA', rem > 0 ? RED : '#000') +
      row('Date', frDate(s.date)) +
      row('Retard', late ? late + ' jours' : 'Aucun', late > 30 ? RED : '#000') +
      row('N° situation', esc(s.number || '—'), null, true) +
      '</div>';
    if (rem > 0) {
      h += '<div class="ai-acts">' +
        '<button data-act="pay-full" class="ai-btn">Encaisser ' + fmt(rem) + ' DA</button>' +
        '<button data-act="pay-part" class="ai-btn ghost">Paiement partiel</button>' +
        '</div>';
    }
    h += '</div>';
    return h;
  }
  function row(l, v, color, last) {
    return '<div class="ai-row"' + (last ? ' data-last="1"' : '') + '><span>' + esc(l) + '</span><b' +
      (color ? ' style="color:' + color + '"' : '') + '>' + v + '</b></div>';
  }

  function scrPtg() {
    var sites = read(K.workSites), workers = read(K.workers);
    if (!sites.length) return groupHead('Pointage') + '<div class="ai-list">' + empty('Aucun chantier enregistré. Créez-en un depuis le poste.') + '</div>';
    if (S.ws >= sites.length) S.ws = 0;
    var ws = sites[S.ws];
    var ids = (ws.workerIds || []).slice();
    var crew = ids.length ? ids.map(function (i) { return workers[i]; }).filter(Boolean) : workers;
    var today = new Date().toISOString().slice(0, 10);
    var pt = (ws.pointage || []).filter(function (p) { return p.date === today; });
    function statOf(name) { var e = pt.filter(function (p) { return p.worker === name; })[0]; return e ? (e.status || 'P') : null; }
    var pres = 0, abs = 0, hs = 0;
    crew.forEach(function (w) { var v = statOf(w.name); if (v === 'P') pres++; else if (v === 'H') { pres++; hs++; } else if (v === 'A') abs++; });

    var h = '';
    h += '<div class="ai-sticky"><div class="ai-wsbar">' +
      '<div class="ai-wsl"><span>Chantier</span><b>' + esc(ws.name || ws.site || 'Chantier ' + (S.ws + 1)) + '</b></div>' +
      (sites.length > 1 ? '<button data-act="ws-next" class="ai-mini">Changer</button>' : '') +
      '<div class="ai-wsr"><span>Présents</span><b>' + pres + ' / ' + crew.length + '</b></div></div></div>';
    h += '<div class="ai-list">';
    if (!crew.length) h += empty('Aucun ouvrier affecté à ce chantier.');
    crew.forEach(function (w, i) {
      var v = statOf(w.name);
      h += '<div class="ai-wcell" style="border-bottom:' + (i === crew.length - 1 ? 'none' : SEP) + '">' +
        '<div class="ai-wtop"><span class="ai-av">' + esc(initials(w.name)) + '</span>' +
        '<span class="ai-cb-main"><span class="ai-t b">' + esc(w.name || 'Ouvrier') + '</span>' +
        '<span class="ai-s">' + esc(w.poste || w.job || 'Ouvrier') + ' · ' +
        (v === 'P' ? 'présent' : v === 'A' ? 'absent' : v === 'H' ? 'présent + HS' : 'non saisi') + '</span></span></div>' +
        '<div class="ai-seg tight">' +
          '<button data-act="att" data-w="' + esc(w.name) + '" data-v="P" class="ai-seg-o' + (v === 'P' ? ' on' : '') + '">Présent</button>' +
          '<button data-act="att" data-w="' + esc(w.name) + '" data-v="A" class="ai-seg-o' + (v === 'A' ? ' on red' : '') + '">Absent</button>' +
          '<button data-act="att" data-w="' + esc(w.name) + '" data-v="H" class="ai-seg-o' + (v === 'H' ? ' on' : '') + '">+ HS</button>' +
        '</div></div>';
    });
    h += '</div><div class="ai-foot">' + pres + ' présents · ' + abs + ' absents · ' + hs + ' en heures supplémentaires · ' + frDate(today) + '</div>';
    return h;
  }

  function scrMore() {
    var g = sitGroups();
    var mods = [
      ['Facturation', '', 'facturation'],
      ['Journaux complets', '', 'journaux'],
      ['Situations & clients', g.late.length ? g.late.length + ' en retard' : '', 'situations'],
      ['Fournisseurs', '', 'fournisseurs'],
      ['Projets / Chantiers', '', 'projets'],
      ['Alertes', '', 'alertes']
    ];
    var h = '';
    h += '<div class="ai-list plain"><div class="ai-prof"><span class="ai-av big">' + esc(initials(uname())) + '</span>' +
      '<span class="ai-cb-main"><span class="ai-t big">' + esc(uname()) + '</span><span class="ai-s">' + esc(role() || 'Utilisateur') + '</span></span></div></div>';
    h += groupHead('Ouvrir sur le poste');
    h += '<div class="ai-list">';
    mods.forEach(function (m, i) {
      h += '<button data-act="desk" data-v="' + m[2] + '" class="ai-cell">' +
        '<span class="ai-cell-b" style="border-bottom:' + (i === mods.length - 1 ? 'none' : SEP) + '">' +
        '<span class="ai-t">' + esc(m[0]) + '</span>' +
        (m[1] ? '<span class="ai-s r">' + esc(m[1]) + '</span>' : '') + chev() + '</span></button>';
    });
    h += '</div>';
    h += groupHead('Application');
    h += '<div class="ai-list plain">' +
      '<div class="ai-row"><span>Vue ordinateur</span><b><button data-act="desktop-view" class="ai-mini">Afficher</button></b></div>' +
      '<div class="ai-row" data-last="1"><span>Version</span><b>ARCIS 2.4</b></div></div>';
    h += '<div class="ai-list plain" style="margin-top:18px"><button data-act="logout" class="ai-cell center red">Se déconnecter</button></div>';
    return h;
  }

  /* ── sheets ───────────────────────────────────────────── */
  function sheetEntry() {
    var inn = S.kind === 'in';
    return '<div class="ai-sheet-h"><button data-act="close-sheet" class="ai-lk">Annuler</button>' +
      '<b>' + (inn ? 'Nouvelle entrée' : 'Nouvelle sortie') + '</b>' +
      '<button data-act="save-entry" class="ai-lk strong">Ajouter</button></div>' +
      '<div class="ai-sheet-b">' +
      seg([{ v: 'in', l: 'Entrée' }, { v: 'out', l: 'Sortie' }], S.kind, 'kind') +
      '<div class="ai-list plain" style="margin-top:14px">' +
        '<label class="ai-frow big"><span>Montant</span><input id="ai-amt" inputmode="numeric" placeholder="0" /><i>DA</i></label>' +
        '<label class="ai-frow"><span>Libellé</span><input id="ai-desc" placeholder="Ex. carburant engins" /></label>' +
        '<label class="ai-frow" data-last="1"><span>' + (inn ? 'Client' : 'Tiers') + '</span><input id="ai-party" placeholder="Optionnel" /></label>' +
      '</div>' +
      '<button data-act="save-entry" class="ai-btn" style="margin-top:16px">Enregistrer l\'écriture</button>' +
      '</div>';
  }
  function sheetPay() {
    var s = read(K.situations)[S.detail] || {};
    return '<div class="ai-sheet-h"><button data-act="close-sheet" class="ai-lk">Annuler</button><b>Paiement partiel</b>' +
      '<button data-act="save-pay" class="ai-lk strong">Valider</button></div>' +
      '<div class="ai-sheet-b"><div class="ai-list plain">' +
      '<div class="ai-row"><span>Restant dû</span><b>' + fmt(remain(s)) + ' DA</b></div>' +
      '<label class="ai-frow big" data-last="1"><span>Montant</span><input id="ai-pay" inputmode="numeric" placeholder="0" /><i>DA</i></label>' +
      '</div><button data-act="save-pay" class="ai-btn" style="margin-top:16px">Enregistrer le paiement</button></div>';
  }

  /* ── render ───────────────────────────────────────────── */
  var TABS = [
    ['home', 'Accueil', '<path d="M3 10.5L12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/>'],
    ['cash', 'Caisse', '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.4"/>'],
    ['sit', 'Situations', '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M8 3v3.5M16 3v3.5M3 10h18"/>'],
    ['ptg', 'Pointage', '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'],
    ['more', 'Plus', '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>']
  ];
  var TITLES = { home: 'Accueil', cash: 'Écritures', sit: 'Situations', ptg: 'Pointage', more: 'Plus' };

  function render() {
    var el = S.root; if (!el) return;
    var g = sitGroups();
    var body, navBar;
    if (S.detail !== null && S.tab === 'sit') {
      body = scrDetail();
      navBar = '<div class="ai-nav back"><button data-act="back" class="ai-lk"><svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2L2 10l8 8"/></svg>Situations</button><b>Fiche</b></div>';
    } else {
      body = S.tab === 'home' ? scrHome() : S.tab === 'cash' ? scrCash() : S.tab === 'sit' ? scrSit() :
             S.tab === 'ptg' ? scrPtg() : scrMore();
      navBar = '<div class="ai-large"><div class="ai-kick">' + esc(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })) + '</div>' +
        '<div class="ai-lrow"><h1>' + TITLES[S.tab] + '</h1>' +
        (S.tab === 'cash' ? '<button data-act="new-out" class="ai-add"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>' : '') +
        '</div></div>';
    }

    var save = S.tab === 'ptg' && S.detail === null;
    el.innerHTML =
      navBar +
      '<div class="ai-scroll' + (save ? ' with-bar' : '') + '" id="ai-scroll">' + body + '</div>' +
      (save ? '<div class="ai-bar"><button data-act="save-ptg" class="ai-btn">Enregistrer le pointage</button></div>' : '') +
      '<nav class="ai-tabs">' + TABS.map(function (t) {
        var on = S.tab === t[0] && (t[0] !== 'sit' || S.detail === null || true);
        var badge = t[0] === 'sit' && g.late.length ? '<i class="ai-badge">' + g.late.length + '</i>' : '';
        return '<button data-act="tab" data-v="' + t[0] + '" class="ai-tab' + (S.tab === t[0] ? ' on' : '') + '">' +
          '<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + t[2] + '</svg>' +
          '<span>' + t[1] + '</span>' + badge + '</button>';
      }).join('') + '</nav>' +
      (S.sheet ? '<div class="ai-scrim" data-act="close-sheet"></div><div class="ai-sheet">' +
        (S.sheet === 'pay' ? sheetPay() : sheetEntry()) + '</div>' : '') +
      (S.toast ? '<div class="ai-toast"><span class="ai-tk">✓</span>' + esc(S.toast) + '</div>' : '');

    var q = el.querySelector('#ai-q');
    if (q) {
      q.addEventListener('input', function () { S.q = q.value; renderListOnly(); });
      if (S._focusQ) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }
    var amt = el.querySelector('#ai-amt') || el.querySelector('#ai-pay');
    if (amt && S._focusAmt) amt.focus();
  }

  // re-render just the cash list so the search field never loses focus
  function renderListOnly() {
    S._focusQ = true;
    var sc = document.getElementById('ai-scroll');
    var top = sc ? sc.scrollTop : 0;
    render();
    S._focusQ = false;
    var s2 = document.getElementById('ai-scroll');
    if (s2) s2.scrollTop = top;
  }

  function toast(msg) {
    S.toast = msg; render();
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { S.toast = null; render(); }, 2200);
  }

  /* ── actions ──────────────────────────────────────────── */
  function onClick(e) {
    var b = e.target.closest('[data-act]'); if (!b || !S.root.contains(b)) return;
    var act = b.getAttribute('data-act'), v = b.getAttribute('data-v');
    e.preventDefault(); e.stopPropagation();

    if (act === 'tab') { S.tab = v; S.detail = null; S.sheet = null; render(); return; }
    if (act === 'back') { S.detail = null; render(); return; }
    if (act === 'filter') { S.filter = v; render(); return; }
    if (act === 'sit') { S.tab = 'sit'; S.detail = parseInt(v, 10); render(); return; }
    if (act === 'clearq') { S.q = ''; render(); return; }
    if (act === 'ws-next') { S.ws = (S.ws + 1) % Math.max(1, read(K.workSites).length); render(); return; }
    if (act === 'kind') { S.kind = v; render(); return; }
    if (act === 'close-sheet') { S.sheet = null; render(); return; }
    if (act === 'new-in' || act === 'new-out') {
      S.tab = 'cash'; S.detail = null; S.kind = act === 'new-in' ? 'in' : 'out';
      S.sheet = 'entry'; S._focusAmt = true; render(); S._focusAmt = false; return;
    }
    if (act === 'sit' + '') return;

    if (act === 'save-entry') {
      var amount = parseFloat(String((document.getElementById('ai-amt') || {}).value || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
      if (!amount) { toast('Saisissez un montant'); return; }
      var desc = ((document.getElementById('ai-desc') || {}).value || '').trim();
      var party = ((document.getElementById('ai-party') || {}).value || '').trim();
      var tx = read(K.transactions);
      tx.push({
        id: Date.now(), journal: 'caisse', type: S.kind, amount: amount,
        desc: desc || (S.kind === 'in' ? 'Encaissement' : 'Dépense'),
        date: new Date().toISOString().slice(0, 10),
        client: S.kind === 'in' ? (party || null) : null,
        fournisseur: S.kind === 'out' ? (party || null) : null,
        projectIdx: null, cheque: null, source: 'mobile'
      });
      write(K.transactions, tx);
      S.sheet = null; toast('Écriture enregistrée'); return;
    }

    if (act === 'pay-full' || act === 'save-pay') {
      var all = read(K.situations); var s = all[S.detail]; if (!s) return;
      var amt;
      if (act === 'pay-full') amt = remain(s);
      else {
        amt = parseFloat(String((document.getElementById('ai-pay') || {}).value || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
        if (!amt) { toast('Saisissez un montant'); return; }
        amt = Math.min(amt, remain(s));
      }
      s.payments = s.payments || [];
      s.payments.push({ amount: amt, date: new Date().toISOString().slice(0, 10), source: 'mobile' });
      write(K.situations, all);
      S.sheet = null; toast('Paiement de ' + fmt(amt) + ' DA enregistré'); return;
    }
    if (act === 'pay-part') { S.sheet = 'pay'; S._focusAmt = true; render(); S._focusAmt = false; return; }

    if (act === 'att') {
      var name = b.getAttribute('data-w'), st = v;
      var sites = read(K.workSites); var ws = sites[S.ws]; if (!ws) return;
      ws.pointage = ws.pointage || [];
      var today = new Date().toISOString().slice(0, 10);
      var idx = -1;
      ws.pointage.forEach(function (p, i) { if (p.date === today && p.worker === name) idx = i; });
      if (idx > -1) {
        if (ws.pointage[idx].status === st) ws.pointage.splice(idx, 1);
        else ws.pointage[idx].status = st;
      } else ws.pointage.push({ date: today, worker: name, status: st, source: 'mobile' });
      write(K.workSites, sites);
      render(); return;
    }
    if (act === 'save-ptg') { toast('Pointage enregistré'); return; }

    if (act === 'desk' || act === 'desktop-view') {
      window.ARCIS_MOBILE = false; boot();
      if (act === 'desk' && window.app && window.app.switchPanel) { try { window.app.switchPanel(v); } catch (err) {} }
      return;
    }
    if (act === 'logout') {
      if (window.__logout) window.__logout();
      else { sessionStorage.clear(); location.reload(); }
      return;
    }
  }

  /* ── styles ───────────────────────────────────────────── */
  var CSS = [
  '#arcis-ios{position:fixed;inset:0;z-index:9000;background:#F2F2F7;color:#000;display:flex;flex-direction:column;',
    'font:400 17px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",system-ui,sans-serif;',
    '-webkit-font-smoothing:antialiased;letter-spacing:-.024em;}',
  'html.arcis-ios-on body{overflow:hidden!important;}',
  'html.arcis-ios-on .app-shell,html.arcis-ios-on .mobile-nav,html.arcis-ios-on .mobile-header,',
  'html.arcis-ios-on .sidebar,html.arcis-ios-on .sidebar-backdrop{display:none!important;}',
  '#arcis-ios *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}',
  '#arcis-ios button{font:inherit;color:inherit;background:none;border:none;cursor:pointer;}',
  '#arcis-ios input{font:inherit;color:#000;background:none;border:none;outline:none;-webkit-appearance:none;appearance:none;}',
  '#arcis-ios h1{margin:1px 0 0;font-size:34px;font-weight:700;letter-spacing:-.037em;line-height:41px;}',
  '#arcis-ios h2{margin:0;font-size:28px;font-weight:700;letter-spacing:-.035em;line-height:34px;}',
  '.ai-large{flex:none;padding:calc(env(safe-area-inset-top) + 10px) 16px 8px;}',
  '.ai-kick{font-size:13px;color:#8E8E93;letter-spacing:-.005em;text-transform:capitalize;}',
  '.ai-lrow{display:flex;align-items:flex-end;gap:12px;}',
  '.ai-add{margin-left:auto;margin-bottom:4px;width:44px;height:44px;flex:none;border-radius:22px;background:#ec3013;',
    'display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(236,48,19,.4);}',
  '.ai-nav.back{flex:none;height:calc(env(safe-area-inset-top) + 44px);padding-top:env(safe-area-inset-top);',
    'display:flex;align-items:center;padding-left:8px;background:rgba(249,249,249,.94);',
    '-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border-bottom:.33px solid rgba(60,60,67,.29);position:relative;}',
  '.ai-nav.back b{position:absolute;left:50%;transform:translateX(-50%);font-size:17px;font-weight:600;}',
  '.ai-lk{display:flex;align-items:center;gap:4px;height:44px;padding:0 6px;color:#ec3013;font-size:17px;}',
  '.ai-lk.strong{font-weight:600;}',
  '.ai-scroll{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 16px 26px;}',
  '.ai-scroll::-webkit-scrollbar{display:none;}',
  '.ai-scroll.with-bar{padding-bottom:10px;}',
  '.ai-sticky{position:sticky;top:0;z-index:3;background:#F2F2F7;padding:0 0 10px;}',
  '.ai-search{height:36px;border-radius:10px;background:rgba(118,118,128,.12);display:flex;align-items:center;gap:6px;padding:0 8px;}',
  '.ai-search input{flex:1;min-width:0;height:34px;font-size:17px;}',
  '.ai-clear{width:28px;height:34px;color:#8E8E93;font-size:15px;}',
  '.ai-seg{display:flex;background:rgba(118,118,128,.12);border-radius:9px;padding:2px;margin-top:10px;}',
  '.ai-seg.tight{margin-top:10px;}',
  '.ai-seg-o{flex:1;min-height:30px;border-radius:7px;font-size:13px;color:rgba(60,60,67,.75);letter-spacing:-.01em;}',
  '.ai-seg.tight .ai-seg-o{min-height:34px;font-size:14px;}',
  '.ai-seg-o.on{background:#fff;color:#000;font-weight:600;box-shadow:0 3px 8px rgba(0,0,0,.12),0 3px 1px rgba(0,0,0,.04);}',
  '.ai-seg-o.on.red{background:#ec3013;color:#fff;}',
  '.ai-hero{border-radius:14px;background:#ec3013;color:#fff;padding:16px 18px 18px;box-shadow:0 6px 20px rgba(236,48,19,.28);margin-top:2px;}',
  '.ai-hero.small{padding:14px 18px 16px;margin-top:0;}',
  '.ai-hero-l{font-size:13px;font-weight:500;color:rgba(255,255,255,.85);}',
  '.ai-hero-v{font-size:40px;font-weight:700;letter-spacing:-.04em;line-height:46px;font-variant-numeric:tabular-nums;margin-top:2px;}',
  '.ai-hero.small .ai-hero-v{font-size:36px;line-height:42px;}',
  '.ai-hero-s{font-size:15px;font-weight:500;color:rgba(255,255,255,.9);letter-spacing:-.01em;}',
  '.ai-hero-row{display:flex;gap:10px;margin-top:16px;}',
  '.ai-hero-c{flex:1;border-radius:10px;background:rgba(255,255,255,.18);padding:10px 12px;}',
  '.ai-hero-c span{display:block;font-size:12px;color:rgba(255,255,255,.85);}',
  '.ai-hero-c b{display:block;font-size:17px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;}',
  '.ai-duo,.ai-trio{display:flex;gap:11px;margin-top:16px;}',
  '.ai-trio{margin-top:11px;}',
  '.ai-tile{flex:1;border-radius:14px;background:#fff;padding:13px 14px;}',
  '.ai-tile span{display:block;font-size:13px;color:#8E8E93;}',
  '.ai-tile b{display:block;font-size:24px;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums;}',
  '.ai-tile i{display:block;font-size:13px;font-weight:600;font-style:normal;color:#8E8E93;letter-spacing:-.01em;}',
  '.ai-quick{flex:1;border-radius:14px;background:#fff;padding:13px 12px 12px;min-height:86px;display:flex;flex-direction:column;',
    'align-items:flex-start;gap:9px;font-size:14px;font-weight:600;letter-spacing:-.015em;text-align:left;}',
  '.ai-qi{width:30px;height:30px;border-radius:15px;background:rgba(60,60,67,.1);display:flex;align-items:center;justify-content:center;}',
  '.ai-qi.red{background:rgba(236,48,19,.12);}',
  '.ai-ghead{display:flex;align-items:baseline;padding:20px 16px 6px;font-size:13px;color:#6D6D72;text-transform:uppercase;letter-spacing:.04em;}',
  '.ai-ghead-x{margin-left:auto;text-transform:none;letter-spacing:-.02em;color:#000;}',
  '.ai-list{border-radius:10px;overflow:hidden;background:#fff;}',
  '.ai-list.plain{border-radius:10px;overflow:hidden;background:#fff;}',
  '.ai-cell{display:flex;align-items:center;width:100%;padding:0 16px 0 0;min-height:60px;text-align:left;}',
  '.ai-cell.tall{min-height:74px;}',
  '.ai-cell.center{justify-content:center;padding:0;min-height:46px;}',
  '.ai-cell.red{color:#ec3013;}',
  '.ai-cell-b{flex:1;min-width:0;display:flex;align-items:center;gap:10px;margin-left:16px;padding:11px 0;}',
  '.ai-cell .ai-dot+.ai-cell-b{margin-left:0;}',
  '.ai-cb-main{flex:1;min-width:0;}',
  '.ai-dot{width:10px;height:10px;margin:0 12px 0 16px;flex:none;border-radius:5px;}',
  '.ai-chip{width:32px;height:32px;margin-left:16px;flex:none;border-radius:16px;background:rgba(60,60,67,.1);',
    'color:#3C3C43;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;}',
  '.ai-chip.red{background:rgba(236,48,19,.12);color:#ec3013;}',
  '.ai-t{display:block;font-size:17px;letter-spacing:-.024em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.ai-t.b{font-weight:600;}',
  '.ai-t.big{font-size:20px;font-weight:600;letter-spacing:-.028em;}',
  '.ai-s{display:block;font-size:14px;color:#8E8E93;letter-spacing:-.01em;margin-top:1px;',
    'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.ai-s.r{margin:0 0 0 auto;color:#ec3013;font-size:15px;flex:none;}',
  '.ai-num{flex:none;font-size:17px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.024em;}',
  '.ai-num.red{color:#ec3013;}',
  '.ai-amt{flex:none;text-align:right;}',
  '.ai-amt b{display:block;font-size:17px;font-weight:600;font-variant-numeric:tabular-nums;}',
  '.ai-amt i{display:block;font-size:13px;font-style:normal;color:#8E8E93;}',
  '.ai-tag{display:inline-block;margin-top:6px;padding:2px 8px;border-radius:9px;font-size:12px;font-weight:600;letter-spacing:-.005em;}',
  '.ai-tag.r{background:#ec3013;color:#fff;}',
  '.ai-tag.t{background:rgba(236,48,19,.14);color:#a81f0c;}',
  '.ai-tag.n{background:rgba(60,60,67,.1);color:#3C3C43;}',
  '.ai-chev{flex:none;}',
  '.ai-row{display:flex;align-items:center;min-height:44px;padding:0 16px;border-bottom:.33px solid rgba(60,60,67,.29);}',
  '.ai-row[data-last]{border-bottom:none;}',
  '.ai-row span{color:#000;}',
  '.ai-row b{margin-left:auto;font-weight:600;font-variant-numeric:tabular-nums;}',
  '.ai-empty{padding:22px 16px;font-size:17px;color:#8E8E93;}',
  '.ai-foot{padding:8px 16px 0;font-size:13px;color:#8E8E93;}',
  '.ai-dhead{padding:16px 16px 14px;}',
  '.ai-dhead p{margin:2px 0 0;font-size:15px;color:#8E8E93;letter-spacing:-.01em;}',
  '.ai-push{animation:aiPush .3s cubic-bezier(.32,.72,0,1);}',
  '@keyframes aiPush{from{transform:translateX(26%)}to{transform:none}}',
  '.ai-acts{display:flex;flex-direction:column;gap:10px;margin-top:20px;}',
  '.ai-btn{width:100%;min-height:50px;border-radius:14px;background:#ec3013;color:#fff;font-size:17px;font-weight:600;}',
  '.ai-btn.ghost{background:#fff;color:#ec3013;}',
  '.ai-mini{min-height:32px;padding:0 12px;border-radius:16px;background:rgba(118,118,128,.12);font-size:14px;font-weight:600;color:#ec3013;}',
  '.ai-wsbar{display:flex;align-items:center;gap:12px;padding:2px 4px 0;}',
  '.ai-wsl{min-width:0;}.ai-wsl span,.ai-wsr span{display:block;font-size:13px;color:#8E8E93;}',
  '.ai-wsl b{display:block;font-size:17px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.ai-wsr{margin-left:auto;flex:none;text-align:right;}',
  '.ai-wsr b{font-size:20px;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums;}',
  '.ai-wcell{padding:11px 16px 13px;}',
  '.ai-wtop{display:flex;align-items:center;gap:11px;}',
  '.ai-av{width:38px;height:38px;flex:none;border-radius:19px;background:#E5E5EA;color:#3C3C43;',
    'font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;}',
  '.ai-av.big{width:56px;height:56px;border-radius:28px;font-size:20px;}',
  '.ai-prof{display:flex;align-items:center;gap:13px;padding:14px 16px;}',
  '.ai-bar{flex:none;padding:8px 16px 10px;background:rgba(249,249,249,.94);-webkit-backdrop-filter:blur(20px);',
    'backdrop-filter:blur(20px);border-top:.33px solid rgba(60,60,67,.29);}',
  '.ai-tabs{flex:none;display:grid;grid-template-columns:repeat(5,1fr);padding:6px 0 calc(env(safe-area-inset-bottom) + 6px);',
    'background:rgba(249,249,249,.94);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);',
    'border-top:.33px solid rgba(60,60,67,.29);}',
  '.ai-tab{position:relative;min-height:49px;display:flex;flex-direction:column;align-items:center;gap:3px;color:#8E8E93;}',
  '.ai-tab span{font-size:10px;font-weight:500;letter-spacing:.005em;}',
  '.ai-tab.on{color:#ec3013;}',
  '.ai-badge{position:absolute;top:-2px;right:18px;min-width:18px;height:18px;border-radius:9px;background:#ec3013;',
    'color:#fff;font-size:11px;font-weight:600;font-style:normal;display:flex;align-items:center;justify-content:center;padding:0 5px;}',
  '.ai-scrim{position:absolute;inset:0;z-index:20;background:rgba(0,0,0,.4);animation:aiFade .25s ease;}',
  '@keyframes aiFade{from{opacity:0}to{opacity:1}}',
  '.ai-sheet{position:absolute;left:0;right:0;bottom:0;z-index:21;background:#F2F2F7;border-radius:12px 12px 0 0;',
    'padding-bottom:calc(env(safe-area-inset-bottom) + 20px);animation:aiUp .38s cubic-bezier(.32,.72,0,1);max-height:92%;overflow-y:auto;}',
  '@keyframes aiUp{from{transform:translateY(100%)}to{transform:none}}',
  '.ai-sheet-h{display:flex;align-items:center;height:52px;padding:6px 12px 0;}',
  '.ai-sheet-h b{margin:0 auto;font-size:17px;font-weight:600;}',
  '.ai-sheet-b{padding:0 16px;}',
  '.ai-frow{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 16px;border-bottom:.33px solid rgba(60,60,67,.29);}',
  '.ai-frow[data-last]{border-bottom:none;}',
  '.ai-frow.big{min-height:56px;}',
  '.ai-frow>span{flex:none;width:86px;color:#8E8E93;}',
  '.ai-frow input{flex:1;min-width:0;height:44px;}',
  '.ai-frow.big input{text-align:right;font-size:28px;font-weight:600;letter-spacing:-.03em;font-variant-numeric:tabular-nums;}',
  '.ai-frow i{flex:none;font-style:normal;font-size:15px;color:#8E8E93;}',
  '.ai-toast{position:absolute;top:calc(env(safe-area-inset-top) + 14px);left:50%;transform:translateX(-50%);z-index:30;',
    'max-width:88%;background:rgba(0,0,0,.92);color:#fff;border-radius:22px;padding:10px 18px 10px 13px;',
    'display:flex;align-items:center;gap:9px;font-size:15px;font-weight:600;letter-spacing:-.015em;',
    'box-shadow:0 10px 30px rgba(0,0,0,.3);animation:aiToast .28s cubic-bezier(.32,.72,0,1);}',
  '.ai-tk{width:20px;height:20px;flex:none;border-radius:10px;background:#ec3013;color:#fff;',
    'display:flex;align-items:center;justify-content:center;font-size:12px;}',
  '@keyframes aiToast{from{opacity:0;transform:translate(-50%,-8px) scale(.94)}to{opacity:1;transform:translate(-50%,0) scale(1)}}'
  ].join('');

  /* ── boot ─────────────────────────────────────────────── */
  function on() {
    if (window.ARCIS_MOBILE === false) return false;
    if (window.ARCIS_MOBILE === true) return true;
    return MQ.matches;
  }
  function loggedIn() {
    var ov = document.getElementById('login-overlay');
    if (!ov) return true;
    return getComputedStyle(ov).display === 'none';
  }
  function style() {
    if (document.getElementById('arcis-ios-css')) return;
    var s = document.createElement('style');
    s.id = 'arcis-ios-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }
  function mount() {
    style();
    if (!S.root) {
      S.root = document.createElement('div');
      S.root.id = 'arcis-ios';
      document.body.appendChild(S.root);
      S.root.addEventListener('click', onClick);
    }
    document.documentElement.classList.add('arcis-ios-on');
    render();
  }
  function unmount() {
    document.documentElement.classList.remove('arcis-ios-on');
    if (S.root) { S.root.remove(); S.root = null; }
  }
  function boot() {
    if (on() && loggedIn()) mount(); else unmount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  MQ.addEventListener ? MQ.addEventListener('change', boot) : MQ.addListener(boot);
  // pick the app up as soon as login succeeds
  var tries = 0;
  var poll = setInterval(function () {
    if (++tries > 600) return clearInterval(poll);
    var want = on() && loggedIn();
    if (want !== !!S.root) boot();
  }, 500);
  window.ARCIS_MOBILE_REFRESH = boot;
  window.ARCIS_IOS = { render: render, state: S, boot: boot };
})();

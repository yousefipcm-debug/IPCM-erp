/* IPCM ERP — Sync Layer
   Intercepts localStorage, handles login, enforces role-based access.
   Loaded before the main app script. */
(function () {
  'use strict';

  const TOKEN_KEY   = 'ipcm_token';
  const ROLE_KEY    = 'ipcm_role';
  const DNAME_KEY   = 'ipcm_dname';

  // Map between full localStorage keys and short server keys
  const LS_TO_SHORT = {
    'ipcm_v2_transactions':     'transactions',
    'ipcm_v2_situations':       'situations',
    'ipcm_v2_charges':          'charges',
    'ipcm_v2_fournisseurs':     'fournisseurs',
    'ipcm_v2_clientNames':      'clientNames',
    'ipcm_v2_fournisseurNames': 'fournisseurNames',
    'ipcm_v2_projects':         'projects',
    'ipcm_v2_simPicks':         'simPicks',
    'ipcm_v2_simCustomAmounts': 'simCustomAmounts',
    'ipcm_v2_invoices':         'invoices',
    'ipcm_v2_ribList':          'ribList',
    'ipcm_v2_clientDetails':    'clientDetails',
    'ipcm_v2_workers':          'workers',
    'ipcm_v2_workSites':        'workSites',
    'ipcm_v2_hrDocuments':      'hrDocuments',
    'ipcm_v2_hrFolders':        'hrFolders',
    'ipcm_v2_techWorkSites':    'techWorkSites',
    'ipcm_v2_adminPointage':    'adminPointage'
  };

  const SHORT_TO_LS = {};
  Object.entries(LS_TO_SHORT).forEach(([ls, s]) => (SHORT_TO_LS[s] = ls));

  // Modules visible per role
  const ROLE_MODULES = {
    admin:     ['module-pilotage', 'module-finance', 'module-rh', 'module-technique', 'module-admin'],
    finance:   ['module-finance'],
    hr:        ['module-rh'],
    technique: ['module-technique']
  };

  const ROLE_LABELS = {
    admin: 'Administrateur', finance: 'DFC', hr: 'Ressources Humaines', technique: 'Technique'
  };

  // ── localStorage intercept ──────────────────────────────────────────────────
  // Wrap setItem so every save also goes to the server (fire-and-forget)
  const _origSet = localStorage.setItem.bind(localStorage);
  const _origGet = localStorage.getItem.bind(localStorage);
  const _origRemove = localStorage.removeItem.bind(localStorage);

  localStorage.setItem = function (key, value) {
    _origSet(key, value);
    const shortKey = LS_TO_SHORT[key];
    if (!shortKey) return;
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    let parsed;
    try { parsed = JSON.parse(value); } catch { return; }
    fetch('/api/data/' + shortKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ value: parsed })
    }).catch(() => {});
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function getToken()   { return sessionStorage.getItem(TOKEN_KEY); }
  function getRole()    { return sessionStorage.getItem(ROLE_KEY); }

  function applyRoleUI(role, displayName) {
    const allowed = ROLE_MODULES[role] || [];
    ['module-pilotage', 'module-finance', 'module-rh', 'module-technique', 'module-admin'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = allowed.includes(id) ? '' : 'none';
    });

    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    if (nameEl) nameEl.textContent = displayName || '';
    if (roleEl) roleEl.textContent = ROLE_LABELS[role] || role;
  }

  function populateLocalStorage(serverData) {
    // Write server data into localStorage (using original setItem, no sync-back)
    Object.entries(serverData).forEach(([shortKey, value]) => {
      const lsKey = SHORT_TO_LS[shortKey];
      if (lsKey && value !== null && value !== undefined) {
        _origSet(lsKey, JSON.stringify(value));
      }
    });
  }

  // Default empty values per key (arrays vs objects)
  const KEY_DEFAULTS = {
    'ipcm_v2_transactions': '[]', 'ipcm_v2_situations': '[]',
    'ipcm_v2_charges': '[]', 'ipcm_v2_fournisseurs': '[]',
    'ipcm_v2_clientNames': '[]', 'ipcm_v2_fournisseurNames': '[]',
    'ipcm_v2_projects': '[]', 'ipcm_v2_simPicks': '{}',
    'ipcm_v2_simCustomAmounts': '{}', 'ipcm_v2_invoices': '[]',
    'ipcm_v2_ribList': '[]', 'ipcm_v2_clientDetails': '{}',
    'ipcm_v2_workers': '[]', 'ipcm_v2_workSites': '[]',
    'ipcm_v2_hrDocuments': '[]', 'ipcm_v2_hrFolders': '[]',
    'ipcm_v2_techWorkSites': '[]', 'ipcm_v2_adminPointage': '{}'
  };

  function clearAppLocalStorage() {
    Object.keys(LS_TO_SHORT).forEach(k => _origSet(k, KEY_DEFAULTS[k] || '[]'));
  }

  function reloadApp() {
    if (window.app && typeof window.app.loadAll === 'function') {
      window.app.loadAll();
    }
  }

  function navigateToRole(role) {
    if (!window.app) return;
    if (role === 'finance') {
      window.app.switchModule && window.app.switchModule('finance');
    } else if (role === 'hr') {
      window.app.switchModule && window.app.switchModule('rh');
    } else if (role === 'technique') {
      window.app.switchModule && window.app.switchModule('technique');
    }
    // admin stays on overview
  }

  // ── Login ───────────────────────────────────────────────────────────────────

  async function doLogin(username, password) {
    const btn    = document.getElementById('login-btn');
    const errEl  = document.getElementById('login-error');
    btn.disabled = true;
    btn.textContent = 'Connexion en cours…';
    errEl.textContent = '';

    try {
      const r1 = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password })
      });
      const session = await r1.json();
      if (!r1.ok) throw new Error(session.error || 'Erreur de connexion');

      sessionStorage.setItem(TOKEN_KEY, session.token);
      sessionStorage.setItem(ROLE_KEY,  session.role);
      sessionStorage.setItem(DNAME_KEY, session.display_name);

      const r2 = await fetch('/api/data', {
        headers: { 'Authorization': 'Bearer ' + session.token }
      });
      const serverData = await r2.json();

      clearAppLocalStorage();
      populateLocalStorage(serverData);
      applyRoleUI(session.role, session.display_name);
      reloadApp();
      navigateToRole(session.role);

      document.getElementById('login-overlay').style.display = 'none';

      if (session.role === 'admin') loadUsersPanel();

    } catch (e) {
      errEl.textContent = e.message;
      btn.disabled = false;
      btn.textContent = 'Se connecter';
    }
  }

  // ── Logout ──────────────────────────────────────────────────────────────────

  function doLogout() {
    sessionStorage.clear();
    clearAppLocalStorage();
    window.location.reload();
  }

  // ── Admin: Users panel ──────────────────────────────────────────────────────

  async function loadUsersPanel() {
    const el = document.getElementById('admin-users-content');
    if (!el) return;
    const token = getToken();
    if (!token) return;
    try {
      const r = await fetch('/api/users', { headers: { 'Authorization': 'Bearer ' + token } });
      const users = await r.json();
      el.innerHTML = buildUsersTable(users);
    } catch {
      el.innerHTML = '<p style="color:#dc2626;padding:16px;">Impossible de charger les utilisateurs.</p>';
    }
  }

  function buildUsersTable(users) {
    const rows = users.map(u => `
      <tr>
        <td style="padding:9px 12px;font-weight:500;">${esc(u.username)}</td>
        <td style="padding:9px 12px;">${esc(u.display_name)}</td>
        <td style="padding:9px 12px;">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;
            background:${u.role==='admin'?'#fef2f2':'#f3f3f3'};
            color:${u.role==='admin'?'#dc2626':'#525252'};">
            ${ROLE_LABELS[u.role]||u.role}
          </span>
        </td>
        <td style="padding:9px 12px;color:#999;font-size:12px;">${(u.created_at||'').slice(0,10)}</td>
        <td style="padding:9px 12px;text-align:right;">
          <button onclick="window.__syncEditUser(${u.id},'${esc(u.username)}','${esc(u.display_name)}','${u.role}')"
            style="font-size:11px;padding:3px 10px;border:1px solid #e2e2e2;border-radius:5px;background:#fff;cursor:pointer;margin-right:6px;">
            Modifier
          </button>
          <button onclick="window.__syncDeleteUser(${u.id},'${esc(u.username)}')"
            style="font-size:11px;padding:3px 10px;border:1px solid #fecaca;border-radius:5px;background:#fef2f2;color:#dc2626;cursor:pointer;">
            Supprimer
          </button>
        </td>
      </tr>`).join('');

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <span style="font-size:13px;color:#525252;">${users.length} utilisateur${users.length!==1?'s':''}</span>
        <button onclick="window.__syncAddUser()"
          style="height:28px;padding:0 14px;background:#171717;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">
          + Ajouter un utilisateur
        </button>
      </div>
      <div style="border:1px solid #ededed;border-radius:8px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f8f8f8;">
              <th style="padding:9px 12px;text-align:left;font-weight:600;border-bottom:1px solid #ededed;">Login</th>
              <th style="padding:9px 12px;text-align:left;font-weight:600;border-bottom:1px solid #ededed;">Nom</th>
              <th style="padding:9px 12px;text-align:left;font-weight:600;border-bottom:1px solid #ededed;">Rôle</th>
              <th style="padding:9px 12px;text-align:left;font-weight:600;border-bottom:1px solid #ededed;">Créé le</th>
              <th style="border-bottom:1px solid #ededed;"></th>
            </tr>
          </thead>
          <tbody style="divide-y:#f3f3f3;">${rows}</tbody>
        </table>
      </div>`;
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  window.__syncAddUser = async function () {
    const username     = prompt('Login (nom d\'utilisateur):');
    if (!username) return;
    const display_name = prompt('Nom complet affiché:');
    if (!display_name) return;
    const role = prompt('Rôle:\n  admin\n  finance\n  hr\n  technique');
    if (!['admin','finance','hr','technique'].includes(role)) { alert('Rôle invalide.'); return; }
    const password = prompt('Mot de passe (min 6 caractères):');
    if (!password || password.length < 6) { alert('Mot de passe trop court.'); return; }

    try {
      const r = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password, role, display_name })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      loadUsersPanel();
    } catch (e) { alert('Erreur : ' + e.message); }
  };

  window.__syncEditUser = async function (id, username, displayName, currentRole) {
    const newName = prompt('Nom complet:', displayName);
    const newRole = prompt('Rôle (admin / finance / hr / technique):', currentRole);
    const newPwd  = prompt('Nouveau mot de passe (laisser vide pour ne pas changer):');

    const body = {};
    if (newName && newName !== displayName) body.display_name = newName;
    if (newRole && ['admin','finance','hr','technique'].includes(newRole)) body.role = newRole;
    if (newPwd) {
      if (newPwd.length < 6) { alert('Mot de passe trop court.'); return; }
      body.password = newPwd;
    }
    if (!Object.keys(body).length) return;

    try {
      const r = await fetch('/api/users/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      loadUsersPanel();
    } catch (e) { alert('Erreur : ' + e.message); }
  };

  window.__syncDeleteUser = async function (id, username) {
    if (!confirm(`Supprimer l'utilisateur "${username}" ?\nCette action est irréversible.`)) return;
    try {
      const r = await fetch('/api/users/' + id, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + getToken() }
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      loadUsersPanel();
    } catch (e) { alert('Erreur : ' + e.message); }
  };

  // ── Boot ────────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    // Wire login form
    const form = document.getElementById('login-form');
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const u = document.getElementById('login-username').value;
        const p = document.getElementById('login-password').value;
        if (u && p) doLogin(u, p);
      });
    }

    // Wire logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

    // Wire admin users nav
    const adminUsersBtn = document.querySelectorAll('[data-panel="admin-users"]');
    adminUsersBtn.forEach(btn => btn.addEventListener('click', () => {
      loadUsersPanel();
    }));

    // Check existing session
    const token = getToken();
    const role  = getRole();
    const dname = sessionStorage.getItem(DNAME_KEY);

    if (token && role) {
      fetch('/api/data', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => {
          if (!r.ok) throw new Error('expired');
          return r.json();
        })
        .then(serverData => {
          clearAppLocalStorage();
          populateLocalStorage(serverData);
          applyRoleUI(role, dname);
          reloadApp();
          navigateToRole(role);
          document.getElementById('login-overlay').style.display = 'none';
          if (role === 'admin') loadUsersPanel();
        })
        .catch(() => {
          sessionStorage.clear();
          // login overlay remains visible
        });
    }
    // No token → overlay stays visible, user must log in
  });

})();

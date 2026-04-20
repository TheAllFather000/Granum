/**
 * granum-auth.js
 * Shared authentication module loaded on every page.
 *
 * Responsibilities:
 *  - Store / retrieve tokens from localStorage
 *  - Expose granumAuth.user for any page to read
 *  - Inject a login/avatar button into the nav (replaces cart button area)
 *  - Handle silent token refresh
 *  - Provide granumAuth.logout()
 */

(function () {
  const API = window.GRANUM_API_URL || localStorage.getItem('granum_api_url') || 'https://unhid-untriflingly-georgiann.ngrok-free.dev';

  const KEYS = {
    access:  'granum_access_token',
    refresh: 'granum_refresh_token',
    user:    'granum_user',
  };

  // ── token helpers ─────────────────────────────────────────────
  function getAccessToken()  { return localStorage.getItem(KEYS.access);  }
  function getRefreshToken() { return localStorage.getItem(KEYS.refresh); }
  function getUser()         {
    try { return JSON.parse(localStorage.getItem(KEYS.user) || 'null'); }
    catch { return null; }
  }

  function saveSession(tokens, user) {
    localStorage.setItem(KEYS.access,  tokens.accessToken);
    localStorage.setItem(KEYS.refresh, tokens.refreshToken);
    localStorage.setItem(KEYS.user,    JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(KEYS.access);
    localStorage.removeItem(KEYS.refresh);
    localStorage.removeItem(KEYS.user);
  }

  // ── API fetch wrapper with auto-refresh ───────────────────────
  async function apiFetch(path, options = {}) {
    const token = getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    let res = await fetch(API + path, { ...options, headers });

    // 401 → try to refresh once
    if (res.status === 401 && getRefreshToken()) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        headers.Authorization = `Bearer ${getAccessToken()}`;
        res = await fetch(API + path, { ...options, headers });
      }
    }

    return res;
  }

  async function tryRefresh() {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
      const res = await fetch(`${API}/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) { clearSession(); return false; }
      const data = await res.json();
      localStorage.setItem(KEYS.access,  data.tokens.accessToken);
      localStorage.setItem(KEYS.refresh, data.tokens.refreshToken);
      return true;
    } catch {
      clearSession();
      return false;
    }
  }

  // ── logout ────────────────────────────────────────────────────
  async function logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch { /* best-effort */ }
    clearSession();
    renderNavAuth();
    window.location.href = 'granum-home.html';
  }

  // ── nav auth area ─────────────────────────────────────────────
  function renderNavAuth() {
    const right = document.getElementById('lh-nav')?.querySelector('.lh-right');
    if (!right) return;

    // remove any previous auth widget
    right.querySelectorAll('.lh-auth-btn, .lh-avatar-wrap').forEach(el => el.remove());

    const user = getUser();

    if (user) {
      // logged-in: show avatar + dropdown
      const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || '?';
      const wrap = document.createElement('div');
      wrap.className = 'lh-avatar-wrap';
      wrap.innerHTML = `
        <button class="lh-avatar-btn" onclick="granumAuthMenu()" id="lh-avatar-btn" title="${user.first_name} ${user.last_name}">
          ${user.avatar_url
            ? `<img src="${user.avatar_url}" alt="avatar" />`
            : `<span class="lh-initials">${initials}</span>`}
        </button>
        <div class="lh-user-menu" id="lh-user-menu">
          <div class="lh-menu-user">
            <div class="lh-menu-name">${user.first_name} ${user.last_name}</div>
            <div class="lh-menu-role">${formatRole(user.role)}</div>
          </div>
          <a href="granum-profile.html" class="lh-menu-item">👤 My profile</a>
          <a href="granum-cart.html"    class="lh-menu-item">🛒 My basket</a>
          <a href="#orders"               class="lh-menu-item">📦 My orders</a>
          <div class="lh-menu-divider"></div>
          <button class="lh-menu-item lh-menu-logout" onclick="window.granumAuth.logout()">
            🚪 Sign out
          </button>
        </div>`;
      right.prepend(wrap);
    } else {
      // logged-out: sign in button
      const btn = document.createElement('a');
      btn.className = 'lh-auth-btn';
      btn.href      = 'granum-auth.html';
      btn.textContent = 'Sign in';
      right.prepend(btn);
    }
  }

  function formatRole(role) {
    const map = {
      spaza_owner:  'Spaza shop owner',
      farmer:       'Farmer',
      manufacturer: 'Manufacturer',
      driver:       'Delivery driver',
      admin:        'Admin',
    };
    return map[role] || role;
  }

  // close menu on outside click
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('lh-user-menu');
    if (menu && !e.target.closest('.lh-avatar-wrap')) {
      menu.classList.remove('open');
    }
  });

  window.granumAuthMenu = function () {
    document.getElementById('lh-user-menu')?.classList.toggle('open');
  };

  // ── inject nav auth styles ────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .lh-auth-btn {
      background: transparent;
      color: #4A6B3C;
      border: 1.5px solid rgba(74,107,60,.4);
      border-radius: 9px;
      padding: 7px 16px;
      font-size: 14px; font-weight: 600;
      cursor: pointer; text-decoration: none;
      font-family: 'DM Sans', sans-serif;
      transition: all .18s;
      display: inline-flex; align-items: center;
      white-space: nowrap;
    }
    .lh-auth-btn:hover { background: #4A6B3C; color: white; border-color: #4A6B3C; }

    .lh-avatar-wrap { position: relative; }
    .lh-avatar-btn {
      width: 36px; height: 36px; border-radius: 50%;
      background: #EAF3DE; border: 2px solid #4A6B3C;
      cursor: pointer; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      transition: transform .18s;
      padding: 0;
    }
    .lh-avatar-btn:hover { transform: scale(1.07); }
    .lh-avatar-btn img  { width: 100%; height: 100%; object-fit: cover; }
    .lh-initials { font-size: 13px; font-weight: 700; color: #3A552E; }

    .lh-user-menu {
      position: absolute; top: calc(100% + 10px); right: 0;
      background: white; border: 1px solid rgba(60,55,45,.12);
      border-radius: 14px; min-width: 210px;
      box-shadow: 0 8px 32px rgba(0,0,0,.12);
      overflow: hidden;
      opacity: 0; transform: translateY(6px) scale(.97);
      pointer-events: none;
      transition: opacity .2s, transform .2s;
      z-index: 400;
    }
    .lh-user-menu.open { opacity: 1; transform: none; pointer-events: all; }

    .lh-menu-user { padding: 12px 16px; border-bottom: 1px solid rgba(60,55,45,.08); }
    .lh-menu-name { font-size: 14px; font-weight: 600; color: #2E2C28; }
    .lh-menu-role { font-size: 11px; color: #7A776F; margin-top: 2px; }

    .lh-menu-item {
      display: flex; align-items: center; gap: 9px;
      padding: 11px 16px; font-size: 14px; font-weight: 500;
      color: #2E2C28; text-decoration: none;
      transition: background .15s; cursor: pointer;
      background: none; border: none; width: 100%; text-align: left;
      font-family: 'DM Sans', sans-serif;
    }
    .lh-menu-item:hover { background: #F2EEE7; }
    .lh-menu-divider { height: 1px; background: rgba(60,55,45,.08); margin: 4px 0; }
    .lh-menu-logout { color: #C0392B; }
    .lh-menu-logout:hover { background: #FBEAEA; }
  `;
  document.head.appendChild(style);

  // ── inactivity auto-logout ───────────────────────────────────
  const INACTIVITY_MS = 2 * 60 * 60 * 1000; // 2 hours
  let inactivityTimer = null;
  let lastActivity = Date.now();

  function resetInactivityTimer() {
    lastActivity = Date.now();
    scheduleInactivityCheck();
  }

  function scheduleInactivityCheck() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (!getUser()) return; // not logged in, no need
    
    inactivityTimer = setTimeout(() => {
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= INACTIVITY_MS) {
        console.log('[Auth] Auto-logout: 2 hours of inactivity');
        logout();
      }
    }, INACTIVITY_MS + 1000); // check 1s after the threshold
  }

  function setupInactivityListeners() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(evt => {
      document.addEventListener(evt, resetInactivityTimer, { passive: true });
    });
  }

  // ── public API ────────────────────────────────────────────────
  window.granumAuth = {
    API,
    getUser,
    getAccessToken,
    isLoggedIn: () => !!getUser(),
    saveSession,
    clearSession,
    logout,
    apiFetch,
    resetInactivityTimer,
    setupInactivityListeners,
  };

  // run after nav.js has injected the nav
  function init() {
    renderNavAuth();
    // Setup inactivity timer if user is logged in
    if (getUser()) {
      setupInactivityListeners();
      resetInactivityTimer();
    }
  }

  // nav.js uses defer so both scripts run after DOM is parsed
  // wait one tick to let nav.js finish injecting
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }
})();

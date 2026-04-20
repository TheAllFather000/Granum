/**
 * granum-nav.js
 * Drop this script on every page. It:
 *  1. Injects consistent nav HTML (with mobile hamburger)
 *  2. Marks the active link based on current filename
 *  3. Keeps the cart badge in sync from localStorage
 */

(function () {
const PAGES = [
    { label: 'Home',         href: 'granum-home.html' },
    { label: 'Shop',         href: 'granum-shop.html' },
    { label: 'How It Works', href: 'granum-howitworks.html' },
    { label: 'About',        href: 'granum-about.html' },
    { label: 'Vouchers',     href: 'granum-vouchers.html' },
    { label: 'Rescue',       href: 'rescue.html' },
    { label: 'Orders',      href: 'orders.html' },
    { label: 'Leaderboard',  href: 'granum-leaderboard.html' },
    { label: 'Contact',      href: 'granum-contact.html' },
    { label: 'My Profile',  href: 'granum-profile.html' },
  ];

  const current = window.location.pathname.split('/').pop() || 'granum-home.html';
  // Always open sidebar drawer (not redirect)
  const cartAction = "toggleCartDrawer()";

  const links = PAGES.map(p =>
    `<li><a href="${p.href}" class="${current === p.href ? 'active' : ''}">${p.label}</a></li>`
  ).join('');

  const html = `
<style>
  /* ── shared nav styles ──────────────────────────────────────── */
  #lh-nav {
    position: sticky; top: 0; z-index: 300;
    background: rgba(253,250,246,0.93);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid rgba(60,55,45,0.11);
    padding: 0 5vw;
    display: flex; align-items: center; justify-content: space-between;
    height: 60px;
    font-family: 'DM Sans', sans-serif;
  }
  #lh-nav .lh-logo {
    font-family: 'Playfair Display', serif;
    font-size: 20px; font-weight: 900;
    color: #4A6B3C; text-decoration: none;
    flex-shrink: 0;
  }
  #lh-nav .lh-logo span { color: #8B6946; }

  #lh-nav .lh-links {
    display: flex; gap: 1.6rem; list-style: none;
    margin: 0; padding: 0;
  }
  #lh-nav .lh-links a {
    text-decoration: none; color: #7A776F;
    font-size: 14px; font-weight: 500;
    transition: color .2s; white-space: nowrap;
    position: relative;
  }
  #lh-nav .lh-links a::after {
    content: ''; position: absolute; bottom: -3px; left: 0;
    width: 0; height: 2px; background: #4A6B3C; transition: width .2s;
  }
  #lh-nav .lh-links a:hover,
  #lh-nav .lh-links a.active { color: #4A6B3C; }
  #lh-nav .lh-links a.active::after,
  #lh-nav .lh-links a:hover::after { width: 100%; }

  #lh-nav .lh-right {
    display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  }

  #lh-nav .lh-cart {
    background: #4A6B3C; color: white; border: none; border-radius: 9px;
    padding: 8px 16px; font-size: 14px; font-weight: 500;
    cursor: pointer; display: flex; align-items: center; gap: 7px;
    font-family: 'DM Sans', sans-serif; transition: background .2s;
  }
  #lh-nav .lh-cart:hover { background: #3A552E; }
  #lh-nav .lh-cart-count {
    background: #8B6946; color: white; border-radius: 50%;
    width: 19px; height: 19px; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    transition: transform .2s;
  }
  #lh-nav .lh-cart-count.bump { transform: scale(1.4); }

  /* hamburger */
  #lh-hamburger {
    display: none;
    background: none; border: none; cursor: pointer;
    padding: 6px; border-radius: 8px;
    transition: background .18s;
    flex-direction: column; gap: 5px; align-items: center; justify-content: center;
  }
  #lh-hamburger:hover { background: rgba(60,55,45,.08); }
  #lh-hamburger span {
    display: block; width: 22px; height: 2px;
    background: #2E2C28; border-radius: 2px;
    transition: all .28s ease;
    transform-origin: center;
  }
  #lh-hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  #lh-hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
  #lh-hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  /* mobile menu drawer */
  #lh-mobile-menu {
    position: fixed; top: 60px; left: 0; right: 0;
    background: rgba(253,250,246,0.98);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid rgba(60,55,45,.11);
    z-index: 299;
    padding: 0;
    max-height: 0; overflow: hidden;
    transition: max-height .32s cubic-bezier(.4,0,.2,1), padding .25s;
    font-family: 'DM Sans', sans-serif;
  }
  #lh-mobile-menu.open {
    max-height: 480px;
    padding: 0.5rem 0 1rem;
  }
  #lh-mobile-menu a {
    display: flex; align-items: center; justify-content: space-between;
    padding: 13px 5vw;
    text-decoration: none; color: #2E2C28;
    font-size: 15px; font-weight: 500;
    border-bottom: 1px solid rgba(60,55,45,.07);
    transition: background .15s;
  }
  #lh-mobile-menu a:last-child { border: none; }
  #lh-mobile-menu a:hover { background: rgba(74,107,60,.06); }
  #lh-mobile-menu a.active { color: #4A6B3C; font-weight: 600; }
  #lh-mobile-menu a .arrow { color: rgba(60,55,45,.3); font-size: 14px; }

  /* cart drawer */
  #lh-cart-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:400; opacity:0; pointer-events:none; transition:opacity .3s; }
  #lh-cart-backdrop.show { opacity:1; pointer-events:all; }
  #lh-cart-drawer {
    position:fixed; top:0; right:0; bottom:0; width:100%; max-width:380px;
    background:#fff; z-index:401; box-shadow:-4px 0 24px rgba(0,0,0,.12);
    transform:translateX(100%); transition:transform .32s cubic-bezier(.4,0,.2,1);
    display:flex; flex-direction:column;
  }
  #lh-cart-drawer.open { transform:translateX(0); }
  #lh-cart-drawer-header {
    padding:16px 20px; border-bottom:1px solid var(--border);
    display:flex; justify-content:space-between; align-items:center;
  }
  #lh-cart-drawer-header h3 { font-family:'Playfair Display',serif; font-size:18px; font-weight:700; margin:0; }
  #lh-cart-drawer-header button { background:none; border:none; font-size:24px; cursor:pointer; color:var(--muted); }
  #lh-cart-drawer-content { flex:1; overflow-y:auto; padding:16px 20px; }

  /* mobile backdrop */
  #lh-menu-backdrop {
    position: fixed; inset: 0; top: 60px;
    z-index: 298; display: none;
  }
  #lh-menu-backdrop.open { display: block; }

  @media (max-width: 860px) {
    #lh-nav .lh-links { display: none; }
    #lh-hamburger { display: flex; }
  }
  @media (max-width: 400px) {
    #lh-nav .lh-cart span:not(.lh-cart-count) { display: none; }
  }
  
  /* ── MOBILE RESPONSIVE SHARED STYLES ───────────────────────── */
  @media (max-width: 600px) {
    /* Base mobile adjustments */
    html { font-size: 14px; }
    
    /* Make inputs touch-friendly */
    input, select, textarea { 
      font-size: 16px !important; /* Prevents zoom on iOS */
      padding: 12px 14px !important;
    }
    
    button { 
      min-height: 44px; 
      min-width: 44px;
    }
    
    /* Touch-friendly targets */
    a, button, input, select, textarea {
      -webkit-tap-highlight-color: rgba(74,107,60,0.15);
    }
    
    /* Images responsive */
    img { max-width: 100%; height: auto; }
    
    /* Main container padding */
    .main, main {
      padding: 1rem !important;
    }
    
    /* Stack flex containers */
    .row, .cards-row, .form-row, .btn-row {
      flex-direction: column !important;
      gap: 0.75rem !important;
    }
    
    /* Full-width buttons on mobile */
    .btn, .auth-btn, .submit-btn, button[class*="btn"] {
      width: 100% !important;
      text-align: center !important;
      padding: 14px 20px !important;
      font-size: 15px !important;
    }
    
    /* Grid to single column */
    .grid, .cards-grid, .product-grid {
      grid-template-columns: 1fr !important;
    }
    
    /* Tables scrollable */
    .table-wrap, table {
      display: block;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    
    /* Hide non-essential on mobile */
    .desktop-only, .desktop { display: none !important; }
    .mobile-only { display: block !important; }
    
    /* Reduce margins */
    section, .section { margin: 1rem 0 !important; padding: 1rem !important; }
    
    /* Cards full width */
    .card, .entity-card, .product-card {
      width: 100% !important;
      margin: 0 0 1rem 0 !important;
    }
    
    /* Footer columns stack */
    .footer-main, .footer-cols {
      flex-direction: column !important;
      gap: 1.5rem !important;
    }
  }
  
  /* Extra small screens */
  @media (max-width: 380px) {
    html { font-size: 13px; }
    .main, main { padding: 0.75rem !important; }
  }
  
  /* Landscape mobile */
  @media (max-height: 500px) and (orientation: landscape) {
    .modal, .drawer, .popup {
      max-height: 90vh !important;
      overflow-y: auto !important;
    }
  }
</style>

<nav id="lh-nav">
  <a href="granum-home.html" class="lh-logo">Granum</a>
  <ul class="lh-links">${links}</ul>
  <div class="lh-right">
    <button class="lh-cart" onclick="${cartAction}">
      🛒 <span>Basket</span>
      <span class="lh-cart-count" id="lh-cart-count">0</span>
    </button>
    <button id="lh-hamburger" onclick="toggleMobileMenu()" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<div id="lh-menu-backdrop" onclick="closeMobileMenu()"></div>
<div id="lh-mobile-menu">
  ${PAGES.map(p => `<a href="${p.href}" class="${current === p.href ? 'active' : ''}">${p.label} <span class="arrow">→</span></a>`).join('')}
  <a href="granum-auth.html" id="lh-mobile-auth-link" style="color:#4A6B3C;font-weight:600;border-top:1px solid rgba(60,55,45,.1);margin-top:4px">Sign in <span class="arrow">→</span></a>
</div>

<div id="lh-cart-backdrop" onclick="closeCartDrawer()"></div>
<div id="lh-cart-drawer">
  <div id="lh-cart-drawer-header">
    <h3>Your Basket</h3>
    <button onclick="closeCartDrawer()">✕</button>
  </div>
  <div id="lh-cart-drawer-content"></div>
</div>
`;

  // inject before the first element in body
  document.body.insertAdjacentHTML('afterbegin', html);

  // remove any old nav already in the page (pages have their own)
  document.querySelectorAll('nav:not(#lh-nav)').forEach(n => n.remove());

  // Cart drawer
  window.toggleCartDrawer = function() {
    const drawer = document.getElementById('lh-cart-drawer');
    const backdrop = document.getElementById('lh-cart-backdrop');
    if (drawer) {
      drawer.classList.toggle('open');
      if (drawer.classList.contains('open')) renderCartDrawer();
    }
    if (backdrop) backdrop.classList.toggle('show');
  }

  window.closeCartDrawer = function() {
    const drawer = document.getElementById('lh-cart-drawer');
    const backdrop = document.getElementById('lh-cart-backdrop');
    if (drawer) drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('show');
  }

  function renderCartDrawer() {
    const drawer = document.getElementById('lh-cart-drawer-content');
    if (!drawer) return;
    const cart = JSON.parse(localStorage.getItem('lh_cart') || '[]');
    if (!cart.length) {
      drawer.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem">Your basket is empty.</p>';
      return;
    }
    const subtotal = cart.reduce((s, i) => s + (i.price_cents || i.price * 100 || 0) * i.qty, 0) / 100;
    drawer.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        ${cart.map((i, idx) => `
          <div class="cart-item" data-id="${i.id}" style="display:flex;gap:12px;align-items:center;padding:10px;background:var(--card);border-radius:10px">
            <div style="display:flex;align-items:center;gap:4px">
              <button class="cart-qty-btn" data-action="dec" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:white;cursor:pointer;font-size:16px">−</button>
              <span style="min-width:24px;text-align:center;font-weight:600">${i.qty}</span>
              <button class="cart-qty-btn" data-action="inc" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:white;cursor:pointer;font-size:16px">+</button>
            </div>
            <span style="font-size:24px">${i.emoji || '📦'}</span>
            <div style="flex:1">
              <div style="font-weight:600;font-size:14px">${i.name}</div>
              <div style="font-size:12px;color:var(--muted)">R${((i.price_cents || i.price * 100 || 0) / 100).toFixed(2)} each</div>
            </div>
            <div style="font-weight:600">R${String(((i.price_cents || i.price * 100 || 0) * i.qty / 100).toFixed(2))}</div>
            <button class="cart-remove-btn" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:18px;padding:4px">✕</button>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-weight:700">
        <span>Total</span>
        <span>R${subtotal.toFixed(2)}</span>
      </div>
      <a href="granum-cart.html?checkout=1" class="submit-btn" style="display:block;text-align:center;margin-top:16px;background:var(--green);color:white;padding:14px;border-radius:12px;text-decoration:none;font-weight:600">Checkout</a>
    `;
  }

  // Also attach event listeners after DOM update
  setTimeout(() => {
    const drawer = document.getElementById('lh-cart-drawer-content');
    if (!drawer) return;
    drawer.querySelectorAll('.cart-item').forEach(item => {
      const id = item.dataset.id;
      const decBtn = item.querySelector('.cart-qty-btn[data-action="dec"]');
      const incBtn = item.querySelector('.cart-qty-btn[data-action="inc"]');
      const rmBtn = item.querySelector('.cart-remove-btn');
      if (decBtn) decBtn.onclick = () => window.changeCartQty(id, -1);
      if (incBtn) incBtn.onclick = () => window.changeCartQty(id, 1);
      if (rmBtn) rmBtn.onclick = () => window.removeFromCart(id);
    });
  }, 50);

  // Cart functions - exposed before any render
  window.changeCartQty = function(id, delta) {
    let cart = JSON.parse(localStorage.getItem('lh_cart') || '[]');
    const item = cart.find(i => i.id === id);
    if (!item) {
      console.log('[Cart] Item not found:', id, cart);
      return;
    }
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter(i => i.id !== id);
    }
    localStorage.setItem('lh_cart', JSON.stringify(cart));
    syncBadge();
    renderCartDrawer();
  };

  window.removeFromCart = function(id) {
    let cart = JSON.parse(localStorage.getItem('lh_cart') || '[]');
    const before = cart.length;
    cart = cart.filter(i => i.id !== id);
    console.log('[Cart] Removing:', id, 'Before:', before, 'After:', cart.length);
    localStorage.setItem('lh_cart', JSON.stringify(cart));
    syncBadge();
    renderCartDrawer();
  };

  // cart badge — live from localStorage
  function syncBadge() {
    const cart  = JSON.parse(localStorage.getItem('lh_cart') || '[]');
    const count = cart.reduce((s, i) => s + i.qty, 0);
    const el    = document.getElementById('lh-cart-count');
    if (el) {
      const prev  = parseInt(el.textContent) || 0;
      el.textContent = count;
      if (count > prev) {
        el.classList.add('bump');
        setTimeout(() => el.classList.remove('bump'), 300);
      }
    }
    // Also update legacy ID if it exists (some pages use cart-count instead of lh-cart-count)
    const oldEl = document.getElementById('cart-count');
    if (oldEl) oldEl.textContent = count;
    // Expose globally for other pages to use
    window.updateCartBadge = function() { syncBadge(); };
    window.syncBadge = syncBadge;
    // hide sign-in link in mobile menu if logged in
    const mobileAuthLink = document.getElementById('lh-mobile-auth-link');
    if (mobileAuthLink) {
      const user = localStorage.getItem('lh_user');
      mobileAuthLink.style.display = user ? 'none' : '';
    }
  }
  syncBadge();
  // re-sync whenever storage changes (e.g. product added on profile page)
  window.addEventListener('storage', syncBadge);
  // also poll lightly — catches same-tab updates
  setInterval(syncBadge, 1500);

  // mobile menu
  window.toggleMobileMenu = function () {
    const menu  = document.getElementById('lh-mobile-menu');
    const btn   = document.getElementById('lh-hamburger');
    const back  = document.getElementById('lh-menu-backdrop');
    const open  = menu.classList.toggle('open');
    btn.classList.toggle('open', open);
    back.classList.toggle('open', open);
  };
  window.closeMobileMenu = function () {
    document.getElementById('lh-mobile-menu').classList.remove('open');
    document.getElementById('lh-hamburger').classList.remove('open');
    document.getElementById('lh-menu-backdrop').classList.remove('open');
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') window.closeMobileMenu();
  });

  // expose syncBadge globally so pages can call it after adding to cart
  window.lhSyncBadge = syncBadge;

  // also keep any legacy updateCartBadge calls working
  window.updateCartBadge = syncBadge;
})();

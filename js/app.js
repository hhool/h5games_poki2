/* ============================================================
   Poki2 — App logic
   ============================================================ */

(() => {
  'use strict';

  /* ---------- Category metadata ---------- */
  const TAG_META = {
    action:      { emoji: '💥', label: 'Action' },
    competitive: { emoji: '🏆', label: 'Competitive' },
    idle:        { emoji: '🕹️', label: 'Idle' },
    puzzle:      { emoji: '🧩', label: 'Puzzle' },
    racing:      { emoji: '🏎️', label: 'Racing' },
    shooting:    { emoji: '🔫', label: 'Shooting' },
    sports:      { emoji: '⚽', label: 'Sports' },
    strategy:    { emoji: '♟️', label: 'Strategy' },
    other:       { emoji: '🎲', label: 'Other' },
  };

  /* preferred display order */
  const TAG_ORDER = ['action','puzzle','racing','shooting','sports','competitive','strategy','idle','other'];

  /* how many games to show per section on the home page */
  const SECTION_LIMIT = 12;

  /* ---------- DOM refs ---------- */
  const $sidebar       = document.getElementById('sidebar');
  const $sidebarOverlay= document.getElementById('sidebar-overlay');
  const $menuBtn       = document.getElementById('menu-btn');
  const $sidebarNav    = document.getElementById('sidebar-nav');
  const $gameSections  = document.getElementById('game-sections');
  const $searchInput   = document.getElementById('search');
  const $searchResults = document.getElementById('search-results');
  const $searchGrid    = document.getElementById('search-grid');
  const $searchTitle   = document.getElementById('search-results-title');
  const $hero          = document.getElementById('hero');
  const $overlay       = document.getElementById('game-overlay');
  const $overlayTitle  = document.getElementById('overlay-title');
  const $overlayBack   = document.getElementById('overlay-back');
  const $overlayFs     = document.getElementById('overlay-fs');
  const $iframe        = document.getElementById('game-iframe');
  const $content       = document.getElementById('content');

  /* ---------- State ---------- */
  let allGames = [];
  let tagMap   = {};   // tag -> [game]
  let currentView = 'home';  // 'home' | 'category' | 'search'

  /* ---------- Helpers ---------- */
  function normalizeHref(link) {
    try {
      const u = new URL(link);
      let p = u.pathname.replace(/\/+$/, '');
      if (!p) p = u.hostname.split('.')[0];
      return p.split('/').pop() || link;
    } catch { return link; }
  }

  /* ---------- Data ---------- */
  async function loadGames() {
    try {
      const r = await fetch('../h5games_web/poki2.online/games.json');
      if (!r.ok) throw new Error(r.status);
      allGames = await r.json();
    } catch {
      /* fallback: try relative */
      try {
        const r2 = await fetch('games.json');
        if (!r2.ok) throw new Error(r2.status);
        allGames = await r2.json();
      } catch { allGames = []; }
    }

    /* build tag map */
    tagMap = {};
    for (const g of allGames) {
      for (const t of (g.tags || ['other'])) {
        (tagMap[t] = tagMap[t] || []).push(g);
      }
    }
  }

  /* ---------- Render helpers ---------- */
  function createCard(game) {
    const el = document.createElement('div');
    el.className = 'game-card';
    el.innerHTML = `
      <img class="game-card-img" src="${game.imgSrc}" alt="${game.title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22><rect fill=%22%23334%22 width=%221%22 height=%221%22/></svg>'">
      <div class="game-card-info">
        <div class="game-card-title">${game.title}</div>
      </div>`;
    el.addEventListener('click', () => openGame(game));
    return el;
  }

  function renderSection(tag, limit) {
    const meta = TAG_META[tag] || { emoji: '🎲', label: tag };
    const games = tagMap[tag] || [];
    if (games.length === 0) return null;

    const section = document.createElement('section');
    section.className = 'category-section';
    section.id = 'section-' + tag;

    const showAll = limit && games.length > limit;
    section.innerHTML = `
      <div class="section-header">
        <h2 class="section-title"><span class="emoji">${meta.emoji}</span> ${meta.label}</h2>
        ${showAll ? `<button class="see-all" data-tag="${tag}">See all (${games.length})</button>` : ''}
      </div>`;

    const grid = document.createElement('div');
    grid.className = 'game-grid';
    const list = limit ? games.slice(0, limit) : games;
    for (const g of list) grid.appendChild(createCard(g));
    section.appendChild(grid);

    /* see all click */
    const btn = section.querySelector('.see-all');
    if (btn) btn.addEventListener('click', () => showCategory(tag));

    return section;
  }

  /* ---------- Views ---------- */
  function showHome() {
    currentView = 'home';
    $hero.style.display = '';
    $searchResults.style.display = 'none';
    $gameSections.innerHTML = '';
    $gameSections.style.display = '';
    for (const tag of TAG_ORDER) {
      const sec = renderSection(tag, SECTION_LIMIT);
      if (sec) $gameSections.appendChild(sec);
    }
    highlightSidebarItem(null);
    $searchInput.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.replaceState({ view: 'home' }, '', '/');
  }

  function showCategory(tag) {
    currentView = 'category';
    const meta = TAG_META[tag] || { emoji: '🎲', label: tag };
    $hero.style.display = 'none';
    $searchResults.style.display = 'none';
    $gameSections.innerHTML = '';
    $gameSections.style.display = '';
    const sec = renderSection(tag, 0 /* all */);
    if (sec) $gameSections.appendChild(sec);
    highlightSidebarItem(tag);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.pushState({ view: 'category', tag }, '', '#' + tag);
  }

  function showSearch(query) {
    if (!query.trim()) { showHome(); return; }
    currentView = 'search';
    const q = query.toLowerCase();
    const matched = allGames.filter(g =>
      g.title.toLowerCase().includes(q) ||
      (g.tags || []).some(t => t.toLowerCase().includes(q))
    );
    $hero.style.display = 'none';
    $gameSections.style.display = 'none';
    $searchResults.style.display = '';
    $searchTitle.textContent = `Results for "${query}" (${matched.length})`;
    $searchGrid.innerHTML = '';
    for (const g of matched) $searchGrid.appendChild(createCard(g));
    highlightSidebarItem(null);
  }

  /* ---------- Sidebar ---------- */
  function buildSidebar() {
    $sidebarNav.innerHTML = '';
    /* home item */
    const homeItem = document.createElement('div');
    homeItem.className = 'nav-item active';
    homeItem.dataset.tag = '__home';
    homeItem.innerHTML = `<span class="nav-emoji">🏠</span> Home`;
    homeItem.addEventListener('click', () => { closeSidebar(); showHome(); });
    $sidebarNav.appendChild(homeItem);

    for (const tag of TAG_ORDER) {
      const meta = TAG_META[tag] || { emoji: '🎲', label: tag };
      const item = document.createElement('div');
      item.className = 'nav-item';
      item.dataset.tag = tag;
      item.innerHTML = `<span class="nav-emoji">${meta.emoji}</span> ${meta.label}`;
      item.addEventListener('click', () => { closeSidebar(); showCategory(tag); });
      $sidebarNav.appendChild(item);
    }
  }

  function highlightSidebarItem(tag) {
    for (const el of $sidebarNav.querySelectorAll('.nav-item')) {
      el.classList.toggle('active',
        tag ? el.dataset.tag === tag : el.dataset.tag === '__home');
    }
  }

  /* toggle for mobile */
  function openSidebar() {
    $sidebar.classList.add('open');
    $sidebarOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    $sidebar.classList.remove('open');
    $sidebarOverlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  /* ---------- Game overlay ---------- */
  function openGame(game) {
    $overlayTitle.textContent = game.title;
    $iframe.src = game.link;
    $overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    history.pushState({ view: 'game', link: game.link, title: game.title }, '', '#play-' + normalizeHref(game.link));
  }
  function closeGame() {
    $overlay.classList.remove('open');
    $iframe.src = 'about:blank';
    document.body.style.overflow = '';
    if (history.state && history.state.view === 'game') history.back();
  }
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      $overlay.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  /* ---------- Events ---------- */
  $menuBtn.addEventListener('click', () => $sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  $sidebarOverlay.addEventListener('click', closeSidebar);
  $overlayBack.addEventListener('click', closeGame);
  $overlayFs.addEventListener('click', toggleFullscreen);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if ($overlay.classList.contains('open')) { closeGame(); return; }
      if ($sidebar.classList.contains('open')) { closeSidebar(); return; }
    }
  });

  /* search */
  let searchTimer;
  $searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => showSearch($searchInput.value), 250);
  });

  /* popstate */
  window.addEventListener('popstate', e => {
    if ($overlay.classList.contains('open')) {
      $overlay.classList.remove('open');
      $iframe.src = 'about:blank';
      document.body.style.overflow = '';
      return;
    }
    const st = e.state;
    if (st && st.view === 'category') showCategory(st.tag);
    else showHome();
  });

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    await loadGames();
    buildSidebar();

    /* check hash for deep-link */
    const hash = location.hash.replace('#', '');
    if (hash && TAG_META[hash]) {
      showCategory(hash);
    } else {
      showHome();
    }
  });

})();

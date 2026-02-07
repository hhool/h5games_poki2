/* ============================================================
   Poki2 — App logic (enhanced)
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

  const TAG_ORDER = ['action','puzzle','racing','shooting','sports','competitive','strategy','idle','other'];
  const SECTION_LIMIT = 12;
  const HERO_FEATURED_COUNT = 6;
  const RECENT_KEY = 'poki2_recent';
  const MAX_RECENT = 12;

  /* ---------- Mobile detection ---------- */
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || ('ontouchstart' in window && window.innerWidth <= 1024);

  /** Return true if this game should be shown on the current device */
  function canShow(game) {
    if (!isMobile) return true;
    const input = game.input || ['keyboard'];
    return input.includes('touch');
  }

  /* ---------- DOM refs ---------- */
  const $ = id => document.getElementById(id);
  const $sidebar       = $('sidebar');
  const $sidebarOverlay= $('sidebar-overlay');
  const $menuBtn       = $('menu-btn');
  const $sidebarNav    = $('sidebar-nav');
  const $gameSections  = $('game-sections');
  const $searchInput   = $('search');
  const $searchResults = $('search-results');
  const $searchGrid    = $('search-grid');
  const $searchTitle   = $('search-results-title');
  const $searchEmpty   = $('search-empty');
  const $hero          = $('hero');
  const $heroFeatured  = $('hero-featured');
  const $recentSection = $('recently-played');
  const $recentGrid    = $('recent-grid');
  const $clearRecent   = $('clear-recent');
  const $overlay       = $('game-overlay');
  const $overlayTitle  = $('overlay-title');
  const $overlayBack   = $('overlay-back');
  const $overlayFs     = $('overlay-fs');
  const $iframe        = $('game-iframe');
  const $content       = $('content');
  const $skeleton      = $('loading-skeleton');
  const $backToTop     = $('back-to-top');
  const $shuffleBtn    = $('shuffle-btn');
  const $detail        = $('game-detail');
  const $detailImg     = $('detail-img');
  const $detailTitle   = $('detail-title');
  const $detailTags    = $('detail-tags');
  const $detailPlay    = $('detail-play');
  const $detailClose   = $('detail-close');
  const $detailBackdrop= $('detail-backdrop');
  const $pauseOverlay  = $('game-pause');
  const $pauseResume   = $('pause-resume');
  const $pauseQuit     = $('pause-quit');

  /* ---------- State ---------- */
  let allGames    = [];
  let tagMap      = {};
  let currentView = 'home';
  let pendingGame = null;   // game waiting in detail interstitial
  let gamePaused  = false;  // true when game is paused (exited fullscreen)
  let userExitedFullscreen = false; // track intentional exit vs close

  /* ---------- Helpers ---------- */
  function normalizeHref(link) {
    try {
      const u = new URL(link);
      let p = u.pathname.replace(/\/+$/, '');
      if (!p) p = u.hostname.split('.')[0];
      return p.split('/').pop() || link;
    } catch { return link; }
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.random() * (i + 1) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- Recently Played (localStorage) ---------- */
  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; }
    catch { return []; }
  }
  function saveRecent(list) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT))); }
    catch { /* quota */ }
  }
  function addRecent(game) {
    let list = getRecent().filter(g => g.link !== game.link);
    list.unshift({ link: game.link, imgSrc: game.imgSrc, title: game.title, tags: game.tags, input: game.input });
    saveRecent(list);
  }
  function clearRecent() {
    localStorage.removeItem(RECENT_KEY);
    renderRecentSection();
  }

  /* ---------- Data ---------- */
  async function loadGames() {
    const urls = ['games.json', '../h5games_web/poki2.online/games.json'];
    for (const url of urls) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        allGames = await r.json();
        break;
      } catch { /* next */ }
    }

    // On mobile, filter out keyboard-only games
    allGames = allGames.filter(canShow);

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
      <img class="game-card-img" src="${game.imgSrc}" alt="${game.title}" loading="lazy"
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22><rect fill=%22%23334%22 width=%221%22 height=%221%22/></svg>'">
      <div class="game-card-info">
        <div class="game-card-title">${game.title}</div>
      </div>`;
    el.addEventListener('click', () => showDetail(game));
    return el;
  }

  function renderSection(tag, limit) {
    const meta = TAG_META[tag] || { emoji: '🎲', label: tag };
    const games = tagMap[tag] || [];
    if (!games.length) return null;

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

    const btn = section.querySelector('.see-all');
    if (btn) btn.addEventListener('click', () => showCategory(tag));
    return section;
  }

  /* ---------- Hero featured ---------- */
  function renderHeroFeatured() {
    $heroFeatured.innerHTML = '';
    const picks = shuffle(allGames).slice(0, HERO_FEATURED_COUNT);
    for (const g of picks) {
      const card = document.createElement('div');
      card.className = 'hero-card';
      card.innerHTML = `<img src="${g.imgSrc}" alt="${g.title}" loading="lazy">`;
      card.addEventListener('click', () => showDetail(g));
      $heroFeatured.appendChild(card);
    }
  }

  /* ---------- Recently Played ---------- */
  function renderRecentSection() {
    const list = getRecent().filter(canShow);
    if (!list.length) { $recentSection.style.display = 'none'; return; }
    $recentSection.style.display = '';
    $recentGrid.innerHTML = '';
    for (const g of list) $recentGrid.appendChild(createCard(g));
  }

  /* ---------- Views ---------- */
  function showHome() {
    currentView = 'home';
    $hero.style.display = '';
    $searchResults.style.display = 'none';
    $gameSections.innerHTML = '';
    $gameSections.style.display = '';
    $skeleton.style.display = 'none';
    renderRecentSection();
    for (const tag of TAG_ORDER) {
      const sec = renderSection(tag, SECTION_LIMIT);
      if (sec) $gameSections.appendChild(sec);
    }
    highlightSidebarItem(null);
    $searchInput.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.replaceState({ view: 'home' }, '', location.pathname);
  }

  function showCategory(tag) {
    currentView = 'category';
    $hero.style.display = 'none';
    $recentSection.style.display = 'none';
    $searchResults.style.display = 'none';
    $gameSections.innerHTML = '';
    $gameSections.style.display = '';
    $skeleton.style.display = 'none';
    const sec = renderSection(tag, 0);
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
      canShow(g) && (
        g.title.toLowerCase().includes(q) ||
        (g.tags || []).some(t => t.toLowerCase().includes(q))
      )
    );
    $hero.style.display = 'none';
    $recentSection.style.display = 'none';
    $gameSections.style.display = 'none';
    $skeleton.style.display = 'none';
    $searchResults.style.display = '';
    $searchTitle.textContent = `Results for "${query}" (${matched.length})`;
    $searchGrid.innerHTML = '';
    $searchEmpty.style.display = matched.length ? 'none' : '';
    for (const g of matched) $searchGrid.appendChild(createCard(g));
    highlightSidebarItem(null);
  }

  /* ---------- Sidebar ---------- */
  function buildSidebar() {
    $sidebarNav.innerHTML = '';
    const homeItem = document.createElement('div');
    homeItem.className = 'nav-item active';
    homeItem.dataset.tag = '__home';
    homeItem.innerHTML = `<span class="nav-emoji">🏠</span> Home <span class="nav-badge">${allGames.length}</span>`;
    homeItem.addEventListener('click', () => { closeSidebar(); showHome(); });
    $sidebarNav.appendChild(homeItem);

    for (const tag of TAG_ORDER) {
      const meta = TAG_META[tag] || { emoji: '🎲', label: tag };
      const count = (tagMap[tag] || []).length;
      if (!count) continue;
      const item = document.createElement('div');
      item.className = 'nav-item';
      item.dataset.tag = tag;
      item.innerHTML = `<span class="nav-emoji">${meta.emoji}</span> ${meta.label} <span class="nav-badge">${count}</span>`;
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

  /* ---------- Game detail interstitial ---------- */
  function showDetail(game) {
    pendingGame = game;
    $detailImg.src = game.imgSrc;
    $detailTitle.textContent = game.title;
    $detailTags.innerHTML = (game.tags || [])
      .map(t => `<span class="detail-tag">${(TAG_META[t] || {}).emoji || '🎲'} ${(TAG_META[t] || {}).label || t}</span>`)
      .join('');
    $detail.classList.add('open');
  }
  function hideDetail() {
    $detail.classList.remove('open');
    pendingGame = null;
  }

  /* ---------- Game overlay ---------- */
  const $loadingOverlay = $('game-loading');

  function openGame(game) {
    hideDetail();
    addRecent(game);
    $overlayTitle.textContent = game.title;

    // Clear old game and show loading
    $iframe.src = 'about:blank';
    $loadingOverlay.classList.add('show');

    $overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    gamePaused = false;
    userExitedFullscreen = false;
    $pauseOverlay.classList.remove('show');
    history.pushState({ view: 'game', link: game.link, title: game.title }, '', '#play-' + normalizeHref(game.link));

    // Load new game after a tick (ensures blank is rendered first)
    requestAnimationFrame(() => {
      $iframe.src = game.link;
    });

    // Auto-enter fullscreen when opening a game
    setTimeout(() => {
      $overlay.requestFullscreen().catch(() => {});
    }, 100);
  }

  // Hide loading overlay once iframe finishes loading
  $iframe.addEventListener('load', () => {
    if ($iframe.src !== 'about:blank') {
      $loadingOverlay.classList.remove('show');
    }
  });
  function closeGame() {
    gamePaused = false;
    userExitedFullscreen = false;
    $pauseOverlay.classList.remove('show');
    if (document.fullscreenElement) {
      document.exitFullscreen().then(() => {
        finishCloseGame();
      }).catch(() => { finishCloseGame(); });
    } else {
      finishCloseGame();
    }
  }
  function finishCloseGame() {
    $overlay.classList.remove('open');
    $iframe.src = 'about:blank';
    document.body.style.overflow = '';
    if (history.state && history.state.view === 'game') history.back();
    /* refresh recent row */
    if (currentView === 'home') renderRecentSection();
  }
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      gamePaused = false;
      $pauseOverlay.classList.remove('show');
      $overlay.requestFullscreen().catch(() => {});
    } else {
      userExitedFullscreen = true;
      document.exitFullscreen();
    }
  }
  function resumeFullscreen() {
    gamePaused = false;
    $pauseOverlay.classList.remove('show');
    $overlay.requestFullscreen().catch(() => {});
  }

  /* ---------- Fullscreen change → pause ---------- */
  document.addEventListener('fullscreenchange', () => {
    if (!$overlay.classList.contains('open')) return;
    if (!document.fullscreenElement) {
      // Exited fullscreen while game is open → show pause
      gamePaused = true;
      $pauseOverlay.classList.add('show');
    } else {
      gamePaused = false;
      $pauseOverlay.classList.remove('show');
    }
  });

  /* ---------- Back to top ---------- */
  function handleScroll() {
    const scrollY = $content.scrollTop || window.scrollY;
    $backToTop.classList.toggle('show', scrollY > 400);
  }

  /* ---------- Events ---------- */
  $menuBtn.addEventListener('click', () => $sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  $sidebarOverlay.addEventListener('click', closeSidebar);
  $overlayBack.addEventListener('click', closeGame);
  $overlayFs.addEventListener('click', toggleFullscreen);
  $pauseResume.addEventListener('click', resumeFullscreen);
  $pauseQuit.addEventListener('click', closeGame);
  $clearRecent.addEventListener('click', clearRecent);
  $backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  $shuffleBtn.addEventListener('click', () => {
    if (!allGames.length) return;
    const g = allGames[Math.random() * allGames.length | 0];
    showDetail(g);
  });

  /* detail interstitial */
  $detailPlay.addEventListener('click', () => { if (pendingGame) openGame(pendingGame); });
  $detailClose.addEventListener('click', hideDetail);
  $detailBackdrop.addEventListener('click', hideDetail);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (gamePaused && $pauseOverlay.classList.contains('show')) { closeGame(); return; }
      if ($overlay.classList.contains('open')) { closeGame(); return; }
      if ($detail.classList.contains('open'))  { hideDetail(); return; }
      if ($sidebar.classList.contains('open')) { closeSidebar(); return; }
    }
  });

  /* search */
  let searchTimer;
  $searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => showSearch($searchInput.value), 250);
  });

  /* scroll */
  window.addEventListener('scroll', handleScroll, { passive: true });

  /* popstate */
  window.addEventListener('popstate', e => {
    if ($overlay.classList.contains('open')) {
      $overlay.classList.remove('open');
      $iframe.src = 'about:blank';
      document.body.style.overflow = '';
      if (currentView === 'home') renderRecentSection();
      return;
    }
    const st = e.state;
    if (st && st.view === 'category') showCategory(st.tag);
    else showHome();
  });

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    await loadGames();
    $skeleton.style.display = 'none';
    buildSidebar();
    renderHeroFeatured();

    const hash = location.hash.replace('#', '');
    if (hash && TAG_META[hash]) {
      showCategory(hash);
    } else {
      showHome();
    }
  });

})();

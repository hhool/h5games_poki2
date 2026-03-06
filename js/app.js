/* ============================================================
   Poki2 — App logic (enhanced)
   ============================================================ */

(() => {
  "use strict";

  // Runtime marker for debug: indicates the app bundle executed
  try {
    window.__APP_BUNDLED = true;
    console.log('[app] bundle loaded');
  } catch (e) {
    /* ignore */
  }

  /* ---------- Category metadata ---------- */
  const TAG_META = {
    action:      { emoji: "💥", label: "Action" },
    adventure:   { emoji: "🗺️", label: "Adventure" },
    arcade:      { emoji: "👾", label: "Arcade" },
    competitive: { emoji: "🏆", label: "Competitive" },
    idle:        { emoji: "🕹️", label: "Idle" },
    multiplayer: { emoji: "👥", label: "Multiplayer" },
    platformer:  { emoji: "🏃", label: "Platformer" },
    puzzle:      { emoji: "🧩", label: "Puzzle" },
    racing:      { emoji: "🏎️", label: "Racing" },
    shooting:    { emoji: "🔫", label: "Shooting" },
    sports:      { emoji: "⚽", label: "Sports" },
    strategy:    { emoji: "♟️", label: "Strategy" },
    // fallback label for non-standard tags (no tag page)
    other:       { emoji: "🎲", label: "Other" },
  };

  /* ---------- Tag intros (headline + desc) — kept small for runtime use ---------- */
  const TAG_INTRO = {
    puzzle:      { headline: 'Free Online Puzzle Games', desc: 'Challenge your brain with the best free puzzle games online. Solve riddles, match tiles, and test your logic — all playable instantly in your browser.' },
    adventure:   { headline: 'Free Online Adventure Games', desc: 'Embark on epic quests and explore unknown worlds in the best free adventure games online. Play instantly in your browser — no download or install required.' },
    shooting:    { headline: 'Free Online Shooting Games', desc: 'Lock and load with the best free shooting games online. Aim, fire, and take down enemies in fast-paced action — playable in any browser on desktop and mobile.' },
    action:      { headline: 'Free Online Action Games', desc: 'Dive into non-stop thrills with the best free action games online. Fast reflexes and epic battles await — all available to play instantly in your browser.' },
    racing:      { headline: 'Free Online Racing Games', desc: 'Hit the gas with the best free racing games online. Speed through challenging tracks, dodge rivals, and chase first place — playable instantly in your browser.' },
    sports:      { headline: 'Free Online Sports Games', desc: 'Compete in the best free online sports games — from basketball to soccer. Play solo or challenge opponents and climb the leaderboard. No download needed.' },
    strategy:    { headline: 'Free Online Strategy Games', desc: 'Outthink your opponents with the best free strategy games online. Plan every move, manage resources, and dominate the battlefield. Play instantly in your browser.' },
    multiplayer: { headline: 'Free Online Multiplayer Games', desc: 'Play with or against friends in the best free multiplayer games online. Challenge real players worldwide in real-time — no download, no install, just play instantly.' },
    idle:        { headline: 'Free Online Idle & Clicker Games', desc: 'Sit back and let the numbers grow in the best free idle games online. Upgrade, automate, and unlock powerful boosts — instant play, no download required.' },
    arcade:      { headline: 'Free Online Arcade Games', desc: 'Relive the golden age of gaming with the best free arcade games online. Simple controls, addictive gameplay, and high scores to chase. Play instantly in any browser.' },
    platformer:  { headline: 'Free Online Platformer Games', desc: 'Jump, run, and dodge through dangerous levels in the best free platformer games online. Classic side-scrolling action playable instantly in your browser.' },
    competitive: { headline: 'Free Online Competitive Games', desc: 'Rise to the top in the best free competitive games online. Go head-to-head, prove your skills, and claim the number one spot. Play now in your browser.' },
  };

  const TAG_ORDER = [
    "action",
    "puzzle",
    "adventure",
    "racing",
    "shooting",
    "multiplayer",
    "competitive",
    "strategy",
    "idle",
    "arcade",
    "sports",
    "platformer",
  ];
  // Maximum games to show per category section (configurable constant)
  const SECTION_LIMIT = 9;
  const HERO_FEATURED_COUNT = 6;
  const RECENT_KEY = "poki2_recent";
  const MAX_RECENT = 12;
  const FAVS_KEY = 'poki2_favs';
  const SEARCH_HIST_KEY = 'poki2_search_hist';
  const MAX_SEARCH_HIST = 5;
  const INITIAL_SECTIONS = 3; // Number of sections to load initially for lazy loading

  /* ---------- Mobile detection ---------- */
  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    ("ontouchstart" in window && window.innerWidth <= 1024);
  const isWeChat = /MicroMessenger/i.test(navigator.userAgent);

  // Touch/pointer debug logging disabled. To re-enable, set this to true
  // during local debugging (avoid leaving enabled in production).
  const DEBUG_TOUCH = false;

  /** Return true if this game should be shown on the current device */
  function canShow(game) {
    // Prefer explicit `avalid` field when present: only show if it includes current platform
    const platform = isMobile ? "mobile" : "desktop";
    if (game.show === undefined || game.show === null || game.show === false) {
      if (
        typeof process !== "undefined" &&
        process &&
        process.env &&
        process.env.NODE_ENV === "development"
      ) {
        console.warn(
          `Game "${game.title}" does not have an explicit "show" field. Please add "show": true to display this game. Defaulting to hide on all platforms until "show" is explicitly set to true.`,
          game,
        );
      }
      return false; // explicit hide
    }
    // check game.avalid first, if it's an array, use it to determine
    //  if the game is valid for the current platform
    if (game.avalid === undefined || game.avalid === null) {
      // out put a warning in dev if avalid is not defined, to encourage explicit declaration
      if (
        typeof process !== "undefined" &&
        process &&
        process.env &&
        process.env.NODE_ENV === "development"
      ) {
        console.warn(
          `Game "${game.title}" does not have an "avalid" field. Please add one to specify which platforms it is valid for (e.g. ["desktop"], ["mobile"], or ["desktop", "mobile"]). Defaulting to hide on all platforms until "avalid" is defined.`,
          game,
        );
      }
      return false; // default to hide if avalid is not defined (strict opt-in)
    }
    if (Array.isArray(game.avalid)) {
      return game.avalid.includes(platform);
    }
    // Fallback to previous heuristic (input contains touch for mobile)
    if (isMobile) {
      const input = game.input || ["keyboard"];
      return input.includes("touch");
    }
    return true;
  }

  /**
   * Return true if the game can be played in the current environment.
   * This is a stricter check than `canShow` (visibility): it verifies
   * input compatibility, embedding capability, fullscreen requirements,
   * and known webview limitations.
   */
  function isPlayable(game) {
    // If the manifest explicitly marks the game as unplayable, honor that
    if (game.playable === false) return false;

    // Must be visible on this platform to be playable
    if (!canShow(game)) return false;

    // If the game explicitly forbids embedding (e.g. `embed: false`),
    // we cannot load it inside the iframe overlay used by the site.
    if (game.embed === false) return false;

    // Input constraints: on mobile require touch if keyboard-only
    if (Array.isArray(game.input)) {
      if (isMobile && !game.input.includes("touch")) return false;
      // On desktop, prefer keyboard/mouse/gamepad; if manifest lists only
      // touch and we're on desktop, still allow (desktop can handle touch)
    }

    // Fullscreen/Orientation requirements: some in-app webviews (WeChat)
    // do not support fullscreen or orientation lock reliably; if the game
    // declares `requires_fullscreen` and we're inside such a webview, mark
    // as not playable to avoid broken UX inside the overlay.
    if (game.requires_fullscreen && isWeChat) return false;

    // Default to playable if no blocking signal is present
    return true;
  }

  /* ---------- DOM refs ---------- */
  const $ = (id) => document.getElementById(id);
  const $sidebar = $("sidebar");
  const $sidebarOverlay = $("sidebar-overlay");
  const $menuBtn = $("menu-btn");
  const $sidebarNav = $("sidebar-nav");
  const $gameSections = $("game-sections");
  const $searchInput = $("search");
  const $searchResults = $("search-results");
  const $searchGrid = $("search-grid");
  const $searchTitle = $("search-results-title");
  const $searchEmpty = $("search-empty");
  const $hero = $("hero");
  const $heroFeatured = $("hero-featured");
  const $recentSection = $("recently-played");
  const $recentGrid = $("recent-grid");
  const $clearRecent = $("clear-recent");
  let $overlay = null;
  let $overlayTitle = null;
  let $overlayBar = null;
  let $barTrigger = null;
  let $overlayBack = null;
  let $overlayFs = null;

  const BAR_SHOW_DURATION = 3000; // ms before auto-hide
  let barHideTimer = null;
  let currentGame = null;

  // Lazy loading state
  let loadedSections = 0;
  let lazyObserver = null;

  function showBar() {
    if (!currentGame || currentGame.use_overlay_title === false) return;
    $overlayBar.classList.remove("bar-hidden");
    clearTimeout(barHideTimer);
    barHideTimer = setTimeout(hideBar, BAR_SHOW_DURATION);
  }
  function hideBar() {
    clearTimeout(barHideTimer);
    // Don't hide if loading, paused, or orientation hint is showing
    if ($loadingOverlay.classList.contains("show")) return;
    if ($pauseOverlay.classList.contains("show")) return;
    if ($orientHint.classList.contains("show")) return;
    $overlayBar.classList.add("bar-hidden");
  }
  function resetBarTimer() {
    showBar();
  }

  // Trigger zone: mouse enter or touch
  // (listeners are attached after DOM refs are initialized)
  const $iframe = $("game-iframe");
  const $content = $("content");
  const $skeleton = $("loading-skeleton");
  const $backToTop = $("back-to-top");
  const $shuffleBtn = $("shuffle-btn");
  let $detail = null;
  let $detailImg = null;
  let $detailTitle = null;
  let $detailTags = null;
  let $detailDesc = null;
  let $detailPlay = null;
  let $detailClose = null;
  let $detailBackdrop = null;
  let $detailFavBtn = null;
  let $detailRelated = null;
  let $shareTw = null, $shareFb = null, $shareCopy = null;
  let $detailBlogRow = null, $detailBlogLink = null;
  const $pauseOverlay = $("game-pause");
  const $pauseResume = $("pause-resume");
  const $pauseQuit = $("pause-quit");

  /* ---------- State ---------- */
  let allGames = [];
  let rawGames = [];
  let tagMap = {};
  let currentView = "home";
  let pendingGame = null; // game waiting in detail interstitial
  let gamePaused = false; // true when game is paused (exited fullscreen)
  let userExitedFullscreen = false; // track intentional exit vs close

  /* ---------- Helpers ---------- */

  // Remove static noscript snapshots (H1/intro/nav/back link) injected
  // by the static generator so JS-enabled clients do not render duplicate
  // content. Static (crawler) output remains in the HTML source; this
  // runtime pass removes those nodes for SPA clients only.
  try {
    document.querySelectorAll('noscript').forEach(ns => {
      try {
        const html = (ns.innerHTML || '').toLowerCase();
        if (html.indexOf('<h1') !== -1 || html.indexOf('other categories:') !== -1 || html.indexOf('back to') !== -1 || html.indexOf('games in this category') !== -1) {
          if (ns.parentNode) ns.parentNode.removeChild(ns);
        }
      } catch (e) { /* ignore individual noscript removal failures */ }
    });
  } catch (e) { /* ignore */ }

  /** Escape text for safe insertion into innerHTML */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  /** Schedule work to run during an idle period (fallback to setTimeout). Returns a Promise resolved after cb runs. */
  function scheduleIdle(cb, opts = { timeout: 50 }) {
    return new Promise((res) => {
      try {
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          requestIdleCallback(() => {
            try { cb(); } catch (e) { /* ignore */ }
            res();
          }, opts);
        } else {
          setTimeout(() => {
            try { cb(); } catch (e) { /* ignore */ }
            res();
          }, opts.timeout || 50);
        }
      } catch (e) { try { cb(); } catch (e) {} res(); }
    });
  }
  function normalizeHref(link) {
    try {
      const u = new URL(link);
      let p = u.pathname.replace(/\/+$/, "");
      if (!p) p = u.hostname.split(".")[0];
      return p.split("/").pop() || link;
    } catch {
      return link;
    }
  }

  /** Return an ordered list of favicon candidates for a game's link */
  function getFaviconCandidates(link) {
    const fallbackSvg =
      "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22><rect fill=%22%23334%22 width=%221%22 height=%221%22/></svg>";
    try {
      const u = new URL(link);
      const origin = u.origin.replace(/\/+$/, "");
      // Common candidate paths (ordered by preference)
      return [
        origin + "/favicon.png",
        origin + "/favicon-32x32.png",
        origin + "/favicon.ico",
        origin + "/favicon.svg",
        // Useful site-wide fallback
        "https://poki2.online/favicon.png",
        fallbackSvg,
      ];
    } catch {
      return ["https://poki2.online/favicon.png"];
    }
  }

  /** Attach an onerror chain to `img` that cycles through favicon candidates when loading fails. */
  function attachFaviconFallback(img, link) {
    const candidates = getFaviconCandidates(link);
    let idx = 0;

    function next() {
      if (idx >= candidates.length) return;
      const url = candidates[idx++];
      img.src = url;
    }

    // If the current src is one of the candidates, start from the next one
    const current = (img.src || "").toString();
    const start = candidates.findIndex((c) => c === current);
    if (start >= 0) idx = start + 1;

    img.onerror = function () {
      // avoid infinite loops
      this.onerror = null;
      next();
      // reattach handler for subsequent failures (if any)
      setTimeout(() => attachFaviconFallback(img, link), 0);
    };
  }

  /** Optimize image loading with WebP support detection */
  function optimizeImageLoading(img, src) {
    // For local images, try WebP first if supported
    if (src && src.startsWith('/') && !src.includes('://')) {
      const webpSupported = document.documentElement.classList.contains('webp');
      if (webpSupported) {
        const webpSrc = src.replace(/\.(png|jpg|jpeg)$/i, '.webp');
        // Check if WebP version exists by trying to load it
        const testImg = new Image();
        testImg.onload = () => {
          img.src = webpSrc;
        };
        testImg.onerror = () => {
          img.src = src; // Fallback to original
        };
        testImg.src = webpSrc;
        return;
      }
    }
    // For external images or when WebP not supported, use original
    img.src = src;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- Recently Played (localStorage) ---------- */
  function getRecent() {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
    } catch {
      return [];
    }
  }
  function saveRecent(list) {
    try {
      localStorage.setItem(
        RECENT_KEY,
        JSON.stringify(list.slice(0, MAX_RECENT)),
      );
    } catch {
      /* quota */
    }
  }
  function addRecent(game) {
    let list = getRecent().filter((g) => g.link !== game.link);
    list.unshift({
      link: game.link,
      imgSrc: game.imgSrc,
      title: game.title,
      tags: game.tags,
      input: game.input,
      orientation: game.orientation,
    });
    saveRecent(list);
  }
  function clearRecent() {
    localStorage.removeItem(RECENT_KEY);
    renderRecentSection();
  }

  /* ---------- Data ---------- */
  async function loadGames() {
    // Prefer local manifest; remove legacy fallback that caused 404s.
    const urls = ["games.json"];
    for (const url of urls) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        rawGames = await r.json();
        break;
      } catch {
        /* next */
      }
    }

    // Deduplicate and perform heavy normalization during idle time to avoid
    // blocking the main thread during page load.
    await scheduleIdle(() => {
      const seen = new Set();
      rawGames = (rawGames || []).filter((g) => {
        const key = (g.link || g.title || "").toString().toLowerCase().trim();
        if (!key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // On mobile, filter out keyboard-only games for the visible list
      allGames = rawGames.filter(canShow);

      tagMap = {};
      for (const g of allGames) {
        const rawTags = Array.isArray(g.tags) ? g.tags : ["other"];
        const uniqueTags = Array.from(new Set(rawTags.map((t) => String(t).trim())));
        g.tags = uniqueTags.length ? uniqueTags : ["other"];
        for (const t of g.tags) {
          (tagMap[t] = tagMap[t] || []).push(g);
        }
      }
    }, { timeout: 100 });
  }

  /* ---------- Structured data ---------- */
  function injectItemListSchema(games) {
    try {
      // Featured games appear first in the list for better Rich Results coverage
      const sorted = [...games.filter(g => g.featured), ...games.filter(g => !g.featured)];
      const top = sorted.slice(0, 20);
      const items = top.map((g, i) => {
        const slug = (g.link || "").replace(/\/$/, "").split("/").pop() || "";
        const char = slug.charAt(0) || "_";
        return {
          "@type": "ListItem",
          "position": i + 1,
          "name": g.title || "",
          "url": "https://poki2.online/game/" + char + "/" + slug + "/"
        };
      });
      const schema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Popular Free Online Games",
        "url": "https://poki2.online/",
        "numberOfItems": top.length,
        "itemListElement": items
      };
      const existing = document.getElementById('ld-itemlist');
      if (existing) existing.remove();
      const s = document.createElement('script');
      s.id = 'ld-itemlist';
      s.type = 'application/ld+json';
      s.textContent = JSON.stringify(schema);
      document.head.appendChild(s);
    } catch (e) {}
  }

  /* ---------- Favorites helpers ---------- */
  function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAVS_KEY) || '[]'); } catch(e) { return []; }
  }
  function setFavs(arr) {
    try { localStorage.setItem(FAVS_KEY, JSON.stringify(arr)); } catch(e) {}
  }
  function isFav(link) { return getFavs().includes(link); }
  function toggleFav(link) {
    let favs = getFavs();
    if (favs.includes(link)) favs = favs.filter(f => f !== link);
    else favs.unshift(link);
    setFavs(favs);
    updateFavsNavBadge();
  }
  function updateFavsNavBadge() {
    try {
      const badge = document.getElementById('favs-nav-badge');
      if (badge) badge.textContent = getFavs().length;
    } catch(e) {}
  }

  /* ---------- Search history helpers ---------- */
  function getSearchHistory() {
    try { return JSON.parse(localStorage.getItem(SEARCH_HIST_KEY) || '[]'); } catch(e) { return []; }
  }
  function addSearchHistory(q) {
    if (!q || !q.trim()) return;
    try {
      let hist = getSearchHistory().filter(h => h.toLowerCase() !== q.toLowerCase());
      hist.unshift(q.trim());
      hist = hist.slice(0, MAX_SEARCH_HIST);
      localStorage.setItem(SEARCH_HIST_KEY, JSON.stringify(hist));
    } catch(e) {}
  }
  function renderSearchHistoryDropdown() {
    const dropdown = document.getElementById('search-history-dropdown');
    if (!dropdown) return;
    if ($searchInput.value.trim()) { dropdown.style.display = 'none'; return; }
    const hist = getSearchHistory();
    if (!hist.length) { dropdown.style.display = 'none'; return; }
    dropdown.innerHTML = '';
    hist.forEach(q => {
      const item = document.createElement('div');
      item.className = 'search-hist-item';
      const text = document.createElement('span');
      text.textContent = q;
      text.className = 'search-hist-text';
      text.addEventListener('mousedown', e => {
        e.preventDefault();
        $searchInput.value = q;
        _lastSearchQuery = q;
        clearTimeout(_searchDebounceTimer);
        dropdown.style.display = 'none';
        showSearch(q);
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'search-hist-del';
      del.textContent = '\u2715';
      del.setAttribute('aria-label', 'Remove ' + q);
      del.addEventListener('mousedown', e => {
        e.preventDefault();
        try {
          const upd = getSearchHistory().filter(h => h !== q);
          localStorage.setItem(SEARCH_HIST_KEY, JSON.stringify(upd));
        } catch(_e) {}
        renderSearchHistoryDropdown();
      });
      item.appendChild(text);
      item.appendChild(del);
      dropdown.appendChild(item);
    });
    dropdown.style.display = '';
  }

  /* ---------- Detail — related games ---------- */
  function renderDetailRelated(game) {
    if (!$detailRelated) return;
    try {
      const related = allGames.filter(g =>
        canShow(g) && g.link !== game.link &&
        (game.tags || []).some(t => (g.tags || []).includes(t))
      ).slice(0, 6);
      $detailRelated.innerHTML = '';
      if (!related.length) return;
      const titleEl = document.createElement('p');
      titleEl.className = 'detail-related-title';
      titleEl.textContent = 'You may also like';
      $detailRelated.appendChild(titleEl);
      const row = document.createElement('div');
      row.className = 'detail-related-row';
      related.forEach(g => {
        const item = document.createElement('div');
        item.className = 'detail-related-item';
        const img = document.createElement('img');
        img.alt = g.title || '';
        img.loading = 'lazy';
        const src = g.imgSrc || getFaviconCandidates(g.link)[0];
        optimizeImageLoading(img, src);
        attachFaviconFallback(img, g.link);
        const name = document.createElement('span');
        name.textContent = g.title || '';
        item.appendChild(img);
        item.appendChild(name);
        item.addEventListener('click', () => showDetail(g));
        row.appendChild(item);
      });
      $detailRelated.appendChild(row);
    } catch(e) {}
  }

  /* ---------- Favorites view ---------- */
  function showFavorites() {
    currentView = 'favorites';
    if (document && document.body) document.body.classList.remove('full-bleed-footer');
    try { const sp = document.querySelector('.page-spacer'); if (sp) sp.remove(); } catch(e) {}
    $hero.style.display = 'none';
    $recentSection.style.display = 'none';
    $searchResults.style.display = 'none';
    $skeleton.style.display = 'none';
    $gameSections.style.display = '';
    $gameSections.innerHTML = '';
    const favLinks = getFavs();
    const favGames = favLinks.map(link => allGames.find(g => g.link === link)).filter(Boolean);
    const section = document.createElement('section');
    section.className = 'category-section';
    section.innerHTML = '<div class="section-header"><h2 class="section-title"><span class="emoji">❤️</span> Favorites</h2></div>';
    const grid = document.createElement('div');
    grid.className = 'game-grid';
    if (favGames.length) {
      favGames.forEach(g => grid.appendChild(createCard(g)));
    } else {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.gridColumn = '1 / -1';
      empty.innerHTML = '<div class="empty-icon">❤️</div><p class="empty-text">No favorites yet — tap ♥ on any game card!</p>';
      grid.appendChild(empty);
    }
    section.appendChild(grid);
    $gameSections.appendChild(section);
    updateChipActive('__favs');
    highlightSidebarItem('__favs');
    updateBnavActive();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Render helpers ---------- */
  function createCard(game) {
    const el = document.createElement("div");
    el.className = "game-card";
    el.dataset.link = game.link || '';
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Play ' + (game.title || 'Game'));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(game); }
    });
    // Badge (new/hot/popular)
    if (game.badge) {
      const badge = document.createElement('span');
      badge.className = `game-card-badge badge-${game.badge}`;
      badge.textContent = game.badge;
      el.appendChild(badge);
    }
    // Favorites heart button
    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'fav-btn' + (isFav(game.link) ? ' faved' : '');
    favBtn.setAttribute('aria-label', isFav(game.link) ? 'Remove from favorites' : 'Add to favorites');
    favBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    favBtn.addEventListener('click', e => {
      e.stopPropagation();
      toggleFav(game.link);
      const faved = isFav(game.link);
      // sync ALL cards showing this same game across every section
      document.querySelectorAll(`.game-card[data-link="${game.link}"] .fav-btn`).forEach(b => {
        b.classList.toggle('faved', faved);
        b.setAttribute('aria-label', faved ? 'Remove from favorites' : 'Add to favorites');
      });
      // sync detail modal fav button if this game is currently shown
      if ($detailFavBtn && pendingGame && pendingGame.link === game.link) {
        $detailFavBtn.classList.toggle('fav-active', faved);
        const favText = document.getElementById('detail-fav-text');
        if (favText) favText.textContent = faved ? 'Saved' : 'Favorite';
      }
    });
    el.appendChild(favBtn);

    const img = document.createElement("img");
    img.className = "game-card-img";
    img.alt = game.title || "";
    // LCP: first 12 cards load eagerly; first 4 get fetchpriority=high
    const _cardIdx = (window.__cardCount = (window.__cardCount || 0) + 1);
    img.loading = _cardIdx <= 12 ? "eager" : "lazy";
    if (_cardIdx <= 4) img.fetchPriority = "high";

    // Use optimized image loading with WebP support
    const imgSrc = game.imgSrc || getFaviconUrl(game.link);
    optimizeImageLoading(img, imgSrc);

    // attach a favicon fallback chain so missing icons resolve to site favicons
    attachFaviconFallback(img, game.link);

    const info = document.createElement("div");
    info.className = "game-card-info";
    const title = document.createElement("div");
    title.className = "game-card-title";
    // Ensure a readable fallback title is always present in the DOM so
    // category views reliably show a label under each icon.
    title.textContent = game.title || normalizeHref(game.link) || "Untitled";
    title.setAttribute('aria-label', title.textContent);
    info.appendChild(title);

    el.appendChild(img);
    el.appendChild(info);
    el.addEventListener("click", () => showDetail(game));
    return el;
  }

  function renderSection(tag, limit) {
    // Create a placeholder section quickly and populate its grid in small batches
    // during idle to avoid long main-thread blocks caused by creating many DOM nodes.
    const meta = TAG_META[tag] || { emoji: "🎲", label: tag };
    const games = tagMap[tag] || [];
    if (!games.length) return null;

    const section = document.createElement("section");
    section.className = "category-section";
    section.id = "section-" + tag;

    const showAll = (typeof limit === 'number' && limit > 0) && games.length > limit;
    section.innerHTML = `
      <div class="section-header">
        <h2 class="section-title"><span class="emoji">${meta.emoji}</span> ${meta.label}</h2>
        ${showAll ? `<button class="see-all" data-tag="${tag}">See all (${games.length})</button>` : ""}
      </div>`;

    const grid = document.createElement("div");
    grid.className = "game-grid";
    section.appendChild(grid);

    const list = limit ? games.slice(0, limit) : games;

    // Populate in batches during idle time
    (async () => {
      const BATCH = 12;
      for (let i = 0; i < list.length; i += BATCH) {
        const frag = document.createDocumentFragment();
        for (let j = i; j < Math.min(i + BATCH, list.length); j++) {
          frag.appendChild(createCard(list[j]));
        }
        grid.appendChild(frag);
        // yield to the browser
        await scheduleIdle(() => {}, { timeout: 40 });
      }
    })();

    const btn = section.querySelector(".see-all");
    if (btn) btn.addEventListener("click", () => showCategory(tag));
    return section;
  }

  /* ---------- Hero featured ---------- */
  function renderHeroFeatured() {
    $heroFeatured.innerHTML = "";
    // Prefer explicitly featured games; fill remaining slots with random picks
    const featured = allGames.filter(g => g.featured);
    const rest = shuffle(allGames.filter(g => !g.featured));
    const picks = [...featured, ...rest].slice(0, HERO_FEATURED_COUNT);
    // Preload hero images to prioritize above-the-fold resources
    try {
      for (const g of picks) {
        const url = g.imgSrc || getFaviconUrl(g.link);
        if (!url) continue;
        const l = document.createElement('link');
        l.rel = 'preload';
        l.as = 'image';
        l.href = url;
        document.head.appendChild(l);
      }
    } catch (e) {}

    // populate during idle to avoid blocking; hero images are above-the-fold,
    // so mark them eager and provide intrinsic dimensions to avoid CLS.
    (async () => {
      for (const g of picks) {
        const card = document.createElement("div");
        card.className = "hero-card";
        const himg = document.createElement("img");
        himg.alt = g.title || "";
        // Prevent hero images from being lazy-loaded (they are above-the-fold)
        himg.loading = "eager";
        // Provide intrinsic size to avoid layout shifts
        himg.width = 90;
        himg.height = 90;
          const imgSrc = g.imgSrc || getFaviconCandidates(g.link)[0];
        optimizeImageLoading(himg, imgSrc);
        attachFaviconFallback(himg, g.link);
        // Stretch-fit the hero image and center its content
        himg.style.objectPosition = '50% 50%';
        himg.style.objectFit = 'fill';
        himg.addEventListener('load', () => {
          try {
            himg.style.objectFit = 'fill';
            himg.style.objectPosition = '50% 50%';
          } catch (e) {
            himg.style.objectFit = 'fill';
          }
        });
        card.appendChild(himg);
        card.addEventListener("click", () => showDetail(g));
        $heroFeatured.appendChild(card);
        await scheduleIdle(() => {}, { timeout: 30 });
      }
    })();
  }

  /* ---------- Recently Played ---------- */
  function renderRecentSection() {
    const list = getRecent().filter(canShow);
    if (!list.length) {
      $recentSection.style.display = "none";
      return;
    }
    $recentSection.style.display = "";
    $recentGrid.innerHTML = "";
    (async () => {
      const BATCH = 8;
      for (let i = 0; i < list.length; i += BATCH) {
        const frag = document.createDocumentFragment();
        for (let j = i; j < Math.min(i + BATCH, list.length); j++) frag.appendChild(createCard(list[j]));
        $recentGrid.appendChild(frag);
        await scheduleIdle(() => {}, { timeout: 30 });
      }
    })();
  }

  /* ---------- Lazy Loading ---------- */
  function loadMoreSections() {
    const remainingTags = TAG_ORDER.slice(loadedSections);
    if (remainingTags.length === 0) return;

    const batchSize = 2; // Load 2 sections at a time
    const tagsToLoad = remainingTags.slice(0, batchSize);

    for (const tag of tagsToLoad) {
      const sec = renderSection(tag, SECTION_LIMIT);
      if (sec) $gameSections.appendChild(sec);
      loadedSections++;
    }

    // If there are more sections, set up observer for the last loaded section
    if (loadedSections < TAG_ORDER.length) {
      setupLazyObserver();
    }
  }

  function setupLazyObserver() {
    if (lazyObserver) lazyObserver.disconnect();

    const sections = $gameSections.querySelectorAll('.category-section');
    if (sections.length === 0) return;

    const lastSection = sections[sections.length - 1];
    lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadMoreSections();
        }
      });
    }, { rootMargin: '100px' }); // Trigger 100px before the element comes into view

    lazyObserver.observe(lastSection);
  }

  /* ---------- Tag chip filter bar ---------- */
  function renderTagChips() {
    const bar = document.getElementById('tag-chips');
    if (!bar) return;
    bar.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'tag-chips-inner';
    const all = document.createElement('button');
    all.type = 'button';
    all.className = 'tag-chip active';
    all.textContent = '🕹️ All';
    all.dataset.chip = '__all';
    all.addEventListener('click', () => { try { $searchInput.value = ''; } catch(e){} showHome(); });
    inner.appendChild(all);
    // Favorites chip — quick access without opening sidebar
    const favsChip = document.createElement('button');
    favsChip.type = 'button';
    favsChip.className = 'tag-chip';
    favsChip.textContent = '❤️ Favorites';
    favsChip.dataset.chip = '__favs';
    favsChip.addEventListener('click', () => showFavorites());
    inner.appendChild(favsChip);
    for (const tag of TAG_ORDER) {
      const meta = TAG_META[tag] || { emoji: '🎲', label: tag };
      const count = (tagMap[tag] || []).length;
      if (!count) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-chip';
      btn.textContent = `${meta.emoji} ${meta.label}`;
      btn.dataset.chip = tag;
      btn.addEventListener('click', () => showCategory(tag));
      inner.appendChild(btn);
    }
    bar.appendChild(inner);
  }
  function updateChipActive(activeTag) {
    try {
      const bar = document.getElementById('tag-chips');
      if (!bar) return;
      (bar.querySelector('.tag-chips-inner') || bar).querySelectorAll('.tag-chip').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.chip === activeTag);
      });
      const active = bar.querySelector('.tag-chip.active');
      if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } catch (e) {}
  }

  /* ---------- Trending Now section ---------- */
  function renderTrendingSection() {
    const games = allGames.filter(g => g.featured || g.badge === 'hot' || g.badge === 'popular');
    if (!games.length) return null;
    const section = document.createElement('section');
    section.className = 'category-section';
    section.id = 'section-trending';
    const seen = new Set();
    const deduped = games.filter(g => {
      const k = g.link || g.title;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    const showAll = deduped.length > SECTION_LIMIT;
    section.innerHTML = `<div class="section-header"><h2 class="section-title"><span class="emoji">🔥</span> Trending Now</h2>${showAll ? `<button class="see-all" data-tag="trending">See all (${deduped.length})</button>` : ''}</div>`;
    const grid = document.createElement('div');
    grid.className = 'game-grid';
    for (const g of deduped.slice(0, SECTION_LIMIT)) grid.appendChild(createCard(g));
    section.appendChild(grid);
    const btn = section.querySelector('.see-all');
    if (btn) btn.addEventListener('click', () => {
      for (const g of deduped.slice(SECTION_LIMIT)) grid.appendChild(createCard(g));
      btn.remove();
    });
    return section;
  }

  /* ---------- Page meta (title / canonical / description) ---------- */
  function updatePageMeta(view, tag) {
    try {
      const CAT_DESC = {
        action:      'Play free action games online — intense combat, platformers and fast-paced adventures.',
        puzzle:      'Play free puzzle games online — brain teasers, logic challenges and mind-bending riddles.',
        racing:      'Play free racing games online — kart racers, drag races and high-speed tracks.',
        shooting:    'Play free shooting games online — FPS, top-down shooters and arcade blasters.',
        sports:      'Play free sports games online — football, basketball, soccer and more.',
        competitive: 'Play free competitive games online — prove your skills against opponents.',
        strategy:    'Play free strategy games online — build empires, plan battles and conquer.',
        idle:        'Play free idle games online — clickers, incremental and idle adventures.',
        other:       'Discover more free browser games on Poki2 — a diverse mix of fun for everyone.',
      };
      const HOME_DESC  = 'Play 200+ free browser games: action, puzzle, racing and more — instant play on desktop and mobile. No downloads required.';
      const HOME_TITLE = 'Poki2 — Play 200+ Free Online Games';
      let desc, canonical, title;
      if (view === 'category' && tag && TAG_META[tag]) {
        const label = TAG_META[tag].label || tag;
        desc      = CAT_DESC[tag] || `Play free ${label.toLowerCase()} games online on Poki2.`;
        canonical = `https://poki2.online/tag/${tag}/`;
        title     = `${label} Games — Free Online | Poki2`;
      } else {
        desc = HOME_DESC; canonical = 'https://poki2.online/'; title = HOME_TITLE;
      }
      try { document.title = title; } catch(e){}
      const set = (sel, attr, val) => { try { const el = document.querySelector(sel); if (el) el[attr] = val; } catch(e){} };
      set('meta[name="description"]',         'content', desc);
      set('meta[property="og:description"]',  'content', desc);
      set('meta[property="og:title"]',        'content', title);
      set('meta[property="og:url"]',          'content', canonical);
      set('meta[name="twitter:title"]',       'content', title);
      set('meta[name="twitter:description"]', 'content', desc);
      set('link[rel="canonical"]',            'href',    canonical);
    } catch(e){}
  }

  /* ---------- Views ---------- */
  function showHome() {
    // Guard: if the user is mid-search, any showHome() triggered by popstate /
    // hashchange / init race conditions should be ignored. The search view
    // handles its own display. Intentional Home navigation must clear the
    // input first (see homeItem click handler below).
    if ($searchInput && $searchInput.value.trim()) return;
    currentView = "home";
    window.__cardCount = 0; // reset so first-N eager logic works on re-render
    // Remove pinned footer helper when returning to home and hide footer until needed
    if (document && document.body) {
      document.body.classList.remove('full-bleed-footer');
      document.body.classList.add('footer-hidden');
    }
    // remove any page spacer used for category views
    try { const sp = document.querySelector('.page-spacer'); if (sp) sp.remove(); } catch(e){}
    $hero.style.display = "";
    $searchResults.style.display = "none";
    $gameSections.innerHTML = "";
    $gameSections.style.display = "";
    $skeleton.style.display = "none";
    renderRecentSection();
    // Trending Now — featured + badged games
    const _tr = renderTrendingSection();
    if (_tr) $gameSections.insertBefore(_tr, $gameSections.firstChild);

    // Reset lazy loading state
    loadedSections = 0;
    if (lazyObserver) lazyObserver.disconnect();

    // Load initial sections
    const initialTags = TAG_ORDER.slice(0, INITIAL_SECTIONS);
    for (const tag of initialTags) {
      const sec = renderSection(tag, SECTION_LIMIT);
      if (sec) $gameSections.appendChild(sec);
      loadedSections++;
    }

    // Set up lazy loading if there are more sections
    if (loadedSections < TAG_ORDER.length) {
      setupLazyObserver();
    }

    highlightSidebarItem(null);
    updateChipActive('__all');
    updatePageMeta('home');
    $searchInput.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Move keyboard focus to the shuffle button on home load — avoids
    // triggering the mobile virtual keyboard that $searchInput.focus() causes.
    try { if ($shuffleBtn && typeof $shuffleBtn.focus === 'function') $shuffleBtn.focus(); } catch (e) {}
    // Sanitize pathname to avoid protocol-relative edge cases like '//' which
    // can be interpreted as a protocol-relative URL and cause SecurityError
    // when passed to history.replaceState. Collapse repeated slashes first.
    try {
      // If the full href contains duplicate leading slashes after the origin
      // (e.g. https://site.com//path), normalize by replacing the leading
      // run of slashes with a single slash and navigate there. Using
      // `location.replace` avoids history.replaceState throwing in some
      // browser/webview combinations that reject protocol-relative URLs.
      try {
        const origin = (location.origin || (location.protocol + '//' + location.host));
        const after = location.href.slice(origin.length);
        if (after && after.indexOf('//') === 0) {
          const cleaned = origin + after.replace(/^\/+/, '/');
          if (cleaned !== location.href) {
            window.location.replace(cleaned);
            return;
          }
        }
      } catch (e) {
        /* ignore origin/URL parsing errors */
      }

      let safePath = (location.pathname || '').replace(/\/\/{2,}/g, '/');
      if (!safePath.startsWith('/')) safePath = '/' + safePath;

      // If the current pathname contains an abnormal leading '//' or other
      // duplicate-slash situation that some third-party scripts handle by
      // constructing absolute URLs, avoid calling replaceState which may
      // throw in some browsers. Instead, perform a location.replace to
      // reload at the cleaned canonical path which resolves the issue.
      // If collapsing repeated slashes changes the pathname, perform a
      // full navigation to the canonical path. This avoids calling
      // history.replaceState with a malformed URL that some browsers reject.
      const target = safePath + (location.search || '') + (location.hash || '');
      // Debug help: log pathname vs safePath when collapse occurs
      try {
        if (safePath !== (location.pathname || '')) console.log('[route] safePath cleanup', { pathname: location.pathname, safePath: safePath, target: target });
      } catch (e) {}
      if (safePath !== (location.pathname || '')) {
        // Only navigate if the target differs to avoid reload loops
        if (target !== (location.pathname || '') + (location.search || '') + (location.hash || '')) {
          window.location.replace(target);
          return; // navigation scheduled
        }
      }

      // Otherwise update history state using a path-only URL
      history.replaceState({ view: "home" }, "", safePath);
    } catch (e) {
      // If replaceState still fails for any reason, fallback to no-op.
      console.warn('[route] history.replaceState failed to set home state', e && e.message ? e.message : e);
    }
  }

  function showCategory(tag, pageNum) {
    pageNum = Math.max(1, parseInt(pageNum) || 1);
    const CAT_PAGE_SIZE = 24;
    currentView = "category";
    // Normalize incoming tag to a canonical key present in TAG_ORDER.
    // This handles cases where callers pass a visible label (e.g. "Competitive")
    // or a hash with different casing. After mapping, `tag` will be the
    // canonical lowercase key used across tagMap/TAG_ORDER.
    try {
      const inTag = String(tag || '').toLowerCase().trim();
      let canonical = null;
      if (TAG_ORDER.includes(inTag)) canonical = inTag;
      else {
        // Try to match by visible label in TAG_META or by substring match
        for (const key of TAG_ORDER) {
          const lbl = ((TAG_META[key] && TAG_META[key].label) || key).toString().toLowerCase();
          if (lbl === inTag || lbl.indexOf(inTag) >= 0 || inTag.indexOf(lbl) >= 0) {
            canonical = key;
            break;
          }
        }
      }
      if (canonical) tag = canonical;
    } catch (e) {
      /* ignore and continue with original tag */
    }
    const buildTagUrl = (page) => {
      const p = Math.max(1, parseInt(page) || 1);
      return p > 1 ? `/tag/${tag}/?page=${p}` : `/tag/${tag}/`;
    };

    // Update URL to a single canonical tag page, keeping pagination in the
    // query string.
    try {
      const targetUrl = buildTagUrl(pageNum);
      const currentUrl = (location.pathname || '') + (location.search || '');
      if (currentUrl !== targetUrl) {
        history.pushState({ view: 'category', tag, page: pageNum }, '', targetUrl);
      }
    } catch(e) {}
    // Use the robust highlightSidebarItem (case-insensitive) and ensure the
    // matching nav item receives focus where possible.
    try {
      highlightSidebarItem(tag);
      if ($sidebarNav) {
        const norm = String(tag || '').toLowerCase().trim();
        const match = Array.from($sidebarNav.querySelectorAll('.nav-item')).find((el) => {
          return (el.dataset.tag || '').toString().toLowerCase().trim() === norm;
        });
        if (match && typeof match.focus === 'function') match.focus();
      }
    } catch (e) {}
    updateChipActive(tag);
    updatePageMeta('category', tag);
    try { if (window.footerMeasure && typeof window.footerMeasure.update === 'function') window.footerMeasure.update(); } catch (e) {}
    if (document && document.body) document.body.classList.add('full-bleed-footer');
    $hero.style.display = "none";
    $recentSection.style.display = "none";
    $searchResults.style.display = "none";

    // Build paged, full-screen sections. Each "page" contains up to SECTION_LIMIT games.
    let allTagGames = tagMap[tag] || [];
    if (!allTagGames.length) return;
    const totalCatPages = Math.ceil(allTagGames.length / CAT_PAGE_SIZE);
    const safePageNum = Math.min(Math.max(1, pageNum), totalCatPages);

    

    // Header + pages container
    $gameSections.innerHTML = `
      <section class="category-section">
        <div class="section-header">
          <h2 class="section-title"><button class="category-refresh" type="button"><span class="emoji">${(TAG_META[tag]||{}).emoji||'🎲'}</span> ${(TAG_META[tag]||{}).label||tag}</button></h2>
        </div>
      </section>
    `;
    $gameSections.style.display = "";
    $skeleton.style.display = "none";
    
    // Simulate loading delay for better UX
    setTimeout(() => {
      $gameSections.innerHTML = "";
      // Prefer generator's static ordering when available: parse CollectionPage JSON-LD
      try {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        let collection = null;
        scripts.forEach(s => {
          try {
            const j = JSON.parse(s.textContent || s.innerText || '{}');
            if (j && j['@type'] === 'CollectionPage' && Array.isArray(j.hasPart)) collection = j;
          } catch (e) { /* ignore parse errors */ }
        });
        if (collection) {
          const orderUrls = collection.hasPart.map(p => (p && p.url) ? p.url.replace(/\/$/, '') : null).filter(Boolean);
          const ordered = [];
          for (const u of orderUrls) {
            const match = allTagGames.find(g => ((g.link || '').replace(/\/$/, '') === u) || (('/' + ((g.link||'').replace(/https?:\/\//, '').split('/').pop()) + '/') === u + '/'));
            if (match) ordered.push(match);
          }
          // append any missing games preserving runtime order
          for (const g of allTagGames) if (!ordered.includes(g)) ordered.push(g);
          allTagGames = ordered;
        }
      } catch (e) { /* ignore ordering fallback errors */ }

      // Temporarily slice tagMap for pagination using the (possibly reordered) list
      const _origGames = tagMap[tag];
      if (totalCatPages > 1) {
        tagMap[tag] = allTagGames.slice((safePageNum - 1) * CAT_PAGE_SIZE, safePageNum * CAT_PAGE_SIZE);
      }
      const sec = renderSection(tag, 0);
      tagMap[tag] = _origGames; // always restore
      if (sec) {
        $gameSections.appendChild(sec);
        // Ensure no "See all" button appears on the full-category detail view
        const stray = $gameSections.querySelectorAll('.see-all');
        stray.forEach((el) => el.remove());
      }
      // Remove any static `.tag-intro` emitted by the generator so JS-enabled
      // clients do not display the crawler-facing intro. The SPA will not
      // recreate a visible intro element for JS clients — crawlers keep the
      // static content in the HTML source, but runtime removes it.
      try {
        document.querySelectorAll('.tag-intro').forEach(el => {
          try { if (el && el.parentNode) el.parentNode.removeChild(el); } catch (e) { /* ignore */ }
        });
      } catch (e) { /* ignore */ }
      // Inject visible pagination nav when there are multiple pages
      if (totalCatPages > 1) {
        const prevPage = safePageNum === 1 ? null : safePageNum - 1;
        const nextPage = safePageNum < totalCatPages ? safePageNum + 1 : null;
        const paginav = document.createElement('nav');
        paginav.className = 'pagination-nav';
        paginav.setAttribute('aria-label', 'Page navigation');
        let phtml = prevPage
          ? `<a href="${buildTagUrl(prevPage)}" class="page-btn" data-page="${prevPage}" aria-label="Previous page">&#8592; Prev</a>`
          : `<span class="page-btn disabled" aria-disabled="true">&#8592; Prev</span>`;
        phtml += '<div class="page-nums">';
        for (let _p = 1; _p <= totalCatPages; _p++) {
          const _u = buildTagUrl(_p);
          const _cls = _p === safePageNum ? 'page-num active' : 'page-num';
          const _cur = _p === safePageNum ? ' aria-current="page"' : '';
          phtml += `<a href="${_u}" class="${_cls}" data-page="${_p}" aria-label="Page ${_p}"${_cur}>${_p}</a>`;
        }
        phtml += '</div>';
        phtml += nextPage
          ? `<a href="${buildTagUrl(nextPage)}" class="page-btn" data-page="${nextPage}" aria-label="Next page">Next &#8594;</a>`
          : `<span class="page-btn disabled" aria-disabled="true">Next &#8594;</span>`;
        paginav.innerHTML = phtml;
        // Remove any existing pagination nav (could be static noscript output
        // from the generator or a previous runtime insertion) so we don't
        // render duplicate controls on the same page.
        try {
          const existing = document.querySelectorAll('.pagination-nav');
          if (existing && existing.length) {
            existing.forEach((el) => el.remove());
          }
        } catch (e) {
          /* ignore DOM removal errors */
        }
        paginav.addEventListener('click', (ev) => {
          const link = ev.target && ev.target.closest ? ev.target.closest('a[data-page]') : null;
          if (!link) return;
          ev.preventDefault();
          const next = parseInt(link.dataset.page || '1', 10) || 1;
          showCategory(tag, next);
          try {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } catch (e) {}
        });
        $gameSections.appendChild(paginav);
      }
      // ensure footer spacer is applied for short content so footer sits flush
      try { ensureFooterSpacer(); } catch (e) { /* ignore */ }
      // Reveal footer only after spacer & measurements are applied to avoid jump
      try {
        requestAnimationFrame(() => {
          setTimeout(() => {
            try { document.body.classList.remove('footer-hidden'); } catch (e) {}
          }, 40);
        });
      } catch (e) {}
      // remove the temporary min-height to allow natural layout after swap
      try {
        if ($gameSections.style.minHeight) {
          requestAnimationFrame(() => { $gameSections.style.minHeight = ''; });
        }
      } catch (e) { /* ignore */ }
        // Recompute fixed-size/pager spacing now that pager was (re)rendered
        try { if (pager.parentNode) computeAndApplyFixedSize(activeIndex); } catch (e) { /* ignore */ }
        // Move focus to the category header button (if present) or the
        // first focusable card so keyboard users land at the content.
        try {
          const hdrBtn = $gameSections.querySelector('.section-header .category-refresh');
          if (hdrBtn && typeof hdrBtn.focus === 'function') {
            hdrBtn.focus();
          } else {
            const firstCard = $gameSections.querySelector('.game-card, .game-card a, .game-card button');
            if (firstCard) {
              if (typeof firstCard.focus === 'function') firstCard.focus();
              else { firstCard.tabIndex = -1; firstCard.focus(); }
            }
          }
        } catch (e) {}
    }, 300);
  }

  // Ensure a spacer exists under short category content so footer sits flush
  function ensureFooterSpacer() {
    try {
      if (!document || !document.body || !document.body.classList.contains('full-bleed-footer')) {
        const oldr = document.querySelector('.page-spacer');
        if (oldr) oldr.remove();
        return;
      }
      const footer = document.querySelector('.site-footer');
      const header = document.querySelector('.topbar') || document.querySelector('.page-header');
      const container = $gameSections;
      if (!container || !footer) {
        const old = document.querySelector('.page-spacer');
        if (old) old.remove();
        return;
      }

      // remove existing spacer if present; we'll recreate with updated size
      let sp = document.querySelector('.page-spacer');
      if (sp) sp.remove();

      // measurements
      const headerH = header ? header.offsetHeight : parseInt(getComputedStyle(document.documentElement).getPropertyValue('--page-header-height')) || 72;
      const footerH = footer.offsetHeight || parseInt(getComputedStyle(document.documentElement).getPropertyValue('--measured-footer')) || 160;
      const viewportH = window.innerHeight || document.documentElement.clientHeight;

      // content height: use scrollHeight to include content not visible yet
      const contentH = container.scrollHeight || container.getBoundingClientRect().height || 0;

          const available = Math.max(0, viewportH - headerH - footerH);
          // Align spacer height to the device pixel grid to avoid 1-2px subpixel gaps
          const rawNeeded = Math.max(0, available - contentH);
          const dpr = window.devicePixelRatio || 1;
          const spacerH = Math.max(0, Math.round(rawNeeded * dpr) / dpr);

      if (spacerH <= 0) return; // no spacer needed

      sp = document.createElement('div');
      sp.className = 'page-spacer';
      sp.style.width = '100%';
      sp.style.height = spacerH + 'px';
      sp.style.pointerEvents = 'none';
      sp.style.background = 'transparent';

      // Insert the spacer just before the footer so it reliably pushes the
      // body-level footer down regardless of the sections' container hierarchy.
      const footerEl = document.querySelector('.site-footer');
      if (footerEl) {
        try {
          // Ensure footer is a direct child of body so inserting a spacer before it
          // will reliably push it down regardless of other container hierarchies.
          if (footerEl.parentNode !== document.body) {
            document.body.appendChild(footerEl);
          }
          document.body.insertBefore(sp, footerEl);
        } catch (e) {
          // fallback to original behavior
          if (footerEl.parentNode) footerEl.parentNode.insertBefore(sp, footerEl);
          else if (container.parentNode) container.parentNode.insertBefore(sp, container.nextSibling);
        }
      } else if (container.parentNode) {
        // Fallback: insert after container as before
        container.parentNode.insertBefore(sp, container.nextSibling);
      }
    } catch (e) {
      /* ignore */
    }
  }

  // Debounced resize handler for spacer
  const __spacer_debounce = (fn, ms) => {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };
  window.addEventListener('resize', __spacer_debounce(ensureFooterSpacer, 120), { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(ensureFooterSpacer, 150));

  function showSearch(query) {
    if (!query.trim()) {
      showHome();
      return;
    }
    currentView = "search";
    // Remove pinned footer helper when leaving category/static views
    if (document && document.body) document.body.classList.remove('full-bleed-footer');
    // remove any category spacer
    try { const sp = document.querySelector('.page-spacer'); if (sp) sp.remove(); } catch(e){}
    const q = query.toLowerCase();
    const matched = allGames.filter(
      (g) =>
        canShow(g) &&
        (g.title.toLowerCase().includes(q) ||
          (g.tags || []).some((t) => t.toLowerCase().includes(q))),
    );
    $hero.style.display = "none";
    $recentSection.style.display = "none";
    $gameSections.style.display = "none";
    $skeleton.style.display = "none";
    $searchResults.style.display = "";
    $searchTitle.textContent = `Results for "${query}" (${matched.length})`;

    // Render results synchronously — no setTimeout/rAF delay to avoid
    // creating an async window where showHome() can interrupt.
    $searchGrid.innerHTML = "";
    _searchKbIdx = -1;
    $searchEmpty.style.display = matched.length ? "none" : "";
    for (const g of matched) $searchGrid.appendChild(createCard(g));
    addSearchHistory(query.trim());
    highlightSidebarItem(null);
  }

  // Robust pager page switcher: safely show a page, hide others, pause media
  // on hidden pages, set aria-hidden, and best-effort prefetch adjacent pages.
  const showPage = async (idx) => {
    try {
      if (!pageEls || !pageEls.length) return;
      idx = Number(idx) || 0;
      if (idx < 0) idx = 0;
      if (idx >= pageEls.length) idx = pageEls.length - 1;

      const prev = typeof __currentPagerIndex === 'number' ? __currentPagerIndex : 0;

      for (let i = 0; i < pageEls.length; i++) {
        const el = pageEls[i];
        const active = i === idx;
        try { el.style.display = active ? '' : 'none'; } catch (e) {}
        try { el.setAttribute && el.setAttribute('aria-hidden', active ? 'false' : 'true'); } catch (e) {}

        // If we're hiding the previously-active page, attempt to pause heavy
        // resources (video/audio/iframe) to free memory and stop playback.
        if (!active && i === prev) {
          try {
            const medias = el.querySelectorAll && el.querySelectorAll('video,audio,iframe');
            if (medias && medias.length) {
              medias.forEach((m) => {
                try {
                  if (m.tagName === 'IFRAME') {
                    // best-effort sandboxing: replace src to unload content
                    if (m.src && !m.src.startsWith('about:blank')) m.dataset._poki_old_src = m.src;
                    m.src = 'about:blank';
                  } else if (typeof m.pause === 'function') {
                    m.pause();
                    try { m.currentTime = 0; } catch (e) {}
                  }
                } catch (e) {}
              });
            }
          } catch (e) {}
        }
      }

      __currentPagerIndex = idx;
      try { renderPager && renderPager(idx); } catch (e) {}

      // Ensure visible page is populated and prefetch neighbors; failures are non-fatal
      try { if (typeof ensurePagePopulated === 'function') await ensurePagePopulated(pageEls[idx]); } catch (e) {}
      try { if (pageEls[idx + 1] && typeof ensurePagePopulated === 'function') ensurePagePopulated(pageEls[idx + 1]); } catch (e) {}
      try { if (pageEls[idx - 1] && typeof ensurePagePopulated === 'function') ensurePagePopulated(pageEls[idx - 1]); } catch (e) {}

      try { pageEls[idx].scrollIntoView && pageEls[idx].scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
      // Update keyboard focus to the visible page: prefer a focusable control
      // within the page, otherwise focus the page container itself.
      try {
        const page = pageEls[idx];
        if (page) {
          const focusable = page.querySelector && page.querySelector('button,a,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
          if (focusable && typeof focusable.focus === 'function') {
            focusable.focus();
          } else {
            page.tabIndex = -1;
            if (typeof page.focus === 'function') page.focus();
          }
        }
      } catch (e) {}
    } catch (err) {
      console.warn('[pager] showPage error', err && err.message ? err.message : err);
    }
  };

  /* ---------- Sidebar ---------- */
  function buildSidebar() {
    $sidebarNav.innerHTML = "";
    const homeItem = document.createElement("button");
    homeItem.type = "button";
    homeItem.className = "nav-item active";
    homeItem.dataset.tag = "__home";
    homeItem.setAttribute("aria-current", "page");
    homeItem.innerHTML = `<span class="nav-emoji">🏠</span> Home <span class="nav-badge">${allGames.length}</span>`;
    homeItem.addEventListener("click", () => {
      // Clear search first so the showHome() guard doesn't block this
      // intentional user navigation back to the home page.
      if ($searchInput) $searchInput.value = "";
      closeSidebar();
      showHome();
    });
    $sidebarNav.appendChild(homeItem);
    // Favorites
    const favsItem = document.createElement('button');
    favsItem.type = 'button';
    favsItem.className = 'nav-item';
    favsItem.dataset.tag = '__favs';
    favsItem.innerHTML = `<span class="nav-emoji">❤️</span> Favorites <span class="nav-badge" id="favs-nav-badge">${getFavs().length}</span>`;
    favsItem.addEventListener('click', () => { closeSidebar(); showFavorites(); });
    $sidebarNav.appendChild(favsItem);

    for (const tag of TAG_ORDER) {
      const meta = TAG_META[tag] || { emoji: "🎲", label: tag };
      const count = (tagMap[tag] || []).length;
      if (!count) continue;
      const item = document.createElement("button");
      item.type = "button";
      item.className = "nav-item";
      item.dataset.tag = tag;
      item.innerHTML = `<span class="nav-emoji">${meta.emoji}</span> ${meta.label} <span class="nav-badge">${count}</span>`;
      item.addEventListener("click", () => {
        closeSidebar();
        showCategory(tag);
      });
      $sidebarNav.appendChild(item);
    }
  }

  function highlightSidebarItem(tag) {
    try {
      const norm = tag ? String(tag).toLowerCase().trim() : "__home";
      for (const el of $sidebarNav.querySelectorAll(".nav-item")) {
        const dataTag = (el.dataset.tag || "").toString().toLowerCase().trim();
        // Normalize visible label (remove counts/bad chars) for best-effort match
        const rawLabel = (el.textContent || el.innerText || "").toString();
        const normLabel = rawLabel.replace(/[0-9\(\)\s]+/g, ' ').replace(/[^a-z0-9 ]+/gi, ' ').trim().toLowerCase();
        const isActive = norm === "__home"
          ? dataTag === "__home" || normLabel === "home"
          : dataTag === norm || normLabel === norm || normLabel.indexOf(norm) >= 0 || norm.indexOf(normLabel) >= 0;

        // Debugging help: expose match diagnostics when dev flag enabled
        try {
          if (window && window.__POKI2_DEBUG_HIGHLIGHT) {
            console.debug('[highlight] tag=', tag, 'norm=', norm, 'elTag=', dataTag, 'label=', normLabel, 'isActive=', isActive);
          }
        } catch (e) {}

        el.classList.toggle("active", isActive);
        if (isActive) {
          try { el.setAttribute("aria-current", "page"); } catch (e) {}
          // Do NOT call el.focus() here. highlightSidebarItem() is for visual
          // highlighting only. On desktop the sidebar is always visible (no
          // .open class), so any focus() call here unconditionally steals focus
          // from the search input on every keystroke. Focus management when
          // opening the sidebar is handled exclusively in openSidebar().
        } else {
          try { el.removeAttribute("aria-current"); } catch (e) {}
        }
      }
    } catch (e) {
      /* defensive - if sidebar isn't present yet, ignore */
    }
  }

  function openSidebar() {
    $sidebar.classList.add("open");
    $sidebarOverlay.classList.add("show");
    document.body.style.overflow = "hidden";
    if ($menuBtn) $menuBtn.setAttribute("aria-expanded", "true");
    // Move keyboard focus into the sidebar for keyboard users
    setTimeout(() => {
      const first = $sidebarNav.querySelector(".nav-item");
      if (first && typeof first.focus === "function") first.focus();
    }, 50);
  }
  function closeSidebar() {
    $sidebar.classList.remove("open");
    $sidebarOverlay.classList.remove("show");
    document.body.style.overflow = "";
    if ($menuBtn) $menuBtn.setAttribute("aria-expanded", "false");
    // Return focus to the menu button if it's visible; otherwise move focus to main content
    try {
      if ($menuBtn) {
        const s = window.getComputedStyle($menuBtn);
        if (s && s.display !== "none" && $menuBtn.offsetParent !== null) {
          if (typeof $menuBtn.focus === "function") $menuBtn.focus();
          return;
        }
      }
      if ($content) {
        $content.tabIndex = -1;
        if (typeof $content.focus === "function") $content.focus();
      }
    } catch (e) {
      // ignore focus errors
    }
  }

  /* ---------- P3.1 / P3.2 — Game meta injection (JSON-LD + OG/Twitter) ---------- */
  const _defaultMeta = {
    title:     document.title,
    desc:      (document.querySelector('meta[name="description"]')         || {}).content || '',
    ogTitle:   (document.querySelector('meta[property="og:title"]')        || {}).content || '',
    ogDesc:    (document.querySelector('meta[property="og:description"]')  || {}).content || '',
    ogUrl:     (document.querySelector('meta[property="og:url"]')          || {}).content || '',
    ogImg:     (document.querySelector('meta[property="og:image"]')        || {}).content || '',
    twTitle:   (document.querySelector('meta[name="twitter:title"]')       || {}).content || '',
    twDesc:    (document.querySelector('meta[name="twitter:description"]') || {}).content || '',
    twUrl:     (document.querySelector('meta[name="twitter:url"]')         || {}).content || '',
    twImg:     (document.querySelector('meta[name="twitter:image"]')       || {}).content || '',
    canonical: (document.querySelector('link[rel="canonical"]')           || {}).href    || '',
  };

  function _setMeta(sel, attr, val) {
    try { const el = document.querySelector(sel); if (el && val) el.setAttribute(attr, val); } catch(e) {}
  }

  function _injectGameMeta(game) {
    const title = game.title + ' — Play Free on Poki2';
    const desc  = game.description || ('Play ' + game.title + ' for free online on Poki2 — no downloads required.');
    const img   = game.imgSrc || '';
    // Compute the canonical poki2.online URL for this game (not the CDN iframe URL)
    const _slug = (function() {
      try {
        const raw = (game.link || '').replace(/\/+$/, '').split('/').pop() || '';
        return raw;
      } catch(e) { return ''; }
    })();
    const url   = _slug ? ('https://poki2.online/game/' + _slug.charAt(0) + '/' + _slug + '/') : (game.link || '');
    // Page description (also updated so bots/crawlers see game-specific text)
    _setMeta('meta[name="description"]',         'content', desc);
    // OG
    _setMeta('meta[property="og:title"]',       'content', title);
    _setMeta('meta[property="og:description"]',  'content', desc);
    _setMeta('meta[property="og:url"]',          'content', url);
    _setMeta('meta[property="og:image"]',        'content', img);
    _setMeta('meta[property="og:type"]',         'content', 'website');
    // Twitter
    _setMeta('meta[name="twitter:card"]',        'content', 'summary_large_image');
    _setMeta('meta[name="twitter:url"]',         'content', url);
    _setMeta('meta[name="twitter:image"]',       'content', img);
    _setMeta('meta[name="twitter:title"]',       'content', title);
    _setMeta('meta[name="twitter:description"]', 'content', desc);
    // Canonical + page title
    try { const c = document.querySelector('link[rel="canonical"]'); if (c) c.setAttribute('href', url); } catch(e) {}
    try { document.title = title; } catch(e) {}
    // P3.1 — VideoGame JSON-LD
    try {
      const tags      = game.tags || [];
      const genreList = tags.filter(t => TAG_META[t]).map(t => TAG_META[t].label);
      const playMode  = tags.includes('multiplayer') ? 'MultiPlayer' : 'SinglePlayer';
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        name: game.title,
        url: url,
        image: img,
        thumbnailUrl: img,
        ...(img ? { screenshot: { '@type': 'ImageObject', url: img, width: 512, height: 512 } } : {}),
        description: desc,
        genre: genreList.length ? genreList : ['Game'],
        applicationCategory: 'Game',
        playMode: playMode,
        operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: { '@type': 'Organization', name: 'Poki2', url: 'https://poki2.online/' },
        ...(game.blog ? { sameAs: [game.blog] } : {})
      };
      let ldEl = document.getElementById('game-jsonld');
      if (!ldEl) {
        ldEl = document.createElement('script');
        ldEl.type = 'application/ld+json';
        ldEl.id   = 'game-jsonld';
        document.head.appendChild(ldEl);
      }
      ldEl.textContent = JSON.stringify(ld);
    } catch(e) {}
  }

  function _restoreDefaultMeta() {
    _setMeta('meta[name="description"]',         'content', _defaultMeta.desc);
    _setMeta('meta[property="og:title"]',       'content', _defaultMeta.ogTitle);
    _setMeta('meta[property="og:description"]',  'content', _defaultMeta.ogDesc);
    _setMeta('meta[property="og:url"]',          'content', _defaultMeta.ogUrl);
    _setMeta('meta[property="og:image"]',        'content', _defaultMeta.ogImg);
    _setMeta('meta[property="og:type"]',         'content', 'website');
    _setMeta('meta[name="twitter:card"]',        'content', 'summary_large_image');
    _setMeta('meta[name="twitter:url"]',         'content', _defaultMeta.twUrl);
    _setMeta('meta[name="twitter:image"]',       'content', _defaultMeta.twImg);
    _setMeta('meta[name="twitter:title"]',       'content', _defaultMeta.twTitle);
    _setMeta('meta[name="twitter:description"]', 'content', _defaultMeta.twDesc);
    try { const c = document.querySelector('link[rel="canonical"]'); if (c) c.setAttribute('href', _defaultMeta.canonical); } catch(e) {}
    try { document.title = _defaultMeta.title; } catch(e) {}
    // Remove VideoGame JSON-LD
    try { const el = document.getElementById('game-jsonld'); if (el) el.remove(); } catch(e) {}
  }

  /* ---------- Game detail interstitial ---------- */
  function showDetail(game) {
    pendingGame = game;
    $detailImg.src = game.imgSrc || getFaviconCandidates(game.link)[0];
    $detailImg.alt = game.title || "";
    $detailImg.loading = "lazy";
    attachFaviconFallback($detailImg, game.link);
    $detailTitle.textContent = game.title;
    $detailTags.innerHTML = (game.tags || [])
      .map(
        (t) =>
          `<span class="detail-tag">${(TAG_META[t] || {}).emoji || "🎲"} ${(TAG_META[t] || {}).label || t}</span>`,
      )
      .join("");
    // Show description if available
    if ($detailDesc) {
      $detailDesc.textContent = game.description || "";
    }
    // Sync fav button state
    if ($detailFavBtn) {
      const faved = isFav(game.link);
      $detailFavBtn.classList.toggle('fav-active', faved);
      const favText = document.getElementById('detail-fav-text');
      if (favText) favText.textContent = faved ? 'Saved' : 'Favorite';
    }
    // Determine if the game is playable in this environment and update the Play button
    try {
      const playable = isPlayable(game);
      if ($detailPlay) {
        $detailPlay.disabled = !playable;
        if (!playable) {
          $detailPlay.setAttribute("aria-disabled", "true");
          $detailPlay.title = "This game is not available on your device or browser.";
        } else {
          $detailPlay.removeAttribute("aria-disabled");
          $detailPlay.title = "";
        }
      }
    } catch (e) {
      if ($detailPlay) {
        $detailPlay.disabled = false;
        $detailPlay.removeAttribute("aria-disabled");
        $detailPlay.title = "";
      }
    }

    // Render related games
    renderDetailRelated(game);
    // P3 — Share button hrefs
    try {
      const _slug = (game.link || '').replace(/\/+$/, '').split('/').pop() || '';
      const _shareUrl = _slug ? ('https://poki2.online/game/' + _slug[0] + '/' + _slug + '/') : 'https://poki2.online/';
      const _shareTxt = encodeURIComponent((game.title || 'Play this game') + ' — Play free on Poki2!');
      const _shareEnc = encodeURIComponent(_shareUrl);
      if ($shareTw) $shareTw.href = 'https://twitter.com/intent/tweet?text=' + _shareTxt + '&url=' + _shareEnc;
      if ($shareFb) $shareFb.href = 'https://www.facebook.com/sharer/sharer.php?u=' + _shareEnc;
      if ($shareCopy) $shareCopy.dataset.url = _shareUrl;
    } catch(e) {}
    // P5 — Official site / blog link
    if ($detailBlogRow && $detailBlogLink) {
      if (game.blog) {
        $detailBlogLink.href = game.blog;
        $detailBlogRow.style.display = '';
      } else {
        $detailBlogRow.style.display = 'none';
      }
    }
    // P3.1 / P3.2 — inject VideoGame JSON-LD + update OG/Twitter meta
    _injectGameMeta(game);
    // Make detail interactive and trap input so underlying content doesn't receive events
    try {
      $detail.tabIndex = -1;
      $detail.classList.add("open");
      // focus the detail container to prevent keyboard events reaching iframe
      if (typeof $detail.focus === "function") $detail.focus();
      // disable pointer events and scrolling on main content while detail is open
      try { if ($content) { $content.style.pointerEvents = 'none'; $content.setAttribute('aria-hidden','true'); } } catch (e) {}
      try { document.body.style.overflow = 'hidden'; document.body.classList.add('detail-open'); } catch (e) {}
      // install capture listeners to stop pointer/keyboard events from leaking
      document.addEventListener("keydown", blockDetailKeydown, true);
      document.addEventListener("pointerdown", blockDetailPointer, true);
      document.addEventListener("mousedown", blockDetailPointer, true);
      document.addEventListener("touchstart", blockDetailPointer, true);
    } catch (e) {
      $detail.classList.add("open");
    }
  }
  function hideDetail() {
    $detail.classList.remove("open");
    document.body.classList.remove('detail-open');
    // P3.1 / P3.2 — restore default OG/Twitter meta + remove VideoGame JSON-LD
    _restoreDefaultMeta();
    try {
      document.removeEventListener("keydown", blockDetailKeydown, true);
      document.removeEventListener("pointerdown", blockDetailPointer, true);
      document.removeEventListener("mousedown", blockDetailPointer, true);
      document.removeEventListener("touchstart", blockDetailPointer, true);
      document.removeEventListener("touchmove", blockDetailMove, { capture: true, passive: false });
      document.removeEventListener("pointermove", blockDetailMove, { capture: true, passive: false });
      document.removeEventListener("wheel", blockDetailWheel, { capture: true, passive: false });
    } catch (e) {}
    // restore content interaction and scrolling
    try { if ($content) { $content.style.pointerEvents = ''; $content.removeAttribute('aria-hidden'); } } catch (e) {}
    try { document.body.style.overflow = ''; } catch (e) {}
    pendingGame = null;
  }

  // Input blocking helpers for detail overlay
  function blockDetailKeydown(e) {
    // Allow Escape to close
    if (e.key === "Escape") {
      hideDetail();
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    e.stopPropagation();
  }
  function blockDetailPointer(e) {
    // clicks on backdrop should close (handled by backdrop listener); otherwise stop propagation
    e.stopPropagation();
  }
  function blockDetailMove(e) {
    // Prevent touch/pointer move gestures from scrolling or panning the underlying page
    try { e.preventDefault(); } catch (err) {}
    e.stopPropagation();
  }
  function blockDetailWheel(e) {
    // Prevent horizontal wheel/trackpad gestures from reaching the page
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      try { e.preventDefault(); } catch (err) {}
      e.stopPropagation();
    }
  }

  /* ---------- Game overlay ---------- */
  const $loadingOverlay = $("game-loading");
  const $loadingIcon = $("loading-game-icon");
  const $loadingTitle = $("loading-game-title");
  const $loadingBar = $("loading-bar-fill");
  const $loadingPercent = $("loading-percent");
  const $orientHint = $("orient-hint");
  const $orientText = $("orient-hint-text");
  const $orientRotateBtn = $("orient-rotate-btn");
  const $orientSkipBtn = $("orient-skip-btn");

  let loadingTimer = null;
  let currentGameOrientation = "both";

  function startLoadingProgress() {
    let progress = 0;
    $loadingBar.style.width = "0%";
    $loadingPercent.textContent = "0%";
    clearInterval(loadingTimer);
    loadingTimer = setInterval(() => {
      // Simulate progress: fast at start, slows down near 90%
      const remaining = 90 - progress;
      progress += Math.max(0.5, remaining * 0.08);
      if (progress >= 90) progress = 90;
      $loadingBar.style.width = Math.round(progress) + "%";
      $loadingPercent.textContent = Math.round(progress) + "%";
    }, 200);
  }

  function finishLoadingProgress() {
    clearInterval(loadingTimer);
    $loadingBar.style.width = "100%";
    $loadingPercent.textContent = "100%";
    setTimeout(() => {
      $loadingOverlay.classList.remove("show");
      // Check orientation on mobile after game loaded
      checkOrientationHint();
      // Start bar auto-hide timer now that loading is done
      showBar();
    }, 400);
  }

  /* ---------- Orientation hint ---------- */
  function checkOrientationHint() {
    if (!isMobile) return;
    if (currentGameOrientation === "both") return;
    // WeChat's in-app webview commonly disables fullscreen/orientation APIs.
    // Provide a clearer, manual fallback message for WeChat users.
    if (isWeChat) {
      $orientHint.classList.remove("landscape", "portrait");
      $orientHint.classList.add("show");
      $orientText.textContent =
        "The WeChat in-app browser may not automatically rotate or enter fullscreen.\n" +
        "Please manually rotate your device to the correct orientation, or copy the link" +
        "and open it in your system browser for a better experience.";
      return;
    }
    const isPortrait = window.innerHeight > window.innerWidth;
    const needsLandscape = currentGameOrientation === "landscape";
    const needsPortrait = currentGameOrientation === "portrait";
    if ((needsLandscape && isPortrait) || (needsPortrait && !isPortrait)) {
      $orientHint.classList.remove("landscape", "portrait");
      $orientHint.classList.add("show", currentGameOrientation);
      $orientText.textContent = needsLandscape
        ? "This game is best in landscape mode"
        : "This game is best in portrait mode";
    } else {
      $orientHint.classList.remove("show");
    }
  }

  /** Try to lock screen orientation via API */
  async function lockOrientation(orient) {
    // orient: 'landscape' or 'portrait'
    const lockType =
      orient === "landscape" ? "landscape-primary" : "portrait-primary";
    try {
      // Some browsers require fullscreen first
      if (!document.fullscreenElement) {
        await $overlay.requestFullscreen().catch(() => {});
      }
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock(lockType);
      }
    } catch (e) {
      // Fallback: just show a tip if API not supported
      console.warn("Orientation lock not supported:", e);
    }
    $orientHint.classList.remove("show");
  }

  /** Unlock orientation back to natural */
  function unlockOrientation() {
    try {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    } catch {
      /* ignore */
    }
  }

  // Auto-dismiss orientation hint when user rotates correctly
  window.addEventListener("resize", () => {
    if (!$orientHint.classList.contains("show")) return;
    checkOrientationHint();
  });

  // Rotate button: lock screen orientation
  if ($orientRotateBtn) $orientRotateBtn.addEventListener("click", () => {
    // If we're inside WeChat or the API is unavailable, offer a fallback:
    // copy link to clipboard so user can open in system browser.
    if (isWeChat || !(screen.orientation && screen.orientation.lock)) {
      const text = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            $orientText.textContent =
              "Link copied to clipboard — please open it in your system browser for the best landscape/fullscreen experience.";
          })
          .catch(() => {
            $orientText.textContent =
              "Long-press the page and choose 'Open in Browser', or manually copy the link to open it.";
          });
      } else {
        $orientText.textContent =
          "Long-press the page and choose 'Open in Browser', or manually copy the link to open it.";
      }
      return;
    }
    lockOrientation(currentGameOrientation);
  });
  // Skip button: dismiss hint
  if ($orientSkipBtn) $orientSkipBtn.addEventListener("click", () => {
    $orientHint.classList.remove("show");
  });

  function openGame(game) {
    if (!$overlay) {
      console.error("Game overlay not found");
      return;
    }
    hideDetail();
    addRecent(game);
    $overlayTitle.textContent = game.title;
    currentGameOrientation = game.orientation || "both";
    currentGame = game;

    // Show loading with game info
    $loadingIcon.innerHTML = "";
    const limg = document.createElement("img");
    limg.src = game.imgSrc || getFaviconCandidates(game.link)[0];
    limg.alt = game.title || "";
    attachFaviconFallback(limg, game.link);
    $loadingIcon.appendChild(limg);
    $loadingTitle.textContent = game.title;

    // Clear old game and show loading
    $iframe.src = "about:blank";
    $loadingOverlay.classList.add("show");
    $orientHint.classList.remove("show");
    startLoadingProgress();

    // Hide bar by default, show only if enabled
    $overlayBar.classList.add("bar-hidden");
    if (game.use_overlay_title !== false) {
      // show bar and ensure overlay accepts pointer events for controls
      try { $overlay.classList.remove('overlay-pass-through'); } catch (e) {}
      try { $overlayTitle.style.display = ''; } catch (e) {}
      showBar();
    } else {
      // Hide title and make overlay pass pointer events through to the iframe
      try { $overlayTitle.style.display = 'none'; } catch (e) {}
      try { $overlay.classList.add('overlay-pass-through'); } catch (e) {}
      // Also disable the overlay bar trigger so it doesn't intercept touches
      try {
        if ($barTrigger) {
          $barTrigger.style.pointerEvents = 'none';
          // Collapse visual footprint in case styles rely on its height
          $barTrigger.style.height = '0px';
        }
        if ($overlayBar) {
          // hide the bar entirely while passthrough is active
          $overlayBar.style.display = 'none';
        }
        if ($iframe) {
          // ensure iframe receives pointer events
          $iframe.style.pointerEvents = 'auto';
        }
      } catch (e) {}
    }

    $overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    gamePaused = false;
    userExitedFullscreen = false;
    $pauseOverlay.classList.remove("show");
    const playQuery = "play-" + normalizeHref(game.link);
    const newUrl = location.pathname + "?" + playQuery;
    history.pushState({ view: "game", link: game.link, title: game.title }, "", newUrl);

    // Load new game after a tick (ensures blank is rendered first)
    requestAnimationFrame(() => {
      $iframe.src = game.link;
    });

    // Auto-enter fullscreen when opening a game
    setTimeout(() => {
      $overlay
        .requestFullscreen()
        .then(() => {
          if (isMobile && currentGameOrientation !== "both") {
            lockOrientation(currentGameOrientation);
          }
        })
        .catch(() => {});
    }, 100);
  }

  // Finish progress when iframe loads
  if ($iframe) $iframe.addEventListener("load", () => {
    if ($iframe.src !== "about:blank") {
      finishLoadingProgress();
      // Ensure iframe can receive keyboard and other focus-based input
      try {
        $iframe.tabIndex = 0;
        if (typeof $iframe.focus === "function") $iframe.focus();
        try { if ($iframe.contentWindow && typeof $iframe.contentWindow.focus === 'function') $iframe.contentWindow.focus(); } catch (e) {}
      } catch (e) {}
    }
  });
  function closeGame() {
    currentGame = null;
    gamePaused = false;
    userExitedFullscreen = false;
    clearInterval(loadingTimer);
    clearTimeout(barHideTimer);
    $overlayBar.classList.remove("bar-hidden");
    // restore overlay interaction in case it was passthrough
    try { $overlay.classList.remove('overlay-pass-through'); } catch (e) {}
    try { $overlayTitle.style.display = ''; } catch (e) {}
    try {
      if ($barTrigger) {
        $barTrigger.style.pointerEvents = '';
        $barTrigger.style.height = '';
      }
      if ($overlayBar) {
        $overlayBar.style.display = '';
      }
      if ($iframe) {
        $iframe.style.pointerEvents = '';
      }
    } catch (e) {}
    $loadingOverlay.classList.remove("show");
    $orientHint.classList.remove("show");
    $pauseOverlay.classList.remove("show");
    unlockOrientation();
    if (document.fullscreenElement) {
      document
        .exitFullscreen()
        .then(() => {
          finishCloseGame();
        })
        .catch(() => {
          finishCloseGame();
        });
    } else {
      finishCloseGame();
    }
  }
  function finishCloseGame() {
    $overlay.classList.remove("open");
    $iframe.src = "about:blank";
    document.body.style.overflow = "";
    if (history.state && history.state.view === "game") history.back();
    /* refresh recent row */
    if (currentView === "home") renderRecentSection();
  }
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      gamePaused = false;
      $pauseOverlay.classList.remove("show");
      $overlay
        .requestFullscreen()
        .then(() => {
          if (isMobile && currentGameOrientation !== "both") {
            lockOrientation(currentGameOrientation);
          }
        })
        .catch(() => {});
    } else {
      userExitedFullscreen = true;
      document.exitFullscreen();
    }
  }
  function resumeFullscreen() {
    gamePaused = false;
    $pauseOverlay.classList.remove("show");
    $overlay
      .requestFullscreen()
      .then(() => {
        // Re-lock orientation if the game requires landscape/portrait
        if (isMobile && currentGameOrientation !== "both") {
          lockOrientation(currentGameOrientation);
        }
      })
      .catch(() => {});
    showBar(); // restart auto-hide timer
    // After resuming, re-enable passthrough if the current game requested it
    try {
      if (currentGame && currentGame.use_overlay_title === false) {
        $overlay.classList.add('overlay-pass-through');
        if ($barTrigger) { $barTrigger.style.pointerEvents = 'none'; $barTrigger.style.height = '0px'; }
        if ($overlayBar) { $overlayBar.style.display = 'none'; }
        if ($iframe) { $iframe.style.pointerEvents = 'auto'; }
      }
    } catch (e) {}
  }

  /* ---------- Fullscreen change → pause ---------- */
  document.addEventListener("fullscreenchange", () => {
    if (!$overlay.classList.contains("open")) return;
    if (!document.fullscreenElement) {
      // Exited fullscreen while game is open → show pause
      gamePaused = true;
      // Ensure the overlay accepts pointer events so pause buttons work
      try { $overlay.classList.remove('overlay-pass-through'); } catch (e) {}
      // Prevent iframe from capturing touches while paused
      try { if ($iframe) $iframe.style.pointerEvents = 'none'; } catch (e) {}
      $pauseOverlay.classList.add("show");
      showBar(); // keep bar visible during pause
    } else {
      gamePaused = false;
      $pauseOverlay.classList.remove("show");
      showBar(); // restart auto-hide timer after resume
      // Restore passthrough if the current game requested it
      try {
        if (currentGame && currentGame.use_overlay_title === false) {
          $overlay.classList.add('overlay-pass-through');
          if ($barTrigger) { $barTrigger.style.pointerEvents = 'none'; $barTrigger.style.height = '0px'; }
          if ($overlayBar) { $overlayBar.style.display = 'none'; }
          if ($iframe) { $iframe.style.pointerEvents = 'auto'; }
        }
      } catch (e) {}
    }
  });

  /* ---------- Back to top ---------- */
  function handleScroll() {
    const scrollY = $content.scrollTop || window.scrollY;
    $backToTop.classList.toggle("show", scrollY > 400);
  }

  /* ---------- Events ---------- */
  if ($menuBtn) $menuBtn.addEventListener("click", () =>
    $sidebar.classList.contains("open") ? closeSidebar() : openSidebar(),
  );
  if ($sidebarOverlay) $sidebarOverlay.addEventListener("click", closeSidebar);
  if ($overlayBack) $overlayBack.addEventListener("click", closeGame);
  if ($overlayFs) $overlayFs.addEventListener("click", toggleFullscreen);
  if ($pauseResume) $pauseResume.addEventListener("click", resumeFullscreen);
  if ($pauseQuit) $pauseQuit.addEventListener("click", closeGame);
  if ($clearRecent) $clearRecent.addEventListener("click", clearRecent);
  if ($backToTop) $backToTop.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" }),
  );
  if ($shuffleBtn) $shuffleBtn.addEventListener("click", () => {
    if (!allGames.length) return;
    const g = allGames[(Math.random() * allGames.length) | 0];
    showDetail(g);
  });

  /* ---------- Mobile bottom navigation ---------- */
  const $bnavHome = $("bnav-home");
  const $bnavSearch = $("bnav-search");
  const $bnavRandom = $("bnav-random");
  const $bnavMenu = $("bnav-menu");
  const $bnavFavs = $("bnav-favs");
  function updateBnavActive() {
    try {
      [$bnavHome, $bnavSearch, $bnavRandom, $bnavMenu, $bnavFavs].forEach(b => b && b.classList.remove('active'));
      if (currentView === 'search' && $bnavSearch) $bnavSearch.classList.add('active');
      else if (currentView === 'favorites' && $bnavFavs) $bnavFavs.classList.add('active');
      else if (currentView === 'home' && $bnavHome) $bnavHome.classList.add('active');
    } catch (e) {}
  }
  if ($bnavHome) $bnavHome.addEventListener('click', () => {
    $searchInput.value = ''; _lastSearchQuery = '';
    clearTimeout(_searchDebounceTimer);
    showHome(); updateBnavActive();
  });
  if ($bnavSearch) $bnavSearch.addEventListener('click', () => {
    try { $searchInput.focus(); $searchInput.select(); } catch(e) {}
    updateBnavActive();
  });
  if ($bnavRandom) $bnavRandom.addEventListener('click', () => {
    if (!allGames.length) return;
    const g = allGames[(Math.random() * allGames.length) | 0];
    showDetail(g);
  });
  if ($bnavMenu) $bnavMenu.addEventListener('click', () => {
    $sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    updateBnavActive();
  });
  if ($bnavFavs) $bnavFavs.addEventListener('click', () => {
    showFavorites();
  });

  /* detail interstitial */
  if ($detailPlay) $detailPlay.addEventListener("click", () => {
    if (pendingGame) openGame(pendingGame);
  });
  if ($detailClose) $detailClose.addEventListener("click", hideDetail);
  if ($detailBackdrop) $detailBackdrop.addEventListener("click", hideDetail);

  // Sidebar focus guard: while the user is in search view, any nav-item in the
  // sidebar must NOT steal focus from the search input. This covers ALL sources
  // (programmatic focus, browser auto-focus on aria-current, etc.) because it
  // reacts to the focusin event itself rather than trying to prevent each cause.
  if ($sidebarNav) {
    $sidebarNav.addEventListener("focusin", (e) => {
      if (currentView === "search" && e.target && e.target.classList.contains("nav-item")) {
        requestAnimationFrame(() => {
          if (currentView === "search") {
            try { $searchInput.focus(); } catch (_) {}
          }
        });
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (gamePaused && $pauseOverlay.classList.contains("show")) {
        closeGame();
        return;
      }
      if ($overlay.classList.contains("open")) {
        closeGame();
        return;
      }
      if ($detail.classList.contains("open")) {
        hideDetail();
        return;
      }
      if ($sidebar.classList.contains("open")) {
        closeSidebar();
        return;
      }
    }
  });

  /* search
   * Call showSearch directly and synchronously.
   * - No setTimeout/rAF: eliminates any async window where showHome() can run
   * - Stores last query so it can be restored after init completes
   */
  let _lastSearchQuery = '';
  let _searchKbIdx = -1;
  let _searchDebounceTimer = null;
  $searchInput.addEventListener("input", () => {
    const q = $searchInput.value;
    _lastSearchQuery = q;
    clearTimeout(_searchDebounceTimer);
    const dropdown = document.getElementById('search-history-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    _searchDebounceTimer = setTimeout(() => showSearch(q), 180);
  });
  $searchInput.addEventListener('focus', () => {
    if (!$searchInput.value.trim()) renderSearchHistoryDropdown();
  });
  $searchInput.addEventListener('blur', () => {
    setTimeout(() => {
      const dropdown = document.getElementById('search-history-dropdown');
      if (dropdown) dropdown.style.display = 'none';
    }, 160);
  });

  // On mobile, pressing the keyboard "Go/Search" button fires a 'search' event
  // and some browsers (iOS Safari, some Android) then CLEAR the input value.
  // Intercept this: persist the query, run the search, and prevent default clearing.
  $searchInput.addEventListener("search", (e) => {
    const q = $searchInput.value || _lastSearchQuery;
    if (q.trim()) {
      // Restore value in case browser already cleared it
      $searchInput.value = q;
      _lastSearchQuery = q;
      showSearch(q);
    } else {
      showHome();
    }
    e.preventDefault();
  });

  // Keyboard navigation: ↑↓ through search results, Escape to clear
  $searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $searchInput.value = '';
      _lastSearchQuery = '';
      clearTimeout(_searchDebounceTimer);
      showHome();
      return;
    }
    if (currentView !== 'search') return;
    const cards = Array.from($searchGrid.querySelectorAll('.game-card'));
    if (!cards.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _searchKbIdx = Math.min(_searchKbIdx + 1, cards.length - 1);
      cards[_searchKbIdx].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _searchKbIdx--;
      if (_searchKbIdx < 0) { _searchKbIdx = -1; $searchInput.focus(); }
      else cards[_searchKbIdx].focus();
    }
  });

  // Prevent tapping search result cards from stealing focus from the input.
  // pointerdown fires before blur/focus transfer; preventDefault() blocks the
  // implicit blur while still allowing the click to fire normally.
  if ($searchResults) {
    $searchResults.addEventListener("pointerdown", (e) => {
      if (document.activeElement === $searchInput) e.preventDefault();
    });
  }

  /* scroll */
  window.addEventListener("scroll", handleScroll, { passive: true });

  /* popstate */
  window.addEventListener("popstate", (e) => {
    if ($overlay.classList.contains("open")) {
      $overlay.classList.remove("open");
      $iframe.src = "about:blank";
      document.body.style.overflow = "";
      if (currentView === "home") renderRecentSection();
      return;
    }
    const st = e.state;
    if (st && st.view === "category") showCategory(st.tag, st.page || 1);
    else showHome();
  });

  /* Ensure hash-based navigation keeps footer pinned (fixes direct/hash navigation on mobile) */
  window.addEventListener('hashchange', () => {
    const h = (location.hash || '').replace('#', '');
    if (h && TAG_META[h]) {
      showCategory(h);
    } else if (!h) {
      showHome();
    }
  });

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    console.log('[route] DOMContentLoaded fired');
    // Ensure DOM refs are available
    $overlay = document.getElementById("game-overlay");
    $overlayTitle = document.getElementById("overlay-title");
    $overlayBar = document.getElementById("overlay-bar");
    $barTrigger = document.getElementById("bar-trigger");
    $overlayBack = document.getElementById("overlay-back");
    $overlayFs = document.getElementById("overlay-fs");
    // Detail interstitial refs
    $detail = document.getElementById("game-detail");
    $detailImg = document.getElementById("detail-img");
    $detailTitle = document.getElementById("detail-title");
    $detailTags = document.getElementById("detail-tags");
    $detailPlay = document.getElementById("detail-play");
    $detailDesc = document.getElementById("detail-desc");
    $detailClose = document.getElementById("detail-close");
    $detailBackdrop = document.getElementById("detail-backdrop");
    $detailFavBtn = document.getElementById("detail-fav");
    $detailRelated = document.getElementById("detail-related");
    $shareTw   = document.getElementById('share-tw');
    $shareFb   = document.getElementById('share-fb');
    $shareCopy = document.getElementById('share-copy');
    $detailBlogRow  = document.getElementById('detail-blog-row');
    $detailBlogLink = document.getElementById('detail-blog-link');
    if ($shareCopy) {
      $shareCopy.addEventListener('click', function() {
        const url = $shareCopy.dataset.url || location.href;
        if (navigator.share) {
          navigator.share({ url: url }).catch(function(){});
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function() {
            $shareCopy.classList.add('copied');
            setTimeout(function(){ $shareCopy.classList.remove('copied'); }, 1500);
          }).catch(function(){});
        } else {
          try {
            const ta = document.createElement('textarea');
            ta.value = url; ta.style.position='fixed'; ta.style.opacity='0';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            $shareCopy.classList.add('copied');
            setTimeout(function(){ $shareCopy.classList.remove('copied'); }, 1500);
          } catch(e){}
        }
      });
    }

    // Attach overlay listeners now that refs exist
    if ($barTrigger) {
      $barTrigger.addEventListener("mouseenter", showBar);
      $barTrigger.addEventListener("touchstart", showBar, { passive: true });
    }
    if ($overlay) {
      $overlay.addEventListener("mousemove", () => {
        if ($overlayBar && $overlayBar.classList.contains("bar-hidden") && currentGame && currentGame.use_overlay_title !== false) {
          showBar();
        }
      });
    }

    // Intercept clicks on tag-related anchors and pagination links so the
    // SPA handles navigation dynamically (prevents full-page navigation to
    // any static pages emitted in `dist/`). Honor modifier keys and
    // external links — only intercept same-origin tag links.
    document.addEventListener('click', (ev) => {
      try {
        // Respect user intent for new tab / download / modifier keys
        if (ev.defaultPrevented) return;
        if (ev.button && ev.button !== 0) return; // only left-click
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

        const a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
        if (!a || !a.href) return;

        // Only intercept same-origin links
        const url = new URL(a.href, location.origin);
        if (url.origin !== location.origin) return;

        // Match tag base: /tag/{tag}/ (optionally trailing slash)
        const tagMatch = url.pathname.match(/^\/tag\/([^\/]+)\/?$/i);
        if (tagMatch) {
          ev.preventDefault();
          const tagKey = tagMatch[1].toLowerCase();
          const pageNum = parseInt(url.searchParams.get('page') || a.dataset.page || '1', 10) || 1;
          showCategory(tagKey, pageNum);
          return;
        }

        // Fallback: handle pagination controls nested inside .pagination-nav
        const pag = a.closest && a.closest('.pagination-nav');
        if (pag) {
          const m = url.pathname.match(/^\/tag\/([^\/]+)\//i);
          if (!m) return; // not a tag pagination link
          ev.preventDefault();
          const tagKey = m[1].toLowerCase();
          const pageNum = parseInt(url.searchParams.get('page') || a.dataset.page || '1', 10) || 1;
          showCategory(tagKey, pageNum);
          return;
        }
      } catch (e) {
        /* ignore and allow default navigation on error */
      }
    }, { passive: false });

    // If this document contains the dynamic game sections area (index/category view),
    // ensure the footer is pinned to the viewport and spacer/measurements are applied.
    try{
      if (document.getElementById('game-sections')){
        if (document && document.body) {
          document.body.classList.add('full-bleed-footer');
          document.body.classList.remove('footer-hidden');
        }
        try{ ensureFooterSpacer(); }catch(e){}
          try{ if(window.footerMeasure && typeof window.footerMeasure.update === 'function') window.footerMeasure.update(); }catch(e){}

        // Enforce fixed footer at runtime for non-static pages so it behaves like the topbar
        const enforceFixedFooter = ()=>{
          try{
            const footer = document.querySelector('.site-footer');
            if(!footer) return;
            let isStatic = document.body && document.body.classList && document.body.classList.contains('static-page');
            const pinnedPages = ['about-page','privacy-page','terms-page','contact-page','dmca-page'];
            if (document.body && document.body.classList) {
              for (const c of pinnedPages) {
                if (document.body.classList.contains(c)) {
                  isStatic = false;
                  break;
                }
              }
            }

            // If already pinned, avoid re-appending or re-flowing unless necessary
            const alreadyPinned = footer.dataset && footer.dataset.poki2Pinned === '1';

            if(!isStatic){
              // move footer to body once if needed
              if(!alreadyPinned && footer.parentNode !== document.body){
                document.body.appendChild(footer);
              }

              // apply fixed positioning styles (idempotent)
              footer.style.position = 'fixed';
              footer.style.left = '0';
              footer.style.right = '0';
              footer.style.bottom = '0';
              footer.style.width = '100%';
              footer.style.boxSizing = 'border-box';
              footer.style.transform = 'none';
              footer.style.zIndex = '1200';

              // compute measured height and set CSS vars (do NOT set body.paddingBottom to avoid layout feedback loops)
              const h = Math.max(0, footer.offsetHeight || 0);
              try{ document.documentElement.style.setProperty('--measured-footer', h + 'px'); }catch(e){}
              try{ document.documentElement.style.setProperty('--footer-h', 'calc(' + h + 'px + env(safe-area-inset-bottom, 0px))'); }catch(e){}

              // mark pinned so subsequent calls are no-ops for append/DOM moves
              try{ footer.dataset.poki2Pinned = '1'; }catch(e){}
            }else{
              // static pages: remove forced styles
              footer.style.position = '';
              footer.style.left = '';
              footer.style.right = '';
              footer.style.bottom = '';
              footer.style.width = '';
              footer.style.boxSizing = '';
              footer.style.transform = '';
              footer.style.zIndex = '';
              try{ delete footer.dataset.poki2Pinned; }catch(e){}
            }
          }catch(e){}
        };
        // Run now and on resize/orientationchange
        try{ enforceFixedFooter(); }catch(e){}
        try{ window.addEventListener('resize', enforceFixedFooter, { passive: true }); }catch(e){}
        try{ window.addEventListener('orientationchange', ()=> setTimeout(enforceFixedFooter, 120)); }catch(e){}
      }
    }catch(e){}

    // Debug: log touch/pointer events to console when enabled
    if (DEBUG_TOUCH) {
      const formatTouches = (ev) => {
        if (ev.touches && ev.touches.length) return Array.from(ev.touches).map(t => `${t.clientX},${t.clientY}`).join(' | ');
        if (ev.changedTouches && ev.changedTouches.length) return Array.from(ev.changedTouches).map(t => `${t.clientX},${t.clientY}`).join(' | ');
        return `${ev.clientX || 0},${ev.clientY || 0}`;
      };
      const logEv = (scope) => (ev) => {
        try {
          console.log('[TOUCH]', ev.type, 'scope=', scope, 'target=', ev.target && (ev.target.id || ev.target.className || ev.target.tagName), 'coords=', formatTouches(ev), 'overlay-pass-through=', $overlay && $overlay.classList && $overlay.classList.contains('overlay-pass-through'));
        } catch (e) { console.log('[TOUCH] log error', e); }
      };

      const events = ['touchstart','touchmove','touchend','pointerdown','pointermove','pointerup','click'];
      // listen on document (capture) and on overlay element and iframe element
      events.forEach(evt => {
        document.addEventListener(evt, logEv('document'), { passive: true, capture: true });
        if ($overlay) $overlay.addEventListener(evt, logEv('overlay'), { passive: true, capture: true });
        if ($iframe) $iframe.addEventListener(evt, logEv('iframe-element'), { passive: true, capture: true });
      });

      console.log('[DEBUG] touch logging enabled — use ?debug-touch or set localStorage.debug-touch = "1"');
    }

    // Attach detail interstitial listeners
    if ($detailPlay) $detailPlay.addEventListener("click", () => { if (pendingGame) openGame(pendingGame); });
    if ($detailFavBtn) $detailFavBtn.addEventListener('click', () => {
      if (!pendingGame) return;
      toggleFav(pendingGame.link);
      const faved = isFav(pendingGame.link);
      $detailFavBtn.classList.toggle('fav-active', faved);
      const favText = document.getElementById('detail-fav-text');
      if (favText) favText.textContent = faved ? 'Saved' : 'Favorite';
      // sync all cards on screen
      document.querySelectorAll(`.game-card[data-link="${pendingGame.link}"] .fav-btn`).forEach(b => {
        b.classList.toggle('faved', faved);
        b.setAttribute('aria-label', faved ? 'Remove from favorites' : 'Add to favorites');
      });
    });
    if ($detailClose) $detailClose.addEventListener("click", hideDetail);
    if ($detailBackdrop) $detailBackdrop.addEventListener("click", hideDetail);

    await loadGames();
    // Expose rawGames for interactive debugging in the console
    try {
      window.__RAW_GAMES = rawGames;
      console.log('[route] rawGames loaded:', rawGames.length);
    } catch (e) {
      /* ignore */
    }
    // Inject ItemList structured data for Google rich results
    try { injectItemListSchema(allGames); } catch (e) {}

    // Footer measurement & dynamic CSS variable so page content reserves exact footer height
    try {
      const $siteFooter = document.querySelector('.site-footer');
      const setMeasuredFooter = (px) => {
        try {
          document.documentElement.style.setProperty('--measured-footer', px + 'px');
        } catch (e) {}
      };

      const updateFooterHeight = () => {
        try {
          if ($siteFooter) {
            const h = Math.max(0, $siteFooter.offsetHeight || 0);
            setMeasuredFooter(h);
          } else {
            // fallback to base
            const base = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--footer-base')) || 160;
            setMeasuredFooter(base);
          }
        } catch (e) {
          /* ignore */
        }
      };

      // initial measure
      updateFooterHeight();

      // Keep updated on resize / orientation / visibility
      window.addEventListener('resize', () => updateFooterHeight(), { passive: true });
      window.addEventListener('orientationchange', () => setTimeout(updateFooterHeight, 150));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') updateFooterHeight();
      });

      // Use ResizeObserver to detect footer content changes (consent banner, translations, etc.)
      if (window.ResizeObserver && $siteFooter) {
        const ro = new ResizeObserver(() => updateFooterHeight());
        ro.observe($siteFooter);
      }
    } catch (e) {
      /* ignore */
    }
    $skeleton.style.display = "none";
    buildSidebar();
    renderHeroFeatured();
    renderTagChips();

    const search = (location.search || "").replace("?", "");
    const searchParams = new URLSearchParams(location.search || '');
    const hash = location.hash.replace("#", "");
    // Support path-style routing: /games/<slug>/ should open that game directly.
    // This complements query/hash routing and ensures direct links work.
    const pathMatch = (location.pathname || '').match(/^\/games\/([^\/]+)\/??$/i);
    // /game/{char}/{slug}/ → per-game SEO page: auto-open the detail modal (not the iframe)
    const gamePageMatch = (location.pathname || '').match(/^\/game\/[^\/]+\/([^\/]+)\/?$/i);
    // /tag/{tag}/ → canonical tag page, with optional ?page=N handled client-side
    const tagPageMatch = (location.pathname || '').match(/^\/tag\/([^\/]+)\/?$/i);
    console.log('[route] init search/hash:', { search, hash });

    // Prefer query param routing (e.g. https://poki2.online/?play-vex5)
    if (search && search.startsWith("play-")) {
      const slug = search.slice(5);
      console.log('[route] detected play in search, slug:', slug);
      const game = rawGames.find((g) => normalizeHref(g.link) === slug);
      console.log('[route] game lookup result (search):', !!game, game && game.title);
      if (game) {
        showDetail(game);
      } else {
        console.warn('[route] no matching game for slug (search):', slug);
        showHome();
      }
    } else if (hash && TAG_META[hash]) {
      console.log('[route] detected category hash:', hash);
      showCategory(hash);
    } else if (hash && hash.startsWith("play-")) {
      const slug = hash.slice(5);
      console.log('[route] detected play hash, slug:', slug);
      const game = rawGames.find((g) => normalizeHref(g.link) === slug);
      console.log('[route] game lookup result (hash):', !!game, game && game.title);
      if (game) {
        showDetail(game);
      } else {
        console.warn('[route] no matching game for slug (hash):', slug);
        showHome();
      }
    } else if (tagPageMatch && tagPageMatch[1]) {
      // /tag/{tag}/ + optional ?page=N — tag category page
      const tagKey = tagPageMatch[1].toLowerCase();
      const tagPage = parseInt(searchParams.get('page') || '1', 10) || 1;
      console.log('[route] detected tag page:', tagKey, 'page', tagPage);
      showCategory(tagKey, tagPage);
    } else if (gamePageMatch && gamePageMatch[1]) {
      // /game/{slug}/ — SEO per-game page: open detail modal so OG meta is visible + interactive
      const slug = gamePageMatch[1];
      console.log('[route] detected game detail page, slug:', slug);
      const game = rawGames.find((g) => normalizeHref(g.link) === slug);
      if (game) {
        showHome(); // render the home grid beneath the modal
        showDetail(game);
      } else {
        console.warn('[route] no matching game for slug (game page):', slug);
        showHome();
      }
    } else {
      // If path-style matched earlier, it will open the game; otherwise show home
      if (pathMatch && pathMatch[1]) {
        const slug = pathMatch[1];
        console.log('[route] detected play via path, slug:', slug);
        const game = rawGames.find((g) => normalizeHref(g.link) === slug);
        console.log('[route] game lookup result (path):', !!game, game && game.title);
        if (game) {
          // Open game immediately for direct path links
          openGame(game);
        } else {
          console.warn('[route] no matching game for slug (path):', slug);
          showHome();
        }
      } else {
        console.log('[route] no route, showing home');
        showHome();
      }
    }

    // Defensive: if the initial URL hash is a category, ensure the body
    // has the pinned-footer class — covers hash-only navigations and
    // mitigates cases where the class could be removed later.
    try {
      const initialHash = (location.hash || '').replace('#', '');
      if (initialHash && TAG_META[initialHash]) document.body.classList.add('full-bleed-footer');

      // Android Chrome workaround: reflow the footer on viewport changes
      // to avoid cases where the bottom UI (address/gesture bar) hides the
      // fixed footer or changes viewport height unexpectedly.
      const isAndroidChrome = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent) && /Chrome\/\d+/.test(navigator.userAgent) && !/OPR|SamsungBrowser|Edg\//.test(navigator.userAgent);
      if (isAndroidChrome) {
        const __ac_debounce = (fn, ms) => {
          let t = null;
          return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
          };
        };

        const reflowFooter = () => {
          try {
            if (document && document.body && document.body.classList.contains('full-bleed-footer')) {
              document.body.classList.remove('full-bleed-footer');
              // force reflow
              void document.body.offsetHeight;
              document.body.classList.add('full-bleed-footer');
            }
          } catch (e) {
            /* ignore */
          }
        };

        window.addEventListener('resize', __ac_debounce(reflowFooter, 150), { passive: true });
        window.addEventListener('orientationchange', __ac_debounce(reflowFooter, 150));
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reflowFooter();
        });
      }
    } catch (e) {
      /* ignore */
    }

    // Repair: if the user typed a query while init/loadGames() was running,
    // showHome() may have been called between the async steps and overridden
    // the search view. Restore it now that all games are loaded.
    if (_lastSearchQuery.trim() && currentView !== 'search') {
      showSearch(_lastSearchQuery);
    }
    // If search is active, restore focus to input (may have been stolen by
    // buildSidebar DOM mutations or footer measurement reflows).
    if (currentView === 'search') {
      try { $searchInput.focus(); } catch (_) {}
    }

    // Remove early-hide class now that the correct view is rendered
    document.documentElement.classList.remove("route-loading");
  });

  // Register Service Worker for PWA functionality
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('[SW] Registered successfully:', registration.scope);

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available — prompt no more than once per period
                  try {
                    const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
                    const key = 'sw-last-prompt';
                    const last = parseInt(localStorage.getItem(key) || '0', 10) || 0;
                    const now = Date.now();
                    // Only prompt if enough time has passed and page is visible
                    if (document.visibilityState === 'visible' && (now - last) > COOLDOWN_MS) {
                      // record prompt time immediately to avoid duplicate prompts from other tabs
                      localStorage.setItem(key, String(now));
                      // show a non-modal update banner with actions when DOM is ready and page visible
                      scheduleUpdateBanner(newWorker);
                    }
                  } catch (e) {
                    // If storage access fails, still schedule the banner (no modal fallback)
                    scheduleUpdateBanner(newWorker);
                  }
                }
              });
            }
          });
        })
        .catch(error => {
          console.error('[SW] Registration failed:', error);
        });
    });
  }
})();

/* Helper: show a non-modal update banner with Reload and Dismiss actions */
function showUpdateBanner(newWorker) {
  try {
    if (document.getElementById('sw-update-banner')) return; // already shown
    const banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    banner.style.position = 'fixed';
    banner.style.left = '16px';
    banner.style.right = '16px';
    banner.style.bottom = '16px';
    banner.style.zIndex = '1600';
    banner.style.display = 'flex';
    banner.style.alignItems = 'center';
    banner.style.justifyContent = 'space-between';
    banner.style.padding = '12px 14px';
    banner.style.background = 'linear-gradient(180deg,#ffffff,#fbfdff)';
    banner.style.border = '1px solid rgba(15,23,42,0.06)';
    banner.style.borderRadius = '10px';
    banner.style.boxShadow = '0 8px 30px rgba(12,20,40,0.12)';
    banner.style.fontSize = '.95rem';
    banner.innerHTML = `<div style="flex:1;min-width:0;margin-right:12px;color:var(--text)">New version available — <strong>Reload</strong> to update.</div>`;

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const reloadBtn = document.createElement('button');
    reloadBtn.textContent = 'Reload';
    reloadBtn.style.padding = '8px 12px';
    reloadBtn.style.borderRadius = '8px';
    reloadBtn.style.border = '0';
    reloadBtn.style.background = 'var(--brand)';
    reloadBtn.style.color = '#fff';
    reloadBtn.style.fontWeight = '700';
    reloadBtn.addEventListener('click', () => {
      try { newWorker.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
      // Do not force a page reload here. Just dismiss the banner and record prompt time.
      try { localStorage.setItem('sw-last-prompt', String(Date.now())); } catch (e) {}
      try { banner.remove(); } catch (e) {}
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.style.padding = '8px 12px';
    dismissBtn.style.borderRadius = '8px';
    dismissBtn.style.border = '1px solid rgba(15,23,42,0.06)';
    dismissBtn.style.background = 'transparent';
    dismissBtn.addEventListener('click', () => {
      try { localStorage.setItem('sw-last-prompt', String(Date.now())); } catch (e) {}
      banner.remove();
    });

    actions.appendChild(dismissBtn);
    actions.appendChild(reloadBtn);
    banner.appendChild(actions);
    document.body.appendChild(banner);
  } catch (err) {
    // last resort: log and skip showing modal to avoid modal loops
    console.warn('Could not show update banner', err);
  }
}

function scheduleUpdateBanner(newWorker) {
  // If document is already ready and visible, show immediately
  if (document.readyState !== 'loading' && document.visibilityState === 'visible' && document.body) {
    try { showUpdateBanner(newWorker); } catch (e) { console.warn('scheduleUpdateBanner error', e); }
    return;
  }

  // Otherwise wait for DOM ready and visibility change. Use one-time listeners.
  const onReady = () => {
    if (document.visibilityState === 'visible' && document.body) {
      showUpdateBanner(newWorker);
      cleanup();
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible' && document.body) {
      showUpdateBanner(newWorker);
      cleanup();
    }
  };
  const cleanup = () => {
    document.removeEventListener('DOMContentLoaded', onReady);
    document.removeEventListener('visibilitychange', onVisibility);
    clearTimeout(timer);
  };
  document.addEventListener('DOMContentLoaded', onReady, { once: true });
  document.addEventListener('visibilitychange', onVisibility);
  // safety timeout: show banner after 10s even if visibility doesn't change
  const timer = setTimeout(() => { try { showUpdateBanner(newWorker); } catch (e) { console.warn(e); } }, 10000);
}

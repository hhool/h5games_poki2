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
    action: { emoji: "💥", label: "Action" },
    competitive: { emoji: "🏆", label: "Competitive" },
    idle: { emoji: "🕹️", label: "Idle" },
    puzzle: { emoji: "🧩", label: "Puzzle" },
    racing: { emoji: "🏎️", label: "Racing" },
    shooting: { emoji: "🔫", label: "Shooting" },
    sports: { emoji: "⚽", label: "Sports" },
    strategy: { emoji: "♟️", label: "Strategy" },
    other: { emoji: "🎲", label: "Other" },
  };

  const TAG_ORDER = [
    "action",
    "puzzle",
    "racing",
    "shooting",
    "sports",
    "competitive",
    "strategy",
    "idle",
    "other",
  ];
  const SECTION_LIMIT = 12;
  const HERO_FEATURED_COUNT = 6;
  const RECENT_KEY = "poki2_recent";
  const MAX_RECENT = 12;
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
  let $detailPlay = null;
  let $detailClose = null;
  let $detailBackdrop = null;
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

  /* ---------- Render helpers ---------- */
  function createCard(game) {
    const el = document.createElement("div");
    el.className = "game-card";

    const img = document.createElement("img");
    img.className = "game-card-img";
    img.alt = game.title || "";
    img.loading = "lazy";

    // Use optimized image loading with WebP support
    const imgSrc = game.imgSrc || getFaviconUrl(game.link);
    optimizeImageLoading(img, imgSrc);

    // attach a favicon fallback chain so missing icons resolve to site favicons
    attachFaviconFallback(img, game.link);

    const info = document.createElement("div");
    info.className = "game-card-info";
    const title = document.createElement("div");
    title.className = "game-card-title";
    title.textContent = game.title || "";
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

    const showAll = limit && games.length > limit;
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
    const picks = shuffle(allGames).slice(0, HERO_FEATURED_COUNT);
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
        const imgSrc = g.imgSrc || getFaviconUrl(g.link);
        optimizeImageLoading(himg, imgSrc);
        attachFaviconFallback(himg, g.link);
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

  /* ---------- Views ---------- */
  function showHome() {
    currentView = "home";
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
    $searchInput.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
    history.replaceState({ view: "home" }, "", location.pathname);
  }

  function showCategory(tag) {
    currentView = "category";
    // Update measured footer values before mutating layout to avoid visual jumps
    try { if (window.footerMeasure && typeof window.footerMeasure.update === 'function') window.footerMeasure.update(); } catch (e) {}
    // Ensure category pages pin the footer to viewport bottom
    if (document && document.body) document.body.classList.add('full-bleed-footer');
    $hero.style.display = "none";
    $recentSection.style.display = "none";
    $searchResults.style.display = "none";
    // Preserve current height to avoid layout jumps while swapping content
    try {
      const prevH = $gameSections.getBoundingClientRect().height || 0;
      if (prevH) $gameSections.style.minHeight = prevH + 'px';
    } catch (e) { /* ignore */ }

    $gameSections.innerHTML = `
      <section class="category-section">
        <div class="section-header">
          <h2 class="section-title"><span class="skeleton skeleton-text" style="width:120px;height:22px"></span></h2>
        </div>
        <div class="game-grid">
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
        </div>
      </section>
    `;
    $gameSections.style.display = "";
    $skeleton.style.display = "none";
    
    // Simulate loading delay for better UX
    setTimeout(() => {
      $gameSections.innerHTML = "";
      const sec = renderSection(tag, 0);
      if (sec) $gameSections.appendChild(sec);
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
    }, 200);
    
    highlightSidebarItem(tag);
    window.scrollTo({ top: 0, behavior: "smooth" });
    history.pushState({ view: "category", tag }, "", "#" + tag);
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
    
    // Show skeleton while loading
    $searchGrid.innerHTML = `
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    `;
    $searchEmpty.style.display = "none";
    
    // Simulate loading delay for better UX (optional)
    setTimeout(() => {
      $searchGrid.innerHTML = "";
      $searchEmpty.style.display = matched.length ? "none" : "";
      for (const g of matched) $searchGrid.appendChild(createCard(g));
    }, 300);
    
    highlightSidebarItem(null);
  }

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
      closeSidebar();
      showHome();
    });
    $sidebarNav.appendChild(homeItem);

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
    for (const el of $sidebarNav.querySelectorAll(".nav-item")) {
      const isActive = tag
        ? el.dataset.tag === tag
        : el.dataset.tag === "__home";
      el.classList.toggle("active", isActive);
      if (isActive) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
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

  /* ---------- Game detail interstitial ---------- */
  function showDetail(game) {
    pendingGame = game;
    $detailImg.src = game.imgSrc || getFaviconCandidates(game.link)[0];
    $detailImg.loading = "lazy";
    attachFaviconFallback($detailImg, game.link);
    $detailTitle.textContent = game.title;
    $detailTags.innerHTML = (game.tags || [])
      .map(
        (t) =>
          `<span class="detail-tag">${(TAG_META[t] || {}).emoji || "🎲"} ${(TAG_META[t] || {}).label || t}</span>`,
      )
      .join("");
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

    // Make detail interactive and trap input so underlying content doesn't receive events
    try {
      $detail.tabIndex = -1;
      $detail.classList.add("open");
      // focus the detail container to prevent keyboard events reaching iframe
      if (typeof $detail.focus === "function") $detail.focus();
      // disable pointer events and scrolling on main content while detail is open
      try { if ($content) { $content.style.pointerEvents = 'none'; $content.setAttribute('aria-hidden','true'); } } catch (e) {}
      try { document.body.style.overflow = 'hidden'; } catch (e) {}
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
    // remove listeners and restore
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

  /* detail interstitial */
  if ($detailPlay) $detailPlay.addEventListener("click", () => {
    if (pendingGame) openGame(pendingGame);
  });
  if ($detailClose) $detailClose.addEventListener("click", hideDetail);
  if ($detailBackdrop) $detailBackdrop.addEventListener("click", hideDetail);

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

  /* search */
  let searchTimer;
  $searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => showSearch($searchInput.value), 250);
  });

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
    if (st && st.view === "category") showCategory(st.tag);
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
    $detailClose = document.getElementById("detail-close");
    $detailBackdrop = document.getElementById("detail-backdrop");

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
            const isStatic = document.body && document.body.classList && document.body.classList.contains('static-page');
            // Treat these informational pages as pinned (like index/category) when requested
            // so About/Privacy/Terms/Contact/DMCA use the same fixed-footer behavior.
            const pinnedPages = ['about-page','privacy-page','terms-page','contact-page','dmca-page'];
            // If body has any pinned page class, override isStatic -> false
            if (document.body && document.body.classList) {
              for (const c of pinnedPages) {
                if (document.body.classList.contains(c)) {
                  // force pin
                  isStatic = false; // eslint-disable-line no-param-reassign
                  break;
                }
              }
            }
            if(!isStatic){
              // move footer to body if needed
              if(footer.parentNode !== document.body){
                document.body.appendChild(footer);
              }
              // apply fixed positioning styles directly to avoid CSS specificity races
              footer.style.position = 'fixed';
              footer.style.left = '0';
              footer.style.right = '0';
              footer.style.bottom = '0';
              footer.style.width = '100%';
              footer.style.boxSizing = 'border-box';
              footer.style.transform = 'none';
              footer.style.zIndex = '1200';

              // compute measured height and set CSS var + body padding to reserve space
              const h = Math.max(0, footer.offsetHeight || 0);
              try{ document.documentElement.style.setProperty('--measured-footer', h + 'px'); }catch(e){}
              try{ document.documentElement.style.setProperty('--footer-h', 'calc(' + h + 'px + env(safe-area-inset-bottom, 0px))'); }catch(e){}
              try{ document.body.style.paddingBottom = (h + 'px'); }catch(e){}
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
              try{ document.body.style.paddingBottom = ''; }catch(e){}
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

    const search = (location.search || "").replace("?", "");
    const hash = location.hash.replace("#", "");
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
    } else {
      console.log('[route] no route, showing home');
      showHome();
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
      // Wait for the new service worker to take control before reloading.
      // This avoids reloading too early and then seeing the update prompt again.
      let reloaded = false;
      const doReload = () => {
        if (reloaded) return;
        reloaded = true;
        try { window.location.reload(); } catch (e) { location.href = location.href; }
      };

      if (navigator.serviceWorker && typeof navigator.serviceWorker.addEventListener === 'function') {
        const onControllerChange = () => {
          try {
            navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
          } catch (e) {}
          doReload();
        };
        try {
          navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        } catch (e) {
          // fallback
          setTimeout(doReload, 500);
        }
        // safety fallback: force reload after 3s if controllerchange wasn't fired
        setTimeout(doReload, 3000);
      } else {
        // No SW API available — just reload quickly
        setTimeout(doReload, 50);
      }
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

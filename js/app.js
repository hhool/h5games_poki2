/* ============================================================
   Poki2 — App logic (enhanced)
   ============================================================ */

(() => {
  "use strict";

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
  const $overlay = $("game-overlay");
  const $overlayTitle = $("overlay-title");
  const $overlayBar = $("overlay-bar");
  const $barTrigger = $("bar-trigger");
  const $overlayBack = $("overlay-back");
  const $overlayFs = $("overlay-fs");

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
  $barTrigger.addEventListener("mouseenter", showBar);
  $barTrigger.addEventListener("touchstart", showBar, { passive: true });

  // Also show bar on mouse move anywhere in overlay (for desktop)
  $overlay.addEventListener("mousemove", () => {
    if ($overlayBar.classList.contains("bar-hidden") && currentGame && currentGame.use_overlay_title !== false) {
      showBar();
    }
  });
  const $iframe = $("game-iframe");
  const $content = $("content");
  const $skeleton = $("loading-skeleton");
  const $backToTop = $("back-to-top");
  const $shuffleBtn = $("shuffle-btn");
  const $detail = $("game-detail");
  const $detailImg = $("detail-img");
  const $detailTitle = $("detail-title");
  const $detailTags = $("detail-tags");
  const $detailPlay = $("detail-play");
  const $detailClose = $("detail-close");
  const $detailBackdrop = $("detail-backdrop");
  const $pauseOverlay = $("game-pause");
  const $pauseResume = $("pause-resume");
  const $pauseQuit = $("pause-quit");

  /* ---------- State ---------- */
  let allGames = [];
  let tagMap = {};
  let currentView = "home";
  let pendingGame = null; // game waiting in detail interstitial
  let gamePaused = false; // true when game is paused (exited fullscreen)
  let userExitedFullscreen = false; // track intentional exit vs close

  /* ---------- Helpers ---------- */
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
        allGames = await r.json();
        break;
      } catch {
        /* next */
      }
    }

    // Deduplicate entries by `link` (preferred) or normalized title to avoid
    // duplicate game objects causing repeated cards in category grids.
    const seen = new Set();
    allGames = (allGames || []).filter((g) => {
      const key = (g.link || g.title || "").toString().toLowerCase().trim();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // On mobile, filter out keyboard-only games
    allGames = allGames.filter(canShow);

    tagMap = {};
    for (const g of allGames) {
      // Normalize tags: ensure an array, lowercase canonicalization where appropriate,
      // and remove duplicate tag entries so a game isn't inserted multiple times
      // into the same category grid.
      const rawTags = Array.isArray(g.tags) ? g.tags : ["other"];
      const uniqueTags = Array.from(new Set(rawTags.map((t) => String(t).trim())));
      g.tags = uniqueTags.length ? uniqueTags : ["other"];
      for (const t of g.tags) {
        (tagMap[t] = tagMap[t] || []).push(g);
      }
    }
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
    const list = limit ? games.slice(0, limit) : games;
    for (const g of list) grid.appendChild(createCard(g));
    section.appendChild(grid);

    const btn = section.querySelector(".see-all");
    if (btn) btn.addEventListener("click", () => showCategory(tag));
    return section;
  }

  /* ---------- Hero featured ---------- */
  function renderHeroFeatured() {
    $heroFeatured.innerHTML = "";
    const picks = shuffle(allGames).slice(0, HERO_FEATURED_COUNT);
    for (const g of picks) {
      const card = document.createElement("div");
      card.className = "hero-card";
      const himg = document.createElement("img");
      himg.alt = g.title || "";
      himg.loading = "lazy";

      // Use optimized image loading with WebP support
      const imgSrc = g.imgSrc || getFaviconUrl(g.link);
      optimizeImageLoading(himg, imgSrc);

      attachFaviconFallback(himg, g.link);
      card.appendChild(himg);
      card.addEventListener("click", () => showDetail(g));
      $heroFeatured.appendChild(card);
    }
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
    for (const g of list) $recentGrid.appendChild(createCard(g));
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
    $hero.style.display = "none";
    $recentSection.style.display = "none";
    $searchResults.style.display = "none";
    $gameSections.innerHTML = "";
    $gameSections.style.display = "";
    $skeleton.style.display = "none";
    const sec = renderSection(tag, 0);
    if (sec) $gameSections.appendChild(sec);
    highlightSidebarItem(tag);
    window.scrollTo({ top: 0, behavior: "smooth" });
    history.pushState({ view: "category", tag }, "", "#" + tag);
  }

  function showSearch(query) {
    if (!query.trim()) {
      showHome();
      return;
    }
    currentView = "search";
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
    $searchGrid.innerHTML = "";
    $searchEmpty.style.display = matched.length ? "none" : "";
    for (const g of matched) $searchGrid.appendChild(createCard(g));
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
    $detail.classList.add("open");
  }
  function hideDetail() {
    $detail.classList.remove("open");
    pendingGame = null;
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
  $orientRotateBtn.addEventListener("click", () => {
    // If we're inside WeChat or the API is unavailable, offer a fallback:
    // copy link to clipboard so user can open in system browser.
    if (isWeChat || !(screen.orientation && screen.orientation.lock)) {
      const text = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            $orientText.textContent =
              "已复制页面链接，请在系统浏览器中打开以获得横屏/全屏体验。";
          })
          .catch(() => {
            $orientText.textContent =
              "请长按页面并选择在浏览器中打开，或手动复制链接打开。";
          });
      } else {
        $orientText.textContent =
          "请长按页面并选择在浏览器中打开，或手动复制链接打开。";
      }
      return;
    }
    lockOrientation(currentGameOrientation);
  });
  // Skip button: dismiss hint
  $orientSkipBtn.addEventListener("click", () => {
    $orientHint.classList.remove("show");
  });

  function openGame(game) {
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
      showBar();
    }

    $overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    gamePaused = false;
    userExitedFullscreen = false;
    $pauseOverlay.classList.remove("show");
    history.pushState(
      { view: "game", link: game.link, title: game.title },
      "",
      "#play-" + normalizeHref(game.link),
    );

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
  $iframe.addEventListener("load", () => {
    if ($iframe.src !== "about:blank") {
      finishLoadingProgress();
    }
  });
  function closeGame() {
    currentGame = null;
    gamePaused = false;
    userExitedFullscreen = false;
    clearInterval(loadingTimer);
    clearTimeout(barHideTimer);
    $overlayBar.classList.remove("bar-hidden");
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
  }

  /* ---------- Fullscreen change → pause ---------- */
  document.addEventListener("fullscreenchange", () => {
    if (!$overlay.classList.contains("open")) return;
    if (!document.fullscreenElement) {
      // Exited fullscreen while game is open → show pause
      gamePaused = true;
      $pauseOverlay.classList.add("show");
      showBar(); // keep bar visible during pause
    } else {
      gamePaused = false;
      $pauseOverlay.classList.remove("show");
      showBar(); // restart auto-hide timer after resume
    }
  });

  /* ---------- Back to top ---------- */
  function handleScroll() {
    const scrollY = $content.scrollTop || window.scrollY;
    $backToTop.classList.toggle("show", scrollY > 400);
  }

  /* ---------- Events ---------- */
  $menuBtn.addEventListener("click", () =>
    $sidebar.classList.contains("open") ? closeSidebar() : openSidebar(),
  );
  $sidebarOverlay.addEventListener("click", closeSidebar);
  $overlayBack.addEventListener("click", closeGame);
  $overlayFs.addEventListener("click", toggleFullscreen);
  $pauseResume.addEventListener("click", resumeFullscreen);
  $pauseQuit.addEventListener("click", closeGame);
  $clearRecent.addEventListener("click", clearRecent);
  $backToTop.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" }),
  );
  $shuffleBtn.addEventListener("click", () => {
    if (!allGames.length) return;
    const g = allGames[(Math.random() * allGames.length) | 0];
    showDetail(g);
  });

  /* detail interstitial */
  $detailPlay.addEventListener("click", () => {
    if (pendingGame) openGame(pendingGame);
  });
  $detailClose.addEventListener("click", hideDetail);
  $detailBackdrop.addEventListener("click", hideDetail);

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

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    await loadGames();
    $skeleton.style.display = "none";
    buildSidebar();
    renderHeroFeatured();

    const hash = location.hash.replace("#", "");
    if (hash && TAG_META[hash]) {
      showCategory(hash);
    } else {
      showHome();
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
                  // New version available
                  if (confirm('New version available! Reload to update?')) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                    window.location.reload();
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

/* ==========================================================================
 * app.js — window-manager shell
 * free-form windows: ghost drag (8px snap) · resize grip · dbl-click collapse
 * z-raise on focus · debounced localStorage persistence · keyboard shortcuts
 * ======================================================================== */
(function () {
  "use strict";

  var LAYOUT_KEY = "tmd.layout.v3";
  var SCAN_KEY = "tmd.scan";
  var SNAP = 8;
  var GAP = 10;

  /* default mosaic in 6-col grid units: [col, row, spanCols, heightPx] */
  var CARDS = [
    { id: "ticker",   num: "01", title: "GLOBAL TICKER",                    widget: "ticker",   g: [0, 0, 6, 400] },
    { id: "heatmap",  num: "02", title: "STOCK TRACKING · AI/TECH — ENERGY — FINANCIALS", widget: "heatmap", g: [0, 1, 4, 570] },
    { id: "breadth",  num: "03", title: "MARKET BREADTH · FILTERED UNIVERSE", widget: "breadth", g: [4, 1, 2, 570] },
    { id: "sector",   num: "04", title: "SECTOR INTRADAY · NORMALIZED",     widget: "sector",   g: [0, 2, 3, 470] },
    { id: "news",     num: "05", title: "NEWS WIRE",                        widget: "news",     g: [3, 2, 3, 470] },
    { id: "aapl",     num: "06", title: "AAPL · 60 TRADING SESSIONS",       widget: "aapl",     g: [0, 3, 4, 520] },
    { id: "metals",   num: "07", title: "PRECIOUS METALS MONITOR",          widget: "metals",   g: [4, 3, 2, 520] },
    { id: "pulse",    num: "08", title: "MARKET PULSE · GLOBAL SESSION CLOCK", widget: "pulse", g: [0, 4, 3, 500] },
    { id: "indexmap", num: "09", title: "GLOBAL INDEX MAP · BY REGION",     widget: "indexMap", g: [3, 4, 3, 500] },
    { id: "worldmap", num: "10", title: "WORLD MAP · VENUE SESSIONS",       widget: "worldmap", g: [0, 5, 3, 460] },
    { id: "connections", num: "11", title: "CONNECTED COMPANIES · SUPPLY WEB", widget: "connections", g: [3, 5, 3, 460] },
    { id: "sectors",  num: "12", title: "SECTOR DRILL · SUB-INDUSTRIES",    widget: "sectors",  g: [0, 6, 2, 470] },
    { id: "ipo",      num: "13", title: "IPO PIPELINE · NEXT 90 DAYS",      widget: "ipo",      g: [2, 6, 2, 470] },
    { id: "lists",    num: "14", title: "CUSTOM LISTS · WATCHLISTS",        widget: "lists",    g: [4, 6, 2, 470] },
    { id: "aichat",   num: "15", title: "AI COPILOT · BRING YOUR OWN KEY",  widget: "aichat",   g: [0, 7, 6, 520] },
    { id: "strategy", num: "16", title: "STRATEGY LAB · BUILD + BACKTEST",  widget: "strategy", g: [0, 8, 4, 560] },
    { id: "positions", num: "17", title: "POSITIONS · BOOK TRACKER",        widget: "positions", g: [4, 8, 2, 560] }
  ];

  var md = new window.MarketData();
  var canvas = document.getElementById("canvas");
  var modeBtn = document.getElementById("mode-toggle");
  var resetBtn = document.getElementById("layout-reset");
  var scanBtn = document.getElementById("scan-toggle");
  var statusDot = document.getElementById("status-dot");
  var statusText = document.getElementById("status-text");
  var utcClock = document.getElementById("utc-clock");
  var tapeTrack = document.getElementById("tape-track");
  var zTop = 10;

  function snap8(v) { return Math.round(v / SNAP) * SNAP; }

  /* ---------- persistence (debounced) ---------------------------------------- */
  var saveTimer = null;
  function saveLayout() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        var rects = {};
        Array.prototype.forEach.call(canvas.querySelectorAll(".card"), function (c) {
          rects[c.dataset.id] = {
            x: parseInt(c.style.left, 10) || 0,
            y: parseInt(c.style.top, 10) || 0,
            w: c.offsetWidth,
            h: c.classList.contains("collapsed") ? (parseInt(c.dataset.h, 10) || c.offsetHeight) : c.offsetHeight,
            c: c.classList.contains("collapsed") ? 1 : 0,
            z: parseInt(c.style.zIndex, 10) || 1
          };
        });
        localStorage.setItem(LAYOUT_KEY, JSON.stringify({
          rects: rects, zTop: zTop, mode: md.mode, cw: canvas.clientWidth
        }));
      } catch (e) { /* layout simply won't persist */ }
      if (window.Cloud) { Cloud.schedulePresetPush(); }
    }, 300);
  }
  function loadLayout() {
    try {
      var raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) { return null; }
      var p = JSON.parse(raw);
      return p && p.rects ? p : null;
    } catch (e) { return null; }
  }

  /* ---------- default geometry ------------------------------------------------- */
  function defaultRects() {
    var W = canvas.clientWidth || 1200;
    var single = W < 760;
    var colW = (W - GAP * 5) / 6;
    var rows = [400, 570, 470, 520, 500, 460, 470, 520, 560];
    var rowY = [0];
    for (var i = 1; i < rows.length; i++) {
      rowY[i] = rowY[i - 1] + rows[i - 1] + GAP;
    }
    var rects = {};
    var stackY = 0;
    CARDS.forEach(function (c) {
      if (single) {
        rects[c.id] = { x: 0, y: stackY, w: W, h: c.g[3], c: 0, z: 1 };
        stackY += c.g[3] + GAP;
      } else {
        rects[c.id] = {
          x: snap8(c.g[0] * (colW + GAP)),
          y: rowY[c.g[1]],
          w: Math.round(c.g[2] * colW + (c.g[2] - 1) * GAP),
          h: c.g[3], c: 0, z: 1
        };
      }
    });
    return rects;
  }

  /* ---------- card construction --------------------------------------------------- */
  function buildCard(cfg, r) {
    var card = document.createElement("section");
    card.className = "card glass";
    card.dataset.id = cfg.id;
    card.style.left = r.x + "px";
    card.style.top = r.y + "px";
    card.style.width = r.w + "px";
    card.style.height = r.h + "px";
    card.style.zIndex = String(r.z || 1);
    if (r.c) {
      card.classList.add("collapsed");
      card.dataset.h = String(r.h);
    }

    var head = document.createElement("header");
    head.className = "card-head";
    var left = document.createElement("div");
    left.className = "card-title";
    var grip = document.createElement("span");
    grip.className = "grip";
    grip.textContent = "⠿";
    left.appendChild(grip);
    var num = document.createElement("span");
    num.className = "card-num";
    num.textContent = cfg.num;
    left.appendChild(num);
    var t = document.createElement("span");
    t.textContent = cfg.title;
    left.appendChild(t);
    head.appendChild(left);

    var meta = document.createElement("div");
    meta.className = "card-meta";
    var focus = document.createElement("span");
    focus.className = "card-focus";
    meta.appendChild(focus);
    var badge = document.createElement("span");
    badge.className = "demo-badge";
    badge.textContent = "DEMO";
    meta.appendChild(badge);
    var colBtn = document.createElement("button");
    colBtn.className = "icon-btn";
    colBtn.type = "button";
    colBtn.title = "Collapse (or double-click title bar)";
    colBtn.textContent = "—";
    colBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleCollapse(card);
    });
    meta.appendChild(colBtn);
    head.appendChild(meta);

    var body = document.createElement("div");
    body.className = "card-body";
    body.dataset.widget = cfg.widget;

    var resize = document.createElement("div");
    resize.className = "resize-grip";
    resize.title = "Drag to resize";

    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(resize);

    attachWindowBehavior(card, head, resize);
    return card;
  }

  function toggleCollapse(card) {
    if (card.classList.contains("collapsed")) {
      card.classList.remove("collapsed");
      card.style.height = (parseInt(card.dataset.h, 10) || 320) + "px";
      requestAnimationFrame(function () { redrawBody(card); });
    } else {
      card.dataset.h = String(card.offsetHeight);
      card.classList.add("collapsed");
      card.style.height = "auto";
    }
    fitCanvas();
    saveLayout();
  }

  function redrawBody(card) {
    var body = card.querySelector(".card-body");
    var w = window.Widgets[body.dataset.widget];
    if (w && w.update) { w.update(body, md.snap, md); }
  }

  /* ---------- window behavior: drag / resize / focus --------------------------------- */
  var ghost = null;
  function makeGhost(x, y, w, h) {
    if (!ghost) {
      ghost = document.createElement("div");
      ghost.className = "wm-ghost";
      canvas.appendChild(ghost);
    }
    ghost.style.display = "block";
    ghost.style.left = x + "px";
    ghost.style.top = y + "px";
    ghost.style.width = w + "px";
    ghost.style.height = h + "px";
  }
  function hideGhost() { if (ghost) { ghost.style.display = "none"; } }

  function attachWindowBehavior(card, head, resize) {
    /* z-raise on any interaction */
    card.addEventListener("mousedown", function () {
      zTop += 1;
      card.style.zIndex = String(zTop);
      saveLayout();
    });

    /* drag by title bar */
    head.addEventListener("mousedown", function (e) {
      if (e.target.closest(".icon-btn") || e.button !== 0) { return; }
      e.preventDefault();
      var startX = e.clientX, startY = e.clientY;
      var ox = parseInt(card.style.left, 10) || 0;
      var oy = parseInt(card.style.top, 10) || 0;
      card.classList.add("wm-active");
      makeGhost(ox, oy, card.offsetWidth, card.classList.contains("collapsed") ? 36 : card.offsetHeight);

      function move(ev) {
        var nx = snap8(ox + ev.clientX - startX);
        var ny = snap8(oy + ev.clientY - startY);
        nx = Math.max(0, Math.min(nx, canvas.clientWidth - 80));
        ny = Math.max(0, ny);
        makeGhost(nx, ny, card.offsetWidth, card.classList.contains("collapsed") ? 36 : card.offsetHeight);
        ghost.dataset.x = nx; ghost.dataset.y = ny;
      }
      function up() {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        card.classList.remove("wm-active");
        if (ghost && ghost.dataset.x !== undefined) {
          card.style.left = ghost.dataset.x + "px";
          card.style.top = ghost.dataset.y + "px";
        }
        hideGhost();
        fitCanvas();
        saveLayout();
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });

    /* double-click collapse */
    head.addEventListener("dblclick", function (e) {
      if (e.target.closest(".icon-btn")) { return; }
      toggleCollapse(card);
    });

    /* resize grip */
    resize.addEventListener("mousedown", function (e) {
      if (e.button !== 0) { return; }
      e.preventDefault();
      e.stopPropagation();
      var startX = e.clientX, startY = e.clientY;
      var ow = card.offsetWidth, oh = card.offsetHeight;
      function move(ev) {
        var nw = Math.max(240, snap8(ow + ev.clientX - startX));
        var nh = Math.max(170, snap8(oh + ev.clientY - startY));
        card.style.width = nw + "px";
        card.style.height = nh + "px";
      }
      function up() {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        redrawBody(card);
        fitCanvas();
        saveLayout();
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }

  function fitCanvas() {
    var max = 0;
    Array.prototype.forEach.call(canvas.querySelectorAll(".card"), function (c) {
      var bottom = (parseInt(c.style.top, 10) || 0) +
        (c.classList.contains("collapsed") ? 40 : c.offsetHeight);
      if (bottom > max) { max = bottom; }
    });
    canvas.style.height = (max + 60) + "px";
  }

  /* ---------- tape ------------------------------------------------------------------- */
  function buildTape() {
    tapeTrack.innerHTML = "";
    for (var rep = 0; rep < 2; rep++) {
      md.snap.tape.forEach(function (t) {
        var item = document.createElement("span");
        item.className = "tape-item";
        item.dataset.sym = t.sym;
        item.dataset.rep = String(rep);
        tapeTrack.appendChild(item);
      });
    }
    updateTape();
  }
  function updateTape() {
    var f = window.Widgets._fmt;
    md.snap.tape.forEach(function (t) {
      for (var rep = 0; rep < 2; rep++) {
        var item = tapeTrack.querySelector('[data-sym="' + t.sym + '"][data-rep="' + rep + '"]');
        if (!item) { continue; }
        var sess = md.snap.sessions.find(function (s) { return s.market === t.venue; });
        var state = t.venue === "SPOT" ? "OPEN" : md.sessionInfo(sess).state;
        var prev = item.dataset.prev;
        item.innerHTML = "<b>" + t.sym + "</b> " + f.num(t.price) +
          " <span class='" + f.cls(t.changePct) + "'>" + f.arrow(t.changePct) + " " + f.pct(t.changePct) +
          "</span> <span class='tape-state st-" + state.toLowerCase() + "'>" + state + "</span>";
        if (prev && prev !== t.price.toFixed(2)) {
          window.Widgets._flash(item, t.price > parseFloat(prev) ? 1 : -1);
        }
        item.dataset.prev = t.price.toFixed(2);
      }
    });
  }

  /* ---------- mode / scan / status ---------------------------------------------------- */
  function syncModeUI() {
    var live = md.isLive();
    modeBtn.textContent = md.mode === "live" ? "LIVE" : "DEMO";
    modeBtn.classList.toggle("live", md.mode === "live");
    statusDot.className = "dot " + (live ? "dot-live" : "dot-demo");
    statusText.textContent = live ? "live feed" : "demo feed";
    Array.prototype.forEach.call(canvas.querySelectorAll(".demo-badge"), function (b) {
      b.textContent = live ? "LIVE" : "DEMO";
      b.classList.toggle("live", live);
    });
  }

  function toggleMode() {
    md.setMode(md.mode === "live" ? "demo" : "live");
    syncModeUI();
    saveLayout();
    setTimeout(function () { syncModeUI(); updateAll(); }, 1200);
  }

  function toggleScan() {
    var off = document.body.classList.toggle("no-scan");
    try { localStorage.setItem(SCAN_KEY, off ? "off" : "on"); } catch (e) { /* noop */ }
    scanBtn.classList.toggle("live", !off);
  }

  function resetLayout() {
    try { localStorage.removeItem(LAYOUT_KEY); } catch (e) { /* noop */ }
    canvas.innerHTML = "";
    mountAll();
    updateAll();
  }

  modeBtn.addEventListener("click", toggleMode);
  scanBtn.addEventListener("click", toggleScan);
  resetBtn.addEventListener("click", resetLayout);

  /* keyboard: R = reset layout · L = live/demo · S = scanlines · Esc = close settings */
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (window.Settings && Settings.isOpen()) { Settings.hide(); }
      return;
    }
    if (e.target.closest("input, textarea, select, [contenteditable]")) { return; }
    if (e.metaKey || e.ctrlKey || e.altKey) { return; }
    var k = e.key.toLowerCase();
    if (k === "r") { resetLayout(); }
    else if (k === "l") { toggleMode(); }
    else if (k === "s") { toggleScan(); }
  });

  /* scan button initial state */
  if (document.body.classList.contains("no-scan")) { scanBtn.classList.remove("live"); }
  else { scanBtn.classList.add("live"); }

  /* ---------- mount --------------------------------------------------------------------- */
  function mountAll() {
    var saved = loadLayout();
    var rects = defaultRects();
    if (saved) {
      zTop = saved.zTop || 10;
      Object.keys(saved.rects).forEach(function (id) {
        if (rects[id]) {
          var r = saved.rects[id];
          /* clamp stale windows into the current canvas width */
          var W = canvas.clientWidth || 1200;
          r.x = Math.max(0, Math.min(r.x, W - 120));
          r.w = Math.max(240, Math.min(r.w, W));
          rects[id] = r;
        }
      });
      if (saved.mode) { md.setMode(saved.mode); }
    }
    CARDS.forEach(function (cfg) {
      var card = buildCard(cfg, rects[cfg.id]);
      canvas.appendChild(card);
      window.Widgets[cfg.widget].mount(card.querySelector(".card-body"), md.snap, md);
    });
    fitCanvas();
    syncModeUI();
  }

  function updateAll() {
    Array.prototype.forEach.call(canvas.querySelectorAll(".card-body"), function (body) {
      var w = window.Widgets[body.dataset.widget];
      if (w && w.update) {
        try { w.update(body, md.snap, md); }
        catch (err) { console.warn("[widgets] " + body.dataset.widget + " update skipped:", err && err.message); }
      }
    });
    updateTape();
  }

  /* ---------- clocks --------------------------------------------------------------------- */
  function utcTick() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    utcClock.textContent = "UTC " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds());
  }

  /* ---------- tile / settings hooks ---------------------------------------------------------- */
  function tileWindows() {
    var rects = defaultRects();
    Array.prototype.forEach.call(canvas.querySelectorAll(".card"), function (card) {
      var r = rects[card.dataset.id];
      if (!r) { return; }
      card.classList.remove("collapsed");
      card.style.left = r.x + "px";
      card.style.top = r.y + "px";
      card.style.width = r.w + "px";
      card.style.height = r.h + "px";
      card.style.zIndex = "1";
    });
    zTop = 10;
    fitCanvas();
    updateAll();
    saveLayout();
  }

  var tickTimer = null;
  function setRefresh(ms) {
    clearInterval(tickTimer);
    tickTimer = setInterval(function () {
      md.tick();
      updateAll();
      if (md.mode === "live") { syncModeUI(); }
    }, Math.max(500, ms || 3000));
  }

  window.__md = md;
  window.__hooks = {
    getMode: function () { return md.mode; },
    setMode: function (m) { md.setMode(m); syncModeUI(); saveLayout();
      setTimeout(function () { syncModeUI(); updateAll(); }, 1200); },
    setRefresh: setRefresh,
    setEndpoint: function (url) { md.setEndpoint(url); },
    toggleScan: toggleScan,
    resetLayout: resetLayout,
    tileWindows: tileWindows
  };
  window.__onThemeChange = function () {
    /* re-derive baked sector colors, then repaint everything */
    if (md.snap && md.snap.sectorIntraday && window.Themes) {
      md.snap.sectorIntraday.forEach(function (s) { s.color = Themes.sectorColor(s.group); });
    }
    updateAll();
    if (window.Cloud) { Cloud.schedulePresetPush(); }
  };

  /* cloud session LED in header */
  var cloudLed = document.getElementById("cloud-led");
  if (cloudLed && window.Cloud) {
    Cloud.onChange(function () {
      var on = !!Cloud.user();
      cloudLed.className = "dot " + (on ? "dot-live" : "dot-demo dim");
      cloudLed.title = on ? "cloud sync: " + Cloud.user().email : "local-only mode — sign in via ⚙ SETUP";
    });
  }

  var settingsBtn = document.getElementById("settings-open");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", function () {
      if (window.Settings) { Settings.toggle(); }
    });
  }

  /* ---------- boot -------------------------------------------------------------------------- */
  try {
    var qs = new URLSearchParams(window.location.search);
    if (qs.get("mode") === "live") { md.setMode("live"); }
  } catch (e) { /* noop */ }

  var savedSettings = window.Settings ? Settings.load() : { refresh: 3000, endpoint: "" };
  if (savedSettings.endpoint) { md.setEndpoint(savedSettings.endpoint); }

  buildTape();
  mountAll();
  utcTick();
  setInterval(utcTick, 1000);
  setInterval(function () {
    var pulseBody = canvas.querySelector('.card[data-id="pulse"] .card-body');
    if (pulseBody) { window.Widgets.pulse.update(pulseBody, md.snap, md); }
    var mapBody = canvas.querySelector('.card[data-id="worldmap"] .card-body');
    if (mapBody) { window.Widgets.worldmap.update(mapBody, md.snap, md); }
  }, 1000);
  setRefresh(savedSettings.refresh);
})();
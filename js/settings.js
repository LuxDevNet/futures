/* ==========================================================================
 * settings.js — settings overlay: connection · appearance · layout · data
 * Hooks are provided by app.js via window.__hooks.
 * ======================================================================== */
(function (global) {
  "use strict";

  var SETTINGS_KEY = "tmd.settings.v1";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }

  function loadSettings() {
    try {
      var p = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      if (p) { return { refresh: p.refresh || 3000, endpoint: p.endpoint || "" }; }
    } catch (e) { /* noop */ }
    return { refresh: 3000, endpoint: "" };
  }
  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* noop */ }
  }

  function section(title) {
    var s = el("div", "set-section");
    s.appendChild(el("div", "set-title", title));
    return s;
  }
  function row(label, control, hint) {
    var r = el("div", "set-row");
    var l = el("div", "set-label");
    l.appendChild(el("span", "set-label-main", label));
    if (hint) { l.appendChild(el("span", "set-label-hint", hint)); }
    r.appendChild(l);
    var c = el("div", "set-control");
    c.appendChild(control);
    r.appendChild(c);
    return r;
  }

  var overlay = null;

  function build() {
    var hooks = global.__hooks || {};
    var settings = loadSettings();

    overlay = el("div", "settings-overlay");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Settings");
    var panel = el("div", "settings-panel glass");
    overlay.appendChild(panel);

    /* header */
    var head = el("div", "settings-head");
    head.appendChild(el("span", "settings-title", "//SETTINGS"));
    var close = el("button", "icon-btn", "×");
    close.type = "button";
    close.title = "close (Esc)";
    close.addEventListener("click", hide);
    head.appendChild(close);
    panel.appendChild(head);

    var bodyWrap = el("div", "settings-body");
    panel.appendChild(bodyWrap);

    /* ============ CONNECTION ============ */
    var conn = section("CONNECTION");
    var modeWrap = el("div", "set-seg");
    var demoBtn = el("button", "chip", "DEMO");
    var liveBtn = el("button", "chip", "LIVE");
    [demoBtn, liveBtn].forEach(function (b) {
      b.type = "button";
      modeWrap.appendChild(b);
    });
    function syncMode() {
      var m = hooks.getMode ? hooks.getMode() : "demo";
      demoBtn.classList.toggle("active", m === "demo");
      liveBtn.classList.toggle("active", m === "live");
    }
    demoBtn.addEventListener("click", function () { if (hooks.setMode) { hooks.setMode("demo"); } syncMode(); });
    liveBtn.addEventListener("click", function () { if (hooks.setMode) { hooks.setMode("live"); } syncMode(); });
    syncMode();
    conn.appendChild(row("data feed", modeWrap,
      "demo = deterministic simulated tape · live = stooq quotes when reachable"));

    var refSel = el("select", "chat-select set-select");
    [[1000, "1s — hot"], [2000, "2s"], [3000, "3s — default"],
     [5000, "5s — calm"], [10000, "10s — slow"]].forEach(function (o) {
      var op = el("option", "", o[1]);
      op.value = String(o[0]);
      refSel.appendChild(op);
    });
    refSel.value = String(settings.refresh);
    refSel.addEventListener("change", function () {
      settings.refresh = parseInt(refSel.value, 10) || 3000;
      saveSettings(settings);
      if (hooks.setRefresh) { hooks.setRefresh(settings.refresh); }
    });
    conn.appendChild(row("refresh interval", refSel, "how often the tape re-ticks"));

    var ep = el("input", "chat-base set-endpoint");
    ep.type = "text";
    ep.placeholder = "https://stooq.com/q/l/?s=…";
    ep.value = settings.endpoint;
    ep.autocomplete = "off";
    ep.addEventListener("change", function () {
      settings.endpoint = ep.value.trim();
      saveSettings(settings);
      if (hooks.setEndpoint) { hooks.setEndpoint(settings.endpoint); }
    });
    conn.appendChild(row("live endpoint", ep, "override the quote source URL (CSV)"));
    bodyWrap.appendChild(conn);

    /* ============ APPEARANCE ============ */
    var app = section("APPEARANCE");
    var themeWrap = el("div", "set-themes");
    global.Themes.list.forEach(function (t) {
      var b = el("button", "theme-swatch", t.name.toUpperCase());
      b.type = "button";
      b.dataset.theme = t.id;
      var dots = el("span", "theme-dots");
      ["up", "down", "accent", "warn"].forEach(function (k) {
        var d = el("i");
        d.style.background = global.Themes.peek(t.id, k);
        dots.appendChild(d);
      });
      b.appendChild(dots);
      b.addEventListener("click", function () {
        global.Themes.apply(t.id);
        syncThemes();
      });
      themeWrap.appendChild(b);
    });
    function syncThemes() {
      Array.prototype.forEach.call(themeWrap.children, function (b) {
        b.classList.toggle("active", b.dataset.theme === global.Themes.current());
      });
    }
    syncThemes();
    app.appendChild(row("theme", themeWrap, "4 terminal palettes — applies instantly"));

    var scanBtn2 = el("button", "chip", "SCANLINES");
    scanBtn2.type = "button";
    function syncScan() {
      scanBtn2.classList.toggle("live", !document.body.classList.contains("no-scan"));
    }
    scanBtn2.addEventListener("click", function () {
      if (hooks.toggleScan) { hooks.toggleScan(); }
      syncScan();
    });
    syncScan();
    app.appendChild(row("crt scanlines", scanBtn2, "subtle interlace overlay"));
    bodyWrap.appendChild(app);

    /* ============ LAYOUT ============ */
    var lay = section("LAYOUT");
    var tileBtn = el("button", "chip", "TILE WINDOWS");
    tileBtn.type = "button";
    tileBtn.addEventListener("click", function () {
      if (hooks.tileWindows) { hooks.tileWindows(); }
    });
    lay.appendChild(row("auto-arrange", tileBtn, "snap all windows back to the mosaic grid"));
    var resetBtn2 = el("button", "chip set-danger", "RESET LAYOUT");
    resetBtn2.type = "button";
    resetBtn2.addEventListener("click", function () {
      if (hooks.resetLayout) { hooks.resetLayout(); }
    });
    lay.appendChild(row("start over", resetBtn2, "forget saved window positions (R)"));
    bodyWrap.appendChild(lay);

    /* ============ ACCOUNT (cloud sync) ============ */
    var acct = section("ACCOUNT · CLOUD SYNC");
    var acctStatus = el("div", "acct-status");
    function syncAcctUI() {
      var u = global.Cloud && Cloud.user();
      acctStatus.innerHTML = "";
      if (u) {
        acctStatus.appendChild(el("span", "acct-on", "● signed in as " + u.email));
        acctStatus.appendChild(el("span", "acct-hint", "presets · watchlists · positions · strategies sync automatically"));
      } else {
        acctStatus.appendChild(el("span", "acct-off", "○ local-only mode"));
        acctStatus.appendChild(el("span", "acct-hint", "sign in to sync presets, lists, positions & strategies across devices"));
      }
    }
    syncAcctUI();
    acct.appendChild(acctStatus);
    var emailIn = el("input", "chat-base acct-in");
    emailIn.type = "email";
    emailIn.placeholder = "email";
    emailIn.autocomplete = "username";
    var passIn = el("input", "chat-base acct-in");
    passIn.type = "password";
    passIn.placeholder = "password (6+ chars)";
    passIn.autocomplete = "current-password";
    var inRow = el("form", "acct-row");
    inRow.addEventListener("submit", function (ev) { ev.preventDefault(); });
    inRow.appendChild(emailIn);
    inRow.appendChild(passIn);
    acct.appendChild(inRow);
    var acctMsg = el("div", "acct-msg");
    var btnRow = el("div", "acct-row");
    var inBtn = el("button", "chip", "SIGN IN");
    var upBtn = el("button", "chip", "SIGN UP");
    var outBtn = el("button", "chip set-danger", "SIGN OUT");
    var syncBtn = el("button", "chip", "SYNC NOW");
    [inBtn, upBtn, outBtn, syncBtn].forEach(function (b) { b.type = "button"; });
    function busy(v) {
      [inBtn, upBtn, outBtn, syncBtn].forEach(function (b) { b.disabled = v; });
    }
    inBtn.addEventListener("click", function () {
      busy(true);
      acctMsg.textContent = "signing in…";
      acctMsg.className = "acct-msg";
      Cloud.signIn(emailIn.value.trim(), passIn.value)
        .then(function () { acctMsg.textContent = "signed in — data synced"; acctMsg.className = "acct-msg ok"; })
        .catch(function (e) { acctMsg.textContent = e.message; acctMsg.className = "acct-msg err"; })
        .then(function () { busy(false); });
    });
    upBtn.addEventListener("click", function () {
      busy(true);
      acctMsg.textContent = "creating account…";
      acctMsg.className = "acct-msg";
      Cloud.signUp(emailIn.value.trim(), passIn.value)
        .then(function (r) {
          acctMsg.textContent = r.immediate ? "account created — you are signed in"
            : "account created — confirm via email, then sign in";
          acctMsg.className = "acct-msg ok";
        })
        .catch(function (e) { acctMsg.textContent = e.message; acctMsg.className = "acct-msg err"; })
        .then(function () { busy(false); });
    });
    outBtn.addEventListener("click", function () {
      Cloud.signOut();
      acctMsg.textContent = "signed out — back to local-only";
      acctMsg.className = "acct-msg";
    });
    syncBtn.addEventListener("click", function () {
      if (!Cloud.user()) { acctMsg.textContent = "sign in first"; acctMsg.className = "acct-msg err"; return; }
      Cloud.pullAll();
      Cloud.pushPreset("default").catch(function () { /* noop */ });
      acctMsg.textContent = "sync requested…";
      acctMsg.className = "acct-msg";
    });
    btnRow.appendChild(inBtn);
    btnRow.appendChild(upBtn);
    btnRow.appendChild(outBtn);
    btnRow.appendChild(syncBtn);
    acct.appendChild(btnRow);
    acct.appendChild(acctMsg);
    if (global.Cloud) {
      Cloud.onChange(syncAcctUI);
    }
    bodyWrap.appendChild(acct);

    /* ============ DATA & KEYS ============ */
    var data = section("DATA & KEYS");
    function clearBtn(label, keys, hint) {
      var b = el("button", "chip set-danger", label);
      b.type = "button";
      b.addEventListener("click", function () {
        try {
          keys.forEach(function (k) { localStorage.removeItem(k); });
        } catch (e) { /* noop */ }
        b.textContent = "CLEARED ✓";
        setTimeout(function () { b.textContent = label; }, 1200);
      });
      return row(label.toLowerCase(), b, hint);
    }
    data.appendChild(clearBtn("CLEAR WINDOW LAYOUT", ["tmd.layout.v3"], "saved positions & mode"));
    data.appendChild(clearBtn("CLEAR WATCHLISTS", ["tmd.lists.v1"], "custom lists & symbols"));
    data.appendChild(clearBtn("CLEAR AI KEYS", ["tmd.aikeys.v1", "tmd.chat.v1"], "BYOK keys + chat history"));
    data.appendChild(clearBtn("CLEAR NEWS READ STATE", ["market-terminal-read-v1"], "unread dots reset"));
    var wipe = el("button", "chip set-danger set-wipe", "WIPE EVERYTHING");
    wipe.type = "button";
    wipe.addEventListener("click", function () {
      try { localStorage.clear(); } catch (e) { /* noop */ }
      wipe.textContent = "WIPED — RELOADING";
      setTimeout(function () { window.location.reload(); }, 600);
    });
    data.appendChild(row("factory reset", wipe, "clears every preference, key and layout, then reloads"));
    bodyWrap.appendChild(data);

    /* footer */
    var foot = el("div", "settings-foot",
      "shortcuts — R reset · L live/demo · S scanlines · Esc close · click boot screen to skip");
    panel.appendChild(foot);

    overlay.addEventListener("mousedown", function (e) {
      if (e.target === overlay) { hide(); }
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function show() {
    if (!overlay) { build(); }
    overlay.classList.add("open");
  }
  function hide() {
    if (overlay) { overlay.classList.remove("open"); }
  }
  function toggle() {
    if (!overlay || !overlay.classList.contains("open")) { show(); }
    else { hide(); }
  }
  function isOpen() {
    return !!(overlay && overlay.classList.contains("open"));
  }

  global.Settings = {
    show: show, hide: hide, toggle: toggle, isOpen: isOpen,
    load: loadSettings
  };
})(window);
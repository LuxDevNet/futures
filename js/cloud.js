/* ==========================================================================
 * cloud.js — Supabase backend for /TERMINAL (project: agnamo)
 * Plain-REST client (no SDK): PostgREST + GoTrue. Tables: tmd_profiles,
 * tmd_ui_presets, tmd_watchlists, tmd_positions, tmd_strategies,
 * tmd_backtest_runs — all row-level-secured per user.
 * Everything degrades silently to local-only when offline / signed out.
 * ======================================================================== */
(function (global) {
  "use strict";

  var DEFAULT_URL = "https://yvfgayyyjzfyswsuqinw.supabase.co";
  var DEFAULT_KEY = "sb_publishable_MEVtUSn2Hgmsq8lkwlZ3Rg_p20sYoUw";
  var CFG_KEY = "tmd.cloud.v1";
  var SESS_KEY = "tmd.cloud.session.v1";

  var session = null;   /* { access_token, refresh_token, expires_at, email, id } */
  var listeners = [];
  var refreshTimer = null;

  function cfg() {
    try {
      var p = JSON.parse(localStorage.getItem(CFG_KEY) || "{}");
      return { url: p.url || DEFAULT_URL, key: p.key || DEFAULT_KEY };
    } catch (e) { return { url: DEFAULT_URL, key: DEFAULT_KEY }; }
  }
  function setCfg(url, key) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify({ url: url, key: key })); } catch (e) { /* noop */ }
  }

  function saveSession(s) {
    session = s;
    try { localStorage.setItem(SESS_KEY, JSON.stringify(s)); } catch (e) { /* noop */ }
    scheduleRefresh();
    emit();
  }
  function clearSession() {
    session = null;
    clearTimeout(refreshTimer);
    try { localStorage.removeItem(SESS_KEY); } catch (e) { /* noop */ }
    emit();
  }
  function loadSession() {
    try {
      var s = JSON.parse(localStorage.getItem(SESS_KEY) || "null");
      if (s && s.access_token) { session = s; scheduleRefresh(); }
    } catch (e) { /* noop */ }
  }

  function emit() {
    listeners.forEach(function (cb) {
      try { cb(session); } catch (e) { /* noop */ }
    });
  }
  function onChange(cb) { listeners.push(cb); }

  /* ---------- low-level ------------------------------------------------------- */
  function authHeaders() {
    var c = cfg();
    return {
      "apikey": c.key,
      "authorization": "Bearer " + (session ? session.access_token : c.key),
      "content-type": "application/json"
    };
  }

  function req(path, opts) {
    var c = cfg();
    opts = opts || {};
    opts.headers = Object.assign(authHeaders(), opts.headers || {});
    return fetch(c.url + path, opts).then(function (r) {
      if (r.status === 401 && session) {
        /* token may be stale — try one refresh, then give up quietly */
        return refresh().then(function (ok) {
          if (!ok) { throw new Error("session expired"); }
          opts.headers = Object.assign(authHeaders(), opts.headers || {});
          return fetch(c.url + path, opts);
        }).then(function (r2) {
          if (!r2.ok) { throw new Error("HTTP " + r2.status); }
          return r2;
        });
      }
      if (!r.ok) {
        return r.text().then(function (t) {
          var msg = "HTTP " + r.status;
          try { msg = JSON.parse(t).message || msg; } catch (e) { /* noop */ }
          throw new Error(msg);
        });
      }
      return r;
    });
  }

  function rest(table, query, opts) {
    return req("/rest/v1/" + table + (query || ""), opts || {}).then(function (r) {
      return r.status === 204 ? null : r.json();
    });
  }

  /* ---------- auth ------------------------------------------------------------- */
  function storeAuth(j, email) {
    if (!j || !j.access_token) { return false; }
    saveSession({
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: Date.now() + (j.expires_in || 3600) * 1000,
      email: (j.user && j.user.email) || email,
      id: j.user && j.user.id
    });
    return true;
  }

  function signUp(email, password) {
    var c = cfg();
    return fetch(c.url + "/auth/v1/signup", {
      method: "POST",
      headers: { "apikey": c.key, "content-type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) { throw new Error(j.msg || j.error_description || j.message || "sign-up failed"); }
        if (storeAuth(j, email)) { pullAll(); return { ok: true, immediate: true }; }
        return { ok: true, immediate: false };
      });
    }, function () { throw new Error("backend unreachable — you are offline"); });
  }

  function signIn(email, password) {
    var c = cfg();
    return fetch(c.url + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { "apikey": c.key, "content-type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) { throw new Error(j.error_description || j.msg || "invalid credentials"); }
        if (!storeAuth(j, email)) { throw new Error("no session returned"); }
        pullAll();
        return { ok: true };
      });
    }, function () { throw new Error("backend unreachable — you are offline"); });
  }

  function signOut() {
    if (session) {
      req("/auth/v1/logout", { method: "POST" }).catch(function () { /* noop */ });
    }
    clearSession();
  }

  function refresh() {
    if (!session || !session.refresh_token) { return Promise.resolve(false); }
    var c = cfg();
    return fetch(c.url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { "apikey": c.key, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j.access_token) { clearSession(); return false; }
        storeAuth(j, session.email);
        return true;
      });
    }, function () { return false; });
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    if (!session) { return; }
    var ms = Math.max(60000, session.expires_at - Date.now() - 300000);
    refreshTimer = setTimeout(refresh, ms);
  }

  /* ---------- pull: cloud -> local ---------------------------------------------- */
  function pullAll() {
    if (!session) { return; }
    /* UI preset (default) */
    rest("tmd_ui_presets", "?select=*&is_default=eq.true&limit=1")
      .then(function (rows) {
        if (rows && rows[0] && rows[0].layout) {
          try {
            localStorage.setItem("tmd.layout.v3", JSON.stringify(rows[0].layout));
            if (rows[0].theme && global.Themes) { Themes.apply(rows[0].theme); }
            if (rows[0].settings) { localStorage.setItem("tmd.settings.v1", JSON.stringify(rows[0].settings)); }
            if (window.__hooks && __hooks.resetLayout) {
              __hooks.resetLayout();
            }
          } catch (e) { /* noop */ }
        }
      }).catch(function () { /* offline */ });

    /* watchlists */
    rest("tmd_watchlists", "?select=*&order=sort_order")
      .then(function (rows) {
        if (rows && rows.length) {
          var lists = {};
          rows.forEach(function (r) { lists[r.name] = r.symbols || []; });
          try {
            localStorage.setItem("tmd.lists.v1",
              JSON.stringify({ active: rows[0].name, lists: lists }));
            refreshWidget("lists");
          } catch (e) { /* noop */ }
        }
      }).catch(function () { /* offline */ });

    /* positions */
    rest("tmd_positions", "?select=*")
      .then(function (rows) {
        if (rows && rows.length) {
          var list = rows.map(function (r) {
            return { symbol: r.symbol, qty: parseFloat(r.qty),
                     avgCost: parseFloat(r.avg_cost), openedAt: r.opened_at };
          });
          try {
            localStorage.setItem("tmd.positions.v1", JSON.stringify(list));
            refreshWidget("positions");
          } catch (e) { /* noop */ }
        }
      }).catch(function () { /* offline */ });

    /* strategies */
    rest("tmd_strategies", "?select=*&order=updated_at.desc")
      .then(function (rows) {
        if (rows && rows.length) {
          var list = rows.map(function (r) { return r.spec; });
          try {
            localStorage.setItem("tmd.strategies.v1", JSON.stringify(list));
            var body = document.querySelector('.card[data-id="strategy"] .card-body');
            if (body && body._sl && body._sl._renderSaved) { body._sl._renderSaved(); }
          } catch (e) { /* noop */ }
        }
      }).catch(function () { /* offline */ });
  }

  function refreshWidget(id) {
    var body = document.querySelector('.card[data-id="' + id + '"] .card-body');
    var w = global.Widgets && Widgets[id];
    if (body && w && w.update && global.__md) {
      try { w.update(body, __md.snap, __md); } catch (e) { /* noop */ }
    }
  }

  /* ---------- push: local -> cloud (debounced upserts) ---------------------------- */
  var timers = {};
  function debounce(key, ms, fn) {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(function () {
      if (!session) { return; }
      fn().catch(function () { /* offline */ });
    }, ms);
  }

  function upsert(table, rows) {
    return rest(table, "", {
      method: "POST",
      headers: { "prefer": "resolution=merge-duplicates" },
      body: JSON.stringify(rows)
    });
  }

  function pushPreset(name) {
    if (!session) { return Promise.resolve(); }
    var layout, settings;
    try {
      layout = JSON.parse(localStorage.getItem("tmd.layout.v3") || "null");
      settings = JSON.parse(localStorage.getItem("tmd.settings.v1") || "null");
    } catch (e) { /* noop */ }
    return upsert("tmd_ui_presets", [{
      user_id: session.id, name: name || "default",
      theme: global.Themes ? Themes.current() : null,
      layout: layout, settings: settings, is_default: true
    }]);
  }
  function schedulePresetPush() {
    debounce("preset", 4000, function () { return pushPreset("default"); });
  }

  function pushLists(listsState) {
    if (!session || !listsState) { return Promise.resolve(); }
    var rows = Object.keys(listsState.lists).map(function (name, i) {
      return { user_id: session.id, name: name, symbols: listsState.lists[name], sort_order: i };
    });
    return rest("tmd_watchlists", "?user_id=eq." + session.id, { method: "DELETE" })
      .then(function () { return upsert("tmd_watchlists", rows); });
  }
  function scheduleListsPush(listsState) {
    debounce("lists", 1500, function () { return pushLists(listsState); });
  }

  function pushPositions(list) {
    if (!session) { return Promise.resolve(); }
    var rows = (list || []).map(function (p) {
      return { user_id: session.id, symbol: p.symbol, qty: p.qty,
               avg_cost: p.avgCost, opened_at: p.openedAt || null };
    });
    return rest("tmd_positions", "?user_id=eq." + session.id, { method: "DELETE" })
      .then(function () { return rows.length ? upsert("tmd_positions", rows) : null; });
  }

  function pushStrategies(list) {
    if (!session) { return Promise.resolve(); }
    var rows = (list || []).map(function (s) {
      return { user_id: session.id, name: s.name || "UNNAMED",
               kind: s.kind || "algo", spec: s };
    });
    return rest("tmd_strategies", "?user_id=eq." + session.id, { method: "DELETE" })
      .then(function () { return rows.length ? upsert("tmd_strategies", rows) : null; });
  }

  function logRun(spec, symbol, result) {
    if (!session) { return; }
    var m = result.metrics || {};
    var equitySample = [];
    var eq = result.equity || [];
    var step = Math.max(1, Math.floor(eq.length / 120));
    for (var i = 0; i < eq.length; i += step) { equitySample.push(Math.round(eq[i] * 10000) / 10000); }
    rest("tmd_backtest_runs", "", {
      method: "POST",
      body: JSON.stringify([{
        user_id: session.id, strategy_name: spec.name || "UNNAMED",
        symbol: symbol, spec: spec,
        metrics: m, equity: equitySample,
        trades: (result.trades || []).slice(-50)
      }])
    }).catch(function () { /* offline */ });
  }

  loadSession();

  global.Cloud = {
    onChange: onChange,
    user: function () { return session ? { email: session.email, id: session.id } : null; },
    configured: function () { var c = cfg(); return !!(c.url && c.key); },
    signUp: signUp, signIn: signIn, signOut: signOut,
    pushPreset: pushPreset, schedulePresetPush: schedulePresetPush,
    pushLists: scheduleListsPush,
    pushPositions: pushPositions,
    pushStrategies: pushStrategies,
    logRun: logRun,
    pullAll: pullAll,
    _cfg: cfg, _setCfg: setCfg
  };
})(window);
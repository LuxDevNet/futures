/* ==========================================================================
 * newviews.js — world map · company connections · sector drill · IPO · lists
 * All offline: dot-matrix map from embedded land mask, fixture IPO calendar,
 * deterministic force layout for the supply-chain graph.
 * Widgets contract: { mount(body, snap, md), update(body, snap, md) }
 * ======================================================================== */
(function (global) {
  "use strict";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }
  function fmt() { return global.Widgets._fmt; }
  function pal(key, fb) { return (global.Themes && Themes.c(key)) || fb; }

  function sizeCanvas(cv, box) {
    var w = box.clientWidth, h = box.clientHeight;
    if (w < 10 || h < 10) { return null; }
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  /* ==========================================================================
   * WORLD MAP — dot-matrix land + venue markers with live session state
   * ======================================================================== */
  var worldmap = {
    mount: function (body) {
      body.innerHTML = "";
      var wrap = el("div", "map-wrap");
      var cv = el("canvas", "map-canvas");
      wrap.appendChild(cv);
      var legend = el("div", "map-legend");
      body.appendChild(wrap);
      body.appendChild(legend);
      body._map = { cv: cv, legend: legend };
    },
    update: function (body, snap, md) {
      var st = body._map;
      if (!st) { return; }
      var sized = sizeCanvas(st.cv, st.cv.parentElement);
      if (!sized) { return; }
      var ctx = sized.ctx, W = sized.w, H = sized.h;
      ctx.clearRect(0, 0, W, H);

      var map = global.MapData ? MapData.decode() : null;
      if (map) {
        var stepX = W / map.w, stepY = H / map.h;
        var r = Math.max(0.6, Math.min(stepX, stepY) * 0.32);
        ctx.fillStyle = pal("land", "rgba(147,161,161,.30)");
        for (var gy = 0; gy < map.h; gy++) {
          for (var gx = 0; gx < map.w; gx++) {
            if (map.mask[gy * map.w + gx]) {
              ctx.beginPath();
              ctx.arc((gx + 0.5) * stepX, (gy + 0.5) * stepY, r, 0, 6.2832);
              ctx.fill();
            }
          }
        }
      }

      /* venue markers */
      var now = new Date();
      var markers = global.MapData ? MapData.markers : [];
      ctx.font = "600 9px ui-monospace, Menlo, monospace";
      markers.forEach(function (m) {
        var x = (m[2] + 180) / 360 * W;
        var y = (90 - m[3]) / 180 * H;
        var sess = snap.sessions.find(function (s) { return s.market === m[0]; });
        var state = sess ? md.sessionInfo(sess).state : "CLOSED";
        var col = state === "OPEN" ? pal("up", "#859900")
          : state === "PRE" || state === "LUNCH" ? pal("warn", "#b58900")
          : pal("dimline", "rgba(147,161,161,.35)");
        /* pulse ring on open venues */
        if (state === "OPEN") {
          var ph = (now.getTime() % 2000) / 2000;
          ctx.strokeStyle = col;
          ctx.globalAlpha = 1 - ph;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, 4 + ph * 8, 0, 6.2832);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 6.2832);
        ctx.fill();
        ctx.strokeStyle = pal("bright", "#eee8d5");
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, 6.2832);
        ctx.stroke();
        ctx.fillStyle = pal("axis", "rgba(147,161,161,.75)");
        ctx.textAlign = "center";
        ctx.fillText(m[0], x, y + 15);
      });

      /* legend: live session table */
      var f = fmt();
      st.legend.innerHTML = "";
      snap.sessions.forEach(function (s) {
        var info = md.sessionInfo(s);
        var chip = el("span", "map-legend-item st-" + info.state.toLowerCase());
        chip.textContent = s.market + " " + info.state + (info.until ? " · " + info.until : "");
        st.legend.appendChild(chip);
      });
      void f;
    }
  };

  /* ==========================================================================
   * CONNECTIONS — supply-chain / partnership graph over the tracked universe
   * deterministic force layout, click node to isolate neighborhood
   * ======================================================================== */
  var EDGES = [
    ["NVDA", "TSM", "foundry", 3], ["AMD", "TSM", "foundry", 3], ["AAPL", "TSM", "foundry", 3],
    ["AVGO", "TSM", "foundry", 2], ["INTC", "TSM", "competes", 1],
    ["TSM", "ASML", "lithography", 3], ["INTC", "ASML", "lithography", 2], ["MU", "ASML", "lithography", 1],
    ["NVDA", "MU", "HBM supply", 2], ["NVDA", "MSFT", "Azure AI", 2], ["NVDA", "GOOGL", "TPU rival", 1],
    ["NVDA", "META", "GPU clusters", 2], ["NVDA", "ORCL", "OCI buildout", 1],
    ["MSFT", "ORCL", "cloud pact", 1], ["MSFT", "PLTR", "gov cloud", 1], ["GOOGL", "PLTR", "analytics", 1],
    ["AAPL", "AVGO", "RF chips", 2], ["CRM", "MSFT", "copilot rival", 1],
    ["XOM", "CVX", "permian", 1], ["XOM", "SLB", "services", 2], ["CVX", "SLB", "services", 1],
    ["COP", "EOG", "shale peers", 1], ["OXY", "COP", "permian", 1],
    ["MPC", "VLO", "refining", 2], ["PSX", "VLO", "refining", 1], ["KMI", "MPC", "midstream", 1],
    ["JPM", "GS", "banks", 1], ["JPM", "BAC", "banks", 1], ["BAC", "WFC", "banks", 1],
    ["GS", "MS", "IB peers", 2], ["BLK", "JPM", "custody", 1], ["V", "MA", "duopoly", 3],
    ["AXP", "V", "network", 1], ["PYPL", "V", "checkout", 1], ["SCHW", "BLK", "ETF dist", 1],
    ["C", "JPM", "banks", 1], ["NVDA", "AVGO", "networking", 1]
  ];

  function buildGraph(snap) {
    var nodes = [];
    var idx = {};
    snap.universe.forEach(function (g) {
      g.items.forEach(function (it) {
        idx[it.sym] = nodes.length;
        nodes.push({ sym: it.sym, name: it.name, group: g.group, chg: it.changePct, px: 0, py: 0, vx: 0, vy: 0 });
      });
    });
    var edges = EDGES.filter(function (e) { return idx[e[0]] !== undefined && idx[e[1]] !== undefined; })
      .map(function (e) { return { a: idx[e[0]], b: idx[e[1]], label: e[2], w: e[3] }; });
    return { nodes: nodes, edges: edges, idx: idx };
  }

  function layoutGraph(g) {
    /* seeded circle init by group, then 140 relaxed iterations — deterministic */
    var seed = 42;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    var groups = { "AI-TECH": 0, "ENERGY": 1, "FINANCIALS": 2 };
    var counts = { "AI-TECH": 0, "ENERGY": 0, "FINANCIALS": 0 };
    g.nodes.forEach(function (n) {
      var gi = groups[n.group];
      var base = gi * (Math.PI * 2 / 3) - Math.PI / 2;
      var a = base + (counts[n.group]++) * 0.42 + rnd() * 0.1;
      var rr = 0.30 + rnd() * 0.08;
      n.px = 0.5 + Math.cos(a) * rr;
      n.py = 0.5 + Math.sin(a) * rr;
    });
    for (var it = 0; it < 140; it++) {
      var i, j, dx, dy, d2, f;
      for (i = 0; i < g.nodes.length; i++) {
        var n = g.nodes[i];
        n.vx = (0.5 - n.px) * 0.012; n.vy = (0.5 - n.py) * 0.012;
        for (j = 0; j < g.nodes.length; j++) {
          if (i === j) { continue; }
          var m = g.nodes[j];
          dx = n.px - m.px; dy = n.py - m.py;
          d2 = dx * dx + dy * dy + 0.0004;
          f = 0.00022 / d2;
          n.vx += dx * f; n.vy += dy * f;
        }
      }
      g.edges.forEach(function (e) {
        var a = g.nodes[e.a], b = g.nodes[e.b];
        dx = b.px - a.px; dy = b.py - a.py;
        var d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
        var want = 0.16 - e.w * 0.02;
        f = (d - want) * 0.02;
        a.vx += dx / d * f; a.vy += dy / d * f;
        b.vx -= dx / d * f; b.vy -= dy / d * f;
      });
      g.nodes.forEach(function (n) {
        n.px = Math.max(0.04, Math.min(0.96, n.px + n.vx * 0.6));
        n.py = Math.max(0.05, Math.min(0.95, n.py + n.vy * 0.6));
      });
    }
  }

  var connections = {
    mount: function (body) {
      body.innerHTML = "";
      var wrap = el("div", "conn-wrap");
      var cv = el("canvas", "conn-canvas");
      wrap.appendChild(cv);
      var readout = el("div", "conn-readout", "click a node to isolate its web · lines = supply-chain / partnership links");
      body.appendChild(wrap);
      body.appendChild(readout);
      body._conn = { cv: cv, readout: readout, sel: null, graph: null, laid: false };
      cv.addEventListener("click", function (ev) {
        var st2 = body._conn;
        if (!st2 || !st2.graph) { return; }
        var rect = cv.getBoundingClientRect();
        var mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
        var W = rect.width, H = rect.height - 0;
        var hit = null, best = 16 * 16;
        st2.graph.nodes.forEach(function (n) {
          var dx = n.px * W - mx, dy = n.py * H - my;
          var d2 = dx * dx + dy * dy;
          if (d2 < best) { best = d2; hit = n; }
        });
        st2.sel = hit && st2.sel !== hit.sym ? hit.sym : null;
        connections.update(body, global.__md ? global.__md.snap : null, global.__md);
      });
    },
    update: function (body, snap, md) {
      var st = body._conn;
      if (!st || !snap) { return; }
      if (!st.graph) { st.graph = buildGraph(snap); layoutGraph(st.graph); st.laid = true; }
      /* refresh changes */
      snap.universe.forEach(function (gr) {
        gr.items.forEach(function (it) {
          var n = st.graph.nodes[st.graph.idx[it.sym]];
          if (n) { n.chg = it.changePct; }
        });
      });
      var sized = sizeCanvas(st.cv, st.cv.parentElement);
      if (!sized) { return; }
      var ctx = sized.ctx, W = sized.w, H = sized.h;
      ctx.clearRect(0, 0, W, H);
      var g = st.graph;
      var sel = st.sel;
      var linked = {};
      if (sel) {
        g.edges.forEach(function (e) {
          var A = g.nodes[e.a].sym, B = g.nodes[e.b].sym;
          if (A === sel) { linked[B] = e.label; }
          if (B === sel) { linked[A] = e.label; }
        });
      }
      /* edges */
      g.edges.forEach(function (e) {
        var a = g.nodes[e.a], b = g.nodes[e.b];
        var hot = sel && (a.sym === sel || b.sym === sel);
        ctx.strokeStyle = hot ? pal("accent", "#2aa198") : pal("dimline", "rgba(147,161,161,.35)");
        ctx.globalAlpha = sel && !hot ? 0.10 : hot ? 0.9 : 0.35;
        ctx.lineWidth = hot ? 1.4 : 0.7 + e.w * 0.25;
        ctx.beginPath();
        ctx.moveTo(a.px * W, a.py * H);
        ctx.lineTo(b.px * W, b.py * H);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      /* nodes */
      ctx.font = "600 9px ui-monospace, Menlo, monospace";
      g.nodes.forEach(function (n) {
        var x = n.px * W, y = n.py * H;
        var dim = sel && n.sym !== sel && !linked[n.sym];
        var r = 3 + Math.min(5, Math.abs(n.chg) * 1.6);
        ctx.globalAlpha = dim ? 0.18 : 1;
        ctx.fillStyle = n.chg >= 0 ? pal("up", "#859900") : pal("down", "#dc322f");
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.2832);
        ctx.fill();
        if (n.sym === sel) {
          ctx.strokeStyle = pal("bright", "#eee8d5");
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(x, y, r + 3, 0, 6.2832);
          ctx.stroke();
        }
        ctx.fillStyle = pal("axis", "rgba(147,161,161,.75)");
        ctx.textAlign = "center";
        ctx.fillText(n.sym, x, y - r - 3);
      });
      ctx.globalAlpha = 1;
      /* readout */
      st.readout.innerHTML = "";
      if (!sel) {
        st.readout.textContent = "click a node to isolate its web · " + g.nodes.length + " companies · " + g.edges.length + " links";
      } else {
        var node = g.nodes[g.idx[sel]];
        var f = fmt();
        var head = el("span", "conn-sel");
        head.textContent = node.sym + " " + node.name + "  ";
        st.readout.appendChild(head);
        var chg = el("span", f.cls(node.chg));
        chg.textContent = f.arrow(node.chg) + " " + f.pct(node.chg);
        st.readout.appendChild(chg);
        Object.keys(linked).forEach(function (k) {
          var tag = el("span", "conn-tag", k + " · " + linked[k]);
          st.readout.appendChild(tag);
        });
      }
    }
  };

  /* ==========================================================================
   * SECTORS — drill-down: group -> sub-industry -> members
   * ======================================================================== */
  var SUBS = {
    "NVDA": "AI accelerators", "AMD": "AI accelerators", "INTC": "CPUs / foundry",
    "TSM": "Foundry", "ASML": "Lithography", "MU": "Memory / HBM",
    "AVGO": "Networking / RF", "AAPL": "Devices", "MSFT": "Hyperscale cloud",
    "GOOGL": "Hyperscale cloud", "META": "Consumer AI", "ORCL": "Cloud infra",
    "CRM": "Enterprise SaaS", "PLTR": "AI analytics",
    "XOM": "Integrated majors", "CVX": "Integrated majors", "COP": "E&P shale",
    "EOG": "E&P shale", "OXY": "E&P shale", "SLB": "Oilfield services",
    "MPC": "Refining", "PSX": "Refining", "VLO": "Refining", "KMI": "Midstream",
    "JPM": "Money-center banks", "BAC": "Money-center banks", "WFC": "Money-center banks",
    "C": "Money-center banks", "GS": "Investment banks", "MS": "Investment banks",
    "BLK": "Asset management", "SCHW": "Brokerage", "V": "Payments networks",
    "MA": "Payments networks", "AXP": "Payments networks", "PYPL": "Digital payments"
  };

  var sectors = {
    mount: function (body) {
      body.innerHTML = "";
      body._sectors = { open: { "AI-TECH": true } };
      var wrap = el("div", "drill");
      body.appendChild(wrap);
    },
    update: function (body, snap) {
      var st = body._sectors;
      if (!st) { return; }
      var f = fmt();
      var wrap = body.querySelector(".drill");
      wrap.innerHTML = "";
      snap.universe.forEach(function (g) {
        var open = !!st.open[g.group];
        var avg = g.items.reduce(function (a, it) { return a + it.changePct; }, 0) / g.items.length;
        var adv = g.items.filter(function (it) { return it.changePct > 0; }).length;
        var head = el("button", "drill-head" + (open ? " open" : ""));
        head.type = "button";
        var caret = el("span", "drill-caret", open ? "▾" : "▸");
        var name = el("span", "drill-name", g.group);
        var br = el("span", "drill-breadth", adv + "/" + g.items.length + " up");
        var val = el("span", "drill-val " + f.cls(avg), f.arrow(avg) + " " + f.pct(avg));
        head.appendChild(caret); head.appendChild(name); head.appendChild(br); head.appendChild(val);
        head.addEventListener("click", function () {
          st.open[g.group] = !st.open[g.group];
          sectors.update(body, snap);
        });
        wrap.appendChild(head);
        if (!open) { return; }

        /* aggregate sub-industries */
        var subs = {};
        g.items.forEach(function (it) {
          var s = SUBS[it.sym] || "Other";
          if (!subs[s]) { subs[s] = { name: s, items: [] }; }
          subs[s].items.push(it);
        });
        var maxAbs = 0.4;
        Object.keys(subs).forEach(function (k) {
          subs[k].items.forEach(function (it) {
            if (Math.abs(it.changePct) > maxAbs) { maxAbs = Math.abs(it.changePct); }
          });
        });
        Object.keys(subs).sort(function (a, b) {
          var av = subs[b].items.reduce(function (x, i) { return x + i.changePct; }, 0) / subs[b].items.length -
                   subs[a].items.reduce(function (x, i) { return x + i.changePct; }, 0) / subs[a].items.length;
          return av;
        }).forEach(function (k) {
          var s = subs[k];
          var savg = s.items.reduce(function (a, it) { return a + it.changePct; }, 0) / s.items.length;
          var row = el("div", "drill-sub");
          var lbl = el("span", "drill-sub-name", s.name);
          var barWrap = el("span", "drill-bar");
          var mid = el("span", "drill-bar-mid");
          barWrap.appendChild(mid);
          var fill = el("span", "drill-bar-fill " + (savg >= 0 ? "up" : "down"));
          var pct = Math.min(50, Math.abs(savg) / maxAbs * 50);
          fill.style[savg >= 0 ? "left" : "right"] = "50%";
          fill.style.width = pct + "%";
          barWrap.appendChild(fill);
          var num = el("span", "drill-sub-val " + f.cls(savg), f.pct(savg));
          row.appendChild(lbl); row.appendChild(barWrap); row.appendChild(num);
          wrap.appendChild(row);
          var members = el("div", "drill-members",
            s.items.map(function (it) {
              return it.sym + " " + (it.changePct >= 0 ? "+" : "") + it.changePct.toFixed(2) + "%";
            }).join("   "));
          wrap.appendChild(members);
        });
      });
    }
  };

  /* ==========================================================================
   * IPO — fixture calendar: FILED / EXPECTED / PRICED
   * ======================================================================== */
  var IPO_FIXTURES = [
    ["2026-08-06", "Axiom Space Infrastructure", "AXSI", "NASDAQ", 720, "21.00–24.00", "PRICED", "Space infra"],
    ["2026-08-07", "Helios Grid Storage", "HLGS", "NYSE", 540, "18.00–21.00", "PRICED", "Energy storage"],
    ["2026-08-12", "Meridian Robotics", "MRBT", "NASDAQ", 860, "26.00–30.00", "EXPECTED", "Robotics"],
    ["2026-08-14", "Cobalt AI Systems", "COAI", "NYSE", 1250, "34.00–38.00", "EXPECTED", "AI infra"],
    ["2026-08-19", "Nordwind Renewables", "NWR", "STO", 480, "112–128 SEK", "EXPECTED", "Renewables"],
    ["2026-08-21", "Kestrel Semiconductor", "KSEM", "NASDAQ", 690, "22.00–25.00", "EXPECTED", "Semis"],
    ["2026-08-27", "Alto Freight OS", "ALTO", "NYSE", 310, "16.00–19.00", "EXPECTED", "Logistics SaaS"],
    ["2026-09-02", "Sable Biotherapeutics", "SBTX", "NASDAQ", 265, "14.00–17.00", "FILED", "Biotech"],
    ["2026-09-09", "Granite Point Re", "GPRE", "NYSE", 590, "28.00–32.00", "FILED", "Insurance"],
    ["2026-09-11", "Lumen Foundry Works", "LMFW", "TSE", 410, "2,400–2,800 JPY", "FILED", "Advanced mfg"],
    ["2026-09-16", "Vantage Quantum", "VNTQ", "NASDAQ", 380, "19.00–23.00", "FILED", "Quantum"],
    ["2026-09-23", "Harborline LNG", "HLNG", "NYSE", 930, "25.00–29.00", "FILED", "LNG shipping"],
    ["2026-09-30", "Aurora Payments Group", "AUPG", "LSE", 610, "410–470 GBp", "FILED", "Fintech"],
    ["2026-10-08", "Terran Orbital Dynamics", "TROD", "NASDAQ", 350, "17.00–20.00", "FILED", "Space"]
  ];
  var IPO_FILTERS = ["ALL", "EXPECTED", "FILED", "PRICED"];

  var ipo = {
    mount: function (body) {
      body.innerHTML = "";
      body._ipo = { filter: "ALL" };
      var chips = el("div", "chip-row");
      IPO_FILTERS.forEach(function (cat) {
        var c = el("button", "chip" + (cat === "ALL" ? " active" : ""), cat);
        c.type = "button";
        c.dataset.cat = cat;
        c.addEventListener("click", function () {
          body._ipo.filter = cat;
          Array.prototype.forEach.call(chips.children, function (x) {
            x.classList.toggle("active", x.dataset.cat === cat);
          });
          ipo.update(body, null);
        });
        chips.appendChild(c);
      });
      body.appendChild(chips);
      var list = el("div", "ipo-list");
      body.appendChild(list);
    },
    update: function (body) {
      var st = body._ipo;
      if (!st) { return; }
      var list = body.querySelector(".ipo-list");
      list.innerHTML = "";
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      IPO_FIXTURES.forEach(function (r) {
        if (st.filter !== "ALL" && r[6] !== st.filter) { return; }
        var d = new Date(r[0] + "T00:00:00");
        var days = Math.round((d - today) / 864e5);
        var row = el("div", "ipo-row");
        var date = el("span", "ipo-date",
          d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
        var main = el("span", "ipo-main");
        main.appendChild(el("span", "ipo-name", r[1]));
        main.appendChild(el("span", "ipo-sub",
          r[2] + " · " + r[3] + " · $" + r[4] + "M · " + r[5] + " · " + r[7]));
        var right = el("span", "ipo-right");
        var when = el("span", "ipo-when",
          days < 0 ? "T" + days : days === 0 ? "TODAY" : "T+" + days);
        var chip = el("span", "ipo-status ipo-" + r[6].toLowerCase(), r[6]);
        right.appendChild(when);
        right.appendChild(chip);
        row.appendChild(date); row.appendChild(main); row.appendChild(right);
        list.appendChild(row);
      });
      if (!list.children.length) {
        list.appendChild(el("div", "ipo-empty", "no " + st.filter.toLowerCase() + " deals in the window"));
      }
    }
  };

  /* ==========================================================================
   * LISTS — custom watchlists, persisted to localStorage
   * ======================================================================== */
  var LISTS_KEY = "tmd.lists.v1";

  function loadLists() {
    try {
      var raw = localStorage.getItem(LISTS_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.lists && Object.keys(p.lists).length) { return p; }
      }
    } catch (e) { /* noop */ }
    return { active: "CORE", lists: { CORE: ["NVDA", "AAPL", "XOM", "JPM", "TSM"] } };
  }
  function saveLists(st) {
    try { localStorage.setItem(LISTS_KEY, JSON.stringify(st)); } catch (e) { /* noop */ }
    if (global.Cloud) { Cloud.pushLists(st); }
  }

  var lists = {
    mount: function (body) {
      body.innerHTML = "";
      body._lists = loadLists();
      var bar = el("div", "list-bar");
      var chips = el("div", "chip-row list-chips");
      bar.appendChild(chips);
      body.appendChild(bar);
      var addRow = el("div", "list-add");
      var input = el("input", "list-input");
      input.placeholder = "add symbol…";
      input.setAttribute("list", "wl-syms");
      var dl = el("datalist");
      dl.id = "wl-syms";
      var btn = el("button", "chip list-add-btn", "+ ADD");
      btn.type = "button";
      var newBtn = el("button", "chip list-new-btn", "NEW LIST");
      newBtn.type = "button";
      addRow.appendChild(input); addRow.appendChild(dl); addRow.appendChild(btn); addRow.appendChild(newBtn);
      body.appendChild(addRow);
      var table = el("div", "list-table");
      body.appendChild(table);

      btn.addEventListener("click", function () {
        var st = body._lists;
        var sym = input.value.trim().toUpperCase();
        input.value = "";
        if (!sym || !body._wlSyms || body._wlSyms.indexOf(sym) === -1) { return; }
        var arr = st.lists[st.active];
        if (arr.indexOf(sym) === -1) { arr.push(sym); saveLists(st); }
        lists.update(body, global.__md ? global.__md.snap : null);
      });
      input.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") { btn.click(); }
      });
      newBtn.addEventListener("click", function () {
        var st = body._lists;
        var base = "LIST";
        var i = Object.keys(st.lists).length + 1;
        var name = base + i;
        while (st.lists[name]) { i++; name = base + i; }
        st.lists[name] = [];
        st.active = name;
        saveLists(st);
        lists.update(body, global.__md ? global.__md.snap : null);
      });
    },
    update: function (body, snap) {
      var st = body._lists;
      if (!st) { return; }
      if (!st.lists[st.active]) { st.active = Object.keys(st.lists)[0]; }
      var f = fmt();
      /* symbol universe lookup */
      var lookup = {};
      if (snap) {
        snap.universe.forEach(function (g) {
          g.items.forEach(function (it) { lookup[it.sym] = it; });
        });
      }
      body._wlSyms = Object.keys(lookup);
      var dl = body.querySelector("#wl-syms");
      if (dl && !dl.children.length) {
        body._wlSyms.forEach(function (s) {
          var o = el("option"); o.value = s; dl.appendChild(o);
        });
      }
      /* chips */
      var chips = body.querySelector(".list-chips");
      chips.innerHTML = "";
      Object.keys(st.lists).forEach(function (name) {
        var c = el("button", "chip" + (name === st.active ? " active" : ""),
          name + " (" + st.lists[name].length + ")");
        c.type = "button";
        c.addEventListener("click", function () {
          st.active = name; saveLists(st);
          lists.update(body, snap);
        });
        chips.appendChild(c);
        if (Object.keys(st.lists).length > 1) {
          var x = el("button", "chip list-del", "×");
          x.type = "button";
          x.title = "delete " + name;
          x.addEventListener("click", function () {
            delete st.lists[name];
            if (st.active === name) { st.active = Object.keys(st.lists)[0]; }
            saveLists(st);
            lists.update(body, snap);
          });
          chips.appendChild(x);
        }
      });
      /* table */
      var table = body.querySelector(".list-table");
      table.innerHTML = "";
      var arr = st.lists[st.active];
      if (!arr.length) {
        table.appendChild(el("div", "list-empty", "empty — add symbols above"));
        return;
      }
      arr.forEach(function (sym) {
        var it = lookup[sym];
        var row = el("div", "list-row");
        var s1 = el("span", "list-sym", sym);
        var s2 = el("span", "list-name", it ? it.name : "—");
        var s3 = el("span", "list-price", it ? f.num(it.price) : "—");
        var s4 = el("span", "list-chg " + (it ? f.cls(it.changePct) : ""),
          it ? f.arrow(it.changePct) + " " + f.pct(it.changePct) : "");
        var spark = el("canvas", "list-spark");
        var rm = el("button", "list-rm", "×");
        rm.type = "button";
        rm.title = "remove " + sym;
        rm.addEventListener("click", function () {
          var i = arr.indexOf(sym);
          if (i > -1) { arr.splice(i, 1); saveLists(st); }
          lists.update(body, snap);
        });
        row.appendChild(s1); row.appendChild(s2); row.appendChild(spark);
        row.appendChild(s3); row.appendChild(s4); row.appendChild(rm);
        table.appendChild(row);
        if (it && it.series) {
          global.Widgets._drawSpark(spark, it.series, it.changePct >= 0);
        }
      });
    }
  };

  /* merge into the widget registry */
  global.Widgets.worldmap = worldmap;
  global.Widgets.connections = connections;
  global.Widgets.sectors = sectors;
  global.Widgets.ipo = ipo;
  global.Widgets.lists = lists;
})(window);
/* ==========================================================================
 * nodecanvas.js — infinite-canvas node graph for pluggable data sources
 * pan (drag bg) · wheel zoom to cursor · drag tiles · port-to-port wires
 * persists to localStorage "tmd.nodegraph.v1"
 * ======================================================================== */
(function (global) {
  "use strict";

  var STORE_KEY = "tmd.nodegraph.v1";
  var DS = global.DataSources;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- state ---------------------------------------------------- */
  var state = {
    world: { x: 0, y: 0, k: 1 },
    nodes: [],      // { uid, src, x, y }
    edges: [],      // { id, from, to }
    selected: null, // uid
    uidSeq: 1
  };

  var stage, worldEl, edgeSvg, tempPath, paletteEl, inspectorEl, statsEl, zoomLabel;

  /* ---------- persistence ---------------------------------------------- */
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        world: state.world, nodes: state.nodes, edges: state.edges, uidSeq: state.uidSeq
      }));
    } catch (e) { /* noop */ }
    renderStats();
  }
  function load() {
    try {
      var p = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (p && p.nodes && p.nodes.length) {
        state.world = p.world || state.world;
        state.nodes = p.nodes;
        state.edges = p.edges || [];
        state.uidSeq = p.uidSeq || (p.nodes.length + 1);
        return true;
      }
    } catch (e) { /* noop */ }
    return false;
  }

  function seed() {
    /* first-run example wiring */
    state.nodes = [];
    state.edges = [];
    var seeds = [
      { src: "stooq",    x: -560, y: -140 }, { src: "yahoo",  x: -560, y: 20 },
      { src: "fred",     x: -560, y: 180 }, { src: "coingecko", x: -560, y: 340 },
      { src: "edgar",    x: -300, y: 260 },
      { src: "sink-tape",    x: 60, y: -140 }, { src: "sink-ticker", x: 60, y: 0 },
      { src: "sink-news",    x: 60, y: 160 }, { src: "sink-strategy", x: 60, y: 320 }
    ];
    seeds.forEach(function (s) { addNode(s.src, s.x, s.y, true); });
    var bySrc = function (src) {
      return state.nodes.find(function (n) { return n.src === src; });
    };
    [["stooq", "sink-tape"], ["yahoo", "sink-ticker"], ["fred", "sink-strategy"],
     ["coingecko", "sink-tape"], ["edgar", "sink-news"]].forEach(function (pair) {
      var a = bySrc(pair[0]), b = bySrc(pair[1]);
      if (a && b) { state.edges.push({ id: "e" + a.uid + "-" + b.uid, from: a.uid, to: b.uid }); }
    });
  }

  /* ---------- coordinate helpers --------------------------------------- */
  function toWorld(clientX, clientY) {
    var r = stage.getBoundingClientRect();
    return {
      x: (clientX - r.left - state.world.x) / state.world.k,
      y: (clientY - r.top - state.world.y) / state.world.k
    };
  }
  function applyWorld() {
    var w = state.world;
    worldEl.style.transform = "translate(" + w.x + "px," + w.y + "px) scale(" + w.k + ")";
    edgeSvg.setAttribute("viewBox",
      (-w.x / w.k) + " " + (-w.y / w.k) + " " + (stage.clientWidth / w.k) + " " + (stage.clientHeight / w.k));
    /* grid follows world */
    var size = 48 * w.k;
    stage.style.backgroundSize = size + "px " + size + "px";
    stage.style.backgroundPosition = w.x + "px " + w.y + "px";
    if (zoomLabel) { zoomLabel.textContent = Math.round(w.k * 100) + "%"; }
  }

  /* ---------- node DOM -------------------------------------------------- */
  var nodeEls = {}; // uid -> element

  function portPos(uid, isOut) {
    var n = state.nodes.find(function (x) { return x.uid === uid; });
    if (!n) { return { x: 0, y: 0 }; }
    return { x: n.x + (isOut ? 216 : 0), y: n.y + 34 };
  }

  function addNode(srcId, x, y, silent, keepUid) {
    var def = DS.get(srcId);
    if (!def) { return null; }
    var uid = keepUid || ("n" + (state.uidSeq++));
    var uidNum = parseInt(uid.slice(1), 10);
    if (uidNum >= state.uidSeq) { state.uidSeq = uidNum + 1; }
    var node = { uid: uid, src: srcId, x: x, y: y };
    state.nodes.push(node);

    var isSink = def.cat === "sink";
    var eln = el("div", "nc-node" + (isSink ? " nc-sink" : ""));
    eln.dataset.uid = uid;
    eln.style.left = x + "px";
    eln.style.top = y + "px";
    eln.style.setProperty("--nc-accent", DS.catColor(def.cat));

    var head = el("div", "nc-node-head");
    head.appendChild(el("span", "nc-node-dot"));
    head.appendChild(el("span", "nc-node-name", def.name));
    var rm = el("button", "nc-node-rm", "×");
    rm.type = "button";
    rm.title = "remove node";
    head.appendChild(rm);
    eln.appendChild(head);

    var meta = el("div", "nc-node-meta");
    meta.textContent = isSink
      ? "consumer · " + (def.note || "")
      : def.proto + " · auth:" + def.auth + " · " + def.latency;
    eln.appendChild(meta);

    var foot = el("div", "nc-node-foot");
    foot.appendChild(el("span", "nc-node-cat", DS.catName(def.cat)));
    eln.appendChild(foot);

    /* ports */
    if (!isSink) {
      var out = el("span", "nc-port nc-port-out");
      out.title = "drag to a panel input to plug in";
      eln.appendChild(out);
      wirePort(out, uid, true);
    }
    if (isSink) {
      var inp = el("span", "nc-port nc-port-in");
      inp.title = "drop a source wire here";
      eln.appendChild(inp);
      wirePort(inp, uid, false);
    }

    rm.addEventListener("click", function (e) {
      e.stopPropagation();
      removeNode(uid);
    });

    /* drag node */
    head.addEventListener("mousedown", function (e) {
      if (e.button !== 0 || e.target === rm) { return; }
      e.stopPropagation();
      select(uid);
      var w0 = toWorld(e.clientX, e.clientY);
      var ox = node.x, oy = node.y;
      function move(ev) {
        var w = toWorld(ev.clientX, ev.clientY);
        node.x = ox + (w.x - w0.x);
        node.y = oy + (w.y - w0.y);
        eln.style.left = node.x + "px";
        eln.style.top = node.y + "px";
        drawEdges();
      }
      function up() {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        save();
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
    eln.addEventListener("mousedown", function () { select(uid); });

    worldEl.appendChild(eln);
    nodeEls[uid] = eln;
    if (!silent) { save(); }
    drawEdges();
    return node;
  }

  function removeNode(uid) {
    var n = nodeEls[uid];
    if (n) { n.remove(); delete nodeEls[uid]; }
    state.nodes = state.nodes.filter(function (x) { return x.uid !== uid; });
    state.edges = state.edges.filter(function (e) { return e.from !== uid && e.to !== uid; });
    if (state.selected === uid) { state.selected = null; renderInspector(); }
    save();
    drawEdges();
  }

  /* ---------- edges ------------------------------------------------------ */
  function edgePath(from, to) {
    var a = portPos(from, true), b = portPos(to, false);
    var dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
    return "M " + a.x + " " + a.y +
           " C " + (a.x + dx) + " " + a.y + ", " + (b.x - dx) + " " + b.y + ", " +
           b.x + " " + b.y;
  }

  function drawEdges() {
    edgeSvg.querySelectorAll("path.nc-edge").forEach(function (p) { p.remove(); });
    state.edges.forEach(function (e) {
      var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", edgePath(e.from, e.to));
      p.setAttribute("class", "nc-edge");
      p.dataset.id = e.id;
      p.addEventListener("click", function () {
        if (confirm("remove wire " + e.id + "?")) {
          state.edges = state.edges.filter(function (x) { return x.id !== e.id; });
          save(); drawEdges();
        }
      });
      edgeSvg.appendChild(p);
    });
  }

  function wirePort(portEl, uid, isOut) {
    portEl.addEventListener("mousedown", function (e) {
      if (!isOut || e.button !== 0) { return; }
      e.stopPropagation();
      e.preventDefault();
      var a = portPos(uid, true);
      tempPath.style.display = "";
      function move(ev) {
        var w = toWorld(ev.clientX, ev.clientY);
        var dx = Math.max(40, Math.abs(w.x - a.x) * 0.5);
        tempPath.setAttribute("d",
          "M " + a.x + " " + a.y +
          " C " + (a.x + dx) + " " + a.y + ", " + (w.x - dx) + " " + w.y + ", " + w.x + " " + w.y);
        /* highlight sink under cursor */
        document.querySelectorAll(".nc-node.nc-sink").forEach(function (s) {
          var r = s.getBoundingClientRect();
          var hot = ev.clientX >= r.left && ev.clientX <= r.right &&
                    ev.clientY >= r.top && ev.clientY <= r.bottom;
          s.classList.toggle("nc-hot", hot);
        });
      }
      function up(ev) {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        tempPath.style.display = "none";
        var target = null;
        document.querySelectorAll(".nc-node.nc-sink").forEach(function (s) {
          s.classList.remove("nc-hot");
          var r = s.getBoundingClientRect();
          if (ev.clientX >= r.left && ev.clientX <= r.right &&
              ev.clientY >= r.top && ev.clientY <= r.bottom) {
            target = s.dataset.uid;
          }
        });
        if (target && target !== uid) {
          var id = "e" + uid + "-" + target;
          state.edges = state.edges.filter(function (x) { return x.id !== id; });
          state.edges.push({ id: id, from: uid, to: target });
          save(); drawEdges();
        }
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }

  /* ---------- selection / inspector -------------------------------------- */
  function select(uid) {
    state.selected = uid;
    Object.keys(nodeEls).forEach(function (k) {
      nodeEls[k].classList.toggle("nc-selected", k === uid);
    });
    renderInspector();
  }

  function renderInspector() {
    if (!inspectorEl) { return; }
    inspectorEl.innerHTML = "";
    var n = state.nodes.find(function (x) { return x.uid === state.selected; });
    if (!n) {
      inspectorEl.appendChild(el("div", "nc-insp-hint",
        "click a tile to inspect · drag a tile's right port onto a TERMINAL PANEL tile to plug it in"));
      return;
    }
    var def = DS.get(n.src);
    inspectorEl.appendChild(el("div", "nc-insp-title", def.name));
    var rows = [
      ["category", DS.catName(def.cat)],
      ["node id", n.uid],
      ["position", Math.round(n.x) + ", " + Math.round(n.y)]
    ];
    if (def.base) { rows.push(["endpoint", def.base]); }
    if (def.proto) { rows.push(["protocol", def.proto]); }
    if (def.auth) { rows.push(["auth", def.auth]); }
    if (def.latency) { rows.push(["latency", def.latency]); }
    if (def.note) { rows.push(["note", def.note]); }
    rows.forEach(function (r) {
      var row = el("div", "nc-insp-row");
      row.appendChild(el("span", "nc-insp-k", r[0]));
      row.appendChild(el("span", "nc-insp-v", r[1]));
      inspectorEl.appendChild(row);
    });
    var wires = state.edges.filter(function (e) { return e.from === n.uid || e.to === n.uid; });
    var w = el("div", "nc-insp-wires");
    if (wires.length) {
      w.appendChild(el("div", "nc-insp-k", "wires"));
      wires.forEach(function (e) {
        var other = e.from === n.uid ? e.to : e.from;
        var od = DS.get((state.nodes.find(function (x) { return x.uid === other; }) || {}).src) || { name: other };
        var row = el("div", "nc-insp-wire",
          (e.from === n.uid ? "→ " : "← ") + od.name);
        inspectorEl.appendChild(row);
      });
    } else {
      w.appendChild(el("div", "nc-insp-k", "wires: none — unplugged"));
      inspectorEl.appendChild(w);
    }
    if (def.auth === "apikey") {
      var keyRow = el("div", "nc-keyrow");
      var inp = el("input", "nc-keyin");
      inp.type = "password";
      inp.placeholder = "paste API key (stays in browser)";
      inp.value = localStorage.getItem("tmd.nkey." + n.src) || "";
      var btn = el("button", "pill-btn", "SAVE");
      btn.type = "button";
      btn.addEventListener("click", function () {
        try { localStorage.setItem("tmd.nkey." + n.src, inp.value.trim()); } catch (e) { /* noop */ }
        btn.textContent = "SAVED";
        setTimeout(function () { btn.textContent = "SAVE"; }, 900);
      });
      keyRow.appendChild(inp);
      keyRow.appendChild(btn);
      inspectorEl.appendChild(keyRow);
    }
  }

  /* ---------- stats / palette --------------------------------------------- */
  function renderStats() {
    if (!statsEl) { return; }
    var placed = {};
    state.nodes.forEach(function (n) {
      var d = DS.get(n.src);
      if (d && d.cat !== "sink") { placed[n.src] = (placed[n.src] || 0) + 1; }
    });
    var wired = state.edges.length;
    statsEl.textContent = state.nodes.length + " tiles · " + wired + " wires · " +
      Object.keys(placed).length + " sources plugged";
  }

  function renderPalette() {
    paletteEl.innerHTML = "";
    var q = (paletteEl._q || "").toLowerCase();
    DS.cats.forEach(function (cat) {
      if (cat.id === "sink") { return; }
      var items = DS.sources.filter(function (s) {
        return s.cat === cat.id &&
          (!q || s.name.toLowerCase().indexOf(q) > -1 || s.base.toLowerCase().indexOf(q) > -1);
      });
      if (!items.length) { return; }
      var head = el("div", "nc-pal-cat", cat.name + " · " + items.length);
      head.style.setProperty("--nc-accent", cat.color);
      paletteEl.appendChild(head);
      items.forEach(function (s) {
        var count = state.nodes.filter(function (n) { return n.src === s.id; }).length;
        var it = el("button", "nc-pal-item" + (count ? " placed" : ""));
        it.type = "button";
        it.title = s.base + "\n" + s.note;
        var nm = el("span", "nc-pal-name", s.name);
        var meta = el("span", "nc-pal-meta", s.proto + " · " + s.auth + (count ? " · ×" + count : ""));
        it.appendChild(nm);
        it.appendChild(meta);
        it.addEventListener("click", function () { addFromPalette(s.id); });
        paletteEl.appendChild(it);
      });
    });
  }

  function addFromPalette(srcId) {
    /* place at viewport center with a small jitter */
    var r = stage.getBoundingClientRect();
    var cx = (r.width / 2 - state.world.x) / state.world.k;
    var cy = (r.height / 2 - state.world.y) / state.world.k;
    var j = (state.nodes.length % 5) * 24;
    var n = addNode(srcId, Math.round(cx - 108 + j), Math.round(cy - 30 + j));
    if (n) { select(n.uid); renderPalette(); }
  }

  /* ---------- pan / zoom ---------------------------------------------------- */
  function bindStage() {
    var panning = null;
    stage.addEventListener("mousedown", function (e) {
      if (e.target !== stage && e.target !== edgeSvg && !e.target.classList.contains("nc-bg-hit")) { return; }
      if (e.button !== 0 && e.button !== 1) { return; }
      e.preventDefault();
      panning = { x: e.clientX, y: e.clientY, wx: state.world.x, wy: state.world.y };
      stage.classList.add("nc-panning");
    });
    document.addEventListener("mousemove", function (e) {
      if (!panning) { return; }
      state.world.x = panning.wx + (e.clientX - panning.x);
      state.world.y = panning.wy + (e.clientY - panning.y);
      applyWorld();
    });
    document.addEventListener("mouseup", function () {
      if (panning) { panning = null; stage.classList.remove("nc-panning"); save(); }
    });

    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      var r = stage.getBoundingClientRect();
      var mx = e.clientX - r.left, my = e.clientY - r.top;
      var k0 = state.world.k;
      var k1 = clamp(k0 * (e.deltaY < 0 ? 1.1 : 0.9), 0.25, 2.5);
      /* keep cursor anchored */
      state.world.x = mx - ((mx - state.world.x) / k0) * k1;
      state.world.y = my - ((my - state.world.y) / k0) * k1;
      state.world.k = k1;
      applyWorld();
    }, { passive: false });

    /* click empty bg = deselect */
    stage.addEventListener("click", function (e) {
      if (e.target === stage || e.target === edgeSvg) { select(null); }
    });
  }

  /* ---------- boot ------------------------------------------------------------ */
  function boot() {
    stage = document.getElementById("nc-stage");
    worldEl = document.getElementById("nc-world");
    edgeSvg = document.getElementById("nc-edges");
    paletteEl = document.getElementById("nc-palette");
    inspectorEl = document.getElementById("nc-inspector");
    statsEl = document.getElementById("nc-stats");
    zoomLabel = document.getElementById("nc-zoom");

    tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tempPath.setAttribute("class", "nc-edge nc-edge-temp");
    tempPath.style.display = "none";
    edgeSvg.appendChild(tempPath);

    var had = load();
    if (!had) {
      state.world = { x: stage.clientWidth / 2 + 40, y: stage.clientHeight / 2 - 180, k: 1 };
      seed();
    } else {
      /* rebuild DOM for loaded nodes, preserving uids so wires stay valid */
      var snapshot = state.nodes.slice();
      state.nodes = [];
      snapshot.forEach(function (n) { addNode(n.src, n.x, n.y, true, n.uid); });
    }
    applyWorld();
    drawEdges();

    bindStage();
    renderPalette();
    renderStats();

    /* palette search */
    var search = document.getElementById("nc-search");
    if (search) {
      search.addEventListener("input", function () {
        paletteEl._q = search.value.trim();
        renderPalette();
      });
    }

    /* toolbar */
    var fitBtn = document.getElementById("nc-fit");
    if (fitBtn) {
      fitBtn.addEventListener("click", function () {
        if (!state.nodes.length) { return; }
        var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        state.nodes.forEach(function (n) {
          x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y);
          x1 = Math.max(x1, n.x + 216); y1 = Math.max(y1, n.y + 80);
        });
        var pad = 80;
        var kx = stage.clientWidth / (x1 - x0 + pad * 2);
        var ky = stage.clientHeight / (y1 - y0 + pad * 2);
        state.world.k = clamp(Math.min(kx, ky), 0.25, 2.5);
        state.world.x = pad * state.world.k - x0 * state.world.k +
          (stage.clientWidth - (x1 - x0 + pad * 2) * state.world.k) / 2;
        state.world.y = pad * state.world.k - y0 * state.world.k +
          (stage.clientHeight - (y1 - y0 + pad * 2) * state.world.k) / 2;
        applyWorld(); save();
      });
    }
    var clearBtn = document.getElementById("nc-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (!confirm("clear the whole canvas? (nodes + wires)")) { return; }
        try { localStorage.removeItem(STORE_KEY); } catch (e) { /* noop */ }
        state.nodes.slice().forEach(function (n) { removeNode(n.uid); });
        state.world = { x: stage.clientWidth / 2 + 40, y: stage.clientHeight / 2 - 180, k: 1 };
        seed();
        applyWorld(); drawEdges(); save(); renderPalette(); renderInspector();
      });
    }
    var sinkBtn = document.getElementById("nc-addsink");
    if (sinkBtn) {
      sinkBtn.addEventListener("click", function () {
        var menu = DS.sinks.filter(function (s) {
          return !state.nodes.some(function (n) { return n.src === s.id; });
        });
        if (!menu.length) { return; }
        addFromPalette(menu[0].id);
      });
    }

    window.addEventListener("resize", applyWorld);
  }

  global.NodeCanvas = { boot: boot };
})(window);

/* ==========================================================================
 * widgets.js — dense terminal renderers (10 views, dependency-free)
 * ======================================================================== */
(function (global) {
  "use strict";

  var fmt = {
    num: function (n) {
      return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    pct: function (p) { return (p >= 0 ? "+" : "") + p.toFixed(2) + "%"; },
    chg: function (c) { return (c >= 0 ? "+" : "-") + fmt.num(Math.abs(c)); },
    arrow: function (p) { return p >= 0 ? "▲" : "▼"; },
    cls: function (p) { return p >= 0 ? "up" : "down"; }
  };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }

  /* tick flash — brief green/red glow when a value changes */
  // Theme-aware color helpers (Themes from js/themes.js)
  function cT(key, fallback) { return (global.Themes && Themes.c(key)) || fallback; }
  function rgbaUp(a) { return "rgba(" + (global.Themes ? Themes.c("upRGB") : "133,153,0") + "," + a + ")"; }
  function rgbaDn(a) { return "rgba(" + (global.Themes ? Themes.c("downRGB") : "220,50,47") + "," + a + ")"; }
  function rgbaAc(a) { return "rgba(" + (global.Themes ? Themes.c("accentRGB") : "38,139,210") + "," + a + ")"; }
  function rgbaWn(a) { return "rgba(" + (global.Themes ? Themes.c("warnRGB") : "181,137,0") + "," + a + ")"; }
  function rgbaDim(a) { return "rgba(" + (global.Themes ? Themes.c("dimRGB") : "147,161,161") + "," + a + ")"; }

  function flash(elm, dir) {
    elm.classList.remove("flash-up", "flash-down");
    void elm.offsetWidth; /* restart animation */
    elm.classList.add(dir >= 0 ? "flash-up" : "flash-down");
  }

  function drawSparkline(canvas, series, up, color) {
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) { return; }
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    var closes = series.map(function (d) { return d.c !== undefined ? d.c : d; });
    var min = Math.min.apply(null, closes), max = Math.max.apply(null, closes);
    var span = (max - min) || 1;
    var pad = 2;
    ctx.beginPath();
    closes.forEach(function (c, i) {
      var x = pad + (i / (closes.length - 1)) * (w - pad * 2);
      var y = h - pad - ((c - min) / span) * (h - pad * 2);
      if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
    });
    var col = color || (up ? cT("up", "#859900") : cT("down", "#dc322f"));
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.4;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  /* ======================================================================
   * 01 — GLOBAL TICKER (dense table, click row → focus)
   * ==================================================================== */
  var ticker = {
    mount: function (root, snap, md) {
      root.innerHTML = "";
      var tbl = el("table", "tt");
      tbl.innerHTML =
        "<thead><tr><th>SYM</th><th>NAME</th><th class='r'>LAST</th>" +
        "<th class='r'>CHG</th><th class='r'>CHG%</th><th>STATE</th>" +
        "<th>SRC</th><th class='r'>AS-OF</th></tr></thead>";
      var tb = el("tbody");
      snap.tape.forEach(function (t) {
        var tr = el("tr", "tt-row");
        tr.dataset.sym = t.sym;
        tr.appendChild(el("td", "tt-sym", t.sym));
        tr.appendChild(el("td", "tt-name", t.name));
        tr.appendChild(el("td", "r tt-price", fmt.num(t.price)));
        tr.appendChild(el("td", "r tt-chg " + fmt.cls(t.changePct), fmt.arrow(t.changePct) + " " + fmt.chg(t.change)));
        tr.appendChild(el("td", "r tt-pct " + fmt.cls(t.changePct), fmt.pct(t.changePct)));
        var st = el("td");
        st.appendChild(el("span", "state-chip", "···"));
        tr.appendChild(st);
        tr.appendChild(el("td", "tt-src", t.src));
        tr.appendChild(el("td", "r tt-asof", "--:--"));
        tr.addEventListener("click", function () {
          var prev = root.querySelector(".tt-row.focus");
          if (prev) { prev.classList.remove("focus"); }
          tr.classList.add("focus");
          var out = root.parentElement.querySelector(".card-focus");
          if (out) {
            out.textContent = "❯ focus: " + t.sym + " @ " + fmt.num(t.price);
          }
        });
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      root.appendChild(tbl);
      var foot = el("div", "card-foot");
      foot.textContent = "click row → focus asset · fixed-width tabular columns prevent digit jitter";
      root.appendChild(foot);
      this.update(root, snap, md);
    },
    update: function (root, snap, md) {
      snap.tape.forEach(function (t) {
        var tr = root.querySelector('[data-sym="' + t.sym + '"]');
        if (!tr) { return; }
        var priceCell = tr.querySelector(".tt-price");
        var prev = priceCell.dataset.prev;
        var cur = t.price.toFixed(2);
        priceCell.textContent = fmt.num(t.price);
        if (prev && prev !== cur) {
          flash(priceCell, t.price > parseFloat(prev) ? 1 : -1);
        }
        priceCell.dataset.prev = cur;
        var c1 = tr.querySelector(".tt-chg");
        c1.textContent = fmt.arrow(t.changePct) + " " + fmt.chg(t.change);
        c1.className = "r tt-chg " + fmt.cls(t.changePct);
        var c2 = tr.querySelector(".tt-pct");
        c2.textContent = fmt.pct(t.changePct);
        c2.className = "r tt-pct " + fmt.cls(t.changePct);
        if (md) {
          var sess = md.snap.sessions.find(function (s) { return s.market === t.venue; });
          var info = sess ? md.sessionInfo(sess) : { state: "OPEN" };
          var chip = tr.querySelector(".state-chip");
          chip.textContent = t.venue === "SPOT" ? "OPEN" : info.state;
          chip.className = "state-chip st-" + (t.venue === "SPOT" ? "open" : info.state.toLowerCase());
          var d = md.timeIn(t.tz);
          var p = function (n) { return (n < 10 ? "0" : "") + n; };
          tr.querySelector(".tt-asof").textContent = p(d.getHours()) + ":" + p(d.getMinutes());
        }
      });
    }
  };

  /* ======================================================================
   * 02 — STOCK TRACKING heatmap (filter chips, area ∝ |chg%|)
   * ==================================================================== */
  function heatColor(p) {
    var t = Math.max(-3, Math.min(3, p)) / 3;
    var a = 0.14 + Math.abs(t) * 0.55;
    return t >= 0 ? rgbaUp(a.toFixed(3)) : rgbaDn(a.toFixed(3));
  }

  var heatmap = {
    filter: "ALL",
    mount: function (root, snap) {
      var self = this;
      root.innerHTML = "";
      var bar = el("div", "chip-bar");
      ["ALL", "AI-TECH", "ENERGY", "FINANCIALS"].forEach(function (f) {
        var b = el("button", "chip" + (self.filter === f ? " active" : ""), f);
        b.type = "button";
        b.addEventListener("click", function () {
          self.filter = f;
          self.mount(root, snap);
        });
        bar.appendChild(b);
      });
      root.appendChild(bar);
      var legend = el("div", "heat-legend");
      legend.innerHTML = "AREA = |CHG%| &nbsp; <span class='up'>▲ up</span> · intensity = |chg%| / 3% &nbsp; <span class='down'>▼ down</span>";
      root.appendChild(legend);
      var body = el("div", "heat-body");
      root.appendChild(body);
      this._tiles(body, snap);
      var foot = el("div", "card-foot");
      foot.textContent = "universe = 36 US-listed names across 3 sectors · equal-weight";
      root.appendChild(foot);
    },
    update: function (root, snap) {
      var body = root.querySelector(".heat-body");
      if (body) { this._tiles(body, snap); }
    },
    _tiles: function (body, snap) {
      body.innerHTML = "";
      var filter = this.filter;
      snap.universe.forEach(function (g) {
        if (filter !== "ALL" && g.group !== filter) { return; }
        var block = el("div", "heat-block");
        block.appendChild(el("div", "heat-title", g.group + " · n=" + g.items.length));
        var row = el("div", "heat-flex");
        g.items.forEach(function (d) {
          var tile = el("div", "heat-tile");
          tile.style.background = heatColor(d.changePct);
          tile.style.flexGrow = String(Math.max(1, Math.abs(d.changePct) * 2));
          tile.appendChild(el("span", "heat-sym", d.sym));
          tile.appendChild(el("span", "heat-name", d.name));
          tile.appendChild(el("span", "heat-price", fmt.num(d.price)));
          tile.appendChild(el("span", "heat-chg " + fmt.cls(d.changePct),
            fmt.arrow(d.changePct) + " " + fmt.pct(d.changePct)));
          row.appendChild(tile);
        });
        block.appendChild(row);
        body.appendChild(block);
      });
    }
  };

  /* ======================================================================
   * 03 — MARKET BREADTH
   * ==================================================================== */
  var breadth = {
    mount: function (root, snap) {
      root.innerHTML = "";
      var grid = el("div", "breadth-grid");
      root.appendChild(grid);
      var foot = el("div", "card-foot");
      foot.textContent = "universe = current heatmap universe · sample n=36";
      root.appendChild(foot);
      this.update(root, snap);
    },
    update: function (root, snap) {
      var all = [];
      snap.universe.forEach(function (g) { all = all.concat(g.items); });
      var adv = all.filter(function (d) { return d.changePct > 0; });
      var dec = all.filter(function (d) { return d.changePct < 0; });
      var unch = all.length - adv.length - dec.length;
      var top = all.reduce(function (a, b) { return a.changePct > b.changePct ? a : b; });
      var bot = all.reduce(function (a, b) { return a.changePct < b.changePct ? a : b; });
      var stats = [
        ["ADVANCERS", String(adv.length), "chg% > 0", "up"],
        ["DECLINERS", String(dec.length), "chg% < 0", "down"],
        ["UNCHANGED", String(unch), "chg% = 0", ""],
        ["A/D RATIO", dec.length ? (adv.length / dec.length).toFixed(2) : "∞", "adv / dec", ""],
        ["TOP GAINER", top.sym, fmt.pct(top.changePct), "up"],
        ["TOP LOSER", bot.sym, fmt.pct(bot.changePct), "down"]
      ];
      var grid = root.querySelector(".breadth-grid");
      grid.innerHTML = "";
      stats.forEach(function (s) {
        var b = el("div", "breadth-box");
        b.appendChild(el("span", "breadth-label", s[0]));
        b.appendChild(el("span", "breadth-value " + s[3], s[1]));
        b.appendChild(el("span", "breadth-sub", s[2]));
        grid.appendChild(b);
      });
      /* A/D composition bar */
      var old = root.querySelector(".breadth-bar");
      if (old) { old.remove(); }
      var oldL = root.querySelector(".breadth-bar-legend");
      if (oldL) { oldL.remove(); }
      var total = Math.max(1, all.length);
      var bar = el("div", "breadth-bar");
      var segA = el("span", "seg seg-adv");
      segA.style.width = (adv.length / total * 100).toFixed(1) + "%";
      var segU = el("span", "seg seg-unch");
      segU.style.width = (unch / total * 100).toFixed(1) + "%";
      var segD = el("span", "seg seg-dec");
      segD.style.width = (dec.length / total * 100).toFixed(1) + "%";
      bar.appendChild(segA); bar.appendChild(segU); bar.appendChild(segD);
      var bl = el("div", "breadth-bar-legend");
      bl.innerHTML = "<span class='up'>■ adv " + adv.length + "</span><span>■ unch " + unch +
        "</span><span class='down'>■ dec " + dec.length + "</span>";
      grid.parentElement.insertBefore(bar, grid.nextSibling);
      grid.parentElement.insertBefore(bl, bar.nextSibling);

      /* per-sector breakdown */
      var oldB = root.querySelector(".breadth-sectors");
      if (oldB) { oldB.remove(); }
      var box = el("div", "breadth-sectors");
      snap.universe.forEach(function (g) {
        var adv2 = g.items.filter(function (d) { return d.changePct > 0; }).length;
        var dec2 = g.items.length - adv2;
        var avg = g.items.reduce(function (a, b) { return a + b.changePct; }, 0) / g.items.length;
        var row = el("div", "bs-row");
        row.appendChild(el("span", "bs-name", g.group));
        var mid = el("div", "bs-bar");
        var a = el("span", "seg seg-adv");
        a.style.width = (adv2 / g.items.length * 100).toFixed(1) + "%";
        var dd = el("span", "seg seg-dec");
        dd.style.width = (dec2 / g.items.length * 100).toFixed(1) + "%";
        mid.appendChild(a); mid.appendChild(dd);
        row.appendChild(mid);
        row.appendChild(el("span", "bs-count", adv2 + "/" + dec2));
        row.appendChild(el("span", "bs-avg " + fmt.cls(avg), fmt.pct(avg)));
        box.appendChild(row);
      });
      grid.parentElement.insertBefore(box, bl.nextSibling);
    }
  };

  /* ======================================================================
   * 04 — SECTOR INTRADAY · NORMALIZED
   * ==================================================================== */
  var sector = {
    mount: function (root, snap) {
      root.innerHTML = "";
      var cv = el("canvas", "sector-canvas");
      root.appendChild(cv);
      var legend = el("div", "sector-legend");
      root.appendChild(legend);
      var foot = el("div", "card-foot");
      foot.textContent = "24 equal-interval pts · baseline open = 0% · equal-weight sector average";
      root.appendChild(foot);
      this.update(root, snap);
    },
    update: function (root, snap) {
      var canvas = root.querySelector(".sector-canvas");
      var legend = root.querySelector(".sector-legend");
      if (!canvas) { return; }
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) { return; }
      canvas.width = w * dpr; canvas.height = h * dpr;
      var ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      var all = [];
      snap.sectorIntraday.forEach(function (s) { all = all.concat(s.points); });
      var hi = Math.max.apply(null, all), lo = Math.min.apply(null, all);
      hi = Math.max(hi, 0.1); lo = Math.min(lo, -0.1);
      var pad = (hi - lo) * 0.12; hi += pad; lo -= pad;
      var padL = 8, padR = 44, padT = 8;
      var plotW = w - padL - padR, plotH = h - padT * 2;

      function x(i, n) { return padL + (i / (n - 1)) * plotW; }
      function y(v) { return padT + (1 - (v - lo) / (hi - lo)) * plotH; }

      /* zero line + scale */
      ctx.strokeStyle = rgbaDim(.25);
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(padL, y(0)); ctx.lineTo(padL + plotW, y(0)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = cT("axis", "rgba(147,161,161,.75)");
      ctx.font = "10px ui-monospace, Menlo, monospace";
      [hi - pad, 0, lo + pad].forEach(function (v, i) {
        if (i === 1) { return; }
        ctx.fillText((v >= 0 ? "+" : "") + v.toFixed(2) + "%", padL + plotW + 6, y(v) + 3);
      });

      /* summary table */
      var tbl = root.querySelector(".sector-table");
      if (!tbl) {
        tbl = el("table", "sector-table");
        tbl.innerHTML = "<thead><tr><th>SECTOR</th><th class='r'>AVG CHG</th>" +
          "<th class='r'>n</th><th>WEIGHTING</th><th class='r'>AS-OF</th></tr></thead><tbody></tbody>";
        legend.parentElement.insertBefore(tbl, legend.nextSibling);
      }
      var stb = tbl.querySelector("tbody");
      stb.innerHTML = "";
      snap.universe.forEach(function (g) {
        var avg = g.items.reduce(function (a, b) { return a + b.changePct; }, 0) / g.items.length;
        var tr = el("tr");
        tr.appendChild(el("td", "tt-sym", g.group));
        tr.appendChild(el("td", "r " + fmt.cls(avg), fmt.arrow(avg) + " " + fmt.pct(avg)));
        tr.appendChild(el("td", "r", String(g.items.length)));
        tr.appendChild(el("td", "tt-src", "equal-weight"));
        var now = new Date();
        var p2 = function (n) { return (n < 10 ? "0" : "") + n; };
        tr.appendChild(el("td", "r tt-src", p2(now.getHours()) + ":" + p2(now.getMinutes())));
        stb.appendChild(tr);
      });

      legend.innerHTML = "";
      snap.sectorIntraday.forEach(function (s) {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1.6;
        ctx.lineJoin = "round";
        ctx.beginPath();
        s.points.forEach(function (v, i) {
          if (i === 0) { ctx.moveTo(x(i, s.points.length), y(v)); }
          else { ctx.lineTo(x(i, s.points.length), y(v)); }
        });
        ctx.stroke();
        var last = s.points[s.points.length - 1];
        var tag = el("span", "sector-tag");
        tag.style.color = s.color;
        tag.textContent = "━ " + s.group + " " + fmt.pct(last);
        legend.appendChild(tag);
      });
    }
  };

  /* ======================================================================
   * 05 — NEWS WIRE (unread tracking, persisted)
   * ==================================================================== */
  var READ_KEY = "market-terminal-read-v1";
  function readSet() {
    try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); }
    catch (e) { return new Set(); }
  }
  var news = {
    mount: function (root, snap) {
      root.innerHTML = "";
      var head = el("div", "news-head");
      head.innerHTML = "<span class='news-count'></span><span class='news-note'>reverse-chronological · click marks read</span>";
      root.appendChild(head);
      /* category filter chips */
      var cats = ["ALL"];
      snap.news.forEach(function (n) { if (cats.indexOf(n.cat) === -1) { cats.push(n.cat); } });
      root._newsFilter = "ALL";
      var chips = el("div", "chip-row news-chips");
      cats.forEach(function (catName) {
        var c = el("button", "chip" + (catName === "ALL" ? " active" : ""), catName);
        c.type = "button";
        c.dataset.cat = catName;
        c.addEventListener("click", function () {
          root._newsFilter = catName;
          Array.prototype.forEach.call(chips.children, function (x) {
            x.classList.toggle("active", x.dataset.cat === catName);
          });
          Array.prototype.forEach.call(root.querySelectorAll(".news-item"), function (it) {
            var show = catName === "ALL" || it.dataset.cat === catName;
            it.style.display = show ? "" : "none";
          });
        });
        chips.appendChild(c);
      });
      root.appendChild(chips);
      var list = el("div", "news-list");
      var read = readSet();
      snap.news.forEach(function (n) {
        var item = el("div", "news-item" + (read.has(n.id) ? " read" : ""));
        item.dataset.id = n.id;
        item.dataset.cat = n.cat;
        var dot = el("span", "news-dot");
        var time = el("span", "news-time", n.time);
        var cat = el("span", "news-cat cat-" + n.cat, "[" + n.cat + "]");
        var text = el("span", "news-text", n.headline);
        item.appendChild(dot); item.appendChild(time);
        item.appendChild(cat); item.appendChild(text);
        item.addEventListener("click", function () {
          var rs = readSet();
          if (rs.has(n.id)) { rs.delete(n.id); item.classList.remove("read"); }
          else { rs.add(n.id); item.classList.add("read"); }
          try { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(rs))); } catch (e) { /* noop */ }
          news._count(root, snap);
        });
        list.appendChild(item);
      });
      root.appendChild(list);
      this._count(root, snap);
      var foot = el("div", "card-foot");
      foot.textContent = "DEMO WIRE — all headlines are illustrative fixtures, not real news";
      root.appendChild(foot);
    },
    update: function (root, snap) { this._count(root, snap); },
    _count: function (root, snap) {
      var read = readSet();
      var unread = snap.news.filter(function (n) { return !read.has(n.id); }).length;
      var c = root.querySelector(".news-count");
      if (c) {
        c.innerHTML = "&gt; " + snap.news.length + " items · <b>" + unread + " unread</b>";
      }
    }
  };

  /* ======================================================================
   * 06 — AAPL · 60 SESSIONS (candles + MA20 + crosshair inspector)
   * ==================================================================== */
  var aapl = {
    idx: null, pinned: false,
    mount: function (root, snap) {
      var self = this;
      root.innerHTML = "";
      var head = el("div", "aapl-head");
      head.innerHTML =
        "<span class='aapl-sym'>AAPL</span>" +
        "<span class='aapl-last'></span>" +
        "<span class='aapl-ohlc'>O <b class='o'></b> PC <b class='pc'></b> " +
        "H <b class='h'></b> L <b class='l'></b> VOL <b class='v'></b> 52W <b class='w52'></b></span>";
      root.appendChild(head);
      var wrap = el("div", "chart-wrap2");
      var cv = el("canvas", "aapl-canvas");
      cv.tabIndex = 0;
      wrap.appendChild(cv);
      root.appendChild(wrap);
      var readout = el("div", "aapl-readout");
      root.appendChild(readout);
      var foot = el("div", "card-foot");
      foot.textContent = "60 valid weekday sessions · no weekend/holiday filling · ←/→ move crosshair, Enter pins Inspector";
      root.appendChild(foot);

      cv.addEventListener("mousemove", function (e) {
        if (self.pinned) { return; }
        var rect = cv.getBoundingClientRect();
        var n = snap.aapl.series.length;
        var i = Math.round(((e.clientX - rect.left - 8) / (rect.width - 64)) * (n - 1));
        self.idx = Math.max(0, Math.min(n - 1, i));
        self.draw(root, snap);
      });
      cv.addEventListener("mouseleave", function () {
        if (!self.pinned) { self.idx = null; self.draw(root, snap); }
      });
      cv.addEventListener("keydown", function (e) {
        var n = snap.aapl.series.length;
        if (e.key === "ArrowLeft") { self.idx = Math.max(0, (self.idx === null ? n - 1 : self.idx) - 1); self.draw(root, snap); e.preventDefault(); }
        if (e.key === "ArrowRight") { self.idx = Math.min(n - 1, (self.idx === null ? n - 1 : self.idx) + 1); self.draw(root, snap); e.preventDefault(); }
        if (e.key === "Enter") { self.pinned = !self.pinned; self.draw(root, snap); e.preventDefault(); }
      });
      this.draw(root, snap);
    },
    update: function (root, snap) { this.draw(root, snap); },

    draw: function (root, snap) {
      var series = snap.aapl.series, dates = snap.aapl.dates;
      var canvas = root.querySelector(".aapl-canvas");
      if (!canvas) { return; }
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) { return; }
      canvas.width = w * dpr; canvas.height = h * dpr;
      var ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      var volH = Math.round(h * 0.16);
      var priceH = h - volH - 6;
      var padL = 8, padR = 56, padT = 10;
      var plotW = w - padL - padR;
      var n = series.length;
      var hi = -Infinity, lo = Infinity, vmax = 0;
      series.forEach(function (d) {
        hi = Math.max(hi, d.h); lo = Math.min(lo, d.l); vmax = Math.max(vmax, d.v);
      });
      var pad = (hi - lo) * 0.06 || 1; hi += pad; lo -= pad;

      function x(i) { return padL + (i / (n - 1)) * plotW; }
      function y(p) { return padT + (1 - (p - lo) / (hi - lo)) * (priceH - padT * 2); }

      ctx.strokeStyle = cT("grid", "rgba(147,161,161,.12)");
      ctx.fillStyle = cT("axis", "rgba(147,161,161,.75)");
      ctx.font = "10px ui-monospace, Menlo, monospace";
      ctx.lineWidth = 1;
      for (var g = 0; g <= 4; g++) {
        var gy = padT + (g / 4) * (priceH - padT * 2);
        ctx.beginPath(); ctx.moveTo(padL, gy + .5); ctx.lineTo(padL + plotW, gy + .5); ctx.stroke();
        ctx.fillText((hi - (g / 4) * (hi - lo)).toFixed(1), padL + plotW + 6, gy + 3);
      }

      var bw = Math.max(1.5, (plotW / n) * 0.6);
      series.forEach(function (d, i) {
        var up = d.c >= d.o;
        ctx.fillStyle = up ? rgbaUp(.35) : rgbaDn(.35);
        var vh = (d.v / vmax) * volH;
        ctx.fillRect(x(i) - bw / 2, h - vh, bw, vh);
      });
      series.forEach(function (d, i) {
        var up = d.c >= d.o;
        var col = up ? cT("up", "#859900") : cT("down", "#dc322f");
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x(i), y(d.h)); ctx.lineTo(x(i), y(d.l)); ctx.stroke();
        var top = y(Math.max(d.o, d.c)), bot = y(Math.min(d.o, d.c));
        ctx.fillRect(x(i) - bw / 2, top, bw, Math.max(1, bot - top));
      });

      /* MA20 */
      ctx.strokeStyle = cT("ma", "#268bd2"); ctx.lineWidth = 1.5; ctx.beginPath();
      for (var i = 19; i < n; i++) {
        var sum = 0;
        for (var k = i - 19; k <= i; k++) { sum += series[k].c; }
        var ma = sum / 20;
        if (i === 19) { ctx.moveTo(x(i), y(ma)); } else { ctx.lineTo(x(i), y(ma)); }
      }
      ctx.stroke();

      /* last price pill */
      var last = series[n - 1];
      var lastY = y(last.c);
      var txt = last.c.toFixed(2);
      var tw = ctx.measureText(txt).width + 12;
      var up2 = last.c >= last.o;
      ctx.fillStyle = up2 ? cT("up", "#859900") : cT("down", "#dc322f");
      var px = padL + plotW + 3, py = lastY - 9;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px, py, tw, 18, 4); ctx.fill(); }
      else { ctx.fillRect(px, py, tw, 18); }
      ctx.fillStyle = cT("pillText", "#002b36");
      ctx.font = "bold 10px ui-monospace, Menlo, monospace";
      ctx.fillText(txt, px + 6, lastY + 3);
      ctx.strokeStyle = up2 ? rgbaUp(.5) : rgbaDn(.5);
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(padL, lastY); ctx.lineTo(padL + plotW, lastY); ctx.stroke();
      ctx.setLineDash([]);

      /* crosshair */
      if (this.idx !== null) {
        var i2 = this.idx, d2 = series[i2];
        var cx = x(i2);
        ctx.strokeStyle = rgbaDim(.45);
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(cx, padT); ctx.lineTo(cx, h); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = cT("bright", "#eee8d5");
        ctx.strokeRect(cx - bw / 2 - 1.5, y(Math.max(d2.o, d2.c)) - 1.5,
          bw + 3, Math.max(1, y(Math.min(d2.o, d2.c)) - y(Math.max(d2.o, d2.c))) + 3);
        var ro = root.querySelector(".aapl-readout");
        if (ro) {
          var chg2 = ((d2.c - series[Math.max(0, i2 - 1)].c) / series[Math.max(0, i2 - 1)].c) * 100;
          ro.innerHTML =
            (this.pinned ? "<b>[PINNED]</b> " : "") +
            "<b>" + dates[i2] + "</b> · O " + d2.o.toFixed(2) + " H " + d2.h.toFixed(2) +
            " L " + d2.l.toFixed(2) + " C " + d2.c.toFixed(2) +
            " · VOL " + (d2.v / 1e6).toFixed(1) + "M · " +
            "<span class='" + fmt.cls(chg2) + "'>" + fmt.pct(chg2) + "</span>";
        }
      } else {
        var ro2 = root.querySelector(".aapl-readout");
        if (ro2) { ro2.innerHTML = "&nbsp;"; }
      }

      /* header stats */
      var prev = series[n - 2];
      var setB = function (sel, val) {
        var e2 = root.querySelector(sel);
        if (e2) { e2.textContent = val; }
      };
      var lastEl = root.querySelector(".aapl-last");
      if (lastEl) {
        var dp = ((last.c - prev.c) / prev.c) * 100;
        lastEl.innerHTML = "<b>" + last.c.toFixed(2) + "</b> <span class='" + fmt.cls(dp) + "'>" +
          fmt.arrow(dp) + " " + fmt.chg(last.c - prev.c) + " (" + fmt.pct(dp) + ")</span>";
      }
      setB(".aapl-ohlc .o", last.o.toFixed(2));
      setB(".aapl-ohlc .pc", prev.c.toFixed(2));
      setB(".aapl-ohlc .h", last.h.toFixed(2));
      setB(".aapl-ohlc .l", last.l.toFixed(2));
      setB(".aapl-ohlc .v", (last.v / 1e6).toFixed(1) + "M");
      setB(".aapl-ohlc .w52", snap.aapl.lo52.toFixed(2) + "–" + snap.aapl.hi52.toFixed(2));
    }
  };

  /* ======================================================================
   * 07 — PRECIOUS METALS MONITOR
   * ==================================================================== */
  var metals = {
    mount: function (root, snap) {
      root.innerHTML = "";
      var grid = el("div", "metal-grid");
      snap.metals.forEach(function (m) {
        var row = el("div", "metal-row");
        row.dataset.sym = m.sym;
        var info = el("div", "metal-info");
        info.appendChild(el("span", "metal-name", m.sym + " USD/t oz"));
        info.appendChild(el("span", "metal-price"));
        info.appendChild(el("span", "metal-sub", "spot · single demo desk"));
        row.appendChild(info);
        var cv = el("canvas", "metal-spark");
        row.appendChild(cv);
        grid.appendChild(row);
      });
      root.appendChild(grid);
      var ratios = el("div", "metal-ratios");
      root.appendChild(ratios);
      this.update(root, snap);
    },
    update: function (root, snap) {
      snap.metals.forEach(function (m) {
        var row = root.querySelector('[data-sym="' + m.sym + '"]');
        if (!row) { return; }
        var p = row.querySelector(".metal-price");
        var prev = p.dataset.prev;
        var cur = m.price.toFixed(2);
        p.innerHTML = "<b>" + fmt.num(m.price) + "</b> <span class='" + fmt.cls(m.changePct) + "'>" +
          fmt.arrow(m.changePct) + " " + fmt.chg(m.change) + " (" + fmt.pct(m.changePct) + ")</span>";
        if (prev && prev !== cur) {
          flash(p, m.price > parseFloat(prev) ? 1 : -1);
        }
        p.dataset.prev = cur;
        drawSparkline(row.querySelector(".metal-spark"), m.series.slice(-40), m.changePct >= 0);
      });
      var g = snap.metals[0], s = snap.metals[1];
      var box = root.querySelector(".metal-ratios");
      if (box && s.price) {
        box.innerHTML =
          "GOLD/SILVER RATIO <b>" + (g.price / s.price).toFixed(2) + "</b> = XAU/XAG · " +
          "AU–PT SPREAD <b>+" + fmt.num(g.price - snap.metals[2].price) + "</b><br>" +
          snap.metals.map(function (m) {
            return m.sym + " 60D <b>" + fmt.num(m.range60[0]) + "–" + fmt.num(m.range60[1]) + "</b>";
          }).join(" · ");
      }
    }
  };

  /* ======================================================================
   * 08 — MARKET PULSE (display clock + session table + 24h bands)
   * ==================================================================== */
  var pulse = {
    mount: function (root, snap, md) {
      root.innerHTML = "";
      var big = el("div", "pulse-big");
      big.innerHTML = "<div class='pulse-time'>--:--:--</div><div class='pulse-date'></div>";
      root.appendChild(big);
      var tbl = el("table", "pt");
      tbl.innerHTML = "<thead><tr><th>MARKET</th><th class='r'>LOCAL</th><th>SESSION</th>" +
        "<th>STATE</th><th class='r'>IN</th></tr></thead><tbody></tbody>";
      root.appendChild(tbl);
      var cv = el("canvas", "bands-canvas");
      root.appendChild(cv);
      var foot = el("div", "card-foot");
      foot.textContent = "bands = regular sessions in venue-local hours · amber = lunch · orange line = NOW · holidays never inferred";
      root.appendChild(foot);
      this.update(root, snap, md);
    },
    update: function (root, snap, md) {
      if (!md) { return; }
      var now = new Date();
      var p2 = function (n) { return (n < 10 ? "0" : "") + n; };
      var tEl = root.querySelector(".pulse-time");
      if (tEl) {
        tEl.textContent = p2(now.getHours()) + ":" + p2(now.getMinutes()) + ":" + p2(now.getSeconds());
      }
      var dEl = root.querySelector(".pulse-date");
      if (dEl) {
        dEl.textContent = now.toDateString() + " · local display tz";
      }
      var tb = root.querySelector(".pt tbody");
      if (tb) {
        tb.innerHTML = "";
        snap.sessions.forEach(function (s) {
          var info = md.sessionInfo(s);
          var tr = el("tr");
          tr.appendChild(el("td", "pt-mkt", s.market));
          tr.appendChild(el("td", "r", p2(info.local.getHours()) + ":" + p2(info.local.getMinutes())));
          tr.appendChild(el("td", "pt-sess", s.windows.map(function (w) {
            var f = function (v) {
              var hh = Math.floor(v), mm = Math.round((v - hh) * 60);
              return p2(hh) + ":" + p2(mm);
            };
            return f(w[0]) + "–" + f(w[1]);
          }).join(" / ")));
          var st = el("td");
          st.appendChild(el("span", "state-chip st-" + info.state.toLowerCase(), info.state));
          tr.appendChild(st);
          tr.appendChild(el("td", "r pt-in", info.next ? "→ " + info.next.to + " " + info.countdown : "—"));
          tb.appendChild(tr);
        });
      }
      this._bands(root, snap, md);
    },
    _bands: function (root, snap, md) {
      var canvas = root.querySelector(".bands-canvas");
      if (!canvas) { return; }
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) { return; }
      canvas.width = w * dpr; canvas.height = h * dpr;
      var ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      var labelW = 44, padR = 6, padT = 4;
      var rowH = (h - padT * 2 - 14) / snap.sessions.length;
      var plotW = w - labelW - padR;
      function hx(hr) { return labelW + (hr / 24) * plotW; }

      snap.sessions.forEach(function (s, i) {
        var y0 = padT + i * rowH + 3;
        var info = md.sessionInfo(s);
        var hr = info.local.getHours() + info.local.getMinutes() / 60 + info.local.getSeconds() / 3600;
        var day = info.local.getDay();
        ctx.fillStyle = rgbaDim(.85);
        ctx.font = "bold 10px ui-monospace, Menlo, monospace";
        ctx.fillText(s.market, 2, y0 + rowH / 2 + 3);
        /* base row */
        ctx.fillStyle = rgbaDim(.08);
        ctx.fillRect(labelW, y0, plotW, rowH - 5);
        if (day !== 0 && day !== 6) {
          s.windows.forEach(function (wn, wi) {
            ctx.fillStyle = rgbaAc(.45);
            ctx.fillRect(hx(wn[0]), y0, hx(wn[1]) - hx(wn[0]), rowH - 5);
            if (wi < s.windows.length - 1) {
              ctx.fillStyle = rgbaWn(.5);
              ctx.fillRect(hx(wn[1]), y0, hx(s.windows[wi + 1][0]) - hx(wn[1]), rowH - 5);
            }
          });
          if (s.pre) {
            ctx.fillStyle = rgbaWn(.28);
            ctx.fillRect(hx(s.pre[0]), y0, hx(s.pre[1]) - hx(s.pre[0]), rowH - 5);
          }
        }
        /* NOW marker */
        ctx.strokeStyle = cT("now", "#cb4b16");
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(hx(hr), y0 - 2);
        ctx.lineTo(hx(hr), y0 + rowH - 3);
        ctx.stroke();
      });
      /* hour axis */
      ctx.fillStyle = rgbaDim(.6);
      ctx.font = "9px ui-monospace, Menlo, monospace";
      [0, 6, 12, 18, 24].forEach(function (hr) {
        ctx.fillText(hr < 10 ? "0" + hr : String(hr), hx(hr) - 5, h - 3);
      });
    }
  };

  /* ======================================================================
   * 09 — GLOBAL INDEX MAP · BY REGION
   * ==================================================================== */
  var indexMap = {
    mount: function (root, snap) {
      root.innerHTML = "";
      var wrap = el("div", "map-wrap");
      root.appendChild(wrap);
      this.update(root, snap);
    },
    update: function (root, snap, md) {
      var wrap = root.querySelector(".map-wrap");
      if (!wrap) { return; }
      wrap.innerHTML = "";
      snap.indexMap.forEach(function (grp) {
        var block = el("div", "map-block");
        block.appendChild(el("div", "map-region", "├─ " + grp.region));
        var tbl = el("table", "mt");
        grp.items.forEach(function (t) {
          var tr = el("tr");
          tr.appendChild(el("td", "mt-sym", t.sym));
          tr.appendChild(el("td", "mt-src", t.src));
          tr.appendChild(el("td", "r mt-price", fmt.num(t.price)));
          tr.appendChild(el("td", "r mt-chg " + fmt.cls(t.changePct),
            fmt.arrow(t.changePct) + " " + fmt.pct(t.changePct)));
          var stTd = el("td");
          var chip = el("span", "state-chip", "···");
          if (md) {
            var sess = md.snap.sessions.find(function (s) { return s.market === t.venue; });
            var info = sess ? md.sessionInfo(sess) : { state: "OPEN" };
            chip.textContent = t.venue === "SPOT" ? "OPEN" : info.state;
            chip.className = "state-chip st-" + (t.venue === "SPOT" ? "open" : info.state.toLowerCase());
          }
          stTd.appendChild(chip);
          tr.appendChild(stTd);
          if (md) {
            var d = md.timeIn(t.tz);
            var p2 = function (n) { return (n < 10 ? "0" : "") + n; };
            tr.appendChild(el("td", "r mt-local", p2(d.getHours()) + ":" + p2(d.getMinutes())));
          }
          tbl.appendChild(tr);
        });
        block.appendChild(tbl);
        wrap.appendChild(block);
      });
    }
  };

  global.Widgets = {
    ticker: ticker, heatmap: heatmap, breadth: breadth, sector: sector,
    news: news, aapl: aapl, metals: metals, pulse: pulse, indexMap: indexMap,
    _fmt: fmt, _flash: flash, _drawSpark: drawSparkline
  };
})(window);

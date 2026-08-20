/* ==========================================================================
 * data.js — market data layer (demo engine + optional live adapter)
 * Deterministic seeded fixtures; the live adapter fails SILENTLY to demo.
 * Nothing in this file ever throws a console error.
 * ======================================================================== */
(function (global) {
  "use strict";

  /* ---------- PRNG + series -------------------------------------------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildSeries(seed, points, start, drift, vol, volBase) {
    const rnd = mulberry32(seed);
    const out = [];
    let price = start;
    for (let i = 0; i < points; i++) {
      const shock = (rnd() - 0.5) * 2 * vol;
      const open = price;
      const close = price * (1 + drift + shock);
      const high = Math.max(open, close) * (1 + rnd() * vol * 0.6);
      const low = Math.min(open, close) * (1 - rnd() * vol * 0.6);
      const volume = Math.round((volBase || 5e7) * (0.5 + rnd()));
      out.push({ o: open, h: high, l: low, c: close, v: volume });
      price = close;
    }
    return out;
  }

  function lastChg(s) {
    const a = s[s.length - 2].c, b = s[s.length - 1].c;
    return { abs: b - a, pct: ((b - a) / a) * 100 };
  }

  /* last n weekdays ending today (session dates for charts) */
  function weekdayDates(n) {
    const out = [];
    const d = new Date();
    while (out.length < n) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) {
        out.unshift(d.toISOString().slice(0, 10));
      }
      d.setDate(d.getDate() - 1);
    }
    return out;
  }

  /* ---------- TAPE / ticker universe ------------------------------------- */
  const TAPE_DEFS = [
    { sym: "SPX",     name: "S&P 500",       src: "S&P Dow Jones Indices", tz: "America/New_York",  venue: "NYSE", seed: 101, base: 6180,  vol: 0.006 },
    { sym: "IXIC",    name: "NASDAQ Comp",   src: "Nasdaq",                tz: "America/New_York",  venue: "NYSE", seed: 102, base: 20240, vol: 0.008 },
    { sym: "DJI",     name: "Dow Jones",     src: "S&P Dow Jones Indices", tz: "America/New_York",  venue: "NYSE", seed: 103, base: 44910, vol: 0.005 },
    { sym: "STOXX50E",name: "STOXX 50",      src: "STOXX Ltd",             tz: "Europe/Berlin",     venue: "XETRA",seed: 104, base: 5310,  vol: 0.006 },
    { sym: "FTSE",    name: "FTSE 100",      src: "FTSE Russell",          tz: "Europe/London",     venue: "LSE",  seed: 105, base: 8840,  vol: 0.005 },
    { sym: "N225",    name: "Nikkei 225",    src: "Nikkei Inc",            tz: "Asia/Tokyo",        venue: "TSE",  seed: 106, base: 40250, vol: 0.009 },
    { sym: "HSI",     name: "Hang Seng",     src: "Hang Seng Indexes",     tz: "Asia/Hong_Kong",    venue: "HKEX", seed: 107, base: 24480, vol: 0.010 },
    { sym: "SSE",     name: "SSE Composite", src: "Shanghai Stock Exchange",tz: "Asia/Shanghai",    venue: "SSE",  seed: 108, base: 3520,  vol: 0.007 },
    { sym: "XAU",     name: "Gold Spot",     src: "DEMO metals desk",      tz: "America/New_York",  venue: "SPOT", seed: 109, base: 3352,  vol: 0.006 },
    { sym: "WTI",     name: "WTI Crude",     src: "NYMEX (demo ref)",      tz: "America/New_York",  venue: "NYSE", seed: 110, base: 67.2,  vol: 0.016 },
    { sym: "DXY",     name: "US Dollar Idx", src: "ICE (demo ref)",        tz: "America/New_York",  venue: "SPOT", seed: 111, base: 97.6,  vol: 0.003 }
  ];

  /* ---------- stock universe (heatmap + breadth) ------------------------- */
  const UNIVERSE = [
    { group: "AI-TECH", items: [
      ["NVDA","NVIDIA Corp",176.10,.020],["MSFT","Microsoft Corp",510.52,.009],
      ["AAPL","Apple Inc",232.18,.011],["GOOGL","Alphabet Inc",188.12,.011],
      ["META","Meta Platforms",721.07,.014],["AVGO","Broadcom Inc",289.39,.015],
      ["AMD","Adv Micro Devices",154.79,.019],["TSM","TSMC ADR",245.01,.013],
      ["ASML","ASML Holding ADR",724.64,.014],["ORCL","Oracle Corp",214.30,.012],
      ["CRM","Salesforce Inc",262.85,.012],["PLTR","Palantir Tech",157.96,.026],
      ["MU","Micron Technology",115.21,.022],["INTC","Intel Corp",21.93,.024]
    ]},
    { group: "ENERGY", items: [
      ["XOM","Exxon Mobil",112.80,.010],["CVX","Chevron Corp",152.40,.009],
      ["COP","ConocoPhillips",95.08,.012],["SLB","Schlumberger",34.22,.014],
      ["EOG","EOG Resources",128.60,.013],["OXY","Occidental Pete",44.49,.013],
      ["MPC","Marathon Pete",171.01,.014],["PSX","Phillips 66",122.40,.012],
      ["VLO","Valero Energy",131.91,.012],["KMI","Kinder Morgan",28.14,.009]
    ]},
    { group: "FINANCIALS", items: [
      ["JPM","JPMorgan Chase",294.85,.009],["BAC","Bank of America",46.80,.011],
      ["GS","Goldman Sachs",701.92,.011],["MS","Morgan Stanley",141.90,.011],
      ["WFC","Wells Fargo",79.60,.010],["BLK","BlackRock Inc",1097.88,.009],
      ["V","Visa Inc",354.60,.007],["MA","Mastercard",560.62,.007],
      ["AXP","American Express",308.87,.010],["C","Citigroup Inc",89.17,.011],
      ["SCHW","Charles Schwab",92.40,.012],["PYPL","PayPal Holdings",70.77,.016]
    ]}
  ];

  /* ---------- sessions (with lunch breaks) -------------------------------- */
  const SESSIONS = [
    { market: "NYSE", tz: "America/New_York",  windows: [[9.5, 16]],        pre: [8, 9.5] },
    { market: "LSE",  tz: "Europe/London",     windows: [[8, 16.5]],        pre: null },
    { market: "XETRA",tz: "Europe/Berlin",     windows: [[9, 17.5]],        pre: null },
    { market: "TSE",  tz: "Asia/Tokyo",        windows: [[9, 11.5], [12.5, 15.5]], pre: null },
    { market: "HKEX", tz: "Asia/Hong_Kong",    windows: [[9.5, 12], [13, 16]],     pre: null },
    { market: "SSE",  tz: "Asia/Shanghai",     windows: [[9.5, 11.5], [13, 15]],   pre: null }
  ];

  /* ---------- news wire fixtures ------------------------------------------ */
  const NEWS = [
    ["16:00:02","FINANCE","Closing bell: S&P 500 posts record close as megacap tech leads breadth"],
    ["15:42:11","AI","Chip bellwethers extend weekly gain; semi equipment names lag after cautious guide"],
    ["15:05:48","ENERGY","Crude slips as product inventories build; refiners mixed into weekend"],
    ["14:31:20","MACRO","Fed officials signal patience; rate futures price steady path into autumn"],
    ["14:02:07","TECH","Cloud capex tracker: hyperscaler spend revisions skew positive for AI infra"],
    ["13:36:55","METALS","Gold firms as real yields drift lower; silver outperforms on week"],
    ["13:12:30","FINANCE","Money-center banks bid higher after stress-capital commentary"],
    ["12:48:03","AI","Data-center power procurement deals accelerate in US Midwest"],
    ["12:15:44","ENERGY","Integrated majors steady ahead of next week's earnings slate"],
    ["11:52:19","TECH","Software names mixed; security spend outlook nudges high-growth cohort"],
    ["11:20:36","MACRO","US durable goods orders top consensus; core capex firmer"],
    ["10:58:02","METALS","Platinum eases after strong month; palladium plays catch-up"],
    ["10:31:47","FINANCE","Card network volumes tracker shows stable consumer spend trend"],
    ["10:04:15","AI","Foundry pricing reports lift leading-edge wafer names"],
    ["09:45:58","ENERGY","Midstream names firm as gas transport nominations rise"],
    ["09:30:01","MACRO","US cash open: indices little changed after mixed overnight session"],
    ["08:55:23","TECH","Asia session review: megacap suppliers steady; memory complex bid"],
    ["08:20:40","METALS","Gold holds overnight gain as dollar softens in European morning"],
    ["07:58:12","FINANCE","European banks close mixed; US futures point to flat open"],
    ["07:31:05","AI","Overnight digest: accelerator lead-times stabilize per supply-chain checks"],
    ["07:02:44","MACRO","Week in review: global equities climb wall of worry into month-end"],
    ["06:44:30","ENERGY","OPEC+ compliance chatter keeps crude rangebound ahead of US data"],
    ["06:15:09","TECH","Asia close: Hang Seng outperforms on platform economy names"],
    ["06:00:00","MACRO","Desk note: today's calendar - durable goods, two Fed speakers, rig count"]
  ];

  const METALS = [
    { sym: "XAU", name: "Gold",      seed: 301, base: 3264, vol: 0.006 },
    { sym: "XAG", name: "Silver",    seed: 302, base: 37.6, vol: 0.011 },
    { sym: "XPT", name: "Platinum",  seed: 303, base: 1290, vol: 0.010 },
    { sym: "XPD", name: "Palladium", seed: 304, base: 1120, vol: 0.013 }
  ];

  const SECTOR_COLORS = { "AI-TECH": "#2aa198", "ENERGY": "#b58900", "FINANCIALS": "#6c71c4" };

  /* ---------- snapshot builder -------------------------------------------- */
  function buildSnapshot() {
    const tape = TAPE_DEFS.map(function (d) {
      const s = buildSeries(d.seed, 60, d.base, 0.0006, d.vol, 1e9);
      const ch = lastChg(s);
      return { sym: d.sym, name: d.name, src: d.src, tz: d.tz, venue: d.venue,
               price: s[s.length - 1].c, change: ch.abs, changePct: ch.pct, series: s };
    });

    const universe = UNIVERSE.map(function (g, gi) {
      return { group: g.group, items: g.items.map(function (it, ii) {
        const s = buildSeries(500 + gi * 100 + ii, 30, it[2], 0.0008, it[3], 2e7);
        const ch = lastChg(s);
        return { sym: it[0], name: it[1], group: g.group, price: s[s.length - 1].c,
                 change: ch.abs, changePct: ch.pct, volume: s[s.length - 1].v, series: s };
      }) };
    });

    /* sector intraday: 24 equal-interval pts, normalized to open = 0% */
    const sectorIntraday = UNIVERSE.map(function (g, gi) {
      const rnd = mulberry32(900 + gi);
      const pts = [];
      let v = 0;
      for (let i = 0; i < 24; i++) {
        v += (rnd() - 0.47) * 0.12;
        pts.push(v);
      }
      var col = (global.Themes && Themes.sectorColor) ? Themes.sectorColor(g.group) : SECTOR_COLORS[g.group];
      return { group: g.group, points: pts, color: col };
    });

    const aaplSeries = buildSeries(777, 60, 205, 0.0012, 0.011, 5.4e7);
    const aapl = {
      dates: weekdayDates(60),
      series: aaplSeries,
      hi52: Math.max.apply(null, aaplSeries.map(function (d) { return d.h; })) * 1.08,
      lo52: Math.min.apply(null, aaplSeries.map(function (d) { return d.l; })) * 0.82
    };

    const metals = METALS.map(function (d) {
      const s = buildSeries(d.seed, 60, d.base, 0.0007, d.vol, 1e6);
      const ch = lastChg(s);
      const hi = Math.max.apply(null, s.map(function (x) { return x.h; }));
      const lo = Math.min.apply(null, s.map(function (x) { return x.l; }));
      return { sym: d.sym, name: d.name, series: s, price: s[s.length - 1].c,
               change: ch.abs, changePct: ch.pct, range60: [lo, hi] };
    });

    const news = NEWS.map(function (n, i) {
      return { id: "n" + i, time: n[0], cat: n[1], headline: n[2] };
    });

    /* index map regions derived from tape */
    const indexMap = [
      { region: "AMERICAS", items: tape.filter(function (t) { return ["SPX","IXIC","DJI"].indexOf(t.sym) >= 0; }) },
      { region: "EUROPE",   items: tape.filter(function (t) { return ["STOXX50E","FTSE"].indexOf(t.sym) >= 0; }) },
      { region: "APAC",     items: tape.filter(function (t) { return ["N225","HSI","SSE"].indexOf(t.sym) >= 0; }) },
      { region: "METALS/FX/ENERGY", items: tape.filter(function (t) { return ["XAU","WTI","DXY"].indexOf(t.sym) >= 0; }) }
    ];

    return { tape: tape, universe: universe, sectorIntraday: sectorIntraday,
             aapl: aapl, metals: metals, news: news, sessions: SESSIONS, indexMap: indexMap };
  }

  /* ---------- live tick mutation ------------------------------------------ */
  function tick(snap) {
    const r = Math.random;
    snap.tape.forEach(function (t, i) {
      const v = TAPE_DEFS[i].vol;
      t.price *= 1 + (r() - 0.5) * 2 * v * 0.2;
      t.changePct += (r() - 0.5) * 0.06;
      t.change = t.price * (t.changePct / 100) / (1 + t.changePct / 100);
    });
    snap.universe.forEach(function (g) {
      g.items.forEach(function (d) {
        d.price *= 1 + (r() - 0.5) * 0.004;
        d.changePct += (r() - 0.5) * 0.12;
        d.change = d.price * (d.changePct / 100) / (1 + d.changePct / 100);
      });
    });
    snap.sectorIntraday.forEach(function (s) {
      s.points[s.points.length - 1] += (r() - 0.5) * 0.04;
    });
    snap.metals.forEach(function (m) {
      m.price *= 1 + (r() - 0.5) * 0.002;
      m.changePct += (r() - 0.5) * 0.05;
      m.change = m.price * (m.changePct / 100) / (1 + m.changePct / 100);
    });
    const last = snap.aapl.series[snap.aapl.series.length - 1];
    last.c *= 1 + (r() - 0.5) * 0.003;
    last.h = Math.max(last.h, last.c);
    last.l = Math.min(last.l, last.c);
  }

  /* ---------- session state engine ---------------------------------------- */
  function timeIn(tz) {
    try { return new Date(new Date().toLocaleString("en-US", { timeZone: tz })); }
    catch (e) { return new Date(); }
  }
  function sessionInfo(def) {
    if (!def) {
      return { local: new Date(), state: "CLOSED", next: null, countdown: "--:--:--" };
    }
    const d = timeIn(def.tz);
    const day = d.getDay();
    const t = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    let state = "CLOSED", next = null;
    if (day !== 0 && day !== 6) {
      let inSession = false, inLunch = false, nextClose = null, nextOpen = null;
      def.windows.forEach(function (w) {
        if (t >= w[0] && t < w[1]) { inSession = true; nextClose = w[1]; }
        if (t < w[0] && (nextOpen === null || w[0] < nextOpen)) { nextOpen = w[0]; }
      });
      if (inSession) {
        state = "OPEN"; next = { at: nextClose, to: "CLOSED" };
      } else {
        /* lunch = between two windows same day */
        for (let i = 0; i < def.windows.length - 1; i++) {
          if (t >= def.windows[i][1] && t < def.windows[i + 1][0]) {
            inLunch = true; next = { at: def.windows[i + 1][0], to: "OPEN" };
          }
        }
        if (!inLunch) {
          if (def.pre && t >= def.pre[0] && t < def.pre[1]) {
            state = "PRE"; next = { at: def.pre[1], to: "OPEN" };
          } else if (nextOpen !== null && nextOpen - t <= 12) {
            state = "CLOSED"; next = { at: nextOpen, to: "OPEN" };
          }
        } else { state = "LUNCH"; }
      }
    }
    let inStr = "--:--:--";
    if (next) {
      let secs = Math.max(0, Math.round((next.at - t) * 3600));
      const h = Math.floor(secs / 3600); secs -= h * 3600;
      const m = Math.floor(secs / 60); const s = secs - m * 60;
      const p = function (n) { return (n < 10 ? "0" : "") + n; };
      inStr = (h > 0 ? h + ":" : "") + p(m) + ":" + p(s);
    }
    return { local: d, state: state, next: next, countdown: inStr };
  }

  /* ---------- MarketData facade -------------------------------------------- */
  function MarketData() {
    this.mode = "demo";
    this.liveOk = false;
    this.snap = buildSnapshot();
  }
  MarketData.prototype.setMode = function (mode) {
    this.mode = mode === "live" ? "live" : "demo";
    if (this.mode === "live") { this._tryLive(); }
    return this.mode;
  };
  MarketData.prototype.setEndpoint = function (url) {
    this.endpoint = (url || "").trim();
    if (this.mode === "live") { this._tryLive(); }
  };
  MarketData.prototype._tryLive = function () {
    const self = this;
    const url = this.endpoint ||
      "https://stooq.com/q/l/?s=aapl.us,%5Espx,xauusd&f=sd2t2ohlcv&h&e=csv";
    try {
      fetch(url).then(function (r) {
        if (!r.ok) { throw new Error("http"); }
        return r.text();
      }).then(function (csv) {
        const lines = csv.trim().split("\n").slice(1);
        let applied = 0;
        lines.forEach(function (line) {
          const p = line.split(",");
          if (p.length < 7 || p[6] === "N/D") { return; }
          const close = parseFloat(p[6]);
          if (!isFinite(close)) { return; }
          if (p[0] === "AAPL.US") {
            const last = self.snap.aapl.series[self.snap.aapl.series.length - 1];
            last.c = close; applied++;
          } else if (p[0] === "^SPX") {
            const t = self.snap.tape.find(function (x) { return x.sym === "SPX"; });
            if (t) { t.price = close; applied++; }
          } else if (p[0] === "XAUUSD") {
            const m = self.snap.metals.find(function (x) { return x.sym === "XAU"; });
            if (m) { m.price = close; applied++; }
          }
        });
        self.liveOk = applied > 0;
        if (!self.liveOk) { console.warn("[market-data] live feed empty — staying on demo values."); }
      }).catch(function () {
        self.liveOk = false;
        console.warn("[market-data] live feed unreachable — using demo values.");
      });
    } catch (e) {
      self.liveOk = false;
      console.warn("[market-data] live adapter disabled — using demo values.");
    }
  };
  MarketData.prototype.tick = function () { tick(this.snap); };
  MarketData.prototype.isLive = function () { return this.mode === "live" && this.liveOk; };
  /* ---------- long deterministic histories for backtesting -------------------- */
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % 100000;
  }
  function baseFor(sym) {
    const t = TAPE_DEFS.find(function (x) { return x.sym === sym; });
    if (t) { return { base: t.base, vol: t.vol }; }
    for (let gi = 0; gi < UNIVERSE.length; gi++) {
      const it = UNIVERSE[gi].items.find(function (x) { return x[0] === sym; });
      if (it) { return { base: it[2], vol: it[3] }; }
    }
    const m = METALS.find(function (x) { return x.sym === sym; });
    if (m) { return { base: m.base, vol: m.vol }; }
    return { base: 100, vol: 0.012 };
  }
  MarketData.prototype.history = function (sym, n) {
    const b = baseFor(sym);
    const len = n || 750;
    const series = buildSeries(hashSeed(sym), len, b.base, 0.0004, b.vol, 2e7);
    const dates = weekdayDates(len);
    return series.map(function (bar, i) {
      bar.d = dates[i];
      return bar;
    });
  };
  MarketData.prototype.knownSymbols = function () {
    const out = [];
    TAPE_DEFS.forEach(function (t) { out.push(t.sym); });
    UNIVERSE.forEach(function (g) { g.items.forEach(function (it) { out.push(it[0]); }); });
    METALS.forEach(function (m) { out.push(m.sym); });
    return out;
  };
  MarketData.prototype.sessionInfo = sessionInfo;
  MarketData.prototype.timeIn = timeIn;

  global.MarketData = MarketData;
})(window);
/* ==========================================================================
 * quant.js — indicators · strategy DSL evaluator · backtest engine · metrics
 * Pure functions, dependency-free. Strategies are plain JSON specs:
 *   algo:    { kind:"algo", name, symbol, entry:[cond], exit:[cond], costBps }
 *   tagging: { kind:"tagging", name, symbol, tag:[cond], forward:[1,5,10] }
 *   cond: { ind:"PRICE|CHG|SMA|EMA|RSI|Z|VOLR", p, op, ind2, p2, val }
 *   ops:  > >= < <= crosses_above crosses_below
 * Entry = ALL conds true · Exit = ANY cond true. Long-only, fills at close.
 * ======================================================================== */
(function (global) {
  "use strict";

  /* ---------- indicator series --------------------------------------------- */
  function sma(v, p) {
    var out = new Array(v.length).fill(null);
    var sum = 0;
    for (var i = 0; i < v.length; i++) {
      sum += v[i];
      if (i >= p) { sum -= v[i - p]; }
      if (i >= p - 1) { out[i] = sum / p; }
    }
    return out;
  }
  function ema(v, p) {
    var out = new Array(v.length).fill(null);
    var k = 2 / (p + 1);
    var e = null;
    for (var i = 0; i < v.length; i++) {
      e = e === null ? v[i] : v[i] * k + e * (1 - k);
      if (i >= p - 1) { out[i] = e; }
    }
    return out;
  }
  function rsi(closes, p) {
    var out = new Array(closes.length).fill(null);
    var g = 0, l = 0;
    for (var i = 1; i < closes.length; i++) {
      var d = closes[i] - closes[i - 1];
      var up = Math.max(0, d), dn = Math.max(0, -d);
      if (i <= p) { g += up; l += dn; if (i === p) { g /= p; l /= p; } }
      else { g = (g * (p - 1) + up) / p; l = (l * (p - 1) + dn) / p; }
      if (i >= p) { out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    }
    return out;
  }
  function zscore(v, p) {
    var out = new Array(v.length).fill(null);
    for (var i = p - 1; i < v.length; i++) {
      var m = 0, j;
      for (j = i - p + 1; j <= i; j++) { m += v[j]; }
      m /= p;
      var s = 0;
      for (j = i - p + 1; j <= i; j++) { s += (v[j] - m) * (v[j] - m); }
      s = Math.sqrt(s / p) || 1e-9;
      out[i] = (v[i] - m) / s;
    }
    return out;
  }
  function chgPct(closes) {
    var out = new Array(closes.length).fill(null);
    for (var i = 1; i < closes.length; i++) {
      out[i] = (closes[i] / closes[i - 1] - 1) * 100;
    }
    return out;
  }
  function volRatio(vols, p) {
    var avg = sma(vols, p);
    var out = new Array(vols.length).fill(null);
    for (var i = 0; i < vols.length; i++) {
      if (avg[i]) { out[i] = vols[i] / avg[i]; }
    }
    return out;
  }

  var INDS = {
    PRICE: { name: "close", needsP: false },
    CHG:   { name: "chg %", needsP: false },
    SMA:   { name: "SMA", needsP: true, defP: 10 },
    EMA:   { name: "EMA", needsP: true, defP: 10 },
    RSI:   { name: "RSI", needsP: true, defP: 14 },
    Z:     { name: "z-score", needsP: true, defP: 20 },
    VOLR:  { name: "vol ratio", needsP: true, defP: 20 }
  };
  var OPS = [">", ">=", "<", "<=", "crosses_above", "crosses_below"];

  function indSeries(bars, ind, p) {
    var closes = bars.map(function (b) { return b.c; });
    if (ind === "PRICE") { return closes; }
    if (ind === "CHG") { return chgPct(closes); }
    if (ind === "SMA") { return sma(closes, p || 10); }
    if (ind === "EMA") { return ema(closes, p || 10); }
    if (ind === "RSI") { return rsi(closes, p || 14); }
    if (ind === "Z") { return zscore(closes, p || 20); }
    if (ind === "VOLR") { return volRatio(bars.map(function (b) { return b.v || 1; }), p || 20); }
    return closes;
  }

  /* ---------- condition evaluation ------------------------------------------ */
  function evalCond(cond, bars, cache) {
    var key = cond.ind + ":" + (cond.p || "");
    if (!cache[key]) { cache[key] = indSeries(bars, cond.ind, cond.p); }
    var a = cache[key];
    var b = null;
    if (cond.ind2) {
      var key2 = cond.ind2 + ":" + (cond.p2 || "");
      if (!cache[key2]) { cache[key2] = indSeries(bars, cond.ind2, cond.p2); }
      b = cache[key2];
    }
    var out = new Array(bars.length).fill(false);
    for (var i = 1; i < bars.length; i++) {
      var av = a[i], ap = a[i - 1];
      if (av === null || ap === null) { continue; }
      var bv, bp;
      if (b) { bv = b[i]; bp = b[i - 1]; if (bv === null || bp === null) { continue; } }
      else { bv = bp = (cond.val !== undefined ? cond.val : 0); }
      switch (cond.op) {
        case ">":  out[i] = av > bv; break;
        case ">=": out[i] = av >= bv; break;
        case "<":  out[i] = av < bv; break;
        case "<=": out[i] = av <= bv; break;
        case "crosses_above": out[i] = ap <= bp && av > bv; break;
        case "crosses_below": out[i] = ap >= bp && av < bv; break;
        default: out[i] = false;
      }
    }
    return out;
  }
  function andAll(condArrays, n) {
    var out = new Array(n).fill(false);
    if (!condArrays.length) { return out; }
    for (var i = 0; i < n; i++) {
      out[i] = condArrays.every(function (c) { return c[i]; });
    }
    return out;
  }
  function orAny(condArrays, n) {
    var out = new Array(n).fill(false);
    for (var i = 0; i < n; i++) {
      out[i] = condArrays.some(function (c) { return c[i]; });
    }
    return out;
  }

  /* ---------- backtest (algo) ------------------------------------------------ */
  function backtest(spec, bars) {
    var cache = {};
    var entryArr = andAll((spec.entry || []).map(function (c) { return evalCond(c, bars, cache); }), bars.length);
    var exitArr = orAny((spec.exit || []).map(function (c) { return evalCond(c, bars, cache); }), bars.length);
    var cost = ((spec.costBps || 0) / 1e4);
    var cash = 1, shares = 0, inPos = false, entryPx = 0, entryIdx = 0;
    var equity = [], trades = [];
    for (var i = 0; i < bars.length; i++) {
      var px = bars[i].c;
      if (!inPos && entryArr[i]) {
        shares = (cash * (1 - cost)) / px;
        cash = 0; inPos = true; entryPx = px; entryIdx = i;
      } else if (inPos && (exitArr[i] || i === bars.length - 1)) {
        cash = shares * px * (1 - cost);
        trades.push({
          entryIdx: entryIdx, exitIdx: i,
          entryDate: bars[entryIdx].d, exitDate: bars[i].d,
          entryPx: entryPx, exitPx: px,
          pnlPct: (px / entryPx - 1) * 100 - cost * 2 * 100,
          bars: i - entryIdx
        });
        shares = 0; inPos = false;
      }
      equity.push(cash + shares * px);
    }
    return { equity: equity, trades: trades, metrics: computeMetrics(equity, trades, bars) };
  }

  function computeMetrics(equity, trades, bars) {
    var n = equity.length;
    var total = (equity[n - 1] / equity[0] - 1) * 100;
    var bh = (bars[n - 1].c / bars[0].c - 1) * 100;
    /* max drawdown */
    var peak = equity[0], maxDD = 0;
    equity.forEach(function (e) {
      if (e > peak) { peak = e; }
      var dd = (peak - e) / peak;
      if (dd > maxDD) { maxDD = dd; }
    });
    /* sharpe on daily returns */
    var rets = [];
    for (var i = 1; i < n; i++) { rets.push(equity[i] / equity[i - 1] - 1); }
    var mean = rets.reduce(function (a, r) { return a + r; }, 0) / (rets.length || 1);
    var sd = Math.sqrt(rets.reduce(function (a, r) { return a + (r - mean) * (r - mean); }, 0) / (rets.length || 1)) || 1e-9;
    var sharpe = mean / sd * Math.sqrt(252);
    /* trade stats */
    var wins = trades.filter(function (t) { return t.pnlPct > 0; });
    var losses = trades.filter(function (t) { return t.pnlPct <= 0; });
    var avgW = wins.length ? wins.reduce(function (a, t) { return a + t.pnlPct; }, 0) / wins.length : 0;
    var avgL = losses.length ? losses.reduce(function (a, t) { return a + t.pnlPct; }, 0) / losses.length : 0;
    var gw = wins.reduce(function (a, t) { return a + t.pnlPct; }, 0);
    var gl = Math.abs(losses.reduce(function (a, t) { return a + t.pnlPct; }, 0));
    var inBars = trades.reduce(function (a, t) { return a + t.bars; }, 0);
    var best = trades.reduce(function (m, t) { return t.pnlPct > m ? t.pnlPct : m; }, 0);
    var worst = trades.reduce(function (m, t) { return t.pnlPct < m ? t.pnlPct : m; }, 0);
    return {
      totalReturn: total, buyHold: bh, maxDD: maxDD * 100, sharpe: sharpe,
      trades: trades.length, winRate: trades.length ? wins.length / trades.length * 100 : 0,
      avgWin: avgW, avgLoss: avgL, profitFactor: gl > 0 ? gw / gl : (gw > 0 ? Infinity : 0),
      exposure: inBars / n * 100, best: best, worst: worst,
      openPosition: false
    };
  }

  /* ---------- tag scan (tagging) --------------------------------------------- */
  function tagScan(spec, bars) {
    var cache = {};
    var hits = andAll((spec.tag || []).map(function (c) { return evalCond(c, bars, cache); }), bars.length);
    var horizons = (spec.forward && spec.forward.length ? spec.forward : [1, 5, 10]).slice(0, 6);
    var occurrences = [];
    for (var i = 0; i < bars.length; i++) {
      if (!hits[i]) { continue; }
      var occ = { idx: i, date: bars[i].d, close: bars[i].c, fwd: {} };
      horizons.forEach(function (h) {
        if (i + h < bars.length) {
          occ.fwd[h] = (bars[i + h].c / bars[i].c - 1) * 100;
        }
      });
      occurrences.push(occ);
    }
    var summary = horizons.map(function (h) {
      var vals = occurrences.map(function (o) { return o.fwd[h]; })
        .filter(function (v) { return v !== undefined; });
      if (!vals.length) { return { h: h, n: 0, mean: 0, median: 0, win: 0 }; }
      vals.sort(function (a, b) { return a - b; });
      var mean = vals.reduce(function (a, v) { return a + v; }, 0) / vals.length;
      var med = vals.length % 2 ? vals[(vals.length - 1) / 2]
        : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;
      var win = vals.filter(function (v) { return v > 0; }).length / vals.length * 100;
      return { h: h, n: vals.length, mean: mean, median: med, win: win };
    });
    return { occurrences: occurrences, summary: summary, total: occurrences.length };
  }

  /* ---------- spec validation ------------------------------------------------- */
  function validateCond(c) {
    if (!c || typeof c !== "object") { return "condition must be an object"; }
    if (!INDS[c.ind]) { return "unknown indicator: " + c.ind; }
    if (OPS.indexOf(c.op) === -1) { return "unknown operator: " + c.op; }
    if (c.ind2 && !INDS[c.ind2]) { return "unknown indicator: " + c.ind2; }
    if (!c.ind2 && c.val === undefined) { return "right side needs ind2 or val"; }
    return null;
  }
  function validateSpec(spec) {
    if (!spec || typeof spec !== "object") { return "spec must be an object"; }
    if (spec.kind !== "algo" && spec.kind !== "tagging") { return "kind must be algo|tagging"; }
    if (!spec.symbol) { return "symbol required"; }
    var lists = spec.kind === "algo" ? ["entry", "exit"] : ["tag"];
    for (var li = 0; li < lists.length; li++) {
      var arr = spec[lists[li]];
      if (!Array.isArray(arr) || !arr.length) { return lists[li] + " needs at least one condition"; }
      for (var i = 0; i < arr.length; i++) {
        var err = validateCond(arr[i]);
        if (err) { return lists[li] + "[" + i + "]: " + err; }
      }
    }
    return null;
  }

  global.Quant = {
    INDS: INDS, OPS: OPS,
    indSeries: indSeries,
    backtest: backtest,
    tagScan: tagScan,
    validateSpec: validateSpec
  };
})(window);
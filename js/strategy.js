/* ==========================================================================
 * strategy.js — STRATEGY LAB: build tagging methodologies & algos by hand
 * or via AI chat, then backtest them on 750-session simulated history.
 * Saves locally (tmd.strategies.v1) and to Supabase when signed in.
 * ======================================================================== */
(function (global) {
  "use strict";

  var STORE_KEY = "tmd.strategies.v1";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }
  function pal(key, fb) { return (global.Themes && Themes.c(key)) || fb; }
  function sizeCanvas(cv, box) {
    var w = box.clientWidth, h = box.clientHeight;
    if (w < 10 || h < 10) { return null; }
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function loadSaved() {
    try {
      var p = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      return Array.isArray(p) ? p : [];
    } catch (e) { return []; }
  }
  function persistSaved(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) { /* noop */ }
    if (global.Cloud) { Cloud.pushStrategies(list); }
  }

  function defaultSpec(kind) {
    if (kind === "tagging") {
      return { kind: "tagging", name: "VOLATILITY TAG", symbol: "XAU",
        tag: [{ ind: "CHG", op: ">", val: 1.2 }], forward: [1, 5, 10] };
    }
    return { kind: "algo", name: "SMA 10/30 CROSS", symbol: "NVDA",
      entry: [{ ind: "SMA", p: 10, op: "crosses_above", ind2: "SMA", p2: 30 }],
      exit: [{ ind: "SMA", p: 10, op: "crosses_below", ind2: "SMA", p2: 30 }],
      costBps: 5 };
  }

  /* ---------- condition row --------------------------------------------------- */
  function condRow(cond, onChange, onRemove) {
    var Q = global.Quant;
    var row = el("div", "sl-cond");
    /* indicator */
    var ind = el("select", "sl-select");
    Object.keys(Q.INDS).forEach(function (k) {
      var o = el("option", "", Q.INDS[k].name);
      o.value = k;
      ind.appendChild(o);
    });
    ind.value = cond.ind || "PRICE";
    /* period */
    var p = el("input", "sl-num");
    p.type = "number"; p.min = "2"; p.max = "200";
    p.value = String(cond.p || (Q.INDS[ind.value].defP || 10));
    p.title = "period";
    /* operator */
    var op = el("select", "sl-select sl-op");
    [["crosses_above", "x above"], ["crosses_below", "x below"],
     [">", ">"], [">=", "≥"], ["<", "<"], ["<=", "≤"]].forEach(function (pair) {
      var o = el("option", "", pair[1]);
      o.value = pair[0];
      op.appendChild(o);
    });
    op.value = cond.op || ">";
    /* rhs: value or indicator */
    var rhsKind = el("select", "sl-select sl-rhs-kind");
    var ov = el("option", "", "value"); ov.value = "val";
    var oi = el("option", "", "indicator"); oi.value = "ind";
    rhsKind.appendChild(ov); rhsKind.appendChild(oi);
    rhsKind.value = cond.ind2 ? "ind" : "val";

    var valIn = el("input", "sl-num sl-val");
    valIn.type = "number"; valIn.step = "any";
    valIn.value = String(cond.val !== undefined ? cond.val : 0);
    var ind2 = el("select", "sl-select");
    Object.keys(Q.INDS).forEach(function (k) {
      var o = el("option", "", Q.INDS[k].name);
      o.value = k;
      ind2.appendChild(o);
    });
    ind2.value = cond.ind2 || "SMA";
    var p2 = el("input", "sl-num");
    p2.type = "number"; p2.min = "2"; p2.max = "200";
    p2.value = String(cond.p2 || 30);
    p2.title = "period";

    function syncVis() {
      var needsP = Q.INDS[ind.value].needsP;
      p.style.display = needsP ? "" : "none";
      var isInd = rhsKind.value === "ind";
      valIn.style.display = isInd ? "none" : "";
      ind2.style.display = isInd ? "" : "none";
      p2.style.display = isInd && Q.INDS[ind2.value].needsP ? "" : "none";
    }
    function commit() {
      cond.ind = ind.value;
      if (Q.INDS[ind.value].needsP) { cond.p = parseInt(p.value, 10) || Q.INDS[ind.value].defP; }
      else { delete cond.p; }
      cond.op = op.value;
      if (rhsKind.value === "ind") {
        cond.ind2 = ind2.value;
        if (Q.INDS[ind2.value].needsP) { cond.p2 = parseInt(p2.value, 10) || Q.INDS[ind2.value].defP; }
        else { delete cond.p2; }
        delete cond.val;
      } else {
        cond.val = parseFloat(valIn.value) || 0;
        delete cond.ind2; delete cond.p2;
      }
      onChange();
    }
    [ind, p, op, rhsKind, valIn, ind2, p2].forEach(function (c) {
      c.addEventListener("change", function () { syncVis(); commit(); });
    });
    var rm = el("button", "sl-rm", "×");
    rm.type = "button";
    rm.addEventListener("click", onRemove);
    [ind, p, op, rhsKind, valIn, ind2, p2, rm].forEach(function (c) { row.appendChild(c); });
    syncVis();
    return row;
  }

  function condSection(title, cls, conds, onChange) {
    var wrap = el("div", "sl-section " + cls);
    var head = el("div", "sl-section-head");
    head.appendChild(el("span", "sl-section-title", title));
    var add = el("button", "chip sl-add", "+ CONDITION");
    add.type = "button";
    head.appendChild(add);
    wrap.appendChild(head);
    var rows = el("div", "sl-cond-rows");
    wrap.appendChild(rows);
    function renderRows() {
      rows.innerHTML = "";
      conds.forEach(function (c, i) {
        rows.appendChild(condRow(c, onChange, function () {
          conds.splice(i, 1);
          renderRows();
          onChange();
        }));
      });
      if (!conds.length) {
        rows.appendChild(el("div", "sl-hint", "no conditions — add one"));
      }
    }
    add.addEventListener("click", function () {
      conds.push({ ind: "SMA", p: 10, op: ">", ind2: "SMA", p2: 30 });
      renderRows();
      onChange();
    });
    renderRows();
    wrap._rerender = renderRows;
    return wrap;
  }

  /* ---------- results ---------------------------------------------------------- */
  function metricCell(label, value, cls, hint) {
    var c = el("div", "sl-metric");
    c.appendChild(el("span", "sl-metric-label", label));
    var v = el("span", "sl-metric-val" + (cls ? " " + cls : ""), value);
    if (hint) { v.title = hint; }
    c.appendChild(v);
    return c;
  }
  function pct(v, d) { return (v >= 0 ? "+" : "") + v.toFixed(d === undefined ? 1 : d) + "%"; }

  function renderMetrics(body, res, spec) {
    var m = res.metrics;
    var grid = el("div", "sl-metrics");
    grid.appendChild(metricCell("RETURN", pct(m.totalReturn), m.totalReturn >= 0 ? "up" : "dn"));
    grid.appendChild(metricCell("BUY&HOLD", pct(m.buyHold), m.buyHold >= 0 ? "up" : "dn"));
    grid.appendChild(metricCell("EXCESS", pct(m.totalReturn - m.buyHold), m.totalReturn - m.buyHold >= 0 ? "up" : "dn", "strategy minus buy-and-hold"));
    grid.appendChild(metricCell("MAX DD", "-" + m.maxDD.toFixed(1) + "%", "dn"));
    grid.appendChild(metricCell("SHARPE", m.sharpe.toFixed(2), m.sharpe >= 1 ? "up" : m.sharpe < 0 ? "dn" : ""));
    grid.appendChild(metricCell("TRADES", String(m.trades)));
    grid.appendChild(metricCell("WIN RATE", m.trades ? m.winRate.toFixed(0) + "%" : "—", m.winRate >= 50 ? "up" : "dn"));
    grid.appendChild(metricCell("AVG WIN", m.trades ? pct(m.avgWin) : "—", "up"));
    grid.appendChild(metricCell("AVG LOSS", m.trades ? pct(m.avgLoss) : "—", "dn"));
    grid.appendChild(metricCell("PROFIT FACTOR", m.trades ? (m.profitFactor === Infinity ? "∞" : m.profitFactor.toFixed(2)) : "—", m.profitFactor > 1.5 ? "up" : ""));
    grid.appendChild(metricCell("EXPOSURE", m.exposure.toFixed(0) + "%", "", "% of sessions in market"));
    grid.appendChild(metricCell("COST", (spec.costBps || 0) + " bps/side"));
    return grid;
  }

  function drawBacktestChart(body, res, bars, spec) {
    var sized = sizeCanvas(body._sl.chart, body._sl.chart.parentElement);
    if (!sized) { return; }
    var ctx = sized.ctx, W = sized.w, H = sized.h;
    ctx.clearRect(0, 0, W, H);
    var padL = 44, padR = 8, padT = 8, padB = 40;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var eq = res.equity;
    var closes = bars.map(function (b) { return b.c; });
    /* normalize both to 1 at bar 0 */
    var norm = closes.map(function (c) { return c / closes[0]; });
    var lo = Infinity, hi = -Infinity;
    eq.concat(norm).forEach(function (v) {
      if (v < lo) { lo = v; }
      if (v > hi) { hi = v; }
    });
    var span = (hi - lo) || 1;
    lo -= span * 0.04; hi += span * 0.04; span = hi - lo;
    function X(i) { return padL + (i / (eq.length - 1)) * plotW; }
    function Y(v) { return padT + (1 - (v - lo) / span) * plotH; }
    /* grid */
    ctx.strokeStyle = pal("grid", "rgba(147,161,161,.12)");
    ctx.fillStyle = pal("axis", "rgba(147,161,161,.75)");
    ctx.font = "9px ui-monospace, Menlo, monospace";
    ctx.textAlign = "right";
    for (var g = 0; g <= 4; g++) {
      var v = lo + span * g / 4;
      var y = Y(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillText(((v - 1) * 100).toFixed(0) + "%", padL - 5, y + 3);
    }
    /* buy & hold */
    ctx.strokeStyle = pal("dimline", "rgba(147,161,161,.35)");
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    norm.forEach(function (v, i) { if (i === 0) { ctx.moveTo(X(0), Y(v)); } else { ctx.lineTo(X(i), Y(v)); } });
    ctx.stroke();
    ctx.setLineDash([]);
    /* equity */
    var up = eq[eq.length - 1] >= 1;
    ctx.strokeStyle = up ? pal("up", "#859900") : pal("down", "#dc322f");
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    eq.forEach(function (v, i) { if (i === 0) { ctx.moveTo(X(0), Y(v)); } else { ctx.lineTo(X(i), Y(v)); } });
    ctx.stroke();
    /* trade markers */
    ctx.font = "8px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    res.trades.forEach(function (t) {
      ctx.fillStyle = pal("up", "#859900");
      ctx.fillText("▲", X(t.entryIdx), H - 26);
      ctx.fillStyle = t.pnlPct >= 0 ? pal("up", "#859900") : pal("down", "#dc322f");
      ctx.fillText("▼", X(t.exitIdx), H - 16);
    });
    /* drawdown strip */
    var peak = eq[0];
    var dds = eq.map(function (e) { if (e > peak) { peak = e; } return (peak - e) / peak; });
    var maxDD = Math.max.apply(null, dds) || 1;
    ctx.fillStyle = pal("down", "#dc322f");
    ctx.globalAlpha = 0.55;
    var ddY = H - 10, ddH = 8;
    for (var i = 0; i < dds.length; i++) {
      var h = (dds[i] / maxDD) * ddH;
      if (h > 0.3) { ctx.fillRect(X(i), ddY - h, Math.max(1, plotW / dds.length), h); }
    }
    ctx.globalAlpha = 1;
    /* legend */
    ctx.textAlign = "left";
    ctx.fillStyle = up ? pal("up", "#859900") : pal("down", "#dc322f");
    ctx.fillText("— equity", padL + 4, padT + 10);
    ctx.fillStyle = pal("axis", "rgba(147,161,161,.75)");
    ctx.fillText("┄ buy&hold   ▲ entry ▼ exit   red strip = drawdown", padL + 60, padT + 10);
  }

  function renderTrades(res) {
    var wrap = el("div", "sl-trades");
    var head = el("div", "sl-trades-head sl-trades-row");
    ["ENTRY", "EXIT", "BARS", "IN", "OUT", "P&L"].forEach(function (h) {
      head.appendChild(el("span", "", h));
    });
    wrap.appendChild(head);
    res.trades.slice(-12).reverse().forEach(function (t) {
      var r = el("div", "sl-trades-row");
      r.appendChild(el("span", "", t.entryDate));
      r.appendChild(el("span", "", t.exitDate));
      r.appendChild(el("span", "", String(t.bars)));
      r.appendChild(el("span", "", t.entryPx.toFixed(2)));
      r.appendChild(el("span", "", t.exitPx.toFixed(2)));
      r.appendChild(el("span", t.pnlPct >= 0 ? "up" : "dn", pct(t.pnlPct)));
      wrap.appendChild(r);
    });
    if (!res.trades.length) {
      wrap.appendChild(el("div", "sl-hint", "no trades triggered — loosen entry conditions"));
    }
    return wrap;
  }

  function renderTagResults(scan, spec) {
    var wrap = el("div", "sl-tagres");
    var sum = el("div", "sl-tagsum");
    sum.appendChild(el("div", "sl-tag-total",
      scan.total + " tagged sessions · forward stats:"));
    var tbl = el("div", "sl-tag-table");
    var head = el("div", "sl-tag-row sl-tag-head");
    head.appendChild(el("span", "", "HORIZON"));
    head.appendChild(el("span", "", "N"));
    head.appendChild(el("span", "", "MEAN"));
    head.appendChild(el("span", "", "MEDIAN"));
    head.appendChild(el("span", "", "WIN%"));
    tbl.appendChild(head);
    scan.summary.forEach(function (s) {
      var r = el("div", "sl-tag-row");
      r.appendChild(el("span", "", "T+" + s.h));
      r.appendChild(el("span", "", String(s.n)));
      r.appendChild(el("span", s.mean >= 0 ? "up" : "dn", pct(s.mean, 2)));
      r.appendChild(el("span", s.median >= 0 ? "up" : "dn", pct(s.median, 2)));
      r.appendChild(el("span", s.win >= 50 ? "up" : "dn", s.win.toFixed(0) + "%"));
      tbl.appendChild(r);
    });
    sum.appendChild(tbl);
    wrap.appendChild(sum);
    var occ = el("div", "sl-occ");
    scan.occurrences.slice(-10).reverse().forEach(function (o) {
      var r = el("div", "sl-occ-row");
      r.appendChild(el("span", "sl-occ-date", o.date));
      r.appendChild(el("span", "", "@ " + o.close.toFixed(2)));
      Object.keys(o.fwd).forEach(function (h) {
        var v = o.fwd[h];
        r.appendChild(el("span", "sl-occ-fwd " + (v >= 0 ? "up" : "dn"),
          "T+" + h + " " + pct(v, 1)));
      });
      occ.appendChild(r);
    });
    wrap.appendChild(occ);
    return wrap;
  }

  /* ---------- AI generation ------------------------------------------------------ */
  var AI_SYS = [
    "You output ONLY a JSON strategy spec for a market backtester. No prose, no markdown fences.",
    "Schema:",
    'algo: {"kind":"algo","name":"...","symbol":"NVDA","entry":[cond...],"exit":[cond...],"costBps":5}',
    'tagging: {"kind":"tagging","name":"...","symbol":"XAU","tag":[cond...],"forward":[1,5,10]}',
    "cond = {\"ind\":IND,\"p\":number,\"op\":OP,\"ind2\":IND,\"p2\":number} OR {\"ind\":IND,\"p\":number,\"op\":OP,\"val\":number}",
    "IND in PRICE,CHG,SMA,EMA,RSI,Z,VOLR (PRICE/CHG take no p). OP in >,>=,<,<=,crosses_above,crosses_below.",
    "crosses_* compares two series (use ind2/p2); comparisons can use ind2/p2 or val.",
    "Entry conds are ANDed, exit conds are ORed. Long-only, fills at close. Symbols: liquid US tickers, indices, or XAU/XAG/XPT/XPD/WTI/DXY.",
    "Return JSON only."
  ].join("\n");

  function extractJson(text) {
    var a = text.indexOf("{"), b = text.lastIndexOf("}");
    if (a === -1 || b <= a) { throw new Error("reply had no JSON object"); }
    var obj = JSON.parse(text.slice(a, b + 1));
    return obj;
  }

  function aiGenerate(body, st, desc, status) {
    var chatSt;
    try { chatSt = JSON.parse(localStorage.getItem("tmd.chat.v1") || "{}"); }
    catch (e) { chatSt = {}; }
    var p = global.Providers.get(chatSt.provider || "openai");
    var key = global.Providers.getKey(p.id);
    if (p.style !== "ollama" && !key) {
      status.textContent = "no API key for " + p.name + " — set it in panel 15 (AI COPILOT) first";
      status.className = "sl-status err";
      return;
    }
    status.textContent = p.name + " is drafting a spec…";
    status.className = "sl-status";
    var messages = [
      { role: "system", content: AI_SYS },
      { role: "user", content: desc }
    ];
    global.Providers.send(p, chatSt.model || p.models[0], key,
      (chatSt.bases && chatSt.bases[p.id]) || p.base, messages)
      .then(function (reply) {
        var spec;
        try {
          spec = extractJson(reply);
          var err = global.Quant.validateSpec(spec);
          if (err) { throw new Error(err); }
        } catch (e2) {
          status.textContent = "AI reply was not a valid spec (" + e2.message + ") — try again or edit JSON manually";
          status.className = "sl-status err";
          return;
        }
        applySpec(body, st, spec);
        status.textContent = "spec applied — review conditions, then RUN";
        status.className = "sl-status ok";
      })
      .catch(function (err) {
        status.textContent = (err && err.message) || "request failed";
        status.className = "sl-status err";
      });
  }

  /* ---------- apply spec to builder UI ------------------------------------------ */
  function applySpec(body, st, spec) {
    st.spec = spec;
    st.nameIn.value = spec.name || "";
    st.symSel.value = spec.symbol;
    st.kind = spec.kind;
    syncKindUI(body, st);
    rebuildSections(body, st);
  }

  function syncKindUI(body, st) {
    st.algoBtn.classList.toggle("active", st.kind === "algo");
    st.tagBtn.classList.toggle("active", st.kind === "tagging");
    st.algoBox.style.display = st.kind === "algo" ? "" : "none";
    st.tagBox.style.display = st.kind === "tagging" ? "" : "none";
    st.runBtn.textContent = st.kind === "algo" ? "RUN BACKTEST" : "SCAN TAGS";
  }

  function rebuildSections(body, st) {
    st.entryBox.innerHTML = "";
    st.exitBox.innerHTML = "";
    st.tagBox.innerHTML = "";
    if (st.kind === "algo") {
      st.spec.entry = st.spec.entry || [];
      st.spec.exit = st.spec.exit || [];
      st.entryBox.appendChild(condSection("ENTRY — all must be true", "sl-entry", st.spec.entry, function () { }));
      st.exitBox.appendChild(condSection("EXIT — any triggers", "sl-exit", st.spec.exit, function () { }));
      if (!st.algoBox.contains(st.costRow)) {
        st.algoBox.appendChild(st.costRow);
      }
    } else {
      st.spec.tag = st.spec.tag || [];
      st.tagBox.appendChild(condSection("TAG WHEN — all true", "sl-entry", st.spec.tag, function () { }));
      if (!st.tagBox.contains(st.fwdRow)) {
        st.tagBox.appendChild(st.fwdRow);
      }
    }
  }

  /* ---------- main widget -------------------------------------------------------- */
  var strategy = {
    mount: function (body, snap, md) {
      body.innerHTML = "";
      var st = { spec: defaultSpec("algo"), kind: "algo", result: null, scan: null };
      body._sl = st;

      /* toolbar */
      var bar = el("div", "sl-bar");
      st.nameIn = el("input", "sl-name");
      st.nameIn.value = st.spec.name;
      st.nameIn.placeholder = "strategy name…";
      st.nameIn.addEventListener("change", function () { st.spec.name = st.nameIn.value.trim() || "UNNAMED"; });
      st.algoBtn = el("button", "chip active", "ALGO");
      st.tagBtn = el("button", "chip", "TAGGING");
      [st.algoBtn, st.tagBtn].forEach(function (b) { b.type = "button"; });
      st.algoBtn.addEventListener("click", function () {
        if (st.kind !== "algo") { st.spec = defaultSpec("algo"); applySpec(body, st, st.spec); }
      });
      st.tagBtn.addEventListener("click", function () {
        if (st.kind !== "tagging") { st.spec = defaultSpec("tagging"); applySpec(body, st, st.spec); }
      });
      st.symSel = el("select", "sl-select sl-sym");
      md.knownSymbols().forEach(function (s) {
        var o = el("option", "", s);
        o.value = s;
        st.symSel.appendChild(o);
      });
      st.symSel.value = st.spec.symbol;
      st.symSel.addEventListener("change", function () { st.spec.symbol = st.symSel.value; });
      bar.appendChild(st.nameIn);
      bar.appendChild(st.algoBtn);
      bar.appendChild(st.tagBtn);
      bar.appendChild(st.symSel);
      body.appendChild(bar);

      /* saved strategies chips */
      var savedRow = el("div", "chip-row sl-saved");
      body.appendChild(savedRow);

      /* builder boxes */
      var builder = el("div", "sl-builder");
      st.algoBox = el("div", "sl-algo");
      st.entryBox = el("div", "");
      st.exitBox = el("div", "");
      st.algoBox.appendChild(st.entryBox);
      st.algoBox.appendChild(st.exitBox);
      st.costRow = el("div", "sl-optrow");
      st.costRow.appendChild(el("span", "sl-opt-label", "transaction cost"));
      st.costIn = el("input", "sl-num");
      st.costIn.type = "number"; st.costIn.min = "0"; st.costIn.max = "200";
      st.costIn.value = String(st.spec.costBps || 0);
      st.costIn.addEventListener("change", function () {
        st.spec.costBps = Math.max(0, parseFloat(st.costIn.value) || 0);
      });
      st.costRow.appendChild(st.costIn);
      st.costRow.appendChild(el("span", "sl-hint", "bps per side"));
      st.algoBox.appendChild(st.costRow);
      st.tagBox = el("div", "sl-tagbox");
      st.tagBox.style.display = "none";
      st.fwdRow = el("div", "sl-optrow");
      st.fwdRow.appendChild(el("span", "sl-opt-label", "forward horizons"));
      st.fwdIn = el("input", "sl-fwd");
      st.fwdIn.value = (st.spec.forward || [1, 5, 10]).join(",");
      st.fwdIn.addEventListener("change", function () {
        var arr = st.fwdIn.value.split(",").map(function (x) {
          return parseInt(x.trim(), 10);
        }).filter(function (x) { return x > 0 && x <= 250; }).slice(0, 6);
        st.spec.forward = arr.length ? arr : [1, 5, 10];
      });
      st.fwdRow.appendChild(st.fwdIn);
      st.fwdRow.appendChild(el("span", "sl-hint", "sessions ahead (comma-separated)"));
      st.tagBox.appendChild(st.fwdRow);
      builder.appendChild(st.algoBox);
      builder.appendChild(st.tagBox);
      body.appendChild(builder);

      /* actions */
      var actions = el("div", "sl-actions");
      st.runBtn = el("button", "chip sl-run", "RUN BACKTEST");
      st.runBtn.type = "button";
      var saveBtn = el("button", "chip", "SAVE");
      saveBtn.type = "button";
      var aiBtn = el("button", "chip", "AI BUILD");
      aiBtn.type = "button";
      var jsonBtn = el("button", "chip", "JSON");
      jsonBtn.type = "button";
      actions.appendChild(st.runBtn);
      actions.appendChild(saveBtn);
      actions.appendChild(aiBtn);
      actions.appendChild(jsonBtn);
      body.appendChild(actions);

      /* status */
      st.status = el("div", "sl-status");
      body.appendChild(st.status);

      /* AI box */
      st.aiBox = el("div", "sl-aibox");
      st.aiBox.style.display = "none";
      st.aiIn = el("textarea", "sl-aiin");
      st.aiIn.rows = 3;
      st.aiIn.placeholder = "describe the strategy in plain words — e.g. \"buy when 10-day crosses above 30-day and RSI under 70, exit on 10/30 cross down, 5bps costs\" or \"tag days gold jumps 1.5%+ on 2x volume\"";
      var aiGo = el("button", "chip sl-run", "GENERATE SPEC");
      aiGo.type = "button";
      aiGo.addEventListener("click", function () {
        var d = st.aiIn.value.trim();
        if (!d) { return; }
        aiGenerate(body, st, d, st.status);
      });
      st.aiBox.appendChild(st.aiIn);
      st.aiBox.appendChild(aiGo);
      body.appendChild(st.aiBox);

      /* JSON box */
      st.jsonBox = el("div", "sl-jsonbox");
      st.jsonBox.style.display = "none";
      st.jsonIn = el("textarea", "sl-jsonin");
      st.jsonIn.rows = 6;
      var jsonApply = el("button", "chip sl-run", "APPLY JSON");
      jsonApply.type = "button";
      jsonApply.addEventListener("click", function () {
        try {
          var spec = JSON.parse(st.jsonIn.value);
          var err = global.Quant.validateSpec(spec);
          if (err) { throw new Error(err); }
          applySpec(body, st, spec);
          st.status.textContent = "spec applied";
          st.status.className = "sl-status ok";
        } catch (e) {
          st.status.textContent = "invalid spec: " + e.message;
          st.status.className = "sl-status err";
        }
      });
      st.jsonBox.appendChild(st.jsonIn);
      st.jsonBox.appendChild(jsonApply);
      body.appendChild(st.jsonBox);

      aiBtn.addEventListener("click", function () {
        var show = st.aiBox.style.display === "none";
        st.aiBox.style.display = show ? "" : "none";
        st.jsonBox.style.display = "none";
        aiBtn.classList.toggle("active", show);
        jsonBtn.classList.remove("active");
      });
      jsonBtn.addEventListener("click", function () {
        var show = st.jsonBox.style.display === "none";
        st.jsonIn.value = JSON.stringify(st.spec, null, 2);
        st.jsonBox.style.display = show ? "" : "none";
        st.aiBox.style.display = "none";
        jsonBtn.classList.toggle("active", show);
        aiBtn.classList.remove("active");
      });

      /* results area */
      var resWrap = el("div", "sl-results");
      var chartWrap = el("div", "sl-chart-wrap");
      var chart = el("canvas", "sl-chart");
      chartWrap.appendChild(chart);
      resWrap.appendChild(chartWrap);
      var detail = el("div", "sl-detail");
      resWrap.appendChild(detail);
      body.appendChild(resWrap);
      st.chart = chart;
      st.resWrap = resWrap;
      st.detail = detail;
      resWrap.style.display = "none";

      rebuildSections(body, st);
      syncKindUI(body, st);

      /* saved chips render */
      function renderSaved() {
        savedRow.innerHTML = "";
        var list = loadSaved();
        if (!list.length) {
          savedRow.appendChild(el("span", "sl-hint", "no saved strategies yet — SAVE stores locally + cloud when signed in"));
          return;
        }
        list.forEach(function (s, i) {
          var c = el("button", "chip", s.name + " · " + s.symbol);
          c.type = "button";
          c.title = s.kind;
          c.addEventListener("click", function () {
            applySpec(body, st, JSON.parse(JSON.stringify(s)));
            st.status.textContent = "loaded " + s.name;
            st.status.className = "sl-status";
          });
          savedRow.appendChild(c);
          var x = el("button", "chip sl-rm", "×");
          x.type = "button";
          x.addEventListener("click", function () {
            var l2 = loadSaved();
            l2.splice(i, 1);
            persistSaved(l2);
            renderSaved();
          });
          savedRow.appendChild(x);
        });
      }
      renderSaved();
      st._renderSaved = renderSaved;

      saveBtn.addEventListener("click", function () {
        st.spec.name = st.nameIn.value.trim() || "UNNAMED";
        var err = global.Quant.validateSpec(st.spec);
        if (err) {
          st.status.textContent = "cannot save: " + err;
          st.status.className = "sl-status err";
          return;
        }
        var list = loadSaved();
        var idx = -1;
        list.forEach(function (s, i) { if (s.name === st.spec.name) { idx = i; } });
        var copy = JSON.parse(JSON.stringify(st.spec));
        if (idx > -1) { list[idx] = copy; } else { list.push(copy); }
        persistSaved(list);
        renderSaved();
        st.status.textContent = "saved " + st.spec.name + (global.Cloud && Cloud.user() ? " · synced to cloud" : " · local");
        st.status.className = "sl-status ok";
      });

      /* RUN */
      st.runBtn.addEventListener("click", function () {
        var spec = st.spec;
        spec.name = st.nameIn.value.trim() || "UNNAMED";
        var err = global.Quant.validateSpec(spec);
        if (err) {
          st.status.textContent = err;
          st.status.className = "sl-status err";
          return;
        }
        var bars = md.history(spec.symbol, 750);
        resWrap.style.display = "";
        if (spec.kind === "algo") {
          st.result = global.Quant.backtest(spec, bars);
          st.scan = null;
          st.detail.innerHTML = "";
          st.detail.appendChild(renderMetrics(body, st.result, spec));
          st.detail.appendChild(renderTrades(st.result));
          drawBacktestChart(body, st.result, bars, spec);
          st.status.textContent = "750 simulated sessions · fills at close · long-only · " +
            (global.Cloud && Cloud.user() ? "run logged to cloud" : "sign in to log runs");
          st.status.className = "sl-status ok";
          if (global.Cloud) { Cloud.logRun(spec, spec.symbol, st.result); }
        } else {
          st.scan = global.Quant.tagScan(spec, bars);
          st.result = null;
          st.detail.innerHTML = "";
          st.detail.appendChild(renderTagResults(st.scan, spec));
          var ctx = st.chart.getContext("2d");
          ctx.clearRect(0, 0, st.chart.width, st.chart.height);
          drawTagChart(body, st.scan, bars, spec);
          st.status.textContent = "750 simulated sessions scanned";
          st.status.className = "sl-status ok";
        }
      });
    },
    update: function () { /* event-driven */ },
    _loadSaved: loadSaved
  };

  function drawTagChart(body, scan, bars, spec) {
    var sized = sizeCanvas(body._sl.chart, body._sl.chart.parentElement);
    if (!sized) { return; }
    var ctx = sized.ctx, W = sized.w, H = sized.h;
    ctx.clearRect(0, 0, W, H);
    var padL = 44, padR = 8, padT = 8, padB = 18;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var closes = bars.map(function (b) { return b.c; });
    var lo = Math.min.apply(null, closes), hi = Math.max.apply(null, closes);
    var span = (hi - lo) || 1;
    function X(i) { return padL + (i / (closes.length - 1)) * plotW; }
    function Y(v) { return padT + (1 - (v - lo) / span) * plotH; }
    ctx.strokeStyle = pal("grid", "rgba(147,161,161,.12)");
    ctx.fillStyle = pal("axis", "rgba(147,161,161,.75)");
    ctx.font = "9px ui-monospace, Menlo, monospace";
    ctx.textAlign = "right";
    for (var g = 0; g <= 4; g++) {
      var v = lo + span * g / 4, y = Y(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillText(v.toFixed(v > 100 ? 0 : 2), padL - 5, y + 3);
    }
    ctx.strokeStyle = pal("accent", "#2aa198");
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    closes.forEach(function (c, i) { if (i === 0) { ctx.moveTo(X(0), Y(c)); } else { ctx.lineTo(X(i), Y(c)); } });
    ctx.stroke();
    /* hit markers */
    ctx.fillStyle = pal("warn", "#b58900");
    scan.occurrences.forEach(function (o) {
      ctx.beginPath();
      ctx.arc(X(o.idx), Y(o.close), 3, 0, 6.2832);
      ctx.fill();
    });
    ctx.textAlign = "left";
    ctx.fillStyle = pal("axis", "rgba(147,161,161,.75)");
    ctx.fillText("— " + spec.symbol + "   ● tagged (" + scan.total + ")", padL + 4, padT + 10);
  }

  global.Widgets.strategy = strategy;
})(window);
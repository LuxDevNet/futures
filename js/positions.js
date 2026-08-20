/* ==========================================================================
 * positions.js — POSITIONS: manual book tracker with live demo P&L
 * localStorage (tmd.positions.v1) + Supabase sync when signed in
 * ======================================================================== */
(function (global) {
  "use strict";

  var KEY = "tmd.positions.v1";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }
  function fmt() { return global.Widgets._fmt; }

  function load() {
    try {
      var p = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(p) ? p : [];
    } catch (e) { return []; }
  }
  function persist(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* noop */ }
    if (global.Cloud) { Cloud.pushPositions(list); }
  }

  function lookupPrices(snap) {
    var map = {};
    snap.universe.forEach(function (g) {
      g.items.forEach(function (it) { map[it.sym] = { px: it.price, chg: it.changePct }; });
    });
    snap.tape.forEach(function (t) { map[t.sym] = { px: t.price, chg: t.changePct }; });
    snap.metals.forEach(function (m) { map[m.sym] = { px: m.price, chg: m.changePct }; });
    return map;
  }

  var positions = {
    mount: function (body) {
      body.innerHTML = "";
      var addRow = el("div", "pos-add");
      var sym = el("input", "list-input pos-sym");
      sym.placeholder = "SYM";
      sym.setAttribute("list", "wl-syms");
      var qty = el("input", "list-input pos-qty");
      qty.type = "number"; qty.step = "any"; qty.placeholder = "qty";
      var cost = el("input", "list-input pos-cost");
      cost.type = "number"; cost.step = "any"; cost.placeholder = "avg cost";
      var btn = el("button", "chip list-add-btn", "+ ADD");
      btn.type = "button";
      addRow.appendChild(sym); addRow.appendChild(qty); addRow.appendChild(cost); addRow.appendChild(btn);
      body.appendChild(addRow);
      var table = el("div", "pos-table");
      body.appendChild(table);
      var foot = el("div", "pos-foot");
      body.appendChild(foot);

      btn.addEventListener("click", function () {
        var s = sym.value.trim().toUpperCase();
        var q = parseFloat(qty.value), c = parseFloat(cost.value);
        if (!s || !(q > 0) || !(c > 0)) { return; }
        var list = load();
        var ex = null;
        list.forEach(function (p) { if (p.symbol === s) { ex = p; } });
        if (ex) {
          var tot = ex.qty * ex.avgCost + q * c;
          ex.qty += q;
          ex.avgCost = tot / ex.qty;
        } else {
          list.push({ symbol: s, qty: q, avgCost: c, openedAt: new Date().toISOString().slice(0, 10) });
        }
        persist(list);
        sym.value = ""; qty.value = ""; cost.value = "";
        positions.update(body, global.__md ? global.__md.snap : null);
      });
    },
    update: function (body, snap) {
      if (!snap) { return; }
      var f = fmt();
      var prices = lookupPrices(snap);
      var table = body.querySelector(".pos-table");
      var foot = body.querySelector(".pos-foot");
      var list = load();
      table.innerHTML = "";
      if (!list.length) {
        table.appendChild(el("div", "list-empty", "no positions — add above; syncs to cloud when signed in"));
        foot.innerHTML = "";
        return;
      }
      var head = el("div", "pos-row pos-head");
      ["SYM", "QTY", "AVG", "LAST", "DAY", "MKT VAL", "P&L", ""].forEach(function (h) {
        head.appendChild(el("span", "", h));
      });
      table.appendChild(head);
      var totVal = 0, totPnl = 0, totCost = 0;
      list.forEach(function (p) {
        var m = prices[p.symbol];
        var last = m ? m.px : null;
        var val = last ? last * p.qty : null;
        var pnl = last ? (last - p.avgCost) * p.qty : null;
        var pnlPct = last ? (last / p.avgCost - 1) * 100 : null;
        if (val !== null) { totVal += val; }
        if (pnl !== null) { totPnl += pnl; }
        totCost += p.avgCost * p.qty;
        var r = el("div", "pos-row");
        r.appendChild(el("span", "pos-sym-c", p.symbol));
        r.appendChild(el("span", "", f.num(p.qty)));
        r.appendChild(el("span", "", f.num(p.avgCost)));
        r.appendChild(el("span", "", last ? f.num(last) : "—"));
        r.appendChild(el("span", m ? f.cls(m.chg) : "", m ? f.pct(m.chg) : "—"));
        r.appendChild(el("span", "", val !== null ? f.num(val) : "—"));
        r.appendChild(el("span", pnl !== null ? (pnl >= 0 ? "up" : "dn") : "",
          pnl !== null ? (pnl >= 0 ? "+" : "") + f.num(pnl) + " (" + pct1(pnlPct) + ")" : "—"));
        var rm = el("button", "list-rm", "×");
        rm.type = "button";
        rm.addEventListener("click", function () {
          var l2 = load().filter(function (x) { return x.symbol !== p.symbol; });
          persist(l2);
          positions.update(body, snap);
        });
        r.appendChild(rm);
        table.appendChild(r);
      });
      foot.innerHTML = "";
      var totPct = totCost > 0 ? (totVal / totCost - 1) * 100 : 0;
      foot.appendChild(el("span", "pos-total",
        "book value " + f.num(totVal) + " · cost " + f.num(totCost)));
      foot.appendChild(el("span", "pos-total " + (totPnl >= 0 ? "up" : "dn"),
        "P&L " + (totPnl >= 0 ? "+" : "") + f.num(totPnl) + " (" + pct1(totPct) + ")"));
    },
    _load: load
  };

  function pct1(v) { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }

  global.Widgets.positions = positions;
})(window);
/* ==========================================================================
 * chat.js — AI copilot with bring-your-own-key for 20 providers
 * Keys live in localStorage only; requests go straight from the browser to
 * the chosen provider. Friendly error bubbles, never console noise.
 * ======================================================================== */
(function (global) {
  "use strict";

  var STATE_KEY = "tmd.chat.v1";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }

  function loadState() {
    try {
      var p = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
      if (p && p.provider) { p.history = p.history || []; p.bases = p.bases || {}; return p; }
    } catch (e) { /* noop */ }
    return { provider: "openai", model: "", bases: {}, history: [], context: true };
  }
  function saveState(st) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        provider: st.provider, model: st.model, bases: st.bases,
        history: st.history.slice(-20), context: st.context
      }));
    } catch (e) { /* noop */ }
  }

  function marketContext(md) {
    if (!md || !md.snap) { return ""; }
    var s = md.snap;
    var lines = ["Live terminal snapshot (" + (md.isLive() ? "live feed" : "demo feed") + "):"];
    s.tape.slice(0, 8).forEach(function (t) {
      lines.push("- " + t.sym + " " + t.price.toFixed(2) +
        " (" + (t.changePct >= 0 ? "+" : "") + t.changePct.toFixed(2) + "%)");
    });
    var all = [];
    s.universe.forEach(function (g) {
      g.items.forEach(function (it) { all.push(it); });
    });
    all.sort(function (a, b) { return b.changePct - a.changePct; });
    lines.push("Top movers up: " + all.slice(0, 3).map(function (i) {
      return i.sym + " +" + i.changePct.toFixed(2) + "%";
    }).join(", "));
    lines.push("Top movers down: " + all.slice(-3).map(function (i) {
      return i.sym + " " + i.changePct.toFixed(2) + "%";
    }).join(", "));
    return lines.join("\n");
  }

  var aichat = {
    mount: function (body) {
      body.innerHTML = "";
      var st = loadState();
      body._chat = st;

      /* ----- config row ----- */
      var cfg = el("div", "chat-cfg");
      var provSel = el("select", "chat-select");
      global.Providers.list.forEach(function (p) {
        var o = el("option", "", p.name);
        o.value = p.id;
        provSel.appendChild(o);
      });
      provSel.value = st.provider;
      var modelSel = el("select", "chat-select");
      var keyInput = el("input", "chat-key");
      keyInput.type = "password";
      keyInput.placeholder = "paste API key…";
      keyInput.autocomplete = "off";
      var keyToggle = el("button", "chip chat-eye", "SHOW");
      keyToggle.type = "button";
      var baseInput = el("input", "chat-base");
      baseInput.type = "text";
      baseInput.placeholder = "endpoint override (optional)";
      baseInput.autocomplete = "off";
      cfg.appendChild(provSel);
      cfg.appendChild(modelSel);
      var keyForm = el("form", "chat-keyform");
      keyForm.addEventListener("submit", function (ev) { ev.preventDefault(); });
      keyForm.appendChild(keyInput);
      cfg.appendChild(keyForm);
      cfg.appendChild(keyToggle);
      cfg.appendChild(baseInput);
      body.appendChild(cfg);

      var note = el("div", "chat-note");
      body.appendChild(note);

      function refreshProviderUI() {
        var p = global.Providers.get(st.provider);
        modelSel.innerHTML = "";
        p.models.forEach(function (m) {
          var o = el("option", "", m);
          o.value = m;
          modelSel.appendChild(o);
        });
        modelSel.value = p.models.indexOf(st.model) > -1 ? st.model : p.models[0];
        st.model = modelSel.value;
        keyInput.value = global.Providers.getKey(p.id);
        baseInput.value = st.bases[p.id] || "";
        baseInput.placeholder = p.base;
        keyInput.disabled = p.style === "ollama";
        keyToggle.disabled = p.style === "ollama";
        note.innerHTML = "";
        note.appendChild(el("span", "chat-note-key",
          (p.style === "ollama" ? "no key needed" : keyInput.value ? "key saved locally" : "no key saved") ));
        var link = el("a", "chat-note-link", "get a key ↗");
        link.href = p.keyUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        note.appendChild(link);
        if (p.note) { note.appendChild(el("span", "chat-note-warn", p.note)); }
      }

      provSel.addEventListener("change", function () {
        st.provider = provSel.value;
        refreshProviderUI();
        saveState(st);
      });
      modelSel.addEventListener("change", function () {
        st.model = modelSel.value;
        saveState(st);
      });
      keyInput.addEventListener("change", function () {
        global.Providers.setKey(st.provider, keyInput.value.trim());
        refreshProviderUI();
      });
      keyToggle.addEventListener("click", function () {
        var show = keyInput.type === "password";
        keyInput.type = show ? "text" : "password";
        keyToggle.textContent = show ? "HIDE" : "SHOW";
      });
      baseInput.addEventListener("change", function () {
        st.bases[st.provider] = baseInput.value.trim();
        saveState(st);
      });
      refreshProviderUI();

      /* ----- log ----- */
      var log = el("div", "chat-log");
      body.appendChild(log);

      function bubble(role, text) {
        var b = el("div", "chat-msg chat-" + role);
        var who = el("span", "chat-who",
          role === "user" ? "YOU" : role === "error" ? "SYSTEM" : "AI");
        var body2 = el("span", "chat-text", text);
        b.appendChild(who);
        b.appendChild(body2);
        log.appendChild(b);
        log.scrollTop = log.scrollHeight;
        return b;
      }

      st.history.forEach(function (m) { bubble(m.role, m.content); });

      /* ----- composer ----- */
      var quick = el("div", "chip-row chat-quick");
      [["MARKET SUMMARY", "Give me a tight 4-bullet market summary from the snapshot."],
       ["RISK SCAN", "From the snapshot, what looks most crowded or risky right now?"],
       ["IDEA DRILL", "Pick one name from the snapshot movers and build a quick long/short debate."]].forEach(function (q) {
        var c = el("button", "chip", q[0]);
        c.type = "button";
        c.addEventListener("click", function () {
          input.value = q[1];
          doSend();
        });
        quick.appendChild(c);
      });
      body.appendChild(quick);

      var composer = el("div", "chat-composer");
      var input = el("input", "chat-input");
      input.type = "text";
      input.placeholder = "ask the desk copilot…  (enter to send)";
      input.autocomplete = "off";
      var ctxBtn = el("button", "chip chat-ctx", "CTX ON");
      ctxBtn.type = "button";
      ctxBtn.title = "attach live market snapshot to your question";
      var sendBtn = el("button", "chip chat-send", "SEND ↵");
      sendBtn.type = "button";
      composer.appendChild(ctxBtn);
      composer.appendChild(input);
      composer.appendChild(sendBtn);
      body.appendChild(composer);

      if (!st.context) { ctxBtn.textContent = "CTX OFF"; ctxBtn.classList.remove("live"); }
      else { ctxBtn.classList.add("live"); }

      ctxBtn.addEventListener("click", function () {
        st.context = !st.context;
        ctxBtn.textContent = st.context ? "CTX ON" : "CTX OFF";
        ctxBtn.classList.toggle("live", st.context);
        saveState(st);
      });

      var busy = false;
      function doSend() {
        if (busy) { return; }
        var text = input.value.trim();
        if (!text) { return; }
        var p = global.Providers.get(st.provider);
        var key = global.Providers.getKey(p.id);
        if (p.style !== "ollama" && !key) {
          bubble("error", "no API key saved for " + p.name + " — paste one above first.");
          return;
        }
        input.value = "";
        busy = true;
        sendBtn.classList.add("busy");
        sendBtn.textContent = "···";
        bubble("user", text);
        st.history.push({ role: "user", content: text });

        var messages = [];
        var sys = "You are the desk copilot inside a global markets terminal. " +
          "Be concise, numeric, and direct. Use short bullets. " +
          "If the question is about markets, lean on the attached snapshot; " +
          "say plainly when something is not in the data.";
        if (st.context) {
          var ctxText = marketContext(global.__md);
          if (ctxText) { sys += "\n\n" + ctxText; }
        }
        messages.push({ role: "system", content: sys });
        st.history.slice(-12).forEach(function (m) {
          messages.push({ role: m.role === "user" ? "user" : "assistant", content: m.content });
        });

        var thinking = bubble("ai", "…");
        global.Providers.send(p, st.model, key, st.bases[p.id] || p.base, messages)
          .then(function (reply) {
            thinking.querySelector(".chat-text").textContent = reply;
            st.history.push({ role: "assistant", content: reply });
            saveState(st);
          })
          .catch(function (err) {
            thinking.classList.remove("chat-ai");
            thinking.classList.add("chat-error");
            thinking.querySelector(".chat-who").textContent = "SYSTEM";
            thinking.querySelector(".chat-text").textContent =
              p.name + " — " + (err && err.message ? err.message : "request failed");
          })
          .then(function () {
            busy = false;
            sendBtn.classList.remove("busy");
            sendBtn.textContent = "SEND ↵";
            log.scrollTop = log.scrollHeight;
          });
      }

      sendBtn.addEventListener("click", doSend);
      input.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") { doSend(); }
      });
    },
    update: function () { /* chat is event-driven */ }
  };

  global.Widgets.aichat = aichat;
})(window);
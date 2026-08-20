/* ==========================================================================
 * boot.js — BIOS boot sequence + global error trap
 * Loads FIRST. Routes any unexpected error into the boot log (warn-level),
 * so the console stays clean in every mode.
 * ======================================================================== */
(function () {
  "use strict";

  var lines = [];
  function log(msg) {
    lines.push(msg);
    var pre = document.getElementById("boot-log");
    if (pre) {
      pre.textContent = lines.join("\n") + "\n█";
      pre.scrollTop = pre.scrollHeight;
    }
  }

  /* ---- global error trap: nothing ever reaches the console as an error ---- */
  window.onerror = function (msg, src, line) {
    log("! trapped: " + msg + (line ? " @" + line : ""));
    try { console.warn("[tmd] trapped:", msg); } catch (e) { /* noop */ }
    return true; /* suppress console error */
  };
  window.addEventListener("unhandledrejection", function (e) {
    log("! trapped async: " + (e.reason && e.reason.message ? e.reason.message : "rejection"));
    try { console.warn("[tmd] trapped async rejection"); } catch (err) { /* noop */ }
    e.preventDefault();
  });

  /* ---- boot sequence -------------------------------------------------------- */
  var REDUCED = false;
  try { REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* noop */ }

  var SEQ = [
    ["TMD//GLOBAL BIOS v2.3 — solarized glass build", 0],
    ["> storage ............ OK  localStorage available", 120],
    ["> adapter.demo ....... OK  seeded engine · 47 instruments", 90],
    ["> adapter.live ....... IDLE  stooq gateway on standby", 90],
    ["> fonts .............. OK  Familjen Grotesk (local woff2)", 80],
    ["> sessions ........... OK  6 venues · lunch breaks · DST-aware", 80],
    ["> layout ............. ..  restoring window manager state", 110],
    ["> render ............. OK  canvas + dom compositors", 90],
    ["SYSTEM READY — entering terminal_", 140]
  ];

  function dismiss(boot) {
    if (!boot || boot.classList.contains("done")) { return; }
    boot.classList.add("done");
    setTimeout(function () {
      if (boot.parentElement) { boot.parentElement.removeChild(boot); }
    }, REDUCED ? 0 : 550);
  }

  function run() {
    var boot = document.getElementById("boot");
    if (!boot) { return; }

    /* restore scanline preference early so boot matches */
    try {
      if (localStorage.getItem("tmd.scan") === "off") {
        document.body.classList.add("no-scan");
      }
    } catch (e) { /* noop */ }

    var skip = function () { dismiss(boot); };
    boot.addEventListener("click", skip);
    window.addEventListener("keydown", function onKey(e) {
      if (document.getElementById("boot")) { skip(); }
      window.removeEventListener("keydown", onKey);
    });

    if (REDUCED) {
      SEQ.forEach(function (s) { log(s[0]); });
      setTimeout(function () { dismiss(boot); }, 350);
      return;
    }

    var i = 0;
    (function next() {
      if (i >= SEQ.length) {
        setTimeout(function () { dismiss(boot); }, 420);
        return;
      }
      if (!document.getElementById("boot")) { return; }
      log(SEQ[i][0]);
      var delay = SEQ[i][1];
      i++;
      setTimeout(next, delay);
    })();

    /* hard cap: never trap the user behind the boot screen */
    setTimeout(function () { dismiss(document.getElementById("boot")); }, 4200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
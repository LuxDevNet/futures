/* ==========================================================================
 * themes.js — 4 themes: solarized-dark / solarized-light / off-white / oled
 * CSS side: html[data-theme] variable blocks in styles.css
 * JS side: canvas palettes for all chart drawing
 * ======================================================================== */
(function (global) {
  "use strict";

  var KEY = "tmd.theme";

  var THEMES = [
    { id: "solarized-dark",  name: "Solarized Dark" },
    { id: "solarized-light", name: "Solarized Light" },
    { id: "off-white",       name: "Off-White" },
    { id: "oled",            name: "OLED" }
  ];

  var PALETTES = {
    "solarized-dark": {
      up: "#859900", upRGB: "133,153,0",
      down: "#dc322f", downRGB: "220,50,47",
      accent: "#2aa198", accentRGB: "42,161,152",
      warn: "#b58900", warnRGB: "181,137,0",
      violet: "#6c71c4", now: "#cb4b16",
      ma: "#268bd2",
      grid: "rgba(147,161,161,.12)", axis: "rgba(147,161,161,.75)",
      bright: "#eee8d5", pillText: "#002b36",
      land: "rgba(147,161,161,.30)", dimline: "rgba(147,161,161,.35)", dimRGB: "147,161,161"
    },
    "solarized-light": {
      up: "#859900", upRGB: "133,153,0",
      down: "#dc322f", downRGB: "220,50,47",
      accent: "#2aa198", accentRGB: "42,161,152",
      warn: "#b58900", warnRGB: "181,137,0",
      violet: "#6c71c4", now: "#cb4b16",
      ma: "#268bd2",
      grid: "rgba(101,123,131,.20)", axis: "rgba(88,110,117,.85)",
      bright: "#073642", pillText: "#fdf6e3",
      land: "rgba(101,123,131,.38)", dimline: "rgba(101,123,131,.45)", dimRGB: "101,123,131"
    },
    "off-white": {
      up: "#2e7d46", upRGB: "46,125,70",
      down: "#c2453a", downRGB: "194,69,58",
      accent: "#0e7490", accentRGB: "14,116,144",
      warn: "#b07d2a", warnRGB: "176,125,42",
      violet: "#6d5bd0", now: "#d35400",
      ma: "#2563eb",
      grid: "rgba(51,48,42,.12)", axis: "rgba(51,48,42,.65)",
      bright: "#1c1a16", pillText: "#fffdf8",
      land: "rgba(51,48,42,.28)", dimline: "rgba(51,48,42,.40)", dimRGB: "51,48,42"
    },
    "oled": {
      up: "#00e676", upRGB: "0,230,118",
      down: "#ff5252", downRGB: "255,82,82",
      accent: "#22d3ee", accentRGB: "34,211,238",
      warn: "#ffc107", warnRGB: "255,193,7",
      violet: "#b388ff", now: "#ff6d00",
      ma: "#40c4ff",
      grid: "rgba(255,255,255,.10)", axis: "rgba(255,255,255,.55)",
      bright: "#ffffff", pillText: "#000000",
      land: "rgba(255,255,255,.20)", dimline: "rgba(255,255,255,.35)", dimRGB: "255,255,255"
    }
  };

  var current = "solarized-dark";
  try {
    var saved = localStorage.getItem(KEY);
    if (saved && PALETTES[saved]) { current = saved; }
  } catch (e) { /* noop */ }

  function apply(id) {
    if (!PALETTES[id]) { id = "solarized-dark"; }
    current = id;
    document.documentElement.setAttribute("data-theme", id);
    try { localStorage.setItem(KEY, id); } catch (e) { /* noop */ }
    if (typeof global.__onThemeChange === "function") {
      global.__onThemeChange(id);
    }
  }

  function c(key) {
    return PALETTES[current][key] || PALETTES["solarized-dark"][key];
  }

  function sectorColor(group) {
    if (group === "AI-TECH") { return c("accent"); }
    if (group === "ENERGY") { return c("warn"); }
    return c("violet");
  }

  function peek(id, key) {
    var p = PALETTES[id] || PALETTES["solarized-dark"];
    return p[key] || "";
  }

  global.Themes = {
    list: THEMES,
    apply: apply,
    c: c,
    peek: peek,
    sectorColor: sectorColor,
    current: function () { return current; }
  };

  /* set attribute immediately to avoid flash of wrong theme */
  document.documentElement.setAttribute("data-theme", current);
})(window);
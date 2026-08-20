# /TERMINAL — Global Market Monitor

A glass-paneled, **window-managed** market monitoring terminal. BIOS boot sequence, free-form draggable windows, **4 instant themes**, world map, supply-web graph, custom watchlists, a settings console, and an **AI copilot with bring-your-own-key for 20 providers**. Familjen Grotesk headlines, mono data type, CRT scanlines — dense like a Bloomberg panel, calm like Solarized.

## Quick start

1. Unzip anywhere.
2. Open `index.html` directly in any modern browser — **no server, no build, no network required**.
3. Verified: **zero console errors** over `file://`. Fonts bundled locally, nothing loads from a CDN.

## Themes (4)

`⚙ SETUP → APPEARANCE`, or persisted across sessions (`tmd.theme`):

- **Solarized Dark** — the default terminal
- **Solarized Light** — paper-bright, same accent logic
- **Off-White** — warm newsprint, ink text
- **OLED** — true black, neon green/cyan

Every chart canvas (candles, heatmap, map, graph, sparklines, session bands) re-paints instantly from a per-theme palette — no reload.

## Window manager

- **Boot BIOS** — full-screen self-check sequence; click or any key skips; honors `prefers-reduced-motion`
- **Free-form windows** — drag by title bar; dashed ghost preview; drop **snaps to 8px grid**
- **Resize** — corner grip, 8px-snapped, min 240×170 · **Collapse** — double-click title bar or `—`
- **Z-raise** on click · **persistence** of position/size/collapse/z to `localStorage` (debounced 300ms)
- **Tile windows** — one click in settings snaps everything back to the mosaic

## Settings console (`⚙ SETUP`)

- **CONNECTION** — demo/live feed, refresh interval (1s–10s), custom live endpoint (CSV quote source)
- **APPEARANCE** — 4-theme swatch picker, scanline toggle
- **LAYOUT** — tile windows / reset layout
- **ACCOUNT** — Supabase sign-in for cloud sync (see below)
- **DATA & KEYS** — granular clears (layout, watchlists, AI keys, news read state) + full factory reset

## AI copilot — bring your own key

Panel 15. Pick from **20 providers**, paste your key, chat. Keys are stored **only in your browser's localStorage** (`tmd.aikeys.v1`) and requests go straight from the browser to the provider — nothing proxies anywhere.

OpenAI · Anthropic · Google Gemini · DeepSeek · Moonshot Kimi · Venice AI · Hugging Face · xAI Grok · Mistral · Groq · Together · Fireworks · OpenRouter · Perplexity · Cohere · Cerebras · Azure OpenAI · Ollama (local, keyless) · Cloudflare Workers AI · Novita AI

- Per-provider model lists, endpoint override (Azure resource URL, Cloudflare account, self-hosted)
- **CTX toggle** attaches the live terminal snapshot (tape + top movers) to your question
- Quick prompts: MARKET SUMMARY / RISK SCAN / IDEA DRILL
- Friendly in-chat error bubbles (bad key, rate limit, CORS/offline) — never console noise
- Note: browser CORS is up to each provider; keyless local option (Ollama) always works

## Keyboard & URL

| Key | Action |
|---|---|
| `R` | reset layout to default mosaic |
| `L` | toggle live/demo data adapter |
| `S` | toggle CRT scanlines (persisted) |
| `Esc` | close settings |
| `←` / `→` / `Enter` | AAPL crosshair / pin inspector |

`?mode=live` boots straight into live mode.

## Panels

| # | Panel | Contents |
|---|---|---|
| — | **TAPE** | scrolling marquee, 11 instruments, session states, tick flashes |
| 01 | **GLOBAL TICKER** | 11 instruments, click-to-focus, tick flashes |
| 02 | **STOCK TRACKING** | 36-name heatmap (AI-TECH / ENERGY / FINANCIALS), filter chips |
| 03 | **MARKET BREADTH** | adv/dec, A/D ratio, composition bar, per-sector breakdown |
| 04 | **SECTOR INTRADAY** | 24-pt normalized lines + summary |
| 05 | **NEWS WIRE** | 24 fixtures, **category filter chips**, unread dots (persisted) |
| 06 | **AAPL · 60 SESSIONS** | candles + volume + MA20, crosshair inspector |
| 07 | **PRECIOUS METALS** | XAU/XAG/XPT/XPD, ratios, spreads, 60D ranges |
| 08 | **MARKET PULSE** | session clock, lunch breaks, 24h bands + NOW marker |
| 09 | **GLOBAL INDEX MAP** | region-grouped index tables |
| 10 | **WORLD MAP** | dot-matrix land (embedded, offline), venue markers with live session state + pulse rings |
| 11 | **CONNECTED COMPANIES** | 36-node supply-web force graph · click a node to isolate its links |
| 12 | **SECTOR DRILL** | sector → sub-industry → members, expandable, divergence bars |
| 13 | **IPO PIPELINE** | 90-day fixture calendar · FILED / EXPECTED / PRICED filters · T-minus countdowns |
| 14 | **CUSTOM LISTS** | multiple watchlists, add/remove symbols (datalist), sparklines, persisted (`tmd.lists.v1`) |
| 15 | **AI COPILOT** | BYOK chat for 20 providers, market-context toggle, quick prompts |
| 16 | **STRATEGY LAB** | build algos & tagging methodologies by hand or via AI · backtest on 750-session simulated history |
| 17 | **POSITIONS** | manual book tracker — qty/avg cost, live P&L, cloud-synced |

## Strategy Lab (panel 16)

Two kinds of models, both driven by a small JSON DSL:

- **ALGO** — entry conditions (ANDed) + exit conditions (ORed), long-only, fills at close, configurable bps/side. Backtest yields 12 metrics (return, buy&hold, excess, max DD, Sharpe, trades, win rate, avg win/loss, profit factor, exposure, cost), an equity-vs-benchmark chart with trade markers and a drawdown strip, plus the trade log.
- **TAGGING** — define a bar signature (e.g. "gold up >1.2% on 2× volume"); the scanner finds every tagged session in 750 days and reports forward-return stats (mean / median / win-rate at T+1, T+5, T+10…) plus the occurrence list.

Conditions combine indicators — close, chg %, SMA, EMA, RSI, z-score, volume ratio — with operators `> ≥ < ≤ crosses-above/below` against a value or another indicator.

- **AI BUILD** — describe the idea in words; the copilot provider from panel 15 drafts a validated JSON spec into the builder.
- **JSON** — raw spec editor with validation for power users.
- **SAVE** — persists locally (`tmd.strategies.v1`) and to Supabase when signed in; runs are logged to `tmd_backtest_runs` in the cloud.
- Histories are deterministic seeded simulations (750 weekday sessions per symbol) — labeled as such; no real historical data is implied.

## Cloud backend (Supabase · project `agnamo`)

Sign in from `⚙ SETUP → ACCOUNT · CLOUD SYNC` (email + password; new accounts confirm via email). Everything also works fully offline in local-only mode.

Synced entities — schema `terminal_schema_v1`, all tables `tmd_*` with row-level security (owner-only read/write):

| Table | Holds |
|---|---|
| `tmd_profiles` | user profile (auto-created on signup) |
| `tmd_ui_presets` | theme + window layout + settings per user |
| `tmd_watchlists` | named custom lists with symbol arrays |
| `tmd_positions` | book positions (qty, avg cost, opened) |
| `tmd_strategies` | strategy specs (algo & tagging DSL) |
| `tmd_backtest_runs` | backtest run history (metrics, equity sample, trades) |

The header LED next to the feed dot shows session state: bright = syncing, dim = local-only. Token refresh is automatic; pulls happen on sign-in, pushes are debounced after local changes.

## Data adapters

- **DEMO (default, offline-safe):** deterministic seeded random-walk engine — 47 instruments. Clearly badged DEMO on every card.
- **LIVE:** header toggle or `L`. Attempts real quotes (stooq CSV, no key). Any failure (offline / CORS / `file://`) falls back silently to demo — `console.warn` at most, never an error. Endpoint override in settings.

## File layout

```
index.html          entry point (boot overlay + header + tape + canvas)
css/fonts.css       @font-face for bundled Familjen Grotesk
css/styles.css      design system + 4 theme blocks + window manager layer
js/boot.js          BIOS sequence + global error trap (loads first)
js/themes.js        4-theme engine: CSS vars + canvas palettes
js/mapdata.js       embedded 180×90 land bitmask + venue coordinates
js/data.js          seeded universe, session engine, demo/live adapters
js/widgets.js       9 core renderers (DOM + canvas)
js/providers.js     20-provider BYOK registry + request builders
js/cloud.js         Supabase REST client: auth, RLS tables, debounced sync
js/newviews.js      world map · connections · sector drill · IPO · watchlists
js/chat.js          AI copilot widget
js/quant.js         indicators, strategy DSL evaluator, backtest engine
js/strategy.js      Strategy Lab: builder, tag scanner, results, AI-generate
js/positions.js     positions/book tracker
js/settings.js      settings overlay + account section
js/app.js           window manager + integration glue
fonts/*.woff2       Familjen Grotesk 400–700 (latin, latin-ext, vietnamese)
README.md           this file
```

No frameworks. No CDN. No network. Works offline forever.

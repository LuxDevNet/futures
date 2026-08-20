/* ==========================================================================
 * datasources.js — preset node registry for the /TERMINAL settings canvas
 * 48 pluggable data-source tiles, grouped by category.
 * Each node: { id, name, cat, base, auth, proto, latency, note }
 *   auth:  none | apikey | oauth | signup
 *   proto: REST | WS | CSV | RSS
 * ======================================================================== */
(function (global) {
  "use strict";

  var CATS = [
    { id: "market",   name: "MARKET DATA",        color: "#2aa198" },
    { id: "macro",    name: "MACRO & RATES",      color: "#268bd2" },
    { id: "fxcmdty",  name: "FX & COMMODITIES",   color: "#b58900" },
    { id: "crypto",   name: "CRYPTO",             color: "#d33682" },
    { id: "news",     name: "NEWS & FILINGS",     color: "#6c71c4" },
    { id: "alt",      name: "ALT DATA",           color: "#859900" },
    { id: "sink",     name: "TERMINAL PANELS",    color: "#cb4b16" }
  ];

  var SOURCES = [
    /* ---------------- MARKET DATA ---------------- */
    { id: "stooq",      name: "Stooq",              cat: "market", base: "https://stooq.com/q/l/",              auth: "none",   proto: "CSV",  latency: "~300ms", note: "free CSV quotes, no key" },
    { id: "yahoo",      name: "Yahoo Finance",      cat: "market", base: "https://query1.finance.yahoo.com",  auth: "none",   proto: "REST", latency: "~250ms", note: "unofficial quote endpoint" },
    { id: "alphavantage", name: "Alpha Vantage",    cat: "market", base: "https://www.alphavantage.co/query", auth: "apikey", proto: "REST", latency: "~400ms", note: "25 req/day free tier" },
    { id: "twelvedata", name: "Twelve Data",        cat: "market", base: "https://api.twelvedata.com",        auth: "apikey", proto: "REST", latency: "~200ms", note: "stocks, FX, crypto, WS" },
    { id: "polygon",    name: "Polygon.io",         cat: "market", base: "https://api.polygon.io",            auth: "apikey", proto: "REST", latency: "~120ms", note: "tick-level US equities" },
    { id: "finnhub",    name: "Finnhub",            cat: "market", base: "https://finnhub.io/api/v1",         auth: "apikey", proto: "REST", latency: "~180ms", note: "quotes + news + earnings" },
    { id: "tiingo",     name: "Tiingo",             cat: "market", base: "https://api.tiingo.com",            auth: "apikey", proto: "REST", latency: "~200ms", note: "EOD + IEX intraday" },
    { id: "marketstack", name: "Marketstack",       cat: "market", base: "https://api.marketstack.com/v1",    auth: "apikey", proto: "REST", latency: "~300ms", note: "global EOD, 70 exchanges" },
    { id: "eodhd",      name: "EODHD",              cat: "market", base: "https://eodhd.com/api",             auth: "apikey", proto: "REST", latency: "~350ms", note: "EOD + fundamentals" },
    { id: "databento",  name: "Databento",          cat: "market", base: "https://hist.databento.com",        auth: "apikey", proto: "REST", latency: "~150ms", note: "institutional hist data" },
    { id: "nasdaqdatalink", name: "Nasdaq Data Link", cat: "market", base: "https://data.nasdaq.com/api/v3",  auth: "apikey", proto: "REST", latency: "~400ms", note: "quandl successor" },
    { id: "fmp",        name: "Financial Modeling Prep", cat: "market", base: "https://financialmodelingprep.com/api/v3", auth: "apikey", proto: "REST", latency: "~250ms", note: "fundamentals + quotes" },
    { id: "tradier",    name: "Tradier",            cat: "market", base: "https://api.tradier.com/v1",        auth: "oauth",  proto: "REST", latency: "~150ms", note: "brokerage-linked quotes" },
    { id: "iexcloud",   name: "IEX Cloud",          cat: "market", base: "https://cloud.iexapis.com/stable",  auth: "apikey", proto: "REST", latency: "~160ms", note: "IEX exchange data" },
    { id: "barchart",   name: "Barchart",           cat: "market", base: "https://marketdata.websol.barchart.com", auth: "apikey", proto: "REST", latency: "~200ms", note: "futures & options" },
    { id: "intrinio",   name: "Intrinio",           cat: "market", base: "https://api-v2.intrinio.com",       auth: "apikey", proto: "REST", latency: "~220ms", note: "fundamentals, SEC data" },

    /* ---------------- MACRO & RATES ---------------- */
    { id: "fred",       name: "FRED",               cat: "macro", base: "https://api.stlouisfed.org/fred",    auth: "apikey", proto: "REST", latency: "~400ms", note: "St. Louis Fed, 800k series" },
    { id: "ecb",        name: "ECB Data Portal",    cat: "macro", base: "https://data-api.ecb.europa.eu",     auth: "none",   proto: "REST", latency: "~500ms", note: "SDMX, euro area stats" },
    { id: "worldbank",  name: "World Bank",         cat: "macro", base: "https://api.worldbank.org/v2",       auth: "none",   proto: "REST", latency: "~500ms", note: "29k+ development indicators" },
    { id: "imf",        name: "IMF Data",           cat: "macro", base: "https://www.imf.org/external/datamapper/api", auth: "none", proto: "REST", latency: "~600ms", note: "WEO forecasts, IFS" },
    { id: "oecd",       name: "OECD Data",          cat: "macro", base: "https://sdmx.oecd.org/public/rest",  auth: "none",   proto: "REST", latency: "~600ms", note: "SDMX, member stats" },
    { id: "bis",        name: "BIS Statistics",     cat: "macro", base: "https://stats.bis.org/api/v1",       auth: "none",   proto: "REST", latency: "~700ms", note: "credit, property, FX" },
    { id: "treasury",   name: "US Treasury FiscalData", cat: "macro", base: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service", auth: "none", proto: "REST", latency: "~400ms", note: "debt, yields, daily statement" },
    { id: "eurostat",   name: "Eurostat",           cat: "macro", base: "https://ec.europa.eu/eurostat/api/dissemination", auth: "none", proto: "REST", latency: "~600ms", note: "EU statistics" },
    { id: "bls",        name: "US BLS",             cat: "macro", base: "https://api.bls.gov/publicAPI/v2",   auth: "apikey", proto: "REST", latency: "~500ms", note: "CPI, payrolls, JOLTS" },

    /* ---------------- FX & COMMODITIES ---------------- */
    { id: "exhost",     name: "exchangerate.host",  cat: "fxcmdty", base: "https://api.exchangerate.host",    auth: "apikey", proto: "REST", latency: "~250ms", note: "168 currencies" },
    { id: "oxr",        name: "Open Exchange Rates", cat: "fxcmdty", base: "https://openexchangerates.org/api", auth: "apikey", proto: "REST", latency: "~300ms", note: "hourly FX snapshots" },
    { id: "currencylayer", name: "Currencylayer",   cat: "fxcmdty", base: "https://api.currencylayer.com",    auth: "apikey", proto: "REST", latency: "~300ms", note: "FX + conversion" },
    { id: "frankfurter", name: "Frankfurter",       cat: "fxcmdty", base: "https://api.frankfurter.app",      auth: "none",   proto: "REST", latency: "~200ms", note: "ECB reference rates, no key" },
    { id: "metalsdev",  name: "Metals.dev",         cat: "fxcmdty", base: "https://api.metals.dev/v1",        auth: "apikey", proto: "REST", latency: "~300ms", note: "spot precious metals" },
    { id: "nager",      name: "Nager.Date",         cat: "fxcmdty", base: "https://date.nager.at/api/v3",     auth: "none",   proto: "REST", latency: "~200ms", note: "public-holiday calendar for venues" },

    /* ---------------- CRYPTO ---------------- */
    { id: "coingecko",  name: "CoinGecko",          cat: "crypto", base: "https://api.coingecko.com/api/v3",  auth: "none",   proto: "REST", latency: "~350ms", note: "prices, mcap, trending" },
    { id: "coinmarketcap", name: "CoinMarketCap",   cat: "crypto", base: "https://pro-api.coinmarketcap.com", auth: "apikey", proto: "REST", latency: "~300ms", note: "aggregated crypto quotes" },
    { id: "binance",    name: "Binance",            cat: "crypto", base: "https://api.binance.com/api/v3",    auth: "none",   proto: "WS",   latency: "~50ms",  note: "public tickers + streams" },
    { id: "kraken",     name: "Kraken",             cat: "crypto", base: "https://api.kraken.com/0/public",   auth: "none",   proto: "REST", latency: "~200ms", note: "spot pairs, OHLC" },
    { id: "coinbase",   name: "Coinbase Exchange",  cat: "crypto", base: "https://api.exchange.coinbase.com", auth: "none",   proto: "REST", latency: "~150ms", note: "public products + ticker" },
    { id: "bitstamp",   name: "Bitstamp",           cat: "crypto", base: "https://www.bitstamp.net/api/v2",   auth: "none",   proto: "REST", latency: "~250ms", note: "BTC/EU venue prices" },
    { id: "mempool",    name: "mempool.space",      cat: "crypto", base: "https://mempool.space/api",         auth: "none",   proto: "REST", latency: "~300ms", note: "BTC fees, blocks, hashrate" },

    /* ---------------- NEWS & FILINGS ---------------- */
    { id: "edgar",      name: "SEC EDGAR",          cat: "news", base: "https://data.sec.gov/submissions",    auth: "none",   proto: "REST", latency: "~400ms", note: "filings, XBRL facts (set UA header)" },
    { id: "newsapi",    name: "NewsAPI",            cat: "news", base: "https://newsapi.org/v2",              auth: "apikey", proto: "REST", latency: "~400ms", note: "80k sources, headlines" },
    { id: "gnews",      name: "GNews",              cat: "news", base: "https://gnews.io/api/v4",             auth: "apikey", proto: "REST", latency: "~400ms", note: "multilingual news search" },
    { id: "gdelt",      name: "GDELT Project",      cat: "news", base: "https://api.gdeltproject.org/api/v2", auth: "none",   proto: "REST", latency: "~800ms", note: "global events + tone" },
    { id: "hn",         name: "Hacker News Algolia", cat: "news", base: "https://hn.algolia.com/api/v1",      auth: "none",   proto: "REST", latency: "~250ms", note: "tech news sentiment proxy" },
    { id: "rsswire",    name: "Generic RSS Wire",   cat: "news", base: "https://",                            auth: "none",   proto: "RSS",  latency: "varies", note: "point at any feed URL" },
    { id: "mastodon",   name: "Mastodon Public TL", cat: "news", base: "https://mastodon.social/api/v1/timelines/public", auth: "none", proto: "REST", latency: "~300ms", note: "social flow for sentiment" },

    /* ---------------- ALT DATA ---------------- */
    { id: "openmeteo",  name: "Open-Meteo",         cat: "alt", base: "https://api.open-meteo.com/v1",        auth: "none",   proto: "REST", latency: "~250ms", note: "weather — ags/energy demand" },
    { id: "noaa",       name: "NOAA Climate",       cat: "alt", base: "https://www.ncei.noaa.gov/cdo-web/api/v2", auth: "apikey", proto: "REST", latency: "~600ms", note: "climate datasets" },
    { id: "uncomtrade", name: "UN Comtrade",        cat: "alt", base: "https://comtradeapi.un.org/public/v1", auth: "apikey", proto: "REST", latency: "~700ms", note: "trade flows" },
    { id: "census",     name: "US Census",          cat: "alt", base: "https://api.census.gov/data",          auth: "apikey", proto: "REST", latency: "~500ms", note: "demographics, econ surveys" },
    { id: "wikipedia",  name: "Wikipedia Pageviews", cat: "alt", base: "https://wikimedia.org/api/rest_v1/metrics/pageviews", auth: "none", proto: "REST", latency: "~300ms", note: "attention proxy for tickers" },
    { id: "github",     name: "GitHub Events",      cat: "alt", base: "https://api.github.com/events",        auth: "none",   proto: "REST", latency: "~250ms", note: "dev activity on public repos" },
    { id: "opensky",    name: "OpenSky Network",    cat: "alt", base: "https://opensky-network.org/api",      auth: "signup", proto: "REST", latency: "~600ms", note: "live flight states" }
  ];

  /* ---------------- terminal panels that consume sources ---------------- */
  var SINKS = [
    { id: "sink-tape",     name: "TAPE",          cat: "sink", note: "top ticker strip — indices, metals, FX" },
    { id: "sink-ticker",   name: "GLOBAL TICKER", cat: "sink", note: "panel 01 — dense quote table" },
    { id: "sink-heatmap",  name: "HEATMAP",       cat: "sink", note: "panel 02 — stock tracking tiles" },
    { id: "sink-breadth",  name: "BREADTH",       cat: "sink", note: "panel 03 — advance/decline" },
    { id: "sink-news",     name: "NEWS WIRE",     cat: "sink", note: "panel 05 — headline stream" },
    { id: "sink-metals",   name: "METALS",        cat: "sink", note: "panel 07 — precious metals monitor" },
    { id: "sink-strategy", name: "STRATEGY LAB",  cat: "sink", note: "panel 16 — backtest engine" },
    { id: "sink-copilot",  name: "AI COPILOT",    cat: "sink", note: "panel 15 — context for LLM chat" }
  ];

  var DataSources = {
    cats: CATS,
    sources: SOURCES,
    sinks: SINKS,
    get: function (id) {
      return SOURCES.find(function (s) { return s.id === id; }) ||
             SINKS.find(function (s) { return s.id === id; }) || null;
    },
    catName: function (id) {
      var c = CATS.find(function (c2) { return c2.id === id; });
      return c ? c.name : id;
    },
    catColor: function (id) {
      var c = CATS.find(function (c2) { return c2.id === id; });
      return c ? c.color : "#839496";
    }
  };

  global.DataSources = DataSources;
})(window);

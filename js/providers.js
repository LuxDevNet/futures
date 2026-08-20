/* ==========================================================================
 * providers.js — BYOK registry for 20 LLM providers
 * Keys stay in the browser (localStorage "tmd.aikeys.v1") — never sent anywhere
 * except the chosen provider's own API endpoint.
 * Styles: openai · anthropic · gemini · cohere · azure · ollama · cf
 * ======================================================================== */
(function (global) {
  "use strict";

  var PROVIDERS = [
    { id: "openai",     name: "OpenAI",            style: "openai",
      base: "https://api.openai.com/v1",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o4-mini"],
      keyUrl: "https://platform.openai.com/api-keys" },
    { id: "anthropic",  name: "Anthropic",         style: "anthropic",
      base: "https://api.anthropic.com/v1",
      models: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-1"],
      keyUrl: "https://console.anthropic.com/settings/keys" },
    { id: "gemini",     name: "Google Gemini",     style: "gemini",
      base: "https://generativelanguage.googleapis.com/v1beta",
      models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
      keyUrl: "https://aistudio.google.com/apikey" },
    { id: "deepseek",   name: "DeepSeek",          style: "openai",
      base: "https://api.deepseek.com/v1",
      models: ["deepseek-chat", "deepseek-reasoner"],
      keyUrl: "https://platform.deepseek.com/api_keys" },
    { id: "kimi",       name: "Moonshot · Kimi",   style: "openai",
      base: "https://api.moonshot.ai/v1",
      models: ["kimi-k2-0711-preview", "moonshot-v1-128k", "moonshot-v1-32k"],
      keyUrl: "https://platform.moonshot.ai/console/api-keys" },
    { id: "venice",     name: "Venice AI",         style: "openai",
      base: "https://api.venice.ai/api/v1",
      models: ["venice-uncensored", "llama-3.3-70b", "dolphin-3.0-mistral-24b", "qwen3-235b"],
      keyUrl: "https://venice.ai/settings/api" },
    { id: "huggingface", name: "Hugging Face",     style: "openai",
      base: "https://router.huggingface.co/v1",
      models: ["meta-llama/Meta-Llama-3.1-8B-Instruct", "Qwen/Qwen2.5-72B-Instruct",
               "mistralai/Mistral-7B-Instruct-v0.3", "deepseek-ai/DeepSeek-V3.1"],
      keyUrl: "https://huggingface.co/settings/tokens" },
    { id: "xai",        name: "xAI · Grok",        style: "openai",
      base: "https://api.x.ai/v1",
      models: ["grok-4", "grok-3", "grok-3-mini"],
      keyUrl: "https://console.x.ai" },
    { id: "mistral",    name: "Mistral AI",        style: "openai",
      base: "https://api.mistral.ai/v1",
      models: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "codestral-latest"],
      keyUrl: "https://console.mistral.ai/api-keys" },
    { id: "groq",       name: "Groq",              style: "openai",
      base: "https://api.groq.com/openai/v1",
      models: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "qwen/qwen3-32b", "meta-llama/llama-4-scout-17b-16e-instruct"],
      keyUrl: "https://console.groq.com/keys" },
    { id: "together",   name: "Together AI",       style: "openai",
      base: "https://api.together.xyz/v1",
      models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo",
               "deepseek-ai/DeepSeek-R1", "mistralai/Mixtral-8x22B-Instruct-v0.1"],
      keyUrl: "https://api.together.ai/settings/api-keys" },
    { id: "fireworks",  name: "Fireworks AI",      style: "openai",
      base: "https://api.fireworks.ai/inference/v1",
      models: ["accounts/fireworks/models/llama-v3p3-70b-instruct",
               "accounts/fireworks/models/deepseek-v3p1",
               "accounts/fireworks/models/qwen3-235b-a22b"],
      keyUrl: "https://fireworks.ai/account/api-keys" },
    { id: "openrouter", name: "OpenRouter",        style: "openai",
      base: "https://openrouter.ai/api/v1",
      models: ["openai/gpt-4o", "anthropic/claude-sonnet-4.5", "google/gemini-2.5-pro",
               "deepseek/deepseek-chat-v3.1", "x-ai/grok-4"],
      keyUrl: "https://openrouter.ai/keys" },
    { id: "perplexity", name: "Perplexity",        style: "openai",
      base: "https://api.perplexity.ai",
      models: ["sonar-pro", "sonar", "sonar-reasoning-pro"],
      keyUrl: "https://www.perplexity.ai/settings/api" },
    { id: "cohere",     name: "Cohere",            style: "cohere",
      base: "https://api.cohere.com/v2",
      models: ["command-a-03-2025", "command-r-plus-08-2024", "command-r-08-2024"],
      keyUrl: "https://dashboard.cohere.com/api-keys" },
    { id: "cerebras",   name: "Cerebras",          style: "openai",
      base: "https://api.cerebras.ai/v1",
      models: ["llama-3.3-70b", "gpt-oss-120b", "qwen-3-235b-a22b-instruct-2507"],
      keyUrl: "https://cloud.cerebras.ai" },
    { id: "azure",      name: "Azure OpenAI",      style: "azure",
      base: "https://YOUR-RESOURCE.openai.azure.com",
      models: ["gpt-4o", "gpt-4o-mini", "o4-mini"],
      keyUrl: "https://portal.azure.com",
      note: "set base to your resource endpoint · model = deployment name" },
    { id: "ollama",     name: "Ollama (local)",    style: "ollama",
      base: "http://localhost:11434",
      models: ["llama3.3", "qwen3", "mistral", "deepseek-r1"],
      keyUrl: "https://ollama.com",
      note: "no key needed — runs on your machine" },
    { id: "cloudflare", name: "Cloudflare Workers AI", style: "cf",
      base: "https://api.cloudflare.com/client/v4/accounts/YOUR-ACCOUNT-ID/ai/run",
      models: ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/qwen/qwen2.5-coder-32b-instruct",
               "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b"],
      keyUrl: "https://dash.cloudflare.com/profile/api-tokens",
      note: "set base with your account id" },
    { id: "novita",     name: "Novita AI",         style: "openai",
      base: "https://api.novita.ai/openai",
      models: ["meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-v3.1",
               "qwen/qwen3-235b-a22b-fp8"],
      keyUrl: "https://novita.ai/settings/key-management" }
  ];

  /* ---------- key storage ---------------------------------------------------- */
  var KEYS_KEY = "tmd.aikeys.v1";
  function loadKeys() {
    try { return JSON.parse(localStorage.getItem(KEYS_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function setKey(id, key) {
    var all = loadKeys();
    if (key) { all[id] = key; } else { delete all[id]; }
    try { localStorage.setItem(KEYS_KEY, JSON.stringify(all)); } catch (e) { /* noop */ }
  }
  function getKey(id) { return loadKeys()[id] || ""; }

  function get(id) {
    for (var i = 0; i < PROVIDERS.length; i++) {
      if (PROVIDERS[i].id === id) { return PROVIDERS[i]; }
    }
    return PROVIDERS[0];
  }

  /* ---------- request builders ------------------------------------------------ */
  function buildRequest(p, model, key, base, messages) {
    base = (base || p.base).replace(/\/+$/, "");
    if (p.style === "anthropic") {
      var sys = "";
      var msgs = messages.filter(function (m) {
        if (m.role === "system") { sys = m.content; return false; }
        return true;
      });
      return {
        url: base + "/messages",
        opts: {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
          },
          body: JSON.stringify({ model: model, max_tokens: 1024, system: sys || undefined, messages: msgs })
        },
        extract: function (j) {
          return j && j.content && j.content[0] && j.content[0].text ? j.content[0].text : "";
        }
      };
    }
    if (p.style === "gemini") {
      var gsys = "";
      var parts = messages.filter(function (m) {
        if (m.role === "system") { gsys = m.content; return false; }
        return true;
      }).map(function (m) {
        return { role: m.role === "assistant" ? "model" : "user",
                 parts: [{ text: m.content }] };
      });
      return {
        url: base + "/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key),
        opts: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: parts,
            systemInstruction: gsys ? { parts: [{ text: gsys }] } : undefined
          })
        },
        extract: function (j) {
          try { return j.candidates[0].content.parts[0].text; } catch (e) { return ""; }
        }
      };
    }
    if (p.style === "cohere") {
      return {
        url: base + "/chat",
        opts: {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": "Bearer " + key },
          body: JSON.stringify({ model: model, messages: messages })
        },
        extract: function (j) {
          try { return j.message.content[0].text; } catch (e) { return ""; }
        }
      };
    }
    if (p.style === "azure") {
      return {
        url: base + "/openai/deployments/" + encodeURIComponent(model) +
             "/chat/completions?api-version=2024-10-21",
        opts: {
          method: "POST",
          headers: { "content-type": "application/json", "api-key": key },
          body: JSON.stringify({ messages: messages, max_tokens: 1024 })
        },
        extract: function (j) {
          try { return j.choices[0].message.content; } catch (e) { return ""; }
        }
      };
    }
    if (p.style === "ollama") {
      return {
        url: base + "/api/chat",
        opts: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: model, messages: messages, stream: false })
        },
        extract: function (j) {
          return j && j.message && j.message.content ? j.message.content : "";
        }
      };
    }
    if (p.style === "cf") {
      var cfMsgs = messages.map(function (m) { return { role: m.role, content: m.content }; });
      return {
        url: base + "/" + model,
        opts: {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": "Bearer " + key },
          body: JSON.stringify({ messages: cfMsgs, max_tokens: 1024 })
        },
        extract: function (j) {
          try { return j.result.response; } catch (e) { return ""; }
        }
      };
    }
    /* default: openai-compatible */
    return {
      url: base + "/chat/completions",
      opts: {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": "Bearer " + key },
        body: JSON.stringify({ model: model, messages: messages, max_tokens: 1024 })
      },
      extract: function (j) {
        try { return j.choices[0].message.content; } catch (e) { return ""; }
      }
    };
  }

  function send(p, model, key, base, messages) {
    var req = buildRequest(p, model, key, base, messages);
    return fetch(req.url, req.opts).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          var msg = "HTTP " + r.status;
          try {
            var j = JSON.parse(t);
            msg = (j.error && (j.error.message || j.error.type)) || j.message || msg;
          } catch (e) { /* keep status */ }
          if (r.status === 401 || r.status === 403) { msg = "key rejected — " + msg; }
          else if (r.status === 429) { msg = "rate limited — try again shortly"; }
          else if (r.status === 404) { msg = "endpoint/model not found — check base URL and model name"; }
          throw new Error(msg);
        });
      }
      return r.json().then(function (j) {
        var out = req.extract(j);
        if (!out) { throw new Error("empty response from provider"); }
        return out;
      });
    }, function () {
      throw new Error(
        "request blocked — the browser could not reach " + p.name +
        ". likely CORS or offline; if local, check that the server is running.");
    });
  }

  global.Providers = { list: PROVIDERS, get: get, setKey: setKey, getKey: getKey, send: send };
})(window);
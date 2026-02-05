// api/gnews.js
export default {
  async fetch(request) {
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "s-maxage=300, stale-while-revalidate=3600",
    };

    try {
      const url = new URL(request.url);

      // Accept both ?q= and also allow clients to pass url-encoded queries
      let q = (url.searchParams.get("q") || "").trim();

      // Enforce GNews q length limit (max 200 chars) to avoid unpredictable truncation
      // Docs: q max 200 characters [1](https://docs.gnews.io/endpoints/search-endpoint)
      let truncated = false;
      if (q.length > 200) {
        q = q.slice(0, 200);
        truncated = true;
      }

      const lang = (url.searchParams.get("lang") || "en").trim();
      const country = (url.searchParams.get("country") || "").trim(); // optional
      const max = Math.min(parseInt(url.searchParams.get("max") || "10", 10) || 10, 100);

      // Deterministic defaults per docs: sortby=publishedAt, and allow from/to
      // Docs: sortby, from, to supported [1](https://docs.gnews.io/endpoints/search-endpoint)
      const sortby = (url.searchParams.get("sortby") || "publishedAt").trim();
      const from = (url.searchParams.get("from") || "").trim();
      const to = (url.searchParams.get("to") || "").trim();

      // Search fields: title+description tends to reduce noise vs full content
      const inFields = (url.searchParams.get("in") || "title,description").trim();

      const apiKey =
        process.env.GNEWS_API_KEY ||
        process.env.GNEWS_APIKEY ||
        process.env.GNEWS_TOKEN ||
        process.env.API_KEY ||
        "";

      if (!apiKey) {
        return new Response(
          JSON.stringify({ articles: [], error: "Missing GNews API key in env (GNEWS_API_KEY)." }),
          { status: 200, headers }
        );
      }

      if (!q) {
        return new Response(JSON.stringify({ articles: [], meta: { ok: true, emptyQuery: true } }), {
          status: 200,
          headers,
        });
      }

      // In-memory cache (best-effort; resets on cold starts)
      const cacheKeyObj = { q, lang, country, max, sortby, from, to, in: inFields };
      const cacheKey = JSON.stringify(cacheKeyObj);
      globalThis.__AIHM_GNEWS_CACHE = globalThis.__AIHM_GNEWS_CACHE || new Map();
      const cache = globalThis.__AIHM_GNEWS_CACHE;

      const now = Date.now();
      const ttlMs = 5 * 60 * 1000; // 5 min
      const hit = cache.get(cacheKey);
      if (hit && now - hit.t < ttlMs) {
        return new Response(
          JSON.stringify({
            articles: hit.v,
            meta: { ok: true, cached: true, truncated, ...cacheKeyObj },
          }),
          { status: 200, headers }
        );
      }

      const upstream = new URL("https://gnews.io/api/v4/search");
      upstream.searchParams.set("q", q);
      upstream.searchParams.set("lang", lang);
      upstream.searchParams.set("max", String(max));
      upstream.searchParams.set("sortby", sortby);
      upstream.searchParams.set("in", inFields);
      if (country) upstream.searchParams.set("country", country);
      if (from) upstream.searchParams.set("from", from);
      if (to) upstream.searchParams.set("to", to);
      upstream.searchParams.set("apikey", apiKey);

      const resp = await fetch(upstream.toString(), { method: "GET" });
      const data = await resp.json().catch(() => ({}));
      const articles = Array.isArray(data?.articles) ? data.articles : [];

      // Always sort locally by publishedAt descending for extra determinism
      const sorted = [...articles].sort((a, b) => {
        const da = Date.parse(a?.publishedAt || "") || 0;
        const db = Date.parse(b?.publishedAt || "") || 0;
        return db - da;
      });

      cache.set(cacheKey, { t: now, v: sorted });

      return new Response(
        JSON.stringify({
          articles: sorted,
          meta: { ok: true, cached: false, truncated, ...cacheKeyObj },
        }),
        { status: 200, headers }
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ articles: [], error: String(e?.message || e) }),
        { status: 200, headers }
      );
    }
  },
};

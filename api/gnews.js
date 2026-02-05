export default {
  async fetch(request) {
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "s-maxage=300, stale-while-revalidate=3600",
    };

    try {
      const url = new URL(request.url);

      let q = (url.searchParams.get("q") || "").trim();

      // GNews q max 200 chars [1](https://docs.gnews.io/endpoints/search-endpoint)
      let truncated = false;
      if (q.length > 200) {
        q = q.slice(0, 200);
        truncated = true;
      }

      const lang = (url.searchParams.get("lang") || "en").trim();
      const country = (url.searchParams.get("country") || "").trim();
      const max = Math.min(parseInt(url.searchParams.get("max") || "10", 10) || 10, 100);

      // Supported by GNews [1](https://docs.gnews.io/endpoints/search-endpoint)
      const sortby = (url.searchParams.get("sortby") || "publishedAt").trim();
      const from = (url.searchParams.get("from") || "").trim();
      const to = (url.searchParams.get("to") || "").trim();
      const inFields = (url.searchParams.get("in") || "title,description").trim();

      const apiKey =
        process.env.GNEWS_API_KEY ||
        process.env.GNEWS_APIKEY ||
        process.env.GNEWS_TOKEN ||
        process.env.API_KEY ||
        "";

      if (!apiKey) {
        return new Response(
          JSON.stringify({ articles: [], meta: { ok: false, error: "Missing GNEWS_API_KEY env var." } }),
          { status: 200, headers }
        );
      }

      if (!q) {
        return new Response(JSON.stringify({ articles: [], meta: { ok: true, emptyQuery: true } }), { status: 200, headers });
      }

      // simple cache to reduce upstream calls
      globalThis.__AIHM_GNEWS_CACHE = globalThis.__AIHM_GNEWS_CACHE || new Map();
      const cache = globalThis.__AIHM_GNEWS_CACHE;
      const cacheKey = JSON.stringify({ q, lang, country, max, sortby, from, to, inFields });
      const now = Date.now();
      const ttl = 5 * 60 * 1000;

      const hit = cache.get(cacheKey);
      if (hit && now - hit.t < ttl) {
        return new Response(JSON.stringify({ articles: hit.v, meta: { ok: true, cached: true, truncated } }), {
          status: 200,
          headers,
        });
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

      const resp = await fetch(upstream.toString());
      const text = await resp.text();
      let data = {};
      try { data = JSON.parse(text); } catch { data = {}; }

      const articles = Array.isArray(data?.articles) ? data.articles : [];
      articles.sort((a, b) => (Date.parse(b?.publishedAt || "") || 0) - (Date.parse(a?.publishedAt || "") || 0));

      cache.set(cacheKey, { t: now, v: articles });

      // Always return 200 so frontend never throws
      return new Response(
        JSON.stringify({
          articles,
          meta: {
            ok: resp.ok,
            upstreamStatus: resp.status,
            truncated,
            sent: { q, lang, country, max, sortby, from, to, in: inFields },
            upstreamError: resp.ok ? null : (data?.errors || data?.message || text || "Upstream error"),
          },
        }),
        { status: 200, headers }
      );
    } catch (e) {
      return new Response(JSON.stringify({ articles: [], meta: { ok: false, error: String(e?.message || e) } }), {
        status: 200,
        headers,
      });
    }
  },
};

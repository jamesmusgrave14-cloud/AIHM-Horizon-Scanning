import Parser from "rss-parser";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "AIHM-Horizon-Scanning/1.0" },
});

function normDate(d) {
  const t = Date.parse(d || "");
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}

export default {
  async fetch(request) {
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "s-maxage=300, stale-while-revalidate=3600",
    };

    try {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);

      // multiple feeds: /api/rss?url=FEED1&url=FEED2
      const urls = url.searchParams.getAll("url").map((s) => s.trim()).filter(Boolean);

      if (!urls.length) {
        return new Response(JSON.stringify({ articles: [], meta: { ok: true, empty: true } }), { status: 200, headers });
      }

      // in-memory cache (best-effort)
      globalThis.__AIHM_RSS_CACHE = globalThis.__AIHM_RSS_CACHE || new Map();
      const cache = globalThis.__AIHM_RSS_CACHE;
      const ttlMs = 10 * 60 * 1000;
      const now = Date.now();

      const all = [];

      for (const feedUrl of urls) {
        const cacheKey = `${feedUrl}::${limit}`;
        const hit = cache.get(cacheKey);
        if (hit && now - hit.t < ttlMs) {
          all.push(...hit.v);
          continue;
        }

        const resp = await fetch(feedUrl);
        const text = await resp.text();
        const feed = await parser.parseString(text);

        const items = (feed.items || []).slice(0, limit).map((it) => ({
          title: it.title || "",
          description: it.contentSnippet || it.summary || "",
          url: it.link || "",
          publishedAt: normDate(it.isoDate || it.pubDate),
          source: feed.title || feedUrl,
        })).filter((x) => x.url);

        cache.set(cacheKey, { t: now, v: items });
        all.push(...items);
      }

      // merge + sort newest first
      const seen = new Set();
      const merged = [];
      all.sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
        .forEach((a) => {
          if (seen.has(a.url)) return;
          seen.add(a.url);
          merged.push(a);
        });

      return new Response(JSON.stringify({ articles: merged.slice(0, limit), meta: { ok: true, feeds: urls.length } }), {
        status: 200,
        headers,
      });
    } catch (e) {
      return new Response(JSON.stringify({ articles: [], meta: { ok: false, error: String(e?.message || e) } }), {
        status: 200,
        headers,
      });
    }
  },
};

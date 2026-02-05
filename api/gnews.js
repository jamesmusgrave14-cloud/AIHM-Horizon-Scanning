export default {
  async fetch(request) {
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "s-maxage=300, stale-while-revalidate=3600",
    };

    try {
      const url = new URL(request.url);

      let q = (url.searchParams.get("q") || "").trim();

      // GNews q max 200 chars [1](https://teams.microsoft.com/l/meeting/details?eventId=AAMkADM4ZGMwMDg2LWU0NWEtNDdjMC05MDk5LWJkZmZmZTk4ZDg0NQBGAAAAAADr0mxgvUsEQJU_BcPijvuRBwAOCjAcLxu5TqoZ70bQ0CWjAAAAAAENAAAOCjAcLxu5TqoZ70bQ0CWjAACUuaEaAAA%3d)
      let truncated = false;
      if (q.length > 200) {
        q = q.slice(0, 200);
        truncated = true;
      }

      const lang = (url.searchParams.get("lang") || "en").trim();
      const country = (url.searchParams.get("country") || "").trim();
      const max = Math.min(parseInt(url.searchParams.get("max") || "10", 10) || 10, 100);

      // Deterministic + time bound controls supported by GNews [1](https://teams.microsoft.com/l/meeting/details?eventId=AAMkADM4ZGMwMDg2LWU0NWEtNDdjMC05MDk5LWJkZmZmZTk4ZDg0NQBGAAAAAADr0mxgvUsEQJU_BcPijvuRBwAOCjAcLxu5TqoZ70bQ0CWjAAAAAAENAAAOCjAcLxu5TqoZ70bQ0CWjAACUuaEaAAA%3d)
      const sortby = (url.searchParams.get("sortby") || "publishedAt").trim(); // publishedAt | relevance
      const from = (url.searchParams.get("from") || "").trim(); // ISO8601
      const to = (url.searchParams.get("to") || "").trim();     // ISO8601

      // Prefer searching title/description to reduce noise (supported by GNews as "in") [1](https://teams.microsoft.com/l/meeting/details?eventId=AAMkADM4ZGMwMDg2LWU0NWEtNDdjMC05MDk5LWJkZmZmZTk4ZDg0NQBGAAAAAADr0mxgvUsEQJU_BcPijvuRBwAOCjAcLxu5TqoZ70bQ0CWjAAAAAAENAAAOCjAcLxu5TqoZ70bQ0CWjAACUuaEaAAA%3d)
      const inFields = (url.searchParams.get("in") || "title,description").trim();

      const apiKey =
        process.env.GNEWS_API_KEY ||
        process.env.GNEWS_APIKEY ||
        process.env.GNEWS_TOKEN ||
        process.env.API_KEY ||
        "";

      if (!apiKey) {
        return new Response(
          JSON.stringify({
            articles: [],
            error: "Missing GNews API key (set GNEWS_API_KEY in Vercel env).",
          }),
          { status: 200, headers }
        );
      }

      if (!q) {
        return new Response(JSON.stringify({ articles: [], meta: { ok: true, emptyQuery: true } }), {
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
      const data = await resp.json().catch(() => ({}));
      const articles = Array.isArray(data?.articles) ? data.articles : [];

      // Always sort newest first for stability
      articles.sort((a, b) => {
        const da = Date.parse(a?.publishedAt || "") || 0;
        const db = Date.parse(b?.publishedAt || "") || 0;
        return db - da;
      });

      return new Response(
        JSON.stringify({
          articles,
          meta: {
            ok: true,
            truncated,
            sent: { q, lang, country, max, sortby, from, to, in: inFields },
            upstreamStatus: resp.status,
          },
        }),
        { status: 200, headers }
      );
    } catch (e) {
      return new Response(JSON.stringify({ articles: [], error: String(e?.message || e) }), { status: 200, headers });
    }
  },
};

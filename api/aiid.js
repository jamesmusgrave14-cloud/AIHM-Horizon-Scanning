export default {
  async fetch(request) {
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "s-maxage=3600, stale-while-revalidate=86400",
    };

    try {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 100);

      // Read the cached file from the static public path (no filesystem, no heavy work)
      // This should NOT invoke the function; it should be served as a static asset.
      const cacheUrl = new URL("/aiid-latest.json", url.origin);

      const resp = await fetch(cacheUrl.toString(), { method: "GET" });

      if (!resp.ok) {
        return new Response(
          JSON.stringify({
            articles: [],
            meta: {
              ok: false,
              reason: "cache_file_missing_or_not_deployed",
              status: resp.status,
              cacheUrl: cacheUrl.toString(),
            },
          }),
          { status: 200, headers }
        );
      }

      let data;
      try {
        data = await resp.json();
      } catch (e) {
        return new Response(
          JSON.stringify({
            articles: [],
            meta: {
              ok: false,
              reason: "cache_file_not_valid_json",
              cacheUrl: cacheUrl.toString(),
              error: String(e?.message || e),
            },
          }),
          { status: 200, headers }
        );
      }

      const articles = Array.isArray(data?.articles) ? data.articles : [];

      return new Response(
        JSON.stringify({
          articles: articles.slice(0, limit),
          meta: {
            ok: true,
            cacheUrl: cacheUrl.toString(),
            totalCached: articles.length,
            generatedAt: data?.meta?.generatedAt || null,
          },
        }),
        { status: 200, headers }
      );
    } catch (e) {
      // Absolute fail-safe: never crash, always return JSON
      return new Response(
        JSON.stringify({
          articles: [],
          meta: {
            ok: false,
            reason: "aiid_function_exception",
            error: String(e?.message || e),
          },
        }),
        { status: 200, headers }
      );
    }
  },
};

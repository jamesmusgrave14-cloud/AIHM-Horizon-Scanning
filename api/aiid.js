// api/aiid.js
// Vercel Serverless Function: returns AIID updates with titles + dates + links.
// No API key required.

export default async function handler(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit || "12", 10), 25);

    // 1) Pull an index page that lists incidents (public AIID summary)
    // Source: AIID incident summary/list view exists publicly. [2](https://incidentdatabase.ai/entities/tencent/)
    const indexUrl = "https://incidentdatabase.ai/summaries/incidents/";

    const indexResp = await fetch(indexUrl, {
      headers: { "User-Agent": "aihm-hs/1.0 (demo)" },
    });

    if (!indexResp.ok) {
      const text = await indexResp.text().catch(() => "");
      return res.status(indexResp.status).json({
        error: "AIID index fetch failed",
        detail: text,
      });
    }

    const indexHtml = await indexResp.text();

    // 2) Extract incident IDs from /cite/<id> links
    const ids = [];
    const re = /\/cite\/(\d{1,6})/g;
    let m;
    while ((m = re.exec(indexHtml)) !== null) {
      const id = m[1];
      if (!ids.includes(id)) ids.push(id);
      if (ids.length >= limit) break;
    }

    // If we can’t find any IDs, return empty cleanly
    if (ids.length === 0) {
      res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
      return res.status(200).json({ articles: [] });
    }

    // 3) Fetch each cite page and parse title + incident date.
    // Cite pages show incident title and incident date. [1](https://answers.netlify.com/t/can-not-access-graphql-functions-endpoint/28897)
    async function fetchCite(id) {
      const citeUrl = `https://incidentdatabase.ai/cite/${id}`;

      const r = await fetch(citeUrl, {
        headers: { "User-Agent": "aihm-hs/1.0 (demo)" },
      });

      if (!r.ok) {
        return {
          id,
          title: `AIID incident ${id}`,
          url: citeUrl,
          publishedAt: null,
          source: "AI Incident Database",
          description: "Unable to fetch incident page.",
        };
      }

      const html = await r.text();

      // Title: try <title> tag first
      let title = null;
      const titleMatch = html.match(/<title>\s*([^<]+)\s*<\/title>/i);
      if (titleMatch?.[1]) {
        title = titleMatch[1].trim();
        // Often the <title> contains “Incident 1069: …”
        // Keep it as-is for clarity.
      }

      // Incident date: look for "Incident Date" followed by YYYY-MM-DD
      let date = null;
      const dateMatch = html.match(/Incident Date\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
      if (dateMatch?.[1]) date = dateMatch[1];

      // Fallback: any ISO date in proximity can still be useful
      if (!date) {
        const iso = html.match(/([0-9]{4}-[0-9]{2}-[0-9]{2})/);
        if (iso?.[1]) date = iso[1];
      }

      // Clean title if missing
      if (!title) title = `AIID incident ${id}`;

      return {
        id,
        title,
        url: citeUrl,
        publishedAt: date ? `${date}T00:00:00Z` : null,
        source: "AI Incident Database",
        description: "Open the AIID entry for details and linked reports.",
      };
    }

    // Simple concurrency limiter (avoid hammering AIID)
    async function mapLimit(arr, concurrency, fn) {
      const out = [];
      let i = 0;
      const workers = new Array(concurrency).fill(0).map(async () => {
        while (i < arr.length) {
          const idx = i++;
          out[idx] = await fn(arr[idx]);
        }
      });
      await Promise.all(workers);
      return out;
    }

    const articles = await mapLimit(ids, 6, fetchCite);

    // Sort newest first when date exists
    articles.sort((a, b) => {
      const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return db - da;
    });

    // Cache at edge
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json({ articles });
  } catch (e) {
    return res.status(500).json({ error: "AIID function error", detail: String(e) });
  }
}

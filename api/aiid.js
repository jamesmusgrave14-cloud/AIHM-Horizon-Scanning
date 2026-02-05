// api/aiid.js
// Simple AIID “updates” feed by parsing the AIID incident list page.
// No API keys needed.

export default async function handler(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);

    // AIID incident list / summary page (public)
    const upstream = "https://incidentdatabase.ai/summaries/incidents/";

    const r = await fetch(upstream, {
      headers: { "User-Agent": "aihm-hs/1.0 (demo)" },
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(r.status).json({ error: "AIID upstream error", detail: text });
    }

    const html = await r.text();

    // Very lightweight extraction:
    // Look for incident links like "/cite/1069" or other incident link patterns.
    // We’ll extract unique incident IDs and build URLs.
    const ids = [];
    const re = /\/cite\/(\d{1,6})/g;
    let m;

    while ((m = re.exec(html)) !== null) {
      const id = m[1];
      if (!ids.includes(id)) ids.push(id);
      if (ids.length >= limit) break;
    }

    // Fallback: if cite links aren’t present, return empty
    const items = ids.map((id) => ({
      id,
      title: `AIID incident ${id}`, // title can be filled in later by deeper fetch
      url: `https://incidentdatabase.ai/cite/${id}`,
      source: "AI Incident Database",
      publishedAt: null,
      category: "Safety incidents (AI Incident Database)",
      tab: "Harms",
      description: "Open the incident link to view details on AIID.",
    }));

    // Cache it (reduces load + makes dashboard snappy)
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json({ articles: items });
  } catch (e) {
    return res.status(500).json({ error: "AIID function error", detail: String(e) });
  }
}

import { readFile } from "node:fs/promises";
import path from "node:path";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

  const limit = Math.min(parseInt(req.query.limit || "20", 10) || 20, 100);

  try {
    const filePath = path.join(process.cwd(), "public", "aiid-latest.json");
    const raw = await readFile(filePath, "utf8");
    const data = JSON.parse(raw);
    const articles = Array.isArray(data?.articles) ? data.articles : [];
    res.status(200).json({ articles: articles.slice(0, limit), meta: { ok: true } });
  } catch (e) {
    res.status(200).json({
      articles: [],
      meta: { ok: false, reason: "missing_aiid_cache", message: String(e?.message || e) },
    });
  }
}

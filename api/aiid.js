import { readFile } from "node:fs/promises";
import path from "node:path";

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export default async function handler(req, res) {
  // Always respond with JSON (never crash the function)
  try {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

    const limitRaw = Array.isArray(req.query?.limit) ? req.query.limit[0] : req.query?.limit;
    const limit = Math.min(parseInt(limitRaw || "20", 10) || 20, 100);

    const cachePath = path.join(process.cwd(), "public", "aiid-latest.json");

    let raw;
    try {
      raw = await readFile(cachePath, "utf8");
    } catch (e) {
      // Cache missing: return empty but healthy
      return res.status(200).send(
        JSON.stringify({
          articles: [],
          meta: {
            ok: false,
            reason: "aiid_cache_missing",
            note: "public/aiid-latest.json not found in deployment",
          },
        })
      );
    }

    const parsed = safeJsonParse(raw);
    if (!parsed.ok) {
      // Cache invalid JSON: return empty but healthy
      return res.status(200).send(
        JSON.stringify({
          articles: [],
          meta: {
            ok: false,
            reason: "aiid_cache_invalid_json",
            error: parsed.error,
          },
        })
      );
    }

    const data = parsed.value;
    const articles = Array.isArray(data?.articles) ? data.articles : [];

    return res.status(200).send(
      JSON.stringify({
        articles: articles.slice(0, limit),
        meta: {
          ok: true,
          source: "public/aiid-latest.json",
          generatedAt: data?.meta?.generatedAt || null,
          totalCached: articles.length,
        },
      })
    );
  } catch (e) {
    // Absolute last resort: still return JSON
    return res.status(200).send(
      JSON.stringify({
        articles: [],
        meta: {
          ok: false,
          reason: "aiid_function_exception",
          error: String(e?.message || e),
        },
      })
    );
  }
}

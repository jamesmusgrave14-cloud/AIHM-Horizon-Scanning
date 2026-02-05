// api/aiid.js
import tar from "tar-stream";
import unbzip2Stream from "unbzip2-stream";
import { parse as csvParse } from "csv-parse/sync";

export default async function handler(req, res) {
  // Cache at the edge/CDN to avoid repeatedly pulling a ~90MB snapshot
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400"); // 6h fresh, 24h stale

  const limit = Math.min(parseInt(req.query.limit || "20", 10) || 20, 100);

  try {
    // 1) Discover latest snapshot tarball from the snapshots index
    const snapshotsIndexUrl = "https://incidentdatabase.ai/research/snapshots/";
    const html = await (await fetch(snapshotsIndexUrl)).text();

    // Find newest backup filename in the HTML (e.g., backup-20260119100813.tar.bz2)
    // We take the first match (page lists newest first per the visible ordering).
    const match = html.match(/backup-\d{14}\.tar\.bz2/);
    if (!match) {
      return res.status(200).json({
        articles: [],
        meta: { ok: false, reason: "no_snapshot_links_found", source: snapshotsIndexUrl },
      });
    }

    const backupName = match[0];

    // The snapshots page provides a "Download" link per backup. In practice the tarball is served
    // from the same origin; we can attempt direct fetch by appending to /research/snapshots/.
    // If AIID ever changes this, the meta.reason below will help debugging.
    const backupUrl = `${snapshotsIndexUrl}${encodeURIComponent(backupName)}`;

    // 2) Stream download -> bunzip -> tar extract
    const resp = await fetch(backupUrl);
    if (!resp.ok || !resp.body) {
      return res.status(200).json({
        articles: [],
        meta: { ok: false, reason: "snapshot_fetch_failed", status: resp.status, backupUrl },
      });
    }

    // Extractor
    const extract = tar.extract();

    let incidentsPayload = null; // will hold parsed array of incidents-ish objects
    let incidentsFormat = null; // "json" | "jsonl" | "csv"
    let found = false;

    // Helper: choose likely incidents file inside archive
    const looksLikeIncidentsFile = (name) => {
      const n = (name || "").toLowerCase();
      // AIID backups can vary; be permissive.
      return (
        n.includes("incident") &&
        (n.endsWith(".json") || n.endsWith(".jsonl") || n.endsWith(".csv")) &&
        // avoid obvious non-data docs
        !n.includes("readme") &&
        !n.includes("schema")
      );
    };

    extract.on("entry", (header, stream, next) => {
      const name = header?.name || "";
      if (found || !looksLikeIncidentsFile(name)) {
        stream.resume();
        return next();
      }

      // Collect this entry (but cap memory just in case)
      const chunks = [];
      let size = 0;
      const MAX_BYTES = 20 * 1024 * 1024; // 20MB cap for the extracted file; adjust if needed

      stream.on("data", (c) => {
        size += c.length;
        if (size <= MAX_BYTES) chunks.push(c);
      });

      stream.on("end", () => {
        try {
          const buf = Buffer.concat(chunks);
          const text = buf.toString("utf8");

          if (name.toLowerCase().endsWith(".jsonl")) {
            incidentsFormat = "jsonl";
            incidentsPayload = text
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .map((l) => JSON.parse(l));
          } else if (name.toLowerCase().endsWith(".csv")) {
            incidentsFormat = "csv";
            incidentsPayload = csvParse(text, {
              columns: true,
              skip_empty_lines: true,
            });
          } else {
            incidentsFormat = "json";
            incidentsPayload = JSON.parse(text);
          }

          found = true;
        } catch (e) {
          // If parsing failed, continue scanning other entries
          incidentsPayload = null;
          incidentsFormat = null;
          found = false;
        }

        next();
      });

      stream.on("error", () => next());
    });

    const pipeline = resp.body
      .pipeThrough(new TransformStream({
        transform(chunk, controller) { controller.enqueue(chunk); }
      })); // keep Web Streams happy in some runtimes

    // Node stream interop: convert WebStream to Node stream if needed
    // Vercel Node runtime supports Response.body as a web stream; unbzip2 expects Node streams.
    // Use Readable.fromWeb when available.
    const { Readable } = await import("node:stream");
    const nodeReadable = Readable.fromWeb(pipeline);

    await new Promise((resolve, reject) => {
      nodeReadable
        .pipe(unbzip2Stream())
        .pipe(extract)
        .on("finish", resolve)
        .on("error", reject);
    });

    if (!Array.isArray(incidentsPayload)) {
      return res.status(200).json({
        articles: [],
        meta: {
          ok: false,
          reason: "incidents_not_found_or_not_array",
          backupUrl,
          incidentsFormat,
        },
      });
    }

    // 3) Normalise into {title, date/publishedAt, url}
    // Field names vary; we pick best-effort candidates.
    const normalised = incidentsPayload
      .map((it) => {
        const id =
          it.incident_id ??
          it.incidentId ??
          it._id ??
          it.id ??
          null;

        const title =
          it.title ??
          it.incident_title ??
          it.name ??
          `Incident ${id ?? ""}`.trim();

        const date =
          it.date ??
          it.incident_date ??
          it.incidentDate ??
          it.publishedAt ??
          it.published_date ??
          null;

        const url = id ? `https://incidentdatabase.ai/cite/${id}` : "https://incidentdatabase.ai/";

        return {
          id,
          title,
          date,
          publishedAt: date,
          url,
          sourceName: "AI Incident Database (snapshot)",
          source: "AI Incident Database (snapshot)",
        };
      })
      .filter((x) => x.title);

    // 4) Sort newest-first (best effort; unknown dates go last)
    normalised.sort((a, b) => {
      const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return (db || 0) - (da || 0);
    });

    return res.status(200).json({
      articles: normalised.slice(0, limit),
      meta: {
        ok: true,
        source: "AIID weekly snapshots",
        snapshotsIndexUrl,
        backupUrl,
        incidentsFormat,
        totalParsed: normalised.length,
      },
    });
  } catch (e) {
    return res.status(200).json({
      articles: [],
      meta: { ok: false, reason: "exception", message: String(e?.message || e) },
    });
  }
}

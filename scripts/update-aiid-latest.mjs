// scripts/update-aiid-latest.mjs
import fs from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import tar from "tar-stream";
import unbzip2Stream from "unbzip2-stream";
import { parse as csvParse } from "csv-parse/sync";
import { Readable } from "node:stream";

const INDEX_URL = "https://incidentdatabase.ai/research/snapshots/";

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return null;
}

async function main() {
  const html = await (await fetch(INDEX_URL)).text();

  const backupFile = html.match(/backup-\d{14}\.tar\.bz2/)?.[0];
  if (!backupFile) throw new Error("No backup-YYYYMMDDHHMMSS.tar.bz2 found on snapshots page");

  // Try to capture an actual href if present; fallback to same-dir
  const href = html.match(new RegExp(`href="([^"]*${backupFile.replaceAll(".", "\\.")})"`))?.[1];
  const backupUrl = href ? (href.startsWith("http") ? href : new URL(href, INDEX_URL).toString()) : new URL(backupFile, INDEX_URL).toString();

  const resp = await fetch(backupUrl);
  if (!resp.ok || !resp.body) throw new Error(`Failed to fetch snapshot: ${resp.status} ${backupUrl}`);

  const extract = tar.extract();
  let incidentsCsvText = null;

  extract.on("entry", (header, stream, next) => {
    const name = (header?.name || "").toLowerCase();
    if (incidentsCsvText || !name.endsWith("incidents.csv")) {
      stream.resume();
      return next();
    }
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => {
      incidentsCsvText = Buffer.concat(chunks).toString("utf8");
      next();
    });
    stream.on("error", next);
  });

  const nodeReadable = Readable.fromWeb(resp.body);
  await new Promise((resolve, reject) => {
    nodeReadable.pipe(unbzip2Stream()).pipe(extract).on("finish", resolve).on("error", reject);
  });

  if (!incidentsCsvText) throw new Error("incidents.csv not found inside snapshot (unexpected archive layout)");

  const rows = csvParse(incidentsCsvText, { columns: true, skip_empty_lines: true });

  const articles = rows
    .map((r) => {
      const id = pick(r, ["incident_id", "incidentId", "id", "_id"]);
      const title = pick(r, ["title", "incident_title", "name"]) || (id ? `Incident ${id}` : null);
      const date = pick(r, ["incident_date", "date", "publishedAt", "published_date", "created_at", "updated_at"]);
      const url = id ? `https://incidentdatabase.ai/cite/${id}` : "https://incidentdatabase.ai/";
      return {
        id,
        title,
        date,
        publishedAt: date,
        url,
        source: "AI Incident Database (snapshot)",
        sourceName: "AI Incident Database (snapshot)",
      };
    })
    .filter((x) => x.title);

  articles.sort((a, b) => {
    const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return (db || 0) - (da || 0);
  });

  const out = {
    meta: { ok: true, backupUrl, indexUrl: INDEX_URL, parsedRows: rows.length, generatedAt: new Date().toISOString() },
    articles: articles.slice(0, 200) // keep it small
  };

  const outDir = path.join(process.cwd(), "public");
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "aiid-latest.json"), JSON.stringify(out, null, 2), "utf8");

  console.log(`Wrote public/aiid-latest.json from ${backupUrl} with ${out.articles.length} items`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

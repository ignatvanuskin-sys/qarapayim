/* Downloads the shortlisted gallery photos at their original size.
 *
 * 2GIS serves any width through a `_<W>x.jpg` suffix; asking for the width the
 * gallery metadata reports returns the untouched original (no upscaling).
 *
 *   node scripts/fetch-photos.mjs 3 5 14 22 43
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "raw", "photos");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const index = JSON.parse(fs.readFileSync(path.join(RAW, "gallery-index.json"), "utf8"));
const wanted = process.argv.slice(2).map(Number);
if (!wanted.length) {
  console.log("usage: node scripts/fetch-photos.mjs <n> [n...]");
  process.exit(1);
}

for (const n of wanted) {
  const item = index.find((x) => x.n === n);
  if (!item) {
    console.log(`p-${n}: not in index`);
    continue;
  }
  const name = `p-${String(n).padStart(3, "0")}.jpg`;
  const dest = path.join(RAW, name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 30_000) {
    console.log(`${name}: already present`);
    continue;
  }
  const url = item.url.replace(/\.jpg$/, `_${item.w}x.jpg`);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    console.log(`${name}: HTTP ${res.status} for ${url}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const sig = buf.subarray(0, 3).toString("hex");
  if (sig !== "ffd8ff") {
    console.log(`${name}: not a JPEG (sig ${sig})`);
    continue;
  }
  fs.writeFileSync(dest, buf);
  console.log(`${name}: ${buf.length} B  ${item.w}x${item.h}  <- ${url}`);
}

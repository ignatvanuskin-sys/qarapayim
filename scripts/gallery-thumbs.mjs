/* One-off helper: pull the studio's 2GIS gallery index and build contact sheets
 * of small previews, so the right photos can be picked for each landing slot.
 *
 *   node scripts/gallery-thumbs.mjs            fetch index + thumbs + sheets
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "raw", "photos");
const THUMBS = path.join(RAW, "thumbs");
const API =
  "https://api.photo.2gis.com/3.0/objects/70000001099671293/albums/all/media?key=gYu1s9N1wP&limit=200";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

fs.mkdirSync(THUMBS, { recursive: true });

const indexFile = path.join(RAW, "media.json");
if (!fs.existsSync(indexFile)) {
  const res = await fetch(API, { headers: { "User-Agent": UA } });
  fs.writeFileSync(indexFile, await res.text(), "utf8");
}
const data = JSON.parse(fs.readFileSync(indexFile, "utf8"));
const photos = (data.items ?? []).filter((i) => i.media_type === "photo" && i.photo?.url);
console.log(`photos in index: ${photos.length}`);

const sized = (url, width) => url.replace(/\.jpg$/, `_${width}x.jpg`);

const rows = [];
for (let i = 0; i < photos.length; i++) {
  const p = photos[i];
  const name = `p-${String(i + 1).padStart(3, "0")}.jpg`;
  const dest = path.join(THUMBS, name);
  const url = sized(p.photo.url, 400);
  try {
    if (!fs.existsSync(dest)) {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    }
    const meta = await sharp(dest).metadata();
    rows.push({
      n: i + 1,
      name,
      album: p.album?.id ?? "",
      w: p.photo.width,
      h: p.photo.height,
      thumbW: meta.width,
      url: p.photo.url,
    });
  } catch (e) {
    console.log(`FAIL p-${i + 1}: ${e.message}`);
  }
}
fs.writeFileSync(path.join(RAW, "gallery-index.json"), JSON.stringify(rows, null, 2), "utf8");
console.log(`thumbs ok: ${rows.length}`);

/* contact sheets, 8 columns, each cell labelled with its index */
const pick = rows.filter((r) => fs.existsSync(path.join(THUMBS, r.name)));
const cell = 220;
const cols = 8;
const perSheet = cols * 6;
for (let s = 0; s * perSheet < pick.length; s++) {
  const slice = pick.slice(s * perSheet, (s + 1) * perSheet);
  const rowsN = Math.ceil(slice.length / cols);
  const composites = [];
  for (let i = 0; i < slice.length; i++) {
    const left = (i % cols) * cell;
    const top = Math.floor(i / cols) * cell;
    composites.push({
      input: await sharp(path.join(THUMBS, slice[i].name))
        .resize(cell - 8, cell - 8, { fit: "cover" })
        .png()
        .toBuffer(),
      left: left + 4,
      top: top + 4,
    });
    const label = Buffer.from(
      `<svg width="${cell}" height="26"><rect width="${cell}" height="26" fill="#000" opacity="0.75"/><text x="8" y="19" font-family="Arial" font-size="17" fill="#e8b33c">${slice[i].n}</text></svg>`,
    );
    composites.push({ input: label, left, top: top + cell - 26 });
  }
  const out = path.join(RAW, `sheet-${s + 1}.png`);
  await sharp({
    create: { width: cols * cell, height: rowsN * cell, channels: 3, background: "#222" },
  })
    .composite(composites)
    .png()
    .toFile(out);
  console.log(`sheet ${s + 1}: ${out}`);
}

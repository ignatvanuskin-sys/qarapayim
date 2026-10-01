/* Разово: выкачать галерею организации из 2ГИС и собрать контактные листы,
 * чтобы выбрать кадры под слоты лендинга.
 *
 *   node scripts/fetch-2gis-photos.mjs            всё: индекс + превью + листы
 *   node scripts/fetch-2gis-photos.mjs --full     догрузить полные версии
 *
 * Индекс складывается в raw/photo-index.json, оригиналы — в raw/photos/p-NNN.jpg,
 * превью — в raw/photos/thumbs, контактные листы — в raw/sheet-N.png.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "raw");
const PHOTOS = path.join(RAW, "photos");
const THUMBS = path.join(PHOTOS, "thumbs");
const INDEX = path.join(RAW, "photo-index.json");

const OBJECT_ID = "70000001097478322";
const KEY = "gYu1s9N1wP";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

fs.mkdirSync(THUMBS, { recursive: true });

/* ------------------------------------------------------------------ индекс */
async function buildIndex() {
  if (fs.existsSync(INDEX) && !process.argv.includes("--refresh")) {
    return JSON.parse(fs.readFileSync(INDEX, "utf8"));
  }
  const rows = [];
  let token = null;
  for (let page = 0; page < 10; page++) {
    const url =
      `https://api.photo.2gis.com/3.0/objects/${OBJECT_ID}/albums/all/media?key=${KEY}&limit=200` +
      (token ? `&page_token=${encodeURIComponent(token)}` : "");
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    const data = await res.json();
    const items = (data.items ?? []).filter((i) => i.media_type === "photo" && i.photo?.url);
    for (const it of items) {
      rows.push({ url: it.photo.url, w: it.photo.width, h: it.photo.height });
    }
    console.log(`page ${page + 1}: +${items.length} (всего ${rows.length})`);
    token = data.next_page_token;
    if (!token) break;
  }
  rows.forEach((r, i) => (r.n = i + 1));
  fs.writeFileSync(INDEX, JSON.stringify(rows, null, 2), "utf8");
  return rows;
}

const index = await buildIndex();
console.log(`\nкадров в индексе: ${index.length}`);

/* ------------------------------------------------------------------ загрузка */
const full = process.argv.includes("--full");
/* Номера кадров после флага: --full 40 93 24 … — качаем только выбранные слоты,
   без номеров — всю галерею. */
const only = new Set(process.argv.slice(2).map(Number).filter(Boolean));
const wanted = only.size ? index.filter((i) => only.has(i.n)) : index;

let downloaded = 0;
const available = [];
for (const item of wanted) {
  const name = `p-${String(item.n).padStart(3, "0")}.jpg`;
  const dest = path.join(full ? PHOTOS : THUMBS, name);
  const url = full ? item.url : item.url.replace(/\.jpg$/, "_400x.jpg");
  try {
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 5_000) {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.subarray(0, 3).toString("hex") !== "ffd8ff") throw new Error("не JPEG");
      fs.writeFileSync(dest, buf);
      downloaded++;
    }
    available.push({ ...item, name });
  } catch (e) {
    console.log(`FAIL ${name}: ${e.message}`);
  }
}
console.log(`скачано: ${downloaded}, доступно: ${available.length}`);

/* ------------------------------------------------------- контактные листы */
if (!full) {
  const cell = 200;
  const cols = 8;
  const perSheet = cols * 6;
  for (let s = 0; s * perSheet < available.length; s++) {
    const slice = available.slice(s * perSheet, (s + 1) * perSheet);
    const rowsN = Math.ceil(slice.length / cols);
    const composites = [];
    for (let i = 0; i < slice.length; i++) {
      const left = (i % cols) * cell;
      const top = Math.floor(i / cols) * cell;
      composites.push({
        input: await sharp(path.join(THUMBS, slice[i].name))
          .resize(cell - 6, cell - 6, { fit: "cover" })
          .png()
          .toBuffer(),
        left: left + 3,
        top: top + 3,
      });
      const label = Buffer.from(
        `<svg width="${cell}" height="24"><rect width="${cell}" height="24" fill="#000" opacity="0.78"/><text x="7" y="17" font-family="Arial" font-size="16" fill="#e8b33c">${slice[i].n}</text></svg>`,
      );
      composites.push({ input: label, left, top: top + cell - 24 });
    }
    const out = path.join(RAW, `sheet-${s + 1}.png`);
    await sharp({
      create: { width: cols * cell, height: rowsN * cell, channels: 3, background: "#222" },
    })
      .composite(composites)
      .png()
      .toFile(out);
    console.log(`лист: ${out}`);
  }
}

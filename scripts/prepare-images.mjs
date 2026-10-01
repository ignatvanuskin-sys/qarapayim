/* Нарезка адаптивных картинок для сайта.
 *
 * Источник — фотографии клиента в raw/photos/ и привязка в client/src/site.config.ts
 * (поле photos). Результат — webp в client/public/img с именами, которых ждёт
 * вёрстка. Каждый кадр обрезается «по центру» под соотношение стороны блока,
 * поэтому подойдут фото любой пропорции.
 *
 *   node scripts/prepare-images.mjs            нарезать всё
 *   node scripts/prepare-images.mjs --report   только показать, что получится
 *
 * Что уже сгенерировано, скрипт помнит в client/public/img/.generated.json и
 * удаляет устаревшее только из этого списка — кадры-заглушки «до/после» и
 * любые файлы, положенные в img руками, он не трогает.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { MANIFEST, OUT_DIR, imagePlan } from "./image-plan.mjs";

const plan = imagePlan();

if (process.argv[2] === "--report") {
  for (const item of plan) console.log(`${item.file.padEnd(30)} ${item.width}x${item.height}  <- ${path.basename(item.source)}`);
  console.log(`\nвсего файлов: ${plan.length}`);
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

/* 1. убрать то, что генерировали в прошлый раз и что больше не нужно */
const previous = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : [];
const wanted = new Set(plan.map((item) => item.file));
for (const file of previous) {
  if (wanted.has(file)) continue;
  const target = path.join(OUT_DIR, file);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
    console.log(`удалён устаревший ${file}`);
  }
}

/* 2. нарезать недостающее */
let made = 0;
const skipped = [];
for (const item of plan) {
  if (!fs.existsSync(item.source)) {
    skipped.push(item);
    continue;
  }
  const target = path.join(OUT_DIR, item.file);
  /* пишем через временный файл: на Windows чтение и запись одного пути подряд
     падает с «unable to open for write» */
  const tmp = `${target}.tmp`;
  await sharp(item.source)
    .resize(item.width, item.height, { fit: "cover", position: "centre" })
    .webp({ quality: 82, effort: 5 })
    .toFile(tmp);
  fs.renameSync(tmp, target);
  made++;
  if (made % 10 === 0) console.log(`  … ${made}`);
}

fs.writeFileSync(MANIFEST, JSON.stringify([...wanted].sort(), null, 2), "utf8");

console.log(`\nготово: нарезано ${made} файлов из ${plan.length}`);
if (skipped.length) {
  const missing = [...new Set(skipped.map((item) => path.basename(item.source)))];
  console.log(`\nНЕТ ИСХОДНИКА (${missing.length}) — положите файлы в raw/photos/:`);
  for (const file of missing) console.log(`  ${file}`);
  console.log("\nэти слоты пока показывают кадры из репозитория (если они там есть)");
}

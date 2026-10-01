/* Проверка, что вёрстке хватает картинок: каждый запрошенный файл лежит в
 * client/public/img и лишнего там не осталось.
 * Запускать после правок конфига и нарезки фото:
 *
 *   node scripts/check-images.mjs
 */
import fs from "node:fs";
import { OUT_DIR, imagePlan } from "./image-plan.mjs";

const plan = imagePlan();
const onDisk = new Set(fs.readdirSync(OUT_DIR).filter((file) => file.endsWith(".webp")));

const wanted = new Set(plan.map((item) => item.file));
const missing = plan.filter((item) => !onDisk.has(item.file)).map((item) => item.file);
const unused = [...onDisk].filter((file) => !wanted.has(file));

console.log(`нужно файлов: ${plan.length}, лежит в img: ${onDisk.size}`);

if (missing.length) {
  console.log(`\nНЕ ХВАТАЕТ (${missing.length}):`);
  for (const file of missing) console.log(`  ${file}`);
  const slots = [...new Set(missing.map((file) => file.split("-").slice(0, -2).join("-")))];
  console.log(`\nпохоже, нет исходников для слотов: ${slots.join(", ")}`);
  console.log("положите фото в raw/photos/ и запустите node scripts/prepare-images.mjs");
}

if (unused.length) console.log(`\nлишнее в img (${unused.length}): ${unused.join(", ")}`);

if (!missing.length && !unused.length) console.log("\nOK — весь набор картинок на месте");
process.exitCode = missing.length ? 1 : 0;

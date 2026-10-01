/* Что за картинки нужны вёрстке.
 *
 * Слоты и файлы-источники берутся из client/src/site.config.ts, а набор
 * размеров для каждого слота задан раскладкой и от клиента не зависит.
 * Модуль общий для генератора (prepare-images) и проверки (check-images),
 * чтобы они не разъезжались.
 */
import fs from "node:fs";
import path from "node:path";
import { site } from "../client/src/site.config.ts";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const SRC_DIR = path.join(ROOT, "raw", "photos");
export const OUT_DIR = path.join(ROOT, "client", "public", "img");
/** Список файлов, которые сгенерировал скрипт — по нему чистится устаревшее. */
export const MANIFEST = path.join(OUT_DIR, ".generated.json");

/** Размеры (ширина) для каждого вида кадра. */
export const VARIANTS = {
  mobile: [480, 800, 1200],
  wide: [1280, 1920],
  card: [480, 800],
  tall: [480, 800],
  portrait: [420, 760],
};

/** Высота = ширина × RATIO — соотношения повторяют исходную вёрстку. */
export const RATIO = { card: 3 / 4, portrait: 987 / 760, tall: 4 / 3, mobile: 4 / 3, wide: 9 / 16 };

/** Слот → какие виды кадров ему нужны. */
export function slotVariants() {
  const list = [
    [site.hero.photo, ["mobile", "wide"]],
    [site.finalCta.photo, ["mobile", "wide"]],
    [site.approach.photo, ["card", "tall"]],
    ...site.services.items.map((service) => [service.photo, ["card", "portrait"]]),
    ...site.works.items.map((_, i) => [`work-${i + 1}`, ["tall", "portrait"]]),
  ];
  /* Слот без файла в photos — значит, для него остаётся заглушка из репозитория. */
  return list.filter(([slot]) => Boolean(site.photos[slot]));
}

/** Плоский список файлов, которые должна уметь отдать страница. */
export function imagePlan() {
  const plan = [];
  for (const [slot, variants] of slotVariants()) {
    for (const variant of variants) {
      for (const width of VARIANTS[variant]) {
        plan.push({
          file: `${slot}-${variant}-${width}.webp`,
          slot,
          variant,
          width,
          height: Math.round(width * RATIO[variant]),
          source: path.join(SRC_DIR, `${site.photos[slot]}.jpg`),
        });
      }
    }
  }
  return plan;
}

export const exists = (dir, file) => fs.existsSync(path.join(dir, file));

/* Фавикон из монограммы: рисует client/public/favicon.svg по данным
 * site.config.ts (brand.monogram и theme.accent).
 *
 *   node scripts/make-favicon.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { site } from "../client/src/site.config.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const target = path.join(ROOT, "client", "public", "favicon.svg");

const monogram = site.brand.monogram;
const accent = site.theme.accent;
const paper = "#efede8";

/* Чем длиннее монограмма, тем мельче кегль — чтобы надпись не вылезала. */
const size = monogram.length <= 2 ? 27 : monogram.length === 3 ? 22 : 17;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${site.brand.full}">
  <rect width="64" height="64" fill="#11110f" />
  <text x="32" y="${size > 22 ? 42 : 40}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${size}" letter-spacing="-1.5" fill="${accent}">${monogram}</text>
  <rect x="15" y="49" width="34" height="3" fill="${paper}" />
</svg>
`;

fs.writeFileSync(target, svg, "utf8");
console.log(`favicon.svg обновлён: монограмма «${monogram}», акцент ${accent}`);

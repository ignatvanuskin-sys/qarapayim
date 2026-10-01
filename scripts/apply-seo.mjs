/* Прописывает заголовок вкладки и описание из site.config.ts прямо в
 * client/index.html — чтобы их видели поисковики и мессенджеры, не дожидаясь
 * выполнения JS (в рантайме их всё равно подставляет main.tsx).
 *
 * Запускается автоматически перед pnpm build (скрипт prebuild):
 *   node scripts/apply-seo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { site } from "../client/src/site.config.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const file = path.join(ROOT, "client", "index.html");
/* .mjs не проходит через TypeScript, поэтому здесь только чистый JS */
const escape = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

let html = fs.readFileSync(file, "utf8");
const before = html;

html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(site.seo.title)}</title>`);
html = html.replace(
  /(<meta\s+name="description"\s+content=")[\s\S]*?(")/,
  `$1${escape(site.seo.description)}$2`,
);
html = html.replace(
  /(<meta\s+property="og:title"\s+content=")[\s\S]*?(")/,
  `$1${escape(site.seo.title)}$2`,
);
html = html.replace(
  /(<meta\s+property="og:description"\s+content=")[\s\S]*?(")/,
  `$1${escape(site.seo.description)}$2`,
);

if (html === before) {
  console.log("index.html без изменений (значения уже совпадают)");
} else {
  fs.writeFileSync(file, html, "utf8");
  console.log(`index.html обновлён: «${site.seo.title}»`);
}

import { createRoot } from "react-dom/client";
import App from "./App";
import { site } from "./site.config";
import "./index.css";

/* Тема и SEO применяются из site.config.ts до первого рендера, чтобы палитра
   не успела мигнуть старыми цветами. Ключи theme — имена CSS-переменных. */
for (const [name, value] of Object.entries(site.theme)) {
  document.documentElement.style.setProperty(`--${name}`, value);
}

document.title = site.seo.title;

const setMeta = (selector: string, key: string, name: string, content: string) => {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(key, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
};

setMeta('meta[name="description"]', "name", "description", site.seo.description);
setMeta('meta[property="og:title"]', "property", "og:title", site.seo.title);
setMeta('meta[property="og:description"]', "property", "og:description", site.seo.description);
setMeta('meta[property="og:site_name"]', "property", "og:site_name", site.brand.full);

createRoot(document.getElementById("root")!).render(<App />);

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { site } from "../site.config";
import { addDays, buildIcs, formatPhone, humanDate, localDate, phoneDigits, shortDate, slotList } from "../lib/booking";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Droplets,
  Instagram,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ content */

/* ----------------------------------------------------------------- motion */

/**
 * Reveals `.reveal` elements once they scroll into view.
 *
 * One shared IntersectionObserver for the whole page rather than one per
 * element: a single callback is far cheaper than 40 of them, and `unobserve`
 * keeps it from firing again for settled elements.
 *
 * The revealed flag goes on `data-shown`, NOT on a class. React owns the
 * `className` attribute: it rewrites the whole string on re-render, so a class
 * added here imperatively would be wiped the moment the user opens a service
 * card and React re-renders it — the card would drop back to opacity 0 and
 * look empty. An attribute React never renders is left alone.
 */
function useRevealOnScroll() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not([data-shown])"));
    if (!nodes.length) return;

    // No observer support (or reduced motion): show everything, never hide it.
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((n) => n.setAttribute("data-shown", ""));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-shown", "");
          io.unobserve(entry.target);
        }
      },
      // Start the motion a little before the element reaches the edge, and
      // require a sliver to be visible so tall cards still fire.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.04 },
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
}

/** Dot-matrix spinner: 16 dots on a fixed grid, only transform/opacity move. */
function DotMatrix({ label = "Отправляем" }: { label?: string }) {
  return (
    <span className="dm-wrap" role="status" aria-live="polite">
      <span className="dm" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} />
        ))}
      </span>
      <span className="dm-label">{label}</span>
    </span>
  );
}

/** Hand-drawn wobble, borrowed from the doodle-icons "boil" idea. */
function BoilIcon({ children }: { children: ReactNode }) {
  return <span className="doodle-boil">{children}</span>;
}

/* ------------------------------------------------------------- content */

/* Строки в конфиге могут содержать <em>…</em> (курсивная вставка акцентным
   шрифтом) и <br /> — разметку разбираем здесь, без dangerouslySetInnerHTML. */
function Em({ text }: { text: string }) {
  return (
    <>
      {text.split(/<\/?em>/).map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part))}
    </>
  );
}

function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("<br />").map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          <Em text={line} />
        </Fragment>
      ))}
    </>
  );
}

/* Весь контент живёт в client/src/site.config.ts — здесь только раскладка.
   Локальные имена оставлены прежними, чтобы компоненты читались как раньше. */
const services = site.services.items;
const portfolio = site.works.items;
const packages = site.packages.items;
const reviews = site.reviews.items;
const process = site.process.items;
const brands = site.brands.items;

/** Иконки списка преимуществ в блоке «02 / Наш подход» (берутся по кругу). */
const APPROACH_ICONS = [Sparkles, ShieldCheck, Droplets];

/** Сколько колонок дать сетке услуг, чтобы последний ряд не пустовал.
    Услуг может быть и четыре, и восемь — число колонок считается от них. */
function gridColumns(count: number) {
  let best = 1;
  let fewestEmpty = Number.POSITIVE_INFINITY;
  for (const cols of [4, 3, 2]) {
    if (count < cols) continue;
    const empty = (cols - (count % cols)) % cols;
    if (empty < fewestEmpty) {
      fewestEmpty = empty;
      best = cols;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ контакты */

const PHONE_DISPLAY = site.location.phone.display;
const PHONE_HREF = site.location.phone.href;
const CITY = site.location.city;
const ADDRESS = site.location.address;
const HOURS = site.location.hours;
const MAP_POINT = site.location.map;
const CONTACT_LINKS = {
  phone: PHONE_HREF,
  whatsapp: site.location.links.whatsapp,
  instagram: site.location.links.instagram,
  address: site.location.links.mapCard,
};

/* Список услуг и цены для формы записи — booking.options в конфиге. */
const serviceOptions = site.booking.options;
const serviceNames: string[] = serviceOptions.map((s) => s.name);

const packOptions = packages.map((p) => ({ name: p.name, title: p.title, price: Number(p.price.replace(/\D/g, "").replace(/^0+/, "")) || 0 }));
const yearOptions = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i));

/** Renders tenge with thin spaces: 25 000 ₸ */
const formatTenge = (value: number) => `${value.toLocaleString("ru-RU").replace(/ /g, " ")} ₸`;

/* --------------------------------------------------------------- responsive */

const srcSetFor = (base: string, widths: number[]) => widths.map((w) => `/img/${base}-${w}.webp ${w}w`).join(", ");

type Art = { base: string; widths: number[]; sizes: string };

function Picture({
  desktop,
  mobile,
  alt,
  className,
  priority = false,
}: {
  desktop?: Art;
  mobile: Art;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <picture className={className}>
      {desktop ? <source media="(min-width: 900px)" type="image/webp" srcSet={srcSetFor(desktop.base, desktop.widths)} sizes={desktop.sizes} /> : null}
      <source type="image/webp" srcSet={srcSetFor(mobile.base, mobile.widths)} sizes={mobile.sizes} />
      <img
        src={`/img/${mobile.base}-${mobile.widths[mobile.widths.length - 1]}.webp`}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
      />
    </picture>
  );
}

const art = (base: string, widths: number[], sizes: string): Art => ({ base, widths, sizes });

/* --------------------------------------------------------------- components */

function SectionHeading({ kicker, title, copy, id }: { kicker: string; title: ReactNode; copy?: string; id?: string }) {
  return (
    <div className="section-heading">
      <span className="eyebrow">{kicker}</span>
      <h2 id={id}>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </div>
  );
}

function Stars({ count = 5 }: { count?: number }) {
  return (
    <div className="review-stars" aria-label={`Оценка ${count} из 5`}>
      {Array.from({ length: count }, (_, i) => (
        <Star key={i} size={15} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- booking UX */

type BookingForm = {
  services: string[];
  pack: string;
  make: string;
  model: string;
  year: string;
  name: string;
  phone: string;
  /* id из booking.channels конфига — список каналов связи задаёт клиент */
  channel: string;
  date: string;
  time: string;
  comment: string;
};

const emptyForm: BookingForm = {
  services: [],
  pack: "",
  make: "",
  model: "",
  year: "",
  name: "",
  phone: "",
  channel: "phone",
  date: "",
  time: "",
  comment: "",
};

/** Plus glyph for "add this service"; a tick replaces it once selected. */
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Live running total. A package replaces the individual lines; a custom set adds
 * them up. Always labelled as a preliminary figure, since the studio confirms
 * the real cost after inspecting the car.
 */
function Estimate({ pack = "", services }: { pack?: string; services: string[] }) {
  const packItem = packOptions.find((p) => p.name === pack);
  const lines = services
    .map((name) => serviceOptions.find((s) => s.name === name))
    .filter((s): s is (typeof serviceOptions)[number] => Boolean(s));
  const total = packItem ? packItem.price : lines.reduce((sum, s) => sum + s.price, 0);
  const nothing = !packItem && lines.length === 0;
  /* Пока прайса нет, у всех опций price = 0: считаем сумму по нулям бессмысленно,
     поэтому вместо «от 0 ₸» показываем «по запросу». */
  const priced = total > 0;

  return (
    <div className={`estimate ${nothing ? "estimate--empty" : ""}`} aria-live="polite">
      <div className="estimate-head">
        <span>{packItem ? `Пакет ${packItem.name}` : "Ваш набор"}</span>
        <strong className="stat-value">{nothing ? "—" : priced ? `от ${formatTenge(total)}` : "по запросу"}</strong>
      </div>
      {lines.length > 0 ? (
        <ul className="estimate-lines">
          {lines.map((line) => (
            <li key={line.name}>
              <span>{line.name}</span>
              <span>{line.price > 0 ? formatTenge(line.price) : "по запросу"}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="estimate-note">Точную стоимость подтвердит мастер после осмотра автомобиля.</p>
    </div>
  );
}

/* Карточка услуги передаёт своё короткое название, а форма работает с полными
   названиями опций. Связь задаётся полем service в booking.options конфига. */
const serviceTitleToOption: Record<string, string> = Object.fromEntries(
  site.booking.options.filter((option) => option.service).map((option) => [option.service as string, option.name]),
);

const channelLabel = (id: string) => site.booking.channels.find((channel) => channel.id === id)?.label ?? id;
const channelShort = (id: string) => site.booking.channels.find((channel) => channel.id === id)?.short ?? id;

/* Даты, слоты и телефон живут в client/src/lib/booking.ts — это чистая логика
   без React и DOM, её проверяет scripts/test-booking.mjs. */

/* Сборка .ics — в lib/booking.ts, здесь осталось только скачивание файла. */

/** Отдаём файл браузеру — без сервера, всё на клиенте. */
function downloadIcs(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Черновик заявки: человек может закрыть окно и вернуться. */
const DRAFT_KEY = "qarapayim-booking-draft";

function readDraft(): Partial<BookingForm> | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BookingForm>;
    return typeof parsed === "object" && parsed ? parsed : null;
  } catch {
    return null;
  }
}

function writeDraft(form: BookingForm) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, services: form.services.slice(0, 8) }));
  } catch {
    /* приватный режим — просто работаем без черновика */
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* см. выше */
  }
}

/* ------------------------------------------------------------------ карта */

/* Карта 2ГИС без iframe.
   Официальный виджет 2ГИС выдаётся организации в личном кабинете
   (widgets.2gis.com) и без ключа отдаёт страницу «Something went wrong» —
   это проверено, поэтому встраивать его вслепую нельзя. Тайлы же 2ГИС
   отдаются открыто, и здесь из них собирается та же карта, что видит
   посетитель на 2gis.kz: без ключа, без стороннего iframe и без запросов
   к чужим скриптам. Тайлы грузятся, только когда блок подходит к экрану. */
const TILE_SIZE = 256;
const MAP_ZOOM = site.location.map.zoom;
const MAP_COLS = 4;
const MAP_ROWS = 3;

/** Пиксельные координаты точки в проекции веб-Меркатора на заданном зуме. */
function projectPoint(lat: number, lon: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** Два поддомена подряд, чтобы браузер качал тайлы параллельно. */
const tileUrl = (x: number, y: number) =>
  `https://tile${(x + y) % 2}.maps.2gis.com/tiles?x=${x}&y=${y}&z=${MAP_ZOOM}&v=1&ts=online_sd&style=light`;

function ContactMap() {
  const holder = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setVisible(true);
        io.disconnect();
      },
      // Start fetching a little before the block is fully on screen.
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  /* Точка студии в пикселях тайловой сетки, и тайловый блок, сдвинутый так,
     чтобы эта точка оказалась ровно в центре видимого прямоугольника. */
  const point = projectPoint(MAP_POINT.lat, MAP_POINT.lon, MAP_ZOOM);
  const firstCol = Math.floor(point.x / TILE_SIZE) - Math.floor(MAP_COLS / 2);
  const firstRow = Math.floor(point.y / TILE_SIZE) - Math.floor(MAP_ROWS / 2);
  const offsetX = point.x - firstCol * TILE_SIZE;
  const offsetY = point.y - firstRow * TILE_SIZE;

  const tiles = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      tiles.push({
        x: firstCol + col,
        y: firstRow + row,
        left: col * TILE_SIZE,
        top: row * TILE_SIZE,
      });
    }
  }

  return (
    <div className="contact-map reveal" ref={holder} data-shown="">
      {visible ? (
        <div className="map-tiles">
          <div
            className="map-tiles__grid"
            style={{
              left: `calc(50% - ${offsetX}px)`,
              top: `calc(50% - ${offsetY}px)`,
              width: MAP_COLS * TILE_SIZE,
              height: MAP_ROWS * TILE_SIZE,
            }}
          >
            {tiles.map((tile) => (
              <img
                key={`${tile.x}-${tile.y}`}
                className="map-tiles__tile"
                src={tileUrl(tile.x, tile.y)}
                style={{ left: tile.left, top: tile.top }}
                width={TILE_SIZE}
                height={TILE_SIZE}
                alt=""
                decoding="async"
              />
            ))}
          </div>
          <span className="map-pin" aria-hidden="true">
            <MapPin size={22} />
          </span>
          <span className="map-credit">© 2ГИС</span>
        </div>
      ) : (
        <div className="contact-map__placeholder" aria-hidden="true">
          <MapPin size={26} />
          <span>
            {CITY}, {ADDRESS}
          </span>
        </div>
      )}
      <a className="contact-map__link" href={CONTACT_LINKS.address} target="_blank" rel="noreferrer">
        <MapPin size={16} aria-hidden="true" />
        Открыть в 2ГИС
        <ArrowUpRight size={14} aria-hidden="true" />
      </a>
    </div>
  );
}

const STEPS = site.booking.stepLabels;

/** id поля и его сообщения об ошибке — по ним связаны input, текст ошибки и
    ссылка в сводке ошибок. */
const fieldId = (name: string) => `booking-${name}`;

/** Пункты меню: раздел страницы + подпись. По этому же списку меню подсвечивает
    текущий раздел, поэтому добавлять пункт нужно только здесь. */
const NAV_ITEMS: [string, string][] = [
  ["services", "Услуги"],
  ["work", "Работы"],
  ["reviews", "Отзывы"],
  ["process", "Процесс"],
  ["contacts", "Контакты"],
];

function BookingSheet({ open, onClose, initialService }: { open: boolean; onClose: () => void; initialService?: string }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<BookingForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /* Сводка ошибок: после неудачной проверки шага фокус уходит на неё, а каждая
     строка ведёт к своему полю — так форма проходится с клавиатуры и читается
     скринридером (правило skill: focusable error summary). */
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  /* Текст отправленной заявки: из него собираются кнопки на экране успеха —
     повторить WhatsApp, положить визит в календарь, скопировать текст. */
  const [request, setRequest] = useState("");
  const [copied, setCopied] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const today = localDate(new Date());
  const slotBounds = site.booking.slots;

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSent(false);
    setSending(false);
    setSendError("");
    setCopied(false);
    setErrors({});
    setDragY(0);
    // Pre-select the service the user clicked, so the form never opens empty
    // with the choice they already made somewhere else on the page.
    const preselected = initialService ? serviceTitleToOption[initialService] : undefined;
    /* Незаконченная заявка с прошлого визита: подставляем, но выбранную на
       странице услугу она не перебивает. */
    const draft = readDraft();
    setForm({
      ...emptyForm,
      ...draft,
      services: preselected && serviceNames.includes(preselected) ? [preselected] : (draft?.services ?? []),
      pack: preselected ? "" : (draft?.pack ?? ""),
    });
  }, [open, initialService]);

  /* Черновик пишем на каждое изменение — человек может закрыть окно, чтобы
     посмотреть модель машины, и вернуться к заполненной форме. */
  useEffect(() => {
    if (!open || sent) return;
    writeDraft(form);
  }, [open, sent, form]);

  /* keep the sheet inside the visible viewport when the keyboard opens */
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const vv = window.visualViewport;
    const apply = () => {
      if (!vv) return;
      root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
      root.style.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
    };
    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vv-top");
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => sheetRef.current?.focus({ preventScroll: true }), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  /* Свободные слоты выбранного дня. Считаем от текущего момента, поэтому
     «через час» на сегодня уже не предложим — машину нужно успеть принять.
     Оба useMemo обязаны стоять ДО `if (!open) return null`: хук после раннего
     return вызывается не на каждом рендере, и React падает с ошибкой #310
     («Rendered more hooks than during the previous render»). */
  const availableSlots = useMemo(() => (form.date ? slotList(form.date, new Date()) : []), [form.date]);

  /* Ближайшие дни, на которые слоты вообще есть: в 23:00 предлагать «сегодня»
     бессмысленно, сетка уже закрыта — показываем «завтра» и следующий день. */
  const quickDays = useMemo(() => {
    const now = new Date();
    const days: { iso: string; label: string }[] = [];
    for (let offset = 0; days.length < 2 && offset < 14; offset++) {
      const iso = localDate(addDays(now, offset));
      if (slotList(iso, now).length === 0) continue;
      const label =
        offset === 0 ? `Сегодня, ${shortDate(iso)}` : offset === 1 ? `Завтра, ${shortDate(iso)}` : shortDate(iso);
      days.push({ iso, label });
    }
    return days;
  }, []);

  if (!open) return null;

  const set = <K extends keyof BookingForm>(key: K, value: BookingForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key as string] ? { ...prev, [key as string]: "" } : prev));
  };

  /* validates the fields of the step the user is leaving */
  const validate = (target: number) => {
    const next: Record<string, string> = {};
    if (target === 0 && !form.pack && form.services.length === 0) next.services = "Выберите пакет или хотя бы одну услугу";
    if (target >= 1) {
      if (!form.make.trim()) next.make = "Укажите марку";
      if (!form.model.trim()) next.model = "Укажите модель";
    }
    if (target >= 2) {
      if (!form.name.trim()) next.name = "Как к вам обращаться?";
      if (phoneDigits(form.phone).length < 11) next.phone = "Введите номер телефона полностью";
    }
    if (target >= 3) {
      if (!form.date) next.date = "Выберите дату";
      else if (form.date < today) next.date = "Эта дата уже прошла";
      else if (slotList(form.date, new Date()).length === 0) next.date = "На этот день записи уже нет — выберите другую дату";
      if (!form.time) next.time = "Выберите время";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /* ------------------------------------------------------------------ даты */

  /* При выборе даты сразу подставляем первый свободный слот и сбрасываем
     время, которого в новом дне нет, — иначе в заявку уйдёт невозможная
     комбинация, а клиент узнает об этом только от администратора. */
  const pickDate = (iso: string) => {
    const slots = iso ? slotList(iso, new Date()) : [];
    setForm((prev) => ({ ...prev, date: iso, time: slots.includes(prev.time) ? prev.time : slots[0] ?? "" }));
    setErrors((prev) => ({ ...prev, date: "", time: "" }));
  };

  /* ------------------------------------------------------------ отправка */

  /** Текст заявки. Ровно эта строка уходит и в WhatsApp, и в вебхук. */
  const buildRequest = () => {
    const car = [form.make, form.model, form.year].filter(Boolean).join(" ");
    /* Источник заявки: метки из ссылки, иначе откуда пришёл человек. */
    const params = new URLSearchParams(window.location.search);
    const utm = ["utm_source", "utm_medium", "utm_campaign", "utm_content"]
      .map((key) => params.get(key))
      .filter(Boolean)
      .join(" / ");
    return [
      `Заявка с сайта ${site.brand.full}`,
      "",
      form.pack ? `Пакет: ${form.pack} — ${packOptions.find((p) => p.name === form.pack)?.title ?? ""}` : "Пакет: без пакета",
      `Услуги: ${form.services.length ? form.services.join(", ") : "—"}`,
      `Автомобиль: ${car || "не указан"}`,
      `Имя: ${form.name}`,
      `Телефон: ${form.phone}`,
      `Удобная связь: ${channelLabel(form.channel)}`,
      `Желаемые дата и время: ${humanDate(form.date)}, ${form.time}`,
      form.comment ? `Комментарий: ${form.comment}` : "",
      "",
      `Источник: ${utm || document.referrer || "прямой заход"}`,
    ]
      .filter((line) => line !== "")
      .join("\n");
  };

  const whatsappUrl = (text: string) =>
    `https://wa.me/${site.location.phone.href.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

  /** POST заявки на вебхук из конфига; пустая строка — канал выключен. */
  const postRequest = async (text: string) => {
    const url = site.booking.automation.webhook;
    if (!url) return false;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          name: form.name,
          phone: form.phone,
          channel: form.channel,
          pack: form.pack,
          services: form.services,
          car: [form.make, form.model, form.year].filter(Boolean).join(" "),
          date: form.date,
          time: form.time,
          comment: form.comment,
          page: window.location.href,
        }),
        keepalive: true,
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const submit = async () => {
    /* Защита от двойного клика: ссылку браузер открывает сам, повторный клик
       не должен отправить вторую заявку. */
    if (sending) return;
    const text = buildRequest();
    setRequest(text);
    setSendError("");
    setSending(true);

    /* WhatsApp открывает сама кнопка-ссылка в подвале окна: настоящий клик по
       <a target="_blank"> браузер всплывающим окном не считает, а window.open
       после await он бы заблокировал. Здесь остаётся вебхук и экран успеха. */
    const posted = await postRequest(text);
    setSending(false);

    /* Не ушло никуда — не показываем успех, а просим позвонить. */
    if (!site.booking.automation.whatsapp && !posted) {
      setSendError(`Не удалось отправить заявку. Позвоните нам: ${site.location.phone.display}`);
      return;
    }

    clearDraft();
    setSent(true);
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* Файл календаря: клиент забирает визит себе, студия получает меньше
     «а во сколько меня ждать?». */
  const saveToCalendar = () => {
    const what = form.services.length ? form.services.join(", ") : form.pack || "визит";
    downloadIcs(
      `qarapayim-detailing-${form.date}.ics`,
      buildIcs(form.date, form.time, `${site.brand.full} — ${what}`, request),
    );
  };

  const copyRequest = async () => {
    try {
      await navigator.clipboard.writeText(request);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const goNext = () => {
    if (!validate(step)) {
      window.requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (step === STEPS.length - 1) {
      void submit();
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setErrors({});
    if (sent) {
      setSent(false);
      return;
    }
    setStep((s) => Math.max(0, s - 1));
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onFieldFocus = (e: React.FocusEvent<HTMLElement>) => {
    const el = e.target;
    window.setTimeout(() => el.scrollIntoView({ block: "nearest", behavior: "smooth" }), 220);
  };

  const stepTitles = site.booking.stepTitles;
  const isLastStep = step === STEPS.length - 1;
  /* Ссылка для кнопки-ссылки на последнем шаге: собираем сразу с готовым
     текстом заявки, чтобы клик открыл чат студии уже заполненным. */
  const requestUrl = isLastStep ? whatsappUrl(buildRequest()) : "";

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        tabIndex={-1}
        ref={sheetRef}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : { transition: "transform .22s ease" }}
      >
        <div
          className="sheet-grab"
          aria-hidden="true"
          onPointerDown={(e) => {
            dragStart.current = e.clientY;
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragStart.current == null) return;
            setDragY(Math.max(0, e.clientY - dragStart.current));
          }}
          onPointerUp={() => {
            if (dragY > 110) {
              dragStart.current = null;
              setDragY(0);
              onClose();
              return;
            }
            dragStart.current = null;
            setDragY(0);
          }}
        >
          <i />
        </div>

        <div className="modal-head">
          <span className="modal-head-label">{sent ? site.booking.sentLabel : site.booking.headLabel}</span>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть окно записи">
            <X size={18} />
          </button>
        </div>

        {!sent ? (
          <>
            <div className="modal-steps">
              <div className="modal-top">
                <span className="eyebrow">
                  {site.brand.monogram} / {site.booking.eyebrow}
                </span>
                <span className="step-count">
                  {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
                </span>
              </div>
              <h2 id="booking-title">{stepTitles[step]}</h2>
              <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
                <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
              </div>
            </div>

            <div className="modal-body" ref={bodyRef}>
              {Object.keys(errors).length > 0 ? (
                <div className="form-errors" role="alert" tabIndex={-1} ref={summaryRef} aria-labelledby="form-errors-title">
                  <h3 id="form-errors-title">Проверьте данные</h3>
                  <ul>
                    {Object.entries(errors).map(([field, message]) => (
                      <li key={field}>
                        <a
                          href={`#${fieldId(field)}`}
                          onClick={(event) => {
                            event.preventDefault();
                            document.getElementById(fieldId(field))?.focus();
                          }}
                        >
                          {message}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {step === 0 ? (
                <>
                  <p className="form-lead">Выберите пакет целиком или соберите свой набор — можно взять несколько услуг сразу.</p>

                  <div
                    className="pack-picker"
                    role="group"
                    aria-label="Готовые пакеты"
                    id={fieldId("services")}
                    tabIndex={-1}
                    aria-describedby={errors.services ? `${fieldId("services")}-error` : undefined}
                  >
                    <button
                      type="button"
                      className={`pack-option ${form.pack === "" ? "selected" : ""}`}
                      aria-pressed={form.pack === ""}
                      onClick={() => set("pack", "")}
                    >
                      <span className="pack-option-name">Без пакета</span>
                      <span className="pack-option-note">Соберу услуги сам</span>
                    </button>
                    {packOptions.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        className={`pack-option ${form.pack === item.name ? "selected" : ""}`}
                        aria-pressed={form.pack === item.name}
                        onClick={() => set("pack", form.pack === item.name ? "" : item.name)}
                      >
                        <span className="pack-option-name">{item.name}</span>
                        <span className="pack-option-title">{item.title}</span>
                        {item.price > 0 ? <span className="pack-option-price">{formatTenge(item.price)}</span> : null}
                      </button>
                    ))}
                  </div>

                  {/* Picking a package replaces the individual list, the way a
                      car owner thinks about it: either the bundle or the parts. */}
                  {form.pack === "" ? (
                    <>
                      <div className="choice-grid">
                        {serviceOptions.map((item) => {
                          const active = form.services.includes(item.name);
                          return (
                            <button
                              key={item.name}
                              type="button"
                              className={`choice ${active ? "selected" : ""}`}
                              aria-pressed={active}
                              onClick={() =>
                                set(
                                  "services",
                                  active ? form.services.filter((n) => n !== item.name) : [...form.services, item.name],
                                )
                              }
                            >
                              <span>{item.name}</span>
                              {item.price > 0 ? <span className="choice-price">{formatTenge(item.price)}</span> : null}
                              {active ? <Check size={16} /> : <PlusIcon />}
                            </button>
                          );
                        })}
                      </div>
                      {errors.services ? (
                      <span className="field-error" id={`${fieldId("services")}-error`}>
                        {errors.services}
                      </span>
                    ) : null}
                      <Estimate services={form.services} />
                    </>
                  ) : (
                    <Estimate pack={form.pack} services={[]} />
                  )}
                </>
              ) : null}

              {step === 1 ? (
                <div className="input-grid input-grid--pair">
                  <label className={`field ${errors.make ? "field--invalid" : ""}`}>
                    <span>Марка</span>
                    <input
                      id={fieldId("make")}
                      value={form.make}
                      onChange={(e) => set("make", e.target.value)}
                      onFocus={onFieldFocus}
                      placeholder="Toyota"
                      autoComplete="off"
                      enterKeyHint="next"
                      aria-invalid={errors.make ? true : undefined}
                      aria-describedby={errors.make ? `${fieldId("make")}-error` : undefined}
                    />
                    {errors.make ? (
                      <span className="field-error" id={`${fieldId("make")}-error`}>
                        {errors.make}
                      </span>
                    ) : null}
                  </label>
                  <label className={`field ${errors.model ? "field--invalid" : ""}`}>
                    <span>Модель</span>
                    <input
                      id={fieldId("model")}
                      value={form.model}
                      onChange={(e) => set("model", e.target.value)}
                      onFocus={onFieldFocus}
                      placeholder="Camry"
                      autoComplete="off"
                      enterKeyHint="next"
                      aria-invalid={errors.model ? true : undefined}
                      aria-describedby={errors.model ? `${fieldId("model")}-error` : undefined}
                    />
                    {errors.model ? (
                      <span className="field-error" id={`${fieldId("model")}-error`}>
                        {errors.model}
                      </span>
                    ) : null}
                  </label>
                  <label className="field">
                    <span>Год выпуска</span>
                    <select value={form.year} onChange={(e) => set("year", e.target.value)} onFocus={onFieldFocus}>
                      <option value="">Не важно</option>
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              {step === 2 ? (
                <>
                  <div className="input-grid input-grid--pair">
                    <label className={`field ${errors.name ? "field--invalid" : ""}`}>
                      <span>Имя</span>
                      <input
                        id={fieldId("name")}
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        onFocus={onFieldFocus}
                        placeholder="Ваше имя"
                        autoComplete="name"
                        enterKeyHint="next"
                        aria-invalid={errors.name ? true : undefined}
                        aria-describedby={errors.name ? `${fieldId("name")}-error` : undefined}
                      />
                      {errors.name ? (
                        <span className="field-error" id={`${fieldId("name")}-error`}>
                          {errors.name}
                        </span>
                      ) : null}
                    </label>
                    <label className={`field ${errors.phone ? "field--invalid" : ""}`}>
                      <span>Телефон</span>
                      <input
                        id={fieldId("phone")}
                        value={form.phone}
                        onChange={(e) => set("phone", formatPhone(e.target.value))}
                        onFocus={onFieldFocus}
                        placeholder="+7 (___) ___-__-__"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        enterKeyHint="done"
                        aria-invalid={errors.phone ? true : undefined}
                        aria-describedby={errors.phone ? `${fieldId("phone")}-error` : undefined}
                      />
                      {errors.phone ? (
                        <span className="field-error" id={`${fieldId("phone")}-error`}>
                          {errors.phone}
                        </span>
                      ) : null}
                    </label>
                  </div>
                  <div className="contact-row" role="group" aria-label="Способ связи">
                    {site.booking.channels.map((channel) => (
                      <button
                        key={channel.id}
                        type="button"
                        className={`contact-pill ${form.channel === channel.id ? "active" : ""}`}
                        aria-pressed={form.channel === channel.id}
                        onClick={() => set("channel", channel.id)}
                      >
                        {channel.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <p className="form-lead">
                    Принимаем ежедневно с {String(slotBounds.from).padStart(2, "0")}:00 до{" "}
                    {String(slotBounds.to).padStart(2, "0")}:00. Выберите день и время — администратор подтвердит его в WhatsApp.
                  </p>

                  <div className="slot-row" role="group" aria-label="Быстрый выбор даты">
                    {quickDays.map((day) => (
                      <button
                        key={day.iso}
                        type="button"
                        className={`slot-chip slot-chip--day ${form.date === day.iso ? "active" : ""}`}
                        aria-pressed={form.date === day.iso}
                        onClick={() => pickDate(day.iso)}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>

                  <label className={`field ${errors.date ? "field--invalid" : ""}`} style={{ marginTop: 14 }}>
                    <span>Или выберите дату</span>
                    <input
                      id={fieldId("date")}
                      value={form.date}
                      min={today}
                      onChange={(e) => pickDate(e.target.value)}
                      onFocus={onFieldFocus}
                      type="date"
                      enterKeyHint="next"
                      aria-invalid={errors.date ? true : undefined}
                      aria-describedby={errors.date ? `${fieldId("date")}-error` : undefined}
                    />
                    {errors.date ? (
                      <span className="field-error" id={`${fieldId("date")}-error`}>
                        {errors.date}
                      </span>
                    ) : null}
                  </label>

                  <div
                    className="slot-block"
                    id={fieldId("time")}
                    tabIndex={-1}
                    role="group"
                    aria-label="Свободное время"
                    aria-describedby={errors.time ? `${fieldId("time")}-error` : undefined}
                  >
                    <span className="slot-label">Время</span>
                    {availableSlots.length ? (
                      <div className="slot-row">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            className={`slot-chip ${form.time === slot ? "active" : ""}`}
                            aria-pressed={form.time === slot}
                            onClick={() => set("time", slot)}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="slot-empty">
                        {form.date
                          ? "На этот день свободного времени уже нет — выберите другую дату."
                          : "Сначала выберите дату — покажем свободное время."}
                      </p>
                    )}
                    {errors.time ? (
                      <span className="field-error" id={`${fieldId("time")}-error`}>
                        {errors.time}
                      </span>
                    ) : null}
                  </div>

                  <label className="field" style={{ marginTop: 14 }}>
                    <span>Комментарий (необязательно)</span>
                    <textarea
                      value={form.comment}
                      onChange={(e) => set("comment", e.target.value)}
                      onFocus={onFieldFocus}
                      rows={3}
                      placeholder="Например: есть царапина на заднем бампере"
                    />
                  </label>
                  <div className="booking-note">
                    <CalendarDays size={16} />
                    <span>Администратор подтвердит время в течение 15 минут в рабочее часы.</span>
                  </div>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <div className="recap">
                    <div className="recap-row">
                      <span>Пакет</span>
                      <b>{form.pack ? `${form.pack} — ${packOptions.find((p) => p.name === form.pack)?.title ?? ""}` : "Без пакета"}</b>
                    </div>
                    <div className="recap-row">
                      <span>Услуги{form.services.length > 1 ? ` (${form.services.length})` : ""}</span>
                      <b>{form.services.length ? form.services.join(", ") : "—"}</b>
                    </div>
                    <div className="recap-row">
                      <span>Автомобиль</span>
                      <b>{[form.make, form.model].filter(Boolean).join(" ") || "—"}</b>
                    </div>
                    <div className="recap-row">
                      <span>Контакты</span>
                      <b>
                        {form.name}
                        {form.name && form.phone ? ", " : ""}
                        {form.phone}
                      </b>
                    </div>
                    <div className="recap-row">
                      <span>Дата и время</span>
                      <b>
                        {form.date ? humanDate(form.date) : "—"}
                        {form.time ? `, ${form.time}` : ""}
                      </b>
                    </div>
                    <div className="recap-row">
                      <span>Способ связи</span>
                        <b>{channelLabel(form.channel)}</b>
                    </div>
                    {form.comment ? (
                      <div className="recap-row">
                        <span>Комментарий</span>
                        <b>{form.comment}</b>
                      </div>
                    ) : null}
                  </div>
                  <div className="booking-note">
                    <ShieldCheck size={16} />
                    <span>Мы не передаём контакты третьим лицам и не звоним без запроса.</span>
                  </div>
                </>
              ) : null}
            </div>

            {sendError ? (
              <p className="form-send-error" role="alert">
                {sendError}
              </p>
            ) : null}

            <div className={`modal-foot ${step > 0 ? "modal-foot--split" : ""}`}>
              {step > 0 ? (
                <button type="button" className="button button--outline" onClick={goBack} aria-label="Вернуться на предыдущий шаг">
                  <ChevronLeft size={16} />
                  Назад
                </button>
              ) : null}
              {isLastStep && site.booking.automation.whatsapp ? (
                /* Кнопка-ссылка, а не window.open: настоящий клик по
                   <a target="_blank"> браузер не считает всплывающим окном,
                   поэтому чат открывается всегда. Навигацию не отменяем — она и
                   открывает WhatsApp; гасим её только если заявка не прошла
                   проверку, иначе в чат уйдёт неполный текст. */
                <a
                  className="button button--accent"
                  href={requestUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    if (!validate(step)) {
                      event.preventDefault();
                      window.requestAnimationFrame(() => summaryRef.current?.focus());
                      return;
                    }
                    void submit();
                  }}
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  {site.booking.submitLabel}
                </a>
              ) : (
                <button type="button" className="button button--accent" onClick={goNext} disabled={sending}>
                  {sending ? (
                    <>
                      <DotMatrix label="Отправляем" />
                    </>
                  ) : (
                    <>
                      {isLastStep ? site.booking.submitLabel : site.booking.continueLabel}
                      {isLastStep ? <ArrowUpRight size={16} /> : <ChevronRight size={16} />}
                    </>
                  )}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="success-state">
            <div className="success-mark">
              <Check size={28} />
            </div>
            <span className="eyebrow">{site.booking.sentLabel}</span>
            <h2>
              <RichText text={site.booking.successTitle} />
            </h2>
            {form.date ? (
              <p className="success-when">
                <CalendarDays size={16} aria-hidden="true" />
                <span>
                  {humanDate(form.date)}
                  {form.time ? `, ${form.time}` : ""} · {site.location.address}
                </span>
              </p>
            ) : null}
            <p>{site.booking.successText.replace("{phone}", form.phone).replace("{channel}", channelShort(form.channel))}</p>
            <div className="success-actions">
              <a className="button button--accent" href={whatsappUrl(request)} target="_blank" rel="noreferrer">
                <MessageCircle size={16} aria-hidden="true" />
                Открыть WhatsApp
              </a>
              {form.date && form.time ? (
                <button type="button" className="button button--outline" onClick={saveToCalendar}>
                  <CalendarDays size={16} aria-hidden="true" />
                  В календарь
                </button>
              ) : null}
            </div>
            <button type="button" className="button-link" onClick={copyRequest}>
              {copied ? "Текст заявки скопирован" : "Скопировать текст заявки"}
            </button>
            <button type="button" className="button button--outline" onClick={onClose}>
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- page */

export default function Home() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingService, setBookingService] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openService, setOpenService] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  useRevealOnScroll();

  const openBooking = useCallback((service = "") => {
    setBookingService(service);
    setMenuOpen(false);
    setBookingOpen(true);
  }, []);

  /* Прямая ссылка на запись: /?booking=Тонировка (или /#booking) открывает
     форму сразу, с уже выбранной услугой. Такую ссылку студия может бросить
     клиенту в мессенджер — тому останется заполнить контакты. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("booking") ?? params.get("service") ?? "";
    if (requested || window.location.hash === "#booking") openBooking(requested);
  }, [openBooking]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Подсветка текущего раздела. Наблюдаем узкую полосу в середине экрана, так
     что активным в каждый момент оказывается ровно один раздел. */
  useEffect(() => {
    const targets = NAV_ITEMS.map(([id]) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (!targets.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const current = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (current) setActiveSection(current.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 900) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    const target = document.getElementById(id === "top" ? "main" : id);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="site-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById("main");
          main?.focus();
          main?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      >
        Перейти к содержанию
      </a>

      <header className={`site-header ${scrolled ? "site-header--scrolled" : ""}`}>
        <a
          href="#top"
          className="brand"
          aria-label={`${site.brand.full} — в начало страницы`}
          onClick={(e) => {
            e.preventDefault();
            scrollTo("top");
          }}
        >
          <span>{site.brand.monogram}</span>
          <small>{site.brand.suffix}</small>
        </a>

        <nav className={menuOpen ? "nav-links nav-links--open" : "nav-links"} aria-label="Основная навигация">
          {NAV_ITEMS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className={activeSection === id ? "nav-link nav-link--active" : "nav-link"}
              aria-current={activeSection === id ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                scrollTo(id);
              }}
            >
              {label}
            </a>
          ))}
          <div className="nav-contact">
            <a href={PHONE_HREF}>
              <Phone size={14} aria-hidden="true" /> {PHONE_DISPLAY}
            </a>
            <a href={CONTACT_LINKS.address} target="_blank" rel="noreferrer">
              <MapPin size={14} aria-hidden="true" /> {CITY}, {ADDRESS}
            </a>
          </div>
        </nav>

        <div className="header-actions">
          <span className="header-phone">{PHONE_DISPLAY}</span>
          <button type="button" className="header-cta" onClick={() => openBooking()}>
            Записаться <ArrowUpRight size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="menu-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {menuOpen ? <div className="nav-scrim nav-scrim--open" onClick={() => setMenuOpen(false)} role="presentation" /> : null}

      {/* tabIndex нужен, чтобы переход по ссылке «Перейти к содержанию» переносил
          фокус в основной контент, а не оставлял его в шапке */}
      <main id="main" tabIndex={-1}>
        <section className="hero">
          <Picture
            className="hero-media"
            priority
            mobile={art(`${site.hero.photo}-mobile`, [480, 800, 1200], "100vw")}
            desktop={art(`${site.hero.photo}-wide`, [1280, 1920], "100vw")}
            alt={`${site.hero.alt}, ${CITY}`}
          />
          <div className="hero-overlay" />
          <div className="hero-content">
            <div className="hero-kicker">
              <span>{site.hero.kicker}</span>
              <span>
                {CITY} · {HOURS}
              </span>
            </div>
            <h1>
              <RichText text={site.hero.title} />
            </h1>
            <div className="hero-bottom">
              <p>{site.hero.lead}</p>
              <div className="hero-actions">
                <button type="button" className="button button--accent" onClick={() => openBooking()}>
                  {site.hero.ctaPrimary} <ArrowUpRight size={16} aria-hidden="true" />
                </button>
                <button type="button" className="button button--outline button--ghost-light" onClick={() => scrollTo("services")}>
                  {site.hero.ctaSecondary}
                </button>
              </div>
            </div>
            <div className="hero-meta">
              {site.hero.stats.map((stat) => (
                <span key={stat.label}>
                  <strong>{stat.value}</strong> {stat.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="trust-bar" aria-label="Ключевые преимущества">
          <span className="eyebrow">{site.trust.eyebrow}</span>
          {/* Duplicated once so the marquee can loop seamlessly at -50%.
              The copy is hidden from assistive tech to avoid reading it twice. */}
          <div className="trust-marquee" aria-hidden="true">
            {[0, 1].map((copy) => (
              <div className="trust-marquee-run" key={copy}>
                {site.trust.items.map((item) => (
                  <span className="trust-item" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div className="trust-static">
            {site.trust.items.slice(0, 4).map((item) => (
              <span className="trust-item" key={item}>
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="section services-section" id="services">
          <div className="container">
            <SectionHeading kicker={site.services.kicker} title={<Em text={site.services.title} />} copy={site.services.copy} />
            <div className="services-grid" style={{ "--services-cols": gridColumns(services.length) } as React.CSSProperties}>
              {services.map((service, i) => {
                const isOpen = openService === service.title;
                return (
                  <article
                    className={`service-card reveal ${isOpen ? "service-card--open" : ""}`}
                    style={{ "--d": `${Math.min(i, 4) * 70}ms` } as React.CSSProperties}
                    key={service.title}
                  >
                    <button
                      type="button"
                      className="service-card__button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenService(isOpen ? null : service.title)}
                    >
                      <div className="service-image">
                        <Picture
                          mobile={art(`${service.photo}-card`, [480, 800], "(max-width: 899px) calc(100vw - 40px)")}
                          desktop={art(`${service.photo}-portrait`, [420, 760], "33vw")}
                          alt={`${service.title} — ${service.note}`}
                        />
                        <span className="service-no">{String(i + 1).padStart(2, "0")}</span>
                        <span className="service-arrow" aria-hidden="true">
                          <ArrowUpRight size={18} />
                        </span>
                      </div>
                      <div className="service-meta">
                        <div>
                          <h3>{service.title}</h3>
                          <p>{service.note}</p>
                        </div>
                        <strong>{service.price}</strong>
                      </div>
                    </button>
                    <div className="service-detail">
                      <div className="service-detail-inner">
                        <p>{service.detail}</p>
                        <button type="button" className="text-link" onClick={() => openBooking(service.title)}>
                          Записаться на «{service.title}» <ArrowUpRight size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="split-feature">
          <div className="split-image">
            <Picture
              mobile={art(`${site.approach.photo}-card`, [480, 800], "100vw")}
              desktop={art(`${site.approach.photo}-tall`, [480, 800], "50vw")}
              alt={`${site.approach.alt}, ${CITY}`}
            />
          </div>
          <div className="split-copy">
            <span className="eyebrow">{site.approach.eyebrow}</span>
            <h2>
              <Em text={site.approach.title} />
            </h2>
            <p>{site.approach.text}</p>
            <div className="feature-list">
              {site.approach.points.map((point, i) => {
                const Icon = APPROACH_ICONS[i % APPROACH_ICONS.length];
                return (
                  <div key={point}>
                    <BoilIcon>
                      <Icon size={18} aria-hidden="true" />
                    </BoilIcon>
                    <span>{point}</span>
                  </div>
                );
              })}
            </div>
            <button type="button" className="text-link" onClick={() => scrollTo("process")}>
              {site.approach.linkLabel} <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          </div>
        </section>


        <section className="section work-section" id="work">
          <div className="container">
            <div className="work-head">
              <SectionHeading kicker={site.works.kicker} title={<Em text={site.works.title} />} />
              <button type="button" className="text-link" onClick={() => openBooking()}>
                {site.works.cta} <ArrowUpRight size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="work-grid">
              {portfolio.map((item, i) => (
                <article
                  className={`work-card work-card--${i} work-card--${item.variant} reveal`}
                  style={{ "--d": `${Math.min(i, 3) * 80}ms` } as React.CSSProperties}
                  key={item.label}
                >
                  <Picture
                    mobile={art(`${item.photo}-tall`, [480, 800], "(max-width: 899px) 100vw")}
                    desktop={art(`${item.photo}-portrait`, [420, 760], "(min-width: 900px) 50vw, 100vw")}
                    alt={`${item.label} — ${item.service}`}
                  />
                  <div className="work-card-overlay">
                    <span>{item.label}</span>
                    <small>{item.service}</small>
                    <strong>{item.result}</strong>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section packages-section" id="packages">
          <div className="container">
            <SectionHeading kicker={site.packages.kicker} title={<Em text={site.packages.title} />} copy={site.packages.copy} />
            <div className="packages-grid">
              {packages.map((pack, i) => (
                <article
                  className={`package-card reveal ${i === 1 ? "package-card--featured" : ""}`}
                  style={{ "--d": `${i * 90}ms` } as React.CSSProperties}
                  key={pack.name}
                >
                  {i === 1 && site.packages.badge ? <span className="package-badge">{site.packages.badge}</span> : null}
                  <span className="eyebrow">0{i + 1} / {pack.name}</span>
                  <h3>{pack.title}</h3>
                  <p>{pack.name}</p>
                  <div className="package-price">{pack.price}</div>
                  <ul>
                    {pack.items.map((item) => (
                      <li key={item}>
                        <Check size={15} aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="button button--outline" onClick={() => openBooking()}>
                    {pack.cta}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section reviews-section" id="reviews">
          <div className="container">
            <div className="reviews-head">
              <span className="eyebrow">{site.reviews.eyebrow}</span>
              <h2>
                <Em text={site.reviews.title} />
              </h2>
              <div className="reviews-rating">
                <Stars />
                <span>{site.reviews.rating}</span>
              </div>
            </div>
            <div className="reviews-grid">
              {reviews.map((review, i) => (
                <article className="review-card reveal" style={{ "--d": `${i * 80}ms` } as React.CSSProperties} key={review.car}>
                  <Stars />
                  <blockquote>{review.text}</blockquote>
                  <div className="review-author">
                    <strong>{review.name}</strong>
                    <span>{review.car}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="process-band" id="process">
          <div className="container">
            <div className="process-intro">
              <span className="eyebrow">{site.process.eyebrow}</span>
              <h2>
                <Em text={site.process.title} />
              </h2>
              <p>{site.process.copy}</p>
            </div>
            <ol className="process-steps">
              {process.map((item, i) => (
                <li className="process-step reveal" style={{ "--d": `${i * 60}ms` } as React.CSSProperties} key={item.title}>
                  <span aria-hidden="true">0{i + 1}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section brands-section">
          <div className="container">
            <div className="brands-layout">
              <SectionHeading kicker={site.brands.kicker} title={<Em text={site.brands.title} />} copy={site.brands.copy} />
              <div className="brands-list">
                {brands.map((brand) => (
                  <span key={brand}>{brand}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="final-cta">
          <Picture
            className="final-media"
            mobile={art(`${site.finalCta.photo}-mobile`, [480, 800, 1200], "100vw")}
            desktop={art(`${site.finalCta.photo}-wide`, [1280, 1920], "100vw")}
            alt={`${site.finalCta.alt}, ${CITY}`}
          />
          <div className="final-cta-overlay" />
          <div className="final-content">
            <span className="eyebrow">{site.finalCta.eyebrow}</span>
            <h2>
              <Em text={site.finalCta.title} />
            </h2>
            <button type="button" className="button button--accent" onClick={() => openBooking()}>
              {site.finalCta.cta} <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="section contacts-section" id="contacts" aria-labelledby="contacts-title">
          <div className="container">
            <div className="contacts-layout">
              <div className="contacts-copy">
                <span className="eyebrow">{site.contacts.eyebrow}</span>
                <h2 id="contacts-title">
                  <Em text={site.contacts.title} />
                </h2>
                <p>{site.contacts.text}</p>

                <ul className="contacts-list">
                  <li>
                    <span className="contacts-list__icon">
                      <MapPin size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{site.contacts.labels.address}</strong>
                      <span>
                        {CITY}, {ADDRESS}
                      </span>
                    </div>
                  </li>
                  <li>
                    <span className="contacts-list__icon">
                      <Clock3 size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{site.contacts.labels.hours}</strong>
                      <span>{HOURS}</span>
                    </div>
                  </li>
                  <li>
                    <span className="contacts-list__icon">
                      <Phone size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{site.contacts.labels.phone}</strong>
                      <a href={PHONE_HREF}>{PHONE_DISPLAY}</a>
                    </div>
                  </li>
                  <li>
                    <span className="contacts-list__icon">
                      <MessageCircle size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{site.contacts.labels.messengers}</strong>
                      <span className="contacts-list__links">
                        <a href={CONTACT_LINKS.whatsapp} target="_blank" rel="noreferrer">
                          WhatsApp
                        </a>
                        <a href={CONTACT_LINKS.instagram} target="_blank" rel="noreferrer">
                          Instagram
                        </a>
                      </span>
                    </div>
                  </li>
                </ul>

                <button type="button" className="button button--accent" onClick={() => openBooking()}>
                  {site.contacts.cta} <ArrowUpRight size={16} aria-hidden="true" />
                </button>
              </div>

              <ContactMap />
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-top">
          <a href="#top" className="brand" onClick={(e) => { e.preventDefault(); scrollTo("top"); }}>
            <span>{site.brand.monogram}</span>
            <small>{site.brand.suffix}</small>
          </a>
          <p>
            {site.footer.tagline[0]}
            <br />
            {site.footer.tagline[1]}
          </p>
          <div className="footer-cta">
            <span>{site.footer.question}</span>
            <a href={PHONE_HREF}>
              <Phone size={14} aria-hidden="true" /> {PHONE_DISPLAY}
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <div>
            <span>
              {CITY}, {ADDRESS}
            </span>
            <span>{HOURS}</span>
          </div>
          <div className="footer-social">
            <a href={CONTACT_LINKS.whatsapp} target="_blank" rel="noreferrer">
              <MessageCircle size={16} aria-hidden="true" /> WhatsApp
            </a>
            <a href={CONTACT_LINKS.instagram} target="_blank" rel="noreferrer">
              <Instagram size={16} aria-hidden="true" /> Instagram
            </a>
          </div>
          <span>
            © {new Date().getFullYear()} {site.footer.copyrightOwner}
          </span>
        </div>
      </footer>

      <BookingSheet open={bookingOpen} onClose={() => setBookingOpen(false)} initialService={bookingService} />
    </div>
  );
}

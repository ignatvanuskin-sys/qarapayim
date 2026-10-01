/* ============================================================================
   ЧИСТЫЕ ФУНКЦИИ ЗАПИСИ — даты, слоты, телефон, файл календаря.

   Вынесены из pages/Home.tsx, потому что это самая ошибкоопасная часть формы
   и её нужно проверять тестом, а не глазами в браузере: `node scripts/test-booking.mjs`.

   Здесь нет ни React, ни DOM — только расчёты. Всё, что зависит от браузера
   (localStorage, скачивание файла, fetch), осталось в компоненте.
   ========================================================================== */
/* Расширение в импорте указано намеренно: тогда модуль читается и сборкой
   (Vite), и обычным `node scripts/test-booking.mjs` — Node импортирует .ts
   только по явному пути. tsconfig разрешает это (allowImportingTsExtensions). */
import { site } from "../site.config.ts";

/* ------------------------------------------------------------- дата и время */

/*
 * Даты считаем в местном времени и только через эти функции.
 * `new Date().toISOString().slice(0, 10)` для календарных дат использовать
 * нельзя: в UTC+5 после 19:00 он отдаёт уже завтрашний день, и «сегодня»
 * пропадает из выбора, а до 05:00 — вчерашний, и записаться можно в прошлое.
 */
export const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];
const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

/** «2026-10-06» → «6 октября, вторник» */
export function humanDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}, ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`;
}

/** «2026-10-06» → «6 окт, вт» — для чипов быстрого выбора даты. */
export function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1].slice(0, 3)}, ${WEEKDAYS_SHORT[new Date(y, m - 1, d).getDay()]}`;
}

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/**
 * Слоты приёма на дату: сетка из настроек, без тех, что уже прошли.
 * `leadHours` — за сколько часов до визита запись ещё открыта: «через час»
 * записаться нельзя, машину нужно успеть принять и поставить в бокс.
 */
export function slotList(dateISO: string, now: Date) {
  const { from, to, stepMinutes, leadHours } = site.booking.slots;
  const out: string[] = [];
  const [y, m, d] = dateISO.split("-").map(Number);
  if (!y || !m || !d) return out;
  const earliest = now.getTime() + leadHours * 3600_000;

  for (let minutes = from * 60; minutes <= to * 60; minutes += stepMinutes) {
    const at = new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
    if (at.getTime() < earliest) continue;
    out.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
  }
  return out;
}

/* ---------------------------------------------------------------- телефон */

/**
 * Цифры национальной части номера (без кода страны), максимум десять.
 *
 * Маска применяется на каждое нажатие, то есть ей на вход приходит уже
 * отформатированное значение — с префиксом «+7 (». Цифры этого префикса в
 * номер не входят, поэтому «+7» отрезается от СЫРОЙ строки, а не от
 * результата: иначе после первого же нажатия семёрка из «+7» попадала в
 * номер, всё съезжало на разряд, и «708…» превращалось в «082…».
 */
export function phoneNational(raw: string) {
  const trimmed = raw.trimStart();
  let digits = (trimmed.startsWith("+7") ? trimmed.slice(2) : trimmed).replace(/\D/g, "");
  if (!digits) return "";
  /* Национальный номер в Казахстане не начинается с восьмёрки: это тот же код
     страны, что и +7, только в старой записи. Убираем её сразу, а не после
     одиннадцатой цифры: иначе «8708…» до самого конца выглядит как номер,
     начинающийся на 870, и промежуточное значение занимает все 18 символов —
     тогда поле упирается в maxLength и последняя цифра просто не набирается. */
  if (digits[0] === "8") digits = digits.slice(1);
  /* Осталось больше десяти цифр — код страны набрали руками: «77082768933»,
     «+7 708 276 89 33». Первая цифра — код, её тоже отбрасываем. */
  if (digits.length > 10) digits = digits.slice(1, 11);
  return digits.slice(0, 10);
}

/** Приводим ввод к «+7 (708) 276-89-33». */
export function formatPhone(raw: string) {
  const national = phoneNational(raw);
  if (!national) return "";
  let out = "+7";
  if (national.length) out += ` (${national.slice(0, 3)}`;
  if (national.length >= 3) out += ")";
  if (national.length > 3) out += ` ${national.slice(3, 6)}`;
  if (national.length > 6) out += `-${national.slice(6, 8)}`;
  if (national.length > 8) out += `-${national.slice(8, 10)}`;
  return out;
}

export const phoneDigits = (value: string) => value.replace(/\D/g, "");

/* ------------------------------------------------------- календарь (.ics) */

/** Строка даты для VEVENT: местное время без «Z» — тогда событие встанет
    на выбранный час в любом часовом поясе, а не сместится на 5 часов. */
export const icsStamp = (date: Date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}` +
  `T${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}00`;

/** Экранирование по RFC 5545: обратный слэш, перевод строки, запятая, «;». */
export const icsEscape = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

/** Файл календаря на выбранные дату и время — клиент забирает визит себе. */
export function buildIcs(dateISO: string, time: string, summary: string, description: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const start = new Date(y, m - 1, d, hh, mm);
  const end = new Date(start.getTime() + site.booking.automation.calendarHours * 3600_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Qarapayim Detailing//Booking//RU",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@${site.brand.full.toLowerCase().replace(/\s+/g, "-")}`,
    `DTSTAMP:${icsStamp(new Date())}Z`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `LOCATION:${icsEscape(`${site.location.city}, ${site.location.address}`)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `URL:${site.location.links.mapCard}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

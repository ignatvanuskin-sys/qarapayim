/* Проверка логики записи: маска телефона, сетка слотов, даты, файл календаря.
 *
 *   node scripts/test-booking.mjs
 *
 * Это те самые места, где ошибка не видна глазом: маска портит номер при
 * посимвольном наборе, а дата уезжает на сутки в UTC+5. Проверка идёт через
 * тот же модуль, что и форма (client/src/lib/booking.ts), поэтому расхождение
 * между тестом и сайтом невозможно.
 */
import assert from "node:assert/strict";
import { addDays, buildIcs, formatPhone, humanDate, localDate, phoneDigits, shortDate, slotList } from "../client/src/lib/booking.ts";

let passed = 0;
const ok = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (error) {
    console.log(`  FAIL ${name}\n       ${error.message}`);
    process.exitCode = 1;
  }
};

/* -------------------------------------------------------------- телефон */
/* Набор с клавиатуры: браузер дописывает символ в конец текущего значения,
   а маска пересчитывает его на каждое нажатие — ровно это и проверяем. */
const type = (chars) => {
  let value = "";
  for (const char of chars) value = formatPhone(value + char);
  return value;
};

console.log("\nмаска телефона (посимвольный набор)");
for (const input of ["7082768933", "87082768933", "77082768933", "+77082768933", "8 708 276 89 33"]) {
  ok(`набор «${input}» → +7 (708) 276-89-33`, () => {
    assert.equal(type(input), "+7 (708) 276-89-33");
  });
}

console.log("\nмаска телефона (вставка из буфера)");
for (const input of ["+7 708 276 89 33", "+77082768933", "87082768933", "77082768933", "7082768933"]) {
  ok(`вставка «${input}»`, () => {
    assert.equal(formatPhone(input), "+7 (708) 276-89-33");
  });
}

ok("«8708…» разбирается по ходу набора, а не в самом конце", () => {
  /* Восьмёрка — код страны, её надо снять сразу. Если тянуть нормализацию до
     одиннадцатой цифры, промежуточное значение вырастает до всех 18 символов
     («+7 (870) 827-68-93»), поле упирается в maxLength и последняя цифра не
     набирается — номер так и остаётся неправильным. */
  assert.equal(type("87082"), "+7 (708) 2");
});

ok("промежуточные значения не длиннее 18 символов", () => {
  for (const input of ["7082768933", "87082768933", "77082768933", "8 708 276 89 33"]) {
    let value = "";
    for (const char of input) {
      value = formatPhone(value + char);
      assert.ok(value.length <= 18, `«${input}»: «${value}» длиной ${value.length}`);
    }
  }
});

ok("пустое поле остаётся пустым", () => assert.equal(formatPhone(""), ""));
ok("в номере 11 цифр для проверки формы", () => assert.equal(phoneDigits(formatPhone("7082768933")).length, 11));
ok("недобранный номер не проходит проверку", () => assert.equal(phoneDigits(formatPhone("708276")).length < 11, true));

/* --------------------------------------------------------------- даты */
console.log("\nдаты");
ok("локальная дата не съезжает на сутки в UTC+5", () => {
  /* 2 октября, 02:00 по местному: toISOString() отдал бы 1 октября. */
  assert.equal(localDate(new Date(2026, 9, 2, 2, 0)), "2026-10-02");
});
ok("humanDate разбирает дату по-русски", () => assert.equal(humanDate("2026-10-06"), "6 октября, вторник"));
ok("shortDate даёт короткую подпись", () => assert.equal(shortDate("2026-10-06"), "6 окт, вт"));
ok("addDays переходит через границу месяца", () => assert.equal(localDate(addDays(new Date(2026, 9, 31, 12, 0), 1)), "2026-11-01"));

/* -------------------------------------------------------------- слоты */
console.log("\nслоты");
const slots = slotList("2026-10-02", new Date(2026, 9, 1, 23, 0));
ok("на будущий день полная сетка 10:00–20:00", () => {
  assert.equal(slots.length, 11);
  assert.equal(slots[0], "10:00");
  assert.equal(slots.at(-1), "20:00");
});
ok("час закрытия студии в записи не предлагается", () => assert.equal(slots.includes("21:00"), false));
ok("на сегодня слоты ближе leadHours не показываются", () => {
  /* 12:00, запас 2 часа → первый доступный слот 14:00. */
  const today = slotList("2026-10-01", new Date(2026, 9, 1, 12, 0));
  assert.equal(today[0], "14:00");
  assert.equal(today.includes("13:00"), false);
});
ok("после закрытия на сегодня слотов нет", () => {
  assert.deepEqual(slotList("2026-10-01", new Date(2026, 9, 1, 22, 51)), []);
});
ok("на прошедший день слотов нет", () => assert.deepEqual(slotList("2026-09-30", new Date(2026, 9, 1, 10, 0)), []));
ok("на кривой дате слотов нет", () => assert.deepEqual(slotList("", new Date()), []));

/* ----------------------------------------------------------- календарь */
console.log("\nфайл календаря");
const ics = buildIcs("2026-10-06", "10:00", "Qarapayim Detailing — Тонировка", "Заявка, строка;\nвторая строка");
ok("время события — местное, без Z", () => {
  assert.match(ics, /DTSTART:20261006T100000\r\n/);
});
ok("конец события — через calendarHours из конфига", () => assert.match(ics, /DTEND:20261006T120000\r\n/));
ok("описание экранировано по RFC 5545", () => {
  assert.match(ics, /DESCRIPTION:Заявка\\, строка\\;\\nвторая строка/);
});
ok("структура VCALENDAR на месте", () => {
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR$/);
});

console.log(`\nпройдено проверок: ${passed}`);

/**
 * Dates as the guide counts with them: whole years, whole days, and the
 * birth date inside a personnummer (story 086).
 *
 * Everything is `YYYY-MM-DD` text and local calendar days — no clock, no
 * timezone. The arithmetic goes through `Date.UTC` only so that a day is
 * always 86 400 000 ms; nothing here ever asks what time it is except
 * `todayIso`, and the engine asks that once per run.
 */

/**
 * `Date.parse` is not enough on its own.
 *
 * It accepts "2026-02-31" and quietly rolls it to the 3rd of March, so an
 * impossible day would be stored as a different real one. Building the date and
 * comparing it back to what was written is what catches that — and it is the
 * case a regex over the shape lets through, which is why a date field is not a
 * text field with a pattern.
 */
export function isRealDate(value: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!parts) {
    return false;
  }

  const made = new Date(
    Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])),
  );

  return !Number.isNaN(made.getTime()) && made.toISOString().slice(0, 10) === value;
}

/**
 * The visitor's local calendar decides what "today" is — deliberately not
 * UTC, because the person answering at 00:30 in Sweden is asked about *their*
 * yesterday, not the server's.
 */
export function todayIso(now = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The variable the engine stamps with today's date; `{{idag}}` in a text. */
export const TODAY_VARIABLE = "idag";

function utcDay(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
}

/** Whole days from `from` to `till`; negative when `till` is before `from`. */
export function daysBetween(from: string, till: string): number {
  return Math.round((utcDay(till) - utcDay(from)) / 86_400_000);
}

/**
 * Whole years lived on `today`. A birthday is reached when the month-day of
 * today is at or past the birth's, compared as text — which also settles the
 * 29th of February: in a common year it comes on the 1st of March.
 */
export function ageOn(birth: string, today: string): number {
  const years = Number(today.slice(0, 4)) - Number(birth.slice(0, 4));
  return today.slice(5) < birth.slice(5) ? years - 1 : years;
}

/**
 * The birth date a personnummer carries, or null when the value is not one.
 *
 * Twelve digits say the century themselves. Ten digits do not, and the
 * separator decides as Skatteverket does: `-` (or none) means under a hundred
 * years old on `today`, `+` means a hundred or more. A samordningsnummer has
 * sixty added to the day, and is read back as the day it stands for. Only the
 * shape is checked here — the check digit is the format's business, and a
 * number that passed the field already passed it.
 */
export function birthDateOf(value: string, today: string): string | null {
  const trimmed = value.trim();
  const match = /^(\d{2})?(\d{2})(\d{2})(\d{2})([-+])?\d{4}$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const [, century, yy, mm, rawDd, separator] = match;
  const dd = Number(rawDd) > 60 ? String(Number(rawDd) - 60).padStart(2, "0") : rawDd;
  let year: string;

  if (century) {
    year = `${century}${yy}`;
  } else {
    // The latest century that keeps the person under a hundred; `+` then
    // steps back one more.
    const thisYear = Number(today.slice(0, 4));
    let full = Math.floor(thisYear / 100) * 100 + Number(yy);
    if (full > thisYear) full -= 100;
    if (separator === "+") full -= 100;
    year = String(full);
  }

  const iso = `${year}-${mm}-${dd}`;

  return isRealDate(iso) ? iso : null;
}

/**
 * Whether an answer is a date, and whether it is inside the allowed range.
 *
 * One function because there are two callers — a field on a page and a step
 * standing on its own — and two copies of a rule is how they drift. Returns a
 * **ui-strings key** or null, the way `format-validators` does, so no text is
 * decided here.
 *
 * Empty passes: "must be answered" is a separate question with a separate
 * message.
 */

import { answerText, readPath, type Answers } from "./answer-values";
import { isRealDate, TODAY_VARIABLE, todayIso } from "./date-math";

export interface DateError {
  key: string;
  values?: Record<string, string>;
}

/**
 * The variable a bound points at — `{{från}}` gives "från" — or null for a
 * fixed date and for a word like "idag".
 *
 * Story 087: a period has no fixed lower bound, the bound is the other field.
 * Same braces as a template, so the editor's variable button writes it and a
 * redaktör who has seen `{{namn}}` in a heading reads it without being told.
 */
export function dateBoundVariable(bound: string | undefined): string | null {
  const match = /^{{\s*([^{}]+?)\s*}}$/.exec(bound?.trim() ?? "");
  return match ? match[1] : null;
}

/**
 * The bound a graph wrote, as a date the day it is read.
 *
 * Story 044: "När märkte du felet?" cannot be answered with tomorrow, and a
 * fixed ISO string cannot point at a moving day — the example guide wrote
 * `max: "2030-12-31"` because that was the closest "today" that could be
 * written. The word is stored as the redaktör typed it; only the reading
 * resolves it, so a guide saved in August does not carry August around.
 *
 * The resident's local calendar decides what "today" is — deliberately not
 * UTC, because the person answering at 00:30 in Sweden is asked about *their*
 * yesterday, not the server's.
 */
export function resolveDateBound(
  bound: string | undefined,
  answers?: Answers,
): string | undefined {
  const trimmed = bound?.trim();

  if (!trimmed) {
    return undefined;
  }

  /*
   * A variable bound is the visitor's own answer. Empty is no bound — an
   * optional *från* left blank must not lock *till* (story 087, criterion 4).
   * An answer that is not a date is no bound either: the health check tells
   * the redaktör the variable is not a date; the visitor is never stopped by
   * a rule that cannot be read. Before this, "{{från}}" fell through to the
   * text comparison below and rejected every date, since "{" sorts after "9".
   */
  const variable = dateBoundVariable(trimmed);

  if (variable !== null) {
    const answer = answerText(readPath(answers ?? {}, variable)).trim();
    return isRealDate(answer) ? answer : undefined;
  }

  if (!["idag", "i dag", "today"].includes(trimmed.toLowerCase())) {
    return trimmed;
  }

  /*
   * The engine stamps `idag` into the answers (story 086), so a host that
   * set the viewer's today sees the same day here as in `days(flytt; idag)`.
   * Without answers — the editor's try-it field — the clock.
   */
  const stamped = answerText(readPath(answers ?? {}, TODAY_VARIABLE)).trim();

  return isRealDate(stamped) ? stamped : todayIso();
}

/**
 * `fieldLabels` names the field a bound came from, when it came from one.
 * "Ange ett datum tidigast 2026-03-01" is right for a fixed date and wrong for
 * a period: the visitor wrote that date themselves, one field up, so the
 * message names the field instead — *samma som eller efter Från*.
 */
export function validateDate(
  value: string,
  earliest?: string,
  latest?: string,
  fieldLabels: { earliest?: string; latest?: string } = {},
): DateError | null {
  const trimmed = value.trim();

  // Resolved here so every caller — the engine, the page fields — gets the
  // same "today" without knowing the word exists. Idempotent for fixed dates.
  earliest = resolveDateBound(earliest);
  latest = resolveDateBound(latest);

  if (trimmed === "") {
    return null;
  }

  if (!isRealDate(trimmed)) {
    return { key: "validation.date.invalid" };
  }

  /*
   * Compared as text. An ISO date sorts correctly that way, so there is no
   * parsing, no timezone and nothing to drift — which is the reason the answer
   * is stored as `YYYY-MM-DD` in the first place.
   */
  if (earliest && trimmed < earliest) {
    return fieldLabels.earliest
      ? { key: "validation.date.afterField", values: { field: fieldLabels.earliest } }
      : { key: "validation.date.min", values: { date: earliest } };
  }

  if (latest && trimmed > latest) {
    return fieldLabels.latest
      ? { key: "validation.date.beforeField", values: { field: fieldLabels.latest } }
      : { key: "validation.date.max", values: { date: latest } };
  }

  return null;
}

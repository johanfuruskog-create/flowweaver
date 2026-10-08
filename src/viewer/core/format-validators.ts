/**
 * What a formatted value is, asked of the registry.
 *
 * The checks themselves moved to `format-checks.ts` and each format registers
 * itself in `default-formats.ts`, so this file is now four questions put to one
 * place instead of four switches that had to be kept in step. A format used to
 * live in five: the validator, the shapes table, the canonical form, the
 * select's options and its error key.
 *
 * `regex` stays here rather than in the registry, because it is not a format —
 * it is the absence of one, with the author supplying the rule.
 */
import { getFormat } from "./format-registry";

import "./default-formats";


/**
 * Validates `value` against `format`. `pattern` is used when the format is
 * "regex". Returns a **ui-strings key** for the error (e.g.
 * "validation.format.email"), or null when the value is valid (or empty). The
 * caller localises the key via t()/chrome() — no text is hardcoded here.
 */
export function validateFormat(
  format: string | undefined,
  pattern: string | undefined,
  value: string
): string | null {
  if (!format || value.trim() === "") {
    return null;
  }

  if (format === "regex") {
    if (!pattern) return null;

    let regex: RegExp;

    try {
      regex = new RegExp(pattern);
    } catch {
      // A pattern nobody can compile is the author's fault, not the resident's:
      // refusing the answer would strand somebody over a typo they cannot see.
      return null;
    }

    return regex.test(value) ? null : "validation.format.pattern";
  }

  const registered = getFormat(format);

  /*
   * A format with no validator passes. That is the honest answer for an
   * identifier whose arithmetic nobody has written — it has a shape and no
   * check, which is what a pattern alone can promise.
   */
  return registered?.validate ? registered.validate(value) : null;
}

/** Digits only, with the century restored where the format implies one. */
export function canonicalFormat(format: string | undefined, value: string): string {
  const registered = getFormat(format);

  return registered?.canonical ? registered.canonical(value) : value;
}

/** The same value written the way it is printed on the card. */
export function displayFormat(format: string | undefined, value: string): string {
  const registered = getFormat(format);

  if (!registered?.pattern) {
    return value;
  }

  const canonical = canonicalFormat(format, value);
  const shaped = maskWithPattern(registered.pattern, canonical, canonical.length);
  const slots = [...registered.pattern].filter(
    (slot) => slot === "#" || slot === "A",
  ).length;
  const filled = [...shaped.value].filter((char) => /[\p{L}\d]/u.test(char)).length;

  /*
   * Only when it fills the shape. Half a personnummer dressed as a whole one
   * would say it was one — the mask is what helps somebody mid-typing, and this
   * is for a value that is finished.
   */
  return filled === slots ? shaped.value : value;
}

/**
 * A written shape, expressed as a pattern rather than as code.
 *
 * `#` takes a digit, `A` takes a letter, and every other character is a
 * separator put in for you. `########-####` is a Swedish personnummer,
 * `###-##-####` an American social security number, `AA ## ## ## A` a British
 * national insurance number — one interpreter, no line of code per country.
 *
 * ## What a pattern can and cannot say
 *
 * It says how a value is **written**. It says nothing about whether the value is
 * *real*: a personnummer's check digit, the date inside it, the ten zeros that
 * are the first thing anybody types. That knowledge is genuinely Swedish and
 * lives in the validators, which is why the named formats keep existing rather
 * than becoming three patterns and nothing else.
 *
 * So a foreign identifier gets a shape and, with `pattern`, a test of whether it
 * is possible — but not of whether it is genuine. That is more honest than
 * pretending, and a great deal better than the nothing it had before.
 */
export function maskWithPattern(
  pattern: string,
  value: string,
  caret: number,
): { value: string; caret: number } {
  const slots = [...pattern];
  const fits = (slot: string, char: string): boolean =>
    slot === "#" ? /\d/.test(char) : slot === "A" ? /\p{L}/u.test(char) : false;

  /*
   * Only what the pattern can hold, in the order it was typed.
   *
   * "What the pattern can hold" and not "letters and digits": a shape of nothing
   * but `#` has no room for a letter, so a letter is not a character that landed
   * in the wrong slot — it is a character with no slot at all. Keeping it and
   * dropping it later, mid-loop, is what scrambled the value:
   *
   *     "abc"                    → "b"
   *     "Personnummer: 19800223-7538" → "esnumr19-8002"
   *     "Anna Andersson"         → "naneso"
   *
   * The middle one is the ordinary case, not an edge: copying a personnummer out
   * of an email brings its label along, and what came back bore no resemblance to
   * what was pasted. Johan's rule settles it — a field with a settled shape takes
   * what the shape allows and nothing else — and it makes the space that already
   * worked principled rather than accidental.
   *
   * Separators the person typed themselves are dropped and put back by the
   * pattern, so pasting `19560328-1949` and typing it are the same thing.
   */
  const holds = (char: string): boolean =>
    slots.some((slot) => fits(slot, char));

  const typed = [...value].filter(holds);
  const before = [...value.slice(0, caret)].filter(holds).length;

  let written = "";
  let taken = 0;

  for (const slot of slots) {
    if (slot !== "#" && slot !== "A") {
      // A separator only appears once there is something after it to separate.
      if (taken < typed.length) written += slot;
      continue;
    }

    /*
     * Skip past whatever cannot go here, then place the first that can.
     *
     * A rejected character must not cost a slot: with the old loop each one
     * consumed the slot it failed, so `12ab345` into `AA-###` came out as
     * `a-345` — the two stray digits ate both letter slots and one letter never
     * got in. Dropping and re-checking in place keeps the shape's positions for
     * the characters that belong in them.
     *
     * Only reachable for a mixed shape now. In a pattern of nothing but `#` the
     * letters are gone before this loop begins.
     */
    while (typed[taken] !== undefined && !fits(slot, typed[taken]!)) {
      typed.splice(taken, 1);
    }

    if (typed[taken] === undefined) break;

    written += typed[taken]!;
    taken += 1;
  }

  // Back to the same character, wherever the separators landed.
  let seen = 0;
  let at = written.length;

  for (let i = 0; i < written.length; i += 1) {
    if (seen === before) {
      at = i;
      break;
    }
    if (/[\p{L}\d]/u.test(written[i]!)) seen += 1;
  }

  return { value: written, caret: at };
}

/**
 * The keyboard a shape asks for.
 *
 * Derived from the pattern rather than listed per format, because the pattern
 * already says it: `########-####` has nothing but digit slots, so a phone or a
 * tablet should open on digits. A list of format names would be a second copy of
 * that fact, and the first format somebody adds is the one nobody adds to the
 * list.
 *
 * Only when **every** slot is a digit. `AA ## ## ## A` — a British national
 * insurance number — needs letters, and a numeric keypad would leave somebody
 * hunting for the button that switches back.
 *
 * The separators are not a reason to widen it: the mask puts the hyphen in, so
 * nobody has to find one on the keyboard. That is the whole trade — a narrower
 * keyboard is only kind when the field fills in what it leaves out.
 */
export function keyboardFor(
  format: string | undefined,
  mask: string | undefined,
): string | undefined {
  // Formatets egen hint vinner: "telefon" vet att den är tel även utan mönster.
  const hinted = getFormat(format)?.inputMode;

  if (hinted) {
    return hinted;
  }

  const shape = mask ?? getFormat(format)?.pattern;

  if (!shape) {
    return undefined;
  }

  const slots = [...shape].filter((char) => char === "#" || char === "A");

  return slots.length > 0 && slots.every((slot) => slot === "#") ? "numeric" : undefined;
}

/**
 * Webbläsarens autofyll, ur formatet (story 051). Bara det formatet själv
 * deklarerat — ett fält utan format får ingenting, för en gissning som
 * fyller i fel uppgift är värre än ingen fyllning alls.
 */
export function autocompleteFor(format: string | undefined): string | undefined {
  return getFormat(format)?.autocomplete;
}

/**
 * An amount, grouped while it is being typed.
 *
 * Separate from `maskWithPattern` because a pattern is a fixed shape — twelve
 * slots for a personnummer — and an amount has no length to write down. The
 * groups also move as digits arrive: `1234` becomes `12 345` on the next press,
 * so every separator sits one place further along than it did.
 *
 * Johan's rule decides what comes out where: *the variables hold unformatted
 * digits, the way there holds formatted ones.* So this is only ever what the
 * field shows; `ungroup` is what is stored.
 *
 * `type="number"` cannot do this at all — a grouped amount is not a valid
 * number, so the browser reports an empty value, and there is no
 * `selectionStart` on a number input to put a caret back into. That is the whole
 * reason the field is text with `inputmode="decimal"`.
 *
 * ## Why the language decides what a separator means
 *
 * This function had a twin, `maskThousands`, which carried the rule below while
 * this one — the copy the viewer actually called — did not. In English a comma
 * **groups**, so `600,5` is six hundred thousand and five typed badly, not six
 * hundred point five. Reading the first comma or period as the decimal mark was
 * right in Swedish and wrong everywhere the two differ.
 *
 * Measured in an English guide, typing `12345` one key at a time: after four
 * digits the field held `1,234`; the fifth re-masked `1,2345`, read the comma
 * as a decimal, and left `1.2345` in the field and in `data-canonical`. Wrong by
 * a factor of ten thousand, and silent — `1.2345` is a perfectly good number.
 *
 * Swedish survived only by luck: its group separator is a non-breaking space,
 * which the digit filter throws away anyway. So the language that hid the fault
 * is the one language it could not happen in.
 *
 * The two are one function now. A rule that lives in one of two copies is a rule
 * the product does not have.
 */
export function maskGrouped(
  value: string,
  caret: number,
  locale: string,
): { value: string; caret: number } {
  const { group, decimal } = separators(locale);

  /*
   * A period is a decimal mark in Swedish too, as far as this field is
   * concerned. The language says comma, but a numeric keypad on a physical
   * keyboard offers a period, and eating somebody's decimal point because their
   * keyboard disagrees with their locale is unkind.
   *
   * The rule that holds in both directions: a character may act as the decimal
   * mark **unless it is this language's group separator**.
   */
  const decimalMarks = decimalMarksFor(locale);
  const kept = [...value].filter(
    (char, index) =>
      /\d/.test(char) || (char === "-" && index === 0) || decimalMarks.includes(char),
  );
  /** How many of the characters we keep sit before the caret. */
  const before = [...value]
    .slice(0, caret)
    .filter(
      (char, index) =>
        /\d/.test(char) || (char === "-" && index === 0) || decimalMarks.includes(char),
    ).length;

  const sign = kept[0] === "-" ? "-" : "";
  const body = kept.join("").replace(/^-/, "");
  const point = [...body].findIndex((char) => decimalMarks.includes(char));
  const strip = (part: string): string => part.replace(/[^\d]/g, "");
  const whole = strip(point === -1 ? body : body.slice(0, point));
  // Only the first one counts; the rest were mistypes and are dropped.
  const fraction = point === -1 ? null : strip(body.slice(point + 1));

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const shaped = sign + grouped + (fraction === null ? "" : decimal + fraction);

  /*
   * The caret is put back by counting, not by offsetting. Grouping inserts and
   * removes separators anywhere to the left of where somebody is typing, so an
   * offset from the old position lands in the wrong place as soon as a group
   * boundary moves.
   */
  let seen = 0;
  let at = shaped.length;

  for (let index = 0; index < shaped.length; index += 1) {
    if (seen === before) {
      at = index;
      break;
    }

    if (shaped[index] !== group) {
      seen += 1;
    }
  }

  return { value: shaped, caret: at };
}

/**
 * The same amount with nothing but the digits — what is stored and what any
 * later arithmetic reads.
 *
 * The decimal mark comes out as a period whatever it was typed as, because that
 * is what `Number` understands and what a `type="number"` field used to hand
 * over. Nothing downstream had to change.
 *
 * ## Why this needs the language too
 *
 * It decides what is **stored**, so getting it wrong is worse than getting the
 * display wrong. Without a locale it read every comma as a decimal mark, and a
 * stored `1234567` shown in an English guide as `1,234,567` was rewritten to
 * `1.234567` the moment the field mounted — before anybody typed anything. No
 * validation error, because the result is a valid number.
 *
 * The rule is the same one `maskGrouped` uses, from the same place: a character
 * marks decimals unless the language groups with it.
 */
export function ungroup(value: string, locale = "sv"): string {
  const decimalMarks = decimalMarksFor(locale);
  const sign = value.trim().startsWith("-") ? "-" : "";
  const rest = value.replace(/^\s*-/, "");
  const kept = [...rest].filter((char) => /\d/.test(char) || decimalMarks.includes(char));
  const point = kept.findIndex((char) => decimalMarks.includes(char));
  const digitsOnly = (part: string[]): string => part.filter((char) => /\d/.test(char)).join("");

  return point === -1
    ? sign + digitsOnly(kept)
    : sign + digitsOnly(kept.slice(0, point)) + "." + digitsOnly(kept.slice(point + 1));
}

/**
 * The same shape, applied to something half-typed.
 *
 * A lookup in the registry, so a format brought by a pack is masked exactly like
 * one that ships. The three Swedish shapes were hardcoded here and are patterns
 * in `default-formats.ts` now; every existing test kept passing through both
 * moves, which is what proved each of them equivalent.
 */
export function maskFormat(
  format: string | undefined,
  value: string,
  caret: number,
): { value: string; caret: number } {
  const pattern = getFormat(format)?.pattern;

  return pattern ? maskWithPattern(pattern, value, caret) : { value, caret };
}

/**
 * The characters a language groups and separates numbers with.
 *
 * Asked of the platform rather than kept in a table here. Swedish groups with a
 * non-breaking space and marks decimals with a comma; English groups with a
 * comma and marks decimals with a period — so a table of our own would be a
 * second, worse copy of something `Intl` already knows, and wrong for the first
 * language nobody thought of.
 */
/**
 * Which characters may mark decimals in a language.
 *
 * The rule in one place, because it is the whole of the fault it was written
 * from: a character marks decimals **unless the language groups with it**. In
 * English a comma groups; in Swedish a space does, so both `,` and `.` are safe
 * to read as decimals there.
 *
 * A period is always allowed where it does not group, whatever the language
 * says, because a numeric keypad offers one and eating the key somebody pressed
 * is unkind.
 */
function decimalMarksFor(locale: string): string[] {
  const { group, decimal } = separators(locale);

  return [decimal, ",", "."].filter(
    (mark, index, all) => mark !== group && all.indexOf(mark) === index,
  );
}

function separators(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.8);

  return {
    group: parts.find((part) => part.type === "group")?.value ?? "\u00a0",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ",",
  };
}

/**
 * The value a format can find inside something pasted.
 *
 * ## Why paste is not typing
 *
 * Typing arrives one character at a time and a label can never appear. A paste
 * is a whole string of unknown provenance, and people paste the line rather than
 * the value: `Personnummer: 19800223-7538` out of an email, `NI: AB123456C` out
 * of a letter. The label is part of what was copied because that is how copying
 * works.
 *
 * For a shape of nothing but digits the label is dropped by the mask itself —
 * letters have no slot. For a **mixed** shape they do: `NI` is two perfectly good
 * letters, and the field cannot tell a prefix from the number by looking at the
 * characters. `NI: AB123456C` came out as `NI 12 34 56 C`, which is a wrong
 * number rather than a refused one.
 *
 * ## How it is found
 *
 * By asking the format whether a candidate is genuine, which is the one thing a
 * shape cannot answer. Every window the width of the pattern is tried, and the
 * value is returned **only when exactly one of them validates**.
 *
 * The first version searched from the end, on the reasoning that a label stands
 * before its value. That is true of `NI: AB123456C` and false of
 * `AB123456C (utgången)`, so the direction was a guess dressed as a rule — and
 * the tests could not tell the two apart, which is how it was found. Refusing an
 * ambiguous paste is the only answer that is not a guess: two candidates mean we
 * do not know which was meant.
 *
 * That is why the answer is three-way and not a nullable string. `none` — the
 * format cannot judge authenticity (a template's own mask has a shape and no
 * opinion), or nothing validates — means: shape what was pasted, as before, and
 * let validation say what is wrong. `many` means two *genuine* values were
 * found, and the caller must refuse the paste and say why; for a personnummer
 * the second candidate is another person, and a wrong number is worse than a
 * refused one. The two answers shared a `null` once, and the caller shaped the
 * first twelve digits of an ambiguous paste — the refusal existed only in this
 * comment.
 */
export type PastedFind =
  | { outcome: "one"; value: string }
  | { outcome: "many" }
  | { outcome: "none" };

export function findInPasted(
  format: string | undefined,
  mask: string | undefined,
  text: string,
): PastedFind {
  const registration = getFormat(format);
  const pattern = mask ?? registration?.pattern;
  const validate = registration?.validate;

  if (!pattern || !validate) {
    return { outcome: "none" };
  }

  const slots = [...pattern].filter((slot) => slot === "#" || slot === "A");
  const holds = (char: string): boolean =>
    slots.some((slot) => (slot === "#" ? /\d/.test(char) : /\p{L}/u.test(char)));
  const usable = [...text].filter(holds);

  if (usable.length <= slots.length) {
    // Nothing to trim: whatever is there is all there is.
    return { outcome: "none" };
  }

  const found = new Set<string>();

  for (let start = 0; start + slots.length <= usable.length; start += 1) {
    const candidate = usable.slice(start, start + slots.length).join("");

    if (validate(candidate) === null) {
      found.add(candidate);
    }
  }

  if (found.size === 1) {
    return { outcome: "one", value: [...found][0]! };
  }

  return found.size === 0 ? { outcome: "none" } : { outcome: "many" };
}

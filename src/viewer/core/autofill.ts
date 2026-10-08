import { autocompleteFor } from "./format-validators";

/**
 * What a text field holds, in the browser's own words (story 110).
 *
 * Email, phone and postal code already carry a word through the format
 * registry — `autocompleteFor` reads it. Name and address have no format to
 * derive one from: a field titled "Namn" is text to a browser, so a phone
 * offers nothing, and those are the fields a visitor writes most often.
 *
 * ## Why a list and not a free text
 *
 * `autocomplete` is a closed vocabulary. A word outside it is ignored by every
 * browser, silently — the field looks configured and offers nothing — so an
 * editor typing their own would get no warning from anywhere. The list here is
 * the short end of the HTML vocabulary: the seven a guide actually asks for.
 * A word we never offered is `undefined` on the way out, which is also the
 * answer for an old guide that has no `autofill` key at all.
 *
 * ## Why it is chosen and never guessed
 *
 * Reading "Namn" off a title and concluding `name` works in Swedish and fails
 * in every language the same guide is translated into — and a wrong offer
 * (the visitor's street where their name goes) is worse than no offer. The
 * editor says what the field is; nothing infers it.
 */

/** The words the editor may choose between, in the order the form offers them. */
export const AUTOFILL_TOKENS = [
  "name",
  "given-name",
  "family-name",
  "street-address",
  "address-level2",
  "country-name",
  "organization",
] as const;

export type AutofillToken = (typeof AUTOFILL_TOKENS)[number];

/** The word a field's `autofill` names, or `undefined` when it names none. */
export function autofillToken(value: unknown): AutofillToken | undefined {
  return AUTOFILL_TOKENS.includes(value as AutofillToken)
    ? (value as AutofillToken)
    : undefined;
}

/**
 * The word a field actually gets, from the two places it can come from.
 *
 * The format's word first, the editor's choice after it: a format that already
 * says what the field is has said it, and a leftover choice from before the
 * format was set must not overrule it (story 110).
 *
 * Here, once, because the viewer had this expression written out **twice** — a
 * page field and a step of its own — and any check that wanted to ask the same
 * question would have made a third. One definition of "what word does this
 * field offer", read by everyone who needs the answer.
 *
 * `email`, `tel` and `postal-code` never appear in `AUTOFILL_TOKENS` on
 * purpose: their formats supply them, and a word with two sources is a word two
 * places can disagree about.
 */
export function autocompleteWordFor(
  format: unknown,
  autofill: unknown,
): string | undefined {
  return (
    autocompleteFor(typeof format === "string" ? format : undefined) ??
    autofillToken(autofill)
  );
}

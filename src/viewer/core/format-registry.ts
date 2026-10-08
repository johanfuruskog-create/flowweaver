/**
 * The formats a value can be asked to have — one place, extensible.
 *
 * ## Why a registry
 *
 * A format used to live in five places: the validator's switch, the shapes
 * table, the canonical switch, the select's options in the panel, and the key
 * for its error message. Adding one meant editing five files and remembering
 * all of them, which is the spread that ends with a format that validates but
 * has no shape, or has a shape nobody can pick.
 *
 * So a format registers itself with everything about it, the way a node type
 * does in `registerNodeType`. The Swedish ones are `default-formats.ts` — the
 * same shape as `default-node-types.ts`, and no more built in than any other
 * pack.
 *
 * ## Why this is what makes packs possible
 *
 * Not everyone needs Norwegian and Danish. With one registration per format, a
 * pack is a file a host imports:
 *
 * ```ts
 * import "flowweaver/format-packs/no";
 * ```
 *
 * The same form as `locale-packs/fi.ts`, which describes itself as the file a
 * host would write. Nothing here decides which countries are worth the trouble;
 * whoever needs one adds it.
 */

import { DEFAULT_UI_LOCALE, resolveText } from "./localized-text";

import type { LocalizedText } from "./localized-text";

export interface FormatRegistration {
  /**
   * What a redaktör picks in the panel.
   *
   * `LocalizedText`, like `messages` below and for the same reason: a pack
   * written for a Finnish site names its henkilötunnus in Finnish and English
   * alike. A bare string is still a valid `LocalizedText`, so a pack that
   * knows no language behaves exactly as before.
   */
  label: LocalizedText;

  /**
   * The written shape, as a pattern: `#` a digit, `A` a letter, anything else a
   * separator. Absent where there is no single form — an email address has
   * none, and a phone number has none without a country code.
   */
  pattern?: string;

  /**
   * What gets stored, given anything a person might type. Absent means the value
   * is kept as it was, which is right for an address and wrong for an identifier
   * whose separators are decoration.
   */
  canonical?: (value: string) => string;

  /**
   * The texts this format's own keys stand for.
   *
   * ## Why a pack carries its messages
   *
   * `validate` returns a key, and a key nobody has a text for renders **as the
   * key**: a resident who mistypes a National Insurance number would read
   * `validation.format.ni` on the screen — measured, not feared. It looks like a
   * program fault and says nothing about what is wrong.
   *
   * A pack cannot fill that gap through `registerLocale`, which replaces a whole
   * language rather than adding to one — deliberately, so that a half-merged
   * pack cannot be the thing nobody can debug. Replacing the host's Swedish to
   * add one error message would be a cure worse than the disease.
   *
   * So the message travels with the format that needs it. Same shape as the
   * canonical value carried beside a field: something already sitting there
   * cannot be forgotten by whoever resolves it next.
   *
   * Namespace the keys — `validation.format.<name>` — because these are consulted
   * globally and two packs claiming one key would be a fight nobody can see.
   */
  messages?: Record<string, LocalizedText>;

  /**
   * Returns a **ui-strings key** for the error, or null when the value is valid.
   * Absent means the shape is all we can check — honest for an identifier whose
   * arithmetic we have not written, and better than pretending.
   *
   * A pack that brings a validator must bring the string for its key too, or the
   * field will refuse an answer without saying why.
   */
  validate?: (value: string) => string | null;
  /*
   * Tangentbords- och autofyllhintar (story 051): formatet ÄR påståendet om
   * vad fältet innehåller — "telefon" betyder telefonnummer — så visaren
   * hämtar inputmode och autocomplete här i stället för att gissa på
   * rubriker. Frivilliga; sifferformer får numeric ur mönstret ändå.
   */
  inputMode?: string;
  autocomplete?: string;
}

const formats = new Map<string, FormatRegistration>();

export function registerFormat(name: string, registration: FormatRegistration): void {
  formats.set(name, registration);
}

export function unregisterFormat(name: string): void {
  formats.delete(name);
}

export function getFormat(name: string | undefined): FormatRegistration | undefined {
  return name ? formats.get(name) : undefined;
}

/**
 * The text a registered format gives one of its own keys, if any does.
 *
 * Consulted last, after the host's own locale and the built-in table, so a pack
 * can never shadow a string we ship or one a host chose to override.
 */
export function formatMessage(key: string): LocalizedText | undefined {
  for (const registration of formats.values()) {
    const text = registration.messages?.[key];

    if (text !== undefined) {
      return text;
    }
  }

  return undefined;
}

/**
 * Every registered format, for the panel's own list.
 *
 * The label comes back resolved rather than as its map, because the caller is
 * a `<select>` that can only show one string. The default is the editor's
 * default language — the panel around this list is on the postponed editor
 * i18n axis, and when that lifts, the panel passes its own locale here.
 */
export function listFormats(locale?: string): Array<{ name: string; label: string }> {
  return [...formats].map(([name, registration]) => ({
    name,
    label: resolveText(registration.label, locale ?? DEFAULT_UI_LOCALE),
  }));
}

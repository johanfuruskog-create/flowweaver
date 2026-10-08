import {
  VIEWER_STRINGS,
  builtInString,
  isViewerString,
} from "../localization/built-in-strings";
import { formatMessage } from "./format-registry";
import { registeredText } from "../localization/registry";
import { DEFAULT_UI_LOCALE, resolveText } from "./localized-text";
import type { LocalizedText } from "./localized-text";

/**
 * Lookup of fixed UI strings (chrome) — buttons, port names, validation texts.
 * Distinct from *content* (question text, options, results), which the editor
 * authors and which lives in LocalizedText on the node data.
 *
 * The texts themselves live in `src/localization/`. What lives here is only the
 * order they are looked up in, and that order is story 010's answer to whose
 * text it is:
 *
 * 1. **the guide's own** — this guide's wording, the most specific
 * 2. **the host's registered pack** — the organisation's, same in every guide
 * 3. **the package's built-in** — Swedish and English, always present
 *
 * Step 1 applies to viewer keys only. The tool's own words are ours, and a
 * guide cannot reach them — see `built-in-strings.ts` and story 017.
 */

/** Replaces {name} placeholders in a UI string with the given values. */
export function interpolate(
  template: string,
  params: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole
  );
}

/**
 * Looks up a fixed UI string in the chosen locale. An unknown key is returned
 * unchanged.
 *
 * The host's registered pack outranks the built-in one: an organisation that
 * prefers "Fortsätt" over "Nästa" gets it without touching any guide.
 *
 * `sourceLocale` is the guide's own language, for the case where neither the
 * pack nor the built-in table has the requested one. Without it a Somali reader
 * of an English-authored guide met English questions and **Swedish buttons** —
 * the content fell back to the guide's source and the chrome to the module's,
 * and the two disagreed on the same screen. Found by running the language
 * example, not by a test.
 *
 * The editor never asks for anything but Swedish or English, so a registered
 * Arabic pack simply never reaches it — no special case needed.
 */
export function t(
  key: string,
  locale?: string,
  sourceLocale: string = DEFAULT_UI_LOCALE
): string {
  const hostText = registeredText(key, locale ?? DEFAULT_UI_LOCALE);
  if (hostText !== undefined) {
    return hostText;
  }
  const entry = builtInString(key);

  if (entry) {
    return resolveText(entry, locale, key, sourceLocale);
  }

  /*
   * Last: a key a format pack brought with it.
   *
   * After the host's locale and after everything we ship, so a pack can never
   * shadow a string somebody else chose. Without this a pack's own error renders
   * as its key — a resident reading `validation.format.ni` on the screen, which
   * is what an unresolvable key does today.
   */
  const fromFormat = formatMessage(key);

  return fromFormat ? resolveText(fromFormat, locale, key, sourceLocale) : key;
}

/**
 * Like `t()`, but with an explicit fallback instead of the key. Used for labels
 * that already have a Swedish source in the code (node types, property fields).
 *
 * Source-locale safe: for the source locale (sv) the code's own text is ALWAYS
 * shown, so a global key per field id can never regress the Swedish when the
 * same id carries different Swedish texts in different nodes. The key only
 * contributes the translation for other locales (falling back to the source
 * text when no translation exists).
 */
export function tOr(key: string, fallback: string, locale?: string): string {
  if (
    !locale ||
    locale === DEFAULT_UI_LOCALE ||
    locale.split("-")[0] === DEFAULT_UI_LOCALE
  ) {
    return fallback;
  }
  const hostText = registeredText(key, locale);
  if (hostText !== undefined) {
    return hostText;
  }
  const entry = builtInString(key);
  return entry ? resolveText(entry, locale, fallback) : fallback;
}

/**
 * Keys the editor may override per guide.
 *
 * Derived from `VIEWER_STRINGS` rather than listed by hand. Three of
 * fifty-five used to be reachable, and a text a resident sees but the editor
 * cannot reach is a text nobody owns — story 017, criterion 2. Deriving it also
 * means the two cannot drift: a new viewer key is reachable the day it exists.
 *
 * The label names *which* text you are editing, so it belongs to the editor's
 * own language — it used to be a constant computed at module load, and read
 * "Föregående" in an English editor. Sorted by key so the order is stable.
 */
export function customizableUiStrings(
  uiLocale: string = DEFAULT_UI_LOCALE
): ReadonlyArray<{ key: string; label: string }> {
  return Object.keys(VIEWER_STRINGS)
    .sort()
    .map((key) => ({
      key,
      label: resolveText(VIEWER_STRINGS[key], uiLocale, key),
    }));
}

/**
 * Viewer text in the chosen locale, in story 010's order:
 * the guide's own → the host's registered → the package's built-in.
 *
 * The guide outranks the rest because it is the most specific: "Till nästa
 * fråga" in this one guide must not be overwritten by the organisation's
 * "Nästa".
 */
export function uiText(
  key: string,
  strings: Record<string, LocalizedText> | undefined,
  locale?: string,
  sourceLocale: string = DEFAULT_UI_LOCALE
): string {
  // A guide may override only what a resident reads. Its own text can never
  // reach the tool's — no guide renames "Fråga" in the palette. Story 017,
  // criterion 3: by construction, not because the call paths happen to differ.
  const override = isViewerString(key) ? strings?.[key] : undefined;
  if (override !== undefined) {
    const resolved = resolveText(override, locale, "", sourceLocale);
    if (resolved !== "") {
      return resolved;
    }
  }
  return t(key, locale, sourceLocale);
}

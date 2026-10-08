/**
 * Translatable text for presentation fields (titles, descriptions, labels).
 * NEVER for identities (variable names, option values, ids, ports) — those keep
 * the flow language-independent, so a translation can never change traversal.
 *
 * A text is either a bare string (source language, legacy) or a map
 * { sv, en, ... }. resolveText handles both, so a bare string keeps working
 * everywhere without migration — translation is additive.
 */
/**
 * What a guide is assumed to be written in when it says nothing.
 *
 * All content that existed before `settings.sourceLocale` did is written in
 * Swedish, so the default is a historical truth rather than an assumption about
 * future guides. A guide that says otherwise wins over this.
 *
 * Use `getSourceLocale(graph)` when the graph is at hand. The constant is only
 * the last resort.
 */
export const DEFAULT_SOURCE_LOCALE = "sv";

/**
 * The editor's own UI language when the host has not set `editor-locale`.
 *
 * A separate constant despite the same value: this is what language the
 * *buttons* are in, not what the guide is written in. The two used to share one
 * constant, and a change to one would have changed the other.
 *
 * They also have different reach. The editor's chrome exists in **Swedish and
 * English** — those are the translations we wrote ourselves, and the list grows
 * only when someone writes more. A guide's content can be translated into
 * anything; there the editor writes the text, not us.
 */
export const DEFAULT_UI_LOCALE = "sv";

/**
 * @deprecated Say what is meant: `DEFAULT_SOURCE_LOCALE`, `DEFAULT_UI_LOCALE`
 * or `getSourceLocale(graph)`. Kept until every call site has moved.
 */
export const SOURCE_LOCALE = DEFAULT_SOURCE_LOCALE;

export type LocaleCode = string;

/**
 * The name of a language, in the editor's own UI language.
 *
 * The browser already knows this: `Intl.DisplayNames` gives *somaliska*,
 * *tigrinja* and *ukrainska* without us maintaining a list. There used to be
 * three languages hardcoded — sv, en and fi — which excluded exactly the
 * languages a municipality most often needs.
 *
 * A code the browser does not recognise gets the code itself as its name. That
 * is more honest than hiding it: the editor sees what the guide says.
 */
export function localeLabel(
  code: LocaleCode,
  uiLocale: LocaleCode = DEFAULT_UI_LOCALE
): string {
  try {
    const namn = new Intl.DisplayNames([uiLocale], { type: "language" }).of(code);
    return namn && namn !== code ? namn : code;
  } catch {
    return code;
  }
}

/**
 * The same name, for a place where it stands on its own.
 *
 * `Intl` gives each language its name as that language's own writing has it:
 * *English* with a capital because English capitalises language names, and
 * *svenska* without because Swedish does not. Both are correct, and in a
 * sentence — *Källa (svenska): …* — the Swedish one has to stay that way.
 *
 * A picker is not a sentence. Its items are labels, and a list that reads
 * "English / svenska" looks like one of them was forgotten rather than like
 * two orthographies being respected. So the first letter is raised where the
 * name is the whole of what is written, and left alone everywhere else.
 *
 * Raised with the UI language's own casing rules, because they are not all the
 * same: Turkish has two i's, and a Swedish `toUpperCase` would give the wrong
 * one.
 */
export function localeTitle(
  code: LocaleCode,
  uiLocale: LocaleCode = DEFAULT_UI_LOCALE
): string {
  const name = localeLabel(code, uiLocale);

  /*
   * A code is not a name, so it is not dressed as one.
   *
   * `localeLabel` hands back the code itself when the browser knows no name for
   * it — deliberately, so the editor sees what the guide actually says. Raising
   * its first letter would turn `xx` into `Xx`, which reads like a name
   * somebody chose rather than like the code nobody could resolve.
   */
  if (name === code) {
    return name;
  }

  return name.charAt(0).toLocaleUpperCase(uiLocale) + name.slice(1);
}

/**
 * Which way a language reads.
 *
 * The browser knows: `Intl.Locale("ar").getTextInfo().direction` → `rtl`. A list
 * of our own would have been built on our assumptions rather than on facts —
 * **Tigrinya is ltr** though one easily assumes otherwise, and so is Somali.
 *
 * `ltr` when the API is missing or the code is unknown: it is the more common
 * direction, and a text that happens to read the wrong way is better than an
 * error that stops the rendering.
 */
export function textDirection(locale: LocaleCode): "ltr" | "rtl" {
  /*
   * TypeScript's lib does not know `getTextInfo` yet, and older Safari exposed
   * the same information as a `textInfo` property. The shape is therefore
   * declared here instead of casting to `any` — that way what we expect is
   * visible.
   *
   * Only `getTextInfo()` is proven (Chromium); `textInfo` is included because it
   * costs nothing and rescues an older browser.
   */
  type MedTextInfo = Intl.Locale & {
    getTextInfo?: () => { direction?: string };
    textInfo?: { direction?: string };
  };

  try {
    const locale47 = new Intl.Locale(locale) as MedTextInfo;
    const info = locale47.getTextInfo?.() ?? locale47.textInfo;
    return info?.direction === "rtl" ? "rtl" : "ltr";
  } catch {
    return "ltr";
  }
}

/**
 * The languages a guide is offered in, the source first.
 *
 * The source is always first and always present — it is the only language
 * guaranteed to have content.
 */
export function getGuideLocales(
  offered?: readonly string[],
  source: LocaleCode = DEFAULT_SOURCE_LOCALE,
  uiLocale: LocaleCode = DEFAULT_UI_LOCALE
): Array<{ code: LocaleCode; label: string; isSource: boolean }> {
  const sourceCode = normalizeLocale(source) ?? source;
  const codes = [sourceCode];

  /*
   * A guide without `locales` was written before the field existed, and those
   * guides were offered in the source language plus English. The default is
   * therefore a historical fact, not a recommendation: remove it and English
   * text already present in an old guide becomes unreachable from the language
   * picker (K6b).
   */
  const wanted = offered && offered.length > 0 ? offered : [sourceCode, "en"];

  for (const code of wanted) {
    const normalized = normalizeLocale(code);
    if (normalized && !codes.includes(normalized)) {
      codes.push(normalized);
    }
  }

  return codes.map((code) => ({
    code,
    label: localeTitle(code, uiLocale),
    isSource: isSourceLocale(code, sourceCode),
  }));
}

/**
 * Is this language a translation, or the language the guide is written in?
 *
 * The comparison is by base language, so `sv-SE` is not a translation of `sv`.
 * Every place that asked this asked it with `===`, which meant a guide whose
 * source is `sv` treated `sv-SE` as something to translate — and `resolveText`
 * disagreed, because it matches on the base. Two answers to the same question
 * is the shape of fault this file keeps producing.
 *
 * It reads as a sentence at the call site, which is the other half of the
 * point: `isTranslation(code, source)` says what the branch is for, where
 * `code !== source` says only what it compares.
 */
export function isTranslation(
  locale: LocaleCode,
  sourceLocale: LocaleCode = DEFAULT_SOURCE_LOCALE
): boolean {
  return baseLanguage(normalizeLocale(locale) ?? locale) !==
    baseLanguage(normalizeLocale(sourceLocale) ?? sourceLocale);
}

/** The other way round, for the branch that reads better in the positive. */
export function isSourceLocale(
  locale: LocaleCode,
  sourceLocale: LocaleCode = DEFAULT_SOURCE_LOCALE
): boolean {
  return !isTranslation(locale, sourceLocale);
}

/**
 * The language this guide is written in.
 *
 * The graph takes precedence; without a value Swedish applies, which is what all
 * older content is actually written in.
 */
export function getSourceLocale(graph?: {
  settings?: { sourceLocale?: string };
}): LocaleCode {
  const angivet = graph?.settings?.sourceLocale;
  return (angivet && normalizeLocale(angivet)) || DEFAULT_SOURCE_LOCALE;
}

export interface LocalizedTextMap {
  readonly [locale: string]: string;
}

export type LocalizedText = string | LocalizedTextMap;

export function isLocalizedTextMap(value: unknown): value is LocalizedTextMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
}

/**
 * Canonicalises a language code to BCP 47 (the same standard as HTML lang,
 * Accept-Language and Intl). Validation comes free: invalid tags → null.
 */
export function normalizeLocale(input: unknown): string | null {
  if (typeof input !== "string" || input.trim() === "") {
    return null;
  }
  try {
    return Intl.getCanonicalLocales(input.replace(/_/g, "-"))[0] ?? null;
  } catch {
    return null;
  }
}

/** The primary language subtag, e.g. "en-US" → "en". */
function baseLanguage(tag: string): string {
  try {
    return new Intl.Locale(tag).language;
  } catch {
    return tag.split("-")[0]!.toLowerCase();
  }
}

/**
 * The language to fall back to when neither the requested language nor the
 * guide's own source has the text.
 *
 * English rather than Swedish, and rather than whatever happens to be first in
 * the object. Someone who asked for Arabic and cannot have it is more likely to
 * read English than the source language of a guide they did not choose — and
 * "first in the object" is insertion order, which is not a decision at all.
 *
 * It sits *after* the source on purpose. The source is the text the author
 * actually wrote and the only one guaranteed to be complete; English may itself
 * be a half-finished translation. This is the answer when the source does not
 * help, not instead of it.
 */
export const FALLBACK_LOCALE = "en";

/**
 * Resolves the text for a language. Keys and the requested language are
 * normalised (BCP 47), and the chain is: exact → base language (en-US→en) →
 * the guide's source → English → first. Empty strings count as missing, so a
 * cleared translation falls back rather than showing an empty box.
 *
 * ## Why `sourceLocale` is a parameter
 *
 * It used to be the module constant `SOURCE_LOCALE`, which is Swedish. That is
 * true of every guide we have written and of nothing else. A guide authored in
 * English with a partial Swedish translation answered a reader who asked for
 * Arabic in **Swedish** — not the language they asked for, and not the source
 * either. The fault does not look like a fault: no empty box, no error, just
 * the wrong language.
 *
 * Pass `getSourceLocale(graph)` wherever the graph is at hand. Omitting it
 * keeps the historical assumption, which is right for content that predates
 * `settings.sourceLocale`.
 */
export function resolveText(
  value: unknown,
  locale: LocaleCode = SOURCE_LOCALE,
  fallback = "",
  sourceLocale: LocaleCode = DEFAULT_SOURCE_LOCALE
): string {
  if (typeof value === "string") {
    return value;
  }
  if (!isLocalizedTextMap(value)) {
    return fallback;
  }

  // Normalise the keys and drop empty translations.
  const byLocale = new Map<string, string>();
  for (const [key, text] of Object.entries(value)) {
    if (typeof text !== "string" || text.trim() === "") {
      continue;
    }
    byLocale.set(normalizeLocale(key) ?? key, text);
  }

  const want = normalizeLocale(locale) ?? locale;
  const wantBase = baseLanguage(want);
  const source = normalizeLocale(sourceLocale) ?? sourceLocale;
  const english = normalizeLocale(FALLBACK_LOCALE) ?? FALLBACK_LOCALE;

  const pick = (predicate: (key: string) => boolean): string | undefined => {
    for (const [key, text] of byLocale) {
      if (predicate(key)) {
        return text;
      }
    }
    return undefined;
  };

  return (
    byLocale.get(want) ??
    pick((key) => baseLanguage(key) === wantBase) ??
    byLocale.get(source) ??
    pick((key) => baseLanguage(key) === baseLanguage(source)) ??
    byLocale.get(english) ??
    pick((key) => baseLanguage(key) === baseLanguage(english)) ??
    // Insertion order, which is not a decision. Reached only when the text has
    // neither the requested language, the source, nor English.
    byLocale.values().next().value ??
    fallback
  );
}

/** Normalise to map form (a bare string → { [locale]: value }). */
export function toLocalizedMap(
  value: unknown,
  locale: LocaleCode = SOURCE_LOCALE
): LocalizedTextMap {
  if (isLocalizedTextMap(value)) {
    return value;
  }
  if (typeof value === "string") {
    return { [normalizeLocale(locale) ?? locale]: value };
  }
  return {};
}

/**
 * Sets/replaces one language's text without touching the others. The key is
 * normalised (BCP 47). Empty text removes the language entirely, so the field
 * falls back to the source instead of storing an empty translation.
 */
export function withLocale(
  value: unknown,
  locale: LocaleCode,
  text: string
): LocalizedTextMap {
  const key = normalizeLocale(locale) ?? locale;
  const next: Record<string, string> = { ...toLocalizedMap(value) };
  if (text.trim() === "") {
    delete next[key];
  } else {
    next[key] = text;
  }
  return next;
}

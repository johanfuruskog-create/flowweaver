import {
  VIEWER_STRINGS,
  builtInStrings,
  editorStrings,
} from "./built-in-strings";
import { normalizeLocale } from "../core/localized-text";

import type { LocalizedTextMap } from "../core/localized-text";

/**
 * Locale packs the host application registers at startup.
 *
 * Story 010: the viewer's own texts — "Nästa", "Ange ett tal" — read the same
 * in every guide an organisation publishes. Asking each editor to translate
 * them per guide would be forty people doing the same work forty times, and
 * shipping them ourselves would mean maintaining a dictionary for the world.
 *
 * So the **host** owns them. One call per locale, once:
 *
 * ```js
 * FlowWeaver.registerLocale("ar", { "nav.next": "التالي" });
 * ```
 *
 * The registry is deliberately process-global rather than a property on the
 * tags. It follows the pattern hosts already know from i18n libraries, and it
 * means nothing has to be threaded through the component tree: lookup asks the
 * registry itself.
 *
 * This is **configuration, not storage** — an in-memory map the host fills.
 * Nothing is written, and nothing reaches the guide (criterion 6).
 */
export type LocaleStrings = Readonly<Record<string, string>>;

/** The host's packs, keyed by normalized locale code. */
const registered = new Map<string, LocaleStrings>();

/**
 * Registers viewer texts for one locale.
 *
 * Calling it again for the same locale replaces the pack. The host owns it, and
 * a half-merged pack would be harder to debug than one that is replaced.
 *
 * Swedish and English may be registered too: an organisation that prefers
 * "Fortsätt" over "Nästa" should get that without touching any guide.
 */
export function registerLocale(
  locale: string,
  strings: LocaleStrings
): LocaleCoverage {
  const code = normalizeLocale(locale) ?? locale;
  if (!code) {
    return { locale, viewer: emptySide(VIEWER_STRINGS), editor: emptySide(editorStrings()) };
  }
  registered.set(code, { ...strings });
  return coverageOf(code);
}

/** How much of one audience a locale actually covers. */
export interface AudienceCoverage {
  /** Keys the resident or the editor would read in this language. */
  filled: number;
  /** Keys in the audience altogether. */
  total: number;
  /** The keys still missing, so a host can act rather than guess. */
  missing: string[];
}

/** What a registered pack covers, reported back to the host. */
export interface LocaleCoverage {
  locale: string;
  viewer: AudienceCoverage;
  editor: AudienceCoverage;
}

function emptySide(table: Record<string, unknown>): AudienceCoverage {
  const missing = Object.keys(table);
  return { filled: 0, total: missing.length, missing };
}

function sideCoverage(
  table: Record<string, LocalizedTextMap>,
  code: string
): AudienceCoverage {
  const missing: string[] = [];
  let filled = 0;
  for (const key of Object.keys(table)) {
    const own = registeredText(key, code);
    const builtIn = table[key]?.[code] ?? table[key]?.[code.split("-")[0]];
    const has =
      own !== undefined ||
      (typeof builtIn === "string" && builtIn.trim() !== "");
    if (has) {
      filled += 1;
    } else {
      missing.push(key);
    }
  }
  return { filled, total: Object.keys(table).length, missing };
}

/**
 * What a locale covers, per audience.
 *
 * Reported rather than enforced. A completeness rule would look tempting —
 * translate everything or the language does not run — but we add keys in every
 * version, so every host's pack would become incomplete the moment they
 * upgrade, and their Finnish editor would disappear for a change they did not
 * make. See story 013, and criterion 8 in story 014.
 *
 * The two audiences are reported apart because they are independent
 * obligations: translating a guide's content into Arabic asks for the viewer's
 * strings and nothing at all of the editor's. Story 017.
 *
 * In a page with only the viewer loaded the editor side reads 0 of 0: its
 * table arrives with the editor (`built-in-strings.ts`), and a host that never
 * mounts one has nothing an editor would read.
 */
export function coverageOf(locale: string): LocaleCoverage {
  const code = normalizeLocale(locale) ?? locale;
  return {
    locale: code,
    viewer: sideCoverage(VIEWER_STRINGS, code),
    editor: sideCoverage(editorStrings(), code),
  };
}

/** Removes a registered pack. Mainly for tests and for the host's own swaps. */
export function unregisterLocale(locale: string): void {
  registered.delete(normalizeLocale(locale) ?? locale);
}

/** A registered text, or undefined when the host has not supplied one. */
export function registeredText(key: string, locale: string): string | undefined {
  const code = normalizeLocale(locale) ?? locale;
  const text = registered.get(code)?.[key] ?? baseLanguagePack(code)?.[key];
  return typeof text === "string" && text.trim() !== "" ? text : undefined;
}

/** The base language's pack, so "ar-EG" finds a registered "ar". */
function baseLanguagePack(code: string): LocaleStrings | undefined {
  const base = code.split("-")[0];
  return base === code ? undefined : registered.get(base);
}

/**
 * Every text for one locale as a flat map — the host's template.
 *
 * Criterion 3: whoever is translating into Arabic asks for
 * `localeStrings("sv")` and gets the package's own texts to work from, instead
 * of digging them out of our source. Fetched at runtime, the template cannot
 * go stale.
 *
 * Registered texts outrank built-in ones, so `localeStrings("sv")` in a host
 * that swapped "Nästa" for "Fortsätt" reflects that swap.
 */
export function localeStrings(locale: string): Record<string, string> {
  const code = normalizeLocale(locale) ?? locale;
  const result: Record<string, string> = {};

  for (const [key, entry] of Object.entries(builtInStrings())) {
    const builtIn = entry[code] ?? entry[code.split("-")[0]];
    if (typeof builtIn === "string" && builtIn.trim() !== "") {
      result[key] = builtIn;
    }
  }
  for (const [key, text] of Object.entries(registered.get(code) ?? {})) {
    if (typeof text === "string" && text.trim() !== "") {
      result[key] = text;
    }
  }
  return result;
}

/** Locales the package can show the viewer in without the host doing anything. */
export function builtInLocales(): string[] {
  const codes = new Set<string>();
  for (const entry of Object.values(builtInStrings())) {
    Object.keys(entry).forEach((code) => codes.add(code));
  }
  return [...codes].sort();
}

/** Locales the viewer can be shown in: the package's own plus the host's. */
export function availableLocales(): string[] {
  return [...new Set([...builtInLocales(), ...registered.keys()])].sort();
}

/**
 * Offered locales that neither the package nor the host has viewer texts for.
 *
 * Criterion 8: the guide offers Arabic, the host never registered Arabic, and
 * the resident meets Swedish buttons. That is a message to the administrator
 * about the host's setup — not a task for the editor.
 */
export function localesWithoutStrings(locales: readonly string[]): string[] {
  const covered = new Set(availableLocales());
  return locales.filter((locale) => {
    const code = normalizeLocale(locale) ?? locale;
    return !covered.has(code) && !covered.has(code.split("-")[0]);
  });
}

/*
 * The third axis: which languages exist at all, and which is the default.
 *
 * Story 014. Language codes are the host's responsibility — they know their
 * organisation's languages, and we do not. Until they say so there is no list,
 * and the editor keeps the free-text field it has always had: the package must
 * work without the host doing anything (criterion 7).
 *
 * Declaring is therefore not a restriction we impose but a decision the host
 * takes. Once taken, `qq` cannot be typed into a guide.
 *
 * Note what this is *not*. It is not a claim that texts exist for those
 * languages — a translator supplies the viewer's texts in the guide itself
 * (story 017). It is governance over the codes, not over the content.
 */
let declared: readonly string[] | null = null;
let declaredDefault: string | null = null;

/** What the host declares at startup. `default` falls back to the first entry. */
export interface LocaleDeclaration {
  default?: string;
}

/**
 * Declares which languages a guide may be offered in, and which is the default.
 *
 * Nothing is stored in any guide: this is the host's setup, like the mode and
 * the theme (**K6c**). Calling it again replaces the declaration.
 */
export function declareLocales(
  locales: readonly string[],
  options: LocaleDeclaration = {}
): void {
  const codes = locales
    .map((locale) => normalizeLocale(locale) ?? locale)
    .filter((code): code is string => Boolean(code));

  declared = codes.length > 0 ? codes : null;

  const wanted = options.default
    ? (normalizeLocale(options.default) ?? options.default)
    : undefined;
  declaredDefault =
    wanted && codes.includes(wanted) ? wanted : (codes[0] ?? null);
}

/** Clears the declaration. Mainly for tests and for a host's own reset. */
export function clearDeclaredLocales(): void {
  declared = null;
  declaredDefault = null;
}

/**
 * The languages a guide may be offered in, or `null` when the host has not
 * said. `null` means "no decision taken", which is different from an empty
 * list — it is what keeps the free-text field alive.
 */
export function declaredLocales(): readonly string[] | null {
  return declared;
}

/** The language a new guide is written in, when the host has named one. */
export function declaredDefaultLocale(): string | null {
  return declaredDefault;
}

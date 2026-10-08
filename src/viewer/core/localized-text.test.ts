import { describe, expect, test } from "vitest";

import {
  getGuideLocales,
  getSourceLocale,
  localeLabel,
  textDirection,
  isLocalizedTextMap,
  normalizeLocale,
  resolveText,
  toLocalizedMap,
  withLocale,
} from "./localized-text";

describe("localized text", () => {
  test("recognises map form but not strings or anything else", () => {
    expect(isLocalizedTextMap({ sv: "Hej", en: "Hi" })).toBe(true);
    expect(isLocalizedTextMap({})).toBe(true);
    expect(isLocalizedTextMap("Hej")).toBe(false);
    expect(isLocalizedTextMap(null)).toBe(false);
    expect(isLocalizedTextMap(["Hej"])).toBe(false);
    expect(isLocalizedTextMap({ sv: 1 })).toBe(false);
  });

  test("resolves a bare string as the source language", () => {
    expect(resolveText("Hej")).toBe("Hej");
    expect(resolveText("Hej", "en")).toBe("Hej");
  });

  test("resolves the right language from the map", () => {
    const text = { sv: "Hej", en: "Hi" };
    expect(resolveText(text, "en")).toBe("Hi");
    expect(resolveText(text, "sv")).toBe("Hej");
  });

  test("falls back to the source language, then the first, then the fallback", () => {
    expect(resolveText({ sv: "Hej", en: "Hi" }, "de")).toBe("Hej");
    expect(resolveText({ en: "Hi", de: "Hallo" }, "fr")).toBe("Hi");
    expect(resolveText({}, "sv", "Namnlös")).toBe("Namnlös");
    expect(resolveText(42, "sv", "Namnlös")).toBe("Namnlös");
    expect(resolveText(undefined)).toBe("");
  });

  test("normaliserar till kartform", () => {
    expect(toLocalizedMap("Hej")).toEqual({ sv: "Hej" });
    expect(toLocalizedMap("Hi", "en")).toEqual({ en: "Hi" });
    expect(toLocalizedMap({ sv: "Hej" })).toEqual({ sv: "Hej" });
    expect(toLocalizedMap(42)).toEqual({});
  });

  test("sets one language without touching the others", () => {
    expect(withLocale("Hej", "en", "Hi")).toEqual({ sv: "Hej", en: "Hi" });
    expect(withLocale({ sv: "Hej", en: "Hi" }, "en", "Hello")).toEqual({
      sv: "Hej",
      en: "Hello",
    });
  });

  test("the guide's languages: the source first, and it is not duplicated", () => {
    expect(getGuideLocales(["fi", "en"]).map((l) => l.code)).toEqual(["sv", "fi", "en"]);
    expect(getGuideLocales(["sv", "fi"]).map((l) => l.code)).toEqual(["sv", "fi"]);
  });

  // A historical fact, not a recommendation: guides written before the field
  // existed were offered in the source language plus English. Without the
  // default, English text already in an old guide becomes unreachable from the
  // picker.
  test("a guide with no stated languages gets the source plus English", () => {
    expect(getGuideLocales().map((l) => l.code)).toEqual(["sv", "en"]);
  });

  test("the source language can be something other than Swedish", () => {
    const locales = getGuideLocales(["sv"], "fi");

    expect(locales.map((l) => l.code)).toEqual(["fi", "sv"]);
    expect(locales[0].isSource).toBe(true);
  });

  // With an open language list there are no "unknown" codes to filter out. A
  // code the browser does not recognise gets the code itself as its name — more
  // honest than hiding that it is in the guide.
  test("a language we have no name for is kept anyway", () => {
    const locales = getGuideLocales(["xx"], "sv");

    expect(locales.map((l) => l.code)).toEqual(["sv", "xx"]);
    expect(locales[1].label).toBe("xx");
  });

  test("the names come in the editor's UI language", () => {
    /*
     * Capital, and only here. `getGuideLocales` builds the picker's items,
     * where a name is the whole of what is written — and a list reading
     * "English / somaliska" looks like one was forgotten rather than like two
     * orthographies being kept. `localeLabel` itself is untouched, which the
     * table further down still pins: in a sentence the Swedish stays lower
     * case, because that is how Swedish writes it.
     */
    expect(getGuideLocales(["so"], "sv", "sv")[1].label).toBe("Somaliska");
    expect(getGuideLocales(["so"], "sv", "en")[1].label).toBe("Somali");
  });

  test("normaliserar nyckeln till kanonisk BCP 47", () => {
    expect(normalizeLocale("sv")).toBe("sv");
    expect(normalizeLocale("EN-us")).toBe("en-US");
    expect(normalizeLocale("sv_SE")).toBe("sv-SE");
    expect(normalizeLocale("  ")).toBeNull();
    expect(normalizeLocale("inte en tagg!")).toBeNull();
    expect(normalizeLocale(42)).toBeNull();
  });

  test("falls back via the base language (en-US → en)", () => {
    expect(resolveText({ sv: "Hej", en: "Hi" }, "en-US")).toBe("Hi");
    expect(resolveText({ sv: "Hej", "en-GB": "Hiya" }, "en")).toBe("Hiya");
    // A non-canonical stored key still resolves.
    expect(resolveText({ sv: "Hej", EN: "Hi" }, "en")).toBe("Hi");
  });

  test("an empty translation counts as missing and falls back", () => {
    expect(resolveText({ sv: "Hej", en: "" }, "en")).toBe("Hej");
    expect(resolveText({ sv: "Hej", en: "   " }, "en")).toBe("Hej");
  });

  test("empty text removes the language so it falls back to the source", () => {
    expect(withLocale({ sv: "Hej", en: "Hi" }, "en", "")).toEqual({ sv: "Hej" });
    expect(withLocale({ sv: "Hej", en: "Hi" }, "en", "  ")).toEqual({ sv: "Hej" });
    // Normaliserar nyckeln vid skrivning.
    expect(withLocale("Hej", "EN-us", "Hi")).toEqual({ sv: "Hej", "en-US": "Hi" });
  });
});

describe("the guide's source language", () => {
  test("without a value it is Swedish — what all older content is written in", () => {
    expect(getSourceLocale()).toBe("sv");
    expect(getSourceLocale({ settings: {} })).toBe("sv");
  });

  test("the guide takes precedence", () => {
    expect(getSourceLocale({ settings: { sourceLocale: "fi" } })).toBe("fi");
  });

  // BCP 47 form: language lowercase, region uppercase. The region is kept — a
  // guide written in Finland Swedish is not the same as one written in Swedish.
  test("the code is normalised but keeps the region", () => {
    expect(getSourceLocale({ settings: { sourceLocale: "FI-fi" } })).toBe("fi-FI");
    expect(getSourceLocale({ settings: { sourceLocale: "SV" } })).toBe("sv");
  });

  test("junk falls back to Swedish instead of blowing up", () => {
    expect(getSourceLocale({ settings: { sourceLocale: "!!" } })).toBe("sv");
  });
});

describe("language names", () => {
  // The browser knows the languages a municipality most often needs. We had three hardcoded.
  test.each([
    ["so", "somaliska"],
    ["ar", "arabiska"],
    ["uk", "ukrainska"],
    ["ti", "tigrinja"],
  ])("%s heter %s på svenska", (code, expected) => {
    expect(localeLabel(code, "sv")).toBe(expected);
  });

  test("the name follows the editor's UI language", () => {
    expect(localeLabel("sv", "en")).toBe("Swedish");
  });

  // More honest than hiding that the code is in the guide.
  test("a code with no known name gets the code itself", () => {
    expect(localeLabel("qq", "sv")).toBe("qq");
  });
});

describe("textriktning", () => {
  // The browser knows. A list of our own would have been built on our assumptions.
  test.each([
    ["ar", "rtl"],
    ["fa", "rtl"],
    ["he", "rtl"],
    ["ur", "rtl"],
    ["sv", "ltr"],
    ["en", "ltr"],
    ["uk", "ltr"],
    // The two most easily assumed wrong.
    ["ti", "ltr"],
    ["so", "ltr"],
  ])("%s läses %s", (locale, väntat) => {
    expect(textDirection(locale)).toBe(väntat);
  });

  // The wrong direction is better than an error that stops the rendering.
  test("an unknown code falls back to left-to-right", () => {
    expect(textDirection("qq")).toBe("ltr");
    expect(textDirection("!!")).toBe("ltr");
  });

  test("the region does not affect the direction", () => {
    expect(textDirection("ar-EG")).toBe("rtl");
  });
});

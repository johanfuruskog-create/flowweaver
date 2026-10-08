import { afterEach, describe, expect, test } from "vitest";

import {
  availableLocales,
  builtInLocales,
  localeStrings,
  localesWithoutStrings,
  registerLocale,
  unregisterLocale,
} from "./registry";
import { t, uiText } from "../core/ui-strings";

/**
 * Locale packs the host registers at startup — story 010.
 *
 * The viewer's own texts belong to the host, not to the editor: "Nästa" reads
 * the same in all forty guides an organisation publishes, and asking each
 * editor to translate it per guide would be the same work forty times over.
 */

afterEach(() => {
  ["ar", "ar-EG", "fi", "sv", "qq"].forEach(unregisterLocale);
});

describe("what the package brings on its own", () => {
  // Criterion 2. A host that does nothing at all still gets these.
  test("Swedish and English always exist", () => {
    expect(builtInLocales()).toEqual(["en", "sv"]);
  });

  test("without a pack, the viewer falls back to the source", () => {
    expect(t("nav.next", "ar")).toBe("Nästa");
  });

  test("English is not a fallback, it is built in", () => {
    expect(t("nav.next", "en")).toBe("Next");
  });
});

describe("what the host registers", () => {
  test("a registered text is used", () => {
    registerLocale("ar", { "nav.next": "التالي" });

    expect(t("nav.next", "ar")).toBe("التالي");
  });

  // The pack is the host's; a half-merged one would be harder to debug.
  test("registering again replaces the pack", () => {
    registerLocale("ar", { "nav.next": "أ", "nav.previous": "ب" });
    registerLocale("ar", { "nav.next": "ج" });

    expect(t("nav.next", "ar")).toBe("ج");
    expect(t("nav.previous", "ar")).toBe("Föregående");
  });

  test("keys the pack omits fall back per key", () => {
    registerLocale("ar", { "nav.next": "التالي" });

    expect(t("nav.restart", "ar")).toBe("Börja om");
  });

  // An organisation that prefers "Fortsätt" should not touch forty guides.
  test("the host may override Swedish", () => {
    registerLocale("sv", { "nav.next": "Fortsätt" });

    expect(t("nav.next", "sv")).toBe("Fortsätt");
  });

  test("a region code finds the base language's pack", () => {
    registerLocale("ar", { "nav.next": "التالي" });

    expect(t("nav.next", "ar-EG")).toBe("التالي");
  });

  test("an empty string is not a translation", () => {
    registerLocale("ar", { "nav.next": "   " });

    expect(t("nav.next", "ar")).toBe("Nästa");
  });

  test("the registered locale shows up as available", () => {
    registerLocale("ar", { "nav.next": "التالي" });

    expect(availableLocales()).toContain("ar");
  });
});

describe("the order: guide, host, built-in", () => {
  // Criterion 4. The guide is the most specific, so it outranks the rest.
  test("the guide's own wording beats the host's pack", () => {
    registerLocale("ar", { "nav.next": "التالي" });

    expect(
      uiText("nav.next", { "nav.next": { ar: "إلى السؤال التالي" } }, "ar"),
    ).toBe("إلى السؤال التالي");
  });

  test("the host's pack beats the built-in", () => {
    registerLocale("sv", { "nav.next": "Fortsätt" });

    expect(uiText("nav.next", undefined, "sv")).toBe("Fortsätt");
  });

  test("an empty guide override does not win", () => {
    registerLocale("ar", { "nav.next": "التالي" });

    expect(uiText("nav.next", { "nav.next": { ar: "" } }, "ar")).toBe("التالي");
  });
});

describe("the host's template", () => {
  // Criterion 3: fetched at runtime, so it cannot go stale against our source.
  test("asking for Swedish returns the package's own texts", () => {
    const template = localeStrings("sv");

    expect(template["nav.next"]).toBe("Nästa");
    expect(Object.keys(template).length).toBeGreaterThan(100);
  });

  // The template is what is loaded. A viewer-only page hands the translator
  // the visitor's words and nothing of the editor's — there is no editor on
  // that page to translate (see `built-in-strings.ts`). The whole table, with
  // the editor's 500-odd keys, is what the editor's own lookup module brings.
  test("without the editor loaded it holds the viewer's words only", () => {
    const template = localeStrings("sv");

    expect(template["editor.close"]).toBeUndefined();
    expect(Object.keys(template).length).toBeLessThan(200);
  });

  test("it is flat — ready to translate and hand back", () => {
    expect(typeof localeStrings("sv")["nav.next"]).toBe("string");
  });

  test("a registered swap shows in the template", () => {
    registerLocale("sv", { "nav.next": "Fortsätt" });

    expect(localeStrings("sv")["nav.next"]).toBe("Fortsätt");
  });

  test("a locale nobody has translated yields nothing to copy", () => {
    expect(Object.keys(localeStrings("ar"))).toEqual([]);
  });
});

describe("telling the administrator what is missing", () => {
  // Criterion 8. The guide offers Arabic, the host never registered it.
  test("an offered locale without texts is reported", () => {
    expect(localesWithoutStrings(["sv", "en", "ar"])).toEqual(["ar"]);
  });

  test("registering it clears the report", () => {
    registerLocale("ar", { "nav.next": "التالي" });

    expect(localesWithoutStrings(["sv", "en", "ar"])).toEqual([]);
  });

  test("a region code counts as covered by its base language", () => {
    registerLocale("ar", { "nav.next": "التالي" });

    expect(localesWithoutStrings(["ar-EG"])).toEqual([]);
  });

  test("the built-in locales are never reported", () => {
    expect(localesWithoutStrings(["sv", "en"])).toEqual([]);
  });
});

describe("nothing of this reaches the guide", () => {
  // Criterion 6: a guide moved to another host does not carry its buttons.
  test("registering does not touch any graph", () => {
    const graph = { settings: { locales: ["sv", "ar"] } };
    const before = JSON.stringify(graph);

    registerLocale("ar", { "nav.next": "التالي" });

    expect(JSON.stringify(graph)).toBe(before);
  });
});

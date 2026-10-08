import { describe, expect, test } from "vitest";

// The editor lookup: same functions, with the editor's words loaded. The
// editor key below ("port.continue") resolves only through it.
import { t, tOr } from "../localization/editor-ui-strings";
import { uiText } from "../../viewer/core/ui-strings";

describe("ui-strings", () => {
  test("t() gives the built-in default in the chosen language with source fallback", () => {
    expect(t("nav.next")).toBe("Nästa");
    expect(t("nav.next", "en")).toBe("Next");
    expect(t("port.continue", "en")).toBe("Continue");
    expect(t("nav.next", "de")).toBe("Nästa"); // okänt språk → källa
    expect(t("okänd.nyckel")).toBe("okänd.nyckel"); // okänd nyckel oförändrad
  });

  test("uiText() picks the guide's override, otherwise the default", () => {
    const strings = {
      "nav.next": { sv: "Vidare", en: "Proceed" },
    };
    expect(uiText("nav.next", strings, "sv")).toBe("Vidare");
    expect(uiText("nav.next", strings, "en")).toBe("Proceed");
    // No override for the key → the default.
    expect(uiText("nav.previous", strings, "en")).toBe("Previous");
    // Ingen override alls → default.
    expect(uiText("nav.next", undefined, "en")).toBe("Next");
  });

  test("an empty override falls back to the default", () => {
    expect(uiText("nav.next", { "nav.next": {} }, "en")).toBe("Next");
    expect(uiText("nav.next", { "nav.next": "" }, "en")).toBe("Next");
  });

  test("a partial override falls back to the override's source (like content)", () => {
    // Only sv set → English inherits its own source, not the built-in.
    expect(uiText("nav.next", { "nav.next": { sv: "Vidare" } }, "en")).toBe("Vidare");
  });

  /*
   * tOr() had no test of its own even though callers lean on it
   * (node-palette, properties-panel). Written alongside the engine's
   * structural failures (2026-08-31) — they were tried with `tOr` first and
   * moved back to `t()`, so this is what that detour left behind.
   *
   * The two are for opposite ownership of the source-language text:
   *
   * - `tOr(key, fallback, locale)` is for a caller whose Swedish IS the
   *   code — a node type's label, a property's — where `fallback` is that
   *   text and the registry only ever adds a translation. It reads the
   *   registry for every OTHER locale and never for the source one, so two
   *   homes for the Swedish cannot happen: there is only the one.
   * - `t(key, locale)` is for a caller whose text lives IN the registry —
   *   `viewer-strings.ts`'s `sv:` entries, as the engine's own failures do
   *   since this file was written. Using `tOr` there instead would have
   *   given the Swedish a second home (the call site's own literal) beside
   *   the registry's — the exact drift PRAXIS 14 exists to name: two copies
   *   of the same sentence, one of them unread whenever someone edits the
   *   other.
   */
  describe("tOr()", () => {
    test("returns the fallback for the source locale without touching the registry", () => {
      // A key that does not exist proves the source branch never looks it up.
      expect(tOr("no.such.key", "Källtexten", "sv")).toBe("Källtexten");
      expect(tOr("no.such.key", "Källtexten")).toBe("Källtexten"); // no locale → source
    });

    test("a registered key translates for another locale", () => {
      expect(tOr("nav.next", "Nästa", "en")).toBe("Next");
    });

    test("an unregistered key falls back to the given default in another locale too", () => {
      expect(tOr("no.such.key", "Källtexten", "en")).toBe("Källtexten");
    });
  });
});

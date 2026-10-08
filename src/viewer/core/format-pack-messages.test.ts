import { afterEach, describe, expect, test } from "vitest";

import "./default-formats";
import { registerFormat, unregisterFormat } from "./format-registry";
import { registerLocale, unregisterLocale } from "../localization/registry";
import { t } from "./ui-strings";

/**
 * A format pack brings the words for its own refusals.
 *
 * ## The fault
 *
 * `validate` returns a ui-strings key, and a key nobody has a text for renders
 * **as the key**. Measured before this: a resident who mistyped would read
 * `validation.format.ni` on the screen — in Swedish and in English alike. It
 * looks like a program fault and says nothing about what is wrong, which is
 * worse than no validation at all.
 *
 * The registry's own contract already warned about it: *"a pack that brings a
 * validator must bring the string for its key too, or the field will refuse an
 * answer without saying why."* There was no way for a pack to do that.
 *
 * ## Why not `registerLocale`
 *
 * Because it replaces a whole language rather than adding to one — deliberately,
 * so a half-merged pack cannot become the thing nobody can debug. A format pack
 * using it to add one error message would throw away whatever Swedish the host
 * had registered. The cure would be worse than the disease.
 *
 * So the message travels with the format, and is consulted **last**: after the
 * host's own locale and after everything we ship, so a pack can never shadow a
 * string somebody else chose.
 */

afterEach(() => {
  unregisterFormat("ni");
  unregisterLocale("sv");
});

const registerNi = (): void =>
  registerFormat("ni", {
    label: "National Insurance number",
    pattern: "AA ## ## ## A",
    messages: {
      "validation.format.ni": {
        sv: "Ange ett giltigt National Insurance-nummer.",
        en: "Enter a valid National Insurance number.",
      },
    },
    validate: () => "validation.format.ni",
  });

describe("en nyckel ett paket har med sig", () => {
  test("blir text i stället för att stå kvar som nyckel", () => {
    registerNi();

    expect(t("validation.format.ni", "sv"), "nyckeln nådde skärmen").toBe(
      "Ange ett giltigt National Insurance-nummer.",
    );
  });

  test("på varje språk paketet har med sig", () => {
    registerNi();

    expect(t("validation.format.ni", "en")).toBe(
      "Enter a valid National Insurance number.",
    );
  });

  test("och försvinner med paketet", () => {
    registerNi();
    unregisterFormat("ni");

    expect(t("validation.format.ni", "sv")).toBe("validation.format.ni");
  });
});

describe("men den får aldrig tränga undan någon annans", () => {
  test("vår egen sträng vinner över ett pakets", () => {
    /*
     * A pack claiming `nav.next` must not rename the button. Consulted last is
     * the whole of the rule, and this is what holds it.
     */
    registerFormat("ni", {
      label: "NI",
      messages: { "nav.next": { sv: "KAPAD", en: "HIJACKED" } },
    });

    expect(t("nav.next", "sv")).not.toBe("KAPAD");
  });

  test("och värdens egen översättning vinner också", () => {
    registerLocale("sv", { "nav.next": "Värdens ord" });
    registerFormat("ni", {
      label: "NI",
      messages: { "nav.next": { sv: "KAPAD", en: "HIJACKED" } },
    });

    expect(t("nav.next", "sv")).toBe("Värdens ord");
  });
});

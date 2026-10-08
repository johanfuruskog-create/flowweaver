import { afterEach, describe, expect, test } from "vitest";

import {
  canonicalFormat,
  displayFormat,
  maskFormat,
  validateFormat,
} from "./format-validators";
import { listFormats, registerFormat, unregisterFormat } from "./format-registry";

/**
 * A format brought by a host behaves like one that ships.
 *
 * ## Why this is the test that matters
 *
 * A format used to live in five places: the validator's switch, the shapes
 * table, the canonical switch, the select's options and its error key. Adding
 * one meant editing five files and remembering all of them — the spread that
 * ends with a format that validates but has no shape, or has a shape nobody can
 * pick.
 *
 * So the registry is only worth its refactor if a registration reaches **all**
 * of them. That is what each assertion here checks, and why they use a format
 * invented for the test rather than one of the Swedish ones: a built-in could
 * pass by still being hardcoded somewhere.
 *
 * Johan's reason for wanting packs at all: not everyone needs Norwegian and
 * Danish. Nothing about them is here — whoever needs one adds it, and this says
 * adding is enough.
 */

const SSN = "ssn-us";

afterEach(() => unregisterFormat(SSN));

const registerSsn = (): void =>
  registerFormat(SSN, {
    label: "Social security number",
    pattern: "###-##-####",
    canonical: (value) => value.replace(/\D/g, ""),
    /*
     * The real structural rules, which are rules and not arithmetic: no area
     * 000, 666 or 900–999, no group 00, no serial 0000. There is no check digit
     * to compute, so this is as far as anybody can get — and further than a
     * pattern alone.
     */
    validate: (value) => {
      const digits = value.replace(/\D/g, "");

      if (digits.length !== 9) return "validation.format.ssn-us";

      const area = digits.slice(0, 3);
      const group = digits.slice(3, 5);
      const serial = digits.slice(5);

      return area === "000" ||
        area === "666" ||
        Number(area) >= 900 ||
        group === "00" ||
        serial === "0000"
        ? "validation.format.ssn-us"
        : null;
    },
  });

describe("ett format en värd lägger till", () => {
  test("går att välja i panelen", async () => {
    /*
     * The one that decides whether the other four matter: a format nobody can
     * pick is a format nobody has.
     *
     * Asked of the **node type**, not of the registry. The first version checked
     * that `listFormats()` had grown, which is true however the panel builds its
     * list — replacing the spread with a literal left it green while the option
     * disappeared from the select. A registry that nothing reads is not a
     * registry.
     */
    const { getNodeType } = await import("../node-types/node-type-registry");

    await import("../node-types/default-node-types");
    // The select is the editor's half of the field (leak 2, LOGG 8/9 2026).
    await import("../../editor/node-types/default-node-properties");
    registerSsn();

    /*
     * Registered *after* the node types were, which is the case that matters: a
     * pack is imported by a host, and the select is built from a getter so it
     * reads what the registry holds now rather than what it held at load.
     */
    const declared = getNodeType("text-question")!
      .properties.find((property) => property.id === "format")!.options;
    // The list does not depend on the node here, so an empty node's data is
    // the whole question — see `NodePropertyForm.options`.
    const options = (typeof declared === "function" ? declared({}) : (declared ?? [])).map(
      (option) => option.value,
    );

    expect(options).toContain(SSN);
    expect(listFormats().find((format) => format.name === SSN)?.label).toBe(
      "Social security number",
    );
  });

  test("tar sin form medan man skriver", () => {
    registerSsn();

    expect(maskFormat(SSN, "123456789", 9).value).toBe("123-45-6789");
  });

  test("lagras i sin egen kanoniska form", () => {
    registerSsn();

    expect(canonicalFormat(SSN, "123-45-6789")).toBe("123456789");
  });

  test("visas som det skrivs på kortet", () => {
    registerSsn();

    expect(displayFormat(SSN, "123456789")).toBe("123-45-6789");
  });

  test("och valideras med sina egna regler", () => {
    registerSsn();

    expect(validateFormat(SSN, undefined, "123-45-6789")).toBeNull();
    // 666 is refused by the administration itself, and never issued.
    expect(validateFormat(SSN, undefined, "666-45-6789")).toBe("validation.format.ssn-us");
    expect(validateFormat(SSN, undefined, "123-00-6789")).toBe("validation.format.ssn-us");
  });
});

describe("ett format utan kontroll", () => {
  test("får en form men påstår ingenting om äktheten", () => {
    /*
     * The honest half of what a pattern can promise. An identifier whose
     * arithmetic nobody has written still gets a shape, and saying so is better
     * than a validator that always agrees.
     */
    registerFormat("nino-gb", { label: "National insurance number", pattern: "AA ## ## ## A" });

    expect(maskFormat("nino-gb", "QQ123456C", 9).value).toBe("QQ 12 34 56 C");
    expect(validateFormat("nino-gb", undefined, "vad som helst")).toBeNull();

    unregisterFormat("nino-gb");
  });
});

describe("ett formats etikett", () => {
  /*
   * The label is what a redaktör picks in the panel, and a pack written for a
   * Finnish site should be able to name its henkilötunnus in Finnish and
   * English alike — the same reason `messages` is `LocalizedText`. A bare
   * string stays valid: a pack that knows no language behaves exactly as
   * before, which is what made this safe to widen.
   */
  test("kan bära flera språk och löses per språk", () => {
    registerFormat("hetu", {
      label: { fi: "Henkilötunnus", en: "Personal identity code", sv: "Finskt personnummer" },
      pattern: "######-####",
    });

    const byName = (locale?: string): string | undefined =>
      listFormats(locale).find((format) => format.name === "hetu")?.label;

    expect(byName("fi")).toBe("Henkilötunnus");
    expect(byName("en")).toBe("Personal identity code");
    expect(byName()).toBe("Finskt personnummer");

    unregisterFormat("hetu");
  });

  test("medan en ren sträng passerar orörd", () => {
    registerSsn();

    expect(listFormats("fi").find((format) => format.name === SSN)?.label).toBe(
      "Social security number",
    );
  });
});

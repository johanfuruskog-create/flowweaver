import { afterEach, describe, expect, test } from "vitest";

import { PageFieldValidationService } from "./page-field-validation-service";
import { registerLocale, unregisterLocale } from "../localization/registry";

import type { PageField } from "./page-fields-service";

/**
 * Page-field messages reach the resident in their own language.
 *
 * They were hardcoded Swedish until 2026-08-03 — nine messages that bypassed
 * the whole `uiText` chain, so an Arabic-reading resident met "Ange minst 3
 * tecken." however well the guide was translated. Story 010, criterion 5.
 *
 * Since 2026-08-04 they share their keys with the single-question path rather
 * than duplicating its rules under `field.*` names.
 */

const field = (extra: Partial<PageField>): PageField =>
  ({ id: "f", type: "text", label: "F", required: false, ...extra }) as PageField;

afterEach(() => unregisterLocale("ar"));

const arabic = {
  "validation.chooseOption": "اختر خياراً.",
  "validation.number.invalid": "أدخل رقماً.",
  "validation.minLength": "أدخل {n} حرفاً على الأقل.",
  "validation.required": "هذا الحقل مطلوب.",
};

describe("a page field says what a single question says", () => {
  /*
   * Five of these used to have wordings of their own — "Ange minst 3 tecken."
   * where a one-question step said "Texten måste innehålla minst 3 tecken." —
   * so a translator wrote the same rule twice in every language and had to keep
   * the two sounding alike. Both render into the same field-error slot, so
   * there was never a context that justified the split.
   */
  test.each([
    [field({ required: true }), "", "Fältet är obligatoriskt."],
    [field({ type: "number" }), "abc", "Ange ett giltigt tal."],
    [field({ type: "number", min: 5 }), "3", "Värdet måste vara minst 5."],
    [field({ type: "number", max: 5 }), "9", "Värdet får vara högst 5."],
    [field({ minLength: 3 }), "ab", "Texten måste innehålla minst 3 tecken."],
    [field({ maxLength: 2 }), "abc", "Texten får innehålla högst 2 tecken."],
  ])("%#: %s", (f, value, expected) => {
    expect(PageFieldValidationService.getMessage(f, value)).toBe(expected);
  });

  /*
   * The one pair that stays split. The single-question wording ends "innan du
   * går vidare", which is true of a step that *is* the question and reads
   * oddly beside one field among eight.
   */
  test("except the choice, which keeps its own shorter wording", () => {
    expect(
      PageFieldValidationService.getMessage(
        field({ type: "choice", required: true }),
        "",
      ),
    ).toBe("Välj ett alternativ.");
  });

  // The unit is the editor's text, so it is interpolated rather than keyed.
  test("the unit still follows the number", () => {
    expect(
      PageFieldValidationService.getMessage(
        field({ type: "number", min: 5, unit: "kr" }),
        "3",
      ),
    ).toBe("Värdet måste vara minst 5 kr.");
  });
});

describe("the resident's language", () => {
  test("English is built in", () => {
    expect(
      PageFieldValidationService.getMessage(field({ minLength: 3 }), "ab", "en"),
    ).toBe("Enter at least 3 characters.");
  });

  test("a registered pack reaches the message", () => {
    registerLocale("ar", arabic);

    expect(
      PageFieldValidationService.getMessage(field({ minLength: 3 }), "ab", "ar"),
    ).toBe("أدخل 3 حرفاً على الأقل.");
  });

  test("the placeholder is filled in the translated text too", () => {
    registerLocale("ar", arabic);

    expect(
      PageFieldValidationService.getMessage(field({ minLength: 3 }), "ab", "ar"),
    ).toContain("3");
  });

  test("a required choice speaks Arabic", () => {
    registerLocale("ar", arabic);

    expect(
      PageFieldValidationService.getMessage(
        field({ type: "choice", required: true }),
        "",
        "ar",
      ),
    ).toBe("اختر خياراً.");
  });

  test("a key the pack omits falls back rather than breaking", () => {
    registerLocale("ar", { "validation.chooseOption": "اختر خياراً." });

    expect(
      PageFieldValidationService.getMessage(field({ maxLength: 2 }), "abc", "ar"),
    ).toBe("Texten får innehålla högst 2 tecken.");
  });

  test("the guide's own wording outranks the pack", () => {
    registerLocale("ar", arabic);

    expect(
      PageFieldValidationService.getMessage(field({ minLength: 3 }), "ab", "ar", {
        "validation.minLength": { ar: "قصير جداً" },
      }),
    ).toBe("قصير جداً");
  });
});

describe("valid values stay silent", () => {
  test.each([
    [field({ required: false }), ""],
    [field({ type: "number", min: 1, max: 9 }), "5"],
    [field({ minLength: 2, maxLength: 4 }), "abc"],
  ])("%#", (f, value) => {
    expect(PageFieldValidationService.getMessage(f, value, "ar")).toBeNull();
  });
});

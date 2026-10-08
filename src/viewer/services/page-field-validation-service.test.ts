import { describe, expect, test } from "vitest";

import { PageFieldValidationService } from "./page-field-validation-service";
import type { PageField } from "./page-fields-service";

function createField(overrides: Partial<PageField> = {}): PageField {
  return {
    id: "field",
    type: "text",
    label: "Fält",
    variableName: "value",
    placeholder: "",
    required: false,
    columnSpan: 12,
    breakBefore: false,
    options: [],
    unit: "",
    ...overrides,
  };
}

describe("PageFieldValidationService", () => {
  test("requires a value for required fields", () => {
    expect(
      PageFieldValidationService.getMessage(createField({ required: true }), "  ")
    ).toBe("Fältet är obligatoriskt.");
    expect(
      PageFieldValidationService.getMessage(createField(), "")
    ).toBeNull();
  });

  test("asks the user to pick an option in choice fields", () => {
    expect(
      PageFieldValidationService.getMessage(
        createField({ type: "choice", required: true }),
        ""
      )
    ).toBe("Välj ett alternativ.");
  });

  test("validates text length", () => {
    const field = createField({ minLength: 3, maxLength: 5 });
    expect(PageFieldValidationService.getMessage(field, "ab")).toBe(
      "Texten måste innehålla minst 3 tecken."
    );
    expect(PageFieldValidationService.getMessage(field, "abcdef")).toBe(
      "Texten får innehålla högst 5 tecken."
    );
    expect(PageFieldValidationService.getMessage(field, "abcd")).toBeNull();
  });

  test("validates numbers, bounds and unit", () => {
    const field = createField({ type: "number", min: 0, max: 120, unit: "år" });
    expect(PageFieldValidationService.getMessage(field, "abc")).toBe("Ange ett giltigt tal.");
    expect(PageFieldValidationService.getMessage(field, "-1")).toBe("Värdet måste vara minst 0 år.");
    expect(PageFieldValidationService.getMessage(field, "130")).toBe("Värdet får vara högst 120 år.");
    expect(PageFieldValidationService.getMessage(field, "42")).toBeNull();
    expect(PageFieldValidationService.getMessage(field, "42,5")).toBeNull();
  });
});

/*
 * Story 087: *till* before *från*. The field carries the resolved bound and
 * the label of the field it came from; the message names that label.
 */
describe("a date bounded by another field", () => {
  test("says which field it must not precede, and passes the same day", () => {
    const till = createField({ type: "date", minDate: "2026-03-01", minDateLabel: "Från" });

    expect(PageFieldValidationService.getMessage(till, "2026-02-28")).toBe(
      "Datumet måste vara samma som eller efter Från.",
    );
    expect(PageFieldValidationService.getMessage(till, "2026-03-01")).toBeNull();
  });

  test("an upper bound the same way", () => {
    const fran = createField({ type: "date", maxDate: "2026-03-01", maxDateLabel: "Till" });

    expect(PageFieldValidationService.getMessage(fran, "2026-03-02")).toBe(
      "Datumet måste vara samma som eller före Till.",
    );
  });
});

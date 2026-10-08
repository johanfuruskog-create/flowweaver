import { describe, expect, test } from "vitest";

import { dateBoundVariable, resolveDateBound, validateDate } from "./date-validator";

/**
 * Story 087: a bound may point at a variable — `{{från}}` — and is then the
 * date the visitor gave, read the moment the bound is checked.
 */
describe("a date bound that points at a variable", () => {
  test("names its variable, a fixed date or a word does not", () => {
    expect(dateBoundVariable("{{från}}")).toBe("från");
    expect(dateBoundVariable("{{ från }}")).toBe("från");
    expect(dateBoundVariable("2026-03-01")).toBeNull();
    expect(dateBoundVariable("idag")).toBeNull();
    expect(dateBoundVariable(undefined)).toBeNull();
  });

  test("resolves to the answer, and an empty answer is no bound", () => {
    expect(resolveDateBound("{{från}}", { från: "2026-03-01" })).toBe("2026-03-01");
    expect(resolveDateBound("{{från}}", { från: "" })).toBeUndefined();
    expect(resolveDateBound("{{från}}", {})).toBeUndefined();
    expect(resolveDateBound("{{från}}")).toBeUndefined();
  });

  test("an answer that is not a date is no bound either — health says so, the visitor is not stopped", () => {
    expect(resolveDateBound("{{namn}}", { namn: "Anna" })).toBeUndefined();
  });

  test("a fixed date still reads as before, answers or not", () => {
    expect(resolveDateBound("2026-03-01", { från: "2026-05-05" })).toBe("2026-03-01");
  });
});

describe("the message when the bound is another field", () => {
  test("names the field instead of the date, same day allowed", () => {
    expect(validateDate("2026-02-28", "2026-03-01", undefined, { earliest: "Från" })).toEqual({
      key: "validation.date.afterField",
      values: { field: "Från" },
    });
    expect(validateDate("2026-03-01", "2026-03-01", undefined, { earliest: "Från" })).toBeNull();
    expect(validateDate("2026-03-02", undefined, "2026-03-01", { latest: "Till" })).toEqual({
      key: "validation.date.beforeField",
      values: { field: "Till" },
    });
  });

  test("a fixed bound keeps naming the date", () => {
    expect(validateDate("2026-02-28", "2026-03-01")).toEqual({
      key: "validation.date.min",
      values: { date: "2026-03-01" },
    });
  });
});

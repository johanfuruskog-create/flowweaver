import { describe, expect, test } from "vitest";

import { evaluateCondition } from "./rule-evaluator";

import type { RuleCondition } from "../types/graph";

/**
 * Comparing dates in a rule, which is what "från och till" needs.
 *
 * ## The gap this closes
 *
 * The date field stored its answer perfectly well and no rule could ask
 * anything about it but `equals`. `greater-than` read both sides with `Number`,
 * an ISO date is not a number, and the condition came back *indeterminate* —
 * so "efter den första mars" quietly could not be expressed.
 *
 * A range is two conditions under `match: "all"`: at least the first of the
 * month, at most the last. That is how somebody would say it, and it is now how
 * it is written.
 *
 * ## Why text comparison rather than parsing
 *
 * `YYYY-MM-DD` sorts correctly as text — that is the property the format was
 * designed around, and it is why the field stores it. Parsing would introduce a
 * timezone, and a timezone would introduce a day that is right in Stockholm and
 * wrong in Berlin.
 *
 * ## Mixing is refused, not guessed
 *
 * A date against a number is a misconfigured rule. It comes back as
 * indeterminate — the same answer as before, which the caller already knows how
 * to handle — rather than as a comparison of two things that are not comparable.
 */

const on = (
  operator: RuleCondition["operator"],
  value: string,
): RuleCondition => ({ id: "c", variableName: "datum", operator, value });

const judge = (condition: RuleCondition, answer: string) =>
  evaluateCondition(condition, answer);

const matches = (condition: RuleCondition, answer: string): boolean => {
  const result = judge(condition, answer);

  return result.success && result.matches;
};

describe("a date in a rule", () => {
  test("is after another date", () => {
    expect(matches(on("greater-than", "2026-03-01"), "2026-03-02")).toBe(true);
    expect(matches(on("greater-than", "2026-03-01"), "2026-02-28")).toBe(false);
    expect(matches(on("greater-than", "2026-03-01"), "2026-03-01")).toBe(false);
  });

  test("is on or after, which is what a start date means", () => {
    expect(matches(on("greater-than-or-equal", "2026-03-01"), "2026-03-01")).toBe(true);
  });

  test("is before, and on or before", () => {
    expect(matches(on("less-than", "2026-03-01"), "2026-02-28")).toBe(true);
    expect(matches(on("less-than-or-equal", "2026-03-31"), "2026-03-31")).toBe(true);
  });

  test("compares across years and months, not just digits", () => {
    // The case that catches a naive numeric parse: 2026-01-02 is not "2026102".
    expect(matches(on("greater-than", "2025-12-31"), "2026-01-01")).toBe(true);
    expect(matches(on("greater-than", "2026-09-30"), "2026-10-01")).toBe(true);
  });

  test("expresses a range as the two halves of one", () => {
    const from = on("greater-than-or-equal", "2026-03-01");
    const to = on("less-than-or-equal", "2026-03-31");

    expect(matches(from, "2026-03-15") && matches(to, "2026-03-15")).toBe(true);
    expect(matches(from, "2026-04-01") && matches(to, "2026-04-01")).toBe(false);
    expect(matches(from, "2026-02-28") && matches(to, "2026-02-28")).toBe(false);
  });
});

describe("what is not a date", () => {
  test("a number still compares as a number", () => {
    // The operators' first job, unchanged. 9 is less than 10 and would not be
    // if either side were suddenly read as text.
    expect(matches({ ...on("less-than", "10"), variableName: "antal" }, "9")).toBe(true);
  });

  test("a date against a number is refused rather than guessed", () => {
    const result = judge(on("greater-than", "10"), "2026-03-01");

    expect(result.success).toBe(false);
  });

  test("a number against a date is refused too", () => {
    expect(judge(on("greater-than", "2026-03-01"), "10").success).toBe(false);
  });

  test("something that is neither is still refused", () => {
    expect(judge(on("greater-than", "imorgon"), "idag").success).toBe(false);
  });

  test("an unanswered variable is not judged", () => {
    // Unchanged: an empty answer makes the condition indeterminate, and the
    // guide's health check is what says a question is missing.
    expect(judge(on("greater-than", "2026-03-01"), "").success).toBe(false);
  });
});

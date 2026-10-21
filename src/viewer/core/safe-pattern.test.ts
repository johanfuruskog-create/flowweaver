import { describe, expect, test } from "vitest";

import { validateFormat } from "./format-validators";
import { checkPattern } from "./safe-pattern";

/**
 * An author's pattern that can freeze the tab is not run (security review 8/10,
 * measured 9/10 — see `safe-pattern.ts`).
 */

/** The name pattern people copy, and a name with one stray character. */
const NAME_PATTERN = "^([a-zA-Z]+\\s?)+$";
/**
 * 36 characters: 5.2 s of backtracking without the guard (measured 9/10;
 * it doubles per word), so the timing test below fails clearly but does not
 * hang the run. A longer name would make the mutation a frozen worker.
 */
const NAME_WITH_STRAY = "Anna Andersson Svensson Karlsson Ek!";

describe("a pattern that backtracks exponentially is not run", () => {
  test("the name pattern answers at once instead of freezing the tab", () => {
    const started = performance.now();
    const verdict = validateFormat("regex", NAME_PATTERN, NAME_WITH_STRAY);
    const took = performance.now() - started;

    // Let through, like a pattern that does not compile (format-validators.ts).
    expect(verdict).toBeNull();
    expect(took).toBeLessThan(100);
  });

  test.each([
    ["the textbook case", "^(a+)+$"],
    ["the name pattern", NAME_PATTERN],
    ["a repeated group with an optional part", "^(\\d+-?)*$"],
    ["a repeated alternation", "^(a|a)+$"],
    ["a group repeated a fixed number of times", "^(a+){10}$"],
    ["a repeated non-capturing group", "^(?:[a-z]+ ?)+$"],
    ["a quantified group inside a repeated group", "^((ab)*c)+$"],
    ["a lazy repeat", "^(a+?)+?$"],
    ["a numbered backreference", "^(a)\\1$"],
    ["a named backreference", "^(?<x>a)\\k<x>$"],
  ])("refuses %s: %s", (_name, pattern) => {
    expect(checkPattern(pattern)).toBe("unsafe");
  });

  test("says when a pattern does not compile, which is a different fault", () => {
    expect(checkPattern("(")).toBe("invalid");
  });
});

describe("the patterns people actually write still validate", () => {
  test.each([
    // The ones in the repo's own guides and tests (grep 9/10).
    "^\\d{6}$",
    "^\\d{3}-\\d{2}-\\d{4}$",
    "^[A-Z]{3}$",
    "^\\d{5}$",
    "^A\\d+$",
    "^ABC\\d+$",
    // And the shapes a Swedish form asks for.
    "^\\d{3} ?\\d{2}$",
    "^(\\+46|0)\\d{9}$",
    "^(\\d{3}-){2}\\d{4}$",
    "^(?:\\d{3})+$",
    "^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$",
    "^[A-ZÅÄÖ][a-zåäö]+(-[A-ZÅÄÖ][a-zåäö]+)?$",
    // Brackets and braces that are not what they look like.
    "^[(+)]{2}$",
    "^a{,3}$",
    "^\\(\\d+\\)+$",
    "^[\\]]+$",
  ])("%s", (pattern) => {
    expect(checkPattern(pattern)).toBe("ok");
  });

  test("and a safe pattern still refuses what it should", () => {
    expect(validateFormat("regex", "^\\d{3} ?\\d{2}$", "123 45")).toBeNull();
    expect(validateFormat("regex", "^\\d{3} ?\\d{2}$", "12a45")).toBe("validation.format.pattern");
  });
});

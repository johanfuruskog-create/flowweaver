import { describe, expect, test } from "vitest";

import { TemplateVariableService } from "./template-variable-service";

import type { GraphData } from "../types/graph";

/**
 * A number in a sentence is the number that was stored.
 *
 * `toLocaleString` defaults to three decimals, so a stored `1234.5678` was
 * reported as `1 234,568` — a different number, quietly, in the sentence the
 * resident is meant to act on. Rounding may well be what an author wants, but
 * it has to be something they chose rather than a default nobody saw.
 *
 * The same function also refused to read a value that starts or ends with the
 * decimal mark. `.5` is what `ungroup` stores when somebody types `,5`, and it
 * came out as `.5` — a raw period in the middle of Swedish prose.
 */

/** Non-breaking space — what Swedish groups with. */
const NBSP = " ";

const graph = {
  startNodeId: "n",
  settings: { sourceLocale: "sv" },
  nodes: [
    {
      id: "n",
      type: "number-question",
      position: { x: 0, y: 0 },
      data: { title: { sv: "Tal" }, variableName: "v" },
    },
  ],
  connections: [],
} as unknown as GraphData;

const shown = (stored: string, locale = "sv"): string =>
  TemplateVariableService.resolve("{{v}}", { v: stored }, graph, locale).resolved;

describe("decimals", () => {
  test("survive past the third one", () => {
    expect(shown("1234.5678")).toBe(`1${NBSP}234,5678`);
  });

  test("and a long fraction is not rounded away either", () => {
    expect(shown("0.123456")).toBe("0,123456");
  });

  test("while a whole number stays whole", () => {
    expect(shown("600000")).toBe(`600${NBSP}000`);
  });
});

describe("values written the way a field stores them", () => {
  test("a bare fraction gets its zero", () => {
    // `,5` typed into an amount field is stored as `.5`.
    expect(shown(".5")).toBe("0,5");
  });

  test("and a trailing separator is not a decimal at all", () => {
    expect(shown("1234,")).toBe(`1${NBSP}234`);
  });
});

describe("what is not arithmetic", () => {
  test("is left exactly as it was", () => {
    // The rule this function opens with: a variable holding prose is prose.
    expect(shown("12 rum och kök")).toBe("12 rum och kök");
    expect(shown("1e6")).toBe("1e6");
    expect(shown("")).toBe("");
  });
});

describe("the language still decides the separators", () => {
  test("English groups with a comma and marks decimals with a period", () => {
    expect(shown("1234.5678", "en")).toBe("1,234.5678");
  });
});

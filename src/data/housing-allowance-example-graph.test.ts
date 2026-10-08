import { describe, expect, test } from "vitest";

import { resolveText } from "../viewer/core/localized-text";

import "../viewer/node-types/default-node-types";
import { GuideTraversalEngine } from "../viewer/core/guide-traversal-engine";
import { housingAllowanceExampleGraph } from "./housing-allowance-example-graph";

const VALID_PNR = "811228-9874"; // giltig Luhn-kontroll

describe("housing-allowance-example-graph", () => {
  test("valid answers lead all the way to the receipt", () => {
    const engine = new GuideTraversalEngine(housingAllowanceExampleGraph);
    for (const value of [VALID_PNR, "5000", "65", "300000"]) {
      const result = engine.answerValue(value);
      expect(result.success).toBe(true);
    }
    const current = engine.getCurrentNode();
    expect(resolveText(current?.data.title)).toBe("Tack – underlaget är komplett");
  });

  test("ogiltigt personnummer stoppas av formatvalideringen", () => {
    const engine = new GuideTraversalEngine(housingAllowanceExampleGraph);
    const result = engine.answerValue("123456-7890");
    expect(result.success).toBe(false);
  });

  test("boendekostnad under noll stoppas av sifferintervallet", () => {
    const engine = new GuideTraversalEngine(housingAllowanceExampleGraph);
    expect(engine.answerValue(VALID_PNR).success).toBe(true);
    expect(engine.answerValue("-1").success).toBe(false);
  });

  test("a floor area above the cap is stopped by the number range", () => {
    const engine = new GuideTraversalEngine(housingAllowanceExampleGraph);
    expect(engine.answerValue(VALID_PNR).success).toBe(true);
    expect(engine.answerValue("5000").success).toBe(true);
    expect(engine.answerValue("600").success).toBe(false);
  });
});

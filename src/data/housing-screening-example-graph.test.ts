import { describe, expect, test } from "vitest";

import { resolveText } from "../viewer/core/localized-text";

import "../viewer/node-types/default-node-types";
import { GuideTraversalEngine } from "../viewer/core/guide-traversal-engine";
import { housingScreeningExampleGraph } from "./housing-screening-example-graph";

function resultTitle(answers: string[]): string {
  const engine = new GuideTraversalEngine(housingScreeningExampleGraph);
  for (const answer of answers) {
    const result = engine.answerValue(answer);
    if (!result.success) {
      throw new Error(`Kunde inte svara "${answer}": ${result.error.message}`);
    }
  }
  return resolveText(engine.getCurrentNode()?.data.title);
}

describe("housing-screening-example-graph", () => {
  test("has children: the family result (the rule picks children first)", () => {
    expect(resultTitle(["hs-barn-ja", "hs-ung-nej"])).toBe(
      "Du kan ha rätt till bostadsbidrag"
    );
    // Young plus children too: the children branch wins (first matching rule).
    expect(resultTitle(["hs-barn-ja", "hs-ung-ja"])).toBe(
      "Du kan ha rätt till bostadsbidrag"
    );
  });

  test("inga barn men under 29 → ung-resultat", () => {
    expect(resultTitle(["hs-barn-nej", "hs-ung-ja"])).toBe(
      "Du kan ha rätt till bostadsbidrag som ung"
    );
  });

  test("inga barn och inte ung → annars-resultat", () => {
    expect(resultTitle(["hs-barn-nej", "hs-ung-nej"])).toBe(
      "Bostadsbidrag är ovanligt i din situation"
    );
  });
});

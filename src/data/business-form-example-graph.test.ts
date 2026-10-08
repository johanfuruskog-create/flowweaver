import { describe, expect, test } from "vitest";

import { resolveText } from "../viewer/core/localized-text";

import "../viewer/node-types/default-node-types";
import { GuideTraversalEngine } from "../viewer/core/guide-traversal-engine";
import { businessFormExampleGraph } from "./business-form-example-graph";

function titleAfter(answers: string[]): string {
  const engine = new GuideTraversalEngine(businessFormExampleGraph);
  let node = "";
  for (const answer of answers) {
    const result = engine.answerValue(answer);
    if (!result.success) throw new Error(`Kunde inte svara "${answer}": ${result.error.message}`);
    node = resolveText(result.node.data.title);
  }
  return node;
}

describe("business-form-example-graph", () => {
  test("ensam + enkelt → Enskild firma", () => {
    expect(titleAfter(["bf-solo-alone", "bf-goal-simple"])).toBe(
      "Enskild firma passar dig"
    );
  });

  test("ensam + skilja ekonomi → Aktiebolag", () => {
    expect(titleAfter(["bf-solo-alone", "bf-goal-separate"])).toBe(
      "Aktiebolag passar dig"
    );
  });

  test("together plus limited liability yields Aktiebolag", () => {
    expect(titleAfter(["bf-solo-together", "bf-team-limited"])).toBe(
      "Aktiebolag passar dig"
    );
  });

  test("tillsammans + personligt ansvar → Handelsbolag", () => {
    expect(titleAfter(["bf-solo-together", "bf-team-personal"])).toBe(
      "Handelsbolag kan passa er"
    );
  });
});

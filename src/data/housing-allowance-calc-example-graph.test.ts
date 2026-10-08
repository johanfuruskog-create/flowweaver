import { describe, expect, test } from "vitest";

import { resolveText } from "../viewer/core/localized-text";

import "../viewer/node-types/default-node-types";
import { GuideTraversalEngine } from "../viewer/core/guide-traversal-engine";
import { housingAllowanceCalcExampleGraph } from "./housing-allowance-calc-example-graph";

/** Runs through the guide with the given values and returns the end node plus the answers. */
function run(values: {
  boendekostnad: string;
  antalBarn: string;
  arsinkomst: string;
}) {
  const engine = new GuideTraversalEngine(housingAllowanceCalcExampleGraph);
  for (const value of [
    values.boendekostnad,
    values.antalBarn,
    values.arsinkomst,
  ]) {
    const result = engine.answerValue(value);
    if (!result.success) {
      throw new Error(`Kunde inte svara "${value}": ${result.error.message}`);
    }
  }
  return { node: engine.getCurrentNode(), answers: engine.getAnswers() };
}

describe("housing-allowance-calc-example-graph", () => {
  test("low income: the allowance is computed and the rule branches to 'har bidrag'", () => {
    // ersattningsgrundande = min(6000;5000)=5000 -> grund=2500
    // barntillägg = 2*1500=3000
    // inkomstavdrag = max(0;(120000-150000)/12*0.2)=0
    // manadsbidrag = round(2500+3000-0)=5500
    const { node, answers } = run({
      boendekostnad: "6000",
      antalBarn: "2",
      arsinkomst: "120000",
    });
    expect(answers.manadsbidrag).toBe("5500");
    expect(resolveText(node?.data.title)).toBe("Du kan ha rätt till bostadsbidrag");
  });

  test("high income: the deduction eats the allowance and the rule branches to 'inget bidrag'", () => {
    // grund=2500, barntillagg=0
    // inkomstavdrag = (600000-150000)/12*0.2 = 7500 → manadsbidrag=max(0,2500-7500)=0
    const { node, answers } = run({
      boendekostnad: "6000",
      antalBarn: "0",
      arsinkomst: "600000",
    });
    expect(answers.manadsbidrag).toBe("0");
    expect(resolveText(node?.data.title)).toBe("Inget preliminärt bostadsbidrag");
  });
});

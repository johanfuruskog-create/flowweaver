import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "../core/guide-traversal-engine";
import { TemplateVariableService } from "./template-variable-service";
import { loanExampleGraph } from "../../data/loan-example-graph";
import { serviceCallExampleGraph } from "../../data/service-call-example-graph";

/**
 * A calculated amount is grouped the same way an answered one is.
 *
 * ## The fault
 *
 * Measured in one sentence of the loan guide's verdict:
 *
 *     "Med en årsinkomst på 420000 kr … Med 400 000 kr sparat"
 *
 * The answer grouped, the calculation not, three words apart. Nobody would
 * defend it if asked; it survived because nobody read the two together.
 *
 * ## Why it happened
 *
 * The template asked for it and never got it. Grouping is applied when the
 * variable's source node is a number question **or a calculation** — and the
 * lookup matched `node.data.variableName`, which a calculation node does not
 * have: its variables live in `assignments`. So `source` was always undefined
 * for anything computed, and the branch naming `"calculation"` could never be
 * true. A condition that cannot fire is worse than a missing one, because it
 * reads as covered.
 *
 * Hence a test that goes through the engine rather than a fabricated answers
 * object: the fault was in finding the node, so a fixture that hands the
 * variables over directly would have proved nothing.
 */

describe("beskedets siffror", () => {
  test("grupperas oavsett om de svarats eller räknats fram", () => {
    const engine = new GuideTraversalEngine(loanExampleGraph);

    engine.answerValue("35000");
    engine.answer("ensam");
    engine.answerValue("400000");

    const resolved = TemplateVariableService.resolve(
      "{{arsinkomst}} · {{maxlan}} · {{sparat}} · {{maxpris}}",
      engine.getAnswers(),
      loanExampleGraph,
      "sv",
    ).resolved;

    /*
     * Non-breaking spaces, asserted rather than glossed: a plain space would let
     * `2 100 000` wrap across two lines and be read as two numbers.
     */
    expect(resolved).toBe("420 000 · 2 100 000 · 400 000 · 2 470 588");
  });

  test("och lagringen bär siffrorna orörda", () => {
    /*
     * Johan's rule, on the other side of the same value: the variable is what a
     * later calculation and the host read, and a space in it breaks both.
     */
    const engine = new GuideTraversalEngine(loanExampleGraph);

    engine.answerValue("35000");
    engine.answer("ensam");
    engine.answerValue("400000");

    expect(engine.getAnswers().arsinkomst).toBe("420000");
    expect(engine.getAnswers().maxlan).toBe("2100000");
  });
});

/**
 * The same fault, one node type further along: a variable a SERVICE brought
 * back.
 *
 * Found in the claim example (story 105), where the deductible comes from the
 * insurer's register and the payout from a calculation, in one sentence:
 *
 *     "**18 500 kr** betalas ut … efter självrisken på 1500 kr."
 *
 * The source lookup knew two shapes — `data.variableName` and a calculation's
 * `assignments` — and a service call's variables live in a third,
 * `responseMappings`. So `source` was undefined again, for exactly the reason
 * the loan guide's was, and the guide's own result text ("Du kan låna upp till
 * {{maxLoan}} kr") had been ungrouped on the site the whole time.
 */
describe("siffror som en tjänst svarat med", () => {
  test("grupperas som svarade och uträknade", () => {
    const engine = new GuideTraversalEngine(serviceCallExampleGraph);

    engine.answerValue("42000");
    engine.answerValue("350000");

    expect(
      TemplateVariableService.resolve(
        "{{maxLoan}}",
        engine.getAnswers(),
        serviceCallExampleGraph,
        "sv",
      ).resolved,
    ).toBe("2\u00a0550\u00a0000");
  });

  test("men en text som inte är ett tal lämnas i fred", () => {
    // `decision` är "approved" — ett ord tjänsten svarade med, inte ett belopp.
    const engine = new GuideTraversalEngine(serviceCallExampleGraph);

    engine.answerValue("42000");
    engine.answerValue("350000");

    expect(
      TemplateVariableService.resolve(
        "{{decision}}",
        engine.getAnswers(),
        serviceCallExampleGraph,
        "sv",
      ).resolved,
    ).toBe("approved");
  });
});

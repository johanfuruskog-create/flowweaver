import { describe, expect, test } from "vitest";

import { loanCalculatorExampleGraph } from "./loan-calculator-example-graph";

/*
 * The open loan calculator (Johan 8/10): the slider and the live cost are
 * open, so the open guide must not lean on anything only PRO offers — or the
 * open FlowWeaver would show an example its own editor cannot build.
 */
const ONLY_PRO = ["text-question", "rating-question", "consent-question", "file-question", "review", "submit-result", "email-result"];

describe("loan-calculator-example-graph", () => {
  test("uses only what the open FlowWeaver offers", () => {
    const types = loanCalculatorExampleGraph.nodes.map((node) => node.type);
    for (const type of ONLY_PRO) expect(types, type).not.toContain(type);
  });

  test("the page counts with a slider and ends in a result that shows the cost", () => {
    const amount = loanCalculatorExampleGraph.nodes.find((node) => node.id === "loan-amount");
    expect(amount?.data.presentation).toBe("range");
    const ends = loanCalculatorExampleGraph.nodes.filter((node) => node.type === "result");
    expect(ends).toHaveLength(1);
    expect(JSON.stringify(ends[0].data.description)).toContain("{{kostnad}}");
    expect(loanCalculatorExampleGraph.connections).toContainEqual(
      expect.objectContaining({ from: { nodeId: "loan-page", portId: "continue" }, to: { nodeId: ends[0].id, portId: "input" } })
    );
  });
});

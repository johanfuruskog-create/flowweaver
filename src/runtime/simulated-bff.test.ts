import { describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import { SimulatedBff } from "./simulated-bff";

import type { GraphData } from "../viewer/types/graph";

// Miniatyr-bolånetjänst: sifferfråga → uträkning → resultat.
const graph: GraphData = {
  startNodeId: "pris",
  nodes: [
    { id: "pris", type: "number-question", position: { x: 0, y: 0 }, data: { title: "Bostadspris", variableName: "pris", unit: "kr" } },
    {
      id: "calc",
      type: "calculation",
      position: { x: 300, y: 0 },
      data: {
        title: "Kalkyl",
        assignments: [{ id: "a1", variableName: "maxLån", formula: "min(pris * 0,85 ; 3000000)" }],
      },
    },
    { id: "result", type: "result", position: { x: 600, y: 0 }, data: { title: "Klart", description: "Du kan låna {{maxLån}} kr." } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "pris", portId: "continue" }, to: { nodeId: "calc", portId: "input" } },
    { id: "c2", from: { nodeId: "calc", portId: "continue" }, to: { nodeId: "result", portId: "input" } },
  ],
};

describe("SimulatedBff", () => {
  test("hands out only view models and hides the formulas", () => {
    const bff = new SimulatedBff(graph);

    const first = bff.currentStep();
    expect(first).toMatchObject({ kind: "number", title: "Bostadspris" });

    const result = bff.answerValue("3000000");
    expect(result.kind).toBe("result");
    if (result.kind !== "result") throw new Error("Förväntade ett resultat.");
    /*
     * Grouped, because that is what somebody reads. It said `2550000` until a
     * calculated amount started being grouped the way an answered one always
     * was — the marker was the raw digits, not the claim, and the claim here is
     * that the *value* comes out and the formula does not.
     */
    expect(result.body).toContain("2\u00a0550\u00a0000");

    // No part of what left the BFF contains the formula.
    const everythingSeen = JSON.stringify([first, result]);
    expect(everythingSeen).not.toContain("min(");
    expect(everythingSeen).not.toContain("* 0,85");
    expect(everythingSeen).not.toContain("assignments");
  });

  test("supports back and restart", () => {
    const bff = new SimulatedBff(graph);
    bff.answerValue("3000000");

    const back = bff.back();
    expect(back).toMatchObject({ kind: "number" });

    const restarted = bff.restart();
    expect(restarted).toMatchObject({ kind: "number", canGoBack: false });
  });

  test("den ursprungliga grafen kan inte muteras via BFF:en", () => {
    const source = structuredClone(graph);
    const bff = new SimulatedBff(source);
    bff.answerValue("3000000");

    // Konstruktorn tog en egen kopia – ingången är orörd.
    expect(source).toEqual(graph);
  });
});

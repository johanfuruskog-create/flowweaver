import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";

import type { GraphData } from "../types/graph";

// Question (price) → Calculation → Result with {{lån}}.
const graph: GraphData = {
  startNodeId: "pris",
  nodes: [
    { id: "pris", type: "number-question", position: { x: 0, y: 0 }, data: { title: "Pris", variableName: "pris" } },
    {
      id: "calc",
      type: "calculation",
      position: { x: 300, y: 0 },
      data: {
        title: "Uträkning",
        assignments: [
          { id: "a1", variableName: "kontantinsats", formula: "pris * 0,15" },
          { id: "a2", variableName: "lån", formula: "pris - kontantinsats" },
          { id: "a3", variableName: "maxLån", formula: "min(pris * 0,85 ; 3000000)" },
        ],
      },
    },
    { id: "result", type: "result", position: { x: 600, y: 0 }, data: { title: "Klart", description: "Lån: {{lån}}" } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "pris", portId: "continue" }, to: { nodeId: "calc", portId: "input" } },
    { id: "c2", from: { nodeId: "calc", portId: "continue" }, to: { nodeId: "result", portId: "input" } },
  ],
};

describe("traversal through a calculation node", () => {
  test("computes the variables and passes automatically on to the result", () => {
    const engine = new GuideTraversalEngine(graph);
    const result = engine.answerValue("3000000");

    // The calculation node is never "current" — it is passed automatically.
    expect(result.success).toBe(true);
    expect(engine.getCurrentNode()?.id).toBe("result");

    // The computed variables are present in the answers.
    expect(engine.getAnswers()).toMatchObject({
      pris: "3000000",
      kontantinsats: "450000",
      "lån": "2550000",
      "maxLån": "2550000",
    });
  });
});

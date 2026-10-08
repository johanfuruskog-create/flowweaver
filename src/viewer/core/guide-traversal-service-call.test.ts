import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";
import { ServiceCallService } from "../services/service-call-service";

import type { GraphData } from "../types/graph";

// Number question → Service call (mock) → Result with {{maxLån}}.
const graph: GraphData = {
  startNodeId: "pris",
  nodes: [
    { id: "pris", type: "number-question", position: { x: 0, y: 0 }, data: { title: "Pris", variableName: "pris" } },
    {
      id: "svc",
      type: "service-call",
      position: { x: 300, y: 0 },
      data: {
        title: "Bolånebeslut",
        endpoint: "/api/bolan",
        method: "POST",
        requestVariables: ["pris"],
        mockResponse: JSON.stringify({ maxLoan: 2550000, decision: "approved" }),
        responseMappings: [
          { id: "m1", field: "maxLoan", variableName: "maxLån" },
          { id: "m2", field: "decision", variableName: "beslut" },
        ],
      },
    },
    { id: "result", type: "result", position: { x: 600, y: 0 }, data: { title: "Klart", description: "Beslut: {{beslut}}, lån: {{maxLån}}." } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "pris", portId: "continue" }, to: { nodeId: "svc", portId: "input" } },
    { id: "c2", from: { nodeId: "svc", portId: "continue" }, to: { nodeId: "result", portId: "input" } },
  ],
};

describe("traversal through a service node (mock)", () => {
  test("puts the mock response into variables and passes on to the result", () => {
    const engine = new GuideTraversalEngine(graph);
    const result = engine.answerValue("3000000");

    expect(result.success).toBe(true);
    expect(engine.getCurrentNode()?.id).toBe("result");
    expect(engine.getAnswers()).toMatchObject({
      pris: "3000000",
      "maxLån": "2550000",
      beslut: "approved",
    });
  });

  test("live mode: the engine stops at the service node and awaits the real call", async () => {
    const engine = new GuideTraversalEngine(graph, { deferServiceCalls: true });

    // In live mode the service node is not passed automatically — the engine stops.
    engine.answerValue("3000000");
    expect(engine.getCurrentNode()?.id).toBe("svc");

    // The BFF makes the real call …
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ maxLoan: 1800000, decision: "approved" }),
    } as Response)) as unknown as typeof fetch;
    const node = engine.getCurrentNode()!;
    const outcome = await ServiceCallService.runLive(node, engine.getAnswers(), { fetchImpl });

    // … and feeds the response back, whereupon the engine moves on.
    const result = engine.advanceServiceCall(outcome.answers);
    expect(result.success).toBe(true);
    expect(engine.getCurrentNode()?.id).toBe("result");
    expect(engine.getAnswers()).toMatchObject({ "maxLån": "1800000", beslut: "approved" });
  });
});

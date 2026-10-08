import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";

import type { GraphData } from "../types/graph";

const graph = (extra: Record<string, unknown>): GraphData => ({
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "text-question",
      position: { x: 0, y: 0 },
      data: { variableName: "v", ...extra },
    },
    { id: "done", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
  ],
});

describe("the text question's format validation in the engine", () => {
  test("the email format blocks invalid answers and lets valid ones through", () => {
    const engine = new GuideTraversalEngine(graph({ format: "email" }));
    expect(engine.answerValue("abc").success).toBe(false);
    expect(engine.answerValue("a@b.se").success).toBe(true);
  });

  test("the personnummer format uses Luhn", () => {
    const engine = new GuideTraversalEngine(graph({ format: "personnummer" }));
    expect(engine.answerValue("811218-9875").success).toBe(false);
    expect(engine.answerValue("811218-9876").success).toBe(true);
  });

  test("utan format sker ingen formatkontroll", () => {
    const engine = new GuideTraversalEngine(graph({}));
    expect(engine.answerValue("vad som helst").success).toBe(true);
  });
});

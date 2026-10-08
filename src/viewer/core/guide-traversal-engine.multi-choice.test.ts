import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";

import type { GraphData } from "../types/graph";

const graph = (extra: Record<string, unknown>): GraphData => ({
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "multi-choice",
      position: { x: 0, y: 0 },
      data: {
        variableName: "val",
        options: [
          { id: "a", label: "A", value: "a" },
          { id: "b", label: "B", value: "b" },
          { id: "c", label: "C", value: "c" },
        ],
        ...extra,
      },
    },
    { id: "done", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
  ],
});

describe("a multi-choice question in the traversal engine", () => {
  test("requires at least minSelected choices", () => {
    const engine = new GuideTraversalEngine(graph({ minSelected: 2 }));

    const tooFew = engine.answerValue("a");
    expect(tooFew.success).toBe(false);

    const ok = engine.answerValue("a\nb");
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.node.id).toBe("done");
    expect(engine.getAnswers().val).toBe("a\nb");
  });

  test("allows at most maxSelected choices", () => {
    const engine = new GuideTraversalEngine(graph({ maxSelected: 2 }));
    expect(engine.answerValue("a\nb\nc").success).toBe(false);
    expect(engine.answerValue("a\nb").success).toBe(true);
  });

  test("required demands at least one choice", () => {
    const engine = new GuideTraversalEngine(graph({ required: true }));
    expect(engine.answerValue("").success).toBe(false);
    expect(engine.answerValue("a").success).toBe(true);
  });

  test("discounts unknown values", () => {
    const engine = new GuideTraversalEngine(graph({ minSelected: 2 }));
    // Only "a" is valid, so it does not reach at least 2.
    expect(engine.answerValue("a\nOKÄND").success).toBe(false);
  });

  test("without rules, no choice is enough (an optional question)", () => {
    const engine = new GuideTraversalEngine(graph({}));
    const ok = engine.answerValue("");
    expect(ok.success).toBe(true);
  });
});

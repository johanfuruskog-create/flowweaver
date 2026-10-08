import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";
import { todayIso } from "./date-math";

import type { GraphData } from "../types/graph";

/*
 * Story 086: `idag` is the engine's day. One clock for the date bound, the
 * formula and the text — and the host can set it, so a run over New Year
 * answers the same on both sides of midnight.
 */

const graph = (): GraphData => ({
  startNodeId: "flytt",
  nodes: [
    {
      id: "flytt",
      type: "date-question",
      position: { x: 0, y: 0 },
      data: { variableName: "flytt", max: "idag" },
    },
    {
      id: "calc",
      type: "calculation",
      position: { x: 0, y: 0 },
      data: {
        assignments: [
          { id: "a1", variableName: "dagar", formula: "days(flytt; idag)" },
          { id: "a2", variableName: "alder", formula: "age(pnr)" },
        ],
      },
    },
    { id: "done", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart {{idag}}" } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "flytt", portId: "continue" }, to: { nodeId: "calc", portId: "input" } },
    { id: "c2", from: { nodeId: "calc", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
  ],
});

describe("idag i motorn (story 086)", () => {
  test("värdens dag styr gränsen, uträkningen och texten", () => {
    const engine = new GuideTraversalEngine(graph(), { today: "2026-10-04" });
    engine.seedAnswers({ pnr: "20080904-1234", idag: "1999-01-01" });

    expect(engine.answerValue("2026-10-05").success).toBe(false);
    expect(engine.answerValue("2026-08-05").success).toBe(true);

    expect(engine.getScope()).toMatchObject({ dagar: "60", alder: "18", idag: "2026-10-04" });
    expect(engine.getAnswers()).toEqual({ pnr: "20080904-1234", flytt: "2026-08-05", dagar: "60", alder: "18" });
  });

  test("utan värdens dag gäller klockan, och den överlever en omstart", () => {
    const engine = new GuideTraversalEngine(graph());
    expect(engine.getScope().idag).toBe(todayIso());

    engine.restart();
    expect(engine.getScope().idag).toBe(todayIso());
    expect(engine.getAnswers()).toEqual({});
  });

  test("en dag som inte finns är ingen dag — klockan gäller", () => {
    const engine = new GuideTraversalEngine(graph(), { today: "2026-02-30" });
    expect(engine.getScope().idag).toBe(todayIso());
  });
});

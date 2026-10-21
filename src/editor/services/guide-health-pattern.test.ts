import { describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";
import { GuideHealthService } from "./guide-health-service";

import type { GraphData } from "../../viewer/types/graph";

/**
 * The viewer skips a field's pattern when it does not compile or can freeze the
 * tab (`viewer/core/safe-pattern.ts`). This is the half that tells the editor,
 * so the rule they set is never dropped in silence (PRAXIS 35).
 */
const guide = (data: Record<string, unknown>): GraphData => ({
  startNodeId: "namn",
  nodes: [
    { id: "namn", type: "text-question", position: { x: 0, y: 0 }, data: { title: "Ditt namn", variableName: "namn", ...data } },
    { id: "klart", type: "result", position: { x: 300, y: 0 }, data: { title: "Klart" } },
  ],
  connections: [
    { id: "c", from: { nodeId: "namn", portId: "continue" }, to: { nodeId: "klart", portId: "input" } },
  ],
});

const found = (graph: GraphData) =>
  GuideHealthService.analyze(graph)
    .filter((issue) => issue.code === "pattern-not-run")
    .map((issue) => [issue.severity, issue.nodeId, issue.field, issue.message]);

describe("a pattern the viewer does not run is named in the health check", () => {
  test("one that can freeze the tab", () => {
    expect(found(guide({ format: "regex", pattern: "^([a-zA-Z]+\\s?)+$" }))).toEqual([
      [
        "error",
        "namn",
        "pattern",
        '"Ditt namn": mönstret kan låsa besökarens webbläsare och används därför inte — en grupp som upprepas får inte själv innehålla +, *, ? eller |, som i ([a-z]+ ?)+.',
      ],
    ]);
  });

  test("one that does not compile", () => {
    expect(found(guide({ format: "regex", pattern: "(" }))).toEqual([
      [
        "error",
        "namn",
        "pattern",
        '"Ditt namn": mönstret går inte att läsa, så svaret kontrolleras inte — rätta det eller välj ett namngivet format.',
      ],
    ]);
  });

  test("a safe pattern, an empty one, and one left behind by another format say nothing", () => {
    expect(found(guide({ format: "regex", pattern: "^\\d{3} ?\\d{2}$" }))).toEqual([]);
    expect(found(guide({ format: "regex", pattern: "" }))).toEqual([]);
    // The viewer reads `pattern` only for `regex`; a leftover is not run, and not a fault.
    expect(found(guide({ format: "email", pattern: "^(a+)+$" }))).toEqual([]);
  });
});

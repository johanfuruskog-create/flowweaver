import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import {
  countedStepsAhead,
  guideProgress,
  isCountedStep,
  longestCountedRoute,
} from "./guide-route-analyzer";
import { BUNDLED_GRAPHS } from "../../data/bundled-graphs";

import type { GraphData } from "../types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../testing/optional-pro";
const { surveyExampleGraph } = ((await proModule("data/survey-example-graph.ts")) ?? {}) as { surveyExampleGraph: GraphData };
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * The way from the start to a node, as the ids of the connections traversed.
 *
 * `guideProgress` is given the run's own trail rather than a node id, because
 * two runs can stand on the same node having answered a different number of
 * questions. These tests therefore have to walk the graph the way a run does.
 */
function connectionsTo(graph: GraphData, wanted: string): string[] {
  const walk = (nodeId: string, trail: string[], seen: Set<string>): string[] | null => {
    if (nodeId === wanted) return trail;
    if (seen.has(nodeId)) return null;

    const next = new Set(seen).add(nodeId);

    for (const connection of graph.connections.filter(
      (candidate) => candidate.from.nodeId === nodeId
    )) {
      const found = walk(connection.to.nodeId, [...trail, connection.id], next);
      if (found) return found;
    }

    return null;
  };

  const found = graph.startNodeId ? walk(graph.startNodeId, [], new Set()) : null;

  if (!found) throw new Error(`no route to ${wanted}`);

  return found;
}

describe("what the meter counts", () => {
  test.runIf(PRO)("a question and a page are steps; a rule, a result and a page field are not", () => {
    const counted = surveyExampleGraph.nodes
      .filter((node) => isCountedStep(node))
      .map((node) => node.id);

    expect(counted).toEqual([
      "survey-participate",
      "survey-home",
      "survey-landlord",
      "survey-improve",
      "survey-summary",
    ]);
  });

  test.runIf(PRO)("the survey's longest route is those five steps", () => {
    expect(longestCountedRoute(surveyExampleGraph)).toBe(5);
  });

  test.runIf(PRO)("four counted steps lie ahead of the first question", () => {
    expect(countedStepsAhead(surveyExampleGraph, "survey-participate")).toBe(4);
  });

  test.runIf(PRO)("nothing lies ahead of the last page — review and submit are not counted", () => {
    expect(countedStepsAhead(surveyExampleGraph, "survey-summary")).toBe(0);
  });
});

/*
 * QA, independent of the developer's own mutation control: `longestRouteFrom`
 * picks the longest branch with `Math.max(...ahead)` over every outgoing
 * connection, not the `default` port and not the first one written down. The
 * survey's own rule (`survey-low`) happens to have its longer branch behind a
 * *case* port, but its longer branch is also the connection listed first in
 * the file — a mutation that took `ahead[0]` instead of the max would still
 * pass every existing assertion on the survey by coincidence.
 *
 * This fixture pins both orderings the wrong way at once: the `default` port
 * is both the SHORTER branch and the FIRST connection written down, and the
 * case port is both the LONGER branch and the SECOND. Nothing here can be
 * satisfied by "take default" or "take the first branch" — only by the max.
 */
describe("a rule whose longest branch is neither default nor first", () => {
  const graph: GraphData = {
    startNodeId: "start-question",
    nodes: [
      { id: "start-question", type: "question", position: { x: 0, y: 0 }, data: {} },
      { id: "the-rule", type: "rule", position: { x: 0, y: 0 }, data: {} },
      // The short branch: one page, then nothing.
      { id: "short-page", type: "page", position: { x: 0, y: 0 }, data: {} },
      // The long branch: two more questions and a page — three counted steps.
      { id: "long-question-a", type: "question", position: { x: 0, y: 0 }, data: {} },
      { id: "long-question-b", type: "question", position: { x: 0, y: 0 }, data: {} },
      { id: "long-page", type: "page", position: { x: 0, y: 0 }, data: {} },
    ],
    connections: [
      { id: "c-start", from: { nodeId: "start-question", portId: "continue" }, to: { nodeId: "the-rule", portId: "input" } },
      // default, and written first — and still the shorter branch.
      { id: "c-default", from: { nodeId: "the-rule", portId: "default" }, to: { nodeId: "short-page", portId: "input" } },
      // a named case, written second — and the longer branch.
      { id: "c-case", from: { nodeId: "the-rule", portId: "case-big" }, to: { nodeId: "long-question-a", portId: "input" } },
      { id: "c-long-1", from: { nodeId: "long-question-a", portId: "continue" }, to: { nodeId: "long-question-b", portId: "input" } },
      { id: "c-long-2", from: { nodeId: "long-question-b", portId: "continue" }, to: { nodeId: "long-page", portId: "input" } },
    ],
  };

  test("countedStepsAhead follows the longer branch, not the default port", () => {
    expect(countedStepsAhead(graph, "the-rule")).toBe(3);
  });

  test("longestCountedRoute counts the question, then the longer branch", () => {
    expect(longestCountedRoute(graph)).toBe(4);
  });

  test("the share after taking the long branch reflects two steps still ahead", () => {
    expect(
      guideProgress(graph, ["c-start", "c-case"], "long-question-a")
    ).toEqual({ taken: 2, ahead: 2, percent: 50 });
  });
});

describe("the share", () => {
  /*
   * The number Johan counted by hand before anything was built (story 116,
   * criterion 2). If this moves, the calculation moved — not the expectation.
   */
  test.runIf(PRO)("the survey's first question reads 20 %", () => {
    expect(
      guideProgress(surveyExampleGraph, [], "survey-participate")
    ).toEqual({ taken: 1, ahead: 4, percent: 20 });
  });

  test.runIf(PRO)("the survey's last page reads 100 %", () => {
    expect(
      guideProgress(
        surveyExampleGraph,
        connectionsTo(surveyExampleGraph, "survey-summary"),
        "survey-summary"
      )
    ).toEqual({ taken: 5, ahead: 0, percent: 100 });
  });

  test("a full step is never rounded up to while a question remains", () => {
    // 199 pages in a row: 199/200 rounds to 100, and saying so would promise an
    // end that is not there.
    const nodes = Array.from({ length: 200 }, (_, index) => ({
      id: `p${index}`,
      type: "page",
      position: { x: 0, y: 0 },
      data: {},
    }));
    const graph: GraphData = {
      startNodeId: "p0",
      nodes,
      connections: nodes.slice(1).map((node, index) => ({
        id: `c${index}`,
        from: { nodeId: `p${index}`, portId: "continue" },
        to: { nodeId: node.id, portId: "input" },
      })),
    };

    expect(
      guideProgress(graph, connectionsTo(graph, "p198"), "p198")
    ).toMatchObject({ taken: 199, ahead: 1, percent: 99 });
  });

  test("a cycle answers with a number instead of hanging", () => {
    const graph: GraphData = {
      startNodeId: "a",
      nodes: [
        { id: "a", type: "page", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "page", position: { x: 0, y: 0 }, data: {} },
      ],
      connections: [
        {
          id: "c1",
          from: { nodeId: "a", portId: "continue" },
          to: { nodeId: "b", portId: "input" },
        },
        {
          id: "c2",
          from: { nodeId: "b", portId: "continue" },
          to: { nodeId: "a", portId: "input" },
        },
      ],
    };

    expect(guideProgress(graph, [], "a")).toEqual({
      taken: 1,
      ahead: 1,
      percent: 50,
    });
  });

  test.runIf(PRO)("a step with no run behind it is a picture, not a share", () => {
    // The editor's still picture of one step: `goToNode` leaves no trail, and
    // the node is not the guide's first.
    expect(
      guideProgress(surveyExampleGraph, [], "survey-improve")
    ).toBeNull();
  });

  test("a guide with nothing to count has no share", () => {
    const graph: GraphData = {
      startNodeId: "r",
      nodes: [{ id: "r", type: "result", position: { x: 0, y: 0 }, data: {} }],
      connections: [],
    };

    expect(guideProgress(graph, [], "r")).toBeNull();
  });
});

/**
 * Criterion 3: the share can never go down.
 *
 * Every route from every bundled guide's start, walked step by step, with the
 * number the meter would have shown at each. The guarantee is structural —
 * each step taken spends one step out of the longest remaining route — so this
 * is a check on the code keeping the guarantee, not a hope about the examples.
 *
 * A node is walked once per route: that bounds the cycles without hiding them,
 * since a loop's second lap is the same nodes in the same order.
 */
describe("the share never goes down", () => {
  test.each(BUNDLED_GRAPHS)("%s", (_, graph) => {
    const fallen: string[] = [];

    const walk = (nodeId: string, trail: string[], seen: Set<string>, before: number): void => {
      if (seen.has(nodeId)) return;

      const progress = guideProgress(graph, trail, nodeId);
      const now = progress?.percent ?? before;

      if (now < before) {
        fallen.push(`${nodeId}: ${before} % → ${now} %`);
      }

      const next = new Set(seen).add(nodeId);

      graph.connections
        .filter((connection) => connection.from.nodeId === nodeId)
        .forEach((connection) =>
          walk(connection.to.nodeId, [...trail, connection.id], next, now)
        );
    };

    if (graph.startNodeId) walk(graph.startNodeId, [], new Set(), 0);

    expect(fallen).toEqual([]);
  });
});

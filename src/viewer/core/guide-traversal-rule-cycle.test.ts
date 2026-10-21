import { describe, expect, test, vi } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";

import type { Connection, FlowNodeData, GraphData } from "../types/graph";

/**
 * Steps the engine walks without stopping, connected in a circle.
 *
 * A rule, a calculation and a service call are passed automatically: the
 * engine evaluates one and follows its exit to the next in a `while (true)`
 * (`resolveRules`). A circle among them has no step in it that waits for the
 * visitor, so without the `visited` set in that loop the page would never get
 * control back — a hung tab, not an error. The guard was there; nothing proved
 * it (security review 8/10). These tests are that proof.
 *
 * ## Why the fuse
 *
 * A guard that is missing does not make a test fail, it makes it **hang**: the
 * loop is synchronous, so vitest's timeout cannot interrupt it and the worker
 * just spins. The three functions the loop calls, one per kind of step, are
 * therefore wrapped in a counter that throws after `FUSE` calls. With the guard in place
 * a circle is caught on its second visit and the fuse is never near; with the
 * guard removed (the mutation, 9/10) the fuse blows and the test fails with a
 * sentence instead of a frozen run.
 */
const FUSE = 1_000;
const calls = vi.hoisted(() => ({ count: 0 }));

vi.mock("./rule-evaluator", async (importOriginal) => {
  const real = await importOriginal<typeof import("./rule-evaluator")>();

  return {
    ...real,
    evaluateRule: (...args: Parameters<typeof real.evaluateRule>) => {
      if (++calls.count > FUSE) throw new Error("the engine went round a rule circle without stopping");

      return real.evaluateRule(...args);
    },
  };
});

vi.mock("../services/calculation-service", async (importOriginal) => {
  const real = await importOriginal<typeof import("../services/calculation-service")>();
  const run = real.CalculationService.run.bind(real.CalculationService);

  real.CalculationService.run = (...args: Parameters<typeof run>) => {
    if (++calls.count > FUSE) throw new Error("the engine went round a calculation circle without stopping");

    return run(...args);
  };

  return real;
});

vi.mock("../services/service-call-service", async (importOriginal) => {
  const real = await importOriginal<typeof import("../services/service-call-service")>();
  const runMock = real.ServiceCallService.runMock.bind(real.ServiceCallService);

  real.ServiceCallService.runMock = (...args: Parameters<typeof runMock>) => {
    if (++calls.count > FUSE) throw new Error("the engine went round a service-call circle without stopping");

    return runMock(...args);
  };

  return real;
});

const question: FlowNodeData = {
  id: "fraga",
  type: "question",
  position: { x: 0, y: 0 },
  data: {
    title: "Är du nöjd?",
    variableName: "nojd",
    options: [{ id: "ja", label: "Ja", value: "ja" }],
  },
};

/** A rule that never matches, so it always leaves through *Annars*. */
const rule = (id: string): FlowNodeData => ({
  id,
  type: "rule",
  position: { x: 0, y: 0 },
  data: {
    title: id,
    cases: [
      {
        id: `${id}-case`,
        label: "Om nej",
        match: "all",
        conditions: [{ id: `${id}-c`, variableName: "nojd", operator: "equals", value: "nej" }],
      },
    ],
    fallbackLabel: "Annars",
  },
});

const calculation = (id: string): FlowNodeData => ({
  id,
  type: "calculation",
  position: { x: 0, y: 0 },
  data: {
    title: id,
    assignments: [{ id: `${id}-a`, variableName: `${id}Tal`, formula: "1 + 1" }],
  },
});

/** A service call answered by its mock, as everywhere outside live mode. */
const serviceCall = (id: string): FlowNodeData => ({
  id,
  type: "service-call",
  position: { x: 0, y: 0 },
  data: {
    title: id,
    endpoint: "/api/beslut",
    method: "POST",
    requestVariables: [],
    mockResponse: JSON.stringify({ decision: "approved" }),
    responseMappings: [{ id: `${id}-m`, field: "decision", variableName: `${id}Beslut` }],
  },
});

const link = (from: string, port: string, to: string): Connection => ({
  id: `${from}-${to}`,
  from: { nodeId: from, portId: port },
  to: { nodeId: to, portId: "input" },
});

/** The question, then `circle` in order, the last leading back to the first. */
const circleAfterQuestion = (circle: FlowNodeData[]): GraphData => {
  const port = (node: FlowNodeData): string => (node.type === "rule" ? "default" : "continue");

  return {
    startNodeId: "fraga",
    nodes: [question, ...circle],
    connections: [
      link("fraga", "ja", circle[0]!.id),
      ...circle.map((node, index) => link(node.id, port(node), circle[(index + 1) % circle.length]!.id)),
    ],
  };
};

describe("a circle of steps the engine passes without stopping", () => {
  test("two rules pointing at each other: the answer returns a rule-cycle failure naming the step", () => {
    calls.count = 0;
    const engine = new GuideTraversalEngine(circleAfterQuestion([rule("regelA"), rule("regelB")]));

    expect(engine.answer("ja")).toMatchObject({
      success: false,
      error: {
        code: "rule-cycle",
        params: { nodeId: "regelA" },
        message: 'Regelflödet innehåller en loop vid noden "regelA".',
      },
    });
    // Each rule once, then the second visit to the first is refused.
    expect(calls.count).toBe(2);
  });

  test("a rule leading to itself is the same circle, one step long", () => {
    calls.count = 0;
    const engine = new GuideTraversalEngine(circleAfterQuestion([rule("regel")]));

    expect(engine.answer("ja")).toMatchObject({
      success: false,
      error: { code: "rule-cycle", params: { nodeId: "regel" } },
    });
  });

  test("two calculations pointing at each other: the same failure, in the flow's own words", () => {
    calls.count = 0;
    const engine = new GuideTraversalEngine(
      circleAfterQuestion([calculation("rakningA"), calculation("rakningB")]),
      { locale: "en" },
    );

    expect(engine.answer("ja")).toMatchObject({
      success: false,
      error: {
        code: "rule-cycle",
        params: { nodeId: "rakningA" },
        message: 'The flow contains a loop at step "rakningA".',
      },
    });
    expect(calls.count).toBe(2);
  });

  test("two service calls pointing at each other: the same failure", () => {
    calls.count = 0;
    const engine = new GuideTraversalEngine(circleAfterQuestion([serviceCall("tjanstA"), serviceCall("tjanstB")]));

    expect(engine.answer("ja")).toMatchObject({
      success: false,
      error: { code: "rule-cycle", params: { nodeId: "tjanstA" } },
    });
    expect(calls.count).toBe(2);
  });

  test("a rule and a calculation in one circle are caught where it closes", () => {
    calls.count = 0;
    const engine = new GuideTraversalEngine(
      circleAfterQuestion([rule("regel"), calculation("rakning")]),
    );

    expect(engine.answer("ja")).toMatchObject({
      success: false,
      error: { code: "rule-cycle", params: { nodeId: "regel" } },
    });
  });

  test("the visitor is not stranded: Back returns to the question that led there", () => {
    calls.count = 0;
    const engine = new GuideTraversalEngine(circleAfterQuestion([rule("regelA"), rule("regelB")]));

    engine.answer("ja");

    expect(engine.previous()).toMatchObject({ success: true, node: { id: "fraga" } });
  });
});

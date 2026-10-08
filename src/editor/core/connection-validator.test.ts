import { beforeAll, describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";

import { canCreateConnection } from "./connection-validator";
import { registerNodeType } from "../../viewer/node-types/node-type-registry";

import type { Connection, FlowNodeData, GraphData } from "../../viewer/types/graph";

const question: FlowNodeData = {
  id: "question",
  type: "question",
  position: { x: 0, y: 0 },
  data: {
    options: [
      { id: "yes", label: "Ja", value: "yes" },
      { id: "no", label: "Nej", value: "no" },
    ],
  },
};

const result = (id: string): FlowNodeData => ({
  id,
  type: "result",
  position: { x: 0, y: 0 },
  data: {},
});

const connection = (
  fromNodeId = "question",
  fromPortId = "yes",
  toNodeId = "result-a",
  toPortId = "input"
): Connection => ({
  id: "connection",
  from: { nodeId: fromNodeId, portId: fromPortId },
  to: { nodeId: toNodeId, portId: toPortId },
});

const graph = (connections: Connection[] = []): GraphData => ({
  startNodeId: null,
  nodes: [question, result("result-a"), result("result-b")],
  connections,
});

beforeAll(() => {
  registerNodeType("number-source-for-test", {
    label: "Number source",
    createData: () => ({}),
    properties: [],
    inputs: [],
    getOutputs: () => [
      {
        id: "number",
        label: "Number",
        valueType: "number",
        connectionPolicy: "multiple",
      },
    ],
  });

  registerNodeType("blocked-source-for-test", {
    label: "Blocked source",
    createData: () => ({}),
    properties: [],
    inputs: [],
    getOutputs: () => [
      {
        id: "blocked",
        label: "Blocked",
        valueType: "flow",
        connectionPolicy: "none",
      },
    ],
  });
});

describe("canCreateConnection", () => {
  test("allows compatible output and input ports", () => {
    expect(canCreateConnection(graph(), connection())).toBe(true);
  });

  test("rejects connections to unknown nodes and ports", () => {
    expect(
      canCreateConnection(graph(), connection("missing", "yes"))
    ).toBe(false);
    expect(
      canCreateConnection(graph(), connection("question", "missing"))
    ).toBe(false);
    expect(
      canCreateConnection(
        graph(),
        connection("question", "yes", "missing")
      )
    ).toBe(false);
    expect(
      canCreateConnection(
        graph(),
        connection("question", "yes", "result-a", "missing")
      )
    ).toBe(false);
  });

  test("rejects when the endpoints face the wrong way", () => {
    expect(
      canCreateConnection(
        graph(),
        connection("result-a", "input", "question", "yes")
      )
    ).toBe(false);
  });

  test("nekar inkompatibla porttyper", () => {
    const numberSource: FlowNodeData = {
      id: "number-source",
      type: "number-source-for-test",
      position: { x: 0, y: 0 },
      data: {},
    };
    const testGraph = graph();
    testGraph.nodes.push(numberSource);

    expect(
      canCreateConnection(
        testGraph,
        connection("number-source", "number")
      )
    ).toBe(false);
  });

  test("rejects ports whose policy is none", () => {
    const blockedSource: FlowNodeData = {
      id: "blocked-source",
      type: "blocked-source-for-test",
      position: { x: 0, y: 0 },
      data: {},
    };
    const testGraph = graph();
    testGraph.nodes.push(blockedSource);

    expect(
      canCreateConnection(
        testGraph,
        connection("blocked-source", "blocked")
      )
    ).toBe(false);
  });

  test("rejects a single-policy output port after the first connection", () => {
    const existing = connection();
    const next = connection("question", "yes", "result-b", "input");

    expect(canCreateConnection(graph([existing]), next)).toBe(false);
  });

  test("allows several connections into a multiple-policy input port", () => {
    const existing = connection();
    const next = connection("question", "no", "result-a", "input");

    expect(canCreateConnection(graph([existing]), next)).toBe(true);
  });

  test("rejects an identical connection even with a new id", () => {
    const existing = connection();
    const duplicate = { ...connection(), id: "another-id" };

    expect(canCreateConnection(graph([existing]), duplicate)).toBe(false);
  });
});

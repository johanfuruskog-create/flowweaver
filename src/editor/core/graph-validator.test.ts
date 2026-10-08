import { beforeAll, describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";

import { isGraphValid, validateGraph } from "./graph-validator";
import { registerNodeType } from "../../viewer/node-types/node-type-registry";

import type { Connection, FlowNodeData, GraphData } from "../../viewer/types/graph";

const question = (): FlowNodeData => ({
  id: "question",
  type: "question",
  position: { x: 0, y: 0 },
  data: {
    options: [
      { id: "yes", label: "Ja", value: "yes" },
      { id: "no", label: "Nej", value: "no" },
    ],
  },
});

const result = (id = "result"): FlowNodeData => ({
  id,
  type: "result",
  position: { x: 100, y: 0 },
  data: {},
});

const connection = (
  id = "connection",
  fromPortId = "yes",
  toNodeId = "result",
  toPortId = "input"
): Connection => ({
  id,
  from: { nodeId: "question", portId: fromPortId },
  to: { nodeId: toNodeId, portId: toPortId },
});

const graph = (): GraphData => ({
  startNodeId: "question",
  nodes: [question(), result()],
  connections: [connection()],
});

const issueCodes = (value: GraphData): string[] =>
  validateGraph(value).map((issue) => issue.code);

beforeAll(() => {
  registerNodeType("number-source-for-validation-test", {
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
});

describe("graph validator", () => {
  test("accepts a valid graph", () => {
    expect(validateGraph(graph())).toEqual([]);
    expect(isGraphValid(graph())).toBe(true);
  });

  test("detects duplicate node ids and unknown node types", () => {
    const value = graph();
    value.nodes.push({ ...question(), type: "unknown" });

    expect(issueCodes(value)).toEqual(
      expect.arrayContaining(["duplicate-node-id", "unknown-node-type"])
    );
    expect(isGraphValid(value)).toBe(false);
  });

  test("requires a valid start question when the graph contains questions", () => {
    const missing = graph();
    missing.startNodeId = null;

    expect(issueCodes(missing)).toContain("missing-start-node");

    const invalid = graph();
    invalid.startNodeId = "result";

    expect(issueCodes(invalid)).toContain("invalid-start-node");
  });

  test("validates Page membership and forbids children's flow connections", () => {
    const missingParent = graph();
    missingParent.nodes[0]!.parentPageId = "missing-page";
    expect(issueCodes(missingParent)).toEqual(
      expect.arrayContaining(["missing-parent-page", "page-child-connection"])
    );

    const invalidChild = graph();
    invalidChild.nodes[1]!.parentPageId = "question";
    expect(issueCodes(invalidChild)).toEqual(
      expect.arrayContaining(["missing-parent-page", "invalid-page-child", "page-child-connection"])
    );
  });

  test("allows page-heading and page-spacer as children of a Page", () => {
    const value: GraphData = {
      startNodeId: "question",
      nodes: [
        question(),
        result(),
        { id: "page", type: "page", position: { x: 0, y: 0 }, data: {} },
        { id: "heading", type: "page-heading", position: { x: 0, y: 0 }, data: {}, parentPageId: "page" },
        { id: "spacer", type: "page-spacer", position: { x: 0, y: 0 }, data: {}, parentPageId: "page" },
      ],
      connections: [connection()],
    };

    expect(issueCodes(value)).not.toContain("invalid-page-child");
  });

  test("detects duplicate connection ids and endpoints", () => {
    const value = graph();
    value.connections.push(connection());

    expect(issueCodes(value)).toEqual(
      expect.arrayContaining([
        "duplicate-connection-id",
        "duplicate-connection",
        "connection-capacity-exceeded",
      ])
    );
  });

  test("detects references to a missing node", () => {
    const value = graph();
    value.connections = [connection("missing-node", "yes", "missing")];

    const issues = validateGraph(value);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "missing-node",
      nodeId: "missing",
      connectionId: "missing-node",
    });
  });

  test("detects references to a missing port", () => {
    const value = graph();
    value.connections = [connection("missing-port", "missing")];

    expect(validateGraph(value)).toEqual([
      expect.objectContaining({
        code: "missing-port",
        nodeId: "question",
        portId: "missing",
      }),
    ]);
  });

  test("detects ports facing the wrong way", () => {
    const value = graph();
    value.connections = [
      {
        id: "wrong-direction",
        from: { nodeId: "result", portId: "input" },
        to: { nodeId: "question", portId: "yes" },
      },
    ];

    expect(issueCodes(value)).toEqual([
      "invalid-port-direction",
      "invalid-port-direction",
    ]);
  });

  test("detects incompatible port types", () => {
    const value = graph();
    value.nodes.push({
      id: "number-source",
      type: "number-source-for-validation-test",
      position: { x: 0, y: 0 },
      data: {},
    });
    value.connections = [
      {
        id: "wrong-type",
        from: { nodeId: "number-source", portId: "number" },
        to: { nodeId: "result", portId: "input" },
      },
    ];

    expect(issueCodes(value)).toEqual(["incompatible-port-type"]);
  });

  test("detects a single port with several connections", () => {
    const value = graph();
    value.nodes.push(result("result-2"));
    value.connections.push(connection("connection-2", "yes", "result-2"));

    expect(issueCodes(value)).toContain("connection-capacity-exceeded");
  });

  test("allows several connections into a multiple port", () => {
    const value = graph();
    value.connections.push(connection("connection-2", "no"));

    expect(validateGraph(value)).toEqual([]);
  });
});

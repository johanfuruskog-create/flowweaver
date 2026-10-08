import { describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";

import {
  addNode,
  addConnection,
  removeNode,
  removeConnection,
  removeConnectionsFromOutput,
  setStartNode,
  updateNodeData,
  moveNodeToPage,
  removeNodeFromPage,
  duplicateNode,
} from "./graph-operations";

import type { Connection, GraphData } from "../../viewer/types/graph";

const createGraph = (): GraphData => ({
  startNodeId: "question",
  nodes: [
    {
      id: "question",
      type: "question",
      position: { x: 10, y: 20 },
      data: {
        title: "Gammal rubrik",
        options: [
          { id: "yes", label: "Ja", value: "yes" },
          { id: "no", label: "Nej", value: "no" },
        ],
      },
    },
    {
      id: "result",
      type: "result",
      position: { x: 300, y: 20 },
      data: { title: "Resultat" },
    },
  ],
  connections: [],
});

const createConnection = (
  id = "yes-to-result",
  portId = "yes"
): Connection => ({
  id,
  from: { nodeId: "question", portId },
  to: { nodeId: "result", portId: "input" },
});

describe("graph operations", () => {
  test("adds a node without mutating the input graph", () => {
    const graph = createGraph();
    const node = {
      id: "new-result",
      type: "result",
      position: { x: 500, y: 100 },
      data: { title: "Nytt resultat" },
    };

    const result = addNode(graph, node);

    expect(result.nodes).toHaveLength(3);
    expect(result.nodes[2]).toEqual(node);
    expect(result.nodes[2]).not.toBe(node);
    expect(graph.nodes).toHaveLength(2);
  });

  test("nekar en nod med ett id som redan finns", () => {
    const graph = createGraph();

    expect(addNode(graph, graph.nodes[0]!)).toBe(graph);
  });

  /*
   * Story 082: the first step in an empty guide is its start — there is
   * nothing else it could be. Only in an empty guide: commit 691dd5e removed
   * the rule that picked the next question silently when the start was
   * removed, and that stays removed.
   */
  test("gör det första steget i en tom guide till start", () => {
    const empty: GraphData = { startNodeId: null, nodes: [], connections: [] };
    const question = createGraph().nodes[0]!;

    expect(addNode(empty, question).startNodeId).toBe("question");
  });

  test("ett resultat i en tom guide blir inte start", () => {
    const empty: GraphData = { startNodeId: null, nodes: [], connections: [] };
    const result = createGraph().nodes[1]!;

    expect(addNode(empty, result).startNodeId).toBeNull();
  });

  test("väljer inte tyst en ny start i en guide som redan har noder", () => {
    const graph = { ...createGraph(), startNodeId: null };
    const question = { ...createGraph().nodes[0]!, id: "another" };

    expect(addNode(graph, question).startNodeId).toBeNull();
  });

  test("tar bort en nod och alla dess kopplingar", () => {
    const graph = createGraph();
    graph.connections = [createConnection(), createConnection("no", "no")];

    const result = removeNode(graph, "question");

    expect(result.nodes.map((node) => node.id)).toEqual(["result"]);
    expect(result.connections).toEqual([]);
    expect(result.startNodeId).toBeNull();
    expect(graph.nodes).toHaveLength(2);
    expect(graph.connections).toHaveLength(2);
  });

  test("moves a field node into a Page with a local position and no connections", () => {
    const graph = createGraph();
    graph.nodes.push({ id: "page", type: "page", position: { x: 0, y: 0 }, data: {} });
    graph.connections = [createConnection()];

    const result = moveNodeToPage(graph, "question", "page", { x: 20, y: 112 });
    const child = result.nodes.find((node) => node.id === "question");

    expect(child).toMatchObject({
      parentPageId: "page",
      order: 0,
      position: { x: 20, y: 112 },
      layout: { columnSpan: 12 },
    });
    expect(result.startNodeId).toBe("page");
    expect(result.connections).toEqual([]);
    expect(graph.nodes[0]?.parentPageId).toBeUndefined();
  });

  test("infogar och omordnar Page-barn vid vald position", () => {
    let graph = createGraph();
    graph.nodes.push(
      { id: "page", type: "page", position: { x: 0, y: 0 }, data: {} },
      { id: "question-2", type: "question", position: { x: 0, y: 0 }, data: { options: [] } },
    );

    graph = moveNodeToPage(graph, "question", "page", { x: 20, y: 112 });
    graph = moveNodeToPage(graph, "question-2", "page", { x: 20, y: 112 }, 0);

    expect(
      graph.nodes
        .filter((node) => node.parentPageId === "page")
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
        .map((node) => node.id)
    ).toEqual(["question-2", "question"]);
  });
  test("rejects disallowed children and can take a field out of a Page", () => {
    const graph = createGraph();
    graph.nodes.push({ id: "page", type: "page", position: { x: 0, y: 0 }, data: {} });
    graph.nodes.push({ id: "rule", type: "rule", position: { x: 0, y: 0 }, data: {} });
    // Neither results nor rules may become children of a page.
    expect(moveNodeToPage(graph, "result", "page", { x: 0, y: 0 })).toBe(graph);
    expect(moveNodeToPage(graph, "rule", "page", { x: 0, y: 0 })).toBe(graph);

    const inside = moveNodeToPage(graph, "question", "page", { x: 20, y: 112 });
    const result = removeNodeFromPage(inside, "question", { x: 500, y: 300 });
    const detached = result.nodes.find((node) => node.id === "question");

    expect(detached?.position).toEqual({ x: 500, y: 300 });
    expect(detached?.parentPageId).toBeUndefined();
    expect(detached?.order).toBeUndefined();
    // Layout is kept so the width survives a trip out of and back into the page.
    expect(detached?.layout).toEqual({ columnSpan: 12 });
  });

  test("allows a subheading and a blank row as children of a Page", () => {
    const graph = createGraph();
    graph.nodes.push(
      { id: "page", type: "page", position: { x: 0, y: 0 }, data: {} },
      { id: "heading", type: "page-heading", position: { x: 0, y: 0 }, data: { title: "Adress" } },
      { id: "spacer", type: "page-spacer", position: { x: 0, y: 0 }, data: {} },
    );

    let result = moveNodeToPage(graph, "heading", "page", { x: 20, y: 260 });
    result = moveNodeToPage(result, "spacer", "page", { x: 20, y: 260 });

    expect(result.nodes.find((node) => node.id === "heading")?.parentPageId).toBe("page");
    expect(result.nodes.find((node) => node.id === "spacer")?.parentPageId).toBe("page");
  });

  test("keeps the field's width when dragged out of and back into a page", () => {
    let graph = createGraph();
    graph.nodes.push({ id: "page", type: "page", position: { x: 0, y: 0 }, data: {} });

    graph = moveNodeToPage(graph, "question", "page", { x: 20, y: 112 });
    const inside = graph.nodes.find((node) => node.id === "question");
    if (inside) inside.layout = { columnSpan: 6 };

    graph = removeNodeFromPage(graph, "question", { x: 500, y: 300 });
    graph = moveNodeToPage(graph, "question", "page", { x: 20, y: 112 });

    expect(
      graph.nodes.find((node) => node.id === "question")?.layout
    ).toEqual({ columnSpan: 6 });
  });
  test("removes a Page's children along with the container", () => {
    const graph = createGraph();
    graph.nodes.push(
      { id: "page", type: "page", position: { x: 0, y: 0 }, data: {} },
      {
        id: "field",
        type: "text-question",
        position: { x: 20, y: 112 },
        parentPageId: "page",
        order: 0,
        layout: { columnSpan: 12 },
        data: {},
      },
    );

    const result = removeNode(graph, "page");

    expect(result.nodes.map((node) => node.id)).toEqual(["question", "result"]);
  });
  test("leaves the graph without a start node when the start node is removed", () => {
    const graph = createGraph();
    graph.nodes.push({
      id: "question-2",
      type: "question",
      position: { x: 500, y: 200 },
      data: { options: [] },
    });

    expect(removeNode(graph, "question").startNodeId).toBeNull();
  });

  test("byter startnod och tar bort dess inkommande kopplingar", () => {
    const graph = createGraph();
    graph.nodes.push({
      id: "question-2",
      type: "question",
      position: { x: 500, y: 200 },
      data: { options: [] },
    });
    graph.connections = [
      {
        id: "to-new-start",
        from: { nodeId: "question", portId: "yes" },
        to: { nodeId: "question-2", portId: "input" },
      },
      createConnection(),
    ];

    const result = setStartNode(graph, "question-2");

    expect(result.startNodeId).toBe("question-2");
    expect(result.connections.map((connection) => connection.id)).toEqual([
      "yes-to-result",
    ]);
    expect(graph.startNodeId).toBe("question");
  });

  test("allows only questions as the start node", () => {
    const graph = createGraph();

    expect(setStartNode(graph, "result")).toBe(graph);
    expect(setStartNode(graph, "missing")).toBe(graph);
  });

  test("allows a PageNode as the start node", () => {
    const graph = createGraph();
    graph.nodes.push({ id: "page", type: "page", position: { x: 500, y: 0 }, data: {} });

    expect(setStartNode(graph, "page").startNodeId).toBe("page");
  });

  test("rejects fields inside a Page as the start node", () => {
    const graph = createGraph();
    graph.startNodeId = "page";
    graph.nodes.push({ id: "page", type: "page", position: { x: 500, y: 0 }, data: {} });
    graph.nodes.push({
      id: "field",
      type: "text-question",
      parentPageId: "page",
      order: 0,
      position: { x: 20, y: 112 },
      data: { title: "Namn" },
    });

    expect(setStartNode(graph, "field")).toBe(graph);
  });

  test("returns the same graph when the node does not exist", () => {
    const graph = createGraph();

    expect(removeNode(graph, "missing")).toBe(graph);
  });

  test("duplicates a standalone node offset and without connections", () => {
    const graph = createGraph();
    graph.connections = [createConnection()];

    let counter = 0;
    const result = duplicateNode(graph, "question", () => `copy-${counter++}`);

    expect(result?.newNodeId).toBe("copy-0");
    const clone = result?.graph.nodes.find((node) => node.id === "copy-0");
    expect(clone).toMatchObject({
      type: "question",
      position: { x: 10 + 40, y: 20 + 40 },
    });
    // No connections are copied and the original remains.
    expect(result?.graph.connections).toHaveLength(1);
    expect(result?.graph.nodes).toHaveLength(3);
  });

  test("duplicerar en Page med dess barn och nya id:n", () => {
    const graph = createGraph();
    graph.nodes.push(
      { id: "page", type: "page", position: { x: 0, y: 0 }, data: {} },
      { id: "child", type: "text-question", parentPageId: "page", order: 0, position: { x: 20, y: 112 }, data: { title: "Fält" } },
    );

    let counter = 0;
    const result = duplicateNode(graph, "page", () => `copy-${counter++}`);

    expect(result?.newNodeId).toBe("copy-0");
    const clonedChild = result?.graph.nodes.find((node) => node.id === "copy-1");
    expect(clonedChild?.parentPageId).toBe("copy-0");
    expect(clonedChild?.type).toBe("text-question");
  });

  test("duplicerar ett Page-barn som nytt barn sist i samma sida", () => {
    const graph = createGraph();
    graph.nodes.push(
      { id: "page", type: "page", position: { x: 0, y: 0 }, data: {} },
      { id: "child", type: "text-question", parentPageId: "page", order: 0, position: { x: 20, y: 112 }, data: { title: "Fält" } },
    );

    const result = duplicateNode(graph, "child", () => "copy-0");
    const clone = result?.graph.nodes.find((node) => node.id === "copy-0");

    expect(clone?.parentPageId).toBe("page");
    expect(clone?.order).toBe(1);
  });

  test("returns null when the node to duplicate is missing", () => {
    expect(duplicateNode(createGraph(), "missing")).toBeNull();
  });

  test("uppdaterar noddata utan att mutera indatagrafen", () => {
    const graph = createGraph();

    const result = updateNodeData(graph, "question", "title", "Ny rubrik");

    expect(result).not.toBe(graph);
    expect(result.nodes[0]?.data.title).toBe("Ny rubrik");
    expect(graph.nodes[0]?.data.title).toBe("Gammal rubrik");
    expect(result.nodes[1]).toBe(graph.nodes[1]);
    expect(result.connections).toBe(graph.connections);
  });

  test("copies a value written to the node data", () => {
    const graph = createGraph();
    const value = [{ id: "maybe", label: "Kanske", value: "maybe" }];

    const result = updateNodeData(graph, "question", "options", value);

    expect(result.nodes[0]?.data.options).toEqual(value);
    expect(result.nodes[0]?.data.options).not.toBe(value);
  });

  test("returns the same graph when the node does not exist", () => {
    const graph = createGraph();

    expect(updateNodeData(graph, "missing", "title", "Ny")).toBe(graph);
  });

  test("adds a valid connection without mutating the input graph", () => {
    const graph = createGraph();
    const connection = createConnection();

    const result = addConnection(graph, connection);

    expect(result).not.toBe(graph);
    expect(result.connections).toEqual([connection]);
    expect(result.connections[0]).not.toBe(connection);
    expect(graph.connections).toEqual([]);
    expect(result.nodes).toBe(graph.nodes);
  });

  test("returns the same graph when the connection is not valid", () => {
    const graph = createGraph();
    const invalid = createConnection("invalid", "missing");

    expect(addConnection(graph, invalid)).toBe(graph);
  });

  test("tar bort en koppling utan att mutera indatagrafen", () => {
    const graph = createGraph();
    graph.connections = [createConnection(), createConnection("no", "no")];

    const result = removeConnection(graph, "yes-to-result");

    expect(result.connections.map((connection) => connection.id)).toEqual([
      "no",
    ]);
    expect(graph.connections).toHaveLength(2);
    expect(result.nodes).toBe(graph.nodes);
  });

  test("returns the same graph when the connection does not exist", () => {
    const graph = createGraph();

    expect(removeConnection(graph, "missing")).toBe(graph);
  });

  test("removes only connections from the chosen output port", () => {
    const graph = createGraph();
    graph.connections = [createConnection(), createConnection("no", "no")];

    const result = removeConnectionsFromOutput(graph, "question", "yes");

    expect(result.connections.map((connection) => connection.id)).toEqual([
      "no",
    ]);
    expect(graph.connections).toHaveLength(2);
  });

  test("returns the same graph when the output port has no connections", () => {
    const graph = createGraph();

    expect(removeConnectionsFromOutput(graph, "question", "yes")).toBe(
      graph
    );
  });
});

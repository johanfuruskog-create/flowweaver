import { canCreateConnection } from "./connection-validator";
import {
  canNodeTypeBeInPage,
  isGuideStepNode,
} from "../../viewer/node-types/node-type-registry";

import type { Connection, FlowNodeData, GraphData } from "../../viewer/types/graph";

export function addNode(graph: GraphData, node: FlowNodeData): GraphData {
  if (graph.nodes.some((candidate) => candidate.id === node.id)) {
    return graph;
  }

  /*
   * The first step in an empty guide is its start (story 082) — there is
   * nothing else it could be, and a warning band after the very first action
   * says the editor did something wrong. Only in an empty guide: commit
   * 691dd5e removed the rule that silently picked the next question when the
   * start was removed, and a start that moves on its own stays removed.
   */
  const startNodeId =
    graph.nodes.length === 0 && isGuideStepNode(node) && node.parentPageId === undefined
      ? node.id
      : graph.startNodeId;

  return {
    ...graph,
    startNodeId,
    nodes: [...graph.nodes, structuredClone(node)],
  };
}

export function removeNode(graph: GraphData, nodeId: string): GraphData {
  if (!graph.nodes.some((node) => node.id === nodeId)) {
    return graph;
  }

  const removedNodeIds = new Set([
    nodeId,
    ...graph.nodes
      .filter((node) => node.parentPageId === nodeId)
      .map((node) => node.id),
  ]);
  const nodes = graph.nodes.filter((node) => !removedNodeIds.has(node.id));
  const startNodeId = graph.startNodeId && removedNodeIds.has(graph.startNodeId)
    ? null
    : graph.startNodeId;

  return {
    ...graph,
    startNodeId,
    nodes,
    connections: graph.connections.filter(
      (connection) =>
        !removedNodeIds.has(connection.from.nodeId) &&
        !removedNodeIds.has(connection.to.nodeId)
    ),
  };
}

export function setStartNode(graph: GraphData, nodeId: string): GraphData {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);

  if (
    !node ||
    !isGuideStepNode(node) ||
    // Fields in a Page are not steps of their own and cannot be the start node.
    node.parentPageId !== undefined ||
    graph.startNodeId === nodeId
  ) {
    return graph;
  }

  return {
    ...graph,
    startNodeId: nodeId,
    connections: graph.connections.filter(
      (connection) => connection.to.nodeId !== nodeId
    ),
  };
}

export function updateNodeData(
  graph: GraphData,
  nodeId: string,
  property: string,
  value: unknown
): GraphData {
  const nodeIndex = graph.nodes.findIndex((node) => node.id === nodeId);

  if (nodeIndex === -1) {
    return graph;
  }

  const node = graph.nodes[nodeIndex];

  if (!node) {
    return graph;
  }

  const nodes = [...graph.nodes];
  nodes[nodeIndex] = {
    ...node,
    data: {
      ...node.data,
      [property]: structuredClone(value),
    },
  };

  return {
    ...graph,
    nodes,
  };
}

export function addConnection(
  graph: GraphData,
  connection: Connection
): GraphData {
  if (!canCreateConnection(graph, connection)) {
    return graph;
  }

  return {
    ...graph,
    connections: [...graph.connections, structuredClone(connection)],
  };
}

export function removeConnection(
  graph: GraphData,
  connectionId: string
): GraphData {
  const connections = graph.connections.filter(
    (connection) => connection.id !== connectionId
  );

  if (connections.length === graph.connections.length) {
    return graph;
  }

  return {
    ...graph,
    connections,
  };
}

export function removeConnectionsFromOutput(
  graph: GraphData,
  nodeId: string,
  portId: string
): GraphData {
  const connections = graph.connections.filter(
    (connection) =>
      connection.from.nodeId !== nodeId || connection.from.portId !== portId
  );

  if (connections.length === graph.connections.length) {
    return graph;
  }

  return {
    ...graph,
    connections,
  };
}

export function moveNodeToPage(
  graph: GraphData,
  nodeId: string,
  pageId: string,
  position: FlowNodeData["position"],
  targetOrder?: number
): GraphData {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  const page = graph.nodes.find(
    (candidate) => candidate.id === pageId && candidate.type === "page"
  );

  if (!node || !page || !canNodeTypeBeInPage(node.type)) {
    return graph;
  }

  const siblings = graph.nodes
    .filter((candidate) => candidate.parentPageId === pageId && candidate.id !== nodeId)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  const order = Math.max(0, Math.min(targetOrder ?? siblings.length, siblings.length));
  const orderedIds = siblings.map((candidate) => candidate.id);
  orderedIds.splice(order, 0, nodeId);

  return {
    ...graph,
    startNodeId: graph.startNodeId === nodeId ? pageId : graph.startNodeId,
    nodes: graph.nodes.map((candidate) => {
      if (candidate.id === nodeId) {
        return {
          ...candidate,
          position: structuredClone(position),
          parentPageId: pageId,
          order,
          layout: candidate.layout ?? { columnSpan: 12 },
        };
      }
      const siblingOrder = orderedIds.indexOf(candidate.id);
      return siblingOrder >= 0 ? { ...candidate, order: siblingOrder } : candidate;
    }),
    connections: graph.connections.filter(
      (connection) => connection.from.nodeId !== nodeId && connection.to.nodeId !== nodeId
    ),
  };
}

export function removeNodeFromPage(
  graph: GraphData,
  nodeId: string,
  position: FlowNodeData["position"]
): GraphData {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node?.parentPageId) {
    return graph;
  }

  return {
    ...graph,
    nodes: graph.nodes.map((candidate) => {
      if (candidate.id !== nodeId) return candidate;
      // Layout is kept so the field regains its width if dragged into a page again.
      const detached = { ...candidate, position: structuredClone(position) };
      delete detached.parentPageId;
      delete detached.order;
      return detached;
    }),
  };
}
/**
 * Duplicates a node. A standalone node is cloned slightly offset; if it is a
 * Page its children are cloned along with it. A Page child is cloned as a new
 * child last in the same page. Connections are not copied. Returns the updated
 * graph and the new node's id, or null when the node is missing.
 */
export function duplicateNode(
  graph: GraphData,
  nodeId: string,
  createId: () => string = () => crypto.randomUUID()
): { graph: GraphData; newNodeId: string } | null {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return null;
  }

  // Page-barn: klona som nytt barn sist i samma sida.
  if (node.parentPageId) {
    const siblingCount = graph.nodes.filter(
      (candidate) => candidate.parentPageId === node.parentPageId
    ).length;
    const newNodeId = createId();
    const clone: FlowNodeData = {
      ...structuredClone(node),
      id: newNodeId,
      order: siblingCount,
    };
    return {
      graph: { ...graph, nodes: [...graph.nodes, clone] },
      newNodeId,
    };
  }

  // Standalone node: offset it a little so the clone is visible.
  const offset = 40;
  const newNodeId = createId();
  const clone: FlowNodeData = {
    ...structuredClone(node),
    id: newNodeId,
    position: { x: node.position.x + offset, y: node.position.y + offset },
  };

  // A Page brings its children along, with new ids pointing at the clone.
  const clonedChildren =
    node.type === "page"
      ? graph.nodes
          .filter((candidate) => candidate.parentPageId === node.id)
          .map((child) => ({
            ...structuredClone(child),
            id: createId(),
            parentPageId: newNodeId,
          }))
      : [];

  return {
    graph: { ...graph, nodes: [...graph.nodes, clone, ...clonedChildren] },
    newNodeId,
  };
}

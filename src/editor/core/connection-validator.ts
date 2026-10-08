import { getNodePorts } from "../../viewer/node-types/node-type-registry";

import type { Connection, GraphData, NodePort } from "../../viewer/types/graph";

function findPort(
  graph: GraphData,
  nodeId: string,
  portId: string
): NodePort | null {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    return null;
  }

  return (
    getNodePorts(node, { isStart: node.id === graph.startNodeId }).find(
      (port) => port.id === portId
    ) ?? null
  );
}

function hasConnectionCapacity(
  graph: GraphData,
  nodeId: string,
  portId: string,
  port: NodePort
): boolean {
  if (port.connectionPolicy === "none") {
    return false;
  }

  if (port.connectionPolicy === "multiple") {
    return true;
  }

  return !graph.connections.some((connection) => {
    const usesFromPort =
      connection.from.nodeId === nodeId && connection.from.portId === portId;
    const usesToPort =
      connection.to.nodeId === nodeId && connection.to.portId === portId;

    return usesFromPort || usesToPort;
  });
}

export function canCreateConnection(
  graph: GraphData,
  connection: Connection
): boolean {
  const fromNode = graph.nodes.find((node) => node.id === connection.from.nodeId);
  const toNode = graph.nodes.find((node) => node.id === connection.to.nodeId);

  if (fromNode?.parentPageId || toNode?.parentPageId) {
    return false;
  }

  const fromPort = findPort(
    graph,
    connection.from.nodeId,
    connection.from.portId
  );
  const toPort = findPort(
    graph,
    connection.to.nodeId,
    connection.to.portId
  );

  if (
    !fromPort ||
    !toPort ||
    fromPort.direction !== "output" ||
    toPort.direction !== "input"
  ) {
    return false;
  }

  if (!toPort.accepts.includes(fromPort.valueType)) {
    return false;
  }

  const alreadyExists = graph.connections.some(
    (existingConnection) =>
      existingConnection.from.nodeId === connection.from.nodeId &&
      existingConnection.from.portId === connection.from.portId &&
      existingConnection.to.nodeId === connection.to.nodeId &&
      existingConnection.to.portId === connection.to.portId
  );

  if (alreadyExists) {
    return false;
  }

  return (
    hasConnectionCapacity(
      graph,
      connection.from.nodeId,
      connection.from.portId,
      fromPort
    ) &&
    hasConnectionCapacity(
      graph,
      connection.to.nodeId,
      connection.to.portId,
      toPort
    )
  );
}

import {
  canNodeTypeBeInPage,
  getNodePorts,
  getNodeType,
  isGuideStepNode,
} from "../../viewer/node-types/node-type-registry";

import type {
  Connection,
  GraphData,
  NodePort,
  PortEndpoint,
} from "../../viewer/types/graph";

export type GraphValidationIssueCode =
  | "duplicate-node-id"
  | "missing-start-node"
  | "invalid-start-node"
  | "unknown-node-type"
  | "duplicate-connection-id"
  | "missing-node"
  | "missing-port"
  | "invalid-port-direction"
  | "incompatible-port-type"
  | "connection-not-allowed"
  | "connection-capacity-exceeded"
  | "duplicate-connection"
  | "missing-parent-page"
  | "invalid-page-child"
  | "page-child-connection";

export interface GraphValidationIssue {
  code: GraphValidationIssueCode;
  message: string;
  nodeId?: string;
  connectionId?: string;
  portId?: string;
}

interface ResolvedEndpoint {
  port: NodePort;
}

function findDuplicates(values: string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  });

  return duplicates;
}

function resolveEndpoint(
  graph: GraphData,
  connection: Connection,
  endpoint: PortEndpoint,
  expectedDirection: "input" | "output",
  issues: GraphValidationIssue[]
): ResolvedEndpoint | null {
  const node = graph.nodes.find((candidate) => candidate.id === endpoint.nodeId);

  if (!node) {
    issues.push({
      code: "missing-node",
      message: `Kopplingen refererar till noden "${endpoint.nodeId}" som saknas.`,
      nodeId: endpoint.nodeId,
      connectionId: connection.id,
    });
    return null;
  }

  const port = getNodePorts(node, {
    isStart: node.id === graph.startNodeId,
  }).find(
    (candidate) => candidate.id === endpoint.portId
  );

  if (!port) {
    issues.push({
      code: "missing-port",
      message: `Noden "${endpoint.nodeId}" saknar porten "${endpoint.portId}".`,
      nodeId: endpoint.nodeId,
      connectionId: connection.id,
      portId: endpoint.portId,
    });
    return null;
  }

  if (port.direction !== expectedDirection) {
    issues.push({
      code: "invalid-port-direction",
      message: `Porten "${endpoint.portId}" på noden "${endpoint.nodeId}" har fel riktning.`,
      nodeId: endpoint.nodeId,
      connectionId: connection.id,
      portId: endpoint.portId,
    });
    return null;
  }

  return { port };
}

function endpointKey(endpoint: PortEndpoint): string {
  return `${endpoint.nodeId}\u0000${endpoint.portId}`;
}

export function validateGraph(graph: GraphData): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];

  if (
    graph.startNodeId === null &&
    graph.nodes.some(isGuideStepNode)
  ) {
    issues.push({
      code: "missing-start-node",
      message: "Grafen har frågor men saknar en startnod.",
    });
  } else if (graph.startNodeId !== null) {
    const startNode = graph.nodes.find((node) => node.id === graph.startNodeId);

    if (!startNode) {
      issues.push({
        code: "missing-start-node",
        message: `Startnoden "${graph.startNodeId}" saknas.`,
        nodeId: graph.startNodeId,
      });
    } else if (!isGuideStepNode(startNode)) {
      issues.push({
        code: "invalid-start-node",
        message: `Noden "${graph.startNodeId}" kan inte användas som startnod.`,
        nodeId: graph.startNodeId,
      });
    }
  }

  findDuplicates(graph.nodes.map((node) => node.id)).forEach((nodeId) => {
    issues.push({
      code: "duplicate-node-id",
      message: `Flera noder har id "${nodeId}".`,
      nodeId,
    });
  });

  graph.nodes.forEach((node) => {
    if (!getNodeType(node.type)) {
      issues.push({
        code: "unknown-node-type",
        message: `Noden "${node.id}" har den okända nodtypen "${node.type}".`,
        nodeId: node.id,
      });
    }
  });

  graph.nodes.forEach((node) => {
    if (!node.parentPageId) return;

    const parent = graph.nodes.find((candidate) => candidate.id === node.parentPageId);
    if (!parent || parent.type !== "page") {
      issues.push({
        code: "missing-parent-page",
        message: `Noden "${node.id}" refererar till en Page som saknas.`,
        nodeId: node.id,
      });
    }

    if (!canNodeTypeBeInPage(node.type)) {
      issues.push({
        code: "invalid-page-child",
        message: `Nodtypen "${node.type}" får inte ligga inuti en Page.`,
        nodeId: node.id,
      });
    }
  });
  findDuplicates(graph.connections.map((connection) => connection.id)).forEach(
    (connectionId) => {
      issues.push({
        code: "duplicate-connection-id",
        message: `Flera kopplingar har id "${connectionId}".`,
        connectionId,
      });
    }
  );

  const connectionEndpoints = new Set<string>();
  const portUsage = new Map<string, number>();

  const recordPortUsage = (
    endpoint: PortEndpoint,
    port: NodePort,
    connectionId: string
  ): void => {
    const key = endpointKey(endpoint);
    const usage = (portUsage.get(key) ?? 0) + 1;
    portUsage.set(key, usage);

    if (port.connectionPolicy === "single" && usage > 1) {
      issues.push({
        code: "connection-capacity-exceeded",
        message: `Porten "${endpoint.portId}" på noden "${endpoint.nodeId}" har fler än en koppling.`,
        nodeId: endpoint.nodeId,
        connectionId,
        portId: endpoint.portId,
      });
    }
  };

  graph.connections.forEach((connection) => {
    const fromNode = graph.nodes.find((node) => node.id === connection.from.nodeId);
    const toNode = graph.nodes.find((node) => node.id === connection.to.nodeId);
    if (fromNode?.parentPageId || toNode?.parentPageId) {
      issues.push({
        code: "page-child-connection",
        message: `Page-barn får inte ha egna flödeskopplingar.`,
        connectionId: connection.id,
      });
      return;
    }
    const pairKey = `${endpointKey(connection.from)}\u0001${endpointKey(
      connection.to
    )}`;

    if (connectionEndpoints.has(pairKey)) {
      issues.push({
        code: "duplicate-connection",
        message: `Kopplingen "${connection.id}" duplicerar en befintlig koppling.`,
        connectionId: connection.id,
      });
    }
    connectionEndpoints.add(pairKey);

    const from = resolveEndpoint(
      graph,
      connection,
      connection.from,
      "output",
      issues
    );
    const to = resolveEndpoint(
      graph,
      connection,
      connection.to,
      "input",
      issues
    );

    if (!from || !to) {
      return;
    }

    if (from.port.connectionPolicy === "none") {
      issues.push({
        code: "connection-not-allowed",
        message: `Output-porten "${connection.from.portId}" tillåter inga kopplingar.`,
        nodeId: connection.from.nodeId,
        connectionId: connection.id,
        portId: connection.from.portId,
      });
    }

    if (to.port.connectionPolicy === "none") {
      issues.push({
        code: "connection-not-allowed",
        message: `Input-porten "${connection.to.portId}" tillåter inga kopplingar.`,
        nodeId: connection.to.nodeId,
        connectionId: connection.id,
        portId: connection.to.portId,
      });
    }

    if (
      from.port.direction === "output" &&
      to.port.direction === "input" &&
      !to.port.accepts.includes(from.port.valueType)
    ) {
      issues.push({
        code: "incompatible-port-type",
        message: `Porten "${connection.to.portId}" accepterar inte typen "${from.port.valueType}".`,
        nodeId: connection.to.nodeId,
        connectionId: connection.id,
        portId: connection.to.portId,
      });
    }

    recordPortUsage(connection.from, from.port, connection.id);
    recordPortUsage(connection.to, to.port, connection.id);
  });

  return issues;
}

export function isGraphValid(graph: GraphData): boolean {
  return validateGraph(graph).length === 0;
}

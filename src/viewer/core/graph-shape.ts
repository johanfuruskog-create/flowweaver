import type { Connection, ConnectionColor, FlowNodeData } from "../types/graph";

/**
 * A guide's shape: is it a graph at all — lists where lists belong, objects in
 * them, connections that point at a node and a port.
 *
 * ## Why it lives here, and is used by both doors
 *
 * It was the file door's (`importGraphJson`, in the editor) and only the file
 * door's. The object door (`migrateIncoming`, what a host's
 * `element.graph = …` goes through) checked that the value was an object and
 * not too new, and nothing about its shape — so `nodes: {}` or a connection
 * with `from: null` was answered `ok`, and the engine then threw a `TypeError`
 * out of a host's page (`this.graph.nodes.find is not a function`). Found by
 * the random-guide probe 10/10 in 1 685 of 50 000 cases
 * (`graph-import-fuzz.test.ts`); Johan's yes the same day: the same check as
 * the file door, one home, a sentence instead of an exception.
 *
 * The viewer may not import the editor, so the check moved here, word for
 * word, and the file door imports it. The sentences are the file door's own.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Ids and types are put into attributes and DOM selectors in several places.
// Restrict them to harmless characters already at import (defence in depth
// against injection via a rigged guide) — matches UUIDs and our own ids.
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID.test(value);
}

function parseNode(value: unknown, index: number, errors: string[]): FlowNodeData | null {
  const initialErrorCount = errors.length;

  if (!isRecord(value)) {
    errors.push(`Nod ${index + 1} är inte ett objekt.`);
    return null;
  }

  if (!isSafeId(value.id)) {
    errors.push(`Nod ${index + 1} saknar ett giltigt id.`);
  }
  if (!isSafeId(value.type)) {
    errors.push(`Nod ${index + 1} saknar en giltig typ.`);
  }
  if (
    !isRecord(value.position) ||
    typeof value.position.x !== "number" ||
    !Number.isFinite(value.position.x) ||
    typeof value.position.y !== "number" ||
    !Number.isFinite(value.position.y)
  ) {
    errors.push(`Nod ${index + 1} har en ogiltig position.`);
  }
  if (!isRecord(value.data)) {
    errors.push(`Nod ${index + 1} saknar giltiga egenskaper.`);
  }

  if (errors.length > initialErrorCount) {
    return null;
  }

  return value as unknown as FlowNodeData;
}

function parseEndpoint(
  value: unknown,
  label: string,
  errors: string[]
): { nodeId: string; portId: string } | null {
  if (!isRecord(value) || !isSafeId(value.nodeId) || !isSafeId(value.portId)) {
    errors.push(`${label} har en ogiltig nod- eller portreferens.`);
    return null;
  }

  return { nodeId: value.nodeId, portId: value.portId };
}

/**
 * The colours a connection may carry, as `ConnectionColor` lists them.
 *
 * Kept beside the parser rather than imported from the canvas: this is the
 * boundary where a stranger's JSON becomes a guide, and it must not widen
 * because a component grew a new option without anybody thinking about what a
 * file is allowed to contain.
 */
const CONNECTION_COLORS: readonly ConnectionColor[] = [
  "content",
  "rule",
  "calc",
  "service",
  "end",
  "danger",
];

function parseConnection(
  value: unknown,
  index: number,
  errors: string[]
): Connection | null {
  const initialErrorCount = errors.length;

  if (!isRecord(value)) {
    errors.push(`Koppling ${index + 1} är inte ett objekt.`);
    return null;
  }

  const label = `Koppling ${index + 1}`;

  if (!isSafeId(value.id)) {
    errors.push(`${label} saknar ett giltigt id.`);
  }

  const from = parseEndpoint(value.from, `${label}s start`, errors);
  const to = parseEndpoint(value.to, `${label}s mål`, errors);

  if (errors.length > initialErrorCount || !isSafeId(value.id) || !from || !to) {
    return null;
  }

  /*
   * The colour comes back with the connection.
   *
   * It used to be dropped here, which meant a guide could be coloured, saved,
   * and reopened plain — the colour reached storage intact and was stripped on
   * the way back in. The same road carries *Import*, so a colour survived
   * neither.
   *
   * An unrecognised value is left out rather than refused. The field is purely
   * visual, older builds ignore it, and a guide that will not open because a
   * future colour name means nothing to this build would be a much worse trade
   * than a line drawn in the default colour.
   */
  const color = CONNECTION_COLORS.includes(value.color as ConnectionColor)
    ? (value.color as ConnectionColor)
    : undefined;

  return color ? { id: value.id, from, to, color } : { id: value.id, from, to };
}

export type GraphShape =
  | { ok: true; startNodeId: string | null; nodes: FlowNodeData[]; connections: Connection[] }
  | { ok: false; errors: string[] };

/**
 * The shape of a (migrated) graph record. On `ok` the nodes and connections
 * are the parsed ones: a connection keeps only a colour this build knows.
 */
export function readGraphShape(record: Record<string, unknown>): GraphShape {
  const errors: string[] = [];

  if (record.startNodeId !== null && typeof record.startNodeId !== "string") {
    errors.push("Startnodens id måste vara text eller null.");
  }
  if (!Array.isArray(record.nodes)) {
    errors.push("Fältet nodes måste vara en lista.");
  }
  if (!Array.isArray(record.connections)) {
    errors.push("Fältet connections måste vara en lista.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const nodeErrors: string[] = [];
  const connectionErrors: string[] = [];
  const nodes = (record.nodes as unknown[])
    .map((node, index) => parseNode(node, index, nodeErrors))
    .filter((node): node is FlowNodeData => node !== null);
  const connections = (record.connections as unknown[])
    .map((connection, index) => parseConnection(connection, index, connectionErrors))
    .filter((connection): connection is Connection => connection !== null);

  if (nodeErrors.length > 0 || connectionErrors.length > 0) {
    return { ok: false, errors: [...nodeErrors, ...connectionErrors] };
  }

  return { ok: true, startNodeId: record.startNodeId as string | null, nodes, connections };
}

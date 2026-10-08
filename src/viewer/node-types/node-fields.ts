import { getNodeType } from "./node-type-registry";

import type { FlowNodeData } from "../types/graph";

/**
 * Reading a field from a node without repeating what the field is worth.
 *
 * A guide built before a field existed simply lacks the key. Every reader used
 * to invent its own answer to that — `?? "POST"` here, `: 2` there — and when
 * the declaration later changed, they did not follow. The default now lives in
 * one place, in the field's `defaultValue`, and the readers ask.
 *
 * Nothing is written: an old node stays old, the JSON does not grow, and a
 * migration that just removed a key does not get it back.
 */

/** What the field is worth when the node says nothing. `undefined` = none declared. */
export function declaredDefault(type: string, field: string): unknown {
  const property = getNodeType(type)?.properties.find(
    (candidate) => candidate.id === field
  );

  // Computed starting values (ids) are exactly that: starting values. An old
  // node lacking the key must not be served a newborn id as though it had been
  // there all along.
  return property?.defaultValue;
}

/** A text field, with the field's declared value as the fallback. */
export function readNodeString(node: FlowNodeData, field: string): string {
  const value = node.data[field];
  if (typeof value === "string") {
    return value;
  }

  const declared = declaredDefault(node.type, field);
  return typeof declared === "string" ? declared : "";
}

/** A number field. `undefined` when neither node nor declaration has a value. */
export function readNodeNumber(
  node: FlowNodeData,
  field: string
): number | undefined {
  const value = node.data[field];
  if (typeof value === "number") {
    return value;
  }

  const declared = declaredDefault(node.type, field);
  return typeof declared === "number" ? declared : undefined;
}

/** The kinds of box a Text in a page can be shown as (story 096). */
export type CalloutKind = "info" | "warning" | "tip";

/**
 * The box a Text is shown as, or `null` for plain text. Read here and not
 * in each consumer — the viewer, the canvas card and the health all ask —
 * so an unknown value in an old or hand-edited guide is plain text in all
 * three, never a box in one and text in another.
 */
export function calloutKind(node: FlowNodeData): CalloutKind | null {
  const presentation = readNodeString(node, "presentation");
  return presentation === "info" || presentation === "warning" || presentation === "tip"
    ? presentation
    : null;
}

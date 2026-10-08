/**
 * A line the canvas card draws under a node's title that only one node type
 * knows how to write — "Skickas till: Gatukontoret" on a submission (story
 * 068). The card asks here instead of naming the type, so the open editor
 * never imports the receiver registry: the full version registers the
 * recipient line from submission-node-properties.ts (open-core step 3c,
 * UPPDELNING §11b). Nothing registered draws nothing. The function returns
 * HTML the card inserts as it is, so it escapes what it writes.
 */
import type { FlowNodeData } from "../../viewer/types/graph";

export type NodeSummary = (node: FlowNodeData, locale: string) => string;

const summaries = new Map<string, NodeSummary>();

export function registerNodeSummary(type: string, summary: NodeSummary): void {
  summaries.set(type, summary);
}

export function unregisterNodeSummary(type: string): void {
  summaries.delete(type);
}

export function nodeSummary(node: FlowNodeData, locale: string): string {
  return summaries.get(node.type)?.(node, locale) ?? "";
}

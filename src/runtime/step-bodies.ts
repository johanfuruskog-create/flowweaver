/**
 * A step body the server-side view model cannot write itself. The pro
 * version's e-mail result is the one today — its body is what the mail would
 * say — and it used to be a `case` in `toStepViewModel` that imported the
 * e-mail service, the pro version's file. A registered body returns the text
 * for a `result` view model, or null for the node's own description.
 * (open-core step 4, 2026-10-06)
 */
import type { Answers } from "../viewer/core/answer-values";
import type { FlowNodeData, GraphData } from "../viewer/types/graph";

export type StepBody = (node: FlowNodeData, answers: Answers, graph: GraphData, locale: string | undefined) => string | null;

const bodies = new Map<string, StepBody>();

export function registerStepBody(type: string, body: StepBody): void {
  bodies.set(type, body);
}

export function unregisterStepBody(type: string): void {
  bodies.delete(type);
}

export function stepBody(type: string): StepBody | null {
  return bodies.get(type) ?? null;
}

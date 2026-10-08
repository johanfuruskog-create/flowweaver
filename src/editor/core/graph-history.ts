import type { GraphData } from "../../viewer/types/graph";

/**
 * Undo/redo history for the graph. Holds a present state plus stacks of past
 * and future states. A run of text edits (`node-updated`) is merged into a
 * single undo step.
 */
export class GraphHistory {
  private past: GraphData[] = [];
  private future: GraphData[] = [];
  private present: GraphData | null = null;
  private lastReason: string | null = null;
  private readonly limit: number;

  constructor(limit = 50) {
    this.limit = limit;
  }

  /** Resets the history to a new present state (e.g. on load). */
  reset(graph: GraphData): void {
    this.present = structuredClone(graph);
    this.past = [];
    this.future = [];
    this.lastReason = null;
  }

  /** Records a new state. Identical states are ignored. */
  record(graph: GraphData, reason: string): void {
    const next = structuredClone(graph);

    if (this.present && this.equal(this.present, next)) {
      return;
    }

    if (this.present !== null) {
      // A run of the same kind of micro-step (typing, or an arrow-key move)
      // is merged into a single undo step.
      const coalescingReasons = ["node-updated", "node-nudged"];
      const coalesce =
        reason === this.lastReason && coalescingReasons.includes(reason);
      if (!coalesce) {
        this.past.push(this.present);
        if (this.past.length > this.limit) {
          this.past.shift();
        }
      }
    }

    this.present = next;
    this.future = [];
    this.lastReason = reason;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): GraphData | null {
    const previous = this.past.pop();
    if (previous === undefined || this.present === null) {
      return null;
    }
    this.future.push(this.present);
    this.present = previous;
    this.lastReason = null;
    return structuredClone(previous);
  }

  redo(): GraphData | null {
    const next = this.future.pop();
    if (next === undefined || this.present === null) {
      return null;
    }
    this.past.push(this.present);
    this.present = next;
    this.lastReason = null;
    return structuredClone(next);
  }

  private equal(a: GraphData, b: GraphData): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }
}

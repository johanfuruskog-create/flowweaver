/**
 * Step renderers: how `<guide-preview>` draws a step it does not draw itself.
 *
 * Story 147 (open-core step 3a). The viewer used to name the full version's
 * steps — *Inlämning* and *E-postresultat* — in its own branches and carry
 * the code that sends. Now it asks here first: a type with a renderer is drawn
 * by it; a type without one falls through to the viewer's own branches, and an
 * ending type with neither is drawn as a plain result (title and description,
 * nothing sent — see `renderNode`). The full version registers its two
 * renderers from `guide-preview/submission-steps.ts`.
 *
 * The context is exactly what the moved code needed and nothing more: a new
 * need is a new member here, in its own commit with the reason. Same rule as
 * the declarative `behavior`: the registry is open, the renderers are whoever
 * registers them.
 */
import type { GuideTraversalEngine } from "../core/guide-traversal-engine";
import type { FlowNodeData, GraphData } from "../types/graph";
import type { FormattingFeature } from "../types/node-types";

export interface StepContext {
  /** The graph as set on the element (may be unmigrated); `guideGraph()` is the one the engine runs. */
  readonly graph: GraphData | null;
  guideGraph(): GraphData | undefined;
  readonly engine: GuideTraversalEngine | null;
  readonly locale: string;
  /** The preview's shadow root — for the honeypot and the live region. */
  readonly root: ShadowRoot;
  /** `in-node` and `compact` attributes: drawn inside a canvas card, or the editor's short form. */
  readonly inNode: boolean;
  readonly compact: boolean;
  /** When this run of the guide began — the robot protection's clock. */
  readonly guideStartedAt: number;
  /** The editor's variable inspector is on (test runs); the recipient inspector follows it. */
  readonly inspectorEnabled: boolean;
  chrome(key: string, params?: Record<string, string | number>): string;
  localized(value: unknown, fallback?: string): string;
  headingAndDescription(node: FlowNodeData, override?: { title: string; holdRoom?: boolean }): string;
  sentAnswers(): string;
  navigation(showNext: boolean): string;
  resultPaths(node: FlowNodeData): string;
  formattingFor(node: FlowNodeData, propertyId: string): FormattingFeature[];
  formatDescription(node: FlowNodeData, value: string): string;
  dispatchProgress(kind: string, nodeId: string): void;
  rerender(): void;
}

export interface StepRenderer {
  /** The card's HTML, as `renderResult` gives it. */
  render(node: FlowNodeData, ctx: StepContext): string;
  /** After the preview has drawn and bound its own events: bind yours, fill the live region. */
  afterRender?(root: ShadowRoot, ctx: StepContext): void;
  /** The guide restarts or a new guide arrives: forget what this run held. */
  reset?(): void;
  /** This step sends the answers somewhere — the review's declaration says so when one is in the guide. */
  sends?: boolean;
  /** The string key for the button that leads INTO this step (`nav.submit`); default is *Nästa*. */
  entersWith?: string;
  /** What `guide-preview.getOutput()` returns while this step is current. */
  output?(node: FlowNodeData, ctx: StepContext): unknown;
  /** The editor's inspector below the step, when `ctx.inspectorEnabled`; empty otherwise. */
  inspector?(ctx: StepContext): string;
}

const renderers = new Map<string, StepRenderer>();

export function registerStepRenderer(type: string, renderer: StepRenderer): void {
  renderers.set(type, renderer);
}

export function unregisterStepRenderer(type: string): void {
  renderers.delete(type);
}

export function getStepRenderer(type: string): StepRenderer | null {
  return renderers.get(type) ?? null;
}

/** Every registered renderer, for the hooks that address all of them (reset, afterRender, inspector). */
export function stepRenderers(): StepRenderer[] {
  return [...renderers.values()];
}

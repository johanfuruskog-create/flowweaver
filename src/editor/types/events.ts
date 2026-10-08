import type { FlowNodeData, GraphData, GuideMeta, PortDirection } from "../../viewer/types/graph";

export interface PortInteractionDetail {
  nodeId: string;
  portId: string;
  direction: PortDirection;
  portElement: HTMLElement;
  pointerId: number;
  /** "touch", "mouse" or "pen" — how wide the snap target should be. */
  pointerType: string;
}

export interface NodeDragStartDetail {
  nodeId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
}

export interface NodeSelectDetail {
  nodeId: string;
  /**
   * Enter on a focused node: select it and open the side panel on it (story
   * 145, criterion 6). A click selects without opening — the panel lies over
   * the flow, and a click is often only a look.
   */
  open?: boolean;
}

/** Keyboard move of a node (arrow keys): offset in canvas pixels. */
/** Which way somebody asked to move, when they were only looking. */
export interface NodeNavigateDetail {
  nodeId: string;
  dx: number;
  dy: number;
}

export interface NodeNudgeDetail {
  nodeId: string;
  dx: number;
  dy: number;
}

export interface SelectionChangedDetail {
  nodeId: string | null;
  connectionId: string | null;
}

export interface GraphChangedDetail {
  graph: GraphData;
  reason:
    | "node-moved"
    | "node-nudged"
    | "node-created"
    | "node-removed"
    | "start-node-changed"
    | "node-updated"
    /** The node's provenance set, swapped or removed. Its own undo step. */
    | "node-template-changed"
    | "guide-updated"
    | "graph-imported"
    /**
     * Formulärstommen, lagd i ett grepp.
     *
     * Egen anledning och inte `node-created`: stommen är fyra noder och två
     * kopplingar som hör ihop, och en ångring ska ta hela receptet — inte en
     * nod i taget tills redaktören undrar hur många gånger till.
     */
    | "form-skeleton-added"
    | "graph-reset"
    | "connection-created"
    | "connection-removed"
    | "connection-recolored";
}

export interface NodeDataChangedDetail {
  nodeId: string;
  property: string;
  value: unknown;
}

export interface NodeVisibilityChangedDetail {
  nodeId: string;
  visibility?: FlowNodeData["visibility"];
}

export interface GuideSourceLocaleChangedDetail {
  /** The language the guide counts as written in from now on. */
  sourceLocale: string;
}

export interface NodeTemplateChangedDetail {
  nodeId: string;
  /** The template's key, or null for no template. */
  template: string | null;
}

export interface LocaleChangeDetail {
  locale: string;
}

export interface GuideStringChangedDetail {
  key: string;
  value: unknown;
}

export interface GuideLocalesChangedDetail {
  locales: string[];
}

/**
 * A guide-wide setting toggled in the panel — `GuideSettings`, not `GuideMeta`.
 *
 * Kept apart from `guide-string-changed`, which writes into `settings.strings`
 * and means something else: this is the guide's behaviour, that is its wording.
 */
export interface GuideSettingChangedDetail {
  key: "progress";
  value: boolean;
}

/** One of the guide's own metadata fields changed in the panel. */
export interface GuideMetaChangedDetail {
  key: keyof GuideMeta;
  value: unknown;
}
export interface NodeLayoutChangedDetail {
  nodeId: string;
  columnSpan?: 4 | 6 | 12;
  breakBefore?: boolean;
}
export interface NodeOrderChangedDetail {
  nodeId: string;
  direction: "up" | "down";
}
export interface NodeTypeDragStartDetail {
  type: string;
  pointerId: number;
  clientX: number;
  clientY: number;
}
export interface QuestionOptionRemoveDetail {
  nodeId: string;
  optionId: string;
}

export interface QuestionOptionMoveDetail {
  nodeId: string;
  optionId: string;
  direction: "up" | "down";
}

export interface QuestionOptionReorderDetail {
  nodeId: string;
  optionId: string;
  targetIndex: number;
}

export interface RuleCaseRemoveDetail {
  nodeId: string;
  caseId: string;
  cases: import("../../viewer/types/graph").RuleCase[];
}

export interface NodeTypeAddDetail {
  type: string;
}

export interface GraphImportRequestDetail {
  fileName: string;
  json: string;
  /**
   * Which menu item was used.
   *
   * The handler reads whichever shape the file turns out to be, so this does not
   * decide what happens — it decides what is *said* when the two disagree. A
   * template picked under "Importera guide" is still added to the palette, and
   * the toast says so rather than leaving somebody to wonder why their guide is
   * unchanged.
   */
  expecting?: "guide" | "template";
}

export interface ToastRequestDetail {
  message: string;
  type: "success" | "error" | "info";
}

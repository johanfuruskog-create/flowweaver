import { escapeHtml } from "../../../viewer/core/escape-html";
import styles from "./node-editor.scss?inline";

import "../flow-node/flow-node";

import type {
  Connection,
  ConnectionColor,
  FlowNodeData,
  GraphData,
} from "../../../viewer/types/graph";

/**
 * The colours a connection can take, in menu order. `null` is the default and
 * comes first, so the way back is as short as the way away.
 */
const CONNECTION_COLOR_CHOICES: Array<ConnectionColor | null> = [
  null,
  "content",
  "rule",
  "calc",
  "service",
  "end",
  "danger",
];
import type {
  PortInteractionDetail,
  NodeDragStartDetail,
  NodeSelectDetail,
  NodeNudgeDetail,
  SelectionChangedDetail,
  GraphChangedDetail,
} from "../../types/events";

import { CanvasPanController } from "../../controllers/canvas-pan-controller";
import { canEditGuide } from "../../../viewer/types/node-types";
import { placeAt, toWorkspacePoint } from "./canvas-coordinates";
import { CANVAS_ICONS } from "./canvas-icons";
import { isLocalizedTextMap, resolveText } from "../../../viewer/core/localized-text";
import { displayNodeTypeLabel } from "../../services/template-library";
import type { EditorMode } from "../../../viewer/types/node-types";

import { FlowNode } from "../flow-node/flow-node";
import type { GuidePreview } from "../../../viewer/components/guide-preview/guide-preview";
import { drawnAsStep } from "../../../viewer/components/guide-preview/guide-preview";

import {
  canNodeTypeBeInPage,
  getNodePorts,
  isGuideStepNode,
  isPageOnlyNodeType,
} from "../../../viewer/node-types/node-type-registry";
import { canBeTemplateBase } from "../../../viewer/node-types/node-templates";
import { isEndingNodeType } from "../../../viewer/node-types/node-type-registry";
import { findGuidePathsToResult } from "../../../viewer/core/guide-route-analyzer";
import { templateLabel } from "../../services/template-library";
import { ProvingTrailService } from "../../services/proving-trail-service";
import type { ProvingState } from "../../services/proving-trail-service";
import { SOURCE_LOCALE } from "../../../viewer/core/localized-text";
import { interpolate, t } from "../../localization/editor-ui-strings";
import {
  addNode as addGraphNode,
  addConnection,
  removeNode as removeGraphNode,
  removeConnection as removeGraphConnection,
  removeConnectionsFromOutput as removeGraphConnectionsFromOutput,
  setStartNode as setGraphStartNode,
  updateNodeData as updateGraphNodeData,
  moveNodeToPage,
  removeNodeFromPage,
  duplicateNode as duplicateGraphNode,
} from "../../core/graph-operations";

interface Point {
  x: number;
  y: number;
}

export type ViewportCenter = Point;

/** `smooth`: glide to the centre instead of cutting — see `centerViewportAt`. */
export interface CenterOptions {
  smooth?: boolean;
}

interface WorkspaceGeometry {
  width: number;
  height: number;
  originX: number;
  originY: number;
}

/**
 * A run of the guide on the canvas — story 065.
 *
 * The canvas draws it; the shell owns it. The engine behind the run is the
 * preview panel's, and everything here is what that engine has already
 * decided — which is why there is no state machine on this side to keep in
 * step with it.
 */
export type { ProvingState } from "../../services/proving-trail-service";

interface ContextMenuState {
  kind: "connection" | "node";
  id: string;
  x: number;
  y: number;
}

interface ActiveConnection {
  fromNodeId: string;
  fromPortId: string;
  fromPortElement: HTMLElement;
  pointerId: number;
  /** What is doing the dragging — a finger needs a wider target than a mouse. */
  pointerType: string;
}

interface ActiveNodeDrag {
  nodeId: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  originalParentPageId?: string;
  /**
   * The drag started in the palette and the node exists only because it is
   * being dragged. Dropped outside the canvas, the whole drag is undone — see
   * `handleWindowPointerUp`.
   */
  fromPalette?: boolean;
  /**
   * The last known pointer position from a `pointermove`.
   *
   * The decision must not rest on the `pointerup` coordinates: a synthetic or
   * cancelled pointer event may lack them, and they then come out as `(0, 0)` —
   * which reads as "outside the canvas" and would delete the node. With no
   * movement at all it was a click, not a drag, and then nothing is undone.
   */
  lastPointer?: { x: number; y: number };
}

/** Where a page's fields land, and how tall the field area came out. */
interface PageChildPlan {
  layouts: Map<string, Point>;
  contentHeight: number;
}

const PAGE_WIDTH = 660;
/**
 * Where a page's fields start, below the page's own text block.
 *
 * `PAGE_CONTENT_TOP` was 260 and the dashed frame's `inset` 214px. Measured on
 * page-builder the page node's `.flow-node__content` ends at 221 px, so the
 * constants happened to look right — and a title that wraps onto a second line
 * or a longer description moves that bottom while the constant stays put, and
 * the text ends up underneath the first field (measured: 22 px of overlap).
 *
 * So the field area's top is the *measured* bottom of the text block plus a
 * gap, exactly as a row's height is measured rather than assumed. The fallback
 * is the measurement for a one-line title with a one-line description; a page
 * therefore looks the same before and after its first measurement.
 *
 * What the 106 px below the description are: the page node's own ports — 18 px
 * of margin plus two 28 px port rows with a 16 px gap — and the content box's
 * 16 px of bottom padding. Those are the connection lines' anchors, not air
 * without a job; moving them out of the text block is the page node's redesign
 * (B), parked. What could go was the drop hint's band above the fields: the
 * hint now sits on the frame's top edge instead of in a band of its own.
 */
const PAGE_INTRO_FALLBACK_BOTTOM = 221;
const PAGE_INTRO_GAP = 20;
/**
 * The nominal height of one field row: the fallback until the row has been
 * measured, plus the gap that separates two rows.
 *
 * They used to be one number, `PAGE_CHILD_STEP = 130`, and a fixed row step
 * cannot know how tall a field ended up. Measured on page two of
 * `page-builder`, where both fields carry a visibility row: each field is 144
 * px tall and the step gave them 130, so `service-email-address` and
 * `service-phone-number` overlapped by 14 px — the third field's header lay
 * over the second one's labels, and the drag grip sat on top of the field
 * nobody wanted to touch.
 *
 * 111 is a plain full-width field without a visibility row; 19 is the air the
 * old step left between two such rows (130 − 111), kept so an unmeasured page
 * looks exactly as it did.
 */
const PAGE_CHILD_FALLBACK_HEIGHT = 111;
const PAGE_ROW_GAP = 19;
/** One nominal row, still the right unit for "a row's worth of margin". */
const PAGE_CHILD_STEP = PAGE_CHILD_FALLBACK_HEIGHT + PAGE_ROW_GAP;
const PAGE_CONTENT_LEFT = 20;
const PAGE_CONTENT_WIDTH = 620;
const PAGE_COLUMN_GAP = 12;
const PAGE_BOTTOM_PADDING = 24;

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 1.1;

// Edge panning starts only once the pointer has lingered in the edge zone this
// long, and only while it moves towards the edge — so the view does not run off
// when dragging in a new element or releasing near the edge.
const AUTO_PAN_DWELL_MS = 200;

interface SnapTarget {
  nodeId: string;
  portId: string;
  portElement: HTMLElement;
  point: Point;
}

/**
 * A press on a button laid outside the canvas viewport, on a device that may
 * never send the click. Measured twice on Johan's iPad: the way-back button
 * 25/9 and the zoom buttons 28/9 — `pointerdown` and `pointerup` every time,
 * `isTrusted`, and no `click`. Why is written above `bindTheWayBack`; this is
 * the route that works: a tap that stayed put counts on `pointerup`, and the
 * compatibility click that may follow within `SAME_PRESS` is ignored so a
 * browser that sends both does not act twice. A mouse is left alone entirely —
 * its click path works — and so is the keyboard, whose click has `detail` 0.
 * The pointer route never blocks the next tap: a second tap is a second press
 * (zoom buttons are pressed in a row), only its own click is swallowed.
 */
function onPress(button: HTMLElement, act: (fromPointer: boolean) => void): void {
  /** Long enough to cover a compatibility click after a tap. */
  const SAME_PRESS = 700;
  /** A tap is a press that stayed put; beyond this the finger was doing something else. */
  const TAP_SLOP = 12;
  let from: { x: number; y: number } | null = null;
  let ignoreClickUntil = 0;

  button.addEventListener("pointerdown", (event: PointerEvent) => {
    from = event.pointerType === "mouse" ? null : { x: event.clientX, y: event.clientY };
  });

  button.addEventListener("pointerup", (event: PointerEvent) => {
    const started = from;

    from = null;
    if (!started || event.pointerType === "mouse") return;
    if (Math.hypot(event.clientX - started.x, event.clientY - started.y) > TAP_SLOP) return;
    ignoreClickUntil = performance.now() + SAME_PRESS;
    act(true);
  });

  button.addEventListener("click", (event: MouseEvent) => {
    if (performance.now() < ignoreClickUntil) return;
    act(event.detail > 0);
  });
}

export class NodeEditor extends HTMLElement {
  private readonly root: ShadowRoot;

  private activeNodeDrag: ActiveNodeDrag | null = null;
  private activeDropPageId: string | null = null;
  private activeDropOrder = 0;
  private activeDropBreak = false;

  private panController: CanvasPanController | null = null;

  private graphData: GraphData = {
    startNodeId: null,
    nodes: [],
    connections: [],
  };

  /** Språket noderna visas i på canvasen; faller tillbaka på källan. */
  set activeLocale(value: string) {
    if (this.activeLocaleValue === value) {
      return;
    }
    this.activeLocaleValue = value;
    this.renderNodes();
  }

  private uiLocale: string = SOURCE_LOCALE;

  /** Lokaliserad chrome-text i editorns UI-språk. */
  private text(key: string, params?: Record<string, string | number>): string {
    const resolved = t(key, this.uiLocale);
    return params ? interpolate(resolved, params) : resolved;
  }

  /** Editorns UI-språk (chrome) – en egen axel från innehålls-språket. */
  set editorLocale(value: string) {
    if (value === this.uiLocale) {
      return;
    }
    this.uiLocale = value;
    if (this.isConnected) {
      this.render();
    }
  }

  private untranslatedNodeIdsValue = new Set<string>();

  /** Noder som saknar översättning i aktivt språk (markeras på canvasen). */
  set untranslatedNodeIds(ids: string[]) {
    const next = new Set(ids);
    if (
      next.size === this.untranslatedNodeIdsValue.size &&
      [...next].every((id) => this.untranslatedNodeIdsValue.has(id))
    ) {
      return;
    }
    this.untranslatedNodeIdsValue = next;
    this.renderNodes();
  }

  private showVariablesValue = false;

  /**
   * Whether the cards show their variable names (Vy → Visa variabelnamn,
   * story 077). Off by default: the name is right to see when writing a
   * condition or a template, across the whole guide at once, and noise the
   * rest of the time. Like the eyes, the canvas's and never the guide's — an
   * attribute per card, no re-render.
   */
  set showVariables(value: boolean) {
    this.showVariablesValue = value;
    this.root.querySelectorAll<FlowNode>("flow-node").forEach((node) => {
      node.toggleAttribute("data-show-variables", value);
    });
  }

  get showVariables(): boolean {
    return this.showVariablesValue;
  }

  private visitorViewNodeIds = new Set<string>();

  /**
   * The nodes drawn the way a visitor sees them.
   *
   * The state is the canvas's and never the guide's (story 064 point 7): it is
   * not in the graph, so nothing here dispatches `graph-changed` and `graph`
   * comes back byte-identical after a switch. The menu's *show them all* sets
   * every node's eye through the same set — it is a command, not a second state
   * beside the nodes'.
   *
   * Not remembered between sessions. Story 064 asks for `localStorage` per
   * guide, and there is no per-guide identity to key it on: a graph carries no
   * id, and a key derived from its contents would change the moment somebody
   * edits the guide — which is the opposite of remembering. The other half of
   * the same story point says editing opens with every eye out, and that is
   * what happens. Written up in the assignment's Status.
   */
  set visitorViewNodes(ids: string[]) {
    this.visitorViewNodeIds = new Set(ids);
    this.applyVisitorView();
  }

  /** Every node the viewer can draw as a step — what "show them all" reaches. */
  get visitorViewCandidates(): string[] {
    return this.graphData.nodes
      .filter((node) => !node.parentPageId && drawnAsStep(node.type))
      .map((node) => node.id);
  }

  private applyVisitorView(): void {
    const everyStep = this.provingValue !== null && !this.provingValue.stale;

    this.root.querySelectorAll<FlowNode>("flow-node").forEach((element) => {
      const id = element.nodeId;

      element.visitorView =
        id !== null &&
        (this.visitorViewNodeIds.has(id) ||
          (everyStep && this.visitorViewCandidates.includes(id)));
    });
    this.hidePageChildrenInVisitorView();
  }

  /**
   * A page showing the visitor's view draws its own fields, so the field cards
   * standing on top of it have to go.
   *
   * They are separate nodes on the canvas, positioned inside the page's frame —
   * leaving them there would put a card over every field of the drawn form.
   * `hidden` and not a class: the card must be out of the accessible tree and
   * out of the tab order too, and it has nothing to say while its page is
   * drawing it.
   */
  private hidePageChildrenInVisitorView(): void {
    /*
     * Asked of the drawn nodes, not of the set of lit eyes. A run lights every
     * step without touching that set (see `applyVisitorView`), and reading the
     * set here left a page drawing its own form with the field cards still
     * standing on top of it.
     */
    const drawnAsVisitor = new Set(
      [...this.root.querySelectorAll<FlowNode>("flow-node")]
        .filter((element) => element.visitorView && element.nodeId !== null)
        .map((element) => element.nodeId as string),
    );

    this.root.querySelectorAll<FlowNode>("flow-node").forEach((element) => {
      const id = element.nodeId;
      const node = this.graphData.nodes.find((candidate) => candidate.id === id);
      const parent = node?.parentPageId;

      if (!parent) return;
      element.hidden = drawnAsVisitor.has(parent);
    });

    this.root
      .querySelectorAll<HTMLElement>(".node-editor__page-surface")
      .forEach((surface) => {
        const pageId = surface.dataset.pageId;

        surface.toggleAttribute(
          "data-visitor-view",
          pageId !== undefined && drawnAsVisitor.has(pageId),
        );
      });
  }

  private provingValue: ProvingState | null = null;

  /**
   * What the canvas draws while the guide is being run on it (story 065).
   *
   * `null` outside a run, and then nothing here is on: no line, no
   * "Du är här", no trail. The shell sets this after every step, because the
   * engine that decides is the preview panel's — one engine, two mirrors.
   */
  set proving(value: ProvingState | null) {
    this.provingValue = value;
    this.applyProving();
    this.drawConnections();
  }

  get proving(): ProvingState | null {
    return this.provingValue;
  }

  private provingSourceValue: GuidePreview | null = null;

  /**
   * The preview whose engine the live step draws — one engine, two mirrors.
   *
   * Set by the shell, which owns both halves; the canvas only hands it to the
   * node the run is standing on. Separate from `proving` because it is a
   * component to borrow from, not something the engine has decided.
   */
  set provingSource(value: GuidePreview | null) {
    this.provingSourceValue = value;
    this.applyProving();
  }

  get provingSource(): GuidePreview | null {
    return this.provingSourceValue;
  }

  /** The other mirror of the run: the live step on the node it stands on. */
  get liveStep(): GuidePreview | null {
    const id = this.provingValue?.currentNodeId;
    return id ? this.findNodeElement(id)?.liveStep ?? null : null;
  }

  private applyProving(): void {
    const state = this.provingValue;
    /*
     * Stale is the end of the run for everything but the bar. When the guide
     * is edited mid-run the author is EDITING: lines back to full, nodes lit,
     * eyes and menus back — only the bar stays to say "Guiden ändrad — börja
     * om". Before this, the whole canvas sat dimmed and locked-looking while
     * the author worked (Johans bild 2/9).
     */
    const active = state !== null && !state.stale;

    this.toggleAttribute("data-proving", active);

    const bar = this.root.querySelector<HTMLElement>("[data-proving-bar]");
    const text = this.root.querySelector<HTMLElement>("[data-proving-text]");

    if (bar) bar.hidden = state === null;

    if (text && state) {
      text.textContent = state.stale
        ? this.text("editor.proving.changed")
        : this.text("editor.proving.status", { step: state.step });
    }

    const onTrail = ProvingTrailService.trailPorts(this.graphData, state);
    const answered = ProvingTrailService.answeredNodes(this.graphData, state);
    const steps = ProvingTrailService.stepNumbers(this.graphData, state, answered);

    this.root.querySelectorAll<FlowNode>("flow-node").forEach((element) => {
      const id = element.nodeId;
      const isCurrent = active && id === state.currentNodeId;

      element.proving = active;
      element.provingAnswers = state?.answers ?? null;
      element.provingSource = isCurrent ? this.provingSourceValue : null;
      element.provingCurrent = isCurrent;
      element.provingAnswered = id !== null && answered.has(id);
      element.provingStep = id === null ? null : steps.get(id) ?? null;
      element.trail = id === null ? null : onTrail.get(id) ?? null;
    });

    /*
     * A run shows every step the way a visitor sees it, the way read-only mode
     * does — the structure is what the run is not about. The eyes themselves
     * are untouched, so ending the run puts the canvas back exactly as the
     * author left it.
     */
    this.applyVisitorView();
  }


  private routesLabelValue: string | null = null;

  /**
   * The routes bar's text — "Vägar till: …" — or null when the mode is off.
   * Set by the shell; the canvas only draws the bar and asks to end the mode.
   */
  set routesLabel(value: string | null) {
    if (value === this.routesLabelValue) return;

    this.routesLabelValue = value;

    const bar = this.root.querySelector<HTMLElement>("[data-routes-bar]");
    const text = this.root.querySelector<HTMLElement>("[data-routes-text]");

    if (bar) bar.hidden = value === null;
    if (text) text.textContent = value ?? "";
  }

  get routesLabel(): string | null {
    return this.routesLabelValue;
  }

  private bindProvingBar(): void {
    const ask = (name: string) => () =>
      this.dispatchEvent(
        new CustomEvent(name, { bubbles: true, composed: true }),
      );

    this.root
      .querySelector<HTMLButtonElement>("[data-proving-restart]")
      ?.addEventListener("click", ask("proving-restart-request"));
    this.root
      .querySelector<HTMLButtonElement>("[data-proving-end]")
      ?.addEventListener("click", ask("proving-end-request"));
    this.root
      .querySelector<HTMLButtonElement>("[data-routes-end]")
      ?.addEventListener("click", ask("routes-end-request"));
  }

  private readonly handleVisitorViewIntent = (event: Event): void => {
    const { nodeId } = (event as CustomEvent<{ nodeId: string }>).detail;
    const lit = !this.visitorViewNodeIds.has(nodeId);

    if (lit) {
      this.visitorViewNodeIds.add(nodeId);
    } else {
      this.visitorViewNodeIds.delete(nodeId);
    }

    /*
     * The one element, not a re-render. Redrawing the canvas would replace the
     * button that was just pressed and take the focus with it — the same fault
     * the menu button's patching was written against.
     */
    this.root.querySelectorAll<FlowNode>("flow-node").forEach((element) => {
      if (element.nodeId === nodeId) {
        element.visitorView = lit;
      }
    });
    this.hidePageChildrenInVisitorView();
    // The exits of a branching question move to their answers' rows, and the
    // node's size does not change — so nothing else would ask for a redraw.
    this.scheduleDrawConnections();
  };

  set graph(value: GraphData) {
    this.graphData = structuredClone(value);

    /*
     * A node that is gone takes its eye with it, and a node that is new arrives
     * with none (story 064: new nodes start unlit). Pruning rather than clearing,
     * so an undo or a save round trip does not put every node back to structure
     * while somebody is looking at the visitor's view.
     */
    for (const id of [...this.visitorViewNodeIds]) {
      if (!this.graphData.nodes.some((node) => node.id === id)) {
        this.visitorViewNodeIds.delete(id);
      }
    }

    // A read-only canvas draws every step the way a visitor sees it, including
    // the nodes of a guide that arrives after the mode was set.
    if (!this.canMutate()) {
      this.syncVisitorViewToMode();
    }

    if (
      this.selectedNodeId &&
      !this.graphData.nodes.some((node) => node.id === this.selectedNodeId)
    ) {
      this.selectedNodeId = null;
    }

    if (
      this.selectedConnectionId &&
      !this.graphData.connections.some(
        (connection) => connection.id === this.selectedConnectionId,
      )
    ) {
      this.selectedConnectionId = null;
    }

    if (!this.isConnected) {
      return;
    }

    this.renderNodes();
    this.scheduleInitialViewportPosition();

    requestAnimationFrame(() => {
      this.scheduleDrawConnections();
    });
  }

  get graph(): GraphData {
    return structuredClone(this.graphData);
  }

  private selectedNodeId: string | null = null;
  private selectedConnectionId: string | null = null;
  private highlightedConnectionIds: Set<string> | null = null;
  private activeLocaleValue: string = SOURCE_LOCALE;

  private activeConnection: ActiveConnection | null = null;
  private connectionMenu: ContextMenuState | null = null;

  private resizeObserver: ResizeObserver | null = null;
  /**
   * Watches the nodes themselves, and redraws the lines when one changes height.
   *
   * Separate from `resizeObserver` on purpose. That one answers a change in the
   * *viewport* and preserves the centre while it does; a node growing is not a
   * reason to move the view, and running that logic here would shift the canvas
   * under the editor every time a warning appeared.
   */
  private nodeResizeObserver: ResizeObserver | null = null;
  /**
   * Each drawn node's height in canvas pixels, from `nodeResizeObserver`.
   *
   * The border box, not the drawn rectangle: `getBoundingClientRect` is scaled
   * by the zoom, and a page's rows are laid out in canvas coordinates.
   */
  private nodeHeights = new Map<string, number>();
  /**
   * Each page node's text block bottom, measured from the node's own top in
   * canvas pixels. Feeds `getPageContentTop`.
   */
  private pageIntroBottoms = new Map<string, number>();
  private lastViewportSize: { width: number; height: number } | null = null;
  private lastHostSize: { width: number; height: number } | null = null;
  private pendingCenterRestore: ViewportCenter | null = null;
  private centerRestoreTimeout = 0;
  private viewportPositionRequest = 0;
  private workspaceGeometry: WorkspaceGeometry = {
    width: 2000,
    height: 1400,
    originX: 1000,
    originY: 700,
  };
  private expandingWorkspace = false;

  private readonly workspaceBuffer = 300;
  private readonly workspaceGrowth = 800;

  /**
   * Air around content, in canvas px at zoom 1 — shared so "the start node with
   * air" and "the whole graph with air" agree on how much air that is.
   */
  private readonly contentPadding = 80;

  private quickStartHintValue = false;

  /** Skalet säger till när Snabbstart: formulär finns i menyn (sidor i nivån). */
  set quickStartHint(value: boolean) {
    if (value === this.quickStartHintValue) return;
    this.quickStartHintValue = value;
    const hint = this.root.querySelector<HTMLElement>("[data-quickstart-hint]");
    if (hint) hint.hidden = !value;
  }

  highlightConnections(connectionIds: string[]): void {
    this.highlightedConnectionIds =
      connectionIds.length > 0 ? new Set(connectionIds) : null;
    this.drawConnections();
  }

  clearConnectionHighlights(): void {
    if (!this.highlightedConnectionIds) {
      return;
    }

    this.highlightedConnectionIds = null;
    this.routeTargetId = null;
    this.drawConnections();
  }

  private snapTarget: SnapTarget | null = null;

  /**
   * How near a line has to be dropped, **in canvas px at zoom 1**.
   *
   * A finger gets more room than a mouse, and not as a courtesy: a fingertip
   * covers roughly 40 px of screen and hides the very port it is aiming at, so
   * the person is placing something they cannot see. A mouse pointer is a pixel
   * with a visible tip.
   */
  private readonly snapDistance = 35;

  private readonly snapDistanceTouch = 60;

  /**
   * The radius to snap within, in canvas units, for the drag in progress.
   *
   * Divided by the zoom, which is the fix for a fault that had it exactly
   * backwards. All geometry here is canvas px, so a fixed radius shrinks *on
   * screen* as the canvas zooms out — and zooming out to see the whole guide is
   * precisely when somebody reaches across it to connect two nodes. At 0.5 the
   * target was half the size it felt at 1.
   */
  private snapRadius(): number {
    const base =
      this.activeConnection?.pointerType === "touch"
        ? this.snapDistanceTouch
        : this.snapDistance;

    return base / this.zoom;
  }

  /** Auto-pan är avstängd tills pekaren varit i viewportens inre. */
  private autoPanArmed = false;

  /** When the pointer first reached the edge zone (performance.now), for the delay. */
  private autoPanDwellStart: number | null = null;

  /** The previous pointer position, to judge movement towards the edge. */
  private autoPanLastPointer: { x: number; y: number } | null = null;

  /**
   * The view's zoom level. The workspace and the node layer are scaled by it, so
   * every client-to-canvas conversion divides by zoom. This is the only point
   * where the zoom factor enters — all other geometry works in canvas px.
   */
  private zoom = 1;

  constructor() {
    super();

    this.root = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this.render();
    this.bindEvents();
    this.observeEditorSize();
    this.scheduleInitialViewportPosition();

    requestAnimationFrame(() => {
      this.scheduleDrawConnections();
    });
  }

  disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    this.nodeResizeObserver?.disconnect();
    this.lastViewportSize = null;
    this.viewportPositionRequest += 1;
    window.clearTimeout(this.centerRestoreTimeout);
    this.pendingCenterRestore = null;

    const viewport = this.getViewportElement();

    if (
      this.activeNodeDrag &&
      viewport?.hasPointerCapture(this.activeNodeDrag.pointerId)
    ) {
      viewport.releasePointerCapture(this.activeNodeDrag.pointerId);
    }

    if (this.activeNodeDrag) {
      this.findNodeElement(this.activeNodeDrag.nodeId)?.removeAttribute(
        "data-dragging",
      );
    }

    this.activeNodeDrag = null;
    viewport?.removeAttribute("data-node-dragging");

    window.removeEventListener("pointermove", this.handlePointerMove);

    window.removeEventListener("pointerup", this.handleWindowPointerUp);

    this.removeEventListener("contextmenu", this.handleEditorContextMenu);

    viewport?.removeEventListener("scroll", this.handleViewportScroll);
    viewport?.removeEventListener("wheel", this.handleWheel);
    viewport?.removeEventListener("pointerdown", this.handlePinchDown);
    viewport?.removeEventListener("pointermove", this.handlePinchMove);
    viewport?.removeEventListener("pointerup", this.handlePinchUp);
    viewport?.removeEventListener("pointercancel", this.handlePinchUp);
    viewport?.removeEventListener("pointerdown", this.handlePanDown);
    viewport?.removeEventListener("pointermove", this.handlePanMove);
    viewport?.removeEventListener("pointerup", this.handlePanUp);
    viewport?.removeEventListener("pointercancel", this.handlePanUp);
    this.pinchPointers.clear();
    this.pan = null;
    this.stopGlide();

    if (this.trimTimer !== null) {
      clearTimeout(this.trimTimer);
      this.trimTimer = null;
    }
    viewport?.removeEventListener("keydown", this.handleViewportKeydown);
  }

  getData(): GraphData {
    return structuredClone(this.graphData);
  }

  /** Updates guide settings without redrawing the nodes. */
  setSettings(settings: GraphData["settings"]): void {
    this.graphData = {
      ...this.graphData,
      settings: settings ? structuredClone(settings) : undefined,
    };
  }

  /**
   * Which nodes have problems, and how serious.
   *
   * The map comes from above — the analysis belongs in the guide editor, the
   * canvas only shows it. Both the nodes and the minimap's dots are marked, so a
   * problem off screen can still be seen.
   */
  setNodeIssues(
    issues: Map<string, { severity: "error" | "warning"; label: string }>,
  ): void {
    this.nodeIssues = issues;
    this.applyNodeIssues();
    this.updateMinimap();
    this.updateLostState();
  }

  private nodeIssues = new Map<
    string,
    { severity: "error" | "warning"; label: string }
  >();

  /** Skjuter ut märkningen på de monterade noderna. */
  /**
   * Marks the nodes with what the highlighted connections say about them.
   *
   * Derived from the same set the lines are drawn from rather than computed a
   * second time — two answers to "is this on the route" that could disagree
   * would be worse than none, and a line ending at a dimmed port is exactly the
   * disagreement a reader would notice.
   *
   * The target node is always on the route even when nothing reaches it. That
   * case is the useful one: the guide dims, the node stands lit and alone, and
   * the answer is "nothing leads here".
   */
  private applyRouteToNodes(): void {
    const highlighted = this.highlightedConnectionIds;

    if (!highlighted) {
      this.root
        .querySelectorAll<FlowNode>("flow-node")
        .forEach((element) => {
          element.route = null;
        });
      return;
    }

    const portsByNode = new Map<string, Set<string>>();
    const add = (nodeId: string, portId: string): void => {
      const ports = portsByNode.get(nodeId) ?? new Set<string>();
      ports.add(portId);
      portsByNode.set(nodeId, ports);
    };

    this.graphData.connections
      .filter((connection) => highlighted.has(connection.id))
      .forEach((connection) => {
        add(connection.from.nodeId, connection.from.portId);
        add(connection.to.nodeId, connection.to.portId);
      });

    const onRoute = (nodeId: string): boolean =>
      portsByNode.has(nodeId) || nodeId === this.routeTargetId;

    this.graphData.nodes.forEach((node) => {
      const element = this.findNodeElement(node.id);

      if (!element) {
        return;
      }

      const ports = portsByNode.get(node.id);

      element.route = {
        ports: ports ? [...ports] : [],
        // A field inside a page has no connections of its own — the page
        // carries them — so it is on the route when its page is. Johan's
        // picture, 3 September: the start page lit, its three fields dimmed.
        onRoute: onRoute(node.parentPageId ?? node.id),
      };
    });
  }

  private applyNodeIssues(): void {
    this.graphData.nodes.forEach((node) => {
      const element = this.findNodeElement(node.id);

      if (element) {
        element.health = this.nodeIssues.get(node.id) ?? null;
      }
    });
  }

  /**
   * Updates the guide's own details without redrawing the nodes.
   *
   * Needed because `getData()` returns the canvas's graph. Set the details only
   * on the guide editor's copy and they never get out — the same kind of loss as
   * when import rebuilt the graph from parts and dropped what it did not
   * recognise.
   */
  setMeta(meta: GraphData["meta"]): void {
    this.graphData = {
      ...this.graphData,
      meta: meta ? structuredClone(meta) : undefined,
    };
  }

  private render(): void {
    this.destroyPanController();

    this.root.innerHTML = `
      <style>${styles}</style>

      <section class="node-editor">
        <div class="node-editor__viewport" tabindex="0">
            <div class="node-editor__workspace">
              <div class="node-editor__scaled">
                <svg
                    class="node-editor__connections"
                    aria-hidden="true"
                >
                <defs>
                  <marker
                    id="node-editor-note-arrow"
                    class="node-editor__note-arrow-marker"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="10"
                    markerHeight="10"
                    markerUnits="userSpaceOnUse"
                    orient="auto-start-reverse"
                  >
                    <path d="M 1 1 L 9 5 L 1 9 z"></path>
                  </marker>
                </defs>
                <g class="node-editor__permanent-connections"></g>

                <path
                    class="
                        node-editor__connection
                        node-editor__connection--preview
                    "
                    data-visible="false"
                    ></path>
                </svg>

                <!--
                  Anteckningarnas linjer i ett EGET lager, ovanför noderna.

                  Flödespilarna hör hemma bakom korten — de kopplar kanter, och
                  en linje tvärs över en nod skulle skräpa. Anteckningens linje
                  pekar däremot IN i något: mot ett fält inne på en sida, och
                  sidkortet är ogenomskinligt. I det gemensamma lagret (z-index
                  1, samma som sidan) tog linjen slut vid sidans kant fast
                  geometrin nådde ända fram — Johans öga, mätt till 0 px från
                  fältets överkant.
                -->
                <svg class="node-editor__note-links" aria-hidden="true">
                  <defs>
                    <marker
                      id="node-editor-note-arrow-top"
                      class="node-editor__note-arrow-marker"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="10"
                      markerHeight="10"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z"></path>
                    </marker>
                  </defs>
                </svg>

                <div class="node-editor__nodes"></div>

                <!--
                  Handtagen som öppnar en kopplings meny. Egna element och inte
                  SVG, för då blir de riktiga <button> med Enter, mellanslag och
                  tryck gratis. Efter noderna, så ett handtag aldrig hamnar under
                  en nod och blir oåtkomligt.
                -->
                <div class="node-editor__connection-handles"></div>
              </div>
              <!--
                The node's and the connection's menu. In the scrolling workspace,
                so it scrolls with the canvas by itself — but outside
                \`.node-editor__scaled\`, whose transform makes a stacking
                context of its own: from inside it no z-index reached past the
                minimap, and the map's squares showed through the menu's text
                (measured 28/9 in 900 × 600: \`elementFromPoint\` in a row's
                middle gave the minimap). Out here the layer's popover z-index
                (the scss) lies over the map and the canvas toolbar.

                Not at the editor's own level, where it stood for a day: there
                it had to be placed again on every scroll, and a scroll event
                comes after the scroll — between the two the menu stood where it
                had been, measured as a menu half a canvas from its button when
                the editor centred itself on mount. See \`positionMenu\`.
              -->
              <div class="node-editor__connection-menu-layer"></div>
            </div>
        </div>
        <!--
          Beskedet för den som kopplar med tangentbordet. Utan det är ett halvt
          gjort drag osynligt: markeringen på porten säger ingenting till den som
          inte ser den, och ett tyst läge man inte vet att man är i är värre än
          inget stöd alls.
        -->
        <p class="node-editor__announcement" data-announce role="status" aria-live="polite"></p>
        <!--
          What the mode is called, for whoever is looking at the workspace.

          The properties panel says it already, but only once something is
          selected and only in the panel. The handles disappear in read-only
          mode (see applyModeToDom), and a surface that has gone quiet without
          saying why reads as broken rather than as locked. It carries
          role=status, because the line changes when the mode does. (No
          backticks: the comment sits inside a template string.)
        -->
        <p class="node-editor__mode-plaque" data-mode-plaque role="status" hidden></p>
        <!--
          The line that says a run of the guide is going on (story 065 point 2).

          role=status sits on the sentence and not on the row, so what is
          announced at every step is the step - not the two buttons beside it
          being read out again each time. Outside a run the row is hidden, and
          hidden is the whole of it: it must be out of the tab order too, or
          Avsluta would be a stop on the way to the canvas with nothing to end.
        -->
        <div class="node-editor__proving" data-proving-bar hidden>
          <p class="node-editor__proving-text" data-proving-text role="status"></p>
          <button type="button" class="node-editor__proving-button" data-proving-restart>
            ${this.text("editor.proving.restart")}
          </button>
          <button type="button" class="node-editor__proving-button" data-proving-end>
            ${this.text("editor.proving.end")}
          </button>
        </div>
        <!--
          Vägen tillbaka när guiden hamnat utanför skärmen — se updateLostState
          i node-editor.ts. (Inga bakåtfästen här: kommentaren står i en
          mallsträng, och ett sådant tecken avslutar den.)
        -->
        <button type="button" class="node-editor__lost" data-lost hidden>
          ${this.text("editor.canvas.backToGuide")}
        </button>

        <!--
          "Vägar hit" är ett läge av samma familj som provet: en rad på
          arbetsytan, klick på en nod visar vägarna dit, tom yta släcker
          inget. Skalet äger läget; canvasen ritar bara raden.
        -->
        <div class="node-editor__proving" data-routes-bar hidden>
          <p class="node-editor__proving-text" data-routes-text role="status"></p>
          <button type="button" class="node-editor__proving-button" data-routes-end>
            ${this.text("editor.proving.end")}
          </button>
        </div>

        <div class="node-editor__empty" data-empty hidden>
          <p class="node-editor__empty-title">${this.text("editor.canvas.emptyTitle")}</p>
          <p class="node-editor__empty-text">${this.text("editor.canvas.emptyText")}</p>
          <!-- Bara när menyposten finns (sidor i nivån) — en hänvisning till
               ett grepp som inte syns vore värre än ingen (varv 2, 2/9). -->
          <p class="node-editor__empty-text" data-quickstart-hint ${this.quickStartHintValue ? "" : "hidden"}>${this.text("editor.canvas.emptyQuickStart")}</p>
        </div>
        <!--
          The floating controls' own box (story 145, criterion 8). It is the
          canvas less whatever a host's panel lays over its edges
          (\`--fw-canvas-left-inset\`, \`--fw-canvas-right-inset\`, physical like
          the controls), and it carries
          the \`node-editor\` container name, so the map and the bar step aside
          for an open side panel and choose their arrangement by the room that
          is left — without the canvas, the view or a node moving.
        -->
        <div class="node-editor__controls">
        <!--
          Minikartan är en genväg för pekare och bär ingen egen information: den
          visar var man är i en graf man ändå kan nå med scroll, panorering,
          "Anpassa till innehåll" och sökningen — alla nåbara från tangentbordet.
          Därför aria-hidden, i stället för en kontroll utan meningsfull
          tangentbordsmotsvarighet. Den saknar text och behöver inga ui-strings.
        -->
        <div class="node-editor__minimap" aria-hidden="true" hidden>
          <svg class="node-editor__minimap-links"></svg>
          <div class="node-editor__minimap-nodes"></div>
          <div class="node-editor__minimap-viewport"></div>
        </div>
        <!--
          Uppdrag 23/9, Del A punkt 2: samma tre canvashandlingar Vy-menyn
          redan har (zoom, "Anpassa till innehåll", helskärm), inom räckhåll
          utan att öppna menyn. Vy-menyn står kvar — det här är en genväg,
          inte en ersättning. Anropar bara det som redan finns: zoomIn/
          zoomOut/fitToContent direkt (samma metoder som +/−/F på
          tangentbordet), och samma "fullscreen-toggle-request" som
          editor-toolbar redan skickar (helskärmen ägs av guide-editor, inte
          av canvasen).
        -->
        <!--
          Uppdrag 29/9, Del A (Astra §1): minus, the reading, plus — the
          reading between the two buttons that change it — then ONE divider,
          then the two view actions. Icons drawn in the editor's line manner
          (canvas-icons.ts), never characters. The names stay in aria-label;
          one shared tooltip shows the same name on hover and keyboard focus
          (bindCanvasToolbarTooltip). Placement: see the toolbar rules in
          node-editor.scss.
        -->
        <div class="node-editor__canvas-toolbar" data-canvas-toolbar hidden>
          <button
            type="button"
            class="node-editor__canvas-toolbar-button"
            data-action="canvas-zoom-out"
            aria-label="${this.text("editor.toolbar.zoomOut")}"
          >${CANVAS_ICONS.zoomOut}</button>
          <!--
            The reading is text, not a control, and not a live region: a live
            one would read every step of a pinch aloud. Its context is the
            hidden word before it, so moving through the bar reads "Zoomnivå
            100 %" between "Zooma ut" and "Zooma in".
          -->
          <span class="node-editor__canvas-toolbar-zoom-cell">
            <span class="node-editor__visually-hidden">${this.text("editor.canvas.zoomLevel")}</span>
            <span class="node-editor__canvas-toolbar-zoom" data-canvas-toolbar-zoom>100 %</span>
          </span>
          <button
            type="button"
            class="node-editor__canvas-toolbar-button"
            data-action="canvas-zoom-in"
            aria-label="${this.text("editor.toolbar.zoomIn")}"
          >${CANVAS_ICONS.zoomIn}</button>
          <span class="node-editor__canvas-toolbar-divider" aria-hidden="true"></span>
          <button
            type="button"
            class="node-editor__canvas-toolbar-button"
            data-action="canvas-fit"
            aria-label="${this.text("editor.canvas.showWholeFlow")}"
          >${CANVAS_ICONS.fit}</button>
          <button
            type="button"
            class="node-editor__canvas-toolbar-button"
            data-action="canvas-fullscreen"
            data-canvas-toolbar-fullscreen
            aria-pressed="false"
            aria-label="${this.text("editor.toolbar.fullscreen")}"
          >${CANVAS_ICONS.fullscreen}</button>
          <!--
            The visible name of the button under the pointer or focus. Its
            text is always that button's aria-label, so it is aria-hidden: a
            screen reader already heard the name once, and a describedby to
            the same words would read it twice.
          -->
          <span class="node-editor__canvas-toolbar-tooltip" role="tooltip" aria-hidden="true" data-canvas-toolbar-tooltip hidden></span>
        </div>
        </div>
      </section>
    `;

    this.applyModeToDom();
    this.applyWorkspaceGeometry();
    this.renderNodes();
    this.createPanController();
    this.connectMinimap();
    this.connectCanvasToolbar();
    this.bindViewportEvents();
    this.bindProvingBar();
    this.applyProving();
  }

  private createPanController(): void {
    const viewport = this.getViewportElement();

    if (!viewport) {
      return;
    }

    this.panController = new CanvasPanController({
      viewport,

      canStart: () => !this.activeNodeDrag && !this.activeConnection,
    });

    this.panController.connect();
  }

  private destroyPanController(): void {
    this.panController?.disconnect();
    this.panController = null;
  }

  private getWorkspaceElement(): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(".node-editor__workspace");
  }

  /**
   * Puts the open menu at its anchor, in the workspace's coordinates.
   *
   * The anchor is a point relative to the node layer's origin
   * (`openContextMenuAt`). The layer lies in the scrolling workspace but
   * outside the scaled layer, so the point is carried out by the zoom: the
   * origin plus the point, times the zoom. Scrolling needs nothing — the layer
   * scrolls with the canvas — so this runs only when that arithmetic changes:
   * when the menu is drawn, when the zoom changes, and when the workspace
   * grows or trims around the guide (`applyWorkspaceGeometry`). All three
   * are synchronous, so the menu is never a frame behind its button.
   */
  private positionMenu(x = this.connectionMenu?.x, y = this.connectionMenu?.y): void {
    const menu = this.root.querySelector<HTMLElement>(".node-editor__connection-menu");

    if (!menu || x === undefined || y === undefined) {
      return;
    }

    menu.style.left = `${(this.workspaceGeometry.originX + x) * this.zoom}px`;
    menu.style.top = `${(this.workspaceGeometry.originY + y) * this.zoom}px`;
  }

  private renderConnectionMenu(): void {
    const layer = this.root.querySelector<HTMLElement>(
      ".node-editor__connection-menu-layer",
    );

    if (!layer) {
      return;
    }

    if (!this.connectionMenu) {
      layer.replaceChildren();
      return;
    }

    const { kind, id, x, y } = this.connectionMenu;
    // The id comes from graph data (possibly imported and untrusted) and is put
    // into innerHTML below — escape it to close an XSS via a rigged id.
    const safeId = escapeHtml(id);
    const node =
      kind === "node"
        ? this.graphData.nodes.find((candidate) => candidate.id === id)
        : null;
    const startNodeAction =
      node !== null &&
      node !== undefined &&
      isGuideStepNode(node) &&
      // Fields inside a Page are not steps of their own and cannot be the start.
      !node.parentPageId &&
      node.id !== this.graphData.startNodeId
        ? `
          <button type="button" data-action="set-start-node" data-target-id="${safeId}">
            ${this.text("editor.canvas.setStartNode")}
          </button>
        `
        : "";
    const duplicateAction =
      kind === "node"
        ? `
          <button type="button" data-action="duplicate-node" data-target-id="${safeId}">
            ${this.text("editor.canvas.duplicate")}
          </button>
        `
        : "";

    /*
     * In and out of a page, without a pointer — story 034.
     *
     * Page membership used to change only in the drag's drop handler, which
     * closed the whole page half of the tool to keyboards and screen readers.
     * The menu is where every other node command already lives, so the move
     * is a choice by name here — one button per page — and the lift is one
     * button. Not for pages themselves, and only for types a page can hold.
     */
    const pages =
      kind === "node" ? this.graphData.nodes.filter((c) => c.type === "page") : [];
    const moveToPageActions =
      node && !node.parentPageId && node.type !== "page" && canNodeTypeBeInPage(node.type)
        ? pages
            .map(
              (page) => `
          <button type="button" data-action="move-to-page" data-target-id="${safeId}" data-page-id="${escapeHtml(page.id)}">
            ${escapeHtml(this.text("editor.canvas.moveToPage", { title: this.pageTitleFor(page) }))}
          </button>
        `,
            )
            .join("")
        : "";
    const removeFromPageAction = node?.parentPageId
      ? `
          <button type="button" data-action="remove-from-page" data-target-id="${safeId}">
            ${this.text("editor.canvas.removeFromPage")}
          </button>
        `
      : "";

    /*
     * "Which routes lead here?" — offered on every node that is part of the
     * flow, not only on results, and at every level.
     *
     * It was gated on the `routeAnalysis` capability at first, which put it out
     * of reach at Basic. That was the wrong line to draw: Basic has the Rule
     * node and branching questions, so a guide built there can already have more
     * ways to reach a refusal than anybody can hold in their head. Asking about
     * them is not an advanced feature — it is reading what you just built.
     *
     * Not on the start node: everything begins there, so the answer is the whole
     * guide and the question was not worth asking. Not on notes either — they
     * hang beside the flow rather than in it.
     */
    const routesAction =
      kind === "node" &&
      node &&
      node.id !== this.graphData.startNodeId &&
      node.type !== "annotation" &&
      !node.parentPageId
        ? `
          <button type="button" data-action="routes-here" data-target-id="${safeId}">
            ${this.text("editor.toolbar.routesHere")}
          </button>
        `
        : "";
    /*
     * Three states, by what the node knows about its provenance:
     *   no template            -> "Spara som mall"
     *   a template still there -> "Uppdatera mall"
     *   a template now gone    -> "Återskapa mall"
     *
     * The last is the rescue: the base type and the values are in the node, so
     * the template can be built again under the same key.
     */
    const templateAction = !node
      ? null
      : node.template
        ? templateLabel(node.template)
          ? "editor.canvas.updateTemplate"
          : "editor.canvas.recreateTemplate"
        : "editor.canvas.saveAsTemplate";

    const saveTemplateAction =
      this.canManageTemplatesValue &&
      node &&
      templateAction &&
      canBeTemplateBase(node.type) &&
      !node.parentPageId
        ? `
          <button type="button" data-action="save-as-template" data-target-id="${safeId}">
            ${this.text(templateAction)}
          </button>
        `
        : "";
    /*
     * Handing the field to somebody else.
     *
     * Beside "save as template" rather than inside it, because they answer
     * different questions: one keeps a field for yourself, the other gives it
     * away. The guide export already carries its templates, but sending a whole
     * guide to hand over one node is a detour nobody should have to take.
     */
    const exportTemplateAction =
      this.canManageTemplatesValue &&
      node &&
      canBeTemplateBase(node.type) &&
      !node.parentPageId
        ? `
          <button type="button" data-action="export-template" data-target-id="${safeId}">
            ${this.text("editor.canvas.exportTemplate")}
          </button>
        `
        : "";
    // Detaching the node from its template removes nothing: the tag carries only
    // the name. The node remains what it already is.
    const detachTemplateAction =
      this.canManageTemplatesValue && node?.template && !node.parentPageId
        ? `
          <button type="button" data-action="detach-template" data-target-id="${safeId}">
            ${this.text("editor.canvas.detachTemplate")}
          </button>
        `
        : "";

    const removeAction = `
      <button
        type="button"
        data-action="${kind === "connection" ? "remove-connection" : "remove-node"}"
        data-target-id="${safeId}"
      >
        ${kind === "connection" ? this.text("editor.canvas.removeConnection") : this.text("editor.canvas.removeNode")}
      </button>
    `;

    // A colour row for connections. Keys from the node palette, not free values
    // — every hue has a light and a dark value, so a guide coloured in light mode
    // stays readable in dark.
    const currentColor =
      kind === "connection"
        ? (this.graphData.connections.find((candidate) => candidate.id === id)
            ?.color ?? null)
        : null;

    const colorRow =
      kind === "connection"
        ? `
          <div
            class="node-editor__connection-colors"
            role="group"
            aria-label="${escapeHtml(this.text("editor.canvas.connectionColor"))}"
          >
            ${CONNECTION_COLOR_CHOICES.map((color) => {
              const chosen = currentColor === color;
              const name = this.text(
                `editor.canvas.color.${color ?? "default"}` as Parameters<
                  typeof this.text
                >[0],
              );

              return `
                <button
                  type="button"
                  class="node-editor__connection-color${chosen ? " node-editor__connection-color--selected" : ""}"
                  data-action="set-connection-color"
                  data-target-id="${safeId}"
                  data-color="${color ?? ""}"
                  title="${escapeHtml(name)}"
                  aria-label="${escapeHtml(name)}"
                  aria-pressed="${chosen}"
                ></button>`;
            }).join("")}
          </div>`
        : "";

    // Outside the scaled layer, so it is read at screen size without a
    // counter-scale — which was set only when the menu was drawn, and shrank
    // it (184 → 147 px) when the canvas was zoomed with the menu open.
    // `transform: none` keeps the place it had: the inline scale used to
    // override the stylesheet's `translateY(6px)`.
    layer.innerHTML = `
    <div
      class="node-editor__connection-menu"
      style="transform: none;"
    >
      ${colorRow}
      ${routesAction}
      ${startNodeAction}
      ${duplicateAction}
      ${moveToPageActions}
      ${removeFromPageAction}
      ${saveTemplateAction}
      ${exportTemplateAction}
      ${detachTemplateAction}
      ${removeAction}
    </div>
  `;

    this.positionMenu(x, y);

    layer.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const targetId = button.dataset.targetId;
        const action = button.dataset.action;

        if (!targetId || !action) {
          return;
        }

        this.closeConnectionMenu();

        if (action === "set-connection-color") {
          this.setConnectionColor(
            targetId,
            (button.dataset.color || null) as ConnectionColor | null,
          );
        } else if (action === "routes-here") {
          /*
           * The same MODE as Guide → Vägar hit, started on this node (one name,
           * one behaviour — 5/9). Until then this drew a one-shot highlight
           * that the next click put away, and the two entries had different
           * names and lifetimes.
           */
          this.dispatchEvent(
            new CustomEvent("routes-here-request", {
              detail: { nodeId: targetId },
              bubbles: true,
              composed: true,
            }),
          );
        } else if (action === "duplicate-node") {
          this.duplicateNodeById(targetId);
        } else if (action === "move-to-page") {
          this.moveNodeToPageById(targetId, button.dataset.pageId ?? "");
        } else if (action === "remove-from-page") {
          this.liftNodeFromPageById(targetId);
        } else if (action === "export-template") {
          this.dispatchEvent(
            new CustomEvent("export-node-template-intent", {
              detail: { nodeId: targetId },
              bubbles: true,
              composed: true,
            }),
          );
        } else if (action === "save-as-template") {
          this.dispatchEvent(
            new CustomEvent("save-as-node-template-intent", {
              detail: { nodeId: targetId },
              bubbles: true,
              composed: true,
            })
          );
        } else if (action === "detach-template") {
          this.updateNodeTemplate(targetId, null);
        } else if (action === "remove-connection") {
          this.removeConnection(targetId);
        } else if (action === "set-start-node") {
          this.dispatchEvent(
            new CustomEvent("start-node-change-intent", {
              detail: { nodeId: targetId },
              bubbles: true,
              composed: true,
            }),
          );
        } else if (targetId === this.graphData.startNodeId) {
          this.dispatchEvent(
            new CustomEvent("start-node-remove-intent", {
              detail: { nodeId: targetId },
              bubbles: true,
              composed: true,
            }),
          );
        } else {
          this.removeNodeById(targetId);
        }
      });
    });
  }

  /* -----------------------------------------------------------------------
   * Minimap
   *
   * Drawn in base coordinates, the same system `.node-editor__scaled` holds: a
   * node's left edge sits at `originX + position.x`. The zoom is deliberately
   * kept out — it affects only how much of the map fits in the viewport
   * rectangle, not where the nodes lie relative to one another.
   * -------------------------------------------------------------------- */

  /*
   * The largest box the map may take; the map itself takes the guide's own
   * proportions inside it. Kept at 168 × 132 on 29/9 against Astra's target
   * 170 × 110 (§3 allows it "om dessa mått försämrar orienteringen"):
   * measured on the claim example, a near-square guide, 110 in height shrank
   * the whole map from 139 × 132 to 116 × 110 — every node 17 % smaller —
   * and a wide guide never reaches 110 in height anyway, so the change could
   * only ever shrink maps. Pictures in the uppdrag's report.
   */
  private readonly minimapMaxWidth = 168;
  private readonly minimapMaxHeight = 132;

  /*
   * The air between the map's frame and the outermost dots, in the map's own
   * CSS pixels (Astra 29/9: "12 CSS-px inre luft … oberoende av grafens
   * skala"). It used to be 120 base pixels scaled down with the map, which
   * came out at ~6 px on the claim example and differently on every guide.
   */
  private readonly minimapPadding = 12;

  /**
   * The map's scale and crop. Null when the map is hidden. `x`/`y` is the
   * base-pixel point at the map's inner top-left corner — the air included —
   * so the dots, the viewport box and a click all share one origin.
   */
  private minimapView: {
    scale: number;
    x: number;
    y: number;
  } | null = null;

  private minimapDrag = false;

  private connectMinimap(): void {
    const viewport = this.getViewportElement();
    const minimap = this.getMinimapElement();

    if (!viewport || !minimap) {
      return;
    }

    // The elements are recreated on every `render()`, so the listeners go with
    // them and need no unregistering of their own.
    viewport.addEventListener(
      "scroll",
      () => {
        /*
         * Whether the map is wanted is a question about the *view*, so it is
         * asked on every scroll — not only when the canvas is redrawn.
         *
         * It used to be asked by `updateMinimap` alone, which runs on a buffer
         * step or a trim. Johan, 25/9 with a mouse: pan a small guide so a node
         * leaves the screen and the map stays hidden until some later growth
         * step; pan back and it disappears at another. Right rule, asked at the
         * wrong moments, so it read as random. Measured: two scrolls of 300 px
         * grew nothing and asked nothing.
         *
         * A change of answer needs the full redraw (the dots and the scale are
         * only built while the map shows); the same answer only moves the box.
         */
        if (this.wholeGuideOnScreen() === !minimap.hidden) {
          this.updateMinimap();
        } else {
          this.updateMinimapViewport();
        }
      },
      { passive: true },
    );

    minimap.addEventListener("pointerdown", (event: PointerEvent) => {
      this.minimapDrag = true;

      // Pan first. The capture below is a convenience — it lets the drag
      // continue when the pointer leaves the map — and must not be able to
      // prevent the navigation itself if it fails.
      this.panFromMinimap(event);
      event.preventDefault();

      try {
        minimap.setPointerCapture(event.pointerId);
      } catch {
        // No active pointer with that id. The drag still works as long as the
        // pointer stays over the map.
      }
    });

    minimap.addEventListener("pointermove", (event: PointerEvent) => {
      if (this.minimapDrag) {
        this.panFromMinimap(event);
      }
    });

    const drop = (event: PointerEvent): void => {
      this.minimapDrag = false;

      try {
        if (minimap.hasPointerCapture(event.pointerId)) {
          minimap.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Fångsten togs aldrig, eller är redan släppt.
      }
    };

    minimap.addEventListener("pointerup", drop);
    minimap.addEventListener("pointercancel", drop);
  }

  private getMinimapElement(): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(".node-editor__minimap");
  }

  /**
   * Wires the canvas's own toolbar to the exact same operations the keyboard
   * shortcuts and the Vy-menu already call — no second implementation of
   * zoom, fit or fullscreen.
   *
   * Recreated on every `render()`, like `connectMinimap()` beside it, so no
   * unregistering is needed here either.
   */
  private connectCanvasToolbar(): void {
    const toolbar = this.root.querySelector<HTMLElement>(
      "[data-canvas-toolbar]",
    );

    if (!toolbar) {
      return;
    }

    /*
     * A pointer click hands focus back to the canvas. The mouse left it on
     * the button, and the next thing anybody does after a zoom is hold Space
     * to pan — which on a focused button is another click, so the zoom moved
     * again and the focus ring lit up on + or − (Johan 23/9). A keyboard
     * activation (`detail` 0) keeps focus on the button, so + can be pressed
     * again. The fullscreen button too: with focus left on it, the Escape
     * that leaves fullscreen lit its ring (Johan 23/9, same round).
     */
    /*
     * Through `onPress`, not a plain click listener: Johan's iPad 28/9 night,
     * logged from the device — `pointerdown` and `pointerup` on plus and minus
     * every time, never a `click`, the zoom stuck at 100 %. The same thing the
     * way-back button was measured to 25/9 (`bindTheWayBack`), and the same
     * reserve route. The viewport takes focus after a pointer press, not after
     * a keyboard one, so the keyboard flow keeps its place.
     */
    const canvasAction = (button: HTMLButtonElement | null, act: () => void): void => {
      if (!button) return;
      onPress(button, (fromPointer) => {
        act();
        if (fromPointer) {
          this.getViewportElement()?.focus({ preventScroll: true });
        }
      });
    };

    canvasAction(toolbar.querySelector<HTMLButtonElement>('[data-action="canvas-zoom-out"]'), () => this.zoomOut());
    canvasAction(toolbar.querySelector<HTMLButtonElement>('[data-action="canvas-zoom-in"]'), () => this.zoomIn());
    canvasAction(toolbar.querySelector<HTMLButtonElement>('[data-action="canvas-fit"]'), () => this.fitToContent(true));

    /*
     * Fullscreen is guide-editor's to grant (it decides between the
     * platform's own and our "wide" mode, see guide-editor.ts) — the canvas
     * only asks, the same request editor-toolbar's button already sends.
     * Standalone in a test with no guide-editor around it, this simply has
     * no listener, exactly like editor-toolbar's own button would if it were
     * ever used the same way.
     */
    canvasAction(toolbar.querySelector<HTMLButtonElement>('[data-action="canvas-fullscreen"]'), () => {
      this.dispatchEvent(
        new CustomEvent("fullscreen-toggle-request", {
          bubbles: true,
          composed: true,
        }),
      );
    });
  
    this.bindCanvasToolbarTooltip(toolbar);
  }

  /**
   * The name of an icon button, shown while the pointer is over it or it has
   * keyboard focus (Astra §5) — the same behaviour as the answer cards'
   * tooltip in properties-panel.ts: shown on hover and focus, a 200 ms grace
   * on leaving so the pointer can cross the gap, hidden on blur and Escape
   * (the Escape taken, so fullscreen does not also close on it).
   *
   * One element for the whole bar, placed over the button it names and held
   * inside the bar's own width, so a long name over the last button never
   * reaches past the canvas edge the bar keeps its 16 px from.
   */
  private bindCanvasToolbarTooltip(toolbar: HTMLElement): void {
    const tooltip = toolbar.querySelector<HTMLElement>("[data-canvas-toolbar-tooltip]");

    if (!tooltip) return;

    let shownFor: HTMLButtonElement | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelHide = (): void => {
      clearTimeout(hideTimer);
      hideTimer = undefined;
    };
    const hide = (): void => {
      cancelHide();
      tooltip.hidden = true;
      shownFor = null;
    };
    const show = (button: HTMLButtonElement): void => {
      cancelHide();
      shownFor = button;
      tooltip.textContent = button.getAttribute("aria-label") ?? "";
      tooltip.hidden = false;
      const room = toolbar.clientWidth - tooltip.offsetWidth;
      const centre = button.offsetLeft + button.offsetWidth / 2 - tooltip.offsetWidth / 2;
      tooltip.style.left = `${Math.max(0, Math.min(room, centre))}px`;
    };
    const scheduleHide = (): void => {
      if (shownFor && this.root.activeElement === shownFor) return;
      cancelHide();
      hideTimer = setTimeout(hide, 200);
    };

    toolbar.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.addEventListener("pointerenter", () => show(button));
      button.addEventListener("pointerleave", scheduleHide);
      button.addEventListener("focus", () => {
        if (button.matches(":focus-visible")) show(button);
      });
      button.addEventListener("blur", hide);
    });
    tooltip.addEventListener("pointerenter", cancelHide);
    tooltip.addEventListener("pointerleave", scheduleHide);
    toolbar.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || tooltip.hidden) return;
      event.preventDefault();
      hide();
    });
    this.refreshCanvasToolbarTooltip = () => {
      if (shownFor) show(shownFor);
    };
  }

  /** Set by bindCanvasToolbarTooltip; renames a shown tooltip when a label changes. */
  private refreshCanvasToolbarTooltip: () => void = () => {};

  /** The zoom readout, in the room the percentage always has (tabular figures). */
  private updateCanvasToolbarZoom(): void {
    const readout = this.root.querySelector<HTMLElement>(
      "[data-canvas-toolbar-zoom]",
    );

    if (readout) {
      readout.textContent = `${Math.round(this.zoom * 100)} %`;
    }
  }

  /**
   * Shown whenever there is a graph to act on — hidden along with the empty
   * state, since zooming or fitting nothing has no meaning.
   */
  private updateCanvasToolbarVisibility(): void {
    const toolbar = this.root.querySelector<HTMLElement>(
      "[data-canvas-toolbar]",
    );

    if (toolbar) {
      toolbar.hidden = this.graphData.nodes.length === 0;
    }
  }

  /**
   * Mirrors `editor-toolbar`'s own `setFullscreen`, so the canvas's button
   * says the same thing as the menu's the moment guide-editor toggles either
   * route — the platform's fullscreen or ours.
   */
  setFullscreen(active: boolean): void {
    const button = this.root.querySelector<HTMLButtonElement>(
      "[data-canvas-toolbar-fullscreen]",
    );

    if (!button) {
      return;
    }

    button.setAttribute("aria-pressed", String(active));
    button.setAttribute(
      "aria-label",
      this.text(active ? "editor.toolbar.exitFullscreen" : "editor.toolbar.fullscreen"),
    );
    this.refreshCanvasToolbarTooltip();
  }

  /** Innehållets omslutande rektangel i baskoordinater, eller null om tomt. */
  /**
   * The nodes that stand on the workspace by themselves — not a page's
   * fields (fynd m, Johan's iPad 27/9). A field's position is relative to its
   * page, so read as the workspace's it put a mark at the origin, in an empty
   * corner of the map, and pulled the guide's bounds out to it. The field is
   * inside the page's block, which the map draws.
   */
  private minimapNodes(): FlowNodeData[] {
    return this.graphData.nodes.filter((node) => !node.parentPageId);
  }

  private measureContentBounds(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    this.minimapNodes().forEach((node) => {
      const element = this.findNodeElement(node.id);

      if (!element) {
        return;
      }

      const { x, y } = toWorkspacePoint(node.position, this.workspaceGeometry);

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      // `offsetWidth` is unaffected by the parents' transform, so the
      // measurements are in base pixels just like the positions.
      maxX = Math.max(maxX, x + element.offsetWidth);
      maxY = Math.max(maxY, y + element.offsetHeight);
    });

    if (!Number.isFinite(minX)) {
      return null;
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  /** Ritar om nodprickarna. Kallas när noder flyttas, skapas eller tas bort. */
  /**
   * Offers a way back when the guide has left the screen entirely.
   *
   * Panning past the guide is deliberate — it is how somebody makes room to
   * place a node — so it is not bounded. The cost is that a canvas can be panned
   * until nothing is on it, and then it looks broken rather than empty: measured
   * on a tablet, the guide sat a hundred pixels above the top of the view with a
   * blank canvas below it and no sign of which way to go.
   *
   * The minimap is already a way back, and it is a poor one under a finger: small,
   * passive and easy to read as decoration. This says the thing outright, and only
   * when it is true.
   */
  /**
   * The way back, reachable by a finger on a device that never sends the click.
   *
   * ## What was measured
   *
   * Five presses on an iPad, logged from the device: `pointerdown` and
   * `pointerup` arrived every time with `isTrusted` true, sixty to a hundred
   * milliseconds apart, the finger moving a handful of pixels — and **no click
   * at all**, five times out of five. Nothing here calls `preventDefault`, there
   * are no touch listeners anywhere in the editor, and the page carries a proper
   * `width=device-width`. The same button works with a mouse.
   *
   * ## The route that fixes it, and the one that does not
   *
   * A tap is accepted on `pointerup` directly — short, close to where it
   * started, and not a mouse, which is the definition of a tap. Whichever of
   * pointer and click arrives first wins and the other is ignored, so a browser
   * that sends both does not fit the view twice. **This is what works.**
   *
   * The stylesheet also says `touch-action: manipulation`, and the reasoning
   * behind that did not survive being checked. The node buttons work on the same
   * tablet and sit inside the viewport, which sets `touch-action: none`; this one
   * was outside it with `auto`, and WebKit holds a tap on an `auto` element while
   * it decides whether a double-tap-to-zoom has begun. Tidy — except a sweep of
   * everything pressable found the toolbar buttons are *also* outside the
   * viewport with `auto`, and they had been working all along. So `auto` outside
   * the viewport is not sufficient to cause this, and `manipulation` is kept
   * because it is right on a button laid over a canvas — it removes the
   * double-tap wait — not because it is the fix.
   *
   * Mouse pointers are left alone entirely: the click path works there, and
   * changing what already works to fix what does not is how a second fault gets
   * made.
   */
  private bindTheWayBack(): void {
    const button = this.root.querySelector<HTMLButtonElement>("[data-lost]");

    if (!button) {
      return;
    }

    const goBack = (): void => {
      this.stopGlide();

      /*
       * The nearest node, not the start node. Somebody who has panned out into
       * the empty part of the canvas wants the guide back from where they are
       * standing — jumping to the beginning of a long flow moves them further
       * than they went, and loses the place they were working in.
       *
       * Through `centerNodeById`, the same route the Guide menu's "Visa
       * startnod" takes, because that one demonstrably works on the tablet where
       * this button did nothing: it goes through `centerViewportAt`, which tells
       * the buffer where the view *wants* to be before assigning the scroll,
       * where the fit assigns first and asks afterwards.
       */
      const viewport = this.getViewportElement();
      const nodes = [...this.root.querySelectorAll<FlowNode>("flow-node")];

      if (viewport && nodes.length > 0) {
        const view = {
          x: (viewport.scrollLeft + viewport.clientWidth / 2) / this.zoom,
          y: (viewport.scrollTop + viewport.clientHeight / 2) / this.zoom,
        };
        const distance = (node: FlowNode): number =>
          Math.hypot(
            this.workspaceGeometry.originX + node.offsetLeft + node.offsetWidth / 2 - view.x,
            this.workspaceGeometry.originY + node.offsetTop + node.offsetHeight / 2 - view.y,
          );
        const nearest = nodes.reduce((best, node) =>
          distance(node) < distance(best) ? node : best,
        );

        if (nearest.nodeId) {
          // A ride back, like the run's step-to-step pan (Johan 1/10 2026).
          this.centerNodeById(nearest.nodeId, { smooth: true });
        }
      }

      this.updateLostState();
    };

    onPress(button, goBack);
  }

  /** One pending re-ask, so a hidden editor never spins on animation frames. */
  private lostRecheckQueued = false;

  private updateLostState(mayRecheck = true): void {
    const button = this.root.querySelector<HTMLButtonElement>("[data-lost]");
    const viewport = this.getViewportElement();

    if (!button || !viewport) {
      return;
    }

    const nodes = [...this.root.querySelectorAll<FlowNode>("flow-node")];
    const view = viewport.getBoundingClientRect();

    /*
     * An unmeasured guide is not lost — it is not measured yet. Before layout
     * (mid render, or in a hidden container) every rect is zero, "no node on
     * screen" comes out true, and the button parked itself over the middle of
     * a perfectly visible guide on a tablet — swallowing the finger that tried
     * to drag the node beneath it. Never *show* on that answer; re-ask once on
     * the next frame for the caller that was merely one frame early, and let
     * the next real trigger (scroll, pan, the health pass) settle the rest.
     */
    const laidOut =
      view.width > 0 &&
      nodes.some((node) => {
        const rect = node.getBoundingClientRect();

        return rect.width > 0 || rect.height > 0;
      });

    if (nodes.length > 0 && !laidOut) {
      button.hidden = true;

      // The re-ask itself may not re-ask — a hidden editor would spin forever.
      if (mayRecheck && !this.lostRecheckQueued) {
        this.lostRecheckQueued = true;
        requestAnimationFrame(() => {
          this.lostRecheckQueued = false;
          this.updateLostState(false);
        });
      }

      return;
    }

    /*
     * Lost means the view has left the guide — the hull around every node —
     * not that no node happens to be in it. Johan, 1/9: two nodes a long way
     * apart, the view panned into the gap between them, and the way back came
     * up in the middle of the guide. A gap is inside; the button is for the
     * outside, where the canvas looks broken rather than empty.
     */
    const hull = nodes.reduce(
      (box, node) => {
        const rect = node.getBoundingClientRect();

        return {
          left: Math.min(box.left, rect.left),
          top: Math.min(box.top, rect.top),
          right: Math.max(box.right, rect.right),
          bottom: Math.max(box.bottom, rect.bottom),
        };
      },
      { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
    const viewInsideHull =
      hull.right > view.left &&
      hull.left < view.right &&
      hull.bottom > view.top &&
      hull.top < view.bottom;

    // An empty guide has its own message, and two of them would be one too many.
    if (nodes.length === 0 || viewInsideHull) {
      button.hidden = true;

      return;
    }

    /*
     * Showing waits one frame, and is verified against settled geometry.
     *
     * Logged on the built English example page: the last caller ran while the
     * layout was still settling — the viewport measured as its old box while
     * the nodes had already moved to their final places outside it. "Lost" was
     * true for exactly one frame, the button showed over a perfectly visible
     * guide, and nothing ever asked again — swallowing the finger that tried
     * to drag the node beneath it. Hiding is always safe to do at once; only
     * showing needs the answer to still be true a frame later.
     */
    if (mayRecheck) {
      if (!this.lostRecheckQueued) {
        this.lostRecheckQueued = true;
        requestAnimationFrame(() => {
          this.lostRecheckQueued = false;
          this.updateLostState(false);
        });
      }

      return;
    }

    button.hidden = false;
  }

  private updateMinimap(): void {
    const minimap = this.getMinimapElement();
    const viewport = this.getViewportElement();
    const nodesLayer = minimap?.querySelector<HTMLElement>(
      ".node-editor__minimap-nodes",
    );

    if (!minimap || !viewport || !nodesLayer) {
      return;
    }

    const bounds = this.measureContentBounds();

    if (!bounds || this.wholeGuideOnScreen()) {
      minimap.hidden = true;
      this.minimapView = null;
      return;
    }

    // The scale fits the guide into the box less the air on both sides; the
    // map then takes the guide's proportions plus the same air all round.
    // Unrounded, so the air is 12 px on the far sides too.
    const pad = this.minimapPadding;
    const scale = Math.min(
      (this.minimapMaxWidth - pad * 2) / Math.max(1, bounds.width),
      (this.minimapMaxHeight - pad * 2) / Math.max(1, bounds.height),
    );
    const x = bounds.x - pad / scale;
    const y = bounds.y - pad / scale;

    this.minimapView = { scale, x, y };

    minimap.hidden = false;
    minimap.style.width = `${bounds.width * scale + pad * 2}px`;
    minimap.style.height = `${bounds.height * scale + pad * 2}px`;
    // The canvas toolbar stands 16 px to the left of the minimap (Uppdrag
    // 29/9, Del C) — the width is only known here, so the CSS reads it from
    // this property. On the parent, because the toolbar is a sibling and a
    // custom property only flows downwards — set on the minimap itself the
    // toolbar read the fallback and stood 6 px off. offsetWidth: the border
    // counts. The height is no longer needed: the bottom edges line up, and
    // stacked the map stands above the bar, whose height the CSS knows.
    minimap.parentElement?.style.setProperty("--minimap-width", `${minimap.offsetWidth}px`);

    // Each dot's box in the map's pixels, kept so the connection lines can
    // start and end on the very edges the dots are drawn with.
    const dots = new Map<string, { left: number; top: number; width: number; height: number }>();

    const prickar = this.minimapNodes()
      .map((node) => {
        const element = this.findNodeElement(node.id);

        if (!element) {
          return "";
        }

        const punkt = toWorkspacePoint(node.position, this.workspaceGeometry);
        const left = (punkt.x - x) * scale;
        const top = (punkt.y - y) * scale;
        const width = Math.max(2, element.offsetWidth * scale);
        const height = Math.max(2, element.offsetHeight * scale);

        dots.set(node.id, { left, top, width, height });

        const problem = this.nodeIssues.get(node.id);

        return `<i class="node-editor__minimap-node" data-node-type="${node.type}"${isEndingNodeType(node.type) ? " data-ending" : ""}${
          problem ? ` data-severity="${problem.severity}"` : ""
        } style="left:${left}px;top:${top}px;width:${width}px;height:${height}px"></i>`;
      })
      .join("");

    nodesLayer.innerHTML = prickar;

    /*
     * Story 142 (Astra 29/9): one line per connection, from the from-dot's
     * right edge to the to-dot's left edge, both at mid-height — the dots are
     * where the positions are, the lines are the flow. A connection with an
     * end that has no dot is not drawn: a lost connection is the health
     * check's to report, and a field inside a page has no dot of its own.
     * The canvas's own curve, with its minimum bend scaled to the map, so a
     * branch reads the same small as it does full size.
     *
     * A connection backwards — the to-dot's left edge left of the from-dot's
     * right edge, which is what a line break makes — is a straight line
     * instead (Astra 29/9, variant B). The canvas's S-loop swings out past
     * both dots, and in the map that swing went into the 12 px of air and
     * stood 0.3 px from the frame. The map shows which nodes hang together,
     * not the canvas's curves; a straight line between the two dots can never
     * leave the box the dots span, so the air holds by construction.
     */
    const links = minimap.querySelector<SVGSVGElement>(".node-editor__minimap-links");

    if (links) {
      links.innerHTML = this.graphData.connections
        .map((connection) => {
          const from = dots.get(connection.from.nodeId);
          const to = dots.get(connection.to.nodeId);

          if (!from || !to) {
            return "";
          }

          const start = { x: from.left + from.width, y: from.top + from.height / 2 };
          const end = { x: to.left, y: to.top + to.height / 2 };
          const d =
            end.x < start.x
              ? `M ${start.x} ${start.y} L ${end.x} ${end.y}`
              : this.createCurve(start, end, 90 * scale);

          return `<path d="${d}"></path>`;
        })
        .join("");
    }

    this.updateMinimapViewport();
  }

  /**
   * The map shows unless the guide is *actually on screen* — true also for an
   * empty guide, which has nothing to navigate.
   *
   * The rule used to ask whether the content would fit — `width * zoom <=
   * clientWidth` — which is a different question, and the difference is where
   * somebody gets stranded. Zoom out far enough and everything would fit, so
   * the map hid itself; but if the view had been panned away from the guide
   * the screen was blank, with the one thing that could have found it now
   * gone. Reported exactly that way: zoom back in until the map returns, press
   * it, and the nodes come back.
   *
   * The intent in the old comment was right and is kept — a guide you can see
   * in its entirety has nothing to navigate. It is the test that was wrong.
   */
  private wholeGuideOnScreen(): boolean {
    const viewport = this.getViewportElement();
    const bounds = this.measureContentBounds();

    if (!viewport || !bounds) {
      return true;
    }

    const view = {
      left: viewport.scrollLeft / this.zoom,
      top: viewport.scrollTop / this.zoom,
      right: (viewport.scrollLeft + viewport.clientWidth) / this.zoom,
      bottom: (viewport.scrollTop + viewport.clientHeight) / this.zoom,
    };

    return (
      bounds.x >= view.left &&
      bounds.y >= view.top &&
      bounds.x + bounds.width <= view.right &&
      bounds.y + bounds.height <= view.bottom
    );
  }

  /** Flyttar bara rutan som visar vad man ser. Kallas vid varje scroll. */
  private updateMinimapViewport(): void {
    const minimap = this.getMinimapElement();
    const viewport = this.getViewportElement();
    const rutan = minimap?.querySelector<HTMLElement>(
      ".node-editor__minimap-viewport",
    );
    const view = this.minimapView;

    if (!minimap || !viewport || !rutan || !view || minimap.hidden) {
      return;
    }

    // Scrollvärdena är i sizerns pixlar, alltså baspixlar × zoom.
    const left = (viewport.scrollLeft / this.zoom - view.x) * view.scale;
    const top = (viewport.scrollTop / this.zoom - view.y) * view.scale;

    rutan.style.left = `${left}px`;
    rutan.style.top = `${top}px`;
    rutan.style.width = `${(viewport.clientWidth / this.zoom) * view.scale}px`;
    rutan.style.height = `${(viewport.clientHeight / this.zoom) * view.scale}px`;
  }

  /** Centrerar vyn på den punkt i kartan pekaren pekar på. */
  private panFromMinimap(event: PointerEvent): void {
    const minimap = this.getMinimapElement();
    const viewport = this.getViewportElement();
    const view = this.minimapView;

    if (!minimap || !viewport || !view) {
      return;
    }

    // From the inside of the border, where the dots' `left: 0` is. Measured
    // from the outside edge, a click on a dot landed 1 px / scale off — 17
    // base pixels on the claim example.
    const rect = minimap.getBoundingClientRect();
    const baseX = view.x + (event.clientX - rect.left - minimap.clientLeft) / view.scale;
    const baseY = view.y + (event.clientY - rect.top - minimap.clientTop) / view.scale;

    viewport.scrollLeft = baseX * this.zoom - viewport.clientWidth / 2;
    viewport.scrollTop = baseY * this.zoom - viewport.clientHeight / 2;
  }

  private getViewportElement(): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(".node-editor__viewport");
  }


  /**
   * How much of the view a host's panel covers at each side, in px (story
   * 145): read from the insets `<guide-editor>` sets for the canvas's own
   * controls, so there is one measurement for both. Zero without a host.
   *
   * The view itself keeps its width when a panel opens — nothing moves — but
   * whatever the editor places *on purpose* (the whole flow, the start node, a
   * new node) goes where it can be seen, not under the panel.
   */
  private coveredSides(): { left: number; right: number } {
    const style = getComputedStyle(this);
    const read = (name: string): number => Number.parseFloat(style.getPropertyValue(name)) || 0;

    return { left: read("--fw-canvas-left-inset"), right: read("--fw-canvas-right-inset") };
  }

  getSuggestedNodePosition(options: { leftInset?: number } = {}): Point {
    const viewport = this.getViewportElement();

    if (!viewport) {
      return { x: 80, y: 80 };
    }

    const covered = this.coveredSides();
    const leftInset = (options.leftInset ?? 0) + covered.left;

    return {
      x: Math.round(
        (viewport.scrollLeft +
          (viewport.clientWidth + leftInset - covered.right) / 2) /
          this.zoom -
          this.workspaceGeometry.originX -
          120,
      ),
      y: Math.round(
        (viewport.scrollTop + viewport.clientHeight / 2) / this.zoom -
          this.workspaceGeometry.originY -
          80,
      ),
    };
  }

  getViewportCenter(): ViewportCenter {
    const viewport = this.getViewportElement();

    if (!viewport) {
      return { x: 0, y: 0 };
    }

    // Use the last stable size: mid layout change (when leaving full screen,
    // say) clientWidth may already have changed while the scroll position still
    // belongs to the old size.
    const width = this.lastViewportSize?.width || viewport.clientWidth;
    const height = this.lastViewportSize?.height || viewport.clientHeight;

    // Scroll is in scaled px; divide by zoom before subtracting the origin.
    return {
      x: (viewport.scrollLeft + width / 2) / this.zoom - this.workspaceGeometry.originX,
      y: (viewport.scrollTop + height / 2) / this.zoom - this.workspaceGeometry.originY,
    };
  }

  /**
   * Centres on the point and holds it through subsequent layout changes (when
   * full screen is toggled and the size changes in several steps, say), so the
   * view does not land in an empty area.
   */
  restoreViewportCenter(center: ViewportCenter): void {
    this.centerViewportAt(center);
    this.pendingCenterRestore = { ...center };

    window.clearTimeout(this.centerRestoreTimeout);
    this.centerRestoreTimeout = window.setTimeout(() => {
      this.pendingCenterRestore = null;
    }, 600);
  }

  centerViewportAt(center: ViewportCenter, { smooth = false }: CenterOptions = {}): void {
    const viewport = this.getViewportElement();

    if (!viewport) {
      return;
    }

    // En uttrycklig centrering ersätter en väntande återställning — och den
    // initiala centrering som `graph =` schemalade för nästa bildruta. Mätt
    // 3/9: snabbstarten zoomade och centrerade på sidan synkront, och en ruta
    // senare stod vyn på stommens mitt igen (scrollLeft 583 → 1085).
    this.pendingCenterRestore = null;
    this.viewportPositionRequest += 1;

    const scrollFor = (axis: "x" | "y"): number => {
      const origin =
        axis === "x"
          ? this.workspaceGeometry.originX
          : this.workspaceGeometry.originY;
      const clientSize =
        axis === "x" ? viewport.clientWidth : viewport.clientHeight;
      // Canvas-koordinat → skalade px, sedan halva vyn för centrering.
      return (origin + center[axis]) * this.zoom - clientSize / 2;
    };

    /*
     * The buffer is told where the view wants to be, not where it landed.
     *
     * Going full screen on a wide screen asks for a scroll far to the left of
     * the workspace — the centre was captured in a narrow panel and the new
     * viewport is several times wider, so the arithmetic wants a negative
     * offset. Assigning it clamps to zero, and a buffer reading that zero saw
     * a view sitting politely at the left edge rather than one straining past
     * it. It grew one step, the request needed several, and the workspace ended
     * flush with the left of the screen: nothing to the left to drop a node
     * into, and the guide pushed to the right of a very wide screen.
     *
     * The second toggle worked because by then the workspace had grown enough
     * that the same centre was reachable.
     */
    this.ensureWorkspaceBuffer(true, { left: scrollFor("x"), top: scrollFor("y") });

    /*
     * A ride, not a cut, when the caller asks for one — the run's step-to-step
     * pan (Johan 1/10 2026, after seeing the promo's jumps: "så borde det
     * fungera i produkten också, mjuk övergång … på åkningen mellan noderna").
     * Only this deliberate centring glides. The workspace's own compensations
     * when it grows or trims (`scrollLeft = previous + grow`) stay instant on
     * purpose: they exist so that nothing visibly moves, and animating them
     * would turn an invisible correction into a drift. K5: with
     * `prefers-reduced-motion` the ride is a cut again.
     */
    const left = scrollFor("x");
    const top = scrollFor("y");

    if (smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      viewport.scrollTo({ left, top, behavior: "smooth" });
    } else {
      viewport.scrollLeft = left;
      viewport.scrollTop = top;
    }
    this.lastViewportSize = {
      width: viewport.clientWidth,
      height: viewport.clientHeight,
    };
  }

  getZoom(): number {
    return this.zoom;
  }

  /**
   * Sets the zoom level and keeps the point under the pivot (in client
   * coordinates) still. Without a pivot the view's centre is used. The
   * invariant: a canvas point under the pivot before the zoom remains under it
   * afterwards.
   */
  /**
   * @param anchor A workspace point to place under the pivot. Without it the
   * point *currently* under the pivot stays there, which is what a wheel or a
   * zoom key wants. A pinch passes the point it grabbed at the start of the
   * gesture, so the canvas follows the fingers rather than the frame before —
   * translation and scale out of one transform, as a two-point similarity
   * transform does.
   */
  setZoom(
    nextZoom: number,
    pivotClientX?: number,
    pivotClientY?: number,
    anchor?: Point,
  ): void {
    const viewport = this.getViewportElement();
    if (!viewport) {
      return;
    }

    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
    if (clamped === this.zoom && !anchor) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const pivotX = pivotClientX ?? rect.left + viewport.clientWidth / 2;
    const pivotY = pivotClientY ?? rect.top + viewport.clientHeight / 2;

    // Canvaspunkten (i bas-px från arbetsytans vänsterkant) under pivoten.
    const baseX = anchor?.x ?? (pivotX - rect.left + viewport.scrollLeft) / this.zoom;
    const baseY = anchor?.y ?? (pivotY - rect.top + viewport.scrollTop) / this.zoom;

    this.zoom = clamped;

    // Målscrollen (skalade px) som håller punkten under pivoten still.
    let targetLeft = baseX * clamped - (pivotX - rect.left);
    let targetTop = baseY * clamped - (pivotY - rect.top);

    // If the target lands outside [0, maxScroll] the browser would clamp and the
    // pivot would drift (zooming out near the canvas's top-left corner, say).
    // Grow the workspace where needed so the target becomes reachable. The low
    // side moves the origin (and the content) inwards; the high side merely
    // widens the area.
    const geometry = { ...this.workspaceGeometry };
    const growLowLeft = targetLeft < 0 ? Math.ceil(-targetLeft / clamped) : 0;
    const growLowTop = targetTop < 0 ? Math.ceil(-targetTop / clamped) : 0;
    geometry.width += growLowLeft;
    geometry.height += growLowTop;
    geometry.originX += growLowLeft;
    geometry.originY += growLowTop;
    targetLeft += growLowLeft * clamped;
    targetTop += growLowTop * clamped;

    const maxLeft = geometry.width * clamped - viewport.clientWidth;
    const maxTop = geometry.height * clamped - viewport.clientHeight;
    if (targetLeft > maxLeft) {
      geometry.width += Math.ceil((targetLeft - maxLeft) / clamped);
    }
    if (targetTop > maxTop) {
      geometry.height += Math.ceil((targetTop - maxTop) / clamped);
    }

    this.workspaceGeometry = geometry;
    this.applyWorkspaceGeometry();

    viewport.scrollLeft = targetLeft;
    viewport.scrollTop = targetTop;
    this.ensureWorkspaceBuffer();

    /*
     * One redraw per frame, not one per event.
     *
     * Measured on a graph of thirty nodes: a pinch step cost 3.8 ms and a single
     * `drawConnections` 4.2 ms — the redraw *is* the cost, and that was on a
     * desktop. A tablet sits several times higher, well past the 16.7 ms a frame
     * has, which is what "not as smooth as native" was made of.
     *
     * The paths live inside the scaled layer, so the transform already shows the
     * new size; the redraw only has to catch up with the geometry, and once per
     * frame is as often as anything can be seen.
     */
    this.scheduleDrawConnections();

    this.scheduleTrim();
    // The menu is outside the scaled layer: it follows the zoom by being placed again.
    this.positionMenu();

    this.dispatchEvent(
      new CustomEvent<number>("zoom-changed", {
        detail: this.zoom,
        bubbles: true,
        composed: true,
      }),
    );
  }

  zoomIn(pivotClientX?: number, pivotClientY?: number): void {
    this.setZoom(this.steppedZoom(1), pivotClientX, pivotClientY);
  }

  zoomOut(pivotClientX?: number, pivotClientY?: number): void {
    this.setZoom(this.steppedZoom(-1), pivotClientX, pivotClientY);
  }

  /**
   * One zoom step, and a step that would cross 100 % stops there.
   *
   * "Visa hela flödet" lands on whatever fits — 54 % on Johan's guide — and
   * from there 54 · 1.1ⁿ never equals 100: every + and − jumped straight over
   * it, and there was no way back to exactly 100 % (Johan 23/9). A pinch is
   * continuous and does not go through here.
   */
  private steppedZoom(direction: 1 | -1): number {
    const next = direction > 0 ? this.zoom * ZOOM_STEP : this.zoom / ZOOM_STEP;
    return (this.zoom - 1) * (next - 1) < 0 ? 1 : next;
  }

  resetZoom(): void {
    this.setZoom(1);
  }

  /** Puts the keyboard on a node, wherever the editor needs it to land. */
  focusNodeById(nodeId: string): boolean {
    const node = this.findNodeElement(nodeId);

    if (!node) {
      return false;
    }

    this.makeCurrent(node);
    node.focus();
    return true;
  }

  centerNodeById(nodeId: string, options: CenterOptions = {}): boolean {
    const node = this.findNodeElement(nodeId);

    if (!node) {
      return false;
    }

    this.centerViewportAt({
      x: node.offsetLeft + node.offsetWidth / 2,
      y: node.offsetTop + node.offsetHeight / 2,
    }, options);

    return true;
  }

  private scheduleInitialViewportPosition(): void {
    const request = ++this.viewportPositionRequest;

    requestAnimationFrame(() => {
      if (request !== this.viewportPositionRequest || !this.isConnected) {
        return;
      }

      this.centerInitialViewport();
    });
  }

  /**
   * Puts the start node in view, top-left with air, without touching the zoom.
   *
   * Used to be `fitToContent()` — centring the *whole graph's* bounding box.
   * Right for "Visa hela flödet", wrong for opening a guide: a graph wider than
   * the viewport puts that centre nowhere near the start, and the person arrives
   * looking at empty canvas. Measured on `examples/editor-advanced.html` at
   * 1440×900: bounding-box centring left the start node at x −1247 relative to
   * the viewport — fully off screen to the left — with 2 of 11 nodes on screen.
   *
   * Falls back to `fitToContent()` when there is no start node to find (an
   * empty graph, or a `startNodeId` with nothing rendered for it), which is the
   * one case this has nothing better to offer.
   */
  private centerInitialViewport(): void {
    if (this.revealStartNode()) {
      return;
    }

    this.fitToContent();
  }

  private revealStartNode(): boolean {
    const startNodeId = this.graphData.startNodeId;
    const startNode = startNodeId ? this.findNodeElement(startNodeId) : null;
    const viewport = this.getViewportElement();

    if (!startNode || !viewport) {
      return false;
    }

    this.stopGlide();

    // The visible edge, not the view's: an open panel at the start side
    // would otherwise cover the start node (story 145).
    const leftEdge = startNode.offsetLeft - this.contentPadding - this.coveredSides().left / this.zoom;
    const topEdge = startNode.offsetTop - this.contentPadding;

    // `centerViewportAt` centres a point; adding half the visible canvas back
    // turns that into "this edge, with padding, at the viewport's own edge"
    // instead — the same trick in reverse of how it derives a scroll offset
    // from a centre.
    this.centerViewportAt({
      x: leftEdge + viewport.clientWidth / 2 / this.zoom,
      y: topEdge + viewport.clientHeight / 2 / this.zoom,
    });
    this.drawConnections();

    return true;
  }

  /**
   * Centres the view on the graph's content (its bounding box). Used by "Visa
   * hela flödet" and by the way back for an editor who has "lost" the graph.
   * Returns false when the graph is empty, so the caller can give feedback.
   * With `adjustZoom` the zoom is adjusted too so the whole content fits
   * (though never zoomed in past 100%); without it, the zoom level is left
   * alone.
   */
  fitToContent(adjustZoom = false): boolean {
    const viewport = this.getViewportElement();
    const workspace = this.getWorkspaceElement();

    if (!viewport || !workspace) {
      return false;
    }

    /*
     * The momentum first, or it undoes this within half a second.
     *
     * Reported as "the back button does not work", and measured to be exactly
     * that: directly after the press all seven nodes were on screen, six hundred
     * milliseconds later none of them were. A flick leaves a glide running, and
     * the way back sits *outside* the viewport — deliberately, so a finger
     * reaching for it cannot pan the canvas instead — which means the press
     * never reaches `handlePanDown`, the only place that stopped the glide.
     *
     * So the guide came back, was dragged straight off again by momentum nobody
     * could see the source of, and the button looked broken. It belongs here
     * rather than on the button: anything that re-centres the view on purpose is
     * making a statement about where the view should be, and a leftover flick
     * has no business arguing with it.
     */
    this.stopGlide();
    this.ensureWorkspaceBuffer(false);

    const renderedNodes = Array.from(
      this.root.querySelectorAll<FlowNode>("flow-node"),
    );
    let centerX = this.workspaceGeometry.originX;
    let centerY = this.workspaceGeometry.originY;

    if (renderedNodes.length > 0) {
      const left = Math.min(...renderedNodes.map((node) => node.offsetLeft));
      const top = Math.min(...renderedNodes.map((node) => node.offsetTop));
      const right = Math.max(
        ...renderedNodes.map((node) => node.offsetLeft + node.offsetWidth),
      );
      const bottom = Math.max(
        ...renderedNodes.map((node) => node.offsetTop + node.offsetHeight),
      );

      centerX += (left + right) / 2;
      centerY += (top + bottom) / 2;

      if (adjustZoom) {
        const padding = this.contentPadding;
        const covered = this.coveredSides();
        const fit = Math.min(
          // The visible width: an open side panel covers part of the view
          // (story 145), and the whole flow should be seen, not tucked under it.
          (viewport.clientWidth - covered.left - covered.right) / (right - left + padding * 2),
          viewport.clientHeight / (bottom - top + padding * 2),
          1, // zooma aldrig in förbi 100 % bara för att grafen är liten
        );
        const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, fit));
        if (nextZoom !== this.zoom) {
          this.zoom = nextZoom;
          this.applyWorkspaceGeometry();
          this.dispatchEvent(
            new CustomEvent<number>("zoom-changed", {
              detail: this.zoom,
              bubbles: true,
              composed: true,
            }),
          );
        }
      }
    }

    /*
     * Through `centerViewportAt`, so the buffer is told where the view wants to
     * be before the scroll is assigned rather than after.
     *
     * Assigning first is the fault that made the way back look dead: a target
     * left of or above the workspace clamps to zero, the buffer then reads that
     * zero as a view sitting politely at the edge, grows one step and
     * compensates the scroll by exactly that step — leaving the view where it
     * began. `centerViewportAt` has carried the fix since the full-screen work;
     * this path simply never got it.
     *
     * The centre is passed in workspace coordinates without the origin, because
     * that is what `centerViewportAt` adds back itself.
     */
    /*
     * The centre of what can be seen, which is the view's centre moved by half
     * the difference between what the panels cover at each side.
     */
    const covered = this.coveredSides();

    this.centerViewportAt({
      x: centerX - this.workspaceGeometry.originX + (covered.right - covered.left) / 2 / this.zoom,
      y: centerY - this.workspaceGeometry.originY,
    });
    this.drawConnections();

    return renderedNodes.length > 0;
  }

  private getScaledLayer(): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(".node-editor__scaled");
  }

  private applyWorkspaceGeometry(): void {
    const workspace = this.getWorkspaceElement();
    const scaled = this.getScaledLayer();
    const nodesLayer = this.root.querySelector<HTMLElement>(
      ".node-editor__nodes",
    );

    if (!workspace || !scaled || !nodesLayer) {
      return;
    }

    // The sizer gets the base measurements times zoom so the scroll area is
    // right, while the scaled layer holds the base measurements and is scaled
    // visually with a transform.
    workspace.style.width = `${this.workspaceGeometry.width * this.zoom}px`;
    workspace.style.height = `${this.workspaceGeometry.height * this.zoom}px`;
    scaled.style.width = `${this.workspaceGeometry.width}px`;
    scaled.style.height = `${this.workspaceGeometry.height}px`;
    scaled.style.transform = `scale(${this.zoom})`;
    nodesLayer.style.left = `${this.workspaceGeometry.originX}px`;
    nodesLayer.style.top = `${this.workspaceGeometry.originY}px`;
    // An open menu is placed by origin and zoom, which may just have changed.
    this.positionMenu();

    // Zoom and the workspace size change both what fits and how large the
    // viewport rectangle should be.
    this.updateMinimap();
    this.updateCanvasToolbarZoom();
  }

  /**
   * Grows the workspace so the view has room around it.
   *
   * `wanted` is where the view is *trying* to be, in scaled px, when that is
   * not where it has managed to get. Scroll offsets clamp: ask for -2000 and
   * the element reports 0, and a buffer computed from that 0 concludes that a
   * single step is plenty while the request wanted thousands. Passing the
   * unclamped intent is what lets this grow by what was actually asked for.
   */
  private ensureWorkspaceBuffer(
    includeViewport = true,
    wanted?: { left: number; top: number }
  ): void {
    const viewport = this.getViewportElement();

    if (!viewport || this.expandingWorkspace) {
      return;
    }

    // The geometry is in base px but the scroll in scaled px — convert scroll
    // and view size to base so the comparisons against the buffer hold at zoom.
    const scrollBaseLeft = (wanted ? wanted.left : viewport.scrollLeft) / this.zoom;
    const scrollBaseTop = (wanted ? wanted.top : viewport.scrollTop) / this.zoom;
    const viewBaseWidth = viewport.clientWidth / this.zoom;
    const viewBaseHeight = viewport.clientHeight / this.zoom;

    /*
     * Enough to cover the shortfall, not one step of it.
     *
     * A flat `workspaceGrowth` is right when somebody *scrolls* to an edge:
     * the shortfall is at most the buffer, and one step is plenty. It is wrong
     * when the viewport **jumps**. Going full screen turns a 405px panel into a
     * 3184px canvas in one event, and one 800px step per side left the
     * workspace three hundred pixels short of the right-hand edge — no room to
     * drop a node, on a screen that plainly had room.
     *
     * The nodes' branch below has always computed the shortfall. This is the
     * same arithmetic for the other thing that can suddenly need room.
     *
     * **What this does not do** is fix the reported "cannot move the nodes to
     * the left after the first full screen". Measured either way, a node drags
     * 900px left and back on the first toggle. This closes a hole the code's
     * own rule says should not exist; the report is still open.
     */
    const steps = (shortfall: number): number =>
      shortfall > 0
        ? Math.ceil(shortfall / this.workspaceGrowth) * this.workspaceGrowth
        : 0;

    let growLeft = includeViewport
      ? steps(this.workspaceBuffer - scrollBaseLeft)
      : 0;
    let growTop = includeViewport
      ? steps(this.workspaceBuffer - scrollBaseTop)
      : 0;
    let growRight = includeViewport
      ? steps(
          this.workspaceBuffer -
            (this.workspaceGeometry.width - (scrollBaseLeft + viewBaseWidth))
        )
      : 0;
    let growBottom = includeViewport
      ? steps(
          this.workspaceBuffer -
            (this.workspaceGeometry.height - (scrollBaseTop + viewBaseHeight))
        )
      : 0;

    this.root.querySelectorAll<FlowNode>("flow-node").forEach((node) => {
      const left = this.workspaceGeometry.originX + node.offsetLeft;
      const top = this.workspaceGeometry.originY + node.offsetTop;
      const right = left + node.offsetWidth;
      const bottom = top + node.offsetHeight;

      if (left < this.workspaceBuffer) {
        growLeft = Math.max(
          growLeft,
          Math.ceil((this.workspaceBuffer - left) / this.workspaceGrowth) *
            this.workspaceGrowth,
        );
      }
      if (top < this.workspaceBuffer) {
        growTop = Math.max(
          growTop,
          Math.ceil((this.workspaceBuffer - top) / this.workspaceGrowth) *
            this.workspaceGrowth,
        );
      }
      if (right > this.workspaceGeometry.width - this.workspaceBuffer) {
        growRight = Math.max(
          growRight,
          Math.ceil(
            (right - (this.workspaceGeometry.width - this.workspaceBuffer)) /
              this.workspaceGrowth,
          ) * this.workspaceGrowth,
        );
      }
      if (bottom > this.workspaceGeometry.height - this.workspaceBuffer) {
        growBottom = Math.max(
          growBottom,
          Math.ceil(
            (bottom - (this.workspaceGeometry.height - this.workspaceBuffer)) /
              this.workspaceGrowth,
          ) * this.workspaceGrowth,
        );
      }
    });

    if (growLeft + growTop + growRight + growBottom === 0) {
      return;
    }

    this.expandingWorkspace = true;
    const previousScrollLeft = viewport.scrollLeft;
    const previousScrollTop = viewport.scrollTop;

    this.workspaceGeometry = {
      width: this.workspaceGeometry.width + growLeft + growRight,
      height: this.workspaceGeometry.height + growTop + growBottom,
      originX: this.workspaceGeometry.originX + growLeft,
      originY: this.workspaceGeometry.originY + growTop,
    };
    this.applyWorkspaceGeometry();
    // growLeft/Top are in base px; the scroll is in scaled px.
    viewport.scrollLeft = previousScrollLeft + growLeft * this.zoom;
    viewport.scrollTop = previousScrollTop + growTop * this.zoom;
    this.expandingWorkspace = false;
    this.drawConnections();

    // Whatever the buffer just added may be spare again once the view moves
    // back towards the guide. Growth and trim are the same knob, turned by the
    // same rule, so they cannot fight: a fresh growth leaves exactly the buffer
    // as slack, and the trim only takes whole steps *beyond* the buffer.
    this.scheduleTrim();
  }

  /**
   * Gives back the room the canvas stopped needing.
   *
   * `ensureWorkspaceBuffer` only ever grows, and nothing here ever shrank: the
   * geometry starts at 2000×1400 and every zoom-out or pan towards an edge adds
   * an 800px step that stays for the session. Measured on a tablet after a few
   * minutes' work: 4400×3000 with the origin at 2600,1500, and on another run
   * 5200×4600.
   *
   * The view never jumps when it grows — the scroll is compensated — so this was
   * not a jump. It is that the world keeps getting bigger while the guide does
   * not, until there is far more empty space to get lost in than canvas worth
   * looking at, and the minimap is the only way back. Which is exactly how it
   * was reported.
   *
   * Only shrinks by whole growth steps, and only when a whole step is spare.
   * Trimming to the exact minimum would put the edge right where the buffer
   * wants room, and the next pan would grow it straight back — a canvas that
   * breathes on every gesture is worse than one that is slightly too big.
   */
  private trimTimer: number | null = null;

  /**
   * Trims once things have settled, never during a gesture.
   *
   * Shrinking the canvas mid-pinch would move the content under the fingers
   * doing the pinching. A quarter of a second after the last change is late
   * enough that nobody is still moving and early enough that nobody has panned
   * out into the space that is about to be reclaimed.
   */
  private scheduleTrim(): void {
    if (this.trimTimer !== null) {
      clearTimeout(this.trimTimer);
    }

    this.trimTimer = window.setTimeout(() => {
      this.trimTimer = null;
      this.trimWorkspace();
    }, 250);
  }

  private trimWorkspace(): void {
    const viewport = this.getViewportElement();

    if (!viewport || this.expandingWorkspace) {
      return;
    }

    /*
     * Not while a menu is open. It is anchored in the workspace's coordinates,
     * so trimming moves the world out from under it — and the menu had already
     * been scrolled into view by then, which is how it ended up 1809px outside a
     * 218px-wide canvas in the test that caught this.
     */
    if (this.connectionMenu) {
      return;
    }

    const nodes = [...this.root.querySelectorAll<FlowNode>("flow-node")];

    if (nodes.length === 0) {
      return;
    }

    const geometry = this.workspaceGeometry;
    const view = {
      left: viewport.scrollLeft / this.zoom,
      top: viewport.scrollTop / this.zoom,
      right: (viewport.scrollLeft + viewport.clientWidth) / this.zoom,
      bottom: (viewport.scrollTop + viewport.clientHeight) / this.zoom,
    };

    /*
     * What has to stay reachable: every node, and wherever the view is now.
     * Trimming past the view would yank the canvas out from under somebody who
     * has scrolled out into the open on purpose.
     */
    let left = view.left;
    let top = view.top;
    let right = view.right;
    let bottom = view.bottom;

    nodes.forEach((node) => {
      left = Math.min(left, geometry.originX + node.offsetLeft);
      top = Math.min(top, geometry.originY + node.offsetTop);
      right = Math.max(right, geometry.originX + node.offsetLeft + node.offsetWidth);
      bottom = Math.max(bottom, geometry.originY + node.offsetTop + node.offsetHeight);
    });

    const step = this.workspaceGrowth;
    const spare = (slack: number): number =>
      Math.max(0, Math.floor((slack - this.workspaceBuffer) / step) * step);

    const trimLeft = spare(left);
    const trimTop = spare(top);
    const trimRight = spare(geometry.width - right);
    const trimBottom = spare(geometry.height - bottom);

    if (!trimLeft && !trimTop && !trimRight && !trimBottom) {
      return;
    }

    this.expandingWorkspace = true;

    const previousLeft = viewport.scrollLeft;
    const previousTop = viewport.scrollTop;

    this.workspaceGeometry = {
      width: geometry.width - trimLeft - trimRight,
      height: geometry.height - trimTop - trimBottom,
      originX: geometry.originX - trimLeft,
      originY: geometry.originY - trimTop,
    };
    this.applyWorkspaceGeometry();

    // The mirror of the growth path: the content moved by the trim, so the
    // scroll moves with it and the view stays where it was.
    viewport.scrollLeft = previousLeft - trimLeft * this.zoom;
    viewport.scrollTop = previousTop - trimTop * this.zoom;
    this.expandingWorkspace = false;
    this.scheduleDrawConnections();
  }

  /**
   * Creates a node from the palette under the pointer and takes over the drag,
   * so it can be dropped anywhere — including straight into a Page.
   */
  startPaletteDrag(
    node: FlowNodeData,
    pointer: { pointerId: number; clientX: number; clientY: number },
    children: FlowNodeData[] = [],
  ): void {
    if (!this.canMutate()) {
      return;
    }

    const nodesLayer = this.root.querySelector<HTMLElement>(
      ".node-editor__nodes",
    );

    if (!nodesLayer) {
      this.addNode(node, { children });
      return;
    }

    // Greppa noden i rubriken, ungefär där handtaget sitter.
    const grabOffset = { x: 120, y: 20 };
    const pointerCanvas = this.clientToLocal(
      nodesLayer,
      pointer.clientX,
      pointer.clientY,
    );
    node.position = {
      x: Math.round(pointerCanvas.x - grabOffset.x),
      y: Math.round(pointerCanvas.y - grabOffset.y),
    };

    this.addNode(node, { animate: false, children });

    const created = this.graphData.nodes.find(
      (candidate) => candidate.id === node.id,
    );
    if (!created) {
      return;
    }

    this.autoPanArmed = false;
    this.autoPanDwellStart = null;
    this.autoPanLastPointer = null;
    this.activeNodeDrag = {
      nodeId: created.id,
      pointerId: pointer.pointerId,
      offsetX: grabOffset.x,
      offsetY: grabOffset.y,
      fromPalette: true,
    };
    this.showDragGhost(created, pointer.clientX, pointer.clientY);
    this.updatePageDropTarget(created.position, created);
    this.findNodeElement(created.id)?.setAttribute("data-dragging", "");

    const viewport = this.getViewportElement();
    try {
      viewport?.setPointerCapture(pointer.pointerId);
    } catch {
      // Pointer capture may be missing for synthetic events, but the drag still works.
    }
    viewport?.setAttribute("data-node-dragging", "");
  }

  /**
   * `children` are the fields a page template brings with it (story 088):
   * they are added after the page, in one change, so the page never shows up
   * empty and undo takes the whole page back.
   */
  addNode(
    node: FlowNodeData,
    options: { animate?: boolean; children?: FlowNodeData[] } = {},
  ): void {
    const updatedGraph = addGraphNode(this.graphData, node);

    if (updatedGraph === this.graphData) {
      return;
    }

    this.graphData = (options.children ?? []).reduce(addGraphNode, updatedGraph);
    this.selectedNodeId = node.id;
    this.selectedConnectionId = null;
    this.renderNodes();
    // Palettdrag animeras inte – noden ligger redan under pekaren.
    if (options.animate !== false) {
      this.animateNodeAppear(node.id);
    }
    this.dispatchGraphChanged(
      "node-created",
      this.text("editor.announce.nodeCreated", {
        type: displayNodeTypeLabel(node.type, undefined, this.uiLocale),
      }),
    );
  }

  /** Låter en nyskapad nod poppa fram så ögat hittar den. */
  private animateNodeAppear(nodeId: string): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const element = this.findNodeElement(nodeId);
    if (!element) {
      return;
    }
    element.setAttribute("data-appear", "");
    window.setTimeout(() => element.removeAttribute("data-appear"), 260);
  }

  private closeConnectionMenu(): void {
    this.connectionMenu = null;
    this.renderConnectionMenu();
    this.syncMenuButtons();
  }

  /**
   * Tells the nodes which of them has its menu open.
   *
   * Kept in one place and called from both ends, because the menu closes for
   * plenty of reasons that have nothing to do with the button — Escape, a press
   * on the canvas, selecting something else — and a button left showing a cross
   * over a menu that is gone is worse than one that never changed at all.
   */
  private syncMenuButtons(): void {
    const openFor =
      this.connectionMenu?.kind === "node" ? this.connectionMenu.id : null;

    this.root
      .querySelectorAll<FlowNode>("flow-node")
      .forEach((node) => {
        node.menuOpen = node.nodeId === openFor;
      });
  }

  /**
   * May the user manage node templates? Drives the template actions in the
   * node's menu. *Using* a template from the palette is everyone's — otherwise
   * shared templates would be pointless for all but the few.
   */
  set canManageTemplates(value: boolean) {
    if (this.canManageTemplatesValue === value) {
      return;
    }

    this.canManageTemplatesValue = value;
    // An open menu may carry actions that just became disallowed.
    this.connectionMenu = null;
    this.renderConnectionMenu();
  }

  /**
   * Shows every route from the guide's start to this node.
   *
   * The question is not "where does this lead" — the lines answer that already —
   * but the other way round: *how can somebody end up here?* That is the one you
   * ask about a refusal, and the answer is regularly a way nobody meant to leave
   * open.
   *
   * Every node, not only results. A question halfway down a guide is reached by
   * some answers and not others, and which ones is exactly as hard to see.
   *
   * `findGuidePathsToResult` walks from the start node and stops at 20 routes.
   * A guide with more than twenty ways to reach one node has a problem the
   * highlight cannot help with anyway.
   */
  showRoutesTo(nodeId: string): void {
    const analysis = findGuidePathsToResult(this.graphData, nodeId);
    const connectionIds = Array.from(
      new Set(
        analysis.paths.flatMap((path) => path.map((step) => step.connectionId)),
      ),
    );

    this.routeTargetId = nodeId;
    // No routes at all is an answer, and the interesting one: the whole guide
    // dims and the node stands alone. `highlightConnections` treats an empty
    // list as "no highlight", so the flag is set here rather than inferred.
    this.highlightedConnectionIds =
      connectionIds.length > 0 ? new Set(connectionIds) : new Set();
    this.drawConnections();
  }

  /*
   * The route is put away by the shell (`clearConnectionHighlights`) when the
   * mode ends — never by a click here. Selecting, deselecting and Escape used
   * to dismiss it, which is exactly what made the node-menu variant die with
   * the selection.
   */

  /**
   * Redraws the nodes without touching the graph, the selection or the view.
   *
   * Needed when something *outside* the graph has changed that the nodes show —
   * a node template removed or renamed. The name sits in the template, not in
   * the node.
   */
  refreshNodes(): void {
    if (this.isConnected) {
      this.renderNodes();
    }
  }

  private renderNodes(): void {
    const nodesContainer = this.root.querySelector<HTMLDivElement>(
      ".node-editor__nodes",
    );

    if (!nodesContainer) {
      return;
    }

    nodesContainer.replaceChildren();

    this.graphData.nodes
      .filter((node) => node.type === "page" && !node.parentPageId)
      .forEach((page) => {
        const surface = document.createElement("div");
        surface.className = "node-editor__page-surface";
        surface.dataset.pageId = page.id;
        placeAt(surface, page.position);
        surface.style.height = `${this.getPageHeight(page.id)}px`;
        // The dashed frame and the drop hint hang off the same measurement as
        // the fields, so they cannot drift apart from it.
        surface.style.setProperty(
          "--page-content-top",
          `${this.getPageContentTop(page.id)}px`,
        );
        // A page without fields gets an instruction rather than a blank area.
        //
        // It is an *instruction* and not content: it never lands in the graph
        // and never shows in the viewer. The difference from the two text fields
        // previously created for the editor is that this one costs nothing to
        // ignore — it disappears the moment anything is added.
        const hasFields = this.graphData.nodes.some(
          (candidate) => candidate.parentPageId === page.id,
        );

        surface.innerHTML = `<span class="node-editor__page-caption">Page</span><span class="node-editor__page-drop-hint">${escapeHtml(this.text("editor.canvas.dropFieldHere"))}</span>${
          hasFields
            ? ""
            : `<p class="node-editor__page-empty">${escapeHtml(this.text("editor.canvas.emptyPageHint"))}</p>`
        }<span class="node-editor__page-insertion"></span>`;
        nodesContainer.append(surface);
      });

    this.graphData.nodes.forEach((nodeData) => {
      const nodeElement = document.createElement("flow-node");
      const displayNode = structuredClone(nodeData);

      if (nodeData.parentPageId) {
        const page = this.graphData.nodes.find(
          (candidate) =>
            candidate.id === nodeData.parentPageId && candidate.type === "page",
        );
        if (page) {
          const localPosition = this.getPageChildPosition(nodeData);
          displayNode.position = {
            x: page.position.x + localPosition.x,
            y: page.position.y + localPosition.y,
          };
        }
      }

      nodeElement.activeLocale = this.activeLocaleValue;
      nodeElement.editorLocale = this.uiLocale;
      // Decides whether the node carries a menu button at all. The menu holds
      // nothing but changes, so a read-only canvas must not offer a way in.
      nodeElement.editable = this.canMutate();
      // The mode as an attribute, so flow-node.scss can hide the handles. Set
      // here as well as in `applyModeToDom`, because a node created after the
      // mode was set would otherwise be born with its grip showing.
      nodeElement.toggleAttribute("data-readonly", !this.canMutate());
      // En egenskap, inte ett attribut: noden ritar markören och väver in
      // meddelandet i sitt tillgängliga namn — attributet (för ringens CSS)
      // sätter den själv.
      nodeElement.untranslated = this.untranslatedNodeIdsValue.has(nodeData.id);
      // Before the data, so the first render already draws the right button;
      // the setter patches it afterwards only when it actually changes.
      nodeElement.visitorView = this.visitorViewNodeIds.has(nodeData.id);
      nodeElement.toggleAttribute("data-show-variables", this.showVariablesValue);
      /*
       * The guide itself, by reference, so the node can draw its own step the
       * way the viewer would, word a condition with the question's title and
       * draw `{{name}}` as the variable's label. Whether a step is drawn is
       * the node's own call: a page child is drawn as a field by its page.
       */
      nodeElement.previewGraph = this.graphData;
      nodeElement.nodeData = displayNode;
      nodeElement.connectedOutputPortIds = this.graphData.connections
        .filter((connection) => connection.from.nodeId === displayNode.id)
        .map((connection) => connection.from.portId);
      if (nodeData.type === "page" && !nodeData.parentPageId) {
        nodeElement.style.setProperty(
          "--page-height",
          `${this.getPageHeight(nodeData.id)}px`,
        );
      }
      nodeElement.startNode = nodeData.id === this.graphData.startNodeId;
      nodesContainer.append(nodeElement);
    });

    this.selectNode(this.selectedNodeId);
    this.makeCurrent(null);
    this.hidePageChildrenInVisitorView();
    // After the nodes exist: a run puts marks on all of them, and a redraw
    // during one (a health pass, a language change) must not wipe them.
    this.applyProving();
    this.observeNodeSizes();
    this.updateEmptyState();
  }

  /**
   * Redraws the lines when a node changes height.
   *
   * A node's ports sit at fixed offsets inside it, so anything that changes its
   * height moves them. The height often changes *after* the connections have
   * been drawn: removing a line makes the guide invalid, the health pass then
   * puts a warning band on the node, and the node grows by it.
   *
   * Measured on the case that found this — a question with two answers, one
   * connection deleted: the node went from 213 px to 232, the port moved from
   * y=537 to 555, and the remaining line stayed at 536, hanging 19 px off its
   * port with nothing to correct it. It stayed wrong until something unrelated
   * forced a redraw.
   *
   * Every node is re-observed on each render rather than only at connect time.
   * That is the whole defect: `observeEditorSize()` ran once in
   * `connectedCallback`, right after `render()`, when the canvas is empty — so
   * it observed nothing, and no node created afterwards was ever watched.
   *
   * The draw is coalesced into one animation frame, so observing 250 nodes costs
   * one redraw and not 250.
   */
  private observeNodeSizes(): void {
    if (!this.nodeResizeObserver) {
      this.nodeResizeObserver = new ResizeObserver((entries) => {
        // The same measurement answers two questions: where the lines end, and
        // how tall a page's rows are. One observer, because a second one would
        // watch the same elements for the same reason — see PRAXIS 15.
        let heightsChanged = false;

        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;

          // A page node's text block, observed inside the node's shadow root.
          // Its own height is what changes when the title wraps; the node's
          // outer height cannot say so, because `--page-height` sets that.
          if (!(element instanceof FlowNode)) {
            if (this.measurePageIntro(element)) heightsChanged = true;
            return;
          }

          const id = element.nodeId;
          if (!id) return;
          const height =
            entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
          if (this.recordNodeHeight(id, height)) heightsChanged = true;
        });

        if (heightsChanged) {
          this.applyPageLayouts();
        }
        this.scheduleDrawConnections();
      });
    }

    // The old elements are gone from the DOM but an observer keeps a strong
    // reference to whatever it observes, so the list is rebuilt, not added to.
    this.nodeResizeObserver.disconnect();

    const drawn = new Set<string>();
    // Measured here and not only in the observer's first callback: the fields
    // are placed in this same tick, and a callback one frame later would draw
    // them once on the fallback and then move them. Mid-drag that showed up as
    // a page whose child followed 29 px short of its page.
    let measured = false;

    this.root.querySelectorAll<FlowNode>("flow-node").forEach((node) => {
      this.nodeResizeObserver?.observe(node);
      if (node.nodeId) {
        drawn.add(node.nodeId);
        if (
          this.recordNodeHeight(
            node.nodeId,
            node.getBoundingClientRect().height / this.zoom,
          )
        ) {
          measured = true;
        }
      }

      if (!node.hasAttribute("data-page-container")) return;
      // The structure, not the whole content: with the pencil a page's visitor
      // view sits in the flow inside the content, and measuring that would
      // push the (hidden) fields down by the height of the form.
      const intro =
        node.shadowRoot?.querySelector<HTMLElement>(".flow-node__structure") ??
        node.shadowRoot?.querySelector<HTMLElement>(".flow-node__content");
      if (!intro) return;
      this.nodeResizeObserver?.observe(intro);
      if (this.measurePageIntro(intro)) measured = true;
    });

    // A height left behind by a deleted node would size a row that no longer
    // exists if the id came back.
    [...this.nodeHeights.keys()].forEach((id) => {
      if (!drawn.has(id)) this.nodeHeights.delete(id);
    });
    [...this.pageIntroBottoms.keys()].forEach((id) => {
      if (!drawn.has(id)) this.pageIntroBottoms.delete(id);
    });

    if (measured) this.applyPageLayouts();
  }

  /**
   * Returns true when the height moved enough to be worth a new layout.
   *
   * Rounded to whole pixels: the rows stack on these numbers, and a fraction
   * would spread through every field below it and land the cards on half
   * pixels. It also keeps sub-pixel noise from starting a layout that changes
   * nothing.
   */
  private recordNodeHeight(id: string, height: number): boolean {
    if (!Number.isFinite(height) || height <= 0) return false;
    const rounded = Math.round(height);
    if (this.nodeHeights.get(id) === rounded) return false;
    this.nodeHeights.set(id, rounded);
    return true;
  }

  /**
   * Records where a page node's text block ends, measured from the node's top.
   *
   * Client rectangles rather than the observer's box: the wanted number is a
   * distance between two elements, and only the pair carries it. The workspace
   * is drawn with `transform: scale(zoom)`, so the reading is divided back into
   * canvas pixels.
   *
   * Returns true when the value moved enough to be worth a new layout.
   */
  private measurePageIntro(intro: HTMLElement): boolean {
    const host = (intro.getRootNode() as ShadowRoot).host as FlowNode | null;
    const pageId = host?.nodeId;
    if (!host || !pageId) return false;

    const hostTop = host.getBoundingClientRect().top;
    // The structure ends where the text block ends; the content's bottom
    // padding below it is still the page's, so the fields keep the distance
    // they had when the whole content was measured.
    const content = intro.closest<HTMLElement>(".flow-node__content");
    const padding =
      content && content !== intro
        ? Number.parseFloat(getComputedStyle(content).paddingBottom) || 0
        : 0;
    const bottom =
      (intro.getBoundingClientRect().bottom - hostTop) / this.zoom + padding;
    if (!Number.isFinite(bottom) || bottom <= 0) return false;
    if (Math.abs((this.pageIntroBottoms.get(pageId) ?? 0) - bottom) < 0.5) {
      return false;
    }

    this.pageIntroBottoms.set(pageId, bottom);
    return true;
  }

  /**
   * Places every page's fields and resizes the pages from the drawn heights.
   *
   * Called when a measured height changes, and it does not rebuild the DOM:
   * the graph has not changed, only the boxes have, and a rebuild would drop
   * the focus and the selection with it.
   */
  private applyPageLayouts(): void {
    this.graphData.nodes
      .filter((node) => node.type === "page" && !node.parentPageId)
      .forEach((page) => {
        const height = this.getPageHeight(page.id);
        const surface = this.root.querySelector<HTMLElement>(
          `.node-editor__page-surface[data-page-id="${page.id}"]`,
        );
        if (surface) {
          surface.style.height = `${height}px`;
          surface.style.setProperty(
            "--page-content-top",
            `${this.getPageContentTop(page.id)}px`,
          );
        }
        this.findNodeElement(page.id)?.style.setProperty(
          "--page-height",
          `${height}px`,
        );

        const layouts = this.getPageChildLayouts(page.id);
        this.getPageChildren(page.id).forEach((child) => {
          const element = this.findNodeElement(child.id);
          const position = layouts.get(child.id);
          if (!element || !position) return;
          // A field under the pointer is placed by the drag, and its siblings
          // by the reflow preview; neither may be pulled back to its slot.
          if (
            element.hasAttribute("data-dragging") ||
            element.hasAttribute("data-reflowing")
          ) {
            return;
          }
          element.style.left = `${page.position.x + position.x}px`;
          element.style.top = `${page.position.y + position.y}px`;
        });
      });
  }

  /** The plaque names the mode, and only where there is a mode worth naming. */
  private updateModePlaque(): void {
    const plaque = this.root.querySelector<HTMLElement>("[data-mode-plaque]");
    if (!plaque) return;

    const key =
      this.editorModeValue === "readonly"
        ? "editor.mode.readonly.title"
        : this.editorModeValue === "translator"
          ? "editor.mode.translator.title"
          : null;

    plaque.hidden = key === null;
    plaque.textContent = key ? this.text(key) : "";
  }

  private updateEmptyState(): void {
    const empty = this.root.querySelector<HTMLElement>("[data-empty]");
    if (empty) {
      empty.hidden = this.graphData.nodes.length > 0;
    }
    this.updateCanvasToolbarVisibility();
  }

  private bindEvents(): void {
    // A node's exit rings slid to their answers' rows (or back) after the
    // toggle's own redraw — see alignPortsToAnswers in flow-node.ts.
    this.addEventListener("node-ports-moved", () => {
      this.scheduleDrawConnections();
    });

    this.addEventListener(
      "node-port-pointerdown",
      this.handlePortPointerDown as EventListener,
    );

    this.addEventListener(
      "node-port-pointerup",
      this.handlePortPointerUp as EventListener,
    );

    window.addEventListener("pointermove", this.handlePointerMove);

    window.addEventListener("pointerup", this.handleWindowPointerUp);

    this.addEventListener(
      "node-drag-start",
      this.handleNodeDragStart as EventListener,
    );

    this.addEventListener(
      "node-select",
      this.handleNodeSelect as EventListener,
    );

    this.addEventListener(
      "node-nudge",
      this.handleNodeNudge as EventListener,
    );

    this.addEventListener(
      "node-navigate",
      this.handleNodeNavigate as EventListener,
    );

    this.addEventListener(
      "node-menu-intent",
      this.handleNodeMenuIntent as EventListener,
    );

    this.addEventListener(
      "node-visitor-view-intent",
      this.handleVisitorViewIntent,
    );

    this.addEventListener(
      "node-port-activate",
      this.handlePortActivate as EventListener,
    );

    /*
     * Focus arriving by any route — a click, a screen reader's own navigation —
     * moves the tab stop with it, so Tab from there goes to that node's ports.
     *
     * On the shadow root, not on the host: the nodes live inside this root, so
     * an event caught at the host has already been retargeted to the host and
     * `closest("flow-node")` finds nothing. The first version listened there and
     * focus moved without the tab stop following.
     */
    this.root.addEventListener("focusin", this.handleNodeFocusIn);
    this.root.addEventListener("focusout", this.handleCanvasFocusOut);

    this.addEventListener("pointerdown", this.handleEditorPointerDown);

    this.addEventListener("contextmenu", this.handleEditorContextMenu);
  }

  /**
   * Everything bound to the viewport itself, re-bound by `render()`.
   *
   * `render()` rebuilds the shadow DOM, viewport included, and these listeners
   * die with the old element. `bindEvents()` only ever ran from
   * `connectedCallback`, so the first re-render — `set editorLocale` calls one
   * — left a canvas that could not be panned by finger, pinched, wheel-zoomed
   * or steered by keyboard, and whose scroll no longer updated the trim or the
   * lost state. Found on a tablet, on the English example page: the Swedish
   * one never changes the editor language, so the fault wore a language.
   *
   * Called from `render()` so every caller is safe by construction; the
   * handlers are instance fields, so a repeated add is a no-op.
   */
  private bindViewportEvents(): void {
    const viewport = this.getViewportElement();
    viewport?.addEventListener("scroll", this.handleViewportScroll);
    // passive: false so preventDefault can stop the browser's page zoom.
    viewport?.addEventListener("wheel", this.handleWheel, { passive: false });
    viewport?.addEventListener("pointerdown", this.handlePinchDown);
    viewport?.addEventListener("pointermove", this.handlePinchMove, { passive: false });
    viewport?.addEventListener("pointerup", this.handlePinchUp);
    viewport?.addEventListener("pointercancel", this.handlePinchUp);
    this.bindTheWayBack();

    viewport?.addEventListener("pointerdown", this.handlePanDown);
    viewport?.addEventListener("pointermove", this.handlePanMove, { passive: false });
    viewport?.addEventListener("pointerup", this.handlePanUp);
    viewport?.addEventListener("pointercancel", this.handlePanUp);
    viewport?.addEventListener("keydown", this.handleViewportKeydown);
  }

  /**
   * Two fingers on the canvas zoom the graph, not the page.
   *
   * Reported from an iPad: pinching zoomed the whole page, because nothing here
   * claimed the gesture and the browser's own took it. `touch-action: pan-x
   * pan-y` on the viewport is the other half — it keeps native panning, which is
   * how a finger moves around a large graph, while declining the browser's
   * pinch so the events reach us at all.
   *
   * Only exactly two pointers count. One is a pan, a node drag or a connection
   * being drawn, and a third is somebody resting a hand on the glass.
   */
  private readonly pinchPointers = new Map<number, { x: number; y: number }>();

  /**
   * The gesture's starting point, not the previous frame's.
   *
   * Measured on a real iPad, because the first version multiplied the zoom by
   * the ratio between one move and the next — and that accumulates. With two
   * fingers about sixty pixels apart and holding still, the readout showed a
   * steady `kvot 0.992` while the distance itself did not change: sub-pixel
   * jitter, under the rounding. Sixty times a second it dragged the zoom from
   * 0.791 down to 0.751 without anybody moving anything, which is why a pinch
   * sometimes shrank what it was meant to grow.
   *
   * Against the start there is nothing to accumulate. The zoom is always the
   * starting zoom times how far the fingers are from where they began, so jitter
   * shows as jitter and a gesture shows as a gesture.
   */
  private pinchStart: {
    distance: number;
    zoom: number;
    /**
     * The point the fingers grabbed, in the **guide's** coordinates.
     *
     * Not the workspace's. The buffer can grow the workspace mid-gesture, and
     * growing the low side moves the origin — so a workspace coordinate captured
     * at the start refers to somewhere else in the content by the end. Measured:
     * one pinch in and back out returned the zoom to exactly 1.000 and left the
     * guide 1600px away, which is precisely how far the origin had moved.
     */
    anchor: Point;
  } | null = null;

  /**
   * Panning, ours now, because the pinch had to be.
   *
   * `touch-action: none` is what lets a two-finger gesture reach us whole — but
   * it takes the browser's own scrolling with it, and that scrolling was the
   * panning. So a finger drags the canvas here instead, and the glide after a
   * flick is written out below rather than inherited.
   *
   * The scroll offsets stay the single source of truth. Everything else in this
   * file reads them — the minimap, the buffer, the centre, the connection
   * drawing — and moving to a transform of our own would have touched all of it
   * for no gain a person could see.
   */
  private pan: {
    pointerId: number;
    lastX: number;
    lastY: number;
    /** Where the finger landed, for the slop threshold below. */
    fromX: number;
    fromY: number;
    /** Whether the movement has passed that threshold and become a pan. */
    moving: boolean;
    /** px per ms, smoothed, for the glide. */
    vx: number;
    vy: number;
    at: number;
  } | null = null;

  /**
   * How far a finger must travel before it is panning rather than resting.
   *
   * The browser has such a threshold and we inherited nothing when we took the
   * gesture over, so the canvas moved on the very first pixel. Measured on the
   * device: `rörelse 1 1 1 1 1 1 1 1` with the geometry untouched — a fingertip
   * resting on glass wanders about a pixel a frame, and the canvas crept along
   * with it.
   *
   * Eight pixels is roughly what browsers use, and it is below what anybody
   * means as a movement while being well above what a still hand produces.
   */
  private readonly panSlop = 8;

  private glideFrame: number | null = null;

  private readonly handlePanDown = (event: PointerEvent): void => {
    if (
      event.pointerType !== "touch" ||
      this.pinchPointers.size > 1 ||
      this.activeNodeDrag ||
      this.activeConnection
    ) {
      return;
    }

    this.stopGlide();
    this.pan = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      fromX: event.clientX,
      fromY: event.clientY,
      moving: false,
      vx: 0,
      vy: 0,
      at: event.timeStamp,
    };
  };

  private readonly handlePanMove = (event: PointerEvent): void => {
    const pan = this.pan;
    const viewport = this.getViewportElement();

    if (!pan || !viewport || event.pointerId !== pan.pointerId) {
      return;
    }

    // A second finger turns the gesture into a pinch, which owns it whole.
    if (this.pinchPointers.size > 1) {
      this.pan = null;
      return;
    }

    /*
     * Nothing happens until the finger has actually gone somewhere. Panning from
     * where it landed rather than from where the threshold was crossed would
     * make the canvas jump those eight pixels the moment it starts.
     */
    if (!pan.moving) {
      const travelled = Math.hypot(
        event.clientX - pan.fromX,
        event.clientY - pan.fromY,
      );

      if (travelled < this.panSlop) {
        return;
      }

      /*
       * Crossing the threshold starts the pan *from the threshold*, and the rest
       * of this event's movement is used straight away.
       *
       * Returning here instead swallowed the whole move, which a single large
       * one — a coalesced batch, a slow frame — makes very visible: the finger
       * travelled eighty pixels and the canvas did not move at all. Starting
       * from where the finger landed would be the opposite fault, throwing the
       * canvas the eight pixels nobody meant.
       */
      pan.moving = true;
      pan.lastX = pan.fromX + ((event.clientX - pan.fromX) * this.panSlop) / travelled;
      pan.lastY = pan.fromY + ((event.clientY - pan.fromY) * this.panSlop) / travelled;
      pan.at = event.timeStamp;
    }

    const dx = event.clientX - pan.lastX;
    const dy = event.clientY - pan.lastY;
    const dt = Math.max(1, event.timeStamp - pan.at);

    viewport.scrollLeft -= dx;
    viewport.scrollTop -= dy;

    /*
     * Smoothed, because a single frame is mostly noise and the glide inherits
     * whatever the last one happened to be. Two parts old to one part new is
     * enough to settle it without making the flick feel delayed.
     */
    pan.vx = pan.vx * 0.7 + (dx / dt) * 0.3;
    pan.vy = pan.vy * 0.7 + (dy / dt) * 0.3;
    pan.lastX = event.clientX;
    pan.lastY = event.clientY;
    pan.at = event.timeStamp;
  };

  private readonly handlePanUp = (event: PointerEvent): void => {
    const pan = this.pan;

    if (!pan || event.pointerId !== pan.pointerId) {
      return;
    }

    this.pan = null;
    this.startGlide(pan.vx, pan.vy);
  };

  /**
   * The glide after a flick — the one thing native scrolling gave for free.
   *
   * Exponential decay rather than anything cleverer: it is what a thrown thing
   * on a surface does, it stops in about half a second, and there is no state to
   * get wrong. Below a twentieth of a pixel per millisecond nobody can tell it
   * apart from stopped, so it stops.
   */
  private startGlide(vx: number, vy: number): void {
    const viewport = this.getViewportElement();

    /*
     * Both thresholds are in pixels per millisecond, and both were too low.
     *
     * Measured on the device: the readout showed `-1 -1 -1 -1 -1 -1 -1 -1` —
     * one pixel a frame, frame after frame, with the geometry untouched. That is
     * the glide's tail, not a stutter: it stopped at 0.05 px/ms, which is 0.8px
     * a frame, so it crept for a second after every pan. Momentum that ends is
     * momentum; momentum that seeps away is a canvas that will not sit still.
     *
     * A glide now has to be worth starting — a deliberate flick rather than a
     * slow drag that happened to end while moving — and has to stop while it is
     * still visibly moving, at about two pixels a frame.
     */
    if (!viewport || Math.hypot(vx, vy) < 0.35) {
      return;
    }

    /*
     * Ingen glidning för den som bett om mindre rörelse (C3, 21/9).
     *
     * Panoreringen själv är kvar: så länge fingret ligger kvar flyttas
     * arbetsytan av handen som flyttar den, och det är direkt manipulation och
     * inte animering. Glidningen efter släppet är något annat — den fortsätter
     * på egen hand efter att gesten tagit slut, och det är precis den sortens
     * rörelse inställningen handlar om (WCAG 2.3.3).
     *
     * Mätt 21/9 innan raden skrevs: med `prefers-reduced-motion: reduce` satt
     * flyttade sig arbetsytan 583 px i x och 185 i y under 700 ms EFTER att
     * pekaren släppt, exakt som utan inställningen.
     *
     * Slutläget behålls, och det är därför trimningen körs här i stället för i
     * slingans sista varv: utan den raden blir en avstängd glidning också en
     * utebliven städning, vilket vore en andra ändring ingen bett om.
     */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.scheduleTrim();
      return;
    }

    /*
     * A ceiling on how fast a flick may launch.
     *
     * The speed is measured over the gap between two moves, and that gap can be
     * a fraction of a millisecond — coalesced events, a busy frame, a synthetic
     * sequence. One such sample turns a normal flick into forty-eight pixels a
     * frame for a second and a half, which crosses the whole guide. Three pixels
     * per millisecond is already faster than anybody flicks; beyond that the
     * number is measurement noise rather than intent.
     */
    const speed = Math.hypot(vx, vy);
    const ceiling = Math.min(1, 3 / speed);

    let speedX = vx * ceiling;
    let speedY = vy * ceiling;
    let last = performance.now();

    const step = (now: number): void => {
      const dt = Math.min(32, now - last);

      last = now;
      viewport.scrollLeft -= speedX * dt;
      viewport.scrollTop -= speedY * dt;

      const decay = 0.995 ** dt;

      speedX *= decay;
      speedY *= decay;

      if (Math.hypot(speedX, speedY) < 0.13) {
        this.glideFrame = null;
        this.scheduleTrim();
        return;
      }

      this.glideFrame = requestAnimationFrame(step);
    };

    this.glideFrame = requestAnimationFrame(step);
  }

  private stopGlide(): void {
    if (this.glideFrame !== null) {
      cancelAnimationFrame(this.glideFrame);
      this.glideFrame = null;
    }
  }

  private readonly handlePinchDown = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") {
      return;
    }

    this.pinchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.beginPinch();
  };

  /** Starts (or restarts) the gesture from wherever the fingers are now. */
  private beginPinch(): void {
    const distance = this.currentPinchDistance();

    if (distance < 1) {
      this.pinchStart = null;
      return;
    }

    const middle = this.pinchMidpoint();

    const grabbed = this.clientToWorkspace(middle.x, middle.y);

    this.pinchStart = {
      distance,
      zoom: this.zoom,
      anchor: {
        x: grabbed.x - this.workspaceGeometry.originX,
        y: grabbed.y - this.workspaceGeometry.originY,
      },
    };
  }

  private pinchMidpoint(): Point {
    const [first, second] = [...this.pinchPointers.values()];

    return {
      x: ((first?.x ?? 0) + (second?.x ?? 0)) / 2,
      y: ((first?.y ?? 0) + (second?.y ?? 0)) / 2,
    };
  }

  private readonly handlePinchMove = (event: PointerEvent): void => {
    if (!this.pinchPointers.has(event.pointerId)) {
      return;
    }

    this.pinchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pinchPointers.size !== 2) {
      return;
    }

    const distance = this.currentPinchDistance();
    const start = this.pinchStart;

    /*
     * A pinch collapsed to a point says nothing about how much to zoom, and
     * dividing by it would say something violent.
     */
    if (!start || distance < 1) {
      this.beginPinch();
      return;
    }

    const middle = this.pinchMidpoint();

    /*
     * One transform, not a zoom with a pan happening beside it.
     *
     * The point the fingers grabbed is put back under their midpoint at the new
     * scale, which is the property a two-point similarity transform is defined
     * by: what is under the fingers stays under the fingers. Scale alone left
     * the canvas sliding out of somebody's grip whenever the pair moved, and the
     * browser's own panning was doing the translating — two mechanisms, able to
     * disagree.
     */
    event.preventDefault();
    this.setZoom(
      start.zoom * (distance / start.distance),
      middle.x,
      middle.y,
      {
        x: start.anchor.x + this.workspaceGeometry.originX,
        y: start.anchor.y + this.workspaceGeometry.originY,
      },
    );
  };

  private readonly handlePinchUp = (event: PointerEvent): void => {
    this.pinchPointers.delete(event.pointerId);
    this.beginPinch();

    if (this.pinchPointers.size === 0) {
      this.scheduleTrim();
    }
  };

  private currentPinchDistance(): number {
    if (this.pinchPointers.size !== 2) {
      return 0;
    }

    const [first, second] = [...this.pinchPointers.values()];

    return Math.hypot(first!.x - second!.x, first!.y - second!.y);
  }

  private readonly handleWheel = (event: WheelEvent): void => {
    // Ctrl/Cmd plus scroll (and trackpad pinch, which the browser sends as
    // ctrl+wheel) zooms towards the pointer instead of panning.
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    // Ren sidled-scroll (t.ex. Ctrl + pekplatta i sidled) saknar vertikal
    // delta och ska inte tolkas som en zoomriktning.
    if (event.deltaY === 0) {
      return;
    }

    event.preventDefault();
    this.setZoom(this.steppedZoom(event.deltaY < 0 ? 1 : -1), event.clientX, event.clientY);
  };

  /**
   * Moves focus to the nearest node in a direction.
   *
   * "Nearest" is the one a person would point at: only nodes that actually lie
   * that way count, and among those the closest wins — but a node straight
   * ahead beats one that is nearer as the crow flies while sitting well off to
   * the side. So the distance along the direction is weighted lightly and the
   * distance across it heavily. Without that, pressing → from a node with a
   * neighbour just above-right jumps diagonally, which reads as the focus
   * having a mind of its own.
   */
  private focusNearestNode(fromId: string | null, dx: number, dy: number): void {
    const elements = [
      ...this.root.querySelectorAll<FlowNode>("flow-node"),
    ].filter((element) => !element.hasAttribute("hidden"));

    if (elements.length === 0) {
      return;
    }

    const from = fromId ? this.findNodeElement(fromId) : null;

    if (!from) {
      elements[0]?.focus();
      return;
    }

    const start = from.getBoundingClientRect();
    const origin = { x: start.left + start.width / 2, y: start.top + start.height / 2 };

    let best: { element: FlowNode; cost: number } | null = null;

    for (const element of elements) {
      if (element === from) {
        continue;
      }

      const box = element.getBoundingClientRect();
      const to = { x: box.left + box.width / 2, y: box.top + box.height / 2 };

      const along = (to.x - origin.x) * dx + (to.y - origin.y) * dy;
      const across = Math.abs((to.x - origin.x) * dy - (to.y - origin.y) * dx);

      // Behind us, or level with us, is not "that way".
      if (along <= 0) {
        continue;
      }

      const cost = along + across * 2;

      if (!best || cost < best.cost) {
        best = { element, cost };
      }
    }

    /*
     * Only focus is moved here. The tab stop follows on `focusin`, which has to
     * exist anyway for a click or a screen reader's own navigation — moving it
     * here as well was a second mechanism doing the first one's work, and a
     * mutation test could not tell the two apart.
     */
    best?.element.focus();
  }

  /**
   * Moves the canvas's single tab stop to this node.
   *
   * Called from anywhere focus lands on a node — the arrows, a click, a fresh
   * render — so that leaving the canvas and coming back returns to where the
   * work was, rather than to the first node in the graph.
   */
  private makeCurrent(node: FlowNode | null): void {
    const nodes = [...this.root.querySelectorAll<FlowNode>("flow-node")];
    const chosen =
      node ??
      nodes.find((one) => one.nodeId === this.selectedNodeId) ??
      nodes.find((one) => one.nodeId === this.graphData?.startNodeId) ??
      nodes[0] ??
      null;

    nodes.forEach((one) => {
      one.current = one === chosen;
    });

    /*
     * The connection handles ride in the current node's tab group, so moving
     * the current node moves them too. Kept as an id rather than read off the
     * elements because `current` is a property with no attribute behind it, and
     * the handles are redrawn far less often than focus moves.
     */
    this.currentNodeId = chosen?.nodeId ?? null;
    this.updateConnectionHandleTabOrder();
  }

  /** The node that holds the canvas's single tab stop, and its lines with it. */
  private currentNodeId: string | null = null;

  /**
   * Whether a line's handle should be on screen.
   *
   * Not the same question as whether it is in the tab order, which is what the
   * first version used — and that was wrong in the ordinary case rather than an
   * odd one. `makeCurrent(null)` runs on every redraw and falls back to the
   * start node, so opening a guide put handles on that node's outgoing lines
   * with nothing selected and nothing focused. Two dots floating on the canvas,
   * and no way to tell what they belonged to: the tab stop is state nobody can
   * see.
   *
   * So visibility follows what a person can *point at*: the line is selected,
   * its node is selected, or focus is inside that node. The tab order still
   * follows `current`, and the two agree when it matters — tabbing into a node
   * focuses it, which shows its lines before Tab reaches them.
   */
  private handleShouldShow(connection: Connection): boolean {
    if (connection.id === this.selectedConnectionId) {
      return true;
    }

    /*
     * Not for a node that was merely tapped.
     *
     * Selecting a node used to bring out every line leaving it, which on a node
     * with a Yes and a No is two handles nobody asked for — reported as feeling
     * like a bug, and it is hard to argue: the direct way to a line is to press
     * the line, and that already works.
     *
     * The keyboard still needs them, though, and a handle that is not visible is
     * not focusable either. `:focus-visible` is what separates the two, measured
     * rather than assumed: after a tap the node matches `:focus-within` but not
     * `:focus-visible`; after Tab it matches both. Asked of the node's whole
     * shadow root, because focus may be sitting on one of its ports rather than
     * on the node itself, and the lines belong to the node either way.
     *
     * And the handle that holds focus itself. Tab from the node's last port
     * lands on it, and at that moment focus is no longer *in* the node — so
     * the rule above went false on the frame the handle was reached, hid it
     * with `display: none`, and the browser dropped focus to the body. A tab
     * stop that vanishes underfoot is worse than none (film 5, 7/9).
     */
    return this.touchesFocusedNode(connection) || this.handleHasFocus(connection);
  }

  private handleHasFocus(connection: Connection): boolean {
    const focused = this.root.activeElement;

    return (
      focused instanceof HTMLElement &&
      focused.classList.contains("node-editor__connection-handle") &&
      focused.dataset.connectionId === connection.id
    );
  }

  /**
   * Whether a line meets the node the keyboard is standing on — either end.
   *
   * Outgoing only was the first version, and it read as asymmetric: standing on
   * a node you could reach the lines leaving it but not the one you arrived on,
   * which is often the one worth removing. A line has two ends and both of them
   * are somewhere.
   *
   * Asked of the node's whole shadow root, because focus may be sitting on one
   * of its ports rather than on the node itself, and the lines belong to the
   * node either way.
   */
  private touchesFocusedNode(connection: Connection): boolean {
    return [connection.from.nodeId, connection.to.nodeId].some((nodeId) =>
      Boolean(this.findNodeElement(nodeId)?.shadowRoot?.querySelector(":focus-visible")),
    );
  }

  private updateConnectionHandleTabOrder(): void {
    this.root
      .querySelectorAll<HTMLButtonElement>(".node-editor__connection-handle")
      .forEach((handle) => {
        const connection = this.graphData?.connections.find(
          (candidate) => candidate.id === handle.dataset.connectionId,
        );

        const mine =
          Boolean(connection) &&
          (connection!.from.nodeId === this.currentNodeId ||
            connection!.to.nodeId === this.currentNodeId);

        handle.tabIndex = mine ? 0 : -1;
        handle.toggleAttribute(
          "data-show",
          Boolean(connection) && this.handleShouldShow(connection!),
        );
      });
  }

  /** The output somebody has picked up, waiting for an input. */
  private pendingConnection: { nodeId: string; portId: string; label: string } | null = null;

  /** Says something once, to whoever is listening rather than looking. */
  private announce(message: string): void {
    const region = this.root.querySelector<HTMLElement>("[data-announce]");

    if (!region) {
      return;
    }

    // Same text twice in a row is not re-announced unless it changes first.
    region.textContent = "";
    window.setTimeout(() => {
      region.textContent = message;
    }, 30);
  }

  private clearPendingConnection(announceIt = false): void {
    if (!this.pendingConnection) {
      return;
    }

    const element = this.findNodeElement(this.pendingConnection.nodeId);
    element?.setPendingPort(null);
    this.pendingConnection = null;

    if (announceIt) {
      this.announce(this.text("editor.canvas.connectCancelled"));
    }
  }

  private readonly handlePortActivate = (
    event: CustomEvent<{
      nodeId: string;
      portId: string;
      direction: string;
      label: string;
      nodeLabel: string;
    }>,
  ): void => {
    const { nodeId, portId, direction, label, nodeLabel } = event.detail;

    if (!this.canMutate()) {
      return;
    }

    if (direction === "output") {
      this.clearPendingConnection();
      this.pendingConnection = { nodeId, portId, label };
      this.findNodeElement(nodeId)?.setPendingPort(portId);
      this.announce(this.text("editor.canvas.connectFrom", { port: label }));
      return;
    }

    const pending = this.pendingConnection;

    if (!pending) {
      return;
    }

    const before = this.graphData;

    this.createConnection({
      id: crypto.randomUUID(),
      from: { nodeId: pending.nodeId, portId: pending.portId },
      to: { nodeId, portId },
    });

    const made = this.graphData !== before;

    this.clearPendingConnection();
    // The input's node redrew with the connection and took the focused button
    // with it; the person is still on that input. Film 5 (7/9) found the gap.
    this.findNodeElement(nodeId)?.focusPort(portId);

    this.announce(
      made
        ? this.text("editor.canvas.connectDone", {
            from: pending.label,
            to: nodeLabel || label,
          })
        : this.text("editor.canvas.connectRefused"),
    );
  };

  private readonly handleNodeFocusIn = (event: Event): void => {
    const node = (event.target as HTMLElement | null)?.closest?.("flow-node") as
      | FlowNode
      | null;

    if (node && !node.current) {
      this.makeCurrent(node);
    }
  };

  /**
   * Focus leaving a node has to take that node's handles with it.
   *
   * On the next frame, not now: `focusout` fires *before* the new focus lands,
   * so `:focus-within` is briefly false even when focus is only moving from a
   * node to one of its own ports. Reading it a frame later asks the question
   * once focus has settled, and moving inside a node then changes nothing.
   */
  private readonly handleCanvasFocusOut = (): void => {
    requestAnimationFrame(() => this.updateConnectionHandleTabOrder());
  };

  private readonly handleNodeNavigate = (
    event: CustomEvent<{ nodeId: string; dx: number; dy: number }>,
  ): void => {
    this.focusNearestNode(event.detail.nodeId, event.detail.dx, event.detail.dy);
  };

  /**
   * The menu button on a node — the way in for a finger.
   *
   * Selects first, then opens, so the menu always belongs to the node whose
   * button was pressed even if another one was selected a moment ago. That is
   * also what a right-click has always done.
   */
  private readonly handleNodeMenuIntent = (
    event: CustomEvent<{ nodeId: string }>,
  ): void => {
    /*
     * The same button closes what it opened.
     *
     * Pressing `⋯` again on a menu that is already open used to reopen it in
     * place — a press with nothing to show for it. A control that opens
     * something should close it too, and the glyph says which it will do.
     */
    const open =
      this.connectionMenu?.kind === "node" &&
      this.connectionMenu.id === event.detail.nodeId;

    if (open) {
      this.closeConnectionMenu();
      return;
    }

    this.selectNode(event.detail.nodeId);
    this.openContextMenuForSelection();
  };

  private readonly handleViewportKeydown = (event: KeyboardEvent): void => {
    /*
     * Escape ends a run, and is asked before anything else — including the
     * rule below that lets a text field keep its keys. While a run is on, the
     * focus is normally *in* a field of the live step, so a guard that hands
     * every key to the field would take the one way out with it.
     */
    if (event.key === "Escape" && this.provingValue) {
      event.preventDefault();
      this.dispatchEvent(
        new CustomEvent("proving-end-request", {
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }

    if (event.key === "Escape" && this.routesLabelValue !== null) {
      event.preventDefault();
      this.dispatchEvent(
        new CustomEvent("routes-end-request", {
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }

    // Selection, panning and zoom work in every mode; delete and nudge change
    // the graph and do not.
    const changes = ["Delete", "Backspace", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

    if (!this.canMutate() && changes.includes(event.key)) {
      return;
    }

    // Let text input win: do not handle keys when focus is in an editable
    // field. composedPath[0] reaches the real target even across shadow
    // boundaries.
    const target = event.composedPath()[0];
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.matches("input, textarea, select"))
    ) {
      return;
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === "-") {
      event.preventDefault();
      this.zoomOut();
    } else if (event.key === "0") {
      event.preventDefault();
      this.resetZoom();
    } else if (event.key === "f" || event.key === "F" || event.key === "Home") {
      event.preventDefault();
      this.fitToContent(true);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      if (this.selectedNodeId || this.selectedConnectionId) {
        event.preventDefault();
        this.deleteSelection();
      }
    } else if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
    ) {
      /*
       * An arrow from the canvas itself, with no node focused, still means
       * "take me to a node" — otherwise reaching the first one needs a Tab that
       * somebody has to know about, which is the problem this is here to solve.
       */
      const directions: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      const [dx, dy] = directions[event.key] ?? [0, 0];

      event.preventDefault();
      this.focusNearestNode(this.selectedNodeId, dx, dy);
    } else if (event.key === "Escape") {
      if (this.pendingConnection) {
        event.preventDefault();
        this.clearPendingConnection(true);
        return;
      }
      if (this.selectedNodeId || this.selectedConnectionId) {
        event.preventDefault();
        this.clearSelection();
      }
    } else if (
      event.key === "ContextMenu" ||
      (event.shiftKey && event.key === "F10")
    ) {
      // The two keys that mean "menu for this thing" — see
      // `openContextMenuForSelection`. Nothing is prevented when nothing is
      // selected, so the browser's own menu still works on an empty canvas.
      if (this.openContextMenuForSelection()) {
        event.preventDefault();
      }
    } else if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === "d" || event.key === "D")
    ) {
      if (this.selectedNodeId) {
        event.preventDefault();
        this.duplicateNodeById(this.selectedNodeId);
      }
    }
  };

  /**
   * Removes the selected node or connection. A start node goes through the
   * confirmation flow (the same as the context menu) so nobody accidentally
   * leaves the guide without a start.
   */
  private deleteSelection(): void {
    if (this.selectedConnectionId) {
      this.removeConnection(this.selectedConnectionId);
      return;
    }

    const nodeId = this.selectedNodeId;
    if (!nodeId) {
      return;
    }

    if (nodeId === this.graphData.startNodeId) {
      this.dispatchEvent(
        new CustomEvent("start-node-remove-intent", {
          detail: { nodeId },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }

    this.removeNodeById(nodeId);
  }

  private readonly handleViewportScroll = (): void => {
    this.ensureWorkspaceBuffer();

    /*
     * The trim used to be scheduled only from inside the growth, which meant it
     * could only ever give room back in the same breath as taking more. Panning
     * *home* — the one movement after which the far side is plainly spare — grows
     * nothing, so nothing was scheduled and the workspace kept whatever it had
     * taken.
     *
     * Measured: out to an edge and back, eight steps of four hundred, and the
     * canvas stayed 2800×5400 the whole way. It is also why the trim's own scroll
     * compensation had no test — deliberately breaking it changed nothing,
     * because that code never ran on any path a test could reach.
     *
     * Debounced by a quarter of a second and reset on every scroll, so it fires
     * once the movement has stopped rather than during it.
     */
    this.scheduleTrim();
    this.updateLostState();
  };

  updateNodeVisibility(
    nodeId: string,
    visibility: FlowNodeData["visibility"]
  ): void {
    const node = this.graphData.nodes.find((candidate) => candidate.id === nodeId);
    if (!node?.parentPageId) return;

    if (visibility) node.visibility = structuredClone(visibility);
    else delete node.visibility;

    /*
     * Berätta först, rita om sedan.
     *
     * `renderNodes()` sänder ett urvalsbyte, och på det fyller editorn
     * egenskapspanelen ur SIN graf. Kom omritningen först var den grafen ännu
     * inte uppdaterad, så panelen skrevs över med det gamla värdet — mätt i
     * spåret:
     *
     *     MUT "one-of"   ← panelen sätter sitt värde
     *     SET "equals"   ← updatePropertiesPanel ← handleSelectionChanged
     *
     * Ändringen nådde alltså grafen hela tiden; det såg bara ut som att fältet
     * hoppade tillbaka, och nästa ändring utgick från fel läge. Det gällde
     * varje ändring i ett sidfälts synlighet, inte bara jämförelsen.
     */
    this.dispatchGraphChanged("node-updated");
    this.renderNodes();
  }
  /**
   * Sets or removes the node's provenance.
   *
   * The tag carries no data — it only says what the node should be called.
   * Removing it therefore loses nothing, and changing it changes only the name.
   * The node's properties are the node's.
   */
  updateNodeTemplate(nodeId: string, template: string | null): void {
    const node = this.graphData.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;

    if (template) node.template = template;
    else delete node.template;

    this.renderNodes();
    // A reason of its own, not "node-updated": this is a completed change and
    // not a keystroke. The live-typing branch defers the bookkeeping and skips
    // the panel, so the picker would have been left showing the old value.
    this.dispatchGraphChanged("node-template-changed");
  }

  updateNodeLayout(
    nodeId: string,
    layout: { columnSpan?: 4 | 6 | 12; breakBefore?: boolean }
  ): void {
    const node = this.graphData.nodes.find((candidate) => candidate.id === nodeId);
    if (!node?.parentPageId) return;

    // Apply only the given fields so width and line break do not erase each other.
    const next = { ...node.layout };
    if (layout.columnSpan !== undefined) next.columnSpan = layout.columnSpan;
    if (layout.breakBefore !== undefined) next.breakBefore = layout.breakBefore;
    node.layout = next;
    this.renderNodes();
    this.dispatchGraphChanged("node-updated");
  }
  /** Flyttar ett Page-barn ett steg upp eller ned i sidans ordning. */
  moveNodeInPage(nodeId: string, direction: "up" | "down"): boolean {
    const node = this.graphData.nodes.find((candidate) => candidate.id === nodeId);
    if (!node?.parentPageId) return false;

    const siblings = this.getPageChildren(node.parentPageId);
    const index = siblings.findIndex((candidate) => candidate.id === nodeId);
    const targetIndex = index + (direction === "up" ? -1 : 1);
    if (index === -1 || targetIndex < 0 || targetIndex >= siblings.length) {
      return false;
    }

    const reordered = [...siblings];
    const sibling = reordered[targetIndex];
    const moved = reordered[index];
    if (!sibling || !moved) return false;
    reordered[index] = sibling;
    reordered[targetIndex] = moved;
    reordered.forEach((child, order) => {
      child.order = order;
    });

    // The line break belongs to the row, not the field: when two fields swap
    // places they also swap break flags so the row structure survives.
    const movedBreak = moved.layout?.breakBefore === true;
    const siblingBreak = sibling.layout?.breakBefore === true;
    if (movedBreak !== siblingBreak) {
      moved.layout = { ...moved.layout, breakBefore: siblingBreak };
      sibling.layout = { ...sibling.layout, breakBefore: movedBreak };
    }

    this.renderNodes();
    this.dispatchGraphChanged("node-updated");
    return true;
  }

  /**
   * Moves a top-level node with the keyboard (arrow keys). Mirrors the mouse
   * drag's position sync but with an offset, and otherwise leaves the DOM alone
   * so focus stays on the node. Page children are moved via moveNodeInPage
   * instead. Returns true if the node moved.
   */
  nudgeNode(nodeId: string, dx: number, dy: number): boolean {
    const nodeData = this.graphData.nodes.find((node) => node.id === nodeId);

    if (!nodeData || nodeData.parentPageId) {
      return false;
    }

    nodeData.position.x = Math.max(0, Math.round(nodeData.position.x + dx));
    nodeData.position.y = Math.max(0, Math.round(nodeData.position.y + dy));

    const nodeElement = this.findNodeElement(nodeId);
    if (nodeElement) {
      placeAt(nodeElement, nodeData.position);
    }

    if (nodeData.type === "page" && !nodeData.parentPageId) {
      const surface = this.root.querySelector<HTMLElement>(
        `.node-editor__page-surface[data-page-id="${nodeData.id}"]`,
      );
      if (surface) {
        placeAt(surface, nodeData.position);
      }

      this.getPageChildren(nodeData.id).forEach((child) => {
        const childElement = this.findNodeElement(child.id);
        const localPosition = this.getPageChildPosition(child);
        if (!childElement) return;
        placeAt(childElement, nodeData.position, localPosition);
      });
    }

    this.ensureWorkspaceBuffer();
    this.scheduleDrawConnections();
    this.dispatchGraphChanged(
      "node-nudged",
      this.text("editor.announce.nodeMoved", { title: this.spokenTitle(nodeData) }),
    );
    return true;
  }

  updateNodeData(nodeId: string, property: string, value: unknown): void {
    const updatedGraph = updateGraphNodeData(
      this.graphData,
      nodeId,
      property,
      value,
    );

    if (updatedGraph === this.graphData) {
      return;
    }

    this.graphData = updatedGraph;

    const nodeData = this.graphData.nodes.find((node) => node.id === nodeId);

    const nodeElement = nodeData ? this.findNodeElement(nodeId) : null;

    if (nodeElement && nodeData) {
      const displayNode = structuredClone(nodeData);
      displayNode.position = this.getNodeCanvasPosition(nodeData);
      nodeElement.previewGraph = this.graphData;
      nodeElement.nodeData = displayNode;
      nodeElement.connectedOutputPortIds = this.graphData.connections
        .filter((connection) => connection.from.nodeId === displayNode.id)
        .map((connection) => connection.from.portId);
      nodeElement.selected = nodeId === this.selectedNodeId;
      this.redrawNodesReferring(nodeData);
    }

    requestAnimationFrame(() => {
      this.drawConnections();
    });

    this.dispatchGraphChanged("node-updated");
  }

  /**
   * The cards that speak of the edited node in its own words (story 077): a
   * field whose condition names its variable — *Visas bara om Kontaktväg är
   * E-post* — and a text with `{{itsVariable}}` drawn as the variable's label.
   * Renaming the question in the panel must reach them, and only them: every
   * keystroke re-drawing every card is what a canvas of a hundred nodes cannot
   * afford, and the rest of the cards have nothing to change.
   */
  private redrawNodesReferring(edited: FlowNodeData): void {
    const variable =
      typeof edited.data.variableName === "string"
        ? edited.data.variableName.trim()
        : "";

    if (!variable) {
      return;
    }

    const mentions = new RegExp(`\\{\\{\\s*${variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`);
    const speaksOf = (node: FlowNodeData): boolean =>
      (node.visibility?.conditions.some((condition) => condition.variableName === variable) ??
        false) ||
      Object.values(node.data).some(
        (value) =>
          (typeof value === "string" && mentions.test(value)) ||
          (isLocalizedTextMap(value) && Object.values(value).some((text) => mentions.test(text))),
      );

    this.graphData.nodes
      .filter((node) => node.id !== edited.id && speaksOf(node))
      .forEach((node) => {
        const element = this.findNodeElement(node.id);
        if (!element) return;
        const displayNode = structuredClone(node);
        displayNode.position = this.getNodeCanvasPosition(node);
        element.previewGraph = this.graphData;
        element.nodeData = displayNode;
      });
  }

  private readonly handleNodeSelect = (
    event: CustomEvent<NodeSelectDetail>,
  ): void => {
    this.selectNode(event.detail.nodeId);
  };

  private readonly handleNodeNudge = (
    event: CustomEvent<NodeNudgeDetail>,
  ): void => {
    const { nodeId, dx, dy } = event.detail;
    // Markera noden så egenskapspanelen följer med tangentbordsflytten.
    if (this.selectedNodeId !== nodeId) {
      this.selectNode(nodeId);
    }
    this.nudgeNode(nodeId, dx, dy);
  };

  private readonly handlePortPointerDown = (
    event: CustomEvent<PortInteractionDetail>,
  ): void => {
    if (!this.canMutate()) {
      return;
    }

    if (this.activeNodeDrag) {
      return;
    }

    const detail = event.detail;

    if (detail.direction !== "output") {
      return;
    }

    this.activeConnection = {
      fromNodeId: detail.nodeId,
      fromPortId: detail.portId,
      fromPortElement: detail.portElement,
      pointerId: detail.pointerId,
      pointerType: detail.pointerType,
    };

    this.snapTarget = null;

    const start = this.getPortCenter(detail.portElement);

    const previewPath = this.getPreviewPath();

    if (!previewPath) {
      return;
    }

    previewPath.dataset.visible = "true";

    previewPath.setAttribute("d", this.createCurve(start, start));
  };

  /**
   * What the canvas allows.
   *
   * `translator` and `readonly` both block everything that changes the graph —
   * including moving a node. `position` is the guide's data, and a translator
   * rearranging it changes the editor's working picture with nothing to show for
   * it but a row of coordinates.
   *
   * Moving about is not moving things: panning, zoom, the minimap and selection
   * work in every mode.
   */
  set editorMode(value: EditorMode) {
    if (this.editorModeValue === value) {
      return;
    }

    this.editorModeValue = value;
    this.closeConnectionMenu();
    this.applyModeToDom();
  }

  /**
   * Puts the mode where a stylesheet can see it.
   *
   * Neither the canvas nor a node carried its mode in the DOM, so no rule could
   * react to it: in read-only `every-field-editor`, 20 of 20 nodes showed the
   * drag grip, 19 port dots stood out, and both page surfaces offered "drop a
   * field here". The one rule this exists for: **cannot change it, draws no
   * handles.**
   *
   * `data-mode` for the canvas's own furniture, `data-readonly` on each node
   * because a node knows nothing of modes and only needs the answer.
   */
  private applyModeToDom(): void {
    this.dataset.mode = this.editorModeValue;
    const readonly = !this.canMutate();
    this.syncVisitorViewToMode();
    this.root.querySelectorAll<FlowNode>("flow-node").forEach((node) => {
      node.toggleAttribute("data-readonly", readonly);
      // A property and not only the attribute: `editable` decides whether the
      // node draws its menu button and its eye at all, and the mode can change
      // after the nodes are already on the canvas.
      node.editable = !readonly;
    });
    this.applyVisitorView();
    this.updateModePlaque();
  }

  /**
   * What the mode says about the eyes, story 064 points 7 and 10.
   *
   * A canvas nobody may change shows the visitor's view everywhere and no way
   * to switch away from it — a button that switches to something you may not
   * touch is the same lie as a grip in a read-only canvas (story 063). And an
   * editing canvas opens with every eye out, so the first thing an author sees
   * is the structure they are there to change.
   */
  private syncVisitorViewToMode(): void {
    this.visitorViewNodeIds = new Set(
      this.canMutate() ? [] : this.visitorViewCandidates,
    );
  }

  get editorMode(): EditorMode {
    return this.editorModeValue;
  }

  private editorModeValue: EditorMode = "readonly";

  /** True when the graph may be changed from the canvas. */
  private canManageTemplatesValue = false;
  /** The node whose routes are being shown, if any. */
  private routeTargetId: string | null = null;

  private canMutate(): boolean {
    return canEditGuide(this.editorModeValue);
  }

  private readonly handleEditorPointerDown = (event: PointerEvent): void => {
    if (!this.canMutate()) {
      return;
    }

    const eventPath = event.composedPath();

    const connectionPath = eventPath.find(
      (element): element is SVGPathElement =>
        element instanceof SVGElement &&
        element.matches("path[data-connection-id]"),
    );

    if (connectionPath) {
      const connectionId = connectionPath.dataset.connectionId;

      if (connectionId) {
        this.selectConnection(connectionId);
      }

      return;
    }

    const clickedNode = eventPath.some(
      (element) => element instanceof FlowNode,
    );

    if (clickedNode) {
      return;
    }

    this.clearSelection();
  };

  private readonly handleNodeDragStart = (
    event: CustomEvent<NodeDragStartDetail>,
  ): void => {
    /*
     * Read-only means read-only, on the canvas too. The menus and the panel
     * were gated on the mode; a drag on a header was not, so a guide that
     * said "cannot be changed here" moved its nodes and reported the change
     * — measured on Johan's iPad 2026-09-01: (0,0) → (120,80), two change
     * events. Story 063 carries the lock that makes this a guide's state.
     */
    if (!this.canMutate()) {
      return;
    }

    if (this.activeConnection) {
      return;
    }

    const node = this.graphData.nodes.find(
      (candidate) => candidate.id === event.detail.nodeId,
    );

    const nodesLayer = this.root.querySelector<HTMLElement>(
      ".node-editor__nodes",
    );

    if (!node || !nodesLayer) {
      return;
    }

    const pointer = this.clientToLocal(
      nodesLayer,
      event.detail.clientX,
      event.detail.clientY,
    );

    const canvasPosition = this.getNodeCanvasPosition(node);
    this.autoPanArmed = false;
    this.autoPanDwellStart = null;
    this.autoPanLastPointer = null;
    this.activeNodeDrag = {
      nodeId: node.id,
      pointerId: event.detail.pointerId,
      offsetX: pointer.x - canvasPosition.x,
      offsetY: pointer.y - canvasPosition.y,
      originalParentPageId: node.parentPageId,
    };

    node.position = canvasPosition;
    this.updatePageDropTarget(canvasPosition, node);

    this.findNodeElement(node.id)?.setAttribute("data-dragging", "");

    const viewport = this.getViewportElement();

    try {
      viewport?.setPointerCapture(event.detail.pointerId);
    } catch {
      // Pointer capture may be missing for synthetic events, but the drag still works.
    }

    viewport?.setAttribute("data-node-dragging", "");
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (
      this.activeNodeDrag &&
      event.pointerId === this.activeNodeDrag.pointerId
    ) {
      this.autoPanDuringNodeDrag(event);
      this.moveNode(event);
      return;
    }

    if (
      !this.activeConnection ||
      event.pointerId !== this.activeConnection.pointerId
    ) {
      return;
    }

    const start = this.getPortCenter(this.activeConnection.fromPortElement);

    const pointerPosition = this.getPointerPosition(event);

    this.snapTarget = this.findClosestInput(pointerPosition);

    const end = this.snapTarget ? this.snapTarget.point : pointerPosition;

    const previewPath = this.getPreviewPath();

    if (!previewPath) {
      return;
    }

    previewPath.dataset.visible = "true";

    previewPath.setAttribute("d", this.createCurve(start, end));
  };

  private autoPanDuringNodeDrag(event: PointerEvent): void {
    const viewport = this.getViewportElement();

    if (!viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const edgeSize = 64;
    const maxSpeed = 32;

    // Auto-pan is armed only once the pointer has been inside the viewport's
    // interior. Otherwise the canvas scrolls away while a palette drag is on its
    // way in over the edge — or while the pointer is still outside the
    // viewport.
    if (!this.autoPanArmed) {
      const inInterior =
        event.clientX >= rect.left + edgeSize &&
        event.clientX <= rect.right - edgeSize &&
        event.clientY >= rect.top + edgeSize &&
        event.clientY <= rect.bottom - edgeSize;

      if (!inInterior) {
        return;
      }

      this.autoPanArmed = true;
    }
    const getSpeed = (pointer: number, start: number, end: number): number => {
      if (pointer < start + edgeSize) {
        return -Math.min(maxSpeed, start + edgeSize - pointer);
      }
      if (pointer > end - edgeSize) {
        return Math.min(maxSpeed, pointer - (end - edgeSize));
      }
      return 0;
    };

    const deltaX = getSpeed(event.clientX, rect.left, rect.right);
    const deltaY = getSpeed(event.clientY, rect.top, rect.bottom);

    if (deltaX === 0 && deltaY === 0) {
      // The pointer is outside the edge zone — reset the threshold.
      this.autoPanDwellStart = null;
      this.autoPanLastPointer = null;
      return;
    }

    const now = performance.now();
    if (this.autoPanDwellStart === null) {
      // Första bilden i kantzonen: starta fördröjningen, panorera inte än.
      this.autoPanDwellStart = now;
      this.autoPanLastPointer = { x: event.clientX, y: event.clientY };
      return;
    }

    const dwellElapsed = now - this.autoPanDwellStart >= AUTO_PAN_DWELL_MS;
    const last = this.autoPanLastPointer;
    // Pan only on the axis where the pointer moves towards the edge (the same
    // sign as the edge velocity), and only once the delay has passed.
    const towardEdge = (delta: number, current: number, previous: number): boolean =>
      delta !== 0 && Math.sign(current - previous) === Math.sign(delta);

    const panX =
      dwellElapsed && last && towardEdge(deltaX, event.clientX, last.x)
        ? deltaX
        : 0;
    const panY =
      dwellElapsed && last && towardEdge(deltaY, event.clientY, last.y)
        ? deltaY
        : 0;

    this.autoPanLastPointer = { x: event.clientX, y: event.clientY };

    if (panX === 0 && panY === 0) {
      return;
    }

    viewport.scrollLeft += panX;
    viewport.scrollTop += panY;
    this.ensureWorkspaceBuffer();
  }

  private readonly handlePortPointerUp = (
    event: CustomEvent<PortInteractionDetail>,
  ): void => {
    if (!this.activeConnection) {
      return;
    }

    const detail = event.detail;

    /*
     * Released on something that is not an input — usually the output it started
     * from, when a browser held on to the pointer.
     *
     * Cancelling outright was wrong: the line may well be resting on a target,
     * and the person let go where they meant to. So the snap decides, exactly as
     * it does when the release reaches the canvas instead. Only a release with
     * nothing in range is a cancellation.
     */
    if (detail.direction !== "input") {
      const snapped = this.snapTarget;

      if (!snapped) {
        this.cancelActiveConnection();
        return;
      }

      this.createConnection({
        id: crypto.randomUUID(),
        from: {
          nodeId: this.activeConnection.fromNodeId,
          portId: this.activeConnection.fromPortId,
        },
        to: { nodeId: snapped.nodeId, portId: snapped.portId },
      });
      this.cancelActiveConnection();
      return;
    }

    this.createConnection({
      id: crypto.randomUUID(),
      from: {
        nodeId: this.activeConnection.fromNodeId,
        portId: this.activeConnection.fromPortId,
      },
      to: {
        nodeId: detail.nodeId,
        portId: detail.portId,
      },
    });

    this.cancelActiveConnection();
  };

  selectNodeById(nodeId: string | null): void {
    this.selectNode(nodeId);
  }

  private connectionDrawPending = false;
  /** The connection just created — pulses once when it is drawn. */
  private justCreatedConnectionId: string | null = null;

  private selectConnection(connectionId: string | null): void {
    this.selectedConnectionId = connectionId;
    this.selectedNodeId = null;

    if (connectionId === null) {
      this.closeConnectionMenu();
    }

    this.updateNodeSelection();
    this.drawConnections();
    this.dispatchSelectionChanged();
  }

  private dispatchSelectionChanged(): void {
    this.dispatchEvent(
      new CustomEvent<SelectionChangedDetail>("selection-changed", {
        detail: {
          nodeId: this.selectedNodeId,
          connectionId: this.selectedConnectionId,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private updateNodeSelection(): void {
    this.root.querySelectorAll<FlowNode>("flow-node").forEach((nodeElement) => {
      nodeElement.selected = nodeElement.nodeId === this.selectedNodeId;
    });
  }

  private selectNode(nodeId: string | null): void {
    this.selectedNodeId = nodeId;
    this.selectedConnectionId = null;
    this.closeConnectionMenu();

    this.updateNodeSelection();
    this.drawConnections();
    this.dispatchSelectionChanged();
  }

  private scheduleDrawConnections(): void {
    if (this.connectionDrawPending) {
      return;
    }

    this.connectionDrawPending = true;

    requestAnimationFrame(() => {
      this.connectionDrawPending = false;
      this.drawConnections();
    });
  }

  private clearSelection(): void {
    this.selectedNodeId = null;
    this.selectedConnectionId = null;

    this.closeConnectionMenu();

    this.updateNodeSelection();
    this.drawConnections();
    this.dispatchSelectionChanged();
  }

  /* -----------------------------------------------------------------------
   * Drag ghost during a palette drag
   *
   * The canvas has `overflow: hidden`. As long as the pointer stays over the
   * palette the node lies mostly outside the visible area and is clipped — 39 of
   * 240 px were visible when measured. It looks as though the node ended up
   * *behind* the panel, but it is clipped, which is why no stacking change
   * helps.
   *
   * The ghost is drawn outside the canvas and follows the pointer, so it is
   * visible that a node is being dragged out before the node itself emerges.
   * -------------------------------------------------------------------- */

  private dragGhost: HTMLElement | null = null;

  private showDragGhost(node: FlowNodeData, clientX: number, clientY: number): void {
    this.hideDragGhost();

    const host = this.root.querySelector<HTMLElement>(".node-editor");

    if (!host) {
      return;
    }

    const ghost = document.createElement("div");
    ghost.className = "node-editor__drag-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.dataset.nodeType = node.type;
    ghost.toggleAttribute("data-ending", isEndingNodeType(node.type));
    ghost.textContent = resolveText(node.data.title, this.activeLocaleValue, "");

    host.append(ghost);
    this.dragGhost = ghost;
    this.moveDragGhost(clientX, clientY);
  }

  /**
   * Moves the ghost and shows it only while the node is clipped. As soon as the
   * node is fully visible it is a better signal than the ghost.
   */
  private moveDragGhost(clientX: number, clientY: number): void {
    const ghost = this.dragGhost;
    const viewport = this.getViewportElement();

    if (!ghost || !viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const outside =
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom;

    ghost.hidden = !outside;
    ghost.style.left = `${clientX + 14}px`;
    ghost.style.top = `${clientY + 14}px`;
  }

  private hideDragGhost(): void {
    this.dragGhost?.remove();
    this.dragGhost = null;
  }

  private moveNode(event: PointerEvent): void {
    this.moveDragGhost(event.clientX, event.clientY);

    const drag = this.activeNodeDrag;

    if (drag) {
      drag.lastPointer = { x: event.clientX, y: event.clientY };
    }
    const nodesLayer = this.root.querySelector<HTMLElement>(
      ".node-editor__nodes",
    );

    if (!drag || !nodesLayer) {
      return;
    }

    const nodeData = this.graphData.nodes.find(
      (node) => node.id === drag.nodeId,
    );

    const nodeElement = this.findNodeElement(drag.nodeId);

    if (!nodeData || !nodeElement) {
      return;
    }

    const pointer = this.clientToLocal(
      nodesLayer,
      event.clientX,
      event.clientY,
    );

    const rawX = pointer.x - drag.offsetX;

    const rawY = pointer.y - drag.offsetY;

    nodeData.position.x = Math.round(rawX);

    nodeData.position.y = Math.round(rawY);

    placeAt(nodeElement, nodeData.position);

    this.updatePageDropTarget(nodeData.position, nodeData);

    if (nodeData.type === "page" && !nodeData.parentPageId) {
      const surface = this.root.querySelector<HTMLElement>(
        `.node-editor__page-surface[data-page-id="${nodeData.id}"]`,
      );
      if (surface) {
        surface.style.left = `${nodeData.position.x}px`;
        surface.style.top = `${nodeData.position.y}px`;
      }

      this.getPageChildren(nodeData.id).forEach((child) => {
        const childElement = this.findNodeElement(child.id);
        const localPosition = this.getPageChildPosition(child);
        if (!childElement) return;
        childElement.style.left = `${nodeData.position.x + localPosition.x}px`;
        childElement.style.top = `${nodeData.position.y + localPosition.y}px`;
      });
    }

    this.ensureWorkspaceBuffer();
    this.scheduleDrawConnections();
  }

  private getPageChildren(pageId: string): FlowNodeData[] {
    return this.graphData.nodes
      .filter((node) => node.parentPageId === pageId)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  }

  /**
   * Stacks a page's fields into rows, on the rows' *measured* heights.
   *
   * A row is as tall as its tallest field, and the next row starts a gap below
   * it. The heights come from `nodeHeights`, filled by `nodeResizeObserver` —
   * a field's height is a consequence of the text it carries and of its
   * visibility row, and neither is in the graph.
   *
   * The loop measure → layout → height → measure settles in one pass: a
   * field's height follows from its column width, and the layout changes only
   * its `y`. Guarded by `guide-editor-page-child-overlap`, which counts the
   * layout passes.
   */
  private getChildLayouts(nodes: FlowNodeData[], contentTop: number): PageChildPlan {
    const layouts = new Map<string, Point>();
    let rowTop = 0;
    let rowHeight = 0;
    let usedColumns = 0;
    let contentHeight = 0;

    const startRow = (): void => {
      rowTop += rowHeight + PAGE_ROW_GAP;
      rowHeight = 0;
      usedColumns = 0;
    };

    nodes.forEach((node) => {
      const span = this.getChildSpan(node);
      if ((this.isFullRowChild(node) || node.layout?.breakBefore) && usedColumns > 0) {
        startRow();
      }
      if (span === 12 && usedColumns > 0) {
        startRow();
      } else if (usedColumns + span > 12) {
        startRow();
      }

      layouts.set(node.id, {
        x: PAGE_CONTENT_LEFT + (usedColumns / 12) * (PAGE_CONTENT_WIDTH + PAGE_COLUMN_GAP),
        y: contentTop + rowTop,
      });
      rowHeight = Math.max(
        rowHeight,
        this.nodeHeights.get(node.id) ?? PAGE_CHILD_FALLBACK_HEIGHT,
      );
      // Taken here rather than after the loop: a row that fills up starts the
      // next one straight away, and its height is gone by then.
      contentHeight = Math.max(contentHeight, rowTop + rowHeight);

      usedColumns += span;
      if (usedColumns >= 12) {
        startRow();
      }
    });

    return { layouts, contentHeight };
  }

  private getPageChildLayouts(pageId: string): Map<string, Point> {
    return this.getChildLayouts(
      this.getPageChildren(pageId),
      this.getPageContentTop(pageId),
    ).layouts;
  }

  /**
   * The top of a page's field area: the measured bottom of its text block plus
   * a gap. `pageIntroBottoms` is filled by `nodeResizeObserver`, which watches
   * the page node's own content box — the block grows when the title wraps, and
   * the node's outer height cannot tell you that, because `--page-height` sets
   * it.
   */
  private getPageContentTop(pageId: string): number {
    return Math.round(
      (this.pageIntroBottoms.get(pageId) ?? PAGE_INTRO_FALLBACK_BOTTOM) +
        PAGE_INTRO_GAP,
    );
  }

  /**
   * The page's children as they would look if the field were inserted at the
   * given slot. The line break belongs to the row: if the field leaves its row
   * start, the next field in the row inherits the break so the row does not
   * collapse.
   */
  private getInsertionSequence(
    pageId: string,
    node: FlowNodeData,
    order: number,
    breakBefore: boolean,
  ): FlowNodeData[] {
    const children = this.getPageChildren(pageId);
    const siblings = children.filter((candidate) => candidate.id !== node.id);
    const currentIndex = children.findIndex((candidate) => candidate.id === node.id);
    const restoresCurrentSlot =
      currentIndex !== -1 &&
      order === currentIndex &&
      breakBefore === (node.layout?.breakBefore === true);

    const sequence = [...siblings];
    if (
      !restoresCurrentSlot &&
      currentIndex !== -1 &&
      node.layout?.breakBefore === true
    ) {
      const successor = sequence[currentIndex];
      if (
        successor &&
        !this.isFullRowChild(successor) &&
        successor.layout?.breakBefore !== true
      ) {
        sequence[currentIndex] = {
          ...successor,
          layout: { ...successor.layout, breakBefore: true },
        };
      }
    }

    const probe: FlowNodeData = {
      ...node,
      layout: { ...node.layout, breakBefore },
    };
    sequence.splice(order, 0, probe);
    return sequence;
  }

  private getPageInsertionLayout(
    pageId: string,
    node: FlowNodeData,
    order: number,
    breakBefore = false
  ): { position: Point; width: number } {
    const sequence = this.getInsertionSequence(pageId, node, order, breakBefore);
    const contentTop = this.getPageContentTop(pageId);
    const position = this.getChildLayouts(sequence, contentTop).layouts.get(node.id) ?? {
      x: PAGE_CONTENT_LEFT,
      y: contentTop,
    };
    return {
      position,
      width: (this.getChildSpan(node) / 12)
        * (PAGE_CONTENT_WIDTH + PAGE_COLUMN_GAP) - PAGE_COLUMN_GAP,
    };
  }

  /** Layoutelement som alltid tar en hel rad i sidan. */
  private isFullRowChild(node: FlowNodeData): boolean {
    return node.type === "page-heading" || node.type === "page-spacer";
  }

  private getChildSpan(node: FlowNodeData): 4 | 6 | 12 {
    if (this.isFullRowChild(node)) return 12;
    return node.layout?.columnSpan === 4 ? 4 : node.layout?.columnSpan === 6 ? 6 : 12;
  }

  private findPageDropSlot(
    page: FlowNodeData,
    node: FlowNodeData,
    center: Point
  ): { order: number; breakBefore: boolean } {
    const siblingCount = this.getPageChildren(page.id).filter(
      (candidate) => candidate.id !== node.id
    ).length;
    let closestSlot = { order: 0, breakBefore: false };
    let closestRowDistance = Number.POSITIVE_INFINITY;
    let closestColumnDistance = Number.POSITIVE_INFINITY;
    let closestIsCurrent = false;

    // The field's current slot: the index among the page's children reproduces
    // the order exactly when the field is reinserted among its siblings (without
    // itself).
    const currentIndex = this.getPageChildren(page.id).findIndex(
      (candidate) => candidate.id === node.id,
    );
    const currentBreak = node.layout?.breakBefore === true;

    for (let order = 0; order <= siblingCount; order += 1) {
      for (const breakBefore of [false, true]) {
        const layout = this.getPageInsertionLayout(page.id, node, order, breakBefore);
        const flowLayout = breakBefore
          ? this.getPageInsertionLayout(page.id, node, order, false)
          : layout;

        // Skip the "new row" candidate when it lands in the same slot anyway.
        if (
          breakBefore &&
          layout.position.x === flowLayout.position.x &&
          layout.position.y === flowLayout.position.y
        ) {
          continue;
        }

        // Row first: pick the row by y distance and only then the slot by x
        // distance, so "drag downwards" lands on a new row even when the slot is
        // furthest to the left.
        const targetX = page.position.x + layout.position.x + layout.width / 2;
        const targetY = page.position.y + layout.position.y + 50;
        const rowDistance = Math.abs(center.y - targetY);
        const columnDistance = Math.abs(center.x - targetX);
        // On an exact tie (several orders give the same "new row" slot):
        // 1. The field's current slot always wins, so nothing moves when you
        //    merely grab the field.
        // 2. Otherwise the later order wins, so the siblings above pack together
        //    when the field is dragged to a new row.
        const isCurrent = order === currentIndex && breakBefore === currentBreak;
        if (
          rowDistance < closestRowDistance ||
          (rowDistance === closestRowDistance && columnDistance < closestColumnDistance) ||
          (rowDistance === closestRowDistance &&
            columnDistance === closestColumnDistance &&
            !closestIsCurrent)
        ) {
          closestRowDistance = rowDistance;
          closestColumnDistance = columnDistance;
          closestIsCurrent = isCurrent;
          closestSlot = { order, breakBefore };
        }
      }
    }

    return closestSlot;
  }
  private getPageChildPosition(node: FlowNodeData): Point {
    if (!node.parentPageId) return { ...node.position };
    return this.getPageChildLayouts(node.parentPageId).get(node.id) ?? {
      x: PAGE_CONTENT_LEFT,
      y: this.getPageContentTop(node.parentPageId),
    };
  }

  private getPageHeight(pageId: string): number {
    return this.getPageHeightFor(
      pageId,
      this.getChildLayouts(
        this.getPageChildren(pageId),
        this.getPageContentTop(pageId),
      ).contentHeight,
    );
  }

  /**
   * The height a page needs for a field area of the given height.
   *
   * The field area used to be counted in rows — `rowCount * PAGE_CHILD_STEP`,
   * derived back out of the `y` values with `Math.round((y - TOP) / STEP)`.
   * With rows as tall as they measure, that division no longer has an answer,
   * so the plan carries the height it laid out.
   */
  private getPageHeightFor(pageId: string, contentHeight: number): number {
    const contentTop = this.getPageContentTop(pageId);
    // The floor is "room for one field", so an empty page is as tall as a page
    // with one — it used to be the constant 414, which was that same sum
    // written out when the field area started at 260.
    return Math.max(
      contentTop + PAGE_CHILD_FALLBACK_HEIGHT + PAGE_BOTTOM_PADDING,
      contentTop + contentHeight + PAGE_BOTTOM_PADDING,
    );
  }

  /** The page's height if the dragged field is dropped at the active slot. */
  private getProspectivePageHeight(
    pageId: string,
    node: FlowNodeData,
    order: number,
    breakBefore: boolean,
  ): number {
    const sequence = this.getInsertionSequence(pageId, node, order, breakBefore);
    return this.getPageHeightFor(
      pageId,
      this.getChildLayouts(sequence, this.getPageContentTop(pageId)).contentHeight,
    );
  }
  private getNodeCanvasPosition(node: FlowNodeData): Point {
    if (!node.parentPageId) {
      return { ...node.position };
    }
    const page = this.graphData.nodes.find(
      (candidate) =>
        candidate.id === node.parentPageId && candidate.type === "page",
    );
    const localPosition = this.getPageChildPosition(node);
    return page
      ? {
          x: page.position.x + localPosition.x,
          y: page.position.y + localPosition.y,
        }
      : { ...node.position };
  }

  private updatePageDropTarget(position: Point, node: FlowNodeData): void {
    const canContain = canNodeTypeBeInPage(node.type);
    const center = { x: position.x + 120, y: position.y + 55 };
    const page = canContain
      ? this.graphData.nodes.find(
          (candidate) =>
            candidate.type === "page" &&
            !candidate.parentPageId &&
            center.x >= candidate.position.x &&
            center.x <= candidate.position.x + PAGE_WIDTH &&
            center.y >= candidate.position.y &&
            // An extra row step at the bottom so fields can be dropped on a
            // new row that the page only grows to after the drop.
            center.y <= candidate.position.y + this.getPageHeight(candidate.id) + PAGE_CHILD_STEP,
        )
      : undefined;
    const nextId = page?.id ?? null;
    const nextSlot = page
      ? this.findPageDropSlot(page, node, center)
      : { order: 0, breakBefore: false };

    if (
      nextId === this.activeDropPageId &&
      nextSlot.order === this.activeDropOrder &&
      nextSlot.breakBefore === this.activeDropBreak
    ) {
      return;
    }
    this.clearPageDropTarget();
    this.activeDropPageId = nextId;
    this.activeDropOrder = nextSlot.order;
    this.activeDropBreak = nextSlot.breakBefore;
    if (nextId) {
      const surface = this.root.querySelector<HTMLElement>(
        `.node-editor__page-surface[data-page-id="${nextId}"]`,
      );
      surface?.setAttribute("data-drop-active", "");
      const insertion = this.getPageInsertionLayout(
        nextId,
        node,
        nextSlot.order,
        nextSlot.breakBefore,
      );
      surface?.style.setProperty("--insertion-left", `${insertion.position.x}px`);
      surface?.style.setProperty("--insertion-top", `${insertion.position.y}px`);
      surface?.style.setProperty("--insertion-width", `${insertion.width}px`);

      // Let the page grow while dragging, so a new row always fits in the area.
      // Never shrink mid-drag — that moves everything under the pointer.
      const prospectiveHeight = Math.max(
        this.getProspectivePageHeight(nextId, node, nextSlot.order, nextSlot.breakBefore),
        this.getPageHeight(nextId),
      );
      if (surface) surface.style.height = `${prospectiveHeight}px`;
      this.findNodeElement(nextId)?.style.setProperty(
        "--page-height",
        `${prospectiveHeight}px`,
      );

      this.previewPageReflow(nextId, node, nextSlot.order, nextSlot.breakBefore);
    }
  }

  /** Flyttar syskonen till sina blivande platser medan man drar. */
  private previewPageReflow(
    pageId: string,
    node: FlowNodeData,
    order: number,
    breakBefore: boolean,
  ): void {
    const page = this.graphData.nodes.find((candidate) => candidate.id === pageId);
    if (!page) return;

    const sequence = this.getInsertionSequence(pageId, node, order, breakBefore);
    const layouts = this.getChildLayouts(
      sequence,
      this.getPageContentTop(pageId),
    ).layouts;

    sequence.forEach((sibling) => {
      if (sibling.id === node.id) return;
      const element = this.findNodeElement(sibling.id);
      const position = layouts.get(sibling.id);
      if (!element || !position) return;
      element.setAttribute("data-reflowing", "");
      element.style.left = `${page.position.x + position.x}px`;
      element.style.top = `${page.position.y + position.y}px`;
    });
  }

  /** Restores the siblings to their real slots when the drop target disappears. */
  private resetPageReflow(pageId: string): void {
    const page = this.graphData.nodes.find((candidate) => candidate.id === pageId);
    if (!page) return;

    this.getPageChildren(pageId).forEach((child) => {
      const element = this.findNodeElement(child.id);
      if (!element || element.hasAttribute("data-dragging")) return;
      const position = this.getPageChildPosition(child);
      element.style.left = `${page.position.x + position.x}px`;
      element.style.top = `${page.position.y + position.y}px`;
    });
  }

  private clearPageDropTarget(): void {
    if (this.activeDropPageId) {
      const height = this.getPageHeight(this.activeDropPageId);
      const surface = this.root.querySelector<HTMLElement>(
        `.node-editor__page-surface[data-page-id="${this.activeDropPageId}"]`,
      );
      if (surface) surface.style.height = `${height}px`;
      this.findNodeElement(this.activeDropPageId)?.style.setProperty(
        "--page-height",
        `${height}px`,
      );
      this.resetPageReflow(this.activeDropPageId);
    }
    this.root
      .querySelectorAll(".node-editor__page-surface[data-drop-active]")
      .forEach((surface) => surface.removeAttribute("data-drop-active"));
    this.activeDropPageId = null;
    this.activeDropOrder = 0;
    this.activeDropBreak = false;
  }
  /**
   * Namnet örat får (story 073): titeln i nodens språk, annars typens namn.
   * Aldrig svar — canvasen berättar om formen, inte om innehållet.
   */
  private spokenTitle(node: FlowNodeData | undefined): string {
    if (!node) return "";
    const title = resolveText(node.data.title, this.activeLocaleValue, "").trim();
    return title || displayNodeTypeLabel(node.type, undefined, this.uiLocale);
  }

  private dispatchGraphChanged(
    reason: GraphChangedDetail["reason"],
    spoken?: string,
  ): void {
    /*
     * Canvasen berättar (story 073): synligt för ögat fanns redan; det här
     * är samma händelse för örat, genom regionen tangentbordsdraget redan
     * talar i. Bara de anrop som skickar en text hörs — en flytt under
     * pekardrag ska inte tjattra för varje pixel.
     */
    if (spoken) {
      this.announce(spoken);
    }

    this.dispatchEvent(
      new CustomEvent<GraphChangedDetail>("graph-changed", {
        detail: {
          graph: this.getData(),
          reason,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private findNodeElement(nodeId: string): FlowNode | null {
    const nodes = Array.from(this.root.querySelectorAll<FlowNode>("flow-node"));

    return nodes.find((node) => node.nodeId === nodeId) ?? null;
  }

  private findClosestInput(pointerPosition: Point): SnapTarget | null {
    const nodeElements = Array.from(
      this.root.querySelectorAll<FlowNode>("flow-node"),
    );

    let closestTarget: SnapTarget | null = null;
    let closestDistance = this.snapRadius();

    nodeElements.forEach((nodeElement) => {
      const nodeData = nodeElement.nodeData;

      if (!nodeData) {
        return;
      }

      const ports = getNodePorts(nodeData, {
        isStart: nodeData.id === this.graphData.startNodeId,
      });

      const inputPorts = ports.filter((port) => port.direction === "input");

      inputPorts.forEach((input) => {
        const portElement = nodeElement.getPortElement("input", input.id);

        if (!portElement) {
          return;
        }

        const point = this.getPortCenter(portElement);

        const distance = Math.hypot(
          pointerPosition.x - point.x,
          pointerPosition.y - point.y,
        );

        if (distance >= closestDistance) {
          return;
        }

        closestDistance = distance;

        closestTarget = {
          nodeId: nodeData.id,
          portId: input.id,
          portElement,
          point,
        };
      });
    });

    return closestTarget;
  }

  /**
   * A soft landing after a drop: the field is FLIP-animated from the drop point
   * to its slot, and page heights animate from the last shown value.
   */
  private settleAfterDrop(
    movedNodeId: string,
    from: { left: number; top: number } | null,
    displayedHeights: Map<string, string>,
  ): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const element = this.findNodeElement(movedNodeId);
    if (element && from && element.hasAttribute("data-page-child")) {
      const deltaX = from.left - (Number.parseFloat(element.style.left) || 0);
      const deltaY = from.top - (Number.parseFloat(element.style.top) || 0);
      if (deltaX !== 0 || deltaY !== 0) {
        element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        requestAnimationFrame(() => {
          element.setAttribute("data-settling", "");
          element.style.transform = "";
          window.setTimeout(() => {
            element.removeAttribute("data-settling");
          }, 220);
        });
      }
    }

    displayedHeights.forEach((height, pageId) => {
      const surface = this.root.querySelector<HTMLElement>(
        `.node-editor__page-surface[data-page-id="${pageId}"]`,
      );
      const pageElement = this.findNodeElement(pageId);
      const target = `${this.getPageHeight(pageId)}px`;
      if (!surface || height === target) return;
      surface.style.height = height;
      pageElement?.style.setProperty("--page-height", height);
      requestAnimationFrame(() => {
        surface.style.height = target;
        pageElement?.style.setProperty("--page-height", target);
      });
    });
  }

  private readonly handleWindowPointerUp = (event: PointerEvent): void => {
    if (
      this.activeNodeDrag &&
      event.pointerId === this.activeNodeDrag.pointerId
    ) {
      const drag = this.activeNodeDrag;
      const movedNodeId = drag.nodeId;

      const viewport = this.getViewportElement();

      if (viewport?.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }

      this.hideDragGhost();

      // A palette drag released outside the canvas is undone.
      //
      // The node is added to the graph already on pointer down, so without this
      // every brush against the palette became a node — placed wherever the drag
      // happened to end, mostly clipped by the canvas edge. Measured, it landed
      // at (-34, -262) with 39 of 240 px visible: not lost, but not something
      // anyone asked for either.
      if (drag.fromPalette && viewport && drag.lastPointer) {
        const rect = viewport.getBoundingClientRect();
        const { x, y } = drag.lastPointer;
        const outside =
          x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;

        if (outside) {
          this.activeNodeDrag = null;
          this.clearPageDropTarget();
          this.removeNodeById(movedNodeId);
          return;
        }
      }

      viewport?.removeAttribute("data-node-dragging");
      this.findNodeElement(movedNodeId)?.removeAttribute("data-dragging");

      const dropPageId = this.activeDropPageId;
      const dropOrder = this.activeDropOrder;
      const dropBreak = this.activeDropBreak;

      // Fånga utgångsläget för drop-animationen innan något ritas om.
      const draggedElement = this.findNodeElement(movedNodeId);
      const settleFrom = draggedElement
        ? {
            left: Number.parseFloat(draggedElement.style.left) || 0,
            top: Number.parseFloat(draggedElement.style.top) || 0,
          }
        : null;
      const displayedHeights = new Map<string, string>();
      new Set(
        [drag.originalParentPageId, dropPageId].filter(
          (pageId): pageId is string => Boolean(pageId),
        ),
      ).forEach((pageId) => {
        const surface = this.root.querySelector<HTMLElement>(
          `.node-editor__page-surface[data-page-id="${pageId}"]`,
        );
        if (surface?.style.height) displayedHeights.set(pageId, surface.style.height);
      });

      this.activeNodeDrag = null;
      this.clearPageDropTarget();

      let movedNode = this.graphData.nodes.find(
        (node) => node.id === movedNodeId,
      );

      // The line break belongs to the row: if the field starting a row is moved
      // away, the next field in the row must inherit the break.
      const originalChildren = drag.originalParentPageId
        ? this.getPageChildren(drag.originalParentPageId)
        : [];
      const originalIndex = originalChildren.findIndex(
        (child) => child.id === movedNodeId,
      );
      const hadBreak = movedNode?.layout?.breakBefore === true;
      const breakHeirId =
        hadBreak && originalIndex !== -1
          ? originalChildren[originalIndex + 1]?.id
          : undefined;
      const transferRowBreak = (): void => {
        if (!breakHeirId) return;
        const heir = this.graphData.nodes.find(
          (candidate) => candidate.id === breakHeirId,
        );
        if (!heir || this.isFullRowChild(heir) || heir.layout?.breakBefore === true) {
          return;
        }
        heir.layout = { ...heir.layout, breakBefore: true };
      };
      const droppedInSameSlot =
        dropPageId === drag.originalParentPageId &&
        dropOrder === originalIndex &&
        dropBreak === hadBreak;

      if (movedNode && dropPageId) {
        const page = this.graphData.nodes.find(
          (node) => node.id === dropPageId,
        );
        if (page) {
          this.graphData = moveNodeToPage(this.graphData, movedNodeId, page.id, {
            x: Math.max(
              20,
              Math.min(
                PAGE_WIDTH - 260,
                movedNode.position.x - page.position.x,
              ),
            ),
            y: Math.max(
              this.getPageContentTop(page.id),
              Math.min(
                this.getPageHeight(page.id) - 120,
                movedNode.position.y - page.position.y,
              ),
            ),
          }, dropOrder);
          const dropped = this.graphData.nodes.find(
            (candidate) => candidate.id === movedNodeId,
          );
          if (dropped?.layout) {
            dropped.layout = { ...dropped.layout, breakBefore: dropBreak };
          }
          if (!droppedInSameSlot) {
            transferRowBreak();
          }
          this.renderNodes();
          const surface = this.root.querySelector<HTMLElement>(
            `.node-editor__page-surface[data-page-id="${page.id}"]`,
          );
          surface?.setAttribute("data-snap-complete", "");
          window.setTimeout(
            () => surface?.removeAttribute("data-snap-complete"),
            360,
          );
        }
      }

      // Subheadings and blank rows may exist only inside a Page. Dropped outside
      // a page they are removed (freshly dragged from the palette) or snapped
      // back into their page (already children) rather than becoming
      // standalone.
      const droppedOutsidePageOnly =
        !dropPageId && movedNode !== undefined && isPageOnlyNodeType(movedNode.type);

      if (droppedOutsidePageOnly && !drag.originalParentPageId) {
        this.graphData = removeGraphNode(this.graphData, movedNodeId);
        this.renderNodes();
        this.dispatchGraphChanged("node-removed");
        return;
      }

      if (
        !dropPageId &&
        drag.originalParentPageId &&
        movedNode &&
        !droppedOutsidePageOnly
      ) {
        this.graphData = removeNodeFromPage(
          this.graphData,
          movedNodeId,
          movedNode.position,
        );
        transferRowBreak();
      }

      if (!dropPageId) {
        this.renderNodes();
      }

      this.settleAfterDrop(movedNodeId, settleFrom, displayedHeights);

      movedNode = this.graphData.nodes.find((node) => node.id === movedNodeId);

      if (movedNode) {
        this.dispatchEvent(
          new CustomEvent("node-moved", {
            detail: {
              nodeId: movedNode.id,
              position: structuredClone(movedNode.position),
            },
            bubbles: true,
            composed: true,
          }),
        );
        this.dispatchGraphChanged("node-moved");
      }
    }

    if (!this.activeConnection) {
      return;
    }

    if (this.snapTarget) {
      this.createConnection({
        id: crypto.randomUUID(),

        from: {
          nodeId: this.activeConnection.fromNodeId,
          portId: this.activeConnection.fromPortId,
        },

        to: {
          nodeId: this.snapTarget.nodeId,
          portId: this.snapTarget.portId,
        },
      });
    }

    this.cancelActiveConnection();
  };

  private createConnection(connection: Connection): void {
    const updatedGraph = addConnection(this.graphData, connection);

    if (updatedGraph === this.graphData) {
      return;
    }

    this.graphData = updatedGraph;
    // Mark the new connection so it pulses once when drawn.
    this.justCreatedConnectionId = connection.id;
    this.scheduleDrawConnections();
    // Ingen egen berättarröst här: portflödet säger redan "klar, X → Y"
    // (editor.canvas.connectDone) med portetiketterna — en andra röst i
    // samma ögonblick vore tjatter (story 073, upptäckt vid bygget).
    this.dispatchGraphChanged("connection-created");

    this.dispatchEvent(
      new CustomEvent<Connection>("connection-created", {
        detail: structuredClone(connection),
        bubbles: true,
        composed: true,
      }),
    );
  }

  private removeConnection(connectionId: string): void {
    const updatedGraph = removeGraphConnection(this.graphData, connectionId);

    if (updatedGraph === this.graphData) {
      return;
    }

    this.graphData = updatedGraph;

    if (this.selectedConnectionId === connectionId) {
      this.selectedConnectionId = null;
    }

    this.drawConnections();
    this.dispatchSelectionChanged();
    this.dispatchGraphChanged(
      "connection-removed",
      this.text("editor.announce.connectionRemoved"),
    );
  }

  /**
   * Colours the port circles after the connections touching them.
   *
   * An entrance port can receive several connections. Colour it after one of
   * them and the choice is arbitrary — which one wins depends on creation order,
   * which nobody sees. The port is therefore coloured only when every connection
   * at it agrees; where two colours meet it stays in the default colour, which
   * is true rather than guessed.
   *
   * The attributes are set directly on the DOM rather than via the nodes' data,
   * so a colour change does not require the nodes to be redrawn. That means it
   * must be re-run after every node render — see the calls in
   * `drawConnections`.
   */
  private applyPortColors(): void {
    /** `nodeId:direction:portId` -> colour, or `false` when they disagree. */
    const perPort = new Map<string, ConnectionColor | null | false>();

    const note = (
      nodeId: string,
      direction: "output" | "input",
      portId: string,
      color: ConnectionColor | null,
    ): void => {
      const key = `${nodeId}:${direction}:${portId}`;
      const seen = perPort.get(key);

      if (seen === undefined) {
        perPort.set(key, color);
        return;
      }

      if (seen !== color) {
        perPort.set(key, false);
      }
    };

    this.graphData.connections.forEach((connection) => {
      const color = connection.color ?? null;
      note(connection.from.nodeId, "output", connection.from.portId, color);
      note(connection.to.nodeId, "input", connection.to.portId, color);
    });

    this.root.querySelectorAll<FlowNode>("flow-node").forEach((nodeElement) => {
      const nodeId = nodeElement.nodeId;

      if (!nodeId) {
        return;
      }

      nodeElement.shadowRoot
        ?.querySelectorAll<HTMLElement>(".flow-node__port")
        .forEach((port) => {
          const portId = port.dataset.portId;
          const direction = port.dataset.portDirection;

          if (!portId || (direction !== "output" && direction !== "input")) {
            return;
          }

          const color = perPort.get(`${nodeId}:${direction}:${portId}`);

          if (color === undefined || color === false || color === null) {
            delete port.dataset.color;
            return;
          }

          port.dataset.color = color;
        });
    });
  }

  /**
   * Sets or clears a connection's colour.
   *
   * The default colour is stored by removing the field, not as `"default"` — a
   * graph that was never coloured should look identical to one where the colour
   * was chosen away.
   */
  private setConnectionColor(
    connectionId: string,
    color: ConnectionColor | null,
  ): void {
    const existing = this.graphData.connections.find(
      (connection) => connection.id === connectionId,
    );

    if (!existing || (existing.color ?? null) === color) {
      return;
    }

    this.graphData = {
      ...this.graphData,
      connections: this.graphData.connections.map((connection) => {
        if (connection.id !== connectionId) {
          return connection;
        }

        if (color === null) {
          const { color: _borttagen, ...utan } = connection;
          return utan;
        }

        return { ...connection, color };
      }),
    };

    this.drawConnections();
    this.dispatchGraphChanged("connection-recolored");
  }

  private cancelActiveConnection(): void {
    this.activeConnection = null;
    this.snapTarget = null;

    const previewPath = this.getPreviewPath();

    if (!previewPath) {
      return;
    }

    previewPath.dataset.visible = "false";
    previewPath.removeAttribute("d");
  }

  private drawConnections(): void {
    const group = this.root.querySelector<SVGGElement>(
      ".node-editor__permanent-connections",
    );

    if (!group) {
      return;
    }

    group.replaceChildren();
    this.updatePortHighlights();
    // Noderna kan ha ritats om sedan sist; märkningen sitter på elementen.
    this.applyNodeIssues();
    this.applyRouteToNodes();
    // The connections are redrawn on every change that moves a node, so that is
    // also the right moment to update the minimap.
    this.updateMinimap();

    const handles: { connection: Connection; at: Point }[] = [];
    const trail =
      this.provingValue && !this.provingValue.stale
        ? new Set(this.provingValue.trailConnectionIds)
        : null;

    this.graphData.connections.forEach((connection) => {
      const fromPort = this.findPortElement(
        connection.from.nodeId,
        "output",
        connection.from.portId,
      );

      const toPort = this.findPortElement(
        connection.to.nodeId,
        "input",
        connection.to.portId,
      );

      if (!fromPort || !toPort) {
        return;
      }

      const start = this.getPortCenter(fromPort);
      const end = this.getPortCenter(toPort);
      const curve = this.createCurve(start, end);

      const hitPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );

      hitPath.classList.add("node-editor__connection-hit");

      hitPath.setAttribute("d", curve);
      hitPath.dataset.connectionId = connection.id;

      const visiblePath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );

      visiblePath.classList.add("node-editor__connection");

      // No arrowhead: on sharply bent curves the rigid marker points the wrong
      // way. The direction is carried by the ports (exit right -> entrance left)
      // and the filled port dots mark the endpoint.
      visiblePath.setAttribute("d", curve);
      visiblePath.dataset.connectionId = connection.id;

      if (connection.color) {
        visiblePath.dataset.color = connection.color;
      }

      /*
       * The same treatment a directly-selected connection already gets
       * (thicker, `--fw-primary-strong`) — Uppdrag 23/9, Del A punkt 5. Never
       * the highlighted route's green: that colour is answering "what leads
       * here" in the prove pane, and a selection is not an answer.
       *
       * `selectNode` clears `selectedConnectionId` (and vice versa via the
       * connection menu), so the two conditions never fight over the same
       * path — a connection cannot be both the selected connection and one
       * of a *different* selected node's edges at once in a way that matters
       * here, since selecting either clears the other kind of selection.
       */
      const onShownRoute = this.highlightedConnectionIds?.has(connection.id) ?? false;

      /*
       * Except on a shown route. Asking for the routes to a node selects it,
       * and the selection's blue has the higher specificity — so the one line
       * *into* the asked node arrived blue while the rest of the route was
       * green (Johan 23/9). There, the route is the answer and the selection
       * says nothing the route does not.
       */
      if (
        !onShownRoute &&
        (connection.id === this.selectedConnectionId ||
          connection.from.nodeId === this.selectedNodeId ||
          connection.to.nodeId === this.selectedNodeId)
      ) {
        visiblePath.classList.add("node-editor__connection--selected");
      }

      /*
       * The only dimming left is the one somebody asked for.
       *
       * Selecting a node used to dim every connection that did not touch it.
       * That fired on a gesture nobody meant as a question, looked exactly like
       * this one, and read as a shown route that had failed to clear. Asking for
       * the routes to a node does the job it was reaching for, on request.
       */
      if (this.highlightedConnectionIds) {
        visiblePath.classList.add(
          this.highlightedConnectionIds.has(connection.id)
            ? "node-editor__connection--highlighted"
            : "node-editor__connection--dimmed",
        );
      }

      /*
       * The trail a run has left (story 065 point 5) — its own attribute, not
       * the shown route's class.
       *
       * They look alike on purpose (green, thicker) and mean different things:
       * a shown route answers "what leads here" and dims everything else to
       * answer it, while a run has to leave the guide ahead in its ordinary
       * colour. And they can be on at once, so one may not overwrite the other.
       */
      if (trail?.has(connection.id)) {
        visiblePath.dataset.trail = "";
      }

      if (connection.id === this.justCreatedConnectionId) {
        visiblePath.classList.add("node-editor__connection--appear");
      }

      group.append(hitPath, visiblePath);
      handles.push({ connection, at: this.curveMidpoint(start, end) });
    });

    this.drawConnectionHandles(handles);

    /*
     * Anteckningslinjerna i sitt eget lager ovanför noderna — se markupen.
     */
    const noteLayer = this.root.querySelector<SVGSVGElement>(".node-editor__note-links");

    if (noteLayer) {
      noteLayer.querySelectorAll(".node-editor__annotation-link").forEach((one) => one.remove());
      this.drawAnnotationLinks(noteLayer);
    }
    this.applyPortColors();

    // The pulse plays once only — the next redraw no longer marks it.
    this.justCreatedConnectionId = null;
  }

  /**
   * Where a connection's handle sits.
   *
   * Derived rather than sampled. `createCurve` puts both control points at the
   * same height as their endpoint and the same distance out, so the cubic's
   * midpoint works out as
   *
   *     (P₀ + 3P₁ + 3P₂ + P₃) / 8
   *
   * and the control distance cancels on both axes — leaving the midpoint of the
   * straight line between the ports. Which means no `getPointAtLength`, no path
   * in the document, and nothing to recompute when the curve's bow changes.
   */
  private curveMidpoint(start: Point, end: Point): Point {
    return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  }

  /**
   * A button on each line, which is the way into a connection's menu.
   *
   * Selecting a connection has always worked with a pointer — `pointerdown` on
   * the line — and a tap is a pointerdown, so a tablet gets that far on its own.
   * What it could not do is reach the menu, because that hung on `contextmenu`
   * alone. This is the missing step, and it serves the keyboard at the same
   * time: the handle joins its **source node's** tab group, exactly as that
   * node's ports already do.
   *
   * That is what keeps it affordable. The canvas holds one node in the tab order
   * at a time, so tabbing gives node → its ports → the lines it owns, and the
   * number of stops never grows with the graph. Forty connections would
   * otherwise be forty tab stops in a row.
   */
  private drawConnectionHandles(
    handles: { connection: Connection; at: Point }[],
  ): void {
    const layer = this.root.querySelector<HTMLElement>(
      ".node-editor__connection-handles",
    );

    if (!layer) {
      return;
    }

    // Nothing to reach in a canvas that cannot be changed: the menu holds only
    // commands that change the graph, so a handle would open an empty box.
    if (!this.canMutate()) {
      layer.replaceChildren();
      return;
    }

    layer.replaceChildren(
      ...handles.map(({ connection, at }) => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "node-editor__connection-handle";
        button.dataset.connectionId = connection.id;
        button.style.left = `${at.x}px`;
        button.style.top = `${at.y}px`;
        button.tabIndex =
          connection.from.nodeId === this.currentNodeId ||
          connection.to.nodeId === this.currentNodeId
            ? 0
            : -1;
        button.toggleAttribute("data-show", this.handleShouldShow(connection));
        button.setAttribute("aria-haspopup", "menu");
        button.setAttribute("aria-label", this.connectionLabel(connection));
        button.title = button.getAttribute("aria-label") ?? "";
        button.textContent = "⋯";

        if (connection.id === this.selectedConnectionId) {
          button.dataset.selected = "";
        }

        button.addEventListener("pointerdown", (event) => event.stopPropagation());
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          this.selectConnection(connection.id);
          this.openContextMenuAt("connection", connection.id, at.x, at.y);
        });

        return button;
      }),
    );
  }

  /**
   * What a screen reader says about a line.
   *
   * "Koppling" alone is useless in a guide with nine of them, so it names both
   * ends the way the connect-by-keyboard announcements already do: the port it
   * leaves and the node it reaches.
   */
  private connectionLabel(connection: Connection): string {
    const target = this.graphData.nodes.find(
      (node) => node.id === connection.to.nodeId,
    );

    const port = this.findPortElement(
      connection.from.nodeId,
      "output",
      connection.from.portId,
    );

    /*
     * The target's name is read off the node element rather than worked out
     * again from its data. That element already resolves a title through the
     * locale, the node type's label and the fallbacks — a second computation
     * here would be a second copy, and the copy that drifts.
     */
    const targetName = this.findNodeElement(connection.to.nodeId)
      ?.shadowRoot?.querySelector(".flow-node")
      ?.getAttribute("aria-label");

    return this.text("editor.canvas.connectionHandle", {
      from: port?.getAttribute("aria-label") ?? connection.from.portId,
      to: targetName ?? target?.id ?? connection.to.nodeId,
    });
  }

  /** Dashed lines from note nodes to the node they point at. */
  private drawAnnotationLinks(group: SVGGElement | SVGSVGElement): void {
    this.graphData.nodes.forEach((node) => {
      if (node.type !== "annotation") {
        return;
      }
      const targetId =
        typeof node.data.targetNodeId === "string" ? node.data.targetNodeId : "";
      if (!targetId || targetId === node.id) {
        return;
      }
      const fromEl = this.findNodeElement(node.id);
      const toEl = this.findNodeElement(targetId);
      if (!fromEl || !toEl) {
        return;
      }
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      const fromC = { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 };
      const toC = { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 };
      const startClient = this.rectEdgePoint(fromRect, toC);
      const endClient = this.rectEdgePoint(toRect, fromC);
      const start = this.clientToWorkspace(startClient.x, startClient.y);
      const end = this.clientToWorkspace(endClient.x, endClient.y);

      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.classList.add("node-editor__annotation-link");
      path.setAttribute("d", `M ${start.x} ${start.y} L ${end.x} ${end.y}`);
      path.setAttribute("marker-end", "url(#node-editor-note-arrow-top)");
      group.append(path);
    });
  }

  /** Punkt på en rektangels kant i riktning mot en yttre punkt. */
  private rectEdgePoint(rect: DOMRect, toward: Point): Point {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = toward.x - cx;
    const dy = toward.y - cy;
    if (dx === 0 && dy === 0) {
      return { x: cx, y: cy };
    }
    const scaleX = dx !== 0 ? rect.width / 2 / Math.abs(dx) : Infinity;
    const scaleY = dy !== 0 ? rect.height / 2 / Math.abs(dy) : Infinity;
    const scale = Math.min(scaleX, scaleY);
    return { x: cx + dx * scale, y: cy + dy * scale };
  }

  private updatePortHighlights(): void {
    const portElements = Array.from(
      this.root.querySelectorAll<FlowNode>("flow-node"),
    ).flatMap((node) =>
      Array.from(
        node.shadowRoot?.querySelectorAll<HTMLElement>(".flow-node__port") ??
          [],
      ),
    );

    /*
     * The green circles are set here; the dimming is not.
     *
     * Every port used to get `--dimmed` while a route was shown. The port row
     * and the node now carry that, and opacity multiplies: node 0.28 × row 0.34
     * × port 0.2 left a port at 0.019, which is invisible. One layer decides.
     */
    portElements.forEach((port) => {
      port.classList.remove(
        "flow-node__port--highlighted",
        "flow-node__port--dimmed",
      );
    });

    if (!this.highlightedConnectionIds) {
      return;
    }

    this.graphData.connections.forEach((connection) => {
      if (!this.highlightedConnectionIds?.has(connection.id)) {
        return;
      }

      const endpoints = [
        this.findPortElement(
          connection.from.nodeId,
          "output",
          connection.from.portId,
        ),
        this.findPortElement(
          connection.to.nodeId,
          "input",
          connection.to.portId,
        ),
      ];

      endpoints.forEach((port) => {
        port?.classList.remove("flow-node__port--dimmed");
        port?.classList.add("flow-node__port--highlighted");
      });
    });
  }

  private findPortElement(
    nodeId: string,
    direction: "input" | "output",
    portId: string,
  ): HTMLElement | null {
    const nodes = Array.from(this.root.querySelectorAll<FlowNode>("flow-node"));

    const node = nodes.find((candidate) => candidate.nodeId === nodeId);

    return node?.getPortElement(direction, portId) ?? null;
  }

  /**
   * Converts a client point to local coordinates in an element inside the
   * workspace. Because the workspace is scaled with `transform: scale(zoom)`,
   * the distance in client px is already multiplied by zoom — which is why we
   * divide it out here. This is the only place the zoom factor enters.
   */
  private clientToLocal(
    element: HTMLElement,
    clientX: number,
    clientY: number,
  ): Point {
    const rect = element.getBoundingClientRect();

    return {
      x: (clientX - rect.left) / this.zoom,
      y: (clientY - rect.top) / this.zoom,
    };
  }

  /** Klientpunkt → arbetsyte-koordinater (samma system som SVG-lagret). */
  private clientToWorkspace(clientX: number, clientY: number): Point {
    const workspace = this.getWorkspaceElement();

    return workspace
      ? this.clientToLocal(workspace, clientX, clientY)
      : { x: 0, y: 0 };
  }

  private getPortCenter(portElement: HTMLElement): Point {
    const portRect = portElement.getBoundingClientRect();

    /*
     * A ring standing on the opened option list gets its line drawn OVER the
     * card (the card is lowered beneath the connection layer), so the curve
     * must stop at the ring's edge — through the centre it would cross the
     * ring's white gap. Everywhere else the centre is the anchor, as always.
     */
    const onList =
      (Number.parseFloat(
        portElement.parentElement?.style.getPropertyValue(
          "--answer-row-inset",
        ) ?? "",
      ) || 0) > 0;

    const point = this.clientToWorkspace(
      onList ? portRect.right : portRect.left + portRect.width / 2,
      portRect.top + portRect.height / 2,
    );

    /*
     * The stroke's round cap reaches 1.5 px past its anchor (stroke 3 px),
     * so anchored AT the edge the cap bit into the ring — measured 2/9
     * against the card-edge case, where the ring hides the line and it
     * emerges exactly at the outer edge. One workspace pixel out leaves
     * half a pixel of cap on the ring's border, same colour, no gap.
     */
    if (onList) {
      point.x += 1;
    }

    return point;
  }

  private getPointerPosition(event: PointerEvent): Point {
    return this.clientToWorkspace(event.clientX, event.clientY);
  }

  /** `minBend` is in the drawing's own pixels; the minimap passes it scaled. */
  private createCurve(start: Point, end: Point, minBend = 90): string {
    const horizontalDistance = Math.abs(end.x - start.x);

    const controlDistance = Math.max(minBend, horizontalDistance * 0.5);

    return [
      `M ${start.x} ${start.y}`,
      `C ${start.x + controlDistance} ${start.y},`,
      `${end.x - controlDistance} ${end.y},`,
      `${end.x} ${end.y}`,
    ].join(" ");
  }

  private observeEditorSize(): void {
    const editor = this.getEditorElement();
    const viewport = this.getViewportElement();

    if (!editor || !viewport) {
      return;
    }

    this.lastViewportSize = {
      width: viewport.clientWidth,
      height: viewport.clientHeight,
    };

    this.resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (this.pendingCenterRestore) {
          // Apply the restored centre once the new size is actually in place;
          // after that the ordinary preservation logic takes over.
          this.centerViewportAt(this.pendingCenterRestore);
        } else {
          /*
           * Compensate for the frame changing, never for our own reflow.
           *
           * Both look identical from in here — the viewport got shorter — but
           * they mean opposite things. A host resizing the editor, or full
           * screen, changes the frame the guide is seen through, and keeping the
           * middle is what stops the view landing somewhere else. The editor's
           * own chrome reflowing changes nothing about the frame: the start-node
           * warning appears, takes 37px out of the canvas, and compensating for
           * that scrolls the guide under the hand of whoever is working. It read
           * as the node jumping the instant it was put down.
           *
           * The element the host controls is the one that answers which is
           * which. Standalone there is no host, and the old behaviour stands.
           */
          const host = this.hostSize();
          const framedChanged =
            !host ||
            !this.lastHostSize ||
            host.width !== this.lastHostSize.width ||
            host.height !== this.lastHostSize.height;

          this.lastHostSize = host;

          if (framedChanged) {
            this.preserveViewportCenterAfterResize();
          } else {
            this.rememberViewportSize();
          }
        }
        this.ensureWorkspaceBuffer();
        this.scheduleDrawConnections();
        /*
         * The lost verdict, re-asked after every size change. The English
         * example page settles over several frames on load — panels, the
         * translation banner, fonts — and the last lost-check used to land in
         * the middle of that, decide "off screen", and never be asked again:
         * "Back to the guide" stood over a fully visible guide. Size changes
         * are exactly the moments the answer can flip, so this is where the
         * question belongs.
         */
        this.updateLostState();
      });
    });

    // Only the editor. The nodes belong to `observeNodeSizes()`, which redraws
    // the lines without touching the viewport centre.
    this.resizeObserver.observe(editor);
  }

  /**
   * Notes the viewport's size. It used to scroll as well, and that was the bug.
   *
   * The idea was reasonable: when the viewport changes size, keep the middle
   * where it was. It came in with full screen, where landing somewhere else in
   * the guide would be jarring.
   *
   * It never ran there. Measured: entering and leaving full screen, this method
   * is called **zero** times, because `restoreViewportCenter` sets
   * `pendingCenterRestore` and the observer prefers it — and the centre comes out
   * at 100,174 either way, with the compensation removed entirely.
   *
   * What it did run for was every incidental reflow. The warning that a guide
   * has no start node is 37px in `grid-row: 1`; it appears the moment the first
   * node is created, the canvas loses those pixels, and this method scrolled by
   * half the difference to keep the middle. On screen the node somebody had just
   * put down appeared to jump about forty pixels. It took a day to find, because
   * the node never moved.
   *
   * So: no scrolling on an incidental resize. The size is still remembered,
   * because `getViewportCenter()` reads it to work out the centre from the size
   * *before* a change — which is exactly what full screen needs.
   */
  /**
   * The size of the element the host actually controls, if there is one.
   *
   * `node-editor` lives inside `guide-editor`'s shadow root, so its own host is
   * the element a page sizes — with `--flowweaver-height`, a flex parent, or by
   * going full screen. Used standalone there is no host, and the answer is null.
   */
  private hostSize(): { width: number; height: number } | null {
    const host = (this.getRootNode() as ShadowRoot | Document | null);
    const element = host && "host" in host ? (host.host as HTMLElement) : null;

    if (!element) {
      return null;
    }

    const box = element.getBoundingClientRect();
    return { width: Math.round(box.width), height: Math.round(box.height) };
  }

  private rememberViewportSize(): void {
    const viewport = this.getViewportElement();

    if (!viewport) {
      return;
    }

    this.lastViewportSize = {
      width: viewport.clientWidth,
      height: viewport.clientHeight,
    };
  }

  /** Keeps the middle where it was. Only for a frame the host changed. */
  private preserveViewportCenterAfterResize(): void {
    const viewport = this.getViewportElement();
    const previousSize = this.lastViewportSize;

    if (!viewport) {
      return;
    }

    const currentSize = {
      width: viewport.clientWidth,
      height: viewport.clientHeight,
    };

    if (
      previousSize &&
      previousSize.width > 0 &&
      previousSize.height > 0 &&
      (previousSize.width !== currentSize.width ||
        previousSize.height !== currentSize.height)
    ) {
      const centerX = viewport.scrollLeft + previousSize.width / 2;
      const centerY = viewport.scrollTop + previousSize.height / 2;

      viewport.scrollLeft = centerX - currentSize.width / 2;
      viewport.scrollTop = centerY - currentSize.height / 2;
    }

    this.lastViewportSize = currentSize;
  }

  private getEditorElement(): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(".node-editor");
  }

  private getPreviewPath(): SVGPathElement | null {
    return this.root.querySelector<SVGPathElement>(
      ".node-editor__connection--preview",
    );
  }

  private readonly handleEditorContextMenu = (event: MouseEvent): void => {
    // The menu offers only things that change the graph.
    if (!this.canMutate()) {
      return;
    }

    const eventPath = event.composedPath();

    const nodeElement = eventPath.find(
      (element): element is FlowNode => element instanceof FlowNode,
    );

    if (nodeElement?.nodeData) {
      event.preventDefault();
      event.stopPropagation();

      this.selectNode(nodeElement.nodeData.id);
      this.openContextMenu("node", nodeElement.nodeData.id, event);
      return;
    }

    const connectionPath = eventPath.find(
      (element): element is SVGPathElement =>
        element instanceof SVGElement &&
        element.matches(".node-editor__connection-hit[data-connection-id]"),
    );

    if (!connectionPath) {
      this.closeConnectionMenu();
      return;
    }

    const connectionId = connectionPath.dataset.connectionId;

    if (!connectionId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.selectConnection(connectionId);

    this.openContextMenu("connection", connectionId, event);
  };

  private openContextMenu(
    kind: ContextMenuState["kind"],
    id: string,
    event: MouseEvent,
  ): void {
    const position = this.clientToWorkspace(event.clientX, event.clientY);

    this.openContextMenuAt(kind, id, position.x, position.y);
  }

  /**
   * The menu, opened at a place rather than at a pointer.
   *
   * Split out because a right-click was the only way in, and **K3 says every
   * interactive function must be reachable from the keyboard**. Five of the
   * menu's commands — start node, show routes, detach template, remove
   * connection, connection colour — exist nowhere else, so without this they
   * could not be reached at all without a mouse. On a tablet they could not be
   * reached at all: iPadOS Safari never fires `contextmenu` for a long press.
   *
   * Coordinates are the workspace's, which is what a node's own `position`
   * already is — so opening on a node needs no conversion, and opening on a
   * pointer converts once, above.
   */
  private openContextMenuAt(
    kind: ContextMenuState["kind"],
    id: string,
    x: number,
    y: number,
  ): void {
    /*
     * Kept relative to the node layer's origin, not as a raw workspace point:
     * the workspace grows and trims around the guide (`ensureWorkspaceBuffer`,
     * the trim), moving the origin and everything on it, and a raw point went
     * stale — measured 28/9: after a growth of 920 × 620 the menu stood at
     * (−920, −620), off the canvas. Inside the scaled layer the stale point had
     * gone unseen; placed in the view's coordinates it could not.
     */
    this.connectionMenu = {
      kind,
      id,
      x: x - this.workspaceGeometry.originX,
      y: y - this.workspaceGeometry.originY,
    };
    this.renderConnectionMenu();
    this.syncMenuButtons();
    this.scrollMenuIntoView();
  }

  /**
   * Brings the menu into the canvas when it opens past an edge.
   *
   * The menu is anchored to what was pressed, and near the right or bottom of a
   * small screen that anchor leaves no room — the menu is then present, correct
   * and half outside. Scrolling rather than moving it keeps the menu attached to
   * its button: both ride in the same scaled layer, so the canvas slides and the
   * two stay together.
   *
   * Only ever scrolls *towards* the menu, and never further than the overflow:
   * a menu taller than the viewport should show its top rather than be chased
   * off the other edge.
   */
  private scrollMenuIntoView(): void {
    const viewport = this.getViewportElement();
    const menu = this.root.querySelector<HTMLElement>(
      ".node-editor__connection-menu",
    );

    if (!viewport || !menu) {
      return;
    }

    const box = menu.getBoundingClientRect();
    const within = viewport.getBoundingClientRect();
    const margin = 8;

    const right = box.right - (within.right - margin);
    const bottom = box.bottom - (within.bottom - margin);
    const left = within.left + margin - box.left;
    const top = within.top + margin - box.top;

    // Overflow on the far side moves the view on; overflow on the near side
    // moves it back, and the near side wins because it holds the anchor.
    if (right > 0) viewport.scrollLeft += right;
    if (bottom > 0) viewport.scrollTop += bottom;
    if (left > 0) viewport.scrollLeft -= left;
    if (top > 0) viewport.scrollTop -= top;
  }

  /**
   * Opens the menu for whatever is selected, from the keyboard.
   *
   * `ContextMenu` is the dedicated key; `Shift+F10` is the equivalent every
   * platform has honoured since long before it, and the one people actually have
   * on a laptop without a menu key.
   *
   * Only nodes for now. A connection cannot be selected without a pointer either
   * — the same gap `docs/KRAV.md` already records for creating and removing them
   * — and pretending otherwise here would hide it.
   */
  private openContextMenuForSelection(): boolean {
    if (!this.canMutate() || !this.selectedNodeId) {
      return false;
    }

    const node = this.graphData.nodes.find(
      (candidate) => candidate.id === this.selectedNodeId,
    );

    const element = node ? this.findNodeElement(node.id) : null;

    if (!node || !element) {
      return false;
    }

    /*
     * Anchored to the button, falling back to the node.
     *
     * The button is what was pressed, so it is where the menu belongs — beside
     * the finger rather than at a corner it may be nowhere near. The node is
     * still the fallback, because the keyboard route can reach a node whose
     * button has not been rendered yet.
     *
     * Measured off the element either way, never computed from `node.position`.
     * The node layer is shifted by the workspace origin and the menu layer is
     * not, so the raw position opened every menu some eight hundred pixels
     * off-screen — present in the document, invisible on the glass.
     * `clientToWorkspace` is the conversion ports and connection handles already
     * use; doing the arithmetic again by hand is what got it wrong.
     */
    const anchor =
      element.shadowRoot?.querySelector<HTMLElement>("[data-node-menu]") ?? element;
    const rect = anchor.getBoundingClientRect();
    const at = this.clientToWorkspace(rect.left, rect.bottom);

    this.openContextMenuAt("node", node.id, at.x, at.y);
    return true;
  }

  removeNodeById(nodeId: string): void {
    const spokenGone = this.spokenTitle(
      this.graphData.nodes.find((node) => node.id === nodeId),
    );
    const updatedGraph = removeGraphNode(this.graphData, nodeId);

    if (updatedGraph === this.graphData) {
      return;
    }

    this.graphData = updatedGraph;

    if (this.selectedNodeId === nodeId) {
      this.selectedNodeId = null;
    }

    this.selectedConnectionId = null;
    this.renderNodes();
    this.dispatchGraphChanged(
      "node-removed",
      this.text("editor.announce.nodeRemoved", { title: spokenGone }),
    );
  }

  /** Duplicerar noden och markerar klonen. */
  duplicateNodeById(nodeId: string): void {
    const result = duplicateGraphNode(this.graphData, nodeId);

    if (!result) {
      return;
    }

    this.graphData = result.graph;
    this.selectedNodeId = result.newNodeId;
    this.selectedConnectionId = null;
    this.renderNodes();
    this.animateNodeAppear(result.newNodeId);
    this.dispatchGraphChanged("node-created");
    this.dispatchSelectionChanged();
  }

  /** Sidans namn som en människa ser det — aldrig ett id i en meny. */
  private pageTitleFor(page: FlowNodeData): string {
    return (
      resolveText(page.data.title, this.uiLocale, "").trim() ||
      this.text("editor.canvas.untitledPage")
    );
  }

  /**
   * Story 034: page membership as a command, not only a drop. The same pure
   * operations the drag uses, reached from the node menu — so a keyboard or a
   * screen reader builds pages with exactly the arithmetic a pointer gets.
   */
  moveNodeToPageById(nodeId: string, pageId: string): void {
    const page = this.graphData.nodes.find(
      (candidate) => candidate.id === pageId && candidate.type === "page",
    );

    if (!page) {
      return;
    }

    const updated = moveNodeToPage(this.graphData, nodeId, pageId, { x: 0, y: 0 });

    if (updated === this.graphData) {
      return;
    }

    this.graphData = updated;
    this.closeConnectionMenu();
    this.renderNodes();
    this.dispatchGraphChanged("node-updated");
    this.announce(
      this.text("editor.canvas.movedToPage", { title: this.pageTitleFor(page) }),
    );
  }

  liftNodeFromPageById(nodeId: string): void {
    const updated = removeNodeFromPage(
      this.graphData,
      nodeId,
      this.getSuggestedNodePosition(),
    );

    if (updated === this.graphData) {
      return;
    }

    this.graphData = updated;
    this.closeConnectionMenu();
    this.renderNodes();
    this.dispatchGraphChanged("node-updated");
    this.announce(this.text("editor.canvas.removedFromPage"));
  }

  /** Skapar och placerar i ett svep — palettens pekarfria väg in i en sida. */
  addNodeToPage(node: FlowNodeData, pageId: string): void {
    const page = this.graphData.nodes.find(
      (candidate) => candidate.id === pageId && candidate.type === "page",
    );

    if (!page) {
      return;
    }

    const withNode = addGraphNode(this.graphData, node);
    const updated = moveNodeToPage(withNode, node.id, pageId, node.position);

    if (updated === this.graphData) {
      return;
    }

    this.graphData = updated;
    this.selectedNodeId = node.id;
    this.selectedConnectionId = null;
    this.renderNodes();
    this.animateNodeAppear(node.id);
    this.dispatchGraphChanged("node-created");
    this.announce(
      this.text("editor.canvas.movedToPage", { title: this.pageTitleFor(page) }),
    );
  }

  setStartNodeById(nodeId: string): void {
    const updatedGraph = setGraphStartNode(this.graphData, nodeId);

    if (updatedGraph === this.graphData) {
      return;
    }

    this.graphData = updatedGraph;
    this.selectedConnectionId = null;
    this.renderNodes();
    this.dispatchGraphChanged("start-node-changed");
  }

  removeConnectionsFromOutput(nodeId: string, portId: string): void {
    const removedConnectionIds = this.graphData.connections
      .filter(
        (connection) =>
          connection.from.nodeId === nodeId &&
          connection.from.portId === portId,
      )
      .map((connection) => connection.id);

    if (removedConnectionIds.length === 0) {
      return;
    }

    this.graphData = removeGraphConnectionsFromOutput(
      this.graphData,
      nodeId,
      portId,
    );

    if (
      this.selectedConnectionId &&
      removedConnectionIds.includes(this.selectedConnectionId)
    ) {
      this.selectedConnectionId = null;
    }

    this.closeConnectionMenu();
    this.drawConnections();
    this.dispatchSelectionChanged();
    this.dispatchGraphChanged("connection-removed");
  }
}

if (!customElements.get("node-editor")) {
  customElements.define("node-editor", NodeEditor);
}

declare global {
  interface HTMLElementTagNameMap {
    "node-editor": NodeEditor;
  }
}

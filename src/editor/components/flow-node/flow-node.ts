/**
 * A node on the canvas — drawn either as its structure or the way a visitor
 * sees it, and the same size either way.
 *
 * ## The eye (story 064)
 *
 * Every node the viewer can draw as a step carries a button in its header. It
 * shows **what you get if you press it**: an eye while the structure is shown,
 * a pencil while the visitor's view is. The *name* changes with the view and
 * there is no `aria-pressed` — a name that changes and a pressed state at once
 * is the same fact read twice, once by the eye and once by a screen reader.
 *
 * The state is one boolean per node and it lives on the **canvas**, never in
 * the guide: nothing here dispatches a change, and the menu's *show them all*
 * is a command that sets each node's, not a second state beside them.
 *
 * ## Why both views are always drawn
 *
 * They sit in one grid cell (`grid-area: 1 / 1`) with the inactive one hidden
 * by `visibility`. The cell is therefore as tall as the taller of the two, and
 * the box does not change when the eye is pressed — ports stand still, lines do
 * not move, and "show them all" cannot push one node over another. Reserving
 * the height from a measurement instead would be the same picture with a number
 * somebody has to keep in step, which is the fault this file has met before
 * (see the reserved port row further down).
 *
 * A page is the one exception, and the reason is in `flow-node.scss`.
 *
 * The details of each piece sit beside the piece: `visitorView`, `stepOf`,
 * `alignPortsToAnswers` and `fieldAt` below, and the grid in the stylesheet.
 */
import { escapeHtml } from "../../../viewer/core/escape-html";
import { nodeSummary } from "../../node-types/node-summaries";
import styles from "./flow-node.scss?inline";

/*
 * Ikonerna är inline-SVG, inte tecken: ett `{}` eller en asterisk ur
 * teckensnittet varierar i bredd och baslinje mellan plattformar, och en
 * etikett som hoppar en pixel ser slarvig ut i en rad av likadana.
 */
/*
 * The eye and the pencil, drawn rather than typed.
 *
 * Same reason as the field labels below: a glyph out of the font varies in
 * width and baseline between platforms, and these two sit next to each other in
 * the same place on every node — one replacing the other. A pixel of drift
 * between them reads as the header twitching every time somebody presses it.
 */
const VIEW_ICONS = {
  eye: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M1.2 8S3.7 3.7 8 3.7 14.8 8 14.8 8 12.3 12.3 8 12.3 1.2 8 1.2 8Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="8" r="2.1" fill="currentColor"/></svg>',
  pencil:
    '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M11.1 1.7 14.3 4.9 5.9 13.3 2 14l.7-3.9z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9.9 3 13 6.1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
};

// The variable's mark, shared with the gap in a card's text (Johan 3/9:
// "blanda in ikonen där med så det blir enhetligt").
const FIELD_LABEL_ICONS = { variable: VARIABLE_ICON };

/**
 * The node's stylesheet, parsed once for every node on the canvas.
 *
 * It used to be written into each shadow root as a `<style>` block, which is
 * the ordinary way and is fine until there are a lot of them. Measured on the
 * advanced editor: 60 nodes took 474 ms to draw, 120 took 1 220, and 250 took
 * 4 492 — worse than doubling when the count doubles. Connections were almost
 * free by comparison (249 of them added 12%), so it was the nodes themselves,
 * and each one was parsing the same twelve kilobytes.
 *
 * A constructed sheet is parsed once and adopted by every root. Same rules,
 * same cascade, one parse.
 *
 * `null` when the browser has no `CSSStyleSheet` constructor — Safari before
 * 16.4, which an iPad can still be on — and then the `<style>` block is written
 * as before. Slower on that device and correct everywhere.
 */
const sharedStyles: CSSStyleSheet | null = (() => {
  try {
    const sheet = new CSSStyleSheet();

    sheet.replaceSync(styles);
    return sheet;
  } catch {
    return null;
  }
})();

import { getNodePorts, getNodeType, isEndingNodeType } from "../../../viewer/node-types/node-type-registry";
import { editableProperties } from "../../node-types/node-properties";
import { getFormat } from "../../../viewer/core/format-registry";
import { calloutKind, readNodeString } from "../../../viewer/node-types/node-fields";
import { displayNodeTypeLabel, templateLabel } from "../../services/template-library";
import { CALLOUT_ICONS, NODE_ICONS } from "../../../viewer/node-types/node-icons";
import { CalculationService } from "../../../viewer/services/calculation-service";
import { FormattedTextService } from "../../../viewer/services/formatted-text-service";
import { PageVisibilityService } from "../../../viewer/services/page-visibility-service";
import { QuestionOptionsService } from "../../../viewer/services/question-options-service";
import { QuestionVariableService } from "../../../viewer/services/question-variable-service";
import { dateBoundVariable } from "../../../viewer/core/date-validator";
import {
  SOURCE_LOCALE,
  isLocalizedTextMap,
  resolveText,
  textDirection,
} from "../../../viewer/core/localized-text";
import { interpolate, t } from "../../localization/editor-ui-strings";
import { drawnAsStep, nodeIdOf, VARIABLE_ICON, variableGaps } from "../../../viewer/components/guide-preview/guide-preview";
import type { GuidePreview } from "../../../viewer/components/guide-preview/guide-preview";
import type { Answers } from "../../../viewer/core/answer-values";

import type { FlowNodeData, GraphData, NodePort, PortDirection } from "../../../viewer/types/graph";
import type {
  NodeDragStartDetail,
  NodeNavigateDetail,
  NodeNudgeDetail,
  NodeSelectDetail,
  PortInteractionDetail,
} from "../../types/events";
import type { NodePropertyDefinition } from "../../../viewer/types/node-types";

export class FlowNode extends HTMLElement {
  /**
   * `data-readonly` bevakas, för läget byts under en nod som redan står ritad.
   *
   * Canvasen växlar attributet på varje nod när läget ändras
   * (`node-editor.ts`) i stället för att rita om dem — och sedan 18/9 avgör det
   * inte bara utseendet utan om portarna är kontroller (`updateTabOrder`).
   * Utan bevakningen hade en nod som fanns när låset togs behållit sina
   * tabbstopp.
   */
  static readonly observedAttributes = ["data-readonly"] as const;

  attributeChangedCallback(name: string): void {
    if (name === "data-readonly") {
      this.updateTabOrder();
    }
  }

  private nodeDataValue: FlowNodeData | null = null;
  private startNodeValue = false;

  private healthValue: { severity: "error" | "warning"; label: string } | null =
    null;

  private readonly root: ShadowRoot;

  constructor() {
    super();

    this.root = this.attachShadow({
      mode: "open",
    });

    if (sharedStyles) {
      this.root.adoptedStyleSheets = [sharedStyles];
    }
  }

  connectedCallback(): void {
    this.render();
  }

  set nodeData(value: FlowNodeData) {
    this.nodeDataValue = structuredClone(value);

    this.render();
  }

  get nodeData(): FlowNodeData | null {
    if (!this.nodeDataValue) {
      return null;
    }

    return structuredClone(this.nodeDataValue);
  }

  /**
   * The node's id, without copying the node to get at it.
   *
   * `nodeData` hands out a `structuredClone` so nobody can reach in and change
   * what the element is holding. That is right, and it is the wrong thing to
   * call when the question is *which element is this*. The canvas asks exactly
   * that, in loops over every node — is this the selected one, find the one
   * with this id — and each answer was costing a deep copy of a whole node.
   *
   * Profiled at 250 nodes: 4 192 ms of 6 850 were inside this getter, plus
   * 1 205 in `structuredClone` beneath it. Sixty per cent of the time to draw a
   * large guide went on copying data nobody read.
   */
  get nodeId(): string | null {
    return this.nodeDataValue?.id ?? null;
  }

  set startNode(value: boolean) {
    this.startNodeValue = value;
    this.render();
  }

  /**
   * Problems concerning this particular node, from `GuideHealthService`.
   *
   * Shown as a marker in the header rather than a band of text in the card, and
   * the change is worth the note.
   *
   * The band said what was wrong on the surface, which reads well and cost
   * three things. It shouted on every half-built node — a question is invalid
   * from the moment it is created, so building anything meant working inside a
   * red card. It only ever showed the first of the node's problems. And it
   * **changed the node's height**: measured, 213 px became 232 when a band
   * appeared, which moved the ports and left the connections drawn to where they
   * used to be. That was a real bug, found by Johan, fixed once by redrawing —
   * a marker of a fixed size in the header means the height no longer moves at
   * all.
   *
   * The reason is not lost. It is the marker's `aria-label` and its `title`, it
   * is part of the node's own accessible name (see `getAccessibleName`), and the
   * check row at the bottom of the canvas still lists every one of them and
   * leads to the node.
   *
   * Severity is carried by shape as well as colour — a circle for an error, a
   * square with soft corners for a warning — because colour alone is not
   * information anybody is required to be able to see (K3 in `docs/KRAV.md`).
   */
  set health(value: { severity: "error" | "warning"; label: string } | null) {
    const unchanged =
      this.healthValue?.severity === value?.severity &&
      this.healthValue?.label === value?.label;

    if (unchanged) {
      return;
    }

    this.healthValue = value;
    this.render();
  }

  private untranslatedValue = false;

  /**
   * Missing translation in the canvas's active language.
   *
   * Rides the health marker's convention (see `health` above) rather than the
   * text chip it used to be: the chip repeated "Saknar översättning" in full
   * on every affected node, which ate the header's width — most visibly when a
   * whole guide is opened under the wrong source language. The host attribute
   * stays, because the yellow ring on the card is what "Nästa oöversatta"
   * jumps between; only the message moved into marker + accessible name.
   */
  set untranslated(value: boolean) {
    if (value === this.untranslatedValue) {
      return;
    }

    this.untranslatedValue = value;
    this.toggleAttribute("data-untranslated", value);
    this.render();
  }

  get untranslated(): boolean {
    return this.untranslatedValue;
  }

  get startNode(): boolean {
    return this.startNodeValue;
  }

  private activeLocaleValue: string = SOURCE_LOCALE;

  /** The language the node is shown in on the canvas; falls back to the source. */
  set activeLocale(value: string) {
    this.activeLocaleValue = value;
    this.render();
  }

  private uiLocale: string = SOURCE_LOCALE;

  /** Localised chrome text in the editor's UI language. */
  private text(key: string, params?: Record<string, string | number>): string {
    const resolved = t(key, this.uiLocale);
    return params ? interpolate(resolved, params) : resolved;
  }

  /** The editor's UI language (chrome) — an axis of its own from the content language. */
  set editorLocale(value: string) {
    if (value === this.uiLocale) {
      return;
    }
    this.uiLocale = value;
    this.render();
  }

  private currentValue = false;

  /**
   * Whether this is the node Tab reaches.
   *
   * Exactly one node in the canvas is in the tab order at a time, along with its
   * own ports; the arrows move which one. Without that, a guide of thirty
   * questions is a hundred-odd tab stops to get past, and the way *around* the
   * canvas never becomes the way anybody uses.
   *
   * Focus still works on any node — `tabindex="-1"` takes something out of the
   * tab order, not out of reach.
   */
  set current(value: boolean) {
    this.currentValue = value;
    this.updateTabOrder();
  }

  get current(): boolean {
    return this.currentValue;
  }

  /**
   * Var tabbstoppet ligger — och att portarna inte är kontroller i läsläge.
   *
   * Kortet självt behåller sitt tabbstopp i varje läge: att läsa grafen med
   * tangentbordet hör till läsandet. Portarna är något annat. De ritas sedan
   * 18/9 också i läsläge, för att en linje som slutar bakom ett kort ser trasig
   * ut (`flow-node.scss`) — men där är de **slutet på en linje och ingen
   * knapp**: Enter på dem skulle be canvasen om en koppling den ändå vägrar
   * (`canMutate`), och en skärmläsare som läser upp *Utgång Ja, knapp* lovar
   * något som inte finns.
   *
   * Därför `-1` och `aria-hidden` i läsläge. Attributet bevakas
   * (`observedAttributes`), för läget byts på en nod som redan står ritad —
   * sidan sätter det när någon annan tar låset.
   */
  private updateTabOrder(): void {
    const readonly = this.hasAttribute("data-readonly");
    const index = this.currentValue ? "0" : "-1";

    this.root.querySelector(".flow-node")?.setAttribute("tabindex", index);
    this.root.querySelectorAll(".flow-node__port").forEach((port) => {
      port.setAttribute("tabindex", readonly ? "-1" : index);
      port.toggleAttribute("aria-hidden", readonly);
    });
    this.root
      .querySelector("[data-visitor-toggle]")
      ?.setAttribute("tabindex", index);
    /*
     * Siv, 1/10: ⋯ saknades här. `set current` (this whole method) runs on
     * every focus move and every selection (node-editor's `makeCurrent`),
     * far more often than a full `render()` — so a node that becomes
     * current without re-rendering kept whatever tabindex the menu button
     * had at its last render, almost always -1. Measured: after selecting
     * a node with Enter and Tab-ing once (to the eye), a second Tab skipped
     * ⋯ entirely and landed on the node's first port. Reachable through
     * `Shift+F10`/`ContextMenu` regardless (K3, node-editor.ts), which is
     * why nothing caught it before — but that path positions the menu at
     * the button without focusing it, so the button's own tooltip (E10,
     * bilaga 5) never showed for a keyboard user who got there that way.
     */
    this.root
      .querySelector("[data-node-menu]")
      ?.setAttribute("tabindex", index);
  }

  private menuOpenValue = false;

  /**
   * Whether this node's menu is open — which the button both shows and says.
   *
   * The glyph turns into a cross and the label changes with it, because a button
   * that opens something should be the same button that closes it. `⋯` on a menu
   * that is already open invites a second press that does nothing visible, and
   * `aria-expanded` is the same fact for anyone who cannot see the glyph.
   */
  set menuOpen(value: boolean) {
    if (value === this.menuOpenValue) {
      return;
    }

    this.menuOpenValue = value;
    this.updateMenuButton();
  }

  get menuOpen(): boolean {
    return this.menuOpenValue;
  }

  /**
   * Patches the button rather than re-rendering the node.
   *
   * A full render replaces the element that was just pressed. Focus goes with
   * it, so a keyboard user could not press the same button again to close what
   * they had opened — and a test measuring the button's position after a click
   * measured a detached element sitting at the origin, 519px from where it looked
   * like it was.
   */
  private updateMenuButton(): void {
    const button = this.root.querySelector<HTMLButtonElement>("[data-node-menu]");

    if (!button) {
      return;
    }

    const label = this.menuButtonLabel();

    button.textContent = this.menuOpenValue ? "✕" : "⋯";
    button.setAttribute("aria-expanded", String(this.menuOpenValue));
    button.setAttribute("aria-label", label);
    button.title = label;
    this.refreshHeaderTooltip();
  }

  private menuButtonLabel(): string {
    return this.text(
      this.menuOpenValue ? "editor.node.menuClose" : "editor.node.menu",
    );
  }

  private visitorViewValue = false;

  /**
   * Whether this node is drawn the way a visitor sees it.
   *
   * One state per node, held by the canvas (story 064) — the menu's *show them
   * all* is a command that sets every node's, not a second state beside them.
   * It is never the guide's: it is not saved, not exported and not inherited by
   * a colleague opening the same file.
   *
   * Mirrored as `data-visitor-view` on the host so the stylesheet can reach it,
   * and patched rather than re-rendered, for the same reason as the menu button
   * below — a full render replaces the button that was just pressed, and focus
   * goes with it.
   */
  set visitorView(value: boolean) {
    if (value === this.visitorViewValue) {
      return;
    }

    this.visitorViewValue = value;
    this.toggleAttribute("data-visitor-view", value);
    this.updateVisitorToggle();
    this.alignPortsToAnswers();
    /*
     * And once more when the frame has been laid out. The preview settles after
     * it is first drawn — measured, the rows sat 3.7 px lower than where they
     * were when the rings were placed, on every option, every time. A second
     * pass costs nothing and is idempotent: the shift already applied is taken
     * back out before the next one is worked out.
     */
    requestAnimationFrame(() => this.alignPortsToAnswers());
  }

  get visitorView(): boolean {
    return this.visitorViewValue;
  }

  /**
   * Whether this node has a visitor's view to switch to.
   *
   * Asked of the viewer, which is the half that knows — a rule, a calculation
   * and a service call are things the guide does between two steps and are
   * never drawn for anybody. A field inside a page has no view of its own
   * either: the page draws it, and the page is the step.
   */
  private canShowVisitorView(node: FlowNodeData): boolean {
    return !node.parentPageId && drawnAsStep(node.type);
  }

  /**
   * The button says what you get if you press it — an eye while the structure
   * is shown, a pencil while the visitor's view is.
   *
   * The name changes and `aria-pressed` is deliberately absent: a name that
   * changes *and* a pressed state is the same fact twice, and a screen reader
   * reads both.
   */
  private visitorToggleLabel(): string {
    return this.text(
      this.visitorViewValue ? "editor.node.structureView" : "editor.node.visitorView",
    );
  }

  private visitorToggleMarkup(): string {
    const label = this.visitorToggleLabel();

    return `${this.visitorViewValue ? VIEW_ICONS.pencil : VIEW_ICONS.eye}<span class="flow-node__visitor-toggle-text">${escapeHtml(label)}</span>`;
  }

  private updateVisitorToggle(): void {
    const button = this.root.querySelector<HTMLButtonElement>(
      "[data-visitor-toggle]",
    );

    if (!button) {
      return;
    }

    const label = this.visitorToggleLabel();

    /*
     * Gone while a run is on, not disabled: every step is drawn the way a
     * visitor sees it then, so the button has nothing to switch to. `hidden`
     * rather than a class, because that is what takes it out of the tab order
     * and out of the accessible tree as well — a control that is there but
     * does nothing is the fault this codebase keeps finding. (A fresh render
     * leaves it out of the markup entirely; this is the patch for a node that
     * is already drawn when the run starts.)
     */
    button.hidden = this.provingValue;
    button.innerHTML = this.visitorToggleMarkup();
    button.setAttribute("aria-label", label);
    button.title = label;
    this.refreshHeaderTooltip();
  }

  private previewGraphValue: GraphData | null = null;

  /**
   * The whole guide — so the node can draw itself the way a visitor sees it,
   * turn a condition's variable into the question's words (story 077), and
   * draw `{{name}}` as the variable's label. Every node gets it; whether a
   * step is drawn is the node's own call (`canShowVisitorView`).
   *
   * Handed over by the canvas, which owns it, and held by reference rather than
   * copied: `nodeData` clones because anybody may reach into a node and change
   * it, but this is read once on the way into `guide-preview`, which takes its
   * own copy through the migration door. Cloning it per node would be one deep
   * copy of the guide for every node on the canvas.
   */
  set previewGraph(value: GraphData | null) {
    if (value === this.previewGraphValue) {
      return;
    }

    this.previewGraphValue = value;
    this.render();
  }

  /**
   * Hands the node's own step to the preview inside it.
   *
   * `showNode` moves the viewer's engine to this node and draws it — a page
   * child becomes a highlighted field on its page, which is why only a
   * standalone node ever gets a preview of its own.
   *
   * `customElements.upgrade` first: the element is written as markup into the
   * shadow root, and a root that is not connected yet does not upgrade its
   * children — the element would still be an `HTMLElement` with no `showNode`
   * on it, which throws rather than degrades.
   */
  private mountVisitorPreview(node: FlowNodeData): void {
    const preview = this.visitorPreview();
    const graph = this.previewGraphValue;

    if (!preview || !graph) {
      return;
    }

    customElements.upgrade(preview);
    /*
     * No variable inspector and no answer history in a node. Both are the
     * author's tools and live in the panel; the node draws what a visitor sees
     * (story 064 point 2). Invisible until story 065 gave a node real answers
     * to list — with none, the inspector renders nothing at all.
     */
    preview.variableInspectorEnabled = false;
    preview.connectedPortIds = this.connectedOutputPortIdsValue;
    preview.graph = this.stepOf(node, graph);
    preview.showNode(node.id);
    this.observeVisitorPreview(preview);
    this.alignPortsToAnswers();
    requestAnimationFrame(() => this.alignPortsToAnswers());
  }

  /**
   * The guide the node's own preview is given: usually just this step.
   *
   * A viewer needs the whole guide; a *picture of one step* does not. Handing
   * every node the whole graph made the cost of drawing a canvas grow with the
   * square of the guide — measured on a 250-node guide, the canvas's own scale
   * gate went from a ratio of 9 to 35 where 16 is the line, because each of the
   * 250 previews migrated and copied all 250 nodes.
   *
   * So a node gets itself and, if it is a page, its own fields. The exception is
   * a step whose text quotes the guide — `{{applicantName}}` in a result — which
   * needs the questions behind those names to say what they are called. Those
   * are a handful in a real guide, and none in a synthetic one.
   *
   * What the trimmed graph loses is the connections, so the viewer cannot tell
   * that the step after this one submits: the button says *Nästa* where the real
   * viewer would say *Skicka*. Worth the trade, and written down rather than
   * hidden — the button in this picture does nothing either way.
   */
  private stepOf(node: FlowNodeData, graph: GraphData): GraphData {
    const children = graph.nodes.filter(
      (candidate) => candidate.parentPageId === node.id,
    );
    const quotesTheGuide = [node, ...children].some((one) =>
      JSON.stringify(one.data).includes("{{"),
    );

    if (quotesTheGuide) {
      return graph;
    }

    return {
      ...graph,
      startNodeId: node.id,
      nodes: [node, ...children],
      connections: [],
    };
  }

  private previewObserver: ResizeObserver | null = null;

  /**
   * The exit rings follow the rows they belong to, and rows move.
   *
   * A long option label wraps at one width and not at another, and the preview
   * settles a frame after it is drawn. Aligning once on render put the rings
   * where the rows were before the text had laid out.
   */
  private observeVisitorPreview(preview: GuidePreview): void {
    this.previewObserver?.disconnect();
    this.previewObserver = new ResizeObserver(() => this.alignPortsToAnswers());
    this.previewObserver.observe(preview);
  }

  /**
   * "The answer is the port": each option's exit ring sits at its own row.
   *
   * Story 064 point 3. The rows are read out of the preview's shadow DOM, where
   * they already carry `data-option-id` — and that id **is** the output port's
   * id, so the two line up without either side describing the other a second
   * time. A `data-` attribute or an event exposed per option would have been a
   * second description of the same fact (PRAXIS 15).
   *
   * Only while the visitor's view is the one being shown. With the pencil the
   * ports go back to their rows at the bottom of the card, which is where the
   * structure view's own layout puts them.
   */
  private alignPortsToAnswers(): void {
    const card = this.root.querySelector<HTMLElement>(".flow-node");
    const preview = this.root.querySelector<GuidePreview>("[data-visitor-preview]");

    if (!card) {
      return;
    }

    const middles = new Map<string, { middle: number; right?: number }>();

    if (this.visitorViewValue && preview) {
      preview.shadowRoot
        ?.querySelectorAll<HTMLElement>("[data-option-id]")
        .forEach((option) => {
          const row = option.closest("label") ?? option;
          const box = row.getBoundingClientRect();

          if (box.height === 0) return;
          /*
           * A row inside an open option list also lends the ring its right
           * edge: the ring sits ON the list, not on the card ("dra in
           * portarna, sätt dem på listan", Johan 2/9). Radio rows keep the
           * card edge — that placement was approved as it stands.
           */
          const inList = option.closest(".guide-preview__open-list") !== null;
          middles.set(option.dataset.optionId ?? "", {
            middle: box.top + box.height / 2,
            right: inList ? box.right : undefined,
          });
        });
    }

    let moved = false;
    let anyInset = false;
    const unpaired: HTMLElement[] = [];
    /*
     * Screen px are not card px: the canvas is scaled by the zoom, and a
     * shift measured on screen but set as a CSS length lands short of the
     * row (at zoom 0.5 by half). It was hidden by repetition — each rerun
     * took half the remaining distance, so after a few observer ticks the
     * ring was within 4 px, and after a zoom change it happened to get
     * enough reruns to reach 0. Measured 7/9 in flow-node-ports-at-zoom.
     * Every distance below is divided by the scale once, and every applied
     * value multiplied back when compared on screen.
     */
    const scale = card.offsetWidth > 0 ? card.getBoundingClientRect().width / card.offsetWidth : 1;

    this.root
      .querySelectorAll<HTMLElement>(".flow-node__port-row--output")
      .forEach((row) => {
        const port = row.querySelector<HTMLElement>("[data-port-id]");
        const portId = port?.dataset.portId;
        const target = portId === undefined ? undefined : middles.get(portId);

        if (!port || target === undefined) {
          unpaired.push(row);
          return;
        }

        /*
         * A shift, not a place. The row stays exactly where the card's own
         * layout put it — take it out of the flow and the card loses that row's
         * height, which is the one thing story 064 point 8 forbids (measured:
         * 748 px became 616). Only the ring moves, and `transform` is the one
         * way to move something without the layout noticing.
         *
         * Measured against the ring itself rather than against the row it sits
         * in: the two centres are not the same, and using the row's left every
         * exit 3.7 px above its answer. The shift already applied is taken back
         * out first, so running this again lands on the same number rather than
         * drifting a little further each time.
         */
        const applied =
          Number.parseFloat(row.style.getPropertyValue("--answer-row-shift")) || 0;
        const appliedInset =
          Number.parseFloat(row.style.getPropertyValue("--answer-row-inset")) || 0;
        const box = port.getBoundingClientRect();
        const resting = box.top + box.height / 2 - applied * scale;

        const shift = (target.middle - resting) / scale;

        if (Math.abs(shift - applied) > 0.5) moved = true;
        row.style.setProperty("--answer-row-shift", `${shift}px`);

        /* The inset moves the ring LEFT onto the list's right border; the
           applied inset is taken back out the same way as the shift. */
        const restingCenterX = box.left + box.width / 2 + appliedInset * scale;
        const inset = target.right === undefined ? 0 : (restingCenterX - target.right) / scale;

        if (Math.abs(inset - appliedInset) > 0.5) moved = true;
        if (inset === 0) row.style.removeProperty("--answer-row-inset");
        else row.style.setProperty("--answer-row-inset", `${inset}px`);
        if (inset > 0) anyInset = true;
        row.setAttribute("data-answer-row", "");
        row.removeAttribute("data-more-port");
        row.removeAttribute("data-more-count");
      });

    /*
     * The canvas draws its lines from the ports' live rectangles, and its
     * redraws on a toggle run before these shifts settle — a transform wakes
     * no ResizeObserver, so nothing else would ask again. Seen 2/9: after the
     * pencil the lines stayed bunched at the answers' rows until something
     * was dragged. Only when a ring actually moved, or every toggle would
     * redraw the canvas for nothing.
     */
    /*
     * Samlingsporten (Johans idé 2/9, i stället för en bricka under kortet):
     * a port whose option hides behind "N fler" has no row of its own — its
     * ring stacks ON the fler row instead, drawn grey with a count badge
     * like a mail icon's unread number. A line from a hidden option lands
     * there, and reads as "one of the N more". Without an open list nothing
     * is unpaired on purpose: the single continue port never had a row.
     */
    const moreRow = preview?.shadowRoot?.querySelector<HTMLElement>(
      "[data-open-list-more]",
    );
    const moreBox =
      this.visitorViewValue && moreRow ? moreRow.getBoundingClientRect() : null;

    const stayed: HTMLElement[] = [
      ...this.root.querySelectorAll<HTMLElement>(".flow-node__port-row--input"),
    ];

    unpaired.forEach((row) => {
      const port = row.querySelector<HTMLElement>("[data-port-id]");

      if (!port || !moreBox || moreBox.height === 0) {
        if (row.hasAttribute("data-answer-row")) moved = true;
        row.removeAttribute("data-answer-row");
        row.removeAttribute("data-more-port");
        row.removeAttribute("data-more-count");
        port?.removeAttribute("data-more-count");
        row.style.removeProperty("--answer-row-inset");
        stayed.push(row);
        return;
      }

      const applied =
        Number.parseFloat(row.style.getPropertyValue("--answer-row-shift")) || 0;
      const appliedInset =
        Number.parseFloat(row.style.getPropertyValue("--answer-row-inset")) || 0;
      const box = port.getBoundingClientRect();
      const shift =
        (moreBox.top + moreBox.height / 2 - (box.top + box.height / 2 - applied * scale)) / scale;
      const inset = (box.left + box.width / 2 + appliedInset * scale - moreBox.right) / scale;

      if (Math.abs(shift - applied) > 0.5 || Math.abs(inset - appliedInset) > 0.5) {
        moved = true;
      }
      row.style.setProperty("--answer-row-shift", `${shift}px`);
      row.style.setProperty("--answer-row-inset", `${inset}px`);
      row.setAttribute("data-answer-row", "");
      row.setAttribute("data-more-port", "");

      /*
       * Brickan med antalet sitter på den SIST ritade av de staplade
       * ringarna — en senare DOM-granne målas ovanpå, och på den första
       * stack brickan halvt bakom grannens ring (bild 2/9).
       */
      const last = row === unpaired[unpaired.length - 1];
      if (last) {
        row.setAttribute("data-more-count", String(unpaired.length));
        port.setAttribute("data-more-count", String(unpaired.length));
      } else {
        row.removeAttribute("data-more-count");
        port.removeAttribute("data-more-count");
      }
    });

    /*
     * Rings on the opened list mean the LINES must be drawn over this card:
     * the canvas lowers a card with this attribute beneath the connection
     * layer, so the real curve reaches the ring in its own colour and its
     * own angle — no stub, no joint (Johans idé 2/9).
     */
    this.toggleAttribute("data-ports-on-list", anyInset);
    if (this.keepRingsInside(stayed, preview, scale)) moved = true;

    if (moved) {
      this.dispatchEvent(
        new CustomEvent("node-ports-moved", { bubbles: true, composed: true }),
      );
    }
  }

  /**
   * A ring that has no row to go to still stays on the card.
   *
   * With the eye lit the card shrinks to the visitor's view while the port
   * rows keep the y the structure gave them — so the lines stand still. A
   * ring with no answer row to move to was left there even when the card no
   * longer reached it: on the film Räkna medan man svarar the structure
   * wraps "Avgiften blir [Avgift per månad] kr i månaden." over two lines
   * with the chip, the run resolves it to one, and the result's entry ring
   * hung 22 px under the card with the line ending in the air (Johan's
   * still, 7/9, a red arrow at the ring).
   *
   * Johan's call: not a floor under the card ("kortet går aldrig under sin
   * sista ring" left 40 px of nothing under a result) but the ring moves up
   * onto the card and the line is drawn again. So a ring below the view's
   * bottom is lifted to sit inside it — the same `transform` as an answer
   * ring, and the same `node-ports-moved` for the canvas. Rings the card
   * still reaches do not move. In the card's own units, like the shifts
   * above. Pages are placed by `--page-height` and are left alone.
   */
  private keepRingsInside(
    rows: HTMLElement[],
    preview: GuidePreview | null,
    scale: number,
  ): boolean {
    const inside =
      this.visitorViewValue && preview && !this.hasAttribute("data-page-container")
        ? preview.getBoundingClientRect()
        : null;
    let moved = false;

    rows.forEach((row) => {
      const port = row.querySelector<HTMLElement>("[data-port-id]");
      const applied =
        Number.parseFloat(row.style.getPropertyValue("--answer-row-shift")) || 0;
      let shift = 0;

      if (port && inside && inside.height > 0) {
        const box = port.getBoundingClientRect();
        const resting = box.top + box.height / 2 - applied * scale;
        const lowest = inside.bottom - box.height / 2;

        if (resting > lowest) shift = (lowest - resting) / scale;
      }

      if (Math.abs(shift - applied) > 0.5) moved = true;
      if (shift === 0) {
        row.style.removeProperty("--answer-row-shift");
        row.removeAttribute("data-kept-inside");
      } else {
        row.style.setProperty("--answer-row-shift", `${shift}px`);
        row.setAttribute("data-kept-inside", "");
      }
    });

    return moved;
  }

  /**
   * Which page field is under a point, out of the preview's own rectangles.
   *
   * The preview is `inert`, which is the only one of the three ways measured on
   * 2026-09-01 that takes the whole thing out of the tab order — and an inert
   * subtree takes no part in hit testing either, so neither the click nor
   * `elementFromPoint` can name the field. The rectangles are still real, and
   * the node measures them anyway for the ports above.
   */
  private fieldAt(x: number, y: number): string | null {
    const preview = this.root.querySelector<GuidePreview>("[data-visitor-preview]");

    if (!this.visitorViewValue || !preview) {
      return null;
    }

    const fields =
      preview.shadowRoot?.querySelectorAll<HTMLElement>(
        "[data-page-field-id], [data-page-heading-id]",
      ) ?? [];

    for (const field of fields) {
      const box = field.getBoundingClientRect();

      if (box.width === 0 || box.height === 0) continue;
      if (x < box.left || x > box.right || y < box.top || y > box.bottom) continue;

      // On a page that repeats the key carries the record (`f-year#1`);
      // the panel wants the node.
      const key = field.dataset.pageFieldId ?? field.dataset.pageHeadingId ?? null;
      return key === null ? null : nodeIdOf(key);
    }

    return null;
  }

  private editableValue = false;

  /**
   * Whether the canvas may be changed — which decides if the menu button exists.
   *
   * The menu offers only commands that change the graph, so in a read-only
   * canvas the button would open something with nothing in it. It is left out of
   * the markup entirely rather than disabled: a control that is present and inert
   * is the fault this codebase keeps finding, and a hidden one still sits in the
   * accessibility tree unless something takes it out.
   */
  set editable(value: boolean) {
    if (value === this.editableValue) {
      return;
    }

    this.editableValue = value;
    this.render();
  }

  get editable(): boolean {
    return this.editableValue;
  }

  private selectedValue = false;

  set selected(value: boolean) {
    this.selectedValue = value;
    this.updateSelectedState();
  }

  get selected(): boolean {
    return this.selectedValue;
  }

  private routeValue: { ports: string[]; onRoute: boolean } | null = null;

  /**
   * Which of this node's ports lie on the route being shown.
   *
   * `null` means no route is being shown and nothing is dimmed — the ordinary
   * state. A value dims everything *not* on the route: the whole node when it is
   * not on it at all, and otherwise the port rows that are not.
   *
   * A port row carries both the answer's label and its circle, so dimming the
   * row answers the question the ports raise. "Ja leads here, Nej does not" is
   * the whole point, and a lit line ending at an unlit answer would say half of
   * it.
   *
   * Applied over the rendered node rather than built into it, so showing a route
   * does not re-render every node — and re-applied at the end of `render()` so a
   * node that redraws for its own reasons does not lose the marking.
   */
  set route(value: { ports: string[]; onRoute: boolean } | null) {
    this.routeValue = value;
    this.applyRoute();
  }

  get route(): { ports: string[]; onRoute: boolean } | null {
    return this.routeValue;
  }

  private applyRoute(): void {
    const wrapper = this.root.querySelector<HTMLElement>(".flow-node");
    const route = this.routeValue;
    const nodeIsOff = route !== null && !route.onRoute;

    wrapper?.toggleAttribute("data-off-route", nodeIsOff);

    /*
     * One dimming at a time. Opacity multiplies down the tree, so a node at 0.28
     * with a row at 0.34 inside it left the row at 0.095 — and with the port's
     * own dimming on top of that, measured, 0.019. Ports vanished completely on
     * every result the route did not pass through, which reads as a rendering
     * fault rather than an answer.
     *
     * A node that is off the route is already saying everything about its rows,
     * so they are left alone. Rows are marked only on a node that *is* on it,
     * where the difference between one answer and another is the point.
     */
    this.root
      .querySelectorAll<HTMLElement>(".flow-node__port-row")
      .forEach((row) => {
        const portId = row.querySelector<HTMLElement>("[data-port-id]")?.dataset
          .portId;

        row.toggleAttribute(
          "data-off-route",
          route !== null &&
            !nodeIsOff &&
            portId !== undefined &&
            !route.ports.includes(portId),
        );
      });
  }

  private provingValue = false;
  private provingCurrentValue = false;
  private provingAnsweredValue = false;
  private trailValue: string[] | null = null;

  /**
   * Whether a run of the guide is going on (story 065).
   *
   * All three of these are mirrored as attributes and patched onto the rendered
   * node rather than re-rendering it: a run touches every node on the canvas at
   * every step, and redrawing them all would replace the very field somebody is
   * typing in.
   *
   * `data-current` and not `data-proving-current`, which reads better but is
   * not what the story asks for. Note that the element's own `current` property
   * is a different fact entirely — it is the roving tab stop — and carries no
   * attribute, so the two never meet in the DOM.
   */
  set proving(value: boolean) {
    if (value === this.provingValue) return;

    this.provingValue = value;
    this.toggleAttribute("data-proving", value);
    this.applyProvingHeader();
    this.updateVisitorToggle();
    this.applyProvingHeader();
  }

  get proving(): boolean {
    return this.provingValue;
  }

  /** The step the run is standing on: the frame and the "Du är här" label. */
  set provingCurrent(value: boolean) {
    if (value === this.provingCurrentValue) return;

    this.provingCurrentValue = value;
    this.toggleAttribute("data-current", value);
    this.applyProvingHeader();
    this.applyLiveStep();
  }

  get provingCurrent(): boolean {
    return this.provingCurrentValue;
  }

  private provingStepValue: number | null = null;

  /**
   * The run's number for this step, shown on the edge where START usually
   * sits: "Steg 2". Null when the run has not reached the node (or is not on).
   */
  set provingStep(value: number | null) {
    if (value === this.provingStepValue) return;

    this.provingStepValue = value;

    if (value === null) {
      this.removeAttribute("data-step");
    } else {
      this.setAttribute("data-step", String(value));
    }

    this.applyProvingHeader();
  }

  get provingStep(): number | null {
    return this.provingStepValue;
  }

  /** A step the run has been through: the tick, dimmed, the answer still in it. */
  set provingAnswered(value: boolean) {
    if (value === this.provingAnsweredValue) return;

    this.provingAnsweredValue = value;
    this.toggleAttribute("data-answered", value);
    this.applyProvingHeader();
  }

  private connectedOutputPortIdsValue: string[] | null = null;

  /** The canvas says which exits have lines; the preview's cap needs it. */
  set connectedOutputPortIds(value: string[] | null) {
    if (
      JSON.stringify(value) === JSON.stringify(this.connectedOutputPortIdsValue)
    ) {
      return;
    }
    this.connectedOutputPortIdsValue = value;
    this.applyLiveStep();
  }

  private provingSourceValue: GuidePreview | null = null;

  /**
   * The preview whose engine this node's live step draws (story 065).
   *
   * The canvas passes it down; only the node the run is standing on ever uses
   * it. Held as a reference to the element rather than to the engine, so the
   * engine itself stays private to `guide-preview` — the borrowing is one
   * method call between two of the same component.
   */
  set provingSource(value: GuidePreview | null) {
    if (value === this.provingSourceValue) return;

    this.provingSourceValue = value;
    this.applyLiveStep();
  }

  get provingSource(): GuidePreview | null {
    return this.provingSourceValue;
  }

  private provingAnswersValue: Answers | null = null;

  /**
   * The run's answers, so a step already answered still shows what was said.
   *
   * Only for the picture: the node the run stands on draws the engine itself
   * and never needs this. See `seedAnswers` on the engine for why a picture is
   * allowed its own one-step engine at all.
   */
  set provingAnswers(value: Answers | null) {
    this.provingAnswersValue = value;
    this.applySeededAnswers();
  }

  /**
   * The step the run is standing on is drawn LIVE — the same engine as the
   * panel, and pressable.
   *
   * Off `inert`, which is what story 064 uses to make every other node's
   * preview a picture; and `proving`, which tells the viewer to hide a
   * conditional field whose rule does not hold — a run shows what the visitor
   * gets, where the eye shows the author everything (story 065 point 7).
   *
   * When the run leaves the node, the preview is handed back its own one-step
   * graph and goes back to being a picture.
   */
  private applyLiveStep(): void {
    const preview = this.visitorPreview();
    const node = this.nodeDataValue;

    if (!preview) {
      return;
    }

    if (this.provingCurrentValue && this.provingSourceValue) {
      /*
       * `proving` FIRST, then the draw. It was the other way round, and the
       * first drawing of every step therefore knew nothing about the run: the
       * file step offered the machine's file picker until its own refusal
       * redrew it, and the map step — which has no refusal to redraw it, only
       * a "Nästa" that stays off — never showed the run's button at all, so
       * the run could not leave the step. The viewer also watches the
       * attribute now (`observedAttributes`), so a caller that gets this order
       * wrong is corrected rather than obeyed; this line is what keeps the
       * ordinary path down to one drawing.
       */
      preview.setAttribute("proving", "");
      preview.mirror(this.provingSourceValue);
      preview.removeAttribute("inert");
      return;
    }

    preview.removeAttribute("proving");
    preview.setAttribute("inert", "");

    if (node && this.previewGraphValue) {
      preview.mirror(null);
      preview.connectedPortIds = this.connectedOutputPortIdsValue;
    preview.graph = this.stepOf(node, this.previewGraphValue);
      preview.showNode(node.id);
      this.applySeededAnswers();
    }
  }

  private applySeededAnswers(): void {
    const preview = this.visitorPreview();

    if (!preview || this.provingCurrentValue) {
      return;
    }

    if (this.provingAnswersValue) {
      preview.shownAnswers = this.provingAnswersValue;
    }
  }

  /** The viewer drawn inside this node, when there is one. */
  private visitorPreview(): GuidePreview | null {
    return this.root.querySelector<GuidePreview>("[data-visitor-preview]");
  }

  /**
   * The live step's mirror, when the run stands on this node — so the shell
   * can hand it what the panel is typing (`showDraft`). `null` for a picture.
   */
  get liveStep(): GuidePreview | null {
    return this.provingCurrentValue && this.provingSourceValue ? this.visitorPreview() : null;
  }

  get provingAnswered(): boolean {
    return this.provingAnsweredValue;
  }

  /**
   * The exits of this node that the run has taken, or null for none.
   *
   * A separate state from `route`, deliberately. A shown route dims everything
   * it does not touch; the trail may not — story 065 asks for the green behind
   * and the ordinary colour ahead — and the two can be on at once.
   */
  set trail(value: string[] | null) {
    const same =
      (value === null && this.trailValue === null) ||
      (value !== null &&
        this.trailValue !== null &&
        value.length === this.trailValue.length &&
        value.every((port, index) => port === this.trailValue?.[index]));

    if (same) return;

    this.trailValue = value;
    this.applyTrail();
  }

  get trail(): string[] | null {
    return this.trailValue;
  }

  private applyTrail(): void {
    const ports = this.trailValue;

    this.toggleAttribute("data-trail", ports !== null);

    this.root
      .querySelectorAll<HTMLElement>(".flow-node__port")
      .forEach((port) => {
        const portId = port.dataset.portId;

        port.toggleAttribute(
          "data-trail",
          ports !== null && portId !== undefined && ports.includes(portId),
        );
      });
  }

  /**
   * The word in the header while a run is going on.
   *
   * It takes the eye's place rather than sitting beside it: during a run the
   * eye is gone from every node (the visitor's view is what a run shows), so
   * the header has exactly one mark either way and does not change width.
   */
  private applyProvingHeader(): void {
    const mark = this.root.querySelector<HTMLElement>("[data-proving-mark]");
    const flag = this.root.querySelector<HTMLElement>("[data-step-flag]");

    if (mark) {
      /*
       * A ball where the menu button stands (the menu is gone during a run):
       * a dot on the step the run stands on, a tick on one it has been
       * through. Design D, Johan 1/9 — no words in the header, the type's
       * name stays; the words are the accessible name.
       */
      const label = this.provingCurrentValue
        ? this.text("editor.node.here")
        : this.provingAnsweredValue
          ? this.text("editor.node.answered")
          : "";

      mark.innerHTML = this.provingCurrentValue
        ? '<i class="flow-node__proving-dot"></i>'
        : this.provingAnsweredValue
          ? "✓"
          : "";
      mark.setAttribute("aria-label", label);
      mark.hidden = label === "";
    }

    if (flag) {
      const step = this.provingValue ? this.provingStepValue : null;

      flag.textContent =
        step === null ? "" : this.text("editor.node.stepBadge", { step });
      flag.hidden = step === null;
    }
  }

  getPortElement(direction: PortDirection, portId: string): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(
      [
        `[data-port-direction="${direction}"]`,
        `[data-port-id="${portId}"]`,
      ].join(""),
    );
  }

  private render(): void {
    const node = this.nodeDataValue;

    if (!node) {
      this.root.replaceChildren();
      return;
    }

    const definition = getNodeType(node.type);
    const isPageChild = Boolean(node.parentPageId);
    const ports = isPageChild
      ? []
      : getNodePorts(node, {
          isStart: this.startNodeValue,
          locale: this.activeLocaleValue,
        });

    /*
     * The inputs a start node does not offer, kept as space.
     *
     * Making a node the start removes its input port, and the node loses that
     * row's height with it — measured, 229px becomes 189. Every port below the
     * change moves, which is the same shape as the bug that had lines coming
     * away from their ports, and on screen it reads as the node flinching.
     *
     * So the row stays and only its contents go. The height therefore matches by
     * construction rather than by a number somebody has to keep in step, and the
     * port is genuinely absent from `ports` — nothing can connect to it, which is
     * the whole point of removing it.
     */
    const reserved = isPageChild || !this.startNodeValue
      ? []
      : getNodePorts(node, { isStart: false, locale: this.activeLocaleValue })
          .filter(
            (candidate) =>
              candidate.direction === "input" &&
              !ports.some((shown) => shown.id === candidate.id),
          );

    this.style.left = `${node.position.x}px`;
    this.style.top = `${node.position.y}px`;
    /*
     * Typen även på VÄRDEN, inte bara på kortet inuti: lagringen (`z-index`)
     * sätts på `:host`, och en väljare mot det inre elementet kan aldrig nå
     * den. Anteckningens regel gick i den fällan.
     */
    this.dataset.nodeType = node.type;
    this.toggleAttribute("data-page-child", isPageChild);
    /*
     * A node with nothing after it takes its line 22 px from the card's
     * bottom edge.
     *
     * The port rows come after the content, so a result's lone entry ring sat
     * under its text — 300 px below the header on the imported guides, with
     * the line ending where nobody looks for it (Johan 7/9 2026: "porten
     * sitter för långt ner på resultatet … räkna från botten"). A question
     * keeps its ring on the first port row, where it shares the line with the
     * first exit; only a node with no exits at all moves it. The rows are then
     * rendered as a child of the card instead of inside the structure — see
     * the stylesheet — so they follow the card's bottom whichever view it
     * shows, and the card is shorter by the row it no longer needs.
     */
    const entryOnly =
      (ports.length > 0 || reserved.length > 0) &&
      !ports.some((port) => port.direction === "output");
    this.toggleAttribute("data-entry-only", entryOnly);
    /*
     * Vilka utgångar som hör till ett villkorat alternativ (story 134).
     * Porten och alternativet delar id — det är alternativets id som pekar ut
     * vägen vidare — så kopplingen är en uppslagning och inte en gissning.
     */
    const conditionalPorts = new Map(
      QuestionOptionsService.getOptions(node)
        .flatMap((option) => {
          const badge = PageVisibilityService.getBadgeLabel(
            { id: node.id, visibility: option.visibility },
            {
              nodes: this.previewGraphValue?.nodes,
              locale: this.uiLocale,
              contentLocale: this.activeLocaleValue,
            },
          );

          return badge ? [[option.id, badge] as const] : [];
        }),
    );
    const portsMarkup =
      ports.length > 0 || reserved.length > 0
        ? `
          <div class="flow-node__ports">
            ${this.renderPorts(reserved, { reserved: true })}${this.renderPorts(ports, { conditional: conditionalPorts })}
          </div>
        `
        : "";
    this.toggleAttribute(
      "data-page-container",
      node.type === "page" && !isPageChild,
    );
    if (isPageChild) {
      this.dataset.columnSpan = node.layout?.columnSpan === 4 ? "4" : node.layout?.columnSpan === 6 ? "6" : "12";
    } else {
      delete this.dataset.columnSpan;
    }

    this.root.innerHTML = `
    ${sharedStyles ? "" : `<style>${styles}</style>`}

    <article
      class="flow-node"
      data-node-type="${escapeHtml(node.type)}"${isEndingNodeType(node.type) ? " data-ending" : ""}${
        /*
         * Markeringen står i mallen, inte i en rad efteråt.
         *
         * Varje tangenttryck i egenskapspanelen ger `graph-changed`, canvasen
         * sätter ny `nodeData`, och det här kortet byggs om. Föddes det
         * omarkerat och fick `data-selected` påsatt av `updateSelectedState()`
         * en stund senare, hann webbläsaren räkna om stilen däremellan — och
         * `.flow-node`s `transition: box-shadow 120ms` spelade upp ringen på
         * nytt. Johan såg den blinka för varje tecken (18/9).
         *
         * `updateSelectedState()` står kvar och gör numera ingenting vid en
         * omritning: den behövs när markeringen ändras UTAN att kortet ritas
         * om, vilket är det vanliga fallet när man klickar mellan noder.
         */
        this.selectedValue ? " data-selected" : ""
      }
      aria-selected="${String(this.selectedValue)}"
      tabindex="${this.currentValue ? "0" : "-1"}"
      role="group"
      aria-label="${escapeHtml(this.getAccessibleName(node, definition))}"
    >
      ${
        /*
         * Startmärket sitter på kortets axel, inte i huvudraden: raden bär
         * redan grip, markörer och meny, och varje tecken till där tryckte
         * etiketten mot radbrytning (Johans öga — först på "Start · ",
         * sedan på ▶-glyfen som ersatte det). Ordet är kvar, för en pil
         * utan ord sa för lite. Dekor för ögat: nodens namn säger redan
         * "Startnod, " (se getAccessibleName).
         */
        this.startNodeValue
          ? `<span class="flow-node__start-flag" aria-hidden="true">${escapeHtml(this.text("editor.node.startBadge"))}</span>`
          : ""
      }
      ${
        /*
         * The run's step on the same edge — "Steg 2" — and START steps aside
         * while it is there. Always in the markup, filled by
         * applyProvingHeader, so a run never re-renders the card.
         */
        `<span class="flow-node__step-flag" data-step-flag aria-hidden="true" hidden></span>`
      }
      <header
        class="flow-node__header"
        data-drag-handle
      >
        ${
          /*
           * A sign that the header drags, not the only place it does.
           *
           * On a desktop `cursor: grab` says so; on a tablet nothing did, and
           * you had to guess. Making *only* a grip draggable was the other
           * option and would have shrunk the target from a whole header to a few
           * pixels — the wrong direction for a finger. So the grip is a mark,
           * and the header keeps working as it always has.
           *
           * `aria-hidden`, because it is a picture of an affordance rather than
           * a control: there is nothing here to press, and a screen reader
           * reading "braille pattern dots" would be noise.
           */
          ""
        }
        <span class="flow-node__grip" aria-hidden="true">⠿</span>
        <span class="flow-node__header-text">${
          /*
           * The type's icon, the same filled glyph as in the palette, so the
           * palette and the canvas speak one language (Johan, 2026-09-01:
           * "i header"). White on the header's family colour; aria-hidden,
           * because the name stands in plain text right beside it. A custom
           * type keeps its typed icon; a type with neither shows nothing.
           *
           * INSIDE the text span, inline, and not as a flex sibling: an icon
           * centred on the line box sat visibly off the capitals on Johan's
           * iPad, and a pixel's nudge only moved the error — line boxes differ
           * between SF, Segoe and DejaVu. Inline with `vertical-align` in em,
           * the icon follows the text's own baseline on every platform.
           */
          (() => {
            // A Text shown as a box (story 096) wears the box's icon, as the
            // strip wears its word — see stripLabel.
            const kind = calloutKind(node);
            const drawn = kind ? CALLOUT_ICONS[kind] : NODE_ICONS[node.type];
            const typed = definition?.icon;

            if (drawn) return `<span class="flow-node__type-icon" aria-hidden="true">${drawn}</span>`;
            if (typed) return `<span class="flow-node__type-icon" aria-hidden="true">${escapeHtml(typed)}</span>`;

            return "";
          })()
        }${escapeHtml(
          this.stripLabel(node, definition, isPageChild),
        )}</span>
        ${
          this.healthValue
            ? `<span
                 class="flow-node__health"
                 data-severity="${this.healthValue.severity}"
                 role="img"
                 aria-label="${escapeHtml(this.healthValue.label)}"
                 title="${escapeHtml(this.healthValue.label)}"
               >!</span>`
            : ""
        }
        ${
          /*
           * Samma varningsskylt som en okopplad nod bär (Johans jämförelse) —
           * markören ÄR en hälsomarkör i varningsgrad till utseendet, med
           * egen klass bara som krok för tester och ev. framtida särdrag.
           * Skillnaden bärs av namnet, inte av formen: "Saknar översättning"
           * i klartext är vad K3 kräver av en färgad prick.
           */
          this.untranslatedValue
            ? `<span
                 class="flow-node__health flow-node__translation"
                 data-severity="warning"
                 role="img"
                 aria-label="${escapeHtml(this.text("editor.node.untranslated"))}"
                 title="${escapeHtml(this.text("editor.node.untranslated"))}"
               >!</span>`
            : ""
        }
        ${
          /*
           * The mark a run puts in the header: "Du är här" on the step the run
           * stands on, a tick on one it has been through. Always in the
           * markup, hidden when there is nothing to say, so the header's
           * layout is the same with a run and without one.
           */
          `<span class="flow-node__proving-mark" data-proving-mark role="img" hidden></span>`
        }
        ${
          /*
           * The eye, to the left of the menu. Story 064: it is offered only on
           * a node the viewer can draw as a step, and only where the canvas may
           * be changed — a read-only canvas shows the visitor's view and no way
           * to switch away from it, which is the whole of story 064 point 10.
           *
           * And not while a run is on: every step is drawn the way a visitor
           * sees it then (story 065 point 2), so a button offering to switch to
           * it has nothing to offer.
           */
          /*
           * Present whenever the node CAN be switched; hidden (not omitted)
           * while a run is on. A node re-rendered mid-run — the panel edit
           * that makes the run stale does exactly that — otherwise lost the
           * button for good: the patch in updateVisitorToggle only flips
           * `hidden` on a button that exists.
           */
          this.editableValue && this.canShowVisitorView(node)
            ? `<button ${this.provingValue ? "hidden" : ""}
                 type="button"
                 class="flow-node__visitor-toggle"
                 data-visitor-toggle
                 tabindex="${this.currentValue ? "0" : "-1"}"
                 aria-label="${escapeHtml(this.visitorToggleLabel())}"
                 title="${escapeHtml(this.visitorToggleLabel())}"
               >${this.visitorToggleMarkup()}</button>`
            : ""
        }
        ${
          /*
           * The way to the menu for anyone without a right-click.
           *
           * A long press was the obvious answer and is the wrong one: iPadOS
           * Safari answers a long press with its own callout, and a gesture we
           * invented would have to be learned from nowhere. A visible button is
           * learned by looking at it, works with a finger, a mouse and a
           * keyboard alike, and needs no gesture recognition to fight the drag
           * handle it sits inside.
           *
           * It appears with selection — see the stylesheet — so a canvas of
           * thirty nodes is not thirty buttons. Tapping a node selects it, which
           * is the same tap somebody makes anyway before doing anything to it.
           */
          this.editableValue
            ? `<button
                 type="button"
                 class="flow-node__menu-button"
                 data-node-menu
                 tabindex="${this.currentValue ? "0" : "-1"}"
                 aria-haspopup="menu"
                 aria-expanded="${this.menuOpenValue}"
                 aria-label="${escapeHtml(this.menuButtonLabel())}"
                 title="${escapeHtml(this.menuButtonLabel())}"
               >${this.menuOpenValue ? "✕" : "⋯"}</button>`
            : ""
        }
        ${
          /*
           * E10 godkänd som byggd (Astra, uppdraget bilaga 5): ögat och ⋯
           * behöver inget synligt ord, men ett tydligt tooltip vid hover
           * OCH tangentbordsfokus — samma krav canvasens zoomrad redan
           * håller (bindCanvasToolbarTooltip i node-editor.ts). title
           * allena ger bara hover, aldrig fokus, så samma JS-drivna
           * mönster upprepas här i stället för att uppfinnas på nytt:
           * bindHeaderTooltip. aria-hidden eftersom namnet redan finns i
           * knappens aria-label — tooltipen är ren synlig återkoppling,
           * ingen egen namnkälla.
           */
          `<span class="flow-node__header-tooltip" role="tooltip" aria-hidden="true" data-header-tooltip hidden></span>`
        }
      </header>
      ${isPageChild ? this.renderVisibilityBand(node) : ""}
      ${this.renderDateBoundBand(node)}
      <div class="flow-node__content"${this.contentDirection()}>
        ${
          /*
           * Both views in one grid cell, the inactive one hidden with
           * `visibility` rather than removed.
           *
           * That is what makes story 064 point 8 true by construction: the cell
           * is as tall as the taller of the two, so the box does not change when
           * the eye is pressed, ports stand still and "show them all" cannot
           * push one node over another. Measuring the other view and reserving
           * the height would be the same picture with a number to keep in step.
           *
           * `visibility: hidden` also takes the hidden half out of the tab order
           * and out of the accessible tree, which is the half of "inert" that
           * matters here — the preview carries the actual `inert` as well.
           */
          ""
        }
        <div class="flow-node__views">
          <div class="flow-node__structure">
            ${
              definition
                ? this.renderNodeContent(node)
                : this.renderUnknownNode(node)
            }
            ${this.renderFieldLabels(node)}
            ${
              /*
               * The port rows belong to the structure, and they stay in it.
               *
               * They used to sit below the pair of views, and then the node was
               * the visitor's view **plus** the structure's port rows — a sum,
               * not the taller of the two. Measured on the built site:
               * question-gender went from 428 px to 748, with 320 px of empty
               * space between the tag and Man/Kvinna/Annat. Inside the cell the
               * arithmetic is right again: the node is as tall as whichever view
               * is taller, and a node whose structure is the taller of the two
               * is the size it was before the eye existed.
               *
               * The rings stay visible in both views — `visibility` is put back
               * on them in the stylesheet — and in the visitor's view they move
               * to their answers' rows. See `alignPortsToAnswers`.
               *
               * Reserved rows count. A start node with no outputs yet has no
               * ports at all, and the block was skipped entirely — so the row
               * that keeps the height disappeared with it and the node was 46px
               * shorter than the same node not being the start. Found by running
               * the guarantee over every node type instead of the one it was
               * written on.
               *
               * A node with no exits is the exception: its rows sit against
               * the card's bottom, outside the views — see `entryOnly`.
               */
              entryOnly ? "" : portsMarkup
            }
          </div>
          ${
            this.canShowVisitorView(node) && this.previewGraphValue
              ? `<guide-preview
                   class="flow-node__visitor"
                   data-visitor-preview
                   editor-view
                   in-node
                   inert
                   active-locale="${escapeHtml(this.activeLocaleValue)}"
                 ></guide-preview>`
              : ""
          }
        </div>
      </div>
      ${
        /*
         * A child of the card, so the stylesheet can place it against the
         * card's bottom edge; after the content so it paints over it.
         */
        entryOnly ? portsMarkup : ""
      }
      ${
        node.type === "annotation" &&
        !(typeof node.data.targetNodeId === "string" && node.data.targetNodeId)
          ? `<span class="flow-node__note-arrow" data-dir="${escapeHtml(
              readNodeString(node, "arrow"),
            )}" aria-hidden="true"></span>`
          : ""
      }
    </article>
  `;

    this.mountVisitorPreview(node);
    this.applyProvingHeader();
    this.applyLiveStep();
    this.applyTrail();
    this.bindPortEvents();
    this.bindDragEvents();
    this.bindSelectionEvents();
    this.bindKeyboardEvents();
    this.bindHeaderTooltip();
    this.updateSelectedState();
    this.applyRoute();
  }

  /** Accessible name for screen readers: node type (plus start marker) and title. */
  /**
   * What the node is called in the editor: the template's name if it came from
   * a template that still exists, otherwise the base type's. A broken link
   * degrades to the truth — the node *is* a node of its type, and is called what
   * it is.
   */
  /**
   * The `dir` and `lang` for the node's content, or nothing.
   *
   * On the content, not on the card. A node has two languages side by side: the
   * header names the node *type*, which is the tool's word and follows
   * `editor-locale`, and everything below it is the guide's, which follows the
   * content. Turning the whole card would turn the tool's word with it.
   *
   * The same split the properties panel makes, one surface along — and the node
   * on the canvas is the one a translator actually stares at. It rendered
   * Arabic left-to-right until now, with no `dir` at all.
   *
   * `lang` as well as `dir`: a screen reader reading Arabic with a Swedish
   * voice is the reader this is for.
   */
  private contentDirection(): string {
    const locale = this.activeLocaleValue;
    return textDirection(locale) === "rtl"
      ? ` dir="rtl" lang="${escapeHtml(locale)}"`
      : "";
  }

  private nodeLabel(
    node: FlowNodeData,
    definition: ReturnType<typeof getNodeType>,
  ): string {
    const label =
      templateLabel(node.template, this.uiLocale) ??
      displayNodeTypeLabel(node.type, definition?.label, this.uiLocale);
    const format = this.formatLabel(node);

    /*
     * Formatet hör till vad noden ÄR, alltså till remsan: `Textfråga | E-post`.
     * E-postadress och Telefonnummer är annars båda bara "Textfråga", trots att
     * formatet avgör vad besökaren kan skriva och vad mejlkopian får peka på.
     *
     * Det kortar också etikettraden i kortet till två, vilket är vad ett fält
     * på 198 px behöver för att radbrytningen ska bli en rad och inte tre.
     */
    return format ? `${label} | ${format}` : label;
  }

  /**
   * What the strip SHOWS. On a field on a page it is the format alone —
   * `E-post` — and the icon carries the type; everywhere else it is the
   * whole label.
   *
   * Measured 3/9: a third-width field gives the strip 118 px, and
   * `Textfråga | E-post` needs 144, so the ellipsis ate the format — the one
   * word that told E-postadress from Telefonnummer (bedömningen 3/9, I). A
   * half-width field clipped the long ones (`Organisationsnummer`). The icon
   * already says Textfråga on every field, so the word was the redundant
   * half. The accessible name keeps the full label: an icon is silent.
   */
  private stripLabel(
    node: FlowNodeData,
    definition: ReturnType<typeof getNodeType>,
    isPageChild: boolean,
  ): string {
    const format = this.formatLabel(node);
    // Story 096: *Viktigt* in the strip where *Text* would stand, so the
    // kind is told apart on the canvas without opening the panel — the same
    // move as a text field's format. The word is the panel's own option.
    const kind = calloutKind(node);

    if (isPageChild && kind) return this.text(`nodeOption.${kind}`);

    return isPageChild && format ? format : this.nodeLabel(node, definition);
  }

  /** Formatets läsbara namn ur registret — aldrig dess id (`email`). */
  private formatLabel(node: FlowNodeData): string {
    const name = readNodeString(node, "format");
    const registration = name ? getFormat(name) : undefined;

    return registration ? resolveText(registration.label, this.uiLocale) : "";
  }

  /**
   * Fältets etikett: aliaset, sedan variabelnamnet — `Kontaktväg — contactMethod`.
   *
   * Samma form som variabelväljaren (`QuestionVariableService.getDisplayName`),
   * och alltid aliaset först: den som läser chipet ska känna igen samma ord som
   * regeleditorn visar, och namnet är det tekniska tillägget (Johan 3/9). Utan
   * alias står namnet ensamt — rubriken står redan ovanför, och att upprepa den
   * i chipet vore samma sak två gånger.
   *
   * Sist i kortet, efter beskrivningen. Rubrik och beskrivning är skrivna till
   * besökaren — ett variabelnamn mellan dem bryter en mening mitt itu, och
   * kortet växer nedåt utan att flytta något (story 055, avgjord i skisser).
   *
   * Ritas alltid, visas bara när arbetsytan bär `show-variables` (Vy → Visa
   * variabelnamn, story 077): namnet är rätt att se när man skriver villkor
   * eller mallar, över hela guiden på en gång, och brus resten av tiden.
   * Obligatoriskt är inte längre ett chip utan en asterisk efter rubriken.
   */
  private renderFieldLabels(node: FlowNodeData): string {
    const variable = readNodeString(node, "variableName").trim();

    if (!variable) {
      return "";
    }

    const alias = resolveText(node.data.variableLabel, this.activeLocaleValue).trim();

    return `
      <div class="flow-node__field-labels">
        <span class="flow-node__field-label flow-node__field-label--variable">
          ${FIELD_LABEL_ICONS.variable}${alias ? `<span class="flow-node__field-label-alias">${escapeHtml(alias)} —</span> ` : ""}<span class="flow-node__field-label-text">${escapeHtml(variable)}</span>
        </span>
      </div>`;
  }

  /**
   * The band on a conditional field, in the editor's words — *Visas bara om
   * Kontaktväg är E-post* (story 077). The guide is what turns the variable
   * name into the question's title and the value into the answer's label;
   * without it the names stand as they are.
   */
  private renderVisibilityBand(node: FlowNodeData): string {
    const label = PageVisibilityService.getBadgeLabel(node, {
      nodes: this.previewGraphValue?.nodes,
      locale: this.uiLocale,
      contentLocale: this.activeLocaleValue,
    });

    return label
      ? `<p class="flow-node__visibility-badge">${escapeHtml(label)}</p>`
      : "";
  }

  /**
   * The band on a date bounded by another field — *≥ Från* (story 087), in
   * the same place and shape as the visibility band. Symbols, not words: the
   * same ones the rule operators use in every language. Only when the bound
   * is a variable; a fixed date or "idag" sits in the panel, as before.
   */
  private renderDateBoundBand(node: FlowNodeData): string {
    if (node.type !== "date-question") {
      return "";
    }

    const nodes = this.previewGraphValue?.nodes ?? [];
    const parts = ([["min", "≥"], ["max", "≤"]] as const).flatMap(([key, symbol]) => {
      const bound = node.data[key];
      const variable = dateBoundVariable(typeof bound === "string" ? bound : undefined);

      return variable === null
        ? []
        : [`${symbol} ${QuestionVariableService.labelOf(nodes, variable, this.activeLocaleValue)}`];
    });

    return parts.length > 0
      ? `<p class="flow-node__visibility-badge" data-date-bound>${escapeHtml(parts.join(", "))}</p>`
      : "";
  }

  private getAccessibleName(
    node: FlowNodeData,
    definition: ReturnType<typeof getNodeType>,
  ): string {
    const label = this.nodeLabel(node, definition);
    const rawTitle = node.data.title;
    const title =
      typeof rawTitle === "string" || isLocalizedTextMap(rawTitle)
        ? resolveText(rawTitle, this.activeLocaleValue)
        : "";
    const prefix = this.startNodeValue
      ? this.text("editor.node.startNodePrefix")
      : "";

    /*
     * The problem is part of the node's name, not only a picture on it.
     *
     * The reason used to be a band of text inside the card, which a screen
     * reader read as part of the node. Moving it into a marker in the header
     * would have taken it away from anyone not looking, so it is spoken here
     * instead — see the comment on `health`.
     */
    const problem = this.healthValue ? ` — ${this.healthValue.label}` : "";
    // Same rule as the problem: the gap is part of the node's name, not only
    // a picture on it — a marker alone is silent for anyone not looking.
    const gap = this.untranslatedValue
      ? ` — ${this.text("editor.node.untranslated")}`
      : "";
    // Required is an asterisk on the card (story 077); a symbol is never the
    // only channel (KRAV), so the name carries the word.
    const required = node.data.required === true
      ? ` (${t("editor.node.required", this.uiLocale)})`
      : "";
    const name = title ? `${prefix}${label}: ${title}${required}` : `${prefix}${label}${required}`;
    // The "× barn" row is aria-hidden; the name carries it in words.
    const word = this.repeatWord(node);
    const repeats = word
      ? ` — ${this.text("editor.node.repeats", { word })}`
      : "";
    // The `[data-calculation-rows]` list is aria-hidden; the name carries
    // the same labels in words (uppdrag 29/9 Del D K-numren, Siv).
    const { labels, more } = this.calculationHint(node);
    const calculations = labels.length > 0
      ? ` — ${this.text("editor.node.calculationsHint", { list: [...labels, ...(more ? [more] : [])].join(", ") })}`
      : "";

    return `${name}${repeats}${problem}${gap}${calculations}`;
  }

  /**
   * Keyboard on a focused node: Enter selects, arrow keys move (Shift for a
   * larger step). Reacts only when the node itself has focus, so port buttons
   * and field focus are not hijacked. Page children are moved via the panel.
   *
   * ## Space is the canvas's, not the node's
   *
   * It used to select here too, the way a button does — and the canvas uses a
   * held Space as the hand tool. With a node focused, both fired: every repeat
   * of the keydown dispatched `node-select` again, thirty times a second, and
   * each one re-rendered the panel and the preview beside it. Panning went from
   * a drag to a crawl, and the node kept pulling the focus back to itself while
   * someone was trying to look somewhere else.
   *
   * A key cannot mean two things at once in the same place. The canvas keeps
   * Space because holding it is the only way to pan without a mouse wheel, and
   * a node keeps Enter, which is what selects everything else in the editor.
   */
  /**
   * Marks the output a half-made connection is coming from.
   *
   * Set on the element rather than kept in a render pass: the port is a live
   * state that lasts between two presses, and re-rendering the node to show it
   * would move the very button somebody is about to press again.
   */
  setPendingPort(portId: string | null): void {
    this.root
      .querySelectorAll<HTMLElement>(".flow-node__port")
      .forEach((port) => {
        const isPending = portId !== null && port.dataset.portId === portId;
        port.toggleAttribute("data-pending", isPending);
        port.setAttribute("aria-expanded", String(isPending));
      });
  }

  /**
   * Puts focus back on a port after a re-render has replaced its button.
   *
   * A connection landing on an input changes the node's health text, and the
   * node redraws — the button that was pressed is gone and focus with it, to
   * `body`. Whoever completed the connection is still standing on that input.
   */
  focusPort(portId: string): void {
    this.root
      .querySelector<HTMLElement>(`.flow-node__port[data-port-id="${portId}"]`)
      ?.focus();
  }

  /**
   * Focusing the element focuses the node, not the shell.
   *
   * The tabindex sits on `.flow-node` inside the shadow root, so `focus()` on
   * the host did nothing at all — silently, which is the worst kind. Anything
   * moving focus around the canvas reaches for the element it can see.
   */
  focus(options?: FocusOptions): void {
    const inner = this.root.querySelector<HTMLElement>(".flow-node");

    if (inner) {
      inner.focus(options);
      return;
    }

    super.focus(options);
  }

  private bindKeyboardEvents(): void {
    const nodeElement = this.root.querySelector<HTMLElement>(".flow-node");

    if (!nodeElement) {
      return;
    }

    nodeElement.addEventListener("keydown", (event) => {
      const node = this.nodeDataValue;

      if (!node || event.target !== nodeElement) {
        return;
      }

      /*
       * A held key is one intention, not forty. Nothing below is meant to
       * happen again while a finger stays down — moving a node with the arrows
       * is the one thing that could be, and it reads as a slide rather than as
       * steps, which is a different feature than the one that is here.
       */
      if (event.repeat) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        this.dispatchEvent(
          new CustomEvent<NodeSelectDetail>("node-select", {
            detail: { nodeId: node.id, open: true },
            bubbles: true,
            composed: true,
          }),
        );
        return;
      }

      /*
       * What an arrow means depends on whether the node is picked up.
       *
       * The editor already keeps focus and selection apart: a node is focusable
       * on its own, and Enter selects it. That separation is what lets the
       * arrows carry both meanings without a modifier to remember, and each one
       * is the natural one in its place — looking around a list moves focus,
       * and nudging is what arrows do to something you have picked up in every
       * drawing tool anybody has used.
       *
       * The state is visible and announced: a selected node has its ring and
       * `aria-selected`. Escape puts it down, and the arrows navigate again.
       */
      const step = event.shiftKey ? 50 : 10;
      const directions: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      const direction = directions[event.key];

      if (!direction) {
        return;
      }

      if (!this.selectedValue) {
        /*
         * Handled here, so the canvas does not handle it again.
         *
         * The canvas answers an arrow too, for the case where nothing has focus
         * yet — otherwise reaching the first node needs a Tab somebody has to
         * know about. Without stopping here, both fired: this moved focus to the
         * neighbour and the canvas immediately took it back to the first node,
         * every time. Same shape as the Space collision described above.
         */
        event.stopPropagation();
        event.preventDefault();
        this.dispatchEvent(
          new CustomEvent<NodeNavigateDetail>("node-navigate", {
            detail: { nodeId: node.id, dx: direction[0], dy: direction[1] },
            bubbles: true,
            composed: true,
          }),
        );
        return;
      }

      if (node.parentPageId) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();
      this.dispatchEvent(
        new CustomEvent<NodeNudgeDetail>("node-nudge", {
          detail: {
            nodeId: node.id,
            dx: direction[0] * step,
            dy: direction[1] * step,
          },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }

  /**
   * The eye and ⋯ get a tooltip on hover AND keyboard focus, not just the
   * native `title` (hover only) they already carry alongside their
   * `aria-label` (E10 godkänd som byggd, uppdraget 30/9, bilaga 5: *"Ögat
   * behöver inget synligt ord, men ska ha ett tydligt tillgängligt namn och
   * tooltip vid hover och fokus."*).
   *
   * Copied rather than shared: the canvas toolbar's `bindCanvasToolbarTooltip`
   * (`node-editor.ts`) is the one other place this exact behaviour exists,
   * and it is one toolbar in one shadow root — every node on the canvas has
   * its own, so the binding has to be per-node too. `aria-hidden` on the
   * tooltip element itself, same as the toolbar's: the name is already the
   * button's `aria-label`, and this span is only ever the same words shown
   * again for the eye.
   */
  private bindHeaderTooltip(): void {
    const header = this.root.querySelector<HTMLElement>(".flow-node__header");
    const tooltip = this.root.querySelector<HTMLElement>("[data-header-tooltip]");

    if (!header || !tooltip) {
      return;
    }

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
      const room = header.clientWidth - tooltip.offsetWidth;
      const centre = button.offsetLeft + button.offsetWidth / 2 - tooltip.offsetWidth / 2;
      tooltip.style.left = `${Math.max(0, Math.min(room, centre))}px`;
    };
    const scheduleHide = (): void => {
      if (shownFor && this.root.activeElement === shownFor) return;
      cancelHide();
      hideTimer = setTimeout(hide, 200);
    };

    header
      .querySelectorAll<HTMLButtonElement>("[data-visitor-toggle], [data-node-menu]")
      .forEach((button) => {
        button.addEventListener("pointerenter", () => show(button));
        button.addEventListener("pointerleave", scheduleHide);
        button.addEventListener("focus", () => {
          if (button.matches(":focus-visible")) show(button);
        });
        button.addEventListener("blur", hide);
      });
    /*
     * Siv, 1/10 (Astra, uppdraget bilaga 8, precisering 2 — WCAG 1.4.13
     * hoverable): a tooltip that vanishes the moment the pointer leaves the
     * BUTTON, drawn outside the button's own box (`bottom: 100%`), can
     * never be reached by a pointer moving toward it — measured live with a
     * real mouse: it hid after 200 ms every time, pointer resting inside its
     * rectangle or not. Missing from the copy of `bindCanvasToolbarTooltip`
     * this was built from, where these two lines already stand. The tooltip
     * cancelling its own hide on `pointerenter`, and re-scheduling it on
     * `pointerleave`, is what lets the pointer cross the gap between button
     * and tooltip without losing it.
     */
    tooltip.addEventListener("pointerenter", cancelHide);
    tooltip.addEventListener("pointerleave", scheduleHide);
    header.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || tooltip.hidden) return;
      event.preventDefault();
      hide();
    });

    /*
     * `updateMenuButton`/`updateVisitorToggle` patch a button's label
     * in place (see each) without a full `render()` — a tooltip already
     * showing the old word (the eye toggling between "Som besökaren ser
     * den" and "Tillbaka till strukturen") would otherwise go stale until
     * the pointer left and came back.
     */
    this.refreshHeaderTooltip = () => {
      if (shownFor) show(shownFor);
    };
  }

  /** Set by `bindHeaderTooltip`; renames a shown tooltip when a label changes. */
  private refreshHeaderTooltip: () => void = () => {};

  private updateSelectedState(): void {
    const nodeElement = this.root.querySelector<HTMLElement>(".flow-node");

    if (!nodeElement) {
      return;
    }

    nodeElement.toggleAttribute("data-selected", this.selectedValue);

    nodeElement.setAttribute("aria-selected", String(this.selectedValue));
  }

  private renderNodeContent(node: FlowNodeData): string {
    const definition = getNodeType(node.type);

    if (!definition) {
      return this.renderUnknownNode(node);
    }

    return editableProperties(definition)
      .filter((property) => property.display)
      .map((property) => {
        const raw = node.data[property.id];
        // Translatable fields (title, say) may be { sv, ... }; resolve them in
        // the node's chosen language with source fallback.
        const value =
          typeof raw === "string" || isLocalizedTextMap(raw)
            ? resolveText(raw, this.activeLocaleValue)
            : raw;

        if (value === undefined || value === null || value === "") {
          return "";
        }

        return this.renderDisplayedProperty(property, value, node);
      })
      .join("") + nodeSummary(node, this.activeLocaleValue) + this.renderRepeatRow(node) + this.renderCalculationRows(node);
  }

  /**
   * The calculation card's rows and the accessible name share one source
   * (Siv, uppdrag 29/9 Del D K-numren): up to three labels — the variable's
   * name where a row has none — then how many more, exactly as `getProduced
   * Entries` orders them for every other place that names a calculation's
   * results.
   */
  private calculationHint(node: FlowNodeData): { labels: string[]; more: string | null } {
    if (node.type !== "calculation") return { labels: [], more: null };

    const entries = CalculationService.getProducedEntries(node, this.activeLocaleValue);
    const shown = entries.slice(0, 3);
    const remaining = entries.length - shown.length;
    const more = remaining > 0
      ? remaining === 1
        ? t("editor.node.oneMoreCalculation", this.activeLocaleValue)
        : interpolate(t("editor.node.moreCalculations", this.activeLocaleValue), { n: String(remaining) })
      : null;

    return { labels: shown.map((entry) => entry.label), more };
  }

  /**
   * What a calculation works out, on its card (uppdrag 29/9 Del D, Astra
   * §11). Information only: the rows have no ports, the node still has its
   * one way on.
   *
   * `aria-hidden`, the same reason `renderRepeatRow`'s "× barn" is: a
   * `role="group"` node is ONE tab stop (`tabindex="0"`), so nothing inside
   * it is reachable by Tab, and `aria-label` replaces rather than extends
   * the accessible name — content here would be silent to anyone not
   * looking. Measured 29/9 (Siv): three labels and a card with `role=
   * "group"` `aria-label`d only with the node's title read nothing of them
   * back. `getAccessibleName` below carries the same words instead.
   */
  private renderCalculationRows(node: FlowNodeData): string {
    const { labels, more } = this.calculationHint(node);

    if (labels.length === 0) return "";

    return `
      <ul class="flow-node__calculations" data-calculation-rows aria-hidden="true">
        ${labels.map((label) => `<li>${escapeHtml(label)}</li>`).join("")}
        ${more ? `<li class="flow-node__calculations-more">${escapeHtml(more)}</li>` : ""}
      </ul>`;
  }

  /**
   * "× barn" — the page repeats (story 084, AC 7). The word is the editor's,
   * in the card's language; the glyph is the multiplication sign because the
   * card is a picture of the flow and a picture says "times". No row without
   * a word: the health flag carries that case, and an empty "×" would be the
   * same fact twice. The accessible name says it in words, since a symbol is
   * never the only channel (KRAV).
   */
  private renderRepeatRow(node: FlowNodeData): string {
    const word = this.repeatWord(node);

    return word
      ? `<p class="flow-node__repeats" data-repeat-row aria-hidden="true">× ${escapeHtml(word)}</p>`
      : "";
  }

  /** The word a repeating page repeats, or "" when it does not repeat. */
  private repeatWord(node: FlowNodeData): string {
    if (node.type !== "page" || node.data.repeats !== true) {
      return "";
    }

    const raw = node.data.repeatWord;

    return typeof raw === "string" || isLocalizedTextMap(raw)
      ? resolveText(raw, this.activeLocaleValue).trim()
      : "";
  }

  /**
   * A property the type declares as shown on the card.
   *
   * Two things from story 077 sit here. `{{applicantName}}` in a text is drawn
   * as the same gap the visitor's view draws — the variable's label, dashed —
   * because the raw name is a developer's word on the card too (Johan 3/9).
   * And a required field wears an asterisk after its title, in the place a
   * form puts it, instead of a chip of its own; the card's accessible name
   * carries the word (`getAccessibleName`).
   *
   * A property with formatting is drawn through the visitor's renderer, so a
   * link is its label and bold is bold — inline, since the card wraps the
   * text in its own tag, and inert, since a click here selects the node
   * (`FormattedTextService.renderInert` says why). One that has none is
   * escaped as before; the two meet in `variableGaps`, which turns the
   * `{{variabel}}` both leave in place into the gap.
   */
  private renderDisplayedProperty(
    property: NodePropertyDefinition,
    value: unknown,
    node: FlowNodeData,
  ): string {
    const display = property.display;

    if (!display) {
      return "";
    }

    const classAttribute = display.className
      ? ` class="${escapeHtml(display.className)}"`
      : "";
    const asterisk =
      property.id === "title" && node.data.required === true
        ? ' <span class="flow-node__required" aria-hidden="true">*</span>'
        : "";

    const text = String(value);
    const html = property.formatting
      ? FormattedTextService.renderInert(
          text,
          property.formatting,
          this.previewGraphValue ?? undefined,
          this.activeLocaleValue,
        )
      : escapeHtml(text);

    return `
    <${display.tag}${classAttribute}>
      ${variableGaps(html, this.previewGraphValue, "flow-node__variable-gap", this.activeLocaleValue)}${asterisk}
    </${display.tag}>
  `;
  }

  private renderPorts(
    ports: NodePort[],
    options: { reserved?: boolean; conditional?: Map<string, string> } = {},
  ): string {
    return ports
      .map((port) =>
        this.renderPort(port, options.reserved, options.conditional?.get(port.id)),
      )
      .join("");
  }

  /**
   * `conditional` is the badge an option carrying a condition wears (story
   * 134) — *Visas bara om Allergi inte är Nötter* — or nothing.
   *
   * A dot and not the sentence: the card would otherwise become a list of
   * conditions, and the words live in the panel, where the editing happens.
   *
   * The dot says the whole sentence to anyone who cannot see it (K3: nothing
   * may require seeing colour or shape). It is `role="img"` with an
   * `aria-label` and not a bare `<span aria-label>` — ARIA forbids a generic
   * element from carrying a name, and this codebase has already shipped one
   * label that therefore rendered to nobody. A `title` puts the same sentence
   * under a pointer, as a convenience and never as the only way.
   */
  private renderPort(port: NodePort, reserved = false, conditional?: string): string {
    const directionClass = `flow-node__port-row--${port.direction}`;

    const buttonClass = `flow-node__port--${port.direction}`;

    // The generic "Fortsätt" exit needs no visible label — a single way
    // forward is understood anyway. Branching questions keep their option
    // labels. The button's aria-label remains, so screen readers lose nothing.
    const isGenericContinue =
      port.direction === "output" && port.id === "continue";

    const label =
      port.label && !isGenericContinue
        ? `
        <span class="flow-node__port-label"${conditional ? ` title="${escapeHtml(conditional)}"` : ""}>
          ${escapeHtml(port.label)}${
            conditional
              ? `<span
                  class="flow-node__port-conditional"
                  role="img"
                  aria-label="${escapeHtml(conditional)}"
                  data-port-conditional
                ></span>`
              : ""
          }
        </span>
      `
        : "";

    /*
     * I läsläge är ringen slutet på en linje och ingen knapp (berättelse 129).
     *
     * Den ritas — en gömd port ankrar ändå sin linje, och då slutar kopplingen
     * bakom kortet — men den är inte ett tabbstopp och inte något en
     * skärmläsare läser upp som en kontroll. Samma sak sätts om av
     * `updateTabOrder` när läget byts under en nod som redan står ritad; här
     * står det för noder som ritas medan läget redan gäller.
     */
    const readonly = this.hasAttribute("data-readonly");
    const button = `
      <button
        type="button"
        class="flow-node__port ${buttonClass}"
        data-port-id="${escapeHtml(port.id)}"
        data-port-direction="${port.direction}"
        tabindex="${readonly || !this.currentValue ? "-1" : "0"}"
        ${readonly ? 'aria-hidden="true"' : ""}
        aria-label="${escapeHtml(this.getPortAriaLabel(port))}"
      ></button>
    `;

    if (reserved) {
      /*
       * An empty row, not a hidden port.
       *
       * The first attempt kept the button and hid it. The height was right and
       * the port was unclickable — but it was still in the DOM carrying its
       * `data-port-id`, and the canvas finds ports by exactly that selector when
       * it draws connections. A start node would have had an input to draw to
       * again, quietly, which is the one thing removing it is for.
       *
       * The row keeps its height on its own: `.flow-node__port-row` has
       * `min-height: 28px`, more than the 18px circle it would have held.
       */
      return `
        <div
          class="flow-node__port-row ${directionClass} flow-node__port-row--reserved"
          aria-hidden="true"
        ></div>
      `;
    }

    return `
      <div
        class="
          flow-node__port-row
          ${directionClass}
        "
      >
        ${
          port.direction === "input" ? `${button}${label}` : `${label}${button}`
        }
      </div>
    `;
  }

  private bindPortEvents(): void {
    const portElements =
      this.root.querySelectorAll<HTMLButtonElement>(".flow-node__port");

    portElements.forEach((portElement) => {
      portElement.addEventListener("pointerdown", (event) => {
        /*
         * Let go of the capture the browser just took.
         *
         * A touch pointerdown gives the element *implicit pointer capture*, so
         * every later event for that finger is delivered here rather than to
         * whatever is under it. A connection drag then ended with `pointerup` on
         * the output port it started from — which the canvas reads as "released
         * on something that is not an input" and cancels. Dragging with a finger
         * could not succeed, however carefully it was aimed.
         *
         * A mouse never had the problem, because a mouse takes no implicit
         * capture. Releasing here makes the finger behave like the mouse: the
         * release lands on the port under it, or on the canvas.
         */
        if (portElement.hasPointerCapture(event.pointerId)) {
          portElement.releasePointerCapture(event.pointerId);
        }

        this.dispatchPortEvent("node-port-pointerdown", event, portElement);
      });

      portElement.addEventListener("pointerup", (event) => {
        this.dispatchPortEvent("node-port-pointerup", event, portElement);
      });

      /*
       * The same gesture as the mouse, in two presses.
       *
       * A connection is made by pressing on one port and letting go on another.
       * With a keyboard that is Enter on the output and Enter on the input, and
       * the canvas holds the half-made connection in between. Space as well as
       * Enter, because these are buttons and that is what a button answers to —
       * the canvas's held-Space panning only applies with a node focused, not a
       * port.
       */
      portElement.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.dispatchEvent(
          new CustomEvent("node-port-activate", {
            detail: {
              nodeId: this.nodeDataValue?.id ?? "",
              portId: portElement.dataset.portId ?? "",
              direction: portElement.dataset.portDirection ?? "",
              label: portElement.getAttribute("aria-label") ?? "",
              /*
               * The node's name travels with the port's.
               *
               * "Utgång: Ja kopplad till Ingång" is true and useless — it names
               * neither end in terms anybody thinks in. What somebody wants to
               * hear is which answer now leads to which outcome.
               */
              nodeLabel:
                this.root.querySelector(".flow-node")?.getAttribute("aria-label") ??
                "",
            },
            bubbles: true,
            composed: true,
          }),
        );
      });
    });
  }

  private bindDragEvents(): void {
    const dragHandle =
      this.root.querySelector<HTMLElement>("[data-drag-handle]");

    if (!dragHandle) {
      return;
    }

    dragHandle.addEventListener("pointerdown", (event) => {
      if (!this.nodeDataValue) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      this.dispatchEvent(
        new CustomEvent<NodeDragStartDetail>("node-drag-start", {
          detail: {
            nodeId: this.nodeDataValue.id,
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
          },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }

  private bindSelectionEvents(): void {
    const nodeElement = this.root.querySelector<HTMLElement>(".flow-node");

    if (!nodeElement) {
      return;
    }

    nodeElement.addEventListener("pointerdown", (event) => {
      const path = event.composedPath();

      const clickedPort = path.some(
        (element) =>
          element instanceof HTMLElement &&
          element.classList.contains("flow-node__port"),
      );

      if (clickedPort || !this.nodeDataValue) {
        return;
      }

      /*
       * A click in the visitor's view selects the field it landed on, which is
       * a child of this node — the same thing a click on the field's own card
       * does with the pencil. Falls back to the node itself, so a click on the
       * heading or the buttons behaves as it always has.
       */
      const detail: NodeSelectDetail = {
        nodeId:
          this.fieldAt(event.clientX, event.clientY) ?? this.nodeDataValue.id,
      };

      this.dispatchEvent(
        new CustomEvent<NodeSelectDetail>("node-select", {
          detail,
          bubbles: true,
          composed: true,
        }),
      );
    });

    /*
     * The menu button sits inside the drag handle, so the press that opens it
     * would otherwise also start a drag and leave the node a few pixels from
     * where it was. Stopping the pointer here means the button is pressed and
     * nothing moves — the click below still fires, because it is a separate
     * event and this only stops the one that begins a drag.
     */
    /*
     * Same two listeners as the menu button below, for the same reason: the
     * button sits inside the drag handle, so the press that works it would
     * otherwise start a drag and leave the node a few pixels from where it was.
     */
    const visitorToggle = this.root.querySelector<HTMLButtonElement>(
      "[data-visitor-toggle]",
    );

    visitorToggle?.addEventListener("pointerdown", (event) =>
      event.stopPropagation(),
    );

    visitorToggle?.addEventListener("click", (event) => {
      if (!this.nodeDataValue) {
        return;
      }

      event.stopPropagation();
      this.dispatchEvent(
        new CustomEvent<{ nodeId: string }>("node-visitor-view-intent", {
          detail: { nodeId: this.nodeDataValue.id },
          bubbles: true,
          composed: true,
        }),
      );
    });

    const menuButton = this.root.querySelector<HTMLButtonElement>("[data-node-menu]");

    menuButton?.addEventListener("pointerdown", (event) => event.stopPropagation());

    menuButton?.addEventListener("click", (event) => {
      if (!this.nodeDataValue) {
        return;
      }

      event.stopPropagation();
      this.dispatchEvent(
        new CustomEvent<{ nodeId: string }>("node-menu-intent", {
          detail: { nodeId: this.nodeDataValue.id },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }

  private dispatchPortEvent(
    eventName: "node-port-pointerdown" | "node-port-pointerup",
    event: PointerEvent,
    portElement: HTMLButtonElement,
  ): void {
    event.preventDefault();
    event.stopPropagation();

    const node = this.nodeDataValue;

    if (!node) {
      return;
    }

    const portId = portElement.dataset.portId;
    const direction = portElement.dataset.portDirection as
      PortDirection | undefined;

    if (!portId || !direction) {
      return;
    }

    const detail: PortInteractionDetail = {
      nodeId: node.id,
      portId,
      direction,
      portElement,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    };

    this.dispatchEvent(
      new CustomEvent<PortInteractionDetail>(eventName, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderUnknownNode(node: FlowNodeData): string {
    // The title is a localised map as often as a string; resolved like every
    // other card's, or the card read "[object Object]" (seen 6/10).
    const title = resolveText(node.data.title, this.activeLocaleValue).trim() || node.type;

    return `
      <h2 class="flow-node__title">
        ${escapeHtml(title)}
      </h2>

      <p class="flow-node__description">
        ${escapeHtml(
          this.text("editor.node.unknownType", { type: node.type }),
        )}
      </p>
    `;
  }

  private getPortAriaLabel(port: NodePort): string {
    const directionLabel =
      port.direction === "input"
        ? this.text("editor.node.portInput")
        : this.text("editor.node.portOutput");

    if (!port.label) {
      return directionLabel;
    }

    return `${directionLabel}: ${port.label}`;
  }


}

if (!customElements.get("flow-node")) {
  customElements.define("flow-node", FlowNode);
}

declare global {
  interface HTMLElementTagNameMap {
    "flow-node": FlowNode;
  }
}

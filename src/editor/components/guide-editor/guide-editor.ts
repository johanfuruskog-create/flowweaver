import { BUILD_ID } from "../../core/build-id";
import { escapeHtml } from "../../../viewer/core/escape-html";
import styles from "./guide-editor.scss?inline";
import { needsPlatformFullscreen } from "./fullscreen-route";

import "../node-editor/node-editor";
import "../properties-panel/properties-panel";
import "../editor-toolbar/editor-toolbar";
import "../confirmation-dialog/confirmation-dialog";
import "../prompt-dialog/prompt-dialog";
import "../editor-toast/editor-toast";
import "../guide-preview-dialog/guide-preview-dialog";
import "../../../viewer/components/guide-preview/guide-preview";
import "../node-palette/node-palette";
import "../guide-outline/guide-outline";
import "../node-type-editor/node-type-editor";
import {
  getNodeTemplateBases,
  childrenFromTemplate,
  nodeFromTemplate,
  nodeToTemplate,
  templateCapability,
  templateValuesFromNodes,
  withNodeValues,
} from "../../../viewer/node-types/node-templates";
import {
  canEditGuide,
  canManageTemplates,
  isEditorMode,
} from "../../../viewer/types/node-types";
import type { EditorMode } from "../../../viewer/types/node-types";
import type { ThemeChoice } from "../../../viewer/core/theme";
import type { ProvingState } from "../../services/proving-trail-service";
import type { Answers } from "../../../viewer/core/answer-values";
import { stampGraphVersion } from "../../../viewer/core/graph-migrations";
import { getLinkPicker, resolveLinkReference } from "../../core/link-picker-registry";
import { findLinkReferences, rewriteLinkAddresses } from "../../../viewer/services/link-references";
import { formSkeleton } from "../../core/form-skeleton";
import { ensureBuiltinTemplates } from "../../node-types/builtin-templates";
import {
  getEditableLibrary,
  getLibrary,
  mergeIntoLibrary,
  setLibrary,
  subscribeToLibrary,
  removeFromLibrary,
  saveToLibrary,
  updateInLibrary,
  displayNodeTypeLabel,
} from "../../services/template-library";
import { QuestionOptionsService } from "../../../viewer/services/question-options-service";
import { PageFieldsService } from "../../../viewer/services/page-fields-service";
import { updateNodeData as updateGraphNodeData } from "../../core/graph-operations";
import { GraphHistory } from "../../core/graph-history";
import { getNodeType, isGuideStepNode, getNodeTypes } from "../../../viewer/node-types/node-type-registry";
import { exportGraphJson, importGraphJson } from "../../core/graph-io";
import { newGuideId } from "../../core/guide-id";
import { exportStamps } from "../../core/export-stamps";
import { alreadyAccepted, migrateIncoming } from "../../../viewer/core/accepted-graph";
import type { AcceptedGraph } from "../../../viewer/core/accepted-graph";
import {
  findGuidePathsToResult,
} from "../../../viewer/core/guide-route-analyzer";
import {
  getEditorCapabilities,
  isEditorFeatureLevel,
} from "../../config/editor-capabilities";
import type {
  EditorCapabilities,
  EditorFeatureLevel,
} from "../../config/editor-capabilities";
import {
  getCapabilitiesFromModules,
  modulesForFeatureLevel,
  parseModuleIds,
} from "../../config/editor-modules";

import type {
  GuideMeta,
  EmailResultOutput,
  FlowNodeData,
  GraphData,
  NodeTemplate,
} from "../../../viewer/types/graph";
import type {
  GraphChangedDetail,
  NodeDataChangedDetail,
  NodeLayoutChangedDetail,
  NodeOrderChangedDetail,
  NodeTemplateChangedDetail,
  NodeVisibilityChangedDetail,
  SelectionChangedDetail,
  QuestionOptionRemoveDetail,
  QuestionOptionMoveDetail,
  QuestionOptionReorderDetail,
  NodeTypeAddDetail,
  NodeTypeDragStartDetail,
  GraphImportRequestDetail,
  ToastRequestDetail,
  RuleCaseRemoveDetail,
  LocaleChangeDetail,
  GuideStringChangedDetail,
  GuideLocalesChangedDetail,
  GuideMetaChangedDetail,
  GuideSettingChangedDetail,
  NodeSelectDetail,
} from "../../types/events";
import {
  DEFAULT_SOURCE_LOCALE,
  DEFAULT_UI_LOCALE,
  getGuideLocales,
  getSourceLocale,
  resolveText,
} from "../../../viewer/core/localized-text";
import { interpolate, t } from "../../localization/editor-ui-strings";
import { TranslationProgressService } from "../../services/translation-progress-service";

import type {
  NodeEditor,
  ViewportCenter,
} from "../node-editor/node-editor";

import type { PropertiesPanel } from "../properties-panel/properties-panel";
import { QuestionVariableService } from "../../../viewer/services/question-variable-service";
import { GuideHealthService, type GuideHealthContext } from "../../services/guide-health-service";
import type { ConfirmationDialog } from "../confirmation-dialog/confirmation-dialog";
import type { PromptDialog } from "../prompt-dialog/prompt-dialog";
import type { EditorToolbar } from "../editor-toolbar/editor-toolbar";
import type { GuidePreviewDialog } from "../guide-preview-dialog/guide-preview-dialog";
import type { GuidePreview } from "../../../viewer/components/guide-preview/guide-preview";
import type { NodePalette } from "../node-palette/node-palette";
import { isOfferedNodeType } from "../node-palette/node-palette";
import type { FlowNode } from "../flow-node/flow-node";
import type { NodeTypeEditor } from "../node-type-editor/node-type-editor";
import {
  isTemplateFile,
  missingFormatOf,
  templateFileJson,
  templateNeeds,
} from "../../core/template-file";
import { attachPanelResize, CANVAS_KEEPS, parsePanelWidth } from "../../controllers/panel-resize";

import type {
  EditorToast,
  ToastOptions,
} from "../editor-toast/editor-toast";

/** Zoom the quick start never goes below — see handleNewFormRequest. */
const QUICK_START_ZOOM_FLOOR = 0.75;

/*
 * The folded side panel's two shortcuts (story 145, criterion 4; GRAFISK-PROFIL
 * decision 14): sliders for Egenskaper, an eye for Förhandsgranskning, 18 px
 * strokes on the content family's 24 px plate. The eye means preview and
 * nothing else on these rails, which is why the palette's ending is a flag.
 */
const PANEL_ICON_PROPERTIES = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--fw-node-content-tint)"/><circle cx="15" cy="17" r="3" fill="var(--fw-node-content-tint)"/></svg>`;
const PANEL_ICON_PREVIEW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`;

/** How long the panel takes to fold in or out (story 145, criterion 9). */
const PANEL_MOTION_MS = 180;

/** A step in the editor's tour. `open` expands a named menu first. */
interface TourStep {
  resolve: () => HTMLElement | null;
  text: string;
  open?: string;
}

/** A stop on the way through what is not yet translated. Story 017. */
type TranslationStop =
  | { kind: "node"; id: string }
  | { kind: "viewer-text"; key: string };

/** What the pro version's `<email-output-dialog>` offers the editor. */
interface EmailOutputDialogLike extends HTMLElement {
  open(output: EmailResultOutput, answers: Answers, graph: GraphData, locale: string): void;
}

export class GuideEditor extends HTMLElement {
  static readonly observedAttributes = [
    "feature-level",
    "modules",
    "mode",
    "mode-notice",
    "editor-locale",
    "active-locale",
    "theme",
    "get-started-href",
    "panel-width",
    "panel-open",
    "palette-open",
    "palette-search",
  ] as const;

  private readonly root: ShadowRoot;
  private featureLevelValue: EditorFeatureLevel = "advanced";
  /**
   * Module ids set via the `modules` attribute. `null` means no module control,
   * and then `feature-level` decides the capabilities. An empty list (the
   * attribute exists but is empty) means the core baseline with no extra
   * modules.
   */
  private moduleIds: string[] | null = null;
  private capabilityOverrides: Partial<EditorCapabilities> = {};
  /** Se `mode-notice` i `attributeChangedCallback`. */
  private modeNoticeValue = true;
  private capabilitiesValue = getEditorCapabilities("advanced");
  private selectedNodeId: string | null = null;
  /**
   * Which language of the *content* is being edited. Empty until a graph is
   * loaded — it then becomes the guide's source language, or the one the host
   * named.
   */
  private activeLocale: string = DEFAULT_SOURCE_LOCALE;

  /** The languages the picker currently offers, for the label. */
  private offeredLocales: Array<{ code: string; label: string; isSource?: boolean }> = [];
  /**
   * A starting language set by the host via `active-locale`.
   *
   * A view, not data: it is never stored in the guide (**K12c**). Without it a
   * translator lands in the first language that is not the source — choosing is
   * no task for someone invited precisely in order to translate.
   */
  private requestedLocale: string | null = null;
  /**
   * The editor's UI language (chrome), an axis of its own from `activeLocale`
   * (which drives what language the authored *content* is shown in). Set via
   * the `editor-locale` attribute on the tag, so the host page decides the
   * editor's language.
   */
  private editorLocale: string = DEFAULT_UI_LOCALE;
  private sidebarMode: "properties" | "preview" = "properties";
  /** Set via `panel-width` (story 141); null draws the default track. */
  private panelWidthValue: number | null = null;
  private panelResize: ReturnType<typeof attachPanelResize> | null = null;
  /** The fold that is still moving, ended when its 180 ms are up (story 145). */
  private panelMotionTimer: number | undefined;
  /** True for the one redraw a person's own open or fold asked for. */
  private panelMotionNext = false;
  /** Keeps the canvas's controls clear of the panel as its width changes. */
  private panelInsets: ResizeObserver | null = null;
  /** Redraws what depends on the palette when it opens, folds or goes. */
  private paletteWatch: MutationObserver | null = null;
  /** Makes the full palette a sheet when the editor is narrow. */
  private sheetWatch: ResizeObserver | null = null;
  private pendingFullscreenCenter: ViewportCenter | null = null;
  /** Uppskjuten historik/status-bokföring under live-skrivning. */
  private liveEditTimeout: number | null = null;

  /**
   * Which viewer text the jump last landed on, so the next jump continues from
   * it. A node's identity lives in the selection; a viewer text has nowhere
   * else to be remembered.
   */
  private lastViewerTextStop: string | null = null;

  /** The tour: the steps and where we are. */
  private tourSteps: TourStep[] = [];
  private tourIndex = 0;

  private graphData: GraphData = {
    startNodeId: null,
    nodes: [],
    connections: [],
  };

  private readonly history = new GraphHistory();

  set featureLevel(value: EditorFeatureLevel) {
    if (!isEditorFeatureLevel(value)) {
      return;
    }

    if (this.getAttribute("feature-level") !== value) {
      this.setAttribute("feature-level", value);
      return;
    }

    this.featureLevelValue = value;
    this.refreshCapabilities();
  }

  get featureLevel(): EditorFeatureLevel {
    return this.featureLevelValue;
  }

  /**
   * Which build of the editor is running — commit, uncommitted changes, time
   * (see `core/build-id.ts`). For a page that has to say what a device is
   * actually running when a fault is measured there: the text-field probe on
   * `dev/text-probe.html` (fynd f, 26/9), and a host's own support page.
   */
  get buildId(): string {
    return BUILD_ID;
  }

  set modules(value: string[] | null) {
    const attr = value === null ? null : value.join(" ");
    if (this.getAttribute("modules") !== attr) {
      if (attr === null) {
        this.removeAttribute("modules");
      } else {
        this.setAttribute("modules", attr);
      }
      return;
    }

    this.moduleIds = value === null ? null : parseModuleIds(attr);
    this.refreshCapabilities();
  }

  get modules(): string[] | null {
    return this.moduleIds === null ? null : [...this.moduleIds];
  }

  set capabilities(value: Partial<EditorCapabilities>) {
    this.capabilityOverrides = { ...value };
    this.refreshCapabilities();
  }

  get capabilities(): EditorCapabilities {
    return { ...this.capabilitiesValue };
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    newValue: string | null
  ): void {
    if (name === "active-locale") {
      this.requestedLocale = newValue;
      this.applyInitialLocale();
      return;
    }

    if (name === "theme") {
      this.theme = newValue === "dark" || newValue === "light" ? newValue : null;
      return;
    }

    if (name === "editor-locale") {
      this.editorLocale = newValue || DEFAULT_UI_LOCALE;
      this.applyEditorLocale();
      return;
    }

    if (name === "mode") {
      // Opt in: only an explicit, known mode grants capability. Unknown or
      // omitted stays on readonly — the host should ask, not happen to get.
      this.mode = isEditorMode(newValue) ? newValue : "readonly";
      return;
    }

    /**
     * `mode-notice="off"` — panelens ruta om varför fälten är låsta göms.
     *
     * För en värd som säger det själv, i sin egen rad ovanför canvasen
     * (berättelse 129): fyra ytor sa *läsläge* om samma tillstånd, och en
     * bärare per yta är regeln. **På som förval**, för en editor utan en värd
     * som förklarar något har bara panelen att göra det med — och låsta fält
     * utan förklaring ser trasiga ut i stället för avsiktliga.
     *
     * Ett attribut och ingen ny `EditorMode`: läget är vad man får göra, det
     * här är vem som säger det. Att blanda ihop dem hade gett två lägen som
     * betyder samma sak för allt utom en ruta.
     */
    if (name === "mode-notice") {
      this.modeNoticeValue = newValue !== "off";
      this.applyModeNotice();
      return;
    }

    if (name === "modules") {
      this.moduleIds = newValue === null ? null : parseModuleIds(newValue);
      this.refreshCapabilities();
      return;
    }

    if (name === "get-started-href") {
      this.applyGetStartedHref();
      return;
    }

    if (name === "panel-width") {
      this.panelWidthValue = parsePanelWidth(newValue);
      this.drawPanelWidth(this.panelWidthValue);
      this.panelResize?.sync();
      return;
    }

    if (name === "panel-open") {
      this.drawPanelOpen();
      return;
    }

    if (name === "palette-open" || name === "palette-search") {
      this.forwardPaletteState();
      return;
    }

    if (name !== "feature-level" || !isEditorFeatureLevel(newValue)) {
      return;
    }

    this.featureLevelValue = newValue;
    this.refreshCapabilities();
  }

  private refreshCapabilities(): void {
    // `modules`-attributet (om satt) styr; annars den namngivna nivån.
    const base =
      this.moduleIds === null
        ? getEditorCapabilities(this.featureLevelValue)
        : getCapabilitiesFromModules(this.moduleIds);
    this.capabilitiesValue = { ...base, ...this.capabilityOverrides };
    this.applyCapabilities();
  }

  private applyCapabilities(): void {
    const capabilities = { ...this.capabilitiesValue };

    const palette = this.root.querySelector<NodePalette>("node-palette");
    const propertiesPanel = this.getPropertiesPanel();
    const toolbar = this.getToolbar();
    const sidebarPreview = this.getSidebarPreview();

    if (palette) {
      palette.capabilities = capabilities;
      palette.hasPage = this.graphHasPage();

      /*
       * The templates too, and this line is the whole bug.
       *
       * The palette filters node types itself from `capabilities`, so changing
       * the level re-thinned that list — while the template list stayed as it
       * was, because only `refreshPalette()` sets it and a capability change
       * never called it. An editor moved from advanced to basic therefore kept
       * offering templates built on types it no longer had. Pressing one did
       * nothing at all: the add path checks the capability and refuses, without
       * a word.
       *
       * Found on the user-test page, where three buttons marked @, ☎ and #
       * sat doing nothing.
       */
      palette.templates = this.capableLibrarySpecs();
    }

    if (propertiesPanel) {
      propertiesPanel.capabilities = capabilities;
      propertiesPanel.modeNotice = this.modeNoticeValue;
    }

    if (toolbar) {
      toolbar.capabilities = capabilities;
      this.syncToolbarLocales();
      // A level is a bundle of modules, so the Modules menu mirrors the active
      // mode even when the editor is driven by feature-level rather than the
      // modules attribute.
      toolbar.modules =
        this.moduleIds ?? modulesForFeatureLevel(this.featureLevelValue);
    }

    const nodeEditorForHint = this.getNodeEditor();

    if (nodeEditorForHint) {
      // Tomma ytans snabbstartsrad följer menypostens villkor (varv 2, 2/9).
      nodeEditorForHint.quickStartHint = Boolean(capabilities.pages);
    }

    if (sidebarPreview) {
      sidebarPreview.routeAnalysisEnabled = capabilities.routeAnalysis;
      sidebarPreview.variableInspectorEnabled = capabilities.variables;
    }

    const selectedNode = this.selectedNodeId
      ? this.graphData.nodes.find((node) => node.id === this.selectedNodeId) ?? null
      : null;

    this.updatePropertiesPanel(selectedNode);
    this.updateConnectionHighlights();
  }

  /** Har guiden minst en Sida? Styr palettens sido-barn (Rubrik/Blank rad). */
  private graphHasPage(): boolean {
    return this.graphData.nodes.some((node) => node.type === "page");
  }

  /** Ritar om paletten och uppdaterar om sido-barnen ska visas. */
  private refreshPalette(): void {
    const palette = this.root.querySelector<NodePalette>("node-palette");
    if (!palette) {
      return;
    }
    palette.hasPage = this.graphHasPage();
    palette.templates = this.capableLibrarySpecs();
    palette.refresh();

    // The nodes' names come from the templates. If the library changes the
    // canvas must be told, otherwise a removed template's name lingers until
    // something else happens to redraw. The panel is not touched here —
    // refreshPalette runs mid-typing, and a re-rendered panel interrupts
    // whoever is writing.
    this.getNodeEditor()?.refreshNodes();
  }

  constructor() {
    super();

    this.root = this.attachShadow({
      mode: "open",
    });
  }

  /**
   * See the corresponding comment in guide-preview: properties set before the
   * bundle registered the class shadow the prototype's setters and are dropped
   * silently. Most common when the library is loaded as a script tag.
   */
  private static readonly UPGRADABLE = [
    "graph",
    "featureLevel",
    "modules",
    "capabilities",
    "panelWidth",
    "panelOpen",
    "paletteOpen",
  ] as const;

  private upgradeProperties(): void {
    const self = this as unknown as Record<string, unknown>;
    for (const name of GuideEditor.UPGRADABLE) {
      if (!Object.prototype.hasOwnProperty.call(this, name)) continue;
      const value = self[name];
      delete self[name];
      self[name] = value;
    }
  }

  /**
   * The languages the guide is offered in, for the picker.
   *
   * Moved here from `editor-toolbar` when the control moved to the context
   * row. The setters kept their behaviour to the letter — the picker is the
   * same control, standing somewhere with room.
   */
  private setGuideLocales(
    locales: ReadonlyArray<{ code: string; label: string; isSource?: boolean }>
  ): void {
    const select = this.root.querySelector<HTMLSelectElement>("[data-locale-select]");

    if (!select) {
      return;
    }

    const current = select.value;

    select.innerHTML = locales
      .map((locale) => `<option value="${locale.code}">${locale.label}</option>`)
      .join("");
    select.value = locales.some((locale) => locale.code === current)
      ? current
      : locales[0]?.code ?? "";

    /*
     * One language is nothing to choose between.
     *
     * A guide offered only in its source has a picker with a single option: it
     * opens, shows the language you are already in, and closes. That reads as
     * something being wrong — a list that will not let you pick. Disabled says
     * the truth, which is that there is nowhere else to go until the guide is
     * offered in another language.
     */
    select.disabled = locales.length < 2;

    this.offeredLocales = locales.map((locale) => ({ ...locale }));
    this.syncLocaleLabel();
  }

  /** Which language is being edited right now. Drives the label, not the list. */
  private setActiveLocaleControl(value: string): void {
    const select = this.root.querySelector<HTMLSelectElement>("[data-locale-select]");

    if (select && select.value !== value) {
      select.value = value;
    }
    this.syncLocaleLabel();
  }

  /** Says whether you are editing the source or translating, and into what. */
  private syncLocaleLabel(): void {
    const label = this.root.querySelector<HTMLElement>("[data-locale-label]");

    if (!label) {
      return;
    }

    const chosen =
      this.offeredLocales.find((locale) => locale.code === this.activeLocale) ??
      this.offeredLocales[0];

    label.textContent = chosen?.isSource
      ? this.text("editor.toolbar.editingSource")
      : this.text("editor.toolbar.translatingTo");
  }

  /**
   * Translation progress in the chosen language. null in source-language mode.
   *
   * `translated`/`total` count **fields** — a node has a title and a label per
   * option. `untranslatedStops` counts what the button actually jumps between,
   * which since story 017 is nodes *and* the guide's viewer texts. It was
   * called `untranslatedNodes` and the label said "nod", so a guide with three
   * untranslated nodes announced "52 noder kvar". Mixing them makes the label
   * promise one thing and say another.
   */
  private setTranslationProgress(
    value: { translated: number; total: number; untranslatedStops?: number } | null
  ): void {
    const shown = this.root.querySelector<HTMLElement>("[data-locale-progress]");
    const button = this.root.querySelector<HTMLButtonElement>(
      "[data-action='next-untranslated']"
    );

    if (button) {
      const left = value?.untranslatedStops ?? 0;

      // The button shows only when there is something to jump to. A button
      // that does nothing is worse than no button.
      button.hidden = !value || left === 0;
      button.textContent = this.text("editor.toolbar.nextUntranslated");
      button.setAttribute(
        "aria-label",
        this.text("editor.toolbar.nextUntranslatedAria", { n: left })
      );
    }

    if (!shown) {
      return;
    }
    if (!value || value.total === 0) {
      shown.hidden = true;
      shown.textContent = "";
      return;
    }

    shown.hidden = false;
    shown.textContent = this.text("editor.toolbar.translationProgress", {
      translated: value.translated,
      total: value.total,
    });
  }

  /** Hooks the picker and the jump button up to the events the editor listens for. */
  private bindLocaleRow(): void {
    const select = this.root.querySelector<HTMLSelectElement>("[data-locale-select]");

    /*
     * Dispatched from the control, not from the editor.
     *
     * `this.dispatchEvent` would make the host element the target, and the
     * event would leave the editor entirely — both of these turned up in the
     * frozen public surface as new events the moment the control moved here.
     * Sent from the select instead, they bubble to the shadow root where the
     * editor already listens, exactly as they did from the toolbar.
     */
    select?.addEventListener("change", (event) => {
      const target = event.target as HTMLSelectElement;

      target.dispatchEvent(
        new CustomEvent("locale-change", {
          detail: { locale: target.value },
          bubbles: true,
          composed: true,
        })
      );
    });

    const jump = this.root.querySelector<HTMLButtonElement>(
      '[data-action="next-untranslated"]'
    );

    jump?.addEventListener("click", () => {
      jump.dispatchEvent(
        new CustomEvent("next-untranslated-request", {
          bubbles: true,
          composed: true,
        })
      );
    });
  }

  /**
   * Shows the host's context line only when the host has put something in it.
   *
   * A bordered strip with nothing in it is a line the tool drew for no reason,
   * and every host that has nothing to say would get one. The slot tells us:
   * `assignedNodes` is empty until somebody slots something, and it fires
   * `slotchange` when that changes.
   */
  private watchContextSlot(): void {
    const slot = this.root.querySelector<HTMLSlotElement>('slot[name="context"]');
    const wrapper = this.root.querySelector<HTMLElement>("[data-context]");

    if (!slot || !wrapper) {
      return;
    }

    const update = (): void => {
      wrapper.hidden = slot.assignedNodes({ flatten: true }).length === 0;
    };

    slot.addEventListener("slotchange", update);
    update();
  }

  connectedCallback(): void {
    this.upgradeProperties();
    this.render();
    this.wirePanelResize();
    this.watchContextSlot();
    this.addEventListener("keydown", this.handleWideModeKeydown);
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);
    this.addEventListener("keydown", this.handleUndoRedoKeydown);
    this.addEventListener("keydown", this.handleHelpKeydown);
    this.addEventListener("keydown", this.handleQuickOpenShortcut);
    this.addEventListener("keydown", this.handleListViewKeydown);
    this.addEventListener("keydown", this.handleRegionKeydown);

  }

  disconnectedCallback(): void {
    this.panelResize?.detach();
    this.panelResize = null;
    this.panelInsets?.disconnect();
    this.panelInsets = null;
    this.paletteWatch?.disconnect();
    this.paletteWatch = null;
    this.sheetWatch?.disconnect();
    this.sheetWatch = null;
    window.clearTimeout(this.panelMotionTimer);
    this.templateUnsubscribe?.();
    this.templateUnsubscribe = null;

    this.removeEventListener("keydown", this.handleWideModeKeydown);
    document.removeEventListener("fullscreenchange", this.handleFullscreenChange);

    /*
     * An editor removed while it covered the page would leave the page unable to
     * scroll, with nothing left on screen to explain why.
     */
    if (this.hasAttribute("wide")) {
      document.body.style.overflow = this.previousBodyOverflow;
      this.previousBodyOverflow = "";
    }
    this.removeEventListener("keydown", this.handleUndoRedoKeydown);
    this.removeEventListener("keydown", this.handleHelpKeydown);
    this.pendingFullscreenCenter = null;
    this.flushLiveEditBookkeeping();
  }

  private readonly handleUndoRedoKeydown = (event: KeyboardEvent): void => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    // Ctrl/Cmd+S: capture the key (so the browser's "save page" does not
    // appear) and ask the host. The editor does not know where the guide is
    // saved — a host autosaves, or keeps versions, or saves with its page —
    // so a host that takes the request (preventDefault) owns the message,
    // and the fallback claims nothing about automatic saving (story 083; the
    // old "saved automatically in this browser" contradicted a version row
    // saying *Utkast · Spara*). Applies in fields too, hence before the field
    // guard below.
    if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      this.requestSave();
      return;
    }

    // Låt textfält behålla sitt eget ångra (Ctrl+Z i en input).
    const target = event.composedPath()[0];
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.matches("input, textarea, select"))
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      this.undo();
    } else if ((key === "z" && event.shiftKey) || key === "y") {
      event.preventDefault();
      this.redo();
    }
  };

  /** Opens the Shortcuts dialog with "?" (except while typing in a field). */
  /**
   * F6 moves to the next of the editor's four parts, Shift+F6 to the previous.
   *
   * Focus lands on the region itself. That is one rule rather than four, and it
   * is what makes the jump audible: each region carries a name, so arriving
   * announces where you are before you tab into it.
   */
  private readonly handleRegionKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "F6") {
      return;
    }

    const regions = [...this.root.querySelectorAll<HTMLElement>("[data-region]")];

    if (regions.length === 0) {
      return;
    }

    event.preventDefault();

    const here = (this.root.activeElement as HTMLElement | null)?.closest?.(
      "[data-region]",
    );
    const from = here ? regions.indexOf(here as HTMLElement) : -1;
    const step = event.shiftKey ? -1 : 1;
    const next = (from + step + regions.length) % regions.length;

    regions[next]?.focus();
  };

  private readonly handleHelpKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "?" || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const target = event.composedPath()[0];
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || target.matches("input, textarea, select"))
    ) {
      return;
    }
    event.preventDefault();
    this.openShortcuts();
  };

  /**
   * The form recipe, laid down on the canvas.
   *
   * The only place the skeleton is used, which is what makes the grip movable:
   * putting it in the palette instead of the File menu is a different button
   * dispatching the same event.
   *
   * **An empty guide becomes the form.** A guide that already holds something
   * gets the skeleton beside it and keeps its start node — inserting must never
   * quietly re-route a guide somebody is in the middle of.
   *
   * **One undo step because it is one `replaceGraph`**, not because of the
   * reason it carries. Measured: swapping the reason for `graph-imported`
   * changed no behaviour at all, so the claim that the reason is what makes
   * undo whole was simply wrong. The reason is for **listeners** — a host's
   * autosave or version list is told what kind of change this was — and it is
   * pinned by a test of its own so it cannot quietly become decorative.
   */
  private readonly handleNewFormRequest = (): void => {
    const nodeEditor = this.getNodeEditor();

    if (!nodeEditor) {
      return;
    }

    const skeleton = formSkeleton(nodeEditor.getSuggestedNodePosition());
    const current = this.getData();
    const empty = current.nodes.length === 0;

    this.replaceGraph(
      {
        ...current,
        startNodeId: empty ? skeleton.startNodeId : current.startNodeId,
        nodes: [...current.nodes, ...skeleton.nodes],
        connections: [...current.connections, ...skeleton.connections],
      },
      "form-skeleton-added",
    );

    /*
     * Focus to the page's heading, so the first thing to do — name the errand —
     * is where the cursor already is. A skeleton that lands silently leaves
     * somebody hunting for what changed.
     *
     * And the view to the skeleton (story 081's assessment, 3/9): the graph
     * changed under a view that stayed put, so the selected page stood half
     * behind the palette while the card on screen was the second one.
     */
    const editorAfter = this.getNodeEditor();
    editorAfter?.selectNodeById(skeleton.nodes[0]!.id);
    editorAfter?.fitToContent(true);

    /*
     * The skeleton is ~1 900 px wide, so fitting all of it lands the zoom
     * around 55 % on a laptop and 30 % in a 1 200 px editor: the cards go
     * unreadable (3/9, Johan: a floor). Below the floor the view zooms back
     * to it and centres on the selected page — the whole skeleton is "Passa
     * in" away, the page one names the errand on is what should be readable.
     */
    if (editorAfter && editorAfter.getZoom() < QUICK_START_ZOOM_FLOOR) {
      editorAfter.setZoom(QUICK_START_ZOOM_FLOOR);
      editorAfter.centerNodeById(skeleton.nodes[0]!.id);
    }
  };

  private readonly handleShortcutsRequest = (): void => {
    this.openShortcuts();
  };

  set graph(value: GraphData) {
    const incoming = migrateIncoming(value);

    if (!incoming.ok) {
      // The door's own sentence, shown as it stands: it already says which
      // version was offered and which is supported.
      this.showToast({ message: incoming.message, type: "error" });
      return;
    }

    this.#loadGraph(incoming.graph);
    // En ny guide läses in: nollställ ångra-historiken till detta nuläge.
    this.history.reset(this.graphData);
    this.updateUndoRedoState();
    void this.refreshLinkAddresses();
  }

  /**
   * Asks the host about every link that carries its reference (story 100)
   * and takes what it answers: a moved page gets its new address written
   * into the text — as a change, so the guide reads as unsaved and the
   * editor sees it — and a page that is gone becomes a health warning.
   * Nothing without a host that answers; nothing fetched by the library.
   *
   * The answers arrive after the guide is on screen. If the editor has
   * changed anything meanwhile the rewrite is dropped rather than applied
   * over their work — the health check still reads the answers, and the
   * next opening rewrites.
   */
  private async refreshLinkAddresses(): Promise<void> {
    const links = findLinkReferences(this.graphData);

    if (links.length === 0 || !getLinkPicker()?.resolve) {
      return;
    }

    const opened = JSON.stringify(this.graphData);
    const fresh = new Map<string, string>();

    await Promise.all(
      [...new Set(links.map((link) => link.ref))].map(async (ref) => {
        const answer = await resolveLinkReference(ref);

        if (answer) fresh.set(ref, answer.url);
      }),
    );

    if (JSON.stringify(this.graphData) !== opened) {
      this.updateHealth();
      return;
    }

    const rewritten = rewriteLinkAddresses(this.graphData, (ref) => fresh.get(ref));

    if (rewritten === this.graphData) {
      this.updateHealth();
      return;
    }

    this.replaceGraph(rewritten, "guide-updated");
  }

  /** Applies a graph to the interface without touching the undo history. */
  /*
   * `#`-privat, inte TS-privat.
   *
   * TypeScripts `private` finns bara vid kompilering: en värd som skriver ren
   * JS kunde anropa `element.loadGraph(graf)` och hoppa förbi dörren — alltså
   * förbi migreringen och de två kontrollerna den gör. Märkningen skyddar mot
   * misstag i vår egen kod; det här stänger vägen utifrån.
   */
  #loadGraph(value: AcceptedGraph): void {
    // A run under way is over: the guide it was running is being replaced —
    // by an undo, a redo, an import, a reset or a new guide altogether.
    this.staleProving();
    this.endRoutes();
    this.graphData = structuredClone(value);
    this.selectedNodeId = null;
    // The guide's carried templates are merged into the global library, and the
    // whole library is registered before the nodes are drawn (templates shared
    // between guides).
    ensureBuiltinTemplates();
    mergeIntoLibrary(this.graphData.settings?.nodeTemplates ?? []);
    this.refreshPalette();
    this.applyInitialLocale();
    this.updateNodeEditor();
    this.updatePropertiesPanel(null);
    this.updateStartNodeWarning();
    this.refreshSidebarPreview();
  }

  get graph(): GraphData {
    return this.getData();
  }

  /**
   * The node templates, set by the host.
   *
   * The library does not store them — where they are saved and how widely they
   * are shared is the host system's call. Set nothing and you get the built-in
   * ones. See K6d and K6e in `docs/KRAV.md`.
   */
  private templateUnsubscribe: (() => void) | null = null;

  /**
   * What the editor lets a user change: `edit`, `translator` or `readonly`.
   *
   * A mode is a view, not data — it is never stored in the guide. And it is not
   * protection: it runs in a browser and can be bypassed. Permissions are the
   * host's. See `docs/STORIES/004-lamna-over-till-oversattare.md`.
   */
  set mode(value: EditorMode) {
    if (this.modeValue === value) {
      return;
    }

    this.modeValue = value;
    this.applyMode();
    this.applyTemplatePermission();
    // A translator should land in a language, not in an empty state.
    this.applyInitialLocale();
  }

  /**
   * Pushes the guide's languages and the active one out to the toolbar.
   *
   * Must be re-run after every re-render of the chrome: the label says whether
   * you are editing the source or translating, and a fresh render starts with
   * the default text "Språk".
   */
  private syncToolbarLocales(): void {
    const toolbar = this.getToolbar();
    if (!toolbar) {
      return;
    }

    this.setGuideLocales(
      getGuideLocales(
        this.graphData.settings?.locales,
        getSourceLocale(this.graphData),
        this.editorLocale
      )
    );
    this.setActiveLocaleControl(this.activeLocale);
  }

  /** Vilket språk av innehållet som redigeras just nu. */
  get contentLocale(): string {
    return this.activeLocale;
  }

  get mode(): EditorMode {
    return this.modeValue;
  }

  /**
   * Opt in, not opt out: a host that says nothing gets a guide to look at.
   * Capability is given, it does not happen to arise.
   */
  private modeValue: EditorMode = "readonly";

  /**
   * Which language the editor should land in.
   *
   * The host's choice applies if it is among the guide's languages. Otherwise a
   * translator lands in the first language that is not the source — the "choose
   * a language to begin translating" state is no task for someone invited
   * precisely in order to translate. Everyone else lands in the source, which is
   * where you author.
   */
  private applyInitialLocale(): void {
    const languages = getGuideLocales(
      this.graphData.settings?.locales,
      getSourceLocale(this.graphData)
    );

    const wanted =
      this.requestedLocale &&
      languages.find((locale) => locale.code === this.requestedLocale)?.code;

    const next =
      wanted ||
      (this.modeValue === "translator"
        ? languages.find((locale) => !locale.isSource)?.code
        : undefined) ||
      getSourceLocale(this.graphData);

    if (next !== this.activeLocale) {
      this.setActiveLocale(next);
    }
  }

  /** Pushes the mode out to the canvas, the panel and the palette. */
  private applyMode(): void {
    const mode = this.modeValue;

    const nodeEditor = this.getNodeEditor();
    const panel = this.getPropertiesPanel();

    if (nodeEditor) {
      nodeEditor.editorMode = mode;
    }

    if (panel) {
      panel.editorMode = mode;
    }

    // The palette exists only to create nodes.
    const palette = this.shadowRoot?.querySelector<HTMLElement>("node-palette");

    if (palette) {
      palette.hidden = !canEditGuide(mode);
    }

    // The Vy menu's two "show them all" rows: a canvas that cannot be changed
    // shows the visitor's view everywhere and offers no way out of it.
    const toolbar = this.getToolbar();

    if (toolbar) {
      toolbar.canEdit = canEditGuide(mode);
    }

    this.setAttribute("data-mode", mode);
  }

  /**
   * Mirrors the template permission to the parts that offer template
   * management.
   *
   * The library is shared: a template changed or removed shows through in every
   * guide on the site. That is the ladder's top rung — the most capability, the
   * fewest people.
   */
  /**
   * Help → Getting started leads to a page the host has, named by the
   * `get-started-href` attribute. Without it the item is gone; an item that
   * does nothing is worse than none (measured on a bare host, 3/9).
   */
  private applyGetStartedHref(): void {
    const toolbar = this.getToolbar();
    if (toolbar) toolbar.getStartedHref = this.getAttribute("get-started-href");
  }

  private applyTemplatePermission(): void {
    const allowed = canManageTemplates(this.modeValue);
    const toolbar = this.getToolbar();
    const canvas = this.getNodeEditor();
    const panel = this.getPropertiesPanel();

    if (toolbar) toolbar.canManageTemplates = allowed;
    if (canvas) canvas.canManageTemplates = allowed;
    if (panel) panel.canManageTemplates = allowed;
  }

  /**
   * A light or dark theme for the editor. `null` means follow the OS setting.
   *
   * Set on the **element**, not on the document: an editor embedded in a host's
   * own page must not recolour the page around it. The library does not store
   * the choice and announces nothing: whoever offers the toggle announces it
   * with `theme-change` (the example site's `<theme-toggle>` does), and the
   * host decides whether it remembers (K6d).
   */
  set theme(value: ThemeChoice | null) {
    // `data-fw-theme`, not `data-theme`: the latter is a convention the host may
    // use itself, and the tokens must not hang off their element.
    if (value) {
      this.dataset.fwTheme = value;
    } else {
      delete this.dataset.fwTheme;
    }
  }

  get theme(): ThemeChoice | null {
    const value = this.dataset.fwTheme;
    return value === "dark" || value === "light" ? value : null;
  }

  /**
   * The side panel's width in px, as the editor last dragged it or the host
   * set it; null is the default track (story 141).
   *
   * The library never stores it (K6e). A drag or key press on the panel's edge
   * ends in `panel-width-changed` with `{ width }` — null after a reset — and
   * the host decides whether to remember it and hand it back here. The value
   * is the one asked for; what is drawn is held between 380 and the editor's
   * width less 620, so a narrower window never pushes the toolbar over.
   */
  set panelWidth(value: number | null) {
    const width = value === null ? null : parsePanelWidth(String(value));

    if (width === null) {
      this.removeAttribute("panel-width");
    } else {
      this.setAttribute("panel-width", String(width));
    }
  }

  get panelWidth(): number | null {
    return this.panelWidthValue;
  }

  /**
   * Whether the side panel is open over the canvas (story 145).
   *
   * Folded is the default: an editor without a word from its host starts with
   * the whole canvas (criterion 10). The library never stores it (K6e,
   * criterion 11). Opening or folding it — with «, », a shortcut, a double-click
   * or Enter on a node — ends in `panel-open-changed` with `{ open }`, and the
   * host decides whether to remember it and set it here before the editor is
   * first drawn, so an open panel never flashes in as folded.
   *
   * A view, not data: it is not a change to the guide and not a step to undo
   * (criterion 6).
   */
  set panelOpen(value: boolean) {
    this.toggleAttribute("panel-open", value === true);
  }

  get panelOpen(): boolean {
    return this.hasAttribute("panel-open");
  }

  /**
   * Whether the full node palette is open over the canvas (story 145/146).
   * Folded is the default: the palette is then its 57 px rail of categories.
   * Same contract as `panelOpen`: the host sets it before the first paint and
   * hears `palette-open-changed` with `{ open }` when the editor changes it;
   * the library stores nothing.
   *
   * `palette-search="off"` leaves *Sök nod* out — whether the palette has a
   * search is the host's choice when it sets the editor up (Johan 7/10).
   */
  set paletteOpen(value: boolean) {
    this.toggleAttribute("palette-open", value === true);
  }

  get paletteOpen(): boolean {
    return this.hasAttribute("palette-open");
  }

  /** Hands the palette what the host said: open or folded, with or without search. */
  private forwardPaletteState(): void {
    const palette = this.root.querySelector<NodePalette>("node-palette");

    if (!palette) return;

    palette.open = this.paletteOpen;
    if (this.getAttribute("palette-search") === "off") {
      palette.setAttribute("search", "off");
    } else {
      palette.removeAttribute("search");
    }
  }

  /**
   * Both panels open, and not room for both and the canvas's controls (story
   * 145, open question 1): the one opened last stays, the other folds. Claude's
   * recommendation, built as the rule until Johan settles it.
   */
  private makeRoomFor(opened: "panel" | "palette"): void {
    if (!this.panelOpen || !this.paletteOpen) return;

    const canvas = this.root.querySelector<HTMLElement>(".guide-editor__canvas");
    const panel = this.root.querySelector<HTMLElement>(".guide-editor__sidebar");
    const full = this.root.querySelector<NodePalette>("node-palette")?.overlayBox();

    if (!canvas || !panel || !full) return;

    const left = canvas.getBoundingClientRect().width - (full.right - canvas.getBoundingClientRect().left);
    const room = left - (panel.getBoundingClientRect().width - (this.root.querySelector<HTMLElement>("[data-panel-rail]")?.getBoundingClientRect().width ?? 0));

    if (room >= CANVAS_KEEPS) return;

    if (opened === "panel") {
      this.paletteOpen = false;
      this.dispatchEvent(
        new CustomEvent<{ open: boolean }>("palette-open-changed", {
          detail: { open: false },
          bubbles: true,
          composed: true,
        })
      );
    } else {
      this.setPanelOpen(false, "none");
    }
  }

  /**
   * A person opened or folded the panel: draw it moving, tell the host, and put
   * focus where the next key press is expected — on the tab when it opens from
   * the rail, on « when it folds (criterion 12).
   */
  private setPanelOpen(open: boolean, focus: "tab" | "opener" | "none"): void {
    if (this.panelOpen !== open) {
      this.panelMotionNext = true;
      this.panelOpen = open;
      this.panelMotionNext = false;
      this.dispatchEvent(
        new CustomEvent<{ open: boolean }>("panel-open-changed", {
          detail: { open },
          bubbles: true,
          composed: true,
        })
      );
    }
    if (open) this.makeRoomFor("panel");

    if (focus === "tab") {
      this.root
        .querySelector<HTMLButtonElement>(`[data-sidebar-mode="${this.sidebarMode}"]`)
        ?.focus({ preventScroll: true });
    } else if (focus === "opener") {
      this.root
        .querySelector<HTMLButtonElement>('[data-action="panel-open"]')
        ?.focus({ preventScroll: true });
    }
  }

  /**
   * Draws the panel open or folded.
   *
   * Moving only when a person asked (`panelMotionNext`) — a host restoring its
   * saved state before the first paint gets the end state at once — and never
   * under reduced motion. A folding panel is inert from the first frame and
   * leaves the accessibility tree; it is hidden when its 180 ms are up. An open
   * that arrives before then cancels the fold (criterion 9).
   */
  private drawPanelOpen(): void {
    const frame = this.root.querySelector<HTMLElement>(".guide-editor");
    const panel = this.root.querySelector<HTMLElement>(".guide-editor__sidebar");
    const rail = this.root.querySelector<HTMLElement>("[data-panel-rail]");
    const opener = this.root.querySelector<HTMLButtonElement>('[data-action="panel-open"]');

    if (!frame || !panel || !rail) return;

    const open = this.panelOpen;
    const moving =
      this.panelMotionNext &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wasShown = !panel.hidden && panel.dataset.motion !== "closing";

    window.clearTimeout(this.panelMotionTimer);
    this.panelMotionTimer = undefined;
    opener?.setAttribute("aria-expanded", String(open));
    frame.toggleAttribute("data-panel-open", open);

    if (open) {
      panel.hidden = false;
      panel.inert = false;
      rail.inert = true;

      if (moving && !wasShown) {
        panel.dataset.motion = "opening";
        this.panelMotionTimer = window.setTimeout(() => {
          delete panel.dataset.motion;
          this.panelMotionTimer = undefined;
        }, PANEL_MOTION_MS);
      } else {
        delete panel.dataset.motion;
      }
    } else {
      panel.inert = true;
      rail.inert = false;

      if (moving && wasShown) {
        panel.dataset.motion = "closing";
        this.panelMotionTimer = window.setTimeout(() => {
          panel.hidden = true;
          delete panel.dataset.motion;
          this.panelMotionTimer = undefined;
          this.drawCanvasInsets();
        }, PANEL_MOTION_MS);
      } else {
        panel.hidden = true;
        delete panel.dataset.motion;
      }
    }

    this.drawCanvasInsets();
    this.panelResize?.sync();
  }

  /**
   * Tells the canvas how much of it an open panel covers, so its map, zoom bar
   * and health badge step aside (criterion 8). Set on the canvas's box, which
   * holds both `<node-editor>` and the badge; the canvas keeps its width.
   */
  private drawCanvasInsets(): void {
    const canvas = this.root.querySelector<HTMLElement>(".guide-editor__canvas");
    const panel = this.root.querySelector<HTMLElement>(".guide-editor__sidebar");

    if (!canvas || !panel) return;

    canvas.style.removeProperty("--fw-canvas-left-inset");
    canvas.style.removeProperty("--fw-canvas-right-inset");

    const canvasBox = canvas.getBoundingClientRect();
    // The controls are placed physically (Astra 29/9), so the insets are named
    // by side: right to left the side panel stands at the left edge and the
    // palette at the right.
    const rtl = getComputedStyle(this).direction === "rtl";
    let left = 0;
    let right = 0;

    if (!panel.hidden) {
      const box = panel.getBoundingClientRect();

      if (rtl) left = box.right - canvasBox.left;
      else right = canvasBox.right - box.left;
    }

    const overlay = this.root.querySelector<NodePalette>("node-palette")?.overlayBox();

    if (overlay) {
      if (rtl) right = Math.max(right, canvasBox.right - overlay.left);
      else left = Math.max(left, overlay.right - canvasBox.left);
    }

    if (left > 0) canvas.style.setProperty("--fw-canvas-left-inset", `${Math.round(left)}px`);
    if (right > 0) canvas.style.setProperty("--fw-canvas-right-inset", `${Math.round(right)}px`);
  }

  /**
   * Whether the palette's rail is there at all (it is not in the read-only
   * modes), which the stylesheet turns into its column's width for the side
   * panel's ceiling (see `.guide-editor__sidebar`).
   */
  private drawPaletteState(): void {
    const frame = this.root.querySelector<HTMLElement>(".guide-editor");
    const palette = this.root.querySelector<HTMLElement>("node-palette");

    if (!frame || !palette) return;

    frame.dataset.palette = palette.hidden ? "none" : "rail";
  }

  /** Puts a width on the grid, or takes it off for the default track. */
  private drawPanelWidth(width: number | null): void {
    const frame = this.root.querySelector<HTMLElement>(".guide-editor");

    if (!frame) return;

    if (width === null) {
      frame.style.removeProperty("--guide-editor-panel-width");
      delete frame.dataset.panelWidth;
    } else {
      frame.style.setProperty("--guide-editor-panel-width", `${width}px`);
      frame.dataset.panelWidth = "";
    }

    // The controls follow the new width now, not at the observer's next turn.
    this.drawCanvasInsets();
  }

  private wirePanelResize(): void {
    this.panelResize?.detach();

    const frame = this.root.querySelector<HTMLElement>(".guide-editor");
    const panel = this.root.querySelector<HTMLElement>(".guide-editor__sidebar");
    const handle = this.root.querySelector<HTMLElement>("[data-panel-resize]");

    if (!frame || !panel || !handle) return;

    const canvas = this.root.querySelector<HTMLElement>(".guide-editor__canvas");
    const rail = this.root.querySelector<HTMLElement>("[data-panel-rail]");

    this.drawPanelWidth(this.panelWidthValue);
    this.drawPanelOpen();
    this.forwardPaletteState();
    this.drawPaletteState();
    this.paletteWatch?.disconnect();
    this.paletteWatch = new MutationObserver(() => {
      this.drawPaletteState();
      this.drawCanvasInsets();
    });
    const palette = this.root.querySelector<NodePalette>("node-palette");
    const workspace = this.root.querySelector<HTMLElement>(".guide-editor__workspace");
    if (palette) {
      this.paletteWatch.observe(palette, { attributes: true, attributeFilter: ["hidden", "open", "data-overlay"] });
    }
    /*
     * Under 600 px of editor the whole palette is a sheet over the screen
     * (story 145, decided 6/10) — measured against the editor, not the window,
     * since an editor in a narrow dialog on a wide screen is just as narrow.
     */
    this.sheetWatch?.disconnect();
    if (palette && workspace) {
      this.sheetWatch = new ResizeObserver(() => {
        palette.toggleAttribute("sheet", workspace.getBoundingClientRect().width < 600);
      });
      this.sheetWatch.observe(workspace);
    }
    this.panelInsets?.disconnect();
    this.panelInsets = new ResizeObserver(() => this.drawCanvasInsets());
    this.panelInsets.observe(panel);
    if (canvas) this.panelInsets.observe(canvas);
    this.panelResize = attachPanelResize({
      frame,
      panel,
      handle,
      menuHolder: this.getToolbar(),
      canvas,
      // The room the panel lies over: the canvas and the rail it covers.
      room: () =>
        (canvas?.getBoundingClientRect().width ?? 0) + (rail?.getBoundingClientRect().width ?? 0),
      apply: (width) => this.drawPanelWidth(width),
      done: (width) => {
        // Reflected, so the property and the attribute say what is drawn.
        this.panelWidth = width;
        this.dispatchEvent(
          new CustomEvent<{ width: number | null }>("panel-width-changed", {
            detail: { width },
            bubbles: true,
            composed: true,
          })
        );
      },
    });
  }

  /**
   * Sets the editor's theme. `null` hands the decision back to the OS setting.
   *
   * The editor has no theme button of its own: a toggle is the **host's
   * chrome**, not the guide's content. The host builds its control where it
   * belongs in their interface and calls in here — the same direction as for the
   * guide and the templates.
   */
  setTheme(theme: ThemeChoice | null): void {
    this.theme = theme;
  }

  set nodeTemplates(value: unknown) {
    setLibrary(value);
    this.refreshPalette();
  }

  get nodeTemplates(): NodeTemplate[] {
    return getEditableLibrary();
  }

  /**
   * The guide as it stands: nodes from the canvas, settings from here.
   *
   * The two halves have different owners. The node editor holds the nodes and
   * connections and is the only thing that changes them; guide-level settings —
   * the languages it is offered in, the texts an editor customised, the source
   * language — are changed here and never there.
   *
   * This used to return the node editor's copy whole, and its `settings` is
   * whatever was set when the graph was loaded. So every guide-level change was
   * applied to `this.graphData`, shown correctly in the panel, recorded in the
   * history — and then dropped on the way out. `graph-changed` carries
   * `getData()`, which means the host saved a guide without them.
   *
   * `setSettings` exists on the node editor for this and is called from
   * nowhere. Taking the settings from their owner is the smaller fix and the
   * truer one: there is then no second copy to keep in step.
   *
   * **No falling back to the canvas's copy when there are no settings.** It
   * used to, and that was the same bug one case smaller: turning the progress
   * meter off (story 116) leaves a guide whose only setting is gone with no
   * settings at all, and the canvas still held the copy from load — so the
   * meter came back out switched on. An owner that hands over a stale copy
   * when its own is empty is not an owner.
   */
  getData(): GraphData {
    const nodeEditor = this.getNodeEditor();
    const fromCanvas = nodeEditor
      ? nodeEditor.getData()
      : structuredClone(this.graphData);

    /*
     * Stamped here, and only here.
     *
     * The graph the editor works on carries no version on purpose — see
     * `migrateIncoming`: a field that differs between two otherwise identical
     * states makes every comparison falsely positive, the undo history
     * included. But this is the boundary, and what crosses it gets stored.
     *
     * Unstamped, a guide reached a file with no statement of its format, and
     * coming back `readGraphVersion` called it v1 — right for a genuinely old
     * file, wrong for something written yesterday. The v1→v3 migrations cannot
     * tell old data from new; they rewrite text the editor had just written.
     * Measured on the SiteVision module, which stores
     * `JSON.stringify(editor.getData())`.
     *
     * The rule the rest of the codebase already follows: stamp on the way out,
     * migrate on the way in, and never guess in between.
     */
    return stampGraphVersion(
      this.bundleUsedNodmallar({
        ...fromCanvas,
        settings: this.graphData.settings
          ? structuredClone(this.graphData.settings)
          : undefined,
      }),
    );
  }

  showToast(options: ToastOptions): void {
    this.getToast()?.show(options);
  }

  replaceGraph(value: GraphData, reason: GraphChangedDetail["reason"]): void {
    // Import and reset are undoable steps (they do not go through the node
    // editor's graph-changed), so they are recorded here rather than resetting.
    const incoming = migrateIncoming(value);

    if (!incoming.ok) {
      this.showToast({ message: incoming.message, type: "error" });
      return;
    }

    this.#loadGraph(incoming.graph);
    this.history.record(this.graphData, reason);
    this.updateUndoRedoState();

    this.dispatchEvent(
      new CustomEvent<GraphChangedDetail>("graph-changed", {
        detail: {
          graph: this.getData(),
          reason,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /** Undoes the last step if there is one. */
  /**
   * Take me to that node: selects it and brings it into view.
   *
   * The editor has always done this — the health strip's *Gå till noden* is
   * exactly these two calls — but only from inside itself. Story 125 puts the
   * same act in a host's hands: the publish dialog lists what blocks a
   * publication, and a list that names a problem without a way to it is a list
   * that hands somebody a search.
   *
   * One implementation behind both, so the two cannot drift into selecting
   * without centring, or centring without selecting.
   *
   * `fieldId` takes it one step further in: the card is the address, the field
   * is the door. Without it a journey to a fault in *Spara svaret som* ends on
   * a node with the destination folded away under **Avancerat** — Johan
   * 23/9 2026: *"Öppna gruppen automatiskt när användaren navigerar till ett
   * valideringsfel i ett dolt fält, och fokusera då rätt fält."* Which group a
   * field lives in is the panel's business, so this only passes the id on; see
   * `focusField`.
   */
  revealNode(nodeId: string, fieldId?: string): void {
    const nodeEditor = this.getNodeEditor();

    nodeEditor?.selectNodeById(nodeId);
    nodeEditor?.centerNodeById(nodeId);

    if (fieldId) {
      // A field is in the panel, so the panel opens on Egenskaper first
      // (story 145): a door into a folded panel opens nothing.
      this.setSidebarMode("properties");
      this.setPanelOpen(true, "none");
      // After the selection, which is what redraws the panel for this node.
      this.getPropertiesPanel()?.focusField(fieldId);
    }
  }

  /**
   * Same guide, new content — without moving the person watching it.
   *
   * `graph = …` means *a different guide*: it resets the undo history, clears
   * the selection and puts the view back over the content, all of which is
   * right when a guide is opened. It is wrong when the same guide arrives
   * again with somebody else's latest words in it — a read-only window
   * following along while a colleague works (story 129). There the view is the
   * watcher's own: they panned and zoomed to the part they care about, and a
   * redraw that snaps back every few seconds does not let them follow, it
   * moves them.
   *
   * Measured before this existed: a node standing at 247,453 was at 342,363
   * after the next refresh. The viewport centre is read, the graph replaced,
   * and the centre put back through `restoreViewportCenter`, which holds it
   * through the layout changes that follow.
   */
  refreshGraph(value: GraphData): void {
    const nodeEditor = this.getNodeEditor();
    const center = nodeEditor?.getViewportCenter() ?? null;

    this.graph = value;

    if (center) {
      this.getNodeEditor()?.restoreViewportCenter(center);
    }
  }

  undo(): void {
    // Make sure an in-progress typing session is recorded before we undo.
    this.flushLiveEditBookkeeping();
    const graph = this.history.undo();
    if (!graph) {
      return;
    }
    this.applyHistoryGraph(graph);
  }

  /** Gör om ett ångrat steg om det finns något. */
  redo(): void {
    this.flushLiveEditBookkeeping();
    const graph = this.history.redo();
    if (!graph) {
      return;
    }
    this.applyHistoryGraph(graph);
  }

  private applyHistoryGraph(graph: GraphData): void {
    // The history's snapshots never left the editor, so they must not be
    // re-migrated: the guessing migrations cannot tell old data from new and
    // would normalise text just typed. See `accepted-graph.ts`.
    this.#loadGraph(alreadyAccepted(graph));
    this.updateUndoRedoState();

    // Dispatched on the host element (not the shadow root) so autosave keeps
    // up, but without going through handleGraphChanged and being recorded
    // again.
    this.dispatchEvent(
      new CustomEvent<GraphChangedDetail>("graph-changed", {
        detail: {
          graph: this.getData(),
          reason: "graph-reset",
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private render(): void {
    this.root.innerHTML = `
      <style>${styles}</style>

      <div class="guide-editor">
        <!--
          Ärligt besked i stället för halvt stöd (Johan 2/9): editorn är
          byggd för större skärmar, visaren är mobilens produkt. Ren
          media-query — Sitevisions smala DIALOG på en stor skärm ska
          inte få beskedet, bara en liten skärm ska.
        -->
        <p class="guide-editor__small-screen" data-small-screen-notice>${this.text("editor.shell.smallScreenNotice")}</p>
        <div class="guide-editor__main">
          <div class="guide-editor__warning" data-start-node-warning role="alert" hidden data-i18n="editor.shell.startNodeWarning">
            ${this.text("editor.shell.startNodeWarning")}
          </div>
          <editor-toolbar></editor-toolbar>

          <!--
            Where a host says what is being edited.
            
            The editor knows nothing about versions, drafts or files, and it
            should not — but it is the only surface that survives full screen,
            because it is the element that goes full screen. A line the host
            draws above it disappears exactly when somebody is deepest in the
            work and most likely to have forgotten which version they are in.
            
            So it is a slot: the host puts whatever it means in there — a name,
            a mark saying *publicerad* — and we place it where the eye already
            goes between the toolbar and the canvas. Empty for every host that
            has nothing to say, which is why it collapses to nothing.
          -->
          <!--
            Två poster på en rad: värdens sammanhang till vänster, språkvalet
            till höger.

            Språkvalet satt i verktygsfältet och trängdes där. "Redigerar
            källan" bröt i två rader i ett 56 px högt fält, och gjordes det om
            till en rad sköt det i stället språkväljaren utanför kanten — mätt
            till 39 px vid den bredd en editor får bredvid egenskapspanelen,
            alltså det vanligaste fallet. Den här raden har plats.

            Raden ritas alltid, till skillnad från förut. Det är *första*
            posten som fälls ihop när värden inte slottar något — annars skulle
            språkvalet försvinna för varje inbäddning som inte har någon
            sammanhangsrad, vilket är de flesta.
          -->
          <ul
            class="guide-editor__context"
            data-region="actions"
            tabindex="-1"
            role="group"
            aria-label="${this.text("editor.shell.actions")}"
            data-i18n-aria="editor.shell.actions"
          >
            <li class="guide-editor__context-host" data-context hidden>
              <slot name="context"></slot>
            </li>
            <li class="guide-editor__locale">
              <!--
                Etiketten säger vad valet betyder — att man redigerar källan
                eller översätter till ett annat språk. Förut stod det bara
                "Språk", och då bytte man tyst vad man skrev i.
              -->
              <span data-locale-label></span>
              <span class="guide-editor__locale-select"><select
                data-locale-select
                aria-label="${this.text("editor.toolbar.localeAria")}"
                data-i18n-aria="editor.toolbar.localeAria"
              ></select></span>
              <span class="guide-editor__locale-progress" data-locale-progress role="status" hidden></span>
              <!--
                Hoppet till nästa oöversatta nod. Hör till att ett annat språk
                än källan är valt, inte till ett läge: den som översätter sin
                egen guide behöver det lika mycket som en inhyrd översättare.
              -->
              <button
                type="button"
                class="guide-editor__next-untranslated"
                data-action="next-untranslated"
                hidden
              ></button>
            </li>
          </ul>
          <div class="guide-editor__workspace">
            <!--
              The F6 region sits on a wrapper, not on <node-palette>: a shadow
              host with tabindex="-1" takes its whole shadow tree out of the
              Tab order, so the palette was reachable by F6 alone (story 081).
              The other regions are plain elements and never had the problem.
            -->
            <div
              class="guide-editor__palette"
              data-region="palette"
              tabindex="-1"
              role="group"
              aria-label="${this.text("editor.palette.title")}"
              data-i18n-aria="editor.palette.title"
            >
              <node-palette></node-palette>
            </div>
            <main
              class="guide-editor__canvas"
              data-region="canvas"
              tabindex="-1"
              aria-label="${this.text("editor.shell.canvas")}"
              data-i18n-aria="editor.shell.canvas"
            >
              <node-editor></node-editor>

              <!--
                Kontrollraden. Nedtill till vänster med flit: minikartan ligger
                nedtill till höger, och de ska inte skymma varandra.
              -->
              <div class="guide-editor__health" data-health>
                <button
                  type="button"
                  class="guide-editor__health-toggle"
                  data-health-toggle
                  aria-expanded="false"
                  aria-controls="guide-health-list"
                >
                  <span class="guide-editor__health-count" data-health-count aria-live="polite"></span>
                </button>
                <div
                  class="guide-editor__health-list"
                  id="guide-health-list"
                  data-health-list
                  hidden
                >
                  <h2 class="guide-editor__health-heading" data-i18n="editor.health.heading">${this.text("editor.health.heading")}</h2>
                  <div data-health-body></div>
                </div>
              </div>
              <!--
                Listläget (story 072, platsbytet 2/9 kväll): guiden som lista
                ÖVER arbetsytan — hela ytan åt trädet, paletten kvar till
                vänster, egenskaperna till höger. Vy-menyn växlar; Esc
                stänger. Komponenten är samma som satt i vänsterfliken —
                bara värdplatsen bytte, precis som skissen lovade.
              -->
              <guide-outline class="guide-editor__list-view" hidden></guide-outline>
            </main>
            <!--
              The side panel folded in (story 145): a 57 px rail at the
              canvas's end, the same width as the palette's. « opens the panel
              on the tab chosen last; the two shortcuts open it on their own
              tab. The rail is a column of its own, so the canvas has the same
              width with the panel open or folded, and the panel lies over the
              flow instead of pushing it (criterion 2).
            -->
            <div class="guide-editor__panel-rail" data-panel-rail>
              <button
                type="button"
                class="guide-editor__panel-arrow"
                data-action="panel-open"
                aria-expanded="false"
                aria-controls="guide-editor-sidebar"
                aria-label="${this.text("editor.shell.panelOpen")}"
                title="${this.text("editor.shell.panelOpen")}"
                data-i18n-aria="editor.shell.panelOpen"
                data-i18n-title="editor.shell.panelOpen"
              ><span aria-hidden="true">«</span></button>
              <div class="guide-editor__panel-shortcuts">
                <button
                  type="button"
                  class="guide-editor__panel-shortcut"
                  data-panel-shortcut="properties"
                  aria-controls="guide-editor-sidebar"
                  aria-label="${this.text("editor.shell.tabProperties")}"
                  title="${this.text("editor.shell.tabProperties")}"
                  data-i18n-aria="editor.shell.tabProperties"
                  data-i18n-title="editor.shell.tabProperties"
                ><span class="guide-editor__panel-shortcut-plate">${PANEL_ICON_PROPERTIES}</span></button>
                <button
                  type="button"
                  class="guide-editor__panel-shortcut"
                  data-panel-shortcut="preview"
                  aria-controls="guide-editor-sidebar"
                  aria-label="${this.text("editor.shell.tabPreview")}"
                  title="${this.text("editor.shell.tabPreview")}"
                  data-i18n-aria="editor.shell.tabPreview"
                  data-i18n-title="editor.shell.tabPreview"
                ><span class="guide-editor__panel-shortcut-plate">${PANEL_ICON_PREVIEW}</span></button>
              </div>
            </div>
            <aside class="guide-editor__sidebar" id="guide-editor-sidebar" data-region="panel" tabindex="-1" hidden aria-label="${this.text("editor.shell.sidebar")}" data-i18n-aria="editor.shell.sidebar">
              <div
                class="guide-editor__panel-resize"
                data-panel-resize
                role="separator"
                aria-orientation="vertical"
                tabindex="0"
                aria-label="${this.text("editor.shell.panelWidth")}"
                data-i18n-aria="editor.shell.panelWidth"
              ></div>
              <!--
            The way back in, at the panel's own edge (story 145, criterion 3):
            » folds it in, mirroring the « that opened it. A row of its own
            above the tabs, so the tabs keep their full width.
          -->
          <div class="guide-editor__sidebar-head">
            <button
              type="button"
              class="guide-editor__panel-arrow"
              data-action="panel-close"
              aria-controls="guide-editor-sidebar"
              aria-label="${this.text("editor.shell.panelClose")}"
              title="${this.text("editor.shell.panelClose")}"
              data-i18n-aria="editor.shell.panelClose"
              data-i18n-title="editor.shell.panelClose"
            ><span aria-hidden="true">»</span></button>
          </div>
          <div class="guide-editor__tabs" role="tablist" aria-label="${this.text("editor.shell.sidebarTabs")}" data-i18n-aria="editor.shell.sidebarTabs">
                <button
                  type="button"
                  role="tab"
                  id="properties-tab"
                  aria-controls="properties-panel-container"
                  aria-selected="true"
                  data-sidebar-mode="properties"
                 data-i18n="editor.shell.tabProperties">
                  ${this.text("editor.shell.tabProperties")}
                </button>
                <button
                  type="button"
                  role="tab"
                  id="preview-tab"
                  aria-controls="preview-panel-container"
                  aria-selected="false"
                  tabindex="-1"
                  data-sidebar-mode="preview"
                 data-i18n="editor.shell.tabPreview">
                  ${this.text("editor.shell.tabPreview")}
                </button>
              </div>

              <div
                class="guide-editor__sidebar-panel"
                id="properties-panel-container"
                role="tabpanel"
                aria-labelledby="properties-tab"
                data-sidebar-panel="properties"
              >
                <properties-panel></properties-panel>
              </div>

              <div
                class="guide-editor__sidebar-panel guide-editor__preview-panel"
                id="preview-panel-container"
                role="tabpanel"
                aria-labelledby="preview-tab"
                data-sidebar-panel="preview"
                hidden
              >
                <div class="guide-editor__preview-actions">
                  <button type="button" data-action="prove-guide" data-i18n="editor.toolbar.proveGuide">
                    ${this.text("editor.toolbar.proveGuide")}
                  </button>
                  <button type="button" data-action="preview-open-dialog" data-i18n="editor.shell.previewOpen">
                    ${this.text("editor.shell.previewOpen")}
                  </button>
                </div>
                <details class="guide-editor__given">
                  <summary data-i18n="editor.proving.given">${this.text("editor.proving.given")}</summary>
                  <label class="guide-editor__given-label">
                    <span data-i18n="editor.proving.givenHint">${this.text("editor.proving.givenHint")}</span>
                    <textarea data-given rows="3" spellcheck="false"></textarea>
                  </label>
                  <p class="guide-editor__given-unmatched" data-given-unmatched aria-live="polite"></p>
                </details>
                <!--
                  editor-view: redaktörens bild, inte besökarens.

                  Skillnaden mellan panelen och dialogen "Visa i full storlek" är
                  inte vilken komponent de monterar — det är samma — utan vad ytan
                  är till för. Panelen används MEDAN MAN BYGGER, så en obesvarad
                  variabel ska visa sitt namn ("Ålder") och ett villkorat fält ska
                  synas fastän dess regel inte håller. Dialogen finns för att visa
                  vad BESÖKAREN ser, och lämnas utan attributet.

                  Ett prov sätter proving här och tar tillbaka besökarens bild så
                  länge det pågår — se revealsHiddenFields i visaren. Panelen
                  saknade attributet och fick därför besökarens svar också medan
                  någon byggde (13/9).
                -->
                <guide-preview compact editor-view></guide-preview>
              </div>
            </aside>
          </div>
        </div>

        <!--
          Ctrl+K (story 074): sök-först — hoppa till en nod eller lägg till
          en ny genom att skriva. I vila finns bara det dolda skalet.
        -->
        <div class="guide-editor__quick-open" data-quick-open hidden>
          <div class="guide-editor__quick-open-box" role="dialog" aria-modal="true" aria-label="${this.text("editor.quickOpen.aria")}">
            <input type="text" data-quick-input placeholder="${this.text("editor.quickOpen.placeholder")}" aria-label="${this.text("editor.quickOpen.aria")}">
            <div class="guide-editor__quick-open-list" data-quick-list role="listbox"></div>
          </div>
        </div>
        <confirmation-dialog></confirmation-dialog>
        <prompt-dialog></prompt-dialog>
        <node-type-editor></node-type-editor>
        <editor-toast></editor-toast>
        <guide-preview-dialog></guide-preview-dialog>
        <email-output-dialog></email-output-dialog>
        <dialog class="guide-editor__shortcuts" data-shortcuts-dialog aria-labelledby="shortcuts-title" data-i18n-html="shortcuts">
          ${this.renderShortcutsContent()}
        </dialog>
        <div class="guide-editor__tour" data-tour hidden>
          <div class="guide-editor__tour-dim" data-tour-dim hidden>
            <div class="guide-editor__tour-hole" data-tour-hole></div>
          </div>
          <div class="guide-editor__tour-ring" data-tour-ring></div>
          <div
            class="guide-editor__tour-callout"
            data-tour-callout
            role="dialog"
            aria-live="polite"
            aria-label="${this.text("editor.tour.aria")}" data-i18n-aria="editor.tour.aria"
            tabindex="-1"
          >
            <p class="guide-editor__tour-count" data-tour-count></p>
            <p class="guide-editor__tour-text" data-tour-text></p>
            <div class="guide-editor__tour-actions">
              <button type="button" data-tour-close class="guide-editor__tour-close" aria-label="${this.text("editor.tour.close")}" data-i18n-aria="editor.tour.close">✕</button>
              <span class="guide-editor__tour-spacer"></span>
              <button type="button" data-tour-back data-i18n="editor.tour.back">${this.text("editor.tour.back")}</button>
              <button type="button" data-tour-next data-i18n="editor.tour.next">${this.text("editor.tour.next")}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.applyEditorLocale();
    this.updateNodeEditor();
    this.updatePropertiesPanel(null);
    this.updateStartNodeWarning();
    this.updateSidebar();
    this.applyCapabilities();
    this.applyTemplatePermission();
    this.applyGetStartedHref();
  }

  /** Lokaliserad chrome-text i editorns UI-språk (editor-locale-attributet). */
  private text(key: string, params?: Record<string, string | number>): string {
    const resolved = t(key, this.editorLocale);
    return params ? interpolate(resolved, params) : resolved;
  }

  /** Innehållet i Kortkommandon-dialogen (grupperad, lokaliserad). */
  private renderShortcutsContent(): string {
    // Every row: a description plus one or more key combinations. Tokens such as
    // "Ctrl / Cmd" and the arrows are language-neutral; words are localised via
    // text().
    const groups: Array<{ heading: string; rows: Array<[string, string[][]]> }> = [
      {
        heading: this.text("editor.shortcuts.group.general"),
        rows: [
          [this.text("editor.shortcuts.undo"), [["Ctrl / ⌘", "Z"]]],
          [this.text("editor.shortcuts.redo"), [["Ctrl / ⌘", "Shift", "Z"], ["Ctrl / ⌘", "Y"]]],
          [this.text("editor.shortcuts.save"), [["Ctrl / ⌘", "S"]]],
          [this.text("editor.quickOpen.aria"), [["Ctrl / ⌘", "K"]]],
        ],
      },
      {
        heading: this.text("editor.shortcuts.group.canvas"),
        rows: [
          [this.text("editor.shortcuts.zoomIn"), [["+"]]],
          [this.text("editor.shortcuts.zoomOut"), [["−"]]],
          [this.text("editor.shortcuts.zoomReset"), [["0"]]],
          [this.text("editor.shortcuts.fit"), [["F"], ["Home"]]],
          [this.text("editor.shortcuts.zoomWheel"), [["Ctrl / ⌘", this.text("editor.shortcuts.key.wheel")]]],
          [this.text("editor.shortcuts.pan"), [[this.text("editor.shortcuts.key.space")]]],
          [this.text("editor.shortcuts.delete"), [["Delete"], ["Backspace"]]],
          [this.text("editor.shortcuts.duplicate"), [["Ctrl / ⌘", "D"]]],
          [this.text("editor.shortcuts.deselect"), [["Esc"]]],
        ],
      },
      {
        heading: this.text("editor.shortcuts.group.reach"),
        rows: [
          [this.text("editor.shortcuts.region"), [["F6"], ["Shift", "F6"]]],
          [this.text("editor.shortcuts.focusNode"), [["↑ ↓ ← →"]]],
          [this.text("editor.shortcuts.enterPorts"), [["Tab"]]],
          [this.text("editor.shortcuts.connect"), [["Enter"]]],
          [this.text("editor.shortcuts.connectCancel"), [["Esc"]]],
        ],
      },
      {
        heading: this.text("editor.shortcuts.group.node"),
        rows: [
          [this.text("editor.shortcuts.selectNode"), [["Enter"]]],
          [this.text("editor.shortcuts.nodeMenu"), [["Shift", "F10"]]],
          [this.text("editor.shortcuts.moveNode"), [["↑ ↓ ← →"]]],
          [this.text("editor.shortcuts.moveNodeFar"), [["Shift", "↑ ↓ ← →"]]],
        ],
      },
      {
        heading: this.text("editor.shortcuts.group.other"),
        rows: [
          [this.text("editor.shortcuts.closeMenu"), [["Esc"]]],
          [this.text("editor.shortcuts.showHelp"), [["?"]]],
        ],
      },
    ];

    const chords = (combos: string[][]): string =>
      combos
        .map((tokens) => tokens.map((token) => `<kbd>${token}</kbd>`).join("<span class=\"guide-editor__kbd-plus\">+</span>"))
        .join('<span class="guide-editor__kbd-or">/</span>');

    const body = groups
      .map(
        (group) => `
          <section>
            <h3>${group.heading}</h3>
            <dl>
              ${group.rows
                .map(
                  ([label, combos]) => `
                    <div class="guide-editor__shortcut-row">
                      <dt>${label}</dt>
                      <dd>${chords(combos)}</dd>
                    </div>`
                )
                .join("")}
            </dl>
          </section>`
      )
      .join("");

    return `
      <div class="guide-editor__shortcuts-head">
        <h2 id="shortcuts-title">${this.text("editor.shortcuts.title")}</h2>
        <button type="button" data-shortcuts-close aria-label="${this.text("editor.shortcuts.close")}">✕</button>
      </div>
      <div class="guide-editor__shortcuts-body">${body}</div>
      <p class="guide-editor__shortcuts-hint">${this.text("editor.shortcuts.hint")}</p>
    `;
  }

  /** Startar en stegvis rundtur som pekar ut editorns delar. */
  startTour(): void {
    this.tourSteps = this.buildTourSteps();
    if (this.tourSteps.length === 0) {
      return;
    }
    this.tourIndex = 0;
    const overlay = this.root.querySelector<HTMLElement>("[data-tour]");
    if (!overlay) {
      return;
    }
    overlay.hidden = false;
    window.addEventListener("resize", this.handleTourReposition);
    this.showTourStep();
    this.root.querySelector<HTMLElement>("[data-tour-callout]")?.focus();
  }

  private flowNodeElements(): FlowNode[] {
    const canvas = this.root.querySelector("node-editor")?.shadowRoot;
    return Array.from(canvas?.querySelectorAll("flow-node") ?? []);
  }

  private flowNodeOfType(type: string): FlowNode | null {
    return this.flowNodeElements().find((n) => n.nodeData?.type === type) ?? null;
  }

  private buildTourSteps(): TourStep[] {
    const steps: TourStep[] = [];
    // A step at something that exists but is hidden — Nodmallar outside
    // administrator mode — opened its menu and framed nothing (read 5/9).
    const add = (
      resolve: () => HTMLElement | null,
      text: string,
      open?: string
    ): void => {
      if (resolve()?.hidden === false) {
        steps.push({ resolve, text, open });
      }
    };
    add(
      () =>
        this.getToolbar()?.shadowRoot?.querySelector<HTMLElement>(
          ".editor-toolbar__menus"
        ) ?? null,
      this.text("editor.tour.menus")
    );
    // Opens the Guide menu and highlights "Nodmallar" — shows how a step can
    // expand a menu and point at an item in it.
    add(
      () =>
        this.getToolbar()?.shadowRoot?.querySelector<HTMLElement>(
          '[data-menu="guide"] [data-action="manage-node-types"]'
        ) ?? null,
      this.text("editor.tour.templates"),
      "guide"
    );
    add(
      () => this.root.querySelector<HTMLElement>("node-palette"),
      this.text("editor.tour.palette")
    );
    add(() => this.flowNodeElements()[0] ?? null, this.text("editor.tour.node"));
    add(() => this.flowNodeOfType("rule"), this.text("editor.tour.rule"));
    add(
      () => this.root.querySelector<HTMLElement>('[data-sidebar-mode="preview"]'),
      this.text("editor.tour.preview")
    );
    return steps;
  }

  private readonly handleTourReposition = (): void => {
    this.showTourStep();
  };

  private showTourStep(): void {
    const step = this.tourSteps[this.tourIndex];
    const target = step?.resolve();
    const ring = this.root.querySelector<HTMLElement>("[data-tour-ring]");
    const callout = this.root.querySelector<HTMLElement>("[data-tour-callout]");
    if (!step || !target || !ring || !callout) {
      this.closeTour();
      return;
    }

    // Expand a menu if the step requires it (otherwise close open menus), so the
    // target in the menu is visible when we measure and outline it.
    this.getToolbar()?.openMenu(step.open ?? null);

    // Node targets: scroll the node fully into view and let the pulse reinforce
    // it. The callout then lands below the node rather than up by the top
    // menu.
    const nodeId =
      target.tagName === "FLOW-NODE"
        ? (target as FlowNode).nodeData?.id ?? null
        : null;
    if (nodeId) {
      this.getNodeEditor()?.centerNodeById(nodeId);
    }
    const r = target.getBoundingClientRect();
    const pad = 6;
    ring.style.left = `${r.left - pad}px`;
    ring.style.top = `${r.top - pad}px`;
    ring.style.width = `${r.width + pad * 2}px`;
    ring.style.height = `${r.height + pad * 2}px`;

    // Dim only the canvas (with a hole at the node) for node steps. UI targets
    // (top menu, palette, preview) lie outside the canvas, so no dimming.
    const dim = this.root.querySelector<HTMLElement>("[data-tour-dim]");
    const hole = this.root.querySelector<HTMLElement>("[data-tour-hole]");
    const canvas = this.root.querySelector(".guide-editor__canvas");
    if (dim && hole && canvas && nodeId) {
      const c = canvas.getBoundingClientRect();
      dim.hidden = false;
      dim.style.left = `${c.left}px`;
      dim.style.top = `${c.top}px`;
      dim.style.width = `${c.width}px`;
      dim.style.height = `${c.height}px`;
      hole.style.left = `${r.left - c.left - pad}px`;
      hole.style.top = `${r.top - c.top - pad}px`;
      hole.style.width = `${r.width + pad * 2}px`;
      hole.style.height = `${r.height + pad * 2}px`;
    } else if (dim) {
      dim.hidden = true;
    }

    const textEl = this.root.querySelector<HTMLElement>("[data-tour-text]");
    if (textEl) {
      textEl.textContent = step.text;
    }
    const countEl = this.root.querySelector<HTMLElement>("[data-tour-count]");
    if (countEl) {
      countEl.textContent = this.text("editor.tour.count", {
        n: this.tourIndex + 1,
        total: this.tourSteps.length,
      });
    }
    const back = this.root.querySelector<HTMLButtonElement>("[data-tour-back]");
    if (back) {
      back.disabled = this.tourIndex === 0;
    }
    const next = this.root.querySelector<HTMLButtonElement>("[data-tour-next]");
    if (next) {
      next.textContent =
        this.tourIndex === this.tourSteps.length - 1
          ? this.text("editor.tour.done")
          : this.text("editor.tour.next");
    }

    // Place the callout beside the target. Order: below, right, left, above —
    // and never over the top menu (the toolbar stays visible).
    const cw = callout.offsetWidth;
    const ch = callout.offsetHeight;
    const gap = 14;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const clamp = (value: number, min: number, max: number): number =>
      Math.max(min, Math.min(value, max));
    const toolbarBottom =
      this.root.querySelector("editor-toolbar")?.getBoundingClientRect()
        .bottom ?? 8;
    const minTop = toolbarBottom + 6;

    let left: number;
    let top: number;
    if (r.bottom + gap + ch <= vh) {
      callout.dataset.arrow = "up";
      top = r.bottom + gap;
      left = clamp(cx - cw / 2, 8, vw - cw - 8);
      callout.style.setProperty("--arrow-x", `${cx - left}px`);
    } else if (r.right + gap + cw <= vw) {
      callout.dataset.arrow = "left";
      left = r.right + gap;
      top = clamp(cy - ch / 2, minTop, vh - ch - 8);
      callout.style.setProperty("--arrow-y", `${cy - top}px`);
    } else if (r.left - gap - cw >= 0) {
      callout.dataset.arrow = "right";
      left = r.left - gap - cw;
      top = clamp(cy - ch / 2, minTop, vh - ch - 8);
      callout.style.setProperty("--arrow-y", `${cy - top}px`);
    } else {
      callout.dataset.arrow = "down";
      top = Math.max(minTop, r.top - gap - ch);
      left = clamp(cx - cw / 2, 8, vw - cw - 8);
      callout.style.setProperty("--arrow-x", `${cx - left}px`);
    }
    callout.style.left = `${left}px`;
    callout.style.top = `${Math.max(top, minTop)}px`;
  }

  private tourNext(): void {
    if (this.tourIndex >= this.tourSteps.length - 1) {
      this.closeTour();
      return;
    }
    this.tourIndex += 1;
    this.showTourStep();
  }

  private tourBack(): void {
    if (this.tourIndex === 0) {
      return;
    }
    this.tourIndex -= 1;
    this.showTourStep();
  }

  private closeTour(): void {
    const overlay = this.root.querySelector<HTMLElement>("[data-tour]");
    if (overlay) {
      overlay.hidden = true;
    }
    window.removeEventListener("resize", this.handleTourReposition);
    this.getToolbar()?.openMenu(null);
  }

  private readonly handleTourRequest = (): void => {
    this.startTour();
  };

  /** Öppnar Kortkommandon-dialogen. */
  private openShortcuts(): void {
    const dialog = this.root.querySelector<HTMLDialogElement>(
      "[data-shortcuts-dialog]"
    );
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  /**
   * Passes the editor's UI language on to the child components that render
   * chrome of their own. An axis of its own from `activeLocale` (the content
   * language).
   */
  private applyEditorLocale(): void {
    this.refreshShellText();

    const toolbar = this.getToolbar();
    if (toolbar) toolbar.editorLocale = this.editorLocale;
    const palette = this.root.querySelector<NodePalette>("node-palette");
    if (palette) palette.editorLocale = this.editorLocale;
    const propertiesPanel = this.getPropertiesPanel();
    if (propertiesPanel) propertiesPanel.editorLocale = this.editorLocale;
    const nodeEditor = this.getNodeEditor();
    if (nodeEditor) nodeEditor.editorLocale = this.editorLocale;

    /*
     * The four that were built to be told and never were.
     *
     * Each already had an `editorLocale` setter — somebody wrote them expecting
     * this — and none of them was in this list, so they rendered in the default
     * language whatever the host asked for. It does not show on a Swedish page,
     * which is every page we look at, and it showed the moment an English one
     * existed: *Bekräfta* in a dialog under an English toolbar.
     *
     * They are looked up rather than held because they are created on demand;
     * a dialog that has never been opened has nothing to tell.
     */
    for (const selector of [
      "confirmation-dialog",
      "editor-toast",
      "email-output-dialog",
      "guide-preview-dialog",
    ]) {
      const element = this.root.querySelector<HTMLElement & { editorLocale?: string }>(
        selector
      );

      if (element) {
        element.editorLocale = this.editorLocale;
      }
    }

    /*
     * Setting the toolbar's UI language re-renders its chrome, which builds a
     * fresh language picker with nothing selected and the default label.
     * The content locale therefore has to be pushed back afterwards.
     *
     * It used to survive by accident: the only caller was `setActiveLocale`,
     * which set both axes and re-synced the toolbar right after. Story 014
     * uncoupled them, so switching the *tool's* language on its own reset the
     * *content* selection to the source and the label to "Språk" — the two axes
     * were separate at last, and the second one fell over. Found by driving
     * both controls in a browser, not by a test.
     */
    this.syncToolbarLocales();
  }

  /**
   * Re-resolves the shell's own words after a language change.
   *
   * `render()` runs once, from `connectedCallback`, and rebuilding it would
   * throw away the canvas. So the child components were told the new language
   * and the shell was not: an editor set to English had an English palette,
   * English panel and English menus beside tabs still reading "Egenskaper" and
   * "Förhandsgranskning".
   *
   * The keys are carried in the markup rather than listed here. A list is a
   * second place to remember, and this file already has 87 `text()` calls; the
   * ones in the shell are marked where they are written, so a new one is
   * covered by the attribute rather than by someone noticing.
   */
  private refreshShellText(): void {
    /*
     * The health summary is written by `updateHealth`, not by `render`, so the
     * markers below cannot reach it — it has to be asked to say itself again.
     * Its words were correct in the source and stale on the screen, which is
     * the same fault as the tabs one layer along.
     */
    this.updateHealth();

    /*
     * `textContent`, except where the string carries markup of its own.
     *
     * Two of ours do — the start-node warning and the templates hint — and they
     * put a `<strong>` around the words you are meant to click. Written into
     * `textContent` those became visible tags: the editor said *Right-click a
     * question and choose &lt;strong&gt;Make start node&lt;/strong&gt;.* Seen in
     * a frame of the hero clip, which is the first thing that ever changed the
     * editor's language on a page with no start node.
     *
     * The first render is `innerHTML`, so it was right until something refreshed
     * the words — which is why nobody met it.
     *
     * `innerHTML` is safe for these: the strings are the library's own, from a
     * file in the build, never anything a guide or a host wrote.
     */
    for (const element of this.root.querySelectorAll<HTMLElement>("[data-i18n]")) {
      const value = this.text(element.dataset.i18n!);

      if (/<[a-z]+>/i.test(value)) {
        element.innerHTML = value;
      } else {
        element.textContent = value;
      }
    }
    for (const element of this.root.querySelectorAll<HTMLElement>("[data-i18n-aria]")) {
      element.setAttribute("aria-label", this.text(element.dataset.i18nAria!));
    }
    for (const element of this.root.querySelectorAll<HTMLElement>("[data-i18n-title]")) {
      element.title = this.text(element.dataset.i18nTitle!);
    }
    // The shortcuts dialog is a table of its own, so it is rebuilt rather than
    // patched key by key.
    const shortcuts = this.root.querySelector('[data-i18n-html="shortcuts"]');
    if (shortcuts) {
      shortcuts.innerHTML = this.renderShortcutsContent();
    }
  }

  private bindEvents(): void {
    const nodeEditor = this.getNodeEditor();
    const propertiesPanel = this.getPropertiesPanel();

    this.root.addEventListener(
      "node-type-add",
      this.handleNodeTypeAdd as EventListener
    );

    this.root.addEventListener("list-view-request", () => this.toggleListView());
    this.root.addEventListener("quick-open-request", () => this.openQuickOpen());
    this.root.addEventListener("outline-select", ((event: CustomEvent<{ nodeId?: string }>) => {
      const nodeId = event.detail.nodeId;

      if (!nodeId) return;
      const nodeEditor = this.getNodeEditor();

      nodeEditor?.selectNodeById(nodeId);
      nodeEditor?.centerNodeById(nodeId);
    }) as EventListener);
    this.root.addEventListener("outline-routes", this.handleRoutesHereRequest);

    const quickInput = this.root.querySelector<HTMLInputElement>("[data-quick-input]");

    quickInput?.addEventListener("input", () => this.renderQuickHits());
    quickInput?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.closeQuickOpen();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        this.moveQuickChoice(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        this.executeQuickChoice();
      }
    });
    this.root
      .querySelector<HTMLElement>("[data-quick-open]")
      ?.addEventListener("pointerdown", (event) => {
        // Klick på skymningen utanför rutan stänger, som Esc.
        if (event.target === event.currentTarget) this.closeQuickOpen();
      });

    this.root.addEventListener(
      "node-type-drag-start",
      this.handleNodeTypeDragStart as EventListener
    );

    this.root.addEventListener(
      "node-type-editor-request",
      this.handleNodeTypeEditorRequest as EventListener
    );

    this.root.addEventListener(
      "shortcuts-help-request",
      this.handleShortcutsRequest as EventListener
    );

    this.root.addEventListener(
      "tour-request",
      this.handleTourRequest as EventListener
    );

    this.root
      .querySelector<HTMLButtonElement>("[data-tour-next]")
      ?.addEventListener("click", () => this.tourNext());
    this.root
      .querySelector<HTMLButtonElement>("[data-tour-back]")
      ?.addEventListener("click", () => this.tourBack());
    this.root
      .querySelector<HTMLButtonElement>("[data-tour-close]")
      ?.addEventListener("click", () => this.closeTour());
    this.root
      .querySelector<HTMLElement>("[data-tour-callout]")
      ?.addEventListener("keydown", (event) => {
        const key = (event as KeyboardEvent).key;
        if (key === "Escape") {
          event.preventDefault();
          this.closeTour();
        } else if (key === "ArrowRight") {
          event.preventDefault();
          this.tourNext();
        } else if (key === "ArrowLeft") {
          event.preventDefault();
          this.tourBack();
        }
      });

    const shortcuts = this.root.querySelector<HTMLDialogElement>(
      "[data-shortcuts-dialog]"
    );
    /*
     * Delegated to the dialog rather than bound to the button.
     *
     * The dialog's contents are rebuilt when the editor's language changes, and
     * a listener attached to the old button goes with it — the close button
     * stopped working, silently, the moment the shell learned to re-translate
     * itself. Listening on the dialog outlives its own contents.
     */
    shortcuts?.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      if (target === shortcuts || target?.closest("[data-shortcuts-close]")) {
        shortcuts.close();
      }
    });

    this.root.addEventListener(
      "save-as-node-template-intent",
      this.handleSaveAsNodeTemplate as EventListener
    );

    this.root.addEventListener(
      "export-node-template-intent",
      this.handleExportNodeTemplate as EventListener
    );


    this.root.addEventListener(
      "graph-export-request",
      this.handleGraphExportRequest
    );

    this.root.addEventListener(
      "schema-export-request",
      this.handleSchemaExportRequest
    );

    this.root.addEventListener(
      "graph-import-request",
      this.handleGraphImportRequest as unknown as EventListener
    );

    this.root.addEventListener("new-form-request", this.handleNewFormRequest);

    this.root.addEventListener(
      "graph-reset-intent",
      this.handleGraphResetIntent
    );

    this.root.addEventListener(
      "toast-request",
      this.handleToastRequest as EventListener
    );

    this.root.addEventListener(
      "fullscreen-toggle-request",
      this.handleFullscreenToggleRequest
    );

    this.root.addEventListener(
      "show-start-node-request",
      this.handleShowStartNodeRequest
    );

    this.root.addEventListener(
      "fit-to-content-request",
      this.handleFitToContentRequest
    );

    this.root.addEventListener(
      "prove-guide-request",
      this.handleProveGuideRequest,
    );

    this.root.addEventListener(
      "routes-here-request",
      this.handleRoutesHereRequest,
    );

    this.root.addEventListener("save-intent", () => this.requestSave());

    this.root.addEventListener(
      "routes-end-request",
      this.handleRoutesEndRequest,
    );

    this.root.addEventListener(
      "proving-restart-request",
      this.handleProveGuideRequest,
    );

    this.root.addEventListener(
      "proving-end-request",
      this.handleProvingEndRequest,
    );

    this.root.addEventListener(
      "visitor-view-all-request",
      this.handleVisitorViewAllRequest,
    );

    this.root.addEventListener(
      "structure-view-all-request",
      this.handleStructureViewAllRequest,
    );

    this.root.addEventListener(
      "show-variables-request",
      this.handleShowVariablesRequest,
    );

    this.root.addEventListener("undo-request", this.handleUndoRequest);
    this.root.addEventListener("redo-request", this.handleRedoRequest);

    this.root.addEventListener("zoom-in-request", this.handleZoomInRequest);
    this.root.addEventListener("zoom-out-request", this.handleZoomOutRequest);
    this.root.addEventListener(
      "zoom-reset-request",
      this.handleZoomResetRequest
    );

    this.root.addEventListener(
      "start-node-remove-intent",
      this.handleStartNodeRemoveIntent
    );

    this.root.addEventListener(
      "start-node-change-intent",
      this.handleStartNodeChangeIntent
    );

    this.bindLocaleRow();
    this.root.addEventListener("locale-change", this.handleLocaleChange);
    this.root.addEventListener(
      "modules-change",
      this.handleModulesChange as EventListener
    );

    nodeEditor?.addEventListener(
      "selection-changed",
      this.handleSelectionChanged as EventListener
    );

    nodeEditor?.addEventListener(
      "graph-changed",
      this.handleGraphChanged as EventListener
    );

    this.connectHealthStrip();
    this.updateHealth();
    // Läget måste sättas om efter varje rendering — delarna är nya element.
    this.applyMode();

    // The templates are not stored here. If the editor changes something we
    // announce it, and the host decides whether that leads to a write.
    this.templateUnsubscribe?.();
    this.templateUnsubscribe = subscribeToLibrary((specs) => {
      this.dispatchEvent(
        new CustomEvent<{ templates: NodeTemplate[] }>(
          "node-templates-changed",
          {
            detail: { templates: specs },
            bubbles: true,
            composed: true,
          }
        )
      );
    });

    propertiesPanel?.addEventListener(
      "node-data-changed",
      this.handleNodeDataChanged as EventListener
    );

    /*
     * Leaving an answer option's text field is what can turn its empty label
     * from work in progress into a warning (`writingOptionId`). Nothing about
     * the guide changes then, so no other hook would run the check. After the
     * move, so the panel no longer reports the field as focused.
     *
     * On the panel's shadow root, not the panel: moving from the text field
     * to the next field in the panel never reaches the host — retargeted,
     * target and relatedTarget are both the panel, and the event stops at the
     * boundary (measured 28/9: Tab from an empty option left no warning).
     */
    propertiesPanel?.shadowRoot?.addEventListener("focusout", (event) => {
      const field = event.target as HTMLElement | null;

      if (field?.dataset?.optionProperty === "label") setTimeout(() => this.updateHealth(), 0);
    });

    propertiesPanel?.addEventListener(
      "guide-string-changed",
      this.handleGuideStringChanged as EventListener
    );

    propertiesPanel?.addEventListener(
      "guide-locales-changed",
      this.handleGuideLocalesChanged as EventListener
    );

    /*
     * On the shadow root, not on the toolbar. The jump button sits on the
     * context row now, and a listener bound to the element it used to live in
     * hears nothing — the click worked and the editor simply did not move.
     */
    this.root.addEventListener(
      "next-untranslated-request",
      this.handleNextUntranslated
    );

    propertiesPanel?.addEventListener(
      "guide-meta-changed",
      this.handleGuideMetaChanged as EventListener
    );

    propertiesPanel?.addEventListener(
      "guide-setting-changed",
      this.handleGuideSettingChanged as EventListener
    );

    propertiesPanel?.addEventListener(
      "node-visibility-changed",
      this.handleNodeVisibilityChanged as EventListener
    );
    /*
     * `guide-source-locale-changed` and `guide-locale-blocked` used to arrive
     * here. The panel no longer offers a source to change: which language a
     * guide is written in is the host's, set in `settings.sourceLocale`, and
     * the editor decides only which of the offered languages this guide is
     * available in. Nothing dispatches them, so nothing listens.
     */
    propertiesPanel?.addEventListener(
      "node-template-changed",
      this.handleNodeTemplateChanged as EventListener
    );
    propertiesPanel?.addEventListener(
      "node-layout-changed",
      this.handleNodeLayoutChanged as EventListener
    );
    propertiesPanel?.addEventListener(
      "node-order-changed",
      this.handleNodeOrderChanged as EventListener
    );
    propertiesPanel?.addEventListener(
      "question-option-remove",
      this.handleQuestionOptionRemove as EventListener
    );

    propertiesPanel?.addEventListener(
      "question-option-move",
      this.handleQuestionOptionMove as EventListener
    );

    propertiesPanel?.addEventListener(
      "question-option-reorder",
      this.handleQuestionOptionReorder as EventListener
    );

    propertiesPanel?.addEventListener(
      "rule-case-remove",
      this.handleRuleCaseRemove as EventListener
    );

    /*
     * The side panel's ways in and out (story 145). « opens on the tab chosen
     * last and puts focus on it (criterion 5); a shortcut opens on its own tab,
     * which then is the last one chosen (criterion 4); » folds and gives focus
     * back to « (criterion 12). Enter and a double-click on a node open it on
     * that node without taking focus from the canvas (criterion 6).
     */
    this.root
      .querySelector<HTMLButtonElement>('[data-action="panel-open"]')
      ?.addEventListener("click", () => this.setPanelOpen(true, "tab"));
    this.root
      .querySelector<HTMLButtonElement>('[data-action="panel-close"]')
      ?.addEventListener("click", () => this.setPanelOpen(false, "opener"));
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-panel-shortcut]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const mode = button.dataset.panelShortcut;

          if (mode === "properties" || mode === "preview") {
            this.setSidebarMode(mode);
            this.setPanelOpen(true, "tab");
          }
        });
      });
    // The palette says when a person opened or folded it; the editor's own
    // attribute follows, so the host reads one answer in one place.
    this.root.querySelector("node-palette")?.addEventListener("palette-open-changed", ((
      event: CustomEvent<{ open: boolean }>
    ) => {
      this.toggleAttribute("palette-open", event.detail.open);
      if (event.detail.open) this.makeRoomFor("palette");
    }) as EventListener);
    nodeEditor?.addEventListener("node-select", ((event: CustomEvent<NodeSelectDetail>) => {
      if (event.detail?.open === true) this.setPanelOpen(true, "none");
    }) as EventListener);
    nodeEditor?.addEventListener("dblclick", (event) => {
      if (event.composedPath().some((target) => target instanceof HTMLElement && target.localName === "flow-node")) {
        this.setPanelOpen(true, "none");
      }
    });

    this.root
      .querySelectorAll<HTMLButtonElement>("[data-sidebar-mode]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const mode = button.dataset.sidebarMode;

          if (mode === "properties" || mode === "preview") {
            this.setSidebarMode(mode);
          }
        });

        button.addEventListener("keydown", (event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
            return;
          }

          event.preventDefault();
          const mode = button.dataset.sidebarMode === "properties"
            ? "preview"
            : "properties";

          this.setSidebarMode(mode);
          this.root
            .querySelector<HTMLButtonElement>(`[data-sidebar-mode="${mode}"]`)
            ?.focus();
        });
      });

    /*
     * The same run the Guide menu starts. Until 1/9 this was "Testa från
     * start", which opened the dialog with an engine of its own — a second
     * way to run the guide, without the trail or the stand-ins. One run,
     * two doors to it; the dialog is for looking, not walking.
     */
    this.root
      .querySelector<HTMLButtonElement>('[data-action="prove-guide"]')
      ?.addEventListener("click", () => {
        this.startProving();
      });

    this.root
      .querySelector<HTMLTextAreaElement>("[data-given]")
      ?.addEventListener("change", () => this.applyGivenText());

    this.root
      .querySelector<HTMLButtonElement>('[data-action="preview-open-dialog"]')
      ?.addEventListener("click", () => {
        if (this.selectedNodeId) {
          this.getPreviewDialog()?.open(
            this.getData(),
            this.selectedNodeId,
            this.activeLocale
          );
        }
      });

    this.root.addEventListener(
      "preview-node-changed",
      this.handlePreviewNodeChanged as EventListener
    );
    this.root.addEventListener(
      "preview-draft-changed",
      this.handlePreviewDraftChanged as EventListener
    );
  }

  /**
   * Fills the screen with the canvas, by whichever route is open.
   *
   * Two of them, and the choice is asked of the browser rather than guessed from
   * the device — see `needsPlatformFullscreen`. Ours unless we are in a frame,
   * because a frame is the one thing our own mode cannot escape.
   *
   * No setting yet. One would be a public attribute, and a host that may go
   * fullscreen but would rather not is a case nobody has had — easier to add
   * later than to take away.
   */
  private readonly handleFullscreenToggleRequest = (): void => {
    this.pendingFullscreenCenter =
      this.getNodeEditor()?.getViewportCenter() ?? null;

    /*
     * Already in ours? Then the button leaves ours, whatever the platform would
     * allow.
     *
     * Reported from the iPad: after the fallback had put the canvas in our mode,
     * pressing the button asked for the platform's fullscreen instead of
     * leaving — because the check only asked what the platform permits, and we
     * were plainly not in it. The button could not get you out.
     */
    if (this.hasAttribute("wide") || !this.needsPlatformFullscreen()) {
      this.setWideMode(!this.hasAttribute("wide"));
      return;
    }

    const leaving = document.fullscreenElement === this;

    this.leavingFullscreenOnPurpose = leaving;

    void (leaving ? document.exitFullscreen() : this.requestFullscreen()).catch(() => {
      /*
       * Permitted and still refused — a gesture requirement, a policy, a browser
       * having a bad day. Ours is not worse than nothing, so it takes over
       * rather than leaving the button dead.
       */
      this.setWideMode(true);
    });
  };

  /**
   * Whether the platform's fullscreen is worth its cost here.
   *
   * Only inside a frame. `position: fixed` is relative to the frame's viewport,
   * so our own mode fills the iframe and calls six hundred pixels fullscreen;
   * `requestFullscreen` is the only thing that escapes. Outside a frame it has
   * nothing to offer that we do not already have.
   *
   * And it does have a cost, measured on the device rather than assumed: on
   * iPadOS a downward swipe still leaves fullscreen. `touch-action: none` took
   * the edge off — it no longer fires *during* the drag, only on release — but a
   * downward swipe is exactly how somebody pans, so it would keep dropping out
   * of fullscreen all day. Worth paying to escape a frame; not worth paying for
   * nothing.
   */
  private needsPlatformFullscreen(): boolean {
    return needsPlatformFullscreen({
      enabled: document.fullscreenEnabled,
      framed: window.self !== window.top,
    });
  }

  /** Keeps the toolbar and the view in step when the platform's mode changes. */
  private leavingFullscreenOnPurpose = false;

  private readonly handleFullscreenChange = (): void => {
    const inFullscreen = document.fullscreenElement === this;

    /*
     * Thrown out rather than walking out — so ours takes over.
     *
     * On iPadOS a downward swipe still leaves the platform's fullscreen; it now
     * fires when the finger lifts rather than during the drag, but a downward
     * swipe is how somebody pans, so it happens. Snapping back to a
     * six-hundred-pixel editor mid-work is a poor answer to a gesture nobody
     * meant as "close this".
     *
     * Inside a frame ours fills the frame rather than the screen, which is less
     * than the platform gave — but it is what there is, and it is a great deal
     * more than the editor was. Outside a frame this never runs: ours was
     * already the route.
     *
     * Only when the exit was not ours. Pressing the button means leaving, and
     * putting the canvas straight back full-size would make the button useless.
     */
    if (!inFullscreen && !this.leavingFullscreenOnPurpose) {
      this.setWideMode(true);
    }

    this.leavingFullscreenOnPurpose = false;
    const wide = inFullscreen || this.hasAttribute("wide");
    this.getToolbar()?.setFullscreen(wide);
    this.getNodeEditor()?.setFullscreen(wide);
    this.holdViewportCentre();
  };

  private setWideMode(on: boolean): void {
    if (on === this.hasAttribute("wide")) {
      this.pendingFullscreenCenter = null;
      return;
    }

    this.toggleAttribute("wide", on);

    /*
     * The page behind must not scroll while the canvas covers it. Restored to
     * whatever it was rather than to "" — a host may well have its own value,
     * and handing it back the wrong one is a bug we would never hear about.
     */
    if (on) {
      this.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = this.previousBodyOverflow;
      this.previousBodyOverflow = "";
    }

    this.getToolbar()?.setFullscreen(on);
    this.getNodeEditor()?.setFullscreen(on);
    this.holdViewportCentre();
  }

  private previousBodyOverflow = "";

  /**
   * Escape leaves the mode.
   *
   * The platform's fullscreen had this for free, and losing it would be a step
   * backwards: a mode you can only leave by finding a button again is a mode
   * people get stuck in. It runs last — the canvas uses Escape for clearing a
   * selection and for backing out of a half-drawn connection, and taking the key
   * from those would trade one trap for another.
   */
  private readonly handleWideModeKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !this.hasAttribute("wide") || event.defaultPrevented) {
      return;
    }

    event.preventDefault();
    this.pendingFullscreenCenter =
      this.getNodeEditor()?.getViewportCenter() ?? null;
    this.setWideMode(false);
  };

  private readonly handleShowStartNodeRequest = (): void => {
    const startNodeId = this.graphData.startNodeId;
    const nodeEditor = this.getNodeEditor();

    if (!startNodeId || !nodeEditor?.centerNodeById(startNodeId, { smooth: true })) {
      this.showToast({
        message: this.text("editor.toast.noStartNode"),
        type: "info",
      });
      return;
    }

    nodeEditor.selectNodeById(startNodeId);
  };

  /**
   * The menu's two commands, which set every node's eye and nothing else.
   *
   * No state of its own is kept here: story 064 point 6 is that the menu is a
   * command, and the state is the nodes'. Asking the canvas which of its nodes
   * the viewer can draw keeps that list in one place too.
   */
  /*
   * Both are canvas views, so they leave the list first. With the list up
   * they used to act on the canvas hidden underneath it, and nothing showed
   * — the only way back was "Visa som lista" again (Johans bild 3/9).
   */
  private readonly handleVisitorViewAllRequest = (): void => {
    const canvas = this.getNodeEditor();

    this.toggleListView(false);
    if (canvas) canvas.visitorViewNodes = canvas.visitorViewCandidates;
  };

  private readonly handleStructureViewAllRequest = (): void => {
    const canvas = this.getNodeEditor();

    this.toggleListView(false);
    if (canvas) canvas.visitorViewNodes = [];
  };

  /**
   * Vy → Visa variabelnamn (story 077): the canvas holds the state, the menu
   * shows the tick. Off by default; not the guide's, not remembered.
   */
  private readonly handleShowVariablesRequest = (): void => {
    const canvas = this.getNodeEditor();

    if (!canvas) return;
    canvas.showVariables = !canvas.showVariables;
    this.getToolbar()?.setShowVariables(canvas.showVariables);
  };

  private readonly handleFitToContentRequest = (): void => {
    const fitted = this.getNodeEditor()?.fitToContent(true) ?? false;

    if (!fitted) {
      this.showToast({
        message: this.text("editor.toast.emptyGuide"),
        type: "info",
      });
    }
  };

  private readonly handleUndoRequest = (): void => {
    this.undo();
  };

  private readonly handleRedoRequest = (): void => {
    this.redo();
  };

  private readonly handleZoomInRequest = (): void => {
    this.getNodeEditor()?.zoomIn();
  };

  private readonly handleZoomOutRequest = (): void => {
    this.getNodeEditor()?.zoomOut();
  };

  private readonly handleZoomResetRequest = (): void => {
    this.getNodeEditor()?.resetZoom();
  };

  /**
   * # Trying the guide on the canvas — story 065
   *
   * The first question anybody asks of a guide they have just built is *"why
   * did I end up here?"* The preview panel can only say where you are; the
   * canvas, with green behind you, says which answer and which rule outcome
   * took you there. That is what makes the editor a debugger for a guide
   * rather than a drawing of one.
   *
   * ## One engine, two mirrors — and why it is not two engines
   *
   * The run belongs to **one** `GuideTraversalEngine`, the one the preview
   * panel builds. The node the run is standing on draws that same object
   * (`guide-preview.mirror`); it does not build a second engine and keep it in
   * step. The alternative was measured against on 2026-09-01 and rejected in
   * the assignment's Status: forwarding every answer and every Next to the
   * panel's engine and syncing back is two answers to *where is the visitor
   * now*, which can disagree — the exact shape of fault this codebase keeps
   * finding (PRAXIS 1 and 15). Sharing the object makes that class of fault
   * impossible instead of guarded.
   *
   * What the engine does **not** hold is what has not been answered yet: a
   * half-typed page lives in the writing mirror's DOM. The other mirror still
   * shows it — as a draft, forwarded by the shell (`handlePreviewDraftChanged`)
   * and dropped when the engine moves — so the story's "what you fill in shows
   * in the tab" holds while typing, not only from Next onwards. Only the
   * engine ever answers; the draft is a picture of the other field.
   *
   * A step the run has already left is a different thing again: a *picture*,
   * with its own one-step engine that decides nothing and is handed the run's
   * answers (`seedAnswers`) so the field still shows what was said.
   *
   * ## Where the state is, and where it is not
   *
   * Two fields here and no more. Which step, which trail, which answers are
   * asked of the engine every time rather than kept; the canvas derives the
   * answered steps and the rule outcomes from the trail it is given, because a
   * list beside it could disagree with it. An edit ends the run
   * (`staleProving`) rather than the trail being worked out again — see that
   * method for why it has to be hooked in two places.
   */
  private provingRun: { stale: boolean } | null = null;

  /**
   * "Vägar hit" as a MODE (Johan 2/9): the paths-to-a-node highlight used to
   * die with the selection. In the mode, pressing a node shows the paths to
   * it, deselecting keeps them, Escape/Avsluta ends it. Placeholder braces are
   * replaced by hand because this shell's text() takes no parameters.
   *
   * One mode, three doors (5/9): the Guide menu (asks for the selected node,
   * or prompts), the node's ⋯ and the outline's ⇄ (both name the node). The
   * last two used to draw their own one-shot highlight — under the list, in
   * the outline's case — and the films had to know which door they used.
   *
   * Not gated on `routeAnalysis`. It was, inherited from the preview's route
   * summary, and the menu item was hidden with it on 2/9 because it showed
   * and did nothing; but reading the ways to a refusal is not premium — a
   * Basic guide with one Rule node already has more of them than a person
   * holds in their head (measured on the housing-screening page). The
   * capability still gates the preview panel's own analysis.
   */
  private routesModeValue = false;

  private readonly handleRoutesHereRequest = (
    event: Event,
  ): void => {
    const asked = (event as CustomEvent<{ nodeId?: string }>).detail?.nodeId;

    this.endProving();
    this.toggleListView(false);
    this.routesModeValue = true;

    const target = asked ?? this.selectedNodeId;

    this.applyRoutesTo(target);

    /*
     * Put the keyboard on the asked node. The menu item that asked sat in the
     * canvas, but the menu closes when pressed and focus fell to the document
     * — where the canvas cannot hear the Escape that ends the mode (Johan
     * 23/9: "släpper inte på Esc"). From the node, Escape reaches the canvas's
     * own handler, which ends the routes before it touches the selection.
     */
    if (target) {
      this.getNodeEditor()?.focusNodeById(target);
    }
  };

  /**
   * The guide's id, minted once and only when it is missing (story 123).
   *
   * Written into `this.graphData` and not only into what is handed out: the
   * whole value of the id is that the next export carries the same one, and an
   * id that lived only in the file would be a new guide every time.
   *
   * A save-like moment, not an edit — the same stance `stampSubmissionSchema`
   * takes: no history entry, but the host is told the graph changed so that
   * what it stores next carries the id too. An id is a name, not a change of
   * meaning, so there is nothing for undo to give back.
   */
  private mintGuideId(): void {
    const existing = this.graphData.meta?.id;

    if (typeof existing === "string" && existing !== "") {
      return;
    }

    const meta = { ...this.graphData.meta, id: newGuideId() };

    this.graphData = { ...this.graphData, meta };
    this.getNodeEditor()?.setMeta(meta);
  }

  /** Ctrl+S and Arkiv → Spara (5/9: the key was the only way to ask). */
  private requestSave(): void {
    /*
     * Before the event, because the host reads `getData()` inside its own
     * handler. A host that declines the save still leaves the id behind, and
     * that is the right trade: an id nobody asked for costs nothing, while a
     * second mint later would give one guide two identities.
     */
    this.mintGuideId();

    const taken = !this.dispatchEvent(
      new CustomEvent("save-request", { bubbles: true, composed: true, cancelable: true })
    );
    if (!taken) {
      this.showToast({
        message: this.text("editor.save.hostSavesHint"),
        type: "info",
      });
    }
  }

  private readonly handleRoutesEndRequest = (): void => {
    this.endRoutes();
  };

  private endRoutes(): void {
    if (!this.routesModeValue) return;

    this.routesModeValue = false;

    const nodeEditor = this.getNodeEditor();

    if (nodeEditor) {
      nodeEditor.routesLabel = null;
      nodeEditor.clearConnectionHighlights();
    }

    // The preview tab's own result highlight may apply again.
    this.updateConnectionHighlights();
  }

  private applyRoutesTo(nodeId: string | null): void {
    const nodeEditor = this.getNodeEditor();

    if (!nodeEditor) return;

    const node = nodeId
      ? this.graphData.nodes.find((candidate) => candidate.id === nodeId) ?? null
      : null;

    if (!node) {
      nodeEditor.routesLabel = this.text("editor.routes.prompt");
      return;
    }

    const title =
      resolveText(node.data.title, this.activeLocale, "") || node.id;

    nodeEditor.routesLabel = this.text("editor.routes.status").replace(
      "{title}",
      title,
    );
    // The canvas draws it: it knows the target, so "nothing leads here" dims
    // the guide and leaves the node lit instead of showing nothing.
    nodeEditor.showRoutesTo(node.id);
  }

  private readonly handleProveGuideRequest = (): void => {
    this.startProving();
  };

  private readonly handleProvingEndRequest = (): void => {
    this.endProving();
  };

  /**
   * Starts a run, always from the start step (story 065 point 1).
   *
   * A step halfway through a guide has a state that depends on everything
   * before it, so a run that jumped in at one could show a route no visitor can
   * take. There is deliberately no way in from a node on the canvas.
   */
  private startProving(): void {
    this.endRoutes();

    const preview = this.getSidebarPreview();

    if (!preview) {
      return;
    }

    this.setSidebarMode("preview");
    // The run is drawn in the panel, so it opens (story 145).
    this.setPanelOpen(true, "none");
    this.provingRun = { stale: false };

    /*
     * The panel drops `compact` for the run. Compact is the route summary —
     * heading plus where each exit leads — which is the right thing when the
     * panel is showing a step somebody selected, and the wrong thing when it is
     * one of two mirrors of a run: the step itself is what has to be there.
     */
    preview.removeAttribute("compact");
    /*
     * The panel is a mirror of the run, so it has to know it is one: the file
     * and map fields swap their control for the run's stand-in button under
     * this attribute (story 065's follow-up), and a mirror that did not know
     * would offer the machine's file picker in the middle of a run.
     */
    preview.setAttribute("proving", "");
    preview.activeLocale = this.activeLocale;
    preview.graph = this.getData();
    preview.restart();
    this.syncProving();
  }

  /**
   * Pretend answers from the host (story 085, AC 4): `namn = Anna`, one per
   * line, handed to the panel's preview as `given`. They hold across runs —
   * the preview keeps them — and the names no node declares are written
   * under the field, so an empty field in the run can be explained. Editor
   * memory only: a guide must not carry a pretend login with it.
   */
  private applyGivenText(): void {
    const preview = this.getSidebarPreview();
    const text = this.root.querySelector<HTMLTextAreaElement>("[data-given]")?.value ?? "";
    const answers: Record<string, string> = {};

    for (const line of text.split("\n")) {
      const at = line.indexOf("=");
      const name = at < 0 ? "" : line.slice(0, at).trim();
      if (name) answers[name] = line.slice(at + 1).trim();
    }

    if (preview) preview.given = Object.keys(answers).length > 0 ? { answers } : null;

    const unmatched = QuestionVariableService.undeclared(this.graphData, Object.keys(answers));
    const note = this.root.querySelector<HTMLElement>("[data-given-unmatched]");
    if (note) {
      note.textContent = unmatched.length > 0
        ? this.text("editor.proving.givenUnmatched").replace("{names}", unmatched.join(", "))
        : "";
    }
  }

  /** Ends the run and leaves the focus on the step it was standing on. */
  private endProving(): void {
    if (!this.provingRun) {
      return;
    }

    const nodeEditor = this.getNodeEditor();
    const standingOn = nodeEditor?.proving?.currentNodeId ?? null;

    this.provingRun = null;
    this.getSidebarPreview()?.removeAttribute("proving");
    this.getSidebarPreview()?.setAttribute("compact", "");
    this.refreshSidebarPreview();

    if (nodeEditor) {
      nodeEditor.provingSource = null;
      nodeEditor.proving = null;
    }

    if (standingOn) {
      nodeEditor?.focusNodeById(standingOn);
    }
  }

  /**
   * Ends a run because the guide changed under it (story 065 point 8).
   *
   * The trail is a statement about a graph, and the graph it described is gone;
   * working it out again live would mean deciding what an answer to a question
   * somebody just deleted meant. So the run is over — but the line stays,
   * saying so, until somebody starts it again or ends it. A line that vanished
   * on an edit would read as a fault rather than as an answer.
   *
   * Called from two places, and it has to be both. `handleGraphChanged` hears
   * everything that goes through the canvas — the panel, a drag, a connection,
   * the palette. An **undo** does not: it goes `applyHistoryGraph` → `#loadGraph`
   * and dispatches on the host, deliberately bypassing that handler. Measured
   * on 2026-09-01: after an undo the reason list was unchanged while the title
   * had gone back. Reading the code alone would have let a run keep a trail
   * through a guide that had been rolled back under it.
   */
  private staleProving(): void {
    if (!this.provingRun || this.provingRun.stale) {
      return;
    }

    this.provingRun.stale = true;
    this.syncProving();
  }

  /** Hands the canvas what the engine now says. Cheap, and called often. */
  private syncProving(): void {
    const nodeEditor = this.getNodeEditor();
    const preview = this.getSidebarPreview();
    const run = this.provingRun;

    if (!nodeEditor) {
      return;
    }

    if (!run || !preview) {
      nodeEditor.provingSource = null;
      nodeEditor.proving = null;
      return;
    }

    nodeEditor.provingSource = run.stale ? null : preview;
    nodeEditor.proving = {
      currentNodeId: run.stale ? null : preview.getCurrentNodeId(),
      trailConnectionIds: run.stale ? [] : preview.getTraversedConnectionIds(),
      answers: preview.getAnswers(),
      step: preview.getStepNumber(),
      stale: run.stale,
    };
    // The third mirror (story 076): the list, when it is up, draws the same run.
    this.syncOutlineProving();
  }

  /** The list view's copy of the run — the canvas's own, never a second reading. */
  private syncOutlineProving(): void {
    const outline = this.root.querySelector<HTMLElement & { proving: ProvingState | null }>(
      "guide-outline",
    );

    if (!outline || outline.hidden) return;
    outline.proving = this.getNodeEditor()?.proving ?? null;
  }

  private readonly handlePreviewNodeChanged = (
    event: CustomEvent<{ nodeId: string; answers: Record<string, string> }>
  ): void => {
    const nodeEditor = this.getNodeEditor();

    /*
     * During a run the canvas follows the step rather than the selection: it
     * pans to the new step (the same movement "Tillbaka till guiden" makes) and
     * redraws the trail, but it does not select the node — selecting would send
     * the panel's own `showNode` back into the engine that has just moved.
     */
    if (this.provingRun) {
      // A ride between the steps, not a cut: the eye keeps the path.
      nodeEditor?.centerNodeById(event.detail.nodeId, { smooth: true });
      this.syncProving();
      // The other mirror. Both draw the one engine, and only the one that was
      // pressed knows it moved — so the panel is told rather than listening.
      this.getSidebarPreview()?.refresh();

      /*
       * An email result still SHOWS its email during a run (story 065: shows,
       * never sends) — the modal was unreachable here after the early return,
       * found when "Testa från start" stopped being a second way to run.
       */
      if (this.capabilitiesValue.emailResults) {
        const mirror = event.composedPath().find(
          (candidate): candidate is GuidePreview =>
            candidate instanceof HTMLElement && candidate.tagName === "GUIDE-PREVIEW"
        );
        const output = mirror?.getOutput();

        if (output) {
          this.getEmailOutputDialog()?.open(output, event.detail.answers, this.getData(), this.activeLocale);
        }
      }

      return;
    }

    nodeEditor?.selectNodeById(event.detail.nodeId);
    nodeEditor?.centerNodeById(event.detail.nodeId);

    const preview = event.composedPath().find(
      (candidate): candidate is GuidePreview =>
        candidate instanceof HTMLElement && candidate.tagName === "GUIDE-PREVIEW"
    );

    // Spåra vägen: markera de passerade kopplingarna i editorn.
    if (this.capabilitiesValue.routeAnalysis && preview) {
      nodeEditor?.highlightConnections(preview.getTraversedConnectionIds());
    }

    if (!this.capabilitiesValue.emailResults) return;

    const output = preview?.getOutput();

    if (output) {
      this.getEmailOutputDialog()?.open(output, event.detail.answers, this.getData(), this.activeLocale);
    }
  };

  /**
   * What one mirror of the run is typing, shown in the other (see
   * `GuidePreview.mirror`). The shell forwards rather than the mirrors
   * listening to each other, as with the step: it is the one that knows
   * which two there are. Outside a live run there is no other mirror.
   */
  private readonly handlePreviewDraftChanged = (
    event: CustomEvent<{ values: Answers }>
  ): void => {
    if (!this.provingRun || this.provingRun.stale) return;

    const sidebar = this.getSidebarPreview();
    const other = event.composedPath()[0] === sidebar ? this.getNodeEditor()?.liveStep : sidebar;

    other?.showDraft(event.detail.values);
  };

  private readonly handleStartNodeRemoveIntent = async (
    event: Event
  ): Promise<void> => {
    const { nodeId } = (event as CustomEvent<{ nodeId: string }>).detail;

    if (nodeId !== this.graphData.startNodeId) {
      return;
    }

    const confirmed = await this.getConfirmationDialog()?.confirm({
      title: this.text("editor.confirm.removeStartNode.title"),
      message: this.text("editor.confirm.removeStartNode.message"),
      confirmLabel: this.text("editor.confirm.removeStartNode.confirm"),
      // A removal the editor's history can undo: no significant loss (B3).
      tone: "normal",
    });

    if (confirmed) {
      this.getNodeEditor()?.removeNodeById(nodeId);
    }
  };

  private readonly handleLocaleChange = (event: Event): void => {
    this.setActiveLocale((event as CustomEvent<LocaleChangeDetail>).detail.locale);
  };

  /**
   * Changes which language of the content is being edited.
   *
   * Shared by the toolbar's choice and by the landing on load, so a translator
   * who lands automatically ends up in exactly the same state as an editor who
   * chooses by hand.
   */
  private setActiveLocale(locale: string): void {
    this.activeLocale = locale;

    /*
     * The editor's UI language is deliberately *not* touched here.
     *
     * This used to set `editorLocale = locale`, on the reasoning that the app
     * has only one language control so it may as well drive both. The
     * consequence was that a translator switching to English to translate the
     * *content* got English buttons, panel and palette: the tool changed
     * language under the hands of someone who asked for something else.
     *
     * That the example app has one control is a bug in the example app. The
     * editor's language is the global axis, set by the host with
     * `editor-locale`. Story 014, criterion 1.
     */
    this.syncToolbarLocales();

    const selectedNode = this.selectedNodeId
      ? this.graphData.nodes.find((node) => node.id === this.selectedNodeId) ??
        null
      : null;
    this.updatePropertiesPanel(selectedNode);
    // The canvas and the preview are shown in the chosen language, source fallback.
    const nodeEditor = this.getNodeEditor();
    if (nodeEditor) {
      nodeEditor.activeLocale = locale;
    }
    this.updateTranslationProgress();
    this.refreshSidebarPreview();
  }

  /** Moduler-menyn växlade en modul → styr editorn via modules-axeln. */
  private readonly handleModulesChange = (event: Event): void => {
    const { modules } = (event as CustomEvent<{ modules: string[] }>).detail;
    this.modules = modules;
  };

  private readonly handleStartNodeChangeIntent = async (
    event: Event
  ): Promise<void> => {
    const { nodeId } = (event as CustomEvent<{ nodeId: string }>).detail;
    const node = this.graphData.nodes.find(
      (candidate) => candidate.id === nodeId
    );

    // The same rule as the menu in node-editor: questions and Pages can be the
    // start node, but never fields inside a Page — they are not steps.
    if (!node || !isGuideStepNode(node) || node.parentPageId) {
      return;
    }

    const incomingCount = this.graphData.connections.filter(
      (connection) => connection.to.nodeId === node.id
    ).length;

    if (incomingCount > 0) {
      const confirmed = await this.getConfirmationDialog()?.confirm({
        title: this.text(
          node.type === "page"
            ? "editor.confirm.makeStartNode.titlePage"
            : "editor.confirm.makeStartNode.titleQuestion"
        ),
        message: this.text(
          incomingCount === 1
            ? "editor.confirm.makeStartNode.messageOne"
            : "editor.confirm.makeStartNode.messageMany",
          { count: incomingCount }
        ),
        confirmLabel: this.text("editor.confirm.makeStartNode.confirm"),
        // Connections go, and the history can bring them back (B3).
        tone: "normal",
      });

      if (!confirmed) {
        return;
      }
    }

    this.getNodeEditor()?.setStartNodeById(node.id);
  };

  /** Keeps the view where it was through a change of available area. */
  private holdViewportCentre(): void {
    const nodeEditor = this.getNodeEditor();
    const center =
      this.pendingFullscreenCenter ?? nodeEditor?.getViewportCenter() ?? null;

    this.pendingFullscreenCenter = null;

    if (!nodeEditor || !center) {
      return;
    }

    // Hold the centre through the whole layout change, so the view does not land
    // in an empty area when the screen area shrinks.
    nodeEditor.restoreViewportCenter(center);
  }

  private readonly handleGraphResetIntent = async (): Promise<void> => {
    const confirmed = await this.getConfirmationDialog()?.confirm({
      title: this.text("editor.confirm.resetGuide.title"),
      message: this.text("editor.confirm.resetGuide.message"),
      confirmLabel: this.text("editor.confirm.resetGuide.confirm"),
      // Replaces the whole guide and cannot be undone (B3).
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent("graph-reset-request", {
        bubbles: true,
        composed: true,
      })
    );
  };

  private readonly handleToastRequest = (
    event: CustomEvent<ToastRequestDetail>
  ): void => {
    this.showToast(event.detail);
  };

  /*
   * The registered export stamps (editor/core/export-stamps.ts) are applied
   * before either export — the pro version's submission schema (story 094),
   * so the guide's JSON carries the schema of exactly this guide and the
   * health check has something to compare with. Exporting is a save-like
   * moment, not an edit: no history entry, but the host is told the graph
   * changed so what it stores next carries the stamp too. Was
   * `stampSubmissionSchema`, which computed the schema itself (step 4).
   */
  private stampForExport(): GuideMeta {
    this.mintGuideId();

    const graph = this.getData();
    let meta: GuideMeta = { ...this.graphData.meta };
    for (const stamp of exportStamps()) {
      meta = { ...meta, ...(stamp(graph) ?? {}) };
    }

    this.graphData = { ...this.graphData, meta };
    this.getNodeEditor()?.setMeta(meta);
    this.dispatchEvent(
      new CustomEvent<GraphChangedDetail>("graph-changed", {
        detail: { graph: this.getData(), reason: "guide-updated" },
        bubbles: true,
        composed: true,
      })
    );

    return meta;
  }

  private download(json: string, filename: string): void {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private readonly handleSchemaExportRequest = (): void => {
    if (!this.capabilitiesValue.importExport) {
      return;
    }

    // The schema is the pro version's stamp; without it there is nothing to export.
    const schema = this.stampForExport().submissionSchema;
    if (!schema) return;
    const file = `${this.exportFileBaseName()}.schema.json`;
    this.download(JSON.stringify(schema, null, 2), file);
    this.showToast({
      message: this.text("editor.toast.schemaExported", { file }),
      type: "success",
    });
  };

  private readonly handleGraphExportRequest = (): void => {
    if (!this.capabilitiesValue.importExport) {
      return;
    }

    this.stampForExport();
    const result = exportGraphJson(this.getData());

    if (!result.success) {
      this.showToast({
        message: this.formatErrors(
          this.text("editor.toast.exportBlocked"),
          result.errors
        ),
        type: "error",
      });
      return;
    }

    // The filename is built from the guide's name. Four exported files all named
    // the same can only be told apart by opening them.
    this.download(result.json, `${this.exportFileBaseName()}.json`);

    this.showToast({
      message: this.text("editor.toast.exported"),
      type: "success",
    });
  };

  private readonly handleGraphImportRequest = async (
    event: CustomEvent<GraphImportRequestDetail>
  ): Promise<void> => {
    if (!this.capabilitiesValue.importExport) {
      return;
    }

    /*
     * A template arriving here is a different **shape**, not a different door.
     * Two file pickers would be two things to explain and two places for the
     * next format to be forgotten.
     */
    let parsed: unknown;

    try {
      parsed = JSON.parse(event.detail.json);
    } catch {
      parsed = null;
    }

    if (isTemplateFile(parsed)) {
      this.addCustomNodeType(parsed.template);

      const missing = missingFormatOf(parsed.template);
      const needs = templateNeeds(parsed.template, (capability) =>
        Boolean(this.capabilitiesValue[capability as keyof typeof this.capabilitiesValue]),
      );

      /*
       * Said differently when it is not what was asked for. Nothing is refused —
       * a template is a template whichever menu item opened the picker — but
       * somebody who chose "Importera guide" and sees their guide unchanged
       * deserves to be told why rather than left to wonder.
       */
      this.showToast({
        message:
          event.detail.expecting === "guide"
            ? this.text("editor.toast.templateNotGuide", { file: event.detail.fileName })
            : this.text("editor.toast.templateImported", {
                name: parsed.template.label,
              }),
        type: "success",
      });

      /*
       * Said out loud rather than discovered later. A template carrying
       * `mask: "###-##-####"` is complete anywhere; one carrying
       * `format: "fnr-no"` names behaviour that lives in the editor it came
       * from, and without this the field would simply appear and check nothing.
       */
      if (missing) {
        this.showToast({
          message: this.text("editor.toast.templateNeedsFormat", {
            name: parsed.template.label,
            format: missing,
          }),
          type: "info",
        });
      }

      /*
       * And whether it can be used here at all. The palette already filters a
       * template whose base type is missing or switched off — correctly — but
       * silently, so a cheerful "added to the library" sat over something nobody
       * would ever see in it.
       */
      if (needs) {
        this.showToast({
          message:
            needs.kind === "unknown"
              ? this.text("editor.toast.templateUnknownBase", {
                  name: parsed.template.label,
                  base: needs.base,
                })
              : this.text("editor.toast.templateDisabledBase", {
                  name: parsed.template.label,
                  base: needs.base,
                  capability: needs.capability ?? "",
                }),
          type: "info",
        });
      }

      return;
    }

    /*
     * A guide arriving under "Importera mall" is refused rather than applied.
     * Everywhere else the shape decides and the wording explains, but this is
     * the one direction where guessing wrong destroys something: somebody
     * expecting a palette entry does not expect their guide to be replaced.
     */
    if (event.detail.expecting === "template") {
      this.showToast({
        message: this.text("editor.toast.guideNotTemplate", { file: event.detail.fileName }),
        type: "info",
      });
      return;
    }

    const result = importGraphJson(event.detail.json);

    if (!result.success) {
      this.showToast({
        message: this.formatErrors(
          this.text("editor.toast.importFailed", { file: event.detail.fileName }),
          result.errors
        ),
        type: "error",
      });
      return;
    }

    /*
     * Asked once there is something to import, and not before.
     *
     * This is the only destructive action in the whole flow and it was the only
     * one without a question: choosing a file replaced the guide outright. Johan
     * named the consequence exactly — a redaktör wary of the button is behaving
     * correctly, and that wariness costs more than a dialog does.
     *
     * After the parse rather than before it, because asking whether to replace a
     * guide and *then* discovering the file is unreadable is a question that
     * cost somebody a decision for nothing. A broken file reports straight away
     * and nothing is ever at risk.
     */
    const confirmed = await this.getConfirmationDialog()?.confirm({
      title: this.text("editor.confirm.importGuide.title"),
      message: this.text("editor.confirm.importGuide.message", {
        name:
          resolveText(this.graphData.meta?.name, this.activeLocale, "") ||
          this.text("editor.confirm.importGuide.unnamed"),
        file: event.detail.fileName,
      }),
      confirmLabel: this.text("editor.confirm.importGuide.confirm"),
      // Replaces the whole guide; `graph =` resets the history (B3).
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    this.graph = result.graph;

    this.showToast({
      message: this.text("editor.toast.imported", { file: event.detail.fileName }),
      type: "success",
    });

    this.dispatchEvent(
      new CustomEvent<GraphChangedDetail>("graph-changed", {
        detail: {
          graph: this.getData(),
          reason: "graph-imported",
        },
        bubbles: true,
        composed: true,
      })
    );
  };

  private formatErrors(heading: string, errors: string[]): string {
    const visibleErrors = errors.slice(0, 3).join(" ");
    const remainingCount = errors.length - 3;
    const remaining =
      remainingCount > 0
        ? ` ${this.text("editor.errors.more", { count: remainingCount })}`
        : "";

    return `${heading}: ${visibleErrors}${remaining}`;
  }

  /**
   * What the palette should create. The key is either a node type or a
   * template's — the template gives a node of its **base type** with the values
   * filled in and its key as provenance, never a node whose type is the
   * template.
   */
  private newNodeFrom(
    key: string
  ): { type: string; data: Record<string, unknown>; template?: string } | null {
    const template = getLibrary().find((item) => item.type === key);

    if (template) {
      const capability = templateCapability(template);
      return capability && !this.capabilitiesValue[capability]
        ? null
        : nodeFromTemplate(template);
    }

    const definition = getNodeType(key);

    if (
      !definition ||
      (definition.requiredCapability &&
        !this.capabilitiesValue[definition.requiredCapability])
    ) {
      return null;
    }

    return { type: key, data: definition.createData() };
  }

  private readonly handleNodeTypeDragStart = (
    event: CustomEvent<NodeTypeDragStartDetail>
  ): void => {
    const nodeEditor = this.getNodeEditor();
    const skapad = this.newNodeFrom(event.detail.type);

    if (!skapad || !nodeEditor) {
      return;
    }

    const id = crypto.randomUUID();
    nodeEditor.startPaletteDrag(
      {
        id,
        position: { x: 0, y: 0 },
        ...skapad,
      },
      {
        pointerId: event.detail.pointerId,
        clientX: event.detail.clientX,
        clientY: event.detail.clientY,
      },
      this.templateFieldsFor(event.detail.type, id)
    );
  };

  /*
   * Ctrl+K (story 074). Två slags träffar ur samma fält: Gå till (nodernas
   * titlar — markerar, pannar och öppnar egenskaperna) och Lägg till
   * (palettens typer, samma capability-gallring och samma pekarfria väg som
   * palettens klick — handleNodeTypeAdd återanvänds, sida-i-sida-logiken
   * följer med gratis). Fokus lämnas tillbaka dit det var när rutan stängs.
   */
  private quickChoiceIndex = 0;
  private quickOpenReturnFocus: HTMLElement | null = null;

  private readonly handleQuickOpenShortcut = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() !== "k" || !(event.ctrlKey || event.metaKey)) {
      return;
    }
    if (!canEditGuide(this.mode)) {
      return;
    }

    event.preventDefault();
    this.openQuickOpen();
  };

  /** En synlig översikt hålls i takt — markering och graf flödar in. */
  private syncOutline(): void {
    const outline = this.root.querySelector<HTMLElement & {
      graph: GraphData | null;
      selectedNodeId: string | null;
      activeLocale: string;
      uiLocale: string;
      healthContext: GuideHealthContext;
    }>("guide-outline");

    if (!outline || outline.hidden) return;
    outline.activeLocale = this.activeLocale;
    outline.uiLocale = this.editorLocale;
    outline.healthContext = this.healthContext();
    outline.graph = this.getData();
    outline.selectedNodeId = this.selectedNodeId;
    this.syncOutlineProving();
  }

  private toggleListView(force?: boolean): void {
    const outline = this.root.querySelector<HTMLElement>("guide-outline");

    if (!outline) return;
    const show = force ?? Boolean(outline.hidden);

    outline.hidden = !show;
    this.getToolbar()?.setListView(show);

    if (show) {
      this.syncOutline();
    }
  }

  private readonly handleListViewKeydown = (event: KeyboardEvent): void => {
    const outline = this.root.querySelector<HTMLElement>("guide-outline");

    if (event.key === "Escape" && outline && !outline.hidden) {
      event.preventDefault();
      this.toggleListView(false);
    }
  };

  private openQuickOpen(): void {
    const overlay = this.root.querySelector<HTMLElement>("[data-quick-open]");
    const input = this.root.querySelector<HTMLInputElement>("[data-quick-input]");

    if (!overlay || !input) return;
    this.quickOpenReturnFocus =
      (this.root.activeElement as HTMLElement | null) ?? null;
    overlay.hidden = false;
    input.value = "";
    this.renderQuickHits();
    input.focus();
  }

  private closeQuickOpen(): void {
    const overlay = this.root.querySelector<HTMLElement>("[data-quick-open]");

    if (overlay) overlay.hidden = true;
    this.quickOpenReturnFocus?.focus?.();
    this.quickOpenReturnFocus = null;
  }

  private quickHits(): Array<{ kind: "goto" | "add"; id: string; label: string }> {
    const input = this.root.querySelector<HTMLInputElement>("[data-quick-input]");
    const query = (input?.value ?? "").trim().toLowerCase();

    if (query === "") return [];

    const hits: Array<{ kind: "goto" | "add"; id: string; label: string }> = [];

    for (const node of this.graphData.nodes) {
      const title = resolveText(node.data.title, this.activeLocale, "").trim();
      const typeLabel = displayNodeTypeLabel(
        node.type,
        getNodeType(node.type)?.label,
        this.editorLocale,
      );
      const shown = title || typeLabel;

      if (shown.toLowerCase().includes(query)) {
        hits.push({
          kind: "goto",
          id: node.id,
          label: this.text("editor.quickOpen.goTo", { title: shown }),
        });
      }
      if (hits.length >= 6) break;
    }

    for (const { type, definition } of getNodeTypes()) {
      // What the palette offers, and nothing the registry merely knows.
      if (!isOfferedNodeType(type)) continue;
      if (
        definition.requiredCapability &&
        !(this.capabilitiesValue as unknown as Record<string, boolean>)[
          definition.requiredCapability
        ]
      ) {
        continue;
      }
      const label = displayNodeTypeLabel(type, definition.label, this.editorLocale);

      if (label.toLowerCase().includes(query)) {
        hits.push({
          kind: "add",
          id: type,
          label: this.text("editor.quickOpen.addNode", { type: label }),
        });
      }
      if (hits.length >= 9) break;
    }

    return hits;
  }

  private renderQuickHits(): void {
    const list = this.root.querySelector<HTMLElement>("[data-quick-list]");

    if (!list) return;
    const hits = this.quickHits();

    this.quickChoiceIndex = 0;
    list.innerHTML =
      hits.length === 0
        ? `<p class="guide-editor__quick-open-empty">${escapeHtml(this.text("editor.quickOpen.empty"))}</p>`
        : hits
            .map(
              (hit, index) => `
                <div class="guide-editor__quick-open-hit" data-quick-hit data-kind="${hit.kind}" data-id="${escapeHtml(hit.id)}" role="option" aria-selected="${index === 0}">
                  ${escapeHtml(hit.label)}
                </div>`,
            )
            .join("");
    list.querySelectorAll<HTMLElement>("[data-quick-hit]").forEach((row) => {
      row.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.runQuickHit(row.dataset.kind ?? "", row.dataset.id ?? "");
      });
    });
  }

  private moveQuickChoice(step: number): void {
    const rows = [
      ...this.root.querySelectorAll<HTMLElement>("[data-quick-hit]"),
    ];

    if (rows.length === 0) return;
    this.quickChoiceIndex =
      (this.quickChoiceIndex + step + rows.length) % rows.length;
    rows.forEach((row, index) =>
      row.setAttribute("aria-selected", String(index === this.quickChoiceIndex)),
    );
  }

  private executeQuickChoice(): void {
    const rows = [
      ...this.root.querySelectorAll<HTMLElement>("[data-quick-hit]"),
    ];
    const row = rows[this.quickChoiceIndex];

    if (row) this.runQuickHit(row.dataset.kind ?? "", row.dataset.id ?? "");
  }

  private runQuickHit(kind: string, id: string): void {
    this.closeQuickOpen();

    if (kind === "goto") {
      const nodeEditor = this.getNodeEditor();

      nodeEditor?.selectNodeById(id);
      nodeEditor?.centerNodeById(id);
      return;
    }

    if (kind === "add") {
      this.handleNodeTypeAdd(
        new CustomEvent("node-type-add", { detail: { type: id } }) as never,
      );
    }
  }

  private readonly handleNodeTypeAdd = (
    event: CustomEvent<NodeTypeAddDetail>
  ): void => {
    const nodeEditor = this.getNodeEditor();
    const skapad = this.newNodeFrom(event.detail.type);

    if (!skapad || !nodeEditor) {
      return;
    }

    /*
     * Story 034: a page-only type from the palette is a command, not a hint.
     * It used to toast "drag it in instead", which closed two node types to
     * anyone without a pointer. Now the click creates the node in a page —
     * the only one when there is one, a chosen one when there are several,
     * and a plain statement when the guide has no page yet.
     */
    const definition = getNodeType(skapad.type);
    if (definition?.pageOnly) {
      void this.addPageBoundNode(
        skapad,
        displayNodeTypeLabel(skapad.type, definition.label, this.editorLocale),
      );
      return;
    }

    const id = crypto.randomUUID();
    nodeEditor.addNode(
      {
        id,
        position: nodeEditor.getSuggestedNodePosition(),
        ...skapad,
      },
      { children: this.templateFieldsFor(event.detail.type, id) }
    );

    requestAnimationFrame(() => {
      this.getPropertiesPanel()?.focusProperty("title");
    });
  };

  /** Sidans namn för ett val — samma upplösning som resten av editorn. */
  private pageChoiceLabel(page: FlowNodeData): string {
    return (
      resolveText(page.data.title, this.editorLocale, "").trim() ||
      this.text("editor.canvas.untitledPage")
    );
  }

  private async addPageBoundNode(
    skapad: { type: string; data: FlowNodeData["data"] },
    label: string,
  ): Promise<void> {
    const nodeEditor = this.getNodeEditor();

    if (!nodeEditor) {
      return;
    }

    const pages = this.graphData.nodes.filter((node) => node.type === "page");

    if (pages.length === 0) {
      this.showToast({
        message: this.text("editor.toast.pageOnlyNoPage", { label }),
        type: "info",
      });
      return;
    }

    let pageId = pages[0]!.id;

    if (pages.length > 1) {
      const dialog = this.root.querySelector<PromptDialog>("prompt-dialog");
      const chosen = await dialog?.choose({
        title: this.text("editor.dialogs.choosePage.title"),
        message: this.text("editor.dialogs.choosePage.message", { label }),
        choices: pages.map((page) => ({ id: page.id, label: this.pageChoiceLabel(page) })),
      });

      if (!chosen) {
        return;
      }

      pageId = chosen;
    }

    nodeEditor.addNodeToPage(
      {
        id: crypto.randomUUID(),
        position: nodeEditor.getSuggestedNodePosition(),
        ...skapad,
      },
      pageId,
    );
  }

  private readonly handleQuestionOptionReorder = (
    event: CustomEvent<QuestionOptionReorderDetail>
  ): void => {
    const { nodeId, optionId, targetIndex } = event.detail;

    const node = this.graphData.nodes.find(
      (candidate) => candidate.id === nodeId
    );

    if (!node) {
      return;
    }

    const options = QuestionOptionsService.getOptions(node);

    const updatedOptions = QuestionOptionsService.moveOptionToIndex(
      options,
      optionId,
      targetIndex
    );

    const updatedNode = this.updateNodeProperty(
      nodeId,
      "options",
      updatedOptions
    );

    /*
     * The panel must re-render to show the options in the new order.
     */
    this.updatePropertiesPanel(updatedNode);
  };

  private readonly handleQuestionOptionMove = (
    event: CustomEvent<QuestionOptionMoveDetail>
  ): void => {
    const node = this.graphData.nodes.find(
      (candidate) => candidate.id === event.detail.nodeId
    );

    if (!node) {
      return;
    }

    const options = QuestionOptionsService.getOptions(node);

    const updatedOptions = QuestionOptionsService.moveOption(
      options,
      event.detail.optionId,
      event.detail.direction
    );

    const updatedNode = this.updateNodeProperty(
      node.id,
      "options",
      updatedOptions
    );

    this.updatePropertiesPanel(updatedNode);
  };

  private readonly handleNodeVisibilityChanged = (
    event: CustomEvent<NodeVisibilityChangedDetail>
  ): void => {
    this.getNodeEditor()?.updateNodeVisibility(
      event.detail.nodeId,
      event.detail.visibility
    );
  };
  /**
   * Changing or removing a node's provenance.
   *
   * Only the name changes. The template's values apply when a node is
   * *created* — repointing an existing node must never rewrite what someone
   * authored in it.
   */
  /**
   * The guide changes source language.
   *
   * No text is rewritten — what changes is which key counts as the original, and
   * therefore what the translator sees as a reference and what the progress
   * counts. The panel has already refused the change if the target language is
   * not fully translated.
   */
  private readonly handleNodeTemplateChanged = (
    event: CustomEvent<NodeTemplateChangedDetail>
  ): void => {
    this.getNodeEditor()?.updateNodeTemplate(
      event.detail.nodeId,
      event.detail.template
    );
  };

  private readonly handleNodeLayoutChanged = (
    event: CustomEvent<NodeLayoutChangedDetail>
  ): void => {
    this.getNodeEditor()?.updateNodeLayout(event.detail.nodeId, {
      columnSpan: event.detail.columnSpan,
      breakBefore: event.detail.breakBefore,
    });
  };
  private readonly handleNodeOrderChanged = (
    event: CustomEvent<NodeOrderChangedDetail>
  ): void => {
    const { nodeId, direction } = event.detail;
    const nodeEditor = this.getNodeEditor();

    if (!nodeEditor?.moveNodeInPage(nodeId, direction)) {
      return;
    }

    const updatedNode = this.graphData.nodes.find(
      (candidate) => candidate.id === nodeId
    );
    this.updatePropertiesPanel(updatedNode ?? null);

    // The panel re-renders; move focus back to the button for the keyboard flow.
    requestAnimationFrame(() => {
      this.getPropertiesPanel()?.focusOrderControl(direction);
    });
  };

  private readonly handleNodeDataChanged = (
    event: CustomEvent<NodeDataChangedDetail>
  ): void => {
    const { nodeId, property, value } = event.detail;

    this.updateNodeProperty(nodeId, property, value);
  };

  /**
   * The guide's own details — name, description, owner.
   *
   * `updatedAt` is not set here. It is stamped on save and export, because a
   * stamp that changes on every keystroke makes every comparison between two
   * versions falsely positive.
   */
  /**
   * A filename-friendly name from the guide's name, with a fallback.
   *
   * Å, ä and ö are transliterated rather than dropped: a file called
   * "ansoka-om-bygglov" can be read, "anska-om-bygglov" cannot.
   */
  private exportFileBaseName(): string {
    const namn = resolveText(this.graphData.meta?.name, this.activeLocale, "");

    const slug = namn
      .toLocaleLowerCase("sv")
      .replace(/[åä]/g, "a")
      .replace(/ö/g, "o")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return slug.length > 0 ? slug : "flowweaver-guide";
  }

  private readonly handleGuideMetaChanged = (
    event: CustomEvent<GuideMetaChangedDetail>
  ): void => {
    const { key, value } = event.detail;
    const tomt = value === "" || value === undefined || value === null;

    const meta = { ...this.graphData.meta };

    if (tomt) {
      delete meta[key];
    } else {
      Object.assign(meta, { [key]: value });
    }

    this.graphData = { ...this.graphData, meta };
    // Canvasen äger grafen som `getData()` returnerar.
    this.getNodeEditor()?.setMeta(Object.keys(meta).length > 0 ? meta : undefined);
    this.history.record(this.graphData, "guide-updated");
    this.updateUndoRedoState();
    this.dispatchEvent(
      new CustomEvent<GraphChangedDetail>("graph-changed", {
        detail: { graph: this.getData(), reason: "guide-updated" },
        bubbles: true,
        composed: true,
      })
    );
  };

  /**
   * A guide-wide setting switched in the panel (story 116: the progress meter).
   *
   * Turning it off **removes** the key rather than writing `false`. A guide
   * that never had the meter must come back out of the editor as it went in
   * (K6b/K7); a `progress: false` nobody asked for is a change to a file the
   * editor only opened.
   */
  private readonly handleGuideSettingChanged = (
    event: CustomEvent<GuideSettingChangedDetail>
  ): void => {
    const { key, value } = event.detail;
    const settings = { ...this.graphData.settings };

    if (value) {
      settings[key] = true;
    } else {
      delete settings[key];
    }

    this.graphData = {
      ...this.graphData,
      settings: Object.keys(settings).length > 0 ? settings : undefined,
    };
    this.history.record(this.graphData, "guide-updated");
    this.updateUndoRedoState();
    this.refreshSidebarPreview();
    this.dispatchEvent(
      new CustomEvent<GraphChangedDetail>("graph-changed", {
        detail: { graph: this.getData(), reason: "guide-updated" },
        bubbles: true,
        composed: true,
      })
    );
  };

  private readonly handleGuideLocalesChanged = (
    event: CustomEvent<GuideLocalesChangedDetail>
  ): void => {
    const locales = event.detail.locales;
    this.graphData = {
      ...this.graphData,
      settings: { ...this.graphData.settings, locales },
    };
    this.history.record(this.graphData, "guide-updated");
    this.updateUndoRedoState();
    this.updateGuideLocales();
    this.dispatchEvent(
      new CustomEvent<GraphChangedDetail>("graph-changed", {
        detail: { graph: this.getData(), reason: "guide-updated" },
        bubbles: true,
        composed: true,
      })
    );
  };

  private readonly handleGuideStringChanged = (
    event: CustomEvent<GuideStringChangedDetail>
  ): void => {
    const { key, value } = event.detail;
    const strings = { ...(this.graphData.settings?.strings ?? {}) };
    strings[key] = value as (typeof strings)[string];
    this.graphData = {
      ...this.graphData,
      settings: { ...this.graphData.settings, strings },
    };
    this.history.record(this.graphData, "guide-updated");
    this.updateUndoRedoState();
    this.refreshSidebarPreview();
    this.dispatchEvent(
      new CustomEvent<GraphChangedDetail>("graph-changed", {
        detail: { graph: this.getData(), reason: "guide-updated" },
        bubbles: true,
        composed: true,
      })
    );
  };

  private readonly handleNodeTypeEditorRequest = (): void => {
    const editor = this.root.querySelector<NodeTypeEditor>("node-type-editor");
    if (!editor) {
      return;
    }
    editor.open({
      specs: this.capableLibrarySpecs(),
      onCreate: (spec) => this.addCustomNodeType(spec),
      onDelete: (type) => this.removeCustomNodeType(type),
      onUpdate: (type, changes) => this.updateCustomNodeType(type, changes),
      usageCount: (type) => this.templateUsageCount(type),
      baseLabel: (type) => this.templateBaseLabel(type),
      locale: this.editorLocale,
      baseTemplates: this.allowedBaseTemplateIds(),
    });
  };

  /**
   * The base types a node template may be created from at the current feature
   * level — gated base types (multi-choice in "basic", say) must not be
   * selectable, since the template would not show anyway.
   */
  private allowedBaseTemplateIds(): string[] {
    return getNodeTemplateBases()
      .filter(
        (base) =>
          !base.requiredCapability ||
          this.capabilitiesValue[base.requiredCapability]
      )
      .map((base) => base.id);
  }

  /**
   * Library templates the current feature level can actually use. A template
   * whose gate is not on (the text-based seed templates in "basic", say) must
   * not be listed — it would not work at that level anyway.
   */
  /**
   * The node types in a graph that this feature level does not offer.
   *
   * A host needs this the moment it lets somebody import a guide. The editor
   * already refuses gracefully — the node draws, its data is kept, and the
   * panel says the type is not part of the level — but that is one node at a
   * time, found by clicking. Nothing said it about the guide as a whole, so an
   * import silently produced a canvas with things on it the palette could not
   * make.
   *
   * Returned as type names rather than as a boolean so the host can name them.
   * *Two node types are not included: Uträkning, Serveranrop* is an answerable
   * sentence; *some are missing* is not.
   *
   * The graph is a parameter because the interesting moment is **before** it is
   * set: a host asking whether to raise the level first has not imported
   * anything yet. Omitted, it asks about the guide currently open.
   */
  unsupportedNodeTypes(graph?: GraphData): string[] {
    const nodes = (graph ?? this.graphData)?.nodes ?? [];
    const missing = new Set<string>();

    for (const node of nodes) {
      const needed = getNodeType(node.type)?.requiredCapability;

      if (needed && !this.capabilitiesValue[needed]) {
        missing.add(node.type);
      }
    }

    return [...missing];
  }

  private capableLibrarySpecs(): NodeTemplate[] {
    return getLibrary().filter((template) => {
      const cap = templateCapability(template);
      return !cap || this.capabilitiesValue[cap];
    });
  }

  /**
   * Hands one field to somebody else, without sending a whole guide.
   *
   * The guide export already carries the templates it uses, so sharing a field
   * has always been possible — by exporting everything around it. Johan put the
   * objection plainly: that is a silly detour for one good node.
   *
   * The file is delivered the same way a guide is, a Blob behind a download
   * link, because a second way to hand over a file is a second thing to explain.
   */
  private readonly handleExportNodeTemplate = (
    event: CustomEvent<{ nodeId: string }>
  ): void => {
    const node = this.graphData.nodes.find(
      (candidate) => candidate.id === event.detail.nodeId
    );
    const captured = node ? nodeToTemplate(node, this.pageFieldsOf(node.id)) : undefined;

    if (!captured) {
      this.showToast({
        message: this.text("editor.toast.cannotSaveTemplate"),
        type: "info",
      });
      return;
    }

    const blob = new Blob([templateFileJson(captured)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    // Named after the template, for the same reason a guide is named after
    // itself: four files called the same can only be told apart by opening them.
    link.download = `${captured.label.replace(/[^\p{L}\d]+/gu, "-").toLowerCase() || "mall"}.mall.json`;
    link.click();
    URL.revokeObjectURL(url);

    this.showToast({
      message: this.text("editor.toast.templateExported", { name: captured.label }),
      type: "success",
    });
  };

  private readonly handleSaveAsNodeTemplate = (
    event: CustomEvent<{ nodeId: string }>
  ): void => {
    const node = this.graphData.nodes.find(
      (candidate) => candidate.id === event.detail.nodeId
    );
    const editor = this.root.querySelector<NodeTypeEditor>("node-type-editor");
    if (!node || !editor) {
      return;
    }

    // Kom noden ur en mall som finns kvar? Uppdatera då mallens värden.
    const existingSpec = node.template
      ? getLibrary().find((spec) => spec.type === node.template)
      : undefined;

    if (existingSpec) {
      this.addCustomNodeType(
        withNodeValues(existingSpec, node, this.pageFieldsOf(node.id))
      );
      this.showToast({
        message: this.text("editor.toast.templateUpdated", {
          label: existingSpec.label,
        }),
        type: "success",
      });
      return;
    }

    const captured = nodeToTemplate(node, this.pageFieldsOf(node.id));
    if (!captured) {
      this.showToast({
        message: this.text("editor.toast.cannotSaveTemplate"),
        type: "info",
      });
      return;
    }

    /*
     * If the node came from a template that is *gone*, we recreate it under the
     * same key. Every other node with the same provenance then finds its way
     * back to its name — not just the one we happen to be on.
     *
     * The values are reconstructed from everything that came from the template,
     * not from this node alone: what the nodes have in common came from the
     * template, what sets them apart is authored per node. The base type is in
     * the node. The only thing genuinely lost is the name and the icon.
     */
    const syskon = node.template
      ? this.getData().nodes.filter(
          (candidate) => candidate.template === node.template
        )
      : [];

    const recreated = node.template
      ? {
          ...captured,
          type: node.template,
          values: templateValuesFromNodes(syskon),
        }
      : captured;

    const rawTitle = node.data.title;
    const suggestedName =
      typeof rawTitle === "string" ||
      (rawTitle !== null && typeof rawTitle === "object")
        ? resolveText(rawTitle as Parameters<typeof resolveText>[0], this.activeLocale)
        : "";

    editor.open({
      specs: this.capableLibrarySpecs(),
      onCreate: (spec) => this.addCustomNodeType(spec),
      onDelete: (type) => this.removeCustomNodeType(type),
      onUpdate: (type, changes) => this.updateCustomNodeType(type, changes),
      usageCount: (type) => this.templateUsageCount(type),
      baseLabel: (type) => this.templateBaseLabel(type),
      captured: recreated,
      ...(node.template ? { recreatedFrom: syskon.length } : {}),
      suggestedName,
      locale: this.editorLocale,
    });
  };

  /** A page's fields as they stand — what a page template is made of (story 088). */
  private pageFieldsOf(pageId: string): FlowNodeData[] {
    return this.graphData.nodes.filter((node) => node.parentPageId === pageId);
  }

  /**
   * The fields a page template brings into the page just created from it.
   * Empty for anything that is not a page template.
   */
  private templateFieldsFor(key: string, pageId: string): FlowNodeData[] {
    const template = getLibrary().find((item) => item.type === key);
    return template ? childrenFromTemplate(template, pageId) : [];
  }

  /** How many nodes in the open guide come from the template. */
  private templateUsageCount(type: string): number {
    return this.getData().nodes.filter((node) => node.template === type).length;
  }

  /** What the nodes will be called once the template is gone: the base type's name. */
  private templateBaseLabel(type: string): string {
    const template = getLibrary().find((item) => item.type === type);
    return template
      ? displayNodeTypeLabel(
          template.base,
          getNodeType(template.base)?.label,
          this.editorLocale,
        )
      : "";
  }

  /**
   * Sparar en nodmall i det globala biblioteket (delas mellan alla guider),
   * registrerar den och uppdaterar paletten. Upsert: samma nyckel uppdaterar.
   */
  addCustomNodeType(spec: NodeTemplate): void {
    saveToLibrary(spec);
    this.refreshPalette();
    this.showToast({
      message: this.text("editor.toast.templateSaved", { label: spec.label }),
      type: "success",
    });
  }

  /** Ändrar en malls namn/ikon i biblioteket. Slår igenom överallt. */
  updateCustomNodeType(
    type: string,
    changes: { label: string; icon?: string }
  ): void {
    updateInLibrary(type, changes);
    this.refreshPalette();
    this.refreshSelectedPanel();
  }

  /**
   * Removes a node template from the library.
   *
   * Nodes created from it work unchanged — they are nodes of their base type.
   * They simply carry the base type's name instead of the template's, and offer
   * "Återskapa mall" instead of "Uppdatera mall".
   */
  removeCustomNodeType(type: string): void {
    removeFromLibrary(type);
    this.refreshPalette();
    this.refreshSelectedPanel();
  }

  /**
   * Re-renders the panel for the selected node. Its heading carries the
   * template's name, and a removed name must not linger. Only after a library
   * change — `refreshPalette` runs mid-typing and must not touch the panel.
   */
  private refreshSelectedPanel(): void {
    const node =
      this.graphData.nodes.find(
        (candidate) => candidate.id === this.selectedNodeId
      ) ?? null;

    this.updatePropertiesPanel(node);
  }

  /**
   * Embeds the node templates the guide actually uses in `settings`.
   *
   * The guide *works* without them — the nodes are nodes of their base type.
   * What comes along is the **names**: without the embedding a node carries the
   * base type's name as soon as the guide is opened elsewhere, and a template
   * someone removed can no longer be recreated with its name intact.
   *
   * This happens on every `getData()`, not only on export. A guide stored in a
   * host system should carry what it needs — otherwise migration v5→v6 does not
   * know what base type an old template-typed node had either.
   */
  private bundleUsedNodmallar(graph: GraphData): GraphData {
    const used = new Set(
      graph.nodes
        .map((node) => node.template)
        .filter((type): type is string => typeof type === "string")
    );

    if (used.size === 0) {
      return graph;
    }

    const bundled = getLibrary().filter((template) => used.has(template.type));

    return bundled.length > 0
      ? { ...graph, settings: { ...graph.settings, nodeTemplates: bundled } }
      : graph;
  }

  private readonly handleQuestionOptionRemove = (
    event: CustomEvent<QuestionOptionRemoveDetail>
  ): void => {
    const node = this.graphData.nodes.find(
      (candidate) => candidate.id === event.detail.nodeId
    );

    if (!node) {
      return;
    }

    const options = QuestionOptionsService.getOptions(node);

    if (options.length <= 2) {
      return;
    }

    const updatedOptions = QuestionOptionsService.removeOption(
      options,
      event.detail.optionId
    );

    if (updatedOptions.length === options.length) {
      return;
    }

    const nodeEditor = this.getNodeEditor();

    nodeEditor?.removeConnectionsFromOutput(node.id, event.detail.optionId);

    const updatedNode = this.updateNodeProperty(
      node.id,
      "options",
      updatedOptions
    );

    this.updatePropertiesPanel(updatedNode);
  };

  private readonly handleRuleCaseRemove = (
    event: CustomEvent<RuleCaseRemoveDetail>
  ): void => {
    this.getNodeEditor()?.removeConnectionsFromOutput(
      event.detail.nodeId,
      event.detail.caseId
    );
    const updatedNode = this.updateNodeProperty(
      event.detail.nodeId,
      "cases",
      event.detail.cases
    );
    this.updatePropertiesPanel(updatedNode);
  };

  private readonly handleSelectionChanged = (
    event: CustomEvent<SelectionChangedDetail>
  ): void => {
    this.selectedNodeId = event.detail.nodeId;

    // In the routes mode a pressed node shows the paths to it; letting go of
    // the selection (empty canvas) keeps the last answer on screen.
    if (this.routesModeValue && event.detail.nodeId) {
      this.applyRoutesTo(event.detail.nodeId);
    }

    if (this.sidebarMode === "preview") {
      const preview = this.getSidebarPreview();

      if (event.detail.nodeId && preview?.graph) {
        preview.showNode(event.detail.nodeId);
      } else {
        this.refreshSidebarPreview();
      }

      this.updateConnectionHighlights();
    }

    if (!event.detail.nodeId) {
      this.updatePropertiesPanel(null);
      return;
    }

    const selectedNode = this.selectedNodeId
      ? this.graphData.nodes.find((node) => node.id === this.selectedNodeId) ??
        null
      : null;

    this.updatePropertiesPanel(selectedNode);
    this.syncOutline();
  };

  private readonly handleGraphChanged = (
    event: CustomEvent<GraphChangedDetail>
  ): void => {
    this.graphData = structuredClone(event.detail.graph);
    // Everything the canvas changes — the panel, a drag, a connection, the
    // palette — passes here, and any of them makes a run's trail a lie.
    this.staleProving();

    /*
     * Live typing in a field ("node-updated") fires per keystroke. The heavy
     * bookkeeping (a history snapshot with a JSON comparison, translation
     * status, the side preview) is deferred until you pause, so typing does not
     * stutter. The panel is not re-rendered — the field already has the right
     * value. (Autosave is already debounced separately.)
     */
    if (event.detail.reason === "node-updated") {
      this.updateStartNodeWarning();
      this.scheduleLiveEditBookkeeping();
      return;
    }

    // Other changes: run the bookkeeping immediately (and discard any pending
    // live job — this change already reflects the latest graph).
    this.cancelLiveEditBookkeeping();
    this.history.record(this.graphData, event.detail.reason);
    this.updateUndoRedoState();
    this.updateStartNodeWarning();
    this.updateTranslationProgress();
    this.refreshSidebarPreview();

    if (!this.selectedNodeId) {
      return;
    }

    const selectedNode =
      this.graphData.nodes.find((node) => node.id === this.selectedNodeId) ??
      null;

    this.updatePropertiesPanel(selectedNode);
  };

  /**
   * Defers the heavy bookkeeping after live typing until you pause. A run of
   * keystrokes is merged into a single undo step (the history's own coalescing
   * of "node-updated" does the rest).
   */
  private scheduleLiveEditBookkeeping(): void {
    if (this.liveEditTimeout !== null) {
      globalThis.clearTimeout(this.liveEditTimeout);
    }
    this.liveEditTimeout = globalThis.setTimeout(() => {
      this.liveEditTimeout = null;
      this.history.record(this.graphData, "node-updated");
      this.updateUndoRedoState();
      this.updateTranslationProgress();
      this.refreshSidebarPreview();
    }, 400);
  }

  private cancelLiveEditBookkeeping(): void {
    if (this.liveEditTimeout !== null) {
      globalThis.clearTimeout(this.liveEditTimeout);
      this.liveEditTimeout = null;
    }
  }

  /** Kör väntande live-bokföring direkt (före ångra/gör om, så historiken stämmer). */
  private flushLiveEditBookkeeping(): void {
    if (this.liveEditTimeout === null) {
      return;
    }
    globalThis.clearTimeout(this.liveEditTimeout);
    this.liveEditTimeout = null;
    this.history.record(this.graphData, "node-updated");
    this.updateUndoRedoState();
    this.updateTranslationProgress();
    this.refreshSidebarPreview();
  }

  private updateStartNodeWarning(): void {
    const warning = this.root.querySelector<HTMLElement>(
      "[data-start-node-warning]"
    );

    if (!warning) {
      return;
    }

    warning.hidden =
      this.graphData.startNodeId !== null || this.graphData.nodes.length === 0;
  }

  /**
   * The check row at the bottom of the canvas.
   *
   * Recomputed on every change and on load — the analysis costs nothing
   * measurable on a graph of thirty nodes, and the point is that an old guide
   * that has stopped working speaks up the moment it is opened.
   *
   * The count sits in an `aria-live` region but the text is written only when it
   * actually changes. Otherwise it is announced on every keystroke.
   */
  /** What the health check needs to know about this editor — for the strip and the list view alike. */
  private healthContext(): GuideHealthContext {
    const panel = this.root.querySelector<HTMLElement & { writingOptionId: string | null }>("properties-panel");

    return { locale: this.editorLocale, writingOptionId: panel?.writingOptionId ?? null };
  }

  private updateHealth(): void {
    this.syncOutline();

    const root = this.shadowRoot;
    const count = root?.querySelector<HTMLElement>("[data-health-count]");
    const body = root?.querySelector<HTMLElement>("[data-health-body]");
    const strip = root?.querySelector<HTMLElement>("[data-health]");

    if (!count || !body || !strip) {
      return;
    }

    const issues = GuideHealthService.analyze(this.getData(), this.healthContext());
    const errors = issues.filter((issue) => issue.severity === "error").length;
    const warnings = issues.length - errors;

    const del: string[] = [];

    if (errors > 0) {
      del.push(
        errors === 1
          ? this.text("editor.health.oneError")
          : this.text("editor.health.summaryErrors", { errors })
      );
    }

    if (warnings > 0) {
      del.push(
        warnings === 1
          ? this.text("editor.health.oneWarning")
          : this.text("editor.health.summaryWarnings", { warnings })
      );
    }

    const text = del.length > 0 ? del.join(" · ") : this.text("editor.health.clean");

    if (count.textContent !== text) {
      count.textContent = text;
    }

    strip.dataset.severity = errors > 0 ? "error" : warnings > 0 ? "warning" : "clean";

    // The list is re-rendered even while closed: open it and it is current.
    body.innerHTML =
      issues.length === 0
        ? `<p class="guide-editor__health-clean">${this.text("editor.health.cleanBody")}</p>`
        : `<ul class="guide-editor__health-items">${issues
            .map(
              (issue) => `
                <li>
                  <button type="button" data-health-node="${escapeHtml(issue.nodeId)}"${
                    issue.field ? ` data-health-field="${escapeHtml(issue.field)}"` : ""
                  }>
                    <span class="guide-editor__health-badge" data-severity="${issue.severity}">${
                      issue.severity === "error"
                        ? this.text("editor.health.errorLabel")
                        : this.text("editor.health.warningLabel")
                    }</span>
                    <span>${escapeHtml(issue.message)}</span>
                  </button>
                </li>
              `
            )
            .join("")}</ul>`;

    // The markings on the nodes and in the minimap come from here: the analysis
    // is done once, the canvas shows it.
    this.getNodeEditor()?.setNodeIssues(
      new Map(
        issues.map((issue) => [
          issue.nodeId,
          {
            severity: issue.severity,
            /*
             * The reason, not the word "Error".
             *
             * It used to be the severity, because the node showed it as a band
             * and a band the width of a card can only carry one word. The node
             * now carries a marking whose name is read rather than seen, and a
             * name that says "Error" tells somebody they have a problem and not
             * which one. `issue.message` is already written for a person — it is
             * what the check row says.
             */
            label: issue.message,
          },
        ])
      )
    );

    body.querySelectorAll<HTMLButtonElement>("[data-health-node]").forEach((button) => {
      button.addEventListener("click", () => {
        const nodeId = button.dataset.healthNode;

        if (!nodeId) {
          return;
        }

        // The field when the check named one — then the cursor lands in it,
        // and Avancerat unfolds if that is where it sits.
        this.revealNode(nodeId, button.dataset.healthField);
      });
    });
  }

  /**
   * The messages contain the editor's own titles and variable names, and are
   * written with `innerHTML`. Without this, a node called `<img onerror=…>` is a
   * way in. See `docs/RUNTIME-SECURITY.md`.
   */

  private connectHealthStrip(): void {
    const toggle = this.shadowRoot?.querySelector<HTMLButtonElement>(
      "[data-health-toggle]"
    );
    const list = this.shadowRoot?.querySelector<HTMLElement>("[data-health-list]");

    if (!toggle || !list) {
      return;
    }

    const setOpen = (open: boolean): void => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.title = this.text(open ? "editor.health.close" : "editor.health.open");
      list.hidden = !open;
    };

    toggle.addEventListener("click", () => {
      setOpen(Boolean(list.hidden));
    });

    /*
     * The list is a popover and closes like one (assessment 3/9): Escape from
     * inside hands focus back to the button, and a press anywhere outside the
     * strip closes it. Before, only the button closed it, and it lay open over
     * the canvas until you found your way back.
     */
    list.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !list.hidden) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        toggle.focus();
      }
    });
    this.root.addEventListener("pointerdown", (event) => {
      if (!list.hidden && !event.composedPath().includes(toggle.parentElement!)) {
        setOpen(false);
      }
    });

    toggle.title = this.text("editor.health.open");
  }

  private updateUndoRedoState(): void {
    this.getToolbar()?.setUndoRedo(
      this.history.canUndo(),
      this.history.canRedo()
    );

    // The check row is recomputed here. The method is called from every place
    // that changes the graph, so it is the one hook guaranteed not to be missed
    // — the name does not say so, but the alternative is ten more call sites to
    // forget.
    this.updateHealth();
  }

  private setSidebarMode(mode: "properties" | "preview"): void {
    this.sidebarMode = mode;
    this.updateSidebar();

    if (mode === "preview") {
      this.refreshSidebarPreview();
    } else {
      this.getNodeEditor()?.clearConnectionHighlights();
    }
  }

  private updateSidebar(): void {
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-sidebar-mode]")
      .forEach((button) => {
        const selected = button.dataset.sidebarMode === this.sidebarMode;
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
      });

    this.root
      .querySelectorAll<HTMLElement>("[data-sidebar-panel]")
      .forEach((panel) => {
        panel.hidden = panel.dataset.sidebarPanel !== this.sidebarMode;
      });
  }

  private refreshSidebarPreview(): void {
    if (this.sidebarMode !== "preview") {
      return;
    }

    const preview = this.getSidebarPreview();
    const openButton = this.root.querySelector<HTMLButtonElement>(
      '[data-action="preview-open-dialog"]'
    );

    if (openButton) {
      openButton.hidden = this.selectedNodeId === null;
    }

    if (!preview) {
      return;
    }

    /*
     * Never under a live run. `graph =` gives the panel a NEW engine, and the
     * canvas node's mirror keeps the old one — from there the two halves of
     * the run drift apart. Measured 2/9 (Johans surfplatta, Medborgarskap):
     * Egenskaper och tillbaka, sedan Nästa på nodkortet — kortet visade
     * resultatet, panelen frågan, raden steg 1. The panel is a mirror of the
     * run until the run ends or goes stale; a redraw is all it may get.
     */
    if (this.provingRun && !this.provingRun.stale) {
      preview.refresh();
      return;
    }

    if (!this.selectedNodeId) {
      preview.clear(this.text("editor.shell.previewSelectNode"));
      this.getNodeEditor()?.clearConnectionHighlights();
      return;
    }

    preview.activeLocale = this.activeLocale;
    preview.graph = this.getData();
    preview.showNode(this.selectedNodeId);
    this.updateConnectionHighlights();
  }

  private updateConnectionHighlights(): void {
    if (this.routesModeValue) return;

    const nodeEditor = this.getNodeEditor();
    const selectedNode = this.graphData.nodes.find(
      (node) => node.id === this.selectedNodeId
    );

    if (
      !this.capabilitiesValue.routeAnalysis ||
      this.sidebarMode !== "preview" ||
      selectedNode?.type !== "result"
    ) {
      nodeEditor?.clearConnectionHighlights();
      return;
    }

    const analysis = findGuidePathsToResult(this.graphData, selectedNode.id);
    const connectionIds = Array.from(
      new Set(
        analysis.paths.flatMap((path) =>
          path.map((step) => step.connectionId)
        )
      )
    );

    nodeEditor?.highlightConnections(connectionIds);
  }

  private updatePropertiesPanel(node: FlowNodeData | null): void {
    const propertiesPanel = this.getPropertiesPanel();

    if (!propertiesPanel) {
      return;
    }

    propertiesPanel.capabilities = this.capabilitiesValue;
    propertiesPanel.modeNotice = this.modeNoticeValue;
    // Before the options, which redraw: a chip offers only what is set by here.
    propertiesPanel.answersSetHere = node
      ? GuideHealthService.variablesSetBefore(this.graphData, node)
      : null;
    // In the guide's source language: the chips and menus name a variable by
    // its label, and an English guide's "Income" read "Inkomst" (film 30/9).
    propertiesPanel.variableOptions = QuestionVariableService.getOptions(
      this.graphData,
      getSourceLocale(this.graphData),
    );
    // Story 134: the words a conditional option's badge is written in — the
    // question behind the variable, and the label of the answer it names.
    propertiesPanel.guideNodes = this.graphData.nodes;
    // Nodes a note can point at (not other notes, and not itself).
    propertiesPanel.nodeOptions = this.graphData.nodes
      .filter((candidate) => candidate.type !== "annotation" && candidate.id !== node?.id)
      .map((candidate) => ({
        id: candidate.id,
        label:
          resolveText(
            candidate.data.title as Parameters<typeof resolveText>[0],
            this.activeLocale
          ) || candidate.id,
      }));
    propertiesPanel.pagePosition = this.getPagePosition(node);
    propertiesPanel.pageWarnings = this.getPageWarnings(node);
    propertiesPanel.sourceLocale = getSourceLocale(this.graphData);
    // The panel should be able to say what removing a language costs without
    // knowing the graph. The counting belongs here, where the graph is.
    const languages = getGuideLocales(
      this.graphData.settings?.locales,
      getSourceLocale(this.graphData)
    );
    const framsteg = languages.map((locale) => [
      locale.code,
      TranslationProgressService.getProgress(this.graphData, locale.code),
    ] as const);
    // The panel's counts drive the source-language change, which asks whether
    // any *authored* text is about to become untranslated. The viewer's texts
    // are not that: an empty guide has nothing to lose, and whoever authors in
    // Finnish must be able to pick Finnish without detours. Story 017 counts
    // them for the translator; this check stays on content. See story 008.
    propertiesPanel.localeUsage = {
      total: framsteg[0]?.[1].contentTotal ?? 0,
      translated: Object.fromEntries(
        framsteg.map(([code, progress]) => [code, progress.contentTranslated])
      ),
    };
    propertiesPanel.activeLocale = this.activeLocale;
    propertiesPanel.guideMeta = this.graphData.meta ?? {};
    propertiesPanel.guideStrings = this.graphData.settings?.strings ?? {};
    propertiesPanel.guideLocales = this.graphData.settings?.locales ?? ["sv", "en"];
    propertiesPanel.guideProgress = this.graphData.settings?.progress === true;
    propertiesPanel.nodeData = node;
  }

  /** Warnings for a Page node, shown in the properties panel. */
  private getPageWarnings(node: FlowNodeData | null): string[] {
    if (node?.type !== "page") {
      return [];
    }

    /*
     * Two fields on the page saving under one name used to be said here too.
     * The health check `variable-name-clash` says it now and leads to the
     * field; measured 24/9, both spoke on a reachable page, and Johan took
     * the passive one away.
     */
    return PageFieldsService.getFields(this.graphData, node).length === 0
      ? [this.text("editor.pageWarnings.noFields")]
      : [];
  }

  private getPagePosition(
    node: FlowNodeData | null
  ): { index: number; count: number } | null {
    if (!node?.parentPageId) {
      return null;
    }

    const siblings = this.graphData.nodes
      .filter((candidate) => candidate.parentPageId === node.parentPageId)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

    return {
      index: siblings.findIndex((candidate) => candidate.id === node.id),
      count: siblings.length,
    };
  }

  private updateNodeProperty(
    nodeId: string,
    property: string,
    value: unknown
  ): FlowNodeData | null {
    const updatedGraph = updateGraphNodeData(
      this.graphData,
      nodeId,
      property,
      value
    );

    if (updatedGraph === this.graphData) {
      return null;
    }

    this.graphData = updatedGraph;
    this.getNodeEditor()?.updateNodeData(nodeId, property, value);

    return this.graphData.nodes.find((node) => node.id === nodeId) ?? null;
  }

  private updateNodeEditor(): void {
    const nodeEditor = this.getNodeEditor();

    if (!nodeEditor) {
      return;
    }

    nodeEditor.activeLocale = this.activeLocale;
    nodeEditor.graph = this.graphData;
    this.updateGuideLocales();
    this.updateTranslationProgress();
  }

  /** Fyller språkväljaren med guidens erbjudna språk. */
  private updateGuideLocales(): void {
    const toolbar = this.getToolbar();
    if (toolbar) {
      this.syncToolbarLocales();
    }
    // If the active language is no longer offered, fall back to the source. The
    // source is the guide's own — in a Finnish guide, Finnish is the original,
    // not Swedish.
    const source = getSourceLocale(this.graphData);
    const offered = getGuideLocales(this.graphData.settings?.locales, source);
    if (!offered.some((locale) => locale.code === this.activeLocale)) {
      this.activeLocale = source;
    }
  }

  /** Uppdaterar täckningsräknaren och markerar otöversatta noder. */
  /**
   * Goes to the next thing lacking text in the chosen language.
   *
   * It cycles: after the last it starts over. A translator works through them in
   * turn and should not have to keep track of where they began.
   *
   * The list is fetched fresh on every jump — translate something and it leaves
   * the list, and the next jump must account for that.
   *
   * Since story 017 the list holds two kinds of stop. The nodes come first and
   * the viewer's own texts after, because the questions are what the guide is
   * about and the buttons are what carries a resident between them. Both are
   * content; only one of them has a place on the canvas.
   */
  private readonly handleNextUntranslated = (): void => {
    if (this.activeLocale === getSourceLocale(this.graphData)) {
      return;
    }

    const progress = TranslationProgressService.getProgress(
      this.graphData,
      this.activeLocale
    );
    const stops: TranslationStop[] = [
      ...progress.untranslatedNodeIds.map(
        (id): TranslationStop => ({ kind: "node", id })
      ),
      ...progress.untranslatedViewerKeys.map(
        (key): TranslationStop => ({ kind: "viewer-text", key })
      ),
    ];

    if (stops.length === 0) {
      this.showToast({
        message: this.text("editor.toolbar.allTranslated"),
        type: "success",
      });
      return;
    }

    // The next one after where we are. A selected node places us among the
    // nodes; an open guide-settings panel places us among the viewer's texts.
    const current = this.selectedNodeId
      ? stops.findIndex(
          (stop) => stop.kind === "node" && stop.id === this.selectedNodeId
        )
      : stops.findIndex(
          (stop) =>
            stop.kind === "viewer-text" && stop.key === this.lastViewerTextStop
        );
    const next = stops[(current + 1) % stops.length];

    if (next.kind === "node") {
      this.lastViewerTextStop = null;
      const nodeEditor = this.getNodeEditor();
      nodeEditor?.selectNodeById(next.id);
      nodeEditor?.centerNodeById(next.id);
      return;
    }

    this.goToViewerText(next.key);
  };

  /**
   * Opens the guide's own texts and puts the cursor in one of them.
   *
   * A viewer text has no place on the canvas, so "going there" means clearing
   * the selection — which is what makes the panel show the guide's settings —
   * and then focusing the field. Deselecting re-renders the panel, so the field
   * is looked up after that, not before. The texts sit folded under their
   * heading, and a field in a closed details cannot take focus — so unfold.
   */
  private goToViewerText(key: string): void {
    this.lastViewerTextStop = key;
    this.getNodeEditor()?.selectNodeById(null);

    const panel = this.root.querySelector<PropertiesPanel>("properties-panel");
    const field = panel?.shadowRoot?.querySelector<HTMLInputElement>(
      `[data-guide-string="${CSS.escape(key)}"]`
    );
    const fold = field?.closest("details");
    if (fold) fold.open = true;
    field?.focus();
    field?.scrollIntoView({ block: "center" });
  }

  private updateTranslationProgress(): void {
    const inTranslation =
      this.activeLocale !== getSourceLocale(this.graphData);
    const progress = inTranslation
      ? TranslationProgressService.getProgress(this.graphData, this.activeLocale)
      : null;

    this.setTranslationProgress(
      progress
        ? {
            translated: progress.translated,
            total: progress.total,
            // What the button jumps between, which since story 017 is both
            // kinds of stop. Counting only the nodes would offer a button that
            // says nothing remains while the buttons are still Swedish.
            untranslatedStops:
              progress.untranslatedNodeIds.length +
              progress.untranslatedViewerKeys.length,
          }
        : null
    );
    const nodeEditor = this.getNodeEditor();
    if (nodeEditor) {
      nodeEditor.untranslatedNodeIds = progress?.untranslatedNodeIds ?? [];
    }
  }

  private getNodeEditor(): NodeEditor | null {
    return this.root.querySelector<NodeEditor>("node-editor");
  }

  /** Säger panelen varför den är låst? Se `mode-notice`. */
  private applyModeNotice(): void {
    const panel = this.getPropertiesPanel();

    if (panel) {
      panel.modeNotice = this.modeNoticeValue;
    }
  }

  private getPropertiesPanel(): PropertiesPanel | null {
    return this.root.querySelector<PropertiesPanel>("properties-panel");
  }

  private getToolbar(): EditorToolbar | null {
    return this.root.querySelector<EditorToolbar>("editor-toolbar");
  }

  private getConfirmationDialog(): ConfirmationDialog | null {
    return this.root.querySelector<ConfirmationDialog>("confirmation-dialog");
  }

  private getPreviewDialog(): GuidePreviewDialog | null {
    return this.root.querySelector<GuidePreviewDialog>("guide-preview-dialog");
  }

  private getSidebarPreview(): GuidePreview | null {
    return this.root.querySelector<GuidePreview>(
      ".guide-editor__preview-panel guide-preview"
    );
  }

  /**
   * The e-mail output dialog is the pro version's element; the open editor
   * renders the tag as a slot and never imports the component. An unknown
   * element has no `open`, so it is null here and the output goes nowhere.
   */
  private getEmailOutputDialog(): EmailOutputDialogLike | null {
    const dialog = this.root.querySelector<HTMLElement & Partial<EmailOutputDialogLike>>("email-output-dialog");
    return dialog && typeof dialog.open === "function" ? (dialog as EmailOutputDialogLike) : null;
  }

  private getToast(): EditorToast | null {
    return this.root.querySelector<EditorToast>("editor-toast");
  }
}

if (!customElements.get("guide-editor")) {
  customElements.define("guide-editor", GuideEditor);
}

declare global {
  interface HTMLElementTagNameMap {
    "guide-editor": GuideEditor;
  }
}

import { escapeHtml } from "../../../viewer/core/escape-html";
import "../../../viewer/components/chip-picker/chip-picker";
import { startReorder } from "../../controllers/reorder-gesture";
import styles from "./properties-panel.scss?inline";

import { readIdList } from "../../../viewer/core/id-list";

import { getNodeType } from "../../../viewer/node-types/node-type-registry";
import { editableProperties } from "../../node-types/node-properties";
import { PageFieldsService } from "../../../viewer/services/page-fields-service";
import { joinLinkTarget } from "../../../viewer/services/link-references";
import { PageFieldValidationService } from "../../../viewer/services/page-field-validation-service";
import {
  templateLabel,
  templatesForBase,
  displayNodeTypeLabel,
} from "../../services/template-library";
import { canEditGuide } from "../../../viewer/types/node-types";
import type { EditorMode, FormattingFeature } from "../../../viewer/types/node-types";
import {
  localeLabel,
  localeTitle,
  isSourceLocale,
  textDirection,
  DEFAULT_SOURCE_LOCALE,
  DEFAULT_UI_LOCALE,
  isLocalizedTextMap,
  resolveText,
  withLocale,
  type LocalizedText,
} from "../../../viewer/core/localized-text";
import { customizableUiStrings, interpolate, t, tOr } from "../../localization/editor-ui-strings";
import { getLinkPicker } from "../../core/link-picker-registry";
import { RichTextField } from "../rich-text-field/rich-text-field";
import "../field-picker/field-picker";
import type { FieldPicker } from "../field-picker/field-picker";
import { acceptPickResult, getMapProvider } from "../../../viewer/core/map-provider-registry";
import { declaredLocales, localesWithoutStrings } from "../../../viewer/localization/registry";

import { QuestionOptionsService } from "../../../viewer/services/question-options-service";
import { RuleCasesService } from "../../../viewer/services/rule-cases-service";
import { CalculationService } from "../../../viewer/services/calculation-service";
import { ServiceCallService } from "../../../viewer/services/service-call-service";
import { RowColumnsService, type RowColumn } from "../../../viewer/services/row-columns";
import { RatingScaleService } from "../../../viewer/services/rating-scale-service";
import {
  ARROW_DIRECTIONS,
  AnnotationCommentsService,
} from "../../../viewer/services/annotation-comments-service";
import {
  QuestionVariableService,
} from "../../../viewer/services/question-variable-service";
import type { QuestionVariableOption } from "../../../viewer/services/question-variable-service";
import { getEditorCapabilities } from "../../config/editor-capabilities";
import type { EditorCapabilities } from "../../config/editor-capabilities";
import { moduleForRequiredCapability } from "../../config/editor-modules";


import type { ConditionalVisibility, FlowNodeData, GuideMeta, QuestionOption, RuleCondition, VariableType } from "../../../viewer/types/graph";
import { isListOperator } from "../../../viewer/core/rule-evaluator";
import { ADD_ICON, TRASH_ICON } from "../../../viewer/styles/action-icons";
import type {
  NodeDataChangedDetail,
  NodeLayoutChangedDetail,
  NodeOrderChangedDetail,
  NodeTemplateChangedDetail,
  NodeVisibilityChangedDetail,
  QuestionOptionRemoveDetail,
  QuestionOptionMoveDetail,
  QuestionOptionReorderDetail,
  RuleCaseRemoveDetail,
  GuideStringChangedDetail,
  GuideLocalesChangedDetail,
  GuideMetaChangedDetail,
  GuideSettingChangedDetail,
} from "../../types/events";
import type { NodePropertyDefinition } from "../../../viewer/types/node-types";

/**
 * Is a gated field drawn for this node's data?
 *
 * `equals` is the plain case — a repeating page's five settings hang on one
 * checkbox. `holds` is for a gate no single value can express: *Vad fältet
 * är* (story 110) is hidden for every format that already carries a word of
 * its own, and only the format registry knows which those are.
 */
function gateOpen(
  property: NodePropertyDefinition,
  node: FlowNodeData,
  nodes: readonly FlowNodeData[],
): boolean {
  /*
   * Story 138: a setting about repetitions is drawn only for a node on a page
   * that repeats. Read off the page itself (`repeats`), not off whether the
   * page is fully configured — a page switched on and still missing its word
   * is a repeating page to the editor, and the health check says what lacks.
   */
  if (property.repeatingPageOnly) {
    const page = nodes.find((candidate) => candidate.id === node.parentPageId);
    if (page?.type !== "page" || page.data.repeats !== true) return false;
  }

  const data = node.data;
  const gate = property.showWhen;

  if (!gate) return true;

  const value = data[gate.property];

  return gate.holds ? gate.holds(value) : value === gate.equals;
}

/**
 * Fits a textarea's height to its text, so it grows and shrinks with it and
 * never scrolls inside. The stylesheet's `field-sizing: content` (Fia 29/9)
 * does this where it exists; the editor's floor (K18: Firefox 121, Safari
 * 16.4) has no `field-sizing`, and there this is what does it. Measured with
 * the script removed: only Firefox failed — hence the tests switch
 * `field-sizing` off (`asOnTheFloor`).
 */
function fitToText(field: HTMLTextAreaElement): void {
  field.style.height = "auto";
  field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
}

/** The nearest ancestor that scrolls, across shadow roots. */
function scrollerOf(element: Element): HTMLElement | null {
  for (let node = element.parentElement ?? ((element.getRootNode() as ShadowRoot).host ?? null); node; node = node.parentElement ?? ((node.getRootNode() as ShadowRoot).host ?? null)) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node as HTMLElement;
  }
  return null;
}

/**
 * An answer option's label is one line (see `bindOptionLabels`): a pasted
 * break, with the blanks around it, becomes one space — in the field, so the
 * field and the model never disagree, with the cursor where it was.
 */
function keepOneLine(field: HTMLInputElement | HTMLTextAreaElement): void {
  if (!/[\r\n]/.test(field.value)) return;

  const flat = (text: string): string => text.replace(/[ \t]*[\r\n]+[ \t]*/g, " ");
  const caret = flat(field.value.slice(0, field.selectionStart ?? field.value.length)).length;

  field.value = flat(field.value);
  field.setSelectionRange(caret, caret);
}

/**
 * The lists drawn as cards (see `renderCard`). The name is the hooks' prefix:
 * `data-rule-case-id`, `toggle-rule-case`, `data-rule-case-body`.
 */
type CardKind = "option" | "rule-case" | "assignment";

/** `rule-case` → `ruleCaseId`: the card's id as `dataset` spells it. */
function cardIdKey(kind: CardKind): string {
  return `${kind.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())}Id`;
}

/**
 * The three places a condition is written (uppdrag 29/9 Del B): a rule's
 * conditions, a field's "visas om" and an answer option's "visas om". One
 * renderer draws all three (`renderConditions`); this table is everything
 * that differs — the attributes the handlers read, which were already
 * different before the renderers were one, so saved hooks and tests keep
 * their names.
 */
type ConditionScope = "rule" | "visibility" | "option-visibility";

const CONDITION_SCOPES: Record<ConditionScope, {
  /** Prefix of each control's `…-property` attribute. */
  attr: string;
  /** The group's attribute, carrying the condition id. */
  group: string;
  /** Prefix of the value picker's `…-group` / `…-picker` attributes. */
  value: string;
  /** The combine selector's attribute. */
  match: string;
  /** The remove button's action. */
  remove: string;
}> = {
  rule: {
    attr: "data-rule-condition",
    group: "data-rule-condition-id",
    value: "data-rule-value",
    match: 'data-rule-case-property="match"',
    remove: "remove-rule-condition",
  },
  visibility: {
    attr: "data-visibility",
    group: "data-visibility-condition-id",
    value: "data-visibility-value",
    match: 'data-visibility-property="match"',
    remove: "remove-visibility-condition",
  },
  "option-visibility": {
    attr: "data-option-visibility",
    group: "data-option-visibility-condition-id",
    value: "data-option-visibility-value",
    match: 'data-option-visibility-property="match"',
    remove: "remove-option-visibility-condition",
  },
};

/**
 * A node's ungrouped fields, cut where their `group` changes (Astra 1/10
 * 2026, bilaga 12). Runs, not buckets: the declaration order is the panel's
 * order, and a name that came back later would be a second group of its own
 * rather than a field moved up past the ones between.
 */
const runs = (
  properties: NodePropertyDefinition[],
): Array<{ name: string; properties: NodePropertyDefinition[] }> => {
  const out: Array<{ name: string; properties: NodePropertyDefinition[] }> = [];

  for (const property of properties) {
    const name = property.group ?? "content";
    const last = out.at(-1);

    if (last?.name === name) last.properties.push(property);
    else out.push({ name, properties: [property] });
  }
  return out;
};

/**
 * A visibility after one of its controls changed — the field's and an
 * option's alike.
 *
 * `enabled` switches it on with one empty condition (or keeps the first) and
 * off with nothing left. `match` is the combine selector. Anything else edits
 * the condition the control sits in, by id; the other conditions — and
 * `match` — pass through. Writing the list back as one lost the second
 * condition of an imported or hand-written guide at the first edit (29/9).
 */
function nextVisibility(
  visibility: ConditionalVisibility | undefined,
  property: string | undefined,
  field: HTMLInputElement | HTMLSelectElement,
  conditionId: string | undefined,
): ConditionalVisibility | undefined {
  if (property === "enabled") {
    const first = visibility?.conditions[0] ?? {
      id: crypto.randomUUID(),
      variableName: "",
      operator: "equals" as const,
      value: "",
    };

    return (field as HTMLInputElement).checked ? { match: "all", conditions: [first] } : undefined;
  }
  if (!visibility || !property) return visibility;
  if (property === "match") return { ...visibility, match: field.value === "any" ? "any" : "all" };

  const index = Math.max(0, visibility.conditions.findIndex((one) => one.id === conditionId));

  return {
    ...visibility,
    conditions: visibility.conditions.map((one, at) => (at === index ? { ...one, [property]: field.value } : one)),
  };
}

export class PropertiesPanel extends HTMLElement {
  private readonly root: ShadowRoot;
  /**
   * Vad som senast hände i en mottagarlista, per fält.
   *
   * Texten läses upp av `aria-live`-raden efter omritningen. Den bor på
   * komponenten och inte i noden: det är en upplysning om en handling, inte
   * data om guiden.
   */

  private nodeDataValue: FlowNodeData | null = null;
  private canManageTemplatesValue = false;
  private variableOptionsValue: QuestionVariableOption[] = [];
  private answersSetHereValue: ReadonlySet<string> | null = null;
  /** Guidens noder — bara för villkorsskylten, se `guideNodes`. */
  private guideNodesValue: readonly FlowNodeData[] = [];
  /** Var markören stod när variabellistan öppnades, per fält. */
  private readonly selectionByProperty = new Map<string, [number, number]>();

  /** Rotlyssnaren som stänger variabelmenyer vid tryck utanför — binds en gång. */
  private variableMenuDismissBound = false;
  private pagePositionValue: { index: number; count: number } | null = null;
  private pageWarningsValue: string[] = [];
  private capabilitiesValue = getEditorCapabilities("advanced");
  private activeLocaleValue: string = DEFAULT_SOURCE_LOCALE;
  /** Guidens källspråk. Sätts av <guide-editor> ur grafen. */
  private sourceLocaleValue: string = DEFAULT_SOURCE_LOCALE;
  private localeUsageValue: Record<string, number> = {};
  /** How many fields are translatable in total. Set with localeUsage. */
  private guideStringsValue: Record<string, unknown> = {};
  private guideLocalesValue: string[] = [];
  private guideMetaValue: GuideMeta = {};
  private optionIdToFocus: string | null = null;
  /*
   * Which cards are unfolded — answer options (uppdrag 28/9 svarsalternativen,
   * etapp 2), rules and calculation rows (29/9 Del A). Interface state: kept here per
   * id, never in the model, so unfolding is no change to the guide. By id and
   * not by place, so it goes with an option wherever it is moved. Emptied
   * when another node is shown.
   */
  private readonly openCardIds = new Set<string>();
  private openCardsNodeId: string | null = null;
  /** The control to give focus back to once a moved card is drawn again. */
  private cardFocusAfterMove: { kind: CardKind; id: string; action: string } | null = null;
  private uiLocale: string = DEFAULT_UI_LOCALE;

  /**
   * May the user manage node templates? Without permission the node's
   * provenance is shown but cannot be changed.
   */
  set canManageTemplates(value: boolean) {
    if (this.canManageTemplatesValue === value) {
      return;
    }

    this.canManageTemplatesValue = value;
    this.render();
  }

  /** Localised chrome text in the editor's UI language. */
  private text(key: string, params?: Record<string, string | number>): string {
    const resolved = t(key, this.uiLocale);
    return params ? interpolate(resolved, params) : resolved;
  }

  /** The editor's UI language (chrome). Driven from above; re-renders on change. */
  set editorLocale(value: string) {
    if (value === this.uiLocale) return;
    this.uiLocale = value;
    this.render();
  }

  /**
   * The answer option being written: the one whose text field has the
   * cursor. The health check leaves its empty label alone (Johan 28/9).
   *
   * Measured 28/9: *Lägg till* is a "node-updated", so the check runs ~400 ms
   * later — with the cursor already in the new, empty field. The debounce
   * alone would still warn, and the focus is all that is needed: a branch for
   * the option *about to* get the cursor survived its mutation and went.
   */
  get writingOptionId(): string | null {
    const focused = this.root.activeElement as HTMLElement | null;

    if (focused?.dataset.optionProperty !== "label") return null;
    return focused.closest<HTMLElement>("[data-option-id]")?.dataset.optionId ?? null;
  }

  constructor() {
    super();

    this.root = this.attachShadow({
      mode: "open",
    });
  }

  connectedCallback(): void {
    this.render();
  }

  /** Positionen i sidan för Page-barn. Sätts före nodeData; nodeData ritar om. */
  set pagePosition(value: { index: number; count: number } | null) {
    this.pagePositionValue = value ? { ...value } : null;
  }

  /** Varningar för en Page-nod. Sätts före nodeData; nodeData ritar om. */
  set pageWarnings(value: string[]) {
    this.pageWarningsValue = [...value];
  }

  /** Redigeringsspråk. Sätts före nodeData; nodeData ritar om. */
  /**
   * How many fields are translated per language.
   *
   * Counted by <guide-editor>, which has the graph. The panel edits a node or
   * the guide's settings and should not need to know the whole graph to say
   * what removing a language costs.
   */
  set localeUsage(value: { total: number; translated: Record<string, number> }) {
    // `total` is no longer read: it existed to say what removing a language
    // would cost, and nothing is removed any more. The shape stays so the
    // caller does not have to change.
    this.localeUsageValue = { ...value.translated };
    this.render();
  }

  /** The guide's source language. Decides what counts as translating. */
  set sourceLocale(value: string) {
    if (this.sourceLocaleValue === value) {
      return;
    }

    this.sourceLocaleValue = value;
    this.render();
  }

  set activeLocale(value: string) {
    this.activeLocaleValue = value;

    // The locking depends on the language: in `translator` the source text is
    // locked, and only once another language is chosen can anything be changed.
    // The setter deliberately does not re-render, so the locking is recomputed
    // separately.
    if (this.root.childElementCount > 0) {
      this.applyEditorMode();
    }
  }

  /**
   * Whether the viewer's texts are unfolded. They are 127 fields on an empty
   * guide — folded, a new editor sees the guide's own settings first (3/9).
   * Remembered here so a re-render keeps what a person opened.
   */
  private uiTextsOpen = false;

  /**
   * Whether *Avancerat* is unfolded. Remembered here and nowhere else: it is
   * how this editor is standing right now, not something about the guide, so
   * it survives a re-render and a change of node and dies with the page
   * (uppdrag 23/9 2026, punkt 4 — "inte i lagring").
   */
  private advancedOpen = false;

  private guideProgressValue = false;

  /** Guidens överstyrda visartexter. Sätts före nodeData; nodeData ritar om. */
  set guideStrings(value: Record<string, unknown>) {
    this.guideStringsValue = { ...value };
  }

  /** The guide's offered languages (codes). Set before nodeData; nodeData re-renders. */
  set guideLocales(value: string[]) {
    this.guideLocalesValue = [...value];
  }

  /** Guidens egna uppgifter. Sätts före nodeData; nodeData ritar om. */
  set guideMeta(value: GuideMeta) {
    this.guideMetaValue = { ...value };
  }

  /** Om kortets huvud visar mätaren i stället för stegmärkningen. Sätts före nodeData. */
  set guideProgress(value: boolean) {
    this.guideProgressValue = value;
  }

  /**
   * What the panel lets a user change.
   *
   * The locking is done in one pass after rendering rather than as a condition
   * at each of the eleven field sites. One condition per site is eleven chances
   * to forget one.
   */
  set editorMode(value: EditorMode) {
    if (this.editorModeValue === value) {
      return;
    }

    this.editorModeValue = value;
    this.render();
  }

  get editorMode(): EditorMode {
    return this.editorModeValue;
  }

  private editorModeValue: EditorMode = "readonly";
  /** Se `modeNotice`. På tills en värd säger att den säger det själv. */
  private modeNoticeValue = true;

  /**
   * Locks what the mode does not allow.
   *
   * `readonly` locks everything. `translator` locks everything but translatable
   * fields — and only when a language other than the source is chosen, because
   * the source text must not be editable. Change the source and the guide's
   * content changes for everyone.
   */
  private applyEditorMode(): void {
    // Release first: otherwise a lock from an earlier pass remains once the
    // mode or the language has changed so the field is now editable.
    this.releaseEditorModeLocks();

    if (canEditGuide(this.editorModeValue)) {
      return;
    }

    const definition = this.nodeDataValue
      ? getNodeType(this.nodeDataValue.type)
      : undefined;

    const translatable = new Set(
      editableProperties(definition)
        .filter((property) => property.localized)
        .map((property) => property.id)
    );

    const mayChange = (element: HTMLElement): boolean => {
      if (this.editorModeValue !== "translator") {
        return false;
      }

      // The source text is locked. Without a chosen language there is nothing to translate.
      if (!this.isTranslationMode()) {
        return false;
      }

      const property = element.getAttribute("data-property");

      return property !== null && translatable.has(property);
    };

    this.root
      .querySelectorAll<HTMLElement>("input, textarea, select, button, rich-text-field")
      .forEach((element) => {
        if (mayChange(element)) {
          return;
        }

        element.setAttribute("disabled", "");
        element.setAttribute("aria-disabled", "true");
        // Marked so the lock can be released again. Other fields are disabled
        // for reasons of their own — the source language's radio, move buttons
        // at list ends — and we must not accidentally open those.
        element.setAttribute("data-mode-locked", "");
      });
  }

  /** Släpper de lås `applyEditorMode` satt, och bara dem. */
  private releaseEditorModeLocks(): void {
    this.root
      .querySelectorAll<HTMLElement>("[data-mode-locked]")
      .forEach((element) => {
        element.removeAttribute("disabled");
        element.removeAttribute("aria-disabled");
        element.removeAttribute("data-mode-locked");
      });
  }

  /**
   * The message about why the panel is locked.
   *
   * Without it, disabled fields look broken rather than deliberate: you click,
   * nothing happens, and nothing says why.
   */
  private renderModeNotice(): string {
    // Both `edit` and `administrator` build. Without canEditGuide here the
    // administrator fell through and got the translator's message — caught in a
    // screenshot, not by a test.
    if (canEditGuide(this.editorModeValue)) {
      return "";
    }

    /*
     * Och inte heller när värden redan sagt det (berättelse 129).
     *
     * `<guide-editor mode-notice="off">` sätts av en sida som har en egen rad
     * ovanför canvasen — *Låst av Anna Andersson sedan 08:15*, eller *Du tittar
     * på version 3*. Då stod samma sak på fyra ytor samtidigt, och en bärare
     * per yta är regeln: raden säger vem och när, canvasens märke säger
     * *läsläge*, och den här rutan går.
     *
     * På som förval: en editor utan en sådan rad har bara den här rutan att
     * förklara låsta fält med.
     */
    if (!this.modeNoticeValue) {
      return "";
    }

    const readonly = this.editorModeValue === "readonly";
    const kropp = readonly
      ? this.text("editor.mode.readonly.body")
      : this.isTranslationMode()
        ? this.text("editor.mode.translator.body")
        : this.text("editor.mode.translator.pickLocale");

    return `
      <p class="properties-panel__mode-notice" data-mode-notice="${this.editorModeValue}">
        <strong>${escapeHtml(
          this.text(
            readonly ? "editor.mode.readonly.title" : "editor.mode.translator.title"
          )
        )}</strong>
        ${escapeHtml(kropp)}
      </p>
    `;
  }

  /**
   * Säger panelen varför den är låst? Se `renderModeNotice`.
   *
   * En egenskap och inget attribut på panelen: den sätts av `<guide-editor>`,
   * som är den enda som monterar den, och ett attribut till hade varit en andra
   * väg in till samma svar.
   */
  set modeNotice(value: boolean) {
    if (this.modeNoticeValue === value) {
      return;
    }

    this.modeNoticeValue = value;
    this.render();
  }

  private isTranslationMode(): boolean {
    return this.activeLocaleValue !== this.sourceLocaleValue;
  }

  set nodeData(value: FlowNodeData | null) {
    this.nodeDataValue = value ? structuredClone(value) : null;

    if ((value?.id ?? null) !== this.openCardsNodeId) {
      this.openCardIds.clear();
      this.openCardsNodeId = value?.id ?? null;
    }

    this.render();
  }

  get nodeData(): FlowNodeData | null {
    return this.nodeDataValue ? structuredClone(this.nodeDataValue) : null;
  }

  private nodeOptionsValue: Array<{ id: string; label: string }> = [];

  /** Nodes that can be pointed at (for the note node's target). */
  set nodeOptions(value: Array<{ id: string; label: string }>) {
    this.nodeOptionsValue = structuredClone(value);
  }

  set variableOptions(value: QuestionVariableOption[]) {
    this.variableOptionsValue = structuredClone(value);
    this.render();
  }

  /**
   * The answers set by the time the visitor stands on this node (Johan 25/9):
   * what a chip may name. Null offers every answer the guide sets. No redraw:
   * it is set before `variableOptions`, which redraws.
   */
  set answersSetHere(value: ReadonlySet<string> | null) {
    this.answersSetHereValue = value ? new Set(value) : null;
  }

  /**
   * Read back for the text-field probe on `dev/text-probe.html` (fynd i,
   * Johan's iPad 26/9: *Infoga svar* sometimes empty although `idag` is
   * always set). The one thing the probe cannot read off the DOM is which
   * answers the panel was told are set here; a copy, so nothing outside can
   * change it.
   */
  get answersSetHere(): ReadonlySet<string> | null {
    return this.answersSetHereValue ? new Set(this.answersSetHereValue) : null;
  }

  /**
   * The guide's nodes, for `gateOpen` (`renderPropertyList`) to decide which
   * property gates are open. Used to carry the words for a conditional
   * option's badge too (story 134); that badge is gone (vända 6, 29/9 — Ted
   * mätte att den bara visade första villkoret och påstod att det var hela
   * bilden), but the gate check still needs the nodes. No redraw: it is set
   * beside `variableOptions`, which redraws.
   */
  set guideNodes(value: readonly FlowNodeData[]) {
    this.guideNodesValue = value.map((node) => structuredClone(node));
  }

  set capabilities(value: EditorCapabilities) {
    this.capabilitiesValue = { ...value };
    this.render();
  }

  focusProperty(property: string): void {
    const field = this.root.querySelector<HTMLElement>(
      `[data-property="${CSS.escape(property)}"]`
    );

    field?.focus();
  }

  /**
   * The tab is already called "Egenskaper" — the heading instead shows what is
   * selected, e.g. "Textfråga · Namn".
   */
  private getHeaderTitle(): string {
    const node = this.nodeDataValue;
    if (!node) {
      return this.text("editor.properties.header-default");
    }

    const definition = getNodeType(node.type);
    const typeLabel =
      templateLabel(node.template, this.uiLocale) ??
      displayNodeTypeLabel(node.type, definition?.label, this.uiLocale);
    /*
     * In the language the panel is showing, not in Swedish.
     *
     * `resolveText` defaults to `DEFAULT_SOURCE_LOCALE`, so this line read the
     * Swedish text whatever the panel was set to. Found in a film recorded on
     * the English page with an English-source guide: every field said "Housing
     * allowance is unusual in your situation" and the heading above them said
     * "Bostadsbidrag är ovanligt i din situation".
     *
     * The source is the fallback, which is what it is for — a node not yet
     * translated shows the words it does have rather than nothing.
     */
    const title = resolveText(
      node.data.title,
      this.activeLocaleValue,
      "",
      this.sourceLocaleValue,
    ).trim();

    return title ? `${typeLabel} · ${title}` : typeLabel;
  }

  /** Flyttar fokus till flyttknappen efter en omritning; faller tillbaka på motsatt riktning. */
  focusOrderControl(direction: "up" | "down"): void {
    const preferred = this.root.querySelector<HTMLButtonElement>(
      `[data-order-move="${direction}"]:not([disabled])`
    );
    const fallback = this.root.querySelector<HTMLButtonElement>(
      "[data-order-move]:not([disabled])"
    );

    (preferred ?? fallback)?.focus();
  }

  private renderPageOrderControls(node: FlowNodeData): string {
    const position = this.pagePositionValue;
    const isFirst = position ? position.index <= 0 : false;
    const isLast = position ? position.index >= position.count - 1 : false;
    const placement = position
      ? this.text("editor.properties.page-placement", {
          position: position.index + 1,
          count: position.count,
        })
      : "";
    const placementLabel = this.text("editor.properties.placement-in-page");

    return `
      <div class="properties-panel__field properties-panel__order" role="group" aria-label="${escapeHtml(placementLabel)}">
        <span>${escapeHtml(placementLabel)}${placement ? ` – ${placement.toLowerCase()}` : ""}</span>
        <div class="properties-panel__order-buttons">
          <button type="button" data-order-move="up" ${isFirst ? "disabled" : ""} aria-label="${this.text("editor.properties.move-up-node", { title: escapeHtml(this.getNodeTitle(node)) })}">
            ${this.text("editor.properties.move-up")}
          </button>
          <button type="button" data-order-move="down" ${isLast ? "disabled" : ""} aria-label="${this.text("editor.properties.move-down-node", { title: escapeHtml(this.getNodeTitle(node)) })}">
            ${this.text("editor.properties.move-down")}
          </button>
        </div>
      </div>
    `;
  }

  private getNodeTitle(node: FlowNodeData): string {
    // Same as above: the panel's language, with the source as the fallback.
    const title = resolveText(
      node.data.title,
      this.activeLocaleValue,
      "",
      this.sourceLocaleValue,
    ).trim();
    return title.length > 0 ? title : this.text("editor.properties.node-title-fallback");
  }

  private render(): void {
    /*
     * The panel is rebuilt from a string, so the scroll container is a new
     * element every time — at scrollTop 0. Switching on a field's
     * conditional visibility re-rendered, and the controls it had just
     * unfolded sat below the fold while the panel showed its top (Johan
     * 29/9, measured: scrollTop 0 after the click). The position carries
     * over while the same node stays selected; another node starts at the
     * top, as before.
     */
    const sameNode = this.renderedNodeId === (this.nodeDataValue?.id ?? null);
    const scrollTop = sameNode
      ? this.root.querySelector<HTMLElement>(".properties-panel__content")?.scrollTop ?? 0
      : 0;

    this.renderedNodeId = this.nodeDataValue?.id ?? null;
    this.paint();
    if (scrollTop > 0) {
      const content = this.root.querySelector<HTMLElement>(".properties-panel__content");

      if (content) content.scrollTop = scrollTop;
    }
  }

  /** The node the panel was last drawn for, so `render` knows whether to keep its scroll. */
  private renderedNodeId: string | null = null;

  private paint(): void {
    const typing = this.conditionBeingTyped();

    this.root.innerHTML = `
      <style>${styles}</style>

      <aside class="properties-panel">
        <header class="properties-panel__header">
          <h2>${escapeHtml(this.getHeaderTitle())}</h2>
        </header>

        <div class="properties-panel__content">
          ${this.renderModeNotice()}
          ${this.renderTranslationBanner()}
          ${this.nodeDataValue
        ? this.renderNode(this.nodeDataValue)
        : this.renderGuideSettings()
      }
        </div>

        <p class="properties-panel__announce" data-announce role="status" aria-live="polite"></p>
      </aside>
    `;

    /*
     * The condition row's field picker (story 143) takes its rows as a
     * property; the markup is a string, so they travel in a data attribute
     * and are handed over here, once the element exists.
     */
    this.root.querySelectorAll<FieldPicker>("field-picker").forEach((picker) => {
      picker.options = JSON.parse(picker.dataset.pickerRows ?? "[]");
      picker.value = picker.dataset.pickerValue ?? "";
    });
    this.bindFormEvents();
    // Locking last: the bindings do not matter for a disabled field, but a
    // field locked before they are set would lose them at the next mode.
    this.applyEditorMode();
    this.bindCardToggles();
    this.bindOptionLabels();
    this.bindCardTooltips();
    this.applyCardOpenState();
    this.focusPendingOption();
    this.focusAfterCardMove();
    if (typing) {
      const field = this.root.querySelector<HTMLInputElement>(typing.selector);

      // The field picker keeps focus alone; a text field its selection too.
      field?.focus();
      if (!(field instanceof HTMLInputElement)) return;
      if (field.type === "text") field.setSelectionRange(typing.start, typing.end);
      // A number field has no selection to set: for the moment it takes one
      // it is a text field, and the cursor goes after the value, where the
      // typing was.
      else {
        field.type = "text";
        field.setSelectionRange(field.value.length, field.value.length);
        field.type = "number";
      }
    }
  }

  /**
   * The condition value being typed, if the cursor is in one — so a redraw
   * can give it back.
   *
   * A visibility change goes to the host as `node-visibility-changed`, and
   * the host answers by selecting the node again, which sets `nodeData` and
   * redraws the panel (`updateNodeVisibility`, node-editor.ts). The panel
   * itself does not redraw while a value is typed, but the host did: measured
   * 29/9, the value field was detached after the first key, and "5000"
   * arrived as "5". It held for the field's one condition before Del B, too;
   * a second condition made it the thing a test types into. The group's id
   * names the field, so the same field in the new tree gets the cursor.
   *
   * The field picker too (story 143, point 7: after a choice focus is back on
   * the field): the choice is the change the host redraws for, and focus
   * fell to the body (measured 30/9 in both visibilities). It has no text
   * selection to keep; `focus()` on the host reaches its field through
   * `delegatesFocus`.
   */
  private conditionBeingTyped(): { selector: string; start: number; end: number } | null {
    const field = this.root.activeElement;
    const picker = field?.localName === "field-picker";

    if (!field || (!picker && (!(field instanceof HTMLInputElement) || (field.type !== "text" && field.type !== "number")))) return null;
    for (const scope of ["visibility", "option-visibility"] as const) {
      const names = CONDITION_SCOPES[scope];
      const group = field.closest<HTMLElement>(`[${names.group}]`);
      const property = field.getAttribute(`${names.attr}-property`);

      if (!group || !property) continue;
      return {
        selector: `[${names.group}="${CSS.escape(group.getAttribute(names.group) ?? "")}"] [${names.attr}-property="${CSS.escape(property)}"]`,
        start: field instanceof HTMLInputElement && field.type === "text" ? field.selectionStart ?? 0 : 0,
        end: field instanceof HTMLInputElement && field.type === "text" ? field.selectionEnd ?? 0 : 0,
      };
    }
    return null;
  }

  /**
   * Draws the unfolded cards as unfolded — after every redraw, which starts
   * them all closed (`hidden` on the body, see `renderCard`).
   */
  private applyCardOpenState(): void {
    this.root.querySelectorAll<HTMLElement>(".properties-panel__option[data-card]").forEach((card) => {
      const kind = card.dataset.card as CardKind;
      const id = card.dataset[cardIdKey(kind)] ?? "";
      const open = this.openCardIds.has(id);
      const body = card.querySelector<HTMLElement>(`[data-${kind}-body]`);
      const toggle = card.querySelector<HTMLElement>(`[data-action="toggle-${kind}"]`);

      if (!body || !toggle) return;
      card.toggleAttribute(`data-${kind}-open`, open);
      body.hidden = !open;
      // A folded body has no height to measure; its fields are fitted when shown.
      if (open) body.querySelectorAll<HTMLTextAreaElement>("textarea[data-fit]").forEach(fitToText);
      toggle.setAttribute("aria-expanded", String(open));
      // Same name the card was rendered with (`data-card-name`, K3 —
      // otherwise every chevron reads "Visa alternativet", identical on
      // every one of them).
      toggle.setAttribute(
        "aria-label",
        this.text(open ? "editor.properties.option-collapse" : "editor.properties.option-expand", {
          label: card.dataset.cardName ?? "",
        }),
      );
    });
  }

  /**
   * Unfolding and folding: the set changes and the card is drawn from it —
   * no redraw, no event, nothing for the host to save.
   */
  private bindCardToggles(): void {
    const open = this.openCardIds;

    this.root.querySelectorAll<HTMLElement>(".properties-panel__option[data-card]").forEach((card) => {
      const kind = card.dataset.card as CardKind;
      const id = card.dataset[cardIdKey(kind)] ?? "";

      card.querySelector<HTMLButtonElement>(`[data-action="toggle-${kind}"]`)?.addEventListener("click", () => {
        if (open.has(id)) open.delete(id);
        else open.add(id);
        this.applyCardOpenState();
      });
    });
  }

  /**
   * A card's head follows the field that names it, while it is typed: the
   * heading keeps its hidden position (`data-…-position`) and only its text
   * changes; the tooltip shows the same name. `name` is the text already
   * resolved — the typed value or the card's own fallback.
   */
  private retitleCard(card: Element | null, name: string): void {
    const kind = (card as HTMLElement | null)?.dataset.card;

    if (!card || !kind) return;
    const title = card.querySelector<HTMLElement>(`[data-${kind}-title]`);
    const position = title?.querySelector(`[data-${kind}-position]`);

    title?.replaceChildren(...(position ? [position] : []), name);
    const tooltip = card.querySelector<HTMLElement>(`[data-${kind}-tooltip]`);

    if (tooltip) tooltip.textContent = name;
  }

  /**
   * The option's text field (konceptbild 2, 29/9): a textarea that grows with
   * its text, never takes a line break, and whose heading follows it.
   *
   * One line because the model's label is one: the viewer draws it with
   * ordinary white-space, so a break reads as a space to the visitor while it
   * travels on in the data (measured 29/9). Enter is refused — not while an
   * input method is composing, where Enter confirms the word — and a pasted
   * break is made a space in `dispatchOptionChange`, before the model sees it.
   *
   * The heading keeps its hidden position (`data-option-position`) and only
   * its text changes; the tooltip shows the same name.
   */
  private bindOptionLabels(): void {
    this.root.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>('[data-option-property="label"]').forEach((field) => {
      field.addEventListener("keydown", (event) => {
        if ((event as KeyboardEvent).key === "Enter" && !(event as KeyboardEvent).isComposing) event.preventDefault();
      });
      field.addEventListener("input", () => {
        this.retitleCard(
          field.closest(".properties-panel__option[data-card]"),
          field.value.trim() || this.text("editor.properties.option-untitled"),
        );
        if (field instanceof HTMLTextAreaElement) fitToText(field);
      });
    });
  }

  /**
   * The full name behind the ellipsis (konceptbild 2): shown while the
   * chevron has focus or the pointer is over the head — only when the name is
   * actually cut, a whole name needs no second copy. Escape closes the tooltip
   * alone: the card stays as it is, and the key is marked as taken — the
   * editor's full-screen mode leaves on an Escape nobody has taken
   * (`handleWideModeKeydown`). Nothing here touches the open state.
   */
  private bindCardTooltips(): void {
    this.root.querySelectorAll<HTMLElement>(".properties-panel__option[data-card]").forEach((row) => {
      const kind = row.dataset.card as CardKind;
      const head = row.querySelector<HTMLElement>(".properties-panel__option-header");
      const title = row.querySelector<HTMLElement>(`[data-${kind}-title]`);
      const tooltip = row.querySelector<HTMLElement>(`[data-${kind}-tooltip]`);
      const toggle = row.querySelector<HTMLElement>(`[data-action="toggle-${kind}"]`);

      if (!head || !title || !tooltip || !toggle) return;
      const show = (): void => {
        tooltip.hidden = title.scrollWidth <= title.clientWidth;
        if (tooltip.hidden) return;

        /*
         * Above the head, as drawn — unless that is outside what scrolls:
         * measured 29/9, with the head at the top edge of the panel the
         * tooltip was cut by 42 px. Then it goes below the head.
         */
        tooltip.style.removeProperty("top");
        tooltip.style.removeProperty("bottom");
        tooltip.style.removeProperty("margin");
        const edge = scrollerOf(head)?.getBoundingClientRect().top ?? 0;

        if (tooltip.getBoundingClientRect().top < edge) {
          tooltip.style.top = "100%";
          tooltip.style.bottom = "auto";
          tooltip.style.margin = "var(--fw-space-2) 0 0";
        }
      };
      const hide = (): void => {
        tooltip.hidden = true;
      };
      /*
       * WCAG 1.4.13 "hoverable" (mätt 29/9): the tooltip sits `margin-bottom:
       * var(--fw-space-2)` above the head it describes — a real gap, not
       * touching. Moving the pointer from the head straight toward the
       * tooltip crosses that gap, which belongs to neither element:
       * `head.contains(relatedTarget)`/`tooltip.contains(relatedTarget)` are
       * both false for the split second the pointer is over the gap, so an
       * immediate hide-on-leave fired before the cursor ever reached the
       * tooltip — reproduced with a real `page.mouse.move` path (not
       * assumed from the CSS), and unfixable by only checking which element
       * the pointer landed on next, because during the crossing it is
       * genuinely over neither. A short grace period, cancelled by landing
       * on either surface again, is the standard shape of this fix (every
       * accessible tooltip with a visual gap to its trigger uses one) and
       * is what "hoverable" actually asks for: not that a gap can never
       * exist, but that reaching the tooltip through it must work.
       */
      let hideTimer: ReturnType<typeof setTimeout> | undefined;
      const cancelHide = (): void => {
        clearTimeout(hideTimer);
        hideTimer = undefined;
      };
      const scheduleHide = (): void => {
        if (this.root.activeElement === toggle) return;
        cancelHide();
        hideTimer = setTimeout(hide, 200);
      };
      const showNow = (): void => {
        cancelHide();
        show();
      };

      toggle.addEventListener("focus", showNow);
      toggle.addEventListener("blur", hide);
      head.addEventListener("pointerenter", showNow);
      tooltip.addEventListener("pointerenter", showNow);
      head.addEventListener("pointerleave", scheduleHide);
      tooltip.addEventListener("pointerleave", scheduleHide);
      head.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || tooltip.hidden) return;
        event.preventDefault();
        hide();
      });
    });
  }

  /**
   * After a move the list is drawn again, and focus would fall to the body.
   * It goes back to the same control on the same card — or to the other
   * move button when the one pressed has just become disabled at an edge.
   */
  private focusAfterCardMove(): void {
    const pending = this.cardFocusAfterMove;

    // The host sets more than the node after a move, and each setter draws
    // the panel again: kept until the next frame, then given to whatever
    // stands there by then — not to a button a later draw threw away.
    if (!pending || this.cardFocusFrame !== null) return;
    this.cardFocusFrame = requestAnimationFrame(() => {
      this.cardFocusFrame = null;
      this.cardFocusAfterMove = null;
      this.focusMovedCard(pending);
    });
  }

  private cardFocusFrame: number | null = null;

  private focusMovedCard(pending: { kind: CardKind; id: string; action: string }): void {
    const { kind } = pending;
    const find = (action: string) =>
      this.root.querySelector<HTMLButtonElement>(
        `[data-card="${kind}"][data-${kind}-id="${CSS.escape(pending.id)}"] > .properties-panel__option-header [data-action="${action}"]`,
      );
    const up = `move-${kind}-up`;
    const other = pending.action === up ? `move-${kind}-down` : up;
    const pressed = find(pending.action);
    const target = pressed && !pressed.disabled ? pressed : pending.action === `drag-${kind}` ? pressed : find(other);

    target?.focus();
  }

  /**
   * Says something once, to whoever is listening rather than looking.
   *
   * Samma idiom som `node-editor`s och `guide-versions`s `announce()`: en tom
   * text, sedan den riktiga texten strax efter — `render()` bygger om hela
   * `this.root.innerHTML` precis som de, så regionen är ett nytt element varje
   * gång, och en skärmläsare läser en *ändring*, inte samma ord den redan sa.
   */
  private announce(message: string): void {
    const region = this.root.querySelector<HTMLElement>("[data-announce]");

    if (!region) {
      return;
    }

    region.textContent = "";
    window.setTimeout(() => {
      region.textContent = message;
    }, 30);
  }

  /**
   * Says where a dragged or arrow-moved answer option landed.
   *
   * Called at the gesture's `onCommit` and at the up/down buttons — both ask
   * for the same move, one by holding a grip and one by pressing a key, and
   * both were silent before this (mätt mot artiklarna 22/9, docs/IDEAS.md):
   * a version moved with the arrow keys already said so
   * (`editor.announce.nodeMoved`), an option did not.
   *
   * The position is read from the option list itself, not from the intent's
   * detail — the panel does not own the order (the host does, see
   * `handleCardPointerDown`'s doc comment), but it knows what it just asked
   * for, and that is what a screen reader needs to hear at the moment of the
   * gesture rather than waiting on a round trip through the host.
   */
  private announceOptionMove(optionId: string, targetIndex: number, total: number): void {
    const options = this.nodeDataValue
      ? QuestionOptionsService.parseOptions(this.nodeDataValue.data.options)
      : [];
    const index = options.findIndex((option) => option.id === optionId);

    if (index < 0) {
      return;
    }

    const label = resolveText(options[index]!.label, this.sourceLocaleValue);

    this.announceMove(label || this.text("editor.properties.option-n", { number: index + 1 }), targetIndex, total);
  }

  /** Where a moved card landed, by its name — the same words for every list. */
  private announceMove(title: string, targetIndex: number, total: number): void {
    this.announce(
      this.text("editor.announce.reordered", {
        title,
        position: targetIndex + 1,
        count: total,
      }),
    );
  }

  /**
   * Lämnar markören i raden man just lade till.
   *
   * Panelen ritas om när en rad tillkommer, och rullar då tillbaka till toppen:
   * man tror man står i det nya och skriver i något annat — eller ingenstans,
   * för markören ligger på `<body>` och nästa tabb börjar om från sidans topp.
   *
   * Nästa bildruta, för raden finns inte förrän omritningen skett. Första
   * fokuserbara fältet i raden, eftersom det är där man ska börja skriva och
   * raderna har olika första fält.
   */
  private focusNewRow(selector: string): void {
    requestAnimationFrame(() => {
      this.root
        .querySelector<HTMLElement>(`${selector} input, ${selector} select, ${selector} textarea`)
        ?.focus();
    });
  }

  /**
   * Sends the keyboard to one field, and unfolds *Avancerat* if that is where
   * the field lives.
   *
   * This is the one thing that may open the fold besides a person pressing it
   * (Johans beslut 23/9 2026): *"Öppna gruppen automatiskt när användaren
   * navigerar till ett valideringsfel i ett dolt fält, och fokusera då rätt
   * fält."* A navigation is not a guess about the content — somebody asked to
   * be taken somewhere, and a group that stays shut over the destination makes
   * the journey end in nothing.
   *
   * The id is a field id, the same one the forms declare, so a caller never has
   * to know which group a field sits in — that is the panel's business, and it
   * changes when a field moves.
   *
   * Opening it here is remembered like any other opening (`open = true` fires
   * `toggle`). That is deliberate: the panel redraws while the field is being
   * corrected, and a fold that shut itself between two keystrokes would take
   * the cursor with it.
   *
   * Next frame, for the same reason `focusNewRow` waits: the caller may have
   * set `nodeData` in the same turn, and the field does not exist until that
   * redraw has happened.
   */
  focusField(propertyId: string): void {
    requestAnimationFrame(() => {
      const control = this.root.querySelector<HTMLElement>(
        `[data-property="${CSS.escape(propertyId)}"]`,
      );

      if (!control) {
        return;
      }

      const fold = control.closest<HTMLDetailsElement>(
        'details[data-property-section="advanced"]',
      );

      if (fold && !fold.open) {
        fold.open = true;
      }

      control.focus();
      // A text with an answer the guide does not set: land on that chip (story 136).
      if (control instanceof RichTextField) control.selectMissingChip();
      control.scrollIntoView({ block: "nearest" });
    });
  }

  private focusPendingOption(): void {
    const optionId = this.optionIdToFocus;

    if (!optionId) {
      return;
    }

    this.optionIdToFocus = null;

    requestAnimationFrame(() => {
      const labelInput = Array.from(
        this.root.querySelectorAll<HTMLInputElement>(
          '[data-option-property="label"]'
        )
      ).find((input) => input.dataset.optionId === optionId);

      if (!labelInput) {
        return;
      }

      labelInput.focus();
      labelInput.select();
      labelInput.scrollIntoView({
        block: "nearest",
      });
    });
  }

  private renderTranslationBanner(): string {
    if (!this.isTranslationMode()) {
      return "";
    }
    const label = localeTitle(this.activeLocaleValue, this.uiLocale);
    // Källans namn i meningsform (litet s i "svenska") — hinten hårdkodade
    // svensk källa tills första guiden med engelsk källa mötte läget.
    const source = localeLabel(this.sourceLocaleValue, this.uiLocale);
    return `
      <div class="properties-panel__translation-banner" role="status">
        <strong>${this.text("editor.properties.translation-mode", { locale: escapeHtml(label) })}</strong>
        <span>${this.text("editor.properties.translation-hint", { locale: escapeHtml(source) })}</span>
      </div>
    `;
  }

  private renderEmptyState(): string {
    return `
      <p class="properties-panel__empty">
        ${this.text("editor.properties.empty-state")}
      </p>
    `;
  }

  /**
   * When no node is selected: guide-global viewer texts. Edited as ordinary
   * (translatable) text fields — empty means the built-in default.
   */
  /**
   * The guide's own details. Deliberately first among the guide sections: it
   * answers *what* you are looking at, before Språk and Visartexter answer how
   * it should look.
   *
   * `senast ändrad` is shown but not editable — it is set on save and export.
   * It is shown anyway, because an editor who cannot see it also cannot notice
   * that it looks wrong.
   */
  private renderGuideMeta(): string {
    const meta = this.guideMetaValue;
    const namn = this.localizedField(
      { id: "name", localized: true, label: "", control: "text" },
      meta.name
    );
    const beskrivning = this.localizedField(
      { id: "description", localized: true, label: "", control: "text" },
      meta.description
    );

    const changed = meta.updatedAt
      ? this.formatUpdatedAt(meta.updatedAt)
      : this.text("editor.properties.guide-updated-never");

    return `
      <section class="properties-panel__guide">
        <h3>${this.text("editor.properties.guide-heading")}</h3>

        <div class="properties-panel__field">
          <label for="guide-meta-name">${this.text("editor.properties.guide-name")}</label>
          <input id="guide-meta-name" type="text" data-guide-meta="name"
            value="${escapeHtml(namn.shownValue)}"
            placeholder="${escapeHtml(this.text("editor.properties.guide-name-placeholder"))}">
          ${namn.showSource && namn.source ? this.sourceReference(namn.source) : ""}
        </div>

        <div class="properties-panel__field">
          <label for="guide-meta-description">${this.text("editor.properties.guide-description")}</label>
          <input id="guide-meta-description" type="text" data-guide-meta="description"
            value="${escapeHtml(beskrivning.shownValue)}"
            placeholder="${escapeHtml(this.text("editor.properties.guide-description-placeholder"))}">
          ${beskrivning.showSource && beskrivning.source ? this.sourceReference(beskrivning.source) : ""}
        </div>

        <div class="properties-panel__field">
          <label for="guide-meta-owner">${this.text("editor.properties.guide-owner")}</label>
          <input id="guide-meta-owner" type="text" data-guide-meta="owner"
            value="${escapeHtml(meta.owner ?? "")}">
          <p class="properties-panel__hint">${this.text("editor.properties.guide-owner-description")}</p>
        </div>

        <div class="properties-panel__field">
          <span class="properties-panel__meta-label">${this.text("editor.properties.guide-updated")}</span>
          <p class="properties-panel__hint" data-guide-updated>${escapeHtml(changed)}</p>
        </div>
      </section>
    `;
  }

  /** A readable timestamp in the editor's language. Falls back to the raw value. */
  private formatUpdatedAt(value: string): string {
    const datum = new Date(value);

    if (Number.isNaN(datum.getTime())) {
      return value;
    }

    return datum.toLocaleString(this.uiLocale || "sv", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  /**
   * The progress meter, on or off for this guide (story 116).
   *
   * Its own section rather than a line among the guide's details: name,
   * description and owner say *what the guide is*, this decides what the
   * visitor is shown. `GuideSettings`, not `GuideMeta`, for the same reason.
   */
  private renderGuideProgress(): string {
    // A switch, the same shape a node's boolean property already gets (the
    // `checkbox` case below, which is *Kan upprepas* among others). Johan:
    // *"gör en switch ... som vi ibland gjort inställningarna"* — the editor
    // has the pattern, and a second one for the same kind of choice is a cost.
    return `
      <section class="properties-panel__guide">
        <h3>${this.text("editor.properties.guide-progress-heading")}</h3>
        <div class="properties-panel__field">
          <label>
            <input type="checkbox" role="switch" data-guide-progress
              ${this.guideProgressValue ? "checked" : ""}>
            ${this.text("editor.properties.guide-progress")}
          </label>
          <small class="properties-panel__help">${this.text("editor.properties.guide-progress-description")}</small>
        </div>
      </section>
    `;
  }

  private renderGuideSettings(): string {
    const fields = customizableUiStrings(this.uiLocale).map((item) => {
      const pseudo: NodePropertyDefinition = {
        id: item.key,
        localized: true,
        label: item.label,
        control: "text",
      };
      const { shownValue, source, showSource } = this.localizedField(
        pseudo,
        this.guideStringsValue[item.key]
      );
      const fallback = t(item.key, this.activeLocaleValue);
      return `
        <div class="properties-panel__field">
          <label for="guide-string-${escapeHtml(item.key)}">${escapeHtml(item.label)}</label>
          <input
            id="guide-string-${escapeHtml(item.key)}"
            type="text"
            value="${escapeHtml(shownValue)}"
            placeholder="${escapeHtml(fallback)}"
            data-guide-string="${escapeHtml(item.key)}"
          />
          ${showSource && source ? this.sourceReference(source) : ""}
        </div>
      `;
    }).join("");



    return `
      ${this.renderEmptyState()}
      ${this.renderGuideMeta()}
      ${this.renderGuideProgress()}
      <section class="properties-panel__guide">
        <h3>${this.text("editor.properties.languages-heading")}</h3>
        ${this.renderGuideLocales()}
      </section>
      <details class="properties-panel__guide" data-ui-texts ${this.uiTextsOpen ? "open" : ""}>
        <summary><h3>${this.text("editor.properties.ui-texts-heading")}</h3></summary>
        <div class="properties-panel__guide-fields">${fields}</div>
      </details>
    `;
  }

  /**
   * A property's own words in the editor's language, the node type's first.
   *
   * `nodeProp.<id>.*` is one key per FIELD, and the same field id does not
   * always say the same thing on every node type. `startValue` says *Talet* on
   * a number question and *Datumet* on a date question (story 118); `minChars`
   * says *"0 visar hela listan…"* on the multi lookup and *"Innan ett uppslag
   * görs."* on the single one. Swedish was never hurt by that — `tOr` hands
   * back the code's own source text — but English had no such escape, and one
   * of the two types quietly wore the other's sentence.
   *
   * So the type's key is asked first and the shared one is what it falls back
   * to. A field that says the same thing everywhere stays one row in the
   * table; a field that does not gets a row per type. No second table, no list
   * of exceptions: which fields need it is answered by which keys exist.
   *
   * Johan 15/9: *"borde översättas, ska finnas språkstöd rätt igenom."* The
   * cheap way out — one English sentence vague enough to fit both, *the value*
   * instead of *the number* — was put to him and turned down.
   */
  private nodeText(
    nodeType: string,
    id: string,
    kind: "label" | "description",
    fallback: string
  ): string {
    return tOr(
      `nodeProp.${nodeType}.${id}.${kind}`,
      tOr(`nodeProp.${id}.${kind}`, fallback, this.uiLocale),
      this.uiLocale
    );
  }

  /**
   * Translates a property's label/description/select options into the editor's
   * UI language via `tOr` (Swedish = the code's source text). The node's *data*
   * is untouched.
   */
  private localizeProperty(
    node: FlowNodeData,
    property: NodePropertyDefinition
  ): NodePropertyDefinition {
    const nodeType = node.type;

    return {
      ...property,
      label: this.nodeText(nodeType, property.id, "label", property.label),
      description: property.description
        ? this.nodeText(nodeType, property.id, "description", property.description)
        : property.description,
      /*
       * The node's data goes to the function, for choices that depend on
       * another field on the same node — the submission node's case type
       * offers the entries of the list chosen beside it (story 123). This is
       * the one place a function becomes an array, so it is the one place that
       * has to know.
       */
      options: (typeof property.options === "function"
        ? property.options(node.data)
        : property.options
      )?.map((option) => ({
        ...option,
        label: tOr(
          `nodeOption.${option.value || "none"}`,
          option.label,
          this.uiLocale
        ),
      })),
    };
  }

  private renderNode(node: FlowNodeData): string {
    const definition = getNodeType(node.type);

    if (!definition) {
      return `
        <p class="properties-panel__empty">
          ${this.text("editor.properties.no-node-type", { type: escapeHtml(node.type) })}
        </p>
      `;
    }

    if (
      definition.requiredCapability &&
      !this.capabilitiesValue[definition.requiredCapability]
    ) {
      return `
        <p class="properties-panel__empty">
          ${this.text("editor.properties.node-type-not-included", { label: escapeHtml(displayNodeTypeLabel(node.type, definition.label, this.uiLocale)) })}
        </p>
      `;
    }

    const own = this.renderPropertyList(node, editableProperties(definition));
    const onPage = Boolean(node.parentPageId);
    const group = (name: string, html: string): string =>
      html.trim()
        ? `<div class="properties-panel__group" data-panel-group="${name}">${html}</div>`
        : "";

    /*
     * The panel in groups (Astra 1/10 2026, bilaga 11; docs/GRAFISK-PROFIL.md
     * *Panelens grupper*): what the question says → how it is answered → the
     * rules about the answer → where it sits on the page → when it is shown →
     * the settings set once or never → the facts nobody edits. Each group is
     * a box of its own, so the form's gap is the distance BETWEEN groups (24)
     * and a group's gap the distance inside it (12) — one number each, never
     * a margin stacked on a gap.
     *
     * It was one flat column at 20 throughout, with *Villkorsstyrd synlighet*
     * between *Variabeltyp* and *Position* and *Mall* among the facts: the
     * order the code happened to add things in, and no distance saying what
     * belonged together.
     */
    return `
      <div class="properties-panel__form">
        ${node.type === "page" ? group("advice", `
          <p class="properties-panel__help" data-page-advice>
            ${this.text("editor.properties.pageAdvice")}
          </p>
        `) : ""}
        ${this.pageWarningsValue.length > 0 && node.type === "page" ? `
          <div class="properties-panel__warnings" role="status">
            ${this.pageWarningsValue
              .map((warning) => `<p>⚠ ${escapeHtml(warning)}</p>`)
              .join("")}
          </div>
        ` : ""}
        ${own.groups.map((one) => group(one.name, one.html)).join("")}
        ${own.validation}
        ${onPage ? group("placement", `
          ${this.renderPageOrderControls(node)}
          ${!["page-heading", "page-spacer"].includes(node.type) ? `
            <label class="properties-panel__field">
              <span>${this.text("editor.properties.field-width")}</span>
              <span class="properties-panel__select"><select data-layout-property="columnSpan">
                <option value="12" ${(node.layout?.columnSpan ?? 12) === 12 ? "selected" : ""}>${this.text("editor.properties.field-width-full")}</option>
                <option value="6" ${node.layout?.columnSpan === 6 ? "selected" : ""}>${this.text("editor.properties.field-width-half")}</option>
                <option value="4" ${node.layout?.columnSpan === 4 ? "selected" : ""}>${this.text("editor.properties.field-width-third")}</option>
              </select></span>
              <small class="properties-panel__help">${this.text("editor.properties.field-width-help")}</small>
            </label>
            <label class="properties-panel__checkbox properties-panel__switch">
              <input type="checkbox" role="switch" data-layout-break-before ${node.layout?.breakBefore ? "checked" : ""}>
              <span>${this.text("editor.properties.break-before")}</span>
            </label>
          ` : ""}
        `) : ""}
        ${onPage ? group("visibility", this.renderVisibility(node)) : ""}
        ${own.advanced}
        ${group("facts", `
          <div class="properties-panel__field">
            <span>${this.text("editor.properties.node-type")}</span>
            <code>${escapeHtml(node.type)}</code>
          </div>

          <div class="properties-panel__field" data-node-module>
            <span>${this.text("editor.properties.module")}</span>
            <p>${escapeHtml(resolveText(moduleForRequiredCapability(definition.requiredCapability).label, this.uiLocale))}</p>
          </div>

          ${definition.variableType && this.capabilitiesValue.variables ? `
            <div class="properties-panel__field">
              <span>${this.text("editor.properties.variable-type")}</span>
              <p>${escapeHtml(this.getVariableTypeLabel(definition.variableType))}</p>
            </div>
          ` : ""}

          <div class="properties-panel__field">
            <span>${this.text("editor.properties.position")}</span>
            <p>
              X: ${node.position.x},
              Y: ${node.position.y}
            </p>
          </div>
        `)}
      </div>
    `;
  }

  /**
   * Which node template the node comes from.
   *
   * The tag carries no data — it only says what the node is called. Changing or
   * removing it therefore changes no property. The template's values apply when
   * the node is *created*, not when the provenance is changed afterwards.
   *
   * Only templates with the node's own base type are offered: a question node
   * cannot have come from a text-question template, and being able to claim so
   * would be an untruth.
   */
  private renderTemplateChoice(node: FlowNodeData): string {
    const valbara = templatesForBase(node.type);
    const nuvarande = node.template ?? "";
    const saknad = Boolean(
      nuvarande && !valbara.some((template) => template.type === nuvarande)
    );

    // No template to choose and none to show → no control.
    if (valbara.length === 0 && !nuvarande) {
      return "";
    }

    /*
     * Without permission: show, but do not change. Where the node comes from
     * explains what it is called, and hiding that makes the name unintelligible.
     * *Changing* the template, on the other hand, belongs to template
     * management.
     */
    if (!this.canManageTemplatesValue) {
      return nuvarande
        ? `
          <div class="properties-panel__field" data-node-template>
            <span>${this.text("editor.properties.template")}</span>
            <p>${escapeHtml(
              templateLabel(nuvarande) ??
                this.text("editor.properties.template-missing", { type: nuvarande })
            )}</p>
          </div>
        `
        : "";
    }

    return `
      <label class="properties-panel__field" data-node-template>
        <span>${this.text("editor.properties.template")}</span>
        <span class="properties-panel__select"><select data-template-select>
          <option value="" ${nuvarande === "" ? "selected" : ""}>
            ${this.text("editor.properties.template-none")}
          </option>
          ${valbara
            .map(
              (template) => `
                <option value="${escapeHtml(template.type)}" ${
                  template.type === nuvarande ? "selected" : ""
                }>${escapeHtml(template.label)}</option>
              `
            )
            .join("")}
          ${
            saknad
              ? `<option value="${escapeHtml(nuvarande)}" selected>${escapeHtml(
                  this.text("editor.properties.template-missing", { type: nuvarande })
                )}</option>`
              : ""
          }
        </select></span>
        <small class="properties-panel__help">${this.text(
          "editor.properties.template-hint"
        )}</small>
      </label>
    `;
  }

  /**
   * The guide's languages: the source first, then the ones it is translated
   * into.
   *
   * The list is no longer an enumeration of three checkboxes. Any language can
   * be added, and the name comes from the browser — `so` becomes *somaliska*.
   * There used to be sv, en and fi hardcoded, which excluded exactly the
   * languages a municipality most often needs.
   *
   * Adding, removing or moving the source is the administrator's business:
   * offering a guide in a language is a promise to keep it current, and that
   * binds more people than whoever happens to be editing right now.
   */
  /**
   * The guide's languages: adding, removing and naming the source.
   *
   * All three bind more than this one guide's content — offering a language is a
   * promise to keep it current — and therefore require an administrator.
   */
  private bindGuideLocaleEvents(): void {
    const send = (locales: string[]): void => {
      this.guideLocalesValue = locales;
      this.dispatchEvent(
        new CustomEvent<GuideLocalesChangedDetail>("guide-locales-changed", {
          detail: { locales },
          bubbles: true,
          composed: true,
        })
      );
    };

    /*
     * One binding, because there is one decision left.
     *
     * Adding a language, removing one and choosing the source were three
     * controls asking the editor to decide things that belong to the host. The
     * box changes `settings.locales` and nothing else — a language's
     * translations stay in the nodes, so unticking is reversible and ticking it
     * back brings the work with it. Nothing is destroyed, so nothing is
     * confirmed.
     */
    this.root
      .querySelectorAll<HTMLInputElement>("[data-locale-offered]")
      .forEach((box) => {
        box.addEventListener("change", () => {
          const code = box.dataset.localeOffered ?? "";
          if (code === "" || isSourceLocale(code, this.sourceLocaleValue)) {
            return;
          }
          const current = this.guideLocalesValue.filter(
            (locale) => locale !== code,
          );
          send(box.checked ? [...current, code] : current);
        });
      });
  }

  /** Fields lacking a translation into a language. Zero for the source. */
  private renderGuideLocales(): string {
    const allowed = this.canManageTemplatesValue;
    const source = this.sourceLocaleValue;

    /*
     * A checkbox per language, and nothing else.
     *
     * There used to be an "add" field, a "remove" button and a radio for
     * choosing the source. All three asked the editor to decide something that
     * is not theirs: which languages an organisation offers is the host's, and
     * so is the language a guide is written in. What remains is the one
     * decision that *is* the editor's — whether this guide is offered in a
     * language the host has already made available.
     *
     * The list is the host's declared languages plus any the guide already
     * carries. A guide translated into a language the host has since stopped
     * offering keeps it: the translation exists, and dropping it from the list
     * would hide someone's work behind a configuration change.
     *
     * With no declaration the list is simply the guide's own. That follows from
     * removing the free-text field — the host decides which languages exist,
     * and a host that has said nothing has offered none.
     */
    const declared = declaredLocales() ?? [];
    const codes = [
      source,
      ...this.guideLocalesValue.filter((code) => code !== source),
      ...declared.filter(
        (code) => code !== source && !this.guideLocalesValue.includes(code),
      ),
    ];

    // Story 010, criterion 8: a language with no viewer texts anywhere leaves
    // the resident reading the guide's source on the buttons. The editor cannot
    // fix that, so it is said here, beside the administrator who can.
    const utanVisartexter = new Set(localesWithoutStrings(codes));

    const rows = codes
      .map((code) => {
        const isSource = isSourceLocale(code, source);
        const on = isSource || this.guideLocalesValue.includes(code);
        const offered = isSource || declared.length === 0 || declared.includes(code);
        const note = isSource
          ? this.text("editor.properties.locale-source")
          : this.text("editor.properties.locale-translated", {
              count: this.translatedFieldCount(code),
            });

        return `
        <li class="properties-panel__locale" data-locale="${escapeHtml(code)}">
          <label class="properties-panel__locale-choice">
            <input type="checkbox" role="switch" data-locale-offered="${escapeHtml(code)}"
              ${on ? "checked" : ""} ${isSource || !allowed ? "disabled" : ""}>
            <span>${escapeHtml(localeTitle(code, this.uiLocale))}</span>
          </label>
          <span class="properties-panel__locale-note">${escapeHtml(note)}</span>
          ${
            offered
              ? ""
              : `<span class="properties-panel__locale-warning">${this.text(
                  "editor.properties.locale-not-offered",
                )}</span>`
          }
          ${
            utanVisartexter.has(code)
              ? `<span class="properties-panel__locale-warning">${this.text(
                  "editor.properties.locale-no-viewer-strings",
                )}</span>`
              : ""
          }
        </li>
      `;
      })
      .join("");

    return `
      <p class="properties-panel__help">${this.text("editor.properties.locale-offer-help")}</p>
      <ul class="properties-panel__locales">${rows}</ul>
    `;
  }

  /** How many fields are translated into a language. Zero for the source. */
  private translatedFieldCount(locale: string): number {
    return this.localeUsageValue[locale] ?? 0;
  }

  /**
   * Variablerna som går att använda i den här noden.
   *
   * Nodens egen är inte en av dem. En fråga renderar sin rubrik **innan**
   * någon svarat på den, så `{{namn}}` i "Vad heter du?" är alltid tomt — och
   * delarna med den: `namn.value` kan inte heta något när `namn` inte gör det.
   *
   * Johan såg det i variabellistan. Synlighetsvillkoret gjorde redan samma
   * uteslutning på egen hand; nu gör de det på samma ställe, för två
   * filtreringar av samma slag är en som glider.
   */
  private variablesAvailableHere(): QuestionVariableOption[] {
    const own = typeof this.nodeDataValue?.data.variableName === "string"
      ? this.nodeDataValue.data.variableName.trim()
      : "";

    if (own === "") return this.variableOptionsValue;

    return this.variableOptionsValue.filter(
      (option) => option.value !== own && !option.value.startsWith(`${own}.`),
    );
  }

  /**
   * Jämförelsens rader: vilka operatorer som ERBJUDS, och vad de heter.
   *
   * ## Ordet följer variabeln
   *
   * Johan på plattan 31/8, om `land.value är någon av XS`: *"borde det inte
   * vara lika med?"* Villkoret var rätt — svaret är en lista och `one-of`
   * betyder "något av dina svar finns i listan" — men ordet är skrivet för ett
   * svar mot flera värden. På en flervärd variabel heter de fyra därför
   * *innehåller …* i stället för *är …*.
   *
   * ## Vad som inte erbjuds, och varför motorn ändå kan det
   *
   * `equals`/`not-equals` faller bort på en flervärd variabel: i motorn
   * betyder de "hela listan, som text, är exakt det här" — avsiktligt strängt
   * (se `rule-evaluator.ts`), men som erbjudande en fälla, för redaktören
   * läser det som *är*. `all-of`/`not-all-of` faller bort på en envärd, där de
   * är exakta dubbletter av `one-of`/`not-one-of` (bevisat i
   * `rule-all-of.test.ts`).
   *
   * Ingen av dem tas bort ur MOTORN. En graf som redan bär dem utvärderas som
   * förut, och därför läggs det lagrade värdet till sist när det inte finns
   * bland de erbjudna. En `<select>` som saknar sitt eget värde visar det
   * första alternativet i stället, och nästa gång någon rör panelen sparas
   * det: en regel skulle tyst byta betydelse av att ha öppnats. Samma mönster
   * som variabelraden för en variabel guiden inte längre har.
   *
   * ## Varför `numeric` är ett argument och inte en uträkning
   *
   * För att de två ställena INTE gör lika i dag: regeln erbjuder de numeriska
   * jämförelserna bara när variabeln är ett tal, synligheten alltid. Det är en
   * skillnad värd sin egen fråga, och att skicka in den håller den synlig i
   * stället för att gömma den i en delad uträkning som tyst ändrar det ena.
   */
  private operatorRows(
    operator: RuleCondition["operator"] | undefined,
    { multiple, numeric }: { multiple: boolean; numeric: boolean },
  ): Array<{ value: string; text: string }> {
    const offered: Array<RuleCondition["operator"]> = multiple
      ? ["one-of", "not-one-of", "all-of", "not-all-of"]
      : ["equals", "not-equals", "one-of", "not-one-of"];

    if (numeric) {
      offered.push("greater-than", "greater-than-or-equal", "less-than", "less-than-or-equal");
    }

    const shown = operator && !offered.includes(operator)
      ? [...offered, operator]
      : offered;

    return shown.map((one) => ({ value: one, text: this.operatorLabel(one, multiple) }));
  }

  /** Ordet för en operator, i den form variabelns kardinalitet ber om. */
  private operatorLabel(
    operator: RuleCondition["operator"],
    multiple: boolean,
  ): string {
    const suffix = multiple && (operator === "one-of" || operator === "not-one-of")
      ? "-multi"
      : "";

    return this.text(`editor.properties.op-${operator}${suffix}`);
  }

  private renderVisibility(node: FlowNodeData): string {
    const conditions = node.visibility?.conditions ?? [];
    const enabled = conditions.length > 0;

    return `
      <div class="properties-panel__field properties-panel__visibility">
        <label class="properties-panel__switch">
          <input type="checkbox" role="switch" data-visibility-property="enabled" ${enabled ? "checked" : ""}>
          <span>${this.text("editor.properties.conditional-visibility")}</span>
        </label>
        <small class="properties-panel__help" data-visibility-scope>${this.text("editor.properties.visibilityScope")}</small>
        ${enabled ? this.renderConditions({
          scope: "visibility",
          conditions,
          match: node.visibility!.match,
          structure: "open",
          variables: this.variablesAvailableHere(),
        }) : ""}
      </div>
    `;
  }

  /**
   * A condition's controls, in all three places one is written: a rule, a
   * field's "visas om" and an answer option's (uppdrag 29/9 Del B, Astra
   * §3–§5). It was two renderers that looked alike — `renderRuleCondition`
   * and `renderVisibilityControls` — and one of them had "Variabel" where
   * the other had "Svar eller värde", a numbered column the other lacked,
   * and a value box that was a plain text field for a number.
   *
   * Each condition is a group of three stacked, labelled controls — *Svar
   * eller värde*, *Villkor*, *Värde* — the value a chip picker where the
   * variable has known values, a number field for a number, a text field
   * otherwise, locked with *Välj variabel först* until a variable is chosen.
   *
   * Several conditions: a *Kombinera villkor* selector above the groups (one
   * `match` for the whole list — nothing suggests mixed or nested
   * combinations), a small *Villkor N* heading on each (the name an error can
   * point at), a still *OCH* or *ELLER* between them, and *Ta bort villkoret* in
   * each group. One condition: no selector (the stored `match` is never
   * rewritten), no heading, and no remove — the only condition must stay.
   *
   * `structure: "locked"` is a rule with several conditions while Logik is
   * off: the values stay editable and look it, the combination is read out
   * and marked *Låst struktur*, and nothing can be removed. The explanation
   * stands once, at the top of the rule list (`renderRuleCasesProperty`).
   *
   * What still differs between the places is passed in rather than hidden:
   * which variables are offered (a field's visibility leaves out the field's
   * own answer), and the numeric comparisons — a rule offers them for a
   * number only, a visibility always. See `operatorRows` on why that
   * difference is kept here and not tidied away.
   *
   * `owner` goes on every control of an option's condition, so the handler
   * knows which option changed: the panel redraws on each change, and a
   * control already drawn is detached by the time its event arrives. `bare`
   * leaves a lone condition unframed where its surroundings already frame it.
   */
  private renderConditions(context: {
    scope: ConditionScope;
    conditions: readonly RuleCondition[];
    match: "all" | "any";
    structure: "open" | "locked";
    variables: readonly QuestionVariableOption[];
    owner?: string;
    bare?: boolean;
  }): string {
    const { scope, conditions, match, variables } = context;
    const names = CONDITION_SCOPES[scope];
    const owner = context.owner ?? "";
    const multi = conditions.length > 1;
    const locked = multi && context.structure === "locked";
    const property = (name: string): string => `${names.attr}-property="${name}" ${owner}`;
    const matchText = (value: "all" | "any"): string =>
      this.text(value === "all" ? "editor.properties.match-all-conditions" : "editor.properties.match-any-condition");
    const combine = !multi
      ? ""
      : locked
        ? `
          <div class="properties-panel__condition-combine" data-condition-combine>
            <span>${this.text("editor.properties.combine-conditions")}</span>
            <p class="properties-panel__condition-combine-value">${matchText(match)} <span class="properties-panel__locked-tag">${this.text("editor.properties.locked-structure")}</span></p>
          </div>`
        : `
          <label class="properties-panel__condition-combine">
            <span>${this.text("editor.properties.combine-conditions")}</span>
            <span class="properties-panel__select"><select ${names.match} ${owner}>
              <option value="all" ${match === "all" ? "selected" : ""}>${matchText("all")}</option>
              <option value="any" ${match === "any" ? "selected" : ""}>${matchText("any")}</option>
            </select></span>
          </label>`;
    const join = `<p class="properties-panel__condition-join">${this.text(match === "all" ? "editor.properties.join-all" : "editor.properties.join-any")}</p>`;

    const groups = conditions.map((condition, index) => {
      const id = escapeHtml(condition.id);
      const variable = variables.find((option) => option.value === condition.variableName);
      /*
       * The chooser's rows: every variable under the name every other chooser
       * gives it, and — when the condition points at one no longer offered —
       * the stored name last, said in words, so a select never silently shows
       * another row than the one saved.
       */
      const variableRows = [
        // Groups as the formula's plus menu names them (Astras skiss 1):
        // answers first, then calculations, then what the engine sets.
        ...[
          ...variables.filter((option) => !option.calculated && !option.computed),
          ...variables.filter((option) => option.calculated && !option.computed),
          ...variables.filter((option) => option.computed),
        ].map((option) => ({
          value: option.value,
          label: resolveText(option.label),
          group: this.text(
            option.computed
              ? "editor.properties.computed-group"
              : option.calculated
                ? "editor.properties.formula-calculations-group"
                : "editor.properties.answers-group",
          ),
        })),
        ...(condition.variableName && !variable
          ? [{ value: condition.variableName, label: this.text("editor.properties.variable-missing", { name: condition.variableName }) }]
          : []),
      ];
      const isNumber = variable?.type === "number";
      const headingId = `condition-heading-${scope}-${id}`;
      const value = variable && variable.options.length > 0
        ? this.renderValuePicker(
            { id: condition.id, value: condition.value ?? "", variableName: condition.variableName },
            !isListOperator(condition.operator),
            { group: `${names.value}-group`, picker: `${names.value}-picker`, field: property("value") },
          )
        : `<input
            type="${isNumber ? "number" : "text"}"
            ${property("value")}
            value="${escapeHtml(condition.value ?? "")}"
            ${
              /*
               * Without a variable there is nothing to compare with, and an
               * empty text field invites typing a code — exactly what the
               * picker exists to spare. Locked, with what is missing in words,
               * so the order shows: variable first (Johan, a new rule, 8/9).
               */
              condition.variableName
                ? ""
                : `disabled placeholder="${escapeHtml(this.text("editor.properties.value-pick-variable"))}"`
            }
          >`;

      /*
       * The placeholder row is `disabled`, so "Välj variabel" cannot be picked
       * as if it were one: iOS draws a select as a list with a tick on the
       * chosen row (Johan, on the tablet, 2026-08-31). The test is
       * `placeholder-option.browser.test.ts`.
       */
      return `
        ${index > 0 ? join : ""}
        <div
          class="properties-panel__condition${context.bare && !multi ? " properties-panel__condition--bare" : ""}"
          ${names.group}="${id}"
          role="group"
          ${multi ? `aria-labelledby="${headingId}"` : `aria-label="${this.text("editor.properties.condition")}"`}
        >
          ${multi ? `<p class="properties-panel__condition-heading" id="${headingId}">${this.text("editor.properties.condition-n", { number: index + 1 })}</p>` : ""}
          <label>
            <span>${this.text("editor.properties.condition-subject")}</span>
            <field-picker
              ${property("variableName")}
              data-picker-rows="${escapeHtml(JSON.stringify(variableRows))}"
              data-picker-value="${escapeHtml(condition.variableName)}"
              label="${escapeHtml(this.text("editor.properties.condition-subject"))}"
            ></field-picker>
          </label>
          <label>
            <span>${this.text("editor.properties.condition")}</span>
            <span class="properties-panel__select"><select ${property("operator")}>
              ${this.operatorRows(condition.operator, {
                multiple: variable?.multiple === true,
                numeric: scope === "rule" ? isNumber : true,
              }).map((row) => `
                <option value="${row.value}" ${row.value === condition.operator ? "selected" : ""}>${row.text}</option>
              `).join("")}
            </select></span>
          </label>
          <label>
            <span>${this.text("editor.properties.value")}</span>
            ${value}
          </label>
          ${multi && !locked
            ? this.renderCardRemove(
                `data-action="${names.remove}" ${owner}`,
                this.text("editor.properties.remove-condition"),
                "properties-panel__condition-remove",
              )
            : ""}
        </div>
      `;
    });

    return `
      <div class="properties-panel__conditions">
        ${combine}
        ${groups.join("")}
      </div>
    `;
  }

  /**
   * *Visas bara om …* på ett enskilt alternativ (story 134).
   *
   * Samma brytare, samma villkorskontroller (`renderConditions`) som fältet
   * har — en nivå ner. Nötcurryn visas inte för den som svarat att den är
   * allergisk mot nötter; den vegetariska rätten bär inget villkor och
   * erbjuds alla.
   *
   * Hjälpraden säger vilket av tre områden man valt, som 067: det här
   * alternativet, hela fältet, eller vägen genom guiden. Utan den väljer
   * redaktören fel mekanism — tre saker som alla börjar med *visas bara om*
   * behöver var sin mening om vad de gäller.
   *
   * Ingen sammanfattningsrad (vända 6, 29/9): den kan inte göras SANN för
   * alla fall (flera villkor, "any"/"all"). Villkorsytan visar redan
   * sanningen i sina egna fält. Ett ensamt villkor ritas utan egen ram:
   * ytan runt det (`…-visibility-conditions`) är redan dess ram.
   *
   * Avstängd i översättningsläge, som *Utesluter andra val*: ett villkor är en
   * identitet — variabelnamn, operator och kod — och inget en översättare
   * skriver om.
   */
  private renderOptionVisibility(option: QuestionOption, inTranslation: boolean): string {
    const conditions = option.visibility?.conditions ?? [];
    const enabled = conditions.length > 0;
    const owner = `data-option-id="${escapeHtml(option.id)}"`;

    return `
        <div class="properties-panel__option-visibility" ${owner}>
          <label class="properties-panel__switch">
            <input
              type="checkbox"
              role="switch"
              data-option-visibility-property="enabled"
              ${owner}
              ${enabled ? "checked" : ""}
              ${inTranslation ? "disabled" : ""}
            />
            <span>${this.text("editor.properties.conditional-visibility")}</span>
          </label>
          <small class="properties-panel__help" data-option-visibility-scope>${this.text("editor.properties.optionVisibilityScope")}</small>
          ${enabled && !inTranslation ? `
          <div class="properties-panel__option-visibility-conditions">
            <p class="properties-panel__option-visibility-heading">${this.text("editor.properties.optionVisibilityHeading")}</p>
            ${this.renderConditions({
              scope: "option-visibility",
              conditions,
              match: option.visibility!.match,
              structure: "open",
              variables: this.variablesAvailableHere(),
              owner,
              bare: true,
            })}
          </div>
          ` : ""}
        </div>
    `;
  }

  /**
   * One card in a sortable list: answer options, rules and calculation rows
   * (uppdrag 29/9 Del A — Astra's §1: "Återanvänd svarsalternativens
   * hopfällbara kort"). One head for all three, so the grip, the name with
   * its ellipsis and tooltip, the move buttons and the chevron cannot come to
   * differ between the lists.
   *
   * The hooks carry the kind in their name — `data-option-id`,
   * `data-rule-case-id`, `toggle-rule-case`, `data-assignment-body` — the
   * pattern the option row and the older rule and row buttons already had.
   * `data-card` says which kind a card is, so the binders that open, retitle
   * and move cards (`applyCardOpenState`, `bindCardToggles`,
   * `bindCardTooltips`, `handleCardPointerDown`) serve all three.
   *
   * Always drawn closed; the open state is interface state kept per id in
   * `openCardIds` and applied after each draw. `title` and `name` arrive
   * escaped: `title` is what the head shows, `name` the source text the
   * icon-only controls are named after (see `renderAnswerOptionRow`).
   * `position` is read, never shown ("Alternativ 2, …"), and left out where
   * the title already is the position (an unnamed rule reads "Regel 2").
   */
  private renderCard(card: {
    kind: CardKind;
    id: string;
    className?: string;
    attributes?: string;
    title: string;
    name: string;
    position: string | null;
    canMoveUp: boolean;
    canMoveDown: boolean;
    body: string;
  }): string {
    const { kind } = card;
    const id = escapeHtml(card.id);
    const own = `data-${kind}-id="${id}"`;
    /*
     * An answer option's head buttons carry its id themselves: the host's
     * move and remove events read it from the button (`button.dataset.
     * optionId`). A rule's and a row's buttons find their card instead —
     * with the id on every button, `[data-assignment-id]` would count five
     * elements per row.
     */
    const onButton = kind === "option" ? own : "";
    const bodyId = `${kind}-body-${id}`;
    const tooltipId = `${kind}-tooltip-${id}`;
    const arrow = (path: string): string =>
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    return `
      <div
        class="properties-panel__option properties-panel__option--card${card.className ? ` ${card.className}` : ""}"
        data-card="${kind}"
        ${own}
        data-card-name="${card.name}"
        ${card.attributes ?? ""}
      >
        <div class="properties-panel__option-header">
          <button
            type="button"
            class="properties-panel__option-drag-handle"
            data-action="drag-${kind}"
            ${onButton}
            aria-label="${this.text("editor.properties.move-option", { label: card.name })}"
            title="${this.text("editor.properties.drag-to-reorder")}"
          >
            <span aria-hidden="true">⠿</span>
          </button>

          <div class="properties-panel__option-heading">
            <strong class="properties-panel__option-title" data-${kind}-title id="${kind}-title-${id}">${
              card.position === null
                ? ""
                : `<span class="properties-panel__visually-hidden" data-${kind}-position>${card.position}, </span>`
            }${card.title}</strong>
          </div>

          <button
            type="button"
            class="properties-panel__option-move"
            data-action="move-${kind}-up"
            ${onButton}
            ${card.canMoveUp ? "" : "disabled"}
            aria-label="${this.text("editor.properties.move-option-up", { label: card.name })}"
          >
            ${arrow("M12 19V6M6 12l6-6 6 6")}
          </button>

          <button
            type="button"
            class="properties-panel__option-move"
            data-action="move-${kind}-down"
            ${onButton}
            ${card.canMoveDown ? "" : "disabled"}
            aria-label="${this.text("editor.properties.move-option-down", { label: card.name })}"
          >
            ${arrow("M12 5v13M6 12l6 6 6-6")}
          </button>

          <button
            type="button"
            class="properties-panel__option-toggle"
            data-action="toggle-${kind}"
            ${onButton}
            aria-expanded="false"
            aria-controls="${bodyId}"
            aria-describedby="${tooltipId}"
            aria-label="${this.text("editor.properties.option-expand", { label: card.name })}"
          >
            <svg class="properties-panel__option-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>

          <div class="properties-panel__option-tooltip" role="tooltip" id="${tooltipId}" data-${kind}-tooltip hidden>${card.title}</div>
        </div>

        <div class="properties-panel__option-body" data-${kind}-body id="${bodyId}" hidden>
          ${card.body}
        </div>
      </div>
    `;
  }

  /**
   * A card's last row: divider, bin, the words — text, normal weight,
   * `--fw-danger-text` (Astra §5). `attributes` carries the action and, where
   * it can be refused, `disabled`.
   *
   * The panel's one destructive form (B3, Astra 30/9): the service call's
   * rows, the submission's columns and the older option list take it too.
   * Before the round they were red words without the bin at 35 px — a second
   * form of the same act, measured by Fia (GENOMGANG E5).
   */
  private renderCardRemove(attributes: string, text: string, className = ""): string {
    return `
          <button type="button" class="properties-panel__option-remove${className ? ` ${className}` : ""}" ${attributes}>
            <span aria-hidden="true">${TRASH_ICON}</span>
            ${text}
          </button>`;
  }
  /**
   * The panel's one local add (GRAFISK-PROFIL, Visuell hierarki; B3, Astra
   * 30/9): primary outline, the plus as an icon, the collection's width.
   * `empty` is the empty collection's tinted variant — same icon, words,
   * radius and height, only the tint.
   *
   * Before the round the panel drew four: a dashed neutral box without a plus
   * (*Lägg till fält*, *Lägg till kolumn*, the comments), the outline with
   * the character "+" at 37 px and radius 6 (options, rules, calculations),
   * and the outline without a plus (*Lägg till villkor*) — GENOMGANG E6.
   */
  private renderAddButton(attributes: string, text: string, empty = false): string {
    return `<button type="button" class="properties-panel__add-option${empty ? " properties-panel__add-option--empty" : ""}" ${attributes}>${ADD_ICON}<span>${text}</span></button>`;
  }


  /**
   * Etapp 2 (UPPDRAG-2026-09-28-SVARSALTERNATIV, 28/9): ett svarsalternativs
   * kompakta, utfällbara rad — konceptbildens struktur, tokensystemets färg.
   * Skiljs från `renderOptionsProperty`s äldre, alltid-utfällda markup, som
   * host-uppslagets "Egen lista" (`mockItems`) fortsätter att använda.
   *
   * Bara formen är min. Raden renderas alltid STÄNGD här — inget
   * `data-option-open`, `hidden` på kroppen, `aria-expanded="false"` —
   * utfällningen är Teds gränssnittstillstånd, aldrig modellens, och han
   * sätter/tar bort attributen direkt i DOM:en utan omritning. Kontraktet
   * han själv föreslog, och som strukturen nedan är byggd mot:
   *   1. `data-option-open` på `.properties-panel__option` när utfälld.
   *   2. `data-action="toggle-option"` (chevronen) med `aria-expanded` +
   *      `aria-controls="option-body-<id>"`.
   *   3. `data-option-body` med matchande `id`, `hidden` när stängd.
   *   4. `data-option-title` visar etiketten eller "Nytt alternativ".
   *   5. (Struket, Johans förenkling — Astras vända 5, 28/9: ersätter allt
   *      tidigare om chip och utfällbar inställning. Ett stängt kort visar
   *      bara namn, position och kontroller — ingen chip. Ett öppet kort
   *      visar lagringsvärdet EXAKT en gång, som ett vanligt fält
   *      ("Lagringsvärde", `data-option-property="value"`) i samma stil
   *      som "Svarsalternativ" ovanför — ingen utfällning, ingen chip,
   *      ingen ikon. Hookarna `data-option-value`, `data-option-value-
   *      preview`, `toggle-option-value`, `data-option-value-body` finns
   *      inte längre; Ted tar bort sin logik/prov för dem.)
   *   6. Övriga hookar oförändrade: `data-option-property`, samtliga
   *      `data-action`-värden för flytt, borttag, tillägg och drag.
   *
   * Konceptbild 2 (Johans mått, 29/9 — ersätter variant a/b i sin helhet):
   * huvudet är EN rad — grepp → namn → flytta upp → flytta ned → chevron,
   * alla ritade SVG-ikoner (samma stroke-width-2-familj som "Ta bort
   * alternativ"s papperskorg), inte tecken. Namnet äger resten av bredden
   * (`min-width: 0` + ellipsis), aldrig radbrytning; en tooltip
   * (`data-option-tooltip`, `role="tooltip"`, kopplad via chevronens
   * `aria-describedby`) visar hela namnet — byggd här statisk och stängd
   * (`hidden`), Ted kopplar den faktiska visningen (bara vid trunkering,
   * hover på raden och fokus/blur på chevronen) och avgränsningen mot
   * panelkanten. Positionen ("Alternativ N") är inte längre synlig text —
   * ett TOMT `data-option-position`-span sitter i rubriken, dolt med
   * samma klipp-teknik som `guide-versions__announce` (`clip-path`, inte
   * `display: none`, så en skärmläsare fortfarande läser den); Ted/Siv
   * fyller texten, samordnat med den `{label}`-namngivning Siv redan
   * byggt på kontrollerna. Etikettfältet är nu en `<textarea>` som växer
   * i höjd (`data-option-property="label"` oförändrat) — Ted bygger
   * auto-höjden.
   */
  private renderAnswerOptionRow(context: {
    option: QuestionOption;
    index: number;
    canMoveUp: boolean;
    canMoveDown: boolean;
    inTranslation: boolean;
    sourceLabel: string;
    labelValue: string;
    several: boolean;
    canRemove: boolean;
  }): string {
    const {
      option,
      index,
      canMoveUp,
      canMoveDown,
      inTranslation,
      sourceLabel,
      labelValue,
      several,
      canRemove,
    } = context;
    const id = escapeHtml(option.id);
    const titleId = `option-title-${id}`;
    const trimmedLabel = labelValue.trim();
    const titleText =
      trimmedLabel.length > 0 ? escapeHtml(trimmedLabel) : this.text("editor.properties.option-untitled");
    /*
     * The row's own name for its icon-only controls (grip, move, chevron):
     * the SOURCE label, not `labelValue` — in translation mode `labelValue`
     * is the active locale's text and empty until translated, so `titleText`
     * would announce "Nytt alternativ" for an option that is merely
     * untranslated, not new. `sourceLabel` is always the real text.
     * Measured (UPPDRAG-2026-09-28-SVARSALTERNATIV, etapp 2 K-numren, Siv
     * 28/9): every one of these four names was either fully generic
     * ("Flytta alternativet uppåt", identical on all six rows) or, for the
     * grip on a genuinely empty/untitled option, a bare "Flytta " with
     * nothing after it — `escapeHtml(sourceLabel)` with no fallback.
     */
    const sourceTitle = sourceLabel.trim().length > 0 ? escapeHtml(sourceLabel.trim()) : this.text("editor.properties.option-untitled");

    return this.renderCard({
      kind: "option",
      id: option.id,
      className: "properties-panel__option--answer",
      attributes: `data-option-index="${index}"`,
      title: titleText,
      name: sourceTitle,
      position: this.text("editor.properties.option-n", { number: index + 1 }),
      canMoveUp,
      canMoveDown,
      body: `
          <label>
            ${this.text("editor.properties.option-label-field")}

            <textarea
              rows="1"
              data-fit
              ${inTranslation ? `placeholder="${escapeHtml(sourceLabel)}"` : ""}
              data-option-property="label"
              data-option-id="${id}"
              aria-describedby="${titleId}"${this.contentDirection()}
            >${escapeHtml(labelValue)}</textarea>
            ${inTranslation ? `<small class="properties-panel__source" data-option-source>${this.text("editor.properties.source-reference", { locale: escapeHtml(localeLabel(this.sourceLocaleValue, this.uiLocale)), source: escapeHtml(sourceLabel) })}</small>` : ""}
          </label>

          <label>
            ${this.text("editor.properties.option-storage-label")}

            <input
              type="text"
              value="${escapeHtml(option.value)}"
              data-option-property="value"
              ${inTranslation ? "disabled" : ""}
            />
          </label>
          ${several ? `
          <label class="properties-panel__option-exclusive properties-panel__switch">
            <input
              type="checkbox"
              role="switch"
              data-option-property="exclusive"
              ${option.exclusive === true ? "checked" : ""}
              ${inTranslation ? "disabled" : ""}
            />

            ${this.text("editor.properties.option-exclusive")}
          </label>
          <small class="properties-panel__help">${this.text("editor.properties.option-exclusive-hint")}</small>
          ` : ""}
          ${this.renderOptionVisibility(option, inTranslation)}

          ${this.renderCardRemove(
            `data-action="remove-option" data-option-id="${id}" ${canRemove ? "" : "disabled"}`,
            this.text("editor.properties.remove-option-full"),
          )}
`,
    });
  }

  private renderOptionsProperty(
    property: NodePropertyDefinition,
    value: unknown
  ): string {
    const options = QuestionOptionsService.parseOptions(value);
    const canRemove = QuestionOptionsService.canRemoveOption(options);
    /*
     * Ett alternativ kan stå ensamt — men bara där det finns andra val att
     * utesluta. Ett enkelval ersätter redan varje val med det nya, så knappen
     * skulle inte göra något, och en kontroll som inte gör något är värre än
     * ingen alls. Kardinaliteten läses ur nodtypen, samma hem som
     * operatorerna använder, och aldrig ur typens namn. Berättelse 062.
     */
    const several =
      this.nodeDataValue !== null
      && getNodeType(this.nodeDataValue.type)?.behavior?.answer.cardinality === "multi";
    /*
     * `renderOptionsProperty` delas av frågans riktiga svarsalternativ
     * (property.id "options") och host-uppslagets egen lista (id
     * "mockItems", etiketten "Egen lista") — båda deklarerar
     * `control: "options"`. Bara den förra får etapp 2:s kompakta,
     * utfällbara rader (`renderAnswerOptionRow`); mockItems fortsätter
     * oförändrad i grenen nedan, så host-uppslagets egen lista aldrig
     * påverkas av det här uppdraget.
     */
    const isAnswerOptions = property.id === "options";

    return `
    <div class="properties-panel__field">
      ${isAnswerOptions
        ? `
      <div class="properties-panel__options-heading">
        <h3>${escapeHtml(property.label)}</h3>
        <small class="properties-panel__options-count" data-options-count${options.length === 0 ? " hidden" : ""}>${this.text("editor.properties.options-count", { count: options.length })}</small>
      </div>
      ${/* An empty collection says it once, in its instruction below (graphic profile, "Den tomma samlingens variant"). */ options.length === 0 ? "" : `<p class="properties-panel__options-hint">${this.text("editor.properties.drag-to-reorder")}</p>`}
      `
        : `<span>${escapeHtml(property.label)}</span>`
      }

      <div class="properties-panel__options">
        ${options
        .map((option, index) => {
          const canMoveUp = index > 0;

          const canMoveDown = index < options.length - 1;

          // The label is translatable; the value is an identity and is locked.
          const inTranslation = this.isTranslationMode();
          const sourceLabel = resolveText(option.label, this.sourceLocaleValue);
          const labelValue = !inTranslation
            ? sourceLabel
            : isLocalizedTextMap(option.label) &&
                typeof option.label[this.activeLocaleValue] === "string"
              ? option.label[this.activeLocaleValue]
              : "";

          if (isAnswerOptions) {
            return this.renderAnswerOptionRow({
              option,
              index,
              canMoveUp,
              canMoveDown,
              inTranslation,
              sourceLabel,
              labelValue,
              several,
              canRemove,
            });
          }

          // Same fallback as the answer-option row: `sourceLabel` can be
          // empty for a genuinely untitled item, and the move buttons share
          // `move-option-up`/`-down` with that row (K3 name, not a second
          // pair of strings for the same role).
          const mockItemSourceTitle = sourceLabel.trim().length > 0 ? escapeHtml(sourceLabel.trim()) : this.text("editor.properties.option-untitled");

          return `
      <div
        class="properties-panel__option"
        data-option-id="${escapeHtml(option.id)}"
        data-option-index="${index}"
      >
        <div class="properties-panel__option-header">
          <button
            type="button"
            class="properties-panel__option-drag-handle"
            data-action="drag-option"
            data-option-id="${escapeHtml(option.id)}"
            aria-label="${this.text("editor.properties.move-option", { label: mockItemSourceTitle })}"
            title="${this.text("editor.properties.drag-to-reorder")}"
          >
            <span aria-hidden="true">⠿</span>
          </button>
          <span>
            ${this.text("editor.properties.option-n", { number: index + 1 })}
          </span>

          <div class="properties-panel__option-order">
            <button
              type="button"
              data-action="move-option-up"
              data-option-id="${escapeHtml(option.id)}"
              ${canMoveUp ? "" : "disabled"}
              aria-label="${this.text("editor.properties.move-option-up", { label: mockItemSourceTitle })}"
            >
              ↑
            </button>

            <button
              type="button"
              data-action="move-option-down"
              data-option-id="${escapeHtml(option.id)}"
              ${canMoveDown ? "" : "disabled"}
              aria-label="${this.text("editor.properties.move-option-down", { label: mockItemSourceTitle })}"
            >
              ↓
            </button>
          </div>
        </div>


                <label>
                  ${this.text("editor.properties.label")}

                  <input
                    type="text"
                    value="${escapeHtml(labelValue)}"
                    ${inTranslation ? `placeholder="${escapeHtml(sourceLabel)}"` : ""}
                    data-option-property="label"
                    data-option-id="${escapeHtml(option.id)}"${this.contentDirection()}
                  />
                  ${inTranslation ? `<small class="properties-panel__source" data-option-source>${this.text("editor.properties.source-reference", { locale: escapeHtml(localeLabel(this.sourceLocaleValue, this.uiLocale)), source: escapeHtml(sourceLabel) })}</small>` : ""}
                </label>

                <label>
                  ${this.text("editor.properties.value")}

                  <input
                    type="text"
                    value="${escapeHtml(option.value)}"
                    data-option-property="value"
                    ${inTranslation ? "disabled" : ""}
                  />
                </label>
        ${several ? `
                <label class="properties-panel__option-exclusive properties-panel__switch">
                  <input
                    type="checkbox"
                    role="switch"
                    data-option-property="exclusive"
                    ${option.exclusive === true ? "checked" : ""}
                    ${inTranslation ? "disabled" : ""}
                  />

                  ${this.text("editor.properties.option-exclusive")}
                </label>
        ` : ""}
        ${this.renderOptionVisibility(option, inTranslation)}
        ${canRemove
              ? `
              ${this.renderCardRemove(`data-action="remove-option" data-option-id="${escapeHtml(option.id)}"`, this.text("editor.properties.remove"))}
            `
              : ""
            }
      </div>
    `;
        })
        .join("")}
      </div>

      ${
        /*
         * The empty collection's variant (graphic profile, approved by Astra
         * 30/9, attachment 4): with no options, an instruction above and the
         * same add button tinted across the collection's width. The first
         * option turns it back into the outline button.
         */
        isAnswerOptions && options.length === 0
          ? `<p class="properties-panel__empty-hint" data-empty-hint>${this.text("editor.properties.empty-options")}</p>`
          : ""
      }
      ${this.renderAddButton('data-action="add-option"', this.text("editor.properties.add-option"), isAnswerOptions && options.length === 0)}

      ${property.description
        ? `
            <small class="properties-panel__help">
              ${escapeHtml(property.description)}
            </small>
          `
        : ""
      }
    </div>
  `;
  }

  /**
   * Read state for a text/rich field in the active language. Translatable
   * fields are edited in the chosen language (empty when no translation exists,
   * the source as a reference); identity fields are locked in translation
   * mode.
   */
  /**
   * Which way a field's text reads — story 009, criterion 3.
   *
   * Only for fields that carry the guide's **text**. A variable name or an
   * option's value is an identity: a code the flow depends on, and codes are
   * written left to right whatever language the guide is in. Turning those
   * around would make a Latin variable name render backwards beside its label.
   *
   * The direction follows the *content* language, not the editor's. A
   * translator writing Arabic sees their text as the resident will, while the
   * tool around it stands still — story 014.
   *
   * Returns the attribute or an empty string, so the common case adds nothing
   * to the markup.
   */
  private fieldDirection(property: NodePropertyDefinition): string {
    return property.localized === true ? this.contentDirection() : "";
  }

  /** The `dir` attribute for text in the guide's active language, or nothing. */
  private contentDirection(): string {
    return textDirection(this.activeLocaleValue) === "rtl" ? ' dir="rtl"' : "";
  }

  private localizedField(
    property: NodePropertyDefinition,
    value: unknown
  ): { shownValue: string; source: string; showSource: boolean; locked: boolean } {
    const localizedField = property.localized === true;
    const inTranslation = this.isTranslationMode();
    const source = resolveText(value, this.sourceLocaleValue);
    const shownValue = !localizedField
      ? resolveText(value)
      : !inTranslation
        ? source
        : isLocalizedTextMap(value) &&
            typeof value[this.activeLocaleValue] === "string"
          ? value[this.activeLocaleValue]
          : "";
    return {
      shownValue,
      source,
      showSource: localizedField && inTranslation,
      locked: inTranslation && !localizedField,
    };
  }

  private sourceReference(source: string): string {
    return `<small class="properties-panel__source" data-source-reference>${this.text("editor.properties.source-reference", { locale: escapeHtml(localeLabel(this.sourceLocaleValue, this.uiLocale)), source: escapeHtml(source) })}</small>`;
  }

  /**
   * The node's own settings, cut into the groups `renderNode` lays out: what
   * the question says, how it is answered, the rules about the answer, and
   * the technical fields folded away.
   *
   * Ungrouped first, in declaration order, cut into the node's own groups
   * where `group` changes (`content` when unnamed). Then `validation`
   * under its heading, then `advanced` as a fold — *Spara svaret som*, *Variabeletikett*,
   * *CSS-klasser*. They stood second, third and last among the loose fields, so
   * the three boxes a redaktör fills on every question were separated by three
   * they set once or never (uppdrag 23/9 2026, punkt 4).
   *
   * **Closed by default, and it stays closed even when the variable is used.**
   * The first build opened the fold by itself whenever one of its fields held a
   * value. Johan turned that down 23/9 2026: *"Automatisk öppning utifrån
   * innehållet gör panelen mindre förutsägbar och riskerar att åter ge nästan
   * alltid öppna grupper."* Almost every question in a real guide names its
   * answer, so the rule that was meant to protect one case unfolded the group
   * on nearly every node — which is the state the fold exists to end.
   *
   * What remains is the person's own choice, remembered for the session
   * (`advancedOpen`), and one exception that is a *navigation*, not a guess:
   * `focusField` unfolds the group when somebody is sent to a fault inside it.
   *
   * An empty section is not drawn: a capability that is off can leave every rule
   * hidden, and a heading over nothing reads as something broken.
   */
  private renderPropertyList(
    node: FlowNodeData,
    properties: NodePropertyDefinition[],
  ): { groups: Array<{ name: string; html: string }>; validation: string; advanced: string } {
    const allowed = properties
      .filter(
        (property) =>
          !property.requiredCapability ||
          this.capabilitiesValue[
            property.requiredCapability as keyof typeof this.capabilitiesValue
          ],
      )
      .filter((property) => gateOpen(property, node, this.guideNodesValue));
    const draw = (property: NodePropertyDefinition): string =>
      this.renderProperty(node, this.localizeProperty(node, property));

    /*
     * A rule's `fallbackLabel` is drawn by its cases, as the *Annars* card
     * last in their list (`renderRuleCasesProperty`) — not a second time here.
     */
    const loose = allowed.filter(
      (property) => !property.section && !(node.type === "rule" && property.id === "fallbackLabel"),
    );
    const validation = allowed.filter((property) => property.section === "validation");
    const advanced = allowed.filter((property) => property.section === "advanced");
    const template = this.renderTemplateChoice(node);

    return {
      groups: runs(loose).map((run) => ({ name: run.name, html: run.properties.map(draw).join("") })),
      validation:
        validation.length > 0
          ? `
        <section class="properties-panel__section properties-panel__group" data-panel-group="validation" data-property-section="validation">
          <h3>${this.text("editor.properties.validation-heading")}</h3>
          ${validation.map(draw).join("")}
          ${this.renderValidationTryout(node)}
        </section>
      `
          : "",
      /*
       * *Mall* sits in the fold with the other settings set once or never
       * (Astra 1/10 2026, bilaga 11). It only names where the node came
       * from, so a node with a template and no advanced field still gets the
       * fold — otherwise the template would have nowhere to be.
       */
      advanced:
        advanced.length > 0 || template
          ? `
        <details class="properties-panel__advanced" data-panel-group="advanced" data-property-section="advanced"
          ${this.advancedOpen ? "open" : ""}>
          <summary>
            <h3>${this.text("editor.properties.advanced-heading")}</h3>
          </summary>
          <div class="properties-panel__advanced-fields">${advanced.map(draw).join("")}${template}</div>
        </details>
      `
          : "",
    };
  }

  /**
   * A box for trying the rules on a value.
   *
   * Only where there is something to try: a field with no rule would answer
   * "godkänns" to everything, which teaches the opposite of what this is for.
   *
   * Nothing typed here reaches the guide. It is a question asked of the rules.
   */
  private renderValidationTryout(node: FlowNodeData): string {
    const rules = ["required", "minLength", "maxLength", "format", "pattern", "min", "max"];
    const hasRule = rules.some((name) => {
      const value = node.data[name];

      return value !== undefined && value !== "" && value !== false && value !== 0;
    });

    if (!hasRule) {
      return "";
    }

    return `
      <div class="properties-panel__field properties-panel__tryout">
        <label for="validation-tryout">${this.text("editor.properties.tryout-label")}</label>
        <input type="text" id="validation-tryout" data-validation-tryout
          placeholder="${escapeHtml(this.text("editor.properties.tryout-placeholder"))}">
        <p class="properties-panel__tryout-verdict" data-validation-verdict role="status" aria-live="polite"></p>
        <small class="properties-panel__help">${escapeHtml(
          this.text("editor.properties.tryout-help"),
        )}</small>
      </div>
    `;
  }

  /**
   * Answers the try-it box, using the service the page itself uses.
   *
   * Not a second implementation. `format` was silently dropped for fields on a
   * page once already, and a box with its own copy of the rules would have gone
   * on saying "godkänns" throughout.
   */
  private answerTryout(input: HTMLInputElement, node: FlowNodeData): void {
    const verdict = this.root.querySelector<HTMLElement>("[data-validation-verdict]");

    if (!verdict) {
      return;
    }

    const value = input.value;

    if (value === "") {
      verdict.textContent = "";
      delete verdict.dataset.state;
      return;
    }

    const field = PageFieldsService.fieldFor(node, this.uiLocale);
    const message = PageFieldValidationService.getMessage(field, value, this.uiLocale);

    verdict.textContent = message ?? this.text("editor.properties.tryout-passes");
    verdict.dataset.state = message ? "fel" : "ok";
  }

  private renderProperty(
    node: FlowNodeData,
    property: NodePropertyDefinition
  ): string {
    const value = node.data[property.id];

    switch (property.control) {
      case "text": {
        const { shownValue, source, showSource, locked } = this.localizedField(
          property,
          value
        );
        const rich = (property.formatting ?? []).includes("variable")
          ? this.richTextField(property, shownValue, { features: property.formatting ?? [], multiline: false, placeholder: showSource ? source : "", locked })
          : null;

        if (rich !== null && rich.field) {
          return '<div class="properties-panel__field">'
            + '<label for="property-' + escapeHtml(property.id) + '">' + escapeHtml(property.label) + '</label>'
            + rich.field
            + (showSource ? this.sourceReference(source) : "")
            + (property.description ? '<small class="properties-panel__help">' + escapeHtml(property.description) + '</small>' : "")
            + '</div>';
        }

        return `
          <div class="properties-panel__field">
            <label for="property-${escapeHtml(property.id)}">
              ${escapeHtml(property.label)}
            </label>

            ${this.withVariableMenu(
              `<input
              id="property-${escapeHtml(property.id)}"
              type="text"
              value="${escapeHtml(shownValue)}"
              ${showSource ? `placeholder="${escapeHtml(source)}"` : ""}
              data-property="${escapeHtml(property.id)}"
              ${locked ? "disabled" : ""}${this.fieldDirection(property)}
            />`,
              this.variableMenu(
                escapeHtml(property.id),
                (property.formatting ?? []).includes("variable"),
                locked ? " disabled" : "",
              ),
            )}
            ${rich?.textMode ?? ""}
            ${showSource ? this.sourceReference(source) : ""}
            ${property.description ? `
              <small class="properties-panel__help">
                ${escapeHtml(property.description)}
              </small>
            ` : ""}
          </div>
        `;
      }

      case "textarea": {
        /*
         * Through `localizedField`, as the text fields go (uppdrag 28/9, Del
         * 1). The value was written straight in — `escapeHtml(value)` — and a
         * localized one is `{ sv, en }`, so *Varför frågar vi det här?* and
         * *Anteckning* read `[object Object]`. The write path already merges
         * the active language into the map, so the first edit made the text
         * `[object Object]` in Swedish and kept the English beside it.
         */
        const { shownValue, source, showSource, locked } = this.localizedField(property, value);

        return `
          <div class="properties-panel__field">
            <label for="property-${escapeHtml(property.id)}">
              ${escapeHtml(property.label)}
            </label>

            <textarea
              id="property-${escapeHtml(property.id)}"
              rows="4"
              data-property="${escapeHtml(property.id)}"
              ${showSource ? `placeholder="${escapeHtml(source)}"` : ""}
              ${locked ? "disabled" : ""}${this.fieldDirection(property)}
            >${escapeHtml(shownValue)}</textarea>
            ${showSource ? this.sourceReference(source) : ""}
          </div>
        `;
      }

case "template-text":
      case "template-textarea":
      case "formatted-textarea": {
        const propertyId = escapeHtml(property.id);
        const isSingleLine = property.control === "template-text";
        const { shownValue, source, showSource, locked } = this.localizedField(
          property,
          value
        );
        const disabledAttr = locked ? " disabled" : "";
        const placeholderAttr = showSource
          ? ' placeholder="' + escapeHtml(source) + '"'
          : "";
        const dirAttr = this.fieldDirection(property);
        const field = isSingleLine
          ? '<input id="property-' + propertyId + '" type="text" value="' + escapeHtml(shownValue) + '"' + placeholderAttr + ' data-property="' + propertyId + '"' + disabledAttr + dirAttr + '>'
          : '<textarea id="property-' + propertyId + '" rows="8" data-property="' + propertyId + '"' + disabledAttr + dirAttr + '>' + escapeHtml(shownValue) + '</textarea>';
        const features = property.formatting ?? [];
        const allowVariablesHere = property.control.startsWith("template-") || features.includes("variable");
        /*
         * One line where the viewer draws one: a single-line control, and a
         * title — `guide-preview` draws every title inline (`formatTitle`),
         * the consent box's link-bearing one included.
         */
        const rich = this.richTextField(property, shownValue, {
          features: allowVariablesHere && !features.includes("variable") ? [...features, "variable"] : features,
          multiline: !isSingleLine && property.id !== "title",
          placeholder: showSource ? source : "",
          locked,
        });

        if (rich.field) {
          return '<div class="properties-panel__field">'
            + '<label for="property-' + propertyId + '">' + escapeHtml(property.label) + '</label>'
            + rich.field
            + (showSource ? this.sourceReference(source) : "")
            + (property.description ? '<small class="properties-panel__help">' + escapeHtml(property.description) + '</small>' : "")
            + '</div>';
        }

        const buttonLabels: Record<string, string> = {
          bold: this.text("editor.properties.format-bold"),
          italic: this.text("editor.properties.format-italic"),
          link: this.text("editor.properties.format-link"),
          "bullet-list": this.text("editor.properties.format-bullet-list"),
          "numbered-list": this.text("editor.properties.format-numbered-list"),
        };
        const toolbar = features
          .filter((feature) => feature !== "variable")
          .map((feature) => '<button type="button" data-format-action="' + feature + '" data-format-target="' + propertyId + '"' + disabledAttr + '>' + buttonLabels[feature] + '</button>')
          .join("");
        const allowVariables = property.control.startsWith("template-") || features.includes("variable");
        const variableMenu = this.variableMenu(propertyId, allowVariables, disabledAttr);
        /*
         * Var knappen hamnar följer fältets form, som Johan bad om: bredvid
         * enradsfältet, ovanför textytan. En textyta har redan en rad med
         * formateringsknappar ovanför sig, och knappen hör hemma där — en
         * andra rad för en ensam knapp vore en rad till att förklara.
         */
        const toolbarRow = (toolbar || (!isSingleLine && variableMenu))
          ? '<div class="properties-panel__format-toolbar" role="toolbar" aria-label="' + this.text("editor.properties.format-text") + '">' + toolbar + (isSingleLine ? "" : variableMenu) + '</div>'
          : "";
        const fieldRow = isSingleLine ? this.withVariableMenu(field, variableMenu) : field;
        return '<div class="properties-panel__field">'
          + '<label for="property-' + propertyId + '">' + escapeHtml(property.label) + '</label>'
          + toolbarRow
          + fieldRow
          + rich.textMode
          + (showSource ? this.sourceReference(source) : "")
          + (property.description ? '<small class="properties-panel__help">' + escapeHtml(property.description) + '</small>' : "")
          + '</div>';
      }
      case "number":
        return `
          <div class="properties-panel__field">
            <label for="property-${escapeHtml(property.id)}">
              ${escapeHtml(property.label)}
            </label>

            <input
              id="property-${escapeHtml(property.id)}"
              type="number"
              value="${escapeHtml(value ?? "")}"
              data-property="${escapeHtml(property.id)}"
              data-value-type="number"
            />
            ${property.description ? `<small class="properties-panel__help">${escapeHtml(property.description)}</small>` : ""}
          </div>
        `;

      case "checkbox":
        return `
          <div class="properties-panel__field">
            <label class="properties-panel__switch">
              <input
                type="checkbox"
                role="switch"
                data-property="${escapeHtml(property.id)}"
                data-value-type="boolean"
                ${value === true ? "checked" : ""}
              />

              ${escapeHtml(property.label)}
            </label>
            ${property.description ? `<small class="properties-panel__help">${escapeHtml(property.description)}</small>` : ""}
          </div>
        `;

      case "select":
        return `
          <div class="properties-panel__field">
            <label for="property-${escapeHtml(property.id)}">
              ${escapeHtml(property.label)}
            </label>

            <span class="properties-panel__select"><select
              id="property-${escapeHtml(property.id)}"
              data-property="${escapeHtml(property.id)}"
            >
              ${(typeof property.options === "function"
                ? property.options(node.data)
                : (property.options ?? []))
                .map(
                  (option) => `
                    <option
                      value="${escapeHtml(option.value)}"
                      ${option.value === value ? "selected" : ""}
                      ${option.disabled ? "disabled" : ""}
                    >
                      ${escapeHtml(option.label)}
                    </option>
                  `
                )
                .join("")}
            </select></span>
          </div>
        `;
      case "node-select":
        return `
          <div class="properties-panel__field">
            <label for="property-${escapeHtml(property.id)}">
              ${escapeHtml(property.label)}
            </label>

            <span class="properties-panel__select"><select
              id="property-${escapeHtml(property.id)}"
              data-property="${escapeHtml(property.id)}"
            >
              <option value="" ${value ? "" : "selected"}>${escapeHtml(this.text("editor.properties.node-select-none"))}</option>
              ${this.nodeOptionsValue
                .map(
                  (option) => `
                    <option value="${escapeHtml(option.id)}" ${option.id === value ? "selected" : ""}>
                      ${escapeHtml(option.label)}
                    </option>
                  `
                )
                .join("")}
            </select></span>
          </div>
        `;
      /*
       * Same shape as node-select, but reads `variableOptionsValue` — the
       * guide's variables (measured from the template-text variable picker,
       * the only other place a graph's variables reach a select). A stale
       * saved value (a variable since removed) gets no `selected` match and
       * so shows as unchosen, but is never overwritten here: nothing writes
       * to the node's data until the field actually fires a change. The
       * health check (`broken-email-copy`) is what flags it.
       */
      case "recipient-list": {
        /*
         * Mottagarna i samma kontroll som allt annat man väljer flera av.
         *
         * Den byggdes här först, med en `<select>` som adderare och egna
         * knappar som tar bort — och sedan byggdes samma sak i visaren, och en
         * tredje gång som värdefält för ett villkor. Nu är det `chip-picker`
         * överallt, och panelen slapp sitt eget maskineri för uppläsning,
         * fokus efter borttagning och sök.
         *
         * Kvar av det gamla resonemanget: inte kryssrutor. En katalog kan vara
         * lång, och det VALDA ska gå att läsa utan att man skannar efter bockar.
         *
         * Katalogens beskedrad följer med (uppdrag 2026-08-27 C): är ingen
         * mottagare registrerad säger fältet det i klartext i stället för att
         * se tomt ut. En tom lista går inte att skilja från en trasig.
         */
        const chosen = readIdList(
          value,
          property.id === "recipientIds" ? this.nodeDataValue?.data.recipientId : undefined,
        );
        const catalog = typeof property.options === "function" ? property.options(node.data) : property.options ?? [];
        const notice = catalog.find((one) => one.disabled === true);
        const known = catalog.filter((one) => one.value !== "" && !one.disabled);
        /*
         * Ett id som katalogen inte längre känner till står kvar som ett eget
         * alternativ, märkt — annars hade etiketten visat ett id, eller
         * försvunnit och ändrat guiden bakom ryggen på den som byggt den.
         */
        const gone = chosen
          .filter((id) => !known.some((one) => one.value === id))
          .map((id) => ({
            value: id,
            label: `${id} — ${this.text("editor.properties.recipient-gone")}`,
          }));
        /*
         * Katalogen följer med i markupen. Egenskapsdefinitionerna når inte
         * kopplingen — de är ett argument till renderaren — och att träda dem
         * genom klassen vore mer kod än att lämna listan där den ändå ritas.
         */
        const labelId = `label-${property.id}`;

        return `
          <div class="properties-panel__field">
            <span class="properties-panel__label" id="${escapeHtml(labelId)}">
              ${escapeHtml(property.label)}
            </span>

            <chip-picker
              data-recipient-picker="${escapeHtml(property.id)}"
              data-recipient-options="${escapeHtml(JSON.stringify([...known, ...gone]))}"
              label="${escapeHtml(property.label)}"
            ></chip-picker>

            ${notice ? `<p class="properties-panel__status">${escapeHtml(notice.label)}</p>` : ""}

            <input
              type="hidden"
              data-property="${escapeHtml(property.id)}"
              data-value-type="list"
              value="${escapeHtml(JSON.stringify(chosen))}"
            >
            ${property.description ? `
              <small class="properties-panel__help">
                ${escapeHtml(property.description)}
              </small>
            ` : ""}
          </div>
        `;
      }
      case "variable-select": {
        /*
         * Filtret kommer ur nodtypen: `variableFilter: { format: "email" }`
         * betyder frågor som kan innehålla en e-postadress. Utan det listade
         * fältet varenda variabel i guiden, och mejlkopian gick att peka på
         * "Beskriv felet" — ett fel som syns först när en besökare inte får
         * sitt kvitto (story 054).
         */
        const filter = property.variableFilter;
        const matching = filter
          ? this.variableOptionsValue.filter((option) => option.format === filter.format)
          : this.variableOptionsValue;

        /*
         * Ett redan valt värde står kvar även när det inte längre matchar —
         * frågan kan ha bytt format eller tagits bort. Att tyst nolla valet
         * skulle ta bort mejlkopian utan spår; nu ser redaktören vad som hänt.
         */
        const chosen = typeof value === "string" ? value : "";
        /*
         * The rows, under the name every other chooser gives a variable. The
         * row for a value that no longer matches is not one of the guide's
         * variables, so it says in words what happened instead.
         */
        const rows = [
          ...matching.map((option) => ({
            value: option.value,
            text: QuestionVariableService.getDisplayName(option),
          })),
          ...(chosen && !matching.some((option) => option.value === chosen)
            ? [{
                value: chosen,
                text: `${chosen} — ${this.text("editor.properties.variable-gone")}`,
              }]
            : []),
        ];

        /*
         * Inget att välja på: en tom lista går inte att skilja från en trasig,
         * så väljaren stängs av och SÄGER vad som saknas. Samma mönster som
         * mottagarväljaren använder när ingen katalog är registrerad.
         */
        const empty = rows.length === 0;

        return `
          <div class="properties-panel__field">
            <label for="property-${escapeHtml(property.id)}">
              ${escapeHtml(property.label)}
            </label>

            <span class="properties-panel__select"><select
              id="property-${escapeHtml(property.id)}"
              data-property="${escapeHtml(property.id)}"
              ${empty ? "disabled" : ""}
            >
              ${empty ? `<option value="" selected>${escapeHtml(this.text("editor.properties.no-email-question"))}</option>` : `
              <option value="" disabled ${value ? "" : "selected"}>${escapeHtml(this.text("editor.properties.select-variable"))}</option>`}
              ${rows
                .map(
                  (row) => `
                    <option value="${escapeHtml(row.value)}" ${row.value === value ? "selected" : ""}>
                      ${escapeHtml(row.text)}
                    </option>
                  `
                )
                .join("")}
            </select></span>
            ${property.description ? `
              <small class="properties-panel__help">
                ${escapeHtml(property.description)}
              </small>
            ` : ""}
          </div>
        `;
      }
      case "map-start": {
        /*
         * Startvyn väljs genom samma leverantörsdialog som invånaren ser —
         * redaktören pekar, geometrin och etiketten lagras ihop som JSON i
         * egenskapen. Utan leverantör finns ingen död knapp att undra över:
         * ett besked, samma princip som visarens golv.
         */
        const provider = getMapProvider();
        const stored = typeof value === "string" && value ? value : "";
        let storedLabel = "";

        try {
          storedLabel = stored ? (JSON.parse(stored) as { label?: string }).label ?? "" : "";
        } catch {
          storedLabel = "";
        }

        return `
          <div class="properties-panel__field">
            <label id="map-start-label-${escapeHtml(property.id)}">
              ${escapeHtml(property.label)}
            </label>
            ${
              provider?.kinds.includes("point")
                ? `
                  <p class="properties-panel__map-start-status" data-map-start-status>
                    ${escapeHtml(storedLabel || this.text("editor.properties.mapStart.none"))}
                  </p>
                  <div class="properties-panel__map-start-actions">
                    <button
                      type="button"
                      data-map-start-pick
                      data-map-start-property="${escapeHtml(property.id)}"
                      aria-describedby="map-start-label-${escapeHtml(property.id)}"
                    >${escapeHtml(this.text("editor.properties.mapStart.pick"))}</button>
                    <button
                      type="button"
                      data-map-start-clear
                      data-map-start-property="${escapeHtml(property.id)}"
                      ${stored ? "" : "hidden"}
                    >${escapeHtml(this.text("editor.properties.mapStart.clear"))}</button>
                  </div>
                `
                : `<p class="properties-panel__map-start-status">${escapeHtml(this.text("editor.properties.mapStart.noProvider"))}</p>`
            }
            <input type="hidden" data-property="${escapeHtml(property.id)}" value="${escapeHtml(stored)}">
          </div>
        `;
      }
      case "options":
        return this.renderOptionsProperty(property, value);
      case "rating-labels":
        return this.renderRatingLabels(property);
      case "rule-cases":
        return this.renderRuleCasesProperty(node, property, value);
      case "calculation-assignments":
        return this.renderCalculationAssignments(property, value);
      case "submission-row":
        return this.renderSubmissionRow(property, value);
      case "request-variables":
        return this.renderRequestVariables(property, value);
      case "response-mappings":
        return this.renderResponseMappings(property, value);
      case "annotations":
        return this.renderAnnotations(property, value);
    }
  }

  private getComments() {
    return AnnotationCommentsService.parse(this.nodeDataValue?.data.comments);
  }

  private setComments(
    comments: ReturnType<typeof AnnotationCommentsService.parse>,
    rerender = true
  ): void {
    if (!this.nodeDataValue) return;
    this.nodeDataValue.data.comments = comments;
    this.dispatchNodeDataChange("comments", comments);
    if (rerender) this.render();
  }

  private updateAnnotation(field: HTMLInputElement | HTMLSelectElement): void {
    const id = field.closest<HTMLElement>("[data-annotation-id]")?.dataset
      .annotationId;
    const property = field.dataset.annotationProperty as
      | "text"
      | "x"
      | "y"
      | "arrow"
      | undefined;
    if (!id || !property) return;
    // Text/number update without a re-render (keep focus); selects re-render.
    this.setComments(
      AnnotationCommentsService.update(
        this.getComments(),
        id,
        property,
        field.value,
        this.activeLocaleValue,
      ),
      property === "arrow"
    );
  }

  private renderAnnotations(
    property: NodePropertyDefinition,
    value: unknown
  ): string {
    const comments = AnnotationCommentsService.parse(value);
    const arrowGlyph: Record<string, string> = {
      up: "↑",
      down: "↓",
      left: "←",
      right: "→",
    };
    const rows = comments
      .map(
        (comment, index) => `
          <div class="properties-panel__annotation" data-annotation-id="${escapeHtml(comment.id)}">
            <div class="properties-panel__annotation-head">
              <strong>${index + 1}</strong>
              <button type="button" class="properties-panel__remove-option" data-action="remove-annotation" aria-label="${escapeHtml(this.text("editor.properties.remove-comment"))}">×</button>
            </div>
            <input type="text" value="${escapeHtml(resolveText(comment.text, this.activeLocaleValue, "", this.sourceLocaleValue))}" data-annotation-property="text" placeholder="${escapeHtml(this.text("editor.properties.annotation-placeholder"))}">
            <div class="properties-panel__annotation-pos">
              <label>X% <input type="number" min="0" max="100" value="${comment.x}" data-annotation-property="x"></label>
              <label>Y% <input type="number" min="0" max="100" value="${comment.y}" data-annotation-property="y"></label>
              <label>${escapeHtml(this.text("editor.properties.annotation-arrow"))}
                <span class="properties-panel__select"><select data-annotation-property="arrow">
                  ${ARROW_DIRECTIONS.map(
                    (dir) => `<option value="${dir}" ${comment.arrow === dir ? "selected" : ""}>${arrowGlyph[dir]}</option>`
                  ).join("")}
                </select></span>
              </label>
            </div>
          </div>
        `
      )
      .join("");

    const imageUrl =
      typeof this.nodeDataValue?.data.imageUrl === "string"
        ? this.nodeDataValue.data.imageUrl.trim()
        : "";
    const canvas = imageUrl
      ? `
        <div class="properties-panel__annotation-canvas" data-annotation-canvas>
          <img src="${escapeHtml(imageUrl)}" alt="">
          ${comments
            .map(
              (comment, index) => `
                <button
                  type="button"
                  class="properties-panel__annotation-pin"
                  data-annotation-pin
                  data-annotation-id="${escapeHtml(comment.id)}"
                  style="left:${comment.x}%;top:${comment.y}%"
                  aria-label="${escapeHtml(this.text("editor.properties.move-comment", { number: index + 1 }))}"
                >${index + 1}</button>
              `
            )
            .join("")}
        </div>
      `
      : "";

    return `
      <div class="properties-panel__field">
        <span>${escapeHtml(property.label)}</span>
        ${canvas}
        <div class="properties-panel__annotations">${rows}</div>
        ${this.renderAddButton('data-action="add-annotation"', escapeHtml(this.text("editor.properties.add-comment")))}
      </div>
    `;
  }

  private renderRequestVariables(
    property: NodePropertyDefinition,
    value: unknown
  ): string {
    const selected = new Set(
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
    );
    // The node's own outputs are not meaningful to send into the call.
    const produced = this.nodeDataValue
      ? new Set(ServiceCallService.getProducedVariables(this.nodeDataValue))
      : new Set<string>();
    const available = this.variableOptionsValue.filter(
      (option) => option.value.length > 0 && !produced.has(option.value)
    );

    /*
     * Samma kontroll som allt annat man väljer flera av.
     *
     * Det var kryssrutor: en spalt att skanna efter bockar, där det VALDA är
     * det svåraste att läsa. Med etiketter står det man valt först, och en
     * guide med många variabler slutar kräva att man rullar för att se vilka
     * som följer med i anropet.
     *
     * Aliaset först, namnet efter — som chipen på kortet (Johan 3/9:
     * "tjänstens frågor också"). Namnet stannar kvar: det är det ett anrop
     * skickar, och det redaktören känner igen i sin BFF. Utan alias står
     * namnet ensamt i stället för två gånger.
     */
    const body = available.length
      ? `<chip-picker
          data-request-picker
          data-request-options="${escapeHtml(JSON.stringify(available.map((one) => {
            const label = resolveText(one.label);
            return { label: label && label !== one.value ? `${label} — ${one.value}` : one.value, value: one.value };
          })))}"
          data-request-value="${escapeHtml(JSON.stringify([...selected]))}"
          label="${escapeHtml(property.label)}"
        ></chip-picker>`
      : `<p class="properties-panel__help">${this.text("editor.properties.no-variables-to-send")}</p>`;

    return `
      <div class="properties-panel__field">
        <span>${escapeHtml(property.label)}</span>
        ${body}
        ${property.description ? `<small class="properties-panel__help">${escapeHtml(property.description)}</small>` : ""}
      </div>
    `;
  }

  private renderResponseMappings(
    property: NodePropertyDefinition,
    value: unknown
  ): string {
    const mappings = ServiceCallService.parseMappings(value);

    return `
      <div class="properties-panel__field">
        <span>${escapeHtml(property.label)}</span>
        ${
          /*
           * The collection's help under its heading, before the rows, and the
           * add button directly after the last row (GRAFISK-PROFIL, *Var
           * tilläggshandlingen står*; Astra 30/9, E7). The help used to
           * stand after the button, so the button sat between the rows and
           * what they were for.
           */
          property.description ? `<small class="properties-panel__help">${escapeHtml(property.description)}</small>` : ""
        }
        <div class="properties-panel__options">
          ${mappings
            .map(
              (item, index) => {
                // K4: the arrows are named for the row they move, in the
                // option cards' words — the glyph alone read "uppåtpil".
                const heading = this.text("editor.properties.row-n", { number: index + 1 });
                return `
                <section class="properties-panel__option" data-mapping-id="${escapeHtml(item.id)}">
                  <div class="properties-panel__option-header">
                    <strong>${heading}</strong>
                    <div class="properties-panel__option-order">
                      <button type="button" data-action="move-mapping-up" ${index === 0 ? "disabled" : ""}
                        aria-label="${this.text("editor.properties.move-option-up", { label: heading })}">↑</button>
                      <button type="button" data-action="move-mapping-down" ${index === mappings.length - 1 ? "disabled" : ""}
                        aria-label="${this.text("editor.properties.move-option-down", { label: heading })}">↓</button>
                    </div>
                  </div>
                  <label>
                    ${this.text("editor.properties.response-field")}
                    <input type="text" value="${escapeHtml(item.field)}" data-mapping-property="field" placeholder="${this.text("editor.properties.response-field-placeholder")}">
                  </label>
                  <label>
                    ${this.text("editor.properties.variable")}
                    <input type="text" value="${escapeHtml(item.variableName)}" data-mapping-property="variableName" placeholder="${this.text("editor.properties.mapping-variable-placeholder")}">
                  </label>
                  ${this.rowLabelField(item.label, 'data-mapping-property="label"')}
                  ${this.renderCardRemove('data-action="remove-mapping"', this.text("editor.properties.remove-row"))}
                </section>
              `;
            }
            )
            .join("")}
        </div>
        ${this.renderAddButton('data-action="add-mapping"', this.text("editor.properties.add-field"))}
      </div>
    `;
  }

  private renderCalculationAssignments(
    property: NodePropertyDefinition,
    value: unknown
  ): string {
    const assignments = CalculationService.parseAssignments(value);

    const inTranslation = this.isTranslationMode();

    /*
     * Cards, as the answer options and the rules (uppdrag 29/9 Del A, Astra
     * §7). The head names the row by its label, else its variable, else a
     * fallback — the label is what a redaktör called it, the variable what a
     * formula calls it. In the body the label comes first (it is the row's
     * name field, and a new row's cursor lands there), then the variable as a
     * plain text field, then the formula — two separate fields: typing a
     * label never touches the name.
     *
     * The formula is a growing text box until Del C puts the formula field
     * with variable chips in its place (same `data-assignment-property`).
     */
    return `
      <div class="properties-panel__field">
        <div class="properties-panel__options-heading"><h3>${escapeHtml(property.label)}</h3></div>
        <p class="properties-panel__options-hint" data-assignment-order>${this.text("editor.properties.assignments-order")}</p>
        <div class="properties-panel__options">
          ${assignments
            .map((item, index) => {
              const label = inTranslation && isLocalizedTextMap(item.label)
                ? item.label[this.activeLocaleValue] ?? ""
                : resolveText(item.label, this.sourceLocaleValue);
              const source = resolveText(item.label, this.sourceLocaleValue).trim();
              const title = escapeHtml(
                label.trim() || item.variableName.trim() || this.text("editor.properties.assignment-untitled"),
              );

              return this.renderCard({
                kind: "assignment",
                id: item.id,
                title,
                name: escapeHtml(source || item.variableName.trim() || this.text("editor.properties.assignment-untitled")),
                position: this.text("editor.properties.row-n", { number: index + 1 }),
                canMoveUp: index > 0,
                canMoveDown: index < assignments.length - 1,
                body: `
                  ${this.rowLabelField(item.label, 'data-assignment-property="label"')}
                  <label>
                    ${this.text("editor.properties.variable-name")}
                    <input type="text" value="${escapeHtml(item.variableName)}" data-assignment-property="variableName" placeholder="${this.text("editor.properties.assignment-variable-placeholder")}">
                  </label>
                  <label>
                    ${this.text("editor.properties.formula")}
                    <rich-text-field formula features="variable" value="${escapeHtml(item.formula)}" data-assignment-property="formula" label="${escapeHtml(this.text("editor.properties.formula"))}" placeholder="${escapeHtml(this.text("editor.properties.formula-placeholder"))}" editor-locale="${escapeHtml(this.uiLocale)}"></rich-text-field>
                  </label>
                  ${this.renderFormulaHelp()}
                  ${this.renderCardRemove('data-action="remove-assignment"', this.text("editor.properties.remove-calculation"))}
                `,
              });
            })
            .join("")}
        </div>
        ${this.renderAddButton('data-action="add-assignment"', this.text("editor.properties.add-calculation"))}
      </div>
    `;
  }

  /**
   * The formula help, directly under a row's formula (uppdrag 29/9 Del D,
   * Astra §10): a `<details>` closed from the start, so it can stay open and
   * be read while the formula beside it is written. It replaces the long
   * formula-language text that stood under the list.
   *
   * Only what `formula-evaluator.ts` parses — the functions it knows, a
   * decimal point or comma, semicolons between arguments. Each example is
   * plain formula text (`data-formula-example`), copied as it stands; the
   * test runs every one through the evaluator, so help and parser cannot
   * drift apart. The rarer functions and the dates fold away on their own.
   */
  private renderFormulaHelp(): string {
    const help = (key: string, params?: Record<string, string>): string => this.text(`editor.formulaHelp.${key}`, params);
    // An example is formula text the evaluator reads (the test runs each one).
    const code = (formula: string): string => `<code data-formula-example>${escapeHtml(formula)}</code>`;
    /*
     * Bild 04 (Astra 29/9): a function is its syntax on one line and what it
     * does on the next, a thin line between the functions — not a two-column
     * table, where the words wrapped beside a long syntax.
     */
    const functions = (rows: Array<[string, string, Record<string, string>?]>): string => `
      <dl class="properties-panel__formula-functions">
        ${rows.map(([syntax, key, params]) => `<div><dt><code>${escapeHtml(syntax)}</code></dt><dd>${help(key, params)}</dd></div>`).join("")}
      </dl>`;

    return `
      <details class="properties-panel__formula-help" data-formula-help>
        <summary>${help("summary")}</summary>
        <div class="properties-panel__formula-help-body">
          <section>
            <h4>${help("write")}</h4>
            <p>${help("write-text", { example: code("inkomst * 0.1") })}</p>
          </section>
          <section>
            <h4>${help("arithmetic")}</h4>
            <p class="properties-panel__formula-strip" aria-label="${escapeHtml(help("arithmetic-text"))}"><code aria-hidden="true">+ - * / ( )</code></p>
            <p>${help("example")}</p>
            <p class="properties-panel__formula-strip">${code("(pris - kontantinsats) / 12")}</p>
          </section>
          <section>
            <h4>${help("numbers")}</h4>
            <p>${help("numbers-decimals", { comma: code("0,1"), point: code("0.1") })}</p>
            <p>${help("numbers-separator", { example: code("min(pris; 500000)") })}</p>
          </section>
          <section>
            <h4>${help("common")}</h4>
            ${functions([
              ["round(x)", "round"],
              ["min(a; b)", "min"],
              ["max(a; b)", "max"],
              ["pow(bas; exponent)", "pow", { example: code("pow(2; 3)") }],
            ])}
          </section>
          <details>
            <summary>${help("more")}</summary>
            ${functions([
              ["floor(x)", "floor"],
              ["ceil(x)", "ceil"],
              ["abs(x)", "abs"],
              ["sqrt(x)", "sqrt"],
            ])}
            <p>${help("example")} ${code("floor(inkomst / 1000)")}</p>
          </details>
          <details>
            <summary>${help("dates")}</summary>
            ${functions([
              ["age(personnummer)", "age"],
              ["days(från; till)", "days"],
              ["idag", "today"],
            ])}
            <p>${help("example")} ${code("days(flytt; idag)")}</p>
          </details>
          <p class="properties-panel__formula-help-note">${help("footnote")}</p>
        </div>
      </details>`;
  }

  /**
   * The row the errand is in the receiver's list (story 092): one section
   * per column, drawn as the calculation rows are — heading and cell both
   * translatable, the cell with the mail body's bold/italic toolbar and the
   * variable button. The first column is pinned: the contract says the
   * first cell is the title, so the panel shows it and moves nothing above
   * it. The cell's textarea is addressed by `data-field-id` rather than
   * `data-property`, because it is part of a list value and not a property
   * of its own; `fieldFor` knows both.
   */
  private renderSubmissionRow(property: NodePropertyDefinition, value: unknown): string {
    const columns = RowColumnsService.parseColumns(value);
    const inTranslation = this.isTranslationMode();
    const features = (property.formatting ?? []).filter((feature) => feature !== "variable");
    const buttonLabels: Record<string, string> = {
      bold: this.text("editor.properties.format-bold"),
      italic: this.text("editor.properties.format-italic"),
    };

    const cellField = (item: RowColumn): string => {
      const fieldId = `row-cell-${item.id}`;
      const source = resolveText(item.cell, this.sourceLocaleValue);
      const shown = !inTranslation
        ? source
        : isLocalizedTextMap(item.cell) && typeof item.cell[this.activeLocaleValue] === "string"
          ? item.cell[this.activeLocaleValue]
          : "";
      const placeholder = inTranslation ? source : this.text("editor.properties.column-cell-placeholder");
      const cellFeatures = [...features, "variable" as const];

      /*
       * One line, as a cell in the receiver's list is — with bold, italic and
       * answers shown as they are (story 136). A cell the model cannot read
       * keeps the plain field and says why.
       */
      if (RichTextField.canEdit(shown, cellFeatures, false)) {
        return `
                  <div class="properties-panel__field">
                    <label for="${escapeHtml(fieldId)}">${this.text("editor.properties.column-cell")}</label>
                    <rich-text-field id="${escapeHtml(fieldId)}" data-column-property="cell" data-field-id="${escapeHtml(fieldId)}" features="${cellFeatures.join(",")}" value="${escapeHtml(shown)}" label="${escapeHtml(this.text("editor.properties.column-cell"))}" placeholder="${escapeHtml(placeholder)}" editor-locale="${escapeHtml(this.uiLocale)}" locale="${escapeHtml(this.activeLocaleValue)}"${this.contentDirection()}></rich-text-field>
                    ${inTranslation ? this.sourceReference(source) : ""}
                  </div>`;
      }

      const toolbar = features
        .map((feature) => `<button type="button" data-format-action="${feature}" data-format-target="${escapeHtml(fieldId)}">${buttonLabels[feature] ?? feature}</button>`)
        .join("");
      const menu = this.variableMenu(fieldId, true, "");

      return `
                  <div class="properties-panel__field">
                    <label for="${escapeHtml(fieldId)}">${this.text("editor.properties.column-cell")}</label>
                    ${toolbar || menu ? `<div class="properties-panel__format-toolbar" role="toolbar" aria-label="${this.text("editor.properties.format-text")}">${toolbar}${menu}</div>` : ""}
                    <textarea id="${escapeHtml(fieldId)}" rows="2" data-column-property="cell" data-field-id="${escapeHtml(fieldId)}" placeholder="${escapeHtml(placeholder)}"${this.contentDirection()}>${escapeHtml(shown)}</textarea>
                    <small class="properties-panel__help" data-text-mode>${escapeHtml(this.text("editor.properties.rich-text-text-mode"))}</small>
                    ${inTranslation ? this.sourceReference(source) : ""}
                  </div>`;
    };

    return `
      <div class="properties-panel__field">
        <span>${escapeHtml(property.label)}</span>
        ${property.description ? `<small class="properties-panel__help">${escapeHtml(property.description)}</small>` : ""}
        <div class="properties-panel__options">
          ${columns
            .map(
              (item, index) => {
                // K4: named for the column they move, as the mapping rows' are.
                const heading = index === 0 ? this.text("editor.properties.column-title") : this.text("editor.properties.column-n", { number: String(index + 1) });
                return `
                <section class="properties-panel__option" data-column-id="${escapeHtml(item.id)}">
                  <div class="properties-panel__option-header">
                    <strong>${heading}</strong>
                    <div class="properties-panel__option-order">
                      <button type="button" data-action="move-column-up" ${index <= 1 ? "disabled" : ""}
                        aria-label="${this.text("editor.properties.move-option-up", { label: heading })}">↑</button>
                      <button type="button" data-action="move-column-down" ${index === 0 || index === columns.length - 1 ? "disabled" : ""}
                        aria-label="${this.text("editor.properties.move-option-down", { label: heading })}">↓</button>
                    </div>
                  </div>
                  ${this.rowLabelField(item.label, 'data-column-property="label"', {
                    label: this.text("editor.properties.column-heading"),
                    placeholder: this.text("editor.properties.column-heading-placeholder"),
                  })}
                  ${cellField(item)}
                  ${this.renderCardRemove('data-action="remove-column"', this.text("editor.properties.remove-column"))}
                </section>
              `;
            }
            )
            .join("")}
        </div>
        ${this.renderAddButton('data-action="add-column"', this.text("editor.properties.add-column"))}
      </div>
    `;
  }

  /**
   * The rule's cases as cards, then *Lägg till regel*, then *Annars*
   * (uppdrag 29/9 Del A, Astra §2 and §6; the order is Astra's 30/9, the
   * profile's decision 13).
   *
   * Above the list stand the two still lines story 067 asks for: what a rule
   * is for (a path between steps — a field on its own page has "visas om"),
   * and that the first rule met wins. The second is the property's own
   * description, which stood under the list before.
   *
   * *Annars* is the `default` exit, named by `fallbackLabel` — a property of
   * its own, drawn here rather than in the loose list after the rules
   * (`renderPropertyList` leaves it out), so the outcome sits last in the
   * list it belongs to, after the add button. It has no head controls: it cannot move, has no
   * conditions and cannot be removed, so its content is simply shown. It
   * stands after the cards' container, not in it: the drag gesture puts the
   * cards back into that container in their new order, and Annars must
   * never be among them.
   */
  private renderRuleCasesProperty(
    node: FlowNodeData,
    property: NodePropertyDefinition,
    value: unknown
  ): string {
    const cases = RuleCasesService.parseCases(value);
    const advanced = this.capabilitiesValue.advancedRules;
    const fallbackLabel = typeof node.data.fallbackLabel === "string" ? node.data.fallbackLabel : "";

    return `
      <div class="properties-panel__field">
        <div class="properties-panel__options-heading"><h3>${escapeHtml(property.label)}</h3></div>
        <p class="properties-panel__options-hint" data-rule-scope>${this.text("editor.properties.ruleScope")}</p>
        ${property.description ? `<p class="properties-panel__options-hint" data-rule-order>${escapeHtml(property.description)}</p>` : ""}
        ${
          /*
           * Once, above the list, when any rule is affected (Astra §5) — not
           * in every card: each locked rule carries only its "Låst struktur"
           * mark (`renderConditions`).
           */
          !advanced && cases.some((item) => item.conditions.length > 1)
            ? `<p class="properties-panel__rule-locked" role="note">${this.text("editor.properties.rules-locked")}</p>`
            : ""
        }
        <div class="properties-panel__card-list">
        <div class="properties-panel__options">
          ${cases
            .map((item, index) => {
              const numbered = this.text("editor.properties.rule-n", { number: index + 1 });
              const named = item.label.trim();
              const title = escapeHtml(named || numbered);

              return this.renderCard({
                kind: "rule-case",
                id: item.id,
                className: "properties-panel__rule-branch",
                title,
                name: title,
                position: named ? numbered : null,
                canMoveUp: index > 0,
                canMoveDown: index < cases.length - 1,
                body: `
                  <label>
                    ${this.text("editor.properties.rule-name")}
                    <input type="text" value="${escapeHtml(item.label)}" data-rule-case-property="label">
                  </label>
                  ${this.renderConditions({
                    scope: "rule",
                    conditions: item.conditions,
                    match: item.match,
                    structure: advanced ? "open" : "locked",
                    variables: this.variableOptionsValue,
                  })}
                  ${advanced ? this.renderAddButton('data-action="add-rule-condition"', this.text("editor.properties.add-condition")) : ""}
                  ${this.renderCardRemove('data-action="remove-rule-case"', this.text("editor.properties.remove-rule"))}
                `,
              });
            })
            .join("")}
        </div>
        ${
          /*
           * Cards → Lägg till regel → Annars (Astra 30/9, the profile's
           * decision 13): the add button right after the collection it adds
           * to, and Annars last. It still inserts before Annars.
           *
           * With no rules the collection is empty, and the graphic profile's
           * empty variant takes the cards' place (Astra 30/9, attachment 4):
           * an instruction, then the same button tinted across the width —
           * instruction → Lägg till regel → Annars. The first rule turns it
           * back into the outline button.
           */
          cases.length === 0 ? `<p class="properties-panel__empty-hint" data-empty-hint>${this.text("editor.properties.empty-rules")}</p>` : ""
        }
        ${this.renderAddButton('data-action="add-rule-case"', this.text("editor.properties.add-rule"), cases.length === 0)}
        <section class="properties-panel__option properties-panel__option--card properties-panel__rule-otherwise" data-rule-otherwise>
          <div class="properties-panel__option-header">
            <strong class="properties-panel__option-title">${this.text("editor.properties.otherwise")}</strong>
          </div>
          <div class="properties-panel__option-body">
            <p class="properties-panel__options-hint">${this.text("editor.properties.otherwise-help")}</p>
            <label for="property-fallbackLabel">
              ${this.text("editor.properties.otherwise-name")}
              <input id="property-fallbackLabel" type="text" value="${escapeHtml(fallbackLabel)}" data-property="fallbackLabel">
            </label>
          </div>
        </section>
        </div>
      </div>
    `;
  }

  /**
   * Värdefältet, för båda ställen ett villkor skrivs.
   *
   * Regeln och sidfältets synlighet är samma fråga i två redigerare: samma
   * variabel, samma jämförelser, samma värde. Synligheten hade en egen
   * uppsättning med ett **rent textfält**, så i regeln valde man *Ja* ur en
   * lista och en timme senare skrev man `yes` för hand i samma editor.
   *
   * Det som skiljer är bara vilka attribut som bär datan, så det är dem den
   * här tar emot. Kontrollen och beteendet är ett.
   */
  /** Orden värdeväljaren använder — samma på båda ställen ett villkor skrivs. */
  private valuePickerStrings(): Record<string, string> {
    return {
      search: this.text("editor.properties.value-search"),
      searchLabel: this.text("editor.properties.value-search"),
      empty: this.text("editor.properties.select-value"),
      remove: this.text("editor.properties.value-remove"),
      added: this.text("editor.properties.value-added"),
      addedOne: this.text("editor.properties.value-added-one"),
      removed: this.text("editor.properties.value-removed"),
      removedOne: this.text("editor.properties.value-removed-one"),
      count: this.text("editor.properties.value-count"),
      oneLeft: this.text("editor.properties.value-one"),
      matches: this.text("editor.properties.value-matches"),
      oneMatch: this.text("editor.properties.value-one-match"),
      noMatches: this.text("editor.properties.value-none"),
      allChosen: this.text("editor.properties.recipient-all-chosen"),
    };
  }

  private renderValuePicker(
    condition: { id: string; value: string; variableName: string },
    single: boolean,
    names: { group: string; picker: string; field: string },
  ): string {
    // The variable rides on the group: the binder gives the picker its values from it.
    return `
      <div class="properties-panel__rule-values" ${names.group}="${escapeHtml(condition.id)}" data-condition-variable="${escapeHtml(condition.variableName)}">
        <chip-picker ${single ? "single" : ""} ${names.picker}></chip-picker>
        <input type="hidden" ${names.field} value="${escapeHtml(condition.value)}">
      </div>
    `;
  }

  private getVariableTypeLabel(type: VariableType): string {
    return type === "number"
      ? this.text("editor.properties.variable-type-number")
      : type === "choice"
        ? this.text("editor.properties.variable-type-choice")
        : this.text("editor.properties.variable-type-text");
  }

  private bindFormEvents(): void {
    /*
     * The try-it box, wired here and nowhere near `dispatchPropertyChange`: what
     * is typed into it is a question asked of the rules, never an edit to the
     * guide. It carries no `data-property` for that reason.
     */
    const tryout = this.root.querySelector<HTMLInputElement>("[data-validation-tryout]");
    const selected = this.nodeDataValue;

    if (tryout && selected) {
      tryout.addEventListener("input", () => this.answerTryout(tryout, selected));
    }

    /*
     * Mottagarlistan: väljaren lägger till, krysset tar bort, och båda skriver
     * genom det dolda fältet så att värdet färdas samma väg som varje annan
     * egenskap.
     */
    /*
     * Fokus överlever en borttagning.
     *
     * Knappen man tryckte på slutar existera vid omritningen, och utan hjälp
     * hamnar fokus på `<body>`: skärmläsaren tystnar mitt i en handling
     * användaren själv utförde. Den flyttas därför till nästa etiketts kryss,
     * eller till väljaren när den sista togs bort.
     *
     * Omritningen sker efter att noden uppdaterats, alltså inte i samma tick —
     * därför några försök innan vi ger upp i stället för en gissad väntan.
     */
    /*
     * Mottagarlistorna: kontrollen fylls, och det den säger skrivs som JSON i
     * det dolda fältet — samma väg in som varje annan egenskap tar.
     *
     * Panelen hade ~90 rader egna här för uppläsning, fokus efter en
     * borttagning och backsteg i väljaren. Kontrollen äger allt det nu, och
     * gör det likadant på de fyra ställen den används.
     */
    for (const picker of this.root.querySelectorAll<HTMLElement & {
      options: Array<{ label: string; value: string }>;
      value: string[];
      strings: Record<string, string>;
    }>("[data-recipient-picker]")) {
      const propertyId = picker.dataset.recipientPicker ?? "";
      const field = this.root.querySelector<HTMLInputElement>(
        `[data-property="${CSS.escape(propertyId)}"]`,
      );

      if (!field) continue;

      const valda: string[] = JSON.parse(field.value || "[]");
      const alternativ: Array<{ label: string; value: string }> = JSON.parse(
        picker.dataset.recipientOptions || "[]",
      );

      // The rule's picker, with its words swapped: every sentence names a
      // recipient, never a "value" (which "3 värden" under a list of
      // offices did, measured 3/9).
      picker.strings = {
        ...this.valuePickerStrings(),
        search: this.text("editor.properties.recipient-add"),
        searchLabel: this.text("editor.properties.recipient-add"),
        empty: this.text("editor.properties.recipient-add"),
        added: this.text("editor.properties.recipient-added"),
        addedOne: this.text("editor.properties.recipient-added-one"),
        removed: this.text("editor.properties.recipient-removed"),
        removedOne: this.text("editor.properties.recipient-removed-one"),
        count: this.text("editor.properties.recipient-count"),
        oneLeft: this.text("editor.properties.recipient-one"),
        allChosen: this.text("editor.properties.recipient-all-chosen"),
      };
      picker.options = alternativ;
      picker.value = valda;

      picker.addEventListener("chip-change", (event) => {
        const bärare = document.createElement("input");

        bärare.dataset.property = propertyId;
        bärare.dataset.valueType = "list";
        bärare.value = JSON.stringify(
          (event as CustomEvent<{ value: string[] }>).detail.value,
        );
        this.dispatchPropertyChange(bärare);
      });
    }

    const fields = this.root.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("[data-property]");

    fields.forEach((field) => {
      field.addEventListener("input", () => {
        this.dispatchPropertyChange(field);

        // A select holds no cursor either, so it may redraw the panel too.
        if (field instanceof HTMLSelectElement) {
          this.revealGatedProperties(field);
        }
      });

      /*
       * Markören sparas när fältet LÄMNAS.
       *
       * Ett klick i variabelknappen flyttar fokus redan vid `mousedown`, alltså
       * innan knappens `click` hinner läsa av något: vid den tidpunkten är
       * fältet inte längre aktivt och markeringen är inte längre dess. Att läsa
       * av i blur är det sista ögonblick då den fortfarande är redaktörens.
       */
      if (!(field instanceof HTMLSelectElement)) {
        field.addEventListener("blur", () => {
          const propertyId = field.dataset.property;

          if (!propertyId) return;

          this.selectionByProperty.set(propertyId, [
            field.selectionStart ?? field.value.length,
            field.selectionEnd ?? field.value.length,
          ]);
        });
      }

      if (field instanceof HTMLInputElement && field.type === "checkbox") {
        field.addEventListener("change", () => {
          this.dispatchPropertyChange(field);
          this.revealGatedProperties(field);
        });
      }
    });

    // Startvyn: leverantörens dialog fyller det dolda fältet, som bär värdet
    // samma väg som varje annan egenskap.
    this.root.querySelectorAll<HTMLButtonElement>("[data-map-start-pick]").forEach((button) => {
      button.addEventListener("click", async () => {
        const provider = getMapProvider();

        if (!provider) return;

        const propertyId = button.dataset.mapStartProperty ?? "";
        const hidden = this.root.querySelector<HTMLInputElement>(
          `input[type="hidden"][data-property="${propertyId}"]`,
        );

        if (!hidden) return;

        /*
         * Precis som svarsfältet: det redan valda följer med in, så dialogen
         * öppnar med nålen inritad och vald zoom — justera, inte rita om.
         */
        let stored: { geometry?: { type: string; coordinates: unknown }; zoom?: number } = {};

        try {
          stored = hidden.value ? JSON.parse(hidden.value) : {};
        } catch {
          stored = {};
        }

        const result = acceptPickResult(
          await provider.pick({ kind: "point", current: stored.geometry, zoom: stored.zoom }),
          "point",
        );

        if (!result) return;

        hidden.value = JSON.stringify(result);
        this.dispatchPropertyChange(hidden);

        // Panelen ritar inte om sig vid egna ändringar (fokus skulle tappas),
        // så status och Rensa-knappen uppdateras här; nästa rendering läser
        // samma sak ur det lagrade värdet.
        const status = this.root.querySelector<HTMLElement>("[data-map-start-status]");

        if (status) status.textContent = result.label;
        this.root
          .querySelector<HTMLButtonElement>(`[data-map-start-clear][data-map-start-property="${propertyId}"]`)
          ?.removeAttribute("hidden");
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-map-start-clear]").forEach((button) => {
      button.addEventListener("click", () => {
        const propertyId = button.dataset.mapStartProperty ?? "";
        const hidden = this.root.querySelector<HTMLInputElement>(
          `input[type="hidden"][data-property="${propertyId}"]`,
        );

        if (!hidden) return;

        hidden.value = "";
        this.dispatchPropertyChange(hidden);

        const status = this.root.querySelector<HTMLElement>("[data-map-start-status]");

        if (status) status.textContent = this.text("editor.properties.mapStart.none");
        button.setAttribute("hidden", "");
      });
    });

    this.bindGuideLocaleEvents();

    this.root
      .querySelector<HTMLDetailsElement>("[data-ui-texts]")
      ?.addEventListener("toggle", (event) => {
        this.uiTextsOpen = (event.target as HTMLDetailsElement).open;
      });

    // Same shape as the viewer texts above: the browser owns the folding, we
    // only remember which way it was left.
    this.root
      .querySelector<HTMLDetailsElement>('[data-property-section="advanced"]')
      ?.addEventListener("toggle", (event) => {
        this.advancedOpen = (event.target as HTMLDetailsElement).open;
      });

    this.root
      .querySelectorAll<HTMLInputElement>("[data-guide-string]")
      .forEach((field) => {
        field.addEventListener("input", () => {
          const key = field.dataset.guideString;
          if (!key) return;
          // Merge in the active language; empty text removes the language (→ default).
          const value = withLocale(this.guideStringsValue[key], this.activeLocaleValue, field.value);
          this.guideStringsValue = { ...this.guideStringsValue, [key]: value };
          this.dispatchEvent(
            new CustomEvent<GuideStringChangedDetail>("guide-string-changed", {
              detail: { key, value },
              bubbles: true,
              composed: true,
            })
          );
        });
      });

    this.root
      .querySelectorAll<HTMLInputElement>("[data-guide-progress]")
      .forEach((box) => {
        box.addEventListener("change", () => {
          this.guideProgressValue = box.checked;

          this.dispatchEvent(
            new CustomEvent<GuideSettingChangedDetail>("guide-setting-changed", {
              detail: { key: "progress", value: box.checked },
              bubbles: true,
              composed: true,
            })
          );
        });
      });

    this.root
      .querySelectorAll<HTMLInputElement>("[data-guide-meta]")
      .forEach((field) => {
        field.addEventListener("input", () => {
          const key = field.dataset.guideMeta as keyof GuideMeta | undefined;

          if (!key) {
            return;
          }

          // Name and description are translatable and merged in the active
          // language; the owner is a name or a mailbox and is not translated.
          const value =
            key === "owner"
              ? field.value
              : withLocale(
                  this.guideMetaValue[key],
                  this.activeLocaleValue,
                  field.value
                );

          this.guideMetaValue = { ...this.guideMetaValue, [key]: value };

          this.dispatchEvent(
            new CustomEvent<GuideMetaChangedDetail>("guide-meta-changed", {
              detail: { key, value },
              bubbles: true,
              composed: true,
            })
          );
        });
      });

    /*
     * The value pickers, in all three places a condition is written: the
     * picker is filled, and what it says is written into the hidden field
     * beside it and handed on the way a typed value is — one truth, not a
     * second way to update a condition. The field is read at the event, while
     * it is still in the tree: `closest` on it finds the condition's group.
     */
    for (const scope of Object.keys(CONDITION_SCOPES) as ConditionScope[]) {
      const names = CONDITION_SCOPES[scope];

      for (const group of this.root.querySelectorAll<HTMLElement>(`[${names.value}-group]`)) {
        const picker = group.querySelector<HTMLElement & {
          options: Array<{ label: string; value: string }>;
          value: string[];
          strings: Record<string, string>;
        }>(`[${names.value}-picker]`);
        const field = group.querySelector<HTMLInputElement>(`[${names.attr}-property="value"]`);

        if (!picker || !field) continue;

        picker.strings = this.valuePickerStrings();
        picker.options = this.variableOptionsValue.find(
          (one) => one.value === group.dataset.conditionVariable,
        )?.options ?? [];
        picker.value = field.value
          .split(",")
          .map((one) => one.trim())
          .filter((one) => one !== "");

        picker.addEventListener("chip-change", (event) => {
          field.value = (event as CustomEvent<{ value: string[] }>).detail.value.join(",");
          if (scope === "rule") this.updateRuleCondition(field);
          else if (scope === "visibility") this.updateVisibility(field);
          else this.updateOptionVisibility(field);
        });
      }
    }

    // A typed value is written as it is typed, without a redraw that would
    // take the cursor; the selects redraw on change (see `updateVisibility`).
    const typed = (field: Element): boolean =>
      field instanceof HTMLInputElement && (field.type === "text" || field.type === "number");

    this.root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-visibility-property]")
      .forEach((field) => {
        field.addEventListener("change", () => this.updateVisibility(field));
        if (typed(field)) field.addEventListener("input", () => this.updateVisibility(field, false));
      });

    this.root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-option-visibility-property]")
      .forEach((field) => {
        field.addEventListener("change", () => this.updateOptionVisibility(field));
        if (typed(field)) field.addEventListener("input", () => this.updateOptionVisibility(field, false));
      });

    this.root
      .querySelectorAll<HTMLButtonElement>('[data-action="remove-visibility-condition"], [data-action="remove-option-visibility-condition"]')
      .forEach((button) => {
        button.addEventListener("click", () => {
          const scope: ConditionScope = button.dataset.action === "remove-visibility-condition" ? "visibility" : "option-visibility";
          const id = button.closest<HTMLElement>(`[${CONDITION_SCOPES[scope].group}]`)?.getAttribute(CONDITION_SCOPES[scope].group);

          if (!id) return;
          const without = (visibility: ConditionalVisibility | undefined): ConditionalVisibility | undefined =>
            visibility && visibility.conditions.length > 1
              ? { ...visibility, conditions: visibility.conditions.filter((one) => one.id !== id) }
              : visibility;

          if (scope === "visibility") this.writeVisibility(without(this.nodeDataValue?.visibility));
          else this.writeOptionVisibility(button.dataset.optionId ?? "", without);
        });
      });

    this.bindTemplateChoice();
    this.root
      .querySelectorAll<HTMLSelectElement>("[data-layout-property]")
      .forEach((field) => {
        field.addEventListener("change", () => {
          if (!this.nodeDataValue) return;
          const columnSpan = Number(field.value) === 4 ? 4 : Number(field.value) === 6 ? 6 : 12;
          this.dispatchEvent(
            new CustomEvent<NodeLayoutChangedDetail>("node-layout-changed", {
              detail: { nodeId: this.nodeDataValue.id, columnSpan },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    this.root
      .querySelectorAll<HTMLInputElement>("[data-layout-break-before]")
      .forEach((field) => {
        field.addEventListener("change", () => {
          if (!this.nodeDataValue) return;
          this.dispatchEvent(
            new CustomEvent<NodeLayoutChangedDetail>("node-layout-changed", {
              detail: { nodeId: this.nodeDataValue.id, breakBefore: field.checked },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-order-move]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          if (!this.nodeDataValue) return;
          const direction = button.dataset.orderMove === "up" ? "up" : "down";
          this.dispatchEvent(
            new CustomEvent<NodeOrderChangedDetail>("node-order-changed", {
              detail: { nodeId: this.nodeDataValue.id, direction },
              bubbles: true,
              composed: true,
            })
          );
        });
      });

    const optionFields = this.root.querySelectorAll<HTMLInputElement>(
      "[data-option-property]"
    );

    optionFields.forEach((field) => {
      field.addEventListener("input", () => {
        this.dispatchOptionChange(field);
      });
    });

this.root
      .querySelectorAll<HTMLButtonElement>("[data-format-action]")
      .forEach((button) => {
        button.addEventListener("click", async () => {
          const propertyId = button.dataset.formatTarget;
          const action = button.dataset.formatAction;
          if (!propertyId || !action) return;
          const field = this.fieldFor(propertyId);
          if (!field) return;
          const start = field.selectionStart ?? field.value.length;
          const end = field.selectionEnd ?? start;
          const selected = field.value.slice(start, end);
          let replacement = selected;
          if (action === "bold") replacement = "**" + (selected || this.text("editor.properties.bold-placeholder-text")) + "**";
          if (action === "italic") replacement = "*" + (selected || this.text("editor.properties.italic-placeholder-text")) + "*";
          if (action === "link") {
            /*
             * The host's picker when one is registered (story 100): the
             * editor chooses a page instead of pasting its address. The
             * selected text stays the link's text — it is the editor's
             * word; the page's title fills in only when nothing was
             * selected. A cancelled pick inserts nothing, and focus comes
             * back to the field either way: the dialog is the host's, the
             * return is ours. No picker: today's placeholder, exactly.
             */
            const picker = getLinkPicker();
            const picked = picker
              ? await picker.pick({ locale: this.activeLocaleValue, selectedText: selected })
              : undefined;

            if (picked === null) {
              field.focus();
              return;
            }

            const label = selected || picked?.label || this.text("editor.properties.link-placeholder-text");
            const target = picked ? joinLinkTarget(picked.url, picked.ref) : "https://";

            replacement = "[" + label + "](" + target + ")";
          }
          if (action === "bullet-list") {
            replacement = (selected || this.text("editor.properties.list-item-placeholder")).split("\n").map((line) => "- " + line).join("\n");
          }
          if (action === "numbered-list") {
            replacement = (selected || this.text("editor.properties.list-item-placeholder")).split("\n").map((line, index) => (index + 1) + ". " + line).join("\n");
          }
          field.setRangeText(replacement, start, end, "select");
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.focus();
        });
      });
    // Only answers set before this node: a chip naming a later one would
    // always print empty, so it is not offered, and one already in the text
    // shows as missing — kept, never dropped (136).
    const setHere = this.answersSetHereValue;
    const offered = this.variablesAvailableHere().filter((option) => !setHere || setHere.has(option.value));

    this.root.querySelectorAll<RichTextField>("rich-text-field:not([formula])").forEach((field) => {
      field.variables = offered.map((option) => ({
        value: option.value,
        label: resolveText(option.label),
        computed: option.computed,
      }));
      field.knownVariables = offered.map((option) => option.value);
    });
    /*
     * A formula (story 139) is offered what the calculation's own hint has
     * always listed — every variable the panel knows here, the node's own
     * rows included, so a row may read an earlier one. Not the text fields'
     * "set before this node" list: a calculation's rows are set here, and
     * the health check, not the menu, says when a row reads too late.
     */
    /*
     * Bild 05 (Astra 29/9): the menu's first group is *Uträkningar*, this
     * node's own rows first — the ones a row most often reads — then other
     * calculations' results, then the answers. Order only; what is offered
     * is unchanged.
     */
    const ownRows = new Set(
      this.nodeDataValue?.type === "calculation"
        ? CalculationService.parseAssignments(this.nodeDataValue.data.assignments).map((row) => row.variableName.trim())
        : [],
    );
    const forFormulas = this.variableOptionsValue
      .filter((option) => option.value.length > 0)
      .map((option, index) => ({ option, index, rank: ownRows.has(option.value) ? 0 : option.calculated ? 1 : 2 }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map(({ option }) => option);

    const assignments = this.nodeDataValue?.type === "calculation" ? this.getAssignments() : [];

    this.root.querySelectorAll<RichTextField>("rich-text-field[formula]").forEach((field) => {
      // Not the row's own name (Fia 29/9): `bidrag = … bidrag …` is a cycle
      // the menu should not invite. A chip already there stays a chip — the
      // known names are the whole list; only the menu leaves it out.
      const rowId = field.closest<HTMLElement>("[data-assignment-id]")?.dataset.assignmentId;
      const own = assignments.find((row) => row.id === rowId)?.variableName.trim();
      const offeredHere = own ? forFormulas.filter((option) => option.value !== own) : forFormulas;

      field.variables = offeredHere.map((option) => ({
        value: option.value,
        label: resolveText(option.label),
        computed: option.computed,
        calculated: ownRows.has(option.value) || option.calculated ? true : undefined,
      }));
      field.knownVariables = forFormulas.map((option) => option.value);
    });
    this.bindVariableMenus();
    this.bindRuleCaseEvents();
    this.bindCalculationAssignmentEvents();
    this.bindSubmissionRowEvents();
    this.bindServiceCallEvents();
    this.bindAnnotationEvents();
    this.bindRatingLabelEvents();

    const addOptionButton = this.root.querySelector<HTMLButtonElement>(
      '[data-action="add-option"]'
    );

    addOptionButton?.addEventListener("click", () => {
      this.addOption();
    });

    const removeOptionButtons = this.root.querySelectorAll<HTMLButtonElement>(
      '[data-action="remove-option"]'
    );

    removeOptionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (!this.nodeDataValue) {
          return;
        }

        const optionId = button.dataset.optionId;

        if (!optionId) {
          return;
        }

        this.dispatchEvent(
          new CustomEvent<QuestionOptionRemoveDetail>(
            "question-option-remove",
            {
              detail: {
                nodeId: this.nodeDataValue.id,
                optionId,
              },
              bubbles: true,
              composed: true,
            }
          )
        );
      });
    });

    const moveOptionButtons = this.root.querySelectorAll<HTMLButtonElement>(
      '[data-action^="move-option-"]'
    );

    moveOptionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (!this.nodeDataValue) {
          return;
        }

        const optionId = button.dataset.optionId;

        const action = button.dataset.action;

        if (!optionId || !action) {
          return;
        }

        const direction = action === "move-option-up" ? "up" : "down";
        this.cardFocusAfterMove = { kind: "option", id: optionId, action };

        const detail: QuestionOptionMoveDetail = {
          nodeId: this.nodeDataValue.id,
          optionId,
          direction,
        };

        this.dispatchEvent(
          new CustomEvent<QuestionOptionMoveDetail>("question-option-move", {
            detail,
            bubbles: true,
            composed: true,
          })
        );

        const options = QuestionOptionsService.parseOptions(this.nodeDataValue.data.options);
        const from = options.findIndex((option) => option.id === optionId);

        if (from >= 0) {
          const to = direction === "up" ? from - 1 : from + 1;

          if (to >= 0 && to < options.length) {
            this.announceOptionMove(optionId, to, options.length);
          }
        }
      });
    });

    this.bindCardPointerEvents();
  }

  /**
   * Variabelknappen: öppna listan, lägg valet där markören står.
   *
   * ## Varför markeringen läses när listan ÖPPNAS
   *
   * Ett klick i knappen flyttar fokus ur fältet. Webbläsarna behåller
   * `selectionStart` över en blur, men bara tills något annat tar över — och
   * listan under är fokuserbar. Att läsa av markeringen i samma ögonblick
   * knappen trycks är det enda tillfälle då den säkert är redaktörens egen.
   *
   * Utan det hamnade infogningen sist i texten, vilket är rätt i nio fall av
   * tio och just därför förrädiskt: felet syns bara för den som skriver mitt i
   * en mening.
   */
  private bindVariableMenus(): void {
    const closeAll = (except?: Element): void => {
      this.root.querySelectorAll<HTMLElement>("[data-variable-menu]").forEach((menu) => {
        if (menu === except) return;
        menu.querySelector("[data-variable-toggle]")?.setAttribute("aria-expanded", "false");
        menu.querySelector<HTMLElement>(".properties-panel__variable-list")?.setAttribute("hidden", "");
      });
    };

    this.root.querySelectorAll<HTMLElement>("[data-variable-menu]").forEach((menu) => {
      const toggle = menu.querySelector<HTMLButtonElement>("[data-variable-toggle]");
      const list = menu.querySelector<HTMLElement>(".properties-panel__variable-list");

      if (!toggle || !list) return;

      /*
       * Knappen stjäl aldrig fokus från rutan — verktygsradens mönster
       * (Johans mätning 31/8: "när jag trycker på var-knappen tappar rutan
       * sitt fokus, därför fungerar det inte"). Varje vanlig wysiwyg gör så
       * här: mousedown avbryts, fokus och markör står kvar i texten, och
       * klicket kommer ändå. På Chromium överlevde insättningen stölden via
       * den sparade markeringen; på Safari gjorde den inte det — och utan
       * stöld finns hela felklassen inte, på någon plattform, och plattans
       * tangentbord fälls inte ihop mitt i valet.
       *
       * `mousedown`, INTE `pointerdown`: att avbryta pointerdown ställer in
       * kompatibilitetskedjan på iOS och då kommer inget klick alls.
       */
      const keepFocusInField = (event: Event): void => event.preventDefault();

      toggle.addEventListener("mousedown", keepFocusInField);

      toggle.addEventListener("click", (event) => {
        const open = toggle.getAttribute("aria-expanded") === "true";

        closeAll(menu);

        if (open) {
          toggle.setAttribute("aria-expanded", "false");
          list.setAttribute("hidden", "");
          return;
        }

        this.rememberSelection(toggle.dataset.variableToggle ?? "");
        toggle.setAttribute("aria-expanded", "true");
        list.removeAttribute("hidden");

        /*
         * Fokus in i listan BARA när knappen aktiverades med tangentbord
         * (`detail === 0` — inga klickkoordinater). En pekare ska inte få
         * fokus flyttat åt sig: då blurras rutan av oss själva, och det var
         * hela felet.
         */
        if ((event as MouseEvent).detail === 0) {
          list.querySelector<HTMLButtonElement>("[data-variable-insert]")?.focus();
        }
      });

      list.querySelectorAll<HTMLButtonElement>("[data-variable-insert]").forEach((option) => {
        option.addEventListener("mousedown", keepFocusInField);
        option.addEventListener("click", () => {
          this.insertVariable(
            option.dataset.variableTarget ?? "",
            option.dataset.variableInsert ?? "",
          );
          toggle.setAttribute("aria-expanded", "false");
          list.setAttribute("hidden", "");
        });
      });

      // Escape stänger och lämnar tillbaka fokus till knappen, inte till
      // fältet: den som ångrade sig står kvar där de var.
      menu.addEventListener("keydown", (event) => {
        if ((event as KeyboardEvent).key !== "Escape") return;
        event.stopPropagation();
        toggle.setAttribute("aria-expanded", "false");
        list.setAttribute("hidden", "");
        toggle.focus();
      });

      /*
       * Stängningen vaktar på VART fokus tog vägen — inte på att det försvann.
       *
       * Safari på plattan ger inte knappar fokus vid tryck: när listan öppnas
       * står fokus på första alternativet, och ett tryck på ett alternativ
       * blurrar det med `relatedTarget: null` — före klicket. Den första
       * versionen stängde listan då, så klicket landade på en dold knapp och
       * ingenting infogades. Chrome fokuserar knappar vid klick, vilket är
       * varför varje test var grönt medan plattan var trasig (Johans fynd,
       * 31/8 — samma släkte som praxis 17).
       *
       * `relatedTarget: null` betyder alltså "vet ej", inte "utanför" — och
       * då gör vi ingenting. Tryck utanför stängs av pekar-lyssnaren nedan.
       */
      menu.addEventListener("focusout", (event) => {
        const next = (event as FocusEvent).relatedTarget as Node | null;

        if (!next || menu.contains(next)) return;

        toggle.setAttribute("aria-expanded", "false");
        list.setAttribute("hidden", "");
      });
    });

    /*
     * Tryck utanför stänger — pekaren ljuger aldrig om var den landade, till
     * skillnad från fokus. På roten och inte per meny, och bara EN gång:
     * roten överlever varje omritning, så en lyssnare per render hade blivit
     * en hög av dubbletter.
     */
    if (!this.variableMenuDismissBound) {
      this.variableMenuDismissBound = true;
      this.root.addEventListener("pointerdown", (event) => {
        const path = event.composedPath();

        this.root.querySelectorAll<HTMLElement>("[data-variable-menu]").forEach((menu) => {
          if (path.includes(menu)) return;

          menu.querySelector("[data-variable-toggle]")?.setAttribute("aria-expanded", "false");
          menu.querySelector<HTMLElement>(".properties-panel__variable-list")?.setAttribute("hidden", "");
        });
      });
    }
  }

  /**
   * Knappen som öppnar variabellistan, och listan.
   *
   * Ritas bara när det FINNS något att infoga. Väljaren fanns förut som en
   * rullgardin under varje mallfält, och i en guide utan variabler stod den
   * där tom: en kontroll som lovar ett val den inte kan ge.
   *
   * En metod och inte två kopior, för den behövs i två grenar — ett vanligt
   * `text`-fält och mallfälten — och en kopia som ritar samma knapp är en
   * kopia som slutar göra det.
   */
  /**
   * The field where formatting shows as the visitor sees it (story 136), or —
   * when the stored text holds something the model cannot read — nothing, and
   * a line saying why: the caller then draws the old plain field, and
   * nothing is rewritten until the redaktör touches it (criterion 8). Text
   * mode is a reserve for older content, not a way of editing.
   *
   * `value` goes in as an attribute and is read once; the answers are set as
   * properties in `bindFormEvents`, where the element exists.
   */
  private richTextField(
    property: NodePropertyDefinition,
    shownValue: string,
    options: { features: readonly FormattingFeature[]; multiline: boolean; placeholder: string; locked: boolean },
  ): { field: string; textMode: string } {
    if (!RichTextField.canEdit(shownValue, options.features, options.multiline)) {
      return {
        field: "",
        textMode: '<small class="properties-panel__help" data-text-mode>' + escapeHtml(this.text("editor.properties.rich-text-text-mode")) + "</small>",
      };
    }

    const id = escapeHtml(property.id);

    return {
      field: '<rich-text-field id="property-' + id + '" data-property="' + id + '"'
        + (options.multiline ? " multiline" : "")
        + ' features="' + escapeHtml(options.features.join(",")) + '"'
        + ' value="' + escapeHtml(shownValue) + '"'
        + ' label="' + escapeHtml(property.label) + '"'
        + (options.placeholder ? ' placeholder="' + escapeHtml(options.placeholder) + '"' : "")
        + ' editor-locale="' + escapeHtml(this.uiLocale) + '"'
        + ' locale="' + escapeHtml(this.activeLocaleValue) + '"'
        + (options.locked ? " disabled" : "")
        + this.fieldDirection(property)
        + "></rich-text-field>",
      textMode: "",
    };
  }

  /** Fältet och knappen på samma rad — Johans placering för enradsfält. */
  private withVariableMenu(field: string, menu: string): string {
    return menu ? '<div class="properties-panel__field-row">' + field + menu + '</div>' : field;
  }

  private variableMenu(propertyId: string, allowed: boolean, disabledAttr: string): string {
    const available = this.variablesAvailableHere();

    if (!allowed || available.length === 0) return "";

    const rows = available
      .map((option) => '<li role="none"><button type="button" role="option" aria-selected="false" data-variable-insert="' + escapeHtml(option.value) + '" data-variable-target="' + propertyId + '">'
        /*
         * Etiketten först, klamrarna efter. Man väljer på det man känner igen
         * — "Ditt namn" — men ser samtidigt exakt vad som hamnar i texten, för
         * det är det som blir kvar att läsa.
         */
        + '<span class="properties-panel__variable-label">' + escapeHtml(resolveText(option.label)) + '</span>'
        + '<code>{{' + escapeHtml(option.value) + '}}</code>'
        + '</button></li>')
      .join("");

    /*
     * Knappen bär tecknen och inte orden.
     *
     * "Infoga variabel" tog halva bredden bredvid ett enradsfält i en panel som
     * också används på surfplatta. `{{var}}` säger samma sak på en sjundedel av
     * platsen, och för den som inte känner igen formen står orden kvar som
     * `aria-label` och som verktygstips.
     *
     * Ordet inuti och inte bara klamrarna: `{{ }}` är en tom form, medan
     * `{{var}}` visar att något ska stå DÄR — knappen är sin egen bruksanvisning.
     *
     * DUBBEL klammer, inte enkel. `{namn}` matchar inte mallmönstret, fylls
     * aldrig i och fångas inte av hälsokontrollen — en knapp märkt `{}` hade
     * lärt ut precis den syntax som inte fungerar.
     */
    const namn = escapeHtml(this.text("editor.properties.insert-variable"));

    return '<div class="properties-panel__variable" data-variable-menu="' + propertyId + '">'
      + '<button type="button" class="properties-panel__variable-toggle" data-variable-toggle="' + propertyId + '" aria-expanded="false" aria-haspopup="listbox" aria-label="' + namn + '" title="' + namn + '"' + disabledAttr + '>'
      + '{{var}}'
      + '</button>'
      + '<ul class="properties-panel__variable-list" role="listbox" aria-label="' + escapeHtml(this.text("editor.properties.select-variable")) + '" hidden>'
      + rows
      + '</ul>'
      + '</div>';
  }

  private rememberSelection(propertyId: string): void {
    const field = this.fieldFor(propertyId);

    if (!field) return;

    /*
     * Ett fält som HAR fokus läses av direkt; ett som lämnats bär sin
     * markering från `blur`. Har det aldrig rörts finns ingen — och då är
     * slutet det rimliga stället att lägga något man inte pekat ut var det ska
     * stå. Ett orört fält rapporterar nämligen `selectionStart` som 0 och inte
     * som saknad, vilket la variabeln FÖRST: `{{ort}}Hej` i stället för
     * `Hej{{ort}}`.
     */
    if (this.root.activeElement === field) {
      this.selectionByProperty.set(propertyId, [
        field.selectionStart ?? field.value.length,
        field.selectionEnd ?? field.value.length,
      ]);
      return;
    }

    if (!this.selectionByProperty.has(propertyId)) {
      this.selectionByProperty.set(propertyId, [field.value.length, field.value.length]);
    }
  }

  private insertVariable(propertyId: string, variableName: string): void {
    const field = this.fieldFor(propertyId);

    if (!field || !variableName) return;

    const remembered = this.selectionByProperty.get(propertyId);
    const start = remembered?.[0] ?? field.value.length;
    const end = remembered?.[1] ?? start;

    field.setRangeText("{{" + variableName + "}}", start, end, "end");
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.focus();
    this.selectionByProperty.set(propertyId, [
      field.selectionStart ?? field.value.length,
      field.selectionEnd ?? field.value.length,
    ]);
  }

  private fieldFor(propertyId: string): HTMLInputElement | HTMLTextAreaElement | null {
    if (!propertyId) return null;

    // A property's own field, or a list row's cell (`data-field-id`, story 092).
    return this.root.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      '[data-property="' + CSS.escape(propertyId) + '"], [data-field-id="' + CSS.escape(propertyId) + '"]',
    );
  }

  private bindRuleCaseEvents(): void {
    this.root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[data-rule-case-property]"
      )
      .forEach((field) => {
        field.addEventListener("input", () => {
          this.updateRuleCase(field);
          if (field.dataset.ruleCaseProperty !== "label") return;
          // The card's head follows its name; unnamed, it reads "Regel N" again.
          const card = field.closest<HTMLElement>("[data-card]");
          const number = [...this.root.querySelectorAll('[data-card="rule-case"]')].indexOf(card!) + 1;

          this.retitleCard(card, field.value.trim() || this.text("editor.properties.rule-n", { number }));
        });
      });

    this.root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[data-rule-condition-property]"
      )
      .forEach((field) => {
        field.addEventListener("input", () => this.updateRuleCondition(field));
      });

    this.root
      .querySelectorAll<HTMLButtonElement>('[data-action="add-rule-condition"]')
      .forEach((button) => {
        button.addEventListener("click", () => {
          const caseId = button.closest<HTMLElement>("[data-rule-case-id]")
            ?.dataset.ruleCaseId;
          if (!caseId) return;
          this.setRuleCases(this.getRuleCases().map((item) =>
            item.id === caseId
              ? { ...item, conditions: [...item.conditions, RuleCasesService.createCondition()] }
              : item
          ));
        });
      });

    this.root
      .querySelectorAll<HTMLButtonElement>('[data-action="remove-rule-condition"]')
      .forEach((button) => {
        button.addEventListener("click", () => {
          const caseElement = button.closest<HTMLElement>("[data-rule-case-id]");
          const conditionId = button.closest<HTMLElement>("[data-rule-condition-id]")
            ?.dataset.ruleConditionId;
          const caseId = caseElement?.dataset.ruleCaseId;
          if (!caseId || !conditionId) return;
          this.setRuleCases(this.getRuleCases().map((item) =>
            item.id === caseId && item.conditions.length > 1
              ? { ...item, conditions: item.conditions.filter((condition) => condition.id !== conditionId) }
              : item
          ));
        });
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="add-rule-case"]')
      ?.addEventListener("click", () => {
        const cases = this.getRuleCases();
        const ny = RuleCasesService.createCase(cases.length);

        // Opened, so its name field can take the cursor (Astra §1).
        this.openCardIds.add(ny.id);
        this.setRuleCases([...cases, ny]);

        /*
         * Markören i den nya regelns namn.
         *
         * Panelen ritas om när en regel läggs till, och då rullar den tillbaka
         * till toppen — man står vid den FÖRSTA regeln medan man tror man är i
         * den man just skapade. Nästa sak man skriver hamnar i fel regel, och
         * det upptäcks först när guiden förgrenar konstigt. Johan träffade på
         * det när han skapade en tredje regel på en iPad.
         *
         * Fokus löser båda halvorna: markören står där man ska skriva, och
         * webbläsaren rullar dit av sig självt. Nästa bildruta, för fältet
         * finns inte förrän omritningen skett.
         */
        requestAnimationFrame(() => {
          this.root
            .querySelector<HTMLInputElement>(
              `[data-rule-case-id="${CSS.escape(ny.id)}"] [data-rule-case-property="label"]`,
            )
            ?.focus();
        });
      });

    this.root
      .querySelectorAll<HTMLButtonElement>(
        '[data-action^="move-rule-case-"]'
      )
      .forEach((button) => {
        button.addEventListener("click", () => {
          const caseId = button.closest<HTMLElement>("[data-rule-case-id]")
            ?.dataset.ruleCaseId;
          const direction = button.dataset.action?.endsWith("up")
            ? "up"
            : "down";

          if (caseId) {
            this.moveCard("rule-case", caseId, button.dataset.action ?? "", direction);
          }
        });
      });

    this.root
      .querySelectorAll<HTMLButtonElement>('[data-action="remove-rule-case"]')
      .forEach((button) => {
        button.addEventListener("click", () => {
          const caseId = button.closest<HTMLElement>("[data-rule-case-id]")
            ?.dataset.ruleCaseId;

          if (!caseId || !this.nodeDataValue) {
            return;
          }

          const cases = this.getRuleCases().filter((item) => item.id !== caseId);
          this.nodeDataValue.data.cases = cases;
          this.dispatchEvent(
            new CustomEvent<RuleCaseRemoveDetail>("rule-case-remove", {
              detail: { nodeId: this.nodeDataValue.id, caseId, cases },
              bubbles: true,
              composed: true,
            })
          );
          this.render();
        });
      });
  }

  private bindCalculationAssignmentEvents(): void {
    this.root
      .querySelectorAll<HTMLInputElement>("[data-assignment-property]")
      .forEach((field) => {
        field.addEventListener("input", () => {
          this.updateAssignment(field);
          if (field instanceof HTMLTextAreaElement) fitToText(field);
          const card = field.closest<HTMLElement>("[data-card]");
          const read = (name: string): string =>
            card?.querySelector<HTMLInputElement>(`[data-assignment-property="${name}"]`)?.value.trim() ?? "";

          this.retitleCard(card, read("label") || read("variableName") || this.text("editor.properties.assignment-untitled"));
        });
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="add-assignment"]')
      ?.addEventListener("click", () => {
        const ny = CalculationService.createAssignment();

        this.openCardIds.add(ny.id);
        this.setAssignments([...this.getAssignments(), ny]);
        this.focusNewRow(`[data-assignment-id="${CSS.escape(ny.id)}"]`);
      });

    this.root
      .querySelectorAll<HTMLButtonElement>('[data-action^="move-assignment-"]')
      .forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.closest<HTMLElement>("[data-assignment-id]")?.dataset
            .assignmentId;
          const direction = button.dataset.action?.endsWith("up") ? "up" : "down";
          if (id) {
            this.moveCard("assignment", id, button.dataset.action ?? "", direction);
          }
        });
      });

    this.root
      .querySelectorAll<HTMLButtonElement>('[data-action="remove-assignment"]')
      .forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.closest<HTMLElement>("[data-assignment-id]")?.dataset
            .assignmentId;
          if (!id) return;
          this.setAssignments(
            this.getAssignments().filter((item) => item.id !== id)
          );
        });
      });
  }

  private getAssignments() {
    return CalculationService.parseAssignments(this.nodeDataValue?.data.assignments);
  }

  private setAssignments(
    assignments: ReturnType<typeof CalculationService.parseAssignments>
  ): void {
    if (!this.nodeDataValue) return;
    this.nodeDataValue.data.assignments = assignments;
    this.dispatchNodeDataChange("assignments", assignments);
    this.render();
  }

  /**
   * A calculation or service row's label: the variable's alias, translatable
   * like a question's (story 080). Drawn as the option label is — in
   * translation mode the active language with the source as placeholder.
   * `attribute` is the row's own `data-…-property="label"`.
   */
  private rowLabelField(
    label: LocalizedText | undefined,
    attribute: string,
    texts: { label: string; placeholder: string } = {
      label: this.text("editor.properties.label"),
      placeholder: this.text("editor.properties.assignment-label-placeholder"),
    },
  ): string {
    const inTranslation = this.isTranslationMode();
    const source = resolveText(label, this.sourceLocaleValue);
    const shown = !inTranslation
      ? source
      : isLocalizedTextMap(label) && typeof label[this.activeLocaleValue] === "string"
        ? label[this.activeLocaleValue]
        : "";

    return `
                  <label>
                    ${texts.label}
                    <input type="text" value="${escapeHtml(shown)}" ${attribute} placeholder="${inTranslation ? escapeHtml(source) : escapeHtml(texts.placeholder)}"${this.contentDirection()}>
                    ${inTranslation ? this.sourceReference(source) : ""}
                  </label>`;
  }

  /** The row label merged in the active language, so other languages are never cut away. */
  private mergedRowLabel(current: LocalizedText | undefined, typed: string): LocalizedText {
    return isLocalizedTextMap(current) || this.isTranslationMode()
      ? withLocale(current, this.activeLocaleValue, typed)
      : typed;
  }

  private updateAssignment(field: HTMLInputElement): void {
    const id = field.closest<HTMLElement>("[data-assignment-id]")?.dataset
      .assignmentId;
    const property = field.dataset.assignmentProperty as
      | "variableName"
      | "formula"
      | "label"
      | undefined;

    if (!id || !property || !this.nodeDataValue) return;

    const current = this.getAssignments().find((item) => item.id === id);
    const assignments = CalculationService.updateAssignment(
      this.getAssignments(),
      id,
      property,
      property === "label" ? this.mergedRowLabel(current?.label, field.value) : field.value
    );
    this.nodeDataValue.data.assignments = assignments;
    this.dispatchNodeDataChange("assignments", assignments);
  }

  private bindSubmissionRowEvents(): void {
    this.root
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-column-property]")
      .forEach((field) => {
        field.addEventListener("input", () => this.updateColumn(field));
        // The caret is saved as the field is left, for the same reason a
        // property field's is (see the `[data-property]` binding above).
        field.addEventListener("blur", () => {
          const fieldId = field.dataset.fieldId;
          if (!fieldId) return;
          this.selectionByProperty.set(fieldId, [
            field.selectionStart ?? field.value.length,
            field.selectionEnd ?? field.value.length,
          ]);
        });
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="add-column"]')
      ?.addEventListener("click", () => {
        const ny = RowColumnsService.createColumn();

        this.setColumns([...this.getColumns(), ny]);
        this.focusNewRow(`[data-column-id="${CSS.escape(ny.id)}"]`);
      });

    this.root
      .querySelectorAll<HTMLButtonElement>('[data-action^="move-column-"]')
      .forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.closest<HTMLElement>("[data-column-id]")?.dataset.columnId;
          const direction = button.dataset.action?.endsWith("up") ? "up" : "down";
          if (id) {
            this.setColumns(RowColumnsService.moveColumn(this.getColumns(), id, direction));
          }
        });
      });

    this.root
      .querySelectorAll<HTMLButtonElement>('[data-action="remove-column"]')
      .forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.closest<HTMLElement>("[data-column-id]")?.dataset.columnId;
          if (!id) return;
          this.setColumns(this.getColumns().filter((item) => item.id !== id));
        });
      });
  }

  private getColumns(): RowColumn[] {
    return RowColumnsService.parseColumns(this.nodeDataValue?.data.row);
  }

  private setColumns(columns: RowColumn[]): void {
    if (!this.nodeDataValue) return;
    this.nodeDataValue.data.row = columns;
    this.dispatchNodeDataChange("row", columns);
    this.render();
  }

  private updateColumn(field: HTMLInputElement | HTMLTextAreaElement): void {
    const id = field.closest<HTMLElement>("[data-column-id]")?.dataset.columnId;
    const property = field.dataset.columnProperty as "label" | "cell" | undefined;

    if (!id || !property || !this.nodeDataValue) return;

    const current = this.getColumns().find((item) => item.id === id);
    const columns = RowColumnsService.updateColumn(
      this.getColumns(),
      id,
      property,
      this.mergedRowLabel(current?.[property], field.value),
    );
    this.nodeDataValue.data.row = columns;
    this.dispatchNodeDataChange("row", columns);
  }

  private bindAnnotationEvents(): void {
    this.root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[data-annotation-property]"
      )
      .forEach((field) => {
        const event = field.tagName === "SELECT" ? "change" : "input";
        field.addEventListener(event, () => this.updateAnnotation(field));
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="add-annotation"]')
      ?.addEventListener("click", () => {
        this.setComments(AnnotationCommentsService.add(this.getComments()));
      });

    this.root
      .querySelectorAll<HTMLButtonElement>('[data-action="remove-annotation"]')
      .forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.closest<HTMLElement>("[data-annotation-id]")?.dataset
            .annotationId;
          if (id) {
            this.setComments(
              AnnotationCommentsService.remove(this.getComments(), id)
            );
          }
        });
      });

    // Drag pins directly on the image to set the position (x/y in %).
    const image = this.root.querySelector<HTMLImageElement>(
      "[data-annotation-canvas] img"
    );
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-annotation-pin]")
      .forEach((pin) => {
        pin.addEventListener("pointerdown", (event) => {
          const id = pin.dataset.annotationId;
          if (!id || !image) return;
          event.preventDefault();
          pin.setPointerCapture(event.pointerId);

          const onMove = (moveEvent: PointerEvent): void => {
            const rect = image.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            const x = Math.max(0, Math.min(100, Math.round(((moveEvent.clientX - rect.left) / rect.width) * 100)));
            const y = Math.max(0, Math.min(100, Math.round(((moveEvent.clientY - rect.top) / rect.height) * 100)));
            pin.style.left = `${x}%`;
            pin.style.top = `${y}%`;
            // Update the data live (no dispatch or re-render, so the drag stays smooth).
            if (this.nodeDataValue) {
              this.nodeDataValue.data.comments = AnnotationCommentsService.update(
                AnnotationCommentsService.update(this.getComments(), id, "x", String(x)),
                id,
                "y",
                String(y)
              );
            }
          };
          const onUp = (): void => {
            pin.removeEventListener("pointermove", onMove);
            pin.removeEventListener("pointerup", onUp);
            pin.removeEventListener("pointercancel", onUp);
            // Spara + rita om (uppdaterar även x/y-fälten i listan).
            this.setComments(this.getComments());
          };
          pin.addEventListener("pointermove", onMove);
          pin.addEventListener("pointerup", onUp);
          pin.addEventListener("pointercancel", onUp);
        });
      });
  }

  private bindServiceCallEvents(): void {
    const request = this.root.querySelector<HTMLElement & {
      options: Array<{ label: string; value: string }>;
      value: string[];
      strings: Record<string, string>;
    }>("[data-request-picker]");

    if (request) {
      request.strings = this.valuePickerStrings();
      request.options = JSON.parse(request.dataset.requestOptions || "[]");
      request.value = JSON.parse(request.dataset.requestValue || "[]");
      request.addEventListener("chip-change", (event) => {
        const valda = (event as CustomEvent<{ value: string[] }>).detail.value;

        if (!this.nodeDataValue) return;

        this.nodeDataValue.data.requestVariables = valda;
        this.dispatchNodeDataChange("requestVariables", valda);
      });
    }

    this.root
      .querySelectorAll<HTMLInputElement>("[data-mapping-property]")
      .forEach((field) => {
        field.addEventListener("input", () => this.updateMapping(field));
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="add-mapping"]')
      ?.addEventListener("click", () => {
        const ny = ServiceCallService.createMapping();

        this.setMappings([...this.getMappings(), ny]);
        this.focusNewRow(`[data-mapping-id="${CSS.escape(ny.id)}"]`);
      });

    this.root
      .querySelectorAll<HTMLButtonElement>('[data-action^="move-mapping-"]')
      .forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.closest<HTMLElement>("[data-mapping-id]")?.dataset
            .mappingId;
          const direction = button.dataset.action?.endsWith("up") ? "up" : "down";
          if (id) {
            this.setMappings(
              ServiceCallService.moveMapping(this.getMappings(), id, direction)
            );
          }
        });
      });

    this.root
      .querySelectorAll<HTMLButtonElement>('[data-action="remove-mapping"]')
      .forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.closest<HTMLElement>("[data-mapping-id]")?.dataset
            .mappingId;
          if (!id) return;
          this.setMappings(this.getMappings().filter((item) => item.id !== id));
        });
      });
  }

  private getMappings() {
    return ServiceCallService.parseMappings(this.nodeDataValue?.data.responseMappings);
  }

  private setMappings(
    mappings: ReturnType<typeof ServiceCallService.parseMappings>
  ): void {
    if (!this.nodeDataValue) return;
    this.nodeDataValue.data.responseMappings = mappings;
    this.dispatchNodeDataChange("responseMappings", mappings);
    this.render();
  }

  private updateMapping(field: HTMLInputElement): void {
    const id = field.closest<HTMLElement>("[data-mapping-id]")?.dataset.mappingId;
    const property = field.dataset.mappingProperty as
      | "field"
      | "variableName"
      | "label"
      | undefined;
    if (!id || !property || !this.nodeDataValue) return;

    const current = this.getMappings().find((item) => item.id === id);
    const mappings = ServiceCallService.updateMapping(
      this.getMappings(),
      id,
      property,
      property === "label" ? this.mergedRowLabel(current?.label, field.value) : field.value
    );
    this.nodeDataValue.data.responseMappings = mappings;
    this.dispatchNodeDataChange("responseMappings", mappings);
  }

  /**
   * A rule or a calculation row moved one step by its button: the node's
   * list is written in the new order, the same button gets the focus back
   * after the redraw, and the new place is said (as an option's move is).
   */
  private moveCard(kind: "rule-case" | "assignment", id: string, action: string, direction: "up" | "down"): void {
    const name = this.root.querySelector<HTMLElement>(`[data-card="${kind}"][data-${kind}-id="${CSS.escape(id)}"]`)?.dataset.cardName ?? "";
    const next = kind === "rule-case"
      ? RuleCasesService.moveCase(this.getRuleCases(), id, direction)
      : CalculationService.moveAssignment(this.getAssignments(), id, direction);
    const index = next.findIndex((item) => item.id === id);

    this.cardFocusAfterMove = { kind, id, action };
    this.announceMove(name, index, next.length);
    if (kind === "rule-case") this.setRuleCases(next as ReturnType<typeof RuleCasesService.parseCases>);
    else this.setAssignments(next as ReturnType<typeof CalculationService.parseAssignments>);
  }

  private getRuleCases() {
    return RuleCasesService.parseCases(this.nodeDataValue?.data.cases);
  }

  private setRuleCases(cases: ReturnType<typeof RuleCasesService.parseCases>): void {
    if (!this.nodeDataValue) {
      return;
    }

    this.nodeDataValue.data.cases = cases;
    this.dispatchNodeDataChange("cases", cases);
    this.render();
  }

  private updateRuleCase(field: HTMLInputElement | HTMLSelectElement): void {
    const caseId = field.closest<HTMLElement>("[data-rule-case-id]")?.dataset
      .ruleCaseId;
    const property = field.dataset.ruleCaseProperty as
      | "label"
      | "match"
      | undefined;

    if (!caseId || !property || !this.nodeDataValue) {
      return;
    }

    const cases = RuleCasesService.updateCase(
      this.getRuleCases(),
      caseId,
      property,
      field.value
    );
    this.nodeDataValue.data.cases = cases;
    this.dispatchNodeDataChange("cases", cases);
  }

  private updateRuleCondition(
    field: HTMLInputElement | HTMLSelectElement
  ): void {
    const caseId = field.closest<HTMLElement>("[data-rule-case-id]")?.dataset
      .ruleCaseId;
    const conditionId = field.closest<HTMLElement>("[data-rule-condition-id]")
      ?.dataset.ruleConditionId;
    const property = field.dataset.ruleConditionProperty as
      | "variableName"
      | "operator"
      | "value"
      | undefined;

    if (!caseId || !conditionId || !property || !this.nodeDataValue) return;

    const cases = RuleCasesService.updateCondition(
      this.getRuleCases(), caseId, conditionId, property, field.value
    );
    this.nodeDataValue.data.cases = cases;
    this.dispatchNodeDataChange("cases", cases);

    /*
     * Variabeln och jämförelsen ritar om; värdet får inte.
     *
     * Variabeln avgör vilka alternativ som finns, och jämförelsen avgör om det
     * är ETT värde eller flera — båda ändrar alltså vilken kontroll som ska
     * stå där. Bara variabeln gjorde det förut, vilket var rätt så länge
     * värdefältet bara berodde på alternativen: bytte man till "är lika med"
     * satt flervalet kvar och tog emot hur många värden som helst.
     *
     * Värdet ritar inte om, för då tappas sökrutan mitt i att man skriver.
     */
    if (property !== "variableName" && property !== "operator") return;

    this.render();

    /*
     * Fokus tillbaka på samma fält.
     *
     * Omritningen behövs — variabeln avgör vilka alternativ som finns och
     * jämförelsen om det är ett värde eller flera — men den kastar bort var
     * man stod. På en iPad betyder det att panelen rullar till toppen och man
     * hamnar vid REGEL 1 medan man arbetade i regel 3; nästa sak man skriver
     * hamnar i fel regel. Johan träffade på det två gånger, en gång per fält.
     *
     * Fokus löser båda halvorna: markören står kvar, och webbläsaren rullar
     * tillbaka dit av sig självt. Nästa bildruta, för fältet är ett nytt
     * element efter omritningen.
     */
    requestAnimationFrame(() => {
      this.root
        .querySelector<HTMLElement>(
          `[data-rule-condition-id="${CSS.escape(conditionId)}"] [data-rule-condition-property="${property}"]`,
        )
        ?.focus();
    });
  }

  private updateVisibility(
    field: HTMLInputElement | HTMLSelectElement,
    rerender = true
  ): void {
    if (!this.nodeDataValue) return;
    const property = field.dataset.visibilityProperty;
    const conditionId = field.closest<HTMLElement>("[data-visibility-condition-id]")?.dataset.visibilityConditionId;

    this.writeVisibility(
      nextVisibility(this.nodeDataValue.visibility, property, field, conditionId),
      rerender,
    );
    // Switched on: the controls unfold below the switch, and when the switch
    // sat near the bottom of the panel they unfold out of view. Bring the
    // first of them in, no further than needed.
    if (property === "enabled" && this.nodeDataValue.visibility) {
      this.root
        .querySelector<HTMLElement>('[data-visibility-property="variableName"]')
        ?.scrollIntoView({ block: "nearest" });
    }
  }

  /** The field's visibility, written and announced to the host. */
  private writeVisibility(visibility: ConditionalVisibility | undefined, rerender = true): void {
    if (!this.nodeDataValue) return;
    this.nodeDataValue.visibility = visibility;
    this.dispatchEvent(
      new CustomEvent<NodeVisibilityChangedDetail>("node-visibility-changed", {
        detail: { nodeId: this.nodeDataValue.id, visibility },
        bubbles: true,
        composed: true,
      })
    );
    if (rerender) this.render();
  }

  /**
   * En ändring i ett alternativs *visas bara om* (story 134).
   *
   * Samma form som `updateVisibility` en nivå ner, och samma två beslut:
   * brytaren AV tar bort villkoret helt i stället för att lämna ett tomt kvar
   * — ett `visibility` utan variabel i en sparad guide är brus som ser ut som
   * ett beslut — och ändringen skickas som `options`, hela listan, för det är
   * den egenskapen alternativen bor i. Editorn har en väg in för ett
   * nodvärde, inte en för varje nivå under det.
   */
  private updateOptionVisibility(
    field: HTMLInputElement | HTMLSelectElement,
    rerender = true
  ): void {
    const property = field.dataset.optionVisibilityProperty;
    const optionId = field.dataset.optionId;

    if (!property || !optionId) return;
    const conditionId = field.closest<HTMLElement>("[data-option-visibility-condition-id]")?.dataset.optionVisibilityConditionId;

    this.writeOptionVisibility(
      optionId,
      (visibility) => nextVisibility(visibility, property, field, conditionId),
      rerender,
    );
    // As the field's switch (`updateVisibility`): switched on, the group
    // unfolds below and must not unfold out of view (Johan 29/9).
    if (property === "enabled" && (field as HTMLInputElement).checked) {
      this.root
        .querySelector<HTMLElement>(
          `[data-option-id="${CSS.escape(optionId)}"] [data-option-visibility-property="variableName"]`,
        )
        ?.scrollIntoView({ block: "nearest" });
    }
  }

  /**
   * One option's visibility, changed and sent as `options`, the whole list:
   * that is the property the options live in, and the editor has one way in
   * for a node value, not one per level below it. No visibility left means
   * none stored — a `visibility` without a variable in a saved guide is
   * noise that looks like a decision.
   */
  private writeOptionVisibility(
    optionId: string,
    change: (visibility: ConditionalVisibility | undefined) => ConditionalVisibility | undefined,
    rerender = true,
  ): void {
    if (!this.nodeDataValue) return;

    const updated = QuestionOptionsService.parseOptions(this.nodeDataValue.data.options).map((option) => {
      if (option.id !== optionId) return option;
      const { visibility: was, ...rest } = option;
      const visibility = change(was);

      return visibility ? { ...rest, visibility } : rest;
    });

    this.nodeDataValue.data.options = updated;
    this.dispatchEvent(
      new CustomEvent<NodeDataChangedDetail>("node-data-changed", {
        detail: { nodeId: this.nodeDataValue.id, property: "options", value: updated },
        bubbles: true,
        composed: true,
      })
    );

    if (rerender) this.render();
  }

  /** Byte eller borttagning av nodens härkomst. Ändrar bara vad noden heter. */
  private bindTemplateChoice(): void {
    this.root
      .querySelector<HTMLSelectElement>("[data-template-select]")
      ?.addEventListener("change", (event) => {
        const node = this.nodeDataValue;
        if (!node) return;

        const value = (event.target as HTMLSelectElement).value;

        if (value) node.template = value;
        else delete node.template;

        this.dispatchEvent(
          new CustomEvent<NodeTemplateChangedDetail>("node-template-changed", {
            detail: { nodeId: node.id, template: value || null },
            bubbles: true,
            composed: true,
          })
        );
      });
  }

  private dispatchNodeDataChange(property: string, value: unknown): void {
    if (!this.nodeDataValue) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent<NodeDataChangedDetail>("node-data-changed", {
        detail: { nodeId: this.nodeDataValue.id, property, value },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * The words on a rating's steps (story 115) — one row per step, in order.
   *
   * ## Why the rows are not options
   *
   * An option carries a value the editor types. A step's value is its place on
   * the scale and nothing else (Johan 13/9), so a value box beside each row
   * would offer a decision that has already been made — and the first person to
   * fill it in would have a scale whose fourth step is worth 9.
   *
   * ## Why the list follows the count instead of an Add button
   *
   * The count IS the scale. Two controls that both decide how many steps there
   * are would be two answers to one question, and the day they disagree is the
   * day nobody can tell which one the visitor sees. So *Antal steg* draws the
   * rows, and a row left empty shows its number to the visitor — which is what
   * makes a 1–10 rating a number in a box rather than ten rows to type.
   *
   * Words the editor wrote are kept when the scale is shortened: `labels` may be
   * longer than the scale, and only as many as there are steps are read. A
   * mis-typed 3 that was meant to be 4 must not eat the fourth word.
   */
  private renderRatingLabels(property: NodePropertyDefinition): string {
    const node = this.nodeDataValue;

    if (!node) return "";

    const inTranslation = this.isTranslationMode();
    const stored = RatingScaleService.labels(node);
    const count = RatingScaleService.stepCount(node);

    const rows = Array.from({ length: count }, (_unused, index) => {
      const own = stored[index];
      const source = resolveText(own, this.sourceLocaleValue);
      const shown = !inTranslation
        ? source
        : isLocalizedTextMap(own) && typeof own[this.activeLocaleValue] === "string"
          ? own[this.activeLocaleValue]
          : "";
      const number = index + 1;

      return `
        <div class="properties-panel__rating-step" data-rating-index="${index}">
          <button
            type="button"
            class="properties-panel__option-drag-handle"
            data-action="drag-rating-step"
            data-rating-index="${index}"
            aria-label="${this.text("editor.properties.move-option", { label: escapeHtml(source || String(number)) })}"
            title="${this.text("editor.properties.drag-to-reorder")}"
            ${inTranslation ? "disabled" : ""}
          >
            <span aria-hidden="true">⠿</span>
          </button>

          <label class="properties-panel__rating-step-label">
            <span>${this.text("editor.properties.rating-step-n", { number })}</span>
            <input
              type="text"
              value="${escapeHtml(shown)}"
              placeholder="${escapeHtml(inTranslation ? source || String(number) : String(number))}"
              data-rating-label-index="${index}"${this.contentDirection()}
            >
          </label>

          <div class="properties-panel__option-order">
            <button
              type="button"
              data-action="move-rating-step-up"
              data-rating-index="${index}"
              ${index > 0 && !inTranslation ? "" : "disabled"}
              aria-label="${this.text("editor.properties.move-rating-step-up")}"
            >↑</button>
            <button
              type="button"
              data-action="move-rating-step-down"
              data-rating-index="${index}"
              ${index < count - 1 && !inTranslation ? "" : "disabled"}
              aria-label="${this.text("editor.properties.move-rating-step-down")}"
            >↓</button>
          </div>
          ${inTranslation && source ? this.sourceReference(source) : ""}
        </div>
      `;
    }).join("");

    return `
      <div class="properties-panel__field">
        <span>${escapeHtml(property.label)}</span>
        <div class="properties-panel__rating-steps" data-rating-steps>${rows}</div>
        ${property.description ? `<small class="properties-panel__help">${escapeHtml(property.description)}</small>` : ""}
      </div>
    `;
  }

  /** The stored words, padded to the scale so an index can always be written. */
  private ratingLabelsFor(count: number): unknown[] {
    const stored = this.nodeDataValue ? RatingScaleService.labels(this.nodeDataValue) : [];

    return Array.from({ length: Math.max(count, stored.length) }, (_unused, index) => stored[index] ?? "");
  }

  private setRatingLabels(labels: unknown[]): void {
    if (!this.nodeDataValue) return;

    this.nodeDataValue.data.labels = labels;
    this.dispatchNodeDataChange("labels", labels);
  }

  private bindRatingLabelEvents(): void {
    const node = this.nodeDataValue;
    const list = this.root.querySelector<HTMLElement>("[data-rating-steps]");

    if (!node || !list) return;

    const count = RatingScaleService.stepCount(node);

    /*
     * The count draws the rows, so a changed count has to redraw them — on
     * `change` and never on `input`, because a redraw between two keystrokes
     * would take the caret out from under the editor. Focus goes back to the
     * field, the way a gated switch's does.
     */
    this.root
      .querySelector<HTMLInputElement>('[data-property="steps"]')
      ?.addEventListener("change", () => {
        this.render();
        this.root.querySelector<HTMLElement>('[data-property="steps"]')?.focus();
      });

    list.querySelectorAll<HTMLInputElement>("[data-rating-label-index]").forEach((field) => {
      field.addEventListener("input", () => {
        const index = Number(field.dataset.ratingLabelIndex);
        const labels = this.ratingLabelsFor(count);
        const current = labels[index];

        // Merged in the active language, so a translation never cuts the source.
        labels[index] = isLocalizedTextMap(current) || this.isTranslationMode()
          ? withLocale(isLocalizedTextMap(current) ? current : undefined, this.activeLocaleValue, field.value)
          : field.value;

        this.setRatingLabels(labels);
      });
    });

    const move = (index: number, target: number): void => {
      const labels = this.ratingLabelsFor(count);

      if (target < 0 || target >= count) return;

      const [moved] = labels.splice(index, 1);
      labels.splice(target, 0, moved);
      this.setRatingLabels(labels);
      this.render();
      this.root
        .querySelector<HTMLElement>(`[data-rating-index="${target}"] [data-rating-label-index]`)
        ?.focus();
    };

    list.querySelectorAll<HTMLButtonElement>('[data-action^="move-rating-step-"]').forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.ratingIndex);
        move(index, button.dataset.action?.endsWith("up") === true ? index - 1 : index + 1);
      });
    });

    /*
     * The same gesture the version list and the answer options use — five
     * rounds of tuning that a third copy would not inherit. The rows have no
     * ids of their own (a step is its place), so the index stands in as one.
     */
    list.querySelectorAll<HTMLButtonElement>('[data-action="drag-rating-step"]').forEach((handle) => {
      handle.addEventListener("pointerdown", (event) => {
        const index = Number(handle.dataset.ratingIndex);

        startReorder(event, {
          id: String(index),
          order: Array.from({ length: count }, (_unused, one) => String(one)),
          container: list,
          itemFor: (id) => list.querySelector<HTMLElement>(`[data-rating-index="${CSS.escape(id)}"]`),
          onCommit: (next) => move(index, next.indexOf(String(index))),
        });
      });
    });
  }

  private bindCardPointerEvents(): void {
    this.root.querySelectorAll<HTMLElement>(".properties-panel__option[data-card]").forEach((card) => {
      card
        .querySelector<HTMLButtonElement>(`[data-action="drag-${card.dataset.card}"]`)
        ?.addEventListener("pointerdown", this.handleCardPointerDown);
    });
  }

  /**
   * Taking hold of a card and arranging the list.
   *
   * The gesture itself is `startReorder`, the same one the version list uses.
   * It was written there over five rounds of reports — *does not work with a
   * finger*, *jumps back and forth*, *a bit too sensitive*, *the row glides
   * down too fast* — and arranging a list should not feel like two different
   * things in one tool depending on which list it is.
   *
   * What was here before worked and said something different: the dragged
   * option faded to almost nothing while the row it would displace lit up a
   * border. It also measured positions while the drag ran, which is harmless
   * only as long as nothing animates — and something animates now.
   *
   * An answer option keeps its own way of *reporting*: one option and where
   * it landed, not the whole order — that is the host's contract and it is
   * unchanged. Rules and calculation rows have no such event; they are
   * written back as the node's list, the way their move buttons always did.
   */
  private readonly handleCardPointerDown = (event: PointerEvent): void => {
    const handle = event.currentTarget;

    if (!(handle instanceof HTMLButtonElement) || !this.nodeDataValue) {
      return;
    }

    const carried = handle.closest<HTMLElement>(".properties-panel__option[data-card]");
    const kind = carried?.dataset.card as CardKind | undefined;
    const id = kind ? carried?.dataset[cardIdKey(kind)] : undefined;
    const list = handle.closest<HTMLElement>(".properties-panel__options");

    if (!carried || !kind || !id || !list) {
      return;
    }

    const itemFor = (one: string) =>
      list.querySelector<HTMLElement>(
        `.properties-panel__option[data-card="${kind}"][data-${kind}-id="${CSS.escape(one)}"]`
      );

    const order = [
      ...list.querySelectorAll<HTMLElement>(`.properties-panel__option[data-card="${kind}"]`),
    ].map((element) => element.dataset[cardIdKey(kind)] ?? "");

    const nodeId = this.nodeDataValue.id;

    /*
     * Folded before the gesture measures, unfolded after the release. The
     * gesture compares the pointer with the carried row's own slot, so an
     * unfolded row (373 px) had to travel ~280 px before it gave way to a
     * folded neighbour (86 px) — measured 28/9. With every row folded, a
     * swap takes one row's height. The shared gesture stays untouched; the
     * open state lives in the set and comes back with the next draw.
     */
    const carriedBody = carried.querySelector<HTMLElement>(`[data-${kind}-body]`);

    if (carriedBody && !carriedBody.hidden) {
      carriedBody.hidden = true;
      carried.removeAttribute(`data-${kind}-open`);
      const unfold = (): void => {
        window.removeEventListener("pointerup", unfold);
        window.removeEventListener("pointercancel", unfold);
        // After the gesture's own handler: a committed move redraws, a
        // cancelled one does not, and either way the set says open.
        setTimeout(() => this.applyCardOpenState(), 0);
      };

      window.addEventListener("pointerup", unfold);
      window.addEventListener("pointercancel", unfold);
    }

    startReorder(event, {
      id,
      order,
      container: list,
      itemFor,
      onCommit: (next) => {
        this.cardFocusAfterMove = { kind, id, action: `drag-${kind}` };
        const targetIndex = next.indexOf(id);

        if (kind === "option") {
          const detail: QuestionOptionReorderDetail = { nodeId, optionId: id, targetIndex };

          this.dispatchEvent(
            new CustomEvent<QuestionOptionReorderDetail>("question-option-reorder", {
              detail,
              bubbles: true,
              composed: true,
            })
          );
          this.announceOptionMove(id, targetIndex, next.length);
          return;
        }

        this.announceMove(carried.dataset.cardName ?? "", targetIndex, next.length);
        if (kind === "rule-case") {
          const cases = this.getRuleCases();
          this.setRuleCases(next.map((one) => cases.find((item) => item.id === one)!).filter(Boolean));
        } else {
          const rows = this.getAssignments();
          this.setAssignments(next.map((one) => rows.find((item) => item.id === one)!).filter(Boolean));
        }
      },
    });
  };

  private addOption(): void {
    if (!this.nodeDataValue) {
      return;
    }

    const options = QuestionOptionsService.parseOptions(
      this.nodeDataValue.data.options
    );

    const newOption = QuestionOptionsService.createOption(options);

    this.optionIdToFocus = newOption.id;
    this.openCardIds.add(newOption.id);

    const updatedOptions = QuestionOptionsService.addOption(options, newOption);

    this.nodeDataValue.data.options = updatedOptions;

    const detail: NodeDataChangedDetail = {
      nodeId: this.nodeDataValue.id,
      property: "options",
      value: updatedOptions,
    };

    this.dispatchEvent(
      new CustomEvent<NodeDataChangedDetail>("node-data-changed", {
        detail,
        bubbles: true,
        composed: true,
      })
    );

    /*
     * The panel must re-render to show the new option's form fields.
     */
    this.render();
  }

  private dispatchOptionChange(field: HTMLInputElement): void {
    if (!this.nodeDataValue) {
      return;
    }

    if (field.dataset.optionProperty === "label") keepOneLine(field);

    const optionElement = field.closest<HTMLElement>("[data-option-id]");

    const optionId = optionElement?.dataset.optionId;
    const optionProperty = field.dataset.optionProperty as
      | "label"
      | "value"
      | "exclusive"
      | undefined;

    if (!optionId || !optionProperty) {
      return;
    }

    const options = QuestionOptionsService.parseOptions(
      this.nodeDataValue.data.options
    );

    let updatedOptions;
    if (optionProperty === "exclusive") {
      /*
       * Av betyder att flaggan TAS BORT, inte att den skrivs som falsk.
       * `exclusive: false` i en sparad guide är brus som ser ut som ett
       * beslut, och frånvaro är vad varje annan läsare redan tolkar rätt.
       */
      updatedOptions = options.map((option) => {
        if (option.id !== optionId) return option;

        const { exclusive: _was, ...rest } = option;

        return field.checked ? { ...rest, exclusive: true } : rest;
      });
    } else if (optionProperty === "label") {
      // The label is merged in the active language; other languages are never cut away.
      const current = options.find((option) => option.id === optionId)?.label;
      const merged =
        isLocalizedTextMap(current) || this.isTranslationMode()
          ? withLocale(current, this.activeLocaleValue, field.value)
          : field.value;
      updatedOptions = options.map((option) =>
        option.id === optionId ? { ...option, label: merged } : option
      );
    } else {
      updatedOptions = QuestionOptionsService.updateOption(
        options,
        optionId,
        optionProperty,
        field.value
      );
    }

    this.nodeDataValue.data.options = updatedOptions;

    const detail: NodeDataChangedDetail = {
      nodeId: this.nodeDataValue.id,
      property: "options",
      value: updatedOptions,
    };

    this.dispatchEvent(
      new CustomEvent<NodeDataChangedDetail>("node-data-changed", {
        detail,
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * A switch or a select that other fields hang on (`showWhen`) redraws the
   * panel.
   *
   * The panel otherwise never redraws on its own change — a redraw while the
   * editor types would take the cursor from under them — and the editor does
   * not hand the node back after a change. Neither a switch nor a select holds
   * a cursor, so here the redraw is safe, and it is the only way the fields
   * behind them appear (or go) before the editor picks another node. Focus goes
   * back to the control, so a keyboard user is where they were.
   *
   * Only a control something actually gates on redraws: *Visas som* is a select
   * like any other, and rebuilding the panel under every one of them would be a
   * flicker with no reason behind it.
   */
  private revealGatedProperties(field: HTMLInputElement | HTMLSelectElement): void {
    const property = field.dataset.property;

    if (!property || !this.nodeDataValue) {
      return;
    }

    const gates = editableProperties(getNodeType(this.nodeDataValue.type)).some(
      (candidate) => candidate.showWhen?.property === property,
    );

    if (!gates) {
      return;
    }

    this.nodeDataValue.data[property] =
      field instanceof HTMLSelectElement ? field.value : field.checked;
    this.render();
    this.root
      .querySelector<HTMLElement>(`[data-property="${property}"]`)
      ?.focus();
  }

  private dispatchPropertyChange(
    field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  ): void {
    if (!this.nodeDataValue) {
      return;
    }

    const property = field.dataset.property;

    if (!property) {
      return;
    }

    let value: unknown;

    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      value = field.checked;
    } else if (field.dataset.valueType === "list") {
      /* Det dolda fältet bär JSON; noden ska ha en riktig array. */
      try {
        const parsed: unknown = JSON.parse(field.value || "[]");

        value = Array.isArray(parsed) ? parsed : [];
      } catch {
        value = [];
      }
    } else if (field.dataset.valueType === "number") {
      value = field.value === "" ? null : Number(field.value);
    } else {
      value = field.value;
    }

    const definition = editableProperties(getNodeType(this.nodeDataValue.type)).find(
      (candidate) => candidate.id === property
    );
    if (definition?.localized === true && typeof value === "string") {
      const current = this.nodeDataValue.data[property];
      // Merge in the active language so other languages are never cut away. A
      // source language with no existing translations is kept as a bare string
      // (canonical).
      value =
        isLocalizedTextMap(current) || this.isTranslationMode()
          ? withLocale(current, this.activeLocaleValue, value)
          : value;
    }

    const detail: NodeDataChangedDetail = {
      nodeId: this.nodeDataValue.id,
      property,
      value,
    };

    this.dispatchEvent(
      new CustomEvent<NodeDataChangedDetail>("node-data-changed", {
        detail,
        bubbles: true,
        composed: true,
      })
    );
  }


  /*
   * Nothing to unwind.
   *
   * The gesture puts its listeners on the window and takes them off when the
   * pointer is released or cancelled — including when the pointer is cancelled
   * by the panel disappearing. It used to be this component's business to
   * remember that, and forgetting it was one leak per drag.
   */
}

if (!customElements.get("properties-panel")) {
  customElements.define("properties-panel", PropertiesPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    "properties-panel": PropertiesPanel;
  }
}

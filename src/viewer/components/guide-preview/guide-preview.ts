import { escapeHtml } from "../../core/escape-html";
import {
  PROVING_MAP_PICTURE,
  PROVING_PLACE_GEOMETRY,
  provingStandInFor,
  type ExampleImage,
  type ProvingStandIn,
} from "./proving-stand-ins";
import styles from "./guide-preview.scss?inline";

import { migrateIncoming } from "../../core/accepted-graph";
import type { FormattingFeature } from "../../types/node-types";
import type { AcceptedGraph } from "../../core/accepted-graph";
import {
  GuideTraversalEngine,
  type GuideAnswerRecord,
  type GuideTraversalError,
} from "../../core/guide-traversal-engine";
import { QuestionOptionsService } from "../../services/question-options-service";
import { RatingScaleService } from "../../services/rating-scale-service";
import { displacedBy } from "../../core/exclusive-choice";
import { getStepRenderer, stepRenderers, type StepContext } from "../../node-types/step-renderers";
import { AnnotationCommentsService } from "../../services/annotation-comments-service";
import { getNodeType, isEndingNodeType } from "../../node-types/node-type-registry";
import { QuestionVariableService } from "../../services/question-variable-service";
import { calloutKind, readNodeString } from "../../node-types/node-fields";
import { CALLOUT_ICONS } from "../../node-types/node-icons";
import type { NodeBehavior } from "../../types/node-types";
import { RuleCasesService } from "../../services/rule-cases-service";
import { CalculationService } from "../../services/calculation-service";
import { ArrivalValueService } from "../../services/arrival-value-service";
import { ServiceCallService } from "../../services/service-call-service";
import { PageFieldsService, type PageField } from "../../services/page-fields-service";
import { PageRepeatService, type PageRepeat } from "../../services/page-repeat-service";
import { PageFieldValidationService } from "../../services/page-field-validation-service";
import { LookupService } from "../../services/lookup-service";
import "../chip-picker/chip-picker";

import {
  answerList,
  answerText,
  isAnswerEmpty,
  isAnswerFields,
  readPath,
  type AnswerFields,
  type AnswerRecord,
  isAnswerRecord,
  type AnswerValue,
  type Answers,
} from "../../core/answer-values";
import { PageVisibilityService } from "../../services/page-visibility-service";
import { getFormat } from "../../core/format-registry";
import { TemplateVariableService } from "../../services/template-variable-service";
import { FormattedTextService } from "../../services/formatted-text-service";
import { resolveDateBound } from "../../core/date-validator";
import {
  acceptPickResult,
  getMapProvider,
  type MapKind,
} from "../../core/map-provider-registry";
import {
  canonicalFormat,
  displayFormat,
  findInPasted,
  maskFormat,
  keyboardFor,
  maskGrouped,
  maskWithPattern,
  ungroup,
  validateFormat,
} from "../../core/format-validators";
import { autocompleteWordFor } from "../../core/autofill";
import {
  DEFAULT_SOURCE_LOCALE,
  FALLBACK_LOCALE,
  getSourceLocale,
  isLocalizedTextMap,
  localeLabel,
  resolveText,
  textDirection,
} from "../../core/localized-text";
import { interpolate, t, uiText } from "../../core/ui-strings";
import { registeredText } from "../../localization/registry";
import { VIEWER_STRINGS } from "../../localization/built-in-strings";
import {
  analyzeGuideRoute,
  findGuidePathsToResult,
  guideProgress,
  longestCountedRoute,
  passedStepsAlongWay,
} from "../../core/guide-route-analyzer";

import { ADD_ICON, TRASH_ICON } from "../../styles/action-icons";
import type { EmailResultOutput, FlowNodeData, GraphData, QuestionOption } from "../../types/graph";
import type { LookupResult } from "../../services/lookup-service";
import type { ChipOption, ChipPickerStrings } from "../chip-picker/chip-picker";

/** Answers a host hands in before the guide starts — see `given`. */
export interface GivenAnswers {
  answers: Answers;
  /** The step to open on: what `getCurrentNodeId()` gave when the host saved. */
  nodeId?: string | null;
}

/**
 * A copy of the host's object with only answers in it. A number or a
 * boolean becomes its text; anything that is not an answer — `null`, a
 * function — is dropped rather than carried into the engine (K11: it is all
 * rendered as text, never as markup, by the same path as a typed answer).
 */
function sanitizeGiven(value: GivenAnswers | null): GivenAnswers | null {
  if (!value || typeof value !== "object" || !value.answers || typeof value.answers !== "object") {
    return null;
  }

  const answers: Answers = {};
  for (const [name, raw] of Object.entries(value.answers)) {
    if (typeof raw === "number" || typeof raw === "boolean") {
      answers[name] = String(raw);
    } else if (typeof raw === "string" || (typeof raw === "object" && raw !== null)) {
      answers[name] = structuredClone(raw);
    }
  }

  return { answers, nodeId: typeof value.nodeId === "string" ? value.nodeId : null };
}

/**
 * The picker as this file uses it.
 *
 * Only the parts the viewer touches: it hands over a search and the words, and
 * reads back the pairs and whatever stands in the search box.
 */
type LookupPicker = HTMLElement & {
  search: (term: string) => Promise<LookupResult>;
  strings: ChipPickerStrings;
  choices: ChipOption[];
  text: string;
};

/**
 * The node types the viewer draws as a step of its own — see `renderNode`.
 *
 * Every other type either has a declarative `behavior` (and is drawn generically
 * from it) or has no visitor view at all: a rule, a calculation and a service
 * call are things the guide *does* between two steps, and nobody ever sees them.
 * The editor asks this before offering the eye in a node's header (story 064),
 * because a button that switches to a view that cannot be drawn is the same lie
 * as a grip in a read-only canvas.
 *
 * A list and not a guess. It is held to the dispatcher by
 * `guide-preview-drawn-as-step.browser.test.ts`, which renders every registered
 * type and compares what came out with what this says — so a new type that gets
 * a rendering here but is left out of the list fails, rather than quietly
 * losing its eye.
 */
/**
 * The viewer's stylesheet, parsed once instead of once per instance.
 *
 * It was written into the shadow root as a `<style>` block on **every render**,
 * which is fine while a page holds one viewer. Story 064 puts one inside every
 * node on the canvas, and this became the same fault the nodes themselves had
 * (see `sharedStyles` in `flow-node.ts`): a hundred and twenty copies of the
 * same twelve kilobytes, parsed again on every redraw.
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

const OWN_STEP_TYPES = new Set([
  "review",
  "image",
  "code",
  "annotated-image",
  "page",
  "result",
]);

/** A variable as it stands in a text: `{{namn}}`, spaces around the name allowed. */
const VARIABLE_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

/**
 * What a visitor reads where a variable has no value yet: an en dash.
 *
 * A character, not a sentence — which is why it is a constant here and not a
 * key in `viewer-strings` (K1 is about text a person reads; "–" is punctuation
 * and reads the same in every language we ship). The day a language needs
 * another mark it becomes a key, and this is the one place that changes.
 *
 * **En dash and not em dash**, measured 13/9: the codebase's three other
 * "no value" marks are em dashes, but guide prose uses the em dash as ordinary
 * punctuation — the quote guide's own sentence is *"— kr är en grov
 * uppskattning — 320 kr per kvadratmeter"*, two em dashes meaning two different
 * things in one line. The shorter mark can be told apart from the punctuation
 * at a glance, which is the whole point of having a mark.
 */
const UNANSWERED_MARK = "–";

/** The mark of a variable: braces. On the chip in a card's foot and in the gap. */
export const VARIABLE_ICON =
  '<svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path d="M6.5 2.5H5A1.5 1.5 0 0 0 3.5 4v2.2c0 .6-.4 1.1-1 1.3.6.2 1 .7 1 1.3V11A1.5 1.5 0 0 0 5 12.5h1.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M9.5 2.5H11A1.5 1.5 0 0 1 12.5 4v2.2c0 .6.4 1.1 1 1.3-.6.2-1 .7-1 1.3V11a1.5 1.5 0 0 1-1.5 1.5H9.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

/**
 * `{{applicantName}}` as a gap carrying the variable's *label* — "Sökandens
 * namn" — out of the same list the variable chooser draws from, falling back to
 * the bare name when the guide has no question behind it. One function for
 * both pictures of the guide on the canvas: the visitor's view here and the
 * structure view on the card (Johan 3/9: the raw name is a developer's word
 * there too). `html` is already escaped; the label is escaped on the way in.
 *
 * The gap carries the variable's mark, so a gap and a chip read as the same
 * kind of thing, and the mark carries the emphasis: no italics, and normal
 * weight even inside a bold heading (Johan 3/9).
 *
 * `locale` is the card's language (story 080): an English card shows the
 * English alias, so a gap never speaks Swedish inside an English sentence.
 */
export function variableGaps(
  html: string,
  graph: GraphData | null | undefined,
  className: string,
  locale?: string,
): string {
  return html.replace(VARIABLE_PATTERN, (_whole, name: string) => {
    const label = graph
      ? QuestionVariableService.getOptions(graph, locale).find(
          (option) => option.value === name,
        )?.label
      : undefined;

    return `<span class="${className}">${VARIABLE_ICON}${escapeHtml(label ?? name)}</span>`;
  });
}

export function drawnAsStep(nodeType: string): boolean {
  return (
    OWN_STEP_TYPES.has(nodeType) ||
    getStepRenderer(nodeType) !== null ||
    Boolean(getNodeType(nodeType)?.behavior)
  );
}

/**
 * A field's place on a page that repeats (story 084): `f-name#1` is node
 * `f-name` in record 1. The separator is one no node id contains — ids are
 * generated, never typed — and the three readers below (plus `fieldAt` in
 * flow-node, through `nodeIdOf`) are the only ones that take it apart.
 */
const RECORD_SEPARATOR = "#";

/** Exported for the canvas: a click in the view names a field key, the panel wants the node. */
export const nodeIdOf = (fieldKey: string): string => {
  const at = fieldKey.lastIndexOf(RECORD_SEPARATOR);
  return at === -1 ? fieldKey : fieldKey.slice(0, at);
};

const recordIndexOf = (fieldKey: string): number | null => {
  const at = fieldKey.lastIndexOf(RECORD_SEPARATOR);
  return at === -1 ? null : Number(fieldKey.slice(at + 1));
};

/**
 * The `autocomplete` a field on a page carries: the word, with a `section-`
 * in front of it on a page that repeats (story 110).
 *
 * Without one, every group of a repeating page offers the browser the same
 * word and it fills them all with the same person. The token is opaque — it
 * only has to differ between groups — so it is the record's own index, the
 * number already standing in `data-repeat-group` beside it.
 */
const sectioned = (word: string | undefined, fieldKey: string): string | undefined => {
  if (!word) return undefined;

  const record = recordIndexOf(fieldKey);

  return record === null || !Number.isInteger(record) ? word : `section-${record} ${word}`;
};

/** The list of records an answer holds; anything else is no records. */
const recordsOf = (value: AnswerValue | undefined): AnswerRecord[] =>
  Array.isArray(value) ? value.filter(isAnswerRecord) : [];

/**
 * One record out of one group's form values.
 *
 * A record's fields are strings: what a lookup or a marked picture carries
 * beside its text — the code, the marks — is not kept inside a record yet.
 * Kept by the text, not dropped, so a visitor's typing survives a re-render;
 * a guide that needs the code per child is the guide that widens this.
 */
const recordOf = (values: Answers): AnswerRecord =>
  Object.fromEntries(Object.entries(values).map(([name, value]) =>
    // A lookup's pair stays a pair (story 090); a list is text, as before.
    [name, typeof value === "string" || isAnswerFields(value) ? value : answerText(value)]));

/**
 * The name an example photo gets as a file: the last segment of its address.
 *
 * The visitor sees it in the field and in the review step, and the host reads
 * it as `file.name` when the guide is submitted — so it has to be the file's
 * own name and not a word we made up. Query and fragment are cut first: an
 * address with a cache-buster is still a photo called `testbil.jpg`.
 */
const exampleFileName = (address: string): string => {
  const name = (address.split(/[?#]/)[0] ?? "").split("/").pop() ?? "";

  // Only for an address that ends in a slash — a name is needed either way,
  // because an empty one would leave the field looking unanswered.
  return name || "example.jpg";
};

/** The three facts about a step's example photo, or nothing when it has none. */
const exampleImageOf = (field: PageField): ExampleImage | null =>
  field.exampleImage
    ? {
        src: field.exampleImage,
        name: exampleFileName(field.exampleImage),
        alt: field.exampleImageAlt ?? "",
      }
    : null;

/** A field being validated: its DOM key, the field, what it holds. */
interface PageSlot {
  key: string;
  field: PageField;
  value: string;
}

export class GuidePreview extends HTMLElement {
  private readonly root = (() => {
    const root = this.attachShadow({ mode: "open" });

    if (sharedStyles) {
      root.adoptedStyleSheets = [sharedStyles];
    }

    /*
     * Which variables the visitor has CHANGED on the step in front of them
     * (story 118, criterion 7).
     *
     * One listener on the shadow root, attached once. The root survives every
     * redraw — `render` replaces its `innerHTML`, never the root itself — so a
     * listener here outlives the markup it watches, and the set is component
     * state rather than a DOM attribute for the same reason.
     *
     * **Measured 15/9, because the guess was wrong.** A page redraws *zero*
     * times per keystroke: typing updates the calculated text in place and
     * `render` is not called at all. What does redraw the same step is a
     * refused *Nästa*, and that is the redraw the touches have to survive —
     * which is why the clearing in `render` is conditioned on the node having
     * changed rather than on anything about typing. Two mutations passed
     * before the probe was written, both because they were measuring a redraw
     * that never happened.
     *
     * `input` and `change`, and CHANGED rather than focused: Tab walks through
     * every field on a page without anybody having looked at one.
     *
     * The slider needs nothing of its own. It writes into the field and
     * dispatches the field's own `input` (see `renderNumberControls`), so a
     * drag arrives here as a change to the field's variable — which is what
     * makes a slider and a start value one mechanism instead of two.
     */
    const remember = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const named = target?.closest?.("[data-page-variable]");
      const name = named?.getAttribute("data-page-variable")
        ?? (target?.matches?.("[data-number-answer], [data-text-answer]")
          ? this.currentStepVariable()
          : "");

      if (name) this.touchedVariables.add(name);
    };

    root.addEventListener("input", remember);
    root.addEventListener("change", remember);

    /*
     * An own step tried again (Johan 1/10, *"ja, onblur eller onchange"*):
     * on `change` for a choice, a box, a date or a file, on `chip-change`
     * for a search box, and on `focusout` for a field that is typed into —
     * never on `input`, so the alert under it says nothing new per
     * keystroke. A page's fields are wired where they are drawn
     * (`updatePage`), and keep that.
     *
     * Only from the step's own controls. *Nästa* leaves focus too, and the
     * redraw after a refusal took it away: a re-test on that focusout asked
     * the field rules about the answer the engine had just refused for
     * another reason (*"leder inte vidare"*), found nothing, and wiped the
     * engine's words the moment they were drawn.
     */
    const retry = (event: Event) => {
      const target = event.composedPath()[0] as Element | undefined;
      if (!target?.closest?.("input, select, textarea, chip-picker")) return;
      if (this.engine?.getCurrentNode()?.type !== "page") this.refreshPageFieldErrors();
    };
    root.addEventListener("change", retry);
    root.addEventListener("chip-change", retry);
    root.addEventListener("focusout", retry);

    return root;
  })();
  /**
   * Cleared when the visitor moves to another node — see `render`. It is never
   * stored and never leaves this component: once Next is pressed the value is
   * an answer like any other, so *touched* has nothing left to say.
   */
  private readonly touchedVariables = new Set<string>();

  /**
   * The variable of the question standing on its own step, for the listener
   * above: a step's field carries `data-number-answer` or `data-text-answer`
   * and no variable name, because there is only ever one of it.
   */
  private currentStepVariable(): string {
    const node = this.engine?.getCurrentNode();
    return typeof node?.data.variableName === "string" ? node.data.variableName : "";
  }
  private engine: GuideTraversalEngine | null = null;
  /*
   * The engine's errors, plus the one the door raises before an engine exists.
   * A refusal at the door is not a traversal fault, so it does not belong in the
   * engine's union — but it reaches the resident through the same surface.
   */
  private error: GuideTraversalError | { code: "graph-refused"; message: string } | null = null;
  /*
   * A refused answer on a step of its own: *Välj minst ett alternativ.*
   *
   * It used to travel as `error` above and be drawn in a pink box over the
   * card — outside it, above the heading, nowhere near the radios it was
   * about (genomgången 30/9, V4). Astra 1/10 (bilaga 10, punkt 6): the
   * message stands directly under the control, for a group of radios or
   * boxes under the whole group, and everything stays inside the card. So it
   * is its own field, drawn by `placeStepError` into the card, and `error`
   * keeps what is not about the visitor's answer: a refused guide, a way out
   * that leads nowhere.
   */
  private stepError: string | null = null;
  private emptyMessage = "Ingen guide har valts.";
  private showStepIndicator = true;

  /**
   * The step drawn last, so `render` knows whether the card is a new step or
   * the same one drawn again. The slide-in is for the first; a redraw — the
   * other mirror's draft per keystroke, a rejected page's errors — replays it
   * from opacity zero, and the panel beside the canvas blinked for every
   * letter typed (Johan, the children film 7/9: "panelen till höger
   * fladdrar").
   */
  private renderedNodeId: string | null = null;
  /** The share the bar was last drawn at, so the next one can grow from it. */
  private shownPercent: number | null = null;
  private routeAnalysisEnabledValue = true;
  private highlightedFieldId: string | null = null;
  private readonly pageFieldErrors = new Map<string, string>();
  /** Ids for the shape notes, so `aria-describedby` has something to point at. */
  private shapeNoteCounter = 0;

  /**
   * What was typed on a page that did not pass validation.
   *
   * ## The fault
   *
   * Reported from a tablet: an invalid organisationsnummer, personnummer and
   * ärendenummer, one press of the button, and **everything was gone** — only
   * the photo survived. Measured: nine filled fields before, one after.
   *
   * A page renders its fields from `engine.getAnswers()`, and a page that fails
   * validation never reaches `answerPage()` — so nothing was stored, and the
   * re-render that puts the error messages on screen puts empty fields under
   * them. The values existed the whole time, in the `values` map read out of the
   * DOM a line earlier, and were thrown away.
   *
   * The photo survived because files are held in `heldFiles` and put back on a
   * re-rendered input. Text had no such thing. This is the same idea for the
   * rest of the form: what somebody typed is theirs until they leave the page.
   *
   * Cleared wherever the step changes, so a draft can never leak onto a page it
   * did not come from.
   */
  private pageDraft: Answers | null = null;

  /*
   * Flervalslistans utkast, och vad den senast sa.
   *
   * Motorn lagrar ett svar först när man går vidare, men etiketterna måste
   * ändras i samma ögonblick man klickar — annars ser kontrollen trasig ut.
   * Nyckeln är nodens id, så ett utkast aldrig kan hamna på fel fråga när man
   * går bakåt och fram igen.
   */
  private choiceDraft: { nodeId: string; values: string[] } | null = null;
  private variableInspectorEnabledValue = true;
  private reviewDeclarationEnabledValue = true;
  private variableInspectorOpen = false;
  private activeLocaleValue: string = DEFAULT_SOURCE_LOCALE;
  /** Vilken kommentar (0-index) som visas på en annoterad bild just nu. */
  private annotationStep = 0;

  /**
   * Resolves a translatable text in the chosen language.
   *
   * The guide's own source language is passed, not the module default. Without
   * it an English-authored guide with a partial Swedish translation answered a
   * reader who asked for Arabic in Swedish — the wrong language, and one that
   * looks like a translation rather than a fault.
   */
  private localized(value: unknown, fallback = ""): string {
    return resolveText(
      value,
      this.activeLocaleValue,
      fallback,
      getSourceLocale(this.guideGraph()),
    );
  }

  /** Fast visartext (knapp m.m.): guidens override om satt, annars default. */
  private chrome(key: string, params?: Record<string, string | number>): string {
    const graph = this.guideGraph();
    const text = uiText(
      key,
      graph?.settings?.strings,
      this.activeLocaleValue,
      getSourceLocale(graph)
    );
    return params ? interpolate(text, params) : text;
  }

  /**
   * A word of the EDITOR's, shown inside the viewer — the run's stand-in
   * buttons and nothing else so far.
   *
   * Not `chrome()`: that reads the viewer registry, which a guide may reword
   * per guide (story 017), and these are the tool's own words about its own
   * make-believe. The locale is the guide's rather than the editor's, because
   * the button stands among fields drawn in the guide's language and a Swedish
   * button in an English form would read as a bug. `guide-preview` has no
   * editor locale of its own, and plumbing one through for two buttons would be
   * a second language axis in a component that has one.
   */
  private editorText(key: string): string {
    return t(key, this.activeLocaleValue);
  }

  /** Fortsätt-knappens text: nodens egen (t.ex. en sida) → guide → default. */
  private continueLabel(): string {
    const node = this.engine?.getCurrentNode();
    const own = this.localized(node?.data.continueLabel);

    if (own) return own;

    return this.chrome(this.nextStepEntersWith(node) ?? "nav.next");
  }

  /**
   * Leder knappen rakt in i en inlämning?
   *
   * Ordet på knappen ska följa vad som HÄNDER, inte vilken nod man står på.
   * En granskningssida är sista steget före inlämningen i varje formulär
   * stommen bygger, och där betyder ett tryck att ärendet lämnas ifrån sig.
   *
   * Bara den direkta fortsättningen räknas. Ligger det en regel mellan
   * granskningen och inlämningen vet ingen förrän svaren vägts vart det tar
   * vägen, och en knapp som gissar fel vore värre än en som säger "Nästa".
   */
  private nextStepEntersWith(node: FlowNodeData | null | undefined): string | null {
    const graph = this.graph;

    if (!graph || !node) return null;

    const line = graph.connections.find(
      (one) => one.from.nodeId === node.id && one.from.portId === "continue",
    );

    // The step's own renderer says what the button into it should read (story 147).
    const next = graph.nodes.find((one) => one.id === line?.to.nodeId);
    return next ? (getStepRenderer(next.type)?.entersWith ?? null) : null;
  }

  /**
   * `active-locale` mirrors `guide-editor`'s attribute of the same name.
   *
   * The viewer took its language through the `activeLocale` property only, so a
   * host embedding `<guide-preview>` in plain HTML had no way to say which
   * language to show — and `setAttribute("active-locale", …)` did nothing at
   * all, silently. Story 016 gave the editor the attribute; the viewer is the
   * half a host actually publishes.
   */
  static get observedAttributes(): string[] {
    /*
     * `proving` is observed so that setting it can never be too late.
     *
     * It was not, and the run on the canvas was drawn before the attribute
     * arrived (`flow-node.applyLiveStep` mirrored first and set second). The
     * file step got away with it — its refusal redrew the card and the button
     * appeared — but the map step has no redraw to be rescued by: "Nästa" is
     * off until the field carries a label, and the button that would have
     * given it one was never rendered. The run stopped dead.
     *
     * The caller's order is fixed too, so the ordinary path still draws once.
     * Both, because either alone leaves half the fault: an order is a thing
     * the next caller can get wrong again, and an attribute nobody watches is
     * a thing that only works when somebody remembers. Removing an attribute
     * that is not there mutates nothing and calls nothing back, so the nodes
     * that are not the current step cost the same as before.
     */
    return ["answer-display", "active-locale", "proving", "example-files"];
  }

  /**
   * Properties set before the element upgraded. A common state when the library
   * is loaded as a script tag: the page manages to set `.graph` before the
   * bundle registered the class. The value then lands as an OWN property on the
   * instance and shadows the prototype's setter, which therefore never runs —
   * the guide comes out empty, with no error. Remove the own property and set
   * the value again, so the setter gets to do its job.
   */
  private static readonly UPGRADABLE = [
    "given",
    "graph",
    "activeLocale",
    "routeAnalysisEnabled",
    "variableInspectorEnabled",
    "reviewDeclarationEnabled",
  ] as const;

  private upgradeProperties(): void {
    const self = this as unknown as Record<string, unknown>;
    for (const name of GuidePreview.UPGRADABLE) {
      if (!Object.prototype.hasOwnProperty.call(this, name)) continue;
      const value = self[name];
      delete self[name];
      self[name] = value;
    }
  }

  connectedCallback(): void {
    this.upgradeProperties();
    this.render();
    this.watchWidth();
  }

  disconnectedCallback(): void {
    this.widthWatcher?.disconnect();
    this.widthWatcher = null;
  }

  /*
   * The viewer's container query, done by the component.
   *
   * The stylesheet used `@container` on the host's width — a narrow host in a
   * wide window is the ordinary embedding, so the window's width says nothing.
   * `@container` and `:has()` were the two rules that set the viewer's browser
   * floor (K18: Safari 16, Firefox 121); everything else the viewer ships runs
   * from Safari 15.4. So the width is measured here instead and written as
   * `data-under`, a list of every threshold the host is narrower than or equal
   * to, and the stylesheet matches with `:host([data-under~="400"])`.
   *
   * Measured once, synchronously, on connect — so the first paint already has
   * the right layout — and then from the observer, one frame late: the
   * attribute changes the card's padding, which changes the host's height,
   * which the observer sees as another resize in the same pass and reports as
   * "ResizeObserver loop completed with undelivered notifications" (the test
   * runner treats that as an error). Writing in the next frame ends the loop.
   */
  /*
   * 480: the rating scale stands as a list at or under it (Astra 1/10,
   * bilaga 10 punkt 16: *"staplad lista under 480 px tillgänglig
   * komponentbredd, inte hela webbläsarens bredd"*).
   */
  private static readonly WIDTH_THRESHOLDS = [560, 480, 420, 400];

  private widthWatcher: ResizeObserver | null = null;

  private watchWidth(): void {
    if (this.widthWatcher) return;
    const apply = (width: number): void => {
      const under = GuidePreview.WIDTH_THRESHOLDS.filter((limit) => width <= limit).join(" ");
      if (under) {
        if (this.dataset.under !== under) this.dataset.under = under;
      } else if ("under" in this.dataset) {
        delete this.dataset.under;
      }
    };
    apply(this.getBoundingClientRect().width);
    this.widthWatcher = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? this.clientWidth;
      requestAnimationFrame(() => apply(width));
    });
    this.widthWatcher.observe(this);
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "active-locale") {
      // Through the setter, so the engine hears about it too. A render that
      // only redrew would keep answering in the old language.
      this.activeLocale = value ?? DEFAULT_SOURCE_LOCALE;
      return;
    }
    if (this.isConnected) {
      this.render();
    }
  }

  /**
   * A light or dark theme for the viewer. `null` means follow the OS setting.
   *
   * The editor has had this since it was built; the viewer never got it, and the
   * consequence only showed when a dark page was recorded — the guide sat as a
   * white card in a dark page. Measured: the page's tokens were dark
   * (`--fw-surface: #161b26`) while the card computed `rgb(255,255,255)`,
   * because the tokens hang off `data-fw-theme` and nothing was setting it here.
   *
   * Set on the **element**, not on the document, for the same reason as in the
   * editor: a viewer embedded in a host's page must not recolour the page around
   * it. `data-fw-theme` and not `data-theme` — the latter is a convention the
   * host may be using for itself.
   */
  set theme(value: "light" | "dark" | null) {
    if (value) {
      this.dataset.fwTheme = value;
    } else {
      delete this.dataset.fwTheme;
    }
  }

  get theme(): "light" | "dark" | null {
    const value = this.dataset.fwTheme;
    return value === "dark" || value === "light" ? value : null;
  }

  /** Sets the viewer's theme. `null` hands the decision back to the OS setting. */
  setTheme(theme: "light" | "dark" | null): void {
    this.theme = theme;
  }

  /**
   * The door. Everything from outside is lifted to today's format here.
   *
   * It was not, and the editor was — so a guide the editor could open and edit
   * rendered **an empty page for the resident, with no error at all**. Measured
   * on a v3 page: `fält=0` set raw against `fält=2` set migrated, no error
   * either way. K7 says an older guide must load, and the viewer is what a
   * resident meets.
   *
   * The lifting itself lives in `accepted-graph.ts`, where the editor reaches
   * for the same function rather than a second copy of the rule.
   */
  set graph(value: GraphData) {
    // Robotskyddets klocka och inlämningens biljett hör till EN genomgång.
    this.guideStartedAt = Date.now();
    this.resetStepRenderers();

    const incoming = migrateIncoming(value);

    if (!incoming.ok) {
      /*
       * Refused, and said so. The alternative is what this replaced: a graph
       * from a newer version drawn with today's rules, missing whatever a node
       * type we do not have would have rendered — a page that looks badly built
       * rather than one that is too new to draw.
       */
      this.engine = null;
      this.graphSnapshot = null;
      this.error = { code: "graph-refused", message: incoming.message };

      if (this.isConnected) {
        this.render();
      }

      return;
    }

    this.#loadGraph(incoming.graph);
  }

  /**
   * Applies a graph that has been through the door.
   *
   * Takes an `AcceptedGraph`, which only `migrateIncoming` produces — so a new
   * entrance that skips the migration is a compile error rather than fields
   * that quietly fail to appear in a published guide. The editor's `loadGraph`
   * carries the same brand for the same reason; this is the fault it was built
   * against, found on the other component.
   */
  /*
   * `#`-privat, inte TS-privat.
   *
   * TypeScripts `private` finns bara vid kompilering: en värd som skriver ren
   * JS kunde anropa `element.loadGraph(graf)` och hoppa förbi dörren — alltså
   * förbi migreringen och de två kontrollerna den gör. Märkningen skyddar mot
   * misstag i vår egen kod; det här stänger vägen utifrån.
   */
  #loadGraph(value: AcceptedGraph): void {
    // The attribute may have been set before the graph, or before the element
    // upgraded. Read it here so the first render is already in the right
    // language rather than flashing the source and correcting itself.
    const declared = this.getAttribute("active-locale");
    if (declared) {
      this.activeLocaleValue = declared;
    }
    /*
     * `today="ÅÅÅÅ-MM-DD"` is the host's day (story 086, AC 5) — a test rig,
     * or a run to be reproduced. Read when the graph lands, as the locale
     * is: it is the run's day, and a run does not change its day halfway.
     */
    this.engine = new GuideTraversalEngine(value, {
      locale: this.activeLocaleValue,
      today: this.getAttribute("today") ?? undefined,
    });
    this.graphSnapshot = this.engine.getGraph();
    this.error = null;
    this.emptyMessage = "Ingen guide har valts.";
    this.showStepIndicator = true;
    this.highlightedFieldId = null;
    this.annotationStep = 0;
    this.pageFieldErrors.clear();
    this.pageDraft = null;
    this.resetChoiceDraft();
    this.provingStandIns.clear();
    this.applyGiven(true);

    if (this.isConnected) {
      this.render();
    }
  
    this.dispatchProgress("start", this.engine?.getCurrentNode()?.id);
  }

  private graphSnapshot: GraphData | null = null;

  /**
   * The guide, copied once when it is loaded rather than once per read.
   *
   * `engine.getGraph()` hands out a `structuredClone`, which is right — the
   * engine's own copy is not anybody's to change. It was called twenty-four
   * times from this file, several of them per render, so drawing one step
   * deep-copied the whole guide a dozen times over.
   *
   * Invisible while there is one viewer on a page. Story 064 puts one inside
   * every node on the canvas, and it turned into the shape this codebase has
   * met before (`get nodeData`, in the canvas's own scale test): time growing
   * with the square of the guide. Measured on a 120-node guide, drawing one
   * step took 12 ms with a 120-node graph against 5 ms with a 3-node one —
   * while the migration and the engine together cost 1.4 ms. The rest was
   * copying.
   *
   * One copy at load is equivalent: the graph does not change while a guide is
   * being answered — answers do, and they live beside it.
   */
  private guideGraph(): GraphData | undefined {
    return this.graphSnapshot ?? undefined;
  }

  get graph(): GraphData | null {
    // A copy, because this one leaves the component: a host that changes what
    // it is handed must not be changing the guide the viewer is running.
    return this.engine?.getGraph() ?? null;
  }

  /** Språket förhandsgranskningen visas i; faller tillbaka på källan. */
  set activeLocale(value: string) {
    this.activeLocaleValue = value;
    this.engine?.setLocale(value);

    if (this.isConnected) {
      this.render();
    }
  }

  set routeAnalysisEnabled(value: boolean) {
    this.routeAnalysisEnabledValue = value;

    if (this.isConnected) {
      this.render();
    }
  }

  get routeAnalysisEnabled(): boolean {
    return this.routeAnalysisEnabledValue;
  }

  set variableInspectorEnabled(value: boolean) {
    this.variableInspectorEnabledValue = value;

    if (this.isConnected) {
      this.render();
    }
  }

  get variableInspectorEnabled(): boolean {
    return this.variableInspectorEnabledValue;
  }

  /**
   * The declaration under the review — *Det här byggde beskedet på* and the
   * list of headings — is the host's to switch off, like the variable
   * inspector. On an example page it shows a visitor what a decision rests
   * on; on a page where a real person registers interest there is no
   * decision, and four headings repeated under her own answers read as a
   * demonstration of the tool. Default on, so no other guide changes.
   */
  set reviewDeclarationEnabled(value: boolean) {
    this.reviewDeclarationEnabledValue = value;

    if (this.isConnected) {
      this.render();
    }
  }

  get reviewDeclarationEnabled(): boolean {
    return this.reviewDeclarationEnabledValue;
  }
  /**
   * Files chosen but not sent anywhere — the default, and the cheaper model.
   *
   * A `File` from a picker is a handle to something on disk, not the bytes in
   * memory, so carrying one through ten steps costs nothing. Most forms are sent
   * in a single go, and then nothing needs to travel before the end: no durable
   * storage, no reference to resolve, nothing left behind to sweep up.
   *
   * They live here rather than only on the input because a page is re-rendered
   * when somebody goes back to it, and a fresh input has no file on it. The
   * answer would then name an attachment we no longer had.
   *
   * `variableName` is kept beside the file for the same reason: `getFiles()` is
   * called once the guide has reached its result, and the field's markup is long
   * gone by then.
   */
  private heldFiles = new Map<string, { variableName: string; file: File }>();

  /*
   * Story 047: the resident's marks on their own picture. Percent
   * coordinates — the annotated-image form, resolution-independent — held
   * beside the file for the same reason the file is: a re-render builds
   * fresh markup, and the marks must survive it. The photo is never
   * altered; these are data beside it, stored via a hidden field in
   * `{variableName}Markeringar`.
   */
  private heldMarks = new Map<string, { x: number; y: number; text: string }[]>();
  private markingUrls = new Map<string, string>();

  /**
   * The stand-ins a run has put in, per field — story 065's follow-up.
   *
   * Deliberately NOT `heldFiles`. A stand-in is a name and, for a picture,
   * something to draw marks on; it is never a `File`, so `getFiles()` and
   * `getFormData()` cannot carry one into a submission however a host asks.
   * "Only in the run" is then a property of the code rather than a cleanup
   * somebody has to remember — and the cleanup below is only so a run that
   * starts over does not draw the last one's picture.
   */
  private provingStandIns = new Map<string, ProvingStandIn>();

  /**
   * What the picture in a field shows, where the picture is the step's own
   * example photo — story 108.
   *
   * One map for both halves of the story: the run's stand-in and the visitor's
   * attached file both put the editor's alt text here, and the marking surface
   * reads it from one place. A picture a person chose themselves has no entry —
   * we have nothing true to say about it, and inventing a description would be
   * worse than the empty `alt` a photo beside its own heading already has.
   */
  private exampleAlts = new Map<string, string>();

  private givenValue: GivenAnswers | null = null;

  /**
   * The files this guide is holding, for a host that is about to submit.
   *
   * Stands beside `getAnswers()` and answers the same question about a kind of
   * answer that cannot live in JSON. A guide has no *submit* of its own — it
   * reaches a result, which the host sees on `preview-node-changed` — so there
   * is no event here, only something to ask.
   */
  getFiles(): { fieldId: string; variableName: string; file: File }[] {
    return Array.from(this.heldFiles, ([fieldId, held]) => ({
      fieldId,
      variableName: held.variableName,
      file: held.file,
    }));
  }

  /**
   * Everything the guide holds, encoded the way the browser encodes a form.
   *
   * We cannot use the browser's *submit* — that is a navigation, and a guide ends
   * on a result we render rather than by leaving the page. But the *encoding* is
   * reusable, and it is the half hosts get wrong: a hand-rolled body drops the
   * `filename`, or is urlencoded and carries the name with zero bytes, silently.
   * `fetch` with a `FormData` body always writes multipart with a boundary, so
   * that whole class of mistake is gone by construction.
   *
   * ```js
   * await fetch("/api/ansokan", { method: "POST", body: preview.getFormData() });
   * ```
   *
   * **A file variable appears once, as the file.** A real form with
   * `<input type="file" name="cv">` produces one part — the file, carrying
   * `filename="cv.pdf"` — and no second text part repeating the name. Appending
   * both would make `data.get("cv")` return the string and hide the file behind
   * it, which is exactly the sort of thing that works in a test and loses an
   * attachment in production.
   *
   * Composable from `getAnswers()` and `getFiles()` in a few lines, which is an
   * argument against having it at all — see PRAXIS rule 15. It is here because
   * the Sitevision integration has to post multipart either way, and the trap
   * above is better sprung once here than once per host.
   */
  getFormData(): FormData {
    const data = new FormData();
    const files = this.getFiles();
    const asFile = new Set(files.map((held) => held.variableName).filter(Boolean));

    // Answers first, then files. Order carries no meaning in multipart — a
    // real form uses document order, and a parser is not allowed to care.
    const graph = this.guideGraph();
    Object.entries(this.getAnswers()).forEach(([name, value]) => {
      if (asFile.has(name)) return;

      /*
       * A repeating page's records (story 084): one part per field and record,
       * `barn[0].namn` — the name the answer record already carries — as a
       * form with named fields would have sent them. `answerText` of the list
       * is an empty string, and an empty part is a silent loss.
       */
      if (PageRepeatService.pageFor(graph, name)) {
        recordsOf(value).forEach((record, index) =>
          Object.entries(record).forEach(([field, one]) => data.append(`${name}[${index}].${field}`, answerText(one))),
        );
        return;
      }

      data.append(name, answerText(value));
    });

    files.forEach(({ fieldId, variableName, file }) => {
      /*
       * A field with no variable name cannot be referred to from the guide, but
       * the file is still real and losing it quietly would be the worse fault.
       * It goes under the field's id so the host has something to key on.
       */
      // No third argument: `append` takes the filename off the `File` itself.
      // Passing `file.name` as well read as belt-and-braces and was dead — a
      // mutation removing it broke nothing, which is how it was found.
      data.append(variableName || `file-${fieldId}`, file);
    });

    return data;
  }


  /**
   * The options as a STILL, opened list under a closed control (select or the
   * single chip-picker) — the editor's viewing mode only. A control that hides
   * its options leaves the node's exit rings underivable (Johans bild 2/9:
   * "Inget valt än · 2 alternativ" and two mute rings); drawn open, the rows
   * carry data-option-id and the rings slide onto them like the radio rows.
   * Never in the real viewer, never in a run — there the control is real.
   */
  private renderOpenOptionList(
    node: FlowNodeData,
    options: QuestionOption[],
    isChosen: (option: QuestionOption) => boolean,
  ): string {
    if (!this.revealsHiddenFields()) return "";

    /*
     * The cap for long lists (kartläggningens princip 2): at most four rows,
     * then "N fler" — but only UNCONNECTED options may hide behind it. A row
     * a line leaves from must stay visible, or the line has nothing to be
     * derived from. The fler row carries no data-option-id, so it gets no
     * ring; the hidden options' rings keep their labels instead (princip 3,
     * the reserve — see flow-node.scss).
     */
    const connected = new Set(
      this.connectedPortIds ??
        (this.guideGraph()?.connections ?? [])
          .filter((connection) => connection.from.nodeId === node.id)
          .map((connection) => connection.from.portId),
    );

    /*
     * Strict four, connected first in original order. Earlier the connected
     * always survived the cap — but with the collective port in place their
     * overflow lines have somewhere honest to go, and a list that grows
     * without bound is what the cap exists to stop (Johans fråga 2/9: "hur
     * ser det ut om det går två linjer från den porten?").
     */
    const keep = new Set<string>();
    for (const option of options) {
      if (keep.size < 4 && connected.has(option.id)) keep.add(option.id);
    }
    for (const option of options) {
      if (keep.size < 4 && !keep.has(option.id)) keep.add(option.id);
    }
    const shown =
      options.length <= 4
        ? options
        : options.filter((option) => keep.has(option.id));
    const hiddenCount = options.length - shown.length;

    return `
      <div class="guide-preview__open-list" aria-hidden="true">
        ${shown
          .map(
            (option) => `
              <span class="guide-preview__open-list-row${isChosen(option) ? " guide-preview__open-list-row--chosen" : ""}" data-option-id="${escapeHtml(option.id)}">
                ${escapeHtml(this.localized(option.label))}
              </span>
            `,
          )
          .join("")}
        ${
          hiddenCount > 0
            ? `<span class="guide-preview__open-list-row guide-preview__open-list-row--more" data-open-list-more>${escapeHtml(
                this.editorText("editor.openList.more").replace(
                  "{count}",
                  String(hiddenCount),
                ),
              )}</span>`
            : ""
        }
      </div>
    `;
  }

  getAnswers(): Answers {
    return this.engine?.getAnswers() ?? {};
  }

  /**
   * What a field is filled in with: the run's scope, and behind it what the
   * visitor wrote on steps gone back over (engine `getPrefill`, 6/9 2026).
   * Only for drawing fields — everything that *reads* an answer (a template,
   * an email, the submission, `getAnswers()`) reads the run, so a value from
   * a branch the visitor left is shown in its field if they return, and
   * nowhere else.
   */
  private prefill(): Answers {
    return { ...(this.engine?.getScope() ?? {}), ...(this.engine?.getPrefill() ?? {}) };
  }

  getOutput(): EmailResultOutput | null {
    const node = this.engine?.getCurrentNode();
    const renderer = node ? getStepRenderer(node.type) : null;
    return node && renderer?.output
      ? ((renderer.output(node, this.stepContext()) as EmailResultOutput | null) ?? null)
      : null;
  }
  getCurrentNodeId(): string | null {
    return this.engine?.getCurrentNode()?.id ?? null;
  }

  /**
   * What the host already knows (story 085): a visitor's name and
   * personnummer from a login, or a run it saved — `getAnswers()` and
   * `getCurrentNodeId()` handed back. Kept, so it can be set before the
   * guide arrives and holds through *Börja om*: the visitor is still who
   * the host said, so the fields they never had to fill stay filled. The
   * step is only taken at a load — a restart is the start.
   *
   * Nothing is locked (Avgjort 3/9): every value lands in a field the
   * visitor can change, and is validated as if they had typed it. A name
   * no node declares is kept — a text or a rule may still read it — and
   * reported (`unmatchedGiven`), so a field that stayed empty can be
   * explained. `idag` is the engine's and is overwritten (story 086).
   */
  set given(value: GivenAnswers | null) {
    this.givenValue = sanitizeGiven(value);
    this.applyGiven(true);

    if (this.isConnected) {
      this.render();
    }
  }

  get given(): GivenAnswers | null {
    return this.givenValue ? structuredClone(this.givenValue) : null;
  }

  /** The given names no node in the guide declares as a variable. */
  unmatchedGiven(): string[] {
    const graph = this.guideGraph();
    if (!graph || !this.givenValue) return [];

    return QuestionVariableService.undeclared(graph, Object.keys(this.givenValue.answers));
  }

  private applyGiven(takeStep: boolean): void {
    if (!this.engine || !this.givenValue) return;

    this.engine.seedAnswers({ ...this.engine.getAnswers(), ...this.givenValue.answers });

    const nodeId = this.givenValue.nodeId;
    if (takeStep && nodeId && !this.engine.goToNode(nodeId).success) {
      console.info(`guide-preview: no step "${nodeId}" to resume at — starting from the first.`);
    }

    const unmatched = this.unmatchedGiven();
    if (unmatched.length > 0) {
      console.info(`guide-preview: given answers no node declares: ${unmatched.join(", ")}`);
    }
  }

  /**
   * Whether a field whose rule does not hold is drawn anyway, framed.
   *
   * `editor-view` says yes — an author has to see every field, a visitor only
   * the ones that hold (story 064 point 4). A **run** says no again: the whole
   * point of trying the guide is to see what the visitor gets (story 065 point
   * 7), so the two views are told apart here rather than in two renderers.
   */
  private revealsHiddenFields(): boolean {
    return this.hasAttribute("editor-view") && !this.hasAttribute("proving");
  }

  /**
   * Draw the same run as another preview — one engine, two mirrors (story 065).
   *
   * The run belongs to the preview in the panel; the node on the canvas that
   * the run is standing on draws **the same `GuideTraversalEngine` object**,
   * not a copy of its answers. So a Next pressed in the node is a Next in the
   * panel, and the class of fault where the two stand on different steps cannot
   * happen rather than being guarded against.
   *
   * What is not answered yet is not in the engine: a half-typed page lives in
   * the writing mirror's DOM. The other mirror still shows it, as a draft —
   * this one says what it holds (`preview-draft-changed`), the shell hands
   * that to the other mirror through `showDraft`, and `refresh` drops it when
   * the engine moves. Johan, reviewing the known-answers film (6/9): the panel
   * beside a card where Umeå had just been picked said nothing.
   *
   * `null` gives the mirror back its own engine, which the caller re-supplies
   * with `graph`.
   */
  /**
   * Which of the node's exit ports carry a line — handed down by the canvas.
   *
   * The mirror's trimmed graph has no connections to read (measured 2/9:
   * the snapshot's connection list was empty), so the open list's cap would
   * hide connected rows without being told. `null` means "nobody told us":
   * the standalone preview falls back to its own graph.
   */
  connectedPortIds: string[] | null = null;

  mirror(source: GuidePreview | null): void {
    this.engine = source?.engine ?? null;
    this.graphSnapshot = this.engine?.getGraph() ?? null;
    this.error = null;
    this.highlightedFieldId = null;
    this.annotationStep = 0;
    this.pageFieldErrors.clear();
    this.pageDraft = null;
    this.resetChoiceDraft();
    this.provingStandIns.clear();
    /*
     * No step tag on a mirror. The mirror of a run is a node on the canvas, and
     * the line above the canvas already says which step of how many — the same
     * number twice, once without the "av 6" that makes it mean anything.
     */
    this.showStepIndicator = false;

    if (this.isConnected) {
      this.render();
    }
  }

  /**
   * Draw again from the engine — for a mirror whose engine somebody else moved.
   *
   * There is no listening between two mirrors of one run: the shell knows when
   * the engine moved (it hears `preview-node-changed`) and says so. A
   * subscription would be a second path to the same fact.
   *
   * The engine moved, so what the other mirror was typing is stored or gone:
   * the draft it shared goes too. (A redraw for another reason drops it as
   * well — the next keystroke over there brings it back.)
   */
  refresh(): void {
    this.pageDraft = null;
    if (this.isConnected) {
      this.render();
    }
  }

  /**
   * Show what the other mirror of this run is typing (see `mirror`).
   *
   * The same draft a rejected page keeps for itself, so the fields and the
   * chips draw it through the one path they already have. Nothing is stored:
   * Next in either mirror reads its own fields, and only the engine answers.
   */
  showDraft(values: Answers): void {
    this.pageDraft = values;
    if (this.isConnected) {
      this.render();
    }
  }

  /**
   * Stored answers first, then whatever is typed on this page — the rejected
   * page's own, or the other mirror's (`showDraft`). What the fields and the
   * chips draw from.
   */
  private pageAnswers(): Answers {
    return { ...this.prefill(), ...(this.pageDraft ?? {}) };
  }

  /**
   * Say what this page holds, so the shell can show it in the other mirror.
   * Per keystroke, but the listener is the shell's and the other mirror's
   * redraw is one page of fields.
   */
  private shareDraft(): void {
    if (this.engine?.getCurrentNode()?.type !== "page") return;

    this.dispatchEvent(
      new CustomEvent("preview-draft-changed", {
        detail: { values: this.getPageFormValues() },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Answers to draw an already-answered step with.
   *
   * A step the run has been through is drawn on the canvas as a picture with
   * the answer still in its field (story 065 point 4). The picture has its own
   * one-step engine, which decides nothing — this is how it is told what the
   * run answered. See `seedAnswers` on the engine.
   */
  set shownAnswers(value: Answers) {
    this.engine?.seedAnswers(value);

    if (this.isConnected) {
      this.render();
    }
  }

  /**
   * Which step of the run this is — the engine's own count.
   *
   * The viewer's own step tag renders the same number; this is for a second
   * mirror of the same run (story 065's line at the top of the canvas), which
   * must not count for itself.
   */
  getStepNumber(): number {
    return this.engine?.getStepNumber() ?? 1;
  }

  /** Kopplingarna som passerats under körningen, i ordning. */
  getTraversedConnectionIds(): string[] {
    return this.engine?.getTraversedConnectionIds() ?? [];
  }

  clear(message = "Ingen guide har valts."): void {
    this.engine = null;
    this.graphSnapshot = null;
    this.error = null;
    this.emptyMessage = message;
    this.showStepIndicator = false;
    this.highlightedFieldId = null;
    this.pageFieldErrors.clear();
    this.pageDraft = null;
    this.resetChoiceDraft();
    this.provingStandIns.clear();
    this.render();
  }

  previous(): void {
    if (!this.engine) {
      return;
    }

    // Annoterad bild: stega bakåt en kommentar i taget innan noden lämnas.
    const active = this.engine.getCurrentNode();
    if (active?.type === "annotated-image" && this.annotationStep > 0) {
      this.annotationStep -= 1;
      this.render();
      return;
    }

    if (!this.engine.canGoBack()) {
      return;
    }

    this.highlightedFieldId = null;
    this.pageFieldErrors.clear();
    this.pageDraft = null;
    this.resetChoiceDraft();
    const result = this.engine.previous();
    this.error = result.success ? null : result.error;
    this.render();

    if (result.success) {
      this.dispatchNodeChanged(result.node.id, "back");
    }
  }

  restart(): void {
    /* Ett nytt ärende är en NY genomgång: biljetten och klockan nollas,
       annars vägrar kvittensen skicka om och visar gamla referensnumret. */
    this.resetStepRenderers();
    this.guideStartedAt = Date.now();
    if (!this.engine) {
      return;
    }

    this.highlightedFieldId = null;
    this.pageFieldErrors.clear();
    this.pageDraft = null;
    this.resetChoiceDraft();
    this.provingStandIns.clear();
    const result = this.engine.restart();
    this.applyGiven(false);
    this.error = result.success ? null : result.error;
    this.showStepIndicator = true;
    this.render();

    if (result.success) {
      this.dispatchNodeChanged(result.node.id);
    }
  
    this.dispatchProgress("restart", this.engine?.getCurrentNode()?.id);
  }

  showNode(nodeId: string): boolean {
    if (!this.engine) {
      return false;
    }

    // Page children are not steps of their own in the guide. Show the parent
    // page and highlight the field instead.
    const target = this.guideGraph()?.nodes.find(
      (candidate) => candidate.id === nodeId,
    );
    const parentPageId = target?.parentPageId;
    const nextHighlight = parentPageId ? nodeId : null;
    const nextNodeId = parentPageId ?? nodeId;

    if (
      this.engine.getCurrentNode()?.id === nextNodeId &&
      this.highlightedFieldId === nextHighlight &&
      !this.showStepIndicator
    ) {
      return true;
    }

    this.highlightedFieldId = nextHighlight;
    this.annotationStep = 0;
    this.pageFieldErrors.clear();
    this.pageDraft = null;
    this.resetChoiceDraft();
    const result = this.engine.goToNode(nextNodeId);
    this.error = result.success ? null : result.error;
    this.showStepIndicator = false;
    this.render();

    return result.success;
  }

  /**
   * *Du har inte ändrat X, som står på Y. Vill du gå vidare ändå?*
   *
   * Johans form, 15/9: a field carrying a value nobody chose is asked about,
   * not refused. Wanting exactly the eight years the field already shows is a
   * real answer, and a guide that will not take it makes the visitor retype
   * the number in front of them.
   *
   * The engine is still the judge — `isUntouched` decides there is a question
   * to ask, and *Gå vidare* does not slip past it: the name goes into the
   * touched set and the whole of `next()` runs again, so the verdict is taken
   * a second time and comes back yes. There is no way round the rule, only a
   * way to answer it.
   *
   * The platform's `<dialog>` with `showModal()`: the top layer, the focus
   * trap, Escape and the backdrop are all its, and every one of them is
   * something we would otherwise have to write and keep right. Built and
   * thrown away per question rather than rendered into the card, because
   * `render` replaces the card's markup on every step and a dialog living in
   * there would be destroyed mid-question.
   *
   * Focus lands on *Ändra*: of the two it is the one that changes nothing, and
   * a person who hits Enter out of habit should not thereby answer a question
   * about whether they meant to answer.
   */
  private askAboutUntouched(label: string, value: string): Promise<boolean> {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      const titleId = "untouched-question";

      dialog.className = "guide-preview__ask";
      dialog.setAttribute("aria-labelledby", titleId);
      dialog.innerHTML = `
        <h2 id="${titleId}">${escapeHtml(
          this.chrome("dialog.untouched.message", { field: label, value }),
        )}</h2>
        <div class="guide-preview__ask-actions">
          <button type="button" data-ask="change">${escapeHtml(this.chrome("dialog.untouched.change"))}</button>
          <button type="button" data-ask="continue">${escapeHtml(this.chrome("dialog.untouched.continue"))}</button>
        </div>
      `;

      const finish = (answer: boolean): void => {
        dialog.close();
        dialog.remove();
        resolve(answer);
      };

      dialog
        .querySelector<HTMLButtonElement>('[data-ask="change"]')
        ?.addEventListener("click", () => finish(false));
      dialog
        .querySelector<HTMLButtonElement>('[data-ask="continue"]')
        ?.addEventListener("click", () => finish(true));
      // Escape closes the dialog itself; `cancel` is where that arrives, and
      // it means the same as *Ändra*.
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        finish(false);
      });

      /*
       * A trap of our own, on top of the platform's.
       *
       * Measured 15/9: `showModal()` inside a shadow root does not wrap Tab
       * between the two buttons the way it does for a dialog in the light
       * DOM. Tabbing off either end does not escape to the page behind it —
       * nothing outside the dialog becomes reachable — but focus lands on
       * `<body>` with no visible indicator anywhere, for one keypress, before
       * a further Tab or Shift+Tab finds its way back in. A visitor tabbing
       * through sees their focus ring vanish.
       *
       * Two buttons, so wrapping is just: off the last end, go to the first;
       * off the first end going backward, go to the last.
       */
      dialog.addEventListener("keydown", (event) => {
        if (event.key !== "Tab") return;

        const change = dialog.querySelector<HTMLButtonElement>('[data-ask="change"]');
        const proceed = dialog.querySelector<HTMLButtonElement>('[data-ask="continue"]');
        if (!change || !proceed) return;

        if (event.shiftKey && event.target === change) {
          event.preventDefault();
          proceed.focus();
        } else if (!event.shiftKey && event.target === proceed) {
          event.preventDefault();
          change.focus();
        }
      });

      this.root.append(dialog);
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>('[data-ask="change"]')?.focus();
    });
  }

  /**
   * Asks about each field on the page the engine calls untouched, and says
   * whether the way forward is clear.
   *
   * ONE QUESTION AT A TIME, in the order the fields are drawn — `pageSlots` is
   * already in that order. A *Gå vidare* marks that one and the loop looks
   * again, so a page with two such fields asks twice rather than stacking two
   * dialogs or naming both in one sentence nobody can answer separately.
   *
   * The loop and not a re-entry into `next()`: measured 15/9, calling the
   * page's way out after the first yes let the SECOND untouched field reach
   * the engine, which refused it as a banner — the very shape this dialog
   * exists to replace. Asking until there is nothing left to ask keeps the
   * engine's verdict as the last word without it ever having to be shown.
   */
  private async clearedOfUntouched(page: FlowNodeData, values: Answers): Promise<boolean> {
    for (;;) {
      const slot = this.pageSlots(page, values).find((candidate) =>
        this.engine?.isUntouched(
          candidate.field.variableName,
          candidate.field.requireInteraction === true,
          this.touchedVariables,
          // The value on screen: a field standing on something other than
          // what it arrived with was changed, and there is nothing to ask.
          candidate.value,
        ) === true,
      );

      if (!slot) return true;

      if (!(await this.askAboutUntouched(slot.field.label, slot.value))) {
        this.root
          .querySelector<HTMLElement>(`[data-page-field-id="${CSS.escape(slot.field.id)}"]`)
          ?.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select")
          ?.focus();

        return false;
      }

      this.touchedVariables.add(slot.field.variableName);
    }
  }

  private next(): void {
    if (!this.engine) {
      return;
    }

    this.highlightedFieldId = null;
    this.pageFieldErrors.clear();
    this.stepError = null;
    this.pageDraft = null;
    this.resetChoiceDraft();
    const currentNode = this.engine.getCurrentNode();

    // Annoterad bild: stega fram en kommentar i taget innan noden lämnas.
    if (currentNode?.type === "annotated-image") {
      const comments = AnnotationCommentsService.parse(currentNode.data.comments);
      if (this.annotationStep < comments.length - 1) {
        this.annotationStep += 1;
        this.render();
        return;
      }
      this.annotationStep = 0;
    }

    if (currentNode?.type === "page") {
      const values = this.getPageFormValues();

      if (!this.validatePageFields(currentNode, values)) {
        /*
         * Before the re-render, not after: the render is what wipes the fields,
         * because it reads them back from answers that were never stored.
         */
        this.pageDraft = values;
        this.dispatchProgress("validation-stopped", currentNode.id);
        this.render();
        if (this.pageFieldErrors.size > 1) {
          // Summeringen är ett role=alert — fokus dit läser upp antalet och
          // länkarna; med ett ensamt fel går fokus som förut rakt till fältet.
          this.root.querySelector<HTMLElement>("[data-error-summary]")?.focus();
        } else {
          this.focusFirstInvalidPageField();
        }
        return;
      }

      /*
       * The question about an untouched field comes AFTER the field checks:
       * a page with something actually wrong on it says so first, and asking
       * *do you mean to keep 8 years?* while a required field above is empty
       * would be asking about the wrong thing entirely.
       *
       * Answered *Gå vidare*, the name is marked touched and the page's way
       * out is taken — where the engine judges every field once more, with
       * nothing left for it to refuse.
       */
      void this.clearedOfUntouched(currentNode, values).then((cleared) => {
        if (cleared) this.continuePage(currentNode, values);
      });
      return;
    }

    this.answerCurrentStep(currentNode);
  }

  /** The page's way out, once nothing on it is in the way. */
  private continuePage(currentNode: FlowNodeData, values: Answers): void {
    if (!this.engine) return;

    const result = this.engine.answerPage(values, { touched: this.touchedVariables });
    this.error = result.success ? null : result.error;
    this.render();
    if (result.success) this.dispatchNodeChanged(result.node.id);
    else this.dispatchProgress("validation-stopped", currentNode.id);
  }

  /**
   * Everything that is not a page: a question standing on its own step.
   *
   * Split out of `next()` when the untouched question arrived (story 118): a
   * dialog is answered later, so the page's way out had to become something
   * that can be called again from a promise, and the rest of the step's path
   * had nothing to do with that.
   */
  private answerCurrentStep(currentNode: FlowNodeData | null): void {
    if (!this.engine) return;

    // Declarative node types: collect the answer from the behavior and move on.
    const currentBehavior = currentNode
      ? getNodeType(currentNode.type)?.behavior
      : undefined;
    if (currentNode && currentBehavior) {
      const answer = currentBehavior.answer;
      const read = this.readStepAnswer(answer, currentBehavior.flow.kind);
      let value = read.value;
      const ratingWayOut = read.ratingWayOut;

      if (read.kind === "branch" && !value) {
        this.refuseStep(currentNode, this.chrome("validation.selectOption"));
        return;
      }

      if (read.kind === "lookup") {
        /*
         * A lookup that requires a choice from the list only has a valid
         * answer when a code comes along. Without this check free text would
         * pass and the variable would carry something no later step can look
         * up.
         */
        if (
          this.engine.getCurrentNode()?.data.allowFreeText !== true &&
          value.trim().length > 0 &&
          this.lookupCodes(this.lookupPicker()) === ""
        ) {
          this.showValueFieldError(this.chrome("validation.chooseFromList"));
          return;
        }
      }

      // The picker carries a code that is not in `value`.
      const lookupField = this.lookupPicker();

      /*
       * Ett flervärt uppslag lämnar sitt svar som PAREN — etikett och kod
       * tillsammans, ett värde per val. Förut var det två parallella listor
       * som hölls i takt av index, och en förlorad post på endera sidan hade
       * fått en regel att testa fel lands kod.
       */
      const pairs =
        answer.cardinality === "multi" && answer.input === "lookup"
          // Etiketten och koden, ingenting annat: `exclusive` beskriver
          // ALTERNATIVET, och svaret är det som valdes.
          ? lookupField?.choices.map((one) => ({ label: one.label, value: one.value })) ?? []
          : null;
      /*
       * Delarna reser MED svaret, inte i en variabel bredvid det.
       *
       * En kod låg i `landskod`, en geometri i `platsGeo`, markeringar i
       * `fotoMarkeringar` — tre gånger samma sak, och varje gång hölls de i
       * takt med sitt svar av ordningen de skrevs i. De finns kvar som delar
       * (`land.code`, `plats.geo`, `foto.markings`), vilket ett villkor kan
       * namnge sedan version 9. Se migreringen för vad som skrevs om.
       */
      const mapInput = this.root.querySelector<HTMLInputElement>("input[data-map-label]");
      const markStore = this.root.querySelector<HTMLInputElement>("[data-marking-store]");


      const svaret: AnswerValue =
        ratingWayOut
          ?? pairs
          ?? (answer.input === "lookup"
            // Kontrollens valda `value` är svarets `value` — se chip-picker.
            ? { label: value, value: this.lookupCodes(lookupField) }
            : answer.input === "map"
              ? { label: value, geo: mapInput?.dataset.geo ?? "" }
              : answer.input === "file" && markStore
                ? { label: value, markings: markStore.value }
                : value);

      /*
       * The same question a page field gets, for a question standing on its
       * own step. Answered *Gå vidare*, the step's path runs again from the
       * top with the name marked touched — the engine judges once more rather
       * than being stepped around.
       */
      const ownName =
        typeof currentNode.data.variableName === "string" ? currentNode.data.variableName : "";

      if (
        this.engine.isUntouched(
          ownName,
          currentNode.data.requireInteraction === true,
          this.touchedVariables,
          value,
        )
      ) {
        void this.askAboutUntouched(this.localized(currentNode.data.title), value).then(
          (onward) => {
            if (!onward) {
              this.root
                .querySelector<HTMLElement>("[data-number-answer], [data-text-answer]")
                ?.focus();
              return;
            }

            this.touchedVariables.add(ownName);
            this.answerCurrentStep(currentNode);
          },
        );
        return;
      }

      const result = this.engine.answerValue(svaret, {}, { touched: this.touchedVariables });
      if (result.success) {
        this.error = null;
        this.render();
        this.dispatchNodeChanged(result.node.id);
        return;
      }

      this.dispatchProgress("validation-stopped", currentNode?.id);

      const isValueField =
        answer.input === "number" ||
        answer.input === "text" ||
        answer.input === "lookup" ||
        answer.input === "map";
      if (isValueField) {
        // Field errors show on the field (aria-invalid plus an inline message)
        // rather than as a top banner, and focus is taken back there so it can
        // be corrected straight away.
        this.error = null;
        this.render();
        const field = this.root.querySelector<
          HTMLInputElement | HTMLTextAreaElement
        >(
          /*
           * The picker is not written back into. It is an element with a
           * `value` of its own — a list of codes — and assigning the answer
           * text to it would have been a string handed to a list. What was
           * typed survives a re-render there by other means: the chosen chips
           * are restored from the answer, and free text stands in a search box
           * that is created once and never replaced.
           */
          "input[data-number-answer], input[data-text-answer], textarea[data-text-answer]",
        );
        const region = this.root.querySelector<HTMLElement>(
          "[data-number-validation], [data-text-validation]"
        );
        if (field) {
          // Keep the typed value — the engine did not store it (the answer was
          // rejected), so a plain re-render would otherwise empty the field.
          field.value = value;
          this.setFieldValidity(field, region, result.error.message);
          field.focus({ preventScroll: false });
        } else if (this.lookupPicker()) {
          /*
           * A required search box left empty. The picker is no `input`, so the
           * selector above never finds it, and the refusal was said nowhere —
           * measured 1/10 on the conference's first step: Nästa did nothing
           * visible at all.
           */
          this.showValueFieldError(result.error.message);
        }
      } else {
        this.refuseStep(currentNode, result.error.message);
      }
      return;
    }
  }

  /*
   * Trattens händelser (story 070): EN händelse, guide-progress, med kind
   * och stegfakta — aldrig svar. Editorns speglar är tysta: tratten är
   * publicerade värdars, inte redaktörens klickande i tittläge och prov.
   */
  private dispatchProgress(
    kind:
      | "start"
      | "next"
      | "back"
      | "result"
      | "restart"
      | "submitted"
      | "validation-stopped",
    nodeId?: string | null,
  ): void {
    if (this.hasAttribute("editor-view") || this.hasAttribute("proving")) {
      return;
    }

    const node = nodeId
      ? this.guideGraph()?.nodes.find((candidate) => candidate.id === nodeId)
      : null;

    this.dispatchEvent(
      new CustomEvent("guide-progress", {
        detail: {
          kind,
          nodeId: nodeId ?? null,
          nodeType: node?.type ?? null,
          step: this.getStepNumber(),
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private dispatchNodeChanged(nodeId: string, direction: "next" | "back" = "next"): void {
    this.dispatchProgress(direction, nodeId);
    const arrived = this.guideGraph()?.nodes.find((candidate) => candidate.id === nodeId);

    if (arrived && isEndingNodeType(arrived.type)) {
      this.dispatchProgress("result", nodeId);
    }

    // Nytt steg → börja om från första kommentaren på en annoterad bild.
    this.annotationStep = 0;

    /*
     * Återresan (story 049): med en biljett i fickan spelas redan givna svar
     * upp tills granskningen — eller första obesvarade steget — nås. Efter
     * uppspelningen ritas om och fokus hamnar via samma väg som annars.
     */
    if (this.reviewTicket) {
      const before = this.engine?.getCurrentResult();
      this.replayTowardsReview();
      const after = this.engine?.getCurrentResult();
      if (
        before?.success && after?.success && before.node.id !== after.node.id
      ) {
        this.render();
      }
    }

    // Move focus to the new step's heading so screen readers announce where you
    // ended up after navigating.
    this.root
      .querySelector<HTMLElement>(".guide-preview__card h2")
      ?.focus({ preventScroll: false });

    this.dispatchEvent(
      new CustomEvent("preview-node-changed", {
        detail: {
          nodeId,
          answers: this.getAnswers(),
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private render(): void {
    const currentResult = this.engine?.getCurrentResult() ?? null;

    if (currentResult && !currentResult.success) {
      this.error = currentResult.error;
    }

    const currentNode =
      currentResult?.success === true ? currentResult.node : null;

    /*
     * The direction and the language are set on the **section**, never on the
     * document. A viewer embedded in someone else's page does not flip their
     * page — the same reasoning as when the tokens moved one step down from
     * `:root`.
     *
     * `lang` is included alongside `dir`: without it a screen reader pronounces
     * the text with the wrong language rules, and it costs nothing.
     */
    const locale = this.activeLocaleValue;
    const redrawn = currentNode !== null && currentNode.id === this.renderedNodeId;

    // A new step is a clean slate: what was touched on the last one is spent
    // (story 118). `redrawn` already knows the difference, so nothing else has
    // to be worked out here.
    if (!redrawn) {
      this.touchedVariables.clear();
      this.stepError = null;
    }

    this.renderedNodeId = currentNode?.id ?? null;

    // Measured before the old card goes: the height the next one grows or
    // shrinks from (story 144). See `easeCardHeight`.
    const heightBefore = redrawn ? null : this.cardHeightToEaseFrom();

    this.root.innerHTML = `
      ${sharedStyles ? "" : `<style>${styles}</style>`}
      <section class="guide-preview${redrawn ? " guide-preview--redrawn" : ""}" aria-label="${escapeHtml(this.chrome("preview.regionLabel"))}"
        lang="${escapeHtml(locale)}" dir="${textDirection(locale)}">
        ${this.renderNotTranslatedNotice(currentNode)}
        ${this.renderError()}
        ${this.renderAnswerHistory()}
        ${this.renderNode(currentNode)}
        ${this.renderVariableInspector()}
        ${this.renderStepInspectors()}
        ${
          /*
           * Honungsfällan (story 050): ett textfält utanför syn och tabb-
           * ordning som bara en robot fyller i. Värdet följer med
           * inlämningen; mottagaren dömer. aria-hidden så ingen skärmläsare
           * hittar det, och SIST i sektionen så tester och verktyg som tar
           * "första textfältet" aldrig får betet i stället för fältet.
           */
          '<input type="text" data-hp tabindex="-1" aria-hidden="true" autocomplete="off" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;background:none" name="website">'
        }
      </section>
    `;

    /*
     * On a canvas card the suggestion list takes up room instead of floating:
     * the card is only as tall as its content (story 064), so an overlay lands
     * on the buttons and is clipped by the card's edge (Johans bild 2/9). The
     * overlay stays right where _picker.scss measured it — narrow panels where
     * a growing list moves what the finger aims at.
     */
    if (this.hasAttribute("editor-view") || this.hasAttribute("proving")) {
      this.root
        .querySelectorAll("chip-picker")
        .forEach((picker) => picker.setAttribute("docked-list", ""));
    }

    this.placeStepError();
    this.bindEvents();
    this.afterRenderSteps();

    if (heightBefore !== null) this.easeCardHeight(heightBefore);
  }

  /**
   * What the step's control holds right now, read the one way both the step's
   * Next and its re-test read it (Johan 1/10: an own step is tried again on
   * change and blur, like a page field). The refusals that need more than the
   * value — a branch with nothing chosen, a lookup's free text — stay with
   * the caller; `kind` says which of those applies.
   */
  private readStepAnswer(
    answer: NodeBehavior["answer"],
    flowKind: NodeBehavior["flow"]["kind"],
  ): { value: string; ratingWayOut: AnswerFields | null; kind: "branch" | "lookup" | "other" } {
    let kind: "branch" | "lookup" | "other" = "other";
    let value: string;
    /*
     * The rating's way out, when it was the one pressed: the words a person
     * read beside an empty value (story 115). Set here rather than folded
     * into `value`, because an empty string is also what "nobody answered"
     * looks like and the two must not arrive as the same answer.
     */
    let ratingWayOut: AnswerFields | null = null;

    /*
     * Uppslaget före antalet, av samma skäl som i renderingen: ett flervärt
     * uppslag lämnar sitt svar genom sin `chip-picker`, inte genom etiketter
     * eller kryssrutor. Prövades antalet först föll det ned i grenen under
     * och plockade upp ingenting — ett tomt svar från ett ifyllt fält.
     */
    if (answer.cardinality === "multi" && answer.input !== "lookup") {
      /*
       * Etiketterna först: står de på skärmen är de svaret. Läses ur DOM:en
       * och inte ur utkastet, för utkastet finns inte förrän man rört
       * kontrollen — ett sparat svar man går tillbaka till skulle annars
       * tömmas av att man går vidare utan att ändra något.
       */
      const picker = this.root.querySelector<HTMLElement & { value: string[] }>(
        "[data-choice-picker]",
      );
      const checked = picker
        ? picker.value
        : Array.from(
            this.root.querySelectorAll<HTMLInputElement>(
              'input[name="guide-preview-multi"]:checked'
            )
          ).map((input) => input.value);
      value = checked.join("\n");
    } else if (
      answer.cardinality === "single" &&
      flowKind === "branch"
    ) {
      const radio = this.root.querySelector<HTMLInputElement>(
        'input[name="guide-preview-option"]:checked'
      );
      const dropdown = this.root.querySelector<HTMLSelectElement>(
        "[data-choice-single]"
      );
      /*
       * Sökbara listan bär alternativets id, precis som rullgardinen — det
       * är id:t som pekar ut vägen vidare, inte det lagrade värdet.
       */
      const searchable = this.root.querySelector<HTMLElement & { value: string[] }>(
        "[data-choice-single-picker]",
      );
      kind = "branch";
      value = radio?.value || dropdown?.value || searchable?.value[0] || "";
    } else if (answer.input === "lookup") {
      /*
       * The lookup reads its own control rather than the generic one.
       *
       * Every other value field is an `input` or a `textarea` whose `value`
       * is the answer text. The picker's `value` is a list of codes, and the
       * answer text is the labels — or, in single mode with free text
       * allowed, whatever stands in the search box. Reading it through the
       * generic path handed a list to code expecting a string.
       */
      kind = "lookup";
      value = this.lookupLabels(this.lookupPicker());
    } else if (answer.input === "rating") {
      /*
       * The checked radio, and nothing when none is. A group of radios has no
       * single element whose `value` is the answer — the generic read below
       * would take the first one's, which is step one whether or not anybody
       * pressed it.
       *
       * The way out answers with the WORDS beside an empty value (story 115):
       * the review has to be able to say *Inte aktuellt* where somebody chose
       * it and *Inget svar* where nobody answered, and an empty string cannot
       * tell those apart.
       */
      const checked = this.root.querySelector<HTMLInputElement>(
        "input[data-rating-answer]:checked",
      );

      if (checked?.hasAttribute("data-rating-out")) {
        ratingWayOut = { label: checked.dataset.ratingOutLabel ?? "", value: "" };
        value = answerText(ratingWayOut);
      } else {
        value = checked?.value ?? "";
      }
    } else {
      const selector =
        answer.input === "number"
          ? "[data-number-answer]"
          : "[data-text-answer]";
      const control = this.root.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        selector
      );

      /*
       * A checkbox reports its value whether or not it is ticked, so an
       * unticked consent would arrive as "true" and pass every required
       * check. Unticked is the empty string — the same shape as any
       * unanswered field, which the validation already understands.
       */
      value =
        control instanceof HTMLInputElement &&
        control.type === "checkbox" &&
        !control.checked
          ? ""
          : control
            ? this.canonicalOf(control)
            : "";

      /*
       * Stored in one shape, whatever shape it was typed in.
       *
       * `isPersonnummer` throws away every separator before checking, so
       * `19560328-1949`, `560328-1949` and `1956 03 28 1949` all pass — and
       * before this, whichever of them somebody happened to type is what the
       * host received. Two residents with the same personnummer left two
       * different strings in `getAnswers()`.
       *
       * The century is settled here rather than by whoever reads the value
       * later: `560328` is 1956 for anybody alive and 2056 for a child born
       * this century.
       *
       * Only the formats with a settled written form are touched. A phone
       * number has none without a country code and an email must not be
       * changed at all — `canonicalFormat` passes both straight through.
       */
      const shape =
        control instanceof HTMLElement ? control.dataset.format : undefined;

      if (shape) {
        value = canonicalFormat(shape, value);
      }
    }

    if (answer.input === "file") {
      value = this.root.querySelector<HTMLInputElement>("input[data-file-name]")?.value ?? "";
    }

    return { value, ratingWayOut, kind };
  }

  /**
   * Refuses the answer on a step of its own, and says why where it was given.
   *
   * A file step draws its field with the page's own cell (`renderPageField`),
   * which already has a place for a message under the control — so the
   * refusal goes into that cell's error, the same row a file field on a page
   * speaks from. Every other step gets `stepError`, placed after render.
   */
  private refuseStep(node: FlowNodeData, message: string): void {
    this.error = null;
    if (getNodeType(node.type)?.behavior?.answer.input === "file") {
      this.pageFieldErrors.set(node.id, message);
    } else {
      this.stepError = message;
    }
    this.render();
  }

  /**
   * Draws `stepError` directly under the step's control, inside the card
   * (Astra 1/10, bilaga 10 punkt 6).
   *
   * Placed in the DOM after render rather than written into each of the
   * eight step renderers: they differ in what the control IS — a group of
   * radios, of boxes, a rating's bar, a search box, a select, a date, the
   * consent row — and the first such element in the card is that control in
   * every one of them (the heading, the description and *Varför frågar vi?*
   * come before it and are none of these). Eight copies of the same line in
   * eight renderers would be eight places for it to drift.
   *
   * The GROUP is marked, never each option in it (Astra: *"Markera gruppens
   * fel utan att varje obesvarat alternativ får en egen röd ruta"*): a
   * fieldset carries `data-invalid` and is described by the message; a
   * single control carries `aria-invalid` itself.
   */
  private placeStepError(): void {
    if (!this.stepError) return;
    const card = this.root.querySelector<HTMLElement>("article");
    const group = card?.querySelector<HTMLElement>(
      "fieldset, .guide-preview__pillbox, .guide-preview__value-answer",
    );
    if (!card || !group) return;

    const message = document.createElement("p");
    message.className = "guide-preview__field-error guide-preview__step-error";
    message.id = "guide-step-error";
    message.setAttribute("role", "alert");
    message.textContent = this.stepError;
    group.after(message);
    group.setAttribute("data-invalid", "");

    const describe = (element: Element): void => {
      const ids = (element.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
      element.setAttribute("aria-describedby", [...ids, message.id].join(" "));
    };
    if (group instanceof HTMLFieldSetElement) {
      describe(group);
      return;
    }
    // A search box marks its own frame; the picker draws it (chip-picker.scss).
    group.querySelector("chip-picker")?.setAttribute("data-invalid", "");
    const control = group.querySelector("input:not([type=hidden]), select");
    if (control) {
      control.setAttribute("aria-invalid", "true");
      describe(control);
    }
  }

  /**
   * The old card's height when a new step is about to replace it, or `null`
   * when the change should be a cut (story 144, criteria 1 and 7).
   *
   * A cut on the canvas: inside a node (`in-node`) the step's slide-in is
   * already off, and twenty cards easing their heights whenever a node is
   * edited is the same noise. A cut under `prefers-reduced-motion` (K5): the
   * new height arrives at once, without travel. Asked here in script because
   * the script is what moves it — a stylesheet query would leave the inline
   * height waiting for a `transitionend` that never comes.
   */
  private cardHeightToEaseFrom(): number | null {
    if (this.hasAttribute("in-node")) return null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;

    const card = this.root.querySelector<HTMLElement>(".guide-preview__card");
    return card ? card.offsetHeight : null;
  }

  /**
   * The new card starts at the old card's height and travels to its own
   * (story 144, criterion 1). A card that was a third as tall a frame later
   * read as something having gone missing (Johan 1/10, the hero clip).
   *
   * Measured heights in pixels and a plain `transition`, then back to
   * `auto`: animating to `height: auto` needs `interpolate-size`, which the
   * browser floor (K18) does not have. The tempo lives in the stylesheet
   * with the step's slide-in, so the two cannot drift apart; this only sets
   * the two ends. While `[data-height-shift]` is on, the card clips what
   * does not fit yet — 220 ms — and the timer is the fallback for a
   * `transitionend` that never fires (a hidden tab, a card removed mid-way).
   */
  private easeCardHeight(from: number): void {
    const card = this.root.querySelector<HTMLElement>(".guide-preview__card");
    if (!card) return;

    const to = card.offsetHeight;
    if (Math.abs(to - from) < 1) return;

    card.setAttribute("data-height-shift", "");
    card.style.height = `${from}px`;
    // Commit the start before asking for the end, or there is nothing to travel.
    void card.offsetHeight;
    card.style.height = `${to}px`;

    const done = (): void => {
      card.style.removeProperty("height");
      card.removeAttribute("data-height-shift");
    };

    card.addEventListener("transitionend", (event) => {
      if (event.target === card && event.propertyName === "height") done();
    });
    window.setTimeout(done, 500);
  }

  /**
   * Says so when the step is not in the language the resident asked for.
   *
   * The fallback itself is right — a resident should read *something* rather
   * than an empty box. Doing it silently is not: they are left wondering
   * whether the service is broken, whether they picked the wrong language, or
   * whether this is simply how it is. Naming it costs one line and answers all
   * three.
   *
   * ## Per step, not once at the top
   *
   * A guide is often translated in part, and the resident meets the gap where
   * it is. A banner at the top would be right on the untranslated steps and a
   * lie on the translated ones; this appears exactly where the language
   * changed under them, and clears itself when it has not.
   *
   * ## The notice resolves English before the source
   *
   * Every other text falls back to the guide's own language. This one must not:
   * its whole purpose is to be read by someone who could not read the guide.
   * Falling back to the source would state, in the language they cannot read,
   * that they cannot read it.
   */
  private renderNotTranslatedNotice(node: FlowNodeData | null): string {
    const wanted = this.activeLocaleValue;
    const graph = this.guideGraph();
    const source = getSourceLocale(graph);

    // What the heading actually resolved to. Nothing is said when the resident
    // is reading the language they asked for.
    const shown = node ? this.languageOf(node.data.title, wanted, source) : wanted;
    // Compared by base language: a reader who asked for "fi" is reading Finnish
    // whether the guide filed it under "fi" or "fi-FI".
    const base = (code: string): string => code.split("-")[0]!.toLowerCase();
    if (!shown || base(shown) === base(wanted)) {
      return "";
    }


    /*
     * The language names follow the sentence, not the request.
     *
     * The first version named them in the language the resident asked for, so
     * an Arabic reader with no Arabic pack got "This guide has not been
     * translated into العربية" — an English sentence with Arabic words in it.
     * Someone who can read the sentence can read the names in the same
     * language; someone who cannot is not helped by two of the words.
     */
    const inTheirLanguage =
      Boolean(graph?.settings?.strings?.["guide.notTranslated"]) ||
      registeredText("guide.notTranslated", wanted) !== undefined ||
      Boolean(VIEWER_STRINGS["guide.notTranslated"]?.[base(wanted)]);
    const noticeLocale = inTheirLanguage ? wanted : FALLBACK_LOCALE;

    const text = interpolate(
      uiText("guide.notTranslated", graph?.settings?.strings, noticeLocale, FALLBACK_LOCALE),
      {
        wanted: localeLabel(wanted, noticeLocale),
        shown: localeLabel(shown, noticeLocale),
      },
    );

    return `
      <p class="guide-preview__not-translated" role="status" lang="${escapeHtml(noticeLocale)}">
        ${escapeHtml(text)}
      </p>
    `;
  }

  /** Which language a translatable value actually resolved to, or null. */
  private languageOf(
    value: unknown,
    wanted: string,
    source: string,
  ): string | null {
    if (typeof value === "string" || !isLocalizedTextMap(value)) {
      // A bare string is language-neutral: it reads the same either way.
      return null;
    }
    const resolved = resolveText(value, wanted, "", source);
    if (resolved === "") {
      return null;
    }
    for (const [code, text] of Object.entries(value as Record<string, string>)) {
      if (text === resolved) {
        return code;
      }
    }
    return null;
  }

  /** Utfällbar lista med aktuella variabelvärden under testkörning. */
  private renderVariableInspector(): string {
    if (!this.variableInspectorEnabledValue || !this.engine) {
      return "";
    }

    const entries = Object.entries(this.engine.getAnswers());
    if (entries.length === 0) {
      return "";
    }

    return `
      <details class="guide-preview__variables" data-variable-inspector ${this.variableInspectorOpen ? "open" : ""}>
        <summary>${escapeHtml(this.chrome("preview.variables", { n: String(entries.length) }))}</summary>
        <dl>
          ${entries
            .map(
              ([name, value]) => `
                <dt><code>${escapeHtml(name)}</code></dt>
                <dd>${isAnswerEmpty(value) ? `<em>${escapeHtml(this.chrome("preview.emptyValue"))}</em>` : escapeHtml(answerText(value))}</dd>
              `
            )
            .join("")}
        </dl>
      </details>
    `;
  }

  /**
   * The way behind the resident: what they have already answered, to read.
   *
   * ## What it is for, and what it deliberately is not
   *
   * To **read**, not to navigate. `previous()` already reaches every earlier step
   * — one at a time — so a trail you can press adds no capability, only distance:
   * four presses become one. What it does add is being able to check "did I say
   * Hyr or Äger?" without leaving the question you are standing on, and that
   * needs no engine change at all: the records are already there.
   *
   * Johan put it plainly by asking what the new way gave that the old one did
   * not. Answering it honestly moved the value from the half I had been
   * defending — pressable rows — to the half that costs nothing.
   *
   * So there are no buttons here, and the test beside this asserts their
   * absence. Making the rows navigable needs a `goToStep` in the engine that
   * pops its own history to a chosen point, and it comes with a price a person
   * must be shown first: everything answered after that step is discarded, which
   * is what `previous()` already does one step at a time. That is a later
   * decision, taken with a reason rather than a guess.
   *
   * Two ways back with different prices would also be exactly the third
   * mechanism PRAXIS 15 warns about.
   */
  /**
   * The answer as the viewer printed it, not as the engine stored it.
   *
   * A record keeps the raw value for a typed field: `198002237538` where the
   * field showed `19800223-7538`, and `7400` where a template writes `7 400`. A
   * trail that disagrees with the field it is quoting is worse than none, since
   * its whole job is to say "this is what you told us".
   *
   * `TemplateVariableService.resolve` is the one function that knows every rule,
   * so this asks it rather than growing a second, quietly different set. The
   * bench beside this learned it the hard way: it counted its own answers and
   * printed them raw.
   */
  private answerAsShown(record: GuideAnswerRecord): string {
    const name = record.variableName;
    const graph = this.guideGraph();

    if (!name || !graph) {
      return record.optionLabel;
    }

    const shown = TemplateVariableService.resolve(
      `{{${name}}}`,
      this.engine?.getScope() ?? {},
      graph,
      this.activeLocaleValue,
    ).resolved.trim();

    const value = shown === "" ? record.optionLabel : shown;

    /*
     * Måttet följer med talet.
     *
     * `35 000` i vägen hit säger inte om det var i månaden eller om året, och
     * det står bredvid fältet medan man svarar — så att tappa det på vägen ut
     * gör listan sämre än frågan den citerar. Enheten hämtas från noden svaret
     * kom ifrån, alltså samma källa som fältet läste den ur; en andra kopia hade
     * kunnat glida isär från den.
     *
     * Hårt mellanslag, för `2 100 000 kr/mån` som bryts efter talet läses som
     * två uppgifter.
     */
    const unit = this.localized(
      graph.nodes.find((node) => node.id === record.questionId)?.data.unit,
    );

    return value !== "" && unit !== "" ? `${value}\u00a0${unit}` : value;
  }

  private renderAnswerHistory(): string {
    const shape = this.getAttribute("answer-display");

    if (
      (shape !== "history" && shape !== "trail") ||
      !this.showStepIndicator
    ) {
      return "";
    }

    const records = this.engine?.getAnswerRecords() ?? [];

    if (records.length === 0) {
      return "";
    }

    if (shape === "trail") {
      return `
        <ol class="guide-preview__trail" aria-label="${escapeHtml(this.chrome("preview.wayBack"))}">
          ${records
            .map(
              (record) => `
                <li>
                  <span class="guide-preview__trail-question">${escapeHtml(record.questionTitle)}</span>
                  <span class="guide-preview__trail-answer">${escapeHtml(this.answerAsShown(record))}</span>
                </li>
              `,
            )
            .join("")}
        </ol>
      `;
    }

    return `
      <ol class="guide-preview__history" aria-label="${escapeHtml(this.chrome("preview.previousAnswers"))}">
        ${records
          .map(
            (record) => `
              <li>
                <span>${escapeHtml(record.questionTitle)}</span>
                <strong>${escapeHtml(record.optionLabel)}</strong>
              </li>
            `
          )
          .join("")}
      </ol>
    `;
  }

  /**
   * How far into the guide the visitor has come (story 116).
   *
   * Two pieces, because they sit on two rows: the **rail** across the whole
   * width of the card, and the **number** at the right-hand end of the step
   * mark's row below it. Johans tredje pekning, 13/9 kväll: *"Jag vill att
   * mätaren ska täcka hela, sedan under står Steg 1."*
   *
   * Side by side they competed — *STEG 2* and *40 %* are two answers to the
   * same question, the second mechanism PRAXIS regel 15 warns about. On two
   * rows they do not: the rail says *how far*, the step mark says *where*. Full
   * width also ends the crowding that made the bar a stump on 390 px.
   *
   * The rail carries `role="progressbar"` with its value and its name, which is
   * the whole of that pattern and not half of it (K4). The number is written
   * out beside the step mark because a filled area alone would require seeing
   * it (K3), and that row is the one place where it costs no width.
   *
   * Four things silence it, and then the head looks exactly as it does today:
   *
   * - the guide has not asked for it (`settings.progress`), which is the
   *   default and is why an older file looks unchanged (K7);
   * - the step is one the meter does not count: a result, a receipt, or the
   *   review. Johans beslut 13/9 kväll about the review — the 100 % it showed
   *   was true and still said *done* with two presses left. The meter reaches
   *   100 % on the last question instead, which is the page where the claim is
   *   wholly true;
   * - the longest route holds fewer than two counted steps, so there is
   *   nothing to measure and a rail pinned full would be worse than none;
   * - `guideProgress` says there is no run behind the step.
   */
  private renderProgress(
    node: FlowNodeData | null
  ): { rail: string; value: string } | null {
    const graph = this.guideGraph();

    if (!node || !graph || graph.settings?.progress !== true) return null;
    // every ending type and `review` (criterion 6).
    // Asked of the registry rather than listed, so a future ending type is
    // covered the day it is added; the review is named because it is the one
    // step a visitor still has to press through that ends nothing.
    if (isEndingNodeType(node.type) || node.type === "review") return null;
    if (longestCountedRoute(graph) < 2) return null;

    const progress = guideProgress(
      graph,
      this.engine?.getTraversedConnectionIds() ?? [],
      node.id
    );

    if (!progress) return null;

    const percent = progress.percent;
    /*
     * The rail grows from where it stood, not from zero. The whole section is
     * redrawn at every step, so the old element is gone and CSS has nothing to
     * transition from — the previous number is carried across as a custom
     * property and the keyframe starts there. A run that starts mid-guide, or
     * one where the meter was silent, grows from nothing, which is true.
     */
    const from = this.shownPercent ?? 0;

    this.shownPercent = percent;

    return {
      rail: `
        <div class="guide-preview__progress">
          <div class="guide-preview__progress-meter" role="progressbar"
            aria-label="${escapeHtml(this.chrome("progress.label"))}"
            aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"
            aria-valuetext="${escapeHtml(this.chrome("progress.value", { percent }))}">
            <span class="guide-preview__progress-bar" style="width: ${percent}%; --fw-progress-from: ${from}%"></span>
          </div>
        </div>
      `,
      /*
       * `aria-hidden`, and `aria-valuetext` on the rail says the same words.
       * The two sit on different rows, so without that a screen reader meets
       * the share twice — once as the rail's value and once as a loose number
       * beside *Steg 1*, with nothing saying they are the same thing. One
       * announcement, in the words that are on the screen (criterion 8).
       */
      value: `<span class="guide-preview__progress-value" aria-hidden="true">${escapeHtml(this.chrome("progress.value", { percent }))}</span>`,
    };
  }

  /** What a registered step renderer may reach — story 147, criterion 2. Nothing else. */
  private stepContext(): StepContext {
    const preview = this;
    return {
      get graph() { return preview.graph; },
      guideGraph: () => this.guideGraph(),
      get engine() { return preview.engine; },
      get locale() { return preview.activeLocaleValue; },
      root: this.root,
      inNode: this.hasAttribute("in-node"),
      compact: this.hasAttribute("compact"),
      get guideStartedAt() { return preview.guideStartedAt; },
      inspectorEnabled: this.variableInspectorEnabledValue,
      chrome: (key, params) => this.chrome(key, params),
      localized: (value, fallback) => this.localized(value, fallback),
      headingAndDescription: (node, override) => this.renderHeadingAndDescription(node, override),
      sentAnswers: () => this.renderSentAnswers(),
      navigation: (showNext) => this.renderNavigation(showNext),
      resultPaths: (node) => this.renderResultPaths(node),
      formattingFor: (node, propertyId) => this.formattingFor(node, propertyId),
      formatDescription: (node, value) => this.formatDescription(node, value),
      dispatchProgress: (kind, nodeId) => this.dispatchProgress(kind as Parameters<GuidePreview["dispatchProgress"]>[0], nodeId),
      rerender: () => this.render(),
    };
  }

  /** The guide restarts or a new one arrives: every renderer forgets its run. */
  private resetStepRenderers(): void {
    for (const renderer of stepRenderers()) renderer.reset?.();
  }

  /** After the preview drew and bound its own events — the renderers' turn. */
  private afterRenderSteps(): void {
    const ctx = this.stepContext();
    for (const renderer of stepRenderers()) renderer.afterRender?.(this.root, ctx);
  }

  /** The editor's inspectors below the step (recipients, today), when enabled. */
  private renderStepInspectors(): string {
    const ctx = this.stepContext();
    return stepRenderers().map((renderer) => renderer.inspector?.(ctx) ?? "").join("");
  }

  private static warnedTypes = new Set<string>();
  private warnMissingRenderer(type: string): void {
    if (GuidePreview.warnedTypes.has(type)) return;
    GuidePreview.warnedTypes.add(type);
    console.warn(
      `FlowWeaver: no step renderer is registered for "${type}" — the step is shown as a plain result and nothing is sent. FlowWeaver PRO registers one (docs/UPPDELNING-OPPET-OCH-PRIVAT.md).`,
    );
  }

  private renderNode(node: FlowNodeData | null): string {
    if (!node) {
      return this.engine
        ? ""
        : `<p class="guide-preview__empty">${escapeHtml(
            this.emptyMessage
          )}</p>`;
    }

    // A registered step renderer wins (story 147): the full version's steps
    // — sending in, e-mail results — are drawn by whoever registered them.
    const renderer = getStepRenderer(node.type);
    if (renderer) {
      return renderer.render(node, this.stepContext());
    }

    if (node.type === "review") {
      return this.renderReview(node);
    }

    if (node.type === "image") {
      return this.renderImage(node);
    }

    // Kodnod: en kodsnutt, ett steg framåt.
    if (node.type === "code") {
      return this.renderCode(node);
    }

    // Annoterad bild: kommentarer (pil + text) man stegar igenom.
    if (node.type === "annotated-image") {
      return this.renderAnnotatedImage(node);
    }

    // Deklarativa nodtyper renderas generiskt utifrån sin behavior.
    const behavior = getNodeType(node.type)?.behavior;
    if (behavior) {
      return this.renderDeclarative(node, behavior);
    }

    if (node.type === "page") {
      return this.renderPage(node);
    }

    if (node.type === "result") {
      return this.renderResult(node);
    }

    /*
     * An ending the viewer has no renderer for — the open viewer meeting a
     * guide with a submission, say (story 147, criterion 6). Drawn as a plain
     * result: title and description, nothing sent, no reference invented.
     * The host is told once per type what is missing.
     */
    if (isEndingNodeType(node.type)) {
      this.warnMissingRenderer(node.type);
      return this.renderResult(node, node.type);
    }

    if (node.type === "rule" && this.hasAttribute("compact")) {
      return this.renderRule(node);
    }

    if (node.type === "calculation" && this.hasAttribute("compact")) {
      return this.renderCalculation(node);
    }

    if (node.type === "service-call" && this.hasAttribute("compact")) {
      return this.renderServiceCall(node);
    }

    /*
     * A type this viewer does not know, at the end of the flow — the open
     * viewer meeting a guide built with FlowWeaver PRO, whose sending steps
     * it has never heard of (story 147, criterion 6). "At the end" is read off
     * the graph, not the registry: nothing leads on from the node. Drawn as a
     * plain result — title and description, nothing sent, no reference
     * invented — and the host is told once what is missing. A type unknown in
     * the middle of a flow is still the error below: there is nowhere to go.
     */
    if (!getNodeType(node.type) && !this.graph?.connections.some((one) => one.from.nodeId === node.id)) {
      this.warnMissingRenderer(node.type);
      return this.renderResult(node, node.type);
    }

    return `
      <p class="guide-preview__error" role="alert">
        Nodtypen "${escapeHtml(node.type)}" kan inte förhandsgranskas.
      </p>
    `;
  }

  private renderServiceCall(node: FlowNodeData): string {
    const endpoint = readNodeString(node, "endpoint");
    const method = readNodeString(node, "method");
    const mappings = ServiceCallService.getResponseMappings(node);

    return `
      <article class="guide-preview__card" data-node-type="service-call">
        ${this.renderHeadingAndDescription(node)}
        <p class="guide-preview__rule-expression"><code>${escapeHtml(method)} ${escapeHtml(endpoint || "(ingen endpoint)")}</code></p>
        ${mappings
          .map(
            (item) => `
              <p class="guide-preview__rule-expression">
                <code>${escapeHtml(item.variableName || "variabel")} ← ${escapeHtml(item.field || "fält")}</code>
              </p>
            `
          )
          .join("")}
        ${this.renderRoute(node, "continue", t("port.continue", this.activeLocaleValue))}
      </article>
    `;
  }

  private renderCalculation(node: FlowNodeData): string {
    const assignments = CalculationService.getAssignments(node);

    return `
      <article class="guide-preview__card" data-node-type="calculation">
        ${this.renderHeadingAndDescription(node)}
        ${assignments
          .map(
            (item) => `
              <p class="guide-preview__rule-expression">
                <code>${escapeHtml(item.variableName || "variabel")} = ${escapeHtml(item.formula || "formel")}</code>
              </p>
            `
          )
          .join("")}
        ${this.renderRoute(node, "continue", t("port.continue", this.activeLocaleValue))}
      </article>
    `;
  }

  private renderRule(node: FlowNodeData): string {
    const cases = RuleCasesService.getCases(node);
    const fallbackLabel =
      typeof node.data.fallbackLabel === "string"
        ? node.data.fallbackLabel
        : "Annars";

    return `
      <article class="guide-preview__card" data-node-type="rule">
        ${this.renderHeadingAndDescription(node)}
        ${cases.map((item) => `
          <p class="guide-preview__rule-expression">
            ${escapeHtml(item.label)} – ${item.match === "all" ? "alla" : "minst ett"}:
            ${item.conditions.map((condition) =>
              `<code>${escapeHtml(condition.variableName || "Ingen variabel")} ${condition.operator === "equals" ? "=" : "≠"} ${escapeHtml(condition.value || "Inget värde")}</code>`
            ).join(item.match === "all" ? " och " : " eller ")}
          </p>
        `).join("")}
        <div class="guide-preview__routes" aria-label="Regelns utfall">
          ${cases
            .map((item) => this.renderRoute(node, item.id, item.label))
            .join("")}
          ${this.renderRoute(node, "default", fallbackLabel)}
        </div>
      </article>
    `;
  }

  /** Enkelval: radioknappar som grenar (flow "branch"). */
  private renderDeclarativeChoice(node: FlowNodeData): string {
    const all = QuestionOptionsService.getOptions(node);

    if (this.hasAttribute("compact")) {
      // The card on the canvas draws the question, not a visit to it: every
      // option has a port and a path, whatever a visitor would be offered.
      return `
        <article class="guide-preview__card" data-node-type="question">
          ${this.renderHeadingAndDescription(node)}
          <div class="guide-preview__routes" aria-label="Svarsalternativ och vägar">
            ${all.map((option) => this.renderRoute(node, option.id, this.localized(option.label))).join("")}
          </div>
        </article>
      `;
    }

    // Story 134: only what this visitor's earlier answers allow.
    const options = QuestionOptionsService.visible(all, this.getAnswers());
    const hiddenRow = this.renderHiddenOptionsRow(options.length < all.length);
    const variableName = node.data.variableName;
    const previousValue =
      typeof variableName === "string"
        ? this.prefill()[variableName]
        : undefined;
    /*
     * The choice that was made and is no longer offered (story 134, criterion
     * 6). Nothing is checked — the option is not drawn — and this is the half
     * that says so, in the step's own words rather than in silence.
     */
    const redoneRow = this.renderChoiceRedoRow(
      node,
      answerText(previousValue),
      options,
    );
    const selectedOptionId = this.engine?.getSelectedOptionId();
    const isChosen = (option: { id: string; value: string }): boolean =>
      selectedOptionId === option.id ||
      (!selectedOptionId && previousValue === option.value);

    const control =
      node.data.presentation === "search"
        ? `
          <div class="guide-preview__pillbox">
            <span class="guide-preview__pillbox-legend" id="choice-legend">${escapeHtml(this.chrome("field.chooseOption"))}</span>
            <chip-picker single data-choice-picker data-choice-single-picker aria-labelledby="choice-legend"></chip-picker>
            ${this.renderOpenOptionList(node, options, isChosen)}
            ${hiddenRow}
          </div>
        `
        : node.data.presentation === "select"
        ? `
          <label class="guide-preview__value-answer">
            <span>${escapeHtml(this.chrome("field.chooseOption"))}</span>
            <select name="guide-preview-option" data-choice-single>
              <option value="">${escapeHtml(this.chrome("field.selectPlaceholder"))}</option>
              ${options
                .map(
                  (option) => `
                    <option value="${escapeHtml(option.id)}" ${isChosen(option) ? "selected" : ""}>
                      ${escapeHtml(this.localized(option.label))}
                    </option>
                  `
                )
                .join("")}
            </select>
          </label>
          ${this.renderOpenOptionList(node, options, isChosen)}
          ${hiddenRow}
        `
        : `
          <fieldset class="guide-preview__options">
            <legend>${escapeHtml(this.chrome("field.chooseOption"))}</legend>
            ${options
              .map(
                (option) => `
                  <label ${isChosen(option) ? "data-chosen" : ""}>
                    <input
                      type="radio"
                      name="guide-preview-option"
                      value="${escapeHtml(option.id)}"
                      data-option-id="${escapeHtml(option.id)}"
                      ${isChosen(option) ? "checked" : ""}
                    >
                    <span>${escapeHtml(this.localized(option.label))}</span>
                  </label>
                `
              )
              .join("")}
            ${hiddenRow}
          </fieldset>
        `;

    return `
      <article class="guide-preview__card${this.nodeCssClasses(node)}" data-node-type="question">
        ${this.renderHeadingAndDescription(node)}
        ${redoneRow}
        ${control}
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /**
   * The row for an answer that has stopped being available (story 134).
   *
   * The same sentence the page's correction row carries, so the visitor reads
   * one wording wherever the question lives. Empty when nothing was answered,
   * or when what was answered is still on offer.
   */
  private renderChoiceRedoRow(
    node: FlowNodeData,
    previous: string,
    offered: QuestionOption[],
  ): string {
    if (previous === "" || offered.some((option) => option.value === previous)) {
      return "";
    }

    // A warning, not an error (Johan 21/9): the visitor did nothing wrong —
    // an answer they changed made an earlier choice invalid, and the choice
    // is already gone. `role="status"` reads it politely; the danger colours
    // would blame the visitor for the guide's own housekeeping.
    return `
      <p class="guide-preview__choice-redo" role="status" data-choice-redo>
        ${escapeHtml(
          this.chrome("validation.choiceRedo", {
            field: this.localized(node.data.title, ""),
          }),
        )}
      </p>
    `;
  }

  /** Antal-vägledning för en flervalsfråga, t.ex. "minst 2" eller "2–3". */
  private selectionHint(min: number | null, max: number | null): string {
    if (min !== null && max !== null) {
      return min === max
        ? this.chrome("field.hint.exact", { n: min })
        : this.chrome("field.hint.range", { min, max });
    }
    if (min !== null) {
      return this.chrome("field.hint.atLeast", { n: min });
    }
    if (max !== null) {
      return this.chrome("field.hint.atMost", { n: max });
    }
    return "";
  }

  /** Väljer rendering utifrån nodtypens deklarativa behavior. */
  private renderDeclarative(node: FlowNodeData, behavior: NodeBehavior): string {
    const { answer, flow } = behavior;

    /*
     * Uppslaget före antalet. Ett flervärt uppslag är ett SÖKFÄLT som tar
     * flera svar, inte en flervalsfråga — och eftersom antalet prövades först
     * hamnade det i flervalsrenderingen och ritade en tom alternativlista.
     * Kortet bar rubrik, beskrivning, "Välj ett eller flera" och ingen
     * inmatning alls. Hittat genom att titta på sidan, inte i sviten: varje
     * test som rörde kontrollen la den i en sida, och sidan väljer rendering
     * på fälttyp i stället för här.
     */
    if (answer.input === "lookup") {
      return this.renderDeclarativeLookup(node, answer.cardinality === "multi");
    }
    if (answer.cardinality === "multi") {
      return this.renderDeclarativeMulti(node, answer);
    }
    if (answer.cardinality === "single" && flow.kind === "branch") {
      return this.renderDeclarativeChoice(node);
    }
    if (answer.cardinality === "single" && answer.input === "text") {
      return this.renderDeclarativeText(node);
    }
    if (answer.cardinality === "single" && answer.input === "number") {
      return this.renderDeclarativeNumber(node);
    }
    if (answer.cardinality === "single" && answer.input === "date") {
      return this.renderDeclarativeDate(node);
    }
    if (answer.cardinality === "single" && answer.input === "rating") {
      return this.renderDeclarativeRating(node);
    }
    if (answer.cardinality === "single" && answer.input === "consent") {
      return this.renderDeclarativeConsent(node);
    }
    if (answer.cardinality === "single" && answer.input === "map") {
      return this.renderDeclarativeMap(node);
    }
    if (answer.cardinality === "single" && answer.input === "file") {
      return this.renderDeclarativeFile(node);
    }

    // Terminal (resultatliknande): rubrik/beskrivning, ingen Nästa.
    if (flow.kind === "end") {
      return `
        <article class="guide-preview__card" data-node-type="${escapeHtml(node.type)}">
          ${this.renderHeadingAndDescription(node)}
          ${this.renderNavigation(false)}
        </article>
      `;
    }

    // Ren informationsnod: rubrik/beskrivning och en väg framåt.
    return `
      <article class="guide-preview__card" data-node-type="${escapeHtml(node.type)}">
        ${this.renderHeadingAndDescription(node)}
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /** Flerval: kryssrutor med antals-ledtext (cardinality "multi"). */
  private renderDeclarativeMulti(
    node: FlowNodeData,
    answer: NodeBehavior["answer"]
  ): string {
    const all = QuestionOptionsService.getOptions(node);

    if (this.hasAttribute("compact")) {
      // The canvas card lists the question's options, not a visitor's.
      return `
        <article class="guide-preview__card" data-node-type="${escapeHtml(node.type)}">
          ${this.renderHeadingAndDescription(node)}
          <ul class="guide-preview__checklist">
            ${all
              .map(
                (option) =>
                  `<li>${escapeHtml(this.localized(option.label))}</li>`
              )
              .join("")}
          </ul>
          ${this.renderRoute(node, "continue", t("port.continue", this.activeLocaleValue))}
        </article>
      `;
    }

    // Story 134: only what this visitor's earlier answers allow.
    const options = QuestionOptionsService.visible(all, this.getAnswers());
    const hiddenRow = this.renderHiddenOptionsRow(options.length < all.length);
    const variableField = answer.variableField;
    const variableName = node.data[variableField];
    const previousValue =
      typeof variableName === "string"
        ? this.prefill()[variableName]
        : undefined;
    /*
     * Listan som lista, oavsett vilken form svaret kom i — och bara det som
     * fortfarande går att välja. Ett val som blivit dolt töms här (story 134):
     * kryssrutan finns inte att kryssa i, och den får inte heller stå kvar i
     * det kontrollen tror är valt.
     */
    const offered = new Set(options.map((option) => option.value));
    const selected = new Set(
      answerList(previousValue).filter((value) => offered.has(value)),
    );

    const numData = (field?: string): number | null =>
      field && typeof node.data[field] === "number"
        ? (node.data[field] as number)
        : null;
    const required = Boolean(
      answer.validation?.requiredField &&
        node.data[answer.validation.requiredField] === true
    );
    const min = numData(answer.validation?.minField) ?? (required ? 1 : null);
    const max = numData(answer.validation?.maxField);
    const hint = this.selectionHint(min, max);
    const legend = `${escapeHtml(this.chrome("field.chooseOneOrMore"))}${hint ? ` (${escapeHtml(hint)})` : ""}`;

    const control =
      node.data.presentation === "multiselect"
        ? this.renderChoicePillbox(node, options, selected, legend, hiddenRow)
        : this.renderChoiceBoxes(options, selected, legend, hiddenRow);

    return `
      <article class="guide-preview__card${this.nodeCssClasses(node)}" data-node-type="${escapeHtml(node.type)}">
        ${this.renderHeadingAndDescription(node)}
        ${control}
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /**
   * Kryssrutorna, och raden som säger att ett av valen står ensamt.
   *
   * ## Varför regeln finns här också
   *
   * Kryssrutorna är standard för en flervalsfråga med få alternativ, och
   * `chip-picker` tar över först när listan blir lång. *Inget av
   * ovanstående* hör hemma i den korta listan minst lika mycket som i den
   * långa — en regel som bara gällde den ena hade varit två svar på samma
   * fråga. Berättelse 062.
   *
   * ## Varför de exklusiva sorteras hit ned
   *
   * För att avskiljaren ska betyda något måste den ha allt av en sort på
   * varje sida. Ordningen är alltså en fråga för RITNINGEN — det som lagras
   * och det som prövas är oförändrat, och `options` rörs inte.
   *
   * ## Varför raden är ett `<p>` och inte en `<legend>`
   *
   * En `<fieldset>` har en legend, och den är redan tagen av antalskravet.
   * Raden bär ord som ska läsas, inte en gruppering — och den får varken
   * kryssruta, hus eller tabbplats, för då blir den något att trycka på.
   */
  private renderChoiceBoxes(
    options: QuestionOption[],
    selected: Set<string>,
    legend: string,
    hiddenRow = "",
  ): string {
    const ordinary = options.filter((one) => one.exclusive !== true);
    const alone = options.filter((one) => one.exclusive === true);
    const row = (option: QuestionOption): string => `
                  <label ${selected.has(option.value) ? "data-chosen" : ""}>
                    <input
                      type="checkbox"
                      name="guide-preview-multi"
                      value="${escapeHtml(option.value)}"
                      ${option.exclusive === true ? "data-exclusive" : ""}
                      ${selected.has(option.value) ? "checked" : ""}
                    >
                    <span>${escapeHtml(this.localized(option.label))}</span>
                  </label>
                `;
    // Bara när båda sorterna finns: en avskiljare med ingenting på ena sidan
    // skiljer ingenting, och läses som en rubrik över en lista utan andra del.
    const separated = ordinary.length > 0 && alone.length > 0;

    return `
          <fieldset class="guide-preview__options">
            <legend>${legend}</legend>
            ${ordinary.map(row).join("")}
            ${
              separated
                ? `<p class="guide-preview__choice-or" data-choice-separator>${escapeHtml(
                    this.chrome("choice.or"),
                  )}</p>`
                : ""
            }
            ${alone.map(row).join("")}
            ${hiddenRow}
          </fieldset>
          ${
            /*
             * Det koden kryssar UR hörs inte av sig självt.
             *
             * En kryssruta besökaren själv rör annonserar sin egen växling;
             * en som regeln tar bort gör det inte, och det är precis den som
             * måste sägas. Mätt 31/8: kortet bar ingen live-region alls.
             */
            ""
          }
          <p class="guide-preview__choice-status" data-multi-status role="status" aria-live="polite"></p>
        `;
  }

  /**
   * Flervalslistan: `chip-picker`, samma kontroll som regelvillkorets värde.
   *
   * ## Varför kryssrutorna står kvar som standard
   *
   * För att de är rätt när alternativen är få. Kryssrutor visar allt på en
   * gång, och "vilka har jag valt" besvaras utan att man rör något. Det slutar
   * gälla någonstans runt tio alternativ, och helt vid tvåhundra — medborgar‑
   * skap är fallet som gav upphov till den här kontrollen. Presentationen är
   * därför ett val i editorn, inte en åsikt här.
   *
   * ## Varför det inte är en `<select multiple>` längre
   *
   * Därför att det var ctrl-klick. Ingenting i bilden sa det, den som inte
   * fått veta klickade på ett andra alternativ och det första försvann tyst,
   * och på en pekskärm finns gesten inte alls — praxis 17.
   *
   * ## Varför kontrollen inte bor här
   *
   * För att den skrevs två gånger på en eftermiddag: här, och som värdefält
   * för ett regelvillkor. Två kopior av en KONTROLL är värre än två kopior av
   * en stil — en stil som glider isär ser fel ut, en kontroll som glider isär
   * beter sig olika på två ställen någon använder samma timme. Johans fråga:
   * *varför inte använda samma pillbox vi har i visaren?*
   */
  private renderChoicePillbox(
    node: FlowNodeData,
    options: { value: string; label: unknown }[],
    selected: Set<string>,
    legend: string,
    hiddenRow = "",
  ): string {
    void node;
    void options;
    void selected;

    return `
      <div class="guide-preview__pillbox">
        <span class="guide-preview__pillbox-legend" id="choice-legend">${legend}</span>
        <chip-picker data-choice-picker aria-labelledby="choice-legend"></chip-picker>
        ${hiddenRow}
      </div>
    `;
  }

  private renderPage(node: FlowNodeData): string {
    if (this.hasAttribute("compact")) {
      return `
        <article class="guide-preview__card" data-node-type="page">
          ${this.renderHeadingAndDescription(node)}
          ${this.renderCompactPageFields(node)}
          ${this.renderRoute(node, "continue", t("port.continue", this.activeLocaleValue))}
        </article>
      `;
    }

    const graph = this.guideGraph();
    const repeat = this.pageRepeat(node);
    if (repeat && graph) return this.renderRepeatingPage(node, graph, repeat);

    /*
     * The draft also decides visibility, which is right: a field that appears
     * because of what you just typed should appear while you fix a neighbour.
     */
    const answers = this.withPageCalculations(node, this.withArrivalValues(node, this.pageAnswers()));
    return `
      <article class="guide-preview__card" data-node-type="page">
        ${this.renderHeadingAndDescription(node)}
        ${this.renderPageErrorSummary(node)}
        <div class="guide-preview__page-fields">
          ${this.renderPageItems(node, graph, answers)}
        </div>
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /**
   * The page's items in order — headings, spacers and fields — for one set
   * of answers. `key` names the field in the DOM: the node id on a plain
   * page, the node id plus a record index on one that repeats.
   */
  private renderPageItems(
    node: FlowNodeData,
    graph: GraphData | undefined,
    answers: Answers,
    key: (fieldId: string) => string = (fieldId) => fieldId,
  ): string {
    /*
     * Every field, with this visitor's answers: `keepHidden` lifts the
     * field-level filter so the editor's canvas can reveal a hidden field with
     * its condition written above it, while an option's condition (story 134)
     * is still weighed against the answers the page is drawn from.
     */
    const fields = graph
      ? PageFieldsService.getFields(graph, node, answers, this.activeLocaleValue, { keepHidden: true })
      : [];
    const children = graph?.nodes
      .filter((candidate) => candidate.parentPageId === node.id)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0)) ?? [];
    return (children.length > 0 ? children : fields).map((item) => {
      const source = "data" in item ? item : undefined;
      if (source?.type === "page-heading") {
        return this.renderPageHeading(source, answers, graph);
      }
      if (source?.type === "page-spacer") {
        return `<div class="guide-preview__page-spacer guide-preview__page-item--break" data-page-spacer-id="${escapeHtml(source.id)}" aria-hidden="true"></div>`;
      }
      const field = source ? fields.find((candidate) => candidate.id === source.id) : item;
      if (!field || "data" in field) return "";
      const visible = !source || PageVisibilityService.isVisible(source, answers);
      /*
       * A visitor sees a conditional field only when its rule holds; an
       * author has to see it always. `editor-view` is what tells the two
       * apart — the site never sets it, so a published guide behaves
       * exactly as before.
       */
      const rule =
        !visible && source && this.revealsHiddenFields()
          ? PageVisibilityService.getBadgeLabel(source, {
              nodes: graph?.nodes,
              locale: this.activeLocaleValue,
              contentLocale: this.activeLocaleValue,
            })
          : null;
      return this.renderPageField(
        { ...field, id: key(field.id) },
        answerText(answers[field.variableName]),
        visible || rule !== null,
        rule,
      );
    }).join("");
  }

  /**
   * A page that repeats (story 084): one `fieldset` per record, *Barn 1*,
   * *Barn 2*, with the page's fields inside and Remove under them; Add after
   * the last.
   *
   * Every field id in the DOM carries the record's index — `f-name#1` — so
   * the error keys, the radio `name`s and the error ids that
   * `renderPageFieldBody` bakes from `field.id` become per record without a
   * second renderer. `nodeIdOf` takes the index off again where the node is
   * needed. Remove is drawn only above the floor and Add only below the
   * ceiling: a control that refuses is worse than one that is not there.
   *
   * The status line is where a removal is announced; the legend of a new
   * group announces itself when focus lands in it.
   */
  private renderRepeatingPage(node: FlowNodeData, graph: GraphData, repeat: PageRepeat): string {
    const stored = this.prefill();
    const records = this.repeatRecords(repeat, stored);
    const groups = records.map((_record, index) => `
      <fieldset class="guide-preview__repeat" data-repeat-group="${index}">
        <legend class="guide-preview__repeat-legend">${escapeHtml(this.repeatHeading(repeat, index))}</legend>
        <div class="guide-preview__page-fields">
          ${this.renderPageItems(node, graph, PageRepeatService.recordAnswers(stored, repeat.variable, records, index), (fieldId) => `${fieldId}#${index}`)}
        </div>
        ${records.length > repeat.min
          ? `<button type="button" class="guide-preview__repeat-remove" data-action="repeat-remove" data-repeat-index="${index}">${TRASH_ICON}<span>${escapeHtml(this.chrome("repeat.remove", { word: repeat.word, n: index + 1 }))}</span></button>`
          : ""}
      </fieldset>
    `);
    const canAdd = repeat.max === undefined || records.length < repeat.max;
    const addLabel = repeat.addLabel || this.chrome("repeat.add", { word: repeat.word });
    return `
      <article class="guide-preview__card" data-node-type="page">
        ${this.renderHeadingAndDescription(node)}
        ${this.renderPageErrorSummary(node)}
        ${groups.join("")}
        ${canAdd ? `<button type="button" class="guide-preview__repeat-add" data-action="repeat-add">${ADD_ICON}<span>${escapeHtml(addLabel)}</span></button>` : ""}
        <p class="guide-preview__repeat-status" data-repeat-status role="status" aria-live="polite"></p>
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /**
   * The records a repeating page shows: the draft if there is one (even an
   * empty one — the visitor may have removed the last), else what the engine
   * stored, else enough empty records to meet the floor and at least one, so
   * the fields are on screen before anything is pressed.
   */
  private repeatRecords(repeat: PageRepeat, stored: Answers): AnswerRecord[] {
    const draft = this.pageDraft?.[repeat.variable];
    if (draft !== undefined) return recordsOf(draft);
    if (stored[repeat.variable] !== undefined) return recordsOf(stored[repeat.variable]);
    return Array.from({ length: Math.max(repeat.min, 1) }, () => ({}));
  }

  private repeatHeading(repeat: PageRepeat, index: number): string {
    return this.chrome("repeat.legend", { word: PageRepeatService.heading(repeat.word), n: index + 1 });
  }

  private pageRepeat(page: FlowNodeData | null | undefined): PageRepeat | null {
    if (!page) return null;
    return PageRepeatService.get(page, this.activeLocaleValue, getSourceLocale(this.guideGraph()));
  }

  /** The visitor adds one more record (story 084): a new empty group, focus in it. */
  private repeatAdd(): void {
    const page = this.engine?.getCurrentNode();
    const repeat = this.pageRepeat(page);
    if (!page || !repeat) return;

    const records = recordsOf(this.getPageFormValues()[repeat.variable]);
    this.pageDraft = { [repeat.variable]: [...records, {}] };
    this.render();
    this.focusRepeatGroup(records.length);
    this.shareDraft();
  }

  /**
   * The visitor removes a record: focus goes to the group before, or to Add
   * when it was the first, and the status line says what happened — a
   * removed group leaves nothing on screen to say so by itself (AC 6).
   *
   * Errors keyed on later records move up with them; the ones on the removed
   * record go with it.
   */
  private repeatRemove(index: number): void {
    const page = this.engine?.getCurrentNode();
    const repeat = this.pageRepeat(page);
    if (!page || !repeat) return;

    const records = recordsOf(this.getPageFormValues()[repeat.variable]);
    records.splice(index, 1);
    this.pageDraft = { [repeat.variable]: records };
    const kept = [...this.pageFieldErrors.entries()]
      .filter(([key]) => recordIndexOf(key) !== index)
      .map(([key, message]): [string, string] => {
        const at = recordIndexOf(key);
        return [at !== null && at > index ? `${nodeIdOf(key)}#${at - 1}` : key, message];
      });
    this.pageFieldErrors.clear();
    kept.forEach(([key, message]) => this.pageFieldErrors.set(key, message));
    this.render();
    this.shareDraft();

    if (index > 0) this.focusRepeatGroup(index - 1);
    else this.root.querySelector<HTMLElement>('[data-action="repeat-add"]')?.focus();

    const status = this.root.querySelector<HTMLElement>("[data-repeat-status]");
    if (status) {
      status.textContent = this.chrome("repeat.removed", { word: PageRepeatService.heading(repeat.word), n: index + 1 });
    }
  }

  private focusRepeatGroup(index: number): void {
    this.root
      .querySelector<HTMLElement>(`[data-repeat-group="${index}"]`)
      ?.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select, chip-picker, button")
      ?.focus();
  }

  private renderCompactPageFields(node: FlowNodeData): string {
    const graph = this.guideGraph();
    if (!graph) {
      return "";
    }

    const fields = PageFieldsService.getFields(graph, node, undefined, this.activeLocaleValue);
    const children = graph.nodes
      .filter((candidate) => candidate.parentPageId === node.id)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    const items = children.length > 0 ? children : fields;

    if (items.length === 0) {
      return "";
    }

    const summaries = items.map((item) => {
      const source = "data" in item ? item : undefined;
      const id = source?.id ?? (item as PageField).id;
      const isHeading = source?.type === "page-heading";
      const isSpacer = source?.type === "page-spacer";
      // A child that is not a field — a calculation (story 095) — is not in
      // `fields`, so its label is read from its own title, like a heading's.
      const label = isHeading
        ? this.localized(source?.data.title, this.chrome("canvas.subheading"))
        : isSpacer
          ? this.chrome("canvas.blankRow")
          : (source
              ? fields.find((candidate) => candidate.id === source.id)?.label
                ?? this.localized(source.data.title, "")
              : (item as PageField).label) || this.chrome("canvas.unnamedField");
      const field = source
        ? fields.find((candidate) => candidate.id === source.id)
        : (item as PageField);
      const span = isHeading || isSpacer ? 12 : field?.columnSpan ?? 12;
      const widthClass = span === 4
        ? "guide-preview__page-field--third"
        : span === 6
          ? "guide-preview__page-field--half"
          : "guide-preview__page-field--full";
      const breakClass = !isHeading && field?.breakBefore ? "guide-preview__page-item--break" : "";
      const selectedClass = id === this.highlightedFieldId
        ? "guide-preview__page-field-summary--selected"
        : "";
      // A Text shown as a box (story 096) says so on the card too — icon and
      // word, the visitor's own — so *Viktigt* and plain text are told apart
      // without opening the panel.
      const kind = isHeading && source ? calloutKind(source) : null;
      const kindMark = kind
        ? `<span class="guide-preview__callout-kind"><span class="guide-preview__callout-icon" aria-hidden="true">${CALLOUT_ICONS[kind]}</span>${escapeHtml(this.chrome(`callout.${kind}`))}</span>`
        : "";

      return `
        <div class="guide-preview__page-field-summary ${widthClass} ${breakClass} ${selectedClass}"
          data-summary-kind="${isHeading ? "heading" : isSpacer ? "spacer" : "field"}"
          ${kind ? `data-callout-kind="${kind}"` : ""}
          data-page-field-id="${escapeHtml(id)}">
          ${kindMark}${escapeHtml(label)}
        </div>
      `;
    });

    return `<div class="guide-preview__page-fields guide-preview__page-fields--compact">${summaries.join("")}</div>`;
  }

  /**
   * A page field, and — in the editor's picture of the viewer — the rule above
   * it that decides whether a visitor ever sees it.
   *
   * `rule` is `null` in every case but that one. The sentence comes from
   * `PageVisibilityService`, the same one the node's visibility badge carries,
   * so there is one wording and not two. The dashed frame and the grey line are
   * a wrapper rather than something inside the field, because the field is
   * often a `<label>` and anything inside one becomes part of the control's
   * accessible name.
   */
  private renderPageField(
    field: PageField,
    value: string,
    visible: boolean,
    rule: string | null = null,
  ): string {
    const body = this.renderPageFieldBody(field, value, visible);

    if (rule === null) {
      return body;
    }

    const widthClass =
      field.columnSpan === 4
        ? "guide-preview__page-field--third"
        : field.columnSpan === 6
          ? "guide-preview__page-field--half"
          : "guide-preview__page-field--full";
    const breakClass = field.breakBefore ? "guide-preview__page-item--break" : "";

    return `
      <div class="guide-preview__conditional ${widthClass} ${breakClass}" data-conditional-for="${escapeHtml(field.id)}">
        <p class="guide-preview__conditional-rule">${escapeHtml(rule)}</p>
        ${body}
      </div>
    `;
  }

  /**
   * The quiet row under a list some of whose options are held back (story
   * 134). Drawn only when something is hidden — nothing else would be true,
   * and an empty row that is always there is a row people stop reading.
   *
   * Not `hidden`, not an empty element: absent from the DOM, which is also
   * what keeps the hidden options themselves out of it (K11).
   */
  private renderHiddenOptionsRow(hidden: boolean, id?: string): string {
    return hidden
      ? `<p class="guide-preview__options-hidden" data-options-hidden${id ? ` id="${escapeHtml(id)}"` : ""}>${escapeHtml(this.chrome("field.someOptionsHidden"))}</p>`
      : "";
  }

  /**
   * The same quiet row for the other reason (story 138, Astra 29/9): an
   * option chosen in another record of a page that repeats. Drawn only when
   * the setting actually held something back, and beside the conditions'
   * row rather than instead of it — two reasons are said as two.
   */
  private renderTakenOptionsRow(taken: boolean, id: string): string {
    return taken
      ? `<p class="guide-preview__options-hidden" data-options-taken id="${escapeHtml(id)}">${escapeHtml(this.chrome("field.optionsTakenElsewhere"))}</p>`
      : "";
  }

  private renderPageFieldBody(
    field: PageField,
    value: string,
    visible: boolean,
  ): string {
    const breakClass = field.breakBefore ? "guide-preview__page-item--break" : "";
    const highlightClass = nodeIdOf(field.id) === this.highlightedFieldId ? "guide-preview__page-field--selected" : "";
    const widthClass = field.columnSpan === 4 ? "guide-preview__page-field--third" : field.columnSpan === 6 ? "guide-preview__page-field--half" : "guide-preview__page-field--full";
    /*
     * Title, unit, required marker — in that order, and in one place.
     *
     * The unit sat after the required marker and gave *"Sökandens ålder
     * (obligatoriskt) i år"*. The unit belongs to the title, because it says
     * what to write; the requirement applies to the whole field and comes
     * last. The label wraps the control, so this is the field's accessible
     * name too.
     */
    const label = [
      escapeHtml(field.label),
      field.unit ? escapeHtml(this.chrome("field.unitSuffix", { unit: field.unit })) : "",
      field.required ? escapeHtml(this.chrome("field.required")) : "",
    ]
      .filter((part) => part !== "")
      .join(" ");
    /*
     * Story 134, criterion 6: a choice whose chosen option is no longer among
     * the ones offered. The answer is emptied by the option simply not being
     * drawn — no radio can carry it — and this is the other half, the saying
     * so. Written into the ordinary correction row, because a second place
     * for a field to speak from is a second place to keep in step.
     *
     * An error from a refused *Nästa* wins: it is about what the visitor just
     * did, and this one is about what they will see when they look.
     *
     * It is a warning, not an error (Johan 21/9): the visitor did nothing
     * wrong, a later answer hid an earlier choice and the choice is already
     * gone. So it takes the correction row's *place* — one spot for a field
     * to speak from — but the warning's tone and `role="status"`, and it
     * never marks the field invalid.
     */
    const redone =
      field.type === "choice" &&
      value !== "" &&
      !field.options.some((option) => option.value === value)
        ? this.chrome("validation.choiceRedo", { field: field.label })
        : null;
    const error = this.pageFieldErrors.get(field.id);
    const errorId = `page-field-error-${field.id}`;
    const invalidAttribute = error ? "data-invalid" : "";
    /*
     * The bounds on the element itself, so the platform's own picker greys out
     * what cannot be chosen. The service checks them again — a picker is a
     * courtesy and a pasted value is still an answer.
     */
    const dateAttributes =
      field.type === "date"
        ? `${field.minDate ? ` min="${escapeHtml(field.minDate)}"` : ""}` +
          `${field.maxDate ? ` max="${escapeHtml(field.maxDate)}"` : ""}`
        : "";
    /*
     * The row under a hidden-options list (story 134) sat as a bare sibling
     * paragraph: nothing pointed at it, so a screen reader landing on the
     * radios never heard it unless it happened to be read linearly (K3, story
     * 138 measurement). Given an id here and folded into the same
     * `aria-describedby` the error/redone text already uses — a field can
     * have both at once (an emptied choice on a list that also hides some).
     */
    const optionsHiddenId = field.type === "choice" && field.optionsHidden === true ? `page-field-hidden-${field.id}` : null;
    // Story 138: the row for options another record chose, joined the same way.
    const optionsTakenId = field.type === "choice" && field.optionsTaken === true ? `page-field-taken-${field.id}` : null;
    const describedByIds = [error || redone ? errorId : null, optionsHiddenId, optionsTakenId].filter((id): id is string => id !== null);
    const ariaAttributes = [
      error ? `aria-invalid="true"` : "",
      describedByIds.length > 0 ? `aria-describedby="${escapeHtml(describedByIds.join(" "))}"` : "",
    ].filter(Boolean).join(" ");
    const errorMarkup = error
      ? `<span class="guide-preview__field-error" id="${escapeHtml(errorId)}">${escapeHtml(error)}</span>`
      : redone
        ? `<span class="guide-preview__field-redo" id="${escapeHtml(errorId)}" role="status" data-choice-redo>${escapeHtml(redone)}</span>`
        : "";
    /*
     * "Varför frågar vi det här?" — the same disclosure the standalone step
     * draws, last in the cell. Never inside a `<label>`: a `<details>` is flow
     * content, and anything inside a label leaks into the field's accessible
     * name — the shape note's lesson, learnt once.
     */
    const why = this.renderWhyText(field.why);
    /*
     * The cell — `div`, never the label. The text and consent fields wrapped
     * their control in the label, and that label had grown into the cell: it
     * carried the width, the error, the − / + buttons, and there was no room
     * for anything that may not be inside a label. The file field had already
     * moved to `<label for>`; this is the same pattern, and the error and the
     * why are siblings of the label now, as they should have been.
     */
    const cellClass = `guide-preview__page-field ${widthClass} ${breakClass} ${highlightClass}`;
    const cellAttributes = `data-page-field-id="${escapeHtml(field.id)}" ${invalidAttribute} ${visible ? "" : "hidden"}`;

    if (field.type === "file") {
      /*
       * A plain file input, and a hidden field holding the name — which is the
       * whole answer. The file itself waits here until the guide reaches its
       * result and the host asks for it with `getFiles()`.
       *
       * There is no second variable and no note about an unconnected host. Both
       * belonged to a design where the file left as soon as it was picked; see
       * *Ladda upp vid val* in `docs/FIL-KONTRAKT.md`, which describes it and
       * says plainly that it is not built.
       *
       * In a run on the canvas the picker is swapped for a button that adds the
       * run's own stand-in (`proving-stand-ins.ts`). It REPLACES the picker
       * rather than standing beside it: a run cannot reach the machine's disk
       * for a real file, and an editor who opened the system dialog by mistake
       * would be looking for a photo to get past a step they only wanted to
       * walk through. Nothing is pressed for them — an unpressed step refuses
       * exactly as it refuses a visitor.
       */
      /*
       * The step's own example photo (story 108), when it has one.
       *
       * Two different offers are made of it, and the field carries the same
       * three facts to both: a run on the canvas draws it as the stand-in, and
       * a visitor gets a button that fetches it for real — but only where the
       * host asked for one with `example-files`. The library itself neither
       * stores nor fetches anything until a press.
       */
      const example = exampleImageOf(field);
      const standIn = this.hasAttribute("proving")
        ? provingStandInFor(field.accept ?? "", field.allowMarking === true, example)
        : null;
      /*
       * The button is named by what is written on it — WCAG's "label in name".
       *
       * It used to carry the file input's id, so the field's `<label for>`
       * renamed it: measured on the build, "Bild på skadan (obligatoriskt)"
       * matched twice and "Lägg till provbild" not at all, and anyone driving
       * the editor by voice asked for a button that did not exist. So under a
       * run the field's heading is not a `<label>` at all — nothing to name a
       * control with — and the button points at it with `aria-describedby`:
       * the heading is what the answer is FOR, the button says what pressing
       * does. It looks identical; `.guide-preview__page-field` styles its own
       * text and nothing in the sheet selects `label` inside it.
       */
      const labelId = `page-file-label-${escapeHtml(field.id)}`;
      /*
       * A file step of its own has its question as the card's heading; the
       * field's label said the same words again right under it (genomgången
       * 30/9, V14: *Har du bilder på skadan?* twice). Astra 1/10 (bilaga 10,
       * punkt 11): *"Undvik att upprepa frågerubriken som ytterligare synlig
       * etikett."* It stays for the ear — the button is described by it — and
       * leaves the eye. On a page it is the field's only label and stays.
       */
      const standalone = field.id === this.engine?.getCurrentNode()?.id;
      const heading = standIn
        ? `<span class="guide-preview__proving-label" id="${labelId}">${label}</span>`
        : `<span class="guide-preview__page-label${standalone ? " guide-preview__visually-hidden" : ""}" id="${labelId}">${label}</span>`;
      const picker = standIn
        ? `<button type="button" class="guide-preview__proving-button"
            aria-describedby="${labelId}"
            data-proving-file="${escapeHtml(field.id)}"
            data-proving-accept="${escapeHtml(field.accept ?? "")}"
            data-proving-marking="${field.allowMarking === true}"
            ${example ? `data-example-src="${escapeHtml(example.src)}" data-example-alt="${escapeHtml(example.alt)}"` : ""}>${escapeHtml(
              this.editorText(standIn.isImage ? "editor.proving.addPicture" : "editor.proving.addFile"),
            )}</button>
          <p class="guide-preview__proving-chosen" data-proving-chosen="${escapeHtml(field.id)}">${escapeHtml(value)}</p>
          <p class="guide-preview__proving-note" data-proving-note>${escapeHtml(
            this.editorText("editor.proving.standIn"),
          )}</p>`
        : /*
           * Our own button over the browser's picker (Astra 1/10, bilaga 10
           * punkt 11): *Välj fil* in the viewer's language, a neutral outline
           * like the other buttons beside a field, and the chosen name beside
           * it. The browser's own button spoke the BROWSER's language —
           * *Choose File* on a Swedish guide, measured in the inventory 30/9
           * (V14) — in the browser's own grey.
           *
           * The input stays, so the browser's file dialog, the drop of a file
           * and `getFiles()` are exactly what they were: the button opens it
           * with `click()`. It is out of sight and out of the tab order
           * (`aria-hidden` + `tabindex="-1"`, the pair the target-size gate
           * reads as "not a target"), so the button is the one control — named
           * by its own words, described by the field's label (label in name,
           * as the run's stand-in button above).
           */
          `<span class="guide-preview__file-pick">
            <button type="button" class="guide-preview__file-button"
              data-file-pick="${escapeHtml(field.id)}"
              aria-describedby="${labelId}${error ? ` ${escapeHtml(errorId)}` : ""}">${escapeHtml(this.chrome("field.attach"))}</button>
            <span class="guide-preview__file-chosen" data-file-chosen="${escapeHtml(field.id)}" role="status">${escapeHtml(value)}</span>
          </span>
          <input type="file" id="page-file-${escapeHtml(field.id)}" class="guide-preview__visually-hidden"
            tabindex="-1" aria-hidden="true"
            data-file-field="${escapeHtml(field.id)}"
            ${field.accept ? `accept="${escapeHtml(field.accept)}"` : ""}
            ${field.maxSize ? `data-max-size="${field.maxSize}"` : ""}
            ${field.required ? "required" : ""}>
          ${
            /*
             * Beside the picker, never instead of it: a visitor with a photo of
             * their own is the ordinary case, and the example is the way past a
             * step for somebody who has none — on the example site, on a demo, on
             * a page a host built to be tried. The host opts in with
             * `example-files`; a guide that carries an example photo but runs on
             * a page that said nothing shows no button at all.
             */
            example && this.hasAttribute("example-files")
              ? `<button type="button" class="guide-preview__example-button"
                  data-example-file="${escapeHtml(field.id)}"
                  data-example-src="${escapeHtml(example.src)}"
                  data-example-name="${escapeHtml(example.name)}"
                  data-example-alt="${escapeHtml(example.alt)}">${escapeHtml(this.chrome("file.useExample"))}</button>`
              : ""
          }`;

      return `
        <div class="guide-preview__page-field ${widthClass} ${breakClass} ${highlightClass}" data-page-field-id="${escapeHtml(field.id)}" ${invalidAttribute} ${visible ? "" : "hidden"}>
          ${heading}
          ${picker}
          <input type="hidden" data-page-variable="${escapeHtml(field.variableName)}" data-file-name="${escapeHtml(field.id)}" value="${escapeHtml(value)}">
          ${
            field.allowMarking
              ? `
                <div class="guide-preview__marking" data-marking-area="${escapeHtml(field.id)}" hidden>
                  <p class="guide-preview__marking-hint">${escapeHtml(this.chrome("marking.hint"))}</p>
                  <div class="guide-preview__marking-canvas" data-marking-canvas="${escapeHtml(field.id)}">
                    <img class="guide-preview__marking-image" data-marking-image="${escapeHtml(field.id)}" alt="">
                  </div>
                  <div class="guide-preview__marking-rows" data-marking-rows="${escapeHtml(field.id)}"></div>
                  <p class="guide-preview__marking-row">
                    <button type="button" class="guide-preview__marking-clear" data-marking-clear="${escapeHtml(field.id)}" hidden>${escapeHtml(this.chrome("marking.clear"))}</button>
                    <span class="guide-preview__marking-count" role="status" data-marking-count="${escapeHtml(field.id)}"></span>
                  </p>
                  <input type="hidden" data-page-variable="${escapeHtml(field.variableName)}Markeringar" data-marking-store="${escapeHtml(field.id)}" value="">
                </div>
              `
              : ""
          }
          ${errorMarkup}
          ${why}
        </div>
      `;
    }

    if (field.type === "consent") {
      /*
       * One control with one label, and no fieldset around it.
       *
       * The alternative — a `multi-choice` with a single option — renders a
       * group containing one checkbox, which a screen reader announces as a
       * group of one. A consent is one thing to agree to, and the label is the
       * agreement, so it goes on the checkbox itself.
       *
       * The value is the text "true" or empty, matching what a rule reads.
       */
      // The label still wraps the box: the whole row is the thing to hit (K6).
      return `
        <div class="${cellClass}" ${cellAttributes}>
          <label class="guide-preview__page-field--consent">
            <input type="checkbox"
              data-page-variable="${escapeHtml(field.variableName)}"
              data-consent
              value="true" ${value === "true" ? "checked" : ""}
              ${field.required ? "required" : ""} ${ariaAttributes}>
            <span>${label}</span>
          </label>
          ${errorMarkup}
          ${why}
        </div>
      `;
    }

    if (field.type === "rating") {
      /*
       * The same scale the standalone step draws, in the page's cell. The
       * legend is the field's own label — a page asks several questions, and
       * *Välj ett alternativ* over each of three rows would say nothing about
       * which row.
       *
       * Which radio is checked is decided on the TEXT of the answer: a step is
       * its number, the way out is its words. That holds unless an editor names
       * their way out "3" on a three-step scale, which would be a way out
       * called by the name of a step.
       */
      // `data-group`: an error marks the whole scale, not each step (punkt 6).
      return `
        <div class="${cellClass}" ${cellAttributes} data-group>
          ${this.ratingScale({
            steps: field.options,
            legend: label,
            name: `page-field-${escapeHtml(field.id)}`,
            chosen: value,
            waysOut: field.waysOut ?? [],
            layout: field.ratingLayout ?? "row",
            required: field.required,
            inputAttributes: `data-page-variable="${escapeHtml(field.variableName)}" ${ariaAttributes}`,
          })}
          ${errorMarkup}
          ${why}
        </div>
      `;
    }

    if (field.type === "choice") {
      /*
       * Nothing left to choose (story 138): no radio carries the field's
       * description or takes focus, so the fieldset does both — named by its
       * legend, described by the error and the row saying why, and the place
       * focus lands when *Nästa* is refused.
       */
      const empty = field.options.length === 0 && field.optionsTaken === true;
      const emptyAttributes = empty
        ? `tabindex="-1"${describedByIds.length > 0 ? ` aria-describedby="${escapeHtml(describedByIds.join(" "))}"` : ""}`
        : "";
      return `
        <fieldset class="guide-preview__page-field ${widthClass} ${breakClass} ${highlightClass}" data-page-field-id="${escapeHtml(field.id)}" ${invalidAttribute} ${visible ? "" : "hidden"} ${emptyAttributes} data-group>
          <legend>${label}</legend>
          ${why}
          ${
            /*
             * Story 138, Astra 29/9: every option is chosen in another record
             * and this one has none of its own — say so where the list would
             * be, never an empty list. The way on is on the page already:
             * Remove under the record, or another record's choice changed.
             */
            // Once *Nästa* is refused the error says this and the way on; said once.
            empty && !error
              ? `<p class="guide-preview__options-none" data-options-none>${escapeHtml(this.chrome("field.noOptionsLeft"))}</p>`
              : ""
          }
          ${empty ? "" : `<div class="guide-preview__page-choices">
            ${field.options.map((option) => `
              <label ${value === option.value ? "data-chosen" : ""}>
                <input type="radio" name="page-field-${escapeHtml(field.id)}"
                  data-page-variable="${escapeHtml(field.variableName)}"
                  value="${escapeHtml(option.value)}"
                  ${value === option.value ? "checked" : ""} ${field.required ? "required" : ""} ${ariaAttributes}>
                <span>${escapeHtml(this.localized(option.label))}</span>
              </label>
            `).join("")}
          </div>`}
          ${this.renderHiddenOptionsRow(field.optionsHidden === true, optionsHiddenId ?? undefined)}
          ${optionsTakenId ? this.renderTakenOptionsRow(true, optionsTakenId) : ""}
          ${
            /*
             * Under the whole group, its notes included (Astra 1/10, bilaga
             * 10 punkt 6). It stood between the question and the first
             * option, so the message read as the question's subtitle and
             * pushed the radios it was about down by its own height.
             */
            errorMarkup
          }
        </fieldset>
      `;
    }

    if (field.type === "lookup") {
      // The code lands in a hidden field with `data-page-variable`, so it is
      // collected the same way as every other page field. The lookup field
      // itself carries the label and has a `value` that behaves like a field's.
      return `
        <div class="guide-preview__page-field ${widthClass} ${breakClass} ${highlightClass}" data-page-field-id="${escapeHtml(field.id)}" ${invalidAttribute} ${visible ? "" : "hidden"}>
          <span class="guide-preview__page-label" id="page-lookup-${escapeHtml(field.id)}">${label}</span>
          <chip-picker
            data-text-lookup
            data-page-variable="${escapeHtml(field.variableName)}"
            data-lookup-node="${escapeHtml(field.id)}"
            aria-labelledby="page-lookup-${escapeHtml(field.id)}"
            min-chars="${field.minChars ?? 2}"
            ${field.multiple ? "" : "single"}
            ${error ? "data-invalid" : ""}
          ></chip-picker>
          ${
            /*
             * En dold ruta för koden fanns här, med sin egen variabel. Koden
             * är en DEL av svaret sedan version 9 (`land.code`) och reser med
             * det — så rutan har ingenting att bära, och den ritas inte.
             */
            ""
          }
          ${errorMarkup}
          ${why}
        </div>
      `;
    }

    /*
     * No `min`, `max` or `step` in the markup.
     *
     * They were written for `type="number"` and the field is text now — the
     * browser ignores all three on a text input, so they said something that
     * was not true of the control they sat on. What actually holds the bounds
     * is `PageFieldValidationService`, which reads them from the model and has
     * done all along.
     *
     * `step` had no reader at all, on either side: the editor still offers the
     * setting and nothing has enforced it since the field stopped being a
     * number input. Removing the attribute does not remove that gap — it stops
     * the markup from claiming the gap is filled. See C4 in the review.
     */
    const numberAttributes = "";
    const controlId = `page-field-${escapeHtml(field.id)}`;

    return `
      <div class="${cellClass} ${field.presentation ? `guide-preview__page-field--${field.presentation}` : ""}" ${cellAttributes}>
        <label for="${controlId}">${label}</label>
        ${field.multiline
          ? /*
             * No hard maxlength cap, same decision as the standalone text area:
             * you can overshoot and be told by validation, instead of having
             * your typing silently eaten at the limit. The service still
             * refuses an over-long answer on the way forward.
             */
            `<textarea id="${controlId}"
              data-page-variable="${escapeHtml(field.variableName)}"
              rows="4"
              placeholder="${escapeHtml(field.placeholder)}"
              ${field.required ? "required" : ""}
              ${ariaAttributes}>${escapeHtml(value)}</textarea>`
          : `${field.type === "date" ? '<span class="guide-preview__date">' : ""}<input type="${field.type === "date" ? "date" : "text"}" id="${controlId}"
          ${field.type === "number"
            ? 'inputmode="decimal" data-group'
            : (() => {
                const keyboard = keyboardFor(field.format, field.mask);
                const autofill = sectioned(
                  autocompleteWordFor(field.format, field.autofill),
                  field.id,
                );

                return [
                  keyboard ? `inputmode="${keyboard}"` : "",
                  autofill ? `autocomplete="${autofill}"` : "",
                ].join(" ");
              })()}
          data-page-variable="${escapeHtml(field.variableName)}"
          ${field.format ? ` data-format="${escapeHtml(field.format)}"` : ""}
          ${field.mask ? ` data-mask="${escapeHtml(field.mask)}"` : ""}
          value="${escapeHtml(field.type === "number" ? maskGrouped(value, value.length, this.activeLocaleValue).value : value)}"
          ${field.type === "number" ? `data-canonical="${escapeHtml(value)}" data-number-target="${escapeHtml(field.id)}"` : ""}
          placeholder="${escapeHtml(field.placeholder)}"
          ${field.required ? "required" : ""} ${field.type === "date" && value === "" ? 'class="guide-preview__date-empty"' : ""} ${numberAttributes} ${dateAttributes} ${ariaAttributes}>${field.type === "date" ? `${this.dateResting(value)}</span>` : ""}`}
        ${field.presentation
          ? this.renderNumberControls({ id: field.id, label: field.label, presentation: field.presentation, min: field.min, max: field.max, step: field.step, value })
          : ""}
        ${errorMarkup}
        ${why}
      </div>
    `;
  }

  /**
   * The slider or the − / + buttons beside a number field (story 095).
   *
   * They come AFTER the field in the markup, inside its label: the label's
   * control is the first labelable descendant, and a button before the field
   * would have taken the name. The slider carries its own name — the field's,
   * with "reglage" after it — so a screen reader meets two controls that say
   * what they are, not one nameless one. Neither carries `data-page-variable`:
   * the field is the answer, the others write into it (`wireNumberControls`).
   *
   * No slider without both ends: a `<input type="range">` with no `min`/`max`
   * runs 0–100, which is never the spann anybody meant. The health check says
   * so; here the field just stands alone.
   */
  private renderNumberControls(control: {
    id: string;
    label: string;
    presentation: "range" | "stepper";
    min?: number;
    max?: number;
    step?: number;
    value: string;
  }): string {
    const id = escapeHtml(control.id);
    const step = control.step ?? 1;

    if (control.presentation === "stepper") {
      return `
        <span class="guide-preview__stepper" data-stepper-for="${id}" data-step="${step}"
          ${typeof control.min === "number" ? `data-min="${control.min}"` : ""} ${typeof control.max === "number" ? `data-max="${control.max}"` : ""}>
          <button type="button" class="guide-preview__step-button" data-step-for="${id}" data-step="-1" aria-label="${escapeHtml(this.chrome("field.stepDown", { label: control.label }))}"><span aria-hidden="true">−</span></button>
          <button type="button" class="guide-preview__step-button" data-step-for="${id}" data-step="1" aria-label="${escapeHtml(this.chrome("field.stepUp", { label: control.label }))}"><span aria-hidden="true">+</span></button>
        </span>
      `;
    }

    if (typeof control.min !== "number" || typeof control.max !== "number") {
      return "";
    }
    const number = Number(control.value);
    const value = control.value !== "" && Number.isFinite(number) ? number : control.min;

    return `
      <input type="range" class="guide-preview__range" data-range-for="${id}"
        min="${control.min}" max="${control.max}" step="${step}" value="${value}"
        aria-label="${escapeHtml(this.chrome("field.slider", { label: control.label }))}">
    `;
  }

  /**
   * The slider and the − / + buttons write into the field, and the field is
   * what everything else reads. So the slider sets the field's value and
   * dispatches `input` on it — the grouping, the canonical copy and the page's
   * live pass all hang on that event — and the field, when typed in, moves the
   * slider. One direction each, no loop: the slider's write into the field
   * never fires the slider's own `input`.
   *
   * A step from an empty field starts at `min` (or 0), not at NaN; a step is
   * clamped to the spann and rounded to the step's own decimals, so 0,1 + 0,2
   * is 0,3 and not 0,30000000000000004.
   */
  private wireNumberControls(): void {
    const fieldFor = (id: string): HTMLInputElement | null =>
      this.root.querySelector<HTMLInputElement>(`input[data-number-target="${id}"]`);
    const write = (field: HTMLInputElement, canonical: string): void => {
      field.value = maskGrouped(canonical, canonical.length, this.activeLocaleValue).value;
      field.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    };

    this.root.querySelectorAll<HTMLInputElement>("input[data-range-for]").forEach((range) => {
      const field = fieldFor(range.dataset.rangeFor ?? "");
      if (!field) return;
      range.addEventListener("input", () => write(field, range.value));
      field.addEventListener("input", () => {
        const number = Number(ungroup(field.value, this.activeLocaleValue));
        if (Number.isFinite(number)) range.value = String(number);
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>("button[data-step-for]").forEach((button) => {
      const field = fieldFor(button.dataset.stepFor ?? "");
      if (!field) return;
      // The spann sits on the buttons' wrapper: a page field carries none of
      // it in its markup (see `numberAttributes`), the validation reads the model.
      const bounds = (button.parentElement as HTMLElement).dataset;
      button.addEventListener("click", () => {
        const step = Number(bounds.step ?? 1) || 1;
        const min = bounds.min === undefined ? undefined : Number(bounds.min);
        const max = bounds.max === undefined ? undefined : Number(bounds.max);
        const direction = Number(button.dataset.step);
        const current = Number(ungroup(field.value, this.activeLocaleValue));
        // An empty field: + gives min (or 0), − gives min too. Nothing is not a number to count from.
        const from = field.value.trim() !== "" && Number.isFinite(current) ? current : (min ?? 0) - direction * step;
        let next = from + direction * step;
        if (min !== undefined) next = Math.max(min, next);
        if (max !== undefined) next = Math.min(max, next);
        const decimals = (String(step).split(".")[1] ?? "").length;
        write(field, next.toFixed(decimals));
      });
    });
  }

  /**
   * What the page's fields show on arrival, as answers — see
   * `ArrivalValueService`, the one answer to that question (story 118).
   */
  private withArrivalValues(page: FlowNodeData, answers: Answers): Answers {
    const graph = this.guideGraph();
    return graph ? ArrivalValueService.forPage(graph.nodes, page, answers) : answers;
  }

  /**
   * The page's answers with its calculations run over them (story 095): what
   * a text, a condition and the Nästa-validation on this page read. One
   * call on the way in and one per keystroke — see `updatePageFieldVisibility`.
   */
  private withPageCalculations(page: FlowNodeData, answers: Answers): Answers {
    const graph = this.guideGraph();
    return graph ? CalculationService.runInPage(graph.nodes, page, answers) : answers;
  }

  private renderPageHeading(
    node: FlowNodeData,
    answers: Answers,
    graph?: GraphData
  ): string {
    const visible = PageVisibilityService.isVisible(node, answers);
    const highlightClass = node.id === this.highlightedFieldId ? "guide-preview__page-field--selected" : "";
    // Same rule as a conditional field, one line along: shown to the author
    // with the condition spelled out, hidden from the visitor until it holds.
    const rule =
      !visible && this.revealsHiddenFields()
        ? PageVisibilityService.getBadgeLabel(node)
        : null;
    const kind = calloutKind(node);
    // "--with-body" (not `:has()`): css-ratchet.test.ts caps `:has()` at 3
    // uses on purpose (K18, webbläsargolvet inte mätt än) — en klass från
    // sidan som redan vet om den har brödtext kostar inget och fungerar
    // överallt. Se guide-preview.scss vid `.guide-preview__callout` för
    // vilket avstånd det styr (variant C, Fable/Johan 21/9).
    const hasBody = kind !== null && this.localized(node.data.description).trim() !== "";
    const calloutClass = kind
      ? `guide-preview__callout guide-preview__callout--${kind}${hasBody ? " guide-preview__callout--with-body" : ""}`
      : "";
    const section = `
      <section class="guide-preview__page-heading guide-preview__page-item--break ${calloutClass} ${highlightClass}"
        data-page-heading-id="${escapeHtml(node.id)}" ${kind ? `data-callout-kind="${kind}"` : ""} ${visible || rule !== null ? "" : "hidden"}>
        ${this.renderPageHeadingBody(node, answers, graph)}
      </section>
    `;

    return rule === null
      ? section
      : `
        <div class="guide-preview__conditional guide-preview__page-item--break" data-conditional-for="${escapeHtml(node.id)}">
          <p class="guide-preview__conditional-rule">${escapeHtml(rule)}</p>
          ${section}
        </div>
      `;
  }

  /**
   * What is inside a Text section (story 095): the heading if there is one,
   * the text if there is one. Drawn on its own so the page can redraw it
   * while the visitor types — `{{kostnad}}` changes as the slider moves.
   *
   * No `<h3>` for an empty title: a heading with nothing in it is a stop in
   * the screen reader's outline that says nothing.
   *
   * Shown as a box (story 096), the kind comes first — the icon on the first
   * line of text, so print and greyscale say what the colour says (K3), and
   * the word for whoever cannot see the icon: it is read, not shown, since
   * Johan judged icon plus word crowded next to the heading. It is part of
   * the body and not the frame because the body is what is redrawn while the
   * visitor answers, and the kind must survive that. No role, no aria-live:
   * it is text in its order, not something that happened.
   */
  private renderPageHeadingBody(node: FlowNodeData, answers: Answers, graph?: GraphData): string {
    const kind = calloutKind(node);
    const title = this.localized(node.data.title);
    // The kind line takes the line-height of the text beside it — the heading's when there is one.
    const kindClass = `guide-preview__callout-kind${title ? " guide-preview__callout-kind--by-heading" : ""}`;
    const kindLine = kind
      ? `<p class="${kindClass}"><span class="guide-preview__callout-icon" aria-hidden="true">${CALLOUT_ICONS[kind]}</span><span class="guide-preview__callout-word">${escapeHtml(this.chrome(`callout.${kind}`))}</span></p>`
      : "";
    const descriptionText = this.localized(node.data.description);
    /*
     * Through `markUnanswered` like every other text. It did not, and that is
     * the whole of the Låna bug: the box is the one text a visitor reads on
     * the same page as the calculation feeding it, so it is the one that meets
     * an unanswered variable — and it was the one text drawn straight from the
     * service (measured 13/9).
     */
    const description = descriptionText
      ? this.markUnanswered(
          FormattedTextService.render(
            descriptionText,
            this.formattingFor(node, "description"),
            answers,
            graph,
            this.activeLocaleValue,
          ).html,
        )
      : "";

    return `
      ${kindLine}
      ${title ? `<h3>${escapeHtml(title)}</h3>` : ""}
      ${description ? `<div class="guide-preview__formatted">${description}</div>` : ""}
    `;
  }
  /**
   * Lookup: a search field with suggestions (input "lookup").
   *
   * The picker carries `data-text-answer` deliberately, so the step machinery
   * finds it where it finds every other value field — but it is read through
   * `lookupPicker()` and not as an `input`, because its `value` is a list of
   * codes and the answer text is the labels.
   */
  private renderDeclarativeLookup(node: FlowNodeData, multiple = false): string {
    if (this.hasAttribute("compact")) {
      return `
        <article class="guide-preview__card" data-node-type="autocomplete-question">
          ${this.renderHeadingAndDescription(node)}
          ${this.renderRoute(node, "continue", t("port.continue", this.activeLocaleValue))}
        </article>
      `;
    }

    const required = node.data.required === true;

    return `
      <article class="guide-preview__card" data-node-type="autocomplete-question">
        ${this.renderHeadingAndDescription(node)}
        <p class="guide-preview__value-answer" id="guide-lookup-label">
          <span>${escapeHtml(
            /*
             * "Skriv ditt svar" är fel uppmaning över ett fält som tar flera
             * val ur en sluten lista — man kan inte skriva ett svar där, bara
             * söka fram ett. Sett i skärmbilden av medborgarskapsguiden.
             */
            this.chrome(multiple ? "field.chooseOneOrMore" : "field.writeAnswer"),
          )}${required ? ` ${escapeHtml(this.chrome("field.required"))}` : ""}</span>
        </p>
        <chip-picker
          data-text-answer
          data-text-lookup
          data-lookup-node="${escapeHtml(node.id)}"
          aria-labelledby="guide-lookup-label"
          min-chars="${LookupService.getMinChars(node)}"
          ${multiple ? "" : "single"}
        ></chip-picker>
        <span class="guide-preview__field-error" data-text-validation id="guide-value-error" role="alert" hidden></span>
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /** Visar ett inline-besked på värdefältet och flyttar fokus dit. */
  private showValueFieldError(message: string): void {
    const region = this.root.querySelector<HTMLElement>(
      "[data-number-validation], [data-text-validation]",
    );

    if (region) {
      region.textContent = message;
      region.hidden = false;
    }

    const picker = this.root.querySelector<HTMLElement>("chip-picker[data-text-answer]");
    // The same red frame as every other field in error (punkt 6); taken off
    // again by the next chip, with the message (`connectLookupFields`).
    picker?.setAttribute("data-invalid", "");
    picker?.shadowRoot?.querySelector<HTMLInputElement>("[data-search]")?.focus();
  }

  /**
   * Gives every mounted search field its search function and its texts.
   *
   * The fields are created from HTML strings and therefore cannot be given
   * properties in markup. The wiring is redone after every render, which is
   * cheap: a render happens per step, not per keystroke.
   */
  private connectLookupFields(): void {
    this.root
      .querySelectorAll<LookupPicker>("chip-picker[data-lookup-node]")
      .forEach((field) => {
        const nodeId = nodeIdOf(field.dataset.lookupNode ?? "");
        const node = this.guideGraph()?.nodes.find(
          (candidate) => candidate.id === nodeId,
        );

        if (!node) {
          return;
        }

        field.search = (term) =>
          LookupService.search(node, term, this.activeLocaleValue);

        /*
         * The editor's own placeholder wins over the generic one. It used to
         * be an attribute on the field; the merged control takes every word it
         * shows through this one set, so it comes in here.
         */
        const placeholder = this.localized(node.data.placeholder);

        field.strings = {
          ...this.pickerStrings(),
          search: placeholder || this.chrome("choice.searchPlaceholder"),
          hint: this.chrome("choice.hint", { n: LookupService.getMinChars(node) }),
        };

        field.addEventListener("chip-change", () => {
          /*
           * The Next button renders disabled for an empty required field. The
           * picker is not an `input`, so the ordinary input listener does not
           * reach it — without this the button stayed disabled however much
           * you typed, and the step could not be left.
           */
          const region = this.root.querySelector<HTMLElement>(
            "[data-text-validation]",
          );

          if (region) {
            region.hidden = true;
          }
          if (field.hasAttribute("data-text-answer")) field.removeAttribute("data-invalid");

          // A picked chip is part of the page's draft too (see `shareDraft`).
          this.shareDraft();
        });
      });

    this.restoreLookupChoices();
  }

  /**
   * The picker in this step that carries a lookup answer.
   *
   * `data-text-answer` deliberately, as the old field had it: the element has
   * a value that behaves like a field's, so the rest of the step machinery
   * reads it without needing to know it is not an `input`.
   */
  private lookupPicker(): LookupPicker | null {
    return this.root.querySelector<LookupPicker>("chip-picker[data-text-answer]");
  }

  /**
   * What a lookup answers as text: the labels, or what was typed.
   *
   * Free text only where it can exist — a single-value lookup, where the
   * search box IS the answer field. Several values are searched for, never
   * typed, so leftover text in the box there is a search somebody abandoned
   * and not an answer.
   */
  private lookupLabels(picker: LookupPicker | null): string {
    if (!picker) return "";

    const labels = picker.choices.map((one) => one.label);

    if (labels.length > 0) return labels.join("\n");

    return picker.hasAttribute("single") ? picker.text : "";
  }

  /** The codes behind the choices. Empty when the answer is free text. */
  private lookupCodes(picker: LookupPicker | null): string {
    return (picker?.choices ?? []).map((one) => one.value).join("\n");
  }

  /** Every word the merged picker shows, from the viewer's own register. */
  private pickerStrings(): ChipPickerStrings {
    return {
      search: this.chrome("choice.searchPlaceholder"),
      searchLabel: this.chrome("choice.search"),
      empty: this.chrome("choice.chosenNone"),
      remove: this.chrome("choice.remove", { label: "{label}" }),
      added: this.chrome("choice.added", { label: "{label}", n: "{n}" }),
      addedOne: this.chrome("choice.addedOne", { label: "{label}" }),
      removed: this.chrome("choice.removed", { label: "{label}", n: "{n}" }),
      removedOne: this.chrome("choice.removedOne", { label: "{label}" }),
      count: this.chrome("choice.left", { n: "{n}" }),
      oneLeft: this.chrome("choice.oneLeft"),
      matches: this.chrome("choice.matches", { n: "{n}" }),
      oneMatch: this.chrome("choice.oneMatch"),
      noMatches: this.chrome("choice.noMatches", { term: "{term}" }),
      allChosen: this.chrome("choice.allChosen"),
      hint: this.chrome("choice.hint", { n: "{n}" }),
      searching: this.chrome("choice.searching"),
      error: this.chrome("choice.error"),
      or: this.chrome("choice.or"),
      exclusiveCleared: this.chrome("choice.exclusiveCleared", { removed: "{removed}" }),
      exclusiveRemoved: this.chrome("choice.exclusiveRemoved", { removed: "{removed}" }),
    };
  }

  /** Text: ett fritextfält, linjärt (input "text"). */
  private renderDeclarativeText(node: FlowNodeData): string {
    if (this.hasAttribute("compact")) {
      return `
        <article class="guide-preview__card" data-node-type="text-question">
          ${this.renderHeadingAndDescription(node)}
          ${this.renderRoute(node, "continue", t("port.continue", this.activeLocaleValue))}
        </article>
      `;
    }

    const variableName =
      typeof node.data.variableName === "string" ? node.data.variableName : "";
    const previousValue = variableName
      ? answerText(this.prefill()[variableName])
      : "";
    const placeholder = this.localized(node.data.placeholder);
    const required = node.data.required === true;
    const maxLengthNum =
      typeof node.data.maxLength === "number" ? node.data.maxLength : null;
    const minLength =
      typeof node.data.minLength === "number"
        ? `minlength="${node.data.minLength}"`
        : "";
    const maxLength = maxLengthNum !== null ? `maxlength="${maxLengthNum}"` : "";
    // Låt formatet välja HTML-inputtyp: e-post/telefon ger rätt mobiltangentbord.
    const inputType =
      node.data.format === "email"
        ? "email"
        : node.data.format === "phone"
          ? "tel"
          : "text";
    /*
     * Sifferbord när formen bara har siffror i sig — ett personnummer skrivs på
     * en platta, och den som får hela skrivbordstangentbordet letar efter tio
     * knappar bland hundra. Bindestrecket sätter masken dit.
     */
    const keyboard = keyboardFor(
      typeof node.data.format === "string" ? node.data.format : undefined,
      typeof node.data.mask === "string" ? node.data.mask : undefined,
    );
    /*
     * The format's word first, the editor's choice after it (story 110): a
     * format that already says what the field is has said it, and a leftover
     * choice from before the format was set must not overrule it.
     */
    const autofill = autocompleteWordFor(node.data.format, node.data.autofill);
    const isTextarea = node.data.presentation === "textarea";
    const cardClasses = this.nodeCssClasses(node);

    // The format/pattern travels along as data so the inline validation (on
    // blur) can mirror the engine's check without knowing the node's data.
    const formatValue =
      typeof node.data.format === "string" ? node.data.format : "";
    const patternValue =
      typeof node.data.pattern === "string" ? node.data.pattern : "";
    const validationData =
      `${formatValue ? ` data-format="${escapeHtml(formatValue)}"` : ""}` +
      `${typeof node.data.mask === "string" && node.data.mask ? ` data-mask="${escapeHtml(node.data.mask)}"` : ""}` +
      `${patternValue ? ` data-pattern="${escapeHtml(patternValue)}"` : ""}`;

    // The text area gets no hard maxlength cap — that way you can overshoot and
    // see by how much, while the engine blocks an over-long answer on the way
    // forward.
    const initialCounter = this.charCounterState(previousValue.length, maxLengthNum);
    const control = isTextarea
      ? `
          <textarea
            data-text-answer
            data-char-max="${maxLengthNum ?? ""}"${validationData}
            placeholder="${escapeHtml(placeholder)}"
            rows="4"
            ${required ? "required" : ""}
            ${minLength}
          >${escapeHtml(previousValue)}</textarea>
          <span
            class="guide-preview__char-counter${initialCounter.modifier ? ` guide-preview__char-counter--${initialCounter.modifier}` : ""}"
            data-char-counter
            aria-live="polite"
          >${escapeHtml(initialCounter.text)}</span>
        `
      : `
          <input
            type="${inputType}"
            ${keyboard ? `inputmode="${keyboard}"` : ""}
            ${autofill ? `autocomplete="${autofill}"` : ""}
            data-text-answer
            data-char-max="${maxLengthNum ?? ""}"${validationData}
            value="${escapeHtml(previousValue)}"
            placeholder="${escapeHtml(placeholder)}"
            ${required ? "required" : ""}
            ${minLength}
            ${maxLength}
          >
        `;

    return `
      <article class="guide-preview__card${cardClasses}" data-node-type="text-question">
        ${this.renderHeadingAndDescription(node)}
        <label class="guide-preview__value-answer">
          <span>${escapeHtml(this.chrome("field.writeAnswer"))}${required ? ` ${escapeHtml(this.chrome("field.required"))}` : ""}</span>
          ${control}
          <span class="guide-preview__field-error" data-text-validation id="guide-value-error" role="alert" hidden></span>
        </label>
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /**
   * Speglar motorns textvalidering (obligatoriskt → minlängd → maxlängd →
   * format) mot fältet, utifrån dess attribut. Returnerar felmeddelandet
   * eller null. Används för inline-besked på blur.
   */
  private textFieldError(
    el: HTMLInputElement | HTMLTextAreaElement
  ): string | null {
    /*
     * The answer, not the separators drawn around it.
     *
     * The engine measures the canonical value and this measured the display, so
     * a mask of `## ##` with a minimum of five let `12 34` pass on blur — four
     * digits dressed as five characters — and Next then refused it. Two counts
     * of one thing that disagree are worse than one strict count: the resident
     * is told they are finished, and then told they are not.
     */
    const value = this.canonicalOf(el);
    if (el.required && value.trim().length === 0) {
      return this.chrome("validation.required");
    }
    const minAttr = el.getAttribute("minlength");
    if (minAttr && value.length < Number(minAttr)) {
      return this.chrome("validation.minLength", { n: Number(minAttr) });
    }
    const maxAttr = el.getAttribute("data-char-max");
    if (maxAttr && value.length > Number(maxAttr)) {
      return this.chrome("validation.maxLength", { n: Number(maxAttr) });
    }
    const formatErrorKey = validateFormat(
      el.getAttribute("data-format") ?? undefined,
      el.getAttribute("data-pattern") ?? undefined,
      value
    );
    return formatErrorKey ? this.chrome(formatErrorKey) : null;
  }

  /**
   * Mirrors the engine's number validation (valid number → min → max) against
   * the field. Returns the error message or null. An empty field passes here —
   * "move on" handles the empty case. Used for inline messages on blur.
   */
  /**
   * What a field's value means, worked out now rather than looked up.
   *
   * `data-canonical` is written whenever the field changes through an event,
   * and read at collection. That copy goes stale the moment a value arrives
   * without one — autofill, a password manager, a script — and the stale copy
   * won: the field showed `42` while the host received the `100` typed before
   * it.
   *
   * Recomputing here cannot go stale, and it takes the empty-string trap with
   * it: a canonical of `""` is not nullish, so `??` never fell through to the
   * value, and a field the resident had emptied was reported as still holding
   * its old contents.
   *
   * Measured before choosing this over a property setter or an observer: no
   * host flow sets these fields at all — the frozen surface has no member that
   * writes an answer, and the SiteVision module only assigns its own hidden
   * bridge fields. Intercepting a native property to catch a caller that does
   * not exist would be the more impressive fix and the wrong one.
   */
  /** The note a shaped field points at with `aria-describedby`. */
  private shapeNoteFor(input: HTMLInputElement): HTMLElement | null {
    const id = input.dataset.shapeNoteId;

    return id ? this.root.querySelector<HTMLElement>(`[data-shape-note][id="${id}"]`) : null;
  }

  private canonicalOf(control: HTMLInputElement | HTMLTextAreaElement): string {
    if (control instanceof HTMLInputElement && control.dataset.group !== undefined) {
      return ungroup(control.value, this.activeLocaleValue);
    }

    return control instanceof HTMLInputElement && control.dataset.format !== undefined
      ? canonicalFormat(control.dataset.format, control.value)
      : control.value;
  }

  private numberFieldError(el: HTMLInputElement): string | null {
    /*
     * The digits, not what is on screen. `2 100 000` is `NaN` to `Number`, so
     * reading the field's own value would have called every grouped amount
     * invalid the moment it grew past three digits.
     */
    const value = (el.dataset.canonical ?? el.value).trim();
    if (value === "") {
      return null;
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return this.chrome("validation.number.invalid");
    }
    const minAttr = el.getAttribute("data-min");
    if (minAttr !== null && num < Number(minAttr)) {
      return this.chrome("validation.number.min", { n: Number(minAttr) });
    }
    const maxAttr = el.getAttribute("data-max");
    if (maxAttr !== null && num > Number(maxAttr)) {
      return this.chrome("validation.number.max", { n: Number(maxAttr) });
    }
    return null;
  }

  /**
   * Shows/hides a field's inline error and links the field to the message with
   * aria-invalid plus aria-describedby, so screen readers announce the error and
   * that the field is invalid. `message === null` clears the error.
   */
  private setFieldValidity(
    field: HTMLInputElement | HTMLTextAreaElement,
    errorRegion: HTMLElement | null,
    message: string | null
  ): void {
    if (errorRegion) {
      errorRegion.textContent = message ?? "";
      errorRegion.hidden = message === null;
    }
    if (message === null) {
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
    } else {
      field.setAttribute("aria-invalid", "true");
      if (errorRegion?.id) {
        field.setAttribute("aria-describedby", errorRegion.id);
      }
    }
  }

  /**
   * The character counter's text and colour state. Without a maximum, typed
   * characters are counted. With one it counts down, turns amber near the cap
   * and red with "för mycket" once passed — the colour is always accompanied by
   * text.
   */
  private charCounterState(
    length: number,
    max: number | null
  ): { text: string; modifier: "" | "near" | "over" } {
    if (max === null) {
      return { text: this.chrome("counter.count", { n: length }), modifier: "" };
    }
    const remaining = max - length;
    if (remaining < 0) {
      return {
        text: this.chrome("counter.over", { n: -remaining }),
        modifier: "over",
      };
    }
    const nearThreshold = Math.max(1, Math.ceil(max * 0.1));
    return {
      text: this.chrome("counter.remaining", { n: remaining }),
      modifier: remaining <= nearThreshold ? "near" : "",
    };
  }

  /**
   * Extra CSS classes a node carries with it (the "CSS-klasser" field), as a
   * leading space ready to be appended to the `class` attribute.
   */
  private nodeCssClasses(node: FlowNodeData): string {
    const raw =
      typeof node.data.cssClasses === "string" ? node.data.cssClasses.trim() : "";
    if (!raw) {
      return "";
    }
    return raw
      .split(/\s+/)
      .map((token) => ` ${escapeHtml(token)}`)
      .join("");
  }

  /** Siffra: ett sifferfält, linjärt (input "number"). */
  private renderDeclarativeNumber(node: FlowNodeData): string {
    if (this.hasAttribute("compact")) {
      return `
        <article class="guide-preview__card" data-node-type="number-question">
          ${this.renderHeadingAndDescription(node)}
          ${this.renderRoute(node, "continue", t("port.continue", this.activeLocaleValue))}
        </article>
      `;
    }

    const variableName = typeof node.data.variableName === "string"
      ? node.data.variableName
      : "";
    /*
     * The start value where the visitor has not answered yet (story 118),
     * from the same service the page uses. The panel offers the setting on
     * every number question, so it has to work on every number question — a
     * setting that bites only inside a page is one the redaktör cannot trust.
     */
    const previousValue =
      ArrivalValueService.startValueOf(node, this.prefill()) ??
      (variableName ? answerText(this.prefill()[variableName]) : "");
    /*
     * `data-min` och inte `min`: gränserna gäller fortfarande, men fältet är
     * inte längre `type="number"` och attributen vore döda där. Vår egen
     * kontroll läser dem — se `numberFieldError` — och det var den som gällde
     * ändå, eftersom webbläsarens spärr aldrig hindrade någon från att gå
     * vidare.
     */
    const min = typeof node.data.min === "number" ? `data-min="${node.data.min}"` : "";
    const max = typeof node.data.max === "number" ? `data-max="${node.data.max}"` : "";
    /*
     * `data-step` is gone: nothing read it. `data-min` and `data-max` below are
     * read by `numberFieldError`, so they stay. A step that is written down and
     * never checked is worse than no step at all — the editor's setting looks
     * like it works.
     */
    const step = "";
    const unit = this.localized(node.data.unit);

    return `
      <article class="guide-preview__card" data-node-type="number-question">
        ${this.renderHeadingAndDescription(node)}
        <label class="guide-preview__value-answer">
          <span>${escapeHtml(this.chrome("field.enterNumber"))}</span>
          ${
            /*
             * The unit stands after the field, not inside the label.
             *
             * The label names the thing — "Boendekostnad" — and the unit says how
             * it is measured, which belongs where the eye is while typing rather
             * than in a sentence above it. It used to read "Ange ett tal i
             * kr/mån", so the format was doing the label's job.
             *
             * `aria-describedby` and not `aria-hidden`: moving it out of the
             * label would otherwise take it away from a screen reader
             * altogether, which is a worse field than the one we started with.
             * It is not inside the input, because a suffix in there breaks
             * selection and the value.
             */
            unit
              ? `<span class="guide-preview__unit" id="guide-value-unit">${escapeHtml(unit)}</span>`
              : ""
          }
          <input type="text" inputmode="decimal" data-number-answer data-group data-number-target="${escapeHtml(node.id)}" ${unit ? 'aria-describedby="guide-value-unit"' : ""} value="${escapeHtml(maskGrouped(previousValue, previousValue.length, this.activeLocaleValue).value)}" data-canonical="${escapeHtml(previousValue)}" ${min} ${max} ${step}>
          ${node.data.presentation === "range" || node.data.presentation === "stepper"
            ? this.renderNumberControls({
                id: node.id,
                label: this.localized(node.data.title),
                presentation: node.data.presentation,
                min: typeof node.data.min === "number" ? node.data.min : undefined,
                max: typeof node.data.max === "number" ? node.data.max : undefined,
                step: typeof node.data.step === "number" ? node.data.step : undefined,
                value: previousValue,
              })
            : ""}
          <span class="guide-preview__field-error" data-number-validation id="guide-value-error" role="alert" hidden></span>
        </label>
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /**
   * A date on a step of its own.
   *
   * `data-text-answer`, like every other text answer, because that is what the
   * answer is: an ISO string. The element is a date input so the platform gives
   * its own picker and keyboard, and the bounds go on it so the picker greys out
   * what cannot be chosen — the engine checks them again, since a picker is a
   * courtesy and a pasted value is still an answer.
   */
  private renderDeclarativeDate(node: FlowNodeData): string {
    if (this.hasAttribute("compact")) {
      return `
        <article class="guide-preview__card" data-node-type="date-question">
          ${this.renderHeadingAndDescription(node)}
          ${this.renderRoute(node, "continue", t("port.continue", this.activeLocaleValue))}
        </article>
      `;
    }

    const variableName =
      typeof node.data.variableName === "string" ? node.data.variableName : "";
    // The start value where the visitor has not answered yet (story 118) — the
    // same service the page uses, and the same "idag" the bounds below read.
    const previousValue =
      ArrivalValueService.startValueOf(node, this.prefill()) ??
      (variableName ? answerText(this.prefill()[variableName]) : "");
    // Resolved on render (story 044): "idag" becomes the day the question is
    // asked, so the platform's picker greys out what cannot be chosen.
    const minBound = resolveDateBound(
      typeof node.data.min === "string" ? node.data.min : undefined,
    );
    const maxBound = resolveDateBound(
      typeof node.data.max === "string" ? node.data.max : undefined,
    );
    const min = minBound ? `min="${escapeHtml(minBound)}"` : "";
    const max = maxBound ? `max="${escapeHtml(maxBound)}"` : "";

    return `
      <article class="guide-preview__card" data-node-type="date-question">
        ${this.renderHeadingAndDescription(node)}
        <label class="guide-preview__value-answer">
          <span>${escapeHtml(this.chrome("field.enterDate"))}</span>
          <!--
            Design A (Johans val 31/8, ur tre uppritade): i vila visar fältet
            formatet som spöktext och en kalenderikon. Mätt på hans telefon
            samma kväll: med appearance: none är ett tomt datumfält en tom grå
            platta på iOS — ingenting säger vad som ska in eller att ett tryck
            öppnar en väljare. Spöket är aria-hidden (etiketten säger redan vad
            fältet är) och pekar-genomsläppligt; det släcks när fältet bär ett
            värde, för då är plattformens egen utskrift svaret.
          -->
          <span class="guide-preview__date">
            <input type="date" data-text-answer class="${previousValue === "" ? "guide-preview__date-empty" : ""}" value="${escapeHtml(previousValue)}" ${min} ${max}>
            ${this.dateResting(previousValue)}
          </span>
          <span class="guide-preview__field-error" data-number-validation id="guide-value-error" role="alert" hidden></span>
        </label>
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /**
   * The date field's resting decoration: the format as ghost text and a
   * calendar icon (design A, Johans val 31/8 — see the comment at the step
   * renderer). ONE source for both the step and the page-field variant:
   * Johans iPhone found the page-field path unbuilt the same night, exactly
   * the way the lookup once had three ways in and the suite covered one. Two
   * copies of this markup would be the next drift.
   */
  private dateResting(value: string): string {
    return `
            <span class="guide-preview__date-ghost" data-date-ghost aria-hidden="true" ${value !== "" ? "hidden" : ""}>${escapeHtml(this.chrome("field.dateFormat"))}</span>
            <span class="guide-preview__date-icon" data-date-icon aria-hidden="true"><svg viewBox="0 0 512 512" width="20" height="20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M144 32c13 0 24 11 24 24v24h176V56c0-13 11-24 24-24s24 11 24 24v24h32c35 0 64 29 64 64v32H24v-32c0-35 29-64 64-64h32V56c0-13 11-24 24-24zM24 208h464v208c0 35-29 64-64 64H88c-35 0-64-29-64-64V208zm112 72c-9 0-16 7-16 16v32c0 9 7 16 16 16h32c9 0 16-7 16-16v-32c0-9-7-16-16-16h-32z"/></svg></span>`;
  }

  /**
   * The scale itself (story 115) — ONE piece of markup for both its homes.
   *
   * A rating is a step of its own and a field on a page, and the two must draw
   * the same row: the same touch target, the same tinting, the same way out.
   * The date field learnt that the hard way — its resting decoration existed on
   * the step and not on the page until Johan met the page on his phone — so
   * this is written once and called twice.
   *
   * ## Why radio buttons and a fieldset
   *
   * Because that is what a scale is: one of several, and the group has a name.
   * Real radios give the arrow keys, the group announcement and the *n of m*
   * count for nothing, and a fieldset is how the question gets read before the
   * steps (K4). The number is inside the label with the word, so the reader
   * hears *2, Ganska bra* rather than a word with no place on the scale.
   *
   * ## Why the row is a row
   *
   * The whole point of the field: twenty questions answered without scrolling
   * through each one (story 115). Under 360px it may break into two lines —
   * `flex-wrap` does that on its own — but it never becomes a column, which is
   * what a multiple-choice already is and what this exists instead of.
   */
  private ratingScale(scale: {
    steps: QuestionOption[];
    legend: string;
    name: string;
    /**
     * What is chosen, read as text: a step's number, or a way out's words.
     *
     * The words and not an index, because that is what both homes have. The
     * page holds the answer as text (a way out answers with its label), and the
     * step reads the same text out of the stored pair. It holds unless an
     * editor names a way out "3" on a three-step scale — a way out called by
     * the name of a step.
     */
    chosen: string;
    /** The words on each way out the editor offers, in order. */
    waysOut: string[];
    /** Along a row (the default) or standing on its end. */
    layout: "row" | "column";
    required: boolean;
    /** What each input carries besides its value: how the answer is collected. */
    inputAttributes: string;
    describedBy?: string;
  }): string {
    const required = scale.required ? "required" : "";
    /*
     * Two ways of drawing the same scale, decided by the words (Johan 13/9:
     * "du får nog jobba lite på designen av valen"):
     *
     * - **Words** — every step has a word (*Dåligt … Bäst*): the word sits in
     *   its segment and the number is spoken, not shown. A visible "3" beside
     *   "Ganska bra" made each segment a small form.
     * - **Numbers** — some step has no word (a 1–10 rating): the numbers sit
     *   in the segments, and the words on the first and last step, if any,
     *   anchor the ends under the bar (*Långt ifrån … Precis*).
     *
     * Either way the bar is ONE object — shared borders, rounded ends — and
     * the chosen segment is filled. On a host of 480 px or less the scale
     * stands as a list instead (punkt 16, the stylesheet).
     */
    const wayOutChosen = scale.waysOut.includes(scale.chosen);
    const wordOf = (step: QuestionOption): string => (step.label === step.value ? "" : String(step.label));
    const allWords = scale.steps.every((step) => wordOf(step) !== "");
    const mode = allWords ? "words" : "numbers";
    const count = scale.steps.length;
    const column = scale.layout === "column";
    const steps = scale.steps
      .map((step, index) => {
        const chosen = !wayOutChosen && scale.chosen === step.value;
        const word = allWords ? wordOf(step) : "";
        /*
         * A numbers bar hangs its end words above the bar (`ends` below). A
         * scale standing as a list — on a narrow host (punkt 16) or by the
         * editor's choice — has no ends to hang them from, and lost them: the
         * first and last step carry their own word in the markup, shown only
         * when the scale stands (the stylesheet), so every label survives.
         */
        const endWord = !allWords && (index === 0 || index === count - 1) ? wordOf(step) : "";

        return `
          <label class="guide-preview__rating-step">
            <input type="radio" name="${escapeHtml(scale.name)}" value="${escapeHtml(step.value)}"
              ${scale.inputAttributes} ${chosen ? "checked" : ""} ${required}>
            <span class="guide-preview__rating-mark">
              <span class="guide-preview__rating-number">${escapeHtml(step.value)}</span>
              ${word ? `<span class="guide-preview__rating-word">${escapeHtml(word)}</span>` : ""}
              ${endWord ? `<span class="guide-preview__rating-word guide-preview__rating-end-word">${escapeHtml(endWord)}</span>` : ""}
            </span>
          </label>
        `;
      })
      .join("");
    const first = scale.steps[0];
    const last = scale.steps[count - 1];
    /*
     * The end words anchor a bar of numbers. Standing on its end the scale has
     * no ends to anchor — every step shows its own word on its own line — so
     * they would be the same words said twice.
     */
    const ends =
      !column && !allWords && first && last && (wordOf(first) || wordOf(last))
        ? `
        <div class="guide-preview__rating-ends" aria-hidden="true">
          <span>${escapeHtml(wordOf(first))}</span>
          <span>${escapeHtml(wordOf(last))}</span>
        </div>`
        : "";

    /*
     * The ways out: under the bar, in plain sight, one row each and in the
     * order they were asked for — the question first (*Inte aktuellt*), the
     * person second (*Vet ej*). The survey this story came from hid both
     * behind a "…", and a way out nobody finds is not a way out.
     *
     * In the SAME radio group as the steps, because that is what they are:
     * other answers to the one question, and the arrow keys should walk from
     * the last step onto them. Their value is empty on purpose — the answer
     * carries the words, and the empty value is what keeps it out of an
     * average.
     */
    const waysOut = scale.waysOut
      .map(
        (words) => `
        <label class="guide-preview__rating-na"${scale.chosen === words ? " data-chosen" : ""}>
          <input type="radio" name="${escapeHtml(scale.name)}" value=""
            data-rating-out data-rating-out-label="${escapeHtml(words)}"
            ${scale.inputAttributes} ${scale.chosen === words ? "checked" : ""} ${required}>
          <span>${escapeHtml(words)}</span>
        </label>
      `,
      )
      .join("");

    return `
      <fieldset class="guide-preview__rating"${scale.describedBy ? ` aria-describedby="${escapeHtml(scale.describedBy)}"` : ""}>
        <legend>${scale.legend}</legend>
        ${ends}
        <div class="guide-preview__rating-row" data-mode="${mode}"${column ? ' data-layout="column"' : ""}
          style="--rating-steps:${count}">${steps}</div>
        ${waysOut}
      </fieldset>
    `;
  }

  /**
   * A rating on a step of its own.
   *
   * The answer is read off the checked radio (`data-rating-answer`), not
   * through the generic `[data-text-answer]` hook: that one reads the FIRST
   * matching element's value, which for a group of radios is step one whether
   * or not anybody pressed it.
   */
  private renderDeclarativeRating(node: FlowNodeData): string {
    if (this.hasAttribute("compact")) {
      return `
        <article class="guide-preview__card" data-node-type="rating-question">
          ${this.renderHeadingAndDescription(node)}
          ${this.renderRoute(node, "continue", t("port.continue", this.activeLocaleValue))}
        </article>
      `;
    }

    const variableName =
      typeof node.data.variableName === "string" ? node.data.variableName : "";
    const stored = variableName ? this.prefill()[variableName] : undefined;

    return `
      <article class="guide-preview__card${this.nodeCssClasses(node)}" data-node-type="rating-question">
        ${this.renderHeadingAndDescription(node)}
        ${this.ratingScale({
          steps: RatingScaleService.steps(node, this.activeLocaleValue, getSourceLocale(this.guideGraph())),
          legend: escapeHtml(this.chrome("field.chooseOption")),
          name: "guide-preview-rating",
          chosen: answerText(stored),
          waysOut: RatingScaleService.waysOut(node, this.activeLocaleValue, getSourceLocale(this.guideGraph())),
          layout: RatingScaleService.layout(node),
          required: node.data.required === true,
          inputAttributes: "data-rating-answer",
          describedBy: this.localized(node.data.description) ? `guide-desc-${node.id}` : undefined,
        })}
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /**
   * Story 046: the map question. The guide never draws geography — a host's
   * registered provider (docs/KART-KONTRAKT.md) does the pointing, and this
   * field holds the two variables: the label a person reads and can edit, and
   * `{variableName}Geo` with the GeoJSON a system consumes. Without a
   * provider — or for a kind the provider lacks — only the pointer-free floor
   * shows, with a plain statement: the field is never broken, the map is a
   * convenience on top.
   */
  private renderDeclarativeMap(node: FlowNodeData): string {
    if (this.hasAttribute("compact")) {
      return `
        <article class="guide-preview__card" data-node-type="map-question">
          ${this.renderHeadingAndDescription(node)}
          ${this.renderRoute(node, "continue", t("port.continue", this.activeLocaleValue))}
        </article>
      `;
    }

    const variableName =
      typeof node.data.variableName === "string" ? node.data.variableName : "";
    const answers = this.prefill();
    const previousLabel = variableName ? answerText(answers[variableName]) : "";
    const previousGeo = variableName ? answerText(readPath(answers, `${variableName}.geo`)) : "";
    const kind = typeof node.data.kind === "string" ? node.data.kind : "point";
    const provider = getMapProvider();
    const canPick = provider?.kinds.includes(kind as MapKind) ?? false;
    const hasStill = canPick && typeof provider?.snapshot === "function";

    /*
     * The run's own map, and its own button (story 065's follow-up).
     *
     * The drawn map goes in the SAME slot a host's snapshot would — the field
     * has one picture, and a run does not get a second one below the real one.
     * A host that draws its own therefore keeps it: the editor can point for
     * real, and pointing replaces the stand-in through the ordinary path.
     */
    const proving = this.hasAttribute("proving");
    /** The run draws its own map only where a host has none of its own. */
    const provingMap = proving && !hasStill;

    return `
      <article class="guide-preview__card" data-node-type="map-question">
        ${this.renderHeadingAndDescription(node)}
        ${hasStill ? `<img class="guide-preview__map-still" data-map-still alt="">` : ""}
        ${
          provingMap
            ? `<img class="guide-preview__map-still" data-proving-map-still src="${escapeHtml(PROVING_MAP_PICTURE)}" alt="">`
            : ""
        }
        ${
          canPick
            ? `<button type="button" class="guide-preview__map-pick" data-map-pick data-map-kind="${escapeHtml(kind)}">${escapeHtml(this.chrome(previousGeo ? "map.change" : "map.pick"))}</button>`
            /*
             * "Kartval är inte inkopplat här" is true and unsayable under a
             * picture of a map — the run has just drawn one. It goes while the
             * drawn map is up; the floor itself stays, so writing the place in
             * words is still there for whoever prefers it.
             */
            : provingMap
              ? ""
              : `<p class="guide-preview__map-note">${escapeHtml(this.chrome("map.notConnected"))}</p>`
        }
        ${
          proving
            ? `<button type="button" class="guide-preview__proving-button" data-proving-place>${escapeHtml(
                this.editorText("editor.proving.addPlace"),
              )}</button>
              <p class="guide-preview__proving-note" data-proving-note>${escapeHtml(
                this.editorText("editor.proving.standIn"),
              )}</p>`
            : ""
        }
        <label class="guide-preview__value-answer">
          <span>${escapeHtml(this.chrome("map.floorLabel"))}</span>
          <input type="text" data-text-answer data-map-label value="${escapeHtml(previousLabel)}" data-geo="${escapeHtml(previousGeo)}">
          <span class="guide-preview__field-error" data-text-validation id="guide-value-error" role="alert" hidden></span>
        </label>
        <p class="guide-preview__map-status" role="status" data-map-status></p>
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /**
   * A file question on a step of its own.
   *
   * It rendered nothing before — the dispatch fell through to the plain
   * information card, so a standalone attach step showed a heading and a
   * Next button and no way to attach. Found while building story 047. The
   * field is the same markup a page member gets, so marking, validation
   * and the held file all behave identically in both homes.
   */
  private renderDeclarativeFile(node: FlowNodeData): string {
    if (this.hasAttribute("compact")) {
      return `
        <article class="guide-preview__card" data-node-type="${escapeHtml(node.type)}">
          ${this.renderHeadingAndDescription(node)}
          ${this.renderRoute(node, "continue", t("port.continue", this.activeLocaleValue))}
        </article>
      `;
    }

    const graph = this.guideGraph();
    const field = PageFieldsService.fieldOf(
      node,
      this.activeLocaleValue,
      graph ? getSourceLocale(graph) : undefined,
    );
    const value = this.prefill()[field.variableName] ?? "";

    return `
      <article class="guide-preview__card" data-node-type="${escapeHtml(node.type)}">
        ${this.renderHeadingAndDescription(node)}
        ${this.renderPageField(field, answerText(value), true)}
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /**
   * The run's place button — story 065's follow-up.
   *
   * Beside the provider's own button rather than instead of it: a host with a
   * map lets the editor point for real, and pointing overwrites this the
   * ordinary way. It writes into the field's own input and sends the same
   * `input` event a keystroke sends, because that is what turns "Nästa" back
   * on — a second way to enable it would be the two-copies mistake as
   * behaviour.
   */
  private wireProvingPlace(): void {
    const button = this.root.querySelector<HTMLButtonElement>("[data-proving-place]");
    const input = this.root.querySelector<HTMLInputElement>("input[data-map-label]");

    if (!button || !input) {
      return;
    }

    const status = this.root.querySelector<HTMLElement>("[data-map-status]");

    button.addEventListener("click", () => {
      const label = this.editorText("editor.proving.place");

      input.value = label;
      input.dataset.geo = PROVING_PLACE_GEOMETRY;
      input.dispatchEvent(new Event("input", { bubbles: true }));

      if (status) {
        status.textContent = this.chrome("map.chosen", { label });
      }
    });
  }

  /** Kopplar kartknappen till leverantören — körs efter varje rendering. */
  private wireMapQuestion(): void {
    const button = this.root.querySelector<HTMLButtonElement>("[data-map-pick]");

    if (!button) {
      return;
    }

    const input = this.root.querySelector<HTMLInputElement>("input[data-map-label]");
    const still = this.root.querySelector<HTMLImageElement>("[data-map-still]");
    const status = this.root.querySelector<HTMLElement>("[data-map-status]");
    const provider = getMapProvider();
    const kind = (button.dataset.mapKind ?? "point") as MapKind;

    if (!provider || !input) {
      return;
    }

    /*
     * Redaktörens startvy, som en frivillig ledtråd till leverantören —
     * lagrad på noden som GeoJSON med etikett, satt i panelens
     * map-start-kontroll. Trasig JSON behandlas som ingen vy alls.
     */
    let near: [number, number] | undefined;
    let nearZoom: number | undefined;

    try {
      const startView = this.engine?.getCurrentNode()?.data.startView;
      const parsed = typeof startView === "string" && startView ? JSON.parse(startView) : null;
      const coordinates = parsed?.geometry?.coordinates;

      near = Array.isArray(coordinates) ? (coordinates as [number, number]) : undefined;
      nearZoom = typeof parsed?.zoom === "number" ? parsed.zoom : undefined;
    } catch {
      near = undefined;
      nearZoom = undefined;
    }

    // Förbilden: leverantörens utgångsvy, eller det redan valda inritat.
    if (still && provider.snapshot) {
      const existing = input.dataset.geo;
      const geometry = existing ? (JSON.parse(existing) as { type: string; coordinates: unknown }) : null;

      void provider.snapshot(geometry, { near, zoom: nearZoom }).then((src) => {
        still.src = src;
        still.alt = geometry ? input.value : "";
      });
    }

    button.addEventListener("click", async () => {
      // Det redan valda följer med in — dialogen öppnar för justering.
      let current: { type: string; coordinates: unknown } | undefined;

      try {
        current = input.dataset.geo ? JSON.parse(input.dataset.geo) : undefined;
      } catch {
        current = undefined;
      }

      const raw = await provider.pick({ kind, near, zoom: nearZoom, current });
      // Kontraktets avvisningsregler: hellre inget än fel geografi.
      const result = acceptPickResult(raw, kind);

      if (!result) {
        return;
      }

      /*
       * Utan etikett: koordinater, läsbart men fattigt — kontraktet säger
       * varför. En representativ punkt per sort: punkten själv, första av
       * flera, områdets första hörn. Formerna är redan garanterade av
       * acceptPickResult ovan.
       */
      const coords = result.geometry.coordinates;
      const pair = (
        kind === "point"
          ? coords
          : kind === "points"
            ? (coords as number[][])[0]
            : (coords as number[][][])[0][0]
      ) as [number, number];
      const label = result.label || `${pair[1].toFixed(5)}, ${pair[0].toFixed(5)}`;

      input.value = label;
      input.dataset.geo = JSON.stringify(result.geometry);
      // Same event a keystroke sends: the listener that enables "Nästa" on
      // typing is the one that enables it here. A second mechanism would be
      // the two-copies mistake as behavior.
      input.dispatchEvent(new Event("input", { bubbles: true }));
      button.textContent = this.chrome("map.change");

      if (status) {
        status.textContent = this.chrome("map.chosen", { label });
      }

      if (still && provider.snapshot) {
        still.src = await provider.snapshot(result.geometry);
        still.alt = label;
      }
    });
  }

  /**
   * A consent on a step of its own.
   *
   * Rare — a consent almost always sits on a page with what it is consenting
   * about — but a step is a step, and a node type that renders nothing on one
   * would be a hole somebody finds by falling into it.
   */
  private renderDeclarativeConsent(node: FlowNodeData): string {
    const variableName =
      typeof node.data.variableName === "string" ? node.data.variableName : "";
    const ticked =
      (variableName ? (this.prefill()[variableName] ?? "") : "") === "true";

    return `
      <article class="guide-preview__card" data-node-type="consent-question">
        <label class="guide-preview__value-answer guide-preview__page-field--consent">
          <input type="checkbox" data-text-answer data-consent value="true" ${ticked ? "checked" : ""}>
          <span>${this.renderHeadingAndDescription(node)}</span>
        </label>
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /** Bildnod: en bild med valfri rubrik/bildtext, ett steg framåt (bildspel). */
  /**
   * Granskningssteget (story 049): svaren samlade, varje rad med en väg
   * tillbaka, och datadeklarationen genererad ur det som faktiskt samlats
   * in. Innehållet kommer ur motorns svarsposter — ingen redaktör bygger
   * sammanfattningen för hand, och frågor på vägar besökaren inte tagit
   * finns inte i posterna och kan därför inte läcka in.
   */
  /**
   * The review (story 049), read per page since story 089.
   *
   * A record is one field, and the rows were one per record — so a page with
   * three fields gave three *Change* links that all opened the same page, and
   * the page's own title was nowhere. Johan asked why, on a repeating page,
   * none of the five links said "this is where you add another child".
   *
   * So a page with more than one field, or one that repeats, is a group: the
   * page's title, one *Change*, and its fields as rows. A repeating page's
   * rows are its records — *Barn 1: Namn: Alva, …* — read by the same
   * function that writes `{{barn}}`, so the two never disagree. A standalone
   * question keeps its row and its own link: there the precision is real. A
   * page with one field shows as a row too — a group of one is only indent.
   *
   * Consecutive records share a page because a page is answered in one go;
   * grouping by neighbour is enough and keeps the visitor's order.
   */
  private renderReview(node: FlowNodeData): string {
    const graph = this.guideGraph();
    const answers = this.engine?.getAnswers() ?? {};
    const records = (this.engine?.getAnswerRecords() ?? []).filter(
      (record) => record.optionLabel !== "" || !isAnswerEmpty(record.value),
    );

    type Block = { id: string; records: GuideAnswerRecord[]; page: FlowNodeData | null };
    const blocks: Block[] = [];
    records.forEach((record) => {
      const last = blocks[blocks.length - 1];
      if (last && last.id === record.questionId) {
        last.records.push(record);
        return;
      }
      const page = graph?.nodes.find((candidate) => candidate.id === record.questionId && candidate.type === "page") ?? null;
      blocks.push({ id: record.questionId, records: [record], page });
    });

    const repeatOf = (page: FlowNodeData | null) =>
      page && graph ? PageRepeatService.get(page, this.activeLocaleValue, getSourceLocale(graph)) : null;
    const grouped = (block: Block) => block.page !== null && (block.records.length > 1 || repeatOf(block.page) !== null);

    const row = (term: string, answer: string, edit: string) => `
      <div class="guide-preview__review-row" data-review-row>
        <dt>${escapeHtml(term)}</dt>
        <dd>${escapeHtml(answer)}</dd>
        ${edit}
      </div>
    `;
    const editButton = (questionId: string, label: string) => `
      <button type="button" data-review-edit data-review-question="${escapeHtml(questionId)}"
        aria-label="${escapeHtml(label)}">
        ${escapeHtml(this.chrome("review.change"))}
      </button>
    `;
    const shown = (record: GuideAnswerRecord) => this.displayAnswer(record);

    /* Lösa rader i följd delar en `dl`; en grupp är en `section` med egen `dl`. */
    const parts: string[] = [];
    const titles: string[] = [];
    let loose: string[] = [];
    const flush = () => {
      if (loose.length > 0) parts.push(`<dl class="guide-preview__review-list">${loose.join("")}</dl>`);
      loose = [];
    };

    blocks.forEach((block, index) => {
      if (!grouped(block)) {
        block.records.forEach((record) => {
          titles.push(record.questionTitle);
          loose.push(row(record.questionTitle, shown(record), editButton(record.questionId, this.chrome("review.changeAria", { q: record.questionTitle }))));
        });
        return;
      }

      flush();
      const page = block.page!;
      const title = this.localized(page.data.title);
      const repeat = repeatOf(page);
      /*
       * A repeated page's records as groups in the receipt's form (Astra 1/10,
       * bilaga 10 punkt 18; Johan's yes the same day, story 089 criterion 3
       * rewritten): *Pass 1* as a heading, each question with its answer on
       * a row of its own — no "Vilket pass?: Dag 1, Vill du …?: Ja" on one
       * line, no colon after a question mark. Numbers and dates as in
       * punkt 17. The page keeps its one *Ändra* (criterion 2).
       */
      const body = repeat
        ? PageRepeatService.records(graph!, page, answers[repeat.variable], answers, this.activeLocaleValue)
            .map(({ heading, pairs }) => `
              <div class="guide-preview__review-record" data-review-record>
                <h4>${escapeHtml(heading)}</h4>
                <dl class="guide-preview__review-list">${pairs
                  .map(({ field, value, label }) => {
                    const node = graph!.nodes.find((candidate) => candidate.id === nodeIdOf(field.id));
                    return row(field.label, (node ? this.formatAnswer(node, answerText(value)) : null) ?? label, "");
                  })
                  .join("")}</dl>
              </div>`)
            .join("")
        : `<dl class="guide-preview__review-list">${block.records.map((record) => row(record.questionTitle, shown(record), "")).join("")}</dl>`;

      titles.push(title);
      parts.push(`
        <section class="guide-preview__review-group" data-review-group aria-labelledby="review-group-${index}">
          <div class="guide-preview__review-group-head">
            <h3 id="review-group-${index}">${escapeHtml(title)}</h3>
            ${editButton(page.id, this.chrome("review.changePageAria", { q: title }))}
          </div>
          ${body}
        </section>
      `);
    });
    flush();

    /*
     * Rubriken säger sanningen om vad som händer sen: finns ett
     * e-postresultat i grafen skickas svaren; annars byggde de bara
     * beskedet. (Inlämningskontraktet i story 050 vässar det här vidare.)
     */
    const sends = this.guideGraph()?.nodes.some(
      (candidate) => getStepRenderer(candidate.type)?.sends === true,
    );
    const declarationTitle = this.chrome(sends ? "review.declarationSend" : "review.declarationBasis");
    const note = this.localized((node.data as { declarationNote?: unknown }).declarationNote as never);
    const declared = titles.map((title) => `<li>${escapeHtml(title)}</li>`);

    return `
      <article class="guide-preview__card" data-node-type="review">
        ${this.renderHeadingAndDescription(node)}
        <div class="guide-preview__review">${parts.join("")}</div>
        ${
          this.reviewDeclarationEnabledValue
            ? `<div class="guide-preview__review-declaration" data-review-declaration>
          <h3>${escapeHtml(declarationTitle)}</h3>
          <ul>${declared.join("")}</ul>
          ${note ? `<p>${escapeHtml(note)}</p>` : ""}
        </div>`
            : ""
        }
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /**
   * An answer as the review and the receipt show it (Astra 1/10, bilaga 10
   * punkt 17): *"Formatera efter språk och fältets betydelse: exempelvis
   * '48 000 kr' och '20 september 2026'. Lägg bara till valuta när fältet
   * faktiskt har valuta angiven. Lagringsvärdena ändras inte."*
   *
   * They showed the stored form — *48000*, *2026-09-20* (genomgången 30/9,
   * V18) — which is the right thing to store and send, and not what the
   * visitor wrote or would read. Only the showing changes: the record, the
   * answer and everything a host receives keep the canonical value.
   *
   * The field's meaning comes from its node — a number question, a date
   * question — found by the record's own id, or on a page by the field's
   * variable under the page. The unit is the field's own (*kr*, *år*), never
   * guessed: a number without one is a number. Grouping and the month's name
   * come from `Intl` in the viewer's language, so *48,000* in English.
   */
  private displayAnswer(record: GuideAnswerRecord): string {
    const raw = answerText(record.value);
    const node = this.answerNode(record);

    return (node ? this.formatAnswer(node, raw) : null) ?? (record.optionLabel || raw);
  }

  /**
   * The question node a record answers: its own id for a question on a step
   * of its own, and on a page the field under the page with the record's
   * variable — for a repeated page's record the part after `passen[1].`.
   */
  private answerNode(record: GuideAnswerRecord): FlowNodeData | undefined {
    const variable = (record.variableName ?? "").replace(/^.*\[\d+\]\./, "");
    return this.guideGraph()?.nodes.find(
      (candidate) =>
        (candidate.id === record.questionId && candidate.type !== "page") ||
        (candidate.parentPageId === record.questionId && candidate.data.variableName === variable),
    );
  }

  /**
   * *Det här skickades* on the receipt (Astra 1/10, bilaga 10 punkt 18).
   *
   * Each question with its answer under it, and a repeated page's records as
   * groups headed *Pass 1*, *Pass 2* — the record's word and number from
   * `repeat.legend`, as the page's own legend says it. It was one line per
   * field, *Pass 1 — Vilket pass?: Dag 1 · 11.00 …*: the record's name glued
   * to every question, and a colon after the question mark (genomgången
   * 30/9, V17, V19: *"Frågan får behålla sitt frågetecken; lägg inte ett
   * kolon efter det."*).
   *
   * Still the receipt's own quiet list, not the review's `dl` with its
   * *Ändra* buttons (story 144, criterion 3). The review's repeated rows are
   * story 089's *"en rad per post"* (criterion 3) and stay until that is
   * decided — an open question, not built here.
   */
  private renderSentAnswers(): string {
    const graph = this.guideGraph();
    const item = (question: string, answer: string) => `
      <li>
        <span class="guide-preview__submit-question">${escapeHtml(question)}</span>
        <span class="guide-preview__submit-answer">${escapeHtml(answer)}</span>
      </li>`;
    const parts: string[] = [];
    let group: { key: string; heading: string; items: string[] } | null = null;
    const close = () => {
      if (group) {
        parts.push(`
      <li class="guide-preview__submit-group">
        <h4>${escapeHtml(group.heading)}</h4>
        <ul>${group.items.join("")}</ul>
      </li>`);
      }
      group = null;
    };

    (this.engine?.getAnswerRecords() ?? [])
      .filter((record) => record.optionLabel !== "" || record.value !== "")
      .forEach((record) => {
        const index = /\[(\d+)\]\./.exec(record.variableName ?? "");
        const page = index ? graph?.nodes.find((candidate) => candidate.id === record.questionId) : undefined;
        const repeat = page && graph ? PageRepeatService.get(page, this.activeLocaleValue, getSourceLocale(graph)) : null;

        if (!index || !repeat) {
          close();
          parts.push(item(record.questionTitle, this.displayAnswer(record)));
          return;
        }

        const key = `${record.questionId}#${index[1]}`;
        if (group?.key !== key) {
          close();
          group = {
            key,
            heading: this.chrome("repeat.legend", { word: PageRepeatService.heading(repeat.word), n: Number(index[1]) + 1 }),
            items: [],
          };
        }
        const node = this.answerNode(record);
        const question = node ? this.localized(node.data.title, record.questionTitle) : record.questionTitle;
        group!.items.push(item(question, this.displayAnswer(record)));
      });
    close();

    return parts.join("");
  }

  /** A number or a date in the viewer's language, or `null` when the node is neither or the value is not one. */
  private formatAnswer(node: FlowNodeData, raw: string): string | null {
    const locale = this.activeLocaleValue;

    if (node.type === "number-question") {
      const number = raw.trim() === "" ? NaN : Number(raw);
      if (!Number.isFinite(number)) return null;
      const unit = this.localized(node.data.unit).trim();
      const shown = new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(number);
      // Hard space: *48 000* and *kr* broken over two lines read as two facts.
      return unit ? `${shown}\u00a0${unit}` : shown;
    }

    if (node.type === "date-question") {
      const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
      if (!day) return null;
      // Noon UTC and read in UTC: the date the visitor picked, in every time zone.
      const date = new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12));
      return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
    }

    return null;
  }

  private guideStartedAt = Date.now();

  private renderImage(node: FlowNodeData): string {
    const src =
      typeof node.data.imageUrl === "string" ? node.data.imageUrl.trim() : "";
    const alt = this.localized(node.data.alt);
    const caption = this.localized(node.data.caption);
    const title = this.localized(node.data.title);
    const heading = title ? `<h2 tabindex="-1">${escapeHtml(title)}</h2>` : "";
    const captionMarkup = caption
      ? `<p class="guide-preview__caption">${escapeHtml(caption)}</p>`
      : "";
    const image = src
      ? `<img class="guide-preview__image" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`
      : "";

    if (this.hasAttribute("compact")) {
      return `
        <article class="guide-preview__card" data-node-type="image">
          ${heading}
          ${captionMarkup}
          ${this.renderRoute(node, "continue", t("port.continue", this.activeLocaleValue))}
        </article>
      `;
    }

    return `
      <article class="guide-preview__card" data-node-type="image">
        ${heading}
        ${
          image ||
          `<p class="guide-preview__image-empty">${escapeHtml(this.chrome("image.none"))}</p>`
        }
        ${captionMarkup}
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  /**
   * Annotated image: an image with comments (arrow plus text) at saved
   * positions, stepped through one at a time. Screen readers get the current
   * comment via an aria-live region ("Kommentar X/Y: …").
   */
  private renderAnnotatedImage(node: FlowNodeData): string {
    const src =
      typeof node.data.imageUrl === "string" ? node.data.imageUrl.trim() : "";
    const alt = this.localized(node.data.alt);
    const title = this.localized(node.data.title);
    const heading = title ? `<h2 tabindex="-1">${escapeHtml(title)}</h2>` : "";
    const comments = AnnotationCommentsService.parse(node.data.comments);
    const total = comments.length;
    const step = Math.min(this.annotationStep, Math.max(0, total - 1));
    const current = comments[step];

    if (this.hasAttribute("compact")) {
      return `
        <article class="guide-preview__card" data-node-type="annotated-image">
          ${heading}
          ${this.renderRoute(node, "continue", t("port.continue", this.activeLocaleValue))}
        </article>
      `;
    }

    const pins = comments
      .map(
        (comment, index) => `
          <span
            class="guide-preview__pin${index === step ? " guide-preview__pin--current" : ""}"
            style="left:${comment.x}%;top:${comment.y}%"
            aria-hidden="true"
          >${index + 1}</span>
        `
      )
      .join("");

    const bubble = current
      ? `
        <div
          class="guide-preview__annotation guide-preview__annotation--${current.arrow}"
          style="left:${current.x}%;top:${current.y}%"
          aria-hidden="true"
        >${escapeHtml(this.localized(current.text))}</div>
      `
      : "";

    const image = src
      ? `<img class="guide-preview__annotated-img" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`
      : `<p class="guide-preview__image-empty">${escapeHtml(this.chrome("image.none"))}</p>`;

    const caption = current
      ? `<p class="guide-preview__annotation-caption" role="status" aria-live="polite"><strong>${escapeHtml(
          this.chrome("image.commentCounter", { current: step + 1, total })
        )}</strong> ${escapeHtml(this.localized(current.text))}</p>`
      : "";

    const canBack = step > 0 || (this.engine?.canGoBack() ?? false);

    return `
      <article class="guide-preview__card" data-node-type="annotated-image">
        ${heading}
        <div class="guide-preview__annotated">
          ${image}
          ${pins}
          ${bubble}
        </div>
        ${caption}
        ${this.hasAttribute("no-navigation") ? "" : `
        <div class="guide-preview__navigation">
          <button type="button" data-action="previous" ${canBack ? "" : "disabled"}>
            ${escapeHtml(this.chrome("nav.previous"))}
          </button>
          <button type="button" data-action="next">
            ${escapeHtml(this.continueLabel())}
          </button>
        </div>`}
      </article>
    `;
  }

  /** Code node: a snippet with an optional language label and heading, one step forward. */
  private renderCode(node: FlowNodeData): string {
    const code = typeof node.data.code === "string" ? node.data.code : "";
    const language =
      typeof node.data.language === "string" ? node.data.language.trim() : "";
    const caption = this.localized(node.data.caption);
    const title = this.localized(node.data.title);
    const heading = title ? `<h2 tabindex="-1">${escapeHtml(title)}</h2>` : "";
    const captionMarkup = caption
      ? `<p class="guide-preview__caption">${escapeHtml(caption)}</p>`
      : "";

    if (this.hasAttribute("compact")) {
      return `
        <article class="guide-preview__card" data-node-type="code">
          ${heading}
          ${this.renderRoute(node, "continue", t("port.continue", this.activeLocaleValue))}
        </article>
      `;
    }

    return `
      <article class="guide-preview__card" data-node-type="code">
        ${heading}
        <pre class="guide-preview__code"${language ? ` data-language="${escapeHtml(language)}"` : ""}><code>${escapeHtml(code)}</code></pre>
        ${captionMarkup}
        ${this.renderNavigation(true)}
      </article>
    `;
  }

  private renderRoute(
    question: FlowNodeData,
    optionId: string,
    optionLabel: string
  ): string {
    // The generic forward port needs no "Fortsätt" heading — only where it
    // leads. Branching questions' options show their label as before.
    const heading =
      optionId === "continue"
        ? ""
        : `<strong>${escapeHtml(optionLabel)}</strong>`;

    if (!this.routeAnalysisEnabledValue) {
      return heading ? `<div class="guide-preview__route">${heading}</div>` : "";
    }

    const graph = this.guideGraph();

    if (!graph) {
      return "";
    }

    const route = analyzeGuideRoute(graph, question.id, optionId);

    if (route.issue) {
      return `
        <div class="guide-preview__route guide-preview__route--warning">
          ${heading}
          <span>⚠ ${escapeHtml(this.chrome("canvas.route.deadEnd"))}</span>
        </div>
      `;
    }

    const targetTitle = this.getNodeTitle(route.directTarget);

    return `
      <div class="guide-preview__route">
        ${heading}
        <span>${escapeHtml(this.chrome("canvas.route.leadsTo", { title: targetTitle }))}</span>
        ${route.hasDeadEnd ? `<span>⚠ ${escapeHtml(this.chrome("canvas.route.someDeadEnd"))}</span>` : ""}
        ${route.hasCycle ? `<span>⚠ ${escapeHtml(this.chrome("canvas.route.hasLoop"))}</span>` : ""}
      </div>
    `;
  }

  private getNodeTitle(node: FlowNodeData | null): string {
    return node ? this.localized(node.data.title, this.chrome("step.untitled")) : this.chrome("step.untitled");
  }

  /**
   * `drawnAs` is the card's `data-node-type`: the node's own type when an
   * ending without a renderer is drawn as a result (story 147, criterion 6),
   * so a host's styles and tests still find the node they built.
   */
  private renderResult(node: FlowNodeData, drawnAs = "result"): string {
    return `
      <article class="guide-preview__card" data-node-type="${escapeHtml(drawnAs)}">
        ${this.renderHeadingAndDescription(node)}
        ${
          this.hasAttribute("compact")
            ? this.renderResultPaths(node)
            : this.renderNavigation(false)
        }
      </article>
    `;
  }

  private renderResultPaths(node: FlowNodeData): string {
    if (!this.routeAnalysisEnabledValue) {
      return "";
    }

    const graph = this.guideGraph();

    if (!graph) {
      return "";
    }

    const analysis = findGuidePathsToResult(graph, node.id);

    if (analysis.paths.length === 0) {
      return `
        <div class="guide-preview__result-paths">
          <h3>${escapeHtml(this.chrome("canvas.paths.title"))}</h3>
          <p class="guide-preview__path-warning">⚠ ${escapeHtml(this.chrome("canvas.paths.unreachable"))}</p>
        </div>
      `;
    }

    const count = analysis.paths.length;
    const prefix = analysis.truncated ? this.chrome("canvas.paths.atLeastPrefix") : "";
    const summary = `${prefix}${this.chrome(count === 1 ? "canvas.paths.summaryOne" : "canvas.paths.summaryMany", { count })}`;

    return `
      <div class="guide-preview__result-paths">
        <details class="guide-preview__paths">
          <summary>${escapeHtml(summary)}</summary>
          <ol>
            ${analysis.paths
              .map(
                (path) => `
                <li>
                  ${path
                    .map(
                      (step) => `
                        <span>
                          ${escapeHtml(step.questionTitle)}:
                          <strong>${escapeHtml(step.optionLabel)}</strong>
                        </span>
                      `
                    )
                    .join('<span class="guide-preview__path-arrow" aria-hidden="true">→</span>')}
                </li>
              `
              )
              .join("")}
          </ol>
          ${analysis.truncated ? `<p>${escapeHtml(this.chrome("canvas.paths.more"))}</p>` : ""}
        </details>
        ${analysis.hasCycle ? `<p class="guide-preview__path-warning">⚠ ${escapeHtml(this.chrome("canvas.paths.guideLoop"))}</p>` : ""}
      </div>
    `;
  }

  /**
   * The row of Previous / Next under a step.
   *
   * Not drawn at all when `no-navigation` is set. Disabling the buttons was the
   * obvious alternative and is worse: a greyed-out Next is something a VISITOR
   * sees when a required answer is missing, so a still would have looked like a
   * step with a fault. Nothing there is unmistakably the editor holding the
   * picture still — and the dialog says so in its own words, in its own text,
   * rather than the viewer explaining an editor button it should know nothing
   * about.
   *
   * Leaving the buttons in place but unwired was never on: a button that
   * swallows a click is a bug report waiting to be written.
   */
  private renderNavigation(showNext: boolean): string {
    if (this.hasAttribute("no-navigation")) return "";

    /*
     * No *Föregående* where there is nowhere to go back to (Astra 1/10,
     * bilaga 10 punkt 10: *"dölj på första steget"*). It was drawn disabled,
     * a grey button at 2.46 : 1 on every first step that offered nothing —
     * allowed by 1.4.3, which exempts what is inactive, but still a second
     * thing to read beside the one that does something (genomgången 30/9,
     * V15). *Nästa* keeps its place at the end of the row (the stylesheet).
     */
    const previous = this.engine?.canGoBack()
      ? `<button
          type="button"
          data-action="previous"
        >
          ${escapeHtml(this.chrome("nav.previous"))}
        </button>`
      : "";

    return `
      <div class="guide-preview__navigation">
        ${previous}
        ${showNext ? `
          <button
            type="button"
            data-action="next"
          >
            ${escapeHtml(this.continueLabel())}
          </button>
        ` : `
          <button type="button" data-action="restart">${escapeHtml(this.chrome("nav.restart"))}</button>
        `}
      </div>
    `;
  }

  private renderHeadingAndDescription(
    node: FlowNodeData,
    standIn?: { title: string; holdRoom?: boolean },
  ): string {
    const title = this.localized(node.data.title, this.chrome("step.untitled"));
    // A sending that waits or failed says so in its own words (see
    // `renderSubmitResult`): the editor's title and description are the
    // receipt's, and thank.
    const description = standIn ? "" : this.localized(node.data.description);
    /*
     * While it waits, the editor's title stays in the heading's cell, hidden,
     * so the heading is as tall as the one the receipt will bring and the
     * list under it stands still when it comes (story 144, criterion 4) —
     * the same hidden-copy idea as the stand-in for the reply.
     */
    const heading = !standIn
      ? this.formatTitle(node, title)
      : standIn.holdRoom
        ? `<span class="guide-preview__heading-stack"><span>${escapeHtml(standIn.title)}</span><span class="guide-preview__heading-ghost" aria-hidden="true">${this.formatTitle(node, title)}</span></span>`
        : escapeHtml(standIn.title);
    // Link the heading to the description so the screen reader announces both
    // when focus lands on the heading after navigating — a computed amount, say,
    // which otherwise appears only in the description text.
    const descId = `guide-desc-${node.id}`;

    /*
     * The card's head, in two rows when the guide asked for the meter: the
     * rail across the full width, then the step mark with the share at the
     * right-hand end of it (story 116, *Formen*). The step mark is never taken
     * away — it says *where*, the rail says *how far*, and they only competed
     * while they shared a row.
     *
     * A result page keeps its *Resultat* in the step mark's slot and gets no
     * rail: it says what the page **is** (criterion 6). The same silence
     * covers a guide with fewer than two counted steps (criterion 7), so the
     * head then looks exactly as it does today rather than going half-empty.
     *
     * `showStepIndicator` is the viewer's own question and sits outside the
     * editor's choice: whether a head belongs at all in the shape this
     * component is running in — a mirror of a run on the canvas, where the line
     * above the canvas already says the step, or a still of a single node.
     *
     * No visible heading on the rail: the words carry the accessible name
     * instead (criterion 8). A heading pushed the row wider on 390 px until the
     * bar was narrower than the text describing it.
     *
     * **The step mark carries no `aria-label`.** It had one, and it did
     * nothing: a `<p>` has the implicit role *paragraph*, which is on ARIA's
     * *Name Prohibited* list, so the attribute is ignored by the spec —
     * measured against a real engine, the element's accessible name was empty
     * either way. A stand-in that agrees with you is worse than none (K4): the
     * next reader believes the naming is handled. The visible *Steg 1* is read
     * as ordinary content and in its place that is enough; giving the row a
     * real name would take an element whose role allows one, which is more
     * mechanism than the row is worth.
     */
    const headBelongs =
      this.showStepIndicator && !this.hasAttribute("compact");
    const progress = headBelongs ? this.renderProgress(node) : null;
    const passed = headBelongs ? this.renderStepMark(node) : "";
    /*
     * The meter's row keeps a step mark under the rail (story 116, criterion
     * 5). On the first step nothing has been passed, so the mark there is the
     * plain *Steg 1* — in the passed steps' own form, not the old shouting
     * eyebrow. Without the meter a first step has no row at all: there is no
     * ground crossed to name, and the heading says where you are.
     */
    const mark =
      passed ||
      (progress
        ? `<p class="guide-preview__step">${escapeHtml(`${this.chrome("step.number")} ${this.engine?.getStepNumber() ?? 1}`)}</p>`
        : "");
    const head =
      progress || mark
        ? `${progress?.rail ?? ""}
         <div class="guide-preview__step-row">
           ${mark}
           ${progress?.value ?? ""}
         </div>`
        : "";

    return `
      ${head}
      <h2 tabindex="-1"${description ? ` aria-describedby="${escapeHtml(descId)}"` : ""}>${heading}</h2>
      ${description ? `<div class="guide-preview__formatted" id="${escapeHtml(descId)}">` + this.formatDescription(node, description) + '</div>' : ""}
      ${this.renderWhy(node)}
    `;
  }

  /**
   * The steps already answered on the way here, as one row (Astra 1/10,
   * bilaga 10 punkt 8) — pages and standalone questions in the same form,
   * the current step never among them, so the row never repeats the heading
   * under it.
   *
   * It replaced three forms (genomgången 30/9, V7): the page names with the
   * current page last (*Om dig* over the heading *Om dig*), *STEG N* in a
   * guide of loose questions, and *RESULTAT* — the node type's own word — on
   * a result. A result now shows the way that led to it, like any other step.
   *
   * A list (Fia 24/9, Johan 25/9): each step an item, the check mark for the
   * eye (`aria-hidden`) and *avklarat* for the ear (visually hidden). A step
   * without a title of its own is left out rather than named
   * *Namnlös nod* — that is the editor's word for it, not the visitor's.
   * Titles are resolved like the heading's, so a `{{namn}}` in one reads as
   * the answer, never as the braces.
   *
   * The row wraps, never clips and never scrolls sideways (*"En rad får inte
   * innebära att en lång historik klipps"*): see `.guide-preview__steps`.
   */
  private renderStepMark(node: FlowNodeData): string {
    const graph = this.guideGraph();
    if (!graph) return "";

    const items = passedStepsAlongWay(graph, this.engine?.getTraversedConnectionIds() ?? [], node.id)
      .map((step) =>
        TemplateVariableService.resolve(
          this.localized(step.title),
          this.engine?.getScope() ?? {},
          graph,
          this.activeLocaleValue,
        ).resolved.trim(),
      )
      .filter((title) => title !== "")
      .map(
        (title) =>
          `<li><span aria-hidden="true">✓ </span>${escapeHtml(title)}<span class="guide-preview__visually-hidden">, ${escapeHtml(this.chrome("step.done"))}</span></li>`,
      );

    return items.length > 0
      ? `<ol class="guide-preview__steps" aria-label="${escapeHtml(this.chrome("step.number"))}">${items.join("")}</ol>`
      : "";
  }

  /**
   * "Varför frågar vi det här?" — förtroende byggs vid fältet (story 051).
   *
   * En riktig <details>, aldrig en egen widget: tangentbord, skärmläsare
   * och utskrift kommer gratis. Stängd som standard, och finns inte alls
   * när redaktören inte skrivit något — golvet är tystnad, inte en tom
   * utfällare.
   */
  private renderWhy(node: FlowNodeData): string {
    return this.renderWhyText(this.localized((node.data as { why?: unknown }).why as never));
  }

  /** The disclosure itself — the standalone step and a page's field draw the same one. */
  private renderWhyText(why: string | undefined): string {
    if (!why) {
      return "";
    }

    return `
      <details class="guide-preview__why">
        <summary>${escapeHtml(this.chrome("question.why"))}</summary>
        <p>${escapeHtml(why)}</p>
      </details>
    `;
  }

  /**
   * Formaten en nodtyp deklarerar för en av sina egenskaper.
   *
   * Visaren hade tre egna, hårdkodade listor, och nodtypen deklarerade en
   * fjärde som editorn ritade knappar ur. Alltså kunde panelen erbjuda ett
   * format visaren visar som rå markdown — samtyckesnoden hade en Länk-knapp
   * och besökaren fick `[villkoren](/villkor)` med klamrar.
   *
   * En lista, på det ställe som redan äger vad en nodtyp kan: registret. En ny
   * nodtyp med länk fungerar då utan att någon minns att ändra här.
   */
  private formattingFor(node: FlowNodeData, propertyId: string): FormattingFeature[] {
    const property = getNodeType(node.type)?.properties?.find((one) => one.id === propertyId);

    return [...(property?.formatting ?? ["bold", "italic"])];
  }

  private formatDescription(node: FlowNodeData, value: string): string {
    return this.markUnanswered(
      FormattedTextService.render(
        value,
        this.formattingFor(node, "description"),
        this.engine?.getScope() ?? {},
        this.guideGraph(),
        this.activeLocaleValue
      ).html,
    );
  }

  /**
   * What a variable nobody has answered looks like — one answer per picture.
   *
   * A variable with no value comes out of `FormattedTextService` as the
   * placeholder it was written as, `{{applicantName}}`, and the service is
   * right to leave it there: the caller is the one that knows who is reading.
   * That is also why the mark cannot be put in the service — the editor's two
   * pictures below find the variable's NAME by looking for the braces in the
   * finished html, and a service that had already swapped them for a dash
   * would leave nothing to look up (measured 13/9: two tests fell, both the
   * editor's).
   *
   * **The author, on the canvas:** the variable's *label* in a gap — "Sökandens
   * namn" — because an author has answered nothing, and a text full of double
   * braces says nothing about what the page will look like (Johan 3/9).
   *
   * **The visitor:** `UNANSWERED_MARK`. The old assumption was that a visitor
   * "reached the step by answering and would see the value", and it held for as
   * long as every text sat downstream of the questions feeding it. The page
   * that counts while you answer (story 095) ended that: the text and its
   * calculation are on the SAME page, so the text is drawn before anything is
   * answered. Measured 13/9 — four bundled guides read "{{kostnad}} kr/mån" at
   * arrival, and Låna met us first only because its page is the start node.
   */
  private markUnanswered(html: string): string {
    if (!this.hasAttribute("editor-view")) {
      return html.replace(VARIABLE_PATTERN, UNANSWERED_MARK);
    }

    return variableGaps(html, this.guideGraph(), "guide-preview__variable-gap", this.activeLocaleValue);
  }
  /**
   * Rubriken, med de format nodtypen ger den — men utan blockmarkup.
   *
   * Ett `<p>` inuti ett `<h2>` är ogiltigt, och en lista i en rubrik är inte
   * en rubrik. Samtyckesnoden deklarerar `link` på sin rubrik, och den visades
   * som `[villkoren](/villkor)` med klamrar: den här vägen escapade allt.
   */
  private formatTitle(node: FlowNodeData, value: string): string {
    return this.markUnanswered(FormattedTextService.render(
      value,
      this.formattingFor(node, "title").filter(
        (one) => one !== "bullet-list" && one !== "numbered-list",
      ),
      this.engine?.getScope() ?? {},
      this.guideGraph(),
      this.activeLocaleValue,
      true,
    ).html);
  }


  private renderError(): string {
    if (!this.error) {
      return "";
    }

    return `
      <p class="guide-preview__error" role="alert">
        ${escapeHtml(this.error.message)}
      </p>
    `;
  }

  /**
   * What the page's form holds right now.
   *
   * On a page that repeats (story 084) that is the list of records, one per
   * `fieldset`, under the list's variable and nothing else — each group is
   * collected on its own, because the flat collector below lets the last
   * field of a name win, and every record has a field of every name.
   */
  private getPageFormValues(): Answers {
    const repeat = this.pageRepeat(this.engine?.getCurrentNode());
    if (!repeat) return this.collectFormValues(this.root);

    const records = [...this.root.querySelectorAll<HTMLElement>("[data-repeat-group]")].map((group) =>
      recordOf(this.collectFormValues(group)),
    );
    return { [repeat.variable]: records };
  }

  private collectFormValues(scope: ParentNode): Answers {
    /*
     * Ett uppslag på sidan lämnar PAREN, inte en text — etikett och kod är ett
     * värde, aldrig två listor som hålls i takt av index. Samma beslut som på
     * det egna kortet.
     *
     * ENKELVALET också, och det är inte en detalj: så länge kontrollen var
     * `lookup-field` var dess `value` etiketten, alltså en sträng, och det
     * enkla fältet gick jämnt ut genom sidans generella insamling nedan.
     * `chip-picker.value` är en lista KODER. Sidan lagrade då `["1880"]` i
     * stället för paret, och beskedet "välj ur listan" byggs av `value.trim()`
     * — en TypeError mitt i insamlingen, som inte ser ut som ett fel i fältet
     * utan som att sidan slutar fungera.
     */
    const pairs: Answers = {};

    for (const field of scope.querySelectorAll<LookupPicker>(
      "chip-picker[data-text-lookup][data-page-variable]",
    )) {
      if (field.closest<HTMLElement>("[data-page-field-id]")?.hidden) continue;

      const name = field.getAttribute("data-page-variable") ?? "";

      if (!name) continue;

      const valda = field.choices.map((one) => ({ label: one.label, value: one.value }));

      if (!field.hasAttribute("single")) {
        pairs[name] = valda;
        continue;
      }

      /*
       * Ett enda val är paret självt, inte en lista med ett. Fri text är
       * samma par utan kod — det är den formen mottagaren och mallarna redan
       * läser, och den som säger att svaret inte kom ur listan.
       */
      pairs[name] = valda[0] ?? (field.text.trim() === "" ? "" : { label: field.text, value: "" });
    }

    /*
     * The rating's way out (story 115) leaves the WORDS beside an empty value.
     *
     * The general collection below reads a checked radio's value, and this
     * one's is empty by design — which is also what an untouched scale gives,
     * so the two would arrive as the same answer. The pair says which happened,
     * and the empty value is what keeps *Inte aktuellt* out of an average.
     */
    for (const wayOut of scope.querySelectorAll<HTMLInputElement>(
      "input[data-rating-out]:checked",
    )) {
      if (wayOut.closest<HTMLElement>("[data-page-field-id]")?.hidden) continue;

      const name = wayOut.dataset.pageVariable ?? "";

      if (!name) continue;

      pairs[name] = { label: wayOut.dataset.ratingOutLabel ?? "", value: "" };
    }

    /*
     * Filens markeringar är en DEL av filsvaret, inte en variabel bredvid.
     * Den dolda rutan bär fortfarande sitt eget `data-page-variable` — den är
     * hur bilden lämnar sina markeringar — men värdet hamnar i svaret.
     */
    for (const store of scope.querySelectorAll<HTMLInputElement>("[data-marking-store]")) {
      const sido = store.dataset.pageVariable ?? "";
      const name = sido.endsWith("Markeringar") ? sido.slice(0, -"Markeringar".length) : "";

      if (!name) continue;

      const filnamn = scope.querySelector<HTMLInputElement>(
        `input[data-page-variable="${CSS.escape(name)}"]`,
      );

      pairs[name] = { label: filnamn?.value ?? "", markings: store.value };
      delete pairs[sido];
    }

    return {
      ...Object.fromEntries(
      /*
       * Kontrollen läses aldrig här. Den bär `data-page-variable` som varje
       * annat fält, men dess `value` är en lista koder — den samlas in ovan,
       * som par, och skulle här ha blivit en lista där en sträng väntas.
       */
      Array.from(
        scope.querySelectorAll<HTMLInputElement>(
          "[data-page-variable]:not(chip-picker)",
        ),
      )
        .filter((input) => !input.closest<HTMLElement>("[data-page-field-id]")?.hidden)
        .filter((input) => input.type !== "radio" || input.checked)
        /*
         * A checkbox reports its `value` whether or not it is ticked, so an
         * unticked consent would arrive as "true" and every required one would
         * pass. Unticked is the empty string — the same shape as an unanswered
         * text field, which is what the validation already reads.
         */
        .map((input) => [
          input.dataset.pageVariable ?? "",
          /*
           * Det burna värdet först: ett formaterat fält lägger siffrorna i
           * `data-canonical` när det ändras, så den här raden behöver inte veta
           * att format finns. Ett fält utan form har inget att bära och läses
           * som förut.
           */
          input.type === "checkbox" && !input.checked
            ? ""
            : this.canonicalOf(input),
        ])
        .filter(([name]) => name.length > 0)
      ),
      ...pairs,
    };
  }

  private updatePageFieldVisibility(): void {
    const page = this.engine?.getCurrentNode();
    const graph = this.guideGraph();
    if (!page || page.type !== "page" || !graph) return;

    /*
     * Per record on a page that repeats: a condition reads its own group (AC 4)
     * and the records before it (story 138) — `recordAnswers`, the same answers
     * the record was drawn from.
     */
    const repeat = this.pageRepeat(page);
    const records = repeat ? recordsOf(this.getPageFormValues()[repeat.variable]) : [];
    const groups: { scope: ParentNode; suffix: string; values: Answers }[] = repeat
      ? [...this.root.querySelectorAll<HTMLElement>("[data-repeat-group]")].map((group, index) => ({
          scope: group,
          suffix: `#${group.dataset.repeatGroup}`,
          values: PageRepeatService.recordAnswers({}, repeat.variable, records, index),
        }))
      : [{ scope: this.root, suffix: "", values: this.collectFormValues(this.root) }];
    const children = graph.nodes.filter((node) => node.parentPageId === page.id);
    let optionsMoved = false;

    for (const { scope, suffix, values } of groups) {
      /*
       * With the page's calculations run over what is typed (story 095): a
       * text shows the result as the visitor moves the slider, and a field or
       * text conditioned on it appears when it should. The scope, not
       * `getAnswers`, so `idag` is there for `days(flytt; idag)`.
       */
      const answers = this.withPageCalculations(page, { ...this.engine?.getScope(), ...values });
      optionsMoved ||= this.drawnOptionsStale(page, graph, scope, suffix, answers);
      children.forEach((node) => {
        const visible = PageVisibilityService.isVisible(node, answers);
        const field = scope.querySelector<HTMLElement>(
          `[data-page-field-id="${CSS.escape(node.id + suffix)}"]`
        );
        if (field) field.hidden = !visible;

        const text = scope.querySelector<HTMLElement>(
          `[data-page-heading-id="${CSS.escape(node.id + suffix)}"]`
        );
        if (text && node.type === "page-heading") {
          text.hidden = !visible && !this.revealsHiddenFields();
          text.innerHTML = this.renderPageHeadingBody(node, answers, graph);
        }
      });
    }

    if (optionsMoved) this.redrawPageKeepingFocus();
  }

  /**
   * Whether a choice on the page now offers other options than the ones drawn.
   *
   * Story 138: an option's condition (story 134) was weighed only when the
   * page was drawn, so one that pointed at a field in the same record — or,
   * on a page that repeats, at an earlier record — never followed what the
   * visitor was doing. Hiding a field is an attribute; an option that comes
   * or goes changes the list, the row under it and possibly the answer, and
   * the page's renderer already knows how to draw all three. So this only
   * tells the caller the list moved, and the page is drawn again.
   */
  private drawnOptionsStale(
    page: FlowNodeData,
    graph: GraphData,
    scope: ParentNode,
    suffix: string,
    answers: Answers,
  ): boolean {
    return PageFieldsService.getFields(graph, page, answers, this.activeLocaleValue, { keepHidden: true })
      .filter((field) => field.type === "choice")
      .some((field) => {
        const cell = scope.querySelector<HTMLElement>(`[data-page-field-id="${CSS.escape(field.id + suffix)}"]`);
        if (!cell) return false;
        const drawn = [...cell.querySelectorAll<HTMLInputElement>('input[type="radio"]')].map((radio) => radio.value);
        return drawn.join("\n") !== field.options.map((option) => option.value).join("\n");
      });
  }

  /**
   * Draw the page again from what its fields hold, and put focus back where
   * it was — the same control, and in a text field the same caret.
   *
   * The draft is what a rejected page and *Lägg till* already redraw from, so
   * a choice whose option has gone is emptied and said (story 134, criterion
   * 6) by the path that does it everywhere else.
   */
  private redrawPageKeepingFocus(): void {
    const active = this.root.activeElement;
    const cell = active?.closest<HTMLElement>("[data-page-field-id]")?.dataset.pageFieldId;
    const radio = active instanceof HTMLInputElement && active.type === "radio" ? active.value : null;
    const caret =
      (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && radio === null
        ? [active.selectionStart, active.selectionEnd]
        : null;

    this.pageDraft = this.getPageFormValues();
    this.render();

    if (cell === undefined) return;
    const box = this.root.querySelector<HTMLElement>(`[data-page-field-id="${CSS.escape(cell)}"]`);
    const target =
      radio !== null
        ? box?.querySelector<HTMLElement>(`input[type="radio"][value="${CSS.escape(radio)}"]`)
        : box?.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select");
    target?.focus();
    if (caret && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && caret[0] !== null) {
      try {
        target.setSelectionRange(caret[0], caret[1]);
      } catch {
        // A type without a caret (number, date) — focus is what matters there.
      }
    }
  }

  /**
   * Every field the page is validating, with the key it has in the DOM and
   * the text it holds. One entry per field on a plain page; one per field
   * per record on a page that repeats, each record read against its own
   * values so a condition hides the right field (AC 4).
   */
  private pageSlots(page: FlowNodeData, values: Answers): PageSlot[] {
    const repeat = this.pageRepeat(page);
    if (!repeat) {
      return this.getVisiblePageFields(page, values).map((field) => ({
        key: field.id,
        field,
        value: answerText(values[field.variableName]),
      }));
    }
    const records = recordsOf(values[repeat.variable]);
    return records.flatMap((record, index) =>
      this.getVisiblePageFields(page, PageRepeatService.recordAnswers({}, repeat.variable, records, index)).map((field) => ({
        key: `${field.id}#${index}`,
        field: { ...field, id: `${field.id}#${index}` },
        value: answerText(record[field.variableName]),
      })),
    );
  }

  /** The page fields visible with the current (unsaved) form values. */
  private getVisiblePageFields(
    page: FlowNodeData,
    values: Answers
  ): PageField[] {
    const graph = this.guideGraph();
    if (!graph) return [];

    const answers = this.withPageCalculations(page, { ...this.engine?.getAnswers(), ...values });
    return PageFieldsService.getFields(graph, page, answers, this.activeLocaleValue).filter((field) => {
      const source = graph.nodes.find((candidate) => candidate.id === field.id);
      return !source || PageVisibilityService.isVisible(source, answers);
    });
  }

  /** Validates the visible fields. Returns true when everything is valid. */
  /**
   * Felsummeringen — räknat och länkat i stället för att leta röda kanter
   * (story 051, WCAG-mönstret för sidor med flera fel).
   *
   * Bara vid FLER än ett fel: ett ensamt fel behåller dagens beteende med
   * fokus rakt till fältet. Länktexten är frågans rubrik plus fältets egen
   * felrad — samma formulering på båda ställena, aldrig två.
   *
   * `<a href="#">`, inte `<button>` (ändrat 21/9, Johan/Fable: variant C i
   * 390 px — "punkten hamnar på sista raden"). Mätt (dev/callout-rig.html,
   * `Element.getClientRects()`): en `<button>` genererar EN atomisk box över
   * hela sin höjd oavsett `display: inline` + `appearance: none` — mätt
   * `{top, height: 42, left: 61}`, en enda rect som täcker båda raderna när
   * texten bryts, som en `inline-block`. En efterföljande syskon-inline
   * (bullen, eller `<li>`s egen `::marker`) radar in sig efter den atomiska
   * boxens baslinje, som per spec är boxens SISTA rads baslinje — därför
   * hamnade punkten vid rad två. Det går inte att CSS:a bort; Chromium
   * behandlar `<button>` som en ersatt kontroll oavsett `display`-värde.
   * En `<a>` har ingen sådan atomisk box (mätt: samma vänsterkant på båda
   * raderna, `<li>`s hängande indrag fungerar av sig själv). `href="#"` +
   * `event.preventDefault()` i lyssnaren nedan ger exakt samma sak det gamla
   * knappvalet ville ha — fokusflytt i skuggträdet, ingen navigering, ingen
   * hash i adressfältet — och matchar dessutom förlagan (GOV.UK:s egen
   * felsummering använder riktiga `<a href="#fält-id">`-länkar).
   */
  /** One line of the summary: the question's label and the field's own message, never two wordings. */
  private errorSummaryLine(page: FlowNodeData, fieldId: string, message: string): string {
    const field = this.guideGraph()?.nodes.find((candidate) => candidate.id === nodeIdOf(fieldId));
    const repeat = this.pageRepeat(page);
    const index = recordIndexOf(fieldId);
    // *Barn 2 — Namn*: the record's heading first, so two identical labels tell apart.
    const heading = repeat && index !== null ? `${this.repeatHeading(repeat, index)} — ` : "";
    const label = this.localized(field?.data.title, "");
    return label ? `${heading}${label}: ${message}` : message;
  }

  /**
   * The summary keeps up with the fields under it (Astra 1/10, bilaga 12:
   * *"så att sammanfattningen stämmer när det lokala felet försvinner"*).
   * Measured before: three errors, all three put right one by one, and the
   * summary still said *3 saker* with three links until Next.
   *
   * In place, not redrawn: the links that remain keep their listeners and
   * the visitor's focus stays where it is. Below two it goes, by the rule it
   * was drawn by (story 051 — one error is said at the field alone), and
   * that also keeps the plural sentence from ever saying *1 saker*.
   */
  private refreshErrorSummary(page: FlowNodeData): void {
    const summary = this.root.querySelector<HTMLElement>("[data-error-summary]");
    if (!summary) return;

    if (this.pageFieldErrors.size < 2) {
      summary.remove();
      return;
    }

    summary.querySelectorAll<HTMLAnchorElement>("[data-error-link]").forEach((link) => {
      const fieldId = link.dataset.errorField ?? "";
      const message = this.pageFieldErrors.get(fieldId);
      if (!message) {
        link.closest("li")?.remove();
        return;
      }
      const line = this.errorSummaryLine(page, fieldId, message);
      if (link.textContent !== line) link.textContent = line;
    });
    const title = summary.querySelector<HTMLElement>(".guide-preview__error-summary-title");
    const count = this.chrome("page.errorSummary", { n: this.pageFieldErrors.size });
    if (title && title.textContent !== count) title.textContent = count;
  }

  private renderPageErrorSummary(page: FlowNodeData): string {
    if (this.pageFieldErrors.size < 2) {
      return "";
    }

    const items = [...this.pageFieldErrors.entries()].map(([fieldId, message]) =>
      `<li><a href="#" data-error-link data-error-field="${escapeHtml(fieldId)}">${escapeHtml(this.errorSummaryLine(page, fieldId, message))}</a></li>`,
    );

    return `
      <div class="guide-preview__error-summary" data-error-summary role="alert" tabindex="-1">
        <h3 class="guide-preview__error-summary-title">${escapeHtml(this.chrome("page.errorSummary", { n: this.pageFieldErrors.size }))}</h3>
        <ul>${items.join("")}</ul>
      </div>
    `;
  }

  private validatePageFields(
    page: FlowNodeData,
    values: Answers
  ): boolean {
    this.pageFieldErrors.clear();
    this.pageDraft = null;
    this.resetChoiceDraft();

    this.pageSlots(page, values).forEach((slot) => {
      const message = this.pageFieldMessage(slot.field, slot.value);
      if (message) this.pageFieldErrors.set(slot.key, message);
    });

    return this.pageFieldErrors.size === 0;
  }

  /*
   * The cell first, then the control in it. The selector was
   * `[data-invalid] input, [data-invalid]` and returned the CELL — first in
   * document order — which worked only while the cell was a `<label>`:
   * Chromium forwards a label's focus() to its control. Since 6/9 the cell is
   * a `div` (the why had to stand outside the label), and a div's focus() is
   * nothing. Measured: the repeating-page test lost focus on *Barn 2 — Namn*.
   */
  private focusFirstInvalidPageField(): void {
    const cell = this.root.querySelector<HTMLElement>("[data-page-field-id][data-invalid]");
    // A choice with nothing left to choose has no control; the cell itself
    // takes focus (story 138, `tabindex="-1"` on its fieldset).
    (cell?.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select") ??
      (cell?.hasAttribute("tabindex") ? cell : null))
      ?.focus();
  }

  /**
   * Clears error messages as the user corrects the fields. Adds no new errors
   * while typing — that happens on Next.
   */
  /**
   * The error message for a page field.
   *
   * The "must be chosen from the list" rule lives here and not in
   * `PageFieldValidationService`, because it needs to read the chosen code from
   * the mounted lookup field. The service's own messages then go the same way as
   * everything else — the guide's own text, the host's pack, the built-in.
   */
  private pageFieldMessage(field: PageField, value: string): string | null {
    /*
     * Story 138, the lead's decision 29/9: a record where *Varje upprepning
     * ska välja olika* left nothing to choose is not passed through with an
     * empty answer. Its own words, ahead of the generic "choose an option",
     * because there is no option to choose — the way on is to remove the
     * record or change another.
     */
    if (field.type === "choice" && field.options.length === 0 && field.optionsTaken === true && value === "") {
      return this.chrome("validation.noOptionsLeft");
    }

    if (field.type === "lookup" && field.allowFreeText !== true) {
      const element = this.root.querySelector<LookupPicker>(
        `[data-page-field-id="${CSS.escape(field.id)}"] chip-picker`,
      );

      if (value.trim().length > 0 && this.lookupCodes(element) === "") {
        return this.chrome("validation.chooseFromList");
      }
    }

    const message = PageFieldValidationService.getMessage(
      field,
      value,
      this.activeLocaleValue,
      this.guideGraph()?.settings?.strings,
    );

    /*
     * An untouched field is NOT a field error, and was one here until Johan
     * settled it 15/9: *"En popover: du har inte justerat startvärdet, vill du
     * verkligen gå vidare?"* Red text beside a field says *you did something
     * wrong*, and wanting exactly the value that stands there is not wrong. So
     * the question moved to `askAboutUntouched`, on the way out of the page,
     * and nothing about it is drawn here.
     */
    if (message) return message;

    /*
     * Story 138: the same answer as an earlier record, on a field set to
     * *Varje upprepning ska välja olika* — the same person on two rows, the
     * same session booked twice. Case and the spaces around a text do not
     * make two people. `taken` holds only the records BEFORE this one, so
     * the later of two is the one told, and its answer stays where it is
     * for the visitor to correct (Johan 29/9: validate, never empty).
     *
     * A choice can only get here with an answer that was already standing —
     * a saved run handed back, a list that changed under it — because the
     * list itself never offers what another record holds.
     */
    const same = (text: string): string => text.trim().toLocaleLowerCase();
    if (field.type === "text" && value.trim() !== "" && field.taken?.some((one) => same(one) === same(value))) {
      return this.chrome("validation.alreadyGiven");
    }
    if (field.type === "choice" && value !== "" && field.taken?.includes(value)) {
      return this.chrome("validation.alreadyChosen");
    }

    return null;
  }

  /*
   * Also an own step's (Johan 1/10, *"ja, onblur eller onchange"*): a
   * question standing on its own step is tried again the way a page field
   * is, with the page's own question (`pageFieldMessage`) asked of the field
   * the step's node would be on a page (`PageFieldsService.fieldOf`, the
   * same mapping the step's file field already renders through). Its value
   * is read the way the step's Next reads it (`readStepAnswer`). So a
   * group's mark and indent go the moment the visitor puts it right, and
   * come back only with another Next — nothing new is said while typing.
   */
  private refreshPageFieldErrors(): void {
    const page = this.engine?.getCurrentNode();
    if (!page) return;

    const step = page.type === "page" ? null : this.stepSlot(page);
    if (step) this.refreshStepError(step);
    if (this.pageFieldErrors.size === 0) return;
    if (!step && page.type !== "page") return;

    const slots = step ? [step.slot] : this.pageSlots(page, this.getPageFormValues());

    Array.from(this.pageFieldErrors.keys()).forEach((fieldId) => {
      const slot = slots.find((candidate) => candidate.key === fieldId);
      const message = slot
        ? this.pageFieldMessage(slot.field, slot.value)
        : null;
      const container = this.root.querySelector<HTMLElement>(
        `[data-page-field-id="${CSS.escape(fieldId)}"]`
      );
      const errorElement = container?.querySelector<HTMLElement>(
        ".guide-preview__field-error"
      );

      if (message) {
        this.pageFieldErrors.set(fieldId, message);
        if (errorElement) errorElement.textContent = message;
        return;
      }

      this.pageFieldErrors.delete(fieldId);
      container?.removeAttribute("data-invalid");
      errorElement?.remove();
      container
        ?.querySelectorAll("[data-page-variable]")
        .forEach((input) => {
          input.removeAttribute("aria-invalid");
          input.removeAttribute("aria-describedby");
        });
    });

    if (!step) this.refreshErrorSummary(page);
  }
  /** An own step as the one slot a page would have for it; null for a node that asks nothing. */
  private stepSlot(node: FlowNodeData): { slot: PageSlot; kind: "branch" | "lookup" | "other" } | null {
    const behavior = getNodeType(node.type)?.behavior;
    if (!behavior) return null;
    const { value, kind } = this.readStepAnswer(behavior.answer, behavior.flow.kind);
    const field = PageFieldsService.fieldOf(node, this.activeLocaleValue, getSourceLocale(this.guideGraph()));
    return { slot: { key: node.id, field, value }, kind };
  }

  /**
   * Takes back what `placeStepError` drew once the step's answer holds, or
   * puts the new words in its place while it still does not. A branch with
   * nothing chosen keeps its own words: no field rule says a branch must be
   * answered, the route does.
   */
  private refreshStepError({ slot, kind }: { slot: PageSlot; kind: "branch" | "lookup" | "other" }): void {
    if (!this.stepError) return;

    const message = kind === "branch" && slot.value === ""
      ? this.stepError
      : this.pageFieldMessage(slot.field, slot.value);
    const shown = this.root.querySelector<HTMLElement>("#guide-step-error");

    if (message) {
      this.stepError = message;
      if (shown && shown.textContent !== message) shown.textContent = message;
      return;
    }

    this.stepError = null;
    shown?.remove();
    this.root.querySelectorAll("article [data-invalid]").forEach((marked) => marked.removeAttribute("data-invalid"));
    this.root.querySelectorAll("article [aria-describedby~='guide-step-error']").forEach((described) => {
      const rest = (described.getAttribute("aria-describedby") ?? "")
        .split(" ")
        .filter((id) => id && id !== "guide-step-error");
      if (rest.length > 0) described.setAttribute("aria-describedby", rest.join(" "));
      else described.removeAttribute("aria-describedby");
      described.removeAttribute("aria-invalid");
    });
  }

  /**
   * A word under the file field about the *choice*, not about the value.
   *
   * Written straight into the field, not through `pageFieldErrors`. That map
   * holds what the **value** is wrong about, and it is recomputed from the
   * value every refresh — so a message put there about a *choice* would be
   * wiped the moment anything else changed. A refused file leaves no value
   * behind at all, and "you picked something and nothing happened" is feedback
   * about an action rather than about an answer. An example photo that could
   * not be fetched is the same kind of nothing-happened, which is why it comes
   * out here too.
   */
  private showFileNotice(fieldId: string, message: string | null): void {
    const container = this.root.querySelector<HTMLElement>(
      `[data-page-field-id="${CSS.escape(fieldId)}"]`,
    );

    if (!container) {
      return;
    }

    let element = container.querySelector<HTMLElement>("[data-file-notice]");

    if (!element) {
      element = document.createElement("p");
      element.className = "guide-preview__field-error";
      element.setAttribute("data-file-notice", "");
      element.setAttribute("role", "alert");
      container.append(element);
    }

    element.textContent = message ?? "";
    container.toggleAttribute("data-invalid", Boolean(message));
  }

  /**
   * Checks a chosen file and keeps it until the guide ends.
   *
   * The hidden field beside the input is where the answer lives — the name, and
   * only the name, because that is all a guide made of JSON can hold. The file
   * itself waits in `heldFiles` for `getFiles()`.
   *
   * Nothing here travels. Uploading when the file is picked is a real model and
   * is written up in `docs/FIL-KONTRAKT.md`, but it is not built, and the seam
   * that used to offer it is gone rather than left half-connected.
   */
  private async handleFileChosen(
    input: HTMLInputElement,
    example?: { file: File; alt: string },
  ): Promise<void> {
    const fieldId = input.dataset.fileField ?? "";
    /*
     * The example is passed rather than read back out of the input: a browser
     * that refuses an assigned `files` list would otherwise lose the file the
     * visitor just asked for, and the picker's label is the only thing that
     * assignment is needed for.
     */
    const file = example?.file ?? input.files?.[0] ?? null;
    const nameField = this.root.querySelector<HTMLInputElement>(
      `[data-file-name="${CSS.escape(fieldId)}"]`,
    );
    const show = (message: string | null): void => this.showFileNotice(fieldId, message);

    /*
     * What the picture shows follows the picture: an example photo brings the
     * editor's words with it, anything else brings none of ours. Set before the
     * refusals below only to be honest about the order — a refused file leaves
     * the field empty, and an alt text for a picture that is not there is read
     * by nothing.
     */
    if (example?.alt) {
      this.exampleAlts.set(fieldId, example.alt);
    } else {
      this.exampleAlts.delete(fieldId);
    }

    /*
     * Nothing is released to anybody. `file-released` existed to tell a host to
     * clean up a file it was already storing, and with no upload there is
     * nothing stored anywhere but this tab — an event would send them hunting
     * for a file that never left.
     */
    if (!file) {
      this.heldFiles.delete(fieldId);
      // Markeringar utan bild pekar på ingenting.
      this.heldMarks.delete(fieldId);
      this.syncMarkingArea(fieldId);
      if (nameField) nameField.value = "";
      this.showChosenFile(fieldId, "");
      show(null);
      return;
    }

    const accept = input.getAttribute("accept") ?? "";
    const maxSize = Number(input.dataset.maxSize ?? "0");

    if (accept && !this.fileTypeAllowed(file, accept)) {
      input.value = "";
      show(this.chrome("validation.file.type", { types: accept }));
      return;
    }

    if (maxSize > 0 && file.size > maxSize * 1024 * 1024) {
      input.value = "";
      show(this.chrome("validation.file.size", { n: maxSize }));
      return;
    }

    /*
     * Kept, not sent. The refusals above have already run, so this is a file the
     * rules accept — and the answer becomes its name at once, because there is
     * no round trip to wait for and so no window where the field is filled but
     * the answer is not.
     */
    // En ny bild är en ny yta — gamla markeringar skulle peka fel.
    if (this.heldFiles.get(fieldId)?.file !== file) {
      this.heldMarks.delete(fieldId);
    }

    this.heldFiles.set(fieldId, {
      variableName: nameField?.dataset.pageVariable ?? "",
      file,
    });

    if (nameField) nameField.value = file.name;
    this.showChosenFile(fieldId, file.name);
    show(null);
    this.syncMarkingArea(fieldId);
    this.updatePageFieldVisibility();
  }

  /** The chosen file's name beside *Välj fil* — what the browser's own picker used to say (punkt 11). */
  private showChosenFile(fieldId: string, name: string): void {
    const shown = this.root.querySelector<HTMLElement>(`[data-file-chosen="${CSS.escape(fieldId)}"]`);
    if (shown) shown.textContent = name;
  }

  /**
   * The run's stand-in button, and the redraw that keeps it after a re-render.
   *
   * The press writes the name into the same hidden field a picked file writes
   * into, so everything downstream — the answer the engine stores, the review
   * step, going back and forth — is the file field's own machinery and not a
   * second path beside it. Going back to the step rebuilds the markup with the
   * name already in it (it came from the answer), and this puts the picture
   * back under the marks.
   */
  private wireProvingFiles(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-proving-file]").forEach((button) => {
      const fieldId = button.dataset.provingFile ?? "";

      if (this.provingStandIns.has(fieldId)) {
        this.syncMarkingArea(fieldId);
      }

      button.addEventListener("click", () => {
        const accept = button.dataset.provingAccept ?? "";
        const src = button.dataset.exampleSrc ?? "";
        const standIn = provingStandInFor(
          accept,
          button.dataset.provingMarking === "true",
          src ? { src, name: exampleFileName(src), alt: button.dataset.exampleAlt ?? "" } : null,
        );
        const nameField = this.root.querySelector<HTMLInputElement>(
          `[data-file-name="${CSS.escape(fieldId)}"]`,
        );

        this.provingStandIns.set(fieldId, standIn);
        // A new surface — the old marks pointed at another picture.
        this.heldMarks.delete(fieldId);

        if (standIn.alt) {
          this.exampleAlts.set(fieldId, standIn.alt);
        } else {
          this.exampleAlts.delete(fieldId);
        }

        if (nameField) {
          nameField.value = standIn.name;
        }

        /*
         * The name, visibly. A picker says what was picked; a button that only
         * says what it does leaves the step looking untouched, and an editor
         * cannot tell an added stand-in from one they meant to add and did not.
         */
        const chosen = this.root.querySelector<HTMLElement>(
          `[data-proving-chosen="${CSS.escape(fieldId)}"]`,
        );

        if (chosen) {
          chosen.textContent = standIn.name;
        }

        this.syncMarkingArea(fieldId);
        this.updatePageFieldVisibility();
      });
    });
  }

  /**
   * The host's *Använd exempelfoto* — story 108.
   *
   * The whole of the library's part in it: fetch the address the node points at
   * when somebody presses, and hand what comes back to the file field as a
   * `File`. Nothing is stored, nothing is fetched beforehand, and no address is
   * ours — the photo is served by the host's own page, exactly like a picture
   * in a guide's text.
   *
   * **It goes in through the picker, not beside it.** Assigning `input.files`
   * from a `DataTransfer` (the detour `restoreHeldFile` already takes) puts the
   * example on the same path a chosen file takes: the type and size checks run,
   * `heldFiles` holds it, the marks land on it, the review step shows it and
   * `getFiles()`/`getFormData()` carry it into the submission. A second path
   * that "also attached a file" would be a second thing to keep true.
   */
  private wireExampleFiles(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-example-file]").forEach((button) => {
      button.addEventListener("click", () => {
        void this.attachExampleFile(button);
      });
    });
  }

  private async attachExampleFile(button: HTMLButtonElement): Promise<void> {
    const fieldId = button.dataset.exampleFile ?? "";
    const input = this.root.querySelector<HTMLInputElement>(
      `input[data-file-field="${CSS.escape(fieldId)}"]`,
    );

    if (!input) {
      return;
    }

    let file: File;

    try {
      const response = await fetch(button.dataset.exampleSrc ?? "");

      if (!response.ok) {
        throw new Error(String(response.status));
      }

      const blob = await response.blob();

      /*
       * `ok` is not proof of a photo. Measured on the test server: an address
       * that does not exist answers **200 with an HTML page**, and without this
       * the field would have attached that page under the photo's name — the
       * `accept` check reads the name, which comes from the address and is
       * `.jpg` either way. A host serving a real picture serves an image type;
       * anything else is the same nothing-happened as a refusal.
       */
      if (!blob.type.startsWith("image/")) {
        throw new Error(blob.type);
      }

      file = new File([blob], button.dataset.exampleName ?? "", { type: blob.type });
    } catch {
      /*
       * A photo the host serves and the browser could not get. The visitor is
       * told once, in the field, and their own picker is untouched — the step
       * is answerable without us either way.
       */
      this.showFileNotice(fieldId, this.chrome("file.exampleFailed"));
      return;
    }

    try {
      const transfer = new DataTransfer();

      transfer.items.add(file);
      input.files = transfer.files;
    } catch {
      /*
       * Same fallback as `restoreHeldFile`: if a browser refuses the assignment
       * the answer below is still right, and only the picker's own label is
       * missing.
       */
    }

    await this.handleFileChosen(input, { file, alt: button.dataset.exampleAlt ?? "" });
  }

  /**
   * Story 047: the tap surface for marking one's own picture.
   *
   * A tap on the picture adds a mark where the finger landed, in percent of
   * the surface — a mark is a real button that removes itself, which is also
   * the keyboard's way to undo a specific one. Rensa empties. There is no
   * keyboard way to ADD a mark; like the map's gestures, pointing is a
   * convenience on top, and the marks are never required by any validation.
   */
  private wireMarkingAreas(): void {
    this.root.querySelectorAll<HTMLElement>("[data-marking-area]").forEach((area) => {
      const fieldId = area.dataset.markingArea ?? "";
      const canvas = area.querySelector<HTMLElement>("[data-marking-canvas]");

      canvas?.addEventListener("click", (event) => {
        const dot = (event.target as HTMLElement).closest<HTMLElement>("[data-marking-index]");
        const marks = this.heldMarks.get(fieldId) ?? [];

        /*
         * Pricken tar inte bort — en feltryckning skulle kasta skriven text.
         * Den går till sin rad; borttagningen bor på radens egen knapp, där
         * siffran och texten syns bredvid beslutet.
         */
        if (dot) {
          this.root
            .querySelector<HTMLInputElement>(`[data-marking-text="${dot.dataset.markingIndex}"]`)
            ?.focus();
          return;
        }

        const rect = canvas.getBoundingClientRect();

        if (rect.width === 0 || rect.height === 0) return;

        marks.push({
          x: Math.round(((event.clientX - rect.left) / rect.width) * 1000) / 10,
          y: Math.round(((event.clientY - rect.top) / rect.height) * 1000) / 10,
          text: "",
        });
        this.heldMarks.set(fieldId, marks);
        this.syncMarkingArea(fieldId);
        // Texten är halva markeringen: pennan står redo där siffran just kom.
        this.root
          .querySelector<HTMLInputElement>(`[data-marking-text="${marks.length - 1}"]`)
          ?.focus();
      });

      const rows = area.querySelector<HTMLElement>("[data-marking-rows]");

      // Skrivandet uppdaterar bara lagringen — en omritning mitt i ett ord
      // skulle tappa både fokus och tålamod.
      rows?.addEventListener("input", (event) => {
        const input = event.target as HTMLInputElement;
        const index = Number(input.dataset.markingText ?? "-1");
        const marks = this.heldMarks.get(fieldId) ?? [];

        if (index >= 0 && marks[index]) {
          marks[index].text = input.value;

          const store = area.querySelector<HTMLInputElement>("[data-marking-store]");

          if (store) store.value = JSON.stringify(marks);
        }
      });
      rows?.addEventListener("click", (event) => {
        const button = (event.target as HTMLElement).closest<HTMLElement>("[data-marking-remove]");

        if (!button) return;

        const marks = this.heldMarks.get(fieldId) ?? [];

        marks.splice(Number(button.dataset.markingRemove), 1);
        this.heldMarks.set(fieldId, marks);
        this.syncMarkingArea(fieldId);
      });

      area.querySelector<HTMLButtonElement>("[data-marking-clear]")?.addEventListener("click", () => {
        this.heldMarks.set(fieldId, []);
        this.syncMarkingArea(fieldId);
      });

      this.syncMarkingArea(fieldId);
    });
  }

  /** Ritar om ytan ur det hållna: bilden, prickarna, räknaren, lagringsfältet. */
  private syncMarkingArea(fieldId: string): void {
    const area = this.root.querySelector<HTMLElement>(
      `[data-marking-area="${CSS.escape(fieldId)}"]`,
    );

    if (!area) return;

    const held = this.heldFiles.get(fieldId);
    /*
     * The run's stand-in draws here too, and by the same rule: marks go on a
     * picture, on nothing else. It is a data URI rather than a `File`, so there
     * is no object URL to make and none to revoke — the branch below is about
     * where the picture comes from, never about what the marks are.
     */
    const standIn = this.provingStandIns.get(fieldId);
    const isImage = standIn ? standIn.isImage : (held?.file.type.startsWith("image/") ?? false);

    area.toggleAttribute("hidden", !isImage);

    const marks = isImage ? (this.heldMarks.get(fieldId) ?? []) : [];
    const store = area.querySelector<HTMLInputElement>("[data-marking-store]");

    if (store) {
      store.value = marks.length ? JSON.stringify(marks) : "";
    }

    const picture = standIn
      ? { stamp: `stand-in:${standIn.name}`, src: standIn.src }
      : held
        ? { stamp: `${held.file.name}:${held.file.size}`, src: "" }
        : null;

    if (!isImage || !picture) return;

    const img = area.querySelector<HTMLImageElement>("[data-marking-image]");

    if (img && img.dataset.markingFor !== picture.stamp) {
      const previous = this.markingUrls.get(fieldId);

      if (previous) {
        URL.revokeObjectURL(previous);
        this.markingUrls.delete(fieldId);
      }

      const url = picture.src || URL.createObjectURL((held as { file: File }).file);

      if (!picture.src) this.markingUrls.set(fieldId, url);
      img.src = url;
      img.dataset.markingFor = picture.stamp;
      /*
       * The example photo says what it shows; a visitor's own photo says
       * nothing. Set here rather than in the markup because the picture can
       * change without the step being re-rendered — pressing the button on a
       * step already drawn is exactly that case.
       */
      img.alt = this.exampleAlts.get(fieldId) ?? "";
    }

    const canvas = area.querySelector<HTMLElement>("[data-marking-canvas]");

    canvas?.querySelectorAll("[data-marking-index]").forEach((el) => el.remove());
    marks.forEach((mark, index) => {
      const dot = document.createElement("button");

      dot.type = "button";
      dot.className = "guide-preview__marking-dot";
      dot.setAttribute("data-marking-index", String(index));
      dot.setAttribute("aria-label", this.chrome("marking.goto", { n: index + 1 }));
      dot.textContent = String(index + 1);
      dot.style.left = `${mark.x}%`;
      dot.style.top = `${mark.y}%`;
      canvas?.append(dot);
    });

    // Raderna: en siffra, en text, ett borttagande — annoterade bildens
    // mönster, fast invånaren håller i pennan.
    const rows = area.querySelector<HTMLElement>("[data-marking-rows]");

    if (rows) {
      rows.replaceChildren(
        ...marks.map((mark, index) => {
          const row = document.createElement("div");

          row.className = "guide-preview__marking-item";

          const label = document.createElement("label");
          const caption = document.createElement("span");

          caption.textContent = this.chrome("marking.describe", { n: index + 1 });

          const input = document.createElement("input");

          input.type = "text";
          input.setAttribute("data-marking-text", String(index));
          input.value = mark.text;

          label.append(caption, input);

          const remove = document.createElement("button");

          remove.type = "button";
          remove.className = "guide-preview__marking-remove";
          remove.setAttribute("data-marking-remove", String(index));
          remove.setAttribute("aria-label", this.chrome("marking.remove", { n: index + 1 }));
          remove.textContent = this.chrome("marking.removeShort");

          row.append(label, remove);

          return row;
        }),
      );
    }

    const count = area.querySelector<HTMLElement>("[data-marking-count]");

    if (count) {
      count.textContent = marks.length ? this.chrome("marking.count", { n: marks.length }) : "";
    }

    area
      .querySelector<HTMLButtonElement>("[data-marking-clear]")
      ?.toggleAttribute("hidden", marks.length === 0);
  }

  /**
   * Puts a held file back on a freshly rendered input.
   *
   * Going back to a page rebuilds its markup, and a new file input is empty. The
   * hidden field still carries the name, so without this the page would say
   * *cv.pdf* above a picker that says *No file chosen* — and the person would
   * reasonably conclude the attachment was gone and pick it again.
   *
   * Assigning `files` is only allowed from a `DataTransfer`, which is why the
   * detour. If a browser refuses, the name and `getFiles()` are both still
   * right; only the picker's own label is missing, so there is nothing to do but
   * carry on.
   */
  private restoreHeldFile(input: HTMLInputElement): void {
    const held = this.heldFiles.get(input.dataset.fileField ?? "");

    if (!held || input.files?.length) {
      return;
    }

    try {
      const transfer = new DataTransfer();

      transfer.items.add(held.file);
      input.files = transfer.files;
    } catch {
      /* See above: the answer survives, the picker's label does not. */
    }
  }

  /** Whether the file matches an `accept` list of extensions or MIME types. */
  private fileTypeAllowed(file: File, accept: string): boolean {
    return accept
      .split(",")
      .map((one) => one.trim().toLowerCase())
      .filter((one) => one !== "")
      .some((one) =>
        one.startsWith(".")
          ? file.name.toLowerCase().endsWith(one)
          : one.endsWith("/*")
            ? file.type.startsWith(one.slice(0, -1))
            : file.type.toLowerCase() === one,
      );
  }

  /**
   * Återresan från granskningens Ändra (story 049).
   *
   * När besökaren hoppar tillbaka sparas svarsposterna som en biljett; när
   * den rättade frågan besvarats spelas resten upp automatiskt — så länge
   * varje nästa steg har ett sparat svar och vägen stämmer. Första steget
   * utan sparat svar, eller ett uppspelningsfel, lämnar över till besökaren
   * och river biljetten: en ändrad väg ska gås på riktigt, aldrig bluffas.
   */
  private reviewTicket: { records: GuideAnswerRecord[]; values: Answers; editedId: string } | null = null;

  private replayTowardsReview(): void {
    if (!this.reviewTicket || !this.engine) {
      return;
    }

    for (let guard = 0; guard < 60; guard += 1) {
      const current = this.engine.getCurrentResult();

      if (!current.success) break;
      const node = current.node;

      // Frågan som ska ändras rörs aldrig av uppspelningen — det är ju den
      // besökaren hoppade tillbaka för att svara på själv.
      if (node.id === this.reviewTicket.editedId) {
        return;
      }

      if (node.type === "review" || isEndingNodeType(node.type)) {
        this.reviewTicket = null;
        return;
      }

      const stored = this.reviewTicket.records.filter((record) => record.questionId === node.id);

      if (stored.length === 0) break;

      /*
       * Nothing is passed about touching here, and that took two goes to get
       * right (story 118). The replay re-answers each step with what the
       * visitor already said, and the rule refuses a field they have not
       * given — so at first the whole ticket was handed over as *touched* to
       * keep the replay from stranding somebody on their way back.
       *
       * It is not needed: `goBackToQuestion` rewinds the answers and puts what
       * they held into the engine's memory, which is where the rule looks
       * since QA found the same fault on ordinary back-navigation. Measured
       * 15/9 — after *Ändra*, the prefill still holds the answer, and the
       * replay goes through with no set at all. A compensation that is not
       * needed is a second rule waiting to disagree with the first.
       */
      let result;
      if (node.type === "page") {
        const values: Answers = {};
        for (const [name, value] of Object.entries(this.reviewTicket.values)) values[name] = value;
        result = this.engine.answerPage(values);
      } else if (node.type === "question") {
        result = this.engine.answer(stored[0]!.optionId);
      } else {
        result = this.engine.answerValue(answerText(stored[0]!.value), this.reviewTicket.values);
      }

      if (!result.success || result.node.id === node.id) break;
    }

    this.reviewTicket = null;
  }

  private bindEvents(): void {
    // The frame around a chosen answer follows `[data-chosen]` on the label
    // (the stylesheet says why it is not `:has()`). One listener per group:
    // a radio only fires on the one that was picked, and the exclusive box
    // unticks its neighbours by script, so the whole group is re-marked.
    // A page's radios too (punkt 12): the same row, the same chosen frame.
    this.root.querySelectorAll<HTMLElement>(".guide-preview__options, .guide-preview__page-choices, .guide-preview__rating").forEach((group) => {
      group.addEventListener("change", () => {
        group.querySelectorAll<HTMLLabelElement>("label").forEach((label) => {
          label.toggleAttribute("data-chosen", label.querySelector("input")?.checked === true);
        });
      });
    });


    // Granskningens Ändra (story 049): tillbaka till frågan, med biljett hem.
    this.root.querySelectorAll<HTMLButtonElement>("[data-review-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const questionId = button.dataset.reviewQuestion;

        if (!questionId || !this.engine) return;

        this.reviewTicket = {
          records: this.engine.getAnswerRecords(),
          values: this.engine.getAnswers(),
          editedId: questionId,
        };
        const result = this.engine.goBackToQuestion(questionId);
        this.error = null;
        this.render();
        if (result.success) this.dispatchNodeChanged(result.node.id);
      });
    });

    // Felsummeringens länkar (story 051): fokus till fältet felet gäller.
    // `<a href="#">`, inte navigering — se toppkommentaren på
    // `renderPageErrorSummary`. `preventDefault()` är hela poängen: utan den
    // hade `#` hamnat i adressfältet och sidan hoppat till toppen.
    this.root.querySelectorAll<HTMLAnchorElement>("[data-error-link]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const fieldId = link.dataset.errorField;
        this.root
          .querySelector<HTMLElement>(
            `[data-page-field-id="${fieldId}"] input, [data-page-field-id="${fieldId}"] textarea, [data-page-field-id="${fieldId}"] select`,
          )
          ?.focus();
      });
    });

    this.wireMapQuestion();
    this.wireProvingPlace();

    this.connectLookupFields();


    /*
     * The shape appears while it is being typed, which is the whole of what
     * Johan asked for: `19560328-1949` can be checked against the card in your
     * hand, and `195603281949` cannot.
     *
     * ## The two ways a mask goes wrong
     *
     * **The caret.** Rewriting the value moves it to the end, so the next
     * keystroke lands in the wrong place. `maskFormat` counts it in digits
     * before it rather than characters, and it is put back here in the same
     * frame — setting `value` and `selectionStart` separately would leave one
     * paint with the caret at the end.
     *
     * **Deleting a separator.** Backspace over the dash removes only the dash,
     * the mask puts it straight back, and the field appears frozen. So a
     * deletion that took a separator takes the digit before it too, which is
     * what somebody pressing backspace meant.
     *
     * Only fields whose format has a settled shape carry `data-format` with one
     * of the three; everything else never reaches this listener's body.
     */
    /*
     * Alla formade fält, inte bara den fristående frågans.
     *
     * En sida kan ha flera — personnummer, postnummer och organisationsnummer
     * bredvid varandra — och innan detta fick inget av dem någon form alls:
     * kroken satt bara på `data-text-answer`, som en sidas fält aldrig bär. Det
     * var därför inget format syntes på "Om dig".
     */
    /**
     * Skriver ned det kanoniska värdet bredvid det formade.
     *
     * Poängen är att insamlingen inte ska behöva komma ihåg något. Tidigare
     * härleddes siffrorna vid insamlingen — och sidans insamling glömde, vilket
     * är varför ett personnummer lagrades med bindestreck så fort det kom från
     * en sida. En regel varje ny väg måste minnas är en regel som kommer
     * glömmas; ett värde som redan ligger där kan inte det.
     */
    /**
     * Säger ifrån när formen tyst kastat det någon skrev — men först när de
     * slutat skriva.
     *
     * Ett formaterat fält tar bara det formen tillåter, så bokstäver i ett
     * personnummerfält syns aldrig. Bättre än att kastas om, men fortfarande en
     * vägran utan ord: den som tabbat fel ser ingenting hända, och en skärmläsare
     * hör ingenting eftersom värdet inte ändrades.
     *
     * Efter en paus och inte vid första tecknet, vilket var Johans invändning och
     * en riktig: den som slår fel en gång mitt i ett tal ska inte få en
     * tillrättavisning i ansiktet. Pausen gör den till ett svar på "det händer ju
     * inget" i stället för en rättelse av varje tangenttryck.
     *
     * `aria-live="polite"` gör den hörbar, vilket är den enda vägen ut ur den
     * tysta vägran för den som inte ser fältet.
     */
    const PAUSE = 700;

    const sayRefused = (input: HTMLInputElement): void => {
      const slots = [...(input.dataset.mask ?? getFormat(input.dataset.format)?.pattern ?? "")];
      const digitsOnly = slots.every((slot) => slot !== "A");
      const note = this.shapeNoteFor(input);

      if (!note) {
        return;
      }

      note.textContent = this.chrome(
        digitsOnly ? "field.onlyDigits" : "field.onlyLettersAndDigits",
      );
    };

    const carryCanonical = (input: HTMLInputElement): void => {
      input.dataset.canonical =
        input.dataset.group === undefined
          ? canonicalFormat(input.dataset.format, input.value)
          /*
           * The language, because this decides what is **stored**.
           *
           * Without it every comma read as a decimal mark, and a stored
           * `1234567` shown in an English guide as `1,234,567` was rewritten to
           * `1.234567` here — on mount, before anybody touched the field, with
           * no validation error, since the result is a valid number.
           */
          : ungroup(input.value, this.activeLocaleValue);
    };

    this.root
      .querySelectorAll<HTMLInputElement>(
        "input[data-format], input[data-mask], input[data-group]",
      )
      .forEach((shaped) => {
        /*
         * The third way a value arrives: it was already there when the step was
         * drawn. Coming back with Föregående, or a host handing an answer over
         * through `given` (story 085), the field showed the stored twelve digits
         * where a typist had seen `19560328-1949` — measured 4/9 in the 085
         * pictures. Shaped here, once for both render paths, so a value looks
         * the same however it got into the field. `displayFormat` only dresses a
         * value that fills the shape; half a personnummer stays as it is.
         */
        if (shaped.dataset.group === undefined) {
          const shown = shaped.dataset.mask
            ? maskWithPattern(shaped.dataset.mask, shaped.value, shaped.value.length).value
            : displayFormat(shaped.dataset.format, shaped.value);

          if (shown !== shaped.value) {
            shaped.value = shown;
          }
        }
        carryCanonical(shaped);

        /*
         * Raden skapas här och inte i markupen: formen sitter på fältet, och två
         * renderingsvägar — den fristående frågan och sidans fält — skulle annars
         * behöva känna till den var för sig. Den som ändrar beteendet ändrar
         * texten på samma ställe.
         *
         * Efter etiketten, inte inuti den. Ett `<p>` i en `<label>` bryter
         * etikettens innehållsmodell, och värre: notens text läckte in i fältets
         * tillgängliga namn, så en skärmläsare läste vägran som en del av vad
         * fältet *heter*. Kopplingen går via `aria-describedby` i stället —
         * noten beskriver fältet, den döper det inte.
         */
        if (!shaped.dataset.shapeNoteId) {
          const note = document.createElement("p");

          note.id = `shape-note-${++this.shapeNoteCounter}`;
          note.className = "guide-preview__shape-note";
          note.setAttribute("data-shape-note", "");
          note.setAttribute("aria-live", "polite");
          (shaped.closest("label") ?? shaped).insertAdjacentElement("afterend", note);
          shaped.dataset.shapeNoteId = note.id;

          const described = shaped.getAttribute("aria-describedby");

          shaped.setAttribute(
            "aria-describedby",
            described ? `${described} ${note.id}` : note.id,
          );
        }

        let pause = 0;

        const clearNote = (): void => {
          const note = this.shapeNoteFor(shaped);

          if (note && note.textContent !== "") {
            note.textContent = "";
          }
        };

        const refused = (): void => {
          window.clearTimeout(pause);
          pause = window.setTimeout(() => sayRefused(shaped), PAUSE);
        };
      /**
       * What the field would hold if the browser were allowed to do this edit.
       *
       * Worked out here rather than read afterwards, because the whole point is
       * to get in front of the change: once the browser has applied it, the only
       * way to correct it is to assign `value`, and that is what kills undo.
       */
      const after = (
        event: InputEvent,
      ): { raw: string; caret: number; natural: string } | "ambiguous" | null => {
        const from = shaped.selectionStart ?? shaped.value.length;
        const to = shaped.selectionEnd ?? from;
        const before = shaped.value;

        switch (event.inputType) {
          case "insertText":
          case "insertFromPaste":
          case "insertFromDrop": {
            const text =
              event.data ?? event.dataTransfer?.getData("text/plain") ?? "";

            /*
             * A paste that replaces the whole field may carry a label — people
             * copy the line, not the value — and for a mixed shape the label's
             * letters are indistinguishable from the number's. So the format is
             * asked to find itself inside what was pasted.
             *
             * Only when it replaces everything: pasting into the middle of
             * something half-typed is not a labelled value, and searching there
             * would throw away what somebody had already written.
             */
            const wholeField = from === 0 && to === before.length;
            const found =
              event.inputType !== "insertText" && wholeField
                ? findInPasted(shaped.dataset.format, shaped.dataset.mask, text)
                : null;

            if (found?.outcome === "one") {
              return { raw: found.value, caret: found.value.length, natural: found.value };
            }

            /*
             * Two genuine values — "Sökande 19560328-1949, medsökande
             * 19800223-7538" out of a case line — and no way to know which was
             * meant. Shaping the first twelve digits stores the wrong person's
             * number, silently and green. Refusing sends somebody back to the
             * source, the one place where the words around the numbers still
             * say whose is whose.
             */
            if (found?.outcome === "many") {
              return "ambiguous";
            }

            const raw = before.slice(0, from) + text + before.slice(to);

            return { raw, caret: from + text.length, natural: raw };
          }

          case "deleteContentBackward": {
            if (from !== to) {
              const raw = before.slice(0, from) + before.slice(to);

              return { raw, caret: from, natural: raw };
            }

            /*
             * Backspace over a separator takes the digit behind it as well.
             * Otherwise the mask puts the separator straight back and the field
             * looks frozen — which is what the old `deletingSeparator` flag was
             * for. Here it is a decision rather than a flag, because in
             * `beforeinput` we still know what is about to happen.
             */
            const eats = /\D/.test(before[from - 1] ?? "") ? 2 : 1;
            const at = Math.max(0, from - eats);

            return {
              raw: before.slice(0, at) + before.slice(from),
              caret: at,
              /*
               * What the browser would do left alone: take one character. When
               * that differs from what we want, the early return below must not
               * fire — it assumes letting the browser proceed produces `raw`,
               * and here it would not. That is what made a backspace over the
               * separator delete only the separator and leave the field looking
               * frozen.
               */
              natural: before.slice(0, Math.max(0, from - 1)) + before.slice(from),
            };
          }

          case "deleteContentForward": {
            const at = from === to ? from + 1 : to;
            const raw = before.slice(0, from) + before.slice(at);

            return { raw, caret: from, natural: raw };
          }

          default:
            return null;
        }
      };

      shaped.addEventListener("beforeinput", (event) => {
        const intent = after(event as InputEvent);

        if (!intent) {
          return;
        }

        if (intent === "ambiguous") {
          event.preventDefault();

          /*
           * Said at once, not after the PAUSE: the debounce exists so typing is
           * not corrected keystroke by keystroke, and a paste is one event. The
           * pending refusal is cancelled too — this message explains the same
           * gesture and must not be overwritten 700 ms later.
           */
          window.clearTimeout(pause);

          const note = this.shapeNoteFor(shaped);

          if (note) {
            note.textContent = this.chrome("field.pasteAmbiguous");
          }

          return;
        }

        /*
         * The author's own pattern wins over the named format's, which is what
         * makes an identifier we have no arithmetic for shapeable at all: a
         * Swedish personnummer knows its own form, an American social security
         * number has to be told.
         */
        const masked = shaped.dataset.group !== undefined
          ? maskGrouped(intent.raw, intent.caret, this.activeLocaleValue)
          : shaped.dataset.mask
            ? maskWithPattern(shaped.dataset.mask, intent.raw, intent.caret)
            : maskFormat(shaped.dataset.format, intent.raw, intent.caret);

        if (masked.value === intent.raw && intent.raw !== intent.natural) {
          // Vi avvek från webbläsarens standard, men inget kastades bort.
          clearNote();
        } else if (masked.value.length < intent.raw.length) {
          refused();
        } else {
          clearNote();
        }

        if (masked.value === intent.natural) {
          /*
           * Compared against what the browser would do on its own, not against
           * what we worked out: the two differ whenever we deviate from the
           * default. Letting it proceed is right only when its own result is
           * already the shaped one — then we touch nothing and its undo history
           * stays whole for free.
           */
          return;
        }

        event.preventDefault();

        /*
         * Through the editing pipeline, not by assigning `value`.
         *
         * Measured: assigning it destroys the browser's undo history — after one
         * press of Ctrl+Z the field freezes and nothing further happens, where an
         * unmasked field empties in one. Replacing the whole value through
         * `execCommand` keeps the edit in that history, and two presses empty a
         * masked field.
         *
         * `execCommand` is formally deprecated and there is no replacement: no
         * other API writes into the undo stack. It is kept deliberately — please
         * do not "modernise" this without measuring undo first.
         */
        shaped.setSelectionRange(0, shaped.value.length);
        document.execCommand("insertText", false, masked.value);

        /*
         * Checked by the outcome, never by the return value: `execCommand`
         * answers `true` even when it did nothing at all — measured against an
         * input that was not focused. If it ever becomes a no-op, this is what
         * notices, and the field still gets its shape; only undo goes back to
         * being broken.
         */
        if (shaped.value !== masked.value) {
          shaped.value = masked.value;
        }

        shaped.setSelectionRange(masked.caret, masked.caret);
        carryCanonical(shaped);
      });

      /*
       * The second way a value arrives: not typed.
       *
       * `beforeinput` never fires for a programmatic assignment, so autofill, a
       * password manager and a paste driven by script all bypass the handler
       * above — and the shape simply stopped appearing for them. Measured when
       * this rewrite landed: three existing tests went from a shaped value to a
       * raw one, all of them setting the value rather than typing it.
       *
       * Not "a host setting the field": no host flow assigns `value` on the
       * input — the SiteVision module writes only its own hidden fields, and the
       * viewer's inputs sit in a shadow root it never reaches. A host's answers
       * come through `given` (story 085) and are rendered into the value, which
       * the mount-time shaping above covers. What goes wrong when a value
       * arrives silently is handled where it matters, at collection: see
       * `canonicalOf`.
       *
       * So this catches what the other path could not see. Assigning `value` is
       * right here: there is no user edit to keep out of the undo history,
       * because nobody edited anything.
       */
      shaped.addEventListener("input", () => {
        /*
         * The caret where it actually is, not at the end. Assuming the end is
         * right for an autofill and wrong for everything else — it put the
         * cursor after the whole value when somebody typed into the middle, which
         * is the exact fault the shaping was built to avoid.
         */
        const caret = shaped.selectionStart ?? shaped.value.length;
        /*
         * Grouped amounts too. This path handled `mask` and `format` and not
         * `group`, so an autofilled amount stayed as an unbroken run of digits
         * while a typed one was grouped — the same field looking different
         * depending on how the value arrived.
         *
         * Measured after the locale work landed: what is *stored* was already
         * right (`1234567`), so this is the display catching up, not a data
         * fix.
         */
        const masked = shaped.dataset.group !== undefined
          ? maskGrouped(shaped.value, caret, this.activeLocaleValue)
          : shaped.dataset.mask
            ? maskWithPattern(shaped.dataset.mask, shaped.value, caret)
            : maskFormat(shaped.dataset.format, shaped.value, caret);

        if (masked.value === shaped.value) {
          return;
        }

        shaped.value = masked.value;
        shaped.setSelectionRange(masked.caret, masked.caret);
        carryCanonical(shaped);
      });

      // Också när inget behövde formas om: värdet ändrades ändå.
      shaped.addEventListener("input", () => carryCanonical(shaped));
    });

    this.root
      .querySelector<HTMLInputElement>("[data-number-answer]")
      ?.addEventListener("input", (event) => {
        const input = event.currentTarget as HTMLInputElement;

        // Dölj valideringsbeskedet medan man skriver – det visas på blur.
        this.setFieldValidity(
          input,
          this.root.querySelector<HTMLElement>("[data-number-validation]"),
          null
        );
      });

    // Spöket i datumfältet släcks så snart fältet bär ett värde — se
    // kommentaren vid renderingen (design A, 31/8).
    {
      for (const dateInput of this.root.querySelectorAll<HTMLInputElement>('input[type="date"]')) {
        const ghost = dateInput
          .closest<HTMLElement>(".guide-preview__date")
          ?.querySelector<HTMLElement>("[data-date-ghost]");

        if (!ghost) continue;
        /*
         * Tomt OCH oberört: då visas vårt spöke och plattformens egen text
         * döljs (klassen + color: transparent i stilen) — Chromium ritar
         * annars sina segment (mm/dd/yyyy) rakt under spöket, mätt i
         * mobilemulerad skärmbild. Vid fokus byter de plats: man skriver i
         * plattformens segment, och ett spöke ovanpå dem vore två sanningar
         * på samma rad.
         */
        const toggle = (): void => {
          const focused = this.root.activeElement === dateInput;

          ghost.hidden = focused || dateInput.value !== "";
          dateInput.classList.toggle("guide-preview__date-empty", dateInput.value === "");
        };

        dateInput.addEventListener("input", toggle);
        dateInput.addEventListener("change", toggle);
        dateInput.addEventListener("focus", toggle);
        dateInput.addEventListener("blur", toggle);
      }
    }

    // Validera först när sifferfältet lämnas, likt textfältet.
    this.root
      .querySelector<HTMLInputElement>("[data-number-answer]")
      ?.addEventListener("blur", (event) => {
        const input = event.currentTarget as HTMLInputElement;
        this.setFieldValidity(
          input,
          this.root.querySelector<HTMLElement>("[data-number-validation]"),
          this.numberFieldError(input)
        );
      });

    /*
     * A chosen file: checked here, then handed to the host.
     *
     * The cheap refusals happen before anything travels — a file of the wrong
     * type or over the limit never leaves the browser, and the message is ours
     * to word in both languages. What the host does after that is theirs; we
     * keep only the reference they hand back.
     */
    this.root.querySelectorAll<HTMLInputElement>("[data-file-field]").forEach((input) => {
      this.restoreHeldFile(input);
      input.addEventListener("change", () => {
        void this.handleFileChosen(input);
      });
    });
    // *Välj fil* opens the browser's own dialog on the input it stands for (punkt 11).
    this.root.querySelectorAll<HTMLButtonElement>("[data-file-pick]").forEach((button) => {
      button.addEventListener("click", () => {
        this.root
          .querySelector<HTMLInputElement>(`input[data-file-field="${CSS.escape(button.dataset.filePick ?? "")}"]`)
          ?.click();
      });
    });

    this.wireProvingFiles();
    this.wireExampleFiles();
    this.wireMarkingAreas();

    this.root.querySelectorAll<HTMLInputElement>("[data-page-variable]").forEach((input) => {
      const updatePage = (): void => {
        this.updatePageFieldVisibility();
        this.refreshPageFieldErrors();
        this.shareDraft();
      };
      input.addEventListener("input", updatePage);
      input.addEventListener("change", updatePage);
    });
    this.wireNumberControls();

    this.root
      .querySelector<HTMLDetailsElement>("[data-variable-inspector]")
      ?.addEventListener("toggle", (event) => {
        this.variableInspectorOpen = (event.target as HTMLDetailsElement).open;
      });

    this.root
      .querySelector<HTMLInputElement | HTMLTextAreaElement>("[data-text-answer]")
      ?.addEventListener("input", (event) => {
        const input = event.currentTarget as
          | HTMLInputElement
          | HTMLTextAreaElement;
        const maxAttr = input.getAttribute("data-char-max");
        const max = maxAttr ? Number(maxAttr) : null;
        const counter = this.root.querySelector<HTMLElement>("[data-char-counter]");
        if (counter) {
          const state = this.charCounterState(input.value.length, max);
          counter.textContent = state.text;
          counter.classList.remove(
            "guide-preview__char-counter--near",
            "guide-preview__char-counter--over"
          );
          if (state.modifier) {
            counter.classList.add(`guide-preview__char-counter--${state.modifier}`);
          }
        }

        // Dölj valideringsbeskedet medan man skriver – det visas på blur.
        const validation = this.root.querySelector<HTMLElement>(
          "[data-text-validation]"
        );
        this.setFieldValidity(input, validation, null);
      });

    // Validate only once the field is left, so nobody is nagged per keystroke.
    this.root
      .querySelector<HTMLInputElement | HTMLTextAreaElement>("[data-text-answer]")
      ?.addEventListener("blur", (event) => {
        const input = event.currentTarget as
          | HTMLInputElement
          | HTMLTextAreaElement;
        const validation = this.root.querySelector<HTMLElement>(
          "[data-text-validation]"
        );
        this.setFieldValidity(input, validation, this.textFieldError(input));
      });

    this.restoreLookupChoices();
    this.bindChoicePicker();
    this.bindExclusiveBoxes();

    this.root
      .querySelector<HTMLButtonElement>('[data-action="next"]')
      ?.addEventListener("click", () => this.next());

    this.root
      .querySelector<HTMLButtonElement>('[data-action="previous"]')
      ?.addEventListener("click", () => this.previous());

    this.root
      .querySelector<HTMLButtonElement>('[data-action="restart"]')
      ?.addEventListener("click", () => this.restart());

    this.root
      .querySelector<HTMLButtonElement>('[data-action="repeat-add"]')
      ?.addEventListener("click", () => this.repeatAdd());
    this.root
      .querySelectorAll<HTMLButtonElement>('[data-action="repeat-remove"]')
      .forEach((button) => {
        button.addEventListener("click", () => this.repeatRemove(Number(button.dataset.repeatIndex)));
      });
  }

  /**
   * Ger ett flervärt uppslag tillbaka sina val efter en omritning.
   *
   * Som egenskap och inte som attribut: ett attribut är en sträng, och en
   * sträng är precis den kodning det här ersätter. Paren — etikett och kod
   * tillsammans — är ETT värde hela vägen från motorns svar till fältet.
   *
   * Hittat av Johan på en iPad: man backade och etiketterna var borta. Motorn
   * hade inte tappat något; kontrollen byggde bara inte upp sig igen.
   */
  private restoreLookupChoices(): void {
    for (const field of this.root.querySelectorAll<LookupPicker>(
      "chip-picker[data-text-lookup]",
    )) {
      const name =
        field.getAttribute("data-page-variable")
        ?? (this.engine?.getCurrentNode()?.data.variableName as string | undefined);
      /*
       * A picker in a repeating page (story 084) reads its own record, not
       * the flat answers — a record's fields are never stored under their
       * own names. The records come from `repeatRecords`, so the draft that
       * *Lägg till* just rendered counts, not only what the engine kept.
       */
      const group = field.closest<HTMLElement>("[data-repeat-group]");
      const repeat = group ? this.pageRepeat(this.engine?.getCurrentNode()) : null;
      const stored = !name
        ? undefined
        : group && repeat
          ? this.repeatRecords(repeat, this.prefill())[Number(group.dataset.repeatGroup)]?.[name]
          : this.pageAnswers()[name];

      if (stored === undefined) continue;

      /*
       * One value or several: a single lookup stores the pair on its own, a
       * multiple one stores a list of them. Both come back as chips, because
       * the merged control shows the single choice as a chip too.
       */
      const pairs = (Array.isArray(stored) ? stored : [stored]).filter(
        (one): one is Record<string, string> => typeof one === "object" && one !== null,
      );

      /*
       * Flaggan hämtas tillbaka ur källan, för den finns inte i svaret.
       *
       * Ett lagrat uppslagssvar är etikett och kod. Utan den här raden kom
       * *Statslös* tillbaka som ett vanligt val efter ett steg fram och
       * tillbaka, och nästa land lade sig bredvid det — mätt, inte anat.
       */
      const source = this.guideGraph()?.nodes.find(
        (candidate) => candidate.id === nodeIdOf(field.dataset.lookupNode ?? ""),
      );
      const alone = source ? LookupService.standsAlone(source) : new Set<string>();

      const restored = pairs.map((one) => ({
        label: one.label ?? "",
        value: one.value ?? "",
        ...(alone.has(one.value ?? "") ? { exclusive: true } : {}),
      }));

      field.choices = restored.filter((one) => one.label !== "" && one.value !== "");

      /*
       * Fri text kommer tillbaka som TEXT, inte som en etikett.
       *
       * Ett svar utan kod är något besökaren skrev och inte valde — så det hör
       * hemma i rutan, som det stod. Gamla fältet fick det gratis genom sitt
       * `value`-attribut; utan den vägen såg steget tomt ut medan Nästa var
       * påslagen, och nästa "vidare" skrev över svaret med tomt. Ett svar man
       * aldrig ändrat försvann genom att man tittat på det.
       */
      const freeText = field.hasAttribute("single")
        ? restored.find((one) => one.value === "")?.label ?? ""
        : "";

      if (freeText !== "") field.text = freeText;
    }
  }

  /**
   * Kryssrutornas ersättningsregel, och raden som säger varför.
   *
   * Samma regel som `chip-picker` bär, och samma KOD: den bor i
   * `core/exclusive-choice.ts` och anropas från båda. Ytorna kan inte låna
   * varandras kontroll — den ena är ett eget element med sin egen skuggrot
   * och en lista av par, den andra är markup med `<input>` som bär läget —
   * men det de delar är inte en kontroll utan en REGEL, och en regel skriven
   * två gånger är den här kodbasens äldsta fel.
   *
   * Det som skiljer ytorna åt är alltså bara hur man läser vad som är valt
   * och hur man skriver tillbaka det.
   *
   * `change` och inte `click`: ett mellanslag på en fokuserad kryssruta ger
   * ingen klickhändelse på alla plattformar, och tangentbordet är den vägen
   * in som alltid finns (praxis 17).
   */
  private bindExclusiveBoxes(): void {
    const boxes = [
      ...this.root.querySelectorAll<HTMLInputElement>('input[name="guide-preview-multi"]'),
    ];

    if (boxes.length === 0) return;

    const status = this.root.querySelector<HTMLElement>("[data-multi-status]");

    for (const box of boxes) {
      box.addEventListener("change", () => {
        if (status) status.textContent = "";

        // Att kryssa UR tar aldrig bort något annat: ett svar färre kan inte
        // göra svaret motsägelsefullt, och besökaren hör sin egen växling.
        if (!box.checked) return;

        const alone = box.hasAttribute("data-exclusive");
        const { gone } = displacedBy(
          boxes.filter((other) => other !== box && other.checked),
          alone,
          (other) => other.hasAttribute("data-exclusive"),
        );

        for (const other of gone) other.checked = false;

        if (gone.length === 0 || !status) return;

        const label = (input: HTMLInputElement): string =>
          input.parentElement?.querySelector("span")?.textContent?.trim() ?? input.value;
        const n = boxes.filter((one) => one.checked).length;
        const said = n === 1
          ? this.chrome("choice.addedOne", { label: label(box) })
          : this.chrome("choice.added", { label: label(box), n: String(n) });
        const removed = gone.map(label).join(", ");

        status.textContent = `${said} ${
          alone
            ? this.chrome("choice.exclusiveCleared", { removed })
            : this.chrome("choice.exclusiveRemoved", { removed })
        }`;
      });
    }
  }

  /** Nollställer flervalslistan när visaren byter fråga eller startar om. */
  private resetChoiceDraft(): void {
    this.choiceDraft = null;
  }

  /**
   * Fyller flervalslistan och tar emot vad den säger.
   *
   * Alternativen och orden kommer härifrån; sök, fokus och uppläsning bor i
   * kontrollen. Utkastet är nodens id plus valen: motorn lagrar ett svar först
   * när man går vidare, men etiketterna måste ändras i samma ögonblick man
   * klickar — annars ser kontrollen trasig ut.
   */
  private bindChoicePicker(): void {
    const picker = this.root.querySelector<HTMLElement & {
      options: Array<{ label: string; value: string }>;
      value: string[];
      strings: Record<string, string>;
    }>("[data-choice-picker]");
    const node = this.engine?.getCurrentNode();

    if (!picker || !node) return;

    /*
     * Enkelvalet bär alternativets ID, flervalet dess värde.
     *
     * Det är inte en inkonsekvens utan två olika frågor: ett enkelval förgrenar,
     * och det är id:t som pekar ut vägen vidare — samma sak rullgardinen alltid
     * gjort. Ett flerval går en väg oavsett, så där är värdet svaret.
     */
    const single = picker.hasAttribute("single");
    // Story 134: samma lista som ritas i kortet — ett dolt alternativ finns
    // inte att välja i kontrollen heller.
    const alternativ = QuestionOptionsService.getOptions(node, this.getAnswers());
    const options = alternativ.map((option) => ({
      label: this.localized(option.label),
      value: single ? option.id : option.value,
    }));
    const variableField = getNodeType(node.type)?.behavior?.answer.variableField;
    const variableName = variableField ? node.data[variableField] : undefined;
    const stored =
      typeof variableName === "string" ? this.prefill()[variableName] : undefined;
    const chosenIds = single
      ? alternativ
          .filter((option) => answerList(stored).includes(option.value))
          .map((option) => option.id)
      : /*
         * Bara det som fortfarande erbjuds. Ett val som blivit dolt (story
         * 134) skulle annars komma tillbaka som en pil för ett alternativ som
         * inte finns i listan bakom den.
         */
        answerList(stored).filter((value) =>
          alternativ.some((option) => option.value === value),
        );

    picker.strings = {
      search: this.chrome("choice.searchPlaceholder"),
      searchLabel: this.chrome("choice.search"),
      empty: this.chrome("choice.chosenNone"),
      remove: this.chrome("choice.remove", { label: "{label}" }),
      added: this.chrome("choice.added", { label: "{label}", n: "{n}" }),
      addedOne: this.chrome("choice.addedOne", { label: "{label}" }),
      removed: this.chrome("choice.removed", { label: "{label}", n: "{n}" }),
      removedOne: this.chrome("choice.removedOne", { label: "{label}" }),
      count: this.chrome("choice.left", { n: "{n}" }),
      oneLeft: this.chrome("choice.oneLeft"),
      matches: this.chrome("choice.matches", { n: "{n}" }),
      oneMatch: this.chrome("choice.oneMatch"),
      noMatches: this.chrome("choice.noMatches", { term: "{term}" }),
      allChosen: this.chrome("choice.allChosen"),
      or: this.chrome("choice.or"),
      exclusiveCleared: this.chrome("choice.exclusiveCleared", { removed: "{removed}" }),
      exclusiveRemoved: this.chrome("choice.exclusiveRemoved", { removed: "{removed}" }),
    };
    picker.options = options;
    picker.value =
      this.choiceDraft?.nodeId === node.id ? this.choiceDraft.values : chosenIds;

    picker.addEventListener("chip-change", (event) => {
      const values = (event as CustomEvent<{ value: string[] }>).detail.value;

      this.choiceDraft = { nodeId: node.id, values };

      /*
       * Nästa-knappen öppnas av valet, som radioknapparnas och rullgardinens
       * gör. Utan det stod ett val som etikett bredvid en spärrad knapp — och
       * ingenting sa varför, för valet ju var gjort. Hittat genom att mäta:
       * kontrollen bar rätt värde, svaret blev ändå aldrig lagrat.
       */
    });
  }

}

if (!customElements.get("guide-preview")) {
  customElements.define("guide-preview", GuidePreview);
}

declare global {
  interface HTMLElementTagNameMap {
    "guide-preview": GuidePreview;
  }
}

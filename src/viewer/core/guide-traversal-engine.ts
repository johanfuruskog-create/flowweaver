import { answerList, answerText, isAnswerEmpty, isAnswerFields, isAnswerRecord, type AnswerRecord, type AnswerValue, type Answers } from "./answer-values";
import { PageFieldsService, type PageField } from "../services/page-fields-service";
import { ArrivalValueService } from "../services/arrival-value-service";
import { PageRepeatService, type PageRepeat } from "../services/page-repeat-service";
import { CalculationService } from "../services/calculation-service";
import { ServiceCallService } from "../services/service-call-service";
import { QuestionVariableService } from "../services/question-variable-service";
import { RatingScaleService } from "../services/rating-scale-service";
import { QuestionOptionsService } from "../services/question-options-service";
import type { FlowNodeData, GraphData, QuestionOption } from "../types/graph";
import { evaluateRule } from "./rule-evaluator";
import { SOURCE_LOCALE, getSourceLocale, isLocalizedTextMap, resolveText } from "./localized-text";
import { getNodeType } from "../node-types/node-type-registry";
import { dateBoundVariable, resolveDateBound, validateDate } from "./date-validator";
import { isRealDate, TODAY_VARIABLE, todayIso } from "./date-math";
import { validateFormat } from "./format-validators";
import { interpolate, t } from "./ui-strings";

import type { NodeBehavior } from "../types/node-types";

export type GuideTraversalErrorCode =
  | "missing-start-node"
  | "current-node-missing"
  | "current-node-not-question"
  | "unknown-option"
  | "missing-connection"
  | "target-node-missing"
  | "invalid-rule"
  | "rule-cycle";

export interface GuideTraversalError {
  code: GuideTraversalErrorCode;
  /**
   * The Swedish sentence — unchanged from before `code` and `params` existed,
   * so a consumer that only ever read `.message` keeps working exactly as it
   * did (the engine's own tests are the proof: they assert this string).
   */
  message: string;
  /**
   * The values the localised text needs to interpolate (a node id, an
   * option, a port …) — the minimum a viewer needs to render the message in
   * the guide's own language instead of `message`'s Swedish.
   */
  params?: Record<string, string | number>;
}

export type GuideTraversalResult =
  | { success: true; node: FlowNodeData }
  | { success: false; error: GuideTraversalError };

/**
 * What the caller knows that the values alone do not say (story 118).
 *
 * `touched` is the variable names the visitor CHANGED while the node was on
 * screen. Only the side drawing the fields can know that, and it is worth
 * knowing only until Next is pressed, so it is passed in per call rather than
 * held anywhere. Leaving it out is today's behaviour: see `untouched`.
 */
export interface AnswerOptions {
  touched?: ReadonlySet<string>;
}

export interface GuideAnswerRecord {
  questionId: string;
  variableName: string | null;
  questionTitle: string;
  optionId: string;
  optionLabel: string;
  /** The answer as stored: one value, several, or several with parts. */
  value: AnswerValue;
}

function isQuestionOption(value: unknown): value is QuestionOption {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "label" in value &&
    (typeof value.label === "string" || isLocalizedTextMap(value.label)) &&
    "value" in value &&
    typeof value.value === "string"
  );
}

export class GuideTraversalEngine {
  private readonly graph: GraphData;
  private currentNodeId: string | null;
  private answers: Answers = {};
  /**
   * What the visitor wrote on steps behind a rewind (`goBackToQuestion`,
   * `previous`), kept to fill the fields in when they are shown again — never
   * part of the run. See `getPrefill`.
   */
  private remembered: Answers = {};

  /** Set by `answerValue` and cleared by `commitAnswer`. */
  private pendingExtraVariables: Answers = {};
  private answerRecords: GuideAnswerRecord[] = [];
  private history: Array<{
    nodeId: string;
    answers: Answers;
    answerRecords: GuideAnswerRecord[];
    optionId: string;
    traversedConnectionIds: string[];
  }> = [];
  private selectedOptionId: string | null = null;
  /** The connections traversed during the run, in order. */
  private traversedConnectionIds: string[] = [];
  /**
   * When true, service nodes are not passed automatically — the engine stops at
   * them so a BFF can make the real call and then invoke `advanceServiceCall`.
   * When false (the default) the mock runs synchronously, which works in the
   * editor, the preview and on GitHub Pages.
   */
  private readonly deferServiceCalls: boolean;
  /** The language end-user texts (validation messages) are shown in. */
  private locale: string;
  /**
   * The run's "today", `YYYY-MM-DD`. The host may set it (story 086, AC 5) —
   * a test, or *Prova guiden* over a New Year — otherwise the clock, read
   * once, so a run that straddles midnight does not change its mind.
   */
  private readonly today: string;

  constructor(
    graph: GraphData,
    options?: { deferServiceCalls?: boolean; locale?: string; today?: string }
  ) {
    this.graph = structuredClone(graph);
    this.currentNodeId = this.graph.startNodeId;
    this.deferServiceCalls = options?.deferServiceCalls ?? false;
    this.locale = options?.locale ?? SOURCE_LOCALE;
    this.today = options?.today && isRealDate(options.today) ? options.today : todayIso();
    this.answers = this.stamped({});
  }

  /**
   * `idag` is the engine's, whatever came in. It is kept beside the answers
   * so that a text (`{{idag}}`), a formula (`days(flytt; idag)`) and a date
   * bound (`min: "idag"`) all read the one day through the one lookup — and
   * it is re-stamped on every way answers enter from outside, so a run
   * saved last week and handed back does not carry last week's date.
   */
  private stamped(answers: Answers): Answers {
    return { ...answers, [TODAY_VARIABLE]: this.today };
  }

  /** Switch the language of validation messages (e.g. when the preview does). */
  setLocale(locale: string): void {
    this.locale = locale;
  }

  /**
   * Localised chrome text — a validation message, and (since 2026-08-31) a
   * structural failure too: a missing start step, a dangling connection, a
   * cycle among the auto-advancing nodes. The registry (`viewer-strings.ts`)
   * is the one home for the sentence in every language, Swedish included —
   * so the engine's own tests, which never set `locale`, assert the Swedish
   * that lives there, and stay green only because that text matches. That is
   * the proof the registry and the literal it replaced still agree, not an
   * assumption of it.
   */
  private text(key: string, params?: Record<string, string | number>): string {
    const resolved = t(key, this.locale);
    return params ? interpolate(resolved, params) : resolved;
  }

  /**
   * The guide's own text — a question title, an option label — in the
   * language the visitor reads. It lands in the answer records, which the
   * review, the receipt and the submission all show back; resolved without
   * the locale (as it was until 2026-09-05) a guide read in English reviewed
   * in Swedish. The page fields had been fixed the day before; this is the
   * same fault in the question nodes' code path.
   */
  private label(value: unknown, fallback = ""): string {
    return resolveText(value, this.locale, fallback, getSourceLocale(this.graph));
  }

  getGraph(): GraphData {
    return structuredClone(this.graph);
  }

  getCurrentNode(): FlowNodeData | null {
    const node = this.findCurrentNode();

    return node ? structuredClone(node) : null;
  }

  getCurrentResult(): GuideTraversalResult {
    if (this.currentNodeId === null) {
      return this.failure(
        "missing-start-node",
        this.text("flow.missingStartNode")
      );
    }

    const node = this.findCurrentNode();

    if (!node) {
      return this.failure(
        "current-node-missing",
        this.text("flow.currentNodeMissing", { nodeId: this.currentNodeId }),
        { nodeId: this.currentNodeId }
      );
    }

    return { success: true, node: structuredClone(node) };
  }

  /**
   * The visitor's answers. `idag` is the engine's (story 086) and is not
   * among them: a host saving a run, a submission, a test comparing what
   * was answered — none of them should carry a clock reading that changes
   * tomorrow. What a text or a rule sees is `getScope()`.
   */
  getAnswers(): Answers {
    const { [TODAY_VARIABLE]: _today, ...answers } = structuredClone(this.answers);
    return answers;
  }

  /**
   * The values to fill a step's fields with: the run's answers, and behind
   * them what was written on steps the visitor has gone back over
   * (2026-09-06). The two were one until then, and it held for the field but
   * not for the submission: a value typed on a branch the visitor then left
   * stayed in `getAnswers()`, which is what a submission sends and a result's
   * `{{variabler}}` read. Now the run carries only what has been walked; this
   * is what the field remembers. Passing the step again writes the value
   * back into the run — through the field, the way any answer enters.
   */
  getPrefill(): Answers {
    return { ...structuredClone(this.remembered), ...this.getAnswers() };
  }

  /** The answers as a text, a rule or a formula sees them: with `idag`. */
  getScope(): Answers {
    return structuredClone(this.answers);
  }

  getAnswerRecords(): GuideAnswerRecord[] {
    return structuredClone(this.answerRecords);
  }

  getSelectedOptionId(): string | null {
    return this.selectedOptionId;
  }

  getStepNumber(): number {
    return this.history.length + 1;
  }

  /**
   * Puts answers in without moving — for a picture of a step, not for a run.
   *
   * Story 065 draws a step the run has already been through on the canvas, with
   * the answer still in its field. That drawing is a *picture*: its own engine
   * holds one node and decides nothing, and this is how it is told what was
   * answered. The position, the history and the trail are untouched, so it
   * cannot be mistaken for a way to move a run along.
   */
  seedAnswers(answers: Answers): void {
    this.answers = this.stamped(structuredClone(answers));
  }

  getTraversedConnectionIds(): string[] {
    return [...this.traversedConnectionIds];
  }

  restart(): GuideTraversalResult {
    this.currentNodeId = this.graph.startNodeId;
    this.answers = this.stamped({});
    this.remembered = {};
    this.answerRecords = [];
    this.history = [];
    this.selectedOptionId = null;
    this.traversedConnectionIds = [];

    return this.getCurrentResult();
  }

  goToNode(nodeId: string): GuideTraversalResult {
    const node = this.graph.nodes.find((candidate) => candidate.id === nodeId);

    if (!node) {
      return this.failure(
        "current-node-missing",
        this.text("flow.nodeMissing", { nodeId }),
        { nodeId }
      );
    }

    if (this.currentNodeId !== node.id) {
      this.currentNodeId = node.id;
      this.history = [];
      this.selectedOptionId = null;
      this.traversedConnectionIds = [];
    }

    return { success: true, node: structuredClone(node) };
  }

  /**
   * *Has a value* and *has answered* are two different things (story 118,
   * criterion 7).
   *
   * A field can arrive carrying something nobody chose: a start value the
   * redaktör typed, or a slider standing at `min` because a thumb has to be
   * somewhere. Read off the value alone those are indistinguishable from an
   * answer, so a required field could be walked past by somebody who never
   * looked at it — which is exactly what Johan objected to when the slider's
   * price was measured.
   *
   * Three things have to hold, and the middle one is what keeps the axis
   * cheap: the field asks for it, THE ENGINE HAS NOTHING OF THE VISITOR'S for
   * the variable (so what is on screen is an arrival picture and not something
   * they gave), and the viewer did not see them change it.
   *
   * **`remembered` and not only `answers`, measured 15/9 after QA found the
   * fault.** Going back rewinds `answers` to the state before the page and
   * moves what they held into `remembered` — so one step back emptied the only
   * place this rule looked, and a field the visitor had already filled in
   * refused them a second time on the way forward. The prefill is the honest
   * question: *has this visitor given this answer at any point?* Which is also
   * why nothing has to be compensated for at the call sites.
   *
   * Which is also why nothing here is written down. *Touched* only has to
   * exist while the visitor stands on the node; press Next and the value is an
   * answer like any other. No new record, no change to `Answers`, nothing in
   * the submission (K6d, K6e untouched).
   *
   * **The slider needs no code of its own.** Its `min` is an arrival value
   * like the start value, so a required slider with the setting on no longer
   * arrives satisfied, and a drag writes into the field, which is what the
   * viewer counts as a change. Criterion 4 holds: one mechanism, not two.
   *
   * **And the value itself answers most of it.** The engine knows what the
   * field shows on arrival — `ArrivalValueService` is right here — so a value
   * handed in that DIFFERS from it was changed by somebody, whatever any set
   * says. Measured 15/9: without this, seven walkthroughs of the bundled
   * guides were refused while handing in a date that was plainly not the one
   * the field started on.
   *
   * What is left for `touched` is the one thing a value cannot show: somebody
   * who changed the field and changed it back, or who wants exactly the number
   * that was already there. That is the dialog's case, and the only one.
   *
   * So a host driving the engine with no viewer and no set is refused only
   * when it hands in precisely the arrival value — which is the single case
   * the engine genuinely cannot tell from nobody having touched it.
   *
   * `submitted` left out keeps the old, stricter reading, for a caller that
   * has no value to show yet.
   */
  isUntouched(
    variableName: string,
    requires: boolean,
    touched?: ReadonlySet<string>,
    submitted?: string,
  ): boolean {
    return (
      requires &&
      variableName !== "" &&
      this.answers[variableName] === undefined &&
      this.remembered[variableName] === undefined &&
      !(touched?.has(variableName) ?? false) &&
      (submitted === undefined || submitted === this.arrivalValueOf(variableName))
    );
  }

  /**
   * What the field for this variable shows on arrival, as the field carries
   * it: `String(min)` for a slider, the redaktör's number as text, an ISO date
   * with "idag" and `{{variabel}}` already resolved.
   *
   * Through `ArrivalValueService` and not a reading of its own — the one
   * answer to *what does the field show on arrival?*, which the viewer fills
   * the page from. The answers so far go in with it, so a date start value
   * pointing at an earlier field resolves here exactly as it does on screen.
   */
  private arrivalValueOf(variableName: string): string | undefined {
    const node = this.graph.nodes.find(
      (candidate) => candidate.data.variableName === variableName,
    );

    if (!node) return undefined;

    const page = node.parentPageId
      ? this.graph.nodes.find((candidate) => candidate.id === node.parentPageId)
      : undefined;

    return page
      ? ArrivalValueService.forPage(this.graph.nodes, page, this.answers)[variableName] as
          | string
          | undefined
      : ArrivalValueService.startValueOf(node, this.answers);
  }

  answer(optionId: string): GuideTraversalResult {
    const currentResult = this.getCurrentResult();

    if (!currentResult.success) {
      return currentResult;
    }

    const currentNode = currentResult.node;

    if (currentNode.type !== "question") {
      return this.failure(
        "current-node-not-question",
        this.text("flow.nodeCannotBeAnswered", { nodeId: currentNode.id }),
        { nodeId: currentNode.id }
      );
    }

    /*
     * Only what this visitor was offered (story 134). An option held back by
     * its own condition was never drawn, so an id naming one can only come
     * from a stale form or a host driving the engine by hand — and both are
     * the same fault as an id that does not exist: *Alternativet … finns inte
     * på frågan*.
     */
    const options = QuestionOptionsService.visible(
      Array.isArray(currentNode.data.options)
        ? currentNode.data.options.filter(isQuestionOption)
        : [],
      this.answers,
    );
    const option = options.find((candidate) => candidate.id === optionId);

    if (!option) {
      // Same wording as the branching case below: `validation.optionMissing`
      // already says exactly this ("Alternativet ... finns inte på frågan"),
      // so it is reused rather than given a second key with the same text.
      return this.failure(
        "unknown-option",
        this.text("validation.optionMissing", { value: optionId }),
        { value: optionId }
      );
    }

    return this.commitAnswer(currentNode, option.id, this.label(option.label), option.value, option.id);
  }

  /**
   * @param extraVariables Additional variables to store alongside the answer.
   *   A lookup field stores both the label the user saw and the code behind it,
   *   and only the field knows the code — it is not present in `value`.
   */
  answerValue(
    value: AnswerValue,
    extraVariables: Answers = {},
    options: AnswerOptions = {},
  ): GuideTraversalResult {
    this.pendingExtraVariables = extraVariables;
    const currentResult = this.getCurrentResult();

    if (!currentResult.success) {
      return currentResult;
    }

    const currentNode = currentResult.node;

    // Declarative node types are interpreted generically from their behavior.
    const behavior = getNodeType(currentNode.type)?.behavior;
    if (behavior) {
      return this.answerDeclarative(currentNode, behavior, value, options);
    }

    return this.failure(
      "current-node-not-question",
      this.text("flow.noFreeTextAccepted", { nodeId: currentNode.id }),
      { nodeId: currentNode.id }
    );
  }

  /** Generisk hantering av en deklarativ nodtyp (se NodeBehavior). */
  private answerDeclarative(
    node: FlowNodeData,
    behavior: NodeBehavior,
    given: AnswerValue,
    // `answerOptions` and not `options`: the question's own options already
    // have that name a few lines down.
    answerOptions: AnswerOptions = {},
  ): GuideTraversalResult {
    const { answer, flow } = behavior;
    /*
     * Alla grenar utom det flervärda uppslaget arbetar på text — ett tal, ett
     * datum, ett valt alternativ. Den grenen tar `given` som det är, eftersom
     * dess svar ÄR paren.
     */
    const value = answerText(given);

    const numField = (name?: string): number | null =>
      name && typeof node.data[name] === "number"
        ? (node.data[name] as number)
        : null;
    const boolField = (name?: string): boolean =>
      Boolean(name && node.data[name] === true);
    /*
     * A date's bounds are strings, not numbers — an ISO date compares correctly
     * as text. Empty means no bound, so an empty setting reads as undefined
     * rather than as a bound nobody can meet.
     */
    const strField = (name?: string): string | undefined =>
      name && typeof node.data[name] === "string" && node.data[name] !== ""
        ? (node.data[name] as string)
        : undefined;

    /*
     * Before the per-input branches, so the number and the date on a step of
     * their own share the one rule a field on a page gets from `answerPage`.
     * `variableField` is where the name lives for every declarative type; a
     * type that has none cannot be asked for this, and `untouched` says so.
     */
    const ownName = answer.variableField
      ? node.data[answer.variableField]
      : undefined;
    if (
      this.isUntouched(
        typeof ownName === "string" ? ownName : "",
        node.data.requireInteraction === true,
        answerOptions.touched,
        value,
      )
    ) {
      return this.failure(
        "unknown-option",
        this.text("validation.fieldUntouched", {
          // The step's own heading names the field, the way the page's
          // message names it with the field's label.
          field: this.label(node.data.title) || strField("variableName") || "",
        }),
      );
    }

    const rawOptions = answer.optionsField
      ? node.data[answer.optionsField]
      : undefined;
    // Same as the branching path above: what the visitor was offered, not what
    // the question holds (story 134).
    const options = QuestionOptionsService.visible(
      Array.isArray(rawOptions) ? rawOptions.filter(isQuestionOption) : [],
      this.answers,
    );

    /*
     * Several values from a **searched** list, which the branch below cannot
     * handle: it checks each answer against a fixed set of options, and a lookup
     * has none — its values come from a code list or a service.
     *
     * So the count is checked and the answer is taken as given. What guards
     * against a value that is not in the list is the field itself, through
     * `allowFreeText`, in the same place it is guarded for a single lookup.
     */
    if (answer.cardinality === "multi" && answer.input === "lookup") {
      /*
       * Svaret kommer som paren — etikett och kod tillsammans, ett värde per
       * val. `answerList` läser etiketterna ur dem, vilket är det antalet
       * gäller: hur många val personen gjort.
       */
      const chosen = answerList(given);

      const required = boolField(answer.validation?.requiredField);
      const min = numField(answer.validation?.minField) ?? (required ? 1 : null);
      const max = numField(answer.validation?.maxField);

      if (min !== null && min > 0 && chosen.length < min) {
        return this.failure(
          "unknown-option",
          min === 1
            ? this.text("validation.selectAtLeastOne")
            : this.text("validation.selectAtLeast", { n: min }),
        );
      }

      if (max !== null && max > 0 && chosen.length > max) {
        return this.failure(
          "unknown-option",
          this.text("validation.selectAtMost", { n: max }),
        );
      }

      // And commit — the half a validation branch is easy to forget, and did
      // forget once already for dates.
      /*
       * Som lista, inte som en sträng med radbrytningar. Det var en lista som
       * låtsades vara ett värde, och varje läsare fick avkoda den själv — tio
       * handskrivna `split("\n")` med var sin uppfattning om tomma poster.
       */
      /*
       * Paren lagras som de är. Koderna skrivs vid samma tillfälle och ur
       * SAMMA värde, så de två variablerna inte kan glida isär — det var två
       * parallella listor som hölls i takt av index förut, och en förlorad
       * post på endera sidan hade fått en regel att testa fel lands kod.
       */
      return this.commitAnswer(
        node,
        "continue",
        chosen.join(", ") || this.text("preview.noAnswer"),
        given,
        "continue",
      );
    }

    if (answer.cardinality === "multi") {
      const validValues = new Set(options.map((option) => option.value));
      // Genom `answerList`, som kan alla former svaret kan komma i.
      const chosen = answerList(given).filter((entry) => validValues.has(entry));

      const required = boolField(answer.validation?.requiredField);
      const min = numField(answer.validation?.minField) ?? (required ? 1 : null);
      const max = numField(answer.validation?.maxField);

      if (min !== null && chosen.length < min) {
        return this.failure(
          "unknown-option",
          min === 1
            ? this.text("validation.selectAtLeastOne")
            : this.text("validation.selectAtLeast", { n: min })
        );
      }
      if (max !== null && chosen.length > max) {
        return this.failure(
          "unknown-option",
          this.text("validation.selectAtMost", { n: max })
        );
      }

      const label =
        chosen
          .map((entry) => {
            const option = options.find(
              (candidate) => candidate.value === entry
            );
            return option ? this.label(option.label) : entry;
          })
          .join(", ") || this.text("preview.noAnswer");

      if (flow.kind === "linear") {
        return this.commitAnswer(
          node,
          "continue",
          label,
          chosen.join("\n"),
          "continue"
        );
      }
    }

    // An information step without an answer: just move on via continue.
    if (answer.cardinality === "none" && flow.kind === "linear") {
      return this.commitAnswer(node, "continue", "", "", "continue");
    }

    if (answer.cardinality === "single") {
      // Branching single choice: value is the chosen option's id → its port.
      if (flow.kind === "branch") {
        const option = options.find((candidate) => candidate.id === value);
        if (!option) {
          return this.failure(
            "unknown-option",
            this.text("validation.optionMissing", { value })
          );
        }
        return this.commitAnswer(
          node,
          option.id,
          this.label(option.label),
          option.value,
          option.id
        );
      }

      // A linear number with numeric bounds.
      if (answer.input === "number") {
        const number = Number(value);
        const min = numField(answer.validation?.minField);
        const max = numField(answer.validation?.maxField);

        if (value.trim() === "" || !Number.isFinite(number)) {
          return this.failure(
            "unknown-option",
            this.text("validation.number.invalid")
          );
        }
        if (min !== null && number < min) {
          return this.failure(
            "unknown-option",
            this.text("validation.number.min", { n: min })
          );
        }
        if (max !== null && number > max) {
          return this.failure(
            "unknown-option",
            this.text("validation.number.max", { n: max })
          );
        }
        const normalized = String(number);
        return this.commitAnswer(
          node,
          "continue",
          normalized,
          normalized,
          "continue"
        );
      }

      // Linear text. `lookup` counts here: the value is text that happens to
      // have been picked from a list rather than typed, and validation,
      // variables and results all treat it the same. Without this line, lookup
      // answers fell through the whole function and the step could not be
      // left — silently, with no error.
      /*
       * A date on its own step, checked by the same function a date on a page
       * is — one rule, two callers. Before the text branch, because a date that
       * is not a date is a different fault from one that is too short.
       */
      if (answer.input === "date") {
        const required = boolField(answer.validation?.requiredField);

        if (required && value.trim().length === 0) {
          return this.failure("unknown-option", this.text("validation.required"));
        }

        /*
         * A bound that points at a variable (story 087) is read from the
         * answers so far — *från* one step back — and the message names that
         * field; a fixed date or "idag" goes through unchanged.
         */
        const earliest = strField(answer.validation?.minField);
        const latest = strField(answer.validation?.maxField);
        const dateError = validateDate(
          value,
          resolveDateBound(earliest, this.answers),
          resolveDateBound(latest, this.answers),
          {
            earliest: this.dateBoundLabel(earliest),
            latest: this.dateBoundLabel(latest),
          },
        );

        if (dateError) {
          return this.failure(
            "unknown-option",
            this.text(dateError.key, dateError.values),
          );
        }

        /*
         * And commit, which is the half a validation branch is easy to forget.
         *
         * Without this the answer was checked, found good, and then fell through
         * to "the node type is not supported yet" — the step simply would not
         * advance, with a message about the wrong thing entirely.
         */
        return this.commitAnswer(node, "continue", value || this.text("preview.noAnswer"), value, "continue");
      }

      /*
       * A rating (story 115): the answer is the step's PLACE, so a rule can ask
       * `betyg < 7` and a calculation can take an average.
       *
       * Two shapes come in, and the difference between them is the whole point.
       * A chosen step is its number as text, like every other number in a
       * guide. *Inte aktuellt* is a pair — the words the visitor read, and an
       * empty value — because an empty string cannot say which of two things
       * happened, and the review has to write *Inte aktuellt* where somebody
       * said it and *Inget svar* where nobody answered. The empty value is what
       * keeps it out of the average: no number, no variable, rather than a
       * zero that drags the mean down for everybody with no opinion.
       */
      if (answer.input === "rating") {
        const required = boolField(answer.validation?.requiredField);
        const wayOut = isAnswerFields(given);

        if (!wayOut && value.trim() === "") {
          if (required) {
            return this.failure("unknown-option", this.text("validation.chooseOption"));
          }

          return this.commitAnswer(node, "continue", this.text("preview.noAnswer"), "", "continue");
        }

        const step = RatingScaleService.steps(node, this.locale, getSourceLocale(this.graph)).find(
          (candidate) => candidate.value === value,
        );

        // A value that is neither a step nor the way out is not on this scale.
        if (!wayOut && !step) {
          return this.failure("unknown-option", this.text("validation.optionMissing", { value }));
        }

        return this.commitAnswer(
          node,
          "continue",
          step ? this.label(step.label) : value,
          given,
          "continue",
        );
      }

      if (answer.input === "consent") {
        const required = boolField(answer.validation?.requiredField);

        // The message names the action. "Fältet är obligatoriskt" in front of a
        // single checkbox says what state it is in, not what to do about it.
        if (required && value.trim() !== "true") {
          return this.failure(
            "unknown-option",
            this.text("validation.consent.required"),
          );
        }

        return this.commitAnswer(node, "continue", value || this.text("preview.noAnswer"), value, "continue");
      }

      /*
       * A file on its own step (story 047 found the hole): the answer is the
       * file's name, and without this branch it fell through to "the node
       * type is not supported yet" — the same silent trap the lookup comment
       * above describes. The refusal names the action, with the file field's
       * own message rather than the generic one.
       */
      if (answer.input === "file") {
        const required = boolField(answer.validation?.requiredField);

        if (required && value.trim().length === 0) {
          return this.failure(
            "unknown-option",
            this.text("validation.file.required"),
          );
        }

        /*
         * `given`, inte `value`: filens markeringar är en DEL av svaret
         * (`foto.markings`) och låg i en variabel bredvid fram till version 9.
         * Grenen committade texten och tappade delen — och eftersom filnamnet
         * ändå stämde såg svaret riktigt ut ända till den dag någon läste
         * markeringarna.
         */
        return this.commitAnswer(node, "continue", value || this.text("preview.noAnswer"), given, "continue");
      }

      if (answer.input === "text" || answer.input === "lookup" || answer.input === "map") {
        const required = boolField(answer.validation?.requiredField);
        const minLength = numField(answer.validation?.minLengthField);
        const maxLength = numField(answer.validation?.maxLengthField);

        if (required && value.trim().length === 0) {
          return this.failure(
            "unknown-option",
            this.text("validation.required")
          );
        }
        if (minLength !== null && value.length < minLength) {
          return this.failure(
            "unknown-option",
            this.text("validation.minLength", { n: minLength })
          );
        }
        if (maxLength !== null && value.length > maxLength) {
          return this.failure(
            "unknown-option",
            this.text("validation.maxLength", { n: maxLength })
          );
        }
        const formatField = answer.validation?.formatField;
        const patternField = answer.validation?.patternField;
        const formatErrorKey = validateFormat(
          formatField ? (node.data[formatField] as string) : undefined,
          patternField ? (node.data[patternField] as string) : undefined,
          value
        );
        if (formatErrorKey) {
          return this.failure("unknown-option", this.text(formatErrorKey));
        }
        /*
         * `given` och inte `value`: ett uppslag och en kartfråga svarar med
         * DELARNA — etikett och kod, namn och geometri — som ett värde. Den
         * texten ovanför är samma svar läst som text, och det är den
         * valideringen gäller.
         *
         * Delarna låg i en variabel bredvid tills 2026-08-30, och de hölls i
         * takt av ordningen de skrevs i. Ett villkor kan namnge en del nu
         * (`land.value`), vilket var enda skälet den andra variabeln fanns.
         */
        return this.commitAnswer(
          node,
          "continue",
          value || this.text("preview.noAnswer"),
          given,
          "continue"
        );
      }
    }

    return this.failure(
      "current-node-not-question",
      this.text("flow.unsupportedNodeType", { nodeType: node.type }),
      { nodeType: node.type }
    );
  }

  answerPage(values: Answers, options: AnswerOptions = {}): GuideTraversalResult {
    const currentResult = this.getCurrentResult();

    if (!currentResult.success) return currentResult;

    const page = currentResult.node;
    if (page.type !== "page") {
      return this.failure(
        "current-node-not-question",
        this.text("flow.notAPage", { nodeId: page.id }),
        { nodeId: page.id }
      );
    }

    const repeat = PageRepeatService.get(page, this.locale, getSourceLocale(this.graph));
    if (repeat) return this.answerRepeatingPage(page, repeat, values);

    // With the page's calculations, so a field conditioned on one is judged
    // the way the viewer showed it (story 095).
    const pageAnswers = CalculationService.runInPage(this.graph.nodes, page, { ...this.answers, ...values });
    /*
     * With the locale: the labels land in the answer records, and the review,
     * the email's `{{list}}` and a required-field error all read them. The
     * English take of the forms film said *Namn* on a page that said *Name*.
     */
    const fields = PageFieldsService.getFields(this.graph, page, pageAnswers, this.locale);

    for (const field of fields) {
      const value = values[field.variableName] ?? "";
      if (field.required && isAnswerEmpty(value)) {
        return this.failure(
          "unknown-option",
          this.text("validation.fieldRequired", { field: field.label })
        );
      }
      // After required, not before: a field left empty is told it is empty,
      // which is the plainer fault of the two. See `untouched`.
      if (
        this.isUntouched(
          field.variableName,
          field.requireInteraction === true,
          options.touched,
          answerText(value),
        )
      ) {
        return this.failure(
          "unknown-option",
          this.text("validation.fieldUntouched", { field: field.label })
        );
      }
    }

    return this.leavePage(page, () => {
      fields.forEach((field, index) => {
        if (!field.variableName) return;
        const value = values[field.variableName] ?? "";
        this.answers = { ...this.answers, [field.variableName]: value };

        /*
         * En andra variabel bredvid svaret fanns här: uppslagets kod, kartans
         * geometri, filens markeringar. De är DELAR av svaret sedan version 9
         * och reser med det — `land.value`, `plats.geo`, `foto.markings` — så det
         * finns ingenting kvar att kopiera vid sidan av.
         */
        this.answerRecords = [...this.answerRecords, {
          questionId: page.id,
          variableName: field.variableName,
          questionTitle: field.label,
          optionId: `field-${index + 1}`,
          optionLabel: this.fieldAnswerLabel(field, value),
          value,
        }];
      });
      /*
       * The page's own calculations (story 095), after its fields are stored
       * and over them — the same rows the viewer ran while the visitor typed,
       * now kept. No answer record: nobody answered them.
       */
      this.answers = CalculationService.runInPage(this.graph.nodes, page, this.answers);
    });
  }

  /**
   * A page that repeats (story 084): the answer is a list of records.
   *
   * `values[repeat.variable]` is the list, one object per record with the
   * page's fields as keys — nothing else on `values` is read, so a host that
   * sends flat field values for a repeating page sends nothing. Each record is
   * validated on its own: a field hidden by a condition reads the condition
   * in the same record (AC 4), never in the first one.
   *
   * Only the list is stored. The count is derived by `readPath` as
   * `<variable>.count`, and the fields keep no flat copy under their own
   * names — a copy of record one under `namn` would make a rule outside the
   * page silently read the first child and ignore the rest.
   */
  private answerRepeatingPage(page: FlowNodeData, repeat: PageRepeat, values: Answers): GuideTraversalResult {
    const raw = values[repeat.variable];
    const records: AnswerRecord[] = Array.isArray(raw) ? raw.filter(isAnswerRecord) : [];

    if (records.length < repeat.min) {
      return this.failure("unknown-option", this.text("validation.repeatMin", { n: repeat.min }));
    }
    if (repeat.max !== undefined && records.length > repeat.max) {
      return this.failure("unknown-option", this.text("validation.repeatMax", { n: repeat.max }));
    }

    const perRecord = records.map((_record, index) =>
      PageFieldsService.getFields(
        this.graph,
        page,
        PageRepeatService.recordAnswers(this.answers, repeat.variable, records, index),
        this.locale,
      ),
    );

    for (const [index, fields] of perRecord.entries()) {
      for (const field of fields) {
        if (field.required && isAnswerEmpty(records[index][field.variableName] ?? "")) {
          return this.failure(
            "unknown-option",
            this.text("validation.fieldRequired", { field: `${this.recordHeading(repeat, index)} — ${field.label}` }),
          );
        }
      }
    }

    return this.leavePage(page, () => {
      this.answers = { ...this.answers, [repeat.variable]: structuredClone(records) };

      perRecord.forEach((fields, index) => {
        fields.forEach((field, fieldIndex) => {
          if (!field.variableName) return;
          const value = records[index][field.variableName] ?? "";
          this.answerRecords = [...this.answerRecords, {
            questionId: page.id,
            variableName: `${repeat.variable}[${index}].${field.variableName}`,
            questionTitle: `${this.recordHeading(repeat, index)} — ${field.label}`,
            optionId: `record-${index + 1}-field-${fieldIndex + 1}`,
            optionLabel: this.fieldAnswerLabel(field, value),
            value,
          }];
        });
      });
    });
  }

  /** The record's label for a page field: the option's label, never its value. */
  /** The label of the field a variable date bound points at; undefined for a fixed date. */
  private dateBoundLabel(bound: string | undefined): string | undefined {
    const variable = dateBoundVariable(bound);
    return variable === null
      ? undefined
      : QuestionVariableService.labelOf(this.graph.nodes, variable, this.locale);
  }

  private fieldAnswerLabel(field: PageField, value: AnswerValue): string {
    return PageFieldsService.answerLabel(field, value, this.locale, getSourceLocale(this.graph)) || this.text("preview.noAnswer");
  }

  /** *Barn 2* — the record's heading, the same one the viewer's legend shows. */
  private recordHeading(repeat: PageRepeat, index: number): string {
    return this.text("repeat.legend", { word: PageRepeatService.heading(repeat.word), n: index + 1 });
  }

  /**
   * The step off a page once its answers are accepted: history, the
   * connection, the `commit` that writes the answers, then the rules.
   * Shared by the plain page and the repeating one so the two cannot drift
   * on what "leaving a page" means.
   */
  private leavePage(page: FlowNodeData, commit: () => void): GuideTraversalResult {

    const connection = this.graph.connections.find(
      (candidate) => candidate.from.nodeId === page.id && candidate.from.portId === "continue"
    );
    if (!connection) {
      return this.failure(
        "missing-connection",
        this.text("flow.pageDeadEnd")
      );
    }
    const targetNode = this.graph.nodes.find((node) => node.id === connection.to.nodeId);
    if (!targetNode) {
      return this.failure(
        "target-node-missing",
        this.text("flow.targetNodeMissing", { nodeId: connection.to.nodeId }),
        { nodeId: connection.to.nodeId }
      );
    }

    this.history.push({
      nodeId: page.id,
      answers: structuredClone(this.answers),
      answerRecords: structuredClone(this.answerRecords),
      optionId: "continue",
      traversedConnectionIds: [...this.traversedConnectionIds],
    });
    this.traversedConnectionIds = [...this.traversedConnectionIds, connection.id];

    commit();

    this.currentNodeId = targetNode.id;
    this.selectedOptionId = null;
    return this.resolveRules();
  }
  private commitAnswer(
    currentNode: FlowNodeData,
    optionId: string,
    optionLabel: string,
    value: AnswerValue,
    portId: string
  ): GuideTraversalResult {
    const connection = this.graph.connections.find(
      (candidate) =>
        candidate.from.nodeId === currentNode.id &&
        candidate.from.portId === portId
    );

    if (!connection) {
      /*
       * Vad som saknar väg vidare avgör vad meningen kan peka på.
       *
       * Ett ALTERNATIV går att citera: "Ja" leder ingenstans medan "Nej" gör
       * det, och svaret är verkligen det som skiljer. Ett steg med en enda
       * utgång — `continue` — har inget alternativ, och där blev citatet
       * besökarens egen text: `Svaret "Johan" leder inte vidare`. Meningen
       * pekade på namnet i stället för på steget som saknade koppling.
       */
      return this.failure(
        "missing-connection",
        portId === "continue"
          ? this.text("flow.deadEndStep")
          : this.text("flow.deadEndOption", { answer: optionLabel }),
      );
    }

    const targetNode = this.graph.nodes.find(
      (node) => node.id === connection.to.nodeId
    );

    if (!targetNode) {
      return this.failure(
        "target-node-missing",
        this.text("flow.targetNodeMissing", { nodeId: connection.to.nodeId }),
        { nodeId: connection.to.nodeId }
      );
    }

    this.history.push({
      nodeId: currentNode.id,
      answers: structuredClone(this.answers),
      answerRecords: structuredClone(this.answerRecords),
      optionId,
      traversedConnectionIds: [...this.traversedConnectionIds],
    });
    this.traversedConnectionIds = [...this.traversedConnectionIds, connection.id];

    const variableName = currentNode.data.variableName;

    if (typeof variableName === "string" && variableName.length > 0) {
      this.answers = {
        ...this.answers,
        [variableName]: value,
      };
    }

    const extra = this.pendingExtraVariables;
    this.pendingExtraVariables = {};

    Object.entries(extra).forEach(([name, extraValue]) => {
      if (name.length > 0) {
        this.answers = { ...this.answers, [name]: extraValue };
      }
    });


    this.answerRecords = [
      ...this.answerRecords,
      {
        questionId: currentNode.id,
        variableName:
          typeof variableName === "string" && variableName.length > 0
            ? variableName
            : null,
        questionTitle: this.label(currentNode.data.title, "Namnlös fråga"),
        optionId,
        optionLabel,
        value,
      },
    ];

    this.currentNodeId = targetNode.id;
    this.selectedOptionId = null;

    return this.resolveRules();
  }

  canGoBack(): boolean {
    return this.history.length > 0;
  }

  /**
   * Tillbaka till en redan besvarad fråga (granskningens Ändra, story 049).
   *
   * Historiken bär en post per besvarat steg med noden som besvarades och
   * tillståndet FÖRE svaret — så hoppet är: hitta postens sista förekomst
   * för frågan, återställ den och kapa allt efter. Finns frågan inte i
   * historiken händer ingenting: en Ändra-länk får aldrig kasta bort svar
   * på en gissning.
   */
  goBackToQuestion(questionId: string): GuideTraversalResult {
    for (let index = this.history.length - 1; index >= 0; index -= 1) {
      const entry = this.history[index]!;

      if (entry.nodeId !== questionId) {
        continue;
      }

      /*
       * Positionen, spåret OCH svaren spolas tillbaka; det skrivna minns.
       *
       * Historiken sparar läget FÖRE varje svar. Första lagningen (049)
       * återställde bara positionen och behöll svaren, för att återställa
       * allt tömde fältet man kom tillbaka för att rätta — mätt i visaren:
       * tomt, och Nästa låst tills allt skrevs om. Men svaren som behölls
       * var körningens: ett värde från en gren besökaren sedan lämnade
       * stod kvar i `getAnswers()`, alltså i inlämningen (6/9 2026). Så nu
       * är det två saker: körningen (`answers`) går tillbaka till läget
       * före steget, och det skrivna (`remembered`) fyller i fälten — se
       * `getPrefill`. Går besökaren samma väg igen skrivs varje svar in på
       * nytt; byter vägen gren följer inget med som inte gåtts.
       */
      this.currentNodeId = entry.nodeId;
      this.rewindAnswersTo(entry.answers);
      this.answerRecords = structuredClone(entry.answerRecords);
      this.selectedOptionId = entry.optionId;
      this.traversedConnectionIds = [...entry.traversedConnectionIds];
      this.history = this.history.slice(0, index);

      return this.getCurrentResult();
    }

    return this.getCurrentResult();
  }

  /** The run's answers back to a saved state; what they held goes to the memory. */
  private rewindAnswersTo(saved: Answers): void {
    this.remembered = { ...this.remembered, ...this.getAnswers() };
    this.answers = this.stamped(structuredClone(saved));
  }

  previous(): GuideTraversalResult {
    const previousState = this.history.pop();

    if (!previousState) {
      return this.getCurrentResult();
    }

    // Samma sak ett steg bakåt: läget, spåret och svaren; det skrivna minns.
    this.currentNodeId = previousState.nodeId;
    this.rewindAnswersTo(previousState.answers);
    this.answerRecords = structuredClone(previousState.answerRecords);
    this.selectedOptionId = previousState.optionId;
    this.traversedConnectionIds = [...previousState.traversedConnectionIds];

    return this.getCurrentResult();
  }

  private findCurrentNode(): FlowNodeData | null {
    if (this.currentNodeId === null) {
      return null;
    }

    return (
      this.graph.nodes.find((node) => node.id === this.currentNodeId) ?? null
    );
  }

  private resolveRules(): GuideTraversalResult {
    const visited = new Set<string>();

    while (true) {
      const currentResult = this.getCurrentResult();

      if (!currentResult.success) {
        return currentResult;
      }

      const node = currentResult.node;

      // Calculation nodes are always passed automatically.
      if (node.type === "calculation") {
        if (visited.has(node.id)) {
          return this.failure(
            "rule-cycle",
            this.text("flow.loopDetected", { nodeId: node.id }),
            { nodeId: node.id }
          );
        }
        visited.add(node.id);
        this.answers = CalculationService.run(node, this.answers).answers;
        const advance = this.followFlow(node.id, "continue");
        if (advance) return advance;
        continue;
      }

      // Service nodes are passed automatically using the mock — except in live
      // mode, where the engine stops at the node and awaits
      // `advanceServiceCall`.
      if (node.type === "service-call" && !this.deferServiceCalls) {
        if (visited.has(node.id)) {
          return this.failure(
            "rule-cycle",
            this.text("flow.loopDetected", { nodeId: node.id }),
            { nodeId: node.id }
          );
        }
        visited.add(node.id);
        this.answers = ServiceCallService.runMock(node, this.answers).answers;
        const advance = this.followFlow(node.id, "continue");
        if (advance) return advance;
        continue;
      }

      if (node.type !== "rule") {
        return currentResult;
      }

      const rule = node;

      if (visited.has(rule.id)) {
        return this.failure(
          "rule-cycle",
          this.text("flow.ruleLoopDetected", { nodeId: rule.id }),
          { nodeId: rule.id }
        );
      }

      visited.add(rule.id);
      const evaluation = evaluateRule(rule, this.answers);

      if (!evaluation.success) {
        /*
         * `evaluation.message` is hardcoded Swedish from `rule-evaluator.ts`,
         * a different module this mission's "35 anrop" count did not cover —
         * left as-is rather than growing this change into a second file's
         * contract. It names a broken rule (a missing variable, an invalid
         * comparison), which the editor's health check is meant to catch
         * before publishing, same as graph-validator.ts's own messages.
         */
        return this.failure("invalid-rule", evaluation.message);
      }

      const advance = this.followFlow(rule.id, evaluation.portId);
      if (advance) {
        return advance;
      }
    }
  }

  /**
   * Follows the connection from an exit port to the next node. Returns an error
   * result when the connection or the target node is missing, otherwise null
   * (and advances `currentNodeId`).
   */
  private followFlow(
    nodeId: string,
    portId: string
  ): GuideTraversalResult | null {
    const connection = this.graph.connections.find(
      (candidate) =>
        candidate.from.nodeId === nodeId && candidate.from.portId === portId
    );

    if (!connection) {
      return this.failure(
        "missing-connection",
        this.text("flow.exitNotConnected", { port: portId }),
        { port: portId }
      );
    }

    const targetNode = this.graph.nodes.find(
      (node) => node.id === connection.to.nodeId
    );

    if (!targetNode) {
      return this.failure(
        "target-node-missing",
        this.text("flow.targetNodeMissing", { nodeId: connection.to.nodeId }),
        { nodeId: connection.to.nodeId }
      );
    }

    this.traversedConnectionIds = [
      ...this.traversedConnectionIds,
      connection.id,
    ];
    this.currentNodeId = targetNode.id;
    return null;
  }

  /**
   * Resolves a deferred service node. In live mode the engine stops at the
   * service node; the BFF makes the real call (ServiceCallService.runLive) and
   * passes the response map in here. Sets the answers and moves on, continuing
   * automatically through subsequent rules and calculations (and stopping at the
   * next service node if there are more).
   */
  advanceServiceCall(answers: Answers): GuideTraversalResult {
    const current = this.getCurrentResult();
    if (!current.success || current.node.type !== "service-call") {
      return current;
    }

    this.answers = answers;
    const advance = this.followFlow(current.node.id, "continue");
    if (advance) {
      return advance;
    }
    return this.resolveRules();
  }

  private failure(
    code: GuideTraversalErrorCode,
    message: string,
    params?: Record<string, string | number>
  ): GuideTraversalResult {
    return {
      success: false,
      // `params` only when given: an omitted key (rather than one set to
      // `undefined`) is what keeps the existing `toEqual({ code, message })`
      // assertions exact.
      error: params ? { code, message, params } : { code, message },
    };
  }
}

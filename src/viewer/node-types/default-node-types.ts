import { registerNodeType } from "./node-type-registry";
import type { OutputPortDefinition } from "../types/node-types";
import { resolveText } from "../core/localized-text";
import { t } from "../core/ui-strings";

import { QuestionOptionsService } from "../services/question-options-service";
import { RuleCasesService } from "../services/rule-cases-service";
import { CalculationService } from "../services/calculation-service";
import { ServiceCallService } from "../services/service-call-service";
import { DEFAULT_RATING_STEPS } from "../services/rating-scale-service";
import "../core/default-formats";

/**
 * The starting options for a choice question. Their own ids make them
 * identities that connections can point at, so the list cannot be a static
 * value.
 */
function defaultOptions(): unknown {
  return [
    { id: crypto.randomUUID(), label: { sv: "Alternativ 1", en: "Option 1" }, value: "option-1" },
    { id: crypto.randomUUID(), label: { sv: "Alternativ 2", en: "Option 2" }, value: "option-2" },
  ];
}

/*
 * "Varför frågar vi det här?" (story 051) — förtroende byggs vid fältet.
 *
 * Frivilligt och tomt som standard: skriver redaktören inget renderas
 * ingenting. Delas av alla frågetyper, för tvekan inför att lämna en
 * uppgift ser likadan ut oavsett fälttyp. The editor's half — label, help
 * text, that it is localized — is WHY_PROPERTY in
 * editor/node-types/default-node-properties.ts.
 */
const WHY_FIELD = { id: "why", defaultValue: "" } as const;
/*
 * *Varje upprepning ska välja olika* (story 138). No default on purpose: a
 * new node gets no key, and absent means off — so no migration, and every
 * guide written before the setting reads exactly as it did.
 */
const UNIQUE_ACROSS_REPEATS_FIELD = { id: "uniqueAcrossRepeats" } as const;

registerNodeType("question", {
  label: "Fråga",
  variableType: "choice",
  canBeInPage: true,

  // Declarative: radio buttons branching one way per option.
  behavior: {
    answer: {
      variableField: "variableName",
      cardinality: "single",
      optionsField: "options",
    },
    flow: { kind: "branch", optionsField: "options" },
  },

  hideInputsWhenStart: true,

  properties: [
    { id: "title", formatting: ["variable"], defaultValue: { sv: "Ny fråga", en: "New question" } },
    { id: "variableName", defaultValue: "" },
    { id: "variableLabel", defaultValue: "" },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: "" },
    WHY_FIELD,
    {
      id: "options",
      // The options carry their own ids, so the starting value must be computed.
      createDefault: () => defaultOptions()
    },
    /*
     * After the options, not between the title and the variable name, because
     * the panel draws the ungrouped fields in this order (uppdrag 23/9 2026,
     * punkt 4): what the question SAYS first — rubrik, beskrivning, alternativ
     * — and how it is shown after. Every other question type already declared
     * `presentation` last; this one was the exception.
     */
    { id: "presentation", defaultValue: "radio" },
    UNIQUE_ACROSS_REPEATS_FIELD,
    { id: "cssClasses", defaultValue: "" },
  ],

  inputs: [
    {
      id: "input",
      label: "",
      accepts: ["flow"],
      connectionPolicy: "multiple",
    },
  ],

  getOutputs(node, locale): OutputPortDefinition[] {
    return QuestionOptionsService.getOptions(node).map((option) => ({
      id: option.id,
      label: resolveText(option.label, locale),
      valueType: "flow",
      connectionPolicy: "single",
    }));
  },

});

registerNodeType("multi-choice", {
  label: "Flervalsfråga",
  requiredCapability: "multiChoice",
  variableType: "choice",
  // Declarative: checkboxes, required/min/max, one linear step forward.
  behavior: {
    answer: {
      variableField: "variableName",
      cardinality: "multi",
      optionsField: "options",
      validation: {
        requiredField: "required",
        minField: "minSelected",
        maxField: "maxSelected",
      },
    },
    flow: { kind: "linear" },
  },
  hideInputsWhenStart: true,
  properties: [
    { id: "title", formatting: ["variable"], defaultValue: { sv: "Ny flervalsfråga", en: "New multiple-choice question" } },
    { id: "variableName", defaultValue: "" },
    { id: "variableLabel", defaultValue: "" },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: "" },
    WHY_FIELD,
    { id: "options", createDefault: () => defaultOptions() },
    { id: "presentation", defaultValue: "checkbox" },
    { id: "required", defaultValue: false },
    { id: "minSelected" },
    { id: "maxSelected" },
    { id: "cssClasses", defaultValue: "" },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});

registerNodeType("number-question", {
  label: "Sifferfråga",
  // Declarative: a number field with min/max, one linear step forward.
  behavior: {
    answer: {
      variableField: "variableName",
      cardinality: "single",
      input: "number",
      validation: { requiredField: "required", minField: "min", maxField: "max" },
    },
    flow: { kind: "linear" },
  },
  requiredCapability: "inputQuestions",
  variableType: "number",
  canBeInPage: true,
  hideInputsWhenStart: true,
  properties: [
    { id: "title", formatting: ["variable"], defaultValue: { sv: "Ny sifferfråga", en: "New number question" } },
    { id: "variableName", defaultValue: "" },
    { id: "variableLabel", defaultValue: "" },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: "" },
    WHY_FIELD,
    { id: "required", defaultValue: false },
    /*
     * *Touched*, not merely *filled in* (story 118, criterion 7). Only means
     * anything alongside `required`, which is why the panel shows it there and
     * only then: a field nobody has to answer cannot be one they have to touch.
     *
     * Johans beslut 13/9, framför att låta ett startvärde uppfylla kravet av
     * sig självt. A field that arrives carrying a value — a start value, or a
     * slider standing at `min` — can otherwise be walked past by somebody who
     * never looked at it, and the engine cannot tell the two apart from the
     * value alone. Absent = today's behaviour (K7).
     *
     * The viewer measures, the engine judges: see `answerPage` in
     * `viewer/core/guide-traversal-engine.ts`.
     */
    { id: "requireInteraction", defaultValue: false },
    { id: "min", defaultValue: 0 },
    { id: "max", defaultValue: 120 },
    { id: "step", defaultValue: 1 },
    { id: "unit", defaultValue: "" },
    /*
     * The number the visitor meets in the field (story 118).
     *
     * `null` and not `0`, the way `minLength` is: no start value is an absence,
     * and a declared zero would start every guide ever written at zero. It is
     * also what the panel writes back when the box is cleared, so the stored
     * shape is the same whether nobody set one or somebody took one away. See
     * `viewer/services/arrival-value-service.ts` for what it beats and why.
     */
    { id: "startValue", defaultValue: null },
    { id: "presentation", defaultValue: "field" },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});

registerNodeType("text-question", {
  label: "Textfråga",
  // Declarative: a text field, one linear step forward.
  behavior: {
    answer: {
      variableField: "variableName",
      cardinality: "single",
      input: "text",
      validation: {
        requiredField: "required",
        minLengthField: "minLength",
        maxLengthField: "maxLength",
        formatField: "format",
        patternField: "pattern",
      },
    },
    flow: { kind: "linear" },
  },
  requiredCapability: "inputQuestions",
  variableType: "text",
  canBeInPage: true,
  hideInputsWhenStart: true,
  properties: [
    { id: "title", formatting: ["variable"], defaultValue: { sv: "Ny textfråga", en: "New text question" } },
    { id: "variableName", defaultValue: "" },
    { id: "variableLabel", defaultValue: "" },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: "" },
    WHY_FIELD,
    { id: "placeholder", defaultValue: "" },
    { id: "presentation", defaultValue: "input" },
    // What the field holds, in the browser's own words (story 110). See
    // `core/autofill.ts` for why it is a list and never read off the title.
    { id: "autofill", defaultValue: "" },
    { id: "required", defaultValue: false },
    { id: "minLength", defaultValue: null },
    { id: "maxLength", defaultValue: null },
    { id: "mask", defaultValue: "" },
    { id: "format", defaultValue: "" },
    { id: "pattern", defaultValue: "" },
    UNIQUE_ACROSS_REPEATS_FIELD,
    { id: "cssClasses", defaultValue: "" },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});

registerNodeType("consent-question", {
  label: "Samtycke",
  icon: "\u2713",
  /*
   * Declarative: one checkbox, one label, one linear step forward.
   *
   * Not a `multi-choice` with a single option, which is how it would otherwise
   * be built. That renders a fieldset containing one checkbox — a group of one,
   * which a screen reader announces as such — and it expresses the requirement
   * as "choose at least one of one", which is not a sentence anybody would
   * write on purpose. It also stores a list, which every rule reading it would
   * have to know.
   *
   * The answer is the text "true" or the empty string, so a rule reads
   * `equals true`. Not a boolean: every other answer in a guide is text, and a
   * lone exception is a trap for whoever writes the next rule.
   */
  behavior: {
    answer: {
      variableField: "variableName",
      cardinality: "single",
      input: "consent",
      validation: { requiredField: "required" },
    },
    flow: { kind: "linear" },
  },
  requiredCapability: "inputQuestions",
  variableType: "text",
  canBeInPage: true,
  hideInputsWhenStart: true,
  properties: [
    { id: "title", formatting: ["variable", "bold", "italic", "link"], defaultValue: { sv: "Jag godk\u00e4nner villkoren", en: "I accept the terms" } },
    { id: "variableName", defaultValue: "" },
    { id: "variableLabel", defaultValue: "" },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: "" },
    WHY_FIELD,
    { id: "required", defaultValue: true },
    { id: "cssClasses", defaultValue: "" },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});

registerNodeType("multi-autocomplete-question", {
  label: "Sökfält med flera val",
  icon: "\u2261",
  /*
   * Declarative: several values picked from a searched list, shown as tags.
   *
   * Its own type rather than a flag on `autocomplete-question`, for the reason
   * `multi-choice` is not a flag on `question`: how many answers a question
   * takes changes what an editor is configuring. A flag would put "minst" and
   * "högst" in front of somebody building a single-answer field, where they
   * mean nothing.
   *
   * Svaret är EN lista av par: etiketten personen läste och koden bakom den,
   * hållna ihop per val. Delarna nås som `land.label` och `land.code`, vilket
   * är vad `readPath` finns för.
   *
   * Det stod "två variabler, radbrytningsseparerade" här fram till v9. Då var
   * det två listor som skulle hållas i takt för hand, och de gjorde det inte:
   * ett borttaget val ur den ena förskjöt den andra. Migreringen
   * `partsInsteadOfSideVariables` skrev om villkor och mallar till delar.
   */
  behavior: {
    answer: {
      variableField: "variableName",
      cardinality: "multi",
      input: "lookup",
      validation: {
        requiredField: "required",
        minField: "minSelected",
        maxField: "maxSelected",
      },
    },
    flow: { kind: "linear" },
  },
  requiredCapability: "hostServices",
  variableType: "text",
  canBeInPage: true,
  hideInputsWhenStart: true,
  properties: [
    { id: "title", formatting: ["variable"], defaultValue: { sv: "Ny sökfråga med flera val", en: "New multi-value question" } },
    { id: "variableName", defaultValue: "" },
    { id: "variableLabel", defaultValue: "" },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: "" },
    WHY_FIELD,
    { id: "placeholder", defaultValue: "" },
    { id: "source", defaultValue: "mock" },
    { id: "codeListId", defaultValue: "" },
    { id: "endpoint", defaultValue: "" },
    { id: "mockItems", defaultValue: [] },
    { id: "minChars", defaultValue: 2 },
    { id: "required", defaultValue: false },
    { id: "minSelected", defaultValue: 0 },
    { id: "maxSelected", defaultValue: 0 },
    { id: "cssClasses", defaultValue: "" },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});

registerNodeType("file-question", {
  label: "Bifoga fil",
  icon: "\u{1F4CE}",
  /*
   * Declarative: an attachment, whose answer is the file's name.
   *
   * The library neither uploads nor stores — K9 puts calls to third parties in
   * the BFF, K6e keeps persistence with the host. The file itself waits in the
   * viewer until the guide reaches its result, and the host collects it with
   * `getFiles()` and sends it with the answers.
   *
   * So there is one variable. A second, for a reference a host hands back when
   * it stores the file on pick, belongs to a model that is documented in
   * `docs/FIL-KONTRAKT.md` and **not built** — and an editor who could fill it
   * in would be choosing a setting nothing reads.
   */
  behavior: {
    answer: {
      variableField: "variableName",
      cardinality: "single",
      input: "file",
      validation: { requiredField: "required" },
    },
    flow: { kind: "linear" },
  },
  requiredCapability: "hostServices",
  variableType: "text",
  canBeInPage: true,
  hideInputsWhenStart: true,
  properties: [
    { id: "title", formatting: ["variable"], defaultValue: { sv: "Bifoga en fil", en: "Attach a file" } },
    { id: "variableName", defaultValue: "" },
    { id: "variableLabel", defaultValue: "" },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: "" },
    WHY_FIELD,
    { id: "required", defaultValue: false },
    { id: "accept", defaultValue: "" },
    { id: "maxSize", defaultValue: 0 },
    { id: "allowMarking", defaultValue: false },
    /*
     * Story 108: an example photo the question can offer instead of nothing.
     *
     * An address the host serves and a description of what it shows — the two
     * halves the `annotated-image` type already has, under names that say which
     * question they belong to. The library never stores the picture and never
     * fetches it on its own: a run on the canvas draws it as the step's stand-in,
     * and a visitor only ever sees a button where the host asked for one
     * (`example-files` on `guide-preview`).
     *
     * Two flat fields rather than one object, because the panel asks for a field
     * at a time and the alt text is translated per language — which is the
     * editor's own machinery for `localized: true`, and nothing to rebuild
     * inside a nested value.
     */
    { id: "exampleImage", defaultValue: "" },
    { id: "exampleImageAlt", defaultValue: "" },
    { id: "cssClasses", defaultValue: "" },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});

registerNodeType("date-question", {
  label: "Datumfråga",
  icon: "\u{1F4C5}",
  /*
   * Declarative: a date, stored as `YYYY-MM-DD`, one linear step forward.
   *
   * Its own type rather than a text field with a pattern. A regex over
   * `\d{4}-\d{2}-\d{2}` accepts the 31st of February and offers a letter
   * keyboard on a phone; `<input type="date">` gives the platform's own picker,
   * keyboard and screen-reader announcements, none of which we could write
   * better and all of which we would otherwise have to.
   *
   * The value is text because a guide is JSON and an ISO date sorts correctly as
   * text — which is what makes `min` and `max` a string comparison instead of
   * date arithmetic, with no timezone and nothing to parse.
   */
  behavior: {
    answer: {
      variableField: "variableName",
      cardinality: "single",
      input: "date",
      validation: { requiredField: "required", minField: "min", maxField: "max" },
    },
    flow: { kind: "linear" },
  },
  requiredCapability: "inputQuestions",
  variableType: "text",
  canBeInPage: true,
  hideInputsWhenStart: true,
  properties: [
    { id: "title", formatting: ["variable"], defaultValue: { sv: "Ny datumfråga", en: "New date question" } },
    { id: "variableName", defaultValue: "" },
    { id: "variableLabel", defaultValue: "" },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: "" },
    WHY_FIELD,
    { id: "required", defaultValue: false },
    /*
     * *Touched*, not merely *filled in* (story 118, criterion 7). Only means
     * anything alongside `required`, which is why the panel shows it there and
     * only then: a field nobody has to answer cannot be one they have to touch.
     *
     * Johans beslut 13/9, framför att låta ett startvärde uppfylla kravet av
     * sig självt. A field that arrives carrying a value — a start value, or a
     * slider standing at `min` — can otherwise be walked past by somebody who
     * never looked at it, and the engine cannot tell the two apart from the
     * value alone. Absent = today's behaviour (K7).
     *
     * The viewer measures, the engine judges: see `answerPage` in
     * `viewer/core/guide-traversal-engine.ts`.
     */
    { id: "requireInteraction", defaultValue: false },
    /*
     * The date the visitor meets in the field (story 118), written exactly the
     * way `min` and `max` are and read by the same function: an ISO date,
     * "idag", or `{{en variabel}}` holding a date.
     *
     * `formatting: ["variable"]` for the same reason they have it — that is
     * what puts the variable button on the box, so the braces are written the
     * way a redaktör has already seen them written. Johan 15/9, asked whether
     * a start value should be allowed to point at a field: *"Fast vi har det
     * på andra ställen. Måste vara lika."* Two spellings of the same kind of
     * date, one of which quietly refuses variables, is a rule nobody can guess
     * and the thing PRAXIS regel 1 is about.
     */
    { id: "startValue", formatting: ["variable"], defaultValue: "" },
    { id: "min", formatting: ["variable"], defaultValue: "" },
    { id: "max", formatting: ["variable"], defaultValue: "" },
    { id: "cssClasses", defaultValue: "" },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});

registerNodeType("rating-question", {
  label: "Betyg",
  icon: "★",
  /*
   * Declarative: a scale on one row, one linear step forward (story 115).
   *
   * Not a question with ten options, and not a step per grade. A choice
   * branches — ten grades would be ten ports and ten connections to draw for a
   * question nobody branches on — and its answer is a code, so `betyg < 7`
   * could not be asked. This one goes straight on and answers with a number.
   *
   * The value is the step's PLACE (Johan 13/9): step two is worth 2. An
   * editor who wants a high number to mean *good* puts *Dåligt* first, which
   * is a decision they can see in front of them; per-step values are the same
   * decision hidden in a box, and nobody has asked for them.
   *
   * *Inte aktuellt* is not a step. It is a way out, off by default, and when
   * it is on it stands visibly under the row — the survey that started this
   * story hid it behind a "…", and a hidden way out is one the person who
   * most needs it never finds.
   */
  behavior: {
    answer: {
      variableField: "variableName",
      cardinality: "single",
      input: "rating",
      validation: { requiredField: "required" },
    },
    flow: { kind: "linear" },
  },
  requiredCapability: "inputQuestions",
  variableType: "number",
  canBeInPage: true,
  hideInputsWhenStart: true,
  properties: [
    { id: "title", formatting: ["variable"], defaultValue: { sv: "Nytt betyg", en: "New rating" } },
    { id: "variableName", defaultValue: "" },
    { id: "variableLabel", defaultValue: "" },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: "" },
    WHY_FIELD,
    { id: "steps", defaultValue: DEFAULT_RATING_STEPS },
    /*
     * One word per step, and the list may be shorter than the scale: a step
     * without a word shows its number. That is what makes a 1–10 rating a
     * number in a box rather than ten labels to type.
     */
    { id: "labels", defaultValue: [] },
    /*
     * Which way the scale runs (Johan 13/9). A row is the default and the
     * reason the field exists — twenty questions answered without scrolling
     * through each one — but four long words on a narrow host make four
     * cramped segments, and then standing the scale on its end is the better
     * answer. The editor sees the whole question and can tell; we cannot.
     */
    { id: "layout", defaultValue: "row" },
    /*
     * TWO ways out, and they are not the same sentence (Johan 13/9): *Inte
     * aktuellt* is about the question, *Vet ej* about the person. Both off
     * until the editor turns them on, both leaving the variable empty with
     * their own words — see `rating-scale-service.ts`.
     *
     * An empty label means the built-in word in the reader's language. A
     * Swedish default stored here would be Swedish in every language a host
     * adds afterwards.
     */
    { id: "notApplicable", defaultValue: false },
    { id: "notApplicableLabel", defaultValue: "" },
    { id: "dontKnow", defaultValue: false },
    { id: "dontKnowLabel", defaultValue: "" },
    { id: "required", defaultValue: false },
    { id: "cssClasses", defaultValue: "" },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});

registerNodeType("map-question", {
  label: "Plats på karta",
  icon: "\u2316",
  /*
   * Story 046: the guide asks, the host's map answers. The node carries no
   * map knowledge at all — the viewer talks to the provider a host registered
   * (docs/KART-KONTRAKT.md), and without one only the pointer-free floor
   * shows: a text field where the place is written in words. Two variables,
   * like the lookup: the label a person reads, and `{variableName}Geo` with
   * the GeoJSON a system consumes.
   */
  behavior: {
    answer: {
      variableField: "variableName",
      cardinality: "single",
      input: "map",
      validation: { requiredField: "required" },
    },
    flow: { kind: "linear" },
  },
  requiredCapability: "hostServices",
  variableType: "text",
  hideInputsWhenStart: true,
  properties: [
    { id: "title", formatting: ["variable"], defaultValue: { sv: "Ny kartfråga", en: "New map question" } },
    { id: "variableName", defaultValue: "" },
    { id: "variableLabel", defaultValue: "" },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: "" },
    WHY_FIELD,
    { id: "kind", defaultValue: "point" },
    { id: "startView", defaultValue: "" },
    { id: "required", defaultValue: false },
    { id: "cssClasses", defaultValue: "" },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});

registerNodeType("autocomplete-question", {
  label: "Sökfält med förslag",
  icon: "⌕",
  // Declarative: a text answer picked from a searched list. The value is text,
  // so rules, results and email drafts need not know the difference.
  behavior: {
    answer: {
      variableField: "variableName",
      cardinality: "single",
      input: "lookup",
      validation: { requiredField: "required" },
    },
    flow: { kind: "linear" },
  },
  requiredCapability: "hostServices",
  variableType: "text",
  canBeInPage: true,
  hideInputsWhenStart: true,
  properties: [
    { id: "title", formatting: ["variable"], defaultValue: { sv: "Ny sökfråga", en: "New lookup question" } },
    { id: "variableName", defaultValue: "" },
    { id: "variableLabel", defaultValue: "" },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: "" },
    WHY_FIELD,
    { id: "placeholder", defaultValue: "" },
    { id: "source", defaultValue: "mock" },
    { id: "codeListId", defaultValue: "" },
    { id: "endpoint", defaultValue: "" },
    { id: "mockItems", defaultValue: [] },
    { id: "minChars", defaultValue: 2 },
    { id: "allowFreeText", defaultValue: false },
    { id: "required", defaultValue: false },
    { id: "cssClasses", defaultValue: "" },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});

registerNodeType("image", {
  label: "Bild",
  // A simple image node: shows an image and one way forward — like a slideshow.
  requiredCapability: "richContent",
  behavior: {
    answer: { variableField: "", cardinality: "none" },
    flow: { kind: "linear" },
  },
  isGuideStep: true,
  hideInputsWhenStart: true,
  properties: [
    { id: "imageUrl", defaultValue: "" },
    { id: "caption", defaultValue: "" },
    { id: "alt", defaultValue: "" },
    { id: "title", formatting: ["variable"], defaultValue: "" },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});

registerNodeType("annotated-image", {
  label: "Annoterad bild",
  requiredCapability: "richContent",
  // An image with comments (arrow plus text) at saved positions, stepped
  // through one at a time. A linear step forward once the comments run out.
  behavior: {
    answer: { variableField: "", cardinality: "none" },
    flow: { kind: "linear" },
  },
  isGuideStep: true,
  hideInputsWhenStart: true,
  properties: [
    { id: "title", formatting: ["variable"], defaultValue: "" },
    { id: "imageUrl", defaultValue: "" },
    { id: "alt", defaultValue: "" },
    { id: "comments", defaultValue: [] },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});

registerNodeType("code", {
  // Visar ett stycke — kör ingenting. Namnet i paletten är "Kodexempel", för
  // "Kod" läses som ett krav på att skriva sådan. Se editor-strings.
  label: "Kodexempel",
  requiredCapability: "richContent",
  // A simple code node: shows a snippet, one linear step forward.
  behavior: {
    answer: { variableField: "", cardinality: "none" },
    flow: { kind: "linear" },
  },
  isGuideStep: true,
  hideInputsWhenStart: true,
  properties: [
    { id: "title", formatting: ["variable"], defaultValue: "" },
    { id: "language", defaultValue: "" },
    { id: "code", defaultValue: "" },
    { id: "caption", defaultValue: "" },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});

registerNodeType("page", {
  label: "Sida",
  requiredCapability: "pages",
  isGuideStep: true,
  hideInputsWhenStart: true,
  properties: [
    { id: "title", formatting: ["variable"], defaultValue: { sv: "Ny sida", en: "New page" } },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: { sv: "Besvara fälten innan du fortsätter.", en: "Answer the fields before you carry on." } },
    { id: "continueLabel", defaultValue: "" },
    { id: "repeats" },
    { id: "repeatWord" },
    { id: "repeatVariable" },
    { id: "repeatMin" },
    { id: "repeatMax" },
    { id: "addLabel" },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});
/*
 * "Text" in the palette and the panel, `page-heading` in the JSON — story 095
 * renamed it without a migration ("man blir förvånad av att den heter
 * underrubrik"). A heading, a text, or both; the text is redrawn while the
 * visitor answers, so `{{variabler}}` set by a calculation in the page show
 * live. An empty title draws no heading.
 */
registerNodeType("page-heading", {
  label: "Text",
  requiredCapability: "pages",
  pageOnly: true,
  properties: [
    { id: "title", formatting: ["variable"], defaultValue: { sv: "Ny text", en: "New text" } },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: "" },
    { id: "presentation", defaultValue: "text" },
  ],
  inputs: [],
  getOutputs: () => [],
});
registerNodeType("page-spacer", {
  label: "Blank rad",
  requiredCapability: "pages",
  pageOnly: true,
  properties: [],
  inputs: [],
  getOutputs: () => [],
});

// A note node: a sticky note with a directed arrow. Pure editor metadata — no
// ports, no guide step, never visible to the citizen.
registerNodeType("annotation", {
  label: "Anteckning",
  properties: [
    { id: "text", defaultValue: "" },
    { id: "targetNodeId", defaultValue: "" },
    { id: "arrow", defaultValue: "down" },
  ],
  inputs: [],
  getOutputs: () => [],
});
/*
 * Granskningssteget (story 049): besökarens svar samlade före resultat
 * eller inlämning, med en väg tillbaka till varje svar. Innehållet
 * genereras ur motorns svarsposter — noden bär bara rubriken och
 * redaktörens frivilliga rad i datadeklarationen. För motorn är den ett
 * rent fortsätt-steg, som bilden.
 */
registerNodeType("review", {
  label: "Granska",
  behavior: {
    answer: { variableField: "", cardinality: "none" },
    flow: { kind: "linear" },
  },
  isGuideStep: true,
  properties: [
    { id: "title", formatting: ["variable"], defaultValue: { sv: "Granska dina svar", en: "Review your answers" } },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: { sv: "Kontrollera att allt stämmer — du kan ändra varje svar.", en: "Check that everything is right — every answer can be changed." } },
    { id: "declarationNote", defaultValue: "" },
  ],
  inputs: [{ id: "input", label: "", accepts: ["flow"], connectionPolicy: "multiple" }],
  getOutputs: (_node, locale) => [{ id: "continue", label: t("port.continue", locale), valueType: "flow", connectionPolicy: "single" }],
});

/*
 * Inlämningen (story 050): guiden som slutar i ett skickat ärende ÄR ett
 * formulär. Redaktörens tre val — mottagare (ID ur värdens katalog, aldrig
 * en adress), tacktext, mejlkopia — och ingenting mer. Själva sändningen
 * och kvittensen bor i visaren + inlämningskontraktet
 * (docs/INLAMNING-KONTRAKT.md).
 */
registerNodeType("result", {
  label: "Resultat",

  properties: [
    { id: "title", formatting: ["variable"], defaultValue: { sv: "Nytt resultat", en: "New result" } },
    { id: "description", formatting: ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"], defaultValue: "" },
  ],

  inputs: [
    {
      id: "input",
      label: "",
      accepts: ["flow"],
      connectionPolicy: "multiple",
    },
  ],

  getOutputs() {
    return [];
  },
  endsGuide: true,
});

registerNodeType("rule", {
  label: "Regel",
  requiredCapability: "rules",

  properties: [
    { id: "title", defaultValue: { sv: "Ny regel", en: "New rule" } },
    {
      id: "cases",
      // Rule cases carry their own ids that the exit ports hang from.
      createDefault: () => [RuleCasesService.createCase(0)]
    },
    { id: "fallbackLabel", defaultValue: "Annars" },
  ],

  inputs: [
    {
      id: "input",
      label: "",
      accepts: ["flow"],
      connectionPolicy: "multiple",
    },
  ],

  getOutputs(node) {
    return [
      ...RuleCasesService.getCases(node).map((item) => ({
        id: item.id,
        label: item.label,
        valueType: "flow",
        connectionPolicy: "single",
      } as const)),
      {
        id: "default",
        label:
          typeof node.data.fallbackLabel === "string"
            ? node.data.fallbackLabel
            : "Annars",
        valueType: "flow",
        connectionPolicy: "single",
      },
    ];
  },
});
registerNodeType("calculation", {
  label: "Uträkning",
  requiredCapability: "calculations",
  isGuideStep: true,
  /*
   * In a page too (story 095): its rows run over the page's fields as the
   * visitor types, so a text beside them can show the result live, and
   * they are stored at Nästa. Same node, same rows — only earlier.
   */
  canBeInPage: true,

  properties: [
    { id: "title", defaultValue: { sv: "Uträkning", en: "Calculation" } },
    { id: "assignments", createDefault: () => [CalculationService.createAssignment()] },
  ],

  inputs: [
    {
      id: "input",
      label: "",
      accepts: ["flow"],
      connectionPolicy: "multiple",
    },
  ],

  getOutputs: (_node, locale) => [
    {
      id: "continue",
      label: t("port.continue", locale),
      valueType: "flow",
      connectionPolicy: "single",
    },
  ],
});
registerNodeType("service-call", {
  label: "Tjänsteanrop",
  requiredCapability: "serviceCalls",
  isGuideStep: true,

  properties: [
    { id: "title", defaultValue: { sv: "Tjänsteanrop", en: "Service call" } },
    { id: "endpoint", defaultValue: "/api/tjanst" },
    { id: "method", defaultValue: "POST" },
    { id: "requestVariables", defaultValue: [] },
    { id: "mockResponse", defaultValue: '{\n  "maxLoan": 2550000,\n  "decision": "approved"\n}' },
    {
      id: "responseMappings",
      // Every row carries an id, so the list cannot be a static value.
      createDefault: () => [ServiceCallService.createMapping()]
    },
  ],

  inputs: [
    {
      id: "input",
      label: "",
      accepts: ["flow"],
      connectionPolicy: "multiple",
    },
  ],

  getOutputs: (_node, locale) => [
    {
      id: "continue",
      label: t("port.continue", locale),
      valueType: "flow",
      connectionPolicy: "single",
    },
  ],
});

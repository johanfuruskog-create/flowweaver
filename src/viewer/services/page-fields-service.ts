import { answerList, readPath, recordPlaceOf, type Answers, type AnswerValue } from "../core/answer-values";
import { QuestionOptionsService } from "./question-options-service";
import { PageVisibilityService } from "./page-visibility-service";
import { LookupService } from "./lookup-service";

import { getSourceLocale, resolveText } from "../core/localized-text";
import { TemplateVariableService } from "./template-variable-service";
import { autofillToken } from "../core/autofill";
import { dateBoundVariable, resolveDateBound } from "../core/date-validator";
import { QuestionVariableService } from "./question-variable-service";
import { RatingScaleService } from "./rating-scale-service";

import type { FlowNodeData, GraphData, QuestionOption } from "../types/graph";

export interface PageField {
  id: string;
  type: "choice" | "text" | "number" | "lookup" | "date" | "consent" | "file" | "rating";
  label: string;
  variableName: string;
  placeholder: string;
  required: boolean;
  /**
   * Story 118, criterion 7: the visitor has to have CHANGED the field, not
   * merely left a value standing in it.
   *
   * Carried here for the same reason `required` is — the page's validation
   * reads fields, not nodes — and it means nothing on its own: the rule asks
   * for it alongside an answer the engine does not have, which is what makes
   * an arrival value tell itself apart from an answer.
   */
  requireInteraction?: boolean;
  columnSpan: 4 | 6 | 12;
  breakBefore: boolean;
  options: QuestionOption[];
  /**
   * For `choice` only: at least one option is held back by its own condition
   * (story 134), so the visitor is told a row under the list.
   *
   * Carried on the field rather than looked up again by whoever draws it, for
   * the same reason `waysOut` is: the page and the standalone step must say
   * the same thing. Absent where nothing is hidden, and absent wherever the
   * options were asked for without a visitor — the editor sees them all.
   */
  optionsHidden?: boolean;
  /**
   * *Varje upprepning ska välja olika* (story 138) held back at least one
   * option the conditions had left — something another record chose. Its
   * own row, apart from `optionsHidden` (Astra 29/9): the visitor is told
   * each reason that applies, never a sum of the two.
   */
  optionsTaken?: boolean;
  /**
   * *Varje upprepning ska välja olika* (story 138): what the records before
   * this one answered, when the setting is on and the field sits on a page
   * that repeats. A field that repeats one of these is refused — the later
   * of two, never the earlier. (A choice hides what EVERY other record chose,
   * its own answer excepted; that list stays inside the service.) Absent when
   * the setting is off.
   */
  taken?: string[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  step?: number;
  /** Story 095: a slider or − / + buttons beside the number field. Absent = the field alone. */
  presentation?: "range" | "stepper";
  unit: string;
  /**
   * A named format — email, phone, personnummer, postnummer, orgnr — or `regex`.
   *
   * It was missing here, so the rule a `text-question` carried was silently
   * dropped the moment the field was put on a page. The editor still offered the
   * setting and the viewer still ran, and an invalid personal number went
   * through. A page is what a *form* is, so that was where it mattered most.
   */
  format?: string;
  /** En egen skrivform, t.ex. `###-##-####`. Se `format` för den namngivna. */
  mask?: string;
  /**
   * What the field holds, in the browser's own words (story 110) — a name, a
   * street address. Absent when the editor chose none, and absent for a word
   * we never offered: see `core/autofill.ts`.
   *
   * A format that carries a word of its own (email, phone, postal code) beats
   * it, so the two are never both drawn.
   */
  autofill?: string;
  /**
   * A text field written on several lines.
   *
   * Dropped on the way here, exactly as `format` once was: a question set to
   * `presentation: "textarea"` became a one-line box the moment it was put on a
   * page. Measured on the fault report's own page, where a 600-character
   * description of the problem had a single line to live on.
   */
  multiline?: boolean;
  /**
   * "Varför frågar vi det här?" (story 051), resolved in the visitor's language.
   *
   * The third one lost here after `format` and `multiline`: every question type
   * offered it, the standalone step drew it, a field on a page had none — and
   * a page is the form, where the hesitation actually happens. Absent when the
   * editor wrote nothing, so the viewer draws no empty disclosure.
   */
  why?: string;
  /** The pattern for `format: "regex"`. */
  pattern?: string;
  /**
   * For `date` only: the earliest and latest allowed, as `YYYY-MM-DD`.
   *
   * Strings and not numbers, because an ISO date sorts correctly as text — no
   * parsing, no timezone, no drift. Named apart from `min`/`max` so a number's
   * bounds and a date's cannot be mistaken for each other by a caller reading
   * the field.
   */
  minDate?: string;
  maxDate?: string;
  /**
   * The label of the field a date bound came from, when it points at a
   * variable (story 087: `min: "{{från}}"`). The message then names the field
   * — *samma som eller efter Från* — instead of a date the visitor wrote
   * themselves one field up.
   */
  minDateLabel?: string;
  maxDateLabel?: string;
  /**
   * For `lookup` only: whether several values may be chosen.
   *
   * The type stays `lookup` — it is the same control with its cap lifted, and a
   * separate field type would make every caller ask about two things where one
   * will do.
   */
  multiple?: boolean;
  /** For a multi-value field: how many must and may be chosen. */
  minSelected?: number;
  maxSelected?: number;
  /**
   * For `file` only: what may be attached, and how large.
   *
   * Checked before the file goes anywhere — they are cheap and the message is
   * ours to write. Virus scanning, quota and permission are the host's, and a
   * field that appeared to do them would be worse than one that plainly does
   * not.
   */
  accept?: string;
  maxSize?: number;
  /**
   * For `file` only: the resident may mark the picture (story 047). The
   * marks are percent coordinates stored beside the file in
   * `{variableName}Markeringar` — data, never burnt into the photo.
   */
  allowMarking?: boolean;
  /**
   * For `file` only: a photo the question may offer instead of an empty step
   * (story 108) — the address, and what it shows.
   *
   * Carried here so both homes of the field draw the same thing: a run on the
   * canvas uses it as the step's stand-in, and a visitor gets a button for it
   * only where the host asked for one. The library never fetches it on its own.
   */
  exampleImage?: string;
  exampleImageAlt?: string;
  /**
   * For `file` only: the variable the host's reference goes into.
   *
   * The reference is a string we never interpret, which is why the file's name
   * lives in `variableName` beside it. Without a readable half, every result
   * that mentions the attachment prints an id at somebody.
   */
  /**
   * For `rating` only: the words under the row, one per way out of the scale
   * that the editor offers (story 115) — *Inte aktuellt*, *Vet ej*, in that
   * order. Absent when they offered neither.
   *
   * Carried on the field rather than looked up again by whoever draws it: the
   * page, the standalone step and the review must say the same words, and the
   * fallback to the built-in word in the reader's language is one decision.
   */
  waysOut?: string[];
  /**
   * For `rating` only: which way the SCALE runs (story 115) — not where the
   * field sits on the page, which is `columnSpan`. A row unless the editor
   * stood it on its end.
   */
  ratingLayout?: "row" | "column";
  /** For `lookup` only: the fewest characters before a lookup is made. */
  minChars?: number;
  /** For `lookup` only: whether a value outside the list may be submitted. */
  allowFreeText?: boolean;
}

export class PageFieldsService {
  /**
   * `keepHidden` keeps a field whose own condition is false in the list.
   *
   * The viewer draws every field and decides visibility itself, because the
   * editor's canvas reveals a hidden field with its condition written above it
   * (`revealsHiddenFields`). Before story 134 it got that list by asking
   * without answers at all — which also meant an option's condition could
   * never be weighed there, and the guide's own `{{variabler}}` in a field
   * label went unresolved. So the answers go in either way and only the
   * field-level filter is lifted.
   */
  static getFields(
    graph: GraphData,
    page: FlowNodeData,
    answers?: Answers,
    locale?: string,
    { keepHidden = false }: { keepHidden?: boolean } = {},
  ): PageField[] {
    const children = graph.nodes
      .filter((node) => node.parentPageId === page.id)
      .filter((node) =>
        [
          "question",
          "number-question",
          "text-question",
          "autocomplete-question",
          "date-question",
          "rating-question",
          "consent-question",
          "multi-autocomplete-question",
          "file-question",
        ].includes(node.type),
      )
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

    if (children.length > 0) {
      return children
        .filter((node) => keepHidden || !answers || PageVisibilityService.isVisible(node, answers))
        .map((node) =>
          this.fromChild(
            node,
            locale,
            getSourceLocale(graph),
            (value) => TemplateVariableService.resolve(value, answers ?? {}, graph, locale).resolved,
            { graph, answers },
          ),
        );
    }

    // No fields. A page without children is empty, and that is a valid state —
    // the editor decides what goes on it.
    //
    // There used to be a second format here: two fields in the page's own data.
    // Migration v3→v4 turned them into real child nodes, so there is now only
    // one way to describe a page field. See
    // docs/STORIES/001-sidan-borjar-tom.md.
    return [];
  }

  /*
   * `sourceLocale` is the guide's own, from `getSourceLocale(graph)`. Without
   * it resolution falls back to Swedish whatever the guide is written in — see
   * `resolveText`.
   */
  /**
   * The field a single node would be, without a page around it.
   *
   * For the editor's try-it box, which asks the same service the page asks. A
   * second mapping that agrees today is a second mapping that disagrees later,
   * and the one somebody trusts is the one in front of them in the panel.
   */
  static fieldFor(node: FlowNodeData, locale?: string, sourceLocale?: string): PageField {
    return this.fromChild(node, locale, sourceLocale);
  }

  /**
   * What a field's answer is called when a person reads it back: the option's
   * LABEL for a choice, the text itself for everything else.
   *
   * The trail record held `answerText(value)` — for a choice that is the
   * option's *value*, and the review showed *ja* where the visitor had pressed
   * *Ja*. Found by story 084's review test; the plain page had it too. One
   * function, because the engine's records and `{{barn}}` in a letter must
   * agree on what *Ja* looks like.
   */
  static answerLabel(field: PageField, value: AnswerValue | undefined, locale?: string, sourceLocale?: string): string {
    return answerList(value)
      .map((one) => {
        const option = field.options.find((candidate) => candidate.value === one);
        return option ? resolveText(option.label, locale, one, sourceLocale) : one;
      })
      .join(", ");
  }

  /**
   * The field a lone question node is, outside any page.
   *
   * A standalone file question rendered nothing at all — the dispatch fell
   * through to the plain information card, a hole found while building story
   * 047. The single-node path renders through the same field markup as a
   * page member, which is why this is public.
   */
  static fieldOf(
    node: FlowNodeData,
    locale: string | undefined,
    sourceLocale: string | undefined,
  ): PageField {
    return this.fromChild(node, locale, sourceLocale);
  }

  /**
   * What the other records answered for this node (story 138), or undefined
   * when the setting is off or means nothing here.
   *
   * `before` is the records ahead of this one — the later of two equal
   * answers is the one told (criteria 3 and 4). `elsewhere` is every other
   * record, before and after: a choice hides those (Johan 29/9, symmetric),
   * and the record's own answer is never among them, so a visitor always sees
   * what they chose even when another record holds it too.
   *
   * The list comes from `RECORD_PLACE`, which `recordAnswers` sets for every
   * reader. Answers made without it (a hand-built scope) fall back to the
   * list's variable, which holds the records before — the one half there is.
   * Without answers (the editor asking for the whole list) nothing is taken.
   * A setting left on a node whose page does not repeat does nothing; the
   * health check says so.
   */
  private static takenElsewhere(
    node: FlowNodeData,
    context: { graph?: GraphData; answers?: Answers },
  ): { before: string[]; elsewhere: string[] } | undefined {
    if (node.data.uniqueAcrossRepeats !== true || !context.graph || !context.answers) return undefined;

    const page = context.graph.nodes.find((candidate) => candidate.id === node.parentPageId);
    const list = typeof page?.data.repeatVariable === "string" ? page.data.repeatVariable.trim() : "";
    const name = typeof node.data.variableName === "string" ? node.data.variableName : "";
    if (page?.type !== "page" || page.data.repeats !== true || list === "" || name === "") return undefined;

    const answered = (values: AnswerValue | undefined): string[] => answerList(values).filter((one) => one.trim() !== "");
    const place = recordPlaceOf(context.answers);
    if (!place) {
      const before = answered(readPath(context.answers, `${list}.${name}`));
      return { before, elsewhere: before };
    }

    const own = new Set(answered(context.answers[name]));
    const of = (records: typeof place.records) => records.flatMap((record) => answered(record[name]));
    return {
      before: of(place.records.slice(0, place.index)),
      elsewhere: of(place.records.filter((_record, index) => index !== place.index)).filter((one) => !own.has(one)),
    };
  }

  /** The label of the field a variable bound points at; undefined for a fixed date. */
  private static boundLabel(bound: unknown, graph: GraphData | undefined, locale?: string): string | undefined {
    const variable = typeof bound === "string" ? dateBoundVariable(bound) : null;
    return variable !== null && graph
      ? QuestionVariableService.labelOf(graph.nodes, variable, locale)
      : undefined;
  }

  /*
   * `resolve` fyller mallarna, när den som frågar har både graf och svar.
   *
   * Samma nodtyp renderas på två vägar: som eget steg genom `toStepViewModel`,
   * som fält på en sida genom den här. Den första löste `{{namn}}` i rubriken,
   * den andra skrev ut klamrarna — samma egenskap, två beteenden, beroende på
   * var noden råkade ligga. Hittat när variabelknappen skulle slås på: en knapp
   * som infogar något som bara ibland fylls i är sämre än ingen knapp.
   *
   * Valfri, för editorn frågar utan graf och ska ha kvar klamrarna: där är den
   * råa texten det som redigeras.
   */
  /*
   * `context` is what a variable bound needs (story 087): the answers to read
   * `{{från}}` from and the graph to name the field it came from. Without it
   * a variable bound is no bound — the editor's try-it box and the card have
   * no visitor.
   */
  private static fromChild(
    node: FlowNodeData,
    locale?: string,
    sourceLocale?: string,
    resolve: (value: string) => string = (value) => value,
    context: { graph?: GraphData; answers?: Answers } = {},
  ): PageField {
    const type = node.type === "question"
      ? "choice"
      : node.type === "number-question"
        ? "number"
        : node.type === "autocomplete-question" ||
            node.type === "multi-autocomplete-question"
          ? "lookup"
          : node.type === "date-question"
            ? "date"
            : node.type === "rating-question"
              ? "rating"
              : node.type === "consent-question"
              ? "consent"
              : node.type === "file-question"
                ? "file"
                : "text";

    /*
     * Story 134. With answers the list is what this visitor may choose from;
     * without them it is the whole list, which is what the editor sees.
     * `optionsHidden` is the difference, and it is what the row under the list
     * speaks for — never which option, because naming the nut curry would
     * describe the dish the allergic visitor must not have.
     */
    const allOptions = type === "choice" ? QuestionOptionsService.getOptions(node) : [];
    const taken = type === "choice" || type === "text" ? this.takenElsewhere(node, context) : undefined;
    const allowed = type === "choice" && context.answers ? QuestionOptionsService.visible(allOptions, context.answers) : allOptions;
    const options =
      type === "choice"
        ? context.answers
          ? allowed.filter((option) => !taken?.elsewhere.includes(option.value))
          : allOptions
        : type === "rating"
          ? RatingScaleService.steps(node, locale, sourceLocale)
          : [];

    return {
      id: node.id,
      type,
      label: resolve(resolveText(node.data.title, locale, "Namnlöst fält", sourceLocale)),
      variableName: typeof node.data.variableName === "string" ? node.data.variableName : "",
      /*
       * Platshållaren löses INTE. Den fristående vägen (`fieldOf`, utan graf)
       * gör det inte heller, och en egenskap som fylls i på en sida men inte
       * utanför är samma fel som det här bytet skulle bort. Rubriken är den
       * som löses på båda vägarna — via `toStepViewModel` för ett eget steg.
       */
      placeholder: resolveText(node.data.placeholder, locale, "", sourceLocale),
      /*
       * A choice is required by construction — a step with options has to be
       * answered. A consent is not: a newsletter opt-in is the ordinary case of
       * one that may be left alone, so it follows its own setting.
       */
      /*
       * A choice with nothing left to choose is the exception (story 134,
       * criterion 5): every option is held back by its own condition, so
       * demanding an answer would stop the visitor at a question they cannot
       * answer. The question is still shown, with the row that says why.
       */
      /*
       * Except when it is *Varje upprepning ska välja olika* that left nothing
       * (story 138, the lead's decision 29/9): then the record itself is the
       * mistake — the same session twice, or one record too many — and a
       * record with no answer must not reach the receipt as *Inget svar*. It
       * stays required, and the viewer says what to do about it.
       */
      required: (type === "choice" && (options.length > 0 || options.length < allowed.length)) || node.data.required === true,
      requireInteraction: node.data.requireInteraction === true ? true : undefined,
      format: typeof node.data.format === "string" && node.data.format !== ""
        ? node.data.format
        : undefined,
      pattern: typeof node.data.pattern === "string" && node.data.pattern !== ""
        ? node.data.pattern
        : undefined,
      /*
       * Malens egen skrivform. Bars inte hit tidigare, så ett fält på en sida
       * kunde inte formas av en mall — bara av ett namngivet format, och inte
       * ens det, eftersom kroken saknades i markupen.
       */
      mask: typeof node.data.mask === "string" && node.data.mask !== ""
        ? node.data.mask
        : undefined,
      autofill: autofillToken(node.data.autofill),
      multiline: type === "text" && node.data.presentation === "textarea",
      why: resolveText(node.data.why, locale, "", sourceLocale) || undefined,
      columnSpan: node.layout?.columnSpan === 4 ? 4 : node.layout?.columnSpan === 6 ? 6 : 12,
      breakBefore: node.layout?.breakBefore === true,
      /*
       * A rating's steps come out shaped as options (story 115) so that
       * everything reading an answer back to a person — the review, the answer
       * record, `{{betyg}}` in a letter — turns 2 into *Ganska bra* through the
       * mapping it already has. They are derived from the count and the words,
       * never stored as options: a step has no value of its own.
       */
      options,
      optionsHidden: type === "choice" && allowed.length < allOptions.length ? true : undefined,
      optionsTaken: type === "choice" && options.length < allowed.length ? true : undefined,
      taken: taken?.before,
      waysOut: type === "rating" ? RatingScaleService.waysOut(node, locale, sourceLocale) : undefined,
      ratingLayout: type === "rating" ? RatingScaleService.layout(node) : undefined,
      min: typeof node.data.min === "number" ? node.data.min : undefined,
      max: typeof node.data.max === "number" ? node.data.max : undefined,
      minLength: typeof node.data.minLength === "number" ? node.data.minLength : undefined,
      maxLength: typeof node.data.maxLength === "number" ? node.data.maxLength : undefined,
      step: typeof node.data.step === "number" ? node.data.step : undefined,
      presentation:
        type === "number" && (node.data.presentation === "range" || node.data.presentation === "stepper")
          ? node.data.presentation
          : undefined,
      unit: resolveText(node.data.unit, locale, "", sourceLocale),
      // Resolved on the way out (story 044): "idag" becomes the day the field
      // is asked for, so the picker greys out the right days and the
      // validation names a date a person can act on.
      minDate:
        type === "date" && typeof node.data.min === "string"
          ? resolveDateBound(node.data.min, context.answers)
          : undefined,
      maxDate:
        type === "date" && typeof node.data.max === "string"
          ? resolveDateBound(node.data.max, context.answers)
          : undefined,
      minDateLabel: type === "date" ? this.boundLabel(node.data.min, context.graph, locale) : undefined,
      maxDateLabel: type === "date" ? this.boundLabel(node.data.max, context.graph, locale) : undefined,
      accept:
        typeof node.data.accept === "string" && node.data.accept !== ""
          ? node.data.accept
          : undefined,
      maxSize:
        typeof node.data.maxSize === "number" && node.data.maxSize > 0
          ? node.data.maxSize
          : undefined,
      allowMarking: node.data.allowMarking === true ? true : undefined,
      exampleImage:
        typeof node.data.exampleImage === "string" && node.data.exampleImage !== ""
          ? node.data.exampleImage
          : undefined,
      exampleImageAlt:
        resolveText(node.data.exampleImageAlt, locale, "", sourceLocale) || undefined,
      /*
       * A multi-choice too: it never stands on a page, but its own step is
       * tried again through this field (Johan 1/10), and without `multiple`
       * the rule counted nothing — `minSelected` was carried and ignored, so
       * one box of *minst 2* passed.
       */
      multiple: node.type === "multi-autocomplete-question" || node.type === "multi-choice" ? true : undefined,
      minSelected:
        typeof node.data.minSelected === "number" && node.data.minSelected > 0
          ? node.data.minSelected
          : undefined,
      maxSelected:
        typeof node.data.maxSelected === "number" && node.data.maxSelected > 0
          ? node.data.maxSelected
          : undefined,
      minChars: type === "lookup" ? LookupService.getMinChars(node) : undefined,
      allowFreeText: type === "lookup" ? LookupService.allowsFreeText(node) : undefined,
    };
  }
}
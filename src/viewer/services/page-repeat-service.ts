import { isAnswerRecord, RECORD_PLACE, type AnswerRecord, type Answers, type AnswerValue } from "../core/answer-values";
import { getSourceLocale, resolveText } from "../core/localized-text";
import { interpolate, t } from "../core/ui-strings";
import { PageFieldsService, type PageField } from "./page-fields-service";

import type { FlowNodeData, GraphData } from "../types/graph";

/**
 * What a page that repeats (story 084) has settled on, read once for everyone.
 *
 * The engine validates and stores by it, the viewer draws by it, the review
 * names its rows by it. Three readers of six raw properties — with their
 * defaults (`repeatMin` empty means 1, `repeatMax` empty means no ceiling) —
 * is three places to disagree about what an empty field means.
 */
export interface PageRepeat {
  /** The variable the list of records goes into; `<variable>.count` is derived. */
  variable: string;
  /** The singular word: *barn*. Never inflected — the editor writes plurals. */
  word: string;
  /** Fewest records the page accepts. */
  min: number;
  /** Most records, or none for no ceiling. */
  max?: number;
  /** The Add button's text when the editor wrote one; empty means the default. */
  addLabel: string;
}

const count = (raw: unknown, fallback: number | undefined): number | undefined => {
  const value = typeof raw === "number" ? raw : Number(raw);
  return typeof raw !== "boolean" && raw !== "" && raw != null && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
};

export class PageRepeatService {
  /**
   * The word as a heading starts: *Barn 2*. First letter only — an
   * abbreviation the editor wrote in capitals stays as written.
   */
  static heading(word: string): string {
    return word.charAt(0).toLocaleUpperCase() + word.slice(1);
  }

  /**
   * The page whose list a variable is — `{{barn}}` names the page that
   * repeats per *barn* — or null when no page repeats into that name.
   */
  static pageFor(graph: GraphData | undefined, variableName: string): FlowNodeData | null {
    return graph?.nodes.find(
      (node) => node.type === "page" && node.data.repeats === true && node.data.repeatVariable === variableName,
    ) ?? null;
  }

  /**
   * The answers one record is weighed against: everything outside the page,
   * the list as it stands **before** this record, and the record's own fields.
   *
   * Story 138. Every reader of a record — the viewer drawing it, the viewer
   * re-weighing it while the visitor types, the engine at *Nästa*, the review
   * — had written `{ ...answers, ...record }`, and each meant something
   * different by the list: the viewer had nothing under it while the page was
   * being filled, the review had the whole list including the record itself.
   * So an option conditioned on an earlier record (`passen.pass`) was hidden
   * on the page and shown in the review, and one conditioned on the record's
   * own field was never re-weighed at all.
   *
   * *Before* and not *all*, for a condition: record 2 may depend on record 1,
   * never the other way round. The setting *Varje upprepning ska välja olika*
   * is the one reader that looks both ways (Johan 29/9: symmetric), and it
   * finds the whole list under `RECORD_PLACE` — beside the answers, where no
   * condition can read it.
   */
  static recordAnswers(answers: Answers, variable: string, records: readonly AnswerRecord[], index: number): Answers {
    return Object.assign(
      { ...answers, [variable]: records.slice(0, index), ...records[index] },
      { [RECORD_PLACE]: { records, index } },
    );
  }

  /**
   * The list as a person reads it (AC 3): one block per record, headed as
   * the page headed it, one line per field the record actually showed —
   *
   *     Barn 1
   *     Namn: Alva
   *     Går i skolan: Ja
   *     Årskurs: 3
   *
   *     Barn 2
   *     Namn: Nils
   *     Går i skolan: Nej
   *
   * For `{{barn}}` in a result text or a letter. `answerText` cannot do it:
   * a record has no `label` part and no idea what its keys are called, so it
   * read as nothing at all. The heading is the string the legend and the
   * review row use, so the three read alike; a field hidden in a record by
   * a condition is left out, as it was on the page.
   *
   * It was one line per record, `Barn 1 — Namn: Alva, Går i skolan: Ja`, and
   * two fields already wrapped in a result card (film 3, 7/9): the reader
   * had to find the commas to see where one child ended. Lines and a blank
   * line between records are the one layout a text can carry everywhere it
   * goes — a card, a letter, a plain-text mail.
   */
  static describe(graph: GraphData, page: FlowNodeData, value: AnswerValue | undefined, answers: Answers, locale?: string): string {
    return this.records(graph, page, value, answers, locale)
      .map(({ heading, fields }) => [heading, ...fields].join("\n"))
      .join("\n\n");
  }

  /**
   * The same, one entry per record: *Barn 1*, its fields *Namn: Alva* and
   * *Går i skolan: Ja*, and the fields as one line for a row.
   *
   * The review (story 089) shows a repeating page as one row per record with
   * the heading in the term slot, so it wants the two halves apart and the
   * fields on one line; `describe` stacks them for a text. One reading of a
   * record, two layouts.
   */
  static records(
    graph: GraphData,
    page: FlowNodeData,
    value: AnswerValue | undefined,
    answers: Answers,
    locale?: string,
  ): { heading: string; fields: string[]; text: string; pairs: { field: PageField; value: AnswerValue | undefined; label: string }[] }[] {
    const repeat = this.get(page, locale, getSourceLocale(graph));
    const records = Array.isArray(value) ? value.filter(isAnswerRecord) : [];
    if (!repeat) return [];

    return records.map((record, index) => {
      /*
       * The record's fields one by one, beside the joined text: the review
       * shows them as a question and its answer per row (punkt 18, 1/10), and
       * formats a number or a date by what the field is — which a joined
       * string can no longer say. `{{barn}}` still reads `text`.
       */
      const pairs = PageFieldsService.getFields(graph, page, this.recordAnswers(answers, repeat.variable, records, index), locale)
        .map((field) => ({ field, value: record[field.variableName], label: this.answerLabel(field, record[field.variableName], locale, graph) }));
      const fields = pairs.map((pair) => `${pair.field.label}: ${pair.label}`);

      return {
        heading: interpolate(t("repeat.legend", locale), { word: this.heading(repeat.word), n: index + 1 }),
        fields,
        text: fields.join(", "),
        pairs,
      };
    });
  }

  private static answerLabel(field: Parameters<typeof PageFieldsService.answerLabel>[0], value: AnswerValue | undefined, locale: string | undefined, graph: GraphData): string {
    return PageFieldsService.answerLabel(field, value, locale, getSourceLocale(graph));
  }

  /**
   * The repeat settings of a page, or null when it does not repeat.
   *
   * Null rather than `{ repeats: false }` so a caller writes `if (repeat)` and
   * never reads a word off a page that has none. A page switched on without a
   * word or a variable is not repeating either: the health check reports it,
   * and until it is fixed the viewer shows the page as it always did.
   */
  static get(node: FlowNodeData, locale?: string, sourceLocale?: string): PageRepeat | null {
    if (node.type !== "page" || node.data.repeats !== true) return null;

    const variable = typeof node.data.repeatVariable === "string" ? node.data.repeatVariable.trim() : "";
    const word = resolveText(node.data.repeatWord, locale, "", sourceLocale).trim();
    if (variable === "" || word === "") return null;

    const min = count(node.data.repeatMin, 1) ?? 1;
    const ceiling = count(node.data.repeatMax, undefined);

    return {
      variable,
      word,
      min,
      max: ceiling !== undefined && ceiling >= min ? ceiling : undefined,
      addLabel: resolveText(node.data.addLabel, locale, "", sourceLocale).trim(),
    };
  }
}

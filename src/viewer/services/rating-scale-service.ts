import { resolveText } from "../core/localized-text";
import { t } from "../core/ui-strings";

import type { FlowNodeData, QuestionOption } from "../types/graph";

/**
 * The steps of a rating question (story 115), derived rather than stored.
 *
 * ## Why the steps are not options
 *
 * A rating looks like a choice and is not one. Its answer is a **number** — the
 * step's place on the scale — so a rule can ask `betyg < 7` and a calculation
 * can take an average; a choice's answer is a code somebody typed. Storing the
 * scale as options would put a value box beside every step and invite exactly
 * the thing Johan ruled out on 13/9: a scale where the fourth step is worth 9.
 *
 * So the editor gives a **count** (2–11) and, if it wants, a word per step. The
 * count is the scale; the words are decoration on it. A step without a word
 * shows its number, which is how a 1–10 rating is written without typing ten
 * labels.
 *
 * ## Why they come out shaped as options anyway
 *
 * Everything that reads an answer back to a person already knows how to turn a
 * value into a label through a list of `{ value, label }`: the review, the
 * answer record, `{{betyg}}` in a letter. Handing them that shape is what makes
 * the rating write *Ganska bra* everywhere a choice writes *Ja*, without a
 * second mapping anywhere.
 */

/** The fewest steps a scale can have: below two it is not a scale. */
export const MIN_RATING_STEPS = 2;
/** The most: 0–10 is eleven boxes, and it is the widest anybody asks for. */
export const MAX_RATING_STEPS = 11;
/** What a new rating starts as — four words fit a phone in one row. */
export const DEFAULT_RATING_STEPS = 4;

/**
 * The two ways out, in the order a visitor meets them: the question first,
 * themselves second. One table so the fields, the words and the order cannot
 * be listed differently in the three places that read them.
 */
const WAYS_OUT = [
  { on: "notApplicable", label: "notApplicableLabel", key: "field.notApplicable" },
  { on: "dontKnow", label: "dontKnowLabel", key: "field.dontKnow" },
] as const;

export class RatingScaleService {
  /** How many steps the scale has, clamped to what can be drawn. */
  static stepCount(node: FlowNodeData): number {
    const raw = node.data.steps;
    const wanted = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : DEFAULT_RATING_STEPS;

    return Math.min(MAX_RATING_STEPS, Math.max(MIN_RATING_STEPS, wanted));
  }

  /**
   * The words per step, as they are stored — a translator's own list.
   *
   * Longer than the scale is not cut here: shortening the scale and lengthening
   * it again would otherwise throw away words the editor wrote. The renderers
   * read only as many as there are steps.
   */
  static labels(node: FlowNodeData): unknown[] {
    return Array.isArray(node.data.labels) ? node.data.labels : [];
  }

  /**
   * The scale as `{ id, value, label }`, one per step.
   *
   * The value is the step's place as text — every other answer in a guide is
   * text, and a lone number would be a trap for whoever reads the next one. The
   * label is the editor's word, or the place itself when there is none.
   */
  static steps(node: FlowNodeData, locale?: string, sourceLocale?: string): QuestionOption[] {
    const labels = this.labels(node);

    return Array.from({ length: this.stepCount(node) }, (_unused, index) => {
      const place = String(index + 1);

      return {
        id: `step-${place}`,
        value: place,
        label: resolveText(labels[index], locale, place, sourceLocale) || place,
      };
    });
  }

  /**
   * Which way the scale runs: along a row, or standing on its end.
   *
   * Parsed in one place, and a row unless the editor said otherwise — anything
   * unrecognised is a row, because a scale that renders is better than one that
   * does not.
   */
  static layout(node: FlowNodeData): "row" | "column" {
    return node.data.layout === "column" ? "column" : "row";
  }

  /**
   * The ways out of the scale, in the order they are offered (Johan 13/9).
   *
   * **Two, not one, and they are not the same sentence.** *Inte aktuellt* is
   * about the QUESTION — there is no garden to have an opinion about — and
   * *Vet ej* is about the PERSON: the garden is there and they have not looked.
   * A survey that offers only the first makes everybody who has not thought
   * about it say the question does not apply, which is a different answer and
   * the wrong one. Both are off until the editor turns them on: a guide that
   * needs neither should show neither.
   *
   * Both leave the variable EMPTY with their own words as the label — never a
   * nought. The formula language has no condition, so a nought would be
   * counted, and every average would sag by exactly the people who had nothing
   * to say.
   *
   * The words are built in when the editor wrote none, so a Finnish reader gets
   * Finnish rather than the Swedish an editor happened to leave behind.
   */
  static waysOut(node: FlowNodeData, locale?: string, sourceLocale?: string): string[] {
    return WAYS_OUT.filter((way) => node.data[way.on] === true).map(
      (way) =>
        resolveText(node.data[way.label], locale, "", sourceLocale).trim() || t(way.key, locale),
    );
  }
}

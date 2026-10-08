import type { Answers } from "../core/answer-values";
import { resolveDateBound } from "../core/date-validator";
import type { FlowNodeData } from "../types/graph";

/**
 * One question, one answer: *what does the field show on arrival?*
 *
 * Two sides ask it. The viewer asks in order to fill the model with what the
 * visitor can see before answering anything; the health check is to ask in
 * order to know whether a calculation on the page has anything to count with
 * (story 118, criterion 8 — not built yet). Two answers to that question
 * drift apart, so the answer lives here, once.
 *
 * Two things can put a value in an empty field, and they are ranked here
 * rather than anywhere else:
 *
 * 1. **The redaktör's start value** (`startValue`, story 118) — a number the
 *    editor typed, or a date written the way `min`/`max` are written.
 * 2. **A slider's starting position** — `min`, because the thumb is already
 *    standing there.
 *
 * **The start value wins.** It is the only one of the two anybody chose: `min`
 * is the far end of a range, and a slider only lands on it because a thumb has
 * to be somewhere. A slider with a start value is therefore drawn at the start
 * value, and `min` is what is left when nobody said anything.
 *
 * A slider always shows a state. `renderNumberControls` puts the thumb at
 * `min` when the field is empty, because a slider with nowhere to stand is
 * not a slider — and until then nothing else knew. Measured in chromium 13/9
 * on the Låna page at first paint: the slider read `10000`, the field beside
 * it was empty, and the page's calculation had nothing to count with. Three
 * pictures of one answer, two of them blank, and the blank ones invisible.
 *
 * Sliders only. A stepper's − / + leave the field empty and show no state, so
 * seeding one would invent an answer the visitor never gave and cannot see
 * that they gave. Both ends have to be numbers for the same reason: that is
 * exactly when a slider is drawn at all.
 *
 * Only where there is no answer yet — a cleared field holds `""`, which is an
 * answer (an empty one) and is left alone. What this does mean, and is meant
 * to mean: a required slider arrives satisfied, and the value travels with
 * the submission. That is the price of the control telling the truth.
 *
 * **The slider's `min` is a page rule; the start value is not.** A question
 * standing on its own step draws a slider too, and its field has never been
 * seeded — giving it one here would make a required slider arrive answered on
 * a step where it never did, which is precisely what story 118's step 3 is
 * measuring before anything is built on it. A start value has no such history:
 * it applies wherever the panel offers it, which is why `startValueOf` is
 * public and the slider rule stays inside `forPage`.
 */
export class ArrivalValueService {
  /**
   * What the redaktör put in this field, for a visitor who has not answered it.
   *
   * `undefined` for a field with no start value, for one the visitor has
   * already answered — `""` is an answer — and for one with no variable to
   * store it in.
   */
  static startValueOf(node: FlowNodeData, answers: Answers = {}): string | undefined {
    const name = typeof node.data.variableName === "string" ? node.data.variableName : "";

    if (name === "" || answers[name] !== undefined) {
      return undefined;
    }

    if (node.type === "number-question") {
      /*
       * A number, as the panel stores it. An emptied box is `null` there, and
       * `typeof null` is not "number", so clearing the field removes the start
       * value rather than starting everyone at zero.
       */
      return typeof node.data.startValue === "number" && Number.isFinite(node.data.startValue)
        ? String(node.data.startValue)
        : undefined;
    }

    if (node.type === "date-question") {
      /*
       * Read by the same function as `min` and `max`, so every spelling they
       * take this one takes: an ISO date, "idag" resolved the day the guide is
       * opened rather than the day it was saved (story 044), and `{{variabel}}`
       * read out of the visitor's own answers (story 087).
       *
       * Johan 15/9, asked whether the variable should be left out here:
       * *"Fast vi har det på andra ställen. Måste vara lika."* One reader for
       * every date a graph writes — a second one would be the next thing to
       * drift, and a spelling that works as a bound but not as a start value
       * is a rule nobody could guess.
       */
      return typeof node.data.startValue === "string"
        ? resolveDateBound(node.data.startValue, answers)
        : undefined;
    }

    return undefined;
  }

  /**
   * The page's answers completed with what its fields show on arrival.
   *
   * Called with no answers it *is* the arrival picture: a variable missing
   * from the result is a field the visitor meets empty.
   */
  static forPage(
    nodes: readonly FlowNodeData[],
    page: FlowNodeData,
    answers: Answers = {}
  ): Answers {
    const starts: Answers = {};

    for (const node of nodes) {
      if (node.parentPageId !== page.id) {
        continue;
      }

      const name = typeof node.data.variableName === "string" ? node.data.variableName : "";

      if (name === "" || answers[name] !== undefined) {
        continue;
      }

      const start = this.startValueOf(node, answers);

      if (start !== undefined) {
        starts[name] = start;
        continue;
      }

      if (
        node.data.presentation !== "range" ||
        typeof node.data.min !== "number" ||
        typeof node.data.max !== "number"
      ) {
        continue;
      }

      starts[name] = String(node.data.min);
    }

    return Object.keys(starts).length === 0 ? answers : { ...answers, ...starts };
  }
}

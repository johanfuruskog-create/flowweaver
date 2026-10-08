import { readPath, type Answers } from "../core/answer-values";
import { resolveText } from "../core/localized-text";
import { evaluateCondition } from "../core/rule-evaluator";
import { interpolate, t } from "../core/ui-strings";
import { QuestionOptionsService } from "./question-options-service";
import { QuestionVariableService } from "./question-variable-service";

import type { ConditionalVisibility, FlowNodeData } from "../types/graph";

/**
 * Anything that can be conditional: a field on a page (story 077) or a single
 * option in a question (story 134). Both carry the same `visibility`, so both
 * are judged here — one evaluation, not two (PRAXIS 15).
 */
export interface ConditionalSubject {
  visibility?: ConditionalVisibility;
}

export class PageVisibilityService {
  static isVisible(
    subject: ConditionalSubject,
    answers: Answers
  ): boolean {
    const visibility = subject.visibility;
    if (!visibility || visibility.conditions.length === 0) return true;

    const matches = visibility.conditions.map((condition) => {
      // Genom `readPath`, så ett villkor kan namnge en del: `land.value`.
      const värde = condition.variableName
        ? readPath(answers, condition.variableName)
        : undefined;

      if (värde === undefined) {
        return false;
      }

      const result = evaluateCondition(condition, värde);

      return result.success && result.matches;
    });

    return visibility.match === "any"
      ? matches.some(Boolean)
      : matches.every(Boolean);
  }

  /**
   * The band on a conditional field: *Visas bara om Kontaktväg är E-post*.
   *
   * Story 077: the editor's words, not the developer's. The subject is what
   * the question whose variable the condition names is called — alias first,
   * then title, see `QuestionVariableService.getLabel` — the value is
   * that question's matching option label — both in the guide's language
   * (`contentLocale`); the chrome around them comes from the string registry
   * in the editor's (`locale`). Without the question, or without a matching
   * option, the name and the raw value stand as they are: `email` is still
   * better than nothing, and a dangling name is worth seeing.
   *
   * Only the first condition is spelled out; an ellipsis says there are more.
   *
   * ## What `id` is, and why an option borrows the node's
   *
   * It names the node whose own variable the condition must not be read from —
   * a question cannot be shown on its own answer. An option's condition is the
   * same: it is read when the question is drawn, before anybody has answered
   * it. So the caller passes the OWNING node's id beside the option's
   * visibility (story 134), not the option's own — an option id would silently
   * match nothing and the exclusion would stop working.
   */
  static getBadgeLabel(
    conditional: ConditionalSubject & { id: string },
    context: {
      nodes?: readonly FlowNodeData[];
      locale?: string;
      contentLocale?: string;
    } = {},
  ): string | null {
    const condition = conditional.visibility?.conditions[0];
    if (!condition?.variableName) return null;

    const question = context.nodes?.find(
      (candidate) =>
        candidate.id !== conditional.id &&
        candidate.data.variableName === condition.variableName,
    );
    const subject =
      (question && QuestionVariableService.getLabel(question, context.contentLocale)) ||
      condition.variableName;
    const option = question
      ? QuestionOptionsService.getOptions(question).find(
          (candidate) => candidate.value === condition.value,
        )
      : undefined;
    const value =
      (option && resolveText(option.label, context.contentLocale)) ||
      condition.value;
    const more = (conditional.visibility?.conditions.length ?? 0) > 1 ? " …" : "";

    return interpolate(t("editor.node.visibleIf", context.locale), {
      subject,
      operator: t(`editor.node.operator.${condition.operator}`, context.locale),
      value,
      more,
    });
  }

}
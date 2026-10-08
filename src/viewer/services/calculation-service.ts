import { answerText, type Answers } from "../core/answer-values";
import { TODAY_VARIABLE, todayIso } from "../core/date-math";
import { evaluateFormula } from "../core/formula-evaluator";
import { isLocalizedTextMap, resolveText, type LocaleCode, type LocalizedText } from "../core/localized-text";

import type { CalculationAssignment, FlowNodeData } from "../types/graph";

export interface AssignmentResult {
  id: string;
  variableName: string;
  success: boolean;
  value?: number;
  error?: string;
}

export interface CalculationOutcome {
  /** The answer map completed with the computed variables (as strings). */
  answers: Answers;
  /** Per row: did it succeed, with which value or which error. For debugging. */
  results: AssignmentResult[];
}

export class CalculationService {
  static getAssignments(node: FlowNodeData): CalculationAssignment[] {
    return this.parseAssignments(node.data.assignments);
  }

  static parseAssignments(value: unknown): CalculationAssignment[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is CalculationAssignment => {
      if (typeof item !== "object" || item === null) {
        return false;
      }
      const candidate = item as Record<string, unknown>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.variableName === "string" &&
        typeof candidate.formula === "string" &&
        (candidate.label === undefined || typeof candidate.label === "string" || isLocalizedTextMap(candidate.label))
      );
    });
  }

  static createAssignment(): CalculationAssignment {
    return { id: crypto.randomUUID(), variableName: "", formula: "" };
  }

  static updateAssignment(
    assignments: CalculationAssignment[],
    assignmentId: string,
    property: "variableName" | "formula" | "label",
    value: string | LocalizedText
  ): CalculationAssignment[] {
    return assignments.map((item) =>
      item.id === assignmentId ? { ...item, [property]: value } : item
    );
  }

  static moveAssignment(
    assignments: CalculationAssignment[],
    assignmentId: string,
    direction: "up" | "down"
  ): CalculationAssignment[] {
    const index = assignments.findIndex((item) => item.id === assignmentId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= assignments.length) {
      return assignments;
    }
    const updated = [...assignments];
    [updated[index], updated[target]] = [updated[target]!, updated[index]!];
    return updated;
  }

  /** Namnen som noden producerar (icke-tomma), i ordning. */
  static getProducedVariables(node: FlowNodeData): string[] {
    return this.getProducedEntries(node).map((entry) => entry.name);
  }

  /**
   * Name and label per produced variable, in order. The label is the row's
   * own (story 078) and falls back to the name, so a row without one reads
   * exactly as before.
   */
  static getProducedEntries(node: FlowNodeData, locale?: LocaleCode): { name: string; label: string }[] {
    return this.getAssignments(node)
      .map((assignment) => ({
        name: assignment.variableName.trim(),
        label: resolveText(assignment.label, locale).trim() || assignment.variableName.trim(),
      }))
      .filter((entry) => entry.name.length > 0);
  }

  /**
   * Runs the node's rows top to bottom against the current answers. Every
   * successful row becomes available to the rows below. Failed rows set no
   * variable but are reported in the result.
   */
  static run(
    node: FlowNodeData,
    answers: Answers
  ): CalculationOutcome {
    const numeric = this.toNumericMap(answers);
    const texts = this.toTextMap(answers);
    const nextAnswers = { ...answers };
    const results: AssignmentResult[] = [];

    for (const assignment of this.getAssignments(node)) {
      const variableName = assignment.variableName.trim();
      const formula = assignment.formula.trim();

      if (variableName.length === 0 || formula.length === 0) {
        continue;
      }

      const result = evaluateFormula(formula, numeric, { texts });
      if (result.success) {
        numeric[variableName] = result.value;
        nextAnswers[variableName] = String(result.value);
        results.push({
          id: assignment.id,
          variableName,
          success: true,
          value: result.value,
        });
      } else {
        results.push({
          id: assignment.id,
          variableName,
          success: false,
          error: result.error,
        });
      }
    }

    return { answers: nextAnswers, results };
  }

  /**
   * The page's calculations (story 095): every calculation child, in the
   * page's order, run over `answers` — the engine's answers plus the page's
   * fields as they are right now. Each row's result is available to the
   * next, so a second calculation may read the first's variable.
   *
   * One function for both callers: the viewer runs it on every keystroke to
   * redraw the page's texts, the engine runs it once at Nästa to store the
   * variables. A field that is empty gives no number and therefore no
   * variable — the text keeps its placeholder rather than showing `NaN`.
   */
  static runInPage(nodes: readonly FlowNodeData[], page: FlowNodeData, answers: Answers): Answers {
    return nodes
      .filter((node) => node.parentPageId === page.id && node.type === "calculation")
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      .reduce((current, node) => this.run(node, current).answers, answers);
  }

  /**
   * Every answer as text, for `age` and `days` (story 086). `idag` is what
   * the engine stamped; a caller without an engine — a test, a host running
   * the service on its own — gets the clock, so `days(flytt; idag)` never
   * fails for want of a day.
   */
  private static toTextMap(answers: Answers): Record<string, string> {
    const texts: Record<string, string> = {};
    for (const [name, raw] of Object.entries(answers)) {
      texts[name] = answerText(raw);
    }
    texts[TODAY_VARIABLE] ??= todayIso();
    return texts;
  }

  private static toNumericMap(
    answers: Answers
  ): Record<string, number> {
    const numeric: Record<string, number> = {};
    for (const [name, raw] of Object.entries(answers)) {
      /*
       * Ett listsvar har ingen storlek. `answerText` ger "Danmark, Tyskland",
       * som inte är ett tal, och variabeln utelämnas — vilket är rätt: en
       * uträkning på ett flerval är en felskriven uträkning, och den ska säga
       * det genom att sakna sitt tal, inte genom att räkna på noll.
       */
      const text = answerText(raw).trim();
      /*
       * Empty is not zero. `Number("")` is 0, so a field the visitor has not
       * filled in made the loan cost 0 kr/mån while they were still typing
       * (story 095). No number means no variable, and the text keeps its
       * placeholder.
       */
      const parsed = text === "" ? Number.NaN : Number(text.replace(",", "."));
      if (Number.isFinite(parsed)) {
        numeric[name] = parsed;
      }
    }
    return numeric;
  }
}

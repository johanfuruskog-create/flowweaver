import type { FlowNodeData, RuleCase, RuleCondition } from "../types/graph";

/** Why a case was not usable — the clause of the definition it failed. */
export type RejectedCaseReason = "shape" | "id" | "label" | "match" | "conditions";

/** A case the parser could not use, and where it stood. */
export interface RejectedCase {
  /** Its place in the rule's list, so the editor can be told which one. */
  index: number;
  /** Its id when it had one — the only handle an editor may recognise. */
  id?: string;
  reason: RejectedCaseReason;
}

export class RuleCasesService {
  static getCases(node: FlowNodeData): RuleCase[] {
    return this.parseCases(node.data.cases);
  }

  static parseCases(value: unknown): RuleCase[] {
    return this.partitionCases(value).cases;
  }

  /**
   * The usable cases **and** the ones that were not, from one reading.
   *
   * ## Why the discards are handed back rather than checked again elsewhere
   *
   * The viewer has to keep going: a rule case from an older file, or one a
   * host's own tooling wrote, must not stop a guide a visitor is standing in.
   * So dropping it is right — but dropping it *in silence* is how a rule ends
   * up with no cases at all and takes its fallback for every visitor, with
   * every variable holding the correct number and nothing looking broken.
   *
   * Measured 14/9: written by hand into the conference guide, a label as
   * `{ sv, en }` sent **every** visitor to the waiting list. It is PRAXIS 5's
   * most expensive line, and going in with the rule freshly read is what says
   * the shape is easy to get wrong rather than the person careless.
   *
   * The editor's health check needs the same judgement, and writing "is the
   * label a string?" a second time there would put **one definition of a valid
   * case in two files** — the drift this codebase pays for most often. So there
   * is one reading, and it returns both halves. `parseCases` keeps its exact
   * old behaviour for every caller that only wants the usable ones.
   */
  static partitionCases(value: unknown): { cases: RuleCase[]; rejected: RejectedCase[] } {
    if (!Array.isArray(value)) {
      return { cases: [], rejected: [] };
    }

    const cases: RuleCase[] = [];
    const rejected: RejectedCase[] = [];

    value.forEach((item, index) => {
      const reason = this.reasonToReject(item);

      if (reason === null) {
        cases.push(item as RuleCase);
        return;
      }

      const id = (item as { id?: unknown } | null)?.id;
      rejected.push({
        index,
        ...(typeof id === "string" ? { id } : {}),
        reason,
      });
    });

    return { cases, rejected };
  }

  /** The clause a case fails, or `null` when it is usable. */
  private static reasonToReject(item: unknown): RejectedCaseReason | null {
    if (typeof item !== "object" || item === null) return "shape";

    const candidate = item as Record<string, unknown>;

    if (typeof candidate.id !== "string") return "id";
    if (typeof candidate.label !== "string") return "label";
    if (candidate.match !== "all" && candidate.match !== "any") return "match";
    if (
      !Array.isArray(candidate.conditions) ||
      !candidate.conditions.every((condition) => this.isCondition(condition))
    ) {
      return "conditions";
    }

    return null;
  }

  static createCase(index: number): RuleCase {
    return {
      id: crypto.randomUUID(),
      label: `Regel ${index + 1}`,
      match: "all",
      conditions: [this.createCondition()],
    };
  }

  static createCondition(): RuleCondition {
    return {
      id: crypto.randomUUID(),
      variableName: "",
      operator: "equals",
      value: "",
    };
  }

  static updateCase(
    cases: RuleCase[],
    caseId: string,
    property: "label" | "match",
    value: string
  ): RuleCase[] {
    return cases.map((item) =>
      item.id === caseId ? { ...item, [property]: value } as RuleCase : item
    );
  }

  static updateCondition(
    cases: RuleCase[],
    caseId: string,
    conditionId: string,
    property: "variableName" | "operator" | "value",
    value: string
  ): RuleCase[] {
    return cases.map((item) =>
      item.id === caseId
        ? {
            ...item,
            conditions: item.conditions.map((condition) =>
              condition.id === conditionId
                ? {
                    ...condition,
                    [property]: value,
                    ...(property === "variableName" ? { value: "" } : {}),
                  }
                : condition
            ),
          }
        : item
    );
  }

  private static isCondition(value: unknown): value is RuleCondition {
    if (typeof value !== "object" || value === null) return false;
    const item = value as Record<string, unknown>;
    return typeof item.id === "string" &&
      typeof item.variableName === "string" &&
      (item.operator === "equals" ||
        item.operator === "not-equals" ||
        item.operator === "greater-than" ||
        item.operator === "greater-than-or-equal" ||
        item.operator === "less-than" ||
        item.operator === "less-than-or-equal" ||
        item.operator === "one-of" ||
        item.operator === "not-one-of" ||
        // Missing here, a condition is dropped on load without a sound — so a
        // new operator that is not added is a rule that quietly disappears.
        item.operator === "all-of" ||
        item.operator === "not-all-of") &&
      typeof item.value === "string";
  }

  static moveCase(
    cases: RuleCase[],
    caseId: string,
    direction: "up" | "down"
  ): RuleCase[] {
    const index = cases.findIndex((item) => item.id === caseId);
    const target = direction === "up" ? index - 1 : index + 1;

    if (index < 0 || target < 0 || target >= cases.length) {
      return cases;
    }

    const updated = [...cases];
    [updated[index], updated[target]] = [updated[target]!, updated[index]!];
    return updated;
  }
}

import { answerList, answerText, readPath, type AnswerValue, type Answers } from "./answer-values";
import type { FlowNodeData } from "../types/graph";
import { RuleCasesService } from "../services/rule-cases-service";

export type RuleOperator = import("../types/graph").RuleCondition["operator"];

export type RuleEvaluationResult =
  | { success: true; portId: string }
  | { success: false; message: string };

export function getPossibleRulePortIds(
  node: FlowNodeData,
  answers: Answers
): string[] {
  const possible: string[] = [];

  for (const item of RuleCasesService.getCases(node)) {
    const states = item.conditions.map((condition): boolean | null => {
      const värde = readPath(answers, condition.variableName);

      if (värde === undefined) return null;

      const result = evaluateCondition(condition, värde);
      return result.success ? result.matches : null;
    });
    const definitelyTrue = item.match === "all"
      ? states.every((state) => state === true)
      : states.some((state) => state === true);
    const definitelyFalse = item.match === "all"
      ? states.some((state) => state === false)
      : states.every((state) => state === false);

    if (definitelyFalse) continue;
    possible.push(item.id);
    if (definitelyTrue) return possible;
  }

  return [...possible, "default"];
}

/**
 * The operators that read `value` as a list, and the answer as one too.
 *
 * They are asked for in three places — the evaluator's branch and both
 * `<select>`s in the properties panel, where they decide whether the value is
 * picked as one or as several — and the panel had the membership written out
 * by hand twice. Two hand-written copies of a set is the drift this codebase
 * pays for most often, so the set lives here, beside the code that gives it
 * meaning.
 */
const LIST_OPERATORS = ["one-of", "not-one-of", "all-of", "not-all-of"] as const;

export function isListOperator(operator: RuleOperator): boolean {
  return (LIST_OPERATORS as readonly string[]).includes(operator);
}

export function evaluateCondition(
  condition: import("../types/graph").RuleCondition,
  answer: AnswerValue,
): { success: true; matches: boolean } | { success: false } {
  /*
   * Ett svar kan vara flera. `equals` jämför mot hela svaret som text — vilket
   * är rätt för ett ensamt värde och avsiktligt strängt för en lista: den som
   * menar "innehåller" har `one-of`, och `equals` mot en lista ska inte tyst
   * bli något annat än det står.
   */
  const text = answerText(answer);

  if (condition.operator === "equals") return { success: true, matches: text === condition.value };
  if (condition.operator === "not-equals") return { success: true, matches: text !== condition.value };

  if (isListOperator(condition.operator)) {
    /*
     * Empty entries are dropped rather than matched.
     *
     * `"SE,,DK"` and a trailing comma are what a half-finished edit looks like,
     * and matching an empty answer against the empty entry would make the case
     * true for everybody who had not answered — the widest branch there is,
     * arrived at by a typo.
     */
    const wanted = condition.value
      .split(",")
      .map((one) => one.trim())
      .filter((one) => one !== "");
    /*
     * The answer may itself be several, and `answerList` is what knows the
     * shapes it can arrive in — one value, a list, or a list of objects read by
     * their label. Comparing the whole answer against the list matched nothing
     * when it held more than one, silently, always in favour of the default
     * branch. Found when the citizenship guide went from *which* citizenship to
     * *which ones*.
     *
     * Any, not all, because that is what is being asked. *Do you hold EU
     * citizenship* is true of somebody with a Swedish and a Turkish one. Which
     * makes `not-one-of` its mirror — true only when none of the answers is in
     * the list — the only reading that lets "neither" be expressed.
     *
     * A single answer is a list of one, so everything written before this
     * behaves exactly as it did.
     */
    const given = answerList(answer);

    if (condition.operator === "one-of" || condition.operator === "not-one-of") {
      const found = given.some((one) => wanted.includes(one));

      return { success: true, matches: condition.operator === "one-of" ? found : !found };
    }

    /*
     * `all-of` and `not-all-of`: the other two questions a set has.
     *
     * An empty answer is false for BOTH, which is why the length is tested
     * before `every` rather than left to it. `[].every(...)` is true, so
     * `all-of` would have been true for everybody who had not answered — the
     * widest branch there is, exactly the mistake the empty entries above are
     * dropped to avoid. And `not-all-of` must not be its negation there
     * either: it is the wider of the two, and it is `not-one-of` that carries
     * the reading "has not answered, so is not in the list".
     *
     * On a single answer these are `one-of` and `not-one-of` exactly. That
     * equivalence is what `rule-all-of.test.ts` holds, and it is why the
     * editor does not offer them on a single-valued variable.
     */
    if (given.length === 0) return { success: true, matches: false };

    const every = given.every((one) => wanted.includes(one));

    return { success: true, matches: condition.operator === "all-of" ? every : !every };
  }
  /*
   * Härifrån jämförs `text`, inte `answer`: tal och datum är ensamma värden,
   * och en lista har ingen storlek att jämföra. Ett listsvar faller igenom som
   * obestämt, vilket är rätt — inte som noll.
   *
   * Dates before numbers, because an ISO date is not a number and would
   * otherwise come back indeterminate — which is what made "efter den första
   * mars" impossible to express while the date field stored its answer
   * perfectly well.
   *
   * Compared as text: `YYYY-MM-DD` sorts correctly that way, which is the
   * property the format was designed around. Parsing would introduce a
   * timezone, and a timezone would introduce a day that is right in Stockholm
   * and wrong in Berlin.
   */
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const answerIsDate = ISO_DATE.test(text.trim());
  const valueIsDate = ISO_DATE.test(condition.value.trim());

  if (answerIsDate || valueIsDate) {
    // One of each is a misconfigured rule. Indeterminate is the honest answer,
    // and it is one the caller already knows how to handle.
    if (!answerIsDate || !valueIsDate) {
      return { success: false };
    }

    const here = text.trim();
    const there = condition.value.trim();

    return {
      success: true,
      matches:
        condition.operator === "greater-than"
          ? here > there
          : condition.operator === "greater-than-or-equal"
            ? here >= there
            : condition.operator === "less-than"
              ? here < there
              : here <= there,
    };
  }

  const left = Number(text);
  const right = Number(condition.value);
  if (text.trim() === "" || condition.value.trim() === "" || !Number.isFinite(left) || !Number.isFinite(right)) {
    return { success: false };
  }
  return {
    success: true,
    matches: condition.operator === "greater-than"
      ? left > right
      : condition.operator === "greater-than-or-equal"
        ? left >= right
        : condition.operator === "less-than"
          ? left < right
          : left <= right,
  };
}

export function evaluateRule(
  node: FlowNodeData,
  answers: Answers
): RuleEvaluationResult {
  if (node.type !== "rule") {
    return { success: false, message: `Noden "${node.id}" är ingen regel.` };
  }

  for (const item of RuleCasesService.getCases(node)) {
    /*
     * En saknad VARIABEL är en felkonfigurerad guide — en regel på något
     * ingenting producerar — och den ska säga ifrån. En saknad DEL är bara
     * data: `land.value` på ett land utan kod betyder att villkoret inte
     * stämmer, inte att guiden är trasig.
     *
     * Därför prövas roten och inte hela vägen. Utan den skillnaden vägrade
     * regeln med "Variabeln har inget svar" om ett enda svar råkade sakna sin
     * del, och besökaren fastnade på ett steg.
     */
    const missingVariable = item.conditions.find((condition) => {
      const root = (condition.variableName ?? "").split(".")[0] ?? "";

      return !condition.variableName || !(root in answers);
    })?.variableName;

    if (missingVariable !== undefined) {
      return {
        success: false,
        message: missingVariable
          ? `Variabeln "${missingVariable}" har inget svar.`
          : "Regeln har ett villkor som saknar variabel.",
      };
    }

    const matches: boolean[] = [];
    for (const condition of item.conditions) {
      /*
       * Genom `readPath`, så ett villkor kan namnge en DEL: `land.value` är
       * koden ur varje valt land. Det var enda skälet att en kod fick bo i en
       * egen variabel bredvid sin etikett, med de två i takt för hand.
       */
      const answer = readPath(answers, condition.variableName) ?? "";
      const evaluation = evaluateCondition(condition, answer);
      if (!evaluation.success) {
        return {
          success: false,
          message: `Villkoret för "${condition.variableName}" kräver giltiga tal.`,
        };
      }
      matches.push(evaluation.matches);
    }
    const caseMatches = matches.length > 0 &&
      (item.match === "all" ? matches.every(Boolean) : matches.some(Boolean));

    if (caseMatches) return { success: true, portId: item.id };
  }

  return { success: true, portId: "default" };
}

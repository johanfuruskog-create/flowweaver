import { describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";

import { GuideHealthService } from "./guide-health-service";
import { QuestionVariableService } from "../../viewer/services/question-variable-service";

import type { GraphData } from "../../viewer/types/graph";
import type { GuideHealthIssue } from "./guide-health-service";

/**
 * A lookup question sets two variables, and the editor must know about both.
 *
 * ## The failure this is written from
 *
 * The citizenship example was built, clicked through in a browser, and worked:
 * pick Germany, land on the permit result. The editor showed **six errors**
 * beside it — one per rule condition — all of them saying that the rule reads
 * `land.value` "som ingen fråga sätter".
 *
 * The guide was right and the editor was wrong. `autocomplete-question` stores
 * the label in `variableName` and the code in `codeVariableName`, and the second
 * one is the whole point: labels are translated, codes are not, so a rule that
 * survives a change of language has to branch on the code. The viewer sets it —
 * `page-fields-service` has known about it all along — and the health check
 * collected only `variableName`.
 *
 * ## Why it matters more than a wrong count
 *
 * A false error is worse than no check. It teaches whoever is building the guide
 * that the health panel is noise, and the day it reports something real they
 * will have learnt to scroll past it. That is the cost being paid here, not six
 * red rows.
 */

const guide = (): GraphData =>
  ({
    startNodeId: "land",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "land",
        type: "autocomplete-question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Vilket land?" },
          variableName: "land",
                    source: "codelist",
          codeListId: "navet-country-codes",
        },
      },
      {
        id: "regel",
        type: "rule",
        position: { x: 400, y: 0 },
        data: {
          title: { sv: "Var ansöker du?" },
          fallbackLabel: "Annars",
          cases: [
            {
              id: "norden",
              label: "Norden",
              match: "any",
              conditions: [
                { id: "c1", variableName: "land.value", operator: "equals", value: "SE" },
              ],
            },
          ],
        },
      },
      { id: "klar", type: "result", position: { x: 800, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "a", from: { nodeId: "land", portId: "continue" }, to: { nodeId: "regel", portId: "input" } },
      { id: "b", from: { nodeId: "regel", portId: "norden" }, to: { nodeId: "klar", portId: "input" } },
      { id: "c", from: { nodeId: "regel", portId: "default" }, to: { nodeId: "klar", portId: "input" } },
    ],
  }) as unknown as GraphData;

describe("the code a lookup question stores", () => {
  test("counts as a variable something sets", () => {
    const names = QuestionVariableService.getOptions(guide()).map((one) => one.value);

    expect(names).toContain("land.label");
    expect(names).toContain("land.value");
  });

  test("does not make a rule that reads it look broken", () => {
    const issues = GuideHealthService.analyze(guide());
    const unset = issues.filter((issue: GuideHealthIssue) => issue.code === "unset-rule-variable");

    expect(unset).toEqual([]);
  });

  test("a rule reading a name nothing sets is still an error", () => {
    // Without this the fix could be "stop checking", which would pass the test
    // above and lose the check that was worth having.
    const broken = guide();
    const rule = broken.nodes.find((node) => node.id === "regel");

    (rule?.data as { cases: Array<{ conditions: Array<{ variableName: string }> }> })
      .cases[0]!.conditions[0]!.variableName = "finns-inte";

    const issues = GuideHealthService.analyze(broken);

    expect(issues.some((issue: GuideHealthIssue) => issue.code === "unset-rule-variable")).toBe(true);
  });

  test("an empty code field adds no variable at all", () => {
    const without = guide();
    const field = without.nodes.find((node) => node.id === "land");

    (field?.data as { codeVariableName: string }).codeVariableName = "";

    const names = QuestionVariableService.getOptions(without).map((one) => one.value);

    expect(names).toContain("land.label");
    expect(names).not.toContain("");
  });
});

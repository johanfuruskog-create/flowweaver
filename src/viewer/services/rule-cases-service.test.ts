import { describe, expect, test } from "vitest";

import { RuleCasesService } from "./rule-cases-service";

import type { RuleCase } from "../types/graph";

const cases: RuleCase[] = [
  { id: "adult", label: "Om vuxen", match: "all", conditions: [{ id: "age-1", variableName: "age", operator: "equals", value: "adult" }] },
  { id: "young", label: "Om ung", match: "all", conditions: [{ id: "age-2", variableName: "age", operator: "equals", value: "young" }] },
];

describe("RuleCasesService", () => {
  test("updates the label without changing the port's id", () => {
    expect(
      RuleCasesService.updateCase(cases, "adult", "label", "Om över 18")[0]
    ).toEqual({
      id: "adult",
      label: "Om över 18",
      match: "all",
      conditions: [{ id: "age-1", variableName: "age", operator: "equals", value: "adult" }],
    });
  });

  test("updates conditions and clears the value when the variable changes", () => {
    const updated = RuleCasesService.updateCondition(
      cases, "adult", "age-1", "variableName", "gender"
    );
    expect(updated[0]?.conditions[0]).toMatchObject({
      id: "age-1",
      variableName: "gender",
      value: "",
    });
  });

  // Story 143 (Per): operatorn hör inte till fältväljaren och ska stå orörd
  // när variabeln byts — bara värdet nollställs (variabeln avgör vilka
  // alternativ operatorn erbjuder, men det är renderingen som väljer om, inte
  // ett skrivet default här).
  test("byter man variabel rör det inte operatorn", () => {
    const withOperator: RuleCase[] = [
      { id: "amount", label: "Om belopp", match: "all", conditions: [{ id: "amount-1", variableName: "inkomst", operator: "greater-than", value: "1000" }] },
    ];
    const updated = RuleCasesService.updateCondition(
      withOperator, "amount", "amount-1", "variableName", "annan_inkomst"
    );
    expect(updated[0]?.conditions[0]?.operator, "operatorn står kvar").toBe("greater-than");
  });

  test("flyttar villkor utan att mutera originalet", () => {
    const moved = RuleCasesService.moveCase(cases, "young", "up");

    expect(moved.map((item) => item.id)).toEqual(["young", "adult"]);
    expect(cases.map((item) => item.id)).toEqual(["adult", "young"]);
  });
});

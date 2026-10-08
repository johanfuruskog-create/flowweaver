import { describe, expect, test } from "vitest";

import { evaluateRule } from "./rule-evaluator";

import type { FlowNodeData } from "../types/graph";

const createRule = (): FlowNodeData => ({
  id: "age-rule",
  type: "rule",
  position: { x: 0, y: 0 },
  data: {
    title: "Kontrollera ålder",
    cases: [
      { id: "adult", label: "Om över 18", match: "all", conditions: [{ id: "adult-age", variableName: "ageGroup", operator: "equals", value: "adult" }] },
      { id: "young", label: "Om 16–17", match: "all", conditions: [{ id: "young-age", variableName: "ageGroup", operator: "equals", value: "young" }] },
    ],
    fallbackLabel: "Annars",
  },
});

describe("evaluateRule", () => {
  test("returns the first matching branch's stable id", () => {
    expect(evaluateRule(createRule(), { ageGroup: "adult" })).toEqual({
      success: true,
      portId: "adult",
    });
    expect(evaluateRule(createRule(), { ageGroup: "young" })).toEqual({
      success: true,
      portId: "young",
    });
  });

  test("uses Otherwise when no condition matches", () => {
    expect(evaluateRule(createRule(), { ageGroup: "child" })).toEqual({
      success: true,
      portId: "default",
    });
  });

  test("evaluates the conditions top to bottom", () => {
    const rule = createRule();
    rule.data.cases = [
      { id: "not-adult", label: "Inte vuxen", match: "all", conditions: [{ id: "not-adult-age", variableName: "ageGroup", operator: "not-equals", value: "adult" }] },
      { id: "young", label: "Ungdom", match: "all", conditions: [{ id: "young-age", variableName: "ageGroup", operator: "equals", value: "young" }] },
    ];

    expect(evaluateRule(rule, { ageGroup: "young" })).toEqual({
      success: true,
      portId: "not-adult",
    });
  });

  test("can require all or at least one of several conditions", () => {
    const rule = createRule();
    rule.data.cases = [{
      id: "adult-man",
      label: "Vuxen man",
      match: "all",
      conditions: [
        { id: "age", variableName: "isAdult", operator: "equals", value: "yes" },
        { id: "gender", variableName: "gender", operator: "equals", value: "male" },
      ],
    }];

    expect(evaluateRule(rule, { isAdult: "yes", gender: "male" })).toMatchObject({ portId: "adult-man" });
    expect(evaluateRule(rule, { isAdult: "yes", gender: "female" })).toMatchObject({ portId: "default" });

    (rule.data.cases as Array<{ match: string }>)[0]!.match = "any";
    expect(evaluateRule(rule, { isAdult: "yes", gender: "female" })).toMatchObject({ portId: "adult-man" });
  });

  test("compares numbers with inclusive and exclusive bounds", () => {
    const rule = createRule();
    rule.data.cases = [{
      id: "older",
      label: "Äldre",
      match: "all",
      conditions: [{ id: "age", variableName: "age", operator: "greater-than-or-equal", value: "65" }],
    }];

    expect(evaluateRule(rule, { age: "65" })).toMatchObject({ portId: "older" });
    expect(evaluateRule(rule, { age: "64" })).toMatchObject({ portId: "default" });
    (rule.data.cases as Array<{ conditions: Array<{ operator: string }> }>)[0]!.conditions[0]!.operator = "less-than";
    expect(evaluateRule(rule, { age: "64" })).toMatchObject({ portId: "older" });
  });

  test("rapporterar ogiltiga tal i numeriska villkor", () => {
    const rule = createRule();
    rule.data.cases = [{
      id: "older",
      label: "Äldre",
      match: "all",
      conditions: [{ id: "age", variableName: "age", operator: "greater-than", value: "65" }],
    }];
    expect(evaluateRule(rule, { age: "inte ett tal" })).toMatchObject({ success: false });
  });

  test("rapporterar ett saknat svar", () => {
    expect(evaluateRule(createRule(), {})).toMatchObject({
      success: false,
      message: expect.stringContaining("inget svar"),
    });
  });
});

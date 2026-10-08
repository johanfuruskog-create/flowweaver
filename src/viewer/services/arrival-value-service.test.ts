import { describe, expect, test } from "vitest";

import { ArrivalValueService } from "./arrival-value-service";

import type { FlowNodeData } from "../types/graph";

const page: FlowNodeData = {
  id: "page",
  type: "page",
  position: { x: 0, y: 0 },
  data: {},
};

const otherPage: FlowNodeData = {
  id: "other-page",
  type: "page",
  position: { x: 0, y: 0 },
  data: {},
};

function rangeField(overrides: Record<string, unknown> = {}): FlowNodeData {
  return {
    id: "field",
    type: "number-question",
    position: { x: 0, y: 0 },
    parentPageId: page.id,
    data: {
      variableName: "belopp",
      presentation: "range",
      min: 10000,
      max: 50000,
      ...overrides,
    },
  };
}

describe("ArrivalValueService.forPage", () => {
  test("seedar ett reglage med båda ändar som tal, min som sträng", () => {
    const result = ArrivalValueService.forPage([rangeField()], page);

    expect(result["belopp"]).toBe("10000");
    expect(typeof result["belopp"]).toBe("string");
  });

  test("seedar inte en stepper — den visar inget läge att hålla", () => {
    const node = rangeField({ presentation: "stepper" });
    const result = ArrivalValueService.forPage([node], page);

    expect(result["belopp"]).toBeUndefined();
  });

  test("seedar inte ett reglage utan max", () => {
    const node = rangeField({ max: undefined });
    const result = ArrivalValueService.forPage([node], page);

    expect(result["belopp"]).toBeUndefined();
  });

  test("lämnar ett befintligt svar orört, inklusive ett tomt", () => {
    const node = rangeField();

    expect(ArrivalValueService.forPage([node], page, { belopp: "25000" })).toMatchObject({
      belopp: "25000",
    });
    expect(ArrivalValueService.forPage([node], page, { belopp: "" })).toMatchObject({
      belopp: "",
    });
  });

  test("rör inte ett fält som hör till en annan sida", () => {
    const node = rangeField({}); // parentPageId: page.id
    const result = ArrivalValueService.forPage([node], otherPage);

    expect(result["belopp"]).toBeUndefined();
  });

  test("anropad utan answers ger ankomstbilden direkt", () => {
    const result = ArrivalValueService.forPage([rangeField()], page);

    expect(result).toEqual({ belopp: "10000" });
  });

  test("returnerar samma objektreferens när inget läggs till", () => {
    const answers = { belopp: "25000" };
    const result = ArrivalValueService.forPage([rangeField()], page, answers);

    expect(result).toBe(answers);
  });

  test("returnerar samma (tomma) referens när inga fält alls finns på sidan", () => {
    const answers = {};
    const result = ArrivalValueService.forPage([], page, answers);

    expect(result).toBe(answers);
  });
});

function numberField(overrides: Record<string, unknown> = {}): FlowNodeData {
  return {
    id: "field",
    type: "number-question",
    position: { x: 0, y: 0 },
    parentPageId: page.id,
    data: {
      variableName: "tal",
      startValue: 10,
      ...overrides,
    },
  };
}

function dateField(overrides: Record<string, unknown> = {}): FlowNodeData {
  return {
    id: "field",
    type: "date-question",
    position: { x: 0, y: 0 },
    parentPageId: page.id,
    data: {
      variableName: "dat",
      startValue: "idag",
      ...overrides,
    },
  };
}

describe("ArrivalValueService.startValueOf", () => {
  test("ett tal, som en sträng", () => {
    expect(ArrivalValueService.startValueOf(numberField({ startValue: 10 }))).toBe("10");
  });

  test("null (en tömd ruta i panelen) ger undefined, inte startValue 0", () => {
    expect(ArrivalValueService.startValueOf(numberField({ startValue: null }))).toBeUndefined();
  });

  test("ett datum, löst av samma funktion som min/max", () => {
    expect(ArrivalValueService.startValueOf(dateField({ startValue: "2030-01-02" }))).toBe(
      "2030-01-02",
    );
  });

  test('"idag" löses till dagens datum via answers, precis som en gräns', () => {
    expect(
      ArrivalValueService.startValueOf(dateField({ startValue: "idag" }), { idag: "2030-09-15" }),
    ).toBe("2030-09-15");
  });

  test("inget svar utan ett variabelnamn", () => {
    expect(ArrivalValueService.startValueOf(numberField({ variableName: "" }))).toBeUndefined();
  });

  test("inget svar för ett fält som redan besvarats, inklusive tomt", () => {
    expect(ArrivalValueService.startValueOf(numberField(), { tal: "25" })).toBeUndefined();
    expect(ArrivalValueService.startValueOf(numberField(), { tal: "" })).toBeUndefined();
  });

  test("startValue vinner över min i forPage", () => {
    const node = rangeField({ startValue: 40, min: 0, max: 100 });
    const result = ArrivalValueService.forPage([node], page);

    expect(result["belopp"]).toBe("40");
  });
});

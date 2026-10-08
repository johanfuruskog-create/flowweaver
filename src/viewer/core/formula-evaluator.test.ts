import { describe, expect, test } from "vitest";

import { dateReferences, evaluateFormula, variableReferences } from "./formula-evaluator";

const ok = (formula: string, variables: Record<string, number> = {}): number => {
  const result = evaluateFormula(formula, variables);
  if (!result.success) throw new Error(`Väntade ett värde, fick fel: ${result.error}`);
  return result.value;
};

describe("evaluateFormula", () => {
  test("computes basic arithmetic with precedence and parentheses", () => {
    expect(ok("1 + 2 * 3")).toBe(7);
    expect(ok("(1 + 2) * 3")).toBe(9);
    expect(ok("10 / 4")).toBe(2.5);
    expect(ok("2 - 3 - 4")).toBe(-5);
  });

  test("handles unary minus and plus", () => {
    expect(ok("-5")).toBe(-5);
    expect(ok("3 * -2")).toBe(-6);
    expect(ok("-(2 + 3)")).toBe(-5);
    expect(ok("+7")).toBe(7);
  });

  test("reads decimals with both comma and dot", () => {
    expect(ok("0,15")).toBe(0.15);
    expect(ok("0.15")).toBe(0.15);
    expect(ok("pris * 0,10", { pris: 2000000 })).toBe(200000);
  });

  test("looks up variables", () => {
    expect(ok("pris - kontantinsats", { pris: 3000000, kontantinsats: 450000 })).toBe(2550000);
    expect(ok("ränta", { "ränta": 3.5 })).toBe(3.5);
  });

  test("supports the functions round/floor/ceil/abs/sqrt", () => {
    expect(ok("round(2,5)")).toBe(3);
    expect(ok("floor(2,9)")).toBe(2);
    expect(ok("ceil(2,1)")).toBe(3);
    expect(ok("abs(-4)")).toBe(4);
    expect(ok("sqrt(9)")).toBe(3);
  });

  test("pow(base; exponent) — the annuity formula needs a power (story 095)", () => {
    expect(ok("pow(2; 10)")).toBe(1024);
    expect(ok("pow(1 + r; -n)", { r: 0.5, n: 1 })).toBeCloseTo(2 / 3);
    // Lendo's example: 100 000 kr over 5 years at 6 % gives about 1 933 kr/month.
    const r = 0.06 / 12;
    expect(ok("round(lan * r / (1 - pow(1 + r; -ar * 12)))", { lan: 100000, r, ar: 5 })).toBe(1933);
    expect(evaluateFormula("pow(2)", {})).toEqual({ success: false, error: "pow tar exakt två argument" });
  });

  test("supports min and max with semicolon as separator", () => {
    expect(ok("min(10 ; 20 ; 5)")).toBe(5);
    expect(ok("max(lån ; 0)", { "lån": -100 })).toBe(0);
  });

  test("computes a whole mortgage calculation step by step", () => {
    const pris = 3000000;
    const rate = 3; // procent
    const inkomst = 600000; // årsinkomst

    const kontantinsats = ok("pris * 0,15", { pris });
    expect(kontantinsats).toBe(450000);

    const handpenning = ok("pris * 0,10", { pris });
    expect(handpenning).toBe(300000);

    // How large a loan you can get: the lower of the LTV and income caps.
    const maxLoan = ok("min(pris * 0,85 ; inkomst * 5)", { pris, inkomst });
    expect(maxLoan).toBe(2550000); // 0,85*3M = 2,55M < 5*600k = 3M

    const monthlyRate = ok("round(maxLån * (ränta / 100) / 12)", {
      "maxLån": maxLoan,
      "ränta": rate,
    });
    expect(monthlyRate).toBe(6375);
  });

  test("reports an error for an unknown variable", () => {
    const result = evaluateFormula("pris * 2", {});
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("pris");
  });

  test("reports an error for a non-numeric variable", () => {
    const result = evaluateFormula("namn + 1", { namn: Number.NaN });
    expect(result.success).toBe(false);
  });

  test("rapporterar division med noll", () => {
    const result = evaluateFormula("lån / pris", { "lån": 100, pris: 0 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("noll");
  });

  test("rejects syntax errors and unknown functions", () => {
    expect(evaluateFormula("1 +", {}).success).toBe(false);
    expect(evaluateFormula("(1 + 2", {}).success).toBe(false);
    expect(evaluateFormula("1 2", {}).success).toBe(false);
    expect(evaluateFormula("okänd(2)", {}).success).toBe(false);
    expect(evaluateFormula("", {}).success).toBe(false);
  });

  test("blockerar kodexekvering – inga JS-uttryck", () => {
    // Braces and dot access are not in the grammar.
    expect(evaluateFormula("constructor", {}).success).toBe(false);
    expect(evaluateFormula("a.b", { a: 1 }).success).toBe(false);
  });
});

/*
 * Story 086: age and days over text variables. The texts are the visitor's
 * answers as written; `idag` is what the engine stamped, or the clock.
 */
describe("age and days (story 086)", () => {
  const texts = {
    idag: "2026-09-04",
    pnr: "20080904-1234",
    aldre: "250101+1234",
    flytt: "2026-08-05",
    namn: "Anna",
    tom: "",
  };
  const run = (formula: string) => evaluateFormula(formula, {}, { texts });

  test("age from a date and from a personnummer, on the stamped today", () => {
    expect(run("age(pnr)")).toEqual({ success: true, value: 18 });
    expect(run("age(flytt)")).toEqual({ success: true, value: 0 });
    expect(run("age(aldre)")).toEqual({ success: true, value: 101 });
  });

  test("days between two dates, idag included, negative backwards", () => {
    expect(run("days(flytt; idag)")).toEqual({ success: true, value: 30 });
    expect(run("days(idag; flytt)")).toEqual({ success: true, value: -30 });
  });

  test("the result is a number the rest of the formula can use", () => {
    expect(run("age(pnr) * 2 + days(flytt; idag)")).toEqual({ success: true, value: 66 });
    expect(evaluateFormula("age(pnr) - x", { x: 3 }, { texts })).toEqual({ success: true, value: 15 });
  });

  test("an empty, misspelt or unknown variable is an error, not a number", () => {
    expect(run("age(tom)")).toEqual({ success: false, error: "tom är inte ett datum eller personnummer" });
    expect(run("age(namn)")).toEqual({ success: false, error: "namn är inte ett datum eller personnummer" });
    expect(run("age(okand)")).toEqual({ success: false, error: "okand är inte ett datum eller personnummer" });
    expect(run("age(2)")).toEqual({ success: false, error: "age tar en variabel med ett datum" });
    expect(run("days(flytt)")).toEqual({ success: false, error: "days tar två argument" });
    expect(run("age(pnr; flytt)")).toEqual({ success: false, error: "age tar ett argument" });
  });

  test("without a stamped idag the clock is used", () => {
    const result = evaluateFormula("days(fran; idag)", {}, { texts: { fran: "2000-01-01" } });
    expect(result.success).toBe(true);
    expect(result.success && result.value).toBeGreaterThan(9000);
  });

  test("dateReferences lists what the health check must look at", () => {
    expect(dateReferences("round(age( pnr ) / 2) + days(flytt; idag)")).toEqual([
      { fn: "age", name: "pnr" },
      { fn: "days", name: "flytt" },
      { fn: "days", name: "idag" },
    ]);
    expect(dateReferences("pris - kontantinsats")).toEqual([]);
    expect(dateReferences("age(")).toEqual([]);
  });
});

describe("variableReferences", () => {
  test("names the variables, not the functions, once each", () => {
    expect(variableReferences("round(lan * r / (1 - pow(1 + r; -ar * 12)))")).toEqual(["lan", "r", "ar"]);
  });

  test("a formula the tokenizer rejects names nothing", () => {
    expect(variableReferences("lan # 2")).toEqual([]);
  });
});

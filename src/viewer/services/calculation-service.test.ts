import { describe, expect, test } from "vitest";

import { CalculationService } from "./calculation-service";

import type { FlowNodeData } from "../types/graph";

const node = (
  assignments: Array<{ variableName: string; formula: string }>
): FlowNodeData => ({
  id: "calc",
  type: "calculation",
  position: { x: 0, y: 0 },
  data: {
    assignments: assignments.map((assignment, index) => ({
      id: `a${index}`,
      ...assignment,
    })),
  },
});

describe("CalculationService", () => {
  test("computes rows in order so later rows see earlier results", () => {
    const outcome = CalculationService.run(
      node([
        { variableName: "kontantinsats", formula: "pris * 0,15" },
        { variableName: "lån", formula: "pris - kontantinsats" },
        { variableName: "månad", formula: "round(lån * 0,03 / 12)" },
      ]),
      { pris: "3000000" }
    );

    expect(outcome.answers["kontantinsats"]).toBe("450000");
    expect(outcome.answers["lån"]).toBe("2550000");
    expect(outcome.answers["månad"]).toBe("6375");
    expect(outcome.results.every((result) => result.success)).toBe(true);
  });

  test("preserves earlier answers and only adds new variables", () => {
    const outcome = CalculationService.run(
      node([{ variableName: "dubbelt", formula: "x * 2" }]),
      { x: "21", namn: "Kim" }
    );

    expect(outcome.answers).toMatchObject({ x: "21", namn: "Kim", dubbelt: "42" });
  });

  test("a failed row sets no variable but is reported", () => {
    const outcome = CalculationService.run(
      node([
        { variableName: "a", formula: "pris * 2" }, // pris saknas
        { variableName: "b", formula: "10 / 0" }, // division med noll
      ]),
      {}
    );

    expect(outcome.answers["a"]).toBeUndefined();
    expect(outcome.answers["b"]).toBeUndefined();
    expect(outcome.results).toHaveLength(2);
    expect(outcome.results[0]?.success).toBe(false);
    expect(outcome.results[1]?.error).toContain("noll");
  });

  test("skips empty rows", () => {
    const outcome = CalculationService.run(
      node([
        { variableName: "", formula: "1 + 1" },
        { variableName: "x", formula: "" },
      ]),
      {}
    );

    expect(outcome.results).toHaveLength(0);
    expect(outcome.answers).toEqual({});
  });

  test("listar producerade variabelnamn i ordning", () => {
    const produced = CalculationService.getProducedVariables(
      node([
        { variableName: "a", formula: "1" },
        { variableName: "", formula: "2" },
        { variableName: "b", formula: "3" },
      ])
    );

    expect(produced).toEqual(["a", "b"]);
  });
});

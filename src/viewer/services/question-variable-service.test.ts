import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { QuestionVariableService } from "./question-variable-service";

import type { FlowNodeData, GraphData } from "../types/graph";

const question = (data: Record<string, unknown>): FlowNodeData => ({
  id: "question",
  type: "question",
  position: { x: 0, y: 0 },
  data,
});

describe("QuestionVariableService", () => {
  test("uses the variable label when present", () => {
    expect(
      QuestionVariableService.getLabel(
        question({
          variableLabel: "Över 18 år",
          title: "Har du fyllt 18 år?",
          variableName: "isAdult",
        })
      )
    ).toBe("Över 18 år");
  });

  test("falls back to the question's title and then the variable name", () => {
    expect(
      QuestionVariableService.getLabel(
        question({ title: "Har du fyllt 18 år?", variableName: "isAdult" })
      )
    ).toBe("Har du fyllt 18 år?");

    expect(
      QuestionVariableService.getLabel(question({ variableName: "isAdult" }))
    ).toBe("isAdult");
  });

  test("lists named question variables once with their labels", () => {
    const first = question({
      variableName: "isAdult",
      variableLabel: "Över 18 år",
    });
    const duplicate = {
      ...question({ variableName: "isAdult", title: "Annan fråga" }),
      id: "duplicate",
    };

    expect(
      QuestionVariableService.getOptions({
        startNodeId: first.id,
        nodes: [first, duplicate, question({ variableName: "" })],
        connections: [],
      })
    ).toEqual([
      { label: "Över 18 år", value: "isAdult", type: "choice", options: [] },
      // Story 086: the guide's day, after the guide's own variables.
      { label: "I dag", value: "idag", type: "text", options: [], computed: true },
    ]);
  });

  test("a localized alias counts as an alias", () => {
    // Measured 3/9 on the service example: `variableLabel: { sv, en }` was
    // skipped as "not a string", so the picker said the whole question.
    const question = {
      id: "q",
      type: "number-question",
      position: { x: 0, y: 0 },
      data: { title: "Vad har du för månadsinkomst?", variableName: "income", variableLabel: { sv: "Månadsinkomst", en: "Monthly income" } },
    };

    expect(QuestionVariableService.getLabel(question)).toBe("Månadsinkomst");
    expect(QuestionVariableService.getLabel(question, "en")).toBe("Monthly income");
  });

  test("a calculation row's label goes before its name, like a question's alias", () => {
    // Story 078: "gör alias på uträkning också". A row without a label reads
    // as before — the name is the label.
    const calculation = {
      id: "calc",
      type: "calculation",
      position: { x: 0, y: 0 },
      data: {
        title: "Kalkyl",
        assignments: [
          { id: "a", variableName: "maxLån", formula: "1", label: "Maxlån" },
          { id: "b", variableName: "marginal", formula: "2" },
          { id: "c", variableName: "tom", formula: "3", label: "  " },
        ],
      },
    };

    expect(
      QuestionVariableService.getOptions({ startNodeId: null, nodes: [calculation], connections: [] }),
    ).toEqual([
      { label: "Maxlån", value: "maxLån", type: "number", options: [], calculated: true },
      { label: "marginal", value: "marginal", type: "number", options: [], calculated: true },
      { label: "tom", value: "tom", type: "number", options: [], calculated: true },
      { label: "I dag", value: "idag", type: "text", options: [], computed: true },
    ]);
  });

  test("a service response row's label goes before its name too", () => {
    // Story 079: same form, same lack, as 078 said.
    const call = {
      id: "call",
      type: "service-call",
      position: { x: 0, y: 0 },
      data: {
        title: "Fråga tjänsten",
        responseMappings: [
          { id: "m", field: "maxLoan", variableName: "maxLoan", label: "Maxlån" },
          { id: "n", field: "decision", variableName: "decision" },
        ],
      },
    };

    expect(
      QuestionVariableService.getOptions({ startNodeId: null, nodes: [call], connections: [] }),
    ).toEqual([
      { label: "Maxlån", value: "maxLoan", type: "number", options: [] },
      { label: "decision", value: "decision", type: "number", options: [] },
      { label: "I dag", value: "idag", type: "text", options: [], computed: true },
    ]);
  });

  test("gathers both text variables from a PageNode", () => {
    const graph: GraphData = { startNodeId: "page", nodes: [{ id: "page", type: "page", position: { x: 0, y: 0 }, data: { firstLabel: "Namn", firstVariableName: "name", secondLabel: "E-post", secondVariableName: "email" } }], connections: [] };
    expect(QuestionVariableService.getOptions(graph)).toEqual([
      { label: "Namn", value: "name", type: "text", options: [] },
      { label: "E-post", value: "email", type: "text", options: [] },
      { label: "I dag", value: "idag", type: "text", options: [], computed: true },
    ]);
  });
});

/*
 * En sida som upprepas (story 084) erbjuder ANTALET utanför sidan — listan
 * själv är inget en regel jämför — och fälten på sidan behåller sina egna namn
 * för villkoren inuti den. Hälsokontrollen läser den här listan, så ett namn
 * som saknas här är ett falskt fel där.
 */
describe("en sida som upprepas", () => {
  const graf = (data: Record<string, unknown>): GraphData => ({
    startNodeId: "page",
    nodes: [
      { id: "page", type: "page", position: { x: 0, y: 0 }, data: { title: "Dina barn", ...data } },
      { id: "f1", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 0, data: { title: "Namn", variableName: "namn" } },
    ],
    connections: [],
  });

  test("antalet står i listan, som tal, och fältet behåller sitt namn", () => {
    expect(QuestionVariableService.getOptions(graf({ repeats: true, repeatVariable: "barn" }))).toEqual([
      { label: "Dina barn (antal)", value: "barn.count", type: "number", options: [] },
      { label: "Namn", value: "namn", type: "text", options: [] },
      { label: "I dag", value: "idag", type: "text", options: [], computed: true },
    ]);
  });

  test("ett talfält på en sida som upprepas ger sin summa (story 091)", () => {
    /*
     * `blankett.antal.sum` måste stå här av samma skäl som antalet: väljaren
     * erbjuder listan och hälsokontrollen litar på den. Bara talfält, bara
     * på en sida som upprepas — ett textfält har ingen summa.
     */
    const g = graf({ repeats: true, repeatVariable: "blankett" });
    g.nodes.push({ id: "f2", type: "number-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 1, data: { title: "Antal", variableName: "antal" } });
    const options = QuestionVariableService.getOptions(g);

    expect(options.map((o) => o.value)).toEqual(["blankett.count", "namn", "antal", "blankett.antal.sum", "idag"]);
    expect(options.find((o) => o.value === "blankett.antal.sum")).toEqual({ label: "Antal (summa)", value: "blankett.antal.sum", type: "number", options: [] });
  });

  test("utan upprepning har talfältet ingen summa", () => {
    const g = graf({ repeatVariable: "blankett" });
    g.nodes.push({ id: "f2", type: "number-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 1, data: { title: "Antal", variableName: "antal" } });

    expect(QuestionVariableService.getOptions(g).map((o) => o.value)).toEqual(["namn", "antal", "idag"]);
  });

  test("en sida som inte upprepas har inget antal", () => {
    const names = QuestionVariableService.getOptions(graf({ repeatVariable: "barn" })).map((o) => o.value);

    expect(names).toEqual(["namn", "idag"]);
  });

  test("listans namn är upptaget: ett fält med samma namn räknas inte två gånger", () => {
    const graph = graf({ repeats: true, repeatVariable: "namn" });

    expect(QuestionVariableService.getOptions(graph).map((o) => o.value)).toEqual(["namn.count", "idag"]);
  });
});

describe("the map question's two variables", () => {
  test("the Geo twin is listed beside the label variable", () => {
    const graph: GraphData = {
      startNodeId: "m",
      nodes: [
        {
          id: "m",
          type: "map-question",
          position: { x: 0, y: 0 },
          data: { title: "Var är felet?", variableName: "plats", kind: "point" },
        },
      ],
      connections: [],
    } as GraphData;

    const values = QuestionVariableService.getOptions(graph).map((option) => option.value);

    expect(values).toContain("plats.label");
    // The viewer stores GeoJSON under plats + "Geo"; a result printing it
    // must not be reported as reading a variable nothing sets.
    expect(values).toContain("plats.geo");
  });
});

describe("aliaset på kortets språk (story 080)", () => {
  const graph = {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "number-question",
        position: { x: 0, y: 0 },
        data: { title: "Månadsinkomst?", variableName: "income", variableLabel: { sv: "Månadsinkomst", en: "Monthly income" } },
      },
      {
        id: "calc",
        type: "calculation",
        position: { x: 0, y: 0 },
        data: { title: "Kalkyl", assignments: [{ id: "a", variableName: "maxLoan", formula: "income * 5", label: { sv: "Maxlån", en: "Maximum loan" } }] },
      },
      {
        id: "call",
        type: "service-call",
        position: { x: 0, y: 0 },
        data: { title: "Tjänst", responseMappings: [{ id: "m", field: "decision", variableName: "decision", label: { sv: "Beslut", en: "Decision" } }] },
      },
    ],
    connections: [],
  } as never;

  test("getOptions ger etiketterna på det språk som frågas efter", () => {
    const labels = (locale?: "sv" | "en") =>
      QuestionVariableService.getOptions(graph, locale).map((option) => option.label);

    expect(labels()).toEqual(["Månadsinkomst", "Maxlån", "Beslut", "I dag"]);
    expect(labels("en")).toEqual(["Monthly income", "Maximum loan", "Decision", "Today"]);
  });
});

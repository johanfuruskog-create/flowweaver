import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";
import { CalculationService } from "../services/calculation-service";
import { TemplateVariableService } from "../services/template-variable-service";

import type { GraphData } from "../types/graph";

/*
 * Story 095, AC 1: a calculation may sit IN a page. Its rows run over the
 * engine's answers plus the page's own fields, in the page's order, and its
 * variables are stored at Nästa exactly as when it is a step of its own.
 */
const graph: GraphData = {
  startNodeId: "loan",
  nodes: [
    { id: "loan", type: "page", position: { x: 0, y: 0 }, data: { title: "Låna" } },
    { id: "f-amount", type: "number-question", position: { x: 0, y: 0 }, parentPageId: "loan", order: 0, data: { title: "Lånesumma", variableName: "lan", required: true } },
    { id: "f-years", type: "number-question", position: { x: 0, y: 0 }, parentPageId: "loan", order: 1, data: { title: "Lånetid", variableName: "ar", required: true } },
    {
      id: "calc", type: "calculation", position: { x: 0, y: 0 }, parentPageId: "loan", order: 2,
      data: {
        title: "Månadskostnad",
        assignments: [
          { id: "a1", variableName: "r", formula: "0,06 / 12" },
          { id: "a2", variableName: "kostnad", formula: "round(lan * r / (1 - pow(1 + r; -ar * 12)))" },
          { id: "a3", variableName: "totalt", formula: "kostnad * ar * 12" },
        ],
      },
    },
    { id: "done", type: "result", position: { x: 300, y: 0 }, data: { title: "Klart", content: "{{kostnad}} kr/mån, {{totalt}} kr totalt." } },
  ],
  connections: [{ id: "page-done", from: { nodeId: "loan", portId: "continue" }, to: { nodeId: "done", portId: "input" } }],
};

describe("en uträkning i en sida (story 095)", () => {
  test("räknar över sidans fält och sparar sina variabler vid Nästa", () => {
    const engine = new GuideTraversalEngine(graph);

    expect(engine.answerPage({ lan: "100000", ar: "5" })).toMatchObject({ success: true, node: { id: "done" } });
    expect(engine.getAnswers()).toMatchObject({ lan: "100000", ar: "5", kostnad: "1933", totalt: "115980" });
    expect(TemplateVariableService.resolve("{{kostnad}} kr/mån", engine.getAnswers(), graph, "sv").resolved).toBe("1\u00a0933 kr/mån");
    // Only the fields leave records; a calculation is not something the visitor answered.
    expect(engine.getAnswerRecords().map((record) => record.variableName)).toEqual(["lan", "ar"]);
  });

  test("samma räkning medan man svarar: den viewer-vägen tar sidans fält som de är just nu", () => {
    const live = CalculationService.runInPage(graph.nodes, graph.nodes[0]!, { lan: "200000", ar: "10" });

    expect(live).toMatchObject({ lan: "200000", ar: "10", kostnad: "2220", totalt: "266400" });
    // An empty field gives no number and no variable — never NaN.
    expect(CalculationService.runInPage(graph.nodes, graph.nodes[0]!, { lan: "", ar: "10" })).toEqual({ lan: "", ar: "10", r: "0.005" });
  });

  test("tillbaka och Nästa igen räknar om — det gamla värdet lever inte kvar", () => {
    const engine = new GuideTraversalEngine(graph);
    engine.answerPage({ lan: "100000", ar: "5" });
    engine.previous();

    expect(engine.answerPage({ lan: "200000", ar: "5" })).toMatchObject({ success: true });
    expect(engine.getAnswers()).toMatchObject({ kostnad: "3867", totalt: "232020" });
  });
});

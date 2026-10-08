import { describe, expect, test } from "vitest";

import { PageRepeatService } from "./page-repeat-service";
import { TemplateVariableService } from "./template-variable-service";

import type { FlowNodeData, GraphData } from "../types/graph";

const page = (data: Record<string, unknown>): FlowNodeData =>
  ({ id: "p1", type: "page", position: { x: 0, y: 0 }, data: { title: "Dina barn", ...data } }) as FlowNodeData;

describe("PageRepeatService — vad en upprepad sida har bestämt (story 084)", () => {
  test("standard: minst 1, ingen övre gräns, egen knapptext tom", () => {
    const repeat = PageRepeatService.get(page({ repeats: true, repeatWord: "barn", repeatVariable: "barn" }));
    expect(repeat).toEqual({ variable: "barn", word: "barn", min: 1, max: undefined, addLabel: "" });
  });

  test("läser gränserna och knapptexten; tomt tal betyder standard", () => {
    const repeat = PageRepeatService.get(
      page({ repeats: true, repeatWord: "barn", repeatVariable: "barn", repeatMin: 0, repeatMax: 4, addLabel: "Ett barn till" }),
    );
    expect(repeat).toMatchObject({ min: 0, max: 4, addLabel: "Ett barn till" });
    expect(PageRepeatService.get(page({ repeats: true, repeatWord: "barn", repeatVariable: "barn", repeatMin: null, repeatMax: null })))
      .toMatchObject({ min: 1, max: undefined });
  });

  test("ett tak under golvet är inget tak", () => {
    const repeat = PageRepeatService.get(page({ repeats: true, repeatWord: "barn", repeatVariable: "barn", repeatMin: 3, repeatMax: 2 }));
    expect(repeat).toMatchObject({ min: 3, max: undefined });
  });

  test("ordet följer språket", () => {
    const node = page({ repeats: true, repeatWord: { sv: "barn", en: "child" }, repeatVariable: "barn" });
    expect(PageRepeatService.get(node, "en")?.word).toBe("child");
    expect(PageRepeatService.get(node, "sv")?.word).toBe("barn");
  });

  test("en sida som inte upprepas, eller upprepas utan ord eller namn, är null", () => {
    expect(PageRepeatService.get(page({}))).toBeNull();
    expect(PageRepeatService.get(page({ repeats: true, repeatWord: "barn" }))).toBeNull();
    expect(PageRepeatService.get(page({ repeats: true, repeatVariable: "barn", repeatWord: "  " }))).toBeNull();
  });
});

describe("PageRepeatService.describe — listan som text (steg 3, AC 3)", () => {
  const graph = {
    startNodeId: "p1",
    settings: { sourceLocale: "sv" },
    nodes: [
      page({ repeats: true, repeatWord: { sv: "barn", en: "child" }, repeatVariable: "barn" }),
      { id: "namn", type: "text-question", parentPageId: "p1", order: 1, position: { x: 0, y: 0 }, data: { title: { sv: "Namn" }, variableName: "namn" } },
      { id: "skola", type: "question", parentPageId: "p1", order: 2, position: { x: 0, y: 0 },
        data: { title: { sv: "Går i skolan" }, variableName: "skola", options: [{ id: "ja", label: { sv: "Ja", en: "Yes" }, value: "ja" }, { id: "nej", label: { sv: "Nej", en: "No" }, value: "nej" }] } },
      { id: "arskurs", type: "text-question", parentPageId: "p1", order: 3, position: { x: 0, y: 0 },
        data: { title: { sv: "Årskurs" }, variableName: "arskurs" },
        visibility: { match: "all", conditions: [{ id: "c", variableName: "skola", operator: "equals", value: "ja" }] } },
    ],
    connections: [],
  } as never as GraphData;
  const records = [{ namn: "Alva", skola: "ja", arskurs: "3" }, { namn: "Nils", skola: "nej", arskurs: "" }];

  test("ett block per post: rubriken, en rad per fält, etiketter i stället för värden, och bara fälten posten visade", () => {
    expect(PageRepeatService.describe(graph, graph.nodes[0]!, records, {})).toBe(
      "Barn 1\nNamn: Alva\nGår i skolan: Ja\nÅrskurs: 3\n\nBarn 2\nNamn: Nils\nGår i skolan: Nej",
    );
  });

  test("på engelska: rubriken och etiketten följer språket", () => {
    expect(PageRepeatService.describe(graph, graph.nodes[0]!, records.slice(1), {}, "en")).toBe("Child 1\nNamn: Nils\nGår i skolan: No");
  });

  test("{{barn}} i en mall går den här vägen; en post utan rubrikord ger inget", () => {
    expect(TemplateVariableService.resolve("Barnen:\n{{barn}}", { barn: records }, graph).resolved)
      .toBe("Barnen:\nBarn 1\nNamn: Alva\nGår i skolan: Ja\nÅrskurs: 3\n\nBarn 2\nNamn: Nils\nGår i skolan: Nej");
    expect(TemplateVariableService.resolve("{{barn.count}}", { barn: records }, graph).resolved).toBe("2");
  });
});

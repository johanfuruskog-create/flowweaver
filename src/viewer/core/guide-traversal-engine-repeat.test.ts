import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";
import { TemplateVariableService } from "../services/template-variable-service";

import type { GraphData } from "../types/graph";

/*
 * Story 084, steg 2: en sida som upprepas svarar med en LISTA av poster.
 *
 * Ett barn per post, sidans fält som nycklar. Motorn lagrar bara listan —
 * antalet härleds som `barn.count` — och validerar varje post för sig, så att
 * ett villkorat fält läser villkoret i sin egen post och inte i den första.
 */
const graph = (page: Record<string, unknown> = {}): GraphData => ({
  startNodeId: "children",
  nodes: [
    {
      id: "children", type: "page", position: { x: 0, y: 0 },
      data: { title: "Dina barn", repeats: true, repeatWord: "barn", repeatVariable: "barn", ...page },
    },
    { id: "f-name", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "children", order: 0, data: { title: "Namn", variableName: "namn", required: true } },
    {
      id: "f-school", type: "question", position: { x: 0, y: 0 }, parentPageId: "children", order: 1,
      data: { title: "Går i skolan", variableName: "skola", options: [{ id: "ja", label: "Ja", value: "ja" }, { id: "nej", label: "Nej", value: "nej" }] },
    },
    {
      id: "f-grade", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "children", order: 2,
      data: { title: "Årskurs", variableName: "arskurs", required: true },
      visibility: { match: "all", conditions: [{ id: "c", variableName: "skola", operator: "equals", value: "ja" }] },
    },
    { id: "done", type: "result", position: { x: 300, y: 0 }, data: { title: "Klart", content: "Du har angett {{barn.count}} barn." } },
  ],
  connections: [{ id: "page-done", from: { nodeId: "children", portId: "continue" }, to: { nodeId: "done", portId: "input" } }],
});

describe("en sida som upprepas (story 084)", () => {
  test("svaret är listan, antalet är härlett, och fälten får ingen platt kopia", () => {
    const engine = new GuideTraversalEngine(graph());

    const result = engine.answerPage({ barn: [{ namn: "Alva", skola: "nej" }, { namn: "Bo", skola: "nej" }] });

    expect(result).toMatchObject({ success: true, node: { id: "done" } });
    expect(engine.getAnswers()).toEqual({ barn: [{ namn: "Alva", skola: "nej" }, { namn: "Bo", skola: "nej" }] });
    expect(TemplateVariableService.resolve("{{barn.count}} barn", engine.getAnswers()).resolved).toBe("2 barn");
    expect(engine.getAnswerRecords().map((record) => `${record.questionTitle}: ${record.optionLabel}`)).toEqual([
      "Barn 1 — Namn: Alva",
      "Barn 1 — Går i skolan: Nej",
      "Barn 2 — Namn: Bo",
      "Barn 2 — Går i skolan: Nej",
    ]);
  });

  test("ett villkorat fält läser sin egen post, inte den första (AC 4)", () => {
    const engine = new GuideTraversalEngine(graph());

    // Barn 1 går inte i skolan, så årskursen döljs där — men barn 2 gör det.
    expect(engine.answerPage({ barn: [{ namn: "Alva", skola: "nej" }, { namn: "Bo", skola: "ja", arskurs: "" }] })).toMatchObject({
      success: false,
      error: { message: 'Fältet "Barn 2 — Årskurs" är obligatoriskt.' },
    });
    expect(engine.answerPage({ barn: [{ namn: "Alva", skola: "nej" }, { namn: "Bo", skola: "ja", arskurs: "3" }] })).toMatchObject({ success: true });
    expect(engine.getAnswerRecords().map((record) => record.questionTitle)).toContain("Barn 2 — Årskurs");
  });

  test("minsta och största antal hålls, och standard är minst ett", () => {
    expect(new GuideTraversalEngine(graph()).answerPage({ barn: [] })).toMatchObject({
      success: false,
      error: { message: "Lägg till minst 1." },
    });
    expect(new GuideTraversalEngine(graph({ repeatMin: 0 })).answerPage({ barn: [] })).toMatchObject({ success: true });
    expect(new GuideTraversalEngine(graph({ repeatMax: 1 })).answerPage({ barn: [{ namn: "A" }, { namn: "B" }] })).toMatchObject({
      success: false,
      error: { message: "Högst 1 kan anges." },
    });
  });

  /*
   * Was "ett steg tillbaka tar bort listan igen", asserting `{}` — and green
   * only because the record lacked the required choice, so `answerPage` had
   * refused and nothing was ever stored. Found on 6/9 when story 095's test
   * copied the shape. The engine's convention is the opposite: a step back
   * keeps the list for the fields (`getPrefill`, since 6/9 — the run itself
   * rolls back, see `guide-traversal-engine.back.test.ts`) and rolls back
   * the trail.
   */
  test("ett steg tillbaka behåller listan för fälten men rullar tillbaka spåret", () => {
    const engine = new GuideTraversalEngine(graph());
    expect(engine.answerPage({ barn: [{ namn: "Alva", skola: "nej" }] })).toMatchObject({ success: true });
    engine.previous();

    expect(engine.getPrefill()).toEqual({ barn: [{ namn: "Alva", skola: "nej" }] });
    expect(engine.getAnswers()).toEqual({});
    expect(engine.getAnswerRecords()).toEqual([]);
  });
});

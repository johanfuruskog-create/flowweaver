import { describe, expect, test } from "vitest";

import { PageFieldsService } from "./page-fields-service";
import { PageVisibilityService } from "./page-visibility-service";
import { QuestionOptionsService } from "./question-options-service";
import { GuideTraversalEngine } from "../core/guide-traversal-engine";

import type { FlowNodeData, GraphData, QuestionOption } from "../types/graph";

/**
 * Berättelse 134 — villkorade alternativ, modellhalvan.
 *
 * Nötcurryn visas inte för den som svarat att den är allergisk mot nötter.
 * Villkoret sitter på ALTERNATIVET, har samma form som fältets *visas om*, och
 * vägs av samma utvärdering.
 */

const meny = (): QuestionOption[] => [
  { id: "veg", label: "Vegetariskt", value: "veg" },
  {
    id: "curry",
    label: "Nötcurry",
    value: "curry",
    visibility: {
      match: "all",
      conditions: [
        { id: "c1", variableName: "allergi", operator: "not-one-of", value: "notter" },
      ],
    },
  },
  { id: "nutfree", label: "Utan nötter", value: "nutfree" },
];

const question = (options: QuestionOption[] = meny()): FlowNodeData => ({
  id: "meny",
  type: "question",
  position: { x: 0, y: 0 },
  data: { title: "Meny", variableName: "meny", options },
});

describe("134 — villkorade alternativ, modellen", () => {
  test("kriterium 1: ett alternativ bär ett villkor med fältets form, och en guide utan det är oförändrad", () => {
    const parsed = QuestionOptionsService.parseOptions(meny());

    expect(parsed[1]?.visibility).toEqual({
      match: "all",
      conditions: [
        { id: "c1", variableName: "allergi", operator: "not-one-of", value: "notter" },
      ],
    });
    // Frånvaro betyder vad varje alternativ betydde före villkoret fanns.
    expect(parsed[0]?.visibility).toBeUndefined();
    expect(QuestionOptionsService.getOptions(question(), {})).toHaveLength(2);
  });

  test("kriterium 2: isVisible väger ett alternativ som den väger ett fält", () => {
    const option = meny()[1]!;
    const field: FlowNodeData = {
      id: "falt",
      type: "text-question",
      position: { x: 0, y: 0 },
      data: {},
      visibility: option.visibility,
    };

    expect(PageVisibilityService.isVisible(option, { allergi: "notter" })).toBe(false);
    expect(PageVisibilityService.isVisible(field, { allergi: "notter" })).toBe(false);
    expect(PageVisibilityService.isVisible(option, { allergi: "laktos" })).toBe(true);
    expect(PageVisibilityService.isVisible(field, { allergi: "laktos" })).toBe(true);
  });

  test("kriterium 2: getOptions filtrerar med svar och lämnar allt utan dem", () => {
    expect(
      QuestionOptionsService.getOptions(question(), { allergi: "notter" }).map(
        (option) => option.value,
      ),
    ).toEqual(["veg", "nutfree"]);

    expect(
      QuestionOptionsService.getOptions(question(), { allergi: "laktos" }).map(
        (option) => option.value,
      ),
    ).toEqual(["veg", "curry", "nutfree"]);

    // Utan svar — editorn, panelen, kortet — är listan hel.
    expect(QuestionOptionsService.getOptions(question())).toHaveLength(3);
  });

  test("kriterium 2 (Per, mutationskontroll): villkoret läser en DEL av ett svar, som fältets", () => {
    // Samma sak `readPath` själv prövar (land.value) — här genom isVisible,
    // mot ett alternativ. Ett direkt uppslag (`answers[condition.variableName]`)
    // hittar aldrig nyckeln "land.value" och gör alternativet dolt alltid,
    // också när det borde synas.
    const option: QuestionOption = {
      id: "curry",
      label: "Nötcurry",
      value: "curry",
      visibility: {
        match: "all",
        conditions: [
          { id: "c1", variableName: "land.value", operator: "not-one-of", value: "SE" },
        ],
      },
    };

    expect(
      PageVisibilityService.isVisible(option, {
        land: [{ label: "Sverige", value: "SE" }],
      }),
    ).toBe(false);
    expect(
      PageVisibilityService.isVisible(option, {
        land: [{ label: "Danmark", value: "DK" }],
      }),
    ).toBe(true);
  });

  test("kriterium 5: ett fält med alla alternativ dolda är inte obligatoriskt-blockerande", () => {
    const allaVillkorade = meny().map((option) => ({
      ...option,
      visibility: meny()[1]!.visibility,
    }));
    const page: FlowNodeData = {
      id: "sidan",
      type: "page",
      position: { x: 0, y: 0 },
      data: { title: "Maten" },
    };
    const graph: GraphData = {
      version: 8,
      startNodeId: "sidan",
      nodes: [page, { ...question(allaVillkorade), parentPageId: "sidan", order: 1 }],
      connections: [],
    } as unknown as GraphData;

    const [kvar] = PageFieldsService.getFields(graph, page, { allergi: "notter" });

    expect(kvar?.options).toEqual([]);
    expect(kvar?.required).toBe(false);
    expect(kvar?.optionsHidden).toBe(true);

    // Och med ett svar som inte döljer något står obligatoriet kvar.
    const [helt] = PageFieldsService.getFields(graph, page, { allergi: "laktos" });
    expect(helt?.required).toBe(true);
    expect(helt?.optionsHidden).toBeUndefined();
  });

  test("kriterium 6: motorn tar inte emot ett alternativ besökaren aldrig erbjöds", () => {
    const graph: GraphData = {
      version: 8,
      startNodeId: "allergi",
      nodes: [
        {
          id: "allergi",
          type: "question",
          position: { x: 0, y: 0 },
          data: {
            title: "Allergier",
            variableName: "allergi",
            options: [
              { id: "a1", label: "Nötter", value: "notter" },
              { id: "a2", label: "Inga", value: "inga" },
            ],
          },
        },
        question(),
        { id: "klart", type: "result", position: { x: 0, y: 0 }, data: { title: "Tack" } },
      ],
      /*
       * VARJE menyalternativ har en väg vidare, också nötcurryn.
       *
       * Utan den kopplingen vägrar motorn av en annan anledning — svaret leder
       * ingenstans — och testet hade varit rött oavsett om filtret fanns
       * eller inte. Mätt: mutationen "ta bort filtret" gick igenom grönt
       * tills kopplingen lades till (PRAXIS 12, röda halvan).
       */
      connections: [
        { id: "k1", from: { nodeId: "allergi", portId: "a1" }, to: { nodeId: "meny", portId: "in" } },
        { id: "k2", from: { nodeId: "allergi", portId: "a2" }, to: { nodeId: "meny", portId: "in" } },
        { id: "k3", from: { nodeId: "meny", portId: "veg" }, to: { nodeId: "klart", portId: "in" } },
        { id: "k4", from: { nodeId: "meny", portId: "curry" }, to: { nodeId: "klart", portId: "in" } },
        { id: "k5", from: { nodeId: "meny", portId: "nutfree" }, to: { nodeId: "klart", portId: "in" } },
      ],
    } as unknown as GraphData;

    const engine = new GuideTraversalEngine(graph);

    engine.answer("a2");
    expect(engine.getCurrentNode()?.id).toBe("meny");
    // Utan nötallergi är nötcurryn ett svar som går igenom.
    expect(engine.answer("curry").success).toBe(true);

    const allergisk = new GuideTraversalEngine(graph);

    allergisk.answer("a1");
    expect(allergisk.getCurrentNode()?.id).toBe("meny");

    const refused = allergisk.answer("curry");

    expect(refused.success).toBe(false);
    expect(allergisk.getCurrentNode()?.id).toBe("meny");
  });
});

import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";

import type { GraphData } from "../types/graph";

/**
 * Story 118, kriterium 7: axeln "rört" i motorn.
 *
 * `answerPage` (sidfält) och `answerValue` (fristående tal-/datumsteg) tar ett
 * valfritt andra/tredje argument, `{ touched }`, med de variabelnamn besökaren
 * ändrat sedan steget ritades. Ett fält med `requireInteraction: true` vägrar
 * gå vidare om `touched` saknar namnet OCH motorn saknar ett eget svar för
 * variabeln OCH det inskickade värdet är LIKA MED ankomstvärdet — se
 * `isUntouched` i `guide-traversal-engine.ts` (0690a23).
 *
 * FIXTUREN BÄR ETT STARTVÄRDE (`startValue: 5`) med flit: utan ett
 * ankomstvärde att jämföra mot är varje inskickat "42" per definition skilt
 * från ankomsten (`arrivalValueOf` ger `undefined`), och motorn släpper det
 * igenom oavsett `touched` — testerna nedan skulle då inte mäta axeln alls,
 * bara att ett fält utan startvärde alltid räknas som ändrat. Det senare
 * prövas för sig, explicit, i sista testet i varje describe-block.
 *
 * Den här filen mäter bara motorns dom, inte visarens mätning av "rört" (det
 * gör `require-interaction.browser.test.ts`) och inte panelens fält.
 */

function pageGraph(fieldData: Record<string, unknown>): GraphData {
  return {
    startNodeId: "sida",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "sida", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
      {
        id: "n",
        type: "number-question",
        parentPageId: "sida",
        order: 0,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Tal" }, variableName: "tal", ...fieldData },
      },
      { id: "klart", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "sida", portId: "continue" }, to: { nodeId: "klart", portId: "input" } },
    ],
  } as GraphData;
}

function standaloneGraph(fieldData: Record<string, unknown>): GraphData {
  return {
    startNodeId: "n",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "n",
        type: "number-question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Fristående tal" }, variableName: "tal", ...fieldData },
      },
      { id: "klart", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "n", portId: "continue" }, to: { nodeId: "klart", portId: "input" } },
    ],
  } as GraphData;
}

describe("answerPage och axeln rört", () => {
  test("utan options = dagens beteende: en icke-krävd sida släpper igenom ett värde", () => {
    const engine = new GuideTraversalEngine(pageGraph({ required: true }));

    expect(engine.answerPage({ tal: "42" })).toMatchObject({ success: true, node: { id: "klart" } });
  });

  test("med touched tomt, kravet på och exakt ankomstvärdet inskickat → fel, riktat mot fältets etikett", () => {
    const engine = new GuideTraversalEngine(
      pageGraph({ required: true, requireInteraction: true, startValue: 5 }),
    );

    // "5" är exakt vad fältet visar vid ankomst (startValue) — precis det
    // enda fall värdet ensamt inte kan avslöja, se toppkommentaren.
    const result = engine.answerPage({ tal: "5" }, { touched: new Set() });

    expect(result).toMatchObject({ success: false });
    if (result.success) throw new Error("förväntade fel");
    expect(result.error.message).toContain("Tal");
    expect(result.error.message).toContain("innan du går vidare");
  });

  test("samma sak när options helt utelämnas (touched saknas då också)", () => {
    const engine = new GuideTraversalEngine(
      pageGraph({ required: true, requireInteraction: true, startValue: 5 }),
    );

    expect(engine.answerPage({ tal: "5" })).toMatchObject({ success: false });
  });

  test("ett värde SKILT från ankomstvärdet, inskickat utan touched → släpper igenom", () => {
    const engine = new GuideTraversalEngine(
      pageGraph({ required: true, requireInteraction: true, startValue: 5 }),
    );

    // "42" skiljer sig från ankomstvärdet "5" — motorn läser det som en
    // riktig ändring, oavsett att touched är tomt (isUntouched, submitted).
    const result = engine.answerPage({ tal: "42" }, { touched: new Set() });

    expect(result).toMatchObject({ success: true, node: { id: "klart" } });
    expect(engine.getAnswers()).toEqual({ tal: "42" });
  });

  test("med namnet i touched → ok, ÄVEN när det inskickade värdet är exakt ankomstvärdet", () => {
    // startValue satt och värdet EXAKT detsamma: utan touched hade det här
    // fallit (se testet ovan). Isolerar touched-mekanismen från värde-skiljer
    // sig-bypassen — annars bevisar "ok" ingenting om touched alls (mätt: den
    // gamla varianten utan startValue höll grönt även med touched ignorerat).
    const engine = new GuideTraversalEngine(
      pageGraph({ required: true, requireInteraction: true, startValue: 5 }),
    );

    const result = engine.answerPage({ tal: "5" }, { touched: new Set(["tal"]) });

    expect(result).toMatchObject({ success: true, node: { id: "klart" } });
    expect(engine.getAnswers()).toEqual({ tal: "5" });
  });

  test("med redan lagrat svar → ok oavsett touched, ÄVEN när samma värde skickas in igen", () => {
    /*
     * "10" in igen, inte "99": en gång lagrat är arrivalValueOf("tal") SJÄLVA
     * svaret ("10", se ArrivalValueService.forPage — en besvarad variabel
     * lämnas orörd i det som skickas tillbaka). Ett SKILT värde ("99") hade
     * gått igenom även om "motorn saknar svar"-villkoret vore borttaget, för
     * då hade "99" ändå skiljt sig från arrivalValueOf. Bara ett ÅTERINSKICKAT
     * "10" isolerar att det är svaret som bär bypassen, inte värde-skiljer-
     * sig-vägen — mätt: den gamla varianten med "99" höll grönt även med det
     * villkoret helt borttaget.
     */
    const engine = new GuideTraversalEngine(
      pageGraph({ required: true, requireInteraction: true }),
    );
    // seedAnswers skriver rakt in i motorns eget svar, utan post — precis den
    // väg som gör ett fält till en ankomstbild i stället för ett svar.
    engine.seedAnswers({ tal: "10" });

    // Utan touched alls (options.touched === undefined) är precis lika giltigt
    // — det lagrade svaret avgör, inte om anroparen skickade axeln.
    const other = new GuideTraversalEngine(
      pageGraph({ required: true, requireInteraction: true }),
    );
    other.seedAnswers({ tal: "10" });

    expect(engine.answerPage({ tal: "10" }, { touched: new Set() })).toMatchObject({
      success: true,
      node: { id: "klart" },
    });
    expect(other.answerPage({ tal: "10" })).toMatchObject({ success: true, node: { id: "klart" } });
  });

  test("requireInteraction av (dagens beteende, K7): tomt touched släpper igenom", () => {
    const engine = new GuideTraversalEngine(
      pageGraph({ required: true, requireInteraction: false }),
    );

    expect(engine.answerPage({ tal: "42" }, { touched: new Set() })).toMatchObject({
      success: true,
      node: { id: "klart" },
    });
  });
});

describe("answerValue och axeln rört (fristående steg)", () => {
  test("med touched tomt, kravet på och exakt ankomstvärdet inskickat → fel", () => {
    const engine = new GuideTraversalEngine(
      standaloneGraph({ required: true, requireInteraction: true, startValue: 5 }),
    );

    const result = engine.answerValue("5", {}, { touched: new Set() });

    expect(result).toMatchObject({ success: false });
    if (result.success) throw new Error("förväntade fel");
    expect(result.error.message).toContain("innan du går vidare");
  });

  test("ett värde SKILT från ankomstvärdet, inskickat utan touched → släpper igenom", () => {
    const engine = new GuideTraversalEngine(
      standaloneGraph({ required: true, requireInteraction: true, startValue: 5 }),
    );

    expect(engine.answerValue("42", {}, { touched: new Set() })).toMatchObject({
      success: true,
      node: { id: "klart" },
    });
  });

  test("med namnet i touched → ok, ÄVEN när det inskickade värdet är exakt ankomstvärdet", () => {
    const engine = new GuideTraversalEngine(
      standaloneGraph({ required: true, requireInteraction: true, startValue: 5 }),
    );

    expect(engine.answerValue("5", {}, { touched: new Set(["tal"]) })).toMatchObject({
      success: true,
      node: { id: "klart" },
    });
  });

  test("utan options = dagens beteende: kravet av släpper igenom orört", () => {
    const engine = new GuideTraversalEngine(standaloneGraph({ required: true }));

    expect(engine.answerValue("42")).toMatchObject({ success: true, node: { id: "klart" } });
  });

  test("med redan lagrat svar → ok oavsett touched", () => {
    /*
     * Fristående steg, till skillnad från sidfält: `startValueOf` (som
     * `arrivalValueOf` läser här, se guide-traversal-engine.ts) returnerar
     * `undefined` så fort variabeln är besvarad — den lämnar inte kvar
     * SVARET som "forPage" gör för sidfält. "Motorn saknar svar"-villkoret
     * kan alltså inte isoleras med ett återinskickat samma värde här (det
     * mättes: samma resultat med och utan villkoret) — sidfältets variant av
     * det här testet gör det jobbet i stället.
     */
    const engine = new GuideTraversalEngine(
      standaloneGraph({ required: true, requireInteraction: true }),
    );
    engine.seedAnswers({ tal: "10" });

    expect(engine.answerValue("99", {}, { touched: new Set() })).toMatchObject({
      success: true,
      node: { id: "klart" },
    });
  });
});

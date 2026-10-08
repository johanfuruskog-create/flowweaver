import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";

import type { GraphData } from "../types/graph";

/**
 * Vad meningen pekar på när guiden tar slut mitt i.
 *
 * En koppling som saknas stoppar besökaren, och det enda de får är den här
 * meningen. Den var skriven för ett flervalsalternativ och citerade svaret —
 * rätt när det finns alternativ att skilja mellan, fel när steget bara har en
 * utgång. Då blev citatet besökarens egen text: `Svaret "Johan" leder inte
 * vidare`, som läses som att namnet var problemet.
 *
 * Hittat i en skärmbild från en granskning, inte av sviten: en trasig guide är
 * inte något testerna bygger av misstag.
 */

const textQuestion = (): GraphData => ({
  startNodeId: "namn",
  nodes: [
    {
      id: "namn",
      type: "text-question",
      position: { x: 0, y: 0 },
      data: { title: "Vad heter du?", variableName: "namn" },
    },
  ],
  // Ingen koppling ut: textfrågans enda utgång är `continue`.
  connections: [],
});

const choice = (): GraphData => ({
  startNodeId: "fraga",
  nodes: [
    {
      id: "fraga",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: "Är du nöjd?",
        variableName: "nojd",
        options: [
          { id: "ja", label: "Ja", value: "ja" },
          { id: "nej", label: "Nej", value: "nej" },
        ],
      },
    },
    { id: "slut", type: "result", position: { x: 400, y: 0 }, data: { title: "Tack" } },
  ],
  // Bara "nej" leder någonstans. "Ja" är återvändsgränden.
  connections: [
    { id: "c", from: { nodeId: "fraga", portId: "nej" }, to: { nodeId: "slut", portId: "input" } },
  ],
});

describe("ett steg utan väg vidare", () => {
  test("talar om steget, inte om svaret", () => {
    const engine = new GuideTraversalEngine(textQuestion());

    expect(engine.answerValue("Johan")).toMatchObject({
      success: false,
      error: { message: "Det här steget leder inte vidare." },
    });
  });

  test("och citerar alltså inte det besökaren skrev", () => {
    /*
     * Den skarpa halvan: meningen fick inte innehålla namnet. Utan det här
     * påståendet kan formuleringen ändras tillbaka utan att något faller.
     */
    const engine = new GuideTraversalEngine(textQuestion());
    const result = engine.answerValue("Johan");

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.message).not.toContain("Johan");
  });
});

describe("ett alternativ utan väg vidare", () => {
  test("citerar alternativet, för det är det som skiljer", () => {
    const engine = new GuideTraversalEngine(choice());

    expect(engine.answer("ja")).toMatchObject({
      success: false,
      error: { message: 'Svaret "Ja" leder inte vidare.' },
    });
  });
});

describe("på engelska", () => {
  test("båda meningarna följer visarens språk", () => {
    /*
     * Motorns 35 andra felmeddelanden är hårdkodad svenska. De här två är det
     * inte: en besökare som läser guiden på engelska ska inte mötas av svenska
     * när den går sönder. Resten är en egen omgång.
     */
    const step = new GuideTraversalEngine(textQuestion(), { locale: "en" });
    const option = new GuideTraversalEngine(choice(), { locale: "en" });

    expect(step.answerValue("Johan")).toMatchObject({
      error: { message: "This step does not lead anywhere." },
    });
    expect(option.answer("ja")).toMatchObject({
      error: { message: 'The answer "Ja" does not lead anywhere.' },
    });
  });
});

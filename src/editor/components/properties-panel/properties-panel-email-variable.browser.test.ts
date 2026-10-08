// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../../testing/optional-pro";
const PRO = await withPro("index.ts");
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import { QuestionVariableService } from "../../../viewer/services/question-variable-service";

import type { PropertiesPanel } from "./properties-panel";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Story 054 — väljaren för besökarens e-post visar bara e-postfrågor.
 *
 * Fältet listade varenda variabel i guiden, så mejlkopian gick att peka på
 * "Beskriv felet" utan att något sa emot. Felet syns då först när en besökare
 * inte får sitt kvitto — den enda plats där ingen kan se vad som gick fel.
 *
 * Hittat i inlämningsfilmen: Johan läste fältet som nodens eget variabelnamn,
 * vilket är samma sak sagt på ett annat sätt — det ber om uppmärksamhet utan
 * att säga vad det vill ha.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 40) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graphWith = (format: string | null): GraphData => ({
  startNodeId: "fritext",
  nodes: [
    {
      id: "fritext",
      type: "text-question",
      position: { x: 0, y: 0 },
      data: { title: { sv: "Beskriv felet" }, variableName: "beskrivning" },
    },
    ...(format
      ? [{
          id: "adress",
          type: "text-question",
          position: { x: 200, y: 0 },
          data: { title: { sv: "Din e-post" }, variableName: "epost", format },
        }]
      : []),
    { id: "in", type: "submit-result", position: { x: 400, y: 0 }, data: {} },
  ],
  connections: [],
}) as GraphData;

async function panelFor(format: string | null, stored = ""): Promise<PropertiesPanel> {
  const panel = document.createElement("properties-panel") as PropertiesPanel;
  const graph = graphWith(format);

  // Opt in: panelen är läsbar som standard, och det här testet bygger.
  panel.editorMode = "administrator";
  document.body.append(panel);
  panel.variableOptions = QuestionVariableService.getOptions(graph);
  panel.nodeData = {
    id: "in",
    type: "submit-result",
    position: { x: 400, y: 0 },
    data: { emailCopy: true, emailVariable: stored },
  } as never;

  await settle();

  return panel;
}

const picker = (panel: PropertiesPanel): HTMLSelectElement =>
  panel.shadowRoot!.querySelector<HTMLSelectElement>('[data-property="emailVariable"]')!;

const values = (panel: PropertiesPanel): string[] =>
  [...picker(panel).options].map((option) => option.value).filter(Boolean);

describe.runIf(PRO)("väljaren för besökarens e-post", () => {
  test("erbjuder bara frågor med formatet e-post", async () => {
    expect(values(await panelFor("email"))).toEqual(["epost"]);
  });

  test("och alltså inte fritextfrågan bredvid", async () => {
    // Den fanns med förut, och en kvittens som pekar dit når aldrig fram.
    expect(values(await panelFor("email"))).not.toContain("beskrivning");
  });

  test("stängs av med ett skäl när ingen e-postfråga finns", async () => {
    /*
     * Samma mönster som mottagarväljaren: en tom lista går inte att skilja från
     * en trasig, så den säger vad som saknas i stället för att låta redaktören
     * gissa.
     */
    const panel = await panelFor(null);

    expect(picker(panel).disabled).toBe(true);
    expect(picker(panel).textContent).toMatch(/e-post/i);
  });

  test("och namnger frågan som varje annan väljare: rubrik och tekniskt namn", async () => {
    /*
     * Uppdrag 2026-08-31. Fältet visade bara rubriken, variabellistan bakom
     * `{{var}}` båda halvorna — två namn på samma variabel i samma panel.
     */
    const panel = await panelFor("email");
    const valbara = [...picker(panel).options]
      .filter((option) => option.value !== "")
      .map((option) => option.textContent!.trim());

    expect(valbara).toEqual(["Din e-post — {{epost}}"]);
  });

  test("men behåller ett redan valt värde, synligt", async () => {
    /*
     * Ändras frågans format eller tas den bort ska valet inte tyst nollas:
     * redaktören ska se att det hänt, annars försvinner mejlkopian utan spår.
     */
    const panel = await panelFor(null, "epost");

    expect(values(panel)).toContain("epost");
    expect(picker(panel).value).toBe("epost");
  });
});

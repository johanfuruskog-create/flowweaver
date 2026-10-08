import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";

import type { GraphData } from "../types/graph";

/**
 * Att gå tillbaka och ändra ska inte kosta det man skrivit — men det man
 * skrivit på en väg man sedan lämnar ska inte följa med.
 *
 * ## Var det upptäcktes
 *
 * I inlämningsfilmen. Johans manuspunkt var att visa granskningens *Ändra* —
 * det som gör granskningen till mer än en uppräkning. Mätt i visaren: fältet
 * var **tomt** när man kom tillbaka, och Nästa var låst tills allt skrevs om.
 *
 * Orsaken satt i `goBackToQuestion`, och den var logisk: historiken sparar
 * läget FÖRE varje svar, och att gå tillbaka återställde hela det läget —
 * position, svar och väg. Ur användarens sida är det omöjligt att skilja från
 * att svaret raderats.
 *
 * ## Första lagningen, och vad den missade
 *
 * Svaren behölls rakt av. Det höll för fältet men inte för inlämningen: mätt
 * 6/9 2026 stod `regnr: ABC123` kvar i `getAnswers()` efter att besökaren
 * ändrat *Har du bil?* från ja till nej — och `answers` är det inlämningen
 * skickar och `{{regnr}}` i ett resultat läser, så "det här skickas, och
 * ingenting annat" hade varit osant. Johan: *"om ens ändrade svar ändrar
 * förutsättningarna om vägen framåt behöver historiken tas bort för den
 * delen."*
 *
 * ## Vad som gäller nu
 *
 * Två saker som såg ut som en. **Körningens svar** (`getAnswers()`) spolas
 * tillbaka till läget före steget, som positionen och spåret: de bär bara
 * vad som gåtts. **Det ifyllda** (`getPrefill()`) minns allt som skrivits,
 * så fältet står ifyllt när man kommer tillbaka — och passerar besökaren
 * frågan igen skrivs svaret in i körningen på nytt. Byter vägen gren följer
 * inget med som inte gåtts.
 *
 * Det gäller båda vägarna bakåt: `Ändra` i granskningen och `Föregående`.
 */

const graph = (): GraphData => ({
  startNodeId: "namn",
  nodes: [
    {
      id: "namn",
      type: "text-question",
      position: { x: 0, y: 0 },
      data: { title: "Vad heter du?", variableName: "namn", required: true },
    },
    {
      id: "ort",
      type: "text-question",
      position: { x: 200, y: 0 },
      data: { title: "Var bor du?", variableName: "ort", required: true },
    },
    { id: "klart", type: "result", position: { x: 400, y: 0 }, data: { title: "Tack" } },
  ],
  connections: [
    { id: "a", from: { nodeId: "namn", portId: "continue" }, to: { nodeId: "ort", portId: "input" } },
    { id: "b", from: { nodeId: "ort", portId: "continue" }, to: { nodeId: "klart", portId: "input" } },
  ],
});

/** Två frågor besvarade, alltså stående på resultatet. */
function ifylld(): GuideTraversalEngine {
  const engine = new GuideTraversalEngine(graph());

  // Textfrågor besvaras med `answerValue`, inte med `answer` (som tar ett
  // alternativ-id). Första utkastet av testet använde fel API och mätte
  // därför ingenting.
  engine.answerValue("Johan");
  engine.answerValue("Örebro");

  return engine;
}

describe("tillbaka till en fråga", () => {
  test("fyller i svaret som redan skrivits", () => {
    const engine = ifylld();

    engine.goBackToQuestion("namn");

    expect(engine.getPrefill().namn).toBe("Johan");
  });

  test("och svaren som ligger efter, tills de skrivs över", () => {
    // Annars förlorar besökaren det hen fyllt i längre fram — samma förlust,
    // fast senare.
    const engine = ifylld();

    engine.goBackToQuestion("namn");

    expect(engine.getPrefill().ort).toBe("Örebro");
  });

  test("men körningen bär bara det som gåtts", () => {
    const engine = ifylld();

    engine.goBackToQuestion("namn");

    expect(engine.getAnswers()).toEqual({});
    engine.answerValue("Anna");
    expect(engine.getAnswers()).toEqual({ namn: "Anna" });
    expect(engine.getPrefill()).toEqual({ namn: "Anna", ort: "Örebro" });
  });

  test("men står på rätt fråga igen", () => {
    const engine = ifylld();

    engine.goBackToQuestion("namn");

    expect(engine.getCurrentNode()?.id).toBe("namn");
  });
});

describe("Föregående", () => {
  test("fyller också i svaret, utan att körningen bär det", () => {
    const engine = ifylld();

    engine.previous();

    expect(engine.getCurrentNode()?.id).toBe("ort");
    expect(engine.getPrefill().ort).toBe("Örebro");
    expect(engine.getAnswers()).toEqual({ namn: "Johan" });
  });
});

describe("en väg som lämnas (6/9)", () => {
  // Bil? ja → Regnummer → Granska; nej → Granska.
  const bil = (): GraphData => ({
    startNodeId: "bil",
    nodes: [
      { id: "bil", type: "question", position: { x: 0, y: 0 }, data: { title: "Har du bil?", variableName: "bil", options: [{ id: "ja", label: "Ja", value: "ja" }, { id: "nej", label: "Nej", value: "nej" }] } },
      { id: "reg", type: "text-question", position: { x: 0, y: 0 }, data: { title: "Registreringsnummer", variableName: "regnr", required: true } },
      { id: "granska", type: "review", position: { x: 0, y: 0 }, data: { title: "Granska" } },
    ],
    connections: [
      { id: "a", from: { nodeId: "bil", portId: "ja" }, to: { nodeId: "reg", portId: "input" } },
      { id: "b", from: { nodeId: "bil", portId: "nej" }, to: { nodeId: "granska", portId: "input" } },
      { id: "c", from: { nodeId: "reg", portId: "continue" }, to: { nodeId: "granska", portId: "input" } },
    ],
  });

  test("tar inte med sig svaret från grenen som lämnades", () => {
    const engine = new GuideTraversalEngine(bil());
    engine.answer("ja");
    engine.answerValue("ABC123");

    engine.goBackToQuestion("bil");
    engine.answer("nej");

    expect(engine.getCurrentNode()?.id).toBe("granska");
    expect(engine.getAnswers()).toEqual({ bil: "nej" });
  });

  test("men fyller i det igen om besökaren ångrar sig tillbaka", () => {
    const engine = new GuideTraversalEngine(bil());
    engine.answer("ja");
    engine.answerValue("ABC123");
    engine.goBackToQuestion("bil");
    engine.answer("nej");

    engine.goBackToQuestion("bil");
    engine.answer("ja");

    expect(engine.getCurrentNode()?.id).toBe("reg");
    expect(engine.getPrefill().regnr).toBe("ABC123");
    expect(engine.getAnswers()).toEqual({ bil: "ja" });
  });
});

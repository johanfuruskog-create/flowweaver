import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";

import { QuestionVariableService } from "./question-variable-service";

import type { GraphData } from "../types/graph";

/**
 * Vilka variabler bär FLERA svar — och varför listan inte får skrivas för hand.
 *
 * ## Varför den behövs
 *
 * Orden i regelvillkoret ska följa variabeln: *är någon av* på ett svar,
 * *innehåller något av* på flera. Och `lika med` erbjuds inte på en flervärd
 * variabel — i motorn betyder den "hela listan, som text, är exakt det här",
 * avsiktligt strängt men som erbjudande en fälla. Båda kräver att listan VET
 * vilka variabler som är flervärda, och `QuestionVariableOption` bar ingen
 * kardinalitet.
 *
 * ## Varför den läser nodtypens `behavior` och inte typnamnet
 *
 * För att lagringen är det som räknas, och den följer inte namnen. Mätt i
 * motorn: `multi-choice` lagrar en radbrytningsseparerad **sträng**, inte en
 * lista, och det flervärda uppslaget lagrar paren som objekt. Det enda som
 * skiljer dem från de envärda är `behavior.answer.cardinality`, som redan
 * deklareras en gång per nodtyp och redan läses av motorn och visaren. En
 * andra lista här hade varit en kopia som glider — den här kodbasens
 * vanligaste fel.
 */

const guide = (node: Record<string, unknown>): GraphData =>
  ({
    startNodeId: "q",
    nodes: [{ id: "q", position: { x: 0, y: 0 }, ...node }],
    connections: [],
  }) as unknown as GraphData;

const flervärd = (graph: GraphData, value: string): boolean =>
  QuestionVariableService.getOptions(graph).find((one) => one.value === value)?.multiple === true;

const flervalsfråga = guide({
  type: "multi-choice",
  data: {
    title: { sv: "Tjänster" },
    variableName: "tjanster",
    options: [
      { id: "a", label: { sv: "Bygglov" }, value: "bygglov" },
      { id: "b", label: { sv: "Sophämtning" }, value: "sopor" },
    ],
  },
});

const flervärtUppslag = guide({
  type: "multi-autocomplete-question",
  data: { title: { sv: "Länder" }, variableName: "land", variableLabel: "Medborgarskap", source: "codelist" },
});

const enkeltUppslag = guide({
  type: "autocomplete-question",
  data: { title: { sv: "Land" }, variableName: "land", variableLabel: "Medborgarskap", source: "codelist" },
});

describe("flervärda källor", () => {
  test("flervalsfrågan bär flera svar", () => {
    expect(flervärd(flervalsfråga, "tjanster")).toBe(true);
  });

  test("det flervärda uppslaget också — både namnet och koden", () => {
    /*
     * Båda delarna, för båda är flera: `land.value` på två valda länder är
     * `["DK", "DE"]` och `land.label` är de två namnen. Ett villkor skrivs på
     * koden, så den delen är den som räknas mest — men en del som glömdes hade
     * fått ett ord som säger fel.
     */
    expect(flervärd(flervärtUppslag, "land.value")).toBe(true);
    expect(flervärd(flervärtUppslag, "land.label")).toBe(true);
  });
});

describe("envärda källor", () => {
  test("det enkla uppslaget bär ett svar, inte flera", () => {
    // Lagringen är ETT objekt `{ label, value }`, så `land.value` är en sträng.
    expect(flervärd(enkeltUppslag, "land.value")).toBe(false);
    expect(flervärd(enkeltUppslag, "land.label")).toBe(false);
  });

  test.each([
    ["question", "val"],
    ["text-question", "namn"],
    ["number-question", "alder"],
    ["date-question", "datum"],
    ["consent-question", "samtycke"],
  ])("%s är envärd", (type, variableName) => {
    expect(flervärd(guide({ type, data: { title: { sv: "F" }, variableName } }), variableName))
      .toBe(false);
  });

  test("kartans geometri och filens markeringar är delar av ETT svar", () => {
    const karta = guide({
      type: "map-question",
      data: { title: { sv: "Plats" }, variableName: "plats" },
    });
    const fil = guide({
      type: "file-question",
      data: { title: { sv: "Foto" }, variableName: "foto", allowMarking: true },
    });

    expect(flervärd(karta, "plats.geo")).toBe(false);
    expect(flervärd(fil, "foto.markings")).toBe(false);
  });

  test("uträkningens och tjänsteanropets variabler är tal, ett i taget", () => {
    const uträkning = guide({
      type: "calculation",
      data: {
        title: { sv: "Summa" },
        assignments: [{ id: "a", variableName: "summa", formula: "1 + 1" }],
      },
    });

    expect(flervärd(uträkning, "summa")).toBe(false);
  });
});

describe("kardinaliteten har en källa", () => {
  test("den läses ur nodtypens deklarerade behavior, inte ur typens namn", () => {
    /*
     * Mutationsprovet för det här påståendet är att byta `cardinality` i
     * nodtypsregistret: gör man flervalsfrågan `single` ska den här falla.
     * Går den igenom ändå läser tjänsten något annat än deklarationen, och då
     * finns det två svar på samma fråga i kodbasen.
     */
    expect(flervärd(flervalsfråga, "tjanster")).toBe(true);
    expect(flervärd(enkeltUppslag, "land.value")).toBe(false);
  });
});

import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";

import { QuestionVariableService } from "./question-variable-service";

import type { GraphData } from "../types/graph";

/**
 * Väljaren måste erbjuda delarna, annars finns de inte för redaktören.
 *
 * ## Var det här hittades
 *
 * På Johans iPad, i regelpanelen på medborgarskapsguidens editorsida. Villkoret
 * stod som **"land.value (saknas)"** och noden bar en felmarkör — fast guiden
 * fungerar och regeln förgrenar rätt i visaren.
 *
 * Version 9 gjorde koden till en del av svaret (`land.value`) i stället för en
 * variabel bredvid (`landskod`). Motorn, mallarna och sidvillkoren följde med.
 * Den här listan gjorde det inte, så delen såg ut som en variabel ingenting
 * sätter — och hälsokontrollen läser samma lista.
 *
 * Samma lärdom som stod skriven i den här filen redan: sex falska fel om
 * kodvariabeln, och tre om kartans geometri. En panel som larmar om något som
 * fungerar lär redaktören att panelen är brus.
 */

const guide = (node: Record<string, unknown>): GraphData =>
  ({
    startNodeId: "q",
    nodes: [{ id: "q", position: { x: 0, y: 0 }, ...node }],
    connections: [],
  }) as unknown as GraphData;

const varden = (graph: GraphData): string[] =>
  QuestionVariableService.getOptions(graph).map((one) => one.value);

const etikett = (graph: GraphData, value: string): string =>
  QuestionVariableService.getOptions(graph).find((one) => one.value === value)?.label ?? "";

describe("uppslagets delar", () => {
  const uppslag = guide({
    type: "autocomplete-question",
    data: { title: { sv: "Land" }, variableName: "land", variableLabel: "Medborgarskap", source: "codelist" },
  });

  test("koden erbjuds som en del", () => {
    expect(varden(uppslag)).toContain("land.value");
  });

  test("och heter något en redaktör känner igen", () => {
    // Inte "land.value" i listan: redaktören valde ordet Medborgarskap.
    expect(etikett(uppslag, "land.value")).toBe("Medborgarskap (kod)");
  });

  test("och namnet finns som sin egen del", () => {
    /*
     * Den nakna `land` erbjuds inte längre — den var namnet under ett namn som
     * inte sa det, och stod bredvid `land.value` som en andra variabel. Nu är
     * det ett svar med två namngivna delar.
     */
    expect(varden(uppslag)).toContain("land.label");
    expect(varden(uppslag)).not.toContain("land");
  });

  test("och den gamla sidovariabeln erbjuds inte längre", () => {
    /*
     * Den skulle vara ett andra sätt att göra samma sak, och den som väljer
     * den får ett villkor som aldrig matchar — det finns ingen sådan variabel
     * sedan version 9.
     */
    expect(varden(uppslag)).not.toContain("landskod");
  });
});

describe("flervalsuppslagets delar", () => {
  test("samma sak, för det är samma svar", () => {
    const graph = guide({
      type: "multi-autocomplete-question",
      data: { title: { sv: "Språk" }, variableName: "sprak", source: "codelist" },
    });

    expect(varden(graph)).toContain("sprak.value");
  });
});

describe("kartans och filens delar", () => {
  test("geometrin är en del av platsen", () => {
    const graph = guide({
      type: "map-question",
      data: { title: { sv: "Plats" }, variableName: "plats", kind: "point" },
    });

    expect(varden(graph)).toContain("plats.geo");
    expect(varden(graph)).not.toContain("platsGeo");
  });

  test("och markeringarna en del av fotot", () => {
    const graph = guide({
      type: "file-question",
      data: { title: { sv: "Foto" }, variableName: "foto", allowMarking: true },
    });

    expect(varden(graph)).toContain("foto.markings");
    expect(varden(graph)).not.toContain("fotoMarkeringar");
  });

  test("men bara när markering är påslagen", () => {
    const graph = guide({
      type: "file-question",
      data: { title: { sv: "Foto" }, variableName: "foto" },
    });

    expect(varden(graph)).not.toContain("foto.markings");
  });

  test("och helheten säger att den är namnet", () => {
    /*
     * Johan: *det finns två variabler, varför?* Därför att svaret har två
     * delar — namnet en människa läste och koden en regel prövar. Men det
     * syntes inte: den ena hette "Medborgarskap" och den andra "Medborgarskap
     * (kod)", så den första såg ut som en dubblett i stället för som paret.
     *
     * Namnet är också det enda som är rätt i en mall — `{{land}}` skriver
     * "Danmark", inte `DK` — så båda ska finnas. De ska bara gå att skilja åt.
     */
    const graph = guide({
      type: "autocomplete-question",
      data: { title: { sv: "Land" }, variableName: "land", variableLabel: "Medborgarskap", source: "codelist" },
    });

    /*
     * Johan: *kan vi inte få ut namnet från `land.label`?* — jo, och det är
     * den bättre symmetrin. Då finns inte "två variabler" alls, utan ETT svar
     * med två namngivna delar. Den nakna `land` erbjuds inte längre: den var
     * bara namnet under ett namn som inte sa det.
     *
     * `{{land}}` i en gammal mall fortsätter fungera — helheten läses som sin
     * text — så ingenting behöver skrivas om.
     */
    /*
     * Namnet är den självklara läsningen och behöver ingen kvalificering; det
     * är koden som är undantaget. "Medborgarskap" och "Medborgarskap (kod)"
     * säger vad de är med mindre text än två suffix hade gjort.
     */
    expect(varden(graph)).toEqual(["land.value", "land.label", "idag"]);
    expect(etikett(graph, "land.label")).toBe("Medborgarskap");
    expect(etikett(graph, "land.value")).toBe("Medborgarskap (kod)");
  });
});

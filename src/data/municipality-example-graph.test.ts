import { describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import { GuideTraversalEngine } from "../viewer/core/guide-traversal-engine";
import { TemplateVariableService } from "../viewer/services/template-variable-service";
import { municipalityExampleGraph } from "./municipality-example-graph";

/**
 * Kommunexemplet — ett svar, båda delarna, en gren på koden.
 *
 * Guiden finns för att visa tre saker medborgarskapsexemplet inte gör: ett
 * ENKELT uppslag, en resultattext som skriver ut både namnet och koden, och en
 * regel som räknar upp ett läns kommunkoder.
 *
 * Testet svarar med paret — etikett och kod ihop — för det är så fältet lämnar
 * ifrån sig ett uppslagssvar. Att svara med bara koden hade prövat en väg
 * ingen besökare går.
 */

const svara = (label: string, value: string): string => {
  const motor = new GuideTraversalEngine(municipalityExampleGraph);
  const result = motor.answerValue({ label, value });

  return result.success ? result.node.id : `misslyckades: ${result.error?.message}`;
};

describe("vart svaret leder", () => {
  test("en kommun i länet hanteras där", () => {
    expect(svara("Kumla", "1881")).toBe("resultat-lanet");
  });

  test("och länets minsta räknas med", () => {
    // Lekeberg, 1814 — den enda i länet vars kod inte börjar på 186 eller 188.
    // Utan den i uppräkningen faller den till "annat län" utan att någon märker.
    expect(svara("Lekeberg", "1814")).toBe("resultat-lanet");
  });

  test("en kommun i ett annat län gör det inte", () => {
    expect(svara("Stockholm", "0180")).toBe("resultat-annat");
  });

  test("och en kommun vars NAMN liknar länets faller ändå rätt", () => {
    /*
     * Det skarpa i exemplet: regeln läser koden, inte namnet. Ett påhittat
     * "Örebro" med Göteborgs kod ska hamna utanför länet — annars vore det
     * namnet som avgjorde, och namnet är översatt medan koden inte är det.
     */
    expect(svara("Örebro", "1480")).toBe("resultat-annat");
  });
});

describe("vad resultatet skriver ut", () => {
  test("namnet ur helheten och koden ur delen", () => {
    const svar = { kommun: { label: "Kumla", value: "1881" } };
    const nod = municipalityExampleGraph.nodes.find((one) => one.id === "resultat-lanet")!;

    const rubrik = TemplateVariableService.resolve(
      (nod.data.title as { sv: string }).sv, svar, municipalityExampleGraph,
    ).resolved;
    const brod = TemplateVariableService.resolve(
      (nod.data.description as { sv: string }).sv, svar, municipalityExampleGraph,
    ).resolved;

    expect(rubrik).toBe("Kumla tar emot ärendet");
    expect(brod).toContain("1881");
    expect(brod, "koden, inte namnet en gång till").toContain("Kommunkoden är 1881");
  });
});

describe("hur guiden är byggd", () => {
  test("frågan tar ett svar, inte flera", () => {
    const fråga = municipalityExampleGraph.nodes.find((one) => one.id === "kommun")!;

    expect(fråga.type).toBe("autocomplete-question");
  });

  test("och hämtar ur SCB:s kommunlista", () => {
    const fråga = municipalityExampleGraph.nodes.find((one) => one.id === "kommun")!;

    expect(fråga.data.source).toBe("codelist");
    expect(fråga.data.codeListId).toBe("scb-municipalities");
  });

  test("regeln prövar delen, aldrig helheten", () => {
    /*
     * `kommun` skulle jämföra mot namnet. Hela exemplet handlar om att det är
     * fel, så påståendet hör hemma här och inte bara i prosan.
     */
    const regel = municipalityExampleGraph.nodes.find((one) => one.id === "regel")!;
    const villkor = (regel.data.cases as Array<{ conditions: Array<{ variableName: string }> }>)[0]!
      .conditions[0]!;

    expect(villkor.variableName).toBe("kommun.value");
  });
});

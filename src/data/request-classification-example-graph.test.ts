import { describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import { GuideHealthService } from "../editor/services/guide-health-service";
import { GuideTraversalEngine } from "../viewer/core/guide-traversal-engine";
import { resolveText } from "../viewer/core/localized-text";
import { requestClassificationExampleGraph } from "./request-classification-example-graph";

import type { FlowNodeData, QuestionOption } from "../viewer/types/graph";

/**
 * Berättelse 122: klassificering av kundönskemål — ett rent beslutsträd,
 * fyra frågor, fyra resultat. Guiden körd, inte läst, som de andra
 * exempelgraf-testerna.
 *
 * SKRIVET RÖTT FÖRE GRAFEN (PRAXIS: ett test måste ha setts falla). Filen
 * `./request-classification-example-graph` finns inte än — utvecklaren
 * bygger den parallellt (docs/STORIES/122-klassificering-av-kundonskemal.md)
 * — så importen ovan faller tills dess. Kört ensamt ska felet vara
 * `Cannot find module` eller motsvarande, inte ett syntaxfel i den här filen.
 *
 * ## Om alternativens id
 *
 * Motorn grenar på ett alternativs `id` (`engine.answer(optionId)`), och det
 * id:t väljer utvecklaren fritt när grafen skrivs — testet kan inte gissa
 * det. `answerByHint` nedan söker i stället på alternativets `value` eller
 * dess etikett (`ja`, `nej`, `delvis`, `osäkert` — orden i berättelsens egen
 * tabell) och kallar `engine.answer` med det id den HITTAR. Träffar den inget
 * kastar den ett fel som räknar upp de verkliga alternativen — en tydlig
 * diagnos i stället för ett tyst felaktigt antagande, den dag grafen finns.
 */

function questionOptions(node: FlowNodeData): QuestionOption[] {
  return Array.isArray(node.data.options)
    ? (node.data.options as unknown[]).filter(
        (candidate): candidate is QuestionOption =>
          typeof candidate === "object" && candidate !== null && "id" in candidate && "value" in candidate,
      )
    : [];
}

function variableNameOf(node: FlowNodeData | null): string | undefined {
  return node && typeof node.data.variableName === "string" ? node.data.variableName : undefined;
}

function answerByHint(engine: GuideTraversalEngine, hint: string) {
  const node = engine.getCurrentNode();
  if (!node) throw new Error(`Ingen aktuell nod — kan inte svara "${hint}".`);

  const needle = hint.toLowerCase();
  const options = questionOptions(node);
  const match = options.find((option) => {
    const value = typeof option.value === "string" ? option.value.toLowerCase() : "";
    const label = resolveText(option.label).toLowerCase();
    return value === needle || value.includes(needle) || label.includes(needle);
  });

  if (!match) {
    const found = options
      .map((option) => `${JSON.stringify(option.value)} ("${resolveText(option.label)}")`)
      .join(", ");
    throw new Error(
      `Hittade inget alternativ för "${hint}" på frågan "${resolveText(node.data.title)}" ` +
        `(variableName: ${variableNameOf(node) ?? "?"}). Tillgängliga alternativ: ${found || "inga"}.`,
    );
  }

  return engine.answer(match.id);
}

/** Svarar i tur och ordning, ett alternativ per fråga i vägen. */
function walk(engine: GuideTraversalEngine, hints: readonly string[]) {
  let result;
  for (const hint of hints) {
    result = answerByHint(engine, hint);
    if (!result.success) return result;
  }
  return result!;
}

describe("request-classification-example-graph", () => {
  /*
   * Berättelsens tabell, kriterium 6, exakt. Svar i ordning → resultatets
   * titel.
   */
  const cases: Array<[string, string[], string]> = [
    ["Ja, ja", ["ja", "ja"], "Generell utveckling"],
    ["Ja, delvis, ja", ["ja", "delvis", "ja"], "Delad utveckling"],
    ["Nej, ja", ["nej", "ja"], "Delad utveckling"],
    ["Nej, nej, ja", ["nej", "nej", "ja"], "Kundunik utveckling"],
    ["Nej, nej, osäkert", ["nej", "nej", "osäkert"], "Manuell bedömning"],
  ];

  test.each(cases)("%s → %s", (_label, hints, expectedTitle) => {
    const engine = new GuideTraversalEngine(structuredClone(requestClassificationExampleGraph));

    const result = walk(engine, hints);

    expect(result).toMatchObject({ success: true });
    if (!result.success) return;
    expect(resolveText(result.node.data.title)).toBe(expectedTitle);
  });

  /*
   * Kriterium 3: bara relevanta följdfrågor visas. Ja på fråga 1
   * (wantedAnyway) leder till fråga 2 (broadValue); Nej leder rakt till
   * fråga 3 (buildableGenerally) — fråga 2 ska aldrig synas på nej-vägen.
   */
  test("Ja på fråga 1 ger fråga 2; Nej hoppar rakt till fråga 3, aldrig fråga 2", () => {
    const jaEngine = new GuideTraversalEngine(structuredClone(requestClassificationExampleGraph));
    answerByHint(jaEngine, "ja");
    expect(variableNameOf(jaEngine.getCurrentNode())).toBe("broadValue");

    const nejEngine = new GuideTraversalEngine(structuredClone(requestClassificationExampleGraph));
    answerByHint(nejEngine, "nej");
    expect(variableNameOf(nejEngine.getCurrentNode())).toBe("buildableGenerally");
    expect(variableNameOf(nejEngine.getCurrentNode())).not.toBe("broadValue");
  });

  /*
   * Kriterium 5: användaren kan gå tillbaka och ändra svar, och resultatet
   * uppdateras. Nej, nej, ja → Kundunik utveckling; ångra bara den SISTA
   * frågan (fråga 4, customerSpecific) och svara osäkert i stället → Manuell
   * bedömning.
   *
   * ETT `previous()`, inte två — mätt mot den riktiga grafen, inte
   * uppdragets antal. `previous()` ångrar ETT besvarat steg (den senast
   * lämnade noden), så en backning från resultatet landar på fråga 4, där
   * "osäkert" hör hemma (frågans andra alternativ är "Nej eller osäkert").
   * En andra backning landar på fråga 3 (buildableGenerally), vars enda två
   * alternativ är Ja/Nej — "osäkert" finns inte där, och testet fick ett
   * tydligt fel av `answerByHint` som visade det innan den här raden
   * rättades.
   */
  test("Nej, nej, ja ger Kundunik; ångra sista frågan och svara osäkert ger Manuell bedömning", () => {
    const engine = new GuideTraversalEngine(structuredClone(requestClassificationExampleGraph));

    const first = walk(engine, ["nej", "nej", "ja"]);
    expect(first).toMatchObject({ success: true });
    if (!first.success) return;
    expect(resolveText(first.node.data.title)).toBe("Kundunik utveckling");

    const back = engine.previous();
    expect(back).toMatchObject({ success: true });
    expect(variableNameOf(engine.getCurrentNode())).toBe("customerSpecific");

    const changed = answerByHint(engine, "osäkert");
    expect(changed).toMatchObject({ success: true });
    if (!changed.success) return;
    expect(resolveText(changed.node.data.title)).toBe("Manuell bedömning");
  });

  test("hälsan hittar ingenting", () => {
    expect(GuideHealthService.analyze(requestClassificationExampleGraph)).toEqual([]);
  });

  /* Kriterium 1: exakt de fyra frågorna och fyra resultaten. */
  test("exakt fyra question-noder och fyra result-noder", () => {
    const questions = requestClassificationExampleGraph.nodes.filter((node) => node.type === "question");
    const results = requestClassificationExampleGraph.nodes.filter((node) => node.type === "result");

    expect(questions).toHaveLength(4);
    expect(results).toHaveLength(4);
    expect(questions.map((node) => variableNameOf(node)).sort()).toEqual(
      ["broadValue", "buildableGenerally", "customerSpecific", "wantedAnyway"],
    );
  });
});

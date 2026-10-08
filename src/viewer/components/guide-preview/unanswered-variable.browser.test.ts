import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";
// Editorns bild av samma ruta prövas här nere, och den läser editorns ord.
// En visarkomponents test får importera editorns ordlista; grinden räknar
// aldrig testfiler (CLAUDE.md, "Katalogerna").
import "../../../editor/localization/editor-ui-strings";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * En mallvariabel utan värde, i besökarens bild och i redaktörens.
 *
 * Felet: Låna-sidan (`/sv/examples/`) mötte besökaren med
 * *"{{kostnad}} kr/mån. Totalt att återbetala: {{totalt}} kr"* — klamrarna
 * syns, för sidans uträkning har inga tal att räkna på förrän besökaren
 * fyllt i något. Mätningen 13/9 visade att det inte är Lånas fel utan
 * visarens, och att fyra buntade guider bar samma mönster.
 *
 * **EGEN FIXTUR, inte längre exempelguiderna (Johans beslut 15/9).**
 * Berättelse 118, kriterium 6 gav Låna, Offert och Flytt startvärden, och
 * Skadeanmälan väntar bara kvar för att dess mening läser `sjalvrisk`, en
 * variabel från en TIDIGARE sida (tjänsteanropet) — ett annat fenomen än det
 * den här filen prövar. Ett test som lånar en exempelguide som fixtur tappar
 * sin grund varje gång innehållet i den guiden ändras av ett SKÄL SOM INTE
 * HAR MED DET HÄR TESTET ATT GÖRA — precis vad som hände två gånger på en
 * dag. Grafen nedan är byggd bara för det här testet: en sida med en
 * uträkning som läser två fält, ingetdera med ett startvärde, så rutan är
 * garanterat tom vid ankomst oavsett vad någon exempelguide råkar innehålla.
 *
 * **QA, 13/9, oförändrat skäl:** besökartestet påstår mer än "klamrarna är
 * borta och ett streck finns". De tre lösa kontrollerna (inga `{{`, inga
 * `}}`, ett `–`) höll ALLA tre samtidigt som ett för girigt
 * `VARIABLE_PATTERN` svalde hela meningen mellan två mallvariabler på samma
 * sida och kollapsade den till ett enda streck — tre sanna påståenden som
 * tillsammans inte säger det man tror. Den fjärde kontrollen, den exakta
 * meningen, är den som påstår det testet faktiskt handlar om: att texten
 * RUNT variabeln överlever, inte bara att variabeln själv gjorde det. Fixturen
 * har därför TVÅ mallvariabler i en mening med text emellan, som Skadeanmälan
 * hade — annars är den fjärde kontrollen bredd som ser ut som täckning.
 */

const graph = (): GraphData => ({
  startNodeId: "p",
  settings: { sourceLocale: "sv" },
  nodes: [
    { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
    {
      id: "a", type: "number-question", parentPageId: "p", order: 0, position: { x: 0, y: 0 },
      data: { title: { sv: "Belopp" }, variableName: "belopp" },
    },
    {
      id: "b", type: "number-question", parentPageId: "p", order: 1, position: { x: 0, y: 0 },
      data: { title: { sv: "Tillägg" }, variableName: "tillagg" },
    },
    {
      id: "calc", type: "calculation", parentPageId: "p", order: 2, position: { x: 0, y: 0 },
      data: {
        title: { sv: "Summering" },
        assignments: [
          { id: "a1", variableName: "summa", label: { sv: "Preliminär summa" }, formula: "belopp * 2" },
          { id: "a2", variableName: "andel", label: { sv: "Tilläggets andel" }, formula: "tillagg / 2" },
        ],
      },
    },
    {
      id: "heading", type: "page-heading", parentPageId: "p", order: 3, position: { x: 0, y: 0 },
      data: {
        description: { sv: "Uträkningen visar **{{summa}} kr**, varav **{{andel}} kr** är tillägget." },
        presentation: "info",
      },
    },
    { id: "r", type: "result", position: { x: 200, y: 0 }, data: { title: { sv: "Klart" } } },
  ],
  connections: [
    { id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
  ],
});

/** Startar guiden på sidan, så rutan ritas precis som vid ankomst. */
function arriveAt(editorView = false): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  if (editorView) preview.setAttribute("editor-view", "");
  document.body.append(preview);
  preview.graph = structuredClone(graph());

  return preview;
}

function box(preview: GuidePreview): HTMLElement | null {
  return preview.shadowRoot?.querySelector<HTMLElement>(
    '[data-page-heading-id="heading"]',
  ) ?? null;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("en mallvariabel utan värde", () => {
  test("besökaren möter ett streck, aldrig klamrarna", () => {
    const text = box(arriveAt())?.textContent ?? "";

    expect(text).not.toContain("{{");
    expect(text).not.toContain("}}");
    expect(text).toContain("–");
    /*
     * QA, mutationsprövat 13/9: de tre ovanstående klarar sig igenom ett
     * `VARIABLE_PATTERN` som är för girigt (`/\{\{(.*)\}\}/`, ingen
     * uteslutning av `{}`) — mönstret äter då texten MELLAN två
     * mallvariabler på samma sida och kollapsar allt till ETT streck, men
     * fortfarande utan klamrar och med minst ett streck kvar, så de tre
     * lösa kontrollerna ovan ser inget fel. Den hela meningen, ord för ord,
     * är den enda kontroll som visar att det som stod MELLAN två variabler
     * fortfarande står där — inte bara att klamrarna är borta.
     */
    expect(text).toContain("Uträkningen visar – kr, varav – kr är tillägget.");
  });

  /*
   * Och redaktörens bild är den andra halvan av samma fråga: på canvasen ska
   * samma ruta visa variabelns ETIKETT, precis som ett resultatsteg redan
   * gör (`variableGaps`, Johan 3/9). Den halvan är skälet till att rättningen
   * inte kan bo i `FormattedTextService`: gör tjänsten om klamrarna till ett
   * streck finns namnet inte kvar att slå upp, och redaktören ser "–" i
   * stället för "Preliminär summa".
   */
  test("redaktören ser variabelns etikett i samma ruta", () => {
    const preview = arriveAt(true);
    const gaps = [
      ...(box(preview)?.querySelectorAll(".guide-preview__variable-gap") ?? []),
    ].map((gap) => gap.textContent?.trim());

    expect(gaps).toEqual(["Preliminär summa", "Tilläggets andel"]);
  });
});

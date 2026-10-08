import { page } from "vitest/browser";
import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/*
 * Nästa bifynd i samma klass, mätt i den egna efter-bilden av
 * Nästa-knappen (uppdrag 22/9): på `examples/every-field.html`, 320 px,
 * rot 32px (200 %), stack fältgruppens rubrik "Kontaktuppgifter" ut ur
 * kortet till höger, och `.guide-preview__page-heading`s egen
 * `border-bottom` följde med — sektionens box breddades av rubrikens
 * overflow, inte bara texten.
 *
 * ## Mätt (inte antaget): varken h3 eller label är en `<legend>`
 *
 * Kodbasen har redan ett dokumenterat legend-specialfall
 * (`.guide-preview__page-field > legend`, kommentaren om UA-algoritmen för
 * rendered legend-boxar) — så hypotesen att det här också var en legend var
 * rimlig. Mätt med `getComputedStyle`/`getBoundingClientRect` innan något
 * ändrades: båda är vanliga `display: block`-boxar.
 *
 * - `.guide-preview__page-heading h3` ("Kontaktuppgifter"): `scrollWidth`
 *   351 mot `clientWidth` 246 — samma orsak som `.examples-index` (Fynd 1,
 *   samma dag): ett sammansatt ord utan blanksteg, `overflow-wrap: normal`
 *   ger det ingen brytpunkt.
 * - `.guide-preview__page-field > label` ("Organisationsnummer"): boxen
 *   själv (inte bara texten) var 351 px — grid-elementets
 *   `min-width: auto`-standard bottnar i min-content, och för ett ord utan
 *   brytpunkt är min-content lika brett som ordet.
 *
 * Rättat med `overflow-wrap: anywhere` på båda (plus `min-width: 0` på
 * labeln, som saknade den bottengränsen grid-behållaren redan hade).
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Samma sorts sammansatta ord som i det verkliga fyndet, i både rubrik och fältnamn. */
function pageWithLongWords(): GraphData {
  return {
    startNodeId: "p",
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
      {
        id: "namn",
        type: "text-question",
        parentPageId: "p",
        order: 1,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Namn" }, variableName: "namn" },
      },
      {
        id: "heading",
        type: "page-heading",
        parentPageId: "p",
        order: 2,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Kontaktuppgifter" }, description: "" },
      },
      {
        id: "orgnr",
        type: "text-question",
        parentPageId: "p",
        order: 3,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Organisationsnummer" }, variableName: "orgnr" },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [{ id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } }],
  } as unknown as GraphData;
}

describe("fältgruppens rubrik och fältnamn vid 200 % textförstoring", () => {
  afterEach(() => {
    document.documentElement.style.fontSize = "";
  });

  test("bryter i stället för att sticka ut ur kortet på 320 px", async () => {
    await page.viewport(320, 900);
    document.documentElement.style.fontSize = "32px";

    const preview = document.createElement("guide-preview") as GuidePreview;

    preview.style.cssText = "display: block; width: 280px;";
    document.body.append(preview);
    preview.graph = pageWithLongWords();
    await settle();
    await settle();

    const root = preview.shadowRoot!;
    const heading = root.querySelector<HTMLElement>(".guide-preview__page-heading h3")!;
    const headingSection = heading.closest<HTMLElement>(".guide-preview__page-heading")!;
    const label = [...root.querySelectorAll<HTMLElement>(".guide-preview__page-field > label")].find(
      (el) => el.textContent?.trim() === "Organisationsnummer",
    )!;

    expect(heading.scrollWidth, "rubriken 'Kontaktuppgifter' sticker ut ur sin rad").toBeLessThanOrEqual(
      heading.clientWidth + 2,
    );
    expect(
      headingSection.scrollWidth,
      "sektionens linje (border-bottom) följer med rubrikens overflow",
    ).toBeLessThanOrEqual(headingSection.clientWidth + 2);
    expect(label.scrollWidth, "fältnamnet 'Organisationsnummer' sticker ut ur sin cell").toBeLessThanOrEqual(
      label.clientWidth + 2,
    );

    // Hela komponentens egen box ska inte bidra till sidledsrullning.
    const section = root.querySelector<HTMLElement>("section.guide-preview")!;

    expect(section.scrollWidth, "guide-preview svämmar över sin egen bredd").toBeLessThanOrEqual(
      section.clientWidth + 2,
    );
  });
});

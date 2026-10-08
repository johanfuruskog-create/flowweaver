import { page } from "vitest/browser";
import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/*
 * Johan, 22/9: "besökarens sida ska hålla vid zoom, med knapparna först."
 *
 * Föregående/Nästa hade ingen egen bredd innan det här — "Nästa" var 86 px
 * på en 900 px bred sida (622 px rad att dela på), ett frimärke i tomrum.
 * `min-width: min(9rem, 100%)` på `.guide-preview__navigation button` ger
 * en golvbredd som växer med texten (rem) men aldrig kräver mer än raden har
 * (100%-taket).
 *
 * ## Talet, mätt två gånger
 *
 * Första försöket satte golvet till 10rem (160 px). Bildgranskning (Johan)
 * visade att 390 px/100 % då bröt till två rader — fel, det var inte det som
 * bads om. Mätt orsak: `.guide-preview__navigation`s bredd där är 316 px,
 * och 160+160+12=332 är 16 px för mycket. Sänkt till 9rem (144 px):
 * 144+144+12=300 ≤ 316, en rad håller. Vid 320 px/200 % är 9rem 288 px —
 * 100 %-taket ger ändå full bredd staplat, som förut.
 *
 * `flex-wrap` (satt i ett tidigare uppdrag) bryter fortfarande raden när den
 * genuint är för smal — 320 px/100 % gör det (144+144+12=300 mot en rad som
 * bara har ~246 px), och det är rätt: två 144px-knappar kan inte båda rymmas
 * där utan att en av dem sticker ut. Ingenting klipps; de staplas i stället.
 */

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.style.fontSize = "";
});

const settle = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function twoPageGraph(): GraphData {
  return {
    startNodeId: "p1",
    nodes: [
      { id: "p1", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
      {
        id: "f1", type: "text-question", parentPageId: "p1", order: 1, position: { x: 0, y: 0 },
        data: { title: { sv: "Namn" }, variableName: "namn" },
      },
      { id: "p2", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Mer" } } },
      {
        id: "f2", type: "text-question", parentPageId: "p2", order: 1, position: { x: 0, y: 0 },
        data: { title: { sv: "E-post" }, variableName: "epost" },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "p1", portId: "continue" }, to: { nodeId: "p2", portId: "input" } },
      { id: "c2", from: { nodeId: "p2", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as unknown as GraphData;
}

async function onSecondPage(width: number): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = `display: block; width: ${Math.min(width - 40, 680)}px;`;
  document.body.append(preview);
  preview.graph = twoPageGraph();
  await settle();
  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle();

  return preview;
}

describe("navigeringens knappar har ett golv, inte ett frimärke", () => {
  test("900 px / 100 %: minst 144 px per knapp, var sin kant, ingen overflow", async () => {
    await page.viewport(900, 900);
    const preview = await onSecondPage(900);
    const root = preview.shadowRoot!;
    const nav = root.querySelector<HTMLElement>(".guide-preview__navigation")!;
    const previous = root.querySelector<HTMLElement>('[data-action="previous"]')!.getBoundingClientRect();
    const next = root.querySelector<HTMLElement>('[data-action="next"]')!.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();

    expect(previous.width, "Föregående under golvet").toBeGreaterThanOrEqual(144);
    expect(next.width, "Nästa under golvet").toBeGreaterThanOrEqual(144);
    expect(previous.left, "Föregående ska stå i vänsterkanten").toBeCloseTo(navRect.left, 0);
    expect(next.right, "Nästa ska stå i högerkanten").toBeCloseTo(navRect.right, 0);
    expect(nav.scrollWidth, "raden svämmar över sin egen bredd").toBeLessThanOrEqual(nav.clientWidth + 2);
  });

  test("390 px / 100 %: en rad, minst 144 px per knapp, ingen overflow", async () => {
    await page.viewport(390, 900);
    const preview = await onSecondPage(390);
    const root = preview.shadowRoot!;
    const previous = root.querySelector<HTMLElement>('[data-action="previous"]')!.getBoundingClientRect();
    const next = root.querySelector<HTMLElement>('[data-action="next"]')!.getBoundingClientRect();
    const section = root.querySelector<HTMLElement>("section.guide-preview")!;

    expect(previous.width, "Föregående under golvet").toBeGreaterThanOrEqual(144);
    expect(next.width, "Nästa under golvet").toBeGreaterThanOrEqual(144);
    expect(Math.abs(previous.top - next.top), "knapparna ska stå på EN rad vid 390/100 %").toBeLessThan(2);
    expect(previous.right, "Föregående sticker ut ur fönstret").toBeLessThanOrEqual(390);
    expect(next.right, "Nästa sticker ut ur fönstret").toBeLessThanOrEqual(390);
    expect(section.scrollWidth, "guide-preview svämmar över sin egen bredd").toBeLessThanOrEqual(
      section.clientWidth + 2,
    );
  });

  test("320 px / 100 %: raden bryter ändå (för smal för två 144px-knappar), ingen overflow", async () => {
    await page.viewport(320, 900);
    const preview = await onSecondPage(320);
    const root = preview.shadowRoot!;
    const previous = root.querySelector<HTMLElement>('[data-action="previous"]')!.getBoundingClientRect();
    const next = root.querySelector<HTMLElement>('[data-action="next"]')!.getBoundingClientRect();
    const section = root.querySelector<HTMLElement>("section.guide-preview")!;

    expect(previous.width, "Föregående under golvet").toBeGreaterThanOrEqual(144);
    expect(next.width, "Nästa under golvet").toBeGreaterThanOrEqual(144);
    expect(previous.top, "Föregående ska stå ovanför Nästa (dokumentordning)").toBeLessThan(next.top);
    expect(previous.right, "Föregående sticker ut ur fönstret").toBeLessThanOrEqual(320);
    expect(next.right, "Nästa sticker ut ur fönstret").toBeLessThanOrEqual(320);
    expect(section.scrollWidth, "guide-preview svämmar över sin egen bredd").toBeLessThanOrEqual(
      section.clientWidth + 2,
    );
  });

  test("320 px / 200 %: knapparna staplas i full bredd", async () => {
    await page.viewport(320, 900);
    document.documentElement.style.fontSize = "32px";
    const preview = await onSecondPage(320);
    const root = preview.shadowRoot!;
    const nav = root.querySelector<HTMLElement>(".guide-preview__navigation")!;
    const previous = root.querySelector<HTMLElement>('[data-action="previous"]')!.getBoundingClientRect();
    const next = root.querySelector<HTMLElement>('[data-action="next"]')!.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();

    expect(previous.width, "Föregående fyller inte raden").toBeCloseTo(navRect.width, 0);
    expect(next.width, "Nästa fyller inte raden").toBeCloseTo(navRect.width, 0);
    expect(previous.right, "sticker ut ur fönstret").toBeLessThanOrEqual(320);
    expect(next.right, "sticker ut ur fönstret").toBeLessThanOrEqual(320);
  });
});

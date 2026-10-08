import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Knappen i nodkortet är en bild, knappen på besökarens sida är en kontroll.
 *
 * ## Felet
 *
 * Johan 19/9, med en låst guide på canvasen: *"en aning höga, mycket
 * padding"*. Mätt i renderad DOM innan något rättades: knappen i kortet var
 * **44 px** hög runt **12 px** text — `min-height: 44px` (K6) gällde även där,
 * och 14 px luft över och under en rad på knappt 17 px läser som en knapp som
 * väntar på en tumme.
 *
 * ## Varför kortet får vara litet
 *
 * K6 är ett krav på **träffytan**. Förhandsvisningen i ett nodkort är `inert`:
 * den går inte att trycka på, den visar hur besökarens sida ser ut. En yta
 * ingen kan träffa har ingen träffyta att skydda. Besökarens riktiga sida, och
 * kortet medan guiden provas på canvasen (berättelse 065, då knapparna
 * fungerar), håller kvar sina 44 px — båda mäts här, för en regel som krympte
 * dem också hade tagit K6 med sig.
 *
 * ## Varför måtten står i `em`
 *
 * Knappen ska följa kortets textstorlek. Ett pixeltal hade suttit kvar den dag
 * texten i miniatyren ändras, och då är felet tillbaka utan att någon rört
 * knappen.
 */

const graph = (): GraphData => ({
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: "Din favoritfärg?",
        variableName: "farg",
        options: [
          { id: "a", label: "Blå", value: "bla" },
          { id: "b", label: "Röd", value: "rod" },
        ],
      },
    },
    { id: "done", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "q", portId: "a" }, to: { nodeId: "done", portId: "input" } },
  ],
});

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

afterEach(() => document.body.replaceChildren());

/**
 * `kort` är miniatyren som `flow-node` ritar: smal, `editor-view`, `inert`.
 * `visare` är besökarens sida, i den bredd en sidkolumn har.
 */
async function mount(which: "kort" | "kort-provas" | "visare"): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  if (which === "visare") {
    preview.style.cssText = "display: block; width: 660px;";
  } else {
    preview.setAttribute("editor-view", "");
    preview.setAttribute("inert", "");
    preview.style.cssText = "display: block; width: 280px;";
  }

  if (which === "kort-provas") {
    preview.setAttribute("proving", "");
  }

  document.body.append(preview);
  preview.graph = graph();
  // Två bildrutor: ResizeObserver skriver `data-under` efter första.
  await settle();
  await settle();

  return preview;
}

function measure(preview: GuidePreview) {
  const button = preview.shadowRoot?.querySelector<HTMLElement>('[data-action="next"]');

  if (!button) throw new Error("ingen Nästa-knapp");

  const style = getComputedStyle(button);
  const fontSize = Number.parseFloat(style.fontSize);
  const lineHeight = style.lineHeight.endsWith("px")
    ? Number.parseFloat(style.lineHeight)
    : fontSize * 1.2;

  return { height: button.getBoundingClientRect().height, fontSize, lineHeight };
}

describe("knappen i nodkortets miniatyr", () => {
  test("är i proportion till kortets text, inte till en tumme", async () => {
    const measured = measure(await mount("kort"));

    expect(measured.height, "44 px runt 12 px text är felet som rättades").toBeLessThan(36);
    /*
     * Och inte hopklämd: texten ska ha luft omkring sig, räknad ur sin egen
     * storlek och inte ur ett tal. En rad plus 0,8 em är golvet.
     */
    expect(measured.height).toBeGreaterThanOrEqual(measured.lineHeight + 0.8 * measured.fontSize);
  });

  test("men behåller träffytan medan guiden provas på canvasen", async () => {
    /*
     * The canvas scales the card, and a transformed box's rect carries float
     * noise: 44 px measured 43.99998 in one run of three (25/9 2026, on a
     * commit that had not touched the card). A thousandth is noise; a pixel
     * is a regression.
     */
    expect(measure(await mount("kort-provas")).height).toBeGreaterThanOrEqual(44 - 0.001);
  });

  test("och knapparna delar rad också då — golvet är sidans, inte kortets", async () => {
    /*
     * Mätt 1/10 2026 i promons tredje stillbild: det provade kortet (206 px
     * innehåll) fick besökarens breddgolv, 144 + 144 + 8 px, och staplade
     * "Föregående" över "Nästa" i 96 px, medan grannkorten — inerta — visade
     * samma knappar 31 px höga sida vid sida. Knapparna hoppade alltså i
     * storlek varje gång steget flyttade (Johan: "knapparna i visaren är
     * staplade i editorn"). K6 är höjden och gäller; breddgolvet finns för
     * att knapparna inte ska bli frimärken i ett brett kort, och ett kort
     * på canvasen är aldrig brett.
     */
    const preview = await mount("kort-provas");
    // One step in: the first step has no *Föregående* since 1/10 (Astra,
    // bilaga 10 punkt 10), so the pair is measured on the result, where
    // *Föregående* and *Börja om* share the row.
    preview.shadowRoot!.querySelector<HTMLInputElement>('[data-option-id="a"]')!.click();
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    await settle();
    const buttons = [...preview.shadowRoot!.querySelectorAll<HTMLElement>(".guide-preview__navigation button")];

    expect(buttons).toHaveLength(2);
    const [prev, next] = buttons.map((b) => b.getBoundingClientRect());
    expect(Math.abs(prev.top - next.top), "samma rad").toBeLessThan(1);
    expect(next.left, "Börja om till höger om Föregående").toBeGreaterThan(prev.right);
    for (const rect of [prev, next]) expect(rect.height).toBeGreaterThanOrEqual(44 - 0.001);
  });
});

describe("knappen på besökarens sida", () => {
  test("är kvar på 44 px (K6)", async () => {
    expect(measure(await mount("visare")).height).toBeGreaterThanOrEqual(44);
  });
});

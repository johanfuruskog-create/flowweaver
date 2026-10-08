import { page as browserPage } from "vitest/browser";
import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Bifynd från sidhuvuds-uppdraget 22/9 (Fable): på `examples/every-field.html`,
 * vid 200 % textförstoring (roten satt till 32px), stack "Nästa"-knappen ut
 * ur ett 390 px fönster — 138 px bred knapp med vänsterkant vid 297 px.
 *
 * ## Mätt orsak (inte gissad)
 *
 * "Föregående" är ETT ord utan brytpunkt. Dess min-content-bredd (~248 px vid
 * 200 %) är i sig bredare än utrymmet raden har kvar bredvid "Nästa" (138 px
 * + 12 px mellanrum) på både 320 och 390 px. Ingen flex-krympning kan komma
 * under ett ords egen bredd utan att bryta själva ordet — raden måste alltså
 * bryta i stället (`flex-wrap: wrap` på `.guide-preview__navigation`), inte
 * knapparna krympa. K6 (`min-height: 44px`) är oberoende av bredden och
 * rörs inte.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Två sidor i följd, så "Föregående" och "Nästa" syns tillsammans på den andra. */
function twoPageGraph(): GraphData {
  return {
    startNodeId: "p1",
    nodes: [
      { id: "p1", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
      {
        id: "f1",
        type: "text-question",
        parentPageId: "p1",
        order: 1,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Namn" }, variableName: "namn" },
      },
      { id: "p2", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Kontaktuppgifter" } } },
      {
        id: "f2",
        type: "text-question",
        parentPageId: "p2",
        order: 1,
        position: { x: 0, y: 0 },
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

async function onSecondPage(
  width: number,
  attributes: string[] = [],
): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  for (const name of attributes) {
    preview.setAttribute(name, "");
  }

  preview.style.cssText = `display: block; width: ${width}px;`;
  document.body.append(preview);
  preview.graph = twoPageGraph();
  await settle();
  await settle();

  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle();
  await settle();

  return preview;
}

const navButtons = (preview: GuidePreview) => {
  const root = preview.shadowRoot!;

  return {
    previous: root
      .querySelector<HTMLButtonElement>('[data-action="previous"]')!
      .getBoundingClientRect(),
    next: root
      .querySelector<HTMLButtonElement>('[data-action="next"]')!
      .getBoundingClientRect(),
  };
};

describe("Föregående/Nästa vid 200 % textförstoring", () => {
  afterEach(() => {
    document.documentElement.style.fontSize = "";
  });

  test("ryms båda inom fönstret på 320 och 390 px, i rätt ordning", async () => {
    document.documentElement.style.fontSize = "32px";

    for (const width of [320, 390]) {
      await browserPage.viewport(width, 900);
      const preview = await onSecondPage(width);
      const root = preview.shadowRoot!;
      const previous = root.querySelector<HTMLButtonElement>('[data-action="previous"]')!;
      const next = root.querySelector<HTMLButtonElement>('[data-action="next"]')!;
      const previousRect = previous.getBoundingClientRect();
      const nextRect = next.getBoundingClientRect();

      expect(previousRect.right, `Föregående hamnar utanför fönstret vid ${width}px`).toBeLessThanOrEqual(width);
      expect(nextRect.right, `Nästa hamnar utanför fönstret vid ${width}px`).toBeLessThanOrEqual(width);

      // K6: träffytan är minst 44 px oberoende av bredden.
      expect(previousRect.height, `Föregående under K6 vid ${width}px`).toBeGreaterThanOrEqual(44);
      expect(nextRect.height, `Nästa under K6 vid ${width}px`).toBeGreaterThanOrEqual(44);

      // Ordningen består: Föregående kommer före Nästa, sida vid sida eller
      // ovanför — aldrig tvärtom, oavsett om raden bröt eller inte.
      const previousBeforeNext = previousRect.right <= nextRect.left + 1 || previousRect.bottom <= nextRect.top + 1;

      expect(previousBeforeNext, "Föregående ska stå före Nästa i läsordningen").toBe(true);

      document.body.replaceChildren();
    }
  });
});

/**
 * Samma två knappar i spegeln på canvasen — och där gäller motsatsen.
 *
 * ## Vad som var fel
 *
 * `flex-wrap: wrap` ovan är besökarens, och riktig: vid 200 % är *Föregående*
 * ett ord på 248 px och raden MÅSTE bryta. Golvet `min(9rem, 100%)` på
 * knappen är också besökarens. Men golvet gäller vid 100 % också, och ett
 * nodkort på canvasen är 240 px brett med 206 px innehåll: 144 + 144 + 12 =
 * 300 px får inte plats, så raden bröt i **varje** spegel och den blev en
 * knapprad (39 px, mätt 23/9 2026) högre än före golvet. Med tänt öga är det
 * spegeln som håller upp kortet (`.flow-node__visitor` i flow-node.scss), så
 * kortet växte med den.
 *
 * ## Varför golvet får släppas just här
 *
 * I spegeln är knapparna inte kontroller: förhandsvisningen är `inert`, och
 * K6:s träffyta gäller besökarens yta (`docs/KRAV.md`). Samma undantag som
 * `min-height: 0` redan vilar på några rader ned i stilmallen. Under `proving`
 * går knapparna att trycka på, och då gäller K6 på höjden igen — men inte
 * breddgolvet, som är sidans (mot frimärken i ett brett kort) och som i ett
 * 206 px-kort bara staplar knapparna: 96 px i det provade kortet mot 31 i
 * grannkorten, så knapparna hoppade i storlek med varje steg (promons
 * stillbild 1/10 2026, Johan: "knapparna i visaren är staplade i editorn";
 * till 1/10 höll det andra provet den staplingen som rätt). Bara golvet lyfts: `flex-wrap: nowrap`
 * prövades och gjorde ingenting ett test kunde se, och hade varit fel vid
 * 200 % (skälet står i stilmallen).
 *
 * ## Varför påståendet står här och inte i exempelgrinden
 *
 * `example-graphs-no-overlap` såg det här som två överlappande noder, men bara
 * för att den mätte en egen, fristående `guide-preview` i stället för spegeln
 * — full visarskala, ungefär dubbla höjden. Med den rättad ser grinden inte
 * den här knappraden alls (prövat 23/9: ta bort reglerna i stilmallen och
 * grinden är fortfarande grön). Påståendet om spegelns knappar hör alltså
 * hemma bredvid knapparna.
 */
describe("spegeln på canvasen håller knapparna på en rad", () => {
  // Spegeln är visaren INNE I noden: flow-node sätter `in-node` (kortet
  // utan ram och luft, noden är kortet) utöver `editor-view` (redaktörens
  // bild). Sedan 25/9 är det två attribut — se guide-preview-card-in-panel.
  /** Kortets innehållsbredd i ett 240 px nodkort, mätt 23/9 2026. */
  const MIRROR_WIDTH = 206;

  test("editor-view: Föregående och Nästa står sida vid sida", async () => {
    const preview = await onSecondPage(MIRROR_WIDTH, ["editor-view", "in-node", "inert"]);
    const { previous, next } = navButtons(preview);

    expect(Math.round(previous.top), "knapparna ska dela rad").toBe(
      Math.round(next.top),
    );

    /*
     * Och de ryms. Att dela rad kan också betyda att knapparna ligger UTANFÖR
     * kortet — `flex-wrap: nowrap` håller dem på raden medan golvet
     * fortfarande kräver 300 px av 206. Därför mäts kanterna mot spegelns
     * egna, inte knappens bredd för sig.
     */
    const box = preview.getBoundingClientRect();

    expect(next.right, "Nästa sticker ut ur kortet").toBeLessThanOrEqual(
      box.right + 1,
    );
    expect(previous.left, "Föregående sticker ut ur kortet").toBeGreaterThanOrEqual(
      box.left - 1,
    );
  });

  test("proving: K6 på höjden gäller igen, men raden håller", async () => {
    const preview = await onSecondPage(MIRROR_WIDTH, ["editor-view", "in-node", "proving"]);
    const { previous, next } = navButtons(preview);

    // Knappen är en kontroll igen, alltså K6 på höjden — men breddgolvet
    // (144 px) plus mellanrummet får inte plats på 206 px och skulle stapla
    // dem, så det släpps även här (till 1/10 2026 höll provet staplingen som
    // rätt; skälet till bytet står överst i filen).
    expect(Math.round(previous.top), "knapparna ska dela rad även under proving").toBe(
      Math.round(next.top),
    );
    expect(next.left, "Nästa till höger om Föregående").toBeGreaterThan(previous.right);
    expect(next.height, "Nästa under K6 i provläget").toBeGreaterThanOrEqual(44 - 0.001);
    expect(previous.height, "Föregående under K6 i provläget").toBeGreaterThanOrEqual(44 - 0.001);
  });

  test("samma knapp bär golvet på besökarens sida och släpper det i spegeln", async () => {
    // 9rem = 144 px, talet i stilmallen. Skrivet ut här för att provet ska
    // falla om talet ändras utan att någon tänkt på spegeln — inte läst ur
    // samma ställe som koden (PRAXIS 3).
    const FLOOR = 144;

    const visitor = await onSecondPage(MIRROR_WIDTH);
    const visitorWidth = navButtons(visitor).previous.width;

    document.body.replaceChildren();

    const mirror = await onSecondPage(MIRROR_WIDTH, ["editor-view", "in-node", "inert"]);
    const mirrorWidth = navButtons(mirror).previous.width;

    expect(visitorWidth, "besökarens knapp ska bära golvet").toBeGreaterThanOrEqual(
      FLOOR,
    );
    expect(mirrorWidth, "spegelns knapp ska krympa till sitt ord").toBeLessThan(
      FLOOR,
    );
  });
});

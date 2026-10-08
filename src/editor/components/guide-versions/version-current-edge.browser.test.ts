import { afterEach, describe, expect, test } from "vitest";

import "./guide-versions";

import type { GuideVersions } from "./guide-versions";

/**
 * Den gröna linjen som märker ut den publicerade versionen — och luften
 * mellan den och namnet (Johans bild 20/9, 390 px).
 *
 * ## Felet det här är skrivet ur
 *
 * Linjen ritas som `inset 2px 0 0` på namnets cell. I bredd står namnet 10 px
 * från cellens kant, alltså 8 px från linjen. I den smala brytpunkten får
 * cellen `padding: 2px 4px` och raden `8px 4px` — och då stod namnet **4 px**
 * från cellkanten och 2 px från linjen. Linjen läste som en understrykning av
 * namnet i stället för som en markering av raden.
 *
 * Två saker rättades: radens vaddering bär avståndet i smalt läge, och linjen
 * flyttade från namnets cell till **raden**, som är ett block där — en linje
 * på bara cellen slutar mitt i raden, ovanför datum och knappar som hör till
 * samma version.
 *
 * ## Varför avståndet mäts och inte vadderingen
 *
 * Vadderingen är ett av tre tal som tillsammans ger avståndet (radens, cellens
 * och linjens bredd), och en kontroll som läser ett av dem är grön den dag ett
 * annat ändras. `getBoundingClientRect` på namnets textkant mot radens är det
 * ögat ser.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const SAVED_AT = Date.parse("2026-09-20T08:48:00.000Z");

/** Listan i en ruta av en bestämd bredd — brytpunkten går vid containerns. */
async function listAt(width: string): Promise<GuideVersions> {
  const ruta = document.createElement("div");

  ruta.style.width = width;
  document.body.append(ruta);

  const element = document.createElement("guide-versions") as GuideVersions;

  element.setAttribute("editor-locale", "sv");
  element.actions = ["open", "restore"];
  ruta.append(element);
  element.versions = [
    {
      id: "v-1",
      number: 1,
      savedAt: SAVED_AT,
      current: true,
      by: { name: "Anna Andersson" },
    },
    { id: "v-2", number: 2, savedAt: SAVED_AT },
  ] as never;
  await settle();

  return element;
}

/** Från radens vänsterkant — där linjen ritas — till namnets textkant. */
const gapAt = (element: GuideVersions, index: number): number => {
  const row = [...element.shadowRoot!.querySelectorAll<HTMLElement>("tbody tr")][index]!;
  const name = row.querySelector<HTMLElement>(".name .text")!;

  return Math.round(name.getBoundingClientRect().left - row.getBoundingClientRect().left);
};

describe("den publicerade radens gröna linje", () => {
  /*
   * Mätt före rättningen: 8 px, varav linjen tar två. Kravet är 900-lägets
   * eget avstånd, och det är 10.
   *
   * Mutationen som fäller det: radens vaddering tillbaka till `8px 4px`.
   */
  test("står inte tätt inpå namnet i en telefon", async () => {
    const element = await listAt("390px");

    expect(gapAt(element, 0), "linjen läser som en understrykning av namnet").toBeGreaterThanOrEqual(
      10,
    );
  });

  /*
   * Och avståndet är **samma i båda bredderna**. Ett krav på ett tal i smalt
   * läge hade gått grönt med vilket tal som helst över tio; det som gör listan
   * hel är att raden ser likadan ut när skärmen byter form.
   */
  test("och lika långt från namnet som i bredd", async () => {
    const smal = await listAt("390px");
    const bred = await listAt("900px");

    expect(gapAt(smal, 0)).toBe(gapAt(bred, 0));
  });

  /*
   * Och **alla rader har samma vänsterluft**. Ett indrag på just den
   * publicerade hade varit samma besked en andra gång, i en svagare form — och
   * listan hade hoppat i sidled där den står.
   *
   * Mutationen som fäller det: flytta vadderingen till `tr[data-current]`.
   */
  test("och de andra raderna står i linje med den", async () => {
    const element = await listAt("390px");

    expect(gapAt(element, 1), "listan hoppar i sidled vid den publicerade").toBe(
      gapAt(element, 0),
    );
  });

  /*
   * Och linjen följer hela raden i smalt läge, inte bara namnet.
   *
   * Raden är ett block där, med datum och knappar under namnet — en linje på
   * namnets cell slutar mitt i den version den ska märka ut. Mätt som
   * **var skuggan sitter**, för det är det som avgör var den ritas.
   */
  test("och linjen märker hela raden, inte bara namnet", async () => {
    const element = await listAt("390px");
    const row = [...element.shadowRoot!.querySelectorAll<HTMLElement>("tbody tr")][0]!;
    const cell = row.querySelector<HTMLElement>("th.name")!;

    expect(getComputedStyle(row).boxShadow, "raden bär linjen").toContain("inset");
    expect(getComputedStyle(cell).boxShadow, "och cellen bär den inte också").toBe("none");
  });

  /* Och i bredd är det tvärtom: raden är en tabellrad, cellen bär kanten. */
  test("men i bredd sitter den kvar på namnets cell", async () => {
    const element = await listAt("900px");
    const cell = element.shadowRoot!.querySelector<HTMLElement>(
      "tbody tr[data-current] th.name",
    )!;

    expect(getComputedStyle(cell).boxShadow).toContain("inset");
  });
});

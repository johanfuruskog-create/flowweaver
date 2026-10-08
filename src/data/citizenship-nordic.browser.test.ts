import { afterEach, describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import "../viewer/components/guide-preview/guide-preview";

import { registerCodeList } from "../viewer/code-lists/code-list-registry";
import { navetCountryCodes } from "../viewer/code-lists/navet-country-codes";
import { citizenshipExampleGraph } from "./citizenship-example-graph";

import type { GuidePreview } from "../viewer/components/guide-preview/guide-preview";

/**
 * "Norden" ska mena Norden — sett i visaren, inte bara i motorn.
 *
 * ## Varför det här testet finns bredvid motorns
 *
 * Berättelse 061:s kriterium säger *testat i motorn och sett i visaren*, och de
 * två är olika påståenden. Motorns test matar in paren direkt. Det här går
 * vägen en människa går: söker fram Sverige, söker fram Tyskland, trycker
 * vidare — och läser vad som står. Mellan de två ligger kontrollen, svarets
 * form och `land.value`, och varje led där har gått sönder tyst förr.
 *
 * ## Vad grenen menade förut
 *
 * *Något av dina medborgarskap är nordiskt*, fast den heter Norden. Med
 * `all-of` menar den vad den heter: varenda ett. Johan 31/8, om
 * medborgarskapsexemplet: *"kan det vara alla ska vara och alla får inte
 * vara?"*
 */

registerCodeList(navetCountryCodes);

afterEach(() => document.body.replaceChildren());

const settle = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Picker = HTMLElement & { choices: Array<{ label: string; value: string }> };

async function visaren(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = structuredClone(citizenshipExampleGraph) as never;

  await settle();

  return preview;
}

/** Söker fram ett land och trycker på det, som ett finger gör. */
async function välj(preview: GuidePreview, term: string): Promise<void> {
  const field = preview.shadowRoot!.querySelector<Picker>("chip-picker[data-text-lookup]")!;
  const box = field.shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!;

  box.focus();
  box.value = term;
  box.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(400);

  field.shadowRoot!.querySelector<HTMLButtonElement>("[data-add]")!.click();
  await settle(200);
}

/** Rubriken besökaren landar på. */
async function svaraOchLäs(preview: GuidePreview, länder: string[]): Promise<string> {
  for (const term of länder) await välj(preview, term);

  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle(300);

  return preview.shadowRoot!
    .querySelector('[data-node-type="result"] h2')
    ?.textContent?.trim() ?? "";
}

describe("medborgarskapsguiden i visaren", () => {
  test("två nordiska medborgarskap: ingen ansökan behövs", async () => {
    expect(await svaraOchLäs(await visaren(), ["Sverige", "Danmark"]))
      .toBe("Ingen ansökan behövs");
  });

  test("men svenskt och tyskt leder INTE dit", async () => {
    // Berättelse 061:s kriterium, gånget hela vägen genom kontrollen.
    const rubrik = await svaraOchLäs(await visaren(), ["Sverige", "Tyskland"]);

    expect(rubrik).not.toBe("Ingen ansökan behövs");
    expect(rubrik).toBe("Ansök om uppehållstillstånd");
  });

  /*
   * Berättelse 062 i den riktiga guiden, inte i en graf skriven för testet.
   *
   * Flaggan står ingenstans i den här grafen: den sitter på Skatteverkets `XS`
   * i kodlistan och reser hela vägen genom `LookupService` och kontrollen. Det
   * är hela poängen med att pröva exemplet självt — en flagga skriven för hand
   * i ett test hade svarat på en annan fråga.
   *
   * Regelns `one-of XS` står kvar och rörs inte: fältet hindrar
   * motsägelsen från att SKRIVAS, regeln tar hand om den om den ändå står
   * någonstans. Två jobb, inte ett dubblerat.
   */
  test("statslös och ett land går inte att svara samtidigt", async () => {
    const preview = await visaren();

    await välj(preview, "Danmark");
    await välj(preview, "Statslös");

    const field = preview.shadowRoot!.querySelector<Picker>(
      "chip-picker[data-text-lookup]",
    )!;

    expect(field.choices.map((one) => one.value)).toEqual(["XS"]);
    expect(
      field.shadowRoot!.querySelector("[data-status]")?.textContent ?? "",
      "raden säger inte varför Danmark försvann",
    ).toContain("inte kombineras med andra val");
  });

  /*
   * Skyddsnätet, och det vaktar något annat än testet ovan: mutationsprovet
   * (flaggan borttagen ur kodlistan) fäller det förra och lämnar det här
   * grönt. Det är rätt — regeln ska routa ett motsägelsefullt svar dit också,
   * för ett sådant kan finnas i data även när fältet inte längre skapar det.
   */
  test("och den som är statslös landar på sin egen gren", async () => {
    expect(await svaraOchLäs(await visaren(), ["Danmark", "Statslös"]))
      .toBe("Kontakta Migrationsverket");
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "./prompt-dialog";

import type { PromptDialog } from "./prompt-dialog";

/**
 * Att det gömda fältet faktiskt är borta i valläget.
 *
 * ## Varför det här mäts i en webbläsare och inte i en enhet
 *
 * Därför att felet är osynligt för allt utom en ruta. `choose()` sätter
 * `field.hidden = true`, vilket varje kontroll som läser flaggan bekräftar — och
 * fältet stod ändå kvar på skärmen, som en tom grå ruta över valen. Orsaken är
 * `label { display: grid }` i komponentens stilmall: en `display` i en regel
 * vinner över `hidden`, som bara är `display: none` i webbläsarens egen
 * stilmall och alltså lika specifik som ingenting.
 *
 * Det är sjätte gången kodbasen betalar för samma sak (PRAXIS 36), och första
 * gången regeln är skriven på en **typselektor** i stället för en klass. Det är
 * värt att skilja på, för de andra fem hittades genom att någon läste en
 * klassregel och kom ihåg regeln. Ett ensamt `label` i en liten stilmall ser
 * inte ut som något man behöver komma ihåg något om.
 *
 * ## Varför rutan mäts och inte attributet
 *
 * `expect(field.hidden).toBe(true)` hade varit grönt hela tiden felet fanns.
 * Ett påstående om DOM är inte ett påstående om skärmen, och det är skärmen
 * någon tittade på.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mounted(): Promise<PromptDialog> {
  const dialog = document.createElement("prompt-dialog") as PromptDialog;

  document.body.append(dialog);
  await settle();

  return dialog;
}

/** Rutan ett element tar på skärmen, som `BxH`. */
const box = (element: Element | null | undefined): string => {
  const rect = element?.getBoundingClientRect();

  return rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : "finns inte";
};

const fieldOf = (dialog: PromptDialog): HTMLElement | null =>
  dialog.shadowRoot?.querySelector<HTMLElement>("[data-field]") ?? null;

describe("valläget", () => {
  test("det gömda fältet tar ingen plats alls", async () => {
    const dialog = await mounted();

    void dialog.choose({
      title: "Vilken sida?",
      choices: [
        { id: "a", label: "Första sidan" },
        { id: "b", label: "Andra sidan" },
      ],
    });
    await settle();

    const field = fieldOf(dialog);

    expect(field?.hidden, "flaggan var satt hela tiden felet fanns").toBe(true);
    expect(box(field), "en tom ruta över valen är vad man ser i stället").toBe("0x0");
  });

  /*
   * Och valen ligger där fältet stod, inte under en lucka. Mätt som avståndet
   * mellan meddelandet och första knappen: med fältet kvar på skärmen var det
   * fältets höjd plus dess marginal, alltså tiotals pixlar av ingenting.
   */
  test("och valen börjar direkt under rubriken", async () => {
    const dialog = await mounted();

    void dialog.choose({
      title: "Vilken sida?",
      choices: [{ id: "a", label: "Första sidan" }],
    });
    await settle();

    const heading = dialog.shadowRoot?.querySelector("[data-title]")?.getBoundingClientRect();
    const first = dialog.shadowRoot
      ?.querySelector("[data-choices] button")
      ?.getBoundingClientRect();

    expect(heading && first, "både rubriken och valet ska finnas").toBeTruthy();
    expect(
      Math.round((first?.top ?? 0) - (heading?.bottom ?? 0)),
      "luckan mellan rubriken och första valet är radavståndet, inte ett fält",
    ).toBeLessThan(24);
  });
});

describe("fältläget", () => {
  /*
   * Den andra halvan, och den som gör mätningen ovan läsbar: utan den säger
   * *0x0* bara att någon gömde något, inte att det syns när det ska.
   */
  test("fältet syns när det är ett fält som efterfrågas", async () => {
    const dialog = await mounted();

    void dialog.ask({ title: "Vad ska den heta?", label: "Namn", confirmLabel: "Spara" });
    await settle();

    const field = fieldOf(dialog);

    expect(field?.hidden).toBe(false);
    expect(box(field)).not.toBe("0x0");
  });

  /*
   * Och valbehållaren är borta, inte bara tom. Samma fel som etikettens och i
   * samma stilmall, hittat genom att mäta varje gömbart element i båda lägena i
   * stället för bara det som rapporterades: den var 392x0 — noll högt bara
   * därför att `replaceChildren()` råkat tömma den, plus fyra pixlars marginal.
   */
  test("och valen tar ingen plats alls, inte bara ingen höjd", async () => {
    const dialog = await mounted();

    void dialog.ask({ title: "Vad ska den heta?", label: "Namn", confirmLabel: "Spara" });
    await settle();

    expect(box(dialog.shadowRoot?.querySelector("[data-choices]"))).toBe("0x0");
  });

  /*
   * Och valläget städar efter sig. `restoreAskMode` sätter tillbaka flaggan,
   * men det som ska hålla är att rutan kommer tillbaka — samma skäl som ovan,
   * spegelvänt.
   */
  test("och kommer tillbaka på skärmen efter ett val", async () => {
    const dialog = await mounted();
    const answer = dialog.choose({
      title: "Vilken sida?",
      choices: [{ id: "a", label: "Första sidan" }],
    });

    await settle();
    dialog.shadowRoot?.querySelector<HTMLButtonElement>("[data-choices] button")?.click();

    expect(await answer).toBe("a");

    void dialog.ask({ title: "Vad ska den heta?", label: "Namn", confirmLabel: "Spara" });
    await settle();

    expect(box(fieldOf(dialog)), "nästa fråga med fält ska ha sitt fält").not.toBe("0x0");
  });
});

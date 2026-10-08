import { afterEach, describe, expect, test } from "vitest";

import "./conflict-dialog";

import type { ConflictDialog } from "./conflict-dialog";

/**
 * `<conflict-dialog>` — kriterium 4 (berättelse 129), de två delar login-smoke
 * inte når.
 *
 * `e2e/login-smoke.mjs` mäter rutan hos en riktig editor, med en riktig krock:
 * att förstahandsvalet är fyllt och tar fokus, och att en avvisad sparning ger
 * rutan. Vad den ALDRIG mäter är tangentbordet in i komponenten själv — ingen
 * av dess checks trycker Escape mot den här rutan (den enda `Escape` i den
 * filen gäller sökfältet). Ett Escape som råkade göra något annat än *Avbryt*
 * hade skrivit eller kastat någons arbete utan en knapptryckning, och sviten
 * hade förblivit grön. Det är den luckan testen här täpper — direkt mot
 * komponenten, `showModal` kräver en riktig `<dialog>` (jsdom saknar den, se
 * `confirmation-dialog-reentry.browser.test.ts` för samma mönster).
 *
 * Sedan berättelse 131 är förstahandsvalet **Slå ihop ändringar**, och
 * *Behåll mina ändringar* finns inte längre: det var samma sak som *Min* på
 * varje rad i sammanslagningen, fast utan att se vad man skriver över.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 30) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mounted(): Promise<ConflictDialog> {
  const dialog = document.createElement("conflict-dialog") as ConflictDialog;

  document.body.append(dialog);
  await settle();

  return dialog;
}

const request = { name: "Anna Andersson", clock: "08:19", since: "08:15" };

describe("Escape", () => {
  test("är Avbryt — inget annat val, och rutan stängs", async () => {
    const dialog = await mounted();
    const answer = dialog.ask(request);

    await settle();

    const inner = dialog.shadowRoot!.querySelector("dialog")!;

    expect(inner.open, "rutan öppnades inte").toBe(true);

    // Precis det webbläsaren gör själv när någon trycker Escape på en öppen
    // <dialog>: den skickar ett "cancel"-event åt elementet.
    inner.dispatchEvent(new Event("cancel", { cancelable: true }));

    expect(await answer, "Escape gav inte Avbryt").toBe("cancel");
    expect(inner.open, "rutan stängdes inte av Escape").toBe(false);
  });
});

describe("Slå ihop ändringar — förstahandsvalet (berättelse 131)", () => {
  test("är det fyllda valet, och rubriken tar fokus", async () => {
    const dialog = await mounted();

    void dialog.ask(request);
    await settle();

    const inner = dialog.shadowRoot!;
    const merge = inner.querySelector<HTMLButtonElement>('[data-choice="merge"]')!;
    const reload = inner.querySelector<HTMLButtonElement>('[data-choice="reload"]')!;
    const cancel = inner.querySelector<HTMLButtonElement>('[data-choice="cancel"]')!;
    const title = inner.querySelector<HTMLElement>("[data-title]")!;

    expect(
      merge.classList.contains("conflict-dialog__choice--primary"),
      "Slå ihop är inte fyllt",
    ).toBe(true);
    expect(merge.textContent, "och det är det första man läser").toContain("Slå ihop ändringar");
    expect(reload.classList.contains("conflict-dialog__choice--primary"), "Ladda om är fyllt").toBe(
      false,
    );
    expect(cancel.classList.contains("conflict-dialog__choice--primary"), "Avbryt är fyllt").toBe(false);
    expect(inner.activeElement, "fokus ligger inte på rubriken").toBe(title);
  });

  /*
   * *Behåll mina ändringar* gjorde samma sak som *Min* på varje rad i
   * sammanslagningen, fast utan att se vad man skriver över. Mutationen som
   * fäller det här: lägg tillbaka knappen — då står två val bredvid varandra
   * där det ena gör mindre än det andra.
   */
  test("och Behåll mina ändringar finns inte längre", async () => {
    const dialog = await mounted();

    void dialog.ask(request);
    await settle();

    const inner = dialog.shadowRoot!;

    expect(inner.querySelector('[data-choice="keep"]')).toBeNull();
    expect([...inner.querySelectorAll("[data-choice]")].map((one) =>
      (one as HTMLElement).dataset.choice,
    )).toEqual(["merge", "reload", "cancel"]);
  });

  /* Och valet säger vad det gör: ingenting går förlorat, och kopiorna fryses. */
  test("förstahandsvalet säger att ingenting går förlorat", async () => {
    const dialog = await mounted();

    void dialog.ask(request);
    await settle();

    const note = dialog.shadowRoot!.querySelector("[data-merge-note]")!;

    expect(note.textContent).toContain("Båda kopiorna sparas i historiken");
  });
});

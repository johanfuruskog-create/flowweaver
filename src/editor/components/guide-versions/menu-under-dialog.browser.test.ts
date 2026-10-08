import { afterEach, describe, expect, test } from "vitest";

import "./guide-versions";
import "../prompt-dialog/prompt-dialog";

import type { GuideVersions } from "./guide-versions";
import type { PromptDialog } from "../prompt-dialog/prompt-dialog";

/**
 * Radens meny och den modala dialogen kan aldrig ligga över varandra.
 *
 * ## Varför det här mäts
 *
 * Astras granskning 21/9, punkt C2: en `<dialog>` som öppnas med `showModal()`
 * ligger i webbläsarens *top layer*, och en meny som monteras **utanför**
 * dialogen kan därför hamna bakom den, hur högt `z-index` den än får. Det är
 * ett fel som inte går att laga med en siffra — det måste lagas med var menyn
 * bor.
 *
 * **Mätt på de riktiga sidorna 21/9, och felet finns inte hos oss.** På
 * `examples/versions.html` och på lagringssidan bor radens meny inuti sin egen
 * rad (`rowActions.appendChild(menu)`), och sidans egen `…`-meny bor i
 * dokumentet. Ingen meny bor i en dialog, och ingen dialog innehåller en meny.
 * Det som gör ordningen ofarlig är i stället att **menyn stänger sig själv när
 * dialogen öppnas**: det finns aldrig ett läge där en öppen meny ska samsas
 * med en modal ruta.
 *
 * Det är den egenskapen som mäts här, för det är den som skyddar oss. Ingen
 * `z-index` ändrades, och ingen borde ändras: en höjning hade sett ut som en
 * lösning på ett problem vi inte har, och dolt att skyddet är ett annat.
 *
 * ## Vad testet inte vaktar
 *
 * Inte att dialogen ritas överst — det gör webbläsaren, och att mäta det vore
 * att mäta Chromium. Det vaktar vår del: att menyn är stängd, och att dialogen
 * verkligen är modal och alltså i top layer. En dialog som öppnats med `show()`
 * i stället för `showModal()` faller här, och det är precis det bytet som
 * skulle återinföra felet.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function rowWithMenu(): Promise<{ list: GuideVersions; dialog: PromptDialog }> {
  const list = document.createElement("guide-versions") as GuideVersions;
  const dialog = document.createElement("prompt-dialog") as PromptDialog;

  list.setAttribute("editor-locale", "sv");
  dialog.setAttribute("editor-locale", "sv");
  list.actions = ["rename"] as never;
  document.body.append(list, dialog);

  list.versions = [
    { id: "v-2", label: "Version 2", savedAt: 2, current: true },
    { id: "v-1", label: "Version 1", savedAt: 1 },
  ] as never;
  await settle();

  return { list, dialog };
}

/** Den öppna menyn, var den än bor i skuggträdet. */
const openMenu = (list: GuideVersions): HTMLElement | null =>
  [...list.shadowRoot!.querySelectorAll<HTMLElement>('[role="menu"]')].find(
    (menu) => menu.getBoundingClientRect().height > 0,
  ) ?? null;

describe("radmenyn och den modala dialogen", () => {
  test("menyn öppnas, och ligger i sin egen rad", async () => {
    const { list } = await rowWithMenu();

    list.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await settle();

    const menu = openMenu(list);

    expect(menu, "menyn öppnas av sin knapp").not.toBeNull();
    /*
     * Den bor i listans egen skuggrot och inte i `document.body`. Det är den
     * här raden som skulle gå sönder om någon portade ut menyn för att "få
     * den överst" — vilket är exakt det drag som orsakar felet C2 beskriver.
     */
    expect(menu!.getRootNode()).toBe(list.shadowRoot);
  });

  test("dialogen är modal, och menyn är stängd när den öppnas", async () => {
    const { list, dialog } = await rowWithMenu();

    /*
     * Värden öppnar dialogen, inte listan. Listan ber om något med
     * `version-rename-intent`; sidan som lyssnar väljer ruta. Så är
     * lagringssidan byggd, och därför kopplas det så här — annars mäter
     * provet en dialog som ingen öppnar (första körningen gjorde det).
     */
    list.addEventListener("version-rename-intent", () => {
      void dialog.ask({ title: "Byt namn", value: "Version 2" } as never);
    });

    list.shadowRoot!.querySelector<HTMLButtonElement>("button.trigger")!.click();
    await settle();
    expect(openMenu(list), "menyn är öppen innan dialogen").not.toBeNull();

    list.shadowRoot!
      .querySelector<HTMLButtonElement>('[role="menuitem"][data-action="rename"]')!
      .click();
    await settle();

    expect(openMenu(list), "menyn stängde sig när dialogen öppnades").toBeNull();

    const native = dialog.shadowRoot!.querySelector("dialog")!;

    expect(native.open, "dialogen öppnades").toBe(true);
    expect(native.matches(":modal"), "dialogen ligger i top layer").toBe(true);
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "./guide-versions";

import type { GuideVersions } from "./guide-versions";

/**
 * Which offers a host actually answers (story 124's addendum, criterion 14).
 *
 * ## The fault this is written from
 *
 * The element offers eight things a host might do with a version — open,
 * publish, save, discard, duplicate, rename, note, delete — and a host that
 * answers three of them used to show all eight. On the storage page that meant
 * *Byt namn*, *Anteckning*, *Duplicera* and *Ta bort* sitting in the menu and
 * doing nothing at all: the page never listened, and the contract behind it has
 * no route for any of them.
 *
 * Hiding them with CSS would have left the buttons there for a keyboard and a
 * screen reader — a menu that lies rather than a menu that is short. So the
 * host says which ones it answers, the way it already says which language and
 * which order to use.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function list(actions?: string[]): Promise<GuideVersions> {
  const element = document.createElement("guide-versions") as GuideVersions;

  element.setAttribute("editor-locale", "sv");
  document.body.append(element);

  if (actions) {
    element.actions = actions as never;
  }

  element.versions = [
    { id: "v-2", label: "Version 2", savedAt: 2, current: true },
    { id: "v-1", label: "Version 1", savedAt: 1 },
  ] as never;
  await settle();

  return element;
}

/*
 * Mätt: `open` bär inget `data-action` — raden själv öppnar, och det är
 * radens egen text man trycker på. Det som räknas här är alltså knapparna,
 * och `open` är alltid där för att raden alltid är där.
 */
const offered = (element: GuideVersions): string[] => [
  ...new Set(
    [...element.shadowRoot!.querySelectorAll<HTMLElement>("[data-action]")].map(
      (one) => one.dataset.action ?? "",
    ),
  ),
];

describe("vilka åtgärder listan erbjuder", () => {
  test("utan besked erbjuder den allt den kan, som förut", async () => {
    expect(offered(await list()), "menyn och radens egna knappar").toEqual(
      expect.arrayContaining(["activate", "duplicate", "rename", "note", "delete"]),
    );
  });

  test("en värd som bara öppnar får bara Öppna — och ingen meny alls", async () => {
    const element = await list(["open"]);

    expect(offered(element), "inga knappar kvar att trycka fel på").toEqual([]);
    expect(
      element.shadowRoot!.querySelector("[data-menu-trigger]"),
      "ingen Åtgärder-knapp när menyn skulle vara tom",
    ).toBeNull();
  });

  test("en värd som öppnar och publicerar får båda, fortfarande utan meny", async () => {
    const element = await list(["open", "activate"]);

    expect(offered(element)).toEqual(["activate"]);
    expect(element.shadowRoot!.querySelector("[data-menu-trigger]")).toBeNull();
  });

  /*
   * *Återställ* — Apples ord för att ta en gammal version som den man arbetar
   * i, valt 17/9 framför "Öppna som arbetskopia". Den hör till raden och inte
   * till menyn: att välja en version att fortsätta från är hela skälet till att
   * någon öppnar en historik.
   */
  test("en värd som återställer får Återställ på varje rad utom den publicerade", async () => {
    const element = await list(["open", "restore"]);
    const buttons = [...element.shadowRoot!.querySelectorAll<HTMLElement>('[data-action="restore"]')];

    expect(offered(element), "inget annat än Återställ").toEqual(["restore"]);
    /*
     * Med versionens namn i knappen: *Återställ* ensamt läser som *ångra allt*,
     * och den som hör knappen uppläst har inte raden bredvid sig (berättelse
     * 124, kriterium 22).
     *
     * Litet v: *version* är ett vanligt substantiv mitt i en fras, medan radens
     * *Version 1* är radens namn. Ett namn som inte är av den formen — en fil,
     * en produkt — rörs inte.
     */
    expect(buttons.map((one) => one.textContent), "ordet plus versionen det gäller").toEqual([
      "Återställ version 1",
    ]);
    expect(
      element.shadowRoot!.querySelector('tr[data-current] [data-action="restore"]'),
      "inte på den publicerade: arbetskopian kommer redan därifrån",
    ).toBeNull();
    expect(element.shadowRoot!.querySelector("[data-menu-trigger]"), "ingen meny").toBeNull();
  });

  /*
   * Och den som inte bett om den får den inte. Versionsarbetsbänken säger
   * ingenting om åtgärder och lyssnar inte på `version-restore-intent`; en
   * knapp där hade varit en knapp som inte gör något.
   */
  test("en värd som inte nämner Återställ får ingen", async () => {
    expect(offered(await list()), "ingen Återställ utan att någon bett om den").not.toContain(
      "restore",
    );
  });

  /*
   * Och ett namn som inte är "ord + tal" skrivs som värden skrev det. Ett
   * filnamn eller en produkt är ett namn, och namn böjer sig inte efter var i
   * en mening de råkar stå.
   */
  test("ett namn som inte är ord plus tal skrivs som det är", async () => {
    const element = document.createElement("guide-versions") as GuideVersions;

    element.setAttribute("editor-locale", "sv");
    document.body.append(element);
    element.actions = ["open", "restore"] as never;
    element.versions = [
      { id: "v-2", label: "Version 2", savedAt: 2, current: true },
      { id: "v-1", label: "guide-0728.json", savedAt: 1 },
    ] as never;
    await settle();

    expect(
      element.shadowRoot!.querySelector<HTMLElement>('[data-action="restore"]')?.textContent,
    ).toBe("Återställ guide-0728.json");
  });

  test("Återställ ber värden och gör ingenting själv", async () => {
    const element = await list(["open", "restore"]);
    const asked: string[] = [];

    element.addEventListener("version-restore-intent", (event) => {
      asked.push((event as CustomEvent<{ version: { id: string } }>).detail.version.id);
    });
    element.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="restore"]')!.click();

    expect(asked, "versionen följer med, och listan ändrar ingenting").toEqual(["v-1"]);
    expect(element.versions.map((one) => one.id), "listan är som den var").toEqual(["v-2", "v-1"]);
  });

  /*
   * En kvarvarande menypost ska fortfarande få sin meny — annars vore
   * begränsningen ett sätt att göra en knapp onåbar i stället för att låta bli
   * att visa den.
   */
  test("en enda menypost får sin meny", async () => {
    const element = await list(["open", "delete"]);

    expect(element.shadowRoot!.querySelector("[data-menu-trigger]")).not.toBeNull();
    expect(offered(element)).toContain("delete");
    expect(offered(element)).not.toContain("rename");
  });
});

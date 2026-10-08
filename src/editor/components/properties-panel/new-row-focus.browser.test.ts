import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Man hamnar i raden man just lade till.
 *
 * ## Varför det här är samma fel som Johan hittade i reglerna
 *
 * Panelen ritas om när en rad läggs till, och rullar då tillbaka till toppen.
 * Man tror man står i det nya och skriver i något annat — eller ingenting, för
 * markören ligger på `<body>` och nästa tabb börjar om från sidans topp. Johan
 * träffade på det när han skapade en tredje regel på en iPad.
 *
 * ## Vad mätningen sa, och vad den räddade
 *
 * Jag hade gissat att fem ställen tappade fokus. En mätning av var markören
 * FAKTISKT hamnade sa två: svarsalternativen hade redan sin lösning
 * (`optionIdToFocus`), och den heuristik jag rangordnat efter — leta `focus()`
 * nära ett `render()` — hittade den inte, för den ligger i en egen metod.
 *
 * Alltså: uträkningens rader och tjänsteanropets svarsmappningar.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 220) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function panelFor(node: Record<string, unknown>): Promise<ShadowRoot> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "n",
    nodes: [{ id: "n", position: { x: 0, y: 0 }, ...node }],
    connections: [],
  } as never;

  await settle();
  await settle();

  editor.shadowRoot!
    .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
    .selectNodeById("n");
  await settle();
  await settle();

  return editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;
}

describe("en tillagd uträkningsrad", () => {
  test("tar emot markören", async () => {
    const panel = await panelFor({
      type: "calculation",
      data: { title: { sv: "Räkna" }, assignments: [] },
    });

    panel.querySelector<HTMLButtonElement>('[data-action="add-assignment"]')!.click();
    await settle(300);

    const rader = [...panel.querySelectorAll("[data-assignment-id]")];
    const aktiv = panel.activeElement as HTMLElement | null;

    expect(rader.length, "en rad finns").toBe(1);
    expect(aktiv, "markören ligger inte på ingenting").not.toBeNull();
    expect(rader[0]!.contains(aktiv), "markören i den nya raden").toBe(true);
  });
});

describe("en tillagd svarsmappning", () => {
  test("tar emot markören", async () => {
    const panel = await panelFor({
      type: "service-call",
      data: { title: { sv: "Anrop" }, responseMappings: [] },
    });

    panel.querySelector<HTMLButtonElement>('[data-action="add-mapping"]')!.click();
    await settle(300);

    const rader = [...panel.querySelectorAll("[data-mapping-id]")];
    const aktiv = panel.activeElement as HTMLElement | null;

    expect(rader.length, "en rad finns").toBe(1);
    expect(aktiv, "markören ligger inte på ingenting").not.toBeNull();
    expect(rader[0]!.contains(aktiv), "markören i den nya raden").toBe(true);
  });
});

describe("ett tillagt svarsalternativ", () => {
  /*
   * Etapp 2 (UPPDRAG-2026-09-28-SVARSALTERNATIV, 28/9): "Fungerade redan"
   * ovan höll fram till i dag. Svarsalternativens rad renderas nu STÄNGD
   * som viloläge (`hidden` på `data-option-body`) — den befintliga
   * `optionIdToFocus`/`focusPendingOption` gör fortfarande `input.focus()`
   * på den nya radens etikettfält, men en `display: none`-förfader kan inte
   * ta emot fokus, så anropet blir tyst utan verkan. Mätt: `activeElement`
   * är `undefined`, inte fältet.
   *
   * Specen kräver att det nya alternativet ÖPPNAS (inte bara får fokus) —
   * "Nytt alternativ läggs sist, öppnas, fokus i textfältet" — och det
   * öppna tillståndet är Teds gränssnittslogik, inte min struktur (se
   * hookkontraktet i `renderAnswerOptionRow`, properties-panel.ts). Skippat
   * här i stället för lämnat rött, så bygget inte blockeras av ett prov
   * bara hans egen kod kan göra grönt igen.
   *
   * Grönt igen 28/9 (Ted): "Lägg till" öppnar det nya alternativet
   * (`openOptionIds` i panelen, ritat av `applyOptionOpenState` före
   * `focusPendingOption`), så fältet går att fokusera.
   */
  test("tar fortfarande emot markören", async () => {
    const panel = await panelFor({
      type: "question",
      data: {
        title: { sv: "Fråga" },
        variableName: "v",
        options: [{ id: "a", label: { sv: "Ja" }, value: "y" }],
      },
    });

    panel.querySelector<HTMLButtonElement>('[data-action="add-option"]')!.click();
    await settle(300);

    expect(
      (panel.activeElement as HTMLElement | null)?.dataset?.optionProperty,
    ).toBe("label");
  });
});

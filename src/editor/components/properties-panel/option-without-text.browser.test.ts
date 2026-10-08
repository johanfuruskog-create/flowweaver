import { userEvent } from "@vitest/browser/context";
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { optionPortsGraph } from "../../../data/option-ports-graph";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Varningen för ett svarsalternativ utan text (Johan 28/9), i editorn.
 *
 * Kontrollen själv prövas i `guide-health-service.test.ts`. Här prövas det
 * kontrollen inte kan veta: att alternativet som just lagts till, och har
 * markören i sitt textfält, inte varnas för — varken en blinkning i samma
 * ögonblick som raden kommer eller medan första bokstaven skrivs. Först när
 * redaktören lämnar fältet tomt står varningen där, och pekar på frågan.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/*
 * Markören sätts i fältet, den klickas inte dit. Det prövade är skrivandet
 * och att lämna fältet, inte klicket — och i WebKit vägrar Playwright klicket
 * ("guide-editor intercepts pointer events") fast det landar: mätt 28/9 når
 * WebKits egen träffprövning INPUT genom båda skuggträden, men panelens
 * `shadowRoot.elementsFromPoint` listar den yttre editorn först.
 */
const putCursorIn = (field: HTMLInputElement) => field.focus();
const WARNING = "svarsalternativ 4 saknar text";

async function mount(): Promise<{ editor: GuideEditor; panel: ShadowRoot; health: HTMLElement; seen: string[] }> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1300px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(optionPortsGraph) as never;
  await settle();
  await settle();
  (editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById(id: string): void }).selectNodeById("ports-question");
  await settle();
  await settle();

  const health = editor.shadowRoot!.querySelector<HTMLElement>("[data-health-body]")!;
  const seen: string[] = [];

  // Varje omritning av listan, så en varning som blinkar förbi syns också.
  new MutationObserver(() => seen.push(health.textContent ?? "")).observe(health, { childList: true, subtree: true });

  return { editor, panel: editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!, health, seen };
}

describe("ett nytt svarsalternativ utan text", () => {
  test("varnas inte för medan markören står i det — inte heller en blinkning", async () => {
    const { panel, health, seen } = await mount();

    await userEvent.click(panel.querySelector<HTMLElement>('[data-action="add-option"]')!);
    await settle(800);

    const focused = panel.activeElement as HTMLInputElement | null;
    expect(focused?.dataset.optionProperty).toBe("label");
    expect(seen.length, "hälsolistan ritades om efter tillägget").toBeGreaterThan(0);
    expect(seen.filter((text) => text.includes(WARNING))).toEqual([]);
    expect(health.textContent).not.toContain(WARNING);
  });

  test("varnas för när fältet lämnas tomt, och varningen leder till frågan", async () => {
    const { panel, health } = await mount();

    await userEvent.click(panel.querySelector<HTMLElement>('[data-action="add-option"]')!);
    // Förbi editorns 400 ms bokföring: då har kontrollen redan tigit en gång,
    // och det är att lämna fältet som ska få den att säga till.
    await settle(800);
    await userEvent.tab();
    await settle(300);

    expect(health.textContent).toContain(WARNING);
    const link = [...health.querySelectorAll<HTMLElement>("[data-health-node]")].find((button) =>
      button.textContent!.includes(WARNING),
    );
    expect(link?.dataset.healthNode).toBe("ports-question");
  });

  test("varningen går när texten skrivs", async () => {
    const { panel, health } = await mount();

    await userEvent.click(panel.querySelector<HTMLElement>('[data-action="add-option"]')!);
    await settle();
    await userEvent.tab();
    await settle(300);
    expect(health.textContent).toContain(WARNING);

    const label = [...panel.querySelectorAll<HTMLInputElement>('[data-option-property="label"]')].at(-1)!;
    putCursorIn(label);
    await userEvent.keyboard("Fax");
    await userEvent.tab();
    await settle(800);

    expect(health.textContent).not.toContain(WARNING);
  });

  /*
   * Listvyn räknar själv och märker frågans rad med ⚠ — den ska döma som
   * hälsoraden. Ett befintligt, kopplat alternativ töms: ett nytt har ingen
   * koppling än, och frågan bär då redan felet "leder inte vidare" (mätt 28/9).
   */
  test("listvyn märker inte frågan medan texten töms, men gör det när fältet lämnas", async () => {
    const { editor, panel } = await mount();

    editor.shadowRoot!.dispatchEvent(new CustomEvent("list-view-request"));
    await settle();
    const outline = editor.shadowRoot!.querySelector("guide-outline")!.shadowRoot!;
    const mark = () => outline.querySelector('[data-node-id="ports-question"] [data-outline-health]');
    const everMarked: boolean[] = [];

    expect(mark(), "frisk innan").toBeNull();
    const phone = panel.querySelector<HTMLElement>('.properties-panel__option[data-option-id="ports-phone"]')!;
    await userEvent.click(phone.querySelector<HTMLElement>('[data-action="toggle-option"]')!);
    const label = panel.querySelector<HTMLInputElement>('[data-option-id="ports-phone"] [data-option-property="label"]')!;

    new MutationObserver(() => everMarked.push(mark() !== null)).observe(outline, { childList: true, subtree: true });
    putCursorIn(label);
    await userEvent.keyboard("{Control>}a{/Control}{Backspace}");
    await settle(800);
    expect(label.value).toBe("");
    expect(everMarked.length, "listan ritades om efter ändringen").toBeGreaterThan(0);
    expect(everMarked.filter(Boolean)).toEqual([]);

    await userEvent.tab();
    await settle(300);
    expect(mark()?.getAttribute("aria-label")).toContain("svarsalternativ 2 saknar text");
  });
});

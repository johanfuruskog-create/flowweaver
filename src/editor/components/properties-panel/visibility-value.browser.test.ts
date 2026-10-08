import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Att ändra ett sidfälts synlighet ska stanna kvar.
 *
 * ## Felet, mätt
 *
 * Panelen satte sitt värde och sände ändringen; canvasen ritade om sina noder
 * och sände därmed ett **urvalsbyte**; editorn fyllde panelen ur sin ännu inte
 * uppdaterade graf — och skrev tillbaka det gamla värdet. I spåret:
 *
 *     MUT "one-of"     ← panelen sätter sitt värde
 *     SET "equals"     ← updatePropertiesPanel ← handleSelectionChanged
 *
 * Ordningen var alltså: rita om, och sedan berätta. Grafändringen måste komma
 * först, annars fylls panelen ur en graf som inte känner till ändringen.
 *
 * Det här gällde varje ändring i synligheten, inte bara jämförelsen — fältet
 * har varit obrukbart och såg bara ut att "hoppa tillbaka".
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 180) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fältetsPanel(): Promise<{ editor: GuideEditor; panel: ShadowRoot }> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "s",
    nodes: [
      { id: "s", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
      {
        id: "q",
        type: "question",
        position: { x: 0, y: 0 },
        parentPageId: "s",
        order: 1,
        layout: { columnSpan: 12 },
        data: {
          title: { sv: "Har du bil?" },
          variableName: "bil",
          options: [
            { id: "ja", label: { sv: "Ja" }, value: "yes" },
            { id: "nej", label: { sv: "Nej" }, value: "no" },
          ],
        },
      },
      {
        id: "f",
        type: "text-question",
        position: { x: 0, y: 0 },
        parentPageId: "s",
        order: 2,
        layout: { columnSpan: 12 },
        // `visibility` bor på NODEN, inte i dess data.
        visibility: {
          match: "all",
          conditions: [{ id: "v", variableName: "bil", operator: "equals", value: "yes" }],
        },
        data: { title: { sv: "Registreringsnummer" }, variableName: "regnr" },
      },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  editor.shadowRoot!
    .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
    .selectNodeById("f");
  await settle();
  await settle();

  return { editor, panel: editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot! };
}

const villkoret = (editor: GuideEditor) =>
  (editor.getData().nodes.find((one) => one.id === "f") as {
    visibility?: { conditions: Array<{ operator: string; value: string }> };
  }).visibility?.conditions[0];

describe("en ändrad synlighet", () => {
  test("stannar kvar i grafen", async () => {
    const { editor, panel } = await fältetsPanel();
    const operator = panel.querySelector<HTMLSelectElement>(
      "[data-visibility-property='operator']",
    )!;

    operator.value = "one-of";
    operator.dispatchEvent(new Event("change", { bubbles: true }));
    await settle(300);

    expect(villkoret(editor)?.operator).toBe("one-of");
  });

  test("och i rutan man ändrade i", async () => {
    /*
     * Den här är den som säger något: grafen fick ändringen hela tiden, men
     * panelen skrevs över med det gamla värdet — så det SÅG ut som att den
     * hoppade tillbaka, och nästa ändring utgick från fel läge.
     */
    const { panel } = await fältetsPanel();
    const operator = panel.querySelector<HTMLSelectElement>(
      "[data-visibility-property='operator']",
    )!;

    operator.value = "one-of";
    operator.dispatchEvent(new Event("change", { bubbles: true }));
    await settle(300);

    expect(
      panel.querySelector<HTMLSelectElement>("[data-visibility-property='operator']")!.value,
    ).toBe("one-of");
  });

  test("och ett ändrat värde likaså", async () => {
    const { editor, panel } = await fältetsPanel();
    const värde = panel.querySelector<HTMLInputElement>("[data-visibility-property='value']")!;

    värde.value = "no";
    värde.dispatchEvent(new Event("change", { bubbles: true }));
    await settle(300);

    expect(villkoret(editor)?.value).toBe("no");
    expect(
      panel.querySelector<HTMLInputElement>("[data-visibility-property='value']")!.value,
    ).toBe("no");
  });

  test("och värdet väljs ur en lista, inte skrivs", async () => {
    /*
     * Samma krav som i regeln: finns värdena ska redaktören inte behöva kunna
     * dem. "Visa fältet bara när…" är samma fråga i den andra redigeraren, och
     * hade ett rent textfält där man skrev `yes` för hand.
     */
    const { panel } = await fältetsPanel();
    const picker = panel.querySelector("[data-visibility-value-picker]")?.shadowRoot;

    expect(picker, "väljaren finns").not.toBeUndefined();
    expect(
      picker!.querySelector(".chip-picker__chip-label")?.textContent?.trim(),
      "etiketten, inte det lagrade värdet",
    ).toBe("Ja");
    expect(panel.querySelector('input[type="text"][data-visibility-property="value"]')).toBeNull();
  });

  test("ett val skrivs till villkoret", async () => {
    const { editor, panel } = await fältetsPanel();
    const picker = () => panel.querySelector("[data-visibility-value-picker]")!.shadowRoot!;

    picker().querySelector<HTMLButtonElement>("[data-remove]")!.click();
    await settle(300);
    picker().querySelector<HTMLElement>(".chip-picker__box")!
      .dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    await settle(150);
    picker().querySelector<HTMLButtonElement>('[data-add][data-value="no"]')!.click();
    await settle(300);

    expect(villkoret(editor)?.value).toBe("no");
  });

  test("'är lika med' tar ett värde, 'är någon av' flera", async () => {
    const { panel } = await fältetsPanel();
    const picker = () => panel.querySelector("[data-visibility-value-picker]")!;

    expect(picker().hasAttribute("single")).toBe(true);

    const operator = panel.querySelector<HTMLSelectElement>(
      "[data-visibility-property='operator']",
    )!;

    operator.value = "one-of";
    operator.dispatchEvent(new Event("change", { bubbles: true }));
    await settle(300);

    expect(picker().hasAttribute("single")).toBe(false);
  });
});

/**
 * Samma namn som varje annan väljare — uppdrag 2026-08-31.
 *
 * Fältet valdes på rubriken ensam ("Har du bil?"), medan variabellistan bakom
 * `{{var}}` visade båda halvorna. Johan mötte de två formerna bredvid varandra
 * i regelvillkoret och kunde inte se vilket namn villkoret skulle testa.
 */
describe("synlighetens variabelväljare", () => {
  test("visar rubriken och det tekniska namnet", async () => {
    const { panel } = await fältetsPanel();
    /*
     * Since story 143 the name stands over its variable chip in the field
     * picker's row, where the select said *Fråga — {{variabel}}* on one line.
     */
    const valbara = [...panel.querySelector("field-picker[data-visibility-property='variableName']")!
      .shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]')]
      .map((row) => [row.querySelector(".option__label")!.textContent, row.querySelector(".chip")!.textContent]);

    expect(valbara).toEqual([["Har du bil?", "bil"], ["I dag", "idag"]]);
  });
});

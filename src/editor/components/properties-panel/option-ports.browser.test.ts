import { userEvent } from "@vitest/browser/context";
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { optionPortsGraph } from "../../../data/option-ports-graph";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Uppdrag 28/9 svarsalternativen, etapp 2 — det viktigaste provet:
 * kopplingarna följer sitt alternativ.
 *
 * Varje alternativ har en egen utgångsport, namngiven efter alternativets
 * id. Flytt med knapparna, omordning med dragning och borttagning av ett
 * annat alternativ får därför aldrig ändra vart ett alternativ leder: *E-post*
 * leder till *Vi mejlar* vart i listan det än står.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(): Promise<{ editor: GuideEditor; panel: ShadowRoot }> {
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

  return { editor, panel: editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot! };
}

/** Where each option leads, by its label — the thing a redaktör would check. */
function routes(graph: GraphData): Record<string, string> {
  const question = graph.nodes.find((node) => node.id === "ports-question")!;
  const options = question.data.options as Array<{ id: string; label: string }>;

  return Object.fromEntries(
    graph.connections
      .filter((connection) => connection.from.nodeId === "ports-question")
      .map((connection) => [
        options.find((option) => option.id === connection.from.portId)?.label ?? `okänd port ${connection.from.portId}`,
        connection.to.nodeId,
      ]),
  );
}

const order = (graph: GraphData): string[] =>
  (graph.nodes.find((node) => node.id === "ports-question")!.data.options as Array<{ label: string }>).map((option) => option.label);

const BEFORE = { "E-post": "ports-to-mail", Telefon: "ports-to-phone", Brev: "ports-to-letter" };

describe("kopplingarna följer sitt alternativ", () => {
  test("flytt med knappen ändrar ordningen, inte vart något leder", async () => {
    const { editor, panel } = await mount();

    await userEvent.click(panel.querySelector<HTMLElement>('[data-action="move-option-down"][data-option-id="ports-mail"]')!);
    await settle();

    const graph = editor.getData() as GraphData;

    expect(order(graph)).toEqual(["Telefon", "E-post", "Brev"]);
    expect(routes(graph)).toEqual(BEFORE);
    expect(graph.connections).toHaveLength(3);
  });

  test("omordning med dragning ändrar ordningen, inte vart något leder", async () => {
    const { editor, panel } = await mount();

    panel.host.dispatchEvent(
      new CustomEvent("question-option-reorder", {
        detail: { nodeId: "ports-question", optionId: "ports-letter", targetIndex: 0 },
        bubbles: true,
        composed: true,
      }),
    );
    await settle();

    const graph = editor.getData() as GraphData;

    expect(order(graph)).toEqual(["Brev", "E-post", "Telefon"]);
    expect(routes(graph)).toEqual(BEFORE);
  });

  test("ett borttaget alternativ tar bara sin egen koppling med sig", async () => {
    const { editor, panel } = await mount();

    // "Ta bort alternativ" står i den utfällda raden (etapp 2:s form).
    await userEvent.click(panel.querySelector<HTMLElement>('[data-action="toggle-option"][data-option-id="ports-phone"]')!);
    await userEvent.click(panel.querySelector<HTMLElement>('[data-action="remove-option"][data-option-id="ports-phone"]')!);
    await settle();

    const graph = editor.getData() as GraphData;

    expect(order(graph)).toEqual(["E-post", "Brev"]);
    expect(routes(graph)).toEqual({ "E-post": "ports-to-mail", Brev: "ports-to-letter" });
  });

  test("ett nytt alternativ läggs sist, utan platshållare i modellen, och de andras kopplingar står kvar", async () => {
    const { editor, panel } = await mount();

    await userEvent.click(panel.querySelector<HTMLElement>('[data-action="add-option"]')!);
    await settle();

    const graph = editor.getData() as GraphData;
    const options = graph.nodes.find((node) => node.id === "ports-question")!.data.options as Array<{ label: string; value: string }>;

    expect(options.map((option) => option.label)).toEqual(["E-post", "Telefon", "Brev", ""]);
    expect(new Set(options.map((option) => option.value)).size, "två alternativ med samma värde").toBe(4);
    expect(routes(graph)).toEqual(BEFORE);
  });

  /*
   * Lagringsvärdet härleds inte ur etiketten (mätt 28/9): en ny etikett får
   * aldrig tyst byta värdet ett befintligt alternativ har — det står i regler
   * och i svar som redan skickats in.
   */
  test("en ändrad etikett rör inte lagringsvärdet", async () => {
    const { editor, panel } = await mount();
    const label = panel.querySelector<HTMLInputElement>('[data-option-property="label"][data-option-id="ports-mail"]')!;

    label.value = "Mejl, helst på vardagar";
    label.dispatchEvent(new Event("input", { bubbles: true }));
    label.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();

    const options = (editor.getData() as GraphData).nodes.find((node) => node.id === "ports-question")!.data.options as Array<{ id: string; label: string; value: string }>;
    const mail = options.find((option) => option.id === "ports-mail")!;

    expect(mail.label).toBe("Mejl, helst på vardagar");
    expect(mail.value).toBe("epost");
    expect(routes(editor.getData() as GraphData)["Mejl, helst på vardagar"]).toBe("ports-to-mail");
  });

  /*
   * Rader av olika höjd i samma drag (Fias risk, 28/9): en öppen rad och två
   * stängda. `reorder-gesture.ts` mäter höjderna en gång före draget och
   * räknar sedan; den delade filen rörs inte så länge det här håller. Den
   * stängda höjden efterliknas här tills Fias markup finns.
   */
  test("en öppen rad som dras förbi två stängda landar sist, och kopplingarna följer", async () => {
    const { editor, panel } = await mount();
    const row = (id: string) => panel.querySelector<HTMLElement>(`.properties-panel__option[data-option-id="${id}"]`)!;

    for (const id of ["ports-phone", "ports-letter"]) {
      row(id).style.height = "60px";
      row(id).style.overflow = "hidden";
    }
    await settle(50);

    const letter = row("ports-letter").getBoundingClientRect();
    const handle = panel.querySelector<HTMLElement>('[data-action="drag-option"][data-option-id="ports-mail"]')!;
    const grip = handle.getBoundingClientRect();
    const x = grip.left + grip.width / 2;
    const y0 = grip.top + grip.height / 2;
    const y1 = y0 + (letter.bottom + 20 - row("ports-mail").getBoundingClientRect().top);
    const at = (y: number) => ({ bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1 });

    handle.dispatchEvent(new PointerEvent("pointerdown", at(y0)));
    for (let step = 1; step <= 25; step += 1) {
      window.dispatchEvent(new PointerEvent("pointermove", at(y0 + ((y1 - y0) * step) / 25)));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    window.dispatchEvent(new PointerEvent("pointerup", at(y1)));
    await settle(300);

    const graph = editor.getData() as GraphData;

    expect(order(graph)).toEqual(["Telefon", "Brev", "E-post"]);
    expect(routes(graph)).toEqual(BEFORE);
  });
});


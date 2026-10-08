import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { exampleGraph } from "../../../data/example-graph";

import type { GuideEditor } from "./guide-editor";

/**
 * Story 074 — hoppa och lägg till med Ctrl+K. Paletten är en lista att
 * leta i och canvasen en yta att panorera över; sök-först är snabbast
 * för den som vet vad den vill och tangentbordsvägen för den som inte
 * pekar (n8n-läran, skissad och godkänd 2/9).
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mounted(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  document.body.append(editor);
  editor.graph = structuredClone(exampleGraph);
  await settle();
  return editor;
}

const oppna = async (editor: GuideEditor) => {
  editor.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
  );
  await settle(150);
  return editor.shadowRoot!.querySelector<HTMLElement>("[data-quick-open]");
};

describe("Ctrl+K", () => {
  test("öppnar, filtrerar på titlar och hoppar till noden", async () => {
    const editor = await mounted();

    const overlay = await oppna(editor);
    expect(overlay, "overlayn finns").toBeTruthy();
    expect(overlay!.hidden).toBe(false);

    const falt = overlay!.querySelector<HTMLInputElement>("input")!;
    falt.value = "ålder";
    falt.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(150);

    const traff = [...overlay!.querySelectorAll<HTMLElement>("[data-quick-hit]")]
      .find((rad) => /Hur gammal|ålder/i.test(rad.textContent ?? ""));
    expect(traff, "träffen finns").toBeTruthy();

    falt.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await settle(250);

    expect(
      editor.shadowRoot!.querySelector<HTMLElement>("[data-quick-open]")?.hidden,
      "stängd efter valet",
    ).toBe(true);
    const valdId = (editor as unknown as { selectedNodeId: string | null }).selectedNodeId
      ?? editor.shadowRoot!.querySelector("properties-panel")?.shadowRoot?.textContent;
    expect(String(valdId)).toContain("age");
  });

  test("lägger till en nod via typnamnet", async () => {
    const editor = await mounted();
    const fore = editor.getData().nodes.length;

    const overlay = await oppna(editor);
    const falt = overlay!.querySelector<HTMLInputElement>("input")!;

    falt.value = "sifferfråga";
    falt.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(150);
    falt.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await settle(300);

    expect(editor.getData().nodes.length).toBe(fore + 1);
  });

  test("Esc stänger utan spår", async () => {
    const editor = await mounted();
    const fore = editor.getData();

    const overlay = await oppna(editor);
    overlay!.querySelector<HTMLInputElement>("input")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle(150);

    expect(
      editor.shadowRoot!.querySelector<HTMLElement>("[data-quick-open]")?.hidden,
    ).toBe(true);
    expect(editor.getData()).toEqual(fore);
  });
});

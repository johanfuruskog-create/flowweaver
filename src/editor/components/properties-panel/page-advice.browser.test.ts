import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Formulärspårets steg 2 (Läget 1/9): rådet "en sida per ämne, tre–sex
 * fält" står i sidnodens panel — receptet synligt där sidan byggs, inte
 * i en handbok ingen läser. Ett råd, inte en varning: det ska inte se ut
 * som att något är fel med en nyskapad sida.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function mount(): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  document.body.append(editor);
  editor.graph = {
    version: 8,
    startNodeId: "sidan",
    nodes: [
      { id: "sidan", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
      { id: "falt", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "sidan", order: 1, data: { title: { sv: "Namn" }, variableName: "namn" } },
    ],
    connections: [],
  } as never;
  return editor;
}

describe("sidrådet i panelen", () => {
  test("sidnoden bär rådet om ämne och fältantal — som råd, inte varning", async () => {
    const editor = mount();
    await settle();

    const canvas = editor.shadowRoot!.querySelector<
      HTMLElement & { selectNodeById(id: string): void }
    >("node-editor")!;
    canvas.selectNodeById("sidan");
    await settle();

    const panel = editor.shadowRoot!.querySelector("properties-panel");
    const advice = panel?.shadowRoot?.querySelector<HTMLElement>(
      "[data-page-advice]",
    );

    expect(advice, "rådet finns").toBeTruthy();
    expect(advice!.textContent).toContain("En sida per ämne");
    expect(advice!.textContent).toContain("tre till sex fält");
    // Rådet är inget statusmeddelande och ingen varningsruta.
    expect(advice!.getAttribute("role")).toBeNull();
    expect(advice!.textContent).not.toContain("⚠");

    // Ett fält som inte är en sida får inget sidråd.
    canvas.selectNodeById("falt");
    await settle();
    expect(
      panel?.shadowRoot?.querySelector("[data-page-advice]"),
      "fältet är rådlöst",
    ).toBeNull();
  });
});

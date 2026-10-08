import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";

/**
 * Story 081: the palette sits in the Tab order. It never did — the F6
 * regions carry tabindex="-1", and on a shadow host that takes the whole
 * shadow tree out of sequential navigation (measured 3/9: Tab went
 * toolbar → import field → language → canvas). The region now sits on a
 * wrapper, and the import field is out of the order.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("paletten i Tab-ordningen", () => {
  test("palettens värd har inget tabindex, och regionen bär palettens namn", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;

    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 1400px; height: 800px;";
    document.body.append(editor);
    editor.graph = { version: 8, startNodeId: null, nodes: [], connections: [] } as never;
    await settle();

    const root = editor.shadowRoot!;
    const palette = root.querySelector("node-palette")!;

    expect(palette.hasAttribute("tabindex"), "skuggvärden utan tabindex").toBe(false);
    const region = root.querySelector<HTMLElement>('[data-region="palette"]')!;
    expect(region.contains(palette), "regionen omsluter paletten").toBe(true);
    expect(region.getAttribute("tabindex")).toBe("-1");
    expect(region.getAttribute("aria-label")).toBe("Lägg till nod");

    const fileInput = root.querySelector("editor-toolbar")!.shadowRoot!.querySelector("[data-import-file]")!;
    expect(fileInput.getAttribute("tabindex"), "importfältet är inget tabbstopp").toBe("-1");
  });
});

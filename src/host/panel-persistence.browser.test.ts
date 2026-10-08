import { afterEach, describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import "../editor/components/guide-editor/guide-editor";

import { initPanelMemory } from "./panel-persistence";

import type { GuideEditor } from "../editor/components/guide-editor/guide-editor";

/*
 * Story 141, point 5, and story 145, criteria 10–11: the width and whether the
 * panel is open are the host's to remember. The library sends
 * `panel-width-changed` and `panel-open-changed` and stores nothing (K6e); this
 * is the example site keeping them, next to the theme and the colour scale. The
 * editor's own half — the handle, the bounds, the events — is
 * `guide-editor-panel-width` and `guide-editor-side-panel`.
 */

const KEY = "flowweaver:panel-width";
const OPEN_KEY = "flowweaver:panel-open";
const PALETTE_KEY = "flowweaver:palette-open";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.removeItem(KEY);
  localStorage.removeItem(OPEN_KEY);
  localStorage.removeItem(PALETTE_KEY);
});

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function editor(attrs: Record<string, string> = {}): Promise<GuideEditor> {
  const element = document.createElement("guide-editor") as GuideEditor;

  element.setAttribute("mode", "administrator");
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
  element.style.cssText = "display: block; width: 1600px; height: 700px;";
  document.body.append(element);
  await settle();

  return element;
}

function press(element: GuideEditor, key: string): void {
  element.shadowRoot!.querySelector("[data-panel-resize]")!.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, composed: true, cancelable: true })
  );
}

describe("sajten minns panelens bredd", () => {
  test("en ändring sparas, och nästa sida startar med den", async () => {
    initPanelMemory();
    const first = await editor({ "panel-open": "" });
    const ceiling = first.shadowRoot!.querySelector("[data-panel-resize]")!.getAttribute("aria-valuemax");

    press(first, "End");
    expect(localStorage.getItem(KEY)).toBe(ceiling);

    document.body.replaceChildren();
    const next = await editor({ "panel-open": "" });

    initPanelMemory();
    await settle(50);

    expect(next.getAttribute("panel-width")).toBe(ceiling);
    expect(next.panelWidth).toBe(Number(ceiling));
  });

  test("återställningen tar bort minnet", async () => {
    localStorage.setItem(KEY, "700");
    const element = await editor();

    initPanelMemory();
    press(element, "Enter");

    expect(localStorage.getItem(KEY)).toBeNull();
    expect(element.hasAttribute("panel-width")).toBe(false);
  });

  test("en sida som själv anger bredden behåller den", async () => {
    localStorage.setItem(KEY, "700");
    const element = await editor({ "panel-width": "500" });

    initPanelMemory();

    expect(element.getAttribute("panel-width")).toBe("500");
  });
});

describe("sajten minns om panelen är öppen (berättelse 145)", () => {
  test("utan minne börjar panelen infälld", async () => {
    const element = await editor();

    initPanelMemory();
    expect(element.panelOpen).toBe(false);
    expect(element.shadowRoot!.querySelector<HTMLElement>(".guide-editor__sidebar")!.hidden).toBe(true);
  });

  test("öppnad sparas, och nästa sida startar öppen; infälld sparas också", async () => {
    initPanelMemory();
    const first = await editor();

    first.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="panel-open"]')!.click();
    expect(localStorage.getItem(OPEN_KEY)).toBe("true");

    document.body.replaceChildren();
    const next = document.createElement("guide-editor") as GuideEditor;

    next.setAttribute("mode", "administrator");
    document.body.append(next);
    initPanelMemory();
    await settle(50);

    expect(next.panelOpen).toBe(true);
    expect(next.shadowRoot!.querySelector<HTMLElement>(".guide-editor__sidebar")!.hidden).toBe(false);

    next.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="panel-close"]')!.click();
    expect(localStorage.getItem(OPEN_KEY)).toBe("false");
  });
});

describe("sajten minns om nodpaletten är öppen (berättelse 146)", () => {
  test("öppnad sparas, och nästa sida startar med paletten öppen", async () => {
    initPanelMemory();
    const first = await editor();
    const palette = first.shadowRoot!.querySelector("node-palette")!;

    palette.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="palette-open"]')!.click();
    expect(localStorage.getItem(PALETTE_KEY)).toBe("true");

    document.body.replaceChildren();
    const next = document.createElement("guide-editor") as GuideEditor;

    next.setAttribute("mode", "administrator");
    document.body.append(next);
    initPanelMemory();
    await settle(50);

    expect(next.paletteOpen).toBe(true);
  });
});


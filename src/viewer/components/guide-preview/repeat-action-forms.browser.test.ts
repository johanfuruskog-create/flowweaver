import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * B3 on the visitor's page (Astra 30/9, GENOMGANG V3 and V9): *Ta bort pass N*
 * is the destructive form and *Lägg till pass* the local add, so neither can
 * be mistaken for *Nästa* or for each other. Measured before (Fia): both a
 * neutral outline in `--fw-border-control`, text `--fw-text-strong`, 45 px —
 * the same form as *Föregående*.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph = {
  startNodeId: "pass",
  settings: { sourceLocale: "sv" },
  nodes: [
    {
      id: "pass", type: "page", position: { x: 0, y: 0 },
      data: { title: { sv: "Passen" }, repeats: true, repeatWord: { sv: "pass" }, repeatVariable: "pass", repeatMin: 1 },
    },
    {
      id: "namn", type: "text-question", parentPageId: "pass", order: 1, position: { x: 0, y: 0 },
      data: { title: { sv: "Namn" }, variableName: "namn" },
    },
    { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
  ],
  connections: [{ id: "c", from: { nodeId: "pass", portId: "continue" }, to: { nodeId: "r", portId: "input" } }],
} as unknown as GraphData;

async function twoPasses(): Promise<ShadowRoot> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = "display: block; width: 900px;";
  document.body.append(preview);
  preview.graph = structuredClone(graph);
  await settle();
  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="repeat-add"]')!.click();
  await settle();
  return preview.shadowRoot!;
}

function token(beside: Element, name: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  beside.parentElement!.append(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

describe("passens knappar i visaren", () => {
  test("Ta bort pass N: text och soptunna i --fw-danger-text, ingen fyllning, ingen ram, 44 px", async () => {
    const root = await twoPasses();
    const buttons = [...root.querySelectorAll<HTMLElement>('[data-action="repeat-remove"]')];

    expect(buttons.length).toBe(2);
    for (const button of buttons) {
      const style = getComputedStyle(button);
      expect(button.querySelector("svg"), "soptunnan").not.toBeNull();
      expect(button.querySelector("svg")!.getBoundingClientRect().width).toBeCloseTo(18, 0);
      expect(style.color).toBe(token(button, "--fw-danger-text"));
      expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
      expect(style.borderLeftStyle).toBe("none");
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    expect(buttons[1].textContent!.trim()).toBe("Ta bort pass 2");
  });

  test("Lägg till pass: primär kontur med plus-ikonen, radie 8, 44 px, innehållets bredd", async () => {
    const root = await twoPasses();
    const button = root.querySelector<HTMLElement>('[data-action="repeat-add"]')!;
    const style = getComputedStyle(button);
    const probe = document.createElement("span");
    probe.style.cssText = "border: 1px solid var(--fw-primary); color: var(--fw-primary-strong); border-radius: var(--fw-radius-button);";
    button.parentElement!.append(probe);
    const want = getComputedStyle(probe);

    expect(button.querySelector("svg"), "plus som ikon").not.toBeNull();
    expect(button.querySelector("svg")!.getBoundingClientRect().width).toBeCloseTo(18, 0);
    expect(style.borderTopColor).toBe(want.borderTopColor);
    expect(style.color).toBe(want.color);
    expect(style.borderTopLeftRadius).toBe(want.borderTopLeftRadius);
    expect(style.backgroundColor, "aldrig fylld").toBe("rgba(0, 0, 0, 0)");
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    // Content width in the viewer, never the card's.
    const card = button.closest<HTMLElement>(".guide-preview__card")!;
    expect(button.getBoundingClientRect().width).toBeLessThan(card.getBoundingClientRect().width / 2);
    expect(button.textContent!.trim()).toBe("Lägg till pass");
  });
});

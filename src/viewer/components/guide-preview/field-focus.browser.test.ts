import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Text and search fields show focus with the one ring (Astra 1/10, bilaga 10
 * punkt 7; genomgången 30/9, V5): the text field drew the browser's own
 * 1 px, the search box the mixin 1 px out — two looks for one state. And an
 * error and focus can be seen together: the field's red edge stays while the
 * ring stands outside it.
 *
 * Measured as the mixin's two bearers (`_focus.scss`): a 3 px solid outline
 * at a 2 px offset, and the wash as a box-shadow 5 px out.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph = {
  startNodeId: "p",
  nodes: [
    { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
    { id: "name", type: "text-question", parentPageId: "p", order: 0, position: { x: 0, y: 0 }, data: { title: { sv: "Namn" }, variableName: "namn", required: true } },
    {
      id: "policy", type: "autocomplete-question", parentPageId: "p", order: 1, position: { x: 0, y: 0 },
      data: { title: { sv: "Försäkring" }, variableName: "forsakring", source: "mock", minChars: 1, mockItems: [{ value: "NF-1", label: { sv: "NF-1 Hem" } }] },
    },
  ],
  connections: [],
};

async function mount(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = "display:block;width:640px;";
  document.body.append(preview);
  preview.graph = graph as unknown as GraphData;
  await settle();
  return preview;
}

/** Keyboard first, then focus: `:focus-visible` follows how the last move was made. */
async function keyboardFocus(element: HTMLElement): Promise<void> {
  await userEvent.keyboard("{Shift}");
  element.focus();
  await settle(60);
}

const ring = (element: Element) => {
  const style = getComputedStyle(element);
  return { outline: `${style.outlineWidth} ${style.outlineStyle} +${style.outlineOffset}`, wash: style.boxShadow.includes("5px") };
};

describe("fokus i text- och sökfält", () => {
  test("textfältet och sökfältet bär samma ring", async () => {
    const preview = await mount();
    const root = preview.shadowRoot!;
    const text = root.querySelector<HTMLInputElement>("#page-field-name")!;
    const picker = root.querySelector<HTMLElement>("chip-picker")!;
    const search = picker.shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!;
    const box = picker.shadowRoot!.querySelector<HTMLElement>(".chip-picker__box")!;

    await keyboardFocus(text);
    expect(ring(text)).toEqual({ outline: "3px solid +2px", wash: true });

    await keyboardFocus(search);
    expect(ring(box)).toEqual({ outline: "3px solid +2px", wash: true });
  });

  test("fel och fokus syns samtidigt", async () => {
    const preview = await mount();
    const root = preview.shadowRoot!;
    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    const text = root.querySelector<HTMLInputElement>("#page-field-name")!;

    await keyboardFocus(text);
    const style = getComputedStyle(text);

    expect(text.getAttribute("aria-invalid")).toBe("true");
    expect(style.borderTopColor, "felets kant står kvar").toBe("rgb(217, 45, 32)");
    expect(ring(text)).toEqual({ outline: "3px solid +2px", wash: true });
  });
});

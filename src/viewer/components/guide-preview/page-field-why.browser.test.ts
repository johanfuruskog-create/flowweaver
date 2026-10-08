import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * "Varför frågar vi det här?" on a page — the form, where the hesitation
 * before handing over a personal number actually happens (story 051 drew it
 * for the standalone step only; found missing on *Låna* 6/9).
 *
 * ## Why the field's wrapper had to change
 *
 * The text and consent fields wrapped their control in a `<label>`, and a
 * `<details>` cannot live there: flow content in phrasing content, and —
 * the shape note's lesson — everything inside a label leaks into the field's
 * accessible name. So the field is a cell (`div`) with `<label for>` inside,
 * the pattern the file field already used, and the disclosure is its sibling.
 * That is measured here as the accessible name: the label's text, nothing
 * more — not the why, not the error.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 120));

function guide(why: Record<string, string> | undefined): GraphData {
  return {
    startNodeId: "p",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
      {
        id: "pnr",
        type: "text-question",
        parentPageId: "p",
        order: 0,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Personnummer" }, variableName: "pnr", required: true, why },
      },
      {
        id: "ok",
        type: "consent-question",
        parentPageId: "p",
        order: 1,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Jag godkänner villkoren" }, variableName: "ok", why },
      },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "x", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as unknown as GraphData;
}

async function mount(why?: Record<string, string>): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = guide(why);
  await settle();
  await settle();

  return preview;
}

const cell = (preview: GuidePreview, id: string): HTMLElement =>
  preview.shadowRoot!.querySelector<HTMLElement>(`[data-page-field-id="${id}"]`)!;

/** The name a screen reader gets: the `for`-label's text, or the wrapping label's. */
function accessibleName(control: HTMLElement): string {
  const root = control.getRootNode() as ShadowRoot;
  const byFor = control.id ? root.querySelector(`label[for="${CSS.escape(control.id)}"]`) : null;
  const label = byFor ?? control.closest("label");
  return (label?.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("why, on a page", () => {
  test("stands under the text field and under the consent, as a closed disclosure", async () => {
    const preview = await mount({ sv: "Vi hämtar din adress från folkbokföringen." });

    for (const id of ["pnr", "ok"]) {
      const why = cell(preview, id).querySelector<HTMLDetailsElement>("details.guide-preview__why");
      expect(why, `${id}: ingen utfällare`).toBeTruthy();
      expect(why!.open).toBe(false);
      expect(why!.querySelector("summary")?.textContent?.trim()).toBe("Varför frågar vi det här?");
      expect(why!.textContent).toContain("folkbokföringen");
      expect(why!.closest("label"), `${id}: utfällaren ligger i etiketten`).toBeNull();
    }
  });

  test("is not drawn when the editor wrote nothing", async () => {
    const preview = await mount(undefined);

    expect(preview.shadowRoot!.querySelector("details.guide-preview__why")).toBeNull();
  });

  test("never leaks into the field's name — the label says the label, nothing else", async () => {
    const preview = await mount({ sv: "Vi hämtar din adress från folkbokföringen." });
    const input = cell(preview, "pnr").querySelector<HTMLInputElement>("input")!;
    const box = cell(preview, "ok").querySelector<HTMLInputElement>('input[type="checkbox"]')!;

    expect(accessibleName(input)).toBe("Personnummer (obligatoriskt)");
    expect(accessibleName(box)).toBe("Jag godkänner villkoren");
    // Clicking the label still reaches the control — the pairing holds.
    box.checked = false;
    (preview.shadowRoot!.querySelector<HTMLLabelElement>('label[for="page-field-ok"]') ?? box.closest("label"))!.click();
    expect(box.checked).toBe(true);
  });
});

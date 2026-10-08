import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";

/**
 * A formatted answer takes its shape while it is typed, and one shape when stored.
 *
 * ## The two faults behind this
 *
 * `isPersonnummer` throws away every separator before checking, so
 * `19560328-1949`, `560328-1949` and `1956 03 28 1949` all pass — and whatever
 * was typed was what the host received. Two residents with the same personnummer
 * left two different strings in `getAnswers()`.
 *
 * And the shape was never shown. Johan asked for it in as many words: so you can
 * see that you typed it right. `19560328-1949` can be checked against the card in
 * your hand; `195603281949` cannot.
 *
 * ## What is worth testing hardest
 *
 * The caret, and backspace over a separator. Both are where masks fail, both are
 * invisible in a screenshot, and neither is caught by asserting on the value
 * alone — a field can hold exactly the right string with the caret thrown to the
 * end after every keystroke.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 90) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A guide whose first step asks for a personnummer. */
async function viewer(): Promise<{ preview: GuidePreview; field: HTMLInputElement }> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = {
    startNodeId: "p",
    nodes: [
      {
        id: "p",
        type: "text-question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Ditt personnummer" },
          variableName: "personnummer",
          format: "personnummer",
          placeholder: { sv: "ÅÅÅÅMMDD-XXXX" },
          required: true,
        },
      },
      {
        id: "r",
        type: "result",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Klart" } },
      },
    ],
    connections: [
      { id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;

  await settle();
  await settle();

  const field = preview.shadowRoot!.querySelector<HTMLInputElement>("[data-text-answer]")!;

  return { preview, field };
}

/** Types one character where the caret is, the way a keyboard does. */
function press(field: HTMLInputElement, character: string): void {
  const at = field.selectionStart ?? field.value.length;

  field.value = field.value.slice(0, at) + character + field.value.slice(at);
  field.setSelectionRange(at + 1, at + 1);
  field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
}

/** Backspace at the caret, announced first the way a browser announces it. */
function backspace(field: HTMLInputElement): void {
  const at = field.selectionStart ?? field.value.length;

  field.dispatchEvent(
    new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "deleteContentBackward" }),
  );
  field.value = field.value.slice(0, Math.max(0, at - 1)) + field.value.slice(at);
  field.setSelectionRange(Math.max(0, at - 1), Math.max(0, at - 1));
  field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
}

const type = (field: HTMLInputElement, digits: string): void => {
  [...digits].forEach((character) => press(field, character));
};

describe("medan man skriver", () => {
  test("bindestrecket dyker upp av sig självt", async () => {
    const { field } = await viewer();

    type(field, "195603281949");

    expect(field.value).toBe("19560328-1949");
  });

  test("och inte innan den åttonde siffran", async () => {
    const { field } = await viewer();

    type(field, "19560328");

    expect(field.value).toBe("19560328");
  });

  test("markören står kvar där man skriver, inte i slutet", async () => {
    /*
     * The fault this file exists for. Rewriting the value moves the caret to the
     * end, so the next keystroke lands after everything — the field fills in
     * backwards and nobody can say why.
     */
    const { field } = await viewer();

    type(field, "19560328");
    field.setSelectionRange(2, 2);
    press(field, "9");

    expect(field.value.slice(0, field.selectionStart ?? 0)).toBe("199");
  });
});

describe("radering över ett bindestreck", () => {
  test("tar siffran bakom det, inte bara strecket", async () => {
    /*
     * Backspace removes the dash, the mask puts it straight back, and the field
     * appears frozen — you press it four times and nothing happens. So the
     * deletion takes the digit the dash was standing next to, which is what was
     * meant.
     *
     * The caret has to sit **just after the dash** with digits behind it for
     * this to be the case at all. The first version of this test deleted from
     * the end, where the mask has already dropped the trailing dash — so it
     * never crossed a separator, and it passed with the fix removed.
     */
    const { field } = await viewer();

    type(field, "195603281949");
    expect(field.value).toBe("19560328-1949");

    // Right after the dash.
    field.setSelectionRange(9, 9);
    backspace(field);

    // The 8 went with it: 1956032 + 1949.
    expect(field.value).toBe("19560321-949");
  });

  test("och en vanlig radering i slutet tar bara sin egen siffra", async () => {
    const { field } = await viewer();

    type(field, "195603281");
    backspace(field);

    expect(field.value).toBe("19560328");
  });
});

describe("vad som lagras", () => {
  test("en form, oavsett hur den skrevs", async () => {
    const { preview, field } = await viewer();

    type(field, "560328-1949");
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    // Twelve digits, century settled, nothing else in it.
    expect(preview.getAnswers().personnummer).toBe("195603281949");
  });

  test("och det gäller även när den skrevs i full form", async () => {
    const { preview, field } = await viewer();

    type(field, "195603281949");
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    expect(preview.getAnswers().personnummer).toBe("195603281949");
  });
});

describe("vad som visas när värdet inte skrevs", () => {
  /*
   * The shape appeared only on input events, so a value that arrived without
   * typing showed as the stored twelve digits: coming back with Föregående, or
   * a host handing one over through `given` (story 085). Measured 4/9 in the
   * 085 pictures: `199001012389` in a field that a typist would have seen as
   * `19900101-2389`. One field, one look, however the value got there.
   */
  test("tillbaka till steget: samma form som när det skrevs", async () => {
    const { preview, field } = await viewer();

    type(field, "560328-1949");
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="previous"]')!.click();
    await settle();

    const revisited = preview.shadowRoot!.querySelector<HTMLInputElement>("[data-text-answer]")!;

    expect(revisited.value).toBe("19560328-1949");
    // Shown with the century and the dash, stored without them: still twelve digits.
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    expect(preview.getAnswers().personnummer).toBe("195603281949");
  });
});

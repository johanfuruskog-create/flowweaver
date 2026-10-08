import { describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";

/**
 * A paste holding two genuine values is refused, with a reason.
 *
 * People paste the line, not the value — and some lines carry two: "Sökande
 * 19560328-1949, medsökande 19800223-7538" out of a case system. Both windows
 * validate, so the field cannot know which one was meant. It used to shape the
 * first twelve digits anyway: the *wrong person's* number, committed silently,
 * green. `findInPasted` answered null for "two candidates" and for "nothing
 * found" alike, and the caller read both as "mask as usual".
 *
 * Refusing is the only answer that is not a guess — and the refusal must say
 * why, because a field that silently eats a paste looks broken. The message
 * sends somebody back to the source, which is the one place where the words
 * around the numbers still say whose is whose. A chooser was considered and
 * rejected: two bare digit runs stripped of their labels is exactly what an eye
 * cannot tell apart, and it would put somebody else's number on screen.
 */

const settle = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mounted(): Promise<{ preview: GuidePreview; input: HTMLInputElement }> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  document.body.replaceChildren(preview);
  preview.graph = {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "text-question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Fråga" }, variableName: "pnr", format: "personnummer" },
      },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  return {
    preview,
    input: preview.shadowRoot!.querySelector<HTMLInputElement>("[data-text-answer]")!,
  };
}

function paste(input: HTMLInputElement, text: string): void {
  input.focus();
  input.dispatchEvent(
    new InputEvent("beforeinput", {
      inputType: "insertFromPaste",
      data: text,
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe("en inklistring med två äkta värden", () => {
  test("lämnar fältet orört och säger varför", async () => {
    const { input } = await mounted();

    paste(input, "Sökande 19560328-1949, medsökande 19800223-7538");
    await settle();

    expect(input.value, "gissade på ett av numren").toBe("");
    expect(input.dataset.canonical ?? "").toBe("");

    const note = (input.getRootNode() as ShadowRoot).querySelector<HTMLElement>("[data-shape-note]");

    expect(note?.textContent).toBe(
      "Det inklistrade innehåller flera möjliga värden. Klistra in ett i taget.",
    );
  });

  test("medan ett ensamt värde i en rad fortfarande hittas", async () => {
    const { input } = await mounted();

    paste(input, "Personnummer: 19800223-7538");
    await settle();

    expect(input.value).toBe("19800223-7538");
  });

  test("och nästa tangenttryck tar bort beskedet", async () => {
    const { input } = await mounted();

    paste(input, "19560328-1949 och 19800223-7538");
    await settle();

    input.dispatchEvent(
      new InputEvent("beforeinput", {
        inputType: "insertText",
        data: "1",
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    const note = (input.getRootNode() as ShadowRoot).querySelector<HTMLElement>("[data-shape-note]");

    expect(note?.textContent).toBe("");
  });
});

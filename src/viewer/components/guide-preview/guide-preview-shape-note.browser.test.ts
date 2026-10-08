import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * What a shaped field says when it has quietly thrown away what somebody typed.
 *
 * ## The silence this ends
 *
 * A field with a settled shape keeps only what the shape allows, so letters in a
 * personnummer field never appear. Measured keystroke by keystroke:
 *
 *     "A" → ""   "n" → ""   "n" → ""   "a" → ""   " " → ""   "1" → "1"
 *
 * Better than the reordering it replaced — that turned "Anna Andersson" into
 * "naneso" — but still a refusal without words. Somebody who tabbed into the
 * wrong field sees nothing happen at all, and a screen reader hears nothing,
 * because the value never changed.
 *
 * ## Why after a pause
 *
 * Johan's condition, and a right one: telling somebody off at the first
 * mistyped character is a correction in the middle of a word. After they stop,
 * it answers the question they are actually asking — "why is nothing
 * happening?" — rather than interrupting them to answer one they had not asked.
 *
 * `aria-live="polite"` is the only way out of the silence for somebody who
 * cannot see the field, and it is the reason this is a spoken line rather than
 * a styling change.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** Comfortably past the pause the field waits out. */
const AFTER_PAUSE = 900;

function graph(format: string): GraphData {
  return {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "text-question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Fält" }, variableName: "v", format },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as GraphData;
}

async function field(format = "personnummer"): Promise<{
  preview: GuidePreview;
  input: HTMLInputElement;
  note: () => string;
}> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = graph(format);

  await settle();
  await settle();

  const input = preview.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;

  return {
    preview,
    input,
    note: () =>
      (
        preview.shadowRoot!.querySelector("[data-shape-note]")?.textContent ?? ""
      ).trim(),
  };
}

describe("när formen kastar det man skrev", () => {
  test("säger den ingenting medan man skriver", async () => {
    /*
     * The whole of Johan's condition. A single mistyped character in the middle
     * of a number must not produce a correction — it produces nothing, and the
     * next keystroke carries on.
     */
    const { input, note } = await field();

    await userEvent.click(input);
    await userEvent.type(input, "1");
    await userEvent.type(input, "a");

    /*
     * Read here, in the moment right after the refused character — not once the
     * typing is over. The first version checked at the end, and by then the next
     * keystroke had cleared the line again: it passed just as happily with the
     * pause removed, which is a test of nothing.
     */
    expect(note(), "sa ifrån mitt i skrivandet").toBe("");

    await userEvent.type(input, "9");

    expect(input.value, "tecknen kom inte fram").toBe("19");
  });

  test("men säger ifrån när man slutat", async () => {
    const { input, note } = await field();

    await userEvent.click(input);
    await userEvent.type(input, "Anna");
    await settle(AFTER_PAUSE);

    expect(note()).toBe("Här skriver du siffror.");
  });

  test("och tystnar när man skriver något som duger", async () => {
    const { input, note } = await field();

    await userEvent.click(input);
    await userEvent.type(input, "Anna");
    await settle(AFTER_PAUSE);
    expect(note(), "sa aldrig ifrån").not.toBe("");

    await userEvent.type(input, "1");

    expect(note(), "raden blev kvar").toBe("");
  });
});

describe("raden", () => {
  test("är hörbar för den som inte ser fältet", async () => {
    // The point of the whole thing: a value that never changed announces
    // nothing, so the refusal has to speak for itself.
    const { preview } = await field();
    const note = preview.shadowRoot!.querySelector("[data-shape-note]");

    expect(note?.getAttribute("aria-live")).toBe("polite");
  });

  test("och tar ingen plats när den är tom", async () => {
    const { preview } = await field();
    const note = preview.shadowRoot!.querySelector("[data-shape-note]");

    expect(getComputedStyle(note!).display).toBe("none");
  });

  /*
   * A `<p>` inside a `<label>` breaks the label's content model, and worse:
   * the note's text leaks into the field's accessible name, so a screen
   * reader announced the refusal as part of what the field *is*. The note
   * stands beside the label now and is bound the intended way, as a
   * description.
   */
  test("står bredvid etiketten och beskriver fältet, inte döper det", async () => {
    const { preview, input } = await field();
    const note = preview.shadowRoot!.querySelector<HTMLElement>("[data-shape-note]");

    expect(note?.closest("label"), "noten läcker in i fältets namn").toBeNull();

    const described = (input.getAttribute("aria-describedby") ?? "").split(/\s+/);

    expect(note?.id, "noten saknar id att peka på").toBeTruthy();
    expect(described).toContain(note!.id);
  });
});

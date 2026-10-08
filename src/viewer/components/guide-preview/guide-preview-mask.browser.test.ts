import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The written shape, and the undo history it used to destroy.
 *
 * ## What was measured
 *
 * Masking by assigning `value` kills the browser's undo history. Typing twelve
 * digits and pressing Ctrl+Z left `19800223-7` and then **froze** — every
 * further press did nothing — where the same field without a mask emptied in
 * one press. The history was gone, not merely split.
 *
 * Three things that did not help, each measured rather than assumed: a debounce,
 * applying the shape on blur instead, and calling `execCommand` from the `input`
 * handler. All three gave exactly the result above, because they all assign
 * `value` in the end. The moment matters not at all; the *method* is everything.
 *
 * What works is doing the edit before the browser does: cancel it in
 * `beforeinput` and put the whole shaped value in through `execCommand`, which
 * writes into the undo history the way typing does. Two presses then empty the
 * field.
 *
 * ## Why the outcome is checked and not the return value
 *
 * `execCommand` answers `true` even when it did nothing — measured against an
 * input that was not focused, where it reported success and changed nothing. So
 * the field is read afterwards, and assignment is the fallback. The day the API
 * is finally removed, the shape survives and only undo goes back to being
 * broken — and the last test here is what will say so.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function graph(): GraphData {
  return {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "text-question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Ditt personnummer" },
          variableName: "pnr",
          format: "personnummer",
        },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as GraphData;
}

async function field(): Promise<{ preview: GuidePreview; input: HTMLInputElement }> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = graph();

  await settle();
  await settle();

  return {
    preview,
    input: preview.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!,
  };
}

describe("formen medan man skriver", () => {
  test("sätts in på rätt plats", async () => {
    const { input } = await field();

    await userEvent.click(input);
    await userEvent.type(input, "198002237538");

    expect(input.value).toBe("19800223-7538");
  });

  test("och caret hamnar efter det man skrev, inte i slutet av fältet", async () => {
    /*
     * The fault a mask makes when it rewrites the value: the caret jumps to the
     * end and the next keystroke lands in the wrong place. Typed here into the
     * middle on purpose.
     */
    const { input } = await field();

    await userEvent.click(input);
    await userEvent.type(input, "198002237538");
    input.setSelectionRange(2, 2);
    await userEvent.type(input, "0");

    expect(input.selectionStart, `caret hamnade på ${input.selectionStart}`).toBe(3);
  });
});

describe("radering", () => {
  test("backsteg över bindestrecket tar siffran bakom det", async () => {
    /*
     * Otherwise the mask puts the separator straight back and the field looks
     * frozen — the press did something and nothing changed.
     */
    const { input } = await field();

    await userEvent.click(input);
    await userEvent.type(input, "198002237");
    expect(input.value, "formen kom aldrig").toBe("19800223-7");

    /*
     * One press, with the caret immediately after the separator. Two presses
     * hide the fault: whichever way it behaves, the second one lands on a digit
     * and the field ends up the same — which is how the first version of this
     * test passed with the rule deliberately removed.
     */
    input.setSelectionRange(9, 9);
    await userEvent.keyboard("{Backspace}");

    expect(
      input.value,
      "fältet ser fruset ut: masken satte tillbaka bindestrecket",
    ).not.toBe("19800223-7");
    expect(input.value).toBe("19800227");
  });

  test("och att markera allt och skriva över fungerar", async () => {
    const { input } = await field();

    await userEvent.click(input);
    await userEvent.type(input, "198002237538");
    input.setSelectionRange(0, input.value.length);
    await userEvent.type(input, "196001011234");

    expect(input.value).toBe("19600101-1234");
  });
});

describe("ångra", () => {
  test("tömmer fältet, i stället för att frysa halvvägs", async () => {
    /*
     * The measurement this whole rewrite exists for. With the old masking this
     * stopped at "19800223-7" and never moved again, however many times it was
     * pressed — the history had been thrown away rather than split.
     *
     * The day `execCommand` stops writing to that history, this is the test that
     * falls, in CI, on a browser upgrade — before anybody meets it.
     */
    const { input } = await field();

    await userEvent.click(input);
    await userEvent.type(input, "198002237538");
    expect(input.value, "formen kom aldrig").toBe("19800223-7538");

    for (let press = 0; press < 6 && input.value !== ""; press += 1) {
      await userEvent.keyboard("{Control>}z{/Control}");
      await settle(30);
    }

    expect(input.value, "ångra tömde aldrig fältet").toBe("");
  });
});

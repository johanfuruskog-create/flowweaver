import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * An amount is grouped while it is typed, and stored without the grouping.
 *
 * ## Why the field is text
 *
 * Johan, from the tablet: *"nummerfälten måste vara textfält för att kunna
 * maskas"* — and that is the whole of it. `2 100 000` is not a valid number, so
 * a `type="number"` field reports its value as the empty string the moment a
 * separator appears; and a number input has no `selectionStart`, so there is
 * nowhere to put a caret back. Neither is a styling problem, and no amount of
 * masking code gets around either.
 *
 * What is given up is the spinner and the browser's own min/max block. The
 * spinner is no loss on a salary, and the bounds were already ours: the engine
 * checks them, and `numberFieldError` shows them — the browser's block never
 * stopped anybody continuing.
 *
 * ## The two ends
 *
 * Johan's rule: *the variables hold unformatted digits, the way there holds
 * formatted ones.* So both are asserted, in the same test, from the same typing
 * — what is on the glass, and what the host is handed. Asserting only the first
 * would let a space reach a later calculation, where it becomes `NaN` in
 * silence.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Non-breaking space — what Swedish groups with, and what `Intl` hands out. */
const NBSP = " ";

function graph(): GraphData {
  return {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "number-question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Månadslön" }, variableName: "lon", unit: { sv: "kr" } },
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
    input: preview.shadowRoot!.querySelector<HTMLInputElement>("[data-number-answer]")!,
  };
}

describe("the amount field", () => {
  test("is text, because a number input cannot hold a grouped amount", async () => {
    const { input } = await field();

    expect(input.type).toBe("text");
    expect(input.inputMode).toBe("decimal");
  });

  test("groups as the digits arrive", async () => {
    const { input } = await field();

    await userEvent.click(input);
    await userEvent.fill(input, "");
    await userEvent.type(input, "35000");
    await settle();

    expect(input.value).toBe(`35${NBSP}000`);
  });

  test("and regroups when a digit lands in front of a boundary", async () => {
    /*
     * The case an offset caret gets wrong. `123 456` typed one more digit is
     * `1 234 567` — every separator moved — so the caret is put back by counting
     * significant characters, not by adding one to where it was.
     */
    const { input } = await field();

    await userEvent.click(input);
    await userEvent.type(input, "1234567");
    await settle();

    expect(input.value).toBe(`1${NBSP}234${NBSP}567`);
  });

  test("takes a decimal in whichever shape it was typed", async () => {
    // The numeric keypad gives a period; Swedish writes a comma. Swallowing the
    // key somebody actually pressed is the fault this avoids.
    const { input } = await field();

    await userEvent.click(input);
    await userEvent.type(input, "1234.5");
    await settle();

    expect(input.value).toBe(`1${NBSP}234,5`);
  });

  test("refuses letters, since only the mask decides now", async () => {
    // `type="number"` used to do this. Losing it silently would let "12abc"
    // stand in a field that promises an amount.
    const { input } = await field();

    await userEvent.click(input);
    await userEvent.type(input, "12abc3");
    await settle();

    expect(input.value).toBe("123");
  });
});

describe("what the host is handed", () => {
  test("is the digits alone", async () => {
    const { preview, input } = await field();

    await userEvent.click(input);
    await userEvent.type(input, "35000");
    await settle();

    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    await settle();

    expect(preview.getAnswers().lon).toBe("35000");
  });

  test("and a decimal comes out with a period, as it always did", async () => {
    /*
     * `Number("1234,5")` is `NaN`. The old field was `type="number"` and handed
     * over a period whatever the keyboard produced, so anything downstream that
     * does arithmetic was written against that — including the calculation nodes.
     */
    const { preview, input } = await field();

    await userEvent.click(input);
    await userEvent.type(input, "1234,5");
    await settle();

    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    await settle();

    expect(preview.getAnswers().lon).toBe("1234.5");
  });
});

describe("a value that is drawn rather than typed", () => {
  test("comes back grouped, not as bare digits", async () => {
    /*
     * The page keeps what was typed when validation sends somebody back — and it
     * keeps it canonically, as `35000`. So the way there has to format on render
     * as well as on keypress, or the field would disagree with itself depending
     * on which of the two put the value there.
     *
     * Measured through a failing page rather than through the back button: the
     * engine drops an answer when you step back, so there is nothing to redraw
     * on that route today. When the cursor replaces the pop, this is the test
     * that already covers it.
     */
    const preview = document.createElement("guide-preview") as GuidePreview;

    preview.style.cssText = "display: block; width: 600px;";
    document.body.append(preview);
    preview.graph = {
      startNodeId: "p",
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
        {
          id: "belopp",
          type: "number-question",
          parentPageId: "p",
          order: 1,
          position: { x: 0, y: 0 },
          data: { title: { sv: "Månadslön" }, variableName: "lon" },
        },
        {
          id: "namn",
          type: "text-question",
          parentPageId: "p",
          order: 2,
          position: { x: 0, y: 0 },
          data: { title: { sv: "Namn" }, variableName: "namn", required: true },
        },
      ],
      connections: [],
    } as never;

    await settle();
    await settle();

    const amount = preview.shadowRoot!.querySelector<HTMLInputElement>("input[data-group]")!;

    await userEvent.click(amount);
    await userEvent.type(amount, "35000");
    await settle();

    // Namnet lämnas tomt, så sidan avvisas och ritas om ur utkastet.
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    await settle();

    expect(
      preview.shadowRoot!.querySelector<HTMLInputElement>("input[data-group]")!.value,
    ).toBe(`35${NBSP}000`);
  });
});

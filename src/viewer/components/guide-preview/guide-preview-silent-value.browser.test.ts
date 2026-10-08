import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";

/**
 * What the field shows is what gets stored, however the value got there.
 *
 * ## What was measured first (B5)
 *
 * The comment on the input listener claimed it caught "a host setting the
 * field". Measured, no host flow does that: the frozen public surface offers
 * `getAnswers` and `setTheme` and nothing that writes an answer, and the
 * SiteVision module's `.value =` assignments are all on its own hidden bridge
 * fields, never on inputs inside the viewer's shadow root — which it cannot
 * reach anyway.
 *
 * So the claim described a caller that does not exist. What does exist is
 * narrower and real: an assignment that fires no event leaves `data-canonical`
 * holding the *previous* value, and collection trusted it. Autofill, a password
 * manager, a script-driven paste, our own `execCommand` fallback — anything
 * that writes `value` without an `input` event.
 *
 * ## Why collection recomputes instead of a setter or an observer
 *
 * Because the stored copy is the problem, not the writing of it. Recomputing at
 * the moment of collection cannot go stale, needs no interception of a native
 * property, and removes the empty-string trap with it: a canonical of `""` is
 * not nullish, so `??` never fell through to the value and a field visibly
 * holding a number was reported as unanswered.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Writes a value the way a script does: no events, no keystrokes. */
function assignSilently(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    "value",
  )!.set!;

  setter.call(input, value);
}

async function amountStep(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "number-question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Månadslön" }, variableName: "lon" },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;

  await settle();
  await settle();

  return preview;
}

const field = (preview: GuidePreview): HTMLInputElement =>
  preview.shadowRoot!.querySelector<HTMLInputElement>("[data-number-answer]")!;

const goOn = async (preview: GuidePreview): Promise<void> => {
  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle();
  await settle();
};

describe("a value written without an event", () => {
  test("is what gets stored, not the one typed before it", async () => {
    /*
     * The measured failure: type 100, have something assign 42, and the field
     * shows 42 while `data-canonical` still says 100 — so 100 is what the host
     * receives from a field nobody can see it in.
     */
    const preview = await amountStep();
    const input = field(preview);

    await userEvent.click(input);
    await userEvent.type(input, "100");
    await settle();

    assignSilently(input, "42");
    await goOn(preview);

    expect(preview.getAnswers().lon).toBe("42");
  });

  test("and an emptied field is treated as empty, not as its old contents", async () => {
    /*
     * The `??` trap: `""` is not nullish, so a stale canonical never fell
     * through — but neither did a *fresh* empty one, and the engine rejected a
     * field the resident could see was blank.
     */
    const preview = await amountStep();
    const input = field(preview);

    await userEvent.click(input);
    await userEvent.type(input, "100");
    await settle();

    assignSilently(input, "");
    await goOn(preview);

    // Refused, because the answer is empty — and refused about the *empty*
    // field, which is what the resident is looking at.
    expect(preview.getAnswers().lon).toBeUndefined();
  });
});

describe("typing, which was never broken", () => {
  test("still stores the digits without their grouping", async () => {
    const preview = await amountStep();
    const input = field(preview);

    await userEvent.click(input);
    await userEvent.type(input, "35000");
    await goOn(preview);

    expect(preview.getAnswers().lon).toBe("35000");
  });
});

describe("a value that arrives the way autofill delivers one", () => {
  test("is grouped like a typed one, not left as a run of digits", async () => {
    /*
     * C5: the non-keyboard path handled `mask` and `format` but not `group`, so
     * the same field looked different depending on how the value got there.
     * Storage was already right by then — this is the display catching up.
     */
    const preview = await amountStep();
    const input = field(preview);

    input.value = "1234567";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();

    expect(input.value).toBe("1\u00a0234\u00a0567");
    expect(input.dataset.canonical).toBe("1234567");
  });
});

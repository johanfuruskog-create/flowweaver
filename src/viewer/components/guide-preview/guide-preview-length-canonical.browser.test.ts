import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";

/**
 * Length is counted on the answer, not on the separators drawn around it.
 *
 * The engine measures the canonical value — the digits — and the field's own
 * check measured what was on screen, separators included. A `postnummer` field
 * with a minimum length of five counted `123 4` as five characters — four
 * digits dressed as five — passed its length check and reported the format
 * instead, while the engine, counting the answer, would have reported the
 * length.
 *
 * Measured rather than assumed: the review described the field as silent on
 * blur. It was not. It spoke, and said something the engine would not have
 * said, which is the same fault wearing better clothes — the resident is told
 * one thing, presses Next, and is told another.
 *
 * The review's own example — a bare `## ##` mask — does not reproduce, and that
 * is worth writing down: without a format there is nothing to strip, so both
 * counts see the same string and agree. The fault needs a format whose
 * canonical form is shorter than its display.
 *
 * Two counts of the same thing that disagree are worse than one strict count:
 * the resident is told they are done, then told they are not.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function maskedField(): Promise<{ preview: GuidePreview; input: HTMLInputElement }> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "text-question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Kod" },
          variableName: "code",
          format: "postnummer",
          minLength: 5,
        },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;

  await settle();
  await settle();

  return {
    preview,
    input: preview.shadowRoot!.querySelector<HTMLInputElement>("[data-text-answer]")!,
  };
}

const errorText = (preview: GuidePreview): string =>
  preview.shadowRoot!.querySelector("[data-text-validation]")?.textContent?.trim() ?? "";

describe("a masked field with a minimum length", () => {
  test("says too short while the separator is padding it out", async () => {
    const { preview, input } = await maskedField();

    await userEvent.click(input);
    await userEvent.type(input, "1234");
    input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    await settle();

    // On screen: "123 4" — five characters, four digits, and the answer is the
    // four. `postnummer` strips the space on the way to storage.
    expect(input.value).toBe("123 4");
    /*
     * The message the engine would give for the same value. Before this, the
     * field measured the display, found five characters, passed the length
     * check and fell through to the format one — so it said "Ange ett
     * postnummer med fem siffror." while Next would have said the length. Not
     * silence, as the review had it, but disagreement: two checks of one value
     * blaming different things.
     */
    expect(errorText(preview)).toBe("Texten måste innehålla minst 5 tecken.");
  });

  test("and is satisfied once the answer itself is long enough", async () => {
    const { preview, input } = await maskedField();

    await userEvent.click(input);
    await userEvent.type(input, "12345");
    input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    await settle();

    expect(errorText(preview)).toBe("");
  });
});

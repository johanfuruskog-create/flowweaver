import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";

/**
 * The way here quotes the unit along with the number.
 *
 * `35 000` on its own does not say per month or per year — and the unit was
 * right beside the field while somebody answered, so dropping it on the way out
 * makes the list say less than the question it is quoting.
 *
 * Taken from the node the answer came from, which is where the field read it
 * too. A second copy could drift from the first, and the drift would show up as
 * a trail that disagrees with the step above it.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Hårt mellanslag — samma tecken som grupperingen använder. */
const NBSP = " ";

async function afterAnswering(unit?: string): Promise<string> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("answer-display", "trail");
  preview.style.cssText = "display: block; width: 700px;";
  document.body.append(preview);
  preview.graph = {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "number-question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Månadslön" },
          variableName: "lon",
          ...(unit === undefined ? {} : { unit: { sv: unit } }),
        },
      },
      {
        id: "q2",
        type: "text-question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Namn" }, variableName: "namn" },
      },
    ],
    connections: [
      { id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "q2", portId: "input" } },
    ],
  } as never;

  await settle();
  await settle();

  const amount = preview.shadowRoot!.querySelector<HTMLInputElement>("[data-number-answer]")!;

  await userEvent.click(amount);
  await userEvent.type(amount, "35000");
  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle();
  await settle();

  return (
    preview.shadowRoot!.querySelector<HTMLElement>(".guide-preview__trail-answer")?.textContent ??
    ""
  );
}

describe("måttet i vägen hit", () => {
  test("står efter siffran", async () => {
    expect(await afterAnswering("kr/mån")).toBe(`35${NBSP}000${NBSP}kr/mån`);
  });

  test("med hårt mellanslag, så raden inte bryts mitt i uppgiften", async () => {
    // `2 100 000 kr/mån` brutet efter talet läses som två uppgifter.
    expect(await afterAnswering("kr/mån")).not.toContain(" kr/mån");
  });

  test("och uteblir när frågan inte har något mått", async () => {
    expect(await afterAnswering()).toBe(`35${NBSP}000`);
  });
});

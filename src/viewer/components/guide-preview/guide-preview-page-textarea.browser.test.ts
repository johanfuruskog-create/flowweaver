import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";

/**
 * A long answer on a page has room to be long, and still reaches the host.
 *
 * The service now carries `multiline` — see `page-fields-multiline.test.ts` for
 * where it was lost — and this is the other half: that the viewer draws a
 * textarea from it, and that the readers which collect a page's answers find it.
 * They select on `[data-page-variable]`, so a textarea is included by
 * construction; asserted anyway, because "by construction" is what the missing
 * `format` was too.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function page(maxLength = 600): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = {
    startNodeId: "p",
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om felet" } } },
      {
        id: "f",
        type: "text-question",
        parentPageId: "p",
        order: 1,
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Beskriv felet" },
          variableName: "beskrivning",
          presentation: "textarea",
          maxLength,
        },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;

  await settle();
  await settle();

  return preview;
}

describe("a description on a page", () => {
  test("is a textarea, not a one-line box", async () => {
    const preview = await page();

    expect(
      preview.shadowRoot!.querySelector('[data-page-variable="beskrivning"]')!.tagName,
    ).toBe("TEXTAREA");
  });

  /*
   * The same decision the standalone text area documents: no hard cap, so you
   * can overshoot and be told, instead of having your typing silently eaten at
   * the limit. This test used to pin the opposite — `box.maxLength === 600` —
   * which meant the validation's own max-length sentence could never be
   * reached from a page. Johan closed it: one behaviour, the standalone's.
   */
  test("lets an answer overshoot, and says so instead of eating it", async () => {
    const preview = await page(8);
    const box = preview.shadowRoot!.querySelector<HTMLTextAreaElement>(
      '[data-page-variable="beskrivning"]',
    )!;

    await userEvent.click(box);
    await userEvent.type(box, "0123456789");

    expect(box.value, "taket åt det som skrevs").toBe("0123456789");

    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    await settle();

    const error = preview.shadowRoot!.querySelector("#page-field-error-f");

    expect(error?.textContent).toContain("högst 8 tecken");
    expect(preview.getAnswers().beskrivning, "gick vidare ändå").toBeUndefined();
  });

  test("and what is written in it reaches the host", async () => {
    const preview = await page();
    const box = preview.shadowRoot!.querySelector<HTMLTextAreaElement>(
      '[data-page-variable="beskrivning"]',
    )!;

    await userEvent.click(box);
    await userEvent.type(box, "Hissen stannar mellan våningarna.");
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    await settle();

    expect(preview.getAnswers().beskrivning).toBe("Hissen stannar mellan våningarna.");
  });
});

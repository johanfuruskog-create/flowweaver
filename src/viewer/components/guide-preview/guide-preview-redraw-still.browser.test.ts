import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The card slides in when the step changes — not every time it is redrawn.
 *
 * ## The fault, as seen and as measured
 *
 * Johan, reviewing the children film (7/9): "panelen till höger fladdrar".
 * Measured in the film at 10 fps: the panel beside the canvas changed on
 * every frame while a name was typed on the canvas, and one frame in the
 * middle of the word was blank.
 *
 * The cause is two things that are each right on their own. The other
 * mirror's draft arrives per keystroke and redraws the whole page
 * (`showDraft`) — one page of fields, cheap. And the card has a 220 ms
 * slide-in, so that moving through a guide is felt. Together: the slide
 * replayed for every letter, from opacity zero.
 *
 * So the slide is tied to the step, not to the redraw. A redraw of the step
 * already on screen — a draft, a rejected page's errors — puts the new
 * content where the old was, without a blink.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function pageGraph(): GraphData {
  return {
    startNodeId: "sida",
    nodes: [
      { id: "sida", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
      {
        id: "namn",
        type: "text-question",
        parentPageId: "sida",
        order: 1,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Namn" }, variableName: "namn" },
      },
      { id: "klart", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "sida", portId: "continue" }, to: { nodeId: "klart", portId: "input" } },
    ],
  } as GraphData;
}

async function openPage(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = "display: block; width: 700px;";
  document.body.append(preview);
  preview.graph = pageGraph();

  await settle();
  await settle();

  return preview;
}

const slide = (preview: GuidePreview): string =>
  getComputedStyle(preview.shadowRoot!.querySelector(".guide-preview__card")!).animationName;

describe("kortet glider in", () => {
  test("när steget visas första gången", async () => {
    const preview = await openPage();

    expect(slide(preview)).toBe("guide-preview-step-in");
  });

  test("men inte när samma steg ritas om med ett utkast", async () => {
    const preview = await openPage();

    preview.showDraft({ namn: "E" });
    await settle();

    expect(slide(preview), "utkastet spelade om inglidningen").toBe("none");
    expect(
      preview.shadowRoot!.querySelector<HTMLInputElement>('[data-page-variable="namn"]')!.value,
      "utkastet ritades inte",
    ).toBe("E");
  });

  test("och igen när steget byts", async () => {
    const preview = await openPage();

    preview.showDraft({ namn: "E" });
    await settle();
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    expect(preview.getCurrentNodeId()).toBe("klart");
    expect(slide(preview)).toBe("guide-preview-step-in");
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";

/**
 * A graph the viewer cannot draw is refused out loud.
 *
 * ## What it did instead
 *
 * **Too new.** A guide stamped with a version we do not know was branded
 * accepted and drawn with today's rules. Nothing migrates a v99 graph — there
 * is nothing to migrate it *to* — so whatever a future node type would have
 * rendered simply did not appear. The resident got a page that looks badly
 * built, which is the same failure the missing migration produced, arriving
 * from the other direction.
 *
 * **Not a graph.** `element.graph = null` read `.version` off it and threw an
 * uncaught `TypeError`; a string or an array slipped further and ended in
 * "Guiden saknar startnod", which is a lie about a guide that was never there.
 *
 * The file door has refused both since it was written. This is the object door
 * — `element.graph = …`, the path the SiteVision module and every plain-JS host
 * takes — being given the same two checks.
 *
 * ## Why the assertions are about the screen
 *
 * A refusal nobody can see is the fault being fixed, not the fix. So these read
 * the rendered card rather than the component's state.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(graph: unknown): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = graph as never;

  await settle();
  await settle();

  return preview;
}

const errorText = (preview: GuidePreview): string =>
  preview.shadowRoot!.querySelector(".guide-preview__error")?.textContent?.trim() ?? "";

const futureGuide = {
  version: 99,
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "text-question",
      position: { x: 0, y: 0 },
      data: { title: { sv: "Fråga" }, variableName: "a" },
    },
  ],
  connections: [],
};

describe("a guide from a newer version", () => {
  test("says so instead of drawing what it can", async () => {
    const preview = await mount(futureGuide);

    expect(errorText(preview)).not.toBe("");
  });

  test("and names the version, so the message is actionable", async () => {
    const preview = await mount(futureGuide);

    expect(errorText(preview)).toContain("99");
  });

  test("and draws no step at all", async () => {
    /*
     * The half-drawn page is the thing being prevented. A refusal that still
     * renders the first question invites somebody to fill it in.
     */
    const preview = await mount(futureGuide);

    expect(preview.shadowRoot!.querySelector("[data-text-answer]")).toBeNull();
  });
});

describe("something that is not a guide", () => {
  test.each([
    ["null", null],
    ["a string", "min guide"],
    ["an array", []],
  ])("%s is refused without throwing", async (_name, value) => {
    const preview = await mount(value);

    expect(errorText(preview)).not.toBe("");
  });
});

describe("a guide the viewer can draw", () => {
  test("is unaffected by any of this", async () => {
    const preview = await mount({
      startNodeId: "q",
      nodes: [
        {
          id: "q",
          type: "text-question",
          position: { x: 0, y: 0 },
          data: { title: { sv: "Ditt namn" }, variableName: "namn" },
        },
      ],
      connections: [],
    });

    expect(errorText(preview)).toBe("");
    expect(preview.shadowRoot!.querySelector("[data-text-answer]")).not.toBeNull();
  });
});

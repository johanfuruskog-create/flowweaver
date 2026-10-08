import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import { pageBuilderExampleGraph } from "../../../data/page-builder-example-graph";

import type { GuidePreview } from "./guide-preview";

/**
 * Third-width fields on a page: stack by the viewer's own width, not the
 * window's.
 *
 * ## The fault, measured
 *
 * A 560px-wide *host* on a 1400px screen (Sitevision's narrow content column
 * is the ordinary case, not the exception — see the container-query comment
 * a little further down in the stylesheet): the three third-width fields on
 * the page-builder guide's first page stayed three across at 157px each,
 * instead of stacking. The rule at `guide-preview.scss` used `@media
 * (max-width: 560px)`, which measures the *window*, not the element sitting
 * in a narrow column of a wide window.
 *
 * The test below wraps the viewer in an element sized to 560px while leaving
 * the window untouched, which is exactly the case a media query gets wrong
 * and a container query gets right.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Sets up the viewer in a wrapper of the given width; the window itself is never resized. */
async function viewerInHostOfWidth(width: number): Promise<GuidePreview> {
  const wrapper = document.createElement("div");

  wrapper.style.cssText = `width: ${width}px;`;
  document.body.append(wrapper);

  const preview = document.createElement("guide-preview") as GuidePreview;

  wrapper.append(preview);
  preview.graph = pageBuilderExampleGraph;

  await settle();
  await settle();

  return preview;
}

const thirdFieldRects = (preview: GuidePreview): DOMRect[] =>
  Array.from(
    preview.shadowRoot!.querySelectorAll<HTMLElement>(".guide-preview__page-field--third"),
  ).map((field) => field.getBoundingClientRect());

describe("tredjedelsfälten på en sida", () => {
  test("staplas när visarens värd är smal, fast fönstret är brett", async () => {
    const preview = await viewerInHostOfWidth(560);
    const rects = thirdFieldRects(preview);

    expect(window.innerWidth, "fönstret är smalt — testet skiljer inget").toBeGreaterThan(600);
    expect(rects, "grafens första sida borde ha tre tredjedelsfält").toHaveLength(3);

    const xs = rects.map((rect) => Math.round(rect.x));

    expect(
      xs,
      `fälten står på x=${xs.join(", ")} — de borde dela x när de staplats`,
    ).toEqual([xs[0], xs[0], xs[0]]);
  });

  test("och står kvar tre i rad när värden själv är bred", async () => {
    const preview = await viewerInHostOfWidth(900);
    const rects = thirdFieldRects(preview);

    expect(rects).toHaveLength(3);

    const xs = rects.map((rect) => Math.round(rect.x));

    expect(new Set(xs).size, `fälten står på x=${xs.join(", ")}`).toBe(3);
  });
});

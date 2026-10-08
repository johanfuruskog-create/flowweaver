import { afterEach, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";

/**
 * Nothing in the view leaks out of its own scroll area.
 *
 * ## The fault
 *
 * The honeypot (story 050) is `position: absolute`, and the view had no
 * positioned ancestor, so its containing block was whatever the host put the
 * view in. In the editor's sidebar — a scrolling `guide-preview` inside an
 * `overflow: hidden` wrapper — the honeypot escaped the scroller and gave the
 * wrapper 284 px of scrollable overflow it was never meant to have. Anything
 * that scrolls "into view" (a focus, the rig's `scrollIntoView`) could then
 * shift the whole editor up to that much, clipping the toolbar, and a
 * re-render that shortened the panel snapped it back. Measured in film 3
 * (children.mjs, 7/9): a button moved 48 px between pointerdown and pointerup
 * and the click landed on the card behind it.
 *
 * The assertion is on the wrapper, not the honeypot: the view's scroller
 * must contain everything the view renders, whatever escapes next.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 150));

test("en tall sida i en skrollande panel lämnar inget överflöd åt behållaren utanför", async () => {
  const wrapper = document.createElement("div");
  // As the editor's `.guide-editor`: positioned, so it is what an escaped
  // absolute box measures itself against.
  wrapper.style.cssText = "position: relative; height: 200px; overflow: hidden;";
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = "display: block; height: 100%; overflow: auto;";
  wrapper.append(preview);
  document.body.append(wrapper);

  preview.graph = {
    startNodeId: "p",
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida", en: "Page" } } },
      ...[1, 2, 3, 4, 5, 6].map((n) => ({
        id: `f${n}`,
        type: "text-question",
        parentPageId: "p",
        order: n,
        position: { x: 0, y: 0 },
        data: { title: { sv: `Fält ${n}`, en: `Field ${n}` }, variableName: `f${n}` },
      })),
    ],
    connections: [],
  };
  await settle();

  // The page is taller than the panel — the panel scrolls, ...
  expect(preview.scrollHeight).toBeGreaterThan(preview.clientHeight);
  // ... and the wrapper around it has nothing to scroll.
  expect(wrapper.scrollHeight).toBe(wrapper.clientHeight);
});

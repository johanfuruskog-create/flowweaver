import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The error summary is focused, not just shown — and focus scrolls.
 *
 * ## What was measured
 *
 * `docs/UPPDRAG-2026-09-21-DESIGNGRUND.md`, del C1: WCAG 1.4.12 (text
 * spacing), 200 % text zoom and 320 CSS-px reflow, run against
 * `examples/every-field.html` with the page's own validation triggered by
 * pressing Continue with nothing filled in — the same path a visitor takes.
 *
 * A screenshot at 320 px showed the error summary's last line — the longest
 * one, since a checkbox's label wraps the most — sitting **behind** the
 * sticky "Föregående/Nästa" bar (`guide-preview.scss`,
 * `:host(:where([data-under~="400"])) .guide-preview__navigation`,
 * `position: sticky; bottom: 0`). The cause: `guide-preview.ts` line ~1606
 * calls plain `[data-error-summary].focus()` with no `preventScroll`, which
 * *does* scroll the element into view — but the browser's own scroll-into-
 * view has no idea a sticky, opaque bar is about to cover the last 70–90px
 * of the viewport it just scrolled to. Nothing is permanently lost — scrolling
 * further reveals it — but the very message a visitor was just told to read
 * opens partly hidden behind an opaque bar, on the narrow layout that ships
 * this pattern specifically to keep the button in the thumb zone.
 *
 * The fix is `scroll-margin-bottom` on `.guide-preview__error-summary`: the
 * one CSS property built for exactly this — reserving room below a
 * scroll-into-view target for a fixed/sticky element the browser cannot see
 * coming. Sized off the same tokens the sticky bar's own rule uses
 * (`--fw-control-height` for the button, `--fw-space-3` for its padding, the
 * multiplier a measured margin above the 89px the bar actually renders at
 * 200% zoom — `scratch` measurement in the session, not committed).
 */

afterEach(() => {
  document.body.replaceChildren();
});

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A page with four required fields and a description long enough that the
 * card cannot fit a narrow phone viewport — the exact condition under which
 * the sticky bar is already pinned to the bottom of the screen the moment
 * the error summary renders, per `guide-preview-narrow.browser.test.ts`'s
 * own "kortet får plats — då mäter testet ingenting" guard below.
 */
function pageWithSeveralRequiredFields(): GraphData {
  return {
    startNodeId: "p",
    nodes: [
      {
        id: "p",
        type: "page",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Om dig" },
          description: { sv: "Vi behöver kunna nå dig om vi har frågor om felet. ".repeat(8) },
        },
      },
      {
        id: "f1",
        type: "text-question",
        parentPageId: "p",
        order: 1,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Ditt namn" }, variableName: "namn", required: true },
      },
      {
        id: "f2",
        type: "text-question",
        parentPageId: "p",
        order: 2,
        position: { x: 0, y: 0 },
        data: { title: { sv: "E-postadress" }, variableName: "epost", required: true, format: "email" },
      },
      {
        id: "f3",
        type: "text-question",
        parentPageId: "p",
        order: 3,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Telefonnummer" }, variableName: "telefon", required: true },
      },
      {
        id: "f4",
        type: "consent-question",
        parentPageId: "p",
        order: 4,
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Jag godkänner att uppgifterna behandlas i ärendet, vilket är obligatoriskt för att gå vidare" },
          variableName: "samtycke",
          required: true,
        },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [{ id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } }],
  } as unknown as GraphData;
}

const part = (preview: GuidePreview, selector: string): HTMLElement =>
  preview.shadowRoot!.querySelector<HTMLElement>(selector)!;

describe("felsummeringen på en smal yta", () => {
  test("hamnar inte bakom den klistrande knappraden när fokus scrollar dit", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;

    preview.style.cssText = "display: block; width: 320px;";
    document.body.append(preview);
    preview.graph = pageWithSeveralRequiredFields();
    await settle();
    await settle();

    const card = part(preview, ".guide-preview__card").getBoundingClientRect();

    expect(card.height, "kortet får plats — då mäter testet ingenting").toBeGreaterThan(
      window.innerHeight,
    );

    part(preview, '[data-action="next"]').click();
    await settle(400); // hinner igenom render + focus()'s native scroll

    const summary = part(preview, "[data-error-summary]").getBoundingClientRect();
    const navigation = part(preview, ".guide-preview__navigation").getBoundingClientRect();

    expect(document.activeElement === preview || preview.shadowRoot!.activeElement, "felsummeringen fick aldrig fokus — testet mäter fel sak").toBeTruthy();
    expect(
      summary.bottom,
      `felsummeringen slutar ${Math.round(summary.bottom)}px, knappraden börjar ${Math.round(navigation.top)}px — meddelandet döljs bakom den`,
    ).toBeLessThanOrEqual(navigation.top);
  });
});

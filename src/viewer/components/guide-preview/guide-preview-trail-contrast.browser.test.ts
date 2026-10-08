import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import { effektivBakgrund, kontrast, tillRgba } from "../../../testing/contrast";
import { proModule } from "../../../testing/optional-pro";

// The housing-allowance details guide is PRO's since 8/10 (its first step is a
// free-text identity number), so this stands down in the open repo.
const { housingAllowanceExampleGraph } = ((await proModule("data/housing-allowance-example-graph.ts")) ?? {}) as { housingAllowanceExampleGraph?: unknown };

import type { GuidePreview } from "./guide-preview";

/**
 * The way here is readable on a page whose colour is not ours.
 *
 * ## What was measured
 *
 * Johan, from the bench: the trail has too little contrast in dark mode. It had
 * **1.18:1** — near-white text on near-white — and the reason is worth keeping.
 *
 * The trail is drawn outside the card, straight into `.guide-preview`, which
 * paints nothing. So its text stood on whatever the *host page* was, while the
 * component itself followed `prefers-color-scheme` into dark. The card never
 * showed it because a card paints its own surface.
 *
 * That is not the host's mistake. We go dark on our own, on a page that never
 * agreed to it, so anything we draw has to bring the surface it is read against.
 *
 * ## Why the test mounts on a white page
 *
 * Because that is the mismatch. `document.body` here is white in both runs, and
 * the dark case is exactly the one that failed — a component in dark mode on a
 * light page. Setting the page dark too would have measured the easy case and
 * passed all along.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** WCAG 1.4.3 for ordinary text. */
const TEXT = 4.5;

async function trailAfterTwoSteps(theme: "light" | "dark"): Promise<HTMLElement[]> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("data-fw-theme", theme);
  preview.setAttribute("answer-display", "trail");
  preview.style.cssText = "display: block; width: 700px;";
  document.body.append(preview);
  preview.graph = housingAllowanceExampleGraph as never;

  await settle();
  await settle();

  /*
   * A real personnummer, because the first step validates one. `19800101-1234`
   * fails the checksum, the guide never advanced, and the trail was empty — a
   * test that measured nothing and reported success.
   */
  const first = preview.shadowRoot!.querySelector<HTMLInputElement>("[data-text-answer]")!;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(first), "value")!.set!;

  setter.call(first, "19560328-1949");
  first.dispatchEvent(new Event("input", { bubbles: true }));
  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle();
  await settle();

  const trail = preview.shadowRoot!.querySelector<HTMLElement>(".guide-preview__trail");

  if (!trail) throw new Error("Vägen hit ritades inte alls.");

  return [trail, ...Array.from(trail.querySelectorAll<HTMLElement>("span"))];
}

describe.runIf(Boolean(housingAllowanceExampleGraph)).each(["light", "dark"] as const)("vägen hit i %s läge", (theme) => {
  test("står på en yta vi själva målat", async () => {
    const [trail] = await trailAfterTwoSteps(theme);

    expect(getComputedStyle(trail).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("och varje rad går att läsa mot den", async () => {
    const weak = (await trailAfterTwoSteps(theme))
      .filter((element) => (element.textContent ?? "").trim() !== "")
      .map((element) => ({
        name: element.className || element.tagName,
        ratio: kontrast(
          tillRgba(getComputedStyle(element).color),
          effektivBakgrund(element),
        ),
      }))
      .filter((measured) => measured.ratio < TEXT);

    expect(
      weak,
      weak.map((one) => `${one.name} ${one.ratio.toFixed(2)}:1`).join(", "),
    ).toEqual([]);
  });
});

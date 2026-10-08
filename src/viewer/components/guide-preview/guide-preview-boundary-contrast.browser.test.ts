import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import {
  effektivBakgrund,
  kontrast,
  kontrollkantsbrott,
  tillRgba,
} from "../../../testing/contrast";

import type { GuidePreview } from "./guide-preview";

/**
 * The edge of every control the resident can type in or press — WCAG 1.4.11.
 *
 * ## The gap this fills
 *
 * `guide-preview-contrast` walks **text**, which is 1.4.3. Nothing measured the
 * boundary of a control against what is behind it, which is a different
 * criterion with a different number: 3:1, and it applies to the thing you have
 * to *find* before you can read anything in it.
 *
 * Measured before anything was changed: the text field's border sat at **1.47:1**
 * in light and **1.95:1** in dark, and the enabled "Tillbaka" button the same,
 * because both drew themselves with `--fw-border` — a token made for dividers.
 * The editor learned this once already, on a connection handle at 1.41:1.
 *
 * The dark numbers carry a warning of their own. `--fw-border` has a comment
 * saying "AA-audit: 1.38 → 1.95", so somebody had already found this by hand and
 * stopped short of the requirement. It held on the day it was done. That is why
 * this is a test and not a comment.
 *
 * ## What is deliberately not measured
 *
 * **Disabled controls.** 1.4.11 exempts inactive components, and the first sweep
 * here reported "Tillbaka" at 1.24:1 — which was the disabled button on the first
 * step, drawn with `--fw-border-subtle` on purpose. Fixing that would have been
 * repainting something the standard says to leave alone, so the walk advances a
 * step first and skips anything disabled.
 *
 * **Controls the browser draws.** The checkbox and the file input measured 0.00
 * because they carry no border or background of ours at all — the user agent
 * renders them, which 1.4.11 exempts. The date field is the interesting one: it
 * gets the browser's own #767676 border and passes at 4.54, which is how we knew
 * the replacement had to be at least that strong.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function pastTheFirstStep(theme?: "dark"): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  /*
   * On the element. The viewer's tokens hang off `data-fw-theme` on itself, so
   * that an embedded viewer cannot recolour a host page — setting
   * `document.documentElement.dataset.theme` does nothing at all, which is how
   * the text sweep beside this one measured the light theme twice for months.
   */
  if (theme) {
    preview.theme = theme;
  }

  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = {
    startNodeId: "a",
    nodes: [
      { id: "a", type: "text-question", position: { x: 0, y: 0 }, data: { title: { sv: "Ett" }, variableName: "a" } },
      { id: "b", type: "text-question", position: { x: 0, y: 0 }, data: { title: { sv: "Två" }, variableName: "b" } },
    ],
    connections: [{ id: "c", from: { nodeId: "a", portId: "continue" }, to: { nodeId: "b", portId: "input" } }],
  } as never;

  await settle();
  await settle();

  // One step in, so "Tillbaka" is enabled and therefore covered by 1.4.11.
  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle();
  await settle();

  return preview;
}

describe.each(["ljust", "mörkt"] as const)("visaren i %s tema", (name) => {
  const theme = name === "mörkt" ? ("dark" as const) : undefined;

  test("varje kontroll man kan trycka på har en kant som syns", async () => {
    const preview = await pastTheFirstStep(theme);

    // An empty sweep must never pass: it would read exactly like a clean one.
    expect(
      preview.shadowRoot!.querySelectorAll("input, button").length,
      "inga kontroller hittades alls",
    ).toBeGreaterThan(2);

    expect(kontrollkantsbrott(preview.shadowRoot!)).toEqual([]);
  });

  /*
   * A chosen answer's edge, held to the same 3:1 as everything else.
   *
   * The chosen option is a state, not a control, so the sweep above never
   * measures it — the label draws our border, the checkbox inside is the
   * browser's. The tick does carry the choice, but Johan decided the frame
   * should too: it bordered with `--fw-primary-muted`, the same ~2:1 edge the
   * hover styles were just cured of, and a resident scanning a filled-in guide
   * finds their answers by these frames.
   */
  test("ett ivalt svarsalternativ har en ram som syns", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;

    if (theme) {
      preview.theme = theme;
    }

    preview.style.cssText = "display: block; width: 600px;";
    document.body.append(preview);
    preview.graph = {
      startNodeId: "m",
      nodes: [
        {
          id: "m",
          type: "multi-choice",
          position: { x: 0, y: 0 },
          data: {
            title: { sv: "Välj" },
            variableName: "v",
            options: [
              { id: "o1", label: "Ett", value: "1" },
              { id: "o2", label: "Två", value: "2" },
            ],
          },
        },
      ],
      connections: [],
    } as never;

    await settle();
    await settle();

    preview.shadowRoot!.querySelector<HTMLInputElement>("fieldset input")!.click();
    await settle();

    const valt = preview.shadowRoot!.querySelector<HTMLElement>("label[data-chosen]");

    expect(valt, "inget alternativ blev valt").not.toBeNull();

    const stil = getComputedStyle(valt!);
    const bakom = effektivBakgrund(valt!.parentElement!);
    const kant = kontrast(tillRgba(stil.borderTopColor), bakom);
    const yta = kontrast(tillRgba(stil.backgroundColor), bakom);

    // The better of edge and surface, same rule as the sweep's.
    expect(
      Math.max(kant, yta),
      `kant ${kant.toFixed(2)}, yta ${yta.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(3);
  });

  /*
   * The gate itself was widened today (tillganglighet sweep, 13/9) to also
   * walk `role="progressbar"` — a `<div>`, never matched by
   * `input, select, textarea, button`. Proving the WIDENED FUNCTION catches
   * it, not just the hand-measured numbers in
   * `guide-preview-progress-meter.browser.test.ts`, is the point here — a
   * gate widened without seeing it bite has only moved its blind spot
   * (PRAXIS regel 4).
   */
  test("den vidgade grinden ser mätarens list, och biter om kanten tas bort", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;

    if (theme) {
      preview.theme = theme;
    }

    preview.style.cssText = "display: block; width: 600px;";
    document.body.append(preview);
    preview.graph = {
      startNodeId: "a",
      nodes: [
        { id: "a", type: "question", position: { x: 0, y: 0 }, data: { title: { sv: "Fråga a" }, variableName: "a", options: [{ id: "o", label: "Ja", value: "ja" }] } },
        { id: "b", type: "question", position: { x: 0, y: 0 }, data: { title: { sv: "Fråga b" }, variableName: "b", options: [{ id: "o", label: "Ja", value: "ja" }] } },
        { id: "slut", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
      ],
      connections: [
        { id: "c1", from: { nodeId: "a", portId: "o" }, to: { nodeId: "b", portId: "input" } },
        { id: "c2", from: { nodeId: "b", portId: "o" }, to: { nodeId: "slut", portId: "input" } },
      ],
      settings: { sourceLocale: "sv", progress: true },
    } as never;

    await settle();
    await settle();

    const meter = preview.shadowRoot!.querySelector<HTMLElement>('[role="progressbar"]');

    expect(meter, "ingen list renderades").not.toBeNull();
    expect(kontrollkantsbrott(preview.shadowRoot!)).toEqual([]);

    // Grinden ska bita: kanten tas bort in-line (aldrig i scss-filen — det
    // riktiga felet är redan rättat) och sveparen ska själv slå larm, utan
    // hjälp av något hand-skrivet test.
    meter!.style.borderWidth = "0";

    const brott = kontrollkantsbrott(preview.shadowRoot!);

    expect(brott.some((rad) => rad.includes("progress")), brott.join("; ")).toBe(true);
  });
});

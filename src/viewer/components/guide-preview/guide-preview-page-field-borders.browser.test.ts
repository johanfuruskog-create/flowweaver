import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import { effektivBakgrund, kontrast, tillRgba } from "../../../testing/contrast";

import type { GuidePreview } from "./guide-preview";

/**
 * Every control on a page has an edge somebody can see.
 *
 * ## The fault
 *
 * Reported from the tablet as "input fields have no border". Measured on a page
 * holding one field of each kind:
 *
 *     input/text    solid 1px rgb(102, 112, 133)   ← ours
 *     input/number  solid 1px rgb(102, 112, 133)   ← ours
 *     input/date    inset 2px rgb(118, 118, 118)   ← the browser's own
 *
 * The rule listed `input[type="text"], input[type="number"]`, so a date field
 * fell through to the UA style — which on iOS reads as no box at all, and which
 * promises nothing about contrast. WCAG 1.4.11 asks 3:1 of a control's
 * boundary.
 *
 * ## Why this is written by kind and not by field
 *
 * The enumeration was the fault, not the missing `date`. Adding `date` to the
 * list would have left the next type to fall out of it in the same silence. So
 * the rule selects on the element, and this test walks whatever the page
 * renders — a new field type is covered the day it exists, without anyone
 * remembering to come back here.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 150));

const child = (id: string, type: string, order: number, data: Record<string, unknown> = {}) => ({
  id,
  type,
  parentPageId: "p",
  order,
  position: { x: 0, y: 0 },
  data: { title: { sv: id, en: id }, variableName: id, ...data },
});

async function pageWithEveryKind(theme: "light" | "dark"): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("theme", theme);
  document.body.append(preview);
  preview.graph = {
    startNodeId: "p",
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida", en: "Page" } } },
      child("a", "text-question", 1),
      child("b", "number-question", 2),
      child("c", "date-question", 3),
      child("d", "text-question", 4, { presentation: "textarea", maxLength: 600 }),
      child("e", "consent-question", 5, { consentText: { sv: "Jag godkänner", en: "I agree" } }),
      child("f", "file-question", 6),
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  return preview;
}

/** WCAG 1.4.11 — a control's boundary against the surface behind it. */
const BOUNDARY = 3;

/*
 * Hidden inputs carry a page's canonical values and are never laid out, so they
 * have no edge to see. Everything else on the page is somebody's target.
 */
const visibleControls = (preview: GuidePreview): HTMLElement[] =>
  /*
   * The file field's control is its *Välj fil* button since 1/10 (Astra,
   * bilaga 10 punkt 11); the browser's picker behind it is out of sight and
   * out of the tab order — `aria-hidden` plus `tabindex="-1"`, the pair the
   * target-size gate reads as "not a target" — so the button's edge is the
   * one measured.
   */
  Array.from(preview.shadowRoot!.querySelectorAll<HTMLElement>("input, textarea, select, [data-file-pick]")).filter(
    // Honungsfällan (story 050) är osynlig per definition — inget "synligt fält".
    (control) =>
      (control as HTMLInputElement).type !== "hidden" &&
      !control.hasAttribute("data-hp") &&
      !(control.getAttribute("aria-hidden") === "true" && control.getAttribute("tabindex") === "-1"),
  );

describe.each(["light", "dark"] as const)("a page's controls in %s", (theme) => {
  test("each one draws its own edge, none falls back to the browser's", async () => {
    const controls = visibleControls(await pageWithEveryKind(theme));

    expect(controls.length, "sidan renderade inga fält").toBeGreaterThan(4);

    const uaStyled = controls
      .filter((control) => getComputedStyle(control).borderTopStyle !== "solid")
      .map((control) => `${control.tagName.toLowerCase()}/${(control as HTMLInputElement).type}`);

    expect(uaStyled, `webbläsarens egen ram: ${uaStyled.join(", ")}`).toEqual([]);
  });

  test("and that edge stands out from the surface behind it", async () => {
    const preview = await pageWithEveryKind(theme);
    const weak = visibleControls(preview)
      .map((control) => ({
        name: `${control.tagName.toLowerCase()}/${(control as HTMLInputElement).type}`,
        ratio: kontrast(
          tillRgba(getComputedStyle(control).borderTopColor),
          effektivBakgrund(control.parentElement!),
        ),
      }))
      .filter((measured) => measured.ratio < BOUNDARY);

    expect(
      weak,
      weak.map((one) => `${one.name} ${one.ratio.toFixed(2)}:1`).join(", "),
    ).toEqual([]);
  });
});

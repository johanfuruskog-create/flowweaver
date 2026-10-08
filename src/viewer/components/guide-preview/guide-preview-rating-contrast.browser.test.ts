import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";
import { tillRgba, kontrast } from "../../../testing/contrast";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The rating segment's own edge — WCAG 1.4.11, found in the tillganglighet
 * role's broad sweep (13/9).
 *
 * `.guide-preview__rating-mark` is a `<span>` beside a visually hidden native
 * radio (the clip-path technique) — the real control the keyboard and a
 * screen reader meet, but not what a sighted person sees. What is seen is this
 * span's own border, and it drew itself with `--fw-border`, the divider token
 * the codebase has measured wrong for exactly this purpose twice before (the
 * text field's edge and the progress meter's track). Measured before anything
 * changed: **1.47:1 in light, 1.95:1 in dark** — a shared edge between two
 * unchosen segments that a sighted visitor cannot actually see.
 *
 * `kontrollkantsbrott` (`src/testing/contrast.ts`) never reaches this element:
 * its selector is `input, select, textarea, button`, and this is a `<span>`.
 * The real control (the radio) is 1×1px and clipped, so even widening that
 * selector would measure the wrong box. Hence a hand-written check here rather
 * than folding this into the general sweep.
 *
 * Checked explicitly, not assumed: the earlier round of this same story found
 * a border check that measured `currentColor` and passed on a track with NO
 * border at all, because it read the colour without asking whether a border
 * was actually drawn. This file confirms `border-top-style`/`-width` first.
 */

afterEach(() => document.body.replaceChildren());
const settle = (ms = 150) => new Promise<void>((r) => setTimeout(r, ms));

const ratingGuide = (): GraphData =>
  ({
    startNodeId: "b",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "b", type: "rating-question", position: { x: 0, y: 0 },
        data: {
          title: { sv: "Hur trivs du i din lägenhet?" }, variableName: "trivsel", steps: 4,
          labels: [{ sv: "Mycket bra" }, { sv: "Ganska bra" }, { sv: "Inte så bra" }, { sv: "Dåligt" }],
        },
      },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [{ id: "c", from: { nodeId: "b", portId: "continue" }, to: { nodeId: "r", portId: "input" } }],
  }) as unknown as GraphData;

async function mount(theme?: "dark"): Promise<GuidePreview> {
  const gp = document.createElement("guide-preview") as GuidePreview;
  gp.style.cssText = "display: block; width: 600px;";
  document.body.append(gp);
  if (theme) (gp as unknown as { theme: string }).theme = theme;
  gp.graph = ratingGuide();
  await settle();
  return gp;
}

describe.each([["ljust", undefined], ["mörkt", "dark" as const]])(
  "%s tema",
  (_namn, tema) => {
    test("ett ovalt segments kant går att hitta mot kortet (3:1)", async () => {
      const gp = await mount(tema);
      const mark = gp.shadowRoot!.querySelector<HTMLElement>(".guide-preview__rating-mark")!;
      const card = gp.shadowRoot!.querySelector<HTMLElement>(".guide-preview__card")!;
      const style = getComputedStyle(mark);

      // Finns kanten alls? Annars mäter vi currentColor och ljuger för oss själva.
      expect(style.borderTopStyle).toBe("solid");
      expect(Number.parseFloat(style.borderTopWidth)).toBeGreaterThan(0);

      const border = tillRgba(style.borderTopColor);
      const cardBg = tillRgba(getComputedStyle(card).backgroundColor);
      const ratio = kontrast(border, cardBg);

      expect(ratio).toBeGreaterThanOrEqual(3);
    });

    test("den valda ytan syns fortfarande mot en oval granne, sedan kanten rättats", async () => {
      const gp = await mount(tema);
      const radios = [...gp.shadowRoot!.querySelectorAll<HTMLInputElement>("[data-rating-answer]")];

      radios[1].click();
      await settle();

      const marks = [...gp.shadowRoot!.querySelectorAll<HTMLElement>(".guide-preview__rating-mark")];
      const chosen = tillRgba(getComputedStyle(marks[1]).backgroundColor);
      const neighbour = tillRgba(getComputedStyle(marks[2]).backgroundColor);

      // Regressionsvakt: detta krav har inget med kanten att göra, men en
      // tokenändring som löser kanten får inte tyst sänka det här — precis
      // det som hände när mätarens spår fick fel token tidigare i dag.
      expect(kontrast(chosen, neighbour)).toBeGreaterThanOrEqual(3);
    });
  }
);

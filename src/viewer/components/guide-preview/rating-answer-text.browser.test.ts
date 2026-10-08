import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import { tillRgba, kontrast } from "../../../testing/contrast";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The rating scale's answer texts (Astra 1/10, bilaga 11; GRAFISK-PROFIL,
 * *Fråga och svar i granskning och kvitto*): 16 px / 400 throughout — the
 * steps' words and numbers as well as *Inte aktuellt* and *Vet ej*. The
 * choice is marked by the control's chosen state, never by weight.
 *
 * Measured 1/10 before: every step 600, at rest and chosen; the words 12 px
 * on the bar and 14 in a standing list; a standing numbers scale's numbers
 * 14 px in the secondary ink; the ways out 16 / 400.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/*
 * The chosen segment's fill is a CSS `background-color` transition (120ms,
 * `.guide-preview__rating-mark`), not an instant swap. Measured 1/10, logging
 * the computed colour at fixed delays after `.click()`: it is still exactly
 * the resting colour at +0 ms and at +10 ms, and only reaches the final
 * primary fill some tens of milliseconds later — a flat `settle(150)` sits
 * close enough to that boundary that it reads the resting colour whenever
 * the first paint frame after the click is delayed, which a full-suite run
 * with many concurrent headless Chromium tabs can do to frame delivery
 * without the JS timer itself running late. That a flat 150ms wait can read
 * either side of this line, by design, is what the mutation in the commit
 * log for this fix demonstrates — not a reproduction of the exact reported
 * failure, which needs the real contention of a full run. This instead waits
 * for the fill to actually leave its resting value, however long that takes,
 * bounded so a genuine regression still fails instead of hanging.
 */
async function waitForFill(element: HTMLElement, resting: string, timeoutMs = 1000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let current = getComputedStyle(element).backgroundColor;
  while (current === resting && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    current = getComputedStyle(element).backgroundColor;
  }
  return current;
}

const graph = (data: object) => ({
  startNodeId: "q",
  nodes: [
    {
      id: "q", type: "rating-question", position: { x: 0, y: 0 },
      data: { title: { sv: "Hur var det?" }, variableName: "betyg", notApplicable: true, dontKnow: true, ...data },
    },
    { id: "end", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Klart" } } },
  ],
  connections: [{ id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "end", portId: "input" } }],
});

const words = { labels: [{ sv: "Mycket bra" }, { sv: "Ganska bra" }, { sv: "Inte så bra" }, { sv: "Dåligt" }] };
const numbers = { steps: 5, labels: [{ sv: "Långt ifrån" }, "", "", "", { sv: "Precis" }] };

async function mount(width: number, data: object, theme?: "dark") {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = `display:block;width:${width}px;`;
  document.body.append(preview);
  if (theme) (preview as unknown as { theme: string }).theme = theme;
  preview.graph = graph(data) as unknown as GraphData;
  await settle();
  return preview.shadowRoot!;
}

const seen = (element: HTMLElement) =>
  element.getBoundingClientRect().width > 1 && getComputedStyle(element).clipPath === "none";

/** Every answer text the eye reads: the step's word, else its number; the ways out. */
function answerTexts(root: ShadowRoot): HTMLElement[] {
  const steps = [...root.querySelectorAll<HTMLElement>(".guide-preview__rating-mark")].flatMap((mark) => {
    const shown = [...mark.querySelectorAll<HTMLElement>(".guide-preview__rating-word")].filter(seen);
    const number = mark.querySelector<HTMLElement>(".guide-preview__rating-number")!;
    const numbersMode = mark.closest("[data-mode]")!.getAttribute("data-mode") === "numbers";
    return numbersMode ? [...shown, number] : shown;
  });
  return [...steps, ...root.querySelectorAll<HTMLElement>(".guide-preview__rating-na span")];
}

describe("betygsskalans svarstexter", () => {
  for (const [name, data] of [["ord", words], ["siffror", numbers]] as const) {
    for (const width of [640, 390]) {
      test(`${name}, ${width} px: 16 px / 400 i vila och vald — valet syns i kontrollen`, async () => {
        const root = await mount(width, data);
        const forms = () => answerTexts(root).map((text) => {
          const style = getComputedStyle(text);
          return `${text.textContent!.trim()} ${style.fontSize}/${style.fontWeight}`;
        });
        const rest = forms();
        expect(rest.length, "texter att mäta").toBeGreaterThanOrEqual(6);
        for (const form of rest) expect(form, "i vila").toMatch(/ 16px\/400$/);

        const step = root.querySelectorAll<HTMLInputElement>(".guide-preview__rating-step input")[1];
        const mark = step.parentElement!.querySelector<HTMLElement>(".guide-preview__rating-mark")!;
        const background = getComputedStyle(mark).backgroundColor;
        step.click();
        const chosenMark = root.querySelectorAll<HTMLElement>(".guide-preview__rating-mark")[1];
        const filled = await waitForFill(chosenMark, background);
        expect(filled, "valet är kontrollens fyllda läge").not.toBe(background);
        expect(forms(), "vald: samma form som i vila").toEqual(rest);

        root.querySelector<HTMLInputElement>(".guide-preview__rating-na input")!.click();
        await settle();
        expect(forms(), "Inte aktuellt vald: samma form").toEqual(rest);
      });
    }
  }
});

/*
 * The number's two roles and the chosen surface (Astra 1/10, bilaga 12,
 * point 1; GRAFISK-PROFIL): 16 px in the text ink where the number IS the
 * answer, 14 px secondary where it sits beside a written word — and on a
 * chosen segment both follow the chosen surface's own text role. Measured
 * 1/10: already so (white on the primary, 6.29:1 light; the dark ink on the
 * dark primary, 6.20:1); this pins it.
 */
describe("betygsskalans siffra och den valda ytan", () => {
  for (const theme of [undefined, "dark"] as const) {
    for (const [name, data] of [["ord", words], ["siffror", numbers]] as const) {
      test(`${theme ? "mörkt" : "ljust"}, ${name}, stående: siffrans roll i vila, den valda ytans textroll vald`, async () => {
        const root = await mount(390, data, theme);
        const ink = (token: string) => {
          const probe = document.createElement("span");
          probe.style.color = `var(${token})`;
          root.querySelector("article")!.append(probe);
          const colour = getComputedStyle(probe).color;
          probe.remove();
          return colour;
        };
        const number = (index: number) => root.querySelectorAll<HTMLElement>(".guide-preview__rating-number")[index];
        const rest = getComputedStyle(number(1));
        expect(`${rest.fontSize} ${rest.color}`, "i vila").toBe(
          name === "siffror" ? `16px ${ink("--fw-text")}` : `14px ${ink("--fw-text-secondary")}`,
        );

        root.querySelectorAll<HTMLInputElement>(".guide-preview__rating-step input")[1].click();
        await settle();
        const mark = root.querySelectorAll<HTMLElement>(".guide-preview__rating-mark")[1];
        const surface = getComputedStyle(mark);
        const texts = [...mark.querySelectorAll<HTMLElement>(".guide-preview__rating-number, .guide-preview__rating-word")].filter(seen);
        expect(texts.length).toBeGreaterThan(0);
        for (const text of texts) {
          const colour = getComputedStyle(text).color;
          expect(colour, `${text.textContent?.trim()}: den valda ytans textroll`).toBe(surface.color);
          expect(kontrast(tillRgba(colour), tillRgba(surface.backgroundColor)), "K3").toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }
});


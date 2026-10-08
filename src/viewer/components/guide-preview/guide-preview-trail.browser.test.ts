import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The way behind the resident, as something to read.
 *
 * ## What it adds, and what it does not
 *
 * Johan asked the question that decided the shape of this: we already have a
 * model that works — `previous()` — so what does the new one add?
 *
 * Not a capability. `previous()` reaches every earlier step already, one at a
 * time. A trail you can press only shortens the distance: four presses become
 * one. What it does add, and what costs nothing, is being able to check "did I
 * say Hyr or Äger?" **without leaving the question you are standing on**.
 *
 * So the value was in reading, not in navigating — which meant the half I had
 * been defending as the point, pressable rows, was the expensive half carrying
 * all the risk. This is the other half, built alone.
 *
 * ## Why the absence of buttons is asserted
 *
 * Because it is a decision, not an omission, and the next person to read the
 * file will be tempted. Making the rows navigable needs a `goToStep` in the
 * engine, and it comes with a price a person has to be shown first: everything
 * answered after that step is discarded — which is what `previous()` already
 * does, one step at a time. Two ways back with different prices is the third
 * mechanism PRAXIS 15 warns about.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 90) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function graph(): GraphData {
  return {
    startNodeId: "boende",
    nodes: [
      {
        id: "boende",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Hur bor du i dag?" },
          variableName: "boende",
          options: [
            { id: "hyr", label: { sv: "Hyr" }, value: "hyr" },
            { id: "ager", label: { sv: "Äger" }, value: "ager" },
          ],
        },
      },
      {
        id: "kostnad",
        type: "number-question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Boendekostnad per månad" }, variableName: "kostnad" },
      },
      { id: "klart", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "boende", portId: "hyr" }, to: { nodeId: "kostnad", portId: "input" } },
      { id: "c2", from: { nodeId: "boende", portId: "ager" }, to: { nodeId: "kostnad", portId: "input" } },
      { id: "c3", from: { nodeId: "kostnad", portId: "continue" }, to: { nodeId: "klart", portId: "input" } },
    ],
  } as GraphData;
}

async function twoStepsIn(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("answer-display", "trail");
  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = graph();

  await settle();

  preview.shadowRoot!.querySelector<HTMLInputElement>('[data-option-id="hyr"]')?.click();
  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
  await settle();

  /*
   * Valt på vad fältet *är*, inte på hur det råkar vara skrivet: beloppsfältet
   * är text sedan det började grupperas medan man skriver, och `type="number"`
   * hittade då ingenting alls.
   */
  const amount = preview.shadowRoot!.querySelector<HTMLInputElement>("[data-number-answer]")!;
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(amount),
    "value",
  )!.set!;

  setter.call(amount, "7400");
  amount.dispatchEvent(new Event("input", { bubbles: true }));
  amount.dispatchEvent(new Event("change", { bubbles: true }));

  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
  await settle();

  return preview;
}

const rows = (preview: GuidePreview): Array<{ question: string; answer: string }> =>
  [...preview.shadowRoot!.querySelectorAll(".guide-preview__trail li")].map((row) => ({
    question: (row.querySelector(".guide-preview__trail-question")?.textContent ?? "").trim(),
    answer: (row.querySelector(".guide-preview__trail-answer")?.textContent ?? "").trim(),
  }));

describe("vägen hit", () => {
  test("visar frågan och svaret för varje steg man lämnat", async () => {
    const trail = rows(await twoStepsIn());

    expect(trail).toEqual([
      { question: "Hur bor du i dag?", answer: "Hyr" },
      { question: "Boendekostnad per månad", answer: "7 400" },
    ]);
  });

  test("och citerar dem som fälten visade dem", async () => {
    /*
     * `7 400` and not `7400`: the record keeps the raw value, and a trail that
     * disagrees with the field it quotes is worse than none. Asserted with a
     * non-breaking space, which is the separator the amount actually carries —
     * a plain one would let the number wrap into two.
     */
    const trail = rows(await twoStepsIn());

    expect(trail[1]?.answer).toBe("7 400");
  });

  test("men går inte att trycka på — det är ett senare beslut", async () => {
    /*
     * A decision rather than an omission. Navigating needs an engine that can go
     * back to a chosen step and keep the run, and a person must be shown what it
     * costs before they press it.
     */
    const preview = await twoStepsIn();

    const trail = preview.shadowRoot!.querySelector<HTMLElement>(".guide-preview__trail")!;

    /*
     * Bredare än `button`, och det var värt att skärpa: en länk, ett
     * `role="button"` eller ett tabstopp på en rad är samma beslut taget i en
     * annan tagg, och det förra påståendet hade släppt igenom alla tre.
     */
    expect(
      trail.querySelectorAll("button, a, [role=button], [tabindex]").length,
      "trailen blev navigering utan att någon bestämt det",
    ).toBe(0);

    /*
     * Och den ska inte se tryckbar ut heller. Listan fick en egen botten när den
     * mättes till 1,18:1 i mörkt läge — med kortets färg hade den blivit ett
     * kort till, alltså något man tar i.
     */
    expect(getComputedStyle(trail).cursor, "listan bjuder in till ett tryck").toBe("auto");
    expect(getComputedStyle(trail).backgroundColor).not.toBe(
      getComputedStyle(
        preview.shadowRoot!.querySelector<HTMLElement>(".guide-preview__card")!,
      ).backgroundColor,
    );
  });

  test("och säger vad listan är, för den som inte ser den", async () => {
    const preview = await twoStepsIn();

    expect(
      preview.shadowRoot!.querySelector(".guide-preview__trail")?.getAttribute("aria-label"),
    ).toBe("Vägen hit");
  });
});

describe("utan attributet", () => {
  test("finns den inte alls", async () => {
    const preview = await twoStepsIn();

    preview.removeAttribute("answer-display");
    await settle();

    expect(preview.shadowRoot!.querySelector(".guide-preview__trail")).toBeNull();
  });
});

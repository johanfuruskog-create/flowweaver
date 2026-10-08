// The sending steps are FlowWeaver PRO's; this test uses them (open-core step 4).
import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";


import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SubmissionPayload = any;
await withPro("viewer/index.ts");
const { registerSubmissionReceiver, unregisterSubmissionReceiver } = (await proModule("viewer/core/submission-registry.ts")) ?? {};
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * Numbers and dates in the review and the receipt, in the viewer's language
 * and by the field's meaning (Astra 1/10, bilaga 10 punkt 17): *48 000 kr*
 * and *20 september 2026*, never *48000* and *2026-09-20*. A unit only where
 * the field has one. What is stored and sent does not change.
 */

afterEach(() => {
  unregisterSubmissionReceiver();
  document.body.replaceChildren();
});

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph = (): GraphData =>
  ({
    startNodeId: "p",
    settings: { sourceLocale: "sv", locales: ["sv", "en"] },
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Skadan", en: "The damage" } } },
      { id: "amount", type: "number-question", parentPageId: "p", order: 0, position: { x: 0, y: 0 }, data: { title: { sv: "Belopp", en: "Amount" }, variableName: "belopp", min: 0, max: 1000000, unit: { sv: "kr", en: "SEK" } } },
      { id: "rooms", type: "number-question", parentPageId: "p", order: 1, position: { x: 0, y: 0 }, data: { title: { sv: "Rum", en: "Rooms" }, variableName: "rum", min: 0, max: 100000 } },
      { id: "when", type: "date-question", position: { x: 400, y: 0 }, data: { title: { sv: "När?", en: "When?" }, variableName: "datum" } },
      { id: "review", type: "review", position: { x: 800, y: 0 }, data: { title: { sv: "Granska", en: "Review" } } },
      { id: "send", type: "submit-result", position: { x: 1200, y: 0 }, data: { title: { sv: "Tack", en: "Thanks" }, recipientId: "r" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "when", portId: "input" } },
      { id: "c2", from: { nodeId: "when", portId: "continue" }, to: { nodeId: "review", portId: "input" } },
      { id: "c3", from: { nodeId: "review", portId: "continue" }, to: { nodeId: "send", portId: "input" } },
    ],
  }) as never;

const next = async (root: ShadowRoot) => {
  root.querySelector<HTMLButtonElement>('[data-action="next"], [data-action="submit"]')!.click();
  await settle();
};

async function walk(locale: string): Promise<{ preview: GuidePreview; review: string[]; receipt: string[]; sent: SubmissionPayload }> {
  let sent: SubmissionPayload | null = null;
  registerSubmissionReceiver({
    recipients: () => [{ id: "r", label: "R" }],
    submit: async (payload: SubmissionPayload) => { sent = payload; return { reference: "R-1" }; },
  });
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.setAttribute("active-locale", locale);
  document.body.append(preview);
  preview.graph = graph();
  await settle();
  const root = preview.shadowRoot!;
  const fill = (selector: string, value: string) => {
    const input = root.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  fill("#page-field-amount", "48000");
  fill("#page-field-rooms", "12000");
  await next(root);
  fill("input[type=date]", "2026-09-20");
  await next(root);
  const review = [...root.querySelectorAll(".guide-preview__review dd")].map((dd) => dd.textContent!.trim());
  await next(root);
  await settle(300);
  const receipt = [...root.querySelectorAll("[data-submit-sent] li")].map((li) => li.textContent!.trim());
  return { preview, review, receipt, sent: sent! };
}

describe("tal och datum i granskning och kvitto", () => {
  test.runIf(PRO)("på svenska", async () => {
    const { review, receipt } = await walk("sv");

    expect(review).toEqual(["48 000 kr", "12 000", "20 september 2026"]);
    expect(receipt.join(" | ")).toContain("48 000 kr");
    expect(receipt.join(" | ")).toContain("20 september 2026");
  });

  test.runIf(PRO)("på engelska", async () => {
    const { review } = await walk("en");

    expect(review).toEqual(["48,000 SEK", "12,000", "September 20, 2026"]);
  });

  test.runIf(PRO)("lagringsvärdena ändras inte", async () => {
    const { preview, sent } = await walk("sv");

    expect(preview.getAnswers()).toMatchObject({ belopp: "48000", rum: "12000", datum: "2026-09-20" });
    expect(sent.answers).toMatchObject({ belopp: "48000", rum: "12000", datum: "2026-09-20" });
  });

  // Punkt 18 with 17: a repeated page's rows in the review are formatted too.
  test.runIf(PRO)("i en upprepning i granskningen", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    preview.setAttribute("active-locale", "sv");
    document.body.append(preview);
    preview.graph = {
      startNodeId: "p",
      settings: { sourceLocale: "sv" },
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Kostnader" }, repeats: true, repeatWord: { sv: "kostnad" }, repeatVariable: "kostnader" } },
        { id: "sum", type: "number-question", parentPageId: "p", order: 0, position: { x: 0, y: 0 }, data: { title: { sv: "Belopp" }, variableName: "belopp", min: 0, max: 1000000, unit: { sv: "kr" } } },
        { id: "review", type: "review", position: { x: 400, y: 0 }, data: { title: { sv: "Granska" } } },
      ],
      connections: [{ id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "review", portId: "input" } }],
    } as never;
    await settle();
    const root = preview.shadowRoot!;
    const input = root.querySelector<HTMLInputElement>('[data-page-field-id="sum#0"] input')!;
    input.value = "48000";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await next(root);

    expect([...root.querySelectorAll("[data-review-record] dd")].map((dd) => dd.textContent!.trim())).toEqual(["48\u00a0000\u00a0kr"]);
  });
});

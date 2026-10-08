// The sending steps are FlowWeaver PRO's; this test uses them (open-core step 4).
import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";


import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
await withPro("viewer/index.ts");
const { registerSubmissionReceiver, unregisterSubmissionReceiver } = (await proModule("viewer/core/submission-registry.ts")) ?? {};
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * Question and answer in the review and the receipt (Astra 1/10, bilaga 11,
 * point 2; GRAFISK-PROFIL, *Fråga och svar i granskning och kvitto*):
 *
 * - question 14 px in `--fw-text-secondary`;
 * - answer 16 px / 400 in `--fw-text` — never 600, also in the review;
 * - a record's heading (*Pass 1*) 14 px / 700;
 * - less room between question and answer than to the next pair.
 *
 * While the receipt is on its way the answers take the secondary ink; size
 * and spacing stay, and the answers go back to the text ink with the
 * receipt.
 *
 * Measured 1/10 before: the review's answer 15 px / 600 (500 in a record),
 * 2 px under its question; the receipt's answer 14 px / 400 secondary in
 * every state, flush under its question, 8 px to the next pair.
 */

afterEach(() => {
  unregisterSubmissionReceiver();
  document.body.replaceChildren();
});

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const options = [
  { id: "a", label: { sv: "Dag 1" }, value: "dag1" },
  { id: "b", label: { sv: "Dag 2" }, value: "dag2" },
];

const graph = {
  startNodeId: "q",
  settings: { sourceLocale: "sv" },
  nodes: [
    { id: "q", type: "question", position: { x: 0, y: 0 }, data: { title: { sv: "Kommer du?" }, variableName: "kommer", options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }] } },
    { id: "p", type: "page", position: { x: 400, y: 0 }, data: { title: { sv: "Passen" }, repeats: true, repeatWord: { sv: "pass" }, repeatVariable: "passen" } },
    { id: "pick", type: "question", parentPageId: "p", order: 0, position: { x: 0, y: 0 }, data: { title: { sv: "Vilket pass?" }, variableName: "pass", options } },
    { id: "rev", type: "review", position: { x: 600, y: 0 }, data: { title: { sv: "Granska" } } },
    { id: "send", type: "submit-result", position: { x: 800, y: 0 }, data: { title: { sv: "Tack" }, recipientId: "r" } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "q", portId: "ja" }, to: { nodeId: "p", portId: "input" } },
    { id: "c2", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "rev", portId: "input" } },
    { id: "c3", from: { nodeId: "rev", portId: "continue" }, to: { nodeId: "send", portId: "input" } },
  ],
};

async function walkToReview() {
  const replies: (() => void)[] = [];
  registerSubmissionReceiver({
    recipients: () => [{ id: "r", label: "R" }],
    submit: () => new Promise((resolve) => replies.push(() => resolve({ reference: "R-1" }))),
  });
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = "display:block;width:640px;";
  document.body.append(preview);
  preview.graph = graph as unknown as GraphData;
  await settle();
  const root = preview.shadowRoot!;
  const press = async (selector: string) => {
    root.querySelector<HTMLElement>(selector)!.click();
    await settle();
  };
  await press('[data-option-id="ja"]');
  await press('[data-action="next"]');
  await press('[data-page-field-id="pick#0"] input[value="dag1"]');
  await press('[data-action="repeat-add"]');
  await press('[data-page-field-id="pick#1"] input[value="dag2"]');
  await press('[data-action="next"]');
  return { root, press, reply: () => replies.shift()!() };
}

/** A token's colour as the browser computes it, for comparing with an element's. */
function ink(root: ShadowRoot, token: string): string {
  const probe = document.createElement("span");
  root.querySelector("article")!.append(probe);
  probe.style.color = `var(${token})`;
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

function expectRoles(root: ShadowRoot, question: string, answer: string, answerInk: string) {
  const questions = [...root.querySelectorAll(`article ${question}`)];
  const answers = [...root.querySelectorAll(`article ${answer}`)];
  expect(questions.length, "tre par: en lös fråga och två pass").toBe(3);
  expect(answers.length).toBe(3);

  questions.forEach((q, index) => {
    const a = answers[index];
    const qs = getComputedStyle(q);
    const as = getComputedStyle(a);
    expect(`${qs.fontSize} ${qs.color}`, "frågan: 14 px, sekundär").toBe(`14px ${ink(root, "--fw-text-secondary")}`);
    expect(`${as.fontSize} ${as.fontWeight} ${as.color}`, "svaret: 16 px / 400").toBe(`16px 400 ${answerInk}`);
    expect(a.getBoundingClientRect().top - q.getBoundingClientRect().bottom, "fråga → svar: --fw-space-1").toBeCloseTo(4, 0);
  });
  for (const heading of root.querySelectorAll("article h4")) {
    const style = getComputedStyle(heading);
    expect(`${heading.textContent?.trim()} ${style.fontSize} ${style.fontWeight}`).toMatch(/^Pass \d 14px 700$/);
  }
}

describe("fråga och svar", () => {
  test.runIf(PRO)("i granskningen: frågan 14 sekundär, svaret 16/400 i textbläck — inga svar i 600", async () => {
    const { root } = await walkToReview();
    expect(root.querySelector('[data-node-type="review"], article dl')).not.toBeNull();
    expectRoles(root, "dt", "dd", ink(root, "--fw-text"));
    // Between two pairs: the row's own padding above and below, and the
    // divider — 12 + 1 + 12, against 4 inside a pair.
    const row = root.querySelector<HTMLElement>("article .guide-preview__review-row")!;
    expect(getComputedStyle(row).paddingTop, "radens --fw-space-3").toBe("12px");

    // The page's heading is the viewer's section heading, 18/700 (bilaga 12,
    // point 2; it was 15, the editor's size). *Pass 1* stays 14/700 under it.
    const page = getComputedStyle(root.querySelector("article .guide-preview__review-group-head h3")!);
    expect(`${page.fontSize}/${page.fontWeight}`, "sidrubriken").toBe("18px/700");
    const record = getComputedStyle(root.querySelector("article .guide-preview__review-record h4")!);
    expect(`${record.fontSize}/${record.fontWeight}`, "Pass 1").toBe("14px/700");
  });

  test.runIf(PRO)("i kvittot medan det skickas: svaren sekundära, storlek och avstånd som i kvittot", async () => {
    const { root, press } = await walkToReview();
    await press('[data-action="next"]');
    expect(root.querySelector("article")!.getAttribute("aria-busy")).toBe("true");
    expectRoles(root, ".guide-preview__submit-question", ".guide-preview__submit-answer", ink(root, "--fw-text-secondary"));
  });

  test.runIf(PRO)("i kvittot när det är klart: svaren i textbläck, 4 px under frågan, 12 px till nästa par", async () => {
    const { root, press, reply } = await walkToReview();
    await press('[data-action="next"]');
    const before = root.querySelector(".guide-preview__submit-answer")!.getBoundingClientRect().top - root.querySelector("[data-submit-sent]")!.getBoundingClientRect().top;
    reply();
    await settle(400);
    expect(root.querySelector("article")!.hasAttribute("aria-busy")).toBe(false);
    expectRoles(root, ".guide-preview__submit-question", ".guide-preview__submit-answer", ink(root, "--fw-text"));
    const after = root.querySelector(".guide-preview__submit-answer")!.getBoundingClientRect().top - root.querySelector("[data-submit-sent]")!.getBoundingClientRect().top;
    expect(after, "svaren flyttar sig inte när kvittot kommer").toBeCloseTo(before, 1);

    // Two pairs in a row: the loose question, and a record's first.
    const loose = root.querySelector<HTMLElement>("[data-submit-sent] > li")!;
    const next = loose.nextElementSibling as HTMLElement;
    expect(next.getBoundingClientRect().top - loose.getBoundingClientRect().bottom, "mellan par: --fw-space-3").toBeCloseTo(12, 0);
  });
});

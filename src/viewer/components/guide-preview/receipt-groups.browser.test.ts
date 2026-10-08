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
 * The receipt's *Det här skickades* (Astra 1/10, bilaga 10 punkt 18): a
 * repeated page's records as groups headed *Pass 1*, *Pass 2*, each question
 * with its answer under it, and no colon after a question's own question
 * mark. It was one line per field — *Pass 1 — Vilket pass?: Dag 1* —
 * (genomgången 30/9, V17, V19).
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
    { id: "send", type: "submit-result", position: { x: 800, y: 0 }, data: { title: { sv: "Tack" }, recipientId: "r" } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "q", portId: "ja" }, to: { nodeId: "p", portId: "input" } },
    { id: "c2", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "send", portId: "input" } },
  ],
};

describe("kvittots lista", () => {
  test.runIf(PRO)("upprepningarna som grupper med frågan och svaret under, utan kolon efter frågetecknet", async () => {
    registerSubmissionReceiver({ recipients: () => [{ id: "r", label: "R" }], submit: async () => ({ reference: "R-1" }) });
    const preview = document.createElement("guide-preview") as GuidePreview;
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
    await settle(300);

    const list = root.querySelector<HTMLElement>("[data-submit-sent]")!;
    const rows = [...list.children].map((li) => ({
      heading: li.querySelector("h4")?.textContent?.trim() ?? null,
      pairs: [...li.querySelectorAll(".guide-preview__submit-question")].map(
        (q) => `${q.textContent!.trim()} / ${q.nextElementSibling!.textContent!.trim()}`,
      ),
    }));

    expect(rows).toEqual([
      { heading: null, pairs: ["Kommer du? / Ja"] },
      { heading: "Pass 1", pairs: ["Vilket pass? / Dag 1"] },
      { heading: "Pass 2", pairs: ["Vilket pass? / Dag 2"] },
    ]);
    expect(list.textContent, "inget kolon efter frågetecknet").not.toMatch(/\?:/);
    const question = list.querySelector(".guide-preview__submit-question")!.getBoundingClientRect();
    const answer = list.querySelector(".guide-preview__submit-answer")!.getBoundingClientRect();
    expect(answer.top, "svaret under frågan").toBeGreaterThanOrEqual(question.bottom - 1);
  });
});

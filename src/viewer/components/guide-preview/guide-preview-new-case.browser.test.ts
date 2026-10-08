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
 * Story 071 — Nytt ärende från kvittensen (Johans beslut 2/9). Kvittensen
 * var en återvändsgränd; nu bär den en knapp som börjar om från starten
 * med tomma svar. Texten är justerbar per inlämning ("borde vara
 * justerbart") — tomt = guidens standard, som sidans Fortsätt-text.
 */

afterEach(() => {
  document.body.replaceChildren();
  unregisterSubmissionReceiver();
});

const settle = (ms = 300) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function tillKvittens(extra: Record<string, unknown> = {}): Promise<ShadowRoot> {
  // Per montering — afterEach avregistrerar, och en modulnivåregistrering
  // lämnade andra testet mottagarlöst (inlämningen föll till felläget).
  registerSubmissionReceiver({
    recipients: () => [{ id: "kontoret", label: "Kontoret" }],
    submit: async () => ({ reference: "FW-TEST-1" }),
  });

  const gp = document.createElement("guide-preview") as GuidePreview;

  gp.style.cssText = "display: block; width: 600px;";
  document.body.append(gp);
  gp.graph = {
    version: 8,
    startNodeId: "q",
    nodes: [
      { id: "q", type: "text-question", position: { x: 0, y: 0 }, data: { title: { sv: "Vad hände?" }, variableName: "svar", required: true } },
      { id: "slut", type: "submit-result", position: { x: 500, y: 0 }, data: { title: { sv: "Tack!" }, recipientIds: ["kontoret"], ...extra } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "slut", portId: "input" } },
    ],
  } as unknown as GraphData;
  await settle();

  const root = gp.shadowRoot!;
  const input = root.querySelector<HTMLInputElement>("[data-text-answer]")!;

  input.value = "Lampan är trasig";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  [...root.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.dataset.action === "next")!
    .click();
  await settle(600);
  return root;
}

const nyttArende = (root: ShadowRoot) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.dataset.action === "restart",
  );

describe("nytt ärende från kvittensen", () => {
  test.runIf(PRO)("kvittensen bär knappen, och klicket ger starten med tomma svar", async () => {
    const root = await tillKvittens();

    expect(root.textContent).toContain("FW-TEST-1");
    const knapp = nyttArende(root);

    expect(knapp, "knappen finns").toBeTruthy();
    expect(knapp!.textContent?.trim()).toBe("Nytt ärende");

    knapp!.click();
    await settle();

    expect(root.querySelector("h2")?.textContent).toContain("Vad hände?");
    expect(root.querySelector<HTMLInputElement>("[data-text-answer]")?.value).toBe("");
    expect(root.textContent).not.toContain("FW-TEST-1");
  });

  test.runIf(PRO)("texten är justerbar per inlämning — tomt ger standarden", async () => {
    const root = await tillKvittens({
      newCaseLabel: { sv: "Anmäl ett fel till" },
    });

    expect(nyttArende(root)!.textContent?.trim()).toBe("Anmäl ett fel till");
  });
});

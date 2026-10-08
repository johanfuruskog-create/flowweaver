import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import "../../node-types/default-node-types";
import "./guide-preview";
import { getStepRenderer, registerStepRenderer, unregisterStepRenderer } from "../../node-types/step-renderers";
import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
await withPro("viewer/components/submission-steps.ts");
const { registerSubmissionReceiver, unregisterSubmissionReceiver } = (await proModule("viewer/core/submission-registry.ts")) ?? {};
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * The open viewer without the full version (story 147, criterion 6): a guide
 * with a submission still opens, and the submission step is drawn as a plain
 * result — nothing is sent, no reference is invented, no waiting text, and
 * the button into the step says Nästa, not Skicka in. A warning names what
 * is missing. The renderers are unregistered for the test and put back after.
 */
const kept = { submit: getStepRenderer("submit-result"), email: getStepRenderer("email-result") };
const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  unregisterStepRenderer("submit-result");
  unregisterStepRenderer("email-result");
});
afterEach(() => {
  if (kept.submit) registerStepRenderer("submit-result", kept.submit);
  if (kept.email) registerStepRenderer("email-result", kept.email);
  unregisterSubmissionReceiver();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function submitGraph(): GraphData {
  return {
    startNodeId: "t",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "t", type: "text-question", position: { x: 0, y: 0 }, data: { title: { sv: "Vad gäller felet?" }, variableName: "beskrivning" } },
      { id: "skicka", type: "submit-result", position: { x: 200, y: 0 }, data: { title: { sv: "Tack för din anmälan" }, description: { sv: "Vi hör av oss." }, recipientId: "gatukontoret" } },
    ],
    connections: [{ id: "c", from: { nodeId: "t", portId: "continue" }, to: { nodeId: "skicka", portId: "input" } }],
  } as never;
}

describe("en inlämning utan registrerad renderare", () => {
  test.runIf(PRO)("ritas som ett resultat, skickar inget och leder dit med Nästa", async () => {
    const submit = vi.fn(async () => ({ reference: "FA-2026-00001" }));
    registerSubmissionReceiver({ recipients: () => [{ id: "gatukontoret", label: "Gatukontoret" }], submit });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const preview = document.createElement("guide-preview") as GuidePreview;
    document.body.append(preview);
    preview.graph = submitGraph();
    await settle();
    const root = preview.shadowRoot!;
    const next = root.querySelector<HTMLButtonElement>('[data-action="next"]')!;
    expect(next.textContent?.trim()).toBe("Nästa");

    root.querySelector<HTMLInputElement>("[data-text-answer]")!.value = "Lampan är släckt";
    next.click();
    await settle(250);

    const card = root.querySelector('[data-node-type="submit-result"]')!;
    expect(card.textContent).toContain("Tack för din anmälan");
    expect(card.textContent).toContain("Vi hör av oss.");
    expect(root.querySelector("[data-submit-reply]")).toBeNull();
    expect(root.querySelector("[data-waiting]")).toBeNull();
    expect(card.textContent).not.toContain("FA-2026");
    expect(submit).not.toHaveBeenCalled();
    expect(warn.mock.calls.some((call) => String(call[0]).includes("submit-result"))).toBe(true);
  });
});

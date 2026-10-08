import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Being told before you press the button, not after.
 *
 * ## What this guards, and what it does not
 *
 * The rule that decides whether an answer may pass is the engine's, and it is
 * well guarded: breaking the minimum, the maximum, the format or the required
 * flag in `guide-traversal-engine.ts` fails between one and nineteen existing
 * tests. Nothing invalid gets through today.
 *
 * The viewer keeps a **mirror** of those rules so it can say something while
 * somebody is still typing — the hint under a multiple-choice question, the
 * message when a text field loses focus. That mirror had no tests. Breaking it
 * changed nothing about what is accepted and everything about when a person
 * finds out: instead of *"at least two"* under the question, silence, and then
 * a refusal after pressing Next.
 *
 * That is a smaller failure than letting bad data through, and a real one. It
 * is also the kind that no one reports as a bug — it reads as the guide being
 * awkward rather than as something being broken.
 *
 * Found by mutation: the inline minimum-length message and the selection hint
 * were the two that survived the whole suite.
 */

afterEach(() => {
  document.body.replaceChildren();
});

function mount(type: string, data: Record<string, unknown>): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;

  document.body.append(preview);
  preview.graph = {
    startNodeId: "q",
    nodes: [
      { id: "q", type, position: { x: 0, y: 0 }, data },
      {
        id: "done",
        type: "result",
        position: { x: 0, y: 0 },
        data: { title: "Klart" },
      },
    ],
    connections: [
      {
        id: "c",
        from: { nodeId: "q", portId: "continue" },
        to: { nodeId: "done", portId: "input" },
      },
    ],
  } as GraphData;

  return preview;
}

/*
 * The error region, not the whole shadow tree.
 *
 * The first version of this file read `shadowRoot.textContent` and looked for
 * the number. It passed against every mutation, because the number is on the
 * page anyway — in the counter, in an attribute, in the options. An assertion
 * that cannot tell the message from its surroundings is not an assertion.
 */
const errorRegion = (preview: GuidePreview) =>
  preview.shadowRoot?.querySelector<HTMLElement>("[data-text-validation]") ?? null;

/** The multiple-choice legend, which is where the hint is written. */
const legend = (preview: GuidePreview) =>
  (
    preview.shadowRoot?.querySelector("legend") ??
    preview.shadowRoot?.querySelector(".guide-preview__value-answer span")
  )?.textContent?.replace(/\s+/g, " ") ?? "";

describe("the viewer says so before the button is pressed", () => {
  test("a text answer that is too short is called out on blur", async () => {
    const preview = mount("text-question", {
      title: "Beskriv ärendet",
      variableName: "arende",
      minLength: 10,
    });

    const field = preview.shadowRoot?.querySelector<HTMLInputElement>(
      "input[data-text-answer]"
    );

    expect(field).not.toBeNull();

    field!.value = "kort";
    field!.dispatchEvent(new Event("input", { bubbles: true }));
    field!.dispatchEvent(new Event("blur", { bubbles: true }));

    const region = errorRegion(preview);

    // Shown, and carrying the author's own number — "too short" would leave
    // the person to guess by how much.
    expect(region?.hidden).toBe(false);
    expect(region?.textContent).toContain("10");
  });

  test("and says nothing once it is long enough", () => {
    const preview = mount("text-question", {
      title: "Beskriv ärendet",
      variableName: "arende",
      minLength: 10,
    });

    const field = preview.shadowRoot?.querySelector<HTMLInputElement>(
      "input[data-text-answer]"
    );

    field!.value = "det här är tillräckligt långt";
    field!.dispatchEvent(new Event("input", { bubbles: true }));
    field!.dispatchEvent(new Event("blur", { bubbles: true }));

    // Nothing said, which is the other half of the claim: a message that
    // appears when it should not is as wrong as one that never appears.
    expect(errorRegion(preview)?.hidden).not.toBe(false);
    expect(errorRegion(preview)?.textContent ?? "").toBe("");
  });

  /*
   * The hint under a multiple-choice question.
   *
   * It is drawn from the same three fields the engine reads — `required`, the
   * minimum and the maximum — and it is the only warning a person gets while
   * choosing. Without it the first sign that four is too many is a refusal.
   */
  test("a multiple-choice question shows how many may be chosen", () => {
    const preview = mount("multi-choice", {
      title: "Vad gäller ärendet?",
      variableName: "amne",
      minSelected: 2,
      maxSelected: 3,
      options: [
        { id: "a", label: "Bygglov", value: "bygglov" },
        { id: "b", label: "Avlopp", value: "avlopp" },
        { id: "c", label: "Buller", value: "buller" },
        { id: "d", label: "Annat", value: "annat" },
      ],
    });

    // Both numbers, in the legend itself — the options and the counter carry
    // digits of their own, so anywhere else would pass by accident.
    expect(legend(preview)).toMatch(/2/);
    expect(legend(preview)).toMatch(/3/);
  });

  test("and says at least one when the question is merely required", () => {
    const preview = mount("multi-choice", {
      title: "Vad gäller ärendet?",
      variableName: "amne",
      required: true,
      options: [
        { id: "a", label: "Bygglov", value: "bygglov" },
        { id: "b", label: "Avlopp", value: "avlopp" },
      ],
    });

    /*
     * `required` carries a minimum of one without anybody writing the number,
     * and the hint has to say so. This is the line that survived mutation: with
     * it removed the question looked entirely optional right up until Next.
     */
    expect(legend(preview)).toMatch(/1|minst|at least/i);
  });
});

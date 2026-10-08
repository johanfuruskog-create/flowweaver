import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Story 110 on a page — and on a page that repeats.
 *
 * A page is what a form is, so this is where the browser's offer matters
 * most. And a page that repeats (story 084) draws the same field once per
 * record: without a `section-` of its own, every group carries the same
 * `autocomplete` word, and the browser fills all of them with the same
 * person. The section token is opaque to the browser — it only has to
 * differ — so it is the group's own index, the number already standing in
 * `data-repeat-group` beside it.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function graph(repeats: boolean): GraphData {
  return {
    startNodeId: "sidan",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "sidan", type: "page", position: { x: 0, y: 0 },
        data: repeats
          ? { title: { sv: "Dina barn" }, repeats: true, repeatWord: { sv: "barn" }, repeatVariable: "barn" }
          : { title: { sv: "Om dig" } },
      },
      {
        id: "namn", type: "text-question", parentPageId: "sidan", order: 1, position: { x: 0, y: 0 },
        data: { title: { sv: "Förnamn" }, variableName: "fornamn", autofill: "given-name" },
      },
      {
        id: "epost", type: "text-question", parentPageId: "sidan", order: 2, position: { x: 0, y: 0 },
        data: { title: { sv: "E-post" }, variableName: "epost", format: "email" },
      },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "sidan", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;
}

async function mount(repeats: boolean): Promise<ShadowRoot> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = graph(repeats);
  await settle();
  return preview.shadowRoot!;
}

const autocompleteOf = (root: ShadowRoot, fieldId: string) =>
  root.querySelector<HTMLInputElement>(`[data-page-field-id="${fieldId}"] input`)!
    .getAttribute("autocomplete");

describe("autofyll på en sida (story 110)", () => {
  test("fältets eget ord, och formatets, utan prefix när sidan inte upprepas", async () => {
    const root = await mount(false);

    expect(autocompleteOf(root, "namn")).toBe("given-name");
    expect(autocompleteOf(root, "epost")).toBe("email");
  });

  test("en upprepad sida ger varje varv sitt section-prefix", async () => {
    const root = await mount(true);

    root.querySelector<HTMLButtonElement>('[data-action="repeat-add"]')!.click();
    await settle();

    expect(root.querySelectorAll("fieldset[data-repeat-group]").length).toBe(2);
    expect(autocompleteOf(root, "namn#0")).toBe("section-0 given-name");
    expect(autocompleteOf(root, "namn#1")).toBe("section-1 given-name");
    // Formatets ord följer samma regel: annars fylls varje varvs e-post lika.
    expect(autocompleteOf(root, "epost#0")).toBe("section-0 email");
    expect(autocompleteOf(root, "epost#1")).toBe("section-1 email");
  });
});

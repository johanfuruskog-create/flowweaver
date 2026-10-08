import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import { getNodeTypes, isPageOnlyNodeType } from "../../node-types/node-type-registry";
import { drawnAsStep } from "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * `drawnAsStep` has to keep saying what the viewer actually does.
 *
 * The editor asks it before offering the eye in a node's header (story 064).
 * The answer is a list, and a list drifts: a node type that gets a rendering
 * here and is left out would silently lose its eye, and one removed from the
 * renderer would keep offering a switch to a card that says the type cannot be
 * previewed.
 *
 * So this does not read the list. It renders one node of every registered type
 * and looks for the viewer's own refusal — which is the only place the truth
 * is — and compares that with what `drawnAsStep` claims. Page-only types are
 * left out: they are never a step, they are fields their page draws.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const standalone = getNodeTypes()
  .map(({ type }) => type)
  .filter((type) => !isPageOnlyNodeType(type));

async function refuses(type: string): Promise<boolean> {
  const definition = getNodeTypes().find((one) => one.type === type)!.definition;
  const graph: GraphData = {
    startNodeId: "one",
    nodes: [
      {
        id: "one",
        type,
        position: { x: 0, y: 0 },
        data: definition.createData(),
      },
    ],
    connections: [],
    settings: { sourceLocale: "sv" },
  } as unknown as GraphData;

  const preview = document.createElement("guide-preview") as GuidePreview;

  document.body.append(preview);
  preview.graph = graph;
  preview.showNode("one");
  await settle();

  const text = preview.shadowRoot?.textContent ?? "";

  preview.remove();
  return text.includes("kan inte förhandsgranskas");
}

describe("vad visaren kan rita som ett steg", () => {
  test("det finns typer att pröva, så en tom lista inte kan passera", () => {
    expect(standalone.length).toBeGreaterThan(10);
  });

  test.each(standalone)("%s: listan och visaren säger samma sak", async (type) => {
    expect({ type, drawn: drawnAsStep(type) }).toEqual({
      type,
      drawn: !(await refuses(type)),
    });
  });
});

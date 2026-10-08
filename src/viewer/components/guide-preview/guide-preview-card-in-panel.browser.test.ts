import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Johan 25/9: "Varför plockade vi bort att visaren låg i ett kort?"
 *
 * Measured: the panel's preview got `editor-view` on 13/9 (the editor's
 * picture — variable names, hidden fields shown), and `editor-view` also
 * carried the rule written for the node card ("inside a node, the node is
 * already the card"). Two meanings on one attribute, so the panel lost its
 * card as a side effect. The card-stripping now keys on `in-node`, which only
 * `flow-node` sets; `editor-view` alone keeps the card.
 */

afterEach(() => document.body.replaceChildren());

const graph = (): GraphData =>
  ({
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Bor du i kommunen?" }, variableName: "bor", options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }] },
      },
    ],
    connections: [],
  }) as unknown as GraphData;

async function mount(attributes: string[]): Promise<HTMLElement> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  for (const name of attributes) preview.setAttribute(name, "");
  preview.style.cssText = "display:block;width:420px;";
  document.body.append(preview);
  preview.graph = graph();
  await new Promise((r) => setTimeout(r, 120));
  const card = preview.shadowRoot!.querySelector<HTMLElement>(".guide-preview__card");
  if (!card) throw new Error("kortet saknas");
  return card;
}

describe("visarens kort", () => {
  // Panelen är `compact` sedan juli: ram och rundade hörn, ingen skugga.
  // Det är den formen 13/9 tog bort av misstag.
  test("står kvar i redaktörens bild (panelens förhandsgranskning)", async () => {
    const card = await mount(["compact", "editor-view"]);
    const cs = getComputedStyle(card);

    expect(parseFloat(cs.borderTopWidth), "ingen ram").toBeGreaterThan(0);
    expect(parseFloat(cs.borderRadius), "inga rundade hörn").toBeGreaterThan(0);
    expect(parseFloat(cs.paddingTop), "ingen luft").toBeGreaterThan(0);
  });

  test("tas bort bara inne i en nod, där noden är kortet", async () => {
    const card = await mount(["editor-view", "in-node"]);
    const cs = getComputedStyle(card);

    expect(cs.borderTopWidth).toBe("0px");
    expect(cs.borderRadius).toBe("0px");
    expect(cs.paddingTop).toBe("0px");
  });
});

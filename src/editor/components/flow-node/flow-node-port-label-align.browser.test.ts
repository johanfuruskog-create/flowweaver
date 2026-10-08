import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import type { FlowNode } from "./flow-node";

/**
 * A wrapped output label hugs its port.
 *
 * Output rows are right-justified, but the text inside the label wrapped
 * left-aligned — so a long answer like "Medborgare i ett land utanför EU/EES"
 * put its second line far from the dot it belongs to (Johan's photo, the
 * citizenship guide). The label's lines align towards the port: right on
 * outputs, left on inputs, so every line points at its own dot.
 */

afterEach(() => document.body.replaceChildren());

function nodeWith(): FlowNode {
  const node = document.createElement("flow-node") as FlowNode;

  document.body.append(node);
  node.nodeData = {
    id: "q",
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      title: "Vilket medborgarskap har du?",
      variableName: "citizenship",
      options: [
        { id: "o1", label: "Medborgare i ett land utanför EU/EES", value: "third" },
      ],
    },
  } as never;

  return node;
}

describe("the output label's text", () => {
  test("aligns towards the port, so a wrapped line stays with its dot", () => {
    const label = nodeWith().shadowRoot!.querySelector<HTMLElement>(
      ".flow-node__port-row--output .flow-node__port-label",
    )!;

    expect(getComputedStyle(label).textAlign).toBe("right");
  });
});

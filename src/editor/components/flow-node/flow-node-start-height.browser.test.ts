import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import type { FlowNode } from "./flow-node";
import type { FlowNodeData } from "../../../viewer/types/graph";

/**
 * A node keeps its height when it becomes the guide's start.
 *
 * ## The failure this is written from
 *
 * A start node has no input — nothing can lead to where a guide begins — so the
 * input port is dropped, and the node used to lose that row's height with it.
 * Measured: 229px became 189. Every port below the change moved with it, which
 * is the same shape as the bug that had connections coming away from their
 * ports, and on screen it read as the node flinching the moment it was made the
 * start.
 *
 * The row therefore stays and only its contents go.
 *
 * ## What is asserted, and what deliberately is not
 *
 * Not "the reserved row exists" — that passes on a row of the wrong size, which
 * is the whole failure. The node's own height, before and after, to the pixel.
 *
 * And the port is asserted **gone from the DOM**, not merely invisible. The
 * first attempt kept the button and hid it with `visibility`; the height was
 * right and it could not be clicked, but the canvas finds ports by
 * `[data-port-id]` when it draws connections, so a start node quietly had an
 * input to draw to again. Height without that check would have passed.
 */

afterEach(() => document.body.replaceChildren());

const question = {
  id: "q",
  type: "question",
  position: { x: 0, y: 0 },
  data: {
    title: { sv: "Har du tandvärk?" },
    options: [
      { id: "ja", label: { sv: "Ja" }, value: "ja" },
      { id: "nej", label: { sv: "Nej" }, value: "nej" },
    ],
  },
} as unknown as FlowNodeData;

function mount(isStart: boolean): FlowNode {
  const node = document.createElement("flow-node") as FlowNode;

  node.style.cssText = "position: static; display: block;";
  document.body.append(node);
  node.startNode = isStart;
  node.nodeData = structuredClone(question);

  return node;
}

const portIds = (node: FlowNode): string[] =>
  [...(node.shadowRoot?.querySelectorAll("[data-port-id]") ?? [])].map(
    (port) => port.getAttribute("data-port-id") ?? "",
  );

describe("a node made the guide's start", () => {
  test("keeps the height it had", () => {
    const ordinary = mount(false).getBoundingClientRect().height;
    document.body.replaceChildren();
    const start = mount(true).getBoundingClientRect().height;

    expect(ordinary).toBeGreaterThan(0);
    expect(start).toBe(ordinary);
  });

  test("and has no input port left in the markup", () => {
    expect(portIds(mount(false))).toContain("input");
    document.body.replaceChildren();
    expect(portIds(mount(true))).not.toContain("input");
  });
});

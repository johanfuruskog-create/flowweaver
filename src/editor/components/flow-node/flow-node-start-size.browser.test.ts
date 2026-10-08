import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import { getNodeTypes } from "../../../viewer/node-types/node-type-registry";

import type { FlowNode } from "./flow-node";
import type { FlowNodeData } from "../../../viewer/types/graph";

/**
 * A start node is the same size as the same node would be otherwise.
 *
 * Only the port differs. A guide's start has nothing leading to it, so its input
 * port goes — but the node it belongs to is the same node, and it should not
 * change shape the moment somebody points at it and says "begin here".
 *
 * ## The failure this is written from
 *
 * Dropping the input port took its row with it: measured on a question, 229px
 * became 189. Every port below the change moved with it — the same shape as the
 * bug that had connections coming away from their ports — and on screen the node
 * flinched as it was made the start. The row stays now and only its contents go.
 *
 * ## Why this runs over every type rather than one
 *
 * The first version of this guarantee was checked on a question, because that is
 * the type the failure was found on. Nine of the built-in types hide their inputs
 * when they are the start, and each renders its own body; a rule proved on one of
 * them is a rule proved on one of them. Anything registered later is included by
 * the same loop, without a list here to keep in step.
 */

afterEach(() => document.body.replaceChildren());

/** A node of the given type, mounted on its own so nothing else affects height. */
function mount(type: string, isStart: boolean): FlowNode {
  const node = document.createElement("flow-node") as FlowNode;

  node.style.cssText = "position: static; display: block;";
  document.body.append(node);
  node.startNode = isStart;
  node.nodeData = {
    id: "n",
    type,
    position: { x: 0, y: 0 },
    data: {},
  } as unknown as FlowNodeData;

  return node;
}

const portIds = (node: FlowNode): string[] =>
  [...(node.shadowRoot?.querySelectorAll("[data-port-id]") ?? [])].map(
    (port) => port.getAttribute("data-port-id") ?? "",
  );

describe("every node type, as the guide's start", () => {
  const types = getNodeTypes()
    .filter(({ definition }) => definition.hideInputsWhenStart)
    .map(({ type }) => type);

  test("there is more than one type to check", () => {
    expect(types.length).toBeGreaterThan(1);
  });

  for (const type of types) {
    test(`${type} keeps its height`, () => {
      const ordinary = mount(type, false).getBoundingClientRect().height;
      document.body.replaceChildren();
      const start = mount(type, true).getBoundingClientRect().height;

      expect(ordinary).toBeGreaterThan(0);
      expect(start).toBe(ordinary);
    });

    test(`${type} loses its input port and nothing else`, () => {
      const ordinary = portIds(mount(type, false));
      document.body.replaceChildren();
      const start = portIds(mount(type, true));

      const inputs = ordinary.filter((id) => !start.includes(id));
      const gained = start.filter((id) => !ordinary.includes(id));

      expect(gained).toEqual([]);
      expect(inputs).toEqual(["input"]);
    });
  }
});

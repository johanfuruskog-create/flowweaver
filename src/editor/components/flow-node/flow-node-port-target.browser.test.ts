import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import type { FlowNode } from "./flow-node";
import type { FlowNodeData } from "../../../viewer/types/graph";

/**
 * A port can be hit with a finger, not only with a mouse.
 *
 * ## The measurement behind it
 *
 * The circle is 18×18 CSS pixels. That is a comfortable target for a pointer
 * that lands where you looked, and a poor one for a fingertip, which covers
 * roughly ten millimetres and arrives approximately. The target is 44×44 — the
 * number Apple has published since the first iPhone, and WCAG 2.2 SC 2.5.5.
 *
 * ## Why the circle stays 18 px
 *
 * The dot is also the anchor a connection is drawn to, and the guide reads
 * differently when the dots are half again as large — on a question with five
 * answers the ports start to crowd the labels. So the target grows and the
 * drawing does not: an invisible extension around the circle, which is what
 * everything from checkboxes to close buttons does.
 *
 * ## What decided the number
 *
 * The distance to the nearest neighbouring port, because two targets on top of
 * each other make the **wrong** port reachable — worse than a small one.
 *
 * The first version of this file settled for 24 on the reasoning that the port
 * rows are 28 px apart. That was the wrong measurement: the rows are 28 tall,
 * and two ports' centres are 40 apart. Measured across every registered node
 * type, exactly one pair is tight — two answers on a question — and every other
 * pair is 238 px away. So the whole cost of reaching 44 was 4 px of `gap`, and
 * the re-layout the earlier note predicted never had to happen.
 *
 * Worth remembering as a shape: the number that blocked the job was one I had
 * read off the CSS rather than off the product.
 *
 * ## What is asserted
 *
 * Not the CSS — an `::after` box cannot be measured, and measuring the rule
 * rather than the effect is how a target can be "24 px" and still unhittable
 * because something is drawn over it. What is asserted is what a tap does:
 * `elementFromPoint` at the edge of the intended target must find the port.
 */

afterEach(() => document.body.replaceChildren());

/** A question with two answers: an input and two outputs, spaced as usual. */
function mount(): FlowNode {
  const node = document.createElement("flow-node") as FlowNode;

  node.style.cssText = "position: absolute; left: 100px; top: 100px;";
  document.body.append(node);
  node.nodeData = {
    id: "n",
    type: "question",
    position: { x: 100, y: 100 },
    data: {
      title: { sv: "Har du tandvärk?" },
      options: [
        { id: "ja", label: { sv: "Ja" }, value: "ja" },
        { id: "nej", label: { sv: "Nej" }, value: "nej" },
      ],
    },
  } as unknown as FlowNodeData;

  return node;
}

const ports = (node: FlowNode): HTMLElement[] => [
  ...(node.shadowRoot?.querySelectorAll<HTMLElement>(".flow-node__port") ?? []),
];

/** Half of a 44 px target, less a hair for the edge. */
const REACH = 21.5;

describe("a port's target", () => {
  test("is reachable 21.5 px out from its centre, in every direction", () => {
    const node = mount();
    const root = node.shadowRoot!;
    const found = ports(node);

    expect(found.length).toBeGreaterThan(1);

    for (const port of found) {
      const box = port.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;

      const corners: Array<[string, number, number]> = [
        ["vänster", cx - REACH, cy],
        ["höger", cx + REACH, cy],
        ["upp", cx, cy - REACH],
        ["ner", cx, cy + REACH],
      ];

      for (const [where, x, y] of corners) {
        const hit = root.elementFromPoint(x, y);

        expect(
          `${port.dataset.portId} ${where}: ${hit?.className ?? "inget"}`,
        ).toBe(`${port.dataset.portId} ${where}: ${port.className}`);
      }
    }
  });

  test("does not reach into its neighbour's", () => {
    const node = mount();
    const outputs = ports(node).filter(
      (port) => port.dataset.portDirection === "output",
    );

    expect(outputs.length).toBeGreaterThan(1);

    for (let index = 1; index < outputs.length; index += 1) {
      const above = outputs[index - 1].getBoundingClientRect();
      const below = outputs[index].getBoundingClientRect();
      const between = below.top + below.height / 2 - (above.top + above.height / 2);

      // Two targets that overlap make the wrong port reachable, which is worse
      // than a small one.
      expect(between).toBeGreaterThanOrEqual(REACH * 2);
    }
  });
});

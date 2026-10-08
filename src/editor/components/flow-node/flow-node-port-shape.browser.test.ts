import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import type { FlowNode } from "./flow-node";
import type { FlowNodeData } from "../../../viewer/types/graph";

/**
 * The port is a circle, however long the label is.
 *
 * It sat in a flex row without `flex: none` and therefore shrank when the label
 * took up space: a long option squashed it to 11x18 instead of 18x18. That is
 * not merely ugly — the circle is both the hit area you drag a connection from
 * and the anchor point the line is drawn to.
 */

const LONG =
  "Jag ansöker om bygglov för en tillbyggnad på min villa i Örebro kommun";

function nod(etiketter: string[]): FlowNodeData {
  return {
    id: "q",
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      title: { sv: "Vad gäller ditt ärende?" },
      variableName: "arende",
      options: etiketter.map((label, index) => ({
        id: `o${index}`,
        label: { sv: label },
        value: `o${index}`,
      })),
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

function montera(etiketter: string[]): FlowNode {
  const element = document.createElement("flow-node") as FlowNode;
  // The node's width is fixed on the canvas; that is what the label competes for.
  element.style.cssText = "display: block; width: 240px;";
  document.body.append(element);
  element.nodeData = nod(etiketter);
  return element;
}

function portBox(element: FlowNode): Array<{ w: number; h: number }> {
  return [
    ...(element.shadowRoot?.querySelectorAll(".flow-node__port--output") ?? []),
  ].map((port) => {
    const rect = port.getBoundingClientRect();
    return { w: Math.round(rect.width), h: Math.round(rect.height) };
  });
}

describe("portens form", () => {
  test("en kort etikett ger en cirkel", () => {
    expect(portBox(montera(["Ja"]))).toEqual([{ w: 18, h: 18 }]);
  });

  // This is what turned into an oval.
  test("a long label does not squash it", () => {
    expect(portBox(montera([LONG]))).toEqual([{ w: 18, h: 18 }]);
  });

  test("mixed lengths give equally sized ports", () => {
    const box = portBox(montera(["Ja", LONG, "Nej, jag vill bara veta"]));

    expect(box).toHaveLength(3);
    expect(box.every((m) => m.w === 18 && m.h === 18)).toBe(true);
  });

  // A single long word — a URL, a compound — must break, not stick out of the
  // card.
  test("an unbreakable word does not burst the node", () => {
    const element = montera(["https://exempel.se/mycket/lang/adress/som/aldrig/tar/slut"]);
    const kort = element.shadowRoot?.querySelector(".flow-node");

    expect(portBox(element)).toEqual([{ w: 18, h: 18 }]);
    expect(Math.round(kort?.getBoundingClientRect().width ?? 0)).toBeLessThanOrEqual(240);
  });
});

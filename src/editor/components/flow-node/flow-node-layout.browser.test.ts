import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import type { FlowNode } from "./flow-node";
import type { FlowNodeData } from "../../../viewer/types/graph";

/**
 * Layout invariants over hard cases.
 *
 * Background: a port was squashed into an oval when the option label was long,
 * and it was found because someone looked — not by 880 tests. That sort of thing
 * is geometry, and geometry can be asserted about.
 *
 * Why not screenshots? They need the same rendering environment not to fail on
 * font rasterisation, and a failure saying "3% of pixels differ" rarely gets
 * fixed. One saying "the port is 11x18, should be 18x18" does.
 *
 * The matrix below is deliberately nasty. Add a case when something looks odd,
 * not a test per bug.
 */

const NODBREDD = 240;

/** Content that tends to break a layout. */
const HARD_TEXTS: Array<[namn: string, text: string]> = [
  ["kort", "Ja"],
  ["longLabel mening", "Jag ansöker om bygglov för en tillbyggnad på min villa i Örebro kommun"],
  ["ett obrytbart ord", "https://exempel.se/mycket/lang/adress/som/aldrig/tar/slut"],
  ["tom", ""],
  ["bara mellanslag", "     "],
  ["många ord utan skiljetecken", "a ".repeat(60)],
];

function question(text: string, antalAlternativ = 1): FlowNodeData {
  return {
    id: "n",
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      title: { sv: text },
      variableName: "svar",
      options: Array.from({ length: antalAlternativ }, (_, index) => ({
        id: `o${index}`,
        label: { sv: text },
        value: `o${index}`,
      })),
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

function montera(node: FlowNodeData, tema?: "dark"): FlowNode {
  if (tema) {
    document.documentElement.dataset.theme = tema;
  }

  const element = document.createElement("flow-node") as FlowNode;
  element.style.cssText = `display: block; width: ${NODBREDD}px;`;
  document.body.append(element);
  element.nodeData = node;
  return element;
}

function delar(element: FlowNode, väljare: string): HTMLElement[] {
  return [...(element.shadowRoot?.querySelectorAll<HTMLElement>(väljare) ?? [])];
}

/**
 * The ports are circles. They are both the hit area you drag a connection from
 * and the point the line is drawn to, so a squashed port is wrong twice over.
 */
function portInvariant(element: FlowNode): string[] {
  return delar(element, ".flow-node__port").flatMap((port) => {
    const { width, height } = port.getBoundingClientRect();
    return Math.round(width) === 18 && Math.round(height) === 18
      ? []
      : [`port ${width.toFixed(1)}×${height.toFixed(1)}, ska vara 18×18`];
  });
}

/**
 * Text stays inside the card.
 *
 * The ports are exempt: they deliberately hang over the edge (a negative margin)
 * so they sit on the node's outer edge.
 */
function overflowInvariant(element: FlowNode): string[] {
  const kort = element.shadowRoot?.querySelector(".flow-node");
  if (!kort) {
    return ["kortet renderades inte"];
  }

  const ram = kort.getBoundingClientRect();
  const tolerans = 0.5;

  return delar(
    element,
    ".flow-node__title, .flow-node__description, .flow-node__port-label, .flow-node__header",
  ).flatMap((del) => {
    const rect = del.getBoundingClientRect();
    const outside =
      rect.left < ram.left - tolerans || rect.right > ram.right + tolerans;

    return outside
      ? [
          `${del.className || del.tagName} sticker ut: ` +
            `${rect.left.toFixed(1)}–${rect.right.toFixed(1)} outside ${ram.left.toFixed(1)}–${ram.right.toFixed(1)}`,
        ]
      : [];
  });
}

/** The card does not grow past the width the canvas gave it. */
function breddInvariant(element: FlowNode): string[] {
  const kort = element.shadowRoot?.querySelector(".flow-node");
  const bredd = kort?.getBoundingClientRect().width ?? 0;

  return bredd <= NODBREDD + 0.5
    ? []
    : [`kortet är ${bredd.toFixed(1)}px brett, canvasen gav ${NODBREDD}px`];
}

const INVARIANTER = [portInvariant, overflowInvariant, breddInvariant];

function brott(element: FlowNode): string[] {
  return INVARIANTER.flatMap((kontroll) => kontroll(element));
}

describe("the node's layout holds for hard content", () => {
  test.each(HARD_TEXTS)("%s", (_namn, text) => {
    expect(brott(montera(question(text)))).toEqual([]);
  });

  test.each(HARD_TEXTS)("%s, i mörkt läge", (_namn, text) => {
    const element = montera(question(text), "dark");

    try {
      expect(brott(element)).toEqual([]);
    } finally {
      delete document.documentElement.dataset.theme;
    }
  });

  // Many exits at once: the ports share height with their labels, and that is
  // when the rows start competing for space.
  test("eight options of differing length", () => {
    const node = question("", 8);
    (node.data.options as Array<{ label: unknown }>).forEach((option, index) => {
      option.label = { sv: HARD_TEXTS[index % HARD_TEXTS.length][1] };
    });

    expect(brott(montera(node))).toEqual([]);
  });
});

describe("the invariants hold for every node type drawn on the canvas", () => {
  const TYPER: Array<[string, Record<string, unknown>]> = [
    ["question", { variableName: "s", options: [{ id: "a", label: {}, value: "a" }] }],
    ["multi-choice", { variableName: "s", options: [{ id: "a", label: {}, value: "a" }] }],
    ["text-question", { variableName: "s" }],
    ["number-question", { variableName: "s" }],
    ["result", {}],
    ["rule", { cases: [] }],
    ["page", {}],
  ];

  test.each(TYPER)("%s med longLabel text", (type, data) => {
    const longLabel = HARD_TEXTS[1][1];
    const node: FlowNodeData = {
      id: "n",
      type,
      position: { x: 0, y: 0 },
      data: { ...data, title: { sv: longLabel }, description: { sv: longLabel } },
    };

    expect(brott(montera(node))).toEqual([]);
  });
});

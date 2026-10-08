import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import type { FlowNode } from "./flow-node";
import type { FlowNodeData, GraphData } from "../../../viewer/types/graph";

/**
 * Berättelse 134, kriterium 4 — punkten vid ett villkorat alternativ.
 *
 * Ett tecken och inte meningen: kortet ska säga ATT alternativet har ett
 * villkor, orden står i panelen där man redigerar det. Kortet får inte bli en
 * lista av villkor.
 *
 * Punkten bär hela meningen för den som inte ser den (K3) — ingenting får
 * kräva att man ser färg eller form. Därför `role="img"` med ett
 * `aria-label`: ett `aria-label` på ett vanligt `<span>` renderas till ingen
 * alls, vilket den här kodbasen redan har skeppat en gång.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 40) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph = {
  startNodeId: "allergi",
  nodes: [
    {
      id: "allergi",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: "Allergier",
        variableName: "allergi",
        options: [
          { id: "a1", label: "Nötter", value: "notter" },
          { id: "a2", label: "Inga", value: "inga" },
        ],
      },
    },
  ],
  connections: [],
} as unknown as GraphData;

async function mount(options: Array<Record<string, unknown>>): Promise<FlowNode> {
  const element = document.createElement("flow-node") as FlowNode;

  document.body.append(element);
  element.previewGraph = graph;
  element.nodeData = {
    id: "meny",
    type: "question",
    position: { x: 0, y: 0 },
    data: { title: "Meny", variableName: "meny", options },
  } as FlowNodeData;

  await settle();

  return element;
}

const VILLKOR = {
  match: "all",
  conditions: [
    { id: "c1", variableName: "allergi", operator: "not-one-of", value: "notter" },
  ],
};

const dots = (element: FlowNode): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>("[data-port-conditional]"),
];

describe("134 kriterium 4 — punkten på nodkortet", () => {
  test("kriterium 4: ett villkorat alternativ får en punkt med skylten som aria-label", async () => {
    const element = await mount([
      { id: "veg", label: "Vegetariskt", value: "veg" },
      { id: "curry", label: "Nötcurry", value: "curry", visibility: VILLKOR },
    ]);

    expect(dots(element)).toHaveLength(1);

    const dot = dots(element)[0]!;

    expect(dot.getAttribute("role")).toBe("img");
    // Skylten, ord för ord — samma mening panelen och fältbandet bär.
    expect(dot.getAttribute("aria-label")).toBe("Visas bara om Allergier inte är någon av Nötter");

    // Och den sitter vid rätt alternativ.
    expect(dot.closest(".flow-node__port-row")?.textContent).toContain("Nötcurry");
  });

  test("kriterium 4: inget villkor, ingen punkt", async () => {
    const element = await mount([
      { id: "veg", label: "Vegetariskt", value: "veg" },
      { id: "curry", label: "Nötcurry", value: "curry" },
    ]);

    expect(dots(element)).toHaveLength(0);
  });

  test("kriterium 4: kortet blir inte en lista av villkor", async () => {
    const element = await mount([
      { id: "veg", label: "Vegetariskt", value: "veg" },
      { id: "curry", label: "Nötcurry", value: "curry", visibility: VILLKOR },
    ]);

    // Meningen står i punktens namn, aldrig som synlig text på kortet.
    expect(element.shadowRoot!.textContent).not.toContain("Visas bara om");
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import type { FlowNode } from "./flow-node";
import type { FlowNodeData, GraphData } from "../../../viewer/types/graph";

/**
 * Story 087 — *till* är efter *från*. Ett datumfält vars gräns pekar på ett
 * annat fält visar det på kortet, *≥ Från*, som villkorsbandet visar *visas
 * bara om*. En fast gräns är panelens sak och syns inte här.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 40) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(data: Record<string, unknown>, graph?: GraphData): Promise<FlowNode> {
  const element = document.createElement("flow-node") as FlowNode;

  document.body.append(element);
  if (graph) element.previewGraph = graph;
  element.nodeData = {
    id: "till",
    type: "date-question",
    position: { x: 0, y: 0 },
    data: { title: "Till", variableName: "till", ...data },
  } as FlowNodeData;

  await settle();

  return element;
}

const band = (element: FlowNode): string | null =>
  element.shadowRoot?.querySelector("[data-date-bound]")?.textContent?.trim() ?? null;

describe("gränsbandet", () => {
  test("säger vilket fält gränsen är, med guidens ord för det", async () => {
    const graph = {
      startNodeId: "fran",
      nodes: [
        { id: "fran", type: "date-question", position: { x: 0, y: 0 }, data: { title: "Från", variableName: "fran" } },
      ],
      connections: [],
    } as unknown as GraphData;

    expect(band(await mount({ min: "{{fran}}" }, graph))).toBe("≥ Från");
    expect(band(await mount({ min: "{{fran}}", max: "{{slut}}" }, graph))).toBe("≥ Från, ≤ slut");
  });

  test("en fast gräns och idag är panelens sak", async () => {
    expect(band(await mount({ min: "2026-01-01", max: "idag" }))).toBeNull();
    expect(band(await mount({}))).toBeNull();
  });
});

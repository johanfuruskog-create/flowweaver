import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

function mount(format: string): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  const graph: GraphData = {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "text-question",
        position: { x: 0, y: 0 },
        data: { title: "Fyll i", variableName: "v", format },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
    ],
    connections: [
      { id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  };
  preview.graph = graph;
  return preview;
}

function inputType(preview: GuidePreview): string | null {
  return (
    preview.shadowRoot
      ?.querySelector<HTMLInputElement>("[data-text-answer]")
      ?.getAttribute("type") ?? null
  );
}

describe("the text question's input type follows the format", () => {
  test("e-post ger type=email, telefon type=tel, annars text", () => {
    expect(inputType(mount("email"))).toBe("email");
    expect(inputType(mount("phone"))).toBe("tel");
    expect(inputType(mount("personnummer"))).toBe("text");
    expect(inputType(mount(""))).toBe("text");
  });
});

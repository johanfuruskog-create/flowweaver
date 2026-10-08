import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";
import "../../../editor/components/guide-editor/guide-editor";

import type { GuidePreview } from "./guide-preview";
import type { GuideEditor } from "../../../editor/components/guide-editor/guide-editor";
import type { GraphData } from "../../types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

const GRAPH: GraphData = {
  startNodeId: "q1",
  nodes: [
    {
      id: "q1",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: "Har du fyllt 18 år?",
        variableName: "isAdult",
        options: [
          { id: "yes", label: "Ja", value: "yes" },
          { id: "no", label: "Nej", value: "no" },
        ],
      },
    },
    { id: "ok", type: "result", position: { x: 0, y: 0 }, data: { title: "Du kan gå vidare" } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "q1", portId: "yes" }, to: { nodeId: "ok", portId: "input" } },
  ],
};

/**
 * Mimics the state before upgrade: a property set while the element was still
 * an unknown element. After registration the value remains as an OWN property on
 * the instance, shadowing the prototype's setter. A genuinely un-upgraded
 * element cannot be created here — the classes are already registered by the
 * imports above — so the own property is set directly, which gives the same
 * state.
 */
function setBeforeUpgrade(element: HTMLElement, name: string, value: unknown): void {
  Object.defineProperty(element, name, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

describe("properties set before upgrade", () => {
  // This is the fault that hits the script-tag route: the page sets .graph
  // before the bundle has loaded. Without the guard the surface goes blank, with
  // no error at all.
  test("the viewer renders a graph set before the upgrade", () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    setBeforeUpgrade(preview, "graph", GRAPH);

    document.body.append(preview);

    expect(preview.shadowRoot?.textContent).toContain("Har du fyllt 18 år?");
  });

  test("the viewer keeps the property as a real accessor afterwards", () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    setBeforeUpgrade(preview, "graph", GRAPH);
    document.body.append(preview);

    // The own property must be gone, otherwise it shadows the setter next time.
    expect(Object.prototype.hasOwnProperty.call(preview, "graph")).toBe(false);
    expect(preview.graph?.startNodeId).toBe("q1");
  });

  test("the editor renders a graph set before the upgrade", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    setBeforeUpgrade(editor, "graph", GRAPH);

    document.body.append(editor);

    expect(Object.prototype.hasOwnProperty.call(editor, "graph")).toBe(false);
    expect(editor.graph.startNodeId).toBe("q1");
  });

  // `editor.featureLevel === "basic"` alone will not do: the own property
  // answers with the right value even when the setter never ran. That it is
  // GONE is what separates a working upgrade from an apparent one.
  test("the editor's feature level goes through the setter at upgrade", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    setBeforeUpgrade(editor, "featureLevel", "basic");

    document.body.append(editor);

    expect(Object.prototype.hasOwnProperty.call(editor, "featureLevel")).toBe(false);
    expect(editor.featureLevel).toBe("basic");
  });
});

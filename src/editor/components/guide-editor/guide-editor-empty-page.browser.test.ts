import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import { getNodeType } from "../../../viewer/node-types/node-type-registry";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

function graf(medFält = false): GraphData {
  return {
    startNodeId: "sida",
    nodes: [
      {
        id: "sida",
        type: "page",
        position: { x: 0, y: 0 },
        data: { title: "Dina uppgifter" },
      },
      ...(medFält
        ? [
            {
              id: "f1",
              type: "text-question",
              position: { x: 0, y: 0 },
              parentPageId: "sida",
              order: 0,
              data: { title: "Ditt namn", variableName: "namn" },
            },
          ]
        : []),
    ],
    connections: [],
  };
}

function montera(data: GraphData): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1100px; height: 700px;";
  document.body.append(editor);
  editor.graph = data;
  return editor;
}

function anvisning(editor: GuideEditor): HTMLElement | null {
  return (
    editor.shadowRoot
      ?.querySelector("node-editor")
      ?.shadowRoot?.querySelector<HTMLElement>(".node-editor__page-empty") ?? null
  );
}

describe("a page starts empty", () => {
  // Two text fields used to be created for the editor, "Första frågan" and
  // "Andra frågan". They could not be removed and vanished silently as soon as
  // they dragged in a field of their own.
  test("a new page has no fields", () => {
    const data = getNodeType("page")?.createData() ?? {};

    expect("firstLabel" in data).toBe(false);
    expect("firstVariableName" in data).toBe(false);
    expect("secondLabel" in data).toBe(false);
    expect("secondVariableName" in data).toBe(false);
  });

  test("the page keeps its heading, description and button text", () => {
    const data = getNodeType("page")?.createData() ?? {};

    expect(data).toHaveProperty("title");
    expect(data).toHaveProperty("description");
    expect(data).toHaveProperty("continueLabel");
  });

  // An instruction is not content: it costs nothing to ignore, while a
  // pre-created field has to be removed.
  test("an empty page shows an instruction rather than a blank area", () => {
    const editor = montera(graf());

    expect(anvisning(editor)?.textContent?.trim()).toBe(
      "Dra hit ett fält från paletten",
    );
  });

  test("the instruction disappears once the page has a field", () => {
    const editor = montera(graf(true));

    expect(anvisning(editor)).toBeNull();
  });

  test("anvisningen hamnar aldrig i grafen", () => {
    const editor = montera(graf());

    const sida = editor.getData().nodes.find((node) => node.id === "sida");

    expect(JSON.stringify(sida?.data)).not.toContain("Dra hit");
  });

  // The instruction belongs to the editor. A resident must never see it.
  test("visaren visar ingen anvisning", async () => {
    const { GuidePreview } = await import("../../../viewer/components/guide-preview/guide-preview");
    void GuidePreview;

    const preview = document.createElement("guide-preview") as HTMLElement & {
      graph: GraphData;
    };
    document.body.append(preview);
    preview.graph = graf();

    const text = preview.shadowRoot?.textContent ?? "";

    expect(text).not.toContain("Dra hit");
    expect(preview.shadowRoot?.querySelector(".node-editor__page-empty")).toBeNull();
    // Vad en fältlös sida faktiskt visar: rubriken och vägen vidare.
    expect(text).toContain("Dina uppgifter");
  });

  test("it receives no pointer, so it does not obscure the drop area", () => {
    const editor = montera(graf());
    const element = anvisning(editor);

    expect(element && getComputedStyle(element).pointerEvents).toBe("none");
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

function graf(): GraphData {
  return {
    startNodeId: "q1",
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: "Är du folkbokförd?",
          variableName: "folkbokford",
          options: [
            { id: "ja", label: "Ja", value: "ja" },
            { id: "nej", label: "Nej", value: "nej" },
          ],
        },
      },
      { id: "r1", type: "result", position: { x: 400, y: 0 }, data: { title: "Ja-svar" } },
      { id: "r2", type: "result", position: { x: 400, y: 300 }, data: { title: "Nej-svar" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "r1", portId: "input" } },
      { id: "c2", from: { nodeId: "q1", portId: "nej" }, to: { nodeId: "r2", portId: "input" } },
    ],
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

/** The node element itself, whatever else is asked of it. */
function nodeElement(editor: GuideEditor, nodeId: string): HTMLElement | null {
  return [
    ...(editor.shadowRoot
      ?.querySelector("node-editor")
      ?.shadowRoot?.querySelectorAll<HTMLElement>("flow-node") ?? []),
  ].find(
    (candidate) => (candidate as { nodeData?: { id: string } }).nodeData?.id === nodeId,
  ) ?? null;
}

/** Märkningen som sitter på noden själv. */
function marking(editor: GuideEditor, nodeId: string): HTMLElement | null {
  const nod = [
    ...(editor.shadowRoot
      ?.querySelector("node-editor")
      ?.shadowRoot?.querySelectorAll("flow-node") ?? []),
  ].find(
    (kandidat) => (kandidat as { nodeData?: { id: string } }).nodeData?.id === nodeId,
  );

  return nod?.shadowRoot?.querySelector<HTMLElement>(".flow-node__health") ?? null;
}

/** The severity of the minimap's dot for a node, if there is one. */
function kartprickar(editor: GuideEditor): string[] {
  return [
    ...(editor.shadowRoot
      ?.querySelector("node-editor")
      ?.shadowRoot?.querySelectorAll<HTMLElement>(
        ".node-editor__minimap-node[data-severity]",
      ) ?? []),
  ].map((prick) => prick.dataset.severity ?? "");
}

describe("problems are marked where they sit", () => {
  // The problem has a place: it sits by a question on a surface. A list is a
  // detour taken because you otherwise cannot see where something is.
  test("a node with an error gets a marking", () => {
    const data = graf();
    data.connections = data.connections.filter((c) => c.id !== "c2");
    const editor = montera(data);

    const badge = marking(editor, "q1");

    expect(badge).not.toBeNull();
    expect(badge?.dataset.severity).toBe("error");
  });

  /*
   * The reason is spelled out, and colour is not the only thing carrying it —
   * K3 in docs/KRAV.md. It used to be a band of text in the card; now it is the
   * marking's own name and the node's, so it survives for anyone not looking at
   * the screen.
   */
  test("the marking says what is wrong, not just that something is", () => {
    const data = graf();
    data.connections = data.connections.filter((c) => c.id !== "c2");
    const editor = montera(data);

    const label = marking(editor, "q1")?.getAttribute("aria-label") ?? "";

    expect(label.length).toBeGreaterThan(10);
    expect(marking(editor, "q1")?.getAttribute("title")).toBe(label);

    // And the node itself says it, so a screen reader hears it on arrival.
    const spoken = nodeElement(editor, "q1")
      ?.shadowRoot?.querySelector(".flow-node")
      ?.getAttribute("aria-label") ?? "";

    expect(spoken).toContain(label);
  });

  /*
   * The whole reason the band went. A band of text made the node taller —
   * measured, 213 px became 232 — which moved its ports away from connections
   * that had already been drawn to them. A marking of a fixed size in the header
   * cannot do that.
   */
  test("and does not change how tall the node is", async () => {
    const whole = montera(graf());
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const before = nodeElement(whole, "q1")?.getBoundingClientRect().height;

    const broken = graf();
    broken.connections = broken.connections.filter((c) => c.id !== "c2");
    const editor = montera(broken);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    expect(marking(editor, "q1")).not.toBeNull();
    expect(nodeElement(editor, "q1")?.getBoundingClientRect().height).toBe(before);
  });

  test("a warning is marked as a warning", () => {
    const data = graf();
    data.nodes.push({
      id: "r3",
      type: "result",
      position: { x: 800, y: 500 },
      data: { title: "Bortglömt" },
    });
    const editor = montera(data);

    expect(marking(editor, "r3")?.dataset.severity).toBe("warning");
    expect((marking(editor, "r3")?.getAttribute("aria-label") ?? "").length)
      .toBeGreaterThan(10);
  });

  test("nodes without problems get no marking", () => {
    const editor = montera(graf());

    expect(marking(editor, "q1")).toBeNull();
    expect(marking(editor, "r1")).toBeNull();
  });

  test("the marking disappears when the problem is fixed", () => {
    const trasig = graf();
    trasig.connections = trasig.connections.filter((c) => c.id !== "c2");
    const editor = montera(trasig);

    expect(marking(editor, "q1")).not.toBeNull();

    editor.graph = graf();

    expect(marking(editor, "q1")).toBeNull();
  });

  // The map exists for what lies off screen. A problem there does not show on
  // the node, because the node does not show.
  test("the minimap's dots carry the same severity", () => {
    const data = graf();
    // Spread the nodes out so the content does not fit and the map shows.
    data.nodes[1].position = { x: 2400, y: 0 };
    data.nodes[2].position = { x: 2400, y: 1600 };
    data.connections = data.connections.filter((c) => c.id !== "c2");

    const editor = montera(data);

    expect(kartprickar(editor)).toContain("error");
  });
});

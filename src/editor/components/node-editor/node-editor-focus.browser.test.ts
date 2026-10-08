import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./node-editor";

import type { NodeEditor } from "./node-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Selecting a node changes nothing about the other connections.
 *
 * ## What this file used to assert
 *
 * The opposite. Selecting a node lifted its own connections out of the tangle by
 * dropping every other one to `opacity: 0.32`, and this file checked which ids
 * ended up dimmed.
 *
 * It was removed, and the reason is worth keeping. Johan hit it twice in one
 * day. The first time he could not reproduce it at all — clicking a node's title
 * bar does not select, so nothing dimmed and the effect looked imaginary. The
 * second time it arrived uninvited: after putting away a shown route, some lines
 * stayed faint, and the obvious reading was that the route had not cleared
 * properly. Measured, it had; the right-click that opened the menu had selected
 * the node, and the selection dimming was what remained.
 *
 * Three dimmings that look alike — 0.2 for a connection off the shown route,
 * 0.28 for a node off it, 0.32 for "does not touch what is selected" — and only
 * two of them were asked for. "Show the routes here" now answers the question
 * this was reaching for, on request and with a better answer, so the implicit
 * one is gone.
 *
 * ## What is asserted now
 *
 * That selection is quiet. The route highlight has its own tests; this one
 * exists so nobody reintroduces a dimming nobody asked for.
 */

afterEach(() => {
  document.body.replaceChildren();
});

function graph(): GraphData {
  return {
    startNodeId: "q1",
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: "Fråga 1",
          variableName: "a",
          options: [{ id: "q1-ja", label: "Ja", value: "ja" }],
        },
      },
      {
        id: "q2",
        type: "question",
        position: { x: 0, y: 200 },
        data: {
          title: "Fråga 2",
          variableName: "b",
          options: [{ id: "q2-ja", label: "Ja", value: "ja" }],
        },
      },
      { id: "r1", type: "result", position: { x: 400, y: 0 }, data: { title: "Ett" } },
      { id: "r2", type: "result", position: { x: 400, y: 200 }, data: { title: "Två" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "q1-ja" }, to: { nodeId: "r1", portId: "input" } },
      { id: "c2", from: { nodeId: "q2", portId: "q2-ja" }, to: { nodeId: "r2", portId: "input" } },
    ],
  } as unknown as GraphData;
}

function mount(): NodeEditor {
  const editor = document.createElement("node-editor") as NodeEditor;

  editor.editorMode = "administrator";
  editor.style.cssText = "display: block; width: 900px; height: 600px;";
  document.body.append(editor);
  editor.graph = graph();
  return editor;
}

/** Every drawn connection's opacity, by id. */
function opacities(editor: NodeEditor): Record<string, number> {
  return Object.fromEntries(
    [...(editor.shadowRoot?.querySelectorAll<SVGPathElement>("path[data-connection-id]") ?? [])]
      .filter((path) => !path.getAttribute("class")?.includes("hit"))
      .map((path) => [
        path.dataset.connectionId ?? "?",
        Number(getComputedStyle(path).opacity),
      ]),
  );
}

describe("selecting a node", () => {
  test("leaves every connection at full strength", () => {
    const editor = mount();

    editor.selectNodeById("q1");

    // c2 touches neither end of q1, and used to drop to 0.32 for that reason.
    expect(opacities(editor)).toEqual({ c1: 1, c2: 1 });
  });

  test("and so does selecting a node with no connections of its own", () => {
    const editor = mount();

    editor.selectNodeById("r2");

    expect(opacities(editor)).toEqual({ c1: 1, c2: 1 });
  });

  test("while an asked-for route still dims what is not on it", () => {
    const editor = mount();

    // The one dimming that remains is the one somebody asked for.
    editor.highlightConnections(["c1"]);

    const seen = opacities(editor);
    expect(seen.c1).toBe(1);
    expect(seen.c2).toBeLessThan(0.5);
  });
});

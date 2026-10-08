import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * What a guide contains that this level cannot offer.
 *
 * ## Why a host needs to be told
 *
 * The editor already refuses gracefully. A node whose type is above the level
 * still draws, keeps its data, works for a visitor, and says so in the panel
 * when somebody selects it. What it could not do was say it about a guide as a
 * whole — so importing one quietly produced a canvas carrying things the
 * palette could not make, and the only way to find out was to click each node.
 *
 * The Sitevision module asks, on import: *the guide uses these types, raise the
 * level?* That question cannot be asked without this answer.
 *
 * ## Why type names and not a count
 *
 * *Two node types are not included: Uträkning, Serveranrop* is a sentence
 * somebody can answer. *Some are missing* is not.
 *
 * ## Why it takes a graph
 *
 * The interesting moment is before the graph is set. A host deciding whether to
 * widen has not imported anything yet, and setting it first to ask about it
 * afterwards is the wrong order — the answer would arrive after the thing it
 * was about.
 */

const guide = (types: string[]): GraphData =>
  ({
    startNodeId: "n0",
    nodes: types.map((type, at) => ({
      id: `n${at}`,
      type,
      position: { x: at * 320, y: 0 },
      data: { title: { sv: type } },
    })),
    connections: [],
  }) as unknown as GraphData;

function mount(level: string): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", level);
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);
  return editor;
}

const asked = (editor: GuideEditor, graph: GraphData): string[] =>
  (
    editor as unknown as { unsupportedNodeTypes(g?: GraphData): string[] }
  ).unsupportedNodeTypes(graph);

afterEach(() => document.body.replaceChildren());

describe("what a level cannot offer", () => {
  test("names the types a basic editor has no place for", () => {
    const missing = asked(
      mount("basic"),
      guide(["question", "calculation", "service-call"])
    );

    expect(missing.sort()).toEqual(["calculation", "service-call"]);
  });

  test("and says nothing when the level covers the guide", () => {
    expect(
      asked(mount("service"), guide(["question", "calculation", "service-call"]))
    ).toEqual([]);
  });

  test("counts a type once however often it appears", () => {
    // The host puts these in a sentence. "Uträkning, Uträkning, Uträkning" is
    // not a better sentence than "Uträkning".
    expect(
      asked(mount("basic"), guide(["calculation", "calculation", "question"]))
    ).toEqual(["calculation"]);
  });

  test("answers about a graph it has never been given", () => {
    const editor = mount("basic");

    /*
     * Nothing was set on the editor. This is the case the module actually uses:
     * asking whether to widen *before* importing, so the question arrives
     * before the thing it is about rather than after.
     */
    expect(asked(editor, guide(["service-call"]))).toEqual(["service-call"]);
    expect((editor as unknown as { getData(): GraphData }).getData().nodes)
      .toHaveLength(0);
  });
});

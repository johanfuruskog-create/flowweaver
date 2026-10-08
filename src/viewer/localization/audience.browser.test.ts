import { describe, expect, test, vi } from "vitest";

/**
 * A text a resident reads is a viewer key — story 017, criterion 2, measured.
 *
 * ## Why a gate and not a review
 *
 * `guide-preview` renders two different things. One is the resident's guide.
 * The other is the thumbnail inside each node on the editor's canvas, drawn
 * when the `compact` attribute is set — and `<guide-preview compact>` appears
 * in exactly one place in the whole codebase, `guide-editor.ts`.
 *
 * Both call the same `chrome()`, so which table a key belongs in depends on
 * which branch asks for it, and nothing in the name says which. The prefix is
 * the component, not the audience. I got that boundary wrong twice in one hour:
 * first by leaving `canvas.unnamedNode` (now `step.untitled`) in the editor's table, where an
 * untitled step showed "Namnlös nod" in an Arabic guide with no way to fix it,
 * and then by moving `canvas.unnamedField` out of it, which only the canvas
 * ever asks for. All 1220 tests passed both times.
 *
 * ## What it measures
 *
 * Every node type, rendered the way a resident meets it — no `compact` — with
 * the lookup instrumented. Every key that render asks for must live in
 * `VIEWER_STRINGS`. An editor key on that path is a text the guide cannot
 * translate and the resident cannot avoid.
 *
 * The gate cannot see the other direction: a viewer key only the canvas asks
 * for is a wasted line on a translator's list, not a text nobody owns. That one
 * still needs eyes.
 */

declare global {
  interface Window {
    __askedKeys: Set<string>;
  }
}
window.__askedKeys = new Set<string>();

vi.mock("../core/ui-strings", async () => {
  const real =
    await vi.importActual<typeof import("../core/ui-strings")>(
      "../core/ui-strings",
    );
  return {
    ...real,
    t: (key: string, locale?: string) => {
      window.__askedKeys.add(key);
      return real.t(key, locale);
    },
    uiText: (key: string, strings: never, locale?: string) => {
      window.__askedKeys.add(key);
      return real.uiText(key, strings, locale);
    },
  };
});

import "../node-types/default-node-types";
import "../components/guide-preview/guide-preview";

import { getNodeTypes } from "../node-types/node-type-registry";
import { VIEWER_STRINGS } from "./built-in-strings";

import type { GuidePreview } from "../components/guide-preview/guide-preview";
import type { FlowNodeData, GraphData } from "../types/graph";

/**
 * A node of the given type, filled out enough to render but left untitled on
 * purpose: the untitled fallbacks are exactly the keys that went astray.
 */
function nodeOfType(type: string): FlowNodeData {
  return {
    id: `n-${type}`,
    type,
    position: { x: 0, y: 0 },
    data: {
      variableName: "svar",
      options: [{ id: "a", label: { sv: "Ja" }, value: "ja" }],
      comments: [{ text: { sv: "Kommentar" }, x: 10, y: 10 }],
      cases: [{ id: "c", label: "Fall", match: "all", conditions: [] }],
      assignments: [{ variableName: "x", formula: "1" }],
    },
  } as unknown as FlowNodeData;
}

/** Renders one node the way a resident meets it and returns the keys asked. */
async function keysAskedFor(node: FlowNodeData): Promise<string[]> {
  window.__askedKeys.clear();

  const graph: GraphData = {
    startNodeId: node.id,
    nodes: [node],
    connections: [],
    settings: {},
  } as unknown as GraphData;

  const element = document.createElement("guide-preview") as GuidePreview;
  element.style.height = "600px";
  document.body.append(element);
  element.graph = graph;
  await new Promise((resolve) => setTimeout(resolve, 120));
  element.remove();

  return [...window.__askedKeys];
}

describe("every text a resident can read is the guide's to translate", () => {
  const types = getNodeTypes().map((entry) => entry.type);

  test("the registry has node types to render, so an empty sweep cannot pass", () => {
    expect(types.length).toBeGreaterThan(10);
  });

  test.each(types)("%s asks only for viewer keys", async (type) => {
    const asked = await keysAskedFor(nodeOfType(type));
    const editorKeys = asked.filter(
      (key) => !Object.prototype.hasOwnProperty.call(VIEWER_STRINGS, key),
    );

    expect(editorKeys).toEqual([]);
  });

  // Without this the sweep above could pass by rendering nothing at all, which
  // is how the direction test in properties-panel stayed green while measuring
  // an empty page.
  test("and the sweep actually rendered something", async () => {
    const asked = await keysAskedFor(nodeOfType("question"));

    expect(asked).toContain("nav.next");
  });
});

describe("the gate reports a key in the wrong table", () => {
  /*
   * The fault it exists for, stated directly: `canvas.unnamedField` is the
   * editor's, so a render that asked for it would fail the sweep above.
   */
  test("an editor key would not pass the filter", () => {
    const asked = ["nav.next", "canvas.unnamedField"];

    expect(
      asked.filter(
        (key) => !Object.prototype.hasOwnProperty.call(VIEWER_STRINGS, key),
      ),
    ).toEqual(["canvas.unnamedField"]);
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { FlowNode } from "./flow-node";
import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * The start marker is a glyph, and the header holds one line.
 *
 * "Start · " as text ate ~50px of a header that also carries a grip, up to
 * two markers and a menu button — and with `overflow-wrap: anywhere` the type
 * label then broke MID-WORD ("Res-ult" in the translation film's poster,
 * Johan's eye). A ▶ glyph was tried and said too little (Johan again), so the
 * word is back but moved OFF the row: a small "Start" badge on the card's
 * shoulder. The header label itself is a label, not prose: one line, ellipsis
 * under pressure. Nothing is lost for a screen reader; the full name lives in
 * the node's aria-label.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));

async function canvas(): Promise<NodeEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1000px; height: 700px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "multi-choice", position: { x: 80, y: 80 }, data: { title: "Ett", variableName: "a", options: [] } },
      { id: "q2", type: "text-question", position: { x: 480, y: 80 }, data: { title: "Två", variableName: "b" } },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

  if (!nodeEditor) throw new Error("node-editor saknas.");

  return nodeEditor;
}

const partsOf = (nodeEditor: NodeEditor, id: string): ShadowRoot =>
  Array.from(nodeEditor.shadowRoot!.querySelectorAll<FlowNode>("flow-node"))
    .find((node) => node.nodeData?.id === id)!
    .shadowRoot!;

describe("the start node's marker", () => {
  test("is a badge on the card's shoulder, outside the header row", async () => {
    const parts = partsOf(await canvas(), "q1");
    const flag = parts.querySelector(".flow-node__start-flag")!;
    const header = parts.querySelector(".flow-node__header")!;

    expect(flag).toBeTruthy();
    expect(flag.textContent).toBe("Start");
    // Raden bär redan grip, markörer och meny — fliken trängs inte där.
    expect(header.contains(flag)).toBe(false);
    expect(header.textContent).not.toContain("Start");
  });

  test("is decoration — the node's own name already says it", async () => {
    const parts = partsOf(await canvas(), "q1");
    const flag = parts.querySelector(".flow-node__start-flag")!;

    expect(flag.getAttribute("aria-hidden")).toBe("true");
    expect(parts.querySelector(".flow-node")!.getAttribute("aria-label")).toContain("Startnod");
  });

  test("lets the drag grip through — the badge overlaps the header's edge", async () => {
    // Johans fråga: "så länge det inte är i vägen för handtaget". Fliken
    // ligger över huvudets överkant, så den måste släppa igenom pekaren —
    // annars är precis den remsan död för dragning.
    const parts = partsOf(await canvas(), "q1");
    const flag = parts.querySelector<HTMLElement>(".flow-node__start-flag")!;

    expect(getComputedStyle(flag).pointerEvents).toBe("none");
  });

  test("does not appear on other nodes", async () => {
    const parts = partsOf(await canvas(), "q2");

    expect(parts.querySelector(".flow-node__start-flag")).toBeNull();
  });
});

describe("the header label", () => {
  test("holds one line and clips with an ellipsis instead of wrapping", async () => {
    const text = partsOf(await canvas(), "q1")
      .querySelector<HTMLElement>(".flow-node__header-text")!;
    const style = getComputedStyle(text);

    expect(style.whiteSpace).toBe("nowrap");
    expect(style.textOverflow).toBe("ellipsis");
  });
});

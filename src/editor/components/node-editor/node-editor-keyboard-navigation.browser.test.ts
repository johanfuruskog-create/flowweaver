import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";
import type { FlowNode } from "../flow-node/flow-node";

/**
 * Getting around the canvas without a pointer.
 *
 * ## The gap this fills
 *
 * Nodes were focusable and Enter selected them, but there was no way to move
 * between them: reaching the fourth node meant four tab stops through
 * everything in between, and creating a connection was pointer-only. For a tool
 * that claims EN 301 549 that is the largest hole there is.
 *
 * ## Why an arrow means two things
 *
 * The editor keeps focus and selection apart — a node can hold focus without
 * being picked up — so the state answers what an arrow is for. Looking around,
 * it moves focus, the way it does in any list. Holding a node, it moves the
 * node, the way it does in any drawing tool. Neither needs a modifier to
 * remember, and the difference is visible: a selected node has its ring, and
 * `aria-selected` says so out loud.
 *
 * ## What is asserted
 *
 * Not that a key was handled — that passes on a handler that does the wrong
 * thing. Which node ends up with focus, and whether the graph moved.
 */

afterEach(() => document.body.replaceChildren());

/*
 * A cross, so "nearest in that direction" has something to be wrong about. The
 * middle node has a neighbour each way, and one sitting diagonally that must
 * not win a straight press.
 */
const guide = (): GraphData =>
  ({
    startNodeId: "mitten",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "mitten", type: "question", position: { x: 400, y: 400 }, data: { title: { sv: "Mitten" } } },
      { id: "hoger", type: "result", position: { x: 800, y: 400 }, data: { title: { sv: "Höger" } } },
      { id: "vanster", type: "result", position: { x: 0, y: 400 }, data: { title: { sv: "Vänster" } } },
      { id: "under", type: "result", position: { x: 400, y: 800 }, data: { title: { sv: "Under" } } },
      { id: "snett", type: "result", position: { x: 640, y: 160 }, data: { title: { sv: "Snett" } } },
    ],
    connections: [],
  }) as unknown as GraphData;

const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ),
  );

async function mount(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", "basic");
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);

  editor.graph = guide();
  await settle();
  await settle();

  return editor;
}

const nodeElement = (editor: GuideEditor, id: string): FlowNode | null =>
  [
    ...(editor.shadowRoot
      ?.querySelector("node-editor")
      ?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []),
  ].find((one) => (one as { nodeData?: { id: string } }).nodeData?.id === id) ?? null;

/** The id of whatever holds focus, reaching through the shadow boundaries. */
function focusedId(): string | null {
  let active: Element | null = document.activeElement;

  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }

  /*
   * `closest()` stops at a shadow boundary, so the focused `.flow-node` never
   * finds its own host that way. The root's host is what does.
   */
  const host = (active?.getRootNode() as ShadowRoot | null)?.host ?? active;
  return (host as { nodeData?: { id: string } } | null)?.nodeData?.id ?? null;
}

const press = (target: HTMLElement, key: string, options: KeyboardEventInit = {}) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, composed: true, ...options }),
  );

describe("moving around the canvas with the arrows", () => {
  test("takes focus to the nearest node that way", async () => {
    const editor = await mount();
    const middle = nodeElement(editor, "mitten");

    middle?.focus();
    press(middle!.shadowRoot!.querySelector<HTMLElement>(".flow-node")!, "ArrowRight");
    await settle();

    expect(focusedId()).toBe("hoger");
  });

  test("prefers straight ahead over a nearer node off to the side", async () => {
    const editor = await mount();
    const middle = nodeElement(editor, "mitten");

    // "snett" is closer as the crow flies than "hoger", and must still lose.
    middle?.focus();
    press(middle!.shadowRoot!.querySelector<HTMLElement>(".flow-node")!, "ArrowRight");
    await settle();

    expect(focusedId()).toBe("hoger");
  });

  test("does not move the node it came from", async () => {
    const editor = await mount();
    const before = editor.getData().nodes.find((node) => node.id === "mitten")?.position;
    const middle = nodeElement(editor, "mitten");

    middle?.focus();
    press(middle!.shadowRoot!.querySelector<HTMLElement>(".flow-node")!, "ArrowDown");
    await settle();

    const after = editor.getData().nodes.find((node) => node.id === "mitten")?.position;

    expect(after).toEqual(before);
  });
});

describe("a node that has been picked up", () => {
  test("moves instead of handing the focus on", async () => {
    const editor = await mount();
    const middle = nodeElement(editor, "mitten");
    const inner = middle!.shadowRoot!.querySelector<HTMLElement>(".flow-node")!;

    middle?.focus();
    press(inner, "Enter");
    await settle();

    const before = editor.getData().nodes.find((node) => node.id === "mitten")?.position;

    press(inner, "ArrowDown");
    await settle();

    const after = editor.getData().nodes.find((node) => node.id === "mitten")?.position;

    expect(after?.y).toBe((before?.y ?? 0) + 10);
    expect(focusedId()).toBe("mitten");
  });
});

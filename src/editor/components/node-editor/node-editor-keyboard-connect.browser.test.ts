import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";
import type { FlowNode } from "../flow-node/flow-node";

/**
 * Making a connection without a pointer.
 *
 * ## The gesture
 *
 * With a mouse a connection is one drag: press on an output, let go on an
 * input. With a keyboard it is the same gesture in two presses — Enter on the
 * output, Enter on the input — and the canvas holds the half-made connection in
 * between. Escape puts it down.
 *
 * Nothing new to learn, which is the point: the same mental model, reached a
 * different way.
 *
 * ## Why the announcements are asserted
 *
 * A half-made connection is a *mode*, and a mode nobody can tell they are in is
 * worse than no support at all. The marking on the port says it to whoever can
 * see it; the live region says it to everybody else. A test that only checked
 * the graph would pass on a version that connects correctly and says nothing,
 * which is the version that is unusable.
 *
 * A refusal is asserted for the same reason. `createConnection` declines
 * silently when the graph will not take a connection — fine for a drag that
 * simply does not land, useless for a keypress.
 */

afterEach(() => document.body.replaceChildren());

const guide = (): GraphData =>
  ({
    startNodeId: "fraga",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "fraga",
        type: "question",
        position: { x: 100, y: 100 },
        data: {
          title: { sv: "Har du tandvärk?" },
          options: [
            { id: "ja", label: { sv: "Ja" }, value: "ja" },
            { id: "nej", label: { sv: "Nej" }, value: "nej" },
          ],
        },
      },
      { id: "tand", type: "result", position: { x: 600, y: 60 }, data: { title: { sv: "Tandläkaren" } } },
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

const canvasRoot = (editor: GuideEditor): ShadowRoot =>
  editor.shadowRoot!.querySelector("node-editor")!.shadowRoot!;

const nodeElement = (editor: GuideEditor, id: string): FlowNode =>
  [...canvasRoot(editor).querySelectorAll<FlowNode>("flow-node")].find(
    (one) => (one as unknown as { nodeId: string }).nodeId === id,
  )!;

const port = (editor: GuideEditor, nodeId: string, portId: string): HTMLButtonElement =>
  nodeElement(editor, nodeId).shadowRoot!.querySelector<HTMLButtonElement>(
    `[data-port-id="${portId}"]`,
  )!;

const said = (editor: GuideEditor): string =>
  canvasRoot(editor).querySelector("[data-announce]")?.textContent?.trim() ?? "";

const press = (target: HTMLElement, key: string) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, composed: true }),
  );

/** The live region clears itself before speaking, so give it that moment. */
const heard = () => new Promise<void>((resolve) => setTimeout(resolve, 60));

describe("connecting two nodes with the keyboard", () => {
  test("Enter on an output picks it up and says so", async () => {
    const editor = await mount();

    press(port(editor, "fraga", "ja"), "Enter");
    await heard();

    expect(port(editor, "fraga", "ja").hasAttribute("data-pending")).toBe(true);
    expect(said(editor)).toContain("Kopplar från");
  });

  test("Enter on an input completes it and names both ends", async () => {
    const editor = await mount();

    press(port(editor, "fraga", "ja"), "Enter");
    press(port(editor, "tand", "input"), "Enter");
    await heard();
    await settle();

    const connections = editor.getData().connections;

    expect(connections).toHaveLength(1);
    expect(connections[0]?.from).toEqual({ nodeId: "fraga", portId: "ja" });
    expect(connections[0]?.to).toEqual({ nodeId: "tand", portId: "input" });
    // The node's name, not the port's — "kopplad till Ingång" says nothing.
    expect(said(editor)).toContain("kopplad till");
    expect(said(editor)).toContain("Tandläkaren");
    expect(port(editor, "fraga", "ja").hasAttribute("data-pending")).toBe(false);
  });

  /**
   * The input's node re-renders when the connection lands — its health text
   * changes — and the button that had focus is replaced. Focus then fell to
   * `body`, and the next key went nowhere. Measured in film 5
   * (`e2e/demo/no-mouse.mjs`, 7/9): `?` after Enter opened nothing.
   */
  test("focus stays on the input once the connection is made", async () => {
    const editor = await mount();

    port(editor, "fraga", "ja").focus();
    press(port(editor, "fraga", "ja"), "Enter");
    port(editor, "tand", "input").focus();
    press(port(editor, "tand", "input"), "Enter");
    await settle();

    expect(editor.getData().connections).toHaveLength(1);
    expect(nodeElement(editor, "tand").shadowRoot!.activeElement).toBe(
      port(editor, "tand", "input"),
    );
  });

  test("Escape puts it down again and leaves the guide alone", async () => {
    const editor = await mount();

    press(port(editor, "fraga", "ja"), "Enter");
    press(canvasRoot(editor).querySelector<HTMLElement>(".node-editor__viewport")!, "Escape");
    await heard();

    expect(editor.getData().connections).toHaveLength(0);
    expect(port(editor, "fraga", "ja").hasAttribute("data-pending")).toBe(false);
    expect(said(editor)).toContain("avbruten");
  });

  test("a refused connection says so rather than failing quietly", async () => {
    const editor = await mount();

    // The same pair twice: the second is declined by the graph.
    press(port(editor, "fraga", "ja"), "Enter");
    press(port(editor, "tand", "input"), "Enter");
    await settle();

    press(port(editor, "fraga", "ja"), "Enter");
    press(port(editor, "tand", "input"), "Enter");
    await heard();
    await settle();

    expect(editor.getData().connections).toHaveLength(1);
    expect(said(editor)).toContain("Går inte");
  });
});

import { afterEach, describe, expect, test } from "vitest";
import "../../../viewer/node-types/default-node-types";
import "../node-editor/node-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import type { FlowNode } from "./flow-node";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * A node of a type this editor does not know — a guide built with FlowWeaver
 * PRO opened in the open editor, say (open-core step 4). The card keeps the
 * node and says what is missing; its title is the editor's title, in the
 * guide's language, never the object printed raw. Seen as "[object Object]"
 * on the first screenshot of the split, 6/10.
 */
afterEach(() => document.body.replaceChildren());
const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("en nod av okänd typ", () => {
  test("kortet visar rubriken på guidens språk och säger vilken typ som saknas", async () => {
    const editor = document.createElement("node-editor") as NodeEditor;
    editor.editorMode = "administrator";
    editor.style.cssText = "display: block; width: 1200px; height: 700px;";
    document.body.append(editor);
    editor.graph = {
      version: 8,
      startNodeId: "slut",
      nodes: [{ id: "slut", type: "submit-result", position: { x: 0, y: 0 }, data: { title: { sv: "Tack för din anmälan", en: "Thank you" } } }],
      connections: [],
    } as unknown as GraphData;
    await settle();
    const card = editor.shadowRoot!.querySelector<FlowNode>("flow-node")!.shadowRoot!;
    expect(card.querySelector(".flow-node__title")?.textContent?.trim()).toBe("Tack för din anmälan");
    expect(card.textContent).toContain('"submit-result"');
    expect(card.textContent).not.toContain("[object Object]");
  });
});

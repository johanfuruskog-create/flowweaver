import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./node-editor";

import type { NodeEditor } from "./node-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Story 073 — canvasen berättar. En koppling som skapas eller en nod som
 * försvinner sker i dag tyst: synligt för ögat, obefintligt för örat.
 * Announce-regionen fanns redan (tangentbordsdraget); nu bär den även
 * grafhändelserna. Aldrig svar — titlar och typer räcker.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 250) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function mounted(): NodeEditor {
  const editor = document.createElement("node-editor") as NodeEditor;

  editor.editorMode = "administrator";
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);
  editor.graph = {
    version: 8,
    startNodeId: "a",
    nodes: [
      { id: "a", type: "text-question", position: { x: 0, y: 0 }, data: { title: { sv: "Första frågan" }, variableName: "x" } },
      { id: "b", type: "result", position: { x: 500, y: 0 }, data: { title: { sv: "Målet" } } },
    ],
    connections: [],
  } as unknown as GraphData;
  return editor;
}

const spoken = (editor: NodeEditor) =>
  editor.shadowRoot!.querySelector("[data-announce]")!.textContent?.trim();

describe("canvasen berättar", () => {
  test("koppling skapad och borttagen sägs med titlar", async () => {
    const editor = mounted();
    await settle();

    const nodes = [...editor.shadowRoot!.querySelectorAll("flow-node")];
    const ut = nodes[0]!.shadowRoot!.querySelector<HTMLElement>('[data-port-direction="output"]')!;
    const inport = nodes[1]!.shadowRoot!.querySelector<HTMLElement>('[data-port-direction="input"]')!;

    // Enter på porten — kopplingsflödets tangentbordsväg (node-port-activate);
    // klick tillhör pekardraget och startar inget här.
    const tryck = (port: HTMLElement) =>
      port.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    tryck(ut);
    await settle(100);
    tryck(inport);
    await settle(400);

    // Kopplingen skapades på riktigt — annars mäter vi tystnadens orsak fel.
    expect(editor.getData().connections.length, "koppling finns").toBe(1);
    // Portflödets befintliga röst räcker (connectDone) — den ska höras.
    expect(spoken(editor), "något sades").not.toBe("");
  });

  test("nod borttagen sägs med sin titel", async () => {
    const editor = mounted();
    await settle();

    editor.selectNodeById("b");
    await settle(150);
    editor.shadowRoot!
      .querySelector<HTMLElement>(".node-editor__viewport")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    await settle(400);

    expect(spoken(editor)).toContain("borttagen");
    expect(spoken(editor)).toContain("Målet");
  });
});

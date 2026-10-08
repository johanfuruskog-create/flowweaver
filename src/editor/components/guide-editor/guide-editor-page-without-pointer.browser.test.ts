import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * Story 034: building a page without dragging.
 *
 * Measured before anything was built: page membership changed only in the
 * pointer's drop handler, and clicking `Text` (then `Underrubrik`) in the palette created
 * nothing at all — a toast told you to drag instead. Two node types could not
 * exist without a mouse, and no node type could enter a page without one.
 * K3 says nothing may require a pointer, and this hole was bigger than the
 * one the requirement already listed.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Mounted {
  editor: GuideEditor;
  nodeEditor: NodeEditor;
}

async function mounted(pages: Array<{ id: string; title: string }>): Promise<Mounted> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1100px; height: 700px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: pages[0]?.id ?? "standalone",
    nodes: [
      ...pages.map((page, index) => ({
        id: page.id,
        type: "page",
        position: { x: index * 400, y: 0 },
        data: { title: { sv: page.title } },
      })),
      {
        id: "standalone",
        type: "text-question",
        position: { x: 40, y: 300 },
        data: { title: "Fristående fält", variableName: "v" },
      },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  return {
    editor,
    nodeEditor: editor.shadowRoot!.querySelector<NodeEditor>("node-editor")!,
  };
}

// By type, not by label: "Text" is also the start of "Textfråga".
function paletteButton(editor: GuideEditor, type: string): HTMLButtonElement {
  const palette = editor.shadowRoot!.querySelector("node-palette")!;
  const button = palette.shadowRoot!.querySelector<HTMLButtonElement>(`button[data-node-type="${type}"]`);

  if (!button) throw new Error(`Palettknappen ${type} saknas.`);

  return button;
}

function nodeOfType(editor: GuideEditor, type: string) {
  return (editor.getData() as { nodes: Array<{ id: string; type: string; parentPageId?: string }> }).nodes.find(
    (node) => node.type === type,
  );
}

const announcement = (nodeEditor: NodeEditor): string =>
  nodeEditor.shadowRoot!.querySelector("[data-announce]")?.textContent ?? "";

describe("en underrubrik utan pekare", () => {
  test("hamnar i guidens enda sida, med besked", async () => {
    const { editor, nodeEditor } = await mounted([{ id: "p1", title: "Om dig" }]);

    paletteButton(editor, "page-heading").click();
    await settle();

    const created = nodeOfType(editor, "page-heading");

    expect(created, "ingen nod skapades").toBeDefined();
    expect(created?.parentPageId).toBe("p1");
    expect(announcement(nodeEditor)).toContain("Om dig");
  });

  test("låter redaktören välja sida när det finns flera", async () => {
    const { editor } = await mounted([
      { id: "p1", title: "Om dig" },
      { id: "p2", title: "Om felet" },
    ]);

    paletteButton(editor, "page-heading").click();
    await settle();

    // Ett val, inte en position: dialogen listar sidorna vid namn.
    const dialog = editor.shadowRoot!.querySelector("prompt-dialog")!.shadowRoot!;
    const choice = [...dialog.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
      b.textContent?.includes("Om felet"),
    );

    expect(choice, "sidvalet visades inte").toBeDefined();
    choice!.click();
    await settle();

    expect(nodeOfType(editor, "page-heading")?.parentPageId).toBe("p2");
  });

  test("och utan sida erbjuds typen inte alls — frånvaro i stället för uppmaning", async () => {
    const { editor } = await mounted([]);

    // Paletten döljer sid-typerna tills guiden har en sida (dokumenterat i
    // node-palette). Det uppfyller kriteriet bättre än ett besked: det finns
    // inget att trycka på och därmed inget att misslyckas med. Vägen in via
    // eventet är ändå vaktad med ett besked, för den som skickar det själv.
    const palette = editor.shadowRoot!.querySelector("node-palette")!;
    const button = palette.shadowRoot!.querySelector('button[data-node-type="page-heading"]');

    expect(button, "sid-typen erbjöds utan sida").toBeNull();
  });
});

describe("flytta mellan sida och arbetsyta från tangentbordet", () => {
  test("ett fristående fält flyttar in i en vald sida via nodmenyn", async () => {
    const { editor, nodeEditor } = await mounted([
      { id: "p1", title: "Om dig" },
      { id: "p2", title: "Om felet" },
    ]);

    nodeEditor.selectNodeById("standalone");
    (nodeEditor as unknown as { openContextMenuForSelection(): boolean }).openContextMenuForSelection();
    await settle();

    const menu = nodeEditor.shadowRoot!;
    const move = [...menu.querySelectorAll<HTMLButtonElement>("[data-action='move-to-page']")];

    expect(move.length, "en flyttknapp per sida").toBe(2);

    const toSecond = move.find((b) => b.textContent?.includes("Om felet"))!;

    toSecond.click();
    await settle();

    const node = (editor.getData() as { nodes: Array<{ id: string; parentPageId?: string }> }).nodes.find(
      (n) => n.id === "standalone",
    );

    expect(node?.parentPageId).toBe("p2");
    expect(announcement(nodeEditor)).toContain("Om felet");
  });

  test("ett fält i en sida lyfts ut till arbetsytan", async () => {
    const { editor, nodeEditor } = await mounted([{ id: "p1", title: "Om dig" }]);

    // Lägg först in fältet i sidan, sedan lyft ut det — båda utan pekare.
    nodeEditor.selectNodeById("standalone");
    (nodeEditor as unknown as { openContextMenuForSelection(): boolean }).openContextMenuForSelection();
    await settle();
    nodeEditor.shadowRoot!.querySelector<HTMLButtonElement>("[data-action='move-to-page']")!.click();
    await settle();

    (nodeEditor as unknown as { openContextMenuForSelection(): boolean }).openContextMenuForSelection();
    await settle();

    const lift = nodeEditor.shadowRoot!.querySelector<HTMLButtonElement>(
      "[data-action='remove-from-page']",
    );

    expect(lift, "lyft ut-knappen saknas").not.toBeNull();
    lift!.click();
    await settle();

    const node = (editor.getData() as { nodes: Array<{ id: string; parentPageId?: string }> }).nodes.find(
      (n) => n.id === "standalone",
    );

    expect(node?.parentPageId).toBeUndefined();
  });
});

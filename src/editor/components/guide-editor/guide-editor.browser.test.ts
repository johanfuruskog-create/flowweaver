// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../../testing/optional-pro";
const PRO = await withPro("index.ts");
import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { isGraphValid } from "../../core/graph-validator";

import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import type { PropertiesPanel } from "../properties-panel/properties-panel";
import type { EditorToolbar } from "../editor-toolbar/editor-toolbar";
import type { EditorToast } from "../editor-toast/editor-toast";
import type { ConfirmationDialog } from "../confirmation-dialog/confirmation-dialog";
import type { GuidePreview } from "../../../viewer/components/guide-preview/guide-preview";
import type { GuidePreviewDialog } from "../guide-preview-dialog/guide-preview-dialog";
import type { NodePalette } from "../node-palette/node-palette";
import { CURRENT_GRAPH_VERSION } from "../../../viewer/core/graph-migrations";
import type { GraphData } from "../../../viewer/types/graph";
import type { GraphChangedDetail } from "../../types/events";
import { expectDrawnCursor } from "../../../testing/drawn-cursor";
import { scrollSettled } from "../../../testing/scroll-settled";

/**
 * The fixture is in today's format and must not be migrated.
 *
 * Without a version stamp a graph is assumed to be v1, and the chain then
 * normalises bare strings into translatable maps — `"Fråga"` becomes
 * `{ sv: "Fråga" }`. That is right for a genuinely old guide, but here it would
 * only make the assertions about what you type in the panel hard to read. A bare
 * string is valid in today's format; it is simply not translated.
 */
const graph = {
  version: CURRENT_GRAPH_VERSION,
  startNodeId: "question",
  nodes: [
    {
      id: "question",
      type: "question",
      position: { x: 50, y: 50 },
      data: {
        title: "Fråga",
        variableName: "answer",
        description: "",
        options: [
          { id: "yes", label: "Ja", value: "yes" },
          { id: "no", label: "Nej", value: "no" },
          { id: "maybe", label: "Kanske", value: "maybe" },
        ],
      },
    },
    {
      id: "result-yes",
      type: "result",
      position: { x: 400, y: 25 },
      data: { title: "Ja-resultat" },
    },
    {
      id: "result-no",
      type: "result",
      position: { x: 400, y: 225 },
      data: { title: "Nej-resultat" },
    },
    {
      id: "result-maybe",
      type: "result",
      position: { x: 400, y: 425 },
      data: { title: "Kanske-resultat" },
    },
  ],
  connections: [
    {
      id: "yes-to-result",
      from: { nodeId: "question", portId: "yes" },
      to: { nodeId: "result-yes", portId: "input" },
    },
    {
      id: "no-to-result",
      from: { nodeId: "question", portId: "no" },
      to: { nodeId: "result-no", portId: "input" },
    },
    {
      id: "maybe-to-result",
      from: { nodeId: "question", portId: "maybe" },
      to: { nodeId: "result-maybe", portId: "input" },
    },
  ],
};

async function openToolbarMenu(
  toolbar: EditorToolbar,
  menu: "file" | "guide" | "view"
): Promise<void> {
  const trigger = toolbar.shadowRoot?.querySelector<HTMLButtonElement>(
    `[data-menu-trigger="${menu}"]`
  );

  if (!trigger) {
    throw new Error(`Kunde inte hitta menyn ${menu}.`);
  }

  await userEvent.click(trigger);
}

async function mountEditorAndSelectQuestion(): Promise<{
  editor: GuideEditor;
  nodeEditor: NodeEditor;
  propertiesPanel: PropertiesPanel;
  titleInput: HTMLInputElement;
}> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = graph;

  const nodeEditor =
    editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const flowNode =
    nodeEditor?.shadowRoot?.querySelector<FlowNode>("flow-node");
  const clickableNode = flowNode?.shadowRoot?.querySelector<HTMLElement>(
    ".flow-node"
  );

  if (!clickableNode) {
    throw new Error("Kunde inte hitta frågenoden.");
  }

  nodeEditor?.centerNodeById("question");
  clickableNode.dispatchEvent(
    new PointerEvent("pointerdown", {
      pointerId: 1,
      button: 0,
      bubbles: true,
      composed: true,
    })
  );
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const propertiesPanel =
    editor.shadowRoot?.querySelector<PropertiesPanel>("properties-panel");

  if (!nodeEditor || !propertiesPanel) {
    throw new Error("Kunde inte hitta editorns delkomponenter.");
  }

  // The title is a `<rich-text-field>` since story 136: `value` and `input`
  // like the field it replaced, so the tests that type into it read the same.
  const titleInput =
    propertiesPanel?.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-property="title"]'
    );

  if (!titleInput) {
    throw new Error("Kunde inte hitta frågans rubrikfält.");
  }

  return { editor, nodeEditor, propertiesPanel, titleInput };
}

function getToastElements(editor: GuideEditor): {
  toast: HTMLElement;
  message: HTMLElement;
  closeButton: HTMLButtonElement;
} {
  const toastComponent =
    editor.shadowRoot?.querySelector<EditorToast>("editor-toast");
  const toast =
    toastComponent?.shadowRoot?.querySelector<HTMLElement>("[data-toast]");
  const message =
    toastComponent?.shadowRoot?.querySelector<HTMLElement>("[data-message]");
  const closeButton =
    toastComponent?.shadowRoot?.querySelector<HTMLButtonElement>("button");

  if (!toast || !message || !closeButton) {
    throw new Error("Kunde inte hitta toast-komponenten.");
  }

  return { toast, message, closeButton };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/**
 * Answers the import's confirmation, which did not exist until a redaktör said
 * they were wary of the button — correctly, since choosing a file replaced the
 * guide outright with nothing asked.
 */
async function confirmImport(editor: GuideEditor): Promise<void> {
  const confirmation =
    editor.shadowRoot?.querySelector<ConfirmationDialog>("confirmation-dialog");

  /*
   * Waits for the dialog to be **open**, not for the button to exist.
   *
   * The button is in the markup from the start — a closed `<dialog>` still has
   * its children — so waiting for it returned immediately and left the click
   * waiting on something not yet visible. Locally the dialog opened first and it
   * passed; on CI it did not, and `locator.click` timed out after fourteen
   * seconds, failing a run in which every other test passed and taking the
   * deploy with it. Twice.
   *
   * The same shape as the menu that was asserted to *exist* while it opened
   * eight hundred pixels off screen: presence is not readiness.
   */
  await vi.waitUntil(
    () => confirmation?.shadowRoot?.querySelector("dialog")?.open === true,
  );

  const confirmButton = confirmation!.shadowRoot!.querySelector<HTMLButtonElement>(
    '[data-action="confirm"]',
  );

  await userEvent.click(confirmButton!);
}

describe("guide-editor", () => {
  test("shows visibility conditions as a badge on Page children", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 0, y: 0 }, data: {} },
        { id: "contact", type: "question", position: { x: 0, y: 0 }, parentPageId: "page", order: 0, data: { title: "Kontaktväg", variableName: "contact", options: [{ id: "o1", label: "E-post", value: "email" }] } },
        { id: "field", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 1, data: { title: "E-post", variableName: "email" }, visibility: { match: "all", conditions: [{ id: "condition", variableName: "contact", operator: "equals", value: "email" }] } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const badge = () =>
      Array.from(nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? [])
        .find((node) => node.nodeData?.id === "field")
        ?.shadowRoot?.querySelector(".flow-node__visibility-badge")?.textContent?.trim();

    // The question's words, from the guide the canvas hands every card (story 077).
    expect(badge()).toBe("Visas bara om Kontaktväg är E-post");

    /*
     * Renaming the question in the panel goes through `updateNodeData`, which
     * re-draws only the edited card — the field that speaks of it must be
     * re-drawn too, or the band reads a name the guide no longer has.
     */
    nodeEditor?.updateNodeData("contact", "title", "Hur vill du bli nådd?");
    expect(badge()).toBe("Visas bara om Hur vill du bli nådd? är E-post");
  });
  test("switches a Page child between full and half width", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: {} },
        { id: "field", type: "text-question", position: { x: 20, y: 112 }, parentPageId: "page", order: 0, layout: { columnSpan: 12 }, data: { title: "E-post" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    nodeEditor?.selectNodeById("field");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const panel = editor.shadowRoot?.querySelector<PropertiesPanel>("properties-panel");
    const widthSelect = panel?.shadowRoot?.querySelector<HTMLSelectElement>(
      '[data-layout-property="columnSpan"]'
    );
    if (!widthSelect) throw new Error("Kunde inte hitta fältbreddsväljaren.");

    await userEvent.selectOptions(widthSelect, "6");

    expect(nodeEditor?.getData().nodes.find((node) => node.id === "field")?.layout)
      .toEqual({ columnSpan: 6 });
  });
  test("tracks the path taken in the editor and shows the variable panel", async () => {
    // Ran through the dialog's own engine until 1/9; now the panel button
    // starts the same run as the Guide menu, and the trail marks the path.
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = graph;

    const previewTab = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-sidebar-mode="preview"]'
    );
    const preview = editor.shadowRoot?.querySelector<GuidePreview>(
      ".guide-editor__preview-panel guide-preview"
    );
    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    if (!previewTab || !preview || !nodeEditor) {
      throw new Error("Kunde inte hitta förhandsgranskningen.");
    }

    await userEvent.click(previewTab);
    nodeEditor.selectNodeById("question");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const proveButton = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="prove-guide"]'
    );
    if (!proveButton) throw new Error('Kunde inte hitta knappen "Prova guiden".');
    await userEvent.click(proveButton);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    // Svara Ja i panelens spegel: vägen fråga → resultat bär spåret i editorn.
    const yesOption = preview.shadowRoot?.querySelector<HTMLInputElement>(
      'input[name="guide-preview-option"][value="yes"]'
    );
    if (!yesOption) throw new Error("Kunde inte hitta svarsalternativet.");
    await userEvent.click(yesOption);
    await userEvent.click(
      preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(
      nodeEditor.shadowRoot?.querySelectorAll(".node-editor__connection[data-trail]").length
    ).toBe(1);

    // Variabelpanelen listar det sparade svaret.
    const inspector = preview.shadowRoot?.querySelector("[data-variable-inspector]");
    expect(inspector?.querySelector("summary")?.textContent).toContain("Variabler (1)");
    expect(inspector?.textContent).toContain("answer");
    expect(inspector?.textContent).toContain("yes");
  });

  test("the palette starts folded to its rail at every width (story 146)", async () => {
    for (const width of ["1000px", "1600px"]) {
      const editor = document.createElement("guide-editor") as GuideEditor;
      // Opt in: the default is readonly, and this test builds.
      editor.setAttribute("mode", "administrator");
      editor.style.width = width;
      document.body.append(editor);

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const palette = editor.shadowRoot!.querySelector<NodePalette>("node-palette")!;

      expect(editor.paletteOpen, width).toBe(false);
      expect(palette.shadowRoot!.querySelector<HTMLElement>(".node-palette__full")!.hidden, width).toBe(true);
      expect(palette.getBoundingClientRect().width, width).toBe(57);
    }
  });

  /*
   * The page card used to say "Fälten … sparar båda till variabeln …" as well.
   * Since 24/9 the health check `variable-name-clash` says it and leads to the
   * field; measured the same day, both spoke on a reachable page. Johan 24/9:
   * the passive text goes. What stays on the card is the empty page.
   */
  test("warns in the panel about empty pages, and leaves duplicate names to the health list", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "empty-page",
      nodes: [
        { id: "empty-page", type: "page", position: { x: 100, y: 80 }, data: { title: "Tom sida" } },
        { id: "dup-page", type: "page", position: { x: 900, y: 80 }, data: { title: "Dubblettsida" } },
        { id: "f1", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "dup-page", order: 0, data: { title: "Namn", variableName: "name" } },
        { id: "f2", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "dup-page", order: 1, data: { title: "Smeknamn", variableName: "name" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const panel = editor.shadowRoot?.querySelector<PropertiesPanel>("properties-panel");

    nodeEditor?.selectNodeById("empty-page");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(panel?.shadowRoot?.querySelector(".properties-panel__warnings")?.textContent)
      .toContain("Sidan har inga fält ännu");

    nodeEditor?.selectNodeById("dup-page");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    // The panel is on the page (its title field), and says nothing about the names.
    expect(panel?.shadowRoot?.querySelector<HTMLInputElement>('[data-property="title"]')?.value).toBe("Dubblettsida");
    expect(panel?.shadowRoot?.querySelector(".properties-panel__warnings")).toBeNull();

    // Vanliga noder får ingen varningsruta.
    nodeEditor?.selectNodeById("f1");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(panel?.shadowRoot?.querySelector(".properties-panel__warnings")).toBeNull();
  });
  test("moves Page fields with up and down buttons in the properties panel", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: {} },
        { id: "a", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 0, data: { title: "Förnamn" } },
        { id: "b", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 1, data: { title: "Efternamn" } },
        { id: "c", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 2, data: { title: "E-post" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const panel = editor.shadowRoot?.querySelector<PropertiesPanel>("properties-panel");
    const getOrder = (id: string) =>
      nodeEditor?.getData().nodes.find((node) => node.id === id)?.order;

    // Mittenfältet kan flyttas åt båda hållen.
    nodeEditor?.selectNodeById("b");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(panel?.shadowRoot?.textContent).toContain("plats 2 av 3");
    const upButton = panel?.shadowRoot?.querySelector<HTMLButtonElement>('[data-order-move="up"]');
    if (!upButton) throw new Error("Kunde inte hitta flyttknappen.");
    expect(upButton.disabled).toBe(false);

    await userEvent.click(upButton);

    expect(getOrder("b")).toBe(0);
    expect(getOrder("a")).toBe(1);
    expect(getOrder("c")).toBe(2);
    expect(panel?.shadowRoot?.textContent).toContain("plats 1 av 3");

    // Först i sidan: upp är avstängd, ned fungerar.
    const upAfter = panel?.shadowRoot?.querySelector<HTMLButtonElement>('[data-order-move="up"]');
    const downAfter = panel?.shadowRoot?.querySelector<HTMLButtonElement>('[data-order-move="down"]');
    expect(upAfter?.disabled).toBe(true);
    expect(downAfter?.disabled).toBe(false);

    await userEvent.click(downAfter!);
    expect(getOrder("a")).toBe(0);
    expect(getOrder("b")).toBe(1);
  });
  test("lets width and New row before change independently", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: {} },
        { id: "field", type: "text-question", position: { x: 20, y: 260 }, parentPageId: "page", order: 0, layout: { columnSpan: 6 }, data: { title: "E-post" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    nodeEditor?.selectNodeById("field");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const panel = editor.shadowRoot?.querySelector<PropertiesPanel>("properties-panel");
    const breakCheckbox = panel?.shadowRoot?.querySelector<HTMLInputElement>(
      "[data-layout-break-before]"
    );
    if (!breakCheckbox) throw new Error("Kunde inte hitta radbrytningsrutan.");

    await userEvent.click(breakCheckbox);
    expect(nodeEditor?.getData().nodes.find((node) => node.id === "field")?.layout)
      .toEqual({ columnSpan: 6, breakBefore: true });

    const widthSelect = panel?.shadowRoot?.querySelector<HTMLSelectElement>(
      '[data-layout-property="columnSpan"]'
    );
    if (!widthSelect) throw new Error("Kunde inte hitta fältbreddsväljaren.");

    await userEvent.selectOptions(widthSelect, "4");
    expect(nodeEditor?.getData().nodes.find((node) => node.id === "field")?.layout)
      .toEqual({ columnSpan: 4, breakBefore: true });
  });
  test("keeps a Page child in its place in the page when its data is edited", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: {} },
        { id: "field", type: "text-question", position: { x: 20, y: 260 }, parentPageId: "page", order: 0, layout: { columnSpan: 12 }, data: { title: "E-post" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    nodeEditor?.selectNodeById("field");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const panel = editor.shadowRoot?.querySelector<PropertiesPanel>("properties-panel");
    const titleField = panel?.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-property="title"]'
    );
    if (!titleField) throw new Error("Kunde inte hitta rubrikfältet.");

    await userEvent.type(titleField, "adress");

    const fieldNode = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "field");

    expect(fieldNode?.style.left).toBe("120px");
    expect(fieldNode?.style.top).toBe("268px");
    expect(nodeEditor?.getData().nodes.find((node) => node.id === "field")?.parentPageId)
      .toBe("page");
  });
  test("shows a visible selection on a chosen Page child in the canvas", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: {} },
        { id: "field", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 0, data: { title: "Namn" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    nodeEditor?.selectNodeById("field");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const fieldNode = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "field");
    const article = fieldNode?.shadowRoot?.querySelector<HTMLElement>(".flow-node");
    if (!article) throw new Error("Kunde inte hitta fältnoden.");

    expect(article.hasAttribute("data-selected")).toBe(true);
    // `border-color` has a `transition`, so a single rAF does not guarantee the
    // colour has landed — the reading can catch an intermediate value from the
    // interpolation. The test used to rely on luck and broke as soon as anything
    // else in the editor shifted the timing by a frame.
    await expect
      .poll(() => getComputedStyle(article).borderColor)
      .toBe("rgb(79, 70, 229)");
  });
  test("places two half-width Page children on the same row in the editor", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: {} },
        { id: "left", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 0, layout: { columnSpan: 6 }, data: { title: "Förnamn" } },
        { id: "right", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 1, layout: { columnSpan: 6 }, data: { title: "Efternamn" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const nodes = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    );
    const left = nodes.find((node) => node.nodeData?.id === "left");
    const right = nodes.find((node) => node.nodeData?.id === "right");
    const page = nodes.find((node) => node.nodeData?.id === "page");
    const surface = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
      '.node-editor__page-surface[data-page-id="page"]'
    );

    expect(left?.style.top).toBe("268px");
    expect(right?.style.top).toBe("268px");
    expect(left?.style.left).toBe("120px");
    expect(right?.style.left).toBe("436px");
    expect(left?.dataset.columnSpan).toBe("6");
    expect(page?.hasAttribute("data-page-container")).toBe(true);
    expect(page?.style.getPropertyValue("--page-height")).toBe("323px");
    expect(surface?.style.height).toBe("323px");
  });
  test("visar sidans layoutelement i paletten och ger dem egna helrader", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: {} },
        { id: "left", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 0, layout: { columnSpan: 6 }, data: { title: "Förnamn" } },
        { id: "spacer", type: "page-spacer", position: { x: 0, y: 0 }, parentPageId: "page", order: 1, data: {} },
        { id: "right", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 2, layout: { columnSpan: 6 }, data: { title: "Efternamn" } },
      ],
      connections: [],
    };

    const palette = editor.shadowRoot?.querySelector("node-palette");
    expect(palette?.shadowRoot?.querySelector('[data-node-type="page-heading"]')).not.toBeNull();
    expect(palette?.shadowRoot?.querySelector('[data-node-type="page-spacer"]')).not.toBeNull();

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const nodes = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    );
    const left = nodes.find((node) => node.nodeData?.id === "left");
    const spacer = nodes.find((node) => node.nodeData?.id === "spacer");
    const right = nodes.find((node) => node.nodeData?.id === "right");
    const surface = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
      '.node-editor__page-surface[data-page-id="page"]'
    );

    // Blanka raden bryter: vänster på rad 1, blank rad på rad 2, höger på rad 3.
    expect(left?.style.top).toBe("268px");
    expect(spacer?.style.top).toBe("378px");
    expect(spacer?.dataset.columnSpan).toBe("12");
    expect(right?.style.top).toBe("464px");
    // Three measured rows: 188 (the field area's top on a page with neither
    // title nor description) + 91 + 19 + 67 (the blank row) + 19 + 91 + 24 of
    // bottom padding. The numbers follow what the nodes measure, not a row
    // step.
    expect(surface?.style.height).toBe("499px");
  });
  test("grows the Page and arranges children vertically by order", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Kontakt" } },
        { id: "second", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 1, data: { title: "E-post" } },
        { id: "first", type: "number-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 0, data: { title: "Telefon" } },
      ],
      connections: [],
    };

    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const surface = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
      '.node-editor__page-surface[data-page-id="page"]'
    );
    const nodes = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    );
    const first = nodes.find((node) => node.nodeData?.id === "first");
    const second = nodes.find((node) => node.nodeData?.id === "second");

    expect(surface?.style.height).toBe("437px");
    expect(first?.style.left).toBe("120px");
    expect(first?.style.top).toBe("292px");
    expect(second?.style.top).toBe("402px");
  });
  test("opens an empty workspace in the middle and places new nodes there", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // The panel folded: with it open, the middle is the middle of what shows
    // (story 145) — guide-editor-side-panel measures that case.
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);

    const nodeEditor =
      editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport =
      nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
        ".node-editor__viewport"
      );
    const workspace =
      nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
        ".node-editor__workspace"
      );

    if (!nodeEditor || !viewport || !workspace) {
      throw new Error("Kunde inte hitta den tomma arbetsytan.");
    }

    await expect
      .poll(
        () =>
          Math.abs(
            viewport.scrollLeft +
              viewport.clientWidth / 2 -
              workspace.scrollWidth / 2
          )
      )
      .toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        viewport.scrollTop +
          viewport.clientHeight / 2 -
          workspace.scrollHeight / 2
      )
    ).toBeLessThanOrEqual(1);

    const suggestedPosition = nodeEditor.getSuggestedNodePosition();

    expect(Math.abs(suggestedPosition.x + 120)).toBeLessThanOrEqual(1);
    expect(Math.abs(suggestedPosition.y + 80)).toBeLessThanOrEqual(1);
    expect(getComputedStyle(viewport).overflow).toBe("auto");
    expect(getComputedStyle(viewport).scrollbarWidth).toBe("none");
  });

  test("shows the start node top-left with air, without changing coordinates", async () => {
    /*
     * Uppdrag 23/9, Del A punkt 1: opening a guide shows its start node
     * top-left with air, not the whole graph's bounding box centred — see
     * `centerInitialViewport` / `revealStartNode` in node-editor.ts. This
     * test used to assert the old bounding-box centring; that behaviour was
     * the bug the uppdrag was written against (a wide guide left its start
     * node off screen), so the assertion below checks the new contract
     * instead. What it always meant — the nodes' own coordinates are never
     * rewritten by looking at them — is unchanged and still checked.
     */
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = graph;

    const nodeEditor =
      editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport =
      nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
        ".node-editor__viewport"
      );

    if (!nodeEditor || !viewport) {
      throw new Error("Kunde inte hitta guidens arbetsyta.");
    }

    const originalPositions = graph.nodes.map((node) => node.position);

    await expect.poll(() => viewport.scrollLeft).toBeGreaterThan(0);

    const nodes = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    );
    const connectionsSvg =
      nodeEditor.shadowRoot?.querySelector<SVGSVGElement>(
        ".node-editor__connections"
      );
    const connectionPaths =
      nodeEditor.shadowRoot?.querySelectorAll<SVGPathElement>(
        "path[data-connection-id]"
      );
    const startNode = nodes.find((node) => node.nodeId === graph.startNodeId);

    if (!startNode) {
      throw new Error("Kunde inte hitta startnoden.");
    }

    const startRect = startNode.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    // 80 canvas px of air (node-editor.ts's shared `contentPadding`), at the
    // default zoom of 1.
    const padding = 80;

    expect(Math.abs(startRect.left - (viewportRect.left + padding))).toBeLessThanOrEqual(1);
    expect(Math.abs(startRect.top - (viewportRect.top + padding))).toBeLessThanOrEqual(1);
    expect(editor.getData().nodes.map((node) => node.position)).toEqual(
      originalPositions
    );
    expect(connectionsSvg?.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(connectionsSvg?.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(connectionPaths?.length).toBe(graph.connections.length * 2);
    connectionPaths?.forEach((path) => {
      expect(path.getAttribute("d")).toMatch(/^M /);
    });
  });

  test("expands the workspace in every direction without moving the graph", async () => {
    const { editor, nodeEditor } = await mountEditorAndSelectQuestion();
    const viewport =
      nodeEditor.shadowRoot?.querySelector<HTMLElement>(
        ".node-editor__viewport"
      );
    const workspace =
      nodeEditor.shadowRoot?.querySelector<HTMLElement>(
        ".node-editor__workspace"
      );
    const questionNode = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "question");
    const connectionsSvg =
      nodeEditor.shadowRoot?.querySelector<SVGSVGElement>(
        ".node-editor__connections"
      );
    const getConnectionPath = (): SVGPathElement | null =>
      nodeEditor.shadowRoot?.querySelector<SVGPathElement>(
        ".node-editor__connection:not(.node-editor__connection--preview)"
      ) ?? null;
    const connectionPath = getConnectionPath();

    if (
      !viewport ||
      !workspace ||
      !questionNode ||
      !connectionsSvg ||
      !connectionPath
    ) {
      throw new Error("Kunde inte hitta arbetsytans dynamiska lager.");
    }

    await expect.poll(() => viewport.scrollLeft).toBeGreaterThan(0);

    const originalPositions = editor
      .getData()
      .nodes.map((node) => structuredClone(node.position));
    const initialWidth = workspace.offsetWidth;
    const initialHeight = workspace.offsetHeight;

    viewport.scrollLeft = 1;
    viewport.scrollTop = 1;
    const beforeLeftTop = questionNode.getBoundingClientRect();
    const pathBeforeLeftTop = connectionPath.getBoundingClientRect();
    viewport.dispatchEvent(new Event("scroll"));
    const afterLeftTop = questionNode.getBoundingClientRect();
    const pathAfterLeftTop = getConnectionPath()?.getBoundingClientRect();

    if (!pathAfterLeftTop) {
      throw new Error("Kopplingskurvan försvann efter expansion åt vänster.");
    }

    expect(workspace.offsetWidth).toBeGreaterThan(initialWidth);
    expect(workspace.offsetHeight).toBeGreaterThan(initialHeight);
    expect(afterLeftTop.left).toBeCloseTo(beforeLeftTop.left, 0);
    expect(afterLeftTop.top).toBeCloseTo(beforeLeftTop.top, 0);
    expect(pathAfterLeftTop.left).toBeCloseTo(pathBeforeLeftTop.left, 0);
    expect(pathAfterLeftTop.top).toBeCloseTo(pathBeforeLeftTop.top, 0);

    const afterLeftWidth = workspace.offsetWidth;
    const afterTopHeight = workspace.offsetHeight;
    viewport.scrollLeft = viewport.scrollWidth - viewport.clientWidth;
    viewport.scrollTop = viewport.scrollHeight - viewport.clientHeight;
    const beforeRightBottom = questionNode.getBoundingClientRect();
    const pathBeforeRightBottom = getConnectionPath()?.getBoundingClientRect();

    if (!pathBeforeRightBottom) {
      throw new Error("Kopplingskurvan saknas före expansion åt höger.");
    }

    viewport.dispatchEvent(new Event("scroll"));
    const afterRightBottom = questionNode.getBoundingClientRect();
    const pathAfterRightBottom = getConnectionPath()?.getBoundingClientRect();

    if (!pathAfterRightBottom) {
      throw new Error("Kopplingskurvan försvann efter expansion åt höger.");
    }

    expect(workspace.offsetWidth).toBeGreaterThan(afterLeftWidth);
    expect(workspace.offsetHeight).toBeGreaterThan(afterTopHeight);
    expect(afterRightBottom.left).toBeCloseTo(beforeRightBottom.left, 0);
    expect(afterRightBottom.top).toBeCloseTo(beforeRightBottom.top, 0);
    expect(pathAfterRightBottom.left).toBeCloseTo(
      pathBeforeRightBottom.left,
      0
    );
    expect(pathAfterRightBottom.top).toBeCloseTo(
      pathBeforeRightBottom.top,
      0
    );
    expect(editor.getData().nodes.map((node) => node.position)).toEqual(
      originalPositions
    );
    expect(connectionsSvg.getBoundingClientRect().width).toBe(
      workspace.getBoundingClientRect().width
    );
    expect(connectionsSvg.getBoundingClientRect().height).toBe(
      workspace.getBoundingClientRect().height
    );
  });

  test("keeps the drag cursor and pans when a node reaches the edge", async () => {
    const { nodeEditor } = await mountEditorAndSelectQuestion();
    const viewport =
      nodeEditor.shadowRoot?.querySelector<HTMLElement>(
        ".node-editor__viewport"
      );
    const flowNode =
      nodeEditor.shadowRoot?.querySelector<FlowNode>("flow-node");
    const dragHandle =
      flowNode?.shadowRoot?.querySelector<HTMLElement>("[data-drag-handle]");

    if (!viewport || !dragHandle) {
      throw new Error("Kunde inte hitta nodens dragkontroller.");
    }

    const setPointerCapture = vi
      .spyOn(viewport, "setPointerCapture")
      .mockImplementation(() => undefined);
    const hasPointerCapture = vi
      .spyOn(viewport, "hasPointerCapture")
      .mockReturnValue(true);
    const releasePointerCapture = vi
      .spyOn(viewport, "releasePointerCapture")
      .mockImplementation(() => undefined);
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const handleRect = dragHandle.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();

    dragHandle.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 7,
        button: 0,
        clientX: handleRect.left + 10,
        clientY: handleRect.top + 10,
        bubbles: true,
        composed: true,
      })
    );

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(viewport.hasAttribute("data-node-dragging")).toBe(true);
    /*
     * `grabbing`, inte `move`. Kontraktet byttes med flit 22/9 2026
     * (7db8925a): `grab` lovar `grabbing` — det är namnet på löftet — och
     * nodhuvudet sa `move`, ett annat ord för en annan gest. Facit är
     * `flow-node-drag-cursor.browser.test.ts`, som driver samma dragning för
     * just den frågan. Den här raden står kvar för att auto-pan-delen nedanför
     * måste veta att dragningen verkligen började.
     */
    expectDrawnCursor(dragHandle, "grabbing", "nodhuvudet under dragningen");
    // The canvas around the carried node says `move`, drawn too.
    expectDrawnCursor(viewport, "move", "arbetsytan under nodflytt");

    // Armera auto-pan genom att först dra i viewportens inre.
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 7,
        clientX: viewportRect.left + viewportRect.width / 2,
        clientY: viewportRect.top + viewportRect.height / 2,
      })
    );

    // Kliv in i kantzonen: startar fördröjningen, panorerar inte än.
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 7,
        clientX: viewportRect.right - 50,
        clientY: viewportRect.top + viewportRect.height / 2,
      })
    );

    const previousScrollLeft = viewport.scrollLeft;

    // After the delay and a movement towards the edge, it pans.
    clock = 250;
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 7,
        clientX: viewportRect.right + 20,
        clientY: viewportRect.top + viewportRect.height / 2,
      })
    );

    expect(viewport.scrollLeft).toBeGreaterThan(previousScrollLeft);

    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 7 }));

    expect(hasPointerCapture).toHaveBeenCalledWith(7);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(viewport.hasAttribute("data-node-dragging")).toBe(false);
  });

  test("keeps the nodes in view when panning expands the canvas", async () => {
    const { editor, nodeEditor } = await mountEditorAndSelectQuestion();
    const viewport =
      nodeEditor.shadowRoot?.querySelector<HTMLElement>(
        ".node-editor__viewport"
      );
    const workspace =
      nodeEditor.shadowRoot?.querySelector<HTMLElement>(
        ".node-editor__workspace"
      );
    const flowNode =
      nodeEditor.shadowRoot?.querySelector<FlowNode>("flow-node");

    if (!viewport || !workspace || !flowNode) {
      throw new Error("Kunde inte hitta panoreringslagren.");
    }

    vi.spyOn(viewport, "setPointerCapture").mockImplementation(
      () => undefined
    );
    vi.spyOn(viewport, "hasPointerCapture").mockReturnValue(true);
    vi.spyOn(viewport, "releasePointerCapture").mockImplementation(
      () => undefined
    );

    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Space", bubbles: true })
    );

    expect(viewport.hasAttribute("data-pan-ready")).toBe(true);
    expectDrawnCursor(viewport, "move", "arbetsytan redo att panorera");

    viewport.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 11,
        button: 0,
        clientX: 400,
        clientY: 300,
        bubbles: true,
      })
    );

    const originalPositions = editor
      .getData()
      .nodes.map((node) => structuredClone(node.position));
    const initialWidth = workspace.offsetWidth;

    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 11,
        clientX: 1200,
        clientY: 300,
      })
    );
    viewport.dispatchEvent(new Event("scroll"));

    expect(workspace.offsetWidth).toBeGreaterThan(initialWidth);

    const beforeNextMove = flowNode.getBoundingClientRect();

    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 11,
        clientX: 1210,
        clientY: 300,
      })
    );

    const afterNextMove = flowNode.getBoundingClientRect();

    expect(afterNextMove.left - beforeNextMove.left).toBeCloseTo(10, 0);
    expect(afterNextMove.top).toBeCloseTo(beforeNextMove.top, 0);
    expect(editor.getData().nodes.map((node) => node.position)).toEqual(
      originalPositions
    );

    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 11 }));
    window.dispatchEvent(
      new KeyboardEvent("keyup", { code: "Space", bubbles: true })
    );
  });

  test("respects the host application's configured height", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    editor.style.setProperty("--flowweaver-height", "720px");
    editor.style.setProperty("--flowweaver-min-height", "480px");
    document.body.append(editor);

    const computedStyle = getComputedStyle(editor);

    expect(computedStyle.height).toBe("720px");
    expect(computedStyle.minHeight).toBe("480px");
  });

  test("toggles the editor in and out of full screen", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);

    const toolbar =
      editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const fullscreenButton =
      toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="fullscreen"]'
      );
    const nodeEditor =
      editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    /*
     * The platform's fullscreen is declared unavailable, which is what an iframe
     * without `allow="fullscreen"` reports — and the case this mode exists for.
     * Chromium allows it here, so without saying so the editor would take the
     * other route and this would be testing something else entirely.
     *
     * Nothing else is mocked: the mode is ours and driven for real, which is a
     * better test than the mocked `requestFullscreen` it replaced.
     *
     * What survives unchanged is the part worth keeping: the view holds its
     * centre through the change of available area, in both directions.
     */
    vi.spyOn(document, "fullscreenEnabled", "get").mockReturnValue(false);

    if (!toolbar || !fullscreenButton || !nodeEditor) {
      throw new Error("Kunde inte hitta helskärmsknappen.");
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    nodeEditor.centerViewportAt({ x: 180, y: 120 });

    const expectCenter = async (x: number, y: number): Promise<void> => {
      await expect
        .poll(() => {
          const center = nodeEditor.getViewportCenter();

          return Math.max(Math.abs(center.x - x), Math.abs(center.y - y));
        })
        .toBeLessThanOrEqual(1);
    };

    expect(fullscreenButton.textContent?.trim()).toBe("Helskärm");
    expect(fullscreenButton.getAttribute("aria-pressed")).toBe("false");

    await openToolbarMenu(toolbar, "view");
    await userEvent.click(fullscreenButton);

    expect(editor.hasAttribute("wide")).toBe(true);
    expect(getComputedStyle(editor).position).toBe("fixed");
    expect(fullscreenButton.textContent).toBe("Avsluta helskärm");
    expect(fullscreenButton.getAttribute("aria-pressed")).toBe("true");
    await expectCenter(180, 120);

    nodeEditor.centerViewportAt({ x: -140, y: 260 });

    await openToolbarMenu(toolbar, "view");
    await userEvent.click(fullscreenButton);

    expect(editor.hasAttribute("wide")).toBe(false);
    expect(fullscreenButton.textContent).toBe("Helskärm");
    expect(fullscreenButton.getAttribute("aria-pressed")).toBe("false");
    await expectCenter(-140, 260);
  });

  test("centres the view on the content via Fit to content", async () => {
    const { editor, nodeEditor } = await mountEditorAndSelectQuestion();
    const toolbar =
      editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const fitButton = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="fit-to-content"]'
    );
    if (!toolbar || !fitButton) {
      throw new Error("Kunde inte hitta Anpassa till innehåll.");
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    // The panel folded: with it open the content is centred in what shows,
    // not in the whole view (story 145, guide-editor-side-panel).
    editor.panelOpen = false;
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    // Panorera långt bort så att innehållet hamnar utanför vyn.
    nodeEditor.centerViewportAt({ x: 4000, y: 4000 });

    await openToolbarMenu(toolbar, "view");
    await userEvent.click(fitButton);

    // Vyns centrum ska nu ligga på grafens bounding box-centrum.
    const nodes = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    );
    const left = Math.min(...nodes.map((node) => node.offsetLeft));
    const top = Math.min(...nodes.map((node) => node.offsetTop));
    const right = Math.max(...nodes.map((node) => node.offsetLeft + node.offsetWidth));
    const bottom = Math.max(...nodes.map((node) => node.offsetTop + node.offsetHeight));

    /*
     * Within a pixel, not within half of one. `offsetLeft` and `offsetWidth`
     * are integers, and the fit works in the canvas's fractional pixels — so
     * the two sides of this comparison are not measured to the same precision.
     * It sat at 0.5 by luck until the nodes' widths stopped landing on whole
     * numbers; the claim is "centred on the content", and a pixel is that.
     */
    const center = nodeEditor.getViewportCenter();
    expect(Math.abs(center.x - (left + right) / 2)).toBeLessThan(1);
    expect(Math.abs(center.y - (top + bottom) / 2)).toBeLessThan(1);
  });

  test("shows a message when an empty guide is to be fitted", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = { startNodeId: null, nodes: [], connections: [] };

    const toolbar =
      editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const fitButton = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="fit-to-content"]'
    );
    const { toast, message } = getToastElements(editor);
    if (!toolbar || !fitButton) {
      throw new Error("Kunde inte hitta Anpassa till innehåll.");
    }

    await openToolbarMenu(toolbar, "view");
    await userEvent.click(fitButton);

    expect(toast.hasAttribute("hidden")).toBe(false);
    expect(message.textContent).toContain("tom");
  });

  test("preserves the zoom level and centre across a full-screen toggle", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);

    const toolbar =
      editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const fullscreenButton =
      toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="fullscreen"]'
      );
    const nodeEditor =
      editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    let fullscreenElement: Element | null = null;

    vi.spyOn(document, "fullscreenElement", "get").mockImplementation(
      () => fullscreenElement
    );
    vi.spyOn(editor, "requestFullscreen").mockImplementation(async () => {
      editor.style.setProperty("--flowweaver-height", "760px");
      fullscreenElement = editor;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    vi.spyOn(document, "exitFullscreen").mockImplementation(async () => {
      editor.style.setProperty("--flowweaver-height", "620px");
      fullscreenElement = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    if (!toolbar || !fullscreenButton || !nodeEditor) {
      throw new Error("Kunde inte hitta helskärmsknappen.");
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    nodeEditor.centerViewportAt({ x: 200, y: 150 });
    nodeEditor.setZoom(1.4);

    await openToolbarMenu(toolbar, "view");
    await userEvent.click(fullscreenButton);

    // The zoom level is view state and must survive the full-screen toggle …
    expect(nodeEditor.getZoom()).toBeCloseTo(1.4, 5);
    // … liksom det centrerade läget.
    await expect
      .poll(() => {
        const center = nodeEditor.getViewportCenter();
        return Math.max(Math.abs(center.x - 200), Math.abs(center.y - 150));
      })
      .toBeLessThanOrEqual(1);

    await openToolbarMenu(toolbar, "view");
    await userEvent.click(fullscreenButton);

    expect(nodeEditor.getZoom()).toBeCloseTo(1.4, 5);
  });

  test("keeps the same point centred when the editor's height changes", async () => {
    const { editor, nodeEditor } = await mountEditorAndSelectQuestion();
    const viewport =
      nodeEditor.shadowRoot?.querySelector<HTMLElement>(
        ".node-editor__viewport"
      );

    if (!viewport) {
      throw new Error("Kunde inte hitta arbetsytans viewport.");
    }

    viewport.scrollLeft = 500;
    viewport.scrollTop = 400;

    const previousHeight = viewport.clientHeight;
    const previousCenter = {
      x: viewport.scrollLeft + viewport.clientWidth / 2,
      y: viewport.scrollTop + previousHeight / 2,
    };

    editor.style.setProperty("--flowweaver-height", "760px");

    await expect.poll(() => viewport.clientHeight).not.toBe(previousHeight);
    await expect
      .poll(() => viewport.scrollTop + viewport.clientHeight / 2)
      .toBeCloseTo(previousCenter.y, 0);

    expect(viewport.scrollLeft + viewport.clientWidth / 2).toBeCloseTo(
      previousCenter.x,
      0
    );
  });

  test("allows spaces in the side panel's text fields", async () => {
    const { editor, titleInput } = await mountEditorAndSelectQuestion();

    await userEvent.click(titleInput);
    await userEvent.keyboard(" med mellanslag");

    expect(titleInput.value).toBe("Fråga med mellanslag");
    expect(editor.getData().nodes[0]?.data.title).toBe(
      "Fråga med mellanslag"
    );
  });

  test("exposes graph-changed when node data changes", async () => {
    const { editor, titleInput } = await mountEditorAndSelectQuestion();
    const changes: GraphChangedDetail[] = [];

    editor.addEventListener("graph-changed", (event) => {
      changes.push(
        structuredClone((event as CustomEvent<GraphChangedDetail>).detail)
      );
    });

    await userEvent.click(titleInput);
    await userEvent.keyboard("!");

    expect(changes).toHaveLength(1);
    expect(changes[0]?.reason).toBe("node-updated");
    expect(changes[0]?.graph.nodes[0]?.data.title).toBe("Fråga!");
  });

  test("live typing becomes one undo step and can be undone", async () => {
    const { editor, titleInput } = await mountEditorAndSelectQuestion();

    await userEvent.click(titleInput);
    await userEvent.keyboard("abc");
    expect(editor.getData().nodes[0]?.data.title).toBe("Frågaabc");

    // The history bookkeeping is deferred while typing but flushed on undo, so
    // the whole typing session is undone in one step back to the starting
    // state.
    editor.undo();
    expect(editor.getData().nodes[0]?.data.title).toBe("Fråga");
  });

  test("tar bort alternativets port och koppling tillsammans", async () => {
    const { editor, nodeEditor, propertiesPanel } =
      await mountEditorAndSelectQuestion();
    const changes: GraphChangedDetail[] = [];

    editor.addEventListener("graph-changed", (event) => {
      changes.push(
        structuredClone((event as CustomEvent<GraphChangedDetail>).detail)
      );
    });

    const removeButton =
      propertiesPanel.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="remove-option"][data-option-id="no"]'
      );

    if (!removeButton) {
      throw new Error("Kunde inte hitta alternativets ta bort-knapp.");
    }

    /*
     * Etapp 2 (UPPDRAG-2026-09-28-SVARSALTERNATIV, 28/9): knappen ligger nu i
     * alternativets utfällbara kropp, stängd som viloläge. Utfällningen är
     * Teds klick-hanterade beteende, inte byggt än — provet öppnar kroppen
     * direkt (samma attribut hans knapp kommer sätta) för att pröva
     * borttagningen i sig, inte utfällningen.
     */
    removeButton.closest("[data-option-body]")?.removeAttribute("hidden");
    await userEvent.click(removeButton);

    const updatedGraph = editor.getData();
    const question = updatedGraph.nodes.find((node) => node.id === "question");
    const options = Array.isArray(question?.data.options)
      ? question.data.options
      : [];
    const questionElement = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "question");

    expect(options).toEqual([
      { id: "yes", label: "Ja", value: "yes" },
      { id: "maybe", label: "Kanske", value: "maybe" },
    ]);
    expect(
      updatedGraph.connections.some(
        (connection) => connection.from.portId === "no"
      )
    ).toBe(false);
    expect(questionElement?.getPortElement("output", "no")).toBeNull();
    expect(changes.map((change) => change.reason)).toEqual([
      "connection-removed",
      "node-updated",
    ]);
    expect(isGraphValid(updatedGraph)).toBe(true);
  });

  test("navigates back to the start node from the toolbar", async () => {
    const { editor, nodeEditor } = await mountEditorAndSelectQuestion();
    const toolbar =
      editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const showStartNode =
      toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="show-start-node"]'
      );
    const viewport =
      nodeEditor.shadowRoot?.querySelector<HTMLElement>(
        ".node-editor__viewport"
      );
    const startNode = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === graph.startNodeId);

    if (!toolbar || !showStartNode || !viewport || !startNode) {
      throw new Error("Kunde inte hitta navigeringen till startnoden.");
    }

    nodeEditor.centerViewportAt({ x: 900, y: 700 });
    await openToolbarMenu(toolbar, "guide");
    await userEvent.click(showStartNode);
    await scrollSettled(viewport);

    const viewportRect = viewport.getBoundingClientRect();
    const startNodeRect = startNode.getBoundingClientRect();

    expect(
      Math.abs(
        viewportRect.left +
          viewport.clientWidth / 2 -
          (startNodeRect.left + startNodeRect.width / 2)
      )
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        viewportRect.top +
          viewport.clientHeight / 2 -
          (startNodeRect.top + startNodeRect.height / 2)
      )
    ).toBeLessThanOrEqual(1);
    expect(startNode.selected).toBe(true);
  });

  test("shows help when a guide has no start node", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: null,
      nodes: [
        {
          id: "result-only",
          type: "result",
          position: { x: 0, y: 0 },
          data: { title: "Resultat" },
        },
      ],
      connections: [],
    };

    const toolbar =
      editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const showStartNode =
      toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="show-start-node"]'
      );
    const { toast, message } = getToastElements(editor);

    if (!toolbar || !showStartNode) {
      throw new Error("Kunde inte hitta Visa startnod-knappen.");
    }

    await openToolbarMenu(toolbar, "guide");
    await userEvent.click(showStartNode);

    expect(message.textContent).toBe("Guiden har ingen startnod ännu.");
    expect(toast.hidden).toBe(false);
  });

  // Story 082: the first step in an empty guide is its start. The band and
  // "Gör till startnod" stay for the case below, where the start is removed.
  test("det första steget i en tom guide blir start, utan band", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.paletteOpen = true; // the node types are in the full palette (story 146)
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);

    const palette =
      editor.shadowRoot?.querySelector<NodePalette>("node-palette");
    const addQuestion =
      palette?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-node-type="question"]'
      );
    const nodeEditor =
      editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

    if (!addQuestion || !nodeEditor) {
      throw new Error("Kunde inte hitta Lägg till fråga.");
    }

    await userEvent.click(addQuestion);

    const createdQuestion =
      nodeEditor.shadowRoot?.querySelector<FlowNode>("flow-node");
    const warning = editor.shadowRoot?.querySelector<HTMLElement>(
      "[data-start-node-warning]"
    );

    expect(editor.getData().startNodeId).toBe(createdQuestion?.nodeData?.id);
    expect(createdQuestion?.startNode).toBe(true);
    expect(createdQuestion?.getPortElement("input", "input")).toBeNull();
    expect(warning?.hidden).toBe(true);
  });

  test("creates a question and a result from the toolbar", async () => {
    const { editor, nodeEditor, propertiesPanel } =
      await mountEditorAndSelectQuestion();
    editor.paletteOpen = true; // the node types are in the full palette (story 146)
    const palette =
      editor.shadowRoot?.querySelector<NodePalette>("node-palette");
    const toolbar =
      editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const addQuestion = palette?.shadowRoot?.querySelector<HTMLButtonElement>(
      '.node-palette__full [data-node-type="question"]'
    );
    const addResult = palette?.shadowRoot?.querySelector<HTMLButtonElement>(
      '.node-palette__full [data-node-type="result"]'
    );
    const addNumberQuestion = palette?.shadowRoot?.querySelector<HTMLButtonElement>(
      '.node-palette__full [data-node-type="number-question"]'
    );
    const addRule = palette?.shadowRoot?.querySelector<HTMLButtonElement>(
      '.node-palette__full [data-node-type="rule"]'
    );

    if (!addQuestion || !addNumberQuestion || !addResult || !addRule) {
      throw new Error("Kunde inte hitta nodpalettens knappar.");
    }

    expect(toolbar?.shadowRoot?.querySelector("[data-node-type]")).toBeNull();

    await userEvent.click(addQuestion);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const afterQuestion = editor.getData();
    const createdQuestion = afterQuestion.nodes.at(-1);

    expect(createdQuestion?.type).toBe("question");
    // Standardalternativens etikett är numera tvåspråkig (LocalizedText).
    expect(createdQuestion?.data.options).toEqual([
      expect.objectContaining({
        label: { sv: "Alternativ 1", en: "Option 1" },
        value: "option-1",
      }),
      expect.objectContaining({
        label: { sv: "Alternativ 2", en: "Option 2" },
        value: "option-2",
      }),
    ]);
    expect(
      propertiesPanel.shadowRoot?.activeElement?.getAttribute("data-property")
    ).toBe("title");

    const questionElements = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    );
    const startQuestion = questionElements.find(
      (node) => node.nodeData?.id === graph.startNodeId
    );
    const newQuestion = questionElements.find(
      (node) => node.nodeData?.id === createdQuestion?.id
    );

    expect(startQuestion?.startNode).toBe(true);
    expect(startQuestion?.getPortElement("input", "input")).toBeNull();
    expect(newQuestion?.startNode).toBe(false);
    expect(newQuestion?.getPortElement("input", "input")).not.toBeNull();

    await userEvent.click(addNumberQuestion);
    const createdNumberQuestion = editor.getData().nodes.at(-1);
    expect(createdNumberQuestion).toMatchObject({
      type: "number-question",
      data: { min: 0, max: 120, step: 1 },
    });
    expect(propertiesPanel.shadowRoot?.textContent).toContain("Variabeltyp");
    expect(propertiesPanel.shadowRoot?.textContent).toContain("Siffra");
    /*
     * *Spara svaret som* ligger under **Avancerat**, och folden är stängd
     * (Johans beslut 23/9 2026). Den öppnas här på samma sätt som en person
     * gör det — annars är fältet osynligt och `fill` väntar ut sin timeout.
     *
     * Provet gick igenom innan beslutet, men av fel skäl: den gamla
     * i-bruk-regeln fällde upp folden på startfrågan (som HAR ett
     * variabelnamn), `toggle` landade asynkront och lade sig som ett minne —
     * och gruppen stod sedan öppen på varje nod, också den nyskapade tomma.
     * Mätt 23/9 innan regeln togs bort.
     */
    const advanced = propertiesPanel.shadowRoot?.querySelector<HTMLDetailsElement>(
      'details[data-property-section="advanced"]'
    );
    if (advanced) {
      await userEvent.click(advanced.querySelector("summary")!);
    }

    const numberVariableInput =
      propertiesPanel.shadowRoot?.querySelector<HTMLInputElement>(
        '[data-property="variableName"]'
      );
    if (!numberVariableInput) {
      throw new Error("Kunde inte hitta sifferfrågans variabelnamn.");
    }
    await userEvent.fill(numberVariableInput, "age");

    await userEvent.click(addResult);

    expect(editor.getData().nodes.at(-1)?.type).toBe("result");

    await userEvent.click(addRule);
    // The rule's case is a card, closed until opened (uppdrag 29/9 Del A).
    propertiesPanel.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="toggle-rule-case"]')?.click();

    const createdRule = editor.getData().nodes.at(-1);
    const ruleElement = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === createdRule?.id);
    const operatorSelect =
      propertiesPanel.shadowRoot?.querySelector<HTMLSelectElement>(
        '[data-rule-condition-property="operator"]'
      );
    // The searchable field picker since story 143; the operator keeps its select.
    const variableSelect =
      propertiesPanel.shadowRoot?.querySelector<HTMLElement>(
        'field-picker[data-rule-condition-property="variableName"]'
      );
    const variableRows = (): HTMLElement[] =>
      Array.from(variableSelect?.shadowRoot?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const ruleCaseId = Array.isArray(createdRule?.data.cases)
      ? (createdRule.data.cases[0] as { id?: string } | undefined)?.id
      : undefined;

    expect(createdRule).toMatchObject({
      type: "rule",
      data: { fallbackLabel: "Annars" },
    });
    expect(ruleElement?.getPortElement("input", "input")).not.toBeNull();
    expect(ruleCaseId).toBeTruthy();
    expect(ruleElement?.getPortElement("output", ruleCaseId ?? "")).not.toBeNull();
    expect(ruleElement?.getPortElement("output", "default")).not.toBeNull();
    /*
     * A choice variable gets the identity comparisons and not the numeric ones:
     * "är någon av ja, kanske" is a sensible thing to ask of an answer, and
     * "är större än ja" is not. The numeric four appear only for a number.
     */
    expect(Array.from(operatorSelect?.options ?? [], (option) => option.value)).toEqual([
      "equals",
      "not-equals",
      "one-of",
      "not-one-of",
    ]);
    expect(
      propertiesPanel.shadowRoot?.querySelector('[data-rule-case-property="match"]')
    ).toBeNull();
    expect(
      variableRows().map((row) => ({
        label: row.querySelector(".option__label")?.textContent,
        value: row.querySelector(".chip")?.textContent,
      }))
    /*
     * Rubriken OCH det tekniska namnet: en variabel heter samma sak i varje
     * väljare, och det stavas ut här hela vägen genom editorn (uppdrag
     * 2026-08-31). Sedan story 143 står namnet över brickan i raden, och det
     * VALDA är fortfarande bara namnet.
     */
    ).toContainEqual({ label: "Fråga", value: "answer" });

    if (!operatorSelect || !variableSelect) {
      throw new Error("Kunde inte hitta regelns variabel- och operatorfält.");
    }

    await userEvent.click(variableSelect.shadowRoot!.querySelector<HTMLElement>(".control")!);
    await userEvent.click(variableRows().find((row) => row.querySelector(".chip")?.textContent === "answer")!);
    const currentOperatorSelect = propertiesPanel.shadowRoot?.querySelector<HTMLSelectElement>(
      '[data-rule-condition-property="operator"]'
    );
    /*
     * Värdet väljs i `chip-picker` sedan alla kända värden väljs på ETIKETTEN
     * i stället för att skrivas som kod — samma kontroll för "är lika med" som
     * för "är någon av", med `single` som skillnad.
     */
    const valuePicker = propertiesPanel.shadowRoot
      ?.querySelector("[data-rule-value-picker]")?.shadowRoot;

    // Alternativen visas när kontrollen används.
    valuePicker?.querySelector<HTMLElement>(".chip-picker__box")
      ?.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));

    expect(
      Array.from(valuePicker?.querySelectorAll("[data-add]") ?? [], (option) => ({
        label: option.textContent?.trim(),
        value: (option as HTMLElement).dataset.value,
      })),
    ).toContainEqual({ label: "Ja", value: "yes" });

    if (!currentOperatorSelect || !valuePicker) {
      throw new Error("Kunde inte hitta regelns operator- och värdefält.");
    }

    await userEvent.selectOptions(currentOperatorSelect, "not-equals");
    const currentValuePicker = propertiesPanel.shadowRoot
      ?.querySelector("[data-rule-value-picker]")?.shadowRoot;

    currentValuePicker?.querySelector<HTMLElement>(".chip-picker__box")
      ?.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));

    if (!currentValuePicker) {
      throw new Error("Kunde inte hitta regelns värdefält efter uppdatering.");
    }
    currentValuePicker.querySelector<HTMLButtonElement>('[data-add][data-value="yes"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(
      (
        editor.getData().nodes.find((node) => node.id === createdRule?.id)?.data
          .cases as Array<{
            conditions: Array<{ variableName: string; value: string }>;
          }> | undefined
      )?.[0]?.conditions[0]
    ).toMatchObject({ variableName: "answer", value: "yes" });

    expect(
      (
        editor.getData().nodes.find((node) => node.id === createdRule?.id)?.data
          .cases as Array<{ conditions: Array<{ operator: string }> }> | undefined
      )?.[0]?.conditions[0]?.operator
    ).toBe("not-equals");

    const addConditionButton = propertiesPanel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="add-rule-condition"]'
    );
    if (!addConditionButton) {
      throw new Error("Kunde inte hitta Lägg till villkor.");
    }
    await userEvent.click(addConditionButton);

    expect(
      (
        editor.getData().nodes.find((node) => node.id === createdRule?.id)?.data
          .cases as Array<{ conditions: unknown[] }> | undefined
      )?.[0]?.conditions
    ).toHaveLength(2);

    const conditionVariableSelects =
      propertiesPanel.shadowRoot?.querySelectorAll<HTMLElement>(
        'field-picker[data-rule-condition-property="variableName"]'
      );
    if (!conditionVariableSelects?.[1]) {
      throw new Error("Kunde inte hitta det andra villkorets variabel.");
    }
    // Chosen as an author does since story 143: open, pick the row by its technical name.
    const secondPicker = conditionVariableSelects[1].shadowRoot!;
    await userEvent.click(secondPicker.querySelector<HTMLElement>(".control")!);
    await userEvent.click(
      [...secondPicker.querySelectorAll<HTMLElement>('[role="option"]')]
        .find((row) => row.querySelector(".chip")?.textContent === "age")!
    );
    const conditionOperatorSelects =
      propertiesPanel.shadowRoot?.querySelectorAll<HTMLSelectElement>(
        '[data-rule-condition-property="operator"]'
      );
    const numberValueInput = propertiesPanel.shadowRoot
      ?.querySelectorAll<HTMLElement>("[data-rule-condition-id]")[1]
      ?.querySelector<HTMLInputElement>('[data-rule-condition-property="value"]');
    expect(
      Array.from(conditionOperatorSelects?.[1]?.options ?? [], (option) => option.value)
    ).toEqual([
      "equals",
      "not-equals",
      // Identity applies to numbers too: a municipality code is "0180", and
      // "är någon av 0180, 1480" is exactly how somebody would ask for two of
      // them. The numeric four stay, because a number is also a quantity.
      "one-of",
      "not-one-of",
      "greater-than",
      "greater-than-or-equal",
      "less-than",
      "less-than-or-equal",
    ]);
    expect(numberValueInput?.type).toBe("number");

    const matchSelect = propertiesPanel.shadowRoot?.querySelector<HTMLSelectElement>(
      '[data-rule-case-property="match"]'
    );
    if (!matchSelect) {
      throw new Error("Kunde inte hitta valet för Alla eller Minst ett.");
    }
    await userEvent.selectOptions(matchSelect, "any");
    expect(
      (
        editor.getData().nodes.find((node) => node.id === createdRule?.id)?.data
          .cases as Array<{ match: string }> | undefined
      )?.[0]?.match
    ).toBe("any");

    const addCaseButton =
      propertiesPanel.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="add-rule-case"]'
      );

    if (!addCaseButton) {
      throw new Error("Kunde inte hitta Lägg till gren.");
    }

    await userEvent.click(addCaseButton);

    const updatedRule = editor
      .getData()
      .nodes.find((node) => node.id === createdRule?.id);
    const updatedCases = updatedRule?.data.cases as
      | Array<{ id: string }>
      | undefined;
    const updatedRuleElement = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === createdRule?.id);

    expect(updatedCases).toHaveLength(2);
    expect(
      updatedRuleElement?.getPortElement("output", updatedCases?.[1]?.id ?? "")
    ).not.toBeNull();

    const removeButtons = propertiesPanel.shadowRoot?.querySelectorAll<HTMLButtonElement>(
      '[data-action="remove-rule-case"]'
    );

    if (!removeButtons?.[1]) {
      throw new Error("Kunde inte hitta Ta bort villkor.");
    }

    const removedCaseId = updatedCases?.[1]?.id;
    await userEvent.click(removeButtons[1]);

    const finalRuleElement = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === createdRule?.id);

    expect(
      editor.getData().nodes.find((node) => node.id === createdRule?.id)?.data
        .cases
    ).toHaveLength(1);
    expect(
      finalRuleElement?.getPortElement("output", removedCaseId ?? "")
    ).toBeNull();
  });

  test("» opens the whole palette and « folds it, with focus on the arrow each time (story 146)", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    const palette = editor.shadowRoot!.querySelector<NodePalette>("node-palette")!;
    const opener = palette.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="palette-open"]')!;
    const seen: boolean[] = [];

    editor.addEventListener("palette-open-changed", (event) => {
      seen.push((event as CustomEvent<{ open: boolean }>).detail.open);
    });

    await userEvent.click(opener);
    const closer = palette.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="palette-close"]')!;

    expect(editor.paletteOpen).toBe(true);
    expect(opener.getAttribute("aria-expanded")).toBe("true");
    expect(opener.getAttribute("aria-label")).toBe("Öppna nodpaletten");
    expect(palette.shadowRoot!.activeElement).toBe(closer);

    await userEvent.click(closer);

    expect(editor.paletteOpen).toBe(false);
    expect(opener.getAttribute("aria-expanded")).toBe("false");
    expect(palette.shadowRoot!.activeElement).toBe(opener);
    expect(seen).toEqual([true, false]);
  });

  test("removes a node and its connections from the right-click menu", async () => {
    const { editor, nodeEditor } = await mountEditorAndSelectQuestion();
    const changes: GraphChangedDetail[] = [];
    const resultNode = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "result-no");
    const clickableResult =
      resultNode?.shadowRoot?.querySelector<HTMLElement>(".flow-node");

    if (!clickableResult) {
      throw new Error("Kunde inte hitta resultatnoden.");
    }

    editor.addEventListener("graph-changed", (event) => {
      changes.push(
        structuredClone((event as CustomEvent<GraphChangedDetail>).detail)
      );
    });

    await userEvent.click(clickableResult, { button: "right" });
    const clickedNodeRect = clickableResult.getBoundingClientRect();

    const removeButton =
      nodeEditor.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="remove-node"]'
      );

    if (!removeButton) {
      throw new Error("Kunde inte hitta nodens ta bort-meny.");
    }

    const menuRect = removeButton.parentElement?.getBoundingClientRect();

    if (!menuRect) {
      throw new Error("Kunde inte mäta nodens högerklicksmeny.");
    }

    expect(menuRect.left).toBeGreaterThanOrEqual(clickedNodeRect.left);
    expect(menuRect.left).toBeLessThanOrEqual(clickedNodeRect.right);
    expect(menuRect.top).toBeGreaterThanOrEqual(clickedNodeRect.top);
    expect(menuRect.top).toBeLessThanOrEqual(clickedNodeRect.bottom + 10);

    await userEvent.click(removeButton);

    const updatedGraph = editor.getData();

    expect(updatedGraph.nodes.some((node) => node.id === "result-no")).toBe(
      false
    );
    expect(
      updatedGraph.connections.some(
        (connection) =>
          connection.from.nodeId === "result-no" ||
          connection.to.nodeId === "result-no"
      )
    ).toBe(false);
    expect(changes.at(-1)?.reason).toBe("node-removed");
    expect(isGraphValid(updatedGraph)).toBe(true);
  });

  test("confirms removal of the start node and shows a lasting warning", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      ...structuredClone(graph),
      nodes: [
        ...structuredClone(graph.nodes),
        {
          id: "question-2",
          type: "question",
          position: { x: -350, y: 300 },
          data: { title: "Andra frågan", options: [] },
        },
      ],
    };

    const nodeEditor =
      editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const startNode = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === graph.startNodeId);
    const clickableStart =
      startNode?.shadowRoot?.querySelector<HTMLElement>(".flow-node");
    const confirmation =
      editor.shadowRoot?.querySelector<ConfirmationDialog>(
        "confirmation-dialog"
      );

    if (!nodeEditor || !clickableStart || !confirmation) {
      throw new Error("Kunde inte hitta startnodens borttagningsflöde.");
    }

    nodeEditor.centerNodeById("question");
    const startRect = clickableStart.getBoundingClientRect();
    clickableStart.dispatchEvent(
      new MouseEvent("contextmenu", {
        clientX: startRect.left + startRect.width / 2,
        clientY: startRect.top + startRect.height / 2,
        bubbles: true,
        composed: true,
      })
    );

    const removeButton =
      nodeEditor.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="remove-node"]'
      );

    if (!removeButton) {
      throw new Error("Kunde inte hitta startnodens ta bort-knapp.");
    }

    await userEvent.click(removeButton);

    const dialog =
      confirmation.shadowRoot?.querySelector<HTMLDialogElement>("dialog");
    const confirmButton =
      confirmation.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="confirm"]'
      );

    if (!dialog || !confirmButton) {
      throw new Error("Kunde inte hitta bekräftelsedialogen.");
    }

    expect(dialog.open).toBe(true);
    expect(confirmButton.textContent).toBe("Ta bort startnod");
    expect(editor.getData().startNodeId).toBe("question");

    await userEvent.click(confirmButton);

    const warning = editor.shadowRoot?.querySelector<HTMLElement>(
      "[data-start-node-warning]"
    );

    expect(editor.getData().startNodeId).toBeNull();
    expect(
      editor.getData().nodes.some((node) => node.id === "question-2")
    ).toBe(true);
    expect(warning?.hidden).toBe(false);
    expect(warning?.textContent).toContain("Guiden saknar startnod");
  });

  test("changes the start node via the right-click menu after confirmation", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    const graphWithNewStart: GraphData = {
      ...structuredClone(graph),
      nodes: [
        ...structuredClone(graph.nodes),
        {
          id: "question-2",
          type: "question",
          position: { x: -350, y: 300 },
          data: { title: "Ny start", options: [] },
        },
      ],
      connections: [
        ...structuredClone(graph.connections).filter(
          (connection) => connection.id !== "maybe-to-result"
        ),
        {
          id: "to-question-2",
          from: { nodeId: "question", portId: "maybe" },
          to: { nodeId: "question-2", portId: "input" },
        },
      ],
    };
    editor.graph = graphWithNewStart;

    const nodeEditor =
      editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const question2 = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "question-2");
    const clickableQuestion =
      question2?.shadowRoot?.querySelector<HTMLElement>(".flow-node");
    const confirmation =
      editor.shadowRoot?.querySelector<ConfirmationDialog>(
        "confirmation-dialog"
      );

    if (!nodeEditor || !question2 || !clickableQuestion || !confirmation) {
      throw new Error("Kunde inte hitta byte av startnod.");
    }

    nodeEditor.centerNodeById("question-2");
    const questionRect = clickableQuestion.getBoundingClientRect();
    clickableQuestion.dispatchEvent(
      new MouseEvent("contextmenu", {
        clientX: questionRect.left + questionRect.width / 2,
        clientY: questionRect.top + questionRect.height / 2,
        bubbles: true,
        composed: true,
      })
    );

    const setStartButton =
      nodeEditor.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="set-start-node"]'
      );
    const removeButton =
      nodeEditor.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="remove-node"]'
      );

    if (!setStartButton || !removeButton) {
      throw new Error("Kunde inte hitta Gör till startnod.");
    }

    const setStartRect = setStartButton.getBoundingClientRect();
    const removeRect = removeButton.getBoundingClientRect();

    expect(removeRect.top).toBeGreaterThanOrEqual(setStartRect.bottom);

    await userEvent.click(setStartButton);

    const confirmButton =
      confirmation.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="confirm"]'
      );

    if (!confirmButton) {
      throw new Error("Kunde inte hitta byt startnod-dialogen.");
    }

    expect(confirmButton.textContent).toBe("Gör till startnod");
    await userEvent.click(confirmButton);

    const updatedGraph = editor.getData();
    const previousStart = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "question");
    const newStart = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "question-2");

    expect(updatedGraph.startNodeId).toBe("question-2");
    expect(
      updatedGraph.connections.some(
        (connection) => connection.to.nodeId === "question-2"
      )
    ).toBe(false);
    expect(previousStart?.getPortElement("input", "input")).not.toBeNull();
    expect(newStart?.getPortElement("input", "input")).toBeNull();
  });

  test("makes a Page the start node via the menu and redraws it immediately", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    // The version marks the fixture as current, so the migration chain leaves it.
    editor.graph = {
      version: CURRENT_GRAPH_VERSION,
      startNodeId: "question",
      nodes: [
        {
          id: "question",
          type: "question",
          position: { x: 0, y: 0 },
          data: { title: "Fråga", options: [{ id: "yes", label: "Ja", value: "yes" }] },
        },
        { id: "page", type: "page", position: { x: 400, y: 0 }, data: { title: "Sida" } },
      ],
      connections: [],
    } as unknown as GraphData;

    const nodeEditor =
      editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const findPage = (): FlowNode | undefined =>
      Array.from(
        nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
      ).find((node) => node.nodeData?.id === "page");
    const clickablePage = findPage()?.shadowRoot?.querySelector<HTMLElement>(".flow-node");
    if (!nodeEditor || !clickablePage) {
      throw new Error("Kunde inte hitta Page-noden.");
    }

    const pageRect = clickablePage.getBoundingClientRect();
    clickablePage.dispatchEvent(
      new MouseEvent("contextmenu", {
        clientX: pageRect.left + pageRect.width / 2,
        clientY: pageRect.top + 10,
        bubbles: true,
        composed: true,
      })
    );

    const setStartButton =
      nodeEditor.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="set-start-node"]'
      );
    if (!setStartButton) {
      throw new Error("Kunde inte hitta Gör till startnod för en Page.");
    }
    await userEvent.click(setStartButton);

    // Regressionstest: tidigare dog klicket tyst i guide-editorn —
    // datan uppdaterades aldrig och Pagen ritades inte om som start.
    expect(editor.getData().startNodeId).toBe("page");
    const updatedPage = findPage();
    // Startmärket är en ▶-glyf numera, inte ordet — se flow-node-start-flag.
    expect(updatedPage?.shadowRoot?.querySelector(".flow-node__start-flag")).toBeTruthy();
    expect(updatedPage?.getPortElement("input", "input")).toBeNull();
  });

  test("does not offer start node for fields inside a Page", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 0, y: 0 }, data: { title: "Sida" } },
        {
          id: "field",
          type: "text-question",
          parentPageId: "page",
          order: 0,
          layout: { columnSpan: 12 },
          position: { x: 20, y: 112 },
          data: { title: "Namn", variableName: "name" },
        },
      ],
      connections: [],
    };

    const nodeEditor =
      editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const fieldNode = Array.from(
      nodeEditor?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "field");
    const clickableField = fieldNode?.shadowRoot?.querySelector<HTMLElement>(".flow-node");
    if (!nodeEditor || !clickableField) {
      throw new Error("Kunde inte hitta fältet i sidan.");
    }

    const fieldRect = clickableField.getBoundingClientRect();
    clickableField.dispatchEvent(
      new MouseEvent("contextmenu", {
        clientX: fieldRect.left + fieldRect.width / 2,
        clientY: fieldRect.top + 10,
        bubbles: true,
        composed: true,
      })
    );

    // The menu should show Remove, but not Make start node.
    expect(
      nodeEditor.shadowRoot?.querySelector('[data-action="remove-node"]')
    ).not.toBeNull();
    expect(
      nodeEditor.shadowRoot?.querySelector('[data-action="set-start-node"]')
    ).toBeNull();
  });

  test("imports a valid JSON file and reports what happened", async () => {
    const { editor } = await mountEditorAndSelectQuestion();
    const toolbar =
      editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const fileInput = toolbar?.shadowRoot?.querySelector<HTMLInputElement>(
      "[data-import-file]"
    );
    const { toast, message } = getToastElements(editor);
    const changes: GraphChangedDetail[] = [];
    const importedGraph: GraphData = {
      startNodeId: "imported-question",
      nodes: [
        {
          id: "imported-question",
          type: "question",
          position: { x: 100, y: 100 },
          data: {
            title: "Importerad fråga",
            options: [
              { id: "yes", label: "Ja", value: "yes" },
              { id: "no", label: "Nej", value: "no" },
            ],
          },
        },
      ],
      connections: [],
    };

    if (!fileInput || !message) {
      throw new Error("Kunde inte hitta importkontrollerna.");
    }

    editor.addEventListener("graph-changed", (event) => {
      changes.push(
        structuredClone((event as CustomEvent<GraphChangedDetail>).detail)
      );
    });

    await userEvent.upload(
      fileInput,
      new File([JSON.stringify(importedGraph)], "min-guide.json", {
        type: "application/json",
      })
    );

    // The guide is untouched until the question is answered.
    expect(editor.getData().startNodeId).not.toBe("imported-question");
    await confirmImport(editor);

    await expect.poll(() => editor.getData().startNodeId).toBe(
      "imported-question"
    );
    // The import migrates the unversioned graph: the title and the options'
    // labels are tagged with the source language.
    const migratedGraph = structuredClone(importedGraph);
    migratedGraph.nodes[0]!.data.title = { sv: "Importerad fråga" };
    (migratedGraph.nodes[0]!.data.options as Array<{ label: unknown }>)[0]!.label = { sv: "Ja" };
    (migratedGraph.nodes[0]!.data.options as Array<{ label: unknown }>)[1]!.label = { sv: "Nej" };
    /*
     * And the stamp. `getData()` says which format the guide is in, so that a
     * host storing what they got does not hand back a file that claims to be v1
     * — see `graph-stamp.browser.test.ts` for what that cost.
     */
    expect(editor.getData()).toEqual({ ...migratedGraph, version: CURRENT_GRAPH_VERSION });
    expect(message.textContent).toContain("min-guide.json har importerats");
    expect(toast.dataset.type).toBe("success");
    expect(changes.at(-1)?.reason).toBe("graph-imported");
  });

  test("keeps the guide and shows help when the import file is broken", async () => {
    const { editor } = await mountEditorAndSelectQuestion();
    const originalGraph = editor.getData();
    const toolbar =
      editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const fileInput = toolbar?.shadowRoot?.querySelector<HTMLInputElement>(
      "[data-import-file]"
    );
    const { toast, message } = getToastElements(editor);

    if (!fileInput || !message) {
      throw new Error("Kunde inte hitta importkontrollerna.");
    }

    await userEvent.upload(
      fileInput,
      new File(["{ trasig"], "trasig-guide.json", {
        type: "application/json",
      })
    );

    await expect.poll(() => message.textContent).toContain(
      "innehåller inte giltig JSON"
    );
    expect(message.textContent).toContain("trasig-guide.json");
    expect(toast.dataset.type).toBe("error");
    expect(toast.getAttribute("role")).toBe("alert");
    expect(editor.getData()).toEqual(originalGraph);
  });

  test("exporterar guiden som en namngiven JSON-fil", async () => {
    const { editor } = await mountEditorAndSelectQuestion();
    const toolbar =
      editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const exportButton = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="export"]'
    );
    const { toast, message } = getToastElements(editor);
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:flowweaver-test");
    const linkClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    if (!toolbar || !exportButton || !message) {
      throw new Error("Kunde inte hitta exportkontrollerna.");
    }

    await openToolbarMenu(toolbar, "file");
    await userEvent.click(exportButton);

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(linkClick).toHaveBeenCalledOnce();
    expect(message.textContent).toContain("flowweaver-guide.json");
    expect(toast.dataset.type).toBe("success");
  });

  test.runIf(PRO)("exporten stämplar inlämningens schema i guiden, och schemat går att exportera för sig", async () => {
    /*
     * Story 094: the schema travels inside the guide's JSON (meta.submissionSchema)
     * so a receiver always reads the version of the guide it came with, and it
     * can be handed over alone as <guide>.schema.json.
     */
    const { editor } = await mountEditorAndSelectQuestion();
    const toolbar = editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const exportButton = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="export"]');
    const schemaButton = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="export-schema"]');
    const { message } = getToastElements(editor);
    const blobs: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return "blob:flowweaver-test";
    });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    if (!toolbar || !exportButton || !schemaButton || !message) {
      throw new Error("Kunde inte hitta exportkontrollerna.");
    }

    await openToolbarMenu(toolbar, "file");
    await userEvent.click(exportButton);

    const exported = JSON.parse(await blobs[0]!.text()) as { meta?: { submissionSchema?: { properties: Record<string, unknown> } } };
    expect(exported.meta?.submissionSchema?.properties.answer).toMatchObject({ type: "string", enum: ["yes", "no", "maybe"] });
    expect(editor.getData().meta?.submissionSchema?.exportedAt).toBeTypeOf("string");

    await openToolbarMenu(toolbar, "file");
    await userEvent.click(schemaButton);

    expect(downloads).toEqual(["flowweaver-guide.json", "flowweaver-guide.schema.json"]);
    const schema = JSON.parse(await blobs[1]!.text()) as { properties: Record<string, unknown> };
    expect(Object.keys(schema.properties)).toEqual(["answer"]);
    expect(message.textContent).toContain("flowweaver-guide.schema.json");

    editor.capabilities = { importExport: false };
    expect(schemaButton.hidden).toBe(true);
  });

  test("shows the selected node's appearance and paths in the compact preview", async () => {
    const { editor, titleInput } = await mountEditorAndSelectQuestion();
    const previewButton = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-sidebar-mode="preview"]'
    );
    const propertiesPanel = editor.shadowRoot?.querySelector<HTMLElement>(
      '[data-sidebar-panel="properties"]'
    );
    const previewPanel = editor.shadowRoot?.querySelector<HTMLElement>(
      '[data-sidebar-panel="preview"]'
    );
    const preview = previewPanel?.querySelector<GuidePreview>("guide-preview");
    const restartButton = previewPanel?.querySelector<HTMLButtonElement>(
      '[data-action="prove-guide"]'
    );

    if (
      !previewButton ||
      !propertiesPanel ||
      !previewPanel ||
      !preview ||
      !restartButton
    ) {
      throw new Error("Kunde inte hitta sidopanelens preview-kontroller.");
    }

    await userEvent.click(titleInput);
    await userEvent.keyboard(" uppdaterad");
    const graphBeforePreview = editor.getData();

    await userEvent.click(previewButton);

    expect(propertiesPanel.hidden).toBe(true);
    expect(previewPanel.hidden).toBe(false);
    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Fråga uppdaterad"
    );

    expect(preview.shadowRoot?.textContent).toContain("Leder till: Ja-resultat");
    expect(editor.getData()).toEqual(graphBeforePreview);

    // The button runs the guide on the canvas now — same run as the Guide
    // menu — and the sidebar preview mirrors its first step.
    await userEvent.click(restartButton);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const provingBar = editor.shadowRoot
      ?.querySelector("node-editor")
      ?.shadowRoot?.querySelector<HTMLElement>("[data-proving-bar]");
    expect(provingBar?.hidden).toBe(false);
    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Fråga uppdaterad"
    );
    // The first step again: nothing passed, no step row (Astra 1/10, punkt 8).
    expect(preview.shadowRoot?.querySelector(".guide-preview__step-row")).toBeNull();
  });

  test("asks the user to select a node when none is chosen", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = graph;

    const previewTab = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-sidebar-mode="preview"]'
    );
    const preview = editor.shadowRoot?.querySelector<GuidePreview>(
      ".guide-editor__preview-panel guide-preview"
    );
    const openButton = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="preview-open-dialog"]'
    );
    if (!previewTab || !preview || !openButton) {
      throw new Error("Kunde inte hitta förhandsgranskningen.");
    }

    await userEvent.click(previewTab);

    expect(preview.shadowRoot?.textContent).toContain(
      "Markera en nod för att förhandsgranska den."
    );
    expect(preview.shadowRoot?.querySelector("h2")).toBeNull();
    expect(openButton.hidden).toBe(true);
  });

  test("restores the preview when a node is selected after a deselection", async () => {
    const { editor, nodeEditor } = await mountEditorAndSelectQuestion();
    const previewTab = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-sidebar-mode="preview"]'
    );
    const preview = editor.shadowRoot?.querySelector<GuidePreview>(
      ".guide-editor__preview-panel guide-preview"
    );

    if (!previewTab || !preview) {
      throw new Error("Kunde inte hitta förhandsgranskningen.");
    }

    await userEvent.click(previewTab);
    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe("Fråga");

    nodeEditor.selectNodeById(null);
    expect(preview.shadowRoot?.textContent).toContain(
      "Markera en nod för att förhandsgranska den."
    );

    nodeEditor.selectNodeById("result-no");

    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Nej-resultat"
    );
  });

  test("shows the parent page and highlights the field when a Page child is chosen", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Ansökan" } },
        { id: "name", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 0, data: { title: "Namn", variableName: "name" } },
        { id: "nickname", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 1, data: { title: "Smeknamn", variableName: "nickname" } },
        { id: "done", type: "result", position: { x: 900, y: 80 }, data: { title: "Klart" } },
      ],
      connections: [
        { id: "to-done", from: { nodeId: "page", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
      ],
    };

    const previewTab = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-sidebar-mode="preview"]'
    );
    const preview = editor.shadowRoot?.querySelector<GuidePreview>(
      ".guide-editor__preview-panel guide-preview"
    );
    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    if (!previewTab || !preview || !nodeEditor) {
      throw new Error("Kunde inte hitta förhandsgranskningen.");
    }

    await userEvent.click(previewTab);
    nodeEditor.selectNodeById("name");

    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe("Ansökan");
    const summaries = Array.from(
      preview.shadowRoot?.querySelectorAll(".guide-preview__page-field-summary") ?? []
    );
    expect(summaries.map((summary) => summary.textContent?.trim())).toEqual([
      "Namn",
      "Smeknamn",
    ]);
    const selected = preview.shadowRoot?.querySelector(
      ".guide-preview__page-field-summary--selected"
    );
    expect(selected?.textContent?.trim()).toBe("Namn");
    expect(preview.shadowRoot?.textContent).not.toContain("Leder ingenstans");

    nodeEditor.selectNodeById("nickname");
    expect(
      preview.shadowRoot
        ?.querySelector(".guide-preview__page-field-summary--selected")
        ?.textContent?.trim()
    ).toBe("Smeknamn");
  });

  test("can open the side panel's preview in a modal dialog", async () => {
    const { editor } = await mountEditorAndSelectQuestion();
    const previewTab = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-sidebar-mode="preview"]'
    );
    const openButton = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="preview-open-dialog"]'
    );
    const previewDialog =
      editor.shadowRoot?.querySelector<GuidePreviewDialog>(
        "guide-preview-dialog"
      );
    const dialog =
      previewDialog?.shadowRoot?.querySelector<HTMLDialogElement>("dialog");
    const preview =
      previewDialog?.shadowRoot?.querySelector<GuidePreview>("guide-preview");
    const closeButton =
      previewDialog?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="close"]'
      );

    if (
      !previewTab ||
      !openButton ||
      !dialog ||
      !preview ||
      !closeButton
    ) {
      throw new Error("Kunde inte hitta preview-dialogens kontroller.");
    }

    await userEvent.click(previewTab);
    await userEvent.click(openButton);

    expect(dialog.open).toBe(true);
    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Fråga"
    );

    await userEvent.click(closeButton);

    expect(dialog.open).toBe(false);
    expect(editor.shadowRoot?.activeElement).toBe(openButton);

    await userEvent.click(openButton);
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));

    expect(dialog.open).toBe(false);
    expect(editor.shadowRoot?.activeElement).toBe(openButton);
  });

  test("previews a selected node even when its connection has been removed", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      ...structuredClone(graph),
      connections: graph.connections.filter(
        (connection) => connection.to.nodeId !== "result-yes"
      ),
    };

    const nodeEditor =
      editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const previewTab = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-sidebar-mode="preview"]'
    );
    const sidebarPreview = editor.shadowRoot?.querySelector<GuidePreview>(
      ".guide-editor__preview-panel guide-preview"
    );
    const openButton = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="preview-open-dialog"]'
    );
    const dialogPreview = editor.shadowRoot
      ?.querySelector<GuidePreviewDialog>("guide-preview-dialog")
      ?.shadowRoot?.querySelector<GuidePreview>("guide-preview");

    if (
      !nodeEditor ||
      !previewTab ||
      !sidebarPreview ||
      !openButton ||
      !dialogPreview
    ) {
      throw new Error("Kunde inte hitta previewkontrollerna.");
    }

    nodeEditor.selectNodeById("result-yes");
    await userEvent.click(previewTab);

    expect(sidebarPreview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Ja-resultat"
    );
    expect(sidebarPreview.shadowRoot?.textContent).toContain(
      "Resultatet kan inte nås från startnoden."
    );
    expect(
      sidebarPreview.shadowRoot?.querySelector(".guide-preview__step")
    ).toBeNull();

    await userEvent.click(openButton);

    expect(dialogPreview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Ja-resultat"
    );
  });

  test("highlights possible paths to a result on the canvas", async () => {
    const { editor, nodeEditor } = await mountEditorAndSelectQuestion();
    const previewTab = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-sidebar-mode="preview"]'
    );
    const propertiesTab = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-sidebar-mode="properties"]'
    );

    if (!previewTab || !propertiesTab) {
      throw new Error("Kunde inte hitta sidopanelens flikar.");
    }

    nodeEditor.selectNodeById("result-no");
    await userEvent.click(previewTab);

    const highlighted = nodeEditor.shadowRoot?.querySelector<SVGPathElement>(
      '.node-editor__connection[data-connection-id="no-to-result"]'
    );
    const dimmed = nodeEditor.shadowRoot?.querySelector<SVGPathElement>(
      '.node-editor__connection[data-connection-id="yes-to-result"]'
    );
    const questionNode = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "question");
    const resultNode = Array.from(
      nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []
    ).find((node) => node.nodeData?.id === "result-no");
    const highlightedOutput = questionNode?.getPortElement("output", "no");
    const dimmedOutput = questionNode?.getPortElement("output", "yes");
    const highlightedInput = resultNode?.getPortElement("input", "input");

    expect(highlighted?.classList).toContain(
      "node-editor__connection--highlighted"
    );
    expect(dimmed?.classList).toContain("node-editor__connection--dimmed");
    expect(highlightedOutput?.classList).toContain(
      "flow-node__port--highlighted"
    );
    expect(highlightedInput?.classList).toContain(
      "flow-node__port--highlighted"
    );
    /*
     * The dimming moved from the circle to its row. A translucent circle let the
     * connection beneath it shine through — the lines are drawn in the layer
     * behind the nodes and the circle sits over them — so the row carries it
     * now: the label fades, the circle changes colour and stays opaque.
     */
    expect(
      dimmedOutput?.closest(".flow-node__port-row")?.hasAttribute("data-off-route"),
    ).toBe(true);

    await userEvent.click(propertiesTab);

    expect(
      nodeEditor.shadowRoot?.querySelector(
        ".node-editor__connection--highlighted"
      )
    ).toBeNull();
    expect(
      nodeEditor.shadowRoot?.querySelector(".node-editor__connection--dimmed")
    ).toBeNull();
    expect(highlightedOutput?.classList).not.toContain(
      "flow-node__port--highlighted"
    );
    expect(dimmedOutput?.classList).not.toContain("flow-node__port--dimmed");
  });

  test("confirms a reset in a modal dialog", async () => {
    const { editor } = await mountEditorAndSelectQuestion();
    const toolbar =
      editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const resetButton = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="reset"]'
    );
    const confirmation =
      editor.shadowRoot?.querySelector<ConfirmationDialog>(
        "confirmation-dialog"
      );
    const dialog =
      confirmation?.shadowRoot?.querySelector<HTMLDialogElement>("dialog");
    const cancelButton =
      confirmation?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="cancel"]'
      );
    const confirmButton =
      confirmation?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="confirm"]'
      );
    let resetRequests = 0;

    if (!toolbar || !resetButton || !dialog || !cancelButton || !confirmButton) {
      throw new Error("Kunde inte hitta återställningskontrollerna.");
    }

    editor.addEventListener("graph-reset-request", () => {
      resetRequests += 1;
    });

    await openToolbarMenu(toolbar, "file");
    await userEvent.click(resetButton);

    expect(resetRequests).toBe(0);
    expect(dialog.open).toBe(true);
    expect(cancelButton.textContent).toBe("Avbryt");
    expect(confirmButton.textContent).toBe("Återställ guide");

    await userEvent.click(cancelButton);

    expect(dialog.open).toBe(false);
    expect(resetRequests).toBe(0);

    await openToolbarMenu(toolbar, "file");
    await userEvent.click(resetButton);
    await userEvent.click(confirmButton);

    expect(resetRequests).toBe(1);
    expect(dialog.open).toBe(false);
  });

  test("shows and closes an accessible toast", async () => {
    const { editor } = await mountEditorAndSelectQuestion();
    const { toast, message, closeButton } = getToastElements(editor);

    editor.showToast({
      message: "Guiden är sparad.",
      type: "success",
      duration: 0,
    });

    expect(toast.hidden).toBe(false);
    expect(toast.getAttribute("role")).toBe("status");
    expect(toast.getAttribute("aria-live")).toBe("polite");
    expect(message.textContent).toBe("Guiden är sparad.");

    await userEvent.click(closeButton);

    expect(toast.hidden).toBe(true);
  });
  test("switches feature level without changing the graph's data", async () => {
    const { editor, nodeEditor, propertiesPanel } = await mountEditorAndSelectQuestion();
    const originalGraph = editor.getData();
    const palette = editor.shadowRoot?.querySelector<NodePalette>("node-palette");
    const toolbar = editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
    const sidebarPreview = editor.shadowRoot?.querySelector<GuidePreview>(
      ".guide-editor__preview-panel guide-preview"
    );

    if (!palette || !toolbar || !sidebarPreview) {
      throw new Error("Kunde inte hitta capability-styrda komponenter.");
    }

    editor.featureLevel = "basic";

    expect(editor.getAttribute("feature-level")).toBe("basic");
    expect(sidebarPreview.routeAnalysisEnabled).toBe(false);
    expect(
      palette.shadowRoot?.querySelector('button[data-node-type="calculation"]')
    ).toBeNull();
    expect(
      palette.shadowRoot?.querySelector('button[data-node-type="rule"]')
    ).not.toBeNull();
    expect(
      palette.shadowRoot?.querySelector('button[data-node-type="number-question"]')
    ).toBeNull();
    expect(
      palette.shadowRoot?.querySelector('button[data-node-type="text-question"]')
    ).toBeNull();
    expect(
      palette.shadowRoot?.querySelector('button[data-node-type="question"]')
    ).not.toBeNull();
    expect(
      palette.shadowRoot?.querySelector('button[data-node-type="result"]')
    ).not.toBeNull();    expect(
      palette.shadowRoot?.querySelector('button[data-node-type="page"]')
    ).toBeNull();
    expect(
      propertiesPanel.shadowRoot?.querySelector('[data-property="variableName"]')
    ).not.toBeNull();
    expect(
      propertiesPanel.shadowRoot?.querySelector('[data-property="title"]')
    ).not.toBeNull();
    expect(editor.getData()).toEqual(originalGraph);

    palette.dispatchEvent(
      new CustomEvent("node-type-add", {
        detail: { type: "calculation" },
        bubbles: true,
        composed: true,
      })
    );
    expect(editor.getData()).toEqual(originalGraph);

    editor.capabilities = { importExport: false };
    expect(
      toolbar.shadowRoot?.querySelector<HTMLElement>('[data-action="import"]')
        ?.hidden
    ).toBe(true);
    expect(
      toolbar.shadowRoot?.querySelector<HTMLElement>('[data-action="export"]')
        ?.hidden
    ).toBe(true);

    editor.featureLevel = "advanced";

    expect(
      palette.shadowRoot?.querySelector('button[data-node-type="rule"]')
    ).not.toBeNull();
    expect(
      propertiesPanel.shadowRoot?.querySelector('[data-property="variableName"]')
    ).not.toBeNull();
    expect(editor.capabilities.importExport).toBe(false);
    expect(sidebarPreview.routeAnalysisEnabled).toBe(true);
    expect(editor.getData()).toEqual(originalGraph);

    const graphWithCalc = structuredClone(originalGraph);
    graphWithCalc.nodes.push({
      id: "existing-calc",
      type: "calculation",
      position: { x: 700, y: 50 },
      data: { title: "Befintlig uträkning", assignments: [] },
    });
    editor.graph = graphWithCalc;
    editor.featureLevel = "basic";
    nodeEditor.selectNodeById("existing-calc");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(propertiesPanel.shadowRoot?.textContent).toContain(
      "ingår inte i den valda funktionsnivån"
    );
    expect(editor.getData()).toEqual(graphWithCalc);
  });
});

/**
 * Where a host says what is being edited.
 *
 * The editor knows nothing about versions, drafts or files, and should not. But
 * it is the only surface that survives full screen — it is the element that goes
 * full screen — so a line the host draws above it disappears exactly when
 * somebody is deepest in the work and most likely to have forgotten which
 * version they are writing in.
 */
describe("guide-editor: the host's context line", () => {
  test("nothing is drawn for a host that says nothing", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;

    document.body.append(editor);

    const strip = editor.shadowRoot!.querySelector<HTMLElement>("[data-context]")!;

    expect(strip.hidden).toBe(true);
    expect(getComputedStyle(strip).display).toBe("none");
  });

  test("and the strip appears once something is slotted in", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;
    const line = document.createElement("span");

    line.slot = "context";
    line.textContent = "Du redigerar: Version 1";
    editor.append(line);
    document.body.append(editor);

    // `slotchange` is delivered at the end of the microtask that assigned it.
    await Promise.resolve();

    const strip = editor.shadowRoot!.querySelector<HTMLElement>("[data-context]")!;

    expect(strip.hidden).toBe(false);
    expect(strip.querySelector("slot")?.assignedNodes()).toContain(line);
  });
});

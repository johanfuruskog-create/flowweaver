import { afterEach, beforeEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { getEditableLibrary, setLibrary } from "../../services/template-library";

import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * Story 088, the copy (Avgjort 3/9): a page with its fields is saved as a
 * *page template* through the node-template contract (006), and comes back
 * from the palette as a copy — a new page with new fields, the variable
 * names intact (AC 1 and 4). Linking waits until the copies are measured to
 * drift apart.
 */

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function graf() {
  return {
    startNodeId: "p1",
    nodes: [
      {
        id: "p1",
        type: "page",
        position: { x: 40, y: 40 },
        data: { title: { sv: "Kontaktuppgifter" } },
      },
      {
        id: "f-epost",
        type: "text-question",
        parentPageId: "p1",
        order: 1,
        position: { x: 0, y: 0 },
        data: { title: { sv: "E-post" }, variableName: "kontakt.epost" },
      },
      {
        id: "f-namn",
        type: "text-question",
        parentPageId: "p1",
        order: 0,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Namn" }, variableName: "kontakt.namn" },
      },
    ],
    connections: [],
  };
}

beforeEach(() => setLibrary([]));

afterEach(() => {
  document.body.replaceChildren();
  setLibrary([]);
});

async function montera(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1100px; height: 700px;";
  document.body.append(editor);
  editor.graph = graf();
  await settle();
  return editor;
}

const canvas = (editor: GuideEditor): NodeEditor =>
  editor.shadowRoot?.querySelector("node-editor") as NodeEditor;

const pageElement = (editor: GuideEditor): Element | undefined =>
  [...(canvas(editor).shadowRoot?.querySelectorAll("flow-node") ?? [])].find(
    (element) => element.getAttribute("data-node-id") === "p1" || (element as { nodeId?: string }).nodeId === "p1",
  );

/** Opens the page's ⋯-menu and returns the save-as-template item. */
function menyval(editor: GuideEditor): HTMLButtonElement | null {
  canvas(editor).selectNodeById("p1");
  pageElement(editor)!.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true }),
  );
  return canvas(editor).shadowRoot?.querySelector('[data-action="save-as-template"]') ?? null;
}

async function sparaSomMall(editor: GuideEditor, namn: string): Promise<void> {
  menyval(editor)!.click();
  await settle();
  const dialog = editor.shadowRoot?.querySelector("node-type-editor")?.shadowRoot;
  dialog!.querySelector<HTMLInputElement>("[data-name]")!.value = namn;
  dialog!.querySelector<HTMLButtonElement>('[data-action="create"]')!.click();
  await settle();
}

describe("saving a page as a template (AC 1)", () => {
  test("the page's menu offers it", async () => {
    const editor = await montera();

    expect(menyval(editor)?.textContent?.trim()).toBe("Spara som mall");
  });

  test("the template lands with the host, carrying the fields in order", async () => {
    const editor = await montera();

    await sparaSomMall(editor, "Kontakt");

    const [mall] = getEditableLibrary();
    expect(mall?.label).toBe("Kontakt");
    expect(mall?.base).toBe("page");
    expect(mall?.children?.map((child) => child.data.variableName)).toEqual([
      "kontakt.namn",
      "kontakt.epost",
    ]);
    // A recipe, not the nodes: nothing in it points back at the guide.
    expect(JSON.stringify(mall)).not.toContain("f-namn");
  });
});

describe("a page template from the palette (AC 4)", () => {
  test("gives a new page with new fields and the same variable names", async () => {
    const editor = await montera();
    await sparaSomMall(editor, "Kontakt");
    const key = getEditableLibrary()[0]!.type;

    editor.shadowRoot
      ?.querySelector("node-palette")
      ?.dispatchEvent(
        new CustomEvent("node-type-add", { detail: { type: key }, bubbles: true, composed: true }),
      );
    await settle();

    const nodes = editor.getData().nodes;
    const pages = nodes.filter((node) => node.type === "page");
    expect(pages).toHaveLength(2);

    const copy = pages.find((page) => page.id !== "p1")!;
    expect(copy.template).toBe(key);
    const fields = nodes
      .filter((node) => node.parentPageId === copy.id)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    expect(fields.map((field) => field.data.variableName)).toEqual([
      "kontakt.namn",
      "kontakt.epost",
    ]);
    // The original keeps its own fields; the copy's are new nodes.
    expect(nodes.filter((node) => node.parentPageId === "p1")).toHaveLength(2);
    expect(fields.map((field) => field.id)).not.toContain("f-namn");
    // A field comes with everything its type has, not only the template's data.
    expect(fields[0]?.data).toHaveProperty("cssClasses");
  });
});

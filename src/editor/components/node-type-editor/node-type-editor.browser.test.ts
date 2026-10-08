import { afterEach, describe, expect, test } from "vitest";

import "./node-type-editor";
import type { NodeTypeEditor } from "./node-type-editor";
import type { NodeTemplate } from "../../../viewer/types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

function mount(): NodeTypeEditor {
  const editor = document.createElement("node-type-editor") as NodeTypeEditor;
  document.body.append(editor);
  return editor;
}

function shadow(editor: NodeTypeEditor): ShadowRoot {
  if (!editor.shadowRoot) throw new Error("Editorn saknar shadow root.");
  return editor.shadowRoot;
}

const spec = (label: string): NodeTemplate => ({
  type: "custom-x",
  label,
  base: "question",
  values: { title: "Hej" },
});

describe("node-type-editor", () => {
  test("manage mode: lists templates and hides the create form", () => {
    const editor = mount();
    editor.open({ specs: [spec("Kommunval")], onCreate: () => {} });
    const root = shadow(editor);

    expect(root.querySelector("[data-list]")!.textContent).toContain("Kommunval");
    expect(root.querySelector<HTMLElement>("[data-form]")!.hidden).toBe(true);
  });

  test("tom lista tipsar om Spara som mall", () => {
    const editor = mount();
    editor.open({ specs: [], onCreate: () => {} });
    expect(shadow(editor).querySelector("[data-list]")!.textContent).toContain(
      "Spara som mall"
    );
  });

  test("capture mode: creates a template from a captured node", () => {
    const editor = mount();
    const created: NodeTemplate[] = [];
    editor.open({
      specs: [],
      onCreate: (created_spec) => created.push(created_spec),
      captured: spec(""),
      suggestedName: "Infoblock",
    });
    const root = shadow(editor);

    // The form shows and the name is pre-filled.
    expect(root.querySelector<HTMLElement>("[data-form]")!.hidden).toBe(false);
    expect(root.querySelector<HTMLInputElement>("[data-name]")!.value).toBe("Infoblock");

    root.querySelector<HTMLButtonElement>('[data-action="create"]')!.click();

    expect(created).toHaveLength(1);
    expect(created[0].label).toBe("Infoblock");
    expect(created[0].values.title).toBe("Hej");
    // Back to manage mode afterwards.
    expect(root.querySelector<HTMLElement>("[data-form]")!.hidden).toBe(true);
  });

  test("capture mode requires a name", () => {
    const editor = mount();
    const created: NodeTemplate[] = [];
    editor.open({ specs: [], onCreate: (s) => created.push(s), captured: spec("") });
    const root = shadow(editor);

    root.querySelector<HTMLButtonElement>('[data-action="create"]')!.click();

    expect(created).toHaveLength(0);
    expect(root.querySelector<HTMLElement>("[data-error]")!.hidden).toBe(false);
  });

  test("redigerar en malls namn via listan (uppdaterar samma mall)", () => {
    const editor = mount();
    const updates: Array<{ type: string; label: string }> = [];
    editor.open({
      specs: [{ ...spec("Kommunval"), icon: "☑" }],
      onCreate: () => {},
      onUpdate: (type, changes) => updates.push({ type, label: changes.label }),
    });
    const root = shadow(editor);

    root.querySelector<HTMLButtonElement>('[data-edit-type="custom-x"]')!.click();

    // The form shows pre-filled.
    expect(root.querySelector<HTMLElement>("[data-form]")!.hidden).toBe(false);
    expect(root.querySelector<HTMLInputElement>("[data-name]")!.value).toBe("Kommunval");
    expect(root.querySelector<HTMLInputElement>("[data-icon]")!.value).toBe("☑");

    root.querySelector<HTMLInputElement>("[data-name]")!.value = "Regionval";
    root.querySelector<HTMLButtonElement>('[data-action="create"]')!.click();

    expect(updates).toEqual([{ type: "custom-x", label: "Regionval" }]);
    expect(root.querySelector("[data-list]")!.textContent).toContain("Regionval");
    // Ingen ny mall skapades.
    expect(root.querySelectorAll("[data-list] li")).toHaveLength(1);
  });

  // Removing a template reaches every guide on the site. It must not happen on
  // one click, and the text must say what actually happens.
  describe("removal is confirmed", () => {
    function open(
      deleted: string[],
      usageCount?: (type: string) => number
    ): ShadowRoot {
      const editor = mount();
      editor.open({
        specs: [spec("Kommunval")],
        onCreate: () => {},
        onDelete: (t) => deleted.push(t),
        ...(usageCount ? { usageCount, baseLabel: () => "Fråga" } : {}),
      });
      return shadow(editor);
    }

    test("the first click removes nothing", () => {
      const deleted: string[] = [];
      const root = open(deleted);

      root.querySelector<HTMLButtonElement>('[data-delete-type="custom-x"]')!.click();

      expect(deleted).toEqual([]);
      expect(root.querySelector("[data-confirm-delete]")).not.toBeNull();
    });

    test("the confirmation says the template is shared", () => {
      const root = open([]);
      root.querySelector<HTMLButtonElement>('[data-delete-type="custom-x"]')!.click();

      expect(root.querySelector("[data-confirm-delete]")?.textContent).toContain(
        "kan användas i andra guider"
      );
    });

    test("och att noderna blir kvar och byter namn", () => {
      const root = open([], () => 3);
      root.querySelector<HTMLButtonElement>('[data-delete-type="custom-x"]')!.click();
      const text = root.querySelector("[data-confirm-delete]")?.textContent ?? "";

      // The count concerns the nodes; the template is one. "kommer ur den", not "dem".
      expect(text).toContain("3 noder i den här guiden kommer ur den");
      expect(text).toContain("heter Fråga igen");
    });

    test("a single node gets the singular", () => {
      const root = open([], () => 1);
      root.querySelector<HTMLButtonElement>('[data-delete-type="custom-x"]')!.click();

      expect(root.querySelector("[data-confirm-delete]")?.textContent).toContain(
        "1 nod i den här guiden"
      );
    });

    test("zero nodes is stated plainly, not as a zero", () => {
      const root = open([], () => 0);
      root.querySelector<HTMLButtonElement>('[data-delete-type="custom-x"]')!.click();

      expect(root.querySelector("[data-confirm-delete]")?.textContent).toContain(
        "Ingen nod i den här guiden"
      );
    });

    test("Keep cancels and leaves the template alone", () => {
      const deleted: string[] = [];
      const root = open(deleted);
      root.querySelector<HTMLButtonElement>('[data-delete-type="custom-x"]')!.click();

      root.querySelector<HTMLButtonElement>('[data-action="cancel-delete"]')!.click();

      expect(deleted).toEqual([]);
      expect(root.querySelector("[data-list]")!.textContent).toContain("Kommunval");
    });

    test("Remove the template actually does it", () => {
      const deleted: string[] = [];
      const root = open(deleted);
      root.querySelector<HTMLButtonElement>('[data-delete-type="custom-x"]')!.click();

      root.querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')!.click();

      expect(deleted).toEqual(["custom-x"]);
      expect(root.querySelector("[data-list]")!.textContent).toContain("Inga mallar ännu");
    });
  });
});

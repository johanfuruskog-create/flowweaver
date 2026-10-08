import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
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

const spec: NodeTemplate = {
  type: "custom-x",
  label: "Kommunval",
  base: "question",
  values: {},
};

describe("node-type-editor: create a new template from a base type", () => {
  test("Add template, choose a base type, create", () => {
    const editor = mount();
    const created: NodeTemplate[] = [];
    editor.open({ specs: [], onCreate: (s) => created.push(s) });
    const shadow = editor.shadowRoot!;

    // Starts in manage mode: the "Lägg till" button shows, the base type picker is hidden.
    const addNew = shadow.querySelector<HTMLButtonElement>('[data-action="add-new"]');
    expect(addNew).not.toBeNull();

    addNew!.click();
    const base = shadow.querySelector<HTMLSelectElement>("[data-base-template]");
    expect(base).not.toBeNull();
    base!.value = "text-question";
    shadow.querySelector<HTMLInputElement>("[data-name]")!.value = "Min textmall";
    shadow.querySelector<HTMLButtonElement>('[data-action="create"]')!.click();

    expect(created).toHaveLength(1);
    expect(created[0].label).toBe("Min textmall");
    // The template carries the base type, not a copy of its shape.
    expect(created[0].base).toBe("text-question");
    expect(created[0].values).toEqual({});
    // Hamnar i listan.
    expect(shadow.textContent).toContain("Min textmall");
  });

  // Tystnad hade sett ut som en trasig knapp.
  test("a base type that cannot be used gives a message", () => {
    const editor = mount();
    const created: NodeTemplate[] = [];
    editor.open({ specs: [], onCreate: (s) => created.push(s), baseTemplates: ["finns-inte"] });
    const shadow = editor.shadowRoot!;

    shadow.querySelector<HTMLButtonElement>('[data-action="add-new"]')!.click();
    shadow.querySelector<HTMLInputElement>("[data-name]")!.value = "Min mall";
    shadow.querySelector<HTMLButtonElement>('[data-action="create"]')!.click();

    expect(created).toHaveLength(0);
    const error = shadow.querySelector<HTMLElement>("[data-error]");
    expect(error?.hidden).toBe(false);
    expect(error?.textContent).toContain("Grundtypen går inte att använda");
  });

  test("the base type picker is limited to permitted base types", () => {
    const editor = mount();
    editor.open({ specs: [], onCreate: () => {}, baseTemplates: ["question"] });
    const shadow = editor.shadowRoot!;
    shadow.querySelector<HTMLButtonElement>('[data-action="add-new"]')!.click();
    const options = Array.from(
      shadow.querySelectorAll<HTMLOptionElement>("[data-base-template] option")
    ).map((option) => option.value);
    expect(options).toEqual(["question"]);
  });

  test("tomt namn ger fel och skapar inget", () => {
    const editor = mount();
    const created: NodeTemplate[] = [];
    editor.open({ specs: [], onCreate: (s) => created.push(s) });
    const shadow = editor.shadowRoot!;
    shadow.querySelector<HTMLButtonElement>('[data-action="add-new"]')!.click();
    shadow.querySelector<HTMLButtonElement>('[data-action="create"]')!.click();
    expect(created).toHaveLength(0);
    expect(shadow.querySelector("[data-error]")?.hasAttribute("hidden")).toBe(false);
  });
});

describe("node-type-editor: UI language (chrome)", () => {
  test("svenska som standard", () => {
    const editor = mount();
    editor.open({ specs: [], onCreate: () => {} });
    const shadow = editor.shadowRoot!;
    expect(shadow.querySelector("#node-type-editor-title")?.textContent).toBe("Nodmallar");
    expect(shadow.querySelector('[data-action="close"]')?.textContent).toBe("Stäng");
  });

  test("engelska via locale i open()", () => {
    const editor = mount();
    editor.open({ specs: [spec], onCreate: () => {}, locale: "en" });
    const shadow = editor.shadowRoot!;

    expect(shadow.querySelector("#node-type-editor-title")?.textContent).toBe(
      "Node templates"
    );
    expect(shadow.querySelector('[data-action="close"]')?.textContent?.trim()).toBe(
      "Close"
    );
    // The list's buttons and their (interpolated) aria labels in English.
    const edit = shadow.querySelector<HTMLButtonElement>("[data-edit-type]");
    expect(edit?.textContent?.trim()).toBe("Edit");
    expect(edit?.getAttribute("aria-label")).toBe("Edit the template Kommunval");
    const del = shadow.querySelector<HTMLButtonElement>("[data-delete-type]");
    expect(del?.getAttribute("aria-label")).toBe("Delete the template Kommunval");
  });

  test("English capture mode: heading, note and button", () => {
    const editor = mount();
    editor.open({
      specs: [],
      onCreate: () => {},
      captured: spec,
      suggestedName: "Test",
      locale: "en",
    });
    const shadow = editor.shadowRoot!;
    expect(shadow.querySelector("[data-form-heading]")?.textContent).toBe(
      "Save node as template"
    );
    expect(shadow.querySelector('[data-action="create"]')?.textContent?.trim()).toBe(
      "Create template"
    );
  });
});

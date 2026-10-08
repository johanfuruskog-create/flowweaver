import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { exampleGraph } from "../../../data/example-graph";

import type { EditorToolbar } from "../editor-toolbar/editor-toolbar";
import type { GuideEditor } from "./guide-editor";
import type { GuidePreview } from "../../../viewer/components/guide-preview/guide-preview";

/**
 * Pretend answers from the host in a run (story 085, AC 4). A guide that
 * leans on what a login gives cannot be tried without them; the field under
 * the preview tab hands them to the run, and names no node has are said.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

function mount(): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = structuredClone(exampleGraph);
  return editor;
}

async function startProving(editor: GuideEditor): Promise<void> {
  const toolbar = editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
  const trigger = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>('[data-menu-trigger="guide"]');
  const item = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="prove-guide"]');

  if (!trigger || !item) throw new Error("hittade inte Prova guiden i Guide-menyn");

  await userEvent.click(trigger);
  await userEvent.click(item);
  await settle();
  await settle();
}

describe("svar från värden i provet", () => {
  test("raderna når provet som given, och namnet ingen nod har står under fältet", async () => {
    const editor = mount();
    await settle();

    const root = editor.shadowRoot!;
    const field = root.querySelector<HTMLTextAreaElement>("[data-given]")!;
    field.value = "age = 34\nkundnummer = 42\n rad utan likhetstecken \n = tomt namn";
    field.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();

    const preview = root.querySelector<GuidePreview>("guide-preview")!;
    expect(preview.given).toEqual({ answers: { age: "34", kundnummer: "42" }, nodeId: null });
    expect(root.querySelector("[data-given-unmatched]")!.textContent).toBe("Ingen nod har: kundnummer");

    await startProving(editor);
    // The run starts on the age question with the host's number in the field.
    expect(preview.shadowRoot!.querySelector<HTMLInputElement>("input")!.value).toBe("34");
    expect(preview.getAnswers()).toMatchObject({ age: "34" });

    // Emptied: nothing given, nothing said.
    field.value = "";
    field.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    expect(preview.given).toBeNull();
    expect(root.querySelector("[data-given-unmatched]")!.textContent).toBe("");
  });
});

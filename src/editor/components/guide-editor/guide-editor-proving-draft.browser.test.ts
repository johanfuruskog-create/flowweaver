import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { EditorToolbar } from "../editor-toolbar/editor-toolbar";
import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "./guide-editor";
import type { GuidePreview } from "../../../viewer/components/guide-preview/guide-preview";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * What is being typed shows in BOTH mirrors of a run — not only what has been
 * answered.
 *
 * One engine, two mirrors (story 065): the panel and the canvas card draw the
 * same engine, so a Next in one is a Next in the other. A half-typed field
 * was the exception — it lived in the writing mirror's DOM alone, and the
 * panel stood empty until Next stored the page. Johan, reviewing the
 * known-answers film (6/9): "tycker det borde stå kommun = Umeå" — the panel
 * beside a card where Umeå had just been picked said nothing.
 *
 * The engine stays the only truth about answers. The writing mirror says what
 * it holds (`preview-draft-changed`), the shell hands that to the other
 * mirror as its draft, and the draft goes when the engine moves. No mirror
 * listens to the other: the shell knows, as it does for the step.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const KOMMUNER = [
  { id: "a", value: "2480", label: "Umeå" },
  { id: "b", value: "1881", label: "Kumla" },
];

const graph = {
  version: 10,
  startNodeId: "s",
  settings: { sourceLocale: "sv", locales: ["sv"] },
  nodes: [
    { id: "s", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
    {
      id: "namn",
      type: "text-question",
      position: { x: 20, y: 112 },
      parentPageId: "s",
      order: 0,
      layout: { columnSpan: 12 },
      data: { title: { sv: "Namn" }, variableName: "namn" },
    },
    {
      id: "kommun",
      type: "autocomplete-question",
      position: { x: 20, y: 200 },
      parentPageId: "s",
      order: 1,
      layout: { columnSpan: 12 },
      data: {
        title: { sv: "Kommun" },
        variableName: "kommun",
        source: "mock",
        mockItems: KOMMUNER,
        minChars: 2,
      },
    },
    { id: "r", type: "result", position: { x: 800, y: 0 }, data: { title: { sv: "Tack {{namn}}" } } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "s", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
  ],
};

type Picker = HTMLElement & { choices: Array<{ label: string; value: string }> };

async function mount(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = structuredClone(graph) as never;
  await settle(250);

  const toolbar = editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
  const trigger = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>('[data-menu-trigger="guide"]');
  const item = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="prove-guide"]');
  if (!trigger || !item) throw new Error("hittade inte Prova guiden i Guide-menyn");
  await userEvent.click(trigger);
  await userEvent.click(item);
  await settle(250);
  return editor;
}

function panel(editor: GuideEditor): GuidePreview {
  const found = editor.shadowRoot?.querySelector<GuidePreview>(".guide-editor__preview-panel guide-preview");
  if (!found) throw new Error("panelens förhandsvisning saknas");
  return found;
}

function card(editor: GuideEditor): GuidePreview {
  const canvas = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const node = [...(canvas?.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? [])].find(
    (element) => element.nodeId === "s",
  );
  const found = node?.shadowRoot?.querySelector<GuidePreview>("[data-visitor-preview]");
  if (!found) throw new Error("sidans kort saknar sin besökarvy");
  return found;
}

const field = (mirror: GuidePreview, name: string): HTMLInputElement => {
  const found = mirror.shadowRoot?.querySelector<HTMLInputElement>(`input[data-page-variable="${name}"]`);
  if (!found) throw new Error(`fältet ${name} saknas i spegeln`);
  return found;
};

const picker = (mirror: GuidePreview): Picker => {
  const found = mirror.shadowRoot?.querySelector<Picker>('chip-picker[data-page-variable="kommun"]');
  if (!found) throw new Error("kommunfältet saknas i spegeln");
  return found;
};

async function type(mirror: GuidePreview, name: string, text: string): Promise<void> {
  const input = field(mirror, name);
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
}

async function pick(mirror: GuidePreview, term: string): Promise<void> {
  const box = picker(mirror).shadowRoot?.querySelector<HTMLInputElement>("[data-search]");
  if (!box) throw new Error("ingen sökruta i kommunfältet");
  box.focus();
  box.value = term;
  box.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(400);
  picker(mirror).shadowRoot?.querySelector<HTMLButtonElement>("[data-add]")?.click();
  await settle();
}

describe("det som skrivs i den ena spegeln", () => {
  test("står i den andra — text och valt uppslag, från kortet till panelen", async () => {
    const editor = await mount();

    await type(card(editor), "namn", "Anna");
    expect(field(panel(editor), "namn").value).toBe("Anna");

    await pick(card(editor), "ume");
    expect(picker(card(editor)).choices.map((one) => one.label)).toEqual(["Umeå"]);
    expect(picker(panel(editor)).choices.map((one) => one.label)).toEqual(["Umeå"]);
    // The redraw of the panel must not take the focus from where one writes.
    expect(card(editor).shadowRoot?.activeElement).toBe(picker(card(editor)));
  });

  test("och från panelen till kortet", async () => {
    const editor = await mount();

    await type(panel(editor), "namn", "Bo");
    expect(field(card(editor), "namn").value).toBe("Bo");
  });

  test("och Nästa lagrar det i den enda motorn", async () => {
    // The draft is a picture of what is being typed; the answer is still the
    // engine's alone. A Next in the card, after typing there, and the panel
    // shows the result with the name — through the engine, not the draft.
    const editor = await mount();

    await type(card(editor), "namn", "Anna");
    await pick(card(editor), "ume");
    card(editor).shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
    await settle(300);

    expect(panel(editor).getCurrentNodeId()).toBe("r");
    expect(panel(editor).shadowRoot?.textContent).toContain("Tack Anna");
    expect(panel(editor).getAnswers().kommun).toEqual({ label: "Umeå", value: "2480" });
  });
});

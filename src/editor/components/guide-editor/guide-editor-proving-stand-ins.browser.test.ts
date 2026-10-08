import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "@vitest/browser/context";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { EditorToolbar } from "../editor-toolbar/editor-toolbar";
import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "./guide-editor";
import type { GuidePreview } from "../../../viewer/components/guide-preview/guide-preview";
import type { NodeEditor } from "../node-editor/node-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Provets ersättningssvar sedda genom hela editorn — story 065:s uppföljning,
 * vända två.
 *
 * De egna proven på `guide-preview` satte `proving` för hand och missade
 * därför det som gick sönder på bygget: attributet sattes EFTER den ritning
 * som skulle burit knappen. Filsteget räddades av att valideringsfelet ritade
 * om, kartsteget hade ingen omritning alls — och där fastnade provet, för
 * Nästa är avstängd utan etikett och knappen som skulle gett en fanns inte.
 *
 * Vägen in är därför menyn *Guide → Prova guiden* på en monterad editor, som
 * på riktigt, och påståendena gäller den FÖRSTA ritningen av varje steg.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const graph = (): GraphData => ({
  startNodeId: "f",
  nodes: [
    {
      id: "f",
      type: "file-question",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Bild på skadan" },
        variableName: "bild",
        required: true,
        accept: "image/*",
        allowMarking: true,
      },
    },
    {
      id: "m",
      type: "map-question",
      position: { x: 520, y: 0 },
      data: {
        title: { sv: "Var är skadan?" },
        variableName: "plats",
        kind: "point",
        required: true,
      },
    },
    { id: "r", type: "result", position: { x: 1040, y: 0 }, data: { title: { sv: "Tack" } } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "f", portId: "continue" }, to: { nodeId: "m", portId: "input" } },
    { id: "c2", from: { nodeId: "m", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
  ],
});

function mount(): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = graph();
  return editor;
}

function canvas(editor: GuideEditor): NodeEditor {
  const found = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

  if (!found) throw new Error("node-editor saknas");
  return found;
}

function nodeElement(editor: GuideEditor, id: string): FlowNode {
  const found = [
    ...(canvas(editor).shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []),
  ].find((element) => element.nodeId === id);

  if (!found) throw new Error(`ingen nod med id ${id}`);
  return found;
}

/** Den levande vyn i noden man står på — provets ena spegel. */
function liveView(editor: GuideEditor, id: string): ShadowRoot {
  const preview = nodeElement(editor, id).shadowRoot?.querySelector<GuidePreview>(
    "[data-visitor-preview]",
  );

  if (!preview?.shadowRoot) throw new Error(`ingen besökarvy i ${id}`);
  return preview.shadowRoot;
}

async function startProving(editor: GuideEditor): Promise<void> {
  const toolbar = editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
  const trigger = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
    '[data-menu-trigger="guide"]',
  );
  const item = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
    '[data-action="prove-guide"]',
  );

  if (!trigger || !item) throw new Error("hittade inte Prova guiden i Guide-menyn");

  await userEvent.click(trigger);
  await userEvent.click(item);
  await settle();
  await settle();
}

describe("provets ersättningssvar genom editorn", () => {
  test("filsteget bär knappen redan vid provets första ritning", async () => {
    const editor = mount();

    await settle();
    await startProving(editor);

    const view = liveView(editor, "f");

    expect(view.querySelector('input[type="file"]')).toBeNull();
    expect(view.querySelector("[data-proving-file]")?.textContent?.trim()).toBe(
      "Lägg till provbild",
    );
  });

  test("kartsteget bär knappen och provkartan när provet kommer dit", async () => {
    const editor = mount();

    await settle();
    await startProving(editor);

    const file = liveView(editor, "f");

    await userEvent.click(file.querySelector<HTMLButtonElement>("[data-proving-file]")!);
    await settle();
    await userEvent.click(file.querySelector<HTMLButtonElement>('[data-action="next"]')!);
    await settle();
    await settle();

    const map = liveView(editor, "m");

    // Ingenting tryckt på kartsteget: knappen och provkartan ska stå där
    // direkt, annars går steget inte att lämna alls.
    expect(map.querySelector("[data-proving-place]")?.textContent?.trim()).toBe(
      "Peka ut provplats",
    );
    expect(map.querySelector("[data-proving-map-still]")).not.toBeNull();
  });

  test("provet går hela vägen till resultatet utan en enda riktig fil", async () => {
    const editor = mount();

    await settle();
    await startProving(editor);

    const file = liveView(editor, "f");

    await userEvent.click(file.querySelector<HTMLButtonElement>("[data-proving-file]")!);
    await settle();
    await userEvent.click(file.querySelector<HTMLButtonElement>('[data-action="next"]')!);
    await settle();
    await settle();

    const map = liveView(editor, "m");

    await userEvent.click(map.querySelector<HTMLButtonElement>("[data-proving-place]")!);
    await settle();
    await userEvent.click(map.querySelector<HTMLButtonElement>('[data-action="next"]')!);
    await settle();
    await settle();

    expect(canvas(editor).proving?.currentNodeId).toBe("r");
  });

  test("knappen heter det som står på den", async () => {
    const editor = mount();

    await settle();
    await startProving(editor);

    /*
     * WCAG "label in name": den synliga texten måste finnas i det
     * tillgängliga namnet. Knappen bar fältets id, så fältets <label for>
     * döpte om den till "Bild på skadan (obligatoriskt)" — mätt på bygget
     * som två träffar på fältets rubrik och noll på knappens text.
     */
    const button = liveView(editor, "f").querySelector<HTMLButtonElement>(
      "[data-proving-file]",
    )!;

    expect(button.labels?.length ?? 0).toBe(0);
    expect(button.getAttribute("aria-labelledby")).toBeNull();
    expect(button.getAttribute("aria-describedby")).toBe("page-file-label-f");

    // Mätningen på bygget, vänd rätt: fältets rubrik gav två knappar och
    // knappens egen text noll. Två, för provet har två speglar — panelen och
    // noden — och båda ska gå att be om vid namn.
    expect(page.getByRole("button", { name: /Bild på skadan/ }).elements().length).toBe(0);
    expect(page.getByRole("button", { name: "Lägg till provbild" }).elements().length).toBe(2);
  });

  test("golvtexten står inte kvar under en bild av en karta", async () => {
    const editor = mount();

    await settle();
    await startProving(editor);

    const file = liveView(editor, "f");

    await userEvent.click(file.querySelector<HTMLButtonElement>("[data-proving-file]")!);
    await settle();
    await userEvent.click(file.querySelector<HTMLButtonElement>('[data-action="next"]')!);
    await settle();
    await settle();

    const map = liveView(editor, "m");

    expect(map.querySelector(".guide-preview__map-note")).toBeNull();
    // Golvet självt står kvar: den som vill skriva platsen i ord ska kunna.
    expect(map.querySelector("input[data-map-label]")).not.toBeNull();
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * A page's repeat settings (story 084) sit behind the *Kan upprepas* switch.
 *
 * Five fields for a page that does not repeat are five boxes asking to be
 * filled in, so they are drawn only once the switch is on — and they have to
 * appear on the switch itself, not after the editor has clicked elsewhere and
 * back. The panel never redraws on its own change (a redraw under a typing
 * cursor loses the cursor), so the switch is the one control that asks for a
 * redraw, and focus must come back to it afterwards.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function panelWithPageSelected(data: Record<string, unknown> = {}): Promise<{
  editor: GuideEditor;
  root: ShadowRoot;
}> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1300px; height: 900px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "p1",
    nodes: [
      { id: "p1", type: "page", position: { x: 40, y: 40 }, data: { title: "Barn", ...data } },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  (
    editor.shadowRoot!.querySelector("node-editor") as unknown as {
      selectNodeById?(id: string): void;
    }
  ).selectNodeById?.("p1");

  await settle();
  await settle();

  const panel = editor.shadowRoot!.querySelector("properties-panel");

  if (!panel?.shadowRoot) throw new Error("properties-panel saknas.");

  return { editor, root: panel.shadowRoot };
}

const field = (root: ShadowRoot, id: string) =>
  root.querySelector<HTMLInputElement>(`[data-property="${id}"]`);

describe("upprepningens inställningar på en sida", () => {
  test("en sida som inte upprepas visar bara strömbrytaren", async () => {
    const { root } = await panelWithPageSelected();

    expect(field(root, "repeats"), "Kan upprepas saknas").not.toBeNull();
    expect(field(root, "repeats")!.checked).toBe(false);

    for (const id of ["repeatWord", "repeatVariable", "repeatMin", "repeatMax", "addLabel"]) {
      expect(field(root, id), `${id} visas fast sidan inte upprepas`).toBeNull();
    }
  });

  test("slås den på kommer fälten fram — och fokus stannar på brytaren", async () => {
    const { editor, root } = await panelWithPageSelected();
    const toggle = field(root, "repeats")!;

    toggle.focus();
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();

    for (const id of ["repeatWord", "repeatVariable", "repeatMin", "repeatMax", "addLabel"]) {
      expect(field(root, id), `${id} kom inte fram`).not.toBeNull();
    }

    const focused = root.activeElement as HTMLInputElement | null;

    expect(focused?.dataset.property, "fokus lämnade brytaren").toBe("repeats");
    expect(
      editor.getData().nodes[0]!.data.repeats,
      "grafen fick inte värdet",
    ).toBe(true);
  });

  test("en sparad upprepad sida öppnas med fälten framme", async () => {
    const { root } = await panelWithPageSelected({
      repeats: true,
      repeatWord: "barn",
      repeatVariable: "barn",
    });

    expect(field(root, "repeatWord")?.value).toBe("barn");
    expect(field(root, "repeatVariable")?.value).toBe("barn");
  });
});

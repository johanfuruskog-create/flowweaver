import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * With nothing selected the panel shows the guide's settings, and the
 * viewer's texts are 127 fields on an empty guide — a wall a new editor read
 * as *the* panel (measured 3/9). They sit folded under their heading and open
 * when asked; what a person opened stays open while the panel re-renders.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = { startNodeId: null, nodes: [], connections: [] } as never;
  await settle();
  await settle();
  return editor;
}

const detailsOf = (editor: GuideEditor) =>
  editor.shadowRoot!
    .querySelector("properties-panel")!
    .shadowRoot!.querySelector<HTMLDetailsElement>("details[data-ui-texts]");

describe("visartexterna i panelen", () => {
  test("ligger hopfällda under sin rubrik", async () => {
    const editor = await mount();
    const details = detailsOf(editor);

    expect(details, "visartexterna är en details").not.toBeNull();
    expect(details!.open).toBe(false);
    expect(details!.querySelector("summary")?.textContent?.trim()).toBe("Visartexter");
    expect(details!.querySelectorAll("[data-guide-string]").length).toBeGreaterThan(50);
  });

  /*
   * Johan, from the phone 3/9: the labels sat glued to the field above.
   * Two causes, both measured at 0 px: the section's flex gap never reaches
   * into a details, and a `:not([open])` rule meant for the details matched
   * every section too. The distance is the same as between the guide's own
   * fields, open or not.
   */
  test("fälten håller samma avstånd som guidens egna", async () => {
    const editor = await mount();
    const panel = editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;
    const gapIn = (root: Element) => {
      const fields = [...root.querySelectorAll(".properties-panel__field")];
      return fields[1]!.getBoundingClientRect().top - fields[0]!.getBoundingClientRect().bottom;
    };
    const details = detailsOf(editor)!;

    details.open = true;
    await settle();
    expect(gapIn(details)).toBe(16);
    expect(gapIn(panel.querySelector("section.properties-panel__guide")!)).toBe(16);
  });

  test("förblir öppna när panelen ritas om", async () => {
    const editor = await mount();
    const details = detailsOf(editor)!;

    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    await settle();
    // A re-render: the guide's settings change (a language added).
    editor.graph = { ...editor.graph!, settings: { locales: ["sv", "en", "fi"] } } as never;
    await settle();
    await settle();

    expect(detailsOf(editor)!.open).toBe(true);
  });
});

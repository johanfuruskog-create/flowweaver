import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { registerLocale, unregisterLocale } from "../../../viewer/localization/registry";
import { reachableViewerKeys } from "../../services/reachable-viewer-keys";

import type { GuideEditor } from "./guide-editor";
import type { PropertiesPanel } from "../properties-panel/properties-panel";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * The jump reaches the viewer's own texts too — story 017, criterion 1.
 *
 * Arabic, not English: English is a language we ship, so its 55 viewer texts
 * arrive already satisfied and there would be nothing to jump to. Arabic is the
 * case the story is about — the one where a guide showed 100% while a resident
 * met Swedish buttons.
 */

function graph(): GraphData {
  return {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Bor du i kommunen?", ar: "هل تعيش في البلدية؟" },
          variableName: "bor",
          options: [{ id: "ja", label: { sv: "Ja", ar: "نعم" }, value: "ja" }],
        },
      },
    ],
    connections: [],
    settings: { locales: ["sv", "ar"] },
  };
}

afterEach(() => {
  document.body.replaceChildren();
  unregisterLocale("ar");
});

/** Same guide with the question left untranslated, so a node stop exists. */
function graphWithNodeStop(): GraphData {
  return {
    ...graph(),
    nodes: [
      {
        ...graph().nodes[0],
        data: {
          title: { sv: "Bor du i kommunen?" },
          variableName: "bor",
          options: [],
        },
      },
    ],
  };
}

function mount(data = graph()): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it
  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1100px; height: 700px;";
  document.body.append(editor);
  editor.graph = data;
  return editor;
}

const root = (editor: GuideEditor): ShadowRoot =>
  editor.shadowRoot as ShadowRoot;

const panel = (editor: GuideEditor): ShadowRoot =>
  editor.shadowRoot?.querySelector<PropertiesPanel>("properties-panel")
    ?.shadowRoot as ShadowRoot;

function chooseArabic(editor: GuideEditor): void {
  editor.shadowRoot?.dispatchEvent(
    new CustomEvent("locale-change", {
      detail: { locale: "ar" },
      bubbles: true,
      composed: true,
    }),
  );
}

/**
 * Jumps and waits a frame.
 *
 * Selecting a node re-renders the panel on the next frame, so reading it
 * straight after the click measures the previous view. A first attempt at the
 * test below did exactly that and passed for the wrong reason.
 */
const jump = async (editor: GuideEditor): Promise<void> => {
  root(editor)
    .querySelector<HTMLButtonElement>('[data-action="next-untranslated"]')
    ?.click();
  await new Promise((done) => requestAnimationFrame(done));
};

const focusedKey = (editor: GuideEditor): string | null =>
  panel(editor).activeElement?.getAttribute("data-guide-string") ?? null;

describe("the button counts both kinds of stop", () => {
  // Counting only the nodes would offer a button saying nothing remains while
  // the buttons a resident clicks are still Swedish.
  test("a fully translated guide still has its viewer texts outstanding", () => {
    const editor = mount();
    chooseArabic(editor);

    const button = root(editor).querySelector('[data-action="next-untranslated"]');

    expect(button).not.toBeNull();
  });

  /*
   * The guide's content is fully translated here, so every stop the button
   * offers is a viewer text — the ones *this* guide can show. Counting the
   * whole table told a translator of an eight-node guide that fifty-odd things
   * remained, most of which that guide never renders. Story 017, question 1.
   */
  test("the count is the viewer's texts this guide can show", () => {
    const editor = mount();
    chooseArabic(editor);

    const aria = root(editor)
      .querySelector('[data-action="next-untranslated"]')
      ?.getAttribute("aria-label");

    expect(aria).toContain(String(reachableViewerKeys(graph()).length));
  });

  test("and a key the host supplied is not among them", () => {
    registerLocale("ar", { "nav.next": "التالي" });
    const editor = mount();
    chooseArabic(editor);

    const aria = root(editor)
      .querySelector('[data-action="next-untranslated"]')
      ?.getAttribute("aria-label");

    expect(aria).toContain(String(reachableViewerKeys(graph()).length - 1));
  });
});

describe("landing on a viewer text", () => {
  test("the jump reaches one and puts the cursor in it", async () => {
    const editor = mount();
    chooseArabic(editor);

    await jump(editor); // the node
    await jump(editor); // the first viewer text

    expect(focusedKey(editor)).not.toBeNull();
  });

  /*
   * `[data-guide-string]` alone does not discriminate — the panel keeps those
   * fields around with a node selected too, which a sabotage revealed. The
   * language list is rendered only in the guide-settings view, so it is the
   * honest signal that the selection was cleared.
   */
  test("it clears the node selection, which is what shows the guide's texts", async () => {
    // A guide with a node stop, so the first jump genuinely lands on the
    // canvas. The default fixture's content is already Arabic, and the first
    // jump would go straight to a viewer text — which is how this assertion
    // passed for the wrong reason on the first attempt.
    const editor = mount(graphWithNodeStop());
    chooseArabic(editor);

    await jump(editor);
    // The language boxes only exist on the guide's own settings, so their
    // presence is what "the panel left the node" looks like.
    const whileOnNode = panel(editor).querySelector("[data-locale-offered]");
    await jump(editor);

    expect({
      onNode: whileOnNode !== null,
      onViewerText: panel(editor).querySelector("[data-locale-offered]") !== null,
    }).toEqual({ onNode: false, onViewerText: true });
  });

  test("a second jump moves on rather than staying put", async () => {
    const editor = mount();
    chooseArabic(editor);

    await jump(editor);
    await jump(editor);
    const first = focusedKey(editor);
    await jump(editor);

    expect(focusedKey(editor)).not.toBe(first);
  });
});

describe("nodes come before the viewer's texts", () => {
  // The questions are what the guide is about; the buttons carry a resident
  // between them. Both are content, but only one has a place on the canvas.
  test("the first jump goes to the node", async () => {
    const editor = mount(graphWithNodeStop());
    chooseArabic(editor);

    await jump(editor);

    expect(focusedKey(editor)).toBeNull();
  });
});

describe("a satisfied text is not a stop", () => {
  test("a key the host registered is skipped", async () => {
    registerLocale("ar", { "nav.next": "التالي" });
    const editor = mount();
    chooseArabic(editor);

    const stops = new Set<string>();
    for (let i = 0; i < 6; i += 1) {
      await jump(editor);
      const key = focusedKey(editor);
      if (key) stops.add(key);
    }

    expect([...stops]).not.toContain("nav.next");
  });
});

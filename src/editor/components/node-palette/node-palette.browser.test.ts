import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./node-palette";

import { getEditorCapabilities } from "../../config/editor-capabilities";

afterEach(() => {
  document.body.replaceChildren();
});

function montera(): HTMLElement {
  const palette = document.createElement("node-palette");
  document.body.append(palette);
  return palette;
}

describe("node-palette", () => {
  // The palette exists to be dragged from. A press that does not land on a
  // button — on a group HEADING or in the gap — otherwise started a text
  // selection that swept down the panel and blue-highlighted the labels under
  // the grip. The buttons themselves were protected, because the drag handler
  // calls `preventDefault`; it was the space between them that had no guard.
  test("nothing in the palette can be text-selected", () => {
    const palette = montera();

    const ytor = [
      palette,
      ...(palette.shadowRoot?.querySelectorAll<HTMLElement>(
        ".node-palette, .node-palette__items, .node-palette__items button",
      ) ?? []),
    ];

    expect(ytor.length).toBeGreaterThan(1);

    for (const yta of ytor) {
      expect(
        getComputedStyle(yta).userSelect,
        `${yta.className || yta.tagName} går att markera`,
      ).toBe("none");
    }
  });

  // The guard sits on :host and is inherited downwards. The palette has no
  // fields today, but if a search box is added it must be selectable.
  test("an input field in the palette is exempt", () => {
    const palette = montera();

    const field = document.createElement("input");
    palette.shadowRoot?.querySelector(".node-palette")?.append(field);

    expect(getComputedStyle(field).userSelect).toBe("text");
  });
});

/**
 * A template is offered exactly when the node it would create is.
 *
 * The templates are not node types and are gathered in a group of their own, so
 * the capability filter that thins the registry never touched them. A template
 * built on a text question therefore showed up in basic mode, where text
 * questions are off — and clicking it added nothing at all. No node, no error,
 * no message. Somebody testing the tool concludes they did it wrong, and the
 * one thing you were there to learn is now about your palette.
 *
 * Found while cutting the user-test page down to five node types: three buttons
 * marked @, ☎ and # sat there doing nothing.
 */
const templates = () => [
  {
    type: "nodmall-email",
    base: "number-question",
    label: "E-post",
    data: {},
  },
  {
    type: "nodmall-val",
    base: "question",
    label: "Ja eller nej",
    data: {},
  },
];

const offered = (palette: HTMLElement) =>
  [
    ...(palette.shadowRoot?.querySelectorAll<HTMLElement>("[data-node-type]") ??
      []),
  ].map((button) => button.dataset.nodeType);

describe("templates and what the level allows", () => {
  test("a template built on a type this level has is offered", () => {
    const palette = montera() as HTMLElement & {
      capabilities: unknown;
      templates: unknown;
    };

    palette.capabilities = getEditorCapabilities("basic");
    palette.templates = templates();

    // `question` is in basic, so the template built on it belongs there too.
    expect(offered(palette)).toContain("nodmall-val");
  });

  test("and one built on a type it does not have is not", () => {
    const palette = montera() as HTMLElement & {
      capabilities: unknown;
      templates: unknown;
    };

    palette.capabilities = getEditorCapabilities("basic");
    palette.templates = templates();

    /*
     * Text questions are off in basic. A button that cannot do anything is
     * worse than a missing one: the missing one asks no questions.
     */
    expect(offered(palette)).not.toContain("nodmall-email");
  });

  test("but both are offered where both types exist", () => {
    const palette = montera() as HTMLElement & {
      capabilities: unknown;
      templates: unknown;
    };

    palette.capabilities = getEditorCapabilities("advanced");
    palette.templates = templates();

    expect(offered(palette)).toEqual(
      expect.arrayContaining(["nodmall-val", "nodmall-email"]),
    );
  });
});

/*
 * K6 (genomgången 30/9, rad E1, and story 146 criterion 2): the rail's
 * buttons — » and one per category — hold 44 px in the editor. Measured in
 * 2026-09 before: 41 × 36 for the folded icons.
 *
 * Mounted in a real editor, because the rail's width is the editor's
 * (`guide-editor.scss`), not the palette's own.
 */
describe("the rail", () => {
  test("every button on it is at least 44 × 44, with 8 px between the categories", async () => {
    await import("../guide-editor/guide-editor");
    const editor = document.createElement("guide-editor");
    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 1000px; height: 800px;";
    document.body.append(editor);

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const palette = editor.shadowRoot!.querySelector("node-palette")!;
    const buttons = [...palette.shadowRoot!.querySelectorAll<HTMLElement>(".node-palette > button, .node-palette__category")];

    expect(palette.getBoundingClientRect().width).toBe(57);
    expect(buttons.length).toBeGreaterThan(3);
    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      expect(rect.width, button.getAttribute("aria-label") ?? "").toBeGreaterThanOrEqual(44);
      expect(rect.height, button.getAttribute("aria-label") ?? "").toBeGreaterThanOrEqual(44);
    }

    const categories = buttons.slice(1).map((button) => button.getBoundingClientRect());

    for (let index = 1; index < categories.length; index += 1) {
      expect(categories[index].top - categories[index - 1].bottom).toBe(8);
    }
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import type { PropertiesPanel } from "../properties-panel/properties-panel";
import type { GraphData } from "../../../viewer/types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

function graf(): GraphData {
  return {
    startNodeId: "q1",
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Är du folkbokförd?" },
          variableName: "folkbokford",
          options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }],
        },
      },
      { id: "r1", type: "result", position: { x: 300, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "r1", portId: "input" } },
    ],
  };
}

/**
 * What the palette is drawn as — not what the attribute claims.
 *
 * This test read `palette.hidden` and was green while the palette was on
 * screen: `node-palette.scss` set `:host { display: block }`, which beats the
 * user agent's rule for `[hidden]`. A green test that could not see the fault
 * — PRAXIS 16.
 */
function palettensDisplay(editor: GuideEditor): string {
  const palette = editor.shadowRoot?.querySelector<HTMLElement>("node-palette");
  if (!palette) throw new Error("node-palette saknas");
  return getComputedStyle(palette).display;
}

function montera(mode?: string): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.style.cssText = "display: block; width: 1100px; height: 700px;";

  if (mode) {
    editor.setAttribute("mode", mode);
  }

  document.body.append(editor);
  editor.graph = graf();

  // Markeringen går via canvasen, inte via editorn.
  editor.shadowRoot
    ?.querySelector<NodeEditor>("node-editor")
    ?.selectNodeById("q1");

  return editor;
}

/**
 * Switches language the way the app does it: the toolbar fires `locale-change`.
 * `activeLocale` on the editor is an internal field, not a public API.
 */
function chooseLanguage(editor: GuideEditor, locale: string): void {
  editor.shadowRoot?.dispatchEvent(
    new CustomEvent("locale-change", {
      detail: { locale },
      bubbles: true,
      composed: true,
    }),
  );
}

const canvas = (editor: GuideEditor): NodeEditor =>
  editor.shadowRoot?.querySelector("node-editor") as NodeEditor;

const panel = (editor: GuideEditor): PropertiesPanel =>
  editor.shadowRoot?.querySelector("properties-panel") as PropertiesPanel;

/** Fältet för nodens rubrik — översättbart. */
function titleField(editor: GuideEditor): HTMLInputElement | null {
  return (
    panel(editor).shadowRoot?.querySelector<HTMLInputElement>(
      '[data-property="title"]',
    ) ?? null
  );
}

/** Fältet för variabelnamnet — en identitet, aldrig översatt. */
function variableField(editor: GuideEditor): HTMLInputElement | null {
  return (
    panel(editor).shadowRoot?.querySelector<HTMLInputElement>(
      '[data-property="variableName"]',
    ) ?? null
  );
}

describe("administrator", () => {
  test("everything in the guide can be changed", () => {
    const editor = montera("administrator");

    expect(titleField(editor)?.disabled).toBe(false);
    expect(variableField(editor)?.disabled).toBe(false);
  });

  // The message explains why fields are locked. Nothing is locked here, so it
  // would be unintelligible — and it was precisely the translator's message that
  // happened to be shown.
  test("and gets no message about a locked mode", () => {
    const editor = montera("administrator");
    const panel = editor.shadowRoot?.querySelector("properties-panel");

    expect(panel?.shadowRoot?.querySelector("[data-mode-notice]")).toBeNull();
  });

  // The library is shared: a template changed or removed shows through in every
  // guide on the site. That is the top of the ladder — the most capability, the
  // fewest people.
  test("och dessutom det gemensamma mallbiblioteket", () => {
    const editor = montera("administrator");
    const toolbar = editor.shadowRoot?.querySelector("editor-toolbar");

    expect(
      toolbar?.shadowRoot?.querySelector<HTMLElement>(
        '[data-action="manage-node-types"]'
      )?.hidden
    ).toBe(false);
  });
});

describe("edit", () => {
  test("everything in the guide can be changed", () => {
    const editor = montera("edit");

    expect(canvas(editor).editorMode).toBe("edit");
    expect(titleField(editor)?.disabled).toBe(false);
    expect(variableField(editor)?.disabled).toBe(false);
  });

  test("paletten syns", () => {
    expect(palettensDisplay(montera("edit"))).not.toBe("none");
  });

  // The editor *uses* the templates but does not manage them. Otherwise shared
  // templates would be pointless for all but the few.
  test("men inte det gemensamma mallbiblioteket", () => {
    const editor = montera("edit");
    const toolbar = editor.shadowRoot?.querySelector("editor-toolbar");

    expect(
      toolbar?.shadowRoot?.querySelector<HTMLElement>(
        '[data-action="manage-node-types"]'
      )?.hidden
    ).toBe(true);
  });
});

describe("opt in, inte opt out", () => {
  // Capability is given, it does not happen to arise. A host that says nothing
  // gets a guide to look at — and the panel states plainly why.
  test("the default is readonly when no mode is set", () => {
    expect(montera().mode).toBe("readonly");
    expect(titleField(montera())?.disabled).toBe(true);
  });

  test("an unknown mode gives readonly, not the most permissive", () => {
    expect(montera("chefredaktör").mode).toBe("readonly");
  });

  // Ju mer förmåga, desto färre personer.
  test("every rung down removes, never adds", () => {
    const palettSyns = (mode: string): boolean =>
      palettensDisplay(montera(mode)) !== "none";

    expect(palettSyns("administrator")).toBe(true);
    expect(palettSyns("edit")).toBe(true);
    expect(palettSyns("translator")).toBe(false);
    expect(palettSyns("readonly")).toBe(false);
  });
});

describe("readonly", () => {
  test("nothing can be changed", () => {
    const editor = montera("readonly");

    expect(titleField(editor)?.disabled).toBe(true);
    expect(variableField(editor)?.disabled).toBe(true);
  });

  test("the palette is gone — it exists only to create nodes", () => {
    expect(palettensDisplay(montera("readonly"))).toBe("none");
  });

  test("the canvas refuses to change the graph", () => {
    const editor = montera("readonly");
    const before = editor.getData().nodes.length;

    canvas(editor).startPaletteDrag(
      {
        id: "ny",
        type: "result",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Ny" } },
      },
      { pointerId: 1, clientX: 400, clientY: 300 },
    );

    expect(editor.getData().nodes).toHaveLength(before);
  });
});

describe("translator", () => {
  // The source text is locked. Change the source and the guide's content
  // changes for everyone — including those reading it in Swedish.
  // Choosing a language is no task for someone invited precisely in order to
  // translate. The "choose a language to begin" state is gone.
  test("lands directly in a language that is not the source", () => {
    const editor = montera("translator");

    expect(editor.contentLocale).toBe("en");
    expect(titleField(editor)?.disabled).toBe(false);
  });

  test("and identities are locked regardless", () => {
    const editor = montera("translator");

    expect(variableField(editor)?.disabled).toBe(true);
  });

  test("with a language chosen, translatable fields can be changed", () => {
    const editor = montera("translator");

    chooseLanguage(editor, "en");

    expect(titleField(editor)?.disabled).toBe(false);
  });

  // Variable names, options' values and ids are identities, not text.
  test("men inte identiteter", () => {
    const editor = montera("translator");

    chooseLanguage(editor, "en");

    expect(variableField(editor)?.disabled).toBe(true);
  });

  // position is the guide's data. A translator rearranging it changes the
  // editor's working picture with nothing to show for it but coordinates.
  test("nodes cannot be moved", () => {
    const editor = montera("translator");
    const before = editor.getData().nodes[0].position;

    canvas(editor).dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 1, clientX: 400, clientY: 400 }),
    );
    window.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, clientX: 400, clientY: 400 }),
    );

    expect(editor.getData().nodes[0].position).toEqual(before);
  });

  test("the palette is gone", () => {
    const editor = montera("translator");

    expect(
      editor.shadowRoot?.querySelector<HTMLElement>("node-palette")?.hidden,
    ).toBe(true);
  });
});

describe("the mode is a view", () => {
  // The guide carries what was authored, not how someone happened to view it.
  test("det lagras aldrig i grafen", () => {
    const editor = montera("readonly");

    const json = JSON.stringify(editor.getData());

    expect(json).not.toContain("readonly");
    expect(json).not.toContain("administrator");
    expect(json).not.toContain("mode");
  });

  test("changing mode does not change the guide", () => {
    const editor = montera();
    const before = JSON.stringify(editor.getData());

    editor.mode = "translator";
    editor.mode = "readonly";
    editor.mode = "administrator";
    editor.mode = "edit";

    expect(JSON.stringify(editor.getData())).toBe(before);
  });
});

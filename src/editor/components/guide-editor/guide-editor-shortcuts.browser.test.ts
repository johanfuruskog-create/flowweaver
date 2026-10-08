import { afterEach, describe, expect, test, vi } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function mount(): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = {
    startNodeId: "n",
    nodes: [{ id: "n", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } }],
    connections: [],
  };
  return editor;
}

function dialogOf(editor: GuideEditor): HTMLDialogElement | null | undefined {
  return editor.shadowRoot?.querySelector<HTMLDialogElement>(
    "[data-shortcuts-dialog]"
  );
}

describe("guide-editor – Kortkommandon-dialog", () => {
  test("the Help menu's Shortcuts opens the dialog with the known commands", () => {
    const editor = mount();
    const toolbar = editor.shadowRoot?.querySelector("editor-toolbar")?.shadowRoot;
    const button = toolbar?.querySelector<HTMLButtonElement>(
      '[data-action="shortcuts"]'
    );
    if (!button) throw new Error("Kortkommandon-knappen saknas i verktygsfältet.");

    button.click();

    const dialog = dialogOf(editor);
    expect(dialog?.open).toBe(true);
    expect(dialog?.textContent).toContain("Ångra");
    expect(dialog?.textContent).toContain("Duplicera markerad nod");
    // Tangenterna renderas som <kbd>.
    const keys = Array.from(dialog?.querySelectorAll("kbd") ?? []).map(
      (kbd) => kbd.textContent
    );
    expect(keys).toContain("Z");
    expect(keys).toContain("Delete");
  });

  /*
   * Read 5/9: the dialog listed Ctrl+S, Ctrl+D and F6 but not Ctrl+K — the
   * headline of story 074 — nor Shift+F10, the only way to a node's menu
   * without a pointer. A shortcut the dialog does not name is one nobody
   * finds.
   */
  test("the dialog names Ctrl+K and Shift+F10 too", () => {
    const editor = mount();
    editor.shadowRoot
      ?.querySelector("editor-toolbar")
      ?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="shortcuts"]')
      ?.click();

    const dialog = dialogOf(editor);
    const keys = Array.from(dialog?.querySelectorAll("kbd") ?? []).map((kbd) => kbd.textContent);
    expect(keys).toContain("K");
    expect(keys).toContain("F10");
    expect(dialog?.textContent).toContain("Sök i guiden");
    expect(dialog?.textContent).toContain("nodens meny");
  });

  /*
   * Ctrl+S was the only action with no menu item at all (read 5/9). A person
   * who does not know the key had no way to ask for a save. Arkiv → Spara
   * asks the host exactly as the key does.
   */
  test("Arkiv, Spara asks the host the way Ctrl+S does", () => {
    const editor = mount();
    const asked = vi.fn();
    editor.addEventListener("save-request", asked);

    const toolbar = editor.shadowRoot?.querySelector("editor-toolbar")?.shadowRoot;
    const item = toolbar?.querySelector<HTMLButtonElement>('[data-action="save"]');
    if (!item) throw new Error("Arkiv saknar Spara.");
    expect(item.textContent).toContain("Ctrl+S");
    item.click();

    expect(asked).toHaveBeenCalledTimes(1);
    expect((asked.mock.calls[0]![0] as Event).cancelable).toBe(true);
  });

  /*
   * Kom igång is a link to a page the host has — the example site has one,
   * a host that embeds the editor usually has not. Without `get-started-href`
   * the item is gone; with it, the item opens the page in a new tab
   * (measured 3/9: on a host without a listener the item did nothing).
   */
  test("Help, Getting started is gone without get-started-href", () => {
    const editor = mount();
    const item = editor.shadowRoot
      ?.querySelector("editor-toolbar")
      ?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="get-started"]');
    expect(item?.hidden).toBe(true);
  });

  test("Help, Getting started opens get-started-href in a new tab", () => {
    const editor = mount();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    editor.setAttribute("get-started-href", "./get-started.html");
    const item = editor.shadowRoot
      ?.querySelector("editor-toolbar")
      ?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="get-started"]');
    expect(item?.hidden).toBe(false);
    item?.click();
    expect(open).toHaveBeenCalledWith("./get-started.html", "_blank", "noopener");
  });

  test('"?" öppnar dialogen och stäng-knappen stänger den', () => {
    const editor = mount();

    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
    const dialog = dialogOf(editor);
    expect(dialog?.open).toBe(true);

    dialog
      ?.querySelector<HTMLButtonElement>("[data-shortcuts-close]")
      ?.click();
    expect(dialog?.open).toBe(false);
  });

  test('"?" öppnar inte dialogen när fokus ligger i ett fält i editorn', () => {
    const editor = mount();
    // Ett fält inuti editorns skugg-DOM (kontextradens språkväljare).
    const field = editor.shadowRoot
      ?.querySelector<HTMLSelectElement>("[data-locale-select]");
    if (!field) throw new Error("Hittade inget fält att fokusera.");
    field.focus();

    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "?", bubbles: true, composed: true })
    );
    expect(dialogOf(editor)?.open).toBeFalsy();
  });

  /*
   * Story 083: the editor does not know where the guide is saved — the host
   * does. Ctrl+S asks the host (`save-request`); a host that answers owns the
   * message, and the fallback claims nothing about automatic saving.
   */
  const toastOf = (editor: GuideEditor) =>
    editor.shadowRoot
      ?.querySelector("editor-toast")
      ?.shadowRoot?.querySelector<HTMLElement>("[data-toast]");

  test("Ctrl+S is captured and asks the host to save", () => {
    const editor = mount();
    const asked = vi.fn();
    editor.addEventListener("save-request", asked);

    const key = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true });
    editor.dispatchEvent(key);

    expect(key.defaultPrevented, "the browser's own save dialog stays away").toBe(true);
    expect(asked).toHaveBeenCalledTimes(1);
    const request = asked.mock.calls[0]![0] as Event;
    expect(request.cancelable).toBe(true);
    expect(request.composed).toBe(true);
  });

  test("a host that takes the save owns the message", () => {
    const editor = mount();
    editor.addEventListener("save-request", (event) => event.preventDefault());

    editor.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true })
    );

    expect(toastOf(editor)?.hasAttribute("hidden") ?? true).toBe(true);
  });

  test("unanswered, the editor says only that the page saves", () => {
    const editor = mount();

    editor.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true })
    );

    const toast = toastOf(editor);
    expect(toast?.hasAttribute("hidden")).toBe(false);
    expect(toast?.textContent ?? "").not.toContain("automatiskt");
    expect(toast?.textContent ?? "").not.toContain("webbläsaren");
  });

  test("F fits the content into the view", () => {
    const editor = mount();
    const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
    const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
      ".node-editor__viewport"
    );
    if (!nodeEditor || !viewport) throw new Error("node-editor saknas.");
    const spy = vi.spyOn(nodeEditor, "fitToContent");

    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "f", bubbles: true, composed: true })
    );

    expect(spy).toHaveBeenCalled();
  });
});

describe("guide-editor: rundturen", () => {
  function mountWithRule(): GuideEditor {
    const editor = document.createElement("guide-editor") as GuideEditor;
    // Opt in: the default is readonly, and this test builds.
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "q",
      nodes: [
        {
          id: "q",
          type: "question",
          position: { x: 0, y: 0 },
          data: { title: "Fråga", variableName: "v", options: [{ id: "q-a", label: "A", value: "a" }] },
        },
        {
          id: "rule",
          type: "rule",
          position: { x: 220, y: 0 },
          data: {
            title: "Regel",
            cases: [
              {
                id: "c1",
                label: "C",
                match: "all",
                conditions: [{ id: "cc", variableName: "v", operator: "equals", value: "a" }],
              },
            ],
            fallbackLabel: "Annars",
          },
        },
        { id: "r", type: "result", position: { x: 440, y: 0 }, data: { title: "Klart" } },
      ],
      connections: [],
    };
    return editor;
  }

  test("the Tour steps through the editor and closes on the last step", () => {
    const editor = mountWithRule();
    // Startas från Hjälp-menyns Rundtur-knapp.
    const toolbar = editor.shadowRoot?.querySelector("editor-toolbar")?.shadowRoot;
    const tourButton = toolbar?.querySelector<HTMLButtonElement>(
      '[data-action="tour"]'
    );
    if (!tourButton) throw new Error("Rundtur-knappen saknas.");
    tourButton.click();

    const overlay = editor.shadowRoot?.querySelector<HTMLElement>("[data-tour]");
    const text = () =>
      editor.shadowRoot?.querySelector("[data-tour-text]")?.textContent ?? "";
    const count = () =>
      editor.shadowRoot?.querySelector("[data-tour-count]")?.textContent ?? "";
    const next = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      "[data-tour-next]"
    );
    const back = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      "[data-tour-back]"
    );

    const toolbarMenu = () =>
      editor.shadowRoot
        ?.querySelector("editor-toolbar")
        ?.shadowRoot?.querySelector<HTMLElement>('[data-menu="guide"]');

    expect(overlay?.hidden).toBe(false);
    // Första steget pekar på topmenyn.
    expect(count()).toBe("1 av 6");
    expect(text()).toContain("menyerna");
    expect(back?.disabled).toBe(true);

    // Steg 2: öppnar Guide-menyn och markerar Nodmallar.
    next?.click();
    expect(count()).toBe("2 av 6");
    expect(text()).toContain("nodmallar");
    expect(toolbarMenu()?.hidden).toBe(false);

    next?.click();
    expect(text()).toContain("bygger du guiden");
    // Once we have left the menu step, the menu is closed again.
    expect(toolbarMenu()?.hidden).toBe(true);

    // Steg 4 (nod), steg 5 (Regel).
    next?.click();
    next?.click();
    expect(text()).toContain("Regel");
    expect(next?.textContent).toBe("Nästa");

    next?.click();
    // Sista steget (förhandsgranskning): knappen blir "Klar".
    expect(count()).toBe("6 av 6");
    expect(next?.textContent).toBe("Klar");

    next?.click();
    expect(overlay?.hidden).toBe(true);
  });

  /*
   * Read 5/9: `buildTourSteps` added a step when its element *existed*, not
   * when it showed. Nodmallar is `hidden` outside administrator mode, so in
   * plain `edit` the tour opened the Guide menu and framed nothing. A step
   * at a hidden thing is skipped.
   */
  test("in edit mode the tour skips the hidden Nodmallar step", () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.setAttribute("mode", "edit");
    document.body.append(editor);
    editor.graph = {
      startNodeId: "n",
      nodes: [{ id: "n", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } }],
      connections: [],
    };
    editor.shadowRoot
      ?.querySelector("editor-toolbar")
      ?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="tour"]')
      ?.click();

    const text = () => editor.shadowRoot?.querySelector("[data-tour-text]")?.textContent ?? "";
    const count = () => editor.shadowRoot?.querySelector("[data-tour-count]")?.textContent ?? "";
    expect(count()).toBe("1 av 4");
    editor.shadowRoot?.querySelector<HTMLButtonElement>("[data-tour-next]")?.click();
    expect(text()).not.toContain("nodmallar");
    expect(text()).toContain("bygger du guiden");
  });
});

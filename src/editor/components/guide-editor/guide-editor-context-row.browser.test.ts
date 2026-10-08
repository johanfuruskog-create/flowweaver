import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * The row above the canvas: the host's context, and the language being edited.
 *
 * ## Why the two share a row
 *
 * The language picker sat in the toolbar and did not fit. "Skriver på"
 * broke into two lines in a bar 56 pixels tall, and made to stay on one line it
 * pushed the select 39 pixels past the edge, where it was clipped — at 792 px,
 * the width an editor gets beside the properties panel, so the ordinary case.
 * The context row has room.
 *
 * ## What that costs, and what this file guards
 *
 * The row used to collapse when the host slotted nothing, because a bordered
 * strip with nothing in it is a line drawn for no reason. It cannot collapse
 * any more — the picker lives there. So it is the *first item* that folds away,
 * and the picker stays put in both cases.
 *
 * Both halves are asserted here because both were wrong in the mock built to
 * try the idea: `li { display: inline-flex }` outweighs `[hidden]`, so nothing
 * was hidden at all and the empty row looked exactly like the full one; and
 * `justify-content: space-between` slid the picker to the left the moment the
 * first item went away. A control that moves depending on what somebody else
 * slots is harder to find than one that stands still.
 */

const guide = (): GraphData => ({
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Bor du i kommunen?" },
        variableName: "bor",
        options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }],
      },
    },
  ],
  connections: [],
  settings: { locales: ["sv", "en"], sourceLocale: "sv" },
});

function mount(context?: string): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1100px; height: 700px;";

  if (context !== undefined) {
    const line = document.createElement("span");

    line.setAttribute("slot", "context");
    line.textContent = context;
    editor.append(line);
  }

  document.body.append(editor);
  editor.graph = guide();
  return editor;
}

const hostItem = (editor: GuideEditor) =>
  editor.shadowRoot?.querySelector<HTMLElement>("[data-context]") ?? null;

const locale = (editor: GuideEditor) =>
  editor.shadowRoot?.querySelector<HTMLElement>(".guide-editor__locale") ?? null;

/** What the eye sees, not what the attribute says. */
const shown = (element: HTMLElement | null) =>
  !!element && getComputedStyle(element).display !== "none";

afterEach(() => document.body.replaceChildren());

describe("the row above the canvas", () => {
  test("carries the language picker whether or not the host says anything", () => {
    expect({
      withContext: shown(locale(mount("Du redigerar: Bostadsbidrag"))),
      without: shown(locale(mount())),
    }).toEqual({ withContext: true, without: true });
  });

  test("folds away the host's item when nothing is slotted", () => {
    /*
     * Computed display, not the `hidden` attribute. The attribute was set all
     * along in the mock and changed nothing, because the rule that lays the
     * items out in a row beat the browser's own `[hidden] { display: none }`.
     * Asking for the attribute would have agreed with the bug.
     */
    expect(shown(hostItem(mount()))).toBe(false);
  });

  test("and shows it when the host has something to say", () => {
    const editor = mount("Du redigerar: Bostadsbidrag");

    /*
     * `textContent` of the item is empty even when the host slotted something
     * — the content is light DOM and lives on the host. Asking the slot what
     * it was assigned is the only question that distinguishes the two cases.
     */
    const slot = editor.shadowRoot?.querySelector<HTMLSlotElement>(
      'slot[name="context"]'
    );

    expect({
      visible: shown(hostItem(editor)),
      assigned: slot?.assignedNodes({ flatten: true }).length,
      says: slot
        ?.assignedNodes({ flatten: true })
        .map((node) => node.textContent)
        .join(""),
    }).toEqual({
      visible: true,
      assigned: 1,
      says: "Du redigerar: Bostadsbidrag",
    });
  });

  test("keeps the picker on the right in both cases", () => {
    const withContext = mount("Du redigerar: Bostadsbidrag");
    const without = mount();

    const rightEdge = (editor: GuideEditor) => {
      const row = editor.shadowRoot?.querySelector<HTMLElement>(
        ".guide-editor__context"
      );

      return Math.round(
        (row?.getBoundingClientRect().right ?? 0) -
          (locale(editor)?.getBoundingClientRect().right ?? 0)
      );
    };

    // The same distance from the right edge of the row, with and without a
    // context line. Left-aligned when the row is otherwise empty was the whole
    // failure mode.
    expect(rightEdge(without)).toBe(rightEdge(withContext));
  });
});

/**
 * Narrow, and what gives way.
 *
 * ## What is covered, and what is measured elsewhere
 *
 * `flex-wrap: wrap` is proven here: remove it and this fails. The rule beside
 * it, `min-width: max-content` on the items, is **not** — it needs the host's
 * line as the module actually builds it, a label plus a bold name plus a pill,
 * and slotting that shape into a mounted editor from a test has so far only
 * produced a test that fails either way.
 *
 * It is measured, on `dev/user-test.html` at four widths: without the rule
 * the host's item is 43 pixels tall from 640 down, with it 22 — one line of
 * text against two. That is the number, taken in a browser; it just is not this
 * file. Do not read a green run here as covering it.
 */
describe("when there is not room for both", () => {
  /** The row, and where each item sits in it. */
  const geometry = (editor: GuideEditor) => {
    const row = editor.shadowRoot?.querySelector<HTMLElement>(
      ".guide-editor__context"
    );
    const host = hostItem(editor);
    const picker = locale(editor);

    /*
     * The row's height, not the items' tops.
     *
     * The two items are not the same height — the picker carries a select —
     * so comparing their top edges called one line two even when the row was
     * plainly one line. The row grows when it wraps, and that is the thing
     * being asked about.
     */
    return {
      rowHeight: Math.round(row?.getBoundingClientRect().height ?? 0),
      hostHeight: Math.round(host?.getBoundingClientRect().height ?? 0),
      pickerRight: Math.round(picker?.getBoundingClientRect().right ?? 0),
    };
  };

  test("the picker moves to its own line rather than squeezing the host", () => {
    const editor = mount("Du redigerar: Bostadsbidrag  Publicerad");

    editor.style.width = "1600px";

    editor.style.width = "1600px";
    const wide = geometry(editor);

    // 300, not 640 as until 7/10: the row spans the whole editor since the
    // side panel lies over the workspace (story 145), and 640 left it room for
    // both on one line. Beside a docked 380 panel, 640 was a 260 px row.
    editor.style.width = "300px";
    const narrow = geometry(editor);

    /*
     * The failure this replaces: the host's item shrank until its own text
     * broke wherever it liked, so *Du redigerar: Bostadsbidrag* became *Du* on
     * one line and the name on the next, separated from the words that say what
     * it is. Photographed in a narrow Sitevision dialog.
     *
     * `flex-wrap` alone does not do it — a flex item may shrink to its
     * min-content first, and only wraps when it cannot shrink further. The row
     * needs both that and `min-width: max-content` on the items.
     */
    // One line wide, two lines narrow: the picker went below rather than
    // pressing the host's text into breaking.
    expect(narrow.rowHeight).toBeGreaterThan(wide.rowHeight + 8);

    /*
     * And the host's own item stayed exactly as tall — one line of text
     * throughout. That is the failure this replaces: it used to shrink until
     * *Du redigerar: Bostadsbidrag* broke into *Du* and the rest, separating
     * the name from the words that say what it is.
     */
    expect(narrow.hostHeight).toBe(wide.hostHeight);
  });
});

/*
 * A host with two lines — the storage page: name, badge and buttons on the
 * first, the status sentence on the second. Johan 23/9: "Skriver på borde
 * centreras vertikalt i baslinje med Historik och Publicera". Centred against
 * the whole two-line block, the picker sat between the lines; it belongs on
 * the first, with the buttons.
 */
describe("the language picker beside a two-line host row", () => {
  test("sits on the host's first line, level with its buttons", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;

    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 1100px; height: 700px;";

    const row = document.createElement("div");
    row.setAttribute("slot", "context");
    row.style.cssText = "display:flex;flex-direction:column;gap:4px;width:100%";
    row.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:20px">
        <span style="font-size:1.1rem;font-weight:700">Bygglov2</span>
        <span><button type="button" style="min-height:44px;padding:0 12px" data-probe>Historik</button></span>
      </div>
      <small>Version 8 publicerad · inga opublicerade ändringar</small>
    `;
    editor.setAttribute("context-fill", "");
    editor.append(row);
    document.body.append(editor);
    editor.graph = guide();
    await new Promise((resolve) => setTimeout(resolve, 60));

    const button = row.querySelector<HTMLElement>("[data-probe]")!.getBoundingClientRect();
    const select = locale(editor)!.querySelector("select")!.getBoundingClientRect();
    const centre = (r: DOMRect) => r.top + r.height / 2;

    expect(
      Math.abs(centre(select) - centre(button)),
      `knappens mitt ${centre(button)}, väljarens mitt ${centre(select)}`,
    ).toBeLessThanOrEqual(3);
  });
});

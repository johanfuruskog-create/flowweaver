import { afterEach, describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import "../editor/components/guide-editor/guide-editor";

import { VIEWER_STRINGS } from "../viewer/localization/built-in-strings";
import { EDITOR_STRINGS } from "../editor/localization/editor-strings";

import type { GuideEditor } from "../editor/components/guide-editor/guide-editor";
import type { GraphData } from "../viewer/types/graph";

/**
 * Nothing in the editor keeps speaking the old language after a change.
 *
 * ## Why a sweep and not another case
 *
 * The tool's language has now been reported wrong three times, each on a
 * different surface: the node headers on the canvas, which read a raw registry
 * label; the palette, which was right; and the sidebar tabs, which were correct
 * in the source but baked at first render, because `render()` runs once from
 * `connectedCallback` and rebuilding it would throw the canvas away.
 *
 * Each fix was small and each was found by a person looking at the screen. So
 * this does not test a surface. It sets the editor to English, reads every word
 * it renders, and looks for Swedish that has an English translation sitting
 * right beside it in the table — which is the shape all three faults had.
 *
 * ## What it cannot see
 *
 * A Swedish string with no key at all: there is nothing to compare it against.
 * And the guide's own content, which is the author's language and must not
 * follow the tool — that is the whole point of story 014, so the fixture's
 * content is deliberately not Swedish.
 */

const GRAPH: GraphData = {
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        // English content on purpose: Swedish here would be indistinguishable
        // from Swedish chrome, and the content is not ours to translate.
        title: { en: "Do you live here?" },
        variableName: "lives",
        options: [{ id: "y", label: { en: "Yes" }, value: "y" }],
      },
    },
    { id: "r", type: "result", position: { x: 320, y: 0 }, data: { title: { en: "Done" } } },
  ],
  connections: [],
  settings: { sourceLocale: "en" },
} as unknown as GraphData;

/*
 * A word the *viewer* also uses is not evidence of anything.
 *
 * The properties panel lists the guide's overridable viewer texts and shows
 * each one's current value in the **content** language — which is right, and is
 * the axis this whole story is about. "Föregående" and "Resultat" are viewer
 * texts there, and they happen to be the Swedish of two editor keys as well, so
 * a check that only looks at words flags the axis working correctly.
 */
const VIEWER_SWEDISH = new Set(
  Object.values(VIEWER_STRINGS)
    .map((entry) => entry.sv)
    .filter((text): text is string => Boolean(text)),
);

/** Swedish words we ship that have an English translation of their own. */
const TRANSLATED_PAIRS = Object.entries(EDITOR_STRINGS)
  .filter(([, entry]) => entry.sv && entry.en && entry.sv !== entry.en)
  // Short words appear inside longer ones and inside content; the fault this
  // guards against is whole labels, not fragments.
  .filter(([, entry]) => entry.sv!.length >= 6 && !entry.sv!.includes("{"))
  .filter(([, entry]) => !VIEWER_SWEDISH.has(entry.sv!))
  .map(([key, entry]) => ({ key, sv: entry.sv!, en: entry.en! }));

/**
 * Everything a person can read, shadow roots included.
 *
 * Closed dialogs are skipped. `node-type-editor` keeps its markup in the DOM
 * and re-renders it in the chosen language when it opens, so reading it shut
 * reports Swedish nobody can see — my first version of this did, and the
 * finding was mine, not the code's.
 */
function allText(root: ParentNode): string {
  let text = "";
  for (const element of root.querySelectorAll("*")) {
    // `checkVisibility` rather than the `hidden` attribute: a dialog can be
    // shut by CSS, by `display: none` on a wrapper, or by not being `open`, and
    // the question here is only ever "can a person read this".
    if (!(element as HTMLElement).checkVisibility?.()) {
      continue;
    }
    const shadow = (element as HTMLElement).shadowRoot;
    if (shadow) {
      text += ` ${allText(shadow)}`;
    }
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += ` ${node.textContent}`;
      }
    }
    // Labels a screen reader reads are words too.
    const aria = (element as HTMLElement).getAttribute?.("aria-label");
    if (aria) {
      text += ` ${aria}`;
    }
  }
  return text;
}

async function mountEditor(locale: string): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.setAttribute("mode", "administrator");
  editor.style.height = "700px";
  document.body.append(editor);
  editor.graph = structuredClone(GRAPH);
  editor.setAttribute("editor-locale", locale);
  await new Promise((resolve) => setTimeout(resolve, 400));
  return editor;
}

afterEach(() => document.body.replaceChildren());

describe("the editor in English", () => {
  test("there are translated words to look for, so an empty sweep cannot pass", () => {
    expect(TRANSLATED_PAIRS.length).toBeGreaterThan(100);
  });

  test("renders no Swedish word that has an English one in the table", async () => {
    const editor = await mountEditor("en");
    const text = ` ${allText(editor.shadowRoot!)} `;

    const swedish = TRANSLATED_PAIRS.filter((pair) => text.includes(pair.sv)).map(
      (pair) => `${pair.key}: "${pair.sv}" (should be "${pair.en}")`,
    );

    expect(swedish).toEqual([]);
  });

  // Without this the sweep above would pass on an editor that rendered nothing.
  test("and did render its chrome", async () => {
    const editor = await mountEditor("en");
    const text = allText(editor.shadowRoot!);

    expect({
      tabs: text.includes("Properties") && text.includes("Preview"),
      palette: text.includes("Question"),
    }).toEqual({ tabs: true, palette: true });
  });

  test("in Swedish it says the Swedish words", async () => {
    const editor = await mountEditor("sv");
    const text = allText(editor.shadowRoot!);

    expect({
      tabs: text.includes("Egenskaper") && text.includes("Förhandsgranskning"),
      palette: text.includes("Fråga"),
    }).toEqual({ tabs: true, palette: true });
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import "../viewer/components/guide-preview/guide-preview";
import "../editor/components/guide-editor/guide-editor";
import "../editor/components/guide-versions/guide-versions";

import type { GuidePreview } from "../viewer/components/guide-preview/guide-preview";
import type { GuideEditor } from "../editor/components/guide-editor/guide-editor";
import type { GuideVersions } from "../editor/components/guide-versions/guide-versions";

/**
 * The font matrix's own check: did the forced typeface arrive?
 *
 * `npm run fonts:matrix` runs the layout-sensitive tests once per typeface by
 * pointing `--fw-font` elsewhere (`src/test-setup/browser.ts`). An override
 * that does not bite leaves every run in the default typeface, and the matrix
 * goes green for the wrong reason — four columns that are one column. So this
 * file runs first in each column and fails it if:
 *
 * - the typeface is not installed (the browser would silently fall back), or
 * - the text inside a component's shadow root does not compute to it — the
 *   token is set again on each of the library's tags, so a rule on one of them
 *   alone is not enough, and that is exactly what this reads.
 *
 * Skipped in an ordinary run, where nothing is forced.
 */

const forced = import.meta.env.VITE_FW_FONT as string | undefined;
const unquote = (family: string) => family.replace(/["']/g, "").trim();

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

afterEach(() => document.body.replaceChildren());

describe.skipIf(!forced)("the forced typeface", () => {
  test("is installed: the browser does not fall back", () => {
    // Same text, two different fallbacks: equal widths mean neither was used.
    const context = document.createElement("canvas").getContext("2d")!;
    const width = (fallback: string) => {
      context.font = `40px ${forced}, ${fallback}`;
      return context.measureText("Hamburgefonstiv 0123456789").width;
    };

    expect(width("monospace")).toBe(width("serif"));
  });

  test("reaches the text inside guide-editor's flow nodes", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    document.body.append(editor);
    editor.graph = {
      startNodeId: "page",
      nodes: [{ id: "page", type: "page", position: { x: 100, y: 80 }, data: { title: "Kontakt" } }],
      connections: [],
    };
    await settle();

    const node = editor.shadowRoot
      ?.querySelector("node-editor")
      ?.shadowRoot?.querySelector("flow-node");
    const title = node?.shadowRoot?.querySelector<HTMLElement>(".flow-node__content");
    if (!title) throw new Error("The page node's text was not drawn.");

    expect(unquote(getComputedStyle(title).fontFamily)).toBe(unquote(forced!));
  });

  test("reaches the text inside a guide-preview", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    document.body.append(preview);
    preview.graph = {
      startNodeId: "done",
      nodes: [{ id: "done", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } }],
      connections: [],
    };
    await settle();

    const heading = preview.shadowRoot?.querySelector<HTMLElement>("h1, h2, h3");
    if (!heading) throw new Error("The preview drew no heading.");

    expect(unquote(getComputedStyle(heading).fontFamily)).toBe(unquote(forced!));
  });

  test("reaches the version list, which sets no font of its own", async () => {
    const versions = document.createElement("guide-versions") as GuideVersions;
    versions.setAttribute("editor-locale", "sv");
    document.body.append(versions);
    versions.versions = [{ id: "v1", number: 1, savedAt: 1 }];
    await settle();

    const row = versions.shadowRoot?.querySelector<HTMLElement>("tr[data-id]");
    if (!row) throw new Error("The version list drew no row.");

    expect(unquote(getComputedStyle(row).fontFamily)).toBe(unquote(forced!));
  });
});

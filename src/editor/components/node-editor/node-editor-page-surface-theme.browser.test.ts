import { afterEach, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./node-editor";

import { pageBuilderExampleGraph } from "../../../data/page-builder-example-graph";

import type { NodeEditor } from "./node-editor";

/**
 * The field area follows the theme.
 *
 * Measured on page-builder in dark mode, 3 September 2026: the dashed frame
 * behind a page's fields was a pale grey slab — `rgb(238 242 255 / 55%)`,
 * which is `--fw-primary-surface`'s light hex written out, so the token swap
 * never reached it. The frame must take its tint from the token.
 */

afterEach(() => document.body.replaceChildren());

function frameTint(theme: "light" | "dark"): string {
  const editor = document.createElement("node-editor") as NodeEditor;
  editor.editorMode = "administrator";
  editor.dataset.fwTheme = theme;
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = pageBuilderExampleGraph;

  const surface = editor.shadowRoot?.querySelector(".node-editor__page-surface");

  expect(surface).not.toBeNull();
  return getComputedStyle(surface!, "::before").backgroundColor;
}

test("the page's field area is tinted from the theme's tokens, not the light hex", () => {
  const light = frameTint("light");
  const dark = frameTint("dark");

  expect(light).not.toBe("rgba(0, 0, 0, 0)");
  expect(dark).not.toBe(light);
});

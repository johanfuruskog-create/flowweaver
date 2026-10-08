import { afterEach, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * The toolbar's mark is the site's wordmark drawn a second time (the site's
 * is a build-time string the library cannot import), so it must carry the
 * same correction: the gap where blue passes under green is a clip on the
 * blue stroke (Astra 30/9 2026), not a line painted in the background colour.
 * The old paint only looked right when `--fw-logo-cut` matched the bar
 * behind, and the toolbar's stylesheet had to set it. `site-wordmark.test.ts`
 * holds the same for the site's copy.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test("verktygsradens märke klipper det blå strecket i stället för att måla över", async () => {
  const host = document.createElement("guide-editor") as GuideEditor;

  host.setAttribute("mode", "administrator");
  host.style.cssText = "display: block; width: 1400px; height: 800px;";
  document.body.append(host);
  host.graph = { version: 8, startNodeId: null, nodes: [], connections: [] } as never;
  await settle();

  const tb = host.shadowRoot!.querySelector("editor-toolbar")!.shadowRoot!;
  const mark = tb.querySelector<SVGSVGElement>(".editor-toolbar__brand-mark")!;

  expect(mark.querySelector('clipPath#editor-toolbar-logo-gap path'), "klippningen finns").not.toBeNull();
  const blue = mark.querySelector<SVGElement>('polyline[stroke="var(--fw-logo-blue)"]')!;
  expect(blue.getAttribute("clip-path"), "det blå strecket klipps").toBe("url(#editor-toolbar-logo-gap)");
  expect(mark.querySelectorAll("polyline"), "två streck, ingen reparation").toHaveLength(2);
  expect(mark.querySelector('[stroke-width="15"]'), "ingen övermålning").toBeNull();
  expect(mark.outerHTML).not.toContain("--fw-logo-cut");
});

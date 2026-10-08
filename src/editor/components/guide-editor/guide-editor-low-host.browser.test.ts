import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { exampleGraph } from "../../../data/example-graph";

import type { GuideEditor } from "./guide-editor";

/**
 * Sitevisions konfigdialog är alltid bred nog men bara 520 px hög (Johans
 * konsolmätning 2/9). Språkraden ovanför menyraden kostade tio procent av
 * ytan. Flytten styrs av värdens UTTALADE attribut `compact-header` — ingen
 * höjdautomatik (Johans produktinvändning: magi som slår till i varje låg
 * inbäddning är inte bäst för helheten). Sitevision-integrationen sätter det.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

async function mount(compact: boolean): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  if (compact) editor.setAttribute("compact-header", "");
  editor.style.cssText = "display: block; width: 1318px; height: 520px;";
  document.body.append(editor);
  editor.graph = structuredClone(exampleGraph);
  await settle();
  await settle();
  return editor;
}

const rows = (editor: GuideEditor) => {
  const toolbar = editor.shadowRoot!.querySelector("editor-toolbar")!;
  const locale = editor.shadowRoot!.querySelector("[data-locale-select]")!;

  return {
    toolbar: toolbar.getBoundingClientRect(),
    locale: locale.getBoundingClientRect(),
  };
};

describe("språkraden under compact-header", () => {
  test("med attributet: språkvalet står på menyradens rad", async () => {
    const editor = await mount(true);

    const { toolbar, locale } = rows(editor);
    const localeMitt = locale.top + locale.height / 2;

    expect(
      localeMitt,
      "språkvalet i menyradens höjdled",
    ).toBeGreaterThan(toolbar.top);
    expect(localeMitt).toBeLessThan(toolbar.bottom);
  });

  test("utan attributet: egen rad som förut", async () => {
    const editor = await mount(false);

    const { toolbar, locale } = rows(editor);

    // Egen rad: språkvalet ligger helt utanför menyradens höjdspann.
    expect(
      locale.top >= toolbar.bottom || locale.bottom <= toolbar.top,
      "egen rad",
    ).toBe(true);
  });
});

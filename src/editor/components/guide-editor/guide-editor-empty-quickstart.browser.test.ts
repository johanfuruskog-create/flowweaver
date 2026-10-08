import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";

/**
 * Granskningsvarv 2 (2/9): tomma arbetsytan sade "dra ut din första nod"
 * men nämnde aldrig Snabbstart: formulär — exakt i läget där stommen
 * hjälper mest. Hänvisningen följer samma villkor som menyposten (sidor
 * i funktionsnivån), annars pekar den mot ett grepp som inte finns.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 250) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function hint(modules?: string): Promise<HTMLElement | null> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  if (modules) editor.setAttribute("modules", modules);
  editor.style.cssText = "display: block; width: 1300px; height: 700px;";
  document.body.append(editor);
  editor.graph = { version: 8, startNodeId: null, nodes: [], connections: [] } as never;
  await settle();

  return editor.shadowRoot!
    .querySelector("node-editor")!
    .shadowRoot!.querySelector<HTMLElement>("[data-quickstart-hint]");
}

describe("tomma ytan och snabbstarten", () => {
  test("med sidor i nivån nämns Snabbstart: formulär", async () => {
    const rad = await hint();

    expect(rad, "raden finns").toBeTruthy();
    expect(rad!.hidden, "synlig").toBe(false);
    expect(rad!.textContent).toContain("Snabbstart: formulär");
  });

  test("utan sidor i nivån är raden dold — display, inte bara attributet", async () => {
    const rad = await hint("fields");

    expect(rad!.hidden).toBe(true);
    expect(getComputedStyle(rad!).display).toBe("none");
  });
});

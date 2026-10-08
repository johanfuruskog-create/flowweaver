import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";

/**
 * Johans beslut 2/9: inget mobilstöd i editorn i dagsläget — beskedet i
 * stället för bygget. Raden finns alltid i DOM:en men visas bara under
 * 700 px via media query (dialogen på stor skärm ska slippa den);
 * smala fallet verifieras med bild i 375 px.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("mobilbeskedet", () => {
  test("finns i DOM:en men är dolt på skrivbordsbredd", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;

    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 1300px; height: 700px;";
    document.body.append(editor);
    editor.graph = { version: 8, startNodeId: null, nodes: [], connections: [] } as never;
    await settle();

    const rad = editor.shadowRoot!.querySelector<HTMLElement>(
      "[data-small-screen-notice]",
    );

    expect(rad, "beskedet finns").toBeTruthy();
    expect(rad!.textContent).toContain("större skärmar");
    expect(getComputedStyle(rad!).display).toBe("none");
  });
});

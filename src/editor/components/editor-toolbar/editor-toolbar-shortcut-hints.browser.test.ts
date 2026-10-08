import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Toppmenygranskningen 2/9: en meny som kan en genväg ska säga det där
 * handlingen bor — Ctrl+Z till höger om Ångra, som varje skrivbordsprogram.
 * Och Ctrl+K:s menypost (story 074:s egen form) hade missats: utan post
 * är sökningen oupptäckbar för den som inte redan kan kortkommandot.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function toolbar(editor?: GuideEditor) {
  const host = editor ?? (document.createElement("guide-editor") as GuideEditor);

  if (!editor) {
    host.setAttribute("mode", "administrator");
    host.style.cssText = "display: block; width: 1400px; height: 800px;";
    document.body.append(host);
    host.graph = { version: 8, startNodeId: null, nodes: [], connections: [] } as never;
    await settle();
  }
  return host.shadowRoot!.querySelector("editor-toolbar")!.shadowRoot!;
}

describe("toppmenyns genvägar", () => {
  test("Ångra och Gör om bär sina genvägar", async () => {
    const tb = await toolbar();

    // Öppna menyn — dolda poster mäter nollrektanglar, och noll minus
    // noll gick grönt genom två mutationer innan det upptäcktes.
    tb.querySelector<HTMLButtonElement>('[data-menu-trigger="edit"]')!.click();
    await settle(150);

    const angra = tb.querySelector('[data-action="undo"]')!;
    const gorOm = tb.querySelector('[data-action="redo"]')!;

    expect(angra.querySelector("kbd")?.textContent ?? "").toContain("Ctrl+Z");

    // Kolumnjusterade: alla hintar delar högerkant — inte hängande efter
    // orden (designbilden 2/9). Tväralignment är designfaktan; en mätning
    // mot "menyns kant" högg fel element och gick grönt före fixen.
    const sok = tb.querySelector('[data-action="quick-open"]')!;
    const kanter = [angra, gorOm, sok].map(
      (post) => post.querySelector("kbd")!.getBoundingClientRect().right,
    );
    expect(Math.max(...kanter) - Math.min(...kanter), "delad högerkant").toBeLessThanOrEqual(2);
    expect(gorOm.querySelector("kbd")?.textContent ?? "").not.toBe("");
  });

  test("Redigera-menyn bär sökposten med Ctrl+K", async () => {
    const tb = await toolbar();
    const post = tb.querySelector('[data-action="quick-open"]');

    expect(post, "posten finns").toBeTruthy();
    expect(post!.querySelector("kbd")?.textContent ?? "").toContain("Ctrl+K");
  });
});

describe("Vy- och Hjälp-menyerna", () => {
  /*
   * Johan 3/9: "visa kortkommandon står i menyn — de andra alternativen
   * borde väl också ha det där det finns?" Varje post vars handling har en
   * tangent i kortkommandodialogen bär den; posterna utan (helskärm,
   * listan, de två vyerna) bär ingen — en påhittad hint är värre än ingen.
   */
  test("varje post med en tangent bär den", async () => {
    const tb = await toolbar();
    const forvantat: Record<string, string> = {
      "zoom-in": "+",
      "zoom-out": "−",
      "zoom-reset": "0",
      "fit-to-content": "F",
      shortcuts: "?",
    };

    for (const [action, tangent] of Object.entries(forvantat)) {
      const post = tb.querySelector(`[data-action="${action}"]`)!;
      expect(post.querySelector("kbd")?.textContent, action).toBe(tangent);
    }
    for (const action of ["fullscreen", "toggle-list-view", "visitor-view-all", "structure-view-all"]) {
      expect(tb.querySelector(`[data-action="${action}"] kbd`), action).toBeNull();
    }
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { FlowNode } from "./flow-node";
import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * The node header: a mark that it drags, and a button that closes what it opens.
 *
 * ## The grip is a sign, not the handle
 *
 * The whole header drags, as it always has. On a desktop `cursor: grab` said so;
 * on a tablet nothing did, and it had to be guessed. Making only a grip
 * draggable was the alternative and would have shrunk the target from a header
 * to a few pixels — the wrong direction for a finger, and it would have solved
 * nothing measurable: a still press and a three-pixel wobble were measured and
 * move the node not at all.
 *
 * ## The button closes what it opens
 *
 * Pressing `⋯` again on an open menu used to reopen it in place, which is a
 * press with nothing to show for it. The glyph now says which it will do, and
 * `aria-expanded` says the same thing to anyone who cannot see it.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));

async function canvas(): Promise<NodeEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1000px; height: 700px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 80, y: 80 }, data: { title: "Ett", variableName: "a" } },
      { id: "q2", type: "text-question", position: { x: 480, y: 80 }, data: { title: "Två", variableName: "b" } },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

  if (!nodeEditor) throw new Error("node-editor saknas.");

  return nodeEditor;
}

const partsOf = (nodeEditor: NodeEditor, id: string): ShadowRoot =>
  Array.from(nodeEditor.shadowRoot!.querySelectorAll<FlowNode>("flow-node"))
    .find((node) => node.nodeData?.id === id)!
    .shadowRoot!;

const menuButton = (nodeEditor: NodeEditor, id: string): HTMLButtonElement =>
  partsOf(nodeEditor, id).querySelector<HTMLButtonElement>("[data-node-menu]")!;

const menuIsOpen = (nodeEditor: NodeEditor): boolean =>
  Boolean(nodeEditor.shadowRoot!.querySelector('[data-action="duplicate-node"]'));

describe("the grip", () => {
  test("is there, in the header", async () => {
    const header = partsOf(await canvas(), "q1").querySelector(".flow-node__header");

    expect(header?.querySelector(".flow-node__grip")).toBeTruthy();
  });

  test("says nothing to a screen reader, because it is not a control", async () => {
    // It is a picture of an affordance. "Braille pattern dots" would be noise.
    const grip = partsOf(await canvas(), "q1").querySelector(".flow-node__grip")!;

    expect(grip.getAttribute("aria-hidden")).toBe("true");
    expect(grip.tagName).not.toBe("BUTTON");
  });

  test("and the whole header still drags", async () => {
    /*
     * The point of the compromise. Shrinking the target to the grip would have
     * made dragging harder on the device this was reported from.
     */
    const header = partsOf(await canvas(), "q1").querySelector<HTMLElement>(
      ".flow-node__header",
    )!;

    expect(header.hasAttribute("data-drag-handle")).toBe(true);
    expect(getComputedStyle(header).touchAction).toBe("none");
  });
});

describe("the menu button", () => {
  test("opens the menu, and says so", async () => {
    const nodeEditor = await canvas();

    menuButton(nodeEditor, "q1").click();
    await settle();

    expect(menuIsOpen(nodeEditor)).toBe(true);
    expect(menuButton(nodeEditor, "q1").getAttribute("aria-expanded")).toBe("true");
    expect(menuButton(nodeEditor, "q1").textContent?.trim()).toBe("✕");
  });

  test("and closes it when pressed again", async () => {
    const nodeEditor = await canvas();

    menuButton(nodeEditor, "q1").click();
    await settle();
    menuButton(nodeEditor, "q1").click();
    await settle();

    expect(menuIsOpen(nodeEditor)).toBe(false);
    expect(menuButton(nodeEditor, "q1").getAttribute("aria-expanded")).toBe("false");
    expect(menuButton(nodeEditor, "q1").textContent?.trim()).toBe("⋯");
  });

  test("another node's button opens its own menu rather than closing this one", async () => {
    const nodeEditor = await canvas();

    menuButton(nodeEditor, "q1").click();
    await settle();
    menuButton(nodeEditor, "q2").click();
    await settle();

    expect(menuIsOpen(nodeEditor)).toBe(true);
    expect(menuButton(nodeEditor, "q1").textContent?.trim()).toBe("⋯");
    expect(menuButton(nodeEditor, "q2").textContent?.trim()).toBe("✕");
  });

  test("and the cross goes back when the menu closes some other way", async () => {
    /*
     * The menu closes for plenty of reasons that have nothing to do with the
     * button. A cross left over a menu that is gone is worse than a button that
     * never changed at all.
     */
    const nodeEditor = await canvas();

    menuButton(nodeEditor, "q1").click();
    await settle();
    nodeEditor.selectNodeById("q2");
    await settle();

    expect(menuIsOpen(nodeEditor)).toBe(false);
    expect(menuButton(nodeEditor, "q1").textContent?.trim()).toBe("⋯");
  });
});

describe("typens ikon", () => {
  test("och dess urtag har huvudets färg, så formen läses", async () => {
    /*
     * Ikonernas urtag (kalenderns rader, diamantens gren) bär klassen `cut`
     * och fylls i paletten med badgens tint. I huvudet ärvde de
     * `currentColor` = vitt, så en vit form fick vita urtag och läste som
     * en klump — sett i stillbild 1/9. Urtaget ska vara huvudets egen färg:
     * lila på en regel, indigo på innehåll, grönt på ett avslut. Mätt på en
     * regelnod, för textfrågans "T" har inget urtag att mäta.
     */
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 1000px; height: 700px;";
    document.body.append(editor);
    editor.graph = {
      startNodeId: "r",
      nodes: [{ id: "r", type: "rule", position: { x: 80, y: 80 }, data: { title: "Var?", cases: [], fallbackLabel: "Annars" } }],
      connections: [],
    } as never;
    await settle();
    await settle();

    const nodeEditor = editor.shadowRoot!.querySelector<NodeEditor>("node-editor")!;
    const header = partsOf(nodeEditor, "r").querySelector<HTMLElement>(".flow-node__header")!;
    const cut = header.querySelector<SVGElement>(".flow-node__type-icon svg .cut");

    expect(cut, "regelns ikon saknar urtag").not.toBeNull();
    expect(getComputedStyle(cut!).fill, "urtaget är vitt, som glyfen").toBe(
      getComputedStyle(header).backgroundColor,
    );
  });

  test("och följer textens baslinje, inte radrutans mitt", async () => {
    /*
     * Johans iPad 1/9, två gånger: ikonen linjerade inte med versalerna, och
     * en pixels nudge gjorde det inte bättre. Att centrera en form mot
     * radrutan är fel METOD — radrutan ser olika ut i SF, Segoe och DejaVu.
     * Det robusta är att ikonen står inline i texten och linjerar mot dess
     * egen baslinje med `vertical-align` i em: då följer den typsnittet på
     * varje plattform utan pixelgissningar.
     */
    const header = partsOf(await canvas(), "q1").querySelector<HTMLElement>(".flow-node__header")!;
    const icon = header.querySelector<HTMLElement>(".flow-node__type-icon")!;

    expect(icon.parentElement?.classList.contains("flow-node__header-text"), "ikonen står utanför textens rad").toBe(true);
    expect(getComputedStyle(icon).display).toBe("inline-block");
    expect(getComputedStyle(icon).verticalAlign, "ikonen linjerar inte mot baslinjen").not.toBe("baseline");
  });

  test("och står tätt intill namnet — ett mellanrum, inte två", async () => {
    /*
     * Johan 1/9: "går det att få ikonen närmare texten?" Mätt: 16 px mellan
     * ikon och text — huvudets `gap` (10) plus en egen `margin-right` (6)
     * staplade på varandra. Ett mellanrum räcker, och det ska vara samma
     * som mellan gripp och ikon så raden läses som en enhet.
     */
    const header = partsOf(await canvas(), "q1").querySelector<HTMLElement>(".flow-node__header")!;
    const icon = header.querySelector<HTMLElement>(".flow-node__type-icon")!.getBoundingClientRect();
    const textEl = header.querySelector<HTMLElement>(".flow-node__header-text")!;
    const name = [...textEl.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim() !== "")!;
    const range = document.createRange();
    range.selectNodeContents(name);
    const glyphs = [...range.getClientRects()].filter((r) => r.width > 0)[0]!;

    expect(Math.round(glyphs.left - icon.right), "ikonen står för långt från namnet").toBeLessThanOrEqual(10);
    expect(Math.round(glyphs.left - icon.right), "ikonen sitter ihop med namnet").toBeGreaterThanOrEqual(4);
  });

  test("står i huvudet, före namnet, och säger inget till skärmläsaren", async () => {
    const header = partsOf(await canvas(), "q1").querySelector(".flow-node__header")!;
    const icon = header.querySelector<HTMLElement>(".flow-node__type-icon");

    expect(icon, "ikonen saknas i huvudet").not.toBeNull();
    expect(icon!.querySelector("svg"), "ikonen är inte ritad som SVG").not.toBeNull();
    expect(icon!.getAttribute("aria-hidden")).toBe("true");

    const text = header.querySelector(".flow-node__header-text")!;
    const name = [...text.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim() !== "")!;

    expect(name, "namnet saknas som text").toBeDefined();
    expect(
      icon!.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING,
      "ikonen står inte före namnet",
    ).toBeTruthy();
  });
});

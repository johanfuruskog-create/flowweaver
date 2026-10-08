import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";

/**
 * Story 145: the side panel folds into a 57 px rail and opens over the flow.
 *
 * One test per criterion that a browser can measure. What it cannot: the iPad
 * itself (WebKit is not the device, the story says so), reduced motion as the
 * operating system sets it, and 200 % text — those are the pictures' and
 * Johan's. The width rule is `guide-editor-panel-width`, the site's memory
 * `src/site/panel-persistence`.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const GRAPH = {
  version: 8,
  startNodeId: "q1",
  nodes: [
    { id: "q1", type: "text-question", position: { x: 40, y: 40 }, data: { title: "Ett", variableName: "a" } },
    { id: "q2", type: "text-question", position: { x: 420, y: 40 }, data: { title: "Två", variableName: "b" } },
  ],
  connections: [],
};

async function editorOf(attrs: Record<string, string> = {}, width = 1280): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  for (const [name, value] of Object.entries(attrs)) editor.setAttribute(name, value);
  editor.style.cssText = `display: block; width: ${width}px; height: 720px;`;
  document.body.append(editor);
  editor.graph = structuredClone(GRAPH) as never;
  await settle();
  await settle();

  return editor;
}

const $ = <T extends HTMLElement = HTMLElement>(editor: GuideEditor, selector: string): T =>
  editor.shadowRoot!.querySelector<T>(selector)!;
const panelOf = (editor: GuideEditor) => $(editor, ".guide-editor__sidebar");
const openerOf = (editor: GuideEditor) => $<HTMLButtonElement>(editor, '[data-action="panel-open"]');
const closerOf = (editor: GuideEditor) => $<HTMLButtonElement>(editor, '[data-action="panel-close"]');
const nodeEditorOf = (editor: GuideEditor) => $(editor, "node-editor");
const nodeOf = (editor: GuideEditor, id: string) =>
  [...nodeEditorOf(editor).shadowRoot!.querySelectorAll<HTMLElement>("flow-node")].find(
    (node) => (node as unknown as { nodeId: string }).nodeId === id
  )!;
const focused = (editor: GuideEditor): Element | null => editor.shadowRoot!.activeElement;
const isSelected = (node: HTMLElement): boolean => (node as unknown as { selected: boolean }).selected;

function recordOpen(editor: GuideEditor): boolean[] {
  const seen: boolean[] = [];

  editor.addEventListener("panel-open-changed", (event) => {
    seen.push((event as CustomEvent<{ open: boolean }>).detail.open);
  });

  return seen;
}

/** Where the flow is on the screen: the canvas, a node and the zoom. */
function view(editor: GuideEditor) {
  const canvas = $(editor, ".guide-editor__canvas").getBoundingClientRect();
  const node = nodeOf(editor, "q1").getBoundingClientRect();
  const scaled = nodeEditorOf(editor).shadowRoot!.querySelector<HTMLElement>(".node-editor__scaled")!;

  return {
    canvas: [canvas.left, canvas.width],
    node: [node.left, node.top, node.width],
    zoom: getComputedStyle(scaled).transform,
  };
}

describe("två smala spalter (kriterium 1, 3 och 4)", () => {
  test("utan ett ord från värden är panelen infälld: en spalt på 57 px med « överst", async () => {
    const editor = await editorOf();
    const rail = $(editor, "[data-panel-rail]").getBoundingClientRect();

    expect(editor.panelOpen).toBe(false);
    expect(panelOf(editor).hidden).toBe(true);
    expect(rail.width).toBe(57);
    expect(openerOf(editor).getAttribute("aria-expanded")).toBe("false");
    expect(openerOf(editor).getAttribute("aria-label")).toBe("Öppna sidopanelen");
    expect(openerOf(editor).textContent!.trim()).toBe("«");
  });

  test("genvägarna heter Egenskaper och Förhandsgranskning, 44 × 44 med 8 px emellan", async () => {
    const editor = await editorOf();
    const [properties, preview] = [
      ...editor.shadowRoot!.querySelectorAll<HTMLButtonElement>("[data-panel-shortcut]"),
    ];

    expect(properties.getAttribute("aria-label")).toBe("Egenskaper");
    expect(preview.getAttribute("aria-label")).toBe("Förhandsgranskning");

    const a = properties.getBoundingClientRect();
    const b = preview.getBoundingClientRect();

    expect([a.width, a.height, b.width, b.height]).toEqual([44, 44, 44, 44]);
    expect(b.top - a.bottom).toBe(8);
  });

  test("öppen panel har » som fäller in, och namnen följer editorns språk", async () => {
    const editor = await editorOf({ "panel-open": "", "editor-locale": "en" });

    expect(closerOf(editor).textContent!.trim()).toBe("»");
    expect(closerOf(editor).getAttribute("aria-label")).toBe("Collapse the side panel");
    expect(openerOf(editor).getAttribute("aria-label")).toBe("Open the side panel");
  });
});

describe("överlägg utan förflyttning (kriterium 2)", () => {
  test("öppna och fälla in ändrar varken canvasens bredd, noderna, zoomen eller markeringen", async () => {
    const editor = await editorOf();
    const nodeEditor = nodeEditorOf(editor) as unknown as { selectNodeById(id: string): void };

    nodeEditor.selectNodeById("q1");
    await settle();
    const before = view(editor);
    const graphBefore = JSON.stringify(editor.getData());

    openerOf(editor).click();
    await settle(250);
    const open = view(editor);
    const panel = panelOf(editor).getBoundingClientRect();

    closerOf(editor).click();
    await settle(250);
    const after = view(editor);

    expect(panel.width, "panelen öppnades aldrig — provet mäter inget").toBeGreaterThan(300);
    expect(open).toEqual(before);
    expect(after).toEqual(before);
    expect(JSON.stringify(editor.getData())).toBe(graphBefore);
    expect(isSelected(nodeOf(editor, "q1"))).toBe(true);
  });
});

describe("pilen och genvägarna (kriterium 4, 5 och 12)", () => {
  test("« öppnar på senast valda flik och ger den fokus; » fäller in och ger « fokus", async () => {
    const editor = await editorOf();
    const seen = recordOpen(editor);

    openerOf(editor).click();
    expect(editor.panelOpen).toBe(true);
    expect(openerOf(editor).getAttribute("aria-expanded")).toBe("true");
    expect(focused(editor)?.id).toBe("properties-tab");

    $<HTMLButtonElement>(editor, "#preview-tab").click();
    closerOf(editor).click();
    expect(editor.panelOpen).toBe(false);
    expect(focused(editor)).toBe(openerOf(editor));

    openerOf(editor).click();
    expect(focused(editor)?.id, "pilen minns fliken").toBe("preview-tab");
    expect($(editor, "#preview-tab").getAttribute("aria-selected")).toBe("true");
    expect(seen).toEqual([true, false, true]);
  });

  test("en genväg öppnar på sin flik, som sedan är den pilen minns", async () => {
    const editor = await editorOf();

    $<HTMLButtonElement>(editor, '[data-panel-shortcut="preview"]').click();
    expect(editor.panelOpen).toBe(true);
    expect(focused(editor)?.id).toBe("preview-tab");

    closerOf(editor).click();
    $<HTMLButtonElement>(editor, '[data-panel-shortcut="properties"]').click();
    expect(focused(editor)?.id).toBe("properties-tab");

    closerOf(editor).click();
    openerOf(editor).click();
    expect(focused(editor)?.id).toBe("properties-tab");
  });

  test("infälld spalt och öppen panel tar aldrig fokus samtidigt", async () => {
    const editor = await editorOf();
    const rail = $(editor, "[data-panel-rail]");

    expect(rail.inert).toBe(false);
    expect(panelOf(editor).inert).toBe(true);

    openerOf(editor).click();
    expect(rail.inert, "spalten under panelen").toBe(true);
    expect(panelOf(editor).inert).toBe(false);
  });
});

describe("redigeringen bevaras (kriterium 6)", () => {
  test("Enter på en nod väljer den och öppnar panelen, fokus stannar på noden", async () => {
    const editor = await editorOf();
    const node = nodeOf(editor, "q2");
    const seen = recordOpen(editor);

    // The card inside the node is what takes focus and the keys.
    const card = node.shadowRoot!.querySelector<HTMLElement>(".flow-node")!;

    card.focus();
    card.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true, cancelable: true }));
    await settle();

    expect(editor.panelOpen).toBe(true);
    expect(seen).toEqual([true]);
    expect(isSelected(node)).toBe(true);
    expect(node.shadowRoot!.activeElement, "fokus stannar på noden").toBe(card);
  });

  test("ett klick väljer utan att öppna; ett dubbelklick öppnar", async () => {
    const editor = await editorOf();
    const node = nodeOf(editor, "q2");

    (nodeEditorOf(editor) as unknown as { selectNodeById(id: string): void }).selectNodeById("q2");
    await settle();
    expect(editor.panelOpen, "ett val öppnar inte").toBe(false);

    node.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, composed: true }));
    expect(editor.panelOpen).toBe(true);
  });

  test("fältets värde står kvar efter infällning och återöppning, och inget blev ett ångrasteg", async () => {
    const editor = await editorOf({ "panel-open": "" });

    (nodeEditorOf(editor) as unknown as { selectNodeById(id: string): void }).selectNodeById("q1");
    await settle();
    const historyBefore = (editor as unknown as { canUndo?: () => boolean }).canUndo?.();

    closerOf(editor).click();
    await settle(250);
    openerOf(editor).click();
    await settle();

    expect(JSON.stringify(editor.getData().nodes[0].data)).toContain('"title":"Ett"');
    expect((editor as unknown as { canUndo?: () => boolean }).canUndo?.()).toBe(historyBefore);
  });

  test("vägen till ett fält öppnar panelen på Egenskaper", async () => {
    const editor = await editorOf();

    $<HTMLButtonElement>(editor, '[data-panel-shortcut="preview"]').click();
    closerOf(editor).click();
    editor.revealNode("q1", "title");
    await settle();

    expect(editor.panelOpen).toBe(true);
    expect($(editor, "#properties-tab").getAttribute("aria-selected")).toBe("true");
  });
});

describe("kontrollerna går åt sidan (kriterium 8)", () => {
  test("kartan och zoomraden står till vänster om den öppna panelen, och tillbaka när den fälls in", async () => {
    const editor = await editorOf();
    const inner = nodeEditorOf(editor).shadowRoot!;
    const bar = () => inner.querySelector<HTMLElement>(".node-editor__canvas-toolbar")!.getBoundingClientRect();
    const folded = bar().right;

    openerOf(editor).click();
    await settle(250);
    const panel = panelOf(editor).getBoundingClientRect();

    expect(bar().right).toBeLessThanOrEqual(panel.left);

    closerOf(editor).click();
    await settle(250);
    expect(bar().right).toBe(folded);
  });
});

describe("det editorn placerar med flit hamnar där det syns (berättelse 145)", () => {
  /*
   * Found in a film on 8/10: with the panel open, "Visa hela flödet" fitted the
   * guide into the whole view, the panel lay over its right part, and the film
   * clicked a field in the panel where the submission node should have been.
   */
  test("Visa hela flödet lägger varje nod till vänster om den öppna panelen", async () => {
    const editor = await editorOf({ "panel-open": "" }, 1100);
    const wide = {
      ...GRAPH,
      nodes: Array.from({ length: 6 }, (_, index) => ({
        id: `q${index + 1}`,
        type: "text-question",
        position: { x: 40 + index * 380, y: 40 },
        data: { title: `Nod ${index + 1}`, variableName: `v${index + 1}` },
      })),
    };

    editor.graph = wide as never;
    await settle();
    await settle();
    nodeEditorOf(editor).shadowRoot!.querySelector<HTMLButtonElement>('[data-action="canvas-fit"]')!.click();
    await settle(300);

    const panelLeft = panelOf(editor).getBoundingClientRect().left;
    const rights = [...nodeEditorOf(editor).shadowRoot!.querySelectorAll<HTMLElement>("flow-node")].map(
      (node) => Math.round(node.getBoundingClientRect().right)
    );

    expect(rights).toHaveLength(6);
    for (const right of rights) expect(right, "en nod under panelen").toBeLessThanOrEqual(panelLeft);
  });
});

describe("rörelsen (kriterium 9)", () => {
  test("infällningen gör panelen inert direkt och döljer den när 180 ms gått; ett nytt tryck avbryter", async () => {
    const editor = await editorOf({ "panel-open": "" });
    const panel = panelOf(editor);

    closerOf(editor).click();
    expect(panel.inert, "inert från första bildrutan").toBe(true);
    expect(panel.hidden, "ännu synlig medan den fälls in").toBe(false);
    expect(panel.dataset.motion).toBe("closing");

    openerOf(editor).click();
    expect(panel.hidden).toBe(false);
    expect(panel.inert).toBe(false);
    await settle(250);
    expect(panel.hidden, "det avbrutna slutet dolde den ändå").toBe(false);

    closerOf(editor).click();
    await settle(250);
    expect(panel.hidden).toBe(true);
    expect(panel.dataset.motion).toBeUndefined();
  });

  test("ett läge från värden ritas direkt, utan rörelse", async () => {
    const editor = await editorOf();

    editor.panelOpen = true;
    expect(panelOf(editor).hidden).toBe(false);
    expect(panelOf(editor).dataset.motion).toBeUndefined();

    editor.panelOpen = false;
    expect(panelOf(editor).hidden).toBe(true);
  });
});

describe("värden äger läget (kriterium 10 och 11)", () => {
  test("attribut satt före första ritningen: öppen i första bilden, och ingen händelse", async () => {
    const seen: boolean[] = [];

    document.addEventListener("panel-open-changed", () => seen.push(true), { once: true });
    const editor = await editorOf({ "panel-open": "" });

    expect(panelOf(editor).hidden).toBe(false);
    expect(panelOf(editor).dataset.motion).toBeUndefined();
    expect(seen, "värdens eget val är ingen ändring att rapportera").toEqual([]);
  });

  test("egenskapen och attributet säger samma sak", async () => {
    const editor = await editorOf();

    editor.panelOpen = true;
    expect(editor.hasAttribute("panel-open")).toBe(true);
    editor.removeAttribute("panel-open");
    expect(editor.panelOpen).toBe(false);
  });
});

describe("höger till vänster (kriterium 12)", () => {
  test("panelen och spalten står vid vänsterkanten", async () => {
    const editor = await editorOf({ dir: "rtl", "panel-open": "" });
    const workspace = $(editor, ".guide-editor__workspace").getBoundingClientRect();
    const panel = panelOf(editor).getBoundingClientRect();
    const rail = $(editor, "[data-panel-rail]").getBoundingClientRect();

    expect(panel.left).toBe(workspace.left);
    expect(rail.left).toBe(workspace.left);

    // The health badge stands at the canvas's left edge in both directions, so
    // right to left it is the one control the panel would cover (criterion 8).
    await settle(100);
    const health = $(editor, "[data-health]").getBoundingClientRect();

    expect(health.left, "hälsobrickan under panelen").toBeGreaterThanOrEqual(panel.right);
  });
});

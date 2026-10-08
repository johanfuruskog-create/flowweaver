import { afterEach, describe, expect, test, vi } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * The canvas's own toolbar — Uppdrag 23/9, Del A punkt 2.
 *
 * Bottom-centre shortcut to three things the Vy-menu already does (zoom,
 * "Anpassa till innehåll", fullscreen) plus a live zoom readout. It must call
 * the existing operations rather than a second implementation, size every
 * button to K6 (44 px), and never sit on top of the minimap or the health
 * badge — both of which also float over the canvas, and both of which were
 * measured in the uppdrag against a 900 px viewport specifically because that
 * is where three floating things get closest together.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const wideGraph = () => ({
  startNodeId: "n0",
  nodes: Array.from({ length: 8 }, (_, index) => ({
    id: `n${index}`,
    type: "text-question",
    position: { x: index * 420, y: (index % 2) * 200 },
    data: { title: `Nod ${index}`, variableName: `v${index}` },
  })),
  connections: [],
});

async function editorAt(width: number, dir?: "rtl"): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  /*
   * The side panel open (story 145), as these tests were written: it lies over
   * the canvas now, and the controls stand in what it leaves — the same width
   * the canvas itself had beside a docked panel, so every width below still
   * names the same arrangement.
   */
  editor.setAttribute("panel-open", "");
  if (dir) editor.setAttribute("dir", dir);
  editor.style.cssText = `display: block; width: ${width}px; height: 700px;`;
  document.body.append(editor);
  editor.graph = wideGraph() as never;

  await settle();
  await settle();

  return editor;
}

function nodeEditorOf(editor: GuideEditor): NodeEditor {
  const found = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  if (!found) throw new Error("node-editor saknas.");
  return found;
}

function toolbarOf(nodeEditor: NodeEditor): HTMLElement {
  const found = nodeEditor.shadowRoot!.querySelector<HTMLElement>(
    "[data-canvas-toolbar]",
  );
  if (!found) throw new Error("canvas-toolbar saknas.");
  return found;
}

const zoomOf = (nodeEditor: NodeEditor): number =>
  new DOMMatrix(
    getComputedStyle(
      nodeEditor.shadowRoot!.querySelector<HTMLElement>(".node-editor__scaled")!,
    ).transform,
  ).a;

describe("canvasens verktygsfält", () => {
  test("syns när grafen har noder, döljs när den är tom", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);

    expect(toolbarOf(nodeEditor).hidden).toBe(false);

    editor.graph = { startNodeId: null, nodes: [], connections: [] } as never;
    await settle();

    expect(toolbarOf(nodeEditor).hidden).toBe(true);
  });

  test("varje knapp har minst 44x44 px träffyta (K6)", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);
    const buttons = [
      ...toolbarOf(nodeEditor).querySelectorAll<HTMLButtonElement>("button"),
    ];

    expect(buttons.length).toBeGreaterThan(0);

    for (const button of buttons) {
      const rect = button.getBoundingClientRect();

      expect(rect.width, button.dataset.action ?? "").toBeGreaterThanOrEqual(44);
      expect(rect.height, button.dataset.action ?? "").toBeGreaterThanOrEqual(44);
    }
  });

  /*
   * Johans iPad 28/9 natt, loggat från enheten: `pointerdown` och `pointerup`
   * (touch) på plus och minus varje gång, aldrig något `click` — zoomen stod
   * kvar på 100 %. Samma sak som *tillbaka till nod* mättes till 25/9 (se
   * node-editor-lost-touch.browser.test.ts): knappen ligger utanför canvasens
   * vy, och WebKit håller inne klicket. Samma reservväg: ett tryck som
   * stannade på plats gäller på `pointerup`, ett click strax efter räknas
   * inte en gång till, och en mus lämnas i fred.
   */
  test("ett tryck utan click zoomar in, och ett click strax efter zoomar inte en gång till", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);
    const button = toolbarOf(nodeEditor).querySelector<HTMLButtonElement>('[data-action="canvas-zoom-in"]')!;
    const box = button.getBoundingClientRect();
    const at = (type: string, dx: number) =>
      button.dispatchEvent(new PointerEvent(type, {
        bubbles: true, composed: true, pointerType: "touch", pointerId: 9,
        clientX: box.left + box.width / 2 + dx, clientY: box.top + box.height / 2,
      }));

    expect(zoomOf(nodeEditor)).toBeCloseTo(1, 5);
    at("pointerdown", 0);
    at("pointerup", 3);
    await settle();

    const afterTap = zoomOf(nodeEditor);

    expect(afterTap, "trycket utan click zoomade inte").toBeGreaterThan(1);
    button.click();
    await settle();
    expect(zoomOf(nodeEditor), "clicket efter trycket zoomade en gång till").toBeCloseTo(afterTap, 5);

    at("pointerdown", 0);
    at("pointerup", 40);
    await settle();
    expect(zoomOf(nodeEditor), "ett finger som gled i väg räknas inte").toBeCloseTo(afterTap, 5);
  });

  test("minus och plus anropar samma zoomIn/zoomOut som tangentbordet", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);
    const toolbar = toolbarOf(nodeEditor);
    const readout = toolbar.querySelector<HTMLElement>(
      "[data-canvas-toolbar-zoom]",
    )!;

    expect(zoomOf(nodeEditor)).toBeCloseTo(1, 5);
    expect(readout.textContent).toBe("100 %");

    toolbar
      .querySelector<HTMLButtonElement>('[data-action="canvas-zoom-in"]')!
      .click();
    await settle();

    expect(zoomOf(nodeEditor)).toBeGreaterThan(1);
    expect(readout.textContent).toBe(`${Math.round(zoomOf(nodeEditor) * 100)} %`);

    toolbar
      .querySelector<HTMLButtonElement>('[data-action="canvas-zoom-out"]')!
      .click();
    toolbar
      .querySelector<HTMLButtonElement>('[data-action="canvas-zoom-out"]')!
      .click();
    await settle();

    expect(zoomOf(nodeEditor)).toBeLessThan(1);
  });

  test('"Visa hela flödet" anropar fitToContent(true), inte en egen implementation', async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);
    const spy = vi.spyOn(nodeEditor, "fitToContent");

    toolbarOf(nodeEditor)
      .querySelector<HTMLButtonElement>('[data-action="canvas-fit"]')!
      .click();

    expect(spy).toHaveBeenCalledWith(true);
  });

  test("helskärmsknappen skickar samma fullscreen-toggle-request som menyn", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);
    const heard = vi.fn();

    editor.shadowRoot!.addEventListener("fullscreen-toggle-request", heard);

    toolbarOf(nodeEditor)
      .querySelector<HTMLButtonElement>('[data-action="canvas-fullscreen"]')!
      .click();

    expect(heard).toHaveBeenCalledTimes(1);
  });

  test("setFullscreen byter både aria-pressed och den talade etiketten", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);
    const button = toolbarOf(nodeEditor).querySelector<HTMLButtonElement>(
      "[data-canvas-toolbar-fullscreen]",
    )!;

    expect(button.getAttribute("aria-pressed")).toBe("false");

    nodeEditor.setFullscreen(true);

    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("Avsluta helskärm");

    nodeEditor.setFullscreen(false);

    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Helskärm");
  });

  test("delar aldrig en pixel med minikartan eller Inga problem-brickan i 900 px", async () => {
    const editor = await editorAt(900);
    const nodeEditor = nodeEditorOf(editor);

    // Minikartan visas bara när guiden inte ryms i vyn — den breda testgrafen
    // ser till att den gör det, annars mäter det här ingenting.
    const minimap = nodeEditor.shadowRoot!.querySelector<HTMLElement>(
      ".node-editor__minimap",
    )!;
    const health = editor.shadowRoot!.querySelector<HTMLElement>(
      "[data-health]",
    )!;

    expect(minimap.hidden, "minikartan visades aldrig — grafen ryms i vyn").toBe(
      false,
    );

    const toolbarRect = toolbarOf(nodeEditor).getBoundingClientRect();
    const minimapRect = minimap.getBoundingClientRect();
    const healthRect = health.getBoundingClientRect();

    const overlaps = (a: DOMRect, b: DOMRect): boolean =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

    expect(overlaps(toolbarRect, minimapRect), "täcker minikartan").toBe(false);
    expect(overlaps(toolbarRect, healthRect), "täcker Inga problem-brickan").toBe(
      false,
    );
  });
});

describe("zoomvärdet i 900 px med sidopanelen öppen (Johan 23/9)", () => {
  // Vid 900 px fick talet och procenttecknet varsin rad: spannet krympte i
  // flexraden och bröt vid mellanrummet. Mätt på textnodens rektanglar — en
  // rad är en rektangel — och på att bredden inte byter när talet gör det.
  test("står på en rad och har fast plats för det längsta värdet", async () => {
    const editor = await editorAt(900);
    const nodeEditor = nodeEditorOf(editor);
    const zoomEl = nodeEditor.shadowRoot!.querySelector<HTMLElement>(
      "[data-canvas-toolbar-zoom]",
    )!;
    const rects = (): number => {
      const range = document.createRange();
      range.selectNodeContents(zoomEl);
      return range.getClientRects().length;
    };

    expect(zoomEl.textContent, "mellanrummet mellan tal och procent").toMatch(/^\d+ %$/);
    expect(rects(), "talet och procenttecknet på olika rader").toBe(1);

    /*
     * No width jump over the whole range (Astra §6 punkt 2): the reading and
     * the plus beside it stand still from ZOOM_MIN to ZOOM_MAX. 25 % has one
     * digit fewer than 100 % and 150 % — comparing only the three-digit two
     * let a cell that sized itself to its text through (mutation 29/9).
     */
    const plus = toolbarOf(nodeEditor).querySelector<HTMLElement>('[data-action="canvas-zoom-in"]')!;
    const widthAt100 = zoomEl.getBoundingClientRect().width;
    const plusAt100 = plus.getBoundingClientRect().left;
    for (let i = 0; i < 20; i += 1) nodeEditor.zoomOut();
    await settle();
    expect(zoomEl.textContent).toBe("25 %");
    expect(rects()).toBe(1);
    expect(zoomEl.getBoundingClientRect().width, "bredden byter vid 25 %").toBe(widthAt100);
    expect(plus.getBoundingClientRect().left, "plus flyttar sig vid 25 %").toBe(plusAt100);
    for (let i = 0; i < 40; i += 1) nodeEditor.zoomIn();
    await settle();
    expect(zoomEl.textContent).toBe("150 %");
    expect(rects()).toBe(1);
    expect(zoomEl.getBoundingClientRect().width, "bredden byter med talet").toBe(widthAt100);
    expect(plus.getBoundingClientRect().left, "plus flyttar sig vid 150 %").toBe(plusAt100);

    // Fältet ska fortfarande rymmas i canvasen, sidopanelen öppen.
    const toolbarRect = toolbarOf(nodeEditor).getBoundingClientRect();
    const canvasRect = nodeEditor.getBoundingClientRect();
    expect(toolbarRect.left).toBeGreaterThanOrEqual(canvasRect.left);
    expect(toolbarRect.right).toBeLessThanOrEqual(canvasRect.right);
  });
});

describe("platsen (Uppdrag 29/9, Del C — Astra §4)", () => {
  // Till vänster om minikartan med 16 px luft, nederkanterna i linje, 16 px
  // till canvasens kant; utan minikarta tar fältet hörnet självt. Ersätter
  // 23/9:s "8 px, mitt för kartan" (Johans bild då, Astras spec nu).
  // The canvas as its controls see it: the view less what an open panel
  // covers (story 145). Without a panel over it, it is the whole view.
  const canvasOf = (nodeEditor: NodeEditor) =>
    nodeEditor.shadowRoot!.querySelector<HTMLElement>(".node-editor__controls")!.getBoundingClientRect();
  const mapOf = (nodeEditor: NodeEditor) =>
    nodeEditor.shadowRoot!.querySelector<HTMLElement>(".node-editor__minimap")!;

  test("bred canvas: 16 px till vänster om minikartan, nederkanterna i linje, 16 px till kanten", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);
    const minimap = mapOf(nodeEditor);

    expect(minimap.hidden, "minikartan visades aldrig").toBe(false);

    const c = canvasOf(nodeEditor);
    const m = minimap.getBoundingClientRect();
    const t = toolbarOf(nodeEditor).getBoundingClientRect();

    expect(m.left - t.right, "luften till minikartan").toBeCloseTo(16, 0);
    expect(t.bottom, "nederkanterna står inte i linje").toBeCloseTo(m.bottom, 0);
    expect(c.right - m.right, "kartans luft till kanten").toBeCloseTo(16, 0);
    expect(c.bottom - m.bottom, "luften till underkanten").toBeCloseTo(16, 0);
  });

  test("tar hörnet självt när minikartan är dold", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);

    editor.graph = { ...wideGraph(), nodes: wideGraph().nodes.slice(0, 2) } as never;
    await settle();
    await settle();

    expect(mapOf(nodeEditor).hidden, "minikartan visas fast guiden ryms").toBe(true);

    const c = canvasOf(nodeEditor);
    const t = toolbarOf(nodeEditor).getBoundingClientRect();

    expect(c.right - t.right).toBeCloseTo(16, 0);
    expect(c.bottom - t.bottom).toBeCloseTo(16, 0);
  });

  test("går åt sidan när panelen dras bredare (berättelse 141 och 145)", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);
    const before = canvasOf(nodeEditor).right;

    editor.panelWidth = 700;
    await settle();
    await settle();

    const c = canvasOf(nodeEditor);
    expect(c.right, "panelen flyttade aldrig kontrollernas kant — provet mäter inget").toBeLessThan(before - 50);
    const m = mapOf(nodeEditor);
    const corner = m.hidden ? toolbarOf(nodeEditor) : m;
    expect(c.right - corner.getBoundingClientRect().right, "står kvar i fönstret, inte i canvasen").toBeCloseTo(16, 0);
  });

  test("smal canvas: minikartan står 12 px ovanför fältet, samma högerkant", async () => {
    const editor = await editorAt(1000);
    const nodeEditor = nodeEditorOf(editor);
    const minimap = mapOf(nodeEditor);
    const c = canvasOf(nodeEditor);

    expect(c.width, "canvasen är inte i det staplade intervallet").toBeLessThan(660);
    expect(c.width).toBeGreaterThanOrEqual(480);
    expect(minimap.hidden, "minikartan visades aldrig").toBe(false);

    const m = minimap.getBoundingClientRect();
    const t = toolbarOf(nodeEditor).getBoundingClientRect();

    expect(t.top - m.bottom, "luften mellan kartan och fältet").toBeCloseTo(12, 0);
    expect(t.right).toBeCloseTo(m.right, 0);
    expect(c.bottom - t.bottom, "fältet har inte hörnet").toBeCloseTo(16, 0);
  });

  /*
   * Pers prov (30/9): de andra provets breddval (1000, 1400 px editor) ligger
   * gott och väl på var sin sida av 660-gränsen — en flyttad gräns inom det
   * spannet (t.ex. 660 → 700) gick grön mot båda. 1220/1230 editor-px gav
   * canvas 650/660 (uppmätt), ett par som just griper om gränsen: sida vid
   * sida vid exakt 660, staplat strax under.
   */
  test("gränsen mellan staplat och sida vid sida ligger vid 660 px canvas, inte däromkring", async () => {
    // 1087/1097 since 7/10: the palette is a 57 px rail at every width (story
    // 146), where at 1220 it stood open at 190 — 133 px of canvas moved.
    const stacked = await editorAt(1087);
    const sideBySide = await editorAt(1097);

    const stackedCanvas = canvasOf(nodeEditorOf(stacked));
    const sideCanvas = canvasOf(nodeEditorOf(sideBySide));

    expect(stackedCanvas.width, "provets breddval mäter inte längre strax under 660").toBeLessThan(660);
    expect(sideCanvas.width, "provets breddval mäter inte längre vid/över 660").toBeGreaterThanOrEqual(660);

    const mStacked = mapOf(nodeEditorOf(stacked)).getBoundingClientRect();
    const tStacked = toolbarOf(nodeEditorOf(stacked)).getBoundingClientRect();
    expect(tStacked.top - mStacked.bottom, "strax under 660 ska vara staplat").toBeCloseTo(12, 0);

    const mSide = mapOf(nodeEditorOf(sideBySide)).getBoundingClientRect();
    const tSide = toolbarOf(nodeEditorOf(sideBySide)).getBoundingClientRect();
    expect(mSide.left - tSide.right, "vid 660 ska det vara sida vid sida").toBeCloseTo(16, 0);
    expect(tSide.bottom, "nederkanterna i linje vid 660").toBeCloseTo(mSide.bottom, 0);
  });

  // Johan 29/9 (uppdragets fråga 1): under 300 px canvas ritas minikartan
  // inte; zoomraden står kvar. En ny policy — ingen fanns.
  test("minikartan ritas inte under 300 px canvas, men väl över; zoomraden står kvar", async () => {
    for (const [width, drawn] of [[714, false], [754, true]] as const) {
      document.body.replaceChildren();
      const editor = await editorAt(width);
      const nodeEditor = nodeEditorOf(editor);
      const c = canvasOf(nodeEditor);
      const map = mapOf(nodeEditor);

      expect(c.width, `canvasen vid ${width}`).toBeCloseTo(drawn ? 320 : 280, -1);
      expect(map.hidden, "skriptet vill inte visa kartan — provet mäter inget").toBe(false);
      const box = map.getBoundingClientRect();
      expect(box.width > 0 && box.height > 0, `kartan vid ${Math.round(c.width)} px`).toBe(drawn);

      const bar = toolbarOf(nodeEditor).getBoundingClientRect();
      expect(bar.width, "zoomraden försvann").toBeGreaterThan(0);
    }
  });

  /*
   * The smallest window the editor serves (under 700 the small-screen notice
   * takes over): 202 px of canvas measured on the example page, and the
   * single row stood 76 px outside it. Two rows, no button smaller, the
   * reading on one line, all of it inside the canvas and above the badge.
   */
  test("minsta bredden: två rader, inget krymper, allt inom canvasen och ovanför brickan", async () => {
    const editor = await editorAt(700);
    const nodeEditor = nodeEditorOf(editor);
    const toolbar = toolbarOf(nodeEditor);
    const c = canvasOf(nodeEditor);

    expect(c.width, "canvasen är inte smal nog för att mäta tvåradsläget").toBeLessThan(300);

    const t = toolbar.getBoundingClientRect();
    expect(t.left, "fältet sticker ut till vänster").toBeGreaterThanOrEqual(c.left);
    expect(t.right).toBeLessThanOrEqual(c.right);

    for (const button of toolbar.querySelectorAll<HTMLButtonElement>("button")) {
      const b = button.getBoundingClientRect();
      expect(b.width, button.dataset.action).toBeGreaterThanOrEqual(44);
      expect(b.height, button.dataset.action).toBeGreaterThanOrEqual(44);
      expect(b.left, button.dataset.action).toBeGreaterThanOrEqual(c.left);
    }

    const readout = toolbar.querySelector<HTMLElement>("[data-canvas-toolbar-zoom]")!;
    const range = document.createRange();
    range.selectNodeContents(readout);
    expect(range.getClientRects().length, "zoomnivån bröts").toBe(1);

    const zoomOut = toolbar.querySelector('[data-action="canvas-zoom-out"]')!.getBoundingClientRect();
    const fit = toolbar.querySelector('[data-action="canvas-fit"]')!.getBoundingClientRect();
    expect(fit.top, "visa hela står inte på en egen rad").toBeGreaterThanOrEqual(zoomOut.bottom);
    // Two rows, not three: plus keeps the first row with minus and the
    // reading. Fell 29/9 (Fia) when the reading took the strong weight and
    // outgrew a width reckoned in the bar's own `ch`: plus dropped a row.
    const zoomIn = toolbar.querySelector('[data-action="canvas-zoom-in"]')!.getBoundingClientRect();
    expect(zoomIn.top, "plus föll ned från första raden").toBe(zoomOut.top);
    expect(fit.top, "visa hela står på en tredje rad").toBe(zoomOut.bottom);

    const health = editor.shadowRoot!.querySelector<HTMLElement>("[data-health]")!.getBoundingClientRect();
    expect(t.bottom, "fältet står i brickans rad").toBeLessThanOrEqual(health.top);
  });
});

/*
 * Uppdrag 29/9, Del A (Astra §1, §5, §6 punkt 1–2 och 4). Only what carries a
 * requirement: the order, the one divider, drawn icons, and the name shown on
 * keyboard focus. The look itself is left to the pictures (Astra §6: "inga
 * nya tester enbart för att spegla varje CSS-deklaration").
 */
describe("zoomraden (Uppdrag 29/9, Del A)", () => {
  test("ordningen är minus, zoomnivån, plus, en avdelare, visa hela, helskärm — i DOM och i bild", async () => {
    const editor = await editorAt(1400);
    const toolbar = toolbarOf(nodeEditorOf(editor));
    const parts = [...toolbar.children]
      .filter((child) => !(child as HTMLElement).hidden)
      .map((child) => {
        const el = child as HTMLElement;
        if (el.dataset.action) return el.dataset.action;
        if (el.querySelector("[data-canvas-toolbar-zoom]")) return "zoom";
        if (el.classList.contains("node-editor__canvas-toolbar-divider")) return "divider";
        return el.className;
      });

    expect(parts).toEqual([
      "canvas-zoom-out",
      "zoom",
      "canvas-zoom-in",
      "divider",
      "canvas-fit",
      "canvas-fullscreen",
    ]);

    // Focus order follows the DOM, so the visual order must be the DOM's too.
    const lefts = [...toolbar.children]
      .filter((child) => !(child as HTMLElement).hidden)
      .map((child) => child.getBoundingClientRect().left);
    expect(lefts, "den visuella ordningen avviker från DOM-ordningen").toEqual([...lefts].sort((a, b) => a - b));
  });

  test("exakt en avdelare, 1 × 24, vertikalt centrerad med 8 px till grannarna", async () => {
    const editor = await editorAt(1400);
    const toolbar = toolbarOf(nodeEditorOf(editor));
    const dividers = toolbar.querySelectorAll<HTMLElement>(".node-editor__canvas-toolbar-divider");

    expect(dividers).toHaveLength(1);

    const d = dividers[0].getBoundingClientRect();
    const bar = toolbar.getBoundingClientRect();
    const plus = toolbar.querySelector('[data-action="canvas-zoom-in"]')!.getBoundingClientRect();
    const fit = toolbar.querySelector('[data-action="canvas-fit"]')!.getBoundingClientRect();

    expect(d.width).toBe(1);
    expect(d.height).toBe(24);
    expect(Math.abs((d.top + d.height / 2) - (bar.top + bar.height / 2)), "inte centrerad").toBeLessThanOrEqual(0.5);
    expect(d.left - plus.right, "luften efter plus").toBe(8);
    expect(fit.left - d.right, "luften före visa hela").toBe(8);
  });

  test("ikonerna är ritade, inte tecken ur typsnittet", async () => {
    const editor = await editorAt(1400);
    const buttons = toolbarOf(nodeEditorOf(editor)).querySelectorAll<HTMLButtonElement>("button");

    expect(buttons).toHaveLength(4);
    for (const button of buttons) {
      const svg = button.querySelector("svg");
      expect(svg, button.dataset.action).not.toBeNull();
      expect(button.textContent?.trim(), `${button.dataset.action} bär ett tecken`).toBe("");
      const size = svg!.getBoundingClientRect();
      expect(size.width, button.dataset.action).toBeGreaterThanOrEqual(18);
      expect(size.width, button.dataset.action).toBeLessThanOrEqual(20);
    }
  });

  test("zoomnivån har ett sammanhang för skärmläsaren men är ingen levande region", async () => {
    const editor = await editorAt(1400);
    const toolbar = toolbarOf(nodeEditorOf(editor));
    const readout = toolbar.querySelector<HTMLElement>("[data-canvas-toolbar-zoom]")!;
    const cell = readout.parentElement!;

    expect(cell.textContent?.replace(/\s+/g, " ").trim()).toBe("Zoomnivå 100 %");
    expect(cell.closest("[aria-live]"), "zoomnivån läses upp vid varje steg").toBeNull();
    expect(readout.getAttribute("role")).toBeNull();
  });

  test("tangentbordsfokus visar knappens namn i en tooltip, blur och Escape döljer den", async () => {
    const { userEvent } = await import("vitest/browser");
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);
    const toolbar = toolbarOf(nodeEditor);
    const tooltip = toolbar.querySelector<HTMLElement>("[data-canvas-toolbar-tooltip]")!;
    const fit = toolbar.querySelector<HTMLButtonElement>('[data-action="canvas-fit"]')!;
    const fullscreen = toolbar.querySelector<HTMLButtonElement>('[data-action="canvas-fullscreen"]')!;

    expect(tooltip.hidden).toBe(true);

    // A real Tab, so the focus is :focus-visible (element.focus() is not always).
    toolbar.querySelector<HTMLButtonElement>('[data-action="canvas-zoom-in"]')!.focus();
    await userEvent.tab();
    expect(nodeEditor.shadowRoot!.activeElement).toBe(fit);
    expect(tooltip.hidden, "fokus visade ingen tooltip").toBe(false);
    expect(tooltip.textContent).toBe(fit.getAttribute("aria-label"));

    // The tooltip stands over the button it names, inside the bar's width.
    const t = tooltip.getBoundingClientRect();
    const b = fit.getBoundingClientRect();
    const bar = toolbar.getBoundingClientRect();
    expect(t.bottom).toBeLessThanOrEqual(bar.top);
    expect(t.left).toBeGreaterThanOrEqual(bar.left);
    expect(t.right).toBeLessThanOrEqual(bar.right);
    expect(t.left).toBeLessThan(b.right);
    expect(t.right).toBeGreaterThan(b.left);

    await userEvent.tab();
    expect(nodeEditor.shadowRoot!.activeElement).toBe(fullscreen);
    expect(tooltip.textContent).toBe("Helskärm");

    nodeEditor.setFullscreen(true);
    expect(tooltip.textContent, "tooltipen följer inte det bytta namnet").toBe("Avsluta helskärm");

    await userEvent.keyboard("{Escape}");
    expect(tooltip.hidden, "Escape döljer inte tooltipen").toBe(true);
    expect(nodeEditor.shadowRoot!.activeElement, "Escape flyttade fokus").toBe(fullscreen);
  });

  /*
   * Astra, uppdraget bilaga 8 punkt 2 (WCAG 1.4.13, hoverable): ett tooltip
   * som döljs när pekaren lämnar KNAPPEN kan aldrig nås av en pekare på väg
   * mot det — tooltipen står utanför knappens egen ruta (`bottom: 100%`).
   * Flow-nodens kopia av det här mönstret (E10, bilaga 5) saknade just de
   * här två raderna och doldes efter 200 ms även med pekaren vilande i sin
   * egen ruta (Siv, 1/10, mätt med riktig mus). Samma prövning här, som
   * regression: den här rutans `tooltip.addEventListener("pointerenter"…)`
   * fanns redan och höll, men inget prov sa det förrän nu.
   */
  test("pekaren i tooltipens egen ruta håller den kvar (WCAG 1.4.13)", async () => {
    const editor = await editorAt(1400);
    const nodeEditor = nodeEditorOf(editor);
    const toolbar = toolbarOf(nodeEditor);
    const tooltip = toolbar.querySelector<HTMLElement>("[data-canvas-toolbar-tooltip]")!;
    const zoomOut = toolbar.querySelector<HTMLButtonElement>('[data-action="canvas-zoom-out"]')!;

    zoomOut.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    await settle();
    expect(tooltip.hidden, "synlig efter hover på knappen").toBe(false);

    zoomOut.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    tooltip.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    await settle(300);

    expect(tooltip.hidden, "ska ligga kvar när pekaren står i tooltipens egen ruta").toBe(false);

    tooltip.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    await settle(300);
    expect(tooltip.hidden, "döljs när pekaren till slut lämnar tooltipen också").toBe(true);
  });
});

/*
 * Astra 29/9, svar på uppdragets öppna RTL-fråga: "behåll placeringen tills
 * vidare. Geografiska kontroller för en flödesyta måste inte automatiskt
 * speglas." Hörnet är alltså ett medvetet val, inte en lucka — CSS-reglerna
 * i node-editor.scss (`right:`, inte `inset-inline-end:`) håller fältet och
 * minikartan i samma fysiska hörn oavsett `dir`. Det här provet är räcket:
 * det mäter att hörnet står kvar (samma siffror som "platsen"-provet ovan,
 * nu med dir="rtl" på editorn), och att det som *ska* följa läsriktningen —
 * tabbordning, fokus, den talade texten — gör det.
 */
describe("höger-till-vänster (Astra 29/9)", () => {
  // The canvas as its controls see it: the view less what an open panel
  // covers (story 145). Without a panel over it, it is the whole view.
  const canvasOf = (nodeEditor: NodeEditor) =>
    nodeEditor.shadowRoot!.querySelector<HTMLElement>(".node-editor__controls")!.getBoundingClientRect();
  const mapOf = (nodeEditor: NodeEditor) =>
    nodeEditor.shadowRoot!.querySelector<HTMLElement>(".node-editor__minimap")!;

  /** Tabbordning, tooltip och procentcellen — samma mätning oavsett bredd. */
  async function assertReadingOrderAndSpeech(nodeEditor: NodeEditor, canvas: DOMRect): Promise<void> {
    const toolbar = toolbarOf(nodeEditor);
    const { userEvent } = await import("vitest/browser");
    const buttons = [...toolbar.querySelectorAll<HTMLButtonElement>("button")];

    expect(buttons.map((button) => button.dataset.action), "knapparnas DOM-ordning").toEqual([
      "canvas-zoom-out",
      "canvas-zoom-in",
      "canvas-fit",
      "canvas-fullscreen",
    ]);

    buttons[0].focus();
    expect(nodeEditor.shadowRoot!.activeElement, "minus fick inte fokus").toBe(buttons[0]);
    for (let index = 1; index < buttons.length; index += 1) {
      await userEvent.tab();
      expect(
        nodeEditor.shadowRoot!.activeElement,
        `tabb ${index} hamnade inte på ${buttons[index].dataset.action}`,
      ).toBe(buttons[index]);
    }

    // Tooltipen visas vid fokus och håller sig innanför canvasens fysiska
    // kant, som i LTR (`offsetLeft`/`clientWidth` är oberoende av `dir`).
    const tooltip = toolbar.querySelector<HTMLElement>("[data-canvas-toolbar-tooltip]")!;
    expect(tooltip.hidden, "tooltipen visades inte vid fokus (helskärm hade sist fokus)").toBe(false);
    expect(tooltip.textContent, "tooltipen bär inte knappens namn").toBe(
      buttons[buttons.length - 1].getAttribute("aria-label"),
    );
    const tooltipRect = tooltip.getBoundingClientRect();
    expect(tooltipRect.left, "tooltipen klipps av canvasens vänsterkant").toBeGreaterThanOrEqual(
      canvas.left,
    );
    expect(tooltipRect.right, "tooltipen klipps av canvasens högerkant").toBeLessThanOrEqual(
      canvas.right,
    );

    expect(
      toolbar.querySelector<HTMLElement>("[data-canvas-toolbar-zoom]")!.textContent,
      "procentcellen",
    ).toBe("100 %");
  }

  test("sida vid sida, ≥ 660 px canvas: samma hörn som LTR (16 px till minikartan, nederkanterna i linje)", async () => {
    const editor = await editorAt(1400, "rtl");
    const nodeEditor = nodeEditorOf(editor);
    const minimap = mapOf(nodeEditor);

    expect(getComputedStyle(nodeEditor).direction, 'dir="rtl" nådde inte canvasen').toBe("rtl");
    expect(minimap.hidden, "minikartan visades aldrig — provet mäter inget").toBe(false);

    const c = canvasOf(nodeEditor);
    const m = minimap.getBoundingClientRect();
    const t = toolbarOf(nodeEditor).getBoundingClientRect();

    // Samma siffror som "bred canvas"-provet i "platsen"-describen ovan.
    expect(m.left - t.right, "luften till minikartan").toBeCloseTo(16, 0);
    expect(t.bottom, "nederkanterna står inte i linje").toBeCloseTo(m.bottom, 0);
    expect(c.right - m.right, "kartans luft till kanten").toBeCloseTo(16, 0);
    expect(c.bottom - m.bottom, "luften till underkanten").toBeCloseTo(16, 0);

    await assertReadingOrderAndSpeech(nodeEditor, c);
  });

  test("staplat, < 660 px canvas: samma hörn som LTR (12 px ovanför fältet, samma högerkant)", async () => {
    const editor = await editorAt(1000, "rtl");
    const nodeEditor = nodeEditorOf(editor);
    const minimap = mapOf(nodeEditor);
    const c = canvasOf(nodeEditor);

    expect(getComputedStyle(nodeEditor).direction, 'dir="rtl" nådde inte canvasen').toBe("rtl");
    expect(c.width, "canvasen är inte i det staplade intervallet").toBeLessThan(660);
    expect(minimap.hidden, "minikartan visades aldrig — provet mäter inget").toBe(false);

    const m = minimap.getBoundingClientRect();
    const t = toolbarOf(nodeEditor).getBoundingClientRect();

    // Samma siffror som "smal canvas"-provet i "platsen"-describen ovan.
    expect(t.top - m.bottom, "luften mellan kartan och fältet").toBeCloseTo(12, 0);
    expect(t.right, "fältet och kartan delar inte högerkant").toBeCloseTo(m.right, 0);
    expect(c.bottom - t.bottom, "fältet har inte hörnet").toBeCloseTo(16, 0);

    await assertReadingOrderAndSpeech(nodeEditor, c);

    // 1000 px editor ryms inom testfönstret (1280, vitest.config.ts) — till
    // skillnad från det breda provets 1400, som gör det med flit och aldrig
    // mätte det här i LTR heller. Här är måttet meningsfullt: RTL-omkopplingen
    // fick inget att sticka ut i sidled.
    expect(
      document.documentElement.scrollWidth,
      "sidan rullar i sidled i rtl",
    ).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });
});

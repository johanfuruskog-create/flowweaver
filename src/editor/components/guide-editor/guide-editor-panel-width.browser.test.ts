import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { kontrast, tillRgba } from "../../../testing/contrast";

import type { GuideEditor } from "./guide-editor";

/**
 * Story 141: the side panel's width, dragged by the editor.
 *
 * The editor is sized by the test, not by the window. Since story 145 the panel
 * lies over the canvas, and its ceiling is the room it lies over — the canvas
 * and the rail — less 200 (see `controllers/panel-resize.ts`); `ceilingOf`
 * measures that room, so the rule is what is asserted, not a number that
 * follows from today's palette width. Until 7/10 the ceiling was the editor's
 * width less 620 and these tests said 980 at 1600. Every editor here opens
 * with the panel open: the handle is the open panel's.
 *
 * Pointer drags here are synthetic `PointerEvent`s — enough for the arithmetic
 * and the event count. The one thing only a real pointer shows, that a drag
 * leaves the focus where it was, uses Playwright's mouse via `dragAndDrop`.
 *
 * What this does not hold: the site remembering the width (that is the site's,
 * `src/site/panel-persistence.browser.test.ts`) and the storage rule K6e
 * (the `smoke:lib` gate reads the bundles for it).
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A token resolved to a colour through the editor's own scope. */
function resolve(editor: GuideEditor, token: string): ReturnType<typeof tillRgba> {
  const probe = document.createElement("div");

  probe.style.background = `var(${token})`;
  editor.shadowRoot!.append(probe);
  const colour = tillRgba(getComputedStyle(probe).backgroundColor);

  probe.remove();
  return colour;
}

/** The pointer on a neutral patch, so nothing under test is hovered. */
async function parkPointer(): Promise<void> {
  const { userEvent } = await import("@vitest/browser/context");
  const spot = document.createElement("div");

  spot.style.cssText = "position: fixed; top: 0; left: 0; width: 8px; height: 8px; z-index: 2147483647;";
  document.body.append(spot);
  await userEvent.hover(spot);
  spot.remove();
}

async function editorOf(width: number, attrs: Record<string, string> = {}): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("panel-open", "");
  for (const [name, value] of Object.entries(attrs)) editor.setAttribute(name, value);
  editor.style.cssText = `display: block; width: ${width}px; height: 700px;`;
  document.body.append(editor);
  editor.graph = {
    version: 8,
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 40, y: 40 }, data: { title: "Ett", variableName: "a" } },
    ],
    connections: [],
  } as never;
  await settle();
  await settle();

  return editor;
}

const handleOf = (editor: GuideEditor): HTMLElement =>
  editor.shadowRoot!.querySelector<HTMLElement>("[data-panel-resize]")!;

/*
 * Our own col-resize, drawn (src/editor/styles/_cursors.scss): Windows drew the
 * system's entirely white on Johan's machine (30/9). The image comes first and
 * the keyword stays last, for a browser that will not draw the image.
 */
function expectDrawnColResize(cursor: string, where: string): void {
  expect(cursor.startsWith('url("data:image/svg+xml'), `${where}: ${cursor.slice(0, 40)}`).toBe(true);
  expect(cursor.endsWith("col-resize"), `${where}: fallback kvar`).toBe(true);
}

const panelWidth = (editor: GuideEditor): number =>
  Math.round(
    editor.shadowRoot!.querySelector<HTMLElement>(".guide-editor__sidebar")!.getBoundingClientRect().width
  );

/** Story 145's ceiling: the room the panel lies over, canvas and rail, less 200. */
const ceilingOf = (editor: GuideEditor): number => {
  const root = editor.shadowRoot!;
  const room =
    root.querySelector<HTMLElement>(".guide-editor__canvas")!.getBoundingClientRect().width +
    root.querySelector<HTMLElement>("[data-panel-rail]")!.getBoundingClientRect().width;

  return Math.max(380, Math.floor(room - 200));
};

const aria = (editor: GuideEditor): number[] =>
  ["aria-valuemin", "aria-valuenow", "aria-valuemax"].map((name) =>
    Number(handleOf(editor).getAttribute(name))
  );

/** Every `panel-width-changed` the editor sends, in order. */
function recordChanges(editor: GuideEditor): Array<number | null> {
  const seen: Array<number | null> = [];

  editor.addEventListener("panel-width-changed", (event) => {
    seen.push((event as CustomEvent<{ width: number | null }>).detail.width);
  });

  return seen;
}

/** A synthetic drag of the edge by `dx` px, in `steps` moves. */
function drag(editor: GuideEditor, dx: number, steps = 10): void {
  const handle = handleOf(editor);
  const box = handle.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const fire = (type: string, clientX: number): void => {
    handle.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        composed: true,
        cancelable: true,
        pointerId: 7,
        pointerType: "mouse",
        button: 0,
        clientX,
        clientY: y,
      })
    );
  };

  fire("pointerdown", x);
  for (let step = 1; step <= steps; step += 1) fire("pointermove", x + (dx * step) / steps);
  fire("pointerup", x + dx);
}

describe("handtaget (berättelse 141, punkt 1 och 3)", () => {
  test("är en vertikal avskiljare med namn, värden och 44 px träffyta", async () => {
    const editor = await editorOf(1600);
    const handle = handleOf(editor);
    const box = handle.getBoundingClientRect();
    const panel = editor.shadowRoot!.querySelector(".guide-editor__sidebar")!.getBoundingClientRect();

    expect(handle.getAttribute("role")).toBe("separator");
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("aria-label")).toBe("Panelens bredd");
    expect(handle.tabIndex).toBe(0);
    expect(box.width).toBeGreaterThanOrEqual(44);
    // Straddles the edge: some of it over the canvas, the rest over the panel.
    expect(box.left).toBeLessThan(panel.left);
    expect(box.right).toBeGreaterThan(panel.left);
    expectDrawnColResize(getComputedStyle(handle).cursor, "handtaget");
    expect(aria(editor)).toEqual([380, 440, ceilingOf(editor)]);
  });

  test("namnet följer editorns språk", async () => {
    const editor = await editorOf(1600, { "editor-locale": "en" });

    expect(handleOf(editor).getAttribute("aria-label")).toBe("Panel width");
  });

  /*
   * Johan 29/9, after a Dribbble sweep: no grip. At rest the edge is the
   * panel's ordinary border; hover, keyboard focus and a drag light it.
   */
  test("i vila ritar handtaget ingenting — kanten är panelens vanliga", async () => {
    for (const theme of ["light", "dark"]) {
      const editor = await editorOf(1600, { theme });
      const handle = handleOf(editor);

      await parkPointer();
      expect(handle.matches(":hover"), `${theme}: pekaren är inte över`).toBe(false);
      expect(tillRgba(getComputedStyle(handle).backgroundColor)[3], `${theme}: handtaget`).toBe(0);
      for (const part of ["::before", "::after"]) {
        const style = getComputedStyle(handle, part);
        const drawn = style.content !== "none" && tillRgba(style.backgroundColor)[3] > 0;

        expect(drawn, `${theme}: ${part} ritas i vila`).toBe(false);
      }

      document.body.replaceChildren();
    }
  });

  test("hover, tangentbordsfokus och drag tänder kanten i --fw-primary, 3:1 mot båda ytorna", async () => {
    const { userEvent } = await import("@vitest/browser/context");

    for (const theme of ["light", "dark"]) {
      const editor = await editorOf(1600, { theme });
      const handle = handleOf(editor);
      const [primary, surface, canvas] = ["--fw-primary", "--fw-surface", "--fw-canvas"].map((token) =>
        resolve(editor, token)
      );
      const line = (): ReturnType<typeof tillRgba> =>
        tillRgba(getComputedStyle(handle, "::before").backgroundColor);
      const lit = (state: string): void => {
        expect(line(), `${theme}, ${state}: kanten tänd i --fw-primary`).toEqual(primary);
        expect(kontrast(line(), surface), `${theme}, ${state}: mot panelen`).toBeGreaterThanOrEqual(3);
        expect(kontrast(line(), canvas), `${theme}, ${state}: mot canvasen`).toBeGreaterThanOrEqual(3);
      };

      expect(primary[3], `${theme}: tokenet har färg`).toBeGreaterThan(0);

      await userEvent.hover(handle);
      expect(handle.matches(":hover")).toBe(true);
      lit("hover");
      await parkPointer();

      handle.focus({ focusVisible: true } as FocusOptions);
      expect(handle.matches(":focus-visible"), `${theme}: fokus syns`).toBe(true);
      lit("fokus");
      expect(getComputedStyle(handle, "::before").outlineStyle, `${theme}: fokusringen`).toBe("solid");
      handle.blur();

      const box = handle.getBoundingClientRect();
      const at = { bubbles: true, composed: true, cancelable: true, pointerId: 3, button: 0, clientX: box.left + 22, clientY: box.top + 40 };

      handle.dispatchEvent(new PointerEvent("pointerdown", at));
      lit("drag");
      handle.dispatchEvent(new PointerEvent("pointerup", at));

      document.body.replaceChildren();
    }
  });
});

describe("handtaget står åt sidan medan en meny är öppen (punkt 1, mätt 29/9)", () => {
  /*
   * Gap Per fann 29/9: sviten testade aldrig `menuHolder`/`is-standing-aside`
   * (`controllers/panel-resize.ts`), trots att LOGG 29/9 nämner
   * `editor-toolbar-menu-inside` som en manuellt uppmätt regression ("Visa som
   * lista" träffade handtaget vid 900 × 600). Ett grönt svit-test hade aldrig
   * sett den regressionen falla. Detta test gör det: klicka en menytrigger i
   * `editor-toolbar`s skuggrot (vilket sätter `data-menu-open` via
   * `keepInside`), och kontrollera att handtaget slutar svara på pekaren.
   */
  const trigger = (editor: GuideEditor): HTMLButtonElement =>
    editor.shadowRoot!
      .querySelector("editor-toolbar")!
      .shadowRoot!.querySelector<HTMLButtonElement>('[data-menu-trigger="view"]')!;

  test("en öppen meny stänger av handtaget, stängd meny slår på det igen", async () => {
    const editor = await editorOf(1600);
    const handle = handleOf(editor);
    const open = trigger(editor);

    expect(handle.classList.contains("is-standing-aside")).toBe(false);
    expect(getComputedStyle(handle).pointerEvents).not.toBe("none");

    open.click();
    await settle(50);

    expect(handle.classList.contains("is-standing-aside"), "menyn är öppen").toBe(true);
    expect(getComputedStyle(handle).pointerEvents).toBe("none");

    open.click();
    await settle(50);

    expect(handle.classList.contains("is-standing-aside"), "menyn stängdes").toBe(false);
    expect(getComputedStyle(handle).pointerEvents).not.toBe("none");
  });
});

describe("dragning med pekare (punkt 2 och 4)", () => {
  test("bredden följer pekaren och händelsen kommer en gång per drag", async () => {
    const editor = await editorOf(1600);
    const seen = recordChanges(editor);

    drag(editor, -200);
    await settle(50);

    expect(panelWidth(editor)).toBe(640);
    expect(aria(editor)[1]).toBe(640);
    expect(seen).toEqual([640]);
    expect(editor.panelWidth).toBe(640);
    expect(editor.getAttribute("panel-width")).toBe("640");
  });

  test("taket är ytan panelen ligger över minus 200, och golvet 380 (berättelse 145)", async () => {
    const editor = await editorOf(1600);
    const seen = recordChanges(editor);

    drag(editor, -2000);
    await settle(50);
    expect(panelWidth(editor)).toBe(ceilingOf(editor));

    drag(editor, 2000);
    await settle(50);
    expect(panelWidth(editor)).toBe(380);
    expect(seen).toEqual([ceilingOf(editor), 380]);
  });

  test("en editor för smal för både golv och canvas får golvet, och draget ändrar ingenting", async () => {
    const editor = await editorOf(600);
    const seen = recordChanges(editor);

    expect(aria(editor)).toEqual([380, 380, 380]);
    drag(editor, -300);
    await settle(50);

    expect(panelWidth(editor)).toBe(380);
    expect(seen).toEqual([]);
  });

  test("ett tryck utan rörelse är ingen ändring", async () => {
    const editor = await editorOf(1600);
    const seen = recordChanges(editor);

    drag(editor, 0, 1);
    await settle(50);

    expect(seen).toEqual([]);
    expect(editor.hasAttribute("panel-width")).toBe(false);
  });
});

describe("tangentbordet (punkt 3)", () => {
  test("pilar 16, Shift 64, Home golvet, End taket — varje tryck skickar", async () => {
    const editor = await editorOf(1600);
    const handle = handleOf(editor);
    const seen = recordChanges(editor);
    const press = (key: string, shiftKey = false): void => {
      handle.dispatchEvent(
        new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, composed: true, cancelable: true })
      );
    };

    press("ArrowLeft");
    expect(panelWidth(editor)).toBe(456);
    press("ArrowRight", true);
    expect(panelWidth(editor)).toBe(392);
    press("Home");
    expect(panelWidth(editor)).toBe(380);
    press("End");
    expect(panelWidth(editor)).toBe(ceilingOf(editor));
    expect(aria(editor)[1]).toBe(ceilingOf(editor));
    expect(seen).toEqual([456, 392, 380, ceilingOf(editor)]);
  });

  test("tangenterna stannar hos handtaget", async () => {
    const editor = await editorOf(1600);
    let reached = 0;

    editor.addEventListener("keydown", () => (reached += 1));
    handleOf(editor).dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, composed: true, cancelable: true })
    );

    expect(reached).toBe(0);
  });
});

describe("återställning (punkt 6)", () => {
  for (const [how, act] of [
    ["Enter", (h: HTMLElement) => h.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))],
    ["dubbelklick", (h: HTMLElement) => h.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))],
  ] as const) {
    test(`${how} återställer till standardbredden och skickar null`, async () => {
      const editor = await editorOf(1600, { "panel-width": "700" });
      const seen = recordChanges(editor);

      expect(panelWidth(editor)).toBe(700);
      act(handleOf(editor));
      await settle(50);

      expect(panelWidth(editor)).toBe(440);
      expect(editor.hasAttribute("panel-width")).toBe(false);
      expect(editor.panelWidth).toBeNull();
      expect(seen).toEqual([null]);
    });
  }
});

describe("attributet och egenskapen (punkt 5)", () => {
  test("panel-width sätter bredden, och taket håller även för ett för stort värde", async () => {
    const editor = await editorOf(1600, { "panel-width": "600" });

    expect(panelWidth(editor)).toBe(600);
    expect(editor.panelWidth).toBe(600);

    editor.setAttribute("panel-width", "5000");
    await settle(50);
    expect(panelWidth(editor)).toBe(ceilingOf(editor));
    expect(aria(editor)[1]).toBe(ceilingOf(editor));
  });

  test("egenskapen speglas i attributet, null tar bort det", async () => {
    const editor = await editorOf(1600);

    editor.panelWidth = 520;
    await settle(50);
    expect(editor.getAttribute("panel-width")).toBe("520");
    expect(panelWidth(editor)).toBe(520);

    editor.panelWidth = null;
    await settle(50);
    expect(editor.hasAttribute("panel-width")).toBe(false);
    expect(panelWidth(editor)).toBe(440);
  });

  test("ett smalare fönster efter draget flödar om inom räckena", async () => {
    const editor = await editorOf(1600, { "panel-width": "900" });

    editor.style.width = "1000px";
    await settle(100);

    const ceiling = ceilingOf(editor);

    expect(ceiling, "provet måste krympa taket under det valda").toBeLessThan(900);
    expect(panelWidth(editor)).toBe(ceiling);
    expect(aria(editor)).toEqual([380, ceiling, ceiling]);
  });

  test("en egenskap satt före uppgraderingen går inte förlorad", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor & { panelWidth: number };

    // Created by a host that set the property before the element was defined —
    // simulated by an own property that shadows the prototype's setter.
    Object.defineProperty(editor, "panelWidth", { value: 610, writable: true, configurable: true, enumerable: true });
    editor.setAttribute("mode", "administrator");
    editor.setAttribute("panel-open", "");
    editor.style.cssText = "display: block; width: 1600px; height: 700px;";
    document.body.append(editor);
    await settle();

    expect(panelWidth(editor)).toBe(610);
  });
});

describe("inget hoppar (punkt 7)", () => {
  test("en riktig dragning lämnar fokus i fältet och skickar en gång", async () => {
    const { userEvent } = await import("@vitest/browser/context");
    const editor = await editorOf(1600);
    const seen = recordChanges(editor);

    (
      editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById?(id: string): void }
    ).selectNodeById?.("q1");
    await settle();

    const field = (function find(root: ParentNode): HTMLInputElement | null {
      for (const element of root.querySelectorAll<HTMLElement>("*")) {
        if (
          element instanceof HTMLInputElement &&
          element.type === "text" &&
          element.matches("[data-property]") &&
          element.getClientRects().length > 0
        ) {
          return element;
        }
        const inner = element.shadowRoot && find(element.shadowRoot);
        if (inner) return inner;
      }
      return null;
    })(editor.shadowRoot!);

    expect(field, "panelen har ett textfält").toBeTruthy();
    field!.focus();
    const focused = (): Element | null => {
      let active: Element | null = document.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      return active;
    };
    expect(focused()).toBe(field);

    const box = handleOf(editor).getBoundingClientRect();
    const target = document.createElement("div");

    target.style.cssText = `position: fixed; left: ${box.left + 22 - 150 - 5}px; top: ${box.top + box.height / 2 - 5}px; width: 10px; height: 10px; z-index: 2147483647;`;
    document.body.append(target);
    await userEvent.dragAndDrop(handleOf(editor), target);
    await settle(50);

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeGreaterThan(560);
    expect(focused()).toBe(field);
  });
});

/** The element under a point, through every shadow root on the way down. */
function deepElementFromPoint(x: number, y: number): Element | null {
  let element = document.elementFromPoint(x, y);

  while (element?.shadowRoot) {
    const inner = element.shadowRoot.elementFromPoint(x, y);

    if (!inner || inner === element) break;
    element = inner;
  }
  return element;
}

describe("pekaren under ett drag (Johan 29/9)", () => {
  test("över canvasen och över panelens fält är pekaren col-resize medan draget pågår, inte det som ligger under", async () => {
    // Johan: "med cursorn ska skifta när man drar i höger panel blir den
    // ibland helvit och ser osynlig ut" — the pointer wandering over a
    // node (`cursor: move`) or a button (`pointer`, a white hand on
    // Windows) took that element's cursor, because a class on the frame
    // cannot reach into node-editor's or the panel's shadow roots.
    const editor = await editorOf(1400);
    const handle = handleOf(editor);
    const box = handle.getBoundingClientRect();
    const y = box.top + box.height / 2;
    const fire = (type: string, clientX: number): void => {
      handle.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, cancelable: true, pointerId: 9, pointerType: "mouse", button: 0, clientX, clientY: y }));
    };
    const canvas = editor.shadowRoot!.querySelector("node-editor")!.getBoundingClientRect();
    const panelField = editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!.querySelector<HTMLElement>("input, textarea, select")!;
    const field = panelField.getBoundingClientRect();
    const canvasPoint: [number, number] = [canvas.left + canvas.width * 0.4, canvas.top + canvas.height * 0.6];
    const fieldPoint: [number, number] = [field.left + field.width / 2, field.top + field.height / 2];

    fire("pointerdown", box.left + box.width / 2);
    fire("pointermove", box.left - 40);
    await settle(50);
    const overCanvas = getComputedStyle(deepElementFromPoint(...canvasPoint)!).cursor;
    const overField = getComputedStyle(deepElementFromPoint(...fieldPoint)!).cursor;

    fire("pointerup", box.left - 40);
    await settle(50);

    expectDrawnColResize(overCanvas, "över canvasen under draget");
    expectDrawnColResize(overField, "över panelens fält under draget");
    expect(getComputedStyle(deepElementFromPoint(...fieldPoint)!).cursor, "efter draget: fältets egen").not.toMatch(/col-resize$/);
  });

  test("handtaget, skölden och ramen under draget bär den egna markören, med nyckelordet som reserv (Johan 30/9)", async () => {
    const editor = await editorOf(1400);
    const handle = handleOf(editor);
    const box = handle.getBoundingClientRect();
    const y = box.top + box.height / 2;
    const fire = (type: string, clientX: number): void => {
      handle.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, cancelable: true, pointerId: 9, pointerType: "mouse", button: 0, clientX, clientY: y }));
    };

    expectDrawnColResize(getComputedStyle(handle).cursor, "handtaget");
    fire("pointerdown", box.left + box.width / 2);
    fire("pointermove", box.left - 40);
    await settle(50);
    const frame = editor.shadowRoot!.querySelector<HTMLElement>(".guide-editor.is-resizing-panel")!;
    const shield = editor.shadowRoot!.querySelector<HTMLElement>(".guide-editor__resize-shield")!;
    const frameCursor = getComputedStyle(frame).cursor;
    const shieldCursor = getComputedStyle(shield).cursor;
    fire("pointerup", box.left - 40);
    await settle(50);

    expectDrawnColResize(frameCursor, "ramen under draget");
    expectDrawnColResize(shieldCursor, "skölden");
  });
});

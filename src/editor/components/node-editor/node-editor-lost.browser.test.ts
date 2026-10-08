import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";
import { scrollSettled } from "../../../testing/scroll-settled";

/**
 * A way back when the guide has left the screen.
 *
 * ## Why this rather than bounding the pan
 *
 * Panning past the guide is deliberate — it is how somebody makes room to place
 * a node — and bounding it was tried and reverted, because it took the test
 * "keeps the nodes in view when panning expands the canvas" with it. The cost of
 * leaving it open is that a canvas can be panned until nothing is on it, and
 * then it does not look empty, it looks broken.
 *
 * Measured on a tablet: the guide sat about a hundred pixels above the top of
 * the view, with a blank canvas below and nothing to say which way to go. The
 * minimap is a way back and a poor one under a finger — small, passive, easy to
 * read as decoration.
 *
 * ## What must be true
 *
 * That it is only there when it is true, and that it actually returns.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function canvas(
  nodes = 3,
  placed: (index: number) => { x: number; y: number } = (index) => ({ x: index * 260, y: 0 }),
): Promise<{ nodeEditor: NodeEditor; viewport: HTMLElement }> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 900px; height: 600px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "n0",
    nodes: Array.from({ length: nodes }, (_, index) => ({
      id: `n${index}`,
      type: "text-question",
      position: placed(index),
      data: { title: `Nod ${index}`, variableName: `v${index}` },
    })),
    connections: [],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  const viewport = nodeEditor?.shadowRoot?.querySelector<HTMLElement>(
    ".node-editor__viewport",
  );

  if (!nodeEditor || !viewport) throw new Error("node-editor saknas.");

  return { nodeEditor, viewport };
}

const lost = (nodeEditor: NodeEditor): HTMLButtonElement =>
  nodeEditor.shadowRoot!.querySelector<HTMLButtonElement>("[data-lost]")!;

const onScreen = (nodeEditor: NodeEditor, viewport: HTMLElement): number => {
  const view = viewport.getBoundingClientRect();

  return [...nodeEditor.shadowRoot!.querySelectorAll<HTMLElement>("flow-node")].filter(
    (node) => {
      const rect = node.getBoundingClientRect();

      return (
        rect.right > view.left &&
        rect.left < view.right &&
        rect.bottom > view.top &&
        rect.top < view.bottom
      );
    },
  ).length;
};

/**
 * Panning the way a finger does, ending in a flick that leaves momentum behind.
 *
 * `scrollTop += n` is not the same gesture. It changes the scroll and stops,
 * where a real pan hands over to a glide that keeps running after the finger has
 * gone — and that difference is the whole of the fault below.
 */
async function flickFarAway(viewport: HTMLElement): Promise<void> {
  viewport.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true, pointerId: 7, pointerType: "touch", clientX: 400, clientY: 700,
    }),
  );

  for (let step = 1; step <= 10; step += 1) {
    viewport.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true, pointerId: 7, pointerType: "touch",
        clientX: 400, clientY: 700 - step * 70,
      }),
    );

    /*
     * One frame apart, not sixty milliseconds. The glide only starts above 0.35
     * px/ms and decays from there, so a leisurely drag leaves nothing running by
     * the time the button is pressed — which is how the first version of this
     * test passed with the fix deliberately removed.
     */
    await settle(16);
  }

  viewport.dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, pointerId: 7, pointerType: "touch" }),
  );
}

async function panFarAway(
  viewport: HTMLElement,
  nodeEditor: NodeEditor,
): Promise<void> {
  /*
   * Skrolla NEDÅT tills guiden faktiskt är borta, i stället för 2000 px.
   *
   * Ett fast tal förutsätter en viss nodhöjd: när fälten fick sina etiketter
   * (story 055) växte korten och guiden hann inte lämna rutan — testet föll på
   * en ändring som inte hade med bortpanorering att göra. Arbetsytan växer
   * dessutom medan man skrollar, så "ända ner" är ett rörligt mål.
   *
   * Riktningen är kvar med flit. Panorerar man i SIDLED byter en annan nod
   * plats som närmast mitten, och räddningsknappen centrerar då den — 260 px
   * fel, mätt när jag provade.
   */
  for (let försök = 0; försök < 20 && onScreen(nodeEditor, viewport) > 0; försök += 1) {
    viewport.scrollTop += 800;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await settle();
  }
}

describe("while the guide is on screen", () => {
  test("there is nothing offering to take you back", async () => {
    const { nodeEditor } = await canvas();

    expect(lost(nodeEditor).hidden).toBe(true);
  });
});

describe("in the empty space between two nodes far apart", () => {
  /*
   * Lost means outside the guide, not "no node in view". Johan, 1/9: two nodes
   * a long way apart, the view panned into the gap between them — and the way
   * back appeared in the middle of the guide. The hull around every node is
   * what the view must have left, not the nearest card.
   */
  test("nothing offers to take you back", async () => {
    const { nodeEditor, viewport } = await canvas(2, (index) => ({ x: 0, y: index * 3000 }));

    viewport.scrollTop = 1200;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await settle();
    await settle();

    expect(onScreen(nodeEditor, viewport), "en nod syns — mellanrummet är inte tomt").toBe(0);
    expect(lost(nodeEditor).hidden).toBe(true);
  });
});

describe("once it has left the screen", () => {
  test("the way back appears", async () => {
    const { nodeEditor, viewport } = await canvas();

    await panFarAway(viewport, nodeEditor);

    expect(onScreen(nodeEditor, viewport), "guiden syns fortfarande").toBe(0);
    expect(lost(nodeEditor).hidden).toBe(false);
  });

  test("and pressing it brings the guide back", async () => {
    const { nodeEditor, viewport } = await canvas();

    await panFarAway(viewport, nodeEditor);
    lost(nodeEditor).click();
    await settle();
    await scrollSettled(viewport);

    expect(onScreen(nodeEditor, viewport)).toBeGreaterThan(0);
    expect(lost(nodeEditor).hidden).toBe(true);
  });
});

describe("a guide with no nodes at all", () => {
  test("says its own thing instead", async () => {
    // The empty canvas has a message of its own, and two of them would be one
    // too many — "back to the guide" points at nothing.
    const { nodeEditor } = await canvas(0);

    expect(lost(nodeEditor).hidden).toBe(true);
  });
});

describe("pressing it while the canvas is still moving", () => {
  test("the guide stays back instead of being dragged off again", async () => {
    /*
     * Reported as "the back button does not work", and it looked exactly like
     * that: measured, all seven nodes were on screen the instant it was pressed
     * and none of them six hundred milliseconds later.
     *
     * A flick leaves a glide running, and the way back sits *outside* the
     * viewport — deliberately, so a finger reaching for it cannot pan the canvas
     * instead. Which meant the press never reached `handlePanDown`, the only
     * place that stopped the glide, and momentum nobody could see the source of
     * quietly undid the rescue.
     *
     * The test asserts the state a person actually judges it by: not the frame
     * of the press, but a moment later, once the glide would have had its say.
     */
    const { nodeEditor, viewport } = await canvas();

    for (let round = 0; round < 4; round += 1) {
      await flickFarAway(viewport);
      await settle(16);
    }

    expect(onScreen(nodeEditor, viewport), "guiden syns fortfarande").toBe(0);

    // Pressed while the glide is still running, which is what a finger does:
    // flick, see the button appear, reach for it. The way back is a ride
    // since 1/10 2026, so the first look is after the ride, not the frame of
    // the press — the point of the test is what the leftover momentum does
    // AFTER the guide is back.
    lost(nodeEditor).click();
    await settle(16);
    await scrollSettled(viewport);

    expect(onScreen(nodeEditor, viewport), "guiden kom aldrig tillbaka").toBeGreaterThan(0);

    // Long enough for whatever momentum was left to run its course.
    await settle(600);
    await scrollSettled(viewport);

    expect(onScreen(nodeEditor, viewport), "guiden drogs bort igen").toBeGreaterThan(0);
    expect(lost(nodeEditor).hidden).toBe(true);
  });
});

describe("where the way back takes you", () => {
  /*
   * The nearest node, centred, at whatever zoom is already set.
   *
   * Not the whole guide fitted: that clamps against ZOOM_MIN on a narrow canvas
   * and lands on a view where the guide sticks out both sides, unreadably small.
   * And not the start node either — somebody who has panned out into the empty
   * part of the canvas wants the guide back from where they are standing, not to
   * be thrown to the beginning of a long flow.
   *
   * It goes through `centerNodeById`, which is what the Guide menu's "Visa
   * startnod" uses and what worked on the tablet where this button did nothing.
   * That route tells the buffer where the view *wants* to be before assigning
   * the scroll; the fit assigned first and asked afterwards, so a target left of
   * the workspace clamped to zero, the buffer grew a step and compensated the
   * scroll by exactly that step, and the view stayed put.
   */
  test("the nearest node ends up in the middle, and the zoom is left alone", async () => {
    const { nodeEditor, viewport } = await canvas();
    const zoomBefore = nodeEditor.getZoom();

    await panFarAway(viewport, nodeEditor);
    lost(nodeEditor).click();
    await settle();
    await scrollSettled(viewport);

    const view = viewport.getBoundingClientRect();
    const offCentre = (node: HTMLElement): number => {
      const box = node.getBoundingClientRect();

      return Math.hypot(
        box.left + box.width / 2 - (view.left + view.width / 2),
        box.top + box.height / 2 - (view.top + view.height / 2),
      );
    };

    const distances = [...nodeEditor.shadowRoot!.querySelectorAll<HTMLElement>("flow-node")]
      .map(offCentre)
      .sort((a, b) => a - b);

    expect(distances[0], `närmsta noden ligger ${Math.round(distances[0])}px från mitten`)
      .toBeLessThan(4);
    expect(nodeEditor.getZoom(), "zoomen ändrades").toBe(zoomBefore);
  });

  test("and it is the node that was closest, not the first in the graph", async () => {
    /*
     * Worth its own assertion: centring on *a* node passes the test above
     * whichever one it picks, and picking the wrong one is the whole difference
     * between coming back to where you were working and being thrown across the
     * guide.
     */
    const { nodeEditor, viewport } = await canvas();

    const before = new Map(
      [...nodeEditor.shadowRoot!.querySelectorAll<HTMLElement>("flow-node")].map((node) => {
        const box = node.getBoundingClientRect();

        return [node, { x: box.left + box.width / 2, y: box.top + box.height / 2 }];
      }),
    );

    await panFarAway(viewport, nodeEditor);

    const view = viewport.getBoundingClientRect();
    const centre = { x: view.left + view.width / 2, y: view.top + view.height / 2 };
    const expected = [...before.entries()].reduce((best, entry) =>
      Math.hypot(entry[1].x - centre.x, entry[1].y - centre.y) <
      Math.hypot(best[1].x - centre.x, best[1].y - centre.y)
        ? entry
        : best,
    )[0];

    lost(nodeEditor).click();
    await settle();
    await scrollSettled(viewport);

    const landed = expected.getBoundingClientRect();
    const off = Math.hypot(
      landed.left + landed.width / 2 - centre.x,
      landed.top + landed.height / 2 - centre.y,
    );

    expect(off, `fel nod hamnade i mitten (${Math.round(off)}px fel)`).toBeLessThan(4);
  });
});

describe("ett vilse-svar mitt i en layoutförändring", () => {
  /*
   * Found on a tablet, English example page, by logging every call on the
   * built bundle: the last updateLostState ran while the page was still
   * settling — the viewport measured as its old 580x563 box while the nodes
   * had already moved to their final places outside it. "No node on screen"
   * was true for exactly one frame, the button showed, and nothing ever asked
   * again. It parked itself over the middle of a perfectly visible guide and
   * swallowed the finger that tried to drag the node beneath it.
   *
   * So showing waits one frame and is verified against settled geometry. A
   * verdict that only held mid-layout never reaches the screen; one that
   * holds still shows — the pan-away tests beside this one prove that half.
   */
  test("visar aldrig knappen för ett svar som inte står sig", async () => {
    const { nodeEditor, viewport } = await canvas();
    const original = viewport.getBoundingClientRect.bind(viewport);

    // The mid-layout moment, replayed: the view reports geometry that puts
    // every node outside it, for the duration of a single synchronous call.
    viewport.getBoundingClientRect = () =>
      ({ x: 5000, y: 5000, width: 580, height: 563, left: 5000, top: 5000, right: 5580, bottom: 5563 }) as DOMRect;
    (nodeEditor as unknown as { updateLostState(): void }).updateLostState();
    viewport.getBoundingClientRect = original;

    await settle();

    expect(lost(nodeEditor).hidden, "ett övergående svar nådde skärmen").toBe(true);
  });
});

describe("efter ett byte av editorspråk", () => {
  /*
   * Found on a tablet, sixth find of the day: on the English example page the
   * canvas could not be panned by finger at all. `set editorLocale` calls
   * `render()`, which rebuilds the shadow DOM — viewport included — but
   * `bindEvents()` only ever ran from `connectedCallback`. Everything bound to
   * the recreated viewport died with it: finger pan, pinch zoom, wheel zoom,
   * the scroll-driven trim and lost checks, the lost button's own click, and
   * the viewport's keyboard handling. The Swedish page never changes the
   * editor language, which is why the fault wore a language.
   */
  test("går canvasen fortfarande att panorera med fingret", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;

    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 900px; height: 600px;";
    document.body.append(editor);
    editor.graph = {
      startNodeId: "n0",
      nodes: [
        { id: "n0", type: "text-question", position: { x: 40, y: 40 }, data: { title: "Nod", variableName: "v" } },
      ],
      connections: [],
    } as never;

    await settle();
    editor.setAttribute("editor-locale", "en");
    await settle();
    await settle();

    const nodeEditor = editor.shadowRoot!.querySelector<NodeEditor>("node-editor")!;
    const viewport = nodeEditor.shadowRoot!.querySelector<HTMLElement>(".node-editor__viewport")!;
    const rect = viewport.getBoundingClientRect();
    const from = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const before = viewport.scrollLeft;

    const touch = (type: string, x: number, y: number) =>
      viewport.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: "touch",
          clientX: x,
          clientY: y,
          bubbles: true,
          composed: true,
        }),
      );

    touch("pointerdown", from.x, from.y);
    for (let step = 1; step <= 6; step += 1) {
      touch("pointermove", from.x - step * 20, from.y);
    }
    touch("pointerup", from.x - 120, from.y);
    await settle();

    expect(viewport.scrollLeft, "fingret drog men canvasen stod still").toBeGreaterThan(before);
  });
});

// The sending steps are FlowWeaver PRO's; this test uses them (open-core step 4).
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./node-editor";

import type { NodeEditor } from "./node-editor";
import type { GraphData } from "../../../viewer/types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
await withPro("index.ts");
const { claimExampleGraph } = ((await proModule("data/claim-example-graph.ts")) ?? {}) as { claimExampleGraph: GraphData };
const { movingExampleGraph } = ((await proModule("data/moving-example-graph.ts")) ?? {}) as { movingExampleGraph: GraphData };
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

afterEach(() => {
  document.body.replaceChildren();
});

/**
 * `count` questions in a row, with `spacing` base pixels between them. A small
 * spacing gives a graph that fits in the viewport; a large one gives a graph
 * that does not.
 */
function graf(antal: number, avstånd: number): GraphData {
  const nodes: GraphData["nodes"] = [];
  const connections: GraphData["connections"] = [];

  for (let i = 0; i < antal; i += 1) {
    nodes.push({
      id: `q${i}`,
      type: "question",
      position: { x: i * avstånd, y: i * avstånd },
      data: {
        title: `Fråga ${i}`,
        variableName: `v${i}`,
        options: [{ id: `q${i}-ja`, label: "Ja", value: "ja" }],
      },
    });

    if (i > 0) {
      connections.push({
        id: `c${i}`,
        from: { nodeId: `q${i - 1}`, portId: `q${i - 1}-ja` },
        to: { nodeId: `q${i}`, portId: "input" },
      });
    }
  }

  return { startNodeId: "q0", nodes, connections };
}

function montera(data: GraphData, höjd = 380): NodeEditor {
  const editor = document.createElement("node-editor") as NodeEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.editorMode = "administrator";
  editor.style.cssText = `display: block; width: 520px; height: ${höjd}px;`;
  document.body.append(editor);
  editor.graph = data;
  return editor;
}

function karta(editor: NodeEditor): HTMLElement {
  const element = editor.shadowRoot?.querySelector<HTMLElement>(
    ".node-editor__minimap",
  );

  if (!element) {
    throw new Error("Minikartan finns inte i editorn.");
  }

  return element;
}

function rutan(editor: NodeEditor): HTMLElement {
  const element = editor.shadowRoot?.querySelector<HTMLElement>(
    ".node-editor__minimap-viewport",
  );

  if (!element) {
    throw new Error("Viewportrutan finns inte i minikartan.");
  }

  return element;
}

function viewport(editor: NodeEditor): HTMLElement {
  const element = editor.shadowRoot?.querySelector<HTMLElement>(
    ".node-editor__viewport",
  );

  if (!element) {
    throw new Error("Viewporten finns inte i editorn.");
  }

  return element;
}

describe("minikarta", () => {
  // The map always obscures part of the workspace. A guide already visible in
  // its entirety has nothing to navigate, and then the map is only in the way.
  test("hidden when the whole graph is on screen", async () => {
    /*
     * "On screen", not "would fit". The rule used to ask whether the content
     * *could* fit in the viewport, which is true of any small guide however far
     * the view has wandered from it — so zooming out hid the map at exactly the
     * moment somebody was staring at a blank canvas with no way back.
     *
     * A bare `node-editor` does not centre itself on mount, so the view has to
     * be pointed at the guide first. That is not ceremony: before it is pointed
     * there, the guide really is off screen, and offering the map is right.
     */
    /*
     * A taller viewport than the rest of the file uses. Since story 064 every
     * node carries both views in one box and is as tall as the taller of them,
     * so two questions 20 px apart no longer fit inside 380 px — and the map
     * was right to show itself. The fixture's premise is "the whole guide is on
     * screen", and that is what the height restates.
     */
    const editor = montera(graf(2, 20), 900);

    editor.centerViewportAt({ x: 10, y: 10 });
    await new Promise<void>((resolve) => setTimeout(resolve, 60));

    expect(karta(editor).hidden).toBe(true);
  });

  test("but shown when the view has wandered off the guide", async () => {
    /*
     * The reported fault, from an iPad: zoom out far enough and the screen goes
     * blank *and* the map disappears with it. Getting back meant zooming in
     * until the map returned, pressing it, and only then seeing the nodes again.
     */
    const editor = montera(graf(2, 20));

    editor.centerViewportAt({ x: 10, y: 10 });
    await new Promise<void>((resolve) => setTimeout(resolve, 60));

    const viewport = editor.shadowRoot!.querySelector<HTMLElement>(
      ".node-editor__viewport",
    )!;

    viewport.scrollLeft += 1500;
    viewport.scrollTop += 1200;
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    await new Promise<void>((resolve) => setTimeout(resolve, 60));

    expect(karta(editor).hidden, "kartan gömde sig med grafen utanför vyn").toBe(
      false,
    );
  });

  test("shown when the graph is larger than the viewport", () => {
    const editor = montera(graf(8, 400));

    expect(karta(editor).hidden).toBe(false);
  });

  test("one dot per node, in the node family's colour", () => {
    const editor = montera(graf(8, 400));

    const prickar = [
      ...karta(editor).querySelectorAll<HTMLElement>(
        ".node-editor__minimap-node",
      ),
    ];

    expect(prickar).toHaveLength(8);
    expect(prickar.every((prick) => prick.dataset.nodeType === "question")).toBe(
      true,
    );
  });

  test("the dots follow when a node is moved", () => {
    const data = graf(8, 400);
    const editor = montera(data);

    /*
     * A node in the middle. The leftmost node's dot always stands the map's
     * air in from the frame — 12 px since Astra 29/9 — so moving *it* further
     * left moves its dot nowhere; this case passed before only because the air
     * was scaled with the map.
     */
    const fjärde = (): string | undefined =>
      karta(editor).querySelectorAll<HTMLElement>(".node-editor__minimap-node")[3]?.style.left;
    const before = fjärde();

    data.nodes[3].position = { x: 200, y: 1200 };
    editor.graph = { ...data };

    const efter = fjärde();

    expect(efter).not.toBe(before);
  });

  /*
   * The map must mirror the nodes' relative positions, not merely show that
   * nodes exist.
   *
   * The other cases test count, colour and that a dot *moved* — all of which
   * survive the coordinate conversion computing wrongly, because the map
   * normalises against the content's own bounds. Found by doubling x in
   * `toWorkspacePoint` and seeing that nothing failed.
   *
   * The ratio between the dots' dx and dy does not survive it: double only x and
   * the content becomes wider relative to its height, and the proportion between
   * the dots follows.
   */
  test("the dots' relative positions mirror the nodes'", () => {
    const data = graf(2, 400);
    // En diagonal: lika långt åt höger som nedåt.
    data.nodes[0].position = { x: 0, y: 0 };
    data.nodes[1].position = { x: 900, y: 900 };

    const editor = montera(data);
    const prickar = [
      ...karta(editor).querySelectorAll<HTMLElement>(".node-editor__minimap-node"),
    ].map((prick) => ({
      x: Number.parseFloat(prick.style.left),
      y: Number.parseFloat(prick.style.top),
    }));

    expect(prickar).toHaveLength(2);

    const dx = Math.abs(prickar[1].x - prickar[0].x);
    const dy = Math.abs(prickar[1].y - prickar[0].y);

    // The nodes lie on a diagonal, so the dots must too.
    expect(dx / dy).toBeCloseTo(1, 1);
  });

  // The box is the map's only moving part and what makes it readable: without
  // it the map shows where the graph is, but not where you are.
  test("the viewport box follows the scrolling", () => {
    const editor = montera(graf(8, 400));

    const before = rutan(editor).style.left;

    viewport(editor).scrollLeft += 600;
    viewport(editor).dispatchEvent(new Event("scroll"));

    const efter = rutan(editor).style.left;

    expect(Number.parseFloat(efter)).toBeGreaterThan(
      Number.parseFloat(before),
    );
  });

  /*
   * Johan, 25/9 kväll, with a mouse: "when all the nodes fit on screen the map
   * disappears" — and it came and went at moments that had nothing to do with
   * the view. The rule was right; it was only asked when the canvas was
   * redrawn (a buffer step, a trim), never on the scroll itself. So a pan that
   * carried a node out of view left the map hidden until the next growth step,
   * and a pan back hid it at some later one. Measured: two scrolls of 300 px,
   * well inside the buffer, grew nothing and asked nothing.
   *
   * Now the question follows the view. The map says one thing: something is
   * off screen.
   */
  test("följer vyn: fram i samma scroll som en nod lämnar bilden, borta när alla är tillbaka", async () => {
    const editor = montera(graf(2, 20), 900);

    editor.centerViewportAt({ x: 10, y: 10 });
    await new Promise<void>((resolve) => setTimeout(resolve, 60));
    expect(karta(editor).hidden, "hela guiden syns, kartan är i vägen").toBe(true);

    const before = { left: viewport(editor).scrollLeft, top: viewport(editor).scrollTop };

    // A small pan — no buffer growth, no redraw — that carries the guide off.
    viewport(editor).scrollLeft += 300;
    viewport(editor).scrollTop += 300;
    viewport(editor).dispatchEvent(new Event("scroll"));

    expect(karta(editor).hidden, "en nod lämnade bilden i den här scrollen").toBe(false);

    viewport(editor).scrollLeft = before.left;
    viewport(editor).scrollTop = before.top;
    viewport(editor).dispatchEvent(new Event("scroll"));

    expect(karta(editor).hidden, "alla noder är tillbaka i bild").toBe(true);
  });

  test("klick i kartan flyttar vyn dit", () => {
    const editor = montera(graf(8, 400));

    const element = karta(editor);
    const rect = element.getBoundingClientRect();

    viewport(editor).scrollLeft = 0;
    viewport(editor).scrollTop = 0;

    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: rect.left + rect.width * 0.9,
        clientY: rect.top + rect.height * 0.9,
        bubbles: true,
      }),
    );

    expect(viewport(editor).scrollLeft).toBeGreaterThan(0);
    expect(viewport(editor).scrollTop).toBeGreaterThan(0);
  });

  /*
   * Fynd (m), Johans iPad 27/9: kartan "indikerar ett fält" i ett tomt
   * hörn. Ett fält på en sida har sin position relativt sidan (20,112), och
   * kartan ritade den som om den vore arbetsytans — vid origo, där inget
   * finns. Fältet ligger i sidans block; kartan ritar sidan, inte fälten.
   */
  test("ett fält på en sida ritas inte som en egen markering vid origo", async () => {
    const data: GraphData = {
      startNodeId: "q",
      nodes: [
        { id: "q", type: "question", position: { x: 1400, y: 900 }, data: { title: "Fråga", variableName: "v", options: [{ id: "q-ja", label: "Ja", value: "ja" }] } },
        { id: "sida", type: "page", position: { x: 2200, y: 1500 }, data: { title: "Sida" } },
        { id: "falt", type: "text-question", parentPageId: "sida", order: 0, position: { x: 20, y: 112 }, data: { title: "Namn", variableName: "namn" } },
      ],
      connections: [{ id: "c", from: { nodeId: "q", portId: "q-ja" }, to: { nodeId: "sida", portId: "input" } }],
    };
    const editor = montera(data);

    editor.centerViewportAt({ x: 1400, y: 900 });
    await new Promise<void>((resolve) => setTimeout(resolve, 80));

    const map = karta(editor);
    const marks = [...map.querySelectorAll<HTMLElement>(".node-editor__minimap-node")];

    expect(map.hidden, "kartan ska synas: guiden är större än vyn").toBe(false);
    expect(marks.map((mark) => mark.dataset.nodeType)).toEqual(["question", "page"]);
    // Ingen markering i kartans övre vänstra hörn, där fältets relativa
    // position hamnade: frågan är den nod som ligger längst upp till vänster.
    const question = marks[0]!.getBoundingClientRect();
    for (const mark of marks) {
      expect(mark.getBoundingClientRect().left).toBeGreaterThanOrEqual(question.left - 0.5);
      expect(mark.getBoundingClientRect().top).toBeGreaterThanOrEqual(question.top - 0.5);
    }
  });
});


/*
 * Uppdrag 29/9, Del B (Astra §2–3, §6 punkt 3). Only what carries a
 * requirement: the visible area's colours follow the token even when a host
 * overrides it locally, and the transparency lives in the fill alone.
 *
 * Not guarded here: that the map clips its content. A probe by hit-testing
 * cannot fail — the box takes no pointer events, so nothing outside the map
 * is ever hit whether it is clipped or not (written, measured, removed 29/9;
 * PRAXIS 12). The clipping is `overflow: hidden` and is checked in the
 * pictures.
 */
describe("minikartans synliga område (Uppdrag 29/9, Del B)", () => {
  test("kontur och fyllning följer en lokalt överskriven --fw-primary; bara fyllningen är genomskinlig", async () => {
    const editor = montera(graf(6, 900));
    editor.style.setProperty("--fw-primary", "rgb(200, 30, 60)");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const map = karta(editor);
    const box = rutan(editor);
    expect(map.hidden, "kartan visades aldrig").toBe(false);

    const style = getComputedStyle(box);
    expect(style.borderTopColor, "konturen följer inte tokenen").toBe("rgb(200, 30, 60)");

    // The fill is the same token, mixed toward transparent: its alpha is low,
    // and its hue is the override's, not the default indigo.
    const probe = document.createElement("div");
    probe.style.cssText = `background: ${style.backgroundColor}`;
    document.body.append(probe);
    const fill = style.backgroundColor;
    expect(fill, "fyllningen saknas").not.toBe("rgba(0, 0, 0, 0)");
    const alpha = Number(/^rgba\(.*,\s*([\d.]+)\)$|\/\s*([\d.]+)\)$/.exec(fill)?.slice(1).find(Boolean) ?? 1);
    expect(alpha, "fyllningen är inte svag").toBeLessThan(0.3);
    probe.style.cssText = `background: color-mix(in oklab, rgb(200, 30, 60) 12%, transparent)`;
    expect(fill, "fyllningen följer inte tokenen").toBe(getComputedStyle(probe).backgroundColor);

    // Opacity on the fill only: neither the map (frame and dots) nor the box fades.
    expect(getComputedStyle(map).opacity, "hela kartan är tonad").toBe("1");
    expect(getComputedStyle(box).opacity, "konturen är tonad").toBe("1");
    probe.remove();
  });
});


/*
 * Astra 29/9, on the report about the zoom bar and the map: "Minikartan: inför
 * 12 CSS-px inre luft. Mät i kartans egen yta, oberoende av grafens skala."
 *
 * The air used to be 120 graph pixels, scaled down with the map — so it came
 * out at ~6 px on the claim example and at whatever the scale made of it on
 * any other guide. Now it is 12 px of the map's own surface, and the map's
 * geometry has to stay one system: the dots, the viewport box, a click and a
 * drag all go through the same origin and the same scale.
 */
describe("minikartans luft (Astra 29/9)", () => {
  /** The gap from the map's inner edge (inside the border) to the outermost dots. */
  function luft(map: HTMLElement): { left: number; top: number; right: number; bottom: number } {
    const rect = map.getBoundingClientRect();
    const inner = {
      left: rect.left + map.clientLeft,
      top: rect.top + map.clientTop,
      right: rect.left + map.clientLeft + map.clientWidth,
      bottom: rect.top + map.clientTop + map.clientHeight,
    };
    const dots = [...map.querySelectorAll<HTMLElement>(".node-editor__minimap-node")].map((dot) =>
      dot.getBoundingClientRect(),
    );

    return {
      left: Math.min(...dots.map((dot) => dot.left)) - inner.left,
      top: Math.min(...dots.map((dot) => dot.top)) - inner.top,
      right: inner.right - Math.max(...dots.map((dot) => dot.right)),
      bottom: inner.bottom - Math.max(...dots.map((dot) => dot.bottom)),
    };
  }

  function flowNode(editor: NodeEditor, id: string): HTMLElement {
    const element = [...editor.shadowRoot!.querySelectorAll<HTMLElement & { nodeId?: string }>("flow-node")].find(
      (node) => node.nodeId === id,
    );

    if (!element) {
      throw new Error(`Noden ${id} finns inte i editorn.`);
    }

    return element;
  }

  // The dot for a node: the dots are drawn in `minimapNodes()` order, which is
  // the graph's order with the fields on a page left out.
  function prick(editor: NodeEditor, data: GraphData, id: string): HTMLElement {
    const ids = data.nodes.filter((node) => !node.parentPageId).map((node) => node.id);
    const dots = [...karta(editor).querySelectorAll<HTMLElement>(".node-editor__minimap-node")];
    expect(dots, "en prick per nod på arbetsytan").toHaveLength(ids.length);
    return dots[ids.indexOf(id)]!;
  }

  // The node whose dot lies nearest the map's centre, so a click on it is
  // never clamped at the edge of the scrollable workspace. Measured 29/9: the
  // fifth node of the claim example sat at the right edge and the scroll
  // stopped 119 px short of centring it — on the old code and the new alike.
  function mittnod(editor: NodeEditor, data: GraphData): string {
    const map = karta(editor).getBoundingClientRect();
    const ids = data.nodes.filter((node) => !node.parentPageId).map((node) => node.id);
    const avstånd = (id: string): number => {
      const dot = prick(editor, data, id).getBoundingClientRect();
      return Math.hypot(dot.left + dot.width / 2 - (map.left + map.width / 2), dot.top + dot.height / 2 - (map.top + map.height / 2));
    };
    return ids.reduce((best, id) => (avstånd(id) < avstånd(best) ? id : best));
  }

  test.runIf(PRO).each([
    ["skadeanmälan", () => structuredClone(claimExampleGraph)],
    ["en liten guide", () => graf(2, 400)],
  ])("12 px i kartans egna pixlar på alla sidor — %s", (_namn, bygg) => {
    const editor = montera(bygg());
    const map = karta(editor);

    expect(map.hidden, "kartan ska synas").toBe(false);

    const gap = luft(map);
    // Sub-pixel slack only: the old air was ~6 px on the claim example.
    expect(gap.left, "vänster").toBeCloseTo(12, 0);
    expect(gap.top, "överkant").toBeCloseTo(12, 0);
    expect(gap.right, "höger").toBeCloseTo(12, 0);
    expect(gap.bottom, "nederkant").toBeCloseTo(12, 0);
  });

  test.runIf(PRO)("klick på en nods prick centrerar canvasen på noden", () => {
    const data = structuredClone(claimExampleGraph);
    const editor = montera(data);
    const mitten = { id: mittnod(editor, data) };
    const dot = prick(editor, data, mitten.id).getBoundingClientRect();

    karta(editor).dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: dot.left + dot.width / 2,
        clientY: dot.top + dot.height / 2,
        bubbles: true,
      }),
    );

    const node = flowNode(editor, mitten.id).getBoundingClientRect();
    const vp = viewport(editor);
    const vpRect = vp.getBoundingClientRect();

    expect(node.left + node.width / 2, "vågrätt").toBeCloseTo(vpRect.left + vp.clientLeft + vp.clientWidth / 2, -0.5);
    expect(node.top + node.height / 2, "lodrätt").toBeCloseTo(vpRect.top + vp.clientTop + vp.clientHeight / 2, -0.5);
  });

  test.runIf(PRO)("ett drag flyttar vyn lika långt i grafen som i kartan delat med skalan", () => {
    const data = structuredClone(claimExampleGraph);
    const editor = montera(data);
    const map = karta(editor);
    const vp = viewport(editor);

    // The map's scale, read off a dot against its node: base pixels → map pixels.
    const mitten = { id: mittnod(editor, data) };
    const skala = prick(editor, data, mitten.id).getBoundingClientRect().width / flowNode(editor, mitten.id).offsetWidth;
    const zoom = flowNode(editor, mitten.id).getBoundingClientRect().width / flowNode(editor, mitten.id).offsetWidth;

    const rect = map.getBoundingClientRect();
    const start = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

    map.dispatchEvent(new PointerEvent("pointerdown", { clientX: start.x, clientY: start.y, bubbles: true }));
    const before = { left: vp.scrollLeft, top: vp.scrollTop };

    map.dispatchEvent(new PointerEvent("pointermove", { clientX: start.x + 20, clientY: start.y + 10, bubbles: true }));
    map.dispatchEvent(new PointerEvent("pointerup", { clientX: start.x + 20, clientY: start.y + 10, bubbles: true }));

    // Scroll is in canvas pixels, base pixels × zoom; one pixel of rounding.
    expect((vp.scrollLeft - before.left) / zoom, "vågrätt").toBeCloseTo(20 / skala, -0.5);
    expect((vp.scrollTop - before.top) / zoom, "lodrätt").toBeCloseTo(10 / skala, -0.5);
  });
});

/*
 * Story 142 (Astra 29/9): the flow's connections drawn in the map as thin
 * curves behind the dots, from the from-dot's right edge to the to-dot's left
 * edge. The claim example branches twice, which is the case the story is for.
 */
describe("minikartans kopplingar (berättelse 142)", () => {
  function linjer(editor: NodeEditor): SVGPathElement[] {
    return [...karta(editor).querySelectorAll<SVGPathElement>(".node-editor__minimap-links path")];
  }

  function prickFör(editor: NodeEditor, data: GraphData, id: string): DOMRect {
    const ids = data.nodes.filter((node) => !node.parentPageId).map((node) => node.id);
    const dots = [...karta(editor).querySelectorAll<HTMLElement>(".node-editor__minimap-node")];
    expect(dots, "en prick per nod på arbetsytan").toHaveLength(ids.length);
    return dots[ids.indexOf(id)]!.getBoundingClientRect();
  }

  // A point along the path in client pixels, through the path's own matrix,
  // so the check does not assume how the layer is placed.
  function ände(path: SVGPathElement, var_: "start" | "slut" | "mitt"): { x: number; y: number } {
    const längd = path.getTotalLength();
    const at = var_ === "start" ? 0 : var_ === "slut" ? längd : längd / 2;
    const punkt = path.getPointAtLength(at);
    const matris = path.getScreenCTM()!;
    return {
      x: matris.a * punkt.x + matris.c * punkt.y + matris.e,
      y: matris.b * punkt.x + matris.d * punkt.y + matris.f,
    };
  }

  function sitterPå(editor: NodeEditor, data: GraphData, path: SVGPathElement, from: string, to: string): void {
    const a = prickFör(editor, data, from);
    const b = prickFör(editor, data, to);
    const start = ände(path, "start");
    const slut = ände(path, "slut");

    expect(start.x, `${from}: högerkant`).toBeCloseTo(a.right, 0);
    expect(start.y, `${from}: mitthöjd`).toBeCloseTo(a.top + a.height / 2, 0);
    expect(slut.x, `${to}: vänsterkant`).toBeCloseTo(b.left, 0);
    expect(slut.y, `${to}: mitthöjd`).toBeCloseTo(b.top + b.height / 2, 0);
  }

  test.runIf(PRO)("(a) en linje per koppling vars båda noder finns — förgreningar ger flera ur samma prick, en förlorad koppling ingen", () => {
    const data = structuredClone(claimExampleGraph);
    const hela = data.connections.length;

    data.connections.push({
      id: "förlorad",
      from: { nodeId: "claim-review", portId: "out" },
      to: { nodeId: "finns-inte", portId: "input" },
    });

    const editor = montera(data);

    expect(karta(editor).hidden, "kartan ska synas").toBe(false);
    expect(linjer(editor)).toHaveLength(hela);

    // Two lines leave the burglary rule's dot: the branch.
    const regel = prickFör(editor, data, "claim-rule-burglary");
    const ur = linjer(editor).filter((path) => Math.abs(ände(path, "start").x - regel.right) < 1 && Math.abs(ände(path, "start").y - (regel.top + regel.height / 2)) < 1);
    expect(ur, "förgreningen ur inbrottsregeln").toHaveLength(2);
  });

  /*
   * Per, mutationskontroll 142: en koppling vars till-nod är ett fält inuti
   * en sida (`parentPageId` satt) har inget eget prick — samma skäl som
   * fyndet 27/9 (fält på en sida) — så en sådan koppling ska räknas som en
   * förlorad koppling, inte ritas mot sidans prick eller mot origo. Sett
   * falla: en mutation som föll tillbaka på sidans prick när fältets eget
   * saknades drog en linje ändå.
   */
  test("(a2) en koppling till ett fält inuti en sida ritas inte", () => {
    const data: GraphData = {
      startNodeId: "q",
      nodes: [
        { id: "q", type: "question", position: { x: 1400, y: 900 }, data: { title: "Fråga", variableName: "v", options: [{ id: "q-ja", label: "Ja", value: "ja" }] } },
        { id: "sida", type: "page", position: { x: 2200, y: 1500 }, data: { title: "Sida" } },
        { id: "falt", type: "text-question", parentPageId: "sida", order: 0, position: { x: 20, y: 112 }, data: { title: "Namn", variableName: "namn" } },
      ],
      connections: [
        { id: "till-sidan", from: { nodeId: "q", portId: "q-ja" }, to: { nodeId: "sida", portId: "input" } },
        { id: "till-faltet", from: { nodeId: "q", portId: "q-ja" }, to: { nodeId: "falt", portId: "input" } },
      ],
    };
    const editor = montera(data);

    expect(karta(editor).hidden, "kartan ska synas").toBe(false);
    // Bara kopplingen till sidan har två prickar; kopplingen till fältet
    // saknar en till-prick och ska inte räknas.
    expect(linjer(editor)).toHaveLength(1);
  });

  test.runIf(PRO)("(b) ändpunkterna ligger på från-prickens högerkant och till-prickens vänsterkant, i mitthöjd", () => {
    const data = structuredClone(claimExampleGraph);
    const editor = montera(data);

    linjer(editor).forEach((path, i) => {
      const connection = data.connections[i]!;
      sitterPå(editor, data, path, connection.from.nodeId, connection.to.nodeId);
    });
  });

  test("(c) flyttas en nod följer linjens ände med", () => {
    const data = graf(8, 400);
    const editor = montera(data);
    const före = ände(linjer(editor)[2]!, "slut");

    data.nodes[3].position = { x: 200, y: 1200 };
    editor.graph = { ...data };

    const efter = ände(linjer(editor)[2]!, "slut");
    expect(efter.x, "änden har flyttat").not.toBeCloseTo(före.x, 0);
    sitterPå(editor, data, linjer(editor)[2]!, "q2", "q3");
  });

  test("(d) läggs en koppling till eller tas bort ritas kartan om", () => {
    const data = graf(8, 400);
    const editor = montera(data);

    expect(linjer(editor)).toHaveLength(7);

    editor.graph = {
      ...data,
      connections: [
        ...data.connections,
        { id: "extra", from: { nodeId: "q0", portId: "q0-ja" }, to: { nodeId: "q5", portId: "input" } },
      ],
    };
    expect(linjer(editor), "tillagd").toHaveLength(8);

    editor.graph = { ...data, connections: data.connections.slice(0, 4) };
    expect(linjer(editor), "borttagna").toHaveLength(4);
  });

  test.runIf(PRO)("(e) lagret fångar inga pekarhändelser, står bakom prickarna och är svagare än dem", () => {
    const data = structuredClone(claimExampleGraph);
    const editor = montera(data);
    const map = karta(editor);
    const lager = map.querySelector<SVGSVGElement>(".node-editor__minimap-links")!;

    expect(getComputedStyle(lager).pointerEvents).toBe("none");

    // Behind the dots: earlier in the markup, and neither layer lifts itself.
    const prickar = map.querySelector<HTMLElement>(".node-editor__minimap-nodes")!;
    expect(lager.compareDocumentPosition(prickar) & Node.DOCUMENT_POSITION_FOLLOWING, "lagret står före prickarna").toBeTruthy();
    expect(getComputedStyle(lager).zIndex, "linjerna lyfts inte").toBe("auto");
    expect(getComputedStyle(prickar).zIndex, "prickarna sänks inte").toBe("auto");

    // Fainter than the dots (Astra: "mindre framträdande än noderna"): the
    // line is toned further than the dots already are — their colour is
    // mixed 75 % towards the map's surface, see (i).
    expect(Number(getComputedStyle(lager).strokeOpacity), "linjen tonad mer än pricken").toBeLessThan(0.75);

    // A spot in the map on no dot and inside the layer: the layer's own box
    // would take the hit if it took pointer events.
    linjer(editor).forEach((path) => {
      const mitt = ände(path, "mitt");
      expect(editor.shadowRoot!.elementFromPoint(mitt.x, mitt.y), "träffen går till kartan").toBe(map);
    });
  });

  /*
   * Astra 29/9: the lines keep the map's 12 px of air, as the dots do. Both
   * guides have line breaks — connections backwards in x — and the canvas's
   * S-loop for those swung out to 0.3 px (moving) and 2.7 px (claim) from the
   * frame. The whole layer's box, not each line's, so it is the air that is
   * measured.
   */
  test.runIf(PRO).each([
    ["skadeanmälan", () => structuredClone(claimExampleGraph)],
    ["flyttguiden", () => structuredClone(movingExampleGraph)],
  ])("(f) inga linjer når in i kartans 12 px luft — %s", (_namn, bygg) => {
    const editor = montera(bygg());
    const map = karta(editor);

    expect(map.hidden, "kartan ska synas").toBe(false);

    const ram = map.getBoundingClientRect();
    const inner = {
      left: ram.left + map.clientLeft,
      top: ram.top + map.clientTop,
      right: ram.left + map.clientLeft + map.clientWidth,
      bottom: ram.top + map.clientTop + map.clientHeight,
    };
    const boxar = linjer(editor).map((path) => path.getBoundingClientRect());
    expect(boxar.length, "guiden har kopplingar").toBeGreaterThan(0);

    const lagret = {
      left: Math.min(...boxar.map((box) => box.left)),
      top: Math.min(...boxar.map((box) => box.top)),
      right: Math.max(...boxar.map((box) => box.right)),
      bottom: Math.max(...boxar.map((box) => box.bottom)),
    };
    expect(lagret.left - inner.left, "vänster").toBeGreaterThanOrEqual(12 - 0.5);
    expect(lagret.top - inner.top, "överkant").toBeGreaterThanOrEqual(12 - 0.5);
    expect(inner.right - lagret.right, "höger").toBeGreaterThanOrEqual(12 - 0.5);
    expect(inner.bottom - lagret.bottom, "nederkant").toBeGreaterThanOrEqual(12 - 0.5);
  });

  /*
   * Astra 29/9, variant B: a connection backwards — the to-dot's left edge
   * left of the from-dot's right edge, a line break — is a straight line; a
   * connection forwards keeps the canvas's curve.
   */
  test.runIf(PRO)("(g) en koppling bakåt är en rak linje, en koppling framåt är kurvad", () => {
    const data = structuredClone(movingExampleGraph);
    const editor = montera(data);
    const bakåt: SVGPathElement[] = [];
    const framåt: SVGPathElement[] = [];

    linjer(editor).forEach((path) => {
      (ände(path, "slut").x < ände(path, "start").x ? bakåt : framåt).push(path);
    });

    expect(bakåt.length, "flyttguiden har radbyten").toBeGreaterThan(0);
    expect(framåt.length, "och kopplingar framåt").toBeGreaterThan(0);

    for (const path of bakåt) {
      expect(path.getAttribute("d"), "bakåt: bara M och L").toMatch(/^M [-\d.e]+ [-\d.e]+ L [-\d.e]+ [-\d.e]+$/);
    }
    for (const path of framåt) {
      expect(path.getAttribute("d"), "framåt: kurvan").toContain("C");
    }
  });

  /*
   * Astra 29/9, late: the lines showed through the dots (`opacity: 0.75`),
   * and two line breaks across the review dot in the claim example made the
   * connections hard to read. The dots now cover the lines — opaque — and
   * keep the colour they had: the same 75 % of the family's ink over the
   * map's surface, mixed beforehand instead of composited.
   */
  function rgba(färg: string): [number, number, number, number] {
    // Through a canvas, so `color(srgb …)` from color-mix and `rgb(…)` read
    // alike, rounded the way the screen rounds them.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ritning = canvas.getContext("2d")!;
    ritning.fillStyle = färg;
    ritning.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ritning.getImageData(0, 0, 1, 1).data;
    return [r!, g!, b!, a!];
  }

  // One top-level node of each colour the map has. The claim example keeps
  // its calculation inside a page and has no note, so they are added here.
  function allaFärger(): GraphData {
    const data = structuredClone(claimExampleGraph);
    data.nodes.push(
      { id: "uträkning", type: "calculation", position: { x: 0, y: 1400 }, data: {} },
      { id: "anteckning", type: "annotation", position: { x: 400, y: 1400 }, data: { text: "Not" } },
    );
    return data;
  }

  function färgklass(prick: HTMLElement): string {
    return prick.hasAttribute("data-ending") ? "end" : prick.dataset.nodeType!;
  }

  function prickar(editor: NodeEditor): HTMLElement[] {
    return [...karta(editor).querySelectorAll<HTMLElement>(".node-editor__minimap-node")];
  }

  afterEach(() => {
    delete document.body.dataset.fwTheme;
  });

  test.runIf(PRO).each(["light", "dark"])("(h) prickarna är ogenomskinliga och täcker linjerna — %s", (tema) => {
    document.body.dataset.fwTheme = tema;
    const editor = montera(allaFärger());

    expect(linjer(editor).length, "det finns linjer att täcka").toBeGreaterThan(0);

    for (const prick of prickar(editor)) {
      const stil = getComputedStyle(prick);
      expect(stil.opacity, `${färgklass(prick)}: opacity`).toBe("1");
      expect(rgba(stil.backgroundColor)[3], `${färgklass(prick)}: bakgrundens alfa`).toBe(255);
    }
  });

  /*
   * Pinned from the old dots as they stood on screen, 29/9, at 1x: a pixel
   * read in the middle of each dot in the claim editor, both themes. The
   * calculation and the note had no top-level dot there; theirs are the old
   * composite worked out by hand (0.75 × ink + 0.25 × surface, rounded),
   * which is what the others measured to.
   */
  const förut: Record<string, Record<string, [number, number, number]>> = {
    light: {
      "text-question": [104, 99, 185],
      rule: [143, 88, 189],
      calculation: [73, 150, 171],
      "service-call": [198, 125, 70],
      end: [79, 139, 102],
      annotation: [235, 208, 63],
    },
    dark: {
      "text-question": [133, 146, 203],
      rule: [171, 146, 204],
      calculation: [87, 185, 201],
      "service-call": [198, 169, 72],
      end: [91, 184, 151],
      annotation: [182, 156, 15],
    },
  };

  test.runIf(PRO).each(["light", "dark"])("(i) prickens egen färg är densamma som den genomskinliga prickens var — %s", (tema) => {
    document.body.dataset.fwTheme = tema;
    const editor = montera(allaFärger());
    const sett = new Set<string>();

    for (const prick of prickar(editor)) {
      const klass = färgklass(prick);
      const väntat = förut[tema]![klass];
      if (!väntat) continue;
      sett.add(klass);

      const [r, g, b] = rgba(getComputedStyle(prick).backgroundColor);
      [r, g, b].forEach((kanal, i) => {
        expect(Math.abs(kanal - väntat[i]!), `${klass} kanal ${"rgb"[i]}: ${[r, g, b]} mot ${väntat}`).toBeLessThanOrEqual(1);
      });
    }

    expect([...sett].sort(), "alla färgklasser prövade").toEqual(Object.keys(förut[tema]!).sort());
  });

  /*
   * The problem dots stand at full strength (Astra 30/9, closing 142: "problem
   * behöver framträda tydligare än vanlig nodtyp", with the existing semantic
   * tokens). They had the 0.75 tint like every other dot, and a warning was
   * then the same colour as a service-call dot (197,125,70 both, measured by
   * Fia). So: exactly the token, no mix.
   */
  test.runIf(PRO).each(["light", "dark"])("(j) varnings- och felprickarna står i full styrka med de semantiska tokensen — %s", (tema) => {
    document.body.dataset.fwTheme = tema;
    const editor = montera(allaFärger());
    // The two top-level nodes allaFärger() adds — the claim graph's first
    // nodes are fields inside a page and have no dot of their own.
    editor.setNodeIssues(
      new Map([
        ["uträkning", { severity: "warning", label: "varning" }],
        ["anteckning", { severity: "error", label: "fel" }],
      ]),
    );

    for (const [severity, token] of [["warning", "--fw-warning-text"], ["error", "--fw-danger-text"]] as const) {
      const prick = karta(editor).querySelector<HTMLElement>(`.node-editor__minimap-node[data-severity="${severity}"]`);
      expect(prick, `${severity}: en prick är märkt`).not.toBeNull();
      const väntat = rgba(getComputedStyle(prick!).getPropertyValue(token));
      const fått = rgba(getComputedStyle(prick!).backgroundColor);
      expect(fått, `${severity}: exakt ${token}, ingen blandning`).toEqual(väntat);
    }
  });
});

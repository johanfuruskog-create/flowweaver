import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * "Which routes lead here?" — asked of a node, answered on the canvas.
 *
 * ## The question this exists for
 *
 * The lines already say where a node leads. The one nobody could answer was the
 * other way round: *how does somebody end up here?* That is the question you ask
 * about a refusal, and the answer is regularly a way nobody meant to leave open.
 *
 * ## What is dimmed, and why the ports matter
 *
 * The connections on the route light up and the rest drop back — that much
 * existed, wired to the preview tab and to result nodes only. What did not exist
 * is the nodes: a lit line arriving at a node whose answers are all equally
 * bright says half the thing. A port row carries both the answer's label and its
 * circle, so "Ja leads here, Nej does not" is one dimming, not two.
 *
 * ## What is asserted
 *
 * Computed opacity, not class names. A class is a promise; opacity is what a
 * person sees, and it is what breaks when a stylesheet is reorganised.
 */

afterEach(() => document.body.replaceChildren());

/*
 * Two ways to the same refusal, and one answer that avoids it.
 *
 *   start ──ja──▶ q2 ──ja──▶ nej-svaret
 *     └───nej───────────────▶ nej-svaret
 *                └──nej────▶ ja-svaret
 */
const branching = (): GraphData =>
  ({
    startNodeId: "q1",
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 40, y: 200 },
        data: {
          title: { sv: "Hyr du din bostad?" },
          variableName: "hyr",
          options: [
            { id: "ja", label: { sv: "Ja" }, value: "ja" },
            { id: "nej", label: { sv: "Nej" }, value: "nej" },
          ],
        },
      },
      {
        id: "q2",
        type: "question",
        position: { x: 380, y: 60 },
        data: {
          title: { sv: "Bor du ensam?" },
          variableName: "ensam",
          options: [
            { id: "ja", label: { sv: "Ja" }, value: "ja" },
            { id: "nej", label: { sv: "Nej" }, value: "nej" },
          ],
        },
      },
      { id: "ja-svaret", type: "result", position: { x: 720, y: 40 }, data: { title: { sv: "Du kan ha rätt" } } },
      { id: "nej-svaret", type: "result", position: { x: 720, y: 320 }, data: { title: { sv: "Du har inte rätt" } } },
    ],
    connections: [
      { id: "c-q1-ja", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "q2", portId: "input" } },
      { id: "c-q1-nej", from: { nodeId: "q1", portId: "nej" }, to: { nodeId: "nej-svaret", portId: "input" } },
      { id: "c-q2-ja", from: { nodeId: "q2", portId: "ja" }, to: { nodeId: "nej-svaret", portId: "input" } },
      { id: "c-q2-nej", from: { nodeId: "q2", portId: "nej" }, to: { nodeId: "ja-svaret", portId: "input" } },
    ],
  }) as unknown as GraphData;

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

/**
 * Two frames is not enough to read a port.
 *
 * `.flow-node__port` transitions opacity over 140 ms, so a measurement taken on
 * the next frame catches it mid-flight. Measured: a port on its way to 0.2 read
 * as 0.899 two frames in — which is how a test written to catch stacked dimming
 * survived the mutation that reintroduced it. Nodes and rows have no opacity
 * transition and settle at once; ports need the wait.
 */
const rest = () => new Promise<void>((resolve) => setTimeout(resolve, 250));

function mount(level = "advanced"): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", level);
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = branching();
  return editor;
}

const canvasOf = (editor: GuideEditor): ShadowRoot => {
  const canvas = editor.shadowRoot?.querySelector("node-editor")?.shadowRoot;
  if (!canvas) throw new Error("no canvas");
  return canvas;
};

const nodeOf = (editor: GuideEditor, id: string): HTMLElement => {
  const node = [...canvasOf(editor).querySelectorAll<HTMLElement>("flow-node")].find(
    (one) => (one as unknown as { nodeId: string | null }).nodeId === id,
  );
  if (!node) throw new Error(`no node ${id}`);
  return node;
};

/**
 * What a person sees of a node: how faded the card is, and per answer, how faded
 * its label is and what colour its circle is.
 *
 * The label and the circle are read separately because they are dimmed
 * differently on purpose. A translucent circle let the connection beneath it
 * shine through — the lines are drawn behind the nodes and the circle sits over
 * them — so the circle changes colour and stays opaque while the label fades.
 */
function look(editor: GuideEditor, id: string) {
  const node = nodeOf(editor, id);
  const card = node.shadowRoot?.querySelector<HTMLElement>(".flow-node");
  const rows = [...(node.shadowRoot?.querySelectorAll<HTMLElement>(".flow-node__port-row") ?? [])];

  return {
    opacity: Number(getComputedStyle(card as HTMLElement).opacity),
    ports: Object.fromEntries(
      rows.map((row) => {
        const port = row.querySelector<HTMLElement>("[data-port-id]");
        const label = row.querySelector<HTMLElement>(".flow-node__port-label");

        return [
          port?.dataset.portId ?? "?",
          {
            label: label ? Number(getComputedStyle(label).opacity) : 1,
            circle: port ? getComputedStyle(port).backgroundColor : "",
            circleOpacity: port ? Number(getComputedStyle(port).opacity) : 1,
          },
        ];
      }),
    ) as Record<string, { label: number; circle: string; circleOpacity: number }>,
  };
}

/** The opacity of a drawn connection, by id. */
function lineOpacity(editor: GuideEditor, id: string): number {
  const line = [...canvasOf(editor).querySelectorAll<SVGPathElement>("path[data-connection-id]")].find(
    (path) =>
      path.dataset.connectionId === id && !path.getAttribute("class")?.includes("hit"),
  );
  if (!line) throw new Error(`no line ${id}`);
  return Number(getComputedStyle(line).opacity);
}

/** The stroke colour of a drawn connection, by id — what a person sees. */
function lineStroke(editor: GuideEditor, id: string): string {
  const line = [...canvasOf(editor).querySelectorAll<SVGPathElement>("path[data-connection-id]")].find(
    (path) =>
      path.dataset.connectionId === id && !path.getAttribute("class")?.includes("hit"),
  );
  if (!line) throw new Error(`no line ${id}`);
  return getComputedStyle(line).stroke;
}

/** The green the route is drawn in, read off the same element the line reads it from. */
function successColour(editor: GuideEditor): string {
  const probe = document.createElementNS("http://www.w3.org/2000/svg", "path");
  probe.style.stroke = "var(--fw-success)";
  canvasOf(editor).querySelector("svg")?.append(probe);
  const stroke = getComputedStyle(probe).stroke;
  probe.remove();
  return stroke;
}

/**
 * What a port is actually worth on screen.
 *
 * Opacity multiplies down the tree, so reading one element's computed value
 * answers the wrong question. This is the number a person sees, and it is the
 * one that went to 0.019 when three dimmings stacked.
 */
function effectivePortOpacity(editor: GuideEditor, nodeId: string, portId: string): number {
  const node = nodeOf(editor, nodeId);
  const card = node.shadowRoot?.querySelector<HTMLElement>(".flow-node");
  const port = node.shadowRoot?.querySelector<HTMLElement>(`[data-port-id="${portId}"]`);
  const row = port?.closest<HTMLElement>(".flow-node__port-row");

  if (!card || !port || !row) throw new Error(`no port ${nodeId}.${portId}`);

  return (
    Number(getComputedStyle(card).opacity) *
    Number(getComputedStyle(row).opacity) *
    Number(getComputedStyle(port).opacity)
  );
}

/** Right-clicks a node and presses the routes item in its menu. */
function askForRoutes(editor: GuideEditor, id: string): void {
  const canvas = canvasOf(editor);
  const card = nodeOf(editor, id).shadowRoot?.querySelector<HTMLElement>(".flow-node");

  if (!card) throw new Error("no card");

  const box = card.getBoundingClientRect();
  card.dispatchEvent(
    new MouseEvent("contextmenu", {
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
      bubbles: true,
      composed: true,
    }),
  );

  const button = canvas.querySelector<HTMLButtonElement>('[data-action="routes-here"]');
  if (!button) throw new Error("no routes-here item in the menu");
  button.click();
}

describe("showing the routes to a node", () => {
  test("lights the ways there and dims the rest", async () => {
    const editor = mount();
    await settle();

    askForRoutes(editor, "nej-svaret");
    await settle();

    // Two routes reach the refusal: straight down from "Nej", and via q2's "Ja".
    expect(lineOpacity(editor, "c-q1-nej")).toBe(1);
    expect(lineOpacity(editor, "c-q1-ja")).toBe(1);
    expect(lineOpacity(editor, "c-q2-ja")).toBe(1);

    // The one answer that avoids it drops back.
    expect(lineOpacity(editor, "c-q2-nej")).toBeLessThan(0.5);
  });

  /*
   * The last line was blue while the rest of the route was green (Johan 23/9).
   *
   * Asking for the routes to a node selects it, and a selected node's own
   * connections are drawn in the selection's thicker blue (Uppdrag 23/9, Del A
   * punkt 5). That rule has the higher specificity, so on the one line where
   * both applied — the line *into* the asked node — the selection won and the
   * route arrived in the wrong colour. On a route, the route is the answer.
   */
  test("draws the line into the asked node green, even though that node is selected", async () => {
    const editor = mount();
    await settle();

    askForRoutes(editor, "q2");
    await settle();

    const green = successColour(editor);
    expect(green).not.toBe("");
    // Into q2 — the asked, selected node.
    expect(lineStroke(editor, "c-q1-ja")).toBe(green);
    // Out of it, on no route: dimmed, and not green.
    expect(lineStroke(editor, "c-q2-ja")).not.toBe(green);
  });

  test("dims the answers that do not lead there, on their own node", async () => {
    const editor = mount();
    await settle();

    askForRoutes(editor, "nej-svaret");
    await settle();
    await rest();

    const q2 = look(editor, "q2");

    // "Ja" from q2 leads to the refusal; "Nej" does not. Both sit on a node that
    // is itself on the route, so the node stays lit and the answers differ.
    expect(q2.opacity).toBe(1);
    expect(q2.ports.ja.label).toBe(1);
    expect(q2.ports.nej.label).toBeLessThan(0.5);
  });

  test("but keeps the circle opaque, so the line does not shine through it", async () => {
    const editor = mount();
    await settle();

    askForRoutes(editor, "nej-svaret");
    await settle();
    await rest();

    /*
     * Found by Johan, in a screenshot: the dimmed circle had the connection
     * running visibly through the middle of it. A port is the one thing in the
     * row that has a *place* in the picture — it must stay solid and say "there
     * is a way out here, just not this one".
     */
    const q2 = look(editor, "q2");

    expect(q2.ports.nej.circleOpacity).toBe(1);
    expect(q2.ports.nej.circle).not.toBe(q2.ports.ja.circle);
  });

  test("dims a node no route passes through at all", async () => {
    const editor = mount();
    await settle();

    askForRoutes(editor, "nej-svaret");
    await settle();

    // The other result is not on any way to this one.
    expect(look(editor, "ja-svaret").opacity).toBeLessThan(0.5);
    expect(look(editor, "nej-svaret").opacity).toBe(1);
  });

  /*
   * Johan 23/9, in the real editor: asked for the routes from the node's menu,
   * pressed Escape, nothing happened. The menu item was inside the canvas, but
   * the menu closes when pressed and focus falls to the document — and the
   * canvas only hears keys aimed inside it. Measured from where focus really
   * is after the click, not from the viewport.
   */
  test("Escape ends it from wherever focus landed after the menu", async () => {
    const editor = mount();
    await settle();

    askForRoutes(editor, "nej-svaret");
    await settle();
    expect(look(editor, "ja-svaret").opacity).toBeLessThan(0.5);

    const deepActive = (): Element => {
      let active: Element = document.activeElement ?? document.body;
      while (active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      return active;
    };
    const target = deepActive();
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }),
    );
    await settle();

    expect(look(editor, "ja-svaret").opacity, `fokus stod på <${target.tagName.toLowerCase()}>`).toBe(1);
  });

  test("and Escape puts it away — the empty canvas does not", async () => {
    const editor = mount();
    await settle();

    askForRoutes(editor, "nej-svaret");
    await settle();
    expect(look(editor, "ja-svaret").opacity).toBeLessThan(0.5);

    /*
     * Until 5/9 the node's menu drew a one-shot highlight that the next click
     * anywhere put away. Now it starts the same MODE as Guide → Vägar hit
     * (one name, one behaviour), so looking around keeps the answer and
     * Escape ends it — measured in guide-editor-routes-mode.browser.test.ts,
     * asserted here on the opacity a person sees.
     */
    const viewport = canvasOf(editor).querySelector<HTMLElement>(".node-editor__viewport");
    viewport?.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        composed: true,
        clientX: 5,
        clientY: 5,
        pointerId: 1,
        isPrimary: true,
        button: 0,
      }),
    );
    await settle();
    expect(look(editor, "ja-svaret").opacity).toBeLessThan(0.5);

    viewport?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }),
    );
    await settle();

    expect(look(editor, "ja-svaret").opacity).toBe(1);
    expect(look(editor, "q2").ports.nej.label).toBe(1);
    expect(lineOpacity(editor, "c-q2-nej")).toBe(1);
  });

  test("keeps the ports on a dimmed node visible rather than erasing them", async () => {
    const editor = mount();
    await settle();

    askForRoutes(editor, "nej-svaret");
    await settle();
    await rest();

    /*
     * Found by Johan: the ports disappeared completely on the results the route
     * did not pass through. Three dimmings multiplied — node 0.28 × row 0.34 ×
     * port 0.2 = 0.019 — and an invisible port reads as a rendering fault, not
     * as an answer. Only one layer dims now.
     */
    const off = effectivePortOpacity(editor, "ja-svaret", "input");

    expect(off).toBeGreaterThan(0.2);
    expect(off).toBeLessThan(0.5);
  });

  test("and dims an answer once, not once per layer", async () => {
    const editor = mount();
    await settle();

    askForRoutes(editor, "nej-svaret");
    await settle();
    await rest();

    // q2 is on the route, so its card is not faded and the label carries the
    // whole dimming: 0.34, not 0.34 multiplied by anything above it.
    const q2 = look(editor, "q2");

    expect(q2.opacity).toBe(1);
    expect(q2.ports.nej.label).toBeGreaterThan(0.2);
  });

  test("is offered at the Basic level too", async () => {
    /*
     * It was gated on the `routeAnalysis` capability at first, which put it out
     * of reach at Basic — measured on the housing-screening example, which is a
     * Basic page built around a Rule node choosing between three results. That
     * is precisely the guide where the question is worth asking, so the gate was
     * the wrong line and is gone.
     */
    const editor = mount("basic");
    await settle();

    askForRoutes(editor, "nej-svaret");
    await settle();

    expect(lineOpacity(editor, "c-q2-nej")).toBeLessThan(0.5);
  });

  test("or on the start node, where the answer would be the whole guide", async () => {
    const editor = mount();
    await settle();

    expect(() => askForRoutes(editor, "q1")).toThrow(/routes-here/);
  });
});

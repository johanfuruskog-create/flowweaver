import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { everyFieldExampleGraph } from "../../../data/every-field-example-graph";

import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * A canvas that cannot be changed draws no handles.
 *
 * ## The failure this is written from
 *
 * `every-field-editor` carries no `mode`, so it is read-only. Measured there
 * on 1 September: 20 of 20 nodes showed the drag grip ⠿, 10 showed their
 * ports, two "drop a field here" hints stood on the page surfaces, and the
 * palette was still on screen. Only the menus were gone. A read-only canvas
 * that shows handles promises something it does not keep — and that same lie
 * is what let nodes be dragged in read-only mode (story 063).
 *
 * ## The one thing that came back, on purpose
 *
 * The ports. Hiding them left every connection ending at a point behind a card
 * (story 129, Johan on 18 September: *"Låst läge ska ha portar — ser dumt ut
 * när linjerna ligger bakom noderna"*). They are drawn again and they are not
 * controls: no pointer surface, no tab stop, and the canvas refuses the gesture
 * anyway. All three layers are measured in
 * `node-editor/node-editor-readonly-ports.browser.test.ts`; what this file
 * keeps is that they are *there*, so a later tidy-up cannot quietly hide them
 * again under the heading "read-only draws no handles".
 *
 * ## Why `getComputedStyle` and not the attribute
 *
 * The palette test that stood before this one read `palette.hidden` and was
 * green while the palette was on screen: `node-palette.scss` set
 * `:host { display: block }`, which beats the user agent's rule for
 * `[hidden]`. The attribute was never the question — PRAXIS 16.
 *
 * ## Why the edit case is here too
 *
 * A selector that hits nothing passes every "is it hidden" assertion. The
 * same measurements in `administrator` demand the opposite, so a rule that
 * hides too much fails just as loudly.
 */

afterEach(() => document.body.replaceChildren());

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

function mount(mode?: string, width = 1200): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.style.cssText = `display: block; width: ${width}px; height: 800px;`;
  if (mode) editor.setAttribute("mode", mode);
  document.body.append(editor);
  editor.graph = everyFieldExampleGraph;
  return editor;
}

function shown(elements: Iterable<Element>): Element[] {
  return [...elements].filter((element) => {
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

function canvas(editor: GuideEditor): NodeEditor {
  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");
  if (!nodeEditor) throw new Error("node-editor saknas");
  return nodeEditor;
}

function counts(editor: GuideEditor) {
  const nodeEditor = canvas(editor);
  const nodes = [
    ...(nodeEditor.shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []),
  ];

  const grips = nodes.flatMap((node) =>
    shown(node.shadowRoot?.querySelectorAll(".flow-node__grip") ?? []),
  );
  const ports = nodes.flatMap((node) =>
    shown(node.shadowRoot?.querySelectorAll(".flow-node__port") ?? []),
  );
  const dropHints = shown(
    nodeEditor.shadowRoot?.querySelectorAll(".node-editor__page-drop-hint") ?? [],
  );

  const palette = editor.shadowRoot?.querySelector<HTMLElement>("node-palette");
  const plaque = nodeEditor.shadowRoot?.querySelector<HTMLElement>(
    "[data-mode-plaque]",
  );

  return {
    grips: grips.length,
    ports: ports.length,
    /*
     * Ringarna inne i kortets struktur, mätta för sig.
     *
     * Det är de som 063 gömde och 129 tog tillbaka, och bara de: ett kort som
     * bär sin port utanför strukturen syntes hela tiden. En räkning av alla
     * portar tillsammans är grön även med strukturens portar gömda — mätt, och
     * det var därför den här raden skrevs.
     */
    structurePorts: ports.filter((port) => port.closest(".flow-node__structure") !== null).length,
    /* En ritad port är ingen kontroll: den ligger utanför tabbordningen. */
    portTabStops: ports.filter((port) => port.getAttribute("tabindex") !== "-1").length,
    dropHints: dropHints.length,
    paletteDisplay: palette ? getComputedStyle(palette).display : "saknas",
    plaqueShown: plaque ? shown([plaque]).length === 1 : false,
    plaqueText: plaque?.textContent?.trim() ?? "",
  };
}

/** The canvas's width as a share of the whole editor's. */
function canvasShare(editor: GuideEditor): number {
  const whole = editor.getBoundingClientRect().width;
  const drawn = canvas(editor).getBoundingClientRect().width;
  return whole === 0 ? 0 : drawn / whole;
}

describe("the workspace", () => {
  // The palette is a grid item, and hiding it for real took it out of the grid
  // — so the canvas slid into the palette's `auto` column and collapsed to a
  // couple of pixels while the `1fr` column stood empty. Nobody saw it while
  // the palette was never actually gone.
  test.each([["readonly", undefined], ["translator", "translator"], ["administrator", "administrator"]])(
    "fyller arbetsytan i %s",
    async (_name, mode) => {
      // Wide enough that the docked palette's 190 px cannot be mistaken for
      // the fault this guards against.
      const editor = mount(mode, 1600);
      await settle();

      expect(canvasShare(editor)).toBeGreaterThan(0.6);
    },
  );
});

describe("the read-only canvas", () => {
  test("draws no grip, no drop hint and no palette — and keeps the ports inert", async () => {
    const editor = mount();
    await settle();
    const measured = counts(editor);

    expect(measured.grips).toBe(0);
    /*
     * Story 063's decision, reversed by story 129: the ports are drawn, because
     * a line that ends behind a card reads as a broken guide. They stay out of
     * the tab order here — the rest of the proof is in the ports test named at
     * the top of this file.
     */
    expect(measured.ports).toBeGreaterThan(0);
    expect(measured.structurePorts).toBeGreaterThan(0);
    expect(measured.portTabStops).toBe(0);
    expect(measured.dropHints).toBe(0);
    expect(measured.paletteDisplay).toBe("none");
    expect(measured.plaqueShown).toBe(true);
    expect(measured.plaqueText).toBe("Läsläge");
  });

  test("keeps the ports' boxes, so the lines still find their anchors", async () => {
    const editor = mount();
    await settle();
    const nodeEditor = canvas(editor);
    const port = nodeEditor.shadowRoot
      ?.querySelector<FlowNode>("flow-node")
      ?.shadowRoot?.querySelector<HTMLElement>(".flow-node__port");

    // The box is what matters here, whatever is painted in it: getPortCenter
    // reads the port's rectangle as the line's anchor, and a removed box is
    // 0×0. It survived `visibility: hidden` for that reason, and the port is
    // visible again since story 129 — the anchor is the same either way.
    if (port) {
      expect(port.getBoundingClientRect().width).toBeGreaterThan(0);
    }

    const drawn = [
      ...(nodeEditor.shadowRoot?.querySelectorAll<SVGPathElement>(
        ".node-editor__permanent-connections path",
      ) ?? []),
    ];
    expect(drawn.length).toBeGreaterThan(0);
    drawn.forEach((path) => {
      expect(path.getAttribute("d") ?? "").not.toContain("NaN");
    });
  });

  test("and the same measurements say the opposite when the guide can be built", async () => {
    const editor = mount("administrator");
    await settle();
    const measured = counts(editor);

    expect(measured.grips).toBeGreaterThan(0);
    expect(measured.ports).toBeGreaterThan(0);
    expect(measured.dropHints).toBeGreaterThan(0);
    expect(measured.paletteDisplay).not.toBe("none");
    expect(measured.plaqueShown).toBe(false);
  });
});

/**
 * Story 064 point 10: a canvas nobody may change shows the visitor's view and
 * no way to switch away from it. Johan: *"Är det skrivskyddat ska bara visa
 * läget synas och då behöver vi ingen ikon."* A button that switches to
 * something you may not touch is the same lie as a grip here — which is why the
 * case lives in this file and not beside the menu that lights the eyes.
 */
describe("what a read-only canvas draws of the two views", () => {
  test.each([
    ["läsläge", undefined],
    ["översättningsläge", "translator"],
  ])("%s visar besökarvyn överallt och ingen öga-knapp", async (_name, mode) => {
    const editor = mount(mode);
    await settle();

    const nodes = [
      ...(canvas(editor).shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []),
    ].filter((node) => node.shadowRoot?.querySelector("[data-visitor-preview]"));

    expect(nodes.length).toBeGreaterThan(2);
    expect(nodes.every((node) => node.visitorView)).toBe(true);
    expect(
      nodes.flatMap((node) => [
        ...(node.shadowRoot?.querySelectorAll("[data-visitor-toggle]") ?? []),
      ]),
    ).toEqual([]);
  });

  test("redigeringsläge öppnas med alla släckta", async () => {
    const editor = mount();
    await settle();

    editor.setAttribute("mode", "administrator");
    await settle();

    const lit = [
      ...(canvas(editor).shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []),
    ].filter((node) => node.visitorView);

    expect(lit).toEqual([]);
  });
});

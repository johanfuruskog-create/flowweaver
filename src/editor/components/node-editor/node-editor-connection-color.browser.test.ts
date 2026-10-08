import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../viewer/node-types/default-node-types";
import "./node-editor";

import type { NodeEditor } from "./node-editor";
import type { GraphData } from "../../../viewer/types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

/**
 * Two questions both pointing into the same rule, and the rule on to two
 * results. The rule's entrance port therefore receives two connections — the
 * case that decides how the port's colour should behave.
 */
function graf(): GraphData {
  return {
    startNodeId: "q1",
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: "Fråga 1",
          variableName: "a",
          options: [{ id: "q1-ja", label: "Ja", value: "ja" }],
        },
      },
      {
        id: "q2",
        type: "question",
        position: { x: 0, y: 200 },
        data: {
          title: "Fråga 2",
          variableName: "b",
          options: [{ id: "q2-ja", label: "Ja", value: "ja" }],
        },
      },
      {
        id: "regel",
        type: "rule",
        position: { x: 300, y: 100 },
        data: {
          title: "Regel",
          cases: [{ id: "fall", label: "Ja", match: "all", conditions: [] }],
          fallbackLabel: "annars",
        },
      },
      { id: "r1", type: "result", position: { x: 600, y: 0 }, data: { title: "Ett" } },
      { id: "r2", type: "result", position: { x: 600, y: 200 }, data: { title: "Två" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "q1-ja" }, to: { nodeId: "regel", portId: "input" } },
      { id: "c2", from: { nodeId: "q2", portId: "q2-ja" }, to: { nodeId: "regel", portId: "input" } },
      { id: "c3", from: { nodeId: "regel", portId: "fall" }, to: { nodeId: "r1", portId: "input" } },
      { id: "c4", from: { nodeId: "regel", portId: "default" }, to: { nodeId: "r2", portId: "input" } },
    ],
  };
}

function montera(data: GraphData): NodeEditor {
  const editor = document.createElement("node-editor") as NodeEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.editorMode = "administrator";
  // The body has no layout of its own here, so the editor would be 0px tall and
  // the menu never hittable by a mouse pointer.
  editor.style.cssText = "display: block; width: 900px; height: 600px;";
  document.body.append(editor);
  editor.graph = data;
  return editor;
}

/** Färgen på ett strecket i canvasen. */
function lineColour(editor: NodeEditor, id: string): string | null {
  const path = editor.shadowRoot?.querySelector<SVGPathElement>(
    `path.node-editor__connection[data-connection-id="${id}"]`,
  );
  return path?.dataset.color ?? null;
}

/** Färgen på en portcirkel. */
function portColour(
  editor: NodeEditor,
  nodeId: string,
  portId: string,
): string | null {
  const node = [...(editor.shadowRoot?.querySelectorAll("flow-node") ?? [])].find(
    (candidate) => (candidate as { nodeData?: { id: string } }).nodeData?.id === nodeId,
  );
  const port = node?.shadowRoot?.querySelector<HTMLElement>(
    `.flow-node__port[data-port-id="${portId}"]`,
  );
  return port?.dataset.color ?? null;
}

/** Öppnar högerklicksmenyn på ett streck och ger tillbaka dess färgrutor. */
function openSwatches(editor: NodeEditor, id: string): HTMLButtonElement[] {
  const hit = editor.shadowRoot?.querySelector<SVGPathElement>(
    `.node-editor__connection-hit[data-connection-id="${id}"]`,
  );

  hit?.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true }),
  );

  return [
    ...(editor.shadowRoot?.querySelectorAll<HTMLButtonElement>(
      ".node-editor__connection-color",
    ) ?? []),
  ];
}

describe("colour on connections", () => {
  test("without a colour neither line nor port carries a colour attribute", () => {
    const editor = montera(graf());

    expect(lineColour(editor, "c3")).toBeNull();
    expect(portColour(editor, "regel", "fall")).toBeNull();
    expect(portColour(editor, "r1", "input")).toBeNull();
  });

  test("a coloured connection colours the line and both circles", () => {
    const data = graf();
    data.connections[2].color = "end";
    const editor = montera(data);

    expect(lineColour(editor, "c3")).toBe("end");
    expect(portColour(editor, "regel", "fall")).toBe("end");
    expect(portColour(editor, "r1", "input")).toBe("end");
  });

  // Kärnan i beslutet: regelns ingång tar emot två kopplingar. Färgas den efter
  // en av dem beror utfallet på skapelseordningen, vilket ingen ser.
  test("an entrance with two agreeing connections takes their colour", () => {
    const data = graf();
    data.connections[0].color = "rule";
    data.connections[1].color = "rule";
    const editor = montera(data);

    expect(portColour(editor, "regel", "input")).toBe("rule");
  });

  test("an entrance with two different colours stays uncoloured", () => {
    const data = graf();
    data.connections[0].color = "rule";
    data.connections[1].color = "danger";
    const editor = montera(data);

    expect(lineColour(editor, "c1")).toBe("rule");
    expect(lineColour(editor, "c2")).toBe("danger");
    // The exits are unambiguous and take colour.
    expect(portColour(editor, "q1", "q1-ja")).toBe("rule");
    expect(portColour(editor, "q2", "q2-ja")).toBe("danger");
    // The entrance sees two colours and does not guess.
    expect(portColour(editor, "regel", "input")).toBeNull();
  });

  test("one coloured and one uncoloured also counts as disagreeing", () => {
    const data = graf();
    data.connections[0].color = "rule";
    const editor = montera(data);

    expect(portColour(editor, "regel", "input")).toBeNull();
  });

  // The menu resets `border` and `background` on its own buttons. That rule sits
  // later in the file and outweighed the unscoped swatch rules, so every swatch
  // lost its border and the default swatch its entire fill — it became invisible
  // against the menu. None of that shows in markup, only in computed style.
  test("every swatch has both a border and a fill", () => {
    const rutor = openSwatches(montera(graf()), "c3");

    expect(rutor).toHaveLength(7);

    for (const ruta of rutor) {
      const stil = getComputedStyle(ruta);
      const namn = ruta.dataset.color ?? "standard";

      expect(stil.boxShadow, `${namn} saknar kant`).not.toBe("none");

      expect(stil.backgroundColor, `${namn} saknar fyllning`).not.toMatch(
        /transparent|rgba\(0, 0, 0, 0\)/,
      );
    }
  });

  // The menu's `button:hover` paints the whole surface `--fw-danger-surface`. It
  // weighs (0,2,1) and took over on the one swatch without `[data-color]` — the
  // default swatch went pale pink on hover while the other six kept their
  // colour. The fill is what the swatch says, so the hover belongs on the ring.
  test("hover changes the ring, not the fill", async () => {
    const editor = montera(graf());

    /*
     * The editor centres itself on the start node after it mounts
     * (`centerInitialViewport`), and a menu opened before that is carried
     * along with the canvas it belongs to — off to (−904, −606) here, measured
     * 28/9. While the menu lay inside the scrolling canvas, Playwright's hover
     * scrolled it back into view and the race never showed; since the menu
     * lies over the canvas (so the minimap no longer covers it) there is
     * nothing to scroll. Open it once the view has settled, as a person does.
     */
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    openSwatches(editor, "c3");

    // The swatches are re-read on every reading rather than held as references.
    // The menu re-renders, and a detached element keeps its style forever: it
    // looks as though the hover never lands, and the poll never learns why.
    const ruta = (index: number): HTMLButtonElement => {
      const matches = editor.shadowRoot?.querySelectorAll<HTMLButtonElement>(
        ".node-editor__connection-color",
      );
      const funnen = matches?.[index];

      if (!funnen) {
        throw new Error(`Färgruta ${index} finns inte längre — menyn stängdes.`);
      }

      return funnen;
    };

    /** Ringens tjocklek, sista längden i `box-shadow`. */
    const ring = (index: number): string =>
      getComputedStyle(ruta(index)).boxShadow.match(/([\d.]+px)\s*$/)?.[1] ?? "";

    const antal = editor.shadowRoot?.querySelectorAll(
      ".node-editor__connection-color",
    ).length;

    expect(antal).toBe(7);

    // A known point outside the menu to move the pointer to between attempts.
    const parkering = document.createElement("div");
    parkering.style.cssText =
      "position: fixed; right: 0; bottom: 0; width: 60px; height: 60px; z-index: 9999;";
    document.body.append(parkering);

    for (let index = 0; index < 7; index += 1) {
      const namn = ruta(index).dataset.color ?? "standard";
      const fillBefore = getComputedStyle(ruta(index)).backgroundColor;

      // Every attempt moves the pointer for real: away and back.
      //
      // Chromium does not give `:hover` to an element inserted under a
      // stationary pointer — the state updates only on the next mouse move. If
      // the menu re-renders between the hover and the reading, the swatch
      // therefore stays unhovered however long you poll, and a poll that only
      // re-reads the value waits in vain. It measured 1.5px in roughly every
      // third full run, never when the file ran alone.
      await expect
        .poll(
          async () => {
            await userEvent.hover(parkering);
            await userEvent.hover(ruta(index));
            return ring(index);
          },
          { message: `${namn} markerar inte hover på ringen` },
        )
        .toBe("3px");

      expect(
        getComputedStyle(ruta(index)).backgroundColor,
        `${namn} bytte fyllning vid hover`,
      ).toBe(fillBefore);
    }
  });
});

/*
 * K6 (genomgången 30/9, rad E2): the seven swatches are a dense row, and a
 * dense row holds a 44 px target in the editor (Johan 25/9). The drawn
 * circle stays 18 px; the target is a pseudo-area round it, as the chip's
 * cross in the viewer does (`_chips.scss`). Measured before: 18 × 18 drawn
 * and hit, 8 px apart — a press 12 px from a centre landed on the row.
 *
 * Measured with `elementFromPoint`, because a pseudo-element's area is not in
 * the button's rect: what a pointer hits is the thing that matters.
 */
describe("the swatches as targets", () => {
  test("each swatch is hit 21 px from its centre in every direction, and never its neighbour's", async () => {
    const editor = montera(graf());
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    const swatches = openSwatches(editor, "c3");
    const root = editor.shadowRoot!;

    expect(swatches).toHaveLength(7);
    swatches.forEach((swatch, index) => {
      const rect = swatch.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const name = swatch.dataset.color || "standard";

      for (const [dx, dy] of [[-21, 0], [21, 0], [0, -21], [0, 21]] as const) {
        expect(root.elementFromPoint(x + dx, y + dy), `${name} ${dx},${dy}`).toBe(swatch);
      }
      // Halfway to the next centre is still one of the two — never the row.
      const next = swatches[index + 1];
      if (next) {
        const nextRect = next.getBoundingClientRect();
        const middle = (x + nextRect.left + nextRect.width / 2) / 2;
        expect([swatch, next], `${name}, halfway to the next`).toContain(root.elementFromPoint(middle, y));
      }
    });

    // The target stops short of the command under the row.
    const remove = root.querySelector<HTMLElement>(
      ".node-editor__connection-menu button:not(.node-editor__connection-color)",
    )!;
    const removeRect = remove.getBoundingClientRect();
    expect(root.elementFromPoint(removeRect.left + 30, removeRect.top + 1)).toBe(remove);
  });
});

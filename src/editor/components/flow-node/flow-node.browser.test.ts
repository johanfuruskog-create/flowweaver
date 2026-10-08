import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import type { FlowNode } from "./flow-node";
import type { FlowNodeData } from "../../../viewer/types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

function mount(node: FlowNodeData): FlowNode {
  const el = document.createElement("flow-node") as FlowNode;
  document.body.append(el);
  el.nodeData = node;
  return el;
}

function portLabels(el: FlowNode): string[] {
  return Array.from(
    el.shadowRoot?.querySelectorAll(".flow-node__port-label") ?? []
  ).map((span) => span.textContent?.trim() ?? "");
}

describe("flow-node: port labels on the canvas", () => {
  test("the generic Continue exit has no visible label", () => {
    const el = mount({
      id: "n",
      type: "text-question",
      position: { x: 0, y: 0 },
      data: { title: "Namn", variableName: "v" },
    });
    expect(portLabels(el)).not.toContain("Fortsätt");

    // But the button keeps its aria label for screen readers.
    const port = el.shadowRoot?.querySelector('[data-port-id="continue"]');
    expect(port?.getAttribute("aria-label")).toContain("Fortsätt");
  });

  test("branching questions' options keep their labels", () => {
    const el = mount({
      id: "q",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: "Välj",
        variableName: "v",
        options: [
          { id: "a", label: "Alternativ A", value: "a" },
          { id: "b", label: "Alternativ B", value: "b" },
        ],
      },
    });
    const labels = portLabels(el);
    expect(labels).toContain("Alternativ A");
    expect(labels).toContain("Alternativ B");
  });
});

describe("flow-node – anteckningsnod", () => {
  test("renderar sticky-note med text och en riktad pil", () => {
    const el = mount({
      id: "note",
      type: "annotation",
      position: { x: 0, y: 0 },
      data: { text: "Kom ihåg detta", arrow: "right" },
    });
    const arrow = el.shadowRoot?.querySelector<HTMLElement>(".flow-node__note-arrow");
    expect(arrow).not.toBeNull();
    expect(arrow?.dataset.dir).toBe("right");
    expect(
      el.shadowRoot?.querySelector(".flow-node__note-text")?.textContent?.trim()
    ).toBe("Kom ihåg detta");
    // No ports on a note.
    expect(el.shadowRoot?.querySelectorAll(".flow-node__port").length).toBe(0);
  });

  test("falls back to a downward arrow when no direction is set", () => {
    const el = mount({
      id: "note",
      type: "annotation",
      position: { x: 0, y: 0 },
      data: { text: "Nota" },
    });
    expect(
      el.shadowRoot?.querySelector<HTMLElement>(".flow-node__note-arrow")?.dataset.dir
    ).toBe("down");
  });

  test("hides the direction arrow when the note is anchored to a node", () => {
    const el = mount({
      id: "note",
      type: "annotation",
      position: { x: 0, y: 0 },
      data: { text: "Nota", arrow: "down", targetNodeId: "n1" },
    });
    expect(el.shadowRoot?.querySelector(".flow-node__note-arrow")).toBeNull();
  });
});

/**
 * A held key is one intention, not forty.
 *
 * Space selected a focused node the way it activates a button — and the canvas
 * uses a held Space as the hand tool. With a result node selected and the
 * preview open, holding it fired `node-select` on every repeat of the keydown,
 * each one re-rendering the panel and the preview. Panning went from a drag to
 * a crawl, and the node kept pulling focus back while someone was trying to
 * look somewhere else.
 */
describe("flow-node: the canvas keeps Space", () => {
  const resultNode = (): FlowNodeData => ({
    id: "r1",
    type: "result",
    position: { x: 0, y: 0 },
    data: { title: { sv: "Du kan söka" } },
  });

  function pressOn(el: FlowNode, init: KeyboardEventInit): string[] {
    const selected: string[] = [];

    el.addEventListener("node-select", (event) => {
      selected.push((event as CustomEvent<{ nodeId: string }>).detail.nodeId);
    });

    el.shadowRoot
      ?.querySelector<HTMLElement>(".flow-node")
      ?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));

    return selected;
  }

  test("Space on a focused node selects nothing", () => {
    expect(pressOn(mount(resultNode()), { key: " ", code: "Space" })).toEqual([]);
  });

  // The storm, and the reason the pan crawled: one press, forty selections.
  test("and a held Space stays silent through every repeat", () => {
    const el = mount(resultNode());
    const selected: string[] = [];

    el.addEventListener("node-select", (event) => {
      selected.push((event as CustomEvent<{ nodeId: string }>).detail.nodeId);
    });

    const target = el.shadowRoot?.querySelector<HTMLElement>(".flow-node");

    for (let press = 0; press < 20; press += 1) {
      target?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: " ",
          code: "Space",
          repeat: press > 0,
          bubbles: true,
        }),
      );
    }

    expect(selected).toEqual([]);
  });

  // What a node keeps, so the keyboard path is not simply removed.
  test("Enter still selects it", () => {
    expect(pressOn(mount(resultNode()), { key: "Enter" })).toEqual(["r1"]);
  });

  test("and a held Enter selects it once, not once per repeat", () => {
    const el = mount(resultNode());
    const selected: string[] = [];

    el.addEventListener("node-select", (event) => {
      selected.push((event as CustomEvent<{ nodeId: string }>).detail.nodeId);
    });

    const target = el.shadowRoot?.querySelector<HTMLElement>(".flow-node");

    for (let press = 0; press < 5; press += 1) {
      target?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          repeat: press > 0,
          bubbles: true,
        }),
      );
    }

    expect(selected).toEqual(["r1"]);
  });
});

describe("flow-node: every content type wears the content colour", () => {
  /*
   * The header colour was an enumeration — four question types — and every
   * type outside it fell back to `--fw-text` as background with white text
   * on top: unreadable in dark mode. Johan found it on the map question,
   * but multi-choice and the lookups had the same header all along. Content
   * is the default; logic, endings and notes are the exceptions.
   */
  test("a map question's header matches a plain question's", () => {
    const question = mount({
      id: "q",
      type: "question",
      position: { x: 0, y: 0 },
      data: { title: "Fråga" },
    });
    const mapQuestion = mount({
      id: "m",
      type: "map-question",
      position: { x: 0, y: 0 },
      data: { title: "Var?" },
    });
    const multiChoice = mount({
      id: "mc",
      type: "multi-choice",
      position: { x: 0, y: 0 },
      data: { title: "Vilka?" },
    });

    const headerBg = (el: FlowNode): string =>
      getComputedStyle(el.shadowRoot!.querySelector(".flow-node__header")!).backgroundColor;

    expect(headerBg(mapQuestion)).toBe(headerBg(question));
    expect(headerBg(multiChoice)).toBe(headerBg(question));
  });
});

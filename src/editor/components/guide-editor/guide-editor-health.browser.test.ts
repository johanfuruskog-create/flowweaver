import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

/** One question with two answers that both lead on. Every test breaks one thing. */
function graf(): GraphData {
  return {
    startNodeId: "q1",
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: "Är du folkbokförd?",
          variableName: "folkbokford",
          options: [
            { id: "ja", label: "Ja", value: "ja" },
            { id: "nej", label: "Nej", value: "nej" },
          ],
        },
      },
      { id: "r1", type: "result", position: { x: 300, y: 0 }, data: { title: "Ja-svar" } },
      { id: "r2", type: "result", position: { x: 300, y: 200 }, data: { title: "Nej-svar" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "r1", portId: "input" } },
      { id: "c2", from: { nodeId: "q1", portId: "nej" }, to: { nodeId: "r2", portId: "input" } },
    ],
  };
}

function montera(data: GraphData): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = data;
  return editor;
}

function del<T extends HTMLElement>(editor: GuideEditor, selektor: string): T {
  const element = editor.shadowRoot?.querySelector<T>(selektor);

  if (!element) {
    throw new Error(`Hittade inte ${selektor}.`);
  }

  return element;
}

const counter = (editor: GuideEditor): string =>
  del(editor, "[data-health-count]").textContent?.trim() ?? "";

const knapp = (editor: GuideEditor): HTMLButtonElement =>
  del<HTMLButtonElement>(editor, "[data-health-toggle]");

const lista = (editor: GuideEditor): HTMLElement =>
  del(editor, "[data-health-list]");

describe("kontrollraden", () => {
  test("a sound guide says it is sound", () => {
    const editor = montera(graf());

    expect(counter(editor)).toBe("Inga problem");
    expect(del(editor, "[data-health]").dataset.severity).toBe("clean");
  });

  // Criterion 8: a guide without problems says so, rather than showing an empty
  // list.
  test("the sound guide explains itself when the list is opened", () => {
    const editor = montera(graf());

    knapp(editor).click();

    expect(lista(editor).hidden).toBe(false);
    expect(lista(editor).textContent).toContain("leder vidare");
  });

  // Removing the connection gives two problems, not one: the answer leads
  // nowhere *and* the result becomes unreachable. The checks overlap
  // deliberately — the same change hits both whoever clicks and the work that
  // goes unused.
  test("an answer that leads nowhere counts as an error", () => {
    const data = graf();
    data.connections = data.connections.filter((c) => c.id !== "c2");
    const editor = montera(data);

    expect(counter(editor)).toContain("1 fel");
    expect(del(editor, "[data-health]").dataset.severity).toBe("error");
  });

  test("an unreachable result counts as a warning", () => {
    const data = graf();
    data.nodes.push({
      id: "r3",
      type: "result",
      position: { x: 600, y: 400 },
      data: { title: "Bortglömt" },
    });
    const editor = montera(data);

    expect(counter(editor)).toBe("1 varning");
    expect(del(editor, "[data-health]").dataset.severity).toBe("warning");
  });

  // Errors outweigh warnings in the summary: errors are what a resident walks
  // into.
  test("errors and warnings are counted separately", () => {
    const data = graf();
    data.connections = data.connections.filter((c) => c.id !== "c2");
    data.nodes.push({
      id: "r3",
      type: "result",
      position: { x: 600, y: 400 },
      data: { title: "Bortglömt" },
    });
    const editor = montera(data);

    expect(counter(editor)).toContain("1 fel");
    expect(counter(editor)).toContain("varning");
    expect(del(editor, "[data-health]").dataset.severity).toBe("error");
  });

  test("the list names the problem and which node it concerns", () => {
    const data = graf();
    data.connections = data.connections.filter((c) => c.id !== "c2");
    const editor = montera(data);

    knapp(editor).click();

    const rad = del<HTMLButtonElement>(editor, "[data-health-node]");

    expect(rad.dataset.healthNode).toBe("q1");
    expect(rad.textContent).toContain("Nej");
    expect(rad.textContent).toContain("Fel");
  });

  test("ett klick i listan markerar noden", () => {
    const data = graf();
    data.connections = data.connections.filter((c) => c.id !== "c2");
    const editor = montera(data);

    knapp(editor).click();
    del<HTMLButtonElement>(editor, "[data-health-node]").click();

    const markerad = editor.shadowRoot
      ?.querySelector("node-editor")
      ?.shadowRoot?.querySelector("flow-node[data-selected], flow-node")
      ?.shadowRoot?.querySelector(".flow-node[data-selected]");

    expect(markerad).toBeTruthy();
  });

  // The point of step 11: a guide that has stopped working should speak up when
  // it is opened, not when someone clicks their way to the problem.
  test("the count updates when the graph changes", () => {
    const editor = montera(graf());

    expect(counter(editor)).toBe("Inga problem");

    const trasig = graf();
    trasig.connections = trasig.connections.filter((c) => c.id !== "c2");
    editor.graph = trasig;

    expect(counter(editor)).toContain("1 fel");
  });

  test("the list is closed until you open it", () => {
    const editor = montera(graf());

    expect(lista(editor).hidden).toBe(true);
    expect(knapp(editor).getAttribute("aria-expanded")).toBe("false");

    knapp(editor).click();

    expect(lista(editor).hidden).toBe(false);
    expect(knapp(editor).getAttribute("aria-expanded")).toBe("true");
  });

  // Bedömningen 3/9: the list closed only through its own button and lay
  // open over the canvas until you found your way back to it.
  test("Escape stänger listan och lämnar fokus på knappen", () => {
    const editor = montera(graf());

    knapp(editor).click();
    lista(editor).querySelector<HTMLButtonElement>("button")?.focus();
    lista(editor).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));

    expect(lista(editor).hidden).toBe(true);
    expect(knapp(editor).getAttribute("aria-expanded")).toBe("false");
    expect(editor.shadowRoot!.activeElement).toBe(knapp(editor));
  });

  test("ett klick utanför stänger listan", () => {
    const editor = montera(graf());

    knapp(editor).click();
    del(editor, "node-editor").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));

    expect(lista(editor).hidden).toBe(true);
    expect(knapp(editor).getAttribute("aria-expanded")).toBe("false");
  });

  // The messages carry the editor's own titles and are written with innerHTML.
  test("en rubrik med markup skrivs ut som text", () => {
    const data = graf();
    data.nodes[0].data.title = "<img src=x onerror=alert(1)>";
    data.connections = [];
    const editor = montera(data);

    knapp(editor).click();

    expect(lista(editor).querySelector("img")).toBeNull();
    expect(lista(editor).textContent).toContain("<img");
  });
});

describe("the list and the canvas toolbar (Ted 24/9, measured on main)", () => {
  /*
   * The zoom field sits bottom right beside the minimap since 23/9, the
   * health list opens bottom left — on a narrow canvas they overlap, and the
   * field was drawn on top of the message the person had just asked to read.
   * The list is the thing asked for; while it is open it wins. Measured with
   * elementFromPoint at a point inside both, not with z-index numbers.
   */
  test("an open list is drawn above the zoom field where they overlap", async () => {
    const wide: GraphData = {
      startNodeId: "n0",
      nodes: Array.from({ length: 8 }, (_, i) => ({
        id: `n${i}`,
        type: "question",
        position: { x: i * 420, y: (i % 2) * 200 },
        data: { title: `Nod ${i}`, variableName: "samma", options: [{ id: "a", label: "A", value: "a" }] },
      })),
      connections: Array.from({ length: 7 }, (_, i) => ({
        id: `c${i}`,
        from: { nodeId: `n${i}`, portId: "a" },
        to: { nodeId: `n${i + 1}`, portId: "input" },
      })),
    } as unknown as GraphData;
    const editor = montera(wide);

    editor.style.cssText = "display:block;width:700px;height:420px;";
    await new Promise((r) => setTimeout(r, 300));

    knapp(editor).click();
    await new Promise((r) => setTimeout(r, 200));

    const toolbar = editor
      .shadowRoot!.querySelector("node-editor")!
      .shadowRoot!.querySelector<HTMLElement>("[data-canvas-toolbar]")!
      .getBoundingClientRect();
    const list = lista(editor).getBoundingClientRect();
    const x = (Math.max(toolbar.left, list.left) + Math.min(toolbar.right, list.right)) / 2;
    const y = (Math.max(toolbar.top, list.top) + Math.min(toolbar.bottom, list.bottom)) / 2;

    expect(
      toolbar.left < list.right && list.left < toolbar.right && toolbar.top < list.bottom && list.top < toolbar.bottom,
      "de överlappar inte i den här storleken — mätningen mäter inget",
    ).toBe(true);

    const hit = editor.shadowRoot!.elementFromPoint(x, y);

    expect(hit?.closest("[data-health-list]"), `träffade <${hit?.tagName.toLowerCase()}>`).not.toBeNull();
  });
});

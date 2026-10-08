import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import type { FlowNode } from "./flow-node";
import type { FlowNodeData } from "../../../viewer/types/graph";

/**
 * A node on the canvas shows the guide's text the way that language is read.
 *
 * The properties panel has set `dir` on a translated field since story 009. The
 * node beside it did not, so a translator working in Arabic read their own
 * words left-to-right on the surface they spend the most time looking at.
 *
 * It goes on the content, not on the card. A node has two languages side by
 * side: the header names the node *type*, which is the tool's word and follows
 * `editor-locale`, and everything below is the guide's. Turning the whole card
 * would turn the tool's word with it.
 *
 * Mirroring the canvas itself is a different question and deliberately not this
 * one. The canvas is the tool's surface, the tool exists in Swedish and English,
 * and letting the *content* decide how the tool is laid out is the coupling
 * stories 014 and 017 removed. It waits for someone who reads right-to-left to
 * say whether they want it.
 */

const arabic = (): FlowNodeData =>
  ({
    id: "q",
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      title: { sv: "Bor du i kommunen?", ar: "هل تسكن في البلدية؟" },
      options: [{ id: "y", label: { sv: "Ja", ar: "نعم" }, value: "y" }],
    },
  }) as unknown as FlowNodeData;

function mount(locale: string): FlowNode {
  const node = document.createElement("flow-node") as FlowNode;
  document.body.append(node);
  node.editorLocale = "sv";
  (node as unknown as { activeLocale: string }).activeLocale = locale;
  node.nodeData = arabic();
  return node;
}

afterEach(() => document.body.replaceChildren());

describe("a node showing a right-to-left language", () => {
  test("reads right-to-left", () => {
    const content = mount("ar").shadowRoot?.querySelector(".flow-node__content");

    if (!content) {
      throw new Error("flow-node rendered no content");
    }
    expect({
      dir: content.getAttribute("dir"),
      lang: content.getAttribute("lang"),
      computed: getComputedStyle(content).direction,
    }).toEqual({ dir: "rtl", lang: "ar", computed: "rtl" });
  });

  // The header is the node type's name — the tool's word, in the tool's
  // language. It must not turn with the content.
  test("but the type name does not turn with it", () => {
    const header = mount("ar").shadowRoot?.querySelector(".flow-node__header");

    expect({
      dir: header?.getAttribute("dir") ?? null,
      computed: header ? getComputedStyle(header).direction : "-",
    }).toEqual({ dir: null, computed: "ltr" });
  });

  test("a left-to-right language is left alone", () => {
    const content = mount("sv").shadowRoot?.querySelector(".flow-node__content");

    expect({
      dir: content?.getAttribute("dir") ?? null,
      computed: content ? getComputedStyle(content).direction : "-",
    }).toEqual({ dir: null, computed: "ltr" });
  });

  // Without this the pair above could pass on a node that rendered nothing.
  test("and the Arabic text is actually there", () => {
    const text = mount("ar").shadowRoot?.textContent ?? "";

    expect(text).toContain("هل تسكن في البلدية؟");
  });
});

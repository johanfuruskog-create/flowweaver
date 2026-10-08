import { afterEach, describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";
import "../components/flow-node/flow-node";
import "../components/node-palette/node-palette";
import "../components/properties-panel/properties-panel";

import { getNodeTypes } from "../../viewer/node-types/node-type-registry";
import { displayNodeTypeLabel } from "../services/template-library";

import type { FlowNode } from "../components/flow-node/flow-node";
import type { NodePalette } from "../components/node-palette/node-palette";
import type { FlowNodeData } from "../../viewer/types/graph";

/**
 * A node type is called the same thing everywhere the editor names it.
 *
 * ## The fault
 *
 * `nodeType.question.label` has said `{ sv: "Fråga", en: "Question" }` since
 * story 016. The palette looked it up; the node on the canvas did not, and fell
 * through to the registry's own `label`, which is a plain Swedish string.
 *
 * So an editor set to English showed "Question" in the palette and "Fråga" in
 * the header of the node you had just dragged out of it. The properties panel
 * agreed with the node, and its heading also dropped the locale on the way to
 * the template's name.
 *
 * Four places wrote out the same expression and two of them got it right, which
 * is why there is a helper now: a helper is harder to half-apply than a line
 * you retype.
 *
 * ## What this measures
 *
 * Every registered type, in both languages, in the two components a person
 * reads a type name from. Not "the helper works" — that would pass while the
 * canvas kept its own copy.
 */

afterEach(() => document.body.replaceChildren());

function nodeOfType(type: string): FlowNodeData {
  return {
    id: `n-${type}`,
    type,
    position: { x: 0, y: 0 },
    data: { title: { sv: "Rubrik", en: "Heading" } },
  } as unknown as FlowNodeData;
}

/** The type name as the node on the canvas renders it. */
function headerLabel(type: string, locale: string): string {
  const node = document.createElement("flow-node") as FlowNode;
  document.body.append(node);
  node.editorLocale = locale;
  node.nodeData = nodeOfType(type);

  const header = node.shadowRoot?.querySelector(".flow-node__header-text");
  if (!header) {
    throw new Error(`flow-node rendered no header for ${type}`);
  }
  return (header.textContent ?? "").replace(/\s+/g, " ").trim();
}

/*
 * The registry's own label is the fallback, as it is in every component: `tOr`
 * returns the fallback for the source language on purpose, so passing nothing
 * would compare against the bare type id.
 */
const TYPES = getNodeTypes().map((entry) => ({
  type: entry.type,
  label: entry.definition.label,
}));

function expectedLabel(entry: { type: string; label: string }, locale: string): string {
  return displayNodeTypeLabel(entry.type, entry.label, locale);
}

describe("the name of a node type", () => {
  test("there are types to check, so an empty sweep cannot pass", () => {
    expect(TYPES.length).toBeGreaterThan(10);
  });

  test.each(TYPES)("$type: the canvas agrees with the table in Swedish", (entry) => {
    expect(headerLabel(entry.type, "sv")).toContain(expectedLabel(entry, "sv"));
  });

  test.each(TYPES)("$type: and in English", (entry) => {
    expect(headerLabel(entry.type, "en")).toContain(expectedLabel(entry, "en"));
  });

  /*
   * The one that would have caught it: the two surfaces side by side. A type
   * whose English is missing reads the same in both, which is fine — what must
   * never happen is one of them translating while the other does not.
   */
  test("the palette and the canvas never disagree", () => {
    const palette = document.createElement("node-palette") as NodePalette;
    document.body.append(palette);
    palette.editorLocale = "en";

    const paletteText = palette.shadowRoot?.textContent ?? "";
    const disagreements = TYPES.filter((entry) => {
      const english = expectedLabel(entry, "en");
      if (english === expectedLabel(entry, "sv")) return false;
      // The palette shows it, so the canvas must show the same word.
      return (
        paletteText.includes(english) && !headerLabel(entry.type, "en").includes(english)
      );
    }).map((entry) => entry.type);

    expect(disagreements).toEqual([]);
  });
});

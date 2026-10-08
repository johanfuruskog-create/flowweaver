import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";
import {
  fokusbrott,
  fokusstopp,
  ordningsbrott,
  positivaTabindex,
} from "../../../testing/keyboard";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The keyboard in what the resident meets.
 *
 * **K3** promises that nothing requires a pointer. That promise covers not only
 * that the elements *can* be reached, but that the order follows the reading
 * order and that you can see where you are.
 *
 * Measured with real key presses: `element.focus()` gives focus but not always
 * `:focus-visible`, and that is what decides whether an indicator is drawn.
 */

function graf(): GraphData {
  return {
    startNodeId: "sida",
    nodes: [
      {
        id: "sida",
        type: "page",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Dina uppgifter" }, description: { sv: "Fyll i fälten." } },
      },
      {
        id: "namn",
        type: "text-question",
        parentPageId: "sida",
        order: 0,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Namn" }, variableName: "namn", required: true },
      },
      {
        id: "epost",
        type: "text-question",
        parentPageId: "sida",
        order: 1,
        position: { x: 0, y: 0 },
        data: { title: { sv: "E-post" }, variableName: "epost", format: "email" },
      },
      {
        id: "kommun",
        type: "question",
        parentPageId: "sida",
        order: 2,
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Bor du i kommunen?" },
          variableName: "bor",
          options: [
            { id: "ja", label: { sv: "Ja" }, value: "ja" },
            { id: "nej", label: { sv: "Nej" }, value: "nej" },
          ],
        },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "sida", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

function montera(): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = graf();
  return preview;
}

describe("tangentbordet i visaren", () => {
  test("varje stopp syns och visar att det har fokus", async () => {
    const preview = montera();

    expect(fokusbrott(await fokusstopp(preview))).toEqual([]);
  });

  // A field you tab to before the one you see above it is a trap: you think
  // you missed something.
  test("the order follows the reading order", async () => {
    const preview = montera();

    expect(ordningsbrott(await fokusstopp(preview))).toEqual([]);
  });

  test("everything on the page can be reached", async () => {
    const preview = montera();
    const stopp = await fokusstopp(preview);

    // Två textfält, en radiogrupp (ett stopp) och en knapp framåt.
    expect(stopp.length).toBeGreaterThanOrEqual(4);
  });

  // Positive values move elements out of the document's order and make the
  // rest of the page impossible to reason about.
  test("inga positiva tabindex", () => {
    expect(positivaTabindex(montera().shadowRoot!)).toEqual([]);
  });

  test("a validation error does not change the order", async () => {
    const preview = montera();
    preview.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-action="next"]')
      ?.click();

    const stopp = await fokusstopp(preview);

    expect(fokusbrott(stopp)).toEqual([]);
    expect(ordningsbrott(stopp)).toEqual([]);
  });
});

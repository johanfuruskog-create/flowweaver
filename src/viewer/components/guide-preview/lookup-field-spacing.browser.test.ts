import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * A search field on a page keeps the page's rhythm: the next field's label
 * begins `--fw-space-4` (16 px) under the box, as it does under a text field
 * (GRAFISK-PROFIL, Fältgrupp: *→ nästa fältgrupp 16 i visaren*).
 *
 * Measured 1/10 (Fia, review of B4–B6, skadeanmälans första sida): 20 under
 * the search box, 16 under a text field. The picker's count line said
 * nothing but kept its 4 px margin under the box.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 120));

const graph = {
  startNodeId: "p",
  nodes: [
    { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Din försäkring" } } },
    {
      id: "policy", type: "autocomplete-question", parentPageId: "p", order: 0, position: { x: 0, y: 0 },
      data: {
        title: { sv: "Försäkringsnummer" }, variableName: "forsakring", source: "mock", minChars: 1,
        allowFreeText: false, mockItems: [{ value: "NF-1", label: { sv: "NF-1 Hem" } }],
      },
    },
    { id: "name", type: "text-question", parentPageId: "p", order: 1, position: { x: 0, y: 0 }, data: { title: { sv: "Namn" }, variableName: "namn" } },
    { id: "mail", type: "text-question", parentPageId: "p", order: 2, position: { x: 0, y: 0 }, data: { title: { sv: "E-post" }, variableName: "epost" } },
    { id: "end", type: "result", position: { x: 600, y: 0 }, data: { title: { sv: "Klart" } } },
  ],
  connections: [{ id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "end", portId: "input" } }],
};

describe("sökfältet på en sida", () => {
  test("nästa fält börjar 16 px under rutan, som under ett textfält", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    preview.style.cssText = "display:block;width:640px;";
    document.body.append(preview);
    preview.graph = graph as unknown as GraphData;
    await settle();
    const root = preview.shadowRoot!;
    const box = root.querySelector("chip-picker")!.shadowRoot!.querySelector(".chip-picker__box")!.getBoundingClientRect();
    const label = (id: string) => root.querySelector(`[data-page-field-id="${id}"] label`)!.getBoundingClientRect();
    const nameInput = root.querySelector(`[data-page-field-id="name"] input`)!.getBoundingClientRect();

    expect(Math.round(label("mail").top - nameInput.bottom), "under ett textfält").toBe(16);
    expect(Math.round(label("name").top - box.bottom), "under sökrutan").toBe(16);
  });
});

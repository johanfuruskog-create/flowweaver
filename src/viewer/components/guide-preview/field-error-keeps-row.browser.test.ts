import { afterEach, describe, expect, test } from "vitest";
import "../../node-types/default-node-types";
import "./guide-preview";
import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/*
 * Ett fel under ett fält får inte flytta grannen.
 *
 * Johan vid 087:s bilder (4/9): *"valideringen skjuter upp det högra fältet.
 * Fältet borde ligga kvar och valideringstexten flödar nedåt."* Mätt: två
 * halvbreda datumfält på en rad, felet under det högra gjorde raden högre,
 * och det vänstra fältets egen grid delade ut höjden mellan etikett och ruta
 * — rutan hamnade 37 px längre ned än grannens. Fältet ska packa sitt
 * innehåll upptill; det som växer flödar nedåt.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function graph(): GraphData {
  return {
    startNodeId: "period",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "period", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Period" } } },
      { id: "fran", type: "date-question", parentPageId: "period", order: 1, position: { x: 0, y: 0 }, layout: { columnSpan: 6 },
        data: { title: { sv: "Från" }, variableName: "fran" } },
      { id: "till", type: "date-question", parentPageId: "period", order: 2, position: { x: 0, y: 0 }, layout: { columnSpan: 6 },
        data: { title: { sv: "Till" }, variableName: "till", min: "{{fran}}" } },
      { id: "r", type: "result", position: { x: 200, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "period", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;
}

const input = (root: ShadowRoot, key: string) => root.querySelector<HTMLInputElement>(`[data-page-field-id="${key}"] input`)!;
/** Rutans överkant räknat från kortet — fokus på felet rullar dokumentet
    ett par pixlar, och det är inte det som mäts här. */
const topOf = (root: ShadowRoot, key: string): number =>
  input(root, key).getBoundingClientRect().top - root.querySelector(".guide-preview__card")!.getBoundingClientRect().top;

describe("ett fältfel flyttar inte grannen på raden", () => {
  test("rutorna står på samma höjd när det högra fältet har ett fel", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    preview.style.width = "900px";
    document.body.append(preview);
    preview.graph = graph();
    await settle();
    const root = preview.shadowRoot!;

    const before = topOf(root, "fran");
    expect(before).toBe(topOf(root, "till"));

    input(root, "fran").value = "2026-03-10";
    input(root, "till").value = "2026-03-01";
    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    expect(root.querySelector('[data-page-field-id="till"] .guide-preview__field-error')).toBeTruthy();
    // Samma rad — sida vid sida, inte staplade.
    expect(input(root, "fran").getBoundingClientRect().left).toBeLessThan(input(root, "till").getBoundingClientRect().left);
    expect(topOf(root, "fran")).toBe(topOf(root, "till"));
    expect(topOf(root, "fran")).toBeCloseTo(before, 1);
  });
});

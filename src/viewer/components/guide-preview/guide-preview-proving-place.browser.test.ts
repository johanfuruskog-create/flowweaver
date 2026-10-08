import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";
// Some of these run the viewer as the editor does — `editor-view`, `proving` —
// and read the editor's words on the canvas. Those load with the editor's
// lookup, never with the viewer (entries.test.ts).
import "../../../editor/localization/editor-ui-strings";

import {
  registerMapProvider,
  unregisterMapProvider,
} from "../../core/map-provider-registry";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Provplatsen — story 065:s uppföljning, andra halvan.
 *
 * Ett obligatoriskt kartsteg går inte att lämna utan ett svar: mätt 1/9 är
 * Nästa avstängd tills fältet bär en etikett. Utan värdkarta finns inte ens
 * något att peka på, bara golvet där platsen skrivs i ord — och en redaktör
 * som provar ett flöde ska slippa hitta på en adress för att komma vidare.
 *
 * I provet står därför en knapp: ett tryck lägger in provplatsen, och den
 * tecknade provkartan visas där värdens karta skulle ha varit. Att peka
 * själv — eller att skriva — byter ut den.
 */

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const POINT = {
  geometry: { type: "Point", coordinates: [17.6, 59.85] as unknown },
  label: "Storgatan 1",
};

const mapGraph = (data: Record<string, unknown>): GraphData => ({
  startNodeId: "s",
  nodes: [
    {
      id: "s",
      type: "map-question",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Var är felet?" },
        variableName: "plats",
        kind: "point",
        required: true,
        ...data,
      },
    },
    { id: "g", type: "review", position: { x: 0, y: 0 }, data: { title: { sv: "Granska" } } },
    { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "s", portId: "continue" }, to: { nodeId: "g", portId: "input" } },
    { id: "c2", from: { nodeId: "g", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
  ],
});

async function mounted(
  data: Record<string, unknown> = {},
  attributes: string[] = ["proving"],
): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  attributes.forEach((name) => preview.setAttribute(name, ""));
  document.body.append(preview);
  preview.graph = mapGraph(data);
  await settle();
  return preview;
}

const shadow = (preview: GuidePreview): ShadowRoot => preview.shadowRoot as ShadowRoot;
const next = (root: ShadowRoot): HTMLButtonElement | null =>
  root.querySelector<HTMLButtonElement>('[data-action="next"]');

afterEach(() => {
  document.body.replaceChildren();
  unregisterMapProvider();
});

describe("provplatsen i provet", () => {
  test("utan att peka svarar Nästa med att stå kvar — aldrig avstängd (069)", async () => {
    const preview = await mounted();
    const root = shadow(preview);

    expect(next(root)?.disabled).toBe(false);

    next(root)?.click();
    await settle();

    expect(preview.getCurrentNodeId()).toBe("s");
    expect(preview.getAnswers()).toEqual({});
  });

  test("knappen lägger in provplatsen och steget går att lämna", async () => {
    const preview = await mounted();
    const root = shadow(preview);
    const button = root.querySelector<HTMLButtonElement>("[data-proving-place]");

    expect(button?.textContent?.trim()).toBe("Peka ut provplats");
    button?.click();
    await settle();

    expect(root.querySelector<HTMLInputElement>("input[data-map-label]")?.value).toBe("Provplats");
    expect(next(root)?.disabled).toBe(false);

    next(root)?.click();
    await settle();

    expect(preview.getCurrentNodeId()).toBe("g");
    expect(preview.getAnswers()).toEqual({
      plats: { label: "Provplats", geo: '{"type":"Point","coordinates":[0,0]}' },
    });
  });

  test("provkartan står där värdens karta skulle ha varit", async () => {
    const preview = await mounted();
    const root = shadow(preview);
    const still = root.querySelector<HTMLImageElement>("[data-proving-map-still]");

    expect(still?.getAttribute("src") ?? "").toContain("image/svg+xml");
    expect(root.querySelector("[data-proving-note]")?.textContent?.trim()).toBe(
      "på låtsas, bara i provet",
    );
  });

  test("en värd med egen karta ritar sin egen stillbild, inte provkartan", async () => {
    registerMapProvider({
      kinds: ["point"],
      pick: async () => POINT,
      snapshot: async () => "data:image/png;base64,iVBORw0KGgo=",
    });

    const preview = await mounted();
    const root = shadow(preview);

    expect(root.querySelector("[data-proving-map-still]")).toBeNull();
    expect(root.querySelector("[data-map-still]")).not.toBeNull();
  });

  test("att peka själv byter ut provplatsen", async () => {
    registerMapProvider({ kinds: ["point"], pick: async () => POINT });

    const preview = await mounted();
    const root = shadow(preview);

    root.querySelector<HTMLButtonElement>("[data-proving-place]")?.click();
    await settle();

    // Först provplatsen — annars provar resten av fallet ingenting.
    expect(root.querySelector<HTMLInputElement>("input[data-map-label]")?.value).toBe("Provplats");

    root.querySelector<HTMLButtonElement>("[data-map-pick]")?.click();
    await settle();

    expect(root.querySelector<HTMLInputElement>("input[data-map-label]")?.value).toBe("Storgatan 1");

    next(root)?.click();
    await settle();

    expect(preview.getAnswers()).toEqual({
      plats: { label: "Storgatan 1", geo: '{"type":"Point","coordinates":[17.6,59.85]}' },
    });
  });

  test("utanför provet finns varken knapp eller provkarta", async () => {
    const preview = await mounted({}, []);
    const root = shadow(preview);

    expect(root.querySelector("[data-proving-place]")).toBeNull();
    expect(root.querySelector("[data-proving-map-still]")).toBeNull();
  });

  test("granskningen läser provplatsen som en plats, och Börja om tar den", async () => {
    const preview = await mounted();
    const root = shadow(preview);

    root.querySelector<HTMLButtonElement>("[data-proving-place]")?.click();
    await settle();
    next(root)?.click();
    await settle();

    expect(
      [...shadow(preview).querySelectorAll("[data-review-row]")]
        .map((row) => row.textContent?.replace(/\s+/g, " ").trim())
        .join(" | "),
    ).toContain("Provplats");

    preview.restart();
    await settle();

    expect(preview.getAnswers()).toEqual({});
    expect(shadow(preview).querySelector<HTMLInputElement>("input[data-map-label]")?.value).toBe("");
  });
});

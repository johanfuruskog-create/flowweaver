import { answerText, readPath } from "../../core/answer-values";
import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import {
  registerMapProvider,
  unregisterMapProvider,
  type MapPickResult,
} from "../../core/map-provider-registry";

import type { GuidePreview } from "./guide-preview";

/**
 * Story 046, v1: the map question against the provider contract.
 *
 * The field never draws geography of its own: the provider answers pick()
 * with GeoJSON and a label, the label lands in a text input the person may
 * edit, the geometry rides as a second variable — the lookup's two-variable
 * pattern — and without a provider only the pointer-free floor shows, with
 * a plain statement. The stills are presentation from snapshot(), never
 * stored.
 */

afterEach(() => {
  document.body.replaceChildren();
  unregisterMapProvider();
});

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const STILL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function fakeProvider(result: MapPickResult | null) {
  return {
    kinds: ["point"] as const,
    pick: async () => result,
    snapshot: async () => STILL,
  };
}

async function mounted(data: Record<string, unknown> = {}): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  document.body.append(preview);
  preview.graph = {
    startNodeId: "m",
    nodes: [
      {
        id: "m",
        type: "map-question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Var är felet?" }, variableName: "plats", kind: "point", ...data },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "m", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;

  await settle();
  await settle();

  return preview;
}

describe("utan leverantör", () => {
  test("visas bara golvet, med besked — och ord räcker som svar", async () => {
    const preview = await mounted();
    const root = preview.shadowRoot!;

    expect(root.querySelector("[data-map-pick]"), "kartknapp utan karta").toBeNull();
    expect(root.textContent).toContain("skriv platsen i ord");

    const input = root.querySelector<HTMLInputElement>("[data-text-answer]")!;

    input.value = "Bakom ICA, vid lastkajen";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    expect(answerText(preview.getAnswers().plats)).toBe("Bakom ICA, vid lastkajen");
    expect(answerText(readPath(preview.getAnswers(), "plats.geo"))).toBe("");
  });
});

describe("med leverantör", () => {
  const point: MapPickResult = {
    geometry: { type: "Point", coordinates: [17.3069, 62.3908] },
    label: "Storgatan 12, Sundsvall",
  };

  test("förbilden visas, valet fyller etikett och geometri, och båda lagras", async () => {
    registerMapProvider(fakeProvider(point));

    const preview = await mounted();
    const root = preview.shadowRoot!;
    const still = root.querySelector<HTMLImageElement>("[data-map-still]");

    expect(still?.src.startsWith("data:image/png"), "förbilden saknas").toBe(true);

    root.querySelector<HTMLButtonElement>("[data-map-pick]")!.click();
    await settle();

    const input = root.querySelector<HTMLInputElement>("[data-text-answer]")!;

    expect(input.value).toBe("Storgatan 12, Sundsvall");
    expect(root.querySelector('[role="status"]')?.textContent).toContain("Storgatan 12");

    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    expect(answerText(preview.getAnswers().plats)).toBe("Storgatan 12, Sundsvall");
    expect(JSON.parse(answerText(readPath(preview.getAnswers(), "plats.geo")))).toEqual({
      type: "Point",
      coordinates: [17.3069, 62.3908],
    });
  });

  test("startvyn följer med som ledtråd till både dialogen och förbilden", async () => {
    const pickCalls: unknown[] = [];
    const snapshotCalls: unknown[] = [];

    registerMapProvider({
      kinds: ["point"] as const,
      pick: async (options) => {
        pickCalls.push(options);
        return point;
      },
      snapshot: async (_geometry, options) => {
        snapshotCalls.push(options);
        return STILL;
      },
    });

    const startView = JSON.stringify({
      geometry: { type: "Point", coordinates: [16.5528, 59.6099] },
      label: "Västerås",
      zoom: 17,
    });
    const preview = await mounted({ startView });
    const root = preview.shadowRoot!;

    root.querySelector<HTMLButtonElement>("[data-map-pick]")!.click();
    await settle();

    expect(pickCalls[0]).toEqual({ kind: "point", near: [16.5528, 59.6099], zoom: 17 });
    expect(snapshotCalls[0]).toEqual({ near: [16.5528, 59.6099], zoom: 17 });
  });

  test("byter man plats får leverantören det redan valda, för justering i stället för omritning", async () => {
    const pickCalls: Array<Record<string, unknown>> = [];

    registerMapProvider({
      kinds: ["point"] as const,
      pick: async (options) => {
        pickCalls.push(options as Record<string, unknown>);
        return point;
      },
    });

    const preview = await mounted();
    const root = preview.shadowRoot!;

    root.querySelector<HTMLButtonElement>("[data-map-pick]")!.click();
    await settle();

    expect(pickCalls[0].current).toBeUndefined();

    // "Ändra plats": nu finns ett svar, och det ska följa med in i dialogen.
    root.querySelector<HTMLButtonElement>("[data-map-pick]")!.click();
    await settle();

    expect(pickCalls[1].current).toEqual({ type: "Point", coordinates: [17.3069, 62.3908] });
  });

  test("ett avvisat svar lämnar fältet orört — hellre inget än fel geografi", async () => {
    registerMapProvider(
      fakeProvider({ geometry: { type: "Polygon", coordinates: [] }, label: "Fel sort" }),
    );

    const preview = await mounted();
    const root = preview.shadowRoot!;

    root.querySelector<HTMLButtonElement>("[data-map-pick]")!.click();
    await settle();

    expect(root.querySelector<HTMLInputElement>("[data-text-answer]")!.value).toBe("");
  });

  test("ett område lagras som Polygon, och etiketten faller tillbaka på första hörnet", async () => {
    registerMapProvider({
      kinds: ["area"] as const,
      pick: async () => ({
        geometry: {
          type: "Polygon",
          coordinates: [[[17.3, 62.39], [17.31, 62.39], [17.31, 62.4], [17.3, 62.39]]],
        },
        // Ingen etikett: fältet ska ändå visa något läsbart, inte stå tomt.
        label: "",
      }),
    });

    const preview = await mounted({ kind: "area" });
    const root = preview.shadowRoot!;

    root.querySelector<HTMLButtonElement>("[data-map-pick]")!.click();
    await settle();

    const input = root.querySelector<HTMLInputElement>("[data-text-answer]")!;

    expect(input.value).toBe("62.39000, 17.30000");

    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    expect(JSON.parse(answerText(readPath(preview.getAnswers(), "plats.geo"))).type).toBe("Polygon");
  });

  test("en sort leverantören saknar visar bara golvet", async () => {
    registerMapProvider(fakeProvider(point));

    const preview = await mounted({ kind: "area" });

    expect(preview.shadowRoot!.querySelector("[data-map-pick]")).toBeNull();
  });

  test("obligatoriskt utan svar stoppas med besked", async () => {
    registerMapProvider(fakeProvider(point));

    const preview = await mounted({ required: true });
    const root = preview.shadowRoot!;

    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    expect(root.querySelector('[data-node-type="map-question"]'), "gick vidare ändå").not.toBeNull();
  });
});

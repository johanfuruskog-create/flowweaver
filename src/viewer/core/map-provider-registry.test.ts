import { afterEach, describe, expect, test } from "vitest";

import {
  acceptPickResult,
  getMapProvider,
  registerMapProvider,
  unregisterMapProvider,
} from "./map-provider-registry";

/**
 * Story 046: the map provider is something a host registers — like a code
 * list, like a format pack. The registry itself is small; the part worth
 * guarding is `acceptPickResult`, which is the contract's rejection rules
 * (`docs/KART-KONTRAKT.md`) as code: a result that is not valid GeoJSON of
 * the ordered kind is treated as a cancel, never as an answer.
 */

afterEach(() => unregisterMapProvider());

const provider = {
  kinds: ["point" as const],
  pick: async () => null,
};

describe("registret", () => {
  test("en registrerad leverantör går att hämta, och en avregistrerad är borta", () => {
    expect(getMapProvider()).toBeNull();
    registerMapProvider(provider);
    expect(getMapProvider()).toBe(provider);
    unregisterMapProvider();
    expect(getMapProvider()).toBeNull();
  });
});

describe("kontraktets avvisningsregler", () => {
  const point = { type: "Point", coordinates: [17.3069, 62.3908] };

  test("ett giltigt punktsvar tas emot, med eller utan etikett", () => {
    expect(acceptPickResult({ geometry: point, label: "Storgatan 12" }, "point")).toEqual({
      geometry: point,
      label: "Storgatan 12",
    });
    expect(acceptPickResult({ geometry: point, label: "" }, "point")).toEqual({
      geometry: point,
      label: "",
    });
  });

  test("fel sort, trasig GeoJSON och oändliga koordinater avvisas som avbrutet", () => {
    expect(acceptPickResult(null, "point")).toBeNull();
    expect(acceptPickResult({ geometry: { type: "Polygon", coordinates: [] }, label: "" }, "point")).toBeNull();
    expect(acceptPickResult({ geometry: { type: "Point", coordinates: [1] }, label: "" }, "point")).toBeNull();
    expect(
      acceptPickResult({ geometry: { type: "Point", coordinates: [Number.NaN, 62] }, label: "" }, "point"),
    ).toBeNull();
    expect(acceptPickResult({ geometry: { type: "Point", coordinates: ["17", "62"] }, label: "" }, "point")).toBeNull();
  });
});

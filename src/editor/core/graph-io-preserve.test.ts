import { describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";
import { importGraphJson, exportGraphJson } from "./graph-io";
import { CURRENT_GRAPH_VERSION } from "../../viewer/core/graph-migrations";

/**
 * Import used to read only what it recognised and drop the rest silently. A host
 * platform that put something in the guide had it erased the first time the
 * editor opened and saved — without notice. See K6b in `docs/KRAV.md`.
 */
function graf(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 3,
    startNodeId: "q1",
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: "Fråga",
          variableName: "a",
          options: [{ id: "o", label: "Ja", value: "ja" }],
        },
      },
    ],
    connections: [],
    ...extra,
  });
}

/** Runs a file through import and export and returns the JSON as an object. */
function rundtur(json: string): Record<string, unknown> {
  const inn = importGraphJson(json);

  if (!inn.success) {
    throw new Error(`Importen misslyckades: ${inn.errors.join(", ")}`);
  }

  const ut = exportGraphJson(inn.graph);

  if (!ut.success) {
    throw new Error(`Exporten misslyckades: ${ut.errors.join(", ")}`);
  }

  return JSON.parse(ut.json) as Record<string, unknown>;
}

describe("unknown fields survive a round trip", () => {
  test("a root key the library does not recognise", () => {
    const ut = rundtur(graf({ ansvarig: "kontakt@exempel.se" }));

    expect(ut.ansvarig).toBe("kontakt@exempel.se");
  });

  test("a nested object keeps its contents", () => {
    const ut = rundtur(graf({ vardsystem: { modulId: "abc-123", sidId: 42 } }));

    expect(ut.vardsystem).toEqual({ modulId: "abc-123", sidId: 42 });
  });

  test("an unknown key inside settings", () => {
    const ut = rundtur(
      graf({ settings: { locales: ["sv"], vardData: { sidId: 42 } } }),
    );

    expect(ut.settings).toEqual({
      locales: ["sv"],
      vardData: { sidId: 42 },
    });
  });

  // `extra` is the library's internal carrier. If it shows up in the file it has
  // become a field in the contract without anyone deciding so.
  test("the carrier field does not leak into the JSON", () => {
    const ut = rundtur(
      graf({ ansvarig: "x", settings: { locales: ["sv"], egen: 1 } }),
    );

    expect("extra" in ut).toBe(false);
    expect("extra" in (ut.settings as Record<string, unknown>)).toBe(false);
  });

  test("known fields are unaffected", () => {
    const ut = rundtur(graf({ ansvarig: "x" }));

    expect(ut.startNodeId).toBe("q1");
    expect(Array.isArray(ut.nodes)).toBe(true);
    expect(ut.version).toBe(CURRENT_GRAPH_VERSION);
  });

  test("a guide without unknown fields gets no carrier field", () => {
    const ut = rundtur(graf());

    expect("extra" in ut).toBe(false);
  });
});

describe("the submission schema travels with the guide", () => {
  // Story 094: the schema is embedded under `meta.submissionSchema` so the
  // version a receiver reads is always the version of the guide it came with.
  const schema = { exportedAt: "2026-09-05T10:00:00.000Z", properties: { namn: { type: "string", label: { sv: "Namn" } } } };

  test("it comes back out as it went in", () => {
    const ut = rundtur(graf({ meta: { name: "Guiden", submissionSchema: schema } }));

    expect((ut.meta as Record<string, unknown>).submissionSchema).toEqual(schema);
  });

  test("something that is not a schema is dropped, not carried", () => {
    const ut = rundtur(graf({ meta: { name: "Guiden", submissionSchema: "nej" } }));

    expect("submissionSchema" in (ut.meta as Record<string, unknown>)).toBe(false);
  });
});

/**
 * Story 116 — mätaren i `settings.progress`.
 *
 * Frånvaron betyder stegmärkningen, alltså skrivs inget `false`: en fil som
 * aldrig haft nyckeln kommer ut utan den (K7). Samma behandling som ett
 * oläsbart `sourceLocale` — `settings.extra` är för nycklar vi inte känner
 * igen, inte för värden.
 */
describe("mätaren reser med guiden", () => {
  const settings = (ut: Record<string, unknown>) =>
    ut.settings as Record<string, unknown> | undefined;
  const carries = (ut: Record<string, unknown>) =>
    settings(ut) !== undefined && "progress" in settings(ut)!;

  test("påslagen kommer ut som den gick in", () => {
    expect(settings(rundtur(graf({ settings: { progress: true } })))?.progress).toBe(
      true,
    );
  });

  test("ett skrivet false bärs inte vidare — frånvaron betyder det", () => {
    expect(carries(rundtur(graf({ settings: { progress: false } })))).toBe(false);
  });

  test("något som inte är sant eller falskt släpps", () => {
    expect(carries(rundtur(graf({ settings: { progress: "kanske" } })))).toBe(false);
  });

  test("en guide utan nyckeln får den inte", () => {
    expect(carries(rundtur(graf()))).toBe(false);
  });
});

import { describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";

import { exportGraphJson, importGraphJson } from "./graph-io";
import { CURRENT_GRAPH_VERSION } from "../../viewer/core/graph-migrations";

import type { GraphData } from "../../viewer/types/graph";

const graph = (): GraphData => ({
  startNodeId: "question",
  nodes: [
    {
      id: "question",
      type: "question",
      position: { x: 10, y: 20 },
      data: {
        title: "Är du nöjd?",
        options: [
          { id: "yes", label: "Ja", value: "yes" },
          { id: "no", label: "Nej", value: "no" },
        ],
      },
    },
    {
      id: "result",
      type: "result",
      position: { x: 400, y: 20 },
      data: { title: "Tack" },
    },
  ],
  connections: [
    {
      id: "yes-result",
      from: { nodeId: "question", portId: "yes" },
      to: { nodeId: "result", portId: "input" },
    },
  ],
});

describe("graph JSON", () => {
  test("exports a valid graph as readable JSON", () => {
    const result = exportGraphJson(graph());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.json).toContain('\n  "startNodeId": "question"');

      // Export stamps two things: the content version and the timestamp. The
      // graph is otherwise unchanged.
      //
      // The stamp is set on export and not on every change — otherwise the JSON
      // differs from itself constantly, and a comparison between two versions
      // is always falsely positive. See K6c in docs/KRAV.md.
      const exporterad = JSON.parse(result.json) as GraphData & {
        version: number;
        meta: { updatedAt: string };
      };

      expect(new Date(exporterad.meta.updatedAt).toISOString()).toBe(
        exporterad.meta.updatedAt
      );
      expect(exporterad).toEqual({
        version: CURRENT_GRAPH_VERSION,
        ...graph(),
        meta: { updatedAt: exporterad.meta.updatedAt },
      });
    }
  });

  test("preserves guide settings (viewer texts) through export and import", () => {
    const withSettings: GraphData = {
      ...graph(),
      settings: {
        strings: {
          "nav.next": { sv: "Vidare", en: "Proceed" },
          "nav.restart": "Om igen",
        },
        locales: ["sv", "en", "fi"],
      },
    };

    const exported = exportGraphJson(withSettings);
    expect(exported.success).toBe(true);
    if (!exported.success) return;

    const imported = importGraphJson(exported.json);
    expect(imported.success).toBe(true);
    if (!imported.success) return;

    expect(imported.graph.settings).toEqual({
      strings: {
        "nav.next": { sv: "Vidare", en: "Proceed" },
        "nav.restart": "Om igen",
      },
      locales: ["sv", "en", "fi"],
    });
  });

  test("bevarar nodmallar genom export och import", () => {
    const mall = {
      type: "mall-ja-nej",
      label: "Ja/Nej-fråga",
      icon: "☑",
      base: "question",
      values: { title: { sv: "Ja eller nej?" } },
    };
    const medMall: GraphData = {
      ...graph(),
      settings: { nodeTemplates: [mall] },
    };

    const exported = exportGraphJson(medMall);
    expect(exported.success).toBe(true);
    if (!exported.success) return;

    const imported = importGraphJson(exported.json);
    expect(imported.success).toBe(true);
    if (!imported.success) return;

    expect(imported.graph.settings?.nodeTemplates).toEqual([mall]);
  });

  test("nekar export av en semantiskt ogiltig graf", () => {
    const value = graph();
    value.startNodeId = "missing";

    const result = exportGraphJson(value);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain("saknas");
    }
  });

  test("importerar en giltig exporterad graf", () => {
    const exported = exportGraphJson(graph());

    if (!exported.success) {
      throw new Error("Testgrafen kunde inte exporteras.");
    }

    const importerad = importGraphJson(exported.json);

    if (!importerad.success) {
      throw new Error("Den exporterade grafen kunde inte läsas tillbaka.");
    }

    // The timestamp comes back along: it describes the file, not the import.
    expect(importerad.graph).toEqual({
      ...graph(),
      meta: { updatedAt: importerad.graph.meta?.updatedAt },
    });
    expect(importerad.graph.meta?.updatedAt).toBeTypeOf("string");
  });

  /*
   * Berättelse 123: id:t är hela poängen med `serviceId`, och det är värt
   * exakt så mycket som det är oföränderligt. Filen namnger sig själv — en
   * import är inte en ny guide.
   */
  test("the guide's id survives export and import", () => {
    const exported = exportGraphJson({ ...graph(), meta: { id: "min-guide" } });

    if (!exported.success) {
      throw new Error("Testgrafen kunde inte exporteras.");
    }

    expect(JSON.parse(exported.json).meta.id).toBe("min-guide");

    const back = importGraphJson(exported.json);

    if (!back.success) {
      throw new Error("Den exporterade grafen kunde inte läsas tillbaka.");
    }

    expect(back.graph.meta?.id).toBe("min-guide");
  });

  test("gives a readable error for broken JSON", () => {
    expect(importGraphJson("{ trasig")).toEqual({
      success: false,
      errors: ["Filen innehåller inte giltig JSON."],
    });
  });

  test("kontrollerar grafens grundformat", () => {
    const result = importGraphJson(
      JSON.stringify({ startNodeId: 42, nodes: {}, connections: "inga" })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual([
        "Startnodens id måste vara text eller null.",
        "Fältet nodes måste vara en lista.",
        "Fältet connections måste vara en lista.",
      ]);
    }
  });

  test("kontrollerar noder och kopplingar strukturellt", () => {
    const result = importGraphJson(
      JSON.stringify({
        startNodeId: null,
        nodes: [{ id: "node" }],
        connections: [{ id: "connection", from: {}, to: {} }],
      })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("giltig typ"),
          expect.stringContaining("ogiltig position"),
          expect.stringContaining("giltiga egenskaper"),
          expect.stringContaining("ogiltig nod- eller portreferens"),
        ])
      );
    }
  });

  test("rejects ids and types with dangerous characters (defence in depth against injection)", () => {
    const result = importGraphJson(
      JSON.stringify({
        startNodeId: null,
        nodes: [
          {
            id: 'x"><img src=x onerror=alert(1)>',
            type: "question",
            position: { x: 0, y: 0 },
            data: {},
          },
        ],
        connections: [],
      })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining("giltigt id")])
      );
    }
  });

  test("rejects a well-formed graph with broken references", () => {
    const value = graph();
    value.connections[0]!.to.nodeId = "missing";

    const result = importGraphJson(JSON.stringify(value));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain("saknas");
    }
  });
});

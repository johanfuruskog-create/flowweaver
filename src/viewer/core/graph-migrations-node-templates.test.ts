import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { CURRENT_GRAPH_VERSION, migrateGraph, readGraphVersion } from "./graph-migrations";

/**
 * v4→v5: the guide's carried node templates go from a frozen copy of the base
 * type's shape to base type plus values. See
 * docs/STORIES/007-ett-falt-ett-stalle.md.
 */

function graf(settings: Record<string, unknown>): Record<string, unknown> {
  return {
    version: 4,
    startNodeId: "q1",
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Fråga" }, options: [] },
      },
    ],
    connections: [],
    settings,
  };
}

const gammalMall = {
  type: "custom-1a2b",
  label: "Ja/Nej-fråga",
  icon: "☑",
  requiredCapability: "inputQuestions",
  fields: [
    { id: "title", label: "Rubrik", control: "text", defaultValue: "" },
    { id: "format", label: "Format", control: "select", defaultValue: "email" },
    { id: "maxLength", label: "Högsta textlängd", control: "number" },
  ],
  behavior: {
    answer: { variableField: "variableName", cardinality: "single", input: "text" },
    flow: { kind: "linear" },
  },
};

/** Lifts a v4 graph all the way to the current version. */
function lyft(value: Record<string, unknown>): Record<string, unknown> {
  return migrateGraph(value, readGraphVersion(value)).graph;
}

function migrerad(settings: Record<string, unknown>): Record<string, unknown> {
  return lyft(graf(settings)).settings as Record<string, unknown>;
}

describe("node templates become base type plus values", () => {
  test("the base type is read from the copied shape", () => {
    expect(migrerad({ customNodeTypes: [gammalMall] }).nodeTemplates).toEqual([
      {
        type: "custom-1a2b",
        label: "Ja/Nej-fråga",
        icon: "☑",
        base: "text-question",
        values: { title: "", format: "email" },
      },
    ]);
  });

  test("the old key is left empty, not forgotten", () => {
    expect(migrerad({ customNodeTypes: [gammalMall] })).not.toHaveProperty(
      "customNodeTypes"
    );
  });

  test("other settings are untouched", () => {
    const efter = migrerad({
      customNodeTypes: [gammalMall],
      locales: ["sv", "en"],
      strings: { "viewer.next": { sv: "Vidare" } },
    });

    expect(efter.locales).toEqual(["sv", "en"]);
    expect(efter.strings).toEqual({ "viewer.next": { sv: "Vidare" } });
  });

  // Shape-guarded: only what actually carries the old shape is touched.
  test("a guide without templates gets no template key", () => {
    expect(migrerad({ locales: ["sv"] })).toEqual({ locales: ["sv"] });
  });

  test("a guide with no settings at all survives", () => {
    const utan = { version: 4, startNodeId: "q1", nodes: [], connections: [] };

    expect(lyft(utan)).toEqual({
      ...utan,
      version: CURRENT_GRAPH_VERSION,
      // v7 rör bara email-result-noder; en tom guide passerar orörd igenom den.
    });
  });

  test("the graph is stamped with the new version", () => {
    expect(lyft(graf({})).version).toBe(CURRENT_GRAPH_VERSION);
  });
});

describe("the template thereby shares the base type's improvements", () => {
  // This is the whole point. The template copied three fields; the text question
  // has many more, and gains any that are added later.
  test("a template that carried three fields now points at the base type", async () => {
    const { nodeFromTemplate } = await import("../node-types/node-templates");
    const { getNodeType } = await import("../node-types/node-type-registry");

    const [mall] = migrerad({ customNodeTypes: [gammalMall] })
      .nodeTemplates as Array<Parameters<typeof nodeFromTemplate>[0]>;

    /*
     * Against the registry rather than against a number.
     *
     * It said twelve, and adding one field to the text question failed a test
     * about *templates* — the count was standing in for "all of them", which is
     * what the sentence above actually claims. Now it says so, and the next field
     * is inherited without anybody editing this file.
     */
    // Every field the base type starts a node with — a field whose absence
    // is its value (story 138's setting) is not started with, from a template
    // or without one.
    const base = getNodeType("text-question")!.properties
      .filter((property) => property.createDefault !== undefined || Object.hasOwn(property, "defaultValue"))
      .map((property) => property.id);

    expect(gammalMall.fields).toHaveLength(3);
    expect(Object.keys(nodeFromTemplate(mall)!.data).sort()).toEqual([...base].sort());
  });

  test("and the saved value remains", () => {
    const [mall] = migrerad({ customNodeTypes: [gammalMall] })
      .nodeTemplates as Array<{ values: Record<string, unknown> }>;

    expect(mall.values.format).toBe("email");
  });
});

describe("noden ur en mall blir en nod av grundtypen", () => {
  /** How a guide looked when the template's key was the node's type. */
  function medMalltypadNod(): Record<string, unknown> {
    return {
      version: 5,
      startNodeId: "n1",
      nodes: [
        {
          id: "n1",
          type: "custom-1a2b",
          position: { x: 0, y: 0 },
          data: { title: { sv: "Din e-post" } },
        },
        {
          id: "n2",
          type: "result",
          position: { x: 0, y: 0 },
          data: { title: { sv: "Klart" } },
        },
      ],
      connections: [],
      settings: {
        nodeTemplates: [
          {
            type: "custom-1a2b",
            label: "E-postfråga",
            base: "text-question",
            values: { format: "email" },
          },
        ],
      },
    };
  }

  const noder = (graph: Record<string, unknown>) =>
    graph.nodes as Array<Record<string, unknown>>;

  test("typen blir grundtypens", () => {
    expect(noder(lyft(medMalltypadNod()))[0].type).toBe("text-question");
  });

  test("and the template's key becomes provenance", () => {
    expect(noder(lyft(medMalltypadNod()))[0].template).toBe("custom-1a2b");
  });

  // Filling the node in here would have added content nobody authored. Missing
  // keys are answered by the field's declared default.
  test("the data is untouched", () => {
    expect(noder(lyft(medMalltypadNod()))[0].data).toEqual({
      title: { sv: "Din e-post" },
    });
  });

  test("nodes not created from a template are left alone", () => {
    const resultat = noder(lyft(medMalltypadNod()))[1];

    expect(resultat.type).toBe("result");
    expect(resultat).not.toHaveProperty("template");
  });

  // No worse than before the migration: the node remains and can be resolved later.
  test("a template that cannot be looked up leaves the node as it is", () => {
    const utan = medMalltypadNod();
    (utan.settings as Record<string, unknown>).nodeTemplates = [];

    expect(noder(lyft(utan))[0].type).toBe("custom-1a2b");
  });

  test("a second run changes nothing", () => {
    const once = lyft(medMalltypadNod());
    const twice = lyft(once);

    expect(twice).toEqual(once);
  });
});

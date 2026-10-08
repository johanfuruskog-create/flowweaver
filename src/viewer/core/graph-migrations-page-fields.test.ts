import { describe, expect, test } from "vitest";

import { CURRENT_GRAPH_VERSION, migrateGraph } from "./graph-migrations";

/**
 * The Page's two built-in text fields lived in the page's own data and could
 * therefore not be moved, removed or given a width of their own. They also
 * vanished silently as soon as the editor dragged in a field of their own.
 */
function sidGraf(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 3,
    startNodeId: "sida",
    nodes: [
      {
        id: "sida",
        type: "page",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Dina uppgifter" },
          firstLabel: { sv: "Ditt namn" },
          firstVariableName: "namn",
          firstPlaceholder: { sv: "För- och efternamn" },
          firstRequired: true,
          secondLabel: { sv: "Din e-post" },
          secondVariableName: "epost",
          secondPlaceholder: { sv: "" },
          secondRequired: false,
          ...(extra.data as Record<string, unknown> | undefined),
        },
      },
      ...((extra.nodes as unknown[]) ?? []),
    ],
    connections: [],
  };
}

function run(graph: Record<string, unknown>): Record<string, unknown> {
  return migrateGraph(graph, 3).graph;
}

function barn(graph: Record<string, unknown>): Record<string, unknown>[] {
  return (graph.nodes as Record<string, unknown>[]).filter(
    (node) => node.parentPageId === "sida",
  );
}

describe("the page's built-in fields become child nodes", () => {
  test("both fields migrate, in order", () => {
    const ut = run(sidGraf());
    const field = barn(ut);

    expect(field).toHaveLength(2);
    expect(field.map((node) => node.type)).toEqual([
      "text-question",
      "text-question",
    ]);
    expect(field.map((node) => node.order)).toEqual([0, 1]);
  });

  test("label, placeholder and requiredness are preserved", () => {
    const [första] = barn(run(sidGraf()));

    expect(första.data).toMatchObject({
      title: { sv: "Ditt namn" },
      placeholder: { sv: "För- och efternamn" },
      required: true,
    });
  });

  // A rule or result text pointing at `namn` must work afterwards.
  test("variable names do not change", () => {
    const field = barn(run(sidGraf()));

    expect(field.map((node) => (node.data as Record<string, unknown>).variableName)).toEqual([
      "namn",
      "epost",
    ]);
  });

  test("de gamla nycklarna tas bort ur sidan", () => {
    const ut = run(sidGraf());
    const sida = (ut.nodes as Record<string, unknown>[]).find(
      (node) => node.id === "sida",
    );
    const data = sida?.data as Record<string, unknown>;

    expect("firstLabel" in data).toBe(false);
    expect("secondVariableName" in data).toBe(false);
    expect(data.title).toEqual({ sv: "Dina uppgifter" });
  });

  test("an empty field is not migrated", () => {
    const ut = run(
      sidGraf({
        data: {
          secondLabel: { sv: "" },
          secondVariableName: "",
          secondPlaceholder: { sv: "" },
          secondRequired: false,
        },
      }),
    );

    expect(barn(ut)).toHaveLength(1);
  });

  // The old fields were invisible when the page had children of its own — the
  // children won at render time. Surfacing them would have added fields nobody
  // asked for.
  test("en sida som redan har egna barn migreras inte", () => {
    const ut = run(
      sidGraf({
        nodes: [
          {
            id: "eget",
            type: "text-question",
            position: { x: 0, y: 0 },
            parentPageId: "sida",
            order: 0,
            data: { title: { sv: "Eget fält" }, variableName: "eget" },
          },
        ],
      }),
    );

    expect(barn(ut)).toHaveLength(1);
    expect((barn(ut)[0].data as Record<string, unknown>).variableName).toBe("eget");
  });

  test("but the dead keys are cleaned up regardless", () => {
    const ut = run(
      sidGraf({
        nodes: [
          {
            id: "eget",
            type: "text-question",
            position: { x: 0, y: 0 },
            parentPageId: "sida",
            order: 0,
            data: { title: { sv: "Eget" }, variableName: "eget" },
          },
        ],
      }),
    );
    const sida = (ut.nodes as Record<string, unknown>[]).find(
      (node) => node.id === "sida",
    );

    expect("firstLabel" in (sida?.data as Record<string, unknown>)).toBe(false);
  });

  test("ett id som redan finns ger inte en dubblett", () => {
    const ut = run(
      sidGraf({
        nodes: [
          {
            id: "sida-falt-1",
            type: "result",
            position: { x: 0, y: 0 },
            data: { title: { sv: "Krockar" } },
          },
        ],
      }),
    );

    const idn = (ut.nodes as Record<string, unknown>[]).map((node) => node.id);

    expect(new Set(idn).size).toBe(idn.length);
  });

  // Opening and saving an already-migrated guide must change nothing.
  test("en migrerad guide migreras inte igen", () => {
    const once = run(sidGraf());
    const twice = migrateGraph(once, CURRENT_GRAPH_VERSION).graph;

    expect(twice).toEqual(once);
  });
});

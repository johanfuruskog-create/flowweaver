import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

function montera(): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  // Opt in: the default is readonly, and this test builds.
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  return editor;
}

/** A v3 guide with the Page's two built-in fields, as they looked before v4. */
function gammalSidGraf(): unknown {
  return {
    version: 3,
    startNodeId: "sida",
    nodes: [
      {
        id: "sida",
        type: "page",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Kontakt" },
          firstLabel: { sv: "Ditt namn" },
          firstVariableName: "namn",
          firstRequired: true,
          secondLabel: { sv: "Din e-post" },
          secondVariableName: "epost",
          secondRequired: false,
        },
      },
    ],
    connections: [],
  };
}

/**
 * The migration ran only in `importGraphJson`. A host that sets the graph as an
 * *object* — which the SiteVision module does — went straight past it.
 *
 * It went unnoticed until v3→v4 removed the old page-field format: until then
 * old fields rendered anyway, so the gap was silent. Afterwards the two fields
 * had disappeared with no notice.
 */
describe("a graph set as an object is migrated", () => {
  test("the old page fields become child nodes", () => {
    const editor = montera();

    editor.graph = gammalSidGraf() as GraphData;

    const barn = editor
      .getData()
      .nodes.filter((node) => node.parentPageId === "sida");

    expect(barn).toHaveLength(2);
    expect(barn.map((node) => node.data.variableName)).toEqual([
      "namn",
      "epost",
    ]);
  });

  test("the labels come along", () => {
    const editor = montera();

    editor.graph = gammalSidGraf() as GraphData;

    const [första] = editor
      .getData()
      .nodes.filter((node) => node.parentPageId === "sida");

    expect(första.data.title).toEqual({ sv: "Ditt namn" });
    expect(första.data.required).toBe(true);
  });

  test("the old keys are cleaned out of the page", () => {
    const editor = montera();

    editor.graph = gammalSidGraf() as GraphData;

    const sida = editor.getData().nodes.find((node) => node.id === "sida");

    expect("firstLabel" in (sida?.data ?? {})).toBe(false);
  });

  // The chain must not disturb a graph that is already up to date.
  test("an up-to-date graph is left untouched", () => {
    const editor = montera();
    const nu: GraphData = {
      startNodeId: "q1",
      nodes: [
        {
          id: "q1",
          type: "question",
          position: { x: 0, y: 0 },
          data: {
            title: { sv: "Fråga" },
            variableName: "a",
            options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }],
          },
        },
      ],
      connections: [],
    };

    editor.graph = structuredClone(nu);

    expect(editor.getData().nodes).toEqual(nu.nodes);
  });
});

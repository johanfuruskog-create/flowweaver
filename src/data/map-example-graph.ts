import type { GraphData } from "../viewer/types/graph";

/**
 * The map example (story 046): one question per kind — a point, several
 * points, an area — and a result showing all six variables. Shared by the
 * example pages (`examples/map.html`, `sv/examples/map.html`), their editors
 * and the dev workbench (`dev/map.html`) — one home, so the pages cannot
 * drift apart.
 *
 * Only the first question is required: the demo should show the validation
 * once, and let the two remaining kinds be skippable on a quick run-through.
 */
export const mapExampleGraph: GraphData = {
  startNodeId: "place",
  nodes: [
    {
      id: "place",
      type: "map-question",
      position: { x: 80, y: 120 },
      data: {
        title: { sv: "Var är felet?", en: "Where is the fault?" },
        description: {
          sv: "Peka ut platsen på kartan, eller skriv den i ord.",
          en: "Point out the place on the map, or write it in words.",
        },
        variableName: "plats",
        kind: "point",
        required: true,
      },
    },
    {
      id: "poles",
      type: "map-question",
      position: { x: 520, y: 120 },
      data: {
        title: { sv: "Är fler lyktstolpar trasiga?", en: "Are more streetlights broken?" },
        description: {
          sv: "Peka ut var och en — eller gå vidare om det bara var den ena.",
          en: "Point out each one — or continue if it was just the one.",
        },
        variableName: "stolpar",
        kind: "points",
      },
    },
    {
      id: "zone",
      type: "map-question",
      position: { x: 960, y: 120 },
      data: {
        title: { sv: "Rita in området som är mörkt", en: "Draw the area that is dark" },
        description: {
          sv: "Klicka ut hörnen — minst tre. Eller beskriv området i ord.",
          en: "Click out the corners — at least three. Or describe the area in words.",
        },
        variableName: "omrade",
        kind: "area",
      },
    },
    {
      id: "done",
      type: "result",
      position: { x: 1400, y: 120 },
      data: {
        title: { sv: "Tack, allt är noterat", en: "Thank you, everything is noted" },
        description: {
          sv: "Varje svar har två delar — en rad en människa läser, och GeoJSON ett system läser:\n\n**plats**: {{plats}}\n`{{plats.geo}}`\n\n**stolpar**: {{stolpar}}\n`{{stolpar.geo}}`\n\n**omrade**: {{omrade}}\n`{{omrade.geo}}`",
          en: "Each answer has two parts — a line a person reads, and GeoJSON a system reads:\n\n**plats**: {{plats}}\n`{{plats.geo}}`\n\n**stolpar**: {{stolpar}}\n`{{stolpar.geo}}`\n\n**omrade**: {{omrade}}\n`{{omrade.geo}}`",
        },
      },
    },
  ],
  connections: [
    { id: "c1", from: { nodeId: "place", portId: "continue" }, to: { nodeId: "poles", portId: "input" } },
    { id: "c2", from: { nodeId: "poles", portId: "continue" }, to: { nodeId: "zone", portId: "input" } },
    { id: "c3", from: { nodeId: "zone", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
  ],
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
};

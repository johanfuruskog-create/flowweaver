import type { GraphData } from "../viewer/types/graph";

/**
 * Fourteen answers in a row, some with labels long enough to wrap, then a
 * result — a test fixture, outside `BUNDLED_GRAPHS`.
 *
 * For the text field's menus (uppdrag 28/9, Del 3): on the result, *Lägg
 * till* offers every answer, and the menu is longer than a low panel shows.
 */
export const longAnswerListGraph: GraphData = {
  startNodeId: "long-q0",
  settings: { sourceLocale: "sv" },
  nodes: [
    {
      id: "long-q0",
      type: "text-question",
      position: { x: 0, y: 40 },
      data: { title: "Förnamn", variableName: "fornamn" },
    },
    {
      id: "long-q1",
      type: "text-question",
      position: { x: 320, y: 40 },
      data: { title: "Efternamn", variableName: "efternamn" },
    },
    {
      id: "long-q2",
      type: "text-question",
      position: { x: 640, y: 40 },
      data: { title: "Personnummer", variableName: "personnummer" },
    },
    {
      id: "long-q3",
      type: "text-question",
      position: { x: 960, y: 40 },
      data: { title: "Gatuadress där du är folkbokförd just nu", variableName: "gatuadress" },
    },
    {
      id: "long-q4",
      type: "text-question",
      position: { x: 1280, y: 40 },
      data: { title: "Postnummer", variableName: "postnummer" },
    },
    {
      id: "long-q5",
      type: "text-question",
      position: { x: 1600, y: 40 },
      data: { title: "Ort", variableName: "ort" },
    },
    {
      id: "long-q6",
      type: "text-question",
      position: { x: 1920, y: 40 },
      data: { title: "Telefonnummer dagtid, gärna ett mobilnummer vi kan skicka sms till", variableName: "telefon" },
    },
    {
      id: "long-q7",
      type: "text-question",
      position: { x: 2240, y: 40 },
      data: { title: "E-postadress", variableName: "epost" },
    },
    {
      id: "long-q8",
      type: "text-question",
      position: { x: 2560, y: 40 },
      data: { title: "Antal barn i hushållet", variableName: "barn" },
    },
    {
      id: "long-q9",
      type: "text-question",
      position: { x: 2880, y: 40 },
      data: { title: "Hushållets sammanlagda inkomst per månad före skatt", variableName: "inkomst" },
    },
    {
      id: "long-q10",
      type: "text-question",
      position: { x: 3200, y: 40 },
      data: { title: "Hyra", variableName: "hyra" },
    },
    {
      id: "long-q11",
      type: "text-question",
      position: { x: 3520, y: 40 },
      data: { title: "Typ av boende", variableName: "boende" },
    },
    {
      id: "long-q12",
      type: "text-question",
      position: { x: 3840, y: 40 },
      data: { title: "Flyttdatum", variableName: "flytt" },
    },
    {
      id: "long-q13",
      type: "text-question",
      position: { x: 4160, y: 40 },
      data: { title: "Övrigt du vill att vi ska veta innan vi hör av oss", variableName: "kommentar" },
    },
    {
      id: "long-result",
      type: "result",
      position: { x: 4480, y: 40 },
      data: { title: "Tack", description: "Vi har tagit emot din ansökan, {{fornamn}}." },
    },
  ],
  connections: [
    { id: "long-c1", from: { nodeId: "long-q0", portId: "continue" }, to: { nodeId: "long-q1", portId: "input" } },
    { id: "long-c2", from: { nodeId: "long-q1", portId: "continue" }, to: { nodeId: "long-q2", portId: "input" } },
    { id: "long-c3", from: { nodeId: "long-q2", portId: "continue" }, to: { nodeId: "long-q3", portId: "input" } },
    { id: "long-c4", from: { nodeId: "long-q3", portId: "continue" }, to: { nodeId: "long-q4", portId: "input" } },
    { id: "long-c5", from: { nodeId: "long-q4", portId: "continue" }, to: { nodeId: "long-q5", portId: "input" } },
    { id: "long-c6", from: { nodeId: "long-q5", portId: "continue" }, to: { nodeId: "long-q6", portId: "input" } },
    { id: "long-c7", from: { nodeId: "long-q6", portId: "continue" }, to: { nodeId: "long-q7", portId: "input" } },
    { id: "long-c8", from: { nodeId: "long-q7", portId: "continue" }, to: { nodeId: "long-q8", portId: "input" } },
    { id: "long-c9", from: { nodeId: "long-q8", portId: "continue" }, to: { nodeId: "long-q9", portId: "input" } },
    { id: "long-c10", from: { nodeId: "long-q9", portId: "continue" }, to: { nodeId: "long-q10", portId: "input" } },
    { id: "long-c11", from: { nodeId: "long-q10", portId: "continue" }, to: { nodeId: "long-q11", portId: "input" } },
    { id: "long-c12", from: { nodeId: "long-q11", portId: "continue" }, to: { nodeId: "long-q12", portId: "input" } },
    { id: "long-c13", from: { nodeId: "long-q12", portId: "continue" }, to: { nodeId: "long-q13", portId: "input" } },
    { id: "long-c14", from: { nodeId: "long-q13", portId: "continue" }, to: { nodeId: "long-result", portId: "input" } },
  ],
};

/**
 * The same fourteen answers with a calculation before the result — for the
 * formula field's menu (Astras granskning av vända 1, bilaga 2, 29/9): the
 * menu is longer than a low panel shows, and its last row must be reached by
 * keyboard and by scrolling the menu.
 */
export const longAnswerListCalculationGraph: GraphData = {
  ...longAnswerListGraph,
  nodes: [
    ...longAnswerListGraph.nodes.filter((node) => node.id !== "long-result"),
    {
      id: "long-calc",
      type: "calculation",
      position: { x: 4480, y: 40 },
      data: {
        title: "Räkna",
        assignments: [
          { id: "long-a-total", variableName: "summa", label: "Summa", formula: "inkomst - hyra" },
        ],
      },
    },
    { ...longAnswerListGraph.nodes.find((node) => node.id === "long-result")!, position: { x: 4800, y: 40 } },
  ],
  connections: [
    ...longAnswerListGraph.connections.filter((connection) => connection.id !== "long-c14"),
    { id: "long-c14", from: { nodeId: "long-q13", portId: "continue" }, to: { nodeId: "long-calc", portId: "input" } },
    { id: "long-c15", from: { nodeId: "long-calc", portId: "continue" }, to: { nodeId: "long-result", portId: "input" } },
  ],
};

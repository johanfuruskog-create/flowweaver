import type { GraphData } from "../viewer/types/graph";

/**
 * One question, three options, each option's port connected to a result of
 * its own — a test fixture, outside `BUNDLED_GRAPHS`.
 *
 * For the answer options' editing (uppdrag 28/9 svarsalternativen, etapp 2):
 * every connection leaves from an option's own port, named by the option's
 * id, so moving, dragging and removing options must leave the other
 * connections exactly where they were.
 */
export const optionPortsGraph: GraphData = {
  startNodeId: "ports-question",
  settings: { sourceLocale: "sv" },
  nodes: [
    {
      id: "ports-question",
      type: "question",
      position: { x: 40, y: 40 },
      data: {
        title: "Hur vill du bli kontaktad?",
        variableName: "kontakt",
        options: [
          { id: "ports-mail", label: "E-post", value: "epost" },
          { id: "ports-phone", label: "Telefon", value: "telefon" },
          { id: "ports-letter", label: "Brev", value: "brev" },
        ],
      },
    },
    { id: "ports-to-mail", type: "result", position: { x: 440, y: 0 }, data: { title: "Vi mejlar", description: "" } },
    { id: "ports-to-phone", type: "result", position: { x: 440, y: 220 }, data: { title: "Vi ringer", description: "" } },
    { id: "ports-to-letter", type: "result", position: { x: 440, y: 440 }, data: { title: "Vi skriver", description: "" } },
  ],
  connections: [
    { id: "ports-c-mail", from: { nodeId: "ports-question", portId: "ports-mail" }, to: { nodeId: "ports-to-mail", portId: "input" } },
    { id: "ports-c-phone", from: { nodeId: "ports-question", portId: "ports-phone" }, to: { nodeId: "ports-to-phone", portId: "input" } },
    { id: "ports-c-letter", from: { nodeId: "ports-question", portId: "ports-letter" }, to: { nodeId: "ports-to-letter", portId: "input" } },
  ],
};

import type { GraphData } from "../viewer/types/graph";

/**
 * A note pointing at a question, its text in two languages — a test fixture,
 * outside `BUNDLED_GRAPHS`.
 *
 * No example guide carries an annotation, so the panel's *Anteckning* field
 * (a localized textarea, like *Varför frågar vi det här?*) had nothing to be
 * measured on but the inventory rig's own graph (uppdrag 28/9, Del 1).
 */
export const annotationNoteGraph: GraphData = {
  startNodeId: "note-question",
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
  nodes: [
    {
      id: "note-question",
      type: "question",
      position: { x: 40, y: 40 },
      data: {
        title: { sv: "Har du barn?", en: "Do you have children?" },
        variableName: "barn",
        options: [
          { id: "note-yes", label: { sv: "Ja", en: "Yes" }, value: "ja" },
          { id: "note-no", label: { sv: "Nej", en: "No" }, value: "nej" },
        ],
      },
    },
    {
      id: "note",
      type: "annotation",
      position: { x: 40, y: 420 },
      data: {
        text: { sv: "Frågan styr resten av guiden", en: "The question steers the rest of the guide" },
        targetNodeId: "note-question",
        arrow: "up",
      },
    },
  ],
  connections: [],
};

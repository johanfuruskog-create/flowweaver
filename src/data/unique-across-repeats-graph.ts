import type { GraphData } from "../viewer/types/graph";

/**
 * *Varje upprepning ska välja olika* (story 138) — a fixture, not an example.
 * Outside `BUNDLED_GRAPHS`, the translation gate and the examples index.
 *
 * One repeating page, *Bokningar*, with three fields per record:
 *
 * - **Vilken tid?** (`tid`) — a choice with the setting **on**: a time booked
 *   in an earlier record is not offered again.
 * - **Namn** (`namn`) — a text field with the setting **on**: the same name
 *   twice is refused, whatever the case and the spaces around it.
 * - **Lunch efteråt?** (`lunch`) — a choice with the setting **off**, beside
 *   them, so every test also shows that an ordinary field keeps today's
 *   behaviour: *Ja* in every record.
 *
 * The health test turns `repeats` off on a copy to measure the warning for a
 * setting left on a page that no longer repeats (criterion 7).
 */
export const uniqueAcrossRepeatsGraph: GraphData = {
  startNodeId: "unique-page",
  settings: { sourceLocale: "sv" },
  nodes: [
    {
      id: "unique-page",
      type: "page",
      position: { x: 40, y: 40 },
      data: {
        title: "Bokningar",
        repeats: true,
        repeatWord: "bokning",
        repeatVariable: "bokningar",
        repeatMin: 1,
        repeatMax: 3,
      },
    },
    {
      id: "unique-time",
      type: "question",
      position: { x: 20, y: 112 },
      parentPageId: "unique-page",
      order: 0,
      layout: { columnSpan: 12 },
      data: {
        title: "Vilken tid?",
        variableName: "tid",
        uniqueAcrossRepeats: true,
        options: [
          { id: "unique-time-9", label: "09.30", value: "0930" },
          { id: "unique-time-11", label: "11.00", value: "1100" },
          { id: "unique-time-14", label: "14.00", value: "1400" },
        ],
      },
    },
    {
      id: "unique-name",
      type: "text-question",
      position: { x: 20, y: 240 },
      parentPageId: "unique-page",
      order: 1,
      layout: { columnSpan: 12 },
      data: { title: "Namn", variableName: "namn", required: true, uniqueAcrossRepeats: true },
    },
    {
      id: "unique-lunch",
      type: "question",
      position: { x: 20, y: 360 },
      parentPageId: "unique-page",
      order: 2,
      layout: { columnSpan: 12 },
      data: {
        title: "Lunch efteråt?",
        variableName: "lunch",
        options: [
          { id: "unique-lunch-yes", label: "Ja", value: "ja" },
          { id: "unique-lunch-no", label: "Nej", value: "nej" },
        ],
      },
    },
    {
      id: "unique-done",
      type: "result",
      position: { x: 520, y: 40 },
      data: { title: "Tack", description: "{{bokningar}}" },
    },
  ],
  connections: [
    {
      id: "unique-to-done",
      from: { nodeId: "unique-page", portId: "continue" },
      to: { nodeId: "unique-done", portId: "in" },
    },
  ],
};

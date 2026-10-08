import type { GraphData } from "../viewer/types/graph";

/**
 * Options inside a repeated record, weighed while the visitor fills it in
 * (story 138, "Det som måste lösas först", criterion 6).
 *
 * A test fixture, not an example: it sits outside `BUNDLED_GRAPHS`, the
 * translation gate and the examples index. It exists so the two ways an
 * option in a record can depend on something are measured on a guide of
 * their own — the conference guide measured the third way (an earlier step,
 * story 134 criterion 8) and keeps that test while its sessions change.
 *
 * One repeating page, *Pass*, with two fields per record:
 *
 * - **Vilken dag?** (`dag`) — answered in the same record.
 * - **Vilket pass?** (`pass`) — whose options depend on
 *   - `dag` in the **same record**: the day-1 sessions need `dag = 1`, the
 *     panel needs `dag = 2`;
 *   - `passen.pass` in the **records before this one**: the follow-up
 *     *Klarspråk, fördjupning* is offered only once an earlier record chose
 *     the plain-language session.
 *
 * Inside a record, `passen` is the records before it — see
 * `PageRepeatService.recordAnswers`, which is where that is decided.
 */
export const repeatOptionsGraph: GraphData = {
  startNodeId: "repeat-options-page",
  settings: { sourceLocale: "sv" },
  nodes: [
    {
      id: "repeat-options-page",
      type: "page",
      position: { x: 40, y: 40 },
      data: {
        title: "Dina pass",
        repeats: true,
        repeatWord: "pass",
        repeatVariable: "passen",
        repeatMin: 1,
        repeatMax: 3,
      },
    },
    {
      id: "repeat-options-day",
      type: "question",
      position: { x: 20, y: 112 },
      parentPageId: "repeat-options-page",
      order: 0,
      layout: { columnSpan: 12 },
      data: {
        title: "Vilken dag?",
        variableName: "dag",
        options: [
          { id: "repeat-options-day-1", label: "Dag 1", value: "1" },
          { id: "repeat-options-day-2", label: "Dag 2", value: "2" },
        ],
      },
    },
    {
      id: "repeat-options-session",
      type: "question",
      position: { x: 20, y: 240 },
      parentPageId: "repeat-options-page",
      order: 1,
      layout: { columnSpan: 12 },
      data: {
        title: "Vilket pass?",
        variableName: "pass",
        options: [
          {
            id: "repeat-options-plain",
            label: "Att skriva klarspråk",
            value: "klarsprak",
            visibility: {
              match: "all",
              conditions: [{ id: "repeat-options-plain-day", variableName: "dag", operator: "equals", value: "1" }],
            },
          },
          {
            id: "repeat-options-measure",
            label: "Mät det som betyder något",
            value: "matning",
            visibility: {
              match: "all",
              conditions: [{ id: "repeat-options-measure-day", variableName: "dag", operator: "equals", value: "1" }],
            },
          },
          {
            id: "repeat-options-panel",
            label: "Frågor till panelen",
            value: "panel",
            visibility: {
              match: "all",
              conditions: [{ id: "repeat-options-panel-day", variableName: "dag", operator: "equals", value: "2" }],
            },
          },
          {
            id: "repeat-options-follow-up",
            label: "Klarspråk, fördjupning",
            value: "fordjupning",
            visibility: {
              match: "all",
              conditions: [
                { id: "repeat-options-follow-up-earlier", variableName: "passen.pass", operator: "one-of", value: "klarsprak" },
              ],
            },
          },
        ],
      },
    },
    {
      id: "repeat-options-done",
      type: "result",
      position: { x: 520, y: 40 },
      data: { title: "Tack", description: "{{passen}}" },
    },
  ],
  connections: [
    {
      id: "repeat-options-to-done",
      from: { nodeId: "repeat-options-page", portId: "continue" },
      to: { nodeId: "repeat-options-done", portId: "in" },
    },
  ],
};

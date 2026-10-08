import type { ConditionalVisibility, GraphData } from "../viewer/types/graph";

/**
 * Two conditions under `match: "any"` — on an answer option and on a field in
 * a page. The panel edits only the first; the second and the "any" must come
 * through an edit untouched (29/9: every edit wrote `conditions` back as one).
 * Such a guide is not built in the card today, but it is valid data: an
 * import, a hand-written file, an older editor.
 */
const TWO: ConditionalVisibility = {
  match: "any",
  conditions: [
    { id: "first", variableName: "org", operator: "equals", value: "ja" },
    { id: "second", variableName: "customer", operator: "equals", value: "ja" },
  ],
};

export const visibilityTwoConditionsGraph: GraphData = {
  startNodeId: "org",
  nodes: [
    {
      id: "org",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: "Vill du ange organisation?",
        variableName: "org",
        options: [
          { id: "org-yes", label: "Ja", value: "ja" },
          { id: "org-no", label: "Nej", value: "nej" },
        ],
      },
    },
    {
      id: "customer",
      type: "question",
      position: { x: 0, y: 300 },
      data: {
        title: "Är du redan kund?",
        variableName: "customer",
        options: [
          { id: "customer-yes", label: "Ja", value: "ja" },
          { id: "customer-no", label: "Nej", value: "nej" },
        ],
      },
    },
    {
      id: "applicant",
      type: "question",
      position: { x: 400, y: 0 },
      data: {
        title: "Vem ansöker?",
        variableName: "applicant",
        options: [
          { id: "applicant-private", label: "Privatperson", value: "privat" },
          { id: "applicant-company", label: "Företag", value: "foretag", visibility: structuredClone(TWO) },
        ],
      },
    },
    { id: "details", type: "page", position: { x: 800, y: 0 }, data: { title: "Uppgifter" } },
    {
      id: "company-name",
      type: "text-question",
      parentPageId: "details",
      order: 0,
      position: { x: 0, y: 0 },
      data: { title: "Företagets namn", variableName: "companyName" },
      visibility: structuredClone(TWO),
    },
  ],
  connections: [],
} as unknown as GraphData;

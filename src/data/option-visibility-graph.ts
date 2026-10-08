import type { GraphData, QuestionOption } from "../viewer/types/graph";

/**
 * Konceptbild 3 (29/9): *Företag* visas när besökaren svarat *Ja* på frågan
 * före. Två vanliga frågor — inte en sida — så villkoret prövas där
 * konceptet ritar det: på ett alternativ i en fråga.
 *
 * `conditional: false` = reglaget av, som editorn lagrar det: utan `visibility`.
 */
export function optionVisibilityGraph(conditional: boolean): GraphData {
  const company: QuestionOption = { id: "applicant-company", label: "Företag", value: "foretag" };

  if (conditional) {
    company.visibility = {
      match: "all",
      conditions: [{ id: "company-if-org", variableName: "org", operator: "equals", value: "ja" }],
    };
  }

  return {
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
        id: "applicant",
        type: "question",
        position: { x: 400, y: 0 },
        data: {
          title: "Vem ansöker?",
          variableName: "applicant",
          options: [{ id: "applicant-private", label: "Privatperson", value: "privat" }, company],
        },
      },
      { id: "done", type: "result", position: { x: 800, y: 0 }, data: { title: "Tack" } },
    ],
    connections: [
      { id: "c-yes", from: { nodeId: "org", portId: "org-yes" }, to: { nodeId: "applicant", portId: "input" } },
      { id: "c-no", from: { nodeId: "org", portId: "org-no" }, to: { nodeId: "applicant", portId: "input" } },
      { id: "c-private", from: { nodeId: "applicant", portId: "applicant-private" }, to: { nodeId: "done", portId: "input" } },
      { id: "c-company", from: { nodeId: "applicant", portId: "applicant-company" }, to: { nodeId: "done", portId: "input" } },
    ],
  } as GraphData;
}

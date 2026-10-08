/**
 * A guide whose texts link the way a real site writes its links — relative,
 * mostly — for the link filter's test (src/viewer/services/formatted-text-links.test.ts).
 *
 * The filter was found refusing them in a guide imported from an agency's
 * site: six links, all written `/kontakta-oss/….html`, none rendered. That
 * guide is the agency's text and stays out of the open FlowWeaver (decision 8,
 * 2026-10-05); this one is ours and carries the same six shapes — a path from
 * the root, a deeper path, a sibling, an explicit `./`, an anchor, and one
 * absolute address — spread over a question, its help and two results, the
 * way they sat there (2026-10-07).
 */
import type { GraphData } from "../viewer/types/graph";

export const relativeLinksGraph: GraphData = {
  startNodeId: "fraga",
  nodes: [
    {
      id: "fraga",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: "Vill du anställa någon från ett annat land?",
        description:
          "Läs först om [vem som behöver arbetstillstånd](/arbetsgivare/arbetstillstand.html) och om [reglerna för säsongsarbete](/arbetsgivare/sasongsarbete/regler-for-sasongsarbete.html).",
        variableName: "anstalla",
        options: [
          { id: "ja", label: "Ja", value: "ja" },
          { id: "nej", label: "Nej", value: "nej" },
        ],
      },
    },
    {
      id: "resultat-ja",
      type: "result",
      position: { x: 360, y: -120 },
      data: {
        title: "Du kan ansöka åt den du vill anställa",
        description:
          "Se [hur ansökan går till](ansokan.html) och [vad den kostar](./avgifter.html). Längst ned finns [frågor och svar](#vanliga-fragor).",
      },
    },
    {
      id: "resultat-nej",
      type: "result",
      position: { x: 360, y: 120 },
      data: {
        title: "Då behövs inget tillstånd",
        description: "Har du frågor kan du [kontakta oss](https://example.se/kontakt).",
      },
    },
  ],
  connections: [
    { id: "c-ja", from: { nodeId: "fraga", portId: "ja" }, to: { nodeId: "resultat-ja", portId: "input" } },
    { id: "c-nej", from: { nodeId: "fraga", portId: "nej" }, to: { nodeId: "resultat-nej", portId: "input" } },
  ],
};

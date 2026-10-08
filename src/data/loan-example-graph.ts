import type { GraphData } from "../viewer/types/graph";

/**
 * Hur mycket banken kan låna ut — en liten guide byggd för att pröva en ändring.
 *
 * ## Varför den finns
 *
 * Johans prov: några frågor, en uträkning, och sedan **ändra månadslönen**. Den
 * ska visa vad som händer när ett svar tidigt i kedjan görs om — vilket i dag
 * betyder att allt efter det kastas, eftersom `previous()` poppar hela
 * tillståndet framför sig.
 *
 * Den är avsiktligt kort och avsiktligt räknande: lönen matar en beräkning, och
 * beräkningen matar beskedet. Ändras lönen ska beloppet ändras — och de svar som
 * inte påverkas av regler ska stå kvar. Det är hela hypotesen, och den här
 * guiden är hur vi ser den.
 *
 * Siffrorna är påhittade och medvetet grova: fem årsinkomster som tak och en
 * kontantinsats på femton procent är tumregler, inte någon banks villkor. En
 * guide som låtsas vara ett besked är värre än en som räknar öppet fel.
 */
export const loanExampleGraph: GraphData = {
  startNodeId: "ln-lon",
  nodes: [
    {
      id: "ln-lon",
      type: "number-question",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Vad har du i månadslön före skatt?", en: "What is your monthly salary before tax?" },
        description: { sv: "Ungefär räcker.", en: "Roughly is enough." },
        variableName: "manadslon",
        unit: "kr",
        min: 0,
        required: true,
      },
    },
    {
      id: "ln-medsokande",
      type: "question",
      position: { x: 380, y: 0 },
      data: {
        title: { sv: "Söker du ensam eller tillsammans med någon?", en: "Are you applying alone or with someone?" },
        variableName: "medsokande",
        options: [
          { id: "ensam", label: { sv: "Ensam" }, value: "ensam" },
          { id: "tva", label: { sv: "Tillsammans" }, value: "tva" },
        ],
      },
    },
    {
      /*
       * Den andra lönen frågas bara av den som söker tillsammans. Det är därför
       * den finns: en ändring av `medsokande` **ändrar vägen**, medan en ändring
       * av `manadslon` inte gör det. Två fall att pröva mot i samma guide.
       */
      id: "ln-lon2",
      type: "number-question",
      position: { x: 760, y: 140 },
      data: {
        title: { sv: "Vad har den andra i månadslön före skatt?", en: "And the other person's monthly salary?" },
        variableName: "manadslon2",
        unit: "kr",
        min: 0,
        required: true,
      },
    },
    {
      /*
       * Noll åt den som söker ensam.
       *
       * Utan den saknar `manadslon2` värde, och en formel som nämner en variabel
       * ingen svarat på gör att **hela** uppsättningen tilldelningar tyst
       * producerar ingenting — mätt: `{manadslon, sparat}` in, samma ut, utan
       * felmeddelande. Ett tomt besked utan förklaring är det sämsta av utfallen,
       * så grenen ger variabeln ett värde i stället.
       */
      id: "ln-ensam",
      type: "calculation",
      position: { x: 760, y: -140 },
      data: {
        title: { sv: "Ensam sökande", en: "Applying alone" },
        assignments: [{ id: "ln-a0", variableName: "manadslon2", formula: "0" }],
      },
    },
    {
      id: "ln-kontant",
      type: "number-question",
      position: { x: 1140, y: 0 },
      data: {
        title: { sv: "Hur mycket har du sparat till kontantinsats?", en: "How much have you saved for the deposit?" },
        variableName: "sparat",
        unit: "kr",
        min: 0,
        required: true,
      },
    },
    {
      id: "ln-calc",
      type: "calculation",
      position: { x: 1520, y: 0 },
      data: {
        title: { sv: "Räkna ut vad det räcker till", en: "Work out what it comes to" },
        assignments: [
          { id: "ln-a1", variableName: "arsinkomst", formula: "(manadslon + manadslon2) * 12" },
          /* Fem årsinkomster: en tumregel, inte någon banks villkor. */
          { id: "ln-a2", variableName: "maxlan", formula: "arsinkomst * 5" },
          /* Kontantinsatsen är minst 15 %, så bostaden kan kosta högst det sparade delat med 0,15. */
          { id: "ln-a3", variableName: "maxpris", formula: "round(min(maxlan / 0,85 ; sparat / 0,15))" },
        ],
      },
    },
    {
      id: "ln-resultat",
      type: "result",
      position: { x: 1900, y: 0 },
      data: {
        title: { sv: "Så här mycket kan du låna", en: "This is what you could borrow" },
        description: {
          sv: "Med en årsinkomst på **{{arsinkomst}} kr** kan du låna upp till **{{maxlan}} kr**. Med {{sparat}} kr sparat räcker det till en bostad för ungefär **{{maxpris}} kr**.\n\nSiffrorna är tumregler och inte ett besked från en bank.",
          en: "On an annual income of **{{arsinkomst}} kr** you could borrow up to **{{maxlan}} kr**. With {{sparat}} kr saved that reaches a home of about **{{maxpris}} kr**.\n\nThese are rules of thumb, not a decision from a bank.",
        },
      },
    },
  ],
  connections: [
    { id: "ln-c1", from: { nodeId: "ln-lon", portId: "continue" }, to: { nodeId: "ln-medsokande", portId: "input" } },
    { id: "ln-c2", from: { nodeId: "ln-medsokande", portId: "ensam" }, to: { nodeId: "ln-ensam", portId: "input" } },
    { id: "ln-c2b", from: { nodeId: "ln-ensam", portId: "continue" }, to: { nodeId: "ln-kontant", portId: "input" } },
    { id: "ln-c3", from: { nodeId: "ln-medsokande", portId: "tva" }, to: { nodeId: "ln-lon2", portId: "input" } },
    { id: "ln-c4", from: { nodeId: "ln-lon2", portId: "continue" }, to: { nodeId: "ln-kontant", portId: "input" } },
    { id: "ln-c5", from: { nodeId: "ln-kontant", portId: "continue" }, to: { nodeId: "ln-calc", portId: "input" } },
    { id: "ln-c6", from: { nodeId: "ln-calc", portId: "continue" }, to: { nodeId: "ln-resultat", portId: "input" } },
  ],
  settings: { sourceLocale: "sv", locales: ["sv"] },
};

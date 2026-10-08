import type { GraphData } from "../viewer/types/graph";

/**
 * An example guide for a government agency: Försäkringskassan's basis for
 * housing allowance. Demonstrates the Inmatning module — free text with format
 * validation (personnummer) and number fields with min/max (housing cost, floor
 * area, income). The guide only gathers details; nothing is computed (that would
 * be Logik). A simplified example — not a real application.
 */
export const housingAllowanceExampleGraph: GraphData = {
  startNodeId: "ba-personnummer",
  nodes: [
    {
      id: "ba-personnummer",
      type: "text-question",
      position: { x: -660, y: 0 },
      data: {
        title: { sv: "Ditt personnummer", en: "Your identity number" },
        description: { sv: "Vi använder det för att hämta rätt uppgifter. Skriv i formatet ÅÅÅÅMMDD-XXXX.", en: "We use it to fetch the right details. Write it as YYYYMMDD-XXXX." },
        variableName: "personnummer",
        variableLabel: { sv: "Personnummer", en: "Personal identity number" },
        placeholder: { sv: "ÅÅÅÅMMDD-XXXX", en: "YYYYMMDD-XXXX" },
        presentation: "input",
        required: true,
        minLength: null,
        maxLength: null,
        format: "personnummer",
        pattern: "",
        cssClasses: "",
      },
    },
    {
      id: "ba-boendekostnad",
      type: "number-question",
      position: { x: -220, y: 0 },
      data: {
        title: { sv: "Vad är din boendekostnad per månad?", en: "What is your housing cost per month?" },
        description: { sv: "Hyra eller avgift plus eventuell ränta. Ange i hela kronor.", en: "Rent or charges plus any interest. In whole kronor." },
        variableName: "boendekostnad",
        variableLabel: { sv: "Boendekostnad (kr/mån)", en: "Housing cost (SEK/month)" },
        min: 0,
        max: 50000,
        step: 100,
        unit: { sv: "kr/mån", en: "kr/month" },
      },
    },
    {
      id: "ba-bostadsyta",
      type: "number-question",
      position: { x: 220, y: 0 },
      data: {
        title: { sv: "Hur stor är bostaden?", en: "How large is the home?" },
        description: { sv: "Bostadens yta i kvadratmeter.", en: "The floor area in square metres." },
        variableName: "bostadsyta",
        variableLabel: { sv: "Bostadsyta (m²)", en: "Living area (m²)" },
        min: 1,
        max: 500,
        step: 1,
        unit: "m²",
      },
    },
    {
      id: "ba-arsinkomst",
      type: "number-question",
      position: { x: 660, y: 0 },
      data: {
        title: { sv: "Vad är hushållets årsinkomst före skatt?", en: "What is the household's yearly income before tax?" },
        description: { sv: "Alla i hushållets inkomster tillsammans, i hela kronor per år.", en: "Everyone's income together, in whole kronor per year." },
        variableName: "arsinkomst",
        variableLabel: { sv: "Hushållets årsinkomst (kr)", en: "Household's yearly income (SEK)" },
        min: 0,
        max: 2000000,
        step: 1000,
        unit: { sv: "kr/år", en: "kr/year" },
      },
    },
    {
      id: "ba-klart",
      type: "result",
      position: { x: 1100, y: 0 },
      data: {
        title: { sv: "Tack – underlaget är komplett", en: "Thank you – the details are complete" },
        description: { sv: "Vi har tagit emot dina uppgifter. I en riktig e-tjänst skulle Försäkringskassan nu räkna ut ett preliminärt bostadsbidrag utifrån boendekostnad, bostadsyta och inkomst.\n\nFörenklat exempel – för en riktig ansökan, se forsakringskassan.se.", en: "We have your details. In a real e-service the agency would now work out a preliminary housing allowance from the housing cost, the floor area and the income.\n\nA simplified example – for a real application, see forsakringskassan.se." },
      },
    },
  ],
  connections: [
    {
      id: "ba-c1",
      from: { nodeId: "ba-personnummer", portId: "continue" },
      to: { nodeId: "ba-boendekostnad", portId: "input" },
    },
    {
      id: "ba-c2",
      from: { nodeId: "ba-boendekostnad", portId: "continue" },
      to: { nodeId: "ba-bostadsyta", portId: "input" },
    },
    {
      id: "ba-c3",
      from: { nodeId: "ba-bostadsyta", portId: "continue" },
      to: { nodeId: "ba-arsinkomst", portId: "input" },
    },
    {
      id: "ba-c4",
      from: { nodeId: "ba-arsinkomst", portId: "continue" },
      to: { nodeId: "ba-klart", portId: "input" },
    },
  ],
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
};

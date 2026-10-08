import type { GraphData } from "../viewer/types/graph";

/**
 * The wayfinder: "Hitta rätt e-tjänst."
 *
 * Johans fjärde kort till redaktionssidan (2026-08-25): en enkel guide som
 * vägleder till vilken e-tjänst eller guide man ska välja. Den är meta med
 * flit — resultaten pekar på de andra exemplen, så den som provar ser
 * kedjan guide → e-tjänst i praktiken: en vägvisare är ofta det första en
 * kommun bygger, och den enklaste guiden som gör verklig nytta.
 */
export const serviceFinderExampleGraph: GraphData = {
  startNodeId: "sf-start",
  nodes: [
    {
      id: "sf-start",
      type: "question",
      position: { x: -560, y: 0 },
      data: {
        title: { sv: "Vad behöver du hjälp med i dag?", en: "What do you need help with today?" },
        description: { sv: "Välj det som ligger närmast, så leder vi dig rätt.", en: "Pick whatever is closest, and we will point you right." },
        variableName: "arende",
        variableLabel: { sv: "Ärende", en: "Matter" },
        options: [
          { id: "sf-s-fel", label: { sv: "Något är trasigt eller skräpigt utomhus", en: "Something outdoors is broken or littered" }, value: "fel" },
          { id: "sf-s-eko", label: { sv: "Ekonomiskt stöd till boendet", en: "Financial support for housing" }, value: "ekonomi" },
          { id: "sf-s-krangel", label: { sv: "Något hemma krånglar", en: "Something at home is acting up" }, value: "krangel" },
        ],
      },
    },
    {
      id: "sf-eko",
      type: "question",
      position: { x: -120, y: 160 },
      data: {
        title: { sv: "Vet du redan om du kan ha rätt till bostadsbidrag?", en: "Do you already know whether you might be eligible for housing allowance?" },
        variableName: "koll",
        variableLabel: { sv: "Vet redan", en: "Already knows" },
        options: [
          { id: "sf-e-nej", label: { sv: "Nej — jag vill ta reda på det först", en: "No — I want to find out first" }, value: "nej" },
          { id: "sf-e-ja", label: { sv: "Ja — jag vill lämna mina uppgifter", en: "Yes — I want to submit my details" }, value: "ja" },
        ],
      },
    },
    {
      id: "sf-r-fel",
      type: "result",
      position: { x: 340, y: -260 },
      data: {
        title: { sv: "Använd e-tjänsten Felanmälan", en: "Use the Fault report e-service" },
        description: {
          sv: "Där pekar du ut platsen på en karta, söker fram en kategori och kan bifoga ett foto där du markerar skadan med prickar.\n\nDu hittar den under Felanmälan på kommunens webbplats.",
          en: "There you point out the place on a map, search for a category and can attach a photo where you mark the damage with dots.\n\nYou will find it under Fault report on the municipality's website.",
        },
      },
    },
    {
      id: "sf-r-guide",
      type: "result",
      position: { x: 340, y: 280 },
      data: {
        title: { sv: "Börja med guiden om bostadsbidrag", en: "Start with the housing allowance guide" },
        description: {
          sv: "Guiden ställer ett par frågor och säger direkt om det är värt att gå vidare — innan du fyller i en enda blankett.",
          en: "The guide asks a couple of questions and says straight away whether it is worth going further — before you fill in a single form.",
        },
      },
    },
    {
      id: "sf-r-tjanst",
      type: "result",
      position: { x: 340, y: 710 },
      data: {
        title: { sv: "Använd e-tjänsten Bostadsbidrag – underlag", en: "Use the Housing allowance e-service" },
        description: {
          sv: "Där lämnar du uppgifter om boende och inkomst, med validering i varje fält så inget behöver kompletteras i efterhand.",
          en: "There you submit details about housing and income, with validation on every field so nothing needs topping up afterwards.",
        },
      },
    },
    {
      id: "sf-r-felsok",
      type: "result",
      position: { x: 340, y: 1160 },
      data: {
        title: { sv: "Prova felsökningsguiden", en: "Try the troubleshooting guide" },
        description: {
          sv: "Den ställer en fråga i taget och slutar i en åtgärd — något att göra, inte bara ett besked.",
          en: "It asks one question at a time and ends in an action — something to do, not just a notice.",
        },
      },
    },
  ],
  connections: [
    { id: "sf-1", from: { nodeId: "sf-start", portId: "sf-s-fel" }, to: { nodeId: "sf-r-fel", portId: "input" } },
    { id: "sf-2", from: { nodeId: "sf-start", portId: "sf-s-eko" }, to: { nodeId: "sf-eko", portId: "input" } },
    { id: "sf-3", from: { nodeId: "sf-start", portId: "sf-s-krangel" }, to: { nodeId: "sf-r-felsok", portId: "input" } },
    { id: "sf-4", from: { nodeId: "sf-eko", portId: "sf-e-nej" }, to: { nodeId: "sf-r-guide", portId: "input" } },
    { id: "sf-5", from: { nodeId: "sf-eko", portId: "sf-e-ja" }, to: { nodeId: "sf-r-tjanst", portId: "input" } },
  ],
  settings: { sourceLocale: "sv" },
};

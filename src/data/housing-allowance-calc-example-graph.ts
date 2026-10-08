import type { GraphData } from "../viewer/types/graph";

/**
 * A logic variant of the housing allowance example (Försäkringskassan): gathers
 * details and then *computes* a preliminary monthly allowance with a calculation
 * node, branching with a rule depending on whether there is any allowance at
 * all. Demonstrates the Logik module (calculations plus rules) on top of
 * Inmatning.
 *
 * The formula is a heavily simplified approximation — not Försäkringskassan's
 * real model. For an actual application, see forsakringskassan.se.
 *
 * No identity number (Johan 8/10): the formula never used it, and free text is
 * PRO's — an open example the open editor cannot rebuild is not open. The
 * details guide beside it, which collects one, is PRO's for the same reason.
 */
export const housingAllowanceCalcExampleGraph: GraphData = {
  startNodeId: "bc-boendekostnad",
  nodes: [
    {
      id: "bc-boendekostnad",
      type: "number-question",
      position: { x: -560, y: 0 },
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
      id: "bc-antalBarn",
      type: "number-question",
      position: { x: -240, y: 0 },
      data: {
        title: { sv: "Hur många barn bor i hushållet?", en: "How many children live in the household?" },
        description: { sv: "Barn som bor hos dig minst halva tiden.", en: "Children who live with you at least half the time." },
        variableName: "antalBarn",
        variableLabel: { sv: "Antal barn", en: "Number of children" },
        min: 0,
        max: 12,
        step: 1,
        unit: { sv: "barn", en: "children" },
      },
    },
    {
      id: "bc-arsinkomst",
      type: "number-question",
      position: { x: 80, y: 0 },
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
      id: "bc-calc",
      type: "calculation",
      position: { x: 400, y: 0 },
      data: {
        title: { sv: "Räkna ut preliminärt bidrag", en: "Work out a preliminary allowance" },
        assignments: [
          {
            id: "bc-a1",
            variableName: "ersattningsgrundande",
            label: { sv: "Ersättningsgrundande kostnad", en: "Eligible cost" },
            formula: "min(boendekostnad ; 5000)",
          },
          {
            id: "bc-a2",
            variableName: "grundbelopp",
            label: { sv: "Grundbelopp", en: "Base amount" },
            formula: "0.5 * ersattningsgrundande",
          },
          {
            id: "bc-a3",
            variableName: "barntillagg",
            label: { sv: "Barntillägg", en: "Child supplement" },
            formula: "antalBarn * 1500",
          },
          {
            id: "bc-a4",
            variableName: "inkomstavdrag",
            label: { sv: "Inkomstavdrag", en: "Income deduction" },
            formula: "max(0 ; (arsinkomst - 150000) / 12 * 0.2)",
          },
          {
            id: "bc-a5",
            variableName: "manadsbidrag",
            label: { sv: "Månadsbidrag", en: "Monthly allowance" },
            formula: "max(0 ; round(grundbelopp + barntillagg - inkomstavdrag))",
          },
        ],
      },
    },
    {
      id: "bc-rule",
      type: "rule",
      position: { x: 720, y: 0 },
      data: {
        title: { sv: "Blev det något bidrag?", en: "Was there any allowance?" },
        cases: [
          {
            id: "bc-har-bidrag",
            label: "Har rätt till bidrag",
            match: "all",
            conditions: [
              {
                id: "bc-cond1",
                variableName: "manadsbidrag",
                operator: "greater-than",
                value: "0",
              },
            ],
          },
        ],
        fallbackLabel: "Inget bidrag",
      },
    },
    {
      id: "bc-har-bidrag",
      type: "result",
      position: { x: 1060, y: -180 },
      data: {
        title: { sv: "Du kan ha rätt till bostadsbidrag", en: "You may be entitled to housing allowance" },
        description: { sv: "Utifrån dina uppgifter kan du preliminärt ha rätt till ungefär **{{manadsbidrag}} kr/mån** i bostadsbidrag.\n\nDet här är en förenklad uppskattning med en schablonformel – inte ett beslut. För en riktig ansökan, se forsakringskassan.se.", en: "From your details you may preliminarily be entitled to about **{{manadsbidrag}} kr a month** in housing allowance.\n\nThis is a simplified estimate from a standard formula – not a decision. For a real application, see forsakringskassan.se." },
      },
    },
    {
      id: "bc-inget-bidrag",
      type: "result",
      position: { x: 1060, y: 410 },
      data: {
        title: { sv: "Inget preliminärt bostadsbidrag", en: "No preliminary housing allowance" },
        description: { sv: "Utifrån dina uppgifter ser det inte ut som att du har rätt till bostadsbidrag just nu – boendekostnaden och inkomsten ger en schablon på 0 kr.\n\nDet här är en förenklad uppskattning – inte ett beslut. För en riktig ansökan, se forsakringskassan.se.", en: "From your details it does not look as though you are entitled to housing allowance right now – the housing cost and the income give a standard figure of 0 kr.\n\nThis is a simplified estimate – not a decision. For a real application, see forsakringskassan.se." },
      },
    },
  ],
  connections: [
    {
      id: "bc-c2",
      from: { nodeId: "bc-boendekostnad", portId: "continue" },
      to: { nodeId: "bc-antalBarn", portId: "input" },
    },
    {
      id: "bc-c3",
      from: { nodeId: "bc-antalBarn", portId: "continue" },
      to: { nodeId: "bc-arsinkomst", portId: "input" },
    },
    {
      id: "bc-c4",
      from: { nodeId: "bc-arsinkomst", portId: "continue" },
      to: { nodeId: "bc-calc", portId: "input" },
    },
    {
      id: "bc-c5",
      from: { nodeId: "bc-calc", portId: "continue" },
      to: { nodeId: "bc-rule", portId: "input" },
    },
    {
      id: "bc-c6",
      from: { nodeId: "bc-rule", portId: "bc-har-bidrag" },
      to: { nodeId: "bc-har-bidrag", portId: "input" },
    },
    {
      id: "bc-c7",
      from: { nodeId: "bc-rule", portId: "default" },
      to: { nodeId: "bc-inget-bidrag", portId: "input" },
    },
  ],
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
};

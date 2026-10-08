import type { GraphData } from "../viewer/types/graph";

/**
 * Underlaget till Astras designvända om regeleditorn och uträkningarna
 * (29/9 2026). Konferensfixturen har en regel med ett villkor och en
 * uträkning med en rad — det visar inte det panelen faktiskt måste bära.
 * Den här grafen har varje sort villkor och rad som panelen ritar olika:
 *
 * - en regel med två villkor under `all` (flerval med `all-of` → chip-
 *   väljare för flera; envalsfråga med `one-of`),
 * - en regel med ett villkor mot ett tal (fritt talfält),
 * - en regel med två villkor under `any` (enval `equals` → chip-väljare för
 *   ett; text `equals` → fritt textfält),
 * - utfallet *Annars* med eget namn,
 * - en uträkning med tre rader där den tredje läser de två första och
 *   använder funktioner, alla med etikett.
 *
 * Riggen `e2e/rule-calc-astra-shots.mjs` läser den. Ett textfält på en
 * sida med "visas om" finns med för att den delade villkorsraden ska synas
 * på sitt tredje ställe (regel, fältets synlighet, alternativets synlighet)
 * — panelen ritar "visas om" bara för fält som ligger på en sida.
 */
export const ruleCalcAstraGraph: GraphData = {
  startNodeId: "rc-housing",
  nodes: [
    {
      id: "rc-housing",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Hur bor du?", en: "How do you live?" },
        variableName: "boende",
        variableLabel: { sv: "Boendeform", en: "Housing" },
        options: [
          { id: "rc-h-rent", label: { sv: "Hyresrätt", en: "Rented flat" }, value: "hyresratt" },
          { id: "rc-h-coop", label: { sv: "Bostadsrätt", en: "Owned flat" }, value: "bostadsratt" },
          { id: "rc-h-house", label: { sv: "Villa eller radhus", en: "House" }, value: "villa" },
        ],
      },
    },
    {
      id: "rc-citizenship",
      type: "multi-choice",
      position: { x: 400, y: 0 },
      data: {
        title: { sv: "Vilka medborgarskap har du?", en: "Which citizenships do you hold?" },
        variableName: "medborgarskap",
        variableLabel: { sv: "Medborgarskap", en: "Citizenship" },
        options: [
          { id: "rc-c-se", label: { sv: "Sverige", en: "Sweden" }, value: "SE" },
          { id: "rc-c-dk", label: { sv: "Danmark", en: "Denmark" }, value: "DK" },
          { id: "rc-c-no", label: { sv: "Norge", en: "Norway" }, value: "NO" },
          { id: "rc-c-fi", label: { sv: "Finland", en: "Finland" }, value: "FI" },
          { id: "rc-c-de", label: { sv: "Tyskland", en: "Germany" }, value: "DE" },
          { id: "rc-c-tr", label: { sv: "Turkiet", en: "Türkiye" }, value: "TR" },
        ],
      },
    },
    {
      id: "rc-income",
      type: "number-question",
      position: { x: 800, y: 0 },
      data: {
        title: { sv: "Hushållets inkomst per månad", en: "Household income per month" },
        variableName: "inkomst",
        variableLabel: { sv: "Inkomst", en: "Income" },
        unit: { sv: "kr", en: "SEK" },
        min: 0,
      },
    },
    {
      id: "rc-children",
      type: "number-question",
      position: { x: 1200, y: 0 },
      data: {
        title: { sv: "Antal barn som bor hos dig", en: "Children living with you" },
        variableName: "barn",
        variableLabel: { sv: "Antal barn", en: "Children" },
        min: 0,
        max: 12,
      },
    },
    { id: "rc-page", type: "page", position: { x: 1600, y: 0 }, data: { title: { sv: "Adress", en: "Address" } } },
    {
      id: "rc-town",
      type: "text-question",
      parentPageId: "rc-page",
      order: 0,
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Postort", en: "Town" },
        variableName: "postort",
      },
      visibility: {
        match: "all",
        conditions: [{ id: "rc-town-if-house", variableName: "boende", operator: "equals", value: "villa" }],
      },
    },
    {
      id: "rc-calc",
      type: "calculation",
      position: { x: 2000, y: 0 },
      data: {
        title: { sv: "Räkna ut bidraget", en: "Work out the allowance" },
        assignments: [
          {
            id: "rc-a-base",
            variableName: "grund",
            label: { sv: "Grundbelopp", en: "Base amount" },
            formula: "inkomst * 0.1",
          },
          {
            id: "rc-a-children",
            variableName: "barntillagg",
            label: { sv: "Barntillägg", en: "Child supplement" },
            formula: "barn * 1500",
          },
          {
            id: "rc-a-total",
            variableName: "bidrag",
            label: { sv: "Bidrag per månad", en: "Allowance per month" },
            formula: "round(min(grund + barntillagg; 9000))",
          },
        ],
      },
    },
    {
      id: "rc-rule",
      type: "rule",
      position: { x: 2400, y: 0 },
      data: {
        title: { sv: "Vilket besked?", en: "Which outcome?" },
        cases: [
          {
            id: "rc-case-nordic",
            label: "Nordisk i lägenhet",
            match: "all",
            conditions: [
              { id: "rc-cond-nordic", variableName: "medborgarskap", operator: "all-of", value: "SE,DK,NO,FI" },
              { id: "rc-cond-flat", variableName: "boende", operator: "one-of", value: "hyresratt,bostadsratt" },
            ],
          },
          {
            id: "rc-case-income",
            label: "Hög inkomst",
            match: "all",
            conditions: [
              { id: "rc-cond-income", variableName: "inkomst", operator: "greater-than", value: "60000" },
            ],
          },
          {
            id: "rc-case-house",
            label: "Villa eller Malmö",
            match: "any",
            conditions: [
              { id: "rc-cond-house", variableName: "boende", operator: "equals", value: "villa" },
              { id: "rc-cond-town", variableName: "postort", operator: "equals", value: "Malmö" },
            ],
          },
        ],
        fallbackLabel: "Vanligt besked",
      },
    },
    { id: "rc-r-nordic", type: "result", position: { x: 2900, y: -240 }, data: { title: { sv: "Besked: nordisk", en: "Outcome: Nordic" } } },
    { id: "rc-r-income", type: "result", position: { x: 2900, y: -80 }, data: { title: { sv: "Besked: hög inkomst", en: "Outcome: high income" } } },
    { id: "rc-r-house", type: "result", position: { x: 2900, y: 80 }, data: { title: { sv: "Besked: villa", en: "Outcome: house" } } },
    { id: "rc-r-default", type: "result", position: { x: 2900, y: 240 }, data: { title: { sv: "Vanligt besked", en: "Ordinary outcome" } } },
  ],
  connections: [
    { id: "rc-1a", from: { nodeId: "rc-housing", portId: "rc-h-rent" }, to: { nodeId: "rc-citizenship", portId: "input" } },
    { id: "rc-1b", from: { nodeId: "rc-housing", portId: "rc-h-coop" }, to: { nodeId: "rc-citizenship", portId: "input" } },
    { id: "rc-1c", from: { nodeId: "rc-housing", portId: "rc-h-house" }, to: { nodeId: "rc-citizenship", portId: "input" } },
    { id: "rc-2", from: { nodeId: "rc-citizenship", portId: "continue" }, to: { nodeId: "rc-income", portId: "input" } },
    { id: "rc-3", from: { nodeId: "rc-income", portId: "continue" }, to: { nodeId: "rc-children", portId: "input" } },
    { id: "rc-4", from: { nodeId: "rc-children", portId: "continue" }, to: { nodeId: "rc-page", portId: "input" } },
    { id: "rc-5", from: { nodeId: "rc-page", portId: "continue" }, to: { nodeId: "rc-calc", portId: "input" } },
    { id: "rc-6", from: { nodeId: "rc-calc", portId: "continue" }, to: { nodeId: "rc-rule", portId: "input" } },
    { id: "rc-7a", from: { nodeId: "rc-rule", portId: "rc-case-nordic" }, to: { nodeId: "rc-r-nordic", portId: "input" } },
    { id: "rc-7b", from: { nodeId: "rc-rule", portId: "rc-case-income" }, to: { nodeId: "rc-r-income", portId: "input" } },
    { id: "rc-7c", from: { nodeId: "rc-rule", portId: "rc-case-house" }, to: { nodeId: "rc-r-house", portId: "input" } },
    { id: "rc-7d", from: { nodeId: "rc-rule", portId: "default" }, to: { nodeId: "rc-r-default", portId: "input" } },
  ],
} as GraphData;

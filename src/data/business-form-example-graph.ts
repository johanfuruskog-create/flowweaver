import type { GraphData } from "../viewer/types/graph";

/**
 * An example guide for starting a business: "Vilken bolagsform passar dig?" A
 * simple decision guide with questions branching to different results. A
 * simplified example — not legal advice.
 */
export const businessFormExampleGraph: GraphData = {
  startNodeId: "bf-solo",
  nodes: [
    {
      id: "bf-solo",
      type: "question",
      position: { x: -640, y: 0 },
      data: {
        title: { sv: "Startar du ensam eller tillsammans med andra?", en: "Are you starting alone or with others?" },
        description: { sv: "Välj det som stämmer för dig just nu.", en: "Choose what is true for you right now." },
        variableName: "founders",
        variableLabel: { sv: "Antal grundare", en: "Number of founders" },
        options: [
          { id: "bf-solo-alone", label: { sv: "Ensam", en: "Alone" }, value: "alone" },
          { id: "bf-solo-together", label: { sv: "Tillsammans med andra", en: "With others" }, value: "together" },
        ],
      },
    },
    {
      id: "bf-goal",
      type: "question",
      position: { x: -200, y: -240 },
      data: {
        title: { sv: "Vad är viktigast för dig i början?", en: "What matters most to you at the start?" },
        description: { sv: "Det styr ofta valet mellan enskild firma och aktiebolag.", en: "That often decides between a sole trader and a limited company." },
        variableName: "priority",
        variableLabel: { sv: "Prioritet", en: "Priority" },
        options: [
          { id: "bf-goal-simple", label: { sv: "Enkelt och billigt att komma igång", en: "Simple and cheap to get going" }, value: "simple" },
          { id: "bf-goal-separate", label: { sv: "Skilja min privatekonomi från företagets", en: "Keeping my own finances apart from the company's" }, value: "separate" },
        ],
      },
    },
    {
      id: "bf-team",
      type: "question",
      position: { x: -200, y: 290 },
      data: {
        title: { sv: "Hur vill ni dela ansvaret?", en: "How do you want to share the liability?" },
        description: { sv: "Personligt ansvar eller begränsat ansvar via aktiekapital.", en: "Personal liability, or limited liability through share capital." },
        variableName: "liability",
        variableLabel: { sv: "Ansvar", en: "Responsibility" },
        options: [
          { id: "bf-team-personal", label: { sv: "Vi tar personligt, gemensamt ansvar", en: "We take personal, joint liability" }, value: "personal" },
          { id: "bf-team-limited", label: { sv: "Vi vill ha begränsat ansvar", en: "We want limited liability" }, value: "limited" },
        ],
      },
    },
    {
      id: "bf-enskild",
      type: "result",
      position: { x: 280, y: -420 },
      data: {
        title: { sv: "Enskild firma passar dig", en: "A sole trader suits you" },
        description: { sv: "Enkelt och billigt att starta. Du och företaget är samma juridiska person, så du har personligt ansvar för skulder. Bra för att komma igång i liten skala.\n\nFörenklat exempel – för riktig vägledning, se verksamt.se.", en: "Simple and cheap to start. You and the company are the same legal person, so you are personally liable for its debts. Good for starting small.\n\nA simplified example – for real guidance, see verksamt.se." },
      },
    },
    {
      id: "bf-ab",
      type: "result",
      position: { x: 280, y: 140 },
      data: {
        title: { sv: "Aktiebolag passar dig", en: "A limited company suits you" },
        description: { sv: "Begränsat personligt ansvar och tydlig gräns mellan dig och företaget. Kräver 25 000 kr i aktiekapital och lite mer administration. Vanligt när man vill växa eller ta in delägare.\n\nFörenklat exempel – för riktig vägledning, se verksamt.se.", en: "Limited personal liability and a clear line between you and the company. Requires SEK 25,000 in share capital and a little more administration. Common when you want to grow or bring in part-owners.\n\nA simplified example – for real guidance, see verksamt.se." },
      },
    },
    {
      id: "bf-hb",
      type: "result",
      position: { x: 280, y: 700 },
      data: {
        title: { sv: "Handelsbolag kan passa er", en: "A trading partnership may suit you" },
        description: { sv: "Två eller fler delägare som driver företaget tillsammans, med personligt och solidariskt ansvar för skulderna. Enkelt att starta men var och en ansvarar fullt ut.\n\nFörenklat exempel – för riktig vägledning, se verksamt.se.", en: "Two or more partners running the company together, with personal and joint liability for its debts. Simple to start, but each of you is fully liable.\n\nA simplified example – for real guidance, see verksamt.se." },
      },
    },
  ],
  connections: [
    { id: "bf-c1", from: { nodeId: "bf-solo", portId: "bf-solo-alone" }, to: { nodeId: "bf-goal", portId: "input" } },
    { id: "bf-c2", from: { nodeId: "bf-solo", portId: "bf-solo-together" }, to: { nodeId: "bf-team", portId: "input" } },
    { id: "bf-c3", from: { nodeId: "bf-goal", portId: "bf-goal-simple" }, to: { nodeId: "bf-enskild", portId: "input" } },
    { id: "bf-c4", from: { nodeId: "bf-goal", portId: "bf-goal-separate" }, to: { nodeId: "bf-ab", portId: "input" } },
    { id: "bf-c5", from: { nodeId: "bf-team", portId: "bf-team-personal" }, to: { nodeId: "bf-hb", portId: "input" } },
    { id: "bf-c6", from: { nodeId: "bf-team", portId: "bf-team-limited" }, to: { nodeId: "bf-ab", portId: "input" } },
  ],
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
};

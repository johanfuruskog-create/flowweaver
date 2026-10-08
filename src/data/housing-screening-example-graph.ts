import type { GraphData } from "../viewer/types/graph";

/**
 * The narrative guide on the start page: a quick eligibility screening at a
 * government agency (Försäkringskassan) — "Kan du ha rätt till bostadsbidrag?"
 * Two questions are stored in variables, a Rule weighs the answers together and
 * branches to the right result. Demonstrates the whole idea of Question →
 * Options → Rule → Result. A simplified example — not a decision.
 */
export const housingScreeningExampleGraph: GraphData = {
  startNodeId: "hs-barn",
  nodes: [
    {
      id: "hs-barn",
      type: "question",
      position: { x: -680, y: 0 },
      data: {
        title: {
          sv: "Har du barn som bor hos dig?",
          en: "Do you have children living with you?",
          fi: "Asuuko luonasi lapsia?",
        },
        description: {
          sv: "Räkna barn som bor hos dig minst halva tiden.",
          en: "Count children who live with you at least half the time.",
          fi: "Laske mukaan lapset, jotka asuvat luonasi vähintään puolet ajasta.",
        },
        variableName: "harBarn",
        variableLabel: { sv: "Har barn", en: "Has children" },
        options: [
          { id: "hs-barn-ja", label: { sv: "Ja", en: "Yes", fi: "Kyllä" }, value: "ja" },
          { id: "hs-barn-nej", label: { sv: "Nej", en: "No", fi: "Ei" }, value: "nej" },
        ],
      },
    },
    {
      id: "hs-ung",
      type: "question",
      position: { x: -240, y: 0 },
      data: {
        title: {
          sv: "Är du under 29 år?",
          en: "Are you under 29?",
          fi: "Oletko alle 29-vuotias?",
        },
        description: {
          sv: "Bostadsbidrag för unga gäller dig som är 18–28 år.",
          en: "Housing allowance for young people applies if you are 18–28.",
          fi: "Nuorten asumistuki koskee 18–28-vuotiaita.",
        },
        variableName: "ungdom",
        variableLabel: { sv: "Under 29 år", en: "Under 29" },
        options: [
          { id: "hs-ung-ja", label: { sv: "Ja", en: "Yes", fi: "Kyllä" }, value: "ja" },
          { id: "hs-ung-nej", label: { sv: "Nej", en: "No", fi: "Ei" }, value: "nej" },
        ],
      },
    },
    {
      id: "hs-rule",
      type: "rule",
      position: { x: 200, y: 0 },
      data: {
        title: {
          sv: "Vem kan få bostadsbidrag?",
          en: "Who can get housing allowance?",
          fi: "Kuka voi saada asumistukea?",
        },
        cases: [
          {
            id: "hs-case-barn",
            label: "Barnfamilj",
            match: "all",
            conditions: [
              { id: "hs-c-barn", variableName: "harBarn", operator: "equals", value: "ja" },
            ],
          },
          {
            id: "hs-case-ung",
            label: "Ung",
            match: "all",
            conditions: [
              { id: "hs-c-ung", variableName: "ungdom", operator: "equals", value: "ja" },
            ],
          },
        ],
        fallbackLabel: "Annars",
      },
    },
    {
      id: "hs-r-barn",
      type: "result",
      position: { x: 640, y: -390 },
      data: {
        title: { sv: "Du kan ha rätt till bostadsbidrag", en: "You may be entitled to housing allowance" },
        description: { sv: "Barnfamiljer kan ofta få bostadsbidrag. Nästa steg är att fylla i dina uppgifter så att beloppet kan räknas ut.\n\nFörenklat exempel – för en riktig ansökan, se forsakringskassan.se.", en: "Families with children can often get housing allowance. The next step is to fill in your details so the amount can be worked out.\n\nA simplified example – for a real application, see forsakringskassan.se." },
      },
    },
    {
      id: "hs-r-ung",
      type: "result",
      position: { x: 640, y: 120 },
      data: {
        title: { sv: "Du kan ha rätt till bostadsbidrag som ung", en: "You may be entitled to housing allowance as a young person" },
        description: { sv: "Du som är 18–28 år utan barn kan få bostadsbidrag om boendekostnaden och inkomsten ligger rätt.\n\nFörenklat exempel – för en riktig ansökan, se forsakringskassan.se.", en: "If you are 18–28 without children you can get housing allowance when the housing cost and the income are right.\n\nA simplified example – for a real application, see forsakringskassan.se." },
      },
    },
    {
      id: "hs-r-annat",
      type: "result",
      position: { x: 640, y: 660 },
      data: {
        title: { sv: "Bostadsbidrag är ovanligt i din situation", en: "Housing allowance is unusual in your situation" },
        description: { sv: "Bostadsbidrag riktar sig främst till barnfamiljer och unga. Det finns andra stöd att titta på i stället.\n\nFörenklat exempel – för mer information, se forsakringskassan.se.", en: "Housing allowance is mainly for families with children and for young people. There are other kinds of support to look at instead.\n\nA simplified example – for more information, see forsakringskassan.se." },
      },
    },
  ],
  connections: [
    { id: "hs-c1", from: { nodeId: "hs-barn", portId: "hs-barn-ja" }, to: { nodeId: "hs-ung", portId: "input" } },
    { id: "hs-c2", from: { nodeId: "hs-barn", portId: "hs-barn-nej" }, to: { nodeId: "hs-ung", portId: "input" } },
    { id: "hs-c3", from: { nodeId: "hs-ung", portId: "hs-ung-ja" }, to: { nodeId: "hs-rule", portId: "input" } },
    { id: "hs-c4", from: { nodeId: "hs-ung", portId: "hs-ung-nej" }, to: { nodeId: "hs-rule", portId: "input" } },
    { id: "hs-c5", from: { nodeId: "hs-rule", portId: "hs-case-barn" }, to: { nodeId: "hs-r-barn", portId: "input" } },
    { id: "hs-c6", from: { nodeId: "hs-rule", portId: "hs-case-ung" }, to: { nodeId: "hs-r-ung", portId: "input" } },
    { id: "hs-c7", from: { nodeId: "hs-rule", portId: "default" }, to: { nodeId: "hs-r-annat", portId: "input" } },
  ],
  /*
   * Finnish, and deliberately unfinished.
   *
   * The guide offers Swedish and Finnish, and five of its eight nodes carry a
   * Finnish text. The three results do not, on purpose: a fully translated
   * guide demonstrates nothing about translation mode. What the mode is *for*
   * is showing what is left — the markers on the canvas, "Next untranslated",
   * the share in the toolbar — and none of that is visible when nothing is
   * missing.
   *
   * Finnish rather than a bigger language: it is one of Sweden's five national
   * minority languages, and in the administrative areas an individual has the
   * right to use it with a public authority. A municipality translating an
   * e-service into Finnish is doing something it may be obliged to do, which is
   * the world this product lives in. It is also unmistakable from Swedish at a
   * glance, which is exactly what a translator scanning the canvas needs.
   *
   * Arabic stays in `examples/language.html`, where a partial host pack and
   * right-to-left text are the subject.
   */
  settings: { sourceLocale: "sv", locales: ["sv", "en", "fi"] },
};

import type { FlowNodeData, GraphData } from "../viewer/types/graph";

/**
 * Borrow (story 095): the loan calculator every bank and broker has, built as
 * one page that counts while the visitor answers.
 *
 * The amount is a field with a slider (10 000–800 000, 5 000 kr a step —
 * "en krona i taget" is the mistake the health check warns about), the term
 * a field with − / + (1–15 years). The calculation sits *in* the page, so
 * the Text below it — monthly cost and total to repay — is redrawn on every
 * change, not when the page is submitted. The annuity is
 * `lån * r / (1 - pow(1 + r; -n))` with the rate as a number in the formula;
 * fetching a real rate is a lookup, outside this story. The warning
 * *Att låna kostar pengar* is the one the advertising rules require.
 *
 * This file is the open guide, ending in a plain result: everything a
 * comparison site does while the visitor drags (Johan 8/10, the Compricer
 * example) is open. FlowWeaver PRO's `borrow` reuses the page below and
 * ends in a review and a submission instead — one page, two endings. The
 * question about consolidating loans is PRO's: it belongs to an application,
 * and a required question in a calculator only stands between the visitor
 * and the answer (measured 8/10: it stopped *Nästa*).
 *
 * This guide is the story's acceptance test: if it works on a phone with a
 * thumb, the story is built. (`loan-example-graph.ts` is another guide: the
 * trail bench's salary-and-mortgage walk, one question at a time.)
 */
export const loanCalculatorPageNodes: FlowNodeData[] = [
    {
      id: "loan-page",
      type: "page",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Hur mycket vill du låna?", en: "How much would you like to borrow?" },
        description: {
          sv: "Dra i reglaget eller skriv ett belopp. Kostnaden räknas om medan du ändrar.",
          en: "Drag the slider or type an amount. The cost is recalculated as you change it.",
        },
      },
    },
    {
      id: "loan-amount",
      type: "number-question",
      parentPageId: "loan-page",
      order: 0,
      position: { x: 20, y: 112 },
      layout: { columnSpan: 12 },
      data: {
        title: { sv: "Lånesumma", en: "Loan amount" },
        variableName: "lan",
        variableLabel: { sv: "Lånesumma", en: "Loan amount" },
        min: 10000,
        max: 800000,
        step: 5000,
        unit: { sv: "kr", en: "SEK" },
        required: true,
        presentation: "range",
      },
    },
    {
      id: "loan-years",
      type: "number-question",
      parentPageId: "loan-page",
      order: 1,
      position: { x: 20, y: 242 },
      layout: { columnSpan: 12 },
      data: {
        title: { sv: "Lånetid", en: "Term" },
        variableName: "ar",
        variableLabel: { sv: "Lånetid", en: "Term" },
        min: 1,
        max: 15,
        step: 1,
        unit: { sv: "år", en: "years" },
        required: true,
        // Story 118, criterion 6: the term starts at 8 years so the cost box
        // reads a real amount on arrival instead of a dash. The amount beside
        // it has always shown one — a slider stands at its `min` — so the box
        // was blank for the one field that did not, and the guide's whole
        // point was invisible until the visitor had answered twice.
        startValue: 8,
        presentation: "stepper",
      },
    },
    {
      id: "loan-cost",
      type: "calculation",
      parentPageId: "loan-page",
      order: 2,
      position: { x: 20, y: 372 },
      layout: { columnSpan: 12 },
      data: {
        title: { sv: "Månadskostnad", en: "Monthly cost" },
        assignments: [
          {
            id: "loan-a1",
            variableName: "r",
            label: { sv: "Månadsränta", en: "Monthly rate" },
            formula: "0.06 / 12",
          },
          {
            id: "loan-a2",
            variableName: "kostnad",
            label: { sv: "Ungefärlig månadskostnad", en: "Approximate monthly cost" },
            formula: "round(lan * r / (1 - pow(1 + r; -ar * 12)))",
          },
          {
            id: "loan-a3",
            variableName: "totalt",
            label: { sv: "Totalt att återbetala", en: "Total to repay" },
            formula: "kostnad * ar * 12",
          },
        ],
      },
    },
    {
      id: "loan-summary",
      type: "page-heading",
      parentPageId: "loan-page",
      order: 3,
      position: { x: 20, y: 502 },
      layout: { columnSpan: 12 },
      // No title: the bold cost is the heading. (An empty `{ sv: "" }` would
      // read as an untranslated text to the languages gate.)
      data: {
        description: {
          sv: "**{{kostnad}} kr/mån.** Totalt att återbetala: {{totalt}} kr, med 6 % ränta.",
          en: "**SEK {{kostnad}} a month.** Total to repay: SEK {{totalt}}, at 6 % interest.",
        },
        presentation: "info",
      },
    },
    {
      id: "loan-warning",
      type: "page-heading",
      parentPageId: "loan-page",
      order: 5,
      position: { x: 20, y: 762 },
      layout: { columnSpan: 12 },
      data: {
        title: { sv: "Att låna kostar pengar", en: "Borrowing costs money" },
        description: {
          sv: "Om du inte kan betala tillbaka skulden i tid riskerar du en betalningsanmärkning. För stöd, vänd dig till budget- och skuldrådgivningen i din kommun.",
          en: "If you cannot repay the debt on time you risk a payment default record. For support, contact the budget and debt counselling service in your municipality.",
        },
        // The ad's mandatory warning, shown as one (story 096): frame, icon
        // and the word *Viktigt* — a warning that looks like body text is
        // not read as a warning.
        presentation: "warning",
      },
    },
];

export const loanCalculatorExampleGraph: GraphData = {
  startNodeId: "loan-page",
  nodes: [
    ...loanCalculatorPageNodes,
    {
      id: "loan-result",
      type: "result",
      position: { x: 1180, y: 0 },
      data: {
        title: { sv: "Din lånekalkyl", en: "Your loan estimate" },
        description: {
          sv: "Att låna **{{lan}} kr** på {{ar}} år kostar ungefär **{{kostnad}} kr i månaden**, totalt {{totalt}} kr med 6 % ränta.\n\nDet här är en uppskattning, inte ett erbjudande — banken sätter din riktiga ränta.",
          en: "Borrowing **SEK {{lan}}** over {{ar}} years costs about **SEK {{kostnad}} a month**, SEK {{totalt}} in total at 6 % interest.\n\nThis is an estimate, not an offer — the bank sets your real rate.",
        },
      },
    },
  ],
  connections: [
    { id: "loan-c1", from: { nodeId: "loan-page", portId: "continue" }, to: { nodeId: "loan-result", portId: "input" } },
  ],
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
};

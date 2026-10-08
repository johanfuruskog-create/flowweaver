import type { GraphData } from "../viewer/types/graph";

/**
 * A guide that asks two numbers, hands them to a calculation on the server, and
 * carries on with what came back.
 *
 * ## Why it exists
 *
 * `service-call` shipped with no example guide behind it. Everything the site
 * said about running sensitive logic on the server was therefore prose, and the
 * one node type that actually does it was the only one a reader could not go
 * and look at.
 *
 * The numbers are a mortgage cap because that is the honest case: a rule an
 * organisation does not want to publish, applied to figures a resident does not
 * want to publish either. Neither side of that belongs in a browser.
 *
 * ## What is deliberately in it
 *
 * - **Two variables in, two out.** One value each way would let a reader think
 *   the mapping is positional. It is by name, both directions.
 * - **A field that is read but never shown.** `decision` decides the route; the
 *   resident sees the amount. That is the shape of most real calls.
 * - **A sample response.** Without a backend — in the editor, in a preview, on
 *   GitHub Pages — the node answers from `mockResponse`, so the guide can be
 *   built and walked before the endpoint exists. It is the same mapping either
 *   way; only where the JSON comes from changes.
 */
export const serviceCallExampleGraph: GraphData = {
  startNodeId: "income",
  nodes: [
    {
      id: "income",
      type: "number-question",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Vad har du för månadsinkomst?", en: "What is your monthly income?" },
        description: {
          sv: "Före skatt. Vi sparar ingenting — talet används bara för att räkna.",
          en: "Before tax. Nothing is stored — the number is only used to calculate.",
        },
        variableName: "income",
        variableLabel: { sv: "Månadsinkomst", en: "Monthly income" },
        min: 0,
        max: 500000,
        step: 1000,
        unit: "kr",
        required: true,
      },
    },
    {
      id: "deposit",
      type: "number-question",
      position: { x: 320, y: 0 },
      data: {
        title: { sv: "Hur mycket har du i kontantinsats?", en: "How much do you have as a deposit?" },
        description: {
          sv: "Det du kan lägga kontant vid köpet.",
          en: "What you can put down in cash at the purchase.",
        },
        variableName: "deposit",
        variableLabel: { sv: "Kontantinsats", en: "Deposit" },
        min: 0,
        max: 10000000,
        step: 10000,
        unit: "kr",
        required: true,
      },
    },
    {
      /*
       * The endpoint is the organisation's own. The values that go with it are
       * chosen by name, and the fields that come back land in variables the
       * rest of the guide can use — including one the resident never sees.
       */
      id: "call",
      type: "service-call",
      position: { x: 640, y: 0 },
      data: {
        title: { sv: "Hämta maxbelopp", en: "Fetch the maximum amount" },
        description: {
          sv: "Räknas ut hos oss, inte i besökarens webbläsare.",
          en: "Worked out on our side, not in the visitor's browser.",
        },
        endpoint: "/api/max-loan",
        method: "POST",
        requestVariables: ["income", "deposit"],
        mockResponse: '{\n  "maxLoan": 2550000,\n  "decision": "approved"\n}',
        responseMappings: [
          { id: "m-max", field: "maxLoan", variableName: "maxLoan", label: { sv: "Maxlån", en: "Maximum loan" } },
          { id: "m-decision", field: "decision", variableName: "decision", label: { sv: "Beslut", en: "Decision" } },
        ],
      },
    },
    {
      id: "route",
      type: "rule",
      position: { x: 960, y: 0 },
      data: {
        title: { sv: "Vad sa svaret?", en: "What did the answer say?" },
        cases: [
          {
            id: "case-approved",
            label: "approved",
            match: "all",
            conditions: [
              { id: "c1", variableName: "decision", operator: "equals", value: "approved" },
            ],
          },
        ],
        fallbackLabel: "annars",
      },
    },
    {
      id: "result-approved",
      type: "result",
      position: { x: 1280, y: -140 },
      data: {
        title: { sv: "Du kan låna upp till {{maxLoan}} kr", en: "You can borrow up to {{maxLoan}} kr" },
        description: {
          sv: "Beloppet är en uppskattning från vår uträkning och inget löfte om lån.",
          en: "The amount is an estimate from our calculation and not an offer of a loan.",
        },
      },
    },
    {
      id: "result-denied",
      type: "result",
      position: { x: 1280, y: 230 },
      data: {
        title: { sv: "Vi kan inte räkna fram ett belopp", en: "We cannot work out an amount" },
        description: {
          sv: "Hör av dig till oss så tittar vi på det tillsammans.",
          en: "Get in touch and we will look at it together.",
        },
      },
    },
  ],
  connections: [
    { id: "c1", from: { nodeId: "income", portId: "continue" }, to: { nodeId: "deposit", portId: "input" } },
    { id: "c2", from: { nodeId: "deposit", portId: "continue" }, to: { nodeId: "call", portId: "input" } },
    { id: "c3", from: { nodeId: "call", portId: "continue" }, to: { nodeId: "route", portId: "input" } },
    { id: "c4", from: { nodeId: "route", portId: "case-approved" }, to: { nodeId: "result-approved", portId: "input" } },
    { id: "c5", from: { nodeId: "route", portId: "default" }, to: { nodeId: "result-denied", portId: "input" } },
  ],
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
} as unknown as GraphData;

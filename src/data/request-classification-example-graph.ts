import type { GraphData } from "../viewer/types/graph";

/**
 * Klassificering av kundönskemål (story 122).
 *
 * Four questions, four results, nothing else: no page, no calculation, no
 * submission. That is the point rather than a limitation — it is FlowWeaver's
 * simplest shape, a pure decision tree, and it is worth having one bundled
 * guide that is *only* that. Everything the visitor reads is in the graph's
 * data; nothing about the decision lives in code.
 *
 * It is also the first guide about FlowWeaver itself: it answers *how should
 * this request be classified and paid for?* — a general improvement we would
 * have wanted anyway, something with both general and customer-specific value,
 * a separate commission, or a case that has to be looked at by a person.
 *
 * **The tree is the business requirement and may not be changed** (story 122,
 * *Verksamhetskrav*). Wording may be tidied; the questions, the answers and
 * where each answer leads may not. The connections below are the table in that
 * story, one row at a time.
 *
 * The layout reads left to right in columns — the two follow-up questions, then
 * the results, then the last question's two results — so no connection crosses
 * another and the shape of the decision is visible on the canvas.
 */
export const requestClassificationExampleGraph: GraphData = {
  startNodeId: "rc-wanted",
  nodes: [
    {
      id: "rc-wanted",
      type: "question",
      position: { x: -560, y: 0 },
      data: {
        title: {
          sv: "Skulle vi vilja lägga till funktionen även om den här kunden inte hade efterfrågat den?",
          en: "Would we want to add this feature even if this customer had not asked for it?",
        },
        description: {
          sv: "Fråga om funktionen står på vår egen lista, oavsett vem som råkade nämna den först.",
          en: "Ask whether the feature is on our own list, whoever happened to mention it first.",
        },
        variableName: "wantedAnyway",
        variableLabel: { sv: "Ville ha ändå", en: "Wanted anyway" },
        options: [
          { id: "rc-wanted-yes", label: { sv: "Ja", en: "Yes" }, value: "ja" },
          { id: "rc-wanted-no", label: { sv: "Nej", en: "No" }, value: "nej" },
        ],
      },
    },
    {
      id: "rc-broad",
      type: "question",
      position: { x: -120, y: -300 },
      data: {
        title: {
          sv: "Har funktionen tydlig nytta för flera olika typer av kunder?",
          en: "Does the feature have clear value for several different kinds of customer?",
        },
        description: {
          sv: "Flera olika typer, inte flera kunder av samma slag.",
          en: "Several different kinds, not several customers of the same kind.",
        },
        variableName: "broadValue",
        variableLabel: { sv: "Bred nytta", en: "Broad value" },
        options: [
          { id: "rc-broad-yes", label: { sv: "Ja", en: "Yes" }, value: "ja" },
          {
            id: "rc-broad-partly",
            label: { sv: "Delvis eller osäkert", en: "Partly or unsure" },
            value: "delvis",
          },
        ],
      },
    },
    {
      id: "rc-buildable",
      type: "question",
      position: { x: -120, y: 260 },
      data: {
        title: {
          sv: "Kan funktionen byggas generellt utan kundspecifik logik eller specialfall?",
          en: "Can the feature be built generally, with no customer-specific logic or special cases?",
        },
        description: {
          sv: "Alltså utan ett undantag som bara gäller den här kunden.",
          en: "That is, with no exception that applies to this customer alone.",
        },
        variableName: "buildableGenerally",
        variableLabel: { sv: "Byggbar generellt", en: "Buildable generally" },
        options: [
          { id: "rc-buildable-yes", label: { sv: "Ja", en: "Yes" }, value: "ja" },
          { id: "rc-buildable-no", label: { sv: "Nej", en: "No" }, value: "nej" },
        ],
      },
    },
    {
      id: "rc-specific",
      type: "question",
      position: { x: 340, y: 560 },
      data: {
        title: {
          sv: "Är funktionen huvudsakligen till för den här kundens egna behov, processer eller integrationer?",
          en: "Is the feature mainly for this customer's own needs, processes or integrations?",
        },
        description: {
          sv: "Huvudsakligen — en funktion kan ha allmän nytta och ändå vara byggd för en.",
          en: "Mainly — a feature can be of general use and still be built for one.",
        },
        variableName: "customerSpecific",
        variableLabel: { sv: "Kundspecifik", en: "Customer-specific" },
        options: [
          { id: "rc-specific-yes", label: { sv: "Ja", en: "Yes" }, value: "ja" },
          {
            id: "rc-specific-no",
            label: { sv: "Nej eller osäkert", en: "No or unsure" },
            value: "nej",
          },
        ],
      },
    },
    {
      id: "rc-general",
      type: "result",
      position: { x: 340, y: -300 },
      data: {
        title: { sv: "Generell utveckling", en: "General development" },
        description: {
          sv: "En generell förbättring med bred nytta; finansieras normalt av FlowWeaver.",
          en: "A general improvement with broad value; normally funded by FlowWeaver.",
        },
      },
    },
    {
      id: "rc-shared",
      type: "result",
      position: { x: 340, y: 120 },
      data: {
        title: { sv: "Delad utveckling", en: "Shared development" },
        description: {
          sv: "Både generell och kundspecifik nytta; kunden kan finansiera den specifika delen, arbetet med att göra lösningen generell hanteras separat.",
          en: "Both general and customer-specific value; the customer may fund the specific part, and the work of making the solution general is handled separately.",
        },
      },
    },
    {
      id: "rc-bespoke",
      type: "result",
      position: { x: 800, y: 440 },
      data: {
        title: { sv: "Kundunik utveckling", en: "Customer-specific development" },
        description: {
          sv: "Separat uppdrag som offereras innan arbete startar.",
          en: "A separate commission, quoted before any work starts.",
        },
      },
    },
    {
      id: "rc-manual",
      type: "result",
      position: { x: 800, y: 800 },
      data: {
        title: { sv: "Manuell bedömning", en: "Manual assessment" },
        description: {
          sv: "Underlaget är otydligt och kräver manuell analys innan finansieringsmodell bestäms.",
          en: "The case is unclear and needs a manual analysis before a funding model is decided.",
        },
      },
    },
  ],
  /*
   * Story 122's table, row by row. A reader should be able to hold the table
   * beside this list and see the same tree twice.
   */
  connections: [
    // 1: Ja → 2. Nej → 3.
    { id: "rc-c1", from: { nodeId: "rc-wanted", portId: "rc-wanted-yes" }, to: { nodeId: "rc-broad", portId: "input" } },
    { id: "rc-c2", from: { nodeId: "rc-wanted", portId: "rc-wanted-no" }, to: { nodeId: "rc-buildable", portId: "input" } },
    // 2: Ja → Generell utveckling. Delvis eller osäkert → 3.
    { id: "rc-c3", from: { nodeId: "rc-broad", portId: "rc-broad-yes" }, to: { nodeId: "rc-general", portId: "input" } },
    { id: "rc-c4", from: { nodeId: "rc-broad", portId: "rc-broad-partly" }, to: { nodeId: "rc-buildable", portId: "input" } },
    // 3: Ja → Delad utveckling. Nej → 4.
    { id: "rc-c5", from: { nodeId: "rc-buildable", portId: "rc-buildable-yes" }, to: { nodeId: "rc-shared", portId: "input" } },
    { id: "rc-c6", from: { nodeId: "rc-buildable", portId: "rc-buildable-no" }, to: { nodeId: "rc-specific", portId: "input" } },
    // 4: Ja → Kundunik utveckling. Nej eller osäkert → Manuell bedömning.
    { id: "rc-c7", from: { nodeId: "rc-specific", portId: "rc-specific-yes" }, to: { nodeId: "rc-bespoke", portId: "input" } },
    { id: "rc-c8", from: { nodeId: "rc-specific", portId: "rc-specific-no" }, to: { nodeId: "rc-manual", portId: "input" } },
  ],
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
};

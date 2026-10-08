import type { GraphData } from "../viewer/types/graph";

export const basicExampleGraph: GraphData = {
  startNodeId: "basic-age",
  nodes: [
    { id: "basic-age", type: "question", position: { x: -660, y: -150 }, data: { title: { sv: "Har du fyllt 18 år?", en: "Are you 18 or older?" }, description: { sv: "Välj det alternativ som stämmer för dig.", en: "Choose the option that applies to you." }, variableName: "isAdult", variableLabel: { sv: "Har fyllt 18 år", en: "Is 18 or older" }, options: [
      { id: "basic-age-yes", label: { sv: "Ja", en: "Yes" }, value: "yes" },
      { id: "basic-age-no", label: { sv: "Nej", en: "No" }, value: "no" },
    ] } },
    { id: "basic-vision", type: "question", position: { x: -220, y: -330 }, data: { title: { sv: "Kan du uppfylla synkraven?", en: "Can you meet the eyesight requirements?" }, description: { sv: "Välj Ja om du vet att du uppfyller kraven.", en: "Choose Yes if you know you meet them." }, variableName: "meetsVisionRequirements", variableLabel: { sv: "Uppfyller synkraven", en: "Meets the eyesight requirements" }, options: [
      { id: "basic-vision-yes", label: { sv: "Ja", en: "Yes" }, value: "yes" },
      { id: "basic-vision-unsure", label: { sv: "Nej eller osäker", en: "No, or not sure" }, value: "unsure" },
    ] } },
    { id: "basic-permit", type: "question", position: { x: 220, y: -330 }, data: { title: { sv: "Har du körkortstillstånd?", en: "Do you have a learner's permit?" }, description: { sv: "Ett giltigt tillstånd behövs innan du börjar övningsköra.", en: "A valid permit is needed before you start practising." }, variableName: "hasLearnersPermit", variableLabel: { sv: "Har körkortstillstånd", en: "Has a learner's permit" }, options: [
      { id: "basic-permit-yes", label: { sv: "Ja", en: "Yes" }, value: "yes" },
      { id: "basic-permit-no", label: { sv: "Nej", en: "No" }, value: "no" },
    ] } },
    { id: "basic-ready", type: "result", position: { x: 660, y: -480 }, data: { title: { sv: "Du kan gå vidare", en: "You can continue" }, description: { sv: "Nästa steg är att planera din utbildning och övningskörning.", en: "The next step is to plan your training and practice." } } },
    { id: "basic-apply-permit", type: "result", position: { x: 660, y: -130 }, data: { title: { sv: "Ansök om körkortstillstånd", en: "Apply for a learner's permit" }, description: { sv: "Ta reda på vad som krävs innan du börjar övningsköra.", en: "Find out what is needed before you start practising." } } },
    { id: "basic-check-vision", type: "result", position: { x: 220, y: 150 }, data: { title: { sv: "Kontrollera synkraven", en: "Check the eyesight requirements" }, description: { sv: "Ta reda på vilken bedömning som gäller för dig.", en: "Find out which assessment applies to you." } } },
    { id: "basic-wait", type: "result", position: { x: -220, y: 270 }, data: { title: { sv: "Du behöver vänta", en: "You need to wait" }, description: { sv: "I den här exempelguiden behöver du ha fyllt 18 år för att gå vidare.", en: "In this example guide you have to be 18 or older to continue." } } },
  ],
  connections: [
    { id: "basic-adult-vision", from: { nodeId: "basic-age", portId: "basic-age-yes" }, to: { nodeId: "basic-vision", portId: "input" } },
    { id: "basic-minor-wait", from: { nodeId: "basic-age", portId: "basic-age-no" }, to: { nodeId: "basic-wait", portId: "input" } },
    { id: "basic-vision-permit", from: { nodeId: "basic-vision", portId: "basic-vision-yes" }, to: { nodeId: "basic-permit", portId: "input" } },
    { id: "basic-vision-check", from: { nodeId: "basic-vision", portId: "basic-vision-unsure" }, to: { nodeId: "basic-check-vision", portId: "input" } },
    { id: "basic-permit-ready", from: { nodeId: "basic-permit", portId: "basic-permit-yes" }, to: { nodeId: "basic-ready", portId: "input" } },
    { id: "basic-permit-apply", from: { nodeId: "basic-permit", portId: "basic-permit-no" }, to: { nodeId: "basic-apply-permit", portId: "input" } },
  ],
};
export const serviceExampleGraph: GraphData = {
  startNodeId: "service-page",
  nodes: [
    { id: "service-page", type: "page", position: { x: -1000, y: -150 }, data: { title: { sv: "Om dig och bostaden", en: "About you and the home" }, description: { sv: "Fyll i grunduppgifterna på samma sida.", en: "Fill in the basics on one page." }, continueLabel: { sv: "Fortsätt", en: "Continue" } } },
    // The page's fields are child nodes since migration v3->v4 (story 001).
    // The ids follow the pattern the migration produces, so a guide saved from
    // the old shape and this one end up identical.
    { id: "service-page-falt-1", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "service-page", order: 0, layout: { columnSpan: 12 }, data: { title: { sv: "Ditt namn", en: "Your name" }, variableName: "applicantName", placeholder: { sv: "För- och efternamn", en: "First and last name" }, required: true } },
    { id: "service-page-falt-2", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "service-page", order: 1, layout: { columnSpan: 12 }, data: { title: { sv: "Kommun", en: "Municipality" }, variableName: "municipality", placeholder: { sv: "Till exempel Örebro", en: "For example Örebro" }, required: true } },
    { id: "service-price", type: "number-question", position: { x: -100, y: -150 }, data: { title: { sv: "Vad kostar bostaden?", en: "What does the home cost?" }, description: { sv: "Ange bostadens pris i kronor.", en: "Enter the price in SEK." }, variableName: "pris", variableLabel: { sv: "Bostadspris", en: "Home price" }, min: 0, max: 100000000, step: 10000, unit: "kr" } },
    { id: "service-income", type: "number-question", position: { x: 340, y: -150 }, data: { title: { sv: "Vad är din årsinkomst?", en: "What is your yearly income?" }, description: { sv: "Bruttoinkomst per år. Används för att uppskatta lånetaket.", en: "Gross income per year. Used to estimate the borrowing limit." }, variableName: "inkomst", variableLabel: { sv: "Årsinkomst", en: "Yearly income" }, min: 0, max: 100000000, step: 10000, unit: "kr" } },
    { id: "service-calc", type: "calculation", position: { x: 780, y: -150 }, data: { title: { sv: "Bolånekalkyl", en: "Mortgage calculation" }, assignments: [
      { id: "service-calc-down", variableName: "kontantinsats", label: { sv: "Kontantinsats", en: "Deposit" }, formula: "pris * 0,15" },
      { id: "service-calc-hand", variableName: "handpenning", label: { sv: "Handpenning", en: "Down payment" }, formula: "pris * 0,10" },
      { id: "service-calc-max", variableName: "maxLån", label: { sv: "Maxlån", en: "Maximum loan" }, formula: "min(pris * 0,85 ; inkomst * 5)" },
      { id: "service-calc-need", variableName: "lånebehov", label: { sv: "Lånebehov", en: "Loan needed" }, formula: "pris - kontantinsats" },
      { id: "service-calc-margin", variableName: "marginal", label: { sv: "Marginal", en: "Margin" }, formula: "maxLån - lånebehov" },
    ] } },
    { id: "service-loan-rule", type: "rule", position: { x: 1220, y: -150 }, data: { title: { sv: "Räcker lånet?", en: "Is the loan enough?" }, cases: [
      { id: "service-loan-ok", label: "Lånet räcker", match: "all", conditions: [
        { id: "service-loan-condition", variableName: "marginal", operator: "greater-than-or-equal", value: "0" },
      ] },
    ], fallbackLabel: "Behöver mer kontantinsats" } },
    { id: "service-result-ok", type: "result", position: { x: 1660, y: -330 }, data: { title: { sv: "Du kan gå vidare med ansökan", en: "You can go on with the application" }, description: { sv: "Hej {{applicantName}}! Du kan låna upp till {{maxLån}} kr, vilket räcker för en bostad på {{pris}} kr. Kontantinsatsen blir {{kontantinsats}} kr och handpenningen {{handpenning}} kr.", en: "Hello {{applicantName}}. You can borrow up to {{maxLån}} kr, which is enough for a home at {{pris}} kr. The deposit comes to {{kontantinsats}} kr and the down payment {{handpenning}} kr." } } },
    { id: "service-result-more", type: "result", position: { x: 1660, y: 180 }, data: { title: { sv: "Lånet räcker inte riktigt", en: "The loan is not quite enough" }, description: { sv: "Med din inkomst når lånet {{maxLån}} kr, men du behöver {{lånebehov}} kr för bostaden i {{municipality}}. Öka kontantinsatsen eller välj en billigare bostad.", en: "With your income the loan reaches {{maxLån}} kr, but you need {{lånebehov}} kr for the home in {{municipality}}. Increase the deposit or choose a cheaper home." } } },
  ],
  connections: [
    { id: "service-page-price", from: { nodeId: "service-page", portId: "continue" }, to: { nodeId: "service-price", portId: "input" } },
    { id: "service-price-income", from: { nodeId: "service-price", portId: "continue" }, to: { nodeId: "service-income", portId: "input" } },
    { id: "service-income-calc", from: { nodeId: "service-income", portId: "continue" }, to: { nodeId: "service-calc", portId: "input" } },
    { id: "service-calc-rule", from: { nodeId: "service-calc", portId: "continue" }, to: { nodeId: "service-loan-rule", portId: "input" } },
    { id: "service-loan-ok-result", from: { nodeId: "service-loan-rule", portId: "service-loan-ok" }, to: { nodeId: "service-result-ok", portId: "input" } },
    { id: "service-loan-more-result", from: { nodeId: "service-loan-rule", portId: "default" }, to: { nodeId: "service-result-more", portId: "input" } },
  ],
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
};

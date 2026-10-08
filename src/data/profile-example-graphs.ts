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

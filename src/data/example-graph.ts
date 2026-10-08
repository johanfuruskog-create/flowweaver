import type { GraphData } from "../viewer/types/graph";

export const exampleGraph: GraphData = {
  startNodeId: "question-age",
  nodes: [
    {
      id: "question-age",
      type: "number-question",
      position: { x: -1100, y: -150 },
      data: {
        title: { sv: "Hur gammal är du?", en: "How old are you?" },
        description: {
          sv: "Det här är en förenklad exempelguide, inte myndighetsinformation.",
          en: "This is a simplified example guide, not official information.",
        },
        variableName: "age",
        variableLabel: { sv: "Ålder", en: "Age" },
        min: 0,
        max: 120,
        step: 1,
        unit: { sv: "år", en: "years" },
      },
    },
    {
      id: "rule-age",
      type: "rule",
      position: { x: -660, y: -150 },
      data: {
        title: { sv: "Kontrollera ålder", en: "Check the age" },
        cases: [{
          id: "adult",
          label: "Vuxen",
          match: "all",
          conditions: [{
            id: "adult-condition",
            variableName: "age",
            operator: "greater-than-or-equal",
            value: "18",
          }],
        }],
        fallbackLabel: "Barn",
      },
    },
    {
      id: "question-gender",
      type: "question",
      position: { x: -220, y: -330 },
      data: {
        title: {
          sv: "Vilket kön vill du använda i exempelguiden?",
          en: "Which gender do you want to use in the example guide?",
        },
        description: { sv: "Frågan finns för att demonstrera regler med flera variabler.", en: "The question exists to demonstrate rules with several variables." },
        variableName: "gender",
        variableLabel: { sv: "Kön", en: "Gender" },
        options: [
          { id: "gender-male", label: { sv: "Man", en: "Male" }, value: "male" },
          { id: "gender-female", label: { sv: "Kvinna", en: "Female" }, value: "female" },
          { id: "gender-other", label: { sv: "Annat", en: "Other" }, value: "other" },
        ],
      },
    },
    {
      id: "rule-gender",
      type: "rule",
      position: { x: 220, y: -180 },
      data: {
        title: { sv: "Välj frågeväg", en: "Choose a question path" },
        cases: [
          {
            id: "male",
            label: "Äldre man",
            match: "all",
            conditions: [
              {
                id: "older-man-age",
                variableName: "age",
                operator: "greater-than-or-equal",
                value: "65",
              },
              {
                id: "male-condition",
                variableName: "gender",
                operator: "equals",
                value: "male",
              },
            ],
          },
        ],
        fallbackLabel: "Övriga vuxna",
      },
    },
    {
      id: "question-male-information",
      type: "question",
      position: { x: 660, y: -540 },
      data: {
        title: { sv: "Vill du se information riktad till män?", en: "Would you like information aimed at men?" },
        description: { sv: "Det här är en extra demonstrationsfråga för den manliga grenen.", en: "An extra demonstration question for the male branch." },
        variableName: "wantsMaleInformation",
        variableLabel: { sv: "Vill ha information riktad till män", en: "Wants information aimed at men" },
        options: [
          { id: "male-information-yes", label: { sv: "Ja", en: "Yes" }, value: "yes" },
          { id: "male-information-no", label: { sv: "Nej", en: "No" }, value: "no" },
        ],
      },
    },
    {
      id: "question-vision",
      type: "question",
      position: { x: 1100, y: -330 },
      data: {
        title: { sv: "Kan du uppfylla synkraven?", en: "Can you meet the eyesight requirements?" },
        description: { sv: "Den som har en synnedsättning kan behöva en individuell bedömning.", en: "Someone with impaired sight may need an individual assessment." },
        variableName: "meetsVisionRequirements",
        variableLabel: { sv: "Uppfyller synkraven", en: "Meets the eyesight requirements" },
        options: [
          { id: "vision-yes", label: { sv: "Ja", en: "Yes" }, value: "yes" },
          {
            id: "vision-unsure",
            label: { sv: "Nej eller osäker", en: "No, or not sure" },
            value: "unsure",
          },
        ],
      },
    },
    {
      id: "question-permit",
      type: "question",
      position: { x: 1540, y: -330 },
      data: {
        title: { sv: "Har du körkortstillstånd?", en: "Do you have a learner's permit?" },
        description: { sv: "Ett giltigt körkortstillstånd behövs innan du börjar övningsköra.", en: "A valid learner's permit is needed before you start practising." },
        variableName: "hasLearnersPermit",
        variableLabel: { sv: "Har körkortstillstånd", en: "Has a learner's permit" },
        options: [
          { id: "permit-yes", label: { sv: "Ja", en: "Yes" }, value: "yes" },
          { id: "permit-no", label: { sv: "Nej", en: "No" }, value: "no" },
        ],
      },
    },
    {
      id: "result-ready",
      type: "result",
      position: { x: 1980, y: -525 },
      data: {
        title: { sv: "Du kan gå vidare", en: "You can continue" },
        description: { sv: "Du svarade {{hasLearnersPermit}} om körkortstillstånd. Nästa steg är att planera din utbildning och övningskörning.", en: "You answered {{hasLearnersPermit}} about the learner's permit. The next step is to plan your training and practice." },
      },
    },
    {
      id: "result-permit",
      type: "result",
      position: { x: 1980, y: -100 },
      data: {
        title: { sv: "Ansök om körkortstillstånd", en: "Apply for a learner's permit" },
        description: { sv: "Ta reda på vad som krävs innan du börjar övningsköra.", en: "Find out what is needed before you start practising." },
      },
    },
    {
      id: "result-vision",
      type: "result",
      position: { x: 1540, y: 195 },
      data: {
        title: { sv: "Kontrollera synkraven", en: "Check the eyesight requirements" },
        description: { sv: "Kontakta en behörig aktör för att få veta vilken bedömning som gäller för dig.", en: "Contact an authorised body to find out which assessment applies to you." },
      },
    },
    {
      id: "result-age",
      type: "result",
      position: { x: -220, y: 345 },
      data: {
        title: { sv: "Du behöver vänta", en: "You need to wait" },
        description: { sv: "I den här förenklade exempelguiden behöver du ha fyllt 18 år för att gå vidare.", en: "In this simplified example guide you have to be 18 or older to continue." },
      },
    },
  ],
  connections: [
    {
      id: "age-to-rule",
      from: { nodeId: "question-age", portId: "continue" },
      to: { nodeId: "rule-age", portId: "input" },
    },
    {
      id: "adult-to-gender",
      from: { nodeId: "rule-age", portId: "adult" },
      to: { nodeId: "question-gender", portId: "input" },
    },
    {
      id: "child-to-result",
      from: { nodeId: "rule-age", portId: "default" },
      to: { nodeId: "result-age", portId: "input" },
    },
    ...["gender-male", "gender-female", "gender-other"].map((portId) => ({
      id: `${portId}-to-rule`,
      from: { nodeId: "question-gender", portId },
      to: { nodeId: "rule-gender", portId: "input" },
    })),
    {
      id: "male-to-extra-question",
      from: { nodeId: "rule-gender", portId: "male" },
      to: { nodeId: "question-male-information", portId: "input" },
    },
    {
      id: "other-adults-to-vision",
      from: { nodeId: "rule-gender", portId: "default" },
      to: { nodeId: "question-vision", portId: "input" },
    },
    ...["male-information-yes", "male-information-no"].map((portId) => ({
      id: `${portId}-to-vision`,
      from: { nodeId: "question-male-information", portId },
      to: { nodeId: "question-vision", portId: "input" },
    })),
    {
      id: "vision-yes-to-permit",
      from: { nodeId: "question-vision", portId: "vision-yes" },
      to: { nodeId: "question-permit", portId: "input" },
    },
    {
      id: "vision-unsure-to-result",
      from: { nodeId: "question-vision", portId: "vision-unsure" },
      to: { nodeId: "result-vision", portId: "input" },
    },
    {
      id: "permit-yes-to-result",
      from: { nodeId: "question-permit", portId: "permit-yes" },
      to: { nodeId: "result-ready", portId: "input" },
    },
    {
      id: "permit-no-to-result",
      from: { nodeId: "question-permit", portId: "permit-no" },
      to: { nodeId: "result-permit", portId: "input" },
    },
  ],
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
};

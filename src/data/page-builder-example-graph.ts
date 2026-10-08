import type { GraphData } from "../viewer/types/graph";

export const pageBuilderExampleGraph: GraphData = {
  startNodeId: "service-applicant-page",
  nodes: [
    { id: "service-applicant-page", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Vem gäller ansökan?", en: "Who is the application for?" }, description: { sv: "Fyll i grunduppgifterna på samma sida.", en: "Fill in the basics on one page." } } },
    { id: "service-applicant-name", type: "text-question", position: { x: 20, y: 112 }, parentPageId: "service-applicant-page", order: 0, layout: { columnSpan: 4 }, data: { title: { sv: "Sökandens namn", en: "The applicant's name" }, variableName: "applicantName", variableLabel: { sv: "Sökandens namn", en: "The applicant's name" }, placeholder: { sv: "För- och efternamn", en: "First and last name" }, required: true } },
    { id: "service-municipality", type: "text-question", position: { x: 216, y: 112 }, parentPageId: "service-applicant-page", order: 1, layout: { columnSpan: 4 }, data: { title: { sv: "Kommun", en: "Municipality" }, variableName: "municipality", placeholder: { sv: "Till exempel Örebro", en: "For example Örebro" }, required: true } },
    { id: "service-age", type: "number-question", position: { x: 20, y: 242 }, parentPageId: "service-applicant-page", order: 2, layout: { columnSpan: 4 }, data: { title: { sv: "Sökandens ålder", en: "The applicant's age" }, variableName: "applicantAge", min: 0, max: 120, step: 1, unit: { sv: "år", en: "years" }, required: true } },
    { id: "service-age-rule", type: "rule", position: { x: 800, y: 0 }, data: { title: { sv: "Kontrollera ansökningsväg", en: "Check the application path" }, cases: [
      { id: "service-adult", label: "Myndig sökande", match: "all", conditions: [
        { id: "service-adult-condition", variableName: "applicantAge", operator: "greater-than-or-equal", value: "18" },
      ] },
    ], fallbackLabel: "Vårdnadshavare krävs" } },
    { id: "service-contact-page", type: "page", position: { x: 1180, y: 0 }, data: { title: { sv: "Hur vill du bli kontaktad?", en: "How would you like to be contacted?" }, description: { sv: "Välj kontaktväg och fyll i uppgiften som visas.", en: "Choose a way to be reached and fill in what appears." } } },
    { id: "service-contact-method", type: "question", position: { x: 20, y: 112 }, parentPageId: "service-contact-page", order: 0, layout: { columnSpan: 12 }, data: { title: { sv: "Kontaktväg", en: "Way to be reached" }, variableName: "contactMethod", options: [
      { id: "service-email", label: { sv: "E-post", en: "Email" }, value: "email" },
      { id: "service-phone", label: { sv: "Telefon", en: "Phone" }, value: "phone" },
    ] } },
    { id: "service-email-address", type: "text-question", position: { x: 20, y: 242 }, parentPageId: "service-contact-page", order: 1, layout: { columnSpan: 12 }, visibility: { match: "all", conditions: [
      { id: "service-email-visible", variableName: "contactMethod", operator: "equals", value: "email" },
    ] }, data: { title: { sv: "E-postadress", en: "Email address" }, variableName: "emailAddress", placeholder: { sv: "namn@exempel.se", en: "name@example.com" }, required: true, minLength: 5, maxLength: 120 } },
    { id: "service-phone-number", type: "text-question", position: { x: 20, y: 372 }, parentPageId: "service-contact-page", order: 2, layout: { columnSpan: 12 }, visibility: { match: "all", conditions: [
      { id: "service-phone-visible", variableName: "contactMethod", operator: "equals", value: "phone" },
    ] }, data: { title: { sv: "Telefonnummer", en: "Phone number" }, variableName: "phoneNumber", placeholder: "070-123 45 67", required: true, minLength: 7, maxLength: 30 } },
    { id: "service-contact-rule", type: "rule", position: { x: 1980, y: 0 }, data: { title: { sv: "Välj bekräftelse", en: "Choose a confirmation" }, cases: [
      { id: "service-email-result", label: "E-post", match: "all", conditions: [
        { id: "service-email-result-condition", variableName: "contactMethod", operator: "equals", value: "email" },
      ] },
    ], fallbackLabel: "Telefon" } },
    { id: "service-email-complete", type: "result", position: { x: 2360, y: 0 }, data: { title: { sv: "Ansökan kan påbörjas", en: "The application can be started" }, description: { sv: "Tack {{applicantName}}. Vi kommer att kontakta dig på {{emailAddress}}.", en: "Thank you, {{applicantName}}. We will contact you at {{emailAddress}}." } } },
    { id: "service-phone-complete", type: "result", position: { x: 2360, y: 350 }, data: { title: { sv: "Ansökan kan påbörjas", en: "The application can be started" }, description: { sv: "Tack {{applicantName}}. Vi kommer att kontakta dig på {{phoneNumber}}.", en: "Thank you, {{applicantName}}. We will contact you at {{phoneNumber}}." } } },
    { id: "service-guardian", type: "result", position: { x: 1180, y: 734 }, data: { title: { sv: "En vårdnadshavare behöver hjälpa till", en: "A guardian has to help" }, description: { sv: "Be en vårdnadshavare att påbörja ansökan tillsammans med {{applicantName}}.", en: "Ask a guardian to start the application together with {{applicantName}}." } } },
  ],
  connections: [
    { id: "service-applicant-age-rule", from: { nodeId: "service-applicant-page", portId: "continue" }, to: { nodeId: "service-age-rule", portId: "input" } },
    { id: "service-adult-contact-page", from: { nodeId: "service-age-rule", portId: "service-adult" }, to: { nodeId: "service-contact-page", portId: "input" } },
    { id: "service-minor-result", from: { nodeId: "service-age-rule", portId: "default" }, to: { nodeId: "service-guardian", portId: "input" } },
    { id: "service-contact-rule-connection", from: { nodeId: "service-contact-page", portId: "continue" }, to: { nodeId: "service-contact-rule", portId: "input" } },
    { id: "service-email-complete", from: { nodeId: "service-contact-rule", portId: "service-email-result" }, to: { nodeId: "service-email-complete", portId: "input" } },
    { id: "service-phone-complete", from: { nodeId: "service-contact-rule", portId: "default" }, to: { nodeId: "service-phone-complete", portId: "input" } },
  ],
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
};

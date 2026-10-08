// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../../testing/optional-pro";
const PRO = await withPro("viewer/index.ts");
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import "../../node-types/default-node-types";
import "./guide-preview";
// Some of these run the viewer as the editor does — `editor-view`, `proving` —
// and read the editor's words on the canvas. Those load with the editor's
// lookup, never with the viewer (entries.test.ts).
import "../../../editor/localization/editor-ui-strings";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

const graph: GraphData = {
  startNodeId: "question",
  nodes: [
    {
      id: "question",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: "Är du nöjd?",
        description: "Välj det alternativ som passar bäst.",
        variableName: "satisfied",
        options: [
          { id: "yes", label: "Ja", value: "yes" },
          { id: "no", label: "Nej", value: "no" },
        ],
      },
    },
    {
      id: "result-yes",
      type: "result",
      position: { x: 400, y: -100 },
      data: { title: "Vad bra!", description: "Fortsätt så." },
    },
    {
      id: "result-no",
      type: "result",
      position: { x: 400, y: 100 },
      data: {
        title: "Du svarade {{satisfied}}",
        description: "Vi hjälper dig. Okänd: {{missingAnswer}}.",
      },
    },
  ],
  connections: [
    {
      id: "yes-result",
      from: { nodeId: "question", portId: "yes" },
      to: { nodeId: "result-yes", portId: "input" },
    },
    {
      id: "no-result",
      from: { nodeId: "question", portId: "no" },
      to: { nodeId: "result-no", portId: "input" },
    },
  ],
};

function mountPreview(value: GraphData = graph): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = value;

  return preview;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("guide-preview", () => {
  test("shows the chosen language with source fallback for what lacks a translation", () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    document.body.append(preview);
    preview.activeLocale = "en"; // sätts före graph, som ritar om
    preview.graph = {
      startNodeId: "q",
      nodes: [
        {
          id: "q",
          type: "question",
          position: { x: 0, y: 0 },
          data: {
            title: { sv: "Är du nöjd?", en: "Are you satisfied?" },
            options: [
              { id: "yes", label: { sv: "Ja", en: "Yes" }, value: "yes" },
              { id: "no", label: "Nej", value: "no" }, // bara källa → fallback
            ],
          },
        },
        { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: "Klart" } },
      ],
      connections: [
        { id: "c1", from: { nodeId: "q", portId: "yes" }, to: { nodeId: "r", portId: "input" } },
        { id: "c2", from: { nodeId: "q", portId: "no" }, to: { nodeId: "r", portId: "input" } },
      ],
    };

    const text = preview.shadowRoot?.textContent ?? "";
    expect(text).toContain("Are you satisfied?"); // engelsk rubrik
    expect(text).toContain("Yes"); // engelskt alternativ
    expect(text).toContain("Nej"); // saknar en → faller tillbaka på källan
    expect(text).not.toContain("Är du nöjd?"); // svensk rubrik visas inte
  });

  test("the page's own Continue text beats the guide's, in the chosen language", () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    document.body.append(preview);
    preview.activeLocale = "en";
    preview.graph = {
      startNodeId: "page",
      nodes: [
        {
          id: "page",
          type: "page",
          position: { x: 0, y: 0 },
          data: {
            title: "Sida",
            continueLabel: { sv: "Skicka", en: "Submit" },
          },
        },
        { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: "Klart" } },
      ],
      connections: [
        { id: "c", from: { nodeId: "page", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
      // Guide-override finns men noden vinner.
      settings: { strings: { "nav.next": { en: "Next step" } } },
    };

    const next = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="next"]'
    );
    expect(next?.textContent?.trim()).toBe("Submit");
  });

  test("without a page override the guide's button text is used, otherwise the default", () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    document.body.append(preview);
    preview.activeLocale = "en";
    preview.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 0, y: 0 }, data: { title: "Sida" } },
        { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: "Klart" } },
      ],
      connections: [
        { id: "c", from: { nodeId: "page", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
      settings: { strings: { "nav.next": { en: "Next step" } } },
    };

    const next = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="next"]'
    );
    expect(next?.textContent?.trim()).toBe("Next step");
  });

  test("tar emot ett tal och passerar en numerisk regel", async () => {
    const preview = mountPreview({
      startNodeId: "age",
      nodes: [
        { id: "age", type: "number-question", position: { x: 0, y: 0 }, data: { title: "Hur gammal är du?", variableName: "age", min: 0, max: 120, step: 1, unit: "år" } },
        { id: "age-rule", type: "rule", position: { x: 200, y: 0 }, data: { title: "Kontrollera ålder", cases: [{ id: "older", label: "Äldre", match: "all", conditions: [{ id: "age-condition", variableName: "age", operator: "greater-than-or-equal", value: "65" }] }], fallbackLabel: "Yngre" } },
        { id: "older-result", type: "result", position: { x: 400, y: 0 }, data: { title: "Äldre" } },
        { id: "younger-result", type: "result", position: { x: 400, y: 200 }, data: { title: "Yngre" } },
      ],
      connections: [
        { id: "age-rule", from: { nodeId: "age", portId: "continue" }, to: { nodeId: "age-rule", portId: "input" } },
        { id: "older", from: { nodeId: "age-rule", portId: "older" }, to: { nodeId: "older-result", portId: "input" } },
        { id: "younger", from: { nodeId: "age-rule", portId: "default" }, to: { nodeId: "younger-result", portId: "input" } },
      ],
    });
    const input = preview.shadowRoot?.querySelector<HTMLInputElement>("[data-number-answer]");
    const next = preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]');
    if (!input || !next) throw new Error("Kunde inte hitta sifferinmatningen.");

    await userEvent.fill(input, "65");
    await userEvent.click(next);

    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe("Äldre");
    expect(preview.getAnswers()).toEqual({ age: "65" });
  });

  test("shows the start question and its options", () => {
    const preview = mountPreview();
    const heading = preview.shadowRoot?.querySelector("h2");
    const description = preview.shadowRoot?.querySelector(".guide-preview__formatted");
    const options = Array.from(
      preview.shadowRoot?.querySelectorAll<HTMLInputElement>(
        "[data-option-id]"
      ) ?? []
    );

    expect(heading?.textContent).toBe("Är du nöjd?");
    expect(description?.textContent).toBe(
      "Välj det alternativ som passar bäst."
    );
    // Nothing passed yet, so no step row (Astra 1/10, bilaga 10 punkt 8).
    expect(preview.shadowRoot?.querySelector(".guide-preview__step-row")).toBeNull();
    expect(options.map((input) => input.value)).toEqual(["yes", "no"]);
    expect(options.every((input) => input.type === "radio")).toBe(true);
    // 069: Nästa är aldrig död — tomt val ger beskedet vid klick.
    expect(
      preview.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="next"]'
      )?.disabled
    ).toBe(false);
  });

  test("follows the chosen answer and shows the result", async () => {
    const preview = mountPreview();
    const noOption = preview.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-option-id="no"]'
    );
    const nextButton = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="next"]'
    );

    if (!noOption || !nextButton) {
      throw new Error("Kunde inte hitta svarsalternativet Nej.");
    }

    await userEvent.click(noOption);
    expect(nextButton.disabled).toBe(false);
    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Är du nöjd?"
    );
    await userEvent.click(nextButton);

    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Du svarade Nej"
    );
    // The way that led here, not the node type's word (Astra 1/10, punkt 8).
    expect(preview.shadowRoot?.querySelector(".guide-preview__steps")?.textContent)
      .toContain("Är du nöjd?");
    expect(preview.shadowRoot?.querySelector(".guide-preview__step-row")?.textContent)
      .not.toContain("Resultat");
    /*
     * Variabeln som ingen nod sätter blir ett streck, inte klamrar (13/9).
     * Meningen omkring den står kvar hel — det är hela skillnaden mot att
     * dölja texten, och mätningen som fällde raden visade just den:
     * "Vi hjälper dig. Okänd: –."
     */
    expect(preview.shadowRoot?.textContent).toContain(
      "Vi hjälper dig. Okänd: –."
    );
    expect(preview.getAnswers()).toEqual({ satisfied: "no" });
  });

  test("kan starta om guiden och rensar svaren", async () => {
    const preview = mountPreview();
    const yesOption = preview.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-option-id="yes"]'
    );
    const nextButton = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="next"]'
    );

    if (!yesOption || !nextButton) {
      throw new Error("Kunde inte hitta svarsalternativet Ja.");
    }

    await userEvent.click(yesOption);
    await userEvent.click(nextButton);

    const restartButton =
      preview.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="restart"]'
      );

    if (!restartButton) {
      throw new Error("Kunde inte hitta Börja om.");
    }

    await userEvent.click(restartButton);

    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Är du nöjd?"
    );
    // Nothing passed yet, so no step row (Astra 1/10, bilaga 10 punkt 8).
    expect(preview.shadowRoot?.querySelector(".guide-preview__step-row")).toBeNull();
    expect(preview.getAnswers()).toEqual({});
  });

  test("can go back to the previous question", async () => {
    const preview = mountPreview();
    const yesOption = preview.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-option-id="yes"]'
    );
    const nextButton = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="next"]'
    );

    if (!yesOption || !nextButton) {
      throw new Error("Kunde inte hitta navigationen.");
    }

    await userEvent.click(yesOption);
    await userEvent.click(nextButton);

    const previousButton = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="previous"]'
    );

    if (!previousButton) {
      throw new Error("Kunde inte hitta Föregående.");
    }

    await userEvent.click(previousButton);

    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Är du nöjd?"
    );
    /*
     * Svaret står kvar i fältet — hela poängen med att gå tillbaka är att
     * kunna rätta en bokstav i stället för att skriva om allt. Men det som
     * värden läser (`getAnswers()`) är körningen, och den står på frågan
     * igen, alltså obesvarad (6/9 2026 — se
     * `guide-traversal-engine.back.test.ts`). Testet krävde först att både
     * var tomt, sedan att båda var kvar; det ena tömde fältet, det andra
     * skickade svar från en gren besökaren lämnat.
     */
    expect(preview.getAnswers()).toEqual({});
    expect(
      preview.shadowRoot?.querySelector<HTMLInputElement>(
        '[data-option-id="yes"]'
      )?.checked
    ).toBe(true);
    expect(
      preview.shadowRoot?.querySelector<HTMLButtonElement>(
        '[data-action="next"]'
      )?.disabled
    ).toBe(false);
  });

  test("can show earlier questions and answers above the current node", async () => {
    const preview = mountPreview();
    preview.setAttribute("answer-display", "history");
    const noOption = preview.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-option-id="no"]'
    );
    const nextButton = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="next"]'
    );

    if (!noOption || !nextButton) {
      throw new Error("Kunde inte hitta navigationen.");
    }

    expect(preview.shadowRoot?.querySelector(".guide-preview__history")).toBeNull();

    await userEvent.click(noOption);
    await userEvent.click(nextButton);

    const history = preview.shadowRoot?.querySelector(
      ".guide-preview__history"
    );

    expect(history?.textContent).toContain("Är du nöjd?");
    expect(history?.textContent).toContain("Nej");

    const previousButton = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="previous"]'
    );

    if (!previousButton) {
      throw new Error("Kunde inte hitta Föregående.");
    }

    await userEvent.click(previousButton);

    expect(preview.shadowRoot?.querySelector(".guide-preview__history")).toBeNull();
  });

  test("shows a readable error but keeps the question when a path is missing", async () => {
    const incompleteGraph = structuredClone(graph);
    incompleteGraph.connections = incompleteGraph.connections.filter(
      (connection) => connection.from.portId !== "no"
    );
    const preview = mountPreview(incompleteGraph);
    const noOption = preview.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-option-id="no"]'
    );
    const nextButton = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="next"]'
    );

    if (!noOption || !nextButton) {
      throw new Error("Kunde inte hitta det okopplade alternativet.");
    }

    await userEvent.click(noOption);
    await userEvent.click(nextButton);

    const error = preview.shadowRoot?.querySelector<HTMLElement>("[role=alert]");

    expect(error?.textContent).toContain("leder inte vidare");
    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Är du nöjd?"
    );
    expect(preview.getAnswers()).toEqual({});
  });

  test("shows an error when the guide has no start node", () => {
    const invalidGraph = structuredClone(graph);
    invalidGraph.startNodeId = null;
    const preview = mountPreview(invalidGraph);

    expect(
      preview.shadowRoot?.querySelector("[role=alert]")?.textContent?.trim()
    ).toBe("Guiden saknar startnod.");
  });

  test("an engine error shows in the guide's own language, not always Swedish", async () => {
    /*
     * Before 2026-08-31 this failed: `guide-traversal-engine.ts` had 35
     * `this.failure(code, "svensk text")` calls, and a page whose Continue
     * exit led nowhere always said so in Swedish, whatever `active-locale`
     * was set to. The engine already tracks the active locale (it is passed
     * in at construction and updated by the `activeLocale` setter below) —
     * it just was not asked to use it for these.
     */
    const preview = document.createElement("guide-preview") as GuidePreview;
    document.body.append(preview);
    preview.activeLocale = "en"; // sätts före graph, som ritar om
    preview.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 0, y: 0 }, data: { title: "Sida" } },
      ],
      // No connection out of the page's Continue port: a dead end.
      connections: [],
    };

    const nextButton = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="next"]'
    );
    if (!nextButton) throw new Error("Kunde inte hitta Fortsätt-knappen.");

    await userEvent.click(nextButton);

    expect(
      preview.shadowRoot?.querySelector(".guide-preview__error")?.textContent?.trim()
    ).toBe("This page's Continue exit does not lead anywhere.");
  });

  test("visar inget missvisande steg vid direkt inspektion av en nod", () => {
    const preview = mountPreview();

    preview.showNode("result-no");

    // Rubriken är kulisser här — testets påstående är raden under, att inget
    // steg räknas ut. `{{satisfied}}` är obesvarat och blir ett streck (13/9),
    // för den här förhandsvisningen är besökarens bild: `editor-view` sätts av
    // nodkortet, inte av dialogen eller panelen.
    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Du svarade –"
    );
    expect(preview.shadowRoot?.querySelector(".guide-preview__step")).toBeNull();
  });

  test("escapes content inserted through a placeholder", async () => {
    const unsafeGraph = structuredClone(graph);
    const question = unsafeGraph.nodes.find((node) => node.id === "question");

    if (question && Array.isArray(question.data.options)) {
      question.data.options[0] = {
        id: "yes",
        label: "<img src=x onerror=alert(1)>",
        value: "yes",
      };
    }

    const preview = mountPreview(unsafeGraph);
    const yesOption = preview.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-option-id="yes"]'
    );
    const nextButton = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="next"]'
    );

    if (!yesOption || !nextButton) {
      throw new Error("Kunde inte hitta navigationen.");
    }

    await userEvent.click(yesOption);
    await userEvent.click(nextButton);
    preview.showNode("result-no");

    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Du svarade <img src=x onerror=alert(1)>"
    );
    expect(preview.shadowRoot?.querySelector("h2 img")).toBeNull();
  });

  test("passerar en regel utan att visa regeln som ett steg", async () => {
    const ruleGraph = structuredClone(graph);
    ruleGraph.nodes.push({
      id: "satisfied-rule",
      type: "rule",
      position: { x: 200, y: 100 },
      data: {
        title: "Är missnöjd",
        cases: [
          { id: "dissatisfied", label: "Om missnöjd", match: "all", conditions: [{ id: "dissatisfied-condition", variableName: "satisfied", operator: "equals", value: "no" }] },
        ],
        fallbackLabel: "Annars",
      },
    });
    ruleGraph.connections = ruleGraph.connections.map((connection) =>
      connection.id === "no-result"
        ? {
            ...connection,
            to: { nodeId: "satisfied-rule", portId: "input" },
          }
        : connection
    );
    ruleGraph.connections.push(
      {
        id: "rule-true-result",
        from: { nodeId: "satisfied-rule", portId: "dissatisfied" },
        to: { nodeId: "result-no", portId: "input" },
      },
      {
        id: "rule-false-result",
        from: { nodeId: "satisfied-rule", portId: "default" },
        to: { nodeId: "result-yes", portId: "input" },
      }
    );
    const preview = mountPreview(ruleGraph);
    const noOption = preview.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-option-id="no"]'
    );
    const nextButton = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="next"]'
    );

    if (!noOption || !nextButton) {
      throw new Error("Kunde inte hitta navigationen.");
    }

    await userEvent.click(noOption);
    await userEvent.click(nextButton);

    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Du svarade Nej"
    );
    expect(preview.shadowRoot?.textContent).not.toContain("Är missnöjd");
    // The way that led here, not the node type's word (Astra 1/10, punkt 8).
    expect(preview.shadowRoot?.querySelector(".guide-preview__steps")?.textContent)
      .toContain("Är du nöjd?");
    expect(preview.shadowRoot?.querySelector(".guide-preview__step-row")?.textContent)
      .not.toContain("Resultat");
  });

  test("tar emot en validerad text och visar svaret i resultatet", async () => {
    const preview = mountPreview({
      startNodeId: "name",
      nodes: [
        {
          id: "name",
          type: "text-question",
          position: { x: 0, y: 0 },
          data: {
            title: "Vad heter du?",
            variableName: "name",
            placeholder: "För- och efternamn",
            required: true,
            minLength: 2,
            maxLength: 40,
          },
        },
        {
          id: "welcome",
          type: "result",
          position: { x: 300, y: 0 },
          data: { title: "Välkommen {{name}}" },
        },
      ],
      connections: [
        {
          id: "name-welcome",
          from: { nodeId: "name", portId: "continue" },
          to: { nodeId: "welcome", portId: "input" },
        },
      ],
    });
    const input = preview.shadowRoot?.querySelector<HTMLInputElement>(
      "[data-text-answer]"
    );
    const next = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="next"]'
    );

    if (!input || !next) throw new Error("Kunde inte hitta textinmatningen.");

    expect(input.placeholder).toBe("För- och efternamn");
    expect(input.required).toBe(true);
    // 069: aldrig död — beskedet kommer vid klick.
    expect(next.disabled).toBe(false);

    await userEvent.fill(input, "Johan Furuskog");
    expect(next.disabled).toBe(false);
    await userEvent.click(next);

    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe(
      "Välkommen Johan Furuskog"
    );
    expect(preview.getAnswers()).toEqual({ name: "Johan Furuskog" });
  });

  test("updates conditional fields immediately within the same Page", async () => {
    const preview = mountPreview({
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 0, y: 0 }, data: { title: "Kontakt" } },
        { id: "contact-choice", type: "question", position: { x: 0, y: 0 }, parentPageId: "page", order: 0, data: { title: "Kontaktväg", variableName: "contact", options: [{ id: "email", label: "E-post", value: "email" }, { id: "phone", label: "Telefon", value: "phone" }] } },
        { id: "email", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 1, data: { title: "E-postadress", variableName: "email", required: true }, visibility: { match: "all", conditions: [{ id: "email-visible", variableName: "contact", operator: "equals", value: "email" }] } },
        { id: "phone", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 2, data: { title: "Telefonnummer", variableName: "phone", required: true }, visibility: { match: "all", conditions: [{ id: "phone-visible", variableName: "contact", operator: "equals", value: "phone" }] } },
        { id: "result", type: "result", position: { x: 400, y: 0 }, data: { title: "Tack" } },
      ],
      connections: [
        { id: "page-result", from: { nodeId: "page", portId: "continue" }, to: { nodeId: "result", portId: "input" } },
      ],
    });
    const emailChoice = preview.shadowRoot?.querySelector<HTMLInputElement>(
      'input[name="page-field-contact-choice"][value="email"]'
    );
    const emailField = preview.shadowRoot?.querySelector<HTMLElement>(
      '[data-page-field-id="email"]'
    );
    const phoneField = preview.shadowRoot?.querySelector<HTMLElement>(
      '[data-page-field-id="phone"]'
    );
    if (!emailChoice || !emailField || !phoneField) {
      throw new Error("Kunde inte hitta kontaktfältens villkor.");
    }

    expect(emailField.hidden).toBe(true);
    expect(phoneField.hidden).toBe(true);
    // Regressionstest: hidden-attributet räcker inte — fältets egen
    // display-regel vann tidigare över [hidden] så fälten syntes ändå.
    expect(getComputedStyle(emailField).display).toBe("none");
    expect(getComputedStyle(phoneField).display).toBe("none");
    await userEvent.click(emailChoice);
    expect(emailField.hidden).toBe(false);
    expect(getComputedStyle(emailField).display).not.toBe("none");
    expect(phoneField.hidden).toBe(true);
    expect(getComputedStyle(phoneField).display).toBe("none");
  });
  test("renderar Page-barn i responsivt grid och sparar deras svar", async () => {
    const preview = mountPreview({
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 0, y: 0 }, data: { title: "Kontakt" } },
        { id: "name", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 0, layout: { columnSpan: 6 }, data: { title: "Namn", variableName: "name", required: true } },
        { id: "phone", type: "number-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 1, layout: { columnSpan: 6 }, data: { title: "Telefon", variableName: "phone", required: true } },
        { id: "result", type: "result", position: { x: 300, y: 0 }, data: { title: "Tack {{name}}" } },
      ],
      connections: [{ id: "page-result", from: { nodeId: "page", portId: "continue" }, to: { nodeId: "result", portId: "input" } }],
    });
    const fields = preview.shadowRoot?.querySelectorAll<HTMLElement>(
      ".guide-preview__page-field--half"
    );
    const name = preview.shadowRoot?.querySelector<HTMLInputElement>('[data-page-variable="name"]');
    const phone = preview.shadowRoot?.querySelector<HTMLInputElement>('[data-page-variable="phone"]');
    const next = preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]');
    if (!name || !phone || !next) throw new Error("Kunde inte hitta Page-barnen.");

    expect(fields).toHaveLength(2);
    /*
     * Text med `inputmode="decimal"`, inte `type="number"`. Ett belopp grupperas
     * medan det skrivs, och `2 100 000` är inget giltigt tal — ett sifferfält
     * lämnar då ifrån sig tomma strängen och har ingen `selectionStart` att
     * sätta tillbaka markören i. Tangentbordet på plattan är detsamma.
     */
    expect(phone.type).toBe("text");
    expect(phone.inputMode).toBe("decimal");
    await userEvent.fill(name, "Kim");
    await userEvent.fill(phone, "12345");
    expect(next.disabled).toBe(false);
    await userEvent.click(next);

    expect(preview.getAnswers()).toEqual({ name: "Kim", phone: "12345" });
  });
  test("renderar underrubrik och blank rad i en sida", () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    document.body.append(preview);
    preview.graph = {
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 0, y: 0 }, data: { title: "Ansökan" } },
        { id: "name", type: "text-question", parentPageId: "page", order: 0, position: { x: 0, y: 0 }, data: { title: "Namn", variableName: "name" } },
        { id: "spacer", type: "page-spacer", parentPageId: "page", order: 1, position: { x: 0, y: 0 }, data: {} },
        { id: "heading", type: "page-heading", parentPageId: "page", order: 2, position: { x: 0, y: 0 }, data: { title: "Adress", description: "" } },
        { id: "street", type: "text-question", parentPageId: "page", order: 3, position: { x: 0, y: 0 }, data: { title: "Gatuadress", variableName: "street" } },
      ],
      connections: [],
    };

    const root = preview.shadowRoot;
    expect(root?.querySelector('[data-page-spacer-id="spacer"]')).not.toBeNull();
    expect(
      root?.querySelector('[data-page-heading-id="heading"] h3')?.textContent
    ).toBe("Adress");
    expect(root?.querySelectorAll(".guide-preview__page-field").length).toBe(2);
  });

  test("shows validation errors per field and focuses the summary when several fields fail", async () => {
    const preview = mountPreview({
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 0, y: 0 }, data: { title: "Ansökan" } },
        { id: "name", type: "text-question", parentPageId: "page", order: 0, position: { x: 0, y: 0 }, data: { title: "Namn", variableName: "name", required: true, minLength: 3 } },
        { id: "age", type: "number-question", parentPageId: "page", order: 1, position: { x: 0, y: 0 }, data: { title: "Ålder", variableName: "age", required: true, min: 0, max: 120, unit: "år" } },
        { id: "result", type: "result", position: { x: 300, y: 0 }, data: { title: "Tack" } },
      ],
      connections: [{ id: "page-result", from: { nodeId: "page", portId: "continue" }, to: { nodeId: "result", portId: "input" } }],
    });
    const root = preview.shadowRoot;
    const next = root?.querySelector<HTMLButtonElement>('[data-action="next"]');
    if (!next) throw new Error("Kunde inte hitta Nästa-knappen.");

    // Tomt formulär: fel på båda fälten — och då går fokus till
    // felsummeringen (story 051), inte till första fältet: role=alert läses
    // upp med antalet och länkarna. Fältnära felen står kvar som förut.
    await userEvent.click(next);
    const nameField = root?.querySelector<HTMLElement>('[data-page-field-id="name"]');
    const nameInput = nameField?.querySelector<HTMLInputElement>("input");
    expect(nameField?.hasAttribute("data-invalid")).toBe(true);
    expect(nameField?.textContent).toContain("Fältet är obligatoriskt.");
    expect(nameInput?.getAttribute("aria-invalid")).toBe("true");
    expect(nameInput?.getAttribute("aria-describedby")).toBe("page-field-error-name");
    expect(root?.querySelector('[data-page-field-id="age"]')?.textContent)
      .toContain("Fältet är obligatoriskt.");
    expect(root?.activeElement).toBe(root?.querySelector("[data-error-summary]"));

    // Too short a name gives a length error; too high an age a range error with a unit.
    await userEvent.fill(nameInput!, "Ab");
    const ageInput = root?.querySelector<HTMLInputElement>('[data-page-variable="age"]');
    await userEvent.fill(ageInput!, "130");
    await userEvent.click(root!.querySelector<HTMLButtonElement>('[data-action="next"]')!);
    expect(root?.querySelector('[data-page-field-id="name"]')?.textContent)
      .toContain("Texten måste innehålla minst 3 tecken.");
    expect(root?.querySelector('[data-page-field-id="age"]')?.textContent)
      .toContain("Värdet får vara högst 120 år.");

    // Felet försvinner direkt när fältet rättas.
    const nameInputAfter = root?.querySelector<HTMLInputElement>('[data-page-variable="name"]');
    await userEvent.fill(nameInputAfter!, "Kim");
    expect(root?.querySelector('[data-page-field-id="name"]')?.hasAttribute("data-invalid"))
      .toBe(false);
    expect(root?.querySelector('[data-page-field-id="name"] .guide-preview__field-error'))
      .toBeNull();

    // Med giltiga värden går guiden vidare.
    const ageInputAfter = root?.querySelector<HTMLInputElement>('[data-page-variable="age"]');
    await userEvent.fill(ageInputAfter!, "42");
    await userEvent.click(root!.querySelector<HTMLButtonElement>('[data-action="next"]')!);
    expect(root?.querySelector("h2")?.textContent).toBe("Tack");
  });

  test("shows and answers two PageNode fields at once", async () => {
    const preview = mountPreview({
      startNodeId: "page",
      nodes: [
        { id: "page", type: "page", position: { x: 0, y: 0 }, data: { title: "Kontaktuppgifter", description: "Fyll i båda fälten." } },
        // Fälten är riktiga barnnoder sedan v3→v4.
        { id: "f-name", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 0, data: { title: "Namn", variableName: "name", placeholder: "Ditt namn", required: true } },
        { id: "f-email", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "page", order: 1, data: { title: "E-post", variableName: "email", placeholder: "namn@example.se", required: true } },
        { id: "result", type: "result", position: { x: 300, y: 0 }, data: { title: "Tack {{name}}", description: "Vi kontaktar dig på {{email}}." } },
      ],
      connections: [{ id: "page-result", from: { nodeId: "page", portId: "continue" }, to: { nodeId: "result", portId: "input" } }],
    });
    const name = preview.shadowRoot?.querySelector<HTMLInputElement>('[data-page-variable="name"]');
    const email = preview.shadowRoot?.querySelector<HTMLInputElement>('[data-page-variable="email"]');
    const next = preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]');
    if (!name || !email || !next) throw new Error("Kunde inte hitta sidfälten.");

    // The button is always clickable; incomplete fields give an error on the attempt.
    expect(next.disabled).toBe(false);
    await userEvent.click(next);
    expect(preview.shadowRoot?.querySelectorAll(".guide-preview__field-error").length).toBe(2);

    // Omritningen efter valideringen ger nya element — hämta om dem.
    const nameAfter = preview.shadowRoot?.querySelector<HTMLInputElement>('[data-page-variable="name"]');
    const emailAfter = preview.shadowRoot?.querySelector<HTMLInputElement>('[data-page-variable="email"]');
    const nextAfter = preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]');
    if (!nameAfter || !emailAfter || !nextAfter) throw new Error("Kunde inte hitta sidfälten.");
    await userEvent.fill(nameAfter, "Kim");
    await userEvent.fill(emailAfter, "kim@example.se");
    await userEvent.click(nextAfter);

    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe("Tack Kim");
    expect(preview.shadowRoot?.textContent).toContain("Vi kontaktar dig på kim@example.se.");
    expect(preview.getAnswers()).toEqual({ name: "Kim", email: "kim@example.se" });
  });
  test.runIf(PRO)("previews and exposes resolved email data", async () => {
    const preview = mountPreview({
      startNodeId: "name",
      nodes: [
        { id: "name", type: "text-question", position: { x: 0, y: 0 }, data: { title: "Namn", variableName: "name", required: true } },
        { id: "email", type: "email-result", position: { x: 300, y: 0 }, data: {
          title: "E-postunderlag",
          to: "service@example.se",
          subject: "Ansökan från {{name}}",
          body: "Hej {{name}}. {{missing}}",
        } },
      ],
      connections: [
        { id: "to-email", from: { nodeId: "name", portId: "continue" }, to: { nodeId: "email", portId: "input" } },
      ],
    });
    const input = preview.shadowRoot?.querySelector<HTMLInputElement>("[data-text-answer]");
    const next = preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]');
    if (!input || !next) throw new Error("Kunde inte hitta textinmatningen.");

    await userEvent.fill(input, "Anna");
    await userEvent.click(next);

    /*
     * The resident gets the node's own heading and nothing else. The email
     * breakdown — "Producerar e-postdata – skickar inte.", the To/Subject/Body
     * list, the missing-variable warning — is the builder's view, and it used
     * to render here too, resolved recipient address and all. The host presents
     * the message itself from getOutput(); see examples/email-result.html.
     */
    expect(preview.shadowRoot?.textContent).toContain("E-postunderlag");
    expect(preview.shadowRoot?.textContent).not.toContain("Ansökan från Anna");
    expect(preview.shadowRoot?.textContent).not.toContain("Saknade variabler");
    expect(preview.shadowRoot?.textContent).not.toContain("service@example.se");

    // What the host needs is untouched: the data still comes out in full.
    expect(preview.getOutput()).toEqual({
      type: "email",
      format: "markdown",
      nodeId: "email",
      template: {
        to: "service@example.se",
        subject: "Ansökan från {{name}}",
        body: "Hej {{name}}. {{missing}}",
      },
      resolved: {
        to: "service@example.se",
        subject: "Ansökan från Anna",
        body: "Hej Anna. {{missing}}",
      },
      missingVariables: ["missing"],
    });
  });

  test.runIf(PRO)("and the builder still sees the breakdown on the canvas", async () => {
    // compact before the graph: the attribute decides how the first render goes.
    const preview = document.createElement("guide-preview") as GuidePreview;
    preview.setAttribute("compact", "");
    document.body.append(preview);
    preview.graph = {
      startNodeId: "email",
      nodes: [
        { id: "email", type: "email-result", position: { x: 0, y: 0 }, data: {
          title: "E-postunderlag",
          to: "service@example.se",
          subject: "Ansökan",
          body: "Hej. {{missing}}",
        } },
      ],
      connections: [],
    } as unknown as GraphData;
    await new Promise((resolve) => setTimeout(resolve, 60));

    const text = preview.shadowRoot?.textContent ?? "";

    expect({
      recipient: text.includes("service@example.se"),
      warning: text.includes("Saknade variabler: missing"),
    }).toEqual({ recipient: true, warning: true });
  });
});

describe("guide-preview: accessibility for input and results", () => {
  test("the heading points at the description (aria-describedby) so the result is announced", () => {
    const preview = mountPreview({
      startNodeId: "r",
      nodes: [
        {
          id: "r",
          type: "result",
          position: { x: 0, y: 0 },
          data: { title: "Klart", description: "Du får **1234 kr/mån**." },
        },
      ],
      connections: [],
    });
    const heading = preview.shadowRoot?.querySelector<HTMLElement>("h2");
    const desc = preview.shadowRoot?.querySelector<HTMLElement>(
      ".guide-preview__formatted"
    );
    expect(desc?.id).toBeTruthy();
    expect(heading?.getAttribute("aria-describedby")).toBe(desc?.id);
    expect(desc?.textContent).toContain("1234 kr/mån");
  });

  function numberGraph(): GraphData {
    return {
      startNodeId: "n",
      nodes: [
        {
          id: "n",
          type: "number-question",
          position: { x: 0, y: 0 },
          data: { title: "Antal", variableName: "antal", min: 0, max: 500, step: 1 },
        },
        { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: "Klart" } },
      ],
      connections: [
        { id: "c", from: { nodeId: "n", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
    };
  }

  test("number field: a value above the cap is marked invalid on blur with an inline error", async () => {
    const preview = mountPreview(numberGraph());
    const input = preview.shadowRoot?.querySelector<HTMLInputElement>(
      "[data-number-answer]"
    );
    if (!input) throw new Error("Sifferfältet saknas.");
    await userEvent.fill(input, "600");
    input.blur();
    const error = preview.shadowRoot?.querySelector<HTMLElement>(
      "[data-number-validation]"
    );
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(error?.hidden).toBe(false);
    expect(input.getAttribute("aria-describedby")).toBe(error?.id);
    expect((error?.textContent ?? "").length).toBeGreaterThan(0);
  });

  test("number field: Next with an out-of-range value shows a field error and keeps the value", async () => {
    const preview = mountPreview(numberGraph());
    const input = preview.shadowRoot?.querySelector<HTMLInputElement>(
      "[data-number-answer]"
    );
    const next = preview.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="next"]'
    );
    if (!input || !next) throw new Error("Fält eller knapp saknas.");
    await userEvent.fill(input, "600");
    await userEvent.click(next);

    const refreshed = preview.shadowRoot?.querySelector<HTMLInputElement>(
      "[data-number-answer]"
    );
    expect(refreshed?.getAttribute("aria-invalid")).toBe("true");
    expect(refreshed?.value).toBe("600");
    // The error shows on the field, not as a top banner.
    expect(preview.shadowRoot?.querySelector(".guide-preview__error")).toBeNull();
    // Och vi stannar kvar på sifferfrågan.
    expect(preview.shadowRoot?.querySelector("h2")?.textContent).toBe("Antal");
  });
});

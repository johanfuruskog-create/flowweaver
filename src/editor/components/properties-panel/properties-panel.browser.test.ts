// The sending steps are FlowWeaver PRO's; this test uses them (open-core step 4).
import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import { getEditorCapabilities } from "../../config/editor-capabilities";
import {
  registerMapProvider,
  unregisterMapProvider,
} from "../../../viewer/core/map-provider-registry";
import type { PropertiesPanel } from "./properties-panel";
import type { RichTextField } from "../rich-text-field/rich-text-field";
import { QuestionVariableService } from "../../../viewer/services/question-variable-service";
import type { GraphData } from "../../../viewer/types/graph";
import { clearDeclaredLocales, declareLocales } from "../../../viewer/localization/registry";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
await withPro("index.ts");
const { registerSubmissionReceiver, unregisterSubmissionReceiver } = (await proModule("viewer/core/submission-registry.ts")) ?? {};
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

afterEach(() => {
  document.body.replaceChildren();
});

describe("properties-panel email templates", () => {
  test.runIf(PRO)("inserts the same question variables into the email field at the cursor", async () => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.variableOptions = [{
      label: "Sökandens namn",
      value: "applicantName",
      type: "text",
      options: [],
    }];
    panel.nodeData = {
      id: "email",
      type: "email-result",
      position: { x: 0, y: 0 },
      data: { title: "E-post", description: "", to: "", subject: "Hej ", body: "" },
    };
    const changed = vi.fn();
    panel.addEventListener("node-data-changed", changed);

    // A `<rich-text-field>` since story 136, with *Infoga svar* in its right edge.
    const subject = panel.shadowRoot?.querySelector<RichTextField>('[data-property="subject"]');
    const toggle = subject?.shadowRoot?.querySelector<HTMLButtonElement>("[data-answer-toggle]");
    if (!subject || !toggle) throw new Error("Kunde inte hitta e-postfältets variabelknapp.");

    // Untouched, the caret is at the end.
    await userEvent.click(toggle);
    await userEvent.click(
      subject.shadowRoot!.querySelector<HTMLButtonElement>('[data-insert="applicantName"]')!,
    );

    expect(subject.value).toBe("Hej {{applicantName}}");
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({
      detail: {
        nodeId: "email",
        property: "subject",
        value: "Hej {{applicantName}}",
      },
    }));
  });
  /*
   * *Variabler skrivs som {{variableName}}* taught the syntax the rich text
   * field now hides: answers are inserted with *Infoga svar* and shown as
   * chips (story 136). Struck on Johan's word 25/9. The subject keeps its
   * warning about plain text — in both languages.
   */
  test.runIf(PRO).each([
    ["sv", "Ämnesraden går alltid i klartext"],
    ["en", "The subject line always travels in plain text"],
  ])("the email fields teach no {{…}} syntax, and the subject keeps its warning (%s)", (locale, warning) => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;

    panel.editorMode = "administrator";
    panel.editorLocale = locale;
    document.body.append(panel);
    panel.nodeData = {
      id: "email",
      type: "email-result",
      position: { x: 0, y: 0 },
      data: { title: "E-post", description: "", to: "", subject: "", body: "" },
    };

    const help = (property: string): string =>
      panel.shadowRoot!.querySelector(`[data-property="${property}"]`)!
        .closest(".properties-panel__field")!
        .querySelector(".properties-panel__help")?.textContent ?? "";

    expect(help("subject")).toContain(warning);
    expect(help("subject")).not.toContain("{{");
    expect(help("body")).not.toContain("{{");
  });

  test.runIf(PRO)("shows only the tools the field's formatting profile allows", async () => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.nodeData = {
      id: "question",
      type: "question",
      position: { x: 0, y: 0 },
      data: { title: "Fråga", description: "", options: [] },
    };

    const questionTools = Array.from(
      panel.shadowRoot
        ?.querySelector('rich-text-field[data-property="description"]')
        ?.shadowRoot?.querySelectorAll<HTMLButtonElement>("[data-command]") ?? [],
      (button) => button.dataset.command
    );
    /*
     * Beskrivningar bär prosa och fick listor och länkar: "du behöver:
     * personnummer, fastighetsbeteckning, situationsplan" är den vanligaste
     * formen i offentlig text, och den gick inte att skriva i en fråga.
     *
     * Verktygsraden ska visa exakt det nodtypen deklarerar — varken mer, som
     * hade gett en knapp visaren inte renderar, eller mindre.
     */
    expect(questionTools).toEqual([
      "bold",
      "italic",
      "link",
      "bullet-list",
      "numbered-list",
    ]);

    panel.nodeData = {
      id: "email",
      type: "email-result",
      position: { x: 0, y: 0 },
      data: { title: "E-post", description: "", to: "", subject: "", body: "" },
    };
    const body = panel.shadowRoot?.querySelector<RichTextField>('[data-property="body"]');
    const bold = body?.shadowRoot?.querySelector<HTMLButtonElement>('[data-command="bold"]');
    /*
     * Ingen variabelknapp här, och det är avsiktligt: panelen har inga
     * variabler i det här provet. En knapp som öppnar en tom lista lovar ett
     * val den inte kan ge — se story 060.
     */
    const variable = body?.shadowRoot?.querySelector("[data-answer-toggle]");
    if (!body || !bold) throw new Error("E-postens formatteringsverktyg saknas.");

    body.value = "Viktigt";
    body.shadowRoot!.querySelector<HTMLElement>("[data-text]")!.focus();
    await userEvent.keyboard("{End}{Shift>}{Home}{/Shift}");
    await userEvent.click(bold);

    expect(body.value).toBe("**Viktigt**");
    expect(body.shadowRoot!.querySelector('[data-command="bullet-list"]')).not.toBeNull();
    expect(variable?.closest("[hidden]"), "ingen variabelknapp utan variabler").not.toBeNull();
  });
});

describe("properties-panel – annoterad bild (kommentar-kontroll)", () => {
  function mountAnnotated(): { panel: PropertiesPanel; changed: ReturnType<typeof vi.fn> } {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.nodeData = {
      id: "a1",
      type: "annotated-image",
      position: { x: 0, y: 0 },
      data: {
        title: "Bild",
        imageUrl: "https://example.com/a.png",
        comments: [{ id: "c1", text: "Först", x: 10, y: 20, arrow: "up" }],
      },
    };
    const changed = vi.fn();
    panel.addEventListener("node-data-changed", changed);
    return { panel, changed };
  }

  test("renders the comment row and Add comment", () => {
    const { panel } = mountAnnotated();
    const text = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-annotation-property="text"]'
    );
    expect(text?.value).toBe("Först");
    expect(panel.shadowRoot?.textContent).toContain("Lägg till kommentar");
  });

  test("Add comment dispatches an updated list", () => {
    const { panel, changed } = mountAnnotated();
    panel.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-action="add-annotation"]')
      ?.click();
    expect(changed).toHaveBeenCalled();
    const detail = changed.mock.calls.at(-1)?.[0].detail;
    expect(detail.property).toBe("comments");
    expect(detail.value).toHaveLength(2);
  });

  test("bild-canvasen visar en dragbar pin per kommentar", () => {
    const { panel } = mountAnnotated();
    const canvas = panel.shadowRoot?.querySelector("[data-annotation-canvas]");
    expect(canvas).not.toBeNull();
    expect(panel.shadowRoot?.querySelectorAll("[data-annotation-pin]")).toHaveLength(1);
  });

  test("drag av en pin dispatchar en positionsuppdatering", () => {
    const { panel, changed } = mountAnnotated();
    const pin = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      "[data-annotation-pin]"
    );
    pin!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 10, clientY: 10 }));
    pin!.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: 40, clientY: 40 }));
    pin!.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    const detail = changed.mock.calls.at(-1)?.[0].detail;
    expect(detail.property).toBe("comments");
    expect(Array.isArray(detail.value)).toBe(true);
  });

  test("redigering av kommentar-texten dispatchar node-data-changed", async () => {
    const { panel, changed } = mountAnnotated();
    const input = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-annotation-property="text"]'
    );
    input!.value = "Ändrad";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    const detail = changed.mock.calls.at(-1)?.[0].detail;
    expect(detail.property).toBe("comments");
    // Into the active content language's slot — the text is LocalizedText now,
    // so a translation-mode edit cannot wipe the source.
    expect(detail.value[0].text).toEqual({ sv: "Ändrad" });
  });
});

describe("properties-panel: UI language (editor-locale) for field labels", () => {
  test("English field labels and select options", () => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.editorLocale = "en";
    panel.nodeData = {
      id: "q1",
      type: "question",
      position: { x: 0, y: 0 },
      data: { title: "Fråga", variableName: "svar", presentation: "radio", options: [] },
    };
    const text = panel.shadowRoot?.textContent ?? "";
    expect(text).toContain("Heading"); // nodeProp.title.label
    expect(text).toContain("Shown as"); // nodeProp.presentation.label
    expect(text).toContain("Radio buttons"); // nodeOption.radio
    expect(text).not.toContain("Rubrik");
  });

  test("the alias field explains itself in English too", () => {
    /*
     * Measured 3/9: sixteen property descriptions have no string in the
     * registry, so the English editor showed them in Swedish. This one
     * is the alias — the word that rules, band, gaps and chip show — so
     * its description is also where a new editor learns that.
     */
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.editorLocale = "en";
    panel.nodeData = {
      id: "q1",
      type: "question",
      position: { x: 0, y: 0 },
      data: { title: "Fråga", variableName: "svar", presentation: "radio", options: [] },
    };
    const text = panel.shadowRoot?.textContent ?? "";
    expect(text).toContain("The word shown in rules, conditions and result text.");
    expect(text).not.toContain("variabellistan");
  });

  test("the map question's kind select is translated too", () => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.editorLocale = "en";
    panel.nodeData = {
      id: "m1",
      type: "map-question",
      position: { x: 0, y: 0 },
      data: { title: "Var?", variableName: "plats", kind: "point" },
    };
    const text = panel.shadowRoot?.textContent ?? "";
    expect(text).toContain("Kind"); // nodeProp.kind.label
    expect(text).toContain("Point"); // nodeOption.point
    expect(text).toContain("Several points"); // nodeOption.points
    expect(text).toContain("Area"); // nodeOption.area
    expect(text).not.toContain("Flera punkter");
  });

  test("the start view is picked through the provider and stored with its label", async () => {
    registerMapProvider({
      kinds: ["point"],
      pick: async () => ({
        geometry: { type: "Point", coordinates: [17.3069, 62.3908] },
        label: "Storgatan 12, Sundsvall",
      }),
    });

    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.nodeData = {
      id: "m1",
      type: "map-question",
      position: { x: 0, y: 0 },
      data: { title: "Var?", variableName: "plats", kind: "point", startView: "" },
    };

    const changed = vi.fn();

    panel.addEventListener("node-data-changed", changed as EventListener);
    panel.shadowRoot!.querySelector<HTMLButtonElement>("[data-map-start-pick]")!.click();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const detail = changed.mock.calls.at(-1)?.[0].detail;

    expect(detail.property).toBe("startView");
    expect(JSON.parse(detail.value)).toEqual({
      geometry: { type: "Point", coordinates: [17.3069, 62.3908] },
      label: "Storgatan 12, Sundsvall",
    });

    unregisterMapProvider();
  });

  test("picking again hands the provider the chosen start view, like the answer field does", async () => {
    const pickCalls: Array<Record<string, unknown>> = [];

    registerMapProvider({
      kinds: ["point"],
      pick: async (options) => {
        pickCalls.push(options as Record<string, unknown>);
        return null;
      },
    });

    const stored = JSON.stringify({
      geometry: { type: "Point", coordinates: [17.3069, 62.3908] },
      label: "Storgatan 12, Sundsvall",
      zoom: 16,
    });
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.nodeData = {
      id: "m1",
      type: "map-question",
      position: { x: 0, y: 0 },
      data: { title: "Var?", variableName: "plats", kind: "point", startView: stored },
    };

    panel.shadowRoot!.querySelector<HTMLButtonElement>("[data-map-start-pick]")!.click();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(pickCalls[0].current).toEqual({ type: "Point", coordinates: [17.3069, 62.3908] });
    expect(pickCalls[0].zoom).toBe(16);

    unregisterMapProvider();
  });

  test("without a provider the start view says so instead of offering a dead button", () => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.nodeData = {
      id: "m1",
      type: "map-question",
      position: { x: 0, y: 0 },
      data: { title: "Var?", variableName: "plats", kind: "point", startView: "" },
    };

    expect(panel.shadowRoot!.querySelector("[data-map-start-pick]")).toBeNull();
    expect(panel.shadowRoot!.textContent).toContain("Ingen karta inkopplad här");
  });

  test("Swedish source texts by default (no editor-locale)", () => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.nodeData = {
      id: "q1",
      type: "question",
      position: { x: 0, y: 0 },
      data: { title: "Fråga", variableName: "svar", presentation: "radio", options: [] },
    };
    const text = panel.shadowRoot?.textContent ?? "";
    expect(text).toContain("Rubrik");
    expect(text).toContain("Radioknappar");
  });
});

describe("properties-panel translation mode", () => {
  test("translates the title in the active language, shows the source and locks identity fields", async () => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    document.body.append(panel);
    // Aktivt språk sätts före nodeData (som ritar om).
    panel.activeLocale = "en";
    panel.nodeData = {
      id: "q1",
      type: "question",
      position: { x: 0, y: 0 },
      data: { title: "Fråga", variableName: "svar", options: [] },
    };

    const titleInput = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-property="title"]'
    );
    const varInput = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-property="variableName"]'
    );
    const source = panel.shadowRoot?.querySelector("[data-source-reference]");
    if (!titleInput || !varInput || !source) {
      throw new Error("Kunde inte hitta översättningsfälten.");
    }

    // A clear banner naming the active language.
    const banner = panel.shadowRoot?.querySelector(
      ".properties-panel__translation-banner"
    );
    /*
     * Namnet kommer på editorns UI-språk — svenska här, inte "English" — och
     * med versal, eftersom det står ensamt efter en avdelare i "Översättningsläge
     * · Engelska". I en mening skrivs det med liten bokstav; se `localeTitle`.
     */
    expect(banner?.textContent).toContain("Engelska");

    // No translation yet: an empty field, the source as placeholder and reference.
    expect(titleInput.value).toBe("");
    expect(titleInput.getAttribute("placeholder")).toBe("Fråga");
    expect(source.textContent).toContain("Fråga");

    // Identitetsfältet är låst i översättningsläge.
    expect(varInput.disabled).toBe(true);

    const changed = vi.fn();
    panel.addEventListener("node-data-changed", changed);
    await userEvent.type(titleInput, "Q");

    // The write merges in the active language without touching the source.
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detail: {
          nodeId: "q1",
          property: "title",
          value: { sv: "Fråga", en: "Q" },
        },
      })
    );
  });

  test("translates the options' label but locks the value", async () => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.activeLocale = "en";
    panel.nodeData = {
      id: "q1",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: "Fråga",
        options: [{ id: "a", label: "Ja", value: "yes" }],
      },
    };

    const labelInput = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-option-property="label"][data-option-id="a"]'
    );
    const valueInput = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-option-property="value"]'
    );
    if (!labelInput || !valueInput) {
      throw new Error("Kunde inte hitta alternativfälten.");
    }

    /*
     * Etapp 2 (UPPDRAG-2026-09-28-SVARSALTERNATIV, 28/9): fälten ligger nu i
     * alternativets utfällbara kropp, stängd som viloläge. Utfällningen är
     * Teds klick-hanterade beteende, inte byggt än — provet öppnar kroppen
     * direkt (samma attribut hans knapp kommer sätta) för att pröva
     * översättningsläget i sig, inte utfällningen.
     */
    labelInput.closest("[data-option-body]")?.removeAttribute("hidden");

    // The label is empty (no translation) with the source as the placeholder.
    expect(labelInput.value).toBe("");
    expect(labelInput.placeholder).toBe("Ja");
    // The value is an identity and is locked.
    expect(valueInput.disabled).toBe(true);

    const changed = vi.fn();
    panel.addEventListener("node-data-changed", changed);
    await userEvent.type(labelInput, "Y");

    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detail: {
          nodeId: "q1",
          property: "options",
          value: [{ id: "a", label: { sv: "Ja", en: "Y" }, value: "yes" }],
        },
      })
    );
  });

  test("the source language is edited as usual, unlocked", async () => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.activeLocale = "sv";
    panel.nodeData = {
      id: "q1",
      type: "question",
      position: { x: 0, y: 0 },
      data: { title: "Fråga", variableName: "svar", options: [] },
    };

    const titleInput = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-property="title"]'
    );
    const varInput = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-property="variableName"]'
    );
    if (!titleInput || !varInput) {
      throw new Error("Kunde inte hitta fälten.");
    }

    // Source language: the source text shows, no banner, no reference, nothing locked.
    expect(titleInput.value).toBe("Fråga");
    expect(varInput.disabled).toBe(false);
    expect(panel.shadowRoot?.querySelector("[data-source-reference]")).toBeNull();
    expect(
      panel.shadowRoot?.querySelector(".properties-panel__translation-banner")
    ).toBeNull();
  });
});
describe("logiknodernas rubriker i översättningsläge", () => {
  /*
   * Found on a tablet: the calculation node's heading field stood empty in
   * English translation mode although the graph carried the English title and
   * the canvas showed it. Rule, calculation and service-call had never been
   * marked `localized: true`, so the panel treated their titles as
   * untranslatable — locked and blank — while every question's title beside
   * them translated fine.
   */
  test.each(["rule", "calculation", "service-call"] as const)(
    "%s-nodens rubrik visar målspråkets text",
    async (type) => {
      const panel = document.createElement("properties-panel") as PropertiesPanel;

      panel.editorMode = "administrator";
      document.body.append(panel);
      panel.activeLocale = "en";
      panel.nodeData = {
        id: "n1",
        type,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Räkna ut", en: "Work it out" } },
      };

      const titleInput = panel.shadowRoot?.querySelector<HTMLInputElement>(
        '[data-property="title"]'
      );

      expect(titleInput?.value, "målspråkets titel syns inte").toBe("Work it out");
    },
  );
});

describe("properties-panel – visar nodens modul", () => {
  function moduleText(type: string, data: Record<string, unknown>): string {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    panel.capabilities = getEditorCapabilities("advanced");
    document.body.append(panel);
    panel.nodeData = { id: "n", type, position: { x: 0, y: 0 }, data };
    return (
      panel.shadowRoot
        ?.querySelector("[data-node-module]")
        ?.textContent?.trim() ?? ""
    );
  }

  test("a calculation node shows the Logik module", () => {
    expect(moduleText("calculation", { title: "U", assignments: [] })).toContain(
      "Logik"
    );
  });

  test("an ungated question shows Grund", () => {
    expect(moduleText("question", { title: "F", options: [] })).toContain(
      "Grund"
    );
  });

  test("a code node shows the Innehall module", () => {
    expect(moduleText("code", { title: "K", code: "" })).toContain("Innehåll");
  });
});

describe("properties-panel – enkel regel (light) i basic", () => {
  function mountRule(
    level: "basic" | "advanced",
    conditions: Array<{ variableName: string; operator: string; value: string }>
  ): PropertiesPanel {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    panel.capabilities = getEditorCapabilities(level);
    panel.variableOptions = [
      {
        label: "Bolagsform",
        value: "bolagsform",
        type: "choice",
        options: [
          { label: "Enskild firma", value: "enskild" },
          { label: "Aktiebolag", value: "ab" },
        ],
      },
    ];
    document.body.append(panel);
    panel.nodeData = {
      id: "rule",
      type: "rule",
      position: { x: 0, y: 0 },
      data: {
        title: "Regel",
        cases: [
          {
            id: "case-1",
            label: "Gren 1",
            match: "all",
            conditions: conditions.map((condition, index) => ({
              id: `cond-${index}`,
              ...condition,
            })),
          },
        ],
        fallbackLabel: "Annars",
      },
    };
    return panel;
  }

  const oneCondition = [{ variableName: "bolagsform", operator: "equals", value: "ab" }];
  const twoConditions = [
    { variableName: "bolagsform", operator: "equals", value: "ab" },
    { variableName: "bolagsform", operator: "not-equals", value: "enskild" },
  ];

  test("basic: a simple rule without adding or removing conditions", () => {
    const panel = mountRule("basic", oneCondition);
    const root = panel.shadowRoot;
    // The core is there: variable, comparison and value can be set.
    expect(root?.querySelector('[data-rule-condition-property="variableName"]')).not.toBeNull();
    expect(root?.querySelector('[data-rule-condition-property="value"]')).not.toBeNull();
    // But the advanced structure is hidden.
    expect(root?.querySelector('[data-action="add-rule-condition"]')).toBeNull();
    expect(root?.querySelector('[data-action="remove-rule-condition"]')).toBeNull();
    // Branching further (adding whole rules) remains — that is the point.
    expect(root?.querySelector('[data-action="add-rule-case"]')).not.toBeNull();
  });

  test("advanced: kan bygga flervillkorsregler", () => {
    const panel = mountRule("advanced", oneCondition);
    expect(
      panel.shadowRoot?.querySelector('[data-action="add-rule-condition"]')
    ).not.toBeNull();
  });

  test("basic: an advanced-built multi-condition rule is locked but loses no conditions", () => {
    const panel = mountRule("basic", twoConditions);
    const root = panel.shadowRoot;
    // Noteringen förklarar varför strukturen är låst.
    expect(root?.querySelector(".properties-panel__rule-locked")).not.toBeNull();
    // The AND/OR picker is read-only (no editable select).
    expect(root?.querySelector('[data-rule-case-property="match"]')).toBeNull();
    // Båda villkoren finns fortfarande kvar (inget svaldes tyst).
    expect(root?.querySelectorAll("[data-rule-condition-id]").length).toBe(2);
  });
});

/**
 * En variabel heter samma sak överallt man väljer den.
 *
 * Johan på plattan 31/8, i regelvillkoret: *Medborgarskap (kod)* och
 * *Medborgarskap* stod bredvid varandra utan att något sa vilket namn regeln
 * faktiskt skulle testa. Väljaren visade bara rubriken; variabellistan bakom
 * `{{var}}` visade båda halvorna, och det är den formen som blev gemensam.
 *
 * Påståendena här läser den EXAKTA texten, och det sista bygger sin väntade
 * text ur variabellistans egen rad — går de isär faller det.
 */
describe("regelvillkorets variabelväljare", () => {
  const uppslagsgraf = {
    startNodeId: "land",
    nodes: [
      {
        id: "land",
        type: "multi-autocomplete-question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Vilka länder är du medborgare i?" },
          variableName: "land",
          variableLabel: "Medborgarskap",
          source: "codelist",
          codeListId: "navet-country-codes",
        },
      },
      {
        id: "bil",
        type: "question",
        position: { x: 200, y: 0 },
        data: {
          title: { sv: "Har du bil?" },
          variableName: "bil",
          options: [{ id: "ja", label: { sv: "Ja" }, value: "yes" }],
        },
      },
      { id: "regel", type: "rule", position: { x: 400, y: 0 }, data: {} },
    ],
    connections: [],
  } as never as GraphData;

  function panelFörRegeln(): PropertiesPanel {
    const panel = document.createElement("properties-panel") as PropertiesPanel;

    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.variableOptions = QuestionVariableService.getOptions(uppslagsgraf);
    panel.nodeData = {
      id: "regel",
      type: "rule",
      position: { x: 400, y: 0 },
      data: {
        title: "Regel",
        cases: [{
          id: "c",
          label: "Gren",
          match: "all",
          conditions: [{ id: "v", variableName: "", operator: "equals", value: "" }],
        }],
        fallbackLabel: "Annars",
      },
    } as never;

    return panel;
  }

  /*
   * The rows as the field picker draws them (story 143): the name over the
   * technical name in its chip — the two halves the select wrote as
   * *Fråga — {{variabel}}* on one line.
   */
  const väljarensRader = (panel: PropertiesPanel): Array<{ value: string; text: string }> =>
    [...panel.shadowRoot!.querySelector('field-picker[data-rule-condition-property="variableName"]')!
      .shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]')]
      .map((row) => ({
        value: row.querySelector(".chip")!.textContent!,
        text: row.querySelector(".option__label")!.textContent!,
      }));

  test("visar rubriken och det tekniska namnet, för varje del av svaret", () => {
    /*
     * Ett uppslag svarar med två delar: koden en regel prövar och namnet en
     * människa läser. Rubrikerna skiljer dem åt — men bara namnet efter säger
     * vilket namn villkoret skriver.
     */
    expect(väljarensRader(panelFörRegeln()).map((rad) => [rad.text, rad.value])).toEqual([
      ["Medborgarskap (kod)", "land.value"],
      ["Medborgarskap", "land.label"],
      ["Har du bil?", "bil"],
      ["I dag", "idag"],
    ]);
  });

  test("och erbjuder aldrig den nakna helheten när svaret har delar", () => {
    /*
     * `{{land}}` finns kvar för gamla mallar, men som ERBJUDANDE är den en
     * fälla: den läser som sin text, alltså namnen, och en regel som jämför
     * med en kod hade aldrig tagit.
     */
    const rader = väljarensRader(panelFörRegeln());

    // Not vacuous: with no rows found, "never offered" would pass by itself.
    expect(rader.length, "väljaren har rader").toBeGreaterThan(0);
    expect(rader.map((rad) => rad.value)).not.toContain("land");
  });

  test("samma etikett som Infoga svar, rad för rad", () => {
    /*
     * Listan är formens ursprung. Sedan story 136 visar *Infoga svar* bara
     * etiketten — redaktören ser aldrig klamrarna — så det som ska stämma är
     * etiketthalvan av väljarens rad: skrivs den ena om utan den andra faller
     * det här. Sedan story 143 står etiketten ensam överst i raden.
     */
    const panel = panelFörRegeln();
    const iVäljaren = new Map(
      väljarensRader(panel).map((rad) => [rad.value, rad.text]),
    );

    panel.nodeData = {
      id: "tack",
      type: "result",
      position: { x: 0, y: 0 },
      data: { title: "Tack", description: "" },
    } as never;

    const listansRader = [...panel.shadowRoot!
      .querySelector('rich-text-field[data-property="title"]')!
      .shadowRoot!.querySelectorAll<HTMLElement>("[data-insert]")].map((rad) => ({
      value: rad.dataset.insert!,
      text: rad.textContent!.trim(),
    }));

    expect(listansRader.length, "listan har rader att jämföra med").toBe(4);
    expect(listansRader.map((rad) => rad.text)).toEqual(
      listansRader.map((rad) => iVäljaren.get(rad.value)),
    );
  });
});

describe("properties-panel guide settings", () => {
  test("guide mode: edits viewer texts in the chosen language and emits a change", async () => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Opt in: the default is readonly, and this test builds.
    panel.editorMode = "administrator";
    panel.activeLocale = "en";
    panel.guideStrings = {};
    document.body.append(panel); // ingen nod markerad → guide-läge

    const nextInput = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-guide-string="nav.next"]'
    );
    if (!nextInput) {
      throw new Error("Kunde inte hitta visartext-fältet.");
    }

    // An empty field, the built-in English default as the placeholder.
    expect(nextInput.value).toBe("");
    expect(nextInput.placeholder).toBe("Next");

    const changed = vi.fn();
    panel.addEventListener("guide-string-changed", changed);
    // The texts sit folded under their heading; a person opens them first.
    nextInput.closest("details")!.open = true;
    await userEvent.type(nextInput, "Go");

    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detail: { key: "nav.next", value: { en: "Go" } },
      })
    );
  });
});

describe("properties-panel: the guide's languages", () => {
  function montera(locales: string[], source = "sv"): PropertiesPanel {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    // Adding, removing and naming the source require an administrator.
    panel.editorMode = "administrator";
    panel.canManageTemplates = true;
    panel.sourceLocale = source;
    panel.guideLocales = locales;
    document.body.append(panel); // guide-läge
    return panel;
  }

  const rader = (panel: PropertiesPanel): string[] =>
    [...(panel.shadowRoot?.querySelectorAll("[data-locale]") ?? [])].map(
      (rad) => rad.getAttribute("data-locale") ?? "",
    );

  test("shows the guide's languages with the source first", () => {
    expect(rader(montera(["sv", "en", "fi"]))).toEqual(["sv", "en", "fi"]);
  });

  const box = (panel: PropertiesPanel, code: string): HTMLInputElement | null =>
    panel.shadowRoot!.querySelector<HTMLInputElement>(
      `[data-locale-offered="${code}"]`,
    );

  /*
   * Adding and removing are gone. Which languages exist is the host's decision,
   * and the editor's is only whether *this* guide is offered in one of them —
   * so the control is a box, and the source's box is ticked and disabled.
   */
  test("the source is ticked and cannot be unticked", () => {
    const panel = montera(["sv", "en"]);

    expect({
      source: { on: box(panel, "sv")?.checked, locked: box(panel, "sv")?.disabled },
      other: { on: box(panel, "en")?.checked, locked: box(panel, "en")?.disabled },
    }).toEqual({
      source: { on: true, locked: true },
      other: { on: true, locked: false },
    });
  });

  test("unticking one takes it out of the guide's languages", async () => {
    const panel = montera(["sv", "en"]);
    const changed = vi.fn();
    panel.addEventListener("guide-locales-changed", changed);

    await userEvent.click(box(panel, "en")!);

    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0][0].detail.locales).toEqual(["sv"]);
  });

  /*
   * Unticking changes `settings.locales` and nothing else — the translations
   * stay in the nodes. That is what makes it safe to do without a confirmation,
   * and what makes ticking it back bring the work with it.
   */
  test("a language the host offers can be ticked on", async () => {
    // The panel reads the host's declaration from the registry, which is where
    // a host puts it. Declaring here is the same call `init` would make.
    declareLocales(["sv", "en", "so"]);
    const panel = montera(["sv"]);
    const changed = vi.fn();
    panel.addEventListener("guide-locales-changed", changed);

    await userEvent.click(box(panel, "so")!);

    expect(changed.mock.calls[0][0].detail.locales).toContain("so");
    clearDeclaredLocales();
  });

  test("and one the host has not offered is not in the list at all", () => {
    clearDeclaredLocales();

    expect(box(montera(["sv", "en"]), "so")).toBeNull();
  });

  /*
   * A guide translated into a language the host has since stopped offering
   * keeps it. The translation exists, and dropping it from the list would hide
   * someone's work behind a configuration change.
   */
  test("a language the guide carries survives the host dropping it", () => {
    declareLocales(["sv", "en"]);
    const panel = montera(["sv", "fi"]);

    expect({
      present: box(panel, "fi") !== null,
      ticked: box(panel, "fi")?.checked,
    }).toEqual({ present: true, ticked: true });
    clearDeclaredLocales();
  });

  // Offering a language is a promise to keep it current, and that binds more
  // people than whoever happens to be editing right now.
  test("an editor cannot change what the guide is offered in", () => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    panel.editorMode = "edit";
    panel.guideLocales = ["sv", "en"];
    document.body.append(panel);

    expect(
      [...panel.shadowRoot!.querySelectorAll<HTMLInputElement>("[data-locale-offered]")]
        .every((input) => input.disabled),
    ).toBe(true);
  });

  test("but sees which languages the guide exists in", () => {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    panel.editorMode = "edit";
    panel.guideLocales = ["sv", "en"];
    document.body.append(panel);

    expect(rader(panel)).toEqual(["sv", "en"]);
  });
});

/*
 * Uppdrag 2026-08-27 B: emailVariable was free text — nothing stopped a typo
 * or a variable no question sets, and the editor found out only once a
 * resident's receipt silently failed to arrive. Same pattern as
 * annotation.targetNodeId (a node-select fed by nodeOptions): a select fed
 * by the guide's actual variables, so a wrong name is impossible to type.
 */
describe("properties-panel – emailVariable som variabelväljare", () => {
  function montera(): PropertiesPanel {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    panel.editorMode = "administrator";
    document.body.append(panel);
    return panel;
  }

  /*
   * `format` avgör numera vad väljaren erbjuder (story 054): fältet ber om
   * besökarens e-post och listar därför bara frågor med det formatet. Testerna
   * nedan handlar om väljarens mekanik — tomt förstahandsval, vad ett val
   * skickar, och att ett borttappat värde inte kastas tyst — så fixturen har
   * en e-postfråga att erbjuda.
   */
  const variabler = [
    { label: "Din e-post", value: "epost", type: "text" as const, options: [], format: "email" },
    { label: "Ditt namn", value: "namn", type: "text" as const, options: [] },
  ];

  function medNod(recipientId = "", emailVariable = ""): {
    panel: PropertiesPanel;
    select: HTMLSelectElement;
  } {
    const panel = montera();
    panel.variableOptions = variabler;
    panel.nodeData = {
      id: "s",
      type: "submit-result",
      position: { x: 0, y: 0 },
      data: { title: "Tack", recipientId, emailCopy: true, emailVariable },
    };
    const select = panel.shadowRoot?.querySelector<HTMLSelectElement>(
      '[data-property="emailVariable"]',
    );
    if (!select) throw new Error("Kunde inte hitta emailVariable-fältet.");
    return { panel, select };
  }

  test.runIf(PRO)("fältet är en select, inte ett textfält", () => {
    const { select } = medNod();
    expect(select.tagName).toBe("SELECT");
  });

  test.runIf(PRO)("options kommer ur guidens variabler, med ett tomt förstahandsval", () => {
    const { select } = medNod();
    const options = [...select.options].map((option) => ({
      value: option.value,
      label: option.textContent?.trim(),
    }));

    expect(options[0].value).toBe("");
    // Bara e-postfrågan: "Ditt namn" kan inte innehålla en adress (story 054).
    // Namnet är rubriken PLUS det tekniska namnet, som i varje annan väljare
    // (uppdrag 2026-08-31); det VALDA är fortfarande bara namnet — testet under.
    expect(options.slice(1)).toEqual([
      { value: "epost", label: "Din e-post — {{epost}}" },
    ]);
  });

  test.runIf(PRO)("att välja en variabel skickar dess namn, inte {{namn}}-syntax", async () => {
    const { panel, select } = medNod();
    const changed = vi.fn();
    panel.addEventListener("node-data-changed", changed);

    await userEvent.selectOptions(select, "epost");

    expect(changed).toHaveBeenCalledWith(expect.objectContaining({
      detail: { nodeId: "s", property: "emailVariable", value: "epost" },
    }));
  });

  test.runIf(PRO)("ett sparat värde som inte längre finns bland variablerna kastas inte tyst", () => {
    const { panel, select } = medNod("", "raderad-variabel");

    /*
     * Värdet står kvar i listan, märkt som borta (story 054 kriterium 3).
     *
     * Testet krävde tidigare motsatsen: att ingen <option> matchade. Datat var
     * orört även då, men panelen visade en tom väljare medan grafen bar ett
     * värde — samma tystnad som gjorde att svaren "försvann" vid ett steg
     * bakåt. Nu ser redaktören vad som hänt och kan välja om.
     */
    const kvar = [...select.options].find((option) => option.value === "raderad-variabel");

    expect(kvar?.textContent).toMatch(/finns inte längre/);
    expect(select.value).toBe("raderad-variabel");

    // Och datat är orört: ingen skrivning sker förrän fältet faktiskt ändras.
    expect(panel.nodeData?.data.emailVariable).toBe("raderad-variabel");
  });
});

/*
 * Uppdrag 2026-08-27 C: an empty recipientId select looked the same whether
 * the host had not wired up a catalog at all or simply had not answered
 * yet — a redaktör facing a placeholder-only dropdown could not tell "no
 * catalog" from "broken". This must not touch stale-recipient's separate
 * territory: a *cleaned* id (a value the select no longer offers) stays
 * silent here, guide-health-service is what flags that one.
 */
describe("mottagarväljaren utan katalog", () => {
  afterEach(() => unregisterSubmissionReceiver());

  function options(type: string, data: Record<string, unknown> = {}): string[] {
    const panel = document.createElement("properties-panel") as PropertiesPanel;
    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.nodeData = {
      id: "m",
      type,
      position: { x: 0, y: 0 },
      data: { title: "Tack", ...data },
    };
    /*
     * Inlämningen har en LISTA (story 056), e-postresultatet en enskild
     * mottagare — det senare skickar ett resultat till en adress, ofta
     * besökarens egen. Beskedet när ingen katalog finns gäller båda, och det är
     * det som prövas här.
     */
    /*
     * Inlämningens lista bor i `chip-picker` sedan den använder samma kontroll
     * som allt annat man väljer flera av, och katalogens beskedrad står bredvid
     * den — en kontroll som bara känner till `{label, value}` kan inte bära ett
     * besked om att katalogen saknas.
     */
    if (type === "submit-result") {
      return [...(panel.shadowRoot?.querySelectorAll(".properties-panel__status") ?? [])].map(
        (one) => one.textContent?.trim() ?? "",
      );
    }

    const select = panel.shadowRoot?.querySelector<HTMLSelectElement>(
      '[data-property="recipientId"]',
    );

    if (!select) throw new Error("Kunde inte hitta mottagarväljaren.");

    return [...select.options].map((option) => option.textContent?.trim() ?? "");
  }

  const BESKED = "Värdsystemet har inte lämnat någon mottagarlista.";

  test.runIf(PRO)("ingen mottagare registrerad — submit-result säger varför", () => {
    expect(options("submit-result")).toContain(BESKED);
  });

  test.runIf(PRO)("ingen mottagare registrerad — email-result säger varför", () => {
    expect(options("email-result")).toContain(BESKED);
  });

  test.runIf(PRO)("beskedraden går inte att välja", () => {
    /*
     * Den var en spärrad rad i en `<select>`. Nu är den en text bredvid
     * kontrollen — alltså inte ett alternativ alls, vilket är samma påstående
     * fast omöjligt att göra fel: en kontroll som bara känner till
     * `{label, value}` kan inte råka erbjuda ett besked som ett val.
     */
    const panel = document.createElement("properties-panel") as PropertiesPanel;

    panel.editorMode = "administrator";
    document.body.append(panel);
    panel.nodeData = {
      id: "m",
      type: "submit-result",
      position: { x: 0, y: 0 },
      data: { title: "Tack" },
    };

    const picker = panel.shadowRoot?.querySelector('[data-recipient-picker="recipientIds"]');
    const valbara = [...(picker?.shadowRoot?.querySelectorAll("[data-add]") ?? [])].map(
      (one) => one.textContent?.trim(),
    );

    expect(valbara).not.toContain(BESKED);
    expect(
      [...(panel.shadowRoot?.querySelectorAll(".properties-panel__status") ?? [])].map((one) =>
        one.textContent?.trim(),
      ),
    ).toContain(BESKED);
  });

  test.runIf(PRO)("en registrerad katalog med rader — beskedet är borta", () => {
    registerSubmissionReceiver({
      recipients: () => [{ id: "gatukontoret", label: "Gatukontoret" }],
      submit: async () => ({ reference: "X-1" }),
    });

    expect(options("submit-result")).not.toContain(BESKED);
  });

  // Skiljelinjen mot stale-recipient: ett städat id är tyst här, precis som
  // innan — det är hälsokontrollens ärende, inte väljarens.
  test.runIf(PRO)("ett städat id väcker inget besked i väljaren", () => {
    registerSubmissionReceiver({
      recipients: () => [{ id: "gatukontoret", label: "Gatukontoret" }],
      submit: async () => ({ reference: "X-1" }),
    });

    expect(options("submit-result", { recipientId: "nedlagda-kontoret" })).not.toContain(BESKED);
  });
});

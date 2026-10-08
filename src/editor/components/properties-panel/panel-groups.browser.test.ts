// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../../testing/optional-pro";
const PRO = await withPro("index.ts");
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../../node-types/default-node-properties";
import "./properties-panel";

import { getEditorCapabilities } from "../../config/editor-capabilities";
import type { PropertiesPanel } from "./properties-panel";
import type { FlowNodeData } from "../../../viewer/types/graph";

/**
 * Panelens grupper (Astra 1/10 2026, bilaga 11 i
 * docs/UPPDRAG-2026-09-30-GENOMGANG.md; docs/GRAFISK-PROFIL.md
 * *Panelens grupper*).
 *
 * ## Vad som mättes först
 *
 * Panelen var en platt kolumn med 20 px mellan allt (Fia 1/10, punkt 21).
 * Textfrågans *Villkorsstyrd synlighet* stod mellan *Variabeltyp* och
 * *Position*, *Mall* bland de tekniska fakta, *Avancerat* mellan Validering
 * och placeringen. Under rubriken *Validering* blev det 39 px — webbläsarens
 * h3-marginal ovanpå gapet — och 32 före *Pröva ett värde*; efter sidans
 * råd 36.
 *
 * ## Vad som prövas
 *
 * Ordningen som grupper, och vilka fält som hör till vilken — grupp-id:n i
 * DOM:en, inte etiketter. Och avstånden i pixlar ur den renderade panelen:
 * 12 inom en grupp, 24 mellan grupper, 24 från rubrik till innehåll och 24
 * före *Pröva ett värde*. Ett avstånd är en egenskap hos ritningen, så det
 * mäts i ritningen och inte i stilfilen.
 */

afterEach(() => {
  document.body.replaceChildren();
  document.body.style.color = "";
});

function panelFor(node: FlowNodeData): PropertiesPanel {
  const panel = document.createElement("properties-panel") as PropertiesPanel;

  panel.editorMode = "administrator";
  panel.capabilities = getEditorCapabilities("advanced");
  panel.style.cssText = "display: block; width: 380px; height: 3000px;";
  document.body.append(panel);
  panel.nodeData = node;

  return panel;
}

const textOnPage = (): FlowNodeData =>
  ({
    id: "namn",
    type: "text-question",
    parentPageId: "sidan",
    template: "nodmall-email",
    position: { x: 0, y: 0 },
    data: {
      title: { sv: "Ditt namn" },
      description: "",
      placeholder: "",
      presentation: "input",
      required: true,
      minLength: 2,
    },
  }) as unknown as FlowNodeData;

const multiChoice = (): FlowNodeData =>
  ({
    id: "flera",
    type: "multi-choice",
    position: { x: 0, y: 0 },
    data: {
      title: { sv: "Vad gäller det?" },
      description: "",
      presentation: "checkbox",
      options: [{ id: "a", label: { sv: "Ett" }, value: "ett" }],
      required: true,
    },
  }) as unknown as FlowNodeData;

const page = (): FlowNodeData =>
  ({
    id: "sidan",
    type: "page",
    position: { x: 0, y: 0 },
    data: { title: { sv: "Om dig" }, description: "" },
  }) as unknown as FlowNodeData;

const root = (panel: PropertiesPanel): ShadowRoot => panel.shadowRoot!;

/** The groups in the order the panel draws them. */
const groups = (panel: PropertiesPanel): string[] =>
  [...root(panel).querySelectorAll<HTMLElement>(".properties-panel__form > [data-panel-group]")].map(
    (one) => one.dataset.panelGroup ?? "",
  );

/** Which group an element sits in. */
const groupOf = (panel: PropertiesPanel, selector: string): string | null => {
  const element = root(panel).querySelector(selector);

  if (!element) {
    throw new Error(`Hittade inte ${selector} i panelen.`);
  }
  return element.closest<HTMLElement>("[data-panel-group]")?.dataset.panelGroup ?? null;
};

const rect = (element: Element): DOMRect => element.getBoundingClientRect();

/** Vertical distance from the bottom of one element to the top of the next. */
const between = (upper: Element, lower: Element): number =>
  Math.round(rect(lower).top - rect(upper).bottom);

const visibleChildren = (element: Element): Element[] =>
  [...element.children].filter((child) => rect(child).height > 0);

describe("textfrågans grupper, i Astras ordning", () => {
  test("Frågan, Fältet, Validering, Placering, Villkorsstyrd synlighet, Avancerat, Tekniska fakta", () => {
    expect(groups(panelFor(textOnPage()))).toEqual([
      "content",
      "field",
      "validation",
      "placement",
      "visibility",
      "advanced",
      "facts",
    ]);
  });

  test.each([
    ['[data-property="title"]', "content"],
    ['[data-property="description"]', "content"],
    ['[data-property="why"]', "content"],
    ['[data-property="placeholder"]', "field"],
    ['[data-property="presentation"]', "field"],
    ['[data-property="autofill"]', "field"],
    ['[data-property="required"]', "validation"],
    [".properties-panel__tryout", "validation"],
    ["[data-order-move]", "placement"],
    ['[data-layout-property="columnSpan"]', "placement"],
    ["[data-layout-break-before]", "placement"],
    ['[data-visibility-property="enabled"]', "visibility"],
    ['[data-property="variableName"]', "advanced"],
    ["[data-node-template]", "advanced"],
    ["[data-node-module]", "facts"],
  ])("%s står i %s", (selector, group) => {
    expect(groupOf(panelFor(textOnPage()), selector)).toBe(group);
  });
});

describe("flervalsfrågan och sidan behåller sin ordning", () => {
  test("flervalsfrågan: Frågan, Svaren, Validering, Avancerat, Tekniska fakta", () => {
    const panel = panelFor(multiChoice());

    expect(groups(panel)).toEqual(["content", "answers", "validation", "advanced", "facts"]);
    expect(groupOf(panel, ".properties-panel__options")).toBe("answers");
  });

  test("sidan: rådet, Sidinnehåll, Upprepning, Tekniska fakta", () => {
    const panel = panelFor(page());

    expect(groups(panel)).toEqual(["advice", "content", "repeat", "facts"]);
    expect(groupOf(panel, '[data-property="repeats"]')).toBe("repeat");
  });
});

/*
 * Bilaga 12 (Astra 1/10 kväll): regel, uträkning och resultat behåller sin
 * uppdelning, 24 där uppgiften byter karaktär. Mätt före: varje av dem stod
 * som en enda grupp, regelns *Regler* och uträkningens *Uträkningar* 12 px
 * under sin rubrik, tjänsteanropets anrop och svar i samma kolumn.
 */
const node = (id: string, type: string, data: Record<string, unknown>): FlowNodeData =>
  ({ id, type, position: { x: 0, y: 0 }, data }) as unknown as FlowNodeData;

describe("logiken och resultaten behåller sin uppdelning", () => {
  test.each<[string, FlowNodeData, string[]]>([
    ["regeln: rubriken, sedan reglerna med Annars", node("r", "rule", { title: { sv: "Vilket besked?" }, cases: [], fallbackLabel: "Annars" }), ["content", "rules", "facts"]],
    ["uträkningen: rubriken, sedan uträkningarna", node("c", "calculation", { title: { sv: "Räkna" }, assignments: [] }), ["content", "calculations", "facts"]],
    ["tjänsteanropet: rubriken, anropet, svaret", node("s", "service-call", { title: "Hämta", endpoint: "/x", method: "GET", requestVariables: [], mockResponse: "", responseMappings: [] }), ["content", "request", "response", "facts"]],
    // The two sending endings are FlowWeaver PRO's: their rows where PRO is.
    ...(PRO
      ? ([
          ["inlämningen: mottagarna, kvittot, ärendet", node("i", "submit-result", { title: "Tack", recipientIds: [], copyRecipientIds: [] }), ["recipients", "content", "case", "facts"]],
          ["mejlet: texten, mottagaren, brevet", node("e", "email-result", { title: "Skickat", subject: "", body: "" }), ["content", "recipients", "message", "facts"]],
        ] as Array<[string, FlowNodeData, string[]]>)
      : []),
    ["resultatet: en grupp — rubrik och beskrivning är samma uppgift", node("x", "result", { title: "Klart", description: "" }), ["content", "facts"]],
  ])("%s", (_name, made, expected) => {
    expect(groups(panelFor(made))).toEqual(expected);
  });

  test("tjänsteanropet: exempelsvaret hör till svaret, inte till anropet", () => {
    const panel = panelFor(node("s", "service-call", { title: "Hämta", endpoint: "/x", method: "GET", requestVariables: [], mockResponse: "", responseMappings: [] }));

    expect(groupOf(panel, '[data-property="endpoint"]')).toBe("request");
    expect(groupOf(panel, '[data-property="mockResponse"]')).toBe("response");
  });

  test("regeln: 24 från rubriken till Regler, inte 12", () => {
    const panel = panelFor(node("r", "rule", { title: { sv: "Vilket besked?" }, cases: [], fallbackLabel: "Annars" }));

    expect(
      between(
        root(panel).querySelector('[data-panel-group="content"]')!,
        root(panel).querySelector('[data-panel-group="rules"]')!,
      ),
    ).toBe(24);
  });
});

describe("avstånden — 12 inom, 24 mellan", () => {
  test("12 mellan fälten inom varje grupp", () => {
    const panel = panelFor(textOnPage());

    for (const name of ["content", "field", "placement", "facts"]) {
      const group = root(panel).querySelector(`[data-panel-group="${name}"]`)!;
      const fields = visibleChildren(group);

      expect(fields.length, name).toBeGreaterThan(1);
      for (let i = 1; i < fields.length; i++) {
        expect(between(fields[i - 1], fields[i]), `${name}, fält ${i}`).toBe(12);
      }
    }
  });

  test("24 mellan grupperna", () => {
    const panel = panelFor(textOnPage());
    const drawn = visibleChildren(root(panel).querySelector(".properties-panel__form")!);

    expect(drawn.length).toBe(7);
    for (let i = 1; i < drawn.length; i++) {
      expect(between(drawn[i - 1], drawn[i]), (drawn[i] as HTMLElement).dataset.panelGroup).toBe(24);
    }
  });

  test("Validering: 24 från rubriken, 12 mellan reglerna, 24 före Pröva ett värde", () => {
    const panel = panelFor(textOnPage());
    const section = root(panel).querySelector('[data-panel-group="validation"]')!;
    const rows = visibleChildren(section);
    const heading = rows[0];
    const tryout = rows.at(-1)!;

    expect(heading.tagName).toBe("H3");
    expect(tryout.classList.contains("properties-panel__tryout")).toBe(true);
    expect(between(heading, rows[1]), "rubrik → första regeln").toBe(24);
    for (let i = 2; i < rows.length - 1; i++) {
      expect(between(rows[i - 1], rows[i]), `regel ${i}`).toBe(12);
    }
    expect(between(rows.at(-2)!, tryout), "före Pröva ett värde").toBe(24);
  });

  /*
   * The summary carries 12 px of padding of its own (its click target), so
   * 12 from the summary's box is 24 from the heading — measured on the box,
   * because the inline h3's line box moves a pixel with the font.
   */
  test("Avancerat öppen: 12 från summary-lådan (24 från rubriken), 12 sedan", () => {
    const panel = panelFor(textOnPage());
    const fold = root(panel).querySelector<HTMLDetailsElement>('[data-panel-group="advanced"]')!;

    fold.open = true;
    const fields = visibleChildren(fold.querySelector(".properties-panel__advanced-fields")!);

    const summary = fold.querySelector("summary")!;

    expect(getComputedStyle(summary).paddingBottom).toBe("12px");
    expect(between(summary, fields[0])).toBe(12);
    for (let i = 1; i < fields.length; i++) {
      expect(between(fields[i - 1], fields[i]), `fält ${i}`).toBe(12);
    }
    expect(between(fold, fold.nextElementSibling!), "folden → Tekniska fakta").toBe(24);
  });

  test("Mall står bland Avancerats fält, med deras avstånd", () => {
    const panel = panelFor(textOnPage());

    expect(
      root(panel).querySelector(".properties-panel__advanced-fields > [data-node-template]"),
    ).not.toBeNull();
  });

  test("sidans råd står 24 över rubriken — p-marginalen staplas inte", () => {
    const panel = panelFor(page());

    expect(
      between(
        root(panel).querySelector("[data-page-advice]")!,
        root(panel).querySelector('[data-panel-group="content"]')!,
      ),
    ).toBe(24);
  });
});

/*
 * Bilaga 12, punkt 7: *Validering* och *Avancerat* är samma rubriknivå,
 * 15 / 700, och Avancerat har den ritade chevronen i texttoken. Mätt före:
 * båda 18,72 px (webbläsarens h3), och Avancerats pil var webbläsarens
 * markör i den färg som läckte in genom skuggroten — ljusa temats mörka
 * text på mörka temats panel, 1,03:1.
 */
describe("Avancerat och Validering — en rubriknivå, en chevron", () => {
  test("båda rubrikerna 15 px / 700", () => {
    const panel = panelFor(textOnPage());
    const font = (selector: string) => {
      const style = getComputedStyle(root(panel).querySelector(selector)!);
      return `${style.fontSize}/${style.fontWeight}`;
    };

    expect(font('[data-panel-group="validation"] > h3')).toBe("15px/700");
    expect(font('[data-panel-group="advanced"] > summary h3')).toBe("15px/700");
  });

  test("chevronen är ritad, i --fw-text, också när sidans egen textfärg är en annan", () => {
    // The ambient colour a host page sets — what leaked into the marker.
    document.body.style.color = "rgb(255, 0, 0)";
    const panel = panelFor(textOnPage());
    const summary = root(panel).querySelector('[data-panel-group="advanced"] > summary')!;
    const probe = document.createElement("span");

    probe.style.color = "var(--fw-text)";
    summary.append(probe);
    const text = getComputedStyle(probe).color;
    probe.remove();

    const chevron = getComputedStyle(summary, "::after");

    expect(getComputedStyle(summary).display, "ingen webbläsarmarkör").toBe("flex");
    expect(chevron.content).toBe('""');
    expect(chevron.borderRightColor).toBe(text);
    expect(chevron.borderRightColor).not.toBe("rgb(255, 0, 0)");
  });

  test("chevronen vänder när folden öppnas, och folden minns", async () => {
    const panel = panelFor(textOnPage());
    const fold = () => root(panel).querySelector<HTMLDetailsElement>('[data-panel-group="advanced"]')!;
    const turn = () => getComputedStyle(fold().querySelector("summary")!, "::after").transform;
    const closed = turn();

    fold().querySelector("summary")!.click();
    expect(fold().open).toBe(true);
    // The turn is a 140 ms transition; read it where it ends.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(turn()).not.toBe(closed);

    panel.nodeData = textOnPage();
    expect(fold().open, "kvar öppen vid omritning").toBe(true);
  });
});

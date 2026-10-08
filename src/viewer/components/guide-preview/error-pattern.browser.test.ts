import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * One error pattern in the viewer (Astra 1/10, bilaga 10 punkt 6; the
 * review of 30/9, V4, found the message in four places).
 *
 * - The message stands directly under the control; for a group of radios or
 *   boxes, under the whole group. Everything inside the card.
 * - The search field takes the same red edge as any other field.
 * - The group is marked once — no unanswered option gets a red frame of its
 *   own.
 * - The summary at the top has a thinner frame and a real heading.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 120));

async function mount(graph: unknown): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = "display:block;width:640px;";
  document.body.append(preview);
  preview.graph = graph as GraphData;
  await settle();
  return preview;
}

const next = async (preview: GuidePreview) => {
  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle();
};

const end = { id: "end", type: "result", position: { x: 600, y: 0 }, data: { title: { sv: "Klart" } } };

const multiStep = {
  startNodeId: "q",
  nodes: [
    {
      id: "q", type: "multi-choice", position: { x: 0, y: 0 },
      data: {
        title: { sv: "Vad har hänt?" }, variableName: "vad", required: true,
        options: [
          { id: "a", label: { sv: "Vattenskada" }, value: "vatten" },
          { id: "b", label: { sv: "Brand" }, value: "brand" },
        ],
      },
    },
    end,
  ],
  connections: [{ id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "end", portId: "input" } }],
};

const page = {
  startNodeId: "p",
  nodes: [
    { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Din vistelse" } } },
    {
      id: "nights", type: "question", parentPageId: "p", order: 0, position: { x: 0, y: 0 },
      data: {
        title: { sv: "Sover du över?" }, variableName: "over", required: true,
        options: [
          { id: "ja", label: { sv: "Ja" }, value: "ja" },
          { id: "nej", label: { sv: "Nej" }, value: "nej" },
        ],
      },
    },
    {
      id: "policy", type: "autocomplete-question", parentPageId: "p", order: 1, position: { x: 0, y: 0 },
      data: {
        title: { sv: "Försäkring" }, variableName: "forsakring", source: "mock", minChars: 1,
        allowFreeText: false, required: true,
        mockItems: [{ value: "NF-1", label: { sv: "NF-1 Hem" } }],
      },
    },
    end,
  ],
  connections: [{ id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "end", portId: "input" } }],
};

describe("felmönstret", () => {
  test("ett eget steg: felet under hela gruppen, i kortet, gruppen markerad en gång", async () => {
    const preview = await mount(multiStep);
    await next(preview);
    const root = preview.shadowRoot!;
    const group = root.querySelector<HTMLFieldSetElement>("fieldset.guide-preview__options")!;
    const message = root.querySelector<HTMLElement>("[role='alert']")!;

    expect(message.textContent?.trim()).toBe("Välj minst ett alternativ.");
    expect(root.querySelector("article")!.contains(message), "inne i kortet").toBe(true);
    expect(group.nextElementSibling, "direkt under gruppen").toBe(message);
    expect(group.getAttribute("aria-describedby")).toContain(message.id);
    expect(message.getBoundingClientRect().top - group.getBoundingClientRect().bottom).toBeLessThanOrEqual(8);
    // The group's edge, not each option's.
    expect(getComputedStyle(group).borderInlineStartWidth).toBe("3px");
    for (const option of group.querySelectorAll("label")) {
      expect(getComputedStyle(option).borderTopColor).not.toBe(getComputedStyle(group).borderInlineStartColor);
    }
  });

  test("ett eget steg: meddelandet står i gruppens stapel, vid alternativens kant — som på en sida", async () => {
    // Fia 1/10 (B4 review): the page's message sat inside the bar at the
    // options' edge, the step's own outside it at the heading's edge.
    const preview = await mount(multiStep);
    await next(preview);
    const root = preview.shadowRoot!;
    const group = root.querySelector<HTMLFieldSetElement>("fieldset.guide-preview__options")!;
    const message = root.querySelector<HTMLElement>(".guide-preview__step-error")!;
    const option = group.querySelector("label")!;
    const style = getComputedStyle(message);
    const textStart = message.getBoundingClientRect().left + parseFloat(style.borderInlineStartWidth) + parseFloat(style.paddingInlineStart);

    expect(style.borderInlineStartWidth, "stapeln fortsätter").toBe(getComputedStyle(group).borderInlineStartWidth);
    expect(style.borderInlineStartColor).toBe(getComputedStyle(group).borderInlineStartColor);
    expect(message.getBoundingClientRect().top - group.getBoundingClientRect().bottom, "utan lucka i stapeln").toBe(0);
    expect(Math.abs(textStart - option.getBoundingClientRect().left), "vid alternativens kant").toBeLessThan(1);
  });

  test("ett nytt steg tar inte felet med sig", async () => {
    const preview = await mount(multiStep);
    await next(preview);
    preview.shadowRoot!.querySelector<HTMLInputElement>("input[type='checkbox']")!.click();
    await next(preview);

    expect(preview.shadowRoot!.querySelector("h2")!.textContent).toContain("Klart");
    expect(preview.shadowRoot!.querySelector(".guide-preview__step-error")).toBeNull();
  });

  test("en sida: radiogruppens fel står under alternativen, och ingen radio får röd kant", async () => {
    const preview = await mount(page);
    await next(preview);
    const root = preview.shadowRoot!;
    const cell = root.querySelector<HTMLElement>('[data-page-field-id="nights"]')!;
    const choices = cell.querySelector<HTMLElement>(".guide-preview__page-choices")!;
    const message = cell.querySelector<HTMLElement>(".guide-preview__field-error")!;

    expect(choices.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING, "efter alternativen").toBeTruthy();
    expect(message.getBoundingClientRect().top).toBeGreaterThanOrEqual(choices.getBoundingClientRect().bottom);
    const danger = getComputedStyle(cell).borderInlineStartColor;
    expect(getComputedStyle(cell).borderInlineStartWidth).toBe("3px");
    for (const radio of cell.querySelectorAll<HTMLInputElement>("input[type='radio']")) {
      expect(getComputedStyle(radio).borderTopColor).not.toBe(danger);
      expect(getComputedStyle(radio).boxShadow).toBe("none");
    }
  });

  test("samtyckets fel står under rutan, inte en tom rad längre ned", async () => {
    const preview = await mount({
      startNodeId: "p",
      nodes: [
        page.nodes[0],
        { id: "ok", type: "consent-question", parentPageId: "p", order: 0, position: { x: 0, y: 0 }, data: { title: { sv: "Jag intygar att uppgifterna stämmer" }, variableName: "intyg", required: true } },
        end,
      ],
      connections: page.connections,
    });
    await next(preview);
    const root = preview.shadowRoot!;
    const box = root.querySelector<HTMLInputElement>("input[data-consent]")!;
    const row = box.closest("label")!;
    const message = root.querySelector<HTMLElement>('[data-page-field-id="ok"] .guide-preview__field-error')!;

    // Measured 31 before (the row's 44 px stood empty under a one-line text).
    expect(message.getBoundingClientRect().top - box.getBoundingClientRect().bottom).toBeLessThanOrEqual(20);
    expect(row.getBoundingClientRect().height, "K6").toBeGreaterThanOrEqual(44);
    expect(getComputedStyle(box).borderTopColor, "rutans egen kant i --fw-danger").toBe("rgb(217, 45, 32)");
  });

  test("sökfältet får samma röda kant som andra fält", async () => {
    const preview = await mount(page);
    await next(preview);
    const root = preview.shadowRoot!;
    const picker = root.querySelector<HTMLElement>("chip-picker")!;
    const box = picker.shadowRoot!.querySelector<HTMLElement>(".chip-picker__box")!;
    const danger = getComputedStyle(root.querySelector('[data-page-field-id="nights"]')!).borderInlineStartColor;

    expect(picker.closest("[data-invalid]")).not.toBeNull();
    expect(getComputedStyle(box).borderTopColor).toBe(danger);
  });

  test("sammanfattningen överst: tunnare ram och en riktig rubrik", async () => {
    const preview = await mount(page);
    await next(preview);
    const summary = preview.shadowRoot!.querySelector<HTMLElement>("[data-error-summary]")!;
    const heading = summary.querySelector<HTMLElement>("h3")!;

    expect(getComputedStyle(summary).borderTopWidth).toBe("2px");
    expect(heading.textContent).toMatch(/2/);
    expect(getComputedStyle(heading).fontSize).toBe("18px");
    expect(summary.querySelectorAll("[data-error-link]")).toHaveLength(2);
  });

  test("ett obligatoriskt sökfält som eget steg säger till när det lämnas tomt", async () => {
    const { parentPageId: _page, order: _order, ...policy } = page.nodes[2] as Record<string, unknown>;
    const preview = await mount({
      startNodeId: "policy",
      nodes: [policy, end],
      connections: [{ id: "c", from: { nodeId: "policy", portId: "continue" }, to: { nodeId: "end", portId: "input" } }],
    });
    await next(preview);
    const root = preview.shadowRoot!;
    const shown = [...root.querySelectorAll<HTMLElement>(".guide-preview__field-error")].filter((e) => !e.hidden);

    expect(root.querySelector("h2")!.textContent).toContain("Försäkring");
    expect(shown.map((e) => e.textContent?.trim())).toEqual(["Fältet är obligatoriskt."]);
    expect(root.querySelector("chip-picker")!.hasAttribute("data-invalid")).toBe(true);
  });

  /*
   * The bar's indent is an explicit exception (Astra 1/10, bilaga 11, point
   * 1; GRAFISK-PROFIL, *Gruppens gemensamma felmarkering*): while the error
   * stands the WHOLE group — its label, its options and its message — moves
   * 15 px in together, the bar's 3 px and the 12 px after it. Without an
   * error, and once an option is chosen, the group stands at every other
   * field's left edge. Measured 1/10 before writing this: 25 → 40 at 640 px
   * on a page and on a step of its own, and back to 25 on a page once
   * chosen.
   */
  const textLeft = (element: Element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().left;
  };

  test("felets indrag: etikett, alternativ och feltext flyttas 15 px tillsammans, och tillbaka när ett alternativ väljs", async () => {
    const preview = await mount({
      startNodeId: "p",
      nodes: [
        page.nodes[0],
        { id: "name", type: "text-question", parentPageId: "p", order: 0, position: { x: 0, y: 0 }, data: { title: { sv: "Ditt namn" }, variableName: "namn" } },
        { ...page.nodes[1], order: 1 },
        end,
      ],
      connections: page.connections,
    });
    const root = preview.shadowRoot!;
    const cell = () => root.querySelector<HTMLElement>('[data-page-field-id="nights"]')!;
    const edges = () => ({
      label: textLeft(cell().querySelector("legend")!),
      option: cell().querySelector("label")!.getBoundingClientRect().left,
      message: cell().querySelector(".guide-preview__field-error"),
    });
    const fieldEdge = textLeft(root.querySelector('[data-page-field-id="name"] label')!);

    const calm = edges();
    expect(calm.label, "utan fel: etiketten vid andra fälts kant").toBeCloseTo(fieldEdge, 0);
    expect(calm.option, "utan fel: alternativen vid andra fälts kant").toBeCloseTo(fieldEdge, 0);

    await next(preview);
    const marked = edges();
    expect(marked.message).not.toBeNull();
    expect(marked.label - fieldEdge, "etiketten flyttas med").toBeCloseTo(15, 0);
    expect(marked.option - fieldEdge, "alternativen flyttas med").toBeCloseTo(15, 0);
    expect(textLeft(marked.message!) - fieldEdge, "feltexten flyttas med").toBeCloseTo(15, 0);

    cell().querySelector<HTMLInputElement>("input[type='radio']")!.click();
    await settle();
    const chosen = edges();
    expect(chosen.message, "felet står inte kvar").toBeNull();
    expect(chosen.label, "valt: etiketten tillbaka").toBeCloseTo(fieldEdge, 0);
    expect(chosen.option, "valt: alternativen tillbaka").toBeCloseTo(fieldEdge, 0);
  });

  test("felets indrag på ett eget steg: frågans etikett, alternativen och feltexten 15 px in, rubriken kvar", async () => {
    const preview = await mount(multiStep);
    const root = preview.shadowRoot!;
    const heading = textLeft(root.querySelector("article h2")!);
    const group = () => root.querySelector<HTMLFieldSetElement>("fieldset.guide-preview__options")!;

    expect(textLeft(group().querySelector("legend")!), "utan fel: vid rubrikens kant").toBeCloseTo(heading, 0);
    expect(group().querySelector("label")!.getBoundingClientRect().left).toBeCloseTo(heading, 0);

    await next(preview);
    const message = root.querySelector<HTMLElement>(".guide-preview__step-error")!;
    expect(textLeft(root.querySelector("article h2")!), "rubriken är stegets, inte gruppens").toBeCloseTo(heading, 0);
    expect(textLeft(group().querySelector("legend")!) - heading, "etiketten").toBeCloseTo(15, 0);
    expect(group().querySelector("label")!.getBoundingClientRect().left - heading, "alternativen").toBeCloseTo(15, 0);
    expect(textLeft(message) - heading, "feltexten").toBeCloseTo(15, 0);
  });
});

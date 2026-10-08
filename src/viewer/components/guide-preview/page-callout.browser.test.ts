import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/*
 * Story 096: a Text in a page shown as a box — *Inforuta*, *Viktigt*, *Tips*.
 *
 * The kind must be readable without colour (K3): a frame is not enough, so
 * the box carries an icon on the first line of text, and the word first in
 * the box for whoever reads rather than sees — read, not shown. Nothing
 * announces it (no role="alert", no aria-live) — it is text to read in its
 * order, not something that just happened.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function graph(text: Record<string, unknown>): GraphData {
  return {
    startNodeId: "sida",
    settings: { sourceLocale: "sv", locales: ["sv", "en"] },
    nodes: [
      { id: "sida", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Lånet" } } },
      {
        id: "belopp", type: "number-question", parentPageId: "sida", order: 1, position: { x: 0, y: 0 },
        data: { title: { sv: "Belopp" }, variableName: "belopp" },
      },
      {
        id: "text", type: "page-heading", parentPageId: "sida", order: 2, position: { x: 0, y: 0 },
        data: { title: { sv: "Att låna kostar pengar" }, description: { sv: "Du betalar {{belopp}} kr." }, ...text },
      },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [{ id: "c", from: { nodeId: "sida", portId: "continue" }, to: { nodeId: "r", portId: "input" } }],
  } as never;
}

async function mount(text: Record<string, unknown>, locale?: string, compact = false): Promise<ShadowRoot> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  if (compact) preview.setAttribute("compact", "");
  document.body.append(preview);
  preview.graph = graph(text);
  if (locale) preview.activeLocale = locale;
  await settle();
  return preview.shadowRoot!;
}

const box = (root: ShadowRoot) => root.querySelector<HTMLElement>('[data-page-heading-id="text"]')!;

describe("en text som visas som ruta (story 096)", () => {
  test("Viktigt: ram, ikon och ordet, före rubriken", async () => {
    const root = await mount({ presentation: "warning" });
    const section = box(root);

    expect(section.classList.contains("guide-preview__callout")).toBe(true);
    expect(section.dataset.calloutKind).toBe("warning");
    const kind = section.querySelector(".guide-preview__callout-kind")!;
    expect(kind.textContent?.trim()).toBe("Viktigt");
    expect(kind.querySelector("svg")).toBeTruthy();
    // The word comes first, then the heading and the text — reading order is the order.
    expect(section.firstElementChild).toBe(kind);
    expect(section.querySelector("h3")?.textContent).toBe("Att låna kostar pengar");
    // Nothing announces it.
    expect(section.querySelector("[role], [aria-live]")).toBeNull();
  });

  test("ordet läses men syns inte; ikonen ligger på textens första rad", async () => {
    const withHeading = box(await mount({ presentation: "warning" }));
    const word = withHeading.querySelector<HTMLElement>(".guide-preview__callout-word")!;
    // Hidden by clipping, not display: none — a screen reader still reads it.
    expect(word.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    expect(getComputedStyle(word).display).not.toBe("none");

    const centre = (element: Element | null) => {
      const rect = element!.getBoundingClientRect();
      return rect.top + rect.height / 2;
    };
    const icon = (section: HTMLElement) => section.querySelector(".guide-preview__callout-icon svg");
    // With a heading: the icon is centred on the heading's line.
    expect(Math.abs(centre(icon(withHeading)) - centre(withHeading.querySelector("h3")))).toBeLessThan(2);

    // Without one: on the body's first line, which is one line-height tall.
    const bodyOnly = box(await mount({ presentation: "info", title: { sv: "" } }));
    const paragraph = bodyOnly.querySelector<HTMLElement>(".guide-preview__formatted p")!;
    const firstLine = paragraph.getBoundingClientRect().top + parseFloat(getComputedStyle(paragraph).lineHeight) / 2;
    expect(Math.abs(centre(icon(bodyOnly)) - firstLine)).toBeLessThan(2);
  });

  test("Inforuta och Tips har sina ord", async () => {
    expect(box(await mount({ presentation: "info" })).querySelector(".guide-preview__callout-kind")?.textContent?.trim()).toBe("Info");
    expect(box(await mount({ presentation: "tip" })).querySelector(".guide-preview__callout-kind")?.textContent?.trim()).toBe("Tips");
  });

  test("på engelska heter Viktigt Important", async () => {
    expect(box(await mount({ presentation: "warning" }, "en")).querySelector(".guide-preview__callout-kind")?.textContent?.trim()).toBe("Important");
  });

  test("en vanlig text är ingen ruta — som förut", async () => {
    const section = box(await mount({}));

    expect(section.classList.contains("guide-preview__callout")).toBe(false);
    expect(section.querySelector(".guide-preview__callout-kind")).toBeNull();
    expect(section.querySelector("h3")?.textContent).toBe("Att låna kostar pengar");
  });

  test("canvaskortet visar ikon och ord för sorten, en vanlig text bara rubriken", async () => {
    const card = (await mount({ presentation: "tip" }, undefined, true))
      .querySelector<HTMLElement>('.guide-preview__page-field-summary[data-page-field-id="text"]')!;
    expect(card.dataset.calloutKind).toBe("tip");
    expect(card.querySelector(".guide-preview__callout-kind")?.textContent?.trim()).toBe("Tips");
    expect(card.querySelector(".guide-preview__callout-icon svg")).toBeTruthy();
    expect(card.textContent).toContain("Att låna kostar pengar");

    const plain = (await mount({}, undefined, true))
      .querySelector<HTMLElement>('.guide-preview__page-field-summary[data-page-field-id="text"]')!;
    expect(plain.dataset.calloutKind).toBeUndefined();
    expect(plain.querySelector(".guide-preview__callout-kind")).toBeNull();
  });

  test("ordet står kvar när texten ritas om medan besökaren svarar", async () => {
    const root = await mount({ presentation: "warning" });
    const input = root.querySelector<HTMLInputElement>('[data-page-field-id="belopp"] input')!;
    input.value = "5000";
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    await settle();

    const section = box(root);
    // The number is grouped for reading (5 000, with a no-break space) — that is 095's live redraw.
    expect(section.textContent).toContain("5 000");
    expect(section.querySelector(".guide-preview__callout-kind")?.textContent?.trim()).toBe("Viktigt");
  });
});

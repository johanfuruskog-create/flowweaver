import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * One answer row, standalone and on a page (Astra 1/10, bilaga 10 punkt 9:
 * *"16 px, vikt 400, --fw-text, samma vänsterkant och minst 44 px
 * träffhöjd"*). Measured 30/9 (genomgången, V8): the page's row was 14 px in
 * the secondary ink, and the standalone row stood 2 px in from the heading
 * — the fieldset's own inline margin.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 120));

const options = [
  { id: "ja", label: { sv: "Ja" }, value: "ja" },
  { id: "nej", label: { sv: "Nej" }, value: "nej" },
];

const graph = {
  startNodeId: "q",
  nodes: [
    { id: "q", type: "question", position: { x: 0, y: 0 }, data: { title: { sv: "Sover du över?" }, variableName: "over", options } },
    { id: "p", type: "page", position: { x: 400, y: 0 }, data: { title: { sv: "Frukost" } } },
    { id: "f", type: "question", parentPageId: "p", order: 0, position: { x: 0, y: 0 }, data: { title: { sv: "Vill du ha frukost?" }, variableName: "frukost", options } },
    { id: "end", type: "result", position: { x: 800, y: 0 }, data: { title: { sv: "Klart" } } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "q", portId: "ja" }, to: { nodeId: "p", portId: "input" } },
    { id: "c2", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "end", portId: "input" } },
  ],
};

async function mount(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = "display:block;width:640px;";
  document.body.append(preview);
  preview.graph = graph as unknown as GraphData;
  await settle();
  return preview;
}

const shape = (root: ShadowRoot, selector: string) => {
  const row = root.querySelector<HTMLElement>(selector)!;
  const text = getComputedStyle(row.querySelector("span")!);
  return {
    font: `${text.fontSize}/${text.fontWeight}`,
    color: text.color,
    inset: Math.round(row.getBoundingClientRect().left - root.querySelector("h2")!.getBoundingClientRect().left),
    tall: row.getBoundingClientRect().height >= 44,
  };
};

describe("svarsraden", () => {
  test("samma form fristående och på en sida", async () => {
    const preview = await mount();
    const root = preview.shadowRoot!;
    const standalone = shape(root, ".guide-preview__options > label");

    root.querySelector<HTMLInputElement>('[data-option-id="ja"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    const onPage = shape(root, ".guide-preview__page-choices > label");

    expect(standalone).toEqual({ font: "16px/400", color: "rgb(16, 24, 40)", inset: 0, tall: true });
    expect(onPage).toEqual(standalone);
  });

  test("frågans text står i radernas vänsterkant, fristående och på en sida", async () => {
    // Fia 1/10 (B4 review): a legend's own 2 px inline padding set the
    // question at 137 over rows at 135.
    const textStart = (element: Element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().left;
    };
    const preview = await mount();
    const root = preview.shadowRoot!;
    const step = root.querySelector(".guide-preview__options")!;
    expect(textStart(step.querySelector("legend")!) - step.querySelector("label")!.getBoundingClientRect().left).toBe(0);

    root.querySelector<HTMLInputElement>('[data-option-id="ja"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    const cell = root.querySelector('[data-page-field-id="f"]')!;
    expect(textStart(cell.querySelector("legend")!) - cell.querySelector(".guide-preview__page-choices > label")!.getBoundingClientRect().left).toBe(0);
  });

  /*
   * Punkt 12: quiet at rest, the accent frame and the tinted surface when
   * chosen — on a page too, where the chosen row looked exactly like the
   * others (measured 1/10: *Två dagar* chosen, #d0d5dd, no surface).
   */
  test("vald rad får accentram och tonad yta, fristående och på en sida", async () => {
    const preview = await mount();
    const root = preview.shadowRoot!;
    const frame = (label: Element) => {
      const style = getComputedStyle(label);
      return `${style.borderTopColor} ${style.backgroundColor}`;
    };
    const rest = frame(root.querySelector(".guide-preview__options > label")!);

    root.querySelector<HTMLInputElement>('[data-option-id="ja"]')!.click();
    await settle();
    const chosen = frame(root.querySelector(".guide-preview__options > label[data-chosen]")!);
    expect(chosen).not.toBe(rest);

    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    const rows = () => [...root.querySelectorAll(".guide-preview__page-choices > label")];
    expect(rows().map(frame)).toEqual([rest, rest]);

    rows()[1].querySelector("input")!.click();
    await settle();
    expect(rows().map(frame), "vald på sidan").toEqual([rest, chosen]);

    // Drawn again from the answer — back and forth — the frame is still there.
    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    root.querySelector<HTMLButtonElement>('[data-action="previous"]')!.click();
    await settle();
    expect(rows().map(frame), "ritad ur svaret").toEqual([rest, chosen]);
  });

  /*
   * Punkt 15: the rating's ways out are answer rows too — same form, same
   * weight, after the scale with 16 px between, in the scale's radio group.
   * They were bare 14 px text without an edge (genomgången 30/9, V13).
   */
  test("betygsskalans utvägar är svarsrader, 16 px efter skalan, i samma grupp", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    preview.style.cssText = "display:block;width:640px;";
    document.body.append(preview);
    preview.graph = {
      startNodeId: "r",
      nodes: [
        {
          id: "r", type: "rating-question", position: { x: 0, y: 0 },
          data: {
            title: { sv: "Hur trivs du?" }, variableName: "trivsel",
            steps: 4, notApplicable: true, dontKnow: true,
          },
        },
        { id: "q", type: "question", position: { x: 400, y: 0 }, data: { title: { sv: "Sover du över?" }, variableName: "over", options } },
      ],
      connections: [],
    } as unknown as GraphData;
    await settle();
    const root = preview.shadowRoot!;
    const ways = [...root.querySelectorAll<HTMLElement>(".guide-preview__rating-na")];
    const scale = root.querySelector<HTMLElement>(".guide-preview__rating-row")!;

    expect(ways.length, "fixturen bär två utvägar").toBe(2);
    expect(shape(root, ".guide-preview__rating-na")).toEqual({ font: "16px/400", color: "rgb(16, 24, 40)", inset: 0, tall: true });
    expect(getComputedStyle(ways[0]).borderTopWidth, "en kant som svarsraden").toBe("1px");
    expect(Math.round(ways[0].getBoundingClientRect().top - scale.getBoundingClientRect().bottom)).toBe(16);
    const names = new Set([...root.querySelectorAll<HTMLInputElement>(".guide-preview__rating input[type=radio]")].map((one) => one.name));
    expect(names.size, "samma valgrupp").toBe(1);

    ways[1].querySelector("input")!.click();
    await settle();
    expect(ways[1].hasAttribute("data-chosen")).toBe(true);
    expect(getComputedStyle(ways[1]).borderTopColor).not.toBe(getComputedStyle(ways[0]).borderTopColor);
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The rating drawn (story 115) — the row, the group, and the way out.
 *
 * ## Why this is a browser test and not a markup assertion
 *
 * The whole field exists because a scale drawn as a column is a wall: three
 * trivsel questions on one page, four options each, and the visitor scrolls
 * through twelve rows to answer three questions. *A row* is therefore a
 * measured claim about where the boxes ARE, not a claim about a class name —
 * a rule that stops applying leaves the class exactly where it was.
 *
 * The mutation that must fail it: `flex-direction: column` on
 * `.guide-preview__rating-row`. Checked before this was written.
 *
 * **Since 1/10 the row has a width under it** (Astra, bilaga 10 punkt 16;
 * Johan's yes the same day, story 115 criteria 2 and 8 rewritten): on a host
 * of 480 px or less the scale stands as a list, in order and with every
 * label whole. A desk-wide host keeps the row, and the row tests run there.
 *
 * ## What each assertion is for
 *
 * - the row: story 115 AC 2, and K6 for the 44 px per step
 * - the group: AC 3 — real radios in a fieldset, the number read with the word
 * - the ways out: AC 4 — two rows, visible under the bar, never behind a
 *   button, and in the same radio group as the steps
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 60));

const guide = (data: Record<string, unknown> = {}): GraphData =>
  ({
    startNodeId: "b",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "b",
        type: "rating-question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Hur trivs du i din lägenhet?" },
          description: { sv: "Tänk på det senaste året." },
          variableName: "trivsel",
          steps: 4,
          labels: [{ sv: "Mycket bra" }, { sv: "Ganska bra" }, { sv: "Inte så bra" }, { sv: "Dåligt" }],
          ...data,
        },
      },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "b", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  }) as unknown as GraphData;

async function mount(width: number, data: Record<string, unknown> = {}): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  preview.style.display = "block";
  preview.style.width = `${width}px`;
  document.body.style.margin = "0";
  document.body.append(preview);
  preview.graph = guide(data);
  await settle();
  await settle();

  return preview;
}

const marks = (preview: GuidePreview): HTMLElement[] => [
  ...(preview.shadowRoot?.querySelectorAll<HTMLElement>(".guide-preview__rating-mark") ?? []),
];

describe("the rating's row", () => {
  test("puts every step on one line on a host wider than 480 px", async () => {
    const preview = await mount(520);
    const tops = new Set(marks(preview).map((mark) => Math.round(mark.getBoundingClientRect().top)));

    expect(marks(preview)).toHaveLength(4);
    // One line, measured — a column would give four different tops.
    expect(tops.size).toBe(1);
  });

  test.each([480, 390, 320])("stands as a list on a %i px host, in order and with whole labels", async (width) => {
    const preview = await mount(width);
    const boxes = marks(preview).map((mark) => mark.getBoundingClientRect());
    const words = marks(preview).map((mark) => mark.querySelector<HTMLElement>(".guide-preview__rating-word")!);

    // Four steps, four lines, top to bottom in the scale's own order.
    expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(4);
    expect(boxes.every((box, index) => index === 0 || box.top > boxes[index - 1]!.top)).toBe(true);
    expect(words.map((word) => word.textContent?.trim())).toEqual(["Mycket bra", "Ganska bra", "Inte så bra", "Dåligt"]);
    // Whole: each label on one line of its own, nothing cut.
    for (const word of words) {
      expect(word.scrollWidth, word.textContent!).toBeLessThanOrEqual(word.clientWidth + 1);
      expect(word.getBoundingClientRect().height, word.textContent!).toBeLessThan(parseFloat(getComputedStyle(word).lineHeight) * 1.5);
    }
  });

  test("keeps a numbers scale's end words, on its first and last line", async () => {
    // Words only on the ends (*Långt ifrån … Precis*): above a bar, they hung
    // over its ends; a list has no ends, so each stands on its own line.
    const preview = await mount(390, { steps: 5, labels: [{ sv: "Långt ifrån" }, "", "", "", { sv: "Precis" }] });
    const shown = marks(preview).map((mark) =>
      [...mark.querySelectorAll<HTMLElement>(".guide-preview__rating-word")]
        .filter((word) => word.getBoundingClientRect().width > 1)
        .map((word) => word.textContent?.trim())
        .join(""),
    );

    expect(shown).toEqual(["Långt ifrån", "", "", "", "Precis"]);
  });

  test("measures the host, not the window", async () => {
    // A narrow column in a wide window is the ordinary embedding.
    const preview = await mount(390);

    expect(window.innerWidth).toBeGreaterThan(480);
    expect(preview.dataset.under ?? "").toContain("480");
  });

  test("gives every step the thumb's size (K6)", async () => {
    const preview = await mount(390);

    for (const mark of marks(preview)) {
      const box = mark.getBoundingClientRect();

      expect(Math.round(box.width), mark.textContent?.trim()).toBeGreaterThanOrEqual(44);
      expect(Math.round(box.height), mark.textContent?.trim()).toBeGreaterThanOrEqual(44);
    }
  });
});

/**
 * The other direction (Johan 13/9): the editor may stand the scale on its end.
 *
 * A row is the default and the reason the field exists — twenty questions
 * answered without scrolling through each one. But four long words on a narrow
 * host make four cramped segments, and a survey with one long question per page
 * has room to spare. So it is the editor's choice, and the row keeps the
 * default because that is what the field is for.
 *
 * Written before the column existed and seen to fail on the first assertion:
 * without the layout the steps stayed on one line.
 */
describe("the rating on its end", () => {
  test("stacks the steps, each on its own line", async () => {
    const preview = await mount(390, { layout: "column" });
    const boxes = marks(preview).map((mark) => mark.getBoundingClientRect());
    const tops = new Set(boxes.map((box) => Math.round(box.top)));

    // Four steps, four lines — the opposite claim to the row's, and the two
    // must both hold, each for its own layout.
    expect(tops.size).toBe(4);
    expect(boxes.every((box) => Math.round(box.height) >= 44), "K6 per step").toBe(true);
  });

  test("gives each step the whole width", async () => {
    const preview = await mount(390, { layout: "column" });
    const widths = new Set(marks(preview).map((mark) => Math.round(mark.getBoundingClientRect().width)));
    const row = preview.shadowRoot!.querySelector<HTMLElement>(".guide-preview__rating-row")!;

    expect(widths.size, "every step the same width").toBe(1);
    expect([...widths][0]).toBe(Math.round(row.getBoundingClientRect().width));
  });

  test("shows the number beside the word, which the row hides", async () => {
    const column = await mount(390, { layout: "column" });
    const numbers = [...column.shadowRoot!.querySelectorAll<HTMLElement>(".guide-preview__rating-number")];

    // The place on the scale is worth seeing once there is room for it.
    expect(numbers.every((number) => number.getBoundingClientRect().width > 1)).toBe(true);

    const row = await mount(520);
    const hidden = [...row.shadowRoot!.querySelectorAll<HTMLElement>(".guide-preview__rating-number")];

    // …and in a row of words it stays for the reader only.
    expect(hidden.every((number) => number.getBoundingClientRect().width <= 1)).toBe(true);
  });

  test("keeps the ways out under the column, as under a row", async () => {
    const preview = await mount(390, { layout: "column", notApplicable: true, dontKnow: true });
    const row = preview.shadowRoot!.querySelector<HTMLElement>(".guide-preview__rating-row")!;
    const waysOut = [...preview.shadowRoot!.querySelectorAll<HTMLElement>(".guide-preview__rating-na")];

    expect(waysOut).toHaveLength(2);
    expect(waysOut[0]!.getBoundingClientRect().top).toBeGreaterThan(
      row.getBoundingClientRect().bottom - 1,
    );
  });
});

describe("the rating as a group", () => {
  test("is a fieldset of real radio buttons", async () => {
    const preview = await mount(390);
    const fieldset = preview.shadowRoot?.querySelector("fieldset.guide-preview__rating");

    expect(fieldset?.querySelector("legend")?.textContent?.trim()).toBe("Välj ett alternativ");
    expect(fieldset?.querySelectorAll('input[type="radio"]')).toHaveLength(4);
  });

  test("reads the word with its place on the scale", async () => {
    const preview = await mount(390);
    const second = preview.shadowRoot?.querySelectorAll<HTMLElement>(".guide-preview__rating-step")[1];

    // The accessible name is the label's text: "2 Ganska bra", not "Ganska bra"
    // on its own — a word with no place on the scale.
    expect(second?.textContent?.replace(/\s+/g, " ").trim()).toBe("2 Ganska bra");
  });

  test("carries the question's explanation on the group", async () => {
    const preview = await mount(390);
    const fieldset = preview.shadowRoot?.querySelector(".guide-preview__rating");
    const describedBy = fieldset?.getAttribute("aria-describedby") ?? "";

    expect(preview.shadowRoot?.getElementById(describedBy)?.textContent).toContain("senaste året");
  });

  test("tints the chosen step, in the tokens a chosen answer already uses", async () => {
    const preview = await mount(390);
    const radios = [...preview.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    const before = getComputedStyle(marks(preview)[1]!).backgroundColor;

    radios[1]!.click();
    await settle();

    expect(getComputedStyle(marks(preview)[1]!).backgroundColor).not.toBe(before);
  });
});

describe("the ways out", () => {
  const rows = (preview: GuidePreview): HTMLElement[] => [
    ...(preview.shadowRoot?.querySelectorAll<HTMLElement>(".guide-preview__rating-na") ?? []),
  ];

  test("are not there until the editor offers them", async () => {
    const preview = await mount(390);

    expect(preview.shadowRoot?.querySelector("[data-rating-out]")).toBeNull();
  });

  test("are two rows, the question's before the person's", async () => {
    // Johan 13/9: *Inte aktuellt* is about the question, *Vet ej* about the
    // person. Offered only the first, everybody who has not thought about it
    // says the question does not apply — a different answer, and the wrong one.
    const preview = await mount(390, { notApplicable: true, dontKnow: true });

    expect(rows(preview).map((row) => row.textContent?.trim())).toEqual([
      "Inte aktuellt",
      "Vet ej",
    ]);
  });

  test("belong to the same group as the steps, so the arrow keys reach them", async () => {
    const preview = await mount(390, { notApplicable: true, dontKnow: true });
    const names = new Set(
      [...preview.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="radio"]')].map(
        (input) => input.name,
      ),
    );

    expect(preview.shadowRoot?.querySelectorAll('input[type="radio"]')).toHaveLength(6);
    expect(names.size, "one radio group, not two").toBe(1);
  });

  test("stand visibly under the row, never behind a button", async () => {
    const preview = await mount(390, { notApplicable: true, dontKnow: true });
    const row = preview.shadowRoot?.querySelector<HTMLElement>(".guide-preview__rating-row");

    for (const wayOut of rows(preview)) {
      // Visible: it has a box on the page, and it is below the scale.
      expect(wayOut.getBoundingClientRect().height).toBeGreaterThan(0);
      expect(wayOut.getBoundingClientRect().top).toBeGreaterThan(row!.getBoundingClientRect().top);
    }

    expect(preview.shadowRoot?.querySelector("details [data-rating-out]")).toBeNull();
  });

  test("leave the words and an empty value, so an average is not dragged down", async () => {
    const preview = await mount(390, { notApplicable: true, notApplicableLabel: { sv: "Bor inte här" } });

    preview.shadowRoot?.querySelector<HTMLInputElement>("[data-rating-out]")?.click();
    await settle();
    preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
    await settle();
    await settle();

    expect(preview.getAnswers().trivsel).toEqual({ label: "Bor inte här", value: "" });
  });

  test("and *Vet ej* leaves its own words, not the other one's", async () => {
    const preview = await mount(390, { notApplicable: true, dontKnow: true });

    preview.shadowRoot?.querySelectorAll<HTMLInputElement>("[data-rating-out]")[1]?.click();
    await settle();
    preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
    await settle();
    await settle();

    expect(preview.getAnswers().trivsel).toEqual({ label: "Vet ej", value: "" });
  });

  test("and a pressed step leaves its place as a number", async () => {
    const preview = await mount(390);

    preview.shadowRoot?.querySelectorAll<HTMLInputElement>('input[type="radio"]')[2]?.click();
    await settle();
    preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
    await settle();
    await settle();

    expect(preview.getAnswers().trivsel).toBe("3");
  });
});

/**
 * The same field on a page, which is where a survey actually puts it.
 *
 * Two homes, one piece of markup (`ratingScale`) — and this is what says the
 * second home was wired up at all. The date field's resting decoration existed
 * on the step and not on the page until somebody met the page on a phone.
 */
describe("a rating as a field on a page", () => {
  const pageGuide = (): GraphData =>
    ({
      startNodeId: "p",
      settings: { sourceLocale: "sv" },
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Hur trivs du" } } },
        {
          id: "f1",
          type: "rating-question",
          parentPageId: "p",
          order: 0,
          position: { x: 0, y: 0 },
          data: {
            title: { sv: "Lägenheten" },
            variableName: "lagenheten",
            steps: 4,
            labels: [{ sv: "Mycket bra" }, { sv: "Ganska bra" }, { sv: "Inte så bra" }, { sv: "Dåligt" }],
            notApplicable: true,
          },
        },
        { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
      ],
      connections: [
        { id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
    }) as unknown as GraphData;

  async function page(): Promise<GuidePreview> {
    const preview = document.createElement("guide-preview") as GuidePreview;

    preview.setAttribute("active-locale", "sv");
    preview.style.display = "block";
    // Wider than 480: the row this test is about (a narrower host stands it as a list).
    preview.style.width = "520px";
    document.body.append(preview);
    preview.graph = pageGuide();
    await settle();
    await settle();

    return preview;
  }

  test("draws the same row, with the question as the group's name", async () => {
    const preview = await page();
    const fieldset = preview.shadowRoot?.querySelector("fieldset.guide-preview__rating");
    const tops = new Set(
      [...fieldset!.querySelectorAll<HTMLElement>(".guide-preview__rating-mark")].map((mark) =>
        Math.round(mark.getBoundingClientRect().top),
      ),
    );

    expect(fieldset?.querySelector("legend")?.textContent?.trim()).toBe("Lägenheten");
    expect(tops.size).toBe(1);
  });

  test("stores the number the visitor pressed", async () => {
    const preview = await page();

    preview.shadowRoot?.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1]?.click();
    await settle();
    preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
    await settle();
    await settle();

    expect(preview.getAnswers().lagenheten).toBe("2");
  });

  test("and the way out's words with an empty value", async () => {
    const preview = await page();

    preview.shadowRoot?.querySelector<HTMLInputElement>("[data-rating-out]")?.click();
    await settle();
    preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
    await settle();
    await settle();

    expect(preview.getAnswers().lagenheten).toEqual({ label: "Inte aktuellt", value: "" });
  });
});

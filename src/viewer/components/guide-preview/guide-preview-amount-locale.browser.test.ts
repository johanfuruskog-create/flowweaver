import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";

/**
 * An amount survives being shown in a language that groups with a comma.
 *
 * ## The two ways it broke
 *
 * **Typing.** In an English guide, `12345` typed one key at a time: after four
 * digits the field held `1,234`; the fifth re-masked `1,2345`, read the field's
 * own comma as a decimal mark, and left `1.2345` — in the field and in
 * `data-canonical`. Wrong by a factor of ten thousand, and silent, because
 * `1.2345` is a valid number.
 *
 * **Mounting.** Worse, because nobody had to do anything. A stored `1234567`
 * rendered as `1,234,567` was read straight back by `carryCanonical`, which had
 * no locale, and rewritten to `1.234567` before the field was ever touched.
 *
 * Swedish survived both by luck: it groups with a non-breaking space, which the
 * digit filter throws away regardless. The one language it could not happen in
 * is the one everything was tested in.
 *
 * ## Why the page route for the mount case
 *
 * A page keeps what was typed when validation sends somebody back, and it keeps
 * it canonically. Re-rendering from that draft is the same path a stored answer
 * takes, and it is the only one the viewer offers today — the engine drops an
 * answer when you step back.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function englishGuide(): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "en");
  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = {
    startNodeId: "p",
    nodes: [
      {
        id: "p",
        type: "page",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Om ekonomin", en: "About your finances" } },
      },
      {
        id: "amount",
        type: "number-question",
        parentPageId: "p",
        order: 1,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Månadslön", en: "Monthly salary" }, variableName: "salary" },
      },
      {
        id: "name",
        type: "text-question",
        parentPageId: "p",
        order: 2,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Namn", en: "Name" }, variableName: "name", required: true },
      },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  return preview;
}

const amountField = (preview: GuidePreview): HTMLInputElement =>
  preview.shadowRoot!.querySelector<HTMLInputElement>("input[data-group]")!;

describe("an amount typed in an English guide", () => {
  test("groups with commas without ever reading one as a decimal", async () => {
    const preview = await englishGuide();
    const field = amountField(preview);

    await userEvent.click(field);
    await userEvent.type(field, "12345");
    await settle();

    expect(field.value).toBe("12,345");
  });

  test("and stores the digits, not a number a thousand times too small", async () => {
    const preview = await englishGuide();
    const field = amountField(preview);

    await userEvent.click(field);
    await userEvent.type(field, "12345");
    await settle();

    expect(field.dataset.canonical).toBe("12345");
  });
});

describe("an amount that is only redrawn", () => {
  test("is not rewritten by the redraw itself", async () => {
    /*
     * The mount case. Nobody types in this test after the redraw — the value is
     * put on screen grouped, read back, and that read used to be the corruption.
     */
    const preview = await englishGuide();
    const field = amountField(preview);

    await userEvent.click(field);
    await userEvent.type(field, "1234567");
    await settle();

    // Name is left empty, so the page is refused and redrawn from its draft.
    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    await settle();

    const redrawn = amountField(preview);

    expect(redrawn.value, "vad som står på skärmen").toBe("1,234,567");
    expect(redrawn.dataset.canonical, "vad som lagras").toBe("1234567");
  });
});

describe("the same guide in Swedish", () => {
  test("groups with a space and keeps the comma as a decimal mark", async () => {
    /*
     * The other half of the rule. Swedish groups with a space, so both `,` and
     * `.` are safe to read as decimals there — and `600,5` means six hundred
     * point five, where in English it means six hundred thousand and five.
     */
    const preview = await englishGuide();

    preview.setAttribute("active-locale", "sv");
    await settle();

    const field = amountField(preview);

    await userEvent.click(field);
    await userEvent.type(field, "600,5");
    await settle();

    expect(field.value).toBe("600,5");
    expect(field.dataset.canonical).toBe("600.5");
  });
});

describe("the verdict the resident reads", () => {
  test("groups the amount the same way the field did", async () => {
    /*
     * The end of the same fault. The field grouped by the guide's language and
     * the result text did not, so an English guide wrote `600,000` where the
     * amount was typed and `600 000` in the sentence reporting it back — one
     * guide answering one question two ways, three lines apart.
     */
    const preview = document.createElement("guide-preview") as GuidePreview;

    preview.setAttribute("active-locale", "en");
    preview.style.cssText = "display: block; width: 600px;";
    document.body.append(preview);
    preview.graph = {
      startNodeId: "q",
      nodes: [
        {
          id: "q",
          type: "number-question",
          position: { x: 0, y: 0 },
          data: { title: { sv: "Lön", en: "Salary" }, variableName: "salary" },
        },
        {
          id: "r",
          type: "result",
          position: { x: 0, y: 0 },
          data: {
            title: { sv: "Klart", en: "Done" },
            description: { sv: "Du tjänar {{salary}} kr.", en: "You earn {{salary}} kr." },
          },
        },
      ],
      connections: [
        { id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
    } as never;

    await settle();
    await settle();

    const field = amountField(preview);

    await userEvent.click(field);
    await userEvent.type(field, "600000");
    await settle();

    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    await settle();

    const card = preview.shadowRoot!.querySelector(".guide-preview__card")!.textContent ?? "";

    expect(card).toContain("600,000");
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * What somebody typed survives a page that did not pass validation.
 *
 * ## The fault, as reported and as measured
 *
 * From a tablet: a wrong organisationsnummer, personnummer and ärendenummer, one
 * press of the button, and **everything was gone — only the photo was left.**
 * Measured on the every-field guide: nine filled fields before the press, one
 * after.
 *
 * A page renders its fields from `engine.getAnswers()`, and a page that fails
 * validation never reaches `answerPage()`. So nothing had been stored, and the
 * re-render that puts the error messages on screen put empty fields under them.
 * The values existed the whole time — in the map read out of the DOM one line
 * earlier — and were thrown away.
 *
 * The photo survived because a chosen file is held and put back on a re-rendered
 * input. Text had no such thing.
 *
 * ## Why this is the worst kind of bug
 *
 * It costs the most work at the moment somebody is already having a bad time,
 * and it punishes exactly the care it should reward: the person who filled in
 * the whole page before pressing the button loses more than the one who pressed
 * it early. On a form that asks for a personnummer, a case number and a photo,
 * "start again" is not a small ask.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A page whose fields are certain to be rejected, and one that is not. */
function pageGraph(): GraphData {
  return {
    startNodeId: "sida",
    nodes: [
      { id: "sida", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
      {
        id: "namn",
        type: "text-question",
        parentPageId: "sida",
        order: 1,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Namn" }, variableName: "namn", required: true },
      },
      {
        id: "pnr",
        type: "text-question",
        parentPageId: "sida",
        order: 2,
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Personnummer" },
          variableName: "pnr",
          format: "personnummer",
          required: true,
        },
      },
      { id: "klart", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "sida", portId: "continue" }, to: { nodeId: "klart", portId: "input" } },
    ],
  } as GraphData;
}

async function pageWith(namn: string, pnr: string): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = "display: block; width: 700px;";
  document.body.append(preview);
  preview.graph = pageGraph();

  await settle();
  await settle();

  const fields = [
    ...preview.shadowRoot!.querySelectorAll<HTMLInputElement>("input[type='text']:not([data-hp])"),
  ];

  [namn, pnr].forEach((value, index) => {
    const field = fields[index];

    if (!field) return;

    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(field),
      "value",
    )!.set!;

    setter.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await settle();

  return preview;
}

const values = (preview: GuidePreview): string[] =>
  [...preview.shadowRoot!.querySelectorAll<HTMLInputElement>("input[type='text']:not([data-hp])")].map(
    (field) => field.value,
  );

const submit = async (preview: GuidePreview): Promise<void> => {
  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
  await settle();
  await settle();
};

describe("en sida som inte gick igenom", () => {
  test("behåller allt som skrevs in", async () => {
    const preview = await pageWith("Anna Andersson", "19800223");

    /*
     * Digits, not letters: the field is shaped now, and the mask scrambles
     * anything that is not a digit — `"abc"` becomes `"b"`. That is a fault of
     * its own, measured and written down separately; this file is about the
     * draft surviving, so it types something the shape can hold.
     *
     * Eight digits is a personnummer that is too short, which fails validation
     * without fighting the mask.
     */
    expect(values(preview), "fälten fylldes aldrig i").toEqual([
      "Anna Andersson",
      "19800223",
    ]);

    await submit(preview);

    expect(values(preview), "det inskrivna försvann").toEqual([
      "Anna Andersson",
      "19800223",
    ]);
  });

  test("och pekar ut vad som var fel", async () => {
    // Keeping the text is only half of it: without the marks, the page comes
    // back looking exactly as it did and nobody knows what to change.
    const preview = await pageWith("Anna Andersson", "19800223");

    await submit(preview);

    expect(
      preview.shadowRoot!.querySelectorAll("[data-invalid]").length,
      "inget fält pekades ut",
    ).toBeGreaterThan(0);
  });

  test("och står kvar på sidan", async () => {
    const preview = await pageWith("Anna Andersson", "19800223");

    await submit(preview);

    expect(preview.getCurrentNodeId()).toBe("sida");
  });
});

describe("en sida som gick igenom", () => {
  test("lämnar inget utkast kvar att läcka till nästa steg", async () => {
    /*
     * The draft is deliberately short-lived. If it outlived the page it came
     * from, a later step could show a value nobody typed there — which is a
     * worse fault than the one this fixes, and quieter.
     */
    const preview = await pageWith("Anna Andersson", "198002237538");

    await submit(preview);

    expect(preview.getCurrentNodeId(), "sidan gick inte igenom").toBe("klart");
    expect(preview.getAnswers()).toEqual({
      namn: "Anna Andersson",
      pnr: "198002237538",
    });
  });
});

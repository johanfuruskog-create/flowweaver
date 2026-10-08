import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * A shaped field on a page: the form for the eye, the digits for the variable.
 *
 * ## What was wrong
 *
 * Johan typed a personnummer, a postnummer and an organisationsnummer into the
 * fault report and saw no written form at all. Measured on the deployed site:
 * `198002237538` stayed exactly as typed. The fields carried their formats in
 * the guide, but a **page's** field never got the hooks the shaping listens for
 * — those were written only by the standalone question's render — so there was
 * nothing for the mask to hang on.
 *
 * ## And the half that would have been worse
 *
 * Wiring the shape alone would have stored `19800223-7538`, separators and all,
 * breaking the rule Johan set: **the variable carries the digits, the way there
 * carries the form.** A dash in a variable breaks the first calculation node and
 * the first host that reads it.
 *
 * The old design derived the digits at collection time — and the page's
 * collection forgot, which is exactly how the bug arrived. So the value is
 * *carried* now: the field writes its canonical form beside itself whenever it
 * changes, and collection reads it without knowing formats exist. A rule every
 * new path must remember is a rule that will be forgotten; a value already
 * sitting there cannot be.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function graph(): GraphData {
  return {
    startNodeId: "sida",
    nodes: [
      { id: "sida", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
      {
        id: "pnr",
        type: "text-question",
        parentPageId: "sida",
        order: 1,
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

async function page(): Promise<{ preview: GuidePreview; field: HTMLInputElement }> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = "display: block; width: 700px;";
  document.body.append(preview);
  preview.graph = graph();

  await settle();
  await settle();

  return {
    preview,
    field: preview.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!,
  };
}

describe("ett formaterat fält på en sida", () => {
  test("tar sin form medan man skriver", async () => {
    const { field } = await page();

    await userEvent.click(field);
    await userEvent.type(field, "198002237538");

    expect(field.value).toBe("19800223-7538");
  });

  test("men variabeln bär siffrorna", async () => {
    /*
     * Johan's rule, and the reason the two halves had to land together. The
     * field is read by a person against a card in their hand; the variable is
     * read by a calculation node and by whatever the host does next.
     */
    const { preview, field } = await page();

    await userEvent.click(field);
    await userEvent.type(field, "198002237538");

    preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
    await settle();
    await settle();

    expect(preview.getCurrentNodeId(), "sidan gick inte igenom").toBe("klart");
    expect(preview.getAnswers()).toEqual({ pnr: "198002237538" });
  });
});

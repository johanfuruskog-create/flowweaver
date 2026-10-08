import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";

/**
 * A number question keeps its shape once something is wrong with it.
 *
 * ## Measured before changing anything (PRAXIS 6)
 *
 * The unit was moved beside the field by making the label a flex row and giving
 * the input `order: 1` and the unit `order: 2`. Everything else in that label
 * kept the default `order: 0` — including the error span and the note that says
 * a character was refused. Rendered with a validation error:
 *
 *     input:  y=136  x=257–511    the field starts 228px in
 *     error:  y=151  x=29–247     the message sits to the *left* of the field
 *     unit:   y=191  x=29–88      pushed down to a third line
 *
 * So the row read *"[error] [field]"* with `kr/mån` orphaned underneath. Without
 * an error the same row measured correctly, which is why it was not caught when
 * the unit was placed: the layout only comes apart once somebody makes a
 * mistake.
 *
 * It is also a WCAG 1.3.2 problem, not only an ugly one: the reading order on
 * screen no longer matches the order in the markup, and a screen reader follows
 * the markup.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function withError(): Promise<{
  input: DOMRect;
  unit: DOMRect;
  error: DOMRect;
}> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "number-question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Boendekostnad" },
          variableName: "cost",
          unit: { sv: "kr/mån" },
          min: 100,
        },
      },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  const root = preview.shadowRoot!;
  const field = root.querySelector<HTMLInputElement>("[data-number-answer]")!;

  await userEvent.click(field);
  await userEvent.type(field, "5");
  field.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  await settle();

  const error = root.querySelector<HTMLElement>("[data-number-validation]")!;

  if ((error.textContent ?? "").trim() === "") {
    throw new Error("Valideringen sa ingenting — mätningen mäter fel sak.");
  }

  return {
    input: field.getBoundingClientRect(),
    unit: root.querySelector<HTMLElement>(".guide-preview__unit")!.getBoundingClientRect(),
    error: error.getBoundingClientRect(),
  };
}

describe("a number question showing an error", () => {
  test("keeps the field at the left edge of its row", async () => {
    const { input, error } = await withError();

    expect(input.left, "fältet trycktes åt höger av felet").toBeLessThan(error.right + 1);
    expect(input.left).toBeLessThan(120);
  });

  test("puts the message below the field, not beside it", async () => {
    const { input, error } = await withError();

    expect(error.top, "felet ligger på fältets rad").toBeGreaterThanOrEqual(input.bottom - 1);
  });

  test("and keeps the unit on the field's own row", async () => {
    /*
     * The unit is the whole reason this label became a flex row. Losing it to a
     * third line when something goes wrong undoes the thing the layout was for.
     */
    const { input, unit } = await withError();

    expect(unit.top).toBeLessThan(input.bottom);
    expect(unit.bottom).toBeGreaterThan(input.top);
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The right keyboard, and the browser's own autofill (story 051's stowaway).
 *
 * A phone field on a mobile should raise the digit keyboard, and an email
 * field should let the browser offer the address it already knows. The
 * format the editor chose carries the knowledge — "telefon" IS the
 * statement that this is a phone number — so the viewer derives
 * `inputmode` and `autocomplete` from it. No format, no attributes:
 * nothing is guessed from titles.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));

function mount(data: Record<string, unknown>): GuidePreview {
  const graph: GraphData = {
    startNodeId: "q",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "q",
        type: "text-question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Hur når vi dig?" }, variableName: "svar", ...data },
      },
      { id: "r", type: "result", position: { x: 200, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;

  const preview = document.createElement("guide-preview") as GuidePreview;

  document.body.append(preview);
  preview.graph = graph;

  return preview;
}

const fieldOf = (preview: GuidePreview): HTMLInputElement =>
  preview.shadowRoot!.querySelector<HTMLInputElement>("[data-text-answer]")!;

describe("tangentbord och autofyll ur formatet", () => {
  test("telefon: tel-tangentbord och tel-autofyll", async () => {
    const preview = mount({ format: "phone" });
    await settle();
    const field = fieldOf(preview);

    expect(field.getAttribute("inputmode")).toBe("tel");
    expect(field.getAttribute("autocomplete")).toBe("tel");
  });

  test("e-post: type=email bär tangentbordet, autofyllen är ny", async () => {
    const preview = mount({ format: "email" });
    await settle();
    const field = fieldOf(preview);

    expect(field.type).toBe("email");
    expect(field.hasAttribute("inputmode")).toBe(false);
    expect(field.getAttribute("autocomplete")).toBe("email");
  });

  test("utan format: inga hintar, ingenting gissas", async () => {
    const preview = mount({});
    await settle();
    const field = fieldOf(preview);

    expect(field.hasAttribute("inputmode")).toBe(false);
    expect(field.hasAttribute("autocomplete")).toBe(false);
  });
});

/**
 * Vad fältet är (story 110): namn och adress have no format to derive from.
 *
 * A text field titled "Namn" is text to a browser, so a phone offers nothing —
 * and those are the fields a visitor writes most often. The word is CHOSEN by
 * the editor, never guessed from the title: "Namn" in another language is
 * another word, and a guess that lands wrong is worse than no offer at all.
 */
describe("vad fältet är (story 110)", () => {
  test("det valda ordet blir autocomplete", async () => {
    const preview = mount({ autofill: "given-name" });
    await settle();

    expect(fieldOf(preview).getAttribute("autocomplete")).toBe("given-name");
  });

  test("formatet vinner över valet — e-post bär redan sitt ord", async () => {
    const preview = mount({ format: "email", autofill: "given-name" });
    await settle();

    expect(fieldOf(preview).getAttribute("autocomplete")).toBe("email");
  });

  test("ett ord utanför webbläsarens lista sätter ingenting", async () => {
    const preview = mount({ autofill: "favoritfärg" });
    await settle();

    expect(fieldOf(preview).hasAttribute("autocomplete")).toBe(false);
  });
});

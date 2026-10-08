import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";
import { registerFormat, unregisterFormat } from "../../core/format-registry";

import type { GuidePreview } from "./guide-preview";

/**
 * A shape made of digits opens a keyboard made of digits.
 *
 * Johan, having seen the amount field do it: *"kan du få det på personnummer?"*
 * Yes — and the interesting part is where the answer comes from. The pattern
 * already says it: `########-####` has nothing but digit slots. Listing format
 * names instead would be a second copy of that fact, and the first format
 * somebody registers is the one nobody adds to the list.
 *
 * The separators are not an objection. The mask puts the hyphen in, so nobody
 * has to find one on a keypad that has none — a narrower keyboard is only kind
 * when the field fills in what it leaves out.
 */

afterEach(() => {
  document.body.replaceChildren();
  /*
   * The registry is module state, shared by every test in the worker. A format
   * left behind here is a format the next file did not ask for — and the next
   * file may well be counting how many there are.
   */
  unregisterFormat("nino-tangentbord");
});

const settle = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function inputFor(data: Record<string, unknown>): Promise<HTMLInputElement> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  document.body.append(preview);
  preview.graph = {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "text-question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Fråga" }, variableName: "v", ...data },
      },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  return preview.shadowRoot!.querySelector<HTMLInputElement>("[data-text-answer]")!;
}

describe("tangentbordet ett fält ber om", () => {
  test("är siffror för ett personnummer", async () => {
    expect((await inputFor({ format: "personnummer" })).inputMode).toBe("numeric");
  });

  test("och för ett postnummer och ett organisationsnummer", async () => {
    expect((await inputFor({ format: "postnummer" })).inputMode).toBe("numeric");
    expect((await inputFor({ format: "organisationsnummer" })).inputMode).toBe("numeric");
  });

  test("och för en egen mall som bara har siffror", async () => {
    // Redaktörens egen form räknas som formatets. Ett amerikanskt SSN har inget
    // registrerat format hos oss, bara en mall.
    expect((await inputFor({ mask: "###-##-####" })).inputMode).toBe("numeric");
  });

  test("men inte när formen vill ha bokstäver", async () => {
    /*
     * Ett brittiskt national insurance number: `AA ## ## ## A`. Ett sifferbord
     * där lämnar någon letande efter knappen som byter tillbaka.
     */
    registerFormat("nino-tangentbord", { label: "NINO", pattern: "AA ## ## ## A" });

    expect((await inputFor({ format: "nino-tangentbord" })).inputMode).toBe("");
  });

  test("och inte för ett fält utan form alls", async () => {
    expect((await inputFor({})).inputMode).toBe("");
  });

  test("e-post behåller sitt eget tangentbord", async () => {
    // `type="email"` ger @ och punkt på plattan. Ett sifferbord vore ett tapp.
    const input = await inputFor({ format: "email" });

    expect(input.type).toBe("email");
    expect(input.inputMode).toBe("");
  });
});

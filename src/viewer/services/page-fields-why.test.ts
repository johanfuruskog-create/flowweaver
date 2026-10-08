import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { PageFieldsService } from "./page-fields-service";

import type { GraphData } from "../types/graph";

/**
 * "Varför frågar vi det här?" (story 051) follows the question onto a page.
 *
 * The third property lost in the same place: the panel offered `why` on every
 * question type, the standalone step drew it, and a field on a page — the
 * form, where the hesitation before handing over a personal number actually
 * happens — had nothing. Found on *Låna* 6/9 (LOGG), written down as *hittat,
 * inte rättat*.
 *
 * Localized like the description, so the translation view reaches it.
 */

const graph = (data: Record<string, unknown>): GraphData =>
  ({
    startNodeId: "p",
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
      {
        id: "f",
        type: "text-question",
        parentPageId: "p",
        order: 1,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Personnummer" }, variableName: "pnr", ...data },
      },
    ],
    connections: [],
  }) as GraphData;

const fieldOf = (data: Record<string, unknown>, locale = "sv") =>
  PageFieldsService.getFields(graph(data), graph(data).nodes[0], {}, locale)[0];

describe("a page field's why", () => {
  test("is the question's, in the visitor's language", () => {
    const why = { sv: "Vi hämtar din adress från folkbokföringen.", en: "We fetch your address from the register." };
    expect(fieldOf({ why }).why).toBe("Vi hämtar din adress från folkbokföringen.");
    expect(fieldOf({ why }, "en").why).toBe("We fetch your address from the register.");
  });

  test("and is absent when the editor wrote nothing", () => {
    expect(fieldOf({}).why).toBeUndefined();
    expect(fieldOf({ why: { sv: "" } }).why).toBeUndefined();
  });
});

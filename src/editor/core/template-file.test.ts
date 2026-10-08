import { describe, expect, test } from "vitest";

import {
  isTemplateFile,
  missingFormatOf,
  templateFileJson,
  templateNeeds,
} from "./template-file";

import "../../viewer/core/default-formats";

import type { NodeTemplate } from "../../viewer/types/graph";

/**
 * A single field, handed to somebody else.
 *
 * The guide export already carried the templates a guide used, so sharing a
 * field was possible — by exporting everything around it. Johan's objection was
 * the whole reason for this: sending a whole guide to hand over one good node is
 * a silly detour.
 *
 * What is worth testing hardest is the **telling**. A template carrying a
 * written shape is complete anywhere; one naming a format is a promise about
 * behaviour that lives in the editor it came from, and a promise nobody checks
 * is a field that quietly validates nothing.
 */

const selfContained: NodeTemplate = {
  type: "nodmall-ssn",
  label: "Social security number",
  base: "text-question",
  values: { mask: "###-##-####", format: "regex", pattern: "^\\d{3}-\\d{2}-\\d{4}$" },
};

const leaning: NodeTemplate = {
  type: "nodmall-fnr",
  label: "Fødselsnummer",
  base: "text-question",
  values: { format: "fnr-no" },
};

describe("filen", () => {
  test("bär versionen, för den överlever verktyget som skrev den", () => {
    expect(JSON.parse(templateFileJson(selfContained)).flowweaverTemplate).toBe(1);
  });

  test("och känns igen som en mall och inte som en guide", () => {
    expect(isTemplateFile(JSON.parse(templateFileJson(selfContained)))).toBe(true);
  });

  test("en guide är inte en mallfil", () => {
    // The same door reads both, so telling them apart is what keeps it one door.
    expect(isTemplateFile({ startNodeId: "a", nodes: [], connections: [] })).toBe(false);
  });

  test("och skräp är det inte heller", () => {
    expect(isTemplateFile(null)).toBe(false);
    expect(isTemplateFile({ flowweaverTemplate: 1 })).toBe(false);
    expect(isTemplateFile({ flowweaverTemplate: 1, template: { type: "x" } })).toBe(false);
  });
});

describe("vad mallen lutar sig mot", () => {
  test("en egen skrivform står på egna ben", () => {
    expect(missingFormatOf(selfContained)).toBeNull();
  });

  test("men ett namngivet format editorn inte har pekas ut", () => {
    /*
     * The line between the two kinds of template, and the reason the import says
     * something. Without it the field appears, takes any input and checks
     * nothing — a promise kept quietly by not being kept.
     */
    expect(missingFormatOf(leaning)).toBe("fnr-no");
  });

  test("och ett format editorn har är inget att varna om", () => {
    expect(missingFormatOf({ ...leaning, values: { format: "personnummer" } })).toBeNull();
  });

  test("en egen regel är inte ett format", () => {
    expect(missingFormatOf({ ...leaning, values: { format: "regex" } })).toBeNull();
  });
});

describe("vad mallen behöver av editorn", () => {
  const alltPå = (): boolean => true;
  const inget = (): boolean => false;

  test("en bastyp som finns och är påslagen behöver ingenting", async () => {
    await import("../../viewer/node-types/default-node-types");

    expect(templateNeeds(selfContained, alltPå)).toBeNull();
  });

  test("en bastyp editorn inte har alls pekas ut", () => {
    /*
     * Johan found this before I did: a template carrying data must be based on a
     * field type that exists. The palette already hid such a template — correctly
     * — but the import said "added to the library" over something nobody would
     * ever see in it.
     */
    expect(
      templateNeeds({ ...selfContained, base: "finns-inte" }, alltPå),
    ).toEqual({ kind: "unknown", base: "finns-inte" });
  });

  test("och en som är avstängd på nivån är en annan sak", async () => {
    /*
     * Two answers rather than one. "Not in this editor" is permanent; "switched
     * off at this level" is a template that waits, and becomes useful the day
     * somebody turns the capability on. Saying both with one sentence would make
     * the second sound like the first.
     */
    await import("../../viewer/node-types/default-node-types");

    const needs = templateNeeds({ ...selfContained, base: "service-call" }, inget);

    expect(needs?.kind).toBe("disabled");
    expect(needs?.capability).toBe("serviceCalls");
  });
});

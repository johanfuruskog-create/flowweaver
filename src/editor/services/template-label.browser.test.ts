import { afterEach, describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";
import "../components/node-palette/node-palette";

import { BUILTIN_TEMPLATES } from "../node-types/builtin-templates";
import { displayTemplateLabel } from "./template-library";

import { proModule } from "../../testing/optional-pro";

import type { NodePalette } from "../components/node-palette/node-palette";

// Whether PRO is here, asked without running it (see node-palette-icons).
const PRO_PALETTE = Object.keys(import.meta.glob("../../pro/editor/palette.ts")).length > 0;
import type { NodeTemplate } from "../../viewer/types/graph";

/**
 * Whose word is a template's name — story 017, open question 2.
 *
 * The palette showed "Fråga" translated beside "E-postfråga" that never could
 * be, because `NodeTemplate.label` is a plain string. That looked like one bug
 * but was two, with opposite answers.
 *
 * **Three of the names were ours.** E-postfråga, Telefonnummer and Personnummer
 * ship with the tool and we hardcoded them in Swedish, so an English editor met
 * our Swedish. That is our fault to fix, and it is fixed like every other word
 * we ship: a key, and `tOr`.
 *
 * **The rest are the organisation's.** A template an administrator named is
 * their vocabulary. Asking them for an English version of their own words would
 * put the work on the wrong person, so it stays as typed.
 *
 * The palette is therefore still mixed in an English editor. The difference is
 * that the mixture now means something: translated is ours, untranslated is
 * theirs.
 */

const ours = (): NodeTemplate =>
  BUILTIN_TEMPLATES.find((template) => template.type === "nodmall-email")!;

const theirs = (): NodeTemplate => ({
  type: "nodmall-1a2b",
  label: "Ja/Nej-fråga",
  base: "question",
  values: {},
});

afterEach(() => document.body.replaceChildren());

describe("templates that ship with the tool", () => {
  test("read Swedish in a Swedish editor", () => {
    expect(displayTemplateLabel(ours(), "sv")).toBe("E-postfråga");
  });

  test("and English in an English one", () => {
    expect(displayTemplateLabel(ours(), "en")).toBe("Email question");
  });

  test("all three of them", () => {
    const english = BUILTIN_TEMPLATES.map((template) =>
      displayTemplateLabel(template, "en"),
    );

    expect(english).toEqual([
      "Email question",
      "Phone number",
      "Personal ID number",
    ]);
  });
});

describe("templates an organisation named", () => {
  // Their vocabulary, in their words. Not ours to translate, and not theirs to
  // have to translate either.
  test("stay as they were typed, whatever the editor's language", () => {
    expect(displayTemplateLabel(theirs(), "en")).toBe("Ja/Nej-fråga");
  });

  test("and are untouched in the source language too", () => {
    expect(displayTemplateLabel(theirs(), "sv")).toBe("Ja/Nej-fråga");
  });

  // The seam takes no branch: a missing key *is* the answer. Nothing has to ask
  // which kind of template it is looking at.
  test("a name that collides with nothing needs no special case", () => {
    const odd: NodeTemplate = { ...theirs(), type: "nodeType.question" };

    expect(displayTemplateLabel(odd, "en")).toBe("Ja/Nej-fråga");
  });
});

describe("the palette shows both, and says which is which", () => {
  // Our templates are built on the free-text question, which only FlowWeaver
  // PRO offers since 8/10 — so the side-by-side needs PRO's palette.
  test.runIf(PRO_PALETTE)("ours is translated and theirs is not, side by side", async () => {
    await proModule("editor/palette.ts");
    const palette = document.createElement("node-palette") as NodePalette;
    document.body.append(palette);
    palette.editorLocale = "en";
    palette.templates = [ours(), theirs()];

    const text = palette.shadowRoot?.textContent ?? "";

    expect({
      ours: text.includes("Email question"),
      theirs: text.includes("Ja/Nej-fråga"),
      swedishOfOurs: text.includes("E-postfråga"),
    }).toEqual({ ours: true, theirs: true, swedishOfOurs: false });
  });
});

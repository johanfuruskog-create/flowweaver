import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import { registerLocale, unregisterLocale } from "../../localization/registry";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * A guide that cannot answer in the language you asked for says so.
 *
 * ## Why say it at all
 *
 * The fallback itself is right: a resident should read *something* rather than
 * an empty box, and the chain — requested, then the guide's own source, then
 * English — puts the most complete text in front of them.
 *
 * Doing it silently is not right. A resident who asked for Finnish and got
 * Swedish is left wondering whether the service is broken, whether they picked
 * the wrong language, or whether this is simply how it is. One line answers all
 * three, and it costs nothing when there is nothing to say.
 *
 * ## Per step
 *
 * Guides are often translated in part. A banner at the top would be true on the
 * untranslated steps and a lie on the translated ones, so the notice appears
 * where the language actually changed under the reader and clears itself where
 * it did not.
 *
 * ## The notice resolves English before the source
 *
 * Every other text falls back to the guide's own language. This one must not:
 * its whole purpose is to be read by someone who could not read the guide.
 * Falling back to the source would state, in the language they cannot read,
 * that they cannot read it.
 */

const GUIDE: GraphData = {
  startNodeId: "a",
  nodes: [
    {
      id: "a",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Bor du här?", fi: "Asutko täällä?" },
        variableName: "here",
        options: [{ id: "y", label: { sv: "Ja", fi: "Kyllä" }, value: "y" }],
      },
    },
    {
      id: "b",
      type: "result",
      position: { x: 320, y: 0 },
      // Untranslated on purpose: this is the step the notice is for.
      data: { title: { sv: "Tack för ditt svar" } },
    },
  ],
  connections: [
    { id: "c", from: { nodeId: "a", portId: "y" }, to: { nodeId: "b", portId: "input" } },
  ],
  settings: { sourceLocale: "sv", locales: ["sv", "fi"] },
} as unknown as GraphData;

function mount(locale: string): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.height = "600px";
  preview.setAttribute("active-locale", locale);
  document.body.append(preview);
  preview.graph = structuredClone(GUIDE);
  return preview;
}

const notice = (preview: GuidePreview): string | null => {
  const element = preview.shadowRoot?.querySelector(".guide-preview__not-translated");
  return element ? (element.textContent ?? "").replace(/\s+/g, " ").trim() : null;
};

afterEach(() => {
  document.body.replaceChildren();
  unregisterLocale("fi");
});

describe("a step in the language you asked for", () => {
  test("says nothing", () => {
    expect(notice(mount("fi"))).toBeNull();
  });

  test("and neither does the source language itself", () => {
    expect(notice(mount("sv"))).toBeNull();
  });

  // Without this the two above would pass on a viewer that rendered nothing.
  test("the guide did render", () => {
    expect(mount("fi").shadowRoot?.textContent).toContain("Asutko täällä?");
  });
});

/*
 * A guide whose *first* step has no Finnish, so nothing has to be clicked to
 * reach the case. The version before this stepped forward and then allowed
 * itself to pass when the notice was absent — a test with a way out is a test
 * that measures nothing, which is the fault it exists to catch.
 */
const UNTRANSLATED: GraphData = {
  ...GUIDE,
  startNodeId: "b",
} as unknown as GraphData;

function mountUntranslated(locale: string): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.height = "600px";
  preview.setAttribute("active-locale", locale);
  document.body.append(preview);
  preview.graph = structuredClone(UNTRANSLATED);
  return preview;
}

describe("a step that is not translated", () => {
  test("names both languages, in English", () => {
    expect(notice(mountUntranslated("fi"))).toBe(
      "This guide has not been translated into Finnish. It is shown in Swedish.",
    );
  });

  test("and the step itself is the source language, as promised", () => {
    expect(mountUntranslated("fi").shadowRoot?.textContent).toContain(
      "Tack för ditt svar",
    );
  });

  test("a language the guide knows nothing about is told plainly", () => {
    expect(notice(mount("ar"))).toBe(
      "This guide has not been translated into Arabic. It is shown in Swedish.",
    );
  });

  /*
   * The names follow the sentence, not the request. Naming them in the reader's
   * language inside an English sentence gives "translated into العربية" — two
   * words they can read in a sentence they cannot.
   */
  test("in the reader's language when we can say the whole thing in it", () => {
    registerLocale("fi", {
      "guide.notTranslated":
        "Opasta ei ole käännetty kielelle {wanted}. Se näytetään kielellä {shown}.",
    });

    expect(notice(mountUntranslated("fi"))).toBe(
      "Opasta ei ole käännetty kielelle suomi. Se näytetään kielellä ruotsi.",
    );
  });
});

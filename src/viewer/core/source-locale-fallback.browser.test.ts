import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import "../components/guide-preview/guide-preview";

import { resolveText } from "./localized-text";

import type { GuidePreview } from "../components/guide-preview/guide-preview";
import type { GraphData } from "../types/graph";

/**
 * A guide never answers in a language nobody chose.
 *
 * ## The fault
 *
 * `resolveText` fell back to the module constant `SOURCE_LOCALE`, which is
 * Swedish. That is true of every guide we have written and of nothing else. A
 * guide authored in English with a partial Swedish translation answered a
 * reader who asked for Arabic in **Swedish** — not the language they asked for,
 * and not the guide's source either.
 *
 * It is the worst shape of fault this codebase keeps producing: it does not
 * look like a fault. No empty box, no error in the console. Just the wrong
 * language, which reads exactly like a translation.
 *
 * Nothing caught it because every example guide *is* Swedish-authored, so the
 * constant and the truth coincided. It surfaced from a question — what happens
 * if the default language changes and the translation is not finished — and the
 * answer had to be measured rather than reasoned about.
 *
 * ## The chain
 *
 *   requested → its base language → the guide's source → English → first
 *
 * English sits after the source because the source is the text the author
 * actually wrote and the only one guaranteed complete. "First" is insertion
 * order, which is not a decision, and is reached only when a text has none of
 * the three.
 */

const ENGLISH_GUIDE: GraphData = {
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        // Authored in English, translated into Swedish. No Arabic yet.
        title: { en: "Do you live in the municipality?", sv: "Bor du i kommunen?" },
        variableName: "lives",
        options: [{ id: "yes", label: { en: "Yes", sv: "Ja" }, value: "yes" }],
      },
    },
  ],
  connections: [],
  settings: { sourceLocale: "en", locales: ["en", "sv", "ar"] },
} as unknown as GraphData;

describe("the language a text falls back to", () => {
  const bilingual = { en: "Do you live here?", sv: "Bor du här?" };

  // The fault, stated as the case that produced it.
  test("an English-authored guide answers in English, not Swedish", () => {
    expect(resolveText(bilingual, "ar", "", "en")).toBe("Do you live here?");
  });

  test("a Swedish-authored guide still answers in Swedish", () => {
    expect(resolveText(bilingual, "ar", "", "sv")).toBe("Bor du här?");
  });

  // Content that predates settings.sourceLocale really is Swedish, so the
  // historical assumption has to survive the fix.
  test("and so does one that says nothing about its source", () => {
    expect(resolveText(bilingual, "ar")).toBe("Bor du här?");
  });

  test("the source wins over English when both are there", () => {
    const finnish = { fi: "Asutko täällä?", en: "Do you live here?" };

    expect(resolveText(finnish, "ar", "", "fi")).toBe("Asutko täällä?");
  });

  test("English is the answer when the source is not in the text either", () => {
    const noSource = { de: "Wohnen Sie hier?", en: "Do you live here?" };

    expect(resolveText(noSource, "ar", "", "fi")).toBe("Do you live here?");
  });

  test("a region variant counts as its language", () => {
    expect(resolveText({ "en-GB": "Colour?" }, "ar", "", "fi")).toBe("Colour?");
  });

  test("an empty translation is a missing one, not an empty box", () => {
    expect(resolveText({ ar: "   ", en: "Do you live here?" }, "ar", "", "en")).toBe(
      "Do you live here?",
    );
  });
});

describe("the viewer resolves against the guide, not the module", () => {
  /*
   * The unit tests above prove the function. This proves the wiring: the fix is
   * only worth anything if the source locale actually reaches resolution from
   * the graph a resident is reading.
   *
   * The language is set with the `active-locale` attribute, which is how a host
   * embedding `<guide-preview>` in plain HTML has to do it. Writing this test
   * is what found that the attribute did not exist — `setAttribute` was silently
   * inert, and the viewer answered in the source language whatever was asked.
   */
  async function render(locale: string): Promise<string> {
    const element = document.createElement("guide-preview") as GuidePreview;
    element.style.height = "600px";
    element.setAttribute("active-locale", locale);
    document.body.append(element);
    element.graph = structuredClone(ENGLISH_GUIDE);
    await new Promise((resolve) => setTimeout(resolve, 150));

    const text = element.shadowRoot?.textContent ?? "";
    element.remove();
    return text;
  }

  test("a reader who asks for Arabic gets the English source", async () => {
    const text = await render("ar");

    expect({
      english: text.includes("Do you live in the municipality?"),
      swedish: text.includes("Bor du i kommunen?"),
    }).toEqual({ english: true, swedish: false });
  });

  /*
   * The content and the chrome have to agree.
   *
   * They did not. Content fell back to the guide's source and the buttons to
   * the module's, so a Somali reader of an English-authored guide met English
   * questions and Swedish buttons on the same screen. It was found by running
   * `examples/language.html`, which is the point of that page — five of six real
   * faults this week were found by running something.
   */
  test("the buttons fall back to the same language as the questions", async () => {
    const text = await render("so");

    expect({
      question: text.includes("Do you live in the municipality?"),
      button: text.includes("Select an option"),
      swedishButton: text.includes("Välj ett alternativ"),
      swedishStep: text.includes("Steg"),
    }).toEqual({
      question: true,
      button: true,
      swedishButton: false,
      swedishStep: false,
    });
  });

  test("and a reader who asks for Swedish still gets Swedish", async () => {
    const text = await render("sv");

    expect(text).toContain("Bor du i kommunen?");
  });

  // Without this the pair above could pass on a viewer that rendered nothing.
  test("the guide rendered at all", async () => {
    expect(await render("en")).toContain("Do you live in the municipality?");
  });

  /*
   * A language switcher changes the attribute on a viewer that is already
   * showing a guide. That is a different path from setting it before the graph
   * lands, and the graph setter reads the attribute either way — so removing
   * `active-locale` from `observedAttributes` left every test above green while
   * breaking exactly this. Found by sabotage, not by review.
   */
  test("changing the attribute afterwards switches the language", async () => {
    const element = document.createElement("guide-preview") as GuidePreview;
    element.style.height = "600px";
    element.setAttribute("active-locale", "sv");
    document.body.append(element);
    element.graph = structuredClone(ENGLISH_GUIDE);
    await new Promise((resolve) => setTimeout(resolve, 150));

    const before = element.shadowRoot?.textContent ?? "";
    element.setAttribute("active-locale", "en");
    await new Promise((resolve) => setTimeout(resolve, 150));
    const after = element.shadowRoot?.textContent ?? "";
    element.remove();

    expect({
      swedishFirst: before.includes("Bor du i kommunen?"),
      englishAfter: after.includes("Do you live in the municipality?"),
      swedishGone: !after.includes("Bor du i kommunen?"),
    }).toEqual({ swedishFirst: true, englishAfter: true, swedishGone: true });
  });
});

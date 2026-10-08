import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { FormattedTextService } from "./formatted-text-service";
import { TemplateVariableService } from "./template-variable-service";

import type { GraphData } from "../types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../testing/optional-pro";
const { EmailResultService } = (await proModule("viewer/services/email-result-service.ts")) ?? {};
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * A guide answers the same question the same way everywhere it speaks.
 *
 * ## The fault
 *
 * `TemplateVariableService.resolve` takes a language and groups numbers with
 * it. The way here passes it. Result texts, formatted descriptions and the
 * email's subject and body did not — they called the same function and left the
 * argument off, so they fell back to Swedish.
 *
 * An English guide therefore wrote `600,000` in the field somebody typed it in
 * and `600 000` in the sentence that reported it back. One guide, two spellings
 * of one number, three lines apart.
 *
 * The email is the sharpest case, because it leaves the browser: the subject
 * line reaches somebody who never saw the guide and cannot tell which
 * convention was meant.
 *
 * ## Why the tests name the separator
 *
 * `600,000` and `600 000` differ by one character, and the wrong one reads as
 * correct at a glance. Asserting the exact string is the only way this fails
 * loudly rather than looking fine in a diff.
 */

/** Non-breaking space — what Swedish groups with, and what `Intl` hands out. */
const NBSP = "\u00a0";

const graph = (): GraphData =>
  ({
    startNodeId: "amount",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "amount",
        type: "number-question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Lön", en: "Salary" }, variableName: "salary" },
      },
      {
        id: "mail",
        type: "email-result",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Skickat", en: "Sent" },
          to: "kontakt@example.se",
          subject: { sv: "Ansökan om {{salary}}", en: "Application for {{salary}}" },
          body: { sv: "Beloppet är {{salary}} kr.", en: "The amount is {{salary}} kr." },
        },
      },
    ],
    connections: [],
  }) as GraphData;

const answers = { salary: "600000" };

describe("the email that leaves the browser", () => {
  test.runIf(PRO)("groups the way the guide was being read", () => {
    const produced = EmailResultService.produce(graph().nodes[1]!, answers, graph(), "en");

    expect(produced?.resolved.subject).toBe("Application for 600,000");
    expect(produced?.resolved.body).toBe("The amount is 600,000 kr.");
  });

  test.runIf(PRO)("and in Swedish it groups the Swedish way", () => {
    const produced = EmailResultService.produce(graph().nodes[1]!, answers, graph(), "sv");

    expect(produced?.resolved.subject).toBe(`Ansökan om 600${NBSP}000`);
  });
});

describe("a formatted description", () => {
  test("follows the language it is displayed in", () => {
    const rendered = FormattedTextService.render(
      "Du tjänar {{salary}} kr.",
      ["bold"],
      answers,
      graph(),
      "en",
    );

    expect(rendered.html).toContain("600,000");
  });

  test("and falls back to the source language when none is given", () => {
    /*
     * Nobody should be forced to pass it. A service called without a language
     * behaves exactly as it did before this was threaded through, which is what
     * makes the change safe to make in one cut.
     */
    const rendered = FormattedTextService.render("{{salary}}", ["bold"], answers, graph());

    expect(rendered.html).toContain(`600${NBSP}000`);
  });
});

describe("the resolver itself", () => {
  test("still groups by the language it is handed", () => {
    // The behaviour the three callers above were missing out on, asserted once
    // so a change here shows up as its own failure rather than three.
    expect(
      TemplateVariableService.resolve("{{salary}}", answers, graph(), "en").resolved,
    ).toBe("600,000");
  });
});

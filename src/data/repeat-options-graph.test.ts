import { describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import { GuideTraversalEngine } from "../viewer/core/guide-traversal-engine";
import { PageFieldsService } from "../viewer/services/page-fields-service";
import { PageRepeatService } from "../viewer/services/page-repeat-service";

import { repeatOptionsGraph } from "./repeat-options-graph";

/**
 * Berättelse 138, kriterium 6 — utan webbläsare: vad motorn och tjänsterna
 * säger om alternativen i en upprepad post. Webbläsarens halva, medan
 * besökaren fyller i, står i `repeat-options.browser.test.ts`.
 */

const graph = () => structuredClone(repeatOptionsGraph);
const page = () => graph().nodes.find((node) => node.id === "repeat-options-page")!;
const sessionOptions = (answers: Record<string, unknown>): string[] =>
  PageFieldsService.getFields(graph(), page(), answers as never, "sv")
    .find((field) => field.variableName === "pass")!
    .options.map((option) => option.value);

describe("alternativen i en upprepad post (berättelse 138, kriterium 6)", () => {
  test("en post ser postens eget svar: dag 1 ger dag 1-passen", () => {
    const answers = PageRepeatService.recordAnswers({}, "passen", [{ dag: "1" }], 0);

    expect(sessionOptions(answers)).toEqual(["klarsprak", "matning"]);
  });

  test("post 2 ser post 1:s svar, men post 1 ser inte post 2:s", () => {
    const records = [{ dag: "1", pass: "klarsprak" }, { dag: "2", pass: "" }];

    expect(sessionOptions(PageRepeatService.recordAnswers({}, "passen", records, 1))).toEqual(["panel", "fordjupning"]);
    // Omvänd ordning: klarspråk i post 2 låser inte upp fördjupningen i post 1.
    const reversed = [{ dag: "2", pass: "" }, { dag: "1", pass: "klarsprak" }];
    expect(sessionOptions(PageRepeatService.recordAnswers({}, "passen", reversed, 0))).toEqual(["panel"]);
  });

  test("motorn läser posten som visaren ritade den: fördjupningen i post 2 får sin etikett", () => {
    const engine = new GuideTraversalEngine(graph());

    const result = engine.answerPage({
      passen: [
        { dag: "1", pass: "klarsprak" },
        { dag: "2", pass: "fordjupning" },
      ],
    });

    expect(result.success).toBe(true);
    const second = engine.getAnswerRecords().find((record) => record.variableName === "passen[1].pass");
    // Utan de tidigare posterna var alternativet dolt för motorn, och kvittot
    // skrev värdet *fordjupning* där besökaren hade valt *Klarspråk, fördjupning*.
    expect(second?.optionLabel).toBe("Klarspråk, fördjupning");
  });
});

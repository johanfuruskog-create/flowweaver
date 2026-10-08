import { describe, expect, test } from "vitest";

import { QuestionOptionsService } from "./question-options-service";

import type { FlowNodeData, QuestionOption } from "../types/graph";

const createOptions = (): QuestionOption[] => [
  { id: "yes", label: "Ja", value: "yes" },
  { id: "no", label: "Nej", value: "no" },
  { id: "maybe", label: "Kanske", value: "maybe" },
];

describe("QuestionOptionsService", () => {
  test("reads valid options from a node", () => {
    const options = createOptions();
    const node: FlowNodeData = {
      id: "question",
      type: "question",
      position: { x: 0, y: 0 },
      data: { options },
    };

    expect(QuestionOptionsService.getOptions(node)).toEqual(options);
  });

  test("filtrerar bort ogiltiga alternativ", () => {
    const result = QuestionOptionsService.parseOptions([
      createOptions()[0],
      null,
      "Ja",
      { id: "missing-value", label: "Saknar värde" },
      { id: 42, label: "Felaktigt id", value: "invalid" },
    ]);

    expect(result).toEqual([
      { id: "yes", label: "Ja", value: "yes" },
    ]);
  });

  test("returns an empty list for data that is not a list", () => {
    expect(QuestionOptionsService.parseOptions(undefined)).toEqual([]);
    expect(QuestionOptionsService.parseOptions({})).toEqual([]);
  });

  /*
   * Uppdrag 28/9 svarsalternativen, etapp 2: *"platshållaren skrivs aldrig
   * till datamodellen"*. Nya alternativ fick etiketten "Alternativ 4" —
   * svenska i vilken guide som helst, sparad som om redaktören skrivit den.
   * Panelen visar "Nytt alternativ" tills texten finns; modellen får tomt.
   */
  test("creates a new option without a placeholder label in the model", () => {
    const result = QuestionOptionsService.createOption(createOptions());

    expect(result.id).toEqual(expect.any(String));
    expect(result.id).not.toHaveLength(0);
    expect(result.label).toBe("");
    expect(result.value).toBe("option-4");
  });

  /*
   * Mätt 28/9: tre alternativ, ta bort det första, lägg till ett — det nya
   * fick `option-3`, som redan fanns (värdet räknades som antal + 1). Två
   * alternativ med samma värde går inte att skilja i en regel eller ett
   * svar. Och inget borttaget värde återanvänds: det kan stå i svar som
   * redan skickats in.
   */
  test("never gives a value already in use, nor one a removed option had", () => {
    const afterRemoval: QuestionOption[] = [
      { id: "b", label: "B", value: "option-2" },
      { id: "c", label: "C", value: "option-3" },
    ];

    expect(QuestionOptionsService.createOption(afterRemoval).value).toBe("option-4");
    expect(
      QuestionOptionsService.createOption([
        { id: "x", label: "X", value: "option-5" },
        { id: "y", label: "Y", value: "ja" },
      ]).value,
    ).toBe("option-6");
  });

  test("adds a copy without changing the original list", () => {
    const options = createOptions();
    const option: QuestionOption = {
      id: "other",
      label: "Annat",
      value: "other",
    };

    const result = QuestionOptionsService.addOption(options, option);

    expect(options).toHaveLength(3);
    expect(result).toHaveLength(4);
    expect(result[3]).toEqual(option);
    expect(result[3]).not.toBe(option);
  });

  test("uppdaterar endast det valda alternativet", () => {
    const options = createOptions();

    const result = QuestionOptionsService.updateOption(
      options,
      "no",
      "label",
      "Absolut inte"
    );

    expect(result[1]).toEqual({
      id: "no",
      label: "Absolut inte",
      value: "no",
    });
    expect(result[0]).toBe(options[0]);
    expect(options[1]?.label).toBe("Nej");
  });

  test("removes the right option when more than the minimum exist", () => {
    const result = QuestionOptionsService.removeOption(
      createOptions(),
      "no"
    );

    expect(result.map((option) => option.id)).toEqual(["yes", "maybe"]);
  });

  test("removing the option takes its translations along (in place, no sync)", () => {
    const options = [
      { id: "yes", label: { sv: "Ja", en: "Yes" }, value: "yes" },
      { id: "no", label: { sv: "Nej", en: "No" }, value: "no" },
      { id: "maybe", label: "Kanske", value: "maybe" },
    ];

    const result = QuestionOptionsService.removeOption(options, "no");

    // The {sv, en} label for "no" goes with the option — no orphaned
    // translation data is left to clean up.
    expect(result.some((option) => option.id === "no")).toBe(false);
    expect(JSON.stringify(result)).not.toContain("No");
  });

  test("keeps the smallest allowed number of options", () => {
    const options = createOptions().slice(0, 2);

    const result = QuestionOptionsService.removeOption(options, "yes");

    expect(result).toBe(options);
    expect(QuestionOptionsService.canRemoveOption(options)).toBe(false);
    expect(QuestionOptionsService.canRemoveOption(createOptions())).toBe(true);
  });

  test("moves an option up and down without changing the original list", () => {
    const options = createOptions();

    const movedUp = QuestionOptionsService.moveOption(options, "no", "up");
    const movedDown = QuestionOptionsService.moveOption(
      options,
      "no",
      "down"
    );

    expect(movedUp.map((option) => option.id)).toEqual([
      "no",
      "yes",
      "maybe",
    ]);
    expect(movedDown.map((option) => option.id)).toEqual([
      "yes",
      "maybe",
      "no",
    ]);
    expect(options.map((option) => option.id)).toEqual([
      "yes",
      "no",
      "maybe",
    ]);
  });

  test("does not move an option outside the list", () => {
    const options = createOptions();

    expect(QuestionOptionsService.moveOption(options, "yes", "up")).toBe(
      options
    );
    expect(QuestionOptionsService.moveOption(options, "maybe", "down")).toBe(
      options
    );
  });

  test("moves an option to a given, bounded index", () => {
    const options = createOptions();

    const moved = QuestionOptionsService.moveOptionToIndex(
      options,
      "yes",
      2
    );
    const bounded = QuestionOptionsService.moveOptionToIndex(
      options,
      "maybe",
      -10
    );

    expect(moved.map((option) => option.id)).toEqual([
      "no",
      "maybe",
      "yes",
    ]);
    expect(bounded.map((option) => option.id)).toEqual([
      "maybe",
      "yes",
      "no",
    ]);
  });

  test("changes nothing when the option's id is unknown", () => {
    const options = createOptions();

    expect(
      QuestionOptionsService.moveOption(options, "unknown", "down")
    ).toBe(options);
    expect(
      QuestionOptionsService.moveOptionToIndex(options, "unknown", 1)
    ).toBe(options);
    expect(
      QuestionOptionsService.updateOption(
        options,
        "unknown",
        "value",
        "new-value"
      )
    ).toEqual(options);
  });
});

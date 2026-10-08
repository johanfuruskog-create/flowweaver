import { isLocalizedTextMap } from "../core/localized-text";
import { PageVisibilityService } from "./page-visibility-service";

import type { Answers } from "../core/answer-values";
import type { FlowNodeData, QuestionOption } from "../types/graph";

export class QuestionOptionsService {
  /**
   * The question's options — all of them, or only the ones this visitor may
   * see.
   *
   * `answers` left out means *every* option, which is what the editor, the
   * canvas card and everything that describes the question rather than asks it
   * need. Handed the answers, an option with a condition is weighed by
   * `PageVisibilityService.isVisible` — the same evaluation a conditional
   * field goes through (story 134).
   */
  static getOptions(node: FlowNodeData, answers?: Answers): QuestionOption[] {
    const options = this.parseOptions(node.data.options);

    return answers ? this.visible(options, answers) : options;
  }

  /**
   * The same filter for a caller that already holds the parsed list — the
   * engine, which reads its options out of the node type's `optionsField`
   * rather than out of `data.options`.
   */
  static visible(options: QuestionOption[], answers: Answers): QuestionOption[] {
    return options.filter((option) => PageVisibilityService.isVisible(option, answers));
  }

  /** Whether the answers hide at least one option — what the visitor's row says. */
  static hasHidden(node: FlowNodeData, answers: Answers): boolean {
    return this.getOptions(node, answers).length < this.getOptions(node).length;
  }

  static parseOptions(value: unknown): QuestionOption[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((option): option is QuestionOption => {
      if (typeof option !== "object" || option === null) {
        return false;
      }

      const candidate = option as Record<string, unknown>;

      return (
        typeof candidate.id === "string" &&
        (typeof candidate.label === "string" ||
          isLocalizedTextMap(candidate.label)) &&
        typeof candidate.value === "string"
      );
    });
  }

  /**
   * A new option: an id of its own, an empty label and a value nobody has.
   *
   * The label is empty because the placeholder is the panel's to show —
   * *Nytt alternativ* until the redaktör writes something — and never the
   * model's (uppdrag 28/9 svarsalternativen). It was *Alternativ N*, Swedish
   * in any guide, saved as if somebody had written it.
   *
   * The value is one past the highest `option-N` there is, not the count plus
   * one: measured 28/9, three options, remove the first, add one, and the new
   * one got `option-3`, which the third already had. Nor is a gap filled — a
   * removed option's value may stand in answers already sent in, and a new
   * option under the same value would read as the old one there.
   */
  static createOption(options: QuestionOption[]): QuestionOption {
    const highest = options.reduce((most, option) => {
      const match = /^option-(\d+)$/.exec(option.value);

      return match ? Math.max(most, Number(match[1])) : most;
    }, options.length);

    return {
      id: crypto.randomUUID(),
      label: "",
      value: `option-${highest + 1}`,
    };
  }

  static addOption(
    options: QuestionOption[],
    option: QuestionOption
  ): QuestionOption[] {
    return [...options, structuredClone(option)];
  }

  static updateOption(
    options: QuestionOption[],
    optionId: string,
    property: "label" | "value",
    value: string
  ): QuestionOption[] {
    return options.map((option) => {
      if (option.id !== optionId) {
        return option;
      }

      return {
        ...option,
        [property]: value,
      };
    });
  }

  static removeOption(
    options: QuestionOption[],
    optionId: string,
    minimumOptions = 2
  ): QuestionOption[] {
    if (options.length <= minimumOptions) {
      return options;
    }

    return options.filter((option) => option.id !== optionId);
  }

  static canRemoveOption(
    options: QuestionOption[],
    minimumOptions = 2
  ): boolean {
    return options.length > minimumOptions;
  }

  static moveOption(
    options: QuestionOption[],
    optionId: string,
    direction: "up" | "down"
  ): QuestionOption[] {
    const currentIndex = options.findIndex((option) => option.id === optionId);

    if (currentIndex === -1) {
      return options;
    }

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= options.length) {
      return options;
    }

    const updatedOptions = [...options];

    const [movedOption] = updatedOptions.splice(currentIndex, 1);

    if (!movedOption) {
      return options;
    }

    updatedOptions.splice(targetIndex, 0, movedOption);

    return updatedOptions;
  }

  static moveOptionToIndex(
    options: QuestionOption[],
    optionId: string,
    targetIndex: number
  ): QuestionOption[] {
    const currentIndex = options.findIndex((option) => option.id === optionId);

    if (currentIndex === -1) {
      return options;
    }

    const boundedTargetIndex = Math.max(
      0,
      Math.min(targetIndex, options.length - 1)
    );

    if (currentIndex === boundedTargetIndex) {
      return options;
    }

    const updatedOptions = [...options];

    const [movedOption] = updatedOptions.splice(currentIndex, 1);

    if (!movedOption) {
      return options;
    }

    updatedOptions.splice(boundedTargetIndex, 0, movedOption);

    return updatedOptions;
  }
}

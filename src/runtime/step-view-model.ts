import type { Answers } from "../viewer/core/answer-values";
import { QuestionOptionsService } from "../viewer/services/question-options-service";
import { PageFieldsService } from "../viewer/services/page-fields-service";
import { TemplateVariableService } from "../viewer/services/template-variable-service";
import { stepBody } from "./step-bodies";
import { isEndingNodeType } from "../viewer/node-types/node-type-registry";
import { getSourceLocale, resolveText } from "../viewer/core/localized-text";
import { uiText } from "../viewer/core/ui-strings";

import type { FlowNodeData, GraphData } from "../viewer/types/graph";

/**
 * A view model is everything a client needs to render ONE step — and nothing
 * more. No formulas, no rule conditions, no graph. The server (the BFF) produces
 * it; the formulas stay there. See docs/RUNTIME-SECURITY.md.
 */
export interface StepFieldViewModel {
  variableName: string;
  label: string;
  /**
   * `lookup` is a text answer picked from a searched list. A consumer that does
   * not build its own combo box can treat it as `text` — the value is text.
   */
  /*
   * `rating` (story 115) is a number picked off a scale: `options` carries the
   * steps with their words, and a consumer that draws no scale can treat it as
   * `number`.
   */
  type: "text" | "number" | "choice" | "lookup" | "date" | "consent" | "file" | "rating";
  required: boolean;
  placeholder: string;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  options: Array<{ value: string; label: string }>;
}

interface StepBase {
  nodeId: string;
  stepNumber: number;
  canGoBack: boolean;
  title: string;
  description: string;
  /** Label for the step: "Resultat" for results, otherwise "Steg N" — localised. */
  stepLabel: string;
  /** Pre-resolved button texts in the user's language — the client never touches the graph. */
  labels: { next: string; back: string; restart: string };
}

export type StepViewModel =
  | (StepBase & { kind: "choice"; options: Array<{ id: string; label: string }> })
  | (StepBase & { kind: "number"; unit: string; min?: number; max?: number; step?: number })
  | (StepBase & { kind: "text"; placeholder: string; required: boolean; minLength?: number; maxLength?: number })
  | (StepBase & { kind: "page"; fields: StepFieldViewModel[] })
  | (StepBase & { kind: "result"; body: string })
  | { kind: "unsupported"; nodeId: string; stepNumber: number; canGoBack: boolean; nodeType: string };

export interface StepViewModelMeta {
  stepNumber: number;
  canGoBack: boolean;
}

const getNumber = (node: FlowNodeData, key: string): number | undefined =>
  typeof node.data[key] === "number" ? (node.data[key] as number) : undefined;

/**
 * Turns the current node into a formula-free view model. Title, description and
 * result text are resolved against the answers, so {{maxLån}} becomes
 * "2550000" — the final value shows, but never the formula behind it.
 */
export function toStepViewModel(
  node: FlowNodeData,
  answers: Answers,
  graph: GraphData,
  meta: StepViewModelMeta,
  locale?: string
): StepViewModel {
  const resolve = (value: string): string =>
    TemplateVariableService.resolve(value, answers, graph).resolved;

  /*
   * Resolution needs the guide's own source language, not the module's default.
   * An English-authored guide with a partial Swedish translation used to answer
   * a reader who asked for Arabic in Swedish — see `resolveText`.
   */
  const sourceLocale = getSourceLocale(graph);
  const text = (value: unknown, fallback = ""): string =>
    resolveText(value, locale, fallback, sourceLocale);

  const strings = graph.settings?.strings;
  const isResult = isEndingNodeType(node.type);
  const base: StepBase = {
    nodeId: node.id,
    stepNumber: meta.stepNumber,
    canGoBack: meta.canGoBack,
    title: resolve(text(node.data.title)),
    description: resolve(text(node.data.description)),
    stepLabel: isResult
      ? uiText("step.result", strings, locale)
      : `${uiText("step.number", strings, locale)} ${meta.stepNumber}`,
    labels: {
      // The next button: the node's own text → the guide's override → default.
      next:
        text(node.data.continueLabel) ||
        uiText("nav.next", strings, locale),
      back: uiText("nav.previous", strings, locale),
      restart: uiText("nav.restart", strings, locale),
    },
  };

  // A body registered from outside — the pro version's e-mail result (runtime/step-bodies.ts).
  const body = stepBody(node.type);
  if (body) {
    return { ...base, kind: "result", body: body(node, answers, graph, locale) ?? base.description };
  }

  switch (node.type) {
    case "question":
      return {
        ...base,
        kind: "choice",
        // With the answers, so an option held back by its own condition
        // (story 134) is not sent to a visitor the server is drawing for.
        options: QuestionOptionsService.getOptions(node, answers).map((option) => ({
          id: option.id,
          label: text(option.label),
        })),
      };

    case "number-question":
      return {
        ...base,
        kind: "number",
        unit: text(node.data.unit),
        min: getNumber(node, "min"),
        max: getNumber(node, "max"),
        step: getNumber(node, "step"),
      };

    case "text-question":
      return {
        ...base,
        kind: "text",
        placeholder: text(node.data.placeholder),
        required: node.data.required === true,
        minLength: getNumber(node, "minLength"),
        maxLength: getNumber(node, "maxLength"),
      };

    case "page":
      return {
        ...base,
        kind: "page",
        fields: PageFieldsService.getFields(graph, node, answers, locale).map((field) => ({
          variableName: field.variableName,
          label: field.label,
          type: field.type,
          required: field.required,
          placeholder: field.placeholder,
          unit: field.unit,
          min: field.min,
          max: field.max,
          step: field.step,
          options: field.options.map((option) => ({
            value: option.value,
            label: text(option.label),
          })),
        })),
      };

    case "result":
      return { ...base, kind: "result", body: base.description };


    default:
      return {
        kind: "unsupported",
        nodeId: node.id,
        stepNumber: meta.stepNumber,
        canGoBack: meta.canGoBack,
        nodeType: node.type,
      };
  }
}

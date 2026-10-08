/**
 * Looks for faults that make a guide broken for whoever has to use it.
 *
 * ## Why this and not `graph-validator`
 *
 * `validateGraph` checks that the *file* can be read: missing nodes, duplicate
 * ids, ports that do not exist. It also runs only on import and export.
 *
 * This checks that the *guide* works, and is meant to run while you build. An
 * option without a connection looks normal in the editor — the engine answers
 * `Svaret "…" leder inte vidare` only once a resident clicks it. The fault was
 * there all along, but was found by the wrong person at the wrong moment.
 *
 * ## Error or warning
 *
 * The line is drawn at the consequence:
 *
 * - **Error** — a resident is affected. They click and get nowhere, or see a
 *   text where a variable should have been.
 * - **Warning** — work nobody reaches. A node with no path to it harms no one;
 *   it is either started or forgotten, and both are the editor's call.
 *
 * That means a half-built guide does not scream red, while everything a resident
 * can walk into is visible.
 */

import { getNodeType } from "../../viewer/node-types/node-type-registry";
import { calloutKind } from "../../viewer/node-types/node-fields";
import { findLinkReferences } from "../../viewer/services/link-references";
import { isLinkReferenceDead } from "../core/link-picker-registry";
import { QuestionVariableService } from "../../viewer/services/question-variable-service";
import { QuestionOptionsService } from "../../viewer/services/question-options-service";
import { DEFAULT_UI_LOCALE, resolveText } from "../../viewer/core/localized-text";
import { dateBoundVariable } from "../../viewer/core/date-validator";
import { dateReferences, variableReferences } from "../../viewer/core/formula-evaluator";
import { TODAY_VARIABLE } from "../../viewer/core/date-math";
import { CalculationService } from "../../viewer/services/calculation-service";
import { ArrivalValueService } from "../../viewer/services/arrival-value-service";
import { isRealDate } from "../../viewer/core/date-math";

import { RuleCasesService } from "../../viewer/services/rule-cases-service";
import { interpolate, t } from "../localization/editor-ui-strings";

import type { ConditionalVisibility, FlowNodeData, GraphData } from "../../viewer/types/graph";

export type GuideHealthCode =
  /** Ett svarsalternativ leder ingenstans. */
  | "dead-option"
  /** A rule reads a variable no node sets. */
  | "unset-rule-variable"
  /** A rule case the viewer cannot use, so the rule branches past it. */
  | "ignored-rule-case"
  /** A text prints a variable no node sets. */
  | "unset-template-variable"
  /** A result cannot be reached from the start node. */
  | "unreachable-result"
  /** A node cannot be reached from the start node. */
  | "unreachable-node"
  /** A page has no fields and therefore asks nothing. */
  | "empty-page"
  /** An email result still holds a pre-v7 free-text recipient. */
  | "legacy-email-recipient"
  /** A recipient id the host's catalog no longer lists. */
  | "stale-recipient"
  /* Ett id i listan som katalogen inte känner igen — story 056. */
  | "unknown-recipient"
  /* Kopia vald utan huvudmottagare: någon måste äga ärendet. */
  | "copy-without-recipient"
  /** A submit-result with no recipient chosen — the guide's own fact, not the catalog's. */
  | "no-recipient-chosen"
  /** emailCopy is on but emailVariable is blank or no question sets it — the receipt is never sent. */
  | "broken-email-copy"
  /** A reachable submit-result with no review node anywhere in the graph. */
  | "submit-without-review"
  /** A repeating page with no word for what repeats — the viewer has no "Barn 1", no "Lägg till …". */
  | "repeat-without-word"
  /** A repeating page with no list variable — the answers have nowhere to land. */
  | "repeat-without-variable"
  /** *Varje upprepning ska välja olika* on a question that is not on a repeating page (story 138). */
  | "unique-outside-repeat"
  /** A date bound points at a variable no question sets (story 087). */
  | "date-bound-unset"
  /** A date bound points at a question that is not a date. */
  | "date-bound-not-date"
  /** A date bound points at a question asked after the field it bounds. */
  | "date-bound-after"
  /** `age`/`days` given a variable no question sets (story 086). */
  | "date-argument-unset"
  /** `age`/`days` given a question that is neither a date nor a personnummer. */
  | "date-argument-not-date"
  /** A variable's name or type changed after the submission schema was exported (story 094). */
  | "stale-submission-schema"
  /** A calculation in a page reads a variable asked after the page (story 095). */
  | "calculation-reads-later"
  /** A calculation in a page reads a field that is empty when the visitor arrives (story 118). */
  | "calculation-reads-empty"
  /** A date start value that is not a date, not "idag" and not a variable (story 118). */
  | "start-value-not-date"
  /** Touching is demanded of a field that shows nothing to touch (story 118). */
  | "interaction-without-value"
  /** A number field shown as a slider without both ends. */
  | "slider-without-range"
  /** A slider with more than a thousand positions between its ends. */
  | "slider-too-fine"
  /** A connection back to a step already passed — the visitor can go round without getting on. */
  | "flow-loop"
  /** A Text shown as a box (story 096) with neither heading nor text: an empty frame. */
  | "empty-callout"
  /** A link whose page the host says no longer exists (story 100). */
  | "dead-link"
  /** An example photo with nothing said about what it shows (story 108). */
  | "example-image-without-alt"
  /** A conditional field whose condition can never hold when the page is drawn (story 134). */
  | "field-never-visible"
  /** A conditional option whose condition can never hold when the question is drawn (story 134). */
  | "option-never-visible"
  /** Two nodes save under one variable name and both can be answered in the same visit (24/9). */
  | "variable-name-clash"
  /** An answer option with no text in any of the guide's languages (Johan 28/9). */
  | "option-without-text";

export interface GuideHealthIssue {
  code: GuideHealthCode;
  severity: "error" | "warning";
  /** The node the problem concerns, so the list can lead there. */
  nodeId: string;
  /**
   * The field on that node the problem is about, when the check can name one
   * — so a list can put the cursor in it and not only on the card.
   *
   * Optional because most checks cannot: `flow-loop` is about a connection,
   * `unreachable-node` about the graph. It exists because a field can be
   * *hidden* on the node it belongs to — the panel folds *Spara svaret som*,
   * *Variabeletikett* and *CSS-klasser* under **Avancerat** — and a journey
   * that ends on a card with the destination folded away ends in nothing
   * (Johans beslut 23/9 2026). `revealNode` hands it to the panel's
   * `focusField`, which unfolds the group when the field is in it.
   *
   * The first check to set it is `variable-name-clash` (24/9), on
   * `variableName`. Read 23/9, none of the 34 codes before it was about a
   * field under Avancerat; the only clash the editor knew of was page-local
   * passive text on the page node, which led nowhere and was removed when
   * this check took its place (Johan 24/9).
   */
  field?: string;
  /** What is wrong, in the editor's language. */
  message: string;
}

/**
 * Finds `{{variabel}}` in a text. The same shape the template resolver uses —
 * except after a backslash, which the viewer reads as braces written as text
 * (`FormattedTextService`, 25/9), not as an answer.
 */
const TEMPLATE_PATTERN = /(?<!\\){{\s*([^{}]+?)\s*}}/g;

/**
 * What the analysis needs to know about the editor it runs in. Both optional:
 * without them — publishing, the design ground — the messages are Swedish
 * and nothing is being written.
 */
export interface GuideHealthContext {
  /**
   * The editor's UI language, for the checks whose message lives in
   * editor-strings. The older checks still write Swedish directly.
   */
  locale?: string;
  /**
   * The option whose text field has the cursor. Its empty label is work in
   * progress, not a fault: warning about it would come with every new option
   * and sit there while the first letter is typed.
   */
  writingOptionId?: string | null;
}

/** A rule registered from outside — see `GuideHealthService.registerRule`. */
export type GuideHealthRule = (graph: GraphData, context: GuideHealthContext) => GuideHealthIssue[];

export class GuideHealthService {
  static analyze(graph: GraphData, context: GuideHealthContext = {}): GuideHealthIssue[] {
    return [
      ...this.deadOptions(graph),
      ...this.unsetVariables(graph),
      ...this.ignoredRuleCases(graph),
      ...this.emptyPages(graph),
      ...this.repeatingPages(graph),
      ...this.uniqueOutsideRepeat(graph),
      ...this.dateBounds(graph),
      ...this.dateArguments(graph),
      ...this.pageCalculations(graph),
      ...this.arrivalValues(graph, context),
      ...this.sliders(graph),
      ...this.emptyCallouts(graph),
      ...this.exampleImages(graph),
      ...this.loops(graph),
      ...this.unreachable(graph),
      ...this.deadLinks(graph),
      ...this.neverVisible(graph),
      ...this.variableNameClashes(graph),
      ...this.optionsWithoutText(graph, context),
      ...this.registeredIssues(graph, context),
    ];
  }

  /**
   * Rules registered from outside — the extension point (open-core step 3c,
   * 2026-10-06). The full version's checks (recipients, the review nudge, the
   * stale submission schema) live in `submission-health-rules.ts` and
   * register themselves; this file never imports the receiver registry. One
   * rule per id: registering an id again replaces, so a module that is
   * imported twice does not double its warnings.
   */
  private static readonly rules = new Map<string, GuideHealthRule>();

  static registerRule(id: string, rule: GuideHealthRule): void {
    this.rules.set(id, rule);
  }

  static unregisterRule(id: string): void {
    this.rules.delete(id);
  }

  private static registeredIssues(graph: GraphData, context: GuideHealthContext): GuideHealthIssue[] {
    return [...this.rules.values()].flatMap((rule) => rule(graph, context));
  }

  /**
   * An answer option with no text (Johan 28/9: "Då varnar vi för det"). The
   * visitor gets a row with nothing to read beside the button. A warning, not
   * an error: the option can still be chosen and leads on.
   *
   * "No text" means in *any* of the guide's languages — the viewer falls back
   * to another language before it shows nothing, and a missing translation is
   * the translation progress's to count, not this. The number is the option's
   * place in the list, from 1, so the editor finds the row in the panel.
   */
  private static optionsWithoutText(graph: GraphData, context: GuideHealthContext): GuideHealthIssue[] {
    const locale = context.locale ?? DEFAULT_UI_LOCALE;

    return graph.nodes.flatMap((node) =>
      QuestionOptionsService.getOptions(node).flatMap((option, index): GuideHealthIssue[] => {
        if (option.id === context.writingOptionId) return [];
        if (resolveText(option.label, undefined, "").trim() !== "") return [];

        return [{
          code: "option-without-text",
          severity: "warning",
          nodeId: node.id,
          message: interpolate(t("editor.health.optionWithoutText", locale), {
            node: this.label(node),
            n: index + 1,
          }),
        }];
      }),
    );
  }

  /**
   * A link to a page the host has said is gone (story 100). Only where a
   * host answers: the library fetches nothing, so a link without the host's
   * reference — or a host without `resolve` — is never judged. The answer
   * is read from the registry's memory, filled when the guide was opened;
   * the analysis stays synchronous. One warning per node, however many
   * links on it are dead — the editor opens the node and sees them all.
   */
  private static deadLinks(graph: GraphData): GuideHealthIssue[] {
    const nodeIds = new Set(
      findLinkReferences(graph)
        .filter((link) => isLinkReferenceDead(link.ref))
        .map((link) => link.nodeId),
    );

    return graph.nodes
      .filter((node) => nodeIds.has(node.id))
      .map((node) => ({
        code: "dead-link" as const,
        severity: "warning" as const,
        nodeId: node.id,
        message: `"${this.label(node)}": sidan länken pekar på finns inte längre.`,
      }));
  }

  /** A short name for a node, for the messages. Static, not private: the registered rules use it too. */
  static label(node: FlowNodeData): string {
    const title = resolveText(node.data.title, undefined, "").trim();
    return title.length > 0 ? title : node.id;
  }

  /**
   * Exits without a connection.
   *
   * This is the fault a resident actually walks into: the option is visible,
   * selectable, and then it ends.
   */
  private static deadOptions(graph: GraphData): GuideHealthIssue[] {
    const issues: GuideHealthIssue[] = [];

    graph.nodes.forEach((node) => {
      // Children of a Page have no exits of their own — the page carries the flow on.
      if (node.parentPageId) {
        return;
      }

      const definition = getNodeType(node.type);

      if (!definition) {
        return;
      }

      definition.getOutputs(node).forEach((port) => {
        if (port.valueType !== "flow") {
          return;
        }

        const connected = graph.connections.some(
          (connection) =>
            connection.from.nodeId === node.id &&
            connection.from.portId === port.id,
        );

        if (!connected) {
          issues.push({
            code: "dead-option",
            severity: "error",
            nodeId: node.id,
            message: `"${this.label(node)}": svaret "${port.label || port.id}" leder inte vidare.`,
          });
        }
      });
    });

    return issues;
  }

  /**
   * Pages without fields.
   *
   * Such a page shows its heading and a Continue button — an information page.
   * That may be deliberate, an introduction, but it is also exactly what you get
   * if you forgot to add the fields.
   *
   * A warning and not an error: the resident moves on, they are simply not
   * asked anything.
   */
  private static emptyPages(graph: GraphData): GuideHealthIssue[] {
    return graph.nodes
      .filter((node) => node.type === "page" && !node.parentPageId)
      .filter(
        (page) =>
          !graph.nodes.some((candidate) => candidate.parentPageId === page.id),
      )
      .map((page) => ({
        code: "empty-page" as const,
        severity: "warning" as const,
        nodeId: page.id,
        message: `"${this.label(page)}": sidan har inga fält och frågar därför ingenting.`,
      }));
  }

  /**
   * A page that repeats (story 084) needs two words: the one the visitor sees
   * ("Barn 1", "Lägg till barn") and the one the guide's rules and templates
   * read (`barn`, `barn.count`). Without the first the viewer would have to
   * invent a heading; without the second the answers have no name to land
   * under. Both errors, not warnings: neither page can be shown as intended.
   */
  private static repeatingPages(graph: GraphData): GuideHealthIssue[] {
    const blank = (raw: unknown): boolean =>
      resolveText(raw as string | undefined, undefined, "").trim().length === 0;

    return graph.nodes
      .filter((node) => node.type === "page" && node.data.repeats === true)
      .flatMap((page): GuideHealthIssue[] => [
        ...(blank(page.data.repeatWord)
          ? [{
              code: "repeat-without-word" as const,
              severity: "error" as const,
              nodeId: page.id,
              message: `"${this.label(page)}": sidan upprepas men saknar ord för vad som upprepas.`,
            }]
          : []),
        ...(typeof page.data.repeatVariable !== "string" || page.data.repeatVariable.trim() === ""
          ? [{
              code: "repeat-without-variable" as const,
              severity: "error" as const,
              nodeId: page.id,
              message: `"${this.label(page)}": sidan upprepas men listan har inget variabelnamn.`,
            }]
          : []),
      ]);
  }

  /**
   * *Varje upprepning ska välja olika* left on a question whose page does
   * not repeat (story 138, criterion 7) — it happens when a question is
   * moved off the page, or the page's repetition is switched off. The panel
   * no longer shows the setting there, so this is the only place it is said.
   * A warning: the guide works, the setting simply does nothing.
   */
  private static uniqueOutsideRepeat(graph: GraphData): GuideHealthIssue[] {
    return graph.nodes
      .filter((node) => node.data.uniqueAcrossRepeats === true)
      .filter((node) => {
        const page = graph.nodes.find((candidate) => candidate.id === node.parentPageId);
        return page?.type !== "page" || page.data.repeats !== true;
      })
      .map((node) => ({
        code: "unique-outside-repeat" as const,
        severity: "warning" as const,
        nodeId: node.id,
        message: `"${this.label(node)}": Varje upprepning ska välja olika är på, men frågan sitter inte på en sida som upprepas.`,
      }));
  }

  /**
   * Variable names some node actually sets: the questions' own, and the list
   * a repeating page collects its answers in. The options only offer the
   * list's `.count` (a rule cannot compare a list), but a text prints the
   * whole list — {{blankett}} is set, by the page.
   */
  static definedVariables(graph: GraphData): Set<string> {
    const lists = graph.nodes
      .filter((node) => node.type === "page" && node.data.repeats === true)
      .map((page) => (typeof page.data.repeatVariable === "string" ? page.data.repeatVariable.trim() : ""));
    return new Set(
      [...QuestionVariableService.getOptions(graph).map((option) => option.value), ...lists]
        .filter((name) => name.length > 0),
    );
  }

  /**
   * Variables that are read but never set.
   *
   * This is what happens when a variable name changes: the rule silently points
   * at the old one, the condition is never true, and the resident ends up in the
   * otherwise branch with nobody understanding why.
   */
  /**
   * A rule case the viewer will not use — and the rule that branches past it.
   *
   * The viewer drops a case it cannot read rather than stopping a guide
   * somebody is standing in, which is right. What is not right is that it does
   * it in silence: a rule whose cases were all dropped takes its fallback for
   * every visitor, with every variable holding the correct value and nothing
   * on screen looking wrong. Measured 14/9 on a hand-written label as
   * `{ sv, en }` — PRAXIS 5's line, walked into again by somebody who had read
   * it the day before.
   *
   * The judgement comes from `RuleCasesService.partitionCases`, the same
   * reading the viewer does. Asking "is the label a string?" a second time here
   * would leave one definition of a valid case in two files.
   *
   * The message says what happens **to the visitor**, not what is wrong with
   * the data: an editor can act on "everyone is sent down the other branch" and
   * can do nothing with "label is not a string".
   */
  private static ignoredRuleCases(graph: GraphData): GuideHealthIssue[] {
    const issues: GuideHealthIssue[] = [];

    graph.nodes.forEach((node) => {
      if (node.type !== "rule") return;

      const { cases, rejected } = RuleCasesService.partitionCases(node.data.cases);

      rejected.forEach((one) => {
        const which = one.id ? `"${one.id}"` : `nummer ${one.index + 1}`;
        const consequence =
          cases.length === 0
            ? "Regeln har därför inga fall kvar, så varje besökare skickas vidare på reservvägen."
            : "Besökare som skulle ha tagit den vägen skickas vidare på en annan.";

        issues.push({
          code: "ignored-rule-case",
          severity: "error",
          nodeId: node.id,
          message: `"${this.label(node)}": regelfallet ${which} går inte att använda och hoppas över. ${consequence}`,
        });
      });
    });

    return issues;
  }

  private static unsetVariables(graph: GraphData): GuideHealthIssue[] {
    const defined = this.definedVariables(graph);
    const issues: GuideHealthIssue[] = [];

    graph.nodes.forEach((node) => {
      // Regelvillkor.
      const cases = node.data.cases;

      if (Array.isArray(cases)) {
        cases.forEach((ruleCase) => {
          const conditions = (ruleCase as { conditions?: unknown }).conditions;

          if (!Array.isArray(conditions)) {
            return;
          }

          conditions.forEach((condition) => {
            const name = (condition as { variableName?: unknown }).variableName;

            if (
              typeof name === "string" &&
              name.trim().length > 0 &&
              !defined.has(name)
            ) {
              issues.push({
                code: "unset-rule-variable",
                severity: "error",
                nodeId: node.id,
                message: `"${this.label(node)}": villkoret läser variabeln "${name}" som ingen fråga sätter.`,
              });
            }
          });
        });
      }

      // Variables in texts. Every string field is walked — a variable can sit
      // in a description, a result or an email draft.
      this.templateNames(node).forEach((field, name) => {
        if (!defined.has(name)) {
          issues.push({
            code: "unset-template-variable",
            severity: "error",
            nodeId: node.id,
            // The property the text is in — the list puts the cursor there
            // and the field selects the chip (story 136, criterion 14).
            field,
            message: `"${this.label(node)}": texten skriver ut "${name}" som ingen fråga sätter.`,
          });
        }
      });
    });

    return issues;
  }

  /** Variabelnamn som nodens texter skriver ut, och egenskapen där det står först. */
  private static templateNames(node: FlowNodeData): Map<string, string> {
    const names = new Map<string, string>();

    const scan = (value: unknown, field: string): void => {
      if (typeof value === "string") {
        for (const match of value.matchAll(TEMPLATE_PATTERN)) {
          const name = match[1]?.trim();

          if (name && name.length > 0 && !names.has(name)) {
            names.set(name, field);
          }
        }
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => scan(item, field));
        return;
      }

      if (value !== null && typeof value === "object") {
        Object.values(value).forEach((item) => scan(item, field));
      }
    };

    /*
     * A date bound that points at a variable — `min: "{{fran}}"` — is
     * `dateBounds`' business, with its own three messages. Scanning it here
     * too would report the same fault twice, in the wrong words.
     */
    const { min, max, ...rest } = node.data;
    Object.entries(node.type === "date-question" ? rest : node.data).forEach(([field, value]) => scan(value, field));
    void min;
    void max;

    return names;
  }

  /**
   * The answers set by the time the visitor stands on `node`: on some path
   * there, uncertain counting as set — the reachability rule. Johan 25/9, from
   * Fia's pictures: a heading offered an answer asked further on, a chip the
   * visitor always sees empty. `askedBefore` picks the nodes, `definedVariables`
   * names what they set; no walk of its own. A field on the same page counts
   * (`askedBefore`'s rule — a calculation on the page runs as it is filled in),
   * and `idag` is always set.
   */
  static variablesSetBefore(graph: GraphData, node: FlowNodeData): Set<string> {
    const askedBefore = this.askedBefore(graph);

    return this.definedVariables({ ...graph, nodes: graph.nodes.filter((other) => askedBefore(other, node)) });
  }

  /**
   * "Before" is a walk backwards over the connections from the field's own
   * step (its page, when it sits on one). Two fields on the same page are
   * checked together at *Nästa*, so there the order is free. Shared by the
   * date bounds (story 087) and the calculation in a page (story 095).
   */
  private static askedBefore(graph: GraphData): (source: FlowNodeData, field: FlowNodeData) => boolean {
    const incoming = new Map<string, string[]>();

    graph.connections.forEach((connection) => {
      const to = connection.to.nodeId;
      incoming.set(to, [...(incoming.get(to) ?? []), connection.from.nodeId]);
    });

    const step = (node: FlowNodeData): string => node.parentPageId ?? node.id;

    return (source, field) => {
      if (step(source) === step(field)) {
        return source.parentPageId !== undefined;
      }

      const seen = new Set<string>();
      const queue = [step(field)];

      while (queue.length > 0) {
        (incoming.get(queue.pop() as string) ?? []).forEach((previous) => {
          if (!seen.has(previous)) {
            seen.add(previous);
            queue.push(previous);
          }
        });
      }

      return seen.has(step(source));
    };
  }

  /**
   * Two nodes that save their answer under the same name, where both can be
   * answered in the same visit (Johan 24/9). The same name on branches that
   * exclude each other is how a guide is built — *Har du barn?* on the path
   * for renting and on the path for owning, both `harBarn` so the rule after
   * reads one name — and is left alone. What is flagged is B reached from A:
   * the later answer overwrites the earlier without anyone seeing it.
   *
   * "Reached from" is `askedBefore`, so a field counts as its page and two
   * fields on the same page clash too; there the page's `order` says which is
   * later. A warning, not an error: an overwrite can be meant (*Vill du ändra
   * ditt svar?*), and an error would stop publishing.
   *
   * One flag per node that has an earlier namesake, on the LATER node — that
   * is where the editor renames — naming the nearest earlier one. Three on a
   * path give two flags (B against A, C against B), and A reaching B by four
   * paths gives one. `field` leads the list into *Spara svaret som*, which the
   * panel keeps under Avancerat.
   */
  private static variableNameClashes(graph: GraphData): GuideHealthIssue[] {
    const askedBefore = this.askedBefore(graph);
    const reached = this.reachableNodeIds(graph);
    const name = (node: FlowNodeData): string =>
      typeof node.data.variableName === "string" ? node.data.variableName.trim() : "";
    const onPath = (node: FlowNodeData): boolean => !reached || reached.has(node.parentPageId ?? node.id);
    /*
     * Both directions hold on one page (answered together at *Nästa*) and in
     * a loop (which `flow-loop` reports). The page's order breaks the first;
     * the graph's own order the second, so a pair is still flagged once.
     */
    const earlier = (a: FlowNodeData, b: FlowNodeData): boolean => {
      if (!askedBefore(a, b)) return false;
      if (!askedBefore(b, a)) return true;
      if (a.parentPageId !== undefined && a.parentPageId === b.parentPageId && a.order !== b.order) {
        return (a.order ?? 0) < (b.order ?? 0);
      }
      return graph.nodes.indexOf(a) < graph.nodes.indexOf(b);
    };

    return graph.nodes
      .filter((node) => name(node) !== "" && onPath(node))
      .flatMap((node): GuideHealthIssue[] => {
        const before = graph.nodes.filter(
          (other) => other !== node && name(other) === name(node) && onPath(other) && earlier(other, node),
        );
        if (before.length === 0) return [];
        const nearest = before.reduce((best, other) => (earlier(best, other) ? other : best));

        return [{
          code: "variable-name-clash",
          severity: "warning",
          nodeId: node.id,
          field: "variableName",
          message: `"${this.label(node)}": sparar svaret som "${name(node)}", som "${this.label(nearest)}" tidigare på samma väg också sparar — det senare svaret skriver över det förra. Ge en av dem ett annat namn.`,
        }];
      });
  }

  /**
   * A connection that leads back to a step the visitor has already passed
   * (2026-09-06, Johan: "Det skulle ju innebära att det pågår i evigheter").
   * The engine stops a cycle only among the automatic nodes — rule, calculation,
   * service call — because it walks those without stopping; a loop through a
   * question just shows the question again, every round, with nothing to say
   * it. A step leading to itself counts; two branches meeting further on do
   * not. One warning per connection, on the node it leaves.
   */
  private static loops(graph: GraphData): GuideHealthIssue[] {
    /*
     * Which connection is the one going back? In a cycle every edge is
     * upstream of every other, so `askedBefore` cannot say; and the order
     * steps are reached from the start cannot either — a step reached first
     * on one branch may be reached again, forwards, from another. What can:
     * walking depth-first from the start, a connection to a step still on
     * the way down is the way round. Every cycle gets at least one.
     */
    const outgoing = new Map<string, typeof graph.connections>();
    graph.connections.forEach((connection) => {
      outgoing.set(connection.from.nodeId, [...(outgoing.get(connection.from.nodeId) ?? []), connection]);
    });
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    const onTheWayDown = new Set<string>();
    const done = new Set<string>();
    const back: typeof graph.connections = [];

    const walk = (id: string): void => {
      if (done.has(id)) return;
      onTheWayDown.add(id);
      for (const connection of outgoing.get(id) ?? []) {
        if (onTheWayDown.has(connection.to.nodeId)) back.push(connection);
        else walk(connection.to.nodeId);
      }
      onTheWayDown.delete(id);
      done.add(id);
    };
    if (graph.startNodeId) walk(graph.startNodeId);

    return back.flatMap((connection) => {
      const from = byId.get(connection.from.nodeId);
      const to = byId.get(connection.to.nodeId);
      if (!from || !to) return [];

      return [{
        code: "flow-loop" as const,
        severity: "warning" as const,
        nodeId: from.id,
        message: `"${this.label(from)}" leder tillbaka till "${this.label(to)}", som redan är ställd — besökaren kan gå runt utan att komma vidare.`,
      }];
    });
  }

  /**
   * A calculation in a page runs on every change to the page (story 095), so
   * a variable it reads has to be answered by then: on the page itself, or
   * before it. One asked after the page leaves the text under the calculation
   * showing nothing, and the editor sees a formula that looks right. A name no
   * node sets at all is not this rule's — the evaluator reports it when it
   * runs.
   */
  private static pageCalculations(graph: GraphData): GuideHealthIssue[] {
    const askedBefore = this.askedBefore(graph);
    const setBy = (name: string): FlowNodeData | undefined =>
      graph.nodes.find(
        (node) =>
          node.data.variableName === name ||
          (node.type === "calculation" && CalculationService.getProducedVariables(node).includes(name)),
      );

    return graph.nodes
      .filter((node) => node.type === "calculation" && node.parentPageId !== undefined)
      .flatMap((calculation) => {
        const names = new Set(
          CalculationService.getAssignments(calculation).flatMap((assignment) => variableReferences(assignment.formula)),
        );

        return [...names].flatMap((name): GuideHealthIssue[] => {
          const source = setBy(name);

          return source && source.id !== calculation.id && !askedBefore(source, calculation)
            ? [{
                code: "calculation-reads-later",
                severity: "error",
                nodeId: calculation.id,
                message: `"${this.label(calculation)}": uträkningen läser "${name}" som frågas efter sidan — då räknas den inte om medan besökaren svarar.`,
              }]
            : [];
        });
      });
  }

  /**
   * What the visitor meets on a page before answering anything, and the three
   * ways a start value can be set wrong (story 118, criterion 8).
   *
   * **Why this exists, and why it could not be built earlier.** Story 095's
   * normal form is a page that counts while you answer — and measured across
   * the bundled guides, four of four such pages read a field that is empty on
   * arrival, so the box shows a dash until the visitor has answered. Johan's
   * choice 13/9, over making the slider start in the middle and over touching
   * the required checkbox: *the tool should say so, not invent an answer.*
   * A warning nobody can act on is the kind people learn not to read, so this
   * was built in the same round as the start value and never before it.
   *
   * The arrival picture is `ArrivalValueService.forPage` called with no
   * answers — the one answer to *what does the field show on arrival?*, the
   * same function the viewer fills the page with. A second opinion here is
   * exactly how the two would drift.
   */
  private static arrivalValues(graph: GraphData, context: GuideHealthContext): GuideHealthIssue[] {
    const locale = context.locale ?? DEFAULT_UI_LOCALE;
    const askedBefore = this.askedBefore(graph);
    /*
     * *Before the page*, which is stricter than `askedBefore` on its own: that
     * one counts two fields on the same page as ordered, because a page is
     * judged in one go at *Nästa*. An arrival value is read when the page is
     * DRAWN, and nothing on the page has been answered yet then.
     */
    const answeredOnArrival = (source: FlowNodeData, field: FlowNodeData): boolean =>
      (source.parentPageId ?? source.id) !== (field.parentPageId ?? field.id) &&
      askedBefore(source, field);

    /*
     * A date start value pointing at a variable answered before the page fills
     * the field the moment the page is drawn, out of an answer the visitor has
     * already given. `ArrivalValueService` cannot say so here: it resolves the
     * variable out of the answers, and a health check has no visitor. So the
     * question is asked of the GRAPH instead of of a value — which is the only
     * thing an editor could be told about anyway.
     */
    const filledFromEarlier = (node: FlowNodeData): boolean => {
      const variable = dateBoundVariable(
        typeof node.data.startValue === "string" ? node.data.startValue : undefined,
      );

      if (variable === null) return false;
      if (variable === TODAY_VARIABLE) return true;

      const source = graph.nodes.find(
        (candidate) => candidate.id !== node.id && candidate.data.variableName === variable,
      );

      return source !== undefined && answeredOnArrival(source, node);
    };

    const issues: GuideHealthIssue[] = [];

    /*
     * 1. A calculation on a page reading a field of that page that shows
     *    nothing yet. Variables from earlier pages are answered by now and are
     *    not this rule's; one asked AFTER the page is `calculation-reads-later`,
     *    next door, and a name nothing sets at all belongs to the evaluator.
     *
     * The message says what the VISITOR sees, not what is wrong in the graph:
     * *"calculation reads empty field"* is a code, and the editor has to be
     * able to picture the dash in the box.
     */
    graph.nodes
      .filter((node) => node.type === "calculation" && node.parentPageId !== undefined)
      .forEach((calculation) => {
        const page = graph.nodes.find((candidate) => candidate.id === calculation.parentPageId);

        if (!page) return;

        const arrival = ArrivalValueService.forPage(graph.nodes, page);
        const names = new Set(
          CalculationService.getAssignments(calculation).flatMap((assignment) =>
            variableReferences(assignment.formula),
          ),
        );

        names.forEach((name) => {
          const field = graph.nodes.find(
            (candidate) =>
              candidate.parentPageId === page.id && candidate.data.variableName === name,
          );

          if (!field || arrival[name] !== undefined || filledFromEarlier(field)) return;

          issues.push({
            code: "calculation-reads-empty",
            severity: "warning",
            nodeId: calculation.id,
            message: interpolate(t("editor.health.calculationReadsEmpty", locale), {
              node: this.label(calculation),
              name,
            }),
          });
        });
      });

    graph.nodes
      .filter((node) => node.type === "date-question" || node.type === "number-question")
      .forEach((node) => {
        const start = node.data.startValue;

        /*
         * 2. A date start value that is none of the three spellings the reader
         *    knows. `resolveDateBound` hands an unknown word back unchanged, so
         *    it lands in the field as the visitor's answer and nothing says a
         *    word — PRAXIS 35's fault, and an error because a visitor is
         *    affected.
         *
         * The variable spelling is checked by `dateBounds`, through the same
         * three codes the bounds use: the fault is the same fault, and three
         * more codes for it would be the second copy this file exists to avoid.
         */
        if (
          node.type === "date-question" &&
          typeof start === "string" &&
          start.trim() !== "" &&
          dateBoundVariable(start) === null &&
          !["idag", "i dag", "today"].includes(start.trim().toLowerCase()) &&
          !isRealDate(start.trim())
        ) {
          issues.push({
            code: "start-value-not-date",
            severity: "error",
            nodeId: node.id,
            message: `"${this.label(node)}": startvärdet "${start.trim()}" är inget datum — skriv ÅÅÅÅ-MM-DD, idag, eller en variabel med ett datum.`,
          });
        }

        /*
         * 3. *Fråga om fältet inte rörts* on a field that shows nothing to
         *    touch. The setting exists so a value nobody chose is asked about
         *    before it counts as an answer; with no start value and no slider
         *    there is no such value, `required` already refuses an empty
         *    field, and the question is never put.
         *
         * A warning and not a quieter level, because this list has no quieter
         * level and should not grow one for a single case: everything in it is
         * something to fix, and a setting that is on and does nothing is
         * something to fix.
         */
        const hasStart =
          (node.type === "number-question" && typeof start === "number" && Number.isFinite(start)) ||
          (node.type === "date-question" && typeof start === "string" && start.trim() !== "");
        const isSlider =
          node.data.presentation === "range" &&
          typeof node.data.min === "number" &&
          typeof node.data.max === "number";

        if (node.data.requireInteraction === true && !hasStart && !isSlider) {
          issues.push({
            code: "interaction-without-value",
            severity: "warning",
            nodeId: node.id,
            message: `"${this.label(node)}": frågan om fältet inte rörts ställs aldrig här — fältet är tomt vid ankomst, och "obligatoriskt" stoppar redan den som inte svarar.`,
          });
        }
      });

    return issues;
  }

  /**
   * The slider (story 095) has nothing to draw without both ends, and walks
   * `step` at a time: 10 000–800 000 with the default step of 1 is 790 000
   * positions on a thumb-wide track — a krona a pixel ("så vi inte kör på
   * t.ex. kr, en krona i taget"). Positions are what is judged, not the step
   * itself: a step of 5 over a million is the same fault, and the panel's
   * defaults (0–120, step 1) must not warn the moment the slider is chosen —
   * that was the first version, and it nagged for having done nothing yet.
   * A thousand is the line. The − / + buttons walk one at a time by design
   * and are not judged.
   */
  private static sliders(graph: GraphData): GuideHealthIssue[] {
    const number = (value: unknown): number | null =>
      typeof value === "number" && Number.isFinite(value) ? value : null;

    return graph.nodes
      .filter((node) => node.type === "number-question" && node.data.presentation === "range")
      .flatMap((node): GuideHealthIssue[] => {
        const min = number(node.data.min);
        const max = number(node.data.max);

        if (min === null || max === null) {
          return [{
            code: "slider-without-range",
            severity: "warning",
            nodeId: node.id,
            message: `"${this.label(node)}": reglaget har inget spann — sätt lägsta och högsta värde.`,
          }];
        }

        const step = number(node.data.step) ?? 1;
        const positions = step > 0 ? Math.floor((max - min) / step) : Infinity;
        const sv = (value: number): string => new Intl.NumberFormat("sv-SE").format(value);

        return positions > 1000
          ? [{
              code: "slider-too-fine",
              severity: "warning",
              nodeId: node.id,
              message: `"${this.label(node)}": reglaget har ${sv(positions)} lägen mellan ${sv(min)} och ${sv(max)} — sätt ett större steg.`,
            }]
          : [];
      });
  }

  /**
   * A box with nothing in it (story 096) is a coloured frame and the word
   * *Viktigt* — a warning about nothing. Same pattern as the slider without
   * a span: the choice was made, the content was not. A plain Text that is
   * empty is not judged here; it draws nothing and misleads no one.
   */
  private static emptyCallouts(graph: GraphData): GuideHealthIssue[] {
    const blank = (text: unknown): boolean => resolveText(text, undefined, "").trim().length === 0;

    return graph.nodes
      .filter((node) => node.type === "page-heading" && calloutKind(node) !== null)
      .filter((node) => blank(node.data.title) && blank(node.data.description))
      .map((node) => ({
        code: "empty-callout" as const,
        severity: "warning" as const,
        nodeId: node.id,
        message: `"${this.label(node)}": rutan är tom — skriv en rubrik eller en text, eller visa den som text.`,
      }));
  }

  /**
   * An example photo without a word about what it shows (story 108).
   *
   * The address alone is half a picture: a run on the canvas draws it, a
   * visitor may attach it, and whoever does not see it is left with an empty
   * `alt`. Same shape as the repeating page without its word — the setting was
   * made, the half that makes it usable was not — so it is an error and not a
   * warning. A question with no example photo is never judged.
   */
  private static exampleImages(graph: GraphData): GuideHealthIssue[] {
    return graph.nodes
      .filter((node) => node.type === "file-question")
      .filter((node) => typeof node.data.exampleImage === "string" && node.data.exampleImage.trim() !== "")
      .filter((node) => resolveText(node.data.exampleImageAlt, undefined, "").trim() === "")
      .map((node) => ({
        code: "example-image-without-alt" as const,
        severity: "error" as const,
        nodeId: node.id,
        message: `"${this.label(node)}": exempelfotot saknar alt-text — skriv vad bilden visar.`,
      }));
  }

  /**
   * A date bound that points at a variable (story 087): `till.min = {{fran}}`.
   *
   * Three ways to point wrong. No question sets the variable, or one does but
   * it is not a date — then the viewer reads no bound at all, and the fault
   * the rule was written for walks through. Or the question comes *after*
   * the field it bounds — then the answer is not there yet when the field is
   * checked, and the rule holds only when the visitor goes back. All errors:
   * each one is a rule the redaktör wrote and the visitor never meets.
   *
   * "Before" is a walk backwards over the connections from the field's own
   * step (its page, when it sits on one). Two fields on the same page are
   * checked together at *Nästa*, so there the order is free.
   */
  private static dateBounds(graph: GraphData): GuideHealthIssue[] {
    const askedBefore = this.askedBefore(graph);
    const issues: GuideHealthIssue[] = [];

    graph.nodes
      .filter((node) => node.type === "date-question")
      .forEach((node) => {
        /*
         * `startValue` walks with the bounds (story 118): it is written the
         * same way, read by the same `resolveDateBound`, and can be wrong in
         * exactly the same three ways. Johan 15/9, asked whether a start value
         * may point at a field: *"Fast vi har det på andra ställen. Måste vara
         * lika."* Lika includes being told off the same way — so the three
         * `date-bound-*` codes are reused rather than tripled, and the word in
         * the message is what says which setting is meant.
         */
        (["min", "max", "startValue"] as const).forEach((key) => {
          const bound = node.data[key];
          const variable = dateBoundVariable(typeof bound === "string" ? bound : undefined);

          // `{{idag}}` is the engine's day, set by no question (story 086).
          if (variable === null || variable === TODAY_VARIABLE) {
            return;
          }

          const word =
            key === "min" ? "tidigast" : key === "max" ? "senast" : "startvärdet";
          const source = graph.nodes.find(
            (candidate) => candidate.id !== node.id && candidate.data.variableName === variable,
          );

          if (!source) {
            issues.push({
              code: "date-bound-unset",
              severity: "error",
              nodeId: node.id,
              message: `"${this.label(node)}": ${word} pekar på variabeln "${variable}" som ingen fråga sätter.`,
            });
          } else if (source.type !== "date-question") {
            issues.push({
              code: "date-bound-not-date",
              severity: "error",
              nodeId: node.id,
              message: `"${this.label(node)}": ${word} pekar på "${this.label(source)}" som inte är en datumfråga.`,
            });
          } else {
            /*
             * A bound is judged at *Nästa*, so two fields on the same page are
             * in time for each other and `askedBefore` says so. A start value
             * is read when the page is DRAWN, and nothing on the page has been
             * answered by then — so it needs the stricter reading, and says a
             * different thing when it fails.
             */
            const sameStep =
              (source.parentPageId ?? source.id) === (node.parentPageId ?? node.id);
            const inTime =
              key === "startValue"
                ? !sameStep && askedBefore(source, node)
                : askedBefore(source, node);

            if (!inTime) {
              issues.push({
                code: "date-bound-after",
                severity: "error",
                nodeId: node.id,
                message: key === "startValue"
                  ? `"${this.label(node)}": ${word} pekar på "${this.label(source)}", som inte är besvarad när sidan ritas — fältet blir tomt.`
                  : `"${this.label(node)}": ${word} pekar på "${this.label(source)}" som frågas efter det här fältet.`,
              });
            }
          }
        });
      });

    return issues;
  }

  /**
   * `age(x)` and `days(a; b)` read a date out of a variable (story 086).
   * The evaluator cannot say more than "not a date" once a visitor is in
   * the guide; here the question behind the name is known, so the editor
   * hears it while writing the formula. A date question and a personnummer
   * are dates; `idag` is the engine's; anything else is an error.
   */
  private static dateArguments(graph: GraphData): GuideHealthIssue[] {
    const issues: GuideHealthIssue[] = [];

    graph.nodes
      .filter((node) => node.type === "calculation")
      .forEach((node) => {
        CalculationService.getAssignments(node).forEach((assignment) => {
          dateReferences(assignment.formula).forEach(({ fn, name }) => {
            if (name === TODAY_VARIABLE) {
              return;
            }

            const source = graph.nodes.find((candidate) => candidate.data.variableName === name);
            const isDate = source?.type === "date-question" || source?.data.format === "personnummer";

            if (!source) {
              issues.push({
                code: "date-argument-unset",
                severity: "error",
                nodeId: node.id,
                message: `"${this.label(node)}": ${fn}(${name}) — ingen fråga sätter "${name}".`,
              });
            } else if (!isDate) {
              issues.push({
                code: "date-argument-not-date",
                severity: "error",
                nodeId: node.id,
                message: `"${this.label(node)}": ${fn}(${name}) — "${this.label(source)}" är varken en datumfråga eller ett personnummer.`,
              });
            }
          });
        });
      });

    return issues;
  }

  /**
   * A condition that can never hold when the thing it guards is drawn (story
   * 134) — on a field's *visas om* (077) and on a single option's, which is
   * the same question one level down and therefore the same check.
   *
   * Two ways to write one that is always false, and both look right in the
   * panel:
   *
   * - **The variable is not answered yet.** A condition is read when the page
   *   is drawn, so a question asked further on has no answer to read; the
   *   field or the option is then simply never there. Two fields on the same
   *   page are in time for each other — the page re-reads its conditions while
   *   the visitor answers — which is what `askedBefore` already knows.
   * - **The value is not one the variable can hold.** *Allergi är Nötter* with
   *   the option spelled `notter` is a condition nobody can meet, and the
   *   editor has no way to see it: the panel offers labels and stores codes.
   *
   * A warning and not an error: nobody is hurt. The visitor sees a field that
   * never appears or an option that is never offered, which is work nobody
   * reaches — the line this file draws between the two.
   *
   * Not judged: a variable no node sets at all (`unset-rule-variable` has it),
   * a numeric comparison (any number is a legal value), and a variable with no
   * declared options, where the value is free text by construction.
   */
  private static neverVisible(graph: GraphData): GuideHealthIssue[] {
    const askedBefore = this.askedBefore(graph);
    const variables = new Map(
      QuestionVariableService.getOptions(graph).map((option) => [option.value, option]),
    );
    const numeric = new Set([
      "greater-than",
      "greater-than-or-equal",
      "less-than",
      "less-than-or-equal",
    ]);
    const issues: GuideHealthIssue[] = [];

    const judge = (
      node: FlowNodeData,
      visibility: ConditionalVisibility | undefined,
      code: "field-never-visible" | "option-never-visible",
      what: string,
    ): void => {
      for (const condition of visibility?.conditions ?? []) {
        const name = condition.variableName.trim();

        if (name === "") continue;

        const source = graph.nodes.find(
          (candidate) => candidate.id !== node.id && candidate.data.variableName === name,
        );

        // No node sets it at all: `unsetVariables` says so, in its own words.
        if (!source) continue;

        if (!askedBefore(source, node)) {
          issues.push({
            code,
            severity: "warning",
            nodeId: node.id,
            message: `"${this.label(node)}": ${what} visas bara om "${name}" — som frågas efter det här, så villkoret kan aldrig bli sant.`,
          });
          continue;
        }

        const variable = variables.get(name);

        if (numeric.has(condition.operator) || !variable || variable.options.length === 0) {
          continue;
        }

        const declared = new Set(variable.options.map((one) => one.value));
        const missing = condition.value
          .split(",")
          .map((one) => one.trim())
          .filter((one) => one !== "" && !declared.has(one));

        if (missing.length > 0) {
          issues.push({
            code,
            severity: "warning",
            nodeId: node.id,
            message: `"${this.label(node)}": ${what} visas bara om "${name}" är ${missing.join(", ")} — ett värde frågan inte har, så villkoret kan aldrig bli sant.`,
          });
        }
      }
    };

    graph.nodes.forEach((node) => {
      judge(node, node.visibility, "field-never-visible", "fältet");

      QuestionOptionsService.getOptions(node).forEach((option) => {
        judge(
          node,
          option.visibility,
          "option-never-visible",
          `alternativet "${resolveText(option.label, undefined, option.value)}"`,
        );
      });
    });

    return issues;
  }

  /**
   * Every node id reachable from the start node, breadth/depth order
   * unimportant. `null` when there is no start node — no flow analysis is
   * possible, so callers must pass no verdict rather than treat everything
   * as unreached.
   *
   * Shared by `unreachable` and `submitWithoutReview` — both walk the same
   * graph of connections, one flavour of "does a visitor ever get here".
   */
  static reachableNodeIds(graph: GraphData): Set<string> | null {
    if (graph.startNodeId === null) {
      return null;
    }

    const outgoing = new Map<string, string[]>();

    graph.connections.forEach((connection) => {
      const from = connection.from.nodeId;
      outgoing.set(from, [...(outgoing.get(from) ?? []), connection.to.nodeId]);
    });

    const reached = new Set<string>([graph.startNodeId]);
    const queue = [graph.startNodeId];

    while (queue.length > 0) {
      const current = queue.pop() as string;

      (outgoing.get(current) ?? []).forEach((next) => {
        if (!reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
      });
    }

    return reached;
  }

  /**
   * Nodes that cannot be reached from the start node.
   *
   * A warning and not an error: no resident can be hurt by something they never
   * see. But it is either started work or forgotten work, and in a guide with
   * thirty nodes you do not spot it yourself.
   */
  private static unreachable(graph: GraphData): GuideHealthIssue[] {
    const reached = this.reachableNodeIds(graph);

    if (!reached) {
      return [];
    }

    return graph.nodes
      .filter((node) => !reached.has(node.id))
      // Children of a Page are reached via the page, not via a connection.
      .filter((node) => !node.parentPageId)
      // Notes are not part of the flow.
      .filter((node) => node.type !== "annotation")
      .map((node) => {
        // Terminal = has no outgoing flow port. Asking `behavior.flow.kind`
        // would be nicer but does not work: the declarative model is only
        // partly rolled out, and `result` has no `behavior` at all. The ports
        // exist on every type.
        const terminal = !(getNodeType(node.type)
          ?.getOutputs(node)
          .some((port) => port.valueType === "flow"));

        return {
          code: terminal ? "unreachable-result" : "unreachable-node",
          severity: "warning",
          nodeId: node.id,
          message: terminal
            ? `"${this.label(node)}": resultatet går inte att nå.`
            : `"${this.label(node)}": noden går inte att nå, så den visas aldrig.`,
        } satisfies GuideHealthIssue;
      });
  }
}

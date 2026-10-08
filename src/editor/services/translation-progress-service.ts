import { getNodeType } from "../../viewer/node-types/node-type-registry";
import { editableProperties } from "../node-types/node-properties";
import { VIEWER_STRINGS } from "../../viewer/localization/built-in-strings";
import { isTranslation } from "../../viewer/core/localized-text";
import { reachableViewerKeys } from "./reachable-viewer-keys";
import { registeredText } from "../../viewer/localization/registry";
import { QuestionOptionsService } from "../../viewer/services/question-options-service";
import { RatingScaleService } from "../../viewer/services/rating-scale-service";
import { CalculationService } from "../../viewer/services/calculation-service";
import { ServiceCallService } from "../../viewer/services/service-call-service";
import { RowColumnsService } from "../../viewer/services/row-columns";
import {
  getSourceLocale,
  isLocalizedTextMap,
  resolveText,
} from "../../viewer/core/localized-text";

import type { GraphData } from "../../viewer/types/graph";

export interface TranslationProgress {
  translated: number;
  total: number;
  /** Nodes with at least one translatable field lacking text in the language. */
  untranslatedNodeIds: string[];
  /** Viewer texts still without a text in the language — story 017. */
  untranslatedViewerKeys: string[];
  /**
   * The same counts over the guide's **content** alone.
   *
   * Two callers want different questions answered. A translator asks "will the
   * resident meet their language?", and that includes the buttons. Changing the
   * source language asks "is anything the editor authored about to become
   * untranslated?", and the buttons are not that — an empty guide has nothing
   * to lose, and the one who actually authors in Finnish must be able to pick
   * Finnish straight away. See story 008.
   */
  contentTranslated: number;
  contentTotal: number;
}

/**
 * Counts how much of the translatable *content* has text in a given language. A
 * field counts only if it has source content (empty in the source = nothing to
 * translate). Identities never count — only `localized` fields and the options'
 * labels.
 */
export class TranslationProgressService {
  static getProgress(graph: GraphData, locale: string): TranslationProgress {
    // The source is the guide's own, not a constant. A guide written in Finnish
    // has its original under `fi`, and that is what translations count against.
    const sourceLocale = getSourceLocale(graph);

    let translated = 0;
    let total = 0;
    const untranslated = new Set<string>();
    const untranslatedViewerKeys: string[] = [];

    const check = (value: unknown, nodeId: string): void => {
      const source = resolveText(value, sourceLocale);
      if (source.trim() === "") {
        return; // nothing to translate
      }
      total += 1;
      const has =
        !isTranslation(locale, sourceLocale) ||
        (isLocalizedTextMap(value) &&
          typeof value[locale] === "string" &&
          value[locale].trim() !== "");
      if (has) {
        translated += 1;
      } else {
        untranslated.add(nodeId);
      }
    };

    /*
     * The viewer's own texts count as content — story 017, criterion 1.
     *
     * "Nästa" sits on a button a resident clicks, in the middle of text they
     * read. A guide that showed 100% while its buttons were Swedish in an
     * Arabic guide was not lying about the questions; it was measuring the
     * wrong thing.
     *
     * A key is satisfied when the resident would read the language: the guide's
     * own override, or a default already filled — the host's registered pack,
     * or our built-in for a language we ship. Criterion 5: the count measures
     * what the resident meets, not who wrote it.
     */
    /*
     * The keys *this* guide can show, not every key we ship.
     *
     * Counting all forty-nine told a translator of an eight-node guide that
     * fifty-odd things remained, most of them texts that guide never renders.
     * A denominator nobody can finish is not a measure of progress, and it
     * buries the seven that will be read in a list of forty-nine that will not.
     * Story 017, open question 1.
     */
    const viewerKeys = reachableViewerKeys(graph);
    const viewerTotal = viewerKeys.length;
    let viewerTranslated = 0;

    for (const key of viewerKeys) {
      total += 1;
      const own = graph.settings?.strings?.[key];
      const hasOwn =
        isLocalizedTextMap(own) &&
        typeof own[locale] === "string" &&
        own[locale].trim() !== "";

      if (hasOwn || hasDefaultFor(key, locale)) {
        translated += 1;
        viewerTranslated += 1;
      } else {
        untranslatedViewerKeys.push(key);
      }
    }

    for (const node of graph.nodes) {
      const definition = getNodeType(node.type);
      if (!definition) {
        continue;
      }
      for (const property of editableProperties(definition)) {
        if (property.localized === true) {
          check(node.data[property.id], node.id);
        }
      }
      for (const option of QuestionOptionsService.getOptions(node)) {
        check(option.label, node.id);
      }
      /*
       * A rating's words (story 115) are a list of their own, not options —
       * a step has no value to translate, only a word. Counted here for the
       * same reason an option's label is: a translator who cannot see them has
       * a scale that is half in the wrong language.
       */
      if (node.type === "rating-question") {
        for (const label of RatingScaleService.labels(node).slice(0, RatingScaleService.stepCount(node))) {
          check(label, node.id);
        }
      }
      // A calculation or service row's label is the variable's alias, read
      // in the result text like a question's (story 080).
      for (const row of CalculationService.getAssignments(node)) {
        check(row.label, node.id);
      }
      for (const row of ServiceCallService.getResponseMappings(node)) {
        check(row.label, node.id);
      }
      // The receiver's row (story 092): each column's heading and cell are
      // read by a receiver on the visitor's language, like a mail's body.
      for (const column of RowColumnsService.getColumns(node)) {
        check(column.label, node.id);
        check(column.cell, node.id);
      }
    }

    return {
      translated,
      total,
      untranslatedNodeIds: [...untranslated],
      untranslatedViewerKeys,
      contentTranslated: translated - viewerTranslated,
      contentTotal: total - viewerTotal,
    };
  }
}

/**
 * Is a viewer text already there without the editor writing it?
 *
 * Either the host registered a pack for the language, or we ship it — Swedish
 * and English. Criterion 5: asking the editor to retype "Next" in English would
 * be counting authorship rather than what the resident meets.
 */
function hasDefaultFor(key: string, locale: string): boolean {
  if (registeredText(key, locale) !== undefined) {
    return true;
  }
  const builtIn = VIEWER_STRINGS[key];
  const exact = builtIn?.[locale] ?? builtIn?.[locale.split("-")[0]];
  return typeof exact === "string" && exact.trim() !== "";
}

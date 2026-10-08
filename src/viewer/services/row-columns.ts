/**
 * The columns of a row — `{ id, label, cell }`, label and cell localised — as
 * a node stores them and the editor draws them: the receiver's list row
 * (story 092) is the one user today. Reading, creating, reordering and
 * updating a column knows nothing about receivers, so it lives here, open,
 * and the properties panel and the translation count import this file.
 * Rendering the row at submission time — answers into cells — is the full
 * version's and stays in submission-row-service.ts. Split out 2026-10-06
 * (open-core step 3c, UPPDELNING §11b): two of the editor's three imports of
 * the private service were for these five functions.
 */
import { isLocalizedTextMap, type LocalizedText } from "../core/localized-text";

import type { FlowNodeData } from "../types/graph";

export interface RowColumn {
  id: string;
  label: LocalizedText;
  cell: LocalizedText;
}

export class RowColumnsService {
  static getColumns(node: FlowNodeData): RowColumn[] {
    return this.parseColumns(node.data.row);
  }

  static parseColumns(value: unknown): RowColumn[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is RowColumn => {
      if (typeof item !== "object" || item === null) return false;
      const candidate = item as Record<string, unknown>;
      return (
        typeof candidate.id === "string" &&
        (typeof candidate.label === "string" || isLocalizedTextMap(candidate.label)) &&
        (typeof candidate.cell === "string" || isLocalizedTextMap(candidate.cell))
      );
    });
  }

  static createColumn(): RowColumn {
    return { id: crypto.randomUUID(), label: "", cell: "" };
  }

  static updateColumn(
    columns: RowColumn[],
    columnId: string,
    property: "label" | "cell",
    value: LocalizedText,
  ): RowColumn[] {
    return columns.map((item) => (item.id === columnId ? { ...item, [property]: value } : item));
  }

  /**
   * The first column is the title and stays first — the contract says the
   * first cell is what the errand is called, so nothing may be moved above
   * it or away from it.
   */
  static moveColumn(
    columns: RowColumn[],
    columnId: string,
    direction: "up" | "down",
  ): RowColumn[] {
    const index = columns.findIndex((item) => item.id === columnId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 1 || target < 1 || target >= columns.length) {
      return columns;
    }
    const updated = [...columns];
    [updated[index], updated[target]] = [updated[target]!, updated[index]!];
    return updated;
  }

  /**
   * The row as the payload carries it: the visitor's answers filled in on the
   * guide's display language, the way `records` already is.
   *
   * A variable no answer sets becomes nothing, not its placeholder. The mail
   * body keeps `{{missing}}` visible on purpose — that is how the editor sees
   * what is unfilled — and the health check catches a variable nothing sets.
   * But it cannot catch one a visibility rule leaves unanswered on a real run:
   * the interest form's *Kom från* is `{{case}}`, shown only when a case was
   * given, and the receiver got `Kom från: {{case}}` for everyone else
   * (measured in the outbox 16/9). The contract's `row` says "aldrig
   * variabelnamn i klartext", so the placeholder goes and the column stays.
   */
}

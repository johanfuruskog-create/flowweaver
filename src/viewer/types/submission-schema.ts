/**
 * The shape of what a guide submits — the TYPE, as a receiver reads it out of
 * `meta.submissionSchema` in a guide file (story 094, docs/INLAMNING-KONTRAKT.md
 * *Schemat*). The file format is shared contract, so the type is open and
 * lives with the other file types; deriving a schema from a graph is the full
 * version's and stays in `services/submission-schema-service.ts`. Moved here
 * 2026-10-06 (story 147, criterion 7); the field name in the file did not
 * change — no migration.
 *
 * The form is JSON Schema where JSON Schema has a word (`type`, `properties`,
 * `items`, `format`, `enum`, `minItems`) and our own where it does not:
 * `label` is the question, `options` are the choices with their labels,
 * `kind` says what an object *is*, `optional` marks what a visitor may leave.
 */
import type { LocalizedTextMap } from "../core/localized-text";

export interface SubmissionSchemaProperty {
  type: "string" | "number" | "boolean" | "object" | "array";
  /** The question, per language the guide offers. */
  label?: LocalizedTextMap;
  /** A named format: `email`, `date`, `personnummer`… or `regex` with `pattern`. */
  format?: string;
  pattern?: string;
  enum?: string[];
  /** The choices with their labels; `enum` holds the same values. */
  options?: Array<{ label: LocalizedTextMap; value: string }>;
  /** What an object is: a lookup pair, a place on a map, a file. */
  kind?: "lookup" | "location" | "file";
  properties?: Record<string, SubmissionSchemaProperty>;
  items?: SubmissionSchemaProperty;
  minItems?: number;
  maxItems?: number;
  /** The visitor may leave it; a required field is the default and says nothing. */
  optional?: true;
}

export interface SubmissionSchema {
  /** The guide's name, per language. */
  $guide?: LocalizedTextMap;
  /**
   * The guide's own id — the same value an errand carries as `serviceId`
   * (story 123).
   *
   * It sits beside the name because the name cannot do this job: it is
   * translated and it is rewritten, so a receiver holding both a schema and a
   * pile of errands would be pairing them on a string that changes. Absent
   * until the guide has been saved or exported once.
   */
  $serviceId?: string;
  /** When the editor exported it, ISO 8601 — set by the editor, not here. */
  exportedAt?: string;
  properties: Record<string, SubmissionSchemaProperty>;
}

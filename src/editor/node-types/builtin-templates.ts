import { mergeIntoLibrary } from "../services/template-library";

import type { NodeTemplate } from "../../viewer/types/graph";

/**
 * Ready-made templates — validatable text questions for common formats. They
 * are seeded once into the global library so the editor has them straight away
 * and can see how their own are built (a text question plus a format).
 *
 * That they are this short is the whole point of story 007: a template is a base
 * type plus values. Each of them used to copy the text question's twelve fields
 * and its entire behaviour, and then kept that copy when the text question was
 * fixed.
 */

function formatTemplate(
  type: string,
  label: string,
  icon: string,
  format: string
): NodeTemplate {
  return { type, label, icon, base: "text-question", values: { format } };
}

export const BUILTIN_TEMPLATES: NodeTemplate[] = [
  formatTemplate("nodmall-email", "E-postfråga", "@", "email"),
  formatTemplate("nodmall-phone", "Telefonnummer", "☎", "phone"),
  formatTemplate("nodmall-personnummer", "Personnummer", "#", "personnummer"),
];

/**
 * Seeds the ready-made templates. They belong to the tool, like the base node
 * types, and cannot be removed.
 *
 * They used to be removable, and a flag in `localStorage` kept them from coming
 * back. That flag could not survive storage moving out to the host: the host
 * saves only the editor's *own* templates, and an empty list is
 * indistinguishable from a first run. The alternative — shipping the built-ins
 * inside what the host saves — would have made them impossible to fix or add to
 * in a later version.
 */
export function ensureBuiltinTemplates(): void {
  mergeIntoLibrary(BUILTIN_TEMPLATES, { builtin: true });
}

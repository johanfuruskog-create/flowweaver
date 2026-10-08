/**
 * A single template as a file, so a good field can be handed to a colleague.
 *
 * ## Why this is not the guide export
 *
 * The guide export already carries the templates it uses, and on load they are
 * merged into the library — so sharing a field has always been *possible*.
 * Johan put the objection plainly: sending a whole guide to hand over one node
 * is a silly detour. This is the small door beside the large one.
 *
 * ## Why one entry point reads both
 *
 * The editor has one file input and one import intent. A template arriving there
 * is a different **shape**, not a different door: a guide has `nodes`, a template
 * has `base` and `values`. Two file pickers would be two things to explain and
 * two places for the next format to be forgotten.
 *
 * ## What a template carries with it, and what it does not
 *
 * Everything in `values` travels: a title, a placeholder, a written shape, a
 * pattern. What does not is a **named format's behaviour** — `format:
 * "personnummer"` names something the receiving editor must already have. Such a
 * template is still valid and still useful; it is simply worth less away from
 * home, and `describeTemplateFile` says so rather than letting it be discovered
 * by a field that quietly checks nothing.
 */
import { getFormat } from "../../viewer/core/format-registry";
import { getNodeType } from "../../viewer/node-types/node-type-registry";

import type { NodeTemplate } from "../../viewer/types/graph";

/** What a template file holds. Versioned, because a file outlives the tool that wrote it. */
export interface TemplateFile {
  flowweaverTemplate: 1;
  template: NodeTemplate;
}

export function templateFileJson(template: NodeTemplate): string {
  return `${JSON.stringify({ flowweaverTemplate: 1, template } satisfies TemplateFile, null, 2)}\n`;
}

/** Whether some parsed JSON is a template file rather than a guide. */
export function isTemplateFile(value: unknown): value is TemplateFile {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<TemplateFile>;
  const template = candidate.template as Partial<NodeTemplate> | undefined;

  return (
    candidate.flowweaverTemplate === 1 &&
    typeof template === "object" &&
    template !== null &&
    typeof template.type === "string" &&
    typeof template.base === "string" &&
    typeof template.label === "string" &&
    typeof template.values === "object" &&
    template.values !== null
  );
}

/**
 * The named format a template leans on, when the editor reading it has no such
 * format. Null when the template stands on its own.
 *
 * A template carrying `mask: "###-##-####"` is complete anywhere. One carrying
 * `format: "fnr-no"` is a promise about behaviour that lives elsewhere, and
 * without this it would be kept quietly: the field appears, takes any input and
 * validates nothing.
 */
export function missingFormatOf(template: NodeTemplate): string | null {
  const named = template.values.format;

  if (typeof named !== "string" || named === "" || named === "regex") {
    return null;
  }

  return getFormat(named) ? null : named;
}

/**
 * What a template needs that this editor may not have.
 *
 * A template names a base type — `text-question`, `service-call` — and carries
 * values for it. Arriving somewhere that type does not exist, or is switched
 * off, it lands in the library and vanishes from the palette, which already
 * filters by capability. The editor is right to hide it; what it did not do was
 * say so, and a cheerful "added to the library" over a template nobody will ever
 * see is the same silence the missing format had.
 *
 * Johan found this one before I did, asking whether a template must not be based
 * on a field type that exists if it comes carrying data.
 *
 * Two answers rather than one, because they mean different things:
 *
 * - `"unknown"` — the type is not in this editor at all. The template does not
 *   belong here and never will.
 * - `"disabled"` — the type exists but the level has it switched off. The
 *   template waits, and becomes useful the day somebody turns it on.
 */
export function templateNeeds(
  template: NodeTemplate,
  isEnabled: (capability: string) => boolean,
): { kind: "unknown" | "disabled"; base: string; capability?: string } | null {
  const definition = getNodeType(template.base);

  if (!definition) {
    return { kind: "unknown", base: template.base };
  }

  const capability = definition.requiredCapability;

  return capability && !isEnabled(capability)
    ? { kind: "disabled", base: template.base, capability }
    : null;
}

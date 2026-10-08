/*
 * The editor's view of a node type's properties: the fields that have a form.
 *
 * Importing this module is what attaches the built-in types' forms to their
 * fields (`./default-node-properties` runs `describeNodeProperties` for each
 * type). Every editor reader of properties goes through `editableProperties`
 * rather than `definition.properties`, so the type it gets back promises the
 * label and control — and so the import that loads the forms cannot be
 * forgotten by a reader that only wanted the list.
 *
 * A field without a form is left out on purpose: it is a stored value the
 * panel has no way to ask for, which for a host's custom type is a legitimate
 * choice (a computed key) and for a built-in type is a fault the test beside
 * the forms catches.
 */
import "./default-node-properties";
import type {
  NodePropertyDefinition,
  NodeTypeDefinition,
} from "../../viewer/types/node-types";

export function editableProperties(
  definition: Pick<NodeTypeDefinition, "properties"> | undefined
): NodePropertyDefinition[] {
  return (definition?.properties ?? []).filter(
    (property): property is NodePropertyDefinition => property.control !== undefined
  );
}

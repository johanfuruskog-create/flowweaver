import { dataFromProperties, getNodeType } from "../../viewer/node-types/node-type-registry";

import type { FlowNodeData, GraphData } from "../../viewer/types/graph";

/** Where the skeleton is laid down. The canvas owns the choice; this owns the shape. */
interface Point {
  x: number;
  y: number;
}

/**
 * The form recipe, as nodes.
 *
 * **A page with fields → review → submission.** Somebody who already knows
 * builds that in a minute; somebody who does not builds a page straight into a
 * submission and finds out in the test run. The nodes, the contract and the
 * catalogue have existed for a while — the recipe lived in the head of whoever
 * built them. This is the recipe written down where it can be handed over.
 *
 * ## Why it lives in the library and not in the editor's menu
 *
 * Because story 052's fifth criterion is that it works in the SiteVision dialog
 * *without adaptation*. That is only true if the skeleton belongs to the
 * library; a template assembled in the example site would have to be built a
 * second time for every host. The menu item is one call to this, which is also
 * what makes moving the grip to the palette two lines rather than a rewrite.
 *
 * ## Why it carries no recipient
 *
 * The story's sharpest line: a template with a recipient already chosen is an
 * errand that goes to the wrong place out of convenience. The recipient is the
 * host's catalogue and the editor's deliberate choice — and a skeleton that
 * leaves it empty is *silent in the health check except* for "no recipient
 * chosen", which is exactly the next thing to do, pointed at.
 */

/** Nodes and lines to add, plus which node a guide should start at if it is empty. */
export interface FormSkeleton {
  nodes: FlowNodeData[];
  connections: GraphData["connections"];
  startNodeId: string;
}

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `n-${Math.random().toString(36).slice(2, 10)}`;

/**
 * A node of `type` with the registry's own defaults, plus anything overridden.
 *
 * Through `dataFromProperties` rather than written out here, so a skeleton node
 * is indistinguishable from one dragged out of the palette — which is the
 * story's second criterion: afterwards there is no template mode, only nodes.
 */
function nodeOf(
  type: string,
  position: Point,
  extra: Partial<FlowNodeData> = {},
): FlowNodeData {
  const definition = getNodeType(type);

  return {
    id: newId(),
    type,
    position,
    data: dataFromProperties(definition?.properties ?? []),
    ...extra,
  } as FlowNodeData;
}

/**
 * Builds the skeleton at `origin`, laid out left to right.
 *
 * The caller decides where it goes and whether the guide starts there — this
 * knows the recipe, not the canvas.
 */
export function formSkeleton(origin: Point = { x: 0, y: 0 }): FormSkeleton {
  /*
   * A FINISHED form, not a page with one field (formulärspåret, Läget 1/9):
   * the recipe the skeleton exists to show is "one page per topic, three to
   * six fields" — and the first page every errand form has is who is asking.
   * Name, email and phone in thirds shows the 12-column layout without a
   * word of documentation; the formats come from the same registry as the
   * built-in templates, so validation follows for free.
   */
  const omDig = nodeOf("page", origin);
  const namn = nodeOf("text-question", origin, {
    parentPageId: omDig.id,
    order: 1,
    layout: { columnSpan: 4 },
  });
  const epost = nodeOf("text-question", origin, {
    parentPageId: omDig.id,
    order: 2,
    layout: { columnSpan: 4 },
  });
  const telefon = nodeOf("text-question", origin, {
    parentPageId: omDig.id,
    order: 3,
    layout: { columnSpan: 4 },
  });

  /* Pages are 620 wide; 700 keeps a lane for the connection between them. */
  const omArendet = nodeOf("page", { x: origin.x + 700, y: origin.y });
  const beskrivning = nodeOf("text-question", { x: origin.x + 700, y: origin.y }, {
    parentPageId: omArendet.id,
    order: 1,
    layout: { columnSpan: 12 },
  });

  const review = nodeOf("review", { x: origin.x + 1400, y: origin.y });
  // The skeleton ends in a submission when FlowWeaver PRO is registered, in a
  // plain result otherwise — the open editor has no sending step to offer.
  const submit = nodeOf(getNodeType("submit-result") ? "submit-result" : "result", { x: origin.x + 1760, y: origin.y });

  /*
   * Placeholder wording in the source language and English, the way built-in
   * templates localise. An untranslated skeleton would show up as missing
   * translation in a guide that has not been written yet.
   */
  omDig.data.title = { sv: "Om dig", en: "About you" };
  namn.data.title = { sv: "Namn", en: "Name" };
  namn.data.variableName = "namn";
  /* Ett ärende utan namn och kontaktväg kan ingen besvara — namn och
     e-post är obligatoriska, telefonen frivillig (granskningen 2/9). */
  namn.data.required = true;
  epost.data.title = { sv: "E-post", en: "Email" };
  epost.data.variableName = "epost";
  epost.data.format = "email";
  epost.data.required = true;
  telefon.data.title = { sv: "Telefon", en: "Phone" };
  telefon.data.variableName = "telefon";
  telefon.data.format = "phone";

  omArendet.data.title = { sv: "Om ditt ärende", en: "About your errand" };
  beskrivning.data.title = { sv: "Beskriv ditt ärende", en: "Describe your errand" };
  beskrivning.data.variableName = "beskrivning";
  beskrivning.data.presentation = "textarea";
  beskrivning.data.required = true;

  return {
    nodes: [omDig, namn, epost, telefon, omArendet, beskrivning, review, submit],
    connections: [
      {
        id: newId(),
        from: { nodeId: omDig.id, portId: "continue" },
        to: { nodeId: omArendet.id, portId: "input" },
      },
      {
        id: newId(),
        from: { nodeId: omArendet.id, portId: "continue" },
        to: { nodeId: review.id, portId: "input" },
      },
      {
        id: newId(),
        from: { nodeId: review.id, portId: "continue" },
        to: { nodeId: submit.id, portId: "input" },
      },
    ],
    startNodeId: omDig.id,
  };
}

import type { Connection, FlowNodeData, GraphData } from "../types/graph";

/**
 * The guide as a visitor would get it, with the workspace left out.
 *
 * ## Why this exists
 *
 * Two questions look alike and are not: *has anything been saved?* and *would
 * anybody answering this guide get something different?* The first is the
 * storage's business. The second is what an editor means by **unpublished
 * changes**, and it is the only one worth a mark on the screen.
 *
 * Johan found the difference by dragging a node across the canvas on 17/9: the
 * dot lit, the word appeared, and nothing about the guide had changed. The
 * working copy had been written — correctly — with new coordinates.
 *
 * ## One definition, and this is it
 *
 * The mark uses this now; the publishing overview will use it next. Two places
 * that each decide what counts as a change is the shape of nearly every fault
 * in this codebase: the second copy is the one nobody updates.
 *
 * ## What is left out, and how it was decided
 *
 * Measured against what `src/viewer/` actually reads, not against what the
 * fields are called:
 *
 *  - **`position`** on a node. Nothing in the viewer reads it. It is where the
 *    card sits on the canvas, and the canvas is the editor's.
 *  - **`color`** on a connection. The field says so itself — *purely visual* —
 *    and it is drawn on the canvas, never in a page a visitor sees.
 *  - **`meta.versionId` and `meta.updatedAt`**, which the storage stamps when
 *    it freezes a version. Nobody wrote them, so they cannot be somebody's
 *    unpublished change. They were stripped on the storage page before this
 *    function existed, which was the first copy of this decision.
 *
 * And, as deliberately, what stays:
 *
 *  - **`layout`** on a node — `columnSpan` and `breakBefore`. It is called
 *    layout and it is the *page's* layout: `page-fields-service` reads it to
 *    decide how wide a field is. A function that dropped every field with
 *    "layout" in its name would drop half of what a visitor looks at.
 *  - **`order`** and **`parentPageId`**, which put the fields of a page in
 *    their order — read by the page, the calculation and the submission
 *    schema alike.
 *  - **`template`**, which is provenance rather than geometry (K6b). It is
 *    authored, it survives in exports, and leaving it in costs nothing: the
 *    editor does not change it while somebody moves a card.
 *
 * ## The whole list, so it can be checked
 *
 * `FlowNodeData` has nine fields, and every one of them is accounted for
 * above: `id`, `type`, `data`, `template`, `parentPageId`, `order`, `layout`
 * and `visibility` stay; `position` goes. There is **no size and no collapsed
 * state** to worry about — neither exists, in the type or inside `data`.
 *
 * Nor does anything else about the view live in the graph. The canvas keeps its
 * zoom, its scroll and its per-node visitor view to itself, and says so where
 * it does it (`node-editor.ts`, story 064 point 7): none of them dispatch
 * `graph-changed`, and the graph comes back byte-identical after a switch. So
 * the workspace's whole footprint in a saved guide is a pair of coordinates per
 * node and an optional colour per connection.
 *
 * The array order of `nodes` is left exactly as it is. Adding or removing a
 * node is a change by any reading, and sorting here to be safe would be this
 * function having an opinion about something it cannot see.
 */
export function visitorContent(graph: GraphData): GraphData {
  const nodes = graph.nodes?.map(withoutWorkspace) ?? [];
  const connections = graph.connections?.map(withoutColour) ?? [];
  const meta = withoutStamps(graph.meta);

  return meta === undefined
    ? { ...graph, nodes, connections }
    : { ...graph, nodes, connections, meta };
}

function withoutWorkspace(node: FlowNodeData): FlowNodeData {
  const { position, ...rest } = node;

  void position;

  return rest as FlowNodeData;
}

function withoutColour(connection: Connection): Connection {
  const { color, ...rest } = connection;

  void color;

  return rest as Connection;
}

function withoutStamps(meta: GraphData["meta"]): GraphData["meta"] {
  if (!meta) {
    return meta;
  }

  const { versionId, updatedAt, ...rest } = meta;

  void versionId;
  void updatedAt;

  return rest;
}

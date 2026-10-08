import { getSourceLocale, resolveText } from "../core/localized-text";
import { interpolate, t } from "../core/ui-strings";

import { visitorContent } from "./visitor-content";

import type { Connection, FlowNodeData, GraphData } from "../types/graph";

/**
 * What publishing would change for a visitor, in sentences (story 125).
 *
 * ## Why a list and not a boolean
 *
 * Story 124 answered *has anything changed* — enough for a dot beside a name,
 * and useless in front of a decision. An editor about to publish is asking
 * *what changes*, and the honest answer names the questions, the answers and
 * the routes.
 *
 * The two answers come from the same place on purpose: the mark on the status
 * bar is `compare(...).length > 0`, so the row and the dialog cannot disagree
 * about what counts as a change. That was the promise criterion 16 of story 124
 * made, and this is where it is kept.
 *
 * ## Where it lives, and what it may touch
 *
 * In `src/viewer/services/` beside `visitorContent`, which it applies itself.
 * The viewer does not need it — no visitor sees a diff — but the *shape* it
 * reasons about is the graph's, and the graph's meaning lives here. It imports
 * nothing from the editor; `entries.test.ts` counts the source graph and would
 * say so if it did.
 *
 * The sentences come out of the shared string table by key (`t()`), which the
 * editor fills when it loads. A lookup is not an import: a page without an
 * editor never asks for one of these keys, because nothing there shows a diff.
 *
 * ## Identity is what makes this possible
 *
 * Nodes carry `id` and options carry `options[].id`, versions are stored
 * verbatim, and *Återställ* rewrites nothing (measured for 124). So *changed*
 * can be told from *removed and added*, which is the difference between a
 * useful list and a list of everything.
 */

export type GuideChangeKind = "start" | "node" | "route" | "option" | "content" | "page";

export interface GuideChange {
  kind: GuideChangeKind;
  /** The node the change concerns, so the dialog can lead there. */
  nodeId: string;
  /** That node's heading, in the guide's own language. */
  title: string;
  /** The whole sentence, ready to read. */
  message: string;
  /** For a heading that changed: what it said, and what it says now. */
  before?: string;
  after?: string;
}

/**
 * The order the rows are read in, and it is an argument rather than a habit:
 * what changes the way through the guide first, a field that moved on a page
 * last. Somebody who reads two rows and stops has then read the two that could
 * send a visitor somewhere else.
 */
const KIND_ORDER: GuideChangeKind[] = ["start", "node", "route", "option", "content", "page"];

interface Option {
  id: string;
  label?: unknown;
  value?: unknown;
}

export class GuideDiffService {
  /**
   * The changes from one graph to another, as a visitor would meet them.
   *
   * `visitorContent` is applied here rather than demanded of the caller. It is
   * idempotent, so a caller who has already applied it loses nothing — and the
   * one thing this must never do is report a node somebody dragged across the
   * canvas.
   *
   * No `before` at all is the first publication: there is nothing to compare,
   * which is not the same as nothing having changed. The dialog asks `outline`
   * instead.
   */
  static compare(before: GraphData | null | undefined, after: GraphData): GuideChange[] {
    if (!before) {
      return [];
    }

    const was = visitorContent(before);
    const now = visitorContent(after);
    const locale = getSourceLocale(now);
    const wasNodes = byId(was.nodes ?? []);
    const nowNodes = byId(now.nodes ?? []);
    const changes: GuideChange[] = [];

    const title = (node: FlowNodeData | undefined): string =>
      node ? nodeTitle(node, locale) : t("editor.diff.untitled", locale);

    /* ── Where the guide starts ─────────────────────────────────────────── */

    if (was.startNodeId !== now.startNodeId) {
      const node = now.startNodeId ? nowNodes.get(now.startNodeId) : undefined;

      changes.push({
        kind: "start",
        nodeId: now.startNodeId ?? "",
        title: title(node),
        message: interpolate(t("editor.diff.start", locale), { node: title(node) }),
      });
    }

    /* ── Steps and fields that arrived or left ──────────────────────────── */

    /*
     * Held on to, because every other kind below has to keep quiet about them.
     * A new node arrives wired in, and a removed one takes its connections with
     * it; a list that reported the wiring as well would describe one act three
     * times (criterion 2).
     */
    const arrived = new Set<string>();
    const left = new Set<string>();

    for (const node of now.nodes ?? []) {
      if (!wasNodes.has(node.id)) {
        arrived.add(node.id);
        changes.push({
          kind: "node",
          nodeId: node.id,
          title: nodeTitle(node, locale),
          message: interpolate(
            t(node.parentPageId ? "editor.diff.node.addedField" : "editor.diff.node.addedStep", locale),
            { node: nodeTitle(node, locale) },
          ),
        });
      }
    }

    for (const node of was.nodes ?? []) {
      if (!nowNodes.has(node.id)) {
        left.add(node.id);
        changes.push({
          kind: "node",
          nodeId: node.id,
          title: nodeTitle(node, locale),
          message: interpolate(
            t(node.parentPageId ? "editor.diff.node.removedField" : "editor.diff.node.removedStep", locale),
            { node: nodeTitle(node, locale) },
          ),
        });
      }
    }

    const untouched = (connection: Connection): boolean =>
      !arrived.has(connection.from.nodeId) &&
      !arrived.has(connection.to.nodeId) &&
      !left.has(connection.from.nodeId) &&
      !left.has(connection.to.nodeId);

    /* ── Where an answer leads ──────────────────────────────────────────── */

    const wasLinks = byId(was.connections ?? []);
    const nowLinks = byId(now.connections ?? []);

    for (const link of now.connections ?? []) {
      if (!untouched(link)) {
        continue;
      }

      const old = wasLinks.get(link.id);
      const from = nowNodes.get(link.from.nodeId);
      const where = {
        node: title(from),
        option: portLabel(from, link.from.portId, locale),
        to: title(nowNodes.get(link.to.nodeId)),
      };

      if (!old) {
        changes.push({
          kind: "route",
          nodeId: link.from.nodeId,
          title: title(from),
          message: interpolate(t("editor.diff.route.added", locale), where),
        });
        continue;
      }

      if (old.to.nodeId !== link.to.nodeId) {
        changes.push({
          kind: "route",
          nodeId: link.from.nodeId,
          title: title(from),
          message: interpolate(t("editor.diff.route.changed", locale), {
            ...where,
            from: title(wasNodes.get(old.to.nodeId)),
          }),
          before: title(wasNodes.get(old.to.nodeId)),
          after: where.to,
        });
      }
    }

    for (const link of was.connections ?? []) {
      if (nowLinks.has(link.id) || !untouched(link)) {
        continue;
      }

      const from = wasNodes.get(link.from.nodeId);

      changes.push({
        kind: "route",
        nodeId: link.from.nodeId,
        title: title(from),
        message: interpolate(t("editor.diff.route.removed", locale), {
          node: title(from),
          option: portLabel(from, link.from.portId, locale),
        }),
      });
    }

    /* ── The answers themselves, and everything else on a node ──────────── */

    for (const node of now.nodes ?? []) {
      const old = wasNodes.get(node.id);

      if (!old) {
        continue;
      }

      const name = nodeTitle(node, locale);

      changes.push(...optionChanges(old, node, name, locale));

      /*
       * The heading is called out by name because it is the one field an editor
       * recognises from across the room — and because saying *the content has
       * changed* about a rewritten question is true and unhelpful. Everything
       * else is one row: which setting moved is a question the node itself
       * answers, and this list is read before anybody opens it.
       */
      const wasHeading = resolveText(old.data?.title, locale, "", locale);
      const nowHeading = resolveText(node.data?.title, locale, "", locale);

      if (wasHeading !== nowHeading) {
        changes.push({
          kind: "content",
          nodeId: node.id,
          title: name,
          message: interpolate(t("editor.diff.content.heading", locale), { node: name }),
          before: wasHeading,
          after: nowHeading,
        });
      } else if (JSON.stringify(rest(old)) !== JSON.stringify(rest(node))) {
        changes.push({
          kind: "content",
          nodeId: node.id,
          title: name,
          message: interpolate(t("editor.diff.content.other", locale), { node: name }),
        });
      }

      /* ── Where a field sits on its page ───────────────────────────────── */

      if (
        old.parentPageId !== node.parentPageId ||
        old.order !== node.order ||
        JSON.stringify(old.layout) !== JSON.stringify(node.layout)
      ) {
        const page = node.parentPageId ? nowNodes.get(node.parentPageId) : undefined;

        changes.push({
          kind: "page",
          nodeId: node.id,
          title: name,
          message: interpolate(t("editor.diff.page.moved", locale), {
            page: title(page ?? node),
            field: name,
          }),
        });
      }
    }

    return changes.sort((left, right) => KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind));
  }

  /**
   * The guide itself, in the order the start leads — the first publication's
   * answer to *what am I publishing?*
   *
   * Steps only. A page's fields belong to the page, and twenty rows for one
   * screen would bury the six that are steps. What cannot be reached from the
   * start comes last rather than being left out: an unreachable step is still
   * something being published, and the health check is the place that judges it.
   */
  static outline(graph: GraphData): GuideChange[] {
    const content = visitorContent(graph);
    const locale = getSourceLocale(content);
    const nodes = (content.nodes ?? []).filter((node) => !node.parentPageId);
    const links = content.connections ?? [];
    const seen = new Set<string>();
    const order: FlowNodeData[] = [];
    const queue = content.startNodeId ? [content.startNodeId] : [];

    while (queue.length > 0) {
      const id = queue.shift()!;

      if (seen.has(id)) {
        continue;
      }

      seen.add(id);

      const node = nodes.find((one) => one.id === id);

      if (!node) {
        continue;
      }

      order.push(node);

      for (const link of links) {
        if (link.from.nodeId === id && !seen.has(link.to.nodeId)) {
          queue.push(link.to.nodeId);
        }
      }
    }

    for (const node of nodes) {
      if (!seen.has(node.id)) {
        order.push(node);
      }
    }

    return order.map((node) => ({
      kind: "node" as const,
      nodeId: node.id,
      title: nodeTitle(node, locale),
      message: nodeTitle(node, locale),
    }));
  }
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/** A node's heading in the guide's language, or a word for one that has none. */
function nodeTitle(node: FlowNodeData, locale: string): string {
  const title = resolveText(node.data?.title, locale, "", locale).trim();

  return title === "" ? t("editor.diff.untitled", locale) : title;
}

/**
 * What the answer is called, not what the port is called.
 *
 * A question's output ports carry the option ids, so the label a visitor read
 * is right there. Anything else — a page's *continue*, a rule's branches — has
 * only the port id, and the id is what the editor shows too.
 */
function portLabel(node: FlowNodeData | undefined, portId: string, locale: string): string {
  const options = optionsOf(node?.data);
  const option = options.find((one) => one.id === portId);

  return option ? resolveText(option.label, locale, portId, locale) : portId;
}

function optionsOf(data: unknown): Option[] {
  const options = (data as { options?: unknown })?.options;

  return Array.isArray(options)
    ? options.filter(
        (option): option is Option =>
          typeof option === "object" && option !== null && typeof (option as Option).id === "string",
      )
    : [];
}

/**
 * Everything about a node that has not already got a row of its own.
 *
 * Subtracted rather than enumerated, and that is the whole point: a field added
 * to `FlowNodeData` next year is something a visitor may well meet, and a list
 * of fields I thought of would pass over it in silence. What does *not* count
 * is decided in one place — `visitorContent` — and this compares the rest
 * wholesale.
 *
 * Measured 17/9: while this enumerated its fields instead, dropping
 * `visitorContent` from the comparison changed nothing at all, because nothing
 * here read a position. A guard that cannot fail is not a guard.
 */
function rest(node: FlowNodeData): unknown {
  const { parentPageId, order, layout, data, ...others } = node;

  void parentPageId;
  void order;
  void layout;

  return { ...others, data: withoutOptions(data) };
}

function withoutOptions(data: unknown): unknown {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  const { options, ...others } = data as Record<string, unknown>;

  void options;

  return others;
}

/** Added, removed, renamed — told apart by `options[].id`, never by position. */
function optionChanges(
  old: FlowNodeData,
  node: FlowNodeData,
  name: string,
  locale: string,
): GuideChange[] {
  const was = optionsOf(old.data);
  const now = optionsOf(node.data);
  const wasById = byId(was);
  const nowById = byId(now);
  const rows: GuideChange[] = [];
  const label = (option: Option): string => resolveText(option.label, locale, option.id, locale);

  for (const option of now) {
    const before = wasById.get(option.id);

    if (!before) {
      rows.push({
        kind: "option",
        nodeId: node.id,
        title: name,
        message: interpolate(t("editor.diff.option.added", locale), {
          node: name,
          option: label(option),
        }),
      });
      continue;
    }

    if (label(before) !== label(option)) {
      rows.push({
        kind: "option",
        nodeId: node.id,
        title: name,
        message: interpolate(t("editor.diff.option.renamed", locale), {
          node: name,
          before: label(before),
          after: label(option),
        }),
        before: label(before),
        after: label(option),
      });
    }
  }

  /*
   * The order they stand in, which is what a visitor reads top to bottom. Only
   * when the set is otherwise the same: after an addition or a removal
   * everything below has moved by definition, and saying so as well would be a
   * second row about one act.
   */
  if (
    rows.length === 0 &&
    was.length === now.length &&
    was.some((option, index) => option.id !== now[index]?.id)
  ) {
    rows.push({
      kind: "option",
      nodeId: node.id,
      title: name,
      message: interpolate(t("editor.diff.option.reordered", locale), { node: name }),
    });
  }

  for (const option of was) {
    if (!nowById.has(option.id)) {
      rows.push({
        kind: "option",
        nodeId: node.id,
        title: name,
        message: interpolate(t("editor.diff.option.removed", locale), {
          node: name,
          option: label(option),
        }),
      });
    }
  }

  return rows;
}

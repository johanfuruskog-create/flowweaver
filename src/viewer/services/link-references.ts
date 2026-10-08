import type { GraphData } from "../types/graph";

/**
 * The link as it is written in a text: `[text](address)` or, with the
 * host's reference (story 100), `[text](address "ref")`. One pattern, read
 * by the renderer and by the two walkers below — so the shape of a link is
 * decided in one place.
 */
export const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * The parenthesis taken apart: the address, and the reference if one is
 * written. The quotes may arrive as `&quot;` — the renderer escapes the
 * whole text before it looks for links, and the reference must still be
 * told from the address there.
 */
export function splitLinkTarget(target: string): { url: string; ref?: string } {
  const withRef = /^(\S+)\s+(?:"([^"]*)"|&quot;(.*?)&quot;)$/.exec(target.trim());

  return withRef ? { url: withRef[1]!, ref: withRef[2] ?? withRef[3]! } : { url: target };
}

/** The parenthesis put together again — the mirror of `splitLinkTarget`. */
export function joinLinkTarget(url: string, ref?: string): string {
  return ref ? `${url} "${ref}"` : url;
}

export interface LinkReference {
  nodeId: string;
  url: string;
  ref: string;
}

/**
 * Every link with a reference in the guide. Walks every string under
 * `node.data` — a description, a localized map of descriptions, an option's
 * label — because which properties allow a link is the node type's say and
 * this reader should not need to know it.
 */
export function findLinkReferences(graph: GraphData): LinkReference[] {
  const found: LinkReference[] = [];

  graph.nodes.forEach((node) => {
    walkStrings(node.data, (text) => {
      for (const match of text.matchAll(LINK_PATTERN)) {
        const { url, ref } = splitLinkTarget(match[2]!);

        if (ref) found.push({ nodeId: node.id, url, ref });
      }
    });
  });

  return found;
}

/**
 * The guide with every referenced link's address replaced by what `address`
 * gives for its reference — `undefined` leaves a link as it is. Returns the
 * same graph object when nothing changed, so a caller can tell.
 */
export function rewriteLinkAddresses(
  graph: GraphData,
  address: (ref: string) => string | undefined,
): GraphData {
  let changed = false;
  const rewrite = (text: string): string =>
    text.replace(LINK_PATTERN, (whole, label: string, target: string) => {
      const { url, ref } = splitLinkTarget(target);
      const fresh = ref ? address(ref) : undefined;

      if (fresh === undefined || fresh === url) return whole;

      changed = true;
      return `[${label}](${joinLinkTarget(fresh, ref)})`;
    });

  const nodes = graph.nodes.map((node) => ({ ...node, data: mapStrings(node.data, rewrite) as typeof node.data }));

  return changed ? { ...graph, nodes } : graph;
}

function walkStrings(value: unknown, visit: (text: string) => void): void {
  if (typeof value === "string") {
    visit(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => walkStrings(item, visit));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => walkStrings(item, visit));
  }
}

function mapStrings(value: unknown, map: (text: string) => string): unknown {
  if (typeof value === "string") {
    return map(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => mapStrings(item, map));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, map)]));
  }

  return value;
}

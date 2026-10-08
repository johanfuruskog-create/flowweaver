import {
  DEFAULT_SOURCE_LOCALE,
  isLocalizedTextMap,
  withLocale,
  type LocalizedText,
} from "../core/localized-text";

/**
 * Comments for an annotated image: an arrow plus text at a saved position (x/y
 * as a percentage of the image). Pure functions, so they are easy to test and
 * can be driven from the properties panel without state of their own.
 *
 * The text is authored content and therefore `LocalizedText`, like every other
 * text a redaktör writes. Parse used to flatten a { sv, en } map to "" — the
 * tutorial's bubbles rendered "Kommentar 1/2" with nothing after it, found by
 * Johan on the published page. Only rendering resolves a language; the service
 * carries what was written.
 */

export const ARROW_DIRECTIONS = ["up", "down", "left", "right"] as const;
export type ArrowDirection = (typeof ARROW_DIRECTIONS)[number];

export interface AnnotationComment {
  id: string;
  text: LocalizedText;
  x: number;
  y: number;
  arrow: ArrowDirection;
}

function clampPercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function isArrow(value: unknown): value is ArrowDirection {
  return (ARROW_DIRECTIONS as readonly string[]).includes(value as string);
}

export const AnnotationCommentsService = {
  /** Tolkar godtycklig nod-data till en lista med giltiga kommentarer. */
  parse(value: unknown): AnnotationComment[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
      )
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
        text:
          typeof item.text === "string"
            ? item.text
            : isLocalizedTextMap(item.text)
              ? item.text
              : "",
        x: clampPercent(item.x),
        y: clampPercent(item.y),
        arrow: isArrow(item.arrow) ? item.arrow : "up",
      }));
  },

  /** A new comment in the middle of the image. */
  add(list: AnnotationComment[]): AnnotationComment[] {
    return [
      ...list,
      { id: crypto.randomUUID(), text: "", x: 50, y: 50, arrow: "up" },
    ];
  },

  remove(list: AnnotationComment[], id: string): AnnotationComment[] {
    return list.filter((comment) => comment.id !== id);
  },

  update(
    list: AnnotationComment[],
    id: string,
    property: "text" | "x" | "y" | "arrow",
    rawValue: string,
    locale: string = DEFAULT_SOURCE_LOCALE
  ): AnnotationComment[] {
    return list.map((comment) => {
      if (comment.id !== id) return comment;
      if (property === "x" || property === "y") {
        return { ...comment, [property]: clampPercent(rawValue) };
      }
      if (property === "arrow") {
        return { ...comment, arrow: isArrow(rawValue) ? rawValue : comment.arrow };
      }
      // Into the given language's slot, the others untouched — the panel in
      // translation mode edits the target without wiping the source.
      return { ...comment, text: withLocale(comment.text, locale, rawValue) };
    });
  },
};

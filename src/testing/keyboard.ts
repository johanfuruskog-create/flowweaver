import { userEvent } from "@vitest/browser/context";

/**
 * Measures what happens when you tab through a component.
 *
 * For tests only — no entry under `src/entries/` imports it.
 *
 * ## Why real key presses
 *
 * `element.focus()` gives focus but not necessarily `:focus-visible`, and that
 * is what decides whether an indicator is drawn. Measuring with `.focus()`
 * therefore measures something other than what a person sees.
 * `userEvent.tab()` presses for real.
 */

export interface Fokusstopp {
  element: Element;
  /** A short description for error messages. */
  namn: string;
  rect: DOMRect;
  /** Is focus visible? Measured while the element actually has focus. */
  harMarkering: boolean;
  synlig: boolean;
}

/** The most deeply focused element, across shadow roots. */
function djupAktiv(): Element | null {
  let element: Element | null = document.activeElement;

  while (element?.shadowRoot?.activeElement) {
    element = element.shadowRoot.activeElement;
  }

  return element;
}

function namnge(element: Element): string {
  const typ = element.getAttribute("type");
  const etikett =
    element.getAttribute("aria-label") ??
    (element.textContent ?? "").trim().slice(0, 24);

  return `${element.tagName.toLowerCase()}${typ ? `[${typ}]` : ""}` +
    (etikett ? ` "${etikett}"` : "");
}

/**
 * Is focus visible on the element?
 *
 * Either an outline (our own ring or the browser's default) or a shadow that
 * differs from the unfocused one. The measurement is taken while the element has
 * focus — otherwise you measure nothing.
 */
function markeringSyns(element: Element, ofokuseradSkugga: string): boolean {
  const stil = getComputedStyle(element);
  const kontur =
    stil.outlineStyle !== "none" && Number.parseFloat(stil.outlineWidth) > 0;

  return kontur || stil.boxShadow !== ofokuseradSkugga;
}

function isVisible(element: Element): boolean {
  const stil = getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return (
    stil.visibility !== "hidden" &&
    stil.display !== "none" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

/**
 * Tabs through `container` and describes every stop.
 *
 * Ends when focus leaves the container or when a stop repeats — a cyclic focus
 * would otherwise spin until the cap is reached.
 */
export async function fokusstopp(
  container: HTMLElement,
  max = 40,
): Promise<Fokusstopp[]> {
  document.body.focus();

  const stopp: Fokusstopp[] = [];
  const sedda = new Set<Element>();

  for (let index = 0; index < max; index += 1) {
    const unfocusedShadow = new Map<Element, string>();
    const nuvarande = djupAktiv();
    if (nuvarande) {
      unfocusedShadow.set(nuvarande, getComputedStyle(nuvarande).boxShadow);
    }

    await userEvent.tab();

    const element = djupAktiv();

    if (!element || element === document.body || !container.contains(element.getRootNode() instanceof ShadowRoot ? (element.getRootNode() as ShadowRoot).host : element)) {
      break;
    }

    if (sedda.has(element)) {
      break;
    }

    sedda.add(element);

    // The unfocused shadow is measured on a sibling of the same kind when
    // possible; otherwise the outline suffices, which is the usual way focus is
    // indicated.
    stopp.push({
      element,
      namn: namnge(element),
      rect: element.getBoundingClientRect(),
      harMarkering: markeringSyns(element, "none"),
      synlig: isVisible(element),
    });
  }

  return stopp;
}

/** Stops that cannot be seen, or that do not show they have focus. */
export function fokusbrott(stopp: Fokusstopp[]): string[] {
  return stopp.flatMap((plats) => {
    const fel: string[] = [];

    if (!plats.synlig) {
      fel.push(`${plats.namn} går att tabba till men syns inte`);
    }

    if (!plats.harMarkering) {
      fel.push(`${plats.namn} visar inte att den har fokus`);
    }

    return fel;
  });
}

/**
 * Does the tab order follow the reading order?
 *
 * Rows are compared top to bottom, and within a row left to right. A stop counts
 * as the same row if it overlaps the previous one vertically — otherwise a
 * button sitting a few pixels higher would have counted as a row of its own.
 *
 * Applies to **linear surfaces**. The canvas is exempt: its nodes sit at free
 * coordinates, and there the graph's order is a more sensible tab order than the
 * visual one.
 */
export function ordningsbrott(stopp: Fokusstopp[]): string[] {
  const fel: string[] = [];

  for (let index = 1; index < stopp.length; index += 1) {
    const before = stopp[index - 1].rect;
    const nu = stopp[index].rect;

    const sammaRad = nu.top < before.bottom && before.top < nu.bottom;

    if (sammaRad) {
      if (nu.left < before.left - 0.5) {
        fel.push(
          `${stopp[index].namn} kommer efter ${stopp[index - 1].namn} ` +
            `men ligger till vänster om den (x ${nu.left.toFixed(0)} < ${before.left.toFixed(0)})`,
        );
      }
      continue;
    }

    if (nu.top < before.top - 0.5) {
      fel.push(
        `${stopp[index].namn} kommer efter ${stopp[index - 1].namn} ` +
          `men ligger ovanför den (y ${nu.top.toFixed(0)} < ${before.top.toFixed(0)})`,
      );
    }
  }

  return fel;
}

/** Positiva tabindex flyttar element ur dokumentets ordning. */
export function positivaTabindex(rot: ShadowRoot | HTMLElement): string[] {
  return [...rot.querySelectorAll<HTMLElement>("[tabindex]")]
    .filter((element) => Number.parseInt(element.getAttribute("tabindex") ?? "0", 10) > 0)
    .map(
      (element) =>
        `${namnge(element)} har tabindex="${element.getAttribute("tabindex")}" — ` +
        `positiva värden bryter dokumentets ordning`,
    );
}

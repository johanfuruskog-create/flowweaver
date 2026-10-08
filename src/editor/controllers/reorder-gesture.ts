/**
 * Arranging a list by hand: one gesture, wherever a list needs arranging.
 *
 * ## Why this is not in the component that first needed it
 *
 * It was, for a day. The version list got a grip, a threshold, hysteresis, a
 * lift and a slide, and every one of those was a separate report from somebody
 * using it — *it does not work with a finger*, *it jumps back and forth*, *it
 * is a bit too sensitive*, *the row glides down too fast*. Five rounds to get
 * one gesture to feel right.
 *
 * The answer options in a question need the same gesture. Copying it there
 * would be a second copy of five rounds of tuning, and the copy is the one
 * nobody adjusts when the sixth report arrives. Worse than the duplicated code
 * is the duplicated *feel*: a tool where arranging a list works one way here
 * and another way there is a tool that has to be learned twice.
 *
 * ## What a host has to provide
 *
 * Four things, and none of them is about pointers: the container the items sit
 * in, a way to find an item from its id, the order they are in now, and where
 * the result should go. Everything else — capture, thresholds, geometry,
 * animation — belongs here.
 *
 * ## What it refuses to do
 *
 * It never measures anything that is moving. The rows are asked for their
 * heights once, before the first pixel, and every position after that is
 * arithmetic. Reading positions during the drag was the bug behind *it jumps
 * back and forth*: a row sliding out of the way reports where it is halfway
 * there, so the pointer lands back inside the row it just left and the order
 * flickers while the hand holds still.
 */

/** How far a pointer must travel before a press becomes a drag. */
const THRESHOLD = 10;

/**
 * How far into a row the pointer must reach before the row gives up its place.
 *
 * Going down it is three quarters, going up one quarter — so the line is always
 * ahead of the direction of travel, and the half-row between the two is the gap
 * a tremor cannot cross. The textbook rule is the midpoint, and the midpoint is
 * what *a bit too sensitive* was about.
 */
const AHEAD = 0.75;
const BEHIND = 0.25;

export interface ReorderOptions {
  /** The item being taken hold of. */
  id: string;
  /** The order the list is in now. */
  order: string[];
  /** The element the items sit in; its top edge anchors the arithmetic. */
  container: HTMLElement;
  /** The element for an id, or null when it is not on screen. */
  itemFor(id: string): HTMLElement | null;
  /** The order the person settled on, once the pointer is lifted. */
  onCommit(order: string[]): void;
}

/**
 * Takes hold of an item and arranges the list until the pointer is released.
 *
 * Called from a `pointerdown` on whatever the host offers as a grip. The grip
 * needs `touch-action: none` in CSS or a finger scrolls the page instead — the
 * one part of this that cannot live in here.
 */
export function startReorder(event: PointerEvent, options: ReorderOptions): void {
  const { id, container, itemFor, onCommit } = options;

  event.preventDefault();

  const carried = itemFor(id);
  const startY = event.clientY;
  const top = container.getBoundingClientRect().top;

  /*
   * Measured once, before anything moves. See the note at the top of the file:
   * everything after this point is arithmetic on these numbers.
   */
  const heights = new Map<string, number>();

  for (const each of options.order) {
    heights.set(each, itemFor(each)?.getBoundingClientRect().height ?? 0);
  }

  let order = options.order.slice();
  let moved = false;
  let lastY = startY;

  const slotTop = (index: number, current: string[]): number => {
    let edge = top;

    for (let at = 0; at < index; at += 1) {
      edge += heights.get(current[at]) ?? 0;
    }
    return edge;
  };

  /*
   * Where in the item the pointer took hold. Without it the item would jump so
   * its top sits under the pointer — and grabbing something should not move it.
   */
  const grabOffset = startY - slotTop(order.indexOf(id), order);

  const targetIndex = (y: number, current: string[]): number => {
    const share = y > lastY ? AHEAD : BEHIND;
    let edge = top;

    for (let at = 0; at < current.length; at += 1) {
      const height = heights.get(current[at]) ?? 0;

      if (y < edge + height * share) {
        return at;
      }
      edge += height;
    }
    return current.length - 1;
  };

  /** Holds the carried item under the pointer rather than in a slot. */
  const follow = (y: number, current: string[]): void => {
    if (!carried) {
      return;
    }

    carried.style.transition = "none";
    carried.style.transform = `translateY(${
      y - grabOffset - slotTop(current.indexOf(id), current)
    }px)`;
  };

  /**
   * Puts the items in the given order and lets the ones that moved slide.
   *
   * Measured, not guessed: each item is asked where it was, moved, then asked
   * where it ended up, and the difference is put back as a transform that
   * animates away. It therefore travels exactly the distance it moved, whatever
   * the item heights are. The technique is old enough to have a name — FLIP.
   *
   * The carried item is left out; it is being held under the pointer, and an
   * item that springs after the finger reads as lag rather than as motion.
   */
  const arrange = (next: string[]): void => {
    const before = new Map<HTMLElement, number>();

    for (const each of next) {
      const element = itemFor(each);

      if (element) {
        before.set(element, element.getBoundingClientRect().top);
      }
    }

    for (const each of next) {
      const element = itemFor(each);

      if (element) {
        container.appendChild(element);
      }
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    for (const [element, was] of before) {
      const delta = was - element.getBoundingClientRect().top;

      if (!delta || element === carried) {
        continue;
      }

      element.style.transition = "none";
      element.style.transform = `translateY(${delta}px)`;

      requestAnimationFrame(() => {
        element.style.transition = "";
        element.style.transform = "";
      });
    }
  };

  const onMove = (move: PointerEvent) => {
    if (!moved && Math.abs(move.clientY - startY) < THRESHOLD) {
      return;
    }

    if (!moved && carried) {
      carried.dataset.dragging = "";
    }
    moved = true;

    const from = order.indexOf(id);
    const to = targetIndex(move.clientY, order);

    lastY = move.clientY;

    if (from >= 0) {
      follow(move.clientY, order);
    }

    if (from < 0 || to === from) {
      return;
    }

    order = order.slice();
    order.splice(to, 0, ...order.splice(from, 1));
    arrange(order);
    follow(move.clientY, order);
  };

  const onUp = () => {
    /*
     * Heard on the window, not on the grip.
     *
     * Pointer capture is the obvious tool and it does not survive this gesture:
     * showing where an item will land moves it in the DOM, and moving an
     * element releases the capture it held. From that moment the events go to
     * whatever happens to be under the pointer, and the drag stops halfway with
     * no sign of why.
     */
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);

    if (carried) {
      // Let go of it where it is and let it settle with the same motion the
      // others used. Snapping it into place undoes what the animation is for.
      carried.style.transition = "";
      carried.style.transform = "";
      delete carried.dataset.dragging;
    }

    if (moved) {
      onCommit(order);
    }
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

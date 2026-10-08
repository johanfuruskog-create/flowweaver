/**
 * The side panel's left edge, dragged by the editor to set the panel's width.
 * Story 141 (Johan 29/9: *"Kunna själv justera höger panels bredd som man
 * brukar kunna göra. Genom att klicka på kanten och dra."*).
 *
 * ## Not `reorder-gesture.ts`
 *
 * That one was measured for this first, as the IDEAS entry asked. It is built
 * for rows in a list: a threshold before anything moves, hysteresis so a row
 * does not flicker between two slots, and neighbours that glide aside. An edge
 * has none of those — the width follows the pointer from the first pixel and
 * there is nothing to swap with. Sharing it would have meant switching all
 * three off.
 *
 * ## The bounds live in two places, on purpose not twice
 *
 * The **stylesheet** holds the width inside `clamp(380px, width,
 * max(380px, ceiling))`, so a window that shrinks after a drag reflows without
 * any script. **This file** clamps the number it reports and puts in
 * `aria-value*`, because a screen reader and the host need a number, not a CSS
 * expression. Both read the same numbers: the stylesheet through
 * `--guide-editor-panel-floor` and `--guide-editor-canvas-keeps`, set from
 * here on the frame, against a room it knows by its own percentages.
 *
 * ## The ceiling is the room the panel may cover, less 200 (story 145)
 *
 * Until 7/10 the panel stood beside the canvas, and the ceiling was the
 * editor's width less 620 — the room the toolbar's menus needed beside it.
 * Since story 145 the panel lies over the canvas and the toolbar spans the
 * whole editor above both, so that rule no longer guards anything. What the
 * panel may cover is the canvas and the rail it opened from; it leaves 200 px
 * of that for the canvas's own controls — the prototype's tried value, taken
 * as the rule until Johan settles story 145's open question 2. The 380 floor
 * is story 141's and stands.
 *
 * ## The library remembers nothing (K6e)
 *
 * It applies a width and announces a finished change. The host decides whether
 * to keep it; the example site does, next to theme and colour scale.
 */

/** The panel never goes below this: the card with a condition group. */
export const PANEL_FLOOR = 380;

/** What the open panel leaves of the room it lies over (story 145, open question 2). */
export const CANVAS_KEEPS = 200;

/** Arrow keys move the edge this far; with Shift, `SHIFT_STEP`. */
export const KEY_STEP = 16;
export const SHIFT_STEP = 64;

/** The widest the panel may be over this much room — never below the floor. */
export function panelCeiling(roomWidth: number): number {
  return Math.max(PANEL_FLOOR, Math.floor(roomWidth - CANVAS_KEEPS));
}

/** A width held inside floor and ceiling, in whole pixels. */
export function clampPanelWidth(width: number, roomWidth: number): number {
  return Math.round(Math.min(Math.max(width, PANEL_FLOOR), panelCeiling(roomWidth)));
}

/**
 * The `panel-width` attribute as a number, or null for "use the default".
 *
 * Anything that is not a positive finite number is the default rather than an
 * error: the attribute is usually written back from the host's own storage, and
 * a value spoiled there should cost the editor its remembered width, nothing
 * more.
 */
export function parsePanelWidth(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;

  const width = Number.parseFloat(value);

  return Number.isFinite(width) && width > 0 ? Math.round(width) : null;
}

export interface PanelResizeOptions {
  /** The editor's frame, which carries the bounds as custom properties. */
  frame: HTMLElement;
  /** The panel itself, measured for the current width. */
  panel: HTMLElement;
  /** The separator the editor drags or focuses. */
  handle: HTMLElement;
  /**
   * The toolbar, whose menus open down over the canvas's right edge — where
   * 22 px of the handle lie, and the panel stacks above the toolbar on
   * purpose. While it says `data-menu-open` the handle stands aside, or the
   * menu rows' last 22 px would start a drag (measured 29/9:
   * `editor-toolbar-menu-inside`, "Visa som lista" hit the handle at 900 × 600).
   * Watched here rather than with `:has()`, which the CSS ratchet holds.
   */
  menuHolder?: HTMLElement | null;
  /**
   * The canvas, whose top the handle starts at. Above it the toolbar's row
   * reaches the panel's edge with its last control ("Hjälp" at 900 × 600,
   * measured 29/9), and the rows above the toolbar come and go — a notice, the
   * language row — so the top is measured, not a fixed header height.
   */
  canvas?: HTMLElement | null;
  /**
   * The room the panel may lie over, in px: the canvas and the rail. Measured
   * by the editor, which knows its own layout; the editor's width without it.
   */
  room?: () => number;
  /** Draws a width (null: the default) — during a drag, on every move. */
  apply(width: number | null): void;
  /** A finished change: once per drag, once per key, once per reset. */
  done(width: number | null): void;
}

/**
 * Wires the handle. Returns the function that unwires it.
 *
 * `sync()` on the returned object refreshes `aria-value*` from what is drawn;
 * the editor calls it after the attribute sets a width.
 */
export function attachPanelResize(options: PanelResizeOptions): {
  detach(): void;
  sync(): void;
} {
  const { frame, panel, handle, apply, done } = options;

  frame.style.setProperty("--guide-editor-panel-floor", `${PANEL_FLOOR}px`);
  frame.style.setProperty("--guide-editor-canvas-keeps", `${CANVAS_KEEPS}px`);

  const roomWidth = options.room ?? ((): number => frame.getBoundingClientRect().width);
  const panelWidth = (): number => Math.round(panel.getBoundingClientRect().width);

  const sync = (): void => {
    if (options.canvas) {
      const top = options.canvas.getBoundingClientRect().top - panel.getBoundingClientRect().top;

      handle.style.top = `${Math.max(0, Math.round(top))}px`;
    }
    const ceiling = panelCeiling(roomWidth());

    handle.setAttribute("aria-valuemin", String(PANEL_FLOOR));
    handle.setAttribute("aria-valuemax", String(ceiling));
    handle.setAttribute("aria-valuenow", String(panelWidth()));
  };

  /** Draws a width and reports it — the end of a key press or a drag. */
  const settle = (width: number): void => {
    apply(width);
    sync();
    done(width);
  };

  let drag: { pointerId: number; startX: number; startWidth: number; width: number } | null =
    null;
  let shield: HTMLElement | null = null;

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || drag) return;

    /*
     * Stops the compatibility `mousedown`, which is what would start a text
     * selection and move focus out of a field the editor is typing in (point 7).
     * `click` and `dblclick` still arrive.
     */
    event.preventDefault();

    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // No active pointer with that id (the minimap's case, node-editor.ts).
      // The drag still follows as long as the pointer stays on the handle.
    }

    const width = panelWidth();

    drag = { pointerId: event.pointerId, startX: event.clientX, startWidth: width, width };
    frame.classList.add("is-resizing-panel");
    /*
     * A shield over the whole frame for the length of the drag. The class on
     * the frame sets `cursor: col-resize`, but a node on the canvas
     * (`cursor: move`) and a field in the panel (`text`, a button's
     * `pointer`) sit inside their own shadow roots with their own cursor
     * rules, and the pointer wandering over them showed theirs — on Windows
     * the hand is white, so "helvit och osynlig" (Johan 29/9). Hit-testing
     * lands on the shield instead; the events already go to the handle by
     * pointer capture.
     */
    shield = document.createElement("div");
    shield.className = "guide-editor__resize-shield";
    shield.setAttribute("aria-hidden", "true");
    frame.append(shield);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.pointerId) return;

    // The panel is on the right: the edge moving left makes it wider.
    drag.width = clampPanelWidth(drag.startWidth + drag.startX - event.clientX, roomWidth());
    apply(drag.width);
    sync();
  };

  const onPointerEnd = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.pointerId) return;

    const { startWidth, width } = drag;

    drag = null;
    frame.classList.remove("is-resizing-panel");
    shield?.remove();
    shield = null;

    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }

    // A press without a move is not a change — and a double click is two of them.
    if (width !== startWidth) settle(width);
  };

  const reset = (): void => {
    apply(null);
    sync();
    done(null);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const current = panelWidth();
    const step = event.shiftKey ? SHIFT_STEP : KEY_STEP;
    let next: number | null;

    switch (event.key) {
      case "ArrowLeft":
        next = current + step;
        break;
      case "ArrowRight":
        next = current - step;
        break;
      case "Home":
        next = PANEL_FLOOR;
        break;
      case "End":
        next = panelCeiling(roomWidth());
        break;
      case "Enter":
        event.preventDefault();
        event.stopPropagation();
        reset();
        return;
      default:
        return;
    }

    // Handled here: the canvas and the editor's own shortcuts must not see it.
    event.preventDefault();
    event.stopPropagation();

    const width = clampPanelWidth(next, roomWidth());

    if (width !== current) settle(width);
  };

  const observer = new ResizeObserver(() => sync());
  const menus = new MutationObserver(() => {
    handle.classList.toggle("is-standing-aside", Boolean(options.menuHolder?.hasAttribute("data-menu-open")));
  });

  if (options.menuHolder) {
    menus.observe(options.menuHolder, { attributes: true, attributeFilter: ["data-menu-open"] });
  }

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", onPointerEnd);
  handle.addEventListener("pointercancel", onPointerEnd);
  handle.addEventListener("dblclick", reset);
  handle.addEventListener("keydown", onKeyDown);
  observer.observe(frame);
  observer.observe(panel);
  if (options.canvas) observer.observe(options.canvas);
  sync();

  return {
    sync,
    detach(): void {
      handle.removeEventListener("pointerdown", onPointerDown);
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", onPointerEnd);
      handle.removeEventListener("pointercancel", onPointerEnd);
      handle.removeEventListener("dblclick", reset);
      handle.removeEventListener("keydown", onKeyDown);
      observer.disconnect();
      menus.disconnect();
    },
  };
}

/**
 * The two icons the graphic profile puts on a local action (Visuell
 * hierarki, B3 30/9): the bin on *Ta bort …* and the plus on *Lägg till …*.
 *
 * One drawing each for the whole product — the panel's cards and rows, the
 * node templates and the visitor's repeated page — because the profile's
 * first question is whether the same icon means the same thing everywhere,
 * and two drawings of a bin is how it stops doing so. They live on the
 * viewer's side because the visitor's page needs them and the viewer never
 * imports the editor.
 *
 * 24 grid, 2 px round stroke, `currentColor` (11. Ikoner): the button's
 * colour is the icon's, so the destructive red and the primary blue come from
 * the button's token and nothing here. The box — 18 × 18 — is set by each
 * component's stylesheet, where the button's layout is.
 */
export const TRASH_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

export const ADD_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

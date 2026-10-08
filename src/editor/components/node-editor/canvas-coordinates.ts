/**
 * The conversion between a node's position and where it lands on screen.
 *
 * The canvas has two coordinate spaces, and they were easily confused while the
 * arithmetic lay scattered:
 *
 * - **Node space** — `node.position`. Nodes are absolutely placed in a layer
 *   that itself carries the workspace origin, so the position goes straight to
 *   `left`.
 * - **The workspace** — the whole area the nodes sit in. Here `originX`/`originY`
 *   are added, and that is needed only when measuring the content's extent or
 *   drawing the minimap.
 *
 * Gathering them has a value today — five identical calculations become one name
 * — and one tomorrow: if we decide to mirror the canvas in a right-to-left
 * language, these are the functions that change, not every place that happens to
 * write a `left`. See open question 3 in
 * `docs/STORIES/009-guiden-pa-ett-sprak-som-lases-at-andra-hallet.md`.
 */

export interface Point {
  x: number;
  y: number;
}

export interface WorkspaceOrigin {
  originX: number;
  originY: number;
}

/**
 * Places an element at a node position.
 *
 * `offset` is the child's position inside a page; without a page it is zero.
 */
export function placeAt(
  element: HTMLElement,
  position: Point,
  offset: Point = { x: 0, y: 0 }
): void {
  element.style.left = `${position.x + offset.x}px`;
  element.style.top = `${position.y + offset.y}px`;
}

/** Where a node position lands in the workspace, with the origin included. */
export function toWorkspacePoint(
  position: Point,
  origin: WorkspaceOrigin
): Point {
  return {
    x: origin.originX + position.x,
    y: origin.originY + position.y,
  };
}

/** Back from the workspace to a node position. */
export function fromWorkspacePoint(
  point: Point,
  origin: WorkspaceOrigin
): Point {
  return {
    x: point.x - origin.originX,
    y: point.y - origin.originY,
  };
}

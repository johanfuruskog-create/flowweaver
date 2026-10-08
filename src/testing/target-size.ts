/**
 * Target size, measured (K6 in `docs/KRAV.md`).
 *
 * Every control in a root is measured against a minimum; what comes back is a
 * list of the ones that fall short, worded so the failure says which control
 * and by how much. Two callers with two floors: the layout matrix holds the
 * WCAG 2.5.8 minimum (24) over hostile content, and the K6 gate holds the
 * 44 px of 2.5.5 over the viewer's own controls — the viewer runs on phones of
 * people who did not choose it.
 *
 * The **effective** area is what counts: an 18×18 radio inside a clickable
 * label is the label, because that is what you hit. Only the label's own
 * control gets that credit — a button or a slider that merely sits inside a
 * label (story 095's − / + and range) is measured as itself, since clicking it
 * activates it and not the label's field.
 */
export function targetSizeViolations(root: ParentNode, min: number): string[] {
  return [
    ...root.querySelectorAll<HTMLElement>("input, button, select, textarea"),
  ].flatMap((control) => {
    if (control.hidden || control.getAttribute("type") === "hidden") {
      return [];
    }

    /*
     * A field outside both the tab order and the accessibility tree is no
     * target — WCAG applies to what somebody can hit. The honeypot (story
     * 050) is exactly that: aria-hidden, tabindex -1, 1×1 px under a
     * clip-path, put there so that only robots find it.
     */
    if (
      control.getAttribute("aria-hidden") === "true" &&
      control.getAttribute("tabindex") === "-1"
    ) {
      return [];
    }

    const label = control.closest("label");
    const area = (label && label.control === control ? label : control).getBoundingClientRect();

    if (area.width === 0 && area.height === 0) {
      return [];
    }

    // Half a hundredth: `bottom - top` in floating point gives 43.999… for a 44 px box.
    return area.width >= min - 0.01 && area.height >= min - 0.01
      ? []
      : [
          `${control.tagName.toLowerCase()}${describe(control)} har träffyta ` +
            `${area.width.toFixed(0)}×${area.height.toFixed(0)}, minst ${min}×${min} krävs`,
        ];
  });
}

/** Enough of the element to find it again: its type, class, or label. */
function describe(control: HTMLElement): string {
  const type = control.getAttribute("type");
  const name = control.getAttribute("aria-label") ?? control.className;
  return `${type ? `[type=${type}]` : ""}${name ? ` (${name})` : ""}`;
}

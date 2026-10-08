/**
 * Measures colour contrast in a rendered component.
 *
 * For tests only — no entry under `src/entries/` imports it, so it never reaches
 * the package (guarded by `entries.test.ts`).
 *
 * ## Why measure rather than review
 *
 * `tokens.scss` carries traces of a review done by hand: "AA-audit: 2.96 →
 * 3.75". That kind of check holds on the day it is done. A token changed six
 * months later knows nothing about it. **K3** promises accessibility; a promise
 * without measurement is a hope.
 */

const KANVAS = document.createElement("canvas").getContext("2d", {
  willReadFrequently: true,
})!;

type Rgba = [number, number, number, number];

/**
 * Resolves any CSS colour string to RGBA.
 *
 * Goes through a canvas rather than a parser of our own: the browser already
 * knows `oklab()`, `color-mix()` and everything else, and does it the same way
 * it does when rendering. Our own regex would have missed exactly the modern
 * formats the code actually uses.
 */
export function tillRgba(colour: string): Rgba {
  KANVAS.clearRect(0, 0, 1, 1);
  // Reset first: an invalid string leaves fillStyle untouched, and we would
  // then have measured the previous colour without noticing.
  KANVAS.fillStyle = "#000000";
  KANVAS.fillStyle = colour;
  KANVAS.fillRect(0, 0, 1, 1);

  const [r, g, b, a] = KANVAS.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

/** Lays `over` on top of `under`. */
function blanda(under: Rgba, över: Rgba): Rgba {
  const a = över[3];
  return [
    över[0] * a + under[0] * (1 - a),
    över[1] * a + under[1] * (1 - a),
    över[2] * a + under[2] * (1 - a),
    1,
  ];
}

/** Relativ luminans enligt WCAG. */
function luminans([r, g, b]: Rgba): number {
  const kanal = (value: number): number => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

/**
 * WCAG contrast between two OPAQUE colours. Refuses a colour with alpha
 * below 1, rather than composing one.
 *
 * `transparent` — `[0, 0, 0, 0]` out of `tillRgba` — is `background-color`'s
 * initial value, so it is what every element without one of its own carries.
 * Read by R, G and B alone, that is indistinguishable from opaque black: a
 * fully see-through surface used to score 21:1 against white here — the
 * confidently wrong kind of number, since it reads as a perfect pass rather
 * than as nothing measured (found by QA, 13/9).
 *
 * Composing the real colour needs to know what lies BEHIND the transparent
 * layer, and this function only ever sees the one colour it was handed —
 * `effektivBakgrund` is the caller that knows the DOM and does that
 * compositing, and its result always carries alpha 1, so a caller that goes
 * through it never trips this. The one token in the codebase drawn as
 * something real while staying translucent is `--fw-focus-ring`
 * (`rgb(79 70 229 / 35%)`); nothing measures it today, and the day something
 * does, that caller composes it against its actual backdrop on purpose —
 * this function will not guess on its behalf.
 */
export function kontrast(foreground: Rgba, bakgrund: Rgba): number {
  if (foreground[3] < 1 || bakgrund[3] < 1) {
    throw new Error(
      `kontrast() vägrar en genomskinlig färg (alfa ${foreground[3]} / ${bakgrund[3]}) — ` +
        "komposition mot den faktiska bakgrunden krävs, gissning duger inte. " +
        "Använd effektivBakgrund(), eller komponera själv mot en känd bakgrund innan mätningen.",
    );
  }

  const [ljus, mörk] = [luminans(foreground), luminans(bakgrund)].sort(
    (a, b) => b - a,
  );

  return (ljus + 0.05) / (mörk + 0.05);
}

/** The next element upwards, across shadow roots. */
function parent(element: Element): Element | null {
  if (element.parentElement) {
    return element.parentElement;
  }

  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

/**
 * The background a text actually lands on.
 *
 * Elements are usually transparent, so the colour comes from an ancestor. The
 * layers are blended in order until one is opaque; if none is found, white is
 * assumed, like a page with no background of its own.
 */
export function effektivBakgrund(element: Element): Rgba {
  const lager: Rgba[] = [];
  let nod: Element | null = element;

  while (nod) {
    const colour = tillRgba(getComputedStyle(nod).backgroundColor);

    if (colour[3] > 0) {
      lager.push(colour);
    }

    if (colour[3] >= 1) {
      break;
    }

    nod = parent(nod);
  }

  return lager
    .reverse()
    .reduce<Rgba>((under, över) => blanda(under, över), [255, 255, 255, 1]);
}

/**
 * Large text has a lower requirement (3:1) under WCAG: 24px, or 18.66px bold.
 */
function isLargeText(stil: CSSStyleDeclaration): boolean {
  const px = Number.parseFloat(stil.fontSize);
  const fet = Number.parseInt(stil.fontWeight, 10) >= 700;

  return px >= 24 || (fet && px >= 18.66);
}

/** Combined opacity, including ancestors'. */
function effektivOpacitet(element: Element): number {
  let value = 1;
  let nod: Element | null = element;

  while (nod) {
    value *= Number.parseFloat(getComputedStyle(nod).opacity) || 0;
    nod = parent(nod);
  }

  return value;
}

function harEgenText(element: Element): boolean {
  return [...element.childNodes].some(
    (barn) => barn.nodeType === Node.TEXT_NODE && barn.textContent?.trim(),
  );
}

/**
 * Exceptions WCAG itself makes, not conveniences.
 *
 * - **Disabled controls** are explicitly exempt (1.4.3, "Incidental"). Without
 *   this exception every disabled field fails immediately.
 * - **Hidden text** has no contrast to speak of.
 * - **Dimmed content** (opacity below 1) is deliberately receded — the canvas
 *   dimming connections outside the focus, for instance.
 */
function undantaget(element: Element): boolean {
  const stil = getComputedStyle(element);

  if (stil.visibility === "hidden" || stil.display === "none") {
    return true;
  }

  if (element.closest("[disabled], [aria-disabled='true'], [aria-hidden='true']")) {
    return true;
  }

  return effektivOpacitet(element) < 1;
}

export interface Kontrastkrav {
  /** Namn som hamnar i felmeddelandet. */
  namn: string;
}

/**
 * Every visible text in `root` that fails WCAG AA.
 *
 * Returns a list of descriptions — an empty list means everything holds.
 */
export function kontrastbrott(root: ShadowRoot | HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLElement>("*")]
    .filter((element) => harEgenText(element) && !undantaget(element))
    .flatMap((element) => {
      const stil = getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        return [];
      }

      const foreground = blanda(
        effektivBakgrund(element),
        tillRgba(stil.color),
      );
      const kvot = kontrast(foreground, effektivBakgrund(element));
      const krav = isLargeText(stil) ? 3 : 4.5;

      if (kvot >= krav) {
        return [];
      }

      const text = (element.textContent ?? "").trim().slice(0, 30);

      return [
        `${element.tagName.toLowerCase()}.${element.className || "—"} ` +
          `"${text}": ${kvot.toFixed(2)}:1, krävs ${krav}:1 ` +
          `(${stil.color} på ${effektivBakgrund(element).slice(0, 3).map(Math.round).join(",")})`,
      ];
    });
}

/**
 * Icon-only controls that fail to stand out from what is behind them.
 *
 * ## Why a second sweep beside `kontrastbrott`
 *
 * That one walks **text**, which is WCAG 1.4.3. A control identified by a shape
 * rather than a word is 1.4.11, a different criterion with a different threshold
 * — and nothing measured it until a handle shipped at 1.41:1 against the canvas
 * and somebody noticed by looking.
 *
 * ## The rule
 *
 * A control that **draws itself** — a fill different from the backdrop, or a
 * border — is identified by that shape, so the shape must reach 3:1. A control
 * that draws nothing is identified by its glyph, so the glyph must.
 *
 * The first attempt took the best of all three parts, and both mutations walked
 * past it: a handle with an invisible edge still passed because its glyph was
 * legible against its own fill — which is exactly the button Johan reported, one
 * that cannot be told apart from the canvas it floats on. Being able to read the
 * dots is not the same as being able to see the button.
 *
 * A port's surface-coloured halo is why the *best* of fill and border decides
 * rather than the border alone: that ring is separation, not boundary, and
 * measuring it as the edge reported 1.00:1 for a dot sitting at 6.29:1. A sweep
 * whose failures are usually noise is read as noise the day it is right.
 *
 * Buttons carrying a word are skipped: their text is measured by `kontrastbrott`
 * already, and text is what identifies them.
 */
export function ikonkontrastbrott(root: ShadowRoot | HTMLElement): string[] {
  const KRAV = 3;

  return [...root.querySelectorAll<HTMLElement>("button")].flatMap((element) => {
    const stil = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    if (
      rect.width === 0 ||
      rect.height === 0 ||
      stil.visibility === "hidden" ||
      stil.display === "none"
    ) {
      return [];
    }

    // Two characters covers "⋯", "✕" and a digit; a word is somebody else's job.
    if ((element.textContent ?? "").trim().length > 2) {
      return [];
    }

    const bakom = effektivBakgrund(element.parentElement ?? element);
    const genomskinlig = stil.backgroundColor.endsWith(", 0)");
    const yta = genomskinlig ? null : tillRgba(stil.backgroundColor);
    const harKant =
      parseFloat(stil.borderTopWidth) > 0 && stil.borderTopStyle !== "none";

    const ytkvot = yta ? kontrast(yta, bakom) : 0;
    const kantkvot = harKant ? kontrast(tillRgba(stil.borderTopColor), bakom) : 0;
    /*
     * The glyph is composited over what is behind it before it is measured, the
     * same way `kontrastbrott` does. Without that a half-transparent glyph is
     * read as though it were solid — a mutation fading the node button's dots to
     * 12% opacity passed the first version of this sweep, which is precisely the
     * sort of "too faint to see" this exists to catch.
     */
    const underGlyf = yta ?? bakom;
    const glyfkvot = kontrast(blanda(underGlyf, tillRgba(stil.color)), underGlyf);

    const ritarSigSjälv = Boolean(yta) || harKant;
    const kvot = ritarSigSjälv ? Math.max(ytkvot, kantkvot) : glyfkvot;
    const vad = ritarSigSjälv ? "formen" : "glyfen";

    if (kvot >= KRAV) {
      return [];
    }

    const namn =
      element.className ||
      element.dataset.action ||
      element.getAttribute("aria-label") ||
      "(namnlös)";

    return [
      `button.${namn}: ${vad} ${kvot.toFixed(2)}:1, krävs ${KRAV}:1 ` +
        `(yta ${ytkvot.toFixed(2)}, kant ${kantkvot.toFixed(2)}, glyf ${glyfkvot.toFixed(2)})`,
    ];
  });
}

/**
 * Roles that make an element a WIDGET — something a visitor finds, presses, or
 * reads a state off — as opposed to a landmark, a container, or a message.
 *
 * Widened here (tillganglighet sweep, 13/9) after finding two real 1.4.11
 * failures this selector could not see: the progress meter (`role="progressbar"`,
 * a `<div>`) and the editor's node list row (`role="treeitem"`, a `<div>`). Both
 * are fixed now (`guide-preview.scss`, `guide-outline.scss`) — this list is what
 * lets the SAME function catch the next one, instead of a hand-rolled test per
 * component forever.
 *
 * **Deliberately not every `role` in the codebase.** `role="tree"`,
 * `"listbox"`, `"menu"`, `"toolbar"`, `"tablist"`, `"dialog"`, `"group"`,
 * `"alert"`, `"status"`, `"note"` and `"img"` are containers or messages, not
 * controls — most of them draw no edge or fill of their own at all, so a blind
 * `[role]` selector would report them at 0:1 and be wrong, not thorough. Tried
 * before this list was written: it returned noise from every one of them.
 *
 * `option` is here even though `guide-editor`'s quick-open hit
 * (`.guide-editor__quick-open-hit`, a `<div role="option">`) has never actually
 * been measured — the search never rendered a hit in this sweep. It stays in
 * the selector anyway so the day someone does render one, the gate sees it
 * rather than the codebase trusting an unmeasured guess of "probably fine".
 *
 * `switch`, `tab` and `menuitemcheckbox` are here for the same forward-looking
 * reason even though every current instance is already a real `<input>` or
 * `<button>` and therefore already matched below — a future rewrite of one of
 * them onto a `<div>` should not silently leave the selector behind.
 */
const WIDGET_ROLES = [
  "progressbar",
  "treeitem",
  "option",
  "switch",
  "tab",
  "menuitemcheckbox",
] as const;

/**
 * Controls whose own edge is too faint to find — WCAG 1.4.11, 3:1.
 *
 * ## What this can see, and what it cannot
 *
 * PRAXIS regel 4's second question — a gate is only as good as what it can
 * observe. This one sees `input`, `select`, `textarea`, `button`, and anything
 * carrying one of `WIDGET_ROLES` above. It reads two properties an author can
 * draw an edge with: the top border (`border-top-*`, taken to stand for all
 * four sides — see `inramad` below) and the `outline` a selected `treeitem`
 * uses instead of a border.
 *
 * It CANNOT see, and nothing here should be read as covering:
 *
 * - **A sibling that carries the real visual identity of a control whose own
 *   role is native.** `.guide-preview__rating-mark` is exactly this: the real
 *   control is a visually-hidden `<input type="radio">` (matched, but 1×1px
 *   and invisible), while the `<span>` beside it — which is what a sighted
 *   visitor actually sees — carries no role of its own and is invisible to
 *   this function by construction. Fixed by hand, measured by hand
 *   (`guide-preview-rating-contrast.browser.test.ts`), and it has to stay that
 *   way: there is no role to widen the selector onto.
 * - **`box-shadow`.** Several controls (the marking dot, node cards) use a
 *   shadow rather than a border or outline to separate themselves from an
 *   unpredictable background. Not read here.
 * - **A boundary on any side but the top**, on the assumption the four sides
 *   share a colour — true everywhere it has been checked, not verified per
 *   element.
 * - **Contrast against an image.** `effektivBakgrund` composites CSS colours;
 *   a control drawn over a photograph (the marking dot) is measured against
 *   nothing real, so callers must not mount one under this sweep and trust
 *   the number.
 *
 * ## What counts as a boundary
 *
 * Only a control that **draws itself**. Three kinds are deliberately passed over,
 * and each was a false positive first:
 *
 * - **Disabled ones.** The standard exempts inactive components, and the
 *   viewer's "Tillbaka" measured 1.24:1 on the first step purely because it was
 *   disabled and wearing a deliberately fainter edge.
 * - **Ones the browser draws.** A checkbox with `appearance: auto` is painted by
 *   the platform whatever the computed background says; ours measured 1.00:1
 *   against its surroundings and is not ours to repaint.
 * - **Ones with no boundary at all.** A button with `border: 0` and a
 *   `border-top` is a text button under a divider. 1.4.11 asks about controls
 *   *identified* by a boundary; where there is none, the text carries the job
 *   and 1.4.3 covers it. Checking `borderTopWidth` alone read that separator as
 *   an edge.
 *
 * ## Why the better of edge, outline and surface
 *
 * Any of the three can carry it: a filled button is found by its surface, an
 * outlined one by its border, a selected tree row by its `outline`. Requiring
 * all three would fail every control that only draws one of them, which is
 * most of them.
 */
export function kontrollkantsbrott(root: ShadowRoot | HTMLElement): string[] {
  const KRAV = 3;
  const roleSelector = WIDGET_ROLES.map((roll) => `[role="${roll}"]`).join(", ");
  const kontroller = [
    ...root.querySelectorAll<HTMLElement>(`input, select, textarea, button, ${roleSelector}`),
  ];

  return kontroller.flatMap((element) => {
    const stil = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    if (
      rect.width === 0 ||
      rect.height === 0 ||
      stil.visibility === "hidden" ||
      stil.display === "none" ||
      stil.opacity === "0" ||
      (element as HTMLButtonElement).disabled
    ) {
      return [];
    }

    const sidor = ["Top", "Right", "Bottom", "Left"] as const;
    const inramad =
      stil.borderTopStyle !== "none" &&
      sidor.every(
        (sida) =>
          parseFloat(stil[`border${sida}Width` as keyof CSSStyleDeclaration] as string) > 0,
      );
    const outlinad =
      stil.outlineStyle !== "none" && parseFloat(stil.outlineWidth) > 0;
    const harEnKant = inramad || outlinad;

    // The platform's own rendering, which no author colour describes.
    if (!harEnKant && stil.appearance === "auto") {
      return [];
    }

    const bakom = effektivBakgrund(element.parentElement ?? element);
    const genomskinlig = stil.backgroundColor.endsWith(", 0)");
    const kantVärden = [
      inramad ? kontrast(tillRgba(stil.borderTopColor), bakom) : 0,
      outlinad ? kontrast(tillRgba(stil.outlineColor), bakom) : 0,
    ];
    const kant = Math.max(...kantVärden);
    const yta = genomskinlig ? 0 : kontrast(tillRgba(stil.backgroundColor), bakom);
    const kvot = Math.max(kant, yta);

    // Nothing drawn: a text button, or a control the browser owns.
    if (!harEnKant && yta <= 1.05) {
      return [];
    }

    if (kvot >= KRAV) {
      return [];
    }

    const namn =
      (element.className || "").toString().split(" ")[0] ||
      element.getAttribute("data-action") ||
      element.getAttribute("aria-label") ||
      `${element.tagName.toLowerCase()}[${(element as HTMLInputElement).type ?? element.getAttribute("role") ?? ""}]`;

    return [
      `${namn}: ${kvot.toFixed(2)}:1, krävs ${KRAV}:1 ` +
        `(kant ${kant.toFixed(2)}, yta ${yta.toFixed(2)})`,
    ];
  });
}

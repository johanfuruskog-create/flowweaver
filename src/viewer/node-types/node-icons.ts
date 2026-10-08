/**
 * The built-in node types' icons: filled silhouettes on a 512 grid.
 *
 * First drawn as 1.6px strokes (2026-08-31, ur designskisserna); Johan
 * measured them on his screen the same evening — *"blev lite pixliga och
 * flöt ihop"* — and chose the filled manner after seeing the same motifs in
 * both styles side by side. A silhouette keeps its mass at 17px where a thin
 * stroke smears; the pixelation itself was the screenshot's fault (1x on a
 * dense screen), but the density critique was real and this is its answer.
 *
 * ## The rules of the set
 *
 * - `viewBox="0 0 512 512"`, `fill="currentColor"` on the root and never a
 *   colour of its own: the badge sets the ink per node family
 *   (`--fw-node-*-ink`), and the icon contrast gate (`ikonkontrastbrott`)
 *   measures that ink against the badge in BOTH themes. Dark mode needs no
 *   code here — the tokens darken the tint and lighten the ink.
 * - Cut-outs (the calendar's rows, the shield's tick) carry `class="cut"`;
 *   the palette stylesheet fills them with the badge's own tint per family.
 *   That is what lets a hole follow the theme instead of being white.
 * - No text glyphs: text scales with fonts, silhouettes do not.
 *
 * ## What is deliberately NOT here
 *
 * Custom node types and templates keep their typed icon (a letter, an emoji —
 * their author's choice, stored in the graph). This map covers the built-ins
 * only; the palette falls back to the typed string exactly as before.
 *
 * ## Why it lives beside the registry
 *
 * It was the palette's own file until the node header wanted the same icon
 * (Johan, 2026-09-01: "i header"). Two consumers of one map means the map
 * lives where both find it — next to the node types it describes — rather
 * than one component importing from inside another.
 */

const icon = (paths: string): string =>
  `<svg viewBox="0 0 512 512" width="18" height="18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;

export const NODE_ICONS: Record<string, string> = {
  // A speech bubble: a question is something the visitor is asked.
  question: icon(
    '<path d="M64 64h384c27 0 48 21 48 48v224c0 27-21 48-48 48H248l-104 88v-88H64c-27 0-48-21-48-48V112c0-27 21-48 48-48z"/><circle class="cut" cx="166" cy="224" r="26"/><circle class="cut" cx="256" cy="224" r="26"/><circle class="cut" cx="346" cy="224" r="26"/>',
  ),
  "multi-choice": icon(
    '<rect x="48" y="64" width="176" height="176" rx="32"/><path class="cut" d="m102 158 34 34 66-76 24 22-88 100-58-58z"/><rect x="48" y="288" width="176" height="176" rx="32"/><rect x="272" y="120" width="192" height="56" rx="24"/><rect x="272" y="344" width="192" height="56" rx="24"/>',
  ),
  "number-question": icon(
    '<rect x="152" y="48" width="52" height="416" rx="24"/><rect x="308" y="48" width="52" height="416" rx="24"/><rect x="48" y="152" width="416" height="52" rx="24"/><rect x="48" y="308" width="416" height="52" rx="24"/>',
  ),
  "text-question": icon(
    '<rect x="80" y="64" width="352" height="72" rx="20"/><rect x="224" y="96" width="64" height="352" rx="20"/><rect x="160" y="400" width="192" height="48" rx="20"/>',
  ),
  "consent-question": icon(
    '<path d="M256 16 64 96v144c0 130 88 218 192 256 104-38 192-126 192-256V96L256 16zm105 166L241 342c-9 9-24 9-33 0l-57-57c-9-9-9-24 0-33s24-9 33 0l40 40 104-104c9-9 24-9 34 0s9 24-1 34z"/>',
  ),
  "file-question": icon(
    '<path d="m349 110-146 146a44 44 0 0 0 62 62l122-122c12-12 31-12 43 0s12 31 0 43L302 367a104 104 0 0 1-147-147L301 74c37-37 97-37 134 0s37 97 0 134L307 336c-12 12-31 12-43 0s-12-31 0-43l122-122a34 34 0 0 0-48-48z"/>',
  ),
  "autocomplete-question": icon(
    '<path d="M208 48a160 160 0 1 0 99 286l117 116c9 9 24 9 34 0 9-10 9-25 0-34L342 300A160 160 0 0 0 208 48zm0 64a96 96 0 1 1 0 192 96 96 0 0 1 0-192z"/>',
  ),
  "multi-autocomplete-question": icon(
    '<path d="M192 32a160 160 0 1 0 99 286l101 100c9 9 24 9 34 0 9-10 9-25 0-34L326 284A160 160 0 0 0 192 32zm0 64a96 96 0 1 1 0 192 96 96 0 0 1 0-192z"/><circle cx="416" cy="96" r="80"/><rect class="cut" x="392" y="84" width="48" height="24" rx="12"/><rect class="cut" x="404" y="72" width="24" height="48" rx="12"/>',
  ),
  "date-question": icon(
    '<path d="M144 32c13 0 24 11 24 24v24h176V56c0-13 11-24 24-24s24 11 24 24v24h32c35 0 64 29 64 64v32H24v-32c0-35 29-64 64-64h32V56c0-13 11-24 24-24zM24 208h464v208c0 35-29 64-64 64H88c-35 0-64-29-64-64V208zm112 72c-9 0-16 7-16 16v32c0 9 7 16 16 16h32c9 0 16-7 16-16v-32c0-9-7-16-16-16h-32z"/>',
  ),
  /*
   * A scale: three rising bars with a tick over the tallest. Not a star —
   * a star reads as *favourite*, and this is a graded answer, not a mark of
   * approval. The rise says the row is ordered, which is the one thing the
   * icon has to carry.
   */
  "rating-question": icon(
    '<rect x="48" y="304" width="96" height="160" rx="24"/><rect x="208" y="224" width="96" height="240" rx="24"/><rect x="368" y="144" width="96" height="320" rx="24"/><path d="m416 32 18 40 44 6-32 30 8 44-38-21-38 21 8-44-32-30 44-6z"/>',
  ),
  "map-question": icon(
    '<path d="M256 16C158 16 80 94 80 192c0 118 137 268 160 292 9 9 23 9 32 0 23-24 160-174 160-292 0-98-78-176-176-176z"/><circle class="cut" cx="256" cy="192" r="64"/>',
  ),
  image: icon(
    '<rect x="32" y="64" width="448" height="384" rx="48"/><circle class="cut" cx="168" cy="184" r="44"/><path class="cut" d="m96 400 96-112 72 76 88-108 96 128v16H96z"/>',
  ),
  "annotated-image": icon(
    '<rect x="32" y="64" width="448" height="384" rx="48"/><path class="cut" d="m96 400 104-120 80 84 40-44 96 96H96z"/><circle class="cut" cx="352" cy="176" r="84"/><circle cx="352" cy="176" r="44"/>',
  ),
  code: icon(
    '<path d="M184 100 32 256l152 156 44-42-112-114 112-114zM328 100l-44 42 112 114-112 114 44 42 152-156zM282 64l-96 384h44l96-384z"/>',
  ),
  page: icon(
    '<path d="M96 32h200l120 120v280c0 26-22 48-48 48H96c-26 0-48-22-48-48V80c0-26 22-48 48-48z"/><path class="cut" d="M296 32v120h120z"/><rect class="cut" x="128" y="248" width="256" height="40" rx="18"/><rect class="cut" x="128" y="336" width="192" height="40" rx="18"/>',
  ),
  "page-heading": icon(
    '<rect x="80" y="64" width="72" height="384" rx="24"/><rect x="360" y="64" width="72" height="384" rx="24"/><rect x="128" y="224" width="256" height="64" rx="24"/>',
  ),
  "page-spacer": icon(
    '<rect x="48" y="48" width="416" height="52" rx="24"/><rect x="48" y="412" width="416" height="52" rx="24"/><path d="M256 128 176 224h56v64h-56l80 96 80-96h-56v-64h56z"/>',
  ),
  rule: icon(
    '<path d="M239 26c9-9 25-9 34 0l213 213c9 9 9 25 0 34L273 486c-9 9-25 9-34 0L26 273c-9-9-9-25 0-34z"/><rect class="cut" x="150" y="239" width="140" height="34" rx="17"/><path class="cut" d="M270 256 216 202l24-24 78 78-78 78-24-24z"/>',
  ),
  calculation: icon(
    '<rect x="80" y="32" width="352" height="448" rx="48"/><rect class="cut" x="136" y="88" width="240" height="88" rx="20"/><circle class="cut" cx="168" cy="256" r="28"/><circle class="cut" cx="256" cy="256" r="28"/><circle class="cut" cx="344" cy="256" r="28"/><circle class="cut" cx="168" cy="344" r="28"/><circle class="cut" cx="256" cy="344" r="28"/><rect class="cut" x="316" y="316" width="56" height="116" rx="26"/>',
  ),
  "service-call": icon(
    '<path d="M336 32 480 160 336 288v-80H96c-18 0-32-14-32-32s14-32 32-32h240zM176 480 32 352l144-128v80h240c18 0 32 14 32 32s-14 32-32 32H176z"/>',
  ),
  review: icon(
    '<path d="M256 96C144 96 48 176 16 256c32 80 128 160 240 160s208-80 240-160c-32-80-128-160-240-160z"/><circle class="cut" cx="256" cy="256" r="96"/><circle cx="256" cy="256" r="48"/>',
  ),
  "submit-result": icon(
    '<path d="M498 39c8-8 3-23-9-24L27 88c-14 2-18 20-6 28l112 74 231-135-186 170 6 137c1 14 18 20 28 10l67-70 118 78c10 7 24 1 26-11L498 39z"/>',
  ),
  result: icon(
    '<path d="M256 16a240 240 0 1 0 0 480 240 240 0 0 0 0-480zm121 170L245 342c-9 9-24 9-33 0l-69-69c-9-9-9-24 0-33s24-9 33 0l52 52 116-140c9-9 24-9 34 0s8 25-1 34z"/>',
  ),
  "email-result": icon(
    '<path d="M64 96c-27 0-48 21-48 48v14l217 158c14 10 32 10 46 0l217-158v-14c0-27-21-48-48-48H64zM496 217 301 359c-27 20-63 20-90 0L16 217v151c0 27 21 48 48 48h384c27 0 48-21 48-48V217z"/>',
  ),
  annotation: icon(
    '<path d="m362 38 112 112-56 56L306 94zM272 128l112 112-208 208-134 22 22-134z"/>',
  ),
};

/**
 * Story 096: the three kinds of box a Text in a page can be shown as. Same
 * manner as the set above — filled silhouettes, `currentColor`, the cut-outs
 * in `class="cut"` — because they sit beside the node icons on the canvas
 * card and in front of the box in the viewer, and a second manner would show.
 * The viewer fills the cut with the box's own surface.
 */
export const CALLOUT_ICONS: Record<"info" | "warning" | "tip", string> = {
  // An i in a circle.
  info: icon(
    '<circle cx="256" cy="256" r="240"/><circle class="cut" cx="256" cy="148" r="36"/><rect class="cut" x="220" y="216" width="72" height="188" rx="28"/>',
  ),
  // An exclamation mark in a triangle.
  warning: icon(
    '<path d="M228 52c12-21 44-21 56 0l204 356c12 21-3 48-28 48H52c-25 0-40-27-28-48L228 52z"/><rect class="cut" x="230" y="168" width="52" height="150" rx="22"/><circle class="cut" cx="256" cy="378" r="32"/>',
  ),
  // A light bulb.
  tip: icon(
    '<path d="M256 24c-92 0-168 74-168 166 0 55 27 103 68 133 14 10 20 22 20 37v8c0 18 14 32 32 32h96c18 0 32-14 32-32v-8c0-15 6-27 20-37 41-30 68-78 68-133 0-92-76-166-168-166z"/><rect x="184" y="424" width="144" height="40" rx="20"/><rect x="208" y="480" width="96" height="24" rx="12"/>',
  ),
};

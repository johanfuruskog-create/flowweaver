/**
 * Finished colour scales — a host recolours FlowWeaver in one step.
 *
 * Story 140 (Johan 29/9, path 1 in IDEAS): the primary family is nine tokens
 * per theme, each its own hand-picked value, and a host that sets only
 * `--fw-primary` gets filled buttons, links and borders in its colour while the
 * chips, tinted buttons, hover and the focus ring stay indigo. **The family is
 * the contract.** A host either sets all nine per theme (the list is in the
 * README, *Tokens och tema*) or takes one of these:
 *
 *     applyPalette(palettes.hav);   // null puts the default indigo back
 *
 * The scales started as the example site's (Johan 3/9: *"Jag skulle vilja
 * testa fler färgskalor för editorn och visaren"*) and moved here unchanged;
 * the site's menu, memory and `?palett=` stay in `src/site/palettes.ts` and
 * import from this file.
 *
 * What varies is the **accent and the five node families**; the greys, the
 * surfaces and the semantic colours (error, warning, success) stay. That keeps
 * every contrast pair that does not involve the accent exactly where the gate
 * (`contrast.browser.test.ts`) measured it. The pairs that *do* involve the
 * accent are measured for every scale in `palettes.browser.test.ts` beside
 * this file, with the same formula and the same 4.5:1 floor, so a scale in
 * this list is one that passed — light and dark.
 *
 * **Nothing is derived.** Every value is written out; no `color-mix`, no
 * algorithm from one colour (paths 2 and 3 in IDEAS, with their reasons).
 */

type Tokens = Record<string, string>;

export interface Palette {
  id: string;
  label: string;
  light: Tokens;
  dark: Tokens;
}

/*
 * Each scale sets the same keys in both modes. The dark side lightens the
 * accent (text against a dark ground) and therefore darkens `--fw-on-primary`,
 * darkens the node tints and lightens the node inks — the same moves the
 * default indigo makes in `fw-dark`.
 */
function scale(
  id: string,
  label: string,
  light: {
    primary: [string, string, string]; // primary, hover, strong
    tints: [string, string, string, string]; // surface, surface-2, border, muted
    nodes: Record<NodeFamily, [string, string]>; // solid (= ink), tint
  },
  dark: {
    primary: [string, string, string];
    tints: [string, string, string, string];
    onPrimary: string;
    nodes: Record<NodeFamily, [string, string]>; // tint, ink
  },
): Palette {
  const lightTokens: Tokens = {
    "--fw-primary": light.primary[0],
    "--fw-primary-hover": light.primary[1],
    "--fw-primary-strong": light.primary[2],
    "--fw-primary-surface": light.tints[0],
    "--fw-primary-surface-2": light.tints[1],
    "--fw-primary-border": light.tints[2],
    "--fw-primary-muted": light.tints[3],
    "--fw-on-primary": "#ffffff",
    "--fw-focus-ring": ring(light.primary[0]),
  };
  const darkTokens: Tokens = {
    "--fw-primary": dark.primary[0],
    "--fw-primary-hover": dark.primary[1],
    "--fw-primary-strong": dark.primary[2],
    "--fw-primary-surface": dark.tints[0],
    "--fw-primary-surface-2": dark.tints[1],
    "--fw-primary-border": dark.tints[2],
    "--fw-primary-muted": dark.tints[3],
    "--fw-on-primary": dark.onPrimary,
    "--fw-focus-ring": ring(dark.primary[0]),
  };

  for (const family of FAMILIES) {
    const [solid, tint] = light.nodes[family];

    lightTokens[`--fw-node-${family}`] = solid;
    lightTokens[`--fw-node-${family}-tint`] = tint;
    lightTokens[`--fw-node-${family}-ink`] = solid;

    const [darkTint, ink] = dark.nodes[family];

    darkTokens[`--fw-node-${family}-tint`] = darkTint;
    darkTokens[`--fw-node-${family}-ink`] = ink;
  }

  return { id, label, light: lightTokens, dark: darkTokens };
}

type NodeFamily = "content" | "rule" | "calc" | "service" | "end";
const FAMILIES: NodeFamily[] = ["content", "rule", "calc", "service", "end"];

/** The focus ring is the accent at 35 %, as the default is. */
function ring(hex: string): string {
  const n = parseInt(hex.slice(1), 16);

  return `rgb(${n >> 16} ${(n >> 8) & 255} ${n & 255} / 35%)`;
}

export const palettes = {
  hav: scale(
    "hav",
    "Hav",
    {
      primary: ["#1d4ed8", "#1e40af", "#1e3a8a"],
      tints: ["#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd"],
      nodes: {
        content: ["#1e40af", "#eff6ff"],
        rule: ["#6d28d9", "#f5f3ff"],
        calc: ["#0f766e", "#f0fdfa"],
        service: ["#c2410c", "#fff7ed"],
        end: ["#15803d", "#f0fdf4"],
      },
    },
    {
      primary: ["#60a5fa", "#93c5fd", "#93c5fd"],
      tints: ["#172554", "#1e3a8a", "#1e40af", "#2563eb"],
      onPrimary: "#0b1220",
      nodes: {
        content: ["#172554", "#93c5fd"],
        rule: ["#2e1065", "#c4b5fd"],
        calc: ["#042f2e", "#5eead4"],
        service: ["#431407", "#fdba74"],
        end: ["#052e16", "#86efac"],
      },
    },
  ),
  skog: scale(
    "skog",
    "Skog",
    {
      primary: ["#047857", "#065f46", "#064e3b"],
      tints: ["#ecfdf5", "#d1fae5", "#a7f3d0", "#6ee7b7"],
      nodes: {
        content: ["#3f6212", "#f7fee7"],
        rule: ["#6d28d9", "#f5f3ff"],
        calc: ["#0369a1", "#f0f9ff"],
        service: ["#b45309", "#fffbeb"],
        end: ["#14532d", "#f0fdf4"],
      },
    },
    {
      primary: ["#34d399", "#6ee7b7", "#6ee7b7"],
      tints: ["#022c22", "#064e3b", "#065f46", "#059669"],
      onPrimary: "#04140e",
      nodes: {
        content: ["#1a2e05", "#bef264"],
        rule: ["#2e1065", "#c4b5fd"],
        calc: ["#082f49", "#7dd3fc"],
        service: ["#2a1e0a", "#fcd34d"],
        end: ["#052e16", "#86efac"],
      },
    },
  ),
  skiffer: scale(
    "skiffer",
    "Skiffer",
    {
      primary: ["#334155", "#1e293b", "#0f172a"],
      tints: ["#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8"],
      nodes: {
        content: ["#1e3a5f", "#eff6ff"],
        rule: ["#5b21b6", "#f5f3ff"],
        calc: ["#155e75", "#ecfeff"],
        service: ["#9a3412", "#fff7ed"],
        end: ["#14532d", "#f0fdf4"],
      },
    },
    {
      primary: ["#cbd5e1", "#e2e8f0", "#e2e8f0"],
      tints: ["#1e293b", "#334155", "#475569", "#64748b"],
      onPrimary: "#0f172a",
      nodes: {
        content: ["#172554", "#93c5fd"],
        rule: ["#2e1065", "#c4b5fd"],
        calc: ["#083344", "#67e8f9"],
        service: ["#431407", "#fdba74"],
        end: ["#052e16", "#86efac"],
      },
    },
  ),
  tegel: scale(
    "tegel",
    "Tegel",
    {
      primary: ["#9a3412", "#7c2d12", "#7c2d12"],
      tints: ["#fff7ed", "#ffedd5", "#fed7aa", "#fdba74"],
      nodes: {
        content: ["#7c2d12", "#fff7ed"],
        rule: ["#86198f", "#fdf4ff"],
        calc: ["#0f766e", "#f0fdfa"],
        service: ["#854d0e", "#fefce8"],
        end: ["#166534", "#f0fdf4"],
      },
    },
    {
      primary: ["#fb923c", "#fdba74", "#fdba74"],
      tints: ["#431407", "#7c2d12", "#9a3412", "#ea580c"],
      onPrimary: "#1c0a02",
      nodes: {
        content: ["#431407", "#fdba74"],
        rule: ["#4a044e", "#f0abfc"],
        calc: ["#042f2e", "#5eead4"],
        service: ["#422006", "#fde047"],
        end: ["#052e16", "#86efac"],
      },
    },
  ),
} satisfies Record<string, Palette>;

/** A scale by its id — `null` for an unknown one, never an error. */
export function paletteById(id: string | null): Palette | null {
  return Object.values(palettes).find((palette) => palette.id === id) ?? null;
}

/*
 * Applied the way a host applies its own colours: on the elements, with the
 * same selectors as `tokens.scss` so the dark side follows both the explicit
 * choice and the OS.
 *
 * And on `:root`, with the selectors of the example site's `demo-tokens.scss`,
 * because the site around the guide wears the same tokens and should change
 * with it the way it does for dark mode. On a host's page those rules only set
 * `--fw-*` custom properties, which nothing of the host's reads unless it chose
 * to; our own elements carry their own declarations and never inherit them.
 * Two rules, two responsibilities, same values. The `data-palette` attribute is
 * how `currentPalette` and the tests find the sheet.
 */
function styleFor(palette: Palette): string {
  const scope = "guide-editor, guide-preview, guide-versions, .flowweaver-scope";
  const declarations = (tokens: Tokens): string =>
    Object.entries(tokens)
      .map(([name, value]) => `${name}: ${value};`)
      .join(" ");
  const light = declarations(palette.light);
  const dark = declarations(palette.dark);

  return [
    `:where(${scope}) { ${light} }`,
    `:where(${scope})[data-fw-theme="dark"], :where(${scope}) [data-fw-theme="dark"] { ${dark} }`,
    `:where(${scope})[data-fw-theme="light"], :where(${scope}) [data-fw-theme="light"] { ${light} }`,
    `@media (prefers-color-scheme: dark) { :where(${scope}):not([data-fw-theme="light"]) { ${dark} } }`,
    `:root { ${light} }`,
    `:root[data-theme="dark"] { ${dark} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${dark} } }`,
  ].join("\n");
}

/** Puts the scale on the page, or takes it off again for the default indigo. */
export function applyPalette(palette: Palette | null): void {
  let style = document.head.querySelector<HTMLStyleElement>("style[data-palette]");

  if (!palette) {
    style?.remove();
    return;
  }

  if (!style) {
    style = document.createElement("style");
    document.head.append(style);
  }

  style.dataset.palette = palette.id;
  style.textContent = styleFor(palette);
}

/** The scale on the page right now, or null for the default indigo. */
export function currentPalette(): Palette | null {
  return paletteById(document.head.querySelector<HTMLStyleElement>("style[data-palette]")?.dataset.palette ?? null);
}

import { afterEach, describe, expect, test } from "vitest";
import "../../../viewer/node-types/default-node-types";
import "./guide-outline";
import { tillRgba, kontrast, kontrollkantsbrott } from "../../../testing/contrast";

import type { GuideOutline } from "./guide-outline";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * The outline row's own edge — WCAG 1.4.11, found in the tillganglighet
 * role's broad sweep (13/9).
 *
 * `.guide-outline__row` is a `role="treeitem"` `<div>`, and every node type
 * paints it a different tint (`--fw-node-*-tint`, the palette badge's own
 * colours). Its border drew itself with `--fw-border-subtle` (falling back to
 * `--fw-border`) — the divider token, not a boundary someone needs to find.
 * Measured before anything changed, on the default (question) tint: **1.11:1
 * in light, 1.03:1 in dark**.
 *
 * `kontrollkantsbrott` (`src/testing/contrast.ts`) did not reach this element
 * when this fault was found, for two reasons at once: its selector was
 * `input, select, textarea, button` and this is a `<div>`, and the row's
 * *selected* state is drawn with `outline`, a property that function did not
 * read (it only asked about `border-top-*`). Both are now fixed **in the
 * shared function** — it walks `[role="treeitem"]` and reads `outline` too —
 * so the hand-written checks below stay for the per-tint sweep no general
 * selector spells out, and a further block at the end proves the *shared*
 * function itself now catches this row rather than trusting that widening it
 * was enough.
 *
 * Checked explicitly, not assumed: `border-top-style`/`-width` are asserted
 * before the colour is trusted, and the *other* requirement — the selected
 * row's own outline, which already held before this fix — is reasserted here
 * too, so a future change to the border token cannot quietly break it the way
 * a border-token swap broke the progress meter's fill/track relationship
 * earlier the same day this was written.
 *
 * Swept across every tint the row can take (content, rule, calculation,
 * service-call, and an ending type), not just the one that happened to fail
 * first — a fix measured against one tint and applied blindly could still
 * fail the other four.
 */

afterEach(() => document.body.replaceChildren());
const settle = (ms = 150) => new Promise<void>((r) => setTimeout(r, ms));

const TINTS = [
  { label: "content (fråga)", type: "question", selector: ".guide-outline__row" },
  { label: "rule (regel)", type: "rule", selector: '.guide-outline__row[data-node-type="rule"]' },
  { label: "calculation (uträkning)", type: "calculation", selector: '.guide-outline__row[data-node-type="calculation"]' },
  { label: "service-call (tjänsteanrop)", type: "service-call", selector: '.guide-outline__row[data-node-type="service-call"]' },
  { label: "result (avslut)", type: "result", selector: ".guide-outline__row[data-ending]" },
] as const;

// Each node type's own way onward, so `walk()` in guide-outline.ts actually
// reaches it — an unconnected node is invisible to the outline, not merely
// unstyled, and the first draft of this file measured `null` for exactly
// that reason.
const OUT_PORT: Record<string, string> = {
  question: "o",
  rule: "default",
  calculation: "continue",
  "service-call": "continue",
};

function graph(): GraphData {
  const nodes = TINTS.map((tint, index) => ({
    id: `n${index}`,
    type: tint.type,
    position: { x: 0, y: 0 },
    data:
      tint.type === "question"
        ? { title: { sv: `Nod ${index}` }, variableName: `v${index}`, options: [{ id: "o", label: { sv: "Ja" }, value: "ja" }] }
        : tint.type === "rule"
          ? { title: { sv: `Nod ${index}` }, cases: [] }
          : { title: { sv: `Nod ${index}` } },
  }));

  const connections = TINTS.slice(0, -1).map((tint, index) => ({
    id: `c${index}`,
    from: { nodeId: `n${index}`, portId: OUT_PORT[tint.type] },
    to: { nodeId: `n${index + 1}`, portId: "input" },
  }));

  return {
    startNodeId: "n0",
    settings: { sourceLocale: "sv" },
    nodes,
    connections,
  } as unknown as GraphData;
}

async function mount(theme?: "dark"): Promise<GuideOutline> {
  const outline = document.createElement("guide-outline") as GuideOutline;

  if (theme) outline.dataset.fwTheme = theme;
  // A real backdrop, not the page default: `guide-outline` carries no
  // background of its own (neither does `guide-editor`'s shell) — it is
  // always read against whatever panel it sits in. Mounted bare, with no
  // background at all, `effektivBakgrund` falls back to hardcoded white
  // regardless of theme, which would measure a dark row against a white page
  // that does not exist in dark mode and pass by accident. `--fw-surface` is
  // the same panel surface the real sidebar provides.
  outline.style.background = "var(--fw-surface)";
  document.body.append(outline);
  outline.graph = graph();
  (outline as unknown as { selectedNodeId: string | null }).selectedNodeId = "n0";
  await settle();
  return outline;
}

describe.each([["ljust", undefined], ["mörkt", "dark" as const]])("%s tema", (_namn, tema) => {
  test.each(TINTS)("en $label-rads kant går att hitta mot sin egen ton (3:1)", async (tint) => {
    const outline = await mount(tema);
    const row = outline.shadowRoot!.querySelector<HTMLElement>(tint.selector)!;
    const style = getComputedStyle(row);

    expect(style.borderTopStyle).toBe("solid");
    expect(Number.parseFloat(style.borderTopWidth)).toBeGreaterThan(0);

    const border = tillRgba(style.borderTopColor);
    const bg = tillRgba(style.backgroundColor);

    expect(kontrast(border, bg)).toBeGreaterThanOrEqual(3);
  });

  test("den valda radens outline mot sin ton håller fortfarande (regressionsvakt)", async () => {
    const outline = await mount(tema);
    const selected = outline.shadowRoot!.querySelector<HTMLElement>('.guide-outline__row[aria-selected="true"]')!;
    const style = getComputedStyle(selected);

    expect(style.outlineStyle).toBe("solid");
    expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThan(0);

    const outlineColour = tillRgba(style.outlineColor);
    const bg = tillRgba(style.backgroundColor);

    // Detta krav har inget med radens egen kant att göra; det ska inte kunna
    // gå sönder av att kanten rättas, precis som fyllt/spår inte skulle ha
    // fått gå sönder av mätarens spårfix tidigare i dag.
    expect(kontrast(outlineColour, bg)).toBeGreaterThanOrEqual(3);
  });

  /*
   * The shared gate, widened today to walk `[role="treeitem"]` and read
   * `outline` — proving the FUNCTION catches this row, not just the
   * hand-measured numbers above. A gate widened without being seen to bite is
   * only a moved blind spot (PRAXIS regel 4).
   */
  test("den vidgade grinden ser radens kant, och biter om den tas bort", async () => {
    /*
     * Egen, liten graf: en vald `rule`-rad och en OVALD `question`-rad. Den
     * ovalda raden får inte vara den valda — den bär redan en egen `outline`
     * som skulle maskera att just kanten (border) togs bort — och tonen får
     * inte vara vilken som helst: flera av de fem nodtonerna mäter under
     * 1.05:1 mot panelen i ettdera temat (t.ex. `calculation` i ljust,
     * `rule` i mörkt) — funktionens egen gräns för "inget ritat alls", som är
     * rätt för en genomskinlig knapp men skulle göra just den raden till ett
     * dåligt bevis här oavsett kant. `question`s ton (`--fw-node-content-tint`)
     * mäter tydligt över i båda (1.12 ljust, 1.16 mörkt).
     *
     * Hittat genom att gå i den egna gropen: första utkastet tog helt enkelt
     * "den första ovalda raden" ur `mount()`s fem-tona graf, vilket i mörkt
     * tema råkade bli just `rule` — 1.048:1, en hårsmån under 1.05. Provet
     * gick grönt av fel skäl (raden räknades som "inget ritat" och hoppades
     * över helt, inte som en godkänd kant), ett skenprov som sett ut som ett
     * riktigt. Välj aldrig "första bästa" rad/ton för ett sånt här prov utan
     * att räkna efter — samma gissning här igen är samma grop.
     */
    const outline = document.createElement("guide-outline") as GuideOutline;

    if (tema) outline.dataset.fwTheme = tema;
    outline.style.background = "var(--fw-surface)";
    document.body.append(outline);
    outline.graph = {
      startNodeId: "sel",
      settings: { sourceLocale: "sv" },
      nodes: [
        { id: "sel", type: "rule", position: { x: 0, y: 0 }, data: { title: { sv: "Vald" }, cases: [] } },
        {
          id: "unsel", type: "question", position: { x: 0, y: 0 },
          data: { title: { sv: "Oval" }, variableName: "v", options: [{ id: "o", label: { sv: "Ja" }, value: "ja" }] },
        },
      ],
      connections: [{ id: "c", from: { nodeId: "sel", portId: "default" }, to: { nodeId: "unsel", portId: "input" } }],
    } as unknown as GraphData;
    (outline as unknown as { selectedNodeId: string | null }).selectedNodeId = "sel";
    await settle();

    expect(kontrollkantsbrott(outline.shadowRoot!)).toEqual([]);

    const row = outline.shadowRoot!.querySelector<HTMLElement>('.guide-outline__row[aria-selected="false"]')!;

    // In-line, inte i scss-filen — det riktiga felet är redan rättat där.
    row.style.borderWidth = "0";

    const brott = kontrollkantsbrott(outline.shadowRoot!);

    expect(brott.length, brott.join("; ")).toBeGreaterThan(0);
  });
});

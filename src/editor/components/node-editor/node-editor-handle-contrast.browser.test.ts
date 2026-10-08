import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { effektivBakgrund, kontrast, tillRgba } from "../../../testing/contrast";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * The two menu buttons have to be visible, and that is a measurement.
 *
 * ## The fault this is written from
 *
 * Johan looked at the handle on a connection and said the contrast was poor in
 * both themes. Measured, he was being polite: the border sat at **1.41:1** in
 * light and **2.14:1** in dark against the canvas behind it, and the button's
 * own surface at 1.05 and 1.10 — the same colour as the canvas. WCAG 1.4.11 asks
 * for **3:1** on a control's boundary.
 *
 * The cause was mine and it was careless. `--fw-surface-hover` and `--fw-focus`
 * do not exist; I invented both names, so every rule using them fell through to
 * its literal fallback — a fixed light-mode blue and a black tint invisible on a
 * dark canvas. `--fw-border` does exist, but it is for dividers, not for the
 * edge of a control.
 *
 * ## Why the existing contrast harness said nothing
 *
 * `guide-editor-contrast` walks **text**, which is 1.4.3. A control's boundary
 * against what is behind it is 1.4.11, and nothing measures that anywhere in
 * this project. These two buttons are now measured; the rest of the interface is
 * still unchecked on that criterion, which is worth knowing rather than
 * assuming.
 *
 * ## Why the border and not the fill
 *
 * The fill has a job: it hides the line running underneath, so the glyph is read
 * against a flat surface rather than a stroke. So the border carries the
 * contrast. `--fw-primary` measures 6.01 and 6.34 against the canvas — the same
 * token in both themes, no second value to keep in step.
 */

afterEach(() => document.body.replaceChildren());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 150));

/** WCAG 1.4.11: a control's boundary against what is behind it. */
const BOUNDARY = 3;
/** WCAG 1.4.3 for the glyph inside it, treated as text rather than as an icon. */
const GLYPH = 4.5;

async function canvasWith(theme: "light" | "dark"): Promise<NodeEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("theme", theme);
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 40, y: 40 }, data: { title: "Ett", variableName: "a" } },
      { id: "q2", type: "text-question", position: { x: 400, y: 40 }, data: { title: "Två", variableName: "b" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "continue" }, to: { nodeId: "q2", portId: "input" } },
    ],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

  if (!nodeEditor) throw new Error("node-editor saknas.");

  return nodeEditor;
}

const handleOf = (nodeEditor: NodeEditor): HTMLElement =>
  nodeEditor.shadowRoot!.querySelector<HTMLElement>(".node-editor__connection-handle")!;

describe.each(["light", "dark"] as const)("the connection handle in %s", (theme) => {
  test("its edge stands out from the canvas", async () => {
    const handle = handleOf(await canvasWith(theme));
    const style = getComputedStyle(handle);
    const behind = effektivBakgrund(handle.parentElement!);

    expect(
      kontrast(tillRgba(style.borderTopColor), behind),
    ).toBeGreaterThanOrEqual(BOUNDARY);
  });

  test("and its glyph stands out from its own surface", async () => {
    const style = getComputedStyle(handleOf(await canvasWith(theme)));

    expect(
      kontrast(tillRgba(style.color), tillRgba(style.backgroundColor)),
    ).toBeGreaterThanOrEqual(GLYPH);
  });
});

describe.each(["light", "dark"] as const)("the node's menu button in %s", (theme) => {
  test("its glyph stands out from the node header it sits in", async () => {
    const nodeEditor = await canvasWith(theme);
    const node = nodeEditor.shadowRoot!.querySelector("flow-node")!.shadowRoot!;
    const button = node.querySelector<HTMLElement>("[data-node-menu]")!;
    const header = node.querySelector<HTMLElement>(".flow-node__header")!;

    expect(
      kontrast(
        tillRgba(getComputedStyle(button).color),
        tillRgba(getComputedStyle(header).backgroundColor),
      ),
    ).toBeGreaterThanOrEqual(GLYPH);
  });

  test("and its focus ring stands out from that header too", async () => {
    /*
     * Measured against what the ring actually sits on, which is not the canvas.
     * A node's header is coloured by node type — rgb(55, 48, 163) for a question,
     * and the same in both themes because node colours do not flip. Against that,
     * `--fw-primary` is 1.58:1 in light and 3.33:1 in dark: a focus ring that
     * nearly vanishes into the band it is drawn on, which is what Johan saw.
     *
     * Read from the custom property rather than from `outlineColor`, because
     * `.focus()` grants focus without always granting `:focus-visible` — the same
     * caveat `docs/KRAV.md` records for the keyboard checks.
     */
    const nodeEditor = await canvasWith(theme);
    const node = nodeEditor.shadowRoot!.querySelector("flow-node")!.shadowRoot!;
    const button = node.querySelector<HTMLElement>("[data-node-menu]")!;
    const header = node.querySelector<HTMLElement>(".flow-node__header")!;
    const token = outlineToken(nodeSheet, ".flow-node__menu-button:focus-visible");
    const ring = getComputedStyle(button).getPropertyValue(token).trim();

    expect(token, "ingen outline-token hittad i regeln").not.toBe("");
    expect(ring, `${token} saknas`).not.toBe("");
    expect(
      kontrast(tillRgba(ring), tillRgba(getComputedStyle(header).backgroundColor)),
    ).toBeGreaterThanOrEqual(BOUNDARY);
  });
});

describe.each(["light", "dark"] as const)("the port's hover marking in %s", (theme) => {
  test("stands out from what it actually sits on", async () => {
    /*
     * Siv, genomgången 30/9 (E4): the hover ring the port keeps as its
     * "kompletterande återkoppling" (K19, Astra's bilaga 3) is a translucent
     * wash — `rgb(79 70 229 / 28%)` — composed over the port's real
     * backdrop, which `effektivBakgrund` shows is the card's own surface
     * (white in light, `--fw-surface` ≈ #161b26 in dark), not the canvas.
     * Measured before this fix: 1.55:1 light, 1.25:1 dark — the same flaw
     * `_focus.scss` documents for a translucent wash alone: a percentage
     * wash cannot clear 1.4.11's 3:1 against either extreme. `--fw-primary-strong`
     * opaque, the same family already used for the confirmation dialog's
     * ordinary accent, measures 8.08 and 8.64 here.
     */
    const nodeEditor = await canvasWith(theme);
    const node = nodeEditor.shadowRoot!.querySelector("flow-node")!.shadowRoot!;
    const port = node.querySelector<HTMLElement>(".flow-node__port")!;

    await userEvent.hover(port);
    // `.flow-node__port` transitions its box-shadow over 120ms; read too
    // early (measured: immediately after `hover()` in one of two themes)
    // and the computed value is still the resting ring, not the hover one.
    await settle();

    const style = getComputedStyle(port);
    const match = style.boxShadow.match(/rgba?\(([^)]+)\)/);

    expect(match, `ingen färg i box-shadow: ${style.boxShadow}`).not.toBeNull();

    const parts = match![1].split(",").map((n) => Number.parseFloat(n));
    const ring: [number, number, number, number] = parts.length === 4
      ? (parts as [number, number, number, number])
      : [parts[0], parts[1], parts[2], 1];
    const behind = effektivBakgrund(port.parentElement!);
    // `kontrast()` refuses a translucent colour on purpose (its own doc: a
    // fully see-through layer used to score 21:1 by accident) — composed
    // here against the real backdrop, the same way the ring actually paints.
    const composed: [number, number, number, number] = [
      ring[0] * ring[3] + behind[0] * (1 - ring[3]),
      ring[1] * ring[3] + behind[1] * (1 - ring[3]),
      ring[2] * ring[3] + behind[2] * (1 - ring[3]),
      1,
    ];

    expect(kontrast(composed, behind)).toBeGreaterThanOrEqual(BOUNDARY);
  });
});

describe.each(["light", "dark"] as const)("the handle's focus ring in %s", (theme) => {
  test("stands out from what it actually touches", async () => {
    /*
     * Which is the canvas, not the button's own edge. `outline-offset: 3px` puts
     * a gap of canvas between the ring and the border, so those two are never
     * adjacent — and 2.4.11 asks about the colours a focus indicator abuts.
     *
     * Worth writing down because the first version of this test demanded 3:1
     * between ring and border as well, and failed at 2.82 and 2.52. That was a
     * rule I had invented, not one the standard makes, and the honest fix was to
     * drop the assertion rather than repaint the button to satisfy it.
     *
     * The colour still changed for a reason the eye cares about: `--fw-text`
     * reads as a ring where `--fw-primary`, the border's own colour, read as a
     * slightly thicker edge.
     */
    const handle = handleOf(await canvasWith(theme));
    const token = outlineToken(sheet, ".node-editor__connection-handle:focus-visible");
    const ring = tillRgba(getComputedStyle(handle).getPropertyValue(token).trim());

    expect(token, "ingen outline-token hittad i regeln").not.toBe("");
    expect(kontrast(ring, effektivBakgrund(handle.parentElement!))).toBeGreaterThanOrEqual(
      BOUNDARY,
    );
  });
});

/*
 * The stylesheet itself, read the way every other file-reading test here reads
 * one — through Vite, never `node:fs`.
 */
const sheet = Object.values(
  import.meta.glob("./node-editor.scss", { query: "?raw", import: "default", eager: true }),
)[0] as string;

const nodeSheet = Object.values(
  import.meta.glob("../flow-node/flow-node.scss", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)[0] as string;

const focusSheet = Object.values(
  import.meta.glob("../../../viewer/styles/_focus.scss", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)[0] as string;

/** The token a focus mixin's own `outline` reaches for. */
const mixinToken = (name: string): string => {
  const at = focusSheet.indexOf(`@mixin ${name}(`);

  if (at < 0) return "";

  const body = focusSheet.slice(at, focusSheet.indexOf("}", at));

  return body.match(/outline:[^;]*var\((--fw-[a-z0-9-]+)/)?.[1] ?? "";
};

/**
 * The custom property a rule's `outline` actually reaches for.
 *
 * Read from the stylesheet rather than named here, because a test that names the
 * token checks a token — not the rule. A mutation putting `--fw-primary` back on
 * the node button's focus ring passed every assertion in an earlier version of
 * this file, which is exactly the fault it was written to catch.
 *
 * Since 21/9 the rule usually says `@include focus.ring…` instead of naming a
 * token, so the lookup follows that **one** step into `_focus.scss` and reads
 * the token there. Same claim as before — *what does this rule end up drawing
 * with* — and the mutation it was written for still fails it: change the mixin
 * to `--fw-primary` and these four assertions go red.
 */
const outlineToken = (css: string, selector: string): string => {
  const rule = css.slice(css.indexOf(`${selector} {`));
  const body = rule.slice(0, rule.indexOf("}"));
  const direct = body.match(/outline:[^;]*var\((--fw-[a-z0-9-]+)/)?.[1];

  if (direct) return direct;

  const included = body.match(/@include focus\.([a-z-]+)/)?.[1];

  return included ? mixinToken(included) : "";
};

/**
 * Every custom property the handle's own rules reach for.
 *
 * Comments are stripped first, and that was not a guess either: the first run
 * failed on `--fw-focus` — a name that appears only in a comment *explaining*
 * that it does not exist. Naming a property is not referencing it.
 */
const referenced = (): string[] => {
  const block = sheet.slice(sheet.indexOf(".node-editor__connection-handle"));
  const upTo = block.slice(0, block.indexOf(".node-editor__connection-menu-layer"));
  const code = upTo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  return [...new Set(code.match(/--fw-[a-z0-9-]+/g) ?? [])];
};

describe("the properties those colours come from", () => {
  test("every one the handle asks for actually exists", async () => {
    /*
     * The root cause, checked at the root. `var(--invented, fallback)` reads as
     * deliberate and uses its fallback for ever — which is how a fixed
     * light-mode blue ended up on a dark canvas, and how a black tint ended up
     * as a hover state nobody could see.
     *
     * An earlier version of this listed four names by hand and called it done. A
     * mutation walked straight past it: an invented property with a lucky
     * fallback passed every assertion, because nothing compared the list against
     * what the stylesheet actually references. So the list comes from the
     * stylesheet now.
     */
    const style = getComputedStyle(handleOf(await canvasWith("dark")));
    const names = referenced();

    expect(names.length).toBeGreaterThan(0);

    const missing = names.filter((name) => style.getPropertyValue(name).trim() === "");

    expect(missing, `påhittade tokens: ${missing.join(", ")}`).toEqual([]);
  });
});

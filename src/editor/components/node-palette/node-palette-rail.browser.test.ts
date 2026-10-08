import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { registerLocale, unregisterLocale } from "../../../viewer/localization/registry";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodePalette } from "./node-palette";

/**
 * Story 146, and story 145's left half: the palette folds to a 57 px rail of
 * categories, a category opens its nodes beside the rail, and » opens the
 * whole palette with *Sök nod*.
 *
 * The groups are derived, never counted here: what the rail must show is what
 * the full palette shows, one button per non-empty group. The fixture's six
 * groups are a fact about today's registry, not a requirement.
 */

afterEach(() => {
  document.body.replaceChildren();
  unregisterLocale("sv");
});

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const GRAPH = {
  version: 8,
  startNodeId: "q1",
  nodes: [{ id: "q1", type: "question", position: { x: 300, y: 60 }, data: { title: "Ett", variableName: "a" } }],
  connections: [],
};

async function editorOf(attrs: Record<string, string> = {}, width = 1280): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  for (const [name, value] of Object.entries(attrs)) editor.setAttribute(name, value);
  editor.style.cssText = `display: block; width: ${width}px; height: 720px;`;
  document.body.append(editor);
  editor.graph = structuredClone(GRAPH) as never;
  await settle();
  await settle();

  return editor;
}

const paletteOf = (editor: GuideEditor) => editor.shadowRoot!.querySelector<NodePalette>("node-palette")!;
const inPalette = <T extends HTMLElement = HTMLElement>(editor: GuideEditor, selector: string): T =>
  paletteOf(editor).shadowRoot!.querySelector<T>(selector)!;
const allInPalette = (editor: GuideEditor, selector: string): HTMLElement[] => [
  ...paletteOf(editor).shadowRoot!.querySelectorAll<HTMLElement>(selector),
];
const categories = (editor: GuideEditor) => allInPalette(editor, ".node-palette__category");
const menuOf = (editor: GuideEditor) => inPalette(editor, ".node-palette__menu");
const fullOf = (editor: GuideEditor) => inPalette(editor, ".node-palette__full");
const nodeCount = (editor: GuideEditor) => editor.getData().nodes.length;
const active = (editor: GuideEditor) => paletteOf(editor).shadowRoot!.activeElement;
const press = (target: HTMLElement, key: string) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, composed: true, cancelable: true }));
const firstMulti = (editor: GuideEditor) =>
  categories(editor).find((button) => button.hasAttribute("aria-expanded")) as HTMLButtonElement;

describe("kategorilisten (kriterium 1, 2 och 4)", () => {
  test("en knapp per grupp med innehåll, i den fulla palettens ordning", async () => {
    const editor = await editorOf();
    const sections = allInPalette(editor, ".node-palette__full section h3").map((h) => h.textContent!.trim());
    const rail = categories(editor);

    expect(rail).toHaveLength(sections.length);
    rail.forEach((button, index) => {
      const single = !button.hasAttribute("aria-expanded");
      const name = button.getAttribute("aria-label")!;

      if (single) expect(name.startsWith("Lägg till "), name).toBe(true);
      else expect(name).toBe(sections[index]);
    });
  });

  test("en grupp med ett enda val lägger till den direkt, heter som noden och fäller inget ut", async () => {
    const editor = await editorOf();
    const single = categories(editor).find((button) => !button.hasAttribute("aria-expanded"))!;
    const before = nodeCount(editor);

    expect(single, "fixturen har en grupp med ett val").toBeTruthy();
    single.click();
    await settle();

    expect(nodeCount(editor)).toBe(before + 1);
    expect(editor.getData().nodes.at(-1)!.type).toBe(single.dataset.nodeType);
    expect(menuOf(editor).hidden).toBe(true);
  });

  test("knapparna är 44 × 44 i en spalt på 57 px", async () => {
    const editor = await editorOf();

    expect(paletteOf(editor).getBoundingClientRect().width).toBe(57);
    for (const button of categories(editor)) {
      const box = button.getBoundingClientRect();

      expect([box.width, box.height]).toEqual([44, 44]);
    }
  });
});

describe("sidomenyn (kriterium 3 och 5)", () => {
  test("flera val öppnar gruppens noder bredvid listen; Escape stänger och ger knappen fokus", async () => {
    const editor = await editorOf();
    const trigger = firstMulti(editor);

    trigger.click();
    const menu = menuOf(editor);
    const options = [...menu.querySelectorAll<HTMLElement>("[data-node-type]")];

    expect(menu.hidden).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(menu.querySelector("h3")!.textContent).toBe(trigger.getAttribute("aria-label"));
    expect(options.length).toBeGreaterThan(1);
    expect(active(editor)).toBe(options[0]);
    expect(menu.getBoundingClientRect().left).toBeGreaterThanOrEqual(paletteOf(editor).getBoundingClientRect().right - 1);

    press(options[0], "Escape");
    expect(menu.hidden).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(active(editor)).toBe(trigger);
  });

  test("ett val lägger till exakt en nod och stänger menyn", async () => {
    const editor = await editorOf();
    const before = nodeCount(editor);

    firstMulti(editor).click();
    const option = menuOf(editor).querySelector<HTMLButtonElement>("[data-node-type]")!;

    option.click();
    await settle();

    expect(nodeCount(editor)).toBe(before + 1);
    expect(editor.getData().nodes.at(-1)!.type).toBe(option.dataset.nodeType);
    expect(menuOf(editor).hidden).toBe(true);
  });

  test("samma kategori växlar, en annan ersätter, stängknappen och ett tryck utanför stänger", async () => {
    const editor = await editorOf();
    const multis = categories(editor).filter((button) => button.hasAttribute("aria-expanded"));

    multis[0].click();
    multis[0].click();
    expect(menuOf(editor).hidden, "samma kategori stänger").toBe(true);

    multis[0].click();
    multis[1].click();
    expect(menuOf(editor).querySelector("h3")!.textContent).toBe(multis[1].getAttribute("aria-label"));
    expect(multis[0].getAttribute("aria-expanded")).toBe("false");

    inPalette<HTMLButtonElement>(editor, '[data-action="menu-close"]').click();
    expect(menuOf(editor).hidden).toBe(true);
    expect(active(editor)).toBe(multis[1]);

    multis[0].click();
    editor.shadowRoot!.querySelector("node-editor")!.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, composed: true })
    );
    expect(menuOf(editor).hidden, "tryck utanför").toBe(true);
  });

  test("menyn ändrar varken grafen eller noderna", async () => {
    const editor = await editorOf();
    const node = editor.shadowRoot!.querySelector("node-editor")!.shadowRoot!.querySelector("flow-node")!;
    const before = [JSON.stringify(editor.getData()), node.getBoundingClientRect().left];

    firstMulti(editor).click();
    await settle();

    expect([JSON.stringify(editor.getData()), node.getBoundingClientRect().left]).toEqual(before);
  });
});

describe("hela paletten (kriterium 6 och 8, berättelse 145 kriterium 3)", () => {
  test("» öppnar med fokus på « — aldrig i sökrutan — och stänger en öppen meny", async () => {
    const editor = await editorOf();

    firstMulti(editor).click();
    inPalette<HTMLButtonElement>(editor, '[data-action="palette-open"]').click();

    expect(fullOf(editor).hidden).toBe(false);
    expect(menuOf(editor).hidden).toBe(true);
    expect(active(editor)).toBe(inPalette(editor, '[data-action="palette-close"]'));
    expect(active(editor)).not.toBe(inPalette(editor, "#node-palette-search"));
  });

  test("flera tillägg i följd utan att paletten fälls in; Escape fäller in och ger » fokus", async () => {
    const editor = await editorOf({ "palette-open": "" });
    const before = nodeCount(editor);
    const question = fullOf(editor).querySelector<HTMLButtonElement>('[data-node-type="question"]')!;

    question.click();
    question.click();
    await settle();

    expect(nodeCount(editor)).toBe(before + 2);
    expect(editor.paletteOpen).toBe(true);

    press(question, "Escape");
    expect(editor.paletteOpen).toBe(false);
    expect(active(editor)).toBe(inPalette(editor, '[data-action="palette-open"]'));
  });

  test("ett läge från värden ritas utan händelse; redaktörens val skickar en", async () => {
    const seen: boolean[] = [];

    document.addEventListener("palette-open-changed", (event) => {
      seen.push((event as CustomEvent<{ open: boolean }>).detail.open);
    });
    const editor = await editorOf({ "palette-open": "" });

    expect(fullOf(editor).hidden).toBe(false);
    expect(seen).toEqual([]);

    inPalette<HTMLButtonElement>(editor, '[data-action="palette-close"]').click();
    expect(seen).toEqual([false]);
    expect(editor.hasAttribute("palette-open")).toBe(false);
  });
});

describe("sökningen (kriterium 7 och 8)", () => {
  const search = (editor: GuideEditor, value: string): void => {
    const input = inPalette<HTMLInputElement>(editor, "#node-palette-search");

    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const visible = (editor: GuideEditor) =>
    [...fullOf(editor).querySelectorAll<HTMLElement>("[data-node-type]")]
      .filter((button) => !button.hidden)
      .map((button) => button.dataset.nodeType);
  const status = (editor: GuideEditor) => inPalette(editor, ".node-palette__search-status");

  test("skiftlägesoberoende, utan omgivande blanksteg, med bara de matchande gruppernas rubriker", async () => {
    const editor = await editorOf({ "palette-open": "" });

    expect(inPalette(editor, 'label[for="node-palette-search"]').textContent).toBe("Sök nod");
    search(editor, "  REGEL ");

    expect(visible(editor)).toEqual(["rule"]);
    expect(allInPalette(editor, ".node-palette__full section").filter((s) => !s.hidden)).toHaveLength(1);
    expect(status(editor).textContent).toBe("Träffar: 1");

    search(editor, "");
    expect(visible(editor).length).toBeGreaterThan(10);
    expect(status(editor).hidden).toBe(true);
  });

  test("ingen träff säger det, i editorns språk", async () => {
    const editor = await editorOf({ "palette-open": "", "editor-locale": "en" });

    search(editor, "zzz");
    expect(visible(editor)).toEqual([]);
    expect(status(editor).textContent).toBe("No node types match. Try another word.");
    expect(status(editor).getAttribute("role")).toBe("status");
  });

  test("värdens sökord hittar noden; biblioteket har inga egna", async () => {
    const editor = await editorOf({ "palette-open": "" });

    search(editor, "villkor");
    expect(visible(editor), "inga sökord i biblioteket").toEqual([]);

    registerLocale("sv", { "nodeType.rule.keywords": "villkor, om-sats" });
    search(editor, "villkor");
    expect(visible(editor)).toEqual(["rule"]);
  });

  test("söktermen rensas när paletten fälls in, och kategorierna påverkas aldrig", async () => {
    const editor = await editorOf({ "palette-open": "" });

    search(editor, "regel");
    inPalette<HTMLButtonElement>(editor, '[data-action="palette-close"]').click();
    expect(inPalette<HTMLInputElement>(editor, "#node-palette-search").value).toBe("");

    firstMulti(editor).click();
    expect(menuOf(editor).querySelectorAll("[data-node-type]").length).toBeGreaterThan(1);
  });

  test("palette-search=\"off\" lämnar sökrutan ute — värdens val (Johan 7/10)", async () => {
    const editor = await editorOf({ "palette-open": "", "palette-search": "off" });

    expect(inPalette(editor, "#node-palette-search")).toBeNull();
    expect(fullOf(editor).querySelectorAll("[data-node-type]").length).toBeGreaterThan(10);
  });
});

describe("tillgängligt (kriterium 10)", () => {
  test("namnet syns vid tangentbordsfokus, inte bara som title", async () => {
    const { userEvent } = await import("@vitest/browser/context");
    const editor = await editorOf();
    const tip = inPalette(editor, ".node-palette__tip");

    inPalette<HTMLButtonElement>(editor, '[data-action="palette-open"]').focus();
    await userEvent.keyboard("{Tab}");

    expect(active(editor)).toBe(categories(editor)[0]);
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toBe(categories(editor)[0].getAttribute("aria-label"));
  });
});

describe("plats och yta (berättelse 145, kriterium 8 och fråga 1)", () => {
  test("hälsobrickan går åt sidan för den öppna paletten", async () => {
    const editor = await editorOf();
    const health = () => editor.shadowRoot!.querySelector<HTMLElement>("[data-health]")!.getBoundingClientRect();
    const folded = health().left;

    editor.paletteOpen = true;
    await settle();

    expect(health().left).toBeGreaterThanOrEqual(fullOf(editor).getBoundingClientRect().right);
    editor.paletteOpen = false;
    await settle(250);
    expect(health().left).toBe(folded);
  });

  test("under 600 px editor är hela paletten ett ark över skärmen", async () => {
    const editor = await editorOf({ "palette-open": "" }, 560);
    const sheet = fullOf(editor).getBoundingClientRect();

    expect(paletteOf(editor).hasAttribute("sheet")).toBe(true);
    expect(getComputedStyle(fullOf(editor)).position).toBe("fixed");
    expect([sheet.left, sheet.top, sheet.width]).toEqual([0, 0, window.innerWidth]);
  });

  test("när båda panelerna inte ryms fälls den andra in, och den senast öppnade står kvar", async () => {
    // 760: the canvas is 646, the palette covers 173 of it and the panel 323 — 150 left, under the 200 the controls keep.
    const editor = await editorOf({}, 760);

    editor.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="panel-open"]')!.click();
    inPalette<HTMLButtonElement>(editor, '[data-action="palette-open"]').click();
    expect(editor.paletteOpen).toBe(true);
    expect(editor.panelOpen, "sidopanelen fälldes in").toBe(false);

    editor.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="panel-open"]')!.click();
    expect(editor.panelOpen).toBe(true);
    expect(editor.paletteOpen, "paletten fälldes in").toBe(false);
  });

  test("i en bred editor får båda stå öppna", async () => {
    const editor = await editorOf({}, 1600);

    editor.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="panel-open"]')!.click();
    inPalette<HTMLButtonElement>(editor, '[data-action="palette-open"]').click();

    expect([editor.panelOpen, editor.paletteOpen]).toEqual([true, true]);
  });
});

describe("vad det öppna erbjuder (Johan 8/10)", () => {
  /*
   * Free text, the rating, consent, the attachment and the review step belong
   * to sending, and only FlowWeaver PRO offers them. The viewer still draws
   * them; the open editor must not offer them anywhere — not in the palette,
   * not through quick-open, not through *Nytt formulär*, which ends in them.
   */
  const PRO_TYPES = ["text-question", "rating-question", "consent-question", "file-question", "review"];

  test("paletten erbjuder inte PRO:s typer", async () => {
    const editor = await editorOf();
    const offered = allInPalette(editor, "[data-node-type]").map((button) => button.dataset.nodeType);

    expect(offered.length).toBeGreaterThan(5);
    expect(PRO_TYPES.filter((type) => offered.includes(type))).toEqual([]);
  });

  test("snabbsöket erbjuder dem inte heller", async () => {
    const editor = await editorOf();
    const input = editor.shadowRoot!.querySelector<HTMLInputElement>("[data-quick-input]")!;

    editor.shadowRoot!.dispatchEvent(new CustomEvent("quick-open-request", { bubbles: true, composed: true }));
    input.value = "fråga";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const hits = editor.shadowRoot!.querySelector("[data-quick-list]")!.textContent ?? "";

    expect(hits, "en öppen fråga erbjuds").toContain("Sifferfråga");
    expect(hits).not.toContain("Textfråga");
  });

  test("Nytt formulär visas inte utan PRO", async () => {
    const editor = await editorOf();
    const item = editor.shadowRoot!.querySelector("editor-toolbar")!.shadowRoot!.querySelector<HTMLElement>(
      '[data-action="new-form"]'
    )!;

    expect(item.hidden).toBe(true);
  });
});


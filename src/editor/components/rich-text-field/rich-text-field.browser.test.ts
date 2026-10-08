import { userEvent } from "@vitest/browser/context";
import { afterEach, describe, expect, it } from "vitest";

import "./rich-text-field";
import { readDom } from "./read-dom";
import { contrastRatio } from "../../../testing/contrast-ratio";
import type { RichTextField } from "./rich-text-field";
import type { FormattingFeature } from "../../../viewer/types/node-types";

const ALL: FormattingFeature[] = ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"];

/*
 * Real key presses (`userEvent`, Playwright underneath), so the browser sends
 * the `beforeinput` a person's keyboard sends. Chromium in the suite; Del D
 * runs the 21 actions of story 137 in Firefox and WebKit.
 */
function mount(value: string, options: { multiline?: boolean; features?: FormattingFeature[] } = {}): RichTextField {
  const field = document.createElement("rich-text-field");

  if (options.multiline !== false) field.setAttribute("multiline", "");
  field.setAttribute("label", "Beskrivning");
  field.features = options.features ?? ALL;
  field.variables = [
    { value: "fornamn", label: "Förnamn" },
    { value: "ort", label: "Ort" },
  ];
  field.value = value;
  document.body.append(field);
  return field;
}

function text(field: RichTextField): HTMLElement {
  return field.shadowRoot!.querySelector<HTMLElement>("[data-text]")!;
}

/** Caret at the end of the text: focus, then Ctrl+End — the keyboard's own way. */
async function focusEnd(field: RichTextField): Promise<void> {
  text(field).focus();
  await userEvent.keyboard("{Control>}{End}{/Control}");
}

/*
 * The caret inside the field, read as the field reads it. Chromium keeps a
 * shadow root's selection on the root; Firefox shows it through the document;
 * WebKit's document selection is retargeted to the host (measured 25/9:
 * DIV@0, a rectangle of zeros) and only `getComposedRanges` reaches inside.
 */
function caretRange(field: RichTextField): Range {
  const shadow = field.shadowRoot as ShadowRoot & { getSelection?: () => Selection | null };
  const own = shadow.getSelection?.();

  if (own) return own.getRangeAt(0);
  const selection = document.getSelection() as Selection & { getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[] };
  const composed = selection.getComposedRanges?.({ shadowRoots: [shadow] })[0];
  const range = document.createRange();

  if (!composed) return selection.getRangeAt(0);
  range.setStart(composed.startContainer, composed.startOffset);
  range.setEnd(composed.endContainer, composed.endOffset);
  return range;
}

/*
 * A paste with this data. Firefox hands a constructed `ClipboardEvent` a new,
 * empty DataTransfer instead of the one passed in (measured 25/9: the handler
 * saw no types and "" for text/plain), so the data is set on the event itself
 * — which every engine reads the same.
 */
function paste(field: RichTextField, data: DataTransfer): void {
  const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true });

  Object.defineProperty(event, "clipboardData", { value: data });
  text(field).dispatchEvent(event);
}

/*
 * 137 criterion 4: after every action the field holds only the model's forms.
 * A browser's `<div>`, `<b>`, `<span style>` or `<font>` fails it.
 */
function expectOnlyModelDom(field: RichTextField): void {
  const tags = [...text(field).querySelectorAll("*")]
    .filter((element) => (!element.closest("[data-chip]") || element.hasAttribute("data-chip")) && !element.hasAttribute("data-chip-glue"))
    .map((element) => (element.hasAttribute("data-chip") ? "CHIP" : element.tagName));

  expect(tags.filter((tag) => !["P", "UL", "OL", "LI", "STRONG", "EM", "A", "BR", "CHIP"].includes(tag))).toEqual([]);
  expect(text(field).querySelectorAll("[style]")).toHaveLength(0);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("<rich-text-field> — skrivytan (Del B)", () => {
  it("ett skrivet ord blir ett stycke med ordet (137 handling 1)", async () => {
    const field = mount("");

    await focusEnd(field);
    await userEvent.keyboard("ord");

    expect(field.value).toBe("ord");
    expect(text(field).innerHTML).toContain("<p");
    expectOnlyModelDom(field);
  });

  it("Enter mitt i ett stycke ger två stycken, markören först i det andra (handling 2)", async () => {
    const field = mount("abcd");

    await focusEnd(field);
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{Enter}X");

    expect(field.value).toBe("ab\n\nXcd");
    expectOnlyModelDom(field);
  });

  it("Ctrl+B över två ord ger **två ord** och trycker knappen; igen tar bort den (handling 3–4)", async () => {
    const field = mount("två ord");
    const bold = field.shadowRoot!.querySelector<HTMLButtonElement>('[data-command="bold"]')!;

    await focusEnd(field);
    await userEvent.keyboard("{Shift>}{Home}{/Shift}{Control>}b{/Control}");

    expect(field.value).toBe("**två ord**");
    expect(bold.getAttribute("aria-pressed")).toBe("true");
    expect(text(field).querySelector("strong")?.textContent).toBe("två ord");

    await userEvent.keyboard("{Control>}b{/Control}");

    expect(field.value).toBe("två ord");
    expect(bold.getAttribute("aria-pressed")).toBe("false");
    expectOnlyModelDom(field);
  });

  it("punktlista, Enter två gånger lämnar listan (handling 5)", async () => {
    const field = mount("");
    const bullet = field.shadowRoot!.querySelector<HTMLButtonElement>('[data-command="bullet-list"]')!;

    await focusEnd(field);
    bullet.click();
    await userEvent.keyboard("a{Enter}b{Enter}{Enter}c");

    expect(field.value).toBe("- a\n- b\n\nc");
    expect(text(field).querySelectorAll("li")).toHaveLength(2);
    expectOnlyModelDom(field);
  });

  it("Ctrl+Z ångrar ett ord i taget och Ctrl+Y gör om (137 öppen fråga 3)", async () => {
    const field = mount("");

    await focusEnd(field);
    await userEvent.keyboard("hej du");
    await userEvent.keyboard("{Control>}z{/Control}");

    expect(field.value).toBe("hej ");

    await userEvent.keyboard("{Control>}y{/Control}");

    expect(field.value).toBe("hej du");
  });

  it("ett fält som öppnas och lämnas skickar ingenting och är samma sträng (7b a)", async () => {
    const original = "Text som slutar i tomma rader.\n\n";
    const field = mount(original);
    let sent = 0;

    field.addEventListener("input", () => (sent += 1));
    await focusEnd(field);
    text(field).blur();

    expect(sent).toBe(0);
    expect(field.value).toBe(original);
  });

  it("ångra tillbaka till början ger den givna strängen till bokstaven, inte en omskrivning (7b c)", async () => {
    const original = "Text som slutar i tomma rader.\n\n";
    const field = mount(original);

    await focusEnd(field);
    await userEvent.keyboard("x");
    expect(field.value).toBe("Text som slutar i tomma rader.x");

    await userEvent.keyboard("{Control>}z{/Control}");
    expect(field.value).toBe(original);
  });

  it("tre rader ren text klistras in som tre stycken (handling 10)", async () => {
    const field = mount("");
    const data = new DataTransfer();

    data.setData("text/plain", "ett\ntvå\ntre");
    await focusEnd(field);
    paste(field, data);

    expect(field.value).toBe("ett\n\ntvå\n\ntre");
    expectOnlyModelDom(field);
  });

  it("HTML med fet, färg och tabell: fetstilen kvar, färgen och tabellen borta (handling 11)", async () => {
    const field = mount("");
    const data = new DataTransfer();

    data.setData("text/html", '<p><b>fet</b> <span style="color:red">röd</span></p><table><tr><td>x</td><td>y</td></tr></table>');
    data.setData("text/plain", "fet röd\nx y");
    await focusEnd(field);
    paste(field, data);

    expect(field.value).toBe("**fet** röd\n\nx y");
    expectOnlyModelDom(field);
  });

  /*
   * Johan 25/9: det som klistras in rensas från osynliga formateringstecken —
   * ordfogare, nollbreddsmellanrum, byteordningsmärke — som från färg och
   * storlek. ZWNJ och ZWJ står kvar: persiska och indiska skrifter behöver dem,
   * och vilket språk som helst kan registreras.
   */
  it.each([
    ["ren text", "text/plain", "a\u200Bb\u2060c\uFEFFd e\u200Cf\u200Dg"],
    ["HTML", "text/html", "<p>a\u200Bb\u2060c\uFEFFd e\u200Cf\u200Dg</p>"],
  ])("inklistrad %s rensas från ordfogare, ZWSP och BOM; ZWNJ och ZWJ står kvar", async (_name, type, content) => {
    const field = mount("");
    const data = new DataTransfer();

    data.setData(type, content);
    await focusEnd(field);
    paste(field, data);

    expect(field.value).toBe("abcd e\u200Cf\u200Dg");
  });

  it("tre rader i rubrikfältet blir en rad med mellanslag, inget tappat (handling 16)", async () => {
    const field = mount("", { multiline: false, features: ["variable"] });
    const data = new DataTransfer();

    data.setData("text/plain", "ett\ntvå\ntre");
    await focusEnd(field);
    paste(field, data);

    expect(field.value).toBe("ett två tre");
  });

  it("två stjärnor kring text är stjärnor, lagrade med visarens escape (7b e)", async () => {
    const field = mount("");

    await focusEnd(field);
    await userEvent.keyboard("2*3*4");

    expect(text(field).querySelector("em")).toBeNull();
    expect(text(field).textContent).toBe("2*3*4");
    expect(field.value).toBe("2\\*3\\*4");
  });

  it("'- ' först på en rad blir en punkt — det enda escapet inte kan säga", async () => {
    const field = mount("");

    await focusEnd(field);
    await userEvent.keyboard("- a");

    expect(text(field).querySelectorAll("li")).toHaveLength(1);
    expect(field.value).toBe("- a");
  });

  /*
   * Path (b), 137 point 2: the browser wrote without a cancelable
   * `beforeinput` (autocorrect, dictation, an input method). Simulated by
   * doing what an engine does — change the DOM, send `input` — because no
   * automation drives a real IME here; the iPad and Del D do.
   */
  it("väg (b): webbläsaren skriver själv, input läser ikapp och ritar om i modellens former", async () => {
    const field = mount("abc");

    await focusEnd(field);
    const paragraph = text(field).querySelector("p")!;
    const div = document.createElement("div");

    div.innerHTML = "<b>ny</b> rad";
    paragraph.after(div);
    document.getSelection()!.setBaseAndExtent(div.lastChild!, 4, div.lastChild!, 4);
    text(field).dispatchEvent(new InputEvent("input", { inputType: "insertText", data: "d", bubbles: true, composed: true }));

    expect(field.value).toBe("abc\n\n**ny** rad");
    expectOnlyModelDom(field);

    await userEvent.keyboard("!");
    expect(field.value).toBe("abc\n\n**ny** rad!");
  });

  it("ingen omritning under en pågående komposition; modellen ikapp efter den (handling 12)", async () => {
    const field = mount("abc");

    await focusEnd(field);
    const node = text(field).querySelector("p")!.firstChild as Text;

    text(field).dispatchEvent(new CompositionEvent("compositionstart", { data: "" }));
    node.data = "abcか";
    text(field).dispatchEvent(new InputEvent("input", { inputType: "insertCompositionText", data: "か", isComposing: true, bubbles: true, composed: true }));

    // The same text node: nothing redrawn under the input method's feet.
    expect(text(field).querySelector("p")!.firstChild).toBe(node);
    expect(field.value).toBe("abc");

    text(field).dispatchEvent(new CompositionEvent("compositionend", { data: "か" }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(field.value).toBe("abcか");
  });

  it("verktygsraden är en tabbstopp med piltangenter mellan knapparna (136 kriterium 10)", async () => {
    const field = mount("");
    const toolbar = field.shadowRoot!.querySelector<HTMLElement>('[role="toolbar"]')!;
    const tools = [...toolbar.querySelectorAll<HTMLButtonElement>("button")];

    expect(tools.filter((tool) => tool.tabIndex === 0)).toHaveLength(1);

    tools[0]!.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(field.shadowRoot!.activeElement).toBe(tools[1]);
    expect(tools.filter((tool) => tool.tabIndex === 0)).toEqual([tools[1]]);
  });

  it("knapparna träffas på 44 px (K6)", () => {
    const field = mount("");

    for (const tool of field.shadowRoot!.querySelectorAll<HTMLButtonElement>("[data-command], [data-answer-toggle]")) {
      const box = tool.getBoundingClientRect();

      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });
});

/*
 * Fynd (d), Johan med VoiceOver på iPaden 25/9: *Fet* tappade fokus och
 * markeringen. En hjälpmedelsaktivering flyttar fokus till knappen och skickar
 * ett `click` utan `mousedown` — så `preventDefault` på `mousedown` skyddar
 * ingenting. Proven gör precis det: fokus till knappen, sedan bara `click`.
 */
describe("<rich-text-field> — knappar aktiverade utan mus (fynd d)", () => {
  async function selectAllThenMoveTo(field: RichTextField, selector: string): Promise<HTMLButtonElement> {
    await focusEnd(field);
    await userEvent.keyboard("{Shift>}{Home}{/Shift}");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const button = field.shadowRoot!.querySelector<HTMLButtonElement>(selector)!;

    button.focus();
    await new Promise((resolve) => setTimeout(resolve, 20));
    return button;
  }

  it("Fet arbetar på den sparade markeringen och lägger fokus tillbaka i texten", async () => {
    const field = mount("två ord");
    const bold = await selectAllThenMoveTo(field, '[data-command="bold"]');

    bold.click();

    expect(field.value).toBe("**två ord**");
    expect(field.shadowRoot!.activeElement).toBe(text(field));
    expect(bold.getAttribute("aria-pressed")).toBe("true");

    // The selection is still the text's: a second press takes the bold away again.
    bold.focus();
    bold.click();
    expect(field.value).toBe("två ord");
  });

  /*
   * The order that loses the selection: the text gets its `blur` while it is
   * still the active element, and the selection collapses before focus has
   * moved on. That is the order VoiceOver's double-tap is suspected of on
   * iOS — not measured there (no WebKit on this machine), constructed here.
   * The field must go by its own focus, not by `activeElement`.
   */
  it("en markering som kollapsar efter blur men före fokusflytten är inte redaktörens", async () => {
    const field = mount("två ord");

    await focusEnd(field);
    await userEvent.keyboard("{Shift>}{Home}{/Shift}");
    await new Promise((resolve) => setTimeout(resolve, 20));

    const editable = text(field);
    const node = editable.querySelector("p")!.firstChild!;

    editable.dispatchEvent(new FocusEvent("blur"));
    document.getSelection()!.collapse(node, 0);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const bold = field.shadowRoot!.querySelector<HTMLButtonElement>('[data-command="bold"]')!;

    bold.focus();
    bold.click();

    expect(field.value).toBe("**två ord**");
    expect(field.shadowRoot!.activeElement).toBe(editable);
  });

  it("punktlistan likaså", async () => {
    const field = mount("rad");
    const bullet = await selectAllThenMoveTo(field, '[data-command="bullet-list"]');

    bullet.click();

    expect(field.value).toBe("- rad");
    expect(field.shadowRoot!.activeElement).toBe(text(field));
  });

  it("Infoga svar ersätter den sparade markeringen", async () => {
    const field = mount("Hej NAMN");

    await focusEnd(field);
    await userEvent.keyboard("{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const toggle = field.shadowRoot!.querySelector<HTMLButtonElement>("[data-answer-toggle]")!;

    toggle.focus();
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    const option = field.shadowRoot!.querySelector<HTMLButtonElement>('[data-insert="fornamn"]')!;

    option.focus();
    option.click();

    expect(field.value).toBe("Hej {{fornamn}}");
    expect(field.shadowRoot!.activeElement).toBe(text(field));
  });
});

/*
 * Fynd (g), Johan på iPaden 25/9: ångra tog inte tillbaka en borttagen
 * bricka, medan bokstäver ångrades. iPadens ångra (skakningen, knappen på
 * tangentbordet) kommer som `historyUndo` — i `beforeinput`, som går att
 * avbryta eller inte, och i `input` efteråt. Alla vägarna ska gå genom
 * modellens historik.
 */
describe("<rich-text-field> — ångra via historyUndo (fynd g)", () => {
  const undo = (field: RichTextField, cancelable: boolean): void => {
    const editable = text(field);
    const before = new InputEvent("beforeinput", { inputType: "historyUndo", bubbles: true, cancelable, composed: true });

    editable.dispatchEvent(before);
    // An engine that would not let it be cancelled has done its own undo — of
    // nothing of ours — and says so in `input`.
    if (!before.defaultPrevented) {
      editable.dispatchEvent(new InputEvent("input", { inputType: "historyUndo", bubbles: true, composed: true }));
    }
  };

  it.each([true, false])("Backspace på brickan, sedan historyUndo (avbrytbar: %s) — brickan tillbaka", async (cancelable) => {
    const field = mount("ab{{fornamn}}cd");

    await focusEnd(field);
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{Backspace}");
    expect(field.value).toBe("abcd");

    undo(field, cancelable);
    expect(field.value).toBe("ab{{fornamn}}cd");
  });

  it.each([true, false])("Ta bort i brickans meny, sedan historyUndo (avbrytbar: %s) — brickan tillbaka", async (cancelable) => {
    const field = mount("Hej {{fornamn}}!");

    await focusEnd(field);
    field.selectChip("fornamn");
    await userEvent.keyboard("{Enter}");
    field.shadowRoot!.querySelector<HTMLButtonElement>("[data-chip-menu] [data-remove]")!.click();
    expect(field.value).toBe("Hej !");

    undo(field, cancelable);
    expect(field.value).toBe("Hej {{fornamn}}!");
  });
});

describe("<rich-text-field> — brickor och Infoga svar (Del C)", () => {
  it("Infoga svar mitt i ett ord lägger brickan med etiketten, lagras som {{x}} (handling 6)", async () => {
    const field = mount("abcd");
    const toggle = field.shadowRoot!.querySelector<HTMLButtonElement>("[data-answer-toggle]")!;

    await focusEnd(field);
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    toggle.click();
    field.shadowRoot!.querySelector<HTMLButtonElement>('[data-insert="fornamn"]')!.click();

    expect(field.value).toBe("ab{{fornamn}}cd");
    const chip = text(field).querySelector("[data-chip]")!;
    expect(chip.textContent).toContain("Förnamn");
    expect(chip.getAttribute("aria-label")).toBe("Förnamn, svar");
    expectOnlyModelDom(field);
  });

  it("Backspace direkt efter en bricka tar hela brickan, texten intakt (handling 7)", async () => {
    const field = mount("ab{{fornamn}}cd");

    await focusEnd(field);
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{Backspace}");

    expect(field.value).toBe("abcd");
  });

  it("Delete framför en bricka tar hela brickan (handling 14)", async () => {
    const field = mount("ab{{fornamn}}cd");

    await focusEnd(field);
    await userEvent.keyboard("{Home}{ArrowRight}{ArrowRight}{Delete}");

    expect(field.value).toBe("abcd");
  });

  it("infoga, ångra, gör om — ett steg var (handling 9)", async () => {
    const field = mount("ab");
    const toggle = field.shadowRoot!.querySelector<HTMLButtonElement>("[data-answer-toggle]")!;

    await focusEnd(field);
    toggle.click();
    field.shadowRoot!.querySelector<HTMLButtonElement>('[data-insert="ort"]')!.click();
    expect(field.value).toBe("ab{{ort}}");

    await userEvent.keyboard("{Control>}z{/Control}");
    expect(field.value).toBe("ab");

    await userEvent.keyboard("{Control>}y{/Control}");
    expect(field.value).toBe("ab{{ort}}");
  });

  it("brickans meny: byt och ta bort, båda ångras (handling 15)", async () => {
    const field = mount("Hej {{fornamn}}!");

    await focusEnd(field);
    expect(field.selectChip("fornamn")).toBe(true);
    await userEvent.keyboard("{Enter}");

    const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-chip-menu]")!;
    expect(menu.hidden).toBe(false);
    expect(field.shadowRoot!.activeElement?.getAttribute("role")).toMatch(/^menuitem/);

    menu.querySelector<HTMLButtonElement>('[data-swap="ort"]')!.click();
    expect(field.value).toBe("Hej {{ort}}!");

    await userEvent.keyboard("{Control>}z{/Control}");
    expect(field.value).toBe("Hej {{fornamn}}!");

    field.selectChip("fornamn");
    await userEvent.keyboard("{Enter}");
    menu.querySelector<HTMLButtonElement>("[data-remove]")!.click();
    expect(field.value).toBe("Hej !");

    await userEvent.keyboard("{Control>}z{/Control}");
    expect(field.value).toBe("Hej {{fornamn}}!");
  });

  it("Esc stänger brickans meny och fokus går tillbaka till texten (136 kriterium 10)", async () => {
    const field = mount("Hej {{fornamn}}!");

    await focusEnd(field);
    field.selectChip("fornamn");
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Escape}");

    expect(field.shadowRoot!.querySelector<HTMLElement>("[data-chip-menu]")!.hidden).toBe(true);
    expect(field.shadowRoot!.activeElement).toBe(text(field));
  });

  /*
   * Fynd (e), Johans iPad 25/9: brickans meny låg delvis under fältets
   * nederkant, klippt av skrivytans egen låda. Menyn låg sedan fast mot
   * vyn — tills Johans iPad 27/9 (protokollet punkt A): med tangentbordet
   * uppe flyttar iPadOS det fasta lagret, och menyn öppnades på −235 px
   * medan det synliga låg 394–834. Nu ligger den absolut i fältets ram, som
   * panelens variabelmeny, och panelen rullar fram den om den hamnar
   * nedanför kanten. Mätt med vad ett finger träffar — `elementFromPoint`.
   */
  it.each([
    ["brickans meny", async (field: RichTextField) => {
      field.selectChip("fornamn");
      await userEvent.keyboard("{Enter}");
      return field.shadowRoot!.querySelector<HTMLElement>("[data-chip-menu]")!;
    }],
    ["Infoga svar", async (field: RichTextField) => {
      field.shadowRoot!.querySelector<HTMLButtonElement>("[data-answer-toggle]")!.click();
      return field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;
    }],
  ])("%s rullas fram i en låda som rullar, och följer med när lådan rullar", async (_name, open) => {
    const holder = document.createElement("div");

    holder.style.cssText = "width: 340px; height: 160px; overflow: auto;";
    document.body.append(holder);
    const field = mount("Hej {{fornamn}}", { multiline: false, features: ["variable"] });

    holder.append(field);
    await focusEnd(field);
    const menu = await open(field);
    const last = [...menu.querySelectorAll<HTMLElement>("button")].at(-1)!;
    const box = last.getBoundingClientRect();
    const frame = holder.getBoundingClientRect();

    expect(menu.hidden).toBe(false);
    expect(box.bottom, "menyns sista rad står inom lådans synliga del").toBeLessThanOrEqual(frame.bottom + 1);
    expect(box.top).toBeGreaterThanOrEqual(frame.top - 1);
    expect(field.shadowRoot!.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)).toBe(last);

    const offset = (): number => menu.getBoundingClientRect().top - field.getBoundingClientRect().top;
    const before = offset();

    holder.scrollTop -= 20;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(menu.hidden, "en rullning stänger inte menyn").toBe(false);
    expect(offset(), "menyn följer sitt ankare").toBeCloseTo(before, 0);
  });

  /*
   * Fynd (b), Johans iPad 25/9: chevronen satt lågt i brickan — glyfen ⌄,
   * vars bläck varje typsnitt lägger olika. Den ritade är två kanter av en
   * vriden kvadrat; bara nedre halvan har bläck, så dess mitt ligger vid tre
   * fjärdedelar av boxens höjd. Den ska stå mitt på x-höjden, där gemenerna
   * har sin tyngd — mätt med typsnittets egna mått via canvas, i editorns
   * typsnitt. Glyfen låg 1,5–2 px under, den ritade med det gamla lyftet
   * 1,2–1,4 px; gränsen skiljer dem från det som står nu.
   *
   * "Infoga svar" (nu plusset, Johans val 26/9) hade en egen rad här innan
   * knappen blev ett bart plus utan chevron, samma form som formaterings-
   * knapparna — provet gäller bara brickan nu.
   */
  it.each([
    ["brickan", (field: RichTextField) => text(field).querySelector<HTMLElement>("[data-chip]")!],
  ])("chevronen i %s står mitt på x-höjden", (_name, find) => {
    const field = mount("Hej {{fornamn}}", { multiline: false, features: ["variable"] });

    field.style.fontFamily = "var(--fw-font)";
    const host = find(field);
    const chevron = host.querySelector<HTMLElement>(".chevron")!;
    const label = document.createRange();

    label.selectNodeContents(host.querySelector(".chip__label") ?? host.firstChild!);
    const context = document.createElement("canvas").getContext("2d")!;

    context.font = getComputedStyle(host).font;
    const metrics = context.measureText("x");
    const baseline = label.getBoundingClientRect().bottom - metrics.fontBoundingBoxDescent;
    const middle = baseline - metrics.actualBoundingBoxAscent / 2;
    const box = chevron.getBoundingClientRect();

    expect(chevron.textContent, "ritad, inte en glyf").toBe("");
    expect(getComputedStyle(chevron, "::after").content, "ritad, inte en glyf").toBe("none");
    expect(Math.abs(box.top + box.height * 0.75 - middle), "bläckets mitt mot x-höjdens").toBeLessThanOrEqual(0.75);
  });

  /*
   * Plusset (Johans val 26/9): sist i verktygsraden och avskilt med luft —
   * det formaterar inte markeringen, det lägger till något, och det ska
   * synas i raden. Avståndet till plusset är större än det största mellan
   * formateringsknapparna.
   */
  it("plusset står sist i verktygsraden, med mer luft före sig än mellan formateringsknapparna", () => {
    const field = mount("Hej", { features: ALL });

    field.style.cssText = "display: block; width: 520px; font-family: var(--fw-font);";
    const toolbar = field.shadowRoot!.querySelector<HTMLElement>("[data-toolbar]")!;
    const tools = [...toolbar.querySelectorAll<HTMLElement>("[data-command]")].map((tool) => tool.getBoundingClientRect());
    const plus = toolbar.querySelector<HTMLElement>("[data-answer-toggle]")!;
    const gaps = tools.slice(1).map((tool, index) => tool.left - tools[index]!.right);
    const plusGap = plus.getBoundingClientRect().left - tools[tools.length - 1]!.right;

    expect(toolbar.lastElementChild, "plusset sist i raden").toBe(plus);
    expect(plus.getBoundingClientRect().top, "på samma rad").toBeCloseTo(tools[0]!.top, 0);
    expect(plusGap, `luft före plusset ${plusGap}, mellan knapparna ${gaps.join(", ")}`).toBeGreaterThan(Math.max(...gaps));
  });

  /*
   * Johan 28/9, "gap 4": knapparna 44 → 48 px (K6:s golv, 44, är oförändrat
   * — 48 ligger över det, ingen token träffar 48 exakt), gapet 8 → 4
   * (`--fw-space-1`) samma dag — knapparnas egen storlek tar över luftens
   * roll, inte gapet mellan dem.
   */
  it("formateringsknapparna är 48 px med 4 px mellanrum", () => {
    const field = mount("Hej", { features: ALL });

    field.style.cssText = "display: block; width: 520px; font-family: var(--fw-font);";
    const toolbar = field.shadowRoot!.querySelector<HTMLElement>("[data-toolbar]")!;
    const tools = [...toolbar.querySelectorAll<HTMLElement>("[data-command]")].map((tool) => tool.getBoundingClientRect());
    const gaps = tools.slice(1).map((tool, index) => tool.left - tools[index]!.right);

    for (const tool of tools) {
      expect(tool.width, "48 px bred").toBeCloseTo(48, 0);
      expect(tool.height, "48 px hög, K6:s 44 px-golv gott och väl").toBeCloseTo(48, 0);
    }
    // Länk→lista-gapet går över `.toolbar__divider` (egen bredd + marginal,
    // 17 px mätt) — uteslutet här, det är avdelarens mått, inte knapparnas.
    for (const gap of gaps.filter((g) => g < 10)) {
      expect(gap, "4 px mellan knapparna").toBeCloseTo(4, 0);
    }
  });

  /*
   * Plusmenyn varv 3 (Johans iPad 27/9): `idag` sattes inte av någon fråga
   * och står i en egen grupp, "Inbyggt", under svaren — avgjort av flaggan
   * `computed`, aldrig av namnet.
   */
  it("ett uträknat värde står i gruppen Inbyggt, inte under Svar", async () => {
    const field = mount("Hej", { features: ALL });

    field.variables = [
      { value: "fornamn", label: "Förnamn" },
      { value: "idag", label: "I dag", computed: true },
    ];
    await userEvent.click(field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!);

    const groups = [...field.shadowRoot!.querySelectorAll<HTMLElement>("[data-answer-menu] [role='group']")];
    const inGroup = (name: string) =>
      [...(groups.find((group) => group.getAttribute("aria-label") === name)?.querySelectorAll<HTMLElement>("[data-insert]") ?? [])].map(
        (row) => row.dataset.insert,
      );

    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual(["Svar från guiden", "Inbyggt"]);
    expect(inGroup("Svar från guiden")).toEqual(["fornamn"]);
    expect(inGroup("Inbyggt")).toEqual(["idag"]);
  });

  /*
   * Grupprubrikerna (Johan 27/9): ingen versal, ingen spärr. Astras exakta
   * mått (tredje vändan, 28/9) river 27/9:s och andra vändans beslut att
   * dela storlek/vikt med raderna: rubriken får nu sin EGEN storlek (13 px,
   * `--fw-font-size-base`) och vikt (600, `--fw-weight-strong` — mätt:
   * `--fw-weight-heading` är 700, inte 600, ingen medium-token finns),
   * skild från radernas (16 px, `--fw-font-size-xl`; 400, `--fw-weight-
   * text`).
   */
  it("grupprubriken i plusmenyn har Astras egen storlek (13px/600), skild från radernas (16px/400)", async () => {
    const field = mount("Hej", { features: ALL });

    field.variables = [
      { value: "fornamn", label: "Förnamn" },
      { value: "idag", label: "I dag", computed: true },
    ];
    await userEvent.click(field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!);

    const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;
    const row = getComputedStyle(menu.querySelector("[data-insert]")!);

    expect(row.fontSize, "raden").toBe("16px");
    expect(row.fontWeight, "raden").toBe("400");

    for (const label of menu.querySelectorAll(".menu__group-label")) {
      const style = getComputedStyle(label);

      expect(style.fontSize, label.textContent ?? "").toBe("13px");
      expect(style.fontWeight, label.textContent ?? "").toBe("600");
      expect(style.textTransform).toBe("none");
      expect(style.letterSpacing).toBe(row.letterSpacing);
    }
  });

  /*
   * Astras förslag (Johan 28/9, "för bättring av menyn") tar bort det som
   * kom in 27/9 (streck under rubriken) och i variant (d) (bakgrundstonen
   * och ikonen på rubriken) — vänder de kontrollerna: en rubrik ska nu vara
   * genomskinlig, utan egen kant och utan egen ikon.
   */
  it("gruprubriken i plusmenyn har varken bakgrund, streck eller egen ikon", async () => {
    const field = mount("Hej", { features: ALL });

    field.variables = [
      { value: "fornamn", label: "Förnamn" },
      { value: "idag", label: "I dag", computed: true },
    ];
    await userEvent.click(field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!);

    const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;
    const labels = [...menu.querySelectorAll<HTMLElement>(".menu__group-label")];

    expect(labels.length, "två grupper: Svar från guiden, Inbyggt").toBe(2);
    for (const label of labels) {
      const style = getComputedStyle(label);

      expect(style.backgroundColor, label.textContent ?? "").toBe("rgba(0, 0, 0, 0)");
      expect(style.borderBottomWidth, label.textContent ?? "").toBe("0px");
      expect(label.querySelector("svg"), `ingen ikon i ${label.textContent}`).toBeNull();
    }
  });

  /*
   * Astras förslag: ikonen flyttar till varje rad i stället — en pratbubbla
   * för ett svar, en kalender för det motorn räknar ut själv (`idag`).
   */
  it("varje rad i plusmenyn har en egen ikon, en form per grupp", async () => {
    const field = mount("Hej", { features: ALL });

    field.variables = [
      { value: "fornamn", label: "Förnamn" },
      { value: "idag", label: "I dag", computed: true },
    ];
    await userEvent.click(field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!);

    const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;
    const rows = [...menu.querySelectorAll<HTMLButtonElement>("[data-insert]")];
    const icon = (value: string) => rows.find((row) => row.dataset.insert === value)!.querySelector("svg")!.outerHTML;

    for (const row of rows) expect(row.querySelector("svg"), row.textContent ?? "").not.toBeNull();
    expect(icon("idag"), "olika ikon för ett uträknat värde än för ett svar").not.toBe(icon("fornamn"));
  });

  /*
   * Astras facit, andra vändan (28/9): inga linjer mellan enskilda rader —
   * bara den enda linjen mellan grupperna. Provad i tre rader så att den
   * gamla `:not(:last-child)`-regeln (som gav Namn och Ort en linje men
   * inte Fortsätta, eftersom den räknade per grupp) verkligen är borta
   * överallt, inte bara på den rad som redan var sist.
   */
  it("inga linjer mellan raderna i plusmenyn, bara mellan grupperna", async () => {
    const field = mount("Hej", { features: ALL });

    field.variables = [
      { value: "fornamn", label: "Förnamn" },
      { value: "ort", label: "Ort" },
      { value: "idag", label: "I dag", computed: true },
    ];
    await userEvent.click(field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!);

    const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;
    const rows = [...menu.querySelectorAll<HTMLButtonElement>("[data-insert]")];

    expect(rows.length, "tre rader att pröva mellanrummen på").toBe(3);
    for (const row of rows) {
      expect(getComputedStyle(row).borderBottomWidth, row.textContent ?? "").toBe("0px");
    }
  });

  /*
   * Astras exakta mått (tredje vändan): linjen mellan grupperna är nu ett
   * eget `::before`-element (minst kod, ingen extra markup) med
   * `margin: 16px 12px` — 16 lika på var sida (upp från förra vändans
   * ojämna 12/8, avrundade till 20), 12 indragen så linjen inte går kant
   * i kant. Färgen är `--fw-border` (Siv, 29/9): `--fw-border-subtle` mätte
   * 1,03:1 mot menyns upphöjda yta i mörkt läge — samma fel formelmenyns
   * rad-linje hade och fick samma rättning för (IDEAS.md, Johan 29/9).
   */
  it("linjen mellan grupperna i plusmenyn har 16 px luft på var sida, indragen 12 px", async () => {
    const field = mount("Hej", { features: ALL });

    field.variables = [
      { value: "fornamn", label: "Förnamn" },
      { value: "idag", label: "I dag", computed: true },
    ];
    await userEvent.click(field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!);

    const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;
    const group2 = [...menu.querySelectorAll<HTMLElement>(".menu__group")][1]!;
    const before = getComputedStyle(group2, "::before");

    expect(before.content, "en linje, byggd som ::before").not.toBe("none");
    expect(before.display).toBe("block");
    expect(before.height).toBe("1px");
    expect(before.marginTop, "luft ovanför").toBe("16px");
    expect(before.marginBottom, "luft under").toBe("16px");
    expect(before.marginLeft, "indragen vänster").toBe("12px");
    expect(before.marginRight, "indragen höger").toBe("12px");

    // `.menu`s egen kant är `--fw-menu-border` sedan varv 11 (Astras egen
    // menyton) — inte samma token som avdelarens `--fw-border`, så den
    // jämförs mot en egen sond i stället för mot menyns kant.
    const probe = document.createElement("div");

    probe.style.cssText = "background: var(--fw-border);";
    menu.append(probe);
    expect(before.backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
    probe.remove();
  });

  /*
   * Siv, 29/9 (IDEAS.md, uppföljning på Astras formelvända): texteditorns
   * meny hade samma osynliga avdelare i mörkt tema som formelmenyn — mätt
   * 1,03:1 med `--fw-border-subtle` mot menyns upphöjda yta. Provet ovan
   * håller ljust och struktur; det här håller mörkt och siktar mot
   * formelmenyns riktmärke (1,58:1, `--fw-border` mot `--fw-surface-raised`).
   * Tokenvärdena läses rakt av (som `contrast.browser.test.ts` gör) i stället
   * för webbläsarens omräknade `rgb(...)`, som `contrastRatio` inte förstår.
   */
  it("linjen mellan grupperna i plusmenyn syns i mörkt tema (samma kontrast som formelmenyns)", async () => {
    document.body.setAttribute("data-fw-theme", "dark");
    try {
      const field = mount("Hej", { features: ALL });

      field.variables = [
        { value: "fornamn", label: "Förnamn" },
        { value: "idag", label: "I dag", computed: true },
      ];
      await userEvent.click(field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!);

      const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;
      const group2 = [...menu.querySelectorAll<HTMLElement>(".menu__group")][1]!;
      const before = getComputedStyle(group2, "::before");
      const border = getComputedStyle(menu).getPropertyValue("--fw-border").trim();
      const surfaceRaised = getComputedStyle(menu).getPropertyValue("--fw-surface-raised").trim();

      expect(contrastRatio(border, surfaceRaised), "--fw-border mot --fw-surface-raised, mörkt").toBeGreaterThanOrEqual(1.4);

      const probe = document.createElement("div");

      probe.style.cssText = "background: var(--fw-border);";
      menu.append(probe);
      expect(before.backgroundColor, "avdelaren bär faktiskt --fw-border").toBe(getComputedStyle(probe).backgroundColor);
      probe.remove();
    } finally {
      document.body.removeAttribute("data-fw-theme");
    }
  });

  /*
   * Astras förslag: plusset (och krysset det blir när menyn är öppen) får
   * en fylld accentbakgrund och en accentfärgad ikon i stället för att se
   * ut som formateringsknapparna intill — jämfört mot en av dem här, ingen
   * hårdkodad färg i provet.
   */
  it("plusset i verktygsraden har en fylld accentbakgrund, till skillnad från formateringsknapparna", () => {
    const field = mount("Hej", { features: ALL });
    const plus = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!;
    const bold = field.shadowRoot!.querySelector<HTMLElement>('[data-command="bold"]')!;

    expect(getComputedStyle(plus).backgroundColor).not.toBe(getComputedStyle(bold).backgroundColor);
  });

  /*
   * Astras förslag: en tunn lodrät linje mellan länken och listknapparna,
   * kvar när båda sidor av den finns i verktygsraden.
   */
  it("en linje skiljer länken från listknapparna i verktygsraden", () => {
    const field = mount("Hej", { features: ALL });
    const toolbar = field.shadowRoot!.querySelector<HTMLElement>("[data-toolbar]")!;
    const divider = toolbar.querySelector<HTMLElement>(".toolbar__divider")!;
    const link = toolbar.querySelector<HTMLElement>('[data-command="link"]')!;
    const list = toolbar.querySelector<HTMLElement>('[data-command="bullet-list"]')!;

    expect(divider, "linjen finns").not.toBeNull();
    expect(divider.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(divider.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  /*
   * Astras exakta mått (tredje vändan): svarsmenyn är 270 px inklusive
   * kant, 16 px in från vänster — inte längre utfylld mot fältets bredd
   * (360 px, förra vändan). I ett vanligt panelfält (340 px) räcker det
   * med marginal kvar för att 270 att rymmas, så menyn stannar vid sin
   * egna bredd i stället för att sträcka sig ut mot högerkanten — bara
   * svarsmenyn; brickans byt-meny (start-justerad under brickan) är
   * opåverkad, provad här i samma fält.
   */
  it("svarsmenyn är 270 px i ett vanligt fält, brickans meny gör inte samma sak", async () => {
    const field = mount("Hej {{fornamn}}", { multiline: true, features: ALL });

    field.style.cssText = "display: block; width: 340px; font-family: var(--fw-font);";
    await userEvent.click(field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!);

    const frameElement = field.shadowRoot!.querySelector<HTMLElement>("[data-frame]")!;
    const frame = frameElement.getBoundingClientRect();
    const answerMenu = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!.getBoundingClientRect();
    // `left`/`right` on an absolutely placed child count from the frame's
    // padding edge, one border-width inside `getBoundingClientRect()`'s box —
    // netted out here so the assertion checks the design's 16 px, not a
    // border-width detail of `.frame`.
    const plus = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!.getBoundingClientRect();

    // Johan 28/9 morgon: "menyns högerkant aligns åt höger med knappens
    // högerkant" — menyn hänger under plusset, inte 16 px in från vänster.
    expect(answerMenu.right, "högerkanten i linje med plussets").toBeCloseTo(plus.right, 0);
    expect(answerMenu.width, "270 px, kanten inräknad").toBeCloseTo(270, 0);
    expect(answerMenu.left, "menyn håller sig inom ramen").toBeGreaterThanOrEqual(frame.left);

    field.selectChip("fornamn");
    await userEvent.keyboard("{Enter}");
    const chipMenu = field.shadowRoot!.querySelector<HTMLElement>("[data-chip-menu]")!.getBoundingClientRect();

    expect(chipMenu.width, "brickans meny håller sin egen bredd, inte 270").toBeLessThan(answerMenu.width);
  });

  /*
   * Samma mått, ett smalt fält (260 px, för smalt för 270 + 2×16): menyn
   * krymper i stället — `min(270, ramens bredd − 32)` — med högerkanten
   * kvar vid plusset (Johan 28/9).
   */
  it("svarsmenyn krymper under 270 px i ett smalt fält, högerkanten kvar vid plusset", async () => {
    const field = mount("Hej", { multiline: true, features: ALL });

    field.style.cssText = "display: block; width: 260px; font-family: var(--fw-font);";
    await userEvent.click(field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!);

    const frameElement = field.shadowRoot!.querySelector<HTMLElement>("[data-frame]")!;
    const frame = frameElement.getBoundingClientRect();
    const answerMenu = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!.getBoundingClientRect();
    const plus = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!.getBoundingClientRect();

    expect(answerMenu.width, "krymper under taket på 270").toBeLessThan(270);
    expect(answerMenu.right, "högerkanten i linje med plussets även här").toBeCloseTo(plus.right, 0);
    expect(answerMenu.left, "menyn håller sig inom ramen").toBeGreaterThanOrEqual(frame.left);
  });

  /*
   * Astras "särskilt viktiga" linjering (tredje vändan): rubrikens text,
   * radens ikon och avdelarens vänsterkant ska stå på samma x — 18 px
   * innanför menyns egen paddingkant (6 px `.menu`-padding + 12 px
   * gemensam vänsterpadding i rubrik/rad/avdelare). Mätt med
   * `getBoundingClientRect` mot menyns paddingkant, inte dess kantlinje
   * (samma nettoteknik som fältets 16 px-marginal ovan) — annars hamnar
   * allt 1 px fel, kantens egen bredd. Avdelaren är ett `::before` utan
   * egen DOM-nod, så dess x räknas ut från gruppens box plus dess
   * `getComputedStyle(el, "::before")`-marginal.
   */
  it("rubrikens text, radens ikon och avdelaren ligger på samma x, 18 px in (Astra: \"särskilt viktig\")", async () => {
    const field = mount("Hej", { features: ALL });

    field.variables = [
      { value: "fornamn", label: "Förnamn" },
      { value: "idag", label: "I dag", computed: true },
    ];
    await userEvent.click(field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!);

    const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;
    const menuBox = menu.getBoundingClientRect();
    const menuBorder = parseFloat(getComputedStyle(menu).borderLeftWidth) || 0;
    const reference = menuBox.left + menuBorder; // menyns paddingkant

    const label = menu.querySelector<HTMLElement>(".menu__group-label")!;
    const labelPaddingLeft = parseFloat(getComputedStyle(label).paddingLeft) || 0;
    const labelTextX = label.getBoundingClientRect().left + labelPaddingLeft - reference;

    const icon = menu.querySelector<HTMLElement>("[data-insert] svg")!;
    const iconX = icon.getBoundingClientRect().left - reference;

    const group2 = [...menu.querySelectorAll<HTMLElement>(".menu__group")][1]!;
    const dividerMarginLeft = parseFloat(getComputedStyle(group2, "::before").marginLeft) || 0;
    const dividerX = group2.getBoundingClientRect().left + dividerMarginLeft - reference;

    expect(labelTextX, "rubrikens text").toBeCloseTo(18, 0);
    expect(iconX, "radens ikon").toBeCloseTo(18, 0);
    expect(dividerX, "avdelaren").toBeCloseTo(18, 0);

    const row = menu.querySelector<HTMLElement>("[data-insert]")!;

    expect(row.getBoundingClientRect().height, "K6:s 44 px-golv håller, Astras 46 gör det med marginal").toBeGreaterThanOrEqual(46);
    expect(menuBox.width, "menyns bredd, kanten inräknad").toBeCloseTo(270, 0);
  });

  /*
   * Astras andra spec (Johan 28/9, varv 11), facit efter Johans regel —
   * inga nya färger, inga nya tokens: menyns ram, bakgrund och skugga är
   * befintliga tokens, valda efter funktion och mätt avstånd (se
   * `.menu`s egen kommentar för siffrorna) — `--fw-surface-subtle`,
   * `--fw-border` (byte från `--fw-border-subtle`) och `--fw-shadow-
   * raised` (inte `-floating`, för stor för Astras smalare skugga).
   * Jämfört mot sonder som läser samma `var(...)`, robust mot hur temat
   * väljer att rendera dem.
   */
  it.each([
    [null] as const,
    ["dark"] as const,
  ])("menyns yta, kant och skugga följer temat (%s)", async (theme) => {
    if (theme) document.body.setAttribute("data-fw-theme", theme);

    try {
      const field = mount("Hej", { features: ALL });

      await userEvent.click(field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!);

      const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;
      const style = getComputedStyle(menu);

      const probe = document.createElement("div");

      // `--fw-surface-raised`, inte subtle (Astra via Johan 28/9: i mörkt
      // läge låg menyn och fältet för nära varandra i ljushet).
      probe.style.cssText = "background: var(--fw-surface-raised); border-color: var(--fw-border); box-shadow: var(--fw-shadow-raised);";
      menu.append(probe);
      const probeStyle = getComputedStyle(probe);

      expect(style.backgroundColor, "bakgrund, --fw-surface-raised").toBe(probeStyle.backgroundColor);
      expect(style.backgroundColor.startsWith("rgba") && style.backgroundColor.endsWith(", 0)"), "inte genomskinlig").toBe(false);
      expect(style.borderTopColor, "ram, --fw-border").toBe(probeStyle.borderColor);
      expect(style.boxShadow, "skugga, --fw-shadow-raised, ingen literal").toBe(probeStyle.boxShadow);
      probe.remove();
    } finally {
      document.body.removeAttribute("data-fw-theme");
    }
  });

  /*
   * Astra 30/9 (B9, bilaga 2): the same action had two names — "Lägg till" in
   * the text field, "Infoga variabel" in the formula. One name in every
   * placing, and the same tooltip: the toolbar's plus, the one-line field's
   * plus in its right edge, and the formula's corner plus.
   */
  it.each([
    ["sv", "Infoga variabel"],
    ["en", "Insert variable"],
  ])("plusset heter samma sak i textfältet och formelfältet (%s: %s)", (locale, name) => {
    const placings = [
      mount("Hej", { features: ALL }),
      mount("Hej", { multiline: false, features: ["variable"] }),
      mount("1 + 2", { multiline: false, features: ["variable"] }),
    ];
    placings[2].setAttribute("formula", "");
    placings.forEach((field) => field.setAttribute("editor-locale", locale));

    const named = placings.map((field) => {
      const plus = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!;
      const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;

      return [plus.getAttribute("aria-label"), plus.getAttribute("title"), menu.getAttribute("aria-label")];
    });

    expect(named).toEqual([[name, name, name], [name, name, name], [name, name, name]]);
  });

  /*
   * Plusset blir ett kryss medan dess meny är öppen (Johan 27/9): samma
   * knapp, vriden 45°, och namnet säger vad ett tryck gör — "Stäng".
   */
  it("plusset heter Stäng medan menyn är öppen och Infoga variabel igen när den stängs", async () => {
    const field = mount("Hej", { features: ALL });
    const plus = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!;

    expect(plus.getAttribute("aria-label")).toBe("Infoga variabel");
    await userEvent.click(plus);
    expect(plus.getAttribute("aria-expanded")).toBe("true");
    expect(plus.getAttribute("aria-label")).toBe("Stäng");
    expect(plus.getAttribute("title")).toBe("Stäng");
    await userEvent.click(plus);
    expect(plus.getAttribute("aria-expanded")).toBe("false");
    expect(plus.getAttribute("aria-label")).toBe("Infoga variabel");
  });

  /*
   * Protokollet punkt E, Johans iPad 28/9 ("FAIL" på bilden): ren text i
   * standardformat klistrades in och punktlistan tolkades, men fet stod kvar
   * som `**…**`. Fältet skriver standardformatet i text/plain när man
   * kopierar (onCopy), så ren text ska läsas med samma läsare som fältets
   * sparade värde — annars tappar kopiera → klistra in formateringen så
   * fort en app på vägen släpper HTML-delen (Anteckningar gör det). Det
   * som läsaren inte har ord för (`##`, `==`, taggar) förblir text.
   */
  it("ren text i standardformat läses som fältets sparade värde vid inklistring", async () => {
    const field = mount("", { features: ALL });
    const data = new DataTransfer();

    data.setData(
      "text/plain",
      "Kaffet serveras från klockan nio.\n\n**Ta med giltig legitimation.**\n\n- Parkering finns bakom huset\n- Cyklar ställs vid entrén\n\n## Sista anmälningsdag är fredag.\n\nHär är ==en markerad bit== och <span style=\"color:#b3261e\">en röd bit</span> som båda ska bli vanlig text.",
    );
    await focusEnd(field);
    paste(field, data);

    const strong = text(field).querySelector("strong");

    expect(strong?.textContent).toBe("Ta med giltig legitimation.");
    expect(text(field).textContent).not.toContain("**");
    expect([...text(field).querySelectorAll("ul li")].map((item) => item.textContent)).toEqual([
      "Parkering finns bakom huset",
      "Cyklar ställs vid entrén",
    ]);
    expect(text(field).textContent).toContain("## Sista anmälningsdag är fredag.");
    expect(text(field).textContent).toContain('==en markerad bit== och <span style="color:#b3261e">en röd bit</span>');
    expect(text(field).querySelector("span[style]")).toBeNull();
    expectOnlyModelDom(field);
  });

  /*
   * Astras facit (Johan 28/9, tredje vändan, Fable): med 52 px höga rader
   * rymde menyns tak på 280 px — satt när den låg fast mot fönstret — inte
   * tre svar, I dag och två rubriker; sista raden klipptes i Fias bild.
   * Menyn ligger nu i ramen och panelen rullar, så taket får vara högre;
   * det finns kvar för guider med många svar, då rullar menyn själv.
   */
  it("plusmenyn med fem svar visas hel, utan att rulla", async () => {
    const field = mount("Hej", { features: ALL });

    field.variables = [
      { value: "fornamn", label: "Förnamn" },
      { value: "ort", label: "Ort" },
      { value: "fortsatt", label: "Fortsätta" },
      { value: "mer", label: "Något mer" },
      { value: "epost", label: "E-post" },
    ];
    await userEvent.click(field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!);
    const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;

    expect(menu.hidden).toBe(false);
    expect(menu.querySelectorAll("button").length).toBeGreaterThanOrEqual(5);
    expect(menu.scrollHeight, "menyn klipps och måste rullas").toBeLessThanOrEqual(menu.clientHeight);
  });

  /*
   * Johans iPad 27/9 (protokollet punkt A): "menyn kommer inte upp" varannan
   * gång. Mätt i WebKit som iPad: ett tryck utanför fältet stängde aldrig
   * menyn — fältet lyssnade bara på tryck i sin egen skuggrot — så nästa
   * tryck på plusset stängde den öppna menyn i stället för att öppna.
   */
  it("ett tryck utanför fältet stänger plusmenyn, så nästa tryck på plusset öppnar", async () => {
    const field = mount("Hej", { features: ALL });
    const plus = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!;
    const outside = document.createElement("p");

    outside.textContent = "utanför fältet";
    document.body.append(outside);
    await userEvent.click(plus);
    expect(plus.getAttribute("aria-expanded")).toBe("true");
    outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    expect(plus.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(plus);
    expect(plus.getAttribute("aria-expanded")).toBe("true");
    outside.remove();
  });

  /*
   * Fynd (f), Johans iPad 25/9: när brickan bryts till nästa rad stod
   * markören kvar efter "oss!" på raden ovanför, fast modellen står före
   * brickan. Den målade markören går inte att läsa ur DOM:en, men Home gör
   * det motorn själv tror: den går till början av den rad markören står på.
   * Står den på brickans rad hamnar X före brickan; står den på raden ovanför
   * hamnar X först i stycket. Sett falla i Firefox och i WebKit (där bara
   * brickans omslag hjälpte); Chromiums Home sa brickans rad redan före
   * rättningen (se toDom och renderInline).
   */
  it("markören före en bricka som brutits till nästa rad står på brickans rad", async () => {
    const field = mount("Välkommen till oss!{{fornamn}}", { features: ["variable"] });

    field.style.cssText = "display: block; width: 190px; font-family: var(--fw-font);";
    await focusEnd(field);
    await userEvent.keyboard("{ArrowLeft} ");

    const words = document.createRange();

    words.selectNodeContents(text(field).querySelector("p")!.firstChild!);
    const chip = text(field).querySelector<HTMLElement>("[data-chip]")!;

    expect(chip.getBoundingClientRect().top, "brickan har brutits till nästa rad").toBeGreaterThan(words.getClientRects()[0]!.bottom);

    await userEvent.keyboard("{Home}X");
    expect(field.value).toBe("Välkommen till oss! X{{fornamn}}");
  });

  /*
   * Fynd (f) igen, Johans iPad 26/9 morgon: ett tryck strax före en bricka
   * som brutits till rad två. Webbläsaren själv lägger markören vid textslutet
   * på raden ovanför — textnoden, offset sist, mätt i Playwrights WebKit som
   * iPad Pro 11 — och fältet läste bara av den. Ordfogaren hjälpte bara när
   * fältet satte markören. Ett klick bär samma väg som ett tryck (mätt båda).
   */
  it("ett klick strax före en bricka som brutits till nästa rad lägger markören på brickans rad", async () => {
    const field = mount("Välkommen till oss! {{fornamn}}", { features: ["variable"] });

    field.style.cssText = "display: block; width: 190px; font-family: var(--fw-font);";
    const words = document.createRange();

    words.selectNodeContents(text(field).querySelector("p")!.firstChild!);
    const chip = text(field).querySelector<HTMLElement>("[data-chip]")!;
    const chipBox = chip.getBoundingClientRect();
    const firstLine = words.getClientRects()[0]!;

    expect(chipBox.top, "brickan har brutits till nästa rad").toBeGreaterThan(firstLine.bottom);

    const box = text(field).getBoundingClientRect();

    await userEvent.click(text(field), {
      position: { x: chipBox.left - 3 - box.left, y: chipBox.top + chipBox.height / 2 - box.top },
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const caret = caretRange(field);
    const rects = [...caret.getClientRects()];
    const at = rects[0] ?? caret.getBoundingClientRect();

    expect(caret.collapsed).toBe(true);
    expect(at.top, "markören står på raden ovanför brickan").toBeGreaterThanOrEqual(firstLine.bottom);

    await userEvent.keyboard("X");
    expect(field.value).toBe("Välkommen till oss! X{{fornamn}}");
  });

  /*
   * Fynd (l), Johans iPad 26/9: *"Det gick inte att ställa sig sist om
   * brickan var sist i raden."* Mätt i Playwrights WebKit som iPad Pro 11
   * med touchscreen.tap, sista brickan i ett flerradigt fält: 3, 10 och 40 px
   * till höger på samma rad ger `<p>@2` — efter omslaget, rätt. 10 px till
   * höger och 14 px nedanför brickans mitt ger `<span.chevron>@0`, inne i
   * brickan, och brickan blev vald. Ett tryck bredvid brickan ska ställa
   * markören efter den; ett tryck på den väljer den som förut.
   */
  it("ett tryck till höger om och nedanför en sista bricka ställer markören efter den", async () => {
    const field = mount("Du svarade {{fornamn}}", { features: ["variable"] });

    field.style.cssText = "display: block; width: 320px; font-family: var(--fw-font);";
    const chip = text(field).querySelector<HTMLElement>("[data-chip]")!.getBoundingClientRect();
    const box = text(field).getBoundingClientRect();

    await userEvent.click(text(field), {
      position: { x: chip.right + 10 - box.left, y: chip.top + chip.height / 2 + 14 - box.top },
    });
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(text(field).querySelector("[data-chip][data-selected]"), "brickan blev vald").toBeNull();
    await userEvent.keyboard("X");
    expect(field.value).toBe("Du svarade {{fornamn}}X");
  });

  /*
   * Fynd (l) igen, Johans iPad 27/9 (bygg 0bcd51f5): ett långtryck med
   * luppen, 2,5 s. pointerdown 105 696 ms, selectionchange 106 324 ms —
   * Safari lägger markören i "␠Iug␠" @3 och sedan i `<span.chevron> @0`,
   * modell 0:11, brickan vald — pointerup 108 205 ms. Flytten kom 628 ms
   * efter trycket, utanför det tidsfönster regeln hade, och under ett
   * långtryck följer markören fingret, så pekpunkten kan ligga på brickan.
   *
   * Emulerat här som i loggen: nedtryck, 700 ms, markören inne i chevronen,
   * upplyft. En hopfallen markör inne i en bricka är aldrig en giltig plats:
   * den flyttas ut, efter brickan — eller före, när fingret stod vänster om
   * brickans mitt.
   */
  async function longPress(field: RichTextField, x: number): Promise<void> {
    const chip = text(field).querySelector<HTMLElement>("[data-chip]")!;
    const box = chip.getBoundingClientRect();
    const y = box.top + box.height / 2;
    const at = (type: string) =>
      text(field).dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y, pointerType: "touch" }));

    text(field).focus();
    at("pointerdown");
    await new Promise((resolve) => setTimeout(resolve, 700));
    at("pointermove");
    document.getSelection()!.setBaseAndExtent(chip.querySelector(".chevron")!, 0, chip.querySelector(".chevron")!, 0);
    await new Promise((resolve) => setTimeout(resolve, 80));
    at("pointerup");
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  it("ett långtryck som lämnar markören inne i brickan, fingret på brickans högra halva: markören efter brickan", async () => {
    const field = mount("Du svarade {{fornamn}}", { features: ["variable"] });

    field.style.cssText = "display: block; width: 320px; font-family: var(--fw-font);";
    const chip = text(field).querySelector<HTMLElement>("[data-chip]")!.getBoundingClientRect();

    await longPress(field, chip.right - 2);

    expect(text(field).querySelector("[data-chip][data-selected]"), "brickan blev vald").toBeNull();
    await userEvent.keyboard("X");
    expect(field.value).toBe("Du svarade {{fornamn}}X");
  });

  it("ett långtryck som lämnar markören inne i brickan, fingret vänster om mitten: markören före brickan", async () => {
    const field = mount("Du svarade {{fornamn}}", { features: ["variable"] });

    field.style.cssText = "display: block; width: 320px; font-family: var(--fw-font);";
    const chip = text(field).querySelector<HTMLElement>("[data-chip]")!.getBoundingClientRect();

    await longPress(field, chip.left + 2);

    expect(text(field).querySelector("[data-chip][data-selected]"), "brickan blev vald").toBeNull();
    await userEvent.keyboard("X");
    expect(field.value).toBe("Du svarade X{{fornamn}}");
  });

  it("ett tryck på en sista bricka väljer den, som förut", async () => {
    const field = mount("Du svarade {{fornamn}}", { features: ["variable"] });

    field.style.cssText = "display: block; width: 320px; font-family: var(--fw-font);";
    await userEvent.click(text(field).querySelector<HTMLElement>("[data-chip]")!);
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(text(field).querySelector("[data-chip][data-selected]")).not.toBeNull();
    expect(field.shadowRoot!.querySelector<HTMLElement>("[data-chip-menu]")!.hidden).toBe(false);
  });

  /*
   * Fynd (f), Johans andra mätning 26/9: *"det skrivs på raden ovanför tills
   * den är heltäckt … för texten är det som brickan inte är där."* Markören
   * stod rätt, men det skrivna lossnade från brickan och fyllde raden ovanför.
   * Ett ord direkt före en bricka hör till brickan och följer med den.
   */
  it("det som skrivs direkt före en bruten bricka står på brickans rad, framför den", async () => {
    const field = mount("Välkommen till oss! {{fornamn}}", { features: ["variable"] });

    field.style.cssText = "display: block; width: 190px; font-family: var(--fw-font);";
    await focusEnd(field);
    await userEvent.keyboard("{ArrowLeft}Xy");
    expect(field.value).toBe("Välkommen till oss! Xy{{fornamn}}");

    const chip = text(field).querySelector<HTMLElement>("[data-chip]")!;
    const node = [...text(field).querySelector("p")!.childNodes].find((child) => child.nodeType === Node.TEXT_NODE)!;
    const typed = document.createRange();

    typed.setStart(node, node.nodeValue!.indexOf("Xy"));
    typed.setEnd(node, node.nodeValue!.indexOf("Xy") + 2);
    const typedBox = typed.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();

    expect(Math.abs(typedBox.top + typedBox.height / 2 - (chipBox.top + chipBox.height / 2)), "Xy på brickans rad").toBeLessThan(chipBox.height / 2);
    expect(typedBox.right, "Xy framför brickan").toBeLessThanOrEqual(chipBox.left + 1);
  });

  /*
   * Fynd (f) i WebKit: brickan står i ett omslag med en ordfogare framför, så
   * markören har en plats på brickans rad. Omslaget är inline och `nowrap`
   * (Johan 26/9): ordet direkt före brickan följer med den till nästa rad —
   * före 26/9 krävde det här provet motsatsen, och det var det Johan mätte
   * som fel på iPaden (*"för texten är det som brickan inte är där"*, Johan
   * 26/9). Johans mätning är beslutet: vänd inte tillbaka det här provet
   * utan ett nytt ord från honom. Omslaget får inte lämna tecknet i värdet och inte bli
   * en egen hållplats för piltangenterna — i alla tre motorerna.
   */
  it("ett ord direkt före en bricka följer med brickan till nästa rad", () => {
    const field = mount("Välkommen till oss!{{fornamn}}", { features: ["variable"] });

    field.style.cssText = "display: block; width: 190px; font-family: var(--fw-font);";
    const node = text(field).querySelector("p")!.firstChild!;
    const first = document.createRange();
    const word = document.createRange();

    first.setStart(node, 0);
    first.setEnd(node, 9);
    word.setStart(node, 15);
    word.setEnd(node, 19);
    const chip = text(field).querySelector<HTMLElement>("[data-chip]")!.getBoundingClientRect();
    const wordBox = word.getBoundingClientRect();

    expect(chip.top, "brickan på nästa rad").toBeGreaterThan(first.getBoundingClientRect().bottom);
    expect(Math.abs(wordBox.top + wordBox.height / 2 - (chip.top + chip.height / 2)), "oss! på brickans rad").toBeLessThan(chip.height / 2);
  });

  it("text skriven före och efter en bricka: värdet bär inget osynligt tecken", async () => {
    const field = mount("Hej {{fornamn}}!", { features: ["variable"] });

    await focusEnd(field);
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}a{ArrowRight}b");

    expect(field.value).toBe("Hej a{{fornamn}}b!");
    expectOnlyModelDom(field);
  });

  it("läsningen tar bort ordfogaren i brickans omslag, aldrig en någon annanstans", () => {
    const p = document.createElement("p");

    p.innerHTML = 'a\u2060b<span data-chip-glue>\u2060<span data-chip data-variable="x" contenteditable="false">X</span></span>';
    const joiner = p.querySelector("[data-chip-glue]")!.firstChild!;
    const reading = readDom(p, [{ node: joiner, offset: 1 }, { node: joiner, offset: 0 }]);

    expect(reading.doc.blocks[0]!.content.map((item) => (item.type === "text" ? item.text : item.type))).toEqual(["a\u2060b", "chip"]);
    expect(reading.positions).toEqual([{ block: 0, offset: 3 }, { block: 0, offset: 3 }]);
  });

  it.each([
    ["vänsterpil", "{ArrowLeft}{ArrowLeft}{ArrowLeft}X", "HejX {{fornamn}}!"],
    ["högerpil", "{Home}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}X", "Hej {{fornamn}}X!"],
  ])("%s går förbi brickan ett steg per tryck, ingen hållplats emellan", async (_name, keys, expected) => {
    const field = mount("Hej {{fornamn}}!", { features: ["variable"] });

    await focusEnd(field);
    await userEvent.keyboard(keys);
    expect(field.value).toBe(expected);
  });

  it.each([
    ["Skift+vänster efter brickan", "{ArrowLeft}{Shift>}{ArrowLeft}{/Shift}{Enter}"],
    ["Skift+höger före brickan", "{ArrowLeft}{ArrowLeft}{Shift>}{ArrowRight}{/Shift}{Enter}"],
  ])("%s markerar brickan och Enter öppnar menyn (136 kriterium 10)", async (_name, keys) => {
    const field = mount("Hej {{fornamn}}!", { features: ["variable"] });

    await focusEnd(field);
    await userEvent.keyboard(keys);
    expect(field.shadowRoot!.querySelector<HTMLElement>("[data-chip-menu]")!.hidden).toBe(false);
  });

  it("en saknad referens bevaras och säger det i ord och med streckad ram, aldrig bara färg", () => {
    const field = mount("Hej {{borttagen}}!");
    const chip = text(field).querySelector<HTMLElement>("[data-chip]")!;

    expect(field.value).toBe("Hej {{borttagen}}!");
    expect(chip.textContent).toContain("borttagen (saknas)");
    expect(getComputedStyle(chip).borderTopStyle).toBe("dashed");
  });

  it("fetstil över text, bricka, text: ett spann **a{{fornamn}}b** (handling 17)", async () => {
    const field = mount("a{{fornamn}}b");

    await focusEnd(field);
    await userEvent.keyboard("{Shift>}{Home}{/Shift}{Control>}b{/Control}");

    expect(field.value).toBe("**a{{fornamn}}b**");
    expect(text(field).querySelector("[data-chip]")!.getAttribute("data-variable")).toBe("fornamn");
  });

  it("en lång rad i ett enradsfält gör aldrig fältet bredare än sin plats", () => {
    // Measured 25/9: a row cell in the claim example pushed the panel to 700 px.
    // A wrapper between the grid and the field, as the panel has: the field's
    // own `min-width: 0` does not reach through it.
    const holder = document.createElement("div");
    const wrapper = document.createElement("div");

    holder.style.cssText = "display: grid; width: 300px;";
    holder.append(wrapper);
    document.body.append(holder);
    const field = mount("Ett långt stycke text ".repeat(20), { multiline: false, features: ["variable", "bold"] });

    wrapper.append(field);

    expect(field.getBoundingClientRect().width).toBeLessThanOrEqual(300);
  });

  /*
   * Fynd (a), Johans iPad 25/9: "Du kan skaffa bankkonto hos" och resten
   * borta bakom *Infoga svar*. Ett enradsfält rullar i sidled så att det man
   * skriver syns — markören står inom textens synliga låda, aldrig under knappen.
   */
  it("en lång rubrik rullar så att markören syns, aldrig under Infoga svar", async () => {
    const holder = document.createElement("div");

    holder.style.cssText = "width: 330px;";
    document.body.append(holder);
    const field = mount("Du kan skaffa bankkonto hos någon av de banker som finns i kommunen", { multiline: false, features: ["variable"] });

    holder.append(field);
    await focusEnd(field);
    await userEvent.keyboard("X");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const box = text(field).getBoundingClientRect();
    const toggle = field.shadowRoot!.querySelector("[data-answer-toggle]")!.getBoundingClientRect();
    const caretAt = caretRange(field).getBoundingClientRect().right;

    expect(field.value.endsWith("kommunenX")).toBe(true);
    expect(box.right).toBeLessThanOrEqual(toggle.left + 0.5);
    expect(caretAt, "markören inom den synliga texten").toBeLessThanOrEqual(box.right);
    expect(caretAt).toBeGreaterThan(box.left);
  });

  it("rubrikfältet: Infoga svar sitter i fältets högra kant, ingen verktygsrad", () => {
    const field = mount("Tack", { multiline: false, features: ["variable"] });

    expect(field.shadowRoot!.querySelector('[role="toolbar"]')).toBeNull();
    const frame = field.shadowRoot!.querySelector("[data-frame]")!.getBoundingClientRect();
    const toggle = field.shadowRoot!.querySelector("[data-answer-toggle]")!.getBoundingClientRect();

    expect(frame.right - toggle.right).toBeLessThan(12);
    expect(Math.abs(frame.top + frame.height / 2 - (toggle.top + toggle.height / 2))).toBeLessThan(4);
  });
});

describe("plusset i ett enradsfält", () => {
  it("har samma luft runt sig som i formelfältets hörn: lika på alla sidor (Johan 29/9)", () => {
    const field = mount("Är du under 29 år?", { multiline: false, features: ["variable"] });
    const root = field.shadowRoot!;
    const frame = root.querySelector<HTMLElement>("[data-frame]")!.getBoundingClientRect();
    const button = root.querySelector<HTMLElement>("[data-answer-toggle]")!.getBoundingClientRect();
    const top = button.top - frame.top;
    const bottom = frame.bottom - button.bottom;
    const right = frame.right - button.right;

    // The frame's 1 px border is part of every distance; what must agree is the air inside it.
    expect(Math.abs(top - bottom), "lika över och under").toBeLessThanOrEqual(1);
    expect(Math.abs(top - right), "lika som till höger").toBeLessThanOrEqual(1);
    expect(top, "minst 4 px luft (formelfältets hörn)").toBeGreaterThanOrEqual(5);
  });
});

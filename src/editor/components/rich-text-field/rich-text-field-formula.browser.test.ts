import { userEvent } from "@vitest/browser/context";
import { afterEach, describe, expect, it } from "vitest";
import "./rich-text-field";
import type { RichTextField } from "./rich-text-field";

/**
 * Story 139 — the formula field: a known variable is a chip, the rest is
 * formula text, and the string the field gives back is the formula the
 * parser reads, letter for letter.
 */

const VARIABLES = [
  { value: "grund", label: "Grundbelopp" },
  { value: "barntillagg", label: "Barntillägg" },
  { value: "inkomst", label: "Inkomst" },
  { value: "a", label: "" },
  { value: "idag", label: "I dag", computed: true as const },
];

function mount(value: string, { variablesFirst = true } = {}): RichTextField {
  const field = document.createElement("rich-text-field");

  field.setAttribute("formula", "");
  field.setAttribute("label", "Formel");
  field.features = ["variable"];
  if (variablesFirst) field.variables = VARIABLES;
  field.value = value;
  if (!variablesFirst) field.variables = VARIABLES;
  document.body.append(field);
  return field;
}

const text = (field: RichTextField): HTMLElement => field.shadowRoot!.querySelector<HTMLElement>("[data-text]")!;
const chips = (field: RichTextField): string[] => [...text(field).querySelectorAll<HTMLElement>("[data-chip]")].map((chip) => chip.dataset.variable ?? "");
const plus = (field: RichTextField): HTMLButtonElement => field.shadowRoot!.querySelector<HTMLButtonElement>("[data-answer-toggle]")!;
const menu = (field: RichTextField): HTMLElement => field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;

async function focusEnd(field: RichTextField): Promise<void> {
  text(field).focus();
  await userEvent.keyboard("{Control>}{End}{/Control}");
}

function transfer(plain: string): DataTransfer {
  const data = new DataTransfer();

  data.setData("text/plain", plain);
  return data;
}

function clipboardEvent(type: "paste" | "copy", data: DataTransfer): ClipboardEvent {
  const event = new ClipboardEvent(type, { bubbles: true, cancelable: true });

  Object.defineProperty(event, "clipboardData", { value: data });
  return event;
}

afterEach(() => document.body.replaceChildren());

describe("formelfältet (139)", () => {
  it("visar kända namn som brickor med etikett, resten som formeltext, och ger tillbaka strängen oförändrad", () => {
    const field = mount("round(min(grund + barntillagg; 9000))");

    expect(chips(field)).toEqual(["grund", "barntillagg"]);
    // The glue around a chip (`\u2060`, see `renderInline`) is not text.
    expect(text(field).textContent?.replace(/\u2060/g, "")).toBe("round(min(Grundbelopp + Barntillägg; 9000))");
    expect(field.value).toBe("round(min(grund + barntillagg; 9000))");
    expect(text(field).querySelector(".chip--missing")).toBeNull();
    expect(getComputedStyle(text(field)).fontFamily).toMatch(/mono/i);
  });

  it("brickorna bildas också när namnen kommer efter värdet, som panelen ger dem", () => {
    const field = mount("grund * 2", { variablesFirst: false });

    expect(chips(field)).toEqual(["grund"]);
    expect(field.value).toBe("grund * 2");
  });

  it("ett okänt namn står kvar som text, utan saknas-bricka", () => {
    const field = mount("okand + 1");

    expect(chips(field)).toEqual([]);
    expect(text(field).querySelector(".chip--missing")).toBeNull();
    expect(field.value).toBe("okand + 1");
  });

  it("ett namn blir bricka först när ett tecken som inte kan ingå i namnet följer — aldrig under skrivningen", async () => {
    const field = mount("inkomst * 0.1");

    await focusEnd(field);
    await userEvent.keyboard(" + barn");
    expect(chips(field), "barn är känt men skrivs fortfarande").toEqual(["inkomst"]);
    await userEvent.keyboard("tillagg");
    expect(chips(field), "namnet är färdigt men markören står i det").toEqual(["inkomst"]);
    expect(field.value).toBe("inkomst * 0.1 + barntillagg");
    await userEvent.keyboard(" ");
    expect(chips(field), "mellanslaget avslutar namnet").toEqual(["inkomst", "barntillagg"]);
    expect(field.value).toBe("inkomst * 0.1 + barntillagg ");
  });

  it("plusknappen heter Infoga variabel, menyn visar etikett och namn, och valet sätter in brickan vid markören", async () => {
    const field = mount("a + ");

    expect(plus(field).getAttribute("aria-label")).toBe("Infoga variabel");
    await focusEnd(field);
    plus(field).click();
    const row = [...menu(field).querySelectorAll<HTMLButtonElement>("[data-insert]")].find((one) => one.dataset.insert === "grund")!;

    expect(row.textContent).toContain("Grundbelopp");
    expect(row.querySelector("code")?.textContent).toBe("grund");
    row.click();
    expect(menu(field).hidden).toBe(true);
    expect(field.value).toBe("a + grund");
    expect(chips(field)).toEqual(["a", "grund"]);
    await userEvent.keyboard(" * 2");
    expect(field.value, "markören stod efter brickan").toBe("a + grund * 2");
  });

  it("sökfältet överst hittar på etikett och namn, och Enter tar första träffen", async () => {
    const field = mount("");

    await focusEnd(field);
    plus(field).focus();
    await userEvent.keyboard("{Enter}");
    const search = menu(field).querySelector<HTMLInputElement>("[data-answer-search]")!;

    expect(field.shadowRoot!.activeElement, "fokus i sökfältet från tangentbordet").toBe(search);
    await userEvent.keyboard("tillägg");
    const visible = [...menu(field).querySelectorAll<HTMLButtonElement>("[data-insert]")].filter((one) => !one.hidden).map((one) => one.dataset.insert);

    expect(visible, "på etiketten").toEqual(["barntillagg"]);
    await userEvent.clear(search);
    await userEvent.keyboard("ink");
    expect([...menu(field).querySelectorAll<HTMLButtonElement>("[data-insert]")].filter((one) => !one.hidden).map((one) => one.dataset.insert), "på namnet").toEqual(["inkomst"]);
    // "inkomst" hittas via etiketten också ("Inkomst"), så det bevisar inget
    // om namnet. "barntillagg" (utan å/ä/ö) finns bara i namnet — etiketten
    // är "Barntillägg" (med ä) och matchar inte samma sträng.
    await userEvent.clear(search);
    await userEvent.keyboard("barntillagg");
    expect(
      [...menu(field).querySelectorAll<HTMLButtonElement>("[data-insert]")].filter((one) => !one.hidden).map((one) => one.dataset.insert),
      "namnet utan diakritik hittas trots att etiketten har ä",
    ).toEqual(["barntillagg"]);
    await userEvent.clear(search);
    await userEvent.keyboard("ink");
    await userEvent.keyboard("{Enter}");
    expect(field.value).toBe("inkomst");
    expect(menu(field).hidden).toBe(true);
  });

  it("sökningen döljer raderna i den RENDERADE trädet, inte bara i hidden-egenskapen (Siv, K3/K4)", async () => {
    const field = mount("");

    await focusEnd(field);
    plus(field).focus();
    await userEvent.keyboard("{Enter}");
    const search = menu(field).querySelector<HTMLInputElement>("[data-answer-search]")!;

    expect(field.shadowRoot!.activeElement).toBe(search);
    await userEvent.keyboard("barntillagg");
    const rows = [...menu(field).querySelectorAll<HTMLButtonElement>("[data-insert]")];
    const filteredOut = rows.filter((row) => row.hidden);

    expect(filteredOut.length, "minst en rad ska vara filtrerad bort av sökningen").toBeGreaterThan(0);
    for (const row of filteredOut) {
      expect(getComputedStyle(row).display, `${row.dataset.insert} har hidden=true men syns ändå (${row.dataset.insert})`).toBe("none");
    }
  });

  it("sökfältet håller samma golv som panelens fält: 44 px (K6) och 16 px text (iOS zoomar annars in fältet)", async () => {
    const field = mount("");

    await focusEnd(field);
    plus(field).focus();
    await userEvent.keyboard("{Enter}");
    const search = menu(field).querySelector<HTMLInputElement>("[data-answer-search]")!;
    const style = getComputedStyle(search);

    expect(search.getBoundingClientRect().height, "sökfältets höjd, samma golv som panelens fält (--fw-control-height, 44px)").toBeGreaterThanOrEqual(44);
    expect(parseFloat(style.fontSize), "16px, annars zoomar iOS in fältet vid fokus och zoomar inte ut igen").toBeGreaterThanOrEqual(16);
  });

  it("Backspace tar hela brickan, och ångra sätter tillbaka den", async () => {
    const field = mount("1 + grund");

    await focusEnd(field);
    await userEvent.keyboard("{Backspace}");
    expect(field.value).toBe("1 + ");
    expect(chips(field)).toEqual([]);
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(field.value).toBe("1 + grund");
    expect(chips(field)).toEqual(["grund"]);
  });

  it("kopiera ger formeltexten med namnen; inklistrad formeltext läses som formel", () => {
    const field = mount("round(min(grund + barntillagg; 9000))");
    const range = document.createRange();

    range.selectNodeContents(text(field));
    const selection = document.getSelection()!;

    selection.removeAllRanges();
    selection.addRange(range);
    text(field).dispatchEvent(new Event("selectionchange"));
    document.dispatchEvent(new Event("selectionchange"));
    const copied = new DataTransfer();

    text(field).dispatchEvent(clipboardEvent("copy", copied));
    expect(copied.getData("text/plain")).toBe("round(min(grund + barntillagg; 9000))");

    const target = mount("");

    text(target).focus();
    text(target).dispatchEvent(clipboardEvent("paste", transfer("min(grund; 2) * inkomst")));
    expect(target.value).toBe("min(grund; 2) * inkomst");
    expect(chips(target)).toEqual(["grund", "inkomst"]);
  });

  it("Enter gör ingenting: en formel är en rad", async () => {
    const field = mount("a + 1");

    await focusEnd(field);
    await userEvent.keyboard("{Enter}");
    expect(field.value).toBe("a + 1");
    expect(text(field).querySelectorAll("p").length).toBe(1);
    expect(text(field).querySelector("br:not([data-filler])")).toBeNull();
  });

  it("en lång etikett stannar i fältet: brickan kortas med ellips, aldrig ut över kanten eller under plusset (Fia 29/9)", async () => {
    const field = document.createElement("rich-text-field");

    field.setAttribute("formula", "");
    field.features = ["variable"];
    field.variables = [{ value: "barntillagg", label: "Tillägg för barn som bor växelvis hos båda vårdnadshavarna" }];
    field.value = "round(min(barntillagg; 9000))";
    field.style.cssText = "display: block; width: 305px;";
    document.body.append(field);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const box = text(field).getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(text(field)).paddingRight);
    const chip = text(field).querySelector<HTMLElement>("[data-chip]")!.getBoundingClientRect();

    // Measured 29/9 in a 305 px field: the chip stood 459 px wide.
    expect(chip.right).toBeLessThanOrEqual(box.right - padding + 1);
    expect(getComputedStyle(text(field).querySelector(".chip__label")!).textOverflow).toBe("ellipsis");
    expect(field.value).toBe("round(min(barntillagg; 9000))");
  });

  it("bild 05: plusset i fältets övre högra hörn; menyn med förstoringsglas, Uträkningar före Svar och namnet under etiketten", async () => {
    const field = document.createElement("rich-text-field");

    field.setAttribute("formula", "");
    field.features = ["variable"];
    field.variables = [
      { value: "inkomst", label: "Inkomst" },
      { value: "grund", label: "Grundbelopp", calculated: true },
      { value: "idag", label: "I dag", computed: true },
    ];
    field.value = "grund * 2";
    field.style.cssText = "display: block; width: 305px;";
    document.body.append(field);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const frame = field.shadowRoot!.querySelector(".frame")!.getBoundingClientRect();

    // Measured 29/9: 37 px down, the middle of a three-line field.
    expect(plus(field).getBoundingClientRect().top - frame.top).toBeLessThanOrEqual(8);
    plus(field).focus();
    await userEvent.keyboard("{Enter}");
    const groups = [...menu(field).querySelectorAll(".menu__group-label")].map((one) => one.textContent!.trim());

    expect(groups).toEqual(["Uträkningar", "Svar", "Inbyggt"]);
    // Bild 05, the lead's choice over 03 (29/9): the search box is the menu's
    // first line, the last group its last — no heading, no footnote.
    expect(menu(field).firstElementChild!.classList.contains("menu__search")).toBe(true);
    expect(menu(field).lastElementChild!.classList.contains("menu__group")).toBe(true);
    expect(menu(field).querySelector(".menu__search svg"), "förstoringsglaset").not.toBeNull();
    const row = menu(field).querySelector<HTMLElement>('[data-insert="grund"]')!;

    expect(row.querySelector("svg"), "ingen radikon").toBeNull();
    expect(row.querySelector(".menu__item-name")!.getBoundingClientRect().top).toBeGreaterThanOrEqual(row.querySelector(".menu__item-label")!.getBoundingClientRect().bottom - 1);
  });

  it("brickans meny visar det tekniska namnet", async () => {
    const field = mount("grund + 1");
    const chip = text(field).querySelector<HTMLElement>("[data-chip]")!;

    expect(chip.getAttribute("aria-label")).toBe("Grundbelopp, variabel");
    chip.click();
    const chipMenu = field.shadowRoot!.querySelector<HTMLElement>("[data-chip-menu]")!;

    expect(chipMenu.hidden).toBe(false);
    expect(chipMenu.querySelector("[data-chip-name]")?.textContent).toBe("grund");
  });

  it("ett känt namn SIST i formeln blir bricka när namnen kommer efter värdet (Fia, fel A)", () => {
    const field = mount("x - grund", { variablesFirst: false });

    // The caret marker belongs to a focused field only: unfocused, the
    // stored end of the text is not "being typed".
    expect(chips(field)).toEqual(["grund"]);
    expect(field.value).toBe("x - grund");
  });

  it("ett namn som skrivs sist blir bricka när fältet lämnas (139 kriterium 5)", async () => {
    const field = mount("1 + ");

    await focusEnd(field);
    await userEvent.keyboard("grund");
    expect(chips(field), "under skrivningen").toEqual([]);
    text(field).blur();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(chips(field), "efter blur").toEqual(["grund"]);
    expect(field.value).toBe("1 + grund");
  });

  it("plusknappen med mus: sökfältet får fokus, så det man skriver söker i stället för att hamna i formeln (Fia, fel B)", async () => {
    const field = mount("a + ");

    await focusEnd(field);
    await userEvent.click(plus(field));
    const search = menu(field).querySelector<HTMLInputElement>("[data-answer-search]")!;

    expect(menu(field).hidden).toBe(false);
    expect(field.shadowRoot!.activeElement).toBe(search);
    await userEvent.keyboard("grund");
    expect(field.value, "inget hamnade i formeln").toBe("a + ");
    expect(search.value).toBe("grund");
  });
});

/**
 * Astras granskning av vända 1 (bilaga 2, 29/9), punkt 3: no dark bands in
 * the formula's menu. The group headings lie on the menu's own surface in
 * `--fw-text-secondary`, the text menu's divider between the groups. The
 * chip menu's name row shared the band (same class) and loses it too.
 * Measured before: each heading on `--fw-bg`, the divider `display: none`.
 */
/*
 * Johan 30/9, foto ur filmen Räkna: "Känns som plusknappen är gigantisk i
 * formel." The formula's plus had borrowed the text toolbar's 48 px (Johan
 * 28/9, "48 px, gap 4") and stood alone beside 14 px mono. Astras skiss 139
 * draws a smaller button in the corner: 36 px to see, and K6's 44 to hit.
 */
describe("formelfältets plus: 36 px att se, 44 att träffa (Johan 30/9)", () => {
  it("knappen är 36 × 36 synligt och träffytan 44 × 44 runt samma mitt", async () => {
    const field = mount("grund * 2");

    field.style.cssText = "display: block; width: 305px;";
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const button = plus(field).getBoundingClientRect();

    expect(button.width, "synlig bredd").toBeCloseTo(36, 0);
    expect(button.height, "synlig höjd").toBeCloseTo(36, 0);

    // The hit area is measured where a finger lands, not read from the CSS:
    // what the shadow root finds at each edge of a centred 44 px square.
    const root = field.shadowRoot!;
    const x = button.left + button.width / 2;
    const y = button.top + button.height / 2;
    const hits = (px: number, py: number): boolean => {
      const found = root.elementFromPoint(px, py);

      return found !== null && plus(field).contains(found);
    };

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      expect(hits(x + dx * 21.5, y + dy * 21.5), `träff 21,5 px från mitten (${dx}, ${dy})`).toBe(true);
      expect(hits(x + dx * 23, y + dy * 23), `ingen träff 23 px från mitten (${dx}, ${dy})`).toBe(false);
    }
  });

  it("plusset står mitt för formelns första rad, med lika luft upptill och till höger", async () => {
    const field = mount("grund * 2");

    field.style.cssText = "display: block; width: 305px;";
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const frame = field.shadowRoot!.querySelector(".frame")!.getBoundingClientRect();
    const button = plus(field).getBoundingClientRect();
    const style = getComputedStyle(text(field));
    const firstLineMiddle = text(field).getBoundingClientRect().top + parseFloat(style.paddingTop) + parseFloat(style.lineHeight) / 2;

    expect(button.top + button.height / 2, "mitt för första raden").toBeCloseTo(firstLineMiddle, 0);
    expect(button.top - frame.top, "lika luft upptill som till höger").toBeCloseTo(frame.right - button.right, 0);
  });

  /*
   * Astra 30/9 (B9, bilaga 2): at least 44 × 44 to hit, "utan överlapp med
   * formeltexten". Measured on what is drawn — every character and chip,
   * on every line — against the hit square's left edge, and where a finger
   * lands on the rightmost character: that tap must go to the formula.
   * Measured 30/9 in the panel: text ends at 769, the hit area starts at 777.
   */
  it.each([
    ["ett långt tal utan mellanslag", "12345678901234567890123456789012345678901234567890"],
    ["brickor och operatorer", "max(0 ; round(grund + barntillagg - inkomst)) * 12 / 100"],
    ["mellanslag som bryter raden", "1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13"],
  ])("träffytan på 44 px täcker ingen del av formeln: %s", async (_case, formula) => {
    const field = mount(formula);

    field.style.cssText = "display: block; width: 305px;";
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const button = plus(field).getBoundingClientRect();
    const hitLeft = button.left + button.width / 2 - 22;
    const hitBottom = button.top + button.height / 2 + 22;
    const drawn: DOMRect[] = [...text(field).querySelectorAll<HTMLElement>("[data-chip]")].map((chip) => chip.getBoundingClientRect());
    const walker = document.createTreeWalker(text(field), NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.closest("[data-chip]")) continue;
      for (let i = 0; i < node.textContent!.length; i++) {
        const range = document.createRange();

        range.setStart(node, i);
        range.setEnd(node, i + 1);
        drawn.push(...[...range.getClientRects()].filter((rect) => rect.width > 0));
      }
    }

    // Only what shares the hit square's rows can collide with it sideways.
    const beside = drawn.filter((rect) => rect.top < hitBottom);
    const rightmost = beside.reduce((a, b) => (b.right > a.right ? b : a));
    const root = field.shadowRoot!;
    const found = root.elementFromPoint(rightmost.right - 1, rightmost.top + rightmost.height / 2);

    expect(beside.length, "formeln når upp bredvid plusset — annars mäter testet ingenting").toBeGreaterThan(10);
    expect(rightmost.right, `formeln slutar ${Math.round(rightmost.right)}, träffytan börjar ${Math.round(hitLeft)}`).toBeLessThanOrEqual(hitLeft);
    expect(found !== null && plus(field).contains(found), "ett tryck på sista tecknet går till plusset").toBe(false);
  });

  it("textredigerarens plus i verktygsraden behåller sina 48 px", () => {
    const field = document.createElement("rich-text-field");

    field.setAttribute("multiline", "");
    field.features = ["bold", "variable"];
    field.variables = VARIABLES;
    field.value = "Hej";
    document.body.append(field);
    const button = plus(field).getBoundingClientRect();

    expect(button.width).toBeCloseTo(48, 0);
    expect(button.height).toBeCloseTo(48, 0);
  });
});

describe("formelmenyns grupprubriker utan band (bilaga 2)", () => {
  const TRANSPARENT = "rgba(0, 0, 0, 0)";

  it("rubrikerna ligger direkt på menyns yta, med textmenyns färg och vikt, och avdelaren står mellan grupperna", async () => {
    const field = mount("grund + 1");

    plus(field).focus();
    await userEvent.keyboard("{Enter}");
    const labels = [...menu(field).querySelectorAll<HTMLElement>(".menu__group-label")];
    const secondary = getComputedStyle(field).getPropertyValue("--fw-text-secondary").trim();
    const probe = document.createElement("span");

    probe.style.color = secondary;
    document.body.append(probe);
    const secondaryColor = getComputedStyle(probe).color;

    expect(labels.length).toBeGreaterThan(1);
    for (const label of labels) {
      const style = getComputedStyle(label);

      expect(style.backgroundColor, label.textContent!).toBe(TRANSPARENT);
      expect(style.color, label.textContent!).toBe(secondaryColor);
      expect(style.fontWeight, label.textContent!).toBe(style.getPropertyValue("--fw-weight-strong").trim());
    }
    for (const group of [...menu(field).querySelectorAll<HTMLElement>(".menu__group")].slice(1)) {
      const divider = getComputedStyle(group, "::before");

      expect(divider.display).toBe("block");
      expect(divider.height).toBe("1px");
      // The rows' own line colour: the text menu's subtle one measured
      // 1.03:1 on the dark menu's raised surface (29/9), invisible.
      expect(divider.backgroundColor, "avdelaren i radernas linjefärg").toBe(getComputedStyle(menu(field).querySelector(".menu__group button + button")!).borderTopColor);
    }
  });

  it("brickmenyns namnrad har inget band heller", () => {
    const field = mount("grund + 1");

    text(field).querySelector<HTMLElement>("[data-chip]")!.click();
    const name = field.shadowRoot!.querySelector<HTMLElement>("[data-chip-menu] .menu__name")!;

    expect(getComputedStyle(name).backgroundColor).toBe(TRANSPARENT);
  });

  it("brickmenyns bock står på den valda raden, inte på en egen rad ovanför", () => {
    const field = mount("grund + 1");

    text(field).querySelector<HTMLElement>("[data-chip]")!.click();
    const chipMenu = field.shadowRoot!.querySelector<HTMLElement>("[data-chip-menu]")!;
    const checked = chipMenu.querySelector<HTMLElement>('[aria-checked="true"]')!;
    const other = chipMenu.querySelector<HTMLElement>('[aria-checked="false"][data-swap="barntillagg"]')!;

    // Measured 29/9: 67 px against 49 — the ✓ took a line of its own.
    // clientHeight: the row line above a row that follows another is not the row.
    expect(checked.clientHeight).toBe(other.clientHeight);
    expect(getComputedStyle(checked, "::before").content).toContain("\u2713");
  });
});

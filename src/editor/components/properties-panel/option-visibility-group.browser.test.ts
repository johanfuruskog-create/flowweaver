import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Konceptbild 3 (UPPDRAG-2026-09-28-SVARSALTERNATIV, 29/9): villkors-
 * redigeringen i ett öppet alternativs "Villkorsstyrd synlighet" samlad i en
 * egen, diskret yta direkt under reglaget — bildens facit för kortet
 * (Johan 29/9: "det ska se ut som på bilden").
 *
 * `option-visibility.browser.test.ts` (berättelse 134) täcker redan att
 * brytaren och de tre kontrollerna finns (och, sedan vända 6, att skylten är
 * struken); den här filen täcker bara vad konceptbild 3 lade till ovanpå det:
 * gruppytan, rubriken, den egna etiketten och att fältets EGNA "visas om"
 * (samma delade funktion, annat scope) inte fick någon av delarna med sig.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mounted(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = {
    version: 8,
    startNodeId: "sida",
    settings: { sourceLocale: "sv", locales: ["sv"] },
    nodes: [
      // Fältets EGNA "visas om" (`renderVisibility`) ritas bara när noden
      // har en `parentPageId` — sidan finns här bara för det sista testet,
      // som visar att gruppytan/rubriken/den nya etiketten INTE följde med
      // dit av misstag.
      { id: "sida", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
      {
        id: "org",
        type: "question",
        position: { x: 0, y: 0 },
        parentPageId: "sida",
        order: 1,
        layout: { columnSpan: 12 },
        data: {
          title: { sv: "Vill du ange organisation?" },
          variableName: "organisation",
          options: [
            { id: "org-ja", label: { sv: "Ja" }, value: "ja" },
            { id: "org-nej", label: { sv: "Nej" }, value: "nej" },
          ],
        },
      },
      {
        id: "typ",
        type: "multi-choice",
        position: { x: 400, y: 0 },
        data: {
          title: { sv: "Typ av kontakt" },
          variableName: "typ",
          options: [
            { id: "opt-privat", label: { sv: "Privatperson" }, value: "privatperson" },
            {
              id: "opt-foretag",
              label: { sv: "Företag" },
              value: "foretag",
              visibility: {
                match: "all",
                conditions: [{ id: "c1", variableName: "organisation", operator: "equals", value: "ja" }],
              },
            },
          ],
        },
      },
    ],
    connections: [
      { id: "k1", from: { nodeId: "org", portId: "org-ja" }, to: { nodeId: "typ", portId: "input" } },
      { id: "k2", from: { nodeId: "org", portId: "org-nej" }, to: { nodeId: "typ", portId: "input" } },
    ],
  } as never;
  await settle();

  editor.shadowRoot!
    .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
    .selectNodeById("typ");
  await settle();

  return editor;
}

const panel = (editor: GuideEditor): ShadowRoot => editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;

const card = (editor: GuideEditor, optionId: string): HTMLElement =>
  panel(editor).querySelector<HTMLElement>(`[data-option-id="${optionId}"].properties-panel__option--answer`)!;

const openCard = (editor: GuideEditor, optionId: string): void => {
  card(editor, optionId).querySelector<HTMLElement>('[data-action="toggle-option"]')!.click();
};

describe("konceptbild 3 — villkorsgruppen i ett öppet alternativ", () => {
  test("av: ingen gruppyta", async () => {
    const editor = await mounted();
    openCard(editor, "opt-privat");
    await settle(50);

    const block = card(editor, "opt-privat");
    expect(block.querySelector('[data-option-visibility-property="enabled"]')).toBeTruthy();
    expect(block.querySelector(".properties-panel__option-visibility-conditions")).toBeNull();
  });

  test("på: gruppytan finns, med rubrik och egen etikett — ingen skylt, ingen sammanfattning", async () => {
    const editor = await mounted();
    openCard(editor, "opt-foretag");
    await settle(50);

    const block = card(editor, "opt-foretag");
    const group = block.querySelector<HTMLElement>(".properties-panel__option-visibility-conditions");
    expect(group, "gruppytan finns när reglaget är på").toBeTruthy();

    const heading = group!.querySelector(".properties-panel__option-visibility-heading");
    expect(heading?.textContent?.trim()).toBe("Visa alternativet när");

    // "Svar eller värde", inte "Variabel" — bara i det här scopet (se testet
    // längre ner som visar att fältets "visas om" fortsätter heta "Variabel").
    const variableLabel = group!.querySelector('[data-option-visibility-property="variableName"]')
      ?.closest("label")
      ?.querySelector("span");
    expect(variableLabel?.textContent?.trim()).toBe("Svar eller värde");

    /*
     * Vända 6 (29/9): varken skylten eller en sammanfattningsplats finns
     * längre — Ted mätte att ingen av dem kan göras sann för alla fall
     * (flera villkor, "any"/"all"). Villkorsytans egna fält är sanningen.
     */
    expect(block.querySelector("[data-option-visibility-badge]")).toBeNull();
    expect(block.querySelector("[data-option-visibility-summary]")).toBeNull();
  });

  /*
   * Konceptbild 3 sa "jämförelse + värde delar rad när de ryms, annars
   * staplade"; Astra 29/9 förmiddag gick ett steg till: "Är lika med" på en
   * egen fullbred rad, följt av värdeväljaren — alltid, så längre operatorer
   * och flera valda värden får plats. Provet breddar gruppen och visar att
   * de INTE går upp på en rad ens då; fältets egen "visas om" (annat scope)
   * delar rad som förut och vaktas i sina egna prov.
   */
  test("jämförelse och värde står alltid på var sin rad i alternativets villkorsgrupp", async () => {
    const editor = await mounted();
    openCard(editor, "opt-foretag");
    await settle(50);

    const group = card(editor, "opt-foretag").querySelector<HTMLElement>(".properties-panel__option-visibility-conditions")!;
    // Since Del B (29/9) the three controls stand in one condition group, the
    // same in all three places a condition is written.
    const row = group.querySelector<HTMLElement>(".properties-panel__condition");
    expect(row, "gruppen finns").toBeTruthy();

    const [, operatorLabel, valueLabel] = [...row!.querySelectorAll(":scope > label")];
    expect(operatorLabel.querySelector('[data-option-visibility-property="operator"]')).toBeTruthy();
    expect(valueLabel.querySelector('[data-option-visibility-property="value"]')).toBeTruthy();

    const tops = () => {
      const op = operatorLabel.getBoundingClientRect();
      const val = valueLabel.getBoundingClientRect();
      return { sameRow: Math.abs(op.top - val.top) < 2, stacked: op.bottom <= val.top + 1 };
    };

    expect(tops().stacked, "staplade i panelens bredd").toBe(true);

    // Också i en bred grupp: fortfarande var sin rad.
    group.style.width = "520px";
    await settle(50);
    expect(tops().sameRow, "aldrig sida vid sida").toBe(false);
    expect(tops().stacked).toBe(true);
    group.style.width = "";
  });

  test("fältväljaren tar hela sin kolumns bredd", async () => {
    const editor = await mounted();
    openCard(editor, "opt-foretag");
    await settle(50);

    const group = card(editor, "opt-foretag").querySelector(".properties-panel__option-visibility-conditions")!;
    const select = group.querySelector<HTMLSelectElement>('[data-option-visibility-property="variableName"]')!;
    const selectRect = select.getBoundingClientRect();
    const groupRect = group.getBoundingClientRect();

    // Inte pixelperfekt (gruppens egen padding drar in den), men i alla fall
    // inte webbläsarens krympta standardbredd (uppmätt fel innan fixen: en
    // `<select>` utan bredd landade under 100px i ett 300px kort).
    expect(selectRect.width).toBeGreaterThan(groupRect.width * 0.8);
  });

  test("fältets egen 'visas om' (annat scope) fick ingen av delarna", async () => {
    const editor = await mounted();
    editor.shadowRoot!
      .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
      .selectNodeById("org");
    await settle();

    panel(editor)
      .querySelector<HTMLElement>(".properties-panel__visibility")!
      .querySelector<HTMLInputElement>('[data-visibility-property="enabled"]')!
      .click();
    await settle(50);

    // Panelen ritar om vid varje ändring (samma skäl som identiteten på
    // villkorets kontroller måste stå i markupen) — hämta fältet på nytt,
    // inte referensen från före klicket.
    const field = panel(editor).querySelector<HTMLElement>(".properties-panel__visibility")!;

    // Ingen gruppyta, ingen sammanfattningsplats — de hör bara till
    // alternativets villkor.
    expect(field.querySelector(".properties-panel__option-visibility-conditions")).toBeNull();
    expect(field.querySelector("[data-option-visibility-summary]")).toBeNull();

    // Etiketten: "Svar eller värde" även här sedan Del B (uppdrag 29/9, Astras
    // spec §3: samma villkorsfält på alla tre ställen). Tidigare "Variabel".
    const variableLabel = field.querySelector('[data-visibility-property="variableName"]')
      ?.closest("label")
      ?.querySelector("span");
    expect(variableLabel?.textContent?.trim()).toBe("Svar eller värde");
  });
});

/**
 * Vända 6 (29/9), Johan: "det är viktigt att det ser ut som på bilden" — inne
 * i ett öppet svarsalternativs kort gäller bilden över panelens vanliga
 * versala bildtextkonvention. Två saker den convention-regeln annars skulle
 * dölja, mätta med `getComputedStyle` mot koden innan fixen (se leveransen):
 * etiketterna ovanför fälten och avdelaren mot den destruktiva raden.
 */
describe("vända 6 — kortets egna etiketter och avdelare, som bilden", () => {
  /*
   * Vikten skärptes från "fetstil som bilden" (≥ 700) till fältetikettens
   * egen token av Astras granskning av vända 1 (bilaga 2, 29/9): etiketten
   * `--fw-weight-strong`, bara rubriker `--fw-weight-heading`.
   */
  test("'Svarsalternativ' och 'Lagringsvärde' är halvfeta i meningsstil, inte versaler", async () => {
    const editor = await mounted();
    openCard(editor, "opt-privat");
    await settle(50);

    const block = card(editor, "opt-privat");
    const labelField = block.querySelector<HTMLElement>('[data-option-property="label"]')!.closest("label")!;
    const valueField = block.querySelector<HTMLElement>('[data-option-property="value"]')!.closest("label")!;

    for (const label of [labelField, valueField]) {
      const style = getComputedStyle(label);
      expect(style.textTransform, `${label.textContent?.trim().slice(0, 20)}: ingen versal`).toBe("none");
      expect(style.fontWeight, "fältetikettens vikt, inte rubrikens").toBe(style.getPropertyValue("--fw-weight-strong").trim());
    }
  });

  test("'Utesluter andra val' och reglagets egen etikett påverkas inte av den nya regeln", async () => {
    const editor = await mounted();
    openCard(editor, "opt-privat");
    await settle(50);

    const block = card(editor, "opt-privat");
    const exclusive = block.querySelector<HTMLElement>(".properties-panel__option-exclusive")!;
    const toggle = block.querySelector<HTMLInputElement>('[data-option-visibility-property="enabled"]')!.closest("label")!;

    for (const label of [exclusive, toggle]) {
      const style = getComputedStyle(label);
      expect(Number(style.fontWeight), `${label.textContent?.trim()}: normalvikt, orörd`).toBeLessThan(700);
    }
  });

  test("en avdelare står ovanför 'Ta bort alternativ', som bilden", async () => {
    const editor = await mounted();
    openCard(editor, "opt-privat");
    await settle(50);

    const remove = card(editor, "opt-privat").querySelector<HTMLElement>(".properties-panel__option-remove")!;
    const style = getComputedStyle(remove);
    expect(style.borderTopWidth).not.toBe("0px");
    expect(style.borderTopStyle).toBe("solid");
  });

  /*
   * Johan 29/9: "det är viktigt att det ser ut som på bilden" — konceptbild
   * 3 gav reglagets etikett vanlig textfärg som "Utesluter andra val". (Samma
   * vända dolde radetiketterna Villkor/Värde för ögat; Astras bild senare
   * samma dag satte dem synliga igen på var sin rad — se select-provet
   * nedan.) Hjälptexten under reglaget står kvar, kortad till omfattningen
   * (Johan via Astra 29/9); texten vaktas i option-visibility.browser.test.ts.
   */
  test("kortet följer bilden: reglagets etikett i textfärg", async () => {
    const editor = await mounted();

    openCard(editor, "opt-foretag");
    await settle();
    const block = card(editor, "opt-foretag");
    const visibility = block.querySelector<HTMLElement>(".properties-panel__option-visibility")!;
    const toggleLabel = visibility.querySelector<HTMLElement>("label > span")!;
    const exclusiveLabel = block.querySelector<HTMLElement>(".properties-panel__option-exclusive")!;

    expect(getComputedStyle(toggleLabel).color, "samma textfärg som Utesluter andra val").toBe(getComputedStyle(exclusiveLabel).color);
  });
  /*
   * Astra via Johan 29/9, avslutande punkt 2: operatorfältet var högre än
   * övriga kontroller och texten låg tätt mot pilen. Mätt: raden är ett
   * rutnät med `align-items: normal`, så båda cellerna sträcks till
   * värdeväljarens höjd (48 px ruta + räknaren "1 värde") — operatorn blev
   * 72 px där panelens övriga select är 47. Bredaste operatorn ("Är inte
   * någon av") är 150 px text i en 131 px cell. Kravet: normal kontroll-
   * höjd, plats för pilen, linjerad överkant, och stapling när innehållet
   * inte ryms bekvämt.
   */
  test("operatorn i villkorsgruppen: normal höjd, plats för pilen, ryms eller staplas", async () => {
    const editor = await mounted();

    openCard(editor, "opt-foretag");
    await settle();
    const block = card(editor, "opt-foretag");
    const conditions = block.querySelector<HTMLElement>(".properties-panel__option-visibility-conditions")!;
    const row = conditions.querySelector<HTMLElement>(".properties-panel__condition")!;
    const operator = row.querySelector<HTMLSelectElement>('select[data-option-visibility-property="operator"]')!;
    const picker = row.querySelector<HTMLElement>("chip-picker")!;
    // The field is the searchable picker since story 143; its closed field is what stands in the row.
    const variable = row.querySelector('field-picker[data-option-visibility-property="variableName"]')!
      .shadowRoot!.querySelector<HTMLElement>(".control")!;

    // Normal kontrollhöjd: samma som fältväljaren ovanför, aldrig sträckt
    // till värdeväljarens höjd med räknare.
    expect(Math.abs(operator.getBoundingClientRect().height - variable.getBoundingClientRect().height), "operatorn har fältväljarens höjd").toBeLessThanOrEqual(1);
    expect(operator.getBoundingClientRect().height, "inte sträckt till väljarens höjd").toBeLessThan(picker.getBoundingClientRect().height);

    // Plats för pilen: texten får inte ligga tätt mot den.
    const style = getComputedStyle(operator);
    const padRight = Number.parseFloat(style.paddingRight);

    expect(padRight, "utrymme reserverat för pilen").toBeGreaterThanOrEqual(24);

    // Samma vikt som panelens övriga select — kontrollen ärver inte etikettens.
    expect(style.fontWeight).toBe(getComputedStyle(variable).fontWeight);

    // Ryms bekvämt: bredaste operatorn får plats i cellen med sin padding —
    // annars ska raden ha staplats.
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const widest = Math.max(...[...operator.options].map((o) => ctx.measureText(o.textContent ?? "").width));
    const inner = operator.clientWidth - Number.parseFloat(style.paddingLeft) - padRight;

    expect(inner, `bredaste operatorn (${Math.round(widest)} px) ryms`).toBeGreaterThanOrEqual(widest);

    // Sida vid sida: överkanterna linjerar. Staplat: operatorn ovanför väljaren.
    const sideBySide = Math.abs(operator.getBoundingClientRect().left - picker.getBoundingClientRect().left) > 1;
    if (sideBySide) {
      expect(Math.abs(operator.getBoundingClientRect().top - picker.getBoundingClientRect().top), "linjerad överkant").toBeLessThanOrEqual(1);
    } else {
      expect(operator.getBoundingClientRect().bottom).toBeLessThanOrEqual(picker.getBoundingClientRect().top);
    }
  });

  /*
   * Astra via Johan 29/9 förmiddag (efter operatorpunkten): select-fälten
   * ska ha "samma lugna form som textrutorna, med en tydlig chevron" —
   * normal vikt på valt värde, samma höjd som övriga fält (44–48), 12 px
   * vänsterluft och reserverad plats till höger, en SVG-chevron ~18 px
   * centrerad till höger, tunn ram med textfältens radie, befintlig fokus-
   * markering. Och i villkorsgruppen: "Villkor" på en egen fullbred rad,
   * följt av värdeväljaren, med synliga etiketter (Astras bild).
   */
  test("select-fälten har textrutornas form och en ritad chevron; villkorsgruppen staplad med synliga etiketter", async () => {
    const editor = await mounted();

    openCard(editor, "opt-foretag");
    await settle();
    const block = card(editor, "opt-foretag");
    const textarea = block.querySelector<HTMLTextAreaElement>("textarea")!;
    const valueInput = block.querySelector<HTMLInputElement>('input[data-option-property="value"]')!;
    const conditions = block.querySelector<HTMLElement>(".properties-panel__option-visibility-conditions")!;
    const selects = [...conditions.querySelectorAll<HTMLSelectElement>("select")];
    /*
     * Story 143: the field is the searchable picker, whose closed field is
     * a button in the same select mixin (`.field` wraps it as
     * `.properties-panel__select` wraps a select). It is held to the same
     * shape as the operator's select that stays.
     */
    const picker = conditions.querySelector('field-picker[data-option-visibility-property="variableName"]')!;
    const pickerField = picker.shadowRoot!.querySelector<HTMLElement>(".control")!;

    expect(selects.length, "operatorn är kvar som select").toBe(1);
    const textStyle = getComputedStyle(textarea);
    for (const select of [pickerField, ...selects]) {
      const style = getComputedStyle(select);
      const height = select.getBoundingClientRect().height;
      // Chevronen ritas av wrapperns ::after som en mask med tokenfärg — inte
      // av fältet självt (se `_select.scss`). Wrappern lägger inget till i
      // storlek, och pilen tar inga pekarhändelser från fältet.
      const wrap = select.parentElement!;
      const arrow = getComputedStyle(wrap, "::after");

      expect(wrap.classList.contains(select === pickerField ? "field" : "properties-panel__select"), "wrapper").toBe(true);
      expect(style.appearance, "webbläsarens egen pil är av").toBe("none");
      expect(style.backgroundImage, "fältet bär ingen bild").toBe("none");
      expect(arrow.maskImage, "en ritad SVG-chevron som mask").toContain("svg");
      expect(arrow.width, "~18 px").toBe("18px");
      expect(arrow.right, "12 px från högerkanten").toBe("12px");
      expect(arrow.pointerEvents).toBe("none");
      expect(Math.abs(wrap.getBoundingClientRect().height - height), "wrappern lägger inget till").toBeLessThanOrEqual(1);
      expect(height, "samma höjd som övriga fält").toBeGreaterThanOrEqual(44);
      expect(height).toBeLessThanOrEqual(48);
      expect(style.paddingLeft).toBe("12px");
      expect(Number.parseFloat(style.paddingRight), "texten möter aldrig pilen").toBeGreaterThanOrEqual(36);
      expect(style.fontWeight, "normal vikt på valt värde").toBe("400");
      expect(style.borderRadius, "textfältens radie").toBe(textStyle.borderRadius);
      expect(style.borderWidth, "tunn ram").toBe("1px");
    }

    // Textrutorna i kortet: samma lugna vikt (Astras bild visar dem i normal vikt).
    expect(textStyle.fontWeight).toBe("400");
    expect(getComputedStyle(valueInput).fontWeight).toBe("400");

    // Villkorsgruppen: fältväljare, villkor, värde — var och en på egen rad,
    // etiketterna synliga.
    const group = conditions.querySelector<HTMLElement>(".properties-panel__condition")!;
    const rowLabels = [...group.querySelectorAll<HTMLElement>(":scope > label > span:first-child")];

    expect(rowLabels.map((l) => l.textContent?.trim())).toEqual(["Svar eller värde", "Villkor", "Värde"]);
    for (const span of rowLabels) {
      expect(span.getBoundingClientRect().width, `${span.textContent} syns`).toBeGreaterThan(20);
    }
    const [, operatorLabel, valueLabel] = [...group.querySelectorAll<HTMLElement>(":scope > label")];

    expect(operatorLabel.getBoundingClientRect().bottom, "villkor ovanför värde").toBeLessThanOrEqual(valueLabel.getBoundingClientRect().top + 1);
    expect(Math.abs(operatorLabel.getBoundingClientRect().width - conditions.clientWidth), "fullbred").toBeLessThanOrEqual(2 * 16 + 2);
  });

  /*
   * Astra 29/9, före push: "Verifiera att chevronen följer värdens palettbyte
   * och lokal överskrivning av sekundärtextens färgtoken. Två SVG-varianter
   * för ljust/mörkt bevisar inte i sig detta." Mätt mot den första lösningen
   * (SVG-token med inskriven hex): pilen stod kvar i sin färg när
   * `--fw-text-secondary` skrevs över på elementet. Nu är pilen en mask på
   * wrappern fylld från tokenen, så provet skriver över tokenen som en värd
   * gör (K10: tokens på elementet) och lägger på en färgskala från sajten,
   * och kräver att pilen är exakt vad tokenen säger i båda fallen.
   */
  test("chevronen följer --fw-text-secondary: lokal överskrivning och palettbyte", async () => {
    const editor = await mounted();

    openCard(editor, "opt-foretag");
    await settle();
    const wrap = card(editor, "opt-foretag").querySelector<HTMLElement>(".properties-panel__option-visibility-conditions .properties-panel__select")!;
    const probe = document.createElement("span");

    editor.append(probe);
    const tokenColour = () => {
      probe.style.color = getComputedStyle(editor).getPropertyValue("--fw-text-secondary");
      return getComputedStyle(probe).color;
    };
    const arrowColour = () => getComputedStyle(wrap, "::after").backgroundColor;

    try {
      expect(arrowColour(), "utgångsläget").toBe(tokenColour());

      // En värd skriver över tokenen på elementet.
      editor.style.setProperty("--fw-text-secondary", "rgb(200, 30, 30)");
      await settle(50);
      expect(tokenColour()).toBe("rgb(200, 30, 30)");
      expect(arrowColour(), "följer den lokala överskrivningen").toBe("rgb(200, 30, 30)");
      editor.style.removeProperty("--fw-text-secondary");

      // Färgskalorna byter accent, inte text — pilen ska stå kvar exakt
      // på tokenens värde, före som efter.
      const before = tokenColour();
      const { palettes, applyPalette } = await import("../../../viewer/styles/palettes");
      const hav = palettes.hav;

      applyPalette(hav);
      await settle(50);
      try {
        expect(arrowColour(), `med skalan ${hav.id}`).toBe(tokenColour());
        expect(tokenColour(), "skalan rör inte sekundärtexten").toBe(before);
      } finally {
        applyPalette(null);
      }
    } finally {
      probe.remove();
    }
  });
});

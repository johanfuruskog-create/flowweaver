import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { registerCodeList, unregisterCodeList } from "../../../viewer/code-lists/code-list-registry";
import { navetCountryCodes } from "../../../viewer/code-lists/navet-country-codes";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * "Är någon av" är flera. Då ska värdet väljas som flera.
 *
 * ## Var det här hittades
 *
 * Johan, i regelpanelen på en iPad: villkoret *land.value är någon av* hade ett
 * tomt textfält där man förväntas skriva `SE,DK,FI,NO,IS` för hand. Ingenting
 * säger att kommatecken är separatorn, ingenting säger vilka koder som finns,
 * och en felstavning ger en gren som aldrig tar.
 *
 * Felet är äldre än landfältet. Värdet har alltid ritats som ett **enkelval**
 * när variabeln har alternativ — så en vanlig flervalsvariabel med "är någon av"
 * kunde bara få ETT värde, vilket är samma sak som "är lika med" fast omvägen.
 *
 * ## Varför pillboxen och inte en kommalista
 *
 * För att lagringen är en kommalista och det ska den fortsätta vara — det är
 * kontraktet, och `one-of` läser det. Det som ändras är hur man fyller i den:
 * etiketter man väljer i stället för tecken man skriver.
 */

afterEach(() => {
  document.body.replaceChildren();
  unregisterCodeList("navet-country-codes");
});

const settle = (ms = 140) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Kommalistan som faktiskt lagras — kontraktet, oavsett hur den fylls i. */
const hiddenValue = (picker: ShadowRoot): string =>
  (picker.host.getRootNode() as ShadowRoot)
    .querySelector<HTMLInputElement>("[data-rule-condition-property='value']")!.value;

async function panelFor(node: Record<string, unknown>, rule: Record<string, unknown>) {
  registerCodeList(navetCountryCodes);

  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q",
    nodes: [
      { id: "q", position: { x: 0, y: 0 }, ...node },
      { id: "r", type: "rule", position: { x: 400, y: 0 }, data: rule },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  editor.shadowRoot!
    .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
    .selectNodeById("r");
  await settle();
  await settle();

  const panel = editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;

  /*
   * Kontrollen bor i `chip-picker` sedan den delas med visarens flervalslista,
   * så testerna går genom dess skugg-DOM. Samma påståenden, en kontroll.
   */
  return panel.querySelector("[data-rule-value-picker]")?.shadowRoot ?? panel;
}

const land = {
  type: "autocomplete-question",
  data: {
    title: { sv: "Land" },
    variableName: "land",
    variableLabel: "Medborgarskap",
    source: "codelist",
    codeListId: "navet-country-codes",
  },
};

const regel = (operator: string, value: string) => ({
  title: { sv: "Var?" },
  cases: [
    {
      id: "c",
      label: "Norden",
      match: "any",
      conditions: [{ id: "v", variableName: "land.code", operator, value }],
    },
  ],
});

describe("värdet när jämförelsen är 'är någon av'", () => {
  test("är etiketter man valt, inte tecken man skrivit", async () => {
    const panel = await panelFor(land, regel("one-of", "SE,DK"));
    const valda = [...panel.querySelectorAll("[data-chosen]")].map(
      (one) => (one as HTMLElement).dataset.chosen,
    );

    expect(valda).toEqual(["SE", "DK"]);
  });

  test("och etiketten visar landet, inte koden", async () => {
    /*
     * Redaktören känner igen Sverige, inte SE. Koden är vad som lagras och
     * vad regeln prövar — den ska inte vara vad man läser.
     */
    const panel = await panelFor(land, regel("one-of", "SE"));

    expect(
      panel.querySelector("[data-chosen] .chip-picker__chip-label")?.textContent?.trim(),
    ).toBe("Sverige");
  });

  test("ett tillagt land hamnar i kommalistan", async () => {
    const panel = await panelFor(land, regel("one-of", "SE"));
    const search = panel.querySelector<HTMLInputElement>("[data-search]")!;

    search.value = "Danmark";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();

    panel.querySelector<HTMLButtonElement>('[data-add][data-value="DK"]')!.click();
    await settle();

    expect(hiddenValue(panel))
      .toBe("SE,DK");
  });

  test("och ett borttaget försvinner ur den", async () => {
    const panel = await panelFor(land, regel("one-of", "SE,DK"));

    panel.querySelector<HTMLButtonElement>("[data-remove]")!.click();
    await settle();

    expect(hiddenValue(panel))
      .toBe("DK");
  });

  test("och 'är lika med' väljs likadant, men bara ett", async () => {
    /*
     * Johan: *om värden finns ska redaktören inte behöva veta värdena utan
     * söka på etiketten, så det går snabbt att skapa guider.* Och hans egen
     * följdfråga — är det kanske så överallt i regeleditorn redan? — hade
     * svaret nej: "är någon av" fick väljaren, "är lika med" stod kvar med en
     * vanlig `<select>`. Tvåhundrafyra länder i en rullgardin utan sök.
     *
     * Samma kontroll, ett attribut som skillnad: `single`.
     */
    const panel = await panelFor(land, regel("equals", "SE"));

    expect(panel.querySelector("[data-chosen]")?.textContent).toContain("Sverige");
    expect(panel.host.hasAttribute("single")).toBe(true);
  });

  test("ett andra val ersätter det första när jämförelsen gäller ett", async () => {
    const panel = await panelFor(land, regel("equals", "SE"));
    const search = panel.querySelector<HTMLInputElement>("[data-search]")!;

    search.value = "Danmark";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    panel.querySelector<HTMLButtonElement>('[data-add][data-value="DK"]')!.click();
    await settle();

    expect(hiddenValue(panel)).toBe("DK");
  });
});

describe("en vanlig flervalsvariabel", () => {
  test("får samma väljare — felet var aldrig landfältets", async () => {
    const fraga = {
      type: "multi-choice",
      data: {
        title: { sv: "Tjänster" },
        variableName: "tjanster",
        options: [
          { id: "a", label: { sv: "Bygglov" }, value: "bygglov" },
          { id: "b", label: { sv: "Sophämtning" }, value: "sopor" },
        ],
      },
    };
    const panel = await panelFor(fraga, {
      title: { sv: "Var?" },
      cases: [
        {
          id: "c",
          label: "Ja",
          match: "any",
          conditions: [{ id: "v", variableName: "tjanster", operator: "one-of", value: "bygglov" }],
        },
      ],
    });

    expect(
      panel.querySelector("[data-chosen] .chip-picker__chip-label")?.textContent?.trim(),
    ).toBe("Bygglov");
  });

  test("en lång lista visar inga alternativ förrän man sökt", async () => {
    /*
     * Femtio länder i bokstavsordning innan man skrivit något är brus: de
     * säger ingenting om vad man letar efter, de tar över panelen, och det
     * första man ser av en landlista ska inte vara Afghanistan.
     *
     * En kort lista visar allt — då är det snabbare att peka än att skriva.
     */
    const panel = await panelFor(land, regel("one-of", ""));

    expect(panel.querySelectorAll("[data-add]")).toHaveLength(0);
    expect(panel.querySelector("[data-count]")?.textContent).toMatch(/\d/);
  });

  test("och visar dem när man sökt", async () => {
    const panel = await panelFor(land, regel("one-of", ""));
    const search = panel.querySelector<HTMLInputElement>("[data-search]")!;

    search.value = "Danmark";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();

    expect([...panel.querySelectorAll("[data-add]")].map((one) => one.textContent?.trim()))
      .toEqual(["Danmark"]);
  });

  test("en kort lista visar allt när kontrollen används", async () => {
    const fraga = {
      type: "multi-choice",
      data: {
        title: { sv: "Tjänster" },
        variableName: "tjanster",
        options: [
          { id: "a", label: { sv: "Bygglov" }, value: "bygglov" },
          { id: "b", label: { sv: "Sophämtning" }, value: "sopor" },
        ],
      },
    };
    const panel = await panelFor(fraga, {
      title: { sv: "Var?" },
      cases: [
        { id: "c", label: "Ja", match: "any", conditions: [{ id: "v", variableName: "tjanster", operator: "one-of", value: "" }] },
      ],
    });

    // Alternativen tar ingen plats innan någon använt kontrollen.
    expect(panel.querySelectorAll("[data-add]")).toHaveLength(0);

    panel.querySelector<HTMLElement>(".chip-picker__box")!
      .dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    await settle();

    expect(panel.querySelectorAll("[data-add]")).toHaveLength(2);
  });

  test("och ingen text visar sina egna platshållare", async () => {
    /*
     * Sett på Johans iPad: statusraden sa **"{name} borttagen. {count} valda."**
     * Panelen lånade mottagarlistans strängar, som fyller `{name}` och
     * `{count}`, medan kontrollen fyller `{label}` och `{n}` — två uppsättningar
     * namn som aldrig möttes, så ingenting ersattes.
     *
     * Det är en klass av fel som inte kan fångas av att texten finns: den fanns.
     */
    const panel = await panelFor(land, regel("one-of", "SE,DK"));

    panel.querySelector<HTMLButtonElement>("[data-remove]")!.click();
    await settle();

    // Bara det synliga: stilmallen är full av klammer och är inte text.
    const synligt = panel.querySelector('[role="group"]')?.textContent ?? "";

    expect(synligt).not.toMatch(/\{\w+\}/);
    expect(panel.querySelector("[data-status]")?.textContent).toContain("Sverige");
  });
});

describe("alla fyra jämförelserna", () => {
  /*
   * Johan: *de andra jämförelserna borde också ha multiselect, "lika med"
   * borde ha max antal 1.* Alla fyra väljer ur samma kontroll; antalet är det
   * enda som skiljer, och det följer av vad jämförelsen betyder.
   */
  const fall: Array<[string, boolean]> = [
    ["equals", true],
    ["not-equals", true],
    ["one-of", false],
    ["not-one-of", false],
  ];

  for (const [operator, ett] of fall) {
    test(`${operator} använder kontrollen, ${ett ? "ett värde" : "flera"}`, async () => {
      const panel = await panelFor(land, regel(operator, "SE"));

      expect(panel.host.tagName.toLowerCase()).toBe("chip-picker");
      expect(panel.host.hasAttribute("single")).toBe(ett);
    });
  }

  test("och 'lika med' byter ut i stället för att lägga till", async () => {
    const panel = await panelFor(land, regel("equals", "SE"));
    const search = panel.querySelector<HTMLInputElement>("[data-search]")!;

    search.value = "Danmark";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    panel.querySelector<HTMLButtonElement>('[data-add][data-value="DK"]')!.click();
    await settle();

    expect(panel.querySelectorAll("[data-chosen]")).toHaveLength(1);
    expect(hiddenValue(panel)).toBe("DK");
  });

  test("men 'är inte någon av' lägger till", async () => {
    const panel = await panelFor(land, regel("not-one-of", "SE"));
    const search = panel.querySelector<HTMLInputElement>("[data-search]")!;

    search.value = "Danmark";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    panel.querySelector<HTMLButtonElement>('[data-add][data-value="DK"]')!.click();
    await settle();

    expect(hiddenValue(panel)).toBe("SE,DK");
  });

  test("och att BYTA jämförelse ändrar kontrollen med", async () => {
    /*
     * Det här är felet Johan såg effekten av, och som testerna ovan inte kunde
     * fånga: de bygger grafen med operatorn färdigsatt. Byter man den i
     * panelen ritades bara datan om, inte kontrollen — `if (property ===
     * "variableName") this.render()`.
     *
     * Det var rätt så länge värdefältet bara berodde på variabelns alternativ.
     * Nu bestämmer jämförelsen om det är ett värde eller flera, så den måste
     * rita om också. Värdet får däremot INTE göra det: då tappas sökrutan mitt
     * i att man skriver.
     */
    const panel = await panelFor(land, regel("one-of", "SE,DK"));
    const rot = panel.host.getRootNode() as ShadowRoot;

    expect(panel.host.hasAttribute("single"), "flera från början").toBe(false);

    const operator = rot.querySelector<HTMLSelectElement>(
      '[data-rule-condition-property="operator"]',
    )!;

    operator.value = "equals";
    operator.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(250);

    const efter = rot.querySelector("[data-rule-value-picker]")!;

    expect(efter.hasAttribute("single"), "ett värde efter bytet").toBe(true);
  });

  test("och en NY regel får kontrollen så snart en variabel valts", async () => {
    /*
     * Johan: *när du skapar en ny regel skapas bara ett vanligt textfält, inte
     * en multiselect.* Ett nytt villkor har ingen variabel, och utan variabel
     * finns inga kända värden — då är fritext rätt, för det finns ingenting
     * att erbjuda.
     *
     * Men i samma ögonblick en variabel med kända värden pekas ut ska
     * kontrollen stå där. Det testet ovan inte kunde säga något om: de börjar
     * med variabeln redan satt.
     */
    const panel = await panelFor(land, {
      title: { sv: "Var?" },
      cases: [
        { id: "c", label: "Ny", match: "any", conditions: [{ id: "v", variableName: "", operator: "equals", value: "" }] },
      ],
    });
    /*
     * `panelFor` ger kontrollens skugg-DOM när den finns, annars panelens.
     * Utan variabel finns ingen kontroll, så roten ÄR panelen här.
     */
    const rot = panel.host.tagName.toLowerCase() === "properties-panel"
      ? panel
      : (panel.host.getRootNode() as ShadowRoot);

    /*
     * Utan variabel finns ingenting att erbjuda — men ett tomt textfält bjuder
     * in till att skriva en kod, vilket är precis vad väljaren finns för att
     * slippa. Fältet är spärrat och säger vad som saknas, så ordningen syns.
     */
    const tomt = rot.querySelector<HTMLInputElement>('input[data-rule-condition-property="value"]')!;

    expect(rot.querySelector("[data-rule-value-picker]")).toBeNull();
    expect(tomt.disabled, "spärrat tills en variabel valts").toBe(true);
    expect(tomt.placeholder).toBe("Välj variabel först");

    const variabel = rot.querySelector<HTMLSelectElement>(
      '[data-rule-condition-property="variableName"]',
    )!;

    variabel.value = "land.value";
    variabel.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(250);

    expect(rot.querySelector("[data-rule-value-picker]"), "kontrollen efter val av variabel").not.toBeNull();
  });
});

describe("när en regel läggs till", () => {
  /**
   * Man hamnar i den nya regeln, inte överst.
   *
   * Johan, på en iPad: skapar man en tredje regel står man plötsligt vid den
   * första — panelen ritas om och rullar tillbaka till toppen, medan man tror
   * man är i den man just skapade. Nästa sak man skriver hamnar i fel regel,
   * och det upptäcks först när guiden förgrenar konstigt.
   *
   * Fokus i den nya regelns namnfält löser båda halvorna: markören står där
   * man ska skriva, och webbläsaren rullar dit av sig självt.
   */
  test("står markören i den nyas namnfält", async () => {
    const panel = await panelFor(land, regel("one-of", "SE"));
    const rot = panel.host.tagName.toLowerCase() === "properties-panel"
      ? panel
      : (panel.host.getRootNode() as ShadowRoot);

    rot.querySelector<HTMLButtonElement>('[data-action="add-rule-case"]')!.click();
    await settle(250);

    const fall = [...rot.querySelectorAll<HTMLElement>("[data-rule-case-id]")];
    const siste = fall[fall.length - 1]!;
    const namn = siste.querySelector<HTMLInputElement>("[data-rule-case-property='label']");

    expect(fall.length, "två regler efter tillägget").toBe(2);
    expect(rot.activeElement, "fokus i den nya regelns namn").toBe(namn);
  });
});

describe("när jämförelsen byts", () => {
  /**
   * Man står kvar i sitt villkor.
   *
   * Johan igen, samma klass av fel som när en regel läggs till: att byta
   * jämförelse ritar om panelen, och då rullar den tillbaka till toppen. Man
   * hamnar vid regel 1 medan man arbetade i regel 3.
   *
   * Omritningen behövs — jämförelsen avgör om värdet är ett eller flera — så
   * det som ska lagas är att fokus försvinner med den. Fokus tillbaka på samma
   * fält betyder att markören står kvar och att webbläsaren rullar dit igen.
   *
   * Regressionen var min: fältet ritade inte om alls innan, så det fanns
   * ingenting att tappa.
   */
  test("står markören kvar på jämförelsen", async () => {
    const panel = await panelFor(land, regel("one-of", "SE"));
    const rot = panel.host.tagName.toLowerCase() === "properties-panel"
      ? panel
      : (panel.host.getRootNode() as ShadowRoot);
    // The rule is a card, closed until opened (uppdrag 29/9 Del A).
    rot.querySelector<HTMLButtonElement>('[data-action="toggle-rule-case"]')!.click();
    const operator = rot.querySelector<HTMLSelectElement>(
      '[data-rule-condition-property="operator"]',
    )!;

    operator.focus();
    operator.value = "equals";
    operator.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(250);

    const efter = rot.querySelector<HTMLSelectElement>(
      '[data-rule-condition-property="operator"]',
    )!;

    expect(efter.value, "bytet slog igenom").toBe("equals");
    expect(rot.activeElement, "fokus kvar på jämförelsen").toBe(efter);
  });

  test("och likaså när variabeln byts", async () => {
    // Samma väg, samma fel: variabeln har ritat om sedan långt före i dag.
    const panel = await panelFor(land, regel("one-of", "SE"));
    const rot = panel.host.tagName.toLowerCase() === "properties-panel"
      ? panel
      : (panel.host.getRootNode() as ShadowRoot);
    rot.querySelector<HTMLButtonElement>('[data-action="toggle-rule-case"]')!.click();
    const variabel = rot.querySelector<HTMLSelectElement>(
      '[data-rule-condition-property="variableName"]',
    )!;

    variabel.focus();
    variabel.value = "land";
    variabel.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(250);

    expect(
      (rot.activeElement as HTMLElement | null)?.dataset?.ruleConditionProperty,
    ).toBe("variableName");
  });
});

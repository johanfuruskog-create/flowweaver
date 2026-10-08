import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import type { PropertiesPanel } from "./properties-panel";
import type { RichTextField } from "../rich-text-field/rich-text-field";

/**
 * Story 060 — sätt in en variabel utan att kunna syntaxen. Sedan story 136:
 * *Infoga svar*, och svaret blir en bricka med sin etikett i stället för
 * `{{namn}}` i texten.
 *
 * Knappen sitter inne i `<rich-text-field>`: i rubrikens högra kant, och
 * (Johans val 26/9, efter tre byggda plus-varianter) sist i beskrivningens
 * verktygsrad — samma form som fet/kursiv/länk/lista, ett bart plus utan
 * synlig text, namnet "Infoga variabel" i `aria-label` och `title` (Astra 30/9, B9). Reglerna från
 * 060 gäller fortfarande och prövas här, genom panelen: vad listan erbjuder,
 * var valet hamnar, att knappen aldrig stjäl fokus från texten, och att
 * plattans tryck inte stänger listan i förtid. Hur fältet i övrigt beter sig
 * prövas bredvid komponenten.
 *
 * Johan, 31/8: *"Kan den ligga bredvid text-fältet och ovanför textarea? När
 * man trycker på den visas en drop-down med alla variabler man väljer en så
 * läggs den vid markeringen."*
 */

afterEach(() => document.body.replaceChildren());

const VARIABLER = [
  { label: "Ditt namn", value: "namn", type: "text", options: [] },
  { label: "Din ort", value: "ort", type: "text", options: [] },
];

function panelWith(
  data: Record<string, unknown>,
  type = "result",
  variables: unknown[] = VARIABLER,
): PropertiesPanel {
  const panel = document.createElement("properties-panel") as PropertiesPanel;

  panel.editorMode = "administrator";
  document.body.append(panel);
  panel.variableOptions = variables as never;
  panel.nodeData = { id: "n", type, position: { x: 0, y: 0 }, data } as never;

  return panel;
}

const field = (panel: PropertiesPanel, property: string): RichTextField | null =>
  panel.shadowRoot?.querySelector<RichTextField>(`rich-text-field[data-property="${property}"]`) ?? null;

/** The *Infoga svar* button, or null when the field has none to show. */
const toggle = (panel: PropertiesPanel, property: string): HTMLButtonElement | null => {
  const button = field(panel, property)?.shadowRoot?.querySelector<HTMLButtonElement>("[data-answer-toggle]") ?? null;

  return button && !button.closest("[hidden]") ? button : null;
};

const options = (panel: PropertiesPanel, property: string): HTMLButtonElement[] => [
  ...(field(panel, property)?.shadowRoot?.querySelectorAll<HTMLButtonElement>("[data-insert]") ?? []),
];

const text = (panel: PropertiesPanel, property: string): HTMLElement =>
  field(panel, property)!.shadowRoot!.querySelector<HTMLElement>("[data-text]")!;

describe("var knappen sitter", () => {
  test("i rubrikfältets högra kant", async () => {
    const panel = panelWith({ title: "Tack", description: "" });
    const button = toggle(panel, "title")!;

    expect(field(panel, "title")!.hasAttribute("multiline")).toBe(false);
    expect(button.closest('[role="toolbar"]')).toBeNull();
    expect(button.closest("[data-frame]")).not.toBeNull();
  });

  test("sist i beskrivningens verktygsrad, bredvid formateringsknapparna (Johans val 26/9)", async () => {
    const panel = panelWith({ title: "Tack", description: "" });
    const button = toggle(panel, "description")!;
    const toolbar = button.closest<HTMLElement>('[role="toolbar"]');

    expect(toolbar).not.toBeNull();
    expect([...toolbar!.querySelectorAll("button")].at(-1)).toBe(button);
  });
});

describe("hur knappen ser ut", () => {
  test("ett bart plus, namnet i aria-label och title, inte i synlig text (Johans val 26/9)", async () => {
    const panel = panelWith({ title: "Tack", description: "" });
    const button = toggle(panel, "title")!;

    expect(button.textContent?.trim()).toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
    expect(button.getAttribute("aria-label")).toBe("Infoga variabel");
    expect(button.getAttribute("title")).toBe("Infoga variabel");
  });
});

describe("vad listan visar", () => {
  test("etiketten man känner igen — aldrig klamrarna (136 kriterium 1)", async () => {
    const panel = panelWith({ title: "Tack", description: "" });

    await userEvent.click(toggle(panel, "title")!);

    expect(options(panel, "title").map((row) => row.textContent?.trim())).toEqual(["Ditt namn", "Din ort"]);
  });

  test("variabelns etikett läses som en mening, inte som en etikett", async () => {
    // `.properties-panel__field span` satte VERSALER en gång ("VAD HETER DU?").
    const panel = panelWith({ title: "Tack", description: "" });

    await userEvent.click(toggle(panel, "title")!);

    expect(getComputedStyle(options(panel, "title")[0]!).textTransform).toBe("none");
  });

  test("stängd tills man trycker", async () => {
    const panel = panelWith({ title: "Tack", description: "" });
    const menu = field(panel, "title")!.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;

    expect(menu.hidden).toBe(true);

    await userEvent.click(toggle(panel, "title")!);

    expect(menu.hidden).toBe(false);
  });
});

describe("var valet hamnar", () => {
  test("sist, när fältet aldrig rörts", async () => {
    /*
     * Ett orört fält rapporterade `selectionStart` 0 och inte "saknas", så den
     * första versionen la variabeln FÖRST: `{{ort}}Hej`.
     */
    const panel = panelWith({ title: "Hej", description: "" });

    await userEvent.click(toggle(panel, "title")!);
    await userEvent.click(options(panel, "title")[1]!);

    expect(field(panel, "title")!.value).toBe("Hej{{ort}}");
  });

  test("där markören står, inte sist", async () => {
    const panel = panelWith({ title: "Hej , välkommen", description: "" });

    text(panel, "title").focus();
    await userEvent.keyboard("{Home}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    await userEvent.click(toggle(panel, "title")!);
    await userEvent.click(options(panel, "title")[0]!);

    expect(field(panel, "title")!.value).toBe("Hej {{namn}}, välkommen");
  });

  test("och ersätter det som var markerat", async () => {
    const panel = panelWith({ title: "Hej NAMN", description: "" });

    text(panel, "title").focus();
    await userEvent.keyboard("{End}{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}");
    await userEvent.click(toggle(panel, "title")!);
    await userEvent.click(options(panel, "title")[0]!);

    expect(field(panel, "title")!.value).toBe("Hej {{namn}}");
  });

  test("och redigeringen når värden", async () => {
    const panel = panelWith({ title: "Hej", description: "" });
    const changes: unknown[] = [];

    panel.addEventListener("node-data-changed", (event) => {
      changes.push((event as CustomEvent).detail);
    });

    await userEvent.click(toggle(panel, "title")!);
    await userEvent.click(options(panel, "title")[1]!);

    expect(changes).toContainEqual(expect.objectContaining({ property: "title", value: "Hej{{ort}}" }));
  });
});

describe("nodens egen variabel", () => {
  test("står inte i sin egen lista", async () => {
    // En fråga renderar sin rubrik innan någon svarat: `{{namn}}` i "Vad heter du?" är alltid tomt.
    const panel = panelWith({ title: "Vad heter du?", variableName: "namn", description: "" }, "text-question");

    expect(options(panel, "title").map((row) => row.dataset.insert)).toEqual(["ort"]);
  });

  test("och inte heller dess delar", async () => {
    const panel = panelWith(
      { title: "Var bor du?", variableName: "land", description: "" },
      "autocomplete-question",
      [
        { label: "Var bor du?", value: "land.label", type: "text", options: [] },
        { label: "Var bor du? (kod)", value: "land.value", type: "text", options: [] },
        { label: "Vilken ort?", value: "ort", type: "text", options: [] },
      ],
    );

    expect(options(panel, "title").map((row) => row.dataset.insert)).toEqual(["ort"]);
  });

  test("och blir listan tom finns ingen knapp", async () => {
    const panel = panelWith(
      { title: "Vad heter du?", variableName: "namn", description: "" },
      "text-question",
      [{ label: "Vad heter du?", value: "namn", type: "text", options: [] }],
    );

    expect(toggle(panel, "title")).toBeNull();
  });
});

describe("när knappen inte ska finnas", () => {
  test("en guide utan variabler får ingen knapp", async () => {
    const panel = panelWith({ title: "Tack", description: "" }, "result", []);

    expect(toggle(panel, "title")).toBeNull();
    expect(toggle(panel, "description")).toBeNull();
  });

  test("en nod besökaren aldrig ser får ingen", async () => {
    // En regel passeras, den renderas inte: `{{namn}}` i dess rubrik fylls aldrig i.
    for (const type of ["rule", "calculation", "service-call"]) {
      const panel = panelWith({ title: "Etikett" }, type);

      expect(toggle(panel, "title"), type).toBeNull();
      document.body.replaceChildren();
    }
  });

  test("och ett fält där mallar inte löses får ingen heller", async () => {
    const panel = panelWith({ title: "Fråga", description: "", options: [], cssClasses: "" }, "text-question");

    expect(toggle(panel, "title"), "rubriken har den").not.toBeNull();
    expect(field(panel, "cssClasses"), "css-fältet inte").toBeNull();
  });
});

/*
 * Plattan (praxis 17:s släkting): Safari ger inte knappar fokus vid tryck.
 * Ett tryck på ett alternativ blurrar det med `relatedTarget: null` före
 * klicket, och en lyssnare som stängde listan då lät klicket landa på en dold
 * knapp. `null` betyder "vet ej", inte "utanför".
 */
describe("på en platta där knappar inte får fokus", () => {
  test("ett tryck i listan stänger den inte i förtid", async () => {
    const panel = panelWith({ title: { sv: "Tack" } });

    toggle(panel, "title")!.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    const option = options(panel, "title")[0]!;

    option.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));

    expect(option.closest<HTMLElement>("[data-answer-menu]")!.hidden, "listan stängdes av blur utan mottagare").toBe(false);

    option.click();

    expect(field(panel, "title")!.value).toContain("{{namn}}");
  });

  test("ett tryck utanför stänger den — även utan fokusflytt", async () => {
    const panel = panelWith({ title: { sv: "Tack" } });

    toggle(panel, "title")!.click();
    const menu = field(panel, "title")!.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;

    expect(menu.hidden).toBe(false);

    text(panel, "title").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));

    expect(menu.hidden).toBe(true);
  });
});

/*
 * Johans mätning på enheten (31/8): *"när jag trycker på var-knappen tappar
 * rutan sitt fokus — därför fungerar det inte."* Knappen och listans val tar
 * emot klicket utan att ta fokus, så markören står kvar i texten genom hela
 * valet och plattans tangentbord fälls inte ihop.
 */
describe("knappen stjäl aldrig fokus från texten", () => {
  test("texten blurras inte av vare sig knappen eller valet", async () => {
    const panel = panelWith({ title: { sv: "Hej du" } });
    const editable = text(panel, "title");

    editable.focus();
    await userEvent.keyboard("{Home}{ArrowRight}{ArrowRight}{ArrowRight}");

    let blurred = 0;
    editable.addEventListener("blur", () => { blurred += 1; });

    await userEvent.click(toggle(panel, "title")!);
    await userEvent.click(options(panel, "title")[0]!);

    expect(blurred, "texten tappade fokus under valet").toBe(0);
    expect(field(panel, "title")!.value).toBe("Hej{{namn}} du");
  });

  /*
   * Pekaren ska inte få fokus flyttat åt sig, men TANGENTBORDET ska: Enter och
   * Space ger ett klick utan koordinater (detail === 0), och då går fokus in i
   * listan — annars står en tangentbordsanvändare utanför en öppnad meny.
   */
  test("tangentbordet får fortfarande fokus in i listan", async () => {
    const panel = panelWith({ title: { sv: "Hej" } });

    toggle(panel, "title")!.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));

    expect(field(panel, "title")!.shadowRoot!.activeElement?.getAttribute("data-insert")).toBe("namn");
  });
});

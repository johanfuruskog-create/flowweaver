import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/*
 * Svarsalternativens rader i 380-panelen, sedda i Fias efter-bilder 28/9
 * kväll och rättade av Fable (två vändor, sedan Fable): (1) en ÖPPEN rad
 * med lång etikett och långt lagringsvärde sprängde kortets högerkant —
 * fältet, lagringsvärdesraden och hjälptexten gick ut över panelens kant;
 * (2) "Alternativ N · chip" rymdes bara på varannan rad, så hälften bröt
 * efter punkten med en hängande "·"; (3) reglaget "Villkorsstyrd
 * synlighet" stod i versaler bredvid "Utesluter andra val" i meningsstil.
 * Alla tre mäts här mot renderad DOM, inte mot bilden.
 */

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const LONG = "En mycket lång etikett som beskriver ett ovanligt specifikt fel i detalj";

const graph: GraphData = {
  startNodeId: "fit-q",
  settings: { sourceLocale: "sv" },
  nodes: [
    {
      id: "fit-q",
      type: "multi-choice",
      position: { x: 40, y: 40 },
      data: {
        title: "Vad gäller felet?",
        variableName: "fel",
        options: [
          { id: "fit-1", label: "Belysning", value: "belysning" },
          { id: "fit-2", label: "Väg eller trottoar", value: "vag" },
          { id: "fit-3", label: LONG, value: "lang-etikett-ett-med-ett-langt-varde" },
          { id: "fit-4", label: "Klotter", value: "klotter" },
        ],
      },
    },
  ],
  connections: [],
} as never;

async function mount(): Promise<{ editor: GuideEditor; host: HTMLElement; panel: ShadowRoot }> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  // 380 px panel is the product's own width; the rest is canvas.
  editor.style.cssText = "display: block; width: 1000px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(graph) as never;
  await settle();
  await settle();
  (editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById(id: string): void }).selectNodeById("fit-q");
  await settle();
  await settle();
  const host = editor.shadowRoot!.querySelector<HTMLElement>("properties-panel")!;

  return { editor, host, panel: host.shadowRoot! };
}

const row = (panel: ShadowRoot, id: string) => panel.querySelector<HTMLElement>(`.properties-panel__option[data-option-id="${id}"]`)!;

afterEach(() => document.body.replaceChildren());

describe("svarsalternativens rader ryms i 380-panelen", () => {
  test("en öppen rad med lång etikett och långt värde håller sig inom kortets och panelens kant", async () => {
    const { host, panel } = await mount();
    const long = row(panel, "fit-3");

    long.querySelector<HTMLElement>('[data-action="toggle-option"]')!.click();
    await settle();
    expect(long.hasAttribute("data-option-open"), "raden är öppen").toBe(true);

    const card = long.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();


    expect(card.right, "kortet går inte utanför panelen").toBeLessThanOrEqual(hostBox.right + 0.5);
    for (const el of long.querySelectorAll<HTMLElement>("*")) {
      const box = el.getBoundingClientRect();

      if (box.width === 0) continue;
      expect(box.right, `${el.className || el.tagName} går inte utanför kortet`).toBeLessThanOrEqual(card.right + 0.5);
    }
  });

  /*
   * Johans förenkling, Astras vända 5 (28/9): ersätter allt tidigare om
   * chip och utfällbar inställning. Ett stängt kort visar bara namn,
   * position och kontroller. Öppnat visar lagringsvärdet EXAKT en gång,
   * som ett vanligt fält — ingen chip, ingen utfällning, ingen ikon.
   */
  test("stängt kort saknar lagringsvärdet; öppnat visar det exakt en gång, som ett vanligt fält", async () => {
    const { panel } = await mount();

    for (const id of ["fit-1", "fit-2", "fit-3", "fit-4"]) {
      const card = row(panel, id);

      expect(card.querySelector("[data-option-value]"), `${id}: inget lagringsvärde stängt`).toBeNull();
      expect(card.querySelector("code"), `${id}: ingen chip alls`).toBeNull();

      card.querySelector<HTMLElement>('[data-action="toggle-option"]')!.click();
      await settle();

      const valueInputs = [...card.querySelectorAll<HTMLInputElement>('[data-option-property="value"]')];

      expect(valueInputs, `${id}: värdet exakt en gång öppnat`).toHaveLength(1);
      expect(card.querySelector('[data-action="toggle-option-value"]'), `${id}: ingen utfällning kvar`).toBeNull();
    }
  });

  test("de två reglagens etiketter har samma stil", async () => {
    const { panel } = await mount();
    const first = row(panel, "fit-1");

    first.querySelector<HTMLElement>('[data-action="toggle-option"]')!.click();
    await settle();
    const exclusive = first.querySelector<HTMLElement>('.properties-panel__option-exclusive')!;
    const visibility = first.querySelector<HTMLElement>('.properties-panel__option-visibility label, .properties-panel__option-visibility span')!;
    const exclusiveText = [...exclusive.querySelectorAll<HTMLElement>("span, small")].find((n) => (n.textContent ?? "").trim()) ?? exclusive;
    const visibilityText = visibility.querySelector<HTMLElement>("span") ?? visibility;

    expect(getComputedStyle(visibilityText).textTransform, "villkorsstyrd synlighet: ingen versal").toBe(getComputedStyle(exclusiveText).textTransform);
    expect(getComputedStyle(visibilityText).fontSize).toBe(getComputedStyle(exclusiveText).fontSize);
  });

  /*
   * Astras vända 5, punkt 2 (28/9): stängda kort såg "avbrutna" ut vid
   * nederkanten mot öppna korts hela ram. Mätt: kroppen bidrar 0 höjd
   * stängd, så huvudet fyller nästan hela kortet men bar bara sin gamla,
   * alltid-topprundade radie — dess tonade yta hade fyra skarpa nedre
   * hörn liggande inuti kortets runda i stället för att själva vara
   * kortets form. Huvudets radie växlar nu med `[data-option-open]`: hela
   * kortets radie stängd (huvudet ÄR hela den synliga formen), bara
   * övre hörnen öppen (kroppen tar vid och bär kortets egen botten).
   */
  test("stängt kort har konsekventa hörn, samma radie som kortet", async () => {
    const { panel } = await mount();
    const closed = row(panel, "fit-1");
    const header = closed.querySelector<HTMLElement>(".properties-panel__option-header")!;

    expect(closed.hasAttribute("data-option-open"), "kortet är stängt").toBe(false);
    expect(getComputedStyle(header).borderRadius).toBe(getComputedStyle(closed).borderRadius);

    header.querySelector<HTMLElement>('[data-action="toggle-option"]')!.click();
    await settle();
    expect(getComputedStyle(header).borderRadius, "öppet: bara övre hörnen, kroppen bär botten").not.toBe(getComputedStyle(closed).borderRadius);
  });

  /*
   * Astras vända 5, punkt 3 (28/9): namnet ska vara kortets första
   * läspunkt, i `--fw-text` — inte `--fw-text-strong` (trots namnet en
   * dämpad roll, mätt i flowweaver-design-skillen). Genuint fynd under
   * samma mätning: `.properties-panel__option-header` är ett klassnamn
   * regel-/uträkningseditorns numrerade rader (Siv, 1b) ÄVEN äger, och
   * dess `.properties-panel__option-header strong { color: var(--fw-text-
   * secondary) }` matchade titelns `<strong>` här också — en led mer
   * specificitet än en ensam klass. Titeln renderade `--fw-text-secondary`
   * tyst sedan första vändan. Sett falla mot den oskopade regeln.
   */
  test("alternativets namn har panelens mörkaste textroll, inte en delad rad-regel", async () => {
    const { panel } = await mount();
    const title = row(panel, "fit-1").querySelector<HTMLElement>(".properties-panel__option-title")!;
    // Jämför mot det faktiska tokenvärdet, inte en literal hex — ett
    // förfalskat prov om paletten någonsin ändrar --fw-text.
    const probe = document.createElement("span");

    title.appendChild(probe);
    probe.style.color = "var(--fw-text)";
    expect(getComputedStyle(title).color).toBe(getComputedStyle(probe).color);
    probe.remove();
  });

  /*
   * Mutationskontroll 29/9 (Per), lucka 2 från vända 5: Astras punkt 3
   * (1804e34f) mätte "Ta bort alternativ" mot editorns andra destruktiva
   * kontroller — `.properties-panel__remove-option` och nodmenyns "Ta
   * bort nod"/"Ta bort koppling" — och fann att ingen av dem sätter en
   * egen `font-weight`; bara "Ta bort alternativ" hade en tillagd
   * `--fw-weight-strong`, struken där. Inget prov läste den vikten sedan
   * — mätt mot en mutation som gjorde den fet igen, ingenting föll. Detta
   * jämför den RENDERADE vikten mot nodmenyns "Ta bort nod", inte en
   * literal siffra, så en delad tokenändring aldrig gör provet falskt.
   */
  test("Ta bort alternativ har samma vikt som nodmenyns Ta bort nod, inte fet", async () => {
    const { editor, panel } = await mount();

    row(panel, "fit-1").querySelector<HTMLElement>('[data-action="toggle-option"]')!.click();
    await settle();
    const removeOption = row(panel, "fit-1").querySelector<HTMLButtonElement>('[data-action="remove-option"]')!;
    // Läst direkt: att öppna nodens egen meny (nedan) ritar om hela guide-
    // editor-trädet, och en sparad elementreferens från INNAN dess är
    // frånkopplad DOM — getComputedStyle på den ger en tom sträng, inte
    // det som faktiskt stod på skärmen.
    const optionWeight = getComputedStyle(removeOption).fontWeight;

    const nodeEditor = editor.shadowRoot!.querySelector("node-editor")!;
    const node = [...nodeEditor.shadowRoot!.querySelectorAll<HTMLElement>("flow-node")].find(
      (candidate) => (candidate as unknown as { nodeId?: string }).nodeId === "fit-q",
    )!;

    node.shadowRoot!.querySelector<HTMLButtonElement>("[data-node-menu]")!.click();
    await settle();
    const removeNode = nodeEditor.shadowRoot!.querySelector<HTMLButtonElement>('button[data-action="remove-node"]')!;

    expect(removeNode, "nodmenyns Ta bort nod hittades").not.toBeNull();
    expect(optionWeight, "samma vikt som nodmenyns Ta bort nod").toBe(getComputedStyle(removeNode).fontWeight);
  });

  /*
   * Ledarens vända 5 (28/9): chevronen var tecknet "⌄" — lästes som en
   * liten bokstav, inte tydligt skild från flyttpilarna ↑ ↓. Ritad i
   * stället, som plusmenyns bricka och verktygsradens menyer (samma
   * `chevron.drawn`/`chevron.open`-mixin, `_chevron.scss`). Mätt: den
   * ritade formen (7×7 + 2px kant, roterad 45°) ger en 12,7×12,7 px
   * bounding box — identisk med verktygsradens egen (samma mixin,
   * omätt skalad), så konsekvensen med resten av appen är den verkliga
   * måttstocken, inte ett löst "~18–20 px".
   */
  /*
   * Konceptbild 2 (Johans mått, 29/9): "Tydliga SVG-ikoner för ↑ ↓ ⌄ i
   * samma storlek (~20 px), samma linjetjocklek som övriga gränssnitts-
   * ikoner" — ersätter både tecknen (↑ ↓) och förra vändans ritade
   * CSS-chevron (af6948df) med riktiga SVG:er, samma familj som "Ta bort
   * alternativ"s papperskorg (stroke-width 2, 24×24 viewBox).
   */
  test("flytt- och chevronikonerna är SVG:er i samma storlek, chevronen roterar med aria-expanded", async () => {
    const { panel } = await mount();
    const card = row(panel, "fit-1");
    const chevron = card.querySelector<SVGElement>(".properties-panel__option-chevron")!;
    const upIcon = card.querySelector<SVGElement>('[data-action="move-option-up"] svg')!;
    const downIcon = card.querySelector<SVGElement>('[data-action="move-option-down"] svg')!;
    const toggle = card.querySelector<HTMLElement>('[data-action="toggle-option"]')!;

    expect(chevron.tagName, "SVG, inte ett tecken").toBe("svg");

    const chevronBox = chevron.getBoundingClientRect();
    const upBox = upIcon.getBoundingClientRect();
    const downBox = downIcon.getBoundingClientRect();

    // Johans mått: ~20 px, samma för alla tre.
    for (const [name, box] of [["chevron", chevronBox], ["upp", upBox], ["ned", downBox]] as const) {
      expect(box.width, `${name}: ~20px bred`).toBeGreaterThanOrEqual(17);
      expect(box.width, `${name}: ~20px bred`).toBeLessThanOrEqual(21);
      expect(Math.abs(box.width - box.height), `${name}: kvadratisk`).toBeLessThan(0.5);
    }
    // Alla tre exakt samma storlek som varandra — inte bara var för sig i
    // intervallet.
    expect(Math.abs(chevronBox.width - upBox.width), "chevron och pilar samma storlek").toBeLessThan(0.5);

    // `getComputedStyle()` returns a LIVE object — läs strängen ut direkt,
    // annars läser jämförelsen efter klicket samma (då redan ändrade)
    // objekt på båda sidor och ett prov som borde falla gör det aldrig.
    const closedTransform = getComputedStyle(chevron).transform;

    toggle.click();
    await settle();
    const openTransform = getComputedStyle(chevron).transform;

    expect(openTransform, "chevronen roterar när raden öppnas").not.toBe(closedTransform);
  });

  /*
   * Ledarens samordning med Ted (29/9): positionen ("Alternativ N") är
   * inte längre synlig text i huvudet — ett TOMT, dolt-men-läst span
   * (samma klipp-teknik som guide-versions__announce) sitter i rubriken
   * för Ted/Siv att fylla. Ted fyller det (29/9): "Alternativ N, ", läst
   * före namnet.
   */
  test("ett dolt data-option-position-span i rubriken läser Alternativ N", async () => {
    const { panel } = await mount();
    const position = row(panel, "fit-1").querySelector<HTMLElement>("[data-option-position]")!;

    expect(position, "spanet finns").not.toBeNull();
    expect(position.textContent).toBe("Alternativ 1, ");
    expect(getComputedStyle(position).clipPath, "dold med clip-path, inte display: none").not.toBe("none");
  });

  /*
   * Konceptbild 2: namnet klipper med ellipsis i stängt läge (en rad),
   * med en tooltip (byggd statisk och stängd, Ted kopplar visningen) för
   * att läsa hela namnet. Inget färdigt tooltip-mönster hittades att
   * återanvända någonstans i editorn (mätt, se properties-panel.scss).
   */
  test("namnet klipper med ellipsis och en kopplad, stängd tooltip finns", async () => {
    const { panel } = await mount();
    const long = row(panel, "fit-3");
    const title = long.querySelector<HTMLElement>("[data-option-title]")!;
    const toggle = long.querySelector<HTMLElement>('[data-action="toggle-option"]')!;
    const tooltipId = toggle.getAttribute("aria-describedby")!;
    const tooltip = long.querySelector<HTMLElement>(`#${tooltipId}`)!;

    expect(title.scrollWidth, "klippt — scrollWidth > clientWidth").toBeGreaterThan(title.clientWidth);
    expect(getComputedStyle(title).textOverflow).toBe("ellipsis");
    expect(tooltip, "tooltipen finns och är kopplad via aria-describedby").not.toBeNull();
    expect(tooltip.hasAttribute("hidden"), "stängd som viloläge — Ted kopplar visningen").toBe(true);
    expect(tooltip.getAttribute("role")).toBe("tooltip");
  });

  /*
   * Konceptbild 2: samma kompakta huvudhöjd öppet och stängt — avdelaren
   * mot kroppen flyttade till kroppens egen `border-top` för att aldrig
   * påverka huvudets box.
   */
  test("huvudets höjd är identisk öppet och stängt", async () => {
    const { panel } = await mount();
    const card = row(panel, "fit-1");
    const header = card.querySelector<HTMLElement>(".properties-panel__option-header")!;
    const closedHeight = header.getBoundingClientRect().height;

    card.querySelector<HTMLElement>('[data-action="toggle-option"]')!.click();
    await settle();
    const openHeight = header.getBoundingClientRect().height;

    expect(Math.abs(openHeight - closedHeight), "samma huvudhöjd").toBeLessThan(0.5);
  });

  /*
   * Konceptbild 2: etikettfältet är en textarea som växer i höjd i
   * stället för ett en-radigt fält.
   */
  test("svarsalternativets fält är en textarea", async () => {
    const { panel } = await mount();
    const card = row(panel, "fit-1");

    card.querySelector<HTMLElement>('[data-action="toggle-option"]')!.click();
    await settle();
    const field = card.querySelector<HTMLTextAreaElement>('[data-option-property="label"]')!;

    expect(field.tagName).toBe("TEXTAREA");
    expect(field.value).toBe("Belysning");
  });

  /*
   * Ledarens fynd (29/9): texten i svarsalternativets textarea såg
   * mindre/fetare ut än lagringsvärdets fält, trots identisk
   * getComputedStyle (samma font-size/weight/family/line-height/padding,
   * uppmätt). Den verkliga orsaken: `rows="1"` gav en fast, för kort låda
   * — en radbruten etikett klipptes av webbläsarens egen textarea-scroll
   * (scrollHeight > clientHeight), och två hoptryckta rader bakom en
   * enda rads klipphöjd LÄSTES som mindre/tätare text fast typsnittet
   * aldrig ändrades. `field-sizing: content` löser klippningen.
   */
  test("svarsalternativets textarea klipper inte en radbruten etikett", async () => {
    const { panel } = await mount();
    const long = row(panel, "fit-3");

    long.querySelector<HTMLElement>('[data-action="toggle-option"]')!.click();
    await settle();
    const field = long.querySelector<HTMLTextAreaElement>('[data-option-property="label"]')!;
    const valueInput = long.querySelector<HTMLInputElement>('[data-option-property="value"]')!;

    expect(field.scrollHeight, "hela den radbrutna texten ryms, ingen scroll").toBeLessThanOrEqual(field.clientHeight + 1);

    // Samma textstil som fältet under, som ledaren bad om — kontrollerat
    // på nytt efter fixet, inte bara antaget.
    const fieldCs = getComputedStyle(field);
    const valueCs = getComputedStyle(valueInput);

    expect(fieldCs.fontSize).toBe(valueCs.fontSize);
    expect(fieldCs.fontWeight).toBe(valueCs.fontWeight);
    expect(fieldCs.fontFamily).toBe(valueCs.fontFamily);
    expect(fieldCs.lineHeight).toBe(valueCs.lineHeight);
    expect(fieldCs.padding).toBe(valueCs.padding);
  });
});

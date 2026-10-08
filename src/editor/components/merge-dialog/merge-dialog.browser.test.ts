import { afterEach, describe, expect, test } from "vitest";

import "./merge-dialog";

import { GuideMergeService } from "../../../viewer/services/guide-merge-service";

import type { MergeDialog } from "./merge-dialog";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Rutan där två redaktörers arbete slås ihop (berättelse 131, kriterium 3).
 *
 * ## Varför i en riktig webbläsare
 *
 * Allt som mäts här är sådant en attrapp svarar fel på: att en `<dialog>` är
 * modal, att en knapp har en yta att träffa (K6), att `aria-disabled` sitter
 * på det som faktiskt vägrar, och att det som sägs om hur många val som
 * återstår står i DOM:en och inte i ett tillstånd bara koden ser.
 *
 * ## Mutationerna kontrollerna skrevs mot
 *
 *  - `aria-disabled` sätts aldrig → *Bekräfta* går att trycka på med ett
 *    obesvarat val, och sammanslagningen byggs på en gissning;
 *  - raden om hur många som återstår skrivs inte → knappen vägrar utan att
 *    säga varför, vilket är knappen man trycker på fem gånger;
 *  - meningarna skrivs med `innerHTML` → en rubrik med en tagg i blir ett
 *    element (K11).
 */

const guide = (): GraphData =>
  ({
    startNodeId: "q1",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Boendeform" }, variableName: "boende", options: [] },
      },
      {
        id: "r1",
        type: "result",
        position: { x: 300, y: 0 },
        data: { title: { sv: "Kontaktuppgifter" } },
      },
    ],
    connections: [],
  }) as unknown as GraphData;

const after = (change: (graph: GraphData) => void): GraphData => {
  const copy = JSON.parse(JSON.stringify(guide())) as GraphData;

  change(copy);

  return copy;
};

const titleTo = (graph: GraphData, id: string, text: string): void => {
  const node = graph.nodes.find((one) => one.id === id)!;

  (node.data as Record<string, unknown>).title = { sv: text };
};

let dialog: MergeDialog | null = null;

const open = (theirs: GraphData, mine: GraphData, name = "Anna Andersson") => {
  dialog = document.createElement("merge-dialog") as MergeDialog;
  dialog.editorLocale = "sv";
  document.body.append(dialog);

  const plan = GuideMergeService.plan(guide(), theirs, mine);
  const answer = dialog.ask({ plan, name });
  const root = dialog.shadowRoot!;

  return { plan, answer, root };
};

afterEach(() => {
  dialog?.remove();
  dialog = null;
});

const row = (root: ShadowRoot, id: string): HTMLElement =>
  root.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`)!;

describe("rutan som slår ihop två redaktörers arbete", () => {
  test("två spalter, med den andres namn över sin", () => {
    const { root } = open(
      after((graph) => titleTo(graph, "q1", "Hur bor du?")),
      after((graph) => titleTo(graph, "r1", "Så når du oss")),
    );

    const labels = [...root.querySelectorAll(".merge-dialog__column-label")].map((one) =>
      (one.textContent ?? "").trim(),
    );

    expect(labels).toContain("Anna Andersson ändrade");
    expect(labels).toContain("Du ändrade");
  });

  /*
   * Det vanliga fallet, och hela skälet berättelsen finns. Raden ska säga det
   * i klartext — *noll val* är inte något man ska behöva läsa sig till ur en
   * tom lista.
   */
  test("utan krockar finns inget att välja, och rutan säger det", () => {
    const { root } = open(
      after((graph) => titleTo(graph, "q1", "Hur bor du?")),
      after((graph) => titleTo(graph, "r1", "Så når du oss")),
    );

    expect(root.querySelector("[data-count]")?.textContent).toBe(
      "Ni har ändrat olika saker. Allt följer med — inget att välja.",
    );
    expect(root.querySelector<HTMLElement>("[data-overlaps]")?.hidden).toBe(true);
    expect(root.querySelector('[data-action="confirm"]')?.getAttribute("aria-disabled")).toBe(
      "false",
    );
  });

  test("en krock står överst, med två knappar och ingen förvald", () => {
    const { root } = open(
      after((graph) => titleTo(graph, "q1", "Hur bor du?")),
      after((graph) => titleTo(graph, "q1", "Var bor du?")),
    );

    const picks = [...row(root, "content:q1").querySelectorAll<HTMLElement>("[data-pick]")];

    expect(picks.map((one) => one.textContent?.trim())).toEqual(["Anna Anderssons", "Min"]);
    expect(
      picks.map((one) => one.getAttribute("aria-checked")),
      "ingen förvald: en förvald sida är den som väljs av den som inte läste",
    ).toEqual(["false", "false"]);
  });

  /*
   * Ingen bekräftelse förrän varje överlapp har ett val, och **raden säger hur
   * många som återstår**. Båda, för de gör olika saker: attributet hindrar,
   * meningen förklarar.
   */
  test("Bekräfta vägrar tills varje krock har ett svar, och säger hur många", async () => {
    const { root, answer } = open(
      after((graph) => {
        titleTo(graph, "q1", "Hur bor du?");
        titleTo(graph, "r1", "Så når du oss");
      }),
      after((graph) => {
        titleTo(graph, "q1", "Var bor du?");
        titleTo(graph, "r1", "Kontakta oss");
      }),
    );

    const confirm = root.querySelector<HTMLButtonElement>('[data-action="confirm"]')!;

    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    expect(root.querySelector("[data-count]")?.textContent).toBe("2 val kvar att göra.");

    confirm.click();
    await Promise.resolve();

    expect(
      root.querySelector("dialog")?.open,
      "ett tryck med obesvarade val stänger ingenting",
    ).toBe(true);

    row(root, "content:q1").querySelector<HTMLButtonElement>('[data-pick="theirs"]')!.click();

    expect(root.querySelector("[data-count]")?.textContent).toBe("1 val kvar att göra.");
    expect(confirm.getAttribute("aria-disabled")).toBe("true");

    row(root, "content:r1").querySelector<HTMLButtonElement>('[data-pick="mine"]')!.click();

    expect(root.querySelector("[data-count]")?.textContent).toBe("Allt är valt.");
    expect(confirm.getAttribute("aria-disabled")).toBe("false");

    confirm.click();

    await expect(answer).resolves.toEqual({ "content:q1": "theirs", "content:r1": "mine" });
  });

  /* Den valda sidan syns, och färgen bär den aldrig ensam (K3). */
  test("det valda står i aria-checked och inte bara i färgen", () => {
    const { root } = open(
      after((graph) => titleTo(graph, "q1", "Hur bor du?")),
      after((graph) => titleTo(graph, "q1", "Var bor du?")),
    );

    row(root, "content:q1").querySelector<HTMLButtonElement>('[data-pick="mine"]')!.click();

    const picks = [...row(root, "content:q1").querySelectorAll<HTMLElement>("[data-pick]")];

    expect(picks.map((one) => one.getAttribute("aria-checked"))).toEqual(["false", "true"]);
  });

  /* En rad båda gjort likadant: syns, dämpad, utan val. */
  test("samma ändring av båda står kvar utan knappar", () => {
    const same = (graph: GraphData) => titleTo(graph, "q1", "Hur bor du?");
    const { root } = open(after(same), after(same));

    const item = row(root, "content:q1");

    expect(item.dataset.resolved).toBe("true");
    expect(item.querySelectorAll("[data-pick]")).toHaveLength(0);
    expect(item.querySelector(".merge-dialog__resolved")?.textContent).toBe(
      "Ni gjorde samma ändring.",
    );
  });

  /*
   * K11: en rubrik någon skrivit i ett fält är text, aldrig markup. Samma
   * fall som anteckningen i 130, sett falla då med `innerHTML`.
   */
  test("en tagg i en rubrik blir tecken, aldrig ett element", () => {
    const { root } = open(
      after((graph) => titleTo(graph, "q1", "<b>Fetstil</b> ska synas")),
      after((graph) => titleTo(graph, "r1", "Så når du oss")),
    );

    const title = [...root.querySelectorAll(".merge-dialog__row-title")].find((one) =>
      (one.textContent ?? "").includes("Fetstil"),
    )!;

    expect(title.children).toHaveLength(0);
    expect(title.textContent).toContain("<b>Fetstil</b>");
  });

  /*
   * Markeringen hör till **kravet på ett svar**, inte till raden.
   *
   * Den satt på `:not([data-resolved])` först, vilket gjorde varenda rad under
   * *Följer med* gul — en lista där allt larmar säger ingenting om vad som
   * behöver göras. Hittat i en bild, inte i sviten: testerna frågade om
   * knapparna och inte om ytan.
   *
   * Mätt som **färg** och inte som attribut, av samma skäl som PRAXIS 36 mäter
   * rutan och inte flaggan: en regel som ritar fel gör det med attributet rätt
   * satt hela tiden.
   */
  test("bara raderna som kräver ett svar är markerade", () => {
    const { root } = open(
      after((graph) => {
        titleTo(graph, "q1", "Hur bor du?");
        titleTo(graph, "r1", "Så når du oss");
      }),
      after((graph) => titleTo(graph, "q1", "Var bor du?")),
    );

    const ytan = (selector: string): string =>
      getComputedStyle(root.querySelector<HTMLElement>(selector)!).backgroundColor;

    const krock = ytan("[data-overlaps-list] [data-row]");
    const följer = ytan("[data-rest-list] [data-row]");

    expect(krock, "krocken saknar markering").not.toBe(följer);
    expect(följer, "en rad som följer med ska inte larma").toMatch(
      /rgba\(0, 0, 0, 0\)|transparent/,
    );

    /* Och markeringen går när raden är besvarad: en genomläst lista larmar
       inte lika mycket som en orörd. */
    row(root, "content:q1").querySelector<HTMLButtonElement>('[data-pick="mine"]')!.click();

    expect(ytan("[data-overlaps-list] [data-row]")).toBe(följer);
  });

  /*
   * **Raden visar vad var och en skrev** (Johans mätning 20/9).
   *
   * Båda spalterna sa *rubriken har ändrats*, och skillnaden var ett enda ord
   * inbakat i en lång mening — valet gjordes i blindo. Nu står texterna under
   * varandra i var sin spalt.
   *
   * Mutationen som fäller det: sluta bära `after` vidare i `plan`, eller
   * sluta rita den i `column`.
   */
  test("en överlapp visar båda sidornas nya text, inte bara att något ändrats", () => {
    const { root } = open(
      after((graph) => titleTo(graph, "q1", "Vad behöver du hjälp med just i dag?")),
      after((graph) => titleTo(graph, "q1", "Vad behöver du hjälp med i dag?")),
    );

    const texter = [...row(root, "content:q1").querySelectorAll(".merge-dialog__value")].map(
      (one) => (one.textContent ?? "").trim(),
    );

    expect(texter).toEqual([
      "Vad behöver du hjälp med just i dag?",
      "Vad behöver du hjälp med i dag?",
    ]);
  });

  /*
   * **Namnet och beskrivningen står EN gång, inte tre** (`rowHeading`, puts
   * 20/9). Rubriken bär båda — *namn · rubriken har ändrats* — och en spalt
   * med ett nytt värde visar bara det värdet: en `<p>` för spaltens etikett
   * (*Anna Andersson ändrade* / *Du ändrade*) och en för värdet, aldrig en
   * tredje som upprepar meningen `rowHeading` redan klippte in i rubriken.
   *
   * Mutationen som fäller det: rita `line.message` i en egen `<p>` innan (eller
   * i stället för) `line.after`-värdet i `column()` — spalten får då tre
   * stycken, och rubriken och den första raden säger samma sak igen.
   */
  test("radens rubrik bär namn och beskrivning en gång — spalten upprepar den inte", () => {
    const { root } = open(
      after((graph) => titleTo(graph, "q1", "Vad behöver du hjälp med just i dag?")),
      after((graph) => titleTo(graph, "q1", "Vad behöver du hjälp med i dag?")),
    );

    const item = row(root, "content:q1");

    expect(item.querySelector(".merge-dialog__row-title")?.textContent).toBe(
      "Vad behöver du hjälp med just i dag? · rubriken har ändrats.",
    );

    const columns = [...item.querySelectorAll(".merge-dialog__column")];

    /* Etikett + värde, aldrig en tredje paragraf med `line.message`. */
    expect(columns.map((column) => column.querySelectorAll("p").length)).toEqual([2, 2]);
  });

  /*
   * Och hela texten står i DOM:en. Klippningen är stilmallens, så den som
   * lyssnar får meningen hel — en sträng klippt i koden hade varit klippt för
   * alla.
   */
  test("och hela texten står kvar, också när den är för lång för rutan", () => {
    const lång = `Det här är en resultattext som en redaktör faktiskt skriver: ${"ord ".repeat(60)}slut.`;
    const { root } = open(
      after((graph) => titleTo(graph, "q1", lång)),
      after((graph) => titleTo(graph, "q1", "Kort.")),
    );

    const värde = row(root, "content:q1").querySelector<HTMLElement>(".merge-dialog__value")!;

    expect(värde.textContent).toBe(lång);
    expect(värde.title, "och musen når den också").toBe(lång);
    expect(
      värde.getBoundingClientRect().height,
      "men rutan växer inte med texten",
    ).toBeLessThan(120);
  });

  /*
   * Borttagen mot ändrad: den ena sidan har ingen text att visa — *steget har
   * tagits bort* är hela ändringen — och den andra har sin.
   */
  test("borttagen mot ändrad visar borttagningen mot den nya texten", () => {
    const { root } = open(
      after((graph) => {
        graph.nodes = graph.nodes.filter((node) => node.id !== "r1");
      }),
      after((graph) => titleTo(graph, "r1", "Så når du oss")),
    );

    const rad = row(root, "node:r1");
    const spalter = [...rad.querySelectorAll(".merge-dialog__column")];

    expect(spalter[0]!.textContent).toContain("tagits bort");
    expect(spalter[0]!.querySelector(".merge-dialog__value"), "inget värde att visa").toBeNull();
    expect(spalter[1]!.querySelector(".merge-dialog__value")?.textContent).toBe("Så når du oss");
  });

  /* K6: varje knapp i rutan går att träffa med en tumme. */
  test("varje knapp har en yta som går att träffa", () => {
    const { root } = open(
      after((graph) => titleTo(graph, "q1", "Hur bor du?")),
      after((graph) => titleTo(graph, "q1", "Var bor du?")),
    );

    const small = [...root.querySelectorAll<HTMLElement>("button")]
      .map((one) => [one.textContent?.trim(), Math.round(one.getBoundingClientRect().height)])
      .filter(([, height]) => Number(height) < 44);

    expect(small).toEqual([]);
  });

  /*
   * **Dubbel luft före knapparna** (Johans ja 20/9, mätt först: rubrik →
   * spalter 8, spalter → knappar 8). Rubriken och spalterna är beviset —
   * vad som hände och vad var och en skrev — och knapparna är valet.
   * Skillens avståndsrecept: besläktade fakta binds med halva avståndet
   * till det som svarar på något annat. Mätt som förhållande, inte pixlar:
   * ett test som kräver exakt 16 är skörare än vad det skyddar.
   *
   * Mutationen som fäller det: ta bort `margin-top` på `.merge-dialog__pick`.
   */
  test("luften före valet är dubbelt den mellan rubrik och spalter", () => {
    const { root } = open(
      after((graph) => titleTo(graph, "q1", "Hur bor du?")),
      after((graph) => titleTo(graph, "q1", "Var bor du?")),
    );

    const krock = row(root, "content:q1");
    const rubrik = krock.querySelector<HTMLElement>(".merge-dialog__row-title")!;
    const spalter = krock.querySelector<HTMLElement>(".merge-dialog__columns")!;
    const val = krock.querySelector<HTMLElement>(".merge-dialog__pick")!;

    const bevis = spalter.getBoundingClientRect().top - rubrik.getBoundingClientRect().bottom;
    const föreValet = val.getBoundingClientRect().top - spalter.getBoundingClientRect().bottom;

    expect(bevis).toBeGreaterThan(0);
    expect(föreValet).toBeCloseTo(bevis * 2, 0);
  });

  /* Vägar som städas bort sägs alltid — aldrig tyst. */
  test("vägar som tas bort räknas upp i rutan", () => {
    const { root } = open(
      after((graph) => titleTo(graph, "q1", "Hur bor du?")),
      after((graph) => titleTo(graph, "r1", "Så når du oss")),
    );

    expect(root.querySelector<HTMLElement>("[data-dropped]")?.hidden).toBe(true);

    dialog!.dropped = 2;

    expect(root.querySelector<HTMLElement>("[data-dropped]")?.hidden).toBe(false);
    expect(root.querySelector("[data-dropped]")?.textContent).toBe(
      "2 vägar tas bort, för att de ledde till steg som inte finns kvar.",
    );
  });

  test("Avbryt svarar med ingenting valt", async () => {
    const { root, answer } = open(
      after((graph) => titleTo(graph, "q1", "Hur bor du?")),
      after((graph) => titleTo(graph, "q1", "Var bor du?")),
    );

    root.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();

    await expect(answer).resolves.toBeNull();
  });

  test("Förhandsgranska från start ber sidan om det, med valen", async () => {
    const { root } = open(
      after((graph) => titleTo(graph, "q1", "Hur bor du?")),
      after((graph) => titleTo(graph, "q1", "Var bor du?")),
    );

    const asked = new Promise<Record<string, unknown>>((resolve) => {
      dialog!.addEventListener("merge-preview-intent", (event) =>
        resolve((event as CustomEvent).detail),
      );
    });

    row(root, "content:q1").querySelector<HTMLButtonElement>('[data-pick="theirs"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="preview-start"]')!.click();

    await expect(asked).resolves.toEqual({ choices: { "content:q1": "theirs" } });
  });
});

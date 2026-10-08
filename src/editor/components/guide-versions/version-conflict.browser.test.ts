import { afterEach, describe, expect, test } from "vitest";

import "./guide-versions";

import type { GuideVersions } from "./guide-versions";

/**
 * Kopiorna som fryses vid en krock (berättelse 131, tillägget 20/9).
 *
 * ## Felet det här är skrivet ur
 *
 * Johan öppnade historiken efter två sammanslagningar och såg fem rader som
 * alla hette *Sparad vid krock* och alla sa *av Anna Andersson* — fast hälften
 * var hans eget arbete. Två fel i ett:
 *
 *  - **`by` var den som slog ihop**, inte den vars arbete kopian bar. Den som
 *    trycker på knappen skriver båda raderna, så en `by` ur sessionen ger den
 *    andres kopia fel namn. Det är värdens halva och mäts i `smoke:storage`
 *    och `smoke:login`.
 *  - **Raden sa inte vems kopia det var**, så två rader på samma minut gick
 *    inte att skilja. Det är den här halvan.
 *
 * ## Varför namnet byggs här och aldrig lagras
 *
 * Raden ska kunna säga *din kopia*, och vem *du* är beror på vem som läser. En
 * etikett lagrad hos värden hade sagt *din* om någon annans arbete första
 * gången en kollega öppnade historiken. Värden säger `by.me`; listan skriver
 * orden.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const SAVED_AT = Date.parse("2026-09-20T01:21:00.000Z");

async function list(...versions: Array<Record<string, unknown>>): Promise<GuideVersions> {
  const element = document.createElement("guide-versions") as GuideVersions;

  element.setAttribute("editor-locale", "sv");
  /* `asked("restore")` kräver att värden ber om åtgärden — utan listan ritas
     ingen knapp alls, och kontrollen hade varit grön av fel skäl. */
  element.actions = ["open", "restore"];
  document.body.append(element);
  element.versions = versions.map((one, index) => ({
    id: `v-${index}`,
    savedAt: SAVED_AT,
    ...one,
  })) as never;
  await settle();

  return element;
}

const headings = (element: GuideVersions): string[] =>
  [...element.shadowRoot!.querySelectorAll(".text")].map((one) =>
    (one.textContent ?? "").trim(),
  );

/**
 * Radens **namndel**, inte hela raden.
 *
 * Knappen bär också namnet — men i den *tillgängliga* texten, inte i den man
 * ser (UX-genomgången 129–131, se `restoreLabels`/`restoreAccessibleLabels`
 * nedan för varför). Det som mäts här är att namndelen inte säger det två
 * gånger — en gång i rubriken och en gång i en *av …*-rad under.
 */
const nameCellText = (element: GuideVersions, index: number): string =>
  [...element.shadowRoot!.querySelectorAll("th.name")][index]!.textContent!
    .replace(/\s+/g, " ")
    .trim();

/** Vad ögat ser på knappen. */
const restoreLabels = (element: GuideVersions): string[] =>
  [...element.shadowRoot!.querySelectorAll('[data-action="restore"]')].map((one) =>
    (one.textContent ?? "").trim(),
  );

/**
 * Vad en skärmläsare hör — namnet, för den som inte har rubriken bredvid sig.
 *
 * Genomgången 129–131 (Johans bild 20/9 08:48): den synliga knappen bar hela
 * *Återställ {ägare} kopia* och tog bredden rubriken behövde för att visa
 * hela sitt eget namn (`td.actions` krymper till knappens innehåll). Ordet
 * ensamt är inte tvetydigt på en krockrad — rubriken har precis sagt vems
 * kopia det är — så namnet flyttade hit.
 */
const restoreAccessibleLabels = (element: GuideVersions): string[] =>
  [...element.shadowRoot!.querySelectorAll('[data-action="restore"]')].map(
    (one) => one.getAttribute("aria-label") ?? "",
  );

describe("kopiorna som fryses vid en krock", () => {
  /*
   * Två rader, samma minut, och de ska gå att skilja utan att någon öppnar
   * dem. Mutationen som fäller det: låt `headingOf` falla igenom till `label`
   * och klockan som förut — då heter båda samma sak.
   */
  test("raden säger vems kopia det är, och de två går att skilja", async () => {
    const element = await list(
      { reason: "conflict", by: { name: "Johan Furuskog", me: false } },
      { reason: "conflict", by: { name: "Anna Andersson", me: true } },
    );

    const namn = headings(element);

    expect(namn[0]).toBe("Sparad vid krock · Johan Furuskogs kopia");
    expect(namn[1]).toBe("Sparad vid krock · din kopia");
    expect(namn[0], "två rader på samma minut som heter samma sak").not.toBe(namn[1]);
  });

  /*
   * Och *av Anna Andersson* står inte kvar bredvid.
   *
   * På en vanlig version betyder det **vem som frös den**. På en krockfrysning
   * är det alltid den som slog ihop — en uppgift som inte hjälper någon — och
   * rubriken säger redan vems arbetet är. En bärare per uppgift.
   */
  test("och metaraden upprepar inte namnet", async () => {
    const element = await list({
      reason: "conflict",
      by: { name: "Johan Furuskog", me: false },
    });

    expect(element.shadowRoot!.querySelector("[data-by]"), "ingen av-rad").toBeNull();
    expect(
      nameCellText(element, 0).match(/Johan Furuskog/g) ?? [],
      "namnet står en gång i namndelen, inte två",
    ).toHaveLength(1);
    expect(nameCellText(element, 0), "och ingen av-rad smyger tillbaka").not.toContain("av ");
  });

  /*
   * Knappen är kort på en krockrad, med flit — och sedan UX-genomgången
   * 129–131 kort på **skärmen**, inte bara kortare än den fulla frasen: Johans
   * bild 20/9 08:48 visade rubriken klippt av knappens bredd. Ett ensamt
   * *Återställ* är inte tvetydigt här, för rubriken har precis sagt vems
   * kopia det är. Namnet står kvar för den som lyssnar, i `aria-label`.
   */
  test("Återställ är kort på skärmen, och bär vems kopia det är för den som lyssnar", async () => {
    const element = await list(
      { reason: "conflict", by: { name: "Johan Furuskog", me: false } },
      { reason: "conflict", by: { name: "Anna Andersson", me: true } },
    );

    expect(restoreLabels(element)).toEqual(["Återställ", "Återställ"]);
    expect(restoreAccessibleLabels(element)).toEqual([
      "Återställ Johan Furuskogs kopia",
      "Återställ din kopia",
    ]);
  });

  /*
   * **Namnet klipps inte i en telefon** (Johans bild 20/9, 390 px).
   *
   * Raden sa *Sparad vid krock · Anna Anderss…*, och då går de två raderna per
   * krock inte att skilja åt — vilket är hela skälet namnet står där. Namnet
   * bryts i stället; höjden är radens att ge.
   *
   * Mätt som **klippning** och inte som en CSS-egenskap: `scrollWidth` större
   * än `clientWidth` är vad ellipsen betyder, och en kontroll som läser
   * `white-space` hade varit grön den dag klippningen kom någon annanstans
   * ifrån.
   *
   * Mutationen som fäller det: ta bort `tr[data-reason="conflict"]`-regeln i
   * stilmallen, eller markören som bär den.
   */
  test("och det klipps inte i en telefon — namnet bryts i stället", async () => {
    /*
     * **Riggen måste framkalla klippningen**, annars mäter kontrollen
     * ingenting. Första försöket satte 340 px och *Anna Andersson*: texten
     * blev 278 px bred och rymdes, så mutationen som tar bort rättningen
     * fällde ingenting alls.
     *
     * Riggens typsnitt är inte sidans (sextonde fallet av grannfrågan, 15/9),
     * så bredden i pixlar går inte att låna från en skärmbild. Ett namn som är
     * för långt för varje rimligt typsnitt, i en smal ruta, framkallar den
     * oavsett: 423 px text i en ruta på 240 med klippningen, 206 utan.
     */
    const långt = "Anna-Charlotta Vidmark-Bergensköld";
    const ruta = document.createElement("div");

    ruta.style.width = "240px";
    document.body.append(ruta);

    const element = document.createElement("guide-versions") as GuideVersions;

    element.setAttribute("editor-locale", "sv");
    element.actions = ["open", "restore"];
    ruta.append(element);
    element.versions = [
      { id: "v-krock", savedAt: SAVED_AT, reason: "conflict", by: { name: långt, me: false } },
      /* En vanlig version med ett namn lika långt — *Version 4* hade varit
         kort nog att rymmas, och kontrollen hade varit grön av fel skäl. */
      { id: "v-vanlig", savedAt: SAVED_AT, label: `Utkast från ${långt}`, by: { name: långt } },
    ] as never;
    await settle();

    const text = (index: number): HTMLElement =>
      [...element.shadowRoot!.querySelectorAll<HTMLElement>(".name .text")][index]!;

    expect(
      text(0).scrollWidth,
      "krockradens namn klipps — och då går de två raderna per krock inte att skilja åt",
    ).toBeLessThanOrEqual(text(0).clientWidth);
    expect(text(0).textContent, "hela namnet står kvar").toContain(långt);

    /*
     * Och en vanlig version klipper fortfarande. Namnet är kort — *Version 4*
     * — brickan ska rymmas bredvid, och raden ska inte bli hög av ett långt
     * filnamn. Utan det här fallet kan rättningen ta med sig varje annan rad i
     * listan utan att något blir rött.
     */
    expect(
      text(1).scrollWidth,
      "en vanlig version klipper som förut",
    ).toBeGreaterThan(text(1).clientWidth);
  });

  /*
   * Hos en värd utan inloggning finns ingen att namnge. Då säger raden en sak
   * mindre — aldrig en genitiv följd av ingenting.
   */
  test("utan namn namnges ingen, och knappen står ändå inte ensam för den som lyssnar", async () => {
    const element = await list({ reason: "conflict" });

    expect(headings(element)).toEqual(["Sparad vid krock"]);
    expect(restoreLabels(element)).toEqual(["Återställ"]);
    expect(restoreAccessibleLabels(element)).toEqual(["Återställ kopian från krocken"]);
  });

  /*
   * Och en vanlig version är orörd: numret namnger den, och *av …* säger vem
   * som frös den. Utan det här fallet kan en ändring i krockraden ta med sig
   * varje annan rad i listan utan att något blir rött.
   */
  test("en vanlig version heter och beter sig precis som förut", async () => {
    const element = await list({ number: 4, by: { name: "Johan Furuskog", me: false } });

    expect(headings(element)).toEqual(["Version 4"]);
    expect(element.shadowRoot!.querySelector("[data-by]")?.textContent).toBe(
      "av Johan Furuskog",
    );
    expect(restoreLabels(element)).toEqual(["Återställ version 4"]);
  });
});

import { describe, expect, test } from "vitest";

import "./guide-versions";
import { expectDrawnCursor } from "../../../testing/drawn-cursor";

import type { GuideVersion, GuideVersions } from "./guide-versions";

/**
 * The list is ours; the storage is the host's. These are the claims that make
 * that split hold.
 */

const VERSIONS: GuideVersion[] = [
  { id: "v3", label: "guide.json", savedAt: 1754400000000, current: true },
  {
    id: "v2",
    label: "guide-0728.json",
    note: "Före regeländringen",
    savedAt: 1753700000000,
  },
  { id: "v1", label: "guide-utkast.json", missing: true },
];

function mount(versions = VERSIONS, locale?: string): GuideVersions {
  const element = document.createElement("guide-versions") as GuideVersions;

  if (locale) {
    element.setAttribute("editor-locale", locale);
  }
  document.body.appendChild(element);
  element.versions = versions;

  return element;
}

const rows = (element: GuideVersions): HTMLTableRowElement[] => [
  ...(element.shadowRoot?.querySelectorAll<HTMLTableRowElement>("tbody tr") ?? []),
];

/**
 * The actions a row offers, in order.
 *
 * They live in the row's menu, and the menu is in the DOM whether it is open or
 * shut — so what a row *offers* can be asked without opening anything. Whether
 * it is reachable is a separate claim, and it has its own tests below.
 */
const buttons = (row: HTMLTableRowElement): string[] =>
  [...row.querySelectorAll<HTMLButtonElement>("[data-action]")].map(
    (button) => button.dataset.action ?? "",
  );

/** The one control on a row: what opens the actions. */
const trigger = (row: HTMLTableRowElement): HTMLButtonElement =>
  row.querySelector<HTMLButtonElement>(".trigger")!;

const menu = (row: HTMLTableRowElement): HTMLElement =>
  row.querySelector<HTMLElement>('[role="menu"]')!;

/**
 * The list, squeezed into a width where the name has to give way.
 *
 * Narrow enough that the six buttons, the file and the date take nearly
 * everything — which is the state a real dialog is in, and the state every
 * assertion about truncation is really about.
 */
function mountNarrow(versions: GuideVersion[], width = "560px"): GuideVersions {
  const element = mount(versions);

  element.style.display = "block";
  element.style.width = width;

  return element;
}

describe("what a row shows", () => {
  /*
   * Two lines, and which is which is the point.
   *
   * The note used to be the row's first words, with the host's name after it.
   * Johan met the result on 17/9 in a 480 px panel: a note of any length pushed
   * *Version 2* and the *Publicerad* badge onto a second line, so the two things
   * that identify a row — which version it is, and whether visitors are reading
   * it — were the two that gave way.
   *
   * The name a host chose is now line one, with the badge anchored to its right.
   * The note is line two, quieter, on one line with the whole of it in `title`.
   */
  test("the host's name is the first line; the note reads under it", () => {
    const row = rows(mount())[1]!;

    expect(row.querySelector(".name .text")?.textContent).toBe("guide-0728.json");
    expect(row.querySelector(".note")?.textContent).toBe("Före regeländringen");
    expect(row.querySelector(".note")?.getAttribute("title")).toBe("Före regeländringen");
  });

  /*
   * Bredderna är de tabellen faktiskt får, inte de lådan är: elementets egen
   * vaddering och ram äter 26 px, och `mountNarrow` sätter bredden på
   * innehållet. 480 px är historikpanelen från i går, 424 px är popovern i
   * editorns rad (450 minus vadderingen) och 336 px är arket på en telefon.
   *
   * Skillnaden var inte akademisk: med 452 i stället för 424 var den här
   * kontrollen grön medan brickan i den riktiga popovern låg på egen rad.
   */
  test.each(["480px", "424px", "336px"])(
    "a long note never pushes the name or the badge off their line (%s)",
    (width) => {
    const long = "Justerad efter remissvaren från bygg- och miljönämnden i mars";
    /*
     * Tre rader och inte en, och det är skillnaden mellan att mäta och att tro
     * sig mäta: åtgärdskolumnen är gemensam för hela tabellen, så en ensam rad
     * utan knapp ger namnet en bredd det aldrig får i en riktig lista. Mätt
     * 18/9 i popovern — där låg brickan 28 px under namnet medan det här testet
     * var grönt.
     */
    const element = mountNarrow(
      [
        { id: "v9", label: "Version 3", note: "Nyare", savedAt: 1754500000000 },
        {
          id: "v8",
          label: "Version 2",
          note: long,
          savedAt: 1754400000000,
          current: true,
        },
        { id: "v7", label: "Version 1", note: "Äldre", savedAt: 1754300000000 },
      ],
      width,
    );
    element.actions = ["open", "restore"] as never;
    /*
     * Sidans egen textstorlek, inte provets. Kolumnbredderna följer texten, och
     * med 16 px i stället för 13,5 var namnet brett nog att brickan fick plats
     * — testet grönt, popovern vikt. Mätt 18/9.
     */
    element.style.fontSize = "13.5px";
    const row = rows(element).find((one) => one.querySelector(".badge"))!;
    const name = row.querySelector<HTMLElement>(".name .text")!;
    const badge = row.querySelector<HTMLElement>(".badge")!;
    const note = row.querySelector<HTMLElement>(".note")!;

    expect(long.length, "lagom lång för att spränga en 480 px panel").toBeGreaterThan(55);
    /*
     * Samma rad, mätt på mitten och inte på överkanten: brickan har egen ram och
     * mindre text, så dess låda är några pixlar lägre än namnets och börjar
     * därför inte på samma pixel. Det som påstås är att de står bredvid
     * varandra, inte att två olika lådor är lika höga.
     */
    const mitt = (element: HTMLElement) => element.offsetTop + element.offsetHeight / 2;

    expect(Math.abs(mitt(badge) - mitt(name)), "Version 2 och Publicerad på samma rad").toBeLessThan(3);
    expect(note.offsetTop, "anteckningen under dem").toBeGreaterThan(name.offsetTop);
    /*
     * En rad, inte "avkortad": i den staplade vyn får anteckningen hela radens
     * bredd och kan mycket väl rymmas. Det som påstås är att den aldrig växer
     * på höjden — och att hela texten finns kvar för den som vill ha den.
     */
    /*
     * Och namnet ryms bredvid brickan. Det gick jämnt upp på fyra pixlar i
     * popovern: *Version 2* kortades till *Versio…* för att märket skulle få
     * plats, alltså byttes radens namn mot dess märke. Brickan är smalare nu.
     */
    expect(name.scrollWidth, "radens namn får plats bredvid brickan").toBeLessThanOrEqual(
      name.clientWidth + 1,
    );
    expect(note.getBoundingClientRect().height, "en rad hög").toBeLessThan(28);
    expect(note.title, "hela anteckningen finns kvar").toBe(long);
  },
  );

  /*
   * Och på telefonen, där raden staplar och panelen tar hela skärmen. Samma
   * påstående, andra layout: det är två olika vägar genom komponentens stilar
   * och bara den ena hade gått att mäta i den andra.
   */
  /*
   * Och regeln bakom det, pinnad för sig.
   *
   * Geometrin i ett prov är inte popoverns: kolumnbredderna följer texten, och
   * de få pixlar som avgör om brickan får plats går inte att återskapa troget i
   * en tom sida. Det som ÄR återskapbart är varför den föll ur raden — en
   * flexrad bryter innan den krymper, så `wrap` betyder att brickan lämnar rad
   * ett så fort namnet är någon pixel för brett. Mätt i popovern 18/9: namnet
   * 68 px, brickan 78, boxen 150.
   */
  test("namnraden bryter aldrig — den krymper", () => {
    const element = mountNarrow([{ id: "v1", label: "Version 2", savedAt: 1, current: true }], "424px");
    const box = rows(element)[0]!.querySelector<HTMLElement>(".namebox")!;
    const text = rows(element)[0]!.querySelector<HTMLElement>(".name .text")!;

    expect(getComputedStyle(box).flexWrap, "bryter man får brickan egen rad").toBe("nowrap");
    expect(getComputedStyle(text).textOverflow, "och namnet kortas i stället").toBe("ellipsis");
  });

  test("och på 390 px, där raden staplar", () => {
    const element = mountNarrow(
      [
        {
          id: "v9",
          label: "Version 2",
          note: "Justerad efter remissvaren från bygg- och miljönämnden i mars",
          savedAt: 1754400000000,
          current: true,
        },
      ],
      "350px",
    );
    const row = rows(element)[0]!;
    const name = row.querySelector<HTMLElement>(".name .text")!;
    const badge = row.querySelector<HTMLElement>(".badge")!;
    const note = row.querySelector<HTMLElement>(".note")!;
    const mitt = (one: HTMLElement) => one.offsetTop + one.offsetHeight / 2;

    expect(Math.abs(mitt(badge) - mitt(name)), "namnet och brickan bredvid varandra").toBeLessThan(3);
    expect(note.offsetTop, "anteckningen under dem").toBeGreaterThan(name.offsetTop);
    expect(note.scrollWidth, "fortfarande en rad").toBeGreaterThan(note.clientWidth);
  });

  test("utan anteckning finns ingen andra rad", () => {
    expect(rows(mount())[0]!.querySelector(".note")).toBeNull();
  });

  test("without a note the host's name is the title", () => {
    expect(rows(mount())[0]!.querySelector(".name .text")?.textContent).toBe("guide.json");
  });

  /*
   * The same name twice is the second copy this codebase keeps being bitten by,
   * and here the two copies are guaranteed equal — so the file only appears
   * when the title is something else.
   */
  test("and then it is not repeated beside itself", () => {
    expect(rows(mount())[0]!.querySelector(".file")).toBeNull();
  });

  /*
   * A version that vanished from the store keeps its place. One that quietly
   * disappeared would look like the tool forgot — and when it is the current
   * one, this row is the only explanation for why nothing is being shown.
   */
  test("a version that is gone says so instead of disappearing", () => {
    const row = rows(mount())[2]!;

    expect(row.dataset.missing).toBe("true");
    expect(row.querySelector(".name .text")?.textContent).toContain("borttagen");
  });

  test("only the published one is marked, and it is marked", () => {
    const marked = rows(mount()).filter((row) => row.dataset.current === "true");

    expect(marked).toHaveLength(1);
    /*
     * One word, in the verb the editor's own CMS uses. It read "Visas för
     * besökare" while the actions were spread across the row and the badge was
     * the only thing telling them apart; the action now sits beside it with its
     * own label, so the pairing is on screen instead of in the wording.
     */
    expect(marked[0]!.querySelector(".badge")?.textContent).toBe("Publicerad");
  });

  /*
   * Luften ovanför första posten, mätt mot luften mellan två poster.
   *
   * Johan såg det skarpt 18/9 kväll: första raden låg för nära det som står
   * ovanför den. Mätt i popovern, i bildpixlar och inte i lådor — lådorna var
   * lika, fem pixlars vaddering på varje rad. Det ögat såg var något annat:
   * under en radskiljare börjar nästa namn åtta pixlar ned, för versalen sitter
   * tre pixlar in i sin radlåda, men under listans översta linje började den
   * publicerade radens bricka direkt. Brickan är 20 px i en 20,5 px hög rad och
   * fyller den, så den publicerade raden bär sitt bläck ända upp i kanten.
   *
   * Kontrollen mäter det i lådor ändå, för det är det DOM:en kan se: första
   * radens namnrad ska börja längre ned i sin cell än en senare rads gör. Två
   * pixlar och inte tre är golvet — påståendet är att luften finns, inte att
   * den är exakt den siffra regeln råkar ha.
   *
   * Den dagen brickan slutar fylla radlådan är regeln överflödig och den här
   * kontrollen är det som säger till.
   */
  test("första posten står längre från listans kant än posterna står från varandra", () => {
    const list = rows(mount());
    const luft = (row: HTMLTableRowElement) =>
      row.querySelector<HTMLElement>(".namebox")!.getBoundingClientRect().top -
      row.getBoundingClientRect().top;

    expect(list[0]!.querySelector(".badge"), "första raden är den publicerade").not.toBeNull();
    expect(luft(list[0]!) - luft(list[1]!)).toBeGreaterThanOrEqual(2);
  });
});

/*
 * En krockfrysning (berättelse 131, tillägget 20/9, putsad i UX-genomgången
 * 129–131): raden säger **vems** kopia det är i stället för en lagrad
 * etikett — vem *du* är beror på vem som läser, `by.me` är värdens svar. Tre
 * ställen på raden bygger namnet, och alla tre missades av det som fanns
 * innan detta test: rubriken (som får hela namnet — knappen tar inte längre
 * dess bredd), metaradens *av …*-rad (som INTE ska upprepa namnet rubriken
 * redan gav) och knappen (ett ensamt *Återställ* — rubriken har precis sagt
 * vems kopia det är, och den fulla meningen står kvar i `aria-label`).
 */
describe("en krockfrysnings rubrik, metarad och knapp (berättelse 131)", () => {
  /*
   * Listan sorterar nyast först (`savedAt` fallande) om inget annat valts —
   * tiderna nedan står i den ordningen med flit, så `rows()` ger dem tillbaka
   * i samma ordning som variablerna, utan en sortering i varje test.
   */
  const minKopia: GuideVersion = {
    id: "k-mine",
    reason: "conflict",
    by: { subject: "s-johan", name: "Johan Furuskog", me: true },
    savedAt: 1755000003000,
  };
  const hennesKopia: GuideVersion = {
    id: "k-theirs",
    reason: "conflict",
    by: { subject: "s-anna", name: "Anna Andersson", me: false },
    savedAt: 1755000002000,
  };
  const namnlösKopia: GuideVersion = { id: "k-anon", reason: "conflict", savedAt: 1755000001000 };
  const vanligVersionMedNamn: GuideVersion = {
    id: "v-normal",
    number: 4,
    by: { subject: "s-anna", name: "Anna Andersson", me: false },
    savedAt: 1755000003000,
  };

  /*
   * Mutationen som fäller det: låt `conflictHeading` alltid svara med
   * `editor.versions.conflict` ("Sparad vid krock") — den generiska texten är
   * ett giltigt svar bara när `by` saknas, aldrig annars.
   */
  test("rubriken säger din kopia, den andres kopia, eller ingetdera utan namn", () => {
    const [mine, theirs, anon] = rows(mount([minKopia, hennesKopia, namnlösKopia]));

    expect(mine!.querySelector(".name .text")?.textContent).toBe("Sparad vid krock · din kopia");
    expect(theirs!.querySelector(".name .text")?.textContent).toBe(
      "Sparad vid krock · Anna Anderssons kopia",
    );
    expect(anon!.querySelector(".name .text")?.textContent).toBe("Sparad vid krock");
  });

  /*
   * Mutationen som fäller det: ta bort `version.reason !== "conflict"` ur
   * villkoret för `who` — namnet kommer då tillbaka på metaraden trots att
   * rubriken redan sagt det, en tredje gång på samma rad.
   */
  test("ingen av-rad på en krockkopia — rubriken sa redan vems den är", () => {
    const [theirs] = rows(mount([hennesKopia]));

    expect(theirs!.querySelector("[data-by]")).toBeNull();
    expect(theirs!.querySelector("[data-when]")?.textContent).not.toBe("");
  });

  /*
   * Kontrasten: en vanlig version med `by.name` ska fortfarande säga *av …* —
   * annars vore föregående kontroll grön av att `who` alltid är tom.
   */
  test("men en vanlig version med ett namn säger fortfarande av …", () => {
    const [normal] = rows(mount([vanligVersionMedNamn]));

    expect(normal!.querySelector("[data-by]")?.textContent).toBe("av Anna Andersson");
  });

  /*
   * Johans bild 20/9 08:48: rubriken *Sparad vid krock · Johan Furuskogs…*
   * klipptes, för knappen bredvid åt bredden — den fulla `Återställ {ägare}
   * kopia` var namnet en andra gång på samma rad OCH för bred för att låta
   * rubriken visa hela sitt eget namn.
   *
   * Ordet ensamt (*Återställ*) är inte tvetydigt här: rubriken har precis
   * sagt vems kopia det är. Den fulla meningen finns kvar, för den som
   * lyssnar eller bara ser knappen utan raden bredvid (`aria-label`).
   *
   * Mutationen som fäller det: låt knappens SYNLIGA text vara hela
   * `restoreConflictLabel` igen — rubriken klipps; eller ta bort
   * `aria-label`-omsättningen — tillgängligheten tystnar om vems kopia det är.
   */
  test("återställ-knappen på en krockrad är kort — namnet står redan i rubriken", () => {
    const element = mount([minKopia, hennesKopia]);

    /* Osatt betyder alla SJU gamla — *Återställ* måste efterfrågas (se `asked`). */
    element.actions = ["open", "restore"] as never;

    const [mine, theirs] = rows(element);
    const restoreButton = (row: HTMLTableRowElement) =>
      row.querySelector<HTMLButtonElement>('[data-action="restore"]')!;

    expect(restoreButton(mine!).textContent).toBe("Återställ");
    expect(restoreButton(theirs!).textContent).toBe("Återställ");
    expect(restoreButton(mine!).getAttribute("aria-label")).toBe("Återställ din kopia");
    expect(restoreButton(theirs!).getAttribute("aria-label")).toBe(
      "Återställ Anna Anderssons kopia",
    );
  });
});

describe("which buttons a row gets", () => {
  /*
   * The live version is already loaded and already showing, so both would do
   * nothing. A button that does nothing is worse than no button: it makes
   * someone wonder what they missed.
   */
  test("the live one has neither Open nor Show this one", () => {
    const actions = buttons(rows(mount())[0]!);

    expect(actions).not.toContain("open");
    expect(actions).not.toContain("activate");
    /*
     * Duplicera leads, because it is the row's own button — the published row
     * cannot publish, so the slot holds the one act that leads somewhere without
     * touching what residents read. The rest follow in the menu. No Spara: there
     * is no draft, so there is nothing to save (Johan 3/9) — Spara appears on a
     * row only when it holds unsaved work, and then as the row's own button.
     */
    // Duplicera once, not twice: it is the row's own button, so the menu leaves
    // it out. An action offered twice is two ways to one thing side by side, and
    // the second always looks like it must be different.
    expect(actions).toEqual(["duplicate", "rename", "note", "delete"]);
  });

  /*
   * Deleting the live version would leave the page showing nothing, and an
   * editor would learn that from a visitor rather than from us.
   *
   * It is offered and refused rather than hidden: a row silently missing an
   * action every other row has sends someone looking for what they did wrong.
   */
  test("the live one cannot be removed, and says why", () => {
    const remove = rows(mount())[0]!.querySelector<HTMLButtonElement>(
      '[data-action="delete"]',
    )!;

    /*
     * Refused with `aria-disabled`, not `disabled`. A disabled button cannot
     * take focus, which made the one item carrying a reason the one item a
     * keyboard could never reach — and the reason lived in a `title`, which is
     * a tooltip, which is a mouse.
     */
    expect(remove.getAttribute("aria-disabled")).toBe("true");
    expect(remove.title).toBe("Visa en annan version för besökare först");
    expect(remove.getAttribute("aria-label")).toContain(
      "Visa en annan version för besökare först",
    );
  });

  test("and pressing it asks for nothing", () => {
    const element = mount();
    let asked = false;

    element.addEventListener("version-delete-intent", () => {
      asked = true;
    });

    rows(element)[0]!
      .querySelector<HTMLButtonElement>('[data-action="delete"]')!
      .click();

    expect(asked).toBe(false);
  });

  test("every other row can still be removed", () => {
    const removable = rows(mount())
      .slice(1)
      .map(
        (row) =>
          row
            .querySelector<HTMLButtonElement>('[data-action="delete"]')!
            .getAttribute("aria-disabled") === null,
      );

    expect(removable).toEqual([true, true]);
  });

  /*
   * Switching version comes first, and on the row itself rather than in the
   * menu: it is the thing this list exists for, and it is the one action worth
   * a press of its own.
   */
  test("another version leads with Publish, and holds the rest", () => {
    // No *Öppna i editorn* in the menu: the name is the button that opens it,
    // so the menu item was one act with two doors.
    expect(buttons(rows(mount())[1]!)).toEqual([
      "activate",
      "duplicate",
      "rename",
      "note",
      "delete",
    ]);
  });

  test("and Publish is on the row, not in the menu", () => {
    const row = rows(mount())[1]!;
    const activate = row.querySelector<HTMLButtonElement>('[data-action="activate"]')!;

    expect(activate.closest('[role="menu"]')).toBeNull();
    expect(activate.classList.contains("primary")).toBe(true);
  });

  /*
   * A draft belongs to a version, so the row that holds it offers the way out.
   * It outranks Publicera: the thing to do with unsaved work is put it
   * somewhere, and publishing something you have not saved is not that.
   */
  test("a row with a draft offers Save on the row itself", () => {
    const element = mount([
      { id: "v9", label: "guide.json", savedAt: 1, open: true, draft: true },
      { id: "v8", label: "guide-0728.json", savedAt: 2, current: true },
    ]);
    // By id, not by position: the list sorts by date, and a fixture that relies
    // on the order is a test of the sort rather than of the row.
    const row = rows(element).find((each) => each.dataset.id === "v9")!;
    const primary = row.querySelector<HTMLButtonElement>(".primary")!;

    expect(primary.dataset.action).toBe("save");
    expect(primary.closest('[role="menu"]')).toBeNull();
  });

  /*
   * Two marks for two facts: *Öppen* is where the writing lands, *Utkast* is
   * that something is sitting there unsaved. A row does not stop being the one
   * you are typing in because it holds a draft.
   */
  test("and says so beside the name, without dropping the other", () => {
    const element = mount([
      { id: "v9", label: "guide.json", savedAt: 1, open: true, draft: true },
    ]);
    const marks = [...rows(element)[0]!.querySelectorAll(".state")].map(
      (mark) => mark.textContent,
    );

    expect(marks).toEqual(["Öppen", "Utkast"]);
  });

  // Without a draft the row goes back to offering the thing it is for.
  /*
   * Two ways out of one state, the same size of act. Keeping only one would file
   * the other under *more options*, which is a hunt for a decision somebody has
   * already made.
   */
  test("a draft offers both ways out, on the row", () => {
    const element = mount([
      { id: "v9", label: "guide.json", savedAt: 1, open: true, draft: true },
      { id: "v8", label: "guide-0728.json", savedAt: 2, current: true },
    ]);
    const row = rows(element).find((each) => each.dataset.id === "v9")!;
    const onRow = [...row.querySelectorAll<HTMLButtonElement>(".primary")].map(
      (button) => button.dataset.action,
    );

    expect(onRow).toEqual(["save", "discard"]);
  });

  /*
   * The actions cell keeps the room for the widest set it can hold. Without it
   * a keystroke that creates a draft widens the cell, the table re-lays out, and
   * the name column moves while somebody is reading it.
   */
  test("and the row is no wider for holding them", () => {
    const quiet = mount([
      { id: "v9", label: "guide.json", savedAt: 1, open: true },
      { id: "v8", label: "guide-0728.json", savedAt: 2, current: true },
    ]);
    const before = quiet
      .shadowRoot!.querySelector<HTMLElement>("td.actions")!
      .getBoundingClientRect().width;

    document.body.replaceChildren();

    const busy = mount([
      { id: "v9", label: "guide.json", savedAt: 1, open: true, draft: true },
      { id: "v8", label: "guide-0728.json", savedAt: 2, current: true },
    ]);
    const after = busy
      .shadowRoot!.querySelector<HTMLElement>("td.actions")!
      .getBoundingClientRect().width;

    expect(after).toBeCloseTo(before, 0);
  });

  test("without one it offers Publicera again", () => {
    const element = mount([
      { id: "v9", label: "guide.json", savedAt: 1, open: true },
      { id: "v8", label: "guide-0728.json", savedAt: 2, current: true },
    ]);

    const row = rows(element).find((each) => each.dataset.id === "v9")!;

    expect(row.querySelector<HTMLButtonElement>(".primary")!.dataset.action).toBe(
      "activate",
    );
  });

  // A row that is gone has nothing to show, so it offers nothing.
  test("a row whose version is gone offers no action of its own", () => {
    expect(rows(mount())[2]!.querySelector(".primary")).toBeNull();
  });

  /*
   * The published row cannot publish, and the slot stood empty on the one row
   * people most often want to start a change from. A copy is the only act there
   * that leads somewhere without touching what residents are reading.
   */
  test("the published one offers a copy instead", () => {
    const primary = rows(mount())[0]!.querySelector<HTMLButtonElement>(".primary")!;

    expect(primary.dataset.action).toBe("duplicate");
  });

  /*
   * Writing into a version is an act, not a side effect.
   *
   * Versions are snapshots, and that is what makes going back mean anything: if
   * editing flowed into them, the point someone wanted to return to would
   * already hold the change they wanted to undo. So an editor says *put what I
   * have into this one*, on the row they mean.
   *
   * And only where there is something to put. Spara on a row without a draft
   * was the same button read two ways — the example page saved nothing there,
   * the Sitevision host wrote the editor's content into that version after a
   * confirm. Johan 3/9: only where a draft exists, and no padlock on the
   * others: a version is not locked, it has nothing new to take.
   */
  test("only a version holding a draft can be saved into", () => {
    const element = mount([
      { id: "v1", label: "Ett", current: true },
      { id: "v2", label: "Två", draft: true },
      { id: "v3", label: "Tre" },
    ]);
    const offered = rows(element).map((row) => buttons(row).includes("save"));

    expect(offered).toEqual([false, true, false]);
  });

  test("and it asks with the version it belongs to", () => {
    const element = mount([
      { id: "v1", label: "Ett", current: true },
      { id: "v2", label: "Två", draft: true },
    ]);
    let asked: GuideVersion | undefined;

    element.addEventListener("version-save-intent", (event) => {
      asked = (event as CustomEvent<{ version: GuideVersion }>).detail.version;
    });

    rows(element)[1]!
      .querySelector<HTMLButtonElement>('[data-action="save"]')!
      .click();

    expect(asked?.id).toBe("v2");
  });

  // A row for something that is gone can only be cleared away.
  test("a missing one can only be removed", () => {
    expect(buttons(rows(mount())[2]!)).toEqual(["delete"]);
  });

  /*
   * The live version being the missing one is the case the block was never
   * meant for. It guards against leaving the page with nothing to show — and
   * here that has already happened, because the file the module points at is
   * gone. This row is the only explanation for the empty page, and refusing to
   * clear it would make the way out "show some other version to visitors
   * first": a change to what visitors see, demanded of someone who only wanted
   * to remove a dead pointer.
   */
  test("the live one can be removed once it is gone too", () => {
    const element = mount([
      { id: "v9", label: "guide.json", current: true, missing: true },
      { id: "v8", label: "guide-0728.json", savedAt: 1753700000000 },
    ]);
    const remove = rows(element)[0]!.querySelector<HTMLButtonElement>(
      '[data-action="delete"]',
    )!;

    expect(remove.disabled).toBe(false);
    expect(remove.title).toBe("");
  });

  test("and pressing it asks the host to clear the pointer", () => {
    const element = mount([
      { id: "v9", label: "guide.json", current: true, missing: true },
    ]);
    let asked: GuideVersion | undefined;

    element.addEventListener("version-delete-intent", (event) => {
      asked = (event as CustomEvent<{ version: GuideVersion }>).detail.version;
    });

    rows(element)[0]!
      .querySelector<HTMLButtonElement>('[data-action="delete"]')!
      .click();

    expect(asked?.id).toBe("v9");
  });
});

describe("what it does when pressed", () => {
  // `open` is not here: it is the name, not a `[data-action]` in the menu, and
  // it has its own tests above.
  test.each([
    ["activate", "version-activate-intent"],
    ["duplicate", "version-duplicate-intent"],
    ["rename", "version-rename-intent"],
    ["note", "version-note-intent"],
    ["delete", "version-delete-intent"],
  ])("%s asks with %s and changes nothing itself", (action, type) => {
    const element = mount();
    const before = JSON.stringify(element.versions);
    let asked: GuideVersion | undefined;

    element.addEventListener(type, (event) => {
      asked = (event as CustomEvent<{ version: GuideVersion }>).detail.version;
    });

    rows(element)[1]!
      .querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!
      .click();

    expect(asked?.id).toBe("v2");
    // The list decides nothing. If it edited its own state, a host that refused
    // the intent would end up disagreeing with what is on screen.
    expect(JSON.stringify(element.versions)).toBe(before);
  });

  test("the intent escapes the shadow root, so a host can listen on a parent", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const element = document.createElement("guide-versions") as GuideVersions;
    host.appendChild(element);
    element.versions = VERSIONS;

    let heard = false;
    host.addEventListener("version-activate-intent", () => {
      heard = true;
    });

    rows(element)[1]!
      .querySelector<HTMLButtonElement>('[data-action="activate"]')!
      .click();

    expect(heard).toBe(true);
  });
});

describe("the words", () => {
  test("follow the tool's language, not the guide's", () => {
    const element = mount(VERSIONS, "en");

    expect(buttonLabels(element)).toContain("Publish");
    expect(element.shadowRoot?.textContent).toContain("Published");
  });

  /*
   * Pressing the wrong row is the entire risk in this list, so a screen reader
   * has to hear which row a button belongs to. Six buttons reading "Ta bort" in
   * sequence is exactly the failure.
   */
  test("every button says which version it belongs to", () => {
    const labels = [...rows(mount())[1]!.querySelectorAll("button")].map((button) =>
      button.getAttribute("aria-label"),
    );

    /*
     * Radens namn, alltså det raden faktiskt visar: värdens namn på första
     * raden. En knapp som annonseras med ord som inte står på skärmen går inte
     * att be om med rösten (WCAG 2.5.3), och anteckningen står på rad två.
     */
    expect(labels.every((label) => label?.includes("guide-0728.json"))).toBe(true);
    expect(labels).toContain("Ta bort: guide-0728.json");
  });

  test("an empty list says so rather than showing nothing", () => {
    const element = mount([]);

    expect(element.shadowRoot?.querySelector(".empty")?.textContent).toBe(
      "Inga versioner än.",
    );
  });
});

describe("order", () => {
  /*
   * Sorting changes nothing, so the element does it alone. A hand-made order is
   * something someone decided, and only a host can keep it — so that one asks.
   */
  test("newest first by default", () => {
    const names = rows(mount()).map((row) => row.querySelector(".name .text")?.textContent);

    expect(names?.[0]).toBe("guide.json");
  });

  test("by name when asked, without telling anyone", () => {
    const element = mount();
    let asked = false;

    element.addEventListener("version-reorder-intent", () => {
      asked = true;
    });
    element.order = "label";

    // Sorterat på det raden visar: värdens namn, samma regel som renderingen.
    expect(rows(element)[0]!.querySelector(".name .text")?.textContent).toBe(
      "guide-0728.json",
    );
    expect(asked).toBe(false);
  });

  test("your own order renders exactly what the host handed over", () => {
    const element = mount();

    element.order = "custom";

    expect(rows(element).map((row) => row.dataset.id)).toEqual(["v3", "v2", "v1"]);
  });

  /*
   * Dragging is only offered where it means something. In a date-sorted list a
   * dragged row would spring back, and a control that undoes what you just did
   * is worse than one that was never there.
   */
  test("the grip is only offered in your own order", () => {
    const element = mount();

    expect(element.shadowRoot!.querySelectorAll("[data-grip]")).toHaveLength(0);

    element.order = "custom";

    /*
     * A grip rather than `draggable` on the row. The browser's own drag never
     * starts from a finger on iPadOS, so arranging a list was mouse-only —
     * and nothing on screen said a row could be moved at all.
     */
    expect(element.shadowRoot!.querySelectorAll("[data-grip]").length).toBe(
      rows(element).length,
    );
  });

  /*
   * Our own hand, drawn (src/editor/styles/_cursors.scss): Windows drew the
   * system's `grab` entirely white on Johan's machine. Open over the grip,
   * closed on the row being carried.
   */
  test("the grip offers a drawn hand, and the carried row holds it", () => {
    const element = mount();
    element.order = "custom";

    const grip = element.shadowRoot!.querySelector<HTMLElement>("[data-grip]")!;
    const target = rows(element)[1]!.getBoundingClientRect();

    expectDrawnCursor(grip, "grab", "greppet i vila");

    grip.dispatchEvent(
      new PointerEvent("pointerdown", { clientY: grip.getBoundingClientRect().top, bubbles: true }),
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientY: target.top + target.height / 2 }),
    );

    expectDrawnCursor(
      element.shadowRoot!.querySelector("tbody tr[data-dragging]")!,
      "grabbing",
      "den burna raden",
    );

    window.dispatchEvent(new PointerEvent("pointerup"));
  });

  test("dragging the grip asks for the order it was dropped in", async () => {
    const element = mount();
    element.order = "custom";

    let order: string[] | undefined;
    element.addEventListener("version-reorder-intent", (event) => {
      order = (event as CustomEvent<{ order: string[] }>).detail.order;
    });

    const grip = element.shadowRoot!.querySelector<HTMLElement>("[data-grip]")!;
    const target = rows(element)[2]!.getBoundingClientRect();

    grip.dispatchEvent(
      new PointerEvent("pointerdown", { clientY: grip.getBoundingClientRect().top, bubbles: true }),
    );
    /*
     * On the window, because that is where the gesture is heard. Pointer
     * capture does not survive the rows being moved to show where one will
     * land, and dispatching at the grip would test a path the browser stops
     * taking the moment the list rearranges.
     */
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientY: target.top + target.height / 2 }),
    );
    window.dispatchEvent(new PointerEvent("pointerup"));

    // The first row was carried to the last, and the host hears the whole
    // order once — on release, when it is a decision rather than a hand moving.
    expect(order).toEqual(["v2", "v1", "v3"]);
  });

  /*
   * The gesture has to survive the list rearranging under it.
   *
   * Reported from use: *"it gets a bit odd when you drag — if you happen to
   * hover a link the dragging is cancelled."* The cause was not the link.
   * Showing where a row will land moves it in the DOM, and moving an element
   * releases the pointer capture it held; from then on the events went to
   * whatever was under the pointer instead of to the grip.
   *
   * So this drags across two rows in a row. With the listeners on the grip the
   * second move is heard by nobody and the order comes back wrong.
   */
  test("a drag survives its own rearranging, one row at a time", () => {
    const element = mount();
    element.order = "custom";

    let order: string[] | undefined;
    element.addEventListener("version-reorder-intent", (event) => {
      order = (event as CustomEvent<{ order: string[] }>).detail.order;
    });

    const grip = element.shadowRoot!.querySelector<HTMLElement>("[data-grip]")!;
    const middle = rows(element)[1]!.getBoundingClientRect();
    const last = rows(element)[2]!.getBoundingClientRect();

    grip.dispatchEvent(
      new PointerEvent("pointerdown", { clientY: grip.getBoundingClientRect().top, bubbles: true }),
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientY: middle.top + middle.height / 2 }),
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientY: last.top + last.height / 2 }),
    );
    window.dispatchEvent(new PointerEvent("pointerup"));

    expect(order).toEqual(["v2", "v1", "v3"]);
  });

  /*
   * Crossing an edge is not enough to trade places.
   *
   * Reported from use: *"it jumps back and forth when you start dragging"*, and
   * then *"a bit too sensitive"*. The first was measuring rows while they were
   * animating; the second was swapping on the exact middle, which a tremor
   * crosses. A row now has to be entered most of the way before it gives up
   * its place, and the direction of travel decides which way *most* counts.
   */
  test("passing the middle is no longer enough to trade places", () => {
    const element = mount();
    element.order = "custom";

    const grip = element.shadowRoot!.querySelector<HTMLElement>("[data-grip]")!;
    const first = rows(element)[0]!.getBoundingClientRect();
    const start = grip.getBoundingClientRect().top;

    /*
     * The order on screen, not the event.
     *
     * The host is told once, on release — so watching for the intent says
     * nothing about what happens during the gesture, and an assertion on it
     * mid-drag is true no matter what the rule does. The rows themselves are
     * the only honest instrument here.
     */
    const shown = () => rows(element).map((row) => row.dataset.id);

    expect(shown()).toEqual(["v3", "v2", "v1"]);

    grip.dispatchEvent(new PointerEvent("pointerdown", { clientY: start, bubbles: true }));

    // Past the ten-pixel threshold first, upwards, where the top row has
    // nowhere to go — so the next step tests the rule and not the threshold.
    window.dispatchEvent(new PointerEvent("pointermove", { clientY: start - 20 }));
    expect(shown()).toEqual(["v3", "v2", "v1"]);

    // Three fifths down the row: past the middle, which is where the first
    // version swapped and where a tremor put it straight back.
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientY: first.top + first.height * 0.6 }),
    );
    expect(shown()).toEqual(["v3", "v2", "v1"]);

    // Nine tenths down, and it goes.
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientY: first.top + first.height * 0.9 }),
    );
    expect(shown()).toEqual(["v2", "v3", "v1"]);

    window.dispatchEvent(new PointerEvent("pointerup"));
  });

  /*
   * The row follows the finger rather than hopping between slots.
   *
   * It was left out of the sliding on the reasoning that it should feel pinned
   * to the pointer — but nothing pinned it, so it jumped a whole row at a time
   * while everything around it glided. Reported as the row gliding down too
   * fast; it was not gliding at all.
   */
  test("the carried row is held under the pointer while it moves", () => {
    const element = mount();
    element.order = "custom";

    const grip = element.shadowRoot!.querySelector<HTMLElement>("[data-grip]")!;
    const carried = rows(element)[0]!;
    const start = grip.getBoundingClientRect().top;

    const before = carried.getBoundingClientRect().top;

    grip.dispatchEvent(new PointerEvent("pointerdown", { clientY: start, bubbles: true }));
    window.dispatchEvent(new PointerEvent("pointermove", { clientY: start + 24 }));

    /*
     * Where it ended up on screen, not what the transform says.
     *
     * The number in the transform is meaningless on its own: once the row has
     * traded places its slot is a row lower, so following the finger means a
     * *negative* offset from that slot. The first version of this test asserted
     * the transform was positive and failed against correct behaviour.
     *
     * What is actually claimed is simpler: the row went where the finger went.
     */
    const after = carried.getBoundingClientRect().top;

    expect(after - before).toBeGreaterThan(20);
    expect(after - before).toBeLessThan(28);

    // And released back into the flow, so the slot it landed in is the truth.
    window.dispatchEvent(new PointerEvent("pointerup"));
    expect(carried.style.transform).toBe("");
  });

  /*
   * You have to be able to see which row is in your hand.
   *
   * While the list rearranges every row looks the same, and the one that moves
   * is whichever the pointer last crossed. The mark is what the lift hangs on,
   * and it has to go away again — a row left looking picked up after the finger
   * lifted is worse than one that never looked picked up at all.
   */
  test("the carried row is marked while it is carried, and only then", () => {
    const element = mount();
    element.order = "custom";

    const grip = element.shadowRoot!.querySelector<HTMLElement>("[data-grip]")!;
    const marked = () =>
      element.shadowRoot!.querySelectorAll("tbody tr[data-dragging]").length;

    expect(marked()).toBe(0);

    const top = grip.getBoundingClientRect().top;
    const target = rows(element)[1]!.getBoundingClientRect();

    grip.dispatchEvent(new PointerEvent("pointerdown", { clientY: top, bubbles: true }));
    // Below the threshold: still a press, so nothing is lifted yet.
    window.dispatchEvent(new PointerEvent("pointermove", { clientY: top + 8 }));
    expect(marked()).toBe(0);

    window.dispatchEvent(
      new PointerEvent("pointermove", { clientY: target.top + target.height / 2 }),
    );
    expect(marked()).toBe(1);

    /*
     * Gone afterwards — though not only because the drag cleans up after
     * itself. Asking for a new order re-renders the list, so the mark would
     * disappear either way, and removing the cleanup line does not fail this.
     * The assertion is kept for what it states rather than what it catches:
     * the end state is a list with nothing left looking picked up.
     */
    window.dispatchEvent(new PointerEvent("pointerup"));
    expect(marked()).toBe(0);
  });

  // A press is not a drag. Without a threshold every tap on the grip would
  // reorder, and no finger holds perfectly still.
  test("a press that does not move asks for nothing", () => {
    const element = mount();
    element.order = "custom";

    let asked = false;
    element.addEventListener("version-reorder-intent", () => {
      asked = true;
    });

    const grip = element.shadowRoot!.querySelector<HTMLElement>("[data-grip]")!;
    const top = grip.getBoundingClientRect().top;

    grip.dispatchEvent(new PointerEvent("pointerdown", { clientY: top, bubbles: true }));
    window.dispatchEvent(new PointerEvent("pointermove", { clientY: top + 8 }));
    window.dispatchEvent(new PointerEvent("pointerup"));

    expect(asked).toBe(false);
  });

  test("moving with the keyboard asks for the whole new order", () => {
    const element = mount();
    element.order = "custom";

    let order: string[] | undefined;
    element.addEventListener("version-reorder-intent", (event) => {
      order = (event as CustomEvent<{ order: string[] }>).detail.order;
    });

    const row = rows(element)[1]!;
    row.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true }),
    );

    expect(order).toEqual(["v2", "v3", "v1"]);
  });

  // Without Alt it is an ordinary arrow key, and stealing it would trap anyone
  // moving through the list.
  test("a bare arrow key moves nothing", () => {
    const element = mount();
    element.order = "custom";

    let asked = false;
    element.addEventListener("version-reorder-intent", () => {
      asked = true;
    });

    rows(element)[1]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );

    expect(asked).toBe(false);
  });

  /*
   * Choosing "your own order" asks for the order already on screen. Without
   * that the list would rearrange itself the moment someone chose to arrange
   * it, which is exactly the jump that makes people distrust a control.
   */
  test("choosing your own order asks for what is already shown", () => {
    const element = mount();
    element.order = "label";

    let order: string[] | undefined;
    element.addEventListener("version-reorder-intent", (event) => {
      order = (event as CustomEvent<{ order: string[] }>).detail.order;
    });

    // Whatever the name sort produced — asserted against the screen rather than
    // against a guess, because collation is the locale's business and not this
    // test's.
    const onScreen = rows(element).map((row) => row.dataset.id);

    const select = element.shadowRoot!.querySelector("select")!;
    select.value = "custom";
    select.dispatchEvent(new Event("change"));

    expect(order).toEqual(onScreen);
    expect(order).not.toEqual(["v3", "v2", "v1"]);
  });

  test("one version needs no order control", () => {
    const element = mount([VERSIONS[0]!]);

    expect(element.shadowRoot?.querySelector("select")).toBeNull();
  });
});

/**
 * Giving way first is not the same as disappearing.
 *
 * Found by looking at the screen, not by a failing test: in the Sitevision mock
 * the live row showed its badge and no name at all. The name cell was 95px, the
 * badge is `flex: none` and 130px, and flex handed the badge everything — so the
 * text was zero pixels wide, and zero pixels has nothing to put an ellipsis on.
 *
 * The row it happens to is the worst possible one. Only the live version has a
 * badge, and when the live version's file is also gone, that row is the only
 * explanation for a page showing nothing. It explained nothing.
 */
describe("the name gives way but does not vanish", () => {
  const LONG = "bostadsbidrag-slutlig-2026-08-05.json";

  const nameWidth = (element: GuideVersions): number =>
    rows(element)[0]!.querySelector<HTMLElement>(".name .text")!.getBoundingClientRect()
      .width;

  test("a badge cannot squeeze the name to nothing", () => {
    const element = mountNarrow([
      { id: "v9", label: LONG, savedAt: 1754400000000, current: true },
      { id: "v8", label: "guide-0728.json", savedAt: 1753700000000 },
    ]);

    // The badge is there — otherwise this asserts nothing about the case.
    expect(rows(element)[0]!.querySelector(".badge")).not.toBeNull();
    expect(nameWidth(element)).toBeGreaterThan(0);
  });

  test("and the first characters survive, not just a pixel", () => {
    const element = mountNarrow([
      { id: "v9", label: LONG, savedAt: 1754400000000, current: true },
      { id: "v8", label: "guide-0728.json", savedAt: 1753700000000 },
    ]);

    // The floor is 7ch. Asserted well under it, in pixels, because the font is
    // the theme's business and a test that pins the exact width would fail on
    // the day someone changes it for a better reason than this one.
    expect(nameWidth(element)).toBeGreaterThan(30);
  });

  // Giving way is still the rule; there is simply far more room to give. A name
  // long enough to reach the end of a narrow row truncates rather than pushing
  // the control off the edge.
  test("a name still gives way rather than pushing the control off", () => {
    const element = mountNarrow(
      [
        { id: "v8", label: `${LONG}-${LONG}`, savedAt: 1753700000000 },
        { id: "v7", label: "guide-0728.json", savedAt: 1753600000000 },
      ],
      "320px",
    );
    const row = rows(element)[0]!;
    const text = row.querySelector<HTMLElement>(".name .text")!;

    expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
    expect(trigger(row).getBoundingClientRect().width).toBeGreaterThan(0);
  });
});

/**
 * The row is read far more often than it is acted on.
 *
 * Six labelled buttons per row took five sixths of the width — the version's
 * own name was down to six characters while "Duplicera" had room to spare. The
 * words were worth keeping and the buttons were not, so the words moved into a
 * menu behind one control.
 */
/**
 * Choosing a version means reading one, so the cheapest thing to do while
 * browsing should be the thing you do most.
 */
describe("the row opens the version", () => {
  const openings = (element: GuideVersions): string[] => {
    const seen: string[] = [];

    element.addEventListener("version-open-intent", (event) => {
      seen.push((event as CustomEvent<{ version: GuideVersion }>).detail.version.id);
    });

    return seen;
  };

  test("a press on the row asks to open it", () => {
    const element = mount();
    const seen = openings(element);

    rows(element)[1]!.click();

    expect(seen).toEqual(["v2"]);
  });

  /*
   * A `<tr>` is not something a keyboard can press, which is why the menu used
   * to carry an *Öppna i editorn* nobody with a mouse needed. The name is the
   * control now, so the keyboard reaches the same act by Tab and Enter.
   */
  test("and the name is a button, so a keyboard reaches it", () => {
    const element = mount();
    const seen = openings(element);
    const name = rows(element)[1]!.querySelector<HTMLButtonElement>(".name .text")!;

    expect(name.tagName).toBe("BUTTON");
    expect(name.getAttribute("aria-label")).toContain("Öppna i editorn");

    name.click();

    expect(seen).toEqual(["v2"]);
  });

  // Nothing to open, so nothing that looks like it could be.
  test("a gone version keeps a plain name", () => {
    expect(rows(mount())[2]!.querySelector(".name .text")?.tagName).toBe("SPAN");
  });

  // Otherwise every action in the menu would also open the row it sits on.
  test("a press on a button belongs to the button", () => {
    const element = mount();
    const seen = openings(element);

    trigger(rows(element)[1]!).click();
    rows(element)[1]!
      .querySelector<HTMLButtonElement>('[data-action="rename"]')!
      .click();

    expect(seen).toEqual([]);
  });

  test("a row whose version is gone opens nothing", () => {
    const element = mount();
    const seen = openings(element);

    rows(element)[2]!.click();

    expect(seen).toEqual([]);
  });
});

describe("one control, and the actions behind it", () => {
  test("the actions are shut until asked for", () => {
    const row = rows(mount())[1]!;

    expect(trigger(row).getAttribute("aria-expanded")).toBe("false");
    expect(menu(row).hidden).toBe(true);
  });

  test("pressing it opens them and says so", () => {
    const row = rows(mount())[1]!;

    trigger(row).click();

    expect(trigger(row).getAttribute("aria-expanded")).toBe("true");
    expect(menu(row).hidden).toBe(false);
  });

  // Two menus open at once is two rows claiming the same attention, and the
  // second one is over a row nobody is looking at any more.
  test("opening one shuts the other", () => {
    const element = mount();

    trigger(rows(element)[0]!).click();
    trigger(rows(element)[1]!).click();

    expect(menu(rows(element)[0]!).hidden).toBe(true);
    expect(menu(rows(element)[1]!).hidden).toBe(false);
  });

  test("pressing it again shuts it", () => {
    const row = rows(mount())[1]!;

    trigger(row).click();
    trigger(row).click();

    expect(menu(row).hidden).toBe(true);
  });

  /*
   * A menu that closes and leaves the focus nowhere strands anyone not using a
   * mouse: the next Tab starts from the top of the document.
   */
  test("Escape shuts it and hands the focus back", () => {
    const element = mount();
    const row = rows(element)[1]!;

    trigger(row).click();
    menu(row).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(menu(row).hidden).toBe(true);
    expect(element.shadowRoot!.activeElement).toBe(trigger(row));
  });

  // The host's own Save button is the likeliest next thing someone reaches for.
  /*
   * `<guide-editor>` sets no z-index on its own host, so it makes no stacking
   * context and its insides compete with ours directly — the toolbar at 20 and
   * the sidebar at 25 were both above a 2, and an open menu vanished behind an
   * editor sitting below the list.
   *
   * Pinned as a number rather than as a look: this is the one property that
   * cannot be seen in a unit test and is obvious in a screenshot, which is
   * exactly the kind that comes back.
   */
  test("an open menu outranks an editor's own chrome", () => {
    const element = mount();

    trigger(rows(element)[1]!).click();

    expect(element.dataset.menuOpen).toBe("true");
    expect(Number(getComputedStyle(element).zIndex)).toBeGreaterThan(25);
  });

  test("and gives the place back when it closes", () => {
    const element = mount();

    trigger(rows(element)[1]!).click();
    trigger(rows(element)[1]!).click();

    expect(element.dataset.menuOpen).toBeUndefined();
    expect(getComputedStyle(element).zIndex).toBe("auto");
  });

  test("a press anywhere else shuts it", () => {
    const row = rows(mount())[1]!;

    trigger(row).click();
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    expect(menu(row).hidden).toBe(true);
  });

  test("acting on a row is the end of the menu's job", () => {
    const row = rows(mount())[1]!;

    trigger(row).click();
    row.querySelector<HTMLButtonElement>('[data-action="rename"]')!.click();

    expect(menu(row).hidden).toBe(true);
  });

  /*
   * Opening puts the focus on the first thing that can be pressed, so the
   * keyboard path is open → down → enter rather than open → tab → tab → tab.
   * The refused item is still walked past: its reason is on it, and an item
   * arrow keys skip is a reason nobody reads.
   */
  test("the arrow keys walk every item, including the refused one", () => {
    const element = mount();
    const row = rows(element)[0]!;

    trigger(row).click();
    expect(element.shadowRoot!.activeElement).toBe(
      row.querySelector('[role="menu"] [data-action="rename"]'),
    );

    for (const _ of [0, 1]) {
      menu(row).dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
    }

    const last = element.shadowRoot!.activeElement as HTMLButtonElement;
    expect(last.dataset.action).toBe("delete");
    expect(last.getAttribute("aria-disabled")).toBe("true");
  });
});

function buttonLabels(element: GuideVersions): string[] {
  return [...(element.shadowRoot?.querySelectorAll("button") ?? [])].map(
    (button) => button.textContent ?? "",
  );
}

/*
 * The sort control is a field like the panel's selects (Astra via Johan 29/9;
 * left outside that round and done 29/9): the drawn chevron on a wrapper,
 * filled from `--fw-text-secondary`, so a host overriding the token on the
 * element moves the arrow with it — see `src/editor/styles/_select.scss`.
 */
describe("the order control's shape", () => {
  test("wrapper with a masked chevron, field height, normal weight, room for the arrow", () => {
    const element = mount();
    const select = element.shadowRoot!.querySelector<HTMLSelectElement>("#order")!;
    const wrap = select.parentElement!;
    const style = getComputedStyle(select);
    const arrow = getComputedStyle(wrap, "::after");
    const height = select.getBoundingClientRect().height;

    expect(wrap.classList.contains("order-select"), "wrapper").toBe(true);
    expect(style.appearance, "the platform arrow is off").toBe("none");
    expect(arrow.maskImage, "a drawn SVG chevron as a mask").toContain("svg");
    expect(arrow.pointerEvents).toBe("none");
    expect(Math.abs(wrap.getBoundingClientRect().height - height), "the wrapper adds nothing").toBeLessThanOrEqual(1);
    expect(height, "the fields' height").toBeGreaterThanOrEqual(44);
    expect(height).toBeLessThanOrEqual(48);
    expect(Number.parseFloat(style.paddingRight), "text never meets the arrow").toBeGreaterThanOrEqual(36);
    expect(style.fontWeight).toBe("400");

    element.style.setProperty("--fw-text-secondary", "rgb(200, 30, 30)");
    expect(getComputedStyle(wrap, "::after").backgroundColor, "follows a local override").toBe("rgb(200, 30, 30)");
    element.remove();
  });
});

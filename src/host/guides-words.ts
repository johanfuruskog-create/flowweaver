import type { SiteLocale } from "../data/example-catalog";

/**
 * The words on *Mina guider* — the page an editor starts from (story 126).
 *
 * ## Why they are collected here rather than written into the page
 *
 * Two reasons, and the second is the one that made this a module instead of a
 * handful of `t("…", "…")` calls the way `interest.ts` does it.
 *
 * The first is K1: nothing an editor reads is hardcoded where it is used, so it
 * can be translated and so it can be counted. The second is that this page
 * shares its vocabulary with `guide-storage-words.ts` — *Publicerad* means the
 * thing visitors get, on both pages, and the moment one of them says *Utgiven*
 * an editor has two words for one state and starts wondering whether they are
 * two states. That file's header states the rule; this one obeys it, and its
 * test compares the two rather than trusting that they match.
 *
 * ## Why not the editor's own string table
 *
 * These are the **host's** words, not the tool's. `editor-ui-strings` ships
 * inside the library, and a municipality embedding the editor has no guide list
 * of ours to name — putting *Mina guider* there would ship a sentence to every
 * consumer for a page only this site has. The host's words live with the host,
 * which is the same division `guide-storage-words.ts` made for one language.
 *
 * ## Two languages, because this page has two addresses
 *
 * Swedish at the root, English under `en/`, like everything else on the site
 * (`site-paths.ts` owns that rule and this file does not repeat it). The
 * accessor takes the locale the page worked out and hands back one language's
 * worth of words, so nothing downstream carries a pair around.
 */

/** One word or sentence, in both languages. */
type Pair = { sv: string; en: string };

const WORDS = {
  /* ── The page ────────────────────────────────────────────────────────── */

  /*
   * *Guider*, inte *Mina guider* (berättelse 127).
   *
   * Listan är organisationens: en guide i ett CMS är sajtens innehåll och inte
   * en persons, och en rubrik som säger *mina* över allas guider är en rubrik
   * som ber någon leta efter varför Nisses guide står där. Adressen heter
   * fortfarande `guides/`, för en adress som byts är länkar som slutar
   * fungera.
   */
  title: { sv: "Guider", en: "Guides" },
  intro: {
    sv: "Guiderna hos värden, inte i den här webbläsaren. Alla som får logga in ser allas — öppna en på vilken dator som helst.",
    en: "The guides kept with the host, not in this browser. Everyone who may sign in sees everyone's — open one from any computer.",
  },

  /* ── Logged out ──────────────────────────────────────────────────────── */

  signedOut: {
    sv: "Logga in för att se guiderna.",
    en: "Sign in to see the guides.",
  },
  login: { sv: "Logga in", en: "Sign in" },

  /* ── Logged in ───────────────────────────────────────────────────────── */

  /** `{name}` is what the provider called the person, never an id. */
  signedInAs: { sv: "Inloggad som {name}", en: "Signed in as {name}" },
  /*
   * Och med rollen bredvid (berättelse 128).
   *
   * En egen form och inte en hopfogning: en mening byggd av bitar går bara att
   * bygga i en ordning, och de två språken sätter inte orden på samma plats i
   * andra rader här. Formen står kvar utan roll också — en värd från före den
   * här berättelsen svarar utan `role`, och då är svaret *läsare*, vilket den
   * andra raden säger utan att någon ska behöva gissa.
   */
  signedInAsRole: {
    sv: "Inloggad som {name} · {role}",
    en: "Signed in as {name} · {role}",
  },

  /*
   * Rollernas ord, i stegets ordning. Värdens ord är engelska och ligger i
   * `.env` (`roles.mjs`); de här är vad en människa läser, och de två är med
   * flit inte samma sak — *admin* i en konfigurationsfil och *förvaltare* i en
   * remsa är olika publik.
   */
  roleReader: { sv: "läsare", en: "reader" },
  roleEditor: { sv: "redaktör", en: "editor" },
  rolePublisher: { sv: "publicerare", en: "publisher" },
  roleAdmin: { sv: "förvaltare", en: "administrator" },

  /*
   * Varför *Ny guide* inte står där (kriterium 6).
   *
   * En knapp som är borta utan förklaring läses som att sidan är trasig, eller
   * värre: som att man själv gjort något fel. Raden ligger i `role="status"`,
   * så den sägs också för den som inte ser skärmen.
   */
  onlyAdminCanCreate: {
    sv: "Bara en förvaltare kan skapa nya guider.",
    en: "Only an administrator can create new guides.",
  },
  logout: { sv: "Logga ut", en: "Sign out" },
  newGuide: { sv: "Ny guide", en: "New guide" },
  searchLabel: { sv: "Sök på titel", en: "Search by title" },
  /*
   * Filtret, av som standard (berättelse 127). *Bara mina* och inte *Mina
   * guider*: det är en avgränsning av det som står där, inte ett andra ställe
   * guider kan bo. Vad "mina" betyder avgör värden — skapad av mig, eller
   * senast ändrad av mig — och det står i etikettens hjälprad.
   */
  onlyMine: { sv: "Bara mina", en: "Only mine" },
  onlyMineHint: {
    sv: "Guider du skapat eller ändrat sist",
    en: "Guides you created or changed last",
  },

  /* ── A row ───────────────────────────────────────────────────────────── */

  /*
   * A guide nobody has named yet. Said rather than left blank: an empty row is
   * a row that cannot be pressed, cannot be searched for and cannot be told
   * apart from the one under it.
   */
  untitled: { sv: "Namnlös guide", en: "Untitled guide" },
  published: { sv: "Publicerad", en: "Published" },
  unpublished: { sv: "Inte publicerad än", en: "Not published yet" },
  /** `{when}` is a date in the reader's own time zone. */
  changed: { sv: "Ändrad {when}", en: "Changed {when}" },
  /*
   * Och med ett namn när värden vet ett (berättelse 127). Två former och inte
   * en hopfogning: *av* står på olika ställen i de två språken, och en mening
   * byggd av bitar går bara att bygga i en ordning.
   *
   * En guide från före inloggningen har ingen att namnge, och då står den
   * korta formen. Aldrig ett *av* följt av ingenting.
   */
  changedBy: { sv: "Ändrad {when} av {name}", en: "Changed {when} by {name}" },
  /*
   * Vem som arbetar i guiden just nu (berättelse 129).
   *
   * *Låst av* och inte *Redigeras av*: det är ordet Sitevision och Word
   * använder om samma sak, och en lista som hittar på ett eget ord för något
   * folk redan känner igen har gjort det svårare utan att göra det tydligare.
   *
   * Utan tid. Editorns rad säger *sedan 08:15* för den som öppnat guiden och
   * behöver veta om det är värt att ta över; i listan är frågan bara *kan jag
   * börja här nu*, och ett klockslag till per rad är brus i tjugo rader.
   */
  lockedBy: { sv: "Låst av {name}", en: "Locked by {name}" },
  /*
   * Arbetsanteckningen under titeln (berättelse 130).
   *
   * Namnet först och orden sedan, som i editorns rad — men **utan klockslag**,
   * av samma skäl som låsraden ovan: i listan är frågan *är den här färdig att
   * publicera*, och en tid per rad är brus i tjugo rader. Den som öppnar
   * guiden får tiden där.
   */
  noteBy: { sv: "{name}: ”{text}”", en: "{name}: “{text}”" },
  /** The accessible name of the row's link: `{name}` is the guide's title. */
  openGuide: { sv: "Öppna {name}", en: "Open {name}" },

  /* ── Nothing to show, and the three different reasons ────────────────── */

  none: {
    sv: "Det finns inga guider än. Ny guide skapar den första.",
    en: "There are no guides yet. New guide makes the first one.",
  },
  /*
   * Och den fjärde tomma skärmen, som filtret gör möjlig: det finns guider,
   * men inga av dina. Ett *Det finns inga guider än* där hade varit osant på
   * ett sätt som får någon att skapa en till.
   */
  noneMine: {
    sv: "Du har inga egna guider än. Ta bort Bara mina för att se allas.",
    en: "You have no guides of your own yet. Clear Only mine to see everyone's.",
  },
  noMatches: {
    sv: "Ingen guide heter så.",
    en: "No guide is called that.",
  },
  /*
   * Och vägen ut ur den tomma skärmen. Knappen står i beskedet och inte bredvid
   * fältet: det är där man befinner sig när man behöver den, och ett fält med
   * en rensningsknapp bredvid sig hela tiden är en knapp man ser och aldrig
   * trycker på. Escape gör samma sak från fältet.
   */
  clearSearch: { sv: "Rensa sökningen", en: "Clear the search" },
  /*
   * A host without a provider. Not an error — it is the documented other half
   * of story 126, where the guide's secret is the identity — so it says what to
   * do rather than what is wrong (PRAXIS 7).
   */
  noLogin: {
    sv: "Den här värden har ingen inloggning. Guiderna öppnas då med sin egen adress och hemlighet, som guides.mjs new ger på servern.",
    en: "This host has no sign-in. Guides are opened with their own address and secret instead, which guides.mjs new prints on the server.",
  },
  noHost: {
    sv: "Ingen värd är inkopplad, så det finns inga guider att visa.",
    en: "No host is connected, so there are no guides to show.",
  },
  unreachable: { sv: "Värden gick inte att nå.", en: "The host could not be reached." },
  couldNotCreate: {
    sv: "Guiden kunde inte skapas. Försök igen, eller säg till den som driftar värden.",
    en: "The guide could not be created. Try again, or tell whoever runs the host.",
  },

  /* ── Hur många listan visar ──────────────────────────────────────────── */

  /*
   * Två former, och skillnaden är om något smalnar av listan just nu — en
   * sökning, kryssrutan, eller båda. *5 guider* svarar *hur mycket finns det*;
   * *2 av 5 guider* svarar *hur mycket ser jag av det*, vilket är den fråga man
   * har medan man skriver.
   *
   * `{n}` är det som visas, `{m}` allt värden listade.
   */
  count: { sv: "{n} guider", en: "{n} guides" },
  /*
   * Ental, och det enda ordet som stavas likadant på båda språken — vilket
   * `guides-words.test.ts` räknar upp vid namn hellre än att mjuka upp regeln.
   */
  countOne: { sv: "1 guide", en: "1 guide" },
  countFiltered: { sv: "{n} av {m} guider", en: "{n} of {m} guides" },
} as const satisfies Record<string, Pair>;

export type GuidesWordKey = keyof typeof WORDS;

/** Every key, for a test that wants to walk them without a second list. */
export const GUIDES_WORD_KEYS = Object.keys(WORDS) as GuidesWordKey[];

/**
 * One language's words, plus the interpolation the three sentences with a
 * placeholder need.
 *
 * `{name}` and friends rather than string concatenation, because the two
 * languages put them in different places and a sentence built out of pieces can
 * only be built in one order.
 */
export function guideWords(locale: SiteLocale) {
  const say = (key: GuidesWordKey, values: Record<string, string | number> = {}): string =>
    Object.entries(values).reduce<string>(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      WORDS[key][locale === "en" ? "en" : "sv"],
    );

  return say;
}

/**
 * A single source of truth for the start page's example list. Both the page
 * (the nav HTML is generated at build/dev time by a Vite plugin) and the tests
 * read from here, so a new example only has to be added here to appear — no
 * hand-written HTML to forget.
 *
 * **One guide per entry, two doors**: the same guide can be opened in the editor
 * (`build`) and run as a visitor (`try`). They used to be two separate lists,
 * which meant every guide was listed twice — in one place with word-for-word the
 * same heading in both. That duplication was what made the page feel monotonous,
 * not the look of the cards.
 *
 * Some entries have only one door: editor profiles without a guide of their own,
 * and viewer modes that are not built anywhere.
 */

/** Swedish and English, the two languages the example site is written in. */
export interface SiteText {
  sv: string;
  en: string;
}

export type SiteLocale = keyof SiteText;

export interface ExampleGuide {
  title: SiteText;
  description: SiteText;
  /** The editor for the guide. */
  build?: string;
  /** The finished guide. */
  try?: string;
  /**
   * FlowWeaver PRO: the guide sends something in — a submission or an e-mail
   * result — so it needs the PRO bundles and is shown in the PRO tier of the
   * start page (Johan 6/10). Absent means the open FlowWeaver.
   */
  pro?: true;
}

export interface ExampleSection {
  id: string;
  heading: SiteText;
  intro: SiteText;
  guides: ExampleGuide[];
  /** Less prominent examples under a "Visa alla" disclosure. */
  collapsed?: ExampleGuide[];
}

export const EXAMPLE_CATALOG_LEAD: SiteText = {
  sv:
    "Utforska i din egen takt. Först det öppna FlowWeaver — beslutsguider " +
    "med frågor, regler och svar. Sedan FlowWeaver PRO, där besökaren också " +
    "<em>skickar in</em>. Varje guide kan du både <em>bygga om</em> i editorn " +
    "och <em>prova</em> som besökare.",
  en:
    "Explore at your own pace. First the open FlowWeaver — decision guides " +
    "with questions, rules and answers. Then FlowWeaver PRO, where the " +
    "visitor also <em>sends it in</em>. Every guide can be both " +
    "<em>rebuilt</em> in the editor and <em>tried</em> as a visitor.",
};

/** The PRO tier's own words — what PRO adds, shown above its guides. */
export const PRO_TIER: { heading: SiteText; intro: SiteText; link: SiteText; adds: SiteText[] } = {
  heading: { sv: "FlowWeaver PRO — e-tjänster", en: "FlowWeaver PRO — e-services" },
  link: { sv: "Allt om FlowWeaver PRO, med guiderna att prova", en: "All about FlowWeaver PRO, with the guides to try" },
  intro: {
    sv:
      "Det öppna FlowWeaver hjälper besökaren fram till ett svar. PRO låter " +
      "besökaren skicka in det: svaren blir ett ärende hos er mottagare, " +
      "besökaren får ett kvitto med referensnummer, och redaktören ser vart " +
      "det går. Guiderna här är byggda med PRO.",
    en:
      "The open FlowWeaver helps the visitor reach an answer. PRO lets the " +
      "visitor send it in: the answers become a case with your receiver, the " +
      "visitor gets a receipt with a reference number, and the editor sees " +
      "where it goes. The guides here are built with PRO.",
  },
  adds: [
    { sv: "Noderna Inlämning och E-postresultat", en: "The Submission and Email result nodes" },
    { sv: "Mottagarkontraktet: katalog, kvitto, återförsök — aldrig adresser i guiden", en: "The receiver contract: catalog, receipt, retry — never addresses in the guide" },
    { sv: "Schemat för det som skickas, stämplat vid export", en: "The schema of what is sent, stamped at export" },
    { sv: "Hälsoregler om mottagare, granskning och schema", en: "Health rules about recipients, review and schema" },
    { sv: "Raden i mottagarens lista, ärendetyp ur kodlista, mejlkopia till besökaren", en: "The row in the receiver's list, case type from a code list, an e-mail copy to the visitor" },
  ],
};

/**
 * The renderer's own words. They are the site's, like everything else here —
 * see `src/localization/` for the two tables that are the *product's*, which
 * these are not. Story 014 keeps the axes apart, and this is a fourth surface:
 * our documentation.
 */
const NAV_WORDS = {
  navLabel: { sv: "Flowweaver-exempel", en: "Flowweaver examples" },
  build: { sv: "Bygg om", en: "Rebuild" },
  try: { sv: "Prova", en: "Try" },
  showAll: { sv: "Visa alla exempel", en: "Show every example" },
} as const;

export const EXAMPLE_CATALOG: ExampleSection[] = [
  {
    id: "kom-igang",
    heading: { sv: "Kom igång", en: "Getting started" },
    intro: { sv: "Beslutsguider med frågor, alternativ, regler och resultat — grunden i Flowweaver. Räcker för de flesta guider.", en: "Decision guides with questions, options, rules and results — the foundation of Flowweaver, and enough for most guides." },
    guides: [
      {
        title: { sv: "Hitta rätt e-tjänst", en: "Find the right e-service" },
        description: { sv: "En vägvisare: några frågor som leder till rätt e-tjänst eller guide — innan besökaren öppnat fel blankett.", en: "A wayfinder: a few questions that lead to the right e-service or guide — before the visitor opens the wrong form." },
        build: "./examples/service-finder-editor.html",
        try: "./examples/service-finder.html",
      },
      {
        title: { sv: "Kan du ha rätt till bostadsbidrag?", en: "Might you be eligible for housing allowance?" },
        description: { sv: "Ett par frågor, en regel och ett svar direkt — berättelsen från startsidan.", en: "A couple of questions, one rule and an answer straight away — the story from the start page." },
        build: "./examples/housing-screening-editor.html",
        try: "./examples/housing-screening.html",
      },
      {
        title: { sv: "Enkel guide", en: "A simple guide" },
        description: { sv: "Den avskalade editorn, och guiden den producerar. Börja här om du bygger din första.", en: "The stripped-down editor, and the guide it produces. Start here if you are building your first." },
        build: "./examples/editor-basic.html",
        try: "./examples/preview-basic.html",
      },
    ],
  },
  {
    id: "anvandningsomraden",
    heading: { sv: "Fler användningsområden", en: "More things to use it for" },
    intro: { sv: "Samma princip — frågor, regler och resultat — används i helt andra sammanhang, till exempel nyföretagarrådgivning.", en: "The same idea — questions, rules and results — works in quite different settings, such as advice for new businesses." },
    guides: [
      {
        /*
         * The odd one out on purpose: every other guide here answers "am I
         * entitled to something" and ends in an amount. This one answers "why
         * is this not working" and ends in an action — and it is the biggest
         * flow we ship, which is the only way to show that a big one stays
         * readable.
         */
        title: { sv: "Skrivaren skriver inte ut", en: "The printer will not print" },
        description: {
          sv: "En felsökningsguide: fyra grenar, tjugofyra noder, och svaret är något att göra i stället för ett belopp.",
          en: "A troubleshooting guide: four branches, twenty-four nodes, and the answer is something to do rather than an amount.",
        },
        build: "./examples/troubleshooting-editor.html",
        try: "./examples/troubleshooting.html",
      },
      {
        title: { sv: "Vilken bolagsform passar dig?", en: "Which company form suits you?" },
        description: { sv: "Beslutsguide för nyföretagare: några frågor grenar till olika förslag.", en: "A decision guide for new businesses: a few questions branch to different suggestions." },
        build: "./examples/business-form-editor.html",
        try: "./examples/business-form.html",
      },
    ],
  },
  /*
   * Företag (story 105): exemplen ovanför är kommunala rakt igenom, och en
   * läsare från ett försäkringsbolag känner inte igen sig i ett av dem. Den
   * här sektionen är samma verktyg riktat åt andra hållet — inget i guiderna
   * här är en nodtyp som de kommunala exemplen saknar.
   *
   * Story 109 la fem guider för små firmor bredvid skadeanmälan och gav
   * intron sin andra mening. Editorns *mallar* är nodmallar; en guidemall är
   * i praktiken ett exempel man öppnar med *Bygg om*, byter namn i och
   * exporterar — mekanismen fanns, men ingenting sa det. Nu står det där den
   * läses: bredvid korten, inte i en hjälptext.
   */
  {
    id: "foretag",
    heading: { sv: "Företag", en: "Companies" },
    intro: { sv: "Exemplen här är byggda för bolag i stället för kommun — samma frågor, regler och resultat, i en privat e-tjänst. Var och en är också en mall: öppna, byt namn, spara som din.", en: "The examples here are built for companies rather than a municipality — the same questions, rules and results, in a private e-service. Each one is also a template: open it, rename it, save it as your own." },
    guides: [
      {
        title: { sv: "Skadeanmälan", en: "Insurance claim" },
        description: {
          sv: "En skadeanmälan hos ett påhittat försäkringsbolag: försäkringen ur registret, följdfrågor efter typen av skada, platsen på karta, bilder — och ersättningen efter självrisken uträknad medan du skriver.",
          en: "A claim at a made-up insurer: the policy from the register, follow-up questions per type of damage, the place on a map, pictures — and the compensation after the deductible worked out as you type.",
        },
        pro: true,
        build: "./examples/claim-editor.html",
        try: "./examples/claim.html",
      },
      {
        title: { sv: "Offertförfrågan", en: "Quote request" },
        description: {
          sv: "En målarfirma frågar det den måste veta för att kunna lämna pris — arbetet, rummen och ytan — och räknar fram en grov uppskattning medan kunden skriver.",
          en: "A painting firm asks what it has to know before quoting — the trade, the rooms and the area — and works out a rough estimate as the customer types.",
        },
        pro: true,
        build: "./examples/quote-editor.html",
        try: "./examples/quote.html",
      },
      {
        title: { sv: "Bokningsförfrågan", en: "Booking request" },
        description: {
          sv: "En salong utan kalender: tjänsten ur firmans egen lista, två dagar som fungerar, och ett e-postunderlag att svara på — ingenting är bokat förrän någon svarat.",
          en: "A salon without a calendar: the service out of the firm's own list, two days that would work, and an email draft to answer — nothing is booked until somebody answers.",
        },
        pro: true,
        build: "./examples/booking-editor.html",
        try: "./examples/booking.html",
      },
      {
        title: { sv: "Medlemsansökan", en: "Membership application" },
        description: {
          sv: "En förening där medlemstypen avgör både vilka som ingår och vad det kostar: familjen läggs till en rad i taget, och avgiften står bredvid samtycket.",
          en: "An association where the kind of membership decides both who is covered and what it costs: the family is added a line at a time, and the fee stands beside the consent.",
        },
        pro: true,
        build: "./examples/membership-editor.html",
        try: "./examples/membership.html",
      },
      {
        title: { sv: "Reklamation", en: "Complaint" },
        description: {
          sv: "En e-handel där ordern och varan kommer ur registret och varje fel har sin egen följdfråga — två regler i rad, så både den trasiga sömmen och den felaktiga storleken hinner frågas.",
          en: "An online shop where the order and the item come from the register and every fault has its own follow-up — two rules in a row, so both the torn seam and the wrong size get asked about.",
        },
        pro: true,
        build: "./examples/complaint-editor.html",
        try: "./examples/complaint.html",
      },
      {
        title: { sv: "Anmälan till konferens", en: "Conference registration" },
        description: {
          sv: "Frågor som bara ställs ibland, en meny utan det du är allergisk mot, ett pass i taget så många du vill — och en anmälan som blir en plats i kön när arrangörens platser är slut. Antalet platser bor hos arrangören, inte i guiden.",
          en: "Questions that are only asked sometimes, a menu without what you are allergic to, one session at a time for as many as you like — and a registration that becomes a place in the queue when the organiser has run out of places. The number of places lives with the organiser, not in the guide.",
        },
        pro: true,
        build: "./examples/conference-editor.html",
        try: "./examples/conference.html",
      },
      {
        title: { sv: "Flyttanmälan", en: "Notice to move out" },
        description: {
          sv: "Ett bostadsbolag där uppsägningstiden kommer ur kontraktet och inte ur formuläret — och hyresdagarna räknas medan hyresgästen väljer utflyttningsdag.",
          en: "A housing company where the notice period comes from the contract rather than the form — and the days of rent are counted while the tenant picks the day.",
        },
        pro: true,
        build: "./examples/moving-editor.html",
        try: "./examples/moving.html",
      },
    ],
  },
  /*
   * Enkäter — its own section from the day the rating field arrived (story
   * 115). Not under *Företag*: a survey is not an errand somebody sends in to
   * get something back, it is the organisation asking, and a visitor looking
   * for one is looking for a different kind of thing.
   */
  {
    id: "enkater",
    heading: { sv: "Enkäter", en: "Surveys" },
    intro: {
      sv: "Frågor besvarade på en skala, flera på samma sida — samma verktyg, samma inlämning som guiderna.",
      en: "Questions answered on a scale, several on one page — the same tool and the same submission as the guides.",
    },
    guides: [
      {
        title: { sv: "Hur trivs du?", en: "How do you like living here?" },
        description: {
          sv: "Ett bostadsbolags trivselenkät: en väg att tacka nej från start, tre betyg på en rad under en grupprubrik, ett betyg 1–10 på egen sida, en följdfråga vid lågt betyg och ett snitt i tacket.",
          en: "A housing company's tenant survey: a way to decline right at the start, three ratings on one row under a heading, a 1–10 rating on its own page, a follow-up question when the rating is low, and an average in the thanks.",
        },
        pro: true,
        build: "./examples/survey-editor.html",
        try: "./examples/survey.html",
      },
    ],
  },
  {
    id: "affarslogik",
    heading: { sv: "Affärslogik", en: "Business logic" },
    intro: { sv: "När guiden ska räkna ut något eller samla in uppgifter: variabler, uträkningar med formler och fältvalidering.", en: "When the guide has to calculate something or collect details: variables, formula calculations and field validation." },
    guides: [
      {
        // The calculator a comparison site has, open; PRO's "Låna" is the
        // same page ending in an application (Johan 8/10).
        title: { sv: "Lånekalkyl", en: "Loan calculator" },
        description: { sv: "Dra i reglaget: månadskostnaden räknas om medan besökaren ändrar beloppet och lånetiden, och svaret står direkt på sidan.", en: "Drag the slider: the monthly cost is recalculated while the visitor changes the amount and the term, and the answer is right there on the page." },
        build: "./examples/loan-calculator-editor.html",
        try: "./examples/loan-calculator.html",
      },
      {
        title: { sv: "Låna", en: "Borrow" },
        description: { sv: "Lånekalkylen, men besökaren granskar och skickar in en ansökan.", en: "The loan calculator, but the visitor reviews and sends in an application." },
        pro: true,
        build: "./examples/borrow-editor.html",
        try: "./examples/borrow.html",
      },
      {
        title: { sv: "Bostadsbidrag – uträkning", en: "Housing allowance – calculation" },
        description: { sv: "En uträkningsnod räknar fram ett preliminärt månadsbidrag, och en regel grenar på resultatet.", en: "A calculation node works out a preliminary monthly amount, and a rule branches on the result." },
        build: "./examples/housing-allowance-calc-editor.html",
        try: "./examples/housing-allowance-calc.html",
      },
      {
        title: { sv: "Bostadsbidrag – underlag", en: "Housing allowance – details" },
        description: { sv: "Personnummer, boendekostnad, yta och inkomst — med formatvalidering och gränser som fångar fel direkt.", en: "Identity number, housing cost, floor area and income — with format validation and limits that catch mistakes at once." },
        pro: true,
        build: "./examples/housing-allowance-editor.html",
        try: "./examples/housing-allowance.html",
      },
      {
        title: { sv: "Variabler, regler och validering", en: "Variables, rules and validation" },
        description: { sv: "Editorn med allt påslaget, och samma guide körd en fråga i taget.", en: "The editor with everything switched on, and the same guide run one question at a time." },
        build: "./examples/editor-advanced.html",
        try: "./examples/preview.html",
      },
    ],
  },
  {
    id: "avancerade",
    heading: { sv: "Avancerade flöden", en: "Advanced flows" },
    intro: { sv: "E-tjänster med flera fält per sida, Page Builder, e-postresultat och säker körning på servern.", en: "E-services with several fields per page, the Page Builder, email results and secure execution on the server." },
    guides: [
      {
        title: { sv: "E-tjänst med sidor och fält", en: "An e-service with pages and fields" },
        description: { sv: "Flera fält besvaras på samma sida i stället för en fråga i taget.", en: "Several fields are answered on one page instead of one question at a time." },
        pro: true,
        build: "./examples/editor-service.html",
        try: "./examples/preview-service.html",
      },
      {
        title: { sv: "Page Builder", en: "Page Builder" },
        description: { sv: "Responsiva Pages med fält, texter och blanka rader — och samma Page renderad som fristående tjänst.", en: "Responsive pages with fields, texts and blank rows — and the same page rendered as a service of its own." },
        pro: true,
        build: "./examples/page-builder.html",
        try: "./examples/page-viewer.html",
      },
      {
        // Built in the e-service editor — it is the same guide as "E-tjänst
        // med sidor och fält", run a different way. Both rows' rebuild door
        // therefore points at the same editor; see the deliberate sharing in
        // examples-links.test.ts.
        title: { sv: "Säker körning (simulerad BFF)", en: "Secure execution (a simulated BFF)" },
        description: { sv: "Samma e-tjänst körd genom en backend-for-frontend. Klienten får formelfria vymodeller — kalkylen och reglerna stannar på servern.", en: "The same e-service run through a backend-for-frontend. The client gets formula-free view models — the calculation and the rules stay on the server." },
        build: "./examples/editor-service.html",
        pro: true,
        try: "./examples/secure-runtime.html",
      },
      {
        title: { sv: "Plats på karta", en: "A place on a map" },
        description: {
          sv: "\u201dLyktstolpen vid lekplatsen\u201d går att peka på fast den saknar adress: en punkt, flera punkter eller ett ritat område — genom värdens egen karttjänst, inte en inbyggd.",
          en: "\u201cThe streetlight by the playground\u201d can be pointed at although it has no address: a point, several points or a drawn area — through the host's own map service, not a bundled one.",
        },
        build: "./examples/map-editor.html",
        try: "./examples/map.html",
      },
      {
        title: { sv: "Hela editorn", en: "The whole editor" },
        description: { sv: "Editorn utan profilbegränsningar, och samma guide körd med tidigare svar synliga ovanför aktuellt steg.", en: "The editor with no profile limits, and the same guide run with earlier answers visible above the current step." },
        build: "./examples/editor.html",
        try: "./examples/preview-history.html",
      },
    ],
    collapsed: [
      {
        title: {
          sv: "Felanmälan",
          en: "Fault report",
        },
        description: {
          sv: "En felanmälan från början till slut: kontaktuppgifter på en sida, platsen på en karta, kategori ur ett uppslag, foto med markeringar, och problemet i egna ord.",
          en: "A fault report end to end: contact details on one page, the place on a map, a category from a lookup, a photo with marks, and the problem in the resident's own words.",
        },
        pro: true,
        build: "./examples/every-field-editor.html",
        try: "./examples/every-field.html",
      },
      {
        title: {
          sv: "Flera länder ur en sluten lista",
          en: "Several countries from a closed list",
        },
        description: {
          sv: "Ett fält som väljer flera länder ur Skatteverkets landskoder, och en regel som förgrenar på koderna i stället för på namnen. Dubbelt medborgarskap är vanligt — pröva Danmark och Turkiet ihop.",
          en: "A field picking several countries from the Swedish Tax Agency's codes, and a rule branching on the codes rather than the names. Dual citizenship is ordinary — try Denmark and Turkey together.",
        },
        build: "./examples/citizenship-editor.html",
        try: "./examples/citizenship.html",
      },
      {
        title: {
          sv: "En kommun, och koden bakom namnet",
          en: "One municipality, and the code behind the name",
        },
        description: {
          sv: "Samma sorts lista, ett enda svar: en kommun ur SCB:s 290, och en regel som prövar kommunkoden i stället för namnet. Resultatet skriver ut båda delarna, så det syns vad ett svar med delar är.",
          en: "The same kind of list, a single answer: one municipality from Statistics Sweden's 290, and a rule testing the code rather than the name. The result prints both parts, so what an answer with parts is can be seen.",
        },
        build: "./examples/municipality-editor.html",
        try: "./examples/municipality.html",
      },
      {
        title: {
          sv: "Lägg till en egen kodlista",
          en: "Add a code list of your own",
        },
        description: {
          sv: "För dig som kopplar in: fyra rader som hämtar en JSON-fil och registrerar den, med källan bredvid guiden som använder den. Inget är inbyggt — en lista är något du lägger till.",
          en: "For whoever integrates: four lines that fetch a JSON file and register it, with the source beside the guide that uses it. Nothing is bundled — a list is something you add.",
        },
        try: "./examples/code-lists.html",
      },
      {
        title: { sv: "Genomgång: bygg en frågeguide", en: "Walkthrough: build a question guide" },
        description: { sv: "En genomstegning med skärmdumpar som visar hur du sätter upp en enkel guide.", en: "A step-by-step with screenshots showing how to set up a simple guide." },
        try: "./examples/tutorial-question-guide.html",
      },
      {
        title: { sv: "E-postresultat med bifogad fil", en: "Email result with an attachment" },
        description: { sv: "Producera ett e-postunderlag och få den bifogade filen med tillbaka — utan att något laddas upp eller skickas.", en: "Produce an email draft and get the attached file back with it — nothing is uploaded and nothing is sent." },
        pro: true,
        try: "./examples/email-result.html",
      },
      {
        title: { sv: "Inlämning och kvittens", en: "Submission and receipt" },
        description: { sv: "Granska svaren, lämna in och få mottagarens referensnummer — och se det ärliga felet när mottagaren avvisar. Inget skickas.", en: "Review the answers, submit and get the receiver's reference number — and see the honest failure when the receiver rejects. Nothing is sent." },
        pro: true,
        build: "./examples/submission-editor.html",
        try: "./examples/submission.html",
      },
      {
        title: { sv: "Beställ blanketter", en: "Order forms" },
        description: { sv: "En sida som upprepas i stället för ett mappträd: besökaren väljer blankett i ett uppslag, anger antal och lägger till fler. Granskning per sida och ett mejl som räknar dem.", en: "A repeating page instead of a folder tree: the visitor picks a form from a lookup, says how many and adds more. A review per page and an email that counts them." },
        pro: true,
        build: "./examples/form-order-editor.html",
        try: "./examples/form-order.html",
      },
      {
        /*
         * Utgivarens halva har en egen rad, för den är ett eget arbete: den
         * görs en gång, av någon annan, i ett annat system. Låg katalogen kvar
         * ovanför guiden såg den ut som en del av formuläret.
         */
        title: { sv: "Mottagarna", en: "The recipients" },
        description: { sv: "Utgivarens halva: katalogen med adresser, standardmottagaren, och varför adressen aldrig når webbläsaren.", en: "The publisher's half: the catalog with addresses, the default recipient, and why the address never reaches the browser." },
        pro: true,
        try: "./examples/recipients.html",
      },
    ],
  },
];

/** A flat list of every example with its section and type — for tests and so on. */
export function flattenCatalog(): Array<{
  section: string;
  kind: "editor" | "guide";
  href: string;
}> {
  return EXAMPLE_CATALOG.flatMap((section) =>
    [...section.guides, ...(section.collapsed ?? [])].flatMap((guide) => [
      ...(guide.build
        ? [{ section: section.id, kind: "editor" as const, href: guide.build }]
        : []),
      ...(guide.try
        ? [{ section: section.id, kind: "guide" as const, href: guide.try }]
        : []),
    ]),
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * A door into the guide. The label is the same word everywhere ("Bygg om" /
 * "Prova"), so `aria-label` carries the guide's name — otherwise screen readers
 * would get a list of ten identical links with no context.
 */
function renderDoor(
  guide: ExampleGuide,
  sectionId: string,
  kind: "editor" | "guide",
  locale: SiteLocale,
  base = "",
): string {
  // The catalogue's hrefs are written from the start page ("./examples/…");
  // a page one directory down (/pro/) passes "../" and the link still lands.
  const own = kind === "editor" ? guide.build : guide.try;
  const href = own ? base + own.replace(/^\.\//, base ? "" : "./") : own;

  // When a door is missing the slot is left empty rather than dropped.
  // Otherwise the remaining door slides into the other's column, and the row
  // breaks the line the others stand on.
  if (!href) {
    return `
                  <span class="examples-index__door-gap" aria-hidden="true"></span>`;
  }

  const label = kind === "editor" ? NAV_WORDS.build[locale] : NAV_WORDS.try[locale];
  const modifier = kind === "editor" ? "build" : "try";

  return `
                  <a class="examples-index__door examples-index__door--${modifier}" href="${escapeHtml(href)}" data-module="${escapeHtml(sectionId)}" data-kind="${kind}" aria-label="${escapeHtml(`${label} ${guide.title[locale]}`)}">${label}</a>`;
}

function renderGuide(
  guide: ExampleGuide,
  sectionId: string,
  locale: SiteLocale,
  base = "",
): string {
  return `
              <li class="examples-index__guide">
                <span class="examples-index__guide-text">
                  <strong>${escapeHtml(guide.title[locale])}${guide.pro ? '<span class="examples-index__pro-badge">PRO</span>' : ""}</strong>
                  <span>${escapeHtml(guide.description[locale])}</span>
                </span>
                <span class="examples-index__doors">${renderDoor(guide, sectionId, "editor", locale, base)}${renderDoor(guide, sectionId, "guide", locale, base)}
                </span>
              </li>`;
}

function renderGuideList(
  guides: ExampleGuide[],
  sectionId: string,
  locale: SiteLocale,
  base = "",
): string {
  return `
            <ul class="examples-index__guides">${guides
              .map((guide) => renderGuide(guide, sectionId, locale, base))
              .join("")}
            </ul>`;
}

/** A "Visa alla" disclosure for less prominent examples. */
function renderCollapsed(
  guides: ExampleGuide[],
  sectionId: string,
  locale: SiteLocale,
  base = "",
): string {
  if (guides.length === 0) {
    return "";
  }

  return `
          <details class="examples-index__more-details">
            <summary>${NAV_WORDS.showAll[locale]}</summary>${renderGuideList(guides, sectionId, locale, base)}
          </details>`;
}

/**
 * Generates the whole <nav> block for the start page from the catalogue.
 *
 * The locale is the *site's*, not the tool's and not a guide's. A reader on the
 * English pages can still open a Swedish guide — a guide's language belongs to
 * whoever wrote it. See story 014.
 */
/**
 * One tier of the start page: the catalogue's sections with only the guides
 * of that tier, sections with none left out. `idPrefix` keeps the two tiers'
 * heading ids apart ("module-foretag" and "pro-foretag").
 */
function renderTier(
  tier: "open" | "pro",
  idPrefix: string,
  locale: SiteLocale,
  base = "",
  flatten = false,
): string {
  const inTier = (guide: ExampleGuide): boolean => (tier === "pro") === (guide.pro === true);
  return EXAMPLE_CATALOG.map((section) => {
    // `flatten`: /pro shows every PRO guide in the open — the page exists to
    // demonstrate them, and a closed <details> there hid half of them.
    const guides = [...section.guides, ...(flatten ? section.collapsed ?? [] : [])].filter(inTier);
    const collapsed = flatten ? [] : (section.collapsed ?? []).filter(inTier);
    if (guides.length === 0 && collapsed.length === 0) return "";
    return `
        <section class="examples-index__group" aria-labelledby="${idPrefix}-${escapeHtml(section.id)}">
          <h3 id="${idPrefix}-${escapeHtml(section.id)}">${escapeHtml(section.heading[locale])}</h3>
          <p>${escapeHtml(section.intro[locale])}</p>${renderGuideList(guides, section.id, locale, base)}${renderCollapsed(collapsed, section.id, locale, base)}
        </section>`;
  }).filter(Boolean).join("\n");
}

/** What PRO adds, as a list — on the start page's teaser and on /pro. */
export function renderProAdds(locale: SiteLocale): string {
  return `<ul class="examples-index__pro-adds">${PRO_TIER.adds.map((item) => `<li>${escapeHtml(item[locale])}</li>`).join("")}</ul>`;
}

/** The PRO guides, section by section — the demonstrations on /pro, one directory down. */
export function renderProGuides(locale: SiteLocale): string {
  return renderTier("pro", "pro", locale, "../", true);
}

export function renderExamplesNav(locale: SiteLocale = "en"): string {
  // Two tiers (Johan 6/10): the open FlowWeaver here, then a teaser for
  // FlowWeaver PRO — everything about PRO, the e-services and their
  // demonstrations included, lives under /pro/ ("/pro där ligger allt om PRO").
  return `<nav aria-label="${NAV_WORDS.navLabel[locale]}">
        <p class="examples-index__nav-lead">${EXAMPLE_CATALOG_LEAD[locale]}</p>
${renderTier("open", "module", locale)}
        <section class="examples-index__pro" aria-labelledby="pro-tier">
          <h2 id="pro-tier">${escapeHtml(PRO_TIER.heading[locale])}</h2>
          <p class="examples-index__pro-intro">${escapeHtml(PRO_TIER.intro[locale])}</p>
          <p><a class="examples-index__pro-link" href="./pro/">${escapeHtml(PRO_TIER.link[locale])}</a></p>
        </section>
      </nav>`;
}

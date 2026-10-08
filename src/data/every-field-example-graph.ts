import type { GraphData } from "../viewer/types/graph";

/**
 * A guide that reaches every viewer text we ship.
 *
 * ## Why it exists
 *
 * Once the translation count started measuring what a guide can actually show,
 * it became possible to ask the other question: which of our texts does *no*
 * example reach? The answer was **22 of 49** — the whole lookup control, the
 * multiple-choice hints, three of the four format messages, both image texts.
 *
 * Nothing on the site rendered them. We had never seen them on a screen, and a
 * host reading the examples never learned they existed. A string nobody has
 * looked at is a string nobody has checked: the wrong word, the wrong length,
 * the wrong tone, and no way to notice.
 *
 * ## Why it is a service and not a fixture
 *
 * It would have been shorter to list one node per feature. But an example is
 * read as advice, and a page of unrelated fields advises nothing except that
 * the tool has fields. This is a municipal fault report — something a resident
 * would actually fill in — and it uses everything because a fault report
 * genuinely needs a name, a way to be reached, an address from a register, a
 * category, a duration and a picture.
 *
 * It is also the fixture that exercises `reachableViewerKeys` at its maximum: a
 * guide that reaches all 49 is the only way to know the calculation does not
 * quietly stop somewhere.
 */
export const everyFieldExampleGraph: GraphData = {
  startNodeId: "ef-page",
  nodes: [
    // ── A page: several fields answered together ────────────────────────────
    {
      id: "ef-page",
      type: "page",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Om dig", en: "About you" },
        description: { sv: "Vi behöver kunna nå dig om vi har frågor om felet.", en: "We need to reach you if we have questions about the fault." },
      },
    },
    /*
     * Felet på en egen sida, efter dig.
     *
     * "Om dig" bar först både när felet märktes och ett foto av det, vilket
     * Johan sa emot med en mening som håller: en sida som säger "vi behöver
     * kunna nå dig" ska bära kontakt och identitet, inget annat. Det som handlar
     * om felet är efterföljande uppgifter och hör hemma efter.
     */
    {
      id: "ef-page-fault",
      type: "page",
      position: { x: 0, y: 1540 },
      data: {
        title: { sv: "Om felet", en: "About the fault" },
        description: { sv: "Det här hjälper oss att bedöma hur brådskande det är.", en: "This helps us judge how urgent it is." },
      },
    },
    {
      id: "ef-heading",
      type: "page-heading",
      parentPageId: "ef-page",
      order: 0,
      position: { x: 0, y: 0 },
      data: { title: { sv: "Kontaktuppgifter", en: "Contact details" } },
    },
    {
      id: "ef-name",
      type: "text-question",
      parentPageId: "ef-page",
      order: 1,
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Ditt namn", en: "Your name" },
        variableName: "namn",
        placeholder: { sv: "För- och efternamn", en: "First and last name" },
        required: true,
        minLength: 2,
        maxLength: 60,
      },
    },
    {
      id: "ef-email",
      type: "text-question",
      parentPageId: "ef-page",
      order: 2,
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "E-postadress", en: "Email address" },
        variableName: "epost",
        required: true,
        format: "email",
      },
    },
    {
      id: "ef-phone",
      type: "text-question",
      parentPageId: "ef-page",
      order: 3,
      position: { x: 0, y: 0 },
      data: { title: { sv: "Telefonnummer", en: "Phone number" }, variableName: "telefon", format: "phone" },
    },
    
    {
      id: "ef-samtycke",
      type: "consent-question",
      parentPageId: "ef-page",
      order: 10,
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Jag godkänner att uppgifterna behandlas", en: "I agree to my details being processed" },
        variableName: "samtycke",
        required: true,
      },
    },
    {
      id: "ef-datum",
      type: "date-question",
      parentPageId: "ef-page-fault",
      order: 1,
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "När märkte du felet?", en: "When did you notice the fault?" },
        variableName: "datum",
        min: "2020-01-01",
        // A fault is noticed in the past: the bound moves with the day (044).
        max: "idag",
      },
    },
    {
      id: "ef-postnummer",
      type: "text-question",
      parentPageId: "ef-page",
      order: 5,
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Postnummer", en: "Postcode" },
        variableName: "postnummer",
        format: "postnummer",
      },
    },
    {
      id: "ef-orgnr",
      type: "text-question",
      parentPageId: "ef-page",
      order: 6,
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Organisationsnummer", en: "Organisation number" },
        description: { sv: "Om anmälan görs för ett företags räkning.", en: "If the report is made on behalf of a company." },
        variableName: "orgnr",
        format: "organisationsnummer",
      },
    },
    {
      id: "ef-id",
      type: "text-question",
      parentPageId: "ef-page",
      order: 7,
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Personnummer", en: "Identity number" },
        description: { sv: "Bara om felet gäller en pågående ansökan.", en: "Only if the fault concerns an application in progress." },
        variableName: "personnummer",
        format: "personnummer",
      },
    },
    {
      id: "ef-ref",
      type: "text-question",
      parentPageId: "ef-page",
      order: 8,
      position: { x: 0, y: 0 },
      data: {
        /*
         * Ett kundnummer och inte ett ärendenummer: ett ärendenummer får man,
         * man skriver det inte själv — och att be någon om det på en sida som
         * heter "Om dig" är att fråga efter något de inte har. Fältet finns för
         * att öva en värds **egen** `regex`-form, och sex siffror från en
         * faktura gör samma tjänst utan att be om det omöjliga.
         */
        title: { sv: "Kundnummer", en: "Customer number" },
        description: { sv: "Sex siffror, står på din faktura.", en: "Six digits, on your invoice." },
        variableName: "kundnummer",
        // A pattern of the host's own: the generic "wrong format" message.
        format: "regex",
        pattern: "^\\d{6}$",
      },
    },

    // ── The lookup control: an address from a register ──────────────────────
    {
      /*
       * Var kartan (046). Vad kategorisöket. Johans omtag 2026-08-25: när
       * kartan pekar ut platsen kollapsar gatuadressuppslagets roll — så
       * uppslaget bytte jobb till kategorierna, där en riktig kommunal lista
       * är för lång för kryssrutor och sökningen gör nytta på riktigt.
       */
      id: "ef-place",
      type: "map-question",
      position: { x: 800, y: 460 },
      data: {
        title: { sv: "Var är felet?", en: "Where is the fault?" },
        description: { sv: "Peka ut platsen på kartan, eller skriv den i ord.", en: "Point out the place on the map, or write it in words." },
        variableName: "plats",
        kind: "point",
        required: true,
      },
    },
    {
      id: "ef-address",
      type: "autocomplete-question",
      position: { x: 800, y: 0 },
      data: {
        title: { sv: "Vad gäller felet?", en: "What is the fault about?" },
        description: { sv: "Sök och välj den kategori som stämmer bäst.", en: "Search and choose the category that fits best." },
        variableName: "kategori",
        placeholder: { sv: "Börja skriva, t.ex. belysning", en: "Start typing, e.g. lighting" },
        minChars: 1,
        // Off: the answer has to come from the register, which is what makes
        // "Välj ett av förslagen i listan." possible.
        allowFreeText: false,
        required: true,
        source: "mock",
        mockItems: [
          { value: "belysning", label: "Belysning" },
          { value: "vag-trottoar", label: "Väg och trottoar" },
          { value: "klotter", label: "Klotter" },
          { value: "nedskrapning", label: "Nedskräpning" },
          { value: "snorojning", label: "Snöröjning" },
          { value: "park", label: "Park och grönska" },
          { value: "lekplats", label: "Lekplats" },
          { value: "vatten-avlopp", label: "Vatten och avlopp" },
          { value: "trafiksignal", label: "Trafiksignal" },
          { value: "skadedjur", label: "Skadedjur" },
          { value: "toalett", label: "Offentlig toalett" },
          { value: "badplats", label: "Badplats" },
        ],
      },
    },

    // ── Multiple choice with a range: the selection hints ───────────────────
    {
      id: "ef-kind",
      type: "multi-choice",
      position: { x: 1180, y: 0 },
      data: {
        title: { sv: "Hur påverkar felet dig?", en: "How does the fault affect you?" },
        description: { sv: "Välj det som stämmer. Du kan välja flera.", en: "Choose what applies. You can pick more than one." },
        variableName: "paverkan",
        required: true,
        minSelected: 1,
        maxSelected: 3,
        options: [
          { id: "ef-k1", label: { sv: "Svårt att ta sig fram", en: "Hard to get past" }, value: "framkomlighet" },
          { id: "ef-k2", label: { sv: "Känns otryggt", en: "Feels unsafe" }, value: "otrygghet" },
          { id: "ef-k3", label: { sv: "Risk för skada", en: "Risk of injury" }, value: "skaderisk" },
          { id: "ef-k4", label: { sv: "Stör grannskapet", en: "Disturbs the neighbourhood" }, value: "storning" },
        ],
      },
    },

    // ── A number with bounds and a unit ─────────────────────────────────────
    {
      id: "ef-days",
      type: "number-question",
      position: { x: 1560, y: 0 },
      data: {
        title: { sv: "Hur länge har felet funnits?", en: "How long has the fault been there?" },
        variableName: "dagar",
        unit: { sv: "dagar", en: "days" },
        min: 1,
        max: 365,
        required: true,
      },
    },

    // ── Pictures: one plain, one with comments ──────────────────────────────
    
    

    /*
     * Fotot är tillbaka, med berättelse 047 bakom sig.
     *
     * Det togs bort härifrån för att det stod tomt och okravat i demon; nu
     * finns kravet: invånaren väljer sin bild och trycker ut prickar där
     * skadan syns. Prickarna lagras som procentkoordinater i
     * `bildMarkeringar`, bredvid filen — originalfotot röks aldrig. Frivilligt
     * fält: den utan foto beskriver i ord i nästa steg, vilket också är
     * golvet för den som inte kan peka.
     */
    {
      id: "ef-photo",
      type: "file-question",
      position: { x: 2320, y: 0 },
      data: {
        title: { sv: "Har du en bild på felet?", en: "Do you have a picture of the fault?" },
        description: { sv: "Frivilligt — en bild hjälper oss hitta rätt. Tryck i bilden för att markera var skadan syns.", en: "Optional — a picture helps us find it. Tap the picture to mark where the damage shows." },
        variableName: "bild",
        accept: ".jpg,.jpeg,.png,.heic",
        maxSize: 10,
        allowMarking: true,
        // The host's placeholder photo (story 108): a pothole on a residential street — the commonest fault report.
        exampleImage: "/exempel/potthal.jpg",
        exampleImageAlt: {
          sv: "Ett djupt potthål i asfalten på en villagata, fyllt med regnvatten, med spruckna kanter. Kantsten och en häck i bakgrunden.",
          en: "A deep pothole in the asphalt of a residential street, filled with rainwater, with cracked edges. A curb and a hedge behind.",
        },
      },
    },

    // ── A single choice, and the way out ────────────────────────────────────
    /*
     * Problemet i egna ord — och golvet för fotomarkeringen ovanför.
     */
    {
      id: "ef-beskrivning",
      type: "text-question",
      position: { x: 1940, y: 0 },
      data: {
        title: { sv: "Beskriv problemet", en: "Describe the problem" },
        description: { sv: "Skriv med egna ord vad som är fel och var.", en: "In your own words: what is wrong, and where." },
        variableName: "beskrivning",
        presentation: "textarea",
        required: true,
        maxLength: 600,
      },
    },
    {
      id: "ef-contact",
      type: "question",
      position: { x: 2700, y: 0 },
      data: {
        title: { sv: "Vill du bli kontaktad?", en: "Would you like to be contacted?" },
        variableName: "kontakt",
        required: true,
        options: [
          { id: "ef-c1", label: { sv: "Ja, hör av er", en: "Yes, get in touch" }, value: "ja" },
          { id: "ef-c2", label: { sv: "Nej, det behövs inte", en: "No, there is no need" }, value: "nej" },
        ],
      },
    },
    {
      id: "ef-result",
      type: "result",
      position: { x: 3080, y: 0 },
      data: {
        title: { sv: "Tack, felet är anmält", en: "Thank you, the fault is reported" },
        description: { sv: "Vi hör av oss inom fem arbetsdagar om du bad om det.\n\nFörenklat exempel – ingen anmälan har skickats.", en: "We will be in touch within five working days if you asked us to.\n\nA simplified example – no report has been sent." },
      },
    },
  ],
  connections: [
    { id: "ef-1", from: { nodeId: "ef-page", portId: "continue" }, to: { nodeId: "ef-page-fault", portId: "input" } },
    { id: "ef-1b", from: { nodeId: "ef-page-fault", portId: "continue" }, to: { nodeId: "ef-place", portId: "input" } },
    { id: "ef-1c", from: { nodeId: "ef-place", portId: "continue" }, to: { nodeId: "ef-address", portId: "input" } },
    { id: "ef-2", from: { nodeId: "ef-address", portId: "continue" }, to: { nodeId: "ef-kind", portId: "input" } },
    { id: "ef-3", from: { nodeId: "ef-kind", portId: "continue" }, to: { nodeId: "ef-days", portId: "input" } },
    { id: "ef-4", from: { nodeId: "ef-days", portId: "continue" }, to: { nodeId: "ef-photo", portId: "input" } },
    { id: "ef-4b", from: { nodeId: "ef-photo", portId: "continue" }, to: { nodeId: "ef-beskrivning", portId: "input" } },
    { id: "ef-5", from: { nodeId: "ef-beskrivning", portId: "continue" }, to: { nodeId: "ef-contact", portId: "input" } },
    { id: "ef-7", from: { nodeId: "ef-contact", portId: "ef-c1" }, to: { nodeId: "ef-result", portId: "input" } },
    { id: "ef-8", from: { nodeId: "ef-contact", portId: "ef-c2" }, to: { nodeId: "ef-result", portId: "input" } },
  ],
  settings: { sourceLocale: "sv", locales: ["sv", "fi"] },
};

import type { LocalizedTextMap } from "../core/localized-text";

/**
 * Texts the **resident** meets in a published guide.
 *
 * Story 017 draws the line here rather than around "chrome": a button a
 * resident clicks, in the middle of text they read, belongs to the guide's
 * voice like the question above it. These are the keys a guide may override in
 * `settings.strings`, and the only ones it may.
 *
 * The audience is which file the key sits in. That is deliberate — a key cannot
 * be defined without an audience, because there is nowhere to put it that lacks
 * one. A separate list beside the table could drift; a file cannot.
 *
 * Swedish and English here are a **floor**, not a ceiling. A guide translated
 * into Arabic gets its buttons from the guide itself, or from a viewer pack the
 * host registered. Translating content into a language never requires the tool
 * to be translated into it — criterion 7.
 */
export const VIEWER_STRINGS: Record<string, LocalizedTextMap> = {
  "step.number": { sv: "Steg", en: "Step" },
  "step.result": { sv: "Resultat", en: "Result" },
  "nav.next": { sv: "Nästa", en: "Next" },
  /*
   * Knappen som lämnar in säger att den lämnar in. "Nästa" lovar ett steg
   * till; att i stället skicka något oåterkalleligt är en överraskning som
   * kostar förtroende, och den drabbar hårdast den som läser långsamt.
   */
  "nav.submit": { sv: "Skicka in", en: "Submit" },
  /*
   * The region a screen reader lands in, and the one string in this component
   * that was written straight into the markup.
   *
   * It read *Förhandsgranskning av guide* under an English toolbar, in the one
   * place nobody looks because nobody sees it. A hardcoded label is worse than
   * a missing one: it is invisible to everybody who could report it.
   */
  "preview.regionLabel": { sv: "Förhandsgranskning av guide", en: "Guide preview" },
  /*
   * Namnet på listan över det man redan svarat.
   *
   * Läses av en skärmläsare innan den räknar upp raderna, så den säger vad
   * listan är och inte bara att det finns en. Utan den skulle den annonseras som
   * "lista med 2 objekt" — sant och obrukbart.
   */
  "preview.wayBack": { sv: "Vägen hit", en: "The way here" },
  /*
   * Den andra formen av samma lista. `answer-display="history"` hade en
   * hårdkodad svensk `aria-label` bredvid `trail`-varianten som frågar
   * registret — så en engelsk guide läste upp "Tidigare svar".
   */
  "preview.previousAnswers": { sv: "Tidigare svar", en: "Previous answers" },
  /*
   * Mätaren (story 116). Namnet läses av en skärmläsare före talet, så det
   * säger vad talet handlar om — "20 procent" utan namn är obrukbart.
   *
   * Talet står också som ord bredvid stapeln: en stapel utan siffra kräver att
   * man ser den (K3). Procenttecknet skrivs i strängen och inte i koden, för
   * svenskan har mellanslag före det och engelskan inte.
   */
  "progress.label": { sv: "Så långt har du kommit", en: "How far you have come" },
  "progress.value": { sv: "{percent} %", en: "{percent}%" },
  /*
   * Sägs när ett formaterat fält tyst kastat det man skrev.
   *
   * Ett fält med bestämd form tar bara det formen tillåter, så bokstäver i ett
   * personnummerfält syns aldrig — bättre än att kastas om, men fortfarande en
   * vägran utan ord. Den som tabbat fel ser ingenting hända alls, och en
   * skärmläsare hör ingenting eftersom värdet inte ändrades.
   *
   * Visas först när man **slutat skriva**, inte vid första tecknet: den som slår
   * fel en gång ska inte få en tillrättavisning mitt i ordet.
   */
  "field.onlyDigits": { sv: "Här skriver du siffror.", en: "Only digits go here." },
  "field.pasteAmbiguous": {
    sv: "Det inklistrade innehåller flera möjliga värden. Klistra in ett i taget.",
    en: "The pasted text holds more than one possible value. Paste one at a time.",
  },
  "field.onlyLettersAndDigits": {
    sv: "Här skriver du bokstäver och siffror.",
    en: "Only letters and digits go here.",
  },
  // Utfällaren vid frågan (story 051): rubriken är chrome, innehållet är
  // redaktörens och översätts i guiden som allt annat innehåll.
  "question.why": { sv: "Varför frågar vi det här?", en: "Why do we ask?" },
  // Story 096: the word on a Text shown as a box. `warning` reads *Viktigt*,
  // not *Varning* — the kind is the icon's and the colour's name, the word is the visitor's.
  "callout.info": { sv: "Info", en: "Info" },
  "callout.warning": { sv: "Viktigt", en: "Important" },
  "callout.tip": { sv: "Tips", en: "Tip" },
  // Granskningssteget (story 049).
  "review.change": { sv: "Ändra", en: "Change" },
  "review.changeAria": { sv: "Ändra svaret på {q}", en: "Change the answer to {q}" },
  "review.changePageAria": { sv: "Ändra svaren på {q}", en: "Change the answers on {q}" },
  "review.declarationSend": { sv: "Det här skickas, och ingenting annat", en: "This is what gets sent, and nothing else" },
  "review.declarationBasis": { sv: "Det här byggde beskedet på", en: "This is what the answer was based on" },
  // Inlämningen (story 050).
  "submit.sending": { sv: "Skickar din anmälan …", en: "Sending your report …" },
  "submit.waiting": { sv: "Väntar på svar …", en: "Waiting for a reply …" },
  "submit.referenceIntro": { sv: "Spara referensnumret om du vill fråga om ditt ärende:", en: "Save the reference number if you want to ask about your case:" },
  "submit.whatWasSent": { sv: "Det här skickades", en: "This is what was sent" },
  /*
   * Orden bytte 22/9 (A7, Astra), nyckeln inte.
   *
   * *Kunde inte lämna in* påstod mer än vi vet, och kunde vara farligt fel:
   * när svaret uteblir efter att begäran gått iväg kan servern ha tagit emot
   * och skickat vidare. Beskedet säger nu vad vi faktiskt vet — att vi inte
   * kunde bekräfta — och att svaren ligger kvar.
   *
   * **Klienten kan inte skilja de två fallen åt**, och det är mätt och inte
   * antaget: visaren ser ett avvisat löfte från värdens egen mottagare, utan
   * något om hur långt begäran hann. Alltså det försiktigare beskedet för
   * båda, vilket är vad uppdraget säger när skillnaden inte går att se.
   *
   * Nyckeln behålls för att språkpaketen bär den (`src/locale-packs/fi.ts`,
   * och en värds egna). **Den finska meningen säger fortfarande det gamla**
   * och behöver en ny översättning — en sak för Johan, inte något jag gissar.
   */
  "submit.failed": {
    sv: "Vi kunde inte bekräfta att uppgifterna togs emot — dina svar är kvar. Försök igen.",
    en: "We could not confirm that your details were received — your answers are still here. Try again.",
  },
  "submit.retry": { sv: "Försök igen", en: "Try again" },
  // The failed card's heading (Astra 1/10, bilaga 12): in place of the
  // editor's receipt title, which thanks. Says what A7 says we know.
  "submit.failedTitle": { sv: "Inlämningen kunde inte bekräftas", en: "The submission could not be confirmed" },
  /*
   * Fönstret har gått ut och utfallet är okänt (A7).
   *
   * Här får texten INTE sluta med "försök igen": mottagaren har glömt id:t,
   * så ett nytt försök skulle kunna bli ett andra ärende, och besökaren kan
   * inte se skillnaden själv. Den enda väg som finns kvar är att stämma av
   * med mottagaren — alltså är det den vägen texten pekar på.
   *
   * Referensnumret nämns inte: vid ett misslyckat försök finns inget att
   * visa. Den dagen `submission-conflict` bär en referens hela vägen ut till
   * visaren hör den hemma här.
   */
  "submit.unconfirmed": {
    sv: "Vi kunde inte bekräfta att uppgifterna togs emot, och nu har det gått för lång tid för att skicka igen utan att det kan bli två ärenden. Kontakta mottagaren och stäm av innan du skickar en gång till.",
    en: "We could not confirm that your details were received, and too much time has now passed to send again without risking two cases. Contact the recipient to check before you send once more.",
  },
  "nav.previous": { sv: "Föregående", en: "Previous" },
  "nav.restart": { sv: "Börja om", en: "Restart" },
  "nav.newCase": { sv: "Nytt ärende", en: "New case" },
  // Felsummeringen på sidor med flera fel (story 051): WCAG-mönstret —
  // räknat, länkat, och fokus dit så skärmläsaren läser upp den.
  "page.errorSummary": {
    sv: "{n} saker behöver rättas innan du kan gå vidare",
    en: "{n} things need fixing before you can continue",
  },
  /*
   * En sida som upprepas (story 084). `{word}` är redaktörens ord i ental —
   * *barn* — och böjs aldrig: *Barn 2*, *Lägg till barn*, *Ta bort barn 2*.
   * Flertal och artiklar skriver redaktören själv i *Lägg till-knappens
   * text*. Rubriken versaliserar bara första bokstaven.
   */
  "repeat.legend": { sv: "{word} {n}", en: "{word} {n}" },
  "repeat.add": { sv: "Lägg till {word}", en: "Add {word}" },
  "repeat.remove": { sv: "Ta bort {word} {n}", en: "Remove {word} {n}" },
  "repeat.removed": { sv: "{word} {n} togs bort.", en: "{word} {n} was removed." },
  "validation.repeatMin": {
    sv: "Lägg till minst {n}.",
    en: "Add at least {n}.",
  },
  "validation.repeatMax": {
    sv: "Högst {n} kan anges.",
    en: "At most {n} can be given.",
  },
  "validation.selectOption": {
    sv: "Välj ett svarsalternativ innan du går vidare.",
    en: "Select an answer before continuing.",
  },
  "validation.required": {
    sv: "Fältet är obligatoriskt.",
    en: "This field is required.",
  },
  // Fields that disallow free text: the variable must carry a code from the
  // list, and a wording of its own helps more than "invalid value".
  "validation.chooseFromList": {
    sv: "Välj ett av förslagen i listan.",
    en: "Choose one of the suggestions in the list.",
  },
  "validation.minLength": {
    sv: "Texten måste innehålla minst {n} tecken.",
    en: "Enter at least {n} characters.",
  },
  "validation.maxLength": {
    sv: "Texten får innehålla högst {n} tecken.",
    en: "Enter at most {n} characters.",
  },
  "counter.remaining": { sv: "{n} tecken kvar", en: "{n} characters left" },
  "counter.over": { sv: "{n} tecken för mycket", en: "{n} characters too many" },
  "counter.count": { sv: "{n} tecken", en: "{n} characters" },
  "validation.selectAtLeastOne": {
    sv: "Välj minst ett alternativ.",
    en: "Select at least one option.",
  },
  "validation.selectAtLeast": {
    sv: "Välj minst {n} alternativ.",
    en: "Select at least {n} options.",
  },
  "validation.selectAtMost": {
    sv: "Välj högst {n} alternativ.",
    en: "Select at most {n} options.",
  },
  "validation.number.invalid": {
    sv: "Ange ett giltigt tal.",
    en: "Enter a valid number.",
  },
  "validation.number.min": {
    sv: "Värdet måste vara minst {n}.",
    en: "The value must be at least {n}.",
  },
  "validation.number.max": {
    sv: "Värdet får vara högst {n}.",
    en: "The value must be at most {n}.",
  },
  "validation.fieldRequired": {
    sv: 'Fältet "{field}" är obligatoriskt.',
    en: 'The field "{field}" is required.',
  },
  /*
   * Story 118, criterion 7. A field that arrives with a value — a start value,
   * a slider standing at `min` — has something in it that nobody chose, so
   * *är obligatoriskt* would be untrue: it is filled in. What is missing is the
   * visitor's own decision, so the message asks for the act and not the value.
   */
  "validation.fieldUntouched": {
    sv: "Ändra {field} innan du går vidare.",
    en: "Change {field} before you continue.",
  },
  /*
   * The same fact asked instead of refused (Johan 15/9: *"En popover: du har
   * inte justerat startvärdet, vill du verkligen gå vidare?"*).
   *
   * The engine still says no — `validation.fieldUntouched` above is its
   * verdict, and a host driving it alone still gets a refusal. What the viewer
   * does with that no is ask, because wanting exactly the value that stands
   * there is a real answer, and a guide that refuses it makes the visitor type
   * the number it already shows.
   *
   * The value is named in the question. *"Du har inte ändrat fältet"* leaves
   * the visitor to look for which one and what it says; with the field and
   * its value in the sentence the question can be answered without looking
   * away from it.
   */
  "dialog.untouched.message": {
    sv: "Du har inte ändrat {field}, som står på {value}. Vill du gå vidare ändå?",
    en: "You have not changed {field}, which is set to {value}. Do you want to continue anyway?",
  },
  "dialog.untouched.continue": { sv: "Gå vidare", en: "Continue" },
  "dialog.untouched.change": { sv: "Ändra", en: "Change" },
  "validation.optionMissing": {
    sv: 'Alternativet "{value}" finns inte på frågan.',
    en: 'The option "{value}" does not exist on the question.',
  },
  "validation.format.email": {
    sv: "Ange en giltig e-postadress.",
    en: "Enter a valid email address.",
  },
  "validation.format.phone": {
    sv: "Ange ett giltigt telefonnummer.",
    en: "Enter a valid phone number.",
  },
  "validation.format.personnummer": {
    sv: "Ange ett giltigt personnummer.",
    en: "Enter a valid personal identity number.",
  },
  "field.enterDate": { sv: "Välj ett datum", en: "Choose a date" },
  // Spöktexten i ett tomt datumfält (design A, 31/8) — formatet, inte en
  // uppmaning; uppmaningen är etiketten ovanför.
  "field.dateFormat": { sv: "ÅÅÅÅ-MM-DD", en: "YYYY-MM-DD" },
  "map.pick": { sv: "Välj plats på kartan", en: "Pick the place on the map" },
  "map.change": { sv: "Ändra plats", en: "Change the place" },
  "map.floorLabel": { sv: "Adress eller plats i ord", en: "Address or place in words" },
  "map.notConnected": {
    sv: "Kartval är inte inkopplat här — skriv platsen i ord.",
    en: "Map picking is not connected here — write the place in words.",
  },
  "map.chosen": { sv: "Plats vald: {label}", en: "Place chosen: {label}" },
  "preview.variables": { sv: "Variabler ({n})", en: "Variables ({n})" },
  "preview.emptyValue": { sv: "tomt", en: "empty" },
  // Trail-/kvittoetiketten för ett besvarat men tomt valfritt steg (K1): den
  // engine skriver som svarets EGEN text, skild från "preview.emptyValue"
  // ovan som gäller ett ifyllt variabelvärde i granskningstabellen.
  "preview.noAnswer": { sv: "Inget svar", en: "No answer" },
  // Mottagarpanelen — som variabelpanelen, för inlämningens mottagare:
  // namn och id ur katalogens synliga halva, aldrig en adress.
  "preview.recipients": { sv: "Mottagare ({n})", en: "Recipients ({n})" },
  "preview.recipientMissing": {
    sv: "finns inte i katalogen — går till standardmottagaren",
    en: "not in the catalog — goes to the default recipient",
  },
  "preview.recipientVisitor": {
    sv: "Besökarens egen adress, ur svaret",
    en: "The visitor's own address, from their answer",
  },
  "validation.file.required": {
    sv: "Bifoga en fil för att gå vidare.",
    en: "Attach a file to continue.",
  },
  "validation.file.type": {
    sv: "Filen måste vara av typen {types}.",
    en: "The file must be of type {types}.",
  },
  "validation.file.size": {
    sv: "Filen får vara högst {n} MB.",
    en: "The file may be at most {n} MB.",
  },
  "field.attach": { sv: "Välj fil", en: "Choose a file" },
  /*
   * Story 108: exempelfotot, där värden bjuder på det. Viewer-strängar och inte
   * editorns — knappen står i besökarens formulär och är ett svar hen lämnar,
   * till skillnad från provets knapp som bara finns på arbetsytan.
   */
  "file.useExample": { sv: "Använd exempelfoto", en: "Use example photo" },
  "file.exampleFailed": {
    sv: "Exempelfotot kunde inte hämtas. Välj en egen bild.",
    en: "The example photo could not be fetched. Choose a picture of your own.",
  },
  "marking.hint": { sv: "Tryck i bilden för att markera. Tryck på en markering för att ta bort den.", en: "Tap the picture to mark it. Tap a mark to remove it." },
  "marking.remove": { sv: "Ta bort markering {n}", en: "Remove mark {n}" },
  "marking.removeShort": { sv: "Ta bort", en: "Remove" },
  "marking.goto": { sv: "Gå till markering {n}", en: "Go to mark {n}" },
  "marking.describe": { sv: "Vad visar markering {n}?", en: "What does mark {n} show?" },
  "marking.clear": { sv: "Rensa markeringar", en: "Clear marks" },
  "marking.count": { sv: "{n} markeringar", en: "{n} marks" },
  "validation.consent.required": {
    sv: "Du måste kryssa i rutan för att gå vidare.",
    en: "You must tick the box to continue.",
  },
  "validation.date.invalid": {
    sv: "Ange ett datum som finns, till exempel 2026-03-01.",
    en: "Enter a date that exists, for example 2026-03-01.",
  },
  "validation.date.min": {
    sv: "Ange ett datum tidigast {date}.",
    en: "Enter a date no earlier than {date}.",
  },
  "validation.date.max": {
    sv: "Ange ett datum senast {date}.",
    en: "Enter a date no later than {date}.",
  },
  // Story 087: the bound is another field, so the message names it — the
  // visitor wrote that date themselves. Same day passes (decided 3/9).
  "validation.date.afterField": {
    sv: "Datumet måste vara samma som eller efter {field}.",
    en: "The date must be the same as or after {field}.",
  },
  "validation.date.beforeField": {
    sv: "Datumet måste vara samma som eller före {field}.",
    en: "The date must be the same as or before {field}.",
  },
  "validation.format.postnummer": {
    sv: "Ange ett postnummer med fem siffror.",
    en: "Enter a five-digit Swedish postcode.",
  },
  "validation.format.organisationsnummer": {
    sv: "Ange ett giltigt organisationsnummer.",
    en: "Enter a valid Swedish organisation number.",
  },
  "validation.format.pattern": {
    sv: "Värdet har fel format.",
    en: "The value has the wrong format.",
  },
  /*
   * A page field's message when the step is a page rather than one question.
   *
   * There used to be six of these, one per rule, saying the same thing as the
   * `validation.*` texts above in different words: "Ange minst {n} tecken."
   * beside "Texten måste innehålla minst {n} tecken." A comment here claimed
   * the terseness was deliberate — that a page field shows its error inline,
   * where a full sentence reads as noise. That was not true. Both render into
   * the same `guide-preview__field-error` slot with the same styling; the two
   * wordings came from two code paths that grew up apart, and a translator had
   * to write both and keep them sounding alike.
   *
   * Five of them are gone and the page path uses `validation.*`. This one
   * stays, because it is the one pair with a real difference: the single-
   * question wording ends "innan du går vidare", which is true of a step that
   * *is* the question and reads oddly beside one field among eight.
   */
  "validation.chooseOption": { sv: "Välj ett alternativ.", en: "Select an option." },

  /*
   * ── Prefixen namnger vad invånaren ser, inte vilken komponent som ritar ──
   *
   * These were `preview.*` until 2026-08-04. That prefix named the *component*,
   * and `guide-preview` draws two different things for two different audiences
   * — the resident's guide, and the thumbnail on the editor's canvas. I put
   * keys on the wrong side of that line three times in one hour, with every
   * test green. The canvas's keys are now `canvas.*`; these are the resident's,
   * grouped by what they are on the screen.
   *
   * Renamed without a migration on purpose: `settings.strings` is stored data,
   * but v0.4.x had not reached an installation, so there was nothing to be
   * compatible with. After launch that stops being true — the recipe is in
   * `docs/JSON-KONTRAKT.md`, under "Att döpa om en visarnyckel efter lansering".
   */
  "field.chooseOption": { sv: "Välj ett alternativ", en: "Select an option" },
  "field.selectPlaceholder": { sv: "Välj…", en: "Select…" },
  "field.chooseOneOrMore": { sv: "Välj en eller flera", en: "Select one or more" },
  /*
   * Story 134. A list that is shorter than it was built to be looks broken —
   * a menu of two dishes most of all — so the visitor is told that something
   * is missing (PRAXIS 7).
   *
   * What is NOT said is which option. *Nötcurry visas inte* would describe
   * the dish the allergic visitor must not have, and reading it would be the
   * whole harm the condition exists to prevent. So the sentence names the
   * cause — their earlier answers — and nothing else.
   */
  "field.someOptionsHidden": {
    sv: "Några alternativ visas inte utifrån dina tidigare svar.",
    en: "Some options are not shown, based on your earlier answers.",
  },
  /*
   * Story 138 (Astra 29/9): the row under a list on a page that repeats,
   * when *Varje upprepning ska välja olika* held back what another record
   * chose. "Andra", not "tidigare" — it holds when the visitor goes back and
   * changes an earlier record too.
   */
  "field.optionsTakenElsewhere": {
    sv: "Alternativ som du valt i andra upprepningar visas inte här.",
    en: "Options you chose in other repetitions are not shown here.",
  },
  /*
   * Story 138 (Astra 29/9): the same setting has held back every option and
   * this record has none of its own. Stands where the list would be.
   */
  "field.noOptionsLeft": {
    sv: "Inga alternativ finns att välja just nu.",
    en: "There are no options to choose right now.",
  },
  /*
   * Story 134, criterion 6. The visitor chose the nut curry, went back and
   * added a nut allergy: the option is gone, so the answer is gone with it.
   * Said and not silent — a choice that disappears without a word is the
   * kind of thing people blame themselves for.
   */
  "validation.choiceRedo": {
    sv: "Ditt val av {field} behöver göras om.",
    en: "Your choice of {field} needs to be made again.",
  },
  /*
   * Story 138: a field set to *Varje upprepning ska välja olika* holds what
   * an earlier record already holds — the same person on two rows, the same
   * session twice. On the later record only; the earlier one was fine when
   * it was written. Astra's words 29/9: say where the clash is and what to
   * do, one for a text and one for a choice.
   */
  "validation.alreadyGiven": {
    sv: "Det här svaret finns redan i en annan upprepning. Ange ett annat.",
    en: "This answer is already given in another repetition. Enter a different one.",
  },
  /*
   * Story 138 (the lead's decision 29/9, Astra's addition): *Nästa* in a
   * record where nothing is left to choose. Says what to do, not only what
   * is wrong.
   */
  "validation.noOptionsLeft": {
    sv: "Inga alternativ finns att välja. Ta bort den här upprepningen eller ändra ett tidigare val.",
    en: "There are no options to choose. Remove this repetition or change an earlier choice.",
  },
  "validation.alreadyChosen": {
    sv: "Det här alternativet är redan valt i en annan upprepning. Välj ett annat.",
    en: "This option is already chosen in another repetition. Choose a different one.",
  },
  /*
   * The rating's two ways out (story 115), when the editor wrote no words of
   * their own. Built in rather than defaulted into the graph, so they are in
   * the reader's language and not in the editor's. Two and not one: the first
   * says the question does not apply, the second that the person has no
   * answer — and a survey that offers only the first makes everybody who has
   * not thought about it claim the first.
   */
  "field.notApplicable": { sv: "Inte aktuellt", en: "Not applicable" },
  "field.dontKnow": { sv: "Vet ej", en: "Don't know" },
  "field.writeAnswer": { sv: "Skriv ditt svar", en: "Write your answer" },
  "field.required": { sv: "(obligatoriskt)", en: "(required)" },
  "field.enterNumber": { sv: "Ange ett tal", en: "Enter a number" },
  // Story 095: the slider and the − / + buttons beside a number field.
  "field.slider": { sv: "{label}, reglage", en: "{label}, slider" },
  "field.stepDown": { sv: "Minska {label}", en: "Decrease {label}" },
  "field.stepUp": { sv: "Öka {label}", en: "Increase {label}" },
  "field.hint.atLeast": { sv: "välj minst {n}", en: "select at least {n}" },
  "field.hint.exact": { sv: "välj {n}", en: "select {n}" },
  "field.hint.range": { sv: "välj {min}–{max}", en: "select {min}–{max}" },
  "field.hint.atMost": { sv: "välj högst {n}", en: "select at most {n}" },
  /*
   * Flervalslistan: etiketter i stället för ctrl-klick.
   *
   * Den som ser en etikett dyka upp får svaret gratis. Den som inte ser den
   * får ingenting alls utan `choice.added` och `choice.removed` — därför är
   * de här texter och inte en klass som råkar se vald ut.
   */
  "choice.search": { sv: "Sök bland alternativen", en: "Search the options" },
  "choice.searchPlaceholder": { sv: "Skriv för att söka…", en: "Type to search…" },
  "choice.chosen": { sv: "Valda", en: "Selected" },
  "choice.chosenNone": { sv: "Inget valt än", en: "Nothing selected yet" },
  "choice.add": { sv: "Lägg till {label}", en: "Add {label}" },
  "choice.remove": { sv: "Ta bort {label}", en: "Remove {label}" },
  /*
   * Egna former för ett enda val: svenskan böjer sig efter antalet, och
   * "1 valda" är fel på ett sätt som får raden att se maskinskriven ut.
   * Engelskan böjer sig inte här, men får sin egen rad ändå — en delad
   * sträng hade betytt att nästa språk måste välja mellan två fel.
   */
  "choice.added": { sv: "{label} tillagt. {n} valda.", en: "{label} added. {n} selected." },
  "choice.addedOne": { sv: "{label} tillagt. 1 vald.", en: "{label} added. 1 selected." },
  "choice.removed": { sv: "{label} borttaget. {n} valda.", en: "{label} removed. {n} selected." },
  "choice.removedOne": { sv: "{label} borttaget. 1 vald.", en: "{label} removed. 1 selected." },
  /*
   * The count under the box says what it counts (uppdrag 29/9 Del D, Astra
   * §11): what is left to choose, or — while a term is typed — the matches.
   * It said "{n} alternativ" for both.
   */
  "choice.left": { sv: "{n} kvar att välja", en: "{n} left to choose" },
  "choice.oneLeft": { sv: "1 kvar att välja", en: "1 left to choose" },
  "choice.matches": { sv: "{n} träffar", en: "{n} matches" },
  "choice.oneMatch": { sv: "1 träff", en: "1 match" },
  "choice.noMatches": { sv: "Inga träffar på {term}", en: "No matches for {term}" },
  "choice.allChosen": { sv: "Alla alternativ är valda", en: "All options are selected" },
  /*
   * Ett val som utesluter de andra — berättelse 062.
   *
   * `choice.or` är RADEN i listan, inte en förklaring: den som ser *eller*
   * förstår antingen-eller innan trycket. Utan den vore ersättningsregeln en
   * överraskning, och en överraskning i ett formulär läses som ett fel.
   *
   * De två andra är statusradens andra mening. Den första meningen
   * (`choice.added*`) säger VAD som hände; utan orsaken står besökaren kvar
   * med ett val som försvann och ingen förklaring — Johans invändning mot
   * hela mönstret. `Cleared` när det valda var det som står ensamt,
   * `Removed` när det var det som fick gå: att peka ut fel sida lär ut
   * regeln baklänges.
   */
  "choice.or": { sv: "eller", en: "or" },
  "choice.exclusiveCleared": {
    sv: "Kan inte kombineras med andra val, så {removed} togs bort.",
    en: "Cannot be combined with other choices, so {removed} was removed.",
  },
  "choice.exclusiveRemoved": {
    sv: "{removed} kan inte kombineras med andra val och togs bort.",
    en: "{removed} cannot be combined with other choices and was removed.",
  },
  /*
   * De tre ett UPPSLAG behöver utöver listans egna, och som en färdig lista
   * aldrig kan visa: en tjänst måste hinna svara, och kan låta bli.
   *
   * De ligger i `choice.*` för att kontrollen är en. `lookup.*` fanns som en
   * egen uppsättning så länge uppslagsfältet var ett eget element, och
   * överlappade då `choice.*` på fem av åtta — samma text under två namn, med
   * en översättning som kunde glida isär.
   *
   * `lookup.oneResult` och `lookup.results` sa *"använd piltangenterna"* och
   * följde inte med. Alternativen är knappar i tabbordningen; det finns inga
   * piltangenter att hänvisa till, och antalet står redan i
   * `choice.matches`.
   */
  "choice.hint": { sv: "Skriv minst {n} tecken för att söka", en: "Type at least {n} characters to search" },
  "choice.searching": { sv: "Söker…", en: "Searching…" },
  "choice.error": { sv: "Uppslaget kunde inte nås", en: "The lookup could not be reached" },
  "image.none": { sv: "Ingen bild angiven", en: "No image set" },
  "image.commentCounter": { sv: "Kommentar {current}/{total}", en: "Comment {current}/{total}" },
  "field.unitSuffix": { sv: "i {unit}", en: "in {unit}" },
  /*
   * The fallback title of a step the editor left untitled.
   *
   * `guide-preview` renders both the resident's guide and the miniature on the
   * editor's canvas, and this key is asked for from both — from `getNodeTitle`,
   * which only the canvas reaches, and from `renderHeadingAndDescription`,
   * which every step of the resident's guide passes through. The second is why
   * it belongs here: an untitled node showed "Namnlös nod" in an otherwise
   * Arabic guide, with no way for anyone to fix it. Story 017, criterion 2.
   *
   * `canvas.unnamedField` looks like its twin and is not. That one is only
   * ever asked for by `renderCompactPageFields`, so it stays in
   * `editor-strings.ts` with the rest of the canvas.
   */
  "step.untitled": { sv: "Namnlös nod", en: "Untitled node" },
  /** Read after a passed page's name in the named steps; the eye gets ✓. */
  "step.done": { sv: "avklarat", en: "done" },
  /*
   * `step.current` stod här och är borta (13/9, story 116). Den var
   * `aria-label` på stegmärkningens `<p>`, och ett stycke har rollen
   * *paragraph* som står på ARIA:s *Name Prohibited*-lista — attributet
   * ignorerades av specen, mätt mot renderad DOM. En nyckel inget ritar är en
   * rad en översättare betalar för utan att någon får något.
   *
   * Sätt inte tillbaka namnet i en annan form. Den synliga texten *Steg 1* läses
   * som innehåll och räcker i sitt sammanhang; ett riktigt tillgängligt namn
   * kräver ett element vars roll tillåter ett, och det är mer mekanism än raden
   * är värd.
   */

  /*
   * Said, rather than hidden.
   *
   * A guide with no text in the language a resident asked for falls back — to
   * the guide's own source, then to English. That is the right thing to show,
   * and showing it silently is not: the resident is left wondering whether the
   * service is broken, whether they picked the wrong language, or whether this
   * is simply how it is.
   *
   * `{wanted}` is what they asked for and `{shown}` is what they are reading,
   * each named in its own language — a reader who cannot read the guide can
   * still read which language it is in.
   */
  /*
   * När en guide tar slut mitt i.
   *
   * Två meningar, för det är två olika fel. Ett ALTERNATIV utan väg vidare är
   * alternativets fel — "Ja" leder ingenstans medan "Nej" gör det — och då är
   * det rätt att citera svaret. Ett STEG med en enda utgång har inget
   * alternativ att peka på, och samma mening blev då `Svaret "Johan" leder
   * inte vidare`: besökaren som skrivit sitt namn fick läsa att namnet inte
   * dög. Det var inte namnet. Det var steget.
   *
   * Båda syns bara i en trasig guide — hälsokontrollen fångar dem före
   * publicering — men det är just då de läses, och av någon som inte kan göra
   * något åt saken.
   */
  "flow.deadEndOption": {
    sv: 'Svaret "{answer}" leder inte vidare.',
    en: 'The answer "{answer}" does not lead anywhere.',
  },
  "flow.deadEndStep": {
    sv: "Det här steget leder inte vidare.",
    en: "This step does not lead anywhere.",
  },
  "guide.notTranslated": {
    sv: "Guiden är inte översatt till {wanted}. Den visas därför på {shown}.",
    en: "This guide has not been translated into {wanted}. It is shown in {shown}.",
  },

  /*
   * The engine's structural failures: a missing start step, a dangling
   * connection, a step asked to do something its type does not support, a
   * cycle among the nodes that advance on their own. Every one of them was
   * hardcoded Swedish inside guide-traversal-engine.ts until now, so a guide
   * shown in English or Finnish still broke in Swedish.
   *
   * Reachable the same way the dead-end pair above is: the health check
   * catches a broken graph before publishing, not one that is already live,
   * and this file's own rule is "uncertain means reachable" — see ALWAYS in
   * reachable-viewer-keys.ts.
   */
  "flow.missingStartNode": {
    sv: "Guiden saknar startnod.",
    en: "This guide has no start step.",
  },
  "flow.currentNodeMissing": {
    sv: 'Guidens aktuella nod "{nodeId}" finns inte.',
    en: 'The current step "{nodeId}" does not exist.',
  },
  "flow.nodeMissing": {
    sv: 'Noden "{nodeId}" finns inte i guiden.',
    en: 'The step "{nodeId}" does not exist in this guide.',
  },
  "flow.nodeCannotBeAnswered": {
    sv: 'Noden "{nodeId}" kan inte besvaras.',
    en: 'The step "{nodeId}" cannot be answered.',
  },
  "flow.noFreeTextAccepted": {
    sv: 'Noden "{nodeId}" tar inte emot ett fritextvärde.',
    en: 'The step "{nodeId}" does not accept a free-text answer.',
  },
  "flow.unsupportedNodeType": {
    sv: 'Nodtypen "{nodeType}" stöds inte ännu i den deklarativa motorn.',
    en: 'The step type "{nodeType}" is not supported yet.',
  },
  "flow.notAPage": {
    sv: 'Noden "{nodeId}" är inte en sida.',
    en: 'The step "{nodeId}" is not a page.',
  },
  "flow.pageDeadEnd": {
    sv: "Sidans Fortsätt-utgång leder inte vidare.",
    en: "This page's Continue exit does not lead anywhere.",
  },
  "flow.targetNodeMissing": {
    sv: 'Kopplingens målnod "{nodeId}" finns inte.',
    en: 'The target step "{nodeId}" does not exist.',
  },
  "flow.loopDetected": {
    sv: 'Flödet innehåller en loop vid noden "{nodeId}".',
    en: 'The flow contains a loop at step "{nodeId}".',
  },
  "flow.ruleLoopDetected": {
    sv: 'Regelflödet innehåller en loop vid noden "{nodeId}".',
    en: 'The rule flow contains a loop at step "{nodeId}".',
  },
  "flow.exitNotConnected": {
    sv: 'Utgången "{port}" leder inte vidare.',
    en: 'The exit "{port}" does not lead anywhere.',
  },
};

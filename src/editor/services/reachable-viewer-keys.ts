import { QuestionOptionsService } from "../../viewer/services/question-options-service";
import { VIEWER_STRINGS } from "../../viewer/localization/built-in-strings";
import { calloutKind } from "../../viewer/node-types/node-fields";

import type { FlowNodeData, GraphData } from "../../viewer/types/graph";

/**
 * The viewer texts a given guide can actually put on a resident's screen.
 *
 * ## Why a guide's own list and not the table
 *
 * Story 017, open question 1: *how many fields can a translator bear?* The
 * count said 49 — every viewer text we ship — and a translator working on an
 * eight-node guide was told fifty-odd things remained. Measured against the
 * bundled examples, a guide reaches **7 or 8**, and five guides together reach
 * 12. The rest are texts that guide will never show.
 *
 * A denominator nobody can finish is not a measure of progress. Worse, it hides
 * the ones that matter: the seven that will be read sit in a list of forty-nine
 * that will not.
 *
 * ## Read, not deduced
 *
 * The rules are data on the field. A field with `minLength` can show
 * `validation.minLength`; one without it never can. Nothing here analyses the
 * flow or guesses what a resident might do — it reads what the guide says about
 * itself, which is why the answer is stable.
 *
 * ## Uncertain means reachable
 *
 * The two mistakes are not equal. One field too many is a line a translator
 * skips. One field too few is a resident meeting the wrong language at the
 * moment they have already made a mistake — and it shows up only when the
 * validation fires, which is to say almost never in testing.
 *
 * So an unknown node type contributes **everything**, and every rule that might
 * apply is counted in.
 */

/** Always on screen: the frame around every step. */
const ALWAYS = [
  /*
   * The notice a resident reads when the guide has nothing in their language.
   * It is reachable in any guide offered in more than one language, and a guide
   * offered in one shows it to anyone who asks for another — so it is simply
   * always. It was missing until the reach was pinned to a number, which is
   * what the pinning is for.
   */
  "guide.notTranslated",
  /*
   * The name of the region a screen reader lands in. Drawn around every guide
   * before a single node has rendered, so if anything is always reachable this
   * is — it was hardcoded Swedish in the markup until an English page showed it
   * up, which is why it arrives here late rather than never.
   */
  "preview.regionLabel",
  /*
   * De två meningarna en besökare möter när guiden tar slut mitt i.
   *
   * Hälsokontrollen fångar en saknad koppling före publicering, så frestelsen
   * är att räkna bort dem. Men den grinden står i editorn och säger ingenting
   * om en graf som redan ligger ute — och den här filens egen regel gäller
   * just det fallet: en text för lite är någon som möter fel språk i det
   * ögonblick de redan kört fast. Alltså alltid nåbara.
   */
  "flow.deadEndOption",
  "flow.deadEndStep",
  /*
   * The engine's other structural failures (2026-08-31, the same day as the
   * two above): a missing start step, a dangling connection, a step asked to
   * do something its type does not support, a cycle among the nodes that
   * advance on their own. Any node could be the current one when the graph
   * is broken, so — same reasoning as the pair above — always.
   */
  "flow.missingStartNode",
  "flow.currentNodeMissing",
  "flow.nodeMissing",
  "flow.nodeCannotBeAnswered",
  "flow.noFreeTextAccepted",
  "flow.unsupportedNodeType",
  "flow.notAPage",
  "flow.pageDeadEnd",
  "flow.targetNodeMissing",
  "flow.loopDetected",
  "flow.ruleLoopDetected",
  "flow.exitNotConnected",
  "preview.previousAnswers",
  "preview.wayBack",
  "step.number",
  // *avklarat*, said for every step passed in the step row — a page or a
  // standalone question alike since 1/10 (Astra, bilaga 10 punkt 8), so any
  // guide with two steps reaches it. It was a page's key before.
  "step.done",
  "step.untitled",
  "nav.next",
  "nav.previous",
  /*
   * The variables panel, on by default in every guide. "Variabler" and "tomt"
   * were hardcoded Swedish in its markup until an English page on a tablet
   * showed them up — the same story as preview.regionLabel above.
   */
  "preview.variables",
  "preview.emptyValue",
];

/**
 * Every word `chip-picker` can show out of a ready-made list.
 *
 * Written once because the control is one: the multiple-choice list, the
 * searchable single choice and both lookups are the same element with a
 * different source. Listing them per type again is how two copies of a list
 * start to drift.
 */
const PICKER_KEYS = [
  "choice.search",
  "choice.searchPlaceholder",
  "choice.chosen",
  "choice.chosenNone",
  "choice.add",
  "choice.remove",
  "choice.added",
  "choice.addedOne",
  "choice.removed",
  "choice.removedOne",
  "choice.left",
  "choice.oneLeft",
  "choice.matches",
  "choice.oneMatch",
  "choice.noMatches",
  "choice.allChosen",
  /*
   * Ett val som utesluter de andra. Raden i listan och statusradens andra
   * mening — de syns bara i en lista som HAR ett exklusivt alternativ, men
   * nåbarheten är per kontroll och inte per guide: den frågar vad kontrollen
   * kan visa, inte vad den råkar visa i dag.
   */
  "choice.or",
  "choice.exclusiveCleared",
  "choice.exclusiveRemoved",
];

/** What a node type puts on the screen simply by being there. */
export const BY_TYPE: Record<string, string[]> = {
  question: ["field.chooseOption", "validation.selectOption"],
  "multi-choice": [
    "field.chooseOneOrMore",
    "field.hint.atLeast",
    "field.hint.atMost",
    "field.hint.exact",
    "field.hint.range",
    "validation.selectAtLeastOne",
    "validation.selectAtLeast",
    "validation.selectAtMost",
    /*
     * Flervalslistan. Presentationen sitter på noden och inte på en egen typ —
     * samma sak som textfrågans bestämda former ovan — så varje flervalsfråga
     * kan nå dem. Söktexterna kommer först när alternativen är många nog att
     * sökrutan visas, vilket också är en egenskap hos noden.
     */
    ...PICKER_KEYS,
  ],
  "text-question": [
    "field.writeAnswer",
    /*
     * Sägs bara av ett fält med bestämd form, men formen sitter på nodtypen och
     * inte på en egen typ — så varje textfråga kan nå dem.
     */
    "field.onlyDigits",
    "field.onlyLettersAndDigits",
    "field.pasteAmbiguous",
  ],
  "map-question": [
    "map.pick",
    "map.change",
    "map.floorLabel",
    "map.notConnected",
    "map.chosen",
  ],
  "number-question": [
    "field.enterNumber",
    "field.unitSuffix",
    "validation.number.invalid",
    // The slider and the − / + buttons (story 095): said by a number shown
    // that way, and uncertain means reachable.
    "field.slider",
    "field.stepDown",
    "field.stepUp",
    /*
     * Frågan om ett orört fält (story 118): sägs av en fråga som bär
     * inställningen, på en sida eller på ett eget steg. Osäkert betyder nåbart.
     *
     * `validation.fieldUntouched` är motorns dom och står kvar: visaren frågar
     * i stället för att visa den, men en värd som kör motorn själv får den.
     */
    "validation.fieldUntouched",
    "dialog.untouched.message",
    "dialog.untouched.continue",
    "dialog.untouched.change",
  ],
  /*
   * Uppslaget är samma kontroll som flervalslistan sedan 31/8, så det når
   * `choice.*` — inklusive krysset. Det enkla uppslaget visar numera sitt val
   * som en etikett i rutan och inte som text i den, alltså kan även det nå
   * `choice.remove`; det var skälet krysset stod bara på flervalet förut.
   *
   * `choice.hint`, `choice.searching` och `choice.error` når bara ett uppslag:
   * en färdig lista har inget att vänta på och kan inte misslyckas.
   */
  "autocomplete-question": [
    "field.selectPlaceholder",
    ...PICKER_KEYS,
    "choice.hint",
    "choice.searching",
    "choice.error",
  ],
  "multi-autocomplete-question": [
    "field.selectPlaceholder",
    ...PICKER_KEYS,
    "choice.hint",
    "choice.searching",
    "choice.error",
  ],
  /*
   * Tre typer som saknades, och som därför föll igenom till "unknown".
   *
   * Den gardan returnerar **varje nyckel vi skickar**, för en typ ingen här känner
   * igen kan visa vad som helst. Den finns för en värds egna nodtyper — men den
   * slog till på tre av våra egna, och då räknade grinden alltid till fullt.
   *
   * Mätt: exempelguiden nådde "63 av 63" även efter att filfältet och den
   * annoterade bilden tagits bort ur den. Testet som säger *"om den slutar nå
   * allt har guiden tappat ett fält"* kunde alltså inte se att ett fält
   * försvunnit — och changeloggens rad "59 → 64 med filfältets fem" räknade
   * strängar som lagts till utan att någon nod någonsin pekats ut som den som
   * visar dem.
   */
  "file-question": [
    "field.attach",
    "validation.file.required",
    "validation.file.size",
    "validation.file.type",
  ],
  "consent-question": ["validation.consent.required"],
  /*
   * The rating (story 115) says *Välj ett alternativ* over its row like the
   * single choice does, and it is the only field that can offer the built-in
   * way out — an editor who wrote their own words shows those instead, which
   * is why the key is reachable rather than certain.
   */
  "rating-question": ["field.chooseOption", "field.notApplicable", "field.dontKnow"],
  "date-question": [
    "field.enterDate",
    "field.dateFormat",
    "validation.date.invalid",
    "validation.date.min",
    "validation.date.max",
    "validation.date.afterField",
    "validation.date.beforeField",
    /*
     * Frågan om ett orört fält (story 118): sägs av en fråga som bär
     * inställningen, på en sida eller på ett eget steg. Osäkert betyder nåbart.
     *
     * `validation.fieldUntouched` är motorns dom och står kvar: visaren frågar
     * i stället för att visa den, men en värd som kör motorn själv får den.
     */
    "validation.fieldUntouched",
    "dialog.untouched.message",
    "dialog.untouched.continue",
    "dialog.untouched.change",
  ],
  image: ["image.none"],
  "annotated-image": ["image.none", "image.commentCounter"],
  /*
   * `step.result` is no longer drawn by the viewer since 1/10 — a result shows
   * the way that led to it, not the node type's word (Astra, bilaga 10 punkt
   * 8). It stays reachable for the same reason as `validation.fieldUntouched`
   * above: a host running the step model itself (`src/runtime/`) still says
   * it, and uncertain means reachable.
   */
  result: ["step.result", "nav.restart"],
  /*
   * Mottagarpanelen (de tre preview.recipient-nycklarna) sitter på noderna
   * som bär ett mottagar-id — inlämningen och e-postresultatet — för det är
   * deras närvaro som ritar panelen.
   */
  "email-result": ["step.result", "nav.restart", "preview.recipients", "preview.recipientMissing", "preview.recipientVisitor"],
  /*
   * Granskningen (story 049) och inlämningen (story 050). Deklarationens två
   * rubriker sitter båda på granskningen: vilken av dem som sägs beror på om
   * guiden slutar i något som skickas, och osäkert betyder nåbart.
   */
  /*
   * `nav.submit` sitter på granskningen, inte på inlämningen: det är
   * granskningens fortsättningsknapp som byter ord när nästa steg lämnar in
   * ärendet. En guide med en granskning kan nå den — osäkert betyder nåbart,
   * som för rubrikerna ovan.
   */
  // *Inget svar* (`preview.noAnswer`, 177a4bf0): the engine's label for an
  // optional step left empty, read where the answers are listed — the review
  // and the receipt.
  review: ["review.change", "review.changeAria", "review.changePageAria", "review.declarationSend", "review.declarationBasis", "nav.submit", "preview.noAnswer"],
  "submit-result": ["preview.noAnswer", "submit.sending", "submit.waiting", "submit.referenceIntro", "submit.whatWasSent", "submit.failed", "submit.failedTitle", "submit.retry", "submit.unconfirmed", "preview.recipients", "preview.recipientMissing", "preview.recipientVisitor", "nav.newCase"],
  // Felsummeringen (story 051) sägs av en sida med minst två fel — varje sida
  // med fält kan nå den, och osäkert betyder nåbart.
  // *Det här har du redan angett* (story 138) sägs av ett textfält i en
  // upprepad sida — sidan är det som kan nå den.
  page: ["validation.chooseOption", "validation.fieldRequired", "page.errorSummary", "validation.alreadyGiven"],
  code: [],
  "page-heading": [],
  "page-spacer": [],

  /*
   * Nodes a resident never sees.
   *
   * A rule weighs answers, a calculation works one out, a service call fetches
   * something, an annotation is a note to the editor. They are traversed or
   * they are the tool's; none of them puts a viewer text on the screen.
   *
   * They have entries rather than falling through to "unknown", which returns
   * every key. That guard is for a type nobody here has heard of — a host's own
   * — and leaving our own types out of the table turned the guard into the
   * answer: six of the bundled guides reached 49 of 49 because one rule node
   * made the whole calculation give up.
   */
  rule: [],
  calculation: [],
  "service-call": [],
  annotation: [],
};

/** What a field's own settings make possible. */
function fromSettings(node: FlowNodeData): string[] {
  const data = node.data as Record<string, unknown>;
  const keys: string[] = [];

  if (data.required === true) {
    keys.push("field.required", "validation.required");
  }
  if (typeof data.minLength === "number") {
    keys.push("validation.minLength");
  }
  if (typeof data.maxLength === "number") {
    // A character limit brings its counter with it.
    keys.push("validation.maxLength", "counter.count", "counter.remaining", "counter.over");
  }
  if (typeof data.min === "number") {
    keys.push("validation.number.min");
  }
  if (typeof data.max === "number") {
    keys.push("validation.number.max");
  }
  if (typeof data.format === "string" && data.format !== "") {
    const named = `validation.format.${data.format}`;
    // A format we do not ship a message for falls back to the generic one.
    keys.push(named in VIEWER_STRINGS ? named : "validation.format.pattern");
  }
  if (data.allowFreeText === false) {
    keys.push("validation.chooseFromList");
  }
  // Story 051: varför-raden finns bara där redaktören skrivit en.
  const why = data.why;
  const hasWhy = typeof why === "string"
    ? why.trim() !== ""
    : typeof why === "object" && why !== null &&
      Object.values(why).some((entry) => typeof entry === "string" && entry.trim() !== "");
  if (hasWhy) {
    keys.push("question.why");
  }
  // Story 084: en sida som upprepas har rubriker och knappar per post.
  if (data.repeats === true) {
    keys.push("repeat.legend", "repeat.add", "repeat.remove", "repeat.removed", "validation.repeatMin", "validation.repeatMax");
  }
  // Story 096: a Text shown as a box says its kind as a word — that kind's
  // word only, the box has no other text of its own.
  const kind = calloutKind(node);
  if (kind) {
    keys.push(`callout.${kind}`);
  }
  /*
   * Story 108: exempelfotots knapp och dess besked finns bara där noden bär
   * ett exempelfoto. Att värden dessutom måste sätta `example-files` vet
   * grafen ingenting om — och osäkert betyder nåbart, som reglerna överst
   * säger: en rad för mycket hoppar översättaren över.
   */
  if (typeof data.exampleImage === "string" && data.exampleImage.trim() !== "") {
    keys.push("file.useExample", "file.exampleFailed");
  }
  // Story 047: markeringsytan finns bara där redaktören slagit på den.
  if (data.allowMarking === true) {
    keys.push("marking.hint", "marking.remove", "marking.removeShort", "marking.goto", "marking.describe", "marking.clear", "marking.count");
  }
  return keys;
}

/**
 * The viewer keys this guide can reach.
 *
 * Returns every key we ship when the guide contains a node type nothing knows
 * about — see "uncertain means reachable" above.
 */
export function reachableViewerKeys(graph: GraphData): string[] {
  const reachable = new Set(ALWAYS);
  const all = Object.keys(VIEWER_STRINGS);

  /*
   * The progress meter is the guide's own choice (story 116), so its two texts
   * are reachable exactly when the guide asked for it. A guide without the
   * setting keeps the step mark, never draws the meter, and its translator is
   * not shown the two lines — which is the whole point of this file.
   */
  if (graph.settings?.progress === true) {
    reachable.add("progress.label");
    reachable.add("progress.value");
  }

  for (const node of graph.nodes) {
    const byType = BY_TYPE[node.type];
    if (!byType) {
      // A node type we have no entry for. It may be a custom type of the host's,
      // and we cannot know what it renders.
      return all;
    }
    for (const key of byType) {
      reachable.add(key);
    }
    for (const key of fromSettings(node)) {
      reachable.add(key);
    }
    // An option whose value no longer exists is reported to the resident.
    const options = QuestionOptionsService.getOptions(node);
    if (options.length > 0) {
      reachable.add("validation.optionMissing");
    }
    /*
     * Story 134. Both sentences hang on a single option carrying a condition:
     * the row saying the list is shorter than it looks, and the one saying a
     * choice already made has to be made again. A question with no conditional
     * option can show neither, and its translator should not be asked for
     * them.
     */
    if (options.some((option) => option.visibility !== undefined)) {
      reachable.add("field.someOptionsHidden");
      reachable.add("validation.choiceRedo");
    }
    /*
     * Story 138, Johan 29/9: a choice with *Varje upprepning ska välja olika*
     * has a row of its own for what another record chose, and two records
     * standing on the same option (a saved run handed back) are told on the
     * later one. It never empties — the record's own answer is always
     * offered — so it reaches neither of the conditions' two above.
     */
    if (node.data.uniqueAcrossRepeats === true && options.length > 0) {
      reachable.add("field.optionsTakenElsewhere");
      reachable.add("field.noOptionsLeft");
      reachable.add("validation.noOptionsLeft");
      reachable.add("validation.alreadyChosen");
    }
  }

  // Only keys we actually ship: a typo above must not invent one.
  return all.filter((key) => reachable.has(key));
}

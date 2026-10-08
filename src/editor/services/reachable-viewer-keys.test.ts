import { describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";

import { VIEWER_STRINGS } from "../../viewer/localization/built-in-strings";
import { reachableViewerKeys, BY_TYPE } from "./reachable-viewer-keys";
import { getNodeTypes } from "../../viewer/node-types/node-type-registry";
import { housingScreeningExampleGraph } from "../../data/housing-screening-example-graph";

import type { GraphData } from "../../viewer/types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../testing/optional-pro";
const { viewerCoverageGraph } = ((await proModule("data/viewer-coverage-graph.ts")) ?? {}) as { viewerCoverageGraph: GraphData };
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * The reach is a number, and the number has to be pinned somewhere.
 *
 * ## Why this file exists
 *
 * Everything else that uses `reachableViewerKeys` reads the expected count from
 * the same function — deliberately, so a hardcoded number cannot drift out of
 * step with the code. The cost only became visible under sabotage: making the
 * function return every key we ship failed **nothing**. The suite checked that
 * the count was consistent, not that it was right.
 *
 * So one file states actual numbers. It is the place a hardcoded value belongs:
 * everywhere else the number is a detail of the guide under test, and here it
 * *is* the subject.
 */

const ALL = Object.keys(VIEWER_STRINGS).length;

describe("what a guide can show", () => {
  test("there are keys to reach at all", () => {
    expect(ALL).toBeGreaterThan(40);
  });

  /*
   * Eight nodes: two questions, a rule and three results. It reaches the frame
   * around a step, what a single-choice question renders, and what a result
   * adds — nowhere near the whole table.
   */
  test("the screening guide reaches fourteen of them", () => {
    const keys = reachableViewerKeys(housingScreeningExampleGraph);

    /*
     * The total is asserted, not only the reach: a key added without a field
     * that can show it is a message nobody will ever see, and this number
     * growing is where that becomes visible. 51 → 53 when postnummer and
     * organisationsnummer arrived, 53 → 56 with the date field's three, and the
     * every-field guide gained a field for each so that it still reaches them
     * all — which is the only thing that guide is for. 56 → 57 with the
     * consent's own message, which exists because "Fältet är obligatoriskt" in
     * front of a single checkbox names a state instead of an action, and 57 → 58
     * with the date step's own prompt, and 58 → 59 with the remove button on a
     * lookup tag — a name a screen reader reads and therefore a string. 59 → 64
     * with the file field's five: two prompts and three refusals. Back to 63
     * when holding until submit became the default and the note about an
     * unconnected host had nothing left to describe. 63 → 65 with the two a
     * shaped field says when it has quietly thrown away what somebody typed —
     * the screening guide has no shaped field, so its reach is unchanged, which
     * is the point of asserting both numbers. 65 → 66 with the name of the way
     * here — the list of what has already been answered, which a screen reader
     * reads before it counts the rows. That one belongs to the frame around a
     * step rather than to any field, so every guide reaches it: 12 → 13.
     *
     * 13 → 14 and 66 stays 66: the same list has a second form
     * (`answer-display="history"`) whose label was hardcoded Swedish beside a
     * twin that asked the registry, so an English guide announced "Tidigare
     * svar". It joins the frame for the same reason its twin did. The total
     * held because a key that was never rendered — `field.enterNumberUnit` —
     * left in the same sweep: a key nothing can reach still counted as
     * reachable, which is the arithmetic this file exists to keep honest.
     *
     * 66 → 67 with the refusal of an ambiguous paste — a line carrying two
     * genuine values names neither, and the field says so instead of shaping
     * the first one. It sits with the shaped field's other two refusals; the
     * screening guide has no shaped field, so its reach holds at 14.
     *
     * 14 → 16 and 67 → 69 with the variables panel's two — "Variabler" and
     * "tomt" were hardcoded Swedish in its markup until an English page on a
     * tablet showed them up. The panel is on by default in every guide, so
     * they join the frame and every guide's reach rises with them.
     *
     * 69 → 74 with the map question's five (story 046): the pick button, its
     * "change" form, the floor's label, the statement a guide makes when no
     * provider is registered, and the announcement of a chosen place. All
     * five sit on the node type; the screening guide has no map, so its
     * reach holds at 16 — which is the point of asserting both numbers.
     *
     * 74 → 81 with the photo marks' seven (story 047, numbered the same
     * evening on Johan's "en siffra för varje annotering"): the hint, the
     * per-mark text label, the dot's go-to, two removes, Rensa and the
     * counter. They sit on the field setting `allowMarking`, not the type —
     * the screening guide has neither, so 16 holds again.
     *
     * 81 → 92 with the forms initiative's eleven (stories 049/050/051): the
     * why-line (on the field setting `why`), the error summary (on the page
     * type), the review step's four and the submission's five (each on its
     * node type). The screening guide has none of these — no page, no why,
     * neither new type — so 16 holds a third time.
     *
     * 92 → 95 with the recipient panel's three — the variables panel's twin,
     * for where a submission lands: the summary, the tidied-id verdict and
     * the visitor's-own-address label. They sit on the two node types that
     * carry a recipient id, which the screening guide has neither of.
     *
     * Between here and the next entry the total moved to 107 without this
     * comment chain being extended — a change this session did not make and
     * has not traced, so it is not narrated as arithmetic here.
     *
     * 107 → 119 with the engine's other eleven structural failures — a
     * missing start step, a dangling connection, an unsupported step type, a
     * cycle among the auto-advancing nodes — converted the same way the
     * dead-end pair above was: 35 `this.failure(code, "svensk text")` calls
     * in `guide-traversal-engine.ts` that a guide shown in English or
     * Finnish still failed in Swedish. Any node can be the current one when
     * the graph is broken, so all twelve (the pair plus the new eleven,
     * `flow.pageDeadEnd` and `flow.targetNodeMissing` each covering more
     * than one call site with identical wording) join the frame.
     *
     * 119 → 122 with story 062's three, → 124 with the date ghost (design A,
     * 31/8): the *eller* row above an option that
     * stands alone, and the two sentences that say why the others went. They
     * belong to `chip-picker`, which the screening guide never renders — so
     * 30 holds while the total moves, which is the whole point of measuring
     * the two numbers apart.
     *
     * 124 → 130 with story 084's six: the legend, Add, Remove, the removal
     * announcement and the too-few and too-many messages. They sit on the page setting
     * `repeats`; the screening guide has no page, so 30 holds.
     *
     * 130 → 131 with story 089's one: the page's *Change* in the review,
     * *Ändra svaren på {q}*. It sits on the review node; 30 holds.
     *
     * 131 → 133 with story 087's two: *samma som eller efter Från* and its
     * mirror, for a date bound that is another field. They sit on the date
     * question, which the screening guide has none of; 30 holds.
     *
     * 133 → 136 with story 095's three: the slider's name and the − / +
     * buttons' on a number question. The screening guide has no number
     * question; 30 holds.
     *
     * 136 → 139 with story 096's three: the words on a Text shown as a box,
     * *Info*, *Viktigt*, *Tips*. They sit on a Text in a page, which the
     * screening guide has none of; 30 holds.
     *
     * 139 → 141 with story 108's two: the example photo's button and the word
     * when it cannot be fetched. They sit on a file question that carries an
     * example photo, which the screening guide has none of; 30 holds.
     *
     * 141 → 143 with story 115's two: *Inte aktuellt* and *Vet ej*, the
     * rating's two ways out in the reader's language when the editor wrote no
     * words of their own. They sit on the rating question, which the screening
     * guide has none of; 30 holds.
     *
     * 143 → 145 with story 116's two: the progress meter's name and its
     * number. They are reachable only in a guide whose `settings.progress` is
     * on, which the screening guide is not; 30 holds.
     *
     * 145 → 144, and 30 → **29**, when `step.current` went the same day. That
     * one was reachable in every guide, so this is the rare change that moves
     * both numbers: it was an `aria-label` on a `<p>`, which ARIA forbids from
     * carrying a name, so nothing ever rendered it. A key nothing renders is a
     * line a translator pays for and nobody reads.
     *
     * 144 → 145 with story 118's one: *Ändra {field} innan du går vidare*,
     * said by a field the visitor has to have TOUCHED and not merely found
     * filled in. It sits on a number or date question carrying that setting,
     * which the screening guide has none of; 29 holds.
     *
     * 145 → 148 the same day, when Johan turned that refusal into a question:
     * the dialog's sentence and its two buttons. They sit on the same setting
     * on the same two node types, so again 29 holds. The refusal above stays —
     * it is still what the engine answers a host that drives it alone.
     *
     * 148 → 150 with story 134's two: the row saying some options are held
     * back, and the one saying a choice that is gone has to be made again.
     * Both hang on an option carrying a condition, which the screening guide
     * has none of; 29 holds again.
     *
     * 150 → 151 with A7:s enda: beskedet när värdens tidsfönster gått ut och
     * inlämningen inte kunde bekräftas. Den sitter på kvittonoden, som
     * granskningsguiden inte har; 29 håller.
     *
     * 151 → 152 med de namngivna stegens "avklarat" (25/9): sägs för en
     * passerad sida, och granskningsguiden är lösa frågor utan sida; 29 håller.
     *
     * 152 → 153 med berättelse 138:s *Det här har du redan angett*: sägs av
     * ett textfält på en upprepad sida, och räknas på sidan; ingen sida här,
     * 29 håller.
     *
     * 153 → 155 med chip-väljarens räknare (uppdrag 29/9 Del D): *kvar att
     * välja* och *träffar* blev två ordpar där det var ett. Granskningsguiden
     * har ingen chip-väljare; 29 håller.
     *
     * 155 → 156 med berättelse 138 C1:s *redan valt i en annan upprepning*:
     * sägs bara av en envalsfråga med inställningen, som granskningsguiden
     * inte har; 29 håller.
     *
     * 156 → 157 med inställningens egen hjälprad (*Alternativ som du valt i
     * andra upprepningar visas inte här*), samma nod, samma skäl; 29 håller.
     *
     * 157 → 158 med tomläget (*Inga alternativ finns att välja just nu*),
     * samma nod igen; 29 håller.
     *
     * 158 → 159 med tomlägets fel vid Nästa (*Ta bort den här upprepningen
     * eller ändra ett tidigare val*), samma nod; 29 håller.
     *
     * 159 → 160 med inlämningens platshållare (*Väntar på svar …*, berättelse
     * 144): sägs bara av en inlämningsnod, som granskningsguiden inte har;
     * 29 håller.
     *
     * 29 → 30 (1/10, Astra bilaga 10 punkt 8): *avklarat* sägs nu för varje
     * passerat steg, fristående frågor också — granskningsguiden har bara
     * frågor och når det därför; förut bara en guide med sidor. 160 håller.
     *
     * 160 → 161 med *Inget svar* (`preview.noAnswer`, 177a4bf0): sägs i
     * granskningen och kvittot, som granskningsguiden inte har; 30 håller.
     *
     * 161 → 162 med felkortets rubrik (`submit.failedTitle`, Astra bilaga
     * 12): en misslyckad inlämning tackade under redaktörens kvittorubrik.
     * Sägs bara av en inlämningsnod; 30 håller.
     */
    expect({ reached: keys.length, ofTotal: ALL }).toEqual({
      reached: 30,
      ofTotal: 162,
    });
  });

  test("and they are the ones it can actually render", () => {
    expect(reachableViewerKeys(housingScreeningExampleGraph).sort()).toEqual([
      "guide.notTranslated",
      // De två en besökare möter om guiden tar slut mitt i. Ramen, alltså —
      // vilken nod som helst kan sakna sin koppling.
      "flow.deadEndOption",
      "flow.deadEndStep",
      // Motorns övriga elva strukturella fel (31/8) — samma skäl: vilken nod
      // som helst kan vara den aktuella när grafen är trasig.
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
      "nav.next",
      "nav.previous",
      "nav.restart",
      "preview.previousAnswers",
      "preview.regionLabel",
      "preview.wayBack",
      "step.number",
      "step.done",
      "step.result",
      "step.untitled",
      "validation.optionMissing",
      "validation.selectOption",
      "field.chooseOption",
      // The variables panel's two, frame-level since the panel is on by default.
      "preview.variables",
      "preview.emptyValue",
    ].sort());
  });

  /*
   * The fixture that exists to exercise the maximum. If it stops reaching
   * everything, either the calculation lost a branch or the fixture lost a field.
   *
   * It used to be the every-field *example*, which made that guide serve two
   * masters: a demonstration a person reads, and a fixture crowded with every
   * type. Being both is how it ended up showing a citizen two empty image
   * placeholders in a row. The demonstration is a fault report now; the coverage
   * lives in `viewer-coverage-graph.ts`, which nothing renders.
   *
   * This assertion was also passing for the wrong reason. `consent-question`,
   * `date-question` and `file-question` had no entry in `BY_TYPE`, so each fell
   * through to the "unknown type contributes everything" guard — and any guide
   * containing one of them reached all sixty-three keys whatever else it held.
   * Measured: the example still reached 63 of 63 after its file field and its
   * annotated image were removed. With the three entries added it reaches 56,
   * missing exactly the file and image strings, which is the number meaning
   * something again.
   */
  test.runIf(PRO)("the coverage fixture reaches all of them", () => {
    expect(reachableViewerKeys(viewerCoverageGraph).length).toBe(ALL);
  });

  /*
   * A rule renders nothing to a resident. It had no entry once, and the
   * "unknown type contributes everything" guard then made a single rule node
   * turn the whole calculation into "all 49" — which is how six bundled guides
   * measured 49 of 49 while the feature looked like it worked.
   */
  test("an invisible node type adds nothing", () => {
    const question = housingScreeningExampleGraph.nodes.find(
      (node) => node.type === "question",
    )!;
    const withoutRules: GraphData = {
      ...housingScreeningExampleGraph,
      nodes: housingScreeningExampleGraph.nodes.filter(
        (node) => node.type !== "rule",
      ),
    } as GraphData;

    expect(reachableViewerKeys(withoutRules).length).toBe(
      reachableViewerKeys({
        ...withoutRules,
        nodes: [...withoutRules.nodes, { ...question, id: "extra-rule", type: "rule" }],
      } as GraphData).length,
    );
  });

  // Uncertain means reachable: a type nobody here has heard of is a host's own,
  // and we cannot know what it renders.
  test("a node type we do not know contributes everything", () => {
    const unknown: GraphData = {
      startNodeId: "x",
      nodes: [{ id: "x", type: "host-own-type", position: { x: 0, y: 0 }, data: {} }],
      connections: [],
    } as unknown as GraphData;

    expect(reachableViewerKeys(unknown).length).toBe(ALL);
  });
});

describe("varje typ vi själva skickar är namngiven", () => {
  test("ingen av dem faller igenom till \"unknown\"", () => {
    /*
     * Det här är hålet, vaktat vid roten.
     *
     * "Unknown" returnerar **varje nyckel vi skickar**, och den gardan är rätt
     * för en värds egen nodtyp: den kan visa vad som helst och vi vet inget om
     * den. Men den gör också att en av *våra* typer utan post räknar till fullt
     * — och då betyder siffran ingenting.
     *
     * Så det hände: `consent-question`, `date-question` och `file-question`
     * saknades, och exempelguiden nådde "63 av 63" även efter att filfältet och
     * den annoterade bilden tagits bort ur den. Räkningen ovan kan inte se det
     * — utan post *ökar* täckningen — så den kontrollen måste stå här i stället,
     * på listan och inte på summan.
     */
    const utan = getNodeTypes()
      .map((typ) => typ.type)
      .filter((typ) => !(typ in BY_TYPE))
      .sort();

    expect(utan, `nodtyper utan post i BY_TYPE: ${utan.join(", ")}`).toEqual([]);
  });
});

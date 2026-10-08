import type { GraphData } from "../viewer/types/graph";

/**
 * Medborgarskap — a country field, several answers, feeding a rule.
 *
 * ## What this example is for
 *
 * It is the smallest guide that shows the whole chain the bundled code lists
 * exist for: a field that offers a closed list, a code stored beside the label,
 * and a rule that branches on the **code** rather than on what the field said.
 *
 * That distinction is the reason the guide is worth clicking through. The field
 * stores *Tyskland* in one variable and `DE` in another; the rule tests `DE`.
 * Branch on the label instead and the guide works in Swedish and quietly stops
 * working the day somebody reads it in English — the label is translated, the
 * code is not.
 *
 * ## Why it ends where it does
 *
 * Nothing here is a decision, and the results say so. Citizenship is a question
 * with real consequences for a person, and an example guide has no business
 * pretending to answer it — so each outcome names what to do next rather than
 * what somebody is entitled to.
 *
 * ## Why it asks *which countries* rather than *which citizenships*
 *
 * Because the list holds countries. Skatteverket publishes country names —
 * Tyskland — and Swedish would say *tyskt medborgarskap*, so a heading about
 * citizenships over a list of countries reads as a mismatch. Showing
 * nationality forms instead would mean a second, hand-written list beside
 * theirs, translated by us and drifting from the codes it is meant to name.
 * The heading follows the data.
 *
 * Plural for its own reason: dual citizenship is ordinary, and a form with
 * room for one is wrong for exactly the people the question is about. It is also the example the
 * multi-value lookup did not have: labels with a cross, a search that reaches
 * two hundred countries, and a code stored beside each label.
 *
 * Making it plural is what found the gap it now demonstrates. A multi-value
 * answer was stored newline-separated, and `one-of` compared that whole string
 * against its list — so a rule on several answers matched nothing, silently,
 * always in favour of the default branch. It reads the answer as a list now.
 *
 * And it found the second gap too: with several answers, *some* and *all* stop
 * being the same question. See the Nordic branch below.
 *
 * ## Why the Nordic branch asks for *all* of them
 *
 * Because that is what the branch is called. `one-of` would have meant *any
 * one of your citizenships is Nordic*, and somebody holding a Danish and a
 * Turkish passport is not thereby free of the permit rules. Johan, 2026-08-31:
 * *"kan det vara alla ska vara och alla får inte vara?"* — a set has four
 * questions and the product had two. So the branch is `all-of`: every answer
 * must be in the list, and Danish-and-Turkish lands outside it.
 *
 * The order of the cases is still an authoring decision, not an accident:
 * stateless (`XS`) is asked first with `one-of`, so somebody who is stateless
 * reaches that branch whatever else they hold.
 *
 * ## The stateless branch
 *
 * `XS` is not decoration. Skatteverket's list carries four codes ISO does not —
 * `XO` unknown, `XS` stateless, `ZZ` under investigation, `XU` ceased — and a
 * guide about permits or benefits that cannot express *stateless* is broken for
 * exactly the people it was written for. It is a branch here so the example
 * shows the argument rather than stating it.
 *
 * ## Why the rule still asks, now that the field cannot produce the answer
 *
 * Story 062 is built: the four codes carry `exclusive` in the code list, so
 * choosing *stateless* clears the countries and choosing a country clears
 * *stateless*. A visitor going through this guide today cannot reach the rule
 * holding both.
 *
 * `one-of XS` stays anyway, and not out of caution. A guide is data, and data
 * outlives the control that produced it: an answer stored before the flag
 * existed, or one arriving from a host that filled the variable itself, is
 * still a set this rule has to route somewhere. The field is what keeps the
 * contradiction from being written; the rule is what handles it if it was
 * written anyway. Two different jobs, which is why removing either would be a
 * loss rather than a tidy-up.
 */
export const citizenshipExampleGraph: GraphData = {
  startNodeId: "medborgarskap",
  settings: { sourceLocale: "sv" },
  nodes: [
    {
      id: "medborgarskap",
      type: "multi-autocomplete-question",
      position: { x: 0, y: 220 },
      data: {
        title: {
          sv: "Vilka länder är du medborgare i?",
          en: "Which countries are you a citizen of?",
        },
        description: {
          sv: "Börja skriva landets namn. Har du fler än ett, lägg till alla — de visas som etiketter du kan ta bort. Är du statslös finns det som ett eget val.",
          en: "Start typing the country's name. If you hold more than one, add them all — they appear as labels you can remove. Stateless is an option of its own.",
        },
        placeholder: { sv: "T.ex. Tyskland", en: "For example Germany" },
        /*
         * Ett svar med delar: etiketten en person läser och koden en regel
         * litar på. De låg i två variabler fram till version 9 och hölls i
         * takt av ordningen de skrevs i; nu är de ett värde, och ett villkor
         * namnger delen — `land.value`.
         */
        variableName: "land",
        variableLabel: { sv: "Medborgarskap", en: "Citizenship" },
        minSelected: 1,
        source: "codelist",
        codeListId: "navet-country-codes",
        // Off, because a country must yield a valid code to be worth anything.
        allowFreeText: false,
        required: true,
        minChars: 2,
      },
    },
    {
      id: "regel",
      type: "rule",
      position: { x: 520, y: 220 },
      data: {
        title: { sv: "Var ansöker du?", en: "Where do you apply?" },
        fallbackLabel: "Utanför EU/EES",
        cases: [
          {
            id: "statslos",
            label: "Statslös",
            match: "any",
            conditions: [
              { id: "c-xs", variableName: "land.value", operator: "one-of", value: "XS" },
            ],
          },
          {
            id: "norden",
            label: "Norden",
            match: "any",
            conditions: [
              /*
               * Ett villkor i stället för fem: operatorn läser sitt värde som
               * en kommalista, och sedan svaret kan vara flera läser den svaret
               * som en lista också.
               *
               * `all-of` och inte `one-of`: grenen heter Norden, och `one-of`
               * hade menat *något av dina medborgarskap är nordiskt*. Den som
               * har svenskt och tyskt medborgarskap är inte självklart nordisk
               * — Johans fråga 31/8, och hela skälet till berättelse 061.
               * Varenda ett måste alltså vara nordiskt.
               */
              { id: "c-norden", variableName: "land.value", operator: "all-of", value: "SE,DK,FI,NO,IS" },
            ],
          },
        ],
      },
    },
    {
      id: "resultat-statslos",
      type: "result",
      position: { x: 1040, y: 0 },
      data: {
        title: { sv: "Kontakta Migrationsverket", en: "Contact the Migration Agency" },
        description: {
          sv: "Statslöshet hanteras i en egen ordning och går inte att svara på i en guide. Migrationsverket är rätt väg in.",
          en: "Statelessness is handled separately and a guide cannot answer it. The Migration Agency is the way in.",
        },
      },
    },
    {
      id: "resultat-norden",
      type: "result",
      position: { x: 1040, y: 400 },
      data: {
        title: { sv: "Ingen ansökan behövs", en: "No application needed" },
        description: {
          sv: "Nordiska medborgare behöver varken uppehållstillstånd eller registrering för att bo och arbeta här.",
          en: "Nordic citizens need neither a residence permit nor registration to live and work here.",
        },
      },
    },
    {
      id: "resultat-ovrigt",
      type: "result",
      position: { x: 1040, y: 800 },
      data: {
        title: { sv: "Ansök om uppehållstillstånd", en: "Apply for a residence permit" },
        description: {
          sv: "Ansökan görs hos Migrationsverket. Vilket tillstånd som gäller beror på varför du ska vara här — arbete, studier eller familj.",
          en: "The application goes to the Migration Agency. Which permit applies depends on why you are here — work, study or family.",
        },
      },
    },
  ],
  connections: [
    {
      id: "c1",
      from: { nodeId: "medborgarskap", portId: "continue" },
      to: { nodeId: "regel", portId: "input" },
    },
    {
      id: "c2",
      from: { nodeId: "regel", portId: "statslos" },
      to: { nodeId: "resultat-statslos", portId: "input" },
    },
    {
      id: "c3",
      from: { nodeId: "regel", portId: "norden" },
      to: { nodeId: "resultat-norden", portId: "input" },
    },
    {
      id: "c4",
      from: { nodeId: "regel", portId: "default" },
      to: { nodeId: "resultat-ovrigt", portId: "input" },
    },
  ],
} as unknown as GraphData;

import type { GraphData } from "../viewer/types/graph";

/**
 * Kommun — one municipality from SCB's list, and a rule that reads its code.
 *
 * ## What this shows that the citizenship example does not
 *
 * Three things, and each is the reason it exists beside that one rather than
 * repeating it:
 *
 * 1. **One answer, not several.** The citizenship guide is a multi-value
 *    lookup because dual citizenship is ordinary. An errand belongs to one
 *    municipality, so this is the single-value field — the same list, the same
 *    parts, a different control.
 * 2. **Both parts printed.** The result writes `{{kommun.label}}` and
 *    `{{kommun.value}}` side by side, which is the shortest way to see that
 *    one answer carries a name a person reads and a code a system needs.
 *
 *    Both parts spelled out, including the name. `{{kommun}}` prints the same
 *    thing — the whole read as its text — but it is not what the variable
 *    button inserts and not what the list names, and an example that spells a
 *    thing differently from the tool teaches the tool wrong. The bare form
 *    stays valid for guides written before parts existed; it is simply not the
 *    one to demonstrate.
 * 3. **A code that means something structurally.** SCB's municipality code
 *    begins with its county's two digits, so the twelve codes starting `18`
 *    are Örebro county. The rule lists them rather than testing the prefix —
 *    see below.
 *
 * ## Why the rule lists twelve codes instead of testing the prefix
 *
 * Because there is no prefix operator, and inventing one for an example would
 * be a feature born of a demo rather than of a need. Listing them is also
 * honest about what an author actually does today, and it reads as data rather
 * than as cleverness: somebody adjusting the guide for their own county edits a
 * list of codes, which is a thing anybody can do.
 *
 * If the day comes that several guides want *begins with*, the argument for it
 * will be made by those guides and not by this file.
 *
 * ## Why Örebro county
 *
 * It needed to be somewhere, and a real county with real neighbours makes the
 * "not us" branch meaningful — Örebro's list has twelve municipalities and
 * borders four other counties, so both branches are one search away. Nothing
 * about the example is Örebro-specific beyond the codes.
 *
 * ## Why it does not decide anything
 *
 * Same reason as the citizenship guide: an example guide has no business
 * pretending to be a decision. Both outcomes say where the errand goes, not
 * what somebody is entitled to.
 */
export const municipalityExampleGraph: GraphData = {
  startNodeId: "kommun",
  settings: { sourceLocale: "sv" },
  nodes: [
    {
      id: "kommun",
      type: "autocomplete-question",
      position: { x: 0, y: 200 },
      data: {
        title: {
          sv: "Vilken kommun gäller ditt ärende?",
          en: "Which municipality does your errand concern?",
        },
        description: {
          sv: "Börja skriva kommunens namn. Listan är SCB:s, med alla 290 kommuner.",
          en: "Start typing the municipality's name. The list is SCB's, with all 290 municipalities.",
        },
        placeholder: { sv: "T.ex. Kumla", en: "For example Kumla" },
        /*
         * Ett svar med delar, precis som landet i medborgarskapsexemplet:
         * `kommun` bär namnet, `kommun.value` koden. Skillnaden är att det här
         * fältet tar EMOT ett svar, inte flera.
         */
        variableName: "kommun",
        variableLabel: { sv: "Kommun", en: "Municipality" },
        source: "codelist",
        codeListId: "scb-municipalities",
        // Av, för en kommun utan kod är inget att förgrena på.
        allowFreeText: false,
        required: true,
        minChars: 2,
      },
    },
    {
      id: "regel",
      type: "rule",
      position: { x: 520, y: 200 },
      data: {
        title: { sv: "Är kommunen i länet?", en: "Is the municipality in the county?" },
        fallbackLabel: "Annat län",
        cases: [
          {
            id: "orebro-lan",
            label: "Örebro län",
            match: "any",
            conditions: [
              /*
               * Länets tolv kommuner. Koderna börjar på `18` — SCB:s egen
               * ordning — men villkoret räknar upp dem i stället för att pröva
               * prefixet, för någon operator för det finns inte och en sådan
               * ska födas ur ett behov och inte ur ett exempel.
               */
              {
                id: "c-18",
                variableName: "kommun.value",
                operator: "one-of",
                value: "1814,1860,1861,1862,1863,1864,1880,1881,1882,1883,1884,1885",
              },
            ],
          },
        ],
      },
    },
    {
      id: "resultat-lanet",
      type: "result",
      position: { x: 1040, y: 60 },
      data: {
        title: { sv: "{{kommun.label}} tar emot ärendet", en: "{{kommun.label}} handles the errand" },
        description: {
          sv: "Kommunen ligger i Örebro län, så ärendet hanteras där. Kommunkoden är {{kommun.value}} — den följer med till ärendesystemet, medan namnet är det du läser.",
          en: "The municipality is in Örebro County, so the errand is handled there. The municipality code is {{kommun.value}} — that travels to the case system, while the name is what you read.",
        },
      },
    },
    {
      id: "resultat-annat",
      type: "result",
      position: { x: 1040, y: 540 },
      data: {
        title: { sv: "Vänd dig till {{kommun.label}}", en: "Contact {{kommun.label}}" },
        description: {
          sv: "{{kommun.label}} ligger utanför Örebro län, så ärendet hör hemma hos den kommunen. Koden {{kommun.value}} säger vilken det är, oavsett vilket språk guiden läses på.",
          en: "{{kommun.label}} lies outside Örebro County, so the errand belongs with that municipality. The code {{kommun.value}} says which one, whatever language the guide is read in.",
        },
      },
    },
  ],
  connections: [
    { id: "c1", from: { nodeId: "kommun", portId: "continue" }, to: { nodeId: "regel", portId: "input" } },
    { id: "c2", from: { nodeId: "regel", portId: "orebro-lan" }, to: { nodeId: "resultat-lanet", portId: "input" } },
    { id: "c3", from: { nodeId: "regel", portId: "default" }, to: { nodeId: "resultat-annat", portId: "input" } },
  ],
} as unknown as GraphData;

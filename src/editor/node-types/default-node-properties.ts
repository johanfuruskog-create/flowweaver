/*
 * The editor's forms for the built-in node types: what the properties panel
 * asks for, field by field — label, help text, control, choices, section,
 * gate. The fields themselves (id, default, formatting) are declared with the
 * types in `viewer/node-types/default-node-types.ts`; this file attaches the
 * forms to them by id through `describeNodeProperties`, which throws on an id
 * the type never declared.
 *
 * Why two files: the forms are 42 kB of Swedish labels and help texts that a
 * visitor never sees, and they travelled with every visitor page while the
 * declaration was one object (LOGG 8/9 2026). Keep the order of the entries
 * the same as the fields' — the panel draws them in this order.
 *
 * The test beside this file checks the other direction of the join: every
 * declared field of every built-in type has a form here, and every form has a
 * label and a control.
 *
 * The forms for sending in — submit-result and email-result — are not here:
 * they are the full version's and live in `submission-node-properties.ts`
 * (open-core step 3c, 2026-10-06), registered the same way.
 */
import { describeNodeProperties } from "../../viewer/node-types/node-type-registry";
import { resolveText } from "../../viewer/core/localized-text";
import { listFormats } from "../../viewer/core/format-registry";
import { autocompleteFor } from "../../viewer/core/format-validators";
import { AUTOFILL_TOKENS, type AutofillToken } from "../../viewer/core/autofill";
/*
 * No code list is registered here on purpose.
 *
 * The country list costs 3,4 kB gzip and every resident downloads the viewer,
 * in every guide, whether or not it asks about countries. That is affordable for
 * one list and it is the wrong default: municipality codes are 290 entries, SNI
 * codes some eight hundred, and a bundle that grows with every list anybody
 * might want is a bundle nobody can defend.
 *
 * So a list is something you add. `registerCodeList` takes plain data, the
 * lists ship as JSON beside the bundles, and a host registers the ones they use.
 * See `viewer/code-lists/code-list-registry.ts`.
 */
import { getCodeLists } from "../../viewer/code-lists/code-list-registry";

/*
 * "Varför frågar vi det här?" (story 051) — the editor's half of WHY_FIELD.
 * Lokaliserad som beskrivningen, så översättningsläget når den.
 */
const WHY_PROPERTY = {
  id: "why",
  localized: true,
  label: "Varför frågar vi det här?",
  description: "Frivillig förklaring som besökaren kan fälla ut vid frågan — varför uppgiften behövs och vad den används till.",
  control: "textarea",
} as const;

/*
 * The editor's words for the browser's (story 110).
 *
 * Keyed by the token so the list itself stays in one place — the viewer's,
 * which is what actually reaches a field — and a word added there shows up in
 * the form as a missing key rather than as a silent absence.
 *
 * *Ort* and not *address-level2*: nobody configuring a guide should have to
 * know what HTML calls a town.
 */
const AUTOFILL_LABELS: Record<AutofillToken, string> = {
  name: "Namn",
  "given-name": "Förnamn",
  "family-name": "Efternamn",
  "street-address": "Gatuadress",
  "address-level2": "Ort",
  "country-name": "Land",
  organization: "Organisation",
};

describeNodeProperties("question", [
  {
    id: "title",
    localized: true,
    label: "Rubrik",
    control: "text",
    display: {
      tag: "h2",
      className: "flow-node__title",
    }
  },
  { id: "variableName", section: "advanced", requiredCapability: "variables", label: "Spara svaret som", description: "T.ex. myndig", control: "text" },
  {
    id: "variableLabel",
    section: "advanced",
    requiredCapability: "variables",
    // Translatable like the title (story 080): a resident reads it in
    // the result text, and the panel must not write a string over a map.
    localized: true,
    label: "Variabeletikett",
    description: "Ordet som visas i regler, villkor och resultattext. Tomt: frågans rubrik används.",
    control: "text"
  },
  {
    id: "description",
    localized: true,
    label: "Beskrivning",
    control: "formatted-textarea",
    display: {
      tag: "p",
      className: "flow-node__description",
    }
  },
  WHY_PROPERTY,
  { id: "options", group: "answers", label: "Svarsalternativ", control: "options" },
  {
    id: "presentation", group: "answers",
    label: "Visas som",
    control: "select",
    options: [
      { label: "Radioknappar", value: "radio" },
      { label: "Rullgardin", value: "select" },
      /*
       * För frågor med många alternativ. Radioknappar visar allt på en gång,
       * vilket är rätt vid fem och obrukbart vid femtio — en spalt man
       * skrollar förbi, där man tappat bort vad som stod överst innan man
       * nått botten. Rullgardinen löser platsen men inte letandet: en
       * `<select>` har ingen sökning värd namnet, och på en telefon blir den
       * en hjullista genom alla alternativ.
       *
       * Samma kontroll som flervalslistan och regelvillkorets värde
       * (`chip-picker`), med ett attribut som skillnad.
       */
      { label: "Sökbar lista", value: "search" },
    ]
  },
  {
    id: "uniqueAcrossRepeats", group: "answers",
    label: "Varje upprepning ska välja olika",
    description: "Alternativ som valts i en upprepning döljs i de andra.",
    control: "checkbox",
    repeatingPageOnly: true,
  },
  { id: "cssClasses", section: "advanced", label: "CSS-klasser", description: "En eller flera, mellanslagsseparerade.", control: "text" },
]);

describeNodeProperties("multi-choice", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "variableName", section: "advanced", requiredCapability: "variables", label: "Spara svaret som", description: "T.ex. intressen", control: "text" },
  { id: "variableLabel", section: "advanced", requiredCapability: "variables", localized: true, label: "Variabeletikett", description: "Ordet som visas i regler, villkor och resultattext. Tomt: frågans rubrik används.", control: "text" },
  { id: "description", localized: true, label: "Beskrivning", control: "formatted-textarea", display: { tag: "p", className: "flow-node__description" } },
  WHY_PROPERTY,
  { id: "options", group: "answers", label: "Svarsalternativ", control: "options" },
  {
    id: "presentation", group: "answers",
    label: "Visas som",
    control: "select",
    options: [
    { label: "Kryssrutor", value: "checkbox" },
    { label: "Flervalslista", value: "multiselect" },
    ]
  },
  { id: "required", section: "validation", requiredCapability: "fieldValidation", label: "Måste välja minst ett", control: "checkbox" },
  // With no declared value: no limit is an absence, not a zero.
  { id: "minSelected", section: "validation", requiredCapability: "fieldValidation", label: "Minsta antal val", control: "number" },
  { id: "maxSelected", section: "validation", requiredCapability: "fieldValidation", label: "Högsta antal val", control: "number" },
  { id: "cssClasses", section: "advanced", label: "CSS-klasser", description: "En eller flera, mellanslagsseparerade.", control: "text" },
]);

describeNodeProperties("number-question", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "variableName", section: "advanced", requiredCapability: "variables", label: "Spara svaret som", description: "T.ex. age", control: "text" },
  { id: "variableLabel", section: "advanced", requiredCapability: "variables", localized: true, label: "Variabeletikett", description: "Ordet som visas i regler, villkor och resultattext. Tomt: frågans rubrik används.", control: "text" },
  { id: "description", localized: true, label: "Beskrivning", control: "formatted-textarea", display: { tag: "p", className: "flow-node__description" } },
  WHY_PROPERTY,
  /*
   * Text and multiple-choice both had `required`; a number did not, so an
   * amount could not be demanded. A hole in the validation rather than a
   * decision.
   *
   * Under `fieldValidation` and not `numericConstraints`, which is what min
   * and max sit under: a minimum refuses a *value*, required refuses the
   * absence of one, and an installation that offers validation should get
   * both.
   */
  { id: "required", section: "validation", requiredCapability: "fieldValidation", label: "Obligatoriskt fält", control: "checkbox" },
  /*
   * *Touched*, not merely *filled in* (story 118, criterion 7).
   *
   * Beside *Obligatoriskt* and shown only while it is on: a field nobody has
   * to answer cannot be one they have to touch, and a checkbox that means
   * nothing where it stands is one people learn to ignore.
   *
   * The words say that the guide ASKS, because that is what it does since
   * Johan settled it 15/9: wanting exactly the value on screen is a real
   * answer, so the question is a question and not a refusal. *Obligatoriskt* is about the value being
   * there; this one is about somebody having chosen it.
   */
  { id: "requireInteraction", section: "validation", requiredCapability: "fieldValidation", label: "Fråga om fältet inte rörts", description: "Ett startvärde eller ett reglage räknas annars som svar redan vid ankomst. Har besökaren inte ändrat fältet frågar guiden om hen vill gå vidare ändå.", control: "checkbox", showWhen: { property: "required", equals: true } },
  { id: "min", section: "validation", requiredCapability: "numericConstraints", label: "Minsta värde", control: "number" },
  { id: "max", section: "validation", requiredCapability: "numericConstraints", label: "Högsta värde", control: "number" },
  { id: "step", group: "field", requiredCapability: "numericConstraints", label: "Steg", control: "number" },
  { id: "unit", group: "field", localized: true, label: "Enhet", description: "Till exempel år eller kronor.", control: "text" },
  /*
   * The number the visitor meets in the field (story 118).
   *
   * Not in the validation section, and deliberately not beside *Minsta värde*:
   * a minimum refuses an answer, this one offers a starting point. The words
   * say what the visitor SEES, because the mistake to prevent is reading it as
   * a hidden default that is submitted without anybody looking at it.
   */
  { id: "startValue", group: "field", label: "Startvärde", description: "Talet står i fältet när besökaren kommer fram, och går att ändra. Tomt: fältet är tomt.", control: "number" },
  /*
   * Story 095: the slider and the − / + buttons are ways of showing the same
   * number question, never a type of their own ("Ja number fältet"). The
   * field always stays — keyboard, screen reader, exact value; the slider is
   * the thumb's shortcut. Both follow `step`, so a slider over 10 000–800 000
   * with the default step of 1 is a health warning, not a choice.
   */
  {
    id: "presentation", group: "field",
    label: "Visas som",
    control: "select",
    options: [
    { label: "Fält", value: "field" },
    { label: "Fält med reglage", value: "range" },
    { label: "Fält med stegknappar", value: "stepper" },
    ]
  },
]);

describeNodeProperties("text-question", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "variableName", section: "advanced", requiredCapability: "variables", label: "Spara svaret som", description: "T.ex. fornamn", control: "text" },
  { id: "variableLabel", section: "advanced", requiredCapability: "variables", localized: true, label: "Variabeletikett", description: "Ordet som visas i regler, villkor och resultattext. Tomt: frågans rubrik används.", control: "text" },
  { id: "description", localized: true, label: "Beskrivning", control: "formatted-textarea", display: { tag: "p", className: "flow-node__description" } },
  WHY_PROPERTY,
  { id: "placeholder", group: "field", localized: true, label: "Platshållare", control: "text" },
  {
    id: "presentation", group: "field",
    label: "Visas som",
    control: "select",
    options: [
    { label: "Textfält", value: "input" },
    { label: "Textområde", value: "textarea" },
    ]
  },
  /*
   * What the field holds, in the browser's own words (story 110).
   *
   * Editor-facing words, not the attribute's: nobody has to know that
   * `address-level2` is what HTML calls a town. The list is the browser's and
   * short on purpose — the seven a guide asks for — because a word outside it
   * is ignored by every browser without a sound, and the field would look
   * configured while offering nothing.
   *
   * Not in the validation section: it says what the field IS, not what an
   * answer must be. And gated on the format rather than listed beside it — a
   * format that carries a word of its own has already answered this, and which
   * formats those are is the registry's answer, not a list written here.
   */
  {
    id: "autofill", group: "field",
    label: "Vad fältet är",
    control: "select",
    showWhen: { property: "format", holds: (format) => autocompleteFor(typeof format === "string" ? format : undefined) === undefined },
    options: [
      { label: "Inget", value: "" },
      ...AUTOFILL_TOKENS.map((token) => ({ label: AUTOFILL_LABELS[token], value: token })),
    ],
  },
  { id: "required", section: "validation", requiredCapability: "fieldValidation", label: "Obligatoriskt fält", control: "checkbox" },
  { id: "minLength", section: "validation", requiredCapability: "fieldValidation", label: "Minsta textlängd", control: "number" },
  { id: "maxLength", section: "validation", requiredCapability: "fieldValidation", label: "Högsta textlängd", control: "number" },
  /*
   * A written shape, for an identifier we have no arithmetic for.
   *
   * `#` takes a digit, `A` a letter, everything else is a separator put in as
   * you type: `###-##-####` is an American social security number,
   * `AA ## ## ## A` a British national insurance number. The three Swedish
   * formats carry their own shape already, so this is for the ones that do
   * not — a pattern instead of a line of code per country.
   *
   * It says how a value is written and nothing about whether it is real; pair
   * it with `pattern` when possibility matters, and use a named format when we
   * also know how to verify it.
   */
  { id: "mask", section: "validation", requiredCapability: "fieldValidation", label: "Skrivform", description: "T.ex. ###-##-####. # är en siffra, A en bokstav.", control: "text" },
  /*
   * The list comes from the registry, so a format a host adds is one a
   * redaktör can pick. Written out here it was the fifth place a format lived
   * — and the one that decided whether the other four were reachable at all.
   *
   * "Ingen" and the free regex are not formats and stay literal: the first is
   * the absence of one, the second is the author supplying the rule instead.
   */
  {
    id: "format",
    section: "validation",
    requiredCapability: "fieldValidation",
    label: "Format",
    control: "select",
    /*
     * A function, so the list is what the registry holds **now**.
     *
     * This file registers its node types when it is imported, so a plain array
     * would be built once and a pack imported afterwards would never appear in
     * the select — import order as a hidden requirement, which is the sort of
     * thing that is discovered a year later by somebody whose format silently
     * does not exist.
     */
    options: () => [
      { label: "Ingen", value: "" },
      ...listFormats().map(({ name, label }) => ({ label, value: name })),
      { label: "Eget mönster (regex)", value: "regex" },
    ]
  },
  /*
   * Last in the section, and said so where it is chosen.
   *
   * A named format carries its own message — "Ange ett giltigt personnummer".
   * A pattern can only report that the value has the wrong shape, which tells
   * somebody their answer is refused and nothing about why. That is the whole
   * difference, and it is the reason this is the last resort rather than the
   * general tool.
   */
  { id: "pattern", section: "validation", requiredCapability: "fieldValidation", label: "Mönster (regex)", description: "Sista utvägen. Ett mönster kan bara säga att värdet har fel format, aldrig vad som var fel — välj ett namngivet format om det finns.", control: "text" },
  { id: "uniqueAcrossRepeats", section: "validation", label: "Varje upprepning ska välja olika", description: "Samma svar får inte anges i flera upprepningar.", control: "checkbox", repeatingPageOnly: true },
  { id: "cssClasses", section: "advanced", label: "CSS-klasser", description: "En eller flera, mellanslagsseparerade.", control: "text" },
]);

describeNodeProperties("consent-question", [
  // Formatted, and with links: a consent almost always points at something —
  // terms, a privacy notice — and that link is the reason it is a consent.
  { id: "title", localized: true, label: "Text vid kryssrutan", control: "formatted-textarea", display: { tag: "h2", className: "flow-node__title" } },
  { id: "variableName", section: "advanced", requiredCapability: "variables", label: "Spara svaret som", description: "T.ex. samtycke. Sparas som true eller tomt.", control: "text" },
  { id: "variableLabel", section: "advanced", requiredCapability: "variables", localized: true, label: "Variabeletikett", description: "Ordet som visas i regler, villkor och resultattext. Tomt: frågans rubrik används.", control: "text" },
  { id: "description", localized: true, label: "Beskrivning", control: "formatted-textarea", display: { tag: "p", className: "flow-node__description" } },
  WHY_PROPERTY,
  { id: "required", section: "validation", requiredCapability: "fieldValidation", label: "M\u00e5ste kryssas i", control: "checkbox" },
  { id: "cssClasses", section: "advanced", label: "CSS-klasser", description: "En eller flera, mellanslagsseparerade.", control: "text" },
]);

describeNodeProperties("multi-autocomplete-question", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "variableName", section: "advanced", requiredCapability: "variables", label: "Spara svaren som", description: "B\u00e4r etiketterna, en per rad.", control: "text" },
  { id: "variableLabel", section: "advanced", requiredCapability: "variables", localized: true, label: "Variabeletikett", description: "Ordet som visas i regler, villkor och resultattext. Tomt: frågans rubrik används.", control: "text" },
  { id: "description", localized: true, label: "Beskrivning", control: "formatted-textarea", display: { tag: "p", className: "flow-node__description" } },
  WHY_PROPERTY,
  { id: "placeholder", group: "field", localized: true, label: "Platsh\u00e5llare", control: "text" },
  {
    id: "source", group: "field",
    label: "K\u00e4lla",
    control: "select",
    options: [
    { label: "Egen lista (mockdata)", value: "mock" },
    { label: "Inbyggd kodlista", value: "codelist" },
    { label: "Tj\u00e4nst via BFF", value: "service" },
    ]
  },
  {
    id: "codeListId", group: "field",
    label: "Kodlista",
    description: "Listorna en v\u00e4rd registrerat.",
    control: "select",
    options: () => [
      { label: "\u2014", value: "" },
      ...getCodeLists().map((list) => ({
        label: `${resolveText(list.label, "sv", list.id)} (${list.standard})`,
        value: list.id,
      })),
    ],
  },
  { id: "endpoint", group: "field", label: "Endpoint", description: "Anropet sker i BFF:en, aldrig i klienten.", control: "text" },
  { id: "mockItems", group: "field", label: "Egen lista", description: "V\u00e4rdet \u00e4r koden, etiketten \u00e4r det anv\u00e4ndaren ser.", control: "options" },
  { id: "minChars", group: "field", label: "Minsta antal tecken", description: "0 visar hela listan n\u00e4r f\u00e4ltet f\u00e5r fokus.", control: "number" },
  { id: "required", section: "validation", requiredCapability: "fieldValidation", label: "Obligatoriskt f\u00e4lt", control: "checkbox" },
  { id: "minSelected", section: "validation", requiredCapability: "fieldValidation", label: "V\u00e4lj minst", control: "number" },
  { id: "maxSelected", section: "validation", requiredCapability: "fieldValidation", label: "V\u00e4lj h\u00f6gst", control: "number" },
  { id: "cssClasses", section: "advanced", label: "CSS-klasser", description: "En eller flera, mellanslagsseparerade.", control: "text" },
]);

describeNodeProperties("file-question", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "variableName", section: "advanced", requiredCapability: "variables", label: "Spara filnamnet som", description: "Det l\u00e4sbara namnet, t.ex. ritning.pdf.", control: "text" },
  { id: "variableLabel", section: "advanced", requiredCapability: "variables", localized: true, label: "Variabeletikett", description: "Ordet som visas i regler, villkor och resultattext. Tomt: frågans rubrik används.", control: "text" },
  { id: "description", localized: true, label: "Beskrivning", control: "formatted-textarea", display: { tag: "p", className: "flow-node__description" } },
  WHY_PROPERTY,
  { id: "required", section: "validation", requiredCapability: "fieldValidation", label: "M\u00e5ste bifogas", control: "checkbox" },
  { id: "accept", section: "validation", requiredCapability: "fieldValidation", label: "Till\u00e5tna filtyper", description: "T.ex. .pdf,.jpg. Tomt till\u00e5ter alla.", control: "text" },
  { id: "maxSize", section: "validation", requiredCapability: "fieldValidation", label: "St\u00f6rsta storlek (MB)", description: "0 betyder ingen gr\u00e4ns h\u00e4r. V\u00e4rdsystemet har sin egen.", control: "number" },
  /*
   * Story 047: skadeanmälans gest — invånaren pekar ut skadan i sitt eget
   * foto. Prickarna lagras som procentkoordinater i {variabel}Markeringar,
   * bredvid filen; originalbilden röks aldrig.
   */
  { id: "allowMarking", group: "field", label: "Låt invånaren markera i bilden", control: "checkbox" },
  /*
   * Story 108: exempelfotot. Adressen är värdens — biblioteket lagrar inget och
   * hämtar det först när någon trycker på knappen. Alt-texten står bredvid och
   * är översättbar: den läses upp för den som inte ser fotot, på guidens språk.
   */
  { id: "exampleImage", group: "field", label: "Exempelfoto (adress)", description: "T.ex. /exempel/testbil.jpg. Tomt: inget exempelfoto.", control: "text" },
  { id: "exampleImageAlt", group: "field", localized: true, label: "Exempelfotots alt-text", description: "Vad fotot visar. Krävs när det finns ett exempelfoto.", control: "text" },
  { id: "cssClasses", section: "advanced", label: "CSS-klasser", description: "En eller flera, mellanslagsseparerade.", control: "text" },
]);

describeNodeProperties("date-question", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "variableName", section: "advanced", requiredCapability: "variables", label: "Spara svaret som", description: "T.ex. startdatum", control: "text" },
  { id: "variableLabel", section: "advanced", requiredCapability: "variables", localized: true, label: "Variabeletikett", description: "Ordet som visas i regler, villkor och resultattext. Tomt: frågans rubrik används.", control: "text" },
  { id: "description", localized: true, label: "Beskrivning", control: "formatted-textarea", display: { tag: "p", className: "flow-node__description" } },
  WHY_PROPERTY,
  { id: "required", section: "validation", requiredCapability: "fieldValidation", label: "Obligatoriskt fält", control: "checkbox" },
  /*
   * *Touched*, not merely *filled in* (story 118, criterion 7).
   *
   * Beside *Obligatoriskt* and shown only while it is on: a field nobody has
   * to answer cannot be one they have to touch, and a checkbox that means
   * nothing where it stands is one people learn to ignore.
   *
   * The words say that the guide ASKS, because that is what it does since
   * Johan settled it 15/9: wanting exactly the value on screen is a real
   * answer, so the question is a question and not a refusal. *Obligatoriskt* is about the value being
   * there; this one is about somebody having chosen it.
   */
  { id: "requireInteraction", section: "validation", requiredCapability: "fieldValidation", label: "Fråga om fältet inte rörts", description: "Ett startvärde eller ett reglage räknas annars som svar redan vid ankomst. Har besökaren inte ändrat fältet frågar guiden om hen vill gå vidare ändå.", control: "checkbox", showWhen: { property: "required", equals: true } },
  // The date the visitor meets in the field (story 118), written exactly like
  // the bounds below and with the same variable button — Johan 15/9, asked
  // whether a start value may point at a field: "Fast vi har det på andra
  // ställen. Måste vara lika."
  //
  // Outside the validation section all the same: a bound refuses an answer,
  // this one offers a starting point.
  { id: "startValue", group: "field", label: "Startvärde", description: "ÅÅÅÅ-MM-DD, idag, eller en variabel med ett datum. Datumet står i fältet när besökaren kommer fram, och går att ändra. Tomt: fältet är tomt.", control: "text" },
  // Text and not a date control in the editor: the value is an ISO string, and
  // an empty one means "no bound" — which a date input cannot express.
  // "idag" is resolved the day the question is asked (story 044) \u2014 the word
  // is stored, never the date the guide happened to be saved.
  // A variable — `{{från}}` — is the other field's answer (story 087): a
  // period has no fixed lower bound. The variable button writes the braces,
  // the same ones a heading uses.
  { id: "min", section: "validation", requiredCapability: "fieldValidation", label: "Tidigast", description: "\u00c5\u00c5\u00c5\u00c5-MM-DD, idag, eller en variabel med ett datum. Tomt betyder ingen gr\u00e4ns.", control: "text" },
  { id: "max", section: "validation", requiredCapability: "fieldValidation", label: "Senast", description: "\u00c5\u00c5\u00c5\u00c5-MM-DD, idag, eller en variabel med ett datum. Tomt betyder ingen gr\u00e4ns.", control: "text" },
  { id: "cssClasses", section: "advanced", label: "CSS-klasser", description: "En eller flera, mellanslagsseparerade.", control: "text" },
]);

describeNodeProperties("rating-question", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "variableName", section: "advanced", requiredCapability: "variables", label: "Spara svaret som", description: "T.ex. trivsel — svaret blir stegets nummer.", control: "text" },
  { id: "variableLabel", section: "advanced", requiredCapability: "variables", localized: true, label: "Variabeletikett", description: "Ordet som visas i regler, villkor och resultattext. Tomt: frågans rubrik används.", control: "text" },
  { id: "description", localized: true, label: "Beskrivning", control: "formatted-textarea", display: { tag: "p", className: "flow-node__description" } },
  WHY_PROPERTY,
  {
    id: "steps", group: "answers",
    label: "Antal steg",
    description: "Mellan 2 och 11. Första steget är värt 1, det sista värt antalet.",
    control: "number",
  },
  /*
   * The words, one per step, in a list of their own — never a value box
   * beside each. The scale's numbers ARE the values (Johan 13/9), so a box
   * asking for one would offer a decision that has been made.
   */
  /*
   * The direction, and the row is the default: the field exists so twenty
   * questions can be answered without scrolling through each one. Standing it
   * on its end is for the question whose words are too long to share a line,
   * and only the editor looking at the whole question can tell.
   */
  {
    id: "layout", group: "answers",
    label: "Riktning",
    description: "På en rad tar minst plats och är standard. På höjden ger långa ord en egen rad var.",
    control: "select",
    options: [
      { label: "På en rad", value: "row" },
      { label: "På höjden", value: "column" },
    ],
  },
  {
    id: "labels", group: "answers",
    label: "Ord per steg",
    description: "Frivilligt. Ett steg utan ord visar sitt nummer — så blir ett betyg 1–10 en siffra i rutan ovanför i stället för tio rader.",
    control: "rating-labels",
  },
  /*
   * Two ways out, both off by default and both visible when they are on. The
   * survey this story came from hid them behind a "…", which is a way out for
   * everybody except the person who needs it.
   *
   * Two and not one (Johan 13/9): *Inte aktuellt* says the question does not
   * apply, *Vet ej* that the person has no answer. Offered only the first,
   * everybody who has not thought about it says the question does not apply —
   * which is a different answer, and the wrong one. Either way the variable is
   * left EMPTY with the words beside it, never a nought: the formula language
   * has no condition, so a nought would be counted and every average would sag.
   */
  { id: "notApplicable", group: "answers", label: "Erbjud Inte aktuellt", description: "Ett eget val under raden, för att frågan inte gäller den som svarar. Svaret blir tomt och räknas inte med i ett medel.", control: "checkbox" },
  { id: "notApplicableLabel", group: "answers", localized: true, label: "Text för Inte aktuellt", description: "Tomt: besökaren får ordet i sitt eget språk.", control: "text", showWhen: { property: "notApplicable", equals: true } },
  { id: "dontKnow", group: "answers", label: "Erbjud Vet ej", description: "Ett eget val under raden, för den som inte har någon uppfattning. Svaret blir tomt och räknas inte med i ett medel.", control: "checkbox" },
  { id: "dontKnowLabel", group: "answers", localized: true, label: "Text för Vet ej", description: "Tomt: besökaren får ordet i sitt eget språk.", control: "text", showWhen: { property: "dontKnow", equals: true } },
  { id: "required", section: "validation", requiredCapability: "fieldValidation", label: "Obligatoriskt fält", control: "checkbox" },
  { id: "cssClasses", section: "advanced", label: "CSS-klasser", description: "En eller flera, mellanslagsseparerade.", control: "text" },
]);

describeNodeProperties("map-question", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "variableName", section: "advanced", requiredCapability: "variables", label: "Spara svaret som", description: "T.ex. plats — geometrin lagras som platsGeo", control: "text" },
  { id: "variableLabel", section: "advanced", requiredCapability: "variables", localized: true, label: "Variabeletikett", description: "Ordet som visas i regler, villkor och resultattext. Tomt: frågans rubrik används.", control: "text" },
  { id: "description", localized: true, label: "Beskrivning", control: "formatted-textarea", display: { tag: "p", className: "flow-node__description" } },
  WHY_PROPERTY,
  // Sorten styr vad leverantören ombeds om och hur golvet ser ut. En sort
  // värdens karta inte klarar visar bara golvet — väldefinierat, inte fel.
  {
    id: "kind", group: "field",
    label: "Sort",
    control: "select",
    options: [
    { label: "Punkt", value: "point" },
    { label: "Flera punkter", value: "points" },
    { label: "Område", value: "area" },
    ]
  },
  /*
   * Var kartan öppnar — redaktörens kunskap, inte karttjänstens. Väljs
   * genom samma leverantörsdialog som invånaren ser, lagras som GeoJSON
   * med etikett, och skickas som en frivillig ledtråd (near) leverantören
   * får följa. Tom = värdens karta öppnar där den själv vill.
   */
  { id: "startView", group: "field", label: "Startvy", control: "map-start" },
  { id: "required", section: "validation", requiredCapability: "fieldValidation", label: "Obligatoriskt fält", control: "checkbox" },
  { id: "cssClasses", section: "advanced", label: "CSS-klasser", description: "En eller flera, mellanslagsseparerade.", control: "text" },
]);

describeNodeProperties("autocomplete-question", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "variableName", section: "advanced", requiredCapability: "variables", label: "Spara svaret som", description: "Bär etiketten, t.ex. Örebro.", control: "text" },
  // The code is stored separately and under a name of its own rather than a
  // hidden key. The variable carries what the user sees; this carries what an
  // integration needs, and whoever does not need the code leaves it empty.
  { id: "variableLabel", section: "advanced", requiredCapability: "variables", localized: true, label: "Variabeletikett", description: "Ordet som visas i regler, villkor och resultattext. Tomt: frågans rubrik används.", control: "text" },
  { id: "description", localized: true, label: "Beskrivning", control: "formatted-textarea", display: { tag: "p", className: "flow-node__description" } },
  WHY_PROPERTY,
  { id: "placeholder", group: "field", localized: true, label: "Platshållare", control: "text" },
  {
    id: "source", group: "field",
    label: "Källa",
    control: "select",
    options: [
    { label: "Egen lista (mockdata)", value: "mock" },
    { label: "Inbyggd kodlista", value: "codelist" },
    { label: "Tjänst via BFF", value: "service" },
    ]
  },
  // Which bundled list. Empty gives an empty field rather than another list's
  // answers — a fault somebody sees while building, not one a resident meets.
  {
    id: "codeListId", group: "field",
    label: "Kodlista",
    description: "Listorna en värd registrerat. Koden som sparas följer listans standard.",
    control: "select",
    /*
     * Read from the registry rather than written here. Nothing is registered
     * by default, so a fixed list would offer lists that are not loaded — and
     * a field pointed at one of those finds nothing while looking perfectly
     * configured.
     */
    options: () => [
      { label: "—", value: "" },
      ...getCodeLists().map((list) => ({
        label: `${resolveText(list.label, "sv", list.id)} (${list.standard})`,
        value: list.id,
      })),
    ]
  },
  { id: "endpoint", group: "field", label: "Endpoint", description: "Anropet sker i BFF:en, aldrig i klienten. Se docs/UPPSLAG-KONTRAKT.md.", control: "text" },
  { id: "mockItems", group: "field", label: "Egen lista", description: "Värdet är koden, etiketten är det användaren ser.", control: "options" },
  { id: "minChars", group: "field", label: "Minsta antal tecken", description: "Innan ett uppslag görs.", control: "number" },
  // Free text off or on per field: municipality and country should yield a
  // valid code, while an address register may lack newly built addresses.
  { id: "allowFreeText", section: "validation", label: "Tillåt egna värden", description: "Av: svaret måste väljas ur listan.", control: "checkbox" },
  { id: "required", section: "validation", requiredCapability: "fieldValidation", label: "Obligatoriskt fält", control: "checkbox" },
  { id: "cssClasses", section: "advanced", label: "CSS-klasser", description: "En eller flera, mellanslagsseparerade.", control: "text" },
]);

describeNodeProperties("image", [
  { id: "imageUrl", label: "Bild-URL", description: "Länk till bilden (https://…).", control: "text" },
  { id: "caption", localized: true, label: "Bildtext", control: "text" },
  { id: "alt", localized: true, label: "Alternativtext", description: "Beskriver bilden för skärmläsare.", control: "text" },
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
]);

describeNodeProperties("annotated-image", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "imageUrl", label: "Bild-URL", description: "Länk till bilden (https://…).", control: "text" },
  { id: "alt", localized: true, label: "Alternativtext", description: "Beskriver bilden för skärmläsare.", control: "text" },
  // [{ id, text, x, y, arrow }] – x/y i procent av bilden, arrow riktning.
  { id: "comments", label: "Kommentarer", control: "annotations" },
]);

describeNodeProperties("code", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "language", label: "Språk (etikett)", description: "Visas ovanför koden, t.ex. json.", control: "text" },
  { id: "code", label: "Kod", control: "textarea" },
  { id: "caption", localized: true, label: "Bildtext", control: "text" },
]);

describeNodeProperties("page", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "description", localized: true, label: "Beskrivning", control: "formatted-textarea", display: { tag: "p", className: "flow-node__description" } },
  { id: "continueLabel", localized: true, label: "Fortsätt-knappens text", description: "Tomt = guidens standard.", control: "text" },
  /*
   * A page that repeats (story 084): the fields on it are the fields for ONE
   * child, and the visitor adds more. None of these keys has a default —
   * an older guide lacks them and the page does not repeat (AC 8). The word
   * is a label the viewer never inflects ("barn", "Barn 1", "Lägg till
   * barn"); the visitor's answers land as a list under `repeatVariable`,
   * with `<name>.count` beside it for rules outside the page.
   */
  { id: "repeats", group: "repeat", label: "Kan upprepas", control: "checkbox" },
  { id: "repeatWord", group: "repeat", localized: true, label: "Vad som upprepas", description: "Ett ord i ental, t.ex. barn. Blir Barn 1 och Lägg till barn.", control: "text", showWhen: { property: "repeats", equals: true } },
  { id: "repeatVariable", group: "repeat", label: "Listans variabelnamn", description: "Svaren blir en lista med det här namnet; antalet heter namn.count.", control: "text", showWhen: { property: "repeats", equals: true } },
  { id: "repeatMin", group: "repeat", label: "Minsta antal", description: "Tomt = 1.", control: "number", showWhen: { property: "repeats", equals: true } },
  { id: "repeatMax", group: "repeat", label: "Största antal", description: "Tomt = ingen gräns.", control: "number", showWhen: { property: "repeats", equals: true } },
  { id: "addLabel", group: "repeat", localized: true, label: "Lägg till-knappens text", description: "Tomt = Lägg till följt av ordet.", control: "text", showWhen: { property: "repeats", equals: true } },
]);

describeNodeProperties("page-heading", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h3", className: "flow-node__title" } },
  { id: "description", localized: true, label: "Beskrivning", control: "formatted-textarea", display: { tag: "p", className: "flow-node__description" } },
  /*
   * Story 096: the same text drawn as a box with a frame, an icon and the
   * kind as a word (K3). One node with a choice, not four node types —
   * the palette does not grow. `warning` is the kind's name in the JSON
   * while the visitor reads *Viktigt* (Johan: "Viktigt bättre än
   * varning"): the word lives in the viewer's strings, so a host can
   * change the word without changing the kind.
   */
  {
    id: "presentation",
    label: "Visas som",
    control: "select",
    options: [
    { label: "Text", value: "text" },
    { label: "Inforuta", value: "info" },
    { label: "Viktigt", value: "warning" },
    { label: "Tips", value: "tip" },
    ]
  },
]);

describeNodeProperties("page-spacer", []);

describeNodeProperties("annotation", [
  { id: "text", label: "Anteckning", control: "textarea", localized: true, display: { tag: "p", className: "flow-node__note-text" } },
  { id: "targetNodeId", label: "Peka på nod", control: "node-select" },
  {
    id: "arrow",
    label: "Pil pekar (utan målnod)",
    control: "select",
    options: [
      { label: "Uppåt", value: "up" },
      { label: "Nedåt", value: "down" },
      { label: "Vänster", value: "left" },
      { label: "Höger", value: "right" },
    ]
  },
]);

describeNodeProperties("review", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "description", localized: true, label: "Beskrivning", control: "formatted-textarea", display: { tag: "p", className: "flow-node__description" } },
  { id: "declarationNote", localized: true, label: "Egen rad i datadeklarationen", description: "Frivillig — t.ex. hur länge uppgifterna sparas. Standardtexten om vad som samlats in kommer alltid.", control: "textarea" },
]);

describeNodeProperties("result", [
  {
    id: "title",
    localized: true,
    label: "Rubrik",
    control: "text",
    display: {
      tag: "h2",
      className: "flow-node__title",
    }
  },
  {
    id: "description",
    localized: true,
    label: "Beskrivning",
    control: "formatted-textarea",
    display: {
      tag: "p",
      className: "flow-node__description",
    }
  },
]);

describeNodeProperties("rule", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "cases", group: "rules", label: "Regler", description: "Reglerna kontrolleras uppifrån. Den första regel vars villkor uppfylls används.", control: "rule-cases" },
  { id: "fallbackLabel", group: "rules", label: "Namn på utfallet Annars", description: "Används när ingen av reglerna ovan uppfylls.", control: "text" },
]);

describeNodeProperties("calculation", [
  {
    id: "title",
    // Like every question title: the canvas and the panel translate it.
    // Rule, calculation and service-call had never been marked, so the
    // panel showed an empty locked field in translation mode while the
    // canvas beside it displayed the translation. Found on a tablet.
    localized: true,
    label: "Rubrik",
    control: "text",
    display: { tag: "h2", className: "flow-node__title" }
  },
  {
    id: "assignments", group: "calculations",
    label: "Uträkningar",
    // The formula language is explained by the formula help in each row's
    // card (uppdrag 29/9 Del D), not by a description under the list.
    control: "calculation-assignments"
  },
]);

describeNodeProperties("service-call", [
  { id: "title", localized: true, label: "Rubrik", control: "text", display: { tag: "h2", className: "flow-node__title" } },
  { id: "endpoint", group: "request", label: "Endpoint", description: "Anropet sker i BFF:en, aldrig i klienten.", control: "text" },
  {
    id: "method", group: "request",
    label: "Metod",
    control: "select",
    options: [
      { label: "POST", value: "POST" },
      { label: "GET", value: "GET" },
    ]
  },
  { id: "requestVariables", group: "request", label: "Skicka med", description: "Vilka variabler som ingår i anropet.", control: "request-variables" },
  { id: "mockResponse", group: "response", label: "Exempelsvar (JSON)", description: "Används för att designa och förhandsgranska utan riktigt nätverk.", control: "textarea" },
  { id: "responseMappings", group: "response", label: "Lägg svaret i variabler", description: "Läs fält ur svaret (punktnotation för nästlade fält) och lägg i variabler.", control: "response-mappings" },
]);

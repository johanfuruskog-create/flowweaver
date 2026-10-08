import type { FlowNodeData, GraphData } from "../types/graph";
import { resolveText, type LocaleCode } from "../core/localized-text";
import { getCodeList } from "../code-lists/code-list-registry";
import { QuestionOptionsService } from "./question-options-service";
import { CalculationService } from "./calculation-service";
import { ServiceCallService } from "./service-call-service";
import { getNodeType } from "../node-types/node-type-registry";
import { TODAY_VARIABLE } from "../core/date-math";

/** The built-in day's label, in the languages the editor speaks. */
const TODAY_LABEL = { sv: "I dag", en: "Today" } as const;
import type { VariableType } from "../types/graph";

export interface QuestionVariableOption {
  label: string;
  value: string;
  type: VariableType;
  options: Array<{ label: string; value: string }>;
  /**
   * Frågans format, när den har ett: `email`, `personnummer`, `postnummer` …
   *
   * Typen säger hur värdet BEHANDLAS (text jämförs, tal räknas); formatet säger
   * vad det är. Ett fält som ber om besökarens e-post kan bara ta emot det
   * senare, och utan det här bar listan varenda variabel i guiden — mejlkopian
   * gick att peka på "Beskriv felet" utan att något sa emot (story 054).
   */
  format?: string;
  /**
   * True when the answer can hold SEVERAL values.
   *
   * The word in a rule follows this: *är någon av* on one answer, *innehåller
   * något av* on several. And `equals` is not offered here — in the engine it
   * means "the whole list, as text, is exactly this", deliberately strict but
   * as an offer a trap (Johan on the tablet, 2026-08-31, reading *land.value är
   * någon av XS* and asking whether it should not say *lika med*).
   *
   * Read from the node type's declared `behavior.answer.cardinality` and never
   * from the type's name, because the names do not follow the storage:
   * `multi-choice` stores a newline-separated **string** and the multi lookup
   * stores objects. One declaration, already read by the engine and the viewer;
   * a second list here would be a copy that drifts.
   */
  multiple?: true;
  /**
   * True when the engine sets this itself — no question, no field, nothing a
   * redaktör authored. `idag` is the only one today (story 086): it is
   * seeded straight into the list in `getOptions()`, never produced by a
   * node. The panel's *Infoga svar* menu groups these apart from answers a
   * question sets (Johan's iPad, 26/9), and the property is this flag, not
   * the name "idag" — the day a second built-in value exists it carries the
   * same flag and lands in the same group without anyone reading names.
   */
  computed?: true;
  /**
   * True when a calculation row produces it. A formula's *Infoga variabel*
   * menu lists these under *Uträkningar*, apart from the answers (Astras
   * bild 05, 29/9).
   */
  calculated?: true;
}

export class QuestionVariableService {
  /**
   * What a variable is called in prose: the alias (`variableLabel`) first,
   * the question's title after it, the bare name last. The rule editor, the
   * gaps in a card's text and the condition band all read the same rule —
   * a card that said the title where the rule said the alias would look like
   * two different variables (Johan 3/9, story 077).
   */
  static getLabel(node: FlowNodeData, locale?: LocaleCode): string {
    // The alias may be a plain string or localized text — the examples carry
    // both — so it is resolved like the title, not type-checked (measured 3/9:
    // a `{ sv, en }` alias was skipped and the whole question stood in).
    const variableLabel = resolveText(node.data.variableLabel, locale);
    const title = resolveText(node.data.title, locale);
    const variableName = node.data.variableName;

    if (variableLabel.trim().length > 0) {
      return variableLabel.trim();
    }

    if (title.trim().length > 0) {
      return title.trim();
    }

    return typeof variableName === "string" ? variableName.trim() : "";
  }

  /**
   * `getLabel` for a variable known only by name, looked up among the nodes.
   * The bare name when no node sets it — a message that says nothing is
   * worse than one that says the name the redaktör typed.
   */
  static labelOf(nodes: readonly FlowNodeData[], variableName: string, locale?: LocaleCode): string {
    const node = nodes.find((candidate) => candidate.data.variableName === variableName);
    return node ? this.getLabel(node, locale) : variableName;
  }

  /**
   * What a chooser calls a variable: the heading first, the technical name
   * after — `Medborgarskap — {{land.value}}`.
   *
   * The rule condition, the field visibility and the e-mail chooser each showed
   * the heading alone, while the variable list behind `{{var}}` showed both
   * halves. On the tablet 2026-08-31 that put *Medborgarskap (kod)* next to
   * *Medborgarskap* in the same rule, with nothing saying which name the rule
   * would actually test — and a lookup answer really does have both, on
   * purpose (see the reasoning further down this file).
   *
   * The list is where the form comes from, and it draws the two halves as two
   * elements. An `<option>` can only carry text, so this is that same form
   * written as one string. It holds no words, so there is nothing to localize.
   *
   * The chip on the canvas says the same, alias first, when the variable has
   * one (Johan 3/9: the alias always before the name); without an alias the
   * chip keeps the bare name, since the title stands right above it.
   */
  static getDisplayName(option: QuestionVariableOption): string {
    return `${resolveText(option.label)} — {{${option.value}}}`;
  }

  /**
   * Which of `names` no node declares — given answers (story 085) with no
   * field to land in. A name is declared through its parts too: a lookup
   * answers as `land.value`, never as `land`, and the host hands back `land`.
   */
  static undeclared(graph: GraphData, names: readonly string[]): string[] {
    const declared = this.getOptions(graph).map((option) => option.value);
    return names.filter(
      (name) => !declared.some((known) => known === name || known.startsWith(`${name}.`)),
    );
  }

  /**
   * The guide's variables, alias first. `locale` picks the language of the
   * labels (story 080) — a card draws its gaps in its own language, as it
   * draws its title. Without it the source language, which is what the
   * panel's choosers speak.
   */
  static getOptions(graph: GraphData, locale?: LocaleCode): QuestionVariableOption[] {
    const variableNames = new Set<string>([TODAY_VARIABLE]);

    /*
     * `idag` is the guide's day (story 086): the engine writes it beside the
     * answers, so a text, a rule and a formula read it as they read any
     * variable. It must stand here for the same reason a list's count does —
     * the pickers offer this list and the health check trusts it — and its
     * name is taken first, so no question can claim it. Last in the list:
     * the guide's own variables before the one it did not write.
     */
    const today: QuestionVariableOption = {
      label: TODAY_LABEL[locale === "en" ? "en" : "sv"],
      value: TODAY_VARIABLE,
      type: "text",
      options: [],
      computed: true,
    };

    /*
     * Which list a field sits in, for its sum (story 091): a number field on a
     * repeating page answers to `blankett.antal.sum` outside the page. Read
     * before the walk, because the page is not always visited before its fields.
     */
    const listOf = new Map(graph.nodes.flatMap((node) =>
      node.type === "page" && node.data.repeats === true && typeof node.data.repeatVariable === "string" && node.data.repeatVariable.trim()
        ? [[node.id, node.data.repeatVariable.trim()] as const]
        : []));

    return [...graph.nodes.flatMap((node): QuestionVariableOption[] => {
      if (node.type === "page") {
        /*
         * A repeating page (story 084) answers with a list under its own name,
         * and outside the page the guide reads the COUNT: `{{barn.count}}` in
         * a text, `barn.count > 2` in a rule. The list's name is taken so no
         * field can claim it, but it is not offered here — a list is not a
         * value a rule compares or a text prints, and the fields on the page
         * keep their own names for the conditions inside it (story 084, AC 4).
         * The health check reads this list: a name missing here is a false
         * error there.
         */
        const list = node.data.repeats === true && typeof node.data.repeatVariable === "string"
          ? node.data.repeatVariable.trim()
          : "";
        const count: QuestionVariableOption[] = [];

        if (list && !variableNames.has(list)) {
          variableNames.add(list);
          variableNames.add(`${list}.count`);
          count.push({
            label: `${this.getLabel(node, locale)} (antal)`,
            value: `${list}.count`,
            type: "number",
            options: [],
          });
        }

        return [...count, ...["first", "second"].flatMap((prefix) => {
          const rawName = node.data[`${prefix}VariableName`];
          const rawLabel = node.data[`${prefix}Label`];
          const value = typeof rawName === "string" ? rawName.trim() : "";
          if (!value || variableNames.has(value)) return [];
          variableNames.add(value);
          return [{
            label: typeof rawLabel === "string" && rawLabel.trim() ? rawLabel.trim() : value,
            value,
            type: "text" as const,
            options: [],
          }];
        })];
      }

      // Calculation and service nodes produce several variables, each row
      // with its own label (stories 078, 079) or its name.
      if (node.type === "calculation" || node.type === "service-call") {
        const produced =
          node.type === "calculation"
            ? CalculationService.getProducedEntries(node, locale)
            : ServiceCallService.getProducedEntries(node, locale);
        return produced.flatMap(({ name, label }) => {
          if (variableNames.has(name)) return [];
          variableNames.add(name);
          return [{ label, value: name, type: "number" as const, options: [], ...(node.type === "calculation" ? { calculated: true as const } : {}) }];
        });
      }

      const variableType = getNodeType(node.type)?.variableType;

      if (!variableType) {
        return [];
      }

      const variableName = node.data.variableName;

      if (
        typeof variableName !== "string" ||
        variableName.trim().length === 0 ||
        variableNames.has(variableName.trim())
      ) {
        return [];
      }

      const value = variableName.trim();
      variableNames.add(value);

      /*
       * Delarna ett svar har, som egna rader i listan.
       *
       * Ett uppslag svarar med etiketten en person läser och koden en regel
       * prövar. En kartfråga med namnet och geometrin. En bild med sina
       * markeringar. Fram till version 9 låg varje del i en variabel BREDVID
       * svaret — `landskod`, `platsGeo`, `fotoMarkeringar` — och de hölls i
       * takt av ordningen de skrevs i. Nu är de delar av ett värde, och ett
       * villkor namnger dem: `land.value`.
       *
       * De måste stå här, annars finns de inte för redaktören. Johan såg det
       * på en iPad: villkoret stod som **"land.value (saknas)"** och noden bar
       * en felmarkör, fast guiden förgrenar rätt. Hälsokontrollen läser den
       * här listan, så en del som saknas här blir ett falskt fel där.
       *
       * Samma lärdom står redan skriven i den här filens historia: sex falska
       * fel om kodvariabeln, tre om kartans geometri. En panel som larmar om
       * något som fungerar lär redaktören att panelen är brus.
       *
       * Typen är `text` genomgående: en kod jämförs, aldrig räknas.
       */
      /*
       * Flera svar? Nodtypen har redan sagt det, en gång, på det ställe motorn
       * och visaren läser. Delarna ärver det: `land.value` på ett flervärt
       * uppslag är koderna ur VARJE valt land.
       */
      const multiple = getNodeType(node.type)?.behavior?.answer.cardinality === "multi";

      const del = (
        suffix: string,
        namn: string,
        options: Array<{ label: string; value: string }> = [],
      ) => {
        const path = `${value}.${suffix}`;

        if (variableNames.has(path)) return [];

        variableNames.add(path);

        return [{
          label: `${this.getLabel(node, locale)} (${namn})`,
          value: path,
          type: "text" as const,
          options,
          ...(multiple ? { multiple: true as const } : {}),
        }];
      };

      /*
       * Kodlistans egna poster som valbara alternativ.
       *
       * Utan dem är villkorets värde ett tomt textfält där redaktören förväntas
       * skriva `SE,DK,FI,NO,IS` för hand — ingenting säger att kommatecknet är
       * separatorn, ingenting säger vilka koder som finns, och en felstavning
       * ger en gren som aldrig tar. Johan såg det på en iPad.
       *
       * Bara `source: "codelist"`. Ett uppslag mot en tjänst har inga kända
       * värden här — de bor bakom en BFF — och att låtsas annat vore värre än
       * ett textfält.
       */
      const kodlista =
        node.data.source === "codelist" && typeof node.data.codeListId === "string"
          ? getCodeList(node.data.codeListId)
          : null;
      const kodalternativ = (kodlista?.items ?? []).map((item) => ({
        label: resolveText(item.label),
        value: item.value,
      }));

      const codeEntries =
        node.type === "autocomplete-question" || node.type === "multi-autocomplete-question"
          ? del("value", "kod", kodalternativ)
          : [];

      const geoEntries = node.type === "map-question" ? del("geo", "geometri") : [];

      const markEntries =
        node.type === "file-question" && node.data.allowMarking === true
          ? del("markings", "markeringar")
          : [];

      const rawFormat = node.data.format;
      const format = typeof rawFormat === "string" && rawFormat.trim() ? rawFormat.trim() : undefined;

      /*
       * Har svaret delar säger helheten att den är NAMNET.
       *
       * Johan: *det finns två variabler, varför?* Därför att svaret har två —
       * namnet en människa läste och koden en regel prövar. Men det syntes
       * inte: den ena hette "Medborgarskap" och den andra "Medborgarskap
       * (kod)", så den första såg ut som en dubblett i stället för som halva
       * paret.
       *
       * Båda ska finnas. Namnet är det enda som är rätt i en mall —
       * `{{land}}` skriver "Danmark", inte `DK` — och koden det enda som är
       * rätt i en regel, för namnet är översatt och koden är det inte. De ska
       * bara gå att skilja åt utan att man redan vet vilket som är vilket.
       */
      const delar = [...geoEntries, ...markEntries, ...codeEntries];
      /*
       * Har svaret delar heter NAMNET också en del: `land.label`.
       *
       * Johans fråga — *kan vi inte få ut namnet från `land.label`?* — och det
       * är den bättre symmetrin. Förut stod den nakna `land` bredvid
       * `land.value` och såg ut som en andra variabel; nu är det ett svar med
       * två namngivna delar, och listan säger det själv.
       *
       * `{{land}}` i en gammal mall fortsätter fungera: helheten läses som sin
       * text, vilket ÄR namnen. Ingenting behöver skrivas om.
       *
       * Namnet bär ingen kvalificering: det är den självklara läsningen, och
       * koden är undantaget. "Medborgarskap" och "Medborgarskap (kod)" säger
       * vad de är med mindre text än två suffix hade gjort.
       */
      const harDelar = delar.length > 0;

      if (harDelar) variableNames.add(`${value}.label`);

      /*
       * A number field in a repeating page also answers with its sum outside
       * the page (story 091): `{{blankett.antal.sum}}` in the order email. It
       * must stand here for the same reason the count does — the health check
       * trusts this list. Only numbers: a text has nothing to add up.
       */
      const list = typeof node.parentPageId === "string" ? listOf.get(node.parentPageId) : undefined;
      const summa: QuestionVariableOption[] = [];

      if (list && variableType === "number" && !variableNames.has(`${list}.${value}.sum`)) {
        variableNames.add(`${list}.${value}.sum`);
        summa.push({
          label: `${this.getLabel(node, locale)} (summa)`,
          value: `${list}.${value}.sum`,
          type: "number",
          options: [],
        });
      }

      return [...delar, {
        label: this.getLabel(node, locale),
        value: harDelar ? `${value}.label` : value,
        type: variableType,
        ...(format ? { format } : {}),
        ...(multiple ? { multiple: true as const } : {}),
        options: variableType === "choice"
          ? QuestionOptionsService.getOptions(node).map((option) => ({
              label: resolveText(option.label),
              value: option.value,
            }))
          : [],
      }, ...summa];
    }), today];
  }
}

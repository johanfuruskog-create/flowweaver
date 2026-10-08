import { answerText, readPath, type Answers } from "../core/answer-values";
import { QuestionOptionsService } from "./question-options-service";
import { RatingScaleService } from "./rating-scale-service";
import { PageRepeatService } from "./page-repeat-service";
import { displayFormat } from "../core/format-validators";
import { getSourceLocale, resolveText } from "../core/localized-text";
import type { GraphData } from "../types/graph";

export interface ResolvedTemplate {
  template: string;
  resolved: string;
  missingVariables: string[];
}

export class TemplateVariableService {
  /**
   * Fills a template with what a **person** should read.
   *
   * That has always been the rule here rather than a new one: a question with
   * options already resolves to the option's label, so `{{kön}}` prints "Kvinna"
   * and not the stored `k`. A formatted answer follows the same principle —
   * `{{personnummer}}` prints `19560328-1949`, which is what the resident sees in
   * the field and what is printed on the card, while `getAnswers()` keeps the
   * twelve digits a register wants.
   *
   * Nothing that computes reads this. Calculations and rules take the raw string
   * from the answers record and parse it themselves, so a separator here can
   * never reach arithmetic.
   */
  static resolve(
    template: string,
    answers: Answers,
    graph?: GraphData,
    locale?: string,
  ): ResolvedTemplate {
    return this.fill(template, answers, graph, true, locale);
  }

  /**
   * The same, without making anything readable.
   *
   * For the one caller where the result is a **machine string** rather than
   * prose: an email result's `to` field. A recipient address goes through the
   * same template syntax, and a space inserted into it for legibility would be
   * the kind of fault nobody finds until a letter fails to arrive.
   *
   * A separate method rather than a flag with a default, because the default
   * would be right in four places and wrong in the fifth — and the fifth is the
   * one that breaks quietly.
   */
  static resolveExact(template: string, answers: Answers, graph?: GraphData): ResolvedTemplate {
    return this.fill(template, answers, graph, false);
  }

  /**
   * The same as `resolve`, for a **cell** in the receiver's row (story 092).
   *
   * One difference: a repeated page's list named alone gives its count, not
   * its records line by line — a cell is a cell, and "2" is what a list
   * column can hold. `{{lista.count}}` and `{{lista.fält.sum}}` work as in a
   * mail. A separate method for the reason `resolveExact` is one: the
   * default is right for prose and wrong here.
   */
  static resolveCell(template: string, answers: Answers, graph?: GraphData, locale?: string): ResolvedTemplate {
    return this.fill(template, answers, graph, true, locale, "count");
  }

  /**
   * A number written the way the reader's language writes one.
   *
   * Separators only — **never the unit**. Authors already write it themselves:
   * `{{manadsbidrag}} kr/mån`, `{{maxLoan}} kr`, `{{pris}} kr` appear in the
   * bundled guides, and appending ours would produce "7 400 kr/mån kr/mån". The
   * unit belongs to the field, where it now stands beside the input; the value
   * carries only itself.
   *
   * Anything that is not a plain number is left exactly as it was — a variable
   * holding "12 rum och kök" is not arithmetic and must not be rewritten.
   */
  private static readable(value: string, locale: string): string {
    const trimmed = value.trim();
    /*
     * Also the shapes a field actually stores. `,5` typed into an amount is
     * stored as `.5`, and the old pattern required a digit before the mark — so
     * it came out as a raw period in the middle of Swedish prose. A trailing
     * mark (`1234,`) is a number somebody stopped typing, not a decimal.
     */
    const match = /^(-?)(\d*)(?:[.,](\d*))?$/.exec(trimmed);

    if (trimmed === "" || !match || (match[2] === "" && !match[3])) {
      return value;
    }

    const parsed = Number(`${match[1]}${match[2] || "0"}.${match[3] ?? ""}` || "0");

    /*
     * As many decimals as the value has, and no more.
     *
     * `toLocaleString` rounds to three by default, so a stored `1234.5678` was
     * reported as `1 234,568` — a different number, quietly, in the sentence a
     * resident is meant to act on. Rounding may be what an author wants, but it
     * has to be a choice they made rather than a default nobody saw.
     */
    const decimals = Math.min((match[3] ?? "").replace(/0+$/, "").length, 20);

    return Number.isFinite(parsed)
      ? parsed.toLocaleString(locale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : value;
  }

  private static fill(
    template: string,
    answers: Answers,
    graph: GraphData | undefined,
    readable: boolean,
    locale?: string,
    repeatedAs: "lines" | "count" = "lines",
  ): ResolvedTemplate {
    /*
     * The reader's language when the caller knows it, and the guide's own when
     * it does not — the same fallback `resolveText` already uses for choosing
     * which translation to show, so a template does not answer the language
     * question two different ways.
     */
    const language = locale || getSourceLocale(graph) || "sv";
    const missing = new Set<string>();
    const resolved = template.replace(/{{\s*([^{}]+?)\s*}}/g, (placeholder, name: string) => {
      const variableName = name.trim();
      /*
       * Som text, alltid. Ett svar kan vara flera — och det som ska stå i ett
       * brev eller en resultattext är "Danmark, Tyskland", aldrig en JSON-lista
       * och aldrig två rader mitt i en mening. `answerText` äger det valet.
       */
      /*
       * Genom `readPath`, så en mall kan skriva ut en del: `{{land.value}}` är
       * koderna, `{{land}}` etiketterna. Samma adressering som villkoren.
       */
      const stored = readPath(answers, variableName);
      // A list of records — a page that repeats (story 084) — reads as its
      // lines; `answerText` has no name for a record's parts.
      const repeated = stored === undefined ? null : PageRepeatService.pageFor(graph, variableName);
      const answer = stored === undefined
        ? undefined
        : repeated
          ? repeatedAs === "count" && Array.isArray(stored)
            ? String(stored.length)
            : PageRepeatService.describe(graph!, repeated, stored, answers, locale)
          : answerText(stored);

      if (answer === undefined) {
        missing.add(variableName);
        return placeholder;
      }
      /*
       * Noden som variabeln kommer ifrån — också när den kommer ur en
       * beräkning.
       *
       * En beräkningsnod har ingen `data.variableName`; dess variabler ligger i
       * `assignments`. Uppslaget letade bara efter den förra, så `source` blev
       * `undefined` för allt uträknat — och grenen `source?.type ===
       * "calculation"` nedan kunde aldrig bli sann. Koden bad alltså om
       * grupperingen och fick den aldrig.
       *
       * Mätt i en mening ur lånebeskedet: *"Med en årsinkomst på 420000 kr … Med
       * 400 000 kr sparat"* — svaret grupperat, uträkningen inte, tre ord isär.
       */
      const source = graph?.nodes.find(
        (node) =>
          node.data.variableName === variableName ||
          (Array.isArray(node.data.assignments) &&
            (node.data.assignments as Array<{ variableName?: string }>).some(
              (assignment) => assignment.variableName === variableName,
            )) ||
          /*
           * Och en TREDJE form: det en tjänst svarat med bor i
           * `responseMappings`. Samma fel som uträkningens, hittat i
           * skadeanmälan (story 105) i en enda mening — "**18 500 kr**
           * betalas ut … efter självrisken på 1500 kr." Beloppet räknat och
           * grupperat, självrisken hämtad och ogrupperad, fyra ord isär.
           */
          (Array.isArray(node.data.responseMappings) &&
            (node.data.responseMappings as Array<{ variableName?: string }>).some(
              (mapping) => mapping.variableName === variableName,
            )),
      );
      /*
       * Etiketterna, i läsarens språk. Ett flerval är en LISTA av koder, och
       * uppslaget jämförde varje alternativ med hela listan hopslagen — så
       * `{{arbete}}` skrev "mala, tapetsera". Och etiketten slogs upp utan
       * språk, så ett engelskt brev sa "Måla". Hittat av mallarna för små
       * firmor (story 109, 11/9), en mening i taget.
       */
      const chosen = source && !repeated
        ? (Array.isArray(stored) ? stored.map(String) : [answer])
        : [];
      /*
       * A rating's steps count as options here (story 115): the variable holds
       * the step's number so a rule can compare it, and a letter has to write
       * the WORD. Derived rather than stored — see `rating-scale-service.ts` —
       * so the mapping is the same one the review and the answer record use.
       */
      const options = !chosen.length
        ? []
        : source!.type === "rating-question"
          ? RatingScaleService.steps(source!, language)
          : QuestionOptionsService.getOptions(source!);
      const labels = chosen.map((value) => options.find((candidate) => candidate.value === value));

      if (labels.length && labels.every((option) => option !== undefined)) {
        return labels.map((option) => resolveText(option!.label, language)).join(", ");
      }

      if (!readable) {
        return answer;
      }

      const shape = typeof source?.data.format === "string" ? source.data.format : undefined;

      if (shape) {
        return displayFormat(shape, answer);
      }

      /*
       * `service-call` med: ett fält som kom tillbaka som ett tal är ett tal i
       * meningen också. Det som inte är ett tal lämnar `readable` orört, så
       * ett svarsord som "approved" skrivs som det står.
       */
      return source?.type === "number-question" ||
        source?.type === "calculation" ||
        source?.type === "service-call"
        ? this.readable(answer, language)
        : answer;
    });
    return { template, resolved, missingVariables: [...missing] };
  }
}

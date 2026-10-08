import { migrateIncoming } from "../viewer/core/accepted-graph";
import { GuideTraversalEngine } from "../viewer/core/guide-traversal-engine";
import { toStepViewModel, type StepViewModel } from "./step-view-model";

import type { GraphData } from "../viewer/types/graph";

/**
 * A simulated backend-for-frontend. It holds the graph and the engine and
 * exposes steps only as formula-free view models — never the graph, the answers
 * or the formulas. On GitHub Pages it runs in the browser (and is therefore not
 * genuinely secure), but the interface is deliberately shaped like a server API:
 * swap the calls for HTTP and the whole class moves to a real BFF unchanged. See
 * docs/RUNTIME-SECURITY.md.
 */
export class SimulatedBff {
  private readonly graph: GraphData;
  private readonly engine: GuideTraversalEngine;
  private locale: string | undefined;

  constructor(graph: GraphData, options: { locale?: string } = {}) {
    /*
     * Lyft till dagens format vid dörren, som visaren och editorn.
     *
     * En BFF läser grafen ur en lagring, alltså precis den väg där en gammal
     * version dyker upp. Visaren saknade det här och renderade då en tom sida
     * utan felmeddelande — se `guide-preview-migration.browser.test.ts`. Den
     * tredje dörren gör inte om det.
     *
     * `migrateIncoming` klonar redan det den lyfter, men gör det inte när
     * grafen är aktuell — kopian nedan står kvar, eftersom anroparen aldrig ska
     * kunna nå grafen via sin referens.
     */
    const incoming = migrateIncoming(graph);

    if (!incoming.ok) {
      /*
       * Thrown rather than reported, because this one is a constructor: a
       * half-built BFF that answers questions about a graph it refused is worse
       * than no BFF at all. The two components have a surface to show a refusal
       * on; a server-side object has its caller.
       */
      throw new Error(incoming.message);
    }

    this.graph = structuredClone(incoming.graph);
    this.engine = new GuideTraversalEngine(this.graph);
    this.locale = options.locale;
  }

  /** The end user's language. On a real BFF it comes from the request. */
  setLocale(locale: string | undefined): StepViewModel {
    this.locale = locale;
    return this.view();
  }

  /** Det aktuella steget som en vymodell. */
  currentStep(): StepViewModel {
    return this.view();
  }

  /** Answers a choice question with the chosen option's id. */
  answerChoice(optionId: string): StepViewModel {
    this.engine.answer(optionId);
    return this.view();
  }

  /** Besvarar en siffer- eller textfråga med ett värde. */
  answerValue(value: string): StepViewModel {
    this.engine.answerValue(value);
    return this.view();
  }

  /** Besvarar en sida med värden per variabelnamn. */
  answerPage(values: Record<string, string>): StepViewModel {
    this.engine.answerPage(values);
    return this.view();
  }

  /** Går tillbaka ett steg. */
  back(): StepViewModel {
    this.engine.previous();
    return this.view();
  }

  /** Börjar om från början. */
  restart(): StepViewModel {
    this.engine.restart();
    return this.view();
  }

  private view(): StepViewModel {
    const node = this.engine.getCurrentNode();

    if (!node) {
      return {
        kind: "unsupported",
        nodeId: "",
        stepNumber: this.engine.getStepNumber(),
        canGoBack: this.engine.canGoBack(),
        nodeType: "none",
      };
    }

    return toStepViewModel(
      node,
      this.engine.getAnswers(),
      this.graph,
      {
        stepNumber: this.engine.getStepNumber(),
        canGoBack: this.engine.canGoBack(),
      },
      this.locale
    );
  }
}

import * as businessForm from "./business-form-example-graph";
import * as citizenship from "./citizenship-example-graph";
import * as everyField from "./every-field-example-graph";
import * as example from "./example-graph";
import * as housingAllowance from "./housing-allowance-example-graph";
import * as housingAllowanceCalc from "./housing-allowance-calc-example-graph";
import * as housingScreening from "./housing-screening-example-graph";
import * as loan from "./loan-example-graph";
import * as loanCalculator from "./loan-calculator-example-graph";
import * as map from "./map-example-graph";
import * as municipality from "./municipality-example-graph";
import * as pageBuilder from "./page-builder-example-graph";
import * as profiles from "./profile-example-graphs";
import * as requestClassification from "./request-classification-example-graph";
import * as serviceCall from "./service-call-example-graph";
import * as serviceFinder from "./service-finder-example-graph";
import * as troubleshooting from "./troubleshooting-example-graph";
import * as tutorial from "./tutorial-example-graph";

import type { GraphData } from "../viewer/types/graph";

/**
 * Every guide that ships in the package, as `[name, graph]`.
 *
 * The list is here and nowhere else because it is the kind of thing that
 * drifts: three tests had grown three hand-kept copies, and a guide added to
 * one of them was silently outside the other two. Adding a module here puts
 * the new guide into every check that reads this file at once.
 *
 * Whole modules are imported and every exported graph is picked out, rather
 * than each graph being named: `profile-example-graphs` exports two, and a
 * third added beside them should not need this file edited to be checked.
 *
 * **Tests only.** Nothing the library ships imports this — it would pull every
 * example guide into a visitor's page. The site imports the guides it actually
 * shows, one by one.
 *
 * The guides that send something in are FlowWeaver PRO's and stand in
 * `src/pro/data/bundled-graphs.ts` (open-core step 5, 2026-10-06); a test that
 * wants every guide in this repo reads `ALL_BUNDLED_GRAPHS` from there.
 */
const MODULES: Record<string, Record<string, unknown>> = {
  "business-form": businessForm,
  citizenship,
  "every-field": everyField,
  example,
  "housing-allowance": housingAllowance,
  "housing-allowance-calc": housingAllowanceCalc,
  "housing-screening": housingScreening,
  loan,
  "loan-calculator": loanCalculator,
  map,
  municipality,
  "page-builder": pageBuilder,
  profiles,
  /*
   * Klassificering av kundönskemål (story 122). Ingen sida på sajten visar
   * den än — var den ska synas är en öppen fråga till Johan — men en graf vi
   * skeppar ska migreras och mätas som alla andra, och det här är enda stället
   * som avgör vilka som blir det.
   */
  "request-classification": requestClassification,
  "service-call": serviceCall,
  "service-finder": serviceFinder,
  troubleshooting,
  tutorial,
};

export function isGraph(value: unknown): value is GraphData {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as GraphData).nodes) &&
    Array.isArray((value as GraphData).connections)
  );
}

/** `[module:export, graph]` for every graph a module map exports — shared with PRO's list. */
export function graphsOf(modules: Record<string, Record<string, unknown>>): Array<[string, GraphData]> {
  return Object.entries(modules).flatMap(([moduleName, module]) =>
  Object.entries(module)
    .filter(([, value]) => isGraph(value))
    .map(([name, value]): [string, GraphData] => [
      `${moduleName}:${name}`,
      value as GraphData,
    ])
  );
}

export const BUNDLED_GRAPHS: Array<[string, GraphData]> = graphsOf(MODULES);

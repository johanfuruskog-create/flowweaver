import { describe, expect, test } from "vitest";

import { getEditorCapabilities } from "./editor-capabilities";
import {
  EDITOR_MODULES,
  getCapabilitiesFromModules,
  moduleForCapability,
  moduleForRequiredCapability,
  modulesForFeatureLevel,
  modulesForRequiredCapabilities,
  modulesUsedByGraph,
  parseModuleIds,
  visibleModules,
} from "./editor-modules";

import "../../viewer/node-types/default-node-types";
// FlowWeaver PRO's sending types are registered on top (open-core step 4).
import { housingAllowanceCalcExampleGraph } from "../../data/housing-allowance-calc-example-graph";
import { businessFormExampleGraph } from "../../data/business-form-example-graph";
import { municipalityExampleGraph } from "../../data/municipality-example-graph";
import { getNodeType, unregisterNodeType, registerNodeType } from "../../viewer/node-types/node-type-registry";
import type { GraphData } from "../../viewer/types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../testing/optional-pro";
await withPro("viewer/node-types/submission-node-types.ts");
const { borrowExampleGraph } = ((await proModule("data/borrow-example-graph.ts")) ?? {}) as { borrowExampleGraph: GraphData };
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

describe("editor modules", () => {
  const allModuleIds = EDITOR_MODULES.map((module) => module.id);

  test("no modules gives exactly the basic level (the core baseline)", () => {
    expect(getCapabilitiesFromModules([])).toEqual(getEditorCapabilities("basic"));
  });

  test("every module gives exactly advanced mode", () => {
    expect(getCapabilitiesFromModules(allModuleIds)).toEqual(
      getEditorCapabilities("advanced")
    );
  });

  test("the logic module unlocks multi-condition rules and calculations", () => {
    const capabilities = getCapabilitiesFromModules(["logic"]);
    expect(capabilities.advancedRules).toBe(true);
    expect(capabilities.calculations).toBe(true);
    // But not content/input/service.
    expect(capabilities.richContent).toBe(false);
    expect(capabilities.inputQuestions).toBe(false);
    expect(capabilities.pages).toBe(false);
    // The core baseline is always on.
    expect(capabilities.rules).toBe(true);
    expect(capabilities.variables).toBe(true);
  });

  test("unknown module ids are ignored (falling back to core)", () => {
    expect(getCapabilitiesFromModules(["finns-inte"])).toEqual(
      getEditorCapabilities("basic")
    );
  });

  test("parseModuleIds reads space/comma separated ids and filters out unknowns and duplicates", () => {
    expect(parseModuleIds("logic content")).toEqual(["logic", "content"]);
    expect(parseModuleIds("logic, logic ,pages")).toEqual(["logic", "pages"]);
    expect(parseModuleIds("logic nonsens")).toEqual(["logic"]);
    expect(parseModuleIds("")).toEqual([]);
    expect(parseModuleIds(null)).toEqual([]);
  });

  test("the Swedish ids from before 097 still read as their modules (a host that wrote them keeps its palette)", () => {
    expect(parseModuleIds("logik innehall inmatning tjanst")).toEqual([
      "logic",
      "content",
      "fields",
      "pages",
      "submission",
    ]);
    // Alias and new id for the same module collapse to one.
    expect(parseModuleIds("inmatning fields")).toEqual(["fields"]);
  });

  test("Fält and Värdens tjänster are two modules: fields alone give no lookup/file/map, host services alone give no text field", () => {
    const fields = getCapabilitiesFromModules(["fields"]);
    expect(fields.inputQuestions).toBe(true);
    expect(fields.hostServices).toBe(false);
    const hostServices = getCapabilitiesFromModules(["host-services"]);
    expect(hostServices.hostServices).toBe(true);
    expect(hostServices.inputQuestions).toBe(false);
    // Both carry field validation — a lookup must be able to be required.
    expect(fields.fieldValidation).toBe(true);
    expect(hostServices.fieldValidation).toBe(true);
  });
});

describe("the service module split in two (open-core step 2)", () => {
  // The boundary: the open product helps a visitor reach an answer, the full
  // version lets the visitor send something in. `pages` is the open half,
  // `submission` the private one; `service` is what hosts wrote before 6/10.
  test("service, the module before the split, still gives what it gave — all of it", () => {
    const capabilities = getCapabilitiesFromModules(parseModuleIds("service"));
    expect(capabilities.pages).toBe(true);
    expect(capabilities.routeAnalysis).toBe(true);
    expect(capabilities.serviceCalls).toBe(true);
    expect(capabilities.emailResults).toBe(true);
    expect(capabilities.submission).toBe(true);
    expect(parseModuleIds("service")).toEqual(["pages", "submission"]);
    expect(parseModuleIds("tjanst")).toEqual(["pages", "submission"]);
  });

  test("pages alone sends nothing in: service calls yes, submission and email results no", () => {
    const capabilities = getCapabilitiesFromModules(["pages"]);
    expect(capabilities.pages).toBe(true);
    expect(capabilities.serviceCalls).toBe(true);
    expect(capabilities.submission).toBe(false);
    expect(capabilities.emailResults).toBe(false);
  });

  test.runIf(PRO)("the submission node is gated on the submission capability, so a submission guide pre-ticks the module", () => {
    expect(getNodeType("submit-result")?.requiredCapability).toBe("submission");
    expect(modulesUsedByGraph(borrowExampleGraph.nodes)).toContain("submission");
  });
});

describe("module lookup per capability and node type", () => {
  test("core capabilities belong to Grund", () => {
    expect(moduleForCapability("rules")?.id).toBe("core");
    expect(moduleForCapability("multiChoice")?.id).toBe("core");
  });

  test("module capabilities point at the right module", () => {
    expect(moduleForCapability("calculations")?.id).toBe("logic");
    expect(moduleForCapability("advancedRules")?.id).toBe("logic");
    expect(moduleForCapability("richContent")?.id).toBe("content");
    expect(moduleForCapability("inputQuestions")?.id).toBe("fields");
    expect(moduleForCapability("hostServices")?.id).toBe("host-services");
    expect(moduleForCapability("emailResults")?.id).toBe("submission");
    expect(moduleForCapability("submission")?.id).toBe("submission");
    expect(moduleForCapability("serviceCalls")?.id).toBe("pages");
  });

  test("a node type without a gate counts as Grund, with a gate as its module", () => {
    expect(moduleForRequiredCapability(undefined).id).toBe("core");
    expect(moduleForRequiredCapability("calculations").id).toBe("logic");
    expect(moduleForRequiredCapability("richContent").id).toBe("content");
  });

  test("level to modules: basic empty, advanced every one", () => {
    expect(modulesForFeatureLevel("basic")).toEqual([]);
    expect(modulesForFeatureLevel("advanced")).toEqual(
      EDITOR_MODULES.map((module) => module.id)
    );
  });
});

describe("pre-tick modules by usage", () => {
  test("core capabilities yield no modules; module capabilities yield theirs (in catalogue order)", () => {
    expect(modulesForRequiredCapabilities([undefined, "rules", "multiChoice"])).toEqual([]);
    expect(modulesForRequiredCapabilities(["calculations", "inputQuestions"])).toEqual([
      "logic",
      "fields",
    ]);
    expect(modulesForRequiredCapabilities(["serviceCalls", "richContent"])).toEqual([
      "content",
      "pages",
    ]);
  });

  test("the calculation example pre-ticks Logik plus Fält — no map or file for two text fields", () => {
    expect(modulesUsedByGraph(housingAllowanceCalcExampleGraph.nodes)).toEqual([
      "logic",
      "fields",
    ]);
  });

  test("the municipality example (one lookup field) pre-ticks Värdens tjänster only — no date or consent", () => {
    expect(modulesUsedByGraph(municipalityExampleGraph.nodes)).toEqual(["host-services"]);
  });

  test("the company-form example (single choice and results only) pre-ticks no modules", () => {
    expect(modulesUsedByGraph(businessFormExampleGraph.nodes)).toEqual([]);
  });
});

describe("which modules the menu shows", () => {
  // A module with no registered node type behind any of its capabilities is
  // not offered: the open editor has the `submission` module in its catalogue
  // (the config is open code) but no node that needs it until PRO registers.
  test.runIf(PRO)("submission is shown only while a node type requires it", () => {
    expect(visibleModules().map((m) => m.id)).toContain("submission");
    const kept = getNodeType("submit-result")!;
    const keptEmail = getNodeType("email-result")!;
    unregisterNodeType("submit-result");
    unregisterNodeType("email-result");
    try {
      expect(visibleModules().map((m) => m.id)).not.toContain("submission");
      expect(visibleModules().map((m) => m.id)).toEqual(["logic", "content", "fields", "host-services", "pages"]);
    } finally {
      registerNodeType("submit-result", kept);
      registerNodeType("email-result", keptEmail);
    }
  });
});

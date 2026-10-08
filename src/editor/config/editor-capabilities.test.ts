import { describe, expect, test } from "vitest";

import { getEditorCapabilities, isEditorFeatureLevel } from "./editor-capabilities";

describe("editor capabilities", () => {
  test("ger enkel guide en avskalad funktionsprofil", () => {
    expect(getEditorCapabilities("basic")).toEqual({
      rules: true,
      advancedRules: false,
      calculations: false,
      variables: true,
      multiChoice: true,
      inputQuestions: false,
      hostServices: false,
      pages: false,
      numericConstraints: false,
      fieldValidation: false,
      routeAnalysis: false,
      importExport: true,
      emailResults: false,
      serviceCalls: false,
      richContent: false,
      submission: false,
    });
  });

  test("keeps every current feature in advanced mode", () => {
    expect(getEditorCapabilities("advanced")).toEqual({
      rules: true,
      advancedRules: true,
      calculations: true,
      variables: true,
      multiChoice: true,
      inputQuestions: true,
      hostServices: true,
      pages: true,
      numericConstraints: true,
      fieldValidation: true,
      routeAnalysis: true,
      importExport: true,
      emailResults: true,
      serviceCalls: true,
      richContent: true,
      submission: true,
    });
  });

  test("can override individual features without changing the preset", () => {
    const customized = getEditorCapabilities("basic", { pages: true });

    expect(customized.pages).toBe(true);
    expect(getEditorCapabilities("basic").pages).toBe(false);
    expect(isEditorFeatureLevel("service")).toBe(true);
    expect(isEditorFeatureLevel("unknown")).toBe(false);
  });
});

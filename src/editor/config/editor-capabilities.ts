import type {
  EditorCapabilities,
  EditorFeatureLevel,
} from "../../viewer/types/editor-capabilities";

// The names are the viewer's (`viewer/types/editor-capabilities.ts`); what
// each level enables is decided here.
export type {
  EditorCapabilities,
  EditorCapability,
  EditorFeatureLevel,
} from "../../viewer/types/editor-capabilities";

const FEATURE_LEVELS: Record<EditorFeatureLevel, EditorCapabilities> = {
  basic: {
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
  },
  advanced: {
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
  },
  service: {
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
  },
};

export function isEditorFeatureLevel(value: unknown): value is EditorFeatureLevel {
  return value === "basic" || value === "advanced" || value === "service";
}

export function getEditorCapabilities(
  level: EditorFeatureLevel,
  overrides: Partial<EditorCapabilities> = {}
): EditorCapabilities {
  return { ...FEATURE_LEVELS[level], ...overrides };
}

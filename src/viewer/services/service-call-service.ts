import type { AnswerValue, Answers } from "../core/answer-values";
import { isLocalizedTextMap, resolveText, type LocaleCode, type LocalizedText } from "../core/localized-text";
import { readNodeString } from "../node-types/node-fields";

import type { FlowNodeData, ServiceResponseMapping } from "../types/graph";

export interface MappingResult {
  id: string;
  variableName: string;
  success: boolean;
  value?: string;
  error?: string;
}

export interface ServiceCallOutcome {
  /** Svarskartan kompletterad med de mappade variablerna. */
  answers: Answers;
  /** Per row: did it succeed, with which value or which error. For debugging. */
  results: MappingResult[];
}

/** Reads a field in "a.b.c" form from a parsed JSON response. */
function getByPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key.trim()];
  }
  return current;
}

/** What a call carries: a value, or several. JSON on the wire either way. */
export type RequestPayload = Record<string, AnswerValue>;

export class ServiceCallService {
  static getRequestVariables(node: FlowNodeData): string[] {
    const value = node.data.requestVariables;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
  }

  static getResponseMappings(node: FlowNodeData): ServiceResponseMapping[] {
    return this.parseMappings(node.data.responseMappings);
  }

  static parseMappings(value: unknown): ServiceResponseMapping[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is ServiceResponseMapping => {
      if (typeof item !== "object" || item === null) return false;
      const candidate = item as Record<string, unknown>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.field === "string" &&
        typeof candidate.variableName === "string" &&
        (candidate.label === undefined || typeof candidate.label === "string" || isLocalizedTextMap(candidate.label))
      );
    });
  }

  static createMapping(): ServiceResponseMapping {
    return { id: crypto.randomUUID(), field: "", variableName: "" };
  }

  static updateMapping(
    mappings: ServiceResponseMapping[],
    mappingId: string,
    property: "field" | "variableName" | "label",
    value: string | LocalizedText
  ): ServiceResponseMapping[] {
    return mappings.map((item) =>
      item.id === mappingId ? { ...item, [property]: value } : item
    );
  }

  static moveMapping(
    mappings: ServiceResponseMapping[],
    mappingId: string,
    direction: "up" | "down"
  ): ServiceResponseMapping[] {
    const index = mappings.findIndex((item) => item.id === mappingId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= mappings.length) {
      return mappings;
    }
    const updated = [...mappings];
    [updated[index], updated[target]] = [updated[target]!, updated[index]!];
    return updated;
  }

  /** Variabelnamnen som noden producerar (icke-tomma), i ordning. */
  static getProducedVariables(node: FlowNodeData): string[] {
    return this.getProducedEntries(node).map((entry) => entry.name);
  }

  /**
   * Name and label per produced variable, in order. The label is the row's
   * own (story 079) and falls back to the name, so a row without one reads
   * exactly as before — the same shape as CalculationService.
   */
  static getProducedEntries(node: FlowNodeData, locale?: LocaleCode): { name: string; label: string }[] {
    return this.getResponseMappings(node)
      .map((mapping) => ({
        name: mapping.variableName.trim(),
        label: resolveText(mapping.label, locale).trim() || mapping.variableName.trim(),
      }))
      .filter((entry) => entry.name.length > 0);
  }

  /**
   * Builds the payload the call would send: chosen variables → values.
   *
   * A multi-value answer travels as a **JSON array**, not as a joined string.
   * The payload is JSON on the wire, so a list has an honest shape there — and
   * a backend that receives "Danmark, Tyskland" has to guess where one value
   * ends, which is a guess it will get wrong on the first name with a comma in
   * it. See `docs/TJANSTEANROP-KONTRAKT.md`.
   */
  static buildRequestPayload(
    node: FlowNodeData,
    answers: Answers,
  ): RequestPayload {
    const payload: RequestPayload = {};
    for (const name of this.getRequestVariables(node)) {
      if (name in answers) {
        payload[name] = answers[name]!;
      }
    }
    return payload;
  }

  /**
   * Mock run: reads the node's sample response and puts the mapped fields into
   * variables. No network — used in the editor, the preview and on GitHub
   * Pages, where there is no backend.
   */
  static runMock(
    node: FlowNodeData,
    answers: Answers
  ): ServiceCallOutcome {
    const raw = typeof node.data.mockResponse === "string" ? node.data.mockResponse : "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.failAll(node, answers, "Exempelsvaret är inte giltig JSON");
    }
    return this.applyResponse(node, answers, parsed);
  }

  /**
   * Real run: makes the call against the endpoint and maps the response.
   * Belongs in the BFF — that is where the endpoint, the secrets and the
   * network live. `fetchImpl` can be injected for tests. The same response
   * mapping as the mock variant.
   */
  static async runLive(
    node: FlowNodeData,
    answers: Answers,
    options: { fetchImpl?: typeof fetch; allowedHosts?: string[] } = {}
  ): Promise<ServiceCallOutcome> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const endpoint = readNodeString(node, "endpoint");
    const method = readNodeString(node, "method");
    const payload = this.buildRequestPayload(node, answers);

    // SSRF protection: the endpoint comes from graph data (possibly imported).
    // Allow only relative (same origin) or explicitly allowlisted https hosts —
    // never arbitrary URLs, internal addresses or other schemes. The BFF should
    // have an allowlist of its own as well.
    if (!this.isEndpointAllowed(endpoint, options.allowedHosts ?? [])) {
      return this.failAll(node, answers, "Endpointen är inte tillåten");
    }

    let parsed: unknown;
    try {
      const init: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
      };
      if (method !== "GET") {
        init.body = JSON.stringify(payload);
      }
      const response = await fetchImpl(endpoint, init);
      if (!response.ok) {
        return this.failAll(node, answers, `Tjänsten svarade med status ${response.status}`);
      }
      parsed = await response.json();
    } catch {
      return this.failAll(node, answers, "Tjänsten kunde inte nås");
    }

    return this.applyResponse(node, answers, parsed);
  }

  /** Allow only relative endpoints or explicitly allowlisted https hosts. */
  private static isEndpointAllowed(
    endpoint: string,
    allowedHosts: string[]
  ): boolean {
    const trimmed = endpoint.trim();
    if (trimmed.length === 0) {
      return false;
    }
    // A relative path = the same origin (a proxy in your own service).
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
      return true;
    }
    try {
      const url = new URL(trimmed);
      return url.protocol === "https:" && allowedHosts.includes(url.host);
    } catch {
      return false;
    }
  }

  /** Shared response mapping: read the fields from a parsed response, set variables. */
  private static applyResponse(
    node: FlowNodeData,
    answers: Answers,
    parsed: unknown
  ): ServiceCallOutcome {
    const nextAnswers = { ...answers };
    const results: MappingResult[] = [];

    for (const mapping of this.getResponseMappings(node)) {
      const variableName = mapping.variableName.trim();
      const field = mapping.field.trim();
      if (variableName.length === 0 || field.length === 0) {
        continue;
      }

      const value = getByPath(parsed, field);
      if (value === undefined || value === null || typeof value === "object") {
        results.push({
          id: mapping.id,
          variableName,
          success: false,
          error: `Fältet "${field}" saknas i svaret`,
        });
        continue;
      }

      const asString = String(value);
      nextAnswers[variableName] = asString;
      results.push({ id: mapping.id, variableName, success: true, value: asString });
    }

    return { answers: nextAnswers, results };
  }

  private static failAll(
    node: FlowNodeData,
    answers: Answers,
    error: string
  ): ServiceCallOutcome {
    return {
      answers,
      results: this.getResponseMappings(node).map((mapping) => ({
        id: mapping.id,
        variableName: mapping.variableName.trim(),
        success: false,
        error,
      })),
    };
  }
}

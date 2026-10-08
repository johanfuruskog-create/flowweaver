import { describe, expect, test } from "vitest";

import { ServiceCallService } from "./service-call-service";

import type { FlowNodeData } from "../types/graph";

const node = (data: Record<string, unknown>): FlowNodeData => ({
  id: "svc",
  type: "service-call",
  position: { x: 0, y: 0 },
  data,
});

describe("ServiceCallService", () => {
  test("maps fields from the sample response into variables", () => {
    const outcome = ServiceCallService.runMock(
      node({
        mockResponse: JSON.stringify({ maxLoan: 2550000, decision: "approved" }),
        responseMappings: [
          { id: "m1", field: "maxLoan", variableName: "maxLån" },
          { id: "m2", field: "decision", variableName: "beslut" },
        ],
      }),
      {}
    );

    expect(outcome.answers["maxLån"]).toBe("2550000");
    expect(outcome.answers["beslut"]).toBe("approved");
    expect(outcome.results.every((result) => result.success)).toBe(true);
  });

  test("reads nested fields with dot notation", () => {
    const outcome = ServiceCallService.runMock(
      node({
        mockResponse: JSON.stringify({ result: { amount: 1000 } }),
        responseMappings: [{ id: "m1", field: "result.amount", variableName: "belopp" }],
      }),
      {}
    );

    expect(outcome.answers["belopp"]).toBe("1000");
  });

  test("reports a missing field without setting the variable", () => {
    const outcome = ServiceCallService.runMock(
      node({
        mockResponse: JSON.stringify({ a: 1 }),
        responseMappings: [{ id: "m1", field: "saknas", variableName: "x" }],
      }),
      {}
    );

    expect(outcome.answers["x"]).toBeUndefined();
    expect(outcome.results[0]?.success).toBe(false);
    expect(outcome.results[0]?.error).toContain("saknas");
  });

  test("rapporterar ogiltig JSON i exempelsvaret", () => {
    const outcome = ServiceCallService.runMock(
      node({
        mockResponse: "{ inte json",
        responseMappings: [{ id: "m1", field: "a", variableName: "x" }],
      }),
      {}
    );

    expect(outcome.results[0]?.success).toBe(false);
    expect(outcome.results[0]?.error).toContain("JSON");
  });

  test("bygger request-payloaden av de valda variablerna", () => {
    const payload = ServiceCallService.buildRequestPayload(
      node({ requestVariables: ["pris", "inkomst", "saknad"] }),
      { pris: "3000000", inkomst: "600000", extra: "ignoreras" }
    );

    expect(payload).toEqual({ pris: "3000000", inkomst: "600000" });
  });

  test("runLive: makes the call and maps the response", async () => {
    let captured: { url: string; init?: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      captured = { url: String(url), init };
      return { ok: true, status: 200, json: async () => ({ maxLoan: 2550000 }) } as Response;
    }) as unknown as typeof fetch;

    const outcome = await ServiceCallService.runLive(
      node({
        endpoint: "/api/bolan",
        method: "POST",
        requestVariables: ["pris"],
        responseMappings: [{ id: "m1", field: "maxLoan", variableName: "maxLån" }],
      }),
      { pris: "3000000" },
      { fetchImpl }
    );

    expect(outcome.answers["maxLån"]).toBe("2550000");
    expect(captured?.url).toBe("/api/bolan");
    expect(JSON.parse(String(captured?.init?.body))).toEqual({ pris: "3000000" });
  });

  test("runLive: rapporterar fel vid non-200", async () => {
    const fetchImpl = (async () => ({ ok: false, status: 503, json: async () => ({}) } as Response)) as unknown as typeof fetch;
    const outcome = await ServiceCallService.runLive(
      node({ endpoint: "/api/x", responseMappings: [{ id: "m1", field: "a", variableName: "x" }] }),
      {},
      { fetchImpl }
    );
    expect(outcome.answers["x"]).toBeUndefined();
    expect(outcome.results[0]?.error).toContain("503");
  });

  test("runLive: reports an error when the service is unreachable", async () => {
    const fetchImpl = (async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    const outcome = await ServiceCallService.runLive(
      node({ endpoint: "/api/x", responseMappings: [{ id: "m1", field: "a", variableName: "x" }] }),
      {},
      { fetchImpl }
    );
    expect(outcome.results[0]?.success).toBe(false);
    expect(outcome.results[0]?.error).toContain("nås");
  });

  test("runLive: SSRF-skydd blockerar godtyckliga och interna URL:er", async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return { ok: true, status: 200, json: async () => ({ a: 1 }) } as Response;
    }) as unknown as typeof fetch;

    for (const endpoint of [
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:8080/internal",
      "https://evil.example.com/steal",
      "//evil.example.com/x",
      "file:///etc/passwd",
    ]) {
      const outcome = await ServiceCallService.runLive(
        node({ endpoint, responseMappings: [{ id: "m1", field: "a", variableName: "x" }] }),
        {},
        { fetchImpl }
      );
      expect(called).toBe(false);
      expect(outcome.answers["x"]).toBeUndefined();
      expect(outcome.results[0]?.error).toContain("inte tillåten");
    }
  });

  test("runLive: allows an allowlisted https host", async () => {
    const fetchImpl = (async () => ({ ok: true, status: 200, json: async () => ({ a: 7 }) } as Response)) as unknown as typeof fetch;
    const outcome = await ServiceCallService.runLive(
      node({ endpoint: "https://api.internt.se/bolan", responseMappings: [{ id: "m1", field: "a", variableName: "x" }] }),
      {},
      { fetchImpl, allowedHosts: ["api.internt.se"] }
    );
    expect(outcome.answers["x"]).toBe("7");
  });

  test("listar producerade variabler i ordning", () => {
    const produced = ServiceCallService.getProducedVariables(
      node({
        responseMappings: [
          { id: "m1", field: "a", variableName: "x" },
          { id: "m2", field: "b", variableName: "" },
          { id: "m3", field: "c", variableName: "y" },
        ],
      })
    );

    expect(produced).toEqual(["x", "y"]);
  });
});

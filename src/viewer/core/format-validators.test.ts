import { describe, expect, test } from "vitest";

import { validateFormat } from "./format-validators";

describe("validateFormat", () => {
  test("an empty value and an unknown format pass", () => {
    expect(validateFormat("email", undefined, "")).toBeNull();
    expect(validateFormat("", undefined, "vad som helst")).toBeNull();
    expect(validateFormat(undefined, undefined, "vad som helst")).toBeNull();
  });

  test("returns a ui-strings key, not hardcoded text", () => {
    expect(validateFormat("email", undefined, "abc")).toBe("validation.format.email");
    expect(validateFormat("phone", undefined, "abc")).toBe("validation.format.phone");
    expect(validateFormat("personnummer", undefined, "811218-9875")).toBe(
      "validation.format.personnummer"
    );
    expect(validateFormat("regex", "^A$", "b")).toBe("validation.format.pattern");
  });

  test("e-post", () => {
    expect(validateFormat("email", undefined, "a@b.se")).toBeNull();
    expect(validateFormat("email", undefined, "abc")).not.toBeNull();
  });

  test("telefon", () => {
    expect(validateFormat("phone", undefined, "070-123 45 67")).toBeNull();
    expect(validateFormat("phone", undefined, "123")).not.toBeNull();
    expect(validateFormat("phone", undefined, "abc")).not.toBeNull();
  });

  test("personnummer (Luhn)", () => {
    expect(validateFormat("personnummer", undefined, "811218-9876")).toBeNull();
    expect(validateFormat("personnummer", undefined, "198112189876")).toBeNull();
    // Fel kontrollsiffra.
    expect(validateFormat("personnummer", undefined, "811218-9875")).not.toBeNull();
  });

  test("a custom regex pattern", () => {
    expect(validateFormat("regex", "^ABC\\d+$", "ABC123")).toBeNull();
    expect(validateFormat("regex", "^ABC\\d+$", "xyz")).not.toBeNull();
    // An invalid pattern does not block.
    expect(validateFormat("regex", "(", "vad som helst")).toBeNull();
  });
});

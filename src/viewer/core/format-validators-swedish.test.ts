import { describe, expect, test } from "vitest";

import { validateFormat } from "./format-validators";

/**
 * Two formats a Swedish form asks for constantly.
 *
 * ## Why named, when a regex could do it
 *
 * `format: "regex"` could match a postcode today. What it cannot do is say
 * *what* was wrong: a failed pattern gives "validation.format.pattern", which
 * tells somebody their answer is not accepted and nothing about why. A named
 * format carries its own message, and the field can offer the right keyboard on
 * a phone.
 *
 * That is the whole difference, and it is why these two are worth adding rather
 * than documenting as a regex somebody pastes.
 *
 * ## What is checked, and what deliberately is not
 *
 * **Postnummer**: five digits, with or without the space people write. Nothing
 * else — a code that is not in use is a delivery problem and not a format one,
 * and rejecting it here would refuse a genuinely new address.
 *
 * **Organisationsnummer**: ten digits with a valid Luhn check digit. The same
 * arithmetic as a personal number, because it is the same standard.
 *
 * The convention that an organisation number's third digit is at least two —
 * which is what separates it from a personal number — is **not** enforced. It
 * would be a stronger check and I am not certain enough of the rule's edges to
 * reject a real company on it. A wrong exclusion here is a form somebody cannot
 * submit, and that is a worse failure than accepting a personal number in a
 * field labelled for organisations.
 */

const ok = (format: string, value: string) => validateFormat(format, undefined, value);

describe("postnummer", () => {
  test("accepts the two ways people write it", () => {
    expect(ok("postnummer", "12345")).toBeNull();
    expect(ok("postnummer", "123 45")).toBeNull();
  });

  test("refuses the wrong number of digits", () => {
    expect(ok("postnummer", "1234")).toBe("validation.format.postnummer");
    expect(ok("postnummer", "123456")).toBe("validation.format.postnummer");
  });

  test("refuses letters, however they are placed", () => {
    expect(ok("postnummer", "12a45")).toBe("validation.format.postnummer");
    expect(ok("postnummer", "SE-12345")).toBe("validation.format.postnummer");
  });

  test("leaves an empty answer to the required rule", () => {
    // Format applies to filled-in answers; "must be answered" is a separate
    // question with a separate message.
    expect(ok("postnummer", "")).toBeNull();
    expect(ok("postnummer", "   ")).toBeNull();
  });
});

describe("organisationsnummer", () => {
  test("accepts a number whose check digit adds up", () => {
    // 556016-0680 — Volvo's, a published number, used because a made-up one
    // that happens to fail Luhn would make this test pass for the wrong reason.
    expect(ok("organisationsnummer", "5560160680")).toBeNull();
    expect(ok("organisationsnummer", "556016-0680")).toBeNull();
  });

  test("refuses one whose check digit does not", () => {
    expect(ok("organisationsnummer", "5560160681")).toBe(
      "validation.format.organisationsnummer",
    );
  });

  test("refuses the wrong length", () => {
    expect(ok("organisationsnummer", "556016068")).toBe(
      "validation.format.organisationsnummer",
    );
  });

  test("leaves an empty answer to the required rule", () => {
    expect(ok("organisationsnummer", "")).toBeNull();
  });
});

describe("the formats that were already there", () => {
  test("still behave the same", () => {
    // The two new cases are added to a switch, and a switch is where a new case
    // quietly shadows an old one.
    expect(ok("email", "a@b.se")).toBeNull();
    expect(ok("email", "inte-en-adress")).toBe("validation.format.email");
    expect(ok("personnummer", "19900101-0017")).toBeNull();
    expect(validateFormat("regex", "^\\d+$", "abc")).toBe("validation.format.pattern");
  });
});

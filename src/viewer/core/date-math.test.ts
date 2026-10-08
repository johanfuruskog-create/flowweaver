import { describe, expect, test } from "vitest";

import { ageOn, birthDateOf, daysBetween, todayIso } from "./date-math";

/*
 * Story 086, K15: each function has a case that falls without it — leap
 * day, samordningsnummer, the `+` form.
 */

describe("daysBetween", () => {
  test("counts whole days, negative backwards", () => {
    expect(daysBetween("2026-03-01", "2026-03-31")).toBe(30);
    expect(daysBetween("2026-03-31", "2026-03-01")).toBe(-30);
    expect(daysBetween("2026-03-01", "2026-03-01")).toBe(0);
  });

  test("across a leap day and a DST change", () => {
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("ageOn", () => {
  test("turns a year on the birthday, not the day before", () => {
    expect(ageOn("2008-09-04", "2026-09-03")).toBe(17);
    expect(ageOn("2008-09-04", "2026-09-04")).toBe(18);
  });

  test("a leap-day birthday turns on the 1st of March in a common year", () => {
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageOn("2008-02-29", "2026-03-01")).toBe(18);
    expect(ageOn("2008-02-29", "2028-02-29")).toBe(20);
  });
});

describe("birthDateOf", () => {
  const today = "2026-09-04";

  test("twelve digits carry the century", () => {
    expect(birthDateOf("19800223-7538", today)).toBe("1980-02-23");
    expect(birthDateOf("198002237538", today)).toBe("1980-02-23");
  });

  test("ten digits: under a hundred with -, over with +", () => {
    expect(birthDateOf("800223-7538", today)).toBe("1980-02-23");
    expect(birthDateOf("8002237538", today)).toBe("1980-02-23");
    expect(birthDateOf("250101-1234", today)).toBe("2025-01-01");
    expect(birthDateOf("270101-1234", today)).toBe("1927-01-01");
    expect(birthDateOf("250101+1234", today)).toBe("1925-01-01");
  });

  test("a samordningsnummer has sixty on the day", () => {
    expect(birthDateOf("19800283-7538", today)).toBe("1980-02-23");
    expect(birthDateOf("800283-7538", today)).toBe("1980-02-23");
  });

  test("not a personnummer, or an impossible day, is null", () => {
    expect(birthDateOf("", today)).toBeNull();
    expect(birthDateOf("Anna", today)).toBeNull();
    expect(birthDateOf("19800231-7538", today)).toBeNull();
    expect(birthDateOf("2026-09-04", today)).toBeNull();
  });
});

describe("todayIso", () => {
  test("is the local calendar day", () => {
    expect(todayIso(new Date(2026, 0, 5, 0, 30))).toBe("2026-01-05");
  });
});

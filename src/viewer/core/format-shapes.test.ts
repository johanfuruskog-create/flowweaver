import { describe, expect, test } from "vitest";

import {
  canonicalFormat,
  displayFormat,
  maskFormat,
  maskGrouped,
  maskWithPattern,
  validateFormat,
} from "./format-validators";

/**
 * What a formatted value is stored as, and what it is read as.
 *
 * ## A note on the numbers below
 *
 * `560328-1949` is Luhn-valid; the first version of this file used `-1946`,
 * which is not, and two assertions failed at once — the canonical form was
 * refused by its own validator. The fault was the test data, and the validator
 * catching it is the validator working. Made-up identifiers have to be computed,
 * not invented.
 *
 * ## The fault this is written from
 *
 * `isPersonnummer` strips every non-digit before checking, so `19560328-1949`,
 * `5603281949` and `1956 03 28 1949` all pass — and **whatever was typed is what
 * was stored**. Two residents with the same personnummer left two different
 * strings in `getAnswers()`, and a host matching against a register got one hit
 * and one miss. Validation was thorough and storage was whatever fell out.
 *
 * ## Two forms, on purpose
 *
 * Johan asked for both, and the reason is worth keeping: `19560328-1949` can be
 * checked against the card in your hand, and `195603281949` cannot. So the
 * stored form is comparable and the read form is legible, and neither is asked
 * to be the other.
 */

describe("vad som lagras", () => {
  test.each([
    ["19560328-1949", "195603281949"],
    ["195603281949", "195603281949"],
    ["1956 03 28 1949", "195603281949"],
    ["560328-1949", "195603281949"],
  ])("personnummer %s lagras som %s", (typed, stored) => {
    expect(canonicalFormat("personnummer", typed)).toBe(stored);
  });

  test("ett tiosiffrigt nummer får sitt århundrade", () => {
    /*
     * `560328` is 1956 for anybody alive and 2056 for a child born this century.
     * Deciding it once, here, is the whole point of a canonical form — leaving it
     * to whoever reads the value later is how two systems disagree about one
     * person.
     */
    expect(canonicalFormat("personnummer", "560328-1949")).toBe("195603281949");
  });

  test.each([
    ["556036-0793", "5560360793"],
    ["5560360793", "5560360793"],
  ])("organisationsnummer %s lagras som %s", (typed, stored) => {
    expect(canonicalFormat("organisationsnummer", typed)).toBe(stored);
  });

  test("postnummer lagras utan mellanrum", () => {
    expect(canonicalFormat("postnummer", "123 45")).toBe("12345");
  });

  test.each(["email", "phone", "regex", undefined])(
    "%s rörs inte alls",
    (format) => {
      /*
       * A phone number has no single correct form without a country code, an
       * email address must never be touched, and a regex has no shape by
       * definition. Passing them through is a decision, not an omission.
       */
      expect(canonicalFormat(format, " Anna@Exempel.se ")).toBe(" Anna@Exempel.se ");
    },
  );
});

describe("vad som visas", () => {
  test.each([
    ["195603281949", "19560328-1949"],
    ["19560328-1949", "19560328-1949"],
    ["560328-1949", "19560328-1949"],
  ])("%s visas som %s", (stored, shown) => {
    expect(displayFormat("personnummer", stored)).toBe(shown);
  });

  test("organisationsnummer och postnummer likaså", () => {
    expect(displayFormat("organisationsnummer", "5560360793")).toBe("556036-0793");
    expect(displayFormat("postnummer", "12345")).toBe("123 45");
  });

  test("halvfärdigt visas som det skrevs, inte som en lögn", () => {
    // Six digits are not a personnummer, and dressing them as one would say they
    // were. The mask below is what helps somebody mid-typing.
    expect(displayFormat("personnummer", "195603")).toBe("195603");
  });
});

describe("masken medan någon skriver", () => {
  test("bindestrecket dyker upp när det finns siffror på båda sidor", () => {
    expect(maskFormat("personnummer", "195603281", 9).value).toBe("19560328-1");
  });

  test("och inte innan dess", () => {
    expect(maskFormat("personnummer", "19560328", 8).value).toBe("19560328");
  });

  test("markören hamnar efter samma siffra som förut", () => {
    /*
     * Where masks usually break: re-rendering the string throws the caret to the
     * end and the next keystroke lands in the wrong place. So it is counted in
     * digits before it, never in characters.
     */
    const after = maskFormat("personnummer", "1956032819", 4);

    expect(after.value).toBe("19560328-19");
    // Four digits in is still four digits in, separators or not.
    expect(after.value.slice(0, after.caret).replace(/\D/g, "")).toHaveLength(4);
  });

  test("markören efter bindestrecket räknas i siffror, inte i tecken", () => {
    const after = maskFormat("personnummer", "195603281949", 9);

    expect(after.value).toBe("19560328-1949");
    expect(after.value.slice(0, after.caret).replace(/\D/g, "")).toHaveLength(9);
  });

  test("mer än formen rymmer kastas, i stället för att växa", () => {
    expect(maskFormat("personnummer", "1956032819497777", 16).value).toBe("19560328-1949");
  });

  test("postnummer får mellanrum, organisationsnummer bindestreck", () => {
    expect(maskFormat("postnummer", "12345", 5).value).toBe("123 45");
    expect(maskFormat("organisationsnummer", "5560360793", 10).value).toBe("556036-0793");
  });

  test.each(["email", "phone", undefined])("%s maskas inte", (format) => {
    expect(maskFormat(format, "anna@exempel.se", 5)).toEqual({
      value: "anna@exempel.se",
      caret: 5,
    });
  });
});

describe("och valideringen håller med om formerna", () => {
  test("den lagrade formen är giltig", () => {
    // A canonical form that its own validator rejects would be a trap: the value
    // is stored, reloaded and refused.
    expect(validateFormat("personnummer", undefined, canonicalFormat("personnummer", "560328-1949"))).toBeNull();
    expect(validateFormat("postnummer", undefined, canonicalFormat("postnummer", "123 45"))).toBeNull();
  });

  test("och den visade formen också", () => {
    expect(validateFormat("personnummer", undefined, displayFormat("personnummer", "195603281949"))).toBeNull();
  });
});

/*
 * De här mätte `maskThousands`, som var den av två kopior som bar
 * språkregeln — och den kopia produkten inte anropade. Funktionerna är en nu,
 * så testerna pekar på den som blev kvar. Se `grouped-amount-locale.test.ts`
 * för felet som gjorde det nödvändigt.
 */
describe("grupperade belopp medan man skriver", () => {
  test("nollorna går att räkna utan att räkna dem", () => {
    /*
     * The reason this exists, in Johan's words: with large amounts he sometimes
     * cannot tell 60000 from 600000. The mistake happens while looking at the
     * field, so a confirmation printed underneath does not catch it.
     */
    expect(maskGrouped("60000", 5, "sv").value).toBe("60 000");
    expect(maskGrouped("600000", 6, "sv").value).toBe("600 000");
  });

  test("separatorerna flyttar sig medan talet växer", () => {
    // Unlike an identifier, an amount is grouped from the right, so every
    // keystroke moves all of them.
    expect(maskGrouped("6000", 4, "sv").value).toBe("6 000");
    expect(maskGrouped("6000000", 7, "sv").value).toBe("6 000 000");
  });

  test("markören står kvar vid sin egen siffra", () => {
    const after = maskGrouped("600000", 2, "sv");

    expect(after.value.slice(0, after.caret).replace(/\D/g, "")).toHaveLength(2);
  });

  test("decimaler rörs inte", () => {
    expect(maskGrouped("12345,5", 7, "sv").value).toBe("12 345,5");
    // Skriven som språket skriver den: fältet visar samma form som värdet
    // sedan visas i, i stället för två stavningar av ett tal.
    expect(maskGrouped("12345.5", 7, "sv").value).toBe("12 345,5");
  });

  test("engelska grupperar med komma, inte med mellanslag", () => {
    /*
     * The first version hardcoded Swedish, so an English guide would have shown
     * `600 000` in the field and `600,000` in its own result text — one guide
     * answering the same question two ways.
     */
    expect(maskGrouped("600000", 6, "en").value).toBe("600,000");
    expect(maskGrouped("600000", 6, "sv").value).toBe("600\u00a0000");
  });

  test("och där kommat grupperar är det inte ett decimaltecken", () => {
    /*
     * In English `600,5` is six hundred thousand and five typed badly, not six
     * hundred point five. Taking the first comma or period as the decimal mark
     * was right in Swedish and wrong everywhere it differs, so the language
     * decides which character means which.
     */
    expect(maskGrouped("600,5", 5, "en").value).toBe("6,005");
    expect(maskGrouped("600.5", 5, "en").value).toBe("600.5");
  });

  test("och ett tomt fält förblir tomt", () => {
    expect(maskGrouped("", 0, "sv").value).toBe("");
  });
});

describe("en skrivform som mönster", () => {
  test("de tre svenska formerna är mönster nu, med samma resultat", () => {
    /*
     * The equivalence that had to hold before anything new could be built on it:
     * expressing the hardcoded shapes as patterns left every existing test in
     * this file passing unchanged.
     */
    expect(maskWithPattern("########-####", "195603281949", 12).value).toBe("19560328-1949");
    expect(maskWithPattern("### ##", "12345", 5).value).toBe("123 45");
  });

  test("och en struktur vi inte kan räkna på får ändå en form", () => {
    /*
     * The reason this exists. An American social security number and a British
     * national insurance number have shapes we can write down and check digits
     * we cannot verify — a pattern gives the first without pretending to the
     * second.
     */
    expect(maskWithPattern("###-##-####", "123456789", 9).value).toBe("123-45-6789");
    expect(maskWithPattern("AA ## ## ## A", "QQ123456C", 9).value).toBe("QQ 12 34 56 C");
  });

  test("bokstäver och siffror hamnar i sina egna platser", () => {
    // A digit typed where the pattern wants a letter is dropped rather than
    // wedged in, so the shape stays true to what it claims.
    expect(maskWithPattern("AA ##", "1QQ12", 5).value).toBe("QQ 12");
  });

  test("separatorn kommer först när det finns något efter den", () => {
    expect(maskWithPattern("###-##", "123", 3).value).toBe("123");
    expect(maskWithPattern("###-##", "1234", 4).value).toBe("123-4");
  });

  test("och markören står kvar vid sitt eget tecken", () => {
    const after = maskWithPattern("###-##-####", "123456789", 4);

    expect(after.value.slice(0, after.caret).replace(/\D/g, "")).toHaveLength(4);
  });

  test("mer än mönstret rymmer kastas", () => {
    expect(maskWithPattern("###-##", "1234567890", 10).value).toBe("123-45");
  });
});

import { describe, expect, test } from "vitest";

import { answerField, answerList, answerText, isAnswerEmpty, readPath } from "./answer-values";

/**
 * Svarsvärdet: en sträng, en lista, eller en lista med delar.
 *
 * Testerna är skrivna kring de två fel som gjorde det här nödvändigt — en
 * regel som jämförde mot hela strängen, och två parallella listor som hölls i
 * takt av index — plus den bakåtvända läsningen som gör att ett gammalt svar
 * från en värd inte tyst blir ett enda långt värde.
 */

describe("answerList — det man jämför mot", () => {
  test("ett värde är en lista med ett", () => {
    expect(answerList("SE")).toEqual(["SE"]);
  });

  test("en lista är sig själv", () => {
    expect(answerList(["SE", "DK"])).toEqual(["SE", "DK"]);
  });

  test("objekt läses på sitt namnfält", () => {
    expect(answerList([{ label: "Danmark", value: "DK" }])).toEqual(["Danmark"]);
  });

  test("och radbrytningar läses fortfarande, för gamla svar", () => {
    /*
     * Skrivs aldrig, läses alltid. En värd kan ha sparat undan ett svar innan
     * listorna fanns, och det svaret ska inte bli ett enda värde som ingen
     * regel matchar — vilket var precis felet som ledde hit.
     */
    expect(answerList("Danmark\nTyskland")).toEqual(["Danmark", "Tyskland"]);
  });

  test("tomma poster räknas inte", () => {
    // Ett tomt värde matchar ett tomt villkorsvärde, och då blir grenen sann
    // för alla som inte svarat — den bredaste grenen som finns, av ett snedsteg.
    expect(answerList(["SE", "", "  "])).toEqual(["SE"]);
    expect(answerList("\n\n")).toEqual([]);
    expect(answerList([{ label: "" }])).toEqual([]);
  });

  test("och ingenting är ingenting", () => {
    expect(answerList(undefined)).toEqual([]);
  });
});

describe("answerField — delen ur varje objekt", () => {
  test("plockar ut koderna", () => {
    expect(
      answerField([{ label: "Danmark", value: "DK" }, { label: "Tyskland", value: "DE" }], "value"),
    ).toEqual(["DK", "DE"]);
  });

  test("en lista med strängar har inga fält", () => {
    expect(answerField(["DK"], "value")).toEqual([]);
  });

  test("och ett objekt utan fältet hoppas över i stället för att bli tomt", () => {
    /*
     * Ett tomt värde i listan vore värre än en kortare lista: det matchar ett
     * tomt villkor och ser besvarat ut.
     */
    expect(answerField([{ label: "Statslös" }, { label: "Danmark", value: "DK" }], "value")).toEqual([
      "DK",
    ]);
  });
});

describe("answerText — det man visar", () => {
  test("ett värde visas som det är", () => {
    expect(answerText("Danmark")).toBe("Danmark");
  });

  test("flera skiljs med komma, inte radbrytning", () => {
    /*
     * Kommat är inte nytt: svarsposten och trailen har alltid visat flera val
     * så. Radbrytningen var lagringen, aldrig något någon läste.
     */
    expect(answerText(["Danmark", "Tyskland"])).toBe("Danmark, Tyskland");
  });

  test("objekt visas på sitt namnfält", () => {
    expect(answerText([{ label: "Danmark", value: "DK" }])).toBe("Danmark");
  });

  test("och ett gammalt radbrutet svar visas som flera", () => {
    expect(answerText("Danmark\nTyskland")).toBe("Danmark, Tyskland");
  });

  test("men en text med radbrytningar som är ett svar rörs inte i onödan", () => {
    // Ett fritextsvar utan radbrytning ska aldrig gå genom listlogiken alls.
    expect(answerText("Jag bor på Storgatan 1")).toBe("Jag bor på Storgatan 1");
  });
});

describe("isAnswerEmpty", () => {
  test("tomt är tomt", () => {
    expect(isAnswerEmpty(undefined)).toBe(true);
    expect(isAnswerEmpty("")).toBe(true);
    expect(isAnswerEmpty("   ")).toBe(true);
    expect(isAnswerEmpty([])).toBe(true);
  });

  test("och något är inte det", () => {
    expect(isAnswerEmpty("nej")).toBe(false);
    expect(isAnswerEmpty(["SE"])).toBe(false);
    expect(isAnswerEmpty([{ label: "Danmark" }])).toBe(false);
  });
});

describe("ett ensamt svar som har delar", () => {
  test("läses på sitt namnfält", () => {
    expect(answerText({ label: "Danmark", value: "DK" })).toBe("Danmark");
    expect(answerList({ label: "Danmark", value: "DK" })).toEqual(["Danmark"]);
  });

  test("och delen går att be om", () => {
    expect(answerField({ label: "Danmark", value: "DK" }, "value")).toEqual(["DK"]);
  });

  test("ett objekt utan namn är tomt", () => {
    expect(isAnswerEmpty({ value: "DK" })).toBe(true);
  });
});

describe("readPath — att namnge en del", () => {
  const svar = {
    land: [{ label: "Danmark", value: "DK" }, { label: "Tyskland", value: "DE" }],
    plats: { label: "Stortorget", geo: '{"type":"Point"}' },
    namn: "Anna",
  };

  test("utan punkt är det hela svaret", () => {
    expect(readPath(svar, "namn")).toBe("Anna");
  });

  test("en del av ett ensamt svar är ett värde", () => {
    // Delen har samma antal som helheten: ett svar ger ett värde, flera ger flera.
    expect(readPath(svar, "plats.geo")).toBe('{"type":"Point"}');
  });

  test("och delen ur var och en när svaret är flera", () => {
    /*
     * Det här är hela skälet att kodvariabeln fanns: ett villkor kunde inte
     * säga "kod-delen av land", så delen fick en egen variabel och de två
     * hölls i takt för hand.
     */
    expect(readPath(svar, "land.value")).toEqual(["DK", "DE"]);
  });

  test("en del som inte finns är ingenting, inte tomt", () => {
    // Skillnaden spelar roll: ett tomt värde matchar ett tomt villkor.
    expect(readPath(svar, "land.postnummer")).toEqual([]);
    expect(readPath(svar, "namn.value")).toBeUndefined();
    expect(readPath(svar, "saknas.value")).toBeUndefined();
  });

  test("antalet i en lista är en härledd del, aldrig lagrad (story 084)", () => {
    /*
     * En sida som upprepas lagrar bara listan. `barn.count` räknas här så
     * att antalet aldrig kan glida ifrån listan — och det är en sträng, som
     * varje annat tal i ett svar.
     */
    expect(readPath(svar, "land.count")).toBe("2");
    expect(readPath({ barn: [] }, "barn.count")).toBe("0");
    expect(readPath({ ja: ["a", "b", "c"] }, "ja.count")).toBe("3");
    // Ett ensamt svar är inget att räkna: `plats.count` är delen med det namnet.
    expect(readPath(svar, "plats.count")).toBeUndefined();
    expect(readPath(svar, "namn.count")).toBeUndefined();
  });

  test("summan av ett fält i en lista härleds, som antalet (story 091)", () => {
    /*
     * `blankett.antal.sum` är summan av `antal` i varje post — 2 + 1 blev
     * "2 blanketter" i mejlet tills den fanns. Läses som uträkningen läser
     * ett tal (decimalkomma godtas), och det som inte är ett tal räknas inte
     * med. En sträng, som antalet.
     */
    const blanketter = { blankett: [{ antal: "2" }, { antal: "1" }, { antal: "0,5" }, { antal: "" }, { antal: "x" }] };
    expect(readPath(blanketter, "blankett.antal.sum")).toBe("3.5");
    expect(readPath({ blankett: [] }, "blankett.antal.sum")).toBe("0");
    // Ett fält som saknas i varje post summerar till noll — ingen post bär det.
    expect(readPath(blanketter, "blankett.pris.sum")).toBe("0");
    // Utanför en lista finns ingen summa: ett tal, en text, ett par.
    expect(readPath({ antal: "2" }, "antal.sum")).toBeUndefined();
    expect(readPath(svar, "plats.sum")).toBeUndefined();
    // Koder är inte tal: summan av dem är noll, inte ett fel.
    expect(readPath(svar, "land.value.sum")).toBe("0");
  });

  test("ett uppslag i en post är ett par, och läses som sin etikett (story 090)", () => {
    /*
     * Posten lagrade bara etiketten och tappade koden, så valet kunde inte
     * visas igen efter Lägg till. Nu ligger paret i posten — och läsarna
     * som frågar efter en del ur varje post får etiketten, aldrig ett objekt
     * som blir "[object Object]" i en text.
     */
    const poster = [
      { namn: { label: "Ansökan om bygglov", value: "bygglov" }, antal: "2" },
      { namn: "Fritt skrivet", antal: "1" },
    ];
    expect(readPath({ blankett: poster }, "blankett.namn")).toEqual(["Ansökan om bygglov", "Fritt skrivet"]);
    expect(readPath({ blankett: poster }, "blankett.count")).toBe("2");
    expect(answerText(poster[0]!.namn)).toBe("Ansökan om bygglov");
  });
});

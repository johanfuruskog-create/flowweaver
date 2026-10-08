/**
 * A complete Finnish pack for the viewer — the file a host would write.
 *
 * ## Why it is a file
 *
 * Two keys inline is how a pack starts, and it is the wrong shape for a
 * language you actually offer: a translator cannot be handed a fragment of
 * setup code, and a diff of it says nothing. One file per language, exporting
 * one object, is the form that survives — it can be reviewed, versioned and
 * replaced without touching the wiring.
 *
 * ## Why the viewer only
 *
 * Fifty keys covers everything a resident meets. The tool's own 446 are a
 * separate job and never a condition for this one: translating the content into
 * a language must never require the tool to be translated into it. That is why
 * a pack has two halves and why this file fills one of them.
 *
 * ## What it is for
 *
 * It runs the language example. `src/gates/locale-packs-mirror-viewer.test.ts`
 * holds it to every viewer key, so the page cannot quietly become a
 * demonstration of a partial pack while claiming to be a complete one — the partial case has its own
 * demonstration, in Arabic, and the difference between them is the lesson.
 *
 * The Finnish is our own and has not been through a native reviewer. It is
 * demonstration text on a page about mechanics, not a translation to ship.
 */
export const FINNISH_VIEWER_PACK: Record<string, string> = {
  "step.number": "Vaihe",
  "step.result": "Tulos",
  "step.untitled": "Nimetön solmu",
  // Ohitettu sivu vaiheluettelossa, vain ruudunlukijalle (step.done).
  "step.done": "valmis",

  "nav.next": "Seuraava",
  "nav.submit": "Lähetä",
  "preview.regionLabel": "Oppaan esikatselu",
  "preview.previousAnswers": "Aiemmat vastaukset",
  "preview.wayBack": "Tähänastinen polku",
  "preview.noAnswer": "Ei vastausta",
  // Edistymispalkki (story 116). Suomessa prosenttimerkin edessä on välilyönti,
  // kuten ruotsissa.
  "progress.label": "Näin pitkälle olet päässyt",
  "progress.value": "{percent} %",
  "field.onlyDigits": "Tähän kirjoitetaan vain numeroita.",
  "field.onlyLettersAndDigits": "Tähän kirjoitetaan vain kirjaimia ja numeroita.",
  "field.pasteAmbiguous": "Liitetty teksti sisältää useita mahdollisia arvoja. Liitä yksi kerrallaan.",
  "nav.previous": "Edellinen",
  "nav.restart": "Aloita alusta",
  "nav.newCase": "Uusi asia",

  "repeat.legend": "{word} {n}",
  "repeat.add": "Lisää {word}",
  "repeat.remove": "Poista {word} {n}",
  "repeat.removed": "{word} {n} poistettiin.",
  "validation.repeatMin": "Lisää vähintään {n}.",
  "validation.repeatMax": "Enintään {n} voidaan antaa.",
  "validation.selectOption": "Valitse vastaus ennen jatkamista.",
  "validation.chooseOption": "Valitse vaihtoehto.",
  "validation.required": "Tämä kenttä on pakollinen.",
  "validation.fieldRequired": "Kenttä ”{field}” on pakollinen.",
  "validation.choiceRedo": "Valintasi kentässä ”{field}” on tehtävä uudelleen.",
  "validation.alreadyGiven": "Tämä vastaus on jo annettu toisessa toistossa. Anna toinen.",
  "validation.noOptionsLeft": "Valittavia vaihtoehtoja ei ole. Poista tämä toisto tai muuta aiempaa valintaa.",
  "validation.alreadyChosen": "Tämä vaihtoehto on jo valittu toisessa toistossa. Valitse toinen.",
  "validation.fieldUntouched": "Muuta kenttää {field} ennen kuin jatkat.",
  "dialog.untouched.message": "Et ole muuttanut kenttää {field}, jonka arvo on {value}. Haluatko silti jatkaa?",
  "dialog.untouched.continue": "Jatka",
  "dialog.untouched.change": "Muuta",
  "validation.chooseFromList": "Valitse jokin listan ehdotuksista.",
  "validation.optionMissing": "Vaihtoehtoa ”{value}” ei ole kysymyksessä.",
  "validation.minLength": "Kirjoita vähintään {n} merkkiä.",
  "validation.maxLength": "Kirjoita enintään {n} merkkiä.",
  "validation.selectAtLeastOne": "Valitse vähintään yksi vaihtoehto.",
  "validation.selectAtLeast": "Valitse vähintään {n} vaihtoehtoa.",
  "validation.selectAtMost": "Valitse enintään {n} vaihtoehtoa.",
  "validation.number.invalid": "Anna kelvollinen luku.",
  "validation.number.min": "Arvon on oltava vähintään {n}.",
  "validation.number.max": "Arvo saa olla enintään {n}.",
  "validation.format.email": "Anna kelvollinen sähköpostiosoite.",
  "validation.format.phone": "Anna kelvollinen puhelinnumero.",
  "validation.format.personnummer": "Anna kelvollinen henkilötunnus.",
  "field.notApplicable": "Ei koske minua",
  "field.dontKnow": "En osaa sanoa",
  "field.enterDate": "Valitse päivämäärä",
  "field.dateFormat": "VVVV-KK-PP",
  "map.pick": "Valitse paikka kartalta",
  "map.change": "Vaihda paikkaa",
  "map.floorLabel": "Osoite tai paikka sanoin",
  "map.notConnected": "Karttavalinta ei ole käytössä täällä — kirjoita paikka sanoin.",
  "map.chosen": "Paikka valittu: {label}",
  "preview.variables": "Muuttujat ({n})",
  "preview.emptyValue": "tyhjä",
  "validation.file.required": "Liitä tiedosto jatkaaksesi.",
  "validation.file.type": "Tiedoston on oltava tyyppiä {types}.",
  "validation.file.size": "Tiedosto saa olla enintään {n} Mt.",
  "field.attach": "Valitse tiedosto",
  // Story 108 (11/9): exempelfotot värden bjuder på.
  "file.useExample": "Käytä esimerkkikuvaa",
  "file.exampleFailed": "Esimerkkikuvaa ei voitu hakea. Valitse oma kuva.",
  "marking.hint": "Napauta kuvaa merkitäksesi. Napauta merkintää poistaaksesi sen.",
  "marking.remove": "Poista merkintä {n}",
  "marking.removeShort": "Poista",
  "marking.goto": "Siirry merkintään {n}",
  "marking.describe": "Mitä merkintä {n} näyttää?",
  "marking.clear": "Tyhjennä merkinnät",
  "marking.count": "{n} merkintää",
  "validation.consent.required": "Sinun on rastitettava ruutu jatkaaksesi.",
  "validation.date.invalid": "Anna olemassa oleva päivämäärä, esimerkiksi 2026-03-01.",
  "validation.date.min": "Anna päivämäärä, joka on aikaisintaan {date}.",
  "validation.date.max": "Anna päivämäärä, joka on viimeistään {date}.",
  "validation.date.afterField": "Päivämäärän on oltava sama tai myöhäisempi kuin {field}.",
  "validation.date.beforeField": "Päivämäärän on oltava sama tai aikaisempi kuin {field}.",
  "validation.format.postnummer": "Anna viisinumeroinen postinumero.",
  "validation.format.organisationsnummer": "Anna kelvollinen organisaationumero.",
  "validation.format.pattern": "Arvon muoto on virheellinen.",

  "counter.remaining": "{n} merkkiä jäljellä",
  "counter.over": "{n} merkkiä liikaa",
  "counter.count": "{n} merkkiä",

  "field.chooseOption": "Valitse vaihtoehto",
  "field.selectPlaceholder": "Valitse…",
  "field.chooseOneOrMore": "Valitse yksi tai useampi",
  // Story 134. Kuten muukin tämän tiedoston suomi: omaa käsialaamme,
  // ei äidinkielisen tarkistama — mekaniikkaa esittelevän sivun tekstiä.
  "field.someOptionsHidden": "Joitakin vaihtoehtoja ei näytetä aiempien vastaustesi perusteella.",
  "field.optionsTakenElsewhere": "Muissa toistoissa valitsemiasi vaihtoehtoja ei näytetä tässä.",
  "field.noOptionsLeft": "Valittavia vaihtoehtoja ei ole juuri nyt.",
  "field.writeAnswer": "Kirjoita vastauksesi",
  "field.required": "(pakollinen)",
  "field.enterNumber": "Anna luku",
  "field.slider": "{label}, liukusäädin",
  "field.stepDown": "Pienennä: {label}",
  "field.stepUp": "Suurenna: {label}",
  "field.unitSuffix": "yksikössä {unit}",
  "field.hint.atLeast": "valitse vähintään {n}",
  "field.hint.exact": "valitse {n}",
  "field.hint.range": "valitse {min}–{max}",
  "field.hint.atMost": "valitse enintään {n}",
  // Monivalinta: valitut vaihtoehdot merkkeinä, ei ctrl-napsautusta.
  "choice.search": "Hae vaihtoehdoista",
  "choice.searchPlaceholder": "Kirjoita hakeaksesi…",
  "choice.chosen": "Valitut",
  "choice.chosenNone": "Ei vielä valintoja",
  "choice.add": "Lisää {label}",
  "choice.remove": "Poista {label}",
  "choice.added": "{label} lisätty. {n} valittu.",
  "choice.addedOne": "{label} lisätty. 1 valittu.",
  "choice.removed": "{label} poistettu. {n} valittu.",
  "choice.removedOne": "{label} poistettu. 1 valittu.",
  // Astras förslag 29/9, inte en finsktalandes granskning. Johan 29/9:
  // ingen granskning planeras — orden står tills en buggrapport säger
  // annat. "vielä … valittavissa" för det som återstår,
  // "hakutulos/hakutulosta" för träffar.
  "choice.left": "Vielä {n} valittavissa",
  "choice.oneLeft": "Vielä 1 valittavissa",
  "choice.matches": "{n} hakutulosta",
  "choice.oneMatch": "1 hakutulos",
  "choice.noMatches": "Ei hakutuloksia haulle {term}",
  "choice.allChosen": "Kaikki vaihtoehdot on valittu",
  "choice.or": "tai",
  "choice.exclusiveCleared": "Ei voi yhdistää muihin valintoihin, joten {removed} poistettiin.",
  "choice.exclusiveRemoved": "{removed} ei voi yhdistää muihin valintoihin, joten se poistettiin.",

  "choice.hint": "Kirjoita vähintään {n} merkkiä hakeaksesi",
  "choice.searching": "Haetaan…",
  "choice.error": "Hakuun ei saatu yhteyttä",

  "image.none": "Kuvaa ei ole asetettu",
  "image.commentCounter": "Kommentti {current}/{total}",

  "preview.recipients": "Vastaanottajat ({n})",
  "preview.recipientMissing": "ei ole luettelossa — menee oletusvastaanottajalle",
  "preview.recipientVisitor": "Kävijän oma osoite, vastauksesta",

  "question.why": "Miksi kysymme tätä?",
  "callout.info": "Tietoa",
  "callout.warning": "Tärkeää",
  "callout.tip": "Vinkki",
  "page.errorSummary": "{n} asiaa on korjattava ennen kuin voit jatkaa",

  "review.change": "Muuta",
  "review.changeAria": "Muuta vastausta kysymykseen {q}",
  "review.changePageAria": "Muuta vastauksia sivulla {q}",
  "review.declarationSend": "Tämä lähetetään, eikä mitään muuta",
  "review.declarationBasis": "Tähän vastaus perustui",

  "submit.sending": "Lähetetään ilmoitustasi …",
  "submit.waiting": "Odotetaan vastausta …",
  "submit.referenceIntro": "Tallenna viitenumero, jos haluat kysyä asiastasi:",
  "submit.whatWasSent": "Tämä lähetettiin",
  /*
   * Översatt 22/9 av Fable, utan finsktalande granskare (Johans beslut: ingen
   * i närheten kan finska). Svenskan och engelskan bytte innebörd samma dag
   * (A7) från *kunde inte lämna in* till *vi kunde inte bekräfta att
   * uppgifterna togs emot*, och den gamla finska meningen sa fel sak. Den
   * här säger rätt sak: "Vi kunde inte bekräfta att dina uppgifter togs emot
   * – dina svar finns kvar. Försök igen." Nästa person som kan finska: läs
   * den här raden först.
   */
  "submit.failed":
    "Emme voineet vahvistaa, että tietosi vastaanotettiin — vastauksesi ovat tallella. Yritä uudelleen.",
  "submit.retry": "Yritä uudelleen",
  // Epäonnistuneen lähetyksen otsikko (Astra 1/10, liite 12). Demonstraatiotekstiä.
  "submit.failedTitle": "Lähetystä ei voitu vahvistaa",
  // Aikaikkuna umpeutunut (A7): tässä ei saa lukea "yritä uudelleen".
  // Demonstraatiotekstiä, kuten koko paketti — ei äidinkielisen tarkistamaa.
  "submit.unconfirmed":
    "Emme voineet vahvistaa, että tiedot otettiin vastaan, ja nyt on kulunut liian kauan, jotta voisit lähettää uudelleen ilman riskiä kahdesta asiasta. Ota yhteyttä vastaanottajaan ja tarkista asia ennen kuin lähetät uudelleen.",

  "flow.deadEndOption": "Vastaus \"{answer}\" ei johda eteenpäin.",
  "flow.deadEndStep": "Tämä vaihe ei johda eteenpäin.",

  // Moottorin rakenteelliset virheet (2026-08-31): ei natiivin puhujan
  // tarkistama, kuten muukaan tämän tiedoston teksti — ks. tiedoston oma
  // huomautus yllä.
  "flow.missingStartNode": "Oppaalla ei ole aloitusvaihetta.",
  "flow.currentNodeMissing": "Nykyistä vaihetta \"{nodeId}\" ei ole olemassa.",
  "flow.nodeMissing": "Vaihetta \"{nodeId}\" ei ole tässä oppaassa.",
  "flow.nodeCannotBeAnswered": "Vaiheeseen \"{nodeId}\" ei voi vastata.",
  "flow.noFreeTextAccepted": "Vaihe \"{nodeId}\" ei ota vastaan vapaata tekstiä.",
  "flow.unsupportedNodeType": "Vaihetyyppiä \"{nodeType}\" ei vielä tueta.",
  "flow.notAPage": "Vaihe \"{nodeId}\" ei ole sivu.",
  "flow.pageDeadEnd": "Tämän sivun Jatka-uloskäynti ei johda eteenpäin.",
  "flow.targetNodeMissing": "Kohdevaihetta \"{nodeId}\" ei ole olemassa.",
  "flow.loopDetected": "Kulku sisältää silmukan vaiheessa \"{nodeId}\".",
  "flow.ruleLoopDetected": "Sääntökulku sisältää silmukan vaiheessa \"{nodeId}\".",
  "flow.exitNotConnected": "Uloskäynti \"{port}\" ei johda eteenpäin.",

  "guide.notTranslated":
    "Tätä opasta ei ole käännetty kielelle {wanted}. Se näytetään kielellä {shown}.",
};

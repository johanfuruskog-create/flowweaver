# Krav

Regler som gäller oavsett vad vi bygger just nu, och som **inte går att läsa ur
koden**. De kommer från omvärlden — en miljö som kräver något, en lag, ett
beslut, eller ett fel som redan kostat oss något.

## Varför den här filen finns

Tre dokument, tre frågor:

| Fil | Svarar på |
| --- | --- |
| `ROADMAP.md` | Vad vi bygger härnäst |
| `LOGG.md` | Vad vi trodde, vad som visade sig stämma |
| **`KRAV.md`** | **Vad som måste gälla, oavsett vad vi bygger** |

Skälet är konkret. `requiredLibs` i Sitevision-modulens `manifest.json` fanns
inte i någon fil som gick att läsa sig till — den fanns i huvudet på den som
sett bygget misslyckas utan den. En AI-session utan minne, eller en kollega som
kommer in om ett halvår, tar bort den och undrar varför bygget dör. Ett krav som
bara finns i ett huvud kan ingen kontrollera.

## Hur den används

Varje krav har en **källa** (varför det gäller) och en **kontroll** (hur man vet
att det hålls). Ett krav utan kontroll är en önskan — då står det uttryckligen
att kontrollen är mänsklig, så att ingen tror att ett grönt bygge bevisar det.

När något nytt byggs: läs igenom rubrikerna här och fråga vilka som berörs.
Går ett krav inte att hålla är det ett beslut som ska diskuteras, inte något som
tyst rundas.

---

## Innehåll och språk

**K1. All text som slutanvändaren ser går via `ui-strings`.**
Knappar, portnamn, valideringstexter, statusbesked. Aldrig hårdkodad svenska i
en komponent.
*Källa:* guiderna ska kunna köras på flera språk, och en text som ligger i en
komponent går inte att översätta.
*Kontroll:* granskning. **Känt undantag:** `PageFieldValidationService` har
hårdkodade svenska meddelanden och ingen språkparameter. Regeln "måste väljas ur
listan" ligger därför i visaren, där `chrome()` finns.

**K2. Editorns gränssnittsspråk är en egen axel från guidens språk.**
`editor-locale` på taggen styr editorn; guidens `locales` styr innehållet. En
redaktör kan arbeta på svenska i en engelsk guide.
*Källa:* värdsidan bestämmer verktygets språk, guiden bestämmer sitt eget.
*Kontroll:* `guide-editor-i18n.browser.test.ts`.

---

## Tillgänglighet

**K3. Ingenting får kräva att man ser färg, hör ljud eller använder pekare.**
Varje interaktiv funktion ska gå att nå från tangentbordet, och information som
bärs av färg ska bäras av något mer.
*Källa:* EN 301 549 — offentlig sektor.
*Kontroll:* per funktion. Minikartan är `aria-hidden` med flit: den bär ingen
egen information och samma navigering finns via scroll, panorering och "Anpassa
till innehåll".

**Skärmläsare med pekgester (VoiceOver på iPad) är ett krav för besökarens
yta, inte för editorn** (Johan 28/9 2026: *"slopa voiceover för editorn helt.
Men visaren ska stödja det"*). Editorn är gjord för skrivbord och ska nås
från tangentbordet och läsas av en skärmläsare där — det är K3 ovan. Mätt
på iPaden 28/9: VoiceOver läser fältet och brickorna (bra), men
genomsläppet för att dra en nod och trefingersvepet över canvasen gör inget,
och det byggs inte runt. Visaren mäts med VoiceOver som förut.

**Färgkontrasten mäts, den granskas inte.** `guide-preview-contrast` och
`guide-editor-contrast` räknar WCAG AA på varje synlig text i båda temana —
visaren i fyra tillstånd, editorn i fyra lägen. Måttet självt är prövat mot
kända värden i `testing/contrast.browser.test.ts`, och kontrollen är prövad
genom att sänka ett token: `--fw-text-secondary` nedtonad ger 1.83:1 och sexton
röda fall.

Undantagen är WCAG:s egna, inte bekvämlighet: inaktiva kontroller (1.4.3
*Incidental*), dold text, och innehåll som avsiktligt tonats ned med opacitet —
canvasens dimning utanför fokus.

Kommentarerna i `tokens.scss` om en granskning gjord för hand ("AA-audit: 2.96 →
3.75") gällde den dag de skrevs. Ett token som ändras ett halvår senare vet
ingenting om dem; mätningen gör det.
**Kontroller som bärs av en form mäts också.** Färgmätningen ovan går igenom
text, alltså 1.4.3. En knapp som identifieras av en ikon i stället för ett ord är
1.4.11 med ett annat krav — 3:1 mot omgivningen — och det mättes ingenstans
förrän ett handtag hamnade i drift på 1,41:1 mot canvasen och någon upptäckte det
genom att titta. `ikonkontrastbrott` sveper varje shadow root i editorn:
**ritar kontrollen sig själv** med en yta eller en kant är det formen som ska
klara 3:1, annars glyfen. Prövad genom att införa felen den ska fånga.

**Tangentbordet mäts med äkta tangenttryck.** `guide-preview-keyboard` och
`guide-editor-keyboard` tabbar igenom komponenterna och kontrollerar att varje
stopp syns, visar att det har fokus, och — på linjära ytor — kommer i
läsordning. `element.focus()` duger inte: det ger fokus men inte alltid
`:focus-visible`, och det är den som avgör om en markering ritas.

Canvasen undantas från ordningskravet med flit. Dess noder ligger på fria
koordinater som redaktören valt, och där är grafens ordning rimligare än var
noderna råkar hamna på skärmen.

Kontrollerna är prövade genom att införa felen de ska fånga: utan fokusring blir
tre kontroller röda, och med omvänd visuell ordning tre stopp.

**Canvasens meny öppnas med `ContextMenu` eller `Shift+F10`** på den markerade
noden. Den var länge bunden enbart till `contextmenu`-händelsen, och fem av dess
sju kommandon — startnod, visa vägar, lossa från mall, ta bort koppling,
kopplingsfärg — finns ingen annanstans. Utan mus var de alltså onåbara, vilket
den här rubriken kräver att de inte är.

Hittat på en iPad, men det var inte en iPad-brist: iPadOS Safari fyrar aldrig
`contextmenu` för ett långtryck, så surfplattan blottade en lucka som lika mycket
gällde ett skrivbord utan mus. *Kontroll:*
`node-editor-context-menu-keyboard.browser.test.ts`, prövad genom fyra
mutationer.

**Kopplingar går att både skapa och komma åt utan pekare.** Att skapa: `Enter`
eller mellanslag på en utgångsport läser upp *"Koppla från: Ja"*, samma på en
ingångsport fullbordar den, och `Escape` avbryter. Det har fungerat hela tiden —
den här rubriken påstod länge motsatsen, och påståendet var helt enkelt fel.

Att komma åt en befintlig: varje linje bär ett handtag mitt på sig som öppnar
kopplingens meny. Handtaget ligger i **källnodens** tabbgrupp, precis som nodens
portar, så canvasen håller ett nodvärde tabbstopp åt gången oavsett hur många
linjer grafen har. *Kontroll:*
`node-editor-connection-handle.browser.test.ts`, prövad genom fyra mutationer —
varav en som gjorde handtaget fokusbart men osynligt, vilket var det verkliga
felet i första utkastet.

**Känd lucka:** att *dra* en koppling med pekaren kräver fortfarande drag, och
det finns ingen tangentbordsväg att flytta en befintlig kopplings ände. Se
`docs/IDEAS.md`.

**K4. Sammansatta kontroller följer sitt ARIA-mönster i sin helhet.**
Halvimplementerad ARIA är sämre än ingen: den lovar en struktur som inte finns.
*Källa:* uppslagsfältets kombinationsruta, byggd efter ARIA 1.2 — och sedan
**ersatt av inbyggda kontroller**, vilket är samma krav en nivå tidigare:
`chip-picker` valde bort `role="combobox"` och `aria-activedescendant` till
förmån för en knapp per alternativ i tabbordningen. Ett mönster man inte skriver
kan man inte skriva halvt. Beslutet och vad det kostade: `docs/LOGG.md`
2026-08-31.
*Kontroll:* `chip-picker-source.browser.test.ts` — antalet annonseras när
sökningen landar, feltillståndet sägs, och fokus lämnar aldrig sökrutan under
ett val (`chip-picker-pointer.browser.test.ts`).

**K5. Rörelse respekterar `prefers-reduced-motion`.**
*Källa:* WCAG 2.3.3 och 2.2.2.
*Kontroll:* granskning; mönstret finns i `node-editor.scss`.

**K6. Det man pekar på är minst 44 × 44 px att träffa.** Knappar, fält,
handtag, reglagets tumme och spår — allt som **besökaren** ska träffa med
ett finger. Måttet gäller träffytan, inte det som syns: en tunn linje får
vara tunn om ytan runt den tar trycket. Det gäller inte länkar i löpande
text (WCAG:s eget undantag). **Gäller besökarens yta, inte editorns fält** (Johan
15/9 2026, när tillgänglighetsrollen mätte panelens fält till 38 px):
editorn är gjord för skrivbord och visas inte i mobilläge. **Undantaget
nyanserat 25/9 2026** (Johan, efter en förmiddags mätning av panelen med
finger på iPad): en tät rad av ikonknappar i editorn — verktygsraden i
textfältet, brickans meny — ska hålla 44 px, för det är precis den
situation regeln finns för. Ett vanligt textfält i panelen får vara 38 px.
*Källa:* WCAG 2.5.5 (44 px, AAA) — valt framför 2.5.8 (24 px, AA) eftersom
visaren körs på telefoner av personer som inte valt den. Johan 5/9 2026, om
reglaget: *"För mobil måste man ha extra stora ytor att dra i."*
*Kontroll:* granskning. Måttet lever i dag som `min-height: 44px` på visarens
kartval, uppslagsknapp, upprepningsknappar, i väljaren, och sedan 15/9 på
kortets Föregående/Nästa och dialogens Ändra/Gå vidare (berättelse 118,
kriterium 7 — mätt på riktiga `claim.html`, 390 px: 45 px både före och efter,
så ingen träffyta var faktiskt för liten i produktion; en tidigare mätning mot
en ostylad testrigg utan visarens typsnitt visade 42 px och var missvisande.
Raden skrivs ut ändå, av samma skäl grannarna redan har den: en höjd buren
bara av padding och radhöjd har inget som säger ifrån den dag typsnittet
ändras) — utspritt, och
ingenting mäter det. Nästa steg är en mätning över
visarens kontroller i stil med `guide-preview-keyboard`, byggd när reglaget
byggs (`docs/IDEAS.md`, *Reglage för talfrågor*), och prövad genom att
krympa en knapp.

---

## Data och förtroende

**K6. En redaktörs guide får aldrig gå förlorad genom en åtgärd hen inte bett om.**
Att öppna en dialog och stänga den ska lämna guiden orörd.
*Källa:* Sitevisions `_setValues` tilldelade `value` på varje namngivet fält, och
ett objekt blev strängen `"[object Object]"`. En redaktör som öppnade dialogen
och sparade utan att röra editorn skrev över sin guide med skräp.
*Kontroll:* grafen plockas **ur** värdena innan Sitevision fyller formuläret. Se
`integrations/sitevision-webapp/src/config/config.js`. **Ingen automatisk
kontroll** — kräver Sitevision.

**K6b. Editorn får inte tyst kasta data den inte känner igen.**
Ett fält som någon annan lagt i guiden ska antingen bevaras eller avvisas med
besked — aldrig försvinna under tystnad.
*Källa:* prövat 2026-08-01. `ansvarig` i roten och `settings.vardData` var båda
borta efter `importGraphJson` → `exportGraphJson`, och importen lyckades utan
invändning.
*Kontroll:* `graph-io-preserve.test.ts` — okända rotnycklar och okända nycklar
inuti `settings` går oförändrade genom import och export. Bärarfältet `extra` är
internt och syns aldrig i JSON:en.

Rättat 2026-08-01. Principen är **JSON in = JSON ut**: biblioteket bevarar det
det inte förstår i stället för att tolka eller kasta det.

**K6c. Guiden bär det någon författat, inte det plattformen iakttar.**

*Plattformen iakttar* och äger: vem som skapat och ändrat, när det skedde,
behörigheter, publiceringsstatus. Sådant kopieras aldrig in i guiden — två
kopior kan säga olika saker, och kopian blir fel så fort något ändras via ett
annat gränssnitt.

*Någon författar* och guiden bär: namn, beskrivning, ansvarig, allt innehåll.
Det reser med guiden när den exporteras, och det finns ingen annanstans att
hämta det ifrån — en inbäddning med enbart en script-tagg har ingen
innehållsmodell alls.

*Källa:* beslut 2026-08-01. Gränsen prövades på "ansvarig", som ser ut som
plattformsdata men inte är det: sidans ägare och den som ansvarar för vad guiden
*svarar* är ofta olika funktioner i en kommun.
*Kontroll:* granskning vid varje nytt fält i `GraphData` eller `GuideSettings` —
frågan är om uppgiften **iakttas** eller **författas**.

**Medvetet undantag:** `senast ändrad`. En tidsstämpel iakttas, men en guide som
exporteras och läses in någon annanstans behöver bära sin egen ålder — då finns
ingen plattform kvar att fråga. Undantaget står här, uttryckligt, i stället för
att principen tänjs tyst. Stämpeln sätts vid sparning och export, aldrig vid
varje ändring, och den duger till "ungefär hur gammal" — inte som bevis för vad
som hände först, eftersom klockan är användarens.

**K6d. Biblioteket sparar ingenting — det signalerar.**
Var en guide lagras, hur många versioner som behålls och hur länge, avgörs av
värdsystemet. Editorn talar om *när* något är värt att spara och lämnar över.
*Källa:* beslut 2026-08-01. Versioner är appData, och biblioteket har varken
lagring, behörigheter eller gallringsregler att förhålla sig till.
*Kontroll:* granskning. Uppfyllt: biblioteket lagrar ingenting och skickar
grafen vid varje ändring, så värden kan skriva när den vill. Sitevision-exemplet
skriver till det dolda fältet, demosidans skal till webbläsarens lagring — båda
är värdens beslut, inte bibliotekets.

**Kontraktet är `graph-changed`.** Den avfyras vid varje ändring och bär hela
grafen. Värden avgör om det leder till en skrivning, en cache eller ingenting.

Att ingen händelse betyder "nu är det värt att behålla som en version" är
avsiktligt: den punkten äger värden. I Sitevision är det när redaktören trycker
Spara i inställningsdialogen.

*Vägledning till den som bygger en värd:* händelsen kommer per ändring, och vid
live-skrivning i ett fält betyder det per tangenttryck. Skriv därför till en
**buffert**, inte till lagringen.

Sitevision-exemplet visar mönstret: `config.js` skriver till ett dolt formulärfält
vid varje ändring, vilket är gratis eftersom det bara är DOM. Ingenting lagras
förrän redaktören trycker Spara i inställningsdialogen — då läser Sitevision
fältet och skriver till appData. Bufferten är alltså fältet, och sparpunkten är
värdens egen knapp.

En värd utan en sådan buffert — en som skriver rakt mot ett API — behöver skapa
en. Att skicka varje `graph-changed` vidare är det enda som är fel här.

**K6e. Biblioteket lagrar aldrig guiden.**
Persistensen ägs av värden. Det gör att värdens *Avbryt* fungerar: kastas
bufferten finns ingenting kvar om guiden någon annanstans.
*Källa:* mätt 2026-08-02 i det byggda paketet. Biblioteket rör **ingen** lagring
alls — noll träffar på `localStorage`, `sessionStorage` och `indexedDB` i både
visar- och editorbundeln. Demosidans autosparning ligger i `main.ts`, alltså i
appskalet, inte i komponenterna.

Kravet har skärpts sedan det skrevs. Det stod förut att bibliotekets enda
skrivningar var en avfärdad knuff och nodmallsbiblioteket. Mallbiblioteket
slutade skriva i berättelse 006, temavalet visade sig vara en tredje som aldrig
stod nämnd, och knuffen är nu den fjärde som flyttat ut. Regeln är därför
enklare än förut: biblioteket **anropar värden med data**, och värdsystemet
avgör vad som händer sedan.

*Kontroll:* `smoke:lib` läser de publicerade bundlarna och faller om ett
lagrings-API dyker upp. Textkontroll och inte körning, eftersom en skrivning kan
ligga bakom en gren som ett smoke-test aldrig når.

**Undantag att känna till:** nodmallar (`template-library.ts`) lagras inte av
biblioteket alls — värden sätter listan och lyssnar på ändringar, precis som för
guiden. De mallar en guide *använder* bäddas in i `settings.nodeTemplates` vid
export, så guiden är självförsörjande även där biblioteket saknar dem.

En mall är en **grundtyp plus sparade värden**, inte en egen nodtyp. Formen ägs
av oss och ärvs levande; värdena ägs av kunden. Se
[007](./STORIES/007-ett-falt-ett-stalle.md) och K12b.

**K7. Äldre guider måste gå att läsa in.**
Ett formatbyte kräver en migrering och en versionshöjning, aldrig en tyst
ändring.
*Källa:* guider ligger sparade i kundernas installationer.
*Kontroll:* `graph-migrations.test.ts` och den frysta kontraktssnapshoten i
`node-contract.test.ts`, som kräver ett medvetet `-u` för att ändras och
klassar brytande ändringar för sig. `guide-editor-migration.browser.test.ts`
vaktar att en gammal guide som sätts som *objekt* också lyfts, och
`guide-preview-migration.browser.test.ts` att **visaren** gör detsamma.

Den senare tillkom efter en mätning: kravet kontrollerades bara i editorn, och
visaren migrerade inte alls. En v3-sida satt på `<guide-preview>` gav `fält=0`
mot `fält=2` för samma graf migrerad — alltså en tom sida för invånaren, utan
felmeddelande, i just den väg en publicerad guide tar. Migreringen bor nu i
`accepted-graph.ts` och nås av tre dörrar: editorn, visaren och den simulerade
BFF:en.

**Två sorters migreringar, och skillnaden avgör var de får köras:**

*Strukturella* är formvaktade — v3→v4 rör bara sidor som faktiskt bär
`firstLabel`. De är ofarliga att köra på färsk data.

*Gissande* kan inte skilja gammalt från nytt. v1→v3 gör bara strängar till
översättbara kartor, och en modern graf med en bar sträng ser likadan ut som en
gammal. Kör de på färsk data normaliseras text redaktören just skrivit.

Därför antas en graf **utan** versionsfält vara v3 och inte v1 när den kommer som
ett objekt: grafen i minnet bär ingen version, så ångra och funktionsnivåbyte
skulle annars köra hela kedjan varje gång. En *fil* utan version är däremot
verkligt gammal och tolkas som v1, som förut.

**K8. Fältvärden som ska kunna användas vidare bär en kod, inte bara en etikett.**
*Källa:* en efterföljande tjänst vill ha `1880`, inte "Örebro".
*Kontroll:* `guide-preview-lookup.browser.test.ts`.

---

## Säkerhet och omvärld

**K9. Anrop till tredje part sker i BFF:en, aldrig i klienten.**
Nycklar, avtal och kvoter hör hemma på servern. En guide som körs inbäddad på en
kommunsida får aldrig bära en API-nyckel.
*Källa:* `service-call`-noden och `docs/UPPSLAG-KONTRAKT.md`.
*Kontroll:* granskning. Kontrakten är skrivna så att adaptern ligger hos den som
äger nyckeln.

**K10. En inbäddad modul får inte ändra sidan den står på.**
Inga globala selektorer, inget `color-scheme` på `:root`, ingen `!important` mot
värdsidans element.
*Källa:* `tokens.css` på `:root` gjorde värdsidans rullister och bakgrunder
svarta i mörkt OS-läge.
*Kontroll:* `scripts/generate-tokens.mjs` avbryter om något `:root` blir kvar
efter scopningen.

**K12b. Vi äger renderingen.**
Kunden väljer *vad* en nod innehåller, aldrig *hur* den ritas. En nodtyp är vår;
en mall är samma nodtyp med sparade värden.

En mall registreras därför aldrig som nodtyp: en nod som skapats ur en mall blir
en nod av **grundtypen** och bär mallens nyckel som härkomst i `template`.
Registret innehåller bara det vi själva äger.

*Källa:* beslut 2026-08-02. Det är renderingen som bär våra löften:
tillgängligheten (**K3**, **K4**) håller för att vi skrivit kontrollerna,
saneringen (**K11**) för att allt innehåll passerar vår renderare, temat för att
noderna använder våra tokens, och migreringarna (**K7**) för att vi förstår
formerna.

Att erbjuda kunden rendering är inte en liten utökning: det kräver ett
mallspråk, en sandlåda, escaping-regler och ett tillgänglighetskontrakt som
någon annan ska uppfylla. Varje löfte ovan blir då ett förbehåll.

*Kontroll:* `node-templates.test.ts`. En mall bär bara `type`, `label`, `icon`,
`base` och `values` — det finns ingen plats i modellen att lägga en egen form,
och ett test visar att `getNodeType(mallens nyckel)` aldrig ger något.
`guide-editor-broken-template.browser.test.ts` visar följden: en nod vars mall
tagits bort ritas som en riktig nod, behåller sina portar och heter grundtypens
namn. Se [`STORIES/007`](STORIES/007-ett-falt-ett-stalle.md).

**K12d. Lägena är en stege, och förmåga är opt in.**
`administrator` ⊃ `edit` ⊃ `translator` ⊃ `readonly`. Standard är `readonly`:
värden **ber** om förmågan i stället för att råka få den. Ju mer förmåga, desto
färre personer.

*Källa:* beslut 2026-08-02. Först byggdes administratören som en egen axel
(`editor-role`), men tre av fyra naturliga roller — läsare, översättare,
redaktör — var redan lägen. Att just den fjärde blev en egen axel var svårt att
förklara och ett tecken på att uppdelningen var fel, inte att verkligheten var
det. Med `administrator` som stegens **topp** håller **K12c**: varje steg nedåt
tar bort.

Vi namnger förmågenivåer, inte jobbtitlar. Vad kunden kallar sina människor är
deras sak, och läget visas aldrig i gränssnittet — det tar bara bort kontroller.

Steget betyder därmed inte bara *"får röra det gemensamma"* utan *"får fatta
beslut som binder mer än den här guidens innehåll"*. Vilka språk en guide
erbjuds på hör dit: att erbjuda en guide på somaliska är ett löfte att hålla den
aktuell, och det löftet binder fler än den som råkar redigera just nu.

Administratören har ingen begränsning inom sitt steg. Två administratörer som
ändrar samma delade mall låses inte, får ingen kopia och ingen sammanslagning —
den sista sparningen vinner. De är få och i samma organisation, och löser det
genom att prata med varandra. Beslutet och dess pris står i
[006](STORIES/006-mallar-som-delas.md).

*Kontroll:* `guide-editor-modes.browser.test.ts`. Ett okänt eller utelämnat läge
ger `readonly`, aldrig det mest tillåtande, och `smoke:lib` prövar det på det
publicerade paketet. Att *använda* mallar ur paletten kan varje redaktör.

**K12c. Ett läge är en vy, inte data och inte skydd.**
`mode` sätts av värden och lagras aldrig i guiden. Det körs i en webbläsare och
går att kringgå — ska en guide vara omöjlig att ändra avgörs det av värdens
behörighetssystem.
*Källa:* beslut 2026-08-02. Lägena finns för att göra det *lätt att göra rätt*,
inte för att hindra den som vill göra fel.
**Ett läge tar bort förmåga, det lägger aldrig till någon.** `translator` är
`edit` minus allt som inte är översättning. En funktion som bara finns i ett läge
tvingar fram lägesbyten för att få arbete gjort — och då är lägena inte längre en
trygghet utan en funktionsindelning. Översättningshjälpmedlen hör därför till
*att ett annat språk är valt* — de visas i `edit` och `translator`, och faller
bort i `readonly` eftersom det inte finns något att hjälpa med där. Att ett läge
tar bort dem är subtraktion, inte ett undantag.

*Kontroll:* `guide-editor-modes.browser.test.ts` — läget syns inte i grafens
JSON, och att växla mellan lägen ändrar den inte.

**K11. Rendering av redaktörsinnehåll saneras.**
*Källa:* `docs/RUNTIME-SECURITY.md`.
*Kontroll:* `guide-editor-security.browser.test.ts`.

---

## Distribution

**K12. Paketet ska gå att installera utan konto och utan token.**
*Källa:* den som bara vill prova ska inte behöva ett `read:packages`-token.
*Kontroll:* tarballen på Pages, och `npm run smoke:lib` som installerar den i ett
tomt projekt och kör visaren och editorn där — grind före publicering.

**K18. Webbläsargolvet: visaren Chrome/Edge 98, Safari 15.4 (iOS 15.4), Firefox 95;
editorn Chrome/Edge 111, Safari 16.4 (iOS 16.4), Firefox 121. Inte IE11.**
Golvet står inte i någon byggkonfiguration — Vite saknar `build.target`, tsconfig
säger es2023 — utan följer av vad **de byggda bundlarna** använder (mätt med grep
i `dist-lib/*.global.js`, inte i källkoden: en grep i källan träffade ordet
*popover* i en kommentar och satte golvet fel ett dygn). Visaren
(`entries/viewer.ts` drar bara in `guide-preview` och `core`): `structuredClone`,
`crypto.randomUUID`, `:focus-visible` — alla från Safari 15.4, Chrome 98 och
Firefox 95. `:has()` och `@container` togs bort ur visaren 7/9 (en regel och tre
block i guide-preview.scss, ersatta av `[data-chosen]` och `data-under` satta av
komponenten) för att de ensamma höll golvet vid Safari 16 / Firefox 121;
`adoptedStyleSheets` har en `<style>`-fallback. Editorn dessutom: `color-mix`,
`adoptedStyleSheets` utan fallback i flow-node, `oklch`, `dvh`, `<dialog>`. **Mätt
ur bundlarna, inte i webbläsare** — ingen gammal Safari har kört sviten. iOS 15
når iPhone 6s och första SE (2015–2016). Argumentet utåt är *gammalt system
ja, gammal webbläsare nej*: biblioteket är webbkomponenter utan ramverk och
utan beroenden, så värden kan vara vad som helst som kan skriva ut en
script-tagg — men besökarens webbläsare måste vara från våren 2022 eller senare.
*Källa:* frågan "IE11+ eller?" (Johan 7/9) hade inget svar någonstans; golvet
mättes fram ur källkoden.
*Kontroll:* granskning när en ny plattformsfunktion tas i bruk — höjer den
golvet ska raden här ändras samma dag. `src/gates/css-ratchet.test.ts` håller
`:has()` på tre förekomster (alla i editorn); visarens noll är det som räknas.

**K19. Egna markörer för egna gester, systemets för systemets.**
Markörerna för det vi själva byggt som gester — panelkantens `col-resize`,
canvasens `move` (panorering, nodflytt) och listornas `grab`/`grabbing`
(nodhuvudet, svarsalternativen, versionslistan) — och portens `crosshair`,
där en koppling börjar, är ritade SVG:er i
`src/editor/styles/_cursors.scss` (24 × 24, mörk fyllning, 1 px vit kant,
hotspot i mitten), med nyckelordet kvar som reserv för webbläsare som inte
ritar SVG-markörer (Safari). Plattformens markörer — pilen, pekhanden på
länkar och knappar, textmarkören — rörs aldrig: dem känner besökaren igen
från alla andra program, och det är på dem Windows tillgänglighetsval
(stor markör, högkontrastschema) verkar. Priset, medvetet: en ritad markör
följer inte Windows markörstorlek, så gestmarkörerna är 24 px även för den
som valt stor.
*Källa:* Windows ritade `grab` vit på Johans maskin (8/2026, canvasen bytte
till `move`) och `col-resize` vit på panelkanten (29–30/9 2026, foto). Ett
skärminspelningsprogram visar felet inte, för det ritar markören ur
markörbilden, inte ur skärmen. Beslutet att inte byta alla markörer:
ledarens rekommendation, Johans ja 30/9. Porten är ett avgränsat undantag,
inte en ny regel: Johan har sett standardmarkörerna bli sporadiskt helvita
på sin Windows, samma fel som `grab` och `col-resize`, och Astra godkände
30/9 en ritad portmarkör med systemets som reserv och portens
hovermarkering kvar (GENOMGANG-2026-09-30 E4, uppdraget bilaga 3). Varför
standardmarkören blir vit är inte fastställt.
*Kontroll:* proven för handtaget, nodflytten, panoreringen, omordningen och porten
kräver att den beräknade `cursor` börjar med `url("data:image/svg+xml` och
slutar med nyckelordet. En ny gest tar sin markör ur `_cursors.scss`; en ny
plattformsmarkör (`pointer`, `text`, `default`) skrivs som nyckelord.

**K13. Repot bär källkod, inte byggda artefakter.**
*Källa:* den committade Sitevision-zippen speglade en godtycklig commit och var
inaktuell inom ett dygn.
*Kontroll:* granskning.

**K14. `requiredLibs` ska stå kvar i Sitevision-modulens `manifest.json`.**
Utan den går bygget inte igenom.
*Källa:* erfarenhet — bygget misslyckas, och det syns inte i någon fil i repot.
*Kontroll:* **mänsklig.** Det här är kravet som fick den här filen att uppstå:
att React inte hamnar i bundeln säger ingenting om vad verktygskedjan kräver, och
den slutsatsen drogs en gång för mycket.

---

## Arbetssätt

**K15. Varje rättning får ett test som faller utan den.**
Ett test som passerar både med och utan fixen bevisar ingenting.
*Källa:* två tester har passerat av fel skäl — ett för att en knapp var
avstängd, ett för att det läste en färg mitt i en `transition`.
*Kontroll:* verifieras för hand vid varje fix, genom att tillfälligt ta bort
rättningen.

**K16. En diagnos mäts, den resoneras inte fram.**
*Källa:* "noden ligger bakom paletten" var klippning, inte stackning. "Ringen
saknas" var en regex som inte matchade `oklab()`. Båda lät rimliga.
*Kontroll:* granskning — en påstådd orsak ska ha en siffra bakom sig.

**K17. Inget pushas eller mergas utan att ägaren sagt till.**
*Källa:* `main` deployar automatiskt till Pages.

---

## Att fylla på

Den här listan är seedad från krav som redan visat sig i praktiken — alltså från
fel som redan kostat något. **De som ännu inte kostat något saknas**, och de
finns bara i huvudet på den som äger produkten.

Värt att fundera på härnäst: vilka krav ställer arbetsgivarens IT-avdelning på
en modul som installeras? Vilka språk måste stödjas? Finns ett tak för hur stor
en guide får bli? Vad gäller om en tjänst inte svarar mitt i en e-tjänst?

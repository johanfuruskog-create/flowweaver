# FlowWeavers grafiska profil

Det här är listan att **välja ur** när en yta ritas eller byggs: vilket
avstånd, vilken rundning, vilken textstorlek, vilken färg — per roll, med
tokenens namn och värde i ljust och mörkt läge. Den är skriven för Johan,
Astra och rollerna i laget.

Profilen har fyra lager. **Grunden** säger varför: principerna och
arbetsgången. **Visuell hierarki** och **Komponenter** är bindande: de
säger hur delarna står till varandra. Avsnitten 1–11 är
råmaterialet att välja ur. Varför ett värde blev det det blev — mätningarna,
förlagorna GOV.UK och Digdir, vad som är kvar att svepa — står vid tokenet i
koden och i rollfilen `flowweaver-design`; det upprepas inte här. Hur en värd
byter färg på biblioteket står i README, avsnittet *Tokens och tema*.

**Välj rollen, aldrig talet.** Står två tal i koden för samma roll är det
riktvärdet i tabellen som gäller för ny kod; raden är märkt *två tal i dag*,
och besluten står under **Beslut och öppna frågor** sist.

> **Utanför profilen?** Behöver en yta ett värde som inte finns här: ändra
> **profilen först**, i en egen commit som säger vilken yta som behövde det
> och varför inget befintligt räckte. **Avvikelsen ska vara godkänd innan
> den används:** profiländringen anger beslut, ansvarig och vilka
> komponenter den gäller, med jämförelsebilder i samma bredd och med samma
> innehåll — ljust och mörkt, kort och lång text, de tillstånd som berörs.
> Det är PRAXIS regel 39.
> Varje avsnitt nedan slutar med en rad *Utanför? då:* som säger vad det
> betyder just där.

En grind (`graphic-profile`) kräver att varje `--fw-*`-token som definieras
i tokensfilen står i det här dokumentet, och att varje färg som skrivs här
finns i tokensfilen. Ett nytt token utan en rad här, eller ett gammalt
värde som står kvar här, fäller bygget.

---

## Grunden

Profilen vilar på tre etablerade utgångspunkter, gjorda till
FlowWeaver-regler. De ersätter inte prov med FlowWeavers egna användare.
Gestalt styr hierarkin, Nielsen interaktionen och GOV.UK formulärens
beteende. FlowWeavers egna tokens bestämmer utseendet.

### Gestalt: närhet och likhet

Det som hör ihop står tillsammans, och samma slags funktion har samma
uttryck. Luft visar grupperingen innan en ram läggs till.
([NN/G: Proximity Principle in Visual Design](https://www.nngroup.com/articles/gestalt-proximity/))

- Etikett, fält och hjälptext är **en grupp** (Komponenter, *Fältgrupp*).
- Avståndet **inom** en grupp är mindre än avståndet **mellan** grupper
  (1. Avstånd; *halva relationens avstånd* för det besläktade).
- *Lägg till* hör visuellt till samlingen den ändrar och står innanför
  samma gruppering (Visuell hierarki, *Var tilläggshandlingen står*).
- Samma tilläggshandling har samma utseende i hela produkten — en form,
  inte en per panel.

### Nielsen: granskningslistan

Konsekvens, synlig återkoppling, igenkänning framför minne,
användarens kontroll och förebyggande av fel.
([NN/G: 10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/))
Varje yta granskas mot de här fem frågorna innan bilden går vidare:

1. Betyder samma ikon och samma ord samma sak överallt?
2. Står frågans namn tillsammans med variabeln, så redaktören inte behöver
   minnas tekniska namn?
3. Går hovring, tangentbordsfokus och valt läge att skilja från varandra?
4. Syns det nya innehållet tydligt efter *Lägg till*?
5. Lämnar en avbruten väljare — Escape, klick utanför — det sparade valet
   orört? För den sökbara väljaren är det prövat i
   `field-picker.browser.test.ts` (Escape, Tab och sökning rör inte det
   sparade valet, story 143).

### GOV.UK: beteendemönster, inte identitet

Vi lånar GOV.UK:s mönster och vägledning för formulär och handlingar, inte
deras typsnitt, färger eller former. En vy har inte flera konkurrerande
huvudhandlingar, för då blir nästa steg svårare att förstå.
([GOV.UK Design System: Button](https://design-system.service.gov.uk/components/button/))
I visaren betyder det: *Nästa* är huvudhandling, *Föregående* sekundär,
*Lägg till ytterligare en* en lokal tilläggshandling (Visuell hierarki).

### Arbetsgången

Kontrollera med uppgifter, inte bara med skärmbilder. Det här är Fias
arbetsgång för varje yta:

1. **Beskriv uppgiften.** Vad ska användaren förstå och göra?
2. **Rita alla relevanta tillstånd:** långt innehåll, tomt, fel och fokus.
3. **Granska mot principerna ovan.** Vad dominerar, vad hör ihop, vad
   händer efter handlingen?
4. **Prova utan vägledning.** Låt någon lägga till, ändra och ta bort
   innehåll. Notera tvekan och fel.
5. **Jämför bygget mot skissen** med samma innehåll, bredd och tema.

Grindarna och den visuella jämförelsen behövs, men de visar inte ensamma
att användaren förstår sidan.

Dribbble inspirerar uttrycket, avgör aldrig beteendet.

---

## Visuell hierarki — bindande

Tokens säger vilka värden som finns. Det här avsnittet säger **vad som ska
dominera, vad som hör ihop och vad som ligger i bakgrunden**. En yta kan
använda rätt tokens och ändå vara fel, om en tilläggsknapp ser ut som
sidans huvudhandling. Grinden prövar inte det här; bilderna gör det
(PRAXIS 39).

> Varje vy eller tydligt avgränsad uppgift ska ha en uttalad
> huvudhandling. Övriga handlingar graderas efter betydelse. Att en
> handling skapar något gör den inte automatiskt primär.
> *(Astra 30/9)*

| Roll | Utformning | Tokens | Exempel |
| --- | --- | --- | --- |
| **Huvudhandling** | Fylld accentknapp. En per vy eller dialog. | yta och kant `--fw-primary`, text `--fw-on-primary`, `--fw-radius-button`, `--fw-weight-strong`, minst `--fw-control-height` | Nästa, Skicka in, bekräfta i en dialog, Publicera |
| **Lokal tilläggshandling** | Konturknapp med plus-ikon och text. Aldrig fylld. | kant `--fw-primary`, text `--fw-primary-strong`, yta genomskinlig, `--fw-radius-button`, `--fw-weight-strong`; plus som ikon (avsnitt 11), inte som tecknet "+" | Lägg till fält, Lägg till svarsalternativ, Lägg till regel, Lägg till pass |
| **Kompletterande handling** | Diskret text- eller ikonknapp, utan kant och utan yta i vila. Hovring och fokus ger markeringen. | ikon `--fw-text-muted`, text `--fw-text-secondary` eller `--fw-primary-strong`; hovring `--fw-surface-subtle` | Flytta upp och ned, fäll ut, visa hjälp, Ändra i granskningen |
| **Destruktiv handling** | Text och soptunne-ikon i destruktiv färgroll, utan fyllning. Står åtskild från tillägg. | `--fw-danger-text`; skiljs med en avdelare `--fw-border-subtle` eller minst `--fw-space-4` | Ta bort alternativ, Ta bort regeln, Ta bort pass 2 |
| **Destruktiv huvudhandling** | Fylld röd knapp, bara i en bekräftelsedialog och bara när handlingen riskerar betydande dataförlust — bedömt per handling, inte efter verbet. Övriga bekräftelser har huvudhandlingens accent. Initialt fokus står på *Avbryt*. | yta och kant `--fw-danger`, text `--fw-on-danger`, `--fw-radius-button`, `--fw-weight-strong` | Kasta utkastet, Ersätt guiden, Ta bort version 3 |

**Den destruktiva huvudhandlingen** är Astras beslut 30/9 (bilaga 2 i
uppdraget om genomgången): den fyllda röda står kvar där en bekräftelse
skyddar mot att förlora arbete som inte kan ångras, och bara där.
*Återställ* kan skriva över arbete lika mycket som *Kasta*, och *Ta bort
startnod* går att ångra — därför bedöms konsekvensen, inte ordet. Var
bekräftelsedialogens anrop står och vilken ton vart och ett har står vid
`tone` i `confirmation-dialog.ts`.

**Sekundär navigering** — *Föregående* — är en neutral konturknapp
(avsnitt *Navigering* under Komponenter). Den är varken tillägg eller
kompletterande: den är huvudhandlingens motsats och står i samma rad.

### Var tilläggshandlingen står

**Lägg till står direkt efter den samling den påverkar, innanför samma
visuella gruppering.** Lägger den till ett fält i ett befintligt kort
står den i kortet, efter det sista fältet. Den ska inte se ut att skapa
en ny sida eller ett nytt avsnitt.

- Avståndet till samlingens sista del är samlingens eget avstånd, till
  exempel `--fw-space-3` mellan korten i panelen.
- Inget annat står mellan samlingen och knappen: inte ett *Annars*-kort,
  inte samlingens hjälptext. Hjälptext om samlingen står **ovanför** den,
  under rubriken.
- Knappen har samlingens bredd när samlingen är en lista av kort, och
  innehållets bredd när den står bland fält.

### Den tomma samlingens variant

En samling utan delar får en mer framträdande tilläggshandling. Det är en
beskriven variant, inte ett fritt undantag:

| Del | Utformning |
| --- | --- |
| Instruktion | En mening ovanför knappen som säger vad som saknas, i `--fw-text-secondary`, `--fw-font-size-md`. Den är en instruktion, inte metadata. |
| Knappen | Samma plus och samma ord, men **tonad**: yta `--fw-primary-surface`, kant `--fw-primary-border`, text `--fw-primary-strong`, samlingens hela bredd. Den blir aldrig fylld — fylld är huvudhandlingen. |
| Hovring och fokus | Hovrad blir kanten `--fw-primary`, konturknappens kant: ytan är redan konturknappens hovringsyta, så den kan inte bära hovringen (Fia 30/9, mätt oförändrad i båda teman före rättningen). Fokus är `focus.ring` som alla knappar. |
| När samlingen får sin första del | Varianten går tillbaka till den vanliga konturknappen efter den nya delen. |

**Godkänd och byggd** (Astra 30/9, bilaga 4 i uppdraget om den grafiska
profilen). Placeringen är instruktion → *Lägg till regel* → *Annars* när
regeln saknar regler, och regelkort → *Lägg till regel* → *Annars* när den
har regler. Regelns instruktion är *Inga regler har lagts till ännu. Lägg
till den första regeln.*, frågans *Frågan har inga svarsalternativ ännu.
Lägg till det första.* Knappens text är densamma i tomt och fyllt läge. Den
tomma frågan döljer *0 alternativ* och dragtipset, så tomheten sägs en gång.

### Avvikelser i dag

Mätt 30/9 i den byggda koden: varje synlig knapp i panelen för 52 noder
ur tre guider (alla kort öppna), och besökarens knappar på skadeanmälans
första sida och i konferensanmälan fram till inlämningen. Panel 380 px,
visare 900 px, ljust läge. Det som rättats i B3 (30/9 kväll) är märkt
med sin commit.

| # | Knapp | Var | Roll | Hur den ser ut i dag | Bryter mot |
| --- | --- | --- | --- | --- | --- |
| 1 | Ta bort pass *N* | Visaren, upprepningsgruppen | Destruktiv | **Rättat 30/9 (a17e754c).** Var: Neutral kontur `--fw-border-control`, text `--fw-text-strong`, 45 px — samma form som *Lägg till pass* och *Föregående* | — (var: Destruktiv färgroll och ikon saknas. Går inte att skilja från tillägget) |
| 2 | + Lägg till regel | Panelen, regelnoden | Lokal tillägg | **Rättat 30/9 (35d0e932, B1).** Var: stod efter *Annars*-kortet, inte efter regelkorten (bild *b4*, *x-empty-rule*) | — (var: placeringen; kriteriet omskrivet i samma commit, beslut 13) |
| 3 | Lägg till fält | Panelen, tjänsteanropets *Lägg svaret i variabler* | Lokal tillägg | **Rättat 30/9 (a7fb4599, e43567df).** Var: Streckad neutral kant `1px dashed #98a2b3`, text `--fw-text-strong`, inget plus. Står utanför samlingens grå ruta, och samlingens hjälptext står **efter** knappen (bild *a1*) | — (var: Utformningen och placeringen) |
| 4 | Lägg till kolumn | Panelen, inlämningens kolumner | Lokal tillägg | **Rättat 30/9 (a7fb4599).** Var: Samma streckade neutrala form som nr 3 | — (var: Utformningen. Panelen har två former för samma roll) |
| 5 | Lägg till pass | Visaren, upprepningsgruppen | Lokal tillägg | **Rättat 30/9 (a7fb4599).** Var: Neutral kontur, inget plus | — (var: Plus saknas) |
| 6 | ↑ och ↓ i tjänsteanropets rader | Panelen | Kompletterande | **Rättat 30/9:** *Flytta Rad 2 uppåt*, kortens ord; samma för inlämningens kolumner. Var: tecknet ↑ som enda namn, inget `aria-label` | — (var: tillgängligt namn saknades; en skärmläsare sa "uppåtpil") |
| 7 | Ta bort raden, Ta bort kolumnen | Panelen, tjänsteanrop och inlämning | Destruktiv | **Rättat 30/9 (a17e754c).** Var: Destruktiv text utan ikon, 35 px | — (var: Ikon saknas) |
| 8 | ↑ Flytta upp, ↓ Flytta ned | Panelen, *Placering i sidan* | Kompletterande | Kant `--fw-border-control` och yta `--fw-surface-subtle`, 33 px | Kompletterande med ram. Kortens och betygsstegens flyttpilar är kantlösa — tre former av samma handling. |
| 9 | + Lägg till svarsalternativ, + Lägg till regel | Panelen | Lokal tillägg | **Rättat 30/9 (a7fb4599).** Var: Primär kontur, rätt roll — men plus som tecknet "+", 37 px, radie 6 px (`--fw-radius-sm`) | — (var: Plus som tecken, inte ikon; radien är inte `--fw-radius-button`) |
| 10 | Infoga variabel (plusmenyn i text- och formelfälten; hette *Lägg till* i textfältet till 30/9, B9) | Panelen, textfälten | Lokal tillägg | Tonad yta `--fw-primary-surface` och primärkant, 48 px | Godkänd som menyutlösare i en verktygsrad (beslut 10). Ingen avvikelse. |
| 11 | Ändra | Visaren, granskningssteget | Kompletterande | **Rättat 30/9:** understruken text `--fw-primary-strong`, 44 px hög (`--fw-control-height`). Var: 27 px | — (var: under K6:s 44 px på besökarens yta) |
| — | Tom samling | Panelen, regel och fråga utan delar | — | **Rättat 30/9:** varianten ovan, med instruktionen och den tonade knappen. Var: samma knapp som i en full samling | — (var: varianten fanns inte) |

Följer tabellen i dag: *Nästa* och *Skicka in* (fyllda, en per vy),
*Ta bort alternativ* och *Ta bort regeln* (text och ikon i destruktiv
färg, skilda med en avdelare), kortens flytt- och fällpilar (kantlösa,
44 px, med namn som *Flytta Kök uppåt*), textfältets formatknappar
(kantlösa).

*Utanför? då:* en handling som inte passar någon av de fyra rollerna, eller
en femte form för en befintlig roll — profilen först (PRAXIS 39), med
jämförelsebilder.

---

## Komponenter — bindande

Fem komponenter som två ytor annars löser på två sätt. Varje komponent har
**anatomi** (delarna i ordning, mätta i DOM:en i den byggda koden 30/9),
**tokenroller**, **avstånd** (relationens token) och **tillstånd**. Kolumnen
*I dag* säger var koden avviker. Riktvärdet gäller för ny kod.

Bilderna ligger i `docs/profil/`, en per komponent, tagna i ljust läge ur
den byggda koden 30/9: visaren i 900 px, panelen i 380 px. De är
anatomins mätning, inte skisser; tas komponenten om tas bilden om.

### Fältgrupp — etikett, kontroll, hjälptext, fel

Bild: *b1-faltgrupp-light-900.png* (skadeanmälans första sida efter
*Nästa* med två tomma obligatoriska fält).

| Del, i ordning | Riktvärde | Mätt i dag, visaren | Mätt i dag, panelen |
| --- | --- | --- | --- |
| Etikett | `--fw-font-size-md`, `--fw-weight-strong`, meningsstil, `--fw-text-secondary` | 14 / 600, #475467 | Överst i panelen: 12 / 700 VERSALER `--fw-text-muted`. I ett kort: 14 / 600 meningsstil `--fw-text`. |
| ↓ avstånd | `--fw-space-2` (8), cellens `gap` | 8 | 8 överst, **4** i ett kort |
| Hjälptext | Svarsinstruktionen före kontrollen (beslut 9); den fördjupade *Varför frågar vi det här?* får stå sist. `--fw-font-size-md`, `--fw-weight-text`, `--fw-text-secondary`, `--fw-line-body` | *Varför frågar vi det här?* står sist i cellen, i en ruta: kant `--fw-border`, radie 10 px, yta `--fw-surface-subtle`, utfyllnad 16 | Beskrivning under fältet |
| ↓ avstånd | `--fw-space-2` | 8 | 8 |
| Kontroll | 45 px (golv `--fw-control-height`), utfyllnad 12 / 16, kant `--fw-border-control`, `--fw-radius-field`, värdet i `--fw-weight-text` | 45 px, radie 8, **värdet i 600** (ärvt från cellen) | 45 px, **radie 6**, värdet i 400 — utom elva fält där det ärvs som 700 |
| ↓ avstånd | `--fw-space-2` | 8 | — |
| Fel | `--fw-font-size-base`, `--fw-weight-strong`, `--fw-danger-text`, under kontrollen; kontrollens kant `--fw-danger` | 13 / 600, #b42318; kanten #d92d20 med en ring i 12 % (literal) | — |
| → nästa fältgrupp | `--fw-space-4` (16) i visaren, `--fw-space-3` (12) i panelen (täthet, avsnitt 3) | 16 | 12 i ett kort, 20 överst (utanför skalan) |

**Tillstånd:** vila · fokus (`focus.ring`, avsnitt 6) · ifyllt · fel
(kanten, meddelandet under, sammanfattningen överst på sidan med länkar
till fälten) · inaktiv (`--fw-text-disabled`, `--fw-surface-subtle`).

### Upprepningsgrupp — rubrik, innehåll, ta bort, lägg till

Bild: *b2-upprepningsgrupp-light-900.png* (konferensanmälans pass, två
grupper).

| Del, i ordning | Riktvärde | Mätt i dag |
| --- | --- | --- |
| Gruppen | `fieldset`, kant `--fw-border-subtle`, `--fw-radius-card`, utfyllnad `--fw-space-4`, ingen skugga | Kant #e4e7ec, radie 12, utfyllnad 4 / 16 / 16 |
| Rubrik | `legend`, ordet och numret (*Pass 2*), `--fw-font-size-md`, `--fw-weight-heading`, `--fw-text-strong` | 14 / 700, #344054 |
| Innehåll | Fältgrupper enligt ovan, `--fw-space-4` emellan | 16 |
| Ta bort | Destruktiv (Visuell hierarki): text och ikon, `--fw-danger-text`, sist i sin grupp, `--fw-space-4` ovanför | Följer sedan 30/9 (a17e754c); var neutral konturknapp, avvikelse 1 |
| → nästa grupp | `--fw-space-5` (24): mer än gruppens inre 16 | 20 (utanför skalan) |
| Lägg till | Lokal tillägg med plus, direkt efter sista gruppen, `--fw-space-4` ovanför | Följer sedan 30/9 (a7fb4599); var neutral konturknapp utan plus, avvikelse 5 |

**Tillstånd:** en grupp · flera · minsta antal ej nått (felet *Lägg till
minst N.* under knappen) · största antal nått (*Lägg till* döljs) · en
grupp utan val kvar (meningen *Inga alternativ finns att välja…*). De tre
sista finns i ordlistan men är inte fotograferade i den här omgången.

### Kort — hopfällt, öppet, fokuserat

Bild: *b3-kort-light-panel380.png* (frågan *Hur många dagar?*: första
kortet öppet, andra hopfällt med tangentbordsfokus på fällknappen).

| Del, i ordning | Riktvärde | Mätt i dag |
| --- | --- | --- |
| Samlingens rubrik | Avsnittsrubrik i panelen (Typografi), antal som metadata till höger | `h3` 18,72 px / 700 — webbläsarens standard, utanför rampen; antalet 11 px |
| Samlingens hjälptext | Under rubriken, före korten | *Dra för att ändra ordning*, 13 px |
| Kortet | Kant `--fw-border`, `--fw-radius-card`, yta `--fw-surface`, **ingen skugga** | Kant #d0d5dd, **radie 8**, ingen skugga |
| Huvudet | 60 px, yta `--fw-surface-subtle`, utfyllnad 8 / 4, `gap` `--fw-space-1`: draghandtag 44 · namn (`--fw-font-size-md`, `--fw-weight-heading`) · upp · ned · fäll | Så, alla fyra knapparna 44 × 44 och kantlösa |
| Innehållet (öppet) | Avdelare `--fw-border` överst, utfyllnad `--fw-space-3`, fältgrupper med `--fw-space-3` emellan | Så |
| Ta bort | Destruktiv, sist, avdelare `--fw-border-subtle` ovanför | Så. Inaktiv i ett av två mätta fall (#98a2b3); skälet är inte mätt. |
| → nästa kort | `--fw-space-3` (12) | 12 |
| Lägg till | Lokal tillägg, direkt efter sista kortet, samlingens bredd | Så, med plus-ikonen och 44 px sedan 30/9 (a7fb4599); var tecknet, 37 px, avvikelse 9 |

**Tillstånd:** hopfällt (bara huvudet, 62 px) · öppet (fällpilen pekar upp,
innehållet under) · fokuserat (`focus.ring` på knappen som har fokus;
kortet självt markeras inte) · draget (markören `grabbing`, K19).

### Sökbar väljare — normalt, sökning, vald rad, inga träffar

Bild: *b4-sokbar-valjare-light-panel380.png* (regelns villkor, sökning
*plats*, den valda raden synlig). Story 143; komponenten `field-picker`.

| Del | Riktvärde | Mätt i dag |
| --- | --- | --- |
| Stängd | Samma form som ett fält: 45 px, kant `--fw-border-control`, `--fw-radius-field`, pil 18 px `--fw-text-secondary` | 45 px, radie 6, utfyllnad 12 / 42 / 12 / 12 |
| Ytan | Direkt under fältet: `menu-surface` (kant `--fw-border`, yta `--fw-surface-raised`, `--fw-shadow-raised`), radie `--fw-radius-field`, lager `--fw-z-popover` | Så, radie 8 |
| Sökzonen | Utfyllnad `--fw-space-3`; rutan 44 px med förstoringsglas och rensa-kryss | Så |
| Antal | *2 träffar av 17*, `--fw-font-size-md`, `--fw-text-secondary` — bara under sökning | Så |
| Grupprubrik | *Svar från guiden*, *Uträkningar*: `--fw-font-size-md`, `--fw-weight-strong`, `--fw-text-secondary`, meningsstil, utfyllnad 12 / 16 / 8 | Så |
| Rad | Namnet i `--fw-font-size-xl` / `--fw-weight-text`, variabelns bricka under (`--fw-radius-chip`, `--fw-primary-surface`, `--fw-primary-strong`), `gap` `--fw-space-2`, utfyllnad 12 / 48 / 12 / 16 | Så, 75 px per rad |
| Träffen | Den sökta delen `<mark>` i `--fw-weight-heading`, ingen färg | Så |

**Tillstånd:** normalt (stängd, frågans namn) · öppen (sök tom, listan
rullad så den valda raden syns) · sökning (antalet, träffarna markerade,
grupper utan träff döljs) · vald rad (yta `--fw-primary-surface`, bock
till höger i `--fw-primary`, `aria-selected`) · tangentbordets rad
(`aria-activedescendant`) · inga träffar (listan
och antalet döljs; *Inga träffar* i `--fw-font-size-xl` /
`--fw-text-secondary`, utfyllnad 12 / 16 — mätt, inte fotograferat).

### Navigering — Föregående, Nästa, slutlig inlämning

Bild: *b5-navigering-light-900.png* (konferensanmälans granskning med
*Skicka in*).

| Del | Riktvärde | Mätt i dag |
| --- | --- | --- |
| Raden | Sist i kortet, `--fw-space-5` ovanför, `gap` `--fw-space-2` | 24 ovanför (literal), gap **12** |
| Föregående | Vänster. Neutral kontur: kant `--fw-border-control`, text `--fw-text-strong`, yta `--fw-surface`, `--fw-radius-button`, `--fw-weight-strong`, minst `--fw-control-height` | Så, 45 px |
| Nästa | Höger. Huvudhandling, fylld | Så, 45 px |
| Slutlig inlämning | **Samma plats och samma form som Nästa, eget verb** (*Skicka in*). Ingen tredje form, ingen ikon, ingen annan färg. | Så |
| Ändra (granskningen) | Kompletterande textknapp, minst 44 px hög på besökarens yta | 27 px — avvikelse 11 |

**Tillstånd:** första steget (*Föregående* inaktiv: `--fw-surface-subtle`,
`--fw-text-disabled`, kant `--fw-border-subtle` — syns i bild *b1*) ·
mellansteg · granskning (*Skicka in*) · efter inlämning (ingen navigering;
kvittot). Radens form i 390 px är inte mätt i den här omgången.

*Utanför? då:* en ny komponent, eller en ny del i en av dessa — profilen
först (PRAXIS 39), med anatomin mätt och en bild ur den byggda koden.

---

## 1. Avstånd

Ett rutnät på 4 px för `gap`, `padding` och `margin`. Samma i båda teman.

| Token | Värde | När |
| --- | --- | --- |
| `--fw-space-1` | 4 px | Två textrader som är **en sak** (halva golvet): en not som bryts, rubrik och underrubrik i samma ruta. Ikon mot sitt ord. |
| `--fw-space-2` | 8 px | **Golvet** mellan två grannar man läser eller trycker på. Etikett → fält. Fält → hjälptext. Knappar i rad. |
| `--fw-space-3` | 12 px | Inre avstånd i täta rutor: panelens alternativ, en menyrad, en listrad. |
| `--fw-space-4` | 16 px | Mellan fält i ett formulär. Inre avstånd i en ruta med innehåll. |
| `--fw-space-5` | 24 px | Rubrik → innehåll. Kortets och dialogens inre avstånd. |
| `--fw-space-6` | 32 px | Mellan avsnitt på en sida i visaren och på sajten. |
| `--fw-space-7` | 48 px | Bara sajten: mellan större innehållssektioner (Astra 30/9, B8). Visaren och editorn slutar vid 6. |

**Relationerna, som riktvärden:**

| Relation | Riktvärde | Exempel | Anmärkning |
| --- | --- | --- | --- |
| Etikett → fält | `--fw-space-2` (8) | besökarens fält, panelens fält | Samma tal på båda ytorna. |
| Fält → hjälptext | `--fw-space-2` (8) | *Varför frågar vi?*-rutan | Kommer i dag från cellens `gap` i en cell och en `margin` utanför — samma tal. |
| Mellan fältgrupper **inom samma avsnitt** | `--fw-space-4` (16) i visaren, `--fw-space-3` (12) i panelen | besökarens sida med flera fält; fälten i ett kort | Beslut 1. I dag 16 i visaren, 20 överst i panelen, 12 i panelens kort. |
| Mellan avsnitt i en vy | `--fw-space-5` (24) i panelen, `--fw-space-6` (32) i visaren | panelens *Rubrik* → *Svarsalternativ*; kortets fält → navigeringen | Större än avståndet inom ett avsnitt (Gestalt). En 20 i panelen byts inte blint: mellan två fältgrupper i samma avsnitt blir den 12, mellan två avsnitt 24. |
| Rubrik → innehåll | `--fw-space-5` (24) | kortets fråga → svarsalternativen, → navigeringen | Talet används redan, som literal. |
| Mellan avsnitt på sajten | `--fw-space-6` (32) inom en sektion, `--fw-space-7` (48) mellan större sektioner | sajtens sektioner, sidfoten | Beslut 2. Startsidans 72 / 56 och *Kom igång*s 36 / 40 har egna jämförelser och byts inte automatiskt. |
| Kortets inre | `--fw-space-5` (24) i visaren och dialogen, `--fw-space-3` (12) i panelen | dialogskalet, panelens kort | **Responsiv variant** (beslut 3): besökarens kort har 24 när visaren är bredare än 400 px och `--fw-space-4` (16) vid 400 px och smalare. Styrs av visarens egen bredd (`data-under`), inte fönstrets. |
| Knappar i rad | `--fw-space-2` (8) | dialogens knapprad | Beslut 4. I dag har kortets Föregående/Nästa 12. |
| Besläktat inom en ruta | **halva relationens avstånd**, och tokenet står uttryckligen | citatet och faktarutan i en dialog | 24 → `--fw-space-3` (12). 16 → `--fw-space-2` (8). 8 → `--fw-space-1` (4). Halva — inte "ett steg ned", som ger 16 ur 24. |
| Sidans gutter | 20 px | `padding-inline` på `main` | Utanför skalan med flit: fokusramen ska rymmas inom vyn. |

**Utanför skalan med flit:** 1, 2 och 3 px — en hårlinjekant, avståndet
etikett mot värde, fokusramen. De är optiska, inte rytm.

*Utanför? då:* ett tal mellan två steg är nästan alltid fel steg. Behövs
ett nytt steg eller en ny relation: profilen först (regel 39), med ytan
och skälet.

---

## 2. Radier

Det en sak **är** avgör hur rund den är.

| Token | Värde | När | Exempel |
| --- | --- | --- | --- |
| `--fw-radius-button` | 8 px (= `md`) | Knappar | Nästa, Publicera, verktygsradens knappar |
| `--fw-radius-field` | 8 px (= `md`) | Fält, väljare, textrutor — fältet matchar sin knapp | textfältet, `<select>` |
| `--fw-radius-card` | 12 px (= `xl`) | Kort, listrader, paneler, anteckningen, menyytor | besökarens kort, versionsraden, plusmenyn |
| `--fw-radius-dialog` | 16 px | Dialoger och ark som beter sig som dialoger | publiceringsdialogen |
| `--fw-radius-chip` | 999 px (= `pill`) | Brickor och etiketter — den enda runda rollen | tillståndsbrickan, chipväljarens val |
| `--fw-radius-pill` | 999 px | Formen själv; `chip` pekar hit | reglagets spår |

Knapp och fält är två tokens med samma värde med flit: en värd kan runda
fälten utan att röra knapparna. **Knappar är aldrig piller.**

**Den gamla skalan** — använd inte i ny kod; den finns kvar tills svepet har
flyttat varje komponent till en roll:

| Token | Värde |
| --- | --- |
| `--fw-radius-xs` | 4 px |
| `--fw-radius-sm` | 6 px |
| `--fw-radius-md` | 8 px |
| `--fw-radius-lg` | 10 px |
| `--fw-radius-xl` | 12 px |
| `--fw-radius-2xl` | 14 px |

Kryssrutan har 4 px och radioknappen är rund; de är ritade kontroller med
egen form, inte en roll.

**Komponenttypen avgör radien, även när saken är klickbar.** Ett kort man
trycker på för att öppna är ett kort (`card`), en bricka man trycker bort
är en bricka (`chip`), ett svarsalternativ som är en hel rad är ett fält
(`field`). Att något går att trycka på gör det inte till en knapp.

Radier i dag som inte följer rollen (mätt 30/9):

| Komponent | Roll | I dag |
| --- | --- | --- |
| Panelens fält och väljare | `field` 8 | 6 (`--fw-radius-sm`) |
| Panelens knappar, t.ex. *Lägg till svarsalternativ* | `button` 8 | 6 |
| Panelens kort (svarsalternativ, regler) | `card` 12 | 8 |
| Besökarens kort | `card` 12 | 14 (`--fw-radius-2xl`) |
| *Varför frågar vi det här?*-rutan | `card` 12 | 10 (literal) |

*Utanför? då:* en ny sorts sak som ingen roll beskriver (inte en ny rundning
på en gammal sak) — profilen först (regel 39).

---

## 3. Typografi

**Meningsstil är målbilden** för avsnittsrubriker och fältetiketter (Astra
30/9). Ny kod skriver meningsstil. Befintliga versaler står kvar som
**dokumenterad avvikelse tills svepet**, inte som permanent undantag;
svepet är en egen omgång med bilder före och efter.

Versaler i dag:

| Avvikelse | Var |
| --- | --- |
| START-brickan | nodhuvudet på arbetsytan |
| Anteckningslappens rubrik | `--fw-note-label` |
| Sajtens ögonbrynsrubriker | sidfotens kolumnrubriker, *Verkstad* över dev-sidornas rubrik |

| Panelens fältetiketter överst | 47 olika (*Rubrik*, *Beskrivning*, *Minsta antal* …), 12 px / 700 |
| Panelens metadatarad | *Nodtyp*, *Modul*, *Position*, *Placering i sidan* |
| Betygsstegens etiketter och mottagarnas rubriker | panelen |

Mätt 30/9. Ingen ny versal läggs till utan en profiländring (PRAXIS 39).

### Typsnitt

| Token | Värde | När |
| --- | --- | --- |
| `--fw-font` | systemstacken: `system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` | All text. Ingen webbfont — noll nätverkskostnad. |
| `--fw-font-mono` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` | Kod, variabelnamn, uträkningens formel, tekniska id:n |

### Storlekar

I `rem`, så texten följer besökarens grundstorlek. Avstånd, radier och
kontrollhöjd står kvar i px. Samma i båda teman.

| Token | Värde | px vid 16 |
| --- | --- | --- |
| `--fw-font-size-xs` | 0.6875rem | 11 |
| `--fw-font-size-sm` | 0.75rem | 12 |
| `--fw-font-size-base` | 0.8125rem | 13 — rampens mittsteg, inte en grundstorlek |
| `--fw-font-size-md` | 0.875rem | 14 |
| `--fw-font-size-lg` | 0.9375rem | 15 |
| `--fw-font-size-xl` | 1rem | 16 |
| `--fw-font-size-2xl` | 1.125rem | 18 |
| `--fw-font-size-3xl` | 1.5rem | 24 |

### Vikt, radavstånd, spärrning

| Token | Värde | När |
| --- | --- | --- |
| `--fw-weight-text` | 400 | Brödtext, hjälptext, allt man läser |
| `--fw-weight-strong` | 600 | Etiketter, knappar, tabellhuvuden, ett betonat värde |
| `--fw-weight-heading` | 700 | Varje rubrik, oavsett storlek |
| `--fw-line-body` | 1.5 | Text som bryts över flera rader |
| `--fw-line-tight` | 1.25 | Text som är en rad med avsikt: rubrik, knapp, bricka |
| `--fw-tracking-caps` | 0.06em | Små versala etiketter, och inget annat |
| `--fw-tracking-heading` | −0.01em | Rubriker från ungefär 18 px |

800 och 500 har ingen roll.

### Hierarkin — roller

Vikten säger vad texten **är**, inte hur viktig den känns: 700 är en
rubrik, 600 en etikett eller en handling, 400 allt man läser och allt man
själv har skrivit eller valt. *I dag* är mätt 30/9 i visaren (900) och
panelen (380).

**Rubriker — 700, med nivå**

| Nivå | Besökaren | Editorn | I dag |
| --- | --- | --- | --- |
| 1. Vyrubrik | `3xl` (24), tight, tracking-heading | Dialogrubrik `2xl` (18) | Beslut 5. Besökarens fråga är i dag 26 px. |
| 2. Avsnittsrubrik | `2xl` (18), tight | `lg` (15), tight | Panelens *Svarsalternativ* och *Regler* är 18,72 px: webbläsarens `h3`, utanför rampen |
| 3. Grupprubrik | `md` (14), tight, `--fw-text-strong` | `md` (14), tight | Upprepningsgruppens *Pass 2* 14 / 700 och kortets namn 14 / 700 följer. Väljarens grupprubrik är 600. |

**Etiketter — 600, meningsstil**

| Roll | Besökaren | Editorn | I dag |
| --- | --- | --- | --- |
| Fältetikett | `md` (14), `--fw-text-secondary` | `md` (14), `--fw-text` | Besökaren följer. Panelen följer i korten; överst står 47 etiketter i VERSALER 12 / 700 `--fw-text-muted`. |
| Knapptext | ärvd (16) | `base` (13) till ärvd (16) | — |
| Bricka | `md` (14), radhöjd 1 | samma | — |

**Värden — 400**

| Roll | Riktvärde | I dag |
| --- | --- | --- |
| Inmatat värde | Fältets text, `--fw-font-size-xl`, `--fw-weight-text`, `--fw-text` | **Rättat 30/9:** 400 på båda ytorna — vikten sitter på etiketten, inte på fältcellen, och panelens fältregel sätter vikten själv. Var: besökaren 600 (bild *b1*), panelen 700 i fält under versala etiketter (tjänsteanropets rader, betygsstegen, inlämningens kolumnrubriker). |
| Valt alternativ | 400. Valet bärs av kontrollen — prick, bock, tonad yta — aldrig av fet text | Väljarens valda rad: 16 / 400 med tonad yta och bock. Följer. |
| Värde i granskningen | 400 `--fw-text` under sin etikett i `--fw-text-secondary` | Formen följer (bild *b5*); storlekarna är inte mätta. |

**Löptext, hjälp och metadata — 400**

| Roll | Riktvärde | När | I dag |
| --- | --- | --- | --- |
| Brödtext | Besökaren `xl` (16), editorn `base` (13); `--fw-line-body`; `--fw-text-secondary` | Kortets beskrivning, panelens förklaringar | Besökarens beskrivning 16 / 400 med radhöjd 1,6 (literal) |
| Hjälptext | `md` (14); `--fw-line-body`; `--fw-text-secondary` | Säger hur ett fält fylls i eller varför det frågas | — |
| Instruktion | Som hjälptext. **Aldrig** `--fw-text-muted`, aldrig under `base` | Säger vad man ska göra: *Dra för att ändra ordning*, den tomma samlingens mening, *Regeln väljer väg mellan steg* | *Dra för att ändra ordning* 13 / 400 |
| Metadata | `sm` (12), `--fw-text-muted` | Antal, position, nodtyp, tider — det man kan hoppa över | *2 alternativ* 11 px (`xs`) |
| Fel | `base` (13), `--fw-weight-strong`, `--fw-danger-text` | Under fältet det gäller | 13 / 600 — följer |
| Monospace | `sm` (12) eller `base` (13), `--fw-font-mono` | Formeln, variabelnamnet | — |

Hjälptexten är sekundär men ska gå att läsa bekvämt: `--fw-text-secondary`
mäter 7,69 : 1, `--fw-text-muted` bara 4,97. Skillnaden mellan en
instruktion och metadata är om den som läser behöver den för att göra
rätt. Behöver hen det är det en instruktion.

### Samma designspråk, inte samma täthet

Visaren är luftigare än editorn. Tokens, färger, vikter, radier per roll
och hierarkin ovan är desamma; **storleks- och avståndssteget** skiljer.

| | Visaren (besökaren) | Editorn (panelen) |
| --- | --- | --- |
| Brödtext | `xl` (16) | `base` (13) |
| Fältetikett | `md` (14) / 600 | `md` (14) / 600 |
| Fältets höjd | 45 (golv `--fw-control-height`, K6) | 45 (K6 tillåter 38) |
| Etikett → fält | `--fw-space-2` (8) | `--fw-space-2` (8) — i korten i dag 4 |
| Mellan fältgrupper i samma avsnitt | `--fw-space-4` (16) | `--fw-space-3` (12) — i dag 12 i korten, 20 överst |
| Mellan avsnitt | `--fw-space-6` (32) | `--fw-space-5` (24) |
| Kortets inre | `--fw-space-5` (24), `--fw-space-4` (16) vid 400 px och smalare | `--fw-space-3` (12) |
| Mellan kort | `--fw-space-5` (24) mellan upprepningsgrupper | `--fw-space-3` (12) |
| Knappar | 45 px, text 16 | ikonknappar 44 px, textknappar 13–16 |
| Radavstånd i löptext | `--fw-line-body` | `--fw-line-body` |

*Utanför? då:* en storlek utanför rampen, eller en ny textroll — profilen
först (regel 39). En etikett är aldrig ett `h3`.

---

## 4. Färgroller

Värdena är standardskalan. En färgskala (`hav`, `skog`, `skiffer`, `tegel`)
eller en värd byter bara accenten och nodfamiljerna; rollerna står kvar.
Kraven: 4,5 : 1 för text, 3 : 1 för en kontrolls form (WCAG 1.4.11). **Färg
bär aldrig ensam** (K3): ett tillstånd har ord och tecken också.

### Text

| Token | Ljust | Mörkt | Mot ytan (ljust / mörkt) | När |
| --- | --- | --- | --- | --- |
| `--fw-text` | #101828 | #e6edf3 | 17,75 / 14,58 | Rubriker, brödtext, fokusstrecket |
| `--fw-text-strong` | #344054 | #cdd5df | 10,46 / 11,63 | Betonad text i editorn, verktygsradens ikoner |
| `--fw-text-secondary` | #475467 | #b3bdc9 | 7,69 / 9,06 | Brödtext på kortet, hjälptext, väljarens pil |
| `--fw-text-muted` | #667085 | #8b96a5 | 4,97 / 5,75 | Versala etiketter, metadata, tidsstämplar |
| `--fw-text-disabled` | #98a2b3 | #6b7688 | 2,58 / 3,75 | Bara inaktiverade kontroller (undantagna i WCAG 1.4.3) |

### Ytor

| Token | Ljust | Mörkt | När |
| --- | --- | --- | --- |
| `--fw-bg` | #f2f4f7 | #0d1117 | Sidans bakgrund bakom kort och paneler |
| `--fw-surface` | #ffffff | #161b26 | Kort, paneler, fält, dialoger |
| `--fw-surface-subtle` | #f9fafb | #1c2230 | Tonad ruta på en yta: hovring, inaktiv kontroll, sidfält |
| `--fw-surface-raised` | #f9fafb | #252c3b | Menyer och väljare som ligger ovanpå ett fält |
| `--fw-canvas` | #f8fafc | #0d1117 | Arbetsytans bakgrund i editorn |

### Kanter

| Token | Ljust | Mörkt | När |
| --- | --- | --- | --- |
| `--fw-border` | #d0d5dd | #3f4a63 | Delar av: kortets kant, menyytans ram. Avgränsar aldrig en kontroll. |
| `--fw-border-subtle` | #e4e7ec | #232a38 | Avdelare inuti en ruta, inaktiv kontrollkant |
| `--fw-border-control` | #667085 | #8b96a5 | Kanten på en kontroll som **behöver synlig avgränsning**: fält, väljare, kryssrutor, konturknappar (4,97 / 5,75 : 1). Kantlösa verktygs- och ikonknappar får ingen ram. |

### Primärfamiljen — nio tokens

Accenten. En värd som byter den sätter alla nio i båda lägena (README).

| Token | Ljust | Mörkt | När |
| --- | --- | --- | --- |
| `--fw-primary` | #4f46e5 | #818cf8 | Den fyllda knappen, länkar, vald markering, ikryssad ruta |
| `--fw-primary-hover` | #4338ca | #a5b4fc | Hovring på det fyllda |
| `--fw-primary-strong` | #3538cd | #a5b4fc | Accenttext som ska läsas, t.ex. på brickor |
| `--fw-primary-surface` | #eef2ff | #1e2547 | Brickornas och de tonade knapparnas yta, vald rad |
| `--fw-primary-surface-2` | #e0e7ff | #262f52 | Hovring och aktivt läge på tonade ytor |
| `--fw-primary-border` | #c7d2fe | #3b3f7a | Kanter kring tonade ytor |
| `--fw-primary-muted` | #a5b4fc | #4f46e5 | Dämpade accentlinjer |
| `--fw-on-primary` | #ffffff | #10131f | Text och bock på det fyllda — vänder i mörkt läge |
| `--fw-focus-ring` | rgb(79 70 229 / 35 %) | samma | Fokusringens tonade fyllning, se avsnitt 6 |

### Status

Varje status har text, yta och kant. Texten står alltid på sin egen yta.
Grundfärgen (utan led) är för en punkt, en ikon eller ett spår — aldrig text.

| Token | Ljust | Mörkt | När |
| --- | --- | --- | --- |
| `--fw-danger` | #d92d20 | samma | Felpunkt, felikon, den destruktiva huvudhandlingens yta |
| `--fw-on-danger` | #ffffff | samma | Text på den fyllda röda (destruktiv huvudhandling). Vänder **inte** som `--fw-on-primary`: ytan är densamma i båda lägena, och vitt ger 4,83 : 1 där det mörka bläcket gav 3,57 (Fia 30/9, K3). Beslut Astra 30/9, bilaga 2; gäller bekräftelsedialogen |
| `--fw-danger-text` | #b42318 | #fca5a5 | Feltext |
| `--fw-danger-surface` | #fef3f2 | #2a1416 | Felrutans yta |
| `--fw-danger-border` | #fda29b | #7a2e2e | Felrutans kant |
| `--fw-success` | #16a34a | samma | Hälsopricken, reglaget i läge *på* |
| `--fw-success-text` | #15803d | #6ee7b7 | Text för lyckat (4,76 : 1 ljust — smalast av alla) |
| `--fw-success-surface` | #ecfdf3 | #10221a | Lyckat-rutans yta |
| `--fw-success-border` | #75e0a7 | #1f5c43 | Lyckat-rutans kant |
| `--fw-warning` | #f59e0b | samma | Varningspunkt, varningsikon |
| `--fw-warning-text` | #92400e | #fcd34d | Varningstext |
| `--fw-warning-surface` | #fffbeb | #241a08 | Varningsrutans yta |
| `--fw-warning-border` | #fdb022 | #7a5a1a | Varningsrutans kant |
| `--fw-info-text` | #1e40af | #93c5fd | Inforutans text — ett besked utan larm |
| `--fw-info-surface` | #eff6ff | #0f1a2e | Inforutans yta |
| `--fw-info-border` | #93c5fd | #1e4a8a | Inforutans kant |

### Nodfamiljerna

En färg per nodtyp, delad mellan palettens ikon och nodens huvud på
arbetsytan. `solid` är huvudets bakgrund, `tint` är ikonbrickans yta, `ink`
är glyfen på tinten.

| Familj | Solid ljust / mörkt | Tint ljust / mörkt | Ink ljust / mörkt |
| --- | --- | --- | --- |
| Innehåll | `--fw-node-content` #3730a3 / #6c72ea | `--fw-node-content-tint` #eef2ff / #1e2547 | `--fw-node-content-ink` #3730a3 / #a5b4fc |
| Regel | `--fw-node-rule` #6b21a8 / #a968ef | `--fw-node-rule-tint` #f5f3ff / #251a35 | `--fw-node-rule-ink` #6b21a8 / #d8b4fe |
| Uträkning | `--fw-node-calc` #0e7490 / #5fb5d3 | `--fw-node-calc-tint` #ecfeff / #0c2a31 | `--fw-node-calc-ink` #0e7490 / #67e8f9 |
| Tjänsteanrop | `--fw-node-service` #b45309 / #fc9459 | `--fw-node-service-tint` #fffbeb / #2a1e0a | `--fw-node-service-ink` #b45309 / #fcd34d |
| Avslut | `--fw-node-end` #166534 / #5ba46f | `--fw-node-end-tint` #ecfdf3 / #0f2a1a | `--fw-node-end-ink` #166534 / #6ee7b7 |

| Token | Ljust | Mörkt | När |
| --- | --- | --- | --- |
| `--fw-on-node` | #ffffff | #10131f | Text och glyf på nodhuvudets solidfärg — vänder |
| `--fw-node-marking` | #ffffff | samma | Den ljusa brickan i nodhuvudet — ljus i båda lägen |
| `--fw-node-header` | #1f2937 | samma | Den mörka glyfen på brickan — mörk i båda lägen |

### Anteckningen, varumärket, rundturen

| Token | Ljust | Mörkt | När |
| --- | --- | --- | --- |
| `--fw-note-surface` | #fff8d6 | samma | Anteckningslappens yta — gul i båda lägen tills ett mörkt lappformat beslutas |
| `--fw-note-border` | #e6c200 | samma | Lappens kant |
| `--fw-note-label` | #7a5c00 | samma | Lappens versala rubrik |
| `--fw-note-text` | #4a3d00 | samma | Lappens text |
| `--fw-logo-blue` | #2563eb | #3b82f6 | Loggans blå tråd — bara loggan |
| `--fw-logo-green` | #16a34a | #22c55e | Loggans gröna tråd — bara loggan |
| `--fw-spotlight` | #0d9488 | #2dd4bf | Rundturens markering — teal, skild från valets indigo |

*Utanför? då:* aldrig en hex i en komponent. En ny betydelse (inte en ny
nyans av en gammal) är en ny roll: profilen först (regel 39), med
kontrasten mätt i båda lägena.

---

## 5. Skuggor

Hur långt från sidan något ligger. Tre nivåer.

| Token | Ljust | Mörkt | När |
| --- | --- | --- | --- |
| `--fw-shadow-low` | `0 4px 12px rgb(16 24 40 / 5%)` | `0 4px 12px rgb(0 0 0 / 40%)` | Ett kort som lyfts från sidans bakgrund. **Inte** vanliga fält, listrader eller kort i en panel. |
| `--fw-shadow-raised` | `0 6px 18px rgb(16 24 40 / 9%)` | `0 6px 18px rgb(0 0 0 / 50%)` | Menyer, väljare, toaster, en lyft nod |
| `--fw-shadow-floating` | `0 24px 48px rgb(16 24 40 / 24%)` | `0 24px 48px rgb(0 0 0 / 60%)` | Dialoger — det enda som ligger ovanför sidan |
| `--fw-shadow-sm` | = low | = low | Gammalt namn, använd inte i ny kod |
| `--fw-shadow-md` | = raised | = raised | Gammalt namn, använd inte i ny kod |

En meny eller väljare får hela sin yta ur en delad mixin i editorn
(`menu-surface`): ram `--fw-border`, yta `--fw-surface-raised`, skugga
`--fw-shadow-raised`. En ring (`0 0 0 Npx`) är ingen skugga — den är fokus
eller markering.

**Skuggan signalerar lyft, den följer inte varje komponent.** Mätt 30/9:
panelen har ingen vilande skugga på något fält, någon rad eller något
kort, och besökarens fält har ingen. Besökarens kort bär en egen literal,
`0 8px 24px rgb(16 24 40 / 8%)`, som varken är `low` eller `raised`.

*Utanför? då:* en fjärde höjd — profilen först (regel 39).

---

## 6. Fokus

**En definition.** Varje `:focus-visible` tar mixinen `focus.ring`; skriv
aldrig en egen `outline`. Grinden i `css-ratchet` räknar handskrivna.

| Del | Värde | Varför |
| --- | --- | --- |
| Strecket | `outline: 3px solid var(--fw-text)`, offset 2 px | Bär kravet: textfärgen är den starkaste mot ytan |
| Ringen | `box-shadow: 0 0 0 5px var(--fw-focus-ring)` | Gör fokus till vårt; dekoration, ensam 1,76 / 1,34 : 1 |

| Variant | När |
| --- | --- |
| `ring` | Standard, överallt |
| `ring-on-node` | På en nodfärgad yta: strecket i `--fw-on-node` |
| `ring-inset` | Där en förälder med `overflow: hidden` klipper: ringen inåt |

*Utanför? då:* en ny variant är en ny mixin i samma fil, efter profilen
(regel 39) — aldrig en outline på plats.

---

## 7. Rörelse

| Token | Värde | När |
| --- | --- | --- |
| `--fw-motion-duration` | 120 ms | Varje övergång mellan två tillstånd |
| `--fw-motion-ease` | `ease` | Kurvan |

Allt som rör sig står under `prefers-reduced-motion` (K5): tokenet kortar
rörelsen, det avgör inte om den sker. Rundturens fjäder (220 ms,
`cubic-bezier(0.34, 1.35, 0.64, 1)`) är ett skrivet undantag: något som
anländer, inte ett tillstånd som byts. Kryssrutans bock (90 ms) och
reglagets tumme (120 ms) går i dag på `ease-out`. Beslut 7: de gemensamma
tokenen är standard också för dem; svepet är en egen omgång.

**Väntestatus — ett särskilt mönster** (Astra 1/10 2026, berättelse 144;
*"detta är ett särskilt mönster för väntestatus, inte en ändring av vanliga
övergångar"*):

| Egenskap | Värde |
| --- | --- |
| Texten pendlar mellan | `--fw-text-secondary` (vila och lägsta läge) och `--fw-text-strong` (toppen), **utan ändrad opacitet** |
| En hel puls | 1,6 s, `--fw-motion-ease` |
| `prefers-reduced-motion` | texten står stilla i `--fw-text-secondary` |
| Var | *Väntar på svar …* medan visaren väntar på värdens kvitto (eller ett annat värdsvar); aldrig mellan två lokala steg |

Mätt (Ted 1/10, nio punkter av pulsen): ljust lägst 7,69:1, mörkt lägst
9,06:1 mot kortet — texten är läsbar genom hela rörelsen. Astra: *"förstärk
den inte."* Talen bor som tre SCSS-variabler på ett ställe i
`guide-preview.scss` (`$waiting-pulse-*`).

**Kortets höjd mellan lokala steg** (144, kriterium 1): 220 ms, samma som
stegets intoning (`guide-preview-step-in`) — en övergång på en mätt höjd,
aldrig `interpolate-size` (K18). Klipp under `prefers-reduced-motion` och i
nodkortets miniatyr.

*Utanför? då:* en ny tid eller kurva — profilen först (regel 39).

---

## 8. Klickytor

| Token | Värde | När |
| --- | --- | --- |
| `--fw-control-height` | 44 px | Allt besökaren trycker på (K6). Också editorns täta ikonrader — brickans meny. Används som `min-height`, så knappen växer med texten. |

| Undantag | Mått | Skäl |
| --- | --- | --- |
| Textredigerarens verktygsrad | 48 × 48 px | Johan 28/9 (*"48 px, gap 4"*): en tät rad knappar på iPad. Literal — inget token, en användare är ingen skala. |
| Editorns textfält och väljare | **45 px** — standard | Mätt 30/9 i panelen: alla 268 textfält, väljare och sifferfält i 52 noder är 45 px (utfyllnad 12, text 16 px, kant 1 px), liksom den sökbara väljaren. 38 px är vad K6 *tillåter* i panelen (Johan 15/9), inte vad som byggs. |
| Editorns kompakta fält | finns inte | Ingen kompakt variant finns i panelen i dag. Den enda lägre textrutan är chipväljarens sökruta, 27 px, som står *inuti* en kontroll på 45. Behövs en kompakt variant är det en profiländring (PRAXIS 39). |
| Kryssruta, radioknapp | 18 px syns | Etiketten tar trycket; måttet gäller träffytan, inte det som syns. |
| Länk i löpande text | — | WCAG:s eget undantag. |

*Utanför? då:* en kontroll under 44 px på besökarens yta är ett K6-undantag
och skriver skälet bredvid sig — och profilen först (regel 39).

### Gruppens gemensamma felmarkering (Astra 1/10 2026, bilaga 11)

En radio- eller kryssgrupp i fel markeras **en gång**: en 3 px stapel i
`--fw-danger` längs startkanten (4,84:1 ljust / 3,59:1 mörkt mot ytan),
feltexten direkt under hela gruppen, inne i kortet; inget alternativ får
en egen röd ruta. **Uttryckligt undantag från "samma vänsterkant":** hela
gruppen — etikett, alternativ och feltext — flyttas 15 px in medan felet
står, så markeringen håller sig i kortet och fokus får plats också på
telefon. Normal- och valt läge behåller vänsterkanten.

### Fråga och svar i granskning och kvitto (Astra 1/10 2026, bilaga 11)

| Roll | Form |
| --- | --- |
| Fråga | 14 px, `--fw-text-secondary` |
| Svar | 16 px / 400, `--fw-text` — lästa och inmatade värden i 400 står fast, aldrig 600 |
| Grupprubrik (*Pass 1*) | 14 px / 700 |
| Avstånd | mindre mellan fråga och svar än till nästa frågepar |

I vänteläget (144) får svaren `--fw-text-secondary`; storlek och avstånd bär
hierarkin ändå, och när kvittot är klart återgår svaren till `--fw-text`.
Vid misslyckad sändning är svaren fullt läsbara i `--fw-text`, och rubrik
och besked beskriver misslyckandet (Astra, bilaga 12). Granskningens
sidrubriker (*Menyn*, *Pass du vill gå på*) följer visarens
avsnittsrubrik 18 px / 700 — inte editorns 15; *Pass 1* stannar som
underordnad grupprubrik 14/700. Kvittots lista behåller sina punkter.
Betygsskalans siffra: 16/400 i `--fw-text` när den är själva svaret, 14 px
sekundär när den kompletterar en utskriven etikett; i valt läge följer
båda den valda ytans kontrasterande textroll.
Betygsskalans svarstexter, också *Inte aktuellt* och *Vet ej*: 16 px / 400
genomgående — valet markeras av kontrollen, inte av vikten.

### Panelens grupper (Astra 1/10 2026, bilaga 11)

12 px inom en grupp, 24 px mellan grupper, 24 px före *Pröva ett värde*;
inga staplade marginaler (31/39 px under Validering, 40 px efter sidans
rådtext var sådana). Textfrågans ordning: Frågan (rubrik, beskrivning,
varför) → Fältet (platshållare, visas som, vad fältet är) → Validering
(obligatoriskt, begränsningar, format; *Pröva ett värde* som undergrupp) →
Placering i sidan (flytta, fältbredd, ny rad) → Villkorsstyrd synlighet
(egen grupp) → Avancerat (tekniska inställningar och Mall) → Tekniska
fakta (nodtyp, modul, variabeltyp, position) sist. Flervalsfrågan: Frågan
→ Svaren → Validering. Sidan: Sidinnehåll → Upprepning → Tekniska fakta.
Övriga frågetyper får samma uppdelning (fältets funktion i *Fältet*);
regel, uträkning och resultat behåller sin befintliga uppdelning (villkor,
formel, resultat) med 24 px där uppgiften byter karaktär. *Avancerat* och
*Validering* är samma rubriknivå, 15 px / 700; Avancerat har samma ritade
chevron som övriga utfällningar, i texttoken, tydlig i båda teman (Astra,
bilaga 12).

---

## 9. Lager

| Token | Värde | När |
| --- | --- | --- |
| `--fw-z-raised` | 1 | Lyft inom sin egen ruta: en vald rad, ett handtag |
| `--fw-z-sticky` | 10 | Sidhuvuden och verktygsrader som står kvar när innehållet rullar |
| `--fw-z-popover` | 20 | Menyer, väljare, verktygstips — knutna till en utlösare |
| `--fw-z-overlay` | 30 | Skymningen som dämpar sidan |
| `--fw-z-dialog` | 40 | Dialogen ovanpå skymningen |

Två saker på samma lager ordnas av dokumentordningen. Editorns helfönsterläge
(`2147483000`) är inget lager i den här stapeln: det ska över värdsidans egna.
En `<dialog>` med `showModal()` ligger i webbläsarens översta lager och
behöver inget av dem.

*Utanför? då:* ett sjätte lager — profilen först (regel 39).

---

## 10. Markörer (K19)

Egna markörer för **egna gester**, systemets för systemets.

| Markör | Gest | Utseende |
| --- | --- | --- |
| `col-resize` | Dra panelens kant | Ritad, 24 × 24, mörk fyllning, 1 px vit kant |
| `move` | Panorera arbetsytan, flytta en nod | Ritad, som ovan |
| `grab` / `grabbing` | Ta en rad i en lista som kan ordnas om: nodhuvudet, svarsalternativen, versionerna | Ritad hand, vit med mörk kant |

Pilen, pekhanden på länkar och knappar och textmarkören rörs **aldrig**: det
är på dem Windows tillgänglighetsval verkar. En deklaration skrivs
`cursor: cursors.$namn;` ur editorns markörfil, med nyckelordet kvar som
reserv.

*Utanför? då:* en ny gest med egen markör — profilen och K19 först
(regel 39).

---

## 11. Ikoner

| Egenskap | Riktvärde | Anmärkning |
| --- | --- | --- |
| Rityta | `viewBox="0 0 24 24"` | 16 av 25 ritade ikoner i editorn och visaren |
| Streck | 2 px, runda ändar och hörn | Samma vikt som knappens *Ta bort* och väljarens pil |
| Färg | `currentColor`, eller en mask som fylls ur ett token | Aldrig en färg skriven i ikonen |
| Ikonens ruta | 18 × 18 px (beslut 8) | Rutan är ytan ikonen får i layouten: `width` och `height` på `svg` eller masken. I dag 16, 18 och 20 px. |
| Ritad storlek | inom rutan, enligt ritytan | Det synliga strecket fyller inte rutan: en pil i 24-rityta med 3 px luft runt ritar ungefär 13 px i en 18-ruta. Ritad storlek jämförs aldrig mot rutans. |
| Ordet | står kvar | En ikon är en genväg för ögat (K3) — med undantaget nedan |

**Undantaget: etablerade ikonknappar.** Zoom in och ut, anpassa och
helskärm i arbetsytans kontroller, flyttpilar, fällpilen, draghandtaget,
rensa-krysset och stäng får stå utan synligt ord. Villkoren:

- Ett tillgängligt namn som säger handlingen och vad den gäller:
  *Flytta Kök uppåt*, inte *Upp* och aldrig bara tecknet ↑.
- En hjälptext vid hovring och fokus där ikonen inte är självklar i
  sammanhanget.
- Minst 44 × 44 px träffyta, som alla ikonknappar i en tät rad (K6).

Mätt 30/9: kortens pilar och betygsstegens pilar har namn; tjänsteanropets
↑ och ↓ har det inte (avvikelse 6 under Visuell hierarki).

**Panelernas kategori- och flikknappar (beslut 14, Johan 6/10).** Knapparna
i de infällda spalterna — vänsterlistens kategorier och högerspaltens
flikgenvägar — är reglage, inte innehåll. De bär därför **en färg** oavsett
vilken kategori de öppnar: innehållsfamiljens `--fw-node-content-ink` på
`--fw-node-content-tint`, i en 24 px platta med `--fw-radius-md` och 18 px
glyf, i båda teman. Nodernas egna färger står kvar på arbetsytan och i
kategorimenyn, där färgen betyder något. Motiv: Avslut = flagga, så att ögat
bara betyder Förhandsgranskning; Mallar = överlappande kort, inte @, som säger
e-post. Övriga motiv är palettens. Öppen/aktiv knapp: kant `--fw-primary`,
yta `--fw-primary-surface` — en form, inte bara en färg. Mätt 6/10 i riktig
panel, båda teman (`tools/prototypes/editor-panels/icon-contrast-measure.mjs`,
repots egen formel): glyf mot platta 8,88 / 7,47, glyf mot knapp 9,93 / 8,64,
aktiv kant mot list 6,29 / 5,78. Plattan mot knappen är 1,12 / 1,16 — den är
en ton, inte en gräns; gränsen är knappens kant (4,97 / 5,75) och betydelsen
bärs av glyfen. Jämförelsebilder ur `icon-rail-capture.mjs` (LOGG 6/10).

*Utanför? då:* en ny ikonstorlek eller strecktjocklek, eller en ny
ikonknapp utan ord — profilen först (regel 39).

---

## Astras sju förtydliganden (30/9)

Rad för rad ur granskningen av version 1, med var svaret nu står.

| # | I version 1 | Nu | Står i |
| --- | --- | --- | --- |
| 1 | Besläktat: "halva" och "ett steg ned" | Halva relationens avstånd, med tokenet utskrivet: 24 → 12, 16 → 8, 8 → 4 | 1. Avstånd |
| 2 | Editorns textfält 38 px | **Mätt: 45 px** i alla 268 fält i panelen. Standard 45; kompakt variant finns inte | 8. Klickytor |
| 3 | Versaler för panelens avsnitt | Meningsstil är målbilden; befintliga versaler är dokumenterad avvikelse tills svepet | 3. Typografi |
| 4 | `border-control` på allt man trycker på | Bara kontroller som behöver synlig avgränsning; kantlösa verktygsknappar får ingen ram | 4. Färgroller, Kanter |
| 5 | `shadow-low` på vilande fält och rader | Inte standard för fält, rader eller panelens kort; skuggan signalerar lyft | 5. Skuggor |
| 6 | Ordet står alltid kvar | Undantag för etablerade ikonknappar, med tillgängligt namn och hjälp vid behov | 11. Ikoner |
| 7 | Knappens radie för allt man trycker på | Komponenttypen avgör radien även när saken är klickbar | 2. Radier |

---

## Beslut och öppna frågor

Astras beslut på version 2 (30/9, via Johan) står markerade **Beslutat**.
**Öppet** väntar på en jämförelse eller på Johan. Svepet av det gamla är
alltid en egen omgång.

1. **Beslutat: täthet.** 12 px mellan fältgrupper i panelen och 16 px i
   visaren, **inom samma avsnitt**. Mellan skilda avsnitt ett större
   avstånd: `--fw-space-5` (24) i panelen, `--fw-space-6` (32) i visaren
   (1. Avstånd). Panelens 20 byts inte blint; varje förekomst avgörs efter
   vilken relation den står för.
2. **Beslutat: 48 px mellan sajtens större innehållssektioner**
   (`--fw-space-7`, Astra 30/9, B8). Startsidans 72 / 56 och *Kom igång*s
   36 / 40 lämnas till egna jämförelser.
3. **Beslutat: kortets inre, 24** (`--fw-space-5`) i bred visare och 16
   (`--fw-space-4`) när visaren är 400 px eller smalare — komponentens
   responsiva variant, styrd av visarens egen bredd (Astra 30/9, B8).
4. **Beslutat: knappar i rad, 8 px** (`--fw-space-2`).
5. **Beslutat: rubriker.** Vyrubrik 24 px (`--fw-font-size-3xl`),
   avsnittsrubrik 18 px i visaren (`2xl`) och 15 px i editorn (`lg`).
6. **Beslutat: versalerna.** Meningsstil är målbilden. Svepet görs
   separat; befintliga versaler står kvar tills dess som dokumenterad
   avvikelse, inte som permanent undantag (3. Typografi).
7. **Beslutat: rörelse.** De gemensamma tokenen `--fw-motion-duration`
   och `--fw-motion-ease` är standard, också för kryssrutan och reglaget.
8. **Beslutat: ikoner 18 px**, med ikonens ruta skild från dess ritade
   storlek (11. Ikoner).
9. **Beslutat: hjälptext.** Svarsinstruktionen står före kontrollen. Den
   fördjupade *Varför frågar vi det här?* behöver inte flyttas dit.
10. **Beslutat: plusmenyn** i textfältets verktygsrad är godkänd som
    beskriven menyutlösare i en verktygsrad.
11. **Beslutat: 24 px mellan upprepningsgrupper** (`--fw-space-5`).
12. **Beslutat: plusset behålls** (Astra 30/9, B9, efter jämförelsen med
    bricka, bubbla och klammer). Namnet är *Infoga variabel* i både text-
    och formelfältet, med samma tooltip; formelplussets träffyta är minst
    44 × 44 utan att täcka formeltexten.
13. **Lägg till regel och Annars — beslutat (Astra 30/9):** ordningen är
    regelkort → *Lägg till regel* → *Annars*; vid tom samling instruktion →
    *Lägg till regel* → *Annars* — samma knapptext i tomt och fyllt läge
    (Astras korrigering i godkännandet av den tomma samlingen). Berättelsekriteriet (Annars
    direkt efter korten) uppdateras till samma ordning; Ted i omgång B1.
14. **Beslutat: panelernas knappar i en färg (Johan 6/10, förslag B).**
    Innehållsfamiljens ink på tint, 24 px platta, flagga för Avslut och
    kort för Mallar — se 11. Ikoner. Gäller vänsterlistens kategorier och
    högerspaltens flikgenvägar (stories 145/146); noderna behåller sina
    färger.

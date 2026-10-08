/**
 * Orden på sidan där guiden ligger hos värden (berättelse 124, kriterium 22).
 *
 * ## Varför de ligger samlade
 *
 * Johan frågade 18/9: *"fattar man återställ?"* Svaret beror inte på ordet
 * ensamt utan på att det betyder samma sak varje gång man möter det. Tre saker
 * finns, och de heter alltid detsamma:
 *
 * - **Arbetskopia** — det du redigerar.
 * - **Publicerad** — det besökarna ser.
 * - **Historik** — det som varit.
 *
 * Synonymer är förbjudna, och det är hela poängen med att de står här: *återta*
 * och *nollställ* betyder något annat för den som läser dem, och *utkast* och
 * *arbetskopia* om samma sak gör att man börjar undra om det är två saker.
 * `guide-storage-words.test.ts` fäller dem.
 *
 * **Aldrig ett ensamt *Återställ*.** Knappen heter *Återställ version 3*, för
 * *Återställ* utan nummer läser som *ångra allt*. Samma sak i frågan och i
 * bekräftelsen efteråt: numret följer med.
 *
 * ## Varför en modul och inte editorns ordlista
 *
 * Det här är värdens ord, inte verktygets. Editorns ordlista är tvåspråkig och
 * översätts; den här sidan finns bara på svenska och bara under `dev/`. Den dag
 * en riktig värd bygger samma rad översätter den sina egna ord.
 */

import { possessive } from "../editor/localization/possessive";

import type { ConfirmationText } from "../editor/components/confirmation-dialog/confirmation-dialog";

/** *Version 3*, som numret skrivs överallt. */
export const versionLabel = (n: number): string => `Version ${n}`;

/**
 * *sparad 22:50* — och *sparad 22:50 av Nisse Hult* när det var någon annan
 * (berättelse 127).
 *
 * Namnet står **bara** när det inte är den inloggades eget. *Sparad 22:50 av
 * dig* är en upplysning om ingenting, och en rad som säger den varje gång är en
 * rad man slutar läsa — och då står den där även den dagen den betyder något.
 *
 * En bit och inte två färdiga meningar per fall: det här är svenska ensamt (se
 * toppkommentaren), så ordföljden är given, och alternativet hade varit fyra
 * varianter av två meningar.
 *
 * Utanför `WORDS` för att den används av två av dess egna rader, och ett objekt
 * som slår upp i sig själv under sin egen initiering är ett objekt TypeScript
 * inte kan ge en typ.
 */
export const savedClock = (clock: string, by = ""): string =>
  by === "" ? `sparad ${clock}` : `sparad ${clock} av ${by}`;

/**
 * *Anna Anderssons version* — namnet i genitiv, och ingen gissning om kön.
 *
 * Regeln är **lånad och inte skriven här**
 * (`editor/localization/possessive`): krockrutan säger *Ladda om och se Anna
 * Anderssons ändringar* om samma person i samma ögonblick, och två kopior av
 * en tvåradersregel är två kopior som en dag stavar olika. Den här sidan är
 * enspråkig, så språket är alltid svenska.
 *
 * Kopian stod kvar här till 19/9 — en `cp` ur en mutationssäkerhetskopia tog
 * tillbaka den, och inget test märkte det, för båda stavade likadant. Det är
 * precis hur en andra kopia överlever.
 */
const ownerOf = (name: string): string => possessive(name, "sv");

export const WORDS = {
  /* ── De tre orden ────────────────────────────────────────────────────── */

  workingCopy: "Arbetskopia",
  published: "Publicerad",
  history: "Historik",

  /* ── Brickan, som säger vilket av de tre man står i ──────────────────── */

  badgePublished: "Publicerad",
  badgeWorkingCopy: "Arbetskopia",
  /*
   * **Ett ord, inte två** (Johan 18/9).
   *
   * Brickan sa *Version 3 · skrivskyddad* medan canvasen sa *LÄSLÄGE* och
   * panelen *Läsläge — guiden går inte att ändra här* om samma tillstånd. Två
   * ord för en sak får den som läser dem att leta efter skillnaden, och det
   * fanns ingen.
   *
   * *Skrivskyddad* ströks. **Rättat efter bilderna** (Johan 18/9 kväll: *"Låst
   * läge passar bättre än Läsläge, annars en annan ikon"*): brickan skiljer på
   * de två tillstånden i stället för att kalla dem samma sak.
   *
   * - **Låst** med hänglås — någon annan håller guiden just nu.
   * - **Läsläge** utan ikon — man tittar på en äldre version.
   *
   * Hänglåset betyder *en annan människa*, och satt på en gammal version hade
   * det lovat något som inte fanns. Raden under säger vilket av fallen det är
   * — *Låst av Anna Andersson sedan 08:15* respektive *Du tittar på version
   * 3* — så numret är inte borta, det står bara på ett ställe i stället för
   * två. Canvasens LÄSLÄGE-märke står kvar i båda: det är editorns tillstånd
   * och inte guidens.
   */
  badgeReadOnly: "Läsläge",
  badgeLocked: "Låst",

  /* ── Meningen bredvid brickan ────────────────────────────────────────── */

  statusPublished: (n: number): string => `${versionLabel(n)} publicerad · inga opublicerade ändringar`,
  /** Se `savedClock` ovan: namnet står bara när det var någon annans sparning. */
  saved: savedClock,
  statusSavedAt: (n: number, clock: string, by = ""): string =>
    `Opublicerade ändringar sedan ${versionLabel(n).toLowerCase()} · ${savedClock(clock, by)}`,
  /*
   * Den guide ingen publicerat än — två meningar, och skillnaden är om det
   * finns en sparning att säga tiden på.
   *
   * *Inte publicerad än* och inte *Ingen version är publicerad än*: det är
   * samma ord som listan använder om samma tillstånd (`guides-words.ts`,
   * `unpublished`), och två formuleringar om en sak får den som läser dem att
   * leta efter skillnaden. Ordbytet gjordes 19/9, när brickan över samma guide
   * rättades från *Publicerad* till *Arbetskopia*.
   *
   * Tiden står i den andra formen därför att det är just medan man bygger den
   * första versionen man undrar om det sparas — och beskedet sa det inte
   * (Johan 19/9).
   */
  statusFirst: "Inte publicerad än · det du bygger blir den första",
  statusFirstSavedAt: (clock: string, by = ""): string =>
    `Inte publicerad än · ${savedClock(clock, by)}`,
  statusReadOnly: (viewing: number, published: number): string =>
    `Du tittar på ${versionLabel(viewing).toLowerCase()} · besökarna ser ${versionLabel(published).toLowerCase()}`,
  /*
   * Bekräftelsen efter en återställning, och den säger båda halvorna: vad som
   * hände med arbetskopian, och att besökarna inte märkt något.
   */
  statusRestored: (restored: number, published: number): string =>
    `${versionLabel(restored)} återställd som arbetskopia · besökarna ser ${versionLabel(published).toLowerCase()}`,
  /*
   * Och samma meningar utan nummer, för en värd som inte numrerar sina
   * versioner. Numret är värdens (`docs/LAGRING-KONTRAKT.md`); saknas det säger
   * sidan mindre i stället för att hitta på ett — ett påhittat nummer är fel
   * för alla utom den som hittade på det.
   */
  statusSavedAtUnknown: (clock: string, by = ""): string =>
    `Opublicerade ändringar · ${savedClock(clock, by)}`,
  statusPublishedUnknown: "Publicerad · inga opublicerade ändringar",
  /*
   * Utan nummer säger raden bara vilken sorts version man tittar på. Att den
   * inte går att ändra står i brickan bredvid, en gång — se `badgeReadOnly`.
   */
  statusReadOnlyUnknown: "Du tittar på en äldre version",
  statusFailed: (reason: string): string => `Kunde inte spara: ${reason}`,

  /* ── Någon annan hann före (127, och rutan i 129) ─────────────────────── */

  /*
   * Raden som blir kvar när någon valt *Avbryt* i krockrutan.
   *
   * Berättelse 127 sa hela saken i en rad; sedan 129 säger rutan det, och det
   * här är allt som står efteråt. Två meningar hade varit att säga samma sak på
   * två ställen — men raden får inte heller vara tyst: en sida som slutat spara
   * och inte säger det är en sida man skriver vidare i.
   *
   * *Välj* och inte *Försök igen*: det finns ingenting att försöka igen, det
   * finns ett val som inte är gjort.
   */
  statusPaused: "Sparar inte — välj i rutan",
  statusPausedAction: "Välj",

  /* ── Låst av någon annan (berättelse 129) ─────────────────────────────── */

  /*
   * Raden när någon annan håller låset: **ett namn och en relativ tid**.
   *
   * Den hade tre klockslag till 19/9 — *sedan 08:15 · sparade senast 08:29 ·
   * aktiv senast 08:31* — och de svarade var för sig på en riktig fråga. Johan
   * efter mätningen: *"Jag tycker inte det håller måttet ännu … lite skakigt,
   * kan förstå varför Sitevision gjorde sitt designval."* Tre klockslag i en
   * rad man passerar på väg någon annanstans är tre uppgifter att jämföra
   * innan man vet om man ska bry sig, och frågan raden ska svara på är en enda:
   * *sitter någon här nu?*
   *
   * Relativ tid svarar på just den. *Aktiv för 3 minuter sedan* säger att hon
   * är kvar; *aktiv för 12 minuter sedan* säger att låset snart är borta. Ett
   * klockslag kräver att man vet vad klockan är.
   *
   * **De två faktaraderna är inte borta** — de står i Ta över-dialogen, där de
   * behövs: den som ska ta över gör det på fakta. Skillnaden är var de står,
   * inte om de finns (129:s skärning, punkt 1).
   */
  lockedBy: (name: string, activeAgo: string): string =>
    activeAgo === "" ? `Låst av ${name}` : `Låst av ${name} · aktiv ${activeAgo}`,

  /*
   * *nyss*, *för en minut sedan*, *för 12 minuter sedan*.
   *
   * Ingen siffra under en minut: *för 0 minuter sedan* är en siffra som säger
   * mindre än ett ord. Och *en* och inte *1*, som svenskan skriver ental i
   * löptext — raden är en mening, inte en tabell.
   *
   * Timmar behövs inte: låset lever tio minuter (`LOCK_MINUTES`), och ett lås
   * som passerat sin bäst-före finns inte — då står ingen låsrad alls.
   * Skulle en värd sätta en längre livslängd säger raden ändå sanningen, bara
   * i minuter.
   */
  activeAgo: (minutes: number): string =>
    minutes < 1 ? "nyss" : minutes === 1 ? "för en minut sedan" : `för ${minutes} minuter sedan`,

  takeOver: "Ta över",
  /*
   * Frågan före ett övertagande, i **tre delar som gör var sitt jobb** (Johan
   * 19/9 natt, efter bilden i telefonen: *"det måste kunna vara lite tydligare
   * på den här rutan"*).
   *
   * Formen var en rubrik som var ett påstående och ett stycke på fem rader
   * under den — två tider, vad som händer den andre, vad som kan gå förlorat,
   * och hur autosparen går. Den som läste fick leta efter frågan själv.
   *
   * 1. **Rubriken är frågan.** Den som bara läser den vet vad knappen gör.
   * 2. **Fakta som rader**, etikett och värde (`facts` i dialogen). Två tider
   *    och inte tre: *sedan* säger ingenting om risken, och raden bakom
   *    dialogen har alla tre för den som vill ha dem.
   * 3. **Konsekvensen i en mening.** Autosparens takt nämns inte längre — det
   *    är ett skäl, inte ett faktum den som väljer behöver.
   *
   * Hela namnet i meningen, och inget pronomen: namnet ur ett token kan vara
   * ett enda ord, så ett förnamn går inte att skala ut — och *hon* om en
   * verklig människa är fel varje gång det är fel.
   */
  takeOverTitle: (name: string): string => `Ta över guiden från ${name}?`,
  takeOverSavedLabel: "Sparade senast",
  takeOverActiveLabel: "Aktiv senast",
  takeOverNothingSaved: "Inget sparat än",
  /**
   * Meningen i **delar**, för att tiden ska väga lika mycket som i raderna
   * ovanför (Johan 19/9: *"Den tredje tiden bör vara fetmarkerad i alla
   * fall"*). Det är samma uppgift sedd en gång till, och i löptext läses den
   * förbi.
   *
   * Delar och ingen HTML-sträng: namnet kommer ur en värds session (K11). Utan
   * en tid blir det en enda del, för då finns ingenting att framhäva.
   */
  takeOverMessage: (name: string, savedAt: string): ConfirmationText =>
    savedAt === ""
      ? [`${name} får läsläge. Det som skrivits går förlorat — som mest några sekunder.`]
      : [
          `${name} får läsläge. Det som skrivits efter `,
          { strong: savedAt },
          " går förlorat — som mest några sekunder.",
        ],

  /*
   * Rutan i det fönster som förlorade låset (129:s skärning, punkt 2).
   *
   * Det stod i **raden** till 19/9, med ett klockslag, och under den en rad med
   * två val. Tre saker hände samtidigt för någon som inte bett om något av
   * dem: editorn slutade gå att skriva i, en rad bytte text, och ett val dök
   * upp. Den som inte redan förstått vad ett lås är förstår ingen av dem.
   *
   * Nu: en ruta som avbryter, säger vad som hänt, och har en väg vidare. Valet
   * om det som inte hann sparas finns kvar — men i räddningsraden, den dag man
   * faktiskt får redigera igen, och inte i samma ögonblick som beskedet.
   *
   * **Rubriken är händelsen, meningen är konsekvensen**, samma tre delar som
   * Ta över-dialogen (129, Johan 19/9 natt). Inget klockslag: att det hände
   * just nu är hela nyheten, och en tid att jämföra med är precis vad rutan
   * skär bort.
   */
  takenOverTitle: (name: string): string => `${name} tog över guiden.`,
  /*
   * Samma sak när det var en själv, från en annan dator. Ingen tog något av
   * någon — men fönstret man sitter i är inte längre det som arbetar, och det
   * måste stå någonstans.
   */
  takenOverBySelfTitle: "Du öppnade guiden på en annan dator.",
  /*
   * Och den andra meningen, som bara sägs när det finns något att säga den om.
   *
   * Fanns inget osparat är kopian inte skriven, och en rad om en säkerhetskopia
   * som inte finns är ett löfte sidan inte kan hålla. Då säger rutan vad som
   * gäller i stället — läsläget är det som ändrades.
   */
  /*
   * Samma mening som räddningsraden (`rescueHere` nedan), med flit.
   *
   * Stod till UX-genomgången 129–131 som *Dina osparade ändringar finns kvar
   * …* — och när kopian väl syns här har sidan redan lagt den i webbläsarens
   * lagring (129: *"i samma ögonblick krocken upptäcks, innan rutan visas"*),
   * så *osparade* var redan fel den dagen den skrevs, inte bara en avvikande
   * formulering. Samma fakta i förlorarrutan och i räddningsraden ska heta
   * samma sak — annars undrar den som möter båda om det är två saker.
   */
  takenOverRescue: "Dina ändringar finns kvar i den här webbläsaren.",
  takenOverReadOnly: "Guiden är i läsläge tills du får den tillbaka.",
  takenOverOk: "OK",
  /* ── Det som inte hann sparas (berättelse 129, Johan 18/9) ────────────── */

  /*
   * En **tyst mening**, och priset under var sin knapp.
   *
   * Tre former har stått här. *Hämta tillbaka · Kasta* var två kommandon som
   * förutsatte att man förstått vad som hänt. Sedan en fråga — *Fortsätta där
   * du var, eller börja från Annas version?* — som Johan bad om 18/9 för ovana
   * användare, och den var bättre: knapparna behövde inte läsas.
   *
   * Men frågan sa samma sak som knapparna säger, en gång till och i en annan
   * ordning, och sedan 19/9 står priset under var och en av dem
   * (`rescueKeepCost`, `rescueDropCost`). Tre lager om samma val är det Johan
   * 19/9 kallade skakigt. Kvar blir det enda raden vet som knapparna inte
   * säger: **var arbetet ligger**. Resten står i valen och deras pris.
   *
   * Samma första mening som `rescueLocked`, `rescueWaiting` och
   * `takenOverRescue` (förlorarrutan ovan), för det är samma besked i fyra
   * lägen — det som skiljer är vad man får göra åt det.
   */
  rescueHere: "Dina ändringar finns kvar i den här webbläsaren.",
  /*
   * Förstahandsvalet när kopian bär sin utgångspunkt (berättelse 131).
   *
   * Det står **i stället för** *Fortsätt där jag var* och aldrig bredvid det:
   * *Fortsätt* är samma sak som *Min* på varje rad i sammanslagningen, fast
   * utan att se vad man skriver över, och ett val som gör mindre än ett annat
   * ska inte stå bredvid det (Johans regel för krockrutan 19/9, och den gäller
   * här av samma skäl).
   *
   * Kopior skrivna innan utgångspunkten följde med saknar den. Då står
   * *Fortsätt där jag var* kvar som förut — hellre det gamla valet än en
   * sammanslagning räknad mot en gissad startpunkt.
   */
  rescueMerge: "Slå ihop ändringar",
  rescueMergeCost: (name: string): string =>
    name === ""
      ? "Du går igenom ändring för ändring. Båda versionerna behålls."
      : `Du går igenom ändring för ändring. Både ${possessive(name, "sv")} och dina ändringar behålls.`,
  rescueKeep: "Fortsätt där jag var",
  rescueDrop: (name: string): string =>
    name === "" ? "Börja från den sparade versionen" : `Börja från ${ownerOf(name)} version`,

  /*
   * Och priset under var sin knapp.
   *
   * Johan 19/9, efter att ha tryckt: *"När jag trycker Fortsätt där jag var
   * försvinner Annas ändringar."* Det är precis vad knappen gör — hennes
   * arbete sedan stämpeln ersätts, och hon möter krockrutan vid sin nästa
   * sparning — men raden sa det inte. Krockrutan säger det under vart och ett
   * av sina val; raden frågade om samma sak och teg.
   *
   * Två meningar och inte en: den första är vad som händer henne, den andra
   * vad hon får göra åt det. Utan namn finns ingen annan att förlora något —
   * då är det den sparade versionen som ersätts, och ingen behöver välja.
   */
  rescueKeepCost: (name: string, savedAt: string): string =>
    savedAt === ""
      ? ""
      : name === ""
        ? "Den sparade versionens ändringar ersätts."
        : `${ownerOf(name)} ändringar sedan ${savedAt} ersätts. ${name} får välja vid sin nästa sparning.`,
  /*
   * **Ingenting kastas** (Johan 20/9: *"lite förvirrande att det står dina
   * ändringar kastas"*).
   *
   * Meningen var sann när den skrevs: knappen tog bort kopian och där tog
   * arbetet slut. Sedan 131 gäller att inget går förlorat, och då får ingen
   * knapp i raden säga *kastas* — knappen lägger undan kopian i historiken
   * först, precis som sammanslagningen gör med båda.
   *
   * Tre val, ett språk: sammanslagningen behåller båda, den här behåller den
   * andres och sparar mina undan, och ingenting kastas. *Kasta ändringarna* i
   * menyn är kvar som det medvetna valet, med sin egen fråga — det är
   * skillnaden mellan att välja bort något och att bli av med det.
   */
  rescueDropCost: (at: string): string =>
    at === ""
      ? "Dina ändringar följer inte med, men finns kvar i historiken."
      : `Dina ändringar från ${at} följer inte med, men finns kvar i historiken.`,
  /*
   * Och när undanläggningen inte gick.
   *
   * Då görs ingenting alls: kopian ligger kvar och raden står kvar. Att ändå
   * ta bort den hade varit att kasta något medan knappen lovade motsatsen.
   */
  rescueNotKept:
    "Ändringarna kunde inte sparas i historiken, så ingenting togs bort. Försök igen.",

  /*
   * Och samma kopia medan någon annan håller låset.
   *
   * Den skickade till *Ta över* till 20/9, och skälet höll så länge det enda
   * valet var att skriva rakt in i guiden: *Fortsätt där jag var* ersätter den
   * andres arbete utan att någon sett vad som försvinner.
   *
   * **Sammanslagningen gör inte det.** Den fryser båda kopiorna, tar hens
   * senast sparade graf som ena sidan och min som andra, och skriver ett
   * resultat som behåller båda. Hen ser det inom tio sekunder (pollningen) och
   * får vid sin nästa sparning krockrutan med *Slå ihop* överst. Låset finns
   * för att två inte ska skriva på varandra **utan att veta det** — en
   * granskad sammanslagning är motsatsen till det (Johan 20/9: *"varför inte
   * bara kunna få Slå ihop ändringar där och då?"*).
   *
   * Så raden säger bara var arbetet ligger, och valen står för sig själva.
   * *Ta över* behövs fortfarande — men för att fortsätta **redigera** efteråt,
   * inte för att rädda det som ligger här.
   */
  rescueLocked: (at: string): string =>
    `Dina ändringar${at === "" ? "" : ` från ${at}`} finns kvar i den här webbläsaren.`,
  /*
   * Och för den som inte får ta över — en redaktör, eller den som tittar på en
   * gammal version. Att peka på en knapp som inte finns är värre än att tiga
   * om den: beskedet är att arbetet ligger kvar, och inget mer.
   */
  rescueWaiting:
    "Dina ändringar finns kvar i den här webbläsaren. De ligger kvar tills du får redigera igen.",

  /* ── Sammanslagningen (berättelse 131) ───────────────────────────────── */

  /*
   * Vad de frysta kopiorna heter i historiken står **inte här**.
   *
   * Den stod här till 20/9, som en etikett sidan skickade med till värden. Två
   * mätningar tog bort den:
   *
   *  - **utan klockslag** (17/9): ett klockslag i namnet myntas där namnet
   *    myntas, medan historiken ritar tiden i läsarens klocka — en version sa
   *    en gång 13:05 som namn och 15:05 i kolumnen bredvid;
   *  - **och inte lagrad alls** (20/9): raden ska kunna säga *din kopia*, och
   *    vem *du* är beror på vem som läser. En lagrad etikett hade sagt *din*
   *    om någon annans arbete första gången en kollega öppnade historiken.
   *
   * Namnet byggs därför av `<guide-versions>` ur `reason` och `by`, och orden
   * bor i editorns ordlista som varje annat ord den komponenten ritar.
   */
  /*
   * Och beskedet efteråt. *Sparad* och inte *Publicerad*: det som skrevs är
   * arbetskopian, och besökarna ser fortfarande det som var.
   */
  merged: "Ändringarna är sammanslagna och sparade",
  mergedDropped:
    "Ändringarna är sammanslagna och sparade · vägar till borttagna steg togs bort",
  /*
   * Och de två lägen där ingen sammanslagning går att göra. Båda säger vad som
   * saknas, för *det gick inte* utan skäl är ett besked man inte kan göra något
   * åt — och båda lämnar allt orört: rutan går att öppna igen och välja i.
   */
  mergeNoBase:
    "Sammanslagningen behöver den version ni båda utgick från, och den finns inte kvar i den här fliken. Ladda om och välj igen.",
  mergeNoTheirs: "Guiden kunde inte läsas från värden. Ingenting har ändrats.",
  mergeNotFrozen:
    "Kopiorna kunde inte sparas i historiken, så ingen sammanslagning gjordes. Ingenting har ändrats.",

  /* ── Arbetsanteckningen (berättelse 130) ─────────────────────────────── */

  /*
   * En mening från en människa till nästa.
   *
   * Johan: *"Om inte Anna hade tänkt klart och inte vill att det skulle
   * publiceras?"* Versionerna skyddar innehållet, krocken skyddar arbetet —
   * det här är avsikten, och den finns ingen annanstans på sidan.
   *
   * Dörren säger vad som finns bakom den: *Skriv en anteckning* när det inte
   * finns någon, *Ändra anteckningen* när det gör det. Ett menyval som heter
   * samma sak i båda lägena är ett val man måste öppna för att förstå.
   */
  noteWrite: "Skriv en anteckning till kollegor",
  noteEdit: "Ändra anteckningen till kollegor",
  noteTitle: "Anteckning till kollegor",
  /*
   * Frågan i dialogen säger vad anteckningen är till för, och exemplet är
   * berättelsens eget. En tom text tar bort den — det står i dialogen, för det
   * är inte gissbart.
   */
  noteAsk: "Vad behöver den som kommer efter dig veta?",
  noteHint: "Syns för alla som öppnar guiden, i listan och i granskningen. Tom text tar bort den.",
  noteSave: "Spara anteckningen",
  notePlaceholder: "Inte klar — juristen ska läsa resultattexterna",
  /** Raden under beskedet: vem, när, och orden. */
  noteLine: (name: string, clock: string, text: string): string =>
    `${name} ${clock}: ”${text}”`,
  /** Och samma mening där någon står i begrepp att ta över (berättelse 129). */
  noteQuote: (name: string, clock: string): string => `${name} skrev ${clock}`,
  /*
   * Och en egen dörr ut.
   *
   * *Töm fältet* hade varit en dörr för allt — men `prompt-dialog` läser en tom
   * text som *Avbryt*, och det är rätt för varje annan fråga verktyget ställer
   * (*Vad ska kopian heta?* med tomt svar är ingen kopia). Ett eget menyval är
   * billigare än ett undantag i en ruta hela editorn delar.
   *
   * Med en fråga före, och anteckningen citerad i den: den kan vara någon
   * annans invändning, och det som tas bort ska stå på skärmen medan man
   * bestämmer sig.
   */
  noteRemove: "Ta bort anteckningen",
  noteRemoveTitle: "Ta bort anteckningen?",
  noteRemoveMessage: "Den försvinner för alla som öppnar guiden, och i listan.",
  noteRemoveConfirm: "Ta bort",
  noteRefused: "Bara den som skrev anteckningen — eller en publicerare — kan ändra den.",
  noteFailed: "Anteckningen kunde inte sparas hos värden.",

  /* ── Knapparna ───────────────────────────────────────────────────────── */

  publish: "Publicera",
  /** Aldrig utan nummer. Se kommentaren överst. */
  restore: (n: number): string => `Återställ ${versionLabel(n).toLowerCase()}`,
  backToWorkingCopy: "Tillbaka till arbetskopian",
  more: "Fler val",
  preview: "Förhandsgranska",
  discard: "Kasta ändringarna",

  /* ── Frågan före en återställning ────────────────────────────────────── */

  /*
   * Konsekvensen, inte *Är du säker?*. En fråga som bara undrar om man är säker
   * lägger ansvaret på den som frågas utan att ge hen något att vara säker på.
   */
  restoreTitle: (n: number): string => `Återställ ${versionLabel(n).toLowerCase()}?`,
  /*
   * Och vad som försvinner, och att det inte kommer tillbaka (Astra 30/9,
   * bilaga 6): frågan ställs bara när arbetskopian skiljer sig från den
   * publicerade, och återställningen skriver över den enda arbetskopian —
   * versioner görs bara vid publicering, och editorns ångra börjar om.
   */
  restoreMessage: (n: number, published: number): string =>
    `${versionLabel(n)} ersätter din arbetskopia. Ändringarna i den sedan ${versionLabel(published).toLowerCase()} går inte att få tillbaka. Besökarna ser fortfarande ${versionLabel(published).toLowerCase()} tills du publicerar.`,
  cancel: "Avbryt",

  /* ── Historiken ──────────────────────────────────────────────────────── */

  historyCount: (n: number): string => (n === 1 ? "1 version" : `${n} versioner`),
  /*
   * Raden under rubriken, alltid. Den svarar på frågan innan den ställs: vad
   * händer med det som redan är publicerat om jag rör en gammal version?
   */
  historyNote:
    "Versioner går inte att ändra. Återställ gör en äldre version till din arbetskopia; publicera när du vill visa den.",
  historyOlder: (n: number): string => `Visa äldre versioner (${n})`,
  historyClose: "Stäng historiken",
  historyEmpty: "Inga versioner än.",

  /* ── Inloggningen (berättelse 126) ───────────────────────────────────── */

  /*
   * *Inloggad som …*, med samma ord som på `guides/` och samma ord som i allt
   * annat på jobbet. Namnet kommer ur värdens session och aldrig härifrån: en
   * sida som gissar vem du är gissar fel för någon.
   */
  signedInAs: (name: string): string => `Inloggad som ${name}`,
  /*
   * Och rollen bredvid namnet (berättelse 128).
   *
   * Den står i remsan och inte i editorns rad, av samma skäl som namnet gör
   * det: rollen är en uppgift om **sidan** och personen, inte om guiden. Och
   * den står där alltid, inte bara när något är förbjudet — den som ser
   * *publicerare* varje dag vet vad hen är den dagen knappen saknas för en
   * kollega.
   */
  signedInAsRole: (name: string, role: string): string => `Inloggad som ${name} · ${role}`,

  /*
   * Rollernas ord. Värdens ord är engelska och bor i `.env` (`roles.mjs`); de
   * här är vad en människa läser. Samma fyra som på listsidan, och
   * `guides-words.test.ts` jämför dem — två sidor som kallar samma roll olika
   * saker är precis den glidning båda ordlistorna finns för att hindra.
   */
  roleReader: "läsare",
  roleEditor: "redaktör",
  rolePublisher: "publicerare",
  roleAdmin: "förvaltare",

  /*
   * Varför *Publicera* inte står där (kriterium 3 och 6).
   *
   * Knappen finns inte för en redaktör — en knapp som bara ger ett `401` är
   * värre än ingen knapp — och då måste raden säga varför. Den sägs bara när
   * det finns opublicerade ändringar: dessförinnan är det ingenting att
   * publicera, och en förklaring till varför man inte får göra något man inte
   * ville göra är brus.
   *
   * Raden är `role="status"`, så det sägs också för den som inte ser skärmen.
   */
  onlyPublisherCanPublish: "Bara en publicerare kan publicera",
  logout: "Logga ut",
  /*
   * Vägen tillbaka till listan, för den som öppnade guiden därifrån.
   *
   * *Guider* och inte *Mina guider* sedan berättelse 127: listan är
   * organisationens, och två ord för samma sida — ett i remsan och ett i
   * rubriken den leder till — är precis den glidning som gör att någon undrar
   * om det är två listor.
   */
  allGuides: "Guider",
} as const;

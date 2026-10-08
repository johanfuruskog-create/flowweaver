// The example site shows FlowWeaver PRO: the sending steps are registered here.
import "./styles/demo-tokens.scss";
import "./styles/demo-back.scss";
import "./styles/versions.scss";
import "./styles/guide-storage.scss";

import "../viewer/node-types/default-node-types";
import "../editor/components/guide-editor/guide-editor";
import "../editor/components/guide-versions/guide-versions";
import "../editor/components/confirmation-dialog/confirmation-dialog";
import "../editor/components/conflict-dialog/conflict-dialog";
import "../editor/components/merge-dialog/merge-dialog";
import "../editor/components/publish-dialog/publish-dialog";
import "../editor/components/guide-preview-dialog/guide-preview-dialog";
import "../editor/components/prompt-dialog/prompt-dialog";

import { GuideDiffService } from "../viewer/services/guide-diff-service";
import { GuideMergeService } from "../viewer/services/guide-merge-service";
import { GuideHealthService } from "../editor/services/guide-health-service";
import { t } from "../editor/localization/editor-ui-strings";
import { WORDS } from "./guide-storage-words";

import { AutosaveController } from "./autosave-controller";
import { clearRescue, readRescue, writeRescue } from "./guide-rescue";
import { guideNote } from "./guide-note";
import { guideLock } from "./guide-lock";
import { hostLogin, roleAllows } from "./host-login";
import { LOCK_ICON } from "./lock-icon";
import { ServerGraphStore } from "./server-graph-store";
import { initTheme } from "./theme-persistence";
import { initPanelMemory } from "./panel-persistence";
import { hostConfig } from "./host-config";

import type { GuideEditor } from "../editor/components/guide-editor/guide-editor";
import type { ConfirmationDialog } from "../editor/components/confirmation-dialog/confirmation-dialog";
import type { ConflictDialog } from "../editor/components/conflict-dialog/conflict-dialog";
import type { MergeDialog } from "../editor/components/merge-dialog/merge-dialog";
import type { MergeSide } from "../viewer/services/guide-merge-service";
import type { PromptDialog } from "../editor/components/prompt-dialog/prompt-dialog";
import type { PublishDialog, PublishRequest } from "../editor/components/publish-dialog/publish-dialog";
import type { GuidePreviewDialog } from "../editor/components/guide-preview-dialog/guide-preview-dialog";
import type { GuideVersion, GuideVersions } from "../editor/components/guide-versions/guide-versions";
import type { GraphSaveConflict } from "./local-storage-graph-store";
import type { GuideLock } from "./guide-lock";
import type { GuideRescue } from "./guide-rescue";
import type { GuideNote } from "./guide-note";
import type { GraphData } from "../viewer/types/graph";
import type { HostRole } from "./host-login";
import type { EditorMode } from "../viewer/types/node-types";

/**
 * One page where the guide lives with the host instead of in this browser
 * (story 124, criterion 6).
 *
 * ## Why this is the only page that changes storage
 *
 * Every other page on the site keeps its guide in `localStorage`, which is
 * right for trying things: no account, no server, nothing to set up. This one
 * answers a different question — *can I open the same guide on two devices?* —
 * and it is the only page that needs a host to answer it.
 *
 * It is under `dev/` because it was the only way in until story 126: the
 * guide's id and its secret rode in the query (`?guide=…&key=…`), both out of
 * `guides.mjs new` on the server, and a page anybody could land on would have
 * had nothing to show.
 *
 * ## Since story 126 there are two ways in, and the address says which
 *
 * `?key=` present means the secret is the identity — a reference host running
 * without an OIDC provider, which is a documented way to run it. `?key=` absent
 * means the host has a login, and the session cookie is the identity; that is
 * how `guides/` links here, and it is why no secret appears in an address any
 * more.
 *
 * The page does not ask the host which mode it is in before deciding. It cannot
 * usefully: a host with a provider refuses the secret with `401`, and the row
 * then says *Logga in igen*, which is both true and the thing to do. Asking
 * first would only move that sentence earlier at the cost of a round trip
 * before anything is drawn.
 *
 * ## One storage, one message about saving
 *
 * Johan, 17/9: *"det är förvirrande för användaren om det sparas på två sätt
 * samtidigt."* So nothing here writes to `localStorage`, the page says in one
 * sentence where the guide is kept, and the only marks about saving are the
 * word *Utkast* and the dot beside the name.
 *
 * ## What the version list does here, and what it does not
 *
 * The rows are the host's versions: open one to look at it, publish one to
 * decide what a visitor gets. *Spara* freezes the working copy as a **new**
 * version, because a version that can change is not a version — that is the
 * contract's promise, and it differs from the versions workbench
 * (`versions.ts`), which is a bench for judging the control and keeps its own
 * older model on purpose.
 *
 * Opening an old version therefore does **not** touch the working copy. It is
 * a look; *Återställ* is the explicit act that replaces what you were writing.
 *
 * ## The shape: a bar and a panel, as a CMS does it
 *
 * Johan chose it on 17/9 from three drawn alternatives: *"gör som CMS brukar
 * göra, Sitevision, WordPress, och andra tjänster där man bygger noder på en
 * canvas."* So the canvas is the page, one compact row above it carries the
 * state and the two acts that change it, and the history lives behind a button.
 *
 * The table used to stand open above the canvas, which put the canvas's top
 * edge below the first screen — it cost height in the thing being worked in to
 * show a list read a few times a day.
 */

/**
 * How often the working copy is written, at most.
 *
 * 3 s and not the 500 ms the local pages use: every write here is a request
 * over somebody's network, and a guide is serialised whole each time. Short
 * enough that what is at risk is a sentence, long enough that typing is not a
 * stream of requests — and `pagehide` covers the tail either way
 * (`AutosaveController`).
 */
const DRAFT_INTERVAL = 3000;

/**
 * Hur ofta läsläget frågar värden om något hänt (berättelse 129, 19/9).
 *
 * Tio sekunder, och **bara** medan någon annan håller låset och fliken syns.
 * Frågan är några byte och svaret oftast `204` utan kropp (`?since`,
 * `docs/LAGRING-KONTRAKT.md`), så det som kostar är rundan och inte guiden.
 *
 * Kort pollning och inte long polling eller SSE — Johan: *"bara det inte blir
 * tungt"*. En knuff från värden är mindre trafik den dag många tittar på samma
 * guide, men det är en ny söm hos varje värd; det byggs när mätningen säger
 * att det behövs och inte innan.
 */
const FOLLOW_INTERVAL = 10_000;

const params = new URLSearchParams(location.search);
const guideId = params.get("guide") ?? "";
const secret = params.get("key") ?? "";

/**
 * Where the host answers.
 *
 * The address comes from the same single line that opens this page's
 * `connect-src` at build time (`vite.config.ts`): one line decides both, so a
 * host that moves cannot end up allowed-but-unreachable or reachable-but-
 * blocked. The file is called `interest-form.json` for historical reasons;
 * what it holds is the API's base.
 *
 * `?api=` points it somewhere else, and that is harmless for a reason the
 * build provides: the built page's `connect-src` allows exactly one origin, so
 * a browser blocks any other whatever the address says. In development there
 * is no policy, and there the parameter is the difference between being able
 * to try this page against your own receiver and not being able to try it at
 * all.
 */
const API = (params.get("api") ?? hostConfig.api ?? "").trim();

/**
 * The three states, each with a shape of its own.
 *
 * K3: nothing here may rest on colour alone. The sentence says which state it
 * is, the mark draws it, and the colour is the third bearer rather than the
 * only one. `currentColor` so the mark follows the row's own tone in both
 * themes.
 */
const MARKS: Record<string, string> = {
  clean:
    '<svg width="16" height="16" viewBox="0 0 20 20" focusable="false"><path d="M4 10.5 8 14l8-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  draft: '<svg width="16" height="16" viewBox="0 0 20 20" focusable="false"><circle cx="10" cy="10" r="4.5" fill="currentColor"/></svg>',
  /*
   * Den äldre versionen har ingen egen teckning: prickens färg och ordet
   * *Läsläge* räcker. Hänglåset satt här till 18/9 kväll och lovade fel sak —
   * det betyder *en annan människa*, och bakom en gammal version finns ingen.
   */
  readonly: "",
  /*
   * Guiden någon annan håller — hänglåset, och det enda märke som RITAS
   * (berättelse 129, Johans genomgång av ytan).
   *
   * De andra märkena är prickar: stilmallen döljer deras svg och låter färgen
   * vara en genväg bredvid ordet. Hänglåset är det ena stället där teckningen
   * är värd sin plats — den finns i Word och i Sitevision och betyder samma
   * sak där. Ordet *Låst* står kvar bredvid den (K3); ikonen är en genväg för
   * ögat och aldrig bäraren.
   */
  locked: LOCK_ICON,
};

/** Under den här bredden blir historiken ett ark nerifrån i stället. */
const SHEET_WIDTH = 640;
/** Hur många versioner historiken visar innan *Visa äldre* fäller ut resten. */
const LATEST = 5;

const editor = document.getElementById("editor") as GuideEditor;
const list = document.getElementById("versions") as GuideVersions;
const row = document.getElementById("row") as HTMLElement;
const heading = document.getElementById("open-name") as HTMLElement;
const badgeText = document.getElementById("badge-text") as HTMLElement;
const mark = document.getElementById("mark") as HTMLElement;
const statusLine = document.getElementById("status") as HTMLElement;
const where = document.getElementById("where") as HTMLElement;
const missing = document.getElementById("missing") as HTMLElement;
const publishButton = document.getElementById("publish") as HTMLButtonElement;
const discardButton = document.getElementById("discard") as HTMLButtonElement;
const previewButton = document.getElementById("preview") as HTMLButtonElement;
const adoptButton = document.getElementById("adopt") as HTMLButtonElement;
const takeOverButton = document.getElementById("takeover") as HTMLButtonElement;
const chooseButton = document.getElementById("choose") as HTMLButtonElement;
const noteButton = document.getElementById("note") as HTMLButtonElement;
const noteRemoveButton = document.getElementById("note-remove") as HTMLButtonElement;
const noteLine = document.getElementById("note-line") as HTMLElement;
const rescueRow = document.getElementById("rescue") as HTMLElement;
const rescueText = document.getElementById("rescue-text") as HTMLElement;
const rescueMergeChoice = document.getElementById("rescue-merge-choice") as HTMLElement;
const rescueMergeButton = document.getElementById("rescue-merge") as HTMLButtonElement;
const rescueMergeCost = document.getElementById("rescue-merge-cost") as HTMLElement;
const rescueKeepChoice = document.getElementById("rescue-keep-choice") as HTMLElement;
const rescueKeepButton = document.getElementById("rescue-keep") as HTMLButtonElement;
const rescueKeepCost = document.getElementById("rescue-keep-cost") as HTMLElement;
const rescueDropChoice = document.getElementById("rescue-drop-choice") as HTMLElement;
const rescueDropButton = document.getElementById("rescue-drop") as HTMLButtonElement;
const rescueDropCost = document.getElementById("rescue-drop-cost") as HTMLElement;
const backButton = document.getElementById("back") as HTMLButtonElement;
const historyButton = document.getElementById("history") as HTMLButtonElement;
const moreButton = document.getElementById("more") as HTMLButtonElement;
const moreList = document.getElementById("more-list") as HTMLElement;
const popover = document.getElementById("history-popover") as HTMLElement;
const popoverTitle = document.getElementById("history-title") as HTMLElement;
const popoverCount = document.getElementById("history-count") as HTMLElement;
const popoverNote = document.getElementById("history-note") as HTMLElement;
const popoverClose = document.getElementById("history-close") as HTMLButtonElement;
const olderButton = document.getElementById("history-older") as HTMLButtonElement;
const whoBox = document.getElementById("who") as HTMLElement;
const whoName = document.getElementById("who-name") as HTMLElement;
const signOutButton = document.getElementById("signout") as HTMLButtonElement;
const backLink = document.getElementById("back-link") as HTMLAnchorElement;

initTheme();
// The side panel's width and whether it is open, as the editor left them.
initPanelMemory();

/**
 * Which credential this page carries — see the header.
 *
 * No secret in the address means the host has a login and the cookie is the
 * identity. `credentials: "include"` then goes on every call, and the cookie is
 * `HttpOnly`, so nothing on this page can read it, hand it on or leak it into a
 * screenshot.
 */
const useSession = secret === "";

/**
 * Vad den inloggade får göra (berättelse 128).
 *
 * **Läsare tills värden säger något annat**, och det är hela poängen med
 * förvalet: sidan hinner rita innan `/auth/me` svarat, och den som visar en
 * palett under tiden har visat en palett för en läsare. Mutationen som fäller
 * det är att sätta `administrator` här — då får Monika en palett hon inte får
 * använda, och kontrollen mäter paletten och inte attributet.
 *
 * `admin` utan inloggning, och det är inte en lucka: en värd utan leverantör
 * har inga roller alls, hemligheten i adressen är hela legitimationen, och den
 * som har den har guiden (`docs/LAGRING-KONTRAKT.md`). Att kalla det för en
 * roll här betyder bara att resten av filen har **en** fråga att ställa i
 * stället för två.
 */
let role: HostRole = useSession ? "reader" : "admin";

/**
 * Rollens läge i editorn.
 *
 * Läget är en **vy och inget skydd** — `EditorMode` i biblioteket säger det om
 * sig självt, och det körs i en webbläsare. Skyddet är värdens, som svarar
 * `401` på det rollen inte får oavsett vad som ritas här. Det här handlar om
 * något annat: att ingen ska få en palett hen inte kan använda, eller en knapp
 * som bara ger ett fel.
 *
 * Publiceraren får `edit` och inte ett eget läge. Att publicera är värdens väg
 * och inte editorns yta, så det finns ingenting i editorn att låsa upp —
 * skillnaden mot redaktören är knappen i raden, och den är sidans.
 */
const modeForRole = (which: HostRole): EditorMode =>
  which === "admin" ? "administrator" : roleAllows(which, "editor") ? "edit" : "readonly";

let allowedMode: EditorMode = modeForRole(role);

/** Får arbetskopian ändras? Redaktör och uppåt. */
const mayEdit = (): boolean => roleAllows(role, "editor");

/** Får något publiceras eller återställas? Publicerare och uppåt. */
const mayPublish = (): boolean => roleAllows(role, "publisher");

/**
 * Who is signed in, said in the row.
 *
 * It lives in the page's own strip above the editor, not in the editor's row.
 * The row is about the **guide** — which state it is in, and the two acts that
 * change it — while *who am I* is a fact about the page. It sat in the row
 * until 18/9, and the screenshot that ended that showed the history popover
 * lying across it with the name clipped to "m Johan Furuskog".
 *
 * Asked after the editor is drawn rather than before, deliberately: the name is
 * something you read once and then stop seeing, and making the canvas wait for
 * it would trade the thing somebody came for against a courtesy.
 *
 * And **not asked at all** when the address carried a secret. A secret only
 * works on a host without a provider, so there is nobody to name — and the
 * question would be a request whose `404` a browser logs as an error on a page
 * where nothing is wrong. Measured: `smoke:guide-storage` counted five of them
 * on a run where every other check was green.
 */
/**
 * Rollens ord, som en människa läser det.
 *
 * Värdens ord är engelska och bor i `.env` (`roles.mjs`); det här är
 * ordlistans. Samma fyra ord som listsidan använder, och ett test jämför dem —
 * två sidor som kallar samma roll olika saker är precis den glidning båda
 * ordlistorna finns för att hindra.
 */
const roleWord = (which: HostRole): string =>
  which === "admin"
    ? WORDS.roleAdmin
    : which === "publisher"
      ? WORDS.rolePublisher
      : which === "editor"
        ? WORDS.roleEditor
        : WORDS.roleReader;

async function sayWhoIsSignedIn(): Promise<void> {
  if (!useSession) {
    return;
  }

  const host = hostLogin(API);
  const state = await host.state();

  signOutButton.textContent = WORDS.logout;
  signOutButton.addEventListener("click", async () => {
    await host.logout();
    location.reload();
  });

  if (state.kind !== "signed-in") {
    return;
  }

  /*
   * Rollen först, och sedan allt som hänger på den (berättelse 128).
   *
   * Den sätts **innan** guiden öppnas — anropet väntas in i stället för att
   * läggas bredvid — för att läget annars skulle bytas under någon som redan
   * fått en palett. Priset är en tur till värden innan canvasen ritas, och det
   * är samma tur sidan ändå gjorde en rad senare.
   */
  role = state.role;
  allowedMode = modeForRole(role);

  whoName.textContent = WORDS.signedInAsRole(state.name || state.email, roleWord(role));
  whoBox.hidden = false;

  /*
   * Och vägen tillbaka blir listan man kom ifrån.
   *
   * Samma länk, nytt mål — inte en andra länk bredvid. En redaktör som öppnade
   * guiden ur *Mina guider* vill dit tillbaka, inte till startsidan; utan
   * inloggning finns ingen lista att gå till och länken står kvar som den var.
   */
  backLink.textContent = WORDS.allGuides;
  backLink.href = hostConfig.guidesHref;
}

if (API === "" || guideId === "") {
  /*
   * Said plainly rather than tried and failed. A page that starts an editor
   * against nowhere hands somebody a canvas whose contents cannot be saved,
   * and they find out when they close it.
   */
  missing.hidden = false;
  editor.remove();
  where.textContent = "";
} else {
  const store = new ServerGraphStore({
    base: API,
    ...(useSession ? { session: true } : { secret }),
  });
  const lock = guideLock(API, guideId);
  const noteClient = guideNote(API, guideId);
  const dialog = document.createElement("confirmation-dialog") as ConfirmationDialog;
  const conflictDialog = document.createElement("conflict-dialog") as ConflictDialog;
  /* Sammanslagningen (berättelse 131), granskningens slag med två spalter. */
  const mergeDialog = document.createElement("merge-dialog") as MergeDialog;
  const publishDialog = document.createElement("publish-dialog") as PublishDialog;
  const previewDialog = document.createElement("guide-preview-dialog") as GuidePreviewDialog;
  /* Anteckningen frågar om en rad, och verktyget har redan en ruta för det
     (berättelse 130). */
  const promptDialog = document.createElement("prompt-dialog") as PromptDialog;

  publishDialog.editorLocale = "sv";
  previewDialog.editorLocale = "sv";
  conflictDialog.editorLocale = "sv";
  mergeDialog.editorLocale = "sv";
  promptDialog.editorLocale = "sv";
  document.body.append(
    dialog,
    publishDialog,
    previewDialog,
    conflictDialog,
    mergeDialog,
    promptDialog,
  );
  where.textContent = `Guiden sparas hos värden på ${new URL(API).host}, inte i den här webbläsaren.`;

  /**
   * What publishing would change, for the mark and for the dialog alike.
   *
   * The page compared two graphs as strings until 17/9 — enough to light a dot,
   * and no help at all in front of a decision. It asks `GuideDiffService` now,
   * and the mark is simply *is that list empty*: one comparison behind both, so
   * the row and the publish dialog can never say different things about the
   * same guide (story 125, criterion 3 and 11).
   */
  const changesFrom = (graph: GraphData | null): ReturnType<typeof GuideDiffService.compare> =>
    publishedGraph && graph ? GuideDiffService.compare(publishedGraph, graph) : [];

  const name = (): string => {
    const meta = editor.getData().meta?.name;

    return typeof meta === "string" ? meta : (meta?.sv ?? meta?.en ?? "Guiden hos värden");
  };

  /** Newest first, as the host lists them. */
  let rows: GuideVersion[] = [];
  /** What visitors get. Everything the page says is measured against this. */
  let currentId = "";
  /** The published version's own graph, kept for comparing against. */
  let publishedGraph: GraphData | null = null;
  let savedAt = "";
  /**
   * Vem som skrev arbetskopian, när det var någon annan än den inloggade.
   *
   * Tom när den är ens egen — det vanliga — och det är värden som avgör vilket
   * (`draftSavedBy.me`). Sidan jämför aldrig namn: två Anna Andersson på en
   * kommun hade gett fel svar för en av dem.
   */
  let savedByOther = "";
  /** A version id while an old one is on screen, read-only; otherwise null. */
  let viewing: string | null = null;
  let failure = "";
  /**
   * Sidan har slutat spara tills någon svarat på krockrutan (127, 129).
   *
   * Skild från `failure`, för den säger något annat: ett fel är något som gick
   * fel, det här är något som gick **rätt** för någon annan. Och den går inte
   * över av sig själv — autosparen är frånkopplad, så en mening som bleknade
   * hade lämnat en tyst sida som inte sparar.
   *
   * Sedan 129 säger rutan hela saken och raden bara att valet står kvar;
   * `lastClash` är vad knappen *Välj* öppnar rutan på igen.
   */
  let paused = false;
  let lastClash: GraphSaveConflict | null = null;
  /** Sant medan rutan står öppen, så en andra krock inte ställer den två gånger. */
  let conflictOpen = false;
  /**
   * Sant medan rutan om ett övertagande står öppen (129:s skärning, punkt 2).
   *
   * Den finns av samma skäl som `paused` göms räddningsraden: **en röst i
   * taget**. Rutan säger *Dina ändringar finns kvar i den här webbläsaren* —
   * samma mening som räddningsraden (UX-genomgången 129–131) — och raden
   * bakom den sa nästan samma mening samtidigt — sett i bild 19/9, inte i
   * sviten.
   *
   * Skild från `conflictOpen`, som hindrar att samma fråga ställs två gånger.
   * Det här är en flagga om vad som SYNS, och de två sakerna hade glidit isär
   * den dag den ena behövde ändras.
   */
  let takenOverOpen = false;

  /* ── Låset (berättelse 129) ───────────────────────────────────────────── */

  /**
   * Någon **annan** håller låset — eller jag själv, i en annan sittning.
   *
   * `null` betyder att ingenting hindrar redigering: låset är mitt, det har
   * löpt ut, eller värden har inga lås alls. Sidan skiljer inte på de tre, för
   * de har samma svar.
   */
  let lockedBy: GuideLock | null = null;
  /** Håller det här fönstret låset just nu? */
  let holding = false;
  /**
   * Tidigast när nästa förnyelse får gå iväg.
   *
   * Halva livslängden, räknad ur värdens egen `until` — så ett prov som kör med
   * tre sekunders lås förnyar efter halvannan, och drift med tio minuter efter
   * fem. Utan den skulle varje tangenttryck bli ett anrop.
   *
   * Det finns **ingen timer**. Låset förnyas bara av aktivitet — en ändring,
   * en sparning, ett tangenttryck — och det är hela skälet att en kvarglömd
   * flik släpper av sig själv. En `setInterval` här hade gjort bäst-före
   * verkningslöst utan att någon märkte det.
   */
  let renewAfter = 0;
  /** Pollningens timer, `0` när ingen går. */
  let followTimer = 0;
  /** Finns det något osparat att rädda? Sätts av en ändring, nollas av en sparning. */
  let unsaved = false;
  /** Webbläsarkopian som väntar på ett svar, om det finns en. */
  let rescue: GuideRescue | null = readRescue(guideId);

  /**
   * **Utgångspunkten**: arbetskopian som den här sidan senast läste eller
   * skrev (berättelse 131).
   *
   * Den tredje grafen, och den enda som inte finns någon annanstans. Vid en
   * krock har värden sin och editorn min — men *hon lade till* och *jag tog
   * bort* ser likadana ut i en jämförelse mellan de två. Utan en gemensam
   * startpunkt går det bara att se ATT de skiljer sig.
   *
   * En djup kopia, och det är inte försiktighet: editorn äger sin graf och
   * ritar om den, och en utgångspunkt som följer med de ändringar den ska
   * mätas emot är ingen utgångspunkt alls.
   *
   * `null` tills något lästs. Då erbjuds ingen sammanslagning — hellre det
   * gamla valet än en sammanslagning mot en gissad startpunkt.
   */
  let base: GraphData | null = null;

  const noteBase = (graph: GraphData | null): void => {
    base = graph === null ? null : (JSON.parse(JSON.stringify(graph)) as GraphData);
  };

  /* ── Avsikten (berättelse 130) ────────────────────────────────────────── */

  /**
   * Arbetsanteckningen någon lämnat på guiden, eller `null`.
   *
   * Värdens, som allt annat om människor här: namnet, tiden och `me` kommer
   * därifrån, och sidan jämför aldrig namn.
   */
  let note: GuideNote | null = null;
  /** Vilka som skrivit i arbetskopian sedan förra versionen. Granskningens rad. */
  let editors: Array<{ name: string; me: boolean; at: string }> = [];
  /**
   * Anteckningen, läst där `note` betyder något annat.
   *
   * `requestFor` har redan en `note` — publiceringens egen etikett, den man
   * skriver i rutan — och två olika `note` i samma funktion är ett fel som
   * kompilatorn inte fångar. Kontraktet kallar den här `draftNote`, och den
   * här funktionen finns för att namnet ska gå att läsa var det än står.
   */
  const workNote = (): GuideNote | null => note;

  /**
   * *Version 3*, as the host numbered it — never as this page counted.
   *
   * The number was worked out here until 18/9, from the row's position in the
   * list. That is wrong the first day a host prunes an old version: everything
   * left over is renamed, and *"go back to version 3"* means something else
   * than it did yesterday. `number` is the host's, fixed when the version was
   * frozen (`docs/LAGRING-KONTRAKT.md`), and this page only reads it.
   *
   * `0` means *no number known*. Nothing is invented to fill the gap: the
   * sentences below have a form without a number, and the row simply has none.
   */
  const numberOf = (versionId: string): number =>
    rows.find((one) => one.id === versionId)?.number ?? 0;

  const clock = (iso: string): string =>
    iso === ""
      ? ""
      : new Date(iso).toLocaleTimeString("sv", { hour: "2-digit", minute: "2-digit" });

  /**
   * Hur många hela minuter sedan? `-1` när tiden inte går att läsa.
   *
   * Låsraden säger *aktiv för 3 minuter sedan* i stället för ett klockslag
   * (129:s skärning), och det är den här siffran. Nedåt och inte avrundat:
   * *för 3 minuter sedan* om något hände för 3 minuter och 50 sekunder sedan
   * är sant — *för 4 minuter sedan* hade varit en tid som ännu inte inträffat.
   *
   * Negativa värden blir `0`. Värdens klocka och webbläsarens går isär med
   * sekunder, och *för -1 minuter sedan* är ett fel den som läser raden inte
   * kan göra något åt; *nyss* är sant i båda klockorna.
   */
  const minutesAgo = (iso: string): number => {
    if (iso === "") {
      return -1;
    }

    const then = new Date(iso).getTime();

    return Number.isNaN(then) ? -1 : Math.max(0, Math.floor((Date.now() - then) / 60_000));
  };

  /** *nyss* / *för 3 minuter sedan*, eller tomt när värden inte gav någon tid. */
  const agoWords = (iso: string): string => {
    const minutes = minutesAgo(iso);

    return minutes < 0 ? "" : WORDS.activeAgo(minutes);
  };

  /**
   * Skriv i beskedet — men bara när det står något annat där.
   *
   * Raden är `role="status"`, och att sätta `textContent` byter textnod även
   * när strängen är densamma; en skärmläsare läser då upp raden igen. Det blev
   * mätbart när låsraden fick relativ tid: den ritas om var tionde sekund för
   * att *aldrig* visa en minutsiffra som hunnit bli fel, och utan den här
   * vakten hade *Låst av Anna Andersson · aktiv för 3 minuter sedan* sagts
   * högt sex gånger i minuten.
   */
  const say = (text: string): void => {
    if (statusLine.textContent !== text) {
      statusLine.textContent = text;
    }
  };

  /**
   * Står det något på skärmen som besökarna inte får?
   *
   * **Två fall, och det andra saknades till 19/9.** Det uppenbara är att den
   * publicerade versionen finns och skiljer sig från det man skrivit. Det andra
   * är att det inte finns någon publicerad version alls — och då kan guiden
   * omöjligen vara *rent* publicerad, för det finns ingen besökare som ser
   * något att vara lik.
   *
   * Johan mätte felet skarpt: en ny guide med noder i, arbetskopian sparad hos
   * värden, bar brickan *Publicerad* medan beskedet bredvid sa att ingen
   * version var publicerad än. Orsaken var att raden härledde samma sak två
   * gånger — beskedet ur `current`, brickan ur en jämförelse som utan
   * publicerad graf inte hade något att jämföra med och därför svarade "inga
   * ändringar". Nu kommer båda ur `currentId`, som är det värden faktiskt
   * säger.
   *
   * `currentId` och inte `publishedGraph`: den senare är också null en kort
   * stund innan den hämtats, och när hämtningen gick fel. De lägena är fel i
   * raden, inte i den här frågan.
   */
  const unpublished = (): boolean =>
    viewing === null &&
    (currentId === "" || (publishedGraph !== null && changesFrom(editor.getData()).length > 0));

  /**
   * What the page says about saving — three states and nothing else.
   *
   * Johan, 17/9: *"min guide verkar inte sparas när jag ändrar i den"*. It was
   * saving; the page simply never said so, and never said which version
   * visitors were getting either. Every sentence here is measured against
   * `current` — the published version — because that is the question an editor
   * actually has: *is what I changed out there yet?*
   */
  /**
   * Bekräftelsen efter en återställning, tills något annat händer.
   *
   * Den står i raden och inte i en ruta som försvinner: den som just bytt
   * arbetskopia behöver se att besökarna inte märkte något, och behöver se det
   * så länge hen tittar (kriterium 22).
   */
  let notice = "";

  const drawState = (): void => {
    /*
     * Först av allt: ska läsläget följa med? (berättelse 129, tillägget 19/9)
     *
     * Här och inte i slutet av funktionen — raden nedan har flera vägar som
     * återvänder tidigt, och en pollning som startas i slutet hade startats
     * bara i vissa lägen. Det här är dessutom exakt de tillstånd frågan gäller:
     * `drawState` körs varje gång låset eller versionen byter.
     */
    followLock();

    const changed = unpublished();
    const published = currentId === "" ? 0 : numberOf(currentId);
    /*
     * Fyra lägen, och låset går före arbetskopian: den som inte får skriva
     * behöver inte veta om det finns opublicerade ändringar först.
     */
    const state =
      viewing !== null ? "readonly" : lockedBy ? "locked" : changed ? "draft" : "clean";

    heading.textContent = `${changed ? "• " : ""}${name()}`;
    document.title = `${changed ? "• " : ""}${name()} — hos värden`;

    row.dataset.state = state;
    mark.innerHTML = MARKS[state] ?? "";
    /*
     * Brickan säger vilket av de tre orden man står i, och bara de tre:
     * *Arbetskopia*, *Publicerad*, eller versionen man tittar på. Ordet,
     * tecknet och färgen säger samma sak — K3 vill inte att färgen bär det
     * ensam.
     */
    /*
     * Fyra tillstånd, fyra ord. *Låst* och *Läsläge* är två olika saker och
     * inte ett — hänglåset betyder *en annan människa*, och det finns ingen
     * sådan bakom en gammal version (Johan 18/9 kväll, efter bilderna).
     */
    badgeText.textContent = lockedBy
      ? WORDS.badgeLocked
      : viewing !== null
        ? WORDS.badgeReadOnly
        : changed
          ? WORDS.badgeWorkingCopy
          : WORDS.badgePublished;

    /*
     * Arbetsanteckningen (berättelse 130): en mening från en människa, under
     * beskedet den gäller. Den står för ALLA som öppnar guiden — läsaren, den
     * som håller låset, den som står i begrepp att ta över — för det är hela
     * poängen med den.
     */
    noteLine.hidden = note === null;
    noteLine.textContent =
      note === null ? "" : WORDS.noteLine(note.name, clock(note.at), note.text);

    /*
     * Och dörren till den.
     *
     * Den som **håller guiden** skriver en: hen vet vad som inte är klart.
     * Den som **skrev** den får ändra den, och en publicerare får det också —
     * att ta bort någon annans anteckning är att ta bort hens invändning, och
     * det hör till samma rung som att publicera förbi den (samma regel som
     * värden prövar, `docs/LAGRING-KONTRAKT.md`).
     *
     * Och aldrig över en gammal version: det man tittar på är inte det
     * anteckningen handlar om.
     */
    const mayNote =
      viewing === null &&
      mayEdit() &&
      useSession &&
      (holding || (note !== null && (note.me || mayPublish())));

    noteButton.hidden = !mayNote;
    noteButton.textContent = note === null ? WORDS.noteWrite : WORDS.noteEdit;
    /* Och dörren ut, bara när det finns något att gå ut ur. */
    noteRemoveButton.hidden = !mayNote || note === null;
    noteRemoveButton.textContent = WORDS.noteRemove;

    historyButton.textContent = WORDS.history;
    publishButton.textContent = WORDS.publish;
    backButton.textContent = WORDS.backToWorkingCopy;
    discardButton.textContent = WORDS.discard;
    previewButton.textContent = WORDS.preview;
    moreButton.setAttribute("aria-label", WORDS.more);
    popoverTitle.textContent = WORDS.history;
    popoverNote.textContent = WORDS.historyNote;
    popoverClose.textContent = "×";
    popoverClose.setAttribute("aria-label", WORDS.historyClose);

    /*
     * Knapparna följer rollen, och de FINNS inte i stället för att vara
     * avstängda (kriterium 3).
     *
     * En avstängd knapp är en fråga om varför som ingen svarar på, och en
     * knapp som bara ger ett `401` är värre än ingen alls. Skälet står i
     * stället i raden nedanför, som är `role="status"`.
     *
     * *Återställ* står hos publiceraren och inte hos redaktören, som stegen i
     * berättelsen säger: att ta tillbaka en gammal version över någon annans
     * arbetskopia är samma sorts beslut som att publicera den.
     */
    publishButton.hidden = viewing !== null || lockedBy !== null || !mayPublish();
    discardButton.hidden = viewing !== null || lockedBy !== null || !changed || !mayEdit();
    adoptButton.hidden = viewing === null || !mayPublish();
    adoptButton.textContent = viewing === null ? "" : WORDS.restore(numberOf(viewing));
    backButton.hidden = viewing === null;

    /*
     * *Ta över* står där någon annan håller låset, och bara för den som får
     * (berättelse 128, stegen). En redaktör väntar ut låset eller frågar —
     * och får ingen knapp, för en knapp som bara ger ett `401` är värre än
     * ingen knapp.
     *
     * *Publicera* och *Kasta ändringarna* försvinner så länge någon annan
     * arbetar: båda skriver, och det som skulle skrivas är hennes halvfärdiga
     * arbetskopia. Ta över först, publicera sedan.
     */
    takeOverButton.hidden = lockedBy === null || !mayPublish();
    takeOverButton.textContent = WORDS.takeOver;

    /* Vägen tillbaka in i krockrutan, för den som tryckte Avbryt. */
    chooseButton.hidden = !paused;
    chooseButton.textContent = WORDS.statusPausedAction;

    /*
     * Och webbläsarkopian, när det finns en.
     *
     * Tre lägen, och det mellersta saknades till 19/9. Frågan med båda
     * knapparna hör hemma där guiden går att skriva i. Håller någon annan
     * låset gör den inte det: *Fortsätt där jag var* hade skrivit in i en
     * guide någon annan sitter i — skrivvägen tillåter det, för låset är ingen
     * spärr — och Johan frågade det raden borde ha svarat på: *"måste jag inte
     * trycka Ta över?"* Jo. Då står bara vägen ut ur kopian kvar, och texten
     * pekar på den knapp som leder vidare.
     *
     * Och bara för den som faktiskt får ta över. En redaktör får ingen
     * *Ta över*-knapp (rollstegen, berättelse 128), och att skicka hen till en
     * knapp som inte finns är värre än att säga att arbetet ligger kvar.
     */
    /*
     * Och inte medan en ruta säger samma sak: **en röst i taget**.
     *
     * Två fall, och båda mättes i en skärmbild och inte i sviten. Krockrutan
     * frågar om samma val som raden, och raden stod och erbjöd *Fortsätt där
     * jag var* bakom den öppna rutan. Rutan om ett övertagande säger *Dina
     * ändringar finns kvar i den här webbläsaren* — samma mening som
     * räddningsraden (UX-genomgången 129–131) — och raden bakom den sa nästan
     * samma mening samtidigt (Johan 19/9, av bilden).
     *
     * Raden kommer tillbaka när rutan är besvarad. Det är hela poängen med att
     * gömma den i stället för att ta bort den: beskedet hör hemma där, bara
     * inte just medan någon annan säger det.
     */
    const rescueVisible = rescue !== null && !paused && !takenOverOpen;
    const mine = rescueVisible && viewing === null && mayEdit();
    const mayAnswer = mine && lockedBy === null;
    /*
     * Låst läge kräver **inte** längre publicerare (Johan 20/9). Rollen som
     * gällde var *får ta över*, och raden pekade på den knappen — men
     * sammanslagningen behöver inget övertagande: den skriver via samma
     * skrivvägar som en vanlig sparning, och de kräver inte låset. En redaktör
     * med en kopia i webbläsaren ska kunna rädda den.
     */
    const lockedOut = mine && lockedBy !== null;
    const copyAt = rescue === null ? "" : clock(rescue.at);

    rescueRow.hidden = !rescueVisible;
    rescueText.textContent = !rescueVisible
      ? ""
      : mayAnswer
        ? WORDS.rescueHere
        : lockedOut
          ? WORDS.rescueLocked(copyAt)
          : WORDS.rescueWaiting;

    /*
     * Priset under var sin knapp, och bara när knappen står där: en kostnad
     * utan knapp är ett besked om något man inte kan göra.
     */
    /*
     * *Slå ihop ändringar* när kopian bär sin utgångspunkt (berättelse 131) —
     * och då INTE *Fortsätt där jag var*. Det senare är samma sak som *Min* på
     * varje rad i sammanslagningen, fast utan att se vad man skriver över; ett
     * val som gör mindre än ett annat ska inte stå bredvid det.
     *
     * Kopior skrivna innan utgångspunkten följde med saknar den, och då står
     * det gamla valet kvar. Hellre det än en sammanslagning räknad mot en
     * gissad startpunkt: den hade sett ut precis som en riktig.
     */
    /*
     * **Slå ihop går också i låst läge** (Johan 20/9: *"varför inte bara kunna
     * få Slå ihop ändringar där och då?"*).
     *
     * Raden skickade till *Ta över* medan någon annan höll låset, och skälet
     * höll så länge det enda valet var *Fortsätt där jag var* — den skriver
     * rakt in i guiden och ersätter den andres arbete utan att någon sett vad
     * som försvinner.
     *
     * Sammanslagningen gör inte det. Den fryser båda kopiorna, tar hens
     * senast sparade graf som ena sidan och min som andra, och skriver ett
     * resultat som behåller båda; hen ser det inom tio sekunder och får vid
     * sin nästa sparning krockrutan med *Slå ihop* överst. Låset finns för
     * att två inte ska skriva på varandra **utan att veta det**, och
     * skrivvägarna kräver det inte (berättelse 129) — en granskad
     * sammanslagning är precis det låset skyddar mot motsatsen till.
     *
     * Kravet är därför bara att det finns en utgångspunkt att räkna mot.
     */
    const canMerge = mine && rescue?.base !== undefined;

    rescueMergeChoice.hidden = !canMerge;
    rescueMergeButton.textContent = WORDS.rescueMerge;
    rescueMergeCost.textContent = canMerge ? WORDS.rescueMergeCost(savedByOther) : "";

    /*
     * *Fortsätt där jag var* står kvar bara där den är det bästa som finns:
     * jag får skriva, och kopian saknar utgångspunkt. Den skriver över den
     * andres arbete, och ett val som gör mindre än ett annat ska inte stå
     * bredvid det.
     */
    rescueKeepChoice.hidden = !mayAnswer || canMerge;
    rescueKeepButton.textContent = WORDS.rescueKeep;
    rescueKeepCost.textContent = mayAnswer && !canMerge
      ? WORDS.rescueKeepCost(savedByOther, clock(savedAt))
      : "";

    /*
     * *Börja från …* står kvar i båda lägena: den skriver ingenting i guiden,
     * och är vägen för den som bestämt sig för att den andres version är den
     * som gäller. Den **kastar inte** längre — kopian läggs i historiken
     * först (Johan 20/9), och texten under knappen säger det.
     */
    rescueDropChoice.hidden = !mine;
    rescueDropButton.textContent = WORDS.rescueDrop(savedByOther);
    /*
     * Tiden står en gång i rutan och inte två: i låst läge bär texten ovanför
     * den redan, och en upprepning under knappen läser som två uppgifter man
     * måste jämföra. Där raden inte säger någon tid hör den hemma här.
     */
    rescueDropCost.textContent = mine ? WORDS.rescueDropCost(mayAnswer ? copyAt : "") : "";

    /*
     * *Publicera* is always available, and that is story 125 correcting story
     * 124.
     *
     * The button used to refuse when nothing had changed. It reads as care and
     * it was in the way: publishing the same content again under a new note is
     * a thing people do — a version to point at, a record of a review that
     * found nothing. The review dialog now says *Inga ändringar i innehållet
     * som besökaren ser* and leaves the decision where it belongs.
     *
     * It also made the empty overview unreachable, which is how it was found:
     * the one state the story names could not be opened at all.
     */
    if (viewing !== null) {
      say(
        numberOf(viewing) === 0 || published === 0
          ? WORDS.statusReadOnlyUnknown
          : WORDS.statusReadOnly(numberOf(viewing), published),
      );
      return;
    }

    /*
     * Krocken går före allt annat raden kan säga. Den som fått veta att
     * kollegan hann före behöver inte samtidigt få veta vilken version som är
     * publicerad — och sidan sparar inte längre, vilket är det enda som är
     * brådskande.
     */
    if (paused) {
      say(WORDS.statusPaused);
      return;
    }

    /*
     * Och låset går före resten, av samma skäl: den som inte får skriva har
     * en fråga, och det är vem som gör det.
     *
     * **Ett namn och en relativ tid** sedan 129:s skärning, inte tre klockslag:
     * raden svarar på *sitter någon här nu?* och ingenting annat. De två
     * faktaraderna står i Ta över-dialogen, där den som ska ta över behöver
     * dem.
     *
     * **Raden bär tillståndet, och bara det.** Två meningar slogs om den här
     * raden till 19/9: låsraden, och *Anna Andersson sparade 00:48* som
     * pollningen skrev när den andres arbete kom in. Johan mätte det skarpt —
     * brickan sa *Låst* medan raden under sa något helt annat — och det är
     * precis det skärningen tog bort. **En sparning ÄR aktivitet**, och den
     * syns därför i *aktiv nyss*; en egen mening om den är samma uppgift sagd
     * två gånger, i två former, i samma rad.
     *
     * Att låset togs över säger raden inte heller — det säger **rutan**
     * (`lostLock`), en gång, i det ögonblick det händer.
     */
    if (lockedBy) {
      say(WORDS.lockedBy(lockedBy.name, agoWords(lockedBy.activeAt)));
      return;
    }

    if (failure !== "") {
      say(WORDS.statusFailed(failure));
      return;
    }

    if (notice !== "") {
      say(notice);
      return;
    }

    /*
     * *Finns en publicerad version* och *vet vi dess nummer* är två frågor, och
     * att blanda ihop dem sågs 18/9: med en värd som inte numrerar sa sidan
     * *Ingen version är publicerad än* över en guide som var publicerad. Numret
     * kan saknas; publiceringen finns eller finns inte.
     */
    const anyPublished = currentId !== "";

    /*
     * Den opublicerade guiden har en egen mening, och den säger tiden.
     *
     * *Opublicerade ändringar sedan version N* går inte att säga om något som
     * aldrig publicerats — det finns inget N och ingenting att vara opublicerad
     * *sedan*. Men *sparad 06:05* hör hemma här ändå: det är precis medan man
     * bygger den första versionen man undrar om autosparen går, och beskedet
     * saknade tiden (Johan 19/9).
     *
     * Och innan något sparats finns ingen tid att säga. Då står meningen som
     * säger vad som kommer att hända i stället.
     */
    /*
     * Och varför *Publicera* inte står där, när det finns något att publicera
     * (kriterium 3 och 6).
     *
     * Hängs på meningen i stället för att ersätta den: *sparad 08:19* är det
     * redaktören kom hit för att se, och en rad som byter ut den mot en
     * förklaring har svarat på en fråga genom att sluta svara på en annan.
     *
     * Bara när det finns opublicerade ändringar. Dessförinnan finns ingenting
     * att publicera, och en förklaring till varför man inte får göra något man
     * inte tänkte göra är brus — och brus i en `role="status"` sägs högt varje
     * gång raden ritas om.
     *
     * Och bara för den som får skriva. Läsaren har redan fått veta att hela
     * ytan är läsläge — canvasens bricka säger det, panelen säger det — och en
     * rad om just publiceringen ovanpå det antyder att resten skulle gått. Sett
     * i en skärmbild av Monikas editor, där meningen stod under en canvas som
     * redan sa *LÄSLÄGE*.
     */
    const rung = (text: string): string =>
      mayEdit() && !mayPublish() ? `${text} · ${WORDS.onlyPublisherCanPublish}` : text;

    if (!anyPublished) {
      say(
        clock(savedAt) === ""
          ? WORDS.statusFirst
          : rung(WORDS.statusFirstSavedAt(clock(savedAt), savedByOther)),
      );
      return;
    }

    say(
      changed
      ? rung(
          published === 0
            ? WORDS.statusSavedAtUnknown(clock(savedAt), savedByOther)
            : WORDS.statusSavedAt(published, clock(savedAt), savedByOther),
        )
      : published === 0
        ? WORDS.statusPublishedUnknown
        : WORDS.statusPublished(published),
    );
  };

  /**
   * Var historiken hänger: 8 px under sin knapp, och aldrig över den.
   *
   * Koordinaterna räknas ur knappens ruta i stället för att ärvas av en
   * behållare, för popovern ligger `position: fixed` — den enda formen som
   * varken klipps av editorns `overflow` eller försvinner i helskärm.
   *
   * Under 640 px gör stilmallen den till ett ark nerifrån, och då ska ingen
   * inline-koordinat stå kvar och hålla emot.
   */
  const placeHistory = (): void => {
    if (popover.hidden) {
      return;
    }

    if (window.innerWidth < SHEET_WIDTH) {
      popover.style.removeProperty("top");
      popover.style.removeProperty("left");
      return;
    }

    const button = historyButton.getBoundingClientRect();
    const width = popover.offsetWidth;
    const right = Math.min(button.right, window.innerWidth - 12);

    popover.style.top = `${Math.round(button.bottom + 8)}px`;
    popover.style.left = `${Math.round(Math.max(12, right - width))}px`;
  };

  /**
   * The history, open and closed.
   *
   * It takes focus when it opens: a popover that appears while the focus stays
   * behind it is a popover a keyboard has to walk to, and Escape has nothing to
   * close. It hands the focus back to the button that opened it, because the
   * place to return to is the place you left.
   */
  const showHistory = (open: boolean): void => {
    popover.hidden = !open;
    historyButton.setAttribute("aria-expanded", String(open));
    historyButton.dataset.open = open ? "true" : "";

    if (open) {
      placeHistory();
      popover.focus();
    } else {
      historyButton.focus();
    }
  };

  /** Menyn bakom *…*: det man gör ibland, inte det man gör varje gång. */
  const showMore = (open: boolean): void => {
    moreList.hidden = !open;
    moreButton.setAttribute("aria-expanded", String(open));

    if (open) {
      moreList.querySelector<HTMLButtonElement>("button:not([hidden])")?.focus();
    }
  };

  /**
   * The rows, numbered and narrowed.
   *
   * `actions` tells the element which of its offers this host answers. The page
   * handles opening and nothing else — renaming, notes, duplicating and
   * deleting are a host's own storage concerns, and the contract has none of
   * them. Hiding them with CSS would leave the buttons there for a keyboard
   * and a screen reader, which is a menu that lies rather than a menu that is
   * short.
   */
  /** Sant när *Visa äldre versioner* fällt ut hela listan. */
  let showingAll = false;
  /**
   * En egen ordning, dragen för hand — data, så sidan håller den (som
   * `versions.ts`, exempelsidan). Listan frågar bara (`version-reorder-intent`)
   * och ritar sedan det den fått; utan svar sprang raden tillbaka, mätt med
   * musen 23/9 (Johan: "inget fastnar"). Lever så länge fliken gör: att lagra
   * den hos värden är en rad i kontraktet som ingen bett om än.
   */
  let handOrder: string[] | null = null;

  list.addEventListener("version-reorder-intent", (event) => {
    handOrder = (event as CustomEvent<{ order: string[] }>).detail.order;
    void drawList();
  });

  const drawList = async (): Promise<void> => {
    const listed = await store.listVersions(guideId);

    // Exakt som värden skickade dem. Namnet på raden är `number`, och det är
    // listkomponenten som skriver ut det (`editor.versions.numbered`).
    rows = [...listed];
    currentId = rows.find((one) => one.current)?.id ?? "";
    /*
     * Vad listan erbjuder följer rollen (berättelse 128). Att gömma raden med
     * CSS hade lämnat knappen kvar för ett tangentbord och en skärmläsare —
     * alltså en meny som ljuger i stället för en meny som är kort.
     */
    list.actions = mayPublish() ? ["open", "restore"] : ["open"];

    /*
     * De fem senaste, och resten bakom en knapp.
     *
     * En historik är nästan alltid en fråga om det som just hände — och ett år
     * av versioner är en skroll man ger upp inför. Den som letar längre tillbaka
     * vet om det och trycker en gång till.
     */
    const shown = showingAll ? rows : rows.slice(0, LATEST);

    /*
     * I egen ordning: som handen lade dem, och det som tillkommit sedan dess
     * (en nyss publicerad version) överst, där nytt hör hemma.
     */
    const placed = handOrder
      ? [
          ...shown.filter((one) => !handOrder!.includes(one.id)),
          ...handOrder.map((id) => shown.find((one) => one.id === id)).filter(
            (one): one is GuideVersion => one !== undefined,
          ),
        ]
      : shown;

    list.versions = placed.map((one) => ({ ...one, open: one.id === viewing }));
    popoverCount.textContent = WORDS.historyCount(rows.length);
    olderButton.hidden = showingAll || rows.length <= LATEST;
    olderButton.textContent = WORDS.historyOlder(Math.max(0, rows.length - LATEST));
    placeHistory();
  };

  /** The published version's graph, for deciding what is unpublished. */
  const readPublished = async (): Promise<void> => {
    publishedGraph = currentId === "" ? null : ((await store.openVersion(guideId, currentId)) ?? null);
  };

  /**
   * En krock är inte ett fel som går över (127, kriterium 4; 129, rutan).
   *
   * Värden har avvisat skrivningen därför att någon annan hunnit skriva, och
   * nästa försök från den här sidan skulle skriva över just det. Så autosparen
   * kopplas **ifrån** — inte pausas — och frågan ställs i en ruta.
   *
   * **Kopian skrivs först, rutan visas sedan.** Ordningen är hela kriteriet:
   * en kopia som lades undan efter ett val finns inte om fönstret stängs medan
   * rutan står öppen, och det är precis då någon stänger det (`guide-rescue.ts`).
   *
   * En funktion bakom tre dörrar: autosparen, *Publicera* och *Återställ*
   * skriver alla hos värden och kan alla mötas av samma avvisning. Tre kopior
   * hade blivit tre rutor som sa nästan samma sak.
   */
  const handleConflict = async (clash: GraphSaveConflict): Promise<void> => {
    autosave.disconnect();
    paused = true;
    lastClash = clash;
    writeRescue(guideId, editor.getData(), base);
    rescue = readRescue(guideId);
    drawState();

    await askConflict();
  };

  /** Rutan, och det valet betyder. Också vägen tillbaka in via *Välj*. */
  const askConflict = async (): Promise<void> => {
    const clash = lastClash;

    if (!clash || conflictOpen) {
      return;
    }

    conflictOpen = true;

    const choice = await conflictDialog.ask({
      name: clash.by,
      clock: clock(clash.savedAt),
      // När mina egna osparade ändringar började: sista lyckade sparningen.
      since: clock(savedAt),
    });

    conflictOpen = false;

    if (choice === "reload") {
      /*
       * Kopian ligger redan i webbläsaren, så omladdningen förlorar
       * ingenting — och frågan om den möter en på andra sidan.
       */
      location.reload();
      return;
    }

    if (choice === "merge") {
      await mergeWithTheirs(editor.getData(), base);
      return;
    }

    /* `cancel`, och Escape: autosparen är av, och raden säger det. */
    drawState();
  };

  /**
   * *Slå ihop ändringar* — och ingenting går förlorat på vägen (131).
   *
   * Fyra steg, och ordningen är hela berättelsen:
   *
   *  1. **Läs om.** Värdens arbetskopia nu är den ena parten, och läsningen ger
   *     dessutom stämpeln som skrivningen i steg 4 villkoras mot.
   *  2. **Fråga.** Planen räknas mot utgångspunkten, och rutan ställer bara de
   *     frågor där båda rört samma sak — oftast noll.
   *  3. **Frys båda kopiorna**, innan något skrivs. Den text som förlorade ett
   *     val ligger då kvar i historiken och går att återställa. Kostnaden är
   *     två rader per krock, och ett `409` i steg 4 gör dem till fyra — det är
   *     billigare än en text ingen kan få tillbaka.
   *  4. **Skriv, villkorat.** Aldrig utan villkor: hinner en TREDJE person
   *     spara mellan rutan och knappen kommer krockrutan igen med den nya
   *     listan, i stället för att hens text försvinner tyst.
   *
   * Utan utgångspunkt görs ingen sammanslagning. Sidan säger det och lämnar
   * rutan öppen att välja i igen — en sammanslagning mot en gissad startpunkt
   * hade sett ut precis som en riktig.
   */
  const mergeWithTheirs = async (mine: GraphData, from: GraphData | null): Promise<void> => {
    if (!from) {
      failure = WORDS.mergeNoBase;
      drawState();
      return;
    }

    const fresh = await store.load(guideId);

    if (fresh.status !== "success") {
      failure = fresh.status === "error" ? fresh.message : WORDS.mergeNoTheirs;
      drawState();
      return;
    }

    const theirs = fresh.graph;
    const plan = GuideMergeService.plan(from, theirs, mine);
    /*
     * Vems arbete det andra är, ur den **färska** läsningen och inte ur radens
     * `savedByOther`: den kan ha nollställts av en egen sparning sedan dess,
     * och en ruta som säger *Den andra ändrade* om en namngiven kollega är en
     * ruta som vet mindre än sidan bakom den. Värden säger `me`, sidan lyder —
     * ingen namnjämförelse någonstans.
     */
    const theirName = fresh.draft && fresh.savedBy && !fresh.savedBy.me ? fresh.savedBy.name : "";

    /*
     * Vad som skulle städas bort, räknat om vid varje val: en väg till en nod
     * som den ena tog bort och den andra inte ändrade. Sidan räknar, rutan
     * säger — och den säger det medan man väljer, inte efteråt.
     */
    const countDropped = (choices: Record<string, MergeSide>): void => {
      mergeDialog.dropped = GuideMergeService.apply(plan, choices).droppedConnections.length;
    };

    countDropped({});

    const onChoice = (event: Event): void =>
      countDropped((event as CustomEvent).detail.choices as Record<string, MergeSide>);
    const onPreview = (event: Event): void => {
      const choices = (event as CustomEvent).detail.choices as Record<string, MergeSide>;

      previewDialog.open(
        GuideMergeService.apply(plan, choices).graph,
        undefined,
        editor.getAttribute("active-locale") ?? undefined,
      );
    };

    mergeDialog.addEventListener("merge-choice-intent", onChoice);
    mergeDialog.addEventListener("merge-preview-intent", onPreview);

    const choices = await mergeDialog.ask({ plan, name: theirName });

    mergeDialog.removeEventListener("merge-choice-intent", onChoice);
    mergeDialog.removeEventListener("merge-preview-intent", onPreview);

    if (!choices) {
      /* Avbrutet: ingenting skrivet, ingenting fryst, rutan går att öppna igen. */
      drawState();
      return;
    }

    const merged = GuideMergeService.apply(plan, choices);

    /*
     * Frysningen först, och båda kopiorna. Ett fel här stoppar sammanslagningen
     * — poängen med att frysa är att ingenting ska gå förlorat, och att skriva
     * ändå hade tagit bort precis den garantin utan att någon fick veta det.
     */
    for (const [copy, side] of [
      [theirs, "theirs"],
      [mine, "mine"],
    ] as const) {
      const frozen = await store.saveSnapshot(guideId, copy, side);

      if (!frozen.success) {
        failure = WORDS.mergeNotFrozen;
        drawState();
        return;
      }
    }

    const written = await store.saveDraft(guideId, merged.graph);

    if (!written.success) {
      if (written.conflict) {
        await handleConflict(written.conflict);
        return;
      }

      failure = written.message;
      drawState();
      return;
    }

    editor.graph = merged.graph;
    noteBase(merged.graph);
    paused = false;
    lastClash = null;
    failure = "";
    notice = merged.droppedConnections.length === 0 ? WORDS.merged : WORDS.mergedDropped;
    savedAt = written.savedAt;
    savedByOther = "";
    unsaved = false;
    clearRescue(guideId);
    rescue = null;
    await drawList();

    if (mayEdit() && lockedBy === null) {
      autosave.connect();
    }

    drawState();
  };

  /* ── Låset: ta, förnya, tappa, släppa (berättelse 129) ────────────────── */

  /** Nästa förnyelse tidigast om halva livslängden, räknad ur värdens `until`. */
  const noteLock = (held: GuideLock): void => {
    const until = Date.parse(held.until);
    const now = Date.now();

    renewAfter = Number.isFinite(until) && until > now ? now + (until - now) / 2 : now + 60_000;
  };

  /**
   * Låset när guiden öppnas för redigering.
   *
   * En läsare tar inget lås: hen kan ändå inte skriva, och ett lås som hindrar
   * andra utan att ge något är det sämsta av båda.
   *
   * Och **inte alls utan inloggning** (`?key=` i adressen). Där finns ingen
   * person att låsa åt — hemligheten är en guides legitimation och inte en
   * människas — och värden svarar `404`. Att ändå fråga är en förfrågan vars
   * avslag en webbläsare loggar som ett fel på en sida där ingenting är fel;
   * exakt samma sak mättes 18/9 om `/auth/me`, och `smoke:guide-storage`
   * räknade dem båda gångerna.
   *
   * Håller jag det redan från en annan sittning tas det över utan att fråga —
   * det kostar ingen annan något, och alternativet vore att be någon om lov att
   * ta över sig själv.
   */
  const takeLock = async (): Promise<void> => {
    if (!mayEdit() || !useSession) {
      return;
    }

    let answer = await lock.take();

    if (answer.kind === "taken" && answer.lock.me) {
      answer = await lock.take({ takeOver: true });
    }

    if (answer.kind === "held") {
      holding = true;
      lockedBy = null;
      noteLock(answer.lock);
      return;
    }

    if (answer.kind === "taken") {
      holding = false;
      lockedBy = answer.lock;
    }

    /*
     * `none` och `refused` lämnar allt som det var: en värd utan låsvägar är
     * en fullgod värd, och sidan säger då ingenting om vem som arbetar.
     */
  };

  /**
   * Förnya — **bara vid aktivitet**, och inte oftare än halva livslängden.
   *
   * Anropas av en ändring i grafen, ett tangenttryck i editorn, och `force`
   * före varje sparning. Aldrig av en timer: ett fönster som står öppet utan
   * att någon rör det ska tappa låset, för det är det som gör att ett stängt
   * laptoplock inte stoppar en publicering.
   *
   * `force` finns för att spärren är en spärr mot **anropsvågor** och inte mot
   * att få veta något. En sparning är i alla fall högst en var tredje sekund,
   * och det är precis den takt i vilken man vill upptäcka att låset är borta.
   */
  const renewLock = async (force = false): Promise<void> => {
    if (!holding || lockedBy !== null || (!force && Date.now() < renewAfter)) {
      return;
    }

    // Håll nästa försök borta medan det här är i luften, så en skrivvåg inte
    // blir en anropsvåg.
    renewAfter = Date.now() + 1000;

    const answer = await lock.take();

    if (answer.kind === "held") {
      noteLock(answer.lock);
      return;
    }

    if (answer.kind === "taken") {
      lostLock(answer.lock);
    }
  };

  /**
   * Någon tog över medan jag arbetade.
   *
   * Editorn går i läsläge, autosparen kopplas ifrån, och det som inte hann
   * sparas läggs i webbläsaren — samma kopia och samma fråga som vid en krock,
   * för det är samma sak som hänt: mitt arbete finns bara här.
   */
  const lostLock = (held: GuideLock): void => {
    holding = false;
    lockedBy = held;
    autosave.disconnect();

    let saved = false;

    if (unsaved) {
      writeRescue(guideId, editor.getData(), base);
      rescue = readRescue(guideId);
      saved = rescue !== null;
    }

    editor.mode = "readonly";
    drawState();

    /*
     * Och en ruta som säger det (129:s skärning, punkt 2).
     *
     * Beskedet stod i raden till 19/9, och en rad är lätt att missa — särskilt
     * den här, som byter text i samma ögonblick som editorn slutar gå att
     * skriva i. Den som satt och skrev märkte först att tangenterna inte
     * längre gjorde något.
     *
     * Rutan avbryter, säger händelsen och har **en** väg vidare. Efter den
     * ligger läsläget kvar och följer med (`followLock`, tillägget 19/9), så
     * den som väljer att stanna ser vad den andre skriver.
     *
     * `drawState()` först och rutan sedan: raden, brickan och läsläget ska
     * vara sanna bakom rutan, inte efter den. En ruta med gammal information
     * bakom sig är en ruta man stänger och sedan inte litar på.
     *
     * Löftet inväntas inte. Det finns ingenting att göra med svaret — rutan
     * frågar inget — och ett `await` här hade hållit `lostLock` öppen medan
     * någon läser, mitt i en sparning eller en pollningsrunda.
     */
    takenOverOpen = true;
    /* Och en omritning till, nu med räddningsraden gömd bakom rutan. */
    drawState();

    void dialog
      .acknowledge({
        title: held.me ? WORDS.takenOverBySelfTitle : WORDS.takenOverTitle(held.name),
        message: saved ? WORDS.takenOverRescue : WORDS.takenOverReadOnly,
        okLabel: WORDS.takenOverOk,
      })
      .then(() => {
        takenOverOpen = false;
        /* Rutan är läst; raden får säga var arbetet ligger och vad man gör åt
           det. Det är raden som bär beskedet vidare — rutan kommer aldrig
           tillbaka. */
        drawState();
      });
  };

  /* ── Läsläget följer med (berättelse 129, tillägget 19/9) ─────────────── */

  /**
   * En runda: har något hänt hos värden sedan sist?
   *
   * Johan, med två fönster uppe: *"kan min session få en signal?"* I läsläge
   * frågade sidan ingenting, så den andres arbete syntes först vid en
   * omladdning — och den som inte vet att det finns något nytt laddar inte om.
   *
   * Stämpeln sidan har är frågan (`?since`), och värden svarar `204` utan
   * kropp när inget hänt. Har något hänt kommer guiden som vanligt — och med
   * den låset, som är det andra halva svaret.
   *
   * ## Två fönster frågar, och av två skäl
   *
   * **Den som läser** vill se vad den andre skriver: grafen ritas om och raden
   * säger vem som skrev och när.
   *
   * **Den som tror sig hålla låset** vill veta att det inte längre är så.
   * Johan mätte det 19/9: *"När man tar över uppdateras det först, men om den
   * andra tar över igen blir det ingen automatisk uppdatering."* Orsaken var
   * inte att pollningen startade fel — mätt i en webbläsare med två
   * övertaganden startade den varje gång ett fönster HAMNADE i läsläge. Felet
   * var att ett stillastående fönster aldrig hamnade där: förnyelsen är det
   * enda som upptäcker ett övertagande, och den sker bara vid aktivitet. Den
   * som satt still satt kvar i en editor hen inte längre fick skriva i.
   *
   * Frågan här förlänger ingenting — den är en läsning, och bäst-före gäller
   * precis som förut. Det är hela skillnaden mot en förnyelse på timer, som
   * hade hållit ett lås vid liv i ett fönster ingen sitter vid.
   *
   * **Två kontroller av låset, inte en.** Den andra står efter väntan: ett
   * övertagande hinner ske medan frågan är i luften, och att då rita om
   * canvasen ur värdens arbetskopia hade tagit över det man själv just tagit
   * över.
   */
  const followOnce = async (): Promise<void> => {
    if (viewing !== null || (lockedBy === null && !holding)) {
      return;
    }

    const answer = await store.loadSince(guideId, savedAt);

    if (answer === "unchanged" || viewing !== null) {
      return;
    }

    /*
     * Ett fel här säger ingenting i raden. Sidan står i läsläge och sparar
     * inte; en nätverkssekund som gick fel är inget den som tittar kan göra
     * något åt, och ett felmeddelande som kommer och går var tionde sekund är
     * värre än tystnad. Nästa runda är om tio sekunder.
     */
    if (answer.result.status !== "success") {
      return;
    }

    /*
     * Låset först: står det någon annans namn på det medan jag tror att det är
     * mitt, är det nyheten. `lostLock` lägger undan det osparade, går i läsläge
     * och startar pollningen — samma väg som när en sparning upptäcker det,
     * bara utan att någon behövde röra tangentbordet.
     */
    if (lockedBy === null && holding && answer.lock && !answer.lock.me) {
      lostLock(answer.lock);
    }

    /*
     * Håller jag fortfarande låset har någon skrivit utan att hålla det —
     * vilket skrivvägarna tillåter. Då ritas ingenting om: det som står på min
     * skärm är mitt arbete, och krocken tas av nästa sparning, med rutan som
     * frågar vad som ska gälla.
     */
    if (lockedBy === null) {
      return;
    }

    const loaded = answer.result;

    savedAt = loaded.draft ? loaded.savedAt : "";
    savedByOther =
      loaded.draft && loaded.savedBy && !loaded.savedBy.me ? loaded.savedBy.name : "";
    /*
     * **Låset med, inte en mening om sparningen.**
     *
     * Raden skrev *Anna Andersson sparade 00:48* här till 19/9, och den
     * ersatte låsraden bakom en öppen ruta som sa något annat (Johans
     * mätning). Efter skärningen bär raden tillståndet, och en sparning är
     * aktivitet: det som behöver hända är att `activeAt` blir färsk, så
     * *aktiv för fyra minuter sedan* blir *aktiv nyss* i samma ögonblick som
     * grafen ritas om.
     *
     * Bara någon annans levande lås skrivs över. Ett svar utan lås betyder att
     * det löpt ut eller släppts, och att byta läge mitt under den som tittar
     * på en graf är en större sak än den här raden — den tas vid nästa
     * öppning, som förut.
     */
    if (answer.lock && !answer.lock.me) {
      lockedBy = answer.lock;
    }
    /*
     * `refreshGraph` och inte `edit`: läget är redan läsläge och autosparen är
     * redan frånkopplad — det som skiljer är vyn. `graph = …` betyder *en
     * annan guide* och lägger tillbaka vyn över innehållet, mätt som ett hopp
     * från 247,453 till 342,363 mitt framför den som tittade.
     */
    editor.refreshGraph(loaded.graph);
    /* Skärmen visar värdens graf nu, alltså är det den man utgår från. */
    noteBase(loaded.graph);
    drawState();
  };

  /**
   * Starta eller sluta följa — allt på ett ställe, anropat ur `drawState`.
   *
   * Tre villkor, och alla tre är avstängningar som betyder något:
   *
   *  - **Någon annan håller låset — eller jag tror att jag gör det.** Den som
   *    varken läser eller skriver i guiden (en läsare, en värd utan lås) har
   *    ingen fråga. De två som har en ställer samma fråga och får samma tomma
   *    svar; det som skiljer är vad de gör med ett svar som inte är tomt.
   *  - **Ingen gammal version på skärmen.** Den som tittar på version 3 ska
   *    inte få arbetskopian ritad över den.
   *  - **Fliken syns.** En bortglömd flik i bakgrunden frågar ingenting.
   */
  const followLock = (): void => {
    const should =
      (lockedBy !== null || holding) &&
      viewing === null &&
      document.visibilityState === "visible";

    if (should && followTimer === 0) {
      /*
       * Raden ritas om varje runda, också när värden svarar *inget nytt*.
       *
       * Låsraden säger *aktiv för 3 minuter sedan* (129:s skärning), och en
       * relativ tid som skrivs en gång är en tid som blir fel med en minut per
       * minut. Omritningen kostar ingenting — `say()` skriver bara när texten
       * skiljer, så varken DOM eller skärmläsare märker de rundor där siffran
       * står stilla.
       *
       * Före frågan och inte efter: siffran hör till klockan på den här
       * maskinen, inte till värdens svar, och den ska stämma även de rundor
       * där svaret aldrig kommer.
       */
      followTimer = window.setInterval(() => {
        drawState();
        void followOnce();
      }, FOLLOW_INTERVAL);
      return;
    }

    if (!should && followTimer !== 0) {
      clearInterval(followTimer);
      followTimer = 0;
    }
  };

  document.addEventListener("visibilitychange", followLock);

  /**
   * Släpp låset på väg ut — `pagehide` och *Guider*-länken.
   *
   * En funktion och två dörrar, inte två mekanismer: `pagehide` täcker båda i
   * praktiken, men länken är den väg någon faktiskt tar, och den ska inte bero
   * på att en webbläsare hinner med sitt eget avsked.
   *
   * Går det inte fram ligger låset kvar tills det löper ut. Det är precis vad
   * bäst-före finns till för.
   */
  const releaseLock = (): void => {
    if (!holding) {
      return;
    }

    holding = false;
    lock.release();
  };

  /**
   * Autosparens väg till värden går **genom låset** (berättelse 129).
   *
   * Förnyelsen ligger före skrivningen och inte efter, och det är hela
   * skillnaden mellan att upptäcka ett övertagande och att skriva över det:
   *
   *  - före betyder att sidan får veta *innan* den skickar en graf någon annan
   *    nu äger, och att det osparade hinner läggas i webbläsaren medan det
   *    fortfarande är osparat;
   *  - efter hade betytt en skrivning först och ett besked sedan — och den som
   *    tog över hade fått sin arbetskopia utbytt under sig.
   *
   * Ett omslag och ingen ändring i `AutosaveController`: kontrollern kan en sak
   * — skriv det som ändrats, högst så här ofta — och låset är sidans regel om
   * när det får ske. En kontroller som kände till lås hade varit en kontroller
   * varje annan sida också måste förstå.
   */
  const lockedStore = {
    saveDraft: async (id: string, graph: GraphData) => {
      await renewLock(true);

      if (lockedBy) {
        /*
         * Låset är någon annans nu, och `lostLock` har redan sagt vad som
         * hände. Ett tomt meddelande, för det här är inget som gick fel — det
         * gick rätt för någon annan, och raden säger det redan.
         */
        return { success: false as const, message: "" };
      }

      const written = await store.saveDraft(id, graph);

      /*
       * En lyckad sparning är en ny utgångspunkt: från och med nu är det den
       * här grafen båda utgår från, och det som skrivs efteråt är mitt ensamt
       * (berättelse 131).
       */
      if (written.success) {
        noteBase(graph);
      }

      return written;
    },
    beforeUnload: () => store.beforeUnload(),
  };

  const autosave = new AutosaveController({
    source: editor,
    store: lockedStore,
    guideId,
    delay: DRAFT_INTERVAL,
    onSave: (result) => {
      if (!result.success && result.conflict) {
        void handleConflict(result.conflict);
        return;
      }

      failure = result.success ? "" : result.message;
      savedAt = result.success ? result.savedAt : savedAt;
      // Arbetskopian är min nu, så namnet bredvid *sparad* hör till det som var.
      savedByOther = result.success ? "" : savedByOther;

      if (result.success) {
        // Allt är hos värden igen — det finns inget att rädda. Låset förnyades
        // redan, före skrivningen (`lockedStore`).
        unsaved = false;
      }

      drawState();
    },
  });

  /** Back to working on the guide, after looking at an old version. */
  const edit = (graph: GraphData): void => {
    viewing = null;
    /*
     * Rollens läge, inte `administrator` för alla.
     *
     * Raden stod på `"administrator"` till berättelse 128 och var den enda
     * platsen läget sattes efter att sidan hämtat något — så en läsare fick
     * hela paletten i samma ögonblick som guiden kom fram, hur läget än var
     * satt i markupen.
     */
    /*
     * Och låset väger tyngre än rollen (berättelse 129): den som får skriva
     * men inte håller låset ska ändå inte skriva, för någon annan sitter i
     * guiden just nu.
     */
    editor.mode = lockedBy ? "readonly" : allowedMode;
    editor.graph = graph;

    // Och den som inte får skriva sparar inte heller. Läget är en vy; det här
    // är det som annars hade skickat en `PUT` värden svarar `401` på.
    if (mayEdit() && lockedBy === null) {
      autosave.connect();
    } else {
      autosave.disconnect();
    }
  };

  /**
   * An old version on screen, and no way to change it by accident.
   *
   * `<guide-editor>` already has a read-only mode — it is the default, and it
   * is a view rather than a lock (`EditorMode` in the library says so). That is
   * the right tool here: the canvas stays, so somebody comparing two versions
   * sees the same drawing rather than a different rendering of it, and nothing
   * they press writes. Autosave is disconnected on top, because a view that
   * cannot be changed must also not be able to save.
   */
  const view = (versionId: string, graph: GraphData): void => {
    autosave.disconnect();
    viewing = versionId;
    editor.mode = "readonly";
    editor.graph = graph;
  };

  const open = async (): Promise<void> => {
    const loaded = await store.load(guideId);

    await drawList();
    await readPublished();

    if (loaded.status === "error") {
      failure = loaded.message;
      drawState();
      return;
    }

    if (loaded.status === "success") {
      edit(loaded.graph);
      /* Det här är vad båda utgick från, tills någon skriver igen. */
      noteBase(loaded.graph);
      savedAt = loaded.draft ? loaded.savedAt : "";
      /*
       * Vems arbetskopia det är man öppnade (berättelse 127).
       *
       * Bara när det var någon annan: värden säger `me` och sidan lyder. Den
       * som öppnar sin egen arbetskopia ska inte läsa sitt eget namn varje
       * gång — då slutar man läsa raden, och den betyder något den dagen den
       * bär ett annat namn.
       */
      savedByOther = loaded.draft && loaded.savedBy && !loaded.savedBy.me ? loaded.savedBy.name : "";
      note = loaded.note ?? null;
      editors = loaded.editors ?? [];
    } else {
      const fresh = { startNodeId: null, nodes: [], connections: [] } as unknown as GraphData;

      edit(fresh);
      noteBase(fresh);
      savedAt = "";
      savedByOther = "";
      note = null;
      editors = [];
    }

    drawState();
  };

  editor.addEventListener("graph-changed", () => {
    // En ändring är ett nytt läge; bekräftelsen om den återställda versionen
    // hör till det som var.
    notice = "";
    /*
     * Och det finns något som ännu inte nått värden — det som ska räddas om
     * låset tas ifrån en de närmaste sekunderna. Nollas av en lyckad sparning.
     */
    unsaved = true;
    void renewLock();
    drawState();

    /*
     * The overview follows the working copy while the dialog is open, and says
     * that it moved. Somebody who has read a list has decided on that list; one
     * that quietly becomes another list is worse than no list at all.
     */
    if (reviewed !== null) {
      reviewed = editor.getData();
      publishDialog.update(requestFor(reviewed, publishDialog.note));
    }
  });

  /*
   * *Gå till frågan*: the dialog has closed itself, and what is left is to take
   * the editor there. The note comes back with the intent and waits for the
   * next press of Publicera.
   */
  publishDialog.addEventListener("publish-goto-intent", (event) => {
    const detail = (event as CustomEvent<{
      nodeId: string;
      note: string;
      field?: string;
    }>).detail;

    keptNote = detail.note;
    reviewed = null;
    // The field goes with it when the check named one, so the cursor lands in
    // it rather than only on the card.
    editor.revealNode(detail.nodeId, detail.field);
  });

  publishDialog.addEventListener("publish-preview-intent", (event) => {
    const nodeId = (event as CustomEvent<{ nodeId?: string }>).detail.nodeId;

    previewDialog.open(
      reviewed ?? editor.getData(),
      nodeId,
      editor.getAttribute("active-locale") ?? undefined,
      /*
       * The warning belongs to the jump, not to the dialog that asked for it:
       * opening at a node means the questions before it are unanswered, so the
       * conditions that depend on them do not hold.
       */
      nodeId ? t("editor.publish.previewWarning", "sv") : undefined,
    );
  });

  /*
   * Ctrl+S and Arkiv → Spara: there is no *Save* on this page, so the key does
   * what the page's own button does. Answering the event at all matters — the
   * editor otherwise says "your host saves this", which is true and useless
   * when the host is right here with a Publicera button.
   */
  editor.addEventListener("save-request", (event) => {
    event.preventDefault();
    void publish();
  });

  /**
   * What the dialog is looking at, and what publishing would therefore freeze.
   *
   * Non-null exactly while the dialog is open. Keeping the graph rather than
   * reading `editor.getData()` again at the moment somebody presses Publicera
   * is the whole of criterion 7: reviewing one thing and publishing another is
   * the failure this story exists to prevent, and the two are a keystroke apart
   * whenever autosave lands between the reading and the press.
   */
  let reviewed: GraphData | null = null;
  /** The note survives a trip to the canvas and back (criterion 5). */
  let keptNote = "";

  /** Everything the dialog shows, derived from one graph. */
  const requestFor = (graph: GraphData, note: string): PublishRequest => {
    const published = currentId === "" ? 0 : numberOf(currentId);
    /* Namnet `note` är upptaget av publiceringens egen etikett i den här
       funktionen; arbetsanteckningen är en annan sak och heter det den heter
       i kontraktet. */
    const noteHeld = workNote();

    return {
      version: rows.length + 1,
      previous: published === 0 ? null : published,
      /*
       * A first publication has nothing to compare against, which is not the
       * same as nothing having changed. Then the question is *what am I
       * publishing*, and the answer is the guide itself.
       */
      changes: publishedGraph
        ? GuideDiffService.compare(publishedGraph, graph)
        : GuideDiffService.outline(graph),
      outline: publishedGraph === null,
      issues: GuideHealthService.analyze(graph),
      note,
      /*
       * Vems ändringar granskningen innehåller, och lappen någon lämnat på
       * arbetskopian (berättelse 130). Båda är värdens svar och skickas vidare
       * orörda — utan värd, utan inloggning, inget av det, och rutan ser ut som
       * den gjorde före 130.
       */
      ...(editors.length > 0 ? { contributors: editors } : {}),
      ...(noteHeld === null
        ? {}
        : { draftNote: { text: noteHeld.text, name: noteHeld.name, at: noteHeld.at } }),
    };
  };

  /**
   * Publishing is one act: freeze what is there, and make it the one visitors
   * get.
   *
   * It was two presses until 17/9 — *Spara som version*, then *Publicera* in
   * the row's menu — and Johan met the half-way state as a fault: *"så fort
   * jag skapar ny version låses den"*. A version that is frozen but not
   * published is a state this page has no use for, so it does not have one.
   *
   * Since story 125 it asks first, with what would change and what would break
   * on screen — and it still ends in one press.
   */
  async function publish(): Promise<void> {
    if (viewing !== null) return;

    reviewed = editor.getData();

    const answer = await publishDialog.ask(requestFor(reviewed, keptNote));
    const frozenGraph = reviewed;

    reviewed = null;

    if (answer === null || frozenGraph === null) return;

    keptNote = "";
    autosave.flush();

    const frozen = await store.saveVersion(guideId, frozenGraph, answer.note);

    if (!frozen.success) {
      /*
       * Att publicera en arbetskopia någon annan hunnit ändra är att publicera
       * en text man inte har sett. Samma rad som vid en krockande sparning, och
       * samma stopp: ingenting frystes, och sidan säger vem man ska fråga.
       */
      if (frozen.conflict) {
        await handleConflict(frozen.conflict);
        return;
      }

      failure = frozen.message;
      drawState();
      return;
    }

    const moved = await store.publish(guideId, frozen.version.id);

    if (!moved.success) {
      failure = moved.message;
      drawState();
      return;
    }

    /*
     * And no working copy afterwards. What was in it is the published version
     * now, so a copy left behind would answer *are there unpublished changes?*
     * with a yes that means "no" — on this device and, worse, on the next one.
     */
    await store.discardDraft(guideId);

    failure = "";
    savedAt = "";
    savedByOther = "";
    notice = "";
    await drawList();
    await readPublished();
    drawState();
  }

  publishButton.addEventListener("click", () => {
    // Refused here, where it can still be refused — see `drawState`.
    if (publishButton.getAttribute("aria-disabled") === "true") return;

    void publish();
  });

  /*
   * Ett tangenttryck i editorn är aktivitet, och det är allt det är.
   *
   * Det räknas här och inte i editorn, för låset är värdens och sidans sak —
   * biblioteket vet ingenting om vem som håller vad. `keydown` bubblar ut ur
   * skuggträdet (tangentbordshändelser är `composed`), så den här raden når
   * varje fält och varje nod inuti.
   */
  editor.addEventListener("keydown", () => void renewLock());

  /* Tillbaka in i rutan, för den som tryckte Avbryt och sedan bestämt sig. */
  chooseButton.addEventListener("click", () => void askConflict());

  /**
   * *Ta över* — och frågan före den säger vad det kostar den andre.
   *
   * Samma dialog som varje annan fråga på sidan, i `normal`-ton: ett
   * övertagande förstör ingenting som inte går att skriva igen, och en röd
   * knapp på en vardaglig handling lär folk att klicka igenom den som betyder
   * något.
   */
  takeOverButton.addEventListener("click", async () => {
    const held = lockedBy;

    if (!held) return;

    /*
     * Rubriken är frågan, tiderna är rader, konsekvensen är en mening — se
     * `takeOverTitle` i ordlistan för varför formen ser ut så.
     */
    const sure = await dialog.confirm({
      title: WORDS.takeOverTitle(held.name),
      /*
       * Och anteckningen ovanför fakta, när det finns en (berättelse 130).
       *
       * Johan 19/9: *"om någon skriver så lär man inte bara ta över"*. Tre
       * klockslag säger vad som hänt; *Inte klar — juristen ska läsa
       * resultattexterna* säger varför det spelar roll.
       */
      ...(note === null
        ? {}
        : { quote: { title: WORDS.noteQuote(note.name, clock(note.at)), text: note.text } }),
      facts: [
        {
          label: WORDS.takeOverSavedLabel,
          value: clock(savedAt) === "" ? WORDS.takeOverNothingSaved : clock(savedAt),
        },
        { label: WORDS.takeOverActiveLabel, value: clock(held.activeAt) },
      ],
      message: WORDS.takeOverMessage(held.name, clock(savedAt)),
      confirmLabel: WORDS.takeOver,
      cancelLabel: WORDS.cancel,
      tone: "normal",
    });

    if (!sure) return;

    const answer = await lock.take({ takeOver: true });

    if (answer.kind !== "held") {
      /*
       * Någon hann före, eller värden sa nej. Guiden läses om i stället för
       * att raden gissar: `open()` hämtar låset som faktiskt ligger där.
       */
      await takeLock();
      await open();
      return;
    }

    holding = true;
    /* Guiden är min nu, och raden är min egen igen. Pollningen slutar i
       `followLock` när `drawState` körs. */
    lockedBy = null;
    noteLock(answer.lock);

    /*
     * Och guiden om. Den andres arbete kan ha hunnit ändras sedan sidan
     * öppnades, och att fortsätta på det man råkade ha på skärmen är precis
     * det övertagandet skulle undvika.
     */
    await open();
  });

  /* ── Webbläsarkopian: fortsätta där jag var, eller börja om ───────────── */

  /*
   * *Slå ihop* ur räddningsraden: samma väg som ur krockrutan, med kopian som
   * min graf och kopians egen utgångspunkt som den gemensamma. Den i minnet
   * duger inte — efter en omladdning är den värdens nuvarande graf, och en
   * sammanslagning mot den hade sagt att jag ändrat allt och hon ingenting.
   */
  rescueMergeButton.addEventListener("click", async () => {
    const held = rescue;

    if (!held?.base) return;

    await mergeWithTheirs(held.graph, held.base);
  });

  rescueKeepButton.addEventListener("click", async () => {
    const held = rescue;

    if (!held) return;

    /*
     * Värdens aktuella stämpel först, sedan skrivningen. Samma regel som
     * *Behåll mina*: en skrivning utan villkor hade tagit någons text med sig.
     */
    await store.load(guideId);

    const written = await store.saveDraft(guideId, held.graph);

    if (!written.success) {
      if (written.conflict) {
        await handleConflict(written.conflict);
        return;
      }

      failure = written.message;
      drawState();
      return;
    }

    clearRescue(guideId);
    rescue = null;
    paused = false;
    lastClash = null;
    failure = "";
    savedAt = written.savedAt;
    savedByOther = "";
    unsaved = false;
    edit(held.graph);
    await drawList();
    await readPublished();
    drawState();
  });

  rescueDropButton.addEventListener("click", async () => {
    const held = rescue;

    if (!held) return;

    /*
     * **Ingenting kastas** (Johan 20/9: *"lite förvirrande att det står dina
     * ändringar kastas"*).
     *
     * Ingenting skrivs i guiden — det som ligger hos värden är redan det man
     * ser, och att börja därifrån är att låta bli att göra något. Men kopian
     * försvann, och sedan 131 gäller att inget går förlorat. Den läggs därför
     * i historiken först, samma väg och samma etikett som sammanslagningens
     * två (`POST …/snapshots`).
     *
     * Vägen kräver inte låset — mätt: den prövas mot rollen *redaktör* och
     * aldrig mot ett lås — så den går också medan någon annan håller guiden.
     */
    const kept = await store.saveSnapshot(guideId, held.graph, "mine");

    if (!kept.success) {
      /*
       * Och gick det inte: gör ingenting alls. Att ändå ta bort kopian hade
       * varit att kasta något medan knappen just lovat motsatsen.
       */
      failure = WORDS.rescueNotKept;
      drawState();
      return;
    }

    failure = "";
    clearRescue(guideId);
    rescue = null;
    /* Historiken har en rad till, och popovern ska veta det. */
    await drawList();
    drawState();
  });

  historyButton.addEventListener("click", () => showHistory(popover.hidden === true));
  popoverClose.addEventListener("click", () => showHistory(false));
  moreButton.addEventListener("click", () => showMore(moreList.hidden === true));

  olderButton.addEventListener("click", async () => {
    showingAll = true;
    await drawList();
    olderButton.hidden = true;
    popover.querySelector("guide-versions")?.scrollIntoView?.({ block: "nearest" });
  });

  /*
   * Ett klick utanför stänger det som är öppet. `composedPath` och inte
   * `contains`: både popovern och menyn ligger i ljus DOM inuti en slot, och
   * det som klickades kan ligga i ett skuggträd.
   */
  document.addEventListener("pointerdown", (event) => {
    const path = event.composedPath();

    if (!popover.hidden && !path.includes(popover) && !path.includes(historyButton)) {
      showHistory(false);
    }

    if (!moreList.hidden && !path.includes(moreList) && !path.includes(moreButton)) {
      showMore(false);
    }
  });

  window.addEventListener("resize", () => placeHistory());

  /*
   * Escape closes it from anywhere on the page, not only from inside the panel:
   * the canvas takes focus back the moment somebody clicks a node, and a way
   * out that only works while you have not touched anything is not a way out.
   */
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!moreList.hidden) {
      event.stopPropagation();
      showMore(false);
      moreButton.focus();
      return;
    }

    if (!popover.hidden) {
      event.stopPropagation();
      showHistory(false);
    }
  });

  previewButton.addEventListener("click", () => {
    showMore(false);
    previewDialog.open(editor.getData(), undefined, editor.getAttribute("active-locale") ?? undefined);
  });

  /*
   * Anteckningen till kollegor (berättelse 130).
   *
   * Samma dörr för att skriva, ändra och ta bort: fältet står förifyllt med
   * det som finns, och en tömd text tar bort den. Två menyval för *skriv* och
   * *ta bort* hade varit två dörrar till samma rum — och den som vill ta bort
   * sin egen lapp hittar den under samma val som skrev den.
   *
   * `prompt-dialog` och inte en egen ruta: det är samma slags fråga som
   * *Vad ändrades?* i granskningen, och verktyget har redan en ruta för den.
   */
  noteButton.addEventListener("click", async () => {
    showMore(false);

    const held = note;
    const written = await promptDialog.ask({
      title: WORDS.noteTitle,
      label: WORDS.noteAsk,
      message: WORDS.noteHint,
      value: held?.text ?? "",
      placeholder: WORDS.notePlaceholder,
      confirmLabel: WORDS.noteSave,
      cancelLabel: WORDS.cancel,
    });

    if (written === null) {
      return;
    }

    const answer = await noteClient.write(written);

    if (answer.kind === "refused") {
      failure = WORDS.noteRefused;
      drawState();
      return;
    }

    if (answer.kind === "none") {
      failure = WORDS.noteFailed;
      drawState();
      return;
    }

    failure = "";
    note = answer.note;
    drawState();
  });

  /*
   * Och bort med den.
   *
   * Med en fråga före, och anteckningen citerad i den — samma citat som
   * Ta över-rutan bär, och av samma skäl: det kan vara någon annans
   * invändning, och den ska stå på skärmen medan man bestämmer sig.
   */
  noteRemoveButton.addEventListener("click", async () => {
    showMore(false);

    const held = note;

    if (held === null) {
      return;
    }

    const sure = await dialog.confirm({
      title: WORDS.noteRemoveTitle,
      quote: { title: WORDS.noteQuote(held.name, clock(held.at)), text: held.text },
      message: WORDS.noteRemoveMessage,
      confirmLabel: WORDS.noteRemoveConfirm,
      cancelLabel: WORDS.cancel,
      /*
       * Red because nothing brings it back (B3b, Astra 30/9, bilaga 6):
       * the note is not in the graph, so Ctrl+Z never held it, and an empty
       * `PUT …/note` deletes it at the host. Measured in `smoke:login`.
       */
      tone: "danger",
    });

    if (!sure) {
      return;
    }

    const answer = await noteClient.write("");

    if (answer.kind === "refused") {
      failure = WORDS.noteRefused;
      drawState();
      return;
    }

    if (answer.kind === "none") {
      failure = WORDS.noteFailed;
      drawState();
      return;
    }

    failure = "";
    note = null;
    drawState();
  });

  discardButton.addEventListener("click", async () => {
    const sure = await dialog.confirm({
      title: "Kasta ändringarna?",
      message: `Det du ändrat sedan version ${numberOf(currentId)} försvinner. Det går inte att ångra.`,
      confirmLabel: "Kasta",
      cancelLabel: "Behåll",
      // Everything since the last version goes (B3, Astra 30/9).
      tone: "danger",
    });

    if (!sure) return;

    await store.discardDraft(guideId);

    // Bekräftelsen om en återställd version hör till den återställningen, och
    // den är just kastad.
    notice = "";

    const published = currentId === "" ? null : await store.openVersion(guideId, currentId);

    if (published) edit(published);

    failure = "";
    savedAt = "";
    savedByOther = "";
    drawState();
  });

  list.addEventListener("version-open-intent", async (event) => {
    const version = (event as CustomEvent<{ version: GuideVersion }>).detail.version;
    const graph = await store.openVersion(guideId, version.id);

    if (!graph) {
      failure = "Den versionen gick inte att hämta.";
      drawState();
      return;
    }

    /*
     * Popovern stängs när man öppnar en version: det man tittar på ligger bakom
     * den, och en lista över det man just valde att titta på är i vägen.
     */
    showHistory(false);
    view(version.id, graph);
    await drawList();
    drawState();
  });

  /**
   * *Återställ* — carrying on from an old version, and it asks only when there
   * is something to lose.
   *
   * A confirmation over nothing is how people learn to click through the one
   * that matters, so the question appears exactly when unpublished changes
   * exist.
   *
   * One function behind two controls, on purpose: the row in the history and
   * the bar while you are looking at a version are two doors into the same act,
   * and the moment they were two functions one of them would grow a rule the
   * other one lacks.
   */
  const restore = async (versionId: string): Promise<void> => {
    const graph = await store.openVersion(guideId, versionId);

    if (!graph) {
      failure = "Den versionen gick inte att hämta.";
      drawState();
      return;
    }

    const draft = await store.load(guideId);
    const hasChanges =
      draft.status === "success" && draft.draft && changesFrom(draft.graph).length > 0;
    const number = numberOf(versionId);
    const published = currentId === "" ? 0 : numberOf(currentId);

    /*
     * Frågan säger konsekvensen, inte *Är du säker?* (kriterium 22). Och den
     * ställs bara när det finns något att förlora: en bekräftelse över
     * ingenting är hur folk lär sig klicka igenom den som betyder något.
     */
    if (hasChanges) {
      const sure = await dialog.confirm({
        title: WORDS.restoreTitle(number),
        message: WORDS.restoreMessage(number, published),
        confirmLabel: WORDS.restore(number),
        cancelLabel: WORDS.cancel,
        /*
         * Red by consequence, not by verb (Astra 30/9): asked only when there
         * are changes, and the restored version overwrites them in the
         * working copy.
         */
        tone: "danger",
      });

      if (!sure) return;
    }

    /*
     * Och återställningen går samma väg som autosparen: den skriver en
     * arbetskopia, och har någon annan hunnit skriva sin är det deras text som
     * skulle försvinna. Ingenting skrivs då, och raden säger vem.
     */
    const written = await store.saveDraft(guideId, graph);

    if (!written.success && written.conflict) {
      await handleConflict(written.conflict);
      return;
    }

    edit(graph);
    savedAt = new Date().toISOString();
    savedByOther = "";
    await drawList();
    /*
     * Meningen sätts EFTER `edit()`, för tilldelningen av grafen skickar
     * `graph-changed` och den vägen nollställer beskedet. Ordningen är
     * skillnaden mellan en bekräftelse som syns och en som aldrig ritas.
     */
    notice = WORDS.statusRestored(number, published);
    drawState();
  };

  list.addEventListener("version-restore-intent", async (event) => {
    const version = (event as CustomEvent<{ version: GuideVersion }>).detail.version;

    /*
     * The panel closes on the way. Restoring is what somebody opened the
     * history for, and the result of it is on the canvas behind — leaving the
     * list over it would hide the only evidence that anything happened.
     */
    showHistory(false);
    await restore(version.id);
  });

  /* Menyn stängs när man valt något ur den. */
  discardButton.addEventListener("click", () => showMore(false));

  adoptButton.addEventListener("click", async () => {
    if (viewing === null) return;

    await restore(viewing);
  });

  backButton.addEventListener("click", async () => {
    const loaded = await store.load(guideId);

    if (loaded.status === "success") {
      edit(loaded.graph);
      /* Det här är vad båda utgick från, tills någon skriver igen. */
      noteBase(loaded.graph);
      savedAt = loaded.draft ? loaded.savedAt : "";
      savedByOther = loaded.draft && loaded.savedBy && !loaded.savedBy.me ? loaded.savedBy.name : "";
    }

    await drawList();
    drawState();
  });

  /*
   * Identiteten först, guiden sedan (berättelse 128).
   *
   * De två låg bredvid varandra till 128, och det var rätt så länge svaret
   * bara var ett namn i en remsa: namnet läser man en gång, och canvasen är
   * det man kom för. Rollen är något annat — den avgör vad som ritas — så en
   * canvas som ritas före den är en canvas som måste ritas om, och den som
   * hann se paletten har sett den.
   */
  void (async () => {
    await sayWhoIsSignedIn();

    /*
     * Och låset före guiden, av samma skäl som rollen kommer före båda: det
     * avgör vad som ritas. En canvas som ritas i redigeringsläge och sedan
     * byter till läsläge är en canvas någon hunnit börja arbeta i.
     */
    await takeLock();

    // Sätts här och inte bara i `edit()`, så att en guide som inte går att
    // hämta ändå lämnar editorn i rätt läge i stället för i markupens.
    editor.mode = lockedBy ? "readonly" : allowedMode;

    await open();
  })();

  /*
   * Och låset släpps på väg ut — se `releaseLock`.
   *
   * `pagehide` och inte `beforeunload`, av samma skäl som autosparens sista
   * skrivning: `beforeunload` går inte att lita på i en telefon, där fliken
   * stängs av systemet och inte av en människa.
   */
  globalThis.addEventListener("pagehide", releaseLock);
  backLink.addEventListener("click", releaseLock);
}

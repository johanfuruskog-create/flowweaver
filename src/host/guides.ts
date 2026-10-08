import "./styles/demo-tokens.scss";
import "../viewer/styles/tokens.scss";
import "./styles/demo-back.scss";
import "./guides.scss";

import { guideWords } from "./guides-words";
import { hostLogin, roleAllows } from "./host-login";
import { LOCK_ICON } from "./lock-icon";
import { initTheme } from "./theme-persistence";
import { hostConfig } from "./host-config";

import type { HostGuide, HostRole } from "./host-login";

/**
 * *Mina guider* — where an editor starts (story 126, criterion 4).
 *
 * ## What this page replaced, and why it had to
 *
 * `dev/guide-storage.html?guide=…&key=…` was the only way in. The secret rode
 * in the address, which put it in history, in bookmarks and in every screenshot
 * — Johan's own trial guide on 17/9 had to be deleted because its secret went
 * through a conversation. It could not be rotated, could not be shared with a
 * colleague, and could not be looked up: you either had the link or you had
 * nothing.
 *
 * So the way in is a login now. The host says who you are, this page asks it
 * for *your* guides, and the editor opens without a secret anywhere.
 *
 * ## The four states, and none of them is an error page
 *
 * A page that only knows "worked" and "broken" tells somebody to report a bug
 * when the truth is that they are logged out. So there are four, and each says
 * what to do next:
 *
 *  1. **No host at all** — the site is built without an API address. Nothing to
 *     list, and saying so beats an empty list that looks like an empty account.
 *  2. **The host has no login** — a reference host running without a provider,
 *     which is a documented way to run it. Then the guide's own address and
 *     secret is still how you get in, and the page says that rather than
 *     pretending the button would help.
 *  3. **Logged out** — one button, and nothing else on the page. Not an empty
 *     list, not a disabled *Ny guide*: a control that cannot do anything is a
 *     question about why.
 *  4. **Logged in** — the name, the way out, the list, the search and *Ny
 *     guide*.
 *
 * ## The search is an ordinary search box, and was not
 *
 * `<chip-picker>` stood here until 18/9 — the same control a visitor picks
 * countries in, reused so that the page would not grow a second search that
 * behaves almost the same. The reuse was right in principle and wrong in fact,
 * and the measurement is worth keeping because the failure is invisible from
 * the code: the picker draws its **search box only above eight options**, so on
 * a host with three guides there was nothing to type in at all. What stood
 * there was the picker's own summary — a 626x56 box saying *Alla guider visas*,
 * which reads as a search field in every way except that it is one. Clicking it
 * took no focus; typing *bygg* left the field empty and the list unchanged.
 *
 * Johan: *"Sök på titel funkar inte — den borde vara en vanlig sökning så
 * ändras listan nedanför."*
 *
 * So it is an `<input type="search">` that filters as you type: case-blind
 * substring against the title, combined with *Bara mina* rather than replacing
 * it, with a count that says how much of the whole you are looking at. The
 * picker stays in the library, where a visitor choosing from forty
 * municipalities is exactly what it is for.
 */

initTheme();

const locale = hostConfig.locale;
const say = guideWords(locale);

/**
 * Where the host answers — the same single line as everywhere else.
 *
 * `interest-form.json` carries the API's base and, read by `vite.config.ts`,
 * decides which pages may call it at all. One line for the address and the
 * permission, because two would one day be a page allowed to call somewhere it
 * cannot reach, or able to reach somewhere it is not allowed to call.
 */
const API = (new URLSearchParams(location.search).get("api") ?? hostConfig.api ?? "").trim();

/** Where the editor lives, from wherever this page is — the page says (host-config.ts). */
const EDITOR = hostConfig.editorHref;

/**
 * What a row's link looks like: the guide, and the host if this page was told
 * one.
 *
 * `?api=` travels on to the editor when it was given, because otherwise opening
 * a guide from a page pointed at a local receiver would land in the editor
 * pointed at the built-in address. Harmless in a build — the page's
 * `connect-src` allows exactly one origin whatever an address says — and the
 * difference between being able to try this against your own receiver and not
 * (`smoke:login` is that run).
 */
const openAddress = (id: string): string => {
  const given = new URLSearchParams(location.search).get("api");

  return `${EDITOR}?guide=${encodeURIComponent(id)}${given ? `&api=${encodeURIComponent(given)}` : ""}`;
};

const notice = document.getElementById("notice") as HTMLElement;
const signedOut = document.getElementById("signed-out") as HTMLElement;
const signedIn = document.getElementById("signed-in") as HTMLElement;
const loginLink = document.getElementById("login") as HTMLAnchorElement;
const who = document.getElementById("who") as HTMLElement;
const logoutButton = document.getElementById("logout") as HTMLButtonElement;
const newButton = document.getElementById("new") as HTMLButtonElement;
const createNote = document.getElementById("create-note") as HTMLElement;
const searchBoxInput = document.getElementById("search") as HTMLInputElement;
const countLine = document.getElementById("count") as HTMLElement;
const searchBox = document.getElementById("search-box") as HTMLElement;
const searchLabel = document.getElementById("search-label") as HTMLElement;
const filterBox = document.getElementById("filter") as HTMLElement;
const onlyMineInput = document.getElementById("only-mine") as HTMLInputElement;
const onlyMineLabel = document.getElementById("only-mine-label") as HTMLElement;
const onlyMineHint = document.getElementById("only-mine-hint") as HTMLElement;
const list = document.getElementById("list") as HTMLElement;
const nothing = document.getElementById("nothing") as HTMLElement;

document.getElementById("title")!.textContent = say("title");
document.getElementById("intro")!.textContent = say("intro");
document.getElementById("signed-out-text")!.textContent = say("signedOut");
loginLink.textContent = say("login");
logoutButton.textContent = say("logout");
newButton.textContent = say("newGuide");
searchLabel.textContent = say("searchLabel");
onlyMineLabel.textContent = say("onlyMine");
onlyMineHint.textContent = say("onlyMineHint");

/**
 * Rollens ord, i det språk sidan står i (berättelse 128).
 *
 * En uppslagning och ingen översättning på plats: värdens ord är engelska och
 * bor i `.env`, sidans ord bor i ordlistan, och den här raden är den enda
 * bryggan mellan dem. Skrevs de på två ställen skulle *förvaltare* och
 * *administratör* en dag stå på var sin sida av samma inloggning.
 */
const roleWord = (role: HostRole): string =>
  say(
    role === "admin"
      ? "roleAdmin"
      : role === "publisher"
        ? "rolePublisher"
        : role === "editor"
          ? "roleEditor"
          : "roleReader",
  );

/** One guide, as `GET /guides` describes it. */
type GuideRow = HostGuide;

/** Everything the host listed, and what is typed in the search. */
let guides: GuideRow[] = [];
/**
 * Det som står i sökrutan, gement.
 *
 * Gement här och inte vid varje jämförelse: annars görs samma sänkning en gång
 * per guide och per tangenttryck, och — värre — på två ställen som en dag
 * sänker olika.
 */
let term = "";
/**
 * *Bara mina*, off by default (story 127).
 *
 * The list is the organisation's, so the unfiltered answer is the true one and
 * the filter is the narrowing. On by default would have been the old page
 * wearing a checkbox — and an editor looking for the guide a colleague just
 * changed would find an empty screen and no clue why.
 *
 * `mine` is the host's word and not a comparison made here: this page never
 * learns its own subject (`host-login.ts`).
 */
let onlyMine = false;

const host = hostLogin(API);

/** A name that can be read, pressed and searched for. */
const nameOf = (guide: GuideRow): string => (guide.name.trim() === "" ? say("untitled") : guide.name);

/**
 * When it last changed, in the reader's own zone.
 *
 * The host stamps it in UTC, and drawing that would be the same fault the
 * version list had on 17/9: a row saying 13:05 beside a clock reading 15:05.
 *
 * `medium` + `short` — *17 sep. 2026 22:50* — and never the ISO string, which
 * is what Swedish's own short date form is (`2026-09-17`) and which reads as a
 * machine string beside a person's name. It is the same pair the history's
 * meta line uses (`guide-versions.whenText`), so one act cannot be dated two
 * ways on two screens.
 *
 * The clock joined the date in story 127: the row now says *who*, and *Ändrad
 * 17 sep. av Nisse Hult* on a day two people have both touched the guide
 * answers half the question it asks.
 */
const whenOf = (iso: string): string => {
  const at = new Date(iso);

  return Number.isNaN(at.getTime())
    ? ""
    : new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(at);
};

/** The rows the filter leaves standing — everything, or only the asker's. */
const visible = (): GuideRow[] => (onlyMine ? guides.filter((one) => one.mine === true) : guides);

/**
 * Träffar sökningen den här guiden?
 *
 * Delsträng och inte början: den som letar efter *Bygglov för altan* skriver
 * lika gärna *altan*. Skiftlägesokänsligt, för en titel skrivs med stor
 * bokstav och en sökning sällan.
 *
 * Titeln och ingenting annat — inte datumet, inte namnet i raden under. Ett
 * fält som heter *Sök på titel* och ändå träffar på ett efternamn är ett fält
 * som ger svar man inte kan förklara.
 */
const matches = (guide: GuideRow): boolean =>
  term === "" || nameOf(guide).toLowerCase().includes(term);

/** Says one of the three sentences about an empty screen, or nothing at all. */
function drawList(): void {
  const within = visible();
  const shown = within.filter(matches);

  list.replaceChildren(
    ...shown.map((guide) => {
      const row = document.createElement("li");
      const link = document.createElement("a");
      const name = nameOf(guide);

      row.className = "guides__row";
      link.className = "guides__link";
      link.href = openAddress(guide.id);
      link.textContent = name;
      /*
       * The visible words are part of the spoken name (WCAG 2.5.3): the link
       * says the title, so the accessible name has to contain the title — a
       * link announced as something else is a link a voice user cannot ask for.
       */
      link.setAttribute("aria-label", say("openGuide", { name }));

      const meta = document.createElement("p");

      meta.className = "guides__meta";

      /*
       * *Ändrad 17 sep. 2026 22:50 av Nisse Hult* — and only *Ändrad <datum>*
       * when the host has nobody to name (story 127, the migration).
       *
       * A guide written before the host had a login carries no `updatedBy`,
       * and the row then says one thing less rather than *av* followed by
       * nothing.
       */
      const when = whenOf(guide.updatedAt);
      const by = guide.updatedBy?.name ?? "";
      const changed =
        when === "" ? "" : by === "" ? say("changed", { when }) : say("changedBy", { when, name: by });

      /*
       * Two facts on one line, and they answer different questions: *is this
       * out there?* and *who touched it last?* The published state is the one
       * an editor asks first, so it comes first.
       */
      meta.textContent = [guide.current === "" ? say("unpublished") : say("published"), changed]
        .filter((part) => part !== "")
        .join(" · ");

      row.append(link, meta);

      /*
       * Och vem som arbetar i den just nu (berättelse 129).
       *
       * En egen rad under den andra, inte ett fjärde stycke på samma: raden
       * ovanför svarar på *är den ute, och vem rörde den sist* — det här är en
       * annan sorts uppgift, och den gäller bara just nu.
       *
       * **Bara när det är någon annan.** Sitt eget lås är samma regel som
       * *sparad av dig*: en rad som säger ens eget namn varje gång är en rad
       * man slutar läsa, och då står den där även den dagen den bär ett annat.
       *
       * Hänglåset är samma teckning som editorns bricka (`lock-icon.ts`), och
       * ordet står kvar bredvid den — K3 gäller ikoner precis som färger.
       */
      const held = guide.lock;

      if (held && held.me !== true) {
        const locked = document.createElement("p");

        locked.className = "guides__lock";
        locked.innerHTML = LOCK_ICON;
        locked.append(say("lockedBy", { name: held.name }));
        row.append(locked);
      }

      /*
       * Och arbetsanteckningen, dämpad under titeln (berättelse 130).
       *
       * Johan: *"Om inte Anna hade tänkt klart och inte vill att det skulle
       * publiceras?"* Den som står i listan och letar efter något att
       * publicera ska se invändningen **här**, innan hen öppnar guiden — det
       * är hela skillnaden mot att upptäcka den i granskningsrutan.
       *
       * **För alla, också den som skrev den.** Till skillnad från låset, som
       * bara visas för andra: låset svarar på *kan jag börja här nu*, och det
       * egna svaret är alltid ja. Anteckningen är en påminnelse, och den som
       * skrev *Inte klar* behöver den lika mycket som alla andra.
       *
       * Texten sätts med `textContent` genom `say()`: orden är någons egna,
       * och en sträng som blir markup är en väg in (K11).
       */
      const left = guide.draftNote;

      if (left?.text) {
        const kept = document.createElement("p");

        kept.className = "guides__note";
        kept.textContent = say("noteBy", {
          name: String(left.by?.name ?? ""),
          text: left.text,
        });
        row.append(kept);
      }

      return row;
    }),
  );

  const empty = shown.length === 0;

  /*
   * Fyra tomma skärmar och inte tre, sedan filtret finns: *inga guider alls*,
   * *inga egna* och *ingen som heter så* är tre olika saker att göra något åt.
   * Den som ser *Det finns inga guider än* över tjugo guider bakom en kryssruta
   * skapar en till.
   */
  nothing.hidden = !empty;
  nothing.replaceChildren();

  if (empty) {
    nothing.textContent =
      within.length === 0
        ? guides.length === 0
          ? say("none")
          : say("noneMine")
        : say("noMatches");

    /*
     * Och vägen ut ur just den här tomma skärmen: en knapp i beskedet, och
     * bara när det var sökningen som tömde den.
     *
     * Här och inte bredvid fältet. Det är här man står när man behöver den,
     * och en rensningsknapp som alltid syns är en knapp man vänjer sig vid att
     * inte trycka på. Escape i fältet gör samma sak, och `type="search"` ger
     * webbläsarens egen kryssknapp där den har en.
     */
    if (within.length > 0) {
      const clear = document.createElement("button");

      clear.type = "button";
      clear.className = "guides__clear";
      clear.textContent = say("clearSearch");
      clear.addEventListener("click", () => {
        searchBoxInput.value = "";
        term = "";
        searchBoxInput.focus();
        drawList();
      });

      nothing.append(" ", clear);
    }
  }

  /*
   * Hur många man ser, och av hur många.
   *
   * *2 av 5 guider* så fort något smalnar av listan — sökningen, kryssrutan
   * eller båda — och *5 guider* annars. Nämnaren är allt värden listade och
   * inte det kryssrutan lämnade: den som sökt inne i *Bara mina* har ändå
   * frågan *av allt som finns, hur mycket ser jag nu?*
   */
  const narrowed = term !== "" || onlyMine;

  countLine.textContent =
    guides.length === 0
      ? ""
      : narrowed
        ? say("countFiltered", { n: shown.length, m: guides.length })
        : guides.length === 1
          ? say("countOne")
          : say("count", { n: guides.length });
  /*
   * The search goes away when there is nothing to narrow — label and all.
   *
   * The **wrapper** is hidden and not the control, and the label separately
   * from the wrapper: the label is a **sibling**, because it has to span both
   * grid columns so the button can line up with the field, and a grid item
   * cannot be a child of the thing beside it. Two lines instead of one, and
   * the alternative — a wrapper around both — would have put the button back
   * out of line.
   *
   * `within` and not `shown`: en sökning som inte träffar något får inte ta
   * bort fältet man just skrev i.
   */
  const nothingToSearch = within.length === 0;

  searchBox.hidden = nothingToSearch;
  searchLabel.hidden = nothingToSearch;
  /*
   * Kryssrutan följer listan och inte filtret: den försvinner när värden inte
   * har en enda guide, och står kvar när filtret tömt skärmen — annars vore
   * den enda vägen tillbaka borta i samma ögonblick som man behöver den.
   */
  filterBox.hidden = guides.length === 0;
}

async function loadGuides(): Promise<void> {
  const answer = await host.listGuides();

  if (!answer.ok) {
    notice.hidden = false;
    notice.textContent = say("unreachable");
    return;
  }

  notice.hidden = true;
  guides = answer.guides;
  drawList();
}

/*
 * Listan ritas om vid varje tangenttryck.
 *
 * Ingen fördröjning, och det är mätt snarare än valt: det som filtreras är en
 * lista som redan ligger i minnet, och en värd med tjugo guider är tjugo
 * jämförelser av en delsträng. En fördröjning hade bara gjort skrivandet
 * ryckigt och lagt till ett tillstånd som kan hinna bli fel.
 */
searchBoxInput.addEventListener("input", () => {
  term = searchBoxInput.value.trim().toLowerCase();
  drawList();
});

/*
 * Escape tömmer fältet (K-kraven).
 *
 * Skrivet här och inte överlämnat åt webbläsaren: `type="search"` rensar på
 * Escape i Chromium men inte i alla webbläsare.
 *
 * Mätt, och värt att veta för den som tror att raden är död kod: i Chromium
 * gör webbläsarens egen rensning redan hela jobbet — den skickar ett
 * `input`-event, så `term` följer med. `smoke:login` är därför grön även utan
 * den här hanteraren, och det står i provet i stället för att tigas ihjäl.
 * Raden är vad kravet vilar på i en webbläsare utan den vanan.
 */
searchBoxInput.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || searchBoxInput.value === "") {
    return;
  }

  event.preventDefault();
  searchBoxInput.value = "";
  term = "";
  drawList();
});

/*
 * *Bara mina* smalnar listan, och sökningen står kvar.
 *
 * Kombineras och ersätter inte: den som skrivit *bygg* och sedan kryssar i
 * *Bara mina* frågar om sina egna bygglovsguider, inte om något annat. Räknaren
 * säger hur mycket av allt som blev kvar, så skärmen kan inte bli tom utan att
 * säga varför.
 */
onlyMineInput.addEventListener("change", () => {
  onlyMine = onlyMineInput.checked;
  drawList();
});

logoutButton.addEventListener("click", async () => {
  await host.logout();
  // A reload rather than redrawing: logging out changes every state on the
  // page, and the state after it is exactly the state a fresh visit produces.
  location.reload();
});

newButton.addEventListener("click", async () => {
  newButton.disabled = true;

  const made = await host.createGuide();

  newButton.disabled = false;

  if (!made.ok) {
    notice.hidden = false;
    notice.textContent = say("couldNotCreate");
    return;
  }

  /*
   * Straight into the editor. Creating a guide and then being handed a list
   * with a new blank row in it is a step that exists only because the page was
   * easier to write that way — *Ny guide* means "I am about to build one".
   */
  location.href = openAddress(made.id);
});

/** The page decides what to show once, from what the host answered. */
async function start(): Promise<void> {
  const state = await host.state();

  if (state.kind === "no-host" || state.kind === "no-login") {
    notice.hidden = false;
    notice.textContent = say(state.kind === "no-host" ? "noHost" : "noLogin");
    return;
  }

  if (state.kind === "signed-out") {
    signedOut.hidden = false;
    loginLink.href = host.loginAddress(location.href);
    return;
  }

  signedIn.hidden = false;
  who.textContent = say("signedInAsRole", {
    name: state.name || state.email,
    role: roleWord(state.role),
  });

  /*
   * *Ny guide* är förvaltarens (berättelse 128, kriterium 3).
   *
   * Gömd och inte avstängd: en knapp som inte går att trycka är en fråga om
   * varför, och svaret får plats i en rad bredvid — som står där bara när
   * knappen inte gör det. Att den saknas sägs alltså i ord, aldrig bara genom
   * att den är borta (kriterium 6).
   *
   * Sidan är vyn och värden är skyddet: `POST /guides` svarar `401` för alla
   * utom förvaltaren oavsett vad som ritas här.
   */
  const mayCreate = roleAllows(state.role, "admin");

  newButton.hidden = !mayCreate;
  createNote.hidden = mayCreate;
  createNote.textContent = mayCreate ? "" : say("onlyAdminCanCreate");

  await loadGuides();
}

void start();

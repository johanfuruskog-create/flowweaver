/**
 * Sends faults to the dev server so they can be read off a device with no
 * console — the client half of the `remote-log` plugin in `vite.config.ts`.
 *
 * ## Why
 *
 * Johan debugs on an iPad without a Mac, so Safari's Web Inspector is out of
 * reach. A handler that throws on a tablet is invisible from here: the button
 * takes focus, nothing happens, and the two explanations that produce exactly
 * that — no click at all, or a click into a listener that dies on its first
 * line — cannot be told apart by looking.
 *
 * ## It must never be the reason something breaks
 *
 * A logger that can throw has made the fault it was installed to find harder to
 * see, and a logger that logs its own failures never stops. So:
 *
 * - every handler body is wrapped, and a throw inside one is swallowed;
 * - the send uses the **original** `fetch`, captured before the wrapper is
 *   installed, and requests to `/__log` are never themselves reported;
 * - failures to send resolve quietly — there is nowhere left to complain to;
 * - identical faults in quick succession are collapsed, because an error thrown
 *   from an animation frame arrives sixty times a second and would bury the one
 *   line worth reading.
 *
 * Loaded only when `import.meta.env.DEV`, so none of this reaches a build.
 */

/**
 * Turned on and off from a panel on the page, not from the address.
 *
 * The address was three redesigns of the same problem. A flag lasted one page,
 * so it was remembered; remembering per tab died when iOS discarded the tab, so
 * it was made to persist; persisting needed a visible way to stop, so it got a
 * badge. At that point the badge was doing the work and the flag was a second
 * way in — and Johan said the obvious thing: keep the panel, drop the flags.
 *
 * So there is one control. It is on every page of a debug build and of the dev
 * server, it says whether logging is running, and it takes a name for the run.
 *
 * ## Why a name
 *
 * Because `#a3f9c2` says nothing three hours later. "ipad-knapp" says what was
 * being investigated, and `npm run logg ipad-knapp` finds it without anybody
 * reading a mark off a screen and typing it back in.
 */
const KEY = "flowweaver:debug";
const MARK = "flowweaver:debug-session";

const remembered = (name) => {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
};

const remember = (name, value) => {
  try {
    if (value === null) {
      localStorage.removeItem(name);
    } else {
      localStorage.setItem(name, value);
    }
  } catch {
    /* Then it lasts one page. Better than not starting at all. */
  }
};

/*
 * `localStorage` and not the tab: iOS discards background tabs under memory
 * pressure, and a logger that vanishes mid-investigation for a reason nobody can
 * see is the fault this has already been redesigned around twice. The price is
 * that it can be running without anybody remembering — which the panel pays,
 * because it is on screen the whole time saying so.
 */
let enabled = remembered(KEY) === "på";

/**
 * The mark every line of this run carries.
 *
 * A name if one was given, because my test browser and Johan's iPad write to the
 * same file minutes apart and "ipad-knapp" tells them apart at a glance where a
 * random six characters does not. Trimmed to something that survives being one
 * field of a single-line log entry.
 */
const clean = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9åäö-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

let SESSION = remembered(MARK) || "";

const ENDPOINT = "/__log";


/* Captured before the wrapper below replaces the global, so a report never
   travels through the code that reports. */
const send = window.fetch.bind(window);

let last = "";
let lastAt = 0;

/** Collapses a fault repeating faster than anyone could read it. */
function isRepeat(message) {
  const now = Date.now();

  if (message === last && now - lastAt < 2000) {
    return true;
  }

  last = message;
  lastAt = now;

  return false;
}

function report(entry) {
  try {
    if (!enabled || isRepeat(entry.message)) {
      return;
    }

    void send(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...entry,
        session: SESSION,
        url: location.pathname + location.search,
      }),
      keepalive: true,
    }).catch(() => {
      /* The dev server is gone, or the tablet dropped off the wifi. Nothing to
         be done about it from in here, and nothing worth saying. */
    });
  } catch {
    /* Serialising a report must not become the fault. */
  }
}

/*
 * `addEventListener` rather than assigning `window.onerror`, so an error handler
 * the page already installed keeps working. Same event, one owner fewer.
 */
window.addEventListener("error", (event) => {
  try {
    report({
      kind: "error",
      message: event.message || String(event.error || "okänt fel"),
      source: event.filename || "",
      line: event.lineno,
      column: event.colno,
      stack: event.error && event.error.stack ? event.error.stack : "",
    });
  } catch {
    /* ignored */
  }
});

window.addEventListener("unhandledrejection", (event) => {
  try {
    const reason = event.reason;

    report({
      kind: "rejection",
      message: reason && reason.message ? reason.message : String(reason),
      stack: reason && reason.stack ? reason.stack : "",
    });
  } catch {
    /* ignored */
  }
});

/*
 * The wrappers go on once, the first time logging starts, and stay. Turning off
 * leaves them as pass-throughs rather than unwinding them: they sit around
 * `fetch` and `console` in whatever order they were applied, and taking them off
 * by hand would restore whichever one happened to be underneath. `report` checks
 * the switch, so an inactive wrapper costs one boolean.
 */
let installed = false;

function start(name) {
  SESSION = clean(name) || Math.random().toString(36).slice(2, 8);
  enabled = true;
  remember(KEY, "på");
  remember(MARK, SESSION);

  if (!installed) {
    installed = true;
    installWrappers();
  }

  /*
   * Announced, because anything that instruments the page has to be told *now*
   * rather than at load: logging is switched on from a dialog, minutes after the
   * page arrived, and a listener that read the flag once at startup saw "off"
   * and stayed asleep. Which is exactly what happened on the first run — the
   * session opened, seventeen seconds passed, and nothing was watching.
   */
  try {
    window.dispatchEvent(new CustomEvent("flowweaver:debug-started"));
  } catch {
    /* Older engines. The page still logs; it just instruments nothing. */
  }

  report({
    kind: "session",
    message: `start — ${screen.width}x${screen.height} @${window.devicePixelRatio}x, ${viewportLine()}, ${navigator.userAgent.slice(0, 90)}`,
  });
}

/*
 * Layoutvyn OCH den synliga vyn, i samma rad. "vy" ensamt visade sig vara
 * en fälla: skärmen anges alltid i porträtt på iPad, och utan den synliga
 * vyn bredvid gick raden att feltolka åt precis fel håll (dagboken
 * 2026-08-24). Skala och offset är med för att en kvarhängande zoom eller
 * ett tangentbordsrester ska synas som siffror, inte som en teori.
 */
function viewportLine() {
  const vv = window.visualViewport;
  const visible = vv
    ? `, synlig ${Math.round(vv.width)}x${Math.round(vv.height)} skala ${vv.scale.toFixed(2)} offset ${Math.round(vv.offsetLeft)},${Math.round(vv.offsetTop)}`
    : "";

  return `layout ${window.innerWidth}x${window.innerHeight}${visible}`;
}

/*
 * Johans teori 2026-08-24: "den fastnar när iPaden går i viloläge". Det är
 * mätbart — väckning är `pageshow` (persisted = återväckt ur bfcache) och
 * `visibilitychange`. En rad per väckning med måtten gör teorin till en
 * jämförelse: samma siffror före och efter vilan, eller inte.
 */
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    report({ kind: "session", message: `väckt ur bfcache — ${viewportLine()}` });
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    report({ kind: "session", message: `synlig igen — ${viewportLine()}` });
  }
});

function stop() {
  report({ kind: "session", message: "slut" });
  enabled = false;
  remember(KEY, null);
}

/**
 * One button, and a dialog that asks before anything changes.
 *
 * The field and the button used to sit in the corner together, which meant the
 * corner was always a small form. Johan's version is better: a single button
 * that says what state things are in, and a question when it is pressed —
 * "börja felsöka?" with somewhere to put a name, "sluta felsöka?" on the way
 * back out.
 *
 * A real `<dialog>` with `showModal`, not a div pretending to be one. It brings
 * focus trapping, Escape, and a backdrop with it, and `docs/KRAV.md` asks for the
 * first two of those from anything that can be reached at all. This is a
 * developer tool rather than part of the product, but writing the accessible
 * version is not the expensive one when the platform already did the work.
 */
/** Only when the width actually changes — a stuck overflow must not fill the log. */
let reportedOverflowAt = 0;

function reportOverflow(reason) {
  const width = document.documentElement.scrollWidth;

  if (width <= window.innerWidth || width === reportedOverflowAt) {
    return;
  }

  reportedOverflowAt = width;

  const offenders = [];

  for (const el of document.querySelectorAll("body *")) {
    const rect = el.getBoundingClientRect();

    if (rect.width > 0 && (rect.right > window.innerWidth + 1 || rect.left < -1)) {
      offenders.push({ el, left: Math.round(rect.left), right: Math.round(rect.right) });
    }

    if (offenders.length > 40) {
      break;
    }
  }

  offenders.sort((a, b) => b.right - a.right);

  const named = offenders.slice(0, 3).map(({ el, left, right }) => {
    const cls =
      typeof el.className === "string" && el.className ? `.${el.className.split(" ")[0]}` : "";

    return `${el.tagName.toLowerCase()}${cls}${el.id ? `#${el.id}` : ""} [${left}..${right}]`;
  });

  report({
    kind: "layout",
    message:
      `överbredd (${reason}): sidan ${width}px, vyn ${window.innerWidth}px — ` +
      (named.join("; ") || "inget lätt namngivet element; boven kan bo i skugg-DOM"),
  });
}

window.addEventListener("resize", () => reportOverflow("vid storleksändring"));

/*
 * Skugginventering, på begäran: öppna logg-dialogen och tryck Avbryt. Varje
 * element med box-shadow — även inne i skugg-DOM — rapporteras med läge och
 * mått. Byggd för spökrutan under bildspelsguidens resultat: en "ruta till,
 * fast bara med box-shadow" som bara syns i Safari, där ingen annan mätning
 * når. Listan säger om skuggan har ett element bakom sig eller är kvarmålning.
 */
function reportShadows() {
  const found = [];

  const walk = (rootNode) => {
    for (const el of rootNode.querySelectorAll("*")) {
      try {
        const s = getComputedStyle(el);

        if (s.boxShadow && s.boxShadow !== "none") {
          const r = el.getBoundingClientRect();
          const cls =
            typeof el.className === "string" && el.className
              ? "." + el.className.split(" ")[0]
              : "";

          found.push(
            `${el.tagName.toLowerCase()}${cls} [x${Math.round(r.x)} y${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}]`,
          );
        }
      } catch {
        /* Ett element utan stil fäller inte inventeringen. */
      }

      if (el.shadowRoot) {
        walk(el.shadowRoot);
      }
    }
  };

  walk(document);

  report({
    kind: "layout",
    message: `skuggor (${found.length}): ${found.slice(0, 14).join("; ") || "inga"}`,
  });
}

function showControl() {
  const button = document.createElement("button");
  const dialog = document.createElement("dialog");
  const title = document.createElement("p");
  const field = document.createElement("input");
  const confirm = document.createElement("button");
  const cancel = document.createElement("button");
  const row = document.createElement("div");

  /* Named, so it is findable among the page's own dialogs — the first test of
     this reached for `dialog p` and got nine of them. */
  dialog.dataset.flowweaverDebug = "";
  button.dataset.flowweaverDebug = "";
  button.type = "button";
  confirm.type = "button";
  cancel.type = "button";
  cancel.textContent = "Avbryt";
  field.type = "text";
  field.placeholder = "t.ex. ipad-knapp";
  field.setAttribute("aria-label", "Namn på sessionen");

  dialog.style.cssText =
    "border:1px solid #666;border-radius:10px;background:#111;color:#eee;padding:16px;" +
    "font:14px/1.5 ui-monospace,monospace;max-width:min(90vw,320px)";
  title.style.cssText = "margin:0 0 12px";
  field.style.cssText =
    "font:inherit;padding:10px;width:100%;background:#000;color:#eee;border:1px solid #666;" +
    "border-radius:4px;min-height:44px;box-sizing:border-box";
  row.style.cssText = "display:flex;gap:8px;margin-top:12px";
  cancel.style.cssText =
    "font:inherit;flex:1;min-height:44px;border-radius:4px;cursor:pointer;background:#111;" +
    "color:#ccc;border:1px solid #666";
  confirm.style.cssText =
    "font:inherit;flex:1;min-height:44px;border-radius:4px;cursor:pointer;border:1px solid";

  /*
   * I sticky-raden när sidan har en, flytande annars (Johans fråga: "ska vi
   * ha debug-knappen längst upp med resten av knapparna?" — ja: i raden
   * lever den i samma layout som språk- och temaknapparna och behöver ingen
   * egen viewport-matte, vilket är precis det den flytande varianten har
   * bråkat om på plattan hela dagen).
   */
  let inHeader = false;

  /*
   * Skalbaggen är knappen (Johans ord: "vi kan kalla det debug bara").
   * Vald bär den ett rött kryss — buggen är på väg att förgöras — komponerat
   * som overlay, för någon kryssad skalbagge finns inte bland emojierna. På smal skärm är ikonen
   * ensam; texten är en lyx för breda skärmar. Byggt med DOM-noder, inte
   * innerHTML — sessionsnamnet är användartext.
   */
  const narrow = window.matchMedia("(max-width: 640px)");

  narrow.addEventListener?.("change", () => paintButton());

  const composeLabel = () => {
    const beetle = document.createElement("span");

    beetle.textContent = "🪲";
    beetle.style.cssText = "position:relative;display:inline-block;line-height:1";

    if (enabled) {
      const cross = document.createElement("span");

      cross.textContent = "✕";
      cross.setAttribute("aria-hidden", "true");
      cross.style.cssText =
        "position:absolute;inset:0;display:grid;place-items:center;" +
        "color:#d92d20;font-weight:900;font-size:1.15em;text-shadow:0 0 2px #fff";
      beetle.append(cross);
    }

    button.replaceChildren(beetle);

    if (!narrow.matches) {
      const text = document.createElement("span");

      text.textContent = enabled ? `debug ${SESSION}` : "debug";
      button.append(text);
    }

    button.setAttribute(
      "aria-label",
      enabled ? `debug – loggar ${SESSION}` : "debug – av",
    );
  };

  const paintButton = () => {
    composeLabel();

    if (inHeader) {
      /*
       * Samma kostym som språk- och temaknapparna (Johans önskan): pillret
       * ur theme-toggle, buggikonen som symbol. Aktiv loggning markeras med
       * rött i samma form — kostymen lånas, larmfärgen behålls.
       */
      button.style.cssText =
        "display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;min-width:44px;padding:8px 14px;" +
        "border-radius:999px;background:var(--fw-surface);cursor:pointer;" +
        "font-family:var(--fw-font);font-size:14px;font-weight:600;box-shadow:var(--fw-shadow-sm);" +
        (enabled
          ? "border:1px solid #d92d20;color:#d92d20"
          : "border:1px solid var(--fw-border);color:var(--fw-text-strong)");
      return;
    }

    button.style.cssText =
      "position:fixed;right:8px;bottom:8px;z-index:2147483647;" +
      "display:inline-flex;align-items:center;gap:6px;" +
      "font:12px/1.4 ui-monospace,monospace;" +
      "min-height:44px;min-width:44px;justify-content:center;padding:8px 12px;border-radius:8px;cursor:pointer;" +
      (enabled
        ? "background:#300;color:#f88;border:1px solid #f88"
        : "background:#111;color:#999;border:1px solid #666");
  };

  button.addEventListener("click", () => {
    if (enabled) {
      title.textContent = `Sluta felsöka? Sessionen ${SESSION} avslutas.`;
      field.style.display = "none";
      confirm.textContent = "Sluta";
      confirm.style.background = "#300";
      confirm.style.color = "#f88";
      confirm.style.borderColor = "#f88";
    } else {
      title.textContent = "Börja felsöka? Allt sidan säger skrivs ned här.";
      field.style.display = "";
      field.value = SESSION;
      confirm.textContent = "Börja";
      confirm.style.background = "#030";
      confirm.style.color = "#8f8";
      confirm.style.borderColor = "#8f8";
    }

    dialog.showModal();

    if (!enabled) {
      // So the tablet's keyboard is up and waiting, rather than one tap away.
      field.focus();
      field.select();
    }
  });

  confirm.addEventListener("click", () => {
    if (enabled) {
      stop();
    } else {
      start(field.value);
    }

    paintButton();
    dialog.close();
  });

  cancel.addEventListener("click", () => dialog.close());

  /*
   * Found on an iPad: cancelling this very dialog left the page with a
   * horizontal scrollbar, and nothing could say which element had grown past
   * the edge — WebKit does not run where the logs land. So the measurement
   * lives here: when the page is wider than its view after the dialog, the
   * widest offenders are named in the log. A moment later, because Safari
   * settles its scrollbars after the close, not during it.
   */
  dialog.addEventListener("close", () => {
    setTimeout(() => {
      reportOverflow("efter logg-dialogen");
      reportShadows();
    }, 300);
  });

  row.append(cancel, confirm);
  dialog.append(title, field, row);
  paintButton();

  /*
   * Fäst i den synliga ytan, inte i layout-vyn. På iPad flyter en
   * botten-höger-knapp upp mitt på skärmen när sidan är zoomad eller Safaris
   * krom ändrar storlek: iOS fäster `position: fixed` vid layout-vyn, och den
   * synliga ytan är då en annan. `VisualViewport` säger var den synliga ytans
   * hörn faktiskt är, och en translate flyttar dit knappen. Vid 1:1 är
   * förskjutningen noll och ingenting händer.
   */
  const followViewport = () => {
    const vv = window.visualViewport;

    if (!vv) {
      return;
    }

    let queued = false;

    const place = () => {
      queued = false;

      /*
       * Aldrig under noll: under gummibandsstudsen i botten rapporterar Safari
       * en synlig yta bortom sidan, och en trogen förskjutning knuffade då
       * knappen rakt ut under skärmkanten — den försvann i studsen och kom
       * tillbaka när sidan släppte. Förskjutningen får dra knappen *in* i den
       * synliga ytan (zoom), aldrig ut ur den (studs).
       */
      const dx = Math.max(0, window.innerWidth - (vv.offsetLeft + vv.width));
      const dy = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));

      button.style.translate = `${-Math.round(dx)}px ${-Math.round(dy)}px`;
    };

    const schedule = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(place);
      }
    };

    vv.addEventListener("resize", schedule, { passive: true });
    vv.addEventListener("scroll", schedule, { passive: true });
    place();
  };

  /*
   * Headern renderas av sin egen komponent och kan komma efter oss —
   * några korta återförsök innan den flytande reserven tar vid, så att
   * dev-sidorna utan header också har en knapp.
   */
  const mount = (tries) => {
    const controls = document.querySelector(".site-header__controls");

    if (controls) {
      inHeader = true;
      controls.append(button);
      paintButton();
      return;
    }

    if (tries > 0) {
      setTimeout(() => mount(tries - 1), 200);
      return;
    }

    document.body.append(button);
    followViewport();
  };

  const put = () => {
    if (document.body) {
      document.body.append(dialog);
      mount(10);
    }
  };

  if (document.body) {
    put();
  } else {
    window.addEventListener("DOMContentLoaded", put);
  }
}

/*
 * A run that was already going carries on across a link, which is the whole
 * reason the switch is remembered rather than asked for per page.
 */
if (enabled) {
  installed = true;
  installWrappers();
  report({
    kind: "session",
    // The page is appended by the server, so naming it here said it twice.
    message: `fortsätter — vy ${window.innerWidth}x${window.innerHeight}`,
  });
}

showControl();

function installWrappers() {
/*
 * A fetch that answers 500 is not an error in JavaScript's eyes — the promise
 * resolves and the page carries on with a body it did not expect. On a tablet
 * that reads as "nothing happened", which is the whole class of fault this file
 * exists for, so the status is worth a line of its own.
 */
window.fetch = function loggedFetch(input, init) {
  const url = typeof input === "string" ? input : (input && input.url) || String(input);

  /* The reporter's own traffic, which must never be reported: a failing log
     endpoint would otherwise log its own failure, for ever. */
  if (url.includes(ENDPOINT)) {
    return send(input, init);
  }

  return send(input, init).then(
    (response) => {
      try {
        if (!response.ok) {
          report({
            kind: `fetch ${response.status}`,
            message: `${(init && init.method) || "GET"} ${url} svarade ${response.status} ${response.statusText}`,
            source: url,
          });
        }
      } catch {
        /* ignored */
      }

      return response;
    },
    (error) => {
      try {
        report({
          kind: "fetch",
          message: `${(init && init.method) || "GET"} ${url} gick inte att nå: ${error && error.message ? error.message : String(error)}`,
          source: url,
          stack: error && error.stack ? error.stack : "",
        });
      } catch {
        /* ignored */
      }

      /* Rethrown, because swallowing it here would change how the page behaves
         — and a diagnostic that alters the thing it measures is worthless. */
      throw error;
    },
  );
};

/*
 * Everything the console is told, forwarded to the same file.
 *
 * Johan's ask, and it changes what this is for: with faults alone he still has
 * to read the panel and tell me what it said. With `console.log` going the same
 * way he can put a line wherever he suspects something, tap the thing on the
 * tablet, and the answer is in `debug.log` on this machine — no transcription,
 * no photograph of a screen, no rounding away the digits that mattered.
 *
 * The real console is still called, so the browser's own tools keep working for
 * anyone who has them. `console.error` may already be wrapped by `?matt`, which
 * calls the original it captured — the two stack without either losing a line.
 */
const LEVELS = ["log", "info", "warn", "error", "debug"];

/** Arguments as one readable string, without letting a circular object throw. */
function describe(args) {
  return args
    .map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }

      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}`;
      }

      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ")
    .slice(0, 1000);
}

for (const level of LEVELS) {
  const real = console[level] ? console[level].bind(console) : null;

  if (!real) {
    continue;
  }

  console[level] = function forwarded(...args) {
    try {
      report({ kind: `console.${level}`, message: describe(args) });
    } catch {
      /* Forwarding must never be the reason a log line is lost. */
    }

    real(...args);
  };
}

}

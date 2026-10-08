/**
 * An OpenID Connect provider that exists so the login can be measured.
 *
 *     node tools/mock-oidc.mjs 4330
 *
 * ## Why a mock and not the real provider
 *
 * Story 126 picks Google as the first provider, and Google's sign-in cannot be
 * driven by Playwright — the bot protection stops it, and it is right to. So
 * the choice is between measuring the login in a real browser against
 * something fake, or measuring it by hand against something real. Both are
 * needed and they answer different questions: this one answers *does the flow
 * work, every redirect, cookie and header of it*, run on every change; Johan
 * answers *does Google accept our client*, once, in a browser, after the
 * rollout.
 *
 * Same stance as `tools/mock-bff.mjs`: a reference a host can read, and a test
 * tool. It is not a provider. There is no user database, no password, no
 * consent screen worth the name, and everything it holds lives in memory until
 * the process ends.
 *
 * ## What it is faithful about, and what it is not
 *
 * Faithful where the receiver would otherwise be tested against its own
 * assumptions:
 *
 *  - **RS256 with a real key pair**, minted at startup with `node:crypto` and
 *    published as a JWKS. The receiver verifies a genuine signature against a
 *    genuinely fetched key, which is the half a hand-rolled `{ sub: "test" }`
 *    would have skipped.
 *  - **PKCE is enforced.** A token request whose `code_verifier` does not hash
 *    to the challenge is refused, so a receiver that forgot to send one fails
 *    here rather than in production.
 *  - **`nonce` travels through** the authorization request into the ID token,
 *    so the receiver's check has something to check.
 *  - **A code is single use** and short-lived.
 *
 * Not faithful, deliberately: there is no login form and no password. A button
 * per person picks who you are, because what a test needs is a *different
 * subject*, not a credential. A second person is what makes "the list is the
 * organisation's, and this row says who changed it" measurable at all.
 *
 * ## The refusing path
 *
 * *Avbryt* answers the way a provider does when somebody declines: a redirect
 * back with `error=access_denied` and no code. A host that treats that as a
 * successful login, or as a crash, is a host that shows an editor a blank page
 * with no way back.
 */
import { createHash, generateKeyPairSync, randomBytes, sign as signWith } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4330);
const ISSUER = process.env.MOCK_OIDC_ISSUER ?? `http://localhost:${PORT}`;

/**
 * The key pair, minted now and gone when the process ends.
 *
 * A key on disk would be a key somebody eventually uses for something else.
 * 2048 bits because that is what providers publish; the cost is a few hundred
 * milliseconds once, at startup.
 */
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });
const KID = createHash("sha256").update(jwk.n).digest("base64url").slice(0, 16);

/**
 * Who you can be — the four the measurements are written for (story 127).
 *
 * The names are Johan's test people, and they are here rather than invented per
 * run so that a failing check reads the same as the story and the runbook:
 * *Anna ser Nisses guide*. Johan's own name is in the list because he is one of
 * the four in the real measurement, and a mock whose cast differs from the
 * hand-run's is a mock somebody has to translate every time.
 *
 * Four and not two: *whose guide is this* needs a second person, *does the list
 * show everybody's* needs a third, and a fourth costs one object. They exist at
 * Google in the order Johan could create them (18/9: Johan and Anna; Google's
 * abuse guard wanted a fresh mobile number per account for the other two), and
 * that is exactly why they all exist here.
 */
const PEOPLE = {
  johan: {
    sub: "mock-johan-furuskog",
    name: "Johan Furuskog",
    given_name: "Johan",
    family_name: "Furuskog",
    email: "johan.furuskog@exempel.invalid",
    email_verified: true,
  },
  anna: {
    sub: "mock-anna-andersson",
    name: "Anna Andersson",
    given_name: "Anna",
    family_name: "Andersson",
    email: "anna.andersson@exempel.invalid",
    email_verified: true,
  },
  nisse: {
    sub: "mock-nisse-hult",
    name: "Nisse Hult",
    given_name: "Nisse",
    family_name: "Hult",
    email: "nisse.hult@exempel.invalid",
    email_verified: true,
  },
  monika: {
    sub: "mock-monika-agren",
    name: "Monika Ågren",
    given_name: "Monika",
    family_name: "Ågren",
    email: "monika.agren@exempel.invalid",
    email_verified: true,
  },
};

/** Codes waiting to be exchanged. In memory, short-lived, single use. */
const pending = new Map();
const CODE_TTL_MS = 2 * 60 * 1000;

const base64url = (value) => Buffer.from(value).toString("base64url");

/** A JWT, signed for real, so the receiver's verification has work to do. */
function idTokenFor({ person, clientId, nonce, now }) {
  const header = { alg: "RS256", typ: "JWT", kid: KID };
  const claims = {
    ...person,
    iss: ISSUER,
    aud: clientId,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600,
    ...(nonce ? { nonce } : {}),
  };
  const body = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = signWith("RSA-SHA256", Buffer.from(body), privateKey);

  return `${body}.${signature.toString("base64url")}`;
}

/** The chooser. Plain HTML, plain links — nothing here needs a script. */
function chooser(query) {
  const carry = (extra) => {
    const next = new URLSearchParams(query);

    for (const [key, value] of Object.entries(extra)) {
      next.set(key, value);
    }

    return next.toString();
  };

  return `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Attrapp-inloggning</title>
    <style>
      body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 2rem; background: #f6f7f9; color: #16203a; }
      main { max-width: 26rem; margin: 3rem auto; background: #fff; padding: 1.5rem; border-radius: .75rem; box-shadow: 0 1px 4px rgba(0,0,0,.12); }
      h1 { font-size: 1.25rem; margin-top: 0; }
      a { display: block; margin: .5rem 0; padding: .75rem 1rem; border-radius: .5rem; text-decoration: none; }
      a.person { background: #16203a; color: #fff; }
      a.deny { background: #fff; color: #16203a; border: 1px solid #c7ccd6; }
      p { color: #4a5568; font-size: .9rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Attrapp-inloggning</h1>
      <p>Den här leverantören finns bara för att mäta inloggningen. Ingen riktig person, inget lösenord.</p>
      ${Object.entries(PEOPLE)
        .map(
          ([who, person]) =>
            `<a class="person" id="as-${who}" href="/approve?${carry({ who })}">Logga in som ${person.name}</a>`,
        )
        .join("\n      ")}
      <a class="deny" id="deny" href="/deny?${carry({})}">Avbryt</a>
    </main>
  </body>
</html>`;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, ISSUER);
  const send = (status, body, type = "application/json; charset=utf-8") => {
    response.writeHead(status, { "content-type": type });
    response.end(typeof body === "string" ? body : JSON.stringify(body));
  };
  const redirect = (to) => {
    response.writeHead(302, { location: to });
    response.end();
  };

  if (url.pathname === "/.well-known/openid-configuration") {
    send(200, {
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      jwks_uri: `${ISSUER}/jwks`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: ["openid", "profile", "email"],
      code_challenge_methods_supported: ["S256"],
    });
    return;
  }

  if (url.pathname === "/jwks") {
    send(200, { keys: [{ ...jwk, kid: KID, use: "sig", alg: "RS256" }] });
    return;
  }

  if (url.pathname === "/authorize") {
    /*
     * The two things a provider must refuse before showing anybody a screen.
     * Without a redirect address there is nowhere to send an answer, and an
     * unsupported challenge method means the client thinks it has PKCE and
     * does not.
     */
    if (!url.searchParams.get("redirect_uri")) {
      send(400, { error: "invalid_request", error_description: "redirect_uri saknas" });
      return;
    }

    if (url.searchParams.get("code_challenge_method") !== "S256") {
      send(400, { error: "invalid_request", error_description: "bara S256 stöds" });
      return;
    }

    send(200, chooser(url.searchParams), "text/html; charset=utf-8");
    return;
  }

  if (url.pathname === "/approve") {
    const person = PEOPLE[url.searchParams.get("who") ?? "johan"] ?? PEOPLE.johan;
    const code = randomBytes(24).toString("base64url");
    const back = new URL(url.searchParams.get("redirect_uri"));

    pending.set(code, {
      person,
      clientId: url.searchParams.get("client_id") ?? "",
      nonce: url.searchParams.get("nonce") ?? "",
      challenge: url.searchParams.get("code_challenge") ?? "",
      at: Date.now(),
    });

    back.searchParams.set("code", code);

    if (url.searchParams.get("state")) {
      back.searchParams.set("state", url.searchParams.get("state"));
    }

    redirect(back.toString());
    return;
  }

  if (url.pathname === "/deny") {
    const back = new URL(url.searchParams.get("redirect_uri"));

    back.searchParams.set("error", "access_denied");

    if (url.searchParams.get("state")) {
      back.searchParams.set("state", url.searchParams.get("state"));
    }

    redirect(back.toString());
    return;
  }

  if (url.pathname === "/token" && request.method === "POST") {
    const body = await new Promise((accept) => {
      const chunks = [];

      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => accept(Buffer.concat(chunks).toString("utf8")));
    });
    const form = new URLSearchParams(body);
    const held = pending.get(form.get("code") ?? "");

    // Single use: taken out whether or not the rest of the request is right.
    pending.delete(form.get("code") ?? "");

    if (!held || held.at + CODE_TTL_MS < Date.now()) {
      send(400, { error: "invalid_grant" });
      return;
    }

    const verifier = form.get("code_verifier") ?? "";
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    if (verifier === "" || challenge !== held.challenge) {
      send(400, { error: "invalid_grant", error_description: "code_verifier stämmer inte" });
      return;
    }

    send(200, {
      access_token: randomBytes(24).toString("base64url"),
      token_type: "Bearer",
      expires_in: 3600,
      id_token: idTokenFor({
        person: held.person,
        clientId: form.get("client_id") || held.clientId,
        nonce: held.nonce,
        now: Date.now(),
      }),
    });
    return;
  }

  send(404, { error: "not_found", finns: ["/.well-known/openid-configuration", "/authorize", "/token", "/jwks"] });
});

export { server, PORT, ISSUER };

server.listen(PORT, () => {
  if (process.env.FLOWWEAVER_TYST) {
    return;
  }

  console.log(`Attrapp-OIDC på ${ISSUER}`);
  console.log(`  discovery   ${ISSUER}/.well-known/openid-configuration`);
  console.log(`  nyckel      RS256, kid ${KID} (myntad nu, borta när processen slutar)`);
  console.log(
    `  personer    ${Object.values(PEOPLE)
      .map((one) => one.name)
      .join(", ")} — och Avbryt, som avvisar`,
  );
});

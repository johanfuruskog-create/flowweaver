/**
 * The editor's login on the reference host — OpenID Connect, no npm.
 *
 *     OIDC_ISSUER=https://accounts.google.com
 *     OIDC_CLIENT_ID=…            OIDC_CLIENT_SECRET=…
 *     SESSION_SECRET=…            (a long random string; changing it logs everyone out)
 *
 * ## Why this host has a login at all, when the contract has none
 *
 * `docs/LAGRING-KONTRAKT.md` says nothing about who may read and write, on
 * purpose: Sitevision binds to its session, a municipality to its directory,
 * and both ignore that section. But the reference host has to answer the
 * question somehow, and the smallest answer — one secret per guide, carried in
 * the address — was measured and found wanting (story 126): it lands in
 * history, in bookmarks and in screenshots, it cannot be rotated without
 * throwing the guide away, and it cannot be shared with a colleague.
 *
 * So the reference host trusts a provider the operator names in `.env`, and
 * becomes no kind of identity provider itself. There is no user table, no
 * password, no registration and no account recovery here — only a signed
 * cookie holding what an ID token said.
 *
 * ## Why every piece of this is written out rather than installed
 *
 * The product ships without npm dependencies (CLAUDE.md's build ladder), and
 * the reference host holds itself to the same rule so that a host copying it
 * inherits nothing. Everything the flow needs is already in the platform:
 * `node:crypto` mints the PKCE verifier, verifies RS256 against the provider's
 * JWKS and signs the session; `fetch` does discovery and the code exchange.
 * The whole of it is under four hundred lines, and that is the honest measure
 * of what a library would have saved.
 *
 * ## The shape of the flow, and what is deliberately not kept
 *
 * Authorization code with PKCE, which is what a public *or* confidential
 * client should use today — the verifier means a stolen code is useless to
 * whoever stole it.
 *
 *  1. `GET /auth/login?return=…` mints a verifier, a nonce and a state, puts
 *     all three in a **short-lived signed cookie**, and sends the browser to
 *     the provider.
 *  2. The provider comes back to `/auth/callback?code&state`. The state in the
 *     query must equal the state in the cookie, which is what makes somebody
 *     else's callback useless.
 *  3. The code is exchanged for tokens; the ID token is verified against the
 *     provider's published keys; `sub`, `name` and `email` become the session.
 *
 * **Nothing is stored on the server.** Not the pending login, not the session.
 * A signed cookie is the whole of it, which means there is no table to prune,
 * nothing to lose in a restart, and no second copy of somebody's name. The
 * price is that a session cannot be revoked one at a time — changing
 * `SESSION_SECRET` logs out everyone, and that is written in `docs/DRIFT.md`
 * as the way to do it rather than hidden as a limitation.
 *
 * The access token and the refresh token are thrown away after the exchange.
 * This host calls nothing on the user's behalf; it only needed to know who
 * they are, and keeping a credential it has no use for would be keeping a
 * credential it can lose.
 */
import { createHash, createHmac, createPublicKey, randomBytes, randomUUID, timingSafeEqual, verify as verifySignature } from "node:crypto";

/** The session cookie. Named in `docs/DRIFT.md`, so it does not move casually. */
export const SESSION_COOKIE = "fw_session";

/** The pending login: verifier, nonce, state and where to go afterwards. */
export const LOGIN_COOKIE = "fw_login";

/** How long a login may be left half-finished before it has to be restarted. */
const LOGIN_WINDOW_SECONDS = 10 * 60;

/** How long a session lasts. A working day, plus the evening somebody works late. */
export const SESSION_SECONDS = 12 * 60 * 60;

/* ── base64url, both ways ──────────────────────────────────────────────── */

const toBase64Url = (buffer) => Buffer.from(buffer).toString("base64url");
const fromBase64Url = (text) => Buffer.from(String(text), "base64url");

/* ── Configuration ─────────────────────────────────────────────────────── */

/**
 * What `.env` says about logging in, and whether it says enough.
 *
 * Three states, and the middle one is the reason this returns a `fault`
 * instead of a boolean: **nothing set** is the documented no-provider host,
 * where the guide secret is the identity and everything works as it did before
 * story 126. **All three set** is a host with a login. **Some set** is a
 * mistake, and it must not quietly become the first state — a half-configured
 * login that silently falls back to accepting secrets is exactly the failure a
 * person would never look for. So the server says it out loud at startup, the
 * same stance Resend's half-configuration takes.
 */
export function readAuthConfig(env = process.env) {
  const issuer = String(env.OIDC_ISSUER ?? "").trim().replace(/\/$/, "");
  const clientId = String(env.OIDC_CLIENT_ID ?? "").trim();
  const clientSecret = String(env.OIDC_CLIENT_SECRET ?? "").trim();
  const redirectUri = String(env.OIDC_REDIRECT_URI ?? "").trim();
  const given = [issuer, clientId, clientSecret].filter((one) => one !== "").length;

  if (given === 0) {
    return { on: false, fault: "" };
  }

  if (given < 3) {
    return {
      on: false,
      fault:
        "OIDC är halvt konfigurerat — inloggningen är AV och hemligheten per guide gäller. " +
        "Sätt OIDC_ISSUER, OIDC_CLIENT_ID och OIDC_CLIENT_SECRET, alla tre.",
    };
  }

  /*
   * A missing session secret is not a reason to refuse to serve, and it is not
   * a reason to run without signing either. A random one means the sessions
   * work and do not survive a restart — which is visible, harmless and says
   * itself, where either alternative would be a surprise later.
   */
  const configured = String(env.SESSION_SECRET ?? "").trim();

  return {
    on: true,
    issuer,
    clientId,
    clientSecret,
    redirectUri,
    sessionSecret: configured === "" ? randomBytes(32).toString("hex") : configured,
    fault:
      configured === ""
        ? "SESSION_SECRET saknas — sessionerna signeras med en slumpnyckel som byts vid varje omstart, " +
          "så alla loggas ut när tjänsten startar om."
        : "",
  };
}

/**
 * The origins a browser may call this host from, and return to after a login.
 *
 * `ALLOWED_ORIGINS` is a comma-separated list; `FLOWWEAVER_ORIGIN` is the one
 * that existed before and stays the first entry, so a host configured for the
 * submission receiver needs no new line to keep working. The list is closed
 * rather than open on purpose: this endpoint writes on somebody's behalf, and
 * since story 126 it does so with a **cookie**, which means `*` is not merely
 * lax — a browser refuses it outright beside `Allow-Credentials`.
 */
export function readAllowedOrigins(env = process.env) {
  const listed = String(env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((one) => one.trim())
    .filter((one) => one !== "");
  const single = String(env.FLOWWEAVER_ORIGIN ?? "").trim();

  return [...(single === "" ? [] : [single]), ...listed].filter(
    (one, at, all) => all.indexOf(one) === at,
  );
}

/* ── Cookies ───────────────────────────────────────────────────────────── */

/** One cookie out of a `Cookie:` header, or `""`. */
export function readCookie(header, name) {
  for (const part of String(header ?? "").split(";")) {
    const at = part.indexOf("=");

    if (at > 0 && part.slice(0, at).trim() === name) {
      return decodeURIComponent(part.slice(at + 1).trim());
    }
  }

  return "";
}

/**
 * A `Set-Cookie` line.
 *
 * `HttpOnly` because no script has any business reading the session — a token
 * a page can read is a token an injected script can take. `SameSite=Lax` and
 * not `Strict`, for two reasons that both have to hold: the callback arrives
 * as a top-level navigation **from the provider**, which `Strict` would strip
 * the pending-login cookie from; and `flowweaver.se` and `api.flowweaver.se`
 * are the same *site*, so `Lax` is all the editor's `credentials: "include"`
 * needs. `Secure` follows the scheme rather than being configured, because a
 * `Secure` cookie on plain `http://localhost` is simply never sent and the
 * failure looks like a broken login.
 */
export function setCookie(name, value, { maxAge, secure }) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
  ].join("; ");
}

/** The same cookie, emptied and expired. */
export function clearCookie(name, { secure }) {
  return setCookie(name, "", { maxAge: 0, secure });
}

/* ── Signing, for both cookies ─────────────────────────────────────────── */

/**
 * `<payload>.<signature>`, where the payload is readable and the signature is
 * what makes it trustworthy.
 *
 * Deliberately not encrypted. What is in there — a subject, a name, an address
 * the person typed into the provider — is already known to the person holding
 * the cookie, and encrypting it would only suggest it is a secret from them.
 * What must not happen is somebody *writing* one, and that is what the HMAC
 * prevents.
 */
export function sign(payload, secret) {
  const body = toBase64Url(JSON.stringify(payload));
  const mac = createHmac("sha256", secret).update(body).digest("base64url");

  return `${body}.${mac}`;
}

/**
 * The payload back, or `null` — and `null` covers every way it can be wrong:
 * missing, malformed, signed with another key, or expired.
 *
 * The comparison is constant time and length-checked first, because
 * `timingSafeEqual` throws on a length mismatch rather than answering false —
 * which would turn a forged cookie into a 500 instead of a 401.
 */
export function readSigned(token, secret, now = Date.now()) {
  const [body = "", mac = ""] = String(token ?? "").split(".");

  if (body === "" || mac === "") {
    return null;
  }

  const wanted = createHmac("sha256", secret).update(body).digest("base64url");

  if (mac.length !== wanted.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(wanted))) {
    return null;
  }

  let payload;

  try {
    payload = JSON.parse(fromBase64Url(body).toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload?.exp !== "number" || payload.exp * 1000 <= now) {
    return null;
  }

  return payload;
}

/* ── PKCE ──────────────────────────────────────────────────────────────── */

/**
 * The verifier and its challenge.
 *
 * 32 random bytes as base64url is 43 characters, the shortest the spec allows
 * and the length everybody uses. `S256` rather than `plain`: the challenge
 * travels through the browser's address bar and the provider's logs, and the
 * whole point is that seeing it teaches nobody the verifier.
 */
export function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  return { verifier, challenge };
}

/** A value nobody can guess, for `state` and `nonce` alike. */
export const opaque = () => randomBytes(16).toString("base64url");

/* ── The provider ──────────────────────────────────────────────────────── */

/**
 * `<issuer>/.well-known/openid-configuration`, cached for the process.
 *
 * Read rather than configured, because that is what makes the provider
 * swappable: moving from Google to Entra ID is three values in `.env` and
 * nothing here, which was the requirement in story 126 — *the first provider
 * is Google, but the contract is OIDC*.
 *
 * The cache is a plain map with a time, not an eviction policy. A discovery
 * document changes about as often as a provider changes its name.
 */
const discovered = new Map();
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

export async function discover(issuer, fetcher = fetch, now = Date.now()) {
  const held = discovered.get(issuer);

  if (held && held.at + DISCOVERY_TTL_MS > now) {
    return held.value;
  }

  const answer = await fetcher(`${issuer}/.well-known/openid-configuration`);

  if (!answer.ok) {
    throw new Error(`leverantören svarade ${answer.status} på discovery`);
  }

  const value = await answer.json();

  /*
   * The document says who it is for, and it has to say this issuer. A provider
   * that answers with another issuer's endpoints is either misconfigured or
   * something worse, and following it would be following the wrong login.
   */
  if (String(value?.issuer ?? "").replace(/\/$/, "") !== issuer) {
    throw new Error("discovery-dokumentet tillhör en annan leverantör");
  }

  discovered.set(issuer, { at: now, value });

  return value;
}

/** For tests that need to look at a second provider in the same process. */
export function forgetDiscovery() {
  discovered.clear();
}

/* ── The keys, and the token they sign ─────────────────────────────────── */

const keysByUri = new Map();

/**
 * The provider's public keys, fetched once and re-fetched when a `kid` is
 * unknown.
 *
 * Re-fetching on a miss rather than on a timer is what makes a key rotation a
 * non-event: a provider that starts signing with a new key hands out a token
 * whose `kid` is not in the cache, and the next line goes and gets it. A timer
 * would have a window where every login fails.
 */
async function keyFor(jwksUri, kid, fetcher) {
  const cached = keysByUri.get(jwksUri);
  const found = cached?.find((key) => key.kid === kid);

  if (found) {
    return found;
  }

  const answer = await fetcher(jwksUri);

  if (!answer.ok) {
    throw new Error(`nyckeluppslaget svarade ${answer.status}`);
  }

  const keys = (await answer.json())?.keys;

  if (!Array.isArray(keys)) {
    throw new Error("nyckeluppslaget innehöll inga nycklar");
  }

  keysByUri.set(jwksUri, keys);

  const key = keys.find((one) => one.kid === kid);

  if (!key) {
    throw new Error(`leverantören har ingen nyckel ${kid}`);
  }

  return key;
}

/**
 * The ID token, verified — and every check here is one that has been the whole
 * of a real vulnerability somewhere.
 *
 *  - **`alg` must be RS256.** `none` is a valid JWT algorithm and it means
 *    "trust me"; a verifier that reads the algorithm out of the token it is
 *    checking has asked the attacker which lock to use.
 *  - **The signature must verify against the provider's published key**, found
 *    by the `kid` in the header.
 *  - **`iss` must be the issuer we configured**, or we have verified somebody
 *    else's login perfectly.
 *  - **`aud` must contain our client id**, or we have accepted a token minted
 *    for a different application at the same provider.
 *  - **`exp` must be in the future**, with a little slack for clocks.
 *  - **`nonce` must be the one we sent**, which is what ties this token to the
 *    login this browser actually started.
 */
export async function verifyIdToken(idToken, { issuer, clientId, nonce, jwksUri, fetcher = fetch, now = Date.now() }) {
  const [head = "", body = "", signature = ""] = String(idToken ?? "").split(".");

  if (head === "" || body === "" || signature === "") {
    return { ok: false, why: "id-tokenet har inte tre delar" };
  }

  let header;
  let claims;

  try {
    header = JSON.parse(fromBase64Url(head).toString("utf8"));
    claims = JSON.parse(fromBase64Url(body).toString("utf8"));
  } catch {
    return { ok: false, why: "id-tokenet gick inte att läsa" };
  }

  if (header?.alg !== "RS256") {
    return { ok: false, why: `algoritmen ${header?.alg} accepteras inte` };
  }

  let key;

  try {
    key = await keyFor(jwksUri, header.kid, fetcher);
  } catch (error) {
    return { ok: false, why: error.message };
  }

  const publicKey = createPublicKey({ key: { ...key, alg: undefined }, format: "jwk" });
  const signed = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${head}.${body}`),
    publicKey,
    fromBase64Url(signature),
  );

  if (!signed) {
    return { ok: false, why: "signaturen stämmer inte" };
  }

  if (String(claims.iss ?? "").replace(/\/$/, "") !== issuer.replace(/\/$/, "")) {
    return { ok: false, why: "tokenet kommer från en annan utfärdare" };
  }

  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];

  if (!audience.includes(clientId)) {
    return { ok: false, why: "tokenet är utfärdat för någon annan klient" };
  }

  // Thirty seconds, which is what a clock drifts, not what a session lasts.
  if (typeof claims.exp !== "number" || claims.exp * 1000 + 30_000 <= now) {
    return { ok: false, why: "tokenet har gått ut" };
  }

  if (nonce !== undefined && claims.nonce !== nonce) {
    return { ok: false, why: "tokenet hör inte till den här inloggningen" };
  }

  return { ok: true, claims };
}

/**
 * What a session holds, out of whatever the provider called them.
 *
 * `name` falls back through the pieces a provider might send instead: Entra ID
 * gives `name` and `preferred_username` by default and `given_name`/
 * `family_name` only when the client asks for them as optional claims, while
 * Google sends all of them. A host that shows *Inloggad som* needs something to
 * put there, and the address is a better answer than an opaque subject.
 *
 * `groups` is kept **only when the provider sent any** (story 128). Entra ID
 * puts group membership in the token when the client asks for it, and that is
 * the whole of the role mapping there; Google has no such claim, so on Google
 * the field is simply absent and the mapping is per subject instead.
 *
 * The ids are carried rather than turned into a role here, because the role is
 * worked out per request (`roles.mjs`): a corrected `.env` then reaches
 * everybody at the next restart instead of at the end of each person's
 * twelve-hour session. A group id is not a secret from the person who is in the
 * group, and the cookie it rides in is that person's own.
 */
export function claimsFrom(claims) {
  const joined = [claims?.given_name, claims?.family_name].filter(Boolean).join(" ").trim();
  const groups = Array.isArray(claims?.groups)
    ? claims.groups.map((one) => String(one)).filter((one) => one !== "")
    : [];

  return {
    subject: String(claims?.sub ?? ""),
    name:
      String(claims?.name ?? "").trim() ||
      joined ||
      String(claims?.preferred_username ?? "").trim() ||
      String(claims?.email ?? "").trim(),
    email: String(claims?.email ?? ""),
    ...(groups.length > 0 ? { groups } : {}),
  };
}

/* ── The two halves of the flow ────────────────────────────────────────── */

/**
 * Where to send the browser, and what to remember while it is away.
 *
 * `scope` is `openid profile email` and nothing more. `openid` is what makes
 * this OIDC rather than OAuth; the other two are the name and the address the
 * history and the header need, and a fourth scope would be asking for
 * something nothing displays.
 */
export async function beginLogin({ config, redirectUri, returnTo, fetcher = fetch, now = Date.now() }) {
  const provider = await discover(config.issuer, fetcher, now);
  const { verifier, challenge } = pkce();
  const state = opaque();
  const nonce = opaque();
  const url = new URL(provider.authorization_endpoint);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return {
    location: url.toString(),
    pending: {
      state,
      nonce,
      verifier,
      redirectUri,
      returnTo,
      exp: Math.floor(now / 1000) + LOGIN_WINDOW_SECONDS,
    },
  };
}

/**
 * The code for a session, or a reason it is not one.
 *
 * The reason never reaches the browser as anything but *the login failed* — a
 * page that repeats "the token was issued for another client" teaches nothing
 * to the person reading it and quite a lot to somebody probing. It goes in the
 * host's log, which is where the person who can fix it is looking.
 */
export async function finishLogin({ config, pending, code, state, fetcher = fetch, now = Date.now() }) {
  if (!pending || typeof pending.state !== "string" || pending.state !== state) {
    return { ok: false, why: "state stämmer inte med den påbörjade inloggningen" };
  }

  const provider = await discover(config.issuer, fetcher, now);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: String(code ?? ""),
    redirect_uri: String(pending.redirectUri ?? ""),
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: String(pending.verifier ?? ""),
  });
  const answer = await fetcher(provider.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!answer.ok) {
    return { ok: false, why: `token-utbytet svarade ${answer.status}` };
  }

  const tokens = await answer.json();
  const checked = await verifyIdToken(tokens?.id_token, {
    issuer: config.issuer,
    clientId: config.clientId,
    nonce: pending.nonce,
    jwksUri: provider.jwks_uri,
    fetcher,
    now,
  });

  if (!checked.ok) {
    return checked;
  }

  const who = claimsFrom(checked.claims);

  if (who.subject === "") {
    return { ok: false, why: "tokenet saknar sub" };
  }

  /*
   * The access token and the refresh token stop here. See the header: this host
   * never acts on the user's behalf, so keeping them would be keeping something
   * it can only lose.
   */
  return {
    ok: true,
    session: { ...who, exp: Math.floor(now / 1000) + SESSION_SECONDS },
  };
}

/**
 * Where the browser goes after a login, and never where somebody else said.
 *
 * An unchecked `?return=` is an open redirect: a link that starts at the host
 * everyone trusts and ends anywhere. The check is by **origin against the
 * list the operator wrote**, not by "starts with http" or "is relative", both
 * of which have well-known ways round them.
 */
export function safeReturn(wanted, allowedOrigins) {
  const fallback = allowedOrigins[0] ?? "";

  if (typeof wanted !== "string" || wanted === "") {
    return fallback;
  }

  try {
    const url = new URL(wanted);

    return allowedOrigins.includes(url.origin) ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

/** A guide id the host mints. Here so the route and the tool agree on the shape. */
export const newGuideId = () => randomUUID();

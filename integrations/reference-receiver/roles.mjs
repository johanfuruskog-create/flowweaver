/**
 * Four roles, as a ladder, read out of `.env` (story 128).
 *
 *     ROLES=<subject>:admin,<subject>:publisher,<subject>:editor
 *     ROLE_ADMIN=<group id>   ROLE_PUBLISHER=<group id>   ROLE_EDITOR=<group id>
 *
 * ## Why the roles are a ladder and not a set of permissions
 *
 * Reader, editor, publisher, administrator: every rung gets everything below
 * it. That is the shape Sitevision and WordPress landed on, and it is the one
 * that can be explained in a line — *these people may publish, those may only
 * write*. A role that is not a rung — *may publish but not edit* — is outside
 * this story until a real case asks for one, and the whole model is cheaper to
 * remove than a permission matrix would be.
 *
 * So there is one comparison in the whole file, `allows`, and every route asks
 * it the same question.
 *
 * ## Why the role comes out of `.env` and not out of a table here
 *
 * The same stance as the login itself (`auth.mjs`): this host is not an
 * identity provider and must not become an authorisation one either. A host
 * with a directory has the answer already, and the only thing missing is the
 * mapping from what the directory says to what this host means by it.
 *
 * Two providers, two shapes, because the providers genuinely differ:
 *
 *  - **Entra ID puts group membership in the token** (`groups`), when the
 *    client asks for it. Then the mapping is group id → role, and somebody who
 *    joins a group gets the role at their next login without anybody touching
 *    this server.
 *  - **Google says nothing about groups.** There is no claim to map, so the
 *    mapping is per subject, written by hand. That does not scale and is not
 *    meant to: Google is the provider for the trial, and a municipality has a
 *    directory.
 *
 * ## Unknown is reader, and that is the decision this file exists to make
 *
 * Somebody who signs in and is in neither mapping is a **reader**. It is the
 * safe default in the only direction that matters: the cost of a wrong reader
 * is a person who has to ask for access, and the cost of a wrong editor is a
 * published guide somebody changed by accident.
 *
 * It has a price and it is written in `docs/DRIFT.md` rather than softened
 * here: the first person to configure this host must put **themselves** in the
 * mapping before it is rolled out, or nobody can write anything.
 *
 * ## Why the role is worked out per request and not frozen into the session
 *
 * The session cookie holds what the ID token said — a subject, a name, an
 * address, and the groups when the provider sent any. The role is derived from
 * that on every request, so a corrected `.env` plus a restart takes effect for
 * everybody at once. Freezing the role into the cookie would mean the fix
 * reaches a person only when their twelve-hour session ends, which is the kind
 * of half-applied change somebody debugs for an afternoon.
 */

/**
 * The rungs, lowest first. The index **is** the comparison — a second table of
 * "what may a publisher do" would be a second thing to keep in step.
 */
export const ROLE_LADDER = ["reader", "editor", "publisher", "admin"];

/** Is `role` at least `needed`? The only permission question this host asks. */
export function allows(role, needed) {
  const at = ROLE_LADDER.indexOf(role);
  const wanted = ROLE_LADDER.indexOf(needed);

  // An unknown name is never enough. A typo in `.env` must not open a door.
  return at >= 0 && wanted >= 0 && at >= wanted;
}

/** `"admin"` out of whatever somebody wrote, or `""` when it is not a role. */
const asRole = (text) => {
  const named = String(text ?? "").trim().toLowerCase();

  return ROLE_LADDER.includes(named) ? named : "";
};

/**
 * What `.env` says about who is what.
 *
 * Both shapes are read whether or not the host uses both: a host that moves
 * from Google to Entra ID changes `.env` and nothing else, and a line left
 * behind from the old provider names a subject the new one never mints.
 *
 * Anything unparseable is skipped in silence rather than refused. This is a
 * mapping and not a credential: an entry nobody can read simply is not there,
 * and the person it was meant for is a reader — which is visible the first time
 * they try to save, and says itself.
 */
export function readRoleConfig(env = process.env) {
  /** subject → role, out of `ROLES=sub:role,sub:role`. */
  const bySubject = new Map();

  for (const pair of String(env.ROLES ?? "").split(",")) {
    const at = pair.lastIndexOf(":");

    if (at <= 0) {
      continue;
    }

    const subject = pair.slice(0, at).trim();
    const role = asRole(pair.slice(at + 1));

    if (subject !== "" && role !== "") {
      bySubject.set(subject, role);
    }
  }

  /**
   * group id → role, out of one variable per rung.
   *
   * A list per variable rather than one variable per group: an organisation
   * usually has several groups that should mean *editor*, and the alternative
   * would be inventing a syntax for the same thing twice.
   *
   * There is no `ROLE_READER`. Unknown is already reader, so a variable for it
   * would be a line that changes nothing — and a line that changes nothing is
   * a line somebody eventually believes in.
   */
  const byGroup = new Map();

  for (const rung of ["admin", "publisher", "editor"]) {
    for (const group of String(env[`ROLE_${rung.toUpperCase()}`] ?? "").split(",")) {
      const id = group.trim();

      if (id !== "") {
        byGroup.set(id, rung);
      }
    }
  }

  return { bySubject, byGroup };
}

/**
 * The role for one session — the **highest** the mappings give it.
 *
 * Highest and not first, because a person in two groups is not less than either
 * of them, and because the order groups arrive in a token is the provider's
 * business. Same between the two mappings: a subject written by hand beside a
 * group that already grants more would otherwise silently demote somebody.
 */
export function roleOf(session, config) {
  const subject = String(session?.subject ?? "");
  const groups = Array.isArray(session?.groups) ? session.groups : [];
  const candidates = [
    config.bySubject.get(subject) ?? "",
    ...groups.map((group) => config.byGroup.get(String(group)) ?? ""),
  ].filter((one) => one !== "");

  return candidates.reduce(
    (best, one) => (ROLE_LADDER.indexOf(one) > ROLE_LADDER.indexOf(best) ? one : best),
    "reader",
  );
}

/**
 * Which rung a request needs, out of the route it is.
 *
 * Written as one function rather than a check per route so that a route added
 * later cannot quietly be the one nobody guarded: a method this does not know
 * lands on `editor`, which refuses a reader — the failure that costs least.
 *
 * `GET` is `reader` throughout, and that is the whole of "a reader may look":
 * the list, the guide, a version, all of it.
 */
export function neededRole(method, section) {
  if (method === "GET") {
    return "reader";
  }

  /*
   * Publishing and pointing at a published version are the same decision seen
   * from two sides — *this is what visitors get* — so they are one rung, above
   * writing the working copy.
   */
  if (section === "versions" || section === "current") {
    return "publisher";
  }

  /*
   * `snapshots` står MED FLIT inte här (berättelse 131). Att frysa båda
   * kopiorna vid en krock är motsatsen till att publicera — *vi är inte
   * överens än* — och det måste gå för den som just skrev i arbetskopian.
   * Stod den bland publicerarnas vägar kunde en redaktör aldrig slå ihop, och
   * då vore 131 en funktion bara publicerare fick använda.
   */
  return "editor";
}

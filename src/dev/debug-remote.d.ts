/*
 * `debug-remote.js` is plain JavaScript on purpose — it is loaded for its side
 * effects only and never imported for a value. `tsconfig` has no `allowJs`, so
 * without this the conditional import in the entry points would not typecheck.
 *
 * `export {}` and nothing else: a sibling `.d.ts` *is* the declaration for the
 * `.js` beside it, so a `declare module` here describes a second, non-existent
 * module and leaves this file looking like a script rather than a module.
 */
export {};

/**
 * Rollernas form, nedskriven.
 *
 * Mottagaren är vanlig JavaScript med flit — en värd som kopierar den ska inte
 * behöva ta in ett byggsteg för att läsa den (samma hållning som
 * `integrations/node-mongo`). Den här filen finns för att repots egna tester
 * ska kunna typkontrollera mot modulen, och den är samtidigt den kortaste
 * beskrivningen av vad rollmodellen är: fyra rungor, två mappningar och en
 * jämförelse.
 */

/** Rungorna, lägst först. */
export type Role = "reader" | "editor" | "publisher" | "admin";

export declare const ROLE_LADDER: Role[];

/** Är `role` minst `needed`? Ett namn som inte är en rung räcker aldrig. */
export declare function allows(role: string, needed: string): boolean;

/** Vad `.env` säger: subjekt → rung, och grupp-id → rung. */
export interface RoleConfig {
  bySubject: Map<string, Role>;
  byGroup: Map<string, Role>;
  /** `LOGINS`: subjekt och verifierade adresser som får komma in som läsare (8/10). */
  logins: Set<string>;
}

export declare function readRoleConfig(env?: Record<string, string | undefined>): RoleConfig;

/** Den högsta rung mappningarna ger sessionen — `"reader"` när ingen gör det. */
export declare function roleOf(
  session: { subject?: string; groups?: unknown[] } | null | undefined,
  config: RoleConfig,
): Role;

/**
 * Får sessionen vara här alls? Bara den `.env` namnger: i `ROLES`, via en grupp
 * i `ROLE_*`, eller i `LOGINS` — en adress bara när leverantören verifierat den.
 */
export declare function mayLogIn(
  session: { subject?: string; groups?: unknown[]; email?: string; emailVerified?: boolean } | null | undefined,
  config: RoleConfig,
): boolean;

/** Vilken rung en väg kräver: `GET` är läsarens, resten står i modulen. */
export declare function neededRole(method: string, section: string | undefined): Role;

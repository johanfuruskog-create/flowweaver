/**
 * Kartleverantören en värd registrerar — berättelse 046, kontraktet i
 * `docs/KART-KONTRAKT.md`.
 *
 * Flowweaver ritar ingen karta, hämtar inga plattor och vet ingenting om
 * projektioner. Kartfrågan ställer en fråga genom det här registret; värdens
 * karta svarar med GeoJSON och en etikett. Precis som kodlistorna och
 * formaten är leverantören något värden lägger till — biblioteket bär bara
 * kontraktet.
 *
 * `acceptPickResult` är kontraktets avvisningsregler som kod: ett svar som
 * inte är giltig GeoJSON av den beställda sorten behandlas som ett avbrutet
 * val, aldrig som ett svar. Hellre inget än fel geografi.
 */

/** Sorterna en fråga kan be om. `points` och `area` är reserverade för v2. */
export type MapKind = "point" | "points" | "area";

export interface MapPickResult {
  /** GeoJSON i WGS84, `[longitud, latitud]` — standardens ordning. */
  geometry: { type: string; coordinates: unknown };
  /** En rad en människa känner igen. För en punkt: gatuadressen. */
  label: string;
  /**
   * FÅR anges: kartans zoomnivå när valet bekräftades. Startvyn bär den
   * vidare, så en trång kvarterskarta förblir trång — utelämnad betyder
   * att leverantören väljer själv.
   */
  zoom?: number;
}

export interface MapProvider {
  /** Vad värdens karta klarar. En fråga om en sort utanför listan visar bara golvet. */
  kinds: readonly MapKind[];
  /**
   * Be personen peka ut geometri; lös med resultatet eller null vid avbrott.
   *
   * `near` är en frivillig ledtråd — redaktörens startvy som `[lon, lat]`.
   * En leverantör FÅR centrera där; en som ignorerar den bryter ingenting.
   */
  pick(options: {
    kind: MapKind;
    near?: [number, number];
    /** Ledtrådens zoomnivå — redaktörens, om startvyn bar en. */
    zoom?: number;
    /**
     * Svaret som redan finns, när personen ändrar sitt val. Er karta BÖR
     * öppna med det inritat så att justera är utgångsläget — att rita om
     * från noll är straffet för att ha svarat, och det ska ingen få.
     */
    current?: MapPickResult["geometry"];
  }): Promise<MapPickResult | null>;
  /**
   * Frivillig stillbild: utgångsvyn när geometry är null, annars geometrin
   * inritad. Data-URI eller en URL sidans CSP tillåter. Presentation, aldrig
   * data. `near` är samma ledtråd som i pick — var utgångsvyn bör ligga.
   */
  snapshot?(
    geometry: MapPickResult["geometry"] | null,
    options?: { near?: [number, number]; zoom?: number },
  ): Promise<string>;
}

let provider: MapProvider | null = null;

export function registerMapProvider(next: MapProvider): void {
  provider = next;
}

export function unregisterMapProvider(): void {
  provider = null;
}

export function getMapProvider(): MapProvider | null {
  return provider;
}

const GEOJSON_TYPE_FOR: Record<MapKind, string> = {
  point: "Point",
  points: "MultiPoint",
  area: "Polygon",
};

const isFinitePair = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((part) => typeof part === "number" && Number.isFinite(part));

/**
 * Kontraktets avvisningsregler. Returnerar resultatet oförändrat när det
 * håller, annars null — samma svar som ett avbrutet val, så fältet aldrig
 * lagrar geografi det inte kan gå i god för.
 */
export function acceptPickResult(
  result: MapPickResult | null,
  kind: MapKind,
): MapPickResult | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const { geometry, label } = result;

  if (!geometry || geometry.type !== GEOJSON_TYPE_FOR[kind] || typeof label !== "string") {
    return null;
  }

  const coordinates = geometry.coordinates;

  if (kind === "point") {
    return isFinitePair(coordinates) ? result : null;
  }

  if (kind === "points") {
    return Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(isFinitePair)
      ? result
      : null;
  }

  // area: en yttre ring med minst fyra hörn (GeoJSON sluter ringen själv).
  return Array.isArray(coordinates) &&
    coordinates.length > 0 &&
    Array.isArray(coordinates[0]) &&
    (coordinates[0] as unknown[]).length >= 4 &&
    (coordinates[0] as unknown[]).every(isFinitePair)
    ? result
    : null;
}

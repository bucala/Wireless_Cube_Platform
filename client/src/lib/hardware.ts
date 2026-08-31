/**
 * Kompletná definícia zostavy: geometria kocky, mikrokontrolér, čítačka a tag.
 *
 * Geometria je runtime konfigurácia (dá sa meniť v UI a ukladá sa do profilu),
 * hardvérové špecifikácie sú konštanty odzrkadľujúce firmware/include/config.h.
 * Všetky dĺžky sú v milimetroch, 3D scéna používa 1 jednotku = 1 mm.
 */

export type TagShape = 'square' | 'round';

export interface DiceGeometry {
  /** Hrana neprůhledného jadra, do ktorého sú zalisované tagy. */
  coreMm: number;
  /** Vonkajšia hrana celej kocky (plášť + jadro). */
  shellMm: number;
  /** Hrana štvorcového tagu, resp. priemer okrúhleho. */
  tagMm: number;
  tagShape: TagShape;
  /** Označenie čipu, ukladá sa do profilu. */
  tagModel: string;
  /** Zaoblenie hrán vonkajšej kocky. */
  cornerRadiusMm: number;
  /** Ako hlboko sú bodky vyrazené pod povrchom. */
  pipDepthMm: number;
}

export const DEFAULT_GEOMETRY: DiceGeometry = {
  coreMm: 8,
  shellMm: 12,
  tagMm: 5,
  tagShape: 'square',
  tagModel: 'NTAG213',
  cornerRadiusMm: 1.4,
  pipDepthMm: 0.3,
};

export interface Limit {
  min: number;
  max: number;
  step: number;
}

export const GEOMETRY_LIMITS: Record<
  'coreMm' | 'shellMm' | 'tagMm' | 'cornerRadiusMm' | 'pipDepthMm',
  Limit
> = {
  coreMm: { min: 3, max: 19, step: 0.1 },
  shellMm: { min: 6, max: 24, step: 0.1 },
  tagMm: { min: 2, max: 12, step: 0.1 },
  cornerRadiusMm: { min: 0, max: 4, step: 0.05 },
  pipDepthMm: { min: 0, max: 1.2, step: 0.05 },
};

export const TAG_SHAPES: ReadonlyArray<{ id: TagShape; label: string }> = [
  { id: 'square', label: 'štvorec' },
  { id: 'round', label: 'kruh' },
];

/** Bežné veľkosti NTAG inlayov, ktoré sa do 12 mm kocky vôbec vojdú. */
export const TAG_MODELS: ReadonlyArray<{ model: string; sizeMm: number; shape: TagShape; note: string }> = [
  { model: 'NTAG213', sizeMm: 5, shape: 'square', note: '144 B user memory, 7 B UID' },
  { model: 'NTAG213', sizeMm: 6, shape: 'round', note: 'okrúhly inlay 6 mm' },
  { model: 'NTAG215', sizeMm: 8, shape: 'square', note: '504 B user memory' },
  { model: 'NTAG216', sizeMm: 8, shape: 'square', note: '888 B user memory' },
];

/** Hrúbka plášťa medzi stenou jadra a povrchom kocky. */
export function wallMm(geometry: DiceGeometry): number {
  return (geometry.shellMm - geometry.coreMm) / 2;
}

/** Telesová diagonála jadra – rozhoduje, či sa jadro vôbec vojde do plášťa. */
export function coreDiagonalMm(geometry: DiceGeometry): number {
  return geometry.coreMm * Math.sqrt(3);
}

export type IssueLevel = 'error' | 'warn';

export interface GeometryIssue {
  level: IssueLevel;
  text: string;
}

/**
 * Kontroly, ktoré majú fyzikálny význam. `error` znamená nezostaviteľnú kocku,
 * `warn` je konštrukčne riskantné, ale vyrobiteľné.
 */
export function validateGeometry(geometry: DiceGeometry): GeometryIssue[] {
  const issues: GeometryIssue[] = [];
  const wall = wallMm(geometry);

  if (geometry.coreMm >= geometry.shellMm) {
    issues.push({ level: 'error', text: 'Jadro musí byť menšie ako vonkajšia kocka.' });
  } else if (wall < 0.5) {
    issues.push({
      level: 'error',
      text: `Plášť má len ${wall.toFixed(2)} mm; pod 0,5 mm sa nedá odliať.`,
    });
  } else if (wall < 1) {
    issues.push({
      level: 'warn',
      text: `Plášť ${wall.toFixed(2)} mm je veľmi tenký – tagy budú blízko povrchu a pole ich zachytí naraz.`,
    });
  }

  if (geometry.tagMm >= geometry.coreMm) {
    issues.push({
      level: 'error',
      text: 'TAG je väčší než stena jadra, na ktorú ho lepíš.',
    });
  } else if (geometry.tagMm > geometry.coreMm * 0.75) {
    issues.push({
      level: 'warn',
      text: 'TAG zaberá viac než 3/4 steny jadra; hrozí presah do susednej steny.',
    });
  }

  if (geometry.cornerRadiusMm > geometry.shellMm / 2 - 0.5) {
    issues.push({
      level: 'error',
      text: 'Zaoblenie je väčšie než polovica hrany – z kocky by bola guľa.',
    });
  }

  if (geometry.pipDepthMm > wall && wall > 0) {
    issues.push({
      level: 'warn',
      text: 'Bodky sú hlbšie než plášť, prerážajú až na jadro.',
    });
  }

  return issues;
}

export function geometryHasError(geometry: DiceGeometry): boolean {
  return validateGeometry(geometry).some((issue) => issue.level === 'error');
}

/** Bezpečné načítanie čísla z inputu; prázdny/nezmyselný vstup drží starú hodnotu. */
export function clampToLimit(raw: number, limit: Limit, fallback: number): number {
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(limit.max, Math.max(limit.min, Number(raw.toFixed(2))));
}

// --- hardvérová zostava ----------------------------------------------------

export interface SpecRow {
  label: string;
  value: string;
  note?: string;
}

export const MCU_SPEC: SpecRow[] = [
  { label: 'Modul', value: 'ESP32-S3-WROOM-1', note: 'variant N16R8' },
  { label: 'Jadro', value: 'Xtensa LX7 dual-core @ 240 MHz' },
  { label: 'Flash', value: '16 MB QIO', note: 'partície default_16MB.csv' },
  { label: 'PSRAM', value: '8 MB OPI', note: 'memory_type = qio_opi' },
  { label: 'USB', value: 'USB-CDC on boot', note: 'sériové zrkadlo protokolu' },
  { label: 'Sieť', value: 'Wi-Fi STA + SoftAP fallback', note: 'mDNS nfc-dice.local' },
];

export const READER_SPEC: SpecRow[] = [
  { label: 'Modul', value: 'NXP PN5180', note: 'ISO/IEC 14443-A front end' },
  { label: 'Zbernica', value: 'hardvérové SPI (FSPI / SPI2_HOST)' },
  { label: 'Hodiny SPI', value: '7 MHz', note: 'maximum host interface PN5180' },
  { label: 'Handshake', value: 'BUSY line', note: 'každý rámec čaká na uvolnenie' },
  { label: 'Bitrate NFC', value: '106 kbit/s' },
  { label: 'Riadenie výkonu', value: 'TX_CW_AMPLITUDE + TX_RESIDUAL_CARRIER', note: '5–100 %' },
];

export interface PinRow {
  signal: string;
  gpio: number;
  note: string;
}

/** Zrkadlí firmware/include/config.h – pri zmene pinov uprav obe miesta. */
export const PIN_MAP: PinRow[] = [
  { signal: 'SCK', gpio: 12, note: 'SPI clock' },
  { signal: 'MISO', gpio: 13, note: 'PN5180 → ESP32' },
  { signal: 'MOSI', gpio: 11, note: 'ESP32 → PN5180' },
  { signal: 'NSS', gpio: 10, note: 'chip select, aktívny v L' },
  { signal: 'BUSY', gpio: 9, note: 'vstup, handshake' },
  { signal: 'RST', gpio: 8, note: 'reset, aktívny v L' },
  { signal: 'IRQ', gpio: 7, note: '-1 = poll IRQ_STATUS' },
  { signal: 'LED', gpio: 48, note: 'WS2812 na devkite' },
];

export function tagSpec(geometry: DiceGeometry): SpecRow[] {
  const shape = geometry.tagShape === 'square' ? 'štvorec' : 'kruh';
  const size =
    geometry.tagShape === 'square'
      ? `${geometry.tagMm} × ${geometry.tagMm} mm`
      : `⌀ ${geometry.tagMm} mm`;
  return [
    { label: 'Čip', value: geometry.tagModel, note: 'ISO14443-A, 7 B UID' },
    { label: 'Inlay', value: `${size} (${shape})` },
    { label: 'Počet', value: '6 ks', note: 'jeden na každú stenu jadra' },
    { label: 'Jadro', value: `${geometry.coreMm} × ${geometry.coreMm} × ${geometry.coreMm} mm` },
    {
      label: 'Kocka',
      value: `${geometry.shellMm} × ${geometry.shellMm} × ${geometry.shellMm} mm`,
      note: `plášť ${wallMm(geometry).toFixed(2)} mm`,
    },
  ];
}

// --- perzistencia geometrie ------------------------------------------------

const STORAGE_KEY = 'nfc-dice-debugger/geometry';

export function normalizeGeometry(raw: unknown): DiceGeometry {
  const data = (raw ?? {}) as Partial<DiceGeometry> & { tagDiameterMm?: number; tagType?: string };
  const shape: TagShape = data.tagShape === 'round' ? 'round' : 'square';
  return {
    coreMm: clampToLimit(toNumber(data.coreMm), GEOMETRY_LIMITS.coreMm, DEFAULT_GEOMETRY.coreMm),
    shellMm: clampToLimit(
      toNumber(data.shellMm),
      GEOMETRY_LIMITS.shellMm,
      DEFAULT_GEOMETRY.shellMm,
    ),
    tagMm: clampToLimit(
      toNumber(data.tagMm ?? data.tagDiameterMm),
      GEOMETRY_LIMITS.tagMm,
      DEFAULT_GEOMETRY.tagMm,
    ),
    tagShape: shape,
    tagModel: data.tagModel ?? data.tagType ?? DEFAULT_GEOMETRY.tagModel,
    cornerRadiusMm: clampToLimit(
      toNumber(data.cornerRadiusMm),
      GEOMETRY_LIMITS.cornerRadiusMm,
      DEFAULT_GEOMETRY.cornerRadiusMm,
    ),
    pipDepthMm: clampToLimit(
      toNumber(data.pipDepthMm),
      GEOMETRY_LIMITS.pipDepthMm,
      DEFAULT_GEOMETRY.pipDepthMm,
    ),
  };
}

/**
 * Chýbajúca hodnota (null/undefined/prázdny reťazec) aj nezmyselný vstup sa
 * premenia na NaN, takže `clampToLimit` vráti default. `Number(null)` by inak
 * dal 0 a hodnota by sa zovrela na minimum namiesto fallbacku.
 */
function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return Number.NaN;
  return Number(value);
}

export function loadStoredGeometry(): DiceGeometry {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GEOMETRY };
    return normalizeGeometry(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_GEOMETRY };
  }
}

export function storeGeometry(geometry: DiceGeometry): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(geometry));
  } catch {
    // Bez perzistencie, geometria platí do reloadu.
  }
}

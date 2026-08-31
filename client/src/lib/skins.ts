/**
 * Skiny (farebné schémy) celej aplikácie.
 *
 * Jediný zdroj pravdy je tento súbor: paleta sa zapíše ako CSS premenné na
 * <html>, odkiaľ ju berie Tailwind (`rgb(var(--c-*) / <alpha-value>)`), a tá
 * istá definícia obsahuje aj farby pre 3D scénu, ktoré Three.js potrebuje ako
 * obyčajné hex hodnoty.
 */

export type SkinId = 'white' | 'gray' | 'noir';

/** Tokeny mapované na CSS premenné a cez ne na Tailwind triedy. */
export interface SkinPalette {
  /** Pozadie stránky. */
  bg: string;
  /** Vnorené plochy (inputy, metriky) → najtmavšia/najsvetlejšia úroveň. */
  base950: string;
  /** Pozadie panelov. */
  base900: string;
  base850: string;
  base800: string;
  /** Dráhy prepínačov a progress barov. */
  base700: string;
  base600: string;
  /** Textová rampa: 100 = najsilnejší text, 600 = najtlmenejší. */
  slate50: string;
  slate100: string;
  slate200: string;
  slate300: string;
  slate400: string;
  slate500: string;
  slate600: string;
  slate700: string;
  slate800: string;
  slate900: string;
  accent: string;
  accentSoft: string;
  accentDeep: string;
  ok: string;
  warn: string;
  bad: string;
  /**
   * Čo znamená `white` v triedach ako `border-white/10`. Na svetlých skinoch je
   * to takmer čierna, takže vlasové linky zostanú viditeľné bez zásahu do
   * jednotlivých komponentov.
   */
  overlay: string;
}

/** Farby, ktoré spotrebúva 3D scéna (Three.js pracuje s hex, nie s CSS var). */
export interface SkinScene {
  background: string;
  fog: string;
  /** Neprůhledné jadro kocky. */
  core: string;
  coreEdge: string;
  /** Sklený plášť: zabarvenie a hrany. */
  shell: string;
  shellEdge: string;
  /** Vyrazené bodky na plášti. */
  pip: string;
  /** DPS čítačky a jej cievka. */
  pcb: string;
  coil: string;
  /** Pulzujúci prstenec antény a bublina poľa. */
  fieldOk: string;
  fieldBad: string;
  /** Stavy stien jadra. */
  faceUnbound: string;
  faceBound: string;
  faceLive: string;
  facePending: string;
  /** Telo TAGu a jeho obrys. */
  tag: string;
  tagRim: string;
  /** Intenzita svetiel – svetlé skiny potrebujú menej. */
  ambient: number;
  key: number;
}

export interface Skin {
  id: SkinId;
  /** Krátky názov do prepínača. */
  label: string;
  /** Popis pod názvom. */
  note: string;
  /** `light` prepne aj vzhľad natívnych prvkov prehliadača. */
  scheme: 'light' | 'dark';
  palette: SkinPalette;
  scene: SkinScene;
}

// --- skin 1: biela + oranžová, prvky čiernej a červenej ---------------------
const WHITE: Skin = {
  id: 'white',
  label: 'Skin 1',
  note: 'Biela + oranžová',
  scheme: 'light',
  palette: {
    // Na svetlých skinoch je poradie obrátené: panel je najsvetlejší (biely) a
    // "vnorené" plochy sú o odtieň tmavšie, aby karty a inputy vôbec vynikli.
    bg: '#fafafb',
    base950: '#f1f2f4',
    base900: '#ffffff',
    base850: '#f7f8f9',
    base800: '#ebedf0',
    base700: '#dcdee2',
    base600: '#c6c9cf',
    slate50: '#08090a',
    slate100: '#111316',
    slate200: '#1b1e22',
    slate300: '#32363c',
    slate400: '#4c5158',
    slate500: '#6a6f77',
    slate600: '#8b9098',
    slate700: '#b3b7be',
    slate800: '#d4d7dc',
    slate900: '#ebedf0',
    accent: '#ea580c',
    accentSoft: '#fb923c',
    accentDeep: '#c2410c',
    ok: '#111316',
    warn: '#b45309',
    bad: '#dc2626',
    overlay: '#08090a',
  },
  scene: {
    background: '#f2f3f5',
    fog: '#f2f3f5',
    core: '#1c1f24',
    coreEdge: '#0a0b0d',
    shell: '#ffffff',
    shellEdge: '#c2410c',
    pip: '#111316',
    pcb: '#1b1e22',
    coil: '#c2410c',
    fieldOk: '#ea580c',
    fieldBad: '#dc2626',
    faceUnbound: '#8b9098',
    faceBound: '#ea580c',
    faceLive: '#111316',
    facePending: '#fb923c',
    tag: '#dc2626',
    tagRim: '#ffffff',
    ambient: 0.85,
    key: 1.5,
  },
};

// --- skin 2: sivá + oranžová, prvky čiernej a červenej ---------------------
// Paleta podľa referenčného návrhu: teplé tmavé uhlikové sivé (#151515 /
// #20201F / #2C2C2C), vypálená oranžová #D97757, teplá biela text.
const GRAY: Skin = {
  id: 'gray',
  label: 'Skin 2',
  note: 'Sivá + oranžová',
  scheme: 'dark',
  palette: {
    bg: '#151515',
    base950: '#101010',
    base900: '#20201F',
    base850: '#242423',
    base800: '#2C2C2C',
    base700: '#3a3a38',
    base600: '#4D4D4C',
    slate50: '#F0EFEC',
    slate100: '#E5E4E1',
    slate200: '#D9D8D5',
    slate300: '#C9C8C6',
    slate400: '#A4A3A1',
    slate500: '#8F8F8D',
    slate600: '#777671',
    slate700: '#535352',
    slate800: '#404040',
    slate900: '#2B2B2A',
    accent: '#D97757',
    accentSoft: '#E89A7E',
    accentDeep: '#774636',
    // Na tmavom pozadí: "ok" = teplá biela, "warn" = teplá jantárová,
    // "bad" a TAG = výrazná červená (prvok červenej zo zadania).
    ok: '#EAE9E6',
    warn: '#E5B567',
    bad: '#DC4437',
    overlay: '#F0EFEC',
  },
  scene: {
    background: '#151515',
    fog: '#151515',
    core: '#0C0C0B',
    coreEdge: '#2C2C2C',
    shell: '#4a4745',
    shellEdge: '#D97757',
    pip: '#0C0C0B',
    pcb: '#1A1A19',
    coil: '#774636',
    fieldOk: '#D97757',
    fieldBad: '#DC4437',
    faceUnbound: '#404040',
    faceBound: '#D97757',
    faceLive: '#F0EFEC',
    facePending: '#E89A7E',
    tag: '#DC4437',
    tagRim: '#F0EFEC',
    ambient: 0.5,
    key: 2,
  },
};

// --- skin 3: pôvodná tmavá schéma ------------------------------------------
const NOIR: Skin = {
  id: 'noir',
  label: 'Skin 3',
  note: 'Tmavá + azúrová',
  scheme: 'dark',
  palette: {
    bg: '#05070d',
    base950: '#05070d',
    base900: '#0a0e17',
    base850: '#0f1420',
    base800: '#141a28',
    base700: '#1d2537',
    base600: '#2a3449',
    slate50: '#f8fafc',
    slate100: '#f1f5f9',
    slate200: '#e2e8f0',
    slate300: '#cbd5e1',
    slate400: '#94a3b8',
    slate500: '#64748b',
    slate600: '#475569',
    slate700: '#334155',
    slate800: '#1e293b',
    slate900: '#0f172a',
    accent: '#38bdf8',
    accentSoft: '#7dd3fc',
    accentDeep: '#0284c7',
    ok: '#34d399',
    warn: '#fbbf24',
    bad: '#f87171',
    overlay: '#ffffff',
  },
  scene: {
    background: '#05070d',
    fog: '#05070d',
    core: '#111827',
    coreEdge: '#1e293b',
    shell: '#eaf6ff',
    shellEdge: '#38bdf8',
    pip: '#0b1220',
    pcb: '#0b1220',
    coil: '#1e3a5f',
    fieldOk: '#38bdf8',
    fieldBad: '#f87171',
    faceUnbound: '#334155',
    faceBound: '#0ea5e9',
    faceLive: '#34d399',
    facePending: '#fbbf24',
    tag: '#0ea5e9',
    tagRim: '#e2e8f0',
    ambient: 0.35,
    key: 2.1,
  },
};

export const SKINS: Record<SkinId, Skin> = { white: WHITE, gray: GRAY, noir: NOIR };
export const SKIN_ORDER: readonly SkinId[] = ['white', 'gray', 'noir'];
export const DEFAULT_SKIN: SkinId = 'white';

const CSS_VAR: Record<keyof SkinPalette, string> = {
  bg: '--c-bg',
  base950: '--c-base-950',
  base900: '--c-base-900',
  base850: '--c-base-850',
  base800: '--c-base-800',
  base700: '--c-base-700',
  base600: '--c-base-600',
  slate50: '--c-slate-50',
  slate100: '--c-slate-100',
  slate200: '--c-slate-200',
  slate300: '--c-slate-300',
  slate400: '--c-slate-400',
  slate500: '--c-slate-500',
  slate600: '--c-slate-600',
  slate700: '--c-slate-700',
  slate800: '--c-slate-800',
  slate900: '--c-slate-900',
  accent: '--c-accent',
  accentSoft: '--c-accent-soft',
  accentDeep: '--c-accent-deep',
  ok: '--c-ok',
  warn: '--c-warn',
  bad: '--c-bad',
  overlay: '--c-overlay',
};

/** '#1a2b3c' -> '26 43 60' (Tailwind potrebuje trojicu, aby fungovalo /alpha). */
export function hexToTriplet(hex: string): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  const int = Number.parseInt(full, 16);
  return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`;
}

export function skinById(id: SkinId): Skin {
  return SKINS[id] ?? SKINS[DEFAULT_SKIN];
}

/** Zapíše paletu skinu na <html>. Voláme pred prvým renderom, nie v efekte. */
export function applySkin(id: SkinId): Skin {
  const skin = skinById(id);
  const root = document.documentElement;
  for (const [token, cssVar] of Object.entries(CSS_VAR)) {
    root.style.setProperty(cssVar, hexToTriplet(skin.palette[token as keyof SkinPalette]));
  }
  root.dataset.skin = skin.id;
  root.style.colorScheme = skin.scheme;
  return skin;
}

const STORAGE_KEY = 'nfc-dice-debugger/skin';

export function loadStoredSkin(): SkinId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && (SKIN_ORDER as readonly string[]).includes(raw)) return raw as SkinId;
  } catch {
    // Privátny režim - vrátime default.
  }
  return DEFAULT_SKIN;
}

export function storeSkin(id: SkinId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Bez perzistencie, ale skin funguje.
  }
}

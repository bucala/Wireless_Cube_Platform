/**
 * Calibration profile of one physical dice: which NTAG213 UID sits behind which
 * core face, plus the RF settings the profile was captured with.
 */

import { FACE_IDS, FaceId, faceValue, topValueFromBottom } from './dice';
import { DEFAULT_GEOMETRY, normalizeGeometry, type DiceGeometry } from './hardware';

export const PROFILE_SCHEMA = 'nfc-dice-profile/1';

export interface FaceBinding {
  face: FaceId;
  uid: string;
  /** Pips engraved on the shell above this core face. */
  value: number;
  /** Value visible on top while this face rests on the reader (7 - value). */
  topValue: number;
  boundAt: string;
  /** How many times this UID was confirmed while binding. */
  samples: number;
}

export interface DiceProfile {
  schema: typeof PROFILE_SCHEMA;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Snapshot rozmerov, s ktorými bol profil nameraný. */
  geometry: DiceGeometry;
  rf: {
    tunedPowerPct: number | null;
    ceilingPct: number | null;
    lowEdgePct: number | null;
    firmware: string | null;
  };
  bindings: FaceBinding[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createProfile(name = 'Kocka 01'): DiceProfile {
  const ts = nowIso();
  return {
    schema: PROFILE_SCHEMA,
    id: randomId(),
    name,
    createdAt: ts,
    updatedAt: ts,
    geometry: { ...DEFAULT_GEOMETRY },
    rf: { tunedPowerPct: null, ceilingPct: null, lowEdgePct: null, firmware: null },
    bindings: [],
  };
}

/**
 * Binds `uid` to `face`. A UID can only live on one face and a face can only
 * hold one UID, so both are replaced if they were already taken - re-scanning a
 * face is the normal way to fix a mistake.
 */
export function bindFace(profile: DiceProfile, face: FaceId, uid: string): DiceProfile {
  const value = faceValue(face);
  const existing = profile.bindings.find((b) => b.face === face && b.uid === uid);
  const binding: FaceBinding = {
    face,
    uid,
    value,
    topValue: topValueFromBottom(value),
    boundAt: nowIso(),
    samples: (existing?.samples ?? 0) + 1,
  };
  const bindings = profile.bindings
    .filter((b) => b.face !== face && b.uid !== uid)
    .concat(binding)
    .sort((a, b) => FACE_IDS.indexOf(a.face) - FACE_IDS.indexOf(b.face));

  return { ...profile, bindings, updatedAt: nowIso() };
}

export function unbindFace(profile: DiceProfile, face: FaceId): DiceProfile {
  return {
    ...profile,
    bindings: profile.bindings.filter((b) => b.face !== face),
    updatedAt: nowIso(),
  };
}

export function withRfSettings(
  profile: DiceProfile,
  rf: Partial<DiceProfile['rf']>,
): DiceProfile {
  return { ...profile, rf: { ...profile.rf, ...rf }, updatedAt: nowIso() };
}

/** Prepíše rozmery v profile aktuálnou konfiguráciou z UI. */
export function withGeometry(profile: DiceProfile, geometry: DiceGeometry): DiceProfile {
  return { ...profile, geometry: { ...geometry }, updatedAt: nowIso() };
}

export function renameProfile(profile: DiceProfile, name: string): DiceProfile {
  return { ...profile, name, updatedAt: nowIso() };
}

export function uidForFace(profile: DiceProfile, face: FaceId): string | null {
  return profile.bindings.find((b) => b.face === face)?.uid ?? null;
}

export function faceForUid(profile: DiceProfile, uid: string): FaceId | null {
  return profile.bindings.find((b) => b.uid === uid)?.face ?? null;
}

export function missingFaces(profile: DiceProfile): FaceId[] {
  const bound = new Set(profile.bindings.map((b) => b.face));
  return FACE_IDS.filter((id) => !bound.has(id));
}

export function isComplete(profile: DiceProfile): boolean {
  return missingFaces(profile).length === 0;
}

export function serializeProfile(profile: DiceProfile): string {
  return `${JSON.stringify(profile, null, 2)}\n`;
}

/** Parses and validates an imported profile; throws with a readable message. */
export function parseProfile(raw: string): DiceProfile {
  const data = JSON.parse(raw) as Partial<DiceProfile>;
  if (data.schema !== PROFILE_SCHEMA) {
    throw new Error(`neznáma schéma profilu: ${String(data.schema)}`);
  }
  if (!Array.isArray(data.bindings)) throw new Error('profil neobsahuje pole bindings');

  const bindings: FaceBinding[] = data.bindings.map((entry, index) => {
    const binding = entry as Partial<FaceBinding>;
    if (!binding.face || !FACE_IDS.includes(binding.face)) {
      throw new Error(`binding #${index + 1}: neplatná stena`);
    }
    if (typeof binding.uid !== 'string' || binding.uid.length < 8) {
      throw new Error(`binding #${index + 1}: neplatný UID`);
    }
    const value = faceValue(binding.face);
    return {
      face: binding.face,
      uid: binding.uid.toUpperCase(),
      value,
      topValue: topValueFromBottom(value),
      boundAt: binding.boundAt ?? nowIso(),
      samples: binding.samples ?? 1,
    };
  });

  const base = createProfile(data.name ?? 'Importovaná kocka');
  return {
    ...base,
    id: data.id ?? base.id,
    createdAt: data.createdAt ?? base.createdAt,
    updatedAt: nowIso(),
    geometry: normalizeGeometry(data.geometry),
    rf: { ...base.rf, ...(data.rf ?? {}) },
    bindings,
  };
}

export function downloadProfile(profile: DiceProfile): void {
  const blob = new Blob([serializeProfile(profile)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const slug = profile.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'dice';
  link.href = url;
  link.download = `${slug}-${profile.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// --- persistence ----------------------------------------------------------

const STORAGE_KEY = 'nfc-dice-debugger/profile';

export function loadStoredProfile(): DiceProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseProfile(raw);
  } catch {
    return null;
  }
}

export function storeProfile(profile: DiceProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeProfile(profile));
  } catch {
    // Private mode / quota - calibration still works, it just is not persisted.
  }
}

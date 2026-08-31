/**
 * Geometry and dice arithmetic for the 3D view and the calibration flow.
 * All lengths are millimetres; the 3D scene uses 1 unit = 1 mm.
 */

export const CORE_SIZE_MM = 7.5;
export const SHELL_SIZE_MM = 12;
export const TAG_DIAMETER_MM = 5;
export const TAG_THICKNESS_MM = 0.12;

/** Distance from the core surface to the outer shell surface. */
export const SHELL_WALL_MM = (SHELL_SIZE_MM - CORE_SIZE_MM) / 2;

export type FaceId = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

export interface FaceDef {
  id: FaceId;
  /** Outward unit normal in scene space. */
  normal: [number, number, number];
  /** Euler rotation that turns a +Z facing plane into this face. */
  rotation: [number, number, number];
  /** Number of pips engraved on the shell above this core face. */
  value: number;
  /** Short label used in the UI. */
  label: string;
  /** Where the face sits when the dice lies on the reader in its default pose. */
  hint: string;
}

/**
 * Right-handed western D6: opposite faces sum to seven and 1-2-3 run
 * counter-clockwise around their shared vertex. Change the `value` fields if
 * your physical dice are printed with a different chirality - everything else
 * (including the top-value computation) derives from this table.
 */
export const FACES: readonly FaceDef[] = [
  {
    id: 'py',
    normal: [0, 1, 0],
    rotation: [-Math.PI / 2, 0, 0],
    value: 1,
    label: 'Hore (+Y)',
    hint: 'vrch',
  },
  {
    id: 'pz',
    normal: [0, 0, 1],
    rotation: [0, 0, 0],
    value: 2,
    label: 'Vpredu (+Z)',
    hint: 'bok',
  },
  {
    id: 'px',
    normal: [1, 0, 0],
    rotation: [0, Math.PI / 2, 0],
    value: 3,
    label: 'Vpravo (+X)',
    hint: 'bok',
  },
  {
    id: 'nx',
    normal: [-1, 0, 0],
    rotation: [0, -Math.PI / 2, 0],
    value: 4,
    label: 'Vľavo (-X)',
    hint: 'bok',
  },
  {
    id: 'nz',
    normal: [0, 0, -1],
    rotation: [0, Math.PI, 0],
    value: 5,
    label: 'Vzadu (-Z)',
    hint: 'bok',
  },
  {
    id: 'ny',
    normal: [0, -1, 0],
    rotation: [Math.PI / 2, 0, 0],
    value: 6,
    label: 'Dole (-Y)',
    hint: 'dno',
  },
] as const;

export const FACE_IDS: readonly FaceId[] = FACES.map((face) => face.id);

const FACE_BY_ID = new Map<FaceId, FaceDef>(FACES.map((face) => [face.id, face]));

export function faceById(id: FaceId): FaceDef {
  const face = FACE_BY_ID.get(id);
  if (!face) throw new Error(`unknown face: ${id}`);
  return face;
}

export function faceValue(id: FaceId): number {
  return faceById(id).value;
}

/** The face physically opposite to `id`. */
export function oppositeFace(id: FaceId): FaceId {
  const map: Record<FaceId, FaceId> = {
    px: 'nx',
    nx: 'px',
    py: 'ny',
    ny: 'py',
    pz: 'nz',
    nz: 'pz',
  };
  return map[id];
}

/** On a D6 the visible top value is 7 minus the value resting on the reader. */
export function topValueFromBottom(bottomValue: number): number {
  if (!Number.isInteger(bottomValue) || bottomValue < 1 || bottomValue > 6) {
    throw new Error(`invalid face value: ${bottomValue}`);
  }
  return 7 - bottomValue;
}

/** Pip positions in unit face coordinates (-1..1 on both axes). */
export function pipLayout(value: number): Array<[number, number]> {
  switch (value) {
    case 1:
      return [[0, 0]];
    case 2:
      return [
        [-1, 1],
        [1, -1],
      ];
    case 3:
      return [
        [-1, 1],
        [0, 0],
        [1, -1],
      ];
    case 4:
      return [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
    case 5:
      return [
        [-1, -1],
        [-1, 1],
        [0, 0],
        [1, -1],
        [1, 1],
      ];
    case 6:
      return [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ];
    default:
      throw new Error(`no pip layout for value ${value}`);
  }
}

/**
 * Approximate distance from the reader antenna to each tag when `bottom` rests
 * on the reader. Used by the UI (and the simulator) to explain why a tag shows
 * up at a given field strength.
 */
export function tagDistancesMm(bottom: FaceId): Record<FaceId, number> {
  const gap = SHELL_WALL_MM; // shell thickness between core face and outside
  const top = oppositeFace(bottom);
  const result = {} as Record<FaceId, number>;
  for (const face of FACES) {
    if (face.id === bottom) result[face.id] = 0;
    else if (face.id === top) result[face.id] = CORE_SIZE_MM;
    else result[face.id] = Number((CORE_SIZE_MM / 2 + gap * 0.4).toFixed(2));
  }
  return result;
}

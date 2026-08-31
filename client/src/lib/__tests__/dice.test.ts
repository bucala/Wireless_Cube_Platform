import { describe, expect, it } from 'vitest';

import {
  CORE_SIZE_MM,
  FACES,
  SHELL_SIZE_MM,
  faceById,
  oppositeFace,
  pipLayout,
  tagDistancesMm,
  topValueFromBottom,
} from '../dice';

describe('dice geometry', () => {
  it('describes all six faces exactly once', () => {
    expect(FACES).toHaveLength(6);
    expect(new Set(FACES.map((face) => face.id)).size).toBe(6);
    expect(new Set(FACES.map((face) => face.value))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('keeps the core inside the shell', () => {
    expect(CORE_SIZE_MM).toBeLessThan(SHELL_SIZE_MM);
  });

  it('pairs opposite faces so their values sum to seven', () => {
    for (const face of FACES) {
      const opposite = faceById(oppositeFace(face.id));
      expect(face.value + opposite.value).toBe(7);
    }
  });

  it('derives the top value from the bottom value', () => {
    expect(topValueFromBottom(1)).toBe(6);
    expect(topValueFromBottom(6)).toBe(1);
    expect(topValueFromBottom(3)).toBe(4);
    expect(() => topValueFromBottom(0)).toThrow();
    expect(() => topValueFromBottom(7)).toThrow();
  });

  it('produces one pip position per value', () => {
    for (let value = 1; value <= 6; value += 1) {
      expect(pipLayout(value)).toHaveLength(value);
    }
    expect(() => pipLayout(7)).toThrow();
  });

  it('puts the resting face at 0 mm and the top face across the core', () => {
    const distances = tagDistancesMm('ny');
    expect(distances.ny).toBe(0);
    expect(distances.py).toBe(CORE_SIZE_MM);
    expect(distances.px).toBeGreaterThan(0);
    expect(distances.px).toBeLessThan(CORE_SIZE_MM);
  });
});

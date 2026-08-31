import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GEOMETRY,
  GEOMETRY_LIMITS,
  clampToLimit,
  geometryHasError,
  normalizeGeometry,
  tagSpec,
  validateGeometry,
  wallMm,
  type DiceGeometry,
} from '../hardware';

describe('dice geometry defaults', () => {
  it('matches the manufacturing spec 8 / 12 / 5 mm', () => {
    expect(DEFAULT_GEOMETRY.coreMm).toBe(8);
    expect(DEFAULT_GEOMETRY.shellMm).toBe(12);
    expect(DEFAULT_GEOMETRY.tagMm).toBe(5);
    expect(DEFAULT_GEOMETRY.tagShape).toBe('square');
  });

  it('derives a symmetric wall', () => {
    expect(wallMm(DEFAULT_GEOMETRY)).toBeCloseTo(2);
  });

  it('flags an impossible dice as an error', () => {
    const broken: DiceGeometry = { ...DEFAULT_GEOMETRY, coreMm: 12, shellMm: 12 };
    expect(geometryHasError(broken)).toBe(true);
    expect(validateGeometry(broken).some((issue) => issue.level === 'error')).toBe(true);
  });

  it('flags a tag larger than the core face as an error', () => {
    const broken: DiceGeometry = { ...DEFAULT_GEOMETRY, tagMm: 9 };
    expect(geometryHasError(broken)).toBe(true);
  });

  it('warns on a thin shell but does not error', () => {
    const risky: DiceGeometry = { ...DEFAULT_GEOMETRY, coreMm: 10.5, shellMm: 12 };
    expect(geometryHasError(risky)).toBe(false);
    expect(validateGeometry(risky).some((issue) => issue.level === 'warn')).toBe(true);
  });

  it('accepts the manufacturing defaults without issues', () => {
    expect(validateGeometry(DEFAULT_GEOMETRY)).toEqual([]);
  });
});

describe('normalizeGeometry', () => {
  it('clamps out-of-range values into the limits', () => {
    const result = normalizeGeometry({ coreMm: 500, shellMm: -3, tagMm: 99 });
    expect(result.coreMm).toBe(GEOMETRY_LIMITS.coreMm.max);
    expect(result.shellMm).toBe(GEOMETRY_LIMITS.shellMm.min);
    expect(result.tagMm).toBe(GEOMETRY_LIMITS.tagMm.max);
  });

  it('falls back to defaults for garbage input', () => {
    const result = normalizeGeometry({ coreMm: 'abc', shellMm: null });
    expect(result.coreMm).toBe(DEFAULT_GEOMETRY.coreMm);
    expect(result.shellMm).toBe(DEFAULT_GEOMETRY.shellMm);
  });

  it('migrates the old profile fields tagDiameterMm/tagType', () => {
    const result = normalizeGeometry({
      tagDiameterMm: 6,
      tagType: 'NTAG215',
    });
    expect(result.tagMm).toBe(6);
    expect(result.tagModel).toBe('NTAG215');
    expect(result.tagShape).toBe('square');
  });

  it('round-trips a valid geometry unchanged', () => {
    const original: DiceGeometry = {
      coreMm: 9,
      shellMm: 14,
      tagMm: 6,
      tagShape: 'round',
      tagModel: 'NTAG213',
      cornerRadiusMm: 2,
      pipDepthMm: 0.4,
    };
    expect(normalizeGeometry(original)).toEqual(original);
  });
});

describe('clampToLimit', () => {
  it('keeps in-range values and clamps the rest', () => {
    const limit = GEOMETRY_LIMITS.coreMm;
    expect(clampToLimit(10, limit, 8)).toBe(10);
    expect(clampToLimit(1, limit, 8)).toBe(limit.min);
    expect(clampToLimit(Number.NaN, limit, 8)).toBe(8);
  });
});

describe('tagSpec', () => {
  it('formats a square tag with dimensions', () => {
    const spec = tagSpec(DEFAULT_GEOMETRY);
    const inlay = spec.find((row) => row.label === 'Inlay');
    expect(inlay?.value).toContain('5 × 5 mm');
  });

  it('formats a round tag with a diameter', () => {
    const spec = tagSpec({ ...DEFAULT_GEOMETRY, tagShape: 'round' });
    const inlay = spec.find((row) => row.label === 'Inlay');
    expect(inlay?.value).toContain('⌀ 5 mm');
  });
});

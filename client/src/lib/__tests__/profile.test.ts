import { describe, expect, it } from 'vitest';

import {
  bindFace,
  createProfile,
  faceForUid,
  isComplete,
  missingFaces,
  parseProfile,
  serializeProfile,
  uidForFace,
  unbindFace,
  withRfSettings,
} from '../profile';
import { FACE_IDS } from '../dice';

const UID_A = '04:1A:7C:2B:5E:41:80';
const UID_B = '04:1A:7C:2B:5E:41:81';

describe('calibration profile', () => {
  it('starts empty with all faces missing', () => {
    const profile = createProfile('Test');
    expect(profile.bindings).toHaveLength(0);
    expect(missingFaces(profile)).toHaveLength(6);
    expect(isComplete(profile)).toBe(false);
  });

  it('binds a uid to a face and computes the top value', () => {
    const profile = bindFace(createProfile(), 'ny', UID_A);
    const binding = profile.bindings[0];
    expect(binding.face).toBe('ny');
    expect(binding.value).toBe(6);
    expect(binding.topValue).toBe(1);
    expect(uidForFace(profile, 'ny')).toBe(UID_A);
    expect(faceForUid(profile, UID_A)).toBe('ny');
  });

  it('keeps a uid on a single face when it is re-bound elsewhere', () => {
    let profile = bindFace(createProfile(), 'ny', UID_A);
    profile = bindFace(profile, 'py', UID_A);
    expect(profile.bindings).toHaveLength(1);
    expect(profile.bindings[0].face).toBe('py');
  });

  it('replaces the previous uid of a face', () => {
    let profile = bindFace(createProfile(), 'ny', UID_A);
    profile = bindFace(profile, 'ny', UID_B);
    expect(profile.bindings).toHaveLength(1);
    expect(uidForFace(profile, 'ny')).toBe(UID_B);
  });

  it('counts repeated confirmations of the same pairing', () => {
    let profile = bindFace(createProfile(), 'ny', UID_A);
    profile = bindFace(profile, 'ny', UID_A);
    expect(profile.bindings[0].samples).toBe(2);
  });

  it('reports completeness once every face is bound', () => {
    let profile = createProfile();
    FACE_IDS.forEach((face, index) => {
      profile = bindFace(profile, face, `04:1A:7C:2B:5E:41:9${index}`);
    });
    expect(isComplete(profile)).toBe(true);
    expect(missingFaces(profile)).toHaveLength(0);
  });

  it('unbinds a face', () => {
    const profile = unbindFace(bindFace(createProfile(), 'ny', UID_A), 'ny');
    expect(profile.bindings).toHaveLength(0);
  });

  it('round-trips through JSON', () => {
    const original = withRfSettings(bindFace(createProfile('Kocka 7'), 'px', UID_B), {
      tunedPowerPct: 27,
      ceilingPct: 44,
      lowEdgePct: 24,
      firmware: '1.0.0',
    });
    const restored = parseProfile(serializeProfile(original));
    expect(restored.name).toBe('Kocka 7');
    expect(restored.bindings).toEqual(original.bindings);
    expect(restored.rf.tunedPowerPct).toBe(27);
  });

  it('rejects a foreign schema', () => {
    expect(() => parseProfile('{"schema":"something-else","bindings":[]}')).toThrow();
  });

  it('rejects an invalid face', () => {
    const raw = JSON.stringify({
      schema: 'nfc-dice-profile/1',
      bindings: [{ face: 'top', uid: UID_A }],
    });
    expect(() => parseProfile(raw)).toThrow(/stena/);
  });
});

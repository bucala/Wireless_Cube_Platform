import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { topValueFromBottom, faceValue, type FaceId } from '../lib/dice';
import {
  bindFace,
  createProfile,
  downloadProfile,
  isComplete,
  loadStoredProfile,
  missingFaces,
  parseProfile,
  renameProfile,
  storeProfile,
  unbindFace,
  withGeometry,
  withRfSettings,
  type DiceProfile,
} from '../lib/profile';
import type { DiceGeometry } from '../lib/hardware';
import type { DeviceLink } from './useDeviceLink';

export type PairingPhase = 'idle' | 'waiting' | 'awaitFace' | 'done';

export interface PairingResult {
  face: FaceId;
  uid: string;
  bottomValue: number;
  topValue: number;
}

/** A UID must be seen this many consecutive times before it is offered for binding. */
const CONFIRM_SIGHTINGS = 3;

export function useCalibration(link: DeviceLink) {
  const [profile, setProfile] = useState<DiceProfile>(() => loadStoredProfile() ?? createProfile());
  const [phase, setPhase] = useState<PairingPhase>('idle');
  const [candidateUid, setCandidateUid] = useState<string | null>(null);
  const [result, setResult] = useState<PairingResult | null>(null);
  const [notice, setNotice] = useState<string>('');

  const sightingsRef = useRef<{ uid: string; count: number }>({ uid: '', count: 0 });

  useEffect(() => storeProfile(profile), [profile]);

  // Capture the UID of the tag lying on the reader. Only a single, stable UID
  // qualifies: with several tags in the field we cannot tell which one is down.
  useEffect(() => {
    if (phase !== 'waiting') return;

    const uids = link.presentUids;
    if (uids.length !== 1 || link.collision) {
      sightingsRef.current = { uid: '', count: 0 };
      return;
    }
    const uid = uids[0];
    const tracker = sightingsRef.current;
    sightingsRef.current =
      tracker.uid === uid ? { uid, count: tracker.count + 1 } : { uid, count: 1 };

    if (sightingsRef.current.count >= CONFIRM_SIGHTINGS) {
      setCandidateUid(uid);
      setPhase('awaitFace');
      setNotice('Klikni na stenu jadra, ktorá práve leží dole na čítačke.');
    }
  }, [phase, link.presentUids, link.collision]);

  const startPairing = useCallback(() => {
    sightingsRef.current = { uid: '', count: 0 };
    setCandidateUid(null);
    setResult(null);
    setPhase('waiting');
    setNotice('Polož kocku na čítačku. Čakám na jediný stabilný UID...');
  }, []);

  const cancelPairing = useCallback(() => {
    sightingsRef.current = { uid: '', count: 0 };
    setPhase('idle');
    setCandidateUid(null);
    setNotice('');
  }, []);

  /** Called by the 3D view when the user clicks a core face. */
  const assignFace = useCallback(
    (face: FaceId) => {
      if (phase !== 'awaitFace' || !candidateUid) {
        setNotice('Najprv spusť párovanie a polož kocku na čítačku.');
        return;
      }
      const bottomValue = faceValue(face);
      const topValue = topValueFromBottom(bottomValue);

      setProfile((previous) => {
        const next = bindFace(previous, face, candidateUid);
        return withRfSettings(next, {
          tunedPowerPct: link.dpc?.resultPct || link.powerPct,
          ceilingPct: link.dpc?.ceilingPct ?? next.rf.ceilingPct,
          lowEdgePct: link.dpc?.lowEdgePct ?? next.rf.lowEdgePct,
          firmware: link.hello?.version ?? next.rf.firmware,
        });
      });

      setResult({ face, uid: candidateUid, bottomValue, topValue });
      setPhase('done');
      setNotice(
        `UID ${candidateUid} = spodná stena ${bottomValue}, hore je teda ${topValue}.`,
      );
      setCandidateUid(null);
    },
    [phase, candidateUid, link.dpc, link.powerPct, link.hello],
  );

  const unbind = useCallback((face: FaceId) => {
    setProfile((previous) => unbindFace(previous, face));
  }, []);

  /**
   * Zapíše aktuálne rozmery do profilu. Porovnanie cez JSON drží identitu
   * objektu, keď sa nič nezmenilo, takže z toho nevznikne renderovacia smyčka.
   */
  const applyGeometry = useCallback((geometry: DiceGeometry) => {
    setProfile((previous) =>
      JSON.stringify(previous.geometry) === JSON.stringify(geometry)
        ? previous
        : withGeometry(previous, geometry),
    );
  }, []);

  const rename = useCallback((name: string) => {
    setProfile((previous) => renameProfile(previous, name));
  }, []);

  const resetProfile = useCallback(() => {
    setProfile(createProfile());
    setPhase('idle');
    setCandidateUid(null);
    setResult(null);
    setNotice('Profil vymazaný.');
  }, []);

  const exportProfile = useCallback(() => downloadProfile(profile), [profile]);

  const importProfile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      setProfile(parseProfile(text));
      setNotice(`Profil ${file.name} načítaný.`);
    } catch (error) {
      setNotice(`Import zlyhal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  /** UID -> face, so the 3D view can highlight an already known tag. */
  const uidToFace = useMemo(() => {
    const map = new Map<string, FaceId>();
    for (const binding of profile.bindings) map.set(binding.uid, binding.face);
    return map;
  }, [profile]);

  return {
    profile,
    phase,
    candidateUid,
    result,
    notice,
    complete: isComplete(profile),
    missing: missingFaces(profile),
    uidToFace,
    startPairing,
    cancelPairing,
    assignFace,
    applyGeometry,
    unbind,
    rename,
    resetProfile,
    exportProfile,
    importProfile,
  };
}

export type Calibration = ReturnType<typeof useCalibration>;

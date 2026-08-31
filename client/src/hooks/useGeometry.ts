import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_GEOMETRY,
  loadStoredGeometry,
  normalizeGeometry,
  storeGeometry,
  validateGeometry,
  wallMm,
  type DiceGeometry,
} from '../lib/hardware';

/** Rozmery kocky, tagu a plášťa. Ukladajú sa do localStorage aj do profilu. */
export function useGeometry() {
  const [geometry, setGeometry] = useState<DiceGeometry>(() => loadStoredGeometry());

  useEffect(() => storeGeometry(geometry), [geometry]);

  const patch = useCallback((changes: Partial<DiceGeometry>) => {
    setGeometry((previous) => normalizeGeometry({ ...previous, ...changes }));
  }, []);

  const reset = useCallback(() => setGeometry({ ...DEFAULT_GEOMETRY }), []);

  const issues = useMemo(() => validateGeometry(geometry), [geometry]);

  return {
    geometry,
    patch,
    reset,
    issues,
    wall: wallMm(geometry),
    isDefault:
      geometry.coreMm === DEFAULT_GEOMETRY.coreMm &&
      geometry.shellMm === DEFAULT_GEOMETRY.shellMm &&
      geometry.tagMm === DEFAULT_GEOMETRY.tagMm &&
      geometry.tagShape === DEFAULT_GEOMETRY.tagShape &&
      geometry.tagModel === DEFAULT_GEOMETRY.tagModel &&
      geometry.cornerRadiusMm === DEFAULT_GEOMETRY.cornerRadiusMm &&
      geometry.pipDepthMm === DEFAULT_GEOMETRY.pipDepthMm,
  };
}

export type GeometryState = ReturnType<typeof useGeometry>;

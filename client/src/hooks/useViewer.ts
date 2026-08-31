import { useCallback, useEffect, useState } from 'react';

export type ViewPreset = 'iso' | 'front' | 'top' | 'side';

export interface ViewerSettings {
  /** Automatická rotácia scény. */
  rotate: boolean;
  /** Rýchlosť rotácie (OrbitControls autoRotateSpeed). */
  speed: number;
  /** Strohý režim: plochý materiál, žiadne odlesky ani gradienty. */
  plain: boolean;
  /** Rozklad zostavy: 0 = zložené, 1 = plášť odtiahnutý od jadra. */
  explode: number;
  showCore: boolean;
  showShell: boolean;
  showTags: boolean;
  showPips: boolean;
  showField: boolean;
  showReader: boolean;
  showLabels: boolean;
  showAxes: boolean;
  view: ViewPreset;
}

export const DEFAULT_VIEWER: ViewerSettings = {
  rotate: true,
  speed: 0.6,
  plain: false,
  explode: 0,
  showCore: true,
  showShell: true,
  showTags: true,
  showPips: true,
  showField: true,
  showReader: true,
  showLabels: true,
  showAxes: false,
  view: 'iso',
};

const STORAGE_KEY = 'nfc-dice-debugger/viewer';

function load(): ViewerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VIEWER };
    const data = JSON.parse(raw) as Partial<ViewerSettings>;
    return { ...DEFAULT_VIEWER, ...data };
  } catch {
    return { ...DEFAULT_VIEWER };
  }
}

/** Nastavenia 3D náhľadu vrátane prepínania viditeľnosti jednotlivých dielov. */
export function useViewer() {
  const [settings, setSettings] = useState<ViewerSettings>(load);
  /** Zmena tohto čísla prinúti kameru znovu nabehnúť na preset. */
  const [cameraNonce, setCameraNonce] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Bez perzistencie, nastavenia platia do reloadu.
    }
    // Strohý režim vypína aj gradient na pozadí stránky (viď index.css).
    document.documentElement.dataset.plain = settings.plain ? 'true' : 'false';
  }, [settings]);

  const patch = useCallback((changes: Partial<ViewerSettings>) => {
    setSettings((previous) => ({ ...previous, ...changes }));
  }, []);

  const setView = useCallback((view: ViewPreset) => {
    setSettings((previous) => ({ ...previous, view }));
    setCameraNonce((value) => value + 1);
  }, []);

  const resetCamera = useCallback(() => setCameraNonce((value) => value + 1), []);

  const reset = useCallback(() => {
    setSettings({ ...DEFAULT_VIEWER });
    setCameraNonce((value) => value + 1);
  }, []);

  return { settings, patch, setView, resetCamera, reset, cameraNonce };
}

export type ViewerState = ReturnType<typeof useViewer>;

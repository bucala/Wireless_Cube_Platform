import { useEffect, useRef, useState } from 'react';

import type { DeviceLink } from '../hooks/useDeviceLink';
import { Metric } from './ui';

/** Derives a scan rate from the monotonically increasing counter in `state`. */
function useScanRate(scans: number | undefined, ts: number | undefined): number {
  const [rate, setRate] = useState(0);
  const previous = useRef<{ scans: number; ts: number } | null>(null);

  useEffect(() => {
    if (scans === undefined || ts === undefined) return;
    const last = previous.current;
    previous.current = { scans, ts };
    if (!last || ts <= last.ts) return;
    const deltaScans = scans - last.scans;
    const deltaSeconds = (ts - last.ts) / 1000;
    if (deltaScans < 0 || deltaSeconds <= 0) return;
    setRate(deltaScans / deltaSeconds);
  }, [scans, ts]);

  return rate;
}

export function StatsStrip({ link }: { link: DeviceLink }) {
  const state = link.deviceState;
  const scanRate = useScanRate(state?.stats?.scans, state?.ts);
  const tagCount = link.lastScan?.count ?? link.presentUids.length;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Metric
        label="Výkon"
        value={link.powerPct}
        unit="%"
        tone="accent"
        hint={state?.rf?.extAttenuator ? 'ext. atenuátor aktívny' : undefined}
      />
      <Metric
        label="Tagy v poli"
        value={tagCount}
        tone={tagCount > 1 ? 'bad' : tagCount === 1 ? 'ok' : 'idle'}
        hint={link.collision ? 'kolízia' : undefined}
      />
      <Metric label="AGC" value={link.lastScan?.agc ?? state?.agc ?? 0} hint="zaťaženie antény" />
      <Metric label="Sken/s" value={scanRate.toFixed(1)} />
      <Metric
        label="Kolízie"
        value={state?.stats?.collisions ?? 0}
        tone={(state?.stats?.collisions ?? 0) > 0 ? 'warn' : 'idle'}
      />
      <Metric
        label="Trvanie skenu"
        value={link.lastScan ? (link.lastScan.durationUs / 1000).toFixed(1) : '—'}
        unit="ms"
      />
    </div>
  );
}

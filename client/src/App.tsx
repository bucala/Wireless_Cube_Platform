import { useMemo, useState, type ReactNode } from 'react';

import { CalibrationPanel } from './components/CalibrationPanel';
import { ConnectionPanel } from './components/ConnectionPanel';
import { Header } from './components/Header';
import { PowerTuner } from './components/PowerTuner';
import { SimulatorPanel } from './components/SimulatorPanel';
import { StatsStrip } from './components/StatsStrip';
import { UidLogPanel } from './components/UidLogPanel';
import { Panel, Toggle } from './components/ui';
import { useCalibration } from './hooks/useCalibration';
import { useDeviceLink } from './hooks/useDeviceLink';
import { faceById, type FaceId } from './lib/dice';
import { DiceViewer } from './three/DiceViewer';

export default function App() {
  const link = useDeviceLink();
  const calibration = useCalibration(link);
  const [showLabels, setShowLabels] = useState(true);
  const [showField, setShowField] = useState(true);

  const bindings = useMemo(() => {
    const map = new Map<FaceId, string>();
    for (const binding of calibration.profile.bindings) map.set(binding.face, binding.uid);
    return map;
  }, [calibration.profile]);

  const activeUids = useMemo(() => new Set(link.presentUids), [link.presentUids]);

  // During an auto sweep the bottom tag is the one we must not lose: prefer an
  // already paired UID that is in the field, otherwise the single visible UID.
  const targetUid = useMemo(() => {
    const paired = link.presentUids.find((uid) => calibration.uidToFace.has(uid));
    if (paired) return paired;
    return link.presentUids.length === 1 ? link.presentUids[0] : null;
  }, [link.presentUids, calibration.uidToFace]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header link={link} />

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-12 xl:overflow-hidden">
        <div className="flex min-h-0 flex-col gap-4 xl:col-span-3 xl:overflow-y-auto xl:pr-1">
          <ConnectionPanel link={link} />
          {link.simulator && <SimulatorPanel sim={link.simulator} powerPct={link.powerPct} />}
          <CalibrationPanel link={link} calibration={calibration} />
        </div>

        <div className="flex min-h-0 flex-col gap-4 xl:col-span-6">
          <Panel
            title="3D koncept kocky"
            className="min-h-[24rem] flex-1"
            bodyClassName="relative min-h-0 flex-1 p-0"
            actions={
              <div className="flex items-center gap-3">
                <Toggle label="popisky" checked={showLabels} onChange={setShowLabels} />
                <Toggle label="pole" checked={showField} onChange={setShowField} />
              </div>
            }
          >
            <div className="absolute inset-0 overflow-hidden rounded-b-xl">
              <DiceViewer
                bindings={bindings}
                activeUids={activeUids}
                awaitingFace={calibration.phase === 'awaitFace'}
                onSelectFace={calibration.assignFace}
                powerPct={link.powerPct}
                collision={link.collision}
                showLabels={showLabels}
                showField={showField}
              />
            </div>

            {calibration.phase === 'awaitFace' && (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                <div className="rounded-full border border-signal-warn/40 bg-base-950/85 px-4 py-1.5 text-xs font-medium text-signal-warn shadow-glow backdrop-blur">
                  Klikni na stenu jadra, ktorá leží dole na čítačke
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute bottom-3 left-4 flex flex-wrap gap-3 text-[0.62rem] uppercase tracking-wider text-slate-500">
              <Legend color="#34d399">číta sa teraz</Legend>
              <Legend color="#0ea5e9">spárované</Legend>
              <Legend color="#fbbf24">čaká na výber</Legend>
              <Legend color="#334155">nespárované</Legend>
            </div>

            {calibration.result && (
              <div className="pointer-events-none absolute bottom-3 right-4 rounded-lg border border-white/10 bg-base-950/85 px-3 py-2 text-right font-mono text-[0.65rem] text-slate-300 backdrop-blur">
                <div className="text-accent">{faceById(calibration.result.face).label}</div>
                <div>
                  dole {calibration.result.bottomValue} → hore{' '}
                  <span className="text-signal-ok">{calibration.result.topValue}</span>
                </div>
              </div>
            )}
          </Panel>

          <PowerTuner link={link} targetUid={targetUid} />
        </div>

        <div className="flex min-h-0 flex-col gap-4 xl:col-span-3">
          <StatsStrip link={link} />
          <UidLogPanel link={link} uidToFace={calibration.uidToFace} />
        </div>
      </main>
    </div>
  );
}

function Legend({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

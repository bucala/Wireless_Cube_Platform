import { useEffect, useMemo, type ReactNode } from 'react';

import { CalibrationPanel } from './components/CalibrationPanel';
import { ConnectionPanel } from './components/ConnectionPanel';
import { GeometryPanel } from './components/GeometryPanel';
import { HardwarePanel } from './components/HardwarePanel';
import { Header } from './components/Header';
import { PowerTuner } from './components/PowerTuner';
import { SimulatorPanel } from './components/SimulatorPanel';
import { StatsStrip } from './components/StatsStrip';
import { UidLogPanel } from './components/UidLogPanel';
import { ViewerControls } from './components/ViewerControls';
import { Panel } from './components/ui';
import { useCalibration } from './hooks/useCalibration';
import { useDeviceLink } from './hooks/useDeviceLink';
import { useGeometry } from './hooks/useGeometry';
import { useSkin } from './hooks/useSkin';
import { useViewer } from './hooks/useViewer';
import { faceById, type FaceId } from './lib/dice';
import { DiceViewer } from './three/DiceViewer';

export default function App() {
  const link = useDeviceLink();
  const calibration = useCalibration(link);
  const geometryState = useGeometry();
  const viewer = useViewer();
  const skin = useSkin();

  const { geometry } = geometryState;
  const { applyGeometry } = calibration;

  // Rozmery držíme aj v profile, aby exportovaný JSON vedel, na akej kocke
  // bola kalibrácia nameraná.
  useEffect(() => {
    applyGeometry(geometry);
  }, [geometry, applyGeometry]);

  const bindings = useMemo(() => {
    const map = new Map<FaceId, string>();
    for (const binding of calibration.profile.bindings) map.set(binding.face, binding.uid);
    return map;
  }, [calibration.profile]);

  const activeUids = useMemo(() => new Set(link.presentUids), [link.presentUids]);

  // Počas auto sweepu nesmieme stratiť spodný tag: preferujeme už spárovaný UID
  // v poli, inak jediný viditeľný UID.
  const targetUid = useMemo(() => {
    const paired = link.presentUids.find((uid) => calibration.uidToFace.has(uid));
    if (paired) return paired;
    return link.presentUids.length === 1 ? link.presentUids[0] : null;
  }, [link.presentUids, calibration.uidToFace]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header link={link} geometry={geometry} skin={skin} />

      <main className="mx-auto w-full max-w-[1900px] flex-1 px-3 py-4 sm:px-4">
        {/* Jediný scrollovací kontejner je stránka. Panely nemajú vlastnú
            výšku ani vnútorný scroll, takže sa pri zmene okna nemôžu prekryť. */}
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-12">
          <section className="order-2 flex min-w-0 flex-col gap-4 2xl:order-1 2xl:col-span-3">
            <ConnectionPanel link={link} />
            {link.simulator && <SimulatorPanel sim={link.simulator} powerPct={link.powerPct} />}
            <CalibrationPanel link={link} calibration={calibration} />
          </section>

          <section className="order-1 flex min-w-0 flex-col gap-4 lg:col-span-2 2xl:order-2 2xl:col-span-6">
            <Panel
              title="3D koncept kocky"
              className="h-[min(58vh,40rem)] min-h-[22rem] overflow-hidden"
              bodyClassName="relative !p-0"
            >
              <div className="absolute inset-0 overflow-hidden">
                <DiceViewer
                  geometry={geometry}
                  scene={skin.skin.scene}
                  settings={viewer.settings}
                  cameraNonce={viewer.cameraNonce}
                  bindings={bindings}
                  activeUids={activeUids}
                  awaitingFace={calibration.phase === 'awaitFace'}
                  onSelectFace={calibration.assignFace}
                  powerPct={link.powerPct}
                  collision={link.collision}
                />
              </div>

              {calibration.phase === 'awaitFace' && (
                <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
                  <div className="rounded-full border border-signal-warn/40 bg-base-950/85 px-4 py-1.5 text-center text-xs font-medium text-signal-warn shadow-glow backdrop-blur">
                    Klikni na stenu jadra, ktorá leží dole na čítačke
                  </div>
                </div>
              )}

              <div className="pointer-events-none absolute bottom-3 left-4 flex flex-wrap gap-x-3 gap-y-1 text-[0.62rem] uppercase tracking-wider text-slate-500">
                <Legend color={skin.skin.scene.faceLive}>číta sa teraz</Legend>
                <Legend color={skin.skin.scene.faceBound}>spárované</Legend>
                <Legend color={skin.skin.scene.facePending}>čaká na výber</Legend>
                <Legend color={skin.skin.scene.faceUnbound}>nespárované</Legend>
              </div>

              {calibration.result && (
                <div className="pointer-events-none absolute bottom-3 right-4 rounded-lg border border-white/15 bg-base-950/85 px-3 py-2 text-right font-mono text-[0.65rem] text-slate-300 backdrop-blur">
                  <div className="text-accent">{faceById(calibration.result.face).label}</div>
                  <div>
                    dole {calibration.result.bottomValue} → hore{' '}
                    <span className="text-signal-ok">{calibration.result.topValue}</span>
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="Ovládanie náhľadu">
              <ViewerControls viewer={viewer} />
            </Panel>

            <PowerTuner link={link} targetUid={targetUid} />
          </section>

          <section className="order-3 flex min-w-0 flex-col gap-4 2xl:col-span-3">
            <StatsStrip link={link} />
            <GeometryPanel geometry={geometryState} />
            <HardwarePanel geometry={geometry} link={link} />
            <UidLogPanel link={link} uidToFace={calibration.uidToFace} />
          </section>
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

import { useRef, type ReactNode } from 'react';

import type { Calibration } from '../hooks/useCalibration';
import type { DeviceLink } from '../hooks/useDeviceLink';
import { FACES, faceById, topValueFromBottom } from '../lib/dice';
import { Chip, Panel, cx } from './ui';

export interface CalibrationPanelProps {
  link: DeviceLink;
  calibration: Calibration;
}

export function CalibrationPanel({ link, calibration }: CalibrationPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { profile, phase, candidateUid, result } = calibration;

  const boundCount = profile.bindings.length;
  const connected = link.status === 'connected';

  return (
    <Panel
      title="Kalibrácia a párovanie"
      actions={
        <Chip tone={calibration.complete ? 'ok' : boundCount > 0 ? 'accent' : 'idle'}>
          {boundCount}/6 stien
        </Chip>
      }
      bodyClassName="space-y-3 p-4"
    >
      <div>
        <label className="field-label" htmlFor="profile-name">
          Názov profilu
        </label>
        <input
          id="profile-name"
          className="input"
          value={profile.name}
          onChange={(event) => calibration.rename(event.target.value)}
          spellCheck={false}
        />
      </div>

      <ol className="space-y-1.5 text-[0.72rem] text-slate-400">
        <Step index={1} active={phase === 'idle'} done={phase !== 'idle'}>
          Doladiť výkon tak, aby čítačka videla iba spodný tag.
        </Step>
        <Step index={2} active={phase === 'waiting'} done={phase === 'awaitFace' || phase === 'done'}>
          Položiť kocku na čítačku a spustiť párovanie.
        </Step>
        <Step index={3} active={phase === 'awaitFace'} done={phase === 'done'}>
          Kliknúť na stenu jadra v 3D modeli, ktorá leží dole.
        </Step>
      </ol>

      <div
        className={cx(
          'rounded-lg border px-3 py-2.5 text-[0.72rem]',
          phase === 'awaitFace'
            ? 'border-signal-warn/40 bg-signal-warn/10 text-signal-warn'
            : phase === 'waiting'
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-white/5 bg-base-950/60 text-slate-400',
        )}
      >
        {calibration.notice || 'Párovanie nie je spustené.'}
        {candidateUid && (
          <div className="mt-1 font-mono text-[0.7rem] text-slate-200">UID {candidateUid}</div>
        )}
        {result && (
          <div className="mt-1 font-mono text-[0.7rem] text-slate-200">
            {result.uid} → dole {result.bottomValue}, hore {result.topValue}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {phase === 'idle' || phase === 'done' ? (
          <button
            type="button"
            className="btn-primary flex-1 px-3 py-1.5 text-xs"
            disabled={!connected}
            onClick={calibration.startPairing}
          >
            Spustiť párovanie steny
          </button>
        ) : (
          <button
            type="button"
            className="btn-danger flex-1 px-3 py-1.5 text-xs"
            onClick={calibration.cancelPairing}
          >
            Zrušiť párovanie
          </button>
        )}
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-xs"
          onClick={calibration.exportProfile}
        >
          Export JSON
        </button>
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-xs"
          onClick={() => fileRef.current?.click()}
        >
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void calibration.importProfile(file);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-xs text-slate-500"
          onClick={calibration.resetProfile}
        >
          Vymazať
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/5">
        <table className="w-full font-mono text-[0.68rem]">
          <thead className="bg-white/[0.03] text-[0.6rem] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Stena</th>
              <th className="px-2 py-1.5 text-left font-medium">Dole/Hore</th>
              <th className="px-2 py-1.5 text-left font-medium">UID</th>
              <th className="px-2 py-1.5 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {FACES.map((face) => {
              const binding = profile.bindings.find((entry) => entry.face === face.id);
              const live = binding ? link.presentUids.includes(binding.uid) : false;
              return (
                <tr
                  key={face.id}
                  className={cx(
                    'border-t border-white/5',
                    live && 'bg-signal-ok/10',
                  )}
                >
                  <td className="px-2 py-1.5 text-slate-400">{faceById(face.id).label}</td>
                  <td className="px-2 py-1.5 text-slate-300">
                    {face.value} / {topValueFromBottom(face.value)}
                  </td>
                  <td className="max-w-[9rem] truncate px-2 py-1.5">
                    {binding ? (
                      <span className={live ? 'text-signal-ok' : 'text-slate-200'}>
                        {binding.uid}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {binding && (
                      <button
                        type="button"
                        className="text-slate-600 transition hover:text-signal-bad"
                        onClick={() => calibration.unbind(face.id)}
                        title="Odpojiť UID od tejto steny"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[0.65rem]">
        <dt className="text-slate-500">Doladený výkon</dt>
        <dd className="text-right text-slate-300">
          {profile.rf.tunedPowerPct !== null ? `${profile.rf.tunedPowerPct} %` : '—'}
        </dd>
        <dt className="text-slate-500">Strop / dolná hrana</dt>
        <dd className="text-right text-slate-300">
          {profile.rf.ceilingPct ?? '—'} / {profile.rf.lowEdgePct ?? '—'}
        </dd>
        <dt className="text-slate-500">Aktualizované</dt>
        <dd className="text-right text-slate-300">
          {new Date(profile.updatedAt).toLocaleTimeString('sk-SK', { hour12: false })}
        </dd>
      </dl>
    </Panel>
  );
}

function Step({
  index,
  active,
  done,
  children,
}: {
  index: number;
  active: boolean;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={cx(
          'mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full border font-mono text-[0.6rem]',
          active
            ? 'border-accent bg-accent/20 text-accent'
            : done
              ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
              : 'border-white/10 text-slate-600',
        )}
      >
        {done && !active ? '✓' : index}
      </span>
      <span className={active ? 'text-slate-200' : undefined}>{children}</span>
    </li>
  );
}

import type { DeviceLink } from '../hooks/useDeviceLink';
import { dpcPhaseLabel } from '../lib/protocol';
import { Chip, Panel, Toggle, cx } from './ui';

const PRESETS = [
  { label: 'Min', value: 10 },
  { label: 'Nízky', value: 25 },
  { label: 'Stred', value: 55 },
  { label: 'Max', value: 100 },
];

export interface PowerTunerProps {
  link: DeviceLink;
  /** UID that should stay readable during an auto sweep (the bottom tag). */
  targetUid?: string | null;
}

export function PowerTuner({ link, targetUid }: PowerTunerProps) {
  const connected = link.status === 'connected';
  const dpc = link.dpc;
  const state = link.deviceState;
  const tagCount = link.lastScan?.count ?? link.presentUids.length;

  const tone = link.collision ? 'bad' : tagCount === 1 ? 'ok' : 'idle';
  const sampleProgress = dpc ? Math.min(1, dpc.samples / 6) : 0;

  return (
    <Panel
      title="Signal & DPC Tuner"
      actions={
        <div className="flex items-center gap-3">
          <Toggle
            label="RF pole"
            checked={state?.rfOn ?? false}
            disabled={!connected}
            onChange={link.setField}
          />
          <Toggle
            label="Skenovanie"
            checked={state?.scanning ?? false}
            disabled={!connected}
            onChange={link.setScanning}
          />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="field-label">Sila elektromagnetického poľa</div>
            <div className="flex items-baseline gap-2">
              <span
                className={cx(
                  'font-mono text-4xl font-semibold leading-none',
                  link.collision ? 'text-signal-bad' : 'text-accent',
                )}
              >
                {link.powerPct}
              </span>
              <span className="text-sm text-slate-500">% nominálneho poľa</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Chip tone={tone} pulse={link.collision}>
              {tagCount} {tagCount === 1 ? 'tag v poli' : 'tagov v poli'}
            </Chip>
            <span className="font-mono text-[0.65rem] text-slate-500">
              AGC {link.lastScan?.agc ?? state?.agc ?? 0} ·{' '}
              {state?.rf ? `CW ${state.rf.cwAmplitude} / RC ${state.rf.residualCarrier}` : '—'}
            </span>
          </div>
        </div>

        <div>
          <input
            type="range"
            className="dpc-slider"
            min={0}
            max={100}
            step={1}
            value={link.powerPct}
            disabled={!connected}
            onChange={(event) => link.setPower(Number(event.target.value))}
            aria-label="Sila poľa PN5180 v percentách"
          />
          <div className="relative mt-1 h-6">
            {[0, 25, 50, 75, 100].map((mark) => (
              <span
                key={mark}
                className="absolute -translate-x-1/2 font-mono text-[0.6rem] text-slate-600"
                style={{ left: `${mark}%` }}
              >
                {mark}
              </span>
            ))}
            {dpc && dpc.lowEdgePct > 0 && (
              <Marker value={dpc.lowEdgePct} color="#34d399" label="dolná hrana" />
            )}
            {dpc && dpc.ceilingPct > 0 && (
              <Marker value={dpc.ceilingPct} color="#fbbf24" label="strop" />
            )}
            {dpc && dpc.resultPct > 0 && (
              <Marker value={dpc.resultPct} color="#38bdf8" label="odporúčané" />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="btn-ghost px-2 py-1 text-xs"
              disabled={!connected}
              onClick={() => link.setPower(preset.value)}
            >
              {preset.label}
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-white/10" />
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-xs"
            disabled={!connected}
            onClick={() => link.setPower(link.powerPct - 1)}
          >
            −1 %
          </button>
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-xs"
            disabled={!connected}
            onClick={() => link.setPower(link.powerPct + 1)}
          >
            +1 %
          </button>
          <div className="flex-1" />
          {link.tuning ? (
            <button type="button" className="btn-danger px-3 py-1.5 text-xs" onClick={link.abortAutoTune}>
              Zastaviť DPC
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary px-3 py-1.5 text-xs"
              disabled={!connected}
              onClick={() => link.autoTune({ startPct: 100, targetUid: targetUid ?? undefined })}
              title="Automaticky zníži výkon, kým v poli nezostane jediný tag"
            >
              Auto-DPC sweep
            </button>
          )}
        </div>

        {link.collision && <CollisionWarning count={tagCount} powerPct={link.powerPct} />}

        <div className="rounded-lg border border-white/5 bg-base-950/60 p-3">
          <div className="flex items-center justify-between">
            <span className="field-label mb-0">Dynamic Power Control</span>
            <Chip
              tone={
                dpc?.phase === 'done'
                  ? 'ok'
                  : dpc?.phase === 'failed'
                    ? 'bad'
                    : link.tuning
                      ? 'accent'
                      : 'idle'
              }
              pulse={link.tuning}
            >
              {dpcPhaseLabel(dpc?.phase ?? 'idle')}
            </Chip>
          </div>

          <p className="mt-2 min-h-[1.25rem] text-[0.72rem] text-slate-400">
            {dpc?.note || 'Sweep spustíš tlačidlom Auto-DPC. Kocku najprv polož na čítačku.'}
          </p>

          <div className="mt-2 h-1 overflow-hidden rounded-full bg-base-700">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-150"
              style={{ width: `${sampleProgress * 100}%` }}
            />
          </div>

          <dl className="mt-3 grid grid-cols-4 gap-2 font-mono text-[0.65rem]">
            <Cell label="1 tag" value={dpc?.singleHits ?? 0} tone="text-signal-ok" />
            <Cell label="kolízie" value={dpc?.multiHits ?? 0} tone="text-signal-bad" />
            <Cell label="prázdne" value={dpc?.emptyHits ?? 0} tone="text-slate-400" />
            <Cell
              label="výsledok"
              value={dpc?.resultPct ? `${dpc.resultPct} %` : '—'}
              tone="text-accent"
            />
          </dl>
        </div>
      </div>
    </Panel>
  );
}

function Marker({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <span
      className="absolute top-[-0.9rem] h-2 w-px"
      style={{ left: `${value}%`, background: color }}
      title={`${label}: ${value} %`}
    />
  );
}

function Cell({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] px-2 py-1.5">
      <dt className="text-[0.58rem] uppercase tracking-wider text-slate-600">{label}</dt>
      <dd className={cx('mt-0.5', tone)}>{value}</dd>
    </div>
  );
}

export function CollisionWarning({ count, powerPct }: { count: number; powerPct: number }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-signal-bad/40 bg-signal-bad/10 px-3 py-2.5"
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-signal-bad/20 font-mono text-xs font-bold text-signal-bad">
        !
      </span>
      <div>
        <p className="text-sm font-semibold text-signal-bad">
          Príliš vysoký výkon – detegované bočné steny
        </p>
        <p className="mt-0.5 text-[0.72rem] text-signal-bad/80">
          V poli je {count} UID pri {powerPct} %. Zníž výkon, kým nezostane iba tag na
          spodnej stene (0 mm), inak nevieš určiť, ktorá stena leží dole.
        </p>
      </div>
    </div>
  );
}

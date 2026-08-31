import type { GeometryState } from '../hooks/useGeometry';
import { tagDistancesMm } from '../lib/dice';
import {
  GEOMETRY_LIMITS,
  TAG_MODELS,
  TAG_SHAPES,
  coreDiagonalMm,
  type TagShape,
} from '../lib/hardware';
import { NumberField, Panel, Segmented, SliderRow, cx, type SegmentedOption } from './ui';

const SHAPE_OPTIONS: ReadonlyArray<SegmentedOption<TagShape>> = TAG_SHAPES.map((shape) => ({
  value: shape.id,
  label: shape.label,
}));

/** Kompletná definícia rozmerov kocky, jadra a tagu. */
export function GeometryPanel({ geometry: state }: { geometry: GeometryState }) {
  const { geometry, patch, reset, issues, wall, isDefault } = state;
  const distances = tagDistancesMm('ny', geometry);

  return (
    <Panel
      title="Rozmery a zostava"
      actions={
        <button
          type="button"
          className="btn-ghost px-2 py-1 text-[0.7rem]"
          disabled={isDefault}
          onClick={reset}
          title="Späť na 8 / 12 / 5 mm"
        >
          Výrobný default
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Jadro (hrana)"
            value={geometry.coreMm}
            min={GEOMETRY_LIMITS.coreMm.min}
            max={GEOMETRY_LIMITS.coreMm.max}
            step={GEOMETRY_LIMITS.coreMm.step}
            unit="mm"
            onChange={(coreMm) => patch({ coreMm })}
          />
          <NumberField
            label="Kocka (hrana)"
            value={geometry.shellMm}
            min={GEOMETRY_LIMITS.shellMm.min}
            max={GEOMETRY_LIMITS.shellMm.max}
            step={GEOMETRY_LIMITS.shellMm.step}
            unit="mm"
            onChange={(shellMm) => patch({ shellMm })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={geometry.tagShape === 'square' ? 'TAG (hrana)' : 'TAG (priemer)'}
            value={geometry.tagMm}
            min={GEOMETRY_LIMITS.tagMm.min}
            max={GEOMETRY_LIMITS.tagMm.max}
            step={GEOMETRY_LIMITS.tagMm.step}
            unit="mm"
            onChange={(tagMm) => patch({ tagMm })}
          />
          <label className="block">
            <span className="field-label">Model TAGu</span>
            <input
              className="input"
              value={geometry.tagModel}
              onChange={(event) => patch({ tagModel: event.target.value })}
              aria-label="Model TAGu"
            />
          </label>
        </div>

        <div>
          <span className="field-label">Tvar TAGu</span>
          <Segmented
            options={SHAPE_OPTIONS}
            value={geometry.tagShape}
            onChange={(tagShape) => patch({ tagShape })}
          />
        </div>

        <div>
          <span className="field-label">Rýchla voľba inlayu</span>
          <div className="flex flex-wrap gap-1.5">
            {TAG_MODELS.map((preset) => {
              const active =
                preset.model === geometry.tagModel &&
                preset.sizeMm === geometry.tagMm &&
                preset.shape === geometry.tagShape;
              return (
                <button
                  key={`${preset.model}-${preset.sizeMm}-${preset.shape}`}
                  type="button"
                  className={cx(
                    'chip transition',
                    active
                      ? 'border-accent/40 bg-accent/15 text-accent'
                      : 'border-white/15 bg-white/[0.03] text-slate-400 hover:text-slate-200',
                  )}
                  title={preset.note}
                  onClick={() =>
                    patch({
                      tagModel: preset.model,
                      tagMm: preset.sizeMm,
                      tagShape: preset.shape,
                    })
                  }
                >
                  {preset.model} {preset.sizeMm} mm
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <SliderRow
            label="Zaoblenie hrán"
            value={geometry.cornerRadiusMm}
            min={GEOMETRY_LIMITS.cornerRadiusMm.min}
            max={GEOMETRY_LIMITS.cornerRadiusMm.max}
            step={GEOMETRY_LIMITS.cornerRadiusMm.step}
            unit="mm"
            onChange={(cornerRadiusMm) => patch({ cornerRadiusMm })}
          />
          <SliderRow
            label="Hĺbka bodiek"
            value={geometry.pipDepthMm}
            min={GEOMETRY_LIMITS.pipDepthMm.min}
            max={GEOMETRY_LIMITS.pipDepthMm.max}
            step={GEOMETRY_LIMITS.pipDepthMm.step}
            unit="mm"
            onChange={(pipDepthMm) => patch({ pipDepthMm })}
          />
        </div>

        <dl className="grid grid-cols-3 gap-2 font-mono text-[0.68rem]">
          <Derived label="plášť" value={`${wall.toFixed(2)} mm`} />
          <Derived label="diagonála jadra" value={`${coreDiagonalMm(geometry).toFixed(2)} mm`} />
          <Derived label="TAG / stena" value={`${((geometry.tagMm / geometry.coreMm) * 100).toFixed(0)} %`} />
          <Derived label="dole" value={`${distances.ny} mm`} tone="text-signal-ok" />
          <Derived label="bok" value={`${distances.px} mm`} tone="text-signal-warn" />
          <Derived label="hore" value={`${distances.py} mm`} tone="text-accent" />
        </dl>

        {issues.length > 0 && (
          <ul className="space-y-1.5">
            {issues.map((issue) => (
              <li
                key={issue.text}
                className={cx(
                  'flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[0.7rem]',
                  issue.level === 'error'
                    ? 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad'
                    : 'border-signal-warn/40 bg-signal-warn/10 text-signal-warn',
                )}
              >
                <span className="font-mono font-bold">{issue.level === 'error' ? '!' : '?'}</span>
                {issue.text}
              </li>
            ))}
          </ul>
        )}

        <p className="text-[0.65rem] leading-relaxed text-slate-600">
          Rozmery sa ukladajú do prehliadača a zapisujú sa aj do kalibračného profilu, takže
          exportovaný JSON vždy vie, na akej kocke bol nameraný.
        </p>
      </div>
    </Panel>
  );
}

function Derived({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-base-950/60 px-2 py-1.5">
      <dt className="text-[0.56rem] uppercase tracking-wider text-slate-600">{label}</dt>
      <dd className={cx('mt-0.5', tone ?? 'text-slate-200')}>{value}</dd>
    </div>
  );
}

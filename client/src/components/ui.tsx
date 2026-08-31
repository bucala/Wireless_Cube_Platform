import type { ReactNode } from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx('panel flex min-h-0 flex-col', className)}>
      {(title || actions) && (
        <header className="panel-header">
          <h2 className="panel-title">{title}</h2>
          {actions}
        </header>
      )}
      <div className={cx('min-h-0 flex-1 p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export type Tone = 'ok' | 'warn' | 'bad' | 'idle' | 'accent';

const TONE_CLASS: Record<Tone, string> = {
  ok: 'border-signal-ok/30 bg-signal-ok/10 text-signal-ok',
  warn: 'border-signal-warn/30 bg-signal-warn/10 text-signal-warn',
  bad: 'border-signal-bad/30 bg-signal-bad/10 text-signal-bad',
  accent: 'border-accent/30 bg-accent/10 text-accent',
  idle: 'border-white/10 bg-white/[0.03] text-slate-400',
};

export function Chip({
  tone = 'idle',
  children,
  pulse,
}: {
  tone?: Tone;
  children: ReactNode;
  pulse?: boolean;
}) {
  return (
    <span className={cx('chip', TONE_CLASS[tone])}>
      <span
        className={cx(
          'h-1.5 w-1.5 rounded-full bg-current',
          pulse && 'animate-pulse-slow',
        )}
      />
      {children}
    </span>
  );
}

export function Metric({
  label,
  value,
  unit,
  tone = 'idle',
  hint,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: Tone;
  hint?: string;
}) {
  const valueTone =
    tone === 'ok'
      ? 'text-signal-ok'
      : tone === 'warn'
        ? 'text-signal-warn'
        : tone === 'bad'
          ? 'text-signal-bad'
          : tone === 'accent'
            ? 'text-accent'
            : 'text-slate-100';

  return (
    <div className="rounded-lg border border-white/5 bg-base-950/60 px-3 py-2">
      <div className="text-[0.62rem] font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className={cx('mt-1 font-mono text-lg leading-none', valueTone)}>
        {value}
        {unit && <span className="ml-1 text-xs text-slate-500">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[0.62rem] text-slate-600">{hint}</div>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'inline-flex items-center gap-2 text-xs font-medium transition disabled:opacity-40',
        checked ? 'text-slate-200' : 'text-slate-500',
      )}
    >
      <span
        className={cx(
          'relative h-4 w-8 rounded-full transition',
          checked ? 'bg-accent/70' : 'bg-base-700',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all',
            checked ? 'left-4' : 'left-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

/**
 * Kompaktný prepínač vo forme čipu. Pri ôsmich prepínačoch v jednom riadku sa
 * číta lepšie než klasický switch a zabalí sa do viacerých riadkov.
 */
export function ToggleChip({
  checked,
  onChange,
  label,
  disabled,
  title,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title ?? label}
      onClick={() => onChange(!checked)}
      className={cx(
        'chip transition disabled:cursor-not-allowed disabled:opacity-40',
        checked
          ? 'border-accent/40 bg-accent/15 text-accent'
          : 'border-white/15 bg-white/[0.03] text-slate-500 hover:text-slate-300',
      )}
    >
      <span
        className={cx(
          'h-1.5 w-1.5 rounded-full',
          checked ? 'bg-current' : 'bg-slate-600',
        )}
      />
      {label}
    </button>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="seg" role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          title={option.title ?? option.label}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cx('seg-item', option.value === value && 'seg-item-active')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Popis + slider + číselná hodnota v jednom riadku. */
export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="field-label mb-0">{label}</span>
        <span className="font-mono text-xs text-slate-300">
          {value}
          {unit && <span className="ml-0.5 text-slate-500">{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        className="thin-slider mt-1"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint && <p className="text-[0.62rem] text-slate-600">{hint}</p>}
    </div>
  );
}

/** Číselné pole s jednotkou pre presné zadanie rozmeru. */
export function NumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <span className="relative block">
        <input
          type="number"
          className="input pr-9"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[0.65rem] text-slate-500">
            {unit}
          </span>
        )}
      </span>
    </label>
  );
}

/** Riadok tabuľky špecifikácií (hardvér, pinout). */
export function SpecItem({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-1.5 last:border-0">
      <span className="text-[0.68rem] uppercase tracking-wider text-slate-500">{label}</span>
      <span className="min-w-0 text-right">
        <span className="block break-words font-mono text-[0.72rem] text-slate-200">{value}</span>
        {note && <span className="block text-[0.6rem] text-slate-600">{note}</span>}
      </span>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-8 text-center text-xs text-slate-600">
      {children}
    </div>
  );
}

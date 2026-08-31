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

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-8 text-center text-xs text-slate-600">
      {children}
    </div>
  );
}

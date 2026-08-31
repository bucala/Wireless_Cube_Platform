import { useEffect, useMemo, useRef, useState } from 'react';

import type { DeviceLink, LogEntry } from '../hooks/useDeviceLink';
import type { FaceId } from '../lib/dice';
import { faceById } from '../lib/dice';
import { Chip, EmptyState, Panel, Toggle, cx } from './ui';

const KIND_META: Record<LogEntry['kind'], { label: string; className: string }> = {
  found: { label: 'FOUND', className: 'text-signal-ok' },
  lost: { label: 'LOST', className: 'text-slate-500' },
  collision: { label: 'COLL', className: 'text-signal-bad' },
  dpc: { label: 'DPC', className: 'text-accent' },
  ack: { label: 'ERR', className: 'text-signal-bad' },
  log: { label: 'LOG', className: 'text-slate-400' },
};

export interface UidLogPanelProps {
  link: DeviceLink;
  /** Known UID -> face, so the log can annotate already paired tags. */
  uidToFace: Map<string, FaceId>;
}

export function UidLogPanel({ link, uidToFace }: UidLogPanelProps) {
  const [onlyTags, setOnlyTags] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(
    () => (onlyTags ? link.log.filter((entry) => entry.uid) : link.log),
    [link.log, onlyTags],
  );

  useEffect(() => {
    if (!autoScroll) return;
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [entries.length, autoScroll]);

  return (
    <Panel
      title="Live log UID"
      className="min-h-[18rem]"
      bodyClassName="flex min-h-0 flex-col gap-3 p-0"
      actions={
        <div className="flex items-center gap-3">
          <Toggle label="len tagy" checked={onlyTags} onChange={setOnlyTags} />
          <Toggle label="auto-scroll" checked={autoScroll} onChange={setAutoScroll} />
          <button type="button" className="btn-ghost px-2 py-1 text-[0.7rem]" onClick={link.clearLog}>
            Vyčistiť
          </button>
        </div>
      }
    >
      <div className="border-b border-white/5 px-4 py-3">
        <div className="field-label">Aktuálne v poli</div>
        {link.presentUids.length === 0 ? (
          <p className="font-mono text-[0.7rem] text-slate-600">
            žiadny tag – polož kocku na čítačku
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {link.presentUids.map((uid) => {
              const face = uidToFace.get(uid);
              return (
                <li key={uid}>
                  <Chip tone={face ? 'ok' : 'accent'}>
                    <span className="font-mono normal-case">{uid}</span>
                    {face && (
                      <span className="text-[0.6rem] text-slate-400">
                        {faceById(face).value}
                      </span>
                    )}
                  </Chip>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {entries.length === 0 ? (
          <EmptyState>Log je prázdny. Pripoj sa k zariadeniu a polož kocku na čítačku.</EmptyState>
        ) : (
          <ol className="space-y-0.5 font-mono text-[0.7rem]">
            {entries.map((entry) => {
              const meta = KIND_META[entry.kind];
              const face = entry.uid ? uidToFace.get(entry.uid) : undefined;
              return (
                <li key={entry.id} className="flex items-baseline gap-2 py-0.5">
                  <span className="w-[4.5rem] shrink-0 text-slate-600">
                    {formatTime(entry.ts)}
                  </span>
                  <span className={cx('w-11 shrink-0 font-semibold', meta.className)}>
                    {meta.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-300">
                    {entry.uid ?? entry.message}
                    {entry.uid && face && (
                      <span className="ml-2 text-slate-500">
                        stena {faceById(face).value}
                      </span>
                    )}
                    {entry.uid && entry.message && (
                      <span className="ml-2 text-slate-500">{entry.message}</span>
                    )}
                  </span>
                  {entry.powerPct !== undefined && (
                    <span className="shrink-0 text-slate-600">{entry.powerPct} %</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Panel>
  );
}

function formatTime(ts: number): string {
  // Device timestamps are millis() since boot; host timestamps are epoch.
  if (ts < 1_000_000_000_000) {
    const seconds = ts / 1000;
    return `+${seconds.toFixed(2)}s`;
  }
  const date = new Date(ts);
  return date.toLocaleTimeString('sk-SK', { hour12: false });
}

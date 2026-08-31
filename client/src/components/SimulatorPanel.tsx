import { useEffect, useState } from 'react';

import type { SimController } from '../lib/transports/simTransport';
import { FACES } from '../lib/dice';
import { Panel, Toggle, cx } from './ui';

/**
 * Control surface for the offline simulator: place a virtual dice on the virtual
 * reader and choose which face rests on the antenna. Lets the whole pairing and
 * DPC workflow be exercised (and demoed) without hardware.
 */
export function SimulatorPanel({ sim, powerPct }: { sim: SimController; powerPct: number }) {
  const [, forceRender] = useState(0);

  useEffect(() => sim.subscribe(() => forceRender((n) => n + 1)), [sim]);

  const bottom = sim.bottomFace();

  return (
    <Panel
      title="Simulátor kocky"
      actions={
        <Toggle
          label="na čítačke"
          checked={sim.isPlaced()}
          onChange={(value) => sim.setPlaced(value)}
        />
      }
      bodyClassName="space-y-3 p-4"
    >
      <div>
        <div className="field-label">Ktorá stena leží dole</div>
        <div className="grid grid-cols-3 gap-1.5">
          {FACES.map((face) => (
            <button
              key={face.id}
              type="button"
              onClick={() => sim.setBottomFace(face.id)}
              className={cx(
                'rounded-lg border px-2 py-1.5 font-mono text-xs transition',
                bottom === face.id
                  ? 'border-accent/60 bg-accent/10 text-accent'
                  : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.06]',
              )}
              title={face.label}
            >
              {face.value}
            </button>
          ))}
        </div>
      </div>

      <table className="w-full font-mono text-[0.65rem]">
        <thead className="text-[0.58rem] uppercase tracking-wider text-slate-600">
          <tr>
            <th className="text-left font-medium">Stena</th>
            <th className="text-left font-medium">Prah</th>
            <th className="text-left font-medium">UID</th>
          </tr>
        </thead>
        <tbody>
          {FACES.map((face) => {
            const threshold = sim.thresholdFor(face.id);
            const readable = sim.isPlaced() && powerPct >= threshold;
            return (
              <tr key={face.id} className="border-t border-white/5">
                <td className="py-1 text-slate-400">
                  {face.value}
                  {face.id === bottom && <span className="ml-1 text-accent">↓</span>}
                </td>
                <td className={cx('py-1', readable ? 'text-signal-ok' : 'text-slate-600')}>
                  {threshold} %
                </td>
                <td className="py-1 text-slate-500">{sim.uidFor(face.id).slice(-5)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="text-[0.66rem] leading-relaxed text-slate-600">
        Prah = sila poľa, pri ktorej tag začne odpovedať. Spodný tag (0 mm) číta už pri 16 %,
        bočné steny (4–5 mm) nad ~54 %, vrchná stena až nad 84 %.
      </p>
    </Panel>
  );
}

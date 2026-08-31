import { useEffect, useState, type FormEvent } from 'react';

import type { DeviceLink } from '../hooks/useDeviceLink';
import { normalizeWsUrl } from '../lib/protocol';
import { isWebSerialSupported } from '../lib/transports/serialTransport';
import type { TransportKind } from '../lib/transports/types';
import { Chip, Panel, cx, type Tone } from './ui';

const ADDRESS_KEY = 'nfc-dice-debugger/address';

const STATUS_TONE: Record<string, Tone> = {
  connected: 'ok',
  connecting: 'warn',
  disconnected: 'idle',
  error: 'bad',
};

const STATUS_LABEL: Record<string, string> = {
  connected: 'Pripojené',
  connecting: 'Pripájam',
  disconnected: 'Odpojené',
  error: 'Chyba',
};

const TRANSPORTS: Array<{ kind: TransportKind; label: string; hint: string }> = [
  { kind: 'ws', label: 'WebSocket', hint: 'ESP32 na Wi-Fi' },
  { kind: 'serial', label: 'Web Serial', hint: 'USB / COM port' },
  { kind: 'sim', label: 'Simulátor', hint: 'bez hardvéru' },
];

export function ConnectionPanel({ link }: { link: DeviceLink }) {
  const [kind, setKind] = useState<TransportKind>('ws');
  const [address, setAddress] = useState(
    () => localStorage.getItem(ADDRESS_KEY) ?? '192.168.1.50',
  );

  useEffect(() => {
    localStorage.setItem(ADDRESS_KEY, address);
  }, [address]);

  const connected = link.status === 'connected';
  const busy = link.status === 'connecting';
  const serialAvailable = isWebSerialSupported();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (connected || busy) {
      link.disconnect();
      return;
    }
    void link.connect({ kind, address });
  };

  return (
    <Panel
      title="Pripojenie"
      actions={
        <Chip tone={STATUS_TONE[link.status]} pulse={busy}>
          {STATUS_LABEL[link.status]}
        </Chip>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-1.5">
          {TRANSPORTS.map((option) => {
            const disabled = option.kind === 'serial' && !serialAvailable;
            const active = kind === option.kind;
            return (
              <button
                key={option.kind}
                type="button"
                disabled={disabled || connected || busy}
                onClick={() => setKind(option.kind)}
                title={
                  disabled
                    ? 'Web Serial API podporuje len Chromium (Chrome, Edge)'
                    : option.hint
                }
                className={cx(
                  'rounded-lg border px-2 py-2 text-left transition disabled:opacity-40',
                  active
                    ? 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]',
                )}
              >
                <div className="text-xs font-semibold">{option.label}</div>
                <div className="mt-0.5 text-[0.6rem] uppercase tracking-wider text-slate-600">
                  {option.hint}
                </div>
              </button>
            );
          })}
        </div>

        {kind === 'ws' && (
          <div>
            <label className="field-label" htmlFor="device-address">
              IP adresa alebo ws:// URL
            </label>
            <input
              id="device-address"
              className="input"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="192.168.1.50 alebo nfc-dice.local"
              spellCheck={false}
              disabled={connected || busy}
            />
            <p className="mt-1 font-mono text-[0.62rem] text-slate-600">
              → {normalizeWsUrl(address) || 'ws://…/ws'}
            </p>
          </div>
        )}

        {kind === 'serial' && (
          <p className="rounded-lg border border-white/5 bg-base-950/60 px-3 py-2 text-[0.7rem] leading-relaxed text-slate-500">
            Po kliknutí na <span className="text-slate-300">Pripojiť</span> vyber COM port
            ESP32-S3. Firmware zrkadlí ten istý JSON protokol na USB CDC.
          </p>
        )}

        {kind === 'sim' && (
          <p className="rounded-lg border border-white/5 bg-base-950/60 px-3 py-2 text-[0.7rem] leading-relaxed text-slate-500">
            Simulovaná kocka so šiestimi NTAG213 tagmi a modelom poľa. Slúži na skúšanie
            UI, DPC sweepu a párovania bez hardvéru.
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className={connected || busy ? 'btn-danger flex-1' : 'btn-primary flex-1'}
          >
            {connected || busy ? 'Odpojiť' : 'Pripojiť'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={!connected}
            onClick={() => link.resetReader()}
            title="Hardvérový reset PN5180 a reinicializácia RF konfigurácie"
          >
            Reset čítačky
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/5 pt-3 font-mono text-[0.68rem]">
          <dt className="text-slate-500">Peer</dt>
          <dd className="truncate text-right text-slate-300" title={link.label}>
            {link.label || '—'}
          </dd>
          <dt className="text-slate-500">Firmware</dt>
          <dd className="text-right text-slate-300">
            {link.hello ? `${link.hello.fw} ${link.hello.version}` : '—'}
          </dd>
          <dt className="text-slate-500">PN5180</dt>
          <dd className="text-right">
            {link.hello?.reader ? (
              link.hello.reader.ok ? (
                <span className="text-signal-ok">
                  ok · 0x{(link.hello.reader.product ?? 0).toString(16)}
                </span>
              ) : (
                <span className="text-signal-bad">{link.hello.reader.error ?? 'chyba'}</span>
              )
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </dd>
          <dt className="text-slate-500">RSSI / heap</dt>
          <dd className="text-right text-slate-300">
            {link.deviceState
              ? `${link.deviceState.rssi ?? 0} dBm · ${Math.round((link.deviceState.heap ?? 0) / 1024)} kB`
              : '—'}
          </dd>
        </dl>

        {link.statusDetail && link.status === 'error' && (
          <p className="text-[0.7rem] text-signal-bad">{link.statusDetail}</p>
        )}
      </form>
    </Panel>
  );
}

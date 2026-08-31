import type { DeviceLink } from '../hooks/useDeviceLink';
import { CORE_SIZE_MM, SHELL_SIZE_MM, TAG_DIAMETER_MM } from '../lib/dice';
import { Chip } from './ui';

export function Header({ link }: { link: DeviceLink }) {
  const connected = link.status === 'connected';

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-base-900/60 px-5 py-3 backdrop-blur">
      <div className="flex items-baseline gap-3">
        <h1 className="text-base font-semibold tracking-tight text-slate-100">
          NFC Dice <span className="text-accent">Debugger</span>
        </h1>
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-600">
          ESP32-S3 · PN5180 · NTAG213
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="idle">
          jadro {CORE_SIZE_MM} mm · obal {SHELL_SIZE_MM} mm · tag {TAG_DIAMETER_MM} mm
        </Chip>
        <Chip tone={connected ? 'ok' : link.status === 'error' ? 'bad' : 'idle'} pulse={connected}>
          {link.kind === 'sim' ? 'simulátor' : link.kind === 'serial' ? 'usb' : 'websocket'}
        </Chip>
        {link.deviceState && !link.deviceState.readerOk && <Chip tone="bad">PN5180 chyba</Chip>}
      </div>
    </header>
  );
}

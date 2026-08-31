import type { DeviceLink } from '../hooks/useDeviceLink';
import type { SkinState } from '../hooks/useSkin';
import type { DiceGeometry } from '../lib/hardware';
import { SKINS, SKIN_ORDER, type SkinId } from '../lib/skins';
import { Chip, Segmented, type SegmentedOption } from './ui';

const SKIN_OPTIONS: ReadonlyArray<SegmentedOption<SkinId>> = SKIN_ORDER.map((id) => ({
  value: id,
  label: SKINS[id].label,
  title: SKINS[id].note,
}));

export function Header({
  link,
  geometry,
  skin,
}: {
  link: DeviceLink;
  geometry: DiceGeometry;
  skin: SkinState;
}) {
  const connected = link.status === 'connected';

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-base-900/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1900px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-base font-semibold tracking-tight text-slate-100">
            NFC Dice <span className="text-accent">Debugger</span>
          </h1>
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">
            ESP32-S3 · PN5180 · {geometry.tagModel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="idle">
            {geometry.coreMm} / {geometry.shellMm} / {geometry.tagMm} mm
          </Chip>
          <Chip tone={connected ? 'ok' : link.status === 'error' ? 'bad' : 'idle'} pulse={connected}>
            {link.kind === 'sim' ? 'simulátor' : link.kind === 'serial' ? 'usb' : 'websocket'}
          </Chip>
          {link.deviceState && !link.deviceState.readerOk && <Chip tone="bad">PN5180 chyba</Chip>}
          <Segmented options={SKIN_OPTIONS} value={skin.skinId} onChange={skin.setSkin} />
        </div>
      </div>
    </header>
  );
}

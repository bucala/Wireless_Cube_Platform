import { useState } from 'react';

import type { DeviceLink } from '../hooks/useDeviceLink';
import { MCU_SPEC, PIN_MAP, READER_SPEC, tagSpec, type DiceGeometry } from '../lib/hardware';
import { Panel, Segmented, SpecItem, type SegmentedOption } from './ui';

type Section = 'mcu' | 'reader' | 'tag' | 'pins';

const SECTIONS: ReadonlyArray<SegmentedOption<Section>> = [
  { value: 'mcu', label: 'MCU' },
  { value: 'reader', label: 'Čítačka' },
  { value: 'tag', label: 'TAG' },
  { value: 'pins', label: 'Pinout' },
];

/** Špecifikácia zostavy vrátane pinov; hodnoty zrkadlia firmware/config.h. */
export function HardwarePanel({
  geometry,
  link,
}: {
  geometry: DiceGeometry;
  link: DeviceLink;
}) {
  const [section, setSection] = useState<Section>('mcu');
  const hello = link.hello;

  return (
    <Panel
      title="Hardvér"
      actions={<Segmented options={SECTIONS} value={section} onChange={setSection} />}
    >
      {section === 'mcu' && (
        <div>
          {MCU_SPEC.map((row) => (
            <SpecItem key={row.label} label={row.label} value={row.value} note={row.note} />
          ))}
          {hello && (
            <SpecItem
              label="Hlásený čip"
              value={hello.chip ?? '—'}
              note={`firmware ${hello.version} · protokol ${hello.proto}`}
            />
          )}
        </div>
      )}

      {section === 'reader' && (
        <div>
          {READER_SPEC.map((row) => (
            <SpecItem key={row.label} label={row.label} value={row.value} note={row.note} />
          ))}
          {link.deviceState?.rf && (
            <SpecItem
              label="Aktuálne TX"
              value={`CW ${link.deviceState.rf.cwAmplitude} / RC ${link.deviceState.rf.residualCarrier}`}
              note={`${link.powerPct} % nominálneho poľa`}
            />
          )}
        </div>
      )}

      {section === 'tag' && (
        <div>
          {tagSpec(geometry).map((row) => (
            <SpecItem key={row.label} label={row.label} value={row.value} note={row.note} />
          ))}
        </div>
      )}

      {section === 'pins' && (
        <div>
          <div className="mb-2 text-[0.65rem] text-slate-600">
            PN5180 na hardvérovom SPI (FSPI / SPI2_HOST), 7 MHz.
          </div>
          {PIN_MAP.map((pin) => (
            <SpecItem
              key={pin.signal}
              label={pin.signal}
              value={`GPIO ${pin.gpio}`}
              note={pin.note}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

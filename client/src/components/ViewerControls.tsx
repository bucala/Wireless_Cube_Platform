import type { ReactNode } from 'react';

import type { ViewPreset, ViewerState } from '../hooks/useViewer';
import { Segmented, SliderRow, ToggleChip, type SegmentedOption } from './ui';

const VIEWS: ReadonlyArray<SegmentedOption<ViewPreset>> = [
  { value: 'iso', label: 'ISO', title: 'izometrický pohľad' },
  { value: 'front', label: 'Predok', title: 'pohľad na prednú stenu' },
  { value: 'top', label: 'Vrch', title: 'pohľad zhora' },
  { value: 'side', label: 'Bok', title: 'pohľad z pravého boku' },
];

/** Ovládanie 3D náhľadu rozdelené podľa účelu. */
export function ViewerControls({ viewer }: { viewer: ViewerState }) {
  const { settings, patch, setView, resetCamera, reset } = viewer;

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <ControlGroup title="Kamera a pohyb">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ghost px-2.5 py-1.5 text-xs"
            aria-pressed={settings.rotate}
            onClick={() => patch({ rotate: !settings.rotate })}
          >
            {settings.rotate ? 'Pozastaviť' : 'Spustiť rotáciu'}
          </button>
          <button
            type="button"
            className="btn-ghost px-2.5 py-1.5 text-xs"
            onClick={resetCamera}
          >
            Vycentrovať
          </button>
        </div>
        <Segmented options={VIEWS} value={settings.view} onChange={setView} />
        <SliderRow
          label="Rýchlosť rotácie"
          value={Number(settings.speed.toFixed(1))}
          min={0.1}
          max={4}
          step={0.1}
          unit="×"
          disabled={!settings.rotate}
          onChange={(value) => patch({ speed: value })}
        />
      </ControlGroup>

      <ControlGroup title="Časti modelu">
        <div className="flex flex-wrap gap-1.5">
          <ToggleChip label="jadro" checked={settings.showCore} onChange={(value) => patch({ showCore: value })} title="Nepriehľadné vnútorné jadro" />
          <ToggleChip label="plášť" checked={settings.showShell} onChange={(value) => patch({ showShell: value })} title="Vonkajší sklenený plášť" />
          <ToggleChip label="TAG" checked={settings.showTags} onChange={(value) => patch({ showTags: value })} title="NFC tagy na stenách jadra" />
          <ToggleChip label="bodky" checked={settings.showPips} onChange={(value) => patch({ showPips: value })} title="Bodky hodnôt 1 až 6" />
        </div>
        <SliderRow
          label="Rozklad zostavy"
          value={Math.round(settings.explode * 100)}
          min={0}
          max={100}
          step={1}
          unit="%"
          hint="Odtiahne plášť aj tagy od jadra."
          onChange={(value) => patch({ explode: value / 100 })}
        />
      </ControlGroup>

      <ControlGroup title="Pomocné zobrazenie">
        <div className="flex flex-wrap gap-1.5">
          <ToggleChip label="popisky" checked={settings.showLabels} onChange={(value) => patch({ showLabels: value })} title="Hodnoty stien a UID tagov" />
          <ToggleChip label="pole" checked={settings.showField} onChange={(value) => patch({ showField: value })} title="Dosah elektromagnetického poľa" />
          <ToggleChip label="čítačka" checked={settings.showReader} onChange={(value) => patch({ showReader: value })} title="Anténa čítačky PN5180" />
          <ToggleChip label="osi" checked={settings.showAxes} onChange={(value) => patch({ showAxes: value })} title="Súradnicové osi scény" />
          <ToggleChip label="strohý režim" checked={settings.plain} onChange={(value) => patch({ plain: value })} title="Ploché materiály bez náročných efektov" />
        </div>
        <button
          type="button"
          className="btn-ghost px-2.5 py-1.5 text-xs"
          onClick={reset}
        >
          Obnoviť predvolené
        </button>
      </ControlGroup>
    </div>
  );
}

function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 border-t border-white/10 pt-3 first:border-0 first:pt-0 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0 xl:first:border-l-0 xl:first:pl-0">
      <h3 className="field-label">{title}</h3>
      {children}
    </div>
  );
}

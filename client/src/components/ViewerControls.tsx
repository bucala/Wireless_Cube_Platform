import type { ViewPreset, ViewerState } from '../hooks/useViewer';
import { Segmented, SliderRow, ToggleChip, type SegmentedOption } from './ui';

const VIEWS: ReadonlyArray<SegmentedOption<ViewPreset>> = [
  { value: 'iso', label: 'ISO', title: 'izometrický pohľad' },
  { value: 'front', label: 'Predok', title: 'pohľad na prednú stenu' },
  { value: 'top', label: 'Vrch', title: 'pohľad zhora' },
  { value: 'side', label: 'Bok', title: 'pohľad z pravého boku' },
];

/** Ovládanie 3D náhľadu: rotácia, pohľady, viditeľnosť dielov, rozklad. */
export function ViewerControls({ viewer }: { viewer: ViewerState }) {
  const { settings, patch, setView, resetCamera, reset } = viewer;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-ghost px-2.5 py-1.5 text-xs"
          aria-pressed={settings.rotate}
          onClick={() => patch({ rotate: !settings.rotate })}
        >
          {settings.rotate ? 'Pozastaviť rotáciu' : 'Spustiť rotáciu'}
        </button>
        <Segmented options={VIEWS} value={settings.view} onChange={setView} />
        <button
          type="button"
          className="btn-ghost px-2.5 py-1.5 text-xs"
          onClick={resetCamera}
          title="Vráti kameru na aktuálny pohľad"
        >
          Vycentrovať
        </button>
        <div className="flex-1" />
        <button
          type="button"
          className="btn-ghost px-2.5 py-1.5 text-xs"
          onClick={reset}
          title="Vráti všetky nastavenia náhľadu"
        >
          Predvolené
        </button>
      </div>

      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
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
      </div>

      <div className="flex flex-wrap gap-1.5">
        <ToggleChip
          label="jadro"
          checked={settings.showCore}
          onChange={(value) => patch({ showCore: value })}
          title="Neprůhledné jadro kocky"
        />
        <ToggleChip
          label="plášť"
          checked={settings.showShell}
          onChange={(value) => patch({ showShell: value })}
          title="Priehľadný vonkajší plášť"
        />
        <ToggleChip
          label="TAG"
          checked={settings.showTags}
          onChange={(value) => patch({ showTags: value })}
          title="Inlaye NTAG na stenách jadra"
        />
        <ToggleChip
          label="bodky"
          checked={settings.showPips}
          onChange={(value) => patch({ showPips: value })}
          title="Vyrazené bodky 1–6 na plášti"
        />
        <ToggleChip
          label="pole"
          checked={settings.showField}
          onChange={(value) => patch({ showField: value })}
          title="Bublina elektromagnetického poľa"
        />
        <ToggleChip
          label="čítačka"
          checked={settings.showReader}
          onChange={(value) => patch({ showReader: value })}
          title="Anténa PN5180 pod kockou"
        />
        <ToggleChip
          label="popisky"
          checked={settings.showLabels}
          onChange={(value) => patch({ showLabels: value })}
          title="Hodnota steny a UID"
        />
        <ToggleChip
          label="osi"
          checked={settings.showAxes}
          onChange={(value) => patch({ showAxes: value })}
          title="Súradnicové osi scény"
        />
        <ToggleChip
          label="strohý režim"
          checked={settings.plain}
          onChange={(value) => patch({ plain: value })}
          title="Plochý materiál bez odleskov, gradientov a tieňov"
        />
      </div>
    </div>
  );
}

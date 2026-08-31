import { FACES, type FaceId } from '../dice';
import type { DeviceFrame, DpcPhase, HostCommand } from '../protocol';
import type { Transport, TransportEvents } from './types';

/**
 * Offline simulator of the ESP32-S3 bridge.
 *
 * It exists for two reasons: the dashboard has to be developable without
 * hardware on the desk, and the pairing workflow is much easier to demo when
 * you can place a virtual dice on a virtual reader. The RF model is deliberately
 * simple but physically motivated: every tag has an activation threshold that
 * grows with its distance from the antenna, plus per-scan jitter.
 */

const SIM_UIDS: Record<FaceId, string> = {
  ny: '04:1A:7C:2B:5E:41:80', // bottom face, 0 mm from the antenna
  pz: '04:1A:7C:2B:5E:41:81',
  px: '04:1A:7C:2B:5E:41:82',
  nx: '04:1A:7C:2B:5E:41:83',
  nz: '04:1A:7C:2B:5E:41:84',
  py: '04:1A:7C:2B:5E:41:85', // top face, ~7.5 mm away
};

/** Field strength (in %) at which a tag starts to answer, by distance class. */
const THRESHOLD_BOTTOM_PCT = 16; // 0 mm, lying on the antenna
const THRESHOLD_TOP_PCT = 84; // ~7.5 mm across the core

/** Per-face detuning of the four side tags (~4.2 mm), so the sweep is not symmetric. */
const SIDE_THRESHOLD_PCT: Record<FaceId, number> = {
  ny: 55,
  pz: 54,
  px: 57,
  nx: 59,
  nz: 62,
  py: 56,
};

const SCAN_PERIOD_MS = 90;
const STATE_PERIOD_MS = 1000;

export interface SimController {
  isPlaced: () => boolean;
  setPlaced: (placed: boolean) => void;
  bottomFace: () => FaceId;
  setBottomFace: (face: FaceId) => void;
  uidFor: (face: FaceId) => string;
  thresholdFor: (face: FaceId) => number;
  subscribe: (listener: () => void) => () => void;
}

interface SimTuner {
  phase: DpcPhase;
  samples: number;
  singleHits: number;
  multiHits: number;
  emptyHits: number;
  ceiling: number;
  lowEdge: number;
  result: number;
  target: string | null;
  note: string;
}

export class SimTransport implements Transport {
  readonly kind = 'sim' as const;
  readonly label = 'Simulátor (bez hardvéru)';

  private scanTimer: number | null = null;
  private stateTimer: number | null = null;
  private power = 70;
  private scanning = true;
  private rfOn = true;
  private placed = true;
  private bottom: FaceId = 'ny';
  private present = new Set<string>();
  private stats = { scans: 0, tagEvents: 0, collisions: 0, errors: 0 };
  private listeners = new Set<() => void>();
  private tuner: SimTuner = {
    phase: 'idle',
    samples: 0,
    singleHits: 0,
    multiHits: 0,
    emptyHits: 0,
    ceiling: 0,
    lowEdge: 0,
    result: 0,
    target: null,
    note: '',
  };

  constructor(private readonly events: TransportEvents) {}

  // --- Transport ----------------------------------------------------------

  start(): void {
    this.events.onStatus('connecting', 'štartujem simulátor');
    window.setTimeout(() => {
      this.events.onStatus('connected', this.label);
      this.emitHello();
      this.emitState();
      this.scanTimer = window.setInterval(() => this.tick(), SCAN_PERIOD_MS);
      this.stateTimer = window.setInterval(() => this.emitState(), STATE_PERIOD_MS);
    }, 220);
  }

  stop(): void {
    if (this.scanTimer !== null) window.clearInterval(this.scanTimer);
    if (this.stateTimer !== null) window.clearInterval(this.stateTimer);
    this.scanTimer = null;
    this.stateTimer = null;
    this.present.clear();
    this.events.onStatus('disconnected');
  }

  send(cmd: HostCommand): void {
    switch (cmd.t) {
      case 'getState':
        this.emitHello();
        this.emitState();
        break;
      case 'ping':
        this.emit({ t: 'pong', ts: Date.now(), id: cmd.id });
        break;
      case 'setPower':
        if (this.tunerBusy()) this.abortTune('prerušené manuálnou zmenou výkonu');
        this.power = clamp(cmd.value, 5, 100);
        this.emit({ t: 'ack', cmd: 'setPower', ok: true });
        this.emitState();
        break;
      case 'nudgePower':
        this.power = clamp(this.power + cmd.delta, 5, 100);
        this.emitState();
        break;
      case 'scan':
        this.scanning = cmd.enabled;
        this.emitState();
        break;
      case 'rf':
        this.rfOn = cmd.on;
        if (!this.rfOn) this.dropAllTags();
        this.emitState();
        break;
      case 'autoTune':
        if (cmd.start) this.startTune(cmd.startPct ?? 100, cmd.targetUid ?? null);
        else this.abortTune('zrušené používateľom');
        break;
      case 'resetReader':
        this.dropAllTags();
        this.emit({ t: 'ack', cmd: 'resetReader', ok: true });
        this.emitHello();
        break;
      case 'reboot':
        this.emit({ t: 'log', level: 'warn', msg: 'simulátor sa "restartuje"', ts: Date.now() });
        this.dropAllTags();
        break;
    }
  }

  // --- simulator control (used by the UI) ---------------------------------

  controller(): SimController {
    return {
      isPlaced: () => this.placed,
      setPlaced: (placed) => {
        this.placed = placed;
        if (!placed) this.dropAllTags();
        this.notify();
      },
      bottomFace: () => this.bottom,
      setBottomFace: (face) => {
        this.bottom = face;
        this.dropAllTags();
        this.notify();
      },
      uidFor: (face) => SIM_UIDS[face],
      thresholdFor: (face) => this.thresholdFor(face),
      subscribe: (listener) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      },
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  // --- RF model -----------------------------------------------------------

  /** Threshold of a face, taking the current orientation into account. */
  private thresholdFor(face: FaceId): number {
    if (face === this.bottom) return THRESHOLD_BOTTOM_PCT;
    if (face === oppositeOf(this.bottom)) return THRESHOLD_TOP_PCT;
    return SIDE_THRESHOLD_PCT[face];
  }

  private readableUids(): string[] {
    if (!this.placed || !this.rfOn) return [];
    const uids: string[] = [];
    for (const face of FACES) {
      const threshold = this.thresholdFor(face.id);
      const jitter = (Math.random() - 0.5) * 3; // +-1.5 %
      if (this.power >= threshold + jitter) uids.push(SIM_UIDS[face.id]);
    }
    return uids;
  }

  private tick(): void {
    if (!this.scanning || !this.rfOn) return;

    const uids = this.readableUids();
    // A real anticollision loop occasionally reports a collision it could not
    // resolve; mimic that when several tags answer.
    const collision = uids.length > 1 && Math.random() < 0.35;
    this.stats.scans += 1;
    if (uids.length > 1) this.stats.collisions += 1;

    const seen = new Set(uids);
    for (const uid of uids) {
      if (!this.present.has(uid)) {
        this.present.add(uid);
        this.stats.tagEvents += 1;
        this.emit({
          t: 'tag',
          ts: Date.now(),
          event: 'found',
          uid,
          powerPct: this.power,
          len: 7,
          sak: 0x00,
        });
      }
    }
    for (const uid of Array.from(this.present)) {
      if (!seen.has(uid)) {
        this.present.delete(uid);
        this.stats.tagEvents += 1;
        this.emit({ t: 'tag', ts: Date.now(), event: 'lost', uid, powerPct: this.power });
      }
    }

    this.emit({
      t: 'scan',
      ts: Date.now(),
      powerPct: this.power,
      count: uids.length,
      collision,
      truncated: false,
      agc: 180 + Math.round(uids.length * 22 + Math.random() * 12),
      durationUs: 3200 + Math.round(Math.random() * 900),
      uids,
    });

    this.feedTuner(uids, collision);
  }

  private dropAllTags(): void {
    for (const uid of this.present) {
      this.emit({ t: 'tag', ts: Date.now(), event: 'lost', uid, powerPct: this.power });
    }
    this.present.clear();
  }

  // --- DPC sweep (mirrors firmware/src/DpcTuner.cpp) ----------------------

  private startTune(startPct: number, targetUid: string | null): void {
    this.tuner = {
      phase: 'coarse',
      samples: 0,
      singleHits: 0,
      multiHits: 0,
      emptyHits: 0,
      ceiling: 0,
      lowEdge: 0,
      result: 0,
      target: targetUid,
      note: 'hrubé hľadanie stropu',
    };
    this.power = clamp(startPct, 5, 100);
    this.emit({ t: 'ack', cmd: 'autoTune', ok: true });
    this.emitDpc();
  }

  private abortTune(note: string): void {
    this.tuner.phase = 'idle';
    this.tuner.note = note;
    this.emitDpc();
  }

  private tunerBusy(): boolean {
    return ['coarse', 'fine', 'verify'].includes(this.tuner.phase);
  }

  private stepTo(power: number, phase: DpcPhase, note: string): void {
    this.power = clamp(power, 5, 100);
    this.tuner.phase = phase;
    this.tuner.note = note;
    this.tuner.samples = 0;
    this.tuner.singleHits = 0;
    this.tuner.multiHits = 0;
    this.tuner.emptyHits = 0;
    this.emitDpc();
  }

  private feedTuner(uids: string[], collision: boolean): void {
    if (!this.tunerBusy()) return;
    const t = this.tuner;
    const multi = uids.length > 1 || collision;
    const single =
      uids.length === 1 && (t.target === null || uids[0] === t.target);

    t.samples += 1;
    if (multi) t.multiHits += 1;
    else if (single) t.singleHits += 1;
    else t.emptyHits += 1;

    if (multi && t.phase !== 'verify') {
      const step = t.phase === 'coarse' ? 5 : 1;
      this.stepTo(this.power - step, t.phase, 'kolízia – znižujem výkon');
      return;
    }
    if (t.samples < 6) {
      this.emitDpc();
      return;
    }

    const stable = t.singleHits >= 5;
    if (t.phase === 'coarse') {
      if (stable) {
        t.ceiling = this.power;
        t.lowEdge = this.power;
        this.stepTo(this.power - 1, 'fine', 'hľadám dolnú hranu čítania');
      } else if (this.power <= 10) {
        t.phase = 'failed';
        t.note = 'žiadny tag – polož kocku na čítačku';
        this.emitDpc();
      } else {
        this.stepTo(this.power - 5, 'coarse', 'nestabilné čítanie – znižujem výkon');
      }
      return;
    }
    if (t.phase === 'fine') {
      if (stable && this.power > 6) {
        t.lowEdge = this.power;
        this.stepTo(this.power - 1, 'fine', 'hľadám dolnú hranu čítania');
      } else {
        let candidate = t.lowEdge + 3;
        if (t.ceiling > 0 && candidate > t.ceiling) {
          candidate = Math.round((t.lowEdge + t.ceiling) / 2);
        }
        t.result = candidate;
        this.stepTo(candidate, 'verify', 'overujem odporúčaný výkon');
      }
      return;
    }
    // verify
    if (stable && t.multiHits === 0) {
      t.result = this.power;
      t.phase = 'done';
      t.note = 'hotovo – v poli je práve jeden tag';
      this.emitDpc();
      this.emitState();
    } else if (t.multiHits > 0 && this.power > 6) {
      this.stepTo(this.power - 1, 'verify', 'overenie zlyhalo na kolízii – o krok nižšie');
    } else if (this.power < t.ceiling) {
      this.stepTo(this.power + 1, 'verify', 'overenie zlyhalo na výpadku – o krok vyššie');
    } else {
      t.phase = 'failed';
      t.note = 'nenašlo sa okno, v ktorom je čitateľný len spodný tag';
      this.emitDpc();
    }
  }

  // --- frame emitters -----------------------------------------------------

  private emit(frame: DeviceFrame): void {
    this.events.onFrame(frame);
  }

  private emitHello(): void {
    this.emit({
      t: 'hello',
      fw: 'nfc-dice-debugger (sim)',
      version: '1.0.0',
      proto: '1',
      chip: 'ESP32-S3 (simulovaný)',
      ip: '127.0.0.1',
      ap: false,
      reader: { ok: true, product: 0x0102, firmware: 0x0304 },
      limits: { minPct: 5, maxPct: 100, maxTags: 8, scanPeriodMs: SCAN_PERIOD_MS },
    });
  }

  private emitState(): void {
    this.emit({
      t: 'state',
      ts: Date.now(),
      powerPct: this.power,
      scanning: this.scanning,
      rfOn: this.rfOn,
      agc: 180 + this.present.size * 22,
      readerOk: true,
      heap: 268_000,
      rssi: -47,
      clients: 1,
      rf: {
        cwAmplitude: Math.max(0, Math.round((this.power / 100) * 7)),
        residualCarrier: Math.round(((100 - this.power) / 100) * 28),
        extAttenuator: this.power < 15,
      },
      stats: { ...this.stats },
      dpc: { phase: this.tuner.phase, resultPct: this.tuner.result },
      present: Array.from(this.present).map((uid) => ({ uid, len: 7 })),
    });
  }

  private emitDpc(): void {
    const t = this.tuner;
    this.emit({
      t: 'dpc',
      ts: Date.now(),
      phase: t.phase,
      powerPct: this.power,
      samples: t.samples,
      singleHits: t.singleHits,
      multiHits: t.multiHits,
      emptyHits: t.emptyHits,
      ceilingPct: t.ceiling,
      lowEdgePct: t.lowEdge,
      resultPct: t.result,
      note: t.note,
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function oppositeOf(face: FaceId): FaceId {
  const map: Record<FaceId, FaceId> = {
    px: 'nx',
    nx: 'px',
    py: 'ny',
    ny: 'py',
    pz: 'nz',
    nz: 'pz',
  };
  return map[face];
}

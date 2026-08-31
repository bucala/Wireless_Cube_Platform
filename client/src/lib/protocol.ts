/**
 * Wire protocol shared with the ESP32-S3 firmware.
 * Every frame is one JSON object discriminated by its `t` field.
 * Keep in sync with firmware/src/main.cpp and docs/PROTOCOL.md.
 */

export const PROTOCOL_VERSION = '1';

// --- device -> host --------------------------------------------------------

export interface HelloFrame {
  t: 'hello';
  fw: string;
  version: string;
  proto: string;
  chip?: string;
  ip?: string;
  ap?: boolean;
  reader?: { ok: boolean; product?: number; firmware?: number; error?: string };
  limits?: { minPct: number; maxPct: number; maxTags: number; scanPeriodMs: number };
}

export interface PresentTagInfo {
  uid: string;
  len?: number;
  sak?: number;
  ageMs?: number;
  sightings?: number;
}

export interface StateFrame {
  t: 'state';
  ts: number;
  powerPct: number;
  scanning: boolean;
  rfOn: boolean;
  agc: number;
  readerOk: boolean;
  heap?: number;
  rssi?: number;
  clients?: number;
  rf?: { cwAmplitude: number; residualCarrier: number; extAttenuator: boolean };
  stats?: { scans: number; tagEvents: number; collisions: number; errors: number };
  dpc?: { phase: DpcPhase; resultPct: number };
  present?: PresentTagInfo[];
}

export interface ScanFrame {
  t: 'scan';
  ts: number;
  powerPct: number;
  count: number;
  collision: boolean;
  truncated: boolean;
  agc: number;
  durationUs: number;
  uids: string[];
}

export interface TagFrame {
  t: 'tag';
  ts: number;
  event: 'found' | 'lost';
  uid: string;
  len?: number;
  sak?: number;
  powerPct: number;
  dwellMs?: number;
}

export type DpcPhase = 'idle' | 'coarse' | 'fine' | 'verify' | 'done' | 'failed';

export interface DpcFrame {
  t: 'dpc';
  ts: number;
  phase: DpcPhase;
  powerPct: number;
  samples: number;
  singleHits: number;
  multiHits: number;
  emptyHits: number;
  ceilingPct: number;
  lowEdgePct: number;
  resultPct: number;
  note: string;
}

export interface AckFrame {
  t: 'ack';
  cmd: string;
  ok: boolean;
  msg?: string;
}

export interface LogFrame {
  t: 'log';
  level: 'info' | 'warn' | 'error';
  msg: string;
  ts?: number;
}

export interface PongFrame {
  t: 'pong';
  ts: number;
  id?: number;
}

export type DeviceFrame =
  | HelloFrame
  | StateFrame
  | ScanFrame
  | TagFrame
  | DpcFrame
  | AckFrame
  | LogFrame
  | PongFrame;

// --- host -> device --------------------------------------------------------

export type HostCommand =
  | { t: 'getState' }
  | { t: 'ping'; id?: number }
  | { t: 'setPower'; value: number }
  | { t: 'nudgePower'; delta: number }
  | { t: 'scan'; enabled: boolean }
  | { t: 'rf'; on: boolean }
  | { t: 'autoTune'; start: boolean; startPct?: number; targetUid?: string }
  | { t: 'resetReader' }
  | { t: 'reboot' };

// --- helpers --------------------------------------------------------------

const FRAME_TYPES = new Set([
  'hello',
  'state',
  'scan',
  'tag',
  'dpc',
  'ack',
  'log',
  'pong',
]);

/** Parses one text frame; returns null for anything that is not a known frame. */
export function parseFrame(raw: string): DeviceFrame | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const type = (value as { t?: unknown }).t;
  if (typeof type !== 'string' || !FRAME_TYPES.has(type)) return null;
  return value as DeviceFrame;
}

/** Normalises whatever the user typed into a `ws://host:port/path` URL. */
export function normalizeWsUrl(input: string, path = '/ws'): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^wss?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    if (url.pathname === '/' || url.pathname === '') url.pathname = path;
    return url.toString().replace(/\/$/, '');
  }
  const withoutScheme = trimmed.replace(/^https?:\/\//i, '');
  const [hostPort, ...rest] = withoutScheme.split('/');
  const suffix = rest.filter(Boolean).join('/');
  return `ws://${hostPort}${suffix ? `/${suffix}` : path}`;
}

/** Human readable label for a DPC phase, used by the tuner panel. */
export function dpcPhaseLabel(phase: DpcPhase): string {
  switch (phase) {
    case 'coarse':
      return 'Hrubé ladenie';
    case 'fine':
      return 'Jemné ladenie';
    case 'verify':
      return 'Overovanie';
    case 'done':
      return 'Doladené';
    case 'failed':
      return 'Zlyhalo';
    default:
      return 'Nečinné';
  }
}

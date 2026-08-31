import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  DeviceFrame,
  DpcFrame,
  HelloFrame,
  HostCommand,
  ScanFrame,
  StateFrame,
} from '../lib/protocol';
import { normalizeWsUrl } from '../lib/protocol';
import { SerialTransport } from '../lib/transports/serialTransport';
import { SimTransport, type SimController } from '../lib/transports/simTransport';
import type { LinkStatus, Transport, TransportKind } from '../lib/transports/types';
import { WsTransport } from '../lib/transports/wsTransport';

export interface LogEntry {
  id: number;
  ts: number;
  kind: 'found' | 'lost' | 'collision' | 'log' | 'ack' | 'dpc';
  uid?: string;
  powerPct?: number;
  count?: number;
  message?: string;
  level?: 'info' | 'warn' | 'error';
}

export interface ConnectOptions {
  kind: TransportKind;
  /** IP, host or full ws:// URL - only used when kind === 'ws'. */
  address?: string;
}

const LOG_LIMIT = 400;
const POWER_SEND_INTERVAL_MS = 60;

export function useDeviceLink() {
  const [status, setStatus] = useState<LinkStatus>('disconnected');
  const [statusDetail, setStatusDetail] = useState<string>('');
  const [kind, setKind] = useState<TransportKind>('sim');
  const [label, setLabel] = useState<string>('');
  const [hello, setHello] = useState<HelloFrame | null>(null);
  const [deviceState, setDeviceState] = useState<StateFrame | null>(null);
  const [lastScan, setLastScan] = useState<ScanFrame | null>(null);
  const [dpc, setDpc] = useState<DpcFrame | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [powerPct, setPowerPct] = useState(70);
  const [lastCollisionAt, setLastCollisionAt] = useState(0);
  const [simulator, setSimulator] = useState<SimController | null>(null);

  const transportRef = useRef<Transport | null>(null);
  const logIdRef = useRef(0);
  const powerTimerRef = useRef<number | null>(null);
  const pendingPowerRef = useRef<number | null>(null);
  const lastPowerSentRef = useRef(0);
  // Ignore power echoes from the device while the user drags the slider.
  const localPowerUntilRef = useRef(0);

  const pushLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setLog((previous) => {
      const next = previous.concat({ ...entry, id: ++logIdRef.current });
      return next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next;
    });
  }, []);

  const handleFrame = useCallback(
    (frame: DeviceFrame) => {
      switch (frame.t) {
        case 'hello':
          setHello(frame);
          break;
        case 'state':
          setDeviceState(frame);
          if (Date.now() > localPowerUntilRef.current) setPowerPct(frame.powerPct);
          break;
        case 'scan':
          setLastScan(frame);
          if (frame.collision || frame.count > 1) {
            setLastCollisionAt(Date.now());
            pushLog({
              ts: frame.ts,
              kind: 'collision',
              count: frame.count,
              powerPct: frame.powerPct,
              message: `kolízia: ${frame.count} UID v poli`,
            });
          }
          break;
        case 'tag':
          pushLog({
            ts: frame.ts,
            kind: frame.event === 'found' ? 'found' : 'lost',
            uid: frame.uid,
            powerPct: frame.powerPct,
          });
          break;
        case 'dpc':
          setDpc(frame);
          if (Date.now() > localPowerUntilRef.current) setPowerPct(frame.powerPct);
          if (frame.phase === 'done' || frame.phase === 'failed') {
            pushLog({
              ts: frame.ts,
              kind: 'dpc',
              powerPct: frame.resultPct || frame.powerPct,
              message: `DPC ${frame.phase === 'done' ? 'dokončené' : 'zlyhalo'}: ${frame.note}`,
              level: frame.phase === 'done' ? 'info' : 'warn',
            });
          }
          break;
        case 'ack':
          if (!frame.ok) {
            pushLog({
              ts: Date.now(),
              kind: 'ack',
              message: `${frame.cmd}: ${frame.msg ?? 'zamietnuté'}`,
              level: 'error',
            });
          }
          break;
        case 'log':
          pushLog({
            ts: frame.ts ?? Date.now(),
            kind: 'log',
            message: frame.msg,
            level: frame.level,
          });
          break;
        case 'pong':
          break;
      }
    },
    [pushLog],
  );

  const handleStatus = useCallback(
    (next: LinkStatus, detail?: string) => {
      setStatus(next);
      setStatusDetail(detail ?? '');
      if (next === 'error' && detail) {
        pushLog({ ts: Date.now(), kind: 'log', message: detail, level: 'error' });
      }
    },
    [pushLog],
  );

  const disconnect = useCallback(() => {
    void transportRef.current?.stop();
    transportRef.current = null;
    setSimulator(null);
    setStatus('disconnected');
    setStatusDetail('');
    setHello(null);
    setDeviceState(null);
    setLastScan(null);
    setDpc(null);
  }, []);

  const connect = useCallback(
    async (options: ConnectOptions) => {
      void transportRef.current?.stop();
      transportRef.current = null;
      setSimulator(null);

      const events = { onFrame: handleFrame, onStatus: handleStatus };
      let transport: Transport;

      if (options.kind === 'ws') {
        const url = normalizeWsUrl(options.address ?? '');
        if (!url) {
          handleStatus('error', 'zadaj IP adresu alebo ws:// URL');
          return;
        }
        transport = new WsTransport(url, events);
      } else if (options.kind === 'serial') {
        transport = new SerialTransport(events);
      } else {
        const sim = new SimTransport(events);
        setSimulator(sim.controller());
        transport = sim;
      }

      transportRef.current = transport;
      setKind(transport.kind);
      setLabel(transport.label);
      await transport.start();
      setLabel(transport.label);
    },
    [handleFrame, handleStatus],
  );

  const send = useCallback((cmd: HostCommand) => {
    transportRef.current?.send(cmd);
  }, []);

  /**
   * Slider updates are throttled: a drag produces dozens of events per second
   * and every register write on the PN5180 costs an SPI round trip.
   */
  const setPower = useCallback(
    (value: number) => {
      const clamped = Math.min(100, Math.max(0, Math.round(value)));
      setPowerPct(clamped);
      localPowerUntilRef.current = Date.now() + 600;
      pendingPowerRef.current = clamped;

      const elapsed = Date.now() - lastPowerSentRef.current;
      const flush = () => {
        const pending = pendingPowerRef.current;
        powerTimerRef.current = null;
        if (pending === null) return;
        pendingPowerRef.current = null;
        lastPowerSentRef.current = Date.now();
        send({ t: 'setPower', value: pending });
      };

      if (elapsed >= POWER_SEND_INTERVAL_MS && powerTimerRef.current === null) {
        flush();
        return;
      }
      if (powerTimerRef.current === null) {
        powerTimerRef.current = window.setTimeout(flush, POWER_SEND_INTERVAL_MS - elapsed);
      }
    },
    [send],
  );

  const autoTune = useCallback(
    (options?: { startPct?: number; targetUid?: string }) => {
      send({
        t: 'autoTune',
        start: true,
        startPct: options?.startPct,
        targetUid: options?.targetUid,
      });
    },
    [send],
  );

  const abortAutoTune = useCallback(() => send({ t: 'autoTune', start: false }), [send]);
  const setScanning = useCallback((enabled: boolean) => send({ t: 'scan', enabled }), [send]);
  const setField = useCallback((on: boolean) => send({ t: 'rf', on }), [send]);
  const resetReader = useCallback(() => send({ t: 'resetReader' }), [send]);
  const clearLog = useCallback(() => setLog([]), []);

  useEffect(
    () => () => {
      void transportRef.current?.stop();
      if (powerTimerRef.current !== null) window.clearTimeout(powerTimerRef.current);
    },
    [],
  );

  const presentUids = useMemo(() => {
    if (lastScan) return lastScan.uids;
    return deviceState?.present?.map((tag) => tag.uid) ?? [];
  }, [lastScan, deviceState]);

  const tuning = dpc ? ['coarse', 'fine', 'verify'].includes(dpc.phase) : false;

  return {
    status,
    statusDetail,
    kind,
    label,
    hello,
    deviceState,
    lastScan,
    dpc,
    tuning,
    log,
    powerPct,
    presentUids,
    collision: (lastScan?.collision ?? false) || (lastScan?.count ?? 0) > 1,
    lastCollisionAt,
    simulator,
    connect,
    disconnect,
    send,
    setPower,
    autoTune,
    abortAutoTune,
    setScanning,
    setField,
    resetReader,
    clearLog,
  };
}

export type DeviceLink = ReturnType<typeof useDeviceLink>;

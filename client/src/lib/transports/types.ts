import type { DeviceFrame, HostCommand } from '../protocol';

export type TransportKind = 'ws' | 'serial' | 'sim';

export type LinkStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TransportEvents {
  onFrame: (frame: DeviceFrame) => void;
  onStatus: (status: LinkStatus, detail?: string) => void;
}

export interface Transport {
  readonly kind: TransportKind;
  /** Human readable description of the peer, shown in the header. */
  readonly label: string;
  start: () => void | Promise<void>;
  stop: () => void | Promise<void>;
  send: (cmd: HostCommand) => void;
}

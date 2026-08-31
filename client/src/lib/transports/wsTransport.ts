import { parseFrame, type HostCommand } from '../protocol';
import type { Transport, TransportEvents } from './types';

const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

/**
 * WebSocket link to the ESP32-S3. Reconnects with a bounded backoff because a
 * bench setup gets re-flashed and power cycled constantly and the dashboard
 * should recover without user interaction.
 */
export class WsTransport implements Transport {
  readonly kind = 'ws' as const;

  private socket: WebSocket | null = null;
  private timer: number | null = null;
  private attempt = 0;
  private closedByUser = false;
  private queue: HostCommand[] = [];

  constructor(
    private readonly url: string,
    private readonly events: TransportEvents,
  ) {}

  get label(): string {
    return this.url;
  }

  start(): void {
    this.closedByUser = false;
    this.open();
  }

  stop(): void {
    this.closedByUser = true;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.events.onStatus('disconnected');
  }

  send(cmd: HostCommand): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(cmd));
      return;
    }
    // Buffer a small number of commands so a slider drag during a reconnect is
    // not silently lost; older duplicates of the same type are dropped.
    this.queue = this.queue.filter((entry) => entry.t !== cmd.t).slice(-8);
    this.queue.push(cmd);
  }

  private open(): void {
    this.events.onStatus('connecting', this.url);
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url);
    } catch (error) {
      this.events.onStatus('error', error instanceof Error ? error.message : String(error));
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.attempt = 0;
      this.events.onStatus('connected', this.url);
      const pending = this.queue;
      this.queue = [];
      socket.send(JSON.stringify({ t: 'getState' }));
      for (const cmd of pending) socket.send(JSON.stringify(cmd));
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      const frame = parseFrame(event.data);
      if (frame) this.events.onFrame(frame);
    };

    socket.onerror = () => {
      this.events.onStatus('error', 'chyba WebSocket spojenia');
    };

    socket.onclose = () => {
      this.socket = null;
      if (this.closedByUser) return;
      this.events.onStatus('disconnected');
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.closedByUser) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(this.attempt, RECONNECT_DELAYS_MS.length - 1)];
    this.attempt += 1;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.open();
    }, delay);
  }
}

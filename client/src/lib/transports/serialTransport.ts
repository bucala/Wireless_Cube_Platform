import { parseFrame, type HostCommand } from '../protocol';
import type { Transport, TransportEvents } from './types';

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && navigator.serial !== undefined;
}

/**
 * USB link over the Web Serial API. The firmware mirrors every WebSocket frame
 * as newline delimited JSON on the CDC port, so this transport speaks the exact
 * same protocol - handy when the board has no Wi-Fi credentials yet.
 *
 * Chromium only: `navigator.serial` needs a user gesture, which is why
 * `start()` must be called from a click handler.
 */
export class SerialTransport implements Transport {
  readonly kind = 'serial' as const;

  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private buffer = '';
  private stopped = false;

  constructor(
    private readonly events: TransportEvents,
    private readonly baudRate = 115200,
  ) {}

  get label(): string {
    const info = this.port?.getInfo();
    if (!info) return 'Sériový port';
    const vid = info.usbVendorId?.toString(16).padStart(4, '0') ?? '????';
    const pid = info.usbProductId?.toString(16).padStart(4, '0') ?? '????';
    return `USB ${vid}:${pid} @ ${this.baudRate}`;
  }

  async start(): Promise<void> {
    if (!isWebSerialSupported()) {
      this.events.onStatus('error', 'Web Serial API nie je v tomto prehliadači dostupné');
      return;
    }
    this.stopped = false;
    this.events.onStatus('connecting', 'vyber COM port');
    try {
      const port = await navigator.serial!.requestPort();
      await port.open({ baudRate: this.baudRate, bufferSize: 4096 });
      this.port = port;
      this.writer = port.writable?.getWriter() ?? null;
      this.events.onStatus('connected', this.label);
      this.send({ t: 'getState' });
      void this.readLoop();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.events.onStatus('error', message);
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    try {
      await this.reader?.cancel();
    } catch {
      /* already closed */
    }
    this.reader?.releaseLock();
    this.reader = null;
    try {
      await this.writer?.close();
    } catch {
      /* already closed */
    }
    this.writer = null;
    try {
      await this.port?.close();
    } catch {
      /* already closed */
    }
    this.port = null;
    this.events.onStatus('disconnected');
  }

  send(cmd: HostCommand): void {
    if (!this.writer) return;
    const payload = new TextEncoder().encode(`${JSON.stringify(cmd)}\n`);
    void this.writer.write(payload);
  }

  private async readLoop(): Promise<void> {
    if (!this.port?.readable) return;
    this.reader = this.port.readable.getReader();
    const decoder = new TextDecoder();

    try {
      while (!this.stopped) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (!value) continue;
        this.buffer += decoder.decode(value, { stream: true });

        let newline = this.buffer.indexOf('\n');
        while (newline >= 0) {
          const line = this.buffer.slice(0, newline).trim();
          this.buffer = this.buffer.slice(newline + 1);
          if (line) {
            const frame = parseFrame(line);
            // Boot messages and ESP-IDF logs share the port; ignore non-JSON.
            if (frame) this.events.onFrame(frame);
          }
          newline = this.buffer.indexOf('\n');
        }
        // Guard against a peer that never sends a newline.
        if (this.buffer.length > 8192) this.buffer = '';
      }
    } catch (error) {
      if (!this.stopped) {
        this.events.onStatus('error', error instanceof Error ? error.message : String(error));
      }
    } finally {
      this.reader?.releaseLock();
      this.reader = null;
      if (!this.stopped) this.events.onStatus('disconnected');
    }
  }
}

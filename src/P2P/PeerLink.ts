import {
  decodeControl,
  decodeDataFrame,
  encodeControl,
  encodeDataFrame,
  isDataFrame,
  makeNonce,
  type ControlMessage,
} from './protocol';
import type {Uid} from '../models';
import {waitForBuffer} from './transfer/flowControl';

/**
 * One P2P data link = one DataChannel between two peers.
 * Handles hello handshake, control/data routing and send-side flow control.
 */

export type PeerLinkEvents = {
  onOpen?: (link: PeerLink) => void;
  onControl?: (link: PeerLink, msg: ControlMessage) => void;
  onData?: (link: PeerLink, tid: string, index: number, payload: Uint8Array) => void;
  onClose?: (link: PeerLink, reason: string) => void;
  onError?: (link: PeerLink, error: Error) => void;
};

type BinaryLike = Uint8Array | ArrayBuffer;

export type DataChannelLike = {
  readyState: string;
  bufferedAmount: number;
  send(data: string | Uint8Array): void;
  close(): void;
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
};

function toBytes(data: BinaryLike): Uint8Array {
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(data);
}

export class PeerLink {
  readonly peerId: Uid;
  private opened = false;
  private closed = false;
  private openFired = false;
  readonly nonce: string;
  private lastActivity = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly myUid: Uid,
    peerId: Uid,
    readonly channel: DataChannelLike,
    private readonly events: PeerLinkEvents,
    private readonly opts: {idleMs?: number; heartbeatMs?: number} = {},
  ) {
    this.peerId = peerId;
    this.nonce = makeNonce();
    this.lastActivity = Date.now();

    if (channel.readyState === 'open') {
      this.onOpenEvent();
    } else {
      channel.addEventListener('open', () => this.onOpenEvent());
    }
    channel.addEventListener('close', () => this.close('peer_closed'));
    channel.addEventListener('error', () => this.close('peer_error'));
    channel.addEventListener('message', (event: {data: string | BinaryLike}) => {
      this.touch();
      this.handleMessage(event.data);
    });
  }

  get isOpen(): boolean {
    return this.opened && !this.closed;
  }

  get isReadyToSend(): boolean {
    return this.channel.readyState === 'open' && this.isOpen;
  }

  private touch(): void {
    this.lastActivity = Date.now();
  }

  private onOpenEvent(): void {
    if (this.closed) return;
    this.opened = true;
    this.touch();
    this.startHeartbeat();
    this.scheduleIdleCheck();
    try {
      this.channel.send(encodeControl({kind: 'hello', uid: this.myUid, nonce: this.nonce}));
    } catch {
      this.close('send_failed');
      return;
    }
    if (!this.openFired) {
      this.openFired = true;
      this.events.onOpen?.(this);
    }
  }

  private handleMessage(data: string | BinaryLike): void {
    if (this.closed) return;
    if (typeof data === 'string') {
      let msg: ControlMessage;
      try {
        msg = decodeControl(data);
      } catch (err) {
        this.events.onError?.(this, err as Error);
        return;
      }
      if (msg.kind === 'hello') {
        if (msg.uid !== this.peerId) {
          this.close('hello_mismatch');
          return;
        }
      }
      this.events.onControl?.(this, msg);
      return;
    }
    const buf = toBytes(data);
    if (!isDataFrame(buf)) {
      this.events.onError?.(this, new Error('bad_frame'));
      return;
    }
    try {
      const frame = decodeDataFrame(buf);
      this.events.onData?.(this, frame.tid, frame.index, frame.payload);
    } catch (err) {
      this.events.onError?.(this, err as Error);
    }
  }

  sendControl(msg: ControlMessage): void {
    if (!this.isReadyToSend) throw new Error('link_closed');
    this.touch();
    this.channel.send(encodeControl(msg));
  }

  async sendChunk(tid: string, index: number, payload: Uint8Array): Promise<void> {
    if (!this.isReadyToSend) throw new Error('link_closed');
    await this.waitForResume();
    if (!this.isReadyToSend) throw new Error('link_closed');
    this.channel.send(encodeDataFrame(tid, index, payload));
    this.touch();
  }

  /** Flow control: pause while the native buffer is above HIGH_WATER. */
  private waitForResume(): Promise<void> {
    return waitForBuffer(this.channel);
  }

  close(reason: string): void {
    if (this.closed) return;
    this.closed = true;
    this.compact();
    try {
      this.channel.close();
    } catch {
      // channel already gone
    }
    this.events.onClose?.(this, reason);
  }

  private compact(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private startHeartbeat(): void {
    if (this.pingTimer) return;
    const ms = this.opts.heartbeatMs ?? 25_000;
    if (ms <= 0) return;
    this.pingTimer = setInterval(() => {
      if (!this.isReadyToSend) return;
      try {
        this.channel.send(encodeControl({kind: 'ping', nonce: makeNonce()}));
      } catch {
        this.close('send_failed');
      }
    }, ms);
  }

  private scheduleIdleCheck(): void {
    if (this.idleTimer) return;
    const ms = this.opts.idleMs ?? 0;
    if (ms <= 0) return;
    const check = (): void => {
      this.idleTimer = null;
      if (!this.closed && Date.now() - this.lastActivity > ms) {
        this.close('idle');
        return;
      }
      if (!this.closed) this.idleTimer = setTimeout(check, ms);
    };
    this.idleTimer = setTimeout(check, ms);
  }
}
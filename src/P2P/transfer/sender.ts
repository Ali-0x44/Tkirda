import type { ChunkCipher } from '../../Security/stream';
import type { PeerLink } from '../PeerLink';
import type { ChunkReader } from './chunker';
import { utf8Aad } from './util';

/**
 * Sender side of one transfer. Flow:
 *   file_offer → wait file_accept (resume at nextIndex) →
 *   seal + ship chunks (flow-controlled) → file_done → wait file_complete.
 *
 * `file_accept` is a "progress" outcome (resume point); `file_reject`,
 * `file_cancel` and `file_complete` are terminal.
 */

export const SENDER_TIMEOUTS = {
  acceptMs: 15_000,
  completeMs: 60_000,
} as const;

export type Outcome =
  | {kind: 'accept'; nextIndex: number}
  | {kind: 'reject'; reason: string}
  | {kind: 'cancel'; reason: string}
  | {kind: 'complete'}
  | {kind: 'timeout'};

export type SenderHooks = {
  onProgress?: (args: {index: number; totalChunks: number}) => void;
  onReject?: (reason: string) => void;
  onComplete?: () => void;
};

export class FileSender {
  private started = false;
  private done = false;
  private outcome: Outcome | null = null;
  private waiters: (() => void)[] = [];
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly link: PeerLink,
    private readonly offer: {
      tid: string;
      messageId: string;
      mediaKind: 'audio' | 'image' | 'file';
      name: string;
      mime: string;
      size: number;
      durationMs: number | null;
      totalChunks: number;
      chunkSize: number;
      wrappedKey: string;
      baseIvHex: string;
    },
    private readonly hooks: SenderHooks = {},
    private readonly timeouts: typeof SENDER_TIMEOUTS = SENDER_TIMEOUTS,
  ) {}

  /** Route a control message for this transfer here. */
  feedControl(kind: 'file_accept' | 'file_reject' | 'file_cancel' | 'file_complete', payload: {
    tid: string;
    nextIndex?: number;
    reason?: string;
  }): void {
    if (payload.tid !== this.offer.tid || this.done) return;
    if (kind === 'file_accept') {
      this.outcome = {kind: 'accept', nextIndex: payload.nextIndex ?? 0};
      this.poke();
    } else if (kind === 'file_complete') {
      this.outcome = {kind: 'complete'};
      this.poke();
    } else if (kind === 'file_reject') {
      this.settle({kind: 'reject', reason: payload.reason ?? 'rejected'});
    } else {
      this.settle({kind: 'cancel', reason: payload.reason ?? 'cancelled'});
    }
  }

  cancel(reason = 'local_cancel'): void {
    this.settle({kind: 'cancel', reason});
  }

  async run(reader: ChunkReader, cipher: ChunkCipher): Promise<void> {
    if (this.started) throw new Error('already_started');
    this.started = true;

    this.link.sendControl({
      kind: 'file_offer',
      tid: this.offer.tid,
      messageId: this.offer.messageId,
      mediaKind: this.offer.mediaKind,
      name: this.offer.name,
      mime: this.offer.mime,
      size: this.offer.size,
      durationMs: this.offer.durationMs,
      totalChunks: this.offer.totalChunks,
      chunkSize: this.offer.chunkSize,
      wrappedKey: this.offer.wrappedKey,
      baseIvHex: this.offer.baseIvHex,
    });

    await this.waitOutcome(this.timeouts.acceptMs);
    if (this.done) {
      this.hooks.onReject?.(this.reasonOf());
      return;
    }
    const startAt = Math.max(0, Math.min((this.outcome as Extract<Outcome, {kind: 'accept'}>).nextIndex, this.offer.totalChunks));

    const aad = utf8Aad(this.offer.tid);
    for (let index = startAt; index < this.offer.totalChunks; index += 1) {
      if (this.done) {
        this.hooks.onReject?.(this.reasonOf());
        return;
      }
      const bytes = await reader.read(index);
      const blob = cipher.sealChunk(index, bytes, aad);
      await this.link.sendChunk(this.offer.tid, index, blob);
      this.hooks.onProgress?.({index: index + 1, totalChunks: this.offer.totalChunks});
    }

    this.link.sendControl({kind: 'file_done', tid: this.offer.tid});
    await this.waitOutcome(this.timeouts.completeMs);
    if (this.done) {
      this.hooks.onReject?.(this.reasonOf());
    } else if (this.outcome?.kind === 'complete') {
      this.hooks.onComplete?.();
    } else {
      this.hooks.onReject?.('no_complete');
    }
  }

  private reasonOf(): string {
    const o = this.outcome;
    if (!o || o.kind === 'accept' || o.kind === 'complete') return 'terminated';
    return (o as {reason?: string}).reason ?? 'timeout';
  }

  private settle(o: Outcome): void {
    if (this.done) return;
    this.outcome = o;
    this.done = true;
    this.clearPauseTimer();
    this.poke();
  }

  private poke(): void {
    const ws = this.waiters;
    this.waiters = [];
    for (const w of ws) w();
  }

  private clearPauseTimer(): void {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  private waitOutcome(ms: number): Promise<void> {
    if (this.outcome) return Promise.resolve();
    return new Promise<void>(resolve => {
      this.waiters.push(resolve);
      this.pauseTimer = setTimeout(() => {
        if (!this.done) {
          this.outcome = {kind: 'timeout'};
          this.done = true;
        }
        this.poke();
      }, ms);
    });
  }
}
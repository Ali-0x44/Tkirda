import { File, FileMode } from 'expo-file-system';
import { createChunkCipherSync, hexToBytes, unwrapTransferKey, type ChunkCipher } from '../../Security/stream';
import { ensureDiskSpace, ensureMediaDir, mediaFinalUri, mediaPartUri, sanitizeMessageId } from '../../services/mediaStore';
import type { PeerLink } from '../PeerLink';
import type { ControlMessage } from '../protocol';
import { extensionFromName, utf8Aad } from './util';

/**
 * Receiver side of one transfer.
 *
 * Resume: existing `.part` content is inspected and `file_accept` carries
 * `nextIndex` = first contiguous chunk index present. Chunks stream in-order
 * (ordered reliable channel); each is authenticated (AES-GCM) before being
 * written at its exact offset.
 */

export type FileOfferLike = Extract<ControlMessage, { kind: 'file_offer' }>;

export const RECEIVER_TIMEOUTS = {
  idleMs: 60_000,
} as const;

export type ReceiverHooks = {
  onProgress?: (args: { index: number; totalChunks: number }) => void;
  onReady?: (args: { messageId: string; uri: string }) => void;
  onReject?: (reason: string) => void;
};

export class FileReceiver {
  private offer: FileOfferLike | null = null;
  private keyHex: string | null = null;
  private cipher: ChunkCipher | null = null;
  private handle: Awaited<ReturnType<File['open']>> | null = null;
  private partUri = '';
  private finalUri = '';
  private nextIndex = 0;
  private bytesWritten = 0;
  private done = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly link: PeerLink,
    private readonly ctx: {
      myUid: string;
      peerId: string;
      myPrivateKey: string;
    },
    private readonly hooks: ReceiverHooks = {},
    private readonly timeouts: typeof RECEIVER_TIMEOUTS = RECEIVER_TIMEOUTS,
  ) { }

  get active(): boolean {
    return !!this.offer && !this.done;
  }

  feedControl(msg: ControlMessage): void {
    if (msg.kind === 'file_offer') {
      void this.begin(msg);
      return;
    }
    if (msg.kind === 'file_cancel' && this.offer && msg.tid === this.offer.tid) {
      this.teardown();
      this.hooks.onReject?.(msg.reason);
    }
  }

  async feedChunk(tid: string, index: number, payload: Uint8Array): Promise<void> {
    if (!this.offer || tid !== this.offer.tid || this.done) return;
    this.armIdle();
    if (index < this.nextIndex) return; // duplicate
    if (index !== this.nextIndex) {
      this.fail('chunk_gap');
      return;
    }
    try {
      const aad = utf8Aad(tid);
      const plain = this.cipher!.openChunk(index, payload, aad);
      this.handle!.offset = index * this.offer.chunkSize;
      await this.handle!.writeBytes(plain);
      this.bytesWritten += plain.length;
      this.nextIndex = index + 1;
      this.hooks.onProgress?.({ index: this.nextIndex, totalChunks: this.offer.totalChunks });
      if (this.nextIndex >= this.offer.totalChunks) void this.finalize();
    } catch {
      this.fail('decrypt_failed');
    }
  }

  private async begin(offer: FileOfferLike): Promise<void> {
    if (this.offer) {
      this.link.sendControl({ kind: 'file_reject', tid: offer.tid, reason: 'busy' });
      return;
    }
    this.offer = offer;

    try {
      if (offer.size < 1 || offer.size > 50 * 1024 * 1024) throw new Error('size');
      const hasSpace = await ensureDiskSpace(offer.size);
      if (!hasSpace) throw new Error('space');
      this.keyHex = await unwrapTransferKey(this.ctx.myPrivateKey, offer.wrappedKey);
      this.cipher = createChunkCipherSync(this.keyHex, hexToBytes(offer.baseIvHex));

      const ext = extensionFromName(offer.name);
      this.finalUri = mediaFinalUri(this.ctx.myUid, this.ctx.peerId, sanitizeMessageId(offer.tid), ext);
      this.partUri = mediaPartUri(this.ctx.myUid, this.ctx.peerId, sanitizeMessageId(offer.tid));

      // Ensure the parent directory exists before trying to open/create the part file.
      await ensureMediaDir(this.ctx.myUid, this.ctx.peerId);

      const part = new File(this.partUri);
      if (part.exists) {
        this.bytesWritten = part.size;
        this.nextIndex = Math.ceil(this.bytesWritten / offer.chunkSize);
      } else {
        this.bytesWritten = 0;
        this.nextIndex = 0;
      }
      const handle = await part.open(FileMode.WriteOnly);
      this.handle = handle;
      if (this.nextIndex > 0) {
        this.handle.offset = this.bytesWritten;
      }
      this.armIdle();

      this.link.sendControl({
        kind: 'file_accept',
        tid: offer.tid,
        nextIndex: this.nextIndex,
      });
    } catch {
      this.teardown();
      this.link.sendControl({ kind: 'file_reject', tid: offer.tid, reason: 'invalid' });
      this.hooks.onReject?.('invalid');
    }
  }

  private async finalize(): Promise<void> {
    if (this.done) return;
    const offer = this.offer!;
    if (this.bytesWritten !== offer.size) {
      return; // wait for remaining (partial last chunk edge cases)
    }
    this.done = true;
    this.clearIdle();
    try {
      await this.handle?.close();
      this.handle = null;
      await new File(this.partUri).move(new File(this.finalUri));
      this.hooks.onReady?.({ messageId: offer.tid, uri: this.finalUri });
      this.link.sendControl({ kind: 'file_complete', tid: offer.tid });
    } catch {
      this.link.sendControl({ kind: 'file_cancel', tid: offer.tid, reason: 'write_failed' });
      this.hooks.onReject?.('write_failed');
    }
  }

  private fail(reason: string): void {
    if (this.done) return;
    this.done = true;
    this.teardown();
    if (this.offer) {
      try {
        this.link.sendControl({ kind: 'file_cancel', tid: this.offer.tid, reason });
      } catch {
        // link already gone — nothing to notify
      }
    }
    this.hooks.onReject?.(reason);
  }

  private teardown(): void {
    this.clearIdle();
    if (this.handle) {
      try {
        void this.handle.close();
      } catch {
        // ignore
      }
      this.handle = null;
    }
  }

  private armIdle(): void {
    this.clearIdle();
    if (this.timeouts.idleMs <= 0) return;
    this.idleTimer = setTimeout(() => {
      this.fail('idle_timeout');
    }, this.timeouts.idleMs);
  }

  private clearIdle(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
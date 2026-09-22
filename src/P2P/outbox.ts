import type { Uid } from '../models';
import type { RSAPair } from '../Security/RSA';
import {
  bytesToHex,
  createChunkCipher,
  newTransferKey,
  unwrapTransferKey,
  wrapTransferKey,
} from '../Security/stream';
import {
  LIMITS,
  backoffForAttempt,
  chunkCount,
  createMedia,
  getMedia,
  listIncompleteIncoming,
  listOutgoing,
  mediaFinalUri,
  progressMedia,
  sanitizeFilename,
  setTransferState,
  updateMedia,
  type MediaMessage,
} from '../services/mediaStore';
import { getUser } from '../services/userService';
import type { DataChannelLike } from './PeerLink';
import { PeerLink } from './PeerLink';
import { PeerLinkManager } from './PeerLinkManager';
import { startPresence, stopPresence, touchPresence } from './presence';
import type { ControlMessage } from './protocol';
import {
  beginDataSession,
  markConnected,
  openSessionEnvelope,
  publishAnswer,
  publishOffer,
  subscribeIncomingOffers,
  subscribeSessionUpdates,
  type IncomingOffer,
  type SessionEntry,
} from './signaling';
import { openChunkReader } from './transfer/chunker';
import { FileReceiver, type FileOfferLike } from './transfer/receiver';
import { FileSender } from './transfer/sender';
import { extensionFromName } from './transfer/util';
import {
  applyRemote,
  createDataChannel,
  createDataChannelAdapter,
  createPeerConnection,
  gatherDescription,
  type PeerConnection,
} from './webrtc';

/**
 * Media transfer orchestration (PLAN §10–§16): one reusable DataChannel per
 * peer, an outbox for outgoing media (persisted first, status-driven retries)
 * and a receiver dispatcher for incoming offers. All state transitions are
 * persisted to the SQLite media store before being mirrored to subscribed UI.
 *
 * Firestore is used ONLY as the signaling rendezvous for the DataChannel; the
 * media bytes never touch Firebase.
 */

export type MediaEvent =
  | {type: 'changed'; media: MediaMessage}
  | {type: 'removed'; id: string};

export type TransferContext = {
  myUid: Uid;
  keys: RSAPair;
};

export const ANSWER_TIMEOUT_MS = 45_000;

type PeerSession = {
  peerId: Uid;
  peerPublicKey?: string;
  link?: PeerLink;
  connecting?: Promise<PeerLink>;
  unsubscribe?: () => void;
  pc?: PeerConnection;
};

let ctx: TransferContext | null = null;
let manager: PeerLinkManager | null = null;
let started = false;
const sessions = new Map<Uid, PeerSession>();
const senders = new Map<string, FileSender>();
const receivers = new Map<string, FileReceiver>();
const inflight = new Set<string>();
const listeners = new Set<(e: MediaEvent) => void>();
const subs: (() => void)[] = [];
const onAttached = new Map<Uid, (link: PeerLink) => void>();

export function isConfigured(): boolean {
  return started;
}

/** Start the service: presence heartbeat + incoming-offer listener. Idempotent. */
export async function configureMediaService(next: TransferContext): Promise<void> {
  if (started && ctx?.myUid === next.myUid) return;
  disposeMediaService();
  ctx = next;
  manager = new PeerLinkManager(next.myUid);
  started = true;
  startPresence(next.myUid);

  const unsubOffer = subscribeIncomingOffers(
    next.myUid,
    offer => {
      void handleIncomingSessionOffer(next, offer);
    },
    () => {
      // presence/signaling error — transfers retry on link open
    },
  );
  subs.push(unsubOffer);
}

export function disposeMediaService(): void {
  stopPresence();
  for (const s of sessions.values()) {
    s.unsubscribe?.();
    try {
      s.pc?.close();
    } catch {
      // ignore
    }
  }
  sessions.clear();
  manager?.closeAll('service_disposed');
  manager = null;
  for (const un of subs) un();
  subs.length = 0;
  senders.clear();
  receivers.clear();
  inflight.clear();
  onAttached.clear();
  started = false;
  ctx = null;
}

export function subscribeMediaEvents(cb: (e: MediaEvent) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emitChanged(media: MediaMessage): void {
  const snapshot = {...media};
  for (const cb of listeners) cb({type: 'changed', media: snapshot});
}

async function fresh(row: MediaMessage): Promise<MediaMessage> {
  const stored = await getMedia(row.id);
  return stored ?? row;
}

async function loadPeerPublicKey(peerId: Uid): Promise<string | undefined> {
  const cached = sessions.get(peerId);
  if (cached?.peerPublicKey) return cached.peerPublicKey;
  const user = await getUser(peerId);
  const publicKey = user?.publicKey;
  if (publicKey) {
    const entry = sessions.get(peerId) ?? {peerId};
    entry.peerPublicKey = publicKey;
    sessions.set(peerId, entry);
  }
  return publicKey;
}

/* ------------------------------------------------------------------- links */

function makeLinkEvents(peerId: Uid): Parameters<PeerLinkManager['attach']>[2] {
  return {
    onOpen(link) {
      void touchPresence(ctx?.myUid ?? link.myUid);
      void flushLinkOutbox(link);
    },
    onControl(_link, msg) {
      if (msg.kind === 'hello' || msg.kind === 'ping') return;
      if (msg.kind === 'file_offer') {
        void handleIncomingOffer(_link, msg);
        return;
      }
      const tid = (msg as {tid?: string}).tid;
      if (!tid) return;
      if (msg.kind === 'file_accept' || msg.kind === 'file_reject' || msg.kind === 'file_cancel' || msg.kind === 'file_complete') {
        senders.get(tid)?.feedControl(msg.kind, {
          tid,
          nextIndex: (msg as {nextIndex?: number}).nextIndex,
          reason: (msg as {reason?: string}).reason,
        });
      }
      receivers.get(tid)?.feedControl(msg as ControlMessage);
    },
    onData(_link, tid, index, payload) {
      receivers.get(tid)?.feedChunk(tid, index, payload);
    },
    onClose(link) {
      maybeRemoveLink(link.peerId);
      void failPeerTransfers(peerId, 'link_closed');
    },
    onError() {
      // the link will surface via onClose; transfers are routed per-tid
    },
  };
}

function maybeRemoveLink(peerId: Uid): void {
  const link = manager?.get(peerId);
  if (link && !link.isReadyToSend) manager?.remove(peerId);
}

function attachChannel(pc: PeerConnection, peerId: Uid, channel: DataChannelLike): PeerLink {
  if (!manager) throw new Error('service_disposed');
  const link = manager.attach(peerId, channel, makeLinkEvents(peerId), {heartbeatMs: 25_000});
  const resolve = onAttached.get(peerId);
  if (resolve) {
    onAttached.delete(peerId);
    resolve(link);
  }
  try {
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'failed' || state === 'closed') link?.close(`conn_${state}`);
    };
  } catch {
    // connection state not surfaced on this build
  }
  const entry = sessions.get(peerId) ?? {peerId};
  entry.link = link;
  entry.pc = pc;
  sessions.set(peerId, entry);
  return link;
}

async function openInitiatorSession(peerId: Uid, peerPublicKey: string): Promise<PeerLink> {
  const current = ctx!;
  const {id, sessionKeyHex} = await beginDataSession({initiatorId: current.myUid, peerId});
  const pc = createPeerConnection();
  const channel = createDataChannel(pc);
  const wrapped = createDataChannelAdapter(channel);
  channel.binaryType = 'arraybuffer';

  const attached = new Promise<PeerLink>((resolve, reject) => {
    const timer = setTimeout(() => {
      onAttached.delete(peerId);
      reject(new Error('peer_offline'));
    }, ANSWER_TIMEOUT_MS);
    onAttached.set(peerId, link => {
      clearTimeout(timer);
      resolve(link);
    });
    wrapped.addEventListener('open', () => {
      try {
        attachChannel(pc, peerId, wrapped);
      } catch (err) {
        clearTimeout(timer);
        onAttached.delete(peerId);
        reject(err as Error);
      }
    });
    wrapped.addEventListener('close', () => {
      clearTimeout(timer);
      onAttached.delete(peerId);
      reject(new Error('channel_closed'));
    });
  });
  void attached.catch(() => {
    // If a later step throws before `return attached`, this promise is
    // orphaned; mark it handled so the late timeout cannot surface as an
    // unhandled rejection. Real failures are handled by ensureTransferLink.
  });

  const unsub = subscribeSessionUpdates(id, (entry: SessionEntry) => {
    const data = entry.data;
    if (data.status !== 'answer' || !data.envelope) return;
    void (async () => {
      try {
        const payload = await openSessionEnvelope(data, current.myUid, current.keys.private);
        if (!payload) return;
        await applyRemote(pc, payload, 'answer');
        await markConnected(id, data.seq);
      } catch {
        pc.close();
      }
    })();
  });
  sessions.set(peerId, {peerId, peerPublicKey, unsubscribe: unsub, pc});

  const description = await gatherDescription(pc, 'offer');
  await publishOffer({
    id,
    sessionKeyHex,
    receiverPublicKey: peerPublicKey,
    receiverUid: peerId,
    payload: {...description, type: 'offer'} as const,
  });
  return attached;
}

async function handleIncomingSessionOffer(current: TransferContext, offer: IncomingOffer): Promise<void> {
  const payload = await openSessionEnvelope(offer.doc, current.myUid, current.keys.private);
  if (!payload) return; // cannot open (expired / wrong key) — ignore

  const peerId = offer.doc.initiatorId;
  const initiatorPublicKey = await loadPeerPublicKey(peerId);
  if (!initiatorPublicKey) return;

  try {
    const sessionKeyHex = await unwrapTransferKey(current.keys.private, offer.doc.keys?.[current.myUid] ?? '');
    const pc = createPeerConnection();
    await applyRemote(pc, payload, 'offer');
    pc.ondatachannel = (event: {channel: ReturnType<typeof createDataChannel>}) => {
      attachChannel(pc, peerId, createDataChannelAdapter(event.channel));
    };
    const answer = await gatherDescription(pc, 'answer');
    await publishAnswer({
      id: offer.id,
      sessionKeyHex,
      initiatorPublicKey,
      initiatorUid: peerId,
      payload: {...answer, type: 'answer'} as const,
      seq: offer.doc.seq,
    });
    const entry = sessions.get(peerId) ?? {peerId};
    entry.peerPublicKey = initiatorPublicKey;
    sessions.set(peerId, entry);
  } catch {
    // answer failed — sender will retry the session later
  }
}

/** Ensure a live link to `peerId`, creating an offer session if needed. */
export async function ensureTransferLink(peerId: Uid, peerPublicKey?: string): Promise<PeerLink> {
  assertConfigured();
  const existing = manager!.get(peerId);
  if (existing?.isReadyToSend) return existing;

  const cached = sessions.get(peerId);
  if (cached?.connecting) return cached.connecting;

  const publicKey = peerPublicKey ?? (await loadPeerPublicKey(peerId));
  const entry = sessions.get(peerId) ?? {peerId};
  if (publicKey) entry.peerPublicKey = publicKey;
  if (!publicKey) throw new Error('peer_public_key_missing');

  const connecting = openInitiatorSession(peerId, publicKey);
  entry.connecting = connecting;
  sessions.set(peerId, entry);
  try {
    const link = await connecting;
    entry.connecting = undefined;
    entry.link = link;
    return link;
  } catch (err) {
    entry.connecting = undefined;
    const stale = sessions.get(peerId);
    if (stale && !stale.link && stale.pc) {
      stale.unsubscribe?.();
      stale.pc.close();
      if (sessions.get(peerId) === stale) sessions.delete(peerId);
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ outbox */

async function flushLinkOutbox(link: PeerLink): Promise<void> {
  if (!ctx) return;
  const rows = (await listOutgoing(ctx.myUid)).filter(
    m => m.peerId === link.peerId && m.status === 'queued',
  );
  for (const row of rows) {
    await sendMedia(link.peerId, row.id);
  }
}

/**
 * Send every queued media row for `peerId`, oldest first. Transfers for the
 * same peer share one DataChannel and are processed strictly in order.
 */
export async function flushOutbox(peerId: Uid, peerPublicKey?: string): Promise<void> {
  assertConfigured();
  if (peerPublicKey) {
    const entry = sessions.get(peerId) ?? {peerId};
    entry.peerPublicKey = peerPublicKey;
    sessions.set(peerId, entry);
  }
  const rows = (await listOutgoing(ctx!.myUid)).filter(
    m => m.peerId === peerId && m.status === 'queued',
  );
  for (const row of rows) {
    await sendMedia(peerId, row.id);
  }
}

async function sendMedia(peerId: Uid, mediaId: string): Promise<void> {
  if (inflight.has(mediaId)) return;

  const row = await getMedia(mediaId);
  if (!row || row.peerId !== peerId || row.status !== 'queued') return;

  inflight.add(mediaId);
  try {
    await updateMedia(mediaId, {status: 'connecting'});
    emitChanged({...row, status: 'connecting'});

    const link = await ensureTransferLink(peerId);
    if (!link.isReadyToSend) throw new Error('link_closed');

    await updateMedia(mediaId, {status: 'sending'});
    emitChanged(await fresh(row));

    const transferKey = await newTransferKey();
    const cipher = await createChunkCipher(transferKey);
    const publicKey = sessions.get(peerId)?.peerPublicKey;
    if (!publicKey) throw new Error('peer_public_key_missing');
    const wrappedKey = await wrapTransferKey(publicKey, transferKey);
    const totalChunks = chunkCount(row.size, LIMITS.CHUNK_SIZE);

    const sender = new FileSender(
      link,
      {
        tid: row.id,
        messageId: row.id,
        mediaKind: row.kind,
        name: row.name,
        mime: row.mime,
        size: row.size,
        durationMs: row.durationMs,
        totalChunks,
        chunkSize: LIMITS.CHUNK_SIZE,
        wrappedKey,
        baseIvHex: bytesToHex(cipher.baseIv),
      },
      {
        onProgress: ({index}) => {
          void progressMedia(row.id, index, totalChunks).catch(() => {});
        },
        onReject: reason => {
          void failSend(row.id, reason);
        },
        onComplete: () => {
          void (async () => {
            await updateMedia(row.id, {status: 'delivered', transferredChunks: totalChunks, totalChunks});
            emitChanged(await fresh(row));
          })();
        },
      },
    );
    senders.set(row.id, sender);
    const reader = await openChunkReader(row.path, LIMITS.CHUNK_SIZE);
    try {
      await sender.run(reader, cipher);
    } finally {
      senders.delete(row.id);
      await reader.close();
    }
  } catch (err) {
    await failSend(row.id, (err as Error)?.message ?? 'send_failed');
  } finally {
    inflight.delete(mediaId);
  }
}

/** Mark an outgoing row failed and schedule the next retry (outbox backoff). */
export async function markSendFailed(id: string, _reason: string): Promise<void> {
  const row = await getMedia(id);
  if (!row) return;
  if (row.status === 'cancelled' || row.status === 'delivered') return;
  const attempts = (row.attempts ?? 0) + 1;
  const nextRetryAt = Date.now() + backoffForAttempt(attempts);
  await setTransferState(id, 'failed', attempts, nextRetryAt);
  emitChanged({...row, status: 'failed', attempts, nextRetryAt});
}

async function failSend(id: string, reason: string): Promise<void> {
  await markSendFailed(id, reason);
}

/** Sender cancelled from the UI. */
export async function cancelMedia(peerId: Uid, mediaId: string): Promise<void> {
  assertConfigured();
  senders.get(mediaId)?.cancel('local_cancel');
  const link = manager?.get(peerId);
  if (link?.isReadyToSend) {
    try {
      link.sendControl({kind: 'file_cancel', tid: mediaId, reason: 'local_cancel'});
    } catch {
      // link already gone
    }
  }
  const row = await getMedia(mediaId);
  if (row) {
    await updateMedia(mediaId, {status: 'cancelled'});
    emitChanged({...row, status: 'cancelled'});
  }
}

/** Manual retry: reset the backoff and re-queue immediately. */
export async function retryMedia(peerId: Uid, mediaId: string, peerPublicKey?: string): Promise<void> {
  assertConfigured();
  await updateMedia(mediaId, {status: 'queued', attempts: 0, nextRetryAt: null});
  const row = await getMedia(mediaId);
  if (row) emitChanged({...row, status: 'queued', attempts: 0, nextRetryAt: null});
  await flushOutbox(peerId, peerPublicKey);
}

/** Pick up due retries + re-queue them (call from the app foreground hook). */
export async function runScheduledRetries(): Promise<void> {
  if (!ctx || !started) return;
  const current = ctx;
  const rows = await listOutgoing(current.myUid);
  const due = rows.filter(
    m => m.status === 'failed' && m.nextRetryAt != null && m.nextRetryAt <= Date.now(),
  );
  for (const row of due) {
    await setTransferState(row.id, 'queued', row.attempts, null);
    emitChanged({...row, status: 'queued'});
  }
  const queued = (await listOutgoing(current.myUid)).filter(m => m.status === 'queued');
  for (const q of queued) {
    await flushOutbox(q.peerId);
  }
}

/* ---------------------------------------------------------------- incoming */

async function handleIncomingOffer(link: PeerLink, offer: FileOfferLike): Promise<void> {
  const current = ctx!;
  if (receivers.has(offer.tid)) return;
  const peerId = link.peerId;

  const existing = await getMedia(offer.messageId);
  if (existing && (existing.status === 'ready' || existing.status === 'delivered')) {
    link.sendControl({kind: 'file_complete', tid: offer.tid});
    return;
  }

  const ext = extensionFromName(offer.name);
  const finalUri = mediaFinalUri(current.myUid, peerId, offer.messageId, ext);

  if (!existing) {
    const row: MediaMessage = {
      id: offer.messageId,
      uid: current.myUid,
      peerId,
      direction: 'in',
      kind: offer.mediaKind,
      name: sanitizeFilename(offer.name),
      mime: offer.mime,
      size: offer.size,
      durationMs: offer.durationMs ?? null,
      path: finalUri,
      status: 'receiving',
      transferredChunks: 0,
      totalChunks: offer.totalChunks,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attempts: 0,
      nextRetryAt: null,
    };
    await createMedia(row);
    emitChanged({...row});
  }

  const receiver = new FileReceiver(
    link,
    {myUid: current.myUid, peerId, myPrivateKey: current.keys.private},
    {
      onProgress: ({index}) => {
        void progressMedia(offer.messageId, index, offer.totalChunks, 'receiving').catch(() => {});
      },
      onReady: ({messageId, uri}) => {
        receivers.delete(offer.tid);
        void (async () => {
          const stored = await getMedia(messageId);
          if (stored) {
            await updateMedia(messageId, {status: 'ready', path: uri, transferredChunks: offer.totalChunks, totalChunks: offer.totalChunks});
            emitChanged(await fresh(stored));
          }
        })();
      },
      onReject: reason => {
        receivers.delete(offer.tid);
        void failIncoming(offer.messageId, reason);
      },
    },
  );
  receivers.set(offer.tid, receiver);
  receiver.feedControl(offer);
}

async function failIncoming(id: string, _reason: string): Promise<void> {
  const row = await getMedia(id);
  if (!row || row.status === 'ready') return;
  await updateMedia(id, {status: 'failed'});
  emitChanged({...row, status: 'failed'});
}

/** Mark this peer's open incoming transfers failed (session/link lost). `.part` is kept for resume. */
async function failPeerTransfers(peerId: Uid, _reason: string): Promise<void> {
  if (!ctx) return;
  const rows = (await listIncompleteIncoming(ctx.myUid)).filter(m => m.peerId === peerId);
  for (const row of rows) {
    if (row.status === 'receiving') {
      await updateMedia(row.id, {status: 'failed'});
      emitChanged({...row, status: 'failed'});
    }
  }
}

function assertConfigured(): void {
  if (!started || !ctx) {
    throw new Error('media_service_not_configured');
  }
}
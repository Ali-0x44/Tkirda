import type { Unsubscribe } from '@react-native-firebase/firestore';
import {
    collection,
    doc,
    getFirestore,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from '@react-native-firebase/firestore';

import * as AES from '../Security/AES';
import { newTransferKey, unwrapTransferKey, wrapTransferKey } from '../Security/stream';
import type { Uid } from '../models';

/**
 * Signaling transport for P2P data (media) sessions: `sessions/{autoId}`.
 * Firestore is used ONLY as the rendezvous — SDP + ICE live inside a sealed
 * envelope; the AES envelope key is RSA-wrapped per recipient and stored
 * next to the envelope. Nothing transfer-related is stored elsewhere.
 */

export type SessionStatus = 'pending' | 'offer' | 'answer' | 'connected' | 'closed';

export type SessionEnvelopePayload = {
  type: 'offer' | 'answer';
  sdp: string;
  candidates: {candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null}[];
};

export type DataSessionDoc = {
  kind: 'data';
  initiatorId: Uid;
  peerId: Uid;
  status: SessionStatus;
  seq: number;
  envelope?: string;
  keys?: Record<Uid, string>;
  expireAt: number;
  updatedAt: unknown; // serverTimestamp()
  createdAt: unknown;
};

export type SessionEntry = {id: string; data: DataSessionDoc};
export type IncomingOffer = {id: string; doc: DataSessionDoc};

const SESSION_TTL_MS = 2 * 60 * 1000;

export function sessionId(): string {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isLive(doc: DataSessionDoc): boolean {
  return (doc.status === 'offer' || doc.status === 'answer') &&
    doc.expireAt > Date.now() &&
    !!doc.envelope;
}

/**
 * Generate a session key and write a fresh `pending` session row.
 * Returns the id + the random AESC session key we keep locally until publish.
 */
export async function beginDataSession(args: {initiatorId: Uid; peerId: Uid}): Promise<{id: string; sessionKeyHex: string}> {
  const id = sessionId();
  const sessionKeyHex = await newTransferKey();
  const now = Date.now();
  await setDoc(doc(getFirestore(), 'sessions', id), {
    kind: 'data',
    initiatorId: args.initiatorId,
    peerId: args.peerId,
    status: 'pending',
    seq: 0,
    expireAt: now + SESSION_TTL_MS,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return {id, sessionKeyHex};
}

/** Publish the sealed offer (+ RSA-wrapped key for the receiver). */
export async function publishOffer(args: {
  id: string;
  sessionKeyHex: string;
  receiverPublicKey: string;
  receiverUid: Uid;
  payload: SessionEnvelopePayload;
  seq?: number;
}): Promise<void> {
  const envelope = AES.encrypt(JSON.stringify(args.payload), args.sessionKeyHex);
  const wrappedKey = await wrapTransferKey(args.receiverPublicKey, args.sessionKeyHex);
  const now = Date.now();
  await updateDoc(doc(getFirestore(), 'sessions', args.id), {
    status: 'offer',
    seq: (args.seq ?? 0) + 1,
    envelope,
    keys: {[args.receiverUid]: wrappedKey} as Record<Uid, string>,
    expireAt: now + SESSION_TTL_MS,
    updatedAt: serverTimestamp(),
  });
}

/** Publish the sealed answer for the initiator. */
export async function publishAnswer(args: {
  id: string;
  sessionKeyHex: string;
  initiatorPublicKey: string;
  initiatorUid: Uid;
  payload: SessionEnvelopePayload;
  seq: number;
}): Promise<void> {
  const envelope = AES.encrypt(JSON.stringify(args.payload), args.sessionKeyHex);
  const wrappedKey = await wrapTransferKey(args.initiatorPublicKey, args.sessionKeyHex);
  const now = Date.now();
  await updateDoc(doc(getFirestore(), 'sessions', args.id), {
    status: 'answer',
    seq: args.seq + 1,
    envelope,
    keys: {[args.initiatorUid]: wrappedKey} as Record<Uid, string>,
    expireAt: now + SESSION_TTL_MS,
    updatedAt: serverTimestamp(),
  });
}

export async function markConnected(id: string, seq: number): Promise<void> {
  await updateDoc(doc(getFirestore(), 'sessions', id), {
    status: 'connected',
    seq: seq + 1,
    updatedAt: serverTimestamp(),
  });
}

export async function closeSession(id: string): Promise<void> {
  await updateDoc(doc(getFirestore(), 'sessions', id), {
    status: 'closed',
    updatedAt: serverTimestamp(),
  });
}

export async function touchSession(id: string): Promise<void> {
  await updateDoc(doc(getFirestore(), 'sessions', id), {
    updatedAt: serverTimestamp(),
  });
}

/** Open a sealed envelope with my private key (RSA-unwrap + AES-CBC). */
export async function openSessionEnvelope(
  docData: DataSessionDoc,
  myUid: Uid,
  myPrivateKey: string,
): Promise<SessionEnvelopePayload | null> {
  const wrapped = docData.keys?.[myUid];
  if (!docData.envelope || !wrapped) return null;
  const sessionKeyHex = await unwrapTransferKey(myPrivateKey, wrapped);
  try {
    return JSON.parse(AES.decrypt(docData.envelope, sessionKeyHex)) as SessionEnvelopePayload;
  } catch {
    return null;
  }
}

/**
 * Listen for incoming data-session offers addressed to me.
 * Filtered to live offers; each is reported at most once per subscription.
 */
export function subscribeIncomingOffers(
  myUid: Uid,
  onOffer: (offer: IncomingOffer) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const seen = new Set<string>();
  const ref = query(
    collection(getFirestore(), 'sessions'),
    where('peerId', '==', myUid),
  );
  return onSnapshot(
    ref,
    snap => {
      const docs = [...snap.docs].sort((a, b) => {
        const ta = Number((a.data() as DataSessionDoc | undefined)?.updatedAt ?? 0);
        const tb = Number((b.data() as DataSessionDoc | undefined)?.updatedAt ?? 0);
        return tb - ta;
      });
      for (const d of docs) {
        const data = d.data() as DataSessionDoc;
        if (!isLive(data) || data.kind !== 'data' || data.status !== 'offer') continue;
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        onOffer({id: d.id, doc: data});
      }
    },
    onError,
  );
}

/**
 * Subscribe to the live answer for a session I created (offer already sent).
 * Re-emits a new answer whenever seq advances.
 */
export function subscribeSessionUpdates(
  id: string,
  onUpdate: (entry: SessionEntry) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getFirestore(), 'sessions', id),
    snap => {
      if (!snap.exists) return;
      const data = snap.data() as DataSessionDoc;
      if (!data || (data.status !== 'answer' && data.status !== 'connected' && data.status !== 'closed')) return;
      onUpdate({id, data});
    },
    onError,
  );
}
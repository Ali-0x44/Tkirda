import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import type {Unsubscribe} from '@react-native-firebase/firestore';

import type {ManualEncryptionDoc, Uid} from '@/models';
import type {SealedMessage, WrappedKeys} from '@/Security';
import {decryptMessage, encryptFor} from '@/Security';

import {threadId} from './chatService';

/**
 * Manual encrypt/decrypt flow (PLAN §7, `encryption` collection). Unlike the
 * real-time chat thread, a manual message is written ONCE to
 * `encryption/{sender}_{receiver}/messages/{id}`; the AES key is wrapped for
 * the **receiver only** (PLAN §4 `ManualEncryptionDoc`). The sender sees it in
 * their SENT tab (`me_other`), the receiver in their INBOX tab (`other_me`).
 */

export type ManualEntry = {id: string; data: ManualEncryptionDoc};

export type WriteManualInput = {
  fromUid: Uid;
  toUid: Uid;
  msgId: string;
  sealed: SealedMessage;
};

export type SendManualInput = {
  fromUid: Uid;
  toUid: Uid;
  toPublicKey: string;
  text: string;
  msgId: string;
};

/** One-shot helper: seal for the receiver only, then store (tests/programmatic use). */
export async function sendManualMessage(input: SendManualInput): Promise<string> {
  const sealed = await encryptFor({[input.toUid]: input.toPublicKey}, input.text);
  return writeManualMessage({
    fromUid: input.fromUid,
    toUid: input.toUid,
    msgId: input.msgId,
    sealed,
  });
}

/** Persist an already-sealed manual message (keeps screen and wire identical). */
export async function writeManualMessage(input: WriteManualInput): Promise<string> {
  const body = {
    text: input.sealed.text,
    createdAt: serverTimestamp(),
    metadata: {keys: input.sealed.keys},
  };
  await setDoc(
    doc(
      getFirestore(),
      'encryption',
      threadId(input.fromUid, input.toUid),
      'messages',
      input.msgId,
    ),
    body,
  );
  return input.msgId;
}

/** The wrapped keys map written for a manual message (receiver only). */
export function manualKeys(wrapped: WrappedKeys): {keys: Record<string, string>} {
  return {keys: wrapped};
}

/**
 * Subscribe to one direction of a manual thread.
 * - SENT: pass `threadId(me, other)` (messages I wrote).
 * - INBOX: pass `threadId(other, me)` (messages they wrote to me).
 */
export function subscribeManualThread(
  thread: string,
  onData: (entries: ManualEntry[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const ref = query(
    collection(getFirestore(), 'encryption', thread, 'messages'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(ref, snap =>
    onData(snap.docs.map(d => ({id: d.id, data: d.data() as ManualEncryptionDoc}))),
    onError,
  );
}

/** Decrypt a stored manual message with our private key (PLAN §5). */
export async function decryptManualMessage(
  msg: ManualEncryptionDoc,
  myUid: Uid,
  myPrivateKey: string,
): Promise<string> {
  return decryptMessage({text: msg.text, keys: msg.metadata.keys}, myUid, myPrivateKey);
}
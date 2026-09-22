import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@react-native-firebase/firestore';
import type {Unsubscribe} from '@react-native-firebase/firestore';

import type {Message, MessageType, Uid} from '@/models';
import {decryptMessage, encryptFor} from '@/Security';

/**
 * Real-time chat (PLAN §4/§7). Threads are asymmetric: `chats/me_contact`.
 * A sent message is written once per direction (`me_contact` and
 * `contact_me`), each with the same id, ciphertext, and per-recipient wrapped
 * AES key. Nothing in Firestore is plaintext.
 */

export type ThreadMessage = Message & {plaintext?: string};
export type ThreadEntry = {id: string; data: Message};

/** Thread id for `chats/{me}_{other}` (asymmetric, PLAN §4). */
export function threadId(me: Uid, other: Uid): string {
  return `${me}_${other}`;
}

export type SendTextInput = {
  fromUid: Uid;
  fromPublicKey: string;
  toUid: Uid;
  toPublicKey: string;
  text: string;
  msgId: string;
};

/** Seal a text message for sender + receiver and write it to both threads. */
export async function sendTextMessage(input: SendTextInput): Promise<string> {
  const sealed = await encryptFor(
    {[input.fromUid]: input.fromPublicKey, [input.toUid]: input.toPublicKey},
    input.text,
  );

  const db = getFirestore();
  const body = {
    _id: input.msgId,
    type: 'text' as MessageType,
    text: sealed.text,
    createdAt: serverTimestamp(),
    user: {_id: input.fromUid},
    metadata: {keys: sealed.keys},
  };

  const forward = threadId(input.fromUid, input.toUid);
  const reverse = threadId(input.toUid, input.fromUid);
  await setDoc(doc(db, 'chats', forward, 'messages', input.msgId), body);
  await setDoc(doc(db, 'chats', reverse, 'messages', input.msgId), body);

  return input.msgId;
}

/**
 * Delete a message for both participants (WhatsApp "delete for everyone"):
 * the same doc id lives in both threads, so removing it there (plus its read
 * receipt) makes the message disappear on both devices.
 */
export async function deleteMessageForEveryone(
  msgId: string,
  fromUid: Uid,
  toUid: Uid,
): Promise<void> {
  const db = getFirestore();
  const forward = threadId(fromUid, toUid);
  const reverse = threadId(toUid, fromUid);
  await deleteDoc(doc(db, 'chats', forward, 'messages', msgId));
  await deleteDoc(doc(db, 'chats', reverse, 'messages', msgId));
  await deleteDoc(doc(db, 'receipts', msgId)).catch(() => {
    // No receipt was ever written for this message.
  });
}

/** Subscribe to a thread's messages, newest first (`createdAt desc`). */
export function subscribeMessages(
  thread: string,
  onData: (entries: ThreadEntry[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const ref = query(
    collection(getFirestore(), 'chats', thread, 'messages'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    ref,
    snap => onData(snap.docs.map(d => ({id: d.id, data: d.data() as Message}))),
    onError,
  );
}

/** Decrypt a stored chat message with our private key (PLAN §5). */
export async function decryptChatMessage(
  message: Message,
  myUid: Uid,
  myPrivateKey: string,
): Promise<string> {
  return decryptMessage(
    {text: message.text, keys: message.metadata.keys},
    myUid,
    myPrivateKey,
  );
}

/** Read receipt (PLAN·interim). `doc id` = the message id; `for` = the
 *  author (message `user._id`); `by` = the reader who saw it. */
export type ReadReceipt = {
  read: boolean;
  by: Uid;
  for: Uid;
  readAt: unknown; // serverTimestamp()
};

export type ReceiptEntry = {id: string; data: ReadReceipt};

/** The receiver marks a message as read. Dedupe in the caller. */
export async function markMessageRead(
  msgId: string,
  by: Uid,
  author: Uid,
): Promise<void> {
  await setDoc(doc(getFirestore(), 'receipts', msgId), {
    read: true,
    by,
    for: author,
    readAt: serverTimestamp(),
  });
}

/**
 * Subscribe to read receipts for messages I authored (`for == myUid`), so my
 * "Sent" messages flip to "Read" as soon as the recipient opens the chat.
 */
export function subscribeReadReceipts(
  myUid: Uid,
  onData: (entries: ReceiptEntry[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const ref = query(
    collection(getFirestore(), 'receipts'),
    where('for', '==', myUid),
  );
  return onSnapshot(
    ref,
    snap => onData(snap.docs.map(d => ({id: d.id, data: d.data() as ReadReceipt}))),
    onError,
  );
}

/**
 * Subscribe to the receipts I created (`by == myUid`) — i.e. messages I've
 * already read — so the chat list can badge per-contact unread counts.
 */
export function subscribeMyReceipts(
  myUid: Uid,
  onData: (entries: ReceiptEntry[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const ref = query(
    collection(getFirestore(), 'receipts'),
    where('by', '==', myUid),
  );
  return onSnapshot(
    ref,
    snap => onData(snap.docs.map(d => ({id: d.id, data: d.data() as ReadReceipt}))),
    onError,
  );
}
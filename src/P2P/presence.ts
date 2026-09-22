import {
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from '@react-native-firebase/firestore';

import type {Uid} from '../models';

/**
 * Lightweight online presence: a heartbeat doc under `presence/{uid}` with a
 * short TTL. Used to trigger outbox flushes when a peer comes back online.
 * Best-effort — transfers also (and more reliably) reflush whenever a
 * DataChannel to the peer actually opens.
 */

export const PRESENCE_TTL_MS = 2 * 60 * 1000;
const KEEPALIVE_MS = 45 * 1000;

let keepalive: ReturnType<typeof setInterval> | null = null;
let currentUid: Uid | null = null;

/** Publish our heartbeat now and every ~45 s while the chat is mounted. */
export function startPresence(uid: Uid): void {
  if (currentUid === uid && keepalive) return;
  stopPresence();
  currentUid = uid;
  void touchPresence(uid);
  keepalive = setInterval(() => void touchPresence(uid), KEEPALIVE_MS);
}

export async function touchPresence(uid: Uid): Promise<void> {
  try {
    await setDoc(doc(getFirestore(), 'presence', uid), {
      online: true,
      lastSeen: serverTimestamp(),
      expireAt: Date.now() + PRESENCE_TTL_MS,
    });
  } catch {
    // best-effort; transfers work without presence
  }
}

export function stopPresence(): void {
  if (currentUid) {
    void updateDoc(doc(getFirestore(), 'presence', currentUid), {online: false}).catch(() => {
      // ignore
    });
  }
  currentUid = null;
  if (keepalive) {
    clearInterval(keepalive);
    keepalive = null;
  }
}

/** Firestore Timestamp -> epoch ms (serverTimestamp is a Timestamp at read time). */
function lastSeenMs(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object') {
    const obj = value as {seconds?: number; toMillis?: () => number};
    if (typeof obj.toMillis === 'function') return obj.toMillis();
    if (typeof obj.seconds === 'number') return obj.seconds * 1000;
  }
  return null;
}

/** Notify on the *edge* of the peer's presence state (offline -> online etc.). */
export function subscribePeerPresence(
  peerUid: Uid,
  onOnline: (online: boolean) => void,
): Unsubscribe {
  let last: boolean | null = null;
  const ref = doc(getFirestore(), 'presence', peerUid);
  return onSnapshot(
    ref,
    {includeMetadataChanges: true},
    snap => {
      if (!snap.exists) {
        if (last !== false) {
          last = false;
          onOnline(false);
        }
        return;
      }
      const data = snap.data() as {online?: boolean; lastSeen?: unknown};
      const seen = lastSeenMs(data.lastSeen);
      const online = !!data.online && (seen == null || Date.now() - seen < PRESENCE_TTL_MS);
      if (online !== last) {
        last = online;
        onOnline(online);
      }
    },
    () => {
      if (last !== false) {
        last = false;
        onOnline(false);
      }
    },
  );
}
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';

import type {Uid, User} from '@/models';

export const PHONE_IN_USE = 'PHONE_IN_USE';

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, '');
}

export type NewUserProfile = {
  name: string;
  email: string;
  phone: string;
  publicKey: string;
};

/**
 * Creates the `users/{uid}` doc and claims `phones/{phone}` in a single
 * transaction (phone uniqueness, PLAN §4).
 */
export async function createUserProfile(
  uid: string,
  profile: NewUserProfile,
): Promise<void> {
  const db = getFirestore();
  const phone = normalizePhone(profile.phone);
  await runTransaction(db, async transaction => {
    const phoneRef = doc(db, 'phones', phone);
    const phoneSnap = await transaction.get(phoneRef);
    if (phoneSnap.exists()) {
      throw new Error(PHONE_IN_USE);
    }
    transaction.set(phoneRef, {uid});
    transaction.set(doc(db, 'users', uid), {
      userId: uid,
      name: profile.name,
      email: profile.email,
      phone,
      date: serverTimestamp(),
      publicKey: profile.publicKey,
    });
  });
}

export async function getUser(uid: string): Promise<User | null> {
  const db = getFirestore();
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) return snap.data() as User;
  const byUid = await getDocs(
    query(collection(db, 'users'), where('userId', '==', uid)),
  );
  if (!byUid.empty) return byUid.docs[0].data() as User;
  return null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const snap = await getDocs(
    query(collection(getFirestore(), 'users'), where('email', '==', email)),
  );
  if (snap.empty) return null;
  return snap.docs[0].data() as User;
}

/** Every user except `uid` (contacts list / manual-flow list). */
export async function listOtherUsers(uid: Uid): Promise<User[]> {
  const snap = await getDocs(collection(getFirestore(), 'users'));
  return snap.docs
    .map(d => d.data() as User)
    .filter(user => user.userId !== uid);
}

export type ProfilePatch = {
  name?: string;
  phone?: string;
};

/**
 * Update the `users/{uid}` doc. Name/phone only — Auth email stays the sign-in
 * identity, so email edits are intentionally not supported (PLAN §7 `update`).
 */
export async function updateUserProfile(uid: Uid, patch: ProfilePatch): Promise<void> {
  const data: Record<string, string> = {};
  if (patch.name != null) data.name = patch.name;
  if (patch.phone != null) data.phone = normalizePhone(patch.phone);

  if (data.name == null && data.phone == null) {
    return;
  }

  await updateDoc(doc(getFirestore(), 'users', uid), data);
}

export type PushTokenEntry = {
  token: string;
  platform: 'android' | 'ios';
};

function readPushTokens(data: Record<string, unknown> | null | undefined): PushTokenEntry[] {
  const list = data?.pushTokens;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (x): x is PushTokenEntry =>
      !!x &&
      typeof x === 'object' &&
      typeof (x as PushTokenEntry).token === 'string' &&
      ((x as PushTokenEntry).platform === 'android' || (x as PushTokenEntry).platform === 'ios'),
  );
}

/**
 * Registers this device's FCM token on the `users/{uid}` doc so the Cloud
 * Function can relay call pushes to it. Keeps only the 5 most recent tokens.
 * Best-effort: callers wrap us in try/catch since push is optional (the
 * Firestore in-app flow is the always-available fallback).
 */
export async function upsertPushToken(uid: Uid, entry: PushTokenEntry): Promise<void> {
  const db = getFirestore();
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const current = readPushTokens(snap.exists() ? snap.data() : null);
  const next = [...current.filter(t => t.token !== entry.token), entry].slice(-5);
  await updateDoc(userRef, {pushTokens: next});
}

export async function removePushToken(uid: Uid, token: string): Promise<void> {
  const db = getFirestore();
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const current = readPushTokens(snap.exists() ? snap.data() : null);
  const next = current.filter(t => t.token !== token);
  await updateDoc(userRef, {pushTokens: next});
}
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from '@react-native-firebase/auth';
import type {AuthError, Unsubscribe, User as AuthUser} from '@react-native-firebase/auth';

import * as keyStore from '@/Security/keyStore';
import {generateKeyPair} from '@/Security/RSA';

import {cacheProfile, clearProfile} from './sessionService';
import {createUserProfile, getUser, normalizePhone} from './userService';

export type {AuthUser};

/**
 * Firebase Auth Email/Password (our PLAN explicitly deviates from the
 * reference's custom SHA-hashed auth: no password or private key is ever
 * stored in Firestore). A private RSA key pair is generated locally at
 * sign-up and kept only in expo-secure-store (D3).
 */
export async function signUp(
  name: string,
  email: string,
  phone: string,
  password: string,
): Promise<AuthUser> {
  const {user} = await createUserWithEmailAndPassword(getAuth(), email, password);
  const keys = await generateKeyPair();
  await keyStore.saveKeys(user.uid, keys);
  await createUserProfile(user.uid, {
    name,
    email,
    phone,
    publicKey: keys.public,
  });
  await cacheProfile({uid: user.uid, name, email, phone: normalizePhone(phone)});
  return user;
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const {user} = await signInWithEmailAndPassword(getAuth(), email, password);
  const profile = await getUser(user.uid);
  if (profile) {
    await cacheProfile({
      uid: profile.userId,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
    });
  }
  return user;
}

export async function logout(): Promise<void> {
  await clearProfile();
  await signOut(getAuth());
}

export function watchAuthState(cb: (user: AuthUser | null) => void): Unsubscribe {
  return onAuthStateChanged(getAuth(), cb);
}

export function getCurrentUser(): AuthUser | null {
  return getAuth().currentUser;
}

export function authErrorMessage(error: unknown): string {
  const code = (error as AuthError)?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Try signing in.';
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/invalid-login-credentials':
      return 'Wrong email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
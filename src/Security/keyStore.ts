import * as SecureStore from 'expo-secure-store';

import type {RSAPair} from './RSA';

const KEY_PREFIX = 'keys.';

/**
 * Private/public key pair storage, scoped per user. Stored via
 * expo-secure-store (Android Keystore-backed). The private key never leaves
 * the device.
 */

export async function saveKeys(uid: string, keys: RSAPair): Promise<void> {
  await SecureStore.setItemAsync(`${KEY_PREFIX}${uid}`, JSON.stringify(keys));
}

export async function loadKeys(uid: string): Promise<RSAPair | null> {
  const raw = await SecureStore.getItemAsync(`${KEY_PREFIX}${uid}`);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as RSAPair;
}

export async function clearKeys(uid: string): Promise<void> {
  await SecureStore.deleteItemAsync(`${KEY_PREFIX}${uid}`);
}
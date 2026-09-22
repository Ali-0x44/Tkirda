import * as AES from './AES';
import * as RSA from './RSA';
import {sha256} from './SHA';

/**
 * High-level, stateless message sealing API (PLAN §5).
 *
 * Flow: a fresh AES key seals each payload `{t: text, h: sha256(text)}`;
 * the AES key is then RSA-wrapped for every recipient and carried in
 * `metadata.keys[uid]`. Nothing sensitive is ever stored in plaintext.
 */

export type RecipientPublicKeys = Record<string, string>; // uid -> public key
export type WrappedKeys = Record<string, string>; // uid -> RSA(AES key)

export type SealedMessage = {
  text: string; // AES ciphertext of {t, h}
  keys: WrappedKeys;
};

export class SecurityError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
  }
}

/** RSA-wrap an AES key for a specific recipient. */
export async function wrapKey(publicKey: string, aesKey: string): Promise<string> {
  return RSA.encrypt(publicKey, aesKey);
}

/** Open an RSA-wrapped AES key with our private key. */
export async function unwrapKey(privateKey: string, wrapped: string): Promise<string> {
  return RSA.decrypt(privateKey, wrapped);
}

/** Seal a plaintext message for one or more recipients. */
export async function encryptFor(
  recipientPublicKeys: RecipientPublicKeys,
  plaintext: string,
): Promise<SealedMessage> {
  const h = await sha256(plaintext);
  const aesKey = await AES.generateKey();
  const text = AES.encrypt(JSON.stringify({t: plaintext, h}), aesKey);

  const keys: WrappedKeys = {};
  for (const [uid, publicKey] of Object.entries(recipientPublicKeys)) {
    keys[uid] = await wrapKey(publicKey, aesKey);
  }

  return {text, keys};
}

/** Unseal a message sealed with `encryptFor`, verifying its integrity hash. */
export async function decryptMessage(
  msg: SealedMessage,
  myUid: string,
  myPrivateKey: string,
): Promise<string> {
  const wrapped = msg.keys?.[myUid];
  if (!wrapped) {
    throw new SecurityError('NO_KEY_FOR_USER', 'No wrapped key for this user');
  }

  let aesKey: string;
  try {
    aesKey = await unwrapKey(myPrivateKey, wrapped);
  } catch {
    throw new SecurityError('KEY_UNWRAP_FAILED', 'Failed to unwrap the session key');
  }

  let payload: {t?: unknown; h?: unknown};
  try {
    payload = JSON.parse(AES.decrypt(msg.text, aesKey)) as {t?: unknown; h?: unknown};
  } catch {
    throw new SecurityError('DECRYPT_FAILED', 'Failed to decrypt the payload');
  }

  const text = typeof payload.t === 'string' ? payload.t : '';
  const claimedHash = typeof payload.h === 'string' ? payload.h : '';
  const actualHash = await sha256(text);
  if (actualHash !== claimedHash) {
    throw new SecurityError('HASH_MISMATCH', 'Message integrity check failed');
  }

  return text;
}
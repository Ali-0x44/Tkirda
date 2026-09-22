import {getRandomBytes} from 'expo-crypto';
import QuickCrypto from 'react-native-quick-crypto';
import * as RSA from './RSA';

/**
 * Per-transfer encryption for media: AES-256-GCM.
 *
 * Unlike the message-level AES-256-CBC (crypto-js) this path uses
 * react-native-quick-crypto (OpenSSL) so every 16KiB chunk is authenticated.
 *
 * Key wrapping: the transfer AES key is random per transfer and wrapped for
 * the receiver with RSA (PKCS#1 v1.5, 2048-bit, 245-byte max — plenty for a
 * 64-char hex key).
 *
 * Chunk IV scheme: one random 12-byte base IV per transfer; chunk counter
 * overwrites the low 4 bytes => unique IV per chunk, no IV shipped per chunk.
 */

const KEY_BYTES = 32;
const BASE_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** Copy a Uint8Array into a quick-crypto Buffer (their API is Buffer-typed). */
function toQC(input: Uint8Array): QCBuffer {
  return (QuickCrypto.Buffer as unknown as {
    from(a: ArrayBufferLike, o: number, l: number): QCBuffer;
  }).from(input.buffer, input.byteOffset, input.byteLength);
}
type QCBuffer = InstanceType<typeof QuickCrypto.Buffer>;

function ivForChunk(baseIv: Uint8Array, counter: number): Uint8Array {
  const iv = new Uint8Array(BASE_IV_BYTES);
  iv.set(baseIv.subarray(0, BASE_IV_BYTES - 4), 0);
  iv.set([
    (counter >>> 24) & 0xff,
    (counter >>> 16) & 0xff,
    (counter >>> 8) & 0xff,
    counter & 0xff,
  ], BASE_IV_BYTES - 4);
  return iv;
}

/** Generate a fresh random 256-bit AES transfer key as hex. */
export async function newTransferKey(): Promise<string> {
  return bytesToHex(await getRandomBytes(KEY_BYTES));
}

export async function wrapTransferKey(publicKey: string, keyHex: string): Promise<string> {
  return RSA.encrypt(publicKey, keyHex);
}

export async function unwrapTransferKey(privateKey: string, wrapped: string): Promise<string> {
  return RSA.decrypt(privateKey, wrapped);
}

export type ChunkCipher = {
  baseIv: Uint8Array;
  /** ciphertext || authTag */
  sealChunk(counter: number, plain: Uint8Array, aad: Uint8Array): Uint8Array;
  /** throws on failed authentication */
  openChunk(counter: number, blob: Uint8Array, aad: Uint8Array): Uint8Array;
};

export function createChunkCipherSync(keyHex: string, baseIv: Uint8Array): ChunkCipher {
  const key = hexToBytes(keyHex);
  if (key.length !== KEY_BYTES) throw new Error('bad_key_length');
  if (baseIv.length !== BASE_IV_BYTES) throw new Error('bad_iv_length');

  return {
    baseIv,
    sealChunk(counter: number, plain: Uint8Array, aad: Uint8Array): Uint8Array {
      const iv = ivForChunk(baseIv, counter);
      const cipher = QuickCrypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(toQC(aad));
      const ct = cipher.update(toQC(plain));
      const fin = cipher.final();
      const tag = cipher.getAuthTag();
      return concat(ct, fin, tag);
    },
    openChunk(counter: number, blob: Uint8Array, aad: Uint8Array): Uint8Array {
      if (blob.length < GCM_TAG_BYTES) throw new Error('chunk_too_small');
      const ct = blob.subarray(0, blob.length - GCM_TAG_BYTES);
      const tag = blob.subarray(blob.length - GCM_TAG_BYTES);
      const iv = ivForChunk(baseIv, counter);
      const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(toQC(aad));
      decipher.setAuthTag(toQC(tag));
      const plain = decipher.update(toQC(ct));
      const fin = decipher.final();
      return concat(plain, fin);
    },
  };
}

export async function createChunkCipher(keyHex: string): Promise<ChunkCipher> {
  const baseIv = await getRandomBytes(BASE_IV_BYTES);
  return createChunkCipherSync(keyHex, baseIv);
}

/** wire size of an encrypted chunk for a given plaintext length */
export function chunkWireSize(plainBytes: number): number {
  return plainBytes + GCM_TAG_BYTES;
}

/** Total chunks needed to ship `size` bytes (matches mediaStore.chunkCount). */
export function chunkCountFor(size: number, chunkSize = 16 * 1024): number {
  return Math.max(1, Math.ceil(size / chunkSize));
}
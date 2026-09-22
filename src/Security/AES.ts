import CryptoJS from 'crypto-js';
import {getRandomBytes} from 'expo-crypto';

/**
 * AES-256-CBC with raw 32-byte keys (D4).
 * Keys come from expo-crypto's CSPRNG (never crypto-js's own RNG).
 *
 * crypto-js's raw-key path requires an explicit IV (its default-IV path is
 * broken with WordArray keys), so every seal embeds a fresh random IV:
 *   envelope = `<ivHex>:<OpenSSL-format ciphertext>`
 *
 * `encryptBase64`/`decryptBase64` operate on the raw bytes of a base64 string
 * (used for binary/audio payloads) instead of parsing the string as UTF-8.
 */

const KEY_BYTES = 32;
const IV_BYTES = 16;
const SEPARATOR = ':';

function parseHex(hex: string): CryptoJS.lib.WordArray {
  return CryptoJS.enc.Hex.parse(hex);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function randomBytesHex(count: number): string {
  return bytesToHex(getRandomBytes(count));
}

type Envelope = {iv: string; ciphertext: string};

function seal(iv: string, ciphertext: string): string {
  return `${iv}${SEPARATOR}${ciphertext}`;
}

function open(envelope: string): Envelope {
  const idx = envelope.indexOf(SEPARATOR);
  if (idx === -1) {
    throw new Error('Malformed cipher envelope');
  }
  return {iv: envelope.slice(0, idx), ciphertext: envelope.slice(idx + 1)};
}

/** Generate a random 256-bit AES key as a lowercase hex string. */
export async function generateKey(): Promise<string> {
  return randomBytesHex(KEY_BYTES);
}

/** AES-256-CBC encrypt a UTF-8 string with a hex key. */
export function encrypt(plain: string, keyHex: string): string {
  const iv = randomBytesHex(IV_BYTES);
  const ciphertext = CryptoJS.AES.encrypt(plain, parseHex(keyHex), {
    iv: parseHex(iv),
  }).toString();
  return seal(iv, ciphertext);
}

/** AES-256-CBC decrypt a string previously sealed with `encrypt`. */
export function decrypt(cipher: string, keyHex: string): string {
  const {iv, ciphertext} = open(cipher);
  const bytes = CryptoJS.AES.decrypt(ciphertext, parseHex(keyHex), {
    iv: parseHex(iv),
  });
  try {
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return bytes.toString(CryptoJS.enc.Latin1);
  }
}

/** Encrypt the raw bytes of a base64 string (binary/audio payloads). */
export function encryptBase64(b64: string, keyHex: string): string {
  const iv = randomBytesHex(IV_BYTES);
  const ciphertext = CryptoJS.AES.encrypt(
    CryptoJS.enc.Base64.parse(b64),
    parseHex(keyHex),
    {iv: parseHex(iv)},
  ).toString();
  return seal(iv, ciphertext);
}

/** Decrypt a sealed payload back to its original base64 string. */
export function decryptBase64(cipher: string, keyHex: string): string {
  const {iv, ciphertext} = open(cipher);
  const bytes = CryptoJS.AES.decrypt(ciphertext, parseHex(keyHex), {
    iv: parseHex(iv),
  });
  return bytes.toString(CryptoJS.enc.Base64);
}
import CryptoJS from 'crypto-js';

/**
 * SHA-256 digest. Pure JS (crypto-js), async wrapper for API consistency.
 * Returns lowercase hex.
 */
export async function sha256(input: string): Promise<string> {
  return CryptoJS.SHA256(input).toString(CryptoJS.enc.Hex);
}
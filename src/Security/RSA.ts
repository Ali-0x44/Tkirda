import {RSA} from 'react-native-rsa-native';

export type RSAPair = {
  public: string;
  private: string;
};

/**
 * RSA backend (react-native-rsa-native, native Android/iOS keystore-less
 * pure native crypto). 2048-bit keys.
 *
 * Note: this library does not expose OAEP, so PKCS#1 v1.5 padding is used.
 * The maximum message size is 2048/8 - 11 = 245 bytes, which is more than
 * enough for the wrapped 256-bit AES keys (64 hex chars).
 */

export async function generateKeyPair(): Promise<RSAPair> {
  const pair = await RSA.generateKeys(2048);
  return {public: pair.public, private: pair.private};
}

export async function encrypt(publicKey: string, data: string): Promise<string> {
  return RSA.encrypt(data, publicKey);
}

export async function decrypt(privateKey: string, cipher: string): Promise<string> {
  return RSA.decrypt(cipher, privateKey);
}
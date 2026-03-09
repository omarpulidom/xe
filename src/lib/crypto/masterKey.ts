import {
  Buffer,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "react-native-quick-crypto";
import { hexToBytes } from "./pbkdf2";

/**
 * Master Key — AES-256-GCM encryption.
 *
 * The Master Key is a 256-bit random key protecting all file keys.
 * It is encrypted with the PIN-derived key (PBKDF2) and stored in SecureStore.
 * The Master Key itself only ever lives in memory (RAM) — never on disk in plaintext.
 */

export type EncryptedMasterKey = {
  content: string; // base64 ciphertext
  iv: string; // base64 IV
  tag: string; // base64 auth tag (integrity + authenticity)
};

/**
 * Generates a new random 256-bit master key.
 */
export function generateMasterKey(): Uint8Array {
  return randomBytes(32) as unknown as Uint8Array;
}

/**
 * Encrypts the master key with the PIN-derived key using AES-256-GCM.
 * The GCM auth tag guarantees both confidentiality and integrity.
 */
export function encryptMasterKey(
  masterKey: Uint8Array,
  derivedKeyHex: string,
): EncryptedMasterKey {
  const key = Buffer.from(hexToBytes(derivedKeyHex));
  const iv = randomBytes(12) as unknown as Buffer;
  // biome-ignore lint/suspicious/noExplicitAny: quick-crypto CipherGCM types conflict with @types/node
  const cipher = createCipheriv("aes-256-gcm", key, iv) as any;

  const encrypted: Buffer = cipher.update(Buffer.from(masterKey));
  cipher.final();
  const tag: Buffer = cipher.getAuthTag();

  return {
    content: encrypted.toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    tag: tag.toString("base64"),
  };
}

/**
 * Decrypts the master key using the PIN-derived key.
 * Returns null if the auth tag fails (wrong PIN or tampered data).
 */
export function decryptMasterKey(
  enc: EncryptedMasterKey,
  derivedKeyHex: string,
): Uint8Array | null {
  try {
    const key = Buffer.from(hexToBytes(derivedKeyHex));
    const ivBuf = Buffer.from(enc.iv, "base64");
    const tagBuf = Buffer.from(enc.tag, "base64");
    // biome-ignore lint/suspicious/noExplicitAny: quick-crypto DecipherGCM types conflict with @types/node
    const decipher = createDecipheriv("aes-256-gcm", key, ivBuf) as any;
    decipher.setAuthTag(tagBuf);
    const decrypted: Buffer = decipher.update(
      Buffer.from(enc.content, "base64"),
    );
    decipher.final();
    return new Uint8Array(decrypted);
  } catch {
    return null; // Wrong PIN → GCM auth tag mismatch
  }
}

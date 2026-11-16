import { pbkdf2, randomBytes } from "react-native-quick-crypto";

/**
 * Key derivation using PBKDF2-HMAC-SHA256 via react-native-quick-crypto.
 *
 * 310,000 iterations — OWASP 2024 recommendation for PBKDF2-SHA256.
 */

const DEFAULT_ITERATIONS = 310_000;

/**
 * Generates a cryptographically random salt (32 bytes, hex encoded).
 */
export function generateSalt(): Promise<string> {
  return new Promise((resolve, reject) => {
    randomBytes(32, (err, bytes) => {
      if (err || !bytes) return reject(err ?? new Error("randomBytes failed"));
      resolve(bytesToHex(bytes as unknown as Uint8Array));
    });
  });
}

/**
 * Derives a 256-bit key from a PIN and salt using PBKDF2-HMAC-SHA256.
 *
 * @param pin - User's PIN
 * @param saltHex - Hex-encoded salt
 * @param iterations - PBKDF2 iterations (default: 310,000)
 * @returns Hex-encoded derived key (64 chars = 32 bytes)
 */
export function deriveKeyFromPIN(
  pin: string,
  saltHex: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<string> {
  return new Promise((resolve, reject) => {
    pbkdf2(
      pin,
      hexToBytes(saltHex),
      iterations,
      32,
      "sha256",
      (err, derivedKey) => {
        if (err || !derivedKey)
          return reject(err ?? new Error("PBKDF2 failed"));
        resolve(bytesToHex(derivedKey as unknown as Uint8Array));
      },
    );
  });
}

/**
 * Converts a Uint8Array to a hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Converts a hex string to a Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

import {
  closeSync,
  constants,
  openSync,
  readSync,
  statSync,
  unlinkSync,
  writeSync,
} from "react-native-nitro-file-system";
import {
  Buffer,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "react-native-quick-crypto";
import { bytesToHex, hexToBytes } from "./pbkdf2";

/**
 * Per-file encryption — AES-256-GCM throughout.
 *
 * Each file gets its own random 256-bit key (file_key).
 * File keys are encrypted with the Master Key and stored in SQLite.
 * Binary files are encrypted with AES-256-GCM using the file key.
 */

/**
 * Generates a random 256-bit file key (hex encoded).
 */
export function generateFileKey(): string {
  return bytesToHex(randomBytes(32));
}

/**
 * Encrypts a file key with the master key using AES-256-GCM.
 * Returns a JSON string containing {content, iv, tag} (all base64).
 */
export function encryptFileKey(
  fileKeyHex: string,
  masterKey: Uint8Array,
): string {
  const key = Buffer.from(masterKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const plaintext = Buffer.from(hexToBytes(fileKeyHex));
  const encrypted: Buffer = cipher.update(plaintext);
  cipher.final();
  const tag: Buffer = cipher.getAuthTag();

  return JSON.stringify({
    content: encrypted.toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    tag: tag.toString("base64"),
  });
}

/**
 * Decrypts a file key using the master key.
 * Returns null if the auth tag fails (tampered data or wrong key).
 */
export function decryptFileKey(
  encryptedFileKey: string,
  masterKey: Uint8Array,
): string | null {
  try {
    const { content, iv, tag } = JSON.parse(encryptedFileKey) as {
      content: string;
      iv: string;
      tag: string;
    };
    const key = Buffer.from(masterKey);
    const ivBuf = Buffer.from(iv, "base64");
    const tagBuf = Buffer.from(tag, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, ivBuf);
    decipher.setAuthTag(tagBuf);
    const decrypted: Buffer = decipher.update(Buffer.from(content, "base64"));
    decipher.final();
    return bytesToHex(new Uint8Array(decrypted));
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────

const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB per chunk — bounds peak RAM

/**
 * Reads a chunk from a file descriptor at a given position.
 */
function readChunkAtPosition(
  fd: number,
  length: number,
  position: number,
): Buffer {
  const buf = new Uint8Array(length);
  const bytesRead = readSync(fd, buf, 0, length, position);
  return Buffer.from(buf.buffer, buf.byteOffset, bytesRead);
}

function writeAll(fd: number, bytes: Uint8Array): void {
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(fd, bytes, offset, bytes.length - offset);
    if (written <= 0) throw new Error("Could not write encrypted file");
    offset += written;
  }
}

/**
 * Encrypts a binary file using AES-256-GCM with chunked I/O via FileHandle.
 * Output binary format: [IV(12)] [ciphertext(N)] [tag(16)]
 *
 * Peak RAM usage is bounded by CHUNK_SIZE regardless of file size.
 */
export async function encryptFile(
  inputUri: string,
  outputUri: string,
  fileKeyHex: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const key = Buffer.from(hexToBytes(fileKeyHex));
  const iv = randomBytes(12);

  let totalSize: number;
  try {
    totalSize = (statSync(inputUri) as { size: number }).size;
  } catch {
    throw new Error(`File not found: ${inputUri}`);
  }

  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const inputFd = openSync(inputUri, constants.O_RDONLY);
  let outputFd: number | null = null;
  try {
    outputFd = openSync(outputUri, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC);
    writeAll(outputFd, new Uint8Array(iv));
    let bytesRead = 0;
    while (bytesRead < totalSize) {
      const chunkLen = Math.min(CHUNK_SIZE, totalSize - bytesRead);
      const plainChunk = readChunkAtPosition(inputFd, chunkLen, bytesRead);
      if (plainChunk.length === 0) throw new Error("Source file ended during encryption");
      const encrypted: Buffer = cipher.update(plainChunk);
      writeAll(outputFd, encrypted);
      bytesRead += plainChunk.length;
      onProgress?.(bytesRead / totalSize);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    writeAll(outputFd, cipher.final());
    writeAll(outputFd, cipher.getAuthTag());
  } finally {
    closeSync(inputFd);
    if (outputFd !== null) closeSync(outputFd);
  }
}

/**
 * Decrypts a binary file encrypted by encryptFile.
 * Reads [IV(12)] from start and [tag(16)] from end via FileHandle,
 * then streams decryption in chunks.
 * Throws if the auth tag fails (tampered or corrupt file).
 */
export async function decryptFile(
  inputUri: string,
  outputUri: string,
  fileKeyHex: string,
): Promise<void> {
  const key = Buffer.from(hexToBytes(fileKeyHex));

  let totalSize: number;
  try {
    totalSize = (statSync(inputUri) as { size: number }).size;
  } catch {
    throw new Error(`File not found: ${inputUri}`);
  }

  const fd = openSync(inputUri, constants.O_RDONLY);
  try {
    // Read IV (first 12 bytes)
    const iv = readChunkAtPosition(fd, 12, 0);

    // Read auth tag (last 16 bytes)
    const tag = readChunkAtPosition(fd, 16, totalSize - 16);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const ciphertextEnd = totalSize - 16;
    const outFd = openSync(outputUri, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC);

    try {
      let readPos = 12;
      while (readPos < ciphertextEnd) {
        const chunkLen = Math.min(CHUNK_SIZE, ciphertextEnd - readPos);
        const cipherChunk = readChunkAtPosition(fd, chunkLen, readPos);
        if (cipherChunk.length === 0) throw new Error("Encrypted file ended unexpectedly");
        writeAll(outFd, decipher.update(cipherChunk));
        readPos += cipherChunk.length;
      }
      decipher.final();
    } catch (error) {
      closeSync(outFd);
      try { unlinkSync(outputUri); } catch { /* ignore */ }
      throw error;
    }
    closeSync(outFd);
  } finally {
    closeSync(fd);
  }
}

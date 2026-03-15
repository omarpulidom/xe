import { Paths } from "expo-file-system";
import fs, { getTempPath } from "react-native-nitro-file-system";
import { Buffer, randomUUID } from "react-native-quick-crypto";
import {
  decryptFileKey,
  decryptFile,
  encryptMasterKey,
  decryptMasterKey,
  generateSalt,
  deriveKeyFromPIN,
  bytesToHex,
  hexToBytes,
  type EncryptedMasterKey,
} from "@/lib/crypto";
import type { VaultFile } from "./vaultDB";
import {
  wrapDerivedKeyForRecipient,
  unwrapDerivedKeyWithLocalIdentity,
} from "./recipientAuth";

const EXPORT_FORMAT = "calc-vault-export";
const EXPORT_VERSION = 1;
const KDF_ITERATIONS = 310_000;

type ExportPackageFileMeta = {
  id: string;
  name: string;
  mime: string;
  size: number;
  created_at: number;
};

type ExportPayload = {
  encoding: "base64";
  data: string;
};

type ExportPackageFileEntry = {
  meta: ExportPackageFileMeta;
  payload: ExportPayload;
  wrapped_file_key?: EncryptedMasterKey;
};

type ExportPackageFile = {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  scope: "file";
  mode: "plain" | "encrypted";
  package_id: string;
  exported_at: number;
  file: ExportPackageFileMeta;
  payload: ExportPayload;
  crypto?: {
    kdf: {
      method: "pbkdf2-sha256";
      iterations: number;
      salt: string;
    };
    wrapped_file_key: EncryptedMasterKey;
    authorization?: {
      scheme: "rsa-oaep-sha256-v1";
      recipient_id: string;
      recipient_name: string;
      wrapped_derived_key: string;
    };
    note: string;
  };
};

type ExportPackageAlbum = {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  scope: "album";
  mode: "plain" | "encrypted";
  package_id: string;
  exported_at: number;
  album: {
    id: string;
    name: string;
  };
  files: ExportPackageFileEntry[];
  crypto?: {
    kdf: {
      method: "pbkdf2-sha256";
      iterations: number;
      salt: string;
    };
    authorization?: {
      scheme: "rsa-oaep-sha256-v1";
      recipient_id: string;
      recipient_name: string;
      wrapped_derived_key: string;
    };
    note: string;
  };
};

export type ExportPackage = ExportPackageFile | ExportPackageAlbum;

function ensureFileUri(pathOrUri: string): string {
  return pathOrUri.startsWith("file://") ? pathOrUri : `file://${pathOrUri}`;
}

function toFsPath(pathOrUri: string): string {
  return pathOrUri.replace(/^file:\/\//, "");
}

function dirPath(dir: { uri: string }): string {
  return dir.uri.startsWith("file://")
    ? dir.uri.slice(7).replace(/\/$/, "")
    : dir.uri.replace(/\/$/, "");
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file";
}

async function writePackageToCache(
  fileName: string,
  data: ExportPackage,
): Promise<string> {
  const outputPath = `${getTempPath()}/${fileName}`;
  fs.writeFileSync(outputPath, JSON.stringify(data), "utf8");
  return ensureFileUri(outputPath);
}

export async function createPlainExportFilePackage(input: {
  file: VaultFile;
  decryptedFilePath: string;
}): Promise<string> {
  const payloadBuffer = fs.readFileSync(toFsPath(input.decryptedFilePath)) as
    | Buffer
    | string;
  const payloadBase64 =
    typeof payloadBuffer === "string"
      ? Buffer.from(payloadBuffer, "utf8").toString("base64")
      : payloadBuffer.toString("base64");

  const pkg: ExportPackage = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    scope: "file",
    mode: "plain",
    package_id: randomUUID(),
    exported_at: Date.now(),
    file: {
      id: input.file.id,
      name: input.file.name,
      mime: input.file.mime,
      size: input.file.size,
      created_at: input.file.created_at,
    },
    payload: {
      encoding: "base64",
      data: payloadBase64,
    },
  };

  const outName = `${sanitizeName(input.file.name)}_${Date.now()}.calcx`;
  return await writePackageToCache(outName, pkg);
}

export async function createEncryptedExportFilePackage(input: {
  file: VaultFile;
  masterKey: Uint8Array;
  passphrase: string;
  recipient?: {
    id: string;
    name: string;
    publicKeyPem: string;
  };
}): Promise<string> {
  const encryptedSourcePath = `${dirPath(Paths.document)}/${input.file.file_path}`;
  const payloadBuffer = fs.readFileSync(encryptedSourcePath) as Buffer | string;
  const payloadBase64 =
    typeof payloadBuffer === "string"
      ? Buffer.from(payloadBuffer, "utf8").toString("base64")
      : payloadBuffer.toString("base64");

  const fileKeyHex = decryptFileKey(input.file.encrypted_key, input.masterKey);
  if (!fileKeyHex) {
    throw new Error("Could not decrypt file key for export");
  }

  const salt = await generateSalt();
  const derivedKeyHex = await deriveKeyFromPIN(
    input.passphrase,
    salt,
    KDF_ITERATIONS,
  );

  const wrappedFileKey = encryptMasterKey(
    hexToBytes(fileKeyHex),
    derivedKeyHex,
  );

  const authorization = input.recipient
    ? {
        scheme: "rsa-oaep-sha256-v1" as const,
        recipient_id: input.recipient.id,
        recipient_name: input.recipient.name,
        wrapped_derived_key: wrapDerivedKeyForRecipient({
          derivedKeyHex,
          recipientPublicKeyPem: input.recipient.publicKeyPem,
        }),
      }
    : undefined;

  const pkg: ExportPackage = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    scope: "file",
    mode: "encrypted",
    package_id: randomUUID(),
    exported_at: Date.now(),
    file: {
      id: input.file.id,
      name: input.file.name,
      mime: input.file.mime,
      size: input.file.size,
      created_at: input.file.created_at,
    },
    payload: {
      encoding: "base64",
      data: payloadBase64,
    },
    crypto: {
      kdf: {
        method: "pbkdf2-sha256",
        iterations: KDF_ITERATIONS,
        salt,
      },
      wrapped_file_key: wrappedFileKey,
      authorization,
      note: "Decrypt this package only inside Calc app.",
    },
  };

  const outName = `${sanitizeName(input.file.name)}_${Date.now()}.calcx`;
  return await writePackageToCache(outName, pkg);
}

export async function createPlainExportAlbumPackage(input: {
  albumId: string;
  albumName: string;
  files: Array<{ file: VaultFile; decryptedFilePath: string }>;
}): Promise<string> {
  const fileEntries: ExportPackageFileEntry[] = input.files.map(
    ({ file, decryptedFilePath }) => {
      const payloadBuffer = fs.readFileSync(toFsPath(decryptedFilePath)) as
        | Buffer
        | string;
      const payloadBase64 =
        typeof payloadBuffer === "string"
          ? Buffer.from(payloadBuffer, "utf8").toString("base64")
          : payloadBuffer.toString("base64");

      return {
        meta: {
          id: file.id,
          name: file.name,
          mime: file.mime,
          size: file.size,
          created_at: file.created_at,
        },
        payload: {
          encoding: "base64",
          data: payloadBase64,
        },
      };
    },
  );

  const pkg: ExportPackage = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    scope: "album",
    mode: "plain",
    package_id: randomUUID(),
    exported_at: Date.now(),
    album: {
      id: input.albumId,
      name: input.albumName,
    },
    files: fileEntries,
  };

  const outName = `${sanitizeName(input.albumName)}_${Date.now()}.calcx`;
  return await writePackageToCache(outName, pkg);
}

export async function createEncryptedExportAlbumPackage(input: {
  albumId: string;
  albumName: string;
  files: VaultFile[];
  masterKey: Uint8Array;
  passphrase: string;
  recipient?: {
    id: string;
    name: string;
    publicKeyPem: string;
  };
}): Promise<string> {
  const salt = await generateSalt();
  const derivedKeyHex = await deriveKeyFromPIN(
    input.passphrase,
    salt,
    KDF_ITERATIONS,
  );

  const fileEntries: ExportPackageFileEntry[] = input.files.map((file) => {
    const encryptedSourcePath = `${dirPath(Paths.document)}/${file.file_path}`;
    const payloadBuffer = fs.readFileSync(encryptedSourcePath) as
      | Buffer
      | string;
    const payloadBase64 =
      typeof payloadBuffer === "string"
        ? Buffer.from(payloadBuffer, "utf8").toString("base64")
        : payloadBuffer.toString("base64");

    const fileKeyHex = decryptFileKey(file.encrypted_key, input.masterKey);
    if (!fileKeyHex) {
      throw new Error(`Could not decrypt file key for export: ${file.name}`);
    }

    return {
      meta: {
        id: file.id,
        name: file.name,
        mime: file.mime,
        size: file.size,
        created_at: file.created_at,
      },
      payload: {
        encoding: "base64",
        data: payloadBase64,
      },
      wrapped_file_key: encryptMasterKey(hexToBytes(fileKeyHex), derivedKeyHex),
    };
  });

  const authorization = input.recipient
    ? {
        scheme: "rsa-oaep-sha256-v1" as const,
        recipient_id: input.recipient.id,
        recipient_name: input.recipient.name,
        wrapped_derived_key: wrapDerivedKeyForRecipient({
          derivedKeyHex,
          recipientPublicKeyPem: input.recipient.publicKeyPem,
        }),
      }
    : undefined;

  const pkg: ExportPackage = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    scope: "album",
    mode: "encrypted",
    package_id: randomUUID(),
    exported_at: Date.now(),
    album: {
      id: input.albumId,
      name: input.albumName,
    },
    files: fileEntries,
    crypto: {
      kdf: {
        method: "pbkdf2-sha256",
        iterations: KDF_ITERATIONS,
        salt,
      },
      authorization,
      note: "Decrypt this package only inside Calc app.",
    },
  };

  const outName = `${sanitizeName(input.albumName)}_${Date.now()}.calcx`;
  return await writePackageToCache(outName, pkg);
}

export async function readExportPackage(
  pathOrUri: string,
): Promise<ExportPackage> {
  const raw = fs.readFileSync(toFsPath(pathOrUri), "utf8") as string;

  const parsed = JSON.parse(raw) as ExportPackage;
  if (parsed.format !== EXPORT_FORMAT || parsed.version !== EXPORT_VERSION) {
    throw new Error("Unsupported export package format");
  }

  return parsed;
}

export async function decryptExportedFileKey(input: {
  wrappedFileKey: EncryptedMasterKey;
  passphrase: string;
  salt: string;
  iterations: number;
}): Promise<string | null> {
  const derivedKeyHex = await deriveKeyFromPIN(
    input.passphrase,
    input.salt,
    input.iterations,
  );

  const bytes = decryptMasterKey(input.wrappedFileKey, derivedKeyHex);
  if (!bytes) return null;
  return bytesToHex(bytes);
}

export async function importExportPackageToAlbum(input: {
  packagePathOrUri: string;
  albumId: string;
  passphrase?: string;
  addFileToAlbum: (
    albumId: string,
    plainUri: string,
    mime: string,
    name: string,
  ) => Promise<void>;
}): Promise<{
  mode: "plain" | "encrypted";
  importedCount: number;
  label: string;
}> {
  const pkg = await readExportPackage(input.packagePathOrUri);
  const token = `${Date.now()}_${randomUUID()}`;

  const cleanupPaths: string[] = [];

  try {
    if (pkg.scope === "file") {
      const encryptedTempPath = `${getTempPath()}/import_${token}.enc`;
      const plainTempPath = `${getTempPath()}/import_${token}.plain`;

      if (pkg.mode === "plain") {
        const raw = Buffer.from(pkg.payload.data, "base64");
        fs.writeFileSync(plainTempPath, raw);
        cleanupPaths.push(plainTempPath);

        await input.addFileToAlbum(
          input.albumId,
          plainTempPath,
          pkg.file.mime,
          pkg.file.name,
        );

        return { mode: "plain", importedCount: 1, label: pkg.file.name };
      }

      if (!pkg.crypto) {
        throw new Error("Encrypted package metadata missing");
      }

      if (!input.passphrase) {
        throw new Error("Passphrase required");
      }

      const derivedKeyHex = await deriveKeyFromPIN(
        input.passphrase,
        pkg.crypto.kdf.salt,
        pkg.crypto.kdf.iterations,
      );

      const fileKeyHex = await decryptExportedFileKey({
        wrappedFileKey: pkg.crypto.wrapped_file_key,
        passphrase: input.passphrase,
        salt: pkg.crypto.kdf.salt,
        iterations: pkg.crypto.kdf.iterations,
      });

      if (!fileKeyHex) {
        throw new Error("Invalid passphrase");
      }

      if (pkg.crypto.authorization?.wrapped_derived_key) {
        const unwrapped = await unwrapDerivedKeyWithLocalIdentity(
          pkg.crypto.authorization.wrapped_derived_key,
        );
        if (!unwrapped) {
          throw new Error("Unauthorized recipient device");
        }
        if (unwrapped !== derivedKeyHex) {
          throw new Error("Invalid passphrase");
        }
      }

      fs.writeFileSync(
        encryptedTempPath,
        Buffer.from(pkg.payload.data, "base64"),
      );
      cleanupPaths.push(encryptedTempPath);

      await decryptFile(encryptedTempPath, plainTempPath, fileKeyHex);
      cleanupPaths.push(plainTempPath);

      await input.addFileToAlbum(
        input.albumId,
        plainTempPath,
        pkg.file.mime,
        pkg.file.name,
      );

      return { mode: "encrypted", importedCount: 1, label: pkg.file.name };
    }

    if (pkg.mode === "plain") {
      for (let i = 0; i < pkg.files.length; i++) {
        const entry = pkg.files[i];
        const plainTempPath = `${getTempPath()}/import_${token}_${i}.plain`;
        fs.writeFileSync(
          plainTempPath,
          Buffer.from(entry.payload.data, "base64"),
        );
        cleanupPaths.push(plainTempPath);

        await input.addFileToAlbum(
          input.albumId,
          plainTempPath,
          entry.meta.mime,
          entry.meta.name,
        );
      }

      return {
        mode: "plain",
        importedCount: pkg.files.length,
        label: pkg.album.name,
      };
    }

    if (!pkg.crypto) {
      throw new Error("Encrypted package metadata missing");
    }

    if (!input.passphrase) {
      throw new Error("Passphrase required");
    }

    const derivedKeyHex = await deriveKeyFromPIN(
      input.passphrase,
      pkg.crypto.kdf.salt,
      pkg.crypto.kdf.iterations,
    );

    if (pkg.crypto.authorization?.wrapped_derived_key) {
      const unwrapped = await unwrapDerivedKeyWithLocalIdentity(
        pkg.crypto.authorization.wrapped_derived_key,
      );
      if (!unwrapped) {
        throw new Error("Unauthorized recipient device");
      }
      if (unwrapped !== derivedKeyHex) {
        throw new Error("Invalid passphrase");
      }
    }

    for (let i = 0; i < pkg.files.length; i++) {
      const entry = pkg.files[i];
      if (!entry.wrapped_file_key) {
        throw new Error("Missing wrapped file key in encrypted album package");
      }

      const bytes = decryptMasterKey(entry.wrapped_file_key, derivedKeyHex);
      if (!bytes) {
        throw new Error("Invalid passphrase");
      }

      const fileKeyHex = bytesToHex(bytes);
      const encryptedTempPath = `${getTempPath()}/import_${token}_${i}.enc`;
      const plainTempPath = `${getTempPath()}/import_${token}_${i}.plain`;

      fs.writeFileSync(
        encryptedTempPath,
        Buffer.from(entry.payload.data, "base64"),
      );
      cleanupPaths.push(encryptedTempPath);

      await decryptFile(encryptedTempPath, plainTempPath, fileKeyHex);
      cleanupPaths.push(plainTempPath);

      await input.addFileToAlbum(
        input.albumId,
        plainTempPath,
        entry.meta.mime,
        entry.meta.name,
      );
    }

    return {
      mode: "encrypted",
      importedCount: pkg.files.length,
      label: pkg.album.name,
    };
  } finally {
    for (const path of cleanupPaths) {
      try {
        fs.unlinkSync(path);
      } catch {
        /* ignore cleanup errors */
      }
    }
  }
}

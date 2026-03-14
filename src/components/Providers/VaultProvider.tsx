import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Paths } from "expo-file-system"; // kept only for document/cache directory path constants
import fs from "react-native-nitro-file-system";

/** Converts an expo Directory.uri (file://...) to a plain POSIX path for nitro-fs. */
function dirPath(dir: { uri: string }): string {
  return dir.uri.startsWith("file://")
    ? dir.uri.slice(7).replace(/\/$/, "")
    : dir.uri.replace(/\/$/, "");
}
import * as Updates from "expo-updates";
import { randomUUID } from "react-native-quick-crypto";
import {
  deriveKeyFromPIN,
  generateSalt,
  generateMasterKey,
  encryptMasterKey,
  decryptMasterKey,
  resetAttempts,
  recordFailedAttempt,
  getFailedAttempts,
  getLockedUntil,
  isLocked as isLockedCheck,
  generateFileKey,
  encryptFileKey,
  decryptFileKey,
  encryptFile,
  decryptFile,
} from "@/lib/crypto";
import {
  isVaultSetup as checkVaultSetup,
  saveSalt,
  loadSalt,
  saveMasterKeyEnc,
  loadMasterKeyEnc,
  markVaultSetupComplete,
  clearVault,
  dropAllTables,
  addLog,
  createFile,
  getDB,
  type VaultFile,
} from "@/lib/vault";
import { WARNING_CLEAR_ALL_MMKVS_INSTANCES } from "@/lib/mmkv/stores";
import { useGlobalStore } from "@/store";

type VaultContextValue = {
  /** Whether the vault is unlocked and master key is in memory */
  isUnlocked: boolean;
  /** Whether this is the first time (vault not yet created) */
  isSetup: boolean;
  /** Whether we're still loading initial state */
  isInitializing: boolean;
  /** Number of failed PIN attempts */
  failedAttempts: number;
  /** Timestamp until which the vault is locked out */
  lockedUntil: number | null;
  /** Whether the vault is currently in lockout */
  isLockedOut: boolean;
  /** Last successful unlock timestamp */
  lastUnlockTime: number | null;
  /** Set up vault for the first time with a PIN */
  setup: (pin: string) => Promise<void>;
  /** Attempt to unlock the vault with a PIN */
  unlock: (pin: string) => Promise<boolean>;
  /** Lock the vault (wipe master key from memory and clear cache) */
  lock: () => Promise<void>;
  /** Get the raw master key (only available when unlocked) */
  getMasterKey: () => Uint8Array | null;
  /** Add a plain file to an album, encrypting it and saving to DB */
  addFileToAlbum: (
    albumId: string,
    plainUri: string,
    mime: string,
    name: string,
  ) => Promise<void>;
  /** Decrypts a file temporarily to CacheDirectory for viewing. Returns the URI of the decrypted file. */
  decryptFileToCache: (fileId: string) => Promise<string | null>;
  /** [DEV] Wipes ALL app data: SecureStore, SQLite, encrypted files, MMKV */
  resetAllData: () => Promise<void>;
  // Future biometry:
  // unlockWithBiometry: () => Promise<boolean>
  // isBiometryEnabled: boolean
  // enableBiometry: () => Promise<void>
};

const VaultContext = createContext<VaultContextValue | null>(null);

type VaultProviderProps = {
  children: ReactNode;
};

export function VaultProvider({ children }: VaultProviderProps) {
  const [isSetup, setIsSetup] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const isUnlocked = useGlobalStore((state) => state.vault.isUnlocked);
  const lastUnlockTime = useGlobalStore((state) => state.vault.lastUnlockTime);
  const setUnlocked = useGlobalStore((state) => state.vault.setUnlocked);
  const lockStore = useGlobalStore((state) => state.vault.lock);

  // Bootstrap: check if vault is set up
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const vaultExists = await checkVaultSetup();
        if (mounted) {
          setIsSetup(vaultExists);
          setFailedAttempts(getFailedAttempts());
          setLockedUntil(getLockedUntil());
        }
      } catch (error) {
        console.error("[VaultProvider] init error:", error);
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const setup = useCallback(
    async (pin: string) => {
      // 1. Generate salt
      const salt = await generateSalt();

      // 2. Derive key from PIN
      const derivedKey = await deriveKeyFromPIN(pin, salt);

      // 3. Generate master key
      const masterKey = await generateMasterKey();

      // 4. Encrypt master key with derived key
      const encryptedMK = encryptMasterKey(masterKey, derivedKey);

      // 5. Save everything to secure storage
      await saveSalt(salt);
      await saveMasterKeyEnc(encryptedMK);
      await markVaultSetupComplete();

      // 6. Log the event
      await addLog("vault_created", "Vault created successfully");

      // 7. Set state
      setUnlocked(masterKey);
      setIsSetup(true);
      resetAttempts();
      setFailedAttempts(0);
      setLockedUntil(null);
    },
    [setUnlocked],
  );

  const unlock = useCallback(
    async (pin: string): Promise<boolean> => {
      // Check lockout
      if (isLockedCheck()) {
        setLockedUntil(getLockedUntil());
        return false;
      }

      // 1. Load salt
      const salt = await loadSalt();
      if (!salt) {
        console.error("[VaultProvider] No salt found");
        return false;
      }

      // 2. Derive key from PIN
      const derivedKey = await deriveKeyFromPIN(pin, salt);

      // 3. Load encrypted master key
      const encryptedMK = await loadMasterKeyEnc();
      if (!encryptedMK) {
        console.error("[VaultProvider] No encrypted master key found");
        return false;
      }

      // 4. Attempt decryption
      const masterKey = decryptMasterKey(encryptedMK, derivedKey);

      if (!masterKey) {
        // Wrong PIN
        const result = recordFailedAttempt();
        setFailedAttempts(result.attempts);
        setLockedUntil(result.lockedUntil);
        await addLog("unlock_failed", `Failed attempt #${result.attempts}`);
        return false;
      }

      // Success!
      setUnlocked(masterKey);
      resetAttempts();
      setFailedAttempts(0);
      setLockedUntil(null);
      await addLog("unlock_success", "Vault unlocked with PIN");

      return true;
    },
    [setUnlocked],
  );

  const lock = useCallback(async () => {
    lockStore();
    await addLog("vault_locked", "Vault locked by user");

    // Wipe decrypted temp files from cache
    try {
      const cachePath = dirPath(Paths.cache);
      for (const name of fs.readdirSync(cachePath) as string[]) {
        if (name.startsWith("temp_")) {
          try {
            fs.unlinkSync(`${cachePath}/${name}`);
          } catch {
            /* ignore */
          }
        }
      }
    } catch (e) {
      console.error("[VaultProvider] Cache cleanup error on lock", e);
    }
  }, [lockStore]);

  const getMasterKey = useCallback((): Uint8Array | null => {
    return useGlobalStore.getState().vault.masterKey;
  }, []);

  const addFileToAlbum = useCallback(
    async (albumId: string, plainUri: string, mime: string, name: string) => {
      const masterKey = getMasterKey();
      if (!masterKey) throw new Error("Vault is locked");

      const fileId = randomUUID();
      const fileKeyHex = await generateFileKey();
      const encryptedKey = encryptFileKey(fileKeyHex, masterKey);

      const encryptedFileName = `${fileId}.enc`;
      const outputPath = `${dirPath(Paths.document)}/${encryptedFileName}`;

      await encryptFile(plainUri, outputPath, fileKeyHex);

      try {
        const size = fs.existsSync(plainUri.replace(/^file:\/\//, ""))
          ? (
              fs.statSync(plainUri.replace(/^file:\/\//, "")) as {
                size: number;
              }
            ).size
          : 0;

        await createFile({
          id: fileId,
          album_id: albumId,
          name,
          mime,
          size,
          encrypted_key: encryptedKey,
          file_path: encryptedFileName,
        });
      } catch (err) {
        // Rollback: remove orphaned encrypted file
        try {
          fs.unlinkSync(outputPath);
        } catch {
          /* ignore */
        }
        throw err;
      }

      await addLog("file_added", `Added ${name} to album ${albumId}`);
    },
    [getMasterKey],
  );

  const decryptFileToCache = useCallback(
    async (fileId: string): Promise<string | null> => {
      const masterKey = getMasterKey();
      if (!masterKey) return null;

      const db = await getDB();
      const fileRow = await db.getFirstAsync<VaultFile>(
        "SELECT * FROM files WHERE id = ?",
        [fileId],
      );
      if (!fileRow) return null;

      const fileKeyHex = decryptFileKey(fileRow.encrypted_key, masterKey);
      if (!fileKeyHex) throw new Error("Failed to decrypt file key");

      const encryptedUri = `${dirPath(Paths.document)}/${fileRow.file_path}`;
      const tempDecryptedUri = `${dirPath(Paths.cache)}/temp_${fileId}_${fileRow.name}`;

      await decryptFile(encryptedUri, tempDecryptedUri, fileKeyHex);

      return tempDecryptedUri;
    },
    [getMasterKey],
  );

  const resetAllData = useCallback(async () => {
    // 1. SecureStore
    await clearVault();
    // 2. SQLite tables
    try {
      await dropAllTables();
    } catch (_) {}
    // 3. MMKV stores — clear in-memory state while backing files still exist
    WARNING_CLEAR_ALL_MMKVS_INSTANCES();
    // 4. ALL files on disk — including mmkv backing files so corruption
    //    cannot survive a reload. The live instances are already cleared
    //    above, and Updates.reloadAsync() below will create fresh ones.
    try {
      const docPath = dirPath(Paths.document);
      for (const name of fs.readdirSync(docPath) as string[]) {
        try {
          fs.rmSync(`${docPath}/${name}`, { recursive: true });
        } catch {
          /* ignore */
        }
      }
    } catch (_) {}
    // 5. Cache directory
    try {
      const cachePath = dirPath(Paths.cache);
      for (const name of fs.readdirSync(cachePath) as string[]) {
        try {
          fs.rmSync(`${cachePath}/${name}`, { recursive: true });
        } catch {
          /* ignore */
        }
      }
    } catch (_) {}
    // 6. Reload the bundle — avoids any post-clear Zustand writes to MMKV
    await Updates.reloadAsync();
  }, []);

  const isLockedOut = useMemo(() => {
    if (!lockedUntil) return false;
    return lockedUntil > Date.now();
  }, [lockedUntil]);

  const value = useMemo<VaultContextValue>(
    () => ({
      isUnlocked,
      isSetup,
      isInitializing,
      failedAttempts,
      lockedUntil,
      isLockedOut,
      lastUnlockTime,
      setup,
      unlock,
      lock,
      getMasterKey,
      addFileToAlbum,
      decryptFileToCache,
      resetAllData,
    }),
    [
      isUnlocked,
      isSetup,
      isInitializing,
      failedAttempts,
      lockedUntil,
      isLockedOut,
      lastUnlockTime,
      setup,
      unlock,
      lock,
      getMasterKey,
      addFileToAlbum,
      decryptFileToCache,
      resetAllData,
    ],
  );

  return (
    <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);

  if (!context) {
    throw new Error("useVault must be used within a VaultProvider");
  }

  return context;
}

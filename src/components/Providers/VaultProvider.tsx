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
import fs, { getTempPath } from "react-native-nitro-file-system";

/** Converts an expo Directory.uri (file://...) to a plain POSIX path for nitro-fs. */
function dirPath(dir: { uri: string }): string {
  return dir.uri.startsWith("file://")
    ? dir.uri.slice(7).replace(/\/$/, "")
    : dir.uri.replace(/\/$/, "");
}
import * as Updates from "expo-updates";
import { randomUUID } from "react-native-quick-crypto";
import {
  generateMasterKey,
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
  clearLegacyVault,
  addLog,
  createFile,
  getDB,
  closeDB,
  openProfileDB,
  initializeProfileDB,
  deleteProfileDB,
  clearLegacyRecipientIdentity,
  type VaultFile,
} from "@/lib/vault";
import { WARNING_CLEAR_ALL_MMKVS_INSTANCES } from "@/lib/mmkv/stores";
import { useGlobalStore } from "@/store";
import { useChatStore } from "@/store/chat.store";
import { WARNING_CLEAR_QUERY_CLIENT } from "@/lib/qc";
import { removeProfileValue } from "@/lib/vault/profileStorage";
import {
  addProfileSlot,
  clearActiveProfile,
  clearProfileSlots,
  getActiveProfile,
  loadProfileSlots,
  isFreshInstallPrepared,
  markFreshInstallPrepared,
  makeProfileSlot,
  randomProfileKey,
  removeProfileSlot,
  replaceProfileSlot,
  resolveProfile,
  setActiveProfile,
  type ProfileRole,
} from "@/lib/vault/profiles";

function removeDirectoryContents(dir: { uri: string }) {
  const path = dirPath(dir);
  if (!fs.existsSync(path)) return;
  for (const name of fs.readdirSync(path) as string[]) {
    fs.rmSync(`${path}/${name}`, { recursive: true });
  }
}

function removeCachedPackages() {
  const path = getTempPath();
  if (!fs.existsSync(path)) return;
  for (const name of fs.readdirSync(path) as string[]) {
    if (name.endsWith(".xe")) fs.unlinkSync(`${path}/${name}`);
  }
}

function removeDecryptedTempFiles() {
  const path = dirPath(Paths.cache);
  if (!fs.existsSync(path)) return;
  for (const name of fs.readdirSync(path) as string[]) {
    if (name.startsWith("temp_")) fs.unlinkSync(`${path}/${name}`);
  }
}

type VaultContextValue = {
  /** Whether the vault is unlocked and master key is in memory */
  isUnlocked: boolean;
  /** Whether this is the first time (vault not yet created) */
  isSetup: boolean;
  /** Whether we're still loading initial state */
  isInitializing: boolean;
  initializationError: string | null;
  /** Number of failed PIN attempts */
  failedAttempts: number;
  /** Timestamp until which the vault is locked out */
  lockedUntil: number | null;
  /** Whether the vault is currently in lockout */
  isLockedOut: boolean;
  /** Previous successful unlock timestamp (login before current session) */
  lastUnlockTime: number | null;
  activeRole: ProfileRole | null;
  hasDecoy: boolean;
  /** Set up vault for the first time with a PIN */
  setup: (pin: string) => Promise<void>;
  /** Attempt to unlock the vault with a PIN */
  unlock: (pin: string) => Promise<boolean>;
  createDecoy: (pin: string) => Promise<void>;
  changeDecoyPin: (oldPin: string, newPin: string) => Promise<void>;
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
  resetAllData: (pin: string) => Promise<void>;
  deleteDecoySpace: (pin: string) => Promise<void>;
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
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [activeRole, setActiveRole] = useState<ProfileRole | null>(null);
  const [hasDecoy, setHasDecoy] = useState(false);

  const isUnlocked = useGlobalStore((state) => state.vault.isUnlocked);
  const lastUnlockTime = useGlobalStore((state) => state.vault.lastUnlockTime);
  const setUnlocked = useGlobalStore((state) => state.vault.setUnlocked);
  const lockStore = useGlobalStore((state) => state.vault.lock);

  // Bootstrap: check if vault is set up
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const slots = await loadProfileSlots();
        if (slots.length === 0 && !(await isFreshInstallPrepared())) {
          // The user chose a clean start: discard all pre-profile app data.
          await clearLegacyVault();
          await clearLegacyRecipientIdentity();
          WARNING_CLEAR_ALL_MMKVS_INSTANCES();
          await closeDB();
          removeDirectoryContents(Paths.document);
          removeDirectoryContents(Paths.cache);
          removeCachedPackages();
          useChatStore.getState().resetChat();
          await markFreshInstallPrepared();
          try { await Updates.reloadAsync(); } catch { /* development clients may not support reloadAsync */ }
        }
        if (mounted) {
          setIsSetup(slots.length > 0);
          setHasDecoy(slots.length > 1);
          setFailedAttempts(getFailedAttempts());
          setLockedUntil(getLockedUntil());
        }
      } catch (error) {
        console.error("[VaultProvider] init error:", error);
        if (mounted) setInitializationError("Could not prepare secure storage. Restart the app.");
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
      if (initializationError) throw new Error(initializationError);
      if (!/^\d{8,}$/.test(pin)) throw new Error("Real PIN needs at least 8 digits");
      const masterKey = await generateMasterKey();
      const slot = await makeProfileSlot(pin, "real", masterKey);
      try {
        await openProfileDB(slot.id, masterKey);
        await addProfileSlot(slot);
      } catch (error) {
        await deleteProfileDB(slot.id);
        masterKey.fill(0);
        throw error;
      }
      setActiveProfile({ id: slot.id, role: "real", masterKey });
      useChatStore.getState().resetChat();
      await addLog("vault_created", "Vault created successfully");
      setUnlocked(masterKey);
      setActiveRole("real");
      setIsSetup(true);
      resetAttempts();
      setFailedAttempts(0);
      setLockedUntil(null);
    },
    [setUnlocked, initializationError],
  );

  const unlock = useCallback(
    async (pin: string): Promise<boolean> => {
      // Check lockout
      if (isLockedCheck()) {
        setLockedUntil(getLockedUntil());
        return false;
      }

      const resolved = await resolveProfile(pin);
      if (!resolved) {
        // Wrong PIN
        const result = recordFailedAttempt();
        setFailedAttempts(result.attempts);
        setLockedUntil(result.lockedUntil);
        return false;
      }
      try {
        await openProfileDB(resolved.slot.id, resolved.masterKey);
        setActiveProfile({ id: resolved.slot.id, role: resolved.role, masterKey: resolved.masterKey });
        WARNING_CLEAR_QUERY_CLIENT();
        await useChatStore.persist.rehydrate();
        const chat = useChatStore.getState();
        for (const [threadId, messages] of Object.entries(chat.messages)) {
          for (const message of messages) {
            if (message.status === "expired" || message.status === "burned" || (message.expiresAt && message.expiresAt <= Date.now())) {
              chat.removeMessage(threadId, message.id);
            }
          }
        }
      } catch (error) {
        await closeDB();
        clearActiveProfile();
        resolved.masterKey.fill(0);
        useChatStore.getState().resetChat();
        throw error;
      }
      setUnlocked(resolved.masterKey);
      setActiveRole(resolved.role);
      resetAttempts();
      setFailedAttempts(0);
      setLockedUntil(null);
      await addLog("unlock_success", "Vault unlocked with PIN");

      return true;
    },
    [setUnlocked],
  );

  const createDecoy = useCallback(async (pin: string) => {
    const current = getActiveProfile();
    if (!current || current.role !== "real") throw new Error("Unlock the real space first");
    if (!/^\d{6,}$/.test(pin)) throw new Error("Decoy PIN needs at least 6 digits");
    const existing = await resolveProfile(pin);
    if (existing) {
      existing.masterKey.fill(0);
      throw new Error("Choose a different PIN");
    }
    if ((await loadProfileSlots()).length > 1) throw new Error("Decoy already exists");
    const masterKey = randomProfileKey();
    const slot = await makeProfileSlot(pin, "decoy", masterKey);
    let committed = false;
    try {
      await initializeProfileDB(slot.id, masterKey);
      await addProfileSlot(slot);
      committed = true;
      setHasDecoy(true);
    } finally {
      if (!committed) await deleteProfileDB(slot.id);
      masterKey.fill(0);
    }
  }, []);

  const changeDecoyPin = useCallback(async (oldPin: string, newPin: string) => {
    const current = getActiveProfile();
    if (!current || current.role !== "real") throw new Error("Unlock the real space first");
    if (!/^\d{6,}$/.test(newPin)) throw new Error("New PIN needs at least 6 digits");
    const existing = await resolveProfile(newPin);
    if (existing) {
      existing.masterKey.fill(0);
      throw new Error("Choose a different PIN");
    }
    const resolved = await resolveProfile(oldPin);
    if (!resolved || resolved.role !== "decoy") {
      resolved?.masterKey.fill(0);
      throw new Error("Current alternate PIN is incorrect");
    }
    try {
      const next = await makeProfileSlot(newPin, "decoy", resolved.masterKey);
      await replaceProfileSlot(resolved.slot.id, { ...next, id: resolved.slot.id });
    } finally {
      resolved.masterKey.fill(0);
    }
  }, []);

  const lock = useCallback(async () => {
    lockStore();
    setActiveRole(null);
    try {
      if (getActiveProfile()) await addLog("vault_locked", "Vault locked by user");
    } catch { /* logging must never prevent locking */ }
    try {
      await closeDB();
    } catch (error) {
      console.error("[VaultProvider] Database close error on lock", error);
    } finally {
      clearActiveProfile();
      useChatStore.getState().resetChat();
      WARNING_CLEAR_QUERY_CLIENT();
    }

    // Wipe decrypted temp files from cache
    try {
      removeDecryptedTempFiles();
    } catch (e) {
      console.error("[VaultProvider] Cache cleanup error on lock", e);
    }
    try {
      removeCachedPackages();
    } catch (e) {
      console.error("[VaultProvider] Export cache cleanup error on lock", e);
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
      const extension = fileRow.name.match(/\.([a-z0-9]{1,10})$/i)?.[0] ?? "";
      const tempDecryptedUri = `${dirPath(Paths.cache)}/temp_${fileId}${extension}`;

      await decryptFile(encryptedUri, tempDecryptedUri, fileKeyHex);

      return tempDecryptedUri;
    },
    [getMasterKey],
  );

  const deleteDecoySpace = useCallback(async (pin: string) => {
    const current = getActiveProfile();
    const resolved = await resolveProfile(pin);
    if (!current || current.role !== "decoy" || resolved?.slot.id !== current.id) {
      resolved?.masterKey.fill(0);
      throw new Error("Incorrect PIN");
    }
    resolved.masterKey.fill(0);
    const database = await getDB();
    const files = await database.getAllAsync<{file_path:string}>("SELECT file_path FROM files");
    await closeDB();
    await deleteProfileDB(current.id);
    const documentPath = dirPath(Paths.document);
    for (const file of files) {
      if (/^[0-9a-f-]{36}\.enc$/i.test(file.file_path)) {
        const path = `${documentPath}/${file.file_path}`;
        try { if (fs.existsSync(path)) fs.unlinkSync(path); } catch { /* encrypted orphan; key has been deleted */ }
      }
    }
    for (const name of ["xe-chat-v1", "vault_recipient_contacts_v1", "vault_recipient_private_pem", "vault_recipient_public_pem"]) {
      try { removeProfileValue(name, current.id); } catch { /* the profile key is removed below */ }
    }
    await removeProfileSlot(current.id);
    clearActiveProfile();
    lockStore();
    setActiveRole(null);
    setHasDecoy(false);
    useChatStore.getState().resetChat();
    WARNING_CLEAR_QUERY_CLIENT();
    try { removeDecryptedTempFiles(); } catch { /* cache is best effort after key deletion */ }
    try { removeCachedPackages(); } catch { /* cache is best effort after key deletion */ }
  }, [lockStore]);

  const resetAllData = useCallback(async (pin: string) => {
    const current = getActiveProfile();
    const resolved = await resolveProfile(pin);
    if (!current || current.role !== "real" || resolved?.slot.id !== current.id) {
      resolved?.masterKey.fill(0);
      throw new Error("Incorrect PIN");
    }
    resolved.masterKey.fill(0);
    await closeDB();
    clearActiveProfile();
    lockStore();
    await clearLegacyVault();
    await clearProfileSlots();
    await clearLegacyRecipientIdentity();
    WARNING_CLEAR_ALL_MMKVS_INSTANCES();
    removeDirectoryContents(Paths.document);
    removeDirectoryContents(Paths.cache);
    removeCachedPackages();
    useChatStore.getState().resetChat();
    WARNING_CLEAR_QUERY_CLIENT();
    setIsSetup(false);
    setHasDecoy(false);
    setActiveRole(null);
    resetAttempts();
    setFailedAttempts(0);
    setLockedUntil(null);
    try { await Updates.reloadAsync(); } catch { /* development clients may not support reloadAsync */ }
  }, [lockStore]);

  useEffect(() => {
    if (!lockedUntil) return;
    setClockNow(Date.now());
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  const isLockedOut = !!lockedUntil && lockedUntil > clockNow;

  const value = useMemo<VaultContextValue>(
    () => ({
      isUnlocked,
      isSetup,
      isInitializing,
      initializationError,
      failedAttempts,
      lockedUntil,
      isLockedOut,
      lastUnlockTime,
      activeRole,
      hasDecoy,
      setup,
      unlock,
      createDecoy,
      changeDecoyPin,
      lock,
      getMasterKey,
      addFileToAlbum,
      decryptFileToCache,
      resetAllData,
      deleteDecoySpace,
    }),
    [
      isUnlocked,
      isSetup,
      isInitializing,
      initializationError,
      failedAttempts,
      lockedUntil,
      isLockedOut,
      lastUnlockTime,
      activeRole,
      hasDecoy,
      setup,
      unlock,
      createDecoy,
      changeDecoyPin,
      lock,
      getMasterKey,
      addFileToAlbum,
      decryptFileToCache,
      resetAllData,
      deleteDecoySpace,
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

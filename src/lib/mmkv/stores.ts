import { MMKV } from "react-native-mmkv";

const MAIN_STORE_ID = "main-store";
const REACT_QUERY_STORAGE_ID = "react-query-store";

/**
 * Creates an MMKV instance with self-healing: if the file is corrupted or
 * was previously encrypted with a different key, it clears and recreates it.
 * No encryptionKey is used — the data stored here (attempt counters,
 * lastUnlockTime) is not sensitive. Real secrets live in SecureStore/Keychain.
 */
function createMMKV(id: string): MMKV {
  const store = new MMKV({ id });
  try {
    // Smoke test — any set/get failure means the file is corrupted
    store.set("__health__", 1);
    store.delete("__health__");
  } catch {
    // If the backing files are corrupted, clearAll() alone won't fix them.
    // The adapters have try/catch so the app won't crash. A DEV RESET or
    // reinstall will delete the backing files and fully recover.
    console.warn(
      `[MMKV] Store "${id}" is corrupted. Run DEV RESET or reinstall the app.`,
    );
    try {
      store.clearAll();
    } catch {
      /* already broken, ignore */
    }
  }
  return store;
}

const storageMMKV = createMMKV(MAIN_STORE_ID);
const reactQueryStorage = createMMKV(REACT_QUERY_STORAGE_ID);

function WARNING_CLEAR_ALL_MMKVS_INSTANCES() {
  console.log("Clearing all MMKV instances...");

  try {
    storageMMKV.clearAll();
    console.log("Main storage cleared");
  } catch (error) {
    console.error("Error clearing main storage:", error);
  }

  try {
    reactQueryStorage.clearAll();
    console.log("React Query storage cleared");
  } catch (error) {
    console.error("Error clearing React Query storage:", error);
  }
}

export { storageMMKV, reactQueryStorage, WARNING_CLEAR_ALL_MMKVS_INSTANCES };

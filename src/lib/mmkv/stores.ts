import { createMMKV } from "react-native-mmkv";

const MAIN_STORE_ID = "main-store";
const REACT_QUERY_STORAGE_ID = "react-query-store";

const storageMMKV = createMMKV({ id: MAIN_STORE_ID });
const reactQueryStorage = createMMKV({ id: REACT_QUERY_STORAGE_ID });

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

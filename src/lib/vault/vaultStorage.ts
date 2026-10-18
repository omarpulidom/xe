import * as SecureStore from "expo-secure-store";

/** Removes keys left by the single-vault format; no legacy data is imported. */
export async function clearLegacyVault(): Promise<void> {
  await SecureStore.deleteItemAsync("vault_salt");
  await SecureStore.deleteItemAsync("vault_master_key_enc");
  await SecureStore.deleteItemAsync("vault_setup_complete");
}

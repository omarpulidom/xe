import * as SecureStore from "expo-secure-store";
import type { EncryptedMasterKey } from "@/lib/crypto";

/**
 * Vault secure storage — uses expo-secure-store (iOS Keychain / Android Keystore).
 *
 * Stores:
 * - vault_salt: hex-encoded random salt for PIN derivation
 * - vault_master_key_enc: JSON-encoded encrypted master key
 * - vault_setup_complete: "true" if vault has been set up
 */

const KEY_SALT = "vault_salt";
const KEY_MASTER_KEY_ENC = "vault_master_key_enc";
const KEY_SETUP_COMPLETE = "vault_setup_complete";

export async function isVaultSetup(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(KEY_SETUP_COMPLETE);
  return val === "true";
}

export async function saveSalt(saltHex: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_SALT, saltHex);
}

export async function loadSalt(): Promise<string | null> {
  return await SecureStore.getItemAsync(KEY_SALT);
}

export async function saveMasterKeyEnc(enc: EncryptedMasterKey): Promise<void> {
  await SecureStore.setItemAsync(KEY_MASTER_KEY_ENC, JSON.stringify(enc));
}

export async function loadMasterKeyEnc(): Promise<EncryptedMasterKey | null> {
  const val = await SecureStore.getItemAsync(KEY_MASTER_KEY_ENC);
  if (!val) return null;
  return JSON.parse(val) as EncryptedMasterKey;
}

export async function markVaultSetupComplete(): Promise<void> {
  await SecureStore.setItemAsync(KEY_SETUP_COMPLETE, "true");
}

export async function clearVault(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_SALT);
  await SecureStore.deleteItemAsync(KEY_MASTER_KEY_ENC);
  await SecureStore.deleteItemAsync(KEY_SETUP_COMPLETE);
}

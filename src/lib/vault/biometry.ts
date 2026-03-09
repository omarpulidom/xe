/**
 * Biometry service interface — scaffold for future implementation.
 *
 * iOS: Apple Secure Enclave via expo-secure-store + expo-local-authentication
 * Android: Android Keystore via expo-secure-store + expo-local-authentication
 *
 * The flow:
 * 1. User enables biometry → Master Key is encrypted with a hardware-backed key
 *    and stored in the device's secure enclave/keystore.
 * 2. On unlock → biometric prompt → hardware unlocks the key → Master Key recovered.
 *
 * Implementation will use:
 * - expo-local-authentication: for Face ID / Touch ID / fingerprint prompt
 * - expo-secure-store: with requireAuthentication option for hardware-backed storage
 *
 * To implement:
 * 1. `npx expo install expo-local-authentication`
 * 2. Import * as LocalAuthentication from 'expo-local-authentication'
 * 3. Store master key in SecureStore with { requireAuthentication: true }
 * 4. On biometric unlock: read from SecureStore (triggers biometric prompt automatically)
 */

export interface BiometryService {
  /** Check if biometric authentication is available on this device */
  isAvailable(): Promise<boolean>;
  /** Check if biometry is enabled for this vault */
  isEnabled(): Promise<boolean>;
  /** Store master key protected by biometric authentication */
  enableBiometry(masterKey: Uint8Array): Promise<void>;
  /** Retrieve master key via biometric authentication */
  unlockWithBiometry(): Promise<Uint8Array | null>;
  /** Remove biometric-protected master key */
  disableBiometry(): Promise<void>;
}

/**
 * Stub implementation — always returns unavailable.
 * Replace with real implementation when ready.
 */
export const biometryService: BiometryService = {
  async isAvailable() {
    return false;
  },
  async isEnabled() {
    return false;
  },
  async enableBiometry(_masterKey: Uint8Array) {
    console.warn("[Biometry] Not implemented yet");
  },
  async unlockWithBiometry() {
    console.warn("[Biometry] Not implemented yet");
    return null;
  },
  async disableBiometry() {
    console.warn("[Biometry] Not implemented yet");
  },
};

import type { GlobalTypedStateCreator } from "./types";

/**
 * Vault store — manages vault unlock state.
 *
 * CRITICAL: `masterKey` is NEVER persisted. It only lives in memory (RAM).
 * When the app closes or locks, the master key is wiped.
 */

type VaultState = {
  isUnlocked: boolean;
  masterKey: Uint8Array | null; // MEMORY ONLY — never serialized
  lastUnlockTime: number | null;
};

type VaultActions = {
  setUnlocked: (masterKey: Uint8Array) => void;
  lock: () => void;
};

const initialState: VaultState = {
  isUnlocked: false,
  masterKey: null,
  lastUnlockTime: null,
};

export type VaultSlice = VaultState & VaultActions;

export const createVaultSlice: GlobalTypedStateCreator<VaultSlice> = (set) => ({
  ...initialState,

  setUnlocked: (masterKey) =>
    set((state) => ({
      vault: {
        ...state.vault,
        isUnlocked: true,
        masterKey,
        lastUnlockTime: Date.now(),
      },
    })),

  lock: () =>
    set((state) => ({
      vault: {
        ...state.vault,
        isUnlocked: false,
        masterKey: null,
      },
    })),
});

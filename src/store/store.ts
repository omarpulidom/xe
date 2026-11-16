import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandMMKVStorage } from "@/lib/mmkv";
import { createVaultSlice } from "./vault.store";
import type { GlobalStoreType } from "./types";

const MAIN_STORE_NAME_PERSIST = "zustand-main-stores";

/**
 * Persist unlock timestamps from vault.
 * CRITICAL: masterKey is NEVER persisted — only exists in RAM.
 */
type PersistedVaultState = Pick<
  GlobalStoreType["vault"],
  "currentUnlockTime" | "lastUnlockTime"
>;

type PersistedState = {
  vault: PersistedVaultState;
};

export const useGlobalStore = create<GlobalStoreType>()(
  persist(
    (...args) => ({
      vault: createVaultSlice(...args),
    }),
    {
      name: MAIN_STORE_NAME_PERSIST,
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize(state): PersistedState {
        return {
          vault: {
            currentUnlockTime: state.vault.currentUnlockTime,
            lastUnlockTime: state.vault.lastUnlockTime,
            // NOTE: masterKey is intentionally excluded — never touches disk
          },
        };
      },
      merge: (
        persistedState: unknown,
        currentState: GlobalStoreType,
      ): GlobalStoreType => {
        const persisted = persistedState as PersistedState | undefined;

        return {
          ...currentState,
          vault: {
            ...currentState.vault,
            currentUnlockTime:
              persisted?.vault?.currentUnlockTime ??
              currentState.vault.currentUnlockTime,
            lastUnlockTime:
              persisted?.vault?.lastUnlockTime ??
              currentState.vault.lastUnlockTime,
            // masterKey stays null until runtime unlock
          },
        };
      },
    },
  ),
);

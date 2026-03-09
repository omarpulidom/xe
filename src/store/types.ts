import type { StateCreator } from "zustand";
import type { VaultSlice } from "./vault.store";

export type GlobalStoreType = {
  vault: VaultSlice;
};

export type GlobalTypedStateCreator<T> = StateCreator<
  GlobalStoreType, // The global state type
  [], // Any middleware that mutates the global store's set/get
  [], // Any middleware that mutates the slice's set/get
  T // The type of the slice being created
>;

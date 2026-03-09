import type { StateStorage } from "zustand/middleware";
import { reactQueryStorage, storageMMKV } from "./stores";
import type { JSONStorage } from "./type";

export const clientStorage: JSONStorage = {
  setItem: (key, value) => {
    reactQueryStorage.set(key, value);
  },
  getItem: (key) => {
    const value = reactQueryStorage.getString(key);
    return value === undefined ? null : value;
  },
  removeItem: (key) => {
    reactQueryStorage.delete(key);
  },
};

export const zustandMMKVStorage: StateStorage = {
  setItem: (name, value) => {
    try {
      storageMMKV.set(name, value);
    } catch (e) {
      console.warn(`[zustandMMKVStorage] setItem failed for "${name}":`, e);
    }
  },
  getItem: (name) => {
    try {
      const value = storageMMKV.getString(name);
      return value ?? null;
    } catch (e) {
      console.warn(`[zustandMMKVStorage] getItem failed for "${name}":`, e);
      return null;
    }
  },
  removeItem: (name) => {
    try {
      storageMMKV.delete(name);
    } catch (e) {
      console.warn(`[zustandMMKVStorage] removeItem failed for "${name}":`, e);
    }
  },
};

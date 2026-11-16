import * as SecureStore from "expo-secure-store";
import { Buffer, createHmac, randomBytes, randomUUID } from "react-native-quick-crypto";
import { deriveKeyFromPIN, decryptMasterKey, encryptMasterKey, generateSalt, type EncryptedMasterKey } from "@/lib/crypto";

const PROFILE_SLOTS_KEY = "vault_profile_slots_v2";
const FRESH_INSTALL_KEY = "vault_profile_fresh_v2";
export type ProfileRole = "real" | "decoy";
export type ProfileSlot = {
  id: string;
  salt: string;
  wrappedKey: EncryptedMasterKey;
};

let activeProfile: { id: string; role: ProfileRole; masterKey: Uint8Array } | null = null;

function isProfileSlot(value: unknown): value is ProfileSlot {
  if (!value || typeof value !== "object") return false;
  const slot = value as Partial<ProfileSlot>;
  return typeof slot.id === "string" && /^[0-9a-f-]{36}$/i.test(slot.id) &&
    typeof slot.salt === "string" && /^[0-9a-f]{64}$/i.test(slot.salt) &&
    typeof slot.wrappedKey?.content === "string" &&
    typeof slot.wrappedKey.iv === "string" && typeof slot.wrappedKey.tag === "string";
}

export function getActiveProfile() {
  return activeProfile;
}

export function setActiveProfile(profile: typeof activeProfile) {
  activeProfile = profile;
}

export function clearActiveProfile() {
  if (activeProfile) activeProfile.masterKey.fill(0);
  activeProfile = null;
}

export async function loadProfileSlots(): Promise<ProfileSlot[]> {
  const raw = await SecureStore.getItemAsync(PROFILE_SLOTS_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length > 2 || !parsed.every(isProfileSlot)) throw new Error("Invalid profile registry");
  return parsed as ProfileSlot[];
}

async function saveProfileSlots(slots: ProfileSlot[]) {
  await SecureStore.setItemAsync(PROFILE_SLOTS_KEY, JSON.stringify(slots), {
    keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  });
}

export async function makeProfileSlot(pin: string, role: ProfileRole, masterKey: Uint8Array): Promise<ProfileSlot> {
  const salt = await generateSalt();
  const derivedKey = await deriveKeyFromPIN(pin, salt);
  const payload = new Uint8Array(33);
  payload.set(masterKey);
  payload[32] = role === "real" ? 1 : 2;
  const wrappedKey = encryptMasterKey(payload, derivedKey);
  payload.fill(0);
  return { id: randomUUID(), salt, wrappedKey };
}

export async function addProfileSlot(slot: ProfileSlot) {
  const slots = await loadProfileSlots();
  if (slots.length >= 2) throw new Error("Maximum spaces reached");
  await saveProfileSlots(slots.length === 0 ? [slot] : randomBytes(1)[0] < 128 ? [slot, ...slots] : [...slots, slot]);
}

export async function replaceProfileSlot(id: string, slot: ProfileSlot) {
  const slots = await loadProfileSlots();
  if (!slots.some((item) => item.id === id)) throw new Error("Space not found");
  await saveProfileSlots(slots.map((item) => item.id === id ? slot : item));
}

export async function removeProfileSlot(id: string) {
  const slots = await loadProfileSlots();
  await saveProfileSlots(slots.filter((item) => item.id !== id));
}

export async function resolveProfile(pin: string): Promise<{slot: ProfileSlot; role: ProfileRole; masterKey: Uint8Array} | null> {
  const slots = await loadProfileSlots();
  let found: {slot: ProfileSlot; role: ProfileRole; masterKey: Uint8Array} | null = null;
  for (const slot of slots) {
    const derivedKey = await deriveKeyFromPIN(pin, slot.salt);
    const payload = decryptMasterKey(slot.wrappedKey, derivedKey);
    if (payload?.length === 33 && (payload[32] === 1 || payload[32] === 2)) {
      const role = payload[32] === 1 ? "real" : "decoy";
      const masterKey = payload.slice(0, 32);
      payload.fill(0);
      if (found) masterKey.fill(0);
      else found = { slot, role, masterKey };
      continue;
    }
    payload?.fill(0);
  }
  return found;
}

export function deriveProfileKey(masterKey: Uint8Array, purpose: string): string {
  return Buffer.from(createHmac("sha256", Buffer.from(masterKey)).update(`xe-profile-v2:${purpose}`).digest()).toString("hex");
}

export function randomProfileKey(): Uint8Array {
  return new Uint8Array(randomBytes(32));
}

export async function clearProfileSlots() {
  await SecureStore.deleteItemAsync(PROFILE_SLOTS_KEY);
}

export async function isFreshInstallPrepared() {
  return (await SecureStore.getItemAsync(FRESH_INSTALL_KEY)) === "true";
}

export async function markFreshInstallPrepared() {
  await SecureStore.setItemAsync(FRESH_INSTALL_KEY, "true");
}

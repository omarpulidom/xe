import { Buffer, createCipheriv, createDecipheriv, randomBytes } from "react-native-quick-crypto";
import { storageMMKV } from "@/lib/mmkv/stores";
import { deriveProfileKey, getActiveProfile } from "./profiles";

function storageKey(name: string, id: string) {
  return `profile-v2:${id}:${name}`;
}

export function readProfileValue(name: string): string | null {
  const profile = getActiveProfile();
  if (!profile) return null;
  const raw = storageMMKV.getString(storageKey(name, profile.id));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { iv: string; tag: string; content: string };
    const key = Buffer.from(deriveProfileKey(profile.masterKey, "local-state"), "hex");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(data.iv, "base64"));
    decipher.setAuthTag(Buffer.from(data.tag, "base64"));
    const result = Buffer.concat([decipher.update(Buffer.from(data.content, "base64")), decipher.final()]);
    return result.toString("utf8");
  } catch {
    throw new Error("Could not decrypt profile state");
  }
}

export function writeProfileValue(name: string, value: string): void {
  const profile = getActiveProfile();
  if (!profile) throw new Error("No active profile");
  const key = Buffer.from(deriveProfileKey(profile.masterKey, "local-state"), "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const content = Buffer.concat([cipher.update(Buffer.from(value, "utf8")), cipher.final()]);
  storageMMKV.set(storageKey(name, profile.id), JSON.stringify({
    iv: Buffer.from(iv).toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    content: content.toString("base64"),
  }));
}

export function removeProfileValue(name: string, id: string) {
  storageMMKV.remove(storageKey(name, id));
}

import * as SecureStore from "expo-secure-store";
import {
  Buffer,
  constants,
  createHash,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomUUID,
} from "react-native-quick-crypto";
import { storageMMKV } from "@/lib/mmkv/stores";

const KEY_DEVICE_PRIVATE_PEM = "vault_recipient_private_pem";
const KEY_DEVICE_PUBLIC_PEM = "vault_recipient_public_pem";
const KEY_CONTACTS = "vault_recipient_contacts_v1";

export type RecipientContact = {
  id: string;
  name: string;
  publicKeyPem: string;
  createdAt: number;
};

export type LocalRecipientIdentity = {
  id: string;
  publicKeyPem: string;
  fingerprint: string;
};

function makeFingerprint(publicKeyPem: string): string {
  const digest = createHash("sha256").update(publicKeyPem).digest();
  return Buffer.from(digest).toString("hex").slice(0, 16);
}

function readContacts(): RecipientContact[] {
  const raw = storageMMKV.getString(KEY_CONTACTS);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as RecipientContact[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeContacts(contacts: RecipientContact[]): void {
  storageMMKV.set(KEY_CONTACTS, JSON.stringify(contacts));
}

export async function ensureLocalRecipientIdentity(): Promise<LocalRecipientIdentity> {
  let privatePem: string | null = await SecureStore.getItemAsync(
    KEY_DEVICE_PRIVATE_PEM,
  );
  let publicPem: string | null = await SecureStore.getItemAsync(
    KEY_DEVICE_PUBLIC_PEM,
  );

  if (!privatePem || !publicPem) {
    const pair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    if (
      typeof pair.publicKey !== "string" ||
      typeof pair.privateKey !== "string"
    ) {
      throw new Error("Failed to generate export identity keypair");
    }

    publicPem = pair.publicKey;
    privatePem = pair.privateKey;

    await SecureStore.setItemAsync(KEY_DEVICE_PRIVATE_PEM, privatePem);
    await SecureStore.setItemAsync(KEY_DEVICE_PUBLIC_PEM, publicPem);
  }

  if (!publicPem) {
    throw new Error("Recipient public key not available");
  }

  const fingerprint = makeFingerprint(publicPem);
  return {
    id: `self_${fingerprint}`,
    publicKeyPem: publicPem,
    fingerprint,
  };
}

export async function getLocalRecipientIdentity(): Promise<LocalRecipientIdentity | null> {
  const publicPem = await SecureStore.getItemAsync(KEY_DEVICE_PUBLIC_PEM);
  if (!publicPem) return null;

  const fingerprint = makeFingerprint(publicPem);
  return {
    id: `self_${fingerprint}`,
    publicKeyPem: publicPem,
    fingerprint,
  };
}

export function getRecipientContacts(): RecipientContact[] {
  return readContacts();
}

export function addRecipientContact(input: {
  name: string;
  publicKeyPem: string;
}): RecipientContact {
  const name = input.name.trim();
  const publicKeyPem = input.publicKeyPem.trim();

  if (!name) throw new Error("Recipient name is required");
  if (!publicKeyPem.includes("BEGIN PUBLIC KEY")) {
    throw new Error("Invalid public key format");
  }

  const contacts = readContacts();
  const duplicate = contacts.find((c) => c.publicKeyPem === publicKeyPem);
  if (duplicate) return duplicate;

  const contact: RecipientContact = {
    id: randomUUID(),
    name,
    publicKeyPem,
    createdAt: Date.now(),
  };

  contacts.push(contact);
  writeContacts(contacts);
  return contact;
}

export function removeRecipientContact(id: string): void {
  const contacts = readContacts().filter((c) => c.id !== id);
  writeContacts(contacts);
}

export function wrapDerivedKeyForRecipient(input: {
  derivedKeyHex: string;
  recipientPublicKeyPem: string;
}): string {
  const encrypted = publicEncrypt(
    {
      key: input.recipientPublicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(input.derivedKeyHex, "utf8"),
  );
  return encrypted.toString("base64");
}

export async function unwrapDerivedKeyWithLocalIdentity(
  wrappedDerivedKeyB64: string,
): Promise<string | null> {
  const privatePem = await SecureStore.getItemAsync(KEY_DEVICE_PRIVATE_PEM);
  if (!privatePem) return null;

  try {
    const decrypted = privateDecrypt(
      {
        key: privatePem,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(wrappedDerivedKeyB64, "base64"),
    );

    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

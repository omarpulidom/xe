export type MessageStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "burned"
  | "expired";

export type CommandKind =
  | "burn"
  | "steg"
  | "canary"
  | "ttl"
  | "clear"
  | "panic"
  | null;

export type MessageVariant = "mine" | "theirs" | "system";

export type ConnectionStatus = "p2p" | "relay" | "offline";

export type Message = {
  id: string;
  threadId: string;
  authorId: string;
  text?: string;
  imageUri?: string;
  createdAt: number;
  expiresAt?: number;
  burnOnRead?: boolean;
  burnDurationSec?: number;
  status: MessageStatus;
  command?: CommandKind;
  isCanary?: boolean;
};

export type Contact = {
  id: string;
  alias: string;
  fingerprint: string;
  status: ConnectionStatus;
  lastSeen: number;
};

export type ChatThread = {
  id: string;
  contactId: string;
};

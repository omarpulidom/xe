import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandMMKVStorage } from "@/lib/mmkv";
import type { Contact, Message, MessageStatus } from "@/lib/chat/types";

const CHAT_STORE_NAME = "umbra-chat-v1";

type ChatState = {
  messages: Record<string, Message[]>;
  contacts: Contact[];
  typing: Record<string, boolean>;
};

type ChatActions = {
  addMessage: (msg: Message) => void;
  updateMessage: (
    threadId: string,
    msgId: string,
    updates: Partial<Message>,
  ) => void;
  removeMessage: (threadId: string, msgId: string) => void;
  markThreadRead: (threadId: string, myId: string) => void;
  setContactStatus: (contactId: string, status: Contact["status"]) => void;
  upsertContact: (contact: Contact) => void;
  clearThread: (threadId: string) => void;
  setTyping: (threadId: string, isTyping: boolean) => void;
  resetChat: () => void;
};

export type ChatStore = ChatState & ChatActions;

const initialContacts: Contact[] = [
  {
    id: "self_pm",
    alias: "pm",
    fingerprint: "self_a1b2c3d4e5f60718",
    status: "p2p",
    lastSeen: Date.now(),
  },
  {
    id: "uriel",
    alias: "uriel",
    fingerprint: "9c4f7e2a8b1d3f5c",
    status: "p2p",
    lastSeen: Date.now(),
  },
];

const initialState: ChatState = {
  messages: {},
  contacts: initialContacts,
  typing: {},
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      ...initialState,
      addMessage: (msg) =>
        set((state) => {
          const existing = state.messages[msg.threadId] ?? [];
          return {
            messages: {
              ...state.messages,
              [msg.threadId]: [...existing, msg],
            },
          };
        }),
      updateMessage: (threadId, msgId, updates) =>
        set((state) => {
          const thread = state.messages[threadId] ?? [];
          return {
            messages: {
              ...state.messages,
              [threadId]: thread.map((m) =>
                m.id === msgId ? { ...m, ...updates } : m,
              ),
            },
          };
        }),
      removeMessage: (threadId, msgId) =>
        set((state) => {
          const thread = state.messages[threadId] ?? [];
          return {
            messages: {
              ...state.messages,
              [threadId]: thread.filter((m) => m.id !== msgId),
            },
          };
        }),
      markThreadRead: (threadId, myId) =>
        set((state) => {
          const thread = state.messages[threadId] ?? [];
          return {
            messages: {
              ...state.messages,
              [threadId]: thread.map((m) =>
                m.authorId !== myId &&
                m.status !== "read" &&
                m.status !== "sending"
                  ? { ...m, status: "read" as MessageStatus }
                  : m,
              ),
            },
          };
        }),
      setContactStatus: (contactId, status) =>
        set((state) => ({
          contacts: state.contacts.map((c) =>
            c.id === contactId ? { ...c, status, lastSeen: Date.now() } : c,
          ),
        })),
      upsertContact: (contact) =>
        set((state) => {
          const existing = state.contacts.find((c) => c.id === contact.id);
          if (existing) {
            return {
              contacts: state.contacts.map((c) =>
                c.id === contact.id ? contact : c,
              ),
            };
          }
          return { contacts: [...state.contacts, contact] };
        }),
      clearThread: (threadId) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [threadId]: [],
          },
        })),
      setTyping: (threadId, isTyping) =>
        set((state) => {
          if (!isTyping) {
            const next = { ...state.typing };
            delete next[threadId];
            return { typing: next };
          }
          return { typing: { ...state.typing, [threadId]: true } };
        }),
      resetChat: () => set({ ...initialState, contacts: initialContacts }),
    }),
    {
      name: CHAT_STORE_NAME,
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({
        messages: state.messages,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as
          | {
              messages?: Record<string, Message[]>;
            }
          | undefined;
        const rawMessages = persisted?.messages ?? {};
        const migrated: Record<string, Message[]> = {};
        for (const [threadId, msgs] of Object.entries(rawMessages)) {
          migrated[threadId] = msgs.map((m) =>
            m.authorId === "mavri" ? { ...m, authorId: "uriel" } : m,
          );
        }
        return {
          ...currentState,
          messages: migrated,
        };
      },
    },
  ),
);

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandMMKVStorage } from "@/lib/mmkv";
import type { Contact, Message, MessageStatus } from "@/lib/chat/types";

const CHAT_STORE_NAME = "umbra-chat-v1";

type ChatState = {
  messages: Record<string, Message[]>;
  contacts: Contact[];
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
    id: "mavri",
    alias: "mavri",
    fingerprint: "9c4f7e2a8b1d3f5c",
    status: "p2p",
    lastSeen: Date.now(),
  },
];

const initialState: ChatState = {
  messages: {},
  contacts: initialContacts,
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
      resetChat: () => set({ ...initialState, contacts: initialContacts }),
    }),
    {
      name: CHAT_STORE_NAME,
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);

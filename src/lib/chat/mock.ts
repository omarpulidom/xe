import { randomUUID } from "react-native-quick-crypto";
import { useChatStore } from "@/store/chat.store";
import { parseCommand } from "@/lib/chat/commands";
import type { Message } from "@/lib/chat/types";

type ScriptedMessage = {
  text: string;
  authorId: string;
  delayMs: number;
  typingMs?: number;
};

const activeTimers = new Set<ReturnType<typeof setTimeout>>();

export function clearAllMockTimers() {
  for (const t of activeTimers) clearTimeout(t);
  activeTimers.clear();
}

const URIEL_THREAD_ID = "uriel";
const URIEL_MY_ID = "self_pm";

const URIEL_SCRIPT: ScriptedMessage[] = [
  { text: "bro", authorId: "uriel", delayMs: 600, typingMs: 700 },
  { text: "ya viste lo nuevo?", authorId: "uriel", delayMs: 2000, typingMs: 1500 },
  {
    text: "/canary este es un mensaje trampa, si lo abres me entero",
    authorId: "uriel",
    delayMs: 200,
    typingMs: 1800,
  },
  { text: "ya", authorId: "uriel", delayMs: 3000, typingMs: 500 },
  {
    text: "/burn 8s algo rapido que se autodestruye",
    authorId: "uriel",
    delayMs: 300,
    typingMs: 2500,
  },
  { text: "ok te leo", authorId: "uriel", delayMs: 3500, typingMs: 1000 },
  {
    text: "/ttl 60s este mensaje expira en 60 segundos",
    authorId: "uriel",
    delayMs: 300,
    typingMs: 2800,
  },
  { text: "va", authorId: "uriel", delayMs: 2200, typingMs: 400 },
];

const URIEL_SEED: ScriptedMessage[] = [
  { text: "yo", authorId: "uriel", delayMs: 100 },
  { text: "bro", authorId: "uriel", delayMs: 220 },
  { text: "???", authorId: URIEL_MY_ID, delayMs: 360 },
  { text: "bro", authorId: URIEL_MY_ID, delayMs: 500 },
  { text: "???", authorId: "uriel", delayMs: 640 },
];

export function startUrielMockIfEmpty(): void {
  const store = useChatStore.getState();
  const existing = store.messages[URIEL_THREAD_ID];
  if (existing && existing.length > 0) return;

  scheduleScript([...URIEL_SEED, ...URIEL_SCRIPT]);
}

export function startUrielMockReplay(): void {
  clearAllMockTimers();
  useChatStore.getState().clearThread(URIEL_THREAD_ID);
  useChatStore.getState().setTyping(URIEL_THREAD_ID, false);
  scheduleScript([...URIEL_SEED, ...URIEL_SCRIPT]);
}

function scheduleScript(script: ScriptedMessage[]) {
  let elapsed = 0;
  for (const m of script) {
    const startTypingAt = elapsed + m.delayMs;
    const postAt = startTypingAt + (m.typingMs ?? 0);

    if (m.typingMs && m.typingMs > 0) {
      const typingTimer = setTimeout(() => {
        activeTimers.delete(typingTimer);
        useChatStore.getState().setTyping(URIEL_THREAD_ID, true);
      }, startTypingAt);
      activeTimers.add(typingTimer);
    }

    const postTimer = setTimeout(() => {
      activeTimers.delete(postTimer);
      useChatStore.getState().setTyping(URIEL_THREAD_ID, false);
      postMockMessage(URIEL_THREAD_ID, m.text, m.authorId);
    }, postAt);
    activeTimers.add(postTimer);

    elapsed = postAt;
  }
}

function postMockMessage(threadId: string, text: string, authorId: string) {
  const store = useChatStore.getState();
  const parsed = parseCommand(text);

  const message: Message = {
    id: randomUUID(),
    threadId,
    authorId,
    text,
    createdAt: Date.now(),
    status: "read",
  };

  if (parsed) {
    message.command = parsed.kind;
    if (parsed.kind === "canary") {
      message.isCanary = true;
    } else if (parsed.kind === "burn") {
      message.burnOnRead = true;
      message.burnDurationSec = parsed.durationSec ?? 5;
      message.expiresAt =
        Date.now() + (parsed.durationSec ?? 5) * 1000;
    } else if (parsed.kind === "ttl") {
      message.expiresAt =
        Date.now() + (parsed.durationSec ?? 300) * 1000;
    }
  }

  store.addMessage(message);
}

export const MOCK_THREAD_ID = URIEL_THREAD_ID;
export const MOCK_MY_ID = URIEL_MY_ID;

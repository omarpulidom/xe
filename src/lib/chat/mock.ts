import { randomUUID } from "react-native-quick-crypto";
import { useChatStore } from "@/store/chat.store";
import { parseCommand } from "@/lib/chat/commands";
import type { Message } from "@/lib/chat/types";

type ScriptedMessage = {
  text: string;
  authorId: string;
  delayMs: number;
};

const activeTimers = new Set<ReturnType<typeof setTimeout>>();

export function clearAllMockTimers() {
  for (const t of activeTimers) clearTimeout(t);
  activeTimers.clear();
}

const URIEL_THREAD_ID = "uriel";
const URIEL_MY_ID = "self_pm";

const URIEL_SCRIPT: ScriptedMessage[] = [
  { text: "bro", authorId: "uriel", delayMs: 600 },
  { text: "ya viste lo nuevo?", authorId: "uriel", delayMs: 2200 },
  {
    text: "/canary este es un mensaje trampa, si lo abres me entero",
    authorId: "uriel",
    delayMs: 1800,
  },
  { text: "ya", authorId: "uriel", delayMs: 3200 },
  {
    text: "/burn 8s algo rapido que se autodestruye",
    authorId: "uriel",
    delayMs: 2500,
  },
  { text: "ok te leo", authorId: "uriel", delayMs: 4000 },
  {
    text: "/ttl 60s este mensaje expira en 60 segundos",
    authorId: "uriel",
    delayMs: 2800,
  },
  { text: "va", authorId: "uriel", delayMs: 2500 },
];

const URIEL_SEED: ScriptedMessage[] = [
  { text: "yo", authorId: "uriel", delayMs: 0 },
  { text: "bro", authorId: "uriel", delayMs: 0 },
  { text: "???", authorId: URIEL_MY_ID, delayMs: 0 },
  { text: "bro", authorId: URIEL_MY_ID, delayMs: 0 },
  { text: "???", authorId: "uriel", delayMs: 0 },
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
  scheduleScript([...URIEL_SEED, ...URIEL_SCRIPT]);
}

function scheduleScript(script: ScriptedMessage[]) {
  let elapsed = 0;
  for (const m of script) {
    elapsed += m.delayMs;
    const timer = setTimeout(() => {
      activeTimers.delete(timer);
      postMockMessage(URIEL_THREAD_ID, m.text, m.authorId);
    }, elapsed);
    activeTimers.add(timer);
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

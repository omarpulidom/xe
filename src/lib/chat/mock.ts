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

const MAVRI_THREAD_ID = "mavri";
const MAVRI_MY_ID = "self_pm";

const MAVRI_SCRIPT: ScriptedMessage[] = [
  { text: "bro", authorId: "mavri", delayMs: 600 },
  { text: "ya viste lo nuevo?", authorId: "mavri", delayMs: 2200 },
  {
    text: "/canary este es un mensaje trampa, si lo abres me entero",
    authorId: "mavri",
    delayMs: 1800,
  },
  { text: "ya", authorId: "mavri", delayMs: 3200 },
  {
    text: "/burn 8s algo rapido que se autodestruye",
    authorId: "mavri",
    delayMs: 2500,
  },
  { text: "ok te leo", authorId: "mavri", delayMs: 4000 },
  {
    text: "/ttl 60s este mensaje expira en 60 segundos",
    authorId: "mavri",
    delayMs: 2800,
  },
  { text: "va", authorId: "mavri", delayMs: 2500 },
];

const MAVRI_SEED: ScriptedMessage[] = [
  { text: "yo", authorId: "mavri", delayMs: 0 },
  { text: "bro", authorId: "mavri", delayMs: 0 },
  { text: "???", authorId: MAVRI_MY_ID, delayMs: 0 },
  { text: "bro", authorId: MAVRI_MY_ID, delayMs: 0 },
  { text: "???", authorId: "mavri", delayMs: 0 },
];

export function startMavriMockIfEmpty(): void {
  const store = useChatStore.getState();
  const existing = store.messages[MAVRI_THREAD_ID];
  if (existing && existing.length > 0) return;

  scheduleScript([...MAVRI_SEED, ...MAVRI_SCRIPT]);
}

export function startMavriMockReplay(): void {
  clearAllMockTimers();
  useChatStore.getState().clearThread(MAVRI_THREAD_ID);
  scheduleScript([...MAVRI_SEED, ...MAVRI_SCRIPT]);
}

function scheduleScript(script: ScriptedMessage[]) {
  let elapsed = 0;
  for (const m of script) {
    elapsed += m.delayMs;
    const timer = setTimeout(() => {
      activeTimers.delete(timer);
      postMockMessage(MAVRI_THREAD_ID, m.text, m.authorId);
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
    } else if (parsed.kind === "ttl") {
      message.expiresAt = Date.now() + (parsed.durationSec ?? 300) * 1000;
    }
  }

  store.addMessage(message);
}

export const MOCK_THREAD_ID = MAVRI_THREAD_ID;
export const MOCK_MY_ID = MAVRI_MY_ID;

import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Colors } from "@/components/colors";
import * as Icon from "phosphor-react-native";
import { BootSequence } from "@/components/chat/BootSequence";
import { CommandInput } from "@/components/chat/CommandInput";
import { DebugBar } from "@/components/chat/DebugBar";
import { MessageList } from "@/components/chat/MessageList";
import { StatusDot } from "@/components/chat/StatusDot";
import { parseCommand } from "@/lib/chat/commands";
import {
  MOCK_MY_ID,
  MOCK_THREAD_ID,
  startUrielMockIfEmpty,
  startUrielMockReplay,
} from "@/lib/chat/mock";
import { useChatStore } from "@/store/chat.store";
import { randomUUID } from "react-native-quick-crypto";
import type { Message } from "@/lib/chat/types";

const MY_ID = MOCK_MY_ID;
const THREAD_ID = MOCK_THREAD_ID;
const MY_ALIAS = "pm";
const PARTNER_ALIAS = "uriel";
const SHOW_DEBUG_BAR = true;

export default function DMTab() {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showBoot, setShowBoot] = useState(false);

  const messages = useChatStore((s) => s.messages[THREAD_ID] ?? []);
  const contacts = useChatStore((s) => s.contacts);
  const typing = useChatStore((s) => s.typing[THREAD_ID] ?? false);
  const hasBooted = useChatStore((s) => s.hasBooted[THREAD_ID] ?? false);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const markThreadRead = useChatStore((s) => s.markThreadRead);
  const clearThread = useChatStore((s) => s.clearThread);
  const markBooted = useChatStore((s) => s.markBooted);
  const setTyping = useChatStore((s) => s.setTyping);

  useEffect(() => {
    if (!hasBooted) {
      setShowBoot(true);
    } else {
      startUrielMockIfEmpty();
    }
  }, [hasBooted]);

  useEffect(() => {
    if (messages.length === 0) return;
    markThreadRead(THREAD_ID, MY_ID);
  }, [messages.length, markThreadRead]);

  const handleBootComplete = useCallback(() => {
    markBooted(THREAD_ID);
    setShowBoot(false);
    startUrielMockIfEmpty();
  }, [markBooted]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text) return;

      setIsSending(true);
      Vibration.vibrate(20);

      const id = randomUUID();
      const newMessage: Message = {
        id,
        threadId: THREAD_ID,
        authorId: MY_ID,
        text,
        createdAt: Date.now(),
        status: "sending",
      };

      const parsed = parseCommand(text);
      if (parsed) {
        newMessage.command = parsed.kind;
        if (parsed.kind === "canary") newMessage.isCanary = true;
        if (parsed.kind === "burn") {
          newMessage.burnOnRead = true;
          newMessage.burnDurationSec = parsed.durationSec ?? 5;
          newMessage.expiresAt =
            Date.now() + (parsed.durationSec ?? 5) * 1000;
        }
        if (parsed.kind === "ttl") {
          newMessage.expiresAt =
            Date.now() + (parsed.durationSec ?? 300) * 1000;
        }
      }

      addMessage(newMessage);
      setDraft("");

      setTimeout(() => {
        updateMessage(THREAD_ID, id, { status: "delivered" });
        setIsSending(false);
      }, 500);
    },
    [addMessage, updateMessage],
  );

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;

    const parsed = parseCommand(text);
    if (parsed?.kind === "clear") {
      Vibration.vibrate([0, 30, 50, 30]);
      clearThread(THREAD_ID);
      setDraft("");
      return;
    }

    sendMessage(text);
  }, [draft, sendMessage, clearThread]);

  const handleReplay = useCallback(() => {
    Vibration.vibrate([0, 20, 30, 20]);
    startUrielMockReplay();
  }, []);

  const handleDebugAddMessage = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage],
  );

  const handleDebugTyping = useCallback(
    (durationMs: number) => {
      Vibration.vibrate([0, 30, 50, 30]);
      setTyping(THREAD_ID, true);
      setTimeout(() => setTyping(THREAD_ID, false), durationMs);
    },
    [setTyping],
  );

  if (showBoot) {
    return <BootSequence onComplete={handleBootComplete} />;
  }

  const partner = contacts.find((c) => c.id === "uriel");
  const partnerStatus = partner?.status ?? "p2p";
  const fp = partner?.fingerprint ?? "";
  const fpShort = fp.length >= 8 ? `${fp.slice(0, 4)}…${fp.slice(-3)}` : fp;

  return (
    <View className="flex-1 bg-primary">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView className="flex-1 px-8 pt-8">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/chat")}
              className="bg-primary-500 h-12 w-12 rounded-2xl items-center justify-center"
            >
              <Text className="text-secondary-400 text-lg font-fira-code">
                :wq
              </Text>
            </TouchableOpacity>
            <View className="flex-col items-center flex-1">
              <View className="flex-row items-center gap-1.5">
                <StatusDot variant={partnerStatus} />
                <Text className="text-secondary-600 text-base font-fira-code">
                  {"<"}
                  <Text className="text-secondary">@</Text>
                  {PARTNER_ALIAS}
                  {">"}
                </Text>
              </View>
              <Text className="text-primary-100 text-xs font-fira-code-light">
                e2e · {fpShort}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleReplay}
              className="bg-primary-500 h-10 px-3 rounded-xl flex-row items-center justify-center gap-1"
            >
              <Icon.ArrowClockwiseIcon size={14} color={Colors.secondary[400]} />
              <Text className="text-secondary-400 text-sm font-fira-code">
                replay
              </Text>
            </TouchableOpacity>
          </View>
          <View className="h-px bg-primary-400 mt-4" />
          <View className="flex-1 -mx-3 mt-6">
            <MessageList
              messages={messages}
              myId={MY_ID}
              contacts={contacts}
              typing={typing}
              typingAlias={PARTNER_ALIAS}
            />
          </View>
          {SHOW_DEBUG_BAR && (
            <DebugBar
              onAddMessage={handleDebugAddMessage}
              onTriggerTyping={handleDebugTyping}
            />
          )}
          <CommandInput
            value={draft}
            onChange={setDraft}
            onSubmit={handleSend}
            myAlias={MY_ALIAS}
            isSending={isSending}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

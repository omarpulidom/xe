import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Colors } from "@/components/colors";
import * as Icon from "phosphor-react-native";
import { CommandInput } from "@/components/chat/CommandInput";
import { MessageList } from "@/components/chat/MessageList";
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

export default function DMTab() {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

  const messages = useChatStore((s) => s.messages[THREAD_ID] ?? []);
  const contacts = useChatStore((s) => s.contacts);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const markThreadRead = useChatStore((s) => s.markThreadRead);
  const clearThread = useChatStore((s) => s.clearThread);

  useEffect(() => {
    startUrielMockIfEmpty();
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    markThreadRead(THREAD_ID, MY_ID);
  }, [messages.length, markThreadRead]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;

    const parsed = parseCommand(text);
    if (parsed?.kind === "clear") {
      clearThread(THREAD_ID);
      setDraft("");
      return;
    }

    setIsSending(true);

    const id = randomUUID();
    const newMessage: Message = {
      id,
      threadId: THREAD_ID,
      authorId: MY_ID,
      text,
      createdAt: Date.now(),
      status: "sending",
    };

    if (parsed) {
      newMessage.command = parsed.kind;
      if (parsed.kind === "canary") {
        newMessage.isCanary = true;
      } else if (parsed.kind === "burn") {
        newMessage.burnOnRead = true;
        newMessage.burnDurationSec = parsed.durationSec ?? 5;
        newMessage.expiresAt =
          Date.now() + (parsed.durationSec ?? 5) * 1000;
      } else if (parsed.kind === "ttl") {
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
  }, [draft, addMessage, updateMessage, clearThread]);

  const handleReplay = useCallback(() => {
    startUrielMockReplay();
  }, []);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-primary"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView className="flex-1 px-8 pt-8">
        <View className="gap-1 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/chat")}
            className="bg-primary-500 h-12 w-12 rounded-2xl items-center justify-center"
          >
            <Text className="text-secondary-400 text-lg font-fira-code">
              :wq
            </Text>
          </TouchableOpacity>
          <View className="flex-col items-center">
            <Text className="text-secondary-600 text-xl font-fira-code-light">
              {"<"}
              <Text className="text-secondary">@</Text>
              {PARTNER_ALIAS}
              {">"}
            </Text>
            <Text className="text-primary-100 text-base font-fira-code-light">
              using e2e-encryption
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleReplay}
            className="bg-primary-500 h-10 px-3 rounded-xl flex-row items-center justify-center gap-1"
          >
            <Icon.ArrowClockwiseIcon
              size={14}
              color={Colors.secondary[400]}
            />
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
          />
        </View>
        <CommandInput
          value={draft}
          onChange={setDraft}
          onSubmit={handleSend}
          myAlias={MY_ALIAS}
          isSending={isSending}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

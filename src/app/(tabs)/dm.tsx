import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { CommandInput } from "@/components/chat/CommandInput";
import {
  MessageActionSheet,
  type MessageAction,
} from "@/components/chat/MessageActionSheet";
import { MessageList } from "@/components/chat/MessageList";
import { ReplyBar } from "@/components/chat/ReplyBar";
import { StatusDot } from "@/components/chat/StatusDot";
import { parseCommand } from "@/lib/chat/commands";
import { useVault } from "@/components/Providers/VaultProvider";
import { useChatStore } from "@/store/chat.store";
import { randomUUID } from "react-native-quick-crypto";
import type { Message, ReplyRef } from "@/lib/chat/types";

const MY_ID = "self";
const MY_ALIAS = "pm";

export default function DMTab() {
  const { contactId } = useLocalSearchParams<{ contactId?: string }>();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  const THREAD_ID = typeof contactId === "string" ? contactId : "";
  const { lock } = useVault();
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<ReplyRef | null>(null);

  const messages = useChatStore((s) => s.messages[THREAD_ID] ?? []);
  const contacts = useChatStore((s) => s.contacts);
  const typing = useChatStore((s) => s.typing[THREAD_ID] ?? false);
  const addMessage = useChatStore((s) => s.addMessage);
  const markThreadRead = useChatStore((s) => s.markThreadRead);
  const clearThread = useChatStore((s) => s.clearThread);
  const removeMessage = useChatStore((s) => s.removeMessage);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (messages.length === 0 || !THREAD_ID) return;
    markThreadRead(THREAD_ID, MY_ID);
  }, [messages.length, markThreadRead, THREAD_ID]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text || !THREAD_ID) return;

      setIsSending(true);
      Vibration.vibrate(20);

      const id = randomUUID();
      const newMessage: Message = {
        id,
        threadId: THREAD_ID,
        authorId: MY_ID,
        text,
        createdAt: Date.now(),
        status: "sent",
        replyTo: replyTo ?? undefined,
      };

      const parsed = parseCommand(text);
      if (parsed) {
        newMessage.command = parsed.kind;
        if (parsed.kind === "canary") newMessage.isCanary = true;
        if (parsed.kind === "burn") {
          newMessage.burnOnRead = true;
          newMessage.burnDurationSec = parsed.durationSec ?? 5;
          newMessage.expiresAt = Date.now() + (parsed.durationSec ?? 5) * 1000;
        }
        if (parsed.kind === "ttl") {
          newMessage.expiresAt =
            Date.now() + (parsed.durationSec ?? 300) * 1000;
        }
      }

      addMessage(newMessage);
      setDraft("");
      setReplyTo(null);

      setIsSending(false);
    },
    [addMessage, replyTo, THREAD_ID],
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
    if (parsed?.kind === "panic") {
      Vibration.vibrate([0, 100, 50, 100, 50, 300]);
      void lock().then(() => router.replace("/(auth)/calculator"));
      setDraft("");
      return;
    }

    sendMessage(text);
  }, [draft, sendMessage, clearThread, THREAD_ID, lock]);

  const handleMessageLongPress = useCallback((m: Message) => {
    setActionMessage(m);
  }, []);

  const handleActionSheetAction = useCallback(
    (action: MessageAction, m: Message) => {
      if (action === "delete") {
        Vibration.vibrate(20);
        removeMessage(THREAD_ID, m.id);
        return;
      }
      if (action === "reply") {
        const alias =
          m.authorId === MY_ID
            ? MY_ALIAS
            : (contacts.find((c) => c.id === m.authorId)?.alias ?? "unknown");
        const snippet = (m.text ?? "").split("\n")[0].slice(0, 120);
        setReplyTo({
          id: m.id,
          authorId: m.authorId,
          authorAlias: alias,
          text: snippet,
        });
        Vibration.vibrate(10);
      }
    },
    [contacts, removeMessage, THREAD_ID],
  );

  const partner = contacts.find((c) => c.id === THREAD_ID);
  const partnerStatus = partner?.status ?? "offline";
  const partnerAlias = partner?.alias ?? "unknown";
  const actionAuthorAlias =
    actionMessage?.authorId === MY_ID
      ? MY_ALIAS
      : (contacts.find((c) => c.id === actionMessage?.authorId)?.alias ??
        "unknown");

  return (
    <View className="flex-1 bg-primary">
      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        enabled={Platform.OS === "ios"}
      >
        <SafeAreaView
          edges={["top", "left", "right"]}
          className="flex-1 px-8 pt-8"
          style={{ paddingBottom: keyboardVisible ? 0 : insets.bottom }}
        >
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
                <Text className="text-secondary-600 text-xl font-fira-code" numberOfLines={1}>
                  {"<"}
                  <Text className="text-secondary">@</Text>
                  {partnerAlias}
                  {">"}
                </Text>
              </View>
              <Text className="text-primary-100 text-sm font-fira-code-light">
                offline
              </Text>
            </View>
            <View className="h-12 w-12" />
          </View>
          <View className="h-px bg-primary-400 mt-4" />
          <View className="flex-1 -mx-7 mt-2">
            <MessageList
              messages={messages}
              myId={MY_ID}
              contacts={contacts}
              typing={typing}
              typingAlias={partnerAlias}
              onMessageLongPress={handleMessageLongPress}
            />
          </View>
          <View className="-mx-8 border-t border-primary-400">
            {replyTo && (
              <ReplyBar replyTo={replyTo} onCancel={() => setReplyTo(null)} />
            )}
            <CommandInput
              value={draft}
              onChange={setDraft}
              onSubmit={handleSend}
              myAlias={MY_ALIAS}
              isSending={isSending}
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
      <MessageActionSheet
        visible={!!actionMessage}
        message={actionMessage}
        authorAlias={actionAuthorAlias}
        onClose={() => setActionMessage(null)}
        onAction={handleActionSheetAction}
      />
    </View>
  );
}

import { useCallback, useState } from "react";
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
import type { Contact, Message } from "@/lib/chat/types";

const MY_ID = "self_pm";
const MY_ALIAS = "pm";
const THREAD_ID = "mavri";

const CONTACTS: Contact[] = [
  {
    id: MY_ID,
    alias: MY_ALIAS,
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

const SEED_MESSAGES: Message[] = [
  {
    id: "m1",
    threadId: THREAD_ID,
    authorId: "mavri",
    text: "yo",
    createdAt: new Date(2025, 11, 1, 10, 45, 13).getTime(),
    status: "read",
  },
  {
    id: "m2",
    threadId: THREAD_ID,
    authorId: "mavri",
    text: "bro",
    createdAt: new Date(2025, 11, 1, 10, 45, 13).getTime(),
    status: "read",
  },
  {
    id: "m3",
    threadId: THREAD_ID,
    authorId: MY_ID,
    text: "???",
    createdAt: new Date(2025, 11, 1, 10, 45, 14).getTime(),
    status: "read",
  },
  {
    id: "m4",
    threadId: THREAD_ID,
    authorId: MY_ID,
    text: "bro",
    createdAt: new Date(2025, 11, 2, 10, 45, 13).getTime(),
    status: "read",
  },
  {
    id: "m5",
    threadId: THREAD_ID,
    authorId: "mavri",
    text: "???",
    createdAt: new Date(2025, 11, 2, 10, 45, 14).getTime(),
    status: "read",
  },
];

export default function DMTab() {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;

    const parsed = parseCommand(text);
    if (parsed?.kind === "clear") {
      setDraft("");
      return;
    }

    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setDraft("");
    }, 250);
  }, [draft]);

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
              <Text className="text-secondary">@</Text>mavri{">"}
            </Text>
            <Text className="text-primary-100 text-base font-fira-code-light">
              using e2e-encryption
            </Text>
          </View>
          <TouchableOpacity className="bg-primary-500 h-12 w-12 rounded-2xl items-center justify-center">
            <Icon.DotsThreeVerticalIcon
              size={24}
              color={Colors.secondary[400]}
            />
          </TouchableOpacity>
        </View>
        <View className="h-px bg-primary-400 mt-4" />
        <View className="flex-1 -mx-3 mt-6">
          <MessageList
            messages={SEED_MESSAGES}
            myId={MY_ID}
            contacts={CONTACTS}
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

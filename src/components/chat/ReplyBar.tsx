import { Pressable, Text, View } from "react-native";
import type { ReplyRef } from "@/lib/chat/types";

type Props = {
  replyTo: ReplyRef;
  onCancel: () => void;
};

export function ReplyBar({ replyTo, onCancel }: Props) {
  return (
    <View className="flex-row items-stretch mx-2 mt-2 mb-1 bg-primary-500 rounded-md overflow-hidden border border-primary-400">
      <View
        className="w-1"
        style={{ backgroundColor: "#f0f0f0" }}
      />
      <View className="flex-1 px-3 py-2">
        <Text className="text-xs font-fira-code" style={{ color: "#f0f0f0" }}>
          replying to{" "}
          <Text style={{ color: "#f0f0f0" }}>@{replyTo.authorAlias}</Text>
        </Text>
        <Text
          className="text-sm text-secondary-200 font-fira-code-light mt-0.5"
          numberOfLines={1}
        >
          {replyTo.text || "(empty)"}
        </Text>
      </View>
      <Pressable
        onPress={onCancel}
        hitSlop={8}
        className="px-3 items-center justify-center active:bg-primary-400"
      >
        <Text className="text-primary-100 font-fira-code text-lg">✕</Text>
      </Pressable>
    </View>
  );
}

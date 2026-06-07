import { Text, View } from "react-native";
import { Colors } from "@/components/colors";
import { formatTime } from "@/lib/chat/format";
import type { Message, MessageVariant } from "@/lib/chat/types";

type Props = {
  message: Message;
  variant: MessageVariant;
  authorAlias: string;
};

export function Message({ message, variant, authorAlias }: Props) {
  if (variant === "system") {
    return (
      <View className="items-center my-2">
        <Text
          className="text-primary-100 text-base font-fira-code"
          numberOfLines={1}
        >
          {message.text}
        </Text>
      </View>
    );
  }

  const isDestroyed =
    message.status === "burned" || message.status === "expired";
  const displayText = isDestroyed ? "█".repeat(8) : (message.text ?? "");

  return (
    <View className="flex-row items-center justify-start gap-2 mb-1">
      <Text className="text-primary-100 text-lg font-fira-code">
        {formatTime(message.createdAt)}
      </Text>
      <Text className="text-secondary-600 text-xl font-fira-code">
        {"<"}
        <Text className="text-secondary">@</Text>
        {authorAlias}
        {">"}
      </Text>
      <Text
        className="text-secondary-200 text-xl font-fira-code-light flex-shrink"
        numberOfLines={isDestroyed ? 1 : undefined}
      >
        {displayText}
      </Text>
      {message.isCanary && !isDestroyed && (
        <View
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: Colors.amber[400] }}
        />
      )}
    </View>
  );
}

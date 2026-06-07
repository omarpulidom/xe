import Animated, {
  SlideInLeft,
  SlideInRight,
} from "react-native-reanimated";
import { Text, View } from "react-native";
import { formatTime } from "@/lib/chat/format";
import { parseCommand } from "@/lib/chat/commands";
import type { Message, MessageVariant } from "@/lib/chat/types";
import { TypewriterText } from "./TypewriterText";

type Props = {
  message: Message;
  variant: MessageVariant;
  authorAlias: string;
  animate: boolean;
};

export function Message({ message, variant, authorAlias, animate }: Props) {
  if (variant === "system") {
    return (
      <View className="items-center my-1">
        <Text className="text-primary-100 text-sm font-fira-code">
          {message.text}
        </Text>
      </View>
    );
  }

  const isDestroyed =
    message.status === "burned" || message.status === "expired";
  const parsed = message.text ? parseCommand(message.text) : null;
  const body = parsed?.body ?? "";
  const displayText = isDestroyed
    ? "█".repeat(8)
    : body || message.text || "";

  const isMine = variant === "mine";
  const entering = animate
    ? isMine
      ? SlideInRight.duration(180)
      : SlideInLeft.duration(180)
    : undefined;

  const textClass = "text-base font-fira-code-light flex-shrink";
  const textColor = isDestroyed
    ? "text-primary-300"
    : isMine
      ? "text-secondary"
      : "text-secondary-200";

  return (
    <Animated.View
      entering={entering}
      className="flex-row items-start justify-start gap-1 mb-0.5"
    >
      <Text className="text-primary-100 text-sm font-fira-code">
        {formatTime(message.createdAt)}
      </Text>
      <Text className="text-secondary-600 text-base font-fira-code">
        {"<"}
        <Text className="text-secondary">@</Text>
        {authorAlias}
        {">"}
      </Text>
      {animate ? (
        <TypewriterText
          text={displayText}
          enabled={animate}
          className={`${textClass} ${textColor}`}
        />
      ) : (
        <Text className={`${textClass} ${textColor}`}>{displayText}</Text>
      )}
    </Animated.View>
  );
}

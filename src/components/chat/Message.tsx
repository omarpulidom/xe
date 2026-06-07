import { useEffect, useRef, useState } from "react";
import Animated, { SlideInLeft, SlideInRight } from "react-native-reanimated";
import { Pressable, Text, Vibration, View } from "react-native";
import { formatTime } from "@/lib/chat/format";
import { parseCommand } from "@/lib/chat/commands";
import { useChatStore } from "@/store/chat.store";
import type { Message, MessageVariant } from "@/lib/chat/types";
import { TypewriterText } from "./TypewriterText";
import { GlitchText } from "./GlitchText";
import { BurnRing } from "./BurnRing";

type Props = {
  message: Message;
  variant: MessageVariant;
  authorAlias: string;
  animate: boolean;
  onLongPress?: (message: Message) => void;
};

const GLITCH_DURATION_MS = 420;

export function Message({
  message,
  variant,
  authorAlias,
  animate,
  onLongPress,
}: Props) {
  const [isGlitching, setIsGlitching] = useState(false);
  const prevStatus = useRef(message.status);
  const processedRef = useRef(false);
  const removeMessage = useChatStore((s) => s.removeMessage);

  useEffect(() => {
    if (processedRef.current) {
      prevStatus.current = message.status;
      return;
    }

    const wasActive =
      prevStatus.current === "read" || prevStatus.current === "delivered";
    const nowDestroyed =
      message.status === "burned" || message.status === "expired";

    if (wasActive && nowDestroyed && !isGlitching) {
      setIsGlitching(true);
      processedRef.current = true;
    } else if (!wasActive && nowDestroyed) {
      removeMessage(message.threadId, message.id);
      processedRef.current = true;
    }

    prevStatus.current = message.status;
  }, [message.status, isGlitching, removeMessage]);

  useEffect(() => {
    if (!isGlitching) return;
    const timer = setTimeout(() => {
      removeMessage(message.threadId, message.id);
    }, GLITCH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isGlitching, removeMessage, message.threadId, message.id]);

  const isDestroyed =
    message.status === "burned" || message.status === "expired";

  if (isDestroyed && !isGlitching) {
    return null;
  }

  if (variant === "system") {
    return (
      <View className="items-center my-1">
        <Text className="text-primary-100 text-sm font-fira-code">
          {message.text}
        </Text>
      </View>
    );
  }

  const parsed = message.text ? parseCommand(message.text) : null;
  const body = parsed?.body ?? "";
  const originalText = body || message.text || "";

  const isMine = variant === "mine";
  const entering = animate
    ? isMine
      ? SlideInRight.duration(180)
      : SlideInLeft.duration(180)
    : undefined;

  const textColor = isMine ? "text-secondary" : "text-secondary-200";

  const totalMs = message.burnOnRead
    ? (message.burnDurationSec ?? 5) * 1000
    : message.expiresAt
      ? Math.max(0, message.expiresAt - message.createdAt)
      : 0;

  const showBurnRing = totalMs > 0 && !isDestroyed;

  const isCanaryOpened =
    message.isCanary &&
    (message.status === "read" ||
      message.status === "burned" ||
      message.status === "expired");
  const canaryDotColor = isCanaryOpened ? "#3bff7d" : "#f5ac58";

  const handleLongPress = () => {
    if (!onLongPress) return;
    Vibration.vibrate([0, 15, 30, 15]);
    onLongPress(message);
  };

  return (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={350}
      disabled={!onLongPress}
      className="mb-1.5"
    >
    <Animated.View
      entering={entering}
    >
      {showBurnRing && (
        <View className="mb-0.5">
          <BurnRing
            createdAt={message.createdAt}
            totalMs={totalMs}
            label={message.burnOnRead ? "burn" : "ttl"}
          />
        </View>
      )}
      {isGlitching ? (
        <View className="flex-row items-start gap-1">
          <Text className="text-primary-100 text-sm font-fira-code tabular-nums mt-0.5">
            {formatTime(message.createdAt)}
          </Text>
          <Text className="text-secondary-600 text-sm font-fira-code mt-0.5">
            {"<"}
            <Text className="text-secondary">@</Text>
            {authorAlias}
            {">"}
          </Text>
          <GlitchText
            text={originalText}
            active={isGlitching}
            className={`text-base font-fira-code-light ${textColor} flex-1`}
          />
        </View>
      ) : (
        <Text className={`text-base font-fira-code-light ${textColor}`}>
          <Text className="text-primary-100 text-sm font-fira-code tabular-nums">
            {formatTime(message.createdAt)}
          </Text>
          {" "}
          <Text className="text-secondary-600 text-sm font-fira-code">
            {"<"}
            <Text className="text-secondary">@</Text>
            {authorAlias}
            {">"}
          </Text>
          {" "}
          {animate ? (
            <TypewriterText
              text={originalText}
              enabled={animate}
              className="text-base font-fira-code-light"
            />
          ) : (
            originalText
          )}
          {message.isCanary && !isDestroyed && (
            <Text style={{ color: canaryDotColor }}> ●</Text>
          )}
        </Text>
      )}
    </Animated.View>
    </Pressable>
  );
}

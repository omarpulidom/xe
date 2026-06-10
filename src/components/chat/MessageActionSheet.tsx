import { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  Text,
  Vibration,
  View,
} from "react-native";
import type { Message } from "@/lib/chat/types";

export type MessageAction = "reply" | "delete";

type Props = {
  visible: boolean;
  message: Message | null;
  authorAlias: string;
  onClose: () => void;
  onAction: (action: MessageAction, message: Message) => void;
};

type ActionConfig = {
  kind: MessageAction;
  label: string;
  hint: string;
  disabledHint?: string;
  color: string;
};

const ACTIONS: ActionConfig[] = [
  {
    kind: "reply",
    label: "↳ reply",
    hint: "attach as quoted reply",
    disabledHint: "can't quote self-destructing msg",
    color: "#f0f0f0",
  },
  {
    kind: "delete",
    label: "✕ delete",
    hint: "remove from thread",
    color: "#f51d3a",
  },
];

export function MessageActionSheet({
  visible,
  message,
  authorAlias,
  onClose,
  onAction,
}: Props) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 140,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [320, 0],
  });

  const backdropOpacity = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1">
        <Animated.View
          pointerEvents={visible ? "auto" : "none"}
          className="absolute inset-0 bg-black"
          style={{ opacity: backdropOpacity.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.6],
          }) }}
        >
          <Pressable className="flex-1" onPress={onClose} />
        </Animated.View>
        <Animated.View
          pointerEvents={visible ? "auto" : "none"}
          className="absolute bottom-0 left-0 right-0 bg-primary-500 border-t border-primary-400"
          style={{ transform: [{ translateY }] }}
        >
          {message && (
            <View className="px-4 pt-3 pb-2 border-b border-primary-400">
              <Text className="text-xs text-primary-100 font-fira-code mb-1">
                {"// "}
                <Text className="text-secondary-200">@{authorAlias}</Text>
                {message.burnOnRead && (
                  <Text style={{ color: "#f5ac58" }}>  ·  burn</Text>
                )}
                {!message.burnOnRead && message.expiresAt && (
                  <Text style={{ color: "#f5ac58" }}>  ·  ttl</Text>
                )}
              </Text>
              <Text
                className="text-sm text-secondary-200 font-fira-code-light"
                numberOfLines={3}
              >
                {message.text}
              </Text>
            </View>
          )}
          <View className="py-1">
            {ACTIONS.map((a) => {
              const locked =
                !!message &&
                a.kind === "reply" &&
                (message.burnOnRead || !!message.expiresAt);
              const hint = locked ? a.disabledHint ?? a.hint : a.hint;
              return (
                <Pressable
                  key={a.kind}
                  onPress={
                    locked
                      ? undefined
                      : () => {
                          Vibration.vibrate(10);
                          onAction(a.kind, message!);
                          onClose();
                        }
                  }
                  disabled={locked}
                  className={`px-4 py-3 flex-row items-center justify-between ${
                    locked ? "opacity-40" : "active:bg-primary-400"
                  }`}
                >
                  <Text
                    className="text-base font-fira-code"
                    style={{ color: locked ? "#80837e" : a.color }}
                  >
                    {a.label}
                  </Text>
                  <Text className="text-xs text-primary-100 font-fira-code">
                    {hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={onClose}
            className="py-3 items-center border-t border-primary-400"
          >
            <Text className="text-sm text-primary-100 font-fira-code">
              cancel
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";

type Props = {
  count: number;
  onPress: () => void;
};

export function ScrollToBottomBadge({ count, onPress }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (count > 0) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 8,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [count, opacity, translateY]);

  if (count <= 0) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      className="absolute right-3 bottom-2"
      style={{ opacity, transform: [{ translateY }] }}
    >
      <Pressable
        onPress={onPress}
        className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-500 border border-secondary-400"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.4,
          shadowRadius: 4,
          elevation: 4,
        }}
      >
        <Text className="text-xs font-fira-code text-primary-600">↓</Text>
        <Text className="text-xs font-fira-code text-primary-600">
          {count} new
        </Text>
      </Pressable>
    </Animated.View>
  );
}

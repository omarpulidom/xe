import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  type SharedValue,
} from "react-native-reanimated";

type Props = {
  authorAlias: string;
};

const STEP_MS = 150;
const HOLD_MS = 450;
const EMPTY_MS = 150;
const CYCLE_MS = HOLD_MS + EMPTY_MS;

export function TypingIndicator({ authorAlias }: Props) {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const startSequence = (
      sv: SharedValue<number>,
      offset: number,
      holdMs: number,
    ) => {
      sv.value = withRepeat(
        withSequence(
          withTiming(0, { duration: offset, easing: Easing.linear }),
          withTiming(1, { duration: 0, easing: Easing.linear }),
          withTiming(1, { duration: holdMs, easing: Easing.linear }),
          withTiming(0, { duration: 0, easing: Easing.linear }),
          withTiming(0, {
            duration: CYCLE_MS - offset - holdMs,
            easing: Easing.linear,
          }),
        ),
        -1,
        false,
      );
    };

    startSequence(dot1, 0, HOLD_MS);
    startSequence(dot2, STEP_MS, HOLD_MS - STEP_MS);
    startSequence(dot3, STEP_MS * 2, HOLD_MS - STEP_MS * 2);
  }, [dot1, dot2, dot3]);

  const dot1Style = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: dot3.value }));

  return (
    <View className="flex-row items-baseline gap-1 mb-1.5">
      <Text className="text-sm font-fira-code">
        <Text className="text-secondary-600">{"<"}</Text>
        <Text className="text-secondary">@</Text>
        <Text className="text-secondary-600">{authorAlias}</Text>
        <Text className="text-secondary-600">{">"}</Text>
        <Text className="text-primary-100">{" is typing"}</Text>
      </Text>
      <View className="flex-row items-baseline">
        <Animated.Text
          style={dot1Style}
          className="text-secondary-200 text-sm font-fira-code"
        >
          .
        </Animated.Text>
        <Animated.Text
          style={dot2Style}
          className="text-secondary-200 text-sm font-fira-code"
        >
          .
        </Animated.Text>
        <Animated.Text
          style={dot3Style}
          className="text-secondary-200 text-sm font-fira-code"
        >
          .
        </Animated.Text>
      </View>
    </View>
  );
}

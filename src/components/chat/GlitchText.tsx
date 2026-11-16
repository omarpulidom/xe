import { useEffect, useState } from "react";
import { View, type TextStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";

type Props = {
  text: string;
  active: boolean;
  onComplete?: () => void;
  className?: string;
  durationMs?: number;
};

export function GlitchText({
  text,
  active,
  onComplete,
  className,
  durationMs = 420,
}: Props) {
  const t = useSharedValue(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active || done) return;
    t.value = 0;
    t.value = withTiming(
      1,
      { duration: durationMs, easing: Easing.linear },
      (finished) => {
        if (finished) {
          runOnJS(setDone)(true);
          if (onComplete) onComplete();
        }
      },
    );
  }, [active, done, onComplete, t, durationMs]);

  const baseStyle = useAnimatedStyle(() => {
    const jitter = Math.sin(t.value * 60) * (2 + t.value * 6);
    const opacity = Math.max(0, 1 - t.value * 1.1);
    return {
      transform: [{ translateX: jitter }],
      opacity,
    };
  });

  const rStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.sin(t.value * 50) * (2 + t.value * 6) },
    ],
    opacity:
      t.value < 0.5 ? t.value * 2 : Math.max(0, (1 - t.value) * 2),
  }));

  const gStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -Math.sin(t.value * 45) * (2 + t.value * 6) },
    ],
    opacity:
      t.value < 0.5 ? t.value * 2 : Math.max(0, (1 - t.value) * 2),
  }));

  const bStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.cos(t.value * 55) * (1.5 + t.value * 5) },
    ],
    opacity:
      t.value < 0.5 ? t.value * 2 : Math.max(0, (1 - t.value) * 2),
  }));

  if (done || !active) return null;

  const baseTextStyle: TextStyle = { color: "#ffffff" };

  return (
    <View>
      <Animated.Text
        style={[rStyle, { position: "absolute", color: "#ff3b3b" } as TextStyle]}
        className={className}
      >
        {text}
      </Animated.Text>
      <Animated.Text
        style={[gStyle, { position: "absolute", color: "#3bff7d" } as TextStyle]}
        className={className}
      >
        {text}
      </Animated.Text>
      <Animated.Text
        style={[bStyle, { position: "absolute", color: "#3bb3ff" } as TextStyle]}
        className={className}
      >
        {text}
      </Animated.Text>
      <Animated.Text style={[baseStyle, baseTextStyle]} className={className}>
        {text}
      </Animated.Text>
    </View>
  );
}

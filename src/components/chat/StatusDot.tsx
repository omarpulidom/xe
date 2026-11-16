import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

type Variant = "p2p" | "relay" | "offline";

const COLORS: Record<Variant, string> = {
  p2p: "#3bff7d",
  relay: "#f5ac58",
  offline: "#f51d3a",
};

const SIZES: Record<Variant, number> = {
  p2p: 8,
  relay: 8,
  offline: 6,
};

type Props = {
  variant: Variant;
};

export function StatusDot({ variant }: Props) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const size = SIZES[variant];
  const color = COLORS[variant];

  useEffect(() => {
    if (variant === "p2p") {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.6, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else if (variant === "offline") {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.25, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      scale.value = withTiming(1, { duration: 0 });
    } else {
      scale.value = withTiming(1, { duration: 0 });
      opacity.value = withTiming(1, { duration: 0 });
    }
  }, [variant, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  interpolateColor,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  createdAt: number;
  totalMs: number;
  label: string;
  size?: number;
};

function colorForProgress(p: number): string {
  if (p > 0.8) return "#f51d3a";
  if (p > 0.5) return "#f5ac58";
  return "#3bff7d";
}

export function BurnRing({ createdAt, totalMs, label, size = 18 }: Props) {
  const [remaining, setRemaining] = useState(0);
  const [textColor, setTextColor] = useState("#3bff7d");
  const progress = useSharedValue(0);
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - createdAt;
      const p = Math.min(1, elapsed / totalMs);
      progress.value = p;
      const remainingMs = Math.max(0, totalMs - elapsed);
      setRemaining(Math.ceil(remainingMs / 1000));
      setTextColor(colorForProgress(p));
    };
    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [createdAt, totalMs, progress]);

  const animatedProps = useAnimatedProps(() => ({
    stroke: interpolateColor(
      progress.value,
      [0, 0.5, 1],
      ["#3bff7d", "#f5ac58", "#f51d3a"],
    ),
  }));

  return (
    <View className="flex-row items-center gap-1.5">
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#2d2e2f"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth + 0.5}
          fill="transparent"
          strokeDasharray={circumference}
          strokeLinecap="round"
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius - strokeWidth}
          fill="transparent"
        />
      </Svg>
      <Text
        className="text-sm font-fira-code-semibold tabular-nums"
        style={{ color: textColor }}
      >
        {remaining}s
      </Text>
      <Text className="text-sm font-fira-code text-primary-100 uppercase tracking-wider">
        {label}
      </Text>
    </View>
  );
}

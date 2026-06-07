import { useEffect, useState } from "react";
import { Text } from "react-native";

type Props = {
  text: string;
  enabled: boolean;
  charDelayMs?: number;
  className?: string;
};

export function TypewriterText({
  text,
  enabled,
  charDelayMs = 30,
  className,
}: Props) {
  const [displayed, setDisplayed] = useState(enabled ? "" : text);

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text);
      return;
    }

    setDisplayed("");
    const timers: ReturnType<typeof setTimeout>[] = [];
    const total = text.length;
    for (let i = 0; i < total; i++) {
      const t = setTimeout(() => {
        setDisplayed(text.substring(0, i + 1));
      }, i * charDelayMs);
      timers.push(t);
    }

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [text, enabled, charDelayMs]);

  return (
    <Text className={className}>
      {displayed}
      {enabled && displayed.length < text.length ? "█" : ""}
    </Text>
  );
}

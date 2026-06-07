import { useEffect, useState } from "react";
import { Text, View } from "react-native";

const BOOT_LINES = [
  "> initializing umbra v0.1.0...",
  "> establishing secure channel...",
  "> verifying keys..................[OK]",
  "> loading session..................[OK]",
  "> ready.",
];

const CHAR_DELAY_MS = 18;
const LINE_PAUSE_MS = 180;

type Props = {
  onComplete: () => void;
};

export function BootSequence({ onComplete }: Props) {
  const [currentLine, setCurrentLine] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;

    if (currentLine >= BOOT_LINES.length) {
      setDone(true);
      setTimeout(onComplete, 400);
      return;
    }

    const line = BOOT_LINES[currentLine];
    let charIndex = 0;

    const interval = setInterval(() => {
      charIndex++;
      setCurrentText(line.substring(0, charIndex));
      if (charIndex >= line.length) {
        clearInterval(interval);
        setTimeout(() => {
          setCurrentLine((prev) => prev + 1);
          setCurrentText("");
        }, LINE_PAUSE_MS);
      }
    }, CHAR_DELAY_MS);

    return () => clearInterval(interval);
  }, [currentLine, done, onComplete]);

  return (
    <View className="flex-1 bg-primary px-8 py-12 justify-center">
      <View className="w-full max-w-md">
        {BOOT_LINES.slice(0, currentLine).map((line, i) => (
          <Text
            key={i}
            className="text-greeny-300 text-sm font-fira-code leading-6"
          >
            {line}
          </Text>
        ))}
        {currentLine < BOOT_LINES.length && !done && (
          <Text className="text-sm font-fira-code leading-6">
            <Text className="text-greeny-300">{currentText}</Text>
            <Text className="text-greeny-300">█</Text>
          </Text>
        )}
      </View>
    </View>
  );
}

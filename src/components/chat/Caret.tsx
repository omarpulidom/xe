import { useEffect, useState } from "react";
import { Text } from "react-native";

type Props = {
  char?: string;
  intervalMs?: number;
  className?: string;
};

export function Caret({
  char = "█",
  intervalMs = 530,
  className,
}: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return <Text className={className}>{visible ? char : " "}</Text>;
}

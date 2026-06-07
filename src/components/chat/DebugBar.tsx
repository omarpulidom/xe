import { Text, TouchableOpacity, View } from "react-native";

type Props = {
  onAddMessage: (text: string) => void;
  onTriggerTyping: (durationMs: number) => void;
};

const BUTTONS: Array<{ label: string; kind: "msg" | "type"; value: string }> = [
  { label: "+ plain", kind: "msg", value: "test message from debug" },
  { label: "+ /burn 10s", kind: "msg", value: "/burn 10s debug burn" },
  { label: "+ /steg", kind: "msg", value: "/steg debug steg" },
  { label: "+ /ttl 5s", kind: "msg", value: "/ttl 5s debug ttl" },
  { label: "+ /canary", kind: "msg", value: "/canary debug canary" },
  { label: "+ type 3s", kind: "type", value: "3000" },
];

export function DebugBar({ onAddMessage, onTriggerTyping }: Props) {
  return (
    <View className="flex-row flex-wrap gap-1 px-2 py-1.5 border-t border-primary-400 bg-primary-500">
      {BUTTONS.map((btn) => (
        <TouchableOpacity
          key={btn.label}
          onPress={() => {
            if (btn.kind === "msg") onAddMessage(btn.value);
            else onTriggerTyping(Number(btn.value));
          }}
          className="px-2 py-1 bg-primary-400 rounded-md active:bg-primary-300"
        >
          <Text className="text-xs font-fira-code text-secondary-200">
            {btn.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

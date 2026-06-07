import { Text, TouchableOpacity, View } from "react-native";

type Props = {
  onAddMessage: (text: string) => void;
  onTriggerTyping: (durationMs: number) => void;
  onSetStatus: (status: "p2p" | "relay" | "offline") => void;
  currentStatus: "p2p" | "relay" | "offline";
};

const BUTTONS: Array<{ label: string; kind: "msg" | "type" | "status"; value: string }> = [
  { label: "+ plain", kind: "msg", value: "test message from debug" },
  { label: "+ /burn 10s", kind: "msg", value: "/burn 10s debug burn" },
  { label: "+ /steg", kind: "msg", value: "/steg debug steg" },
  { label: "+ /ttl 5s", kind: "msg", value: "/ttl 5s debug ttl" },
  { label: "+ /canary", kind: "msg", value: "/canary debug canary" },
  { label: "+ type 3s", kind: "type", value: "3000" },
  { label: "→ p2p", kind: "status", value: "p2p" },
  { label: "→ relay", kind: "status", value: "relay" },
  { label: "→ offline", kind: "status", value: "offline" },
];

export function DebugBar({
  onAddMessage,
  onTriggerTyping,
  onSetStatus,
  currentStatus,
}: Props) {
  return (
    <View className="flex-row flex-wrap gap-1 px-2 py-1.5 border-t border-primary-400 bg-primary-500">
      {BUTTONS.map((btn) => {
        const active =
          btn.kind === "status" && btn.value === currentStatus;
        return (
          <TouchableOpacity
            key={btn.label}
            onPress={() => {
              if (btn.kind === "msg") onAddMessage(btn.value);
              else if (btn.kind === "type") onTriggerTyping(Number(btn.value));
              else onSetStatus(btn.value as "p2p" | "relay" | "offline");
            }}
            className={`px-2 py-1 rounded-md ${
              active ? "bg-secondary-500" : "bg-primary-400"
            } active:opacity-60`}
          >
            <Text
              className={`text-xs font-fira-code ${
                active ? "text-primary-600" : "text-secondary-200"
              }`}
            >
              {btn.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

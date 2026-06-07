import { Text, View } from "react-native";
import type { ConnectionStatus } from "@/lib/chat/types";

type Props = {
  status: ConnectionStatus;
};

type Config = {
  color: string;
  text: string;
  prefix: string;
};

const CONFIG: Record<Exclude<ConnectionStatus, "p2p">, Config> = {
  relay: {
    color: "#f5ac58",
    prefix: "// ~",
    text: "relay mode — messages via umbra-relay.xyz",
  },
  offline: {
    color: "#f51d3a",
    prefix: "// !!",
    text: "offline — peer unreachable. queued locally.",
  },
};

export function ConnectionBanner({ status }: Props) {
  if (status === "p2p") return null;
  const cfg = CONFIG[status];
  return (
    <View
      className="flex-row items-center gap-2 py-1.5 px-2 border-y"
      style={{
        borderColor: `${cfg.color}55`,
        backgroundColor: `${cfg.color}14`,
      }}
    >
      <Text
        className="text-xs font-fira-code"
        style={{ color: cfg.color }}
      >
        {cfg.prefix}
      </Text>
      <Text
        className="text-xs font-fira-code flex-1"
        style={{ color: cfg.color }}
      >
        {cfg.text}
      </Text>
    </View>
  );
}

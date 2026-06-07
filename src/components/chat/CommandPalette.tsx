import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { filterCommands, getCommandQuery } from "@/lib/chat/commands";
import { cn } from "@/lib/cn";

type Props = {
  query: string;
  onSelect: (cmd: string) => void;
};

export function CommandPalette({ query, onSelect }: Props) {
  const filtered = filterCommands(query);

  if (filtered.length === 0) {
    return (
      <View className="mx-2 mb-2 px-3 py-2 bg-primary-600 border border-primary-400 rounded-xl">
        <Text className="text-primary-100 text-sm font-fira-code">
          // no commands match "/{query}"
        </Text>
      </View>
    );
  }

  return (
    <View className="mx-2 mb-2 bg-primary-600 border border-primary-400 rounded-xl overflow-hidden">
      <ScrollView
        style={{ maxHeight: 168 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {filtered.map((cmd) => {
          const isExact = query === cmd.name;
          return (
            <TouchableOpacity
              key={cmd.name}
              onPress={() => onSelect(`/${cmd.name} `)}
              activeOpacity={0.6}
              className={cn(
                "px-3 py-1.5 flex-row items-center justify-between gap-3",
                isExact ? "bg-primary-500" : "",
              )}
            >
              <Text className="text-secondary-200 text-sm font-fira-code">
                /{cmd.name}
              </Text>
              <Text
                className="text-primary-100 text-sm font-fira-code-light flex-shrink"
                numberOfLines={1}
              >
                {cmd.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export { getCommandQuery };

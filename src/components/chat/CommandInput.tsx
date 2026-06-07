import { useCallback, useRef, useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { Colors } from "@/components/colors";
import { getCommandQuery, parseCommand } from "@/lib/chat/commands";
import { cn } from "@/lib/cn";
import { CommandPalette } from "./CommandPalette";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  myAlias: string;
  isSending?: boolean;
};

const BLUR_MIN_DURATION_MS = 300;

export function CommandInput({
  value,
  onChange,
  onSubmit,
  myAlias,
  isSending = false,
}: Props) {
  const [inputBlurred, setInputBlurred] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const focusStartRef = useRef<number | null>(null);

  const isCommand = value.startsWith("/");
  const parsed = isCommand ? parseCommand(value) : null;
  const isValid = !!parsed && parsed.kind !== "panic";
  const isUnknown = isCommand && value.length > 1 && parsed === null;

  const showError = isUnknown && (inputBlurred || submitAttempted);
  const showPalette = isCommand;

  const handleFocus = useCallback(() => {
    focusStartRef.current = Date.now();
  }, []);

  const handleBlur = useCallback(() => {
    const start = focusStartRef.current;
    focusStartRef.current = null;
    if (start === null) return;
    if (Date.now() - start < BLUR_MIN_DURATION_MS) return;
    if (value.trim().length > 0) {
      setInputBlurred(true);
    }
  }, [value]);

  const handleSubmit = useCallback(() => {
    setSubmitAttempted(true);
    if (!isUnknown) {
      onSubmit();
    }
  }, [isUnknown, onSubmit]);

  const handleChange = useCallback(
    (next: string) => {
      onChange(next);
      setInputBlurred(false);
      setSubmitAttempted(false);
    },
    [onChange],
  );

  const handlePaletteSelect = useCallback(
    (cmd: string) => {
      onChange(cmd);
      setInputBlurred(false);
      setSubmitAttempted(false);
    },
    [onChange],
  );

  const borderClass = showError
    ? "border-ruby"
    : isCommand && isValid
      ? "border-greeny-300"
      : "border-primary-400";

  return (
    <View className="-mx-8 border-t border-primary-400 py-2">
      {showPalette && (
        <CommandPalette
          query={getCommandQuery(value)}
          onSelect={handlePaletteSelect}
        />
      )}
      <View className="flex-row items-center gap-1 mx-2">
        <Text className="text-secondary-600 text-base font-fira-code">
          <Text className="text-primary-100">{">"}</Text> {"<"}
          <Text className="text-secondary">@</Text>
          {myAlias}
          {">"}/
        </Text>
        <TextInput
          value={value}
          onChangeText={handleChange}
          onSubmitEditing={handleSubmit}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={!isSending}
          className={cn(
            "flex-1 text-base font-fira-code-light px-4 py-2 rounded-xl border",
            borderClass,
          )}
          placeholder={
            isCommand
              ? parsed
                ? `${parsed.kind} ${parsed.body}`
                : "unknown command"
              : "Type a message"
          }
          placeholderTextColor={Colors.primary[300]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          style={{ color: Colors.secondary[200] }}
        />
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!value.trim() || isSending || isUnknown}
          className="border border-primary-400 h-10 w-10 rounded-xl items-center justify-center"
          style={{
            opacity: !value.trim() || isSending || isUnknown ? 0.4 : 1,
          }}
        >
          <AntDesign name="enter" size={16} color="white" />
        </TouchableOpacity>
      </View>
      {isCommand && isValid && (
        <View className="mx-2 mt-2 flex-row items-center gap-2">
          <Text className="text-sm font-fira-code text-greeny-300">{"//"}</Text>
          <Text className="text-sm font-fira-code text-secondary-200">
            {formatParsed(parsed)}
          </Text>
        </View>
      )}
      {showError && (
        <View className="mx-2 mt-2 flex-row items-center gap-2">
          <Text className="text-sm font-fira-code text-ruby">{"// err:"}</Text>
          <Text className="text-sm font-fira-code text-ruby">
            unknown command
          </Text>
        </View>
      )}
    </View>
  );
}

function formatParsed(p: NonNullable<ReturnType<typeof parseCommand>>): string {
  const parts = [`cmd=${p.kind}`];
  if (p.durationSec !== null) parts.push(`ttl=${p.durationSec}s`);
  if (p.body) parts.push(`body="${p.body}"`);
  return parts.join(" ");
}

import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  onUnlock: () => void;
};

const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 6;

export function PanicOverlay({ visible, onUnlock }: Props) {
  const [pin, setPin] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) {
      setPin("");
      return;
    }
    const t = setTimeout(() => {
      inputRef.current?.focus();
    }, 220);
    return () => clearTimeout(t);
  }, [visible]);

  const canUnlock = pin.length >= MIN_PIN_LENGTH;
  const handleUnlock = () => {
    if (!canUnlock) return;
    Vibration.vibrate(20);
    onUnlock();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      transparent={false}
      onRequestClose={() => {}}
    >
      <View className="flex-1 bg-black">
        <KeyboardAvoidingView
          className="flex-1 items-center justify-center px-8"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Text className="text-xs text-primary-100 font-fira-code mb-3 tracking-widest">
            // SYSTEM LOCKED
          </Text>
          <Text className="text-6xl text-ruby-300 font-fira-code mb-8 tracking-[0.3em]">
            PANIC
          </Text>
          <Text className="text-sm text-amber-300 font-fira-code mb-8">
            {">"} enter PIN to unlock
          </Text>
          <TextInput
            ref={inputRef}
            value={pin}
            onChangeText={(t) => setPin(t.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            maxLength={MAX_PIN_LENGTH}
            placeholder="• • • •"
            placeholderTextColor="#585c4d"
            className="bg-black border border-ruby-300 text-ruby-300 px-4 py-3 text-center text-2xl tracking-[1em] w-56 font-fira-code mb-8"
            style={{ letterSpacing: 16 }}
            onSubmitEditing={handleUnlock}
          />
          <Pressable
            onPress={handleUnlock}
            disabled={!canUnlock}
            className={`px-8 py-3 border ${
              canUnlock
                ? "border-ruby-300"
                : "border-ruby-300 opacity-40"
            }`}
          >
            <Text className="text-base text-ruby-300 font-fira-code tracking-widest">
              unlock
            </Text>
          </Pressable>
          <Text className="text-[10px] text-primary-100 font-fira-code mt-12 text-center">
            maquette: any {MIN_PIN_LENGTH}-{MAX_PIN_LENGTH} digit PIN works
          </Text>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

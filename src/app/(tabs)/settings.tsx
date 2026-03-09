/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <dev> */
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TouchableOpacity, Alert } from "react-native";
import { useVault } from "@/components/Providers/VaultProvider";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { clearVault as clearVaultStorage, nukeDatabase } from "@/lib/vault";
import { resetAttempts } from "@/lib/crypto";

export default function SettingsTab() {
  const { lock } = useVault();
  const router = useRouter();

  const handleLock = useCallback(async () => {
    await lock();
    router.replace("/(auth)/calculator");
  }, [lock, router]);

  const handleClearVault = useCallback(() => {
    Alert.alert(
      "DANGER: Clear Vault",
      "This will permanently delete ALL data, including your encrypted files, albums, and PIN. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "CLEAR EVERYTHING",
          style: "destructive",
          onPress: async () => {
            try {
              await clearVaultStorage();
              await nukeDatabase();
              resetAttempts();
              lock();
              router.replace("/(auth)/calculator");
            } catch (err) {
              console.error("[Settings] clearVault error:", err);
            }
          },
        },
      ],
    );
  }, [lock, router]);

  return (
    <SafeAreaView className="flex-1 p-4 bg-primary gap-4">
      <Text className="text-secondary-500 text-xl font-geist-mono">Settings Tab</Text>

      <TouchableOpacity
        onPress={handleLock}
        className="bg-primary-500 p-4 rounded-xl items-center"
      >
        <Text className="text-secondary-400 font-fira-code text-lg">/lock vault</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleClearVault}
        className="bg-red-900/30 border border-red-900 p-4 rounded-xl items-center mt-8"
      >
        <Text className="text-red-500 font-fira-code text-lg">/clear vault</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

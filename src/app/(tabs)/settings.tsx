/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <dev> */
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TouchableOpacity } from "react-native";
import { useAuth } from "@/components/Providers/AuthProvider";

export default function SettingsTab() {
  const { logout } = useAuth();

  return (
    <SafeAreaView className="flex-1 p-4 bg-primary">
      <Text className="text-secondary-500 text-xl">Settings Tab</Text>
    </SafeAreaView>
  );
}

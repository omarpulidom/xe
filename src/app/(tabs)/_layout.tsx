import { Redirect, Tabs } from "expo-router";
import { TabBar } from "@/components/Elements/TabBar";
import { useVault } from "@/components/Providers/VaultProvider";

export default function TabsLayout() {
  const { isUnlocked, isInitializing } = useVault();

  if (isInitializing) {
    return null; // Show nothing while loading vault state
  }

  if (!isUnlocked) {
    return <Redirect href="/(auth)/calculator" />;
  }

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: "shift",
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="vault" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="album"
        options={{
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="dm"
        options={{
          tabBarStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}

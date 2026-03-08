import * as Icon from "phosphor-react-native";
import { Colors } from "@/components/colors";
import { Text, TouchableOpacity, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const focusedRoute = state.routes[state.index];
  const { options } = descriptors[focusedRoute.key];

  if ((options.tabBarStyle as any)?.display === "none") {
    return null;
  }

  return (
    <>
      {/* TabBar */}
      <View className="bg-primary pb-8 pt-3 px-6">
        <View className="flex-row items-center justify-between">
          {/* Screen 1: Inicio */}
          {state.routes.map((route, index) => {
            if (route.name !== "index") return null;
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                className={`flex-col items-center gap-2 h-20 justify-center rounded-2xl w-24 ${
                  isFocused ? "bg-secondary-500" : ""
                }`}
              >
                <Icon.TerminalWindowIcon
                  size={24}
                  color={
                    isFocused ? Colors.primary[500] : Colors.secondary[400]
                  }
                />
                <Text
                  className={`h-6 ${
                    isFocused
                      ? "text-primary-500 font-fira-code-semibold"
                      : "text-secondary-400 font-fira-code-medium"
                  }`}
                >
                  [home]
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Screen 2: Vault */}
          {state.routes.map((route, index) => {
            if (route.name !== "vault") return null;
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                className={`flex-col items-center gap-2 h-20 justify-center rounded-2xl w-24 ${
                  isFocused ? "bg-secondary-500" : ""
                }`}
              >
                <Icon.VaultIcon
                  size={24}
                  color={
                    isFocused ? Colors.primary[500] : Colors.secondary[400]
                  }
                />
                <Text
                  className={`h-6 ${
                    isFocused
                      ? "text-primary-500 font-fira-code-semibold"
                      : "text-secondary-400 font-fira-code-medium"
                  }`}
                >
                  [vault]
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Screen 3: Chat */}
          {state.routes.map((route, index) => {
            if (route.name !== "chat") return null;
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                className={`flex-col items-center gap-2 h-20 justify-center rounded-2xl w-24 ${
                  isFocused ? "bg-secondary-500" : ""
                }`}
              >
                <Icon.ChatIcon
                  size={24}
                  color={
                    isFocused ? Colors.primary[500] : Colors.secondary[400]
                  }
                />
                <Text
                  className={`h-6 ${
                    isFocused
                      ? "text-primary-500 font-fira-code-semibold"
                      : "text-secondary-400 font-fira-code-medium"
                  }`}
                >
                  [chat]
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Screen 4: Settings */}
          {state.routes.map((route, index) => {
            if (route.name !== "settings") return null;
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                className={`flex-col items-center gap-2 h-20 justify-center rounded-2xl w-24 ${
                  isFocused ? "bg-secondary-500" : ""
                }`}
              >
                <Icon.GearIcon
                  size={24}
                  color={
                    isFocused ? Colors.primary[500] : Colors.secondary[400]
                  }
                />
                <Text
                  className={`h-6 ${
                    isFocused
                      ? "text-primary-500 font-fira-code-semibold"
                      : "text-secondary-400 font-fira-code-medium"
                  }`}
                >
                  [config]
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}

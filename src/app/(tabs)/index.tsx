import { AntDesign, Entypo } from "@expo/vector-icons";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";

import { Colors } from "@/components/colors";
import { SelectInput } from "@/components/Elements/SelectInput";

const data = [
  {
    label: "[all]",
    value: "all",
  },
  {
    label: "[sys]",
    value: "sys",
  },
  {
    label: "[vault]",
    value: "vault",
  },
  {
    label: "[chat]",
    value: "chat",
  },
];

export default function HomeTab() {
  const [value, setValue] = useState<string | null>(null);

  return (
    <SafeAreaView className="px-8 pt-8 bg-primary">
      {/* Header*/}
      <View className="gap-1 mb-4">
        <View className="flex-row items-center gap-2">
          <Text className="shadow shadow-white/60 pt-1 text-secondary-400 text-4xl font-geist-mono-light">
            WELCOME,
          </Text>
          <Text className="shadow shadow-white/60 pt-1 text-secondary text-4xl font-geist-mono">
            PM
          </Text>
        </View>
        <Text className="text-primary-300 text-xl font-fira-code">
          {"//"}v0.0.1-alpha
        </Text>
      </View>
      <ScrollView>
        {/* Security Status */}
        <View className="border border-primary-400 rounded-2xl p-6 mt-4 gap-6">
          <View className="gap-3">
            <View className="flex-row items-center">
              <View className="rounded-full shadow shadow-white/60 bg-secondary-400 h-2 w-2" />
              <Text className="ml-4 mr-2 text-secondary-500 text-xl font-fira-code">
                status:
              </Text>
              <Text className="text-secondary shadow shadow-white/60 text-2xl font-geist-mono mr-2">
                SECURE
              </Text>
              <AntDesign
                className="shadow shadow-white/60"
                name="safety"
                size={16}
                color={Colors.secondary[400]}
              />
            </View>
            <View className="flex-row items-center">
              <View className="rounded-full bg-secondary-400 h-2 w-2" />
              <Text className="ml-4 mr-2 text-secondary-500 text-xl font-fira-code">
                contacts:
              </Text>
              <Text className="text-secondary text-xl font-fira-code">3</Text>
            </View>
            <View className="flex-row items-center">
              <View className="rounded-full bg-secondary-400 h-2 w-2" />
              <Text className="ml-4 mr-2 text-secondary-500 text-xl font-fira-code">
                vault files:
              </Text>
              <Text className="text-secondary text-xl font-fira-code">12</Text>
            </View>
            <View className="flex-col gap-1">
              <View className="flex-row items-center">
                <View className="rounded-full bg-secondary-400 h-2 w-2" />
                <Text className="ml-4 text-secondary-500 text-xl font-fira-code">
                  last login:
                </Text>
              </View>
              <Text className="ml-6 text-secondary text-lg font-fira-code">
                [12/11/2025 01:22:35]
              </Text>
            </View>
          </View>
          <View className="flex-row items-center justify-between">
            <View className="flex-col">
              <Text className="text-primary-100 text-xl font-fira-code">
                {"//"}public-identity
              </Text>
              <Text className="text-secondary-600 text-xl font-fira-code">
                0xAD82JK...8KD94H
              </Text>
            </View>
            <TouchableOpacity className="items-center justify-center h-12 w-28 bg-primary-500 rounded-2xl">
              <Text className="text-secondary-400 text-lg font-fira-code">
                /share
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Security Settings */}
        <View className="border border-primary-400 rounded-2xl p-6 mt-6 gap-6">
          <View className="gap-3">
            <View className="flex-row justify-between">
              <View className="flex-row items-center">
                <Text className="mr-2 text-secondary-500 text-xl font-fira-code">
                  face-lock:
                </Text>
                <Text className="text-secondary shadow shadow-white/30 text-xl font-geist-mono">
                  ON
                </Text>
              </View>
              <View className="flex-row items-center">
                <Text className="mr-2 text-secondary-500 text-xl font-fira-code">
                  anti-SS:
                </Text>
                <Text className="text-secondary shadow shadow-white/30 text-xl font-geist-mono">
                  ON
                </Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Text className="mr-2 text-secondary-500 text-xl font-fira-code">
                  pass-code:
                </Text>
                <Text className="text-primary-200 text-xl font-fira-code">
                  OFF
                </Text>
              </View>
              <TouchableOpacity className="items-center justify-center h-12 w-28 bg-primary-500 rounded-2xl">
                <Text className="text-secondary-400 text-lg font-fira-code">
                  /config
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {/* Logs */}
        <View>
          <View className="mt-8 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Entypo
                name="triangle-down"
                size={24}
                color={Colors.secondary[500]}
              />
              <Text className="ml-3 text-secondary-500 text-xl font-fira-code">
                Logs:
              </Text>
            </View>
            <SelectInput
              options={data}
              value={value || "all"}
              onValueChange={setValue}
              placeholder="[all]"
              className="w-32"
            />
          </View>
          <View className="h-px mt-4 bg-primary-400" />
          <View className="flex-row justify-between mt-5">
            <TouchableOpacity className="items-center justify-center h-12 w-28 bg-secondary-600 rounded-2xl">
              <Text className="text-primary text-lg font-fira-code-medium">
                [info]
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="items-center justify-center h-12 w-28 bg-primary-500 rounded-2xl">
              <Text className="text-secondary-400 text-lg font-fira-code">
                [warning]
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="items-center justify-center h-12 w-28 bg-primary-500 rounded-2xl">
              <Text className="text-secondary-400 text-lg font-fira-code">
                [alert]
              </Text>
            </TouchableOpacity>
          </View>

          {/* Logs messages */}
          <View className="mt-6 gap-4">
            <View className="flex-col gap-2">
              <View className="flex-row items-center justify-between px-2">
                <Text className="text-primary-100 text-xl font-fira-code">
                  [info]
                </Text>
                <Text className="text-primary-100 text-lg font-fira-code">
                  [12/12/25 01:22:35]
                </Text>
              </View>
              <Text className="text-secondary-600 text-lg font-fira-code">
                <Text className="text-secondary">2</Text> new{" "}
                <Text className="text-secondary">messages</Text> from{" "}
                <Text className="text-secondary">mavri</Text>
              </Text>
            </View>
            <View className="flex-col gap-2">
              <View className="flex-row items-center justify-between px-2">
                <Text className="text-primary-100 text-xl font-fira-code">
                  [info]
                </Text>
                <Text className="text-primary-100 text-lg font-fira-code">
                  [11/12/25 12:34:17]
                </Text>
              </View>
              <Text className="text-secondary-600 text-lg font-fira-code">
                <Text className="text-secondary">Face-lock</Text> verification:{" "}
                <Text className="text-secondary">SUCCESS</Text>
              </Text>
            </View>
          </View>

          {/* Spacer */}
          <View className="h-20" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

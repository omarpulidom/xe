import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Icon from "phosphor-react-native";
import { Colors } from "@/components/colors";
import { router } from "expo-router";

export default function ChatTab() {
  return (
    <SafeAreaView className="flex-1 px-8 pt-8 bg-primary">
      {/* Header*/}
      <View className="gap-1 flex-row items-center justify-between">
        <Text className="pt-1 text-secondary text-4xl font-geist-mono">
          CHAT/
        </Text>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity className="items-center justify-center h-12 w-24 bg-secondary-500 rounded-2xl">
            <Text className="text-primary-400 text-lg font-fira-code-semibold">
              /pair
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-primary-500 h-12 w-12 rounded-2xl items-center justify-center">
            <Icon.DotsThreeVerticalIcon
              size={24}
              color={Colors.secondary[400]}
            />
          </TouchableOpacity>
        </View>
      </View>
      {/* Subheader*/}
      <View className="gap-1 mt-8 flex-row items-center justify-between">
        <Text className="text-secondary-400 text-xl font-fira-code">
          contacts/
        </Text>
        <Text className="text-primary-100 text-xl font-fira-code">
          {"//"}4 contacts
        </Text>
      </View>
      {/* Separator */}
      <View className="h-px bg-primary-400 mt-6" />
      {/* Filters */}
      <View className="flex-row justify-between mt-4">
        <TouchableOpacity className="items-center justify-center h-12 w-28 bg-secondary-600 rounded-2xl">
          <Text className="text-primary text-lg font-fira-code-medium">
            [all]
          </Text>
        </TouchableOpacity>
        <TouchableOpacity className="items-center justify-center h-12 w-28 bg-primary-500 rounded-2xl">
          <Text className="text-secondary-400 text-lg font-fira-code">
            [un-read]
          </Text>
        </TouchableOpacity>
        <TouchableOpacity className="items-center justify-center h-12 w-28 border-primary-300 border rounded-2xl">
          <Text className="text-secondary-400 text-lg font-fira-code">
            /sudo
          </Text>
        </TouchableOpacity>
      </View>
      {/* Contacts */}
      <ScrollView className="mt-8" contentContainerClassName="gap-3">
        <TouchableOpacity className="flex-col gap-1">
          <View className="flex-row justify-between">
            <Text className="text-secondary-600 text-xl font-fira-code">
              {"<"}
              <Text className="text-secondary-200">@</Text>
              <Text className="text-secondary-600">mavri</Text>
              {">"}
            </Text>
            <Text className="text-primary-100 text-lg font-fira-code">
              [14/09/25 11:22]
            </Text>
          </View>
          <Text className="text-secondary-600 text-lg font-fira-code">
            <Text className="text-secondary-200">3 </Text>
            <Text className="text-secondary-600">new messages</Text>
          </Text>
        </TouchableOpacity>
        <View className="h-px bg-primary-500" />
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/dm")}
          className="flex-col gap-1"
        >
          <View className="flex-row justify-between">
            <Text className="text-secondary-600 text-xl font-fira-code">
              {"<"}
              <Text className="text-secondary-200">@</Text>
              <Text className="text-secondary-600">crish</Text>
              {">"}
            </Text>
            <Text className="text-primary-100 text-lg font-fira-code">
              [14/09/25 10:45]
            </Text>
          </View>
          <Text className="text-secondary-600 text-lg font-fira-code">
            No new messages
          </Text>
        </TouchableOpacity>
        <View className="h-px bg-primary-500" />
        <TouchableOpacity className="flex-col gap-1">
          <View className="flex-row justify-between">
            <Text className="text-secondary-600 text-xl font-fira-code">
              {"<"}
              <Text className="text-secondary-200">@</Text>
              <Text className="text-secondary-600">chenchork</Text>
              {">"}
            </Text>
            <Text className="text-primary-100 text-lg font-fira-code">
              [12/09/25 01:26]
            </Text>
          </View>
          <Text className="text-secondary-600 text-lg font-fira-code">
            No new messages
          </Text>
        </TouchableOpacity>
        <View className="h-px bg-primary-500" />
        <TouchableOpacity className="flex-col gap-1">
          <View className="flex-row justify-between">
            <Text className="text-secondary-600 text-xl font-fira-code">
              {"<"}
              <Text className="text-secondary-200">@</Text>
              <Text className="text-secondary-600">lickthstar</Text>
              {">"}
            </Text>
            <Text className="text-primary-100 text-lg font-fira-code">
              [11/09/25 12:41]
            </Text>
          </View>
          <Text className="text-secondary-600 text-lg font-fira-code">
            <Text className="text-secondary-200">2 </Text>
            <Text className="text-secondary-600">new messages</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

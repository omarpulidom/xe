import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/components/Providers/AuthProvider";
import { router } from "expo-router";
import { Colors } from "@/components/colors";
import * as Icon from "phosphor-react-native";
import React from "react";
import { AntDesign } from "@expo/vector-icons";

export default function DMTab() {
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-primary"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView className="flex-1 px-8 pt-8">
        {/* Header*/}
        <View className="gap-1 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/chat")}
            className="bg-primary-500 h-12 w-12 rounded-2xl items-center justify-center"
          >
            <Text className="text-secondary-400 text-lg font-fira-code">
              :wq
            </Text>
          </TouchableOpacity>
          <View className="flex-col items-center">
            <Text className="text-secondary-600 text-xl font-fira-code-light">
              {"<"}
              <Text className="text-secondary">@</Text>mavri{">"}
            </Text>
            <Text className="text-primary-100 text-base font-fira-code-light">
              using e2e-encryption
            </Text>
          </View>
          <TouchableOpacity className="bg-primary-500 h-12 w-12 rounded-2xl items-center justify-center">
            <Icon.DotsThreeVerticalIcon
              size={24}
              color={Colors.secondary[400]}
            />
          </TouchableOpacity>
        </View>
        {/* Separator */}
        <View className="h-px bg-primary-400 mt-4" />
        {/* Chat */}
        <ScrollView className="mt-6 -mx-3">
          {/* Date */}
          <Text className="text-center text-primary-100 text-lg font-fira-code mb-6">
            [31/11/25]
          </Text>
          {/* Messages */}
          <View className="mb-6">
            <View className="flex-row items-center justify-start gap-2">
              <Text className="text-center text-primary-100 text-lg font-fira-code">
                [10:45:13]
              </Text>
              <Text className="text-secondary-600 text-xl font-fira-code">
                {"<"}
                <Text className="text-secondary">@</Text>pm{">"}
              </Text>
              <Text className="text-secondary-200 text-xl font-fira-code-light">
                yo
              </Text>
            </View>
            <View className="flex-row items-center justify-start gap-2">
              <Text className="text-center text-primary-100 text-lg font-fira-code">
                [10:45:13]
              </Text>
              <Text className="text-secondary-600 text-xl font-fira-code">
                {"<"}
                <Text className="text-secondary">@</Text>pm{">"}
              </Text>
              <Text className="text-secondary-200 text-xl font-fira-code-light">
                bro
              </Text>
            </View>
            <View className="flex-row items-center justify-start gap-2">
              <Text className="text-center text-primary-100 text-lg font-fira-code">
                [10:45:13]
              </Text>
              <Text className="text-secondary-600 text-xl font-fira-code">
                {"<"}
                <Text className="text-secondary">@</Text>mavri{">"}
              </Text>
              <Text className="text-secondary-200 text-xl font-fira-code-light">
                ???
              </Text>
            </View>
          </View>
          {/* Date */}
          <Text className="text-center text-primary-100 text-lg font-fira-code mb-6">
            [01/12/25]
          </Text>
          {/* Messages */}
          <View className="mb-6">
            <View className="flex-row items-center justify-start gap-2">
              <Text className="text-center text-primary-100 text-lg font-fira-code">
                [10:45:13]
              </Text>
              <Text className="text-secondary-600 text-xl font-fira-code">
                {"<"}
                <Text className="text-secondary">@</Text>mavri{">"}
              </Text>
              <Text className="text-secondary-200 text-xl font-fira-code-light">
                bro
              </Text>
            </View>
            <View className="flex-row items-center justify-start gap-2">
              <Text className="text-center text-primary-100 text-lg font-fira-code">
                [10:45:13]
              </Text>
              <Text className="text-secondary-600 text-xl font-fira-code">
                {"<"}
                <Text className="text-secondary">@</Text>pm{">"}
              </Text>
              <Text className="text-secondary-200 text-xl font-fira-code-light">
                ???
              </Text>
            </View>
          </View>
        </ScrollView>
        {/* Input */}
        <View className="-mx-8 border-t border-primary-400 py-2">
          <View className="flex-row items-center gap-1 mx-2">
            <Text className="text-secondary-600 text-xl font-fira-code">
              <Text className="text-primary-100">{">"}</Text> {"<"}
              <Text className="text-secondary">@</Text>pm{">"}/
            </Text>
            <TextInput
              className="text-secondary-600 flex-1 text-lg font-fira-code-light px-4 py-2 rounded-xl border border-primary-400"
              placeholder="Type a message"
              placeholderClassName="text-secondary-400 text-lg font-fira-code-light"
            />
            <Text className="text-secondary-600 text-xl font-fira-code">|</Text>
            <TouchableOpacity className="border border-primary-400 h-12 w-12 rounded-2xl items-center justify-center">
              <AntDesign name="enter" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import * as Icon from "phosphor-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { Colors } from "@/components/colors";
import { SelectInput } from "@/components/Elements/SelectInput";
import { router } from "expo-router";

const typeData = [
  {
    label: "all",
    value: "all",
  },
  {
    label: "img",
    value: "img",
  },
  {
    label: "vid",
    value: "vid",
  },
  {
    label: "doc",
    value: "doc",
  },
];

const sortData = [
  {
    label: "name",
    value: "name",
  },
  {
    label: "date",
    value: "date",
  },
  {
    label: "size",
    value: "size",
  },
];

export default function AlbumTab() {
  const [typeValue, setTypeValue] = useState<string | null>(null);
  const [sortValue, setSortValue] = useState<string | null>(null);

  return (
    <SafeAreaView className="flex-1 px-8 pt-8 bg-primary">
      {/* Header*/}
      <View className="gap-1 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/vault")}
          className="bg-primary-500 h-12 w-12 rounded-2xl items-center justify-center"
        >
          <Text className="text-secondary-400 text-lg font-fira-code">../</Text>
        </TouchableOpacity>
        <Text className="text-secondary text-xl font-geist-mono">album_4/</Text>
        <TouchableOpacity className="bg-primary-500 h-12 w-12 rounded-2xl items-center justify-center">
          <Icon.DotsThreeVerticalIcon size={24} color={Colors.secondary[400]} />
        </TouchableOpacity>
      </View>
      {/* Subheader*/}
      <View className="gap-1 mt-8 flex-row items-center justify-between">
        <Text className="text-secondary-400 text-xl font-fira-code">
          media/
        </Text>
        <Text className="text-primary-100 text-xl font-fira-code">
          {"//"}3 files
        </Text>
      </View>
      {/* Separator */}
      <View className="h-px bg-primary-400 mt-6" />
      {/* Filters */}
      <View className="mt-4 items-center flex-row justify-between">
        <Text className="text-primary-100 text-xl font-fira-code">
          {">"} ls <Text className="text-secondary-600">type</Text>
        </Text>
        <SelectInput
          options={typeData}
          value={typeValue || "all"}
          onValueChange={setTypeValue}
          placeholder="all"
          className="w-24"
        />
        <Text className="text-secondary-600 text-xl font-fira-code">
          | sort
        </Text>
        <SelectInput
          options={sortData}
          value={sortValue || "name"}
          onValueChange={setSortValue}
          placeholder="name"
          className="w-24"
        />
      </View>
      {/* Albums */}
      <ScrollView className="mt-6" contentContainerClassName="gap-6">
        <View className="flex-row justify-center gap-6">
          {/* File 1 */}
          <TouchableOpacity className="flex-1">
            <View className="mb-2 border-2 rounded-2xl border-primary-500 w-full aspect-square" />
            <Text className="text-secondary-500 text-lg font-fira-code text-center">
              img_75396.jpg
            </Text>
            <Text className="text-primary-100 text-lg font-fira-code-light text-center">
              [12/04/25 15:06]
            </Text>
          </TouchableOpacity>
          {/* File 2 */}
          <TouchableOpacity className="flex-1">
            <View className="mb-2 border-2 rounded-2xl border-primary-500 w-full aspect-square" />
            <Text className="text-secondary-500 text-lg font-fira-code text-center">
              img_29756.jpg
            </Text>
            <Text className="text-primary-100 text-lg font-fira-code-light text-center">
              [22/12/25 19:26]
            </Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row justify-center gap-6">
          {/* File 3 */}
          <TouchableOpacity className="flex-1">
            <View className="mb-2 border-2 rounded-2xl border-primary-500 w-full aspect-square" />
            <Text className="text-secondary-500 text-lg font-fira-code text-center">
              img_29756.jpg
            </Text>
            <Text className="text-primary-100 text-lg font-fira-code-light text-center">
              [25/02/25 09:21]
            </Text>
          </TouchableOpacity>
          {/* File */}
          <View className="flex-1 aspect-square" />
        </View>
      </ScrollView>
      <TouchableOpacity className="absolute bottom-14 self-center items-center justify-center h-16 w-28 bg-secondary-500 rounded-2xl">
        <Text className="text-primary-400 text-lg font-fira-code-semibold">
          /add
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

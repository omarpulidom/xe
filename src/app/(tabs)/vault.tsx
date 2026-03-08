import { Colors } from "@/components/colors";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as Icon from "phosphor-react-native";
import { useState } from "react";
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

export default function VaultTab() {
  const [typeValue, setTypeValue] = useState<string | null>(null);
  const [sortValue, setSortValue] = useState<string | null>(null);

  return (
    <SafeAreaView className="flex-1 px-8 pt-8 bg-primary">
      {/* Header*/}
      <View className="gap-1 flex-row items-center justify-between">
        <Text className="pt-1 text-secondary text-4xl font-geist-mono">
          VAULT/
        </Text>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity className="items-center justify-center h-12 w-24 bg-secondary-500 rounded-2xl">
            <Text className="text-primary-400 text-lg font-fira-code-semibold">
              /add
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
          albums/
        </Text>
        <Text className="text-primary-100 text-xl font-fira-code">
          {"//"}3 albums
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
          {/* Album 1 */}
          <TouchableOpacity className="border-2 rounded-2xl p-4 border-primary-500 flex-1 aspect-square flex-col justify-between">
            <View className="flex-row items-center justify-between">
              <Icon.FolderIcon size={48} color={Colors.primary[100]} />
              <View className="-mr-2">
                <Icon.DotsThreeVerticalIcon
                  size={24}
                  color={Colors.primary[100]}
                />
              </View>
            </View>
            <View className="flex-col">
              <Text className="text-secondary-300 text-xl font-fira-code">
                album_1/
              </Text>
              <Text className="text-primary-100 text-lg font-fira-code-light">
                8 files
              </Text>
            </View>
          </TouchableOpacity>
          {/* Album 2 */}
          <TouchableOpacity className="border-2 rounded-2xl p-4 border-primary-500 flex-1 aspect-square flex-col justify-between">
            <View className="flex-row items-center justify-between">
              <Icon.FolderIcon size={48} color={Colors.primary[100]} />
              <View className="-mr-2">
                <Icon.DotsThreeVerticalIcon
                  size={24}
                  color={Colors.primary[100]}
                />
              </View>
            </View>
            <View className="flex-col">
              <Text className="text-secondary-300 text-xl font-fira-code">
                album_2/
              </Text>
              <Text className="text-primary-100 text-lg font-fira-code-light">
                12 files
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        <View className="flex-row justify-center gap-6">
          {/* Album 3 */}
          <TouchableOpacity
            className="border-2 rounded-2xl p-4 border-primary-500 flex-1 aspect-square flex-col justify-between"
            onPress={() => router.push("/(tabs)/album")}
          >
            <View className="flex-row items-center justify-between">
              <Icon.FolderIcon size={48} color={Colors.primary[100]} />
              <View className="-mr-2">
                <Icon.DotsThreeVerticalIcon
                  size={24}
                  color={Colors.primary[100]}
                />
              </View>
            </View>
            <View className="flex-col">
              <Text className="text-secondary-300 text-xl font-fira-code">
                album_3/
              </Text>
              <Text className="text-primary-100 text-lg font-fira-code-light">
                7 files
              </Text>
            </View>
          </TouchableOpacity>
          {/* Album 4 */}
          <TouchableOpacity
            className="border-2 rounded-2xl p-4 border-primary-500 flex-1 aspect-square flex-col justify-between"
            onPress={() => router.push("/(tabs)/album")}
          >
            <View className="flex-row items-center justify-between">
              <Icon.FolderIcon size={48} color={Colors.primary[100]} />
              <View className="-mr-2">
                <Icon.DotsThreeVerticalIcon
                  size={24}
                  color={Colors.primary[100]}
                />
              </View>
            </View>
            <View className="flex-col">
              <Text className="text-secondary-300 text-xl font-fira-code">
                album_4/
              </Text>
              <Text className="text-primary-100 text-lg font-fira-code-light">
                7 files
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

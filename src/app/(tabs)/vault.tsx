import { Colors } from "@/components/colors";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { randomUUID } from "react-native-quick-crypto";

import * as Icon from "phosphor-react-native";
import { useState, useCallback, useMemo } from "react";
import { SelectInput } from "@/components/Elements/SelectInput";
import { router, useFocusEffect } from "expo-router";
import {
  getAlbums,
  getAlbumsByMimeType,
  getAlbumsWithDocs,
  createAlbum,
  deleteAlbum,
  type AlbumWithCount,
} from "@/lib/vault";
import { AntDesign } from "@expo/vector-icons";

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
  const [albums, setAlbums] = useState<AlbumWithCount[]>([]);
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");

  const { width } = useWindowDimensions();
  // px-8 = 32px each side (64 total), gap between columns = 12
  const itemWidth = (width - 64 - 12) / 2;

  const filteredAlbums = useMemo(() => {
    const result = [...albums];

    const sort = sortValue ?? "name";
    result.sort((a, b) => {
      if (sort === "size") return b.file_count - a.file_count;
      if (sort === "date") return b.created_at - a.created_at;
      return a.name.localeCompare(b.name); // name (default)
    });

    return result;
  }, [albums, sortValue]);

  const loadAlbums = useCallback(async () => {
    //type filter is done via SQL query, so we only fetch relevant albums and their file counts
    try {
      let data: AlbumWithCount[];
      if (typeValue === "img") {
        data = await getAlbumsByMimeType("image/");
      } else if (typeValue === "vid") {
        data = await getAlbumsByMimeType("video/");
      } else if (typeValue === "doc") {
        data = await getAlbumsWithDocs();
      } else {
        data = await getAlbums();
      }
      setAlbums(data);
    } catch (err) {
      console.error("[VaultTab] loadAlbums error:", err);
    }
  }, [typeValue]);

  useFocusEffect(() => {
    loadAlbums();
  });

  const handleCreateAlbum = useCallback(async () => {
    const name = newAlbumName.trim();
    if (!name) return;

    try {
      const id = randomUUID();
      await createAlbum(id, name);
      setNewAlbumName("");
      setShowNewAlbum(false);
      await loadAlbums();
    } catch (err) {
      console.error("[VaultTab] createAlbum error:", err);
    }
  }, [newAlbumName, loadAlbums]);

  const handleDeleteAlbum = useCallback(
    (albumId: string, albumName: string) => {
      Alert.alert("Delete Album", `Delete "${albumName}" and all its files?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteAlbum(albumId);
            await loadAlbums();
          },
        },
      ]);
    },
    [loadAlbums],
  );

  return (
    <SafeAreaView className="flex-1 px-8 pt-8 bg-primary">
      {/* Header*/}
      <View className="gap-1 flex-row items-center justify-between">
        <Text className="pt-1 text-secondary text-4xl font-geist-mono">
          VAULT/
        </Text>
        {!showNewAlbum && (
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => setShowNewAlbum(true)}
              className="items-center justify-center h-12 w-24 bg-secondary-500 rounded-2xl"
            >
              <Text className="text-primary-400 text-lg font-fira-code-semibold">
                /md
              </Text>
            </TouchableOpacity>

            <TouchableOpacity className="bg-primary-500 h-12 w-12 rounded-2xl items-center justify-center">
              <Icon.DotsThreeVerticalIcon
                size={24}
                color={Colors.secondary[400]}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* New Album Input */}
      {showNewAlbum && (
        <View className="mt-4 flex-row items-center gap-3">
          <Text className="text-secondary-600 text-xl font-fira-code">
            <Text className="text-primary-100">{">"}</Text> md
          </Text>
          <TextInput
            value={newAlbumName}
            onChangeText={setNewAlbumName}
            placeholder="album_name"
            placeholderTextColor={Colors.primary[100]}
            autoFocus
            className="flex-1 h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code text-lg"
            onSubmitEditing={handleCreateAlbum}
          />
          <TouchableOpacity
            onPress={handleCreateAlbum}
            className="h-12 w-12 bg-secondary-500 rounded-2xl items-center justify-center"
          >
            <AntDesign name="enter" size={18} color={Colors.primary.DEFAULT} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowNewAlbum(false);
              setNewAlbumName("");
            }}
            className="h-12 w-12 bg-primary-500 rounded-2xl items-center justify-center"
          >
            <Text className="text-secondary-400 text-lg font-fira-code">
              ^C
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Subheader*/}
      <View className="gap-1 mt-8 flex-row items-center justify-between">
        <Text className="text-secondary-400 text-xl font-fira-code">
          albums/
        </Text>
        <Text className="text-primary-100 text-xl font-fira-code">
          {"//"}
          {albums.length} album{albums.length !== 1 ? "s" : ""}
        </Text>
      </View>
      {/* Separator */}
      <View className="h-px bg-primary-500 mt-4" />
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
      <FlatList
        data={filteredAlbums}
        numColumns={2}
        keyExtractor={(item) => item.id}
        className="mt-6"
        columnWrapperClassName="justify-between"
        contentContainerClassName="gap-6 pb-10"
        showsVerticalScrollIndicator={false}
        renderItem={({ item: album }) => (
          <TouchableOpacity
            className="border-2 rounded-2xl p-4 border-primary-500 aspect-square flex-col justify-between"
            style={{ width: itemWidth }}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/album",
                params: { albumId: album.id, albumName: album.name },
              })
            }
            onLongPress={() => handleDeleteAlbum(album.id, album.name)}
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
                {album.name}/
              </Text>
              <Text className="text-primary-100 text-lg font-fira-code-light">
                {album.file_count} file
                {album.file_count !== 1 ? "s" : ""}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <Icon.FolderIcon size={64} color={Colors.primary[300]} />
            <Text className="text-primary-100 text-xl font-fira-code mt-4">
              {"// "}no albums yet
            </Text>
            <Text className="text-primary-300 text-lg font-fira-code mt-1">
              tap /md to create one
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

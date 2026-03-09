import { Colors } from "@/components/colors";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { randomUUID } from "react-native-quick-crypto";

import * as Icon from "phosphor-react-native";
import { useState, useEffect, useCallback } from "react";
import { SelectInput } from "@/components/Elements/SelectInput";
import { router } from "expo-router";
import {
  getAlbums,
  createAlbum,
  deleteAlbum,
  type AlbumWithCount,
} from "@/lib/vault";

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

  const loadAlbums = useCallback(async () => {
    try {
      const data = await getAlbums();
      setAlbums(data);
    } catch (err) {
      console.error("[VaultTab] loadAlbums error:", err);
    }
  }, []);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

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

  // Chunk albums into pairs for grid layout
  const albumPairs: (AlbumWithCount | null)[][] = [];
  for (let i = 0; i < albums.length; i += 2) {
    albumPairs.push([albums[i], albums[i + 1] ?? null]);
  }

  return (
    <SafeAreaView className="flex-1 px-8 pt-8 bg-primary">
      {/* Header*/}
      <View className="gap-1 flex-row items-center justify-between">
        <Text className="pt-1 text-secondary text-4xl font-geist-mono">
          VAULT/
        </Text>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => setShowNewAlbum(true)}
            className="items-center justify-center h-12 w-24 bg-secondary-500 rounded-2xl"
          >
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

      {/* New Album Input */}
      {showNewAlbum && (
        <View className="mt-4 flex-row items-center gap-3">
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
            className="h-12 w-16 bg-secondary-500 rounded-2xl items-center justify-center"
          >
            <Text className="text-primary text-lg font-fira-code-semibold">
              ok
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowNewAlbum(false);
              setNewAlbumName("");
            }}
            className="h-12 w-12 bg-primary-500 rounded-2xl items-center justify-center"
          >
            <Text className="text-secondary-400 text-lg font-fira-code">×</Text>
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
        {albums.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Icon.FolderIcon size={64} color={Colors.primary[300]} />
            <Text className="text-primary-100 text-xl font-fira-code mt-4">
              {"// "}no albums yet
            </Text>
            <Text className="text-primary-300 text-lg font-fira-code mt-1">
              tap /add to create one
            </Text>
          </View>
        ) : (
          albumPairs.map((pair, pairIndex) => (
            <View
              key={`pair-${pairIndex}`}
              className="flex-row justify-center gap-6"
            >
              {pair.map((album, idx) =>
                album ? (
                  <TouchableOpacity
                    key={album.id}
                    className="border-2 rounded-2xl p-4 border-primary-500 flex-1 aspect-square flex-col justify-between"
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
                ) : (
                  <View key={`empty-${idx}`} className="flex-1 aspect-square" />
                ),
              )}
            </View>
          ))
        )}
        {/* Bottom Spacer */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
}

import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import * as Icon from "phosphor-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import { Colors } from "@/components/colors";
import { SelectInput } from "@/components/Elements/SelectInput";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { getFilesByAlbum, deleteFile, type VaultFile } from "@/lib/vault";
import { useVault } from "@/components/Providers/VaultProvider";
import { Alert, Modal, Image, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `[${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear().toString().slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}]`;
}

export default function AlbumTab() {
  const params = useLocalSearchParams<{ albumId: string; albumName: string }>();
  const albumId = params.albumId ?? "";
  const albumName = params.albumName ?? "album_4";

  const [typeValue, setTypeValue] = useState<string | null>(null);
  const [sortValue, setSortValue] = useState<string | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const { addFileToAlbum, decryptFileToCache } = useVault();
  const insets = useSafeAreaInsets();

  // Viewing state
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [decryptingFileId, setDecryptingFileId] = useState<string | null>(null);
  const [addingFiles, setAddingFiles] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!albumId) return;
    try {
      const data = await getFilesByAlbum(albumId);
      setFiles(data);
    } catch (err) {
      console.error("[AlbumTab] loadFiles error:", err);
    }
  }, [albumId]);

  const handleAddMedia = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAddingFiles(true);
        for (const asset of result.assets) {
          const mime = asset.type === "video" ? "video/mp4" : "image/jpeg";
          const name = asset.fileName || `file_${Date.now()}`;
          const uri = asset.uri.replace("file://", "");
          await addFileToAlbum(albumId, uri, mime, name);
        }
        await loadFiles();
      }
    } catch (err) {
      console.error("[AlbumTab] pick media error:", err);
      Alert.alert("Error", "Could not add media");
    } finally {
      setAddingFiles(false);
    }
  }, [albumId, addFileToAlbum, loadFiles]);

  const handleAddDocuments = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAddingFiles(true);
        for (const asset of result.assets) {
          const mime = asset.mimeType ?? "application/octet-stream";
          const name = asset.name ?? `doc_${Date.now()}`;
          const uri = asset.uri.replace("file://", "");
          await addFileToAlbum(albumId, uri, mime, name);
        }
        await loadFiles();
      }
    } catch (err) {
      console.error("[AlbumTab] pick documents error:", err);
      Alert.alert("Error", "Could not add documents");
    } finally {
      setAddingFiles(false);
    }
  }, [albumId, addFileToAlbum, loadFiles]);

  const handleAddFiles = useCallback(() => {
    Alert.alert("Add files", "What do you want to import?", [
      { text: "Photos & Videos", onPress: handleAddMedia },
      { text: "Documents", onPress: handleAddDocuments },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [handleAddMedia, handleAddDocuments]);

  const handleViewFile = useCallback(
    async (file: VaultFile) => {
      try {
        setDecryptingFileId(file.id);
        const decryptedUri = await decryptFileToCache(file.id);
        if (decryptedUri) {
          setViewingFile(`file://${decryptedUri}`);
        } else {
          Alert.alert("Error", "Failed to decrypt file");
        }
      } catch (err) {
        console.error("View file error", err);
        Alert.alert("Error", "Could not open file");
      } finally {
        setDecryptingFileId(null);
      }
    },
    [decryptFileToCache],
  );

  const handleCloseView = useCallback(async () => {
    // The user requested that we do NOT delete the file from cache immediately upon closing.
    // Instead it will remain in CacheDirectory and be cleared when the vault locks or app resets.
    setViewingFile(null);
  }, []);

  const handleDeleteFile = useCallback(
    (fileId: string, fileName: string) => {
      Alert.alert("Delete File", `Delete "${fileName}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteFile(fileId);
            await loadFiles();
          },
        },
      ]);
    },
    [loadFiles],
  );

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Chunk files into pairs for grid layout
  const filePairs: (VaultFile | null)[][] = [];
  for (let i = 0; i < files.length; i += 2) {
    filePairs.push([files[i], files[i + 1] ?? null]);
  }

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
        <Text className="text-secondary text-xl font-geist-mono">
          {albumName}/
        </Text>
        <TouchableOpacity className="bg-primary-500 h-12 w-12 rounded-2xl items-center justify-center">
          <Icon.DotsThreeVerticalIcon size={24} color={Colors.secondary[400]} />
        </TouchableOpacity>
      </View>
      {/* Subheader*/}
      <View className="gap-1 mt-8 flex-row items-center justify-between">
        <Text className="text-secondary-400 text-xl font-fira-code">
          files/
        </Text>
        <Text className="text-primary-100 text-xl font-fira-code">
          {"//"}
          {files.length} file{files.length !== 1 ? "s" : ""}
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
      {/* Files */}
      <ScrollView className="mt-6" contentContainerClassName="gap-6">
        {files.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Icon.FileIcon size={64} color={Colors.primary[300]} />
            <Text className="text-primary-100 text-xl font-fira-code mt-4">
              {"// "}no files yet
            </Text>
            <Text className="text-primary-300 text-lg font-fira-code mt-1">
              tap /add to import
            </Text>
          </View>
        ) : (
          filePairs.map((pair, pairIndex) => (
            <View
              key={`pair-${pairIndex}`}
              className="flex-row justify-center gap-6"
            >
              {pair.map((file, idx) =>
                file ? (
                  <TouchableOpacity
                    key={file.id}
                    className="flex-1 relative"
                    onPress={() => handleViewFile(file)}
                    onLongPress={() => handleDeleteFile(file.id, file.name)}
                    disabled={decryptingFileId === file.id}
                  >
                    <View className="mb-2 border-2 rounded-2xl border-primary-500 w-full aspect-square items-center justify-center">
                      {decryptingFileId === file.id ? (
                        <ActivityIndicator color={Colors.secondary[500]} />
                      ) : (
                        <Icon.LockIcon size={32} color={Colors.primary[200]} />
                      )}
                    </View>
                    <Text
                      className="text-secondary-500 text-lg font-fira-code text-center"
                      numberOfLines={1}
                    >
                      {file.name}
                    </Text>
                    <Text className="text-primary-100 text-lg font-fira-code-light text-center">
                      {formatTimestamp(file.created_at)}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View key={`empty-${idx}`} className="flex-1 aspect-square" />
                ),
              )}
            </View>
          ))
        )}
      </ScrollView>
      <TouchableOpacity
        onPress={handleAddFiles}
        disabled={addingFiles}
        className="absolute bottom-14 self-center items-center justify-center h-16 w-28 bg-secondary-500 rounded-2xl"
      >
        {addingFiles ? (
          <ActivityIndicator color={Colors.primary[500]} />
        ) : (
          <Text className="text-primary-400 text-lg font-fira-code-semibold">
            /add
          </Text>
        )}
      </TouchableOpacity>

      {/* Viewing Modal */}
      <Modal visible={!!viewingFile} animationType="fade" transparent={false}>
        <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
          <View className="p-4 flex-row justify-end">
            <TouchableOpacity
              onPress={handleCloseView}
              className="p-2 bg-primary-800 rounded-xl"
            >
              <Text className="text-secondary-400 text-lg font-fira-code">
                /close
              </Text>
            </TouchableOpacity>
          </View>
          <View className="flex-1 items-center justify-center">
            {viewingFile && (
              <Image
                source={{ uri: viewingFile }}
                className="w-full h-full"
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

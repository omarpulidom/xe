import {
  FlatList,
  Text,
  TouchableOpacity,
  TextInput,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import * as Icon from "phosphor-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Colors } from "@/components/colors";
import { SelectInput } from "@/components/Elements/SelectInput";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  getFilesByAlbum,
  deleteFile,
  renameFile,
  moveFileToAlbum,
  getAlbums,
  type VaultFile,
  type AlbumWithCount,
} from "@/lib/vault";
import { useVault } from "@/components/Providers/VaultProvider";
import { Alert, Modal, Image, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VideoView, useVideoPlayer } from "expo-video";
import { WebView } from "react-native-webview";

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

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const power = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1,
  );
  const value = size / 1024 ** power;
  return `${value >= 10 || power === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[power]}`;
}

function VideoFilePlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });
  return <VideoView player={player} style={{ flex: 1 }} contentFit="contain" />;
}

export default function AlbumTab() {
  const params = useLocalSearchParams<{ albumId: string; albumName: string }>();
  const albumId = params.albumId ?? "";
  const albumName = params.albumName ?? "album_4";

  const [typeValue, setTypeValue] = useState<string | null>(null);
  const [sortValue, setSortValue] = useState<string | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [albums, setAlbums] = useState<AlbumWithCount[]>([]);
  const { addFileToAlbum, decryptFileToCache } = useVault();
  const insets = useSafeAreaInsets();

  // Viewing state
  const [viewingFile, setViewingFile] = useState<{
    uri: string;
    mime: string;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [fileActionMode, setFileActionMode] = useState<
    "menu" | "rename" | "move" | "details" | null
  >(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveAlbumId, setMoveAlbumId] = useState("");
  const [isApplyingAction, setIsApplyingAction] = useState(false);
  const [decryptingFileId, setDecryptingFileId] = useState<string | null>(null);
  const [addingFiles, setAddingFiles] = useState(false);

  const { width } = useWindowDimensions();
  // px-8 = 32px each side (64 total), gap between columns = 12
  const itemWidth = (width - 64 - 12) / 2;

  const loadFiles = useCallback(async () => {
    if (!albumId) return;
    try {
      const data = await getFilesByAlbum(albumId);
      setFiles(data);
    } catch (err) {
      console.error("[AlbumTab] loadFiles error:", err);
    }
  }, [albumId]);

  const loadAlbums = useCallback(async () => {
    try {
      const data = await getAlbums();
      setAlbums(data);
    } catch (err) {
      console.error("[AlbumTab] loadAlbums error:", err);
    }
  }, []);

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
          setViewingFile({ uri: `file://${decryptedUri}`, mime: file.mime });
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
    // I do NOT delete the file from cache immediately upon closing.
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

  const closeFileActions = useCallback(() => {
    setFileActionMode(null);
    setSelectedFile(null);
    setRenameValue("");
    setMoveAlbumId("");
    setIsApplyingAction(false);
  }, []);

  const openFileActions = useCallback((file: VaultFile) => {
    setSelectedFile(file);
    setRenameValue(file.name);
    setFileActionMode("menu");
  }, []);

  const handleOpenMove = useCallback(() => {
    const destinationAlbums = albums.filter((a) => a.id !== albumId);
    if (destinationAlbums.length === 0) {
      Alert.alert("Move File", "Create another album first.");
      return;
    }

    setMoveAlbumId(destinationAlbums[0].id);
    setFileActionMode("move");
  }, [albums, albumId]);

  const handleSubmitRename = useCallback(async () => {
    if (!selectedFile) return;

    const name = renameValue.trim();
    if (!name) {
      Alert.alert("Rename File", "Name cannot be empty.");
      return;
    }

    try {
      setIsApplyingAction(true);
      await renameFile(selectedFile.id, name);
      await loadFiles();
      closeFileActions();
    } catch (err) {
      console.error("[AlbumTab] rename file error:", err);
      Alert.alert("Error", "Could not rename file");
    } finally {
      setIsApplyingAction(false);
    }
  }, [selectedFile, renameValue, loadFiles, closeFileActions]);

  const handleSubmitMove = useCallback(async () => {
    if (!selectedFile) return;
    if (!moveAlbumId) {
      Alert.alert("Move File", "Pick an album.");
      return;
    }

    try {
      setIsApplyingAction(true);
      await moveFileToAlbum(selectedFile.id, moveAlbumId);
      await loadFiles();
      closeFileActions();
    } catch (err) {
      console.error("[AlbumTab] move file error:", err);
      Alert.alert("Error", "Could not move file");
    } finally {
      setIsApplyingAction(false);
    }
  }, [selectedFile, moveAlbumId, loadFiles, closeFileActions]);

  const handleDeleteFromMenu = useCallback(() => {
    if (!selectedFile) return;

    const fileId = selectedFile.id;
    const fileName = selectedFile.name;
    closeFileActions();
    handleDeleteFile(fileId, fileName);
  }, [selectedFile, closeFileActions, handleDeleteFile]);

  useEffect(() => {
    loadFiles();
    loadAlbums();
  }, [loadFiles, loadAlbums]);

  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Type filter
    if (typeValue && typeValue !== "all") {
      result = result.filter((f) => {
        if (typeValue === "img") return f.mime.startsWith("image/");
        if (typeValue === "vid") return f.mime.startsWith("video/");
        if (typeValue === "doc")
          return !f.mime.startsWith("image/") && !f.mime.startsWith("video/");
        return true;
      });
    }

    // Sort
    const sort = sortValue ?? "date";
    result.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "size") return b.size - a.size;
      return b.created_at - a.created_at; // date (default)
    });

    return result;
  }, [files, typeValue, sortValue]);

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
      {/* Files */}
      <FlatList
        data={filteredFiles}
        numColumns={2}
        keyExtractor={(item) => item.id}
        className="mt-6"
        columnWrapperClassName="justify-between"
        contentContainerClassName="gap-6 pb-28"
        showsVerticalScrollIndicator={false}
        renderItem={({ item: file }) => (
          <TouchableOpacity
            style={{ width: itemWidth }}
            onPress={() => handleViewFile(file)}
            onLongPress={() => openFileActions(file)}
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
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <Icon.FileIcon size={64} color={Colors.primary[300]} />
            <Text className="text-primary-100 text-xl font-fira-code mt-4">
              {"// "}no files yet
            </Text>
            <Text className="text-primary-300 text-lg font-fira-code mt-1">
              tap /add to import
            </Text>
          </View>
        }
      />
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

      <Modal
        visible={!!selectedFile && !!fileActionMode}
        transparent
        animationType="fade"
        onRequestClose={closeFileActions}
      >
        <Pressable
          className="flex-1 items-center justify-center px-8"
          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
          onPress={closeFileActions}
        >
          <Pressable
            className="w-full max-w-sm bg-primary-500 border border-primary-400 rounded-2xl overflow-hidden"
            onPress={() => {}}
          >
            {fileActionMode === "menu" && (
              <>
                <View className="px-4 py-4 border-b border-primary-400">
                  <Text
                    className="text-secondary text-lg font-fira-code-semibold"
                    numberOfLines={1}
                  >
                    {selectedFile?.name}
                  </Text>
                </View>

                <TouchableOpacity
                  className="px-4 py-4 border-b border-primary-400"
                  onPress={() => setFileActionMode("rename")}
                  activeOpacity={0.7}
                >
                  <Text className="text-secondary-400 text-lg font-fira-code">
                    rename
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="px-4 py-4 border-b border-primary-400"
                  onPress={handleOpenMove}
                  activeOpacity={0.7}
                >
                  <Text className="text-secondary-400 text-lg font-fira-code">
                    move
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="px-4 py-4 border-b border-primary-400"
                  onPress={() => setFileActionMode("details")}
                  activeOpacity={0.7}
                >
                  <Text className="text-secondary-400 text-lg font-fira-code">
                    file_details
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="px-4 py-4 border-b border-primary-400"
                  onPress={handleDeleteFromMenu}
                  activeOpacity={0.7}
                >
                  <Text className="text-red-300 text-lg font-fira-code">
                    delete
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="px-4 py-4"
                  onPress={closeFileActions}
                  activeOpacity={0.7}
                >
                  <Text className="text-primary-100 text-lg font-fira-code">
                    cancel
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {fileActionMode === "rename" && (
              <View className="p-4 gap-4">
                <Text className="text-secondary-400 text-lg font-fira-code">
                  rename file
                </Text>
                <TextInput
                  value={renameValue}
                  onChangeText={setRenameValue}
                  placeholder="file_name"
                  placeholderTextColor={Colors.primary[100]}
                  autoFocus
                  className="h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code text-lg"
                  onSubmitEditing={handleSubmitRename}
                />
                <View className="flex-row items-center justify-end gap-3">
                  <TouchableOpacity
                    className="h-12 px-4 rounded-xl bg-primary-600 items-center justify-center"
                    onPress={() => setFileActionMode("menu")}
                    disabled={isApplyingAction}
                  >
                    <Text className="text-secondary font-fira-code">back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="h-12 px-4 rounded-xl bg-secondary-500 items-center justify-center"
                    onPress={handleSubmitRename}
                    disabled={isApplyingAction}
                  >
                    <Text className="text-primary-500 font-fira-code-semibold">
                      save
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {fileActionMode === "move" && (
              <View className="p-4 gap-4">
                <Text className="text-secondary-400 text-lg font-fira-code">
                  move file
                </Text>
                <SelectInput
                  options={albums
                    .filter((a) => a.id !== albumId)
                    .map((a) => ({ label: a.name, value: a.id }))}
                  value={moveAlbumId}
                  onValueChange={setMoveAlbumId}
                  placeholder="album"
                  className="w-full"
                />
                <View className="flex-row items-center justify-end gap-3">
                  <TouchableOpacity
                    className="h-12 px-4 rounded-xl bg-primary-600 items-center justify-center"
                    onPress={() => setFileActionMode("menu")}
                    disabled={isApplyingAction}
                  >
                    <Text className="text-secondary font-fira-code">back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="h-12 px-4 rounded-xl bg-secondary-500 items-center justify-center"
                    onPress={handleSubmitMove}
                    disabled={isApplyingAction}
                  >
                    <Text className="text-primary-500 font-fira-code-semibold">
                      move
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {fileActionMode === "details" && selectedFile && (
              <View className="p-4 gap-4">
                <Text className="text-secondary-400 text-lg font-fira-code">
                  file details
                </Text>

                <View className="border border-primary-400 rounded-2xl p-3 gap-2 bg-primary-600">
                  <Text
                    className="text-base font-fira-code-light"
                    numberOfLines={2}
                  >
                    <Text className="text-secondary-600">name: </Text>
                    <Text className="text-secondary-200">
                      {selectedFile.name}
                    </Text>
                  </Text>
                  <Text className="text-base font-fira-code-light">
                    <Text className="text-secondary-600">type: </Text>
                    <Text className="text-secondary-200">
                      {selectedFile.mime}
                    </Text>
                  </Text>
                  <Text className="text-base font-fira-code-light">
                    <Text className="text-secondary-600">size: </Text>
                    <Text className="text-secondary-200">
                      {formatFileSize(selectedFile.size)} ({selectedFile.size}{" "}
                      B)
                    </Text>
                  </Text>
                  <Text className="text-base font-fira-code-light">
                    <Text className="text-secondary-600">created: </Text>
                    <Text className="text-secondary-200">
                      {formatTimestamp(selectedFile.created_at)}
                    </Text>
                  </Text>
                  <Text className="text-base font-fira-code-light">
                    <Text className="text-secondary-600">id: </Text>
                    <Text className="text-secondary-200">
                      {selectedFile.id}
                    </Text>
                  </Text>
                </View>

                <View className="flex-row items-center justify-end">
                  <TouchableOpacity
                    className="h-12 px-4 rounded-xl bg-primary-600 items-center justify-center"
                    onPress={() => setFileActionMode("menu")}
                  >
                    <Text className="text-secondary font-fira-code">back</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

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
          <View className="flex-1">
            {viewingFile &&
              (viewingFile.mime.startsWith("image/") ? (
                <Image
                  source={{ uri: viewingFile.uri }}
                  className="w-full h-full"
                  resizeMode="contain"
                />
              ) : viewingFile.mime.startsWith("video/") ? (
                <VideoFilePlayer uri={viewingFile.uri} />
              ) : (
                <WebView
                  source={{ uri: viewingFile.uri }}
                  style={{ flex: 1 }}
                  originWhitelist={["*"]}
                />
              ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

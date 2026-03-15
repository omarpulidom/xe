import { Colors } from "@/components/colors";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
  Pressable,
  Modal,
  Share,
  ActivityIndicator,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { randomUUID } from "react-native-quick-crypto";

import * as Icon from "phosphor-react-native";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { SelectInput } from "@/components/Elements/SelectInput";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import {
  getAlbums,
  getAlbumsByMimeType,
  getAlbumsWithDocs,
  createAlbum,
  deleteAlbum,
  getFilesByAlbum,
  createEncryptedExportAlbumPackage,
  readExportPackage,
  importExportPackageToAlbum,
  getRecipientContacts,
  addRecipientContact,
  type RecipientContact,
  type AlbumWithCount,
} from "@/lib/vault";
import { AntDesign } from "@expo/vector-icons";
import { useVault } from "@/components/Providers/VaultProvider";

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
  const params = useLocalSearchParams<{ importPath?: string }>();

  const [typeValue, setTypeValue] = useState<string | null>(null);
  const [sortValue, setSortValue] = useState<string | null>(null);
  const [albums, setAlbums] = useState<AlbumWithCount[]>([]);
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumWithCount | null>(
    null,
  );
  const [albumActionMode, setAlbumActionMode] = useState<
    "menu" | "exportEncrypted" | null
  >(null);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportPassphraseConfirm, setExportPassphraseConfirm] = useState("");
  const [recipientContacts, setRecipientContacts] = useState<
    RecipientContact[]
  >([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [showAddRecipientModal, setShowAddRecipientModal] = useState(false);
  const [showVaultMenu, setShowVaultMenu] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [newRecipientName, setNewRecipientName] = useState("");
  const [newRecipientPublicKey, setNewRecipientPublicKey] = useState("");
  const [importTargetAlbumId, setImportTargetAlbumId] = useState("");
  const [importAlbumOptions, setImportAlbumOptions] = useState<
    AlbumWithCount[]
  >([]);
  const [importPackagePath, setImportPackagePath] = useState<string | null>(
    null,
  );
  const [importPackageName, setImportPackageName] = useState<string | null>(
    null,
  );
  const [importPackageScope, setImportPackageScope] = useState<
    "file" | "album" | null
  >(null);
  const [importNeedsPassphrase, setImportNeedsPassphrase] = useState(false);
  const [importPassphrase, setImportPassphrase] = useState("");
  const [isApplyingAction, setIsApplyingAction] = useState(false);
  const menuButtonRef = useRef<View>(null);
  const loadAlbumsRequestIdRef = useRef(0);

  const { decryptFileToCache, getMasterKey, addFileToAlbum } = useVault();

  const { width } = useWindowDimensions();
  // px-8 = 32px each side (64 total), gap between columns = 12
  const itemWidth = (width - 64 - 12) / 2;
  const vaultMenuWidth = 196;
  const keyboardModalGap = 20;

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
    const requestId = ++loadAlbumsRequestIdRef.current;
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

      if (requestId !== loadAlbumsRequestIdRef.current) {
        return;
      }

      setAlbums(data);
    } catch (err) {
      if (requestId !== loadAlbumsRequestIdRef.current) {
        return;
      }
      console.error("[VaultTab] loadAlbums error:", err);
    }
  }, [typeValue]);

  const loadRecipientContacts = useCallback(() => {
    const contacts = getRecipientContacts();
    setRecipientContacts(contacts);
    setSelectedRecipientId((prev) => {
      if (prev) return prev;
      return contacts.length > 0 ? contacts[0].id : "";
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAlbums();
      loadRecipientContacts();

      return () => {
        setShowVaultMenu(false);
        setShowAddRecipientModal(false);
        setSelectedAlbum(null);
        setAlbumActionMode(null);
        setImportPackagePath(null);
      };
    }, [loadAlbums, loadRecipientContacts]),
  );

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

  const closeAlbumActions = useCallback(() => {
    setSelectedAlbum(null);
    setAlbumActionMode(null);
    setExportPassphrase("");
    setExportPassphraseConfirm("");
    if (recipientContacts.length > 0) {
      setSelectedRecipientId(recipientContacts[0].id);
    } else {
      setSelectedRecipientId("");
    }
    setIsApplyingAction(false);
  }, [recipientContacts]);

  const handleAddRecipientContact = useCallback(() => {
    try {
      addRecipientContact({
        name: newRecipientName,
        publicKeyPem: newRecipientPublicKey,
      });
      setNewRecipientName("");
      setNewRecipientPublicKey("");
      loadRecipientContacts();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not add recipient";
      Alert.alert("Recipients", message);
    }
  }, [newRecipientName, newRecipientPublicKey, loadRecipientContacts]);

  const openVaultMenu = useCallback(() => {
    menuButtonRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setMenuAnchor({ x: pageX, y: pageY, width, height });
      setShowVaultMenu(true);
    });
  }, []);

  const handleOpenAddRecipient = useCallback(() => {
    setShowVaultMenu(false);
    setShowAddRecipientModal(true);
  }, []);

  const closeAddRecipientModal = useCallback(() => {
    setShowAddRecipientModal(false);
    setNewRecipientName("");
    setNewRecipientPublicKey("");
  }, []);

  const openAlbumActions = useCallback((album: AlbumWithCount) => {
    setSelectedAlbum(album);
    setAlbumActionMode("menu");
  }, []);

  const handleDeleteFromMenu = useCallback(() => {
    if (!selectedAlbum) return;
    const albumId = selectedAlbum.id;
    const albumName = selectedAlbum.name;
    closeAlbumActions();
    handleDeleteAlbum(albumId, albumName);
  }, [selectedAlbum, closeAlbumActions, handleDeleteAlbum]);

  const handleExportPlainAlbum = useCallback(async () => {
    if (!selectedAlbum) return;
    try {
      setIsApplyingAction(true);
      const albumFiles = await getFilesByAlbum(selectedAlbum.id);
      if (albumFiles.length === 0) {
        Alert.alert("Export", "This album has no files.");
        return;
      }

      closeAlbumActions();

      let sharedCount = 0;
      for (const file of albumFiles) {
        const decryptedFilePath = await decryptFileToCache(file.id);
        if (!decryptedFilePath) {
          throw new Error(`Could not decrypt ${file.name}`);
        }

        const result = await Share.share({
          url: `file://${decryptedFilePath}`,
          title: `Export ${file.name}`,
          message: file.name,
        });

        if (result.action === Share.dismissedAction) {
          break;
        }

        sharedCount += 1;
      }

      if (sharedCount > 0) {
        Alert.alert(
          "Export",
          `Shared ${sharedCount} file${sharedCount === 1 ? "" : "s"}.`,
        );
      }
    } catch (err) {
      console.error("[VaultTab] plain album export error:", err);
      Alert.alert("Export", "Could not export album.");
    } finally {
      setIsApplyingAction(false);
    }
  }, [selectedAlbum, decryptFileToCache, closeAlbumActions]);

  const handleExportEncryptedAlbum = useCallback(async () => {
    if (!selectedAlbum) return;

    const passphrase = exportPassphrase.trim();
    if (passphrase.length < 6) {
      Alert.alert(
        "Encrypted Export",
        "Passphrase must be at least 6 characters.",
      );
      return;
    }
    if (passphrase !== exportPassphraseConfirm.trim()) {
      Alert.alert("Encrypted Export", "Passphrases do not match.");
      return;
    }

    const recipient = recipientContacts.find(
      (c) => c.id === selectedRecipientId,
    );
    if (!recipient) {
      Alert.alert("Encrypted Export", "Select a recipient contact.");
      return;
    }

    const masterKey = getMasterKey();
    if (!masterKey) {
      Alert.alert("Encrypted Export", "Vault is locked.");
      return;
    }

    try {
      setIsApplyingAction(true);
      const albumFiles = await getFilesByAlbum(selectedAlbum.id);
      if (albumFiles.length === 0) {
        Alert.alert("Export", "This album has no files.");
        return;
      }

      const packageUri = await createEncryptedExportAlbumPackage({
        albumId: selectedAlbum.id,
        albumName: selectedAlbum.name,
        files: albumFiles,
        masterKey,
        passphrase,
        recipient: {
          id: recipient.id,
          name: recipient.name,
          publicKeyPem: recipient.publicKeyPem,
        },
      });

      closeAlbumActions();
      await Share.share({
        url: packageUri,
        title: "Encrypted album export",
        message: "Calc encrypted album export package",
      });
    } catch (err) {
      console.error("[VaultTab] encrypted album export error:", err);
      Alert.alert("Encrypted Export", "Could not export encrypted album.");
    } finally {
      setIsApplyingAction(false);
    }
  }, [
    selectedAlbum,
    exportPassphrase,
    exportPassphraseConfirm,
    recipientContacts,
    selectedRecipientId,
    getMasterKey,
    closeAlbumActions,
  ]);

  const closeImportPackageModal = useCallback(() => {
    setImportTargetAlbumId("");
    setImportAlbumOptions([]);
    setImportPackagePath(null);
    setImportPackageName(null);
    setImportPackageScope(null);
    setImportNeedsPassphrase(false);
    setImportPassphrase("");
    setIsApplyingAction(false);
  }, []);

  const openImportFromPath = useCallback(async (rawPath: string) => {
    const pickedPath = decodeURIComponent(rawPath).replace(/^file:\/\//, "");
    if (!/\.calcx$/i.test(pickedPath)) {
      throw new Error("Unsupported package extension");
    }

    const allAlbums = await getAlbums();
    if (allAlbums.length === 0) {
      Alert.alert("Import", "Create an album first.");
      return;
    }

    const pkg = await readExportPackage(pickedPath);

    setImportPackagePath(pickedPath);
    setImportPackageScope(pkg.scope);
    setImportNeedsPassphrase(pkg.mode === "encrypted");
    setImportPassphrase("");
    setImportTargetAlbumId(allAlbums[0].id);
    setImportAlbumOptions(allAlbums);
    setImportPackageName(pkg.scope === "file" ? pkg.file.name : pkg.album.name);
  }, []);

  const handlePickImportPackage = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const pickedPath = result.assets[0].uri.replace("file://", "");
      await openImportFromPath(pickedPath);
    } catch (err) {
      console.error("[VaultTab] pick import package error:", err);
      const message = err instanceof Error ? err.message : "";
      if (message.toLowerCase().includes("extension")) {
        Alert.alert("Import", "Please select a .calcx package.");
      } else {
        Alert.alert("Import", "Could not read package.");
      }
    }
  }, [openImportFromPath]);

  useEffect(() => {
    const rawImportPath = params.importPath;
    if (!rawImportPath) return;

    const openFromParam = async () => {
      try {
        await openImportFromPath(rawImportPath);
      } catch (err) {
        console.error("[VaultTab] importPath param error:", err);
        Alert.alert("Import", "Could not open package from link.");
      } finally {
        router.setParams({ importPath: undefined });
      }
    };

    openFromParam();
  }, [params.importPath, openImportFromPath]);

  const handleSubmitImportPackage = useCallback(async () => {
    if (!importPackagePath) return;
    if (!importTargetAlbumId) {
      Alert.alert("Import", "Pick a destination album.");
      return;
    }

    if (importNeedsPassphrase && importPassphrase.trim().length < 6) {
      Alert.alert("Import", "Passphrase must be at least 6 characters.");
      return;
    }

    try {
      setIsApplyingAction(true);
      const resultImport = await importExportPackageToAlbum({
        packagePathOrUri: importPackagePath,
        albumId: importTargetAlbumId,
        passphrase: importNeedsPassphrase ? importPassphrase.trim() : undefined,
        addFileToAlbum,
      });

      await loadAlbums();
      closeImportPackageModal();

      if (resultImport.importedCount === 1) {
        Alert.alert("Import", `Imported "${resultImport.label}"`);
      } else {
        Alert.alert(
          "Import",
          `Imported ${resultImport.importedCount} files from album "${resultImport.label}"`,
        );
      }
    } catch (err) {
      console.error("[VaultTab] import package error:", err);
      const message = err instanceof Error ? err.message.toLowerCase() : "";
      if (message.includes("passphrase")) {
        Alert.alert("Import", "Wrong passphrase.");
      } else if (message.includes("unauthorized")) {
        Alert.alert(
          "Import",
          "This package was not authorized for this device.",
        );
      } else {
        Alert.alert("Import", "Could not import package.");
      }
    } finally {
      setIsApplyingAction(false);
    }
  }, [
    importPackagePath,
    importTargetAlbumId,
    importNeedsPassphrase,
    importPassphrase,
    addFileToAlbum,
    loadAlbums,
    closeImportPackageModal,
  ]);

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
              disabled={isApplyingAction}
              className="items-center justify-center h-12 w-24 bg-secondary-500 rounded-2xl"
            >
              <Text className="text-primary-400 text-lg font-fira-code-semibold">
                /md
              </Text>
            </TouchableOpacity>

            <View ref={menuButtonRef} collapsable={false}>
              <TouchableOpacity
                onPress={openVaultMenu}
                disabled={isApplyingAction}
                className="bg-primary-500 h-12 w-12 rounded-2xl items-center justify-center"
              >
                <Icon.DotsThreeVerticalIcon
                  size={24}
                  color={Colors.secondary[400]}
                />
              </TouchableOpacity>
            </View>
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
            disabled={isApplyingAction}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/album",
                params: { albumId: album.id, albumName: album.name },
              })
            }
            onLongPress={() => openAlbumActions(album)}
          >
            <View className="flex-row items-center justify-between">
              <Icon.FolderIcon size={48} color={Colors.primary[100]} />
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

      <Modal
        visible={!!selectedAlbum && !!albumActionMode}
        transparent
        animationType="fade"
        onRequestClose={closeAlbumActions}
      >
        <Pressable
          className="flex-1 items-center justify-center px-8"
          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
          onPress={closeAlbumActions}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={keyboardModalGap}
            className="w-full items-center justify-center"
            style={{ paddingBottom: keyboardModalGap }}
          >
            <Pressable
              className="w-full max-w-sm bg-primary-500 border border-primary-400 rounded-2xl overflow-hidden"
              onPress={() => {}}
            >
              {albumActionMode === "menu" && (
                <>
                  <View className="px-4 py-4 border-b border-primary-400">
                    <Text
                      className="text-secondary text-lg font-fira-code-semibold"
                      numberOfLines={1}
                    >
                      {selectedAlbum?.name}
                    </Text>
                  </View>

                  <TouchableOpacity
                    className="px-4 py-4 border-b border-primary-400"
                    onPress={handleExportPlainAlbum}
                    disabled={isApplyingAction}
                    activeOpacity={0.7}
                  >
                    <Text className="text-secondary-400 text-lg font-fira-code">
                      export_plain
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="px-4 py-4 border-b border-primary-400"
                    onPress={() => setAlbumActionMode("exportEncrypted")}
                    disabled={isApplyingAction}
                    activeOpacity={0.7}
                  >
                    <Text className="text-secondary-400 text-lg font-fira-code">
                      export_encrypted
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="px-4 py-4 border-b border-primary-400"
                    onPress={handleDeleteFromMenu}
                    disabled={isApplyingAction}
                    activeOpacity={0.7}
                  >
                    <Text className="text-red-300 text-lg font-fira-code">
                      delete
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="px-4 py-4"
                    onPress={closeAlbumActions}
                    disabled={isApplyingAction}
                    activeOpacity={0.7}
                  >
                    <Text className="text-primary-100 text-lg font-fira-code">
                      cancel
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {albumActionMode === "exportEncrypted" && selectedAlbum && (
                <View className="p-4 gap-4">
                  <Text className="text-secondary-400 text-lg font-fira-code">
                    encrypted export
                  </Text>
                  <Text className="text-secondary-600 text-base font-fira-code-light">
                    This passphrase will be required on import.
                  </Text>
                  <SelectInput
                    options={recipientContacts.map((recipient) => ({
                      label: recipient.name,
                      value: recipient.id,
                    }))}
                    value={selectedRecipientId}
                    onValueChange={setSelectedRecipientId}
                    placeholder="recipient"
                    className="w-full"
                  />
                  <TextInput
                    value={exportPassphrase}
                    onChangeText={setExportPassphrase}
                    placeholder="passphrase"
                    placeholderTextColor={Colors.primary[100]}
                    secureTextEntry
                    autoFocus
                    className="h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code text-lg"
                  />
                  <TextInput
                    value={exportPassphraseConfirm}
                    onChangeText={setExportPassphraseConfirm}
                    placeholder="confirm passphrase"
                    placeholderTextColor={Colors.primary[100]}
                    secureTextEntry
                    className="h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code text-lg"
                    onSubmitEditing={handleExportEncryptedAlbum}
                  />
                  <View className="flex-row items-center justify-end gap-3">
                    <TouchableOpacity
                      className="h-12 px-4 rounded-xl bg-primary-600 items-center justify-center"
                      onPress={() => setAlbumActionMode("menu")}
                      disabled={isApplyingAction}
                    >
                      <Text className="text-secondary font-fira-code">
                        back
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="h-12 px-4 rounded-xl bg-secondary-500 items-center justify-center"
                      onPress={handleExportEncryptedAlbum}
                      disabled={isApplyingAction}
                    >
                      {isApplyingAction ? (
                        <ActivityIndicator color={Colors.primary[500]} />
                      ) : (
                        <Text className="text-primary-500 font-fira-code-semibold">
                          export
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal
        visible={!!importPackagePath}
        transparent
        animationType="fade"
        onRequestClose={closeImportPackageModal}
      >
        <Pressable
          className="flex-1 items-center justify-center px-8"
          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
          onPress={closeImportPackageModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={keyboardModalGap}
            className="w-full items-center justify-center"
            style={{ paddingBottom: keyboardModalGap }}
          >
            <Pressable
              className="w-full max-w-sm bg-primary-500 border border-primary-400 rounded-2xl p-4 gap-4"
              onPress={() => {}}
            >
              <Text className="text-secondary-400 text-lg font-fira-code">
                import package
              </Text>
              <Text className="text-secondary-600 text-base font-fira-code-light">
                {importPackageName
                  ? importPackageScope === "album"
                    ? `Album package: ${importPackageName}`
                    : `File package: ${importPackageName}`
                  : "Select destination to import."}
              </Text>

              <SelectInput
                options={importAlbumOptions.map((album) => ({
                  label: album.name,
                  value: album.id,
                }))}
                value={importTargetAlbumId}
                onValueChange={setImportTargetAlbumId}
                placeholder="destination album"
                className="w-full"
              />

              {importNeedsPassphrase && (
                <TextInput
                  value={importPassphrase}
                  onChangeText={setImportPassphrase}
                  placeholder="passphrase"
                  placeholderTextColor={Colors.primary[100]}
                  secureTextEntry
                  className="h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code text-lg"
                  onSubmitEditing={handleSubmitImportPackage}
                />
              )}

              <View className="flex-row items-center justify-end gap-3">
                <TouchableOpacity
                  className="h-12 px-4 rounded-xl bg-primary-600 items-center justify-center"
                  onPress={closeImportPackageModal}
                  disabled={isApplyingAction}
                >
                  <Text className="text-secondary font-fira-code">cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="h-12 px-4 rounded-xl bg-secondary-500 items-center justify-center"
                  onPress={handleSubmitImportPackage}
                  disabled={isApplyingAction}
                >
                  {isApplyingAction ? (
                    <ActivityIndicator color={Colors.primary[500]} />
                  ) : (
                    <Text className="text-primary-500 font-fira-code-semibold">
                      import
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal
        visible={showVaultMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVaultMenu(false)}
      >
        <Pressable
          className="flex-1"
          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
          onPress={() => setShowVaultMenu(false)}
        >
          <Pressable
            className="bg-primary-500 border border-primary-400 rounded-2xl overflow-hidden"
            style={{
              position: "absolute",
              top: menuAnchor.y + menuAnchor.height + 8,
              left: Math.min(
                Math.max(16, menuAnchor.x + menuAnchor.width - vaultMenuWidth),
                width - vaultMenuWidth - 16,
              ),
              width: vaultMenuWidth,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 18,
              elevation: 12,
            }}
            onPress={() => {}}
          >
            <View className="px-4 py-3 border-b border-primary-400 bg-primary-600/60">
              <Text className="text-primary-100 text-xs font-fira-code">
                vault/menu
              </Text>
            </View>
            <TouchableOpacity
              className="px-4 py-4 border-b border-primary-400"
              onPress={() => {
                setShowVaultMenu(false);
                void handlePickImportPackage();
              }}
              activeOpacity={0.75}
            >
              <Text className="text-secondary-400 text-lg font-fira-code">
                import
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="px-4 py-4"
              onPress={handleOpenAddRecipient}
              activeOpacity={0.75}
            >
              <Text className="text-secondary-400 text-lg font-fira-code">
                add_recipient
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showAddRecipientModal}
        transparent
        animationType="fade"
        onRequestClose={closeAddRecipientModal}
      >
        <Pressable
          className="flex-1 items-center justify-center px-8"
          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
          onPress={closeAddRecipientModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={keyboardModalGap}
            className="w-full items-center justify-center"
            style={{ paddingBottom: keyboardModalGap }}
          >
            <Pressable
              className="w-full max-w-md bg-primary-500 border border-primary-400 rounded-2xl p-5 gap-4"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.35,
                shadowRadius: 20,
                elevation: 14,
              }}
              onPress={() => {}}
            >
              <Text className="text-secondary text-lg font-fira-code">
                add recipient
              </Text>

              <View className="rounded-xl border border-primary-400 bg-primary-600/60 px-3 py-2">
                <Text className="text-primary-100 text-xs font-fira-code">
                  paste recipient's PEM public key and alias
                </Text>
              </View>

              <TextInput
                value={newRecipientName}
                onChangeText={setNewRecipientName}
                placeholder="recipient name"
                placeholderTextColor={Colors.primary[100]}
                className="h-12 px-4 border border-primary-300 rounded-2xl text-secondary font-fira-code text-lg"
              />
              <TextInput
                value={newRecipientPublicKey}
                onChangeText={setNewRecipientPublicKey}
                placeholder="recipient public key (PEM)"
                placeholderTextColor={Colors.primary[100]}
                multiline
                className="min-h-28 px-4 py-3 border border-primary-300 rounded-2xl text-secondary font-fira-code text-sm"
              />

              <View className="flex-row items-center justify-end gap-3">
                <TouchableOpacity
                  className="h-12 px-4 rounded-xl bg-primary-600 items-center justify-center"
                  onPress={closeAddRecipientModal}
                >
                  <Text className="text-secondary font-fira-code">cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="h-12 px-4 rounded-xl bg-secondary-500 items-center justify-center"
                  onPress={() => {
                    handleAddRecipientContact();
                    closeAddRecipientModal();
                  }}
                >
                  <Text className="text-primary-500 font-fira-code-semibold">
                    add
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

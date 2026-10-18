import {
  FlatList,
  Text,
  TouchableOpacity,
  TextInput,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  PanResponder,
} from "react-native";
import * as Icon from "phosphor-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Colors } from "@/components/colors";
import { SelectInput } from "@/components/Elements/SelectInput";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  getFilesByAlbum,
  deleteFile,
  renameFile,
  moveFileToAlbum,
  getAlbums,
  renameAlbum,
  deleteAlbum,
  readExportPackage,
  importExportPackageToAlbum,
  createEncryptedExportAlbumPackage,
  createEncryptedExportFilePackage,
  getRecipientContacts,
  type RecipientContact,
  type VaultFile,
  type AlbumWithCount,
} from "@/lib/vault";
import { useVault } from "@/components/Providers/VaultProvider";
import { useDownloads } from "@/components/Providers/DownloadProvider";
import {
  Alert,
  Modal,
  Image,
  ActivityIndicator,
  Share,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VideoView, useVideoPlayer } from "expo-video";
import { WebView } from "react-native-webview";
import { LinearGradient } from "expo-linear-gradient";

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

type ImportJobStatus =
  | "queued"
  | "copying"
  | "encrypting"
  | "saving_db"
  | "done"
  | "error";

type ImportJob = {
  id: string;
  batchId: string;
  index: number;
  total: number;
  name: string;
  mime: string;
  uri: string;
  size?: number;
  status: ImportJobStatus;
  progress: number;
  retries: number;
  errorMessage?: string;
};

type ImportBatch = {
  id: string;
  albumId: string;
  label: string;
  createdAt: number;
  totalJobs: number;
  doneCount: number;
  jobs: ImportJob[];
};

function jobStatusLabel(status: ImportJobStatus): string {
  if (status === "saving_db") return "saving_db";
  return status;
}

function stageColor(status: ImportJobStatus): string {
  if (status === "done") return Colors.secondary[500];
  if (status === "error") return "#f87171";
  return Colors.secondary[400];
}

function stageProgressByStatus(status: ImportJobStatus): number {
  if (status === "queued") return 0;
  if (status === "copying") return 0.15;
  if (status === "encrypting") return 0.8;
  if (status === "saving_db") return 0.98;
  if (status === "done") return 1;
  return 0;
}

function getImportTimingConfig(size?: number) {
  const mb = size && size > 0 ? size / (1024 * 1024) : 0;
  // Scale timings up to about 256MB for smoother large-file perception.
  const factor = Math.min(1, mb / 256);

  return {
    minCopyingMs: Math.round(140 + factor * 360),
    minEncryptingMs: Math.round(900 + factor * 5000),
    minSavingDbMs: Math.round(240 + factor * 480),
    tickerStep: Math.max(0.0035, 0.012 - factor * 0.0075),
    tickerIntervalMs: Math.round(100 + factor * 180),
  };
}

function VideoFilePlayer({
  uri,
  shouldPlay,
}: {
  uri: string;
  shouldPlay: boolean;
}) {
  const player = useVideoPlayer(uri, (p) => {
    if (shouldPlay) {
      p.play();
    } else {
      p.pause();
    }
  });

  useEffect(() => {
    if (shouldPlay) {
      player.play();
      return;
    }

    player.pause();
  }, [player, shouldPlay]);

  return (
    <View style={{ width: "100%", height: "100%" }}>
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit="contain"
      />
    </View>
  );
}

function SmoothProgressBar({
  progress,
  fillColor,
  height,
  backgroundColor,
}: {
  progress: number;
  fillColor: string;
  height: number;
  backgroundColor: string;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const animated = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(animated, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animated, progress]);

  const barWidth = animated.interpolate({
    inputRange: [0, 1],
    outputRange: [0, trackWidth || 1],
  });

  return (
    <View
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      style={{
        height,
        borderRadius: height / 2,
        overflow: "hidden",
        backgroundColor,
      }}
    >
      <Animated.View
        style={{
          height: "100%",
          width: barWidth,
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
}

export default function AlbumTab() {
  const params = useLocalSearchParams<{ albumId: string; albumName: string }>();
  const albumId = params.albumId ?? "";
  const [currentAlbumName, setCurrentAlbumName] = useState(
    params.albumName ?? "album_4",
  );

  const [typeValue, setTypeValue] = useState<string | null>(null);
  const [sortValue, setSortValue] = useState<string | null>("name");
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [albums, setAlbums] = useState<AlbumWithCount[]>([]);
  const filteredFiles = useMemo(() => {
    let result = [...files];

    if (typeValue && typeValue !== "all") {
      result = result.filter((file) => {
        if (typeValue === "img") return file.mime.startsWith("image/");
        if (typeValue === "vid") return file.mime.startsWith("video/");
        if (typeValue === "doc")
          return !file.mime.startsWith("image/") && !file.mime.startsWith("video/");
        return true;
      });
    }

    const sort = sortValue ?? "name";
    result.sort((a, b) => {
      if (sort === "size") return b.size - a.size;
      if (sort === "date") return b.created_at - a.created_at;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [files, typeValue, sortValue]);
  const { addFileToAlbum, decryptFileToCache, getMasterKey } = useVault();
  const { batches: downloadBatches, retryJob: retryDownloadJob, retryBatch: retryDownloadBatch } = useDownloads();
  const insets = useSafeAreaInsets();

  // Viewing state
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerFiles, setViewerFiles] = useState<VaultFile[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showViewerChrome, setShowViewerChrome] = useState(true);
  const [viewerDecryptedUris, setViewerDecryptedUris] = useState<
    Record<string, string>
  >({});
  const [viewerLoadingFileId, setViewerLoadingFileId] = useState<string | null>(
    null,
  );
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [fileActionMode, setFileActionMode] = useState<
    "menu" | "rename" | "move" | "details" | "exportEncrypted" | null
  >(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveAlbumId, setMoveAlbumId] = useState("");
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportPassphraseConfirm, setExportPassphraseConfirm] = useState("");
  const [recipientContacts, setRecipientContacts] = useState<
    RecipientContact[]
  >([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [pendingImportPath, setPendingImportPath] = useState<string | null>(
    null,
  );
  const [pendingImportName, setPendingImportName] = useState<string | null>(
    null,
  );
  const [pendingImportScope, setPendingImportScope] = useState<
    "file" | "album" | null
  >(null);
  const [pendingImportEntries, setPendingImportEntries] = useState<
    Array<{ name: string; mime: string; size?: number }>
  >([]);
  const [importPassphrase, setImportPassphrase] = useState("");
  const [isImportingPackage, setIsImportingPackage] = useState(false);
  const [isApplyingAction, setIsApplyingAction] = useState(false);
  const [addingFiles, setAddingFiles] = useState(false);
  const [showAlbumMenu, setShowAlbumMenu] = useState(false);
  const [showAlbumActions, setShowAlbumActions] = useState(false);
  const [albumActionMode, setAlbumActionMode] = useState<
    "rename" | "details" | "exportEncrypted" | null
  >(null);
  const [albumRenameValue, setAlbumRenameValue] = useState("");
  const [albumExportPassphrase, setAlbumExportPassphrase] = useState("");
  const [albumExportPassphraseConfirm, setAlbumExportPassphraseConfirm] =
    useState("");
  const [menuAnchor, setMenuAnchor] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const menuButtonRef = useRef<View>(null);
  const galleryRef = useRef<FlatList<VaultFile>>(null);
  const importBatchesRef = useRef<ImportBatch[]>([]);
  const fileRefreshQueueRef = useRef<Promise<void>>(Promise.resolve());
  const importJobTickersRef = useRef<
    Record<string, ReturnType<typeof setInterval>>
  >({});
  const dismissBatchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const viewerChromeAnim = useRef(new Animated.Value(1)).current;
  const viewerTranslateY = useRef(new Animated.Value(0)).current;
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  const { width, height } = useWindowDimensions();
  // px-8 = 32px each side (64 total), gap between columns = 12
  const itemWidth = (width - 64 - 12) / 2;
  const keyboardModalGap = 20;
  const albumMenuWidth = 196;
  const viewerBackdropOpacity = viewerTranslateY.interpolate({
    inputRange: [0, height * 0.75],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

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

  const loadRecipientContacts = useCallback(() => {
    const contacts = getRecipientContacts();
    setRecipientContacts(contacts);
    if (contacts.length > 0 && !selectedRecipientId) {
      setSelectedRecipientId(contacts[0].id);
    }
  }, [selectedRecipientId]);

  useEffect(() => {
    if (Platform.OS === "android") {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  const animateLayout = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

  const flushUIFrame = useCallback(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    [],
  );

  const sleep = useCallback(
    (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    [],
  );

  useEffect(() => {
    importBatchesRef.current = importBatches;
  }, [importBatches]);

  const updateImportJob = useCallback(
    (batchId: string, jobId: string, patch: Partial<ImportJob>) => {
      setImportBatches((prev) =>
        prev.map((batch) => {
          if (batch.id !== batchId) return batch;
          return {
            ...batch,
            jobs: batch.jobs.map((job) =>
              job.id === jobId ? { ...job, ...patch } : job,
            ),
          };
        }),
      );
    },
    [],
  );

  const queueFileListRefresh = useCallback(() => {
    fileRefreshQueueRef.current = fileRefreshQueueRef.current
      .then(async () => {
        await loadFiles();
        await flushUIFrame();
      })
      .catch((err) => {
        console.error("[AlbumTab] queueFileListRefresh error:", err);
      });
  }, [flushUIFrame, loadFiles]);

  const stopImportJobTicker = useCallback((tickerKey: string) => {
    const ticker = importJobTickersRef.current[tickerKey];
    if (!ticker) return;
    clearInterval(ticker);
    delete importJobTickersRef.current[tickerKey];
  }, []);

  const startImportJobTicker = useCallback(
    (
      batchId: string,
      jobId: string,
      status: ImportJobStatus,
      from: number,
      to: number,
      step = 0.012,
      intervalMs = 120,
    ) => {
      const tickerKey = `${batchId}:${jobId}`;
      stopImportJobTicker(tickerKey);

      let current = from;
      const softTarget = Math.max(from, to);
      const hardTarget = Math.min(0.985, softTarget + 0.08);

      updateImportJob(batchId, jobId, {
        status,
        progress: current,
        errorMessage: undefined,
      });

      importJobTickersRef.current[tickerKey] = setInterval(() => {
        if (current < softTarget) {
          current = Math.min(softTarget, current + step);
        } else {
          // Keep a subtle forward motion for long-running jobs after soft target.
          const tailStep = Math.max(0.0008, (hardTarget - current) * 0.08);
          current = Math.min(hardTarget, current + tailStep);
        }

        updateImportJob(batchId, jobId, {
          status,
          progress: current,
        });

        if (current >= hardTarget) {
          stopImportJobTicker(tickerKey);
        }
      }, intervalMs);

      return tickerKey;
    },
    [stopImportJobTicker, updateImportJob],
  );

  const createImportBatch = useCallback(
    (
      label: string,
      entries: Array<{
        uri: string;
        name: string;
        mime: string;
        size?: number;
      }>,
    ): { batchId: string; jobs: ImportJob[] } => {
      const batchId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const jobs: ImportJob[] = entries.map((entry, index) => ({
        id: `${batchId}_${index}`,
        batchId,
        index,
        total: entries.length,
        name: entry.name,
        mime: entry.mime,
        uri: entry.uri,
        size: entry.size,
        status: "queued",
        progress: 0,
        retries: 0,
      }));

      setImportBatches((prev) => {
        const next: ImportBatch = {
          id: batchId,
          albumId,
          label,
          createdAt: Date.now(),
          totalJobs: entries.length,
          doneCount: 0,
          jobs,
        };
        return [next, ...prev].slice(0, 8);
      });
      setActiveBatchId(batchId);

      return { batchId, jobs };
    },
    [albumId],
  );

  const completeImportJob = useCallback(
    (batchId: string, jobId: string) => {
      animateLayout();
      setImportBatches((prev) =>
        prev.map((batch) => {
          if (batch.id !== batchId) return batch;
          const exists = batch.jobs.some((job) => job.id === jobId);
          if (!exists) return batch;
          return {
            ...batch,
            doneCount: batch.doneCount + 1,
            jobs: batch.jobs.filter((job) => job.id !== jobId),
          };
        }),
      );
    },
    [animateLayout],
  );

  const markImportJobDone = useCallback(
    async (batchId: string, jobId: string) => {
      updateImportJob(batchId, jobId, {
        status: "done",
        progress: stageProgressByStatus("done"),
        errorMessage: undefined,
      });

      await sleep(180);
      await flushUIFrame();
      completeImportJob(batchId, jobId);
    },
    [completeImportJob, flushUIFrame, sleep, updateImportJob],
  );

  const runImportJob = useCallback(
    async (batchId: string, job: ImportJob) => {
      const timing = getImportTimingConfig(job.size);

      updateImportJob(batchId, job.id, {
        status: "copying",
        progress: stageProgressByStatus("copying"),
        errorMessage: undefined,
      });
      await sleep(timing.minCopyingMs);

      try {
        const encryptingStartAt = Date.now();
        const tickerKey = startImportJobTicker(
          batchId,
          job.id,
          "encrypting",
          0.2,
          0.9,
          timing.tickerStep,
          timing.tickerIntervalMs,
        );

        await addFileToAlbum(albumId, job.uri, job.mime, job.name);

        const encryptingElapsed = Date.now() - encryptingStartAt;
        if (encryptingElapsed < timing.minEncryptingMs) {
          await sleep(timing.minEncryptingMs - encryptingElapsed);
        }

        stopImportJobTicker(tickerKey);

        updateImportJob(batchId, job.id, {
          status: "saving_db",
          progress: stageProgressByStatus("saving_db"),
        });
        await sleep(timing.minSavingDbMs);

        await markImportJobDone(batchId, job.id);
        queueFileListRefresh();
      } catch (err) {
        stopImportJobTicker(`${batchId}:${job.id}`);
        updateImportJob(batchId, job.id, {
          status: "error",
          progress: stageProgressByStatus("encrypting"),
          errorMessage: err instanceof Error ? err.message : "Import failed",
        });
      }
    },
    [
      addFileToAlbum,
      albumId,
      markImportJobDone,
      sleep,
      startImportJobTicker,
      stopImportJobTicker,
      updateImportJob,
      queueFileListRefresh,
    ],
  );

  const importEntriesAsBatch = useCallback(
    async (
      label: string,
      entries: Array<{
        uri: string;
        name: string;
        mime: string;
        size?: number;
      }>,
    ) => {
      if (entries.length === 0) return;
      const { batchId, jobs } = createImportBatch(label, entries);

      setAddingFiles(true);
      try {
        await flushUIFrame();
        for (const job of jobs) {
          await runImportJob(batchId, job);
        }
        await fileRefreshQueueRef.current;
        await loadFiles();
      } finally {
        setAddingFiles(false);
      }
    },
    [createImportBatch, flushUIFrame, loadFiles, runImportJob],
  );

  const importPackageAsBatch = useCallback(
    async (
      label: string,
      entries: Array<{ name: string; mime: string; size?: number }>,
      execute: (
        trackedAdd: (
          albumId: string,
          plainUri: string,
          mime: string,
          name: string,
        ) => Promise<void>,
      ) => Promise<void>,
    ) => {
      const batchEntries = entries.map((entry) => ({
        ...entry,
        uri: "",
      }));
      const { batchId, jobs } = createImportBatch(label, batchEntries);
      let cursor = 0;

      const trackedAdd = async (
        targetAlbumId: string,
        plainUri: string,
        mime: string,
        name: string,
      ) => {
        const job =
          jobs[cursor] ??
          jobs.find((item) => item.status === "queued") ??
          jobs[jobs.length - 1];
        cursor += 1;
        const timing = getImportTimingConfig(job.size);

        updateImportJob(batchId, job.id, {
          status: "copying",
          progress: stageProgressByStatus("copying"),
          errorMessage: undefined,
        });
        await sleep(timing.minCopyingMs);

        try {
          const encryptingStartAt = Date.now();
          const tickerKey = startImportJobTicker(
            batchId,
            job.id,
            "encrypting",
            0.2,
            0.9,
            timing.tickerStep,
            timing.tickerIntervalMs,
          );

          await addFileToAlbum(targetAlbumId, plainUri, mime, name);

          const encryptingElapsed = Date.now() - encryptingStartAt;
          if (encryptingElapsed < timing.minEncryptingMs) {
            await sleep(timing.minEncryptingMs - encryptingElapsed);
          }

          stopImportJobTicker(tickerKey);

          updateImportJob(batchId, job.id, {
            status: "saving_db",
            progress: stageProgressByStatus("saving_db"),
          });
          await sleep(timing.minSavingDbMs);

          await markImportJobDone(batchId, job.id);
          queueFileListRefresh();
        } catch (err) {
          stopImportJobTicker(`${batchId}:${job.id}`);
          updateImportJob(batchId, job.id, {
            status: "error",
            progress: stageProgressByStatus("encrypting"),
            errorMessage: err instanceof Error ? err.message : "Import failed",
            name,
            mime,
          });
          throw err;
        }
      };

      setAddingFiles(true);
      try {
        await flushUIFrame();
        await execute(trackedAdd);
        await fileRefreshQueueRef.current;
        await loadFiles();
      } finally {
        setAddingFiles(false);
      }
    },
    [
      addFileToAlbum,
      createImportBatch,
      flushUIFrame,
      loadFiles,
      markImportJobDone,
      sleep,
      startImportJobTicker,
      stopImportJobTicker,
      updateImportJob,
      queueFileListRefresh,
    ],
  );

  const retryImportJob = useCallback(
    async (batchId: string, jobId: string) => {
      const batch = importBatchesRef.current.find(
        (item) => item.id === batchId,
      );
      const job = batch?.jobs.find((item) => item.id === jobId);
      if (!job) return;
      if (!job.uri) {
        Alert.alert(
          "Import",
          "This failed item cannot be retried individually.",
        );
        return;
      }

      animateLayout();
      updateImportJob(batchId, job.id, {
        status: "queued",
        progress: 0,
        errorMessage: undefined,
        retries: job.retries + 1,
      });

      setAddingFiles(true);
      try {
        await runImportJob(batchId, { ...job, retries: job.retries + 1 });
        await loadFiles();
      } finally {
        setAddingFiles(false);
      }
    },
    [animateLayout, loadFiles, runImportJob, updateImportJob],
  );

  const clearImportBatch = useCallback(
    (batchId: string) => {
      animateLayout();
      setImportBatches((prev) => prev.filter((batch) => batch.id !== batchId));
      setActiveBatchId((prev) => (prev === batchId ? null : prev));
    },
    [animateLayout],
  );

  const handleAddMedia = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const entries = result.assets.map((asset, index) => ({
          mime: asset.type === "video" ? "video/mp4" : "image/jpeg",
          name: asset.fileName || `media_${Date.now()}_${index + 1}`,
          uri: asset.uri.replace("file://", ""),
          size: asset.fileSize,
        }));
        await importEntriesAsBatch("media_import", entries);
      }
    } catch (err) {
      console.error("[AlbumTab] pick media error:", err);
      Alert.alert("Error", "Could not add media");
    } finally {
      setAddingFiles(false);
    }
  }, [importEntriesAsBatch]);

  const handleAddDocuments = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const entries = result.assets.map((asset, index) => ({
          mime: asset.mimeType ?? "application/octet-stream",
          name: asset.name ?? `doc_${Date.now()}_${index + 1}`,
          uri: asset.uri.replace("file://", ""),
          size: asset.size,
        }));
        await importEntriesAsBatch("documents_import", entries);
      }
    } catch (err) {
      console.error("[AlbumTab] pick documents error:", err);
      Alert.alert("Error", "Could not add documents");
    } finally {
      setAddingFiles(false);
    }
  }, [importEntriesAsBatch]);

  const closeImportModal = useCallback(() => {
    setPendingImportPath(null);
    setPendingImportName(null);
    setPendingImportScope(null);
    setPendingImportEntries([]);
    setImportPassphrase("");
    setIsImportingPackage(false);
  }, []);

  const handleImportPackage = useCallback(async () => {
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
      const pkg = await readExportPackage(pickedPath);

      const pkgEntries =
        pkg.scope === "file"
          ? [
              {
                name: pkg.file.name,
                mime: pkg.file.mime,
                size: pkg.file.size,
              },
            ]
          : pkg.files.map((entry) => ({
              name: entry.meta.name,
              mime: entry.meta.mime,
              size: entry.meta.size,
            }));

      if (pkg.mode === "plain") {
        await importPackageAsBatch(
          pkg.scope === "album"
            ? `${pkg.album.name}_package`
            : `${pkg.file.name}_package`,
          pkgEntries,
          async (trackedAdd) => {
            await importExportPackageToAlbum({
              packagePathOrUri: pickedPath,
              albumId,
              addFileToAlbum: trackedAdd,
            });
          },
        );

        const resultImport = {
          importedCount: pkgEntries.length,
          label: pkg.scope === "file" ? pkg.file.name : pkg.album.name,
        };

        if (resultImport.importedCount === 1) {
          Alert.alert("Import", `Imported "${resultImport.label}"`);
        } else {
          Alert.alert(
            "Import",
            `Imported ${resultImport.importedCount} files from album "${resultImport.label}"`,
          );
        }
        return;
      }

      setPendingImportPath(pickedPath);
      setPendingImportScope(pkg.scope);
      setPendingImportName(
        pkg.scope === "file" ? pkg.file.name : pkg.album.name,
      );
      setPendingImportEntries(pkgEntries);
    } catch (err) {
      console.error("[AlbumTab] import package error:", err);
      Alert.alert("Import", "Could not import package.");
    } finally {
      setAddingFiles(false);
    }
  }, [albumId, importPackageAsBatch]);

  const handleSubmitEncryptedImport = useCallback(async () => {
    if (!pendingImportPath) return;

    const passphrase = importPassphrase.trim();
    if (passphrase.length < 6) {
      Alert.alert("Import", "Passphrase must be at least 6 characters.");
      return;
    }

    try {
      setIsImportingPackage(true);

      await importPackageAsBatch(
        pendingImportName
          ? `${pendingImportName}_encrypted_package`
          : "encrypted_package",
        pendingImportEntries,
        async (trackedAdd) => {
          await importExportPackageToAlbum({
            packagePathOrUri: pendingImportPath,
            albumId,
            passphrase,
            addFileToAlbum: trackedAdd,
          });
        },
      );

      const resultImport = {
        importedCount: pendingImportEntries.length,
        label: pendingImportName ?? "package",
      };

      closeImportModal();
      if (resultImport.importedCount === 1) {
        Alert.alert("Import", `Imported "${resultImport.label}"`);
      } else {
        Alert.alert(
          "Import",
          `Imported ${resultImport.importedCount} files from album "${resultImport.label}"`,
        );
      }
    } catch (err) {
      console.error("[AlbumTab] encrypted import error:", err);
      const message = err instanceof Error ? err.message : "Import failed";
      if (message.toLowerCase().includes("passphrase")) {
        Alert.alert("Import", "Wrong passphrase.");
      } else if (message.toLowerCase().includes("unauthorized")) {
        Alert.alert(
          "Import",
          "This package was not authorized for this device.",
        );
      } else {
        Alert.alert("Import", "Could not import encrypted package.");
      }
    } finally {
      setIsImportingPackage(false);
    }
  }, [
    pendingImportPath,
    importPassphrase,
    albumId,
    importPackageAsBatch,
    pendingImportEntries,
    pendingImportName,
    closeImportModal,
  ]);

  const handleAddFiles = useCallback(() => {
    Alert.alert("Add files", "What do you want to import?", [
      { text: "Photos & Videos", onPress: handleAddMedia },
      { text: "Documents", onPress: handleAddDocuments },
      { text: "Xe Package (.xe)", onPress: handleImportPackage },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [handleAddMedia, handleAddDocuments, handleImportPackage]);

  const handleViewFile = useCallback(
    (file: VaultFile) => {
      const visibleIndex = filteredFiles.findIndex((item) => item.id === file.id);
      const sourceFiles = visibleIndex >= 0 ? filteredFiles : [file];
      setViewerFiles(sourceFiles);
      setViewerIndex(Math.max(0, visibleIndex));
      setShowViewerChrome(true);
      viewerTranslateY.setValue(0);
      setIsViewerOpen(true);
    },
    [filteredFiles, viewerTranslateY],
  );

  const handleCloseView = useCallback(async () => {
    // I do NOT delete the file from cache immediately upon closing.
    // Instead it will remain in CacheDirectory and be cleared when the vault locks or app resets.
    setIsViewerOpen(false);
    setViewerFiles([]);
    setViewerIndex(0);
    setShowViewerChrome(true);
  }, []);

  const closeViewerWithGesture = useCallback(() => {
    Animated.timing(viewerTranslateY, {
      toValue: height,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      handleCloseView();
    });
  }, [handleCloseView, height, viewerTranslateY]);

  const viewerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          const isVertical =
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx) + 6;
          return isVertical && gestureState.dy > 12;
        },
        onPanResponderGrant: () => {
          viewerTranslateY.stopAnimation();
        },
        onPanResponderMove: (_evt, gestureState) => {
          // Dampen drag distance so movement feels less jumpy.
          viewerTranslateY.setValue(Math.max(0, gestureState.dy * 0.88));
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const shouldClose = gestureState.dy > 160 || gestureState.vy > 1.2;
          if (shouldClose) {
            closeViewerWithGesture();
            return;
          }

          Animated.spring(viewerTranslateY, {
            toValue: 0,
            stiffness: 230,
            damping: 24,
            mass: 0.95,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(viewerTranslateY, {
            toValue: 0,
            stiffness: 230,
            damping: 24,
            mass: 0.95,
            useNativeDriver: true,
          }).start();
        },
      }),
    [closeViewerWithGesture, viewerTranslateY],
  );

  const ensureViewerFileDecrypted = useCallback(
    async (file: VaultFile) => {
      if (viewerDecryptedUris[file.id]) return;

      try {
        setViewerLoadingFileId(file.id);
        const decryptedPath = await decryptFileToCache(file.id);
        if (!decryptedPath) {
          throw new Error("Failed to decrypt file");
        }
        setViewerDecryptedUris((prev) => ({
          ...prev,
          [file.id]: `file://${decryptedPath}`,
        }));
      } catch (err) {
        console.error("[AlbumTab] viewer decrypt error", err);
      } finally {
        setViewerLoadingFileId((prev) => (prev === file.id ? null : prev));
      }
    },
    [decryptFileToCache, viewerDecryptedUris],
  );

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
    setExportPassphrase("");
    setExportPassphraseConfirm("");
    if (recipientContacts.length > 0) {
      setSelectedRecipientId(recipientContacts[0].id);
    } else {
      setSelectedRecipientId("");
    }
    setIsApplyingAction(false);
  }, [recipientContacts]);

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

  const closeAlbumActions = useCallback(() => {
    setShowAlbumMenu(false);
    setShowAlbumActions(false);
    setAlbumActionMode(null);
    setAlbumRenameValue("");
    setAlbumExportPassphrase("");
    setAlbumExportPassphraseConfirm("");
    setIsApplyingAction(false);
  }, []);

  const openAlbumActions = useCallback(() => {
    menuButtonRef.current?.measure((_x, _y, menuW, menuH, pageX, pageY) => {
      setMenuAnchor({ x: pageX, y: pageY, width: menuW, height: menuH });
      setShowAlbumMenu(true);
    });
  }, []);

  const openAlbumRenamePanel = useCallback(() => {
    setShowAlbumMenu(false);
    setAlbumRenameValue(currentAlbumName);
    setAlbumActionMode("rename");
    setShowAlbumActions(true);
  }, [currentAlbumName]);

  const openAlbumDetailsPanel = useCallback(() => {
    setShowAlbumMenu(false);
    setAlbumActionMode("details");
    setShowAlbumActions(true);
  }, []);

  const openAlbumEncryptedExportPanel = useCallback(() => {
    setShowAlbumMenu(false);
    setAlbumActionMode("exportEncrypted");
    setShowAlbumActions(true);
  }, []);

  const handleRenameAlbum = useCallback(async () => {
    const nextName = albumRenameValue.trim();
    if (!nextName) {
      Alert.alert("Rename Album", "Name cannot be empty.");
      return;
    }

    try {
      setIsApplyingAction(true);
      await renameAlbum(albumId, nextName);
      setCurrentAlbumName(nextName);
      await loadAlbums();
      closeAlbumActions();
    } catch (err) {
      console.error("[AlbumTab] rename album error:", err);
      Alert.alert("Rename Album", "Could not rename album.");
    } finally {
      setIsApplyingAction(false);
    }
  }, [albumRenameValue, albumId, loadAlbums, closeAlbumActions]);

  const handleDeleteAlbum = useCallback(() => {
    Alert.alert(
      "Delete Album",
      `Delete "${currentAlbumName}" and all its files?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsApplyingAction(true);
              await deleteAlbum(albumId);
              closeAlbumActions();
              router.push("/(tabs)/vault");
            } catch (err) {
              console.error("[AlbumTab] delete album error:", err);
              Alert.alert("Delete Album", "Could not delete album.");
            } finally {
              setIsApplyingAction(false);
            }
          },
        },
      ],
    );
  }, [albumId, closeAlbumActions, currentAlbumName]);

  const handleExportPlainAlbum = useCallback(async () => {
    if (files.length === 0) {
      Alert.alert("Export", "This album has no files.");
      return;
    }

    try {
      setIsApplyingAction(true);
      closeAlbumActions();

      let sharedCount = 0;
      for (const file of files) {
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
      console.error("[AlbumTab] plain album export error:", err);
      Alert.alert("Export", "Could not export album.");
    } finally {
      setIsApplyingAction(false);
    }
  }, [files, decryptFileToCache, closeAlbumActions]);

  const handleExportEncryptedAlbum = useCallback(async () => {
    if (files.length === 0) {
      Alert.alert("Export", "This album has no files.");
      return;
    }

    const passphrase = albumExportPassphrase.trim();
    if (passphrase.length < 6) {
      Alert.alert(
        "Encrypted Export",
        "Passphrase must be at least 6 characters.",
      );
      return;
    }
    if (passphrase !== albumExportPassphraseConfirm.trim()) {
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
      const packageUri = await createEncryptedExportAlbumPackage({
        albumId,
        albumName: currentAlbumName,
        files,
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
        message: "Xe encrypted album export package",
      });
    } catch (err) {
      console.error("[AlbumTab] encrypted album export error:", err);
      Alert.alert("Encrypted Export", "Could not export encrypted album.");
    } finally {
      setIsApplyingAction(false);
    }
  }, [
    files,
    albumExportPassphrase,
    albumExportPassphraseConfirm,
    recipientContacts,
    selectedRecipientId,
    getMasterKey,
    albumId,
    currentAlbumName,
    closeAlbumActions,
  ]);

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

  const handleExportPlainFromMenu = useCallback(async () => {
    if (!selectedFile) return;

    try {
      setIsApplyingAction(true);
      const decryptedFilePath = await decryptFileToCache(selectedFile.id);
      if (!decryptedFilePath) {
        Alert.alert("Export", "Could not decrypt file for export.");
        return;
      }

      closeFileActions();
      await Share.share({
        url: `file://${decryptedFilePath}`,
        title: "Export file",
        message: selectedFile.name,
      });
    } catch (err) {
      console.error("[AlbumTab] plain export error:", err);
      Alert.alert("Export", "Could not export plain file.");
    } finally {
      setIsApplyingAction(false);
    }
  }, [selectedFile, decryptFileToCache, closeFileActions]);

  const handleExportEncryptedFromMenu = useCallback(async () => {
    if (!selectedFile) return;

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
      Alert.alert(
        "Encrypted Export",
        "No recipient selected. Add one from Vault first.",
      );
      return;
    }

    const masterKey = getMasterKey();
    if (!masterKey) {
      Alert.alert("Encrypted Export", "Vault is locked.");
      return;
    }

    try {
      setIsApplyingAction(true);
      const packageUri = await createEncryptedExportFilePackage({
        file: selectedFile,
        masterKey,
        passphrase,
        recipient: {
          id: recipient.id,
          name: recipient.name,
          publicKeyPem: recipient.publicKeyPem,
        },
      });

      closeFileActions();
      await Share.share({
        url: packageUri,
        title: "Encrypted export",
        message: "Xe encrypted export package",
      });
    } catch (err) {
      console.error("[AlbumTab] encrypted export error:", err);
      Alert.alert("Encrypted Export", "Could not export encrypted package.");
    } finally {
      setIsApplyingAction(false);
    }
  }, [
    selectedFile,
    exportPassphrase,
    exportPassphraseConfirm,
    recipientContacts,
    selectedRecipientId,
    getMasterKey,
    closeFileActions,
  ]);

  useEffect(() => {
    loadFiles();
    loadAlbums();
    loadRecipientContacts();
  }, [loadFiles, loadAlbums, loadRecipientContacts]);

  useEffect(() => {
    setCurrentAlbumName(params.albumName ?? "album_4");
  }, [params.albumName]);

  useEffect(() => {
    if (!isViewerOpen || viewerFiles.length === 0) return;

    const current = viewerFiles[viewerIndex];
    if (!current) return;

    void ensureViewerFileDecrypted(current);

    if (viewerIndex > 0) {
      void ensureViewerFileDecrypted(viewerFiles[viewerIndex - 1]);
    }
    if (viewerIndex < viewerFiles.length - 1) {
      void ensureViewerFileDecrypted(viewerFiles[viewerIndex + 1]);
    }
  }, [isViewerOpen, viewerFiles, viewerIndex, ensureViewerFileDecrypted]);

  useEffect(() => {
    if (!isViewerOpen || viewerFiles.length === 0) return;
    requestAnimationFrame(() => {
      galleryRef.current?.scrollToIndex({
        index: viewerIndex,
        animated: false,
      });
    });
  }, [isViewerOpen, viewerFiles.length, viewerIndex]);

  useEffect(() => {
    Animated.timing(viewerChromeAnim, {
      toValue: showViewerChrome ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [showViewerChrome, viewerChromeAnim]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        // Ensure transient overlays are closed when leaving the screen.
        setIsViewerOpen(false);
        setShowViewerChrome(true);
        viewerTranslateY.setValue(0);
        setViewerFiles([]);
        setViewerIndex(0);
        setSelectedFile(null);
        setFileActionMode(null);
        setPendingImportPath(null);
        setPendingImportName(null);
        setPendingImportScope(null);
        setPendingImportEntries([]);
        setImportPassphrase("");
        setIsImportingPackage(false);
        setShowAlbumMenu(false);
        setShowAlbumActions(false);
        setAlbumActionMode(null);
      };
    }, [viewerTranslateY]),
  );

  const albumCreatedAt =
    albums.find((a) => a.id === albumId)?.created_at ?? null;
  const albumFileCount = files.length;
  const albumTotalSize = files.reduce((acc, file) => acc + file.size, 0);
  const albumImageCount = files.filter((file) =>
    file.mime.startsWith("image/"),
  ).length;
  const albumVideoCount = files.filter((file) =>
    file.mime.startsWith("video/"),
  ).length;
  const albumDocCount = albumFileCount - albumImageCount - albumVideoCount;

  const activeBatch = useMemo(() => {
    const selected = importBatches.find((batch) => batch.id === activeBatchId);
    if (selected) return selected;

    const running = importBatches.find((batch) => {
      const errors = batch.jobs.filter((job) => job.status === "error").length;
      return batch.doneCount + errors < batch.totalJobs;
    });
    if (running) return running;

    return importBatches[0] ?? null;
  }, [activeBatchId, importBatches]);

  const activeDownloadBatch = albumId
    ? downloadBatches.find((batch) => batch.albumId === albumId && (batch.status === "searching" || batch.status === "running"))
      ?? downloadBatches.find((batch) => batch.albumId === albumId) ?? null
    : null;
  const downloadDone = activeDownloadBatch?.jobs.filter((job) => job.status === "done").length ?? 0;
  const downloadErrors = activeDownloadBatch?.jobs.filter((job) => job.status === "error").length ?? 0;
  const downloadProgressKnown = activeDownloadBatch?.jobs.every((job) => job.progress !== null) ?? false;
  const downloadProgress = activeDownloadBatch?.jobs.length
    ? activeDownloadBatch.jobs.reduce((sum, job) => sum + (job.progress ?? 0), 0) / activeDownloadBatch.jobs.length
    : 0;

  useEffect(() => {
    if (albumId && downloadDone > 0) void loadFiles();
  }, [albumId, downloadDone, loadFiles]);

  const activeBatchStats = useMemo(() => {
    if (!activeBatch) {
      return {
        total: 0,
        done: 0,
        errors: 0,
        progress: 0,
        completed: true,
      };
    }

    const total = activeBatch.totalJobs;
    const done = activeBatch.doneCount;
    const errors = activeBatch.jobs.filter(
      (job) => job.status === "error",
    ).length;

    const inFlightProgress = activeBatch.jobs.reduce((acc, job) => {
      if (job.status === "error")
        return acc + stageProgressByStatus("encrypting");
      return acc + job.progress;
    }, 0);

    const progress =
      total === 0 ? 0 : Math.min(1, (done + inFlightProgress) / total);
    const completed = done + errors === total;

    return { total, done, errors, progress, completed };
  }, [activeBatch]);

  useEffect(() => {
    if (!activeBatch) return;

    const shouldAutoDismiss =
      activeBatchStats.completed &&
      activeBatchStats.errors === 0 &&
      activeBatch.jobs.length === 0;

    if (!shouldAutoDismiss) {
      if (dismissBatchTimeoutRef.current) {
        clearTimeout(dismissBatchTimeoutRef.current);
        dismissBatchTimeoutRef.current = null;
      }
      return;
    }

    if (dismissBatchTimeoutRef.current) return;

    dismissBatchTimeoutRef.current = setTimeout(() => {
      clearImportBatch(activeBatch.id);
      dismissBatchTimeoutRef.current = null;
    }, 1000);
  }, [activeBatch, activeBatchStats, clearImportBatch]);

  useEffect(() => {
    return () => {
      if (dismissBatchTimeoutRef.current) {
        clearTimeout(dismissBatchTimeoutRef.current);
        dismissBatchTimeoutRef.current = null;
      }

      const tickerKeys = Object.keys(importJobTickersRef.current);
      for (const tickerKey of tickerKeys) {
        stopImportJobTicker(tickerKey);
      }
    };
  }, [stopImportJobTicker]);

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
          {currentAlbumName}/
        </Text>
        <View ref={menuButtonRef} collapsable={false}>
          <TouchableOpacity
            onPress={openAlbumActions}
            className="bg-primary-500 h-12 w-12 rounded-2xl items-center justify-center"
          >
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
          >
            <View className="mb-2 border-2 rounded-2xl border-primary-500 w-full aspect-square items-center justify-center">
              <Icon.LockIcon size={32} color={Colors.primary[200]} />
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

      {activeDownloadBatch ? (
        <View className="absolute left-8 right-8 bottom-36 rounded-2xl border border-primary-400 bg-primary-500/95 p-3">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-secondary-400 text-sm font-fira-code">download/jobs</Text>
          </View>
          <Text className="text-secondary text-sm font-fira-code">
            {activeDownloadBatch.status === "searching" ? "searching page..." : `${downloadDone}/${activeDownloadBatch.jobs.length} files${downloadErrors ? ` | errors:${downloadErrors}` : ""}`}
          </Text>
          {activeDownloadBatch.status === "searching" ? <ActivityIndicator color={Colors.secondary[500]} className="mt-2" /> : null}
          {activeDownloadBatch.errorMessage ? (
            <View className="mt-2 gap-2">
              <Text className="text-red-300 text-xs font-fira-code">{activeDownloadBatch.errorMessage}</Text>
              <TouchableOpacity onPress={() => retryDownloadBatch(activeDownloadBatch.id)} className="self-start px-3 py-1 rounded-lg bg-red-400">
                <Text className="text-primary-500 text-xs font-fira-code-semibold">retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {activeDownloadBatch.jobs.length > 0 ? (
            <>
              <View className="mt-2">
                {downloadProgressKnown ? <SmoothProgressBar progress={downloadProgress} fillColor={Colors.secondary[500]} height={8} backgroundColor={Colors.primary[600]} /> : <ActivityIndicator color={Colors.secondary[500]} />}
              </View>
              <ScrollView className="mt-3 max-h-52" showsVerticalScrollIndicator={false}>
                {activeDownloadBatch.jobs.map((job, index) => (
                  <View key={job.id} className="mb-2 rounded-xl border border-primary-400 bg-primary-600/70 px-3 py-2">
                    <View className="flex-row justify-between">
                      <Text className="text-secondary text-xs font-fira-code" numberOfLines={1} style={{ maxWidth: width - 190 }}>
                        {index + 1}/{activeDownloadBatch.jobs.length} {job.name}
                      </Text>
                      <Text className={`text-xs font-fira-code ${job.status === "error" ? "text-red-300" : "text-secondary-400"}`}>{job.status}</Text>
                    </View>
                    <View className="flex-row items-center justify-between mt-1">
                      <Text className="text-primary-100 text-xs font-fira-code-light">
                        {job.progress === null ? `${formatFileSize(job.bytesWritten)} / ?` : `${Math.round(job.progress * 100)}%`}
                        {job.retries ? ` | retry:${job.retries}` : ""}
                      </Text>
                      {job.status === "error" ? (
                        <TouchableOpacity onPress={() => retryDownloadJob(activeDownloadBatch.id, job.id)} className="px-2 py-1 rounded-lg bg-red-400">
                          <Text className="text-primary-500 text-xs font-fira-code-semibold">retry</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {job.progress === null ? <ActivityIndicator color={Colors.secondary[500]} /> : <SmoothProgressBar progress={job.progress} fillColor={job.status === "error" ? "#f87171" : Colors.secondary[500]} height={6} backgroundColor={Colors.primary[500]} />}
                    {job.errorMessage ? <Text className="text-red-300 text-xs font-fira-code-light mt-1" numberOfLines={2}>{job.errorMessage}</Text> : null}
                  </View>
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      ) : activeBatch ? (
        <View className="absolute left-8 right-8 bottom-36 rounded-2xl border border-primary-400 bg-primary-500/95 p-3">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-secondary-400 text-sm font-fira-code">
              import/jobs: {activeBatch.label}
            </Text>
            {activeBatchStats.errors > 0 ? (
              <TouchableOpacity
                onPress={() => clearImportBatch(activeBatch.id)}
                className="px-2 py-1 rounded-lg bg-primary-600"
              >
                <Text className="text-primary-100 text-xs font-fira-code">
                  close
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-secondary text-sm font-fira-code">
              {activeBatchStats.done}/{activeBatchStats.total} files
            </Text>
            <Text className="text-primary-100 text-xs font-fira-code">
              {Math.round(activeBatchStats.progress * 100)}%
              {activeBatchStats.errors > 0
                ? ` | errors:${activeBatchStats.errors}`
                : ""}
            </Text>
          </View>

          <View className="mt-2">
            <SmoothProgressBar
              progress={activeBatchStats.progress}
              fillColor={Colors.secondary[500]}
              height={8}
              backgroundColor={Colors.primary[600]}
            />
          </View>

          <ScrollView
            className="mt-3 max-h-52"
            showsVerticalScrollIndicator={false}
          >
            {activeBatch.jobs.map((job) => (
              <View
                key={job.id}
                className="mb-2 rounded-xl border border-primary-400 bg-primary-600/70 px-3 py-2"
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className="text-secondary text-xs font-fira-code"
                    numberOfLines={1}
                    style={{ maxWidth: width - 190 }}
                  >
                    {job.index + 1}/{job.total} {job.name}
                  </Text>
                  <Text
                    className="text-xs font-fira-code"
                    style={{ color: stageColor(job.status) }}
                  >
                    {jobStatusLabel(job.status)}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between mt-1">
                  <Text className="text-primary-100 text-xs font-fira-code-light">
                    {Math.round(job.progress * 100)}%
                    {job.retries > 0 ? ` | retry:${job.retries}` : ""}
                  </Text>
                  {job.status === "error" && job.uri ? (
                    <TouchableOpacity
                      onPress={() => void retryImportJob(job.batchId, job.id)}
                      className="px-2 py-1 rounded-lg bg-red-400"
                    >
                      <Text className="text-primary-500 text-xs font-fira-code-semibold">
                        retry
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View className="mt-1">
                  <SmoothProgressBar
                    progress={job.progress}
                    fillColor={stageColor(job.status)}
                    height={6}
                    backgroundColor={Colors.primary[500]}
                  />
                </View>

                {job.status === "error" && job.errorMessage ? (
                  <Text
                    className="text-red-300 text-xs font-fira-code-light mt-1"
                    numberOfLines={2}
                  >
                    {job.errorMessage}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

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
        visible={showAlbumMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAlbumMenu(false)}
      >
        <Pressable
          className="flex-1"
          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
          onPress={() => setShowAlbumMenu(false)}
        >
          <Pressable
            className="bg-primary-500 border border-primary-400 rounded-2xl overflow-hidden"
            style={{
              position: "absolute",
              top: menuAnchor.y + menuAnchor.height + 8,
              left: Math.min(
                Math.max(16, menuAnchor.x + menuAnchor.width - albumMenuWidth),
                width - albumMenuWidth - 16,
              ),
              width: albumMenuWidth,
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
                album/menu
              </Text>
            </View>

            <TouchableOpacity
              className="px-4 py-4 border-b border-primary-400"
              onPress={openAlbumRenamePanel}
              activeOpacity={0.75}
            >
              <Text className="text-secondary-400 text-lg font-fira-code">
                rename
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="px-4 py-4 border-b border-primary-400"
              onPress={() => {
                setShowAlbumMenu(false);
                void handleExportPlainAlbum();
              }}
              activeOpacity={0.75}
            >
              <Text className="text-secondary-400 text-lg font-fira-code">
                export_plain
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="px-4 py-4 border-b border-primary-400"
              onPress={openAlbumEncryptedExportPanel}
              activeOpacity={0.75}
            >
              <Text className="text-secondary-400 text-lg font-fira-code">
                export_encrypted
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="px-4 py-4 border-b border-primary-400"
              onPress={openAlbumDetailsPanel}
              activeOpacity={0.75}
            >
              <Text className="text-secondary-400 text-lg font-fira-code">
                album_details
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="px-4 py-4"
              onPress={() => {
                setShowAlbumMenu(false);
                handleDeleteAlbum();
              }}
              activeOpacity={0.75}
            >
              <Text className="text-red-300 text-lg font-fira-code">
                delete
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showAlbumActions && !!albumActionMode}
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
              {albumActionMode === "rename" && (
                <View className="p-4 gap-4">
                  <Text className="text-secondary-400 text-lg font-fira-code">
                    rename album
                  </Text>
                  <TextInput keyboardAppearance="dark"
                    value={albumRenameValue}
                    onChangeText={setAlbumRenameValue}
                    placeholder="album_name"
                    placeholderTextColor={Colors.primary[100]}
                    autoFocus
                    className="h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code text-lg"
                    onSubmitEditing={handleRenameAlbum}
                  />
                  <View className="flex-row items-center justify-end gap-3">
                    <TouchableOpacity
                      className="h-12 px-4 rounded-xl bg-primary-600 items-center justify-center"
                      onPress={closeAlbumActions}
                      disabled={isApplyingAction}
                    >
                      <Text className="text-secondary font-fira-code">
                        back
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="h-12 px-4 rounded-xl bg-secondary-500 items-center justify-center"
                      onPress={handleRenameAlbum}
                      disabled={isApplyingAction}
                    >
                      <Text className="text-primary-500 font-fira-code-semibold">
                        save
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {albumActionMode === "details" && (
                <View className="p-4 gap-4">
                  <Text className="text-secondary-400 text-lg font-fira-code">
                    album details
                  </Text>

                  <View className="border border-primary-400 rounded-2xl p-3 gap-2 bg-primary-600">
                    <Text className="text-base font-fira-code-light">
                      <Text className="text-secondary-600">name: </Text>
                      <Text className="text-secondary-200">
                        {currentAlbumName}
                      </Text>
                    </Text>
                    <Text className="text-base font-fira-code-light">
                      <Text className="text-secondary-600">id: </Text>
                      <Text className="text-secondary-200">{albumId}</Text>
                    </Text>
                    <Text className="text-base font-fira-code-light">
                      <Text className="text-secondary-600">files: </Text>
                      <Text className="text-secondary-200">
                        {albumFileCount}
                      </Text>
                    </Text>
                    <Text className="text-base font-fira-code-light">
                      <Text className="text-secondary-600">size: </Text>
                      <Text className="text-secondary-200">
                        {formatFileSize(albumTotalSize)} ({albumTotalSize} B)
                      </Text>
                    </Text>
                    <Text className="text-base font-fira-code-light">
                      <Text className="text-secondary-600">types: </Text>
                      <Text className="text-secondary-200">
                        img {albumImageCount} / vid {albumVideoCount} / doc{" "}
                        {albumDocCount}
                      </Text>
                    </Text>
                    {albumCreatedAt ? (
                      <Text className="text-base font-fira-code-light">
                        <Text className="text-secondary-600">created: </Text>
                        <Text className="text-secondary-200">
                          {formatTimestamp(albumCreatedAt)}
                        </Text>
                      </Text>
                    ) : null}
                  </View>

                  <View className="flex-row items-center justify-end">
                    <TouchableOpacity
                      className="h-12 px-4 rounded-xl bg-primary-600 items-center justify-center"
                      onPress={closeAlbumActions}
                    >
                      <Text className="text-secondary font-fira-code">
                        back
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {albumActionMode === "exportEncrypted" && (
                <View className="p-4 gap-4">
                  <Text className="text-secondary-400 text-lg font-fira-code">
                    encrypted export
                  </Text>
                  <Text className="text-secondary-600 text-base font-fira-code-light">
                    This passphrase will be required on import.
                  </Text>

                  {recipientContacts.length === 0 ? (
                    <>
                      <View className="rounded-2xl border border-primary-400 bg-primary-600/70 p-4 gap-2">
                        <Text className="text-secondary font-fira-code-semibold">
                          no recipients yet
                        </Text>
                        <Text className="text-secondary-600 font-fira-code-light text-sm">
                          Add a recipient in Vault to enable encrypted export.
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-end gap-3">
                        <TouchableOpacity
                          className="h-12 px-4 rounded-xl bg-primary-600 items-center justify-center"
                          onPress={closeAlbumActions}
                        >
                          <Text className="text-secondary font-fira-code">
                            back
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="h-12 px-4 rounded-xl bg-secondary-500 items-center justify-center"
                          onPress={() => {
                            closeAlbumActions();
                            router.push("/(tabs)/vault");
                          }}
                        >
                          <Text className="text-primary-500 font-fira-code-semibold">
                            go_vault
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
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
                      <TextInput keyboardAppearance="dark"
                        value={albumExportPassphrase}
                        onChangeText={setAlbumExportPassphrase}
                        placeholder="passphrase"
                        placeholderTextColor={Colors.primary[100]}
                        secureTextEntry
                        autoFocus
                        className="h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code text-lg"
                      />
                      <TextInput keyboardAppearance="dark"
                        value={albumExportPassphraseConfirm}
                        onChangeText={setAlbumExportPassphraseConfirm}
                        placeholder="confirm passphrase"
                        placeholderTextColor={Colors.primary[100]}
                        secureTextEntry
                        className="h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code text-lg"
                        onSubmitEditing={handleExportEncryptedAlbum}
                      />
                      <View className="flex-row items-center justify-end gap-3">
                        <TouchableOpacity
                          className="h-12 px-4 rounded-xl bg-primary-600 items-center justify-center"
                          onPress={closeAlbumActions}
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
                    </>
                  )}
                </View>
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

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
                    disabled={isApplyingAction}
                    activeOpacity={0.7}
                  >
                    <Text className="text-secondary-400 text-lg font-fira-code">
                      rename
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="px-4 py-4 border-b border-primary-400"
                    onPress={handleOpenMove}
                    disabled={isApplyingAction}
                    activeOpacity={0.7}
                  >
                    <Text className="text-secondary-400 text-lg font-fira-code">
                      move
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="px-4 py-4 border-b border-primary-400"
                    onPress={() => setFileActionMode("details")}
                    disabled={isApplyingAction}
                    activeOpacity={0.7}
                  >
                    <Text className="text-secondary-400 text-lg font-fira-code">
                      file_details
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="px-4 py-4 border-b border-primary-400"
                    onPress={handleExportPlainFromMenu}
                    disabled={isApplyingAction}
                    activeOpacity={0.7}
                  >
                    <Text className="text-secondary-400 text-lg font-fira-code">
                      export_plain
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="px-4 py-4 border-b border-primary-400"
                    onPress={() => setFileActionMode("exportEncrypted")}
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
                    onPress={closeFileActions}
                    disabled={isApplyingAction}
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
                  <TextInput keyboardAppearance="dark"
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
                      <Text className="text-secondary font-fira-code">
                        back
                      </Text>
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
                      <Text className="text-secondary font-fira-code">
                        back
                      </Text>
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
                      <Text className="text-secondary font-fira-code">
                        back
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {fileActionMode === "exportEncrypted" && selectedFile && (
                <View className="p-4 gap-4">
                  <Text className="text-secondary-400 text-lg font-fira-code">
                    encrypted export
                  </Text>
                  <Text className="text-secondary-600 text-base font-fira-code-light">
                    This passphrase will be required on import.
                  </Text>
                  {recipientContacts.length === 0 ? (
                    <>
                      <View className="rounded-2xl border border-primary-400 bg-primary-600/70 p-4 gap-2">
                        <Text className="text-secondary font-fira-code-semibold">
                          no recipients yet
                        </Text>
                        <Text className="text-secondary-600 font-fira-code-light text-sm">
                          Add a recipient in Vault to enable encrypted export.
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-end gap-3">
                        <TouchableOpacity
                          className="h-12 px-4 rounded-xl bg-primary-600 items-center justify-center"
                          onPress={() => setFileActionMode("menu")}
                        >
                          <Text className="text-secondary font-fira-code">
                            back
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="h-12 px-4 rounded-xl bg-secondary-500 items-center justify-center"
                          onPress={() => {
                            closeFileActions();
                            router.push("/(tabs)/vault");
                          }}
                        >
                          <Text className="text-primary-500 font-fira-code-semibold">
                            go_vault
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
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
                      <TextInput keyboardAppearance="dark"
                        value={exportPassphrase}
                        onChangeText={setExportPassphrase}
                        placeholder="passphrase"
                        placeholderTextColor={Colors.primary[100]}
                        secureTextEntry
                        autoFocus
                        className="h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code text-lg"
                      />
                      <TextInput keyboardAppearance="dark"
                        value={exportPassphraseConfirm}
                        onChangeText={setExportPassphraseConfirm}
                        placeholder="confirm passphrase"
                        placeholderTextColor={Colors.primary[100]}
                        secureTextEntry
                        className="h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code text-lg"
                        onSubmitEditing={handleExportEncryptedFromMenu}
                      />
                      <View className="flex-row items-center justify-end gap-3">
                        <TouchableOpacity
                          className="h-12 px-4 rounded-xl bg-primary-600 items-center justify-center"
                          onPress={() => setFileActionMode("menu")}
                          disabled={isApplyingAction}
                        >
                          <Text className="text-secondary font-fira-code">
                            back
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="h-12 px-4 rounded-xl bg-secondary-500 items-center justify-center"
                          onPress={handleExportEncryptedFromMenu}
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
                    </>
                  )}
                </View>
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal
        visible={!!pendingImportPath}
        transparent
        animationType="fade"
        onRequestClose={closeImportModal}
      >
        <Pressable
          className="flex-1 items-center justify-center px-8"
          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
          onPress={closeImportModal}
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
                encrypted import
              </Text>
              <Text className="text-secondary-600 text-base font-fira-code-light">
                {pendingImportName
                  ? pendingImportScope === "album"
                    ? `Album package: ${pendingImportName}`
                    : `File package: ${pendingImportName}`
                  : "Enter passphrase to import this package."}
              </Text>
              <TextInput keyboardAppearance="dark"
                value={importPassphrase}
                onChangeText={setImportPassphrase}
                placeholder="passphrase"
                placeholderTextColor={Colors.primary[100]}
                secureTextEntry
                autoFocus
                className="h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code text-lg"
                onSubmitEditing={handleSubmitEncryptedImport}
              />
              <View className="flex-row items-center justify-end gap-3">
                <TouchableOpacity
                  className="h-12 px-4 rounded-xl bg-primary-600 items-center justify-center"
                  onPress={closeImportModal}
                  disabled={isImportingPackage}
                >
                  <Text className="text-secondary font-fira-code">cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="h-12 px-4 rounded-xl bg-secondary-500 items-center justify-center"
                  onPress={handleSubmitEncryptedImport}
                  disabled={isImportingPackage}
                >
                  {isImportingPackage ? (
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

      {/* Viewing Gallery Modal */}
      <Modal
        visible={isViewerOpen}
        animationType="none"
        transparent={false}
        onRequestClose={handleCloseView}
      >
        <View className="flex-1 bg-black">
          <Animated.View
            className="absolute inset-0 bg-black"
            pointerEvents="none"
            style={{ opacity: viewerBackdropOpacity }}
          />

          <Animated.View
            className="flex-1"
            style={{ transform: [{ translateY: viewerTranslateY }] }}
            {...viewerPanResponder.panHandlers}
          >
            <FlatList
              ref={galleryRef}
              data={viewerFiles}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              onMomentumScrollEnd={({ nativeEvent }) => {
                const next = Math.round(nativeEvent.contentOffset.x / width);
                if (next >= 0 && next < viewerFiles.length) {
                  setViewerIndex(next);
                }
              }}
              renderItem={({ item }) => {
                const uri = viewerDecryptedUris[item.id];
                const isActiveVideoSlide =
                  isViewerOpen && viewerFiles[viewerIndex]?.id === item.id;
                return (
                  <Pressable
                    style={{ width }}
                    className="flex-1"
                    onPress={() => setShowViewerChrome((prev) => !prev)}
                  >
                    {!uri ? (
                      <View className="flex-1 items-center justify-center gap-3">
                        <ActivityIndicator color={Colors.secondary[500]} />
                        <Text className="text-secondary-500 text-base font-fira-code">
                          {viewerLoadingFileId === item.id
                            ? "decrypting..."
                            : "loading file..."}
                        </Text>
                      </View>
                    ) : item.mime.startsWith("image/") ? (
                      <Image
                        source={{ uri }}
                        className="w-full h-full"
                        resizeMode="contain"
                      />
                    ) : item.mime.startsWith("video/") ? (
                      <View className="w-full h-full">
                        <VideoFilePlayer
                          uri={uri}
                          shouldPlay={isActiveVideoSlide}
                        />
                      </View>
                    ) : (
                      <WebView
                        source={{ uri }}
                        style={{ flex: 1, width }}
                        originWhitelist={["*"]}
                      />
                    )}
                  </Pressable>
                );
              }}
            />

            <Animated.View
              pointerEvents={showViewerChrome ? "auto" : "none"}
              className="absolute left-0 right-0"
              style={{
                top: insets.top,
                opacity: viewerChromeAnim,
                transform: [
                  {
                    translateY: viewerChromeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-18, 0],
                    }),
                  },
                ],
              }}
            >
              <LinearGradient
                colors={[
                  "rgba(0,0,0,1)",
                  "rgba(0,0,0,0.92)",
                  "rgba(0,0,0,0.72)",
                  "rgba(0,0,0,0.38)",
                  "rgba(0,0,0,0.06)",
                  "rgba(0,0,0,0)",
                ]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 280,
                }}
              />
              <View className="px-4 py-3 flex-row items-center justify-between">
                <Text
                  className="text-secondary text-base font-fira-code"
                  numberOfLines={1}
                  style={{ maxWidth: width - 32 }}
                >
                  {viewerFiles[viewerIndex]?.name ?? "file"}
                </Text>
              </View>
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              className="absolute left-0 right-0 items-center"
              style={{
                bottom: insets.bottom + 10,
                opacity: viewerChromeAnim,
                transform: [
                  {
                    translateY: viewerChromeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              }}
            >
              <LinearGradient
                colors={[
                  "rgba(0,0,0,0)",
                  "rgba(0,0,0,0.08)",
                  "rgba(0,0,0,0.38)",
                  "rgba(0,0,0,0.72)",
                  "rgba(0,0,0,0.92)",
                  "rgba(0,0,0,1)",
                ]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{
                  position: "absolute",
                  bottom: -44,
                  left: 0,
                  right: 0,
                  height: 260,
                }}
              />
              <View className="px-4 py-1">
                <Text className="text-primary-100 text-sm font-fira-code">
                  {viewerFiles.length > 0
                    ? `${viewerIndex + 1} / ${viewerFiles.length}`
                    : "0 / 0"}
                </Text>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

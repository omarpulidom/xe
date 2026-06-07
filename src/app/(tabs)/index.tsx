import { AntDesign /* Entypo */ } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback, useEffect } from "react";

import { Colors } from "@/components/colors";
/* import { SelectInput } from "@/components/Elements/SelectInput"; */
import { useVault } from "@/components/Providers/VaultProvider";
import {
  ensureLocalRecipientIdentity,
  getFileCount,
  getAlbumCount,
  type LocalRecipientIdentity,
} from "@/lib/vault";

/*
const data = [
  {
    label: "[all]",
    value: "all",
  },
  {
    label: "[sys]",
    value: "sys",
  },
  {
    label: "[vault]",
    value: "vault",
  },
  {
    label: "[chat]",
    value: "chat",
  },
];
*/

function formatTimestamp(ts: number | null): string {
  if (!ts) return "[--/--/-- --:--:--]";
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `[${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear().toString().slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}]`;
}

export default function HomeTab() {
  const { lastUnlockTime } = useVault();
  /* const [value, setValue] = useState<string | null>(null); */
  const [fileCount, setFileCount] = useState(0);
  const [albumCount, setAlbumCount] = useState(0);
  const [localRecipientIdentity, setLocalRecipientIdentity] =
    useState<LocalRecipientIdentity | null>(null);
  const [showShareIdentityModal, setShowShareIdentityModal] = useState(false);
  const [showFullPublicKey, setShowFullPublicKey] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const [files, albums] = await Promise.all([
        getFileCount(),
        getAlbumCount(),
      ]);
      setFileCount(files);
      setAlbumCount(albums);
    } catch (err) {
      console.error("[HomeTab] loadStats error:", err);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    ensureLocalRecipientIdentity()
      .then((identity) => {
        setLocalRecipientIdentity(identity);
      })
      .catch((err) => {
        console.error("[HomeTab] ensureLocalRecipientIdentity error:", err);
      });
  }, []);

  const handleSharePublicKey = useCallback(async () => {
    if (!localRecipientIdentity) return;

    await Share.share({
      title: "My Calc public key",
      message: localRecipientIdentity.publicKeyPem,
    });
  }, [localRecipientIdentity]);

  const handleShareRecipientBundle = useCallback(async () => {
    if (!localRecipientIdentity) return;

    const payload = {
      recipient_id: localRecipientIdentity.id,
      fingerprint: localRecipientIdentity.fingerprint,
      public_key_pem: localRecipientIdentity.publicKeyPem,
    };

    await Share.share({
      title: "My Calc recipient info",
      message: JSON.stringify(payload, null, 2),
    });
  }, [localRecipientIdentity]);

  const shortIdentity = localRecipientIdentity?.fingerprint
    ? `${localRecipientIdentity.fingerprint.slice(0, 8)}...${localRecipientIdentity.fingerprint.slice(-4)}`
    : "loading...";

  return (
    <SafeAreaView className="flex-1 px-8 pt-8 bg-primary">
      {/* Header*/}
      <View className="gap-1 mb-4">
        <View className="flex-row items-center gap-2">
          <Text className="shadow shadow-white/60 pt-1 text-secondary-400 text-4xl font-geist-mono-light">
            WELCOME,
          </Text>
          <Text className="shadow shadow-white/60 pt-1 text-secondary text-4xl font-geist-mono">
            PM
          </Text>
        </View>
        <Text className="text-primary-300 text-xl font-fira-code">
          {"//"}v0.0.1-alpha
        </Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        {/* Security Status */}
        <View className="border border-primary-400 rounded-2xl p-6 mt-4 gap-6">
          <View className="gap-3">
            <View className="flex-row items-center">
              <View className="rounded-full shadow shadow-white/60 bg-secondary-400 h-2 w-2" />
              <Text className="ml-4 mr-2 text-secondary-500 text-xl font-fira-code">
                status:
              </Text>
              <Text className="text-secondary shadow shadow-white/60 text-2xl font-geist-mono mr-2">
                SECURE
              </Text>
              <AntDesign
                className="shadow shadow-white/60"
                name="safety"
                size={16}
                color={Colors.secondary[400]}
              />
            </View>
            <View className="flex-row items-center">
              <View className="rounded-full bg-secondary-400 h-2 w-2" />
              <Text className="ml-4 mr-2 text-secondary-500 text-xl font-fira-code">
                albums:
              </Text>
              <Text className="text-secondary text-xl font-fira-code">
                {albumCount}
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="rounded-full bg-secondary-400 h-2 w-2" />
              <Text className="ml-4 mr-2 text-secondary-500 text-xl font-fira-code">
                vault files:
              </Text>
              <Text className="text-secondary text-xl font-fira-code">
                {fileCount}
              </Text>
            </View>
            <View className="flex-col gap-1">
              <View className="flex-row items-center">
                <View className="rounded-full bg-secondary-400 h-2 w-2" />
                <Text className="ml-4 text-secondary-500 text-xl font-fira-code">
                  last login:
                </Text>
              </View>
              <Text className="ml-6 text-secondary text-lg font-fira-code">
                {formatTimestamp(lastUnlockTime)}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center justify-between">
            <View className="flex-col">
              <Text className="text-primary-100 text-xl font-fira-code">
                {"//"}public-identity
              </Text>
              <Text className="text-secondary-600 text-xl font-fira-code">
                {shortIdentity}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowShareIdentityModal(true)}
              className="items-center justify-center h-12 w-28 bg-primary-500 rounded-2xl"
            >
              <Text className="text-secondary-400 text-lg font-fira-code">
                /share
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {/*
        Security Settings (mock card)
        <View className="border border-primary-400 rounded-2xl p-6 mt-6 gap-6">
          <View className="gap-3">
            <View className="flex-row justify-between">
              <View className="flex-row items-center">
                <Text className="mr-2 text-secondary-500 text-xl font-fira-code">
                  face-lock:
                </Text>
                <Text className="text-secondary shadow shadow-white/30 text-xl font-geist-mono">
                  ON
                </Text>
              </View>
              <View className="flex-row items-center">
                <Text className="mr-2 text-secondary-500 text-xl font-fira-code">
                  anti-SS:
                </Text>
                <Text className="text-secondary shadow shadow-white/30 text-xl font-geist-mono">
                  ON
                </Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Text className="mr-2 text-secondary-500 text-xl font-fira-code">
                  pass-code:
                </Text>
                <Text className="text-primary-200 text-xl font-fira-code">
                  OFF
                </Text>
              </View>
              <TouchableOpacity className="items-center justify-center h-12 w-28 bg-primary-500 rounded-2xl">
                <Text className="text-secondary-400 text-lg font-fira-code">
                  /config
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        */}
        {/* Logs */}
        {/*
        <View>
          <View className="mt-8 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Entypo
                name="triangle-down"
                size={24}
                color={Colors.secondary[500]}
              />
              <Text className="ml-3 text-secondary-500 text-xl font-fira-code">
                Logs:
              </Text>
            </View>
            <SelectInput
              options={data}
              value={value || "all"}
              onValueChange={setValue}
              placeholder="[all]"
              className="w-32"
            />
          </View>
          <View className="h-px mt-4 bg-primary-400" />
          <View className="flex-row justify-between mt-5">
            <TouchableOpacity className="items-center justify-center h-12 w-28 bg-secondary-600 rounded-2xl">
              <Text className="text-primary text-lg font-fira-code-medium">
                [info]
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="items-center justify-center h-12 w-28 bg-primary-500 rounded-2xl">
              <Text className="text-secondary-400 text-lg font-fira-code">
                [warning]
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="items-center justify-center h-12 w-28 bg-primary-500 rounded-2xl">
              <Text className="text-secondary-400 text-lg font-fira-code">
                [alert]
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mt-6 gap-4">
            <View className="flex-col gap-2">
              <View className="flex-row items-center justify-between px-2">
                <Text className="text-primary-100 text-xl font-fira-code">
                  [info]
                </Text>
                <Text className="text-primary-100 text-lg font-fira-code">
                  [12/12/25 01:22:35]
                </Text>
              </View>
              <Text className="text-secondary-600 text-lg font-fira-code">
                <Text className="text-secondary">2</Text> new{" "}
                <Text className="text-secondary">messages</Text> from{" "}
                <Text className="text-secondary">mavri</Text>
              </Text>
            </View>
            <View className="flex-col gap-2">
              <View className="flex-row items-center justify-between px-2">
                <Text className="text-primary-100 text-xl font-fira-code">
                  [info]
                </Text>
                <Text className="text-primary-100 text-lg font-fira-code">
                  [11/12/25 12:34:17]
                </Text>
              </View>
              <Text className="text-secondary-600 text-lg font-fira-code">
                <Text className="text-secondary">Face-lock</Text> verification:{" "}
                <Text className="text-secondary">SUCCESS</Text>
              </Text>
            </View>
          </View>


       
          <View className="h-20" />
         </View> */}
      </ScrollView>

      <Modal
        visible={showShareIdentityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareIdentityModal(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center px-8"
          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
          onPress={() => setShowShareIdentityModal(false)}
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
            <Text className="text-secondary-400 text-lg font-fira-code">
              share/public-identity
            </Text>

            <View className="border border-primary-400 rounded-2xl p-4 bg-primary-600/70 gap-2">
              <Text className="text-secondary-600 font-fira-code-light">
                my id
              </Text>
              <Text
                className="text-secondary-200 font-fira-code text-xs"
                numberOfLines={1}
              >
                {localRecipientIdentity?.id ?? "loading..."}
              </Text>
              <Text className="text-secondary-600 font-fira-code-light">
                fingerprint
              </Text>
              <Text
                className="text-secondary-200 font-fira-code text-xs"
                numberOfLines={1}
              >
                {localRecipientIdentity?.fingerprint ?? "loading..."}
              </Text>
              <Text className="text-secondary-600 font-fira-code-light">
                my public key
              </Text>
              <Text
                className="text-secondary-200 font-fira-code-light text-xs"
                numberOfLines={showFullPublicKey ? 0 : 3}
              >
                {localRecipientIdentity?.publicKeyPem ?? "loading..."}
              </Text>

              <View className="flex-row items-center justify-end gap-2 pt-2">
                <TouchableOpacity
                  className="h-9 px-3 rounded-lg bg-primary-500 items-center justify-center"
                  onPress={() => setShowFullPublicKey((prev) => !prev)}
                >
                  <Text className="text-secondary font-fira-code text-xs">
                    {showFullPublicKey ? "collapse" : "expand"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="h-9 px-3 rounded-lg bg-primary-500 items-center justify-center"
                  onPress={handleSharePublicKey}
                  disabled={!localRecipientIdentity}
                >
                  <Text className="text-secondary font-fira-code text-xs">
                    share key
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="h-9 px-3 rounded-lg bg-secondary-500 items-center justify-center"
                  onPress={handleShareRecipientBundle}
                  disabled={!localRecipientIdentity}
                >
                  <Text className="text-primary-500 font-fira-code-semibold text-xs">
                    share info
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex-row items-center justify-end">
              <TouchableOpacity
                className="h-12 px-4 rounded-xl bg-primary-600 items-center justify-center"
                onPress={() => setShowShareIdentityModal(false)}
              >
                <Text className="text-secondary font-fira-code">close</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

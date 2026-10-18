import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/components/colors";
import { useVault } from "@/components/Providers/VaultProvider";

type SettingsPanel = "decoy" | "delete" | null;

export default function SettingsTab() {
  const { lock, resetAllData, deleteDecoySpace, activeRole, hasDecoy, createDecoy, changeDecoyPin } = useVault();
  const router = useRouter();
  const [panel, setPanel] = useState<SettingsPanel>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [deletePin, setDeletePin] = useState("");
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const closePanel = useCallback(() => {
    if (busy) return;
    setPanel(null);
    setPin("");
    setConfirmPin("");
    setOldPin("");
    setDeletePin("");
    setPanelError("");
    setConfirmDelete(false);
  }, [busy]);

  const handleLock = useCallback(async () => {
    await lock();
    router.replace("/(auth)/calculator");
  }, [lock, router]);

  const handleCreateDecoy = useCallback(async () => {
    if (!/^\d{6,}$/.test(pin)) {
      setPanelError("Use at least 6 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setPanelError("PINs do not match.");
      return;
    }
    setPanelError("");
    setBusy(true);
    try {
      if (hasDecoy) await changeDecoyPin(oldPin, pin);
      else await createDecoy(pin);
      setPanel(null);
      setPin("");
      setConfirmPin("");
      setOldPin("");
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Could not create space.");
    } finally {
      setBusy(false);
    }
  }, [pin, confirmPin, oldPin, hasDecoy, createDecoy, changeDecoyPin]);

  const handleReset = useCallback(() => {
    if (!deletePin) {
      setPanelError("Enter this space's PIN first.");
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      setPanelError("");
      return;
    }
    const isReal = activeRole === "real";
    setBusy(true);
    const action = isReal ? resetAllData(deletePin) : deleteDecoySpace(deletePin);
    void action
      .then(() => {
        setPanel(null);
        setDeletePin("");
        setConfirmDelete(false);
        if (!isReal) router.replace("/(auth)/calculator");
      })
      .catch((error) => setPanelError(error instanceof Error ? error.message : "Could not delete data."))
      .finally(() => setBusy(false));
  }, [deletePin, confirmDelete, activeRole, resetAllData, deleteDecoySpace, router]);

  return (
    <SafeAreaView className="flex-1 px-8 pt-8 bg-primary">
      <Text className="pt-1 text-secondary text-4xl font-geist-mono">CONFIG/</Text>

      <ScrollView className="mt-8" contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Text className="text-secondary-400 text-xl font-fira-code">session/</Text>
        <View className="h-px bg-primary-400 mt-4 mb-5" />
        <TouchableOpacity onPress={handleLock} className="h-16 px-5 bg-primary-500 rounded-2xl flex-row items-center justify-between">
          <Text className="text-secondary-400 text-lg font-fira-code">/lock</Text>
          <Text className="text-primary-100 text-lg font-fira-code">{">"}</Text>
        </TouchableOpacity>

        {activeRole === "real" && (
          <View className="mt-12">
            <View className="flex-row items-center justify-between">
              <Text className="text-secondary-400 text-xl font-fira-code">spaces/</Text>
              <Text className="text-primary-100 text-base font-fira-code">{"//"} {hasDecoy ? "1 alternate" : "0 alternate"}</Text>
            </View>
            <View className="h-px bg-primary-400 mt-4 mb-5" />
            <TouchableOpacity onPress={() => { setPanelError(""); setPanel("decoy"); }} className="min-h-20 px-5 py-4 border border-primary-500 rounded-2xl flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-secondary text-lg font-fira-code">alternate_space/</Text>
                <Text className="text-primary-100 text-sm font-fira-code mt-1">{hasDecoy ? "Change access PIN" : "Create separate space"}</Text>
              </View>
              <Text className="text-secondary-400 text-lg font-fira-code">{">"}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View className="mt-12">
          <Text className="text-secondary-400 text-xl font-fira-code">data/</Text>
          <View className="h-px bg-primary-400 mt-4 mb-5" />
          <TouchableOpacity onPress={() => { setPanelError(""); setConfirmDelete(false); setPanel("delete"); }} className="min-h-20 px-5 py-4 border border-primary-500 rounded-2xl flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-secondary text-lg font-fira-code">{activeRole === "real" ? "delete_all_data/" : "delete_this_space/"}</Text>
              <Text className="text-primary-100 text-sm font-fira-code mt-1">Permanent deletion</Text>
            </View>
            <Text className="text-red-500 text-lg font-fira-code">{">"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={panel !== null} transparent animationType="none" onRequestClose={closePanel}>
        <Pressable className="flex-1 items-center justify-center px-8" style={{ backgroundColor: "rgba(0,0,0,0.45)" }} onPress={closePanel}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="w-full items-center justify-center">
            <Pressable className="w-full max-w-sm bg-primary-500 border border-primary-400 rounded-2xl p-5 gap-4" onPress={() => {}}>
              {panel === "decoy" && (
                <>
                  <Text className="text-secondary text-xl font-fira-code-semibold">alternate_space/</Text>
                  <Text className="text-primary-100 font-fira-code">{hasDecoy ? "Change the PIN for this separate space." : "Create an empty space with a different PIN."}</Text>
                  {hasDecoy && (
                    <TextInput keyboardAppearance="dark" value={oldPin} onChangeText={(value) => setOldPin(value.replace(/\D/g, ""))} secureTextEntry keyboardType="number-pad" placeholder="current_alternate_pin" placeholderTextColor={Colors.primary[100]} className="h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code" />
                  )}
                  <TextInput keyboardAppearance="dark" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, ""))} secureTextEntry keyboardType="number-pad" placeholder="new_pin (6+ digits)" placeholderTextColor={Colors.primary[100]} className="h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code" />
                  <TextInput keyboardAppearance="dark" value={confirmPin} onChangeText={(value) => setConfirmPin(value.replace(/\D/g, ""))} secureTextEntry keyboardType="number-pad" placeholder="confirm_pin" placeholderTextColor={Colors.primary[100]} className="h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code" onSubmitEditing={handleCreateDecoy} />
                  {!!panelError && <Text className="text-red-500 font-fira-code">{panelError}</Text>}
                  <View className="flex-row gap-3 mt-1">
                    <TouchableOpacity onPress={closePanel} disabled={busy} className="flex-1 h-12 bg-primary-600 rounded-xl items-center justify-center">
                      <Text className="text-secondary-400 font-fira-code">cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleCreateDecoy} disabled={busy} className="flex-1 h-12 bg-secondary-500 rounded-xl items-center justify-center">
                      <Text className="text-primary-500 font-fira-code-semibold">{hasDecoy ? "change_pin" : "create_space"}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {panel === "delete" && (
                <>
                  <Text className="text-secondary text-xl font-fira-code-semibold">{activeRole === "real" ? "delete_all_data/" : "delete_this_space/"}</Text>
                  <Text className="text-primary-100 font-fira-code">{confirmDelete ? "This cannot be undone. Confirm deletion below." : activeRole === "real" ? "Both spaces and all local data will be deleted." : "This space and its local data will be deleted."}</Text>
                  <TextInput keyboardAppearance="dark" value={deletePin} onChangeText={(value) => { setDeletePin(value.replace(/\D/g, "")); setConfirmDelete(false); }} secureTextEntry keyboardType="number-pad" placeholder="current_pin" placeholderTextColor={Colors.primary[100]} className="h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code" />
                  {!!panelError && <Text className="text-red-500 font-fira-code">{panelError}</Text>}
                  <View className="flex-row gap-3 mt-1">
                    <TouchableOpacity onPress={closePanel} disabled={busy} className="flex-1 h-12 bg-primary-600 rounded-xl items-center justify-center">
                      <Text className="text-secondary-400 font-fira-code">cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleReset} disabled={busy} className="flex-1 h-12 bg-red-900/30 border border-red-900 rounded-xl items-center justify-center">
                      <Text className="text-red-500 font-fira-code">{confirmDelete ? "confirm_delete" : "delete"}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

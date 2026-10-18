import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { AntDesign } from "@expo/vector-icons";
import * as Icon from "phosphor-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { randomUUID } from "react-native-quick-crypto";
import { Colors } from "@/components/colors";
import { useChatStore } from "@/store/chat.store";

function messageDate(timestamp: number) {
  const date = new Date(timestamp);
  const two = (value: number) => String(value).padStart(2, "0");
  return `[${two(date.getDate())}/${two(date.getMonth() + 1)}/${two(date.getFullYear() % 100)} ${two(date.getHours())}:${two(date.getMinutes())}]`;
}

export default function ChatTab() {
  const contacts = useChatStore((state) => state.contacts);
  const messages = useChatStore((state) => state.messages);
  const upsertContact = useChatStore((state) => state.upsertContact);
  const [adding, setAdding] = useState(false);
  const [alias, setAlias] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const addContact = () => {
    const name = alias.trim();
    if (!name) return;
    if (contacts.some((contact) => contact.alias.toLowerCase() === name.toLowerCase())) {
      Alert.alert("Contact", "This alias already exists.");
      return;
    }
    upsertContact({ id: randomUUID(), alias: name, fingerprint: "", status: "offline", lastSeen: 0 });
    setAlias("");
    setAdding(false);
  };

  const visibleContacts = unreadOnly
    ? contacts.filter((contact) => (messages[contact.id] ?? []).some((message) => message.authorId !== "self" && message.status !== "read"))
    : contacts;

  return (
    <SafeAreaView className="flex-1 px-8 pt-8 bg-primary">
      <View className="gap-1 flex-row items-center justify-between">
        <Text className="pt-1 text-secondary text-4xl font-geist-mono">CHAT/</Text>
        {!adding && (
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => setAdding(true)} className="items-center justify-center h-12 w-24 bg-secondary-500 rounded-2xl">
              <Text className="text-primary-400 text-lg font-fira-code-semibold">/add</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {}} className="bg-primary-500 h-12 w-12 rounded-2xl items-center justify-center">
              <Icon.DotsThreeVerticalIcon size={24} color={Colors.secondary[400]} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {adding && (
        <View className="mt-4 flex-row items-center gap-3">
          <Text className="text-secondary-600 text-xl font-fira-code">
            <Text className="text-primary-100">{">"}</Text> add
          </Text>
          <TextInput keyboardAppearance="dark"
            value={alias}
            onChangeText={setAlias}
            placeholder="contact_alias"
            placeholderTextColor={Colors.primary[100]}
            autoFocus
            className="flex-1 h-12 px-4 border border-primary-400 rounded-2xl text-secondary font-fira-code text-lg"
            onSubmitEditing={addContact}
          />
          <TouchableOpacity onPress={addContact} className="h-12 w-12 bg-secondary-500 rounded-2xl items-center justify-center">
            <AntDesign name="enter" size={18} color={Colors.primary.DEFAULT} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setAdding(false);
              setAlias("");
            }}
            className="h-12 w-12 bg-primary-500 rounded-2xl items-center justify-center"
          >
            <Text className="text-secondary-400 text-lg font-fira-code">^C</Text>
          </TouchableOpacity>
        </View>
      )}

      <View className="gap-1 mt-8 flex-row items-center justify-between">
        <Text className="text-secondary-400 text-xl font-fira-code">contacts/</Text>
        <Text className="text-primary-100 text-xl font-fira-code">{"//"}{contacts.length} contacts</Text>
      </View>
      <View className="h-px bg-primary-400 mt-6" />

      <View className="flex-row justify-between mt-4">
        <TouchableOpacity onPress={() => setUnreadOnly(false)} className={`items-center justify-center h-12 w-28 rounded-2xl ${!unreadOnly ? "bg-secondary-600" : "bg-primary-500"}`}>
          <Text className={`text-lg font-fira-code-medium ${!unreadOnly ? "text-primary" : "text-secondary-400"}`}>[all]</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setUnreadOnly(true)} className={`items-center justify-center h-12 w-28 rounded-2xl ${unreadOnly ? "bg-secondary-600" : "bg-primary-500"}`}>
          <Text className={`text-lg font-fira-code ${unreadOnly ? "text-primary" : "text-secondary-400"}`}>[un-read]</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {}} className="items-center justify-center h-12 w-28 border-primary-300 border rounded-2xl">
          <Text className="text-secondary-400 text-lg font-fira-code">/sudo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="mt-8" contentContainerClassName="gap-3">
        {visibleContacts.length === 0 && <Text className="text-primary-100 font-fira-code">{unreadOnly ? "No unread messages." : "No contacts in this space."}</Text>}
        {visibleContacts.map((contact, index) => {
          const thread = messages[contact.id] ?? [];
          const last = thread[thread.length - 1];
          const unread = thread.filter((message) => message.authorId !== "self" && message.status !== "read").length;
          return (
            <View key={contact.id} className="gap-3">
              {index > 0 && <View className="h-px bg-primary-500" />}
              <TouchableOpacity onPress={() => router.push({ pathname: "/(tabs)/dm", params: { contactId: contact.id } })} className="flex-col gap-1">
                <View className="flex-row justify-between">
                  <Text className="text-secondary-600 text-xl font-fira-code">
                    {"<"}<Text className="text-secondary-200">@</Text><Text className="text-secondary-600">{contact.alias}</Text>{">"}
                  </Text>
                  {last && <Text className="text-primary-100 text-lg font-fira-code">{messageDate(last.createdAt)}</Text>}
                </View>
                <Text className="text-secondary-600 text-lg font-fira-code">
                  {unread > 0 ? <><Text className="text-secondary-200">{unread} </Text>new messages</> : "No new messages"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

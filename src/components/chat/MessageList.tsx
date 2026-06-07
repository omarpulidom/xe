import { useMemo } from "react";
import { FlatList, Text, View } from "react-native";
import { formatDate, isSameDay } from "@/lib/chat/format";
import type { Contact, Message, MessageVariant } from "@/lib/chat/types";
import { Message as MessageBubble } from "./Message";

type DateRow = {
  type: "date";
  date: number;
  key: string;
};

type MsgRow = {
  type: "msg";
  msg: Message;
  variant: MessageVariant;
  key: string;
};

type Row = DateRow | MsgRow;

type Props = {
  messages: Message[];
  myId: string;
  contacts: Contact[];
  systemAuthorId?: string;
  emptyText?: string;
};

export function MessageList({
  messages,
  myId,
  contacts,
  systemAuthorId = "system",
  emptyText = "// no messages yet",
}: Props) {
  const rows = useMemo(
    () => buildRows(messages, myId, systemAuthorId),
    [messages, myId, systemAuthorId],
  );

  if (rows.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-primary-100 text-lg font-fira-code">
          {emptyText}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.key}
      renderItem={({ item }) => renderRow(item, contacts)}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 24 }}
      showsVerticalScrollIndicator={false}
    />
  );
}

function renderRow(row: Row, contacts: Contact[]) {
  if (row.type === "date") {
    return (
      <Text className="text-center text-primary-100 text-lg font-fira-code my-6">
        {formatDate(row.date)}
      </Text>
    );
  }

  if (row.variant === "system") {
    return (
      <MessageBubble
        message={row.msg}
        variant="system"
        authorAlias=""
      />
    );
  }

  const contact = contacts.find((c) => c.id === row.msg.authorId);
  const alias = contact?.alias ?? "unknown";

  return (
    <MessageBubble message={row.msg} variant={row.variant} authorAlias={alias} />
  );
}

function buildRows(
  messages: Message[],
  myId: string,
  systemAuthorId: string,
): Row[] {
  if (messages.length === 0) return [];

  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
  const rows: Row[] = [];
  let lastDay: number | null = null;

  for (const msg of sorted) {
    if (lastDay === null || !isSameDay(lastDay, msg.createdAt)) {
      rows.push({
        type: "date",
        date: msg.createdAt,
        key: `date-${msg.id}-${msg.createdAt}`,
      });
      lastDay = msg.createdAt;
    }

    const variant: MessageVariant =
      msg.authorId === systemAuthorId
        ? "system"
        : msg.authorId === myId
          ? "mine"
          : "theirs";

    rows.push({ type: "msg", msg, variant, key: msg.id });
  }

  return rows;
}

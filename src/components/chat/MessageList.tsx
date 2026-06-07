import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { formatDate, isSameDay } from "@/lib/chat/format";
import { useChatStore } from "@/store/chat.store";
import type { Contact, Message, MessageVariant } from "@/lib/chat/types";
import { Message as MessageBubble } from "./Message";
import { TypingIndicator } from "./TypingIndicator";

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
  typing?: boolean;
  typingAlias?: string;
  systemAuthorId?: string;
  emptyText?: string;
};

export function MessageList({
  messages,
  myId,
  contacts,
  typing = false,
  typingAlias = "...",
  systemAuthorId = "system",
  emptyText = "// no messages yet",
}: Props) {
  const allRows = useMemo(
    () => buildRows(messages, myId, systemAuthorId),
    [messages, myId, systemAuthorId],
  );

  const seenIdsRef = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    for (const m of messages) {
      seenIdsRef.current.add(m.id);
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const detected = new Set<string>();
    for (const m of messages) {
      if (!seenIdsRef.current.has(m.id)) {
        seenIdsRef.current.add(m.id);
        detected.add(m.id);
      }
    }
    if (detected.size > 0) {
      setNewIds((prev) => {
        const next = new Set(prev);
        for (const id of detected) next.add(id);
        return next;
      });
    }
  }, [messages, isReady]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const store = useChatStore.getState();
      for (const threadId of Object.keys(store.messages)) {
        for (const msg of store.messages[threadId]) {
          if (
            (msg.status === "read" || msg.status === "delivered") &&
            msg.expiresAt &&
            msg.expiresAt <= now
          ) {
            const next = msg.burnOnRead ? "burned" : "expired";
            store.updateMessage(threadId, msg.id, { status: next });
          }
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const visibleRows = useMemo(() => {
    if (!isReady) return allRows;
    return allRows.filter((r) => {
      if (r.type === "date") return true;
      return seenIdsRef.current.has(r.msg.id) || newIds.has(r.msg.id);
    });
  }, [allRows, isReady, newIds]);

  if (visibleRows.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-primary-100 text-sm font-fira-code">
          {emptyText}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={visibleRows}
      keyExtractor={(r) => {
        if (r.type === "date") return r.key;
        return newIds.has(r.msg.id) ? `${r.msg.id}-anim` : r.msg.id;
      }}
      renderItem={({ item }) => renderRow(item, contacts, newIds)}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 16 }}
      showsVerticalScrollIndicator={false}
      ListFooterComponent={
        typing ? <TypingIndicator authorAlias={typingAlias} /> : null
      }
    />
  );
}

function renderRow(
  row: Row,
  contacts: Contact[],
  newIds: Set<string>,
) {
  if (row.type === "date") {
    return (
      <Text className="text-center text-primary-100 text-sm font-fira-code my-3">
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
        animate={false}
      />
    );
  }

  const contact = contacts.find((c) => c.id === row.msg.authorId);
  const alias = contact?.alias ?? "unknown";
  const animate = newIds.has(row.msg.id);

  return (
    <MessageBubble
      message={row.msg}
      variant={row.variant}
      authorAlias={alias}
      animate={animate}
    />
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

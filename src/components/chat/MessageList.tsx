import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Text,
  Vibration,
  View,
} from "react-native";
import { formatDate, isSameDay } from "@/lib/chat/format";
import { useChatStore } from "@/store/chat.store";
import type { Contact, Message, MessageVariant } from "@/lib/chat/types";
import { Message as MessageBubble } from "./Message";
import { TypingIndicator } from "./TypingIndicator";
import { ScrollToBottomBadge } from "./ScrollToBottomBadge";

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
  onMessageLongPress?: (message: Message) => void;
};

const AT_BOTTOM_THRESHOLD_PX = 80;
const HIGHLIGHT_DURATION_MS = 1200;

export function MessageList({
  messages,
  myId,
  contacts,
  typing = false,
  typingAlias = "...",
  systemAuthorId = "system",
  emptyText = "// no messages yet",
  onMessageLongPress,
}: Props) {
  const allRows = useMemo(
    () => buildRows(messages, myId, systemAuthorId),
    [messages, myId, systemAuthorId],
  );

  const seenIdsRef = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);

  const flatListRef = useRef<FlatList<Row>>(null);
  const isAtBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const [newCount, setNewCount] = useState(0);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const count = messages.length;
    if (!isReady) {
      prevCountRef.current = count;
      return;
    }
    const prev = prevCountRef.current;
    if (count > prev) {
      const diff = count - prev;
      if (isAtBottomRef.current) {
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        });
        setNewCount(0);
      } else {
        setNewCount((c) => c + diff);
      }
    }
    prevCountRef.current = count;
  }, [messages.length, isReady]);

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

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distance =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const atBottom = distance < AT_BOTTOM_THRESHOLD_PX;
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      setNewCount(0);
    }
  }, []);

  const onContentSizeChange = useCallback(() => {
    if (isAtBottomRef.current) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setNewCount(0);
    isAtBottomRef.current = true;
  }, []);

  const handleReplyQuotePress = useCallback(
    (id: string) => {
      const idx = visibleRows.findIndex(
        (r) => r.type === "msg" && r.msg.id === id,
      );
      if (idx === -1) return;
      Vibration.vibrate([0, 20, 30, 20]);
      flatListRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.3,
      });
      setHighlightedId(id);
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedId(null);
        highlightTimerRef.current = null;
      }, HIGHLIGHT_DURATION_MS);
    },
    [visibleRows],
  );

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

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
    <View className="flex-1">
      <FlatList
        ref={flatListRef}
        data={visibleRows}
        keyExtractor={(r) => {
          if (r.type === "date") return r.key;
          return newIds.has(r.msg.id) ? `${r.msg.id}-anim` : r.msg.id;
        }}
        renderItem={({ item }) =>
          renderRow(
            item,
            contacts,
            newIds,
            onMessageLongPress,
            handleReplyQuotePress,
            highlightedId,
          )
        }
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 16 }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onContentSizeChange={onContentSizeChange}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
              viewPosition: 0.3,
            });
          }, 100);
        }}
        ListFooterComponent={
          typing ? <TypingIndicator authorAlias={typingAlias} /> : null
        }
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 0,
        }}
      />
      <ScrollToBottomBadge count={newCount} onPress={scrollToBottom} />
    </View>
  );
}

function renderRow(
  row: Row,
  contacts: Contact[],
  newIds: Set<string>,
  onMessageLongPress?: (message: Message) => void,
  onReplyQuotePress?: (messageId: string) => void,
  highlightedId: string | null = null,
) {
  if (row.type === "date") {
    return (
      <View className="my-3 items-center">
        <Text className="text-xs text-primary-100 font-fira-code">
          {formatDate(row.date)}
        </Text>
      </View>
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
      onLongPress={onMessageLongPress}
      onReplyQuotePress={onReplyQuotePress}
      isHighlighted={highlightedId === row.msg.id}
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

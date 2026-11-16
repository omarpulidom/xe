import type { CommandKind } from "./types";

export type ParsedCommand = {
  kind: Exclude<CommandKind, null>;
  durationSec: number | null;
  body: string;
  raw: string;
};

const KNOWN_COMMANDS = new Set([
  "ttl",
  "clear",
  "panic",
]);

const COMMAND_RE = /^\/(\w+)(?:\s+(\d+[smh]?))?\s*([\s\S]*)$/;

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const match = trimmed.match(COMMAND_RE);
  if (!match) return null;

  const cmd = match[1];
  if (!KNOWN_COMMANDS.has(cmd)) return null;

  const durationSec = match[2] ? parseDuration(match[2]) : null;
  const body = (match[3] ?? "").trim();

  return {
    kind: cmd as Exclude<CommandKind, null>,
    durationSec,
    body,
    raw: trimmed,
  };
}

export function parseDuration(spec: string): number | null {
  const m = spec.match(/^(\d+)([smh])?$/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  const unit = m[2] ?? "s";
  switch (unit) {
    case "s":
      return n;
    case "m":
      return n * 60;
    case "h":
      return n * 3600;
    default:
      return null;
  }
}

export const COMMAND_REGEX_FOR_HIGHLIGHT = /^\/(\w+)/;
export const COMMAND_QUERY_RE = /^\/(\w*)/;

export type CommandMeta = {
  name: string;
  description: string;
  example: string;
};

export const COMMAND_LIST: CommandMeta[] = [
  {
    name: "ttl",
    description: "expires after duration",
    example: "/ttl 5m message",
  },
  {
    name: "clear",
    description: "wipe local thread",
    example: "/clear",
  },
  {
    name: "panic",
    description: "lock app now",
    example: "/panic",
  },
];

export function getCommandQuery(input: string): string {
  const match = input.match(COMMAND_QUERY_RE);
  return match ? match[1] : "";
}

export function filterCommands(query: string): CommandMeta[] {
  if (!query) return COMMAND_LIST;
  const q = query.toLowerCase();
  return COMMAND_LIST.filter((c) => c.name.startsWith(q));
}

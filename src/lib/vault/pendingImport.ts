let pendingPath: string | null = null;
const listeners = new Set<() => void>();

export function queueImportPath(path: string) {
  pendingPath = path;
  for (const listener of listeners) listener();
}

export function subscribeImportPath(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function takeImportPath(): string | null {
  const path = pendingPath;
  pendingPath = null;
  return path;
}

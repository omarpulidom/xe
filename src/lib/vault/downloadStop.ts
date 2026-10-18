let stopHandler: (() => Promise<void>) | null = null

export function registerDownloadStop(handler: (() => Promise<void>) | null): void {
  stopHandler = handler
}

export async function stopDownloadsBeforeLock(): Promise<void> {
  await stopHandler?.()
}

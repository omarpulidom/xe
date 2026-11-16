import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { fetch as expoFetch } from 'expo/fetch'
import { AppState } from 'react-native'
import { closeSync, constants, openSync, writeSync } from 'react-native-nitro-file-system'
import { randomUUID } from 'react-native-quick-crypto'
import { useVault } from './VaultProvider'
import { createAlbum, getAlbums } from '@/lib/vault/vaultDB'
import { getActiveProfile } from '@/lib/vault/profiles'
import { readProfileValue, writeProfileValue } from '@/lib/vault/profileStorage'
import { downloadTempPath, removeDownloadTemp } from '@/lib/vault/downloadQueueFiles'
import { extractMediaLinks, type MediaLink } from '@/lib/vault/downloadExtractor'
import { registerDownloadStop } from '@/lib/vault/downloadStop'

export type DownloadJob = MediaLink & {
  id: string
  status: 'queued' | 'downloading' | 'encrypting' | 'done' | 'error'
  progress: number | null
  bytesWritten: number
  bytesTotal: number | null
  errorMessage?: string
  retries: number
}

export type DownloadBatch = {
  id: string
  albumId: string
  sourceUrl: string
  status: 'searching' | 'running' | 'done' | 'error'
  jobs: DownloadJob[]
  errorMessage?: string
  createdAt: number
  finishedAt?: number
}

type DownloadContextValue = {
  batches: DownloadBatch[]
  start: (url: string) => Promise<string>
  retryJob: (batchId: string, jobId: string) => void
  retryBatch: (batchId: string) => void
}

const DownloadContext = createContext<DownloadContextValue | null>(null)
const STORAGE_KEY = 'download-queue-v1'

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Download failed'
}

async function ensureDownloadsAlbum(): Promise<string> {
  const albums = await getAlbums()
  const existing =
    albums.find((album) => album.id === 'downloads') ??
    albums.find((album) => album.name.toLowerCase() === 'downloads')
  if (existing) return existing.id
  await createAlbum('downloads', 'downloads')
  return 'downloads'
}

async function findMedia(url: string, signal: AbortSignal): Promise<MediaLink[]> {
  const response = await fetch(url, {
    signal,
  })
  if (!response.ok) throw new Error(`Page returned HTTP ${response.status}`)
  const declaredSize = Number(response.headers.get('content-length'))
  if (declaredSize > 5 * 1024 * 1024) throw new Error('Page is too large to scan')
  const html = await response.text()
  if (html.length > 5 * 1024 * 1024) throw new Error('Page is too large to scan')
  const links = extractMediaLinks(url, html)
  if (!links.some((link) => link.mime === 'video/mp4'))
    throw new Error('No MP4 videos found on this page.')
  return links
}

export function DownloadProvider({ children }: { children: ReactNode }) {
  const { isUnlocked, addFileToAlbum } = useVault()
  const [batches, setBatches] = useState<DownloadBatch[]>([])
  const batchesRef = useRef<DownloadBatch[]>([])
  const profileIdRef = useRef<string | null>(null)
  const runnerRef = useRef<Promise<void> | null>(null)
  const downloadRef = useRef<AbortController | null>(null)
  const fetchRef = useRef<AbortController | null>(null)
  const stoppingRef = useRef(false)
  const pausePromiseRef = useRef<Promise<void> | null>(null)

  const update = useCallback(
    (change: (current: DownloadBatch[]) => DownloadBatch[], persist = true) => {
      const next = change(batchesRef.current)
      batchesRef.current = next
      setBatches(next)
      if (persist && getActiveProfile()?.id === profileIdRef.current) {
        writeProfileValue(STORAGE_KEY, JSON.stringify(next))
      }
    },
    [],
  )

  const patchBatch = useCallback(
    (batchId: string, patch: Partial<DownloadBatch>, persist = true) => {
      update(
        (current) =>
          current.map((batch) =>
            batch.id === batchId
              ? {
                  ...batch,
                  ...patch,
                }
              : batch,
          ),
        persist,
      )
    },
    [
      update,
    ],
  )

  const patchJob = useCallback(
    (batchId: string, jobId: string, patch: Partial<DownloadJob>, persist = true) => {
      update(
        (current) =>
          current.map((batch) =>
            batch.id === batchId
              ? {
                  ...batch,
                  jobs: batch.jobs.map((job) =>
                    job.id === jobId
                      ? {
                          ...job,
                          ...patch,
                        }
                      : job,
                  ),
                }
              : batch,
          ),
        persist,
      )
    },
    [
      update,
    ],
  )

  const processQueue = useCallback(async () => {
    for (const original of batchesRef.current) {
      if (stoppingRef.current) break
      let batch = batchesRef.current.find((item) => item.id === original.id)
      if (!batch || batch.status === 'done' || batch.status === 'error') continue
      if (batch.status === 'searching') {
        const controller = new AbortController()
        fetchRef.current = controller
        const timeout = setTimeout(() => controller.abort(), 30_000)
        try {
          const links = await findMedia(batch.sourceUrl, controller.signal)
          if (stoppingRef.current) break
          patchBatch(batch.id, {
            status: 'running',
            jobs: links.map((link) => ({
              ...link,
              id: randomUUID(),
              status: 'queued',
              progress: 0,
              bytesWritten: 0,
              bytesTotal: null,
              retries: 0,
            })),
          })
        } catch (error) {
          if (!stoppingRef.current)
            patchBatch(batch.id, {
              status: 'error',
              errorMessage: controller.signal.aborted ? 'Page request timed out.' : message(error),
              finishedAt: Date.now(),
            })
          continue
        } finally {
          clearTimeout(timeout)
          fetchRef.current = null
        }
      }

      batch = batchesRef.current.find((item) => item.id === original.id)
      if (!batch || stoppingRef.current) break
      for (const job of batch.jobs) {
        if (stoppingRef.current) break
        const latest = batchesRef.current
          .find((item) => item.id === batch?.id)
          ?.jobs.find((item) => item.id === job.id)
        if (!latest || latest.status !== 'queued') continue
        const tempPath = downloadTempPath(job.id)
        let stallTimer: ReturnType<typeof setTimeout> | null = null
        let timedOut = false
        try {
          removeDownloadTemp(job.id)
          patchJob(batch.id, job.id, {
            status: 'downloading',
            progress: 0,
            errorMessage: undefined,
          })
          const referer = `${new URL(batch.sourceUrl).origin}/`
          const controller = new AbortController()
          downloadRef.current = controller
          const resetStallTimer = () => {
            if (stallTimer) clearTimeout(stallTimer)
            stallTimer = setTimeout(() => {
              timedOut = true
              controller.abort()
            }, 60_000)
          }
          resetStallTimer()
          const result = await expoFetch(job.url, {
            headers: {
              Referer: referer,
            },
            signal: controller.signal,
          })
          if (!result.ok) throw new Error(`Media returned HTTP ${result.status}`)
          const contentType = (result.headers.get('content-type') ?? '').toLowerCase()
          if (!contentType.includes(job.mime))
            throw new Error(`Unexpected media type: ${contentType || 'unknown'}`)
          const reader = result.body?.getReader()
          if (!reader) throw new Error('The server returned no media data.')
          const declaredSize = Number(result.headers.get('content-length'))
          const known = Number.isFinite(declaredSize) && declaredSize > 0
          let received = 0
          let lastProgressAt = 0
          const fd = openSync(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC)
          let downloadComplete = false
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              if (stoppingRef.current || controller.signal.aborted)
                throw new Error('Download paused')
              let offset = 0
              while (offset < value.length) {
                const written = writeSync(fd, value, offset, value.length - offset)
                if (written <= 0) throw new Error('Could not save downloaded media')
                offset += written
              }
              received += value.length
              resetStallTimer()
              if (Date.now() - lastProgressAt >= 100 || (known && received === declaredSize)) {
                lastProgressAt = Date.now()
                patchJob(
                  batch.id,
                  job.id,
                  {
                    progress: known ? Math.min(0.8, (0.8 * received) / declaredSize) : null,
                    bytesWritten: received,
                    bytesTotal: known ? declaredSize : null,
                  },
                  false,
                )
              }
            }
            downloadComplete = true
          } finally {
            closeSync(fd)
            if (!downloadComplete) await reader.cancel().catch(() => undefined)
            reader.releaseLock()
          }
          downloadRef.current = null
          if (stallTimer) clearTimeout(stallTimer)
          stallTimer = null
          if (received === 0) throw new Error('The media file is empty.')
          if (known && received !== declaredSize) throw new Error('The media file is incomplete.')
          if (stoppingRef.current) break
          patchJob(batch.id, job.id, {
            status: 'encrypting',
            progress: 0.8,
          })
          const batchId = batch.id
          await addFileToAlbum(batch.albumId, tempPath, job.mime, job.name, (fraction) => {
            if (stoppingRef.current || getActiveProfile()?.id !== profileIdRef.current)
              throw new Error('Download interrupted by vault lock')
            patchJob(
              batchId,
              job.id,
              {
                progress: 0.8 + 0.2 * fraction,
              },
              false,
            )
          })
          if (stoppingRef.current) break
          patchJob(batch.id, job.id, {
            status: 'done',
            progress: 1,
          })
        } catch (error) {
          if (!stoppingRef.current)
            patchJob(batch.id, job.id, {
              status: 'error',
              progress: 0,
              errorMessage: timedOut ? 'Download timed out.' : message(error),
            })
        } finally {
          if (stallTimer) clearTimeout(stallTimer)
          downloadRef.current = null
          removeDownloadTemp(job.id)
        }
      }
      if (stoppingRef.current) break
      const completed = batchesRef.current.find((item) => item.id === batch?.id)
      if (completed?.jobs.every((job) => job.status === 'done' || job.status === 'error')) {
        patchBatch(completed.id, {
          status: 'done',
          finishedAt: Date.now(),
        })
      }
    }
  }, [
    addFileToAlbum,
    patchBatch,
    patchJob,
  ])

  const pump = useCallback(() => {
    if (runnerRef.current || stoppingRef.current || !profileIdRef.current) return
    const running = processQueue()
    runnerRef.current = running
    void running.catch((error) => console.error('[DownloadProvider] queue error', error)).finally(() => {
      if (runnerRef.current === running) runnerRef.current = null
      if (
        !stoppingRef.current &&
        batchesRef.current.some(
          (batch) =>
            batch.status === 'searching' ||
            (batch.status === 'running' && batch.jobs.some((job) => job.status === 'queued')),
        )
      )
        pump()
    })
  }, [
    processQueue,
  ])

  const stop = useCallback(async () => {
    stoppingRef.current = true
    fetchRef.current?.abort()
    downloadRef.current?.abort()
    await runnerRef.current?.catch(() => undefined)
    for (const batch of batchesRef.current) for (const job of batch.jobs) removeDownloadTemp(job.id)
    update((current) =>
      current.map((batch) => ({
        ...batch,
        jobs: batch.jobs.map((job) =>
          job.status === 'downloading' || job.status === 'encrypting'
            ? {
                ...job,
                status: 'queued',
                progress: 0,
                bytesWritten: 0,
                bytesTotal: null,
              }
            : job,
        ),
      })),
    )
  }, [
    update,
  ])

  useEffect(() => {
    registerDownloadStop(stop)
    return () => registerDownloadStop(null)
  }, [
    stop,
  ])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (!profileIdRef.current) return
      if (state !== 'active') {
        pausePromiseRef.current = stop()
      } else if (isUnlocked) {
        void (async () => {
          await pausePromiseRef.current
          pausePromiseRef.current = null
          if (getActiveProfile()?.id !== profileIdRef.current) return
          stoppingRef.current = false
          pump()
        })()
      }
    })
    return () => subscription.remove()
  }, [
    isUnlocked,
    pump,
    stop,
  ])

  useEffect(() => {
    if (!isUnlocked) {
      if (!profileIdRef.current) return
      void stop().then(() => {
        profileIdRef.current = null
        batchesRef.current = []
        setBatches([])
      })
      return
    }
    const profile = getActiveProfile()
    if (!profile || profileIdRef.current === profile.id) return
    profileIdRef.current = profile.id
    stoppingRef.current = false
    try {
      const saved = readProfileValue(STORAGE_KEY)
      const restored = saved ? (JSON.parse(saved) as DownloadBatch[]) : []
      const clean = restored.map((batch) => ({
        ...batch,
        finishedAt:
          batch.status === 'done' || batch.status === 'error'
            ? (batch.finishedAt ?? Date.now())
            : undefined,
        jobs: batch.jobs.map((job) =>
          job.status === 'downloading' || job.status === 'encrypting'
            ? {
                ...job,
                status: 'queued' as const,
                progress: 0,
                bytesWritten: 0,
                bytesTotal: null,
              }
            : job,
        ),
      }))
      batchesRef.current = clean
      setBatches(clean)
      pump()
    } catch (error) {
      console.error('[DownloadProvider] restore error', error)
      batchesRef.current = []
      setBatches([])
    }
  }, [
    isUnlocked,
    pump,
    stop,
  ])

  const start = useCallback(
    async (rawUrl: string) => {
      let url: URL
      try {
        url = new URL(rawUrl.trim())
      } catch {
        throw new Error('Enter a valid HTTP or HTTPS page URL.')
      }
      if (!/^https?:$/.test(url.protocol) || url.username || url.password)
        throw new Error('Enter a public HTTP or HTTPS page URL.')
      if (!isUnlocked || !profileIdRef.current) throw new Error('Unlock the vault first.')
      const albumId = await ensureDownloadsAlbum()
      const batch: DownloadBatch = {
        id: randomUUID(),
        albumId,
        sourceUrl: url.href,
        status: 'searching',
        jobs: [],
        createdAt: Date.now(),
      }
      update((current) => [batch, ...current])
      pump()
      return albumId
    },
    [
      isUnlocked,
      pump,
      update,
    ],
  )

  const retryJob = useCallback(
    (batchId: string, jobId: string) => {
      patchJob(batchId, jobId, {
        status: 'queued',
        progress: 0,
        errorMessage: undefined,
        retries:
          (batchesRef.current
            .find((batch) => batch.id === batchId)
            ?.jobs.find((job) => job.id === jobId)?.retries ?? 0) + 1,
      })
      patchBatch(batchId, {
        status: 'running',
        finishedAt: undefined,
      })
      pump()
    },
    [
      patchBatch,
      patchJob,
      pump,
    ],
  )

  const retryBatch = useCallback(
    (batchId: string) => {
      patchBatch(batchId, {
        status: 'searching',
        errorMessage: undefined,
        finishedAt: undefined,
      })
      pump()
    },
    [
      patchBatch,
      pump,
    ],
  )

  useEffect(() => {
    if (!isUnlocked) return
    const timers = batches
      .filter((batch) => (batch.status === 'done' || batch.status === 'error') && batch.finishedAt)
      .map((batch) => {
        const hasErrors = batch.status === 'error' || batch.jobs.some((job) => job.status === 'error')
        const duration = hasErrors ? 10_000 : 1_000
        return setTimeout(() => {
          if (getActiveProfile()?.id !== profileIdRef.current) return
          const latest = batchesRef.current.find((item) => item.id === batch.id)
          if (!latest || latest.finishedAt !== batch.finishedAt || (latest.status !== 'done' && latest.status !== 'error')) return
          update((current) => current.filter((item) => item.id !== batch.id))
        }, Math.max(0, (batch.finishedAt ?? Date.now()) + duration - Date.now()))
      })
    return () => timers.forEach(clearTimeout)
  }, [batches, isUnlocked, update])

  return (
    <DownloadContext.Provider
      value={{
        batches,
        start,
        retryJob,
        retryBatch,
      }}
    >
      {children}
    </DownloadContext.Provider>
  )
}

export function useDownloads(): DownloadContextValue {
  const context = useContext(DownloadContext)
  if (!context) throw new Error('useDownloads must be used within DownloadProvider')
  return context
}

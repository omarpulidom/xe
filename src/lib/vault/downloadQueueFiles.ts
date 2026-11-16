import { Paths } from 'expo-file-system'
import fs from 'react-native-nitro-file-system'

export function downloadTempPath(id: string): string {
  const root = Paths.cache.uri.replace(/^file:\/\//, '').replace(/\/$/, '')
  return `${root}/xe_download_${id}.part`
}

export function removeDownloadTemp(id: string): void {
  const path = downloadTempPath(id)
  if (fs.existsSync(path)) fs.unlinkSync(path)
}

export function cleanupDownloadTemps(): void {
  const root = Paths.cache.uri.replace(/^file:\/\//, '').replace(/\/$/, '')
  if (!fs.existsSync(root)) return
  for (const name of fs.readdirSync(root) as string[]) {
    if (/^xe_download_[0-9a-f-]+\.part$/i.test(name)) fs.unlinkSync(`${root}/${name}`)
  }
}

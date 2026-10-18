export type MediaLink = {
  url: string
  name: string
  mime: 'video/mp4' | 'image/jpeg'
}

function decodeHtml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase()
    if (lower.startsWith('#')) {
      const code = lower.startsWith('#x')
        ? Number.parseInt(lower.slice(2), 16)
        : Number.parseInt(lower.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match
    }
    return (
      (
        {
          amp: '&',
          quot: '"',
          apos: "'",
          lt: '<',
          gt: '>',
        } as Record<string, string>
      )[lower] ?? match
    )
  })
}

export function extractMediaLinks(pageUrl: string, html: string): MediaLink[] {
  const normalized = decodeHtml(html).replace(/\\\//g, '/')
  const pattern = /(?:https?:\/\/|\/\/|\/)[^\s"'<>\\]+?\.(?:mp4|jpg|jpeg)(?:\?[^\s"'<>\\]*)?/gi
  const videos: string[] = []
  const images: string[] = []
  const seen = new Set<string>()
  for (const match of normalized.matchAll(pattern)) {
    try {
      const url = new URL(match[0], pageUrl)
      if (!/^https?:$/.test(url.protocol) || seen.has(url.href)) continue
      seen.add(url.href)
      if (/\.mp4$/i.test(url.pathname)) videos.push(url.href)
      else if (/\.jpe?g$/i.test(url.pathname)) images.push(url.href)
    } catch {
      /* Ignore invalid links in page HTML. */
    }
  }
  const videoDirectories = new Set(videos.map((url) => new URL(url).pathname.replace(/[^/]*$/, '')))
  const matchingImages = images.filter((url) =>
    videoDirectories.has(new URL(url).pathname.replace(/[^/]*$/, '')),
  )
  const id = new URL(pageUrl).pathname.split('/').filter(Boolean)[0] || 'download'
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'download'
  return [
    ...videos.map((url, index) => ({
      url,
      name: `${safeId}_${index + 1}.mp4`,
      mime: 'video/mp4' as const,
    })),
    ...matchingImages.map((url, index) => ({
      url,
      name: `${safeId}_${index + 1}${new URL(url).pathname.toLowerCase().endsWith('.jpeg') ? '.jpeg' : '.jpg'}`,
      mime: 'image/jpeg' as const,
    })),
  ]
}

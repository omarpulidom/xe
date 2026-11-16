import { describe, expect, test } from 'bun:test'
import { extractMediaLinks } from './downloadExtractor'

describe('extractMediaLinks', () => {
  test('resolves and deduplicates links, keeping only images beside a video', () => {
    const html = String.raw`
      <video src="https:\/\/cdn.example\/set\/clip.mp4?token=1"></video>
      <a href="//cdn.example/set/clip.mp4?token=1"></a>
      <img src="//cdn.example/set/cover.jpg?x=1&amp;y=2">
      <img src="/other/unrelated.jpeg">
    `
    expect(extractMediaLinks('https://page.example/item/42', html)).toEqual([
      {
        url: 'https://cdn.example/set/clip.mp4?token=1',
        name: 'item_1.mp4',
        mime: 'video/mp4',
      },
      {
        url: 'https://cdn.example/set/cover.jpg?x=1&y=2',
        name: 'item_1.jpg',
        mime: 'image/jpeg',
      },
    ])
  })

  test('ignores images outside an MP4 directory and unsupported media', () => {
    const html =
      '<img src="/set/one.jpg"><video src="/set/two.mp4"></video><img src="/other/three.jpeg"><a href="/set/four.png"></a>'
    expect(extractMediaLinks('https://site.example/watch/7', html)).toEqual([
      {
        url: 'https://site.example/set/two.mp4',
        name: 'watch_1.mp4',
        mime: 'video/mp4',
      },
      {
        url: 'https://site.example/set/one.jpg',
        name: 'watch_1.jpg',
        mime: 'image/jpeg',
      },
    ])
  })
})

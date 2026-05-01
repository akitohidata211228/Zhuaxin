// lib/stickerHelper.js — Helper konversi media ke sticker WebP
// WM (watermark) metadata diambil dari config.js (stickerPack & stickerAuthor)
import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import config from '../config.js'

/**
 * Konversi buffer gambar statis ke WebP sticker dengan WM metadata
 * @param {Buffer} buf   - Buffer gambar (png/jpg/webp/gif frame pertama)
 * @param {string} ext   - Extension hint: 'png' | 'jpg' | 'webp' | 'gif'
 * @returns {Promise<Buffer>} WebP buffer siap kirim sebagai sticker
 */
export async function toStaticSticker(buf, ext = 'png') {
  const sticker = new Sticker(buf, {
    pack: config.stickerPack   || '✦ Bot ✦',
    author: config.stickerAuthor || '',
    type: StickerTypes.FULL,
    categories: ['🤩', '🎉'],
    id: '12345',
    quality: 70,
    background: '#00000000',
  })
  return sticker.toBuffer()
}

/**
 * Konversi buffer video/gif ke WebP animated sticker dengan WM metadata
 * @param {Buffer} buf   - Buffer video/gif
 * @param {string} ext   - Extension hint: 'mp4' | 'gif' | 'webm'
 * @returns {Promise<Buffer>} Animated WebP buffer siap kirim sebagai sticker
 */
export async function toAnimatedSticker(buf, ext = 'mp4') {
  const sticker = new Sticker(buf, {
    pack: config.stickerPack   || '✦ Bot ✦',
    author: config.stickerAuthor || '',
    type: StickerTypes.FULL,
    categories: ['🤩', '🎉'],
    id: '12345',
    quality: 70,
    background: '#00000000',
  })
  return sticker.toBuffer()
}
